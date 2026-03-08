// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

// All localStorage keys that may hold a token — clear ALL of them on logout/failure
// so stale keys from older versions don't cause phantom verify/login calls.
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

  // On mount: if a saved token exists, verify it is still valid with the backend.
  // ⚠️  This is the ONLY place verify() is called — never in Login.js or anywhere else.
  useEffect(() => {
    const savedToken = localStorage.getItem('scheduleToken');
    const savedUser  = localStorage.getItem('scheduleUser');

    if (savedToken && savedUser) {
      authAPI.verify()
        .then(() => {
          // Token is valid — restore session
          try {
            setUser(JSON.parse(savedUser));
            setIsAuthenticated(true);
          } catch {
            // Corrupt user JSON — treat as logged out
            clearAuth();
          }
        })
        .catch(() => {
          // Token expired, invalid, or server returned 401/403 — clear everything.
          // Clearing ALL keys prevents stale 'token' / 'authToken' keys from
          // causing repeated verify or auto-login calls on the next page load.
          clearAuth();
        })
        .finally(() => setLoading(false));
    } else {
      // No saved session — go straight to login screen
      setLoading(false);
    }
  }, []);

  // Called by Login.js submit handler only — never called automatically.
  const login = async (username, password) => {
    try {
      const data = await authAPI.login(username, password);
      // Backend returns { success: true, token, user: { username, role } }
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