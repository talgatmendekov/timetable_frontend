// src/App.js
import React, { useState, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ScheduleProvider, useSchedule } from './context/ScheduleContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';

// ── Components ──────────────────────────────────────────────────────────────
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

// ── Utils ───────────────────────────────────────────────────────────────────
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

  // ── State ─────────────────────────────────────────────────────────────────
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [sidebarTab,     setSidebarTab]     = useState(null);
  const [selectedDay,    setSelectedDay]    = useState(getTodayScheduleDay);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedGroup,  setSelectedGroup]  = useState('');
  const [selectedRoom,   setSelectedRoom]   = useState('');
  const [modalOpen,      setModalOpen]      = useState(false);
  const [currentCell,    setCurrentCell]    = useState({ group: null, day: null, time: null });
  const [importing,      setImporting]      = useState(false);
  const [showBooking,    setShowBooking]    = useState(false);
  const [guestBookCell,  setGuestBookCell]  = useState(null);
  const [activeBookings, setActiveBookings] = useState([]);
  const [showExamsToGuests, setShowExamsToGuests] = useState(false);
  const [feedbackCount,  setFeedbackCount]  = useState(0);
  const [shareToast,     setShareToast]     = useState('');

  const fileInputRef = useRef(null);

  // close login modal automatically once authenticated
  React.useEffect(() => {
    if (isAuthenticated) setShowLoginModal(false);
  }, [isAuthenticated]);

  React.useEffect(() => {
    const today = getTodayScheduleDay();
    if (today && days.includes(today)) setSelectedDay(today);
  }, [days]);

  const allRooms = React.useMemo(() => {
    const rooms = new Set();
    Object.values(schedule).forEach(e => { if (e.room) rooms.add(e.room); });
    return [...rooms].sort();
  }, [schedule]);

  const fetchFeedbackCount = React.useCallback(async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('scheduleToken') || '';
      if (!token || !isAuthenticated) return;
      const r = await fetch(`${API_URL}/feedback/stats`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (d.success) setFeedbackCount(d.unread || 0);
    } catch { /* ignore */ }
  }, []);

  React.useEffect(() => { if (isAuthenticated) fetchFeedbackCount(); }, [fetchFeedbackCount, isAuthenticated]);

  const fetchExamSetting = React.useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/settings/show_exams_to_guests`);
      const d = await r.json();
      setShowExamsToGuests(d.value === 'true');
    } catch { /* ignore */ }
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
          if (e.teacher) { const k = e.teacher.toLowerCase(); tMap[k] = (tMap[k]||0)+1; }
          if (e.room)    { const k = e.room.toLowerCase();    rMap[k] = (rMap[k]||0)+1; }
        });
        Object.entries(tMap).forEach(([k,v]) => { if (v>1 && !seen.has(`t-${k}-${day}-${time}`)) { count++; seen.add(`t-${k}-${day}-${time}`); }});
        Object.entries(rMap).forEach(([k,v]) => { if (v>1 && !seen.has(`r-${k}-${day}-${time}`)) { count++; seen.add(`r-${k}-${day}-${time}`); }});
      });
    });
    return count;
  }, [schedule, days, timeSlots]);

  const handleEditClass  = (group, day, time) => { setCurrentCell({ group, day, time }); setModalOpen(true); };
  const handleCloseModal = () => { setModalOpen(false); setCurrentCell({ group: null, day: null, time: null }); };
  const handleJumpToCell = (group, day, time) => {
    setSidebarTab(null);
    setSelectedDay(day); setSelectedGroup(group);
    setTimeout(() => { setCurrentCell({ group, day, time }); setModalOpen(true); }, 150);
  };

  const handleAddGroup = () => { const name = prompt(t('enterGroupName')); if (name?.trim()) addGroup(name.trim()); };
  const handleDeleteGroup = async (g) => { await deleteGroup(g); setActiveBookings(prev => prev.filter(b => b.entity !== g && b.name !== g)); };

  const handleShare = () => {
    const group = selectedGroup || (groups.length > 0 ? groups[0] : '');
    const url = group ? `${PUBLIC_URL}/schedule/${encodeURIComponent(group)}` : `${PUBLIC_URL}/schedule`;
    navigator.clipboard?.writeText(url).then(() => { setShareToast(`✓ Copied`); setTimeout(() => setShareToast(''), 2500); }).catch(() => prompt('Copy:', url));
  };

  const handleExport = async () => {
    try { await exportToExcel(groups, schedule, timeSlots, days, `schedule-${new Date().toISOString().split('T')[0]}.xlsx`); }
    catch (err) { alert(`Export failed: ${err.message}`); }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e?.target?.files?.[0]; if (!file) return;
    setImporting(true);
    try {
      try {
        const parsed = await parseAlatooSchedule(file);
        if (parsed?.length > 0) { const res = await importSchedule(JSON.stringify(parsed)); alert(res?.success ? `✅ Imported ${parsed.length} classes!` : `❌ Import failed: ${res?.error}`); return; }
        throw new Error('No classes found');
      } catch {
        const result = await importFromExcel(file);
        if (result.success) { const res = await importSchedule(JSON.stringify({ groups: result.groups, schedule: result.schedule })); alert(res.success ? `✅ Imported ${result.groups.length} groups.` : `❌ Import failed: ${res.error}`); }
        else { const reader = new FileReader(); reader.onload = ev => { try { const wb = XLSX.read(new Uint8Array(ev.target.result),{type:'array'}); console.log('Excel:',XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1}).slice(0,5)); } catch {} }; reader.readAsArrayBuffer(file); alert('❌ Invalid file format.'); }
      }
    } catch (err) { alert(`❌ Import failed: ${err.message}`); }
    finally { setImporting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleClearAll = () => { if (window.confirm(t('confirmClearAll'))) clearSchedule(); };

  // ── Sidebar tabs ──────────────────────────────────────────────────────────
  const sidebarTabs = [
    ...(!isAuthenticated ? [
      { id: 'mybookings', icon: '📋', label: t('tabMyBookings') || 'My Bookings' },
      ...(showExamsToGuests ? [{ id: 'exams', icon: '🗓', label: t('tabExams') || 'Exams' }] : []),
      { id: 'feedback', icon: '💬', label: t('tabFeedback') || 'Feedback' },
    ] : []),
    ...(isAuthenticated ? [
      { id: 'print',     icon: '🖨️', label: t('tabPrint')     || 'Print'        },
      { id: 'dashboard', icon: '📊', label: t('tabDashboard') || 'Stats'         },
      { id: 'conflicts', icon: '⚠️',  label: t('tabConflicts') || 'Conflicts', badge: conflictCount },
      { id: 'bookings',  icon: '🏫', label: t('tabBookings')  || 'Bookings'      },
      { id: 'autosched', icon: '🤖', label: t('tabAutoSched') || 'Auto Schedule' },
      { id: 'exams',     icon: '🗓', label: t('tabExams')     || 'Exams'         },
      { id: 'feedback',  icon: '💬', label: t('tabFeedback')  || 'Feedback', badge: feedbackCount },
      { id: 'telegram',  icon: '📱', label: t('tabTelegram')  || 'Telegram'      },
    ] : []),
  ];

  // ── Loading screen ────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner">⏳</div>
        <p>Loading...</p>
      </div>
    );
  }

  const sidebarOpen = sidebarTab !== null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app" style={{ padding: '20px', maxWidth: '100%' }}>

      {/* Hidden file input */}
      <input type="file" ref={fileInputRef} accept=".xlsx,.xls" onChange={handleFileChange} style={{ display:'none' }} />

      {/* Loading overlay */}
      {(importing || scheduleLoading) && (
        <div className="import-overlay">
          <div className="import-spinner">
            ⏳ {scheduleLoading ? (t('loadingData') || 'Loading data…') : (t('importing') || 'Importing…')}
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

      {/* ── LOGIN MODAL — renders full Login component in an overlay ── */}
      {showLoginModal && !isAuthenticated && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowLoginModal(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeInOverlay 0.2s ease',
          }}
        >
          {/* ✕ close button floating above the Login card */}
          <div style={{ position: 'relative', width: '100%', maxWidth: 900, maxHeight: '95vh', overflow: 'auto' }}>
            <button
              onClick={() => setShowLoginModal(false)}
              style={{
                position: 'absolute', top: 12, right: 12, zIndex: 1,
                width: 34, height: 34, borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)', border: 'none',
                color: '#fff', fontSize: '1rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(4px)',
              }}
            >✕</button>
            {/* The real Login component — completely unchanged */}
            <Login onViewAsGuest={null} />
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <Header
        selectedDay={selectedDay}           setSelectedDay={setSelectedDay}
        selectedTeacher={selectedTeacher}   setSelectedTeacher={setSelectedTeacher}
        selectedGroup={selectedGroup}       setSelectedGroup={setSelectedGroup}
        onAddGroup={isAuthenticated ? handleAddGroup : undefined}
        onExport={isAuthenticated ? handleExport : undefined}
        onImport={isAuthenticated ? handleImportClick : undefined}
        onClearAll={isAuthenticated ? handleClearAll : undefined}
      />

      {/* ── TOOLBAR: admin/login controls + guest book ── */}
      <div style={{ display:'flex', alignItems:'center', gap:10, margin:'10px 0', flexWrap:'wrap' }}>

        {/* Guest: Book Lab button */}
        {!isAuthenticated && (
          <button onClick={() => setShowBooking(true)} className="btn btn-primary">
            🏫 {t('bookLab') || 'Book a Lab'}
          </button>
        )}

        {/* Admin: share link */}
        {isAuthenticated && (
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--bg-card)', padding:'6px 14px', borderRadius:10, border:'1px solid var(--border)' }}>
            <span style={{ fontSize:'.75rem', color:'#94a3b8', fontWeight:600 }}>🔗</span>
            <span style={{ fontSize:'.75rem', color:'#6366f1', fontFamily:'monospace' }}>
              /schedule{selectedGroup ? `/${selectedGroup}` : ''}
            </span>
            <button onClick={handleShare} style={{ padding:'3px 10px', background:'#6366f1', color:'#fff', border:'none', borderRadius:6, fontSize:'.72rem', fontWeight:700, cursor:'pointer' }}>
              Copy
            </button>
            {shareToast && <span style={{ fontSize:'.72rem', color:'#10b981', fontWeight:700 }}>{shareToast}</span>}
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Admin login button — always visible when not logged in */}
        {!isAuthenticated && (
          <button
            onClick={() => setShowLoginModal(true)}
            className="btn btn-secondary"
            style={{ display:'flex', alignItems:'center', gap:6 }}
          >
            🔐 {t('loginBtn') || 'Admin Login'}
          </button>
        )}

        {/* Logged in: show user badge + logout */}
        {isAuthenticated && (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:'.78rem', color:'var(--text-secondary)', background:'var(--bg-card)', padding:'6px 12px', borderRadius:8, border:'1px solid var(--border)' }}>
              ⚙️ Admin
            </span>
            <button onClick={() => { logout(); setSidebarTab(null); }} className="btn btn-danger" style={{ padding:'6px 14px', fontSize:'.78rem' }}>
              ↩ Logout
            </button>
          </div>
        )}
      </div>

      {/* ── MAIN: schedule + sidebar ── */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:16 }}>

        {/* Schedule — always at the top, always visible */}
        <div style={{ flex:1, minWidth:0 }}>
          <EmptyRoomPanel
            allRooms={allRooms} schedule={schedule}
            days={days} timeSlots={timeSlots}
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
        </div>

        {/* Sidebar icon strip + panel */}
        <div style={{ display:'flex', gap:8, flexShrink:0 }}>

          {/* Icon buttons */}
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {sidebarTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setSidebarTab(prev => prev === tab.id ? null : tab.id)}
                title={tab.label}
                style={{
                  width:46, height:46, borderRadius:12,
                  border: sidebarTab === tab.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: sidebarTab === tab.id ? 'var(--primary)' : 'var(--bg-card)',
                  color: sidebarTab === tab.id ? '#fff' : 'var(--text-secondary)',
                  fontSize:'1.2rem', cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  position:'relative', transition:'all 0.18s', flexShrink:0,
                }}
              >
                {tab.icon}
                {tab.badge > 0 && (
                  <span style={{ position:'absolute', top:2, right:2, background:'#ef4444', color:'#fff', fontSize:'0.55rem', fontWeight:800, borderRadius:10, padding:'1px 4px', minWidth:14, textAlign:'center', lineHeight:1.4 }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Sidebar panel */}
          {sidebarOpen && (
            <div style={{
              width:420, background:'var(--bg-card)', border:'1px solid var(--border)',
              borderRadius:14, display:'flex', flexDirection:'column',
              maxHeight:'calc(100vh - 180px)', overflow:'hidden',
              boxShadow:'0 8px 32px rgba(0,0,0,0.35)',
              animation:'sbIn 0.22s cubic-bezier(0.22,1,0.36,1)',
            }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:'1px solid var(--border)', background:'var(--bg-main)', flexShrink:0 }}>
                <span style={{ fontWeight:700, fontSize:'0.9rem', color:'var(--text-primary)' }}>
                  {sidebarTabs.find(x => x.id === sidebarTab)?.icon}{' '}
                  {sidebarTabs.find(x => x.id === sidebarTab)?.label}
                </span>
                <button onClick={() => setSidebarTab(null)} style={{ background:'transparent', border:'none', color:'var(--text-secondary)', fontSize:'1.1rem', cursor:'pointer', padding:'2px 6px', borderRadius:6 }}>✕</button>
              </div>
              <div style={{ flex:1, overflowY:'auto', padding:16 }}>
                {sidebarTab === 'mybookings' && <GuestBookingStatus bookings={activeBookings} onRefresh={setActiveBookings} />}
                {sidebarTab === 'print'      && <PrintView />}
                {sidebarTab === 'dashboard'  && <TeacherDashboard />}
                {sidebarTab === 'conflicts'  && <ConflictPage onJumpToCell={handleJumpToCell} />}
                {sidebarTab === 'bookings'   && <BookingManagement />}
                {sidebarTab === 'autosched'  && <AutoScheduler />}
                {sidebarTab === 'exams'      && <ExamSchedule readOnly={!isAuthenticated} showExamsToGuests={showExamsToGuests} setShowExamsToGuests={setShowExamsToGuests} />}
                {sidebarTab === 'feedback'   && (isAuthenticated ? <FeedbackDashboard /> : <FeedbackDashboard guestMode={true} schedule={schedule} groups={groups} />)}
                {sidebarTab === 'telegram'   && <TeacherTelegramManagement />}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Guest booking modal */}
      {!isAuthenticated && (
        <GuestBooking
          isOpen={showBooking || !!guestBookCell}
          prefilledGroup={guestBookCell?.group || ''}
          prefilledDay={guestBookCell?.day || ''}
          prefilledTime={guestBookCell?.time || ''}
          onClose={() => { setShowBooking(false); setGuestBookCell(null); }}
          onBooked={() => { setGuestBookCell(null); setShowBooking(false); fetchActiveBookings(); }}
        />
      )}

      {/* Class modal */}
      <ClassModal isOpen={modalOpen} onClose={handleCloseModal} group={currentCell.group} day={currentCell.day} time={currentCell.time} />

      {/* Footer */}
      <footer className="app-author-credit">
        <span className="app-author-logo">🏛</span>
        <span>Developed by <strong>Talgat Mendekov</strong></span>
        <span className="app-author-sep">·</span>
        <span>Alatoo International University</span>
        <span className="app-author-sep">·</span>
        <span>{new Date().getFullYear()}</span>
      </footer>

      <style>{`
        @keyframes sbIn { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }
        @keyframes fadeInOverlay { from { opacity:0; } to { opacity:1; } }
      `}</style>
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