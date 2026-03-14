import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

export const api = {
  getUser: async () => {
    const res = await axios.get(`${API_BASE}/user`);
    return res.data;
  },
  updateUser: async (data: any) => {
    const res = await axios.put(`${API_BASE}/user`, data);
    return res.data;
  },
  getLog: async (date: string) => {
    const res = await axios.get(`${API_BASE}/logs/${date}`);
    return res.data;
  },
  saveLog: async (data: any) => {
    const res = await axios.post(`${API_BASE}/logs`, data);
    return res.data;
  },
  getWeekly: async () => {
    const res = await axios.get(`${API_BASE}/weekly`);
    return res.data;
  },
  searchFood: async (query: string) => {
    const res = await axios.get(`${API_BASE}/food/search?query=${encodeURIComponent(query)}`);
    return res.data;
  },
  createCustomFood: async (data: any) => {
    const res = await axios.post(`${API_BASE}/food/custom`, data);
    return res.data;
  },
  chat: async (message: string) => {
    const res = await axios.post(`${API_BASE}/chat`, { message });
    return res.data;
  }
};
