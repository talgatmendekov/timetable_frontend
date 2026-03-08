// src/components/Login.js
import React, { useState, useRef, useEffect } from 'react';
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
  const [showPass, setShowPass] = useState(false);
  const [theme,    setTheme]    = useState(() =>
    localStorage.getItem('loginTheme') || 'dark'
  );

  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('loginTheme', theme);
  }, [theme]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const u = (usernameRef.current?.value || username).trim();
    const p =  passwordRef.current?.value || password;
    if (!u || !p) {
      setError(t('loginFillBoth') || 'Please fill in all fields.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await login(u, p);
      if (!result.success) {
        setError(result.error || t('invalidCredentials') || 'Invalid credentials.');
      }
    } catch (err) {
      setError(err.message || t('invalidCredentials') || 'Login failed.');
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
    <div className={`lp lp--${theme}`}>
      {/* Background layers */}
      <div className="lp__bg">
        <div className="lp__orb lp__orb--1" />
        <div className="lp__orb lp__orb--2" />
        <div className="lp__orb lp__orb--3" />
        <div className="lp__dots" />
      </div>

      <div className="lp__body">

        {/* ── Left: Branding ── */}
        <aside className="lp__aside">
          <div className="lp__aside-inner">
            {/* Emblem */}
            <div className="lp__emblem">
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                <rect width="56" height="56" rx="16" fill="url(#emblemGrad)" fillOpacity="0.15"/>
                <path d="M28 10L44 20V36L28 46L12 36V20L28 10Z" stroke="url(#emblemGrad)" strokeWidth="1.5" fill="none"/>
                <path d="M28 18L38 24V34L28 40L18 34V24L28 18Z" fill="url(#emblemGrad)" fillOpacity="0.18"/>
                <circle cx="28" cy="28" r="5" fill="url(#emblemGrad)"/>
                <defs>
                  <linearGradient id="emblemGrad" x1="12" y1="10" x2="44" y2="46" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#60a5fa"/>
                    <stop offset="1" stopColor="#2dd4bf"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>

            <h1 className="lp__uni-name">
              {t('appTitle') || 'International Ala-Too University'}
            </h1>
            <div className="lp__rule"/>
            <p className="lp__uni-sub">
              {t('appSubtitle') || 'Timetable Management System'}
            </p>

            {/* Decorative stats */}
            <div className="lp__stats">
              <div className="lp__stat">
                <span className="lp__stat-num">12k+</span>
                <span className="lp__stat-lbl">Students</span>
              </div>
              <div className="lp__stat-divider"/>
              <div className="lp__stat">
                <span className="lp__stat-num">400+</span>
                <span className="lp__stat-lbl">Courses</span>
              </div>
              <div className="lp__stat-divider"/>
              <div className="lp__stat">
                <span className="lp__stat-num">6</span>
                <span className="lp__stat-lbl">Faculties</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Right: Form ── */}
        <main className="lp__card">
          {/* Top bar: lang + theme toggle */}
          <div className="lp__topbar">
            <div className="lp__langs">
              {LANGS.map(l => (
                <button key={l.code} type="button"
                  className={`lp__lang${language === l.code ? ' lp__lang--on' : ''}`}
                  onClick={() => setLanguage(l.code)}>
                  {l.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="lp__theme-toggle"
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              title="Toggle theme"
            >
              {theme === 'dark' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
          </div>

          {/* Heading */}
          <div className="lp__heading">
            <h2 className="lp__title">{t('loginSubtitle') || 'Admin Panel'}</h2>
            <p className="lp__desc">{t('loginTitle') || 'University Schedule'}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="lp__form" autoComplete="off">
            {/* Username */}
            <div className="lp__field">
              <label className="lp__label">{t('username') || 'Username'}</label>
              <div className="lp__input-row">
                <svg className="lp__input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <input
                  ref={usernameRef}
                  type="text"
                  className="lp__input"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder={t('username') || 'Username'}
                  disabled={loading}
                  autoComplete="off"
                  name="lp-u"
                />
              </div>
            </div>

            {/* Password */}
            <div className="lp__field">
              <label className="lp__label">{t('password') || 'Password'}</label>
              <div className="lp__input-row">
                <svg className="lp__input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  ref={passwordRef}
                  type={showPass ? 'text' : 'password'}
                  className="lp__input lp__input--pass"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t('password') || 'Password'}
                  disabled={loading}
                  autoComplete="new-password"
                  name="lp-p"
                />
                <button type="button" className="lp__eye" onClick={() => setShowPass(v => !v)} tabIndex={-1}>
                  {showPass ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="lp__error">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <button type="submit" className="lp__submit" disabled={loading}>
              {loading ? (
                <span className="lp__spinner"/>
              ) : (
                <>
                  {t('loginBtn') || 'Sign In'}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          {onViewAsGuest && (
            <button type="button" className="lp__guest" onClick={onViewAsGuest} disabled={loading}>
              {t('viewAsGuest') || 'Guest Mode'}
            </button>
          )}
        </main>
      </div>
    </div>
  );
};

export default Login;