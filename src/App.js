// src/App.js
import React, { useState, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ScheduleProvider, useSchedule } from './context/ScheduleContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';

// ── Components ────────────────────────────────────────────────────────────────
import Login                     from './components/Login';
import Header                    from './components/Header';
import ScheduleTable             from './components/ScheduleTable';
import ClassModal                from './components/ClassModal';
import PrintView                 from './components/PrintView';
import TeacherDashboard          from './components/TeacherDashboard';
import ConflictPage              from './components/ConflictPage';
import GuestBooking              from './components/GuestBooking';
import GuestBookingStatus        from './components/GuestBookingStatus';
import BookingManagement         from './components/BookingManagement';
import TeacherTelegramManagement from './components/TeacherTelegramManagement';
import EmptyRoomPanel            from './components/EmptyRoomPanel';
import AutoScheduler             from './components/AutoScheduler';
import ExamSchedule              from './components/ExamSchedule';
import FeedbackDashboard         from './components/FeedbackDashboard';

// ── Utils ─────────────────────────────────────────────────────────────────────
import { exportToExcel, importFromExcel } from './utils/excelUtils';
import { parseAlatooSchedule }            from './utils/alatooimport';
import * as XLSX from 'xlsx';

import './App.css';

const API_URL    = process.env.REACT_APP_API_URL    || 'https://timetablebackend-production.up.railway.app/api';
const PUBLIC_URL = process.env.REACT_APP_BACKEND_URL || 'https://timetablebackend-production.up.railway.app';

const getTodayScheduleDay = () => {
  const dayNames     = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const scheduleDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today        = dayNames[new Date().getDay()];
  return scheduleDays.includes(today) ? today : 'Monday';
};

// ─────────────────────────────────────────────────────────────────────────────
// AppContent
// ─────────────────────────────────────────────────────────────────────────────
const AppContent = () => {
  const { isAuthenticated, loading: authLoading, logout } = useAuth();
  const {
    addGroup, clearSchedule, importSchedule, deleteGroup,
    schedule, groups, timeSlots, days,
    loading: scheduleLoading, error,
  } = useSchedule();
  const { t } = useLanguage();

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeTab,         setActiveTab]         = useState('schedule');
  const [selectedDay,       setSelectedDay]        = useState(getTodayScheduleDay);
  const [selectedTeacher,   setSelectedTeacher]    = useState('');
  const [selectedGroup,     setSelectedGroup]      = useState('');
  const [selectedRoom,      setSelectedRoom]       = useState('');
  const [modalOpen,         setModalOpen]          = useState(false);
  const [currentCell,       setCurrentCell]        = useState({ group: null, day: null, time: null });
  const [importing,         setImporting]          = useState(false);
  const [showBooking,       setShowBooking]        = useState(false);
  const [guestBookCell,     setGuestBookCell]      = useState(null);
  const [activeBookings,    setActiveBookings]     = useState([]);
  const [showExamsToGuests, setShowExamsToGuests]  = useState(false);
  const [feedbackCount,     setFeedbackCount]      = useState(0);
  const [shareToast,        setShareToast]         = useState('');

  // ── NEW: sidebar, login overlay, filters state ──────────────────────────────
  const [sidebarOpen,    setSidebarOpen]    = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [filtersOpen,    setFiltersOpen]    = useState(false);

  const fileInputRef = useRef(null);

  // ── Auto-select today ──────────────────────────────────────────────────────
  React.useEffect(() => {
    const today = getTodayScheduleDay();
    if (today && days.includes(today)) setSelectedDay(today);
  }, [days]);

  // ── All rooms ──────────────────────────────────────────────────────────────
  const allRooms = React.useMemo(() => {
    const rooms = new Set();
    Object.values(schedule).forEach(e => { if (e.room) rooms.add(e.room); });
    return [...rooms].sort();
  }, [schedule]);

  // ── Feedback badge ─────────────────────────────────────────────────────────
  const fetchFeedbackCount = React.useCallback(async () => {
    try {
      const token = localStorage.getItem('scheduleToken') || '';
      if (!token || !isAuthenticated) return;
      const r = await fetch(`${API_URL}/feedback/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (d.success) setFeedbackCount(d.unread || 0);
    } catch { /* ignore */ }
  }, [isAuthenticated]);

  React.useEffect(() => {
    if (isAuthenticated) fetchFeedbackCount();
  }, [fetchFeedbackCount, isAuthenticated]);

  // ── Exam setting ───────────────────────────────────────────────────────────
  const fetchExamSetting = React.useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/settings/show_exams_to_guests`);
      const d = await r.json();
      setShowExamsToGuests(d.value === 'true');
    } catch { /* ignore */ }
  }, []);

  React.useEffect(() => { fetchExamSetting(); }, [fetchExamSetting]);

  // ── Bookings ───────────────────────────────────────────────────────────────
  const fetchActiveBookings = React.useCallback(() => {
    const token = localStorage.getItem('scheduleToken') || '';
    fetch(`${API_URL}/booking-requests`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(d => { if (d.success) setActiveBookings(d.data || []); })
      .catch(() => {});
  }, []);

  React.useEffect(() => { fetchActiveBookings(); }, [fetchActiveBookings]);

  // ── Conflict count ─────────────────────────────────────────────────────────
  const conflictCount = React.useMemo(() => {
    const entries = Object.values(schedule);
    let count = 0;
    const seen = new Set();
    days.forEach(day => {
      timeSlots.forEach(time => {
        const slot = entries.filter(e => e.day === day && e.time === time);
        if (slot.length < 2) return;
        const tMap = {}, rMap = {};
        slot.forEach(e => {
          if (e.teacher) { const k = e.teacher.toLowerCase(); tMap[k] = (tMap[k]||0) + 1; }
          if (e.room)    { const k = e.room.toLowerCase();    rMap[k] = (rMap[k]||0) + 1; }
        });
        Object.entries(tMap).forEach(([k,v]) => {
          if (v > 1 && !seen.has(`t-${k}-${day}-${time}`)) { count++; seen.add(`t-${k}-${day}-${time}`); }
        });
        Object.entries(rMap).forEach(([k,v]) => {
          if (v > 1 && !seen.has(`r-${k}-${day}-${time}`)) { count++; seen.add(`r-${k}-${day}-${time}`); }
        });
      });
    });
    return count;
  }, [schedule, days, timeSlots]);

  // ── Modal handlers ─────────────────────────────────────────────────────────
  const handleEditClass  = (group, day, time) => { setCurrentCell({ group, day, time }); setModalOpen(true); };
  const handleCloseModal = () => { setModalOpen(false); setCurrentCell({ group: null, day: null, time: null }); };
  const handleJumpToCell = (group, day, time) => {
    setActiveTab('schedule');
    setSelectedDay(day);
    setSelectedGroup(group);
    setTimeout(() => { setCurrentCell({ group, day, time }); setModalOpen(true); }, 150);
  };

  // ── Group handlers ─────────────────────────────────────────────────────────
  const handleAddGroup = () => {
    const name = prompt(t('enterGroupName'));
    if (name?.trim()) addGroup(name.trim());
  };

  const handleDeleteGroup = async (groupName) => {
    await deleteGroup(groupName);
    setActiveBookings(prev => prev.filter(b => b.entity !== groupName && b.name !== groupName));
  };

  // ── Share ──────────────────────────────────────────────────────────────────
  const handleShare = () => {
    const group = selectedGroup || (groups.length > 0 ? groups[0] : '');
    const url   = group
      ? `${PUBLIC_URL}/schedule/${encodeURIComponent(group)}`
      : `${PUBLIC_URL}/schedule`;
    navigator.clipboard?.writeText(url).then(() => {
      setShareToast(`✓ Copied: /schedule/${group || ''}`);
      setTimeout(() => setShareToast(''), 2500);
    }).catch(() => { prompt('Copy this link:', url); });
  };

  // ── Export / Import ────────────────────────────────────────────────────────
  const handleExport = async () => {
    try {
      await exportToExcel(groups, schedule, timeSlots, days,
        `university-schedule-${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) { alert(`Export failed: ${err.message}`); }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      try {
        const parsed = await parseAlatooSchedule(file);
        if (parsed?.length > 0) {
          const res = await importSchedule(JSON.stringify(parsed));
          alert(res?.success
            ? `✅ Imported ${parsed.length} classes!`
            : `❌ Import failed: ${res?.error || 'Unknown error'}`);
          return;
        }
        throw new Error('No classes found');
      } catch {
        const result = await importFromExcel(file);
        if (result.success) {
          const res = await importSchedule(JSON.stringify({ groups: result.groups, schedule: result.schedule }));
          alert(res.success
            ? `✅ Imported ${result.groups.length} groups, ${Object.keys(result.schedule).length} classes.`
            : `❌ Import failed: ${res.error}`);
        } else {
          const reader = new FileReader();
          reader.onload = ev => {
            try {
              const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
              console.log('Excel structure:', XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }).slice(0, 5));
            } catch {}
          };
          reader.readAsArrayBuffer(file);
          alert('❌ Invalid file format. Check console for file structure.');
        }
      }
    } catch (err) {
      alert(`❌ Import failed: ${err.message}`);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearAll = () => {
    if (window.confirm(t('confirmClearAll'))) clearSchedule();
  };

  // ── Admin sidebar tabs ─────────────────────────────────────────────────────
  const adminTabs = [
    { id: 'print',     icon: '🖨️', label: t('tabPrint')     || 'Print / PDF'   },
    { id: 'dashboard', icon: '📊', label: t('tabDashboard') || 'Teacher Stats'  },
    { id: 'conflicts', icon: '⚠️',  label: t('tabConflicts') || 'Conflicts', badge: conflictCount },
    { id: 'bookings',  icon: '🏫', label: t('tabBookings')  || 'Lab Bookings'   },
    { id: 'autosched', icon: '🤖', label: t('tabAutoSched') || 'Auto Schedule'  },
    { id: 'exams',     icon: '🗓', label: t('tabExams')     || 'Exam Schedule'  },
    { id: 'feedback',  icon: '💬', label: t('tabFeedback')  || 'Feedback', badge: feedbackCount },
    { id: 'telegram',  icon: '📱', label: t('tabTelegram')  || 'Telegram'       },
  ];

  const guestTabs = [
    { id: 'mybookings', icon: '📋', label: t('tabMyBookings') || 'My Bookings' },
    ...(showExamsToGuests ? [{ id: 'exams', icon: '🗓', label: t('tabExams') || 'Exam Schedule' }] : []),
    { id: 'feedback',   icon: '💬', label: t('tabFeedback')   || 'Feedback'    },
  ];

  // ── Auth loading ───────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner">⏳</div>
        <p>Loading...</p>
      </div>
    );
  }

  // ── LOGIN MODAL (shown over schedule, not instead of it) ───────────────────
  const LoginModal = () => (
    <div className="login-modal-overlay" onClick={(e) => {
      if (e.target.classList.contains('login-modal-overlay')) setShowLoginModal(false);
    }}>
      <div className="login-modal-box">
        <button className="login-modal-close" onClick={() => setShowLoginModal(false)}>✕</button>
        <Login onViewAsGuest={null} onSuccess={() => setShowLoginModal(false)} />
      </div>
    </div>
  );

  // ── Main render — schedule always visible ──────────────────────────────────
  const showSidebar  = sidebarOpen && (isAuthenticated || !isAuthenticated);
  const sidebarTabs  = isAuthenticated ? adminTabs : guestTabs;
  const isInSidebar  = activeTab !== 'schedule';

  return (
    <div className="app">

      {/* Hidden file input */}
      <input
        type="file" ref={fileInputRef}
        accept=".xlsx,.xls" onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Loading overlay */}
      {(importing || scheduleLoading) && (
        <div className="import-overlay">
          <div className="import-spinner">
            ⏳ {scheduleLoading
              ? (t('loadingData') || 'Loading data…')
              : (t('importing')   || 'Importing…')}
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="error-banner">
          ⚠️ Could not connect to server: {error}.
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      {/* ── TOP BAR ── */}
      <div className="app-topbar">
        <div className="app-topbar-left">
          <span className="app-topbar-logo">🏛</span>
          <span className="app-topbar-title">
            {t('appTitle') || 'Alatoo University'}
          </span>
        </div>

        <div className="app-topbar-right">
          {/* Language switcher */}
          <LanguageSwitcher />

          {/* Guest booking button */}
          {!isAuthenticated && (
            <button className="topbar-btn topbar-btn--outline"
              onClick={() => setShowBooking(true)}>
              🏫 {t('bookLab') || 'Book Lab'}
            </button>
          )}

          {/* Sidebar toggle — shows all extra features */}
          <button
            className={`topbar-btn topbar-btn--tools${sidebarOpen ? ' active' : ''}`}
            onClick={() => setSidebarOpen(v => !v)}
            title="Tools & Features"
          >
            ☰ {t('tools') || 'Tools'}
            {(conflictCount > 0 || feedbackCount > 0) && (
              <span className="topbar-badge">{conflictCount + feedbackCount}</span>
            )}
          </button>

          {/* Admin / Login button */}
          {isAuthenticated ? (
            <button className="topbar-btn topbar-btn--admin"
              onClick={() => { setSidebarOpen(true); }}>
              ⚙️ {t('admin') || 'Admin'}
            </button>
          ) : (
            <button className="topbar-btn topbar-btn--login"
              onClick={() => setShowLoginModal(true)}>
              🔐 {t('loginBtn') || 'Admin Login'}
            </button>
          )}

          {/* Logout — admin only */}
          {isAuthenticated && (
            <button className="topbar-btn topbar-btn--logout"
              onClick={() => { logout(); setSidebarOpen(false); setActiveTab('schedule'); }}>
              ↩ {t('logout') || 'Logout'}
            </button>
          )}
        </div>
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div className={`app-layout${showSidebar ? ' app-layout--sidebar' : ''}`}>

        {/* ── SCHEDULE (always visible, always on left/main) ── */}
        <div className="app-main">
          {/* Collapsible filter bar — hidden by default, toggle with Filters button */}
          <FilterBar
            open={filtersOpen} onToggle={() => setFiltersOpen(v => !v)}
            selectedDay={selectedDay}           setSelectedDay={setSelectedDay}
            selectedTeacher={selectedTeacher}   setSelectedTeacher={setSelectedTeacher}
            selectedGroup={selectedGroup}       setSelectedGroup={setSelectedGroup}
            onAddGroup={isAuthenticated ? handleAddGroup : undefined}
            onExport={isAuthenticated ? handleExport : undefined}
            onImport={isAuthenticated ? handleImportClick : undefined}
            onClearAll={isAuthenticated ? handleClearAll : undefined}
            allRooms={allRooms} schedule={schedule}
            days={days} timeSlots={timeSlots}
            selectedRoom={selectedRoom} setSelectedRoom={setSelectedRoom}
            isAuthenticated={isAuthenticated}
            handleShare={handleShare} shareToast={shareToast}
          />

          {/* Schedule table — always at top, no scrolling needed */}
          <ScheduleTable
            selectedDay={selectedDay}
            selectedTeacher={selectedTeacher}
            selectedGroup={selectedGroup}
            selectedRoom={selectedRoom}
            onEditClass={isAuthenticated ? handleEditClass : undefined}
            onDeleteGroup={isAuthenticated ? handleDeleteGroup : undefined}
            bookings={activeBookings}
            onGuestBookCell={(group, day, time) => setGuestBookCell({ group, day, time })}
          />
        </div>

        {/* ── SIDEBAR (slides in from right) ── */}
        {showSidebar && (
          <aside className="app-sidebar">
            <div className="sidebar-header">
              <span className="sidebar-title">
                {isAuthenticated ? `⚙️ ${t('admin') || 'Admin Panel'}` : `📋 ${t('tools') || 'Tools'}`}
              </span>
              <button className="sidebar-close" onClick={() => { setSidebarOpen(false); setActiveTab('schedule'); }}>
                ✕
              </button>
            </div>

            {/* Sidebar nav */}
            <nav className="sidebar-nav">
              {sidebarTabs.map(tab => (
                <button
                  key={tab.id}
                  className={`sidebar-nav-btn${activeTab === tab.id ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="sidebar-nav-icon">{tab.icon}</span>
                  <span className="sidebar-nav-label">{tab.label}</span>
                  {tab.badge > 0 && <span className="sidebar-badge">{tab.badge}</span>}
                </button>
              ))}
            </nav>

            {/* Sidebar content */}
            <div className="sidebar-content">
              {activeTab === 'mybookings' && (
                <GuestBookingStatus bookings={activeBookings} onRefresh={setActiveBookings} />
              )}
              {activeTab === 'print'     && <PrintView />}
              {activeTab === 'dashboard' && <TeacherDashboard />}
              {activeTab === 'conflicts' && <ConflictPage onJumpToCell={handleJumpToCell} />}
              {activeTab === 'bookings'  && <BookingManagement />}
              {activeTab === 'autosched' && <AutoScheduler />}
              {activeTab === 'exams' && (
                <ExamSchedule
                  readOnly={!isAuthenticated}
                  showExamsToGuests={showExamsToGuests}
                  setShowExamsToGuests={setShowExamsToGuests}
                />
              )}
              {activeTab === 'feedback' && (
                isAuthenticated
                  ? <FeedbackDashboard />
                  : <FeedbackDashboard guestMode={true} schedule={schedule} groups={groups} />
              )}
              {activeTab === 'telegram' && <TeacherTelegramManagement />}
            </div>
          </aside>
        )}
      </div>

      {/* ── GUEST BOOKING MODAL ── */}
      {!isAuthenticated && (
        <GuestBooking
          isOpen={showBooking || !!guestBookCell}
          prefilledGroup={guestBookCell?.group || ''}
          prefilledDay={guestBookCell?.day   || ''}
          prefilledTime={guestBookCell?.time  || ''}
          onClose={() => { setShowBooking(false); setGuestBookCell(null); }}
          onBooked={() => { setGuestBookCell(null); setShowBooking(false); fetchActiveBookings(); }}
        />
      )}

      {/* ── LOGIN MODAL ── */}
      {showLoginModal && !isAuthenticated && <LoginModal />}

      {/* ── CLASS MODAL ── */}
      <ClassModal
        isOpen={modalOpen} onClose={handleCloseModal}
        group={currentCell.group} day={currentCell.day} time={currentCell.time}
      />

      {/* Footer */}
      <footer className="app-author-credit">
        <span className="app-author-logo">🏛</span>
        <span>Developed by <strong>Talgat Mendekov</strong></span>
        <span className="app-author-sep">·</span>
        <span>Alatoo International University</span>
        <span className="app-author-sep">·</span>
        <span>{new Date().getFullYear()}</span>
      </footer>
    </div>
  );
};

// ── FilterBar — collapsible strip above schedule ────────────────────────────
const FilterBar = ({
  open, onToggle,
  selectedDay, setSelectedDay, selectedTeacher, setSelectedTeacher,
  selectedGroup, setSelectedGroup, onAddGroup, onExport, onImport, onClearAll,
  allRooms, schedule, days, timeSlots, selectedRoom, setSelectedRoom,
  isAuthenticated, handleShare, shareToast,
}) => {
  const { t } = useLanguage();
  const { groups } = useSchedule();

  const hasFilter = selectedDay || selectedTeacher || selectedGroup || selectedRoom;

  return (
    <div className="filter-bar">
      {/* Always-visible compact strip */}
      <div className="filter-bar__strip">
        <button
          className={`filter-bar__toggle${open ? ' active' : ''}${hasFilter ? ' has-filter' : ''}`}
          onClick={onToggle}
          type="button"
        >
          🔍 {t('filters') || 'Filters'}
          {hasFilter && <span className="filter-bar__dot" />}
          <span className="filter-bar__arrow">{open ? '▲' : '▼'}</span>
        </button>

        {/* Quick day pills — always visible */}
        <div className="filter-bar__days">
          {days.map(day => (
            <button
              key={day}
              className={`filter-bar__day${selectedDay === day ? ' active' : ''}`}
              onClick={() => setSelectedDay(selectedDay === day ? '' : day)}
              type="button"
            >
              {day.slice(0, 3)}
            </button>
          ))}
          {selectedDay && (
            <button className="filter-bar__clear-day" onClick={() => setSelectedDay('')} type="button">✕</button>
          )}
        </div>

        {/* Quick group select */}
        {groups.length > 0 && (
          <select
            className="filter-bar__group-select"
            value={selectedGroup}
            onChange={e => setSelectedGroup(e.target.value)}
          >
            <option value="">{t('allGroups') || 'All groups'}</option>
            {groups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        )}

        {/* Admin quick actions */}
        {isAuthenticated && (
          <div className="filter-bar__actions">
            {onAddGroup  && <button className="filter-bar__action" onClick={onAddGroup}  type="button">+ {t('addGroup') || 'Group'}</button>}
            {onExport    && <button className="filter-bar__action" onClick={onExport}    type="button">⬇ {t('export') || 'Export'}</button>}
            {onImport    && <button className="filter-bar__action" onClick={onImport}    type="button">⬆ {t('import') || 'Import'}</button>}
            {onClearAll  && <button className="filter-bar__action filter-bar__action--danger" onClick={onClearAll} type="button">🗑 {t('clearAll') || 'Clear'}</button>}
            <button className="filter-bar__action" onClick={handleShare} type="button">🔗 {t('share') || 'Share'}</button>
            {shareToast && <span className="share-toast">{shareToast}</span>}
          </div>
        )}
      </div>

      {/* Expandable advanced filters */}
      {open && (
        <div className="filter-bar__expanded">
          <div className="filter-bar__row">
            <div className="filter-bar__field">
              <label className="filter-bar__label">{t('filterTeacher') || 'Teacher'}</label>
              <input
                className="filter-bar__input"
                type="text"
                placeholder={t('filterTeacher') || 'Filter by teacher…'}
                value={selectedTeacher}
                onChange={e => setSelectedTeacher(e.target.value)}
                autoComplete="off"
              />
            </div>
            {allRooms.length > 0 && (
              <div className="filter-bar__field">
                <label className="filter-bar__label">{t('filterRoom') || 'Room'}</label>
                <select
                  className="filter-bar__input"
                  value={selectedRoom}
                  onChange={e => setSelectedRoom(e.target.value)}
                >
                  <option value="">{t('allRooms') || 'All rooms'}</option>
                  {allRooms.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}
            {(selectedTeacher || selectedRoom) && (
              <button
                className="filter-bar__clear"
                onClick={() => { setSelectedTeacher(''); setSelectedRoom(''); }}
                type="button"
              >
                ✕ {t('clearFilters') || 'Clear filters'}
              </button>
            )}
          </div>
          <EmptyRoomPanel
            allRooms={allRooms} schedule={schedule}
            days={days} timeSlots={timeSlots}
            selectedRoom={selectedRoom} setSelectedRoom={setSelectedRoom}
          />
        </div>
      )}
    </div>
  );
};

// ── Language switcher inline component ────────────────────────────────────────
const LanguageSwitcher = () => {
  const { lang, changeLang } = useLanguage();
  return (
    <div className="lang-switcher">
      {['en','ru','ky'].map(l => (
        <button key={l}
          className={`lang-switcher__btn${lang === l ? ' active' : ''}`}
          onClick={() => changeLang(l)}
          type="button"
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
};

// ── Root ──────────────────────────────────────────────────────────────────────
function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <ScheduleProvider>
          <AppContent />
        </ScheduleProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;