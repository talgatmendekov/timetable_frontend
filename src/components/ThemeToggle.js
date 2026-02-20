// src/components/ThemeToggle.js
import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import './ThemeToggle.css';

const ThemeToggle = () => {
  const { t } = useLanguage();
  const [theme, setTheme] = React.useState(
    localStorage.getItem('scheduleTheme') || 'light'
  );

  React.useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('scheduleTheme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <button 
      className="theme-toggle" 
      onClick={toggleTheme}
      title={theme === 'light' ? t('darkMode') : t('lightMode')}
    >
      {theme === 'light' ? 'ðŸŒ™' : 'â˜€ï¸'}
    </button>
  );
};

export default ThemeToggle;