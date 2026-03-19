import { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  Flame, 
  Plus, 
  Target,
  Settings,
  Sparkles,
  LogOut
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { api } from './utils/api';
import { ProfileModal } from './components/ProfileModal';
import { LogModal } from './components/LogModal';
import { Chatbot } from './components/Chatbot';
import { Login } from './components/Login';
import { AuthProvider, useAuth } from './context/AuthContext';
import type { User, DailyLog } from './types';
import './App.css';

function Dashboard() {
  const { logout, userId, username } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  const [weeklyData, setWeeklyData] = useState<DailyLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  
  const [isSuggesting, setIsSuggesting] = useState<string | null>(null);
  const [suggestedMeal, setSuggestedMeal] = useState<{ meal: string; text: string } | null>(null);
  const [ingredientInputs, setIngredientInputs] = useState<Record<string, string>>({});

  const todayDate = format(new Date(), 'yyyy-MM-dd');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const userData = await api.getUser();
      setUser(userData);
      
      const [logsData, currentLog] = await Promise.all([
        api.getWeekly(),
        api.getLog(todayDate)
      ]);
      setWeeklyData(logsData);
      setTodayLog(currentLog);

      // If no profile exists yet, force open Profile Modal
      if (!userData) {
        setShowProfileModal(true);
      }
    } catch (err) {
      console.error(err);
    }
    setIsLoading(false);
  }, [todayDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ================= SAVE PROFILE ================= */

  const handleProfileSave = async (data: Partial<User>) => {
    await api.updateUser(data);
    setShowProfileModal(false);
    fetchData();
  };

  /* ================= SAVE LOG ================= */

  const handleLogSave = async (data: DailyLog) => {
    await api.saveLog(data);
    setShowLogModal(false);
    fetchData();
  };

  /* ================= AI MEAL SUGGESTION ================= */

  const handleSuggestMeal = async (mealName: string, calories: number) => {
    if (!user) return;
    const ingredients = ingredientInputs[mealName] || "";
    setIsSuggesting(mealName);

    try {
      const data = await api.suggestMeal({
        mealName,
        targetCalories: calories,
        dietPreference: user.dietPreference,
        ingredients
      });

      setSuggestedMeal({
        meal: mealName,
        text: data.suggestion
      });

      setIngredientInputs(prev => ({
        ...prev,
        [mealName]: ""
      }));
    } catch {
      alert("AI suggestion failed");
    }
    setIsSuggesting(null);
  };

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading your health dashboard...</p>
      </div>
    );
  }

  // Fallback for missing user profile (show onboarding)
  if (!user && !showProfileModal) {
     return (
       <div className="loading-screen">
         <button className="btn primary-btn" onClick={() => setShowProfileModal(true)}>
           Initialize My Profile
         </button>
       </div>
     );
  }

  /* ================= CALCULATIONS ================= */

  const goalCals = user?.dailyGoalCalories || 2000;
  const consumed = todayLog?.caloriesConsumed || 0;
  const burned = todayLog?.caloriesBurned || 0;
  const remaining = goalCals - consumed;

  const mealTargets: Record<string, number> = {
    Morning: Math.round(goalCals * 0.3),
    Afternoon: Math.round(goalCals * 0.4),
    Night: Math.round(goalCals * 0.3)
  };

  return (
    <div className="app-container">
      {/* HEADER */}
      <header className="app-header">
        <div className="header-title">
          <div className="logo-icon"><Activity size={24} /></div>
          <div>
            <h1>Health Tracker</h1>
            <p>Welcome, <span className="highlight-text">{username || `User #${userId}`}</span> • Happy tracking! 👋</p>
          </div>
        </div>

        <div className="header-actions">
          <button className="btn glass-btn" onClick={() => setShowProfileModal(true)} title="Profile Settings">
            <Settings size={18} />
          </button>

          <button className="btn primary-btn" onClick={() => setShowLogModal(true)}>
            <Plus size={18} />
            <span>Log</span>
          </button>

          <button className="btn glass-btn logout-btn" onClick={logout} title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* DASHBOARD */}
      <div className="dashboard-grid">
        <div className="card glass main-stat">
          <div className="stat-header">
            <h2>Calories Today</h2>
            <div className="status-badge">{remaining > 0 ? "On Track" : "Goal Met"}</div>
          </div>

          <div className="calorie-display">
            <div className="main-number">
              <h3>{consumed}</h3>
              <span>kcal consumed</span>
            </div>
            
            <div className="progress-bar-container">
               <div 
                 className="progress-bar" 
                 style={{ width: `${Math.min((consumed / goalCals) * 100, 100)}%` }}
               ></div>
            </div>

            <div className="calorie-sub-stats">
              <div className="sub-stat">
                <span className="label">Daily Goal</span>
                <span className="val">{goalCals}</span>
              </div>
              <div className="sub-stat">
                <span className="label">Remaining</span>
                <span className={`val ${remaining < 0 ? 'negative' : ''}`}>{remaining}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="stats-cards">
          <div className="card glass mini-card">
            <div className="icon-box blue"><Activity size={20} /></div>
            <div>
              <h3>{todayLog?.stepsWalked || 0}</h3>
              <p>Steps Walked</p>
            </div>
            <div className="mini-progress">
               <div className="bar" style={{ width: `${Math.min(((todayLog?.stepsWalked || 0) / (user?.stepGoal || 10000)) * 100, 100)}%` }}></div>
            </div>
          </div>

          <div className="card glass mini-card">
            <div className="icon-box purple"><Target size={20} /></div>
            <div>
              <h3>{user?.weight || '--'} <small>kg</small></h3>
              <p>Weight</p>
            </div>
          </div>

          <div className="card glass mini-card">
            <div className="icon-box green"><Flame size={20} /></div>
            <div>
              <h3>{burned}</h3>
              <p>Burned</p>
            </div>
          </div>
        </div>
      </div>

      {/* AI MEAL PLANNER */}
      <div className="meal-section">
        <div className="section-header">
          <Sparkles className="sparkle-icon" size={24} />
          <h2>Smart Meal Planner</h2>
        </div>

        <div className="meal-grid">
          {["Morning", "Afternoon", "Night"].map((meal) => {
            const target = mealTargets[meal];
            return (
              <div key={meal} className="card glass meal-card">
                <div className="meal-header">
                  <h3>{meal}</h3>
                  <span className="target-label">{target} kcal goal</span>
                </div>

                <div className="suggest-input-group">
                  <input
                    placeholder="Ingredients..."
                    value={ingredientInputs[meal] || ""}
                    onChange={(e) =>
                      setIngredientInputs(prev => ({
                        ...prev,
                        [meal]: e.target.value
                      }))
                    }
                  />

                  <button
                    className="suggest-btn"
                    onClick={() => handleSuggestMeal(meal, target)}
                    disabled={isSuggesting === meal}
                  >
                    {isSuggesting === meal ? (
                       <div className="typing-loader"></div>
                    ) : (
                       <Sparkles size={16} />
                    )}
                  </button>
                </div>

                {suggestedMeal?.meal === meal && (
                  <div className="ai-suggestion-box anime-fade-in">
                    <p>{suggestedMeal.text}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* WEEKLY CHART */}
      <div className="card glass chart-card">
        <div className="chart-header">
          <h2>Weekly Progress</h2>
          <div className="chart-legend">
             <span className="dot consumed"></span> Consumed
             <span className="dot burned"></span> Burned
          </div>
        </div>

        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={(str) => format(new Date(str), 'EEE')}
              />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip 
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                contentStyle={{ 
                  background: '#1e293b', 
                  border: '1px solid #334155', 
                  borderRadius: '12px',
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' 
                }}
              />
              <Bar dataKey="caloriesConsumed" fill="url(#colorConsumed)" radius={[4, 4, 0, 0]} barSize={30} />
              <Bar dataKey="caloriesBurned" fill="url(#colorBurned)" radius={[4, 4, 0, 0]} barSize={30} />
              <defs>
                <linearGradient id="colorConsumed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.2}/>
                </linearGradient>
                <linearGradient id="colorBurned" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.2}/>
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <Chatbot />

      {showProfileModal && (
        <ProfileModal
          user={user || { id: 0, weight: 70, targetWeight: 65, height: 175, age: 25, gender: 'Male', bmr: 0, dailyGoalCalories: 0, dietPreference: 'Both', stepGoal: 10000 }}
          onClose={() => user && setShowProfileModal(false)}
          onSave={handleProfileSave}
        />
      )}

      {showLogModal && todayLog && (
        <LogModal
          currentLog={todayLog}
          date={todayDate}
          onClose={() => setShowLogModal(false)}
          onSave={handleLogSave}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AuthWrapper />
    </AuthProvider>
  );
}

function AuthWrapper() {
  const { isAuthenticated, isInitializing, username } = useAuth();
  
  if (isInitializing) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Restoring session...</p>
      </div>
    );
  }

  if (!isAuthenticated) return <Login />;
  if (!username) return <Login forceStep="username" />;
  
  return <Dashboard />;
}

export default App;