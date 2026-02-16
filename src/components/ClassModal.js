// src/components/ClassModal.js

import React, { useState, useEffect } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { useLanguage } from '../context/LanguageContext';
import { SUBJECT_TYPES, SUBJECT_TYPE_LABELS } from '../data/i18n';
import './ClassModal.css';

const ClassModal = ({ isOpen, onClose, group, day, time }) => {
  const { getClassByKey, addOrUpdateClass, deleteClass, schedule } = useSchedule();
  const { t, lang } = useLanguage();

  const [course, setCourse]           = useState('');
  const [teacher, setTeacher]         = useState('');
  const [room, setRoom]               = useState('');
  const [subjectType, setSubjectType] = useState('lecture');
  const [conflicts, setConflicts]     = useState([]);

  useEffect(() => {
    if (isOpen && group && day && time) {
      const classData = getClassByKey(group, day, time);
      if (classData) {
        setCourse(classData.course || '');
        setTeacher(classData.teacher || '');
        setRoom(classData.room || '');
        setSubjectType(classData.subjectType || 'lecture');
      } else {
        setCourse(''); setTeacher(''); setRoom(''); setSubjectType('lecture');
      }
      setConflicts([]);
    }
  }, [isOpen, group, day, time, getClassByKey]);

  // Live conflict detection
  useEffect(() => {
    if (!isOpen || !day || !time) return;
    const detected = [];
    if (teacher.trim()) {
      Object.values(schedule).forEach(entry => {
        if (entry.day === day && entry.time === time && entry.group !== group &&
            entry.teacher?.toLowerCase() === teacher.trim().toLowerCase()) {
          detected.push({
            type: 'teacher',
            message: t('teacherConflict', { teacher: entry.teacher }),
            detail: t('teacherConflictIn', { group: entry.group })
          });
        }
      });
    }
    if (room.trim()) {
      Object.values(schedule).forEach(entry => {
        if (entry.day === day && entry.time === time && entry.group !== group &&
            entry.room?.toLowerCase() === room.trim().toLowerCase()) {
          detected.push({
            type: 'room',
            message: t('roomConflict', { room: entry.room }),
            detail: t('roomConflictIn', { group: entry.group })
          });
        }
      });
    }
    setConflicts(detected);
  }, [teacher, room, day, time, group, schedule, t, isOpen]);

  const handleSave = () => {
    if (!course.trim()) { alert(t('courseNameRequired')); return; }
    if (conflicts.length > 0) {
      const proceed = window.confirm(
        `${t('warningTitle')}\n\n` +
        conflicts.map(c => `${c.message} ${c.detail}`).join('\n') +
        `\n\n${t('conflictWarning')}`
      );
      if (!proceed) return;
    }
    addOrUpdateClass(group, day, time, {
      course: course.trim(), teacher: teacher.trim(),
      room: room.trim(), subjectType
    });
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm(t('confirmDelete'))) { deleteClass(group, day, time); onClose(); }
  };

  if (!isOpen) return null;

  const existingClass = getClassByKey(group, day, time);
  const typeLabels = SUBJECT_TYPE_LABELS[lang] || SUBJECT_TYPE_LABELS.en;
  const activeType = SUBJECT_TYPES.find(s => s.value === subjectType);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ borderBottom: `3px solid ${activeType?.color}` }}>
          <h2>{existingClass ? t('editClass') : t('addClass')}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-info">
          <span className="info-badge">{group}</span>
          <span className="info-badge">{day}</span>
          <span className="info-badge">{time}</span>
          <span className="info-badge type-badge" style={{ background: activeType?.light, color: activeType?.color, borderColor: activeType?.color }}>
            {activeType?.icon} {typeLabels[subjectType]}
          </span>
        </div>

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
            style={conflicts.length === 0
              ? { background: activeType?.color }
              : { background: '#f59e0b' }
            }
          >
            {conflicts.length > 0 ? `⚠️ ${t('save')}` : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClassModal;
