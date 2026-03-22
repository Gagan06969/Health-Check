export interface User {
  id: number;
  username?: string;
  weight: number;
  targetWeight: number;
  height: number;
  age: number;
  gender: 'Male' | 'Female';
  bmr: number;
  dailyGoalCalories: number;
  dietPreference: 'Both' | 'Veg' | 'Non-Veg';
  stepGoal: number;
}

export interface Food {
  name: string;
  calories: number;
  quantity: string; // Keep for display/back-compat (e.g. "2 bowls")
  amount?: number;   // New: numeric amount
  unit?: string;     // New: unit name
  calories_per_unit?: number; // New: base calorie info
  mealType: string;
}

export interface Exercise {
  name: string;
  reps: string;
  totalCals: number;
}

export interface DailyLog {
  id?: number;
  date: string;
  caloriesConsumed: number;
  stepsWalked: number;
  caloriesBurned: number;
  foods: string | Food[];
  exercises: string | Exercise[];
}

export interface FoodSearchResult {
  id: string | number;
  name: string;
  brand: string;
  calories_per_unit: number;
  unit: string;
  image: string | null;
}

export interface ChatResponse {
  reply: string;
}

export interface MealSuggestionResponse {
  suggestion: string;
}
