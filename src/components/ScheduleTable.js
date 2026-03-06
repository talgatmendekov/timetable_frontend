// src/components/ScheduleTable.js
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

const getTypeStyle = (subjectType) =>
  SUBJECT_TYPES.find(s => s.value === subjectType) || SUBJECT_TYPES[0];

const ScheduleTable = ({
  selectedDay, selectedTeacher, selectedGroup,
  selectedRoom,   // ← new: filter by empty room
  onEditClass, onDeleteGroup,
  bookings = [],  // ← booking overlays for guest mode
  onGuestBookCell, // ← guest clicks empty cell to book
}) => {
  const { isAuthenticated } = useAuth();
  const { groups, timeSlots, days, schedule, moveClass } = useSchedule();
  const { t, lang } = useLanguage();

  const todayName   = getTodayName();
  const daysToShow  = selectedDay   ? [selectedDay]                        : days;
  // Booking groups (entity/name from pending+approved bookings) float to the top
  const bookingGroups = [...new Set(
    bookings
      .filter(b => b.status === 'pending' || b.status === 'approved' || b.status === 'rejected')
      .map(b => (b.entity && b.entity.trim()) ? b.entity.trim() : b.name)
      .filter(Boolean)
  )];
  const baseGroups   = selectedGroup ? groups.filter(g => g === selectedGroup) : groups;
  // Put booking groups first, then regular groups (no duplicates)
  const groupsToShow = [
    ...bookingGroups.filter(g => !baseGroups.includes(g)),
    ...baseGroups,
  ];
  const typeLabels  = SUBJECT_TYPE_LABELS[lang] || SUBJECT_TYPE_LABELS.en;

  const normSelectedTeacher = useMemo(
    () => selectedTeacher ? normalizeTeacherName(selectedTeacher) : '',
    [selectedTeacher]
  );

  const [dragSource, setDragSource] = useState(null);
  const [dragOver,   setDragOver]   = useState(null);
  const dragNode = useRef(null);

  // Build set of cells occupied by multi-slot classes
  const cellsToSkip = useMemo(() => {
    const s = new Set();
    Object.values(schedule).forEach(cls => {
      // parseInt + clamp: duration must be 1-6 max (safety against corrupt data)
      const dur = Math.min(6, Math.max(1, parseInt(cls.duration) || 1));
      if (dur > 1) {
        const idx = timeSlots.indexOf(cls.time);
        for (let i = 1; i < dur; i++) {
          if (timeSlots[idx + i]) s.add(`${cls.group}-${cls.day}-${timeSlots[idx + i]}`);
        }
      }
    });
    return s;
  }, [schedule, timeSlots]);

  // ── When "show only empty rooms for <room>" is active, we filter to cells
  //    where that room is not occupied ────────────────────────────────────────
  const occupiedRoomCells = useMemo(() => {
    if (!selectedRoom) return new Set();
    const s = new Set();
    Object.values(schedule).forEach(cls => {
      if (cls.room?.toLowerCase() === selectedRoom.toLowerCase()) {
        s.add(`${cls.day}-${cls.time}`);
      }
    });
    return s;
  }, [schedule, selectedRoom]);

  const getClass = (group, day, time) => schedule[`${group}-${day}-${time}`] || null;

  const shouldShow = (classData, day, time) => {
    // Teacher filter
    if (normSelectedTeacher && classData &&
        normalizeTeacherName(classData.teacher) !== normSelectedTeacher) return false;
    // Empty-room filter: show only cells where this room is free
    if (selectedRoom) {
      return !occupiedRoomCells.has(`${day}-${time}`);
    }
    return true;
  };

  const getConflicts = (group, day, time, classData) => {
    if (!classData) return [];
    const out = [];
    Object.values(schedule).forEach(e => {
      if (e.group === group || e.day !== day || e.time !== time) return;
      if (classData.teacher && e.teacher?.toLowerCase() === classData.teacher.toLowerCase()) out.push('teacher');
      if (classData.room    && e.room?.toLowerCase()    === classData.room.toLowerCase())    out.push('room');
    });
    return [...new Set(out)];
  };

  // Booking overlay helpers
  // Match booking strictly by room+day+time.
  // Never fall back to day+time-only — that would highlight ALL groups at that slot.
  const getBooking = (group, day, time) => {
    const classEntry = schedule[`${group}-${day}-${time}`];
    // If the cell has a room, match booking by that exact room+day+time
    if (classEntry?.room) {
      return bookings.find(b =>
        b.room === classEntry.room &&
        b.day  === day &&
        b.start_time === time
      ) || null;
    }
    // Empty cell — match only if the booking's entity/group matches this group
    return bookings.find(b =>
      b.day === day &&
      b.start_time === time &&
      (b.entity === group || b.name === group)
    ) || null;
  };

  const handleDragStart = (e, group, day, time) => {
    setDragSource({ group, day, time });
    dragNode.current = e.target;
    setTimeout(() => { if (dragNode.current) dragNode.current.style.opacity = '0.4'; }, 0);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragEnd = () => {
    if (dragNode.current) dragNode.current.style.opacity = '1';
    setDragSource(null); setDragOver(null); dragNode.current = null;
  };
  const handleDragOver = (e, group, day, time) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    if (!dragOver || dragOver.group !== group || dragOver.day !== day || dragOver.time !== time)
      setDragOver({ group, day, time });
  };
  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null);
  };
  const handleDrop = (e, toGroup, toDay, toTime) => {
    e.preventDefault();
    if (!dragSource) return;
    const { group: fg, day: fd, time: ft } = dragSource;
    if (fg === toGroup && fd === toDay && ft === toTime) { handleDragEnd(); return; }
    moveClass(fg, fd, ft, toGroup, toDay, toTime);
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
      {!isAuthenticated && bookings.length > 0 && <>
        <div className="legend-item"><span className="legend-dot" style={{background:'#eab308'}}/><span className="legend-label">⏳ Pending booking</span></div>
        <div className="legend-item"><span className="legend-dot" style={{background:'#22c55e'}}/><span className="legend-label">✅ Approved booking</span></div>
      </>}
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
                <th key={day}
                  className={`day-header ${day === todayName ? 'today-col' : ''}`}
                  colSpan={timeSlots.length}
                >
                  {t(day)}{day === todayName && <span className="today-badge"> ★</span>}
                </th>
              ))}
            </tr>
            <tr>
              <th className="group-header" />
              {daysToShow.map(day => timeSlots.map(time => (
                <th key={`${day}-${time}`}
                  className={`time-header ${day === todayName ? 'today-time' : ''}`}
                >{time}</th>
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
                  if (cellsToSkip.has(cellKey)) return null;

                  const classData  = getClass(group, day, time);
                  const show       = shouldShow(classData, day, time);
                  const isToday    = day === todayName;
                  const conflicts  = getConflicts(group, day, time, classData);
                  const isDragSrc  = dragSource?.group === group && dragSource?.day === day && dragSource?.time === time;
                  const isDragOvr  = dragOver?.group   === group && dragOver?.day   === day && dragOver?.time   === time;
                  const typeStyle  = classData ? getTypeStyle(classData.subjectType) : null;
                  const duration   = Math.min(6, Math.max(1, parseInt(classData?.duration) || 1));
                  const booking    = getBooking(group, day, time);

                  if (!show) {
                    return (
                      <td key={cellKey}
                        className={`schedule-cell filtered-out ${isToday ? 'today-cell' : ''}`}
                        colSpan={duration}
                      >
                        <div className="filtered-label">{t('filtered')}</div>
                      </td>
                    );
                  }

                  // Booking overlay styles — shown for all users
                  let bookingStyle = {};
                  let bookingLabel = null;
                  if (booking) {
                    bookingStyle =
                      booking.status === 'approved' ? { background: '#dcfce7', borderLeft: '3px solid #22c55e' } :
                      booking.status === 'rejected' ? { background: '#fee2e2', borderLeft: '3px solid #ef4444' } :
                      { background: '#fef9c3', borderLeft: '3px solid #eab308' };
                    bookingLabel = (
                      <div style={{fontSize:'0.68rem',marginTop:3,fontWeight:600,
                        color: booking.status === 'approved' ? '#166534' : booking.status === 'rejected' ? '#991b1b' : '#854d0e',
                        display:'flex',alignItems:'center',gap:3}}>
                        {booking.status === 'approved' ? '✅' : booking.status === 'rejected' ? '❌' : '⏳'}
                        <span>{booking.name || ''}</span>
                        {booking.room && <span style={{opacity:0.7}}>· {booking.room}</span>}
                      </div>
                    );
                  }

                  return (
                    <td key={cellKey}
                      className={[
                        'schedule-cell',
                        classData   ? 'filled'       : '',
                        isAuthenticated ? 'editable' : (!classData && !booking) ? 'guest-bookable' : '',
                        isToday     ? 'today-cell'   : '',
                        conflicts.includes('teacher') ? 'conflict-teacher' : '',
                        conflicts.includes('room')    ? 'conflict-room'    : '',
                        isDragSrc   ? 'drag-source'  : '',
                        isDragOvr   ? (classData ? 'drag-over-filled' : 'drag-over-empty') : '',
                        duration > 1 ? 'multi-slot'  : '',
                      ].filter(Boolean).join(' ')}
                      style={
                        booking ? bookingStyle :
                        (classData && typeStyle ? { background: typeStyle.light, borderLeft: `3px solid ${typeStyle.color}` } : {})
                      }
                      colSpan={duration}
                      onClick={() => {
                        if (isAuthenticated && !dragSource) { onEditClass(group, day, time); return; }
                        if (!isAuthenticated && !classData && !booking && onGuestBookCell)
                          onGuestBookCell(group, day, time);
                      }}
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
                          {bookingLabel}
                          {isAuthenticated && <div className="drag-handle">⠿</div>}
                        </div>
                      ) : (
                        <>
                          {booking ? (
                            <div className="cell-content">
                              <div className="course-name">{booking.purpose}</div>
                              <div className="teacher-name">👤 {booking.guest_name}</div>
                              {bookingLabel}
                            </div>
                          ) : (
                            <>
                              {isAuthenticated && <div className="empty-cell">+</div>}
                              {!isAuthenticated && <div className="guest-book-hint">📅 📅 Click to book</div>}
                              {isDragOvr && <div className="drop-indicator">Drop here</div>}
                            </>
                          )}
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