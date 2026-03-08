// src/components/Login.js
import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import './Login.css';

const Login = ({ onViewAsGuest }) => {
  const { login } = useAuth();
  const { t, language, setLanguage } = useLanguage();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  // Refs so handleSubmit can read DOM values even if browser autofill
  // bypassed React's onChange (Safari/Chrome autofill skips onChange)
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  // ⚠️  NO useEffect — nothing fires on mount.
  //     POST /api/auth/login is only called when the user clicks Sign In.

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Read from DOM refs in case autofill bypassed React state
    const u = (usernameRef.current?.value || username).trim();
    const p =  passwordRef.current?.value || password;
    if (!u || !p) {
      setError(t('loginFillBoth') || 'Please enter your username and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await login(u, p);
      if (!result.success) {
        setError(result.error || t('loginInvalid') || 'Invalid username or password.');
      }
      // On success AuthContext sets isAuthenticated=true → App re-renders to main view
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

        {/* autoComplete="off" on both form and inputs prevents browser autofill
            from auto-submitting the form on page load (Safari/Chrome behaviour) */}
        <form onSubmit={handleSubmit} className="login-form" autoComplete="off">
          <div className="login-field">
            <label htmlFor="login-username">
              {t('loginUsername') || 'Username'}
            </label>
            <input
              ref={usernameRef}
              id="login-username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder={t('loginUsernamePlaceholder') || 'Enter username'}
              disabled={loading}
              autoComplete="off"
              name="login-username-field"
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password">
              {t('loginPassword') || 'Password'}
            </label>
            <input
              ref={passwordRef}
              id="login-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t('loginPasswordPlaceholder') || 'Enter password'}
              disabled={loading}
              autoComplete="new-password"
              name="login-password-field"
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
              : (t('login')        || 'Sign In')
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