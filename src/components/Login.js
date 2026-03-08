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
  const [focused,  setFocused]  = useState('');

  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
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
        setError(result.error || t('invalidCredentials') || 'Invalid username or password.');
      }
    } catch (err) {
      setError(err.message || t('invalidCredentials') || 'Login failed. Please try again.');
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
    <div className="lp-root">
      {/* Animated background orbs */}
      <div className="lp-orb lp-orb1" />
      <div className="lp-orb lp-orb2" />
      <div className="lp-orb lp-orb3" />

      {/* Grid overlay */}
      <div className="lp-grid" />

      <div className="lp-wrap">
        {/* Left panel — branding */}
        <div className="lp-brand">
          <div className="lp-brand-inner">
            <div className="lp-emblem">
              <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                <rect width="52" height="52" rx="14" fill="white" fillOpacity="0.12"/>
                <path d="M26 10L38 18V34L26 42L14 34V18L26 10Z" stroke="white" strokeWidth="2" fill="none"/>
                <path d="M26 16L34 21V31L26 36L18 31V21L26 16Z" fill="white" fillOpacity="0.2"/>
                <circle cx="26" cy="26" r="4" fill="white"/>
              </svg>
            </div>
            <h1 className="lp-brand-title">{t('appTitle') || 'International Ala-Too University'}</h1>
            <p className="lp-brand-sub">{t('appSubtitle') || 'Timetable Management System'}</p>
            <div className="lp-brand-divider"/>
            <p className="lp-brand-tagline">{t('loginTitle') || 'University Schedule'}</p>
          </div>
        </div>

        {/* Right panel — form */}
        <div className="lp-card">
          {/* Lang switcher */}
          <div className="lp-lang">
            {LANGS.map(l => (
              <button
                key={l.code}
                type="button"
                className={`lp-lang-btn${language === l.code ? ' active' : ''}`}
                onClick={() => setLanguage(l.code)}
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="lp-card-header">
            <h2 className="lp-card-title">{t('loginSubtitle') || 'Admin Panel'}</h2>
            <p className="lp-card-desc">{t('loginSubtitleDesc') || 'Sign in to manage the timetable'}</p>
          </div>

          <form onSubmit={handleSubmit} className="lp-form" autoComplete="off">
            {/* Username */}
            <div className={`lp-field${focused === 'u' ? ' focused' : ''}${username ? ' has-value' : ''}`}>
              <label className="lp-label">{t('username') || 'Username'}</label>
              <div className="lp-input-wrap">
                <span className="lp-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </span>
                <input
                  ref={usernameRef}
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onFocus={() => setFocused('u')}
                  onBlur={() => setFocused('')}
                  placeholder={t('username') || 'Username'}
                  disabled={loading}
                  autoComplete="off"
                  name="lp-user"
                  className="lp-input"
                />
              </div>
            </div>

            {/* Password */}
            <div className={`lp-field${focused === 'p' ? ' focused' : ''}${password ? ' has-value' : ''}`}>
              <label className="lp-label">{t('password') || 'Password'}</label>
              <div className="lp-input-wrap">
                <span className="lp-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  ref={passwordRef}
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocused('p')}
                  onBlur={() => setFocused('')}
                  placeholder={t('password') || 'Password'}
                  disabled={loading}
                  autoComplete="new-password"
                  name="lp-pass"
                  className="lp-input"
                />
              </div>
            </div>

            {error && (
              <div className="lp-error">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <button type="submit" className="lp-btn" disabled={loading}>
              {loading ? (
                <span className="lp-spinner"/>
              ) : (
                <>
                  <span>{t('loginBtn') || 'Sign In'}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          {onViewAsGuest && (
            <button type="button" className="lp-guest" onClick={onViewAsGuest} disabled={loading}>
              {t('viewAsGuest') || 'Guest Mode'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;