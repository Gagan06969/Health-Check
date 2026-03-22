import { useState, useEffect, useRef } from "react";
import { X, Trash2, Plus, Mic } from "lucide-react";
import { api } from "../utils/api";
import type { DailyLog, Food, Exercise, FoodSearchResult } from "../types";
import "./LogModal.css";

interface LogModalProps {
  currentLog: DailyLog;
  date: string;
  onClose: () => void;
  onSave: (data: DailyLog) => void;
}

const HOME_EXERCISES = [
  { id: "ex1", name: "Pushups", calPerRep: 0.3, unit: "reps" },
  { id: "ex2", name: "Squats", calPerRep: 0.5, unit: "reps" },
  { id: "ex3", name: "Plank", calPerRep: 3, unit: "mins" },
  { id: "ex4", name: "Jumping Jacks", calPerRep: 0.2, unit: "reps" },
  { id: "ex5", name: "Burpees", calPerRep: 1.5, unit: "reps" }
];

export const LogModal: React.FC<LogModalProps> = ({
  currentLog,
  date,
  onClose,
  onSave
}) => {

  const parseJSON = (data: any) => {
    try {
      if (!data) return [];
      if (typeof data === "string") return JSON.parse(data);
      return data;
    } catch {
      return [];
    }
  };

  const [foods, setFoods] = useState<Food[]>(parseJSON(currentLog?.foods));
  const [exercises, setExercises] = useState<Exercise[]>(parseJSON(currentLog?.exercises));

  const [caloriesConsumed, setCaloriesConsumed] = useState(currentLog?.caloriesConsumed || 0);
  const [stepsWalked, setStepsWalked] = useState(currentLog?.stepsWalked || 0);

  const [activeMeal, setActiveMeal] = useState("Morning");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);

  const [customCalories, setCustomCalories] = useState(0);
  const [servingQuantity, setServingQuantity] = useState(1);
  const [unit, setUnit] = useState("bowl");
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const recognitionRef = useRef<any>(null);

  /* -------- VOICE VISUALIZER -------- */

  useEffect(() => {
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let animationFrame: number;
    let stream: MediaStream | null = null;

    const updateLevel = () => {
      if (analyser) {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(avg);
        animationFrame = requestAnimationFrame(updateLevel);
      }
    };

    if (isListening) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(s => {
          stream = s;
          audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          analyser = audioCtx.createAnalyser();
          source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);
          analyser.fftSize = 64;
          updateLevel();
        })
        .catch(err => console.error("Mic access denied:", err));
    } else {
      setAudioLevel(0);
    }

    return () => {
      cancelAnimationFrame(animationFrame);
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (audioCtx) audioCtx.close();
    };
  }, [isListening]);

  /* -------- VOICE LOG -------- */

  const toggleListening = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (err: any) => {
      console.error("Speech Recognition Error:", err);
      setIsListening(false);
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      try {
        setIsListening(false);
        const data = await api.voiceLog(transcript);
        if (data.success && data.items) {
          const newItems: Food[] = data.items.map(item => ({
            name: item.name,
            calories: typeof item.calories === 'number' ? item.calories : 0,
            quantity: item.quantity || "1 serving",
            mealType: activeMeal
          }));
          
          setFoods(prev => [...prev, ...newItems]);
          const totalCals = newItems.reduce((sum, item) => sum + item.calories, 0);
          setCaloriesConsumed(prev => prev + totalCals);
        }
      } catch (err) {
        console.error("Voice Log AI Error:", err);
        alert("Failed to process voice log. Please try again.");
      }
    };

    recognition.start();
  };

  /* -------- FOOD SEARCH -------- */

  useEffect(() => {

    const fetchFood = async () => {

      if (searchQuery.length > 2) {

        try {

          const data = await api.searchFood(searchQuery);
          setSearchResults(data.results || []);

        } catch {
          setSearchResults([]);
        }

      } else {
        setSearchResults([]);
      }

    };

    const timer = setTimeout(fetchFood, 200);

    return () => clearTimeout(timer);

  }, [searchQuery]);

  const selectFood = (food: FoodSearchResult) => {
    setSearchQuery(food.name);
    setCustomCalories(food.calories_per_unit);
    setUnit(food.unit);
    setServingQuantity(1);
    setSearchResults([]);
  };

  /* -------- ADD CUSTOM/SELECTED FOOD -------- */

  const addFood = async () => {
    if (!searchQuery || !customCalories) return;

    const totalCalories = Math.round(customCalories * servingQuantity);

    try {
      // Save as custom food for future searches
      await api.createCustomFood({
        name: searchQuery,
        calories_per_serving: customCalories,
        serving_unit: unit
      });

      const newFood: Food = {
        name: searchQuery,
        calories: totalCalories,
        quantity: `${servingQuantity} ${unit}${servingQuantity > 1 ? 's' : ''}`,
        amount: servingQuantity,
        unit: unit,
        calories_per_unit: customCalories,
        mealType: activeMeal
      };

      setFoods(prev => [...prev, newFood]);
      setCaloriesConsumed(prev => prev + totalCalories);

      // Reset
      setSearchQuery("");
      setCustomCalories(0);
      setServingQuantity(1);

    } catch (err) {
      console.error(err);
      alert("Failed to add food");
    }
  };

  /* -------- REMOVE FOOD -------- */

  const removeFood = (index: number) => {

    const removed = foods[index];

    setCaloriesConsumed(prev => prev - removed.calories);

    setFoods(prev => prev.filter((_, i) => i !== index));

  };

  /* -------- ADD EXERCISE -------- */

  const addExercise = (exercise: typeof HOME_EXERCISES[0]) => {

    const reps = prompt(`How many ${exercise.unit}?`, "10");

    if (!reps) return;

    const totalCals = Number(reps) * exercise.calPerRep;

    setExercises(prev => [
      ...prev,
      { name: exercise.name, reps, totalCals }
    ]);

  };

  /* -------- REMOVE EXERCISE -------- */

  const removeExercise = (index: number) => {

    setExercises(prev => prev.filter((_, i) => i !== index));

  };

  /* -------- SAVE -------- */

  const handleSubmit = () => {

    const exerciseCals = exercises.reduce(
      (sum, ex) => sum + ex.totalCals,
      0
    );

    const stepsCals = Math.round(stepsWalked * 0.04);

    onSave({
      date,
      caloriesConsumed,
      stepsWalked,
      caloriesBurned: exerciseCals + stepsCals,
      foods,
      exercises
    });

  };

  return (

    <div className="modal-overlay">

      <div className="modal-content glass">

        <div className="modal-header">

          <h2>Daily Activity</h2>

          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>

        </div>

        {/* MEAL SELECTOR */}

        <div className="meal-tabs">

          {["Morning", "Afternoon", "Night"].map(meal => (
            <button
              key={meal}
              className={activeMeal === meal ? "active" : ""}
              onClick={() => setActiveMeal(meal)}
            >
              {meal}
            </button>
          ))}

        </div>

        {/* FOOD ENTRY */}

        <div className="food-entry">

          <div className="search-wrap">
            <input
              className="food-search"
              placeholder={`Search food for ${activeMeal}`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button 
              className={`mic-btn ${isListening ? 'listening' : ''}`}
              onClick={toggleListening}
              title={isListening ? "Stop recording" : "Add food by voice"}
            >
              {isListening ? (
                <div className="voice-waves">
                  {[...Array(5)].map((_, i) => (
                    <div 
                      key={i} 
                      className="wave-bar" 
                      style={{ height: `${Math.max(4, (audioLevel / 50) * (15 + Math.random() * 20))}px` }}
                    />
                  ))}
                </div>
              ) : (
                <Mic size={18} />
              )}
            </button>

            {/* FLOATING SEARCH RESULTS DROPDOWN */}
            {searchResults.length > 0 && (
              <div className="search-results-dropdown glass">
                {searchResults.map((food, i) => (
                  <div
                    key={i}
                    className="food-option"
                    onClick={() => selectFood(food)}
                  >
                    <div className="food-option-info">
                      <span className="food-name">{food.name}</span>
                      <span className="food-brand">{food.brand}</span>
                    </div>
                    <span className="food-kcal-label">{food.calories_per_unit} kcal / {food.unit}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="food-row">
            <input
              type="number"
              className="food-qty"
              placeholder="Qty"
              value={servingQuantity}
              onChange={(e) => setServingQuantity(Number(e.target.value))}
              min="0.1"
              step="0.1"
            />

            <input
              type="number"
              className="food-kcal"
              placeholder="Calories"
              value={customCalories}
              onChange={(e) => setCustomCalories(Number(e.target.value))}
            />

            <select
              className="food-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            >
              <option value="bowl">bowl</option>
              <option value="piece">piece</option>
              <option value="cup">cup</option>
              <option value="plate">plate</option>
              <option value="gram">gram</option>
              <option value="100g">100g</option>
            </select>

            <button className="food-add-btn" onClick={addFood}>
              Add
            </button>
          </div>

        </div>

         {/* SEARCH RESULTS DROPDOWN WAS MOVED TO SEARCH-WRAP */}

        {/* FOOD LIST */}

        {foods.length > 0 && (

          <div className="food-list">

            <h3>Foods Logged</h3>

            <div className="logged-items">
              {foods.map((food, i) => (
                <div key={i} className="food-item">

                  <div className="item-info">
                    <span className="item-name">{food.name}</span>
                    <span className="item-meta">{food.mealType} • {food.quantity}</span>
                  </div>

                  <div className="item-actions">
                    <span className="item-calories">{food.calories} kcal</span>
                    <button className="delete-btn" onClick={() => removeFood(i)}>
                      <Trash2 size={14} />
                    </button>
                  </div>

                </div>
              ))}
            </div>

          </div>

        )}

        {/* EXERCISES */}

        <div className="exercise-section">
          <h3>Quick Exercises</h3>

          <div className="exercise-grid">

            {HOME_EXERCISES.map(ex => (
              <div
                key={ex.id}
                className="exercise-card"
                onClick={() => addExercise(ex)}
              >
                <div className="ex-icon"><Plus size={14} /></div>
                <span>{ex.name}</span>
              </div>
            ))}

          </div>
          
          {exercises.length > 0 && (
            <div className="logged-exercises">
               {exercises.map((ex, i) => (
                 <div key={i} className="exercise-log-item">
                    <span>{ex.name} ({ex.reps})</span>
                    <span>{ex.totalCals.toFixed(0)} kcal <button onClick={() => removeExercise(i)}><X size={12}/></button></span>
                 </div>
               ))}
            </div>
          )}
        </div>

        {/* STEPS */}

        <div className="steps-box">

          <label>Steps Walked Today</label>

          <input
            type="number"
            value={stepsWalked}
            onChange={e => setStepsWalked(Number(e.target.value))}
          />

        </div>

        {/* SAVE */}

        <div className="modal-footer">

          <button className="save-log-btn" onClick={handleSubmit}>
            Save Daily Log
          </button>

        </div>

      </div>

    </div>

  );

};