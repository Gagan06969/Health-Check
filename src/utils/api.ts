import axios from "axios";
import type { 
  User, 
  DailyLog, 
  FoodSearchResult, 
  ChatResponse, 
  MealSuggestionResponse 
} from "../types";

const API_BASE = "/api";

// Create an axios instance that automatically includes the user ID
const client = axios.create({
  baseURL: API_BASE,
});

client.interceptors.request.use((config) => {
  const userId = localStorage.getItem('health_tracker_user_id');
  if (userId) {
    config.headers['x-user-id'] = userId;
  }
  return config;
});

export const api = {

  // --- AUTH ---
  sendOtp: async (email: string): Promise<{ success: boolean; message: string }> => {
    const res = await client.post(`/auth/send-otp`, { email });
    return res.data;
  },

  verifyOtp: async (email: string, otp: string): Promise<{ success: boolean; userId: number; hasProfile: boolean }> => {
    const res = await client.post(`/auth/verify-otp`, { email, otp });
    if (res.data.success) {
      localStorage.setItem('health_tracker_user_id', res.data.userId.toString());
    }
    return res.data;
  },

  logout: () => {
    localStorage.removeItem('health_tracker_user_id');
  },

  // --- PROFILE ---
  getUser: async (): Promise<User | null> => {
    const res = await client.get(`/user`);
    return res.data;
  },

  updateUser: async (data: Partial<User>): Promise<{ success: boolean; bmr: number; dailyGoalCalories: number }> => {
    const res = await client.put(`/user`, data);
    return res.data;
  },

  // --- LOGS ---
  getLog: async (date: string): Promise<DailyLog> => {
    const res = await client.get(`/logs/${date}`);
    return res.data;
  },

  saveLog: async (data: DailyLog): Promise<{ success: boolean }> => {
    const res = await client.post(`/logs`, data);
    return res.data;
  },

  getWeekly: async (): Promise<DailyLog[]> => {
    const res = await client.get(`/weekly`);
    return res.data;
  },

  // --- FOOD ---
  searchFood: async (query: string): Promise<{ results: FoodSearchResult[] }> => {
    const res = await client.get(`/food/search?query=${encodeURIComponent(query)}`);
    return res.data;
  },

  createCustomFood: async (data: {
    name: string;
    calories_per_serving: number;
    serving_unit: string;
  }): Promise<{ success: boolean }> => {
    const res = await client.post(`/food/custom`, data);
    return res.data;
  },

  // --- AI ---
  chat: async (message: string): Promise<ChatResponse> => {
    const res = await client.post(`/chat`, { message });
    return res.data;
  },

  suggestMeal: async (data: {
    mealName: string;
    targetCalories: number;
    dietPreference: string;
    ingredients?: string;
  }): Promise<MealSuggestionResponse> => {
    const res = await client.post(`/meal-suggest`, data);
    return res.data;
  },

  voiceLog: async (text: string): Promise<{ success: boolean; items: any[] }> => {
    const res = await client.post(`/logs/voice`, { text });
    return res.data;
  }

};