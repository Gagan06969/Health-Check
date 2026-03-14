import React, { useState, useEffect } from 'react';
import { X, Flame, Search, Check, Plus, Dumbbell, Utensils } from 'lucide-react';
import { api } from '../utils/api';

interface LogModalProps {
  currentLog: any;
  date: string;
  onClose: () => void;
  onSave: (data: any) => void;
}

const HOME_EXERCISES = [
  { id: 'ex1', name: 'Pushups', calPerRep: 0.3, unit: 'reps' },
  { id: 'ex2', name: 'Squats', calPerRep: 0.5, unit: 'reps' },
  { id: 'ex3', name: 'Plank', calPerRep: 3, unit: 'mins' },
  { id: 'ex4', name: 'Jumping Jacks', calPerRep: 0.2, unit: 'reps' },
  { id: 'ex5', name: 'Burpees', calPerRep: 1.5, unit: 'reps' }
];

export const LogModal: React.FC<LogModalProps> = ({ currentLog, date, onClose, onSave }) => {
  // Try to parse existing data correctly (migrated from text to JSON arrays previously)
  const safeParseJSON = (data: any, fallback: any) => {
    if (!data) return fallback;
    if (typeof data === 'string') {
      try { return JSON.parse(data); } catch (e) { return fallback; }
    }
    return data;
  };

  const initialFoods = safeParseJSON(currentLog?.foods, []);
  const initialExercises = safeParseJSON(currentLog?.exercises, []);

  const [caloriesConsumed, setCaloriesConsumed] = useState(currentLog?.caloriesConsumed || 0);
  const [stepsWalked, setStepsWalked] = useState(currentLog?.stepsWalked || 0);
  
  const [foods, setFoods] = useState<any[]>(initialFoods);
  const [exercisesData, setExercisesData] = useState<any[]>(initialExercises);

  // Food Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Quick Add State (Fallback)
  const [quickFoodItem, setQuickFoodItem] = useState('');
  const [quickFoodCals, setQuickFoodCals] = useState('');

  // Handle Free Food Search
  const handleSearch = async () => {
    if (!searchQuery) return;
    setIsSearching(true);
    try {
      const data = await api.searchFood(searchQuery);
      setSearchResults(data.results || []);
    } catch (err) {
      console.error(err);
    }
    setIsSearching(false);
  };

  // Select Food from API results
  const addFoodFromApi = (item: any) => {
    // Prompt for quantity intuitively using browser generic prompt for MVP simplicity
    const quantityStr = prompt(`How many 100g servings of ${item.name} did you have?`, '1');
    if (quantityStr && !isNaN(Number(quantityStr))) {
      const quantity = Number(quantityStr);
      const totalCals = Math.round(item.calories_per_100g * quantity);
      
      const newFood = { name: item.name, calories: totalCals, quantity: `${quantity} servings` };
      setFoods([...foods, newFood]);
      setCaloriesConsumed((prev: number) => prev + totalCals);
      setSearchResults([]);
      setSearchQuery('');
    }
  };

  const handleQuickAddFood = () => {
    if (quickFoodCals && !isNaN(Number(quickFoodCals))) {
      const cals = Number(quickFoodCals);
      setCaloriesConsumed((prev: number) => prev + cals);
      setFoods([...foods, { name: quickFoodItem || 'Custom Food', calories: cals }]);
      setQuickFoodItem('');
      setQuickFoodCals('');
    }
  };

  // Toggle Exericse
  const toggleExercise = (ex: any) => {
    const exists = exercisesData.find(e => e.id === ex.id);
    if (exists) {
      setExercisesData(exercisesData.filter(e => e.id !== ex.id));
    } else {
      const repsStr = prompt(`How many ${ex.unit} of ${ex.name}?`, '10');
      if (repsStr && !isNaN(Number(repsStr))) {
        const reps = Number(repsStr);
        setExercisesData([...exercisesData, { ...ex, reps, totalCals: Math.round(reps * ex.calPerRep) }]);
      }
    }
  };

  const handleSubmit = () => {
    // Calculate total burned including steps AND custom exercises
    const stepsCals = Math.round(stepsWalked * 0.04);
    const exerciseCals = exercisesData.reduce((sum, ex) => sum + (ex.totalCals || 0), 0);
    const totalBurned = stepsCals + exerciseCals;

    onSave({
      date,
      caloriesConsumed: Number(caloriesConsumed),
      stepsWalked: Number(stepsWalked),
      caloriesBurned: totalBurned,
      foods,
      exercises: exercisesData
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2>Log Activity & Food</h2>
          <button className="modal-close" onClick={onClose}><X size={24} /></button>
        </div>
        
        {/* FOOD SECTION */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Utensils size={20} className="text-purple" /> Food Library Search
          </h3>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input 
              type="text" 
              placeholder="Search for any food (e.g., Apple, Roti, Chicken)..." 
              className="glass-input" 
              style={{ flex: 1 }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button className="btn-primary" onClick={handleSearch} disabled={isSearching}>
              {isSearching ? '...' : <Search size={18} />}
            </button>
          </div>

          {/* Search Results Dropdown-like UI inline */}
          {searchResults.length > 0 && (
            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '12px', marginBottom: '16px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Select an item to add quantity:</div>
              {searchResults.map((item, idx) => (
                <div key={idx} onClick={() => addFoodFromApi(item)} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', cursor: 'pointer', borderBottom: '1px solid var(--glass-border)' }}>
                  <div>
                    <strong>{item.name}</strong> {item.brand ? <span style={{fontSize: '0.8rem', opacity: 0.7}}>({item.brand})</span> : null}
                  </div>
                  <div className="text-emerald">{Math.round(item.calories_per_100g)} kcal / 100g</div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Fallback */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <input type="text" placeholder="Custom food name" className="glass-input" style={{ flex: 1 }} value={quickFoodItem} onChange={e => setQuickFoodItem(e.target.value)} />
            <input type="number" placeholder="Cals" className="glass-input" style={{ width: '80px' }} value={quickFoodCals} onChange={e => setQuickFoodCals(e.target.value)} />
            <button className="btn-primary" style={{ padding: '0 12px' }} onClick={handleQuickAddFood}><Plus size={18} /></button>
          </div>

          {/* Eaten List */}
          {foods.length > 0 && (
            <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {foods.map((f, i) => (
                <span key={i} style={{ background: 'var(--secondary-glow)', padding: '4px 12px', borderRadius: '16px', fontSize: '0.9rem' }}>
                  {f.name} ({f.calories} kcal)
                </span>
              ))}
            </div>
          )}
        </div>

        {/* EXERCISE SECTION */}
        <div style={{ marginBottom: '32px', borderTop: '1px solid var(--glass-border)', paddingTop: '24px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Dumbbell size={20} className="text-emerald" /> Home Exercises
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {HOME_EXERCISES.map((ex) => {
              const loggedEx = exercisesData.find(e => e.id === ex.id);
              return (
                <div 
                  key={ex.id} 
                  onClick={() => toggleExercise(ex)}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', 
                    background: loggedEx ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0,0,0,0.2)', 
                    border: loggedEx ? '1px solid var(--accent-color)' : '1px solid var(--glass-border)',
                    borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  <div style={{ width: '20px', height: '20px', borderRadius: '4px', border: '1px solid var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: loggedEx ? 'var(--accent-color)' : 'transparent' }}>
                    {loggedEx && <Check size={14} color="white" />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{ex.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {loggedEx ? `${loggedEx.reps} ${ex.unit} (~${loggedEx.totalCals} cals)` : `~${ex.calPerRep} cal/${ex.unit.slice(0,-1)}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* TOTALS OVERVIEW */}
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          <div className="input-group">
            <label>Total Combined Calories Consumed Today</label>
            <div style={{ position: 'relative' }}>
              <input type="number" value={caloriesConsumed} onChange={e => setCaloriesConsumed(Number(e.target.value))} className="glass-input" style={{ width: '100%', fontSize: '1.5rem', fontWeight: 'bold' }} />
              <Flame size={24} style={{ position: 'absolute', right: '16px', top: '14px', color: 'var(--secondary-glow)' }} />
            </div>
          </div>
          <div className="input-group" style={{ marginTop: '16px' }}>
            <label>Total Steps Walked Today</label>
            <div style={{ position: 'relative' }}>
              <input type="number" value={stepsWalked} onChange={e => setStepsWalked(Number(e.target.value))} className="glass-input" style={{ width: '100%', fontSize: '1.5rem', fontWeight: 'bold' }} />
            </div>
          </div>
        </div>
        
        <button className="btn-primary" onClick={handleSubmit} style={{ width: '100%', marginTop: '32px', justifyContent: 'center' }}>
          Save Log
        </button>
      </div>
    </div>
  );
};
