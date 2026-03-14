import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Settings, Plus, Activity, HeartPulse, Target, Flame, PieChart, Sparkles } from 'lucide-react';
import { ProfileModal } from './components/ProfileModal';
import { LogModal } from './components/LogModal';
import { Chatbot } from './components/Chatbot';
import { api } from './utils/api';

function App() {
  const [user, setUser] = useState<any>(null);
  const [todayLog, setTodayLog] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  
  const [isSuggesting, setIsSuggesting] = useState<string | null>(null);
  const [suggestedMeal, setSuggestedMeal] = useState<{meal: string, text: string} | null>(null);
  
  const todayDate = format(new Date(), 'yyyy-MM-dd');

  const fetchData = async () => {
    try {
      const userData = await api.getUser();
      setUser(userData);
      
      const logData = await api.getLog(todayDate);
      setTodayLog(logData);
      
      const weekData = await api.getWeekly();
      setWeeklyData(weekData);
    } catch (err) {
      console.error('Failed to fetch data', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleProfileSave = async (data: any) => {
    await api.updateUser(data);
    setShowProfileModal(false);
    fetchData(); // Refresh data
  };

  const handleLogSave = async (data: any) => {
    await api.saveLog(data);
    setShowLogModal(false);
    fetchData(); // Refresh data
  };

  const handleSuggestMeal = async (mealName: string, cals: number) => {
    if (!user) return;
    setIsSuggesting(mealName);
    try {
      const data = await api.suggestMeal({ mealName, targetCalories: cals, dietPreference: user.dietPreference });
      setSuggestedMeal({ meal: mealName, text: data.suggestion });
    } catch (err) {
      alert("Failed to get suggestion. Check backend connection or AI key.");
    }
    setIsSuggesting(null);
  };

  if (!user || !todayLog) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh' }}>
        <div className="brand" style={{ animation: 'fadeIn 1s infinite alternate' }}>Loading...</div>
      </div>
    );
  }

  // Derived metrics
  const bmr = user.bmr || 0;
  const activeCalories = todayLog.caloriesBurned || 0;
  const tdee = bmr + activeCalories;
  
  const calorieDeficit = tdee - (todayLog.caloriesConsumed || 0);
  
  // Progress calculations
  const goalCals = user.dailyGoalCalories || 2000;
  const progressRatio = Math.min((todayLog.caloriesConsumed / goalCals) * 100, 100);

  // Meal planning (30% / 40% / 30%)
  const morningCals = Math.round(goalCals * 0.3);
  const afternoonCals = Math.round(goalCals * 0.4);
  const nightCals = Math.round(goalCals * 0.3);

  // Burn Targets if over calorie limit
  const excessCals = (todayLog.caloriesConsumed || 0) - goalCals;
  const targetSteps = excessCals > 0 ? Math.ceil(excessCals / 0.04) : 0;
  const targetPushups = excessCals > 0 ? Math.ceil(excessCals / 0.3) : 0;

  return (
    <div className="app-container">
      <header>
        <div className="brand">
          <HeartPulse size={32} color="var(--primary-glow)" /> HealthTracker
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-icon" onClick={() => setShowProfileModal(true)}>
            <Settings size={20} />
          </button>
          <button className="btn-primary" onClick={() => setShowLogModal(true)}>
            <Plus size={20} /> Log Activity
          </button>
        </div>
      </header>

      <div className="dashboard-grid">
        {/* Main Stat Card - Caloric Balance */}
        <div className="glass-panel" style={{ gridColumn: '1 / -1', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(99, 102, 241, 0.1))' }}>
          <div className="flex-between">
            <div>
              <div className="stat-header">Current Weight</div>
              <div className="stat-value">{user.weight}<span>kg</span></div>
              <div style={{ marginTop: '8px', color: 'var(--text-muted)' }}>
                Target: {user.targetWeight}kg 
                {user.weight > user.targetWeight ? (
                  <span className="text-emerald" style={{ marginLeft: '8px' }}>Keep going!</span>
                ) : (
                  <span className="text-indigo" style={{ marginLeft: '8px' }}>Goal reached!</span>
                )}
              </div>
              {excessCals > 0 && (
                 <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', fontSize: '0.85rem' }}>
                    <div style={{ color: '#fca5a5', fontWeight: 'bold', marginBottom: '8px' }}>🔥 Burn Excess Calories (+{excessCals} kcal):</div>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: 'white' }}>
                      <li>Walk <strong>~{targetSteps.toLocaleString()} steps</strong></li>
                      <li style={{ color: 'var(--text-muted)', listStyle: 'none', marginLeft: '-20px', margin: '4px 0' }}>OR</li>
                      <li>Do <strong>~{targetPushups} Pushups</strong></li>
                    </ul>
                 </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="stat-header" style={{ justifyContent: 'flex-end' }}>Calories Consumed vs Goal</div>
              <div className="stat-value">
                {todayLog.caloriesConsumed} <span style={{ fontSize: '1.5rem', opacity: 0.5 }}>/ {goalCals}</span>
              </div>
              <div style={{ width: '200px', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginTop: '12px', overflow: 'hidden' }}>
                <div style={{ width: `${progressRatio}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary-glow), var(--secondary-glow))', borderRadius: '4px', transition: 'width 1s ease-out' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="glass-panel stat-card">
          <div className="stat-header"><Activity size={18} /> Steps Walked</div>
          <div className="stat-value">
            {todayLog.stepsWalked.toLocaleString()}
            <span style={{ fontSize: '1rem', opacity: 0.5, marginLeft: '4px' }}>/ {user.stepGoal ? user.stepGoal.toLocaleString() : '10,000'}</span>
          </div>
          <div style={{ color: 'var(--secondary-glow)', fontSize: '0.9rem', marginTop: 'auto' }}>
            Burned ~{activeCalories} active calories
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-header"><Target size={18} /> TDEE (Estimated)</div>
          <div className="stat-value">{tdee}<span>kcal</span></div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 'auto' }}>
            Base BMR: {bmr} + Activity
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-header"><Flame size={18} /> Caloric Deficit</div>
          <div className="stat-value text-emerald">
            {calorieDeficit > 0 ? `-${calorieDeficit}` : `+${Math.abs(calorieDeficit)}`}<span>kcal</span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 'auto' }}>
            {calorieDeficit > 500 ? 'Great deficit for weight loss!' : 
             calorieDeficit > 0 ? 'Slight deficit.' : 'You are in a caloric surplus.'}
          </div>
        </div>
      </div>

      {/* Meal Targets (New Feature) */}
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '16px 0 -8px 0', fontSize: '1.2rem' }}>
        <PieChart size={20} className="text-purple" /> Recommended Macro Split (Meals)
      </h3>
      <div className="dashboard-grid">
        <div className="glass-panel stat-card" style={{ background: 'linear-gradient(135deg, rgba(253, 186, 116, 0.1), rgba(0,0,0,0.3))', borderColor: 'rgba(253, 186, 116, 0.2)', display: 'flex', flexDirection: 'column' }}>
          <div className="stat-header" style={{ color: '#fdba74', justifyContent: 'space-between' }}>
            Morning In (30%)
            <button className="btn-icon" onClick={() => handleSuggestMeal('Morning', morningCals)} style={{ color: '#fdba74', padding: '4px', background: 'rgba(253, 186, 116, 0.1)' }} disabled={isSuggesting === 'Morning'}>
              <Sparkles size={16} className={isSuggesting === 'Morning' ? 'spin-anim' : ''} />
            </button>
          </div>
          <div className="stat-value">{morningCals}<span>kcal</span></div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 'auto' }}>
            {suggestedMeal?.meal === 'Morning' ? <div style={{color: 'white', marginTop: '8px', lineHeight: '1.3'}}>{suggestedMeal.text}</div> : 'Ideal for breakfast (e.g., Poha, Oats)'}
          </div>
        </div>
        
        <div className="glass-panel stat-card" style={{ background: 'linear-gradient(135deg, rgba(252, 211, 77, 0.1), rgba(0,0,0,0.3))', borderColor: 'rgba(252, 211, 77, 0.2)', display: 'flex', flexDirection: 'column' }}>
          <div className="stat-header" style={{ color: '#fcd34d', justifyContent: 'space-between' }}>
            Afternoon (40%)
            <button className="btn-icon" onClick={() => handleSuggestMeal('Afternoon', afternoonCals)} style={{ color: '#fcd34d', padding: '4px', background: 'rgba(252, 211, 77, 0.1)' }} disabled={isSuggesting === 'Afternoon'}>
              <Sparkles size={16} className={isSuggesting === 'Afternoon' ? 'spin-anim' : ''} />
            </button>
          </div>
          <div className="stat-value">{afternoonCals}<span>kcal</span></div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 'auto' }}>
            {suggestedMeal?.meal === 'Afternoon' ? <div style={{color: 'white', marginTop: '8px', lineHeight: '1.3'}}>{suggestedMeal.text}</div> : 'Heaviest meal (e.g., Dal, Roti, Rice)'}
          </div>
        </div>

        <div className="glass-panel stat-card" style={{ background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.1), rgba(0,0,0,0.3))', borderColor: 'rgba(167, 139, 250, 0.2)', display: 'flex', flexDirection: 'column' }}>
          <div className="stat-header" style={{ color: '#a78bfa', justifyContent: 'space-between' }}>
            Night In (30%)
            <button className="btn-icon" onClick={() => handleSuggestMeal('Night', nightCals)} style={{ color: '#a78bfa', padding: '4px', background: 'rgba(167, 139, 250, 0.1)' }} disabled={isSuggesting === 'Night'}>
              <Sparkles size={16} className={isSuggesting === 'Night' ? 'spin-anim' : ''} />
            </button>
          </div>
          <div className="stat-value">{nightCals}<span>kcal</span></div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 'auto' }}>
            {suggestedMeal?.meal === 'Night' ? <div style={{color: 'white', marginTop: '8px', lineHeight: '1.3'}}>{suggestedMeal.text}</div> : 'Lighter dinner (e.g., Paneer, Salad)'}
          </div>
        </div>
      </div>

      {/* Weekly Charts */}
      {weeklyData.length > 0 && (
        <div className="dashboard-grid" style={{ marginTop: '16px' }}>
          <div className="glass-panel" style={{ height: '350px' }}>
            <h3 style={{ marginBottom: '24px' }}>Weekly Calories Consumed vs Burned (TDEE)</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickFormatter={(val) => val.slice(5)} />
                <YAxis stroke="var(--text-muted)" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--glass-border)', color: '#fff', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="caloriesConsumed" name="Consumed" fill="var(--secondary-glow)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="caloriesBurned" name="Active Burned" fill="var(--accent-color)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Modals */}
      {showProfileModal && <ProfileModal user={user} onClose={() => setShowProfileModal(false)} onSave={handleProfileSave} />}
      {showLogModal && <LogModal currentLog={todayLog} date={todayDate} onClose={() => setShowLogModal(false)} onSave={handleLogSave} />}
    
      {/* AI Chatbot */}
      <Chatbot />
    </div>
  );
}

export default App;
