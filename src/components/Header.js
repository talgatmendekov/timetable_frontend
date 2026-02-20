import { useAuth } from '../context/AuthContext';
import { useSchedule } from '../context/ScheduleContext';
import { useLanguage } from '../context/LanguageContext';
import { LANGUAGE_OPTIONS } from '../data/i18n';
import logo from '../assets/logo.png';
import ThemeToggle from './ThemeToggle';
import './Header.css';

// Get today's day name in English
const getTodayName = () => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date().getDay()];
};

const SCHEDULE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const Header = ({
  selectedDay,
  setSelectedDay,
  selectedTeacher,
  setSelectedTeacher,
  selectedGroup,
  setSelectedGroup,
  onAddGroup,
  onExport,
  onImport,
  onClearAll
}) => {
  const { isAuthenticated, user, logout } = useAuth();
  const { days, teachers, groups } = useSchedule();
  const { lang, changeLang, t } = useLanguage();

  const todayName = getTodayName();
  const isTodayScheduleDay = SCHEDULE_DAYS.includes(todayName);

  return (
    <div className="header">
      <div className="header-top">
        
        <div className="header-title">
          <div>
             <img src={logo} alt="University Logo" className="logo" />
              <h1>{t('appTitle')}</h1>
             
          </div>
        <p className="subtitle">{t('appSubtitle')}</p>
        </div>

        <div className="header-right">
           <ThemeToggle />
          {/* Language Selector */}
          <div className="lang-selector">
            {LANGUAGE_OPTIONS.map(opt => (
              <button
                key={opt.code}
                className={`lang-btn ${lang === opt.code ? 'active' : ''}`}
                onClick={() => changeLang(opt.code)}
                title={opt.label}
              >
                {opt.flag} {opt.code.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="header-user">
            {isAuthenticated ? (
              <>
                <span className="user-badge">
                  <span className="user-icon">👤</span>
                  {user.username} ({user.role})
                </span>
                <button onClick={logout} className="btn btn-secondary">
                  {t('logout')}
                </button>
              </>
            ) : (
              <span className="guest-badge">{t('guestMode')}</span>
            )}
          </div>
        </div>
      </div>

      <div className="header-controls">
        <div className="filters">

          {/* Day Filter */}
          <div className="filter-group">
            <label>{t('filterByDay')}</label>
            <div className="day-buttons">
              <button
                className={`day-btn ${selectedDay === '' ? 'active' : ''}`}
                onClick={() => setSelectedDay('')}
              >
                {t('allDays')}
              </button>
              {days.map(day => {
                const isToday = day === todayName;
                const isSelected = selectedDay === day;
                return (
                  <button
                    key={day}
                    className={`day-btn ${isSelected ? 'active' : ''} ${isToday ? 'today' : ''}`}
                    onClick={() => setSelectedDay(day)}
                    title={isToday ? t('today') : ''}
                  >
                    {t(day)}
                    {isToday && <span className="today-dot">●</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Teacher Filter */}
          <div className="filter-group">
            <label>{t('filterByTeacher')}</label>
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="select-input"
            >
              <option value="">{t('allTeachers')}</option>
              {teachers.map(teacher => (
                <option key={teacher} value={teacher}>{teacher}</option>
              ))}
            </select>
          </div>

          {/* Group Filter */}
          <div className="filter-group">
            <label>{t('filterByGroup')}</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="select-input"
            >
              <option value="">{t('allGroups')}</option>
              {groups.map(group => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </div>
        </div>

        {isAuthenticated && (
          <div className="admin-actions">
            <button onClick={onAddGroup} className="btn btn-primary">{t('addGroup')}</button>
            <button onClick={onExport} className="btn btn-success" title="Export as .xlsx">📊 {t('export')}</button>
            <button onClick={onImport} className="btn btn-info" title="Import from .xlsx">📂 {t('import')}</button>
            <button onClick={onClearAll} className="btn btn-danger">{t('clearAll')}</button>
          </div>
        )}
      </div>

      {/* Today banner */}
      {isTodayScheduleDay && (
        <div className="today-banner">
          📅 {t('today')}: <strong>{t(todayName)}</strong>
        </div>
      )}
    </div>
  );
};

export default Header;
