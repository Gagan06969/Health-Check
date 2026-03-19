require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const app = express();
const PORT = process.env.PORT || 3004;

console.log(`Starting server on port ${PORT}...`);
app.listen(PORT, () => {
  console.log(`[SERVER] Ready on port ${PORT}`);
});



// Nodemailer Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
});



// Helper: Hashing
const hashEmail = (email) => {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
};

// Database setup
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    
    // Create tables
    db.serialize(() => {
      // Core Users table (Hashed email addresses)
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email_hash TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // OTP storage
      db.run(`CREATE TABLE IF NOT EXISTS otps (
        email_hash TEXT PRIMARY KEY,
        otp TEXT NOT NULL,
        expires_at DATETIME NOT NULL
      )`);

      // Profile table (renamed from user for clarity)
      db.run(`CREATE TABLE IF NOT EXISTS user_profiles (
        user_id INTEGER PRIMARY KEY,
        weight REAL,
        targetWeight REAL,
        height REAL,
        age INTEGER,
        gender TEXT,
        bmr REAL,
        dailyGoalCalories INTEGER,
        dietPreference TEXT DEFAULT 'Both',
        stepGoal INTEGER DEFAULT 10000,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )`);

      // DailyLog table (added user_id)
      db.run(`CREATE TABLE IF NOT EXISTS daily_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        date TEXT,
        caloriesConsumed INTEGER DEFAULT 0,
        stepsWalked INTEGER DEFAULT 0,
        caloriesBurned INTEGER DEFAULT 0,
        foods TEXT DEFAULT '[]',
        exercises TEXT DEFAULT '[]',
        UNIQUE(user_id, date),
        FOREIGN KEY(user_id) REFERENCES users(id)
      )`);
      
      // CustomFood table (added user_id)
      db.run(`CREATE TABLE IF NOT EXISTS custom_food (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        name TEXT,
        calories_per_serving INTEGER,
        serving_unit TEXT,
        UNIQUE(user_id, name),
        FOREIGN KEY(user_id) REFERENCES users(id)
      )`);

      // Migration/Safety: Add columns if they don't exist
      db.run(`ALTER TABLE daily_log ADD COLUMN user_id INTEGER`, (err) => {});
      db.run(`ALTER TABLE custom_food ADD COLUMN user_id INTEGER`, (err) => {});
      
      // Cleanup: If old 'user' table exists, migrate data for first user or just drop
      // For this session, we'll assume a fresh start or simple migration
    });
  }
});

console.log('DB setup initiated. Moving to route registration...');

console.log('Trace: Loading requireAuth...');
const requireAuth = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'Unauthorized: No user_id provided' });
  req.userId = parseInt(userId);
  next();
};

console.log('Trace: Registering Auth routes...');
app.post('/api/auth/send-otp', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email address required' });

  const emailHash = hashEmail(email);
  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit OTP
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min expiry

  db.run(`INSERT INTO otps (email_hash, otp, expires_at) VALUES (?, ?, ?) 
          ON CONFLICT(email_hash) DO UPDATE SET otp = excluded.otp, expires_at = excluded.expires_at`, 
    [emailHash, otp, expiresAt], async (err) => {
      if (err) return res.status(500).json({ error: err.message });
      
      try {
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'Your Health Tracker OTP',
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
              <h2 style="color: #4CAF50;">Health Tracker</h2>
              <p>Hello,</p>
              <p>Your verification code is: <strong style="font-size: 24px; color: #333;">${otp}</strong></p>
              <p>This code will expire in 5 minutes.</p>
              <p>If you didn't request this, please ignore this email.</p>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
        console.log(`[AUTH] OTP sent to ${email} (${emailHash.substring(0,8)}...)`);
        res.json({ success: true, message: 'OTP sent successfully to your email' });
      } catch (mailErr) {
        console.error('Error sending email:', mailErr);
        // Fallback: still show in console for dev
        console.log(`[AUTH-FALLBACK] OTP for ${email}: ${otp}`);
        res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
      }
  });
});


app.get('/api/user', requireAuth, (req, res) => {
  db.get('SELECT * FROM user_profiles WHERE user_id = ?', [req.userId], (err, row) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(row || null); // Return null if no profile yet
  });
});


app.get('/api/logs/:date', requireAuth, (req, res) => {
  const { date } = req.params;
  db.get('SELECT * FROM daily_log WHERE user_id = ? AND date = ?', [req.userId, date], (err, row) => {
    if (err) res.status(500).json({ error: err.message });
    else if (!row) {
        res.json({ date, user_id: req.userId, caloriesConsumed: 0, stepsWalked: 0, caloriesBurned: 0, foods: '[]', exercises: '[]' });
    } else res.json(row);
  });
});


app.get('/api/food/search', requireAuth, async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'Query parameter required' });
  
  const customQuery = `%${query}%`;
  db.all(`SELECT * FROM custom_food WHERE user_id = ? AND name LIKE ? LIMIT 5`, [req.userId, customQuery], async (err, customRows) => {
    let results = (customRows || []).map(row => ({
      id: `custom_${row.id}`,
      name: row.name,
      brand: 'Custom',
      calories_per_100g: row.calories_per_serving,
      unit: row.serving_unit,
      image: null
    }));

    try {
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10`;
      const response = await axios.get(url);
      if (response.data?.products) {
        const items = response.data.products
          .filter(p => p.nutriments?.['energy-kcal_100g'])
          .map(p => ({
            id: p._id,
            name: p.product_name || p.generic_name,
            brand: p.brands?.split(',')[0] || 'Generic',
            calories_per_100g: p.nutriments['energy-kcal_100g'],
            unit: '100g',
            image: p.image_front_thumb_url
          }));
        results = [...results, ...items].slice(0, 10);
      }
      res.json({ results });
    } catch (err) {
      res.json({ results });
    }
  });
});



// 2. Verify OTP
app.post('/api/auth/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });

  const emailHash = hashEmail(email);

  db.get(`SELECT * FROM otps WHERE email_hash = ?`, [emailHash], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row || row.otp !== otp || new Date() > new Date(row.expires_at)) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // OTP Valid - Get or Create User
    db.serialize(() => {
      db.run(`INSERT OR IGNORE INTO users (email_hash) VALUES (?)`, [emailHash]);
      db.get(`SELECT id FROM users WHERE email_hash = ?`, [emailHash], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Clean up OTP
        db.run(`DELETE FROM otps WHERE email_hash = ?`, [emailHash]);
        
        // Check if profile exists
        db.get(`SELECT * FROM user_profiles WHERE user_id = ?`, [user.id], (err, profile) => {
          res.json({ 
            success: true, 
            userId: user.id, 
            hasProfile: !!profile 
          });
        });
      });
    });
  });
});

// --- PROTECTED ROUTES ---

// Get User Profile
app.get('/api/user', requireAuth, (req, res) => {
  db.get('SELECT * FROM user_profiles WHERE user_id = ?', [req.userId], (err, row) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(row || null); // Return null if no profile yet
  });
});

// Update User Profile
app.put('/api/user', requireAuth, (req, res) => {
  const { weight, targetWeight, height, age, gender, dietPreference, stepGoal } = req.body;
  
  let bmr = (gender === 'Male') 
    ? (10 * weight) + (6.25 * height) - (5 * age) + 5
    : (10 * weight) + (6.25 * height) - (5 * age) - 161;
  
  let dailyGoalCalories = (weight > targetWeight) ? (bmr * 1.2) - 500 : (bmr * 1.2);
  
  bmr = Math.round(bmr);
  dailyGoalCalories = Math.round(dailyGoalCalories);
  
  const stmt = `
    INSERT INTO user_profiles (user_id, weight, targetWeight, height, age, gender, bmr, dailyGoalCalories, dietPreference, stepGoal)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      weight = excluded.weight,
      targetWeight = excluded.targetWeight,
      height = excluded.height,
      age = excluded.age,
      gender = excluded.gender,
      bmr = excluded.bmr,
      dailyGoalCalories = excluded.dailyGoalCalories,
      dietPreference = excluded.dietPreference,
      stepGoal = excluded.stepGoal
  `;
  
  db.run(stmt, [req.userId, weight, targetWeight, height, age, gender, bmr, dailyGoalCalories, dietPreference || 'Both', stepGoal || 10000], function(err) {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ success: true, bmr, dailyGoalCalories });
  });
});

// Get date log
app.get('/api/logs/:date', requireAuth, (req, res) => {
  const { date } = req.params;
  db.get('SELECT * FROM daily_log WHERE user_id = ? AND date = ?', [req.userId, date], (err, row) => {
    if (err) res.status(500).json({ error: err.message });
    else if (!row) {
        res.json({ date, user_id: req.userId, caloriesConsumed: 0, stepsWalked: 0, caloriesBurned: 0, foods: '[]', exercises: '[]' });
    } else res.json(row);
  });
});

// Set/Update log
app.post('/api/logs', requireAuth, (req, res) => {
  const { date, caloriesConsumed, stepsWalked, caloriesBurned, foods, exercises } = req.body;
  const totalBurned = caloriesBurned || Math.round(stepsWalked * 0.04);
  
  const foodsStr = typeof foods === 'string' ? foods : JSON.stringify(foods || []);
  const exercisesStr = typeof exercises === 'string' ? exercises : JSON.stringify(exercises || []);

  const stmt = `
    INSERT INTO daily_log (user_id, date, caloriesConsumed, stepsWalked, caloriesBurned, foods, exercises) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET 
      caloriesConsumed = excluded.caloriesConsumed,
      stepsWalked = excluded.stepsWalked,
      caloriesBurned = excluded.caloriesBurned,
      foods = excluded.foods,
      exercises = excluded.exercises
  `;
  db.run(stmt, [req.userId, date, caloriesConsumed, stepsWalked, totalBurned, foodsStr, exercisesStr], function(err) {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ success: true });
  });
});

// Search Food
app.get('/api/food/search', requireAuth, async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'Query parameter required' });
  
  const customQuery = `%${query}%`;
  db.all(`SELECT * FROM custom_food WHERE user_id = ? AND name LIKE ? LIMIT 5`, [req.userId, customQuery], async (err, customRows) => {
    let results = (customRows || []).map(row => ({
      id: `custom_${row.id}`,
      name: row.name,
      brand: 'Custom',
      calories_per_100g: row.calories_per_serving,
      unit: row.serving_unit,
      image: null
    }));

    try {
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10`;
      const response = await axios.get(url);
      if (response.data?.products) {
        const items = response.data.products
          .filter(p => p.nutriments?.['energy-kcal_100g'])
          .map(p => ({
            id: p._id,
            name: p.product_name || p.generic_name,
            brand: p.brands?.split(',')[0] || 'Generic',
            calories_per_100g: p.nutriments['energy-kcal_100g'],
            unit: '100g',
            image: p.image_front_thumb_url
          }));
        results = [...results, ...items].slice(0, 10);
      }
      res.json({ results });
    } catch (err) {
      res.json({ results });
    }
  });
});

// Create Custom Food
app.post('/api/food/custom', requireAuth, (req, res) => {
  const { name, calories_per_serving, serving_unit } = req.body;
  if (!name || typeof calories_per_serving !== 'number' || !serving_unit) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const stmt = `INSERT INTO custom_food (user_id, name, calories_per_serving, serving_unit) VALUES (?, ?, ?, ?)`;
  db.run(stmt, [req.userId, name, calories_per_serving, serving_unit], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: this.lastID });
  });
});


// AI Chatbot
app.post('/api/chat', requireAuth, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  try {
    const prompt = `You are a helpful AI Nutritionist. User says: "${message}". 
    Provide a brief, encouraging response (2-3 sentences) focused on their health goals.`;
    const result = await aiModel.generateContent(prompt);
    const response = await result.response;
    res.json({ reply: response.text() });
  } catch (err) {
    res.status(500).json({ reply: "I'm having trouble thinking. Try again later!" });
  }
});

// AI Smart Meal Suggestion
app.post('/api/meal-suggest', requireAuth, async (req, res) => {
  const { mealName, targetCalories, dietPreference, ingredients } = req.body;
  if (!mealName || !targetCalories) return res.status(400).json({ error: 'Details required' });

  try {
    const dietStr = dietPreference && dietPreference !== 'Both' ? `${dietPreference} (strictly)` : 'Vegetarian or Non-Vegetarian';
    const ingredientContext = ingredients ? `User has: "${ingredients}". Use these.` : `Suggest healthy foods.`;
    
    const prompt = `Suggest a SPECIFIC ${mealName} around ${targetCalories} kcal. 
    Preference: ${dietStr}. Context: ${ingredientContext}
    Format: "Eat [Portion] of [Food] (X kcal) to hit your [${targetCalories} kcal] target." 
    Keep it to 1-2 sentences.`;

    const result = await aiModel.generateContent(prompt);
    const response = await result.response;
    res.json({ suggestion: response.text().trim() });
  } catch (err) {
    res.status(500).json({ suggestion: "Failed to load meal suggestion." });
  }
});

// Get Weekly Analysis data
app.get('/api/weekly', requireAuth, (req, res) => {
  const stmt = `SELECT * FROM daily_log WHERE user_id = ? ORDER BY date DESC LIMIT 7`;
  db.all(stmt, [req.userId], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows.reverse());
  });
});


