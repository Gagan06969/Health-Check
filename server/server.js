require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });


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
        dailyGoalCalories INTEGER,
        dietPreference TEXT DEFAULT 'Both',
        stepGoal INTEGER DEFAULT 10000
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
      db.run(`ALTER TABLE user ADD COLUMN dietPreference TEXT DEFAULT 'Both'`, (err) => { /* ignore */ });
      db.run(`ALTER TABLE user ADD COLUMN stepGoal INTEGER DEFAULT 10000`, (err) => { /* ignore */ });

      // CustomFood table
      db.run(`CREATE TABLE IF NOT EXISTS custom_food (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        calories_per_serving INTEGER,
        serving_unit TEXT
      )`);
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
  const { weight, targetWeight, height, age, gender, dietPreference, stepGoal } = req.body;
  
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
  
  const dietPref = dietPreference || 'Both';
  const sGoal = stepGoal || 10000;

  const stmt = `UPDATE user SET weight = ?, targetWeight = ?, height = ?, age = ?, gender = ?, bmr = ?, dailyGoalCalories = ?, dietPreference = ?, stepGoal = ? WHERE id = 1`;
  db.run(stmt, [weight, targetWeight, height, age, gender, bmr, dailyGoalCalories, dietPref, sGoal], function(err) {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ success: true, bmr, dailyGoalCalories, dietPreference: dietPref, stepGoal: sGoal });
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

// Search Food via OpenFoodFacts and Local Custom DB
app.get('/api/food/search', async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'Query parameter required' });
  
  try {
    // First, search our local CustomFoods DB
    const customQuery = `%${query}%`;
    db.all(`SELECT * FROM custom_food WHERE name LIKE ? LIMIT 5`, [customQuery], async (err, customRows) => {
      let results = [];
      if (!err && customRows) {
        results = customRows.map(row => ({
          id: `custom_${row.id}`,
          name: row.name,
          brand: 'Custom',
          calories_per_100g: row.calories_per_serving, // Abusing this field for simplicity, it means per serving here
          unit: row.serving_unit, // Ensure we pass the unit to the frontend
          image: null
        }));
      }

      // Then fallback to OpenFoodFacts for more
      try {
        const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=15&tagtype_0=countries&tag_contains_0=contains&tag_0=india`;
        const response = await axios.get(url);
        
        if (response.data && response.data.products) {
          let items = response.data.products
            .filter(p => p.nutriments && p.nutriments['energy-kcal_100g'])
            .map(p => ({
              id: p._id || p.id,
              name: p.product_name || p.generic_name || query,
              brand: p.brands ? p.brands.split(',')[0] : 'Generic',
              calories_per_100g: p.nutriments['energy-kcal_100g'],
              unit: '100g', // Standard API unit
              image: p.image_front_thumb_url
            }));
          
          items = items.filter((item, index, self) => index === self.findIndex((t) => (t.name === item.name)));
          
          // Combine and return top 8
          res.json({ results: [...results, ...items].slice(0, 8) });
        } else {
          res.json({ results });
        }
      } catch (externalErr) {
        // If external API fails (e.g. 504), return at least local results
        console.error('OpenFoodFacts API error:', externalErr.message);
        res.json({ results });
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch food details' });
  }
});

// Create Custom Food
app.post('/api/food/custom', (req, res) => {
  const { name, calories_per_serving, serving_unit } = req.body;
  if (!name || typeof calories_per_serving !== 'number' || !serving_unit) {
    return res.status(400).json({ error: 'Missing required custom food fields' });
  }

  const stmt = `INSERT INTO custom_food (name, calories_per_serving, serving_unit) VALUES (?, ?, ?)`;
  db.run(stmt, [name, calories_per_serving, serving_unit], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint')) {
        return res.status(400).json({ error: 'Food with this name already exists' });
      }
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, id: this.lastID, name, calories_per_serving, serving_unit });
  });
});

// AI Chatbot Endpoint (Live Gemini Model)
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  try {
    const prompt = `You are a helpful, concise AI Nutritionist for a fitness tracker application. 
The user is asking: "${message}".
Please provide a brief (2-3 sentences max) estimation of the calories and nutritional profile of this food item.
Be encouraging but strictly focused on precise numerical calorie ranges.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    res.json({ reply: response.text });
  } catch (err) {
    console.error('Gemini API Error:', err.message);
    res.status(500).json({ reply: "I'm sorry, I'm having trouble connecting to my brain right now. Try again in a moment!" });
  }
});

// AI Smart Meal Suggestion
app.post('/api/meal-suggest', async (req, res) => {
  const { mealName, targetCalories, dietPreference } = req.body;
  
  if (!mealName || !targetCalories) return res.status(400).json({ error: 'Meal details required' });

  try {
    const dietStr = dietPreference && dietPreference !== 'Both' ? `${dietPreference} (strictly)` : 'Vegetarian or Non-Vegetarian';
    
    const prompt = `You are a personalized nutritionist AI. 
The user needs a ${mealName} suggestion that totals approximately ${targetCalories} calories.
Their dietary preference is: ${dietStr}.
Crucial Rule: Suggest Indian or common global whole-foods.
Provide exactly ONE, highly specific meal combination that totals exactly around ${targetCalories} calories. 
Format your response concisely: "Just eat [Food A] (X kcal) + [Food B] (Y kcal) to hit your [${targetCalories} kcal] target."
Do not include conversational filler like "Here is a suggestion". Be direct and bullet-like. Keep it under 2 sentences.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    res.json({ suggestion: response.text.trim() });
  } catch (err) {
    console.error('Gemini API Error:', err.message);
    res.status(500).json({ suggestion: "Failed to load a unique meal suggestion. Please try again or check your API key." });
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
