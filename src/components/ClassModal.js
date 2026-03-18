// src/components/ClassModal.js
import React, { useState, useEffect, useMemo } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { useLanguage } from '../context/LanguageContext';
import { SUBJECT_TYPES, SUBJECT_TYPE_LABELS } from '../data/i18n';
import './ClassModal.css';

const DURATIONS = [1, 2, 3, 4, 5, 6];

export default function ClassModal({ isOpen, onClose, group, day, time }) {
  const { schedule, addOrUpdateClass, deleteClass, teachers, timeSlots, groups, days } = useSchedule();
  const { t, lang } = useLanguage();
  const typeLabels = SUBJECT_TYPE_LABELS[lang] || SUBJECT_TYPE_LABELS.en;

  const existingClass = isOpen && group && day && time
    ? schedule[`${group}-${day}-${time}`] || null
    : null;

  const [form, setForm] = useState({
    course: '', teacher: '', room: '',
    subjectType: 'lecture', duration: 1, meetingLink: '',
  });
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [linkError, setLinkError] = useState('');

  // ── Duplicate mode ─────────────────────────────────────────────────────
  const [dupMode,   setDupMode]   = useState(false);
  const [dupGroup,  setDupGroup]  = useState('');
  const [dupDay,    setDupDay]    = useState('');
  const [dupTime,   setDupTime]   = useState('');
  const [dupSaving, setDupSaving] = useState(false);
  const [dupDone,   setDupDone]   = useState(false);

  // ── Derived: all unique course names in schedule (for autocomplete) ────
  const allCourses = useMemo(() =>
    [...new Set(Object.values(schedule).map(e => e.course).filter(Boolean))].sort()
  , [schedule]);

  // ── Derived: all unique rooms in schedule ─────────────────────────────
  const allRooms = useMemo(() =>
    [...new Set(Object.values(schedule).map(e => e.room).filter(Boolean))].sort()
  , [schedule]);

  // ── Room conflict check ────────────────────────────────────────────────
  const roomConflict = useMemo(() => {
    if (!form.room.trim() || !day || !time) return null;
    const roomNorm = form.room.trim().toLowerCase();
    return Object.values(schedule).find(e =>
      e.room?.toLowerCase() === roomNorm &&
      e.day === day && e.time === time &&
      !(existingClass && e.group === group && e.day === day && e.time === time)
    ) || null;
  }, [form.room, day, time, schedule, existingClass, group]);

  // ── Duration clock preview: "9:00 — 10:20" ────────────────────────────
  const durationPreview = useMemo(() => {
    if (!time || !form.duration) return null;
    try {
      const [h, m] = time.split(':').map(Number);
      const totalMins = h * 60 + m + (form.duration * 40);
      const endH = Math.floor(totalMins / 60) % 24;
      const endM  = totalMins % 60;
      return `${time} — ${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}`;
    } catch { return null; }
  }, [time, form.duration]);

  useEffect(() => {
    if (isOpen) {
      setForm({
        course:      existingClass?.course      || '',
        teacher:     existingClass?.teacher     || '',
        room:        existingClass?.room        || '',
        subjectType: existingClass?.subjectType || 'lecture',
        duration:    existingClass?.duration    || 1,
        meetingLink: existingClass?.meetingLink || '',
      });
      setLinkError('');
      setDupMode(false); setDupDone(false);
      setDupGroup(''); setDupDay(''); setDupTime('');
    }
  }, [isOpen, group, day, time]);

  if (!isOpen) return null;

  const validateLink = (url) => {
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) return t('meetingLinkError') || 'Link must start with https://';
    return '';
  };

  const handleSave = async () => {
    if (!form.course.trim()) return;
    const err = validateLink(form.meetingLink);
    if (err) { setLinkError(err); return; }
    setSaving(true);
    try {
      await addOrUpdateClass(group, day, time, {
        course:      form.course.trim(),
        teacher:     form.teacher.trim(),
        room:        form.room.trim(),
        subjectType: form.subjectType,
        duration:    Number(form.duration),
        meetingLink: form.meetingLink.trim(),
      });
      onClose();
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm(t('confirmDeleteClass') || 'Delete this class?')) return;
    setDeleting(true);
    try { await deleteClass(group, day, time); onClose(); }
    finally { setDeleting(false); }
  };

  // ── Duplicate handler ─────────────────────────────────────────────────
  const handleDuplicate = async () => {
    if (!dupGroup || !dupDay || !dupTime) return;
    setDupSaving(true);
    try {
      await addOrUpdateClass(dupGroup, dupDay, dupTime, {
        course:      form.course.trim(),
        teacher:     form.teacher.trim(),
        room:        form.room.trim(),
        subjectType: form.subjectType,
        duration:    Number(form.duration),
        meetingLink: form.meetingLink.trim(),
      });
      setDupDone(true);
    } finally { setDupSaving(false); }
  };

  const typeStyle = SUBJECT_TYPES.find(s => s.value === form.subjectType) || SUBJECT_TYPES[0];

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content cm-modal">
        <div className="modal-header cm-header" style={{ borderLeft: `4px solid ${typeStyle.color}` }}>
          <div>
            <div className="cm-header-meta">{group} · {t(day) || day} · {time}</div>
            <h2 className="cm-header-title">
              {existingClass ? (t('editClass') || 'Edit Class') : (t('addClass') || 'Add Class')}
            </h2>
          </div>
          <button className="cm-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body cm-body">
          {/* Subject type pills */}
          <div className="cm-field">
            <label className="cm-label">{t('subjectType') || 'Type'}</label>
            <div className="cm-type-row">
              {SUBJECT_TYPES.map(type => (
                <button
                  key={type.value}
                  type="button"
                  className={`cm-type-btn ${form.subjectType === type.value ? 'active' : ''}`}
                  style={form.subjectType === type.value
                    ? { background: type.color, borderColor: type.color, color: '#fff' }
                    : { borderColor: type.color, color: type.color }}
                  onClick={() => setForm(f => ({ ...f, subjectType: type.value }))}
                >
                  {type.icon} {typeLabels[type.value]}
                </button>
              ))}
            </div>
          </div>

          {/* Course */}
          <div className="cm-field">
            <label className="cm-label">{t('courseName') || 'Course'} *</label>
            <input
              className="cm-input"
              list="cm-courses"
              placeholder={t('courseNamePlaceholder') || 'e.g. Linear Algebra'}
              value={form.course}
              onChange={e => setForm(f => ({ ...f, course: e.target.value }))}
              autoFocus
            />
            <datalist id="cm-courses">
              {allCourses.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>

          {/* Teacher */}
          <div className="cm-field">
            <label className="cm-label">{t('teacher') || 'Teacher'}</label>
            <input
              className="cm-input"
              list="cm-teachers"
              placeholder={t('teacherPlaceholder') || 'Teacher name'}
              value={form.teacher}
              onChange={e => setForm(f => ({ ...f, teacher: e.target.value }))}
            />
            <datalist id="cm-teachers">
              {teachers.map(tc => <option key={tc} value={tc} />)}
            </datalist>
          </div>

          {/* Room + Duration row */}
          <div className="cm-row">
            <div className="cm-field cm-field-half">
              <label className="cm-label">{t('room') || 'Room'}</label>
              <input
                className={`cm-input${roomConflict ? ' cm-input-warn' : ''}`}
                list="cm-rooms"
                placeholder="e.g. B201"
                value={form.room}
                onChange={e => setForm(f => ({ ...f, room: e.target.value }))}
              />
              <datalist id="cm-rooms">
                {allRooms.map(r => <option key={r} value={r} />)}
              </datalist>
              {roomConflict && (
                <div className="cm-room-conflict">
                  ⚠️ {roomConflict.room} is booked by {roomConflict.group} — {roomConflict.course}
                </div>
              )}
            </div>
            <div className="cm-field cm-field-half">
              <label className="cm-label">{t('duration') || 'Duration'}</label>
              <select
                className="cm-input"
                value={form.duration}
                onChange={e => setForm(f => ({ ...f, duration: Number(e.target.value) }))}
              >
                {DURATIONS.map(d => (
                  <option key={d} value={d}>
                    {d} {d > 1 ? (t('slots') || 'slots') : (t('slot') || 'slot')} ({d * 40} {t('examMinutes') || 'min'})
                  </option>
                ))}
              </select>
              {durationPreview && (
                <div className="cm-duration-preview">⏱ {durationPreview}</div>
              )}
            </div>
          </div>

          {/* Meeting link */}
          <div className="cm-field">
            <label className="cm-label">
              🔗 {t('meetingLink') || 'Meeting Link'}
              <span className="cm-label-hint"> — Zoom, Teams, Meet ({t('optional') || 'optional'})</span>
            </label>
            <div className="cm-link-row">
              <input
                className={`cm-input ${linkError ? 'cm-input-error' : ''}`}
                placeholder="https://zoom.us/j/... or https://teams.microsoft.com/..."
                value={form.meetingLink}
                onChange={e => { setForm(f => ({ ...f, meetingLink: e.target.value })); setLinkError(''); }}
              />
              {form.meetingLink && !linkError && (
                <a href={form.meetingLink} target="_blank" rel="noopener noreferrer" className="cm-link-test">
                  {t('test') || 'Test'} ↗
                </a>
              )}
            </div>
            {linkError && <div className="cm-error">{linkError}</div>}
          </div>
        </div>

        {/* ── Duplicate panel ── */}
        {existingClass && (
          <div className="cm-dup-panel">
            {!dupMode ? (
              <button className="cm-dup-toggle" onClick={() => setDupMode(true)}>
                📋 {t('duplicateClass') || 'Duplicate to another slot'}
              </button>
            ) : (
              <div className="cm-dup-body">
                <div className="cm-dup-title">📋 {t('duplicateTo') || 'Duplicate to'}</div>
                <div className="cm-dup-row">
                  <select className="cm-input cm-dup-select" value={dupGroup} onChange={e => setDupGroup(e.target.value)}>
                    <option value="">{t('selectGroup') || 'Group…'}</option>
                    {(groups || []).map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <select className="cm-input cm-dup-select" value={dupDay} onChange={e => setDupDay(e.target.value)}>
                    <option value="">{t('selectDay') || 'Day…'}</option>
                    {(days || []).map(d => <option key={d} value={d}>{t(d) || d}</option>)}
                  </select>
                  <select className="cm-input cm-dup-select" value={dupTime} onChange={e => setDupTime(e.target.value)}>
                    <option value="">{t('examTime') || 'Time…'}</option>
                    {(timeSlots || []).map(tm => <option key={tm} value={tm}>{tm}</option>)}
                  </select>
                </div>
                <div className="cm-dup-actions">
                  <button className="cm-btn cm-btn-cancel" onClick={() => { setDupMode(false); setDupDone(false); }}>
                    {t('cancel') || 'Cancel'}
                  </button>
                  <button
                    className="cm-btn cm-btn-dup"
                    onClick={handleDuplicate}
                    disabled={dupSaving || !dupGroup || !dupDay || !dupTime || dupDone}
                  >
                    {dupSaving ? '...' : dupDone ? '✅ ' + (t('duplicated') || 'Duplicated!') : (t('duplicate') || 'Duplicate')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="modal-footer cm-footer">
          {existingClass && (
            <button className="cm-btn cm-btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? '...' : '🗑 ' + (t('delete') || 'Delete')}
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="cm-btn cm-btn-cancel" onClick={onClose}>
            {t('cancel') || 'Cancel'}
          </button>
          <button
            className="cm-btn cm-btn-save"
            onClick={handleSave}
            disabled={saving || !form.course.trim()}
            style={{ background: typeStyle.color }}
          >
            {saving ? '...' : (existingClass ? (t('save') || 'Save') : (t('add') || 'Add'))}
          </button>
        </div>
      </div>
    </div>
  );
}