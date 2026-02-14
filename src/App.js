// src/App.js

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ScheduleProvider, useSchedule } from './context/ScheduleContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import Login from './components/Login';
import Header from './components/Header';
import ScheduleTable from './components/ScheduleTable';
import ClassModal from './components/ClassModal';
import './App.css';


// Returns today's name if it's a schedule day (Mon-Sat), otherwise empty string
const getTodayScheduleDay = () => {
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const scheduleDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today = dayNames[new Date().getDay()];
  return scheduleDays.includes(today) ? today : '';
};

const AppContent = () => {
  const { isAuthenticated } = useAuth();
  const { addGroup, clearSchedule, exportSchedule, importSchedule, deleteGroup } = useSchedule();
  const { t } = useLanguage();

  const [guestMode, setGuestMode] = useState(false);
  const [selectedDay, setSelectedDay] = useState(getTodayScheduleDay);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [currentCell, setCurrentCell] = useState({ group: null, day: null, time: null });

  const handleEditClass = (group, day, time) => {
    setCurrentCell({ group, day, time });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setCurrentCell({ group: null, day: null, time: null });
  };

  const handleAddGroup = () => {
    const groupName = prompt(t('enterGroupName'));
    if (groupName && groupName.trim()) {
      addGroup(groupName.trim());
    }
  };

  const handleExport = () => {
    const data = exportSchedule();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `university-schedule-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = importSchedule(event.target.result);
          if (result.success) {
            alert(t('importSuccess'));
          } else {
            alert(`${t('importFailed')} ${result.error}`);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleClearAll = () => {
    if (window.confirm(t('confirmClearAll'))) {
      clearSchedule();
    }
  };

  if (!isAuthenticated && !guestMode) {
    return <Login onViewAsGuest={() => setGuestMode(true)} />;
  }

  return (
    <div className="app">
      <Header
        selectedDay={selectedDay}
        setSelectedDay={setSelectedDay}
        selectedTeacher={selectedTeacher}
        setSelectedTeacher={setSelectedTeacher}
        selectedGroup={selectedGroup}
        setSelectedGroup={setSelectedGroup}
        onAddGroup={handleAddGroup}
        onExport={handleExport}
        onImport={handleImport}
        onClearAll={handleClearAll}
      />

      <ScheduleTable
        selectedDay={selectedDay}
        selectedTeacher={selectedTeacher}
        selectedGroup={selectedGroup}
        onEditClass={handleEditClass}
        onDeleteGroup={deleteGroup}
      />

      <ClassModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        group={currentCell.group}
        day={currentCell.day}
        time={currentCell.time}
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
