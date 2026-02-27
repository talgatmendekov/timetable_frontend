// src/components/ScheduleTable.js - FIXED with colSpan + normalised teacher filter
import React, { useState, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSchedule } from '../context/ScheduleContext';
import { useLanguage } from '../context/LanguageContext';
import { SUBJECT_TYPES, SUBJECT_TYPE_LABELS } from '../data/i18n';
import { normalizeTeacherName } from '../context/ScheduleContext';
import './ScheduleTable.css';

const getTodayName = () => {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  return days[new Date().getDay()];
};

const getTypeStyle = (subjectType) => {
  return SUBJECT_TYPES.find(s => s.value === subjectType) || SUBJECT_TYPES[0];
};

const ScheduleTable = ({ selectedDay, selectedTeacher, selectedGroup, onEditClass, onDeleteGroup }) => {
  const { isAuthenticated } = useAuth();
  const { groups, timeSlots, days, schedule, moveClass } = useSchedule();
  const { t, lang } = useLanguage();

  const todayName = getTodayName();
  const daysToShow = selectedDay ? [selectedDay] : days;
  const groupsToShow = selectedGroup ? groups.filter(g => g === selectedGroup) : groups;
  const typeLabels = SUBJECT_TYPE_LABELS[lang] || SUBJECT_TYPE_LABELS.en;

  // Pre-normalise the selected teacher once for the whole render pass
  const normSelectedTeacher = useMemo(
    () => selectedTeacher ? normalizeTeacherName(selectedTeacher) : '',
    [selectedTeacher]
  );

  const [dragSource, setDragSource] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const dragNode = useRef(null);

  // Build skip map - cells that are continuation of multi-slot classes
  const cellsToSkipGlobal = useMemo(() => {
    const skipSet = new Set();
    Object.values(schedule).forEach(classData => {
      if (classData.duration && classData.duration > 1) {
        const timeIdx = timeSlots.indexOf(classData.time);
        if (timeIdx !== -1) {
          for (let i = 1; i < classData.duration; i++) {
            if (timeIdx + i < timeSlots.length) {
              skipSet.add(`${classData.group}-${classData.day}-${timeSlots[timeIdx + i]}`);
            }
          }
        }
      }
    });
    return skipSet;
  }, [schedule, timeSlots]);

  const getClass = (group, day, time) => schedule[`${group}-${day}-${time}`] || null;

  // ── KEY FIX: compare via normalised names ─────────────────────────────────
  // The dropdown shows "Dr. X" (normalised) but the DB may store "Dr. X B110 LAB".
  // Without normalisation the filter would never match and show empty results.
  const shouldShowCell = (classData) => {
    if (!classData) return true;
    if (normSelectedTeacher &&
        normalizeTeacherName(classData.teacher) !== normSelectedTeacher) return false;
    return true;
  };

  const getCellConflicts = (group, day, time, classData) => {
    if (!classData) return [];
    const conflicts = [];
    Object.values(schedule).forEach(entry => {
      if (entry.group === group || entry.day !== day || entry.time !== time) return;
      if (classData.teacher && entry.teacher?.toLowerCase() === classData.teacher.toLowerCase())
        conflicts.push('teacher');
      if (classData.room && entry.room?.toLowerCase() === classData.room.toLowerCase())
        conflicts.push('room');
    });
    return [...new Set(conflicts)];
  };

  const handleDragStart = (e, group, day, time) => {
    setDragSource({ group, day, time });
    dragNode.current = e.target;
    setTimeout(() => { if (dragNode.current) dragNode.current.style.opacity = '0.4'; }, 0);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    if (dragNode.current) dragNode.current.style.opacity = '1';
    setDragSource(null);
    setDragOver(null);
    dragNode.current = null;
  };

  const handleDragOver = (e, group, day, time) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!dragOver || dragOver.group !== group || dragOver.day !== day || dragOver.time !== time) {
      setDragOver({ group, day, time });
    }
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null);
  };

  const handleDrop = (e, toGroup, toDay, toTime) => {
    e.preventDefault();
    if (!dragSource) return;
    const { group: fromGroup, day: fromDay, time: fromTime } = dragSource;
    if (fromGroup === toGroup && fromDay === toDay && fromTime === toTime) { handleDragEnd(); return; }
    moveClass(fromGroup, fromDay, fromTime, toGroup, toDay, toTime);
    handleDragEnd();
  };

  const Legend = () => (
    <div className="type-legend">
      {SUBJECT_TYPES.map(type => (
        <div key={type.value} className="legend-item">
          <span className="legend-dot" style={{ background: type.color }} />
          <span className="legend-label">{type.icon} {typeLabels[type.value]}</span>
        </div>
      ))}
      {isAuthenticated && <div className="legend-item legend-drag-hint">↔ {t('dragHint')}</div>}
    </div>
  );

  return (
    <div className="schedule-container">
      <Legend />
      <div className="table-wrapper">
        <table className="schedule-table">
          <thead>
            <tr>
              <th className="group-header">
                {t('groupTime')}{!isAuthenticated && <div className="lock-icon">🔒</div>}
              </th>
              {daysToShow.map(day => (
                <th key={day} className={`day-header ${day === todayName ? 'today-col' : ''}`} colSpan={timeSlots.length}>
                  {t(day)}{day === todayName && <span className="today-badge"> ★</span>}
                </th>
              ))}
            </tr>
            <tr>
              <th className="group-header" />
              {daysToShow.map(day => timeSlots.map(time => (
                <th key={`${day}-${time}`} className={`time-header ${day === todayName ? 'today-time' : ''}`}>{time}</th>
              )))}
            </tr>
          </thead>
          <tbody>
            {groupsToShow.map(group => (
              <tr key={group}>
                <td className="group-cell">
                  <div className="group-cell-content">
                    <span className="group-name">{group}</span>
                    {isAuthenticated && (
                      <button className="delete-group-btn" onClick={() => {
                        if (window.confirm(t('confirmDeleteGroup', { group }))) onDeleteGroup(group);
                      }}>×</button>
                    )}
                  </div>
                </td>
                {daysToShow.map(day => timeSlots.map(time => {
                  const cellKey = `${group}-${day}-${time}`;
                  if (cellsToSkipGlobal.has(cellKey)) return null;

                  const classData = getClass(group, day, time);
                  const show = shouldShowCell(classData);
                  const isToday = day === todayName;
                  const conflicts = getCellConflicts(group, day, time, classData);
                  const isDragSource = dragSource?.group === group && dragSource?.day === day && dragSource?.time === time;
                  const isDragOver   = dragOver?.group   === group && dragOver?.day   === day && dragOver?.time   === time;
                  const typeStyle = classData ? getTypeStyle(classData.subjectType) : null;
                  const duration  = classData?.duration ? parseInt(classData.duration) : 1;

                  if (!show) {
                    return (
                      <td key={cellKey} className={`schedule-cell filtered-out ${isToday ? 'today-cell' : ''}`} colSpan={duration}>
                        <div className="filtered-label">{t('filtered')}</div>
                      </td>
                    );
                  }

                  return (
                    <td key={cellKey}
                      className={[
                        'schedule-cell',
                        classData          ? 'filled'           : '',
                        isAuthenticated    ? 'editable'         : '',
                        isToday            ? 'today-cell'       : '',
                        conflicts.includes('teacher') ? 'conflict-teacher' : '',
                        conflicts.includes('room')    ? 'conflict-room'    : '',
                        isDragSource       ? 'drag-source'      : '',
                        isDragOver ? (classData ? 'drag-over-filled' : 'drag-over-empty') : '',
                        duration > 1       ? 'multi-slot'       : '',
                      ].filter(Boolean).join(' ')}
                      style={classData && typeStyle ? { background: typeStyle.light, borderLeft: `3px solid ${typeStyle.color}` } : {}}
                      colSpan={duration}
                      onClick={() => { if (isAuthenticated && !dragSource) onEditClass(group, day, time); }}
                      draggable={isAuthenticated && !!classData}
                      onDragStart={classData ? (e) => handleDragStart(e, group, day, time) : undefined}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, group, day, time)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, group, day, time)}
                    >
                      {classData ? (
                        <div className="cell-content">
                          {typeStyle && (
                            <div className="type-pill" style={{ background: typeStyle.color }}>
                              {typeStyle.icon} {typeLabels[classData.subjectType || 'lecture']}
                            </div>
                          )}
                          {(conflicts.includes('teacher') || conflicts.includes('room')) && (
                            <div className="cell-conflict-icons">
                              {conflicts.includes('teacher') && <span>⚠️</span>}
                              {conflicts.includes('room')    && <span>🚪⚠️</span>}
                            </div>
                          )}
                          <div className="course-name">{classData.course}</div>
                          {duration > 1 && <div className="duration-indicator">⏱ {duration * 40}min</div>}
                          {classData.teacher && (
                            <div className={`teacher-name ${conflicts.includes('teacher') ? 'conflict-text' : ''}`}>
                              👨‍🏫 {classData.teacher}
                            </div>
                          )}
                          {classData.room && (
                            <div className={`room-number ${conflicts.includes('room') ? 'conflict-text' : ''}`}>
                              🚪 {classData.room}
                            </div>
                          )}
                          {isAuthenticated && <div className="drag-handle">⠿</div>}
                        </div>
                      ) : (
                        <>
                          {isAuthenticated && <div className="empty-cell">+</div>}
                          {isDragOver && <div className="drop-indicator">Drop here</div>}
                        </>
                      )}
                    </td>
                  );
                }))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ScheduleTable;