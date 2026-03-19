import { useState, useEffect } from "react";
import { X, Trash2, Plus } from "lucide-react";
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
  const [unit, setUnit] = useState("bowl");

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

    const timer = setTimeout(fetchFood, 400);

    return () => clearTimeout(timer);

  }, [searchQuery]);

  /* -------- ADD FOOD FROM API -------- */

  const addFood = (food: FoodSearchResult) => {

    const calories = Number(food.calories_per_100g);

    const newFood: Food = {
      name: food.name,
      calories,
      quantity: `1 ${food.unit || "100g"}`,
      mealType: activeMeal
    };

    setFoods(prev => [...prev, newFood]);

    setCaloriesConsumed(prev => prev + calories);

    setSearchQuery("");
    setSearchResults([]);

  };

  /* -------- ADD CUSTOM FOOD -------- */

  const addCustomFood = async () => {

    if (!searchQuery || !customCalories) return;

    try {

      await api.createCustomFood({
        name: searchQuery,
        calories_per_serving: customCalories,
        serving_unit: unit
      });

      const newFood: Food = {
        name: searchQuery,
        calories: customCalories,
        quantity: `1 ${unit}`,
        mealType: activeMeal
      };

      setFoods(prev => [...prev, newFood]);

      setCaloriesConsumed(prev => prev + customCalories);

      setSearchQuery("");
      setCustomCalories(0);

    } catch (err) {

      console.error(err);
      alert("Failed to save custom food");

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

          <input
            className="food-search"
            placeholder={`Search food for ${activeMeal}`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="food-row">

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
              <option value="100g">100 g</option>
            </select>

            <button className="food-add-btn" onClick={addCustomFood}>
              Add Food
            </button>

          </div>

        </div>

        {/* SEARCH RESULTS */}

        <div className="search-results-list">
          {searchResults.map((food, i) => (
            <div
              key={i}
              className="food-option"
              onClick={() => addFood(food)}
            >
              <span className="food-name">{food.name}</span>
              <span className="food-kcal-label">{food.calories_per_100g} kcal</span>
            </div>
          ))}
        </div>

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