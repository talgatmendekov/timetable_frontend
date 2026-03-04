// src/App.js

import React, { useState, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ScheduleProvider, useSchedule } from './context/ScheduleContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import Login from './components/Login';
import Header from './components/Header';
import ScheduleTable from './components/ScheduleTable';
import ClassModal from './components/ClassModal';
import PrintView from './components/PrintView';
import TeacherDashboard from './components/TeacherDashboard';
import ConflictPage from './components/ConflictPage';
import { exportToExcel, importFromExcel } from './utils/excelUtils';
import GuestBooking from './components/GuestBooking';
import { parseAlatooSchedule } from './utils/alatooimport';
import BookingManagement from './components/BookingManagement';
import * as XLSX from 'xlsx';
import TeacherTelegramManagement from './components/TeacherTelegramManagement';
import EmptyRoomPanel from './components/EmptyRoomPanel';
import GuestBookingStatus from './components/GuestBookingStatus';
import './App.css';

const getTodayScheduleDay = () => {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const scheduleDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = dayNames[new Date().getDay()];
  // On weekdays return today, on weekends return Monday
  return scheduleDays.includes(today) ? today : 'Monday';
};

const AppContent = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { addGroup, clearSchedule, importSchedule, deleteGroup,
    schedule, groups, timeSlots, days,
    loading: scheduleLoading, error } = useSchedule();
  const { t } = useLanguage();

  const [guestMode, setGuestMode] = useState(false);
  const [activeTab, setActiveTab] = useState('schedule');
  const [selectedDay, setSelectedDay] = useState(getTodayScheduleDay);

  // Auto-select today when schedule data first loads
  // This fixes the race condition where days array is empty on first render
  React.useEffect(() => {
    const today = getTodayScheduleDay();
    if (today && days.includes(today)) {
      setSelectedDay(today);
    }
  }, [days]);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [currentCell, setCurrentCell] = useState({ group: null, day: null, time: null });
  const [importing, setImporting] = useState(false);
  const [showBooking, setShowBooking]       = useState(false);
  const [selectedRoom, setSelectedRoom]     = useState('');
  const [guestBookCell, setGuestBookCell]   = useState(null); // { group, day, time }
  const [activeBookings, setActiveBookings] = useState([]);

  const fileInputRef = useRef(null);

  // All known rooms from schedule
  const allRooms = React.useMemo(() => {
    const rooms = new Set();
    Object.values(schedule).forEach(e => { if (e.room) rooms.add(e.room); });
    return [...rooms].sort();
  }, [schedule]);

  // Fetch bookings for ALL users - admins see highlights too
  const API_URL = process.env.REACT_APP_API_URL || 'https://timetablebackend-production.up.railway.app/api';
  const fetchActiveBookings = React.useCallback(() => {
    const token = localStorage.getItem('scheduleToken') || '';
    fetch(`${API_URL}/booking-requests`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(d => { if (d.success) setActiveBookings(d.data || []); })
      .catch(() => {});
  }, [API_URL]);

  React.useEffect(() => { fetchActiveBookings(); }, [fetchActiveBookings]);

  // Count all conflicts for badge
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
          if (e.teacher) { const k = e.teacher.toLowerCase(); tMap[k] = (tMap[k] || 0) + 1; }
          if (e.room)    { const k = e.room.toLowerCase();    rMap[k] = (rMap[k] || 0) + 1; }
        });
        Object.entries(tMap).forEach(([k, v]) => {
          if (v > 1 && !seen.has(`t-${k}-${day}-${time}`)) { count++; seen.add(`t-${k}-${day}-${time}`); }
        });
        Object.entries(rMap).forEach(([k, v]) => {
          if (v > 1 && !seen.has(`r-${k}-${day}-${time}`)) { count++; seen.add(`r-${k}-${day}-${time}`); }
        });
      });
    });
    return count;
  }, [schedule, days, timeSlots]);

  const handleEditClass = (group, day, time) => {
    setCurrentCell({ group, day, time });
    setModalOpen(true);
  };

  const handleJumpToCell = (group, day, time) => {
    setActiveTab('schedule');
    setSelectedDay(day);
    setSelectedGroup(group);
    setTimeout(() => {
      setCurrentCell({ group, day, time });
      setModalOpen(true);
    }, 150);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setCurrentCell({ group: null, day: null, time: null });
  };

  const handleAddGroup = () => {
    const groupName = prompt(t('enterGroupName'));
    if (groupName?.trim()) addGroup(groupName.trim());
  };

  const handleExport = async () => {
    try {
      await exportToExcel(groups, schedule, timeSlots, days,
        `university-schedule-${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) { alert(`Export failed: ${err.message}`); }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const debugExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          console.log('📊 Excel file structure:');
          console.log('Sheet names:', workbook.SheetNames);
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          console.log('First 5 rows:', jsonData.slice(0, 5));
          resolve(workbook);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileChange = async (e) => {
    if (!e || !e.target || !e.target.files) {
      console.error('No file selected or event is invalid');
      return;
    }
    const file = e.target.files[0];
    if (!file) {
      console.error('No file selected');
      return;
    }
    console.log('📁 Selected file:', file.name);
    setImporting(true);
    try {
      try {
        console.log('Attempting to parse as Alatoo format...');
        const parsedSchedule = await parseAlatooSchedule(file);
        if (parsedSchedule && parsedSchedule.length > 0) {
          console.log(`✅ Parsed ${parsedSchedule.length} classes from Alatoo format`);
          const result = await importSchedule(JSON.stringify(parsedSchedule));
          if (result && result.success) {
            alert(`✅ Successfully imported ${parsedSchedule.length} classes!`);
          } else {
            alert(`❌ Import failed: ${result?.error || 'Unknown error'}`);
          }
        } else {
          throw new Error('No classes found in file');
        }
      } catch (alatooError) {
        console.log('Alatoo parser failed:', alatooError.message);
        console.log('Trying generic Excel import...');
        const result = await importFromExcel(file);
        if (result.success) {
          const res = await importSchedule(JSON.stringify({
            groups: result.groups,
            schedule: result.schedule
          }));
          if (res.success) {
            alert(`✅ Successfully imported ${result.groups.length} groups, ${Object.keys(result.schedule).length} classes.`);
          } else {
            alert(`❌ Import failed: ${res.error}`);
          }
        } else {
          console.error('Both import methods failed');
          await debugExcelFile(file);
          alert(`❌ Invalid file format. Please check the console for file structure.`);
        }
      }
    } catch (error) {
      console.error('Import error:', error);
      alert(`❌ Import failed: ${error.message}`);
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClearAll = () => {
    if (window.confirm(t('confirmClearAll'))) clearSchedule();
  };

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

  const tabs = [
    { id: 'schedule',  icon: '📅', label: t('tabSchedule')  || 'Schedule' },
    ...(!isAuthenticated ? [
      { id: 'mybookings', icon: '📋', label: 'My Bookings' },
    ] : []),
    ...( isAuthenticated ? [
      { id: 'print',     icon: '🖨️', label: t('tabPrint')     || 'Print / PDF' },
      { id: 'dashboard', icon: '📊', label: t('tabDashboard') || 'Teacher Stats' },
      { id: 'conflicts', icon: '⚠️',  label: t('tabConflicts') || 'Conflicts', badge: conflictCount },
      { id: 'bookings',  icon: '🏫', label: t('tabBookings')  || 'Lab Bookings', badge: 0 },
      { id: 'telegram',  icon: '📱', label: t('tabTelegram')  || 'Telegram' },
    ] : []),
  ];

  return (
    <div className="app">
      {/* Hidden file input for imports */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {(importing || scheduleLoading) && (
        <div className="import-overlay">
          <div className="import-spinner">
            ⏳ {scheduleLoading ? (t('loadingData') || 'Loading data…') : (t('importing') || 'Importing…')}
          </div>
        </div>
      )}

      {error && (
        <div className="error-banner">
          ⚠️ Could not connect to server: {error}.
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      <Header
        selectedDay={selectedDay} setSelectedDay={setSelectedDay}
        selectedTeacher={selectedTeacher} setSelectedTeacher={setSelectedTeacher}
        selectedGroup={selectedGroup} setSelectedGroup={setSelectedGroup}
        onAddGroup={handleAddGroup}
        onExport={handleExport}
        onImport={handleImportClick}
        onClearAll={handleClearAll}
      />

      {!isAuthenticated && (
        <>
          <button onClick={() => setShowBooking(true)} className="btn btn-primary">
            🏫 {t('bookLab') || 'Book a Lab'}
          </button>
          <GuestBooking
            isOpen={showBooking || !!guestBookCell}
            prefilledGroup={guestBookCell?.group || ''}
            prefilledDay={guestBookCell?.day || ''}
            prefilledTime={guestBookCell?.time || ''}
            onClose={() => { setShowBooking(false); setGuestBookCell(null); }}
            onBooked={() => {
              setGuestBookCell(null); setShowBooking(false);
              fetchActiveBookings();
            }}
          />
        </>
      )}

      {/* Tab Bar */}
      <div className="tab-bar">
        {tabs.map(tab => (
          <button key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
            {tab.badge > 0 && (
              <span className="tab-badge tab-badge-warn">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {activeTab === 'schedule' && (
          <>
            {/* Empty Room Stats + Filter */}
            <EmptyRoomPanel
              allRooms={allRooms}
              schedule={schedule}
              days={days}
              timeSlots={timeSlots}
              selectedRoom={selectedRoom}
              setSelectedRoom={setSelectedRoom}
            />
            <ScheduleTable
              selectedDay={selectedDay} selectedTeacher={selectedTeacher}
              selectedGroup={selectedGroup} selectedRoom={selectedRoom}
              onEditClass={handleEditClass} onDeleteGroup={deleteGroup}
              bookings={activeBookings}
              onGuestBookCell={(group, day, time) => setGuestBookCell({ group, day, time })}
            />
          </>
        )}
        {activeTab === 'mybookings' && <GuestBookingStatus bookings={activeBookings} onRefresh={setActiveBookings} />}
        {activeTab === 'print'     && <PrintView />}
        {activeTab === 'dashboard' && <TeacherDashboard />}
        {activeTab === 'conflicts' && <ConflictPage onJumpToCell={handleJumpToCell} />}
        {activeTab === 'bookings'  && <BookingManagement />}
        {activeTab === 'telegram'  && <TeacherTelegramManagement />}
      </div>

      <ClassModal
        isOpen={modalOpen} onClose={handleCloseModal}
        group={currentCell.group} day={currentCell.day} time={currentCell.time}
      />

      {/* ── Author credit footer ── */}
      <footer className="app-author-credit">
        <span className="app-author-logo">🏛</span>
        <span>
          Developed by <strong>Talgat Mendekov</strong>
        </span>
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