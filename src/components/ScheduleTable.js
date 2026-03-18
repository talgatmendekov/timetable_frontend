// src/components/ScheduleTable.js
import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
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

// ── Mobile: collapsible day sections with slot cards ──────────────────────
const MobileView = ({
  daysToShow, groupsToShow, timeSlots, schedule, todayName,
  cellsToSkip, occupiedRoomCells, selectedRoom, normSelectedTeacher,
  isAuthenticated, bookings, onEditClass, onGuestBookCell, onDeleteGroup,
  typeLabels, t, showEmpty,
}) => {
  const [collapsed, setCollapsed] = useState({});

  const getClass   = (group, day, time) => schedule[`${group}-${day}-${time}`] || null;
  const getBooking = (group, day, time) => {
    const classEntry = schedule[`${group}-${day}-${time}`];
    if (classEntry?.room)
      return bookings.find(b => b.room === classEntry.room && b.day === day && b.start_time === time) || null;
    return bookings.find(b => b.day === day && b.start_time === time &&
      (b.entity === group || b.name === group)) || null;
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
  const toggleDay = (day) => setCollapsed(c => ({ ...c, [day]: !c[day] }));

  return (
    <div>
      {daysToShow.map(day => {
        const isToday    = day === todayName;
        const isCollapsed = collapsed[day];
        const classCount = groupsToShow.reduce((acc, group) =>
          acc + timeSlots.filter(time => {
            const cls = getClass(group, day, time);
            return cls && !cellsToSkip.has(`${group}-${day}-${time}`);
          }).length, 0);

        return (
          <div key={day} className="mob-day-section">
            <div
              className={`mob-day-header ${isToday ? 'today' : ''} ${isCollapsed ? 'collapsed' : ''}`}
              onClick={() => toggleDay(day)}
            >
              <span>{isToday ? '★ ' : ''}{t(day) || day}</span>
              <span style={{ fontSize: '0.68rem', fontWeight: 400, opacity: 0.8 }}>
                {classCount} {classCount === 1 ? 'class' : 'classes'}
              </span>
              <span className="mob-day-chevron">▼</span>
            </div>

            {!isCollapsed && groupsToShow.map(group => {
              const slots = timeSlots.filter(time => !cellsToSkip.has(`${group}-${day}-${time}`));
              if (!slots.length) return null;
              if (!isAuthenticated) {
                const hasContent = slots.some(time => getClass(group, day, time) || getBooking(group, day, time));
                if (!hasContent) return null;
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
                    {slots.map(time => {
                      const classData    = getClass(group, day, time);
                      const booking      = getBooking(group, day, time);
                      const conflicts    = getConflicts(group, day, time, classData);
                      const typeStyle    = classData ? getTypeStyle(classData.subjectType) : null;
                      const duration     = Math.min(6, Math.max(1, parseInt(classData?.duration) || 1));
                      const durationMins = duration * 40;

                      if (normSelectedTeacher && classData &&
                        normalizeTeacherName(classData.teacher) !== normSelectedTeacher) return null;
                      if (selectedRoom && occupiedRoomCells.has(`${day}-${time}`)) return null;
                      if (!showEmpty && !classData && !booking) return null;

                      const handleClick = () => {
                        if (isAuthenticated) { onEditClass(group, day, time); return; }
                        if (!classData && !booking && onGuestBookCell) onGuestBookCell(group, day, time);
                      };

                      let bookingBorder = '';
                      let bookingInfo   = null;
                      if (booking) {
                        bookingBorder = booking.status === 'approved' ? '#22c55e'
                          : booking.status === 'rejected' ? '#ef4444' : '#eab308';
                        bookingInfo = (
                          <div className="mob-slot-booking" style={{ color: bookingBorder }}>
                            {booking.status === 'approved' ? '✅' : booking.status === 'rejected' ? '❌' : '⏳'}
                            {' '}{booking.name || ''}{booking.room ? ` · ${booking.room}` : ''}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={time}
                          className={[
                            'mob-slot',
                            conflicts.includes('teacher') ? 'conflict-t' : '',
                            conflicts.includes('room')    ? 'conflict-r' : '',
                            !classData && !booking        ? 'mob-slot-empty-row' : '',
                            duration > 1                  ? 'mob-slot-multi' : '',
                          ].filter(Boolean).join(' ')}
                          style={bookingBorder ? { borderLeft: `3px solid ${bookingBorder}` }
                            : classData && typeStyle ? { borderLeft: `3px solid ${typeStyle.color}` } : {}}
                          onClick={handleClick}
                        >
                          <div className={`mob-slot-time ${isToday ? 'today-t' : ''}`}>
                            {time}
                            {classData && duration > 1 && (
                              <span className="mob-duration-badge">⏱ {durationMins}m</span>
                            )}
                          </div>
                          <div className="mob-slot-body">
                            {classData ? (
                              <>
                                {typeStyle && (
                                  <span className="mob-slot-pill" style={{ background: typeStyle.color }}>
                                    {typeStyle.icon} {typeLabels[classData.subjectType || 'lecture']}
                                  </span>
                                )}
                                <div className="mob-slot-course">{classData.course}</div>
                                <div className="mob-slot-meta">
                                  {classData.teacher && <span>👨‍🏫 {classData.teacher}</span>}
                                  {classData.room    && <span>🚪 {classData.room}</span>}
                                  {classData.meetingLink && (
                                    <a href={classData.meetingLink} target="_blank" rel="noopener noreferrer"
                                      className="meeting-link-btn" onClick={e => e.stopPropagation()}>🔗 Join</a>
                                  )}
                                  {conflicts.length > 0 && (
                                    <span className="mob-conflict-badge">
                                      {conflicts.includes('teacher') ? '⚠️ teacher' : ''}
                                      {conflicts.includes('room')    ? '⚠️ room'    : ''}
                                    </span>
                                  )}
                                </div>
                                {bookingInfo}
                              </>
                            ) : booking ? (
                              <>
                                <div className="mob-slot-course">{booking.purpose}</div>
                                <div className="mob-slot-meta"><span>👤 {booking.guest_name}</span></div>
                                {bookingInfo}
                              </>
                            ) : isAuthenticated ? (
                              <span className="mob-slot-empty">＋</span>
                            ) : onGuestBookCell ? (
                              <span className="mob-slot-empty guest-hint">＋ book</span>
                            ) : null}
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

// ── Event detail popup (Google Calendar style) ───────────────────────────
const GCalPopup = ({ event, anchorRect, onClose, onEdit, isAuthenticated, typeLabels }) => {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [onClose]);

  if (!event) return null;
  const { classData, booking, group, day, time } = event;

  const TYPE_HEADER = {
    lecture: '#4285f4',
    lab:     '#34a853',
    seminar: '#f9ab00',
  };
  const BOOKING_HEADER = { approved: '#34a853', rejected: '#ea4335', pending: '#f9ab00' };

  const typeKey    = classData?.subjectType || 'lecture';
  const headerBg   = booking
    ? (BOOKING_HEADER[booking.status] || BOOKING_HEADER.pending)
    : (TYPE_HEADER[typeKey] || TYPE_HEADER.lecture);

  // Smart positioning
  const PW = 296, PH = 300;
  const vw = window.innerWidth, vh = window.innerHeight;
  let left = (anchorRect?.right ?? 0) + 12;
  let top  = (anchorRect?.top ?? 0) + window.scrollY;
  if (left + PW > vw - 12)  left = (anchorRect?.left ?? PW + 12) - PW - 12;
  if (left < 12)             left = 12;
  if (top  + PH > vh + window.scrollY - 12)
    top = Math.max(window.scrollY + 12, top - ((top + PH) - (vh + window.scrollY - 12)));

  return (
    <div className="gcpop-overlay" onMouseDown={onClose}>
      <div
        ref={ref}
        className="gcpop"
        style={{ top, left }}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="gcpop-header" style={{ background: headerBg }}>
          <span className="gcpop-type-label">
            {booking
              ? `${booking.status === 'approved' ? '✅' : booking.status === 'rejected' ? '❌' : '⏳'} ${booking.status}`
              : `${SUBJECT_TYPES.find(s => s.value === typeKey)?.icon || ''} ${typeLabels[typeKey] || typeKey}`}
          </span>
          <button className="gcpop-close" onClick={onClose}>✕</button>
        </div>
        <div className="gcpop-body">
          <div className="gcpop-title">{classData?.course || booking?.purpose || '—'}</div>
          <div className="gcpop-rows">
            <div className="gcpop-row"><span className="gcpop-icon">🗓</span><span>{day} · {time}</span></div>
            <div className="gcpop-row"><span className="gcpop-icon">👥</span><strong>{group}</strong></div>
            {classData?.teacher && <div className="gcpop-row"><span className="gcpop-icon">👨‍🏫</span><span>{classData.teacher}</span></div>}
            {classData?.room    && <div className="gcpop-row"><span className="gcpop-icon">🚪</span><span>{classData.room}</span></div>}
            {classData?.duration > 1 && <div className="gcpop-row"><span className="gcpop-icon">⏱</span><span>{classData.duration * 40} min</span></div>}
            {classData?.meetingLink && (
              <div className="gcpop-row">
                <span className="gcpop-icon">🔗</span>
                <a href={classData.meetingLink} target="_blank" rel="noopener noreferrer" className="gcpop-link" onClick={e => e.stopPropagation()}>Join meeting</a>
              </div>
            )}
            {booking?.guest_name && <div className="gcpop-row"><span className="gcpop-icon">👤</span><span>{booking.guest_name}</span></div>}
            {booking?.room       && <div className="gcpop-row"><span className="gcpop-icon">🚪</span><span>{booking.room}</span></div>}
          </div>
          {isAuthenticated && (
            <button className="gcpop-edit-btn" onClick={() => { onEdit(); onClose(); }}>
              ✏️ Edit class
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Google Calendar week view ─────────────────────────────────────────────
const CalendarView = ({
  daysToShow, groupsToShow, timeSlots, schedule, days,
  todayName, weekOffset, onShiftWeek,
  cellsToSkip, occupiedRoomCells, selectedRoom, normSelectedTeacher,
  isAuthenticated, bookings, onEditClass, onGuestBookCell,
  typeLabels, t,
}) => {
  const [popup, setPopup] = useState(null);

  const getClass   = (group, day, time) => schedule[`${group}-${day}-${time}`] || null;
  const getBooking = (group, day, time) => {
    const classEntry = schedule[`${group}-${day}-${time}`];
    if (classEntry?.room)
      return bookings.find(b => b.room === classEntry.room && b.day === day && b.start_time === time) || null;
    return bookings.find(b => b.day === day && b.start_time === time &&
      (b.entity === group || b.name === group)) || null;
  };

  // Exact pastel palette from screenshot
  const TYPE_COLORS = {
    lecture: { bg: '#c8deff', text: '#1a4d8f', border: '#4285f4' },
    lab:     { bg: '#c4e6c8', text: '#1a5c2a', border: '#34a853' },
    seminar: { bg: '#fce4b0', text: '#7a4100', border: '#f9ab00' },
  };
  const BOOKING_COLORS = {
    approved: { bg: '#c4e6c8', text: '#1a5c2a', border: '#34a853' },
    rejected: { bg: '#fdd9d7', text: '#c5221f', border: '#ea4335' },
    pending:  { bg: '#fce4b0', text: '#7a4100', border: '#f9ab00' },
  };

  // Compute week date labels matching screenshot format "Mon 16", "Tue 17" …
  const weekDayLabels = useMemo(() => {
    // Find the Monday of the reference week (use a fixed anchor or today)
    const now   = new Date();
    const dow   = now.getDay(); // 0=Sun
    const diff  = dow === 0 ? -6 : 1 - dow; // shift to Monday
    const mon   = new Date(now);
    mon.setDate(now.getDate() + diff + weekOffset * 7);

    return daysToShow.map((dayName, i) => {
      // Map day name to offset from Monday
      const dayIndex = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].indexOf(dayName);
      const offset   = dayIndex >= 0 ? dayIndex : i;
      const d        = new Date(mon);
      d.setDate(mon.getDate() + offset);
      const shortDay = (t(dayName) || dayName).slice(0, 3);
      return { dayName, label: `${shortDay} ${d.getDate()}`, date: d };
    });
  }, [daysToShow, weekOffset, t]);

  // Week range label "16 Mar – 20 Mar"
  const weekRangeLabel = useMemo(() => {
    if (!weekDayLabels.length) return '';
    const fmt = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const first = weekDayLabels[0].date;
    const last  = weekDayLabels[weekDayLabels.length - 1].date;
    return `${fmt(first)} – ${fmt(last)}`;
  }, [weekDayLabels]);

  const handleBlockClick = useCallback((e, group, day, time, classData, booking) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setPopup({ event: { classData, booking, group, day, time }, anchorRect: rect });
  }, []);

  return (
    <div className="gcal-wrap">

      {/* ── Nav bar ── */}
      <div className="gcal-nav">
        <button className="gcal-nav-btn" onClick={() => onShiftWeek(-1)}>← prev</button>
        <span className="gcal-nav-title">{weekRangeLabel}</span>
        <button className="gcal-nav-btn" onClick={() => onShiftWeek(1)}>next →</button>
      </div>

      {/* ── Legend ── */}
      <div className="gcal-legend">
        {Object.entries({
          lecture: { color: '#c8deff', label: 'Lecture' },
          lab:     { color: '#c4e6c8', label: 'Lab'     },
          seminar: { color: '#fce4b0', label: 'Seminar' },
        }).map(([key, { color, label }]) => (
          <div key={key} className="gcal-legend-item">
            <span className="gcal-legend-swatch" style={{ background: color, border: `1.5px solid ${TYPE_COLORS[key].border}` }} />
            <span>{label}</span>
          </div>
        ))}
        {bookings.some(b => b.status) && (
          <div className="gcal-legend-item">
            <span className="gcal-legend-swatch" style={{ background: '#fdd9d7', border: '1.5px solid #f28b82' }} />
            <span>Booked</span>
          </div>
        )}
      </div>

      {/* ── Grid ── */}
      <div className="gcal-grid-scroll">
        <div className="gcal-grid" style={{ '--gcal-cols': daysToShow.length }}>

          {/* Day header row */}
          <div className="gcal-head-row">
            <div className="gcal-head-gutter" />
            {weekDayLabels.map(({ dayName, label }) => (
              <div
                key={dayName}
                className={`gcal-head-cell ${dayName === todayName ? 'gcal-head-today' : ''}`}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Time rows */}
          {timeSlots.map(time => (
            <div key={time} className="gcal-row">
              <div className="gcal-time-gutter">{time}</div>

              {daysToShow.map(day => {
                const isToday = day === todayName;

                const blocks = groupsToShow.flatMap(group => {
                  const key = `${group}-${day}-${time}`;
                  if (cellsToSkip.has(key)) return [];
                  const classData = getClass(group, day, time);
                  if (normSelectedTeacher && classData &&
                    normalizeTeacherName(classData.teacher) !== normSelectedTeacher) return [];
                  if (selectedRoom && occupiedRoomCells.has(`${day}-${time}`)) return [];
                  const booking = getBooking(group, day, time);
                  if (!classData && !booking) return [];
                  return [{ group, classData, booking }];
                });

                return (
                  <div
                    key={day}
                    className={`gcal-cell ${isToday ? 'gcal-cell-today' : ''} ${blocks.length === 0 ? 'gcal-cell-empty' : ''}`}
                    onClick={() => {
                      if (blocks.length > 0) return;
                      if (isAuthenticated) onEditClass(groupsToShow[0] || '', day, time);
                      else if (onGuestBookCell) onGuestBookCell(groupsToShow[0] || '', day, time);
                    }}
                  >
                    {blocks.map(({ group, classData, booking }) => {
                      const duration = Math.min(6, Math.max(1, parseInt(classData?.duration) || 1));
                      const colors = booking
                        ? (BOOKING_COLORS[booking.status] || BOOKING_COLORS.pending)
                        : (TYPE_COLORS[classData?.subjectType] || TYPE_COLORS.lecture);

                      return (
                        <div
                          key={group}
                          className={`gcal-block ${duration > 1 ? 'gcal-block-multi' : ''}`}
                          style={{ '--blk-bg': colors.bg, '--blk-text': colors.text, '--blk-border': colors.border }}
                          onClick={e => handleBlockClick(e, group, day, time, classData, booking)}
                        >
                          <div className="gcal-block-name">{classData?.course || booking?.purpose}</div>
                          {classData?.room && <div className="gcal-block-room">{classData.room}</div>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Popup */}
      {popup && (
        <GCalPopup
          event={popup.event}
          anchorRect={popup.anchorRect}
          onClose={() => setPopup(null)}
          onEdit={() => onEditClass(popup.event.group, popup.event.day, popup.event.time)}
          isAuthenticated={isAuthenticated}
          typeLabels={typeLabels}
        />
      )}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────
const ScheduleTable = ({
  selectedDay, selectedTeacher, selectedGroup,
  selectedRoom,
  onEditClass, onDeleteGroup,
  bookings = [],
  onGuestBookCell,
}) => {
  const { isAuthenticated } = useAuth();
  const { groups, timeSlots, days, schedule, moveClass } = useSchedule();
  const { t, lang } = useLanguage();

  const todayName  = getTodayName();
  const daysToShow = selectedDay ? [selectedDay] : days;

  const [showEmpty,   setShowEmpty]   = useState(false);
  const [viewMode,    setViewMode]    = useState('table'); // 'table' | 'calendar'
  const [weekOffset,  setWeekOffset]  = useState(0);

  const bookingGroups = [...new Set(
    bookings
      .filter(b => ['pending','approved','rejected'].includes(b.status))
      .map(b => (b.entity?.trim()) ? b.entity.trim() : b.name)
      .filter(Boolean)
  )];
  const baseGroups   = selectedGroup ? groups.filter(g => g === selectedGroup) : groups;
  const groupsToShow = [
    ...bookingGroups.filter(g => !baseGroups.includes(g)),
    ...baseGroups,
  ];

  const typeLabels = SUBJECT_TYPE_LABELS[lang] || SUBJECT_TYPE_LABELS.en;

  const normSelectedTeacher = useMemo(
    () => selectedTeacher ? normalizeTeacherName(selectedTeacher) : '',
    [selectedTeacher]
  );

  const [dragSource, setDragSource] = useState(null);
  const [dragOver,   setDragOver]   = useState(null);
  const dragNode = useRef(null);

  const cellsToSkip = useMemo(() => {
    const s = new Set();
    Object.values(schedule).forEach(cls => {
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

  const occupiedRoomCells = useMemo(() => {
    if (!selectedRoom) return new Set();
    const s = new Set();
    Object.values(schedule).forEach(cls => {
      if (cls.room?.toLowerCase() === selectedRoom.toLowerCase()) s.add(`${cls.day}-${cls.time}`);
    });
    return s;
  }, [schedule, selectedRoom]);

  const getClass     = (group, day, time) => schedule[`${group}-${day}-${time}`] || null;
  const shouldShow   = (classData, day, time) => {
    if (normSelectedTeacher && classData && normalizeTeacherName(classData.teacher) !== normSelectedTeacher) return false;
    if (selectedRoom) return !occupiedRoomCells.has(`${day}-${time}`);
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
  const getBooking = (group, day, time) => {
    const classEntry = schedule[`${group}-${day}-${time}`];
    if (classEntry?.room) return bookings.find(b => b.room === classEntry.room && b.day === day && b.start_time === time) || null;
    return bookings.find(b => b.day === day && b.start_time === time && (b.entity === group || b.name === group)) || null;
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
  const handleDragLeave = (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); };
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
        <div className="legend-item"><span className="legend-dot" style={{ background: '#eab308' }} /><span className="legend-label">⏳ Pending</span></div>
        <div className="legend-item"><span className="legend-dot" style={{ background: '#22c55e' }} /><span className="legend-label">✅ Approved</span></div>
      </>}
      {isAuthenticated && <div className="legend-item legend-drag-hint">↔ {t('dragHint')}</div>}

      {/* Segmented view toggle */}
      <div className="view-mode-toggle">
        <button className={`vmt-btn ${viewMode === 'table'    ? 'vmt-active' : ''}`} onClick={() => setViewMode('table')}>☰ Table</button>
        <button className={`vmt-btn ${viewMode === 'calendar' ? 'vmt-active' : ''}`} onClick={() => setViewMode('calendar')}>📅 Calendar</button>
      </div>

      <button className={`empty-slot-toggle-btn${showEmpty ? ' active' : ''}`} onClick={() => setShowEmpty(s => !s)}>
        {showEmpty ? '🙈 Hide empty' : '👁 Show empty'}
      </button>
    </div>
  );

  const mobileProps = {
    daysToShow, groupsToShow, timeSlots, schedule, todayName,
    cellsToSkip, occupiedRoomCells, selectedRoom, normSelectedTeacher,
    isAuthenticated, bookings, onEditClass, onGuestBookCell, onDeleteGroup,
    typeLabels, t, showEmpty,
  };

  const calProps = {
    daysToShow, groupsToShow, timeSlots, schedule, days, todayName,
    weekOffset, onShiftWeek: setWeekOffset,
    cellsToSkip, occupiedRoomCells, selectedRoom, normSelectedTeacher,
    isAuthenticated, bookings, onEditClass, onGuestBookCell,
    typeLabels, t,
  };

  return (
    <div className="schedule-container">
      <Legend />

      {/* ── Mobile card view — always on mobile ── */}
      <MobileView {...mobileProps} />

      {/* ── Google Calendar view ── */}
      {viewMode === 'calendar' && <CalendarView {...calProps} />}

      {/* ── Desktop table view ── */}
      {viewMode === 'table' && (
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
                    const cellKey   = `${group}-${day}-${time}`;
                    if (cellsToSkip.has(cellKey)) return null;
                    const classData = getClass(group, day, time);
                    const show      = shouldShow(classData, day, time);
                    const isToday   = day === todayName;
                    const conflicts = getConflicts(group, day, time, classData);
                    const isDragSrc = dragSource?.group === group && dragSource?.day === day && dragSource?.time === time;
                    const isDragOvr = dragOver?.group   === group && dragOver?.day   === day && dragOver?.time   === time;
                    const typeStyle = classData ? getTypeStyle(classData.subjectType) : null;
                    const duration  = Math.min(6, Math.max(1, parseInt(classData?.duration) || 1));
                    const booking   = getBooking(group, day, time);

                    if (!show) return (
                      <td key={cellKey} className={`schedule-cell filtered-out ${isToday ? 'today-cell' : ''}`} colSpan={duration}>
                        <div className="filtered-label">{t('filtered')}</div>
                      </td>
                    );

                    let bookingStyle = {};
                    let bookingLabel = null;
                    if (booking) {
                      bookingStyle = booking.status === 'approved'
                        ? { background: '#dcfce7', borderLeft: '3px solid #22c55e' }
                        : booking.status === 'rejected'
                        ? { background: '#fee2e2', borderLeft: '3px solid #ef4444' }
                        : { background: '#fef9c3', borderLeft: '3px solid #eab308' };
                      bookingLabel = (
                        <div style={{ fontSize: '0.68rem', marginTop: 3, fontWeight: 600,
                          color: booking.status === 'approved' ? '#166534' : booking.status === 'rejected' ? '#991b1b' : '#854d0e',
                          display: 'flex', alignItems: 'center', gap: 3 }}>
                          {booking.status === 'approved' ? '✅' : booking.status === 'rejected' ? '❌' : '⏳'}
                          <span>{booking.name || ''}</span>
                          {booking.room && <span style={{ opacity: 0.7 }}>· {booking.room}</span>}
                        </div>
                      );
                    }

                    return (
                      <td key={cellKey}
                        className={[
                          'schedule-cell',
                          classData  ? 'filled'          : '',
                          isAuthenticated ? 'editable' : (!classData && !booking) ? 'guest-bookable' : '',
                          isToday    ? 'today-cell'       : '',
                          conflicts.includes('teacher') ? 'conflict-teacher' : '',
                          conflicts.includes('room')    ? 'conflict-room'    : '',
                          isDragSrc  ? 'drag-source'      : '',
                          isDragOvr  ? (classData ? 'drag-over-filled' : 'drag-over-empty') : '',
                          duration > 1 ? 'multi-slot'    : '',
                        ].filter(Boolean).join(' ')}
                        style={booking ? bookingStyle : (classData && typeStyle ? { background: typeStyle.light, borderLeft: `3px solid ${typeStyle.color}` } : {})}
                        colSpan={duration}
                        onClick={() => {
                          if (isAuthenticated && !dragSource) { onEditClass(group, day, time); return; }
                          if (!isAuthenticated && !classData && !booking && onGuestBookCell) onGuestBookCell(group, day, time);
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
                            {classData.teacher && <div className={`teacher-name ${conflicts.includes('teacher') ? 'conflict-text' : ''}`}>👨‍🏫 {classData.teacher}</div>}
                            {classData.room    && <div className={`room-number   ${conflicts.includes('room')    ? 'conflict-text' : ''}`}>🚪 {classData.room}</div>}
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
                                {isAuthenticated            && <div className="empty-cell">+</div>}
                                {!isAuthenticated           && <div className="guest-book-hint">📅 Click to book</div>}
                                {isDragOvr                  && <div className="drop-indicator">Drop here</div>}
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
      )}
    </div>
  );
};

export default ScheduleTable;