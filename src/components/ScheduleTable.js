// src/components/ScheduleTable.js

import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSchedule } from '../context/ScheduleContext';
import { useLanguage } from '../context/LanguageContext';
import { SUBJECT_TYPES, SUBJECT_TYPE_LABELS } from '../data/i18n';
import './ScheduleTable.css';

const getTodayName = () => {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  return days[new Date().getDay()];
};

// Get color config for a subject type
const getTypeStyle = (subjectType) => {
  return SUBJECT_TYPES.find(s => s.value === subjectType) || SUBJECT_TYPES[0];
};

const ScheduleTable = ({ selectedDay, selectedTeacher, selectedGroup, onEditClass, onDeleteGroup }) => {
  const { isAuthenticated } = useAuth();
  const { groups, timeSlots, days, getClassByKey, schedule, moveClass } = useSchedule();
  const { t, lang } = useLanguage();

  const todayName = getTodayName();
  const daysToShow = selectedDay ? [selectedDay] : days;
  const groupsToShow = selectedGroup ? groups.filter(g => g === selectedGroup) : groups;
  const typeLabels = SUBJECT_TYPE_LABELS[lang] || SUBJECT_TYPE_LABELS.en;

  // Drag state
  const [dragSource, setDragSource] = useState(null); // { group, day, time }
  const [dragOver, setDragOver]     = useState(null);  // { group, day, time }
  const dragNode = useRef(null);

  const shouldShowCell = (classData) => {
    if (!classData) return true;
    if (selectedTeacher && classData.teacher !== selectedTeacher) return false;
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

  // ── Drag handlers ──────────────────────────────────────────
  const handleDragStart = (e, group, day, time) => {
    setDragSource({ group, day, time });
    dragNode.current = e.target;
    // Ghost image styling - slight delay so browser captures styled element
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
    // Only clear if actually leaving the cell (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOver(null);
    }
  };

  const handleDrop = (e, toGroup, toDay, toTime) => {
    e.preventDefault();
    if (!dragSource) return;
    const { group: fromGroup, day: fromDay, time: fromTime } = dragSource;
    // Don't drop on same cell
    if (fromGroup === toGroup && fromDay === toDay && fromTime === toTime) {
      handleDragEnd();
      return;
    }
    moveClass(fromGroup, fromDay, fromTime, toGroup, toDay, toTime);
    handleDragEnd();
  };

  // ── Legend ────────────────────────────────────────────────
  const Legend = () => (
    <div className="type-legend">
      {SUBJECT_TYPES.map(type => (
        <div key={type.value} className="legend-item">
          <span className="legend-dot" style={{ background: type.color }} />
          <span className="legend-label">{type.icon} {typeLabels[type.value]}</span>
        </div>
      ))}
      {isAuthenticated && (
        <div className="legend-item legend-drag-hint">
          ↔ {t('dragHint') || 'Drag to move classes'}
        </div>
      )}
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
                {t('groupTime')}
                {!isAuthenticated && <div className="lock-icon">🔒</div>}
              </th>
              {daysToShow.map(day => {
                const isToday = day === todayName;
                return (
                  <th key={day}
                    className={`day-header ${isToday ? 'today-col' : ''}`}
                    colSpan={timeSlots.length}
                  >
                    {t(day)}{isToday && <span className="today-badge"> ★</span>}
                  </th>
                );
              })}
            </tr>
            <tr>
              <th className="group-header" />
              {daysToShow.map(day =>
                timeSlots.map(time => (
                  <th key={`${day}-${time}`}
                    className={`time-header ${day === todayName ? 'today-time' : ''}`}
                  >
                    {time}
                  </th>
                ))
              )}
            </tr>
          </thead>

          <tbody>
            {groupsToShow.map(group => (
              <tr key={group}>
                <td className="group-cell">
                  <div className="group-cell-content">
                    <span className="group-name">{group}</span>
                    {isAuthenticated && (
                      <button
                        className="delete-group-btn"
                        title="Delete group"
                        onClick={() => {
                          if (window.confirm(t('confirmDeleteGroup', { group })))
                            onDeleteGroup(group);
                        }}
                      >×</button>
                    )}
                  </div>
                </td>

                {daysToShow.map(day =>
                  timeSlots.map(time => {
                    const classData = getClassByKey(group, day, time);
                    const show      = shouldShowCell(classData);
                    const isToday   = day === todayName;
                    const conflicts = getCellConflicts(group, day, time, classData);
                    const hasTeacherConflict = conflicts.includes('teacher');
                    const hasRoomConflict    = conflicts.includes('room');

                    const isDragSource = dragSource?.group === group && dragSource?.day === day && dragSource?.time === time;
                    const isDragOver   = dragOver?.group === group && dragOver?.day === day && dragOver?.time === time;

                    // Color coding
                    const typeStyle = classData ? getTypeStyle(classData.subjectType) : null;

                    if (!show) {
                      return (
                        <td key={`${group}-${day}-${time}`}
                          className={`schedule-cell filtered-out ${isToday ? 'today-cell' : ''}`}
                        >
                          <div className="filtered-label">{t('filtered')}</div>
                        </td>
                      );
                    }

                    return (
                      <td
                        key={`${group}-${day}-${time}`}
                        className={[
                          'schedule-cell',
                          classData ? 'filled' : '',
                          isAuthenticated ? 'editable' : '',
                          isToday ? 'today-cell' : '',
                          hasTeacherConflict ? 'conflict-teacher' : '',
                          hasRoomConflict ? 'conflict-room' : '',
                          isDragSource ? 'drag-source' : '',
                          isDragOver ? (classData ? 'drag-over-filled' : 'drag-over-empty') : '',
                        ].filter(Boolean).join(' ')}
                        style={classData && typeStyle ? {
                          background: typeStyle.light,
                          borderLeft: `3px solid ${typeStyle.color}`,
                        } : {}}
                        // Click to edit
                        onClick={() => {
                          if (isAuthenticated && !dragSource) onEditClass(group, day, time);
                        }}
                        // Drag source
                        draggable={isAuthenticated && !!classData}
                        onDragStart={classData ? (e) => handleDragStart(e, group, day, time) : undefined}
                        onDragEnd={handleDragEnd}
                        // Drop target
                        onDragOver={(e) => handleDragOver(e, group, day, time)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, group, day, time)}
                      >
                        {classData ? (
                          <div className="cell-content">
                            {/* Type indicator pill */}
                            {typeStyle && (
                              <div className="type-pill" style={{ background: typeStyle.color }}>
                                {typeStyle.icon} {typeLabels[classData.subjectType || 'lecture']}
                              </div>
                            )}

                            {/* Conflict icons */}
                            {(hasTeacherConflict || hasRoomConflict) && (
                              <div className="cell-conflict-icons">
                                {hasTeacherConflict && <span title="Teacher conflict">⚠️</span>}
                                {hasRoomConflict    && <span title="Room conflict">🚪⚠️</span>}
                              </div>
                            )}

                            <div className="course-name">{classData.course}</div>
                            {classData.teacher && (
                              <div className={`teacher-name ${hasTeacherConflict ? 'conflict-text' : ''}`}>
                                👨‍🏫 {classData.teacher}
                              </div>
                            )}
                            {classData.room && (
                              <div className={`room-number ${hasRoomConflict ? 'conflict-text' : ''}`}>
                                🚪 {classData.room}
                              </div>
                            )}

                            {/* Drag handle shown on hover */}
                            {isAuthenticated && (
                              <div className="drag-handle" title="Drag to move">⠿</div>
                            )}
                          </div>
                        ) : (
                          <>
                            {isAuthenticated && <div className="empty-cell">+</div>}
                            {isDragOver && <div className="drop-indicator">Drop here</div>}
                          </>
                        )}
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ScheduleTable;
