import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';

interface AuthContextType {
  userId: number | null;
  username: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (email: string) => Promise<boolean>;
  confirm: (email: string, otp: string) => Promise<{ success: boolean; userId: number; hasProfile: boolean; hasUsername: boolean; username: string | null }>;
  logout: () => void;
  refreshUsername: (newUsername: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userId, setUserId] = useState<number | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const savedId = localStorage.getItem('health_tracker_user_id');
      const savedName = localStorage.getItem('health_tracker_username');
      
      if (savedId) {
        setUserId(parseInt(savedId));
        if (savedName) {
          setUsername(savedName);
        } else {
          try {
            const userData = await api.getUser();
            if (userData?.username) {
              setUsername(userData.username);
              localStorage.setItem('health_tracker_username', userData.username);
            }
          } catch (err) {
            console.error('Failed to restore username session', err);
          }
        }
      }
      setIsInitializing(false);
    };
    initAuth();
  }, []);

  const login = async (email: string) => {
    const res = await api.sendOtp(email);
    return res.success;
  };

  const confirm = async (email: string, otp: string) => {
    const res = await api.verifyOtp(email, otp);
    if (res.success) {
      setUserId(res.userId);
      if (res.username) {
        setUsername(res.username);
        localStorage.setItem('health_tracker_username', res.username);
      }
    }
    return res;
  };

  const logout = () => {
    api.logout();
    setUserId(null);
    setUsername(null);
    localStorage.removeItem('health_tracker_username');
  };

  const refreshUsername = (newUsername: string) => {
    setUsername(newUsername);
    localStorage.setItem('health_tracker_username', newUsername);
  };

  return (
    <AuthContext.Provider value={{ 
      userId, 
      username,
      isAuthenticated: !!userId, 
      isInitializing,
      login, 
      confirm, 
      logout,
      refreshUsername
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
