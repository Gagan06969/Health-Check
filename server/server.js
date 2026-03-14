const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    
    // Create tables
    db.serialize(() => {
      // User table
      db.run(`CREATE TABLE IF NOT EXISTS user (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        weight REAL,
        targetWeight REAL,
        height REAL,
        age INTEGER,
        gender TEXT,
        bmr REAL,
        dailyGoalCalories INTEGER
      )`);

      // Initialize default user if not exists
      db.get('SELECT * FROM user WHERE id = 1', (err, row) => {
        if (!row) {
          db.run(`INSERT INTO user (weight, targetWeight, height, age, gender, bmr, dailyGoalCalories)
                  VALUES (70, 65, 175, 25, 'Male', 1700, 2200)`);
        }
      });

      // DailyLog table
      db.run(`CREATE TABLE IF NOT EXISTS daily_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT UNIQUE,
        caloriesConsumed INTEGER DEFAULT 0,
        stepsWalked INTEGER DEFAULT 0,
        caloriesBurned INTEGER DEFAULT 0,
        foods TEXT DEFAULT '[]',
        exercises TEXT DEFAULT '[]'
      )`);
      
      // Try to add new columns if upgrading from v1
      db.run(`ALTER TABLE daily_log ADD COLUMN foods TEXT DEFAULT '[]'`, (err) => { /* ignore if exists */ });
      db.run(`ALTER TABLE daily_log ADD COLUMN exercises TEXT DEFAULT '[]'`, (err) => { /* ignore if exists */ });
    });
  }
});

// Calculate metrics helper
const calculateTDEE = (bmr, stepsWalked) => {
    // Basic estimation: 1 step = ~0.04 calories burned above BMR
    const activeCalories = stepsWalked * 0.04;
    return Math.round(bmr + activeCalories);
};

// Routes

// Get User Profile
app.get('/api/user', (req, res) => {
  db.get('SELECT * FROM user WHERE id = 1', (err, row) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(row);
  });
});

// Update User Profile
app.put('/api/user', (req, res) => {
  const { weight, targetWeight, height, age, gender } = req.body;
  
  // Calculate BMR (Mifflin-St Jeor Equation)
  let bmr = 0;
  if (gender === 'Male') {
    bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
  } else {
    bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
  }
  
  // Base daily goal for weight loss (0.5kg/week = ~500 cal deficit)
  // Or maintenance if weight <= targetWeight
  let dailyGoalCalories = bmr * 1.2; // Sedentary TDEE approx
  if (weight > targetWeight) {
    dailyGoalCalories -= 500; // Deficit
  }
  
  bmr = Math.round(bmr);
  dailyGoalCalories = Math.round(dailyGoalCalories);

  const stmt = `UPDATE user SET weight = ?, targetWeight = ?, height = ?, age = ?, gender = ?, bmr = ?, dailyGoalCalories = ? WHERE id = 1`;
  db.run(stmt, [weight, targetWeight, height, age, gender, bmr, dailyGoalCalories], function(err) {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ success: true, bmr, dailyGoalCalories });
  });
});

// Get today's log or specific date
app.get('/api/logs/:date', (req, res) => {
  const { date } = req.params;
  db.get('SELECT * FROM daily_log WHERE date = ?', [date], (err, row) => {
    if (err) res.status(500).json({ error: err.message });
    else if (!row) {
        // Return mostly empty if not exists
        res.json({ date, caloriesConsumed: 0, stepsWalked: 0, caloriesBurned: 0, foods: '[]', exercises: '[]' });
    } else res.json(row);
  });
});

// Set/Update today's log (upsert)
app.post('/api/logs', (req, res) => {
  const { date, caloriesConsumed, stepsWalked, caloriesBurned, foods, exercises } = req.body;
  
  // Calculate default step calories if not explicitly provided
  const stepsCals = Math.round(stepsWalked * 0.04);
  const totalBurned = caloriesBurned || stepsCals; // Use provided burned calories (which includes exercises) or fallback
  
  const foodsStr = typeof foods === 'string' ? foods : JSON.stringify(foods || []);
  const exercisesStr = typeof exercises === 'string' ? exercises : JSON.stringify(exercises || []);

  const stmt = `
    INSERT INTO daily_log (date, caloriesConsumed, stepsWalked, caloriesBurned, foods, exercises) 
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET 
      caloriesConsumed = excluded.caloriesConsumed,
      stepsWalked = excluded.stepsWalked,
      caloriesBurned = excluded.caloriesBurned,
      foods = excluded.foods,
      exercises = excluded.exercises
  `;
  db.run(stmt, [date, caloriesConsumed, stepsWalked, totalBurned, foodsStr, exercisesStr], function(err) {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ success: true, date, caloriesConsumed, stepsWalked, caloriesBurned: totalBurned, foods: foodsStr, exercises: exercisesStr });
  });
});

// Search Food via OpenFoodFacts
app.get('/api/food/search', async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'Query parameter required' });
  
  try {
    // Search OpenFoodFacts for the product
    const response = await axios.get(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5`);
    
    if (response.data && response.data.products) {
      const items = response.data.products
        .filter(p => p.nutriments && p.nutriments['energy-kcal_100g']) // Only return items with known calories
        .map(p => ({
          name: p.product_name || p.generic_name || query,
          brand: p.brands,
          calories_per_100g: p.nutriments['energy-kcal_100g'],
          image: p.image_front_thumb_url
        }));
        
      res.json({ results: items });
    } else {
      res.json({ results: [] });
    }
  } catch (err) {
    console.error('OpenFoodFacts API error:', err.message);
    res.status(500).json({ error: 'Failed to fetch food details' });
  }
});

// Get Weekly Analysis data (last 7 days)
app.get('/api/weekly', (req, res) => {
  const stmt = `
    SELECT * FROM daily_log 
    ORDER BY date DESC 
    LIMIT 7
  `;
  db.all(stmt, [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else {
        // Reverse to have chronological order for charts
        res.json(rows.reverse());
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
