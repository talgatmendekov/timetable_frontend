// src/components/Login.js
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import './Login.css';

const Login = ({ onViewAsGuest, isModal = false, onSuccess }) => {
  const { login } = useAuth();
  const { t, lang, changeLang } = useLanguage(); // ← correct names from LanguageContext

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [theme,    setTheme]    = useState(
    () => localStorage.getItem('loginTheme') || 'dark'
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
      setError(t('invalidCredentials') || 'Please fill in all fields.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await login(u, p);
      if (!result.success) {
        setError(result.error || t('invalidCredentials') || 'Invalid credentials.');
      } else if (onSuccess) {
        onSuccess();
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

  // In modal mode — show only the compact form card, no split-screen
  if (isModal) {
    return (
      <div className={`lp-modal lp--${theme}`}>
        <div className="lp__topbar">
          <div className="lp__langs">
            {LANGS.map(l => (
              <button key={l.code} type="button"
                className={`lp__lang${lang === l.code ? ' lp__lang--on' : ''}`}
                onClick={() => changeLang(l.code)}>
                {l.label}
              </button>
            ))}
          </div>
          <button type="button" className="lp__theme-toggle"
            onClick={() => setTheme(v => v === 'dark' ? 'light' : 'dark')}>
            <span className="lp__theme-emoji">{theme === 'dark' ? '☀️' : '🌙'}</span>
            <span className="lp__theme-label">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        </div>
        <div className="lp__heading">
          <h2 className="lp__title">{t('loginSubtitle') || 'Admin Panel'}</h2>
          <p className="lp__desc">{t('loginTitle') || 'University Schedule'}</p>
        </div>
        <form onSubmit={handleSubmit} className="lp__form" autoComplete="off">
          <div className="lp__field">
            <label className="lp__label" htmlFor="lpm-username">{t('username') || 'Username'}</label>
            <input ref={usernameRef} id="lpm-username" type="text"
              className="lp__input" value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder={t('username') || 'Username'}
              disabled={loading} autoComplete="off" name="lpm-u" />
          </div>
          <div className="lp__field">
            <label className="lp__label" htmlFor="lpm-password">{t('password') || 'Password'}</label>
            <div className="lp__pass-wrap">
              <input ref={passwordRef} id="lpm-password"
                type={showPass ? 'text' : 'password'}
                className="lp__input lp__input--pass" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={t('password') || 'Password'}
                disabled={loading} autoComplete="new-password" name="lpm-p" />
              <button type="button" className="lp__eye"
                onClick={() => setShowPass(v => !v)} tabIndex={-1}>
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          </div>
          {error && <div className="lp__error">{error}</div>}
          <button type="submit" className="lp__btn" disabled={loading}>
            {loading ? '⏳' : (t('loginBtn') || 'Login')}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={`lp lp--${theme}`}>
      {/* Background */}
      <div className="lp__bg">
        <div className="lp__orb lp__orb--1" />
        <div className="lp__orb lp__orb--2" />
        <div className="lp__orb lp__orb--3" />
        <div className="lp__dots" />
      </div>

      <div className="lp__body">

        {/* ── Left branding ── */}
        <aside className="lp__aside">
          <div className="lp__aside-inner">
            <div className="lp__emblem">
              <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                <rect width="60" height="60" rx="18" fill="rgba(255,255,255,0.1)"/>
                <path d="M30 12L46 22V38L30 48L14 38V22L30 12Z"
                  stroke="url(#eg)" strokeWidth="1.8" fill="none"/>
                <path d="M30 20L40 26V34L30 40L20 34V26L30 20Z"
                  fill="url(#eg)" fillOpacity="0.2"/>
                <circle cx="30" cy="30" r="5.5" fill="url(#eg)"/>
                <defs>
                  <linearGradient id="eg" x1="14" y1="12" x2="46" y2="48" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#93c5fd"/>
                    <stop offset="1" stopColor="#5eead4"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h1 className="lp__uni-name">
              {t('appTitle') || 'International Ala-Too University'}
            </h1>
            <div className="lp__rule" />
            <p className="lp__uni-sub">
              {t('appSubtitle') || 'Timetable Management System'}
            </p>
          </div>
        </aside>

        {/* ── Right form ── */}
        <main className="lp__card">

          {/* Top bar */}
          <div className="lp__topbar">
            <div className="lp__langs">
              {LANGS.map(l => (
                <button key={l.code} type="button"
                  className={`lp__lang${lang === l.code ? ' lp__lang--on' : ''}`}
                  onClick={() => changeLang(l.code)}>
                  {l.label}
                </button>
              ))}
            </div>

            {/* Dark/Light toggle — emoji + label so it's always obvious */}
            <button
              type="button"
              className="lp__theme-toggle"
              onClick={() => setTheme(v => v === 'dark' ? 'light' : 'dark')}
            >
              <span className="lp__theme-emoji">{theme === 'dark' ? '☀️' : '🌙'}</span>
              <span className="lp__theme-label">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>

          {/* Heading */}
          <div className="lp__heading">
            <h2 className="lp__title">{t('loginSubtitle') || 'Admin Panel'}</h2>
            <p className="lp__desc">{t('loginTitle') || 'University Schedule'}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="lp__form" autoComplete="off">

            {/* Username field — NO icon inside input */}
            <div className="lp__field">
              <label className="lp__label" htmlFor="lp-username">
                {t('username') || 'Username'}
              </label>
              <input
                ref={usernameRef}
                id="lp-username"
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

            {/* Password field — only eye toggle, no lock icon */}
            <div className="lp__field">
              <label className="lp__label" htmlFor="lp-password">
                {t('password') || 'Password'}
              </label>
              <div className="lp__pass-wrap">
                <input
                  ref={passwordRef}
                  id="lp-password"
                  type={showPass ? 'text' : 'password'}
                  className="lp__input lp__input--pass"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t('password') || 'Password'}
                  disabled={loading}
                  autoComplete="new-password"
                  name="lp-p"
                />
                <button
                  type="button"
                  className="lp__eye"
                  onClick={() => setShowPass(v => !v)}
                  tabIndex={-1}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="1" y1="1" x2="23" y2="23"/>
                      <path d="M10.58 10.58A3 3 0 0 0 14 13.42M6.7 6.7C4.6 8.07 3 10 3 12s3 7 9 7a12.6 12.6 0 0 0 5.3-1.1M9.9 4.24A9.12 9.12 0 0 1 12 4c6 0 9 5 9 8a13 13 0 0 1-1.67 3.33"/>
                    </svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="lp__error" role="alert">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <button type="submit" className="lp__submit" disabled={loading}>
              {loading ? (
                <span className="lp__spinner" />
              ) : (
                <>
                  <span>{t('loginBtn') || 'Sign In'}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          {onViewAsGuest && (
            <button type="button" className="lp__guest"
              onClick={onViewAsGuest} disabled={loading}>
              {t('viewAsGuest') || 'Guest Mode'}
            </button>
          )}
        </main>
      </div>
    </div>
  );
};

export default Login;