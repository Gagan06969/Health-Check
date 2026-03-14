import React, { useState, useEffect } from 'react';
import { X, Flame, Check, Dumbbell, Utensils } from 'lucide-react';
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

  // Meal Segment State
  const [activeMeal, setActiveMeal] = useState<'Morning' | 'Afternoon' | 'Night'>('Morning');

  // Food Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Custom Food state
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCals, setCustomCals] = useState('');
  const [customUnit, setCustomUnit] = useState('bowl');

  // Handle Free Food Search (with Debounce)
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length > 2) {
        setIsSearching(true);
        try {
          const data = await api.searchFood(searchQuery);
          setSearchResults(data.results || []);
        } catch (err) {
          console.error(err);
        }
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Select Food from API results
  const addFoodFromApi = (item: any) => {
    const defaultUnit = item.unit || '100g';
    const quantityStr = prompt(`How many ${defaultUnit}(s) of ${item.name} did you have for ${activeMeal}?`, '1');
    if (quantityStr && !isNaN(Number(quantityStr))) {
      const quantity = Number(quantityStr);
      const totalCals = Math.round(item.calories_per_100g * quantity);
      
      const newFood = { 
        name: item.name, 
        calories: totalCals, 
        quantity: `${quantity} ${defaultUnit}`,
        mealType: activeMeal
      };
      setFoods([...foods, newFood]);
      setCaloriesConsumed((prev: number) => prev + totalCals);
      setSearchResults([]);
      setSearchQuery('');
    }
  };

  const handleCreateCustomFood = async () => {
    if (!customName || !customCals || !customUnit || isNaN(Number(customCals))) return;
    
    try {
      // Save to database so it exists forever
      const cals = Number(customCals);
      await api.createCustomFood({
        name: customName,
        calories_per_serving: cals,
        serving_unit: customUnit
      });
      
      // Auto-log it for the user right now
      const quantityStr = prompt(`Awesome! How many ${customUnit}(s) of ${customName} did you have for ${activeMeal}?`, '1');
      if (quantityStr && !isNaN(Number(quantityStr))) {
        const quantity = Number(quantityStr);
        const totalCals = Math.round(cals * quantity);
        setFoods([...foods, { name: customName, calories: totalCals, quantity: `${quantity} ${customUnit}`, mealType: activeMeal }]);
        setCaloriesConsumed((prev: number) => prev + totalCals);
      }
      
      setShowCustomForm(false);
      setCustomName('');
      setCustomCals('');
      setSearchQuery('');
    } catch (err) {
      alert('Error creating custom food. Name might already exist.');
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

  // Group foods for rendering
  const foodsByMeal = {
    Morning: foods.filter(f => f.mealType === 'Morning' || !f.mealType), // fallback for old logs
    Afternoon: foods.filter(f => f.mealType === 'Afternoon'),
    Night: foods.filter(f => f.mealType === 'Night'),
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>Log Activity & Meals</h2>
          <button className="modal-close" onClick={onClose}><X size={24} /></button>
        </div>
        
        {/* MEAL TABS */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '12px' }}>
          {['Morning', 'Afternoon', 'Night'].map((meal) => (
            <button 
              key={meal}
              onClick={() => setActiveMeal(meal as any)}
              style={{ 
                flex: 1, padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: activeMeal === meal ? 'var(--accent-color)' : 'transparent',
                color: activeMeal === meal ? 'white' : 'var(--text-muted)',
                fontWeight: activeMeal === meal ? 'bold' : 'normal',
                transition: 'all 0.2s'
              }}
            >
              {meal}
            </button>
          ))}
        </div>

        {/* FOOD SECTION FOR ACTIVE MEAL */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Utensils size={20} className="text-purple" /> {activeMeal} Food
          </h3>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input 
              type="text" 
              placeholder={`Search to log ${activeMeal} food...`} 
              className="glass-input" 
              style={{ flex: 1 }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {isSearching && <span style={{ padding: '8px', color: 'var(--text-muted)' }}>...</span>}
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '12px', marginBottom: '16px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Select an item to add quantity:</div>
              {searchResults.map((item, idx) => (
                <div key={idx} onClick={() => addFoodFromApi(item)} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', cursor: 'pointer', borderBottom: '1px solid var(--glass-border)' }}>
                  <div>
                    <strong>{item.name}</strong> {item.brand ? <span style={{fontSize: '0.8rem', opacity: 0.7}}>({item.brand})</span> : null}
                  </div>
                  <div className="text-emerald">{Math.round(item.calories_per_100g)} kcal / {item.unit || '100g'}</div>
                </div>
              ))}
              <div style={{ textAlign: 'center', marginTop: '8px' }}>
                 <button onClick={() => { setSearchResults([]); setShowCustomForm(true); }} style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '0.85rem' }}>
                   Not what you're looking for? Add Custom Food
                 </button>
              </div>
            </div>
          )}

          {/* Fallback IF NO RESULTS but searching */}
          {searchQuery.length > 2 && searchResults.length === 0 && !isSearching && !showCustomForm && (
            <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', textAlign: 'center', marginBottom: '16px' }}>
               <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>Could not find "{searchQuery}"</p>
               <button className="btn-primary" onClick={() => setShowCustomForm(true)}>+ Create Custom Indian Dish</button>
            </div>
          )}

          {/* CUSTOM FOOD FORM */}
          {showCustomForm && (
            <div style={{ background: 'rgba(167, 139, 250, 0.1)', border: '1px solid rgba(167, 139, 250, 0.3)', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
               <h4 style={{ marginBottom: '12px', color: '#a78bfa' }}>Add Custom Food to Database</h4>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', marginBottom: '12px' }}>
                 <input type="text" placeholder="Dish Name (e.g. Maa Ki Dal)" className="glass-input" value={customName} onChange={e => setCustomName(e.target.value)} />
                 <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="number" placeholder="Calories" className="glass-input" style={{ flex: 1 }} value={customCals} onChange={e => setCustomCals(e.target.value)} />
                    <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>per</span>
                    <select className="glass-input" value={customUnit} onChange={e => setCustomUnit(e.target.value)} style={{ width: '100px' }}>
                      <option value="bowl">Bowl</option>
                      <option value="piece">Piece</option>
                      <option value="plate">Plate</option>
                      <option value="100g">100g</option>
                      <option value="cup">Cup</option>
                    </select>
                 </div>
               </div>
               <div style={{ display: 'flex', gap: '8px' }}>
                 <button className="btn-primary" style={{ flex: 1 }} onClick={handleCreateCustomFood}>Save & Add</button>
                 <button onClick={() => setShowCustomForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 12px' }}>Cancel</button>
               </div>
            </div>
          )}

          {/* Eaten List (Categorized) */}
          {['Morning', 'Afternoon', 'Night'].map(meal => {
            const mealFoods = foodsByMeal[meal as keyof typeof foodsByMeal];
            if (mealFoods.length === 0) return null;
            return (
              <div key={meal} style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '4px' }}>
                  {meal} Items:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {mealFoods.map((f, i) => (
                    <span key={i} style={{ background: 'var(--secondary-glow)', padding: '4px 12px', borderRadius: '16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {f.name} <span style={{ opacity: 0.7, fontSize: '0.8rem' }}>({f.quantity} / {f.calories} kcal)</span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
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
