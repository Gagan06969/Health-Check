require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Initialize Groq Helper
const groqChat = async (prompt, model = 'llama-3.3-70b-versatile') => {
  const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data.choices[0].message.content;
};

// Initialize Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const app = express();
const PORT = process.env.PORT || 3004;

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

// Authentication Middleware
const requireAuth = async (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'Unauthorized: No user_id provided' });
  
  const { data: user, error } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .single();

  if (error || !user) return res.status(401).json({ error: 'User not found' });
  
  req.userId = parseInt(userId);
  next();
};

// --- AUTH ROUTES ---

// 1. Send OTP
app.post('/api/auth/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email address required' });

  const emailHash = hashEmail(email);
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('otps')
    .upsert({ email_hash: emailHash, otp, expires_at: expiresAt }, { onConflict: 'email_hash' });

  if (error) return res.status(500).json({ error: error.message });

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your Health Tracker OTP',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #4CAF50;">Health Tracker</h2>
          <p>Hello,</p>
          <p>Your verification code is: <strong style="font-size: 24px; color: #333;">${otp}</strong></p>
          <p>This code will expire in 5 minutes.</p>
        </div>
      `
    });
    console.log(`[AUTH] OTP sent to ${email}`);
    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ error: 'Failed to send OTP email' });
  }
});

// 2. Verify OTP
app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });

  const emailHash = hashEmail(email);

  const { data: otpRow, error: otpError } = await supabase
    .from('otps')
    .select('*')
    .eq('email_hash', emailHash)
    .single();

  if (otpError || !otpRow || otpRow.otp !== otp || new Date() > new Date(otpRow.expires_at)) {
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  }

  // OTP Valid - Get or Create User
  const { data: user, error: userError } = await supabase
    .from('users')
    .upsert({ email_hash: emailHash }, { onConflict: 'email_hash' })
    .select('id, username')
    .single();

  if (userError) return res.status(500).json({ error: userError.message });

  // Clean up OTP
  await supabase.from('otps').delete().eq('email_hash', emailHash);

  // Check if profile exists
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  res.json({ 
    success: true, 
    userId: user.id, 
    username: user.username || null,
    hasUsername: !!user.username,
    hasProfile: !!profile 
  });
});

// 3. Check Username Availability
app.get('/api/auth/check-username', async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: 'Username required' });

  const { data, error } = await supabase
    .from('users')
    .select('id')
    .ilike('username', username)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ available: !data });
});

// 4. Set Username
app.post('/api/auth/set-username', requireAuth, async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });

  // Re-check uniqueness just in case
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .ilike('username', username)
    .maybeSingle();

  if (existing) return res.status(400).json({ error: 'Username already taken' });

  const { error } = await supabase
    .from('users')
    .update({ username })
    .eq('id', req.userId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// --- PROTECTED ROUTES ---

// Get User Profile
app.get('/api/user', requireAuth, async (req, res) => {
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', req.userId)
    .single();

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('username')
    .eq('id', req.userId)
    .single();

  if (userError) return res.status(500).json({ error: userError.message });

  res.json({ 
    user_id: profile?.user_id || req.userId,
    weight: profile?.weight || null,
    targetWeight: profile?.target_weight || null,
    height: profile?.height || null,
    age: profile?.age || null,
    gender: profile?.gender || null,
    bmr: profile?.bmr || null,
    dailyGoalCalories: profile?.daily_goal_calories || null,
    dietPreference: profile?.diet_preference || 'Both',
    stepGoal: profile?.step_goal || 10000,
    username: user?.username || null
  });
});

// Update User Profile
app.put('/api/user', requireAuth, async (req, res) => {
  const { weight, targetWeight, height, age, gender, dietPreference, stepGoal } = req.body;
  
  let bmr = (gender === 'Male') 
    ? (10 * weight) + (6.25 * height) - (5 * age) + 5
    : (10 * weight) + (6.25 * height) - (5 * age) - 161;
  
  let dailyGoalCalories = (weight > targetWeight) ? (bmr * 1.2) - 500 : (bmr * 1.2);
  
  bmr = Math.round(bmr);
  dailyGoalCalories = Math.round(dailyGoalCalories);
  
  const profileData = {
    user_id: req.userId,
    weight,
    target_weight: targetWeight,
    height,
    age,
    gender,
    bmr,
    daily_goal_calories: dailyGoalCalories,
    diet_preference: dietPreference || 'Both',
    step_goal: stepGoal || 10000
  };

  const { error } = await supabase
    .from('user_profiles')
    .upsert(profileData, { onConflict: 'user_id' });

  if (error) {
    console.error('Profile Update Error:', error);
    res.status(500).json({ error: error.message });
  } else {
    res.json({ success: true, bmr, dailyGoalCalories });
  }
});

// Get date log
app.get('/api/logs/:date', requireAuth, async (req, res) => {
  const { date } = req.params;
  const { data: row, error } = await supabase
    .from('daily_log')
    .select('*')
    .eq('user_id', req.userId)
    .eq('date', date)
    .single();

  if (error && error.code !== 'PGRST116') {
    return res.status(500).json({ error: error.message });
  }
  
  if (!row) {
    res.json({ 
      date, 
      user_id: req.userId, 
      caloriesConsumed: 0, 
      stepsWalked: 0, 
      caloriesBurned: 0, 
      foods: [], 
      exercises: [] 
    });
  } else {
    res.json({
      ...row,
      caloriesConsumed: row.calories_consumed || 0,
      stepsWalked: row.steps_walked || 0,
      caloriesBurned: row.calories_burned || 0,
      foods: row.foods || [],
      exercises: row.exercises || []
    });
  }
});

// Set/Update log
app.post('/api/logs', requireAuth, async (req, res) => {
  const { date, caloriesConsumed, stepsWalked, caloriesBurned, foods, exercises } = req.body;
  const totalBurned = caloriesBurned || Math.round(stepsWalked * 0.04);
  
  const logData = {
    user_id: req.userId,
    date,
    calories_consumed: caloriesConsumed,
    steps_walked: stepsWalked,
    calories_burned: totalBurned,
    foods: foods || [],
    exercises: exercises || []
  };

  const { error } = await supabase
    .from('daily_log')
    .upsert(logData, { onConflict: 'user_id,date' });

  if (error) res.status(500).json({ error: error.message });
  else res.json({ success: true });
});

// Search Food
app.get('/api/food/search', requireAuth, async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'Query parameter required' });
  
  const { data: customRows, error: customError } = await supabase
    .from('custom_food')
    .select('*')
    .eq('user_id', req.userId)
    .ilike('name', `%${query}%`)
    .limit(5);

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

// Create Custom Food
app.post('/api/food/custom', requireAuth, async (req, res) => {
  const { name, calories_per_serving, serving_unit } = req.body;
  if (!name || typeof calories_per_serving !== 'number' || !serving_unit) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const { data, error } = await supabase
    .from('custom_food')
    .insert({ user_id: req.userId, name, calories_per_serving, serving_unit })
    .select('id')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, id: data.id });
});

// AI Chatbot
app.post('/api/chat', requireAuth, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  try {
    const prompt = `You are a helpful AI Nutritionist. User says: "${message}". 
    Provide a brief, encouraging response (2-3 sentences) focused on their health goals.`;
    const reply = await groqChat(prompt);
    res.json({ reply });
  } catch (err) {
    console.error('AI Chat Error:', err.response?.data || err.message);
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

    const suggestion = await groqChat(prompt);
    res.json({ suggestion });
  } catch (err) {
    console.error('AI Meal Suggest Error:', err.response?.data || err.message);
    res.status(500).json({ suggestion: "Failed to load meal suggestion." });
  }
});

// Get Weekly Analysis
app.get('/api/weekly', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('daily_log')
    .select('*')
    .eq('user_id', req.userId)
    .order('date', { ascending: false })
    .limit(7);

  if (error) {
    res.status(500).json({ error: error.message });
  } else {
    // Map snake_case to camelCase for the frontend
    const mapped = data.map(row => ({
      ...row,
      caloriesConsumed: row.calories_consumed || 0,
      stepsWalked: row.steps_walked || 0,
      caloriesBurned: row.calories_burned || 0
    })).reverse();
    res.json(mapped);
  }
});

// Voice-to-Log AI Parser
app.post('/api/logs/voice', requireAuth, async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text description required' });

  try {
    const prompt = `You are a nutrition expert. Extract food items and estimated calories from this text: "${text}". 
    Respond ONLY with a JSON array based on this format: [{"name": "Food Name", "calories": number, "quantity": "amount/unit"}].
    If quantity is unspecified, use "1 serving". Use standard calorie estimates if exact ones aren't given.
    IMPORTANT: Provide ONLY the JSON array, no conversational text.`;

    const resultText = await groqChat(prompt);
    const jsonMatch = resultText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No valid JSON array found in AI response');
    
    const parsed = JSON.parse(jsonMatch[0]);
    res.json({ success: true, items: Array.isArray(parsed) ? parsed : [parsed] });
  } catch (err) {
    console.error('AI Voice Log Error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to process voice log with AI' });
  }
});

app.listen(PORT, () => {
  console.log(`[SERVER] Ready on port ${PORT}`);
});


