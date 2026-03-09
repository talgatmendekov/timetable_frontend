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

// ── Constants ────────────────────────────────────────────────────────────────
const API_URL    = process.env.REACT_APP_API_URL    || 'https://timetablebackend-production.up.railway.app/api';
const PUBLIC_URL = process.env.REACT_APP_BACKEND_URL || 'https://timetablebackend-production.up.railway.app';

const getTodayScheduleDay = () => {
  const dayNames     = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const scheduleDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today        = dayNames[new Date().getDay()];
  return scheduleDays.includes(today) ? today : 'Monday';
};

// ────────────────────────────────────────────────────────────────────────────
// AppContent
// ────────────────────────────────────────────────────────────────────────────
const AppContent = () => {
  const { isAuthenticated, loading: authLoading, logout } = useAuth();
  const {
    addGroup, clearSchedule, importSchedule, deleteGroup,
    schedule, groups, timeSlots, days,
    loading: scheduleLoading, error,
  } = useSchedule();
  const { t } = useLanguage();

  // ── State ─────────────────────────────────────────────────────────────────
  const [guestMode,         setGuestMode]         = useState(false);
  const [sidebarTab,        setSidebarTab]         = useState(null);   // null = sidebar closed
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

  const fileInputRef = useRef(null);

  // ── Auto-select today ─────────────────────────────────────────────────────
  React.useEffect(() => {
    const today = getTodayScheduleDay();
    if (today && days.includes(today)) setSelectedDay(today);
  }, [days]);

  // ── All rooms from schedule ───────────────────────────────────────────────
  const allRooms = React.useMemo(() => {
    const rooms = new Set();
    Object.values(schedule).forEach(e => { if (e.room) rooms.add(e.room); });
    return [...rooms].sort();
  }, [schedule]);

  // ── Fetch unread feedback badge count ─────────────────────────────────────
  const fetchFeedbackCount = React.useCallback(async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('scheduleToken') || '';
      if (!token || !isAuthenticated) return;
      const r = await fetch(`${API_URL}/feedback/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (d.success) setFeedbackCount(d.unread || 0);
    } catch { /* ignore */ }
  }, []);

  React.useEffect(() => {
    if (isAuthenticated) fetchFeedbackCount();
  }, [fetchFeedbackCount, isAuthenticated]);

  // ── Fetch exam-guest setting ──────────────────────────────────────────────
  const fetchExamSetting = React.useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/settings/show_exams_to_guests`);
      const d = await r.json();
      setShowExamsToGuests(d.value === 'true');
    } catch { /* ignore */ }
  }, []);

  React.useEffect(() => { fetchExamSetting(); }, [fetchExamSetting]);

  // ── Fetch bookings ────────────────────────────────────────────────────────
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

  // ── Conflict count for badge ──────────────────────────────────────────────
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

  // ── Modal handlers ────────────────────────────────────────────────────────
  const handleEditClass  = (group, day, time) => { setCurrentCell({ group, day, time }); setModalOpen(true); };
  const handleCloseModal = () => { setModalOpen(false); setCurrentCell({ group: null, day: null, time: null }); };
  const handleJumpToCell = (group, day, time) => {
    setSidebarTab(null);
    setSelectedDay(day);
    setSelectedGroup(group);
    setTimeout(() => { setCurrentCell({ group, day, time }); setModalOpen(true); }, 150);
  };

  // ── Group handlers ────────────────────────────────────────────────────────
  const handleAddGroup = () => {
    const name = prompt(t('enterGroupName'));
    if (name?.trim()) addGroup(name.trim());
  };

  const handleDeleteGroup = async (groupName) => {
    await deleteGroup(groupName);
    setActiveBookings(prev => prev.filter(b => b.entity !== groupName && b.name !== groupName));
  };

  // ── Share public link ─────────────────────────────────────────────────────
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

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    try {
      await exportToExcel(groups, schedule, timeSlots, days,
        `university-schedule-${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) { alert(`Export failed: ${err.message}`); }
  };

  // ── Import ────────────────────────────────────────────────────────────────
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

  // ── Clear all ─────────────────────────────────────────────────────────────
  const handleClearAll = () => {
    if (window.confirm(t('confirmClearAll'))) clearSchedule();
  };

  // ── Open sidebar tab helper ───────────────────────────────────────────────
  const openSidebar = (tabId) => setSidebarTab(prev => prev === tabId ? null : tabId);

  // ── Auth gates ────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner">⏳</div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated && !guestMode) {
    return <Login onViewAsGuest={() => setGuestMode(true)} />;
  }

  // ── Sidebar tabs definition ───────────────────────────────────────────────
  const sidebarTabs = [
    ...(!isAuthenticated ? [
      { id: 'mybookings', icon: '📋', label: t('tabMyBookings') || 'My Bookings' },
      ...(showExamsToGuests ? [{ id: 'exams', icon: '🗓', label: t('tabExams') || 'Exams' }] : []),
      { id: 'feedback',   icon: '💬', label: t('tabFeedback') || 'Feedback' },
    ] : []),
    ...(isAuthenticated ? [
      { id: 'print',     icon: '🖨️', label: t('tabPrint')     || 'Print'         },
      { id: 'dashboard', icon: '📊', label: t('tabDashboard') || 'Stats'          },
      { id: 'conflicts', icon: '⚠️',  label: t('tabConflicts') || 'Conflicts', badge: conflictCount },
      { id: 'bookings',  icon: '🏫', label: t('tabBookings')  || 'Bookings'       },
      { id: 'autosched', icon: '🤖', label: t('tabAutoSched') || 'Auto Schedule'  },
      { id: 'exams',     icon: '🗓', label: t('tabExams')     || 'Exams'          },
      { id: 'feedback',  icon: '💬', label: t('tabFeedback')  || 'Feedback', badge: feedbackCount },
      { id: 'telegram',  icon: '📱', label: t('tabTelegram')  || 'Telegram'       },
    ] : []),
  ];

  const sidebarOpen = sidebarTab !== null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app" style={{ padding: 0, maxWidth: '100%' }}>

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
        <div className="error-banner" style={{ margin: '0 20px 0' }}>
          ⚠️ Could not connect to server: {error}.
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      {/* ── Header (unchanged) ── */}
      <div style={{ padding: '20px 20px 0' }}>
        <Header
          selectedDay={selectedDay}           setSelectedDay={setSelectedDay}
          selectedTeacher={selectedTeacher}   setSelectedTeacher={setSelectedTeacher}
          selectedGroup={selectedGroup}       setSelectedGroup={setSelectedGroup}
          onAddGroup={handleAddGroup}
          onExport={handleExport}
          onImport={handleImportClick}
          onClearAll={handleClearAll}
        />
      </div>

      {/* ── Share strip (admin only, unchanged) ── */}
      {isAuthenticated && (
        <div style={{ padding:'6px 20px', background:'transparent', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:'.75rem', color:'#94a3b8', fontWeight:600 }}>🔗 Public link:</span>
          <span style={{ fontSize:'.75rem', color:'#6366f1', fontFamily:'monospace' }}>
            /schedule{selectedGroup ? `/${selectedGroup}` : ''}
          </span>
          <button
            onClick={handleShare}
            style={{ padding:'4px 12px', background:'#6366f1', color:'#fff', border:'none', borderRadius:7, fontSize:'.72rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}
          >
            Copy Link
          </button>
          {shareToast && <span style={{ fontSize:'.72rem', color:'#10b981', fontWeight:700 }}>{shareToast}</span>}
        </div>
      )}

      {/* ── Guest booking button (unchanged) ── */}
      {!isAuthenticated && (
        <>
          <div style={{ padding: '0 20px' }}>
            <button onClick={() => setShowBooking(true)} className="btn btn-primary">
              🏫 {t('bookLab') || 'Book a Lab'}
            </button>
          </div>
          <GuestBooking
            isOpen={showBooking || !!guestBookCell}
            prefilledGroup={guestBookCell?.group || ''}
            prefilledDay={guestBookCell?.day   || ''}
            prefilledTime={guestBookCell?.time  || ''}
            onClose={() => { setShowBooking(false); setGuestBookCell(null); }}
            onBooked={() => { setGuestBookCell(null); setShowBooking(false); fetchActiveBookings(); }}
          />
        </>
      )}

      {/* ── MAIN LAYOUT: schedule + sidebar ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', padding: '12px 20px 20px', gap: 16 }}>

        {/* ── LEFT: Schedule always visible ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <EmptyRoomPanel
            allRooms={allRooms}   schedule={schedule}
            days={days}           timeSlots={timeSlots}
            selectedRoom={selectedRoom} setSelectedRoom={setSelectedRoom}
          />
          <ScheduleTable
            selectedDay={selectedDay}
            selectedTeacher={selectedTeacher}
            selectedGroup={selectedGroup}
            selectedRoom={selectedRoom}
            onEditClass={handleEditClass}
            onDeleteGroup={handleDeleteGroup}
            bookings={activeBookings}
            onGuestBookCell={(group, day, time) => setGuestBookCell({ group, day, time })}
          />
        </div>

        {/* ── RIGHT: Sidebar toggle buttons + panel ── */}
        <div style={{ display: 'flex', flexDirection: 'row', gap: 8, flexShrink: 0 }}>

          {/* Icon button column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sidebarTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => openSidebar(tab.id)}
                title={tab.label}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 12,
                  border: sidebarTab === tab.id
                    ? '2px solid var(--primary)'
                    : '1px solid var(--border)',
                  background: sidebarTab === tab.id
                    ? 'var(--primary)'
                    : 'var(--bg-card)',
                  color: sidebarTab === tab.id ? '#fff' : 'var(--text-secondary)',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  transition: 'all 0.18s',
                  flexShrink: 0,
                }}
              >
                {tab.icon}
                {tab.badge > 0 && (
                  <span style={{
                    position: 'absolute', top: 2, right: 2,
                    background: '#ef4444', color: '#fff',
                    fontSize: '0.55rem', fontWeight: 800,
                    borderRadius: 10, padding: '1px 4px',
                    minWidth: 14, textAlign: 'center', lineHeight: 1.4,
                  }}>{tab.badge}</span>
                )}
              </button>
            ))}

            {/* Logout button for admin */}
            {isAuthenticated && (
              <button
                onClick={() => { logout(); setSidebarTab(null); }}
                title="Logout"
                style={{
                  width: 46, height: 46, borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: '#ef4444',
                  fontSize: '1.1rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.18s', marginTop: 8,
                }}
              >
                ↩
              </button>
            )}
          </div>

          {/* Sidebar panel — slides in when a tab is selected */}
          {sidebarOpen && (
            <div style={{
              width: 420,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              display: 'flex',
              flexDirection: 'column',
              maxHeight: 'calc(100vh - 160px)',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              animation: 'sbIn 0.22s cubic-bezier(0.22,1,0.36,1)',
            }}>
              {/* Sidebar header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderBottom: '1px solid var(--border)',
                background: 'var(--bg-main)', flexShrink: 0,
              }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  {sidebarTabs.find(t => t.id === sidebarTab)?.icon}{' '}
                  {sidebarTabs.find(t => t.id === sidebarTab)?.label}
                </span>
                <button
                  onClick={() => setSidebarTab(null)}
                  style={{
                    background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                    fontSize: '1.1rem', cursor: 'pointer', lineHeight: 1,
                    padding: '2px 6px', borderRadius: 6,
                  }}
                >✕</button>
              </div>

              {/* Sidebar content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                {sidebarTab === 'mybookings' && <GuestBookingStatus bookings={activeBookings} onRefresh={setActiveBookings} />}
                {sidebarTab === 'print'      && <PrintView />}
                {sidebarTab === 'dashboard'  && <TeacherDashboard />}
                {sidebarTab === 'conflicts'  && <ConflictPage onJumpToCell={handleJumpToCell} />}
                {sidebarTab === 'bookings'   && <BookingManagement />}
                {sidebarTab === 'autosched'  && <AutoScheduler />}
                {sidebarTab === 'exams'      && (
                  <ExamSchedule
                    readOnly={!isAuthenticated}
                    showExamsToGuests={showExamsToGuests}
                    setShowExamsToGuests={setShowExamsToGuests}
                  />
                )}
                {sidebarTab === 'feedback'   && (
                  isAuthenticated
                    ? <FeedbackDashboard />
                    : <FeedbackDashboard guestMode={true} schedule={schedule} groups={groups} />
                )}
                {sidebarTab === 'telegram'   && <TeacherTelegramManagement />}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Class modal */}
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

      {/* Sidebar animation */}
      <style>{`
        @keyframes sbIn {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
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