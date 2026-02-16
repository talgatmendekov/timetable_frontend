// src/components/ConflictPage.js
import React, { useMemo } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { useLanguage } from '../context/LanguageContext';
import './ConflictPage.css';

const ConflictPage = ({ onJumpToCell }) => {
  const { schedule, days, timeSlots } = useSchedule();
  const { t } = useLanguage();

  const conflicts = useMemo(() => {
    const entries = Object.values(schedule);
    const found = [];

    days.forEach(day => {
      timeSlots.forEach(time => {
        const slot = entries.filter(e => e.day === day && e.time === time);
        if (slot.length < 2) return;

        // Teacher conflicts
        const teacherMap = {};
        slot.forEach(e => {
          if (!e.teacher) return;
          const key = e.teacher.toLowerCase();
          if (!teacherMap[key]) teacherMap[key] = [];
          teacherMap[key].push(e);
        });
        Object.values(teacherMap).forEach(group => {
          if (group.length > 1) {
            found.push({
              type: 'teacher',
              day, time,
              value: group[0].teacher,
              entries: group,
              id: `teacher-${day}-${time}-${group[0].teacher}`
            });
          }
        });

        // Room conflicts
        const roomMap = {};
        slot.forEach(e => {
          if (!e.room) return;
          const key = e.room.toLowerCase();
          if (!roomMap[key]) roomMap[key] = [];
          roomMap[key].push(e);
        });
        Object.values(roomMap).forEach(group => {
          if (group.length > 1) {
            found.push({
              type: 'room',
              day, time,
              value: group[0].room,
              entries: group,
              id: `room-${day}-${time}-${group[0].room}`
            });
          }
        });
      });
    });

    return found;
  }, [schedule, days, timeSlots]);

  const teacherConflicts = conflicts.filter(c => c.type === 'teacher');
  const roomConflicts    = conflicts.filter(c => c.type === 'room');

  if (conflicts.length === 0) {
    return (
      <div className="conflict-page">
        <h2 className="conflict-title">🔔 {t('conflictSummary') || 'Conflict Summary'}</h2>
        <div className="no-conflicts">
          <div className="no-conflicts-icon">✅</div>
          <h3>{t('noConflicts') || 'No conflicts found!'}</h3>
          <p>{t('timetableClean') || 'Your timetable is clean. No teacher or room double-bookings detected.'}</p>
        </div>
      </div>
    );
  }

  const ConflictCard = ({ conflict }) => {
    const isTeacher = conflict.type === 'teacher';
    return (
      <div className={`conflict-card ${isTeacher ? 'conflict-card-teacher' : 'conflict-card-room'}`}>
        <div className="conflict-card-header">
          <span className={`conflict-badge ${isTeacher ? 'badge-teacher' : 'badge-room'}`}>
            {isTeacher ? '👨‍🏫 Teacher' : '🚪 Room'}
          </span>
          <span className="conflict-time-pill">
            📅 {t(conflict.day)} · ⏰ {conflict.time}
          </span>
        </div>

        <div className="conflict-value">
          {isTeacher ? '👤' : '🏢'} <strong>{conflict.value}</strong>
          <span className="conflict-clash-label">
            {isTeacher
              ? (t('teacherDoubleBooked') || 'is double-booked')
              : (t('roomDoubleBooked') || 'is double-booked')}
          </span>
        </div>

        <div className="conflict-entries">
          {conflict.entries.map((entry, i) => (
            <div key={i} className="conflict-entry"
              onClick={() => onJumpToCell && onJumpToCell(entry.group, entry.day, entry.time)}
              title={t('clickToJump') || 'Click to jump to this class'}
            >
              <span className="ce-group">{entry.group}</span>
              <span className="ce-course">{entry.course}</span>
              {entry.room && !isTeacher && <span className="ce-detail">🚪 {entry.room}</span>}
              {entry.teacher && isTeacher && <span className="ce-detail">👨‍🏫 {entry.teacher}</span>}
              <span className="ce-jump">→</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="conflict-page">
      <div className="conflict-page-header">
        <h2 className="conflict-title">🔔 {t('conflictSummary') || 'Conflict Summary'}</h2>
        <div className="conflict-stats">
          <div className="stat-chip stat-total">
            <span className="stat-num">{conflicts.length}</span>
            <span className="stat-label">{t('totalConflicts') || 'Total Conflicts'}</span>
          </div>
          {teacherConflicts.length > 0 && (
            <div className="stat-chip stat-teacher">
              <span className="stat-num">{teacherConflicts.length}</span>
              <span className="stat-label">{t('teacherConflicts') || 'Teacher'}</span>
            </div>
          )}
          {roomConflicts.length > 0 && (
            <div className="stat-chip stat-room">
              <span className="stat-num">{roomConflicts.length}</span>
              <span className="stat-label">{t('roomConflicts') || 'Room'}</span>
            </div>
          )}
        </div>
      </div>

      <p className="conflict-subtitle">
        {t('conflictDescription') ||
          'The following conflicts were detected across the entire timetable. Click any entry to jump to it.'}
      </p>

      {/* Teacher conflicts */}
      {teacherConflicts.length > 0 && (
        <div className="conflict-section">
          <h3 className="conflict-section-title">
            👨‍🏫 {t('teacherConflicts') || 'Teacher Conflicts'}
            <span className="section-count">{teacherConflicts.length}</span>
          </h3>
          <div className="conflict-grid">
            {teacherConflicts.map(c => <ConflictCard key={c.id} conflict={c} />)}
          </div>
        </div>
      )}

      {/* Room conflicts */}
      {roomConflicts.length > 0 && (
        <div className="conflict-section">
          <h3 className="conflict-section-title">
            🚪 {t('roomConflicts') || 'Room Conflicts'}
            <span className="section-count">{roomConflicts.length}</span>
          </h3>
          <div className="conflict-grid">
            {roomConflicts.map(c => <ConflictCard key={c.id} conflict={c} />)}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConflictPage;
