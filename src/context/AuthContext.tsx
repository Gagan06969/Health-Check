import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';

interface AuthContextType {
  userId: number | null;
  isAuthenticated: boolean;
  login: (email: string) => Promise<boolean>;
  confirm: (email: string, otp: string) => Promise<{ success: boolean; userId: number; hasProfile: boolean }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userId, setUserId] = useState<number | null>(null);

  useEffect(() => {
    const savedId = localStorage.getItem('health_tracker_user_id');
    if (savedId) {
      setUserId(parseInt(savedId));
    }
  }, []);

  const login = async (email: string) => {
    const res = await api.sendOtp(email);
    return res.success;
  };

  const confirm = async (email: string, otp: string) => {
    const res = await api.verifyOtp(email, otp);
    if (res.success) {
      setUserId(res.userId);
    }
    return res;
  };

  const logout = () => {
    api.logout();
    setUserId(null);
  };

  return (
    <AuthContext.Provider value={{ 
      userId, 
      isAuthenticated: !!userId, 
      login, 
      confirm, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
