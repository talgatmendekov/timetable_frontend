// src/components/PrintView.js
import React, { useState } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { useLanguage } from '../context/LanguageContext';
import { SUBJECT_TYPES, SUBJECT_TYPE_LABELS } from '../data/i18n';
import './PrintView.css';

const PrintView = () => {
  const { groups, timeSlots, days, schedule } = useSchedule();
  const { t, lang } = useLanguage();
  const typeLabels = SUBJECT_TYPE_LABELS[lang] || SUBJECT_TYPE_LABELS.en;

  const [printMode, setPrintMode] = useState('group'); // 'group' | 'day'
  const [selected, setSelected]   = useState(groups[0] || '');

  const getClass = (group, day, time) => schedule[`${group}-${day}-${time}`] || null;
  const getTypeStyle = (st) => SUBJECT_TYPES.find(s => s.value === st) || SUBJECT_TYPES[0];

  const handlePrint = () => window.print();

  // Build rows for group view: rows=days, cols=times
  const renderGroupTable = (group) => (
    <table className="print-table">
      <thead>
        <tr>
          <th className="print-th-day">{t('day') || 'Day'}</th>
          {timeSlots.map(t => <th key={t} className="print-th-time">{t}</th>)}
        </tr>
      </thead>
      <tbody>
        {days.map(day => (
          <tr key={day}>
            <td className="print-day-cell"><strong>{t(day)}</strong></td>
            {timeSlots.map(time => {
              const cls = getClass(group, day, time);
              const ts  = cls ? getTypeStyle(cls.subjectType) : null;
              return (
                <td key={time} className="print-class-cell"
                  style={ts ? { borderTop: `3px solid ${ts.color}` } : {}}>
                  {cls && (
                    <>
                      <div className="print-course">{cls.course}</div>
                      {cls.teacher && <div className="print-meta">👨‍🏫 {cls.teacher}</div>}
                      {cls.room    && <div className="print-meta">🚪 {cls.room}</div>}
                      {ts && <div className="print-type" style={{ color: ts.color }}>
                        {ts.icon} {typeLabels[cls.subjectType]}
                      </div>}
                    </>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );

  // Build rows for day view: rows=groups, cols=times
  const renderDayTable = (day) => (
    <table className="print-table">
      <thead>
        <tr>
          <th className="print-th-group">{t('groupTime')}</th>
          {timeSlots.map(t => <th key={t} className="print-th-time">{t}</th>)}
        </tr>
      </thead>
      <tbody>
        {groups.map(group => (
          <tr key={group}>
            <td className="print-group-cell"><strong>{group}</strong></td>
            {timeSlots.map(time => {
              const cls = getClass(group, day, time);
              const ts  = cls ? getTypeStyle(cls.subjectType) : null;
              return (
                <td key={time} className="print-class-cell"
                  style={ts ? { borderTop: `3px solid ${ts.color}` } : {}}>
                  {cls && (
                    <>
                      <div className="print-course">{cls.course}</div>
                      {cls.teacher && <div className="print-meta">👨‍🏫 {cls.teacher}</div>}
                      {cls.room    && <div className="print-meta">🚪 {cls.room}</div>}
                    </>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="print-view">
      {/* Controls — hidden when printing */}
      <div className="print-controls no-print">
        <h2 className="print-title-label">🖨️ {t('printExport') || 'Print / PDF Export'}</h2>

        <div className="print-mode-tabs">
          <button className={`mode-tab ${printMode === 'group' ? 'active' : ''}`}
            onClick={() => { setPrintMode('group'); setSelected(groups[0] || ''); }}>
            {t('printByGroup') || 'By Group'}
          </button>
          <button className={`mode-tab ${printMode === 'day' ? 'active' : ''}`}
            onClick={() => { setPrintMode('day'); setSelected(days[0] || ''); }}>
            {t('printByDay') || 'By Day'}
          </button>
        </div>

        <div className="print-selector-row">
          <label>{printMode === 'group' ? t('selectGroup') || 'Select Group:' : t('selectDay') || 'Select Day:'}</label>
          <select className="print-select" value={selected} onChange={e => setSelected(e.target.value)}>
            {printMode === 'group'
              ? groups.map(g => <option key={g} value={g}>{g}</option>)
              : days.map(d => <option key={d} value={d}>{t(d)}</option>)
            }
          </select>
          <button className="btn-print" onClick={handlePrint}>
            🖨️ {t('printNow') || 'Print / Save as PDF'}
          </button>
        </div>

        {/* Color legend */}
        <div className="print-legend">
          {SUBJECT_TYPES.map(type => (
            <span key={type.value} className="print-legend-item">
              <span className="print-legend-dot" style={{ background: type.color }} />
              {type.icon} {typeLabels[type.value]}
            </span>
          ))}
        </div>
      </div>

      {/* Printable content */}
      <div className="print-document">
        <div className="print-header">
          <h1 className="print-doc-title">
            {printMode === 'group'
              ? `${t('appTitle')} — ${selected}`
              : `${t('appTitle')} — ${t(selected)}`}
          </h1>
          <p className="print-date">
            {t('printedOn') || 'Printed on'}: {new Date().toLocaleDateString()}
          </p>
        </div>

        {printMode === 'group' && selected && renderGroupTable(selected)}
        {printMode === 'day'   && selected && renderDayTable(selected)}

        <div className="print-footer">
          <span>{t('appTitle')}</span>
          <span>{t('appSubtitle')}</span>
        </div>
      </div>
    </div>
  );
};

export default PrintView;
