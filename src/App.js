// src/App.js
import React, { useState, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ScheduleProvider, useSchedule } from './context/ScheduleContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';

import Login                     from './components/Login';
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

import { exportToExcel, importFromExcel } from './utils/excelUtils';
import { LANGUAGE_OPTIONS }               from './data/i18n';

import logo         from './assets/logo.png';
import iconAuto     from './assets/auto.png';
import iconBooking  from './assets/booking.png';
const iconExams = '🗓';
import iconFeedback from './assets/feedback.png';
import iconSchedule from './assets/schedule.png';
import iconStats    from './assets/stats.jpeg';
import iconTelegram from './assets/telegram.jpeg';

import './App.css';

const API_URL    = process.env.REACT_APP_API_URL    || 'https://timetablebackend-production.up.railway.app/api';
const PUBLIC_URL = process.env.REACT_APP_BACKEND_URL || 'https://timetablebackend-production.up.railway.app';

const DAY_NAMES     = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const SCHEDULE_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const getTodayScheduleDay = () => { const t = DAY_NAMES[new Date().getDay()]; return SCHEDULE_DAYS.includes(t) ? t : 'Monday'; };
const getTodayName        = () => DAY_NAMES[new Date().getDay()];

if (!localStorage.getItem('scheduleTheme')) {
  localStorage.setItem('scheduleTheme', 'light');
  document.body.setAttribute('data-theme', 'light');
}

// ── Render a tab icon — image asset or emoji ──────────────────────────────────
const TabIcon = ({ icon, label, active }) => {
  // Anything that isn't a pure emoji string gets rendered as <img>
  // Webpack resolves imported assets to a URL string like "/static/media/auto.abc123.webp"
  const isEmoji = typeof icon === 'string' && /^(\p{Emoji}|[\u2600-\u27BF])/u.test(icon) && icon.length <= 4;
  if (!isEmoji && icon) {
    const src = (typeof icon === 'object' && icon.default) ? icon.default : icon;
    return (
      <img
        src={src}
        alt={label}
        style={{ width:22, height:22, objectFit:'contain', borderRadius:4,
          filter: 'none',
          opacity: active ? 1 : 0.7,
          transform: active ? 'scale(1.1)' : 'scale(1)' }}
        onError={e => { e.target.style.display='none'; e.target.nextSibling && (e.target.nextSibling.style.display='inline'); }}
      />
    );
  }
  return <span style={{ fontSize:'1.1rem', lineHeight:1 }}>{icon}</span>;
};

// ─────────────────────────────────────────────────────────────────────────────
const AppContent = () => {
  const { isAuthenticated, loading: authLoading, logout, user } = useAuth();
  const { addGroup, clearSchedule, importSchedule, deleteGroup, schedule, groups, teachers, timeSlots, days, loading: scheduleLoading, error } = useSchedule();
  const { t, lang, changeLang } = useLanguage();

  const [showLoginModal,    setShowLoginModal]    = useState(false);
  const [activeView,        setActiveView]        = useState('schedule');
  const [selectedDay,       setSelectedDay]       = useState(getTodayScheduleDay);
  const [selectedTeacher,   setSelectedTeacher]   = useState('');
  const [selectedGroup,     setSelectedGroup]     = useState('');
  const [selectedRoom,      setSelectedRoom]      = useState('');
  const [modalOpen,         setModalOpen]         = useState(false);
  const [currentCell,       setCurrentCell]       = useState({ group:null, day:null, time:null });
  const [importing,         setImporting]         = useState(false);
  const [showBooking,       setShowBooking]       = useState(false);
  const [guestBookCell,     setGuestBookCell]     = useState(null);
  const [activeBookings,    setActiveBookings]    = useState([]);
  const [showExamsToGuests, setShowExamsToGuests] = useState(false);
  const [feedbackCount,     setFeedbackCount]     = useState(0);
  const [shareToast,        setShareToast]        = useState('');
  const [theme,             setTheme]             = useState(localStorage.getItem('scheduleTheme') || 'light');

  const fileInputRef = useRef(null);
  const todayName = getTodayName();

  React.useEffect(() => { document.body.setAttribute('data-theme', theme); localStorage.setItem('scheduleTheme', theme); }, [theme]);
  React.useEffect(() => { if (isAuthenticated) setShowLoginModal(false); }, [isAuthenticated]);
  React.useEffect(() => { const d = getTodayScheduleDay(); if (d && days.includes(d)) setSelectedDay(d); }, [days]);

  const allRooms = React.useMemo(() => {
    const r = new Set(); Object.values(schedule).forEach(e => { if (e.room) r.add(e.room); }); return [...r].sort();
  }, [schedule]);

  const fetchFeedbackCount = React.useCallback(async () => {
    try {
      const tk = localStorage.getItem('token') || localStorage.getItem('scheduleToken') || '';
      if (!tk || !isAuthenticated) return;
      const r = await fetch(`${API_URL}/feedback/stats`, { headers: { Authorization: `Bearer ${tk}` } });
      const d = await r.json(); if (d.success) setFeedbackCount(d.unread || 0);
    } catch {}
  }, []);
  React.useEffect(() => { if (isAuthenticated) fetchFeedbackCount(); }, [fetchFeedbackCount, isAuthenticated]);

  const fetchExamSetting = React.useCallback(async () => {
    try { const r = await fetch(`${API_URL}/settings/show_exams_to_guests`); const d = await r.json(); setShowExamsToGuests(d.value === 'true'); } catch {}
  }, []);
  React.useEffect(() => { fetchExamSetting(); }, [fetchExamSetting]);

  const fetchActiveBookings = React.useCallback(() => {
    const tk = localStorage.getItem('scheduleToken') || '';
    if (!tk) return;
    fetch(`${API_URL}/booking-requests`, { headers: { Authorization: `Bearer ${tk}` } })
      .then(r => r.json()).then(d => { if (d.success) setActiveBookings(d.data || []); }).catch(() => {});
  }, []);
  React.useEffect(() => { fetchActiveBookings(); }, [fetchActiveBookings]);

  const conflictCount = React.useMemo(() => {
    const entries = Object.values(schedule); let count = 0; const seen = new Set();
    days.forEach(day => { timeSlots.forEach(time => {
      const slot = entries.filter(e => e.day === day && e.time === time); if (slot.length < 2) return;
      const tMap = {}, rMap = {};
      slot.forEach(e => { if (e.teacher){const k=e.teacher.toLowerCase();tMap[k]=(tMap[k]||0)+1;} if(e.room){const k=e.room.toLowerCase();rMap[k]=(rMap[k]||0)+1;} });
      Object.entries(tMap).forEach(([k,v])=>{if(v>1&&!seen.has(`t-${k}-${day}-${time}`)){count++;seen.add(`t-${k}-${day}-${time}`);}});
      Object.entries(rMap).forEach(([k,v])=>{if(v>1&&!seen.has(`r-${k}-${day}-${time}`)){count++;seen.add(`r-${k}-${day}-${time}`);}});
    }); }); return count;
  }, [schedule, days, timeSlots]);

  const handleEditClass   = (group, day, time) => { setCurrentCell({ group, day, time }); setModalOpen(true); };
  const handleCloseModal  = () => { setModalOpen(false); setCurrentCell({ group:null, day:null, time:null }); };
  const handleJumpToCell  = (group, day, time) => { setActiveView('schedule'); setSelectedDay(day); setSelectedGroup(group); setTimeout(() => { setCurrentCell({ group, day, time }); setModalOpen(true); }, 150); };
  const handleAddGroup    = () => { const n = prompt(t('enterGroupName')); if (n?.trim()) addGroup(n.trim()); };
  const handleDeleteGroup = async (g) => { await deleteGroup(g); setActiveBookings(prev => prev.filter(b => b.entity!==g && b.name!==g)); };
  const handleShare       = () => {
    const group = selectedGroup || (groups[0] || '');
    const url = group ? `${PUBLIC_URL}/schedule/${encodeURIComponent(group)}` : `${PUBLIC_URL}/schedule`;
    navigator.clipboard?.writeText(url).then(() => { setShareToast('✓'); setTimeout(() => setShareToast(''), 2000); }).catch(() => prompt('Copy:', url));
  };
  const handleExport      = async () => { try { await exportToExcel(groups, schedule, timeSlots, days, `schedule-${new Date().toISOString().split('T')[0]}.xlsx`); } catch (err) { alert(`Export failed: ${err.message}`); } };
  const handleImportClick = () => fileInputRef.current?.click();
  const handleFileChange  = async (e) => {
    const file = e?.target?.files?.[0]; if (!file) return; setImporting(true);
    try {
      const result = await importFromExcel(file);
      if (result.success) {
        const res = await importSchedule(JSON.stringify({ groups: result.groups, schedule: result.schedule }));
        alert(res.success ? `✅ Imported ${result.groups.length} groups, ${Object.keys(result.schedule).length} classes.` : `❌ ${res.error}`);
      } else {
        alert(`❌ ${result.error || 'Invalid file format.'}`);
      }
    } catch (err) { alert(`❌ ${err.message}`); }
    finally { setImporting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };
  const handleClearAll = () => { if (window.confirm(t('confirmClearAll'))) clearSchedule(); };

  const navTabs = [
    ...(!isAuthenticated ? [
      { id:'mybookings', icon: iconBooking,  label:'My Bookings' },
      ...(showExamsToGuests ? [{ id:'exams', icon: iconExams, label:'Exams' }] : []),
      { id:'feedback',   icon: iconFeedback, label:'Feedback' },
    ] : []),
    ...(isAuthenticated ? [
      { id:'print',     icon: iconSchedule, label:'Print'                          },
      { id:'dashboard', icon: iconStats,    label:'Stats'                          },
      { id:'conflicts', icon: '⚠️',         label:'Conflicts', badge: conflictCount },
      { id:'bookings',  icon: iconBooking,  label:'Bookings'                       },
      { id:'autosched', icon: iconAuto,     label:'Auto'                           },
      { id:'exams',     icon: iconExams,    label:'Exams'                          },
      { id:'feedback',  icon: iconFeedback, label:'Feedback',  badge: feedbackCount },
      { id:'telegram',  icon: iconTelegram, label:'Telegram'                       },
    ] : []),
  ];

  if (authLoading) return (
    <div className="app-loading"><div className="app-loading-spinner">⏳</div><p>Loading...</p></div>
  );

  const S = {
    bar: {
      display:'flex', alignItems:'center', gap:8,
      background:'var(--bg-card)', borderBottom:'1px solid var(--border)',
      padding:'6px 12px', flexWrap:'wrap',
      position:'sticky', top:0, zIndex:200,
    },
    divider: { width:1, height:20, background:'var(--border)', flexShrink:0 },

    select: {
      padding:'4px 8px', borderRadius:7, border:'2px solid var(--border)',
      background:'var(--bg-main)', color:'var(--text-primary)',
      fontSize:'0.75rem', cursor:'pointer', fontFamily:'inherit', outline:'none',
    },
    iconBtn: (active) => ({
      width:44, minHeight:50, borderRadius:11, flexShrink:0,
      border: active ? '2px solid var(--primary)' : '1px solid var(--border)',
      background: active ? 'var(--primary)' : 'transparent',
      color: active ? '#fff' : 'var(--text-secondary)',
      cursor:'pointer', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:2,
      padding:'5px 2px', position:'relative', transition:'all 0.15s',
      fontSize:'1rem',
    }),
    iconLabel: { fontSize:'0.46rem', fontWeight:700, lineHeight:1, textAlign:'center', whiteSpace:'nowrap' },
  };

  return (
    <div className="app" style={{ padding:0 }}>

      <input type="file" ref={fileInputRef} accept=".xlsx,.xls" onChange={handleFileChange} style={{ display:'none' }} />

      {(importing || scheduleLoading) && (
        <div className="import-overlay">
          <div className="import-spinner">⏳ {scheduleLoading ? 'Loading…' : 'Importing…'}</div>
        </div>
      )}

      {showLoginModal && !isAuthenticated && (
        <div onClick={e => { if (e.target===e.currentTarget) setShowLoginModal(false); }}
          style={{ position:'fixed', inset:0, zIndex:9998, background:'rgba(0,0,0,0.82)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ position:'relative', width:'100%', maxWidth:920, maxHeight:'96vh', overflow:'auto' }}>
            <button onClick={() => setShowLoginModal(false)}
              style={{ position:'absolute', top:12, right:12, zIndex:10, width:32, height:32, borderRadius:'50%', background:'rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.25)', color:'#fff', fontSize:'1rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
            <Login onViewAsGuest={null} />
          </div>
        </div>
      )}

      {/* ── TOPBAR — single compact row, scrollable ── */}
      <div style={S.bar} className="app-topbar">

        {/* Logo + name */}
        <img src={logo} alt="" style={{ height:22, width:22, objectFit:'contain', borderRadius:4, flexShrink:0 }} />
        <span style={{ fontWeight:800, fontSize:'0.75rem', color:'var(--text-primary)', whiteSpace:'nowrap', flexShrink:0 }}>
          Alatoo
        </span>

        <div style={S.divider} />

        {/* Filters */}
        <select value={selectedDay} onChange={e => setSelectedDay(e.target.value)} style={S.sel}>
          <option value="">{t('allDays')}</option>
          {days.map(day => (
            <option key={day} value={day}>{t(day)}{day===todayName ? ' ★' : ''}</option>
          ))}
        </select>

        <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)} style={S.sel}>
          <option value="">{t('allGroups')}</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>

        <select value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)} style={S.sel}>
          <option value="">{t('allTeachers')}</option>
          {teachers.map(tc => <option key={tc} value={tc}>{tc}</option>)}
        </select>

        <div style={S.divider} />

        {/* Admin actions — inline, same row */}
        {isAuthenticated && (<>
          <button onClick={handleAddGroup}    style={S.btn('var(--primary)')}>＋ {t('addGroup')}</button>
          <button onClick={handleExport}      style={S.btn('#059669')}>📊</button>
          <button onClick={handleImportClick} style={S.btn('#0891b2')}>📂</button>
          <button onClick={handleClearAll}    style={S.btn('var(--error)')}>🗑</button>
          <button onClick={handleShare}       style={S.btn('#6366f1')}>🔗{shareToast}</button>
          <div style={S.divider} />
        </>)}

        {/* Guest book button */}
        {!isAuthenticated && (
          <button onClick={() => setShowBooking(true)} style={S.btn('var(--primary)')}>
            🏫 {t('bookLab') || 'Book'}
          </button>
        )}

        {/* Spacer pushes right-side items to the end */}
        <div style={{ flex:1, minWidth:8 }} />

        {/* Language */}
        {LANGUAGE_OPTIONS.map(opt => (
          <button key={opt.code} onClick={() => changeLang(opt.code)}
            style={{ ...S.btn(lang===opt.code ? 'var(--primary)' : 'transparent', lang===opt.code ? '#fff' : 'var(--text-secondary)'),
              border:`1px solid ${lang===opt.code ? 'var(--primary)' : 'var(--border)'}`,
              padding:'3px 6px', fontSize:'0.64rem' }}>
            {opt.flag} {opt.code.toUpperCase()}
          </button>
        ))}

        {/* Theme toggle */}
        <button onClick={() => setTheme(th => th==='light' ? 'dark' : 'light')}
          style={{ ...S.btn('transparent', 'var(--text-primary)'), border:'1px solid var(--border)', fontSize:'0.85rem', padding:'3px 7px' }}>
          {theme==='light' ? '🌙' : '☀️'}
        </button>

        <div style={S.divider} />

        {/* User / login */}
        {isAuthenticated ? (<>
          <span style={{ fontSize:'0.68rem', color:'var(--text-secondary)', whiteSpace:'nowrap', flexShrink:0 }}>
            👤 {user?.username}
          </span>
          <button onClick={() => { logout(); setActiveView('schedule'); }}
            style={{ ...S.btn('transparent', 'var(--text-secondary)'), border:'1px solid var(--border)', fontSize:'0.65rem' }}>
            {t('logout')}
          </button>
        </>) : (
          <button onClick={() => setShowLoginModal(true)} style={S.btn('var(--primary)')}>
            🔐 {t('loginBtn') || 'Login'}
          </button>
        )}
      </div>

      {error && (
        <div className="error-banner">
          ⚠️ {error}. <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      {/* ── MAIN LAYOUT ── */}
      <div style={{ display:'flex' }}>

        {/* Vertical icon nav */}
        <div className="app-sidebar" style={{ width:54, flexShrink:0, background:'var(--bg-card)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', alignItems:'center', padding:'8px 0', gap:4, position:'sticky', top:40, height:'calc(100vh - 40px)', overflowY:'auto' }}>

          <button onClick={() => setActiveView('schedule')} title="Schedule" style={S.iconBtn(activeView==='schedule')}>
            <TabIcon icon={iconSchedule} label="Schedule" active={activeView==='schedule'} />
            <span style={S.iconLabel}>Schedule</span>
          </button>

          <div style={{ width:32, height:1, background:'var(--border)', margin:'2px 0' }} />

          {navTabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveView(tab.id)} title={tab.label} style={S.iconBtn(activeView===tab.id)}>
              <TabIcon icon={tab.icon} label={tab.label} active={activeView===tab.id} />
              <span style={S.iconLabel}>{tab.label}</span>
              {tab.badge > 0 && (
                <span style={{ position:'absolute', top:2, right:2, background:'#ef4444', color:'#fff', fontSize:'0.48rem', fontWeight:800, borderRadius:10, padding:'1px 3px', minWidth:12, textAlign:'center', lineHeight:1.4 }}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="app-content" style={{ flex:1, minWidth:0, padding:'8px 16px' }}>
          {activeView === 'schedule' && (
            <>
              <EmptyRoomPanel allRooms={allRooms} schedule={schedule} days={days} timeSlots={timeSlots} selectedRoom={selectedRoom} setSelectedRoom={setSelectedRoom} />
              <ScheduleTable
                selectedDay={selectedDay} selectedTeacher={selectedTeacher}
                selectedGroup={selectedGroup} selectedRoom={selectedRoom}
                onEditClass={isAuthenticated ? handleEditClass : undefined}
                onDeleteGroup={isAuthenticated ? handleDeleteGroup : undefined}
                bookings={activeBookings}
                onGuestBookCell={(group, day, time) => setGuestBookCell({ group, day, time })}
              />
            </>
          )}
          {activeView==='mybookings' && <GuestBookingStatus bookings={activeBookings} onRefresh={setActiveBookings} />}
          {activeView==='print'      && <PrintView />}
          {activeView==='dashboard'  && <TeacherDashboard />}
          {activeView==='conflicts'  && <ConflictPage onJumpToCell={handleJumpToCell} />}
          {activeView==='bookings'   && <BookingManagement />}
          {activeView==='autosched'  && <AutoScheduler />}
          {activeView==='exams'      && <ExamSchedule readOnly={!isAuthenticated} showExamsToGuests={showExamsToGuests} setShowExamsToGuests={setShowExamsToGuests} />}
          {activeView==='feedback'   && (isAuthenticated ? <FeedbackDashboard /> : <FeedbackDashboard guestMode={true} schedule={schedule} groups={groups} />)}
          {activeView==='telegram'   && <TeacherTelegramManagement />}
        </div>
      </div>

      {/* ── BOTTOM NAV (mobile only) ── */}
      <nav className="app-bottom-nav">
        <button
          className={`app-bottom-nav-btn ${activeView==='schedule' ? 'active' : ''}`}
          onClick={() => setActiveView('schedule')}
          title="Schedule"
        >
          <TabIcon icon={iconSchedule} label="Schedule" active={activeView==='schedule'} />
          <span className="app-bottom-nav-btn-label">Schedule</span>
        </button>
        {navTabs.map(tab => (
          <button
            key={tab.id}
            className={`app-bottom-nav-btn ${activeView===tab.id ? 'active' : ''}`}
            onClick={() => setActiveView(tab.id)}
            title={tab.label}
          >
            <TabIcon icon={tab.icon} label={tab.label} active={activeView===tab.id} />
            <span className="app-bottom-nav-btn-label">{tab.label}</span>
            {tab.badge > 0 && (
              <span className="app-bottom-nav-badge">{tab.badge}</span>
            )}
          </button>
        ))}
      </nav>

      {!isAuthenticated && (
        <GuestBooking
          isOpen={showBooking || !!guestBookCell}
          prefilledGroup={guestBookCell?.group||''} prefilledDay={guestBookCell?.day||''} prefilledTime={guestBookCell?.time||''}
          onClose={() => { setShowBooking(false); setGuestBookCell(null); }}
          onBooked={() => { setGuestBookCell(null); setShowBooking(false); fetchActiveBookings(); }}
        />
      )}

      <ClassModal isOpen={modalOpen} onClose={handleCloseModal} group={currentCell.group} day={currentCell.day} time={currentCell.time} />

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