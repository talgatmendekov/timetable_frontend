// src/components/Login.js
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const Login = ({ onViewAsGuest }) => {
  const { login } = useAuth();
  const { t, language, setLanguage } = useLanguage();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  // ⚠️  NO useEffect here — nothing fires on mount.
  //     Login only POSTs to /api/auth/login when the user clicks Submit.

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError(t('loginFillBoth') || 'Please enter your username and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await login(username.trim(), password);
      if (!result.success) {
        setError(result.error || t('loginInvalid') || 'Invalid username or password.');
      }
      // On success AuthContext sets isAuthenticated = true → App re-renders
    } catch (err) {
      setError(err.message || t('loginError') || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const LANGS = [
    { code: 'en', label: 'EN' },
    { code: 'ru', label: 'RU' },
    { code: 'ky', label: 'KY' },
  ];

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Language switcher */}
        <div className="login-lang-row">
          {LANGS.map(l => (
            <button
              key={l.code}
              className={`lang-btn${language === l.code ? ' active' : ''}`}
              onClick={() => setLanguage(l.code)}
              type="button"
            >
              {l.label}
            </button>
          ))}
        </div>

        <h1 className="login-title">
          {t('appTitle') || 'International Ala-Too University'}
        </h1>
        <p className="login-subtitle">
          {t('appSubtitle') || 'Timetable Management System'}
        </p>

        <form onSubmit={handleSubmit} className="login-form" autoComplete="off">
          <div className="login-field">
            <label htmlFor="login-username">
              {t('loginUsername') || 'Username'}
            </label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder={t('loginUsernamePlaceholder') || 'Enter username'}
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password">
              {t('loginPassword') || 'Password'}
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t('loginPasswordPlaceholder') || 'Enter password'}
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="login-btn"
            disabled={loading}
          >
            {loading
              ? (t('loginLoading') || 'Signing in…')
              : (t('login')       || 'Sign In')
            }
          </button>
        </form>

        {onViewAsGuest && (
          <button
            type="button"
            className="login-guest-btn"
            onClick={onViewAsGuest}
            disabled={loading}
          >
            {t('viewAsGuest') || 'View as Guest (read-only)'}
          </button>
        )}
      </div>
    </div>
  );
};

export default Login;