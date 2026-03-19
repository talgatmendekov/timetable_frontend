// src/components/ScheduleTable.js
import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
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
                          <div className={`mob-slot-time ${isToday ? 'today-t' : ''}`}>
                            {tm}
                          </div>
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

const GCalPopup = ({ event, anchorRect, onClose, onEdit, isAuthenticated, typeLabels }) => {
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h, true);
    return () => document.removeEventListener('mousedown', h, true);
  }, [onClose]);
  if (!event) return null;
  const { classData: cd, booking: bk, group, day, time } = event;
  const HC = { lecture: '#4285f4', lab: '#34a853', seminar: '#f9ab00' };
  const BC = { approved: '#34a853', rejected: '#ea4335', pending: '#f9ab00' };
  const typeKey = cd?.subjectType || 'lecture';
  const hBg = bk ? (BC[bk.status] || BC.pending) : (HC[typeKey] || HC.lecture);
  const PW = 296, PH = 320, vw = window.innerWidth;
  let left = (anchorRect?.right ?? 200) + 12, top = (anchorRect?.top ?? 100) + window.scrollY;
  if (left + PW > vw - 12) left = (anchorRect?.left ?? PW + 12) - PW - 12;
  if (left < 12) left = 12;
  if (top + PH > window.scrollY + window.innerHeight - 12) top = Math.max(window.scrollY + 12, window.scrollY + window.innerHeight - PH - 12);
  return (
    <div className="gcpop-overlay" onMouseDown={onClose}>
      <div ref={ref} className="gcpop" style={{ top, left }} onMouseDown={e => e.stopPropagation()}>
        <div className="gcpop-header" style={{ background: hBg }}>
          <span className="gcpop-type-label">
            {bk
              ? `${bk.status === 'approved' ? '✅' : bk.status === 'rejected' ? '❌' : '⏳'} ${bk.status}`
              : `${SUBJECT_TYPES.find(s => s.value === typeKey)?.icon || ''} ${typeLabels[typeKey] || typeKey}`}
          </span>
          <button className="gcpop-close" onClick={onClose}>✕</button>
        </div>
        <div className="gcpop-body">
          <div className="gcpop-title">{cd?.course || bk?.purpose || '—'}</div>
          <div className="gcpop-rows">
            <div className="gcpop-row"><span className="gcpop-icon">🗓</span><span>{day} · {time}</span></div>
            <div className="gcpop-row"><span className="gcpop-icon">👥</span><strong>{group}</strong></div>
            {cd?.teacher    && <div className="gcpop-row"><span className="gcpop-icon">👨‍🏫</span><span>{cd.teacher}</span></div>}
            {cd?.room       && <div className="gcpop-row"><span className="gcpop-icon">🚪</span><span>{cd.room}</span></div>}
            {cd?.duration > 1 && <div className="gcpop-row"><span className="gcpop-icon">⏱</span><span>{cd.duration * 40} min</span></div>}
            {cd?.meetingLink && <div className="gcpop-row"><span className="gcpop-icon">🔗</span><a href={cd.meetingLink} target="_blank" rel="noopener noreferrer" className="gcpop-link" onClick={e => e.stopPropagation()}>Join meeting</a></div>}
            {bk?.guest_name && <div className="gcpop-row"><span className="gcpop-icon">👤</span><span>{bk.guest_name}</span></div>}
            {bk?.room       && <div className="gcpop-row"><span className="gcpop-icon">🚪</span><span>{bk.room}</span></div>}
          </div>
          {isAuthenticated && <button className="gcpop-edit-btn" onClick={() => { onEdit(); onClose(); }}>✏️ Edit class</button>}
        </div>
      </div>
    </div>
  );
};

// ─── CalendarView ─────────────────────────────────────────────────────────────
// Identical structure to the schedule table:
//   rows    = groups  (sticky dark label column, same style as table)
//   columns = days    (each day spans N time-slot sub-columns)
//   sub-row = time slots listed under each day header
// Rendered as <table> so colSpan, sticky, and borders all work naturally.
// Light cream (gcal-*) theme to visually distinguish from the dark table view.
// ─────────────────────────────────────────────────────────────────────────────
const CalendarView = ({
  daysToShow, groupsToShow, timeSlots, schedule,
  todayName, weekOffset, onShiftWeek,
  cellsToSkip, occupiedRoomCells, selectedRoom, normSelectedTeacher,
  isAuthenticated, bookings, onEditClass, onGuestBookCell,
  typeLabels, t,
}) => {
  const [eventPopup, setEventPopup] = useState(null);

  const getClass = (g, d, tm) => schedule[`${g}-${d}-${tm}`] || null;
  const getBooking = (g, d, tm) => {
    const ce = schedule[`${g}-${d}-${tm}`];
    if (ce?.room) return bookings.find(b => b.room === ce.room && b.day === d && b.start_time === tm) || null;
    return bookings.find(b => b.day === d && b.start_time === tm && (b.entity === g || b.name === g)) || null;
  };

  const TYPE_COLORS = {
    lecture: { bg: '#c8deff', text: '#1a4d8f', border: '#4285f4' },
    lab:     { bg: '#c4e6c8', text: '#1a5c2a', border: '#34a853' },
    seminar: { bg: '#fce4b0', text: '#7a4100', border: '#f9ab00' },
  };
  const BK_COLORS = {
    approved: { bg: '#c4e6c8', text: '#1a5c2a', border: '#34a853' },
    rejected: { bg: '#fdd9d7', text: '#c5221f', border: '#ea4335' },
    pending:  { bg: '#fce4b0', text: '#7a4100', border: '#f9ab00' },
  };

  const weekDayLabels = useMemo(() => {
    const now = new Date(), dow = now.getDay(), diff = dow === 0 ? -6 : 1 - dow;
    const mon = new Date(now);
    mon.setDate(now.getDate() + diff + weekOffset * 7);
    const ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    return daysToShow.map((dayName, i) => {
      const idx = ORDER.indexOf(dayName), d = new Date(mon);
      d.setDate(mon.getDate() + (idx >= 0 ? idx : i));
      return { dayName, label: `${(t(dayName) || dayName).slice(0, 3)} ${d.getDate()}`, date: d };
    });
  }, [daysToShow, weekOffset, t]);

  const weekRangeLabel = useMemo(() => {
    if (!weekDayLabels.length) return '';
    const fmt = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `${fmt(weekDayLabels[0].date)} – ${fmt(weekDayLabels[weekDayLabels.length - 1].date)}`;
  }, [weekDayLabels]);

  const openEventPopup = useCallback((e, group, day, time, cd, bk) => {
    e.stopPropagation();
    setEventPopup({ event: { classData: cd, booking: bk, group, day, time }, anchorRect: e.currentTarget.getBoundingClientRect() });
  }, []);

  return (
    <div className="gcal-wrap">

      {/* ── Nav ── */}
      <div className="gcal-nav">
        <button className="gcal-nav-btn" onClick={() => onShiftWeek(w => w - 1)}>← prev</button>
        <span className="gcal-nav-title">{weekRangeLabel}</span>
        <button className="gcal-nav-btn" onClick={() => onShiftWeek(w => w + 1)}>next →</button>
      </div>

      {/* ── Legend ── */}
      <div className="gcal-legend">
        {[
          { key: 'lecture', bg: '#c8deff', border: '#4285f4', label: 'Lecture' },
          { key: 'lab',     bg: '#c4e6c8', border: '#34a853', label: 'Lab'     },
          { key: 'seminar', bg: '#fce4b0', border: '#f9ab00', label: 'Seminar' },
        ].map(({ key, bg, border, label }) => (
          <div key={key} className="gcal-legend-item">
            <span className="gcal-legend-swatch" style={{ background: bg, border: `1.5px solid ${border}` }} />
            <span>{label}</span>
          </div>
        ))}
        {bookings.some(b => b.status) && (
          <div className="gcal-legend-item">
            <span className="gcal-legend-swatch" style={{ background: '#fdd9d7', border: '1.5px solid #ea4335' }} />
            <span>Booked</span>
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div className="gcal-table-scroll">
        <table className="gcal-table">
          <thead>
            {/* Row 1: corner + day name headers, each spanning all time slots */}
            <tr>
              <th className="gcal-th-group">
                Group
                {!isAuthenticated && <div className="lock-icon">🔒</div>}
              </th>
              {weekDayLabels.map(({ dayName, label }) => (
                <th
                  key={dayName}
                  className={`gcal-th-day${dayName === todayName ? ' gcal-th-day-today' : ''}`}
                  colSpan={timeSlots.length}
                >
                  {label}
                  {dayName === todayName && <span className="today-badge"> ★</span>}
                </th>
              ))}
            </tr>
            {/* Row 2: empty group corner + time slot sub-headers */}
            <tr>
              <th className="gcal-th-group" />
              {daysToShow.map(day =>
                timeSlots.map(tm => (
                  <th
                    key={`${day}-${tm}`}
                    className={`gcal-th-time${day === todayName ? ' gcal-th-time-today' : ''}`}
                  >
                    {tm}
                  </th>
                ))
              )}
            </tr>
          </thead>

          <tbody>
            {groupsToShow.map(group => (
              <tr key={group}>
                {/* Sticky group label — mirrors dark table group-cell */}
                <td className="gcal-td-group">
                  <span className="gcal-group-name">{group}</span>
                </td>

                {daysToShow.map(day =>
                  timeSlots.map(tm => {
                    const cellKey = `${group}-${day}-${tm}`;
                    if (cellsToSkip.has(cellKey)) return null;

                    const isToday = day === todayName;
                    const cd = getClass(group, day, tm);

                    if (normSelectedTeacher && cd && normalizeTeacherName(cd.teacher) !== normSelectedTeacher) {
                      return <td key={cellKey} className={`gcal-td${isToday ? ' gcal-td-today' : ''}`} />;
                    }
                    if (selectedRoom && occupiedRoomCells.has(`${day}-${tm}`)) {
                      return (
                        <td key={cellKey} className={`gcal-td gcal-td-filtered${isToday ? ' gcal-td-today' : ''}`}>
                          <div className="filtered-label">{t('filtered')}</div>
                        </td>
                      );
                    }

                    const bk = getBooking(group, day, tm);
                    const isEmpty = !cd && !bk;
                    const dur = cd ? Math.min(6, Math.max(1, parseInt(cd.duration) || 1)) : 1;
                    const fc = cd
                      ? (TYPE_COLORS[cd.subjectType] || TYPE_COLORS.lecture)
                      : bk
                        ? (BK_COLORS[bk.status] || BK_COLORS.pending)
                        : null;

                    return (
                      <td
                        key={cellKey}
                        colSpan={dur}
                        className={[
                          'gcal-td',
                          isToday  ? 'gcal-td-today'  : '',
                          isEmpty  ? 'gcal-td-empty'  : 'gcal-td-filled',
                        ].filter(Boolean).join(' ')}
                        onClick={() => {
                          if (!isEmpty) return;
                          if (isAuthenticated) onEditClass(group, day, tm);
                          else if (onGuestBookCell) onGuestBookCell(group, day, tm);
                        }}
                      >
                        {(cd || bk) && fc && (
                          <div
                            className={`gcal-block${dur > 1 ? ' gcal-block-multi' : ''}`}
                            style={{ '--blk-bg': fc.bg, '--blk-text': fc.text, '--blk-border': fc.border }}
                            onClick={e => openEventPopup(e, group, day, tm, cd, bk)}
                          >
                            <div className="gcal-block-name">{cd?.course || bk?.purpose}</div>
                            {(cd?.room || bk?.room) && (
                              <div className="gcal-block-room">{cd?.room || bk?.room}</div>
                            )}
                          </div>
                        )}
                        {isEmpty && isAuthenticated && (
                          <div className="gcal-empty-plus">+</div>
                        )}
                        {isEmpty && !isAuthenticated && onGuestBookCell && (
                          <div className="gcal-empty-book">📅</div>
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

      {eventPopup && (
        <GCalPopup
          event={eventPopup.event} anchorRect={eventPopup.anchorRect}
          onClose={() => setEventPopup(null)}
          onEdit={() => onEditClass(eventPopup.event.group, eventPopup.event.day, eventPopup.event.time)}
          isAuthenticated={isAuthenticated} typeLabels={typeLabels}
        />
      )}
    </div>
  );
};

const ScheduleTable = ({
  selectedDay, selectedTeacher, selectedGroup, selectedRoom,
  onEditClass, onDeleteGroup, bookings = [], onGuestBookCell,
}) => {
  const { isAuthenticated } = useAuth();
  const { groups, timeSlots, days, schedule, moveClass } = useSchedule();
  const { t, lang } = useLanguage();

  const todayName  = getTodayName();
  const daysToShow = selectedDay ? [selectedDay] : days;

  const [showEmpty,  setShowEmpty]  = useState(false);
  const [viewMode,   setViewMode]   = useState('table');
  const [weekOffset, setWeekOffset] = useState(0);

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
      {SUBJECT_TYPES.map(type => (<div key={type.value} className="legend-item"><span className="legend-dot" style={{ background: type.color }} /><span className="legend-label">{type.icon} {typeLabels[type.value]}</span></div>))}
      {!isAuthenticated && bookings.length > 0 && (<><div className="legend-item"><span className="legend-dot" style={{ background: '#eab308' }} /><span className="legend-label">⏳ Pending</span></div><div className="legend-item"><span className="legend-dot" style={{ background: '#22c55e' }} /><span className="legend-label">✅ Approved</span></div></>)}
      {isAuthenticated && <div className="legend-item legend-drag-hint">↔ {t('dragHint')}</div>}
      <div className="view-mode-toggle">
        <button className={`vmt-btn${viewMode === 'table'    ? ' vmt-active' : ''}`} onClick={() => setViewMode('table')}>☰ Table</button>
        <button className={`vmt-btn${viewMode === 'calendar' ? ' vmt-active' : ''}`} onClick={() => setViewMode('calendar')}>📅 Calendar</button>
      </div>
      <button className={`empty-slot-toggle-btn${showEmpty ? ' active' : ''}`} onClick={() => setShowEmpty(s => !s)}>
        {showEmpty ? '🙈 Hide empty' : '👁 Show empty'}
      </button>
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
      {viewMode === 'calendar' && (
        <CalendarView
          daysToShow={days} groupsToShow={groupsToShow} timeSlots={timeSlots}
          schedule={schedule} todayName={todayName} weekOffset={weekOffset}
          onShiftWeek={setWeekOffset} cellsToSkip={cellsToSkip}
          occupiedRoomCells={occupiedRoomCells} selectedRoom={selectedRoom}
          normSelectedTeacher={normSelectedTeacher} isAuthenticated={isAuthenticated}
          bookings={bookings} onEditClass={onEditClass} onGuestBookCell={onGuestBookCell}
          typeLabels={typeLabels} t={t}
        />
      )}
      {viewMode === 'table' && (
        <div className="table-wrapper">
          <table className="schedule-table">
            <thead>
              <tr>
                <th className="group-header">{t('groupTime')}{!isAuthenticated && <div className="lock-icon">🔒</div>}</th>
                {daysToShow.map(day => (<th key={day} className={`day-header ${day === todayName ? 'today-col' : ''}`} colSpan={timeSlots.length}>{t(day)}{day === todayName && <span className="today-badge"> ★</span>}</th>))}
              </tr>
              <tr>
                <th className="group-header" />
                {daysToShow.map(day => timeSlots.map(tm => (<th key={`${day}-${tm}`} className={`time-header ${day === todayName ? 'today-time' : ''}`}>{tm}</th>)))}
              </tr>
            </thead>
            <tbody>
              {groupsToShow.map(group => (
                <tr key={group}>
                  <td className="group-cell">
                    <div className="group-cell-content">
                      <span className="group-name">{group}</span>
                      {isAuthenticated && <button className="delete-group-btn" onClick={() => { if (window.confirm(t('confirmDeleteGroup', { group }))) onDeleteGroup(group); }}>×</button>}
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
                    if (!show) return (<td key={cellKey} className={`schedule-cell filtered-out ${isToday ? 'today-cell' : ''}`} colSpan={dur}><div className="filtered-label">{t('filtered')}</div></td>);
                    let bkStyle = {}, bkLabel = null;
                    if (bk) {
                      bkStyle = bk.status === 'approved' ? { background: '#dcfce7', borderLeft: '3px solid #22c55e' } : bk.status === 'rejected' ? { background: '#fee2e2', borderLeft: '3px solid #ef4444' } : { background: '#fef9c3', borderLeft: '3px solid #eab308' };
                      bkLabel = <div style={{ fontSize: '0.68rem', marginTop: 3, fontWeight: 600, color: bk.status === 'approved' ? '#166534' : bk.status === 'rejected' ? '#991b1b' : '#854d0e', display: 'flex', alignItems: 'center', gap: 3 }}>{bk.status === 'approved' ? '✅' : bk.status === 'rejected' ? '❌' : '⏳'}<span>{bk.name || ''}</span>{bk.room && <span style={{ opacity: 0.7 }}>· {bk.room}</span>}</div>;
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
                          {bk ? (<div className="cell-content"><div className="course-name">{bk.purpose}</div><div className="teacher-name">👤 {bk.guest_name}</div>{bkLabel}</div>) : (<>
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
      )}
    </div>
  );
};

export default ScheduleTable;