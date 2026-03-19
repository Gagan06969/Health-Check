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
  quantity: string;
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
  calories_per_100g: number;
  unit: string;
  image: string | null;
}

export interface ChatResponse {
  reply: string;
}

export interface MealSuggestionResponse {
  suggestion: string;
}
