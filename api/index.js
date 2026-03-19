import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

// --- CONFIG VALIDATION ---
const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'EMAIL_USER',
  'EMAIL_PASS',
  'GROQ_API_KEY'
];

const missingVars = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`FATAL: Missing environment variables: ${missingVars.join(', ')}`);
}

// Initialize Groq Helper
const groqChat = async (prompt, model = 'llama-3.3-70b-versatile') => {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is missing');
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
const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) 
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

const app = express();

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

// Helper: Hashing
const hashEmail = (email) => {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
};

// Authentication Middleware
const requireAuth = async (req, res, next) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
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
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    if (missingVars.length > 0) {
      return res.status(500).json({ 
        error: 'Server configuration error', 
        details: `Missing environment variables: ${missingVars.join(', ')}. Please add them to Vercel project settings.` 
      });
    }
    if (!supabase) return res.status(500).json({ error: 'Database connection failed' });

    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email address required' });
    
    const emailHash = hashEmail(email);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    
    const { error: upsertError } = await supabase.from('otps').upsert(
      { email_hash: emailHash, otp, expires_at: expiresAt }, 
      { onConflict: 'email_hash' }
    );
    
    if (upsertError) throw upsertError;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your Health Tracker OTP',
      html: `<div style="padding:20px; border:1px solid #ddd; border-radius:8px;"><h2>Health Tracker</h2><p>Your verification code is: <strong>${otp}</strong></p></div>`
    });
    
    res.json({ success: true });
  } catch (err) {
    console.error('send-otp error:', err);
    res.status(500).json({ error: 'Failed to send OTP', details: err.message });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Database connection failed' });
    const { email, otp } = req.body;
    const emailHash = hashEmail(email);
    const { data: otpRow } = await supabase.from('otps').select('*').eq('email_hash', emailHash).single();
    if (!otpRow || otpRow.otp !== otp || new Date() > new Date(otpRow.expires_at)) return res.status(400).json({ error: 'Invalid' });
    const { data: user } = await supabase.from('users').upsert({ email_hash: emailHash }, { onConflict: 'email_hash' }).select('id, username').single();
    await supabase.from('otps').delete().eq('email_hash', emailHash);
    const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).single();
    res.json({ success: true, userId: user.id, username: user.username || null, hasUsername: !!user.username, hasProfile: !!profile });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.get('/api/auth/check-username', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Database connection failed' });
  const { username } = req.query;
  const { data } = await supabase.from('users').select('id').ilike('username', username).maybeSingle();
  res.json({ available: !data });
});

app.post('/api/auth/set-username', requireAuth, async (req, res) => {
  const { username } = req.body;
  await supabase.from('users').update({ username }).eq('id', req.userId);
  res.json({ success: true });
});

// --- PROTECTED ROUTES ---
app.get('/api/user', requireAuth, async (req, res) => {
  const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', req.userId).single();
  const { data: user } = await supabase.from('users').select('username').eq('id', req.userId).single();
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

app.put('/api/user', requireAuth, async (req, res) => {
  const { weight, targetWeight, height, age, gender, dietPreference, stepGoal } = req.body;
  let bmr = Math.round((gender === 'Male') ? (10 * weight) + (6.25 * height) - (5 * age) + 5 : (10 * weight) + (6.25 * height) - (5 * age) - 161);
  let dailyGoalCalories = Math.round((weight > targetWeight) ? (bmr * 1.2) - 500 : (bmr * 1.2));
  await supabase.from('user_profiles').upsert({ user_id: req.userId, weight, target_weight: targetWeight, height, age, gender, bmr, daily_goal_calories: dailyGoalCalories, diet_preference: dietPreference || 'Both', step_goal: stepGoal || 10000 }, { onConflict: 'user_id' });
  res.json({ success: true, bmr, dailyGoalCalories });
});

app.get('/api/logs/:date', requireAuth, async (req, res) => {
  const { date } = req.params;
  const { data: row } = await supabase.from('daily_log').select('*').eq('user_id', req.userId).eq('date', date).single();
  if (!row) return res.json({ date, user_id: req.userId, caloriesConsumed: 0, stepsWalked: 0, caloriesBurned: 0, foods: [], exercises: [] });
  res.json({ ...row, caloriesConsumed: row.calories_consumed || 0, stepsWalked: row.steps_walked || 0, caloriesBurned: row.calories_burned || 0, foods: row.foods || [], exercises: row.exercises || [] });
});

app.post('/api/logs', requireAuth, async (req, res) => {
  const { date, caloriesConsumed, stepsWalked, caloriesBurned, foods, exercises } = req.body;
  await supabase.from('daily_log').upsert({ user_id: req.userId, date, calories_consumed: caloriesConsumed, steps_walked: stepsWalked, calories_burned: caloriesBurned || Math.round(stepsWalked * 0.04), foods: foods || [], exercises: exercises || [] }, { onConflict: 'user_id,date' });
  res.json({ success: true });
});

app.get('/api/food/search', requireAuth, async (req, res) => {
  const { query } = req.query;
  const { data: customRows } = await supabase.from('custom_food').select('*').eq('user_id', req.userId).ilike('name', `%${query}%`).limit(5);
  let results = (customRows || []).map(row => ({ id: `custom_${row.id}`, name: row.name, brand: 'Custom', calories_per_100g: row.calories_per_serving, unit: row.serving_unit, image: null }));
  try {
    const response = await axios.get(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&action=process&json=1&page_size=10`);
    if (response.data?.products) {
      const items = response.data.products.filter(p => p.nutriments?.['energy-kcal_100g']).map(p => ({ id: p._id, name: p.product_name || p.generic_name, brand: p.brands?.split(',')[0] || 'Generic', calories_per_100g: p.nutriments['energy-kcal_100g'], unit: '100g', image: p.image_front_thumb_url }));
      results = [...results, ...items].slice(0, 10);
    }
  } catch {}
  res.json({ results });
});

app.post('/api/chat', requireAuth, async (req, res) => {
  const { message } = req.body;
  const reply = await groqChat(`You are a helpful AI Nutritionist. User says: "${message}". Response briefly (2 sentences).`);
  res.json({ reply });
});

app.post('/api/meal-suggest', requireAuth, async (req, res) => {
  const { mealName, targetCalories, dietPreference, ingredients } = req.body;
  const prompt = `Suggest a SPECIFIC ${mealName} around ${targetCalories} kcal. Pref: ${dietPreference}. Context: ${ingredients}. Result in 1-2 sentences. Format: "Eat [Portion] of [Food] (X kcal) to hit your [${targetCalories} kcal] target."`;
  const suggestion = await groqChat(prompt);
  res.json({ suggestion });
});

app.get('/api/weekly', requireAuth, async (req, res) => {
  const { data } = await supabase.from('daily_log').select('*').eq('user_id', req.userId).order('date', { ascending: false }).limit(7);
  res.json(data.map(row => ({ ...row, caloriesConsumed: row.calories_consumed || 0, stepsWalked: row.steps_walked || 0, caloriesBurned: row.calories_burned || 0 })).reverse());
});

app.post('/api/logs/voice', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    const resultText = await groqChat(`Extract food items and estimated calories from: "${text}". Respond ONLY with JSON array: [{"name": "Food Name", "calories": number, "quantity": "amount/unit"}].`);
    const jsonMatch = resultText.match(/\[[\s\S]*\]/);
    res.json({ success: true, items: JSON.parse(jsonMatch[0]) });
  } catch (err) {
    res.status(500).json({ error: 'Voice processing failed' });
  }
});

export default app;
