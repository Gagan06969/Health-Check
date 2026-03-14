import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Settings, Plus, Activity, HeartPulse, Target, Flame, X } from 'lucide-react';
import { ProfileModal } from './components/ProfileModal';
import { LogModal } from './components/LogModal';
import { api } from './utils/api';

function App() {
  const [user, setUser] = useState<any>(null);
  const [todayLog, setTodayLog] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  
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
  const netCalories = todayLog.caloriesConsumed - activeCalories; 
  
  // Progress calculations
  const goalCals = user.dailyGoalCalories || 2000;
  const progressRatio = Math.min((todayLog.caloriesConsumed / goalCals) * 100, 100);

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
          <div className="stat-value">{todayLog.stepsWalked.toLocaleString()}</div>
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
    
    </div>
  );
}

export default App;
