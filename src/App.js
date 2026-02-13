// src/App.js

import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ScheduleProvider, useSchedule } from './context/ScheduleContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './components/Login';
import Header from './components/Header';
import ScheduleTable from './components/ScheduleTable';
import ClassModal from './components/ClassModal';
import './App.css';
import './themes.css';

const AppContent = () => {
  const { isAuthenticated } = useAuth();
  const { addGroup, clearSchedule, exportSchedule, importSchedule, deleteGroup } = useSchedule();
  
  const [guestMode, setGuestMode] = useState(false);
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [currentCell, setCurrentCell] = useState({ group: null, day: null, time: null });

  const { loading: authLoading } = useAuth();
  const { loading: scheduleLoading } = useSchedule();

  if (authLoading || scheduleLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.5rem'
      }}>
        Loading...
      </div>
    );
  }

  const handleEditClass = (group, day, time) => {
    setCurrentCell({ group, day, time });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setCurrentCell({ group: null, day: null, time: null });
  };

  const handleAddGroup = () => {
    const groupName = prompt('Enter new group name (e.g., COMSE-25):');
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
            alert('Schedule imported successfully!');
          } else {
            alert(`Import failed: ${result.error}`);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear the entire schedule? This action cannot be undone.')) {
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
        onAddGroup={handleAddGroup}
        onExport={handleExport}
        onImport={handleImport}
        onClearAll={handleClearAll}
      />

      <ScheduleTable
        selectedDay={selectedDay}
        selectedTeacher={selectedTeacher}
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
     <ThemeProvider>
      <AuthProvider>
        <ScheduleProvider>
          <AppContent />
        </ScheduleProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
