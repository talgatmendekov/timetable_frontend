// src/App.js
import React, { useState, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ScheduleProvider, useSchedule } from './context/ScheduleContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';

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
// Set light mode as default on first visit
if (!localStorage.getItem('scheduleTheme')) {
  localStorage.setItem('scheduleTheme', 'light');
  document.body.setAttribute('data-theme', 'light');
}

const AppContent = () => {
  const { isAuthenticated, loading: authLoading, logout } = useAuth();
  const {
    addGroup, clearSchedule, importSchedule, deleteGroup,
    schedule, groups, timeSlots, days,
    loading: scheduleLoading, error,
  } = useSchedule();
  const { t } = useLanguage();

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

  const fileInputRef = useRef(null);

  React.useEffect(() => { if (isAuthenticated) setShowLoginModal(false); }, [isAuthenticated]);
  React.useEffect(() => {
    const today = getTodayScheduleDay();
    if (today && days.includes(today)) setSelectedDay(today);
  }, [days]);

  const allRooms = React.useMemo(() => {
    const r = new Set();
    Object.values(schedule).forEach(e => { if (e.room) r.add(e.room); });
    return [...r].sort();
  }, [schedule]);

  const fetchFeedbackCount = React.useCallback(async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('scheduleToken') || '';
      if (!token || !isAuthenticated) return;
      const r = await fetch(`${API_URL}/feedback/stats`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (d.success) setFeedbackCount(d.unread || 0);
    } catch {}
  }, []);
  React.useEffect(() => { if (isAuthenticated) fetchFeedbackCount(); }, [fetchFeedbackCount, isAuthenticated]);

  const fetchExamSetting = React.useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/settings/show_exams_to_guests`);
      const d = await r.json();
      setShowExamsToGuests(d.value === 'true');
    } catch {}
  }, []);
  React.useEffect(() => { fetchExamSetting(); }, [fetchExamSetting]);

  const fetchActiveBookings = React.useCallback(() => {
    const token = localStorage.getItem('scheduleToken') || '';
    fetch(`${API_URL}/booking-requests`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.json())
      .then(d => { if (d.success) setActiveBookings(d.data || []); })
      .catch(() => {});
  }, []);
  React.useEffect(() => { fetchActiveBookings(); }, [fetchActiveBookings]);

  const conflictCount = React.useMemo(() => {
    const entries = Object.values(schedule);
    let count = 0; const seen = new Set();
    days.forEach(day => {
      timeSlots.forEach(time => {
        const slot = entries.filter(e => e.day === day && e.time === time);
        if (slot.length < 2) return;
        const tMap = {}, rMap = {};
        slot.forEach(e => {
          if (e.teacher) { const k = e.teacher.toLowerCase(); tMap[k]=(tMap[k]||0)+1; }
          if (e.room)    { const k = e.room.toLowerCase();    rMap[k]=(rMap[k]||0)+1; }
        });
        Object.entries(tMap).forEach(([k,v])=>{ if(v>1&&!seen.has(`t-${k}-${day}-${time}`)){count++;seen.add(`t-${k}-${day}-${time}`);}});
        Object.entries(rMap).forEach(([k,v])=>{ if(v>1&&!seen.has(`r-${k}-${day}-${time}`)){count++;seen.add(`r-${k}-${day}-${time}`);}});
      });
    });
    return count;
  }, [schedule, days, timeSlots]);

  const handleEditClass  = (group, day, time) => { setCurrentCell({ group, day, time }); setModalOpen(true); };
  const handleCloseModal = () => { setModalOpen(false); setCurrentCell({ group:null, day:null, time:null }); };
  const handleJumpToCell = (group, day, time) => {
    setActiveView('schedule'); setSelectedDay(day); setSelectedGroup(group);
    setTimeout(() => { setCurrentCell({ group, day, time }); setModalOpen(true); }, 150);
  };
  const handleAddGroup    = () => { const n = prompt(t('enterGroupName')); if (n?.trim()) addGroup(n.trim()); };
  const handleDeleteGroup = async (g) => { await deleteGroup(g); setActiveBookings(prev => prev.filter(b => b.entity!==g && b.name!==g)); };
  const handleShare = () => {
    const group = selectedGroup || (groups.length > 0 ? groups[0] : '');
    const url = group ? `${PUBLIC_URL}/schedule/${encodeURIComponent(group)}` : `${PUBLIC_URL}/schedule`;
    navigator.clipboard?.writeText(url)
      .then(() => { setShareToast('✓ Copied'); setTimeout(() => setShareToast(''), 2500); })
      .catch(() => prompt('Copy:', url));
  };
  const handleExport = async () => {
    try { await exportToExcel(groups, schedule, timeSlots, days, `schedule-${new Date().toISOString().split('T')[0]}.xlsx`); }
    catch (err) { alert(`Export failed: ${err.message}`); }
  };
  const handleImportClick = () => fileInputRef.current?.click();
  const handleFileChange  = async (e) => {
    const file = e?.target?.files?.[0]; if (!file) return; setImporting(true);
    try {
      try {
        const parsed = await parseAlatooSchedule(file);
        if (parsed?.length > 0) { const res = await importSchedule(JSON.stringify(parsed)); alert(res?.success ? `✅ Imported ${parsed.length} classes!` : `❌ ${res?.error}`); return; }
        throw new Error();
      } catch {
        const result = await importFromExcel(file);
        if (result.success) { const res = await importSchedule(JSON.stringify({ groups: result.groups, schedule: result.schedule })); alert(res.success ? `✅ Imported ${result.groups.length} groups.` : `❌ ${res.error}`); }
        else {
          const reader = new FileReader();
          reader.onload = ev => { try { const wb = XLSX.read(new Uint8Array(ev.target.result),{type:'array'}); console.log('Excel:', XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1}).slice(0,5)); } catch {} };
          reader.readAsArrayBuffer(file);
          alert('❌ Invalid file format.');
        }
      }
    } catch (err) { alert(`❌ ${err.message}`); }
    finally { setImporting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };
  const handleClearAll = () => { if (window.confirm(t('confirmClearAll'))) clearSchedule(); };

  const navTabs = [
    { id:'schedule',   icon:'📅', label: t('tabSchedule')||'Schedule' },
    ...(!isAuthenticated ? [
      { id:'mybookings', icon:'📋', label: t('tabMyBookings')||'My Bookings' },
      ...(showExamsToGuests ? [{ id:'exams', icon:'🗓', label: t('tabExams')||'Exams' }] : []),
      { id:'feedback',   icon:'💬', label: t('tabFeedback')||'Feedback' },
    ] : []),
    ...(isAuthenticated ? [
      { id:'print',     icon:'🖨️', label: t('tabPrint')||'Print'            },
      { id:'dashboard', icon:'📊', label: t('tabDashboard')||'Stats'         },
      { id:'conflicts', icon:'⚠️',  label: t('tabConflicts')||'Conflicts', badge: conflictCount },
      { id:'bookings',  icon:'🏫', label: t('tabBookings')||'Bookings'       },
      { id:'autosched', icon:'🤖', label: t('tabAutoSched')||'Auto Schedule' },
      { id:'exams',     icon:'🗓', label: t('tabExams')||'Exams'             },
      { id:'feedback',  icon:'💬', label: t('tabFeedback')||'Feedback', badge: feedbackCount },
      { id:'telegram',  icon:'📱', label: t('tabTelegram')||'Telegram'       },
    ] : []),
  ];

  if (authLoading) return (
    <div className="app-loading">
      <div className="app-loading-spinner">⏳</div>
      <p>Loading...</p>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app" style={{ padding:0 }}>

      <input type="file" ref={fileInputRef} accept=".xlsx,.xls" onChange={handleFileChange} style={{ display:'none' }} />

      {(importing || scheduleLoading) && (
        <div className="import-overlay">
          <div className="import-spinner">⏳ {scheduleLoading ? (t('loadingData')||'Loading…') : (t('importing')||'Importing…')}</div>
        </div>
      )}

      {/* ── LOGIN MODAL — real Login component, completely untouched ── */}
      {showLoginModal && !isAuthenticated && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowLoginModal(false); }}
          style={{ position:'fixed', inset:0, zIndex:9998, background:'rgba(0,0,0,0.82)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center' }}
        >
          <div style={{ position:'relative', width:'100%', maxWidth:920, maxHeight:'96vh', overflow:'auto' }}>
            <button
              onClick={() => setShowLoginModal(false)}
              style={{ position:'absolute', top:12, right:12, zIndex:10, width:32, height:32, borderRadius:'50%', background:'rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.25)', color:'#fff', fontSize:'1rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
            >✕</button>
            <Login onViewAsGuest={null} />
          </div>
        </div>
      )}

      {error && (
        <div className="error-banner">
          ⚠️ Could not connect to server: {error}.
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          LAYOUT: left icon-nav  +  right content
      ══════════════════════════════════════════════════════════════ */}
      <div style={{ display:'flex', minHeight:'100vh' }}>

        {/* ── LEFT: 58px sticky icon nav ── */}
        <div style={{
          width: 66, flexShrink: 0,
          background: 'var(--bg-card)',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '10px 0',
          gap: 4,
          position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
        }}>
          {navTabs.map((tab, i) => (
            <React.Fragment key={tab.id}>
              {i === 1 && <div style={{ width:32, height:1, background:'var(--border)', margin:'3px 0' }} />}
              <button
                onClick={() => setActiveView(tab.id)}
                title={tab.label}
                style={{
                  width:52, minHeight:52, borderRadius:11, flexShrink:0,
                  border: activeView===tab.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: activeView===tab.id ? 'var(--primary)' : 'transparent',
                  color: activeView===tab.id ? '#fff' : 'var(--text-secondary)',
                  fontSize:'0.95rem', cursor:'pointer',
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                  gap:2, padding:'6px 2px',
                  position:'relative', transition:'all 0.15s',
                }}
              >
                <span style={{ fontSize:'1.1rem', lineHeight:1 }}>{tab.icon}</span>
                <span style={{ fontSize:'0.48rem', fontWeight:700, lineHeight:1, textAlign:'center', letterSpacing:'0.02em', whiteSpace:'nowrap', overflow:'hidden', maxWidth:50, textOverflow:'ellipsis' }}>{tab.label}</span>
                {tab.badge > 0 && (
                  <span style={{ position:'absolute', top:2, right:2, background:'#ef4444', color:'#fff', fontSize:'0.5rem', fontWeight:800, borderRadius:10, padding:'1px 3px', minWidth:13, textAlign:'center', lineHeight:1.4 }}>{tab.badge}</span>
                )}
              </button>
            </React.Fragment>
          ))}

          <div style={{ flex:1 }} />

          {/* Guest: book lab */}
          {!isAuthenticated && (
            <button onClick={() => setShowBooking(true)} title={t('bookLab')||'Book a Lab'}
              style={{ width:52, minHeight:52, borderRadius:11, border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:'1.1rem', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, padding:'6px 2px', transition:'all 0.15s', flexShrink:0 }}
            ><span style={{fontSize:'1.1rem',lineHeight:1}}>🏫</span><span style={{fontSize:'0.48rem',fontWeight:700,marginTop:2}}>{t('bookLab')||'Book Lab'}</span></button>
          )}

          {/* Admin share */}
          {isAuthenticated && (
            <button onClick={handleShare} title="Share public link"
              style={{ width:42, height:42, borderRadius:11, border:'1px solid var(--border)', background:'transparent', color: shareToast ? '#10b981' : 'var(--text-secondary)', fontSize:'1.1rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s', flexShrink:0 }}
            ><span style={{fontSize:'1.1rem',lineHeight:1}}>🔗</span><span style={{fontSize:'0.48rem',fontWeight:700,marginTop:2}}>Share</span></button>
          )}

          {/* Login / Logout */}
          {!isAuthenticated ? (
            <button onClick={() => setShowLoginModal(true)} title="Admin Login"
              style={{ width:52, minHeight:52, borderRadius:11, border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:'1.1rem', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, padding:'6px 2px', transition:'all 0.15s', flexShrink:0 }}
            ><span style={{fontSize:'1.1rem',lineHeight:1}}>🔐</span><span style={{fontSize:'0.48rem',fontWeight:700,marginTop:2}}>Login</span></button>
          ) : (
            <button onClick={() => { logout(); setActiveView('schedule'); }} title={t('logout')||'Logout'}
              style={{ width:52, minHeight:52, borderRadius:11, border:'1px solid var(--border)', background:'transparent', color:'#ef4444', fontSize:'1.1rem', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, padding:'6px 2px', transition:'all 0.15s', flexShrink:0 }}
            ><span style={{fontSize:'1.1rem',lineHeight:1}}>↩</span><span style={{fontSize:'0.48rem',fontWeight:700,marginTop:2}}>Logout</span></button>
          )}

        </div>

        {/* ── RIGHT: full content column ── */}
        <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column' }}>

          {/* Filters always visible — hides the branding top row, shows only controls */}
          <div style={{ padding:'0 20px' }} className="app-filters-only">
              <Header
                selectedDay={selectedDay}            setSelectedDay={setSelectedDay}
                selectedTeacher={selectedTeacher}    setSelectedTeacher={setSelectedTeacher}
                selectedGroup={selectedGroup}         setSelectedGroup={setSelectedGroup}
                onAddGroup={isAuthenticated ? handleAddGroup    : undefined}
                onExport={isAuthenticated  ? handleExport       : undefined}
                onImport={isAuthenticated  ? handleImportClick  : undefined}
                onClearAll={isAuthenticated? handleClearAll     : undefined}
              />
            </div>

          {/* ── CONTENT — schedule or any feature tab ── */}
          <div style={{ flex:1, padding:'12px 20px' }}>

            {activeView === 'schedule' && (
              <>
                <EmptyRoomPanel
                  allRooms={allRooms} schedule={schedule} days={days} timeSlots={timeSlots}
                  selectedRoom={selectedRoom} setSelectedRoom={setSelectedRoom}
                />
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
              </>
            )}

            {activeView === 'mybookings' && <GuestBookingStatus bookings={activeBookings} onRefresh={setActiveBookings} />}
            {activeView === 'print'      && <PrintView />}
            {activeView === 'dashboard'  && <TeacherDashboard />}
            {activeView === 'conflicts'  && <ConflictPage onJumpToCell={handleJumpToCell} />}
            {activeView === 'bookings'   && <BookingManagement />}
            {activeView === 'autosched'  && <AutoScheduler />}
            {activeView === 'exams'      && <ExamSchedule readOnly={!isAuthenticated} showExamsToGuests={showExamsToGuests} setShowExamsToGuests={setShowExamsToGuests} />}
            {activeView === 'feedback'   && (isAuthenticated ? <FeedbackDashboard /> : <FeedbackDashboard guestMode={true} schedule={schedule} groups={groups} />)}
            {activeView === 'telegram'   && <TeacherTelegramManagement />}

          </div>
        </div>
      </div>

      {!isAuthenticated && (
        <GuestBooking
          isOpen={showBooking || !!guestBookCell}
          prefilledGroup={guestBookCell?.group||''} prefilledDay={guestBookCell?.day||''} prefilledTime={guestBookCell?.time||''}
          onClose={() => { setShowBooking(false); setGuestBookCell(null); }}
          onBooked={() => { setGuestBookCell(null); setShowBooking(false); fetchActiveBookings(); }}
        />
      )}

      <style>{`
        @keyframes sbIn { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }
        @keyframes fadeInOverlay { from { opacity:0; } to { opacity:1; } }
        .app-filters-only .header-top { display: none !important; }
        .app-filters-only .header { margin-bottom: 8px; padding: 12px 20px; }
        .app-filters-only .today-banner { margin-top: 8px; }
      `}</style>
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