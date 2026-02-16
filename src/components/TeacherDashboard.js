// src/components/TeacherDashboard.js
import React, { useState, useMemo } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { useLanguage } from '../context/LanguageContext';
import { SUBJECT_TYPES, SUBJECT_TYPE_LABELS } from '../data/i18n';
import './TeacherDashboard.css';

const TeacherDashboard = () => {
  const { schedule, teachers, days, timeSlots } = useSchedule();
  const { t, lang } = useLanguage();
  const typeLabels = SUBJECT_TYPE_LABELS[lang] || SUBJECT_TYPE_LABELS.en;

  const [selectedTeacher, setSelectedTeacher] = useState(teachers[0] || '');

  // Build full stats for all teachers
  const allStats = useMemo(() => {
    return teachers.map(teacher => {
      const classes = Object.values(schedule).filter(
        e => e.teacher?.toLowerCase() === teacher.toLowerCase()
      );
      const byDay = {};
      days.forEach(d => { byDay[d] = []; });
      classes.forEach(c => { if (byDay[c.day]) byDay[c.day].push(c); });

      const byType = {};
      SUBJECT_TYPES.forEach(st => { byType[st.value] = 0; });
      classes.forEach(c => {
        const type = c.subjectType || 'lecture';
        byType[type] = (byType[type] || 0) + 1;
      });

      const freeDays = days.filter(d => byDay[d].length === 0);

      return { teacher, classes, byDay, byType, freeDays, total: classes.length };
    }).sort((a, b) => b.total - a.total);
  }, [schedule, teachers, days]);

  // Selected teacher detail
  const detail = useMemo(() => {
    return allStats.find(s => s.teacher === selectedTeacher);
  }, [allStats, selectedTeacher]);

  // Heatmap: for selected teacher, intensity = classes per (day, time) slot
  const heatmap = useMemo(() => {
    if (!detail) return {};
    const map = {};
    detail.classes.forEach(c => {
      map[`${c.day}-${c.time}`] = (map[`${c.day}-${c.time}`] || 0) + 1;
    });
    return map;
  }, [detail]);

  const maxHeat = Math.max(...Object.values(heatmap), 1);

  const heatColor = (val) => {
    if (!val) return 'transparent';
    const intensity = val / maxHeat;
    const r = Math.round(37  + (239 - 37)  * (1 - intensity));
    const g = Math.round(99  + (68  - 99)  * (1 - intensity));
    const b = Math.round(235 + (68  - 235) * (1 - intensity));
    return `rgba(${r},${g},${b},${0.15 + intensity * 0.75})`;
  };

  if (teachers.length === 0) {
    return (
      <div className="dashboard-empty">
        <div className="empty-icon">👨‍🏫</div>
        <h3>{t('noTeachersYet') || 'No teachers yet'}</h3>
        <p>{t('addClassesFirst') || 'Add some classes with teacher names to see the dashboard.'}</p>
      </div>
    );
  }

  return (
    <div className="teacher-dashboard">
      <h2 className="dashboard-title">📊 {t('teacherDashboard') || 'Teacher Workload Dashboard'}</h2>

      {/* Overview cards — all teachers */}
      <div className="overview-grid">
        {allStats.map(stat => (
          <button
            key={stat.teacher}
            className={`teacher-card ${selectedTeacher === stat.teacher ? 'active' : ''}`}
            onClick={() => setSelectedTeacher(stat.teacher)}
          >
            <div className="teacher-card-name">👨‍🏫 {stat.teacher}</div>
            <div className="teacher-card-total">
              <span className="card-num">{stat.total}</span>
              <span className="card-label">{t('classesPerWeek') || 'classes/week'}</span>
            </div>
            <div className="teacher-card-days">
              {days.map(day => (
                <span
                  key={day}
                  className={`day-dot ${stat.byDay[day]?.length > 0 ? 'busy' : 'free'}`}
                  title={`${t(day)}: ${stat.byDay[day]?.length || 0} classes`}
                />
              ))}
            </div>
            {stat.freeDays.length > 0 && (
              <div className="teacher-card-free">
                🟢 {t('freeDays') || 'Free'}: {stat.freeDays.map(d => t(d).slice(0,3)).join(', ')}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Detail panel for selected teacher */}
      {detail && (
        <div className="detail-panel">
          <div className="detail-header">
            <h3>👨‍🏫 {detail.teacher}</h3>
            <div className="detail-summary">
              <div className="summary-chip">
                <span className="chip-num">{detail.total}</span>
                <span className="chip-label">{t('totalClasses') || 'Total Classes'}</span>
              </div>
              <div className="summary-chip">
                <span className="chip-num">{days.length - detail.freeDays.length}</span>
                <span className="chip-label">{t('workDays') || 'Work Days'}</span>
              </div>
              <div className="summary-chip free">
                <span className="chip-num">{detail.freeDays.length}</span>
                <span className="chip-label">{t('freeDays') || 'Free Days'}</span>
              </div>
            </div>
          </div>

          {/* Subject type breakdown */}
          <div className="type-breakdown">
            <h4>{t('bySubjectType') || 'By Subject Type'}</h4>
            <div className="type-bars">
              {SUBJECT_TYPES.map(st => {
                const count = detail.byType[st.value] || 0;
                const pct = detail.total > 0 ? (count / detail.total) * 100 : 0;
                return (
                  <div key={st.value} className="type-bar-row">
                    <span className="type-bar-label" style={{ color: st.color }}>
                      {st.icon} {typeLabels[st.value]}
                    </span>
                    <div className="type-bar-track">
                      <div className="type-bar-fill"
                        style={{ width: `${pct}%`, background: st.color }}
                      />
                    </div>
                    <span className="type-bar-count" style={{ color: st.color }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-day breakdown */}
          <div className="day-breakdown">
            <h4>{t('byDay') || 'Classes Per Day'}</h4>
            <div className="day-bars">
              {days.map(day => {
                const count = detail.byDay[day]?.length || 0;
                const maxDay = Math.max(...days.map(d => detail.byDay[d]?.length || 0), 1);
                const pct = (count / maxDay) * 100;
                return (
                  <div key={day} className="day-bar-col">
                    <div className="day-bar-track">
                      <div className="day-bar-fill" style={{ height: `${pct}%` }} />
                    </div>
                    <span className="day-bar-num">{count}</span>
                    <span className="day-bar-label">{t(day).slice(0,3)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Weekly heatmap */}
          <div className="heatmap-section">
            <h4>{t('weeklyHeatmap') || 'Weekly Schedule Heatmap'}</h4>
            <div className="heatmap-wrapper">
              <table className="heatmap-table">
                <thead>
                  <tr>
                    <th className="hm-corner" />
                    {timeSlots.map(time => (
                      <th key={time} className="hm-time">{time}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {days.map(day => (
                    <tr key={day}>
                      <td className="hm-day">{t(day).slice(0,3)}</td>
                      {timeSlots.map(time => {
                        const key = `${day}-${time}`;
                        const val = heatmap[key] || 0;
                        const cls = detail.classes.find(c => c.day === day && c.time === time);
                        return (
                          <td key={time}
                            className={`hm-cell ${val > 0 ? 'hm-busy' : 'hm-free'}`}
                            style={{ background: heatColor(val) }}
                            title={cls ? `${cls.course} (${cls.group})` : ''}
                          >
                            {val > 0 && <span className="hm-dot" />}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="heatmap-legend">
                <span>{t('free') || 'Free'}</span>
                <div className="hm-gradient" />
                <span>{t('busy') || 'Busy'}</span>
              </div>
            </div>
          </div>

          {/* Class list */}
          <div className="class-list-section">
            <h4>{t('allClasses') || 'All Classes This Week'}</h4>
            <div className="class-list">
              {days.map(day => detail.byDay[day]?.length > 0 && (
                <div key={day} className="class-list-day">
                  <div className="class-list-day-header">{t(day)}</div>
                  {detail.byDay[day].map((cls, i) => {
                    const ts = SUBJECT_TYPES.find(s => s.value === (cls.subjectType || 'lecture'));
                    return (
                      <div key={i} className="class-list-item"
                        style={{ borderLeft: `3px solid ${ts?.color}` }}>
                        <span className="cli-time">{cls.time}</span>
                        <span className="cli-course">{cls.course}</span>
                        <span className="cli-group">{cls.group}</span>
                        {cls.room && <span className="cli-room">🚪 {cls.room}</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
