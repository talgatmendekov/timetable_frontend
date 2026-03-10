// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

const TOKEN_KEYS = ['scheduleToken', 'token', 'authToken', 'jwt'];
const USER_KEYS  = ['scheduleUser',  'user',  'authUser'];

const clearAuth = () => {
  TOKEN_KEYS.forEach(k => localStorage.removeItem(k));
  USER_KEYS.forEach(k  => localStorage.removeItem(k));
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user,            setUser]            = useState(null);
  const [loading,         setLoading]         = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('scheduleToken');
    const savedUser  = localStorage.getItem('scheduleUser');

    // Only attempt verify if BOTH token AND user are saved
    if (savedToken && savedUser) {
      authAPI.verify()
        .then(() => {
          try {
            setUser(JSON.parse(savedUser));
            setIsAuthenticated(true);
          } catch {
            clearAuth();
          }
        })
        .catch(() => {
          // 401 = token expired or invalid — silently clear and continue as guest
          clearAuth();
        })
        .finally(() => setLoading(false));
    } else {
      // No saved session — clear any partial/stale keys just in case
      clearAuth();
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    try {
      const data = await authAPI.login(username, password);
      if (data.token) {
        localStorage.setItem('scheduleToken', data.token);
        localStorage.setItem('scheduleUser', JSON.stringify(data.user));
        setUser(data.user);
        setIsAuthenticated(true);
        return { success: true };
      }
      return { success: false, error: 'No token received from server.' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const logout = () => {
    clearAuth();
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};