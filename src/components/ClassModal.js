// src/components/ClassModal.js

import React, { useState, useEffect } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { useLanguage } from '../context/LanguageContext';
import { SUBJECT_TYPES, SUBJECT_TYPE_LABELS } from '../data/i18n';
import './ClassModal.css';

const ClassModal = ({ isOpen, onClose, group, day, time }) => {
  const { getClassByKey, addOrUpdateClass, deleteClass, schedule, timeSlots } = useSchedule();
  const { t, lang } = useLanguage();

  const [course, setCourse]           = useState('');
  const [teacher, setTeacher]         = useState('');
  const [room, setRoom]               = useState('');
  const [subjectType, setSubjectType] = useState('lecture');
  const [duration, setDuration]       = useState(1);
  const [conflicts, setConflicts]     = useState([]);

  // Calculate which slots this class would occupy
  const getOccupiedSlots = (startTime, dur) => {
    const startIdx = timeSlots.indexOf(startTime);
    if (startIdx === -1) return [startTime];
    const slots = [];
    for (let i = 0; i < dur && startIdx + i < timeSlots.length; i++) {
      slots.push(timeSlots[startIdx + i]);
    }
    return slots;
  };

  // Calculate max duration available from this time slot
  const getMaxDuration = () => {
    const startIdx = timeSlots.indexOf(time);
    if (startIdx === -1) return 1;
    return Math.min(3, timeSlots.length - startIdx);
  };

  useEffect(() => {
    if (isOpen && group && day && time) {
      const classData = getClassByKey(group, day, time);
      if (classData) {
        setCourse(classData.course || '');
        setTeacher(classData.teacher || '');
        setRoom(classData.room || '');
        setSubjectType(classData.subjectType || 'lecture');
        setDuration(classData.duration || 1);
      } else {
        setCourse(''); setTeacher(''); setRoom(''); 
        setSubjectType('lecture'); setDuration(1);
      }
      setConflicts([]);
    }
  }, [isOpen, group, day, time, getClassByKey]);

  // Detect conflicts across all slots the class will occupy
  useEffect(() => {
    if (!isOpen || !day || !time) return;
    const detected = [];
    const slots = getOccupiedSlots(time, duration);

    slots.forEach(slot => {
      // Check teacher conflict
      if (teacher.trim()) {
        Object.values(schedule).forEach(entry => {
          if (entry.day === day && entry.time === slot && entry.group !== group &&
              entry.teacher?.toLowerCase() === teacher.trim().toLowerCase()) {
            detected.push({
              type: 'teacher',
              message: t('teacherConflict', { teacher: entry.teacher }),
              detail: t('teacherConflictIn', { group: entry.group }) + ` (${slot})`
            });
          }
        });
      }

      // Check room conflict
      if (room.trim()) {
        Object.values(schedule).forEach(entry => {
          if (entry.day === day && entry.time === slot && entry.group !== group &&
              entry.room?.toLowerCase() === room.trim().toLowerCase()) {
            detected.push({
              type: 'room',
              message: t('roomConflict', { room: entry.room }),
              detail: t('roomConflictIn', { group: entry.group }) + ` (${slot})`
            });
          }
        });
      }

      // Check if slot is already occupied by another class
      if (slot !== time) { // Don't check the starting slot (we're editing/replacing it)
        const existingClass = getClassByKey(group, day, slot);
        if (existingClass) {
          detected.push({
            type: 'occupied',
            message: t('slotOccupied') || 'Time slot already occupied',
            detail: `${slot}: ${existingClass.course}`
          });
        }
      }
    });

    setConflicts(detected);
  }, [teacher, room, day, time, duration, group, schedule, t, isOpen, timeSlots, getClassByKey]);

  const handleSave = () => {
    if (!course.trim()) { alert(t('courseNameRequired')); return; }
    if (conflicts.some(c => c.type === 'occupied')) {
      alert(t('cannotSaveOccupied') || 'Cannot save: some time slots are already occupied. Please choose a shorter duration or delete conflicting classes first.');
      return;
    }
    if (conflicts.length > 0) {
      const proceed = window.confirm(
        `${t('warningTitle')}\n\n` +
        conflicts.map(c => `${c.message} ${c.detail}`).join('\n') +
        `\n\n${t('conflictWarning')}`
      );
      if (!proceed) return;
    }

    // Save the class with duration
    addOrUpdateClass(group, day, time, {
      course: course.trim(), 
      teacher: teacher.trim(),
      room: room.trim(), 
      subjectType,
      duration
    });
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm(t('confirmDelete'))) { 
      deleteClass(group, day, time); 
      onClose(); 
    }
  };

  if (!isOpen) return null;

  const existingClass = getClassByKey(group, day, time);
  const typeLabels = SUBJECT_TYPE_LABELS[lang] || SUBJECT_TYPE_LABELS.en;
  const activeType = SUBJECT_TYPES.find(s => s.value === subjectType);
  const maxDur = getMaxDuration();
  const occupiedSlots = getOccupiedSlots(time, duration);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ borderBottom: `3px solid ${activeType?.color}` }}>
          <h2>{existingClass ? t('editClass') : t('addClass')}</h2>
          <button className="close-btn" onClick={onClose}>Ã—</button>
        </div>

        <div className="modal-info">
          <span className="info-badge">{group}</span>
          <span className="info-badge">{day}</span>
          <span className="info-badge">{time}</span>
          <span className="info-badge type-badge" style={{ 
            background: activeType?.light, 
            color: activeType?.color, 
            borderColor: activeType?.color 
          }}>
            {activeType?.icon} {typeLabels[subjectType]}
          </span>
          <span className="info-badge duration-badge">
            â± {duration * 40} {t('minutes') || 'min'}
          </span>
        </div>

        {/* Duration info */}
        {duration > 1 && (
          <div className="duration-info">
            <strong>{t('occupiesSlots') || 'Occupies slots'}:</strong> {occupiedSlots.join(' â†’ ')}
          </div>
        )}

        {/* Subject Type Selector */}
        <div className="type-selector">
          {SUBJECT_TYPES.map(type => (
            <button
              key={type.value}
              className={`type-btn ${subjectType === type.value ? 'active' : ''}`}
              style={subjectType === type.value
                ? { background: type.color, borderColor: type.color, color: '#fff' }
                : { borderColor: type.color, color: type.color }
              }
              onClick={() => setSubjectType(type.value)}
            >
              {type.icon} {typeLabels[type.value]}
            </button>
          ))}
        </div>

        {/* Conflict warnings */}
        {conflicts.length > 0 && (
          <div className="conflicts-container">
            <div className="conflicts-title">{t('warningTitle')}</div>
            {conflicts.map((conflict, idx) => (
              <div key={idx} className={`conflict-item conflict-${conflict.type}`}>
                <span className="conflict-msg">{conflict.message}</span>
                <span className="conflict-detail">{conflict.detail}</span>
              </div>
            ))}
          </div>
        )}

        <div className="modal-body">
          <div className="form-group">
            <label>{t('courseName')} *</label>
            <input type="text" value={course} autoFocus
              onChange={e => setCourse(e.target.value)}
              placeholder="e.g., Data Structures"
              style={{ borderColor: activeType?.color }}
            />
          </div>

          <div className="form-group">
            <label>{t('duration') || 'Duration'} *</label>
            <select 
              value={duration} 
              onChange={e => setDuration(parseInt(e.target.value))}
              className="duration-select"
            >
              <option value={1}>1 {t('slot') || 'slot'} (40 {t('min') || 'min'})</option>
              {maxDur >= 2 && <option value={2}>2 {t('slots') || 'slots'} (80 {t('min') || 'min'})</option>}
              {maxDur >= 3 && <option value={3}>3 {t('slots') || 'slots'} (120 {t('min') || 'min'})</option>}
            </select>
            <div className="duration-hint">
              {duration === 1 && (t('oneSlot') || 'Single 40-minute period')}
              {duration === 2 && (t('twoSlots') || 'Two consecutive 40-minute periods')}
              {duration === 3 && (t('threeSlots') || 'Three consecutive 40-minute periods')}
            </div>
          </div>

          <div className="form-group">
            <label>{t('teacherName')}</label>
            <input type="text" value={teacher}
              onChange={e => setTeacher(e.target.value)}
              placeholder="e.g., Prof. Smith"
              className={conflicts.some(c => c.type === 'teacher') ? 'input-conflict' : ''}
            />
          </div>

          <div className="form-group">
            <label>{t('roomNumber')}</label>
            <input type="text" value={room}
              onChange={e => setRoom(e.target.value)}
              placeholder="e.g., Room 305"
              className={conflicts.some(c => c.type === 'room') ? 'input-conflict' : ''}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary">{t('cancel')}</button>
          {existingClass && (
            <button onClick={handleDelete} className="btn btn-danger">{t('delete')}</button>
          )}
          <button
            onClick={handleSave}
            className="btn btn-primary"
            style={conflicts.length === 0 ? { background: activeType?.color } : { background: '#f59e0b' }}
          >
            {conflicts.length > 0 ? `${t('save')}` : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClassModal;