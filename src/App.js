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
const API_URL = process.env.REACT_APP_API_URL || 'https://timetablebackend-production.up.railway.app/api';

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
  const { isAuthenticated, loading: authLoading } = useAuth();
  const {
    addGroup, clearSchedule, importSchedule, deleteGroup,
    schedule, groups, timeSlots, days,
    loading: scheduleLoading, error,
  } = useSchedule();
  const { t } = useLanguage();

  // ── State ─────────────────────────────────────────────────────────────────
  const [guestMode,         setGuestMode]         = useState(false);
  const [activeTab,         setActiveTab]          = useState('schedule');
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
      if (!token) return;
      const r = await fetch(`${API_URL}/feedback/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (d.success) setFeedbackCount(d.unread || 0);
    } catch { /* ignore */ }
  }, []);

  React.useEffect(() => { fetchFeedbackCount(); }, [fetchFeedbackCount]);

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
    setActiveTab('schedule');
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
      // 1. Try Alatoo format
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
        // 2. Fallback: generic Excel
        const result = await importFromExcel(file);
        if (result.success) {
          const res = await importSchedule(JSON.stringify({ groups: result.groups, schedule: result.schedule }));
          alert(res.success
            ? `✅ Imported ${result.groups.length} groups, ${Object.keys(result.schedule).length} classes.`
            : `❌ Import failed: ${res.error}`);
        } else {
          // Debug: log file structure to console
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

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'schedule',  icon: '📅', label: t('tabSchedule')  || 'Schedule' },

    // Guest-only
    ...(!isAuthenticated ? [
      { id: 'mybookings', icon: '📋', label: 'My Bookings' },
      ...(showExamsToGuests ? [{ id: 'exams', icon: '🗓', label: 'Exam Schedule' }] : []),
    ] : []),

    // Admin-only
    ...(isAuthenticated ? [
      { id: 'print',     icon: '🖨️', label: t('tabPrint')     || 'Print / PDF'  },
      { id: 'dashboard', icon: '📊', label: t('tabDashboard') || 'Teacher Stats' },
      { id: 'conflicts', icon: '⚠️',  label: t('tabConflicts') || 'Conflicts',    badge: conflictCount },
      { id: 'bookings',  icon: '🏫', label: t('tabBookings')  || 'Lab Bookings' },
      { id: 'autosched', icon: '🤖', label: 'Auto Schedule'                      },
      { id: 'exams',     icon: '🗓', label: 'Exam Schedule'                      },
      { id: 'feedback',  icon: '💬', label: 'Feedback', badge: feedbackCount  },
      { id: 'telegram',  icon: '📱', label: t('tabTelegram')  || 'Telegram'      },
    ] : []),
  ];

  // ── Render ────────────────────────────────────────────────────────────────
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

      {/* Header */}
      <Header
        selectedDay={selectedDay}           setSelectedDay={setSelectedDay}
        selectedTeacher={selectedTeacher}   setSelectedTeacher={setSelectedTeacher}
        selectedGroup={selectedGroup}       setSelectedGroup={setSelectedGroup}
        onAddGroup={handleAddGroup}
        onExport={handleExport}
        onImport={handleImportClick}
        onClearAll={handleClearAll}
      />

      {/* Guest booking */}
      {!isAuthenticated && (
        <>
          <button onClick={() => setShowBooking(true)} className="btn btn-primary">
            🏫 {t('bookLab') || 'Book a Lab'}
          </button>
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

      {/* Tab bar */}
      <div className="tab-bar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
            {tab.badge > 0 && <span className="tab-badge tab-badge-warn">{tab.badge}</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="tab-content">

        {/* 📅 Schedule */}
        {activeTab === 'schedule' && (
          <>
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
          </>
        )}

        {/* 📋 Guest: My Bookings */}
        {activeTab === 'mybookings' && (
          <GuestBookingStatus bookings={activeBookings} onRefresh={setActiveBookings} />
        )}

        {/* 🖨️ Print / PDF */}
        {activeTab === 'print'     && <PrintView />}

        {/* 📊 Teacher Stats */}
        {activeTab === 'dashboard' && <TeacherDashboard />}

        {/* ⚠️ Conflicts */}
        {activeTab === 'conflicts' && <ConflictPage onJumpToCell={handleJumpToCell} />}

        {/* 🏫 Lab Bookings */}
        {activeTab === 'bookings'  && <BookingManagement />}

        {/* 🤖 Auto Schedule Generator */}
        {activeTab === 'autosched' && <AutoScheduler />}

        {/* 🗓 Exam Schedule (admin full / guest read-only) */}
        {activeTab === 'exams' && (
          <ExamSchedule
            readOnly={!isAuthenticated}
            showExamsToGuests={showExamsToGuests}
            setShowExamsToGuests={setShowExamsToGuests}
          />
        )}

        {/* 💬 Feedback */}
        {activeTab === 'feedback'  && <FeedbackDashboard />}

        {/* 📱 Telegram */}
        {activeTab === 'telegram'  && <TeacherTelegramManagement />}

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