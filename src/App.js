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
import OnboardingTour     from './components/OnboardingTour';
import AnnouncementBanner from './components/AnnouncementBanner';

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

const TabIcon = ({ icon, label, active }) => {
  const isEmoji = typeof icon === 'string' && /^(\p{Emoji}|[\u2600-\u27BF])/u.test(icon) && icon.length <= 4;
  if (!isEmoji && icon) {
    const src = (typeof icon === 'object' && icon.default) ? icon.default : icon;
    return (
      <img src={src} alt={label}
        style={{ width:22, height:22, objectFit:'contain', borderRadius:4,
          filter:'none', opacity: active ? 1 : 0.7,
          transform: active ? 'scale(1.1)' : 'scale(1)' }}
        onError={e => { e.target.style.display='none'; }}
      />
    );
  }
  return <span style={{ fontSize:'1.1rem', lineHeight:1 }}>{icon}</span>;
};

// ── Booking Detail Modal — shown when admin clicks an approved booking slot ──
const BookingDetailModal = ({ booking, onClose, onDeleted }) => {
  const [deleting, setDeleting] = useState(false);

  if (!booking) return null;

  const handleDelete = async () => {
    if (!window.confirm('Delete this booking and remove it from the schedule?')) return;
    setDeleting(true);
    try {
      const tk = localStorage.getItem('token') || localStorage.getItem('scheduleToken') || '';
      const res = await fetch(`${API_URL}/booking-requests/${booking.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tk}` },
      });
      const data = await res.json();
      if (data.success) {
        onDeleted(booking);
        onClose();
      } else {
        alert(data.error || 'Failed to delete booking');
      }
    } catch {
      alert('Network error — please try again');
    } finally {
      setDeleting(false);
    }
  };

  const statusColor = booking.status === 'approved' ? '#16a34a'
    : booking.status === 'rejected' ? '#dc2626' : '#ca8a04';
  const statusIcon = booking.status === 'approved' ? '✅'
    : booking.status === 'rejected' ? '❌' : '⏳';

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.55)',
        zIndex:1000, display:'flex', alignItems:'center',
        justifyContent:'center', padding:16,
      }}
    >
      <div style={{
        background:'#fff', borderRadius:16, padding:'24px 24px 20px',
        width:'100%', maxWidth:440,
        boxShadow:'0 20px 60px rgba(0,0,0,0.25)',
        fontFamily:"'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18 }}>
          <div>
            <div style={{ fontSize:'0.72rem', fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>
              Lab Booking
            </div>
            <h2 style={{ margin:0, fontSize:'1.1rem', fontWeight:800, color:'#0f172a' }}>
              {booking.purpose}
            </h2>
          </div>
          <button onClick={onClose} style={{
            background:'none', border:'none', fontSize:'1.4rem',
            cursor:'pointer', color:'#94a3b8', lineHeight:1, padding:4,
          }}>×</button>
        </div>

        {/* Status badge */}
        <div style={{
          display:'inline-flex', alignItems:'center', gap:6,
          background: booking.status === 'approved' ? '#dcfce7' : booking.status === 'rejected' ? '#fee2e2' : '#fef9c3',
          color: statusColor,
          borderRadius:20, padding:'4px 12px', fontSize:'0.8rem', fontWeight:700,
          marginBottom:16,
        }}>
          {statusIcon} {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
        </div>

        {/* Details */}
        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
          {[
            { icon:'👤', label:'Booked by',  value: booking.guest_name || booking.name },
            { icon:'📧', label:'Email',       value: booking.email },
            { icon:'📞', label:'Phone',       value: booking.phone || '—' },
            { icon:'🏢', label:'Entity',      value: booking.entity || '—' },
            { icon:'🗓', label:'Day',         value: booking.day },
            { icon:'⏰', label:'Time',        value: `${booking.start_time} — ${booking.end_time}` },
            { icon:'🚪', label:'Room',        value: booking.room },
          ].map(({ icon, label, value }) => (
            <div key={label} style={{ display:'flex', gap:10, fontSize:'0.85rem' }}>
              <span style={{ width:20, textAlign:'center', flexShrink:0 }}>{icon}</span>
              <span style={{ color:'#94a3b8', fontWeight:600, minWidth:80, flexShrink:0 }}>{label}</span>
              <span style={{ color:'#0f172a', fontWeight:500 }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{
            flex:1, padding:'10px', background:'#f1f5f9',
            border:'1px solid #e2e8f0', borderRadius:10,
            fontSize:'0.9rem', fontWeight:600, cursor:'pointer',
            color:'#475569', fontFamily:'inherit',
          }}>
            Close
          </button>
          <button onClick={handleDelete} disabled={deleting} style={{
            flex:1, padding:'10px',
            background: deleting ? '#94a3b8' : '#ef4444',
            border:'none', borderRadius:10,
            fontSize:'0.9rem', fontWeight:700, cursor: deleting ? 'not-allowed' : 'pointer',
            color:'#fff', fontFamily:'inherit',
          }}>
            {deleting ? '⏳ Deleting...' : '🗑 Delete Booking'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const AppContent = () => {
  const { isAuthenticated, loading: authLoading, logout, user } = useAuth();
  const { addGroup, clearSchedule, importSchedule, deleteClass, deleteGroup, schedule, groups, teachers, timeSlots, days, loading: scheduleLoading, error } = useSchedule();
  const { t, lang, changeLang } = useLanguage();

  const [showLoginModal,    setShowLoginModal]    = useState(false);
  const [activeView,        setActiveView]        = useState('schedule');
  const [selectedDay,       setSelectedDay]       = useState(getTodayScheduleDay);
  const [selectedTeacher,   setSelectedTeacher]   = useState('');
  const [selectedGroup,     setSelectedGroup]     = useState(() => localStorage.getItem('myGroup') || '');
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
  const [showAdminMenu,     setShowAdminMenu]     = useState(false);
  const [showTour,          setShowTour]          = useState(() => !localStorage.getItem('tourDone') && false);
  const [density,           setDensity]           = useState(() => localStorage.getItem('scheduleDensity') || 'comfortable');
  const [theme,             setTheme]             = useState(localStorage.getItem('scheduleTheme') || 'light');
  const [dept,              setDept]              = useState(localStorage.getItem('scheduleDept') || '');

  // ── Booking detail modal state ─────────────────────────────────────────────
  const [bookingDetail,     setBookingDetail]     = useState(null);

  const fileInputRef = useRef(null);
  const todayName = getTodayName();

  React.useEffect(() => { document.body.setAttribute('data-density', density); localStorage.setItem('scheduleDensity', density); }, [density]);
  React.useEffect(() => { document.body.setAttribute('data-theme', theme); localStorage.setItem('scheduleTheme', theme); }, [theme]);
  React.useEffect(() => {
    if (dept) document.body.setAttribute('data-dept', dept);
    else document.body.removeAttribute('data-dept');
    localStorage.setItem('scheduleDept', dept);
  }, [dept]);
  React.useEffect(() => {
    if (isAuthenticated) {
      setShowLoginModal(false);
      if (!localStorage.getItem('tourDone')) setShowTour(true);
    }
  }, [isAuthenticated]);
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
    // Try both token keys — admins use 'token', guests use 'scheduleToken'
    const tk = localStorage.getItem('token') || localStorage.getItem('scheduleToken') || '';
    if (!tk) return;
    fetch(`${API_URL}/booking-requests`, { headers: { Authorization: `Bearer ${tk}` } })
      .then(r => r.json()).then(d => { if (d.success) setActiveBookings(d.data || []); }).catch(() => {});
  }, []);
  React.useEffect(() => {
    fetchActiveBookings();
    // Poll every 30s so badge stays fresh without manual refresh
    const interval = setInterval(fetchActiveBookings, 30000);
    return () => clearInterval(interval);
  }, [fetchActiveBookings]);

  // Count pending bookings for notification badge
  const pendingCount = React.useMemo(() =>
    activeBookings.filter(b => b.status === 'pending').length
  , [activeBookings]);

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

  // ── Smart edit handler — opens BookingDetailModal for bookings, ClassModal for classes ──
  const handleEditClass = (group, day, time) => {
    // Check if this cell has an active booking
    const booking = activeBookings.find(b => {
      const bGroup = (b.entity && b.entity.trim()) ? b.entity.trim() : b.name;
      return bGroup === group && b.day === day && b.start_time === time;
    });

    if (booking) {
      // It's a booking slot — show booking detail modal with delete option
      setBookingDetail(booking);
      return;
    }

    // Regular class — open ClassModal as usual
    setCurrentCell({ group, day, time });
    setModalOpen(true);
  };

  const handleCloseModal  = () => { setModalOpen(false); setCurrentCell({ group:null, day:null, time:null }); };
  const handleJumpToCell  = (group, day, time) => { setActiveView('schedule'); setSelectedDay(day); setSelectedGroup(group); setTimeout(() => { setCurrentCell({ group, day, time }); setModalOpen(true); }, 150); };
  const handleAddGroup    = () => { const n = prompt(t('enterGroupName')); if (n?.trim()) addGroup(n.trim()); };
  const handleDeleteGroup = async (g) => { await deleteGroup(g); setActiveBookings(prev => prev.filter(b => b.entity!==g && b.name!==g)); };

  // Called when booking is deleted from BookingDetailModal
  const handleBookingDeleted = (deletedBooking) => {
    const group = (deletedBooking.entity && deletedBooking.entity.trim())
      ? deletedBooking.entity.trim()
      : deletedBooking.name;
    // Remove from activeBookings state instantly
    setActiveBookings(prev => prev.filter(b => b.id !== deletedBooking.id));
    // Remove the schedule slot
    deleteClass(group, deletedBooking.day, deletedBooking.start_time);
    // Delete the group row too — booking-created groups should vanish with the booking
    deleteGroup(group);
  };

  const handleShare = () => {
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
      { id:'mybookings', icon: iconBooking,  label: t('navMyBookings') || 'My Bookings' },
      ...(showExamsToGuests ? [{ id:'exams', icon: iconExams, label: t('navExams') || 'Exams' }] : []),
      { id:'feedback',   icon: iconFeedback, label: t('navFeedback') || 'Feedback' },
    ] : []),
    ...(isAuthenticated ? [
      { id:'print',     icon: iconSchedule, label: t('navPrint')     || 'Print'                          },
      { id:'dashboard', icon: iconStats,    label: t('navStats')     || 'Stats'                          },
      { id:'conflicts', icon: '⚠️',         label: t('navConflicts') || 'Conflicts', badge: conflictCount },
      { id:'bookings',  icon: iconBooking,  label: t('navBookings')  || 'Bookings',  badge: pendingCount  },
      { id:'autosched', icon: iconAuto,     label: t('navAuto')      || 'Auto'                           },
      { id:'exams',     icon: iconExams,    label: t('navExams')     || 'Exams'                          },
      { id:'feedback',  icon: iconFeedback, label: t('navFeedback')  || 'Feedback',  badge: feedbackCount },
      { id:'telegram',  icon: iconTelegram, label: 'Telegram'                                            },
    ] : []),
  ];

  if (authLoading) return (
    <div className="app-loading"><div className="app-loading-spinner">⏳</div><p>Loading...</p></div>
  );

  const S = {
    bar: {
      display:'flex', alignItems:'center', gap:6,
      background:'var(--bg-card)', borderBottom:'1px solid var(--border)',
      padding:'4px 10px', flexWrap:'nowrap',
      position:'sticky', top:0, zIndex:200,
      overflowX:'auto', overflowY:'hidden',
      minHeight:40,
    },
    divider: { width:1, height:18, background:'var(--border)', flexShrink:0, margin:'0 2px' },
    sel: {
      padding:'3px 6px', borderRadius:6, border:'1px solid var(--border)',
      background:'var(--bg-main)', color:'var(--text-primary)',
      fontSize:'0.72rem', cursor:'pointer', fontFamily:'inherit', outline:'none',
      height:28, flexShrink:0,
    },
    btn: (bg, color='#fff') => ({
      padding:'3px 8px', borderRadius:6, border:'none',
      background:bg, color, fontSize:'0.68rem', fontWeight:700,
      cursor:'pointer', height:28, flexShrink:0, whiteSpace:'nowrap',
      fontFamily:'inherit',
    }),
    iconBtn: (active) => ({
      width:60, minHeight:54, borderRadius:11, flexShrink:0,
      border: active ? '2px solid var(--primary)' : '1px solid var(--border)',
      background: active ? 'var(--primary)' : 'transparent',
      color: active ? '#fff' : 'var(--text-secondary)',
      cursor:'pointer', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:2,
      padding:'5px 3px', position:'relative', transition:'all 0.15s',
      fontSize:'1rem',
    }),
    iconLabel: { fontSize:'0.46rem', fontWeight:700, lineHeight:1.2, textAlign:'center', whiteSpace:'normal', wordBreak:'break-word', maxWidth:56 },
  };

  return (
    <div className="app" style={{ padding:0 }}>
      <input type="file" ref={fileInputRef} accept=".xlsx,.xls" onChange={handleFileChange} style={{ display:'none' }} />
      {importing && (
        <div className="import-overlay">
          <div className="import-spinner">⏳ Importing...</div>
        </div>
      )}
      {scheduleLoading && (
        <div className="skeleton-wrap">
          <div className="skeleton-topbar" />
          <div className="skeleton-body">
            <div className="skeleton-sidebar">
              {[...Array(6)].map((_,i) => <div key={i} className="skeleton-nav-item" />)}
            </div>
            <div className="skeleton-content">
              <div className="skeleton-legend" />
              <div className="skeleton-table">
                <div className="skeleton-header-row">
                  <div className="skeleton-cell skeleton-group-col" />
                  {[...Array(6)].map((_,i) => <div key={i} className="skeleton-cell skeleton-day-col" />)}
                </div>
                {[...Array(8)].map((_,row) => (
                  <div key={row} className="skeleton-row">
                    <div className="skeleton-cell skeleton-group-col" />
                    {[...Array(6)].map((_,i) => (
                      <div key={i} className="skeleton-cell">
                        {Math.random() > 0.6 && <div className="skeleton-block" />}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
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

      {/* ── TOPBAR ── */}
      <div style={S.bar} className="app-topbar">
        <img src={logo} alt="" style={{ height:22, width:22, objectFit:'contain', borderRadius:4, flexShrink:0 }} />
        <span style={{ fontWeight:800, fontSize:'0.75rem', color:'var(--text-primary)', whiteSpace:'nowrap', flexShrink:0 }}>Alatoo</span>
        <div style={S.divider} />
        <select value={selectedDay} onChange={e => setSelectedDay(e.target.value)} style={S.sel}>
          <option value="">{t('allDays')}</option>
          {days.map(day => <option key={day} value={day}>{t(day)}{day===todayName ? ' ★' : ''}</option>)}
        </select>
        <select value={selectedGroup} onChange={e => {
          setSelectedGroup(e.target.value);
          if (e.target.value) localStorage.setItem('myGroup', e.target.value);
          else localStorage.removeItem('myGroup');
        }} style={S.sel}>
          <option value="">{t('allGroups')}</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)} style={S.sel}>
          <option value="">{t('allTeachers')}</option>
          {teachers.map(tc => <option key={tc} value={tc}>{tc}</option>)}
        </select>
        <div style={S.divider} />
        {isAuthenticated && (<>
          <button onClick={handleAddGroup}    style={S.btn('var(--primary)')} className="tb-admin-btn tb-desktop-only">+ {t('addGroup')}</button>
          <button onClick={handleExport}      style={S.btn('#059669')}        className="tb-admin-btn tb-desktop-only">📊 {t('export')}</button>
          <button onClick={handleImportClick} style={S.btn('#0891b2')}        className="tb-admin-btn tb-desktop-only">📂 {t('import')}</button>
          <button onClick={handleClearAll}    style={S.btn('var(--error)')}   className="tb-admin-btn tb-desktop-only">🗑 {t('clearAll')}</button>
          <div className="tb-more-wrap tb-mobile-only" style={{ position:'relative', flexShrink:0 }}>
            <button style={S.btn('var(--bg-hover)', 'var(--text-primary)')} onClick={() => setShowAdminMenu(m => !m)}>⋯</button>
            {showAdminMenu && (
              <>
                <div onClick={() => setShowAdminMenu(false)} style={{ position:'fixed', inset:0, zIndex:499 }} />
                <div style={{ position:'fixed', top:42, right:8, zIndex:500, background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:10, boxShadow:'0 4px 20px rgba(0,0,0,0.2)', display:'flex', flexDirection:'column', minWidth:160, overflow:'hidden' }}>
                  {[
                    { label:`${t('addGroup')}`,    action: handleAddGroup,    bg:'var(--primary)' },
                    { label:`📊 ${t('export')}`,   action: handleExport,      bg:'#059669' },
                    { label:`📂 ${t('import')}`,   action: handleImportClick, bg:'#0891b2' },
                    { label:`🗑 ${t('clearAll')}`, action: handleClearAll,    bg:'var(--error)' },
                    { label:'🎓 Restart Tour',     action: () => { localStorage.removeItem('tourDone'); setShowTour(true); }, bg:'#6366f1' },
                  ].map(item => (
                    <button key={item.label}
                      onClick={() => { item.action(); setShowAdminMenu(false); }}
                      style={{ padding:'12px 16px', background:'transparent', border:'none', borderBottom:'1px solid var(--border)', color:'var(--text-primary)', fontSize:'0.85rem', fontWeight:600, cursor:'pointer', textAlign:'left', fontFamily:'inherit' }}
                      onMouseEnter={e => e.target.style.background='var(--bg-hover)'}
                      onMouseLeave={e => e.target.style.background='transparent'}
                    >{item.label}</button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div style={S.divider} className="tb-desktop-only" />
        </>)}
        {!isAuthenticated && (
          <button onClick={() => setShowBooking(true)} style={S.btn('var(--primary)')}>🏫 {t('bookLab') || 'Book'}</button>
        )}
        <div style={{ flex:1, minWidth:8 }} />
        <select value={dept} onChange={e => setDept(e.target.value)} style={{ ...S.sel, maxWidth:90 }}>
          <option value="">🎨 Theme</option>
          <option value="cs">💻 CS</option>
          <option value="math">📐 Math</option>
          <option value="ie">⚙️ IE</option>
          <option value="ee">⚡ EE</option>
        </select>
        {LANGUAGE_OPTIONS.map(opt => (
          <button key={opt.code} onClick={() => changeLang(opt.code)}
            style={{ ...S.btn(lang===opt.code ? 'var(--primary)' : 'transparent', lang===opt.code ? '#fff' : 'var(--text-secondary)'),
              border:`1px solid ${lang===opt.code ? 'var(--primary)' : 'var(--border)'}`,
              padding:'3px 6px', fontSize:'0.64rem' }}>
            {opt.flag} {opt.code.toUpperCase()}
          </button>
        ))}
        <select value={density} onChange={e => setDensity(e.target.value)} style={{ ...S.sel, maxWidth:100 }}>
          <option value="compact">⬛ Compact</option>
          <option value="comfortable">▪️ Normal</option>
          <option value="spacious">🔲 Spacious</option>
        </select>
        <button onClick={() => setTheme(th => th==='light' ? 'dark' : 'light')}
          style={{ ...S.btn('transparent', 'var(--text-primary)'), border:'1px solid var(--border)', fontSize:'0.85rem', padding:'3px 7px' }}>
          {theme==='light' ? '🌙' : '☀️'}
        </button>
        <div style={S.divider} />
        {isAuthenticated ? (<>
          <span style={{ fontSize:'0.68rem', color:'var(--text-secondary)', whiteSpace:'nowrap', flexShrink:0 }}>👤 {user?.username}</span>
          <button onClick={() => { logout(); setActiveView('schedule'); }}
            style={{ ...S.btn('transparent', 'var(--text-secondary)'), border:'1px solid var(--border)', fontSize:'0.65rem' }}>
            <span className="tb-lbl">{t('logout') || 'Logout'}</span>⏻
          </button>
        </>) : (
          <button onClick={() => setShowLoginModal(true)} style={S.btn('var(--primary)')}>🔐 {t('loginBtn') || 'Login'}</button>
        )}
      </div>

      {error && (
        <div className="error-banner">⚠️ {error}. <button onClick={() => window.location.reload()}>Retry</button></div>
      )}

      {/* ── MAIN LAYOUT ── */}
      <div style={{ display:'flex' }}>
        {/* Vertical icon nav */}
        <div className="app-sidebar" style={{ width:68, flexShrink:0, background:'var(--bg-card)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', alignItems:'center', padding:'8px 0', gap:4, position:'sticky', top:40, height:'calc(100vh - 40px)', overflowY:'auto' }}>
          <button onClick={() => setActiveView('schedule')} title="Schedule" style={S.iconBtn(activeView==='schedule')}>
            <TabIcon icon={iconSchedule} label="Schedule" active={activeView==='schedule'} />
            <span style={S.iconLabel}>{t('navSchedule') || 'Schedule'}</span>
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
              <AnnouncementBanner isAdmin={isAuthenticated} />
              {!isAuthenticated && selectedGroup && (
                <div style={{ display:'flex', alignItems:'center', gap:10, background:'linear-gradient(135deg, var(--primary-light), var(--bg-card))', border:'1px solid var(--primary)', borderRadius:10, padding:'8px 14px', marginBottom:8, flexWrap:'wrap' }}>
                  <span style={{ fontSize:'1.1rem' }}>📌</span>
                  <span style={{ fontWeight:700, color:'var(--text-primary)', fontSize:'0.85rem' }}>My Group: <span style={{ color:'var(--primary)' }}>{selectedGroup}</span></span>
                  <span style={{ fontSize:'0.72rem', color:'var(--text-secondary)' }}>— saved for your next visit</span>
                  <button onClick={() => { setSelectedGroup(''); localStorage.removeItem('myGroup'); }}
                    style={{ marginLeft:'auto', background:'transparent', border:'1px solid var(--border)', borderRadius:6, padding:'2px 8px', fontSize:'0.7rem', cursor:'pointer', color:'var(--text-secondary)', fontFamily:'inherit' }}>✕ Clear</button>
                </div>
              )}
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
        <button className={`app-bottom-nav-btn ${activeView==='schedule' ? 'active' : ''}`} onClick={() => setActiveView('schedule')}>
          <TabIcon icon={iconSchedule} label={t('navSchedule') || 'Schedule'} active={activeView==='schedule'} />
          <span className="app-bottom-nav-btn-label">{t('bnSchedule') || 'Schedule'}</span>
        </button>
        {navTabs.map(tab => (
          <button key={tab.id} className={`app-bottom-nav-btn ${activeView===tab.id ? 'active' : ''}`} onClick={() => setActiveView(tab.id)}>
            <TabIcon icon={tab.icon} label={tab.label} active={activeView===tab.id} />
            <span className="app-bottom-nav-btn-label">{tab.label}</span>
            {tab.badge > 0 && <span className="app-bottom-nav-badge">{tab.badge}</span>}
          </button>
        ))}
        {isAuthenticated ? (
          <button className="app-bottom-nav-btn" onClick={() => { logout(); setActiveView('schedule'); }}>
            <span style={{ fontSize:'1.1rem' }}>⏻</span>
            <span className="app-bottom-nav-btn-label">{t('bnLogout') || 'Logout'}</span>
          </button>
        ) : (
          <button className="app-bottom-nav-btn" onClick={() => setShowLoginModal(true)}>
            <span style={{ fontSize:'1.1rem' }}>🔐</span>
            <span className="app-bottom-nav-btn-label">{t('bnLogin') || 'Login'}</span>
          </button>
        )}
      </nav>

      {/* ── MODALS ── */}
      {!isAuthenticated && (
        <GuestBooking
          isOpen={showBooking || !!guestBookCell}
          prefilledGroup={guestBookCell?.group||''} prefilledDay={guestBookCell?.day||''} prefilledTime={guestBookCell?.time||''}
          onClose={() => { setShowBooking(false); setGuestBookCell(null); }}
          onBooked={() => { setGuestBookCell(null); setShowBooking(false); fetchActiveBookings(); }}
        />
      )}

      {/* Class modal — for regular schedule slots */}
      <ClassModal
        isOpen={modalOpen} onClose={handleCloseModal}
        group={currentCell.group} day={currentCell.day} time={currentCell.time}
      />

      {/* Booking detail modal — for approved booking slots */}
      {bookingDetail && (
        <BookingDetailModal
          booking={bookingDetail}
          onClose={() => setBookingDetail(null)}
          onDeleted={handleBookingDeleted}
        />
      )}

      {showTour && isAuthenticated && (
        <OnboardingTour onFinish={() => setShowTour(false)} />
      )}



      <footer className="app-author-credit">
        <span className="app-author-logo">🏛</span>
        <span>{t('footerDeveloped') || 'Developed by'} <strong>{t('footerDeveloper') || 'Talgat Mendekov'}</strong></span>
        <span className="app-author-sep">·</span>
        <span>{t('footerUniversity') || 'Alatoo International University'}</span>
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