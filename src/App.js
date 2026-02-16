// src/App.js

import React, { useState } from 'react';
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
import './App.css';

const getTodayScheduleDay = () => {
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const scheduleDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today = dayNames[new Date().getDay()];
  return scheduleDays.includes(today) ? today : '';
};

const AppContent = () => {
  const { isAuthenticated } = useAuth();
  const { addGroup, clearSchedule, importSchedule, deleteGroup,
          schedule, groups, timeSlots, days } = useSchedule();
  const { t } = useLanguage();

  const [guestMode, setGuestMode]         = useState(false);
  const [activeTab, setActiveTab]         = useState('schedule'); // 'schedule'|'print'|'dashboard'|'conflicts'
  const [selectedDay, setSelectedDay]     = useState(getTodayScheduleDay);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [modalOpen, setModalOpen]         = useState(false);
  const [currentCell, setCurrentCell]     = useState({ group: null, day: null, time: null });
  const [importing, setImporting]         = useState(false);

  // Count conflicts for badge
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
          if (e.teacher) { const k = e.teacher.toLowerCase(); tMap[k] = (tMap[k]||0)+1; }
          if (e.room)    { const k = e.room.toLowerCase();    rMap[k] = (rMap[k]||0)+1; }
        });
        Object.entries(tMap).forEach(([k,v]) => { if (v>1 && !seen.has(`t-${k}-${day}-${time}`)) { count++; seen.add(`t-${k}-${day}-${time}`); }});
        Object.entries(rMap).forEach(([k,v]) => { if (v>1 && !seen.has(`r-${k}-${day}-${time}`)) { count++; seen.add(`r-${k}-${day}-${time}`); }});
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

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.xlsx,.xls';
    input.onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      setImporting(true);
      try {
        const result = await importFromExcel(file);
        if (result.success) {
          importSchedule(JSON.stringify({ groups: result.groups, schedule: result.schedule }));
          alert(`${t('importSuccess')} ${result.groups.length} groups, ${Object.keys(result.schedule).length} classes imported.`);
        } else { alert(`${t('importFailed')} ${result.error}`); }
      } catch (err) { alert(`${t('importFailed')} ${err.error || err.message}`); }
      finally { setImporting(false); }
    };
    input.click();
  };

  const handleClearAll = () => {
    if (window.confirm(t('confirmClearAll'))) clearSchedule();
  };

  if (!isAuthenticated && !guestMode) {
    return <Login onViewAsGuest={() => setGuestMode(true)} />;
  }

  const tabs = [
    { id: 'schedule',  icon: '📅', label: t('tabSchedule')  || 'Schedule' },
    { id: 'print',     icon: '🖨️', label: t('tabPrint')     || 'Print / PDF' },
    { id: 'dashboard', icon: '📊', label: t('tabDashboard') || 'Teacher Stats' },
    { id: 'conflicts', icon: '🔔', label: t('tabConflicts') || 'Conflicts', badge: conflictCount },
  ];

  return (
    <div className="app">
      {importing && (
        <div className="import-overlay">
          <div className="import-spinner">⏳ {t('importing') || 'Importing...'}</div>
        </div>
      )}

      <Header
        selectedDay={selectedDay}        setSelectedDay={setSelectedDay}
        selectedTeacher={selectedTeacher} setSelectedTeacher={setSelectedTeacher}
        selectedGroup={selectedGroup}     setSelectedGroup={setSelectedGroup}
        onAddGroup={handleAddGroup}
        onExport={handleExport}
        onImport={handleImport}
        onClearAll={handleClearAll}
      />

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
              <span className={`tab-badge ${tab.badge > 0 ? 'tab-badge-warn' : ''}`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'schedule' && (
          <ScheduleTable
            selectedDay={selectedDay} selectedTeacher={selectedTeacher}
            selectedGroup={selectedGroup}
            onEditClass={handleEditClass} onDeleteGroup={deleteGroup}
          />
        )}
        {activeTab === 'print'     && <PrintView />}
        {activeTab === 'dashboard' && <TeacherDashboard />}
        {activeTab === 'conflicts' && <ConflictPage onJumpToCell={handleJumpToCell} />}
      </div>

      <ClassModal
        isOpen={modalOpen} onClose={handleCloseModal}
        group={currentCell.group} day={currentCell.day} time={currentCell.time}
      />
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
