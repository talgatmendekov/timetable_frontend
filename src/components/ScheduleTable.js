// src/components/ScheduleTable.js
import React, { useState, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSchedule } from '../context/ScheduleContext';
import { useLanguage } from '../context/LanguageContext';
import { SUBJECT_TYPES, SUBJECT_TYPE_LABELS } from '../data/i18n';
import { normalizeTeacherName } from '../context/ScheduleContext';
import './ScheduleTable.css';

const getTodayName = () => {
  const NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  return NAMES[new Date().getDay()];
};
const getTypeStyle = (subjectType) =>
  SUBJECT_TYPES.find(s => s.value === subjectType) || SUBJECT_TYPES[0];

// Build { dayName → "Mon 20" } labels for the current week
const useWeekDayLabels = (daysToShow, lang) => {
  return useMemo(() => {
    const locale = (lang === 'ru' || lang === 'ky') ? 'ru-RU' : 'en-GB';
    const now = new Date();
    const dow = now.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    const mon = new Date(now);
    mon.setDate(now.getDate() + diff);
    const ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const map = {};
    daysToShow.forEach((dayName, i) => {
      const idx = ORDER.indexOf(dayName);
      const d = new Date(mon);
      d.setDate(mon.getDate() + (idx >= 0 ? idx : i));
      map[dayName] = `${d.getDate()} ${d.toLocaleDateString(locale, { month: 'long' })}`;
    });
    return map;
  }, [daysToShow, lang]);
};

// ─── Mobile card view ─────────────────────────────────────────────────────────
const MobileView = ({
  daysToShow, groupsToShow, timeSlots, schedule, todayName,
  cellsToSkip, occupiedRoomCells, selectedRoom, normSelectedTeacher,
  isAuthenticated, bookings, onEditClass, onGuestBookCell, onDeleteGroup,
  typeLabels, t, showEmpty,
}) => {
  const [collapsed, setCollapsed] = useState({});
  const getClass   = (g, d, tm) => schedule[`${g}-${d}-${tm}`] || null;
  const getBooking = (g, d, tm) => {
    const ce = schedule[`${g}-${d}-${tm}`];
    if (ce?.room) return bookings.find(b => b.room === ce.room && b.day === d && b.start_time === tm) || null;
    return bookings.find(b => b.day === d && b.start_time === tm && (b.entity === g || b.name === g)) || null;
  };
  const getConflicts = (g, d, tm, cd) => {
    if (!cd) return [];
    const out = [];
    Object.values(schedule).forEach(e => {
      if (e.group === g || e.day !== d || e.time !== tm) return;
      if (cd.teacher && e.teacher?.toLowerCase() === cd.teacher.toLowerCase()) out.push('teacher');
      if (cd.room    && e.room?.toLowerCase()    === cd.room.toLowerCase())    out.push('room');
    });
    return [...new Set(out)];
  };
  return (
    <div>
      <button className={`empty-slot-toggle-btn${showEmpty ? ' active' : ''}`} onClick={() => setShowEmpty(s => !s)}>
        {showEmpty ? '🙈 Hide empty' : '👁 Show empty'}
      </button>
      {daysToShow.map(day => {
        const isToday = day === todayName, isCollapsed = collapsed[day];
        const classCount = groupsToShow.reduce((a, g) =>
          a + timeSlots.filter(tm => { const c = getClass(g, day, tm); return c && !cellsToSkip.has(`${g}-${day}-${tm}`); }).length, 0);
        return (
          <div key={day} className="mob-day-section">
            <div className={`mob-day-header ${isToday ? 'today' : ''} ${isCollapsed ? 'collapsed' : ''}`}
              onClick={() => setCollapsed(c => ({ ...c, [day]: !c[day] }))}>
              <span>{isToday ? '★ ' : ''}{t(day) || day}</span>
              <span style={{ fontSize: '0.68rem', fontWeight: 400, opacity: 0.8 }}>{classCount} {classCount === 1 ? 'class' : 'classes'}</span>
              <span className="mob-day-chevron">▼</span>
            </div>
            {!isCollapsed && groupsToShow.map(group => {
              const slots = timeSlots.filter(tm => !cellsToSkip.has(`${group}-${day}-${tm}`));
              if (!slots.length) return null;
              if (!isAuthenticated) {
                const hc = slots.some(tm => getClass(group, day, tm) || getBooking(group, day, tm));
                if (!hc) return null;
              }
              return (
                <div key={group} className="mob-group-block">
                  <div className="mob-group-label">
                    {group}
                    {isAuthenticated && (
                      <button className="delete-group-btn" onClick={e => {
                        e.stopPropagation();
                        if (window.confirm(t('confirmDeleteGroup', { group }))) onDeleteGroup(group);
                      }}>×</button>
                    )}
                  </div>
                  <div className="mob-slots">
                    {slots.map(tm => {
                      const cd = getClass(group, day, tm), bk = getBooking(group, day, tm);
                      const cf = getConflicts(group, day, tm, cd);
                      const ts = cd ? getTypeStyle(cd.subjectType) : null;
                      const dur = Math.min(6, Math.max(1, parseInt(cd?.duration) || 1));
                      if (normSelectedTeacher && cd && normalizeTeacherName(cd.teacher) !== normSelectedTeacher) return null;
                      if (selectedRoom && occupiedRoomCells.has(`${day}-${tm}`)) return null;
                      if (!showEmpty && !cd && !bk) return null;
                      let bkB = '', bkI = null;
                      if (bk) {
                        bkB = bk.status === 'approved' ? '#22c55e' : bk.status === 'rejected' ? '#ef4444' : '#eab308';
                        bkI = <div className="mob-slot-booking" style={{ color: bkB }}>{bk.status === 'approved' ? '✅' : bk.status === 'rejected' ? '❌' : '⏳'} {bk.name || ''}{bk.room ? ` · ${bk.room}` : ''}</div>;
                      }
                      return (
                        <div key={tm}
                          className={['mob-slot', cf.includes('teacher') ? 'conflict-t' : '', cf.includes('room') ? 'conflict-r' : '', !cd && !bk ? 'mob-slot-empty-row' : '', dur > 1 ? 'mob-slot-multi' : ''].filter(Boolean).join(' ')}
                          style={bkB ? { borderLeft: `3px solid ${bkB}` } : cd && ts ? { borderLeft: `3px solid ${ts.color}` } : {}}
                          onClick={() => { if (isAuthenticated) { onEditClass(group, day, tm); return; } if (!cd && !bk && onGuestBookCell) onGuestBookCell(group, day, tm); }}>
                          <div className={`mob-slot-time ${isToday ? 'today-t' : ''}`}>{tm}</div>
                          <div className="mob-slot-body">
                            {cd ? (<>
                              {ts && <span className="mob-slot-pill" style={{ background: ts.color }}>{ts.icon} {typeLabels[cd.subjectType || 'lecture']}</span>}
                              <div className="mob-slot-course">{cd.course}</div>
                              <div className="mob-slot-meta">
                                {cd.teacher && <span>👨‍🏫 {cd.teacher}</span>}
                                {cd.room    && <span>🚪 {cd.room}</span>}
                                {cd.meetingLink && <a href={cd.meetingLink} target="_blank" rel="noopener noreferrer" className="meeting-link-btn" onClick={e => e.stopPropagation()}>🔗 Join</a>}
                                {cf.length > 0 && <span className="mob-conflict-badge">{cf.includes('teacher') ? '⚠️ teacher' : ''}{cf.includes('room') ? '⚠️ room' : ''}</span>}
                              </div>
                              {bkI}
                            </>) : bk ? (<>
                              <div className="mob-slot-course">{bk.purpose}</div>
                              <div className="mob-slot-meta"><span>👤 {bk.guest_name}</span></div>
                              {bkI}
                            </>) : isAuthenticated ? <span className="mob-slot-empty">＋</span>
                              : onGuestBookCell ? <span className="mob-slot-empty guest-hint">＋ book</span> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const ScheduleTable = ({
  selectedDay, selectedTeacher, selectedGroup, selectedRoom,
  onEditClass, onDeleteGroup, bookings = [], onGuestBookCell,
}) => {
  const { isAuthenticated } = useAuth();
  const { groups, timeSlots, days, schedule, moveClass } = useSchedule();
  const { t, lang } = useLanguage();

  const todayName  = getTodayName();
  const daysToShow = selectedDay ? [selectedDay] : days;

  const [showEmpty, setShowEmpty] = useState(false);

  const weekDateMap = useWeekDayLabels(daysToShow, lang);

  const bookingGroups = [...new Set(bookings.filter(b => ['pending','approved','rejected'].includes(b.status)).map(b => b.entity?.trim() ? b.entity.trim() : b.name).filter(Boolean))];
  const baseGroups    = selectedGroup ? groups.filter(g => g === selectedGroup) : groups;
  const groupsToShow  = [...bookingGroups.filter(g => !baseGroups.includes(g)), ...baseGroups];
  const typeLabels    = SUBJECT_TYPE_LABELS[lang] || SUBJECT_TYPE_LABELS.en;
  const normSelectedTeacher = useMemo(() => selectedTeacher ? normalizeTeacherName(selectedTeacher) : '', [selectedTeacher]);

  const [dragSource, setDragSource] = useState(null);
  const [dragOver,   setDragOver]   = useState(null);
  const dragNode = useRef(null);

  const cellsToSkip = useMemo(() => {
    const s = new Set();
    Object.values(schedule).forEach(cls => {
      const dur = Math.min(6, Math.max(1, parseInt(cls.duration) || 1));
      if (dur > 1) {
        const idx = timeSlots.indexOf(cls.time);
        for (let i = 1; i < dur; i++) { if (timeSlots[idx + i]) s.add(`${cls.group}-${cls.day}-${timeSlots[idx + i]}`); }
      }
    });
    return s;
  }, [schedule, timeSlots]);

  const occupiedRoomCells = useMemo(() => {
    if (!selectedRoom) return new Set();
    const s = new Set();
    Object.values(schedule).forEach(cls => { if (cls.room?.toLowerCase() === selectedRoom.toLowerCase()) s.add(`${cls.day}-${cls.time}`); });
    return s;
  }, [schedule, selectedRoom]);

  const getClass     = (g, d, tm) => schedule[`${g}-${d}-${tm}`] || null;
  const shouldShow   = (cd, d, tm) => {
    if (normSelectedTeacher && cd && normalizeTeacherName(cd.teacher) !== normSelectedTeacher) return false;
    if (selectedRoom) return !occupiedRoomCells.has(`${d}-${tm}`);
    return true;
  };
  const getConflicts = (g, d, tm, cd) => {
    if (!cd) return [];
    const out = [];
    Object.values(schedule).forEach(e => {
      if (e.group === g || e.day !== d || e.time !== tm) return;
      if (cd.teacher && e.teacher?.toLowerCase() === cd.teacher.toLowerCase()) out.push('teacher');
      if (cd.room    && e.room?.toLowerCase()    === cd.room.toLowerCase())    out.push('room');
    });
    return [...new Set(out)];
  };
  const getBooking = (g, d, tm) => {
    const ce = schedule[`${g}-${d}-${tm}`];
    if (ce?.room) return bookings.find(b => b.room === ce.room && b.day === d && b.start_time === tm) || null;
    return bookings.find(b => b.day === d && b.start_time === tm && (b.entity === g || b.name === g)) || null;
  };

  const handleDragStart = (e, g, d, tm) => { setDragSource({ group: g, day: d, time: tm }); dragNode.current = e.target; setTimeout(() => { if (dragNode.current) dragNode.current.style.opacity = '0.4'; }, 0); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragEnd   = () => { if (dragNode.current) dragNode.current.style.opacity = '1'; setDragSource(null); setDragOver(null); dragNode.current = null; };
  const handleDragOver  = (e, g, d, tm) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!dragOver || dragOver.group !== g || dragOver.day !== d || dragOver.time !== tm) setDragOver({ group: g, day: d, time: tm }); };
  const handleDragLeave = e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); };
  const handleDrop      = (e, tg, td, ttm) => { e.preventDefault(); if (!dragSource) return; const { group: fg, day: fd, time: ft } = dragSource; if (fg === tg && fd === td && ft === ttm) { handleDragEnd(); return; } moveClass(fg, fd, ft, tg, td, ttm); handleDragEnd(); };

  const Legend = () => (
    <div className="type-legend">
      {SUBJECT_TYPES.map(type => (
        <div key={type.value} className="legend-item">
          <span className="legend-dot" style={{ background: type.color }} />
          <span className="legend-label">{type.icon} {typeLabels[type.value]}</span>
        </div>
      ))}
      {!isAuthenticated && bookings.length > 0 && (<>
        <div className="legend-item"><span className="legend-dot" style={{ background: '#eab308' }} /><span className="legend-label">⏳ Pending</span></div>
        <div className="legend-item"><span className="legend-dot" style={{ background: '#22c55e' }} /><span className="legend-label">✅ Approved</span></div>
      </>)}
      {isAuthenticated && <div className="legend-item legend-drag-hint">↔ {t('dragHint')}</div>}
    </div>
  );

  return (
    <div className="schedule-container">
      <Legend />
      <MobileView
        daysToShow={daysToShow} groupsToShow={groupsToShow} timeSlots={timeSlots}
        schedule={schedule} todayName={todayName} cellsToSkip={cellsToSkip}
        occupiedRoomCells={occupiedRoomCells} selectedRoom={selectedRoom}
        normSelectedTeacher={normSelectedTeacher} isAuthenticated={isAuthenticated}
        bookings={bookings} onEditClass={onEditClass} onGuestBookCell={onGuestBookCell}
        onDeleteGroup={onDeleteGroup} typeLabels={typeLabels} t={t} showEmpty={showEmpty}
      />
      <div className="table-wrapper">
        <table className="schedule-table">
          <thead>
            {/* Row 1: group corner + day name with date number */}
            <tr>
              <th className="group-header">
                {t('groupTime')}
                {!isAuthenticated && <div className="lock-icon">🔒</div>}
              </th>
              {daysToShow.map(day => (
                <th key={day} className={`day-header ${day === todayName ? 'today-col' : ''}`} colSpan={timeSlots.length}>
                  {t(day)}, {weekDateMap[day]}{day === todayName && <span className="today-badge"> ★</span>}
                </th>
              ))}
            </tr>
            {/* Row 2: empty corner + time slot sub-headers */}
            <tr>
              <th className="group-header" />
              {daysToShow.map(day =>
                timeSlots.map(tm => (
                  <th key={`${day}-${tm}`} className={`time-header ${day === todayName ? 'today-time' : ''}`}>{tm}</th>
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
                      <button className="delete-group-btn" onClick={() => { if (window.confirm(t('confirmDeleteGroup', { group }))) onDeleteGroup(group); }}>×</button>
                    )}
                  </div>
                </td>
                {daysToShow.map(day => timeSlots.map(tm => {
                  const cellKey = `${group}-${day}-${tm}`;
                  if (cellsToSkip.has(cellKey)) return null;
                  const cd = getClass(group, day, tm), show = shouldShow(cd, day, tm), isToday = day === todayName;
                  const cf = getConflicts(group, day, tm, cd);
                  const isDragSrc = dragSource?.group === group && dragSource?.day === day && dragSource?.time === tm;
                  const isDragOvr = dragOver?.group   === group && dragOver?.day   === day && dragOver?.time   === tm;
                  const ts = cd ? getTypeStyle(cd.subjectType) : null;
                  const dur = Math.min(6, Math.max(1, parseInt(cd?.duration) || 1));
                  const bk = getBooking(group, day, tm);
                  if (!show) return (
                    <td key={cellKey} className={`schedule-cell filtered-out ${isToday ? 'today-cell' : ''}`} colSpan={dur}>
                      <div className="filtered-label">{t('filtered')}</div>
                    </td>
                  );
                  let bkStyle = {}, bkLabel = null;
                  if (bk) {
                    bkStyle = bk.status === 'approved'
                      ? { background: '#dcfce7', borderLeft: '3px solid #22c55e' }
                      : bk.status === 'rejected'
                        ? { background: '#fee2e2', borderLeft: '3px solid #ef4444' }
                        : { background: '#fef9c3', borderLeft: '3px solid #eab308' };
                    bkLabel = (
                      <div style={{ fontSize: '0.68rem', marginTop: 3, fontWeight: 600, color: bk.status === 'approved' ? '#166534' : bk.status === 'rejected' ? '#991b1b' : '#854d0e', display: 'flex', alignItems: 'center', gap: 3 }}>
                        {bk.status === 'approved' ? '✅' : bk.status === 'rejected' ? '❌' : '⏳'}
                        <span>{bk.name || ''}</span>
                        {bk.room && <span style={{ opacity: 0.7 }}>· {bk.room}</span>}
                      </div>
                    );
                  }
                  return (
                    <td key={cellKey}
                      className={['schedule-cell', cd ? 'filled' : '', isAuthenticated ? 'editable' : (!cd && !bk) ? 'guest-bookable' : '', isToday ? 'today-cell' : '', cf.includes('teacher') ? 'conflict-teacher' : '', cf.includes('room') ? 'conflict-room' : '', isDragSrc ? 'drag-source' : '', isDragOvr ? (cd ? 'drag-over-filled' : 'drag-over-empty') : '', dur > 1 ? 'multi-slot' : ''].filter(Boolean).join(' ')}
                      style={bk ? bkStyle : (cd && ts ? { background: ts.light, borderLeft: `3px solid ${ts.color}` } : {})}
                      colSpan={dur}
                      onClick={() => { if (isAuthenticated && !dragSource) { onEditClass(group, day, tm); return; } if (!isAuthenticated && !cd && !bk && onGuestBookCell) onGuestBookCell(group, day, tm); }}
                      draggable={isAuthenticated && !!cd}
                      onDragStart={cd ? e => handleDragStart(e, group, day, tm) : undefined}
                      onDragEnd={handleDragEnd}
                      onDragOver={e => handleDragOver(e, group, day, tm)}
                      onDragLeave={handleDragLeave}
                      onDrop={e => handleDrop(e, group, day, tm)}
                    >
                      {cd ? (
                        <div className="cell-content">
                          {ts && <div className="type-pill" style={{ background: ts.color }}>{ts.icon} {typeLabels[cd.subjectType || 'lecture']}</div>}
                          {(cf.includes('teacher') || cf.includes('room')) && <div className="cell-conflict-icons">{cf.includes('teacher') && <span>⚠️</span>}{cf.includes('room') && <span>🚪⚠️</span>}</div>}
                          <div className="course-name">{cd.course}</div>
                          {dur > 1 && <div className="duration-indicator">⏱ {dur * 40}min</div>}
                          {cd.teacher && <div className={`teacher-name ${cf.includes('teacher') ? 'conflict-text' : ''}`}>👨‍🏫 {cd.teacher}</div>}
                          {cd.room    && <div className={`room-number ${cf.includes('room') ? 'conflict-text' : ''}`}>🚪 {cd.room}</div>}
                          {cd.meetingLink && <a href={cd.meetingLink} target="_blank" rel="noopener noreferrer" className="meeting-link-btn" onClick={e => e.stopPropagation()}>🔗 Join</a>}
                          {bkLabel}
                          {isAuthenticated && <div className="drag-handle">⠿</div>}
                        </div>
                      ) : (<>
                        {bk ? (
                          <div className="cell-content">
                            <div className="course-name">{bk.purpose}</div>
                            <div className="teacher-name">👤 {bk.guest_name}</div>
                            {bkLabel}
                          </div>
                        ) : (<>
                          {isAuthenticated  && <div className="empty-cell">+</div>}
                          {!isAuthenticated && <div className="guest-book-hint">📅 Click to book</div>}
                          {isDragOvr        && <div className="drop-indicator">Drop here</div>}
                        </>)}
                      </>)}
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