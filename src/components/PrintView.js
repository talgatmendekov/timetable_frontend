// src/components/PrintView.js
import React, { useState, useRef } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { useLanguage } from '../context/LanguageContext';
import { SUBJECT_TYPES } from '../data/i18n';

const DEPARTMENTS = [
  {
    id: 'cs', icon: '💻',
    en: 'Computer Science', ru: 'Компьютерные науки', ky: 'Компьютердик илимдер',
    groups: ['COMSE-25','COMCEH-25','COMFCI-25','COMCEH-24','COMSE-24','COMFCI-24',
             'COMSEH-23','COMSE-23/1-Group','COMSE-23/2-Group','COMFCI-23','COM-22/1-Group','COM-22/2-Group'],
  },
  {
    id: 'math', icon: '📐',
    en: 'Applied Math & Informatics', ru: 'Прикладная математика', ky: 'Колдонмо математика',
    groups: ['MATDAIS-25','MATMIE-25','MATDAIS-24','MATMIE-24','MATDAIS-23','MATMIE-23','MATH-22'],
  },
  {
    id: 'ie', icon: '⚙️',
    en: 'Industrial Engineering', ru: 'Промышленная инженерия', ky: 'Өнөр жай инженерия',
    groups: ['IEMIT-25','IEMIT-24','IEMIT-23'],
  },
  {
    id: 'ee', icon: '⚡',
    en: 'Electronics & Nanoelectronics', ru: 'Электроника и наноэлектроника', ky: 'Электроника',
    groups: ['EEAIR-25','EEAIR-24','EEAIR-23'],
  },
];

const PrintView = () => {
  const { groups, schedule, timeSlots, days } = useSchedule();
  const { t, lang } = useLanguage();
  const [mode, setMode]               = useState('group');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedDay, setSelectedDay]     = useState('');
  const [deptId, setDeptId]               = useState('');
  const printRef = useRef();

  const dept         = DEPARTMENTS.find(d => d.id === deptId);
  const deptLabel    = (d) => d?.[lang] || d?.en || '';
  const filteredGroups = deptId ? groups.filter(g => dept?.groups.includes(g)) : groups;

  const getClass = (group, day, time) => schedule[`${group}-${day}-${time}`] || null;
  const typeOf   = (st) => SUBJECT_TYPES.find(s => s.value === st) || SUBJECT_TYPES[0];

  const handlePrint = () => {
    const html = printRef.current?.innerHTML;
    if (!html) return;
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>Schedule — Alatoo International University</title>
      <style>
        @page { size: A4 landscape; margin: 8mm; }
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: Arial, sans-serif; font-size: 8px; color: #000; }
        h1 { font-size: 12px; text-align: center; margin: 0 0 2px; font-weight: 800; }
        h2 { font-size: 9px; text-align: center; color: #555; margin: 0 0 8px; }
        h3 { font-size: 9px; margin: 8px 0 4px; padding: 3px 6px; background: #f0f0f0; border-left: 3px solid #6366f1; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; page-break-inside: avoid; table-layout: fixed; }
        th, td { border: 1px solid #ccc; padding: 2px 3px; font-size: 7px; vertical-align: top; overflow: hidden; }
        th { background: #e8e8e8; font-weight: 700; text-align: center; white-space: nowrap; }
        td.day-col { font-weight: 700; background: #f8f8f8; white-space: nowrap; width: 55px; font-size: 7px; }
        td.group-col { font-weight: 700; background: #f8f8f8; white-space: nowrap; width: 65px; font-size: 7px; }
        .course { font-weight: 700; font-size: 7px; line-height: 1.2; }
        .teacher, .room { color: #555; font-size: 6px; line-height: 1.2; }
        .pill { display: inline-block; padding: 0 3px; border-radius: 2px; font-size: 6px; color: #fff; margin-bottom: 1px; }
        .empty { color: #ccc; text-align: center; font-size: 9px; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
      </head><body>${html}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  };

  const renderCell = (cls) => {
    if (!cls) return <span className="empty">—</span>;
    const ts = typeOf(cls.subjectType);
    return (
      <div>
        <span className="pill" style={{background: ts.color}}>{ts.icon}</span>
        <div className="course">{cls.course}</div>
        {cls.teacher && <div className="teacher">{cls.teacher}</div>}
        {cls.room    && <div className="room">🚪{cls.room}</div>}
      </div>
    );
  };

  const renderByGroup = () =>
    (selectedGroup ? [selectedGroup] : filteredGroups).map(group => (
      <div key={group} className="print-section">
        <h3>📋 {group}</h3>
        <table>
          <thead><tr>
            <th style={{width:55}}>{t('day')||'Day'}</th>
            {timeSlots.map(tm => <th key={tm}>{tm}</th>)}
          </tr></thead>
          <tbody>{days.map(day => (
            <tr key={day}>
              <td className="day-col">{t(day)||day}</td>
              {timeSlots.map(tm => <td key={tm}>{renderCell(getClass(group, day, tm))}</td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
    ));

  const renderByDay = () =>
    (selectedDay ? [selectedDay] : days).map(day => (
      <div key={day} className="print-section">
        <h3>📅 {t(day)||day}</h3>
        <table>
          <thead><tr>
            <th style={{width:70}}>{t('groupTime')||'Group'}</th>
            {timeSlots.map(tm => <th key={tm}>{tm}</th>)}
          </tr></thead>
          <tbody>{filteredGroups.map(group => (
            <tr key={group}>
              <td className="group-col">{group}</td>
              {timeSlots.map(tm => <td key={tm}>{renderCell(getClass(group, day, tm))}</td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
    ));

  return (
    <div className="print-view-wrap">

      {/* ── Controls bar — matches original app style ── */}
      <div className="print-controls-bar">

        {/* Department picker */}
        <div className="print-ctrl-group">
          <span className="print-ctrl-label">🏛 Department</span>
          <div className="print-dept-row">
            <button className={`print-dept-btn${deptId===''?' active':''}`}
              onClick={() => { setDeptId(''); setSelectedGroup(''); }}>
              🌐 {t('allGroups')||'All'}
            </button>
            {DEPARTMENTS.map(d => (
              <button key={d.id}
                className={`print-dept-btn${deptId===d.id?' active':''}`}
                onClick={() => { setDeptId(d.id); setSelectedGroup(''); }}
                title={d.groups.join(', ')}
              >
                {d.icon} {deptLabel(d)}
              </button>
            ))}
          </div>
        </div>

        {/* View mode */}
        <div className="print-ctrl-group">
          <span className="print-ctrl-label">{t('printByGroup')||'View'}</span>
          <div className="print-mode-row">
            <button className={`print-mode-btn${mode==='group'?' active':''}`} onClick={()=>setMode('group')}>
              👥 {t('printByGroup')||'By Group'}
            </button>
            <button className={`print-mode-btn${mode==='day'?' active':''}`} onClick={()=>setMode('day')}>
              📅 {t('printByDay')||'By Day'}
            </button>
          </div>
        </div>

        {/* Group / Day selector */}
        {mode === 'group' ? (
          <div className="print-ctrl-group">
            <span className="print-ctrl-label">{t('selectGroup')||'Group'}</span>
            <select className="print-select" value={selectedGroup} onChange={e=>setSelectedGroup(e.target.value)}>
              <option value="">{t('allGroups')||'All'} ({filteredGroups.length})</option>
              {filteredGroups.map(g=><option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        ) : (
          <div className="print-ctrl-group">
            <span className="print-ctrl-label">{t('selectDay')||'Day'}</span>
            <select className="print-select" value={selectedDay} onChange={e=>setSelectedDay(e.target.value)}>
              <option value="">{t('allDays')||'All'}</option>
              {days.map(d=><option key={d} value={d}>{t(d)||d}</option>)}
            </select>
          </div>
        )}

        <button className="print-btn" onClick={handlePrint}>
          🖨️ {t('printNow')||'Print / PDF'}
        </button>
      </div>

      {/* Dept badge */}
      {dept && (
        <div className="print-dept-badge">
          {dept.icon} <strong>{deptLabel(dept)}</strong> — {filteredGroups.length} groups
          <button className="print-dept-badge-x" onClick={()=>setDeptId('')}>✕</button>
        </div>
      )}

      {/* Preview */}
      <div ref={printRef} className="print-preview">
        <h1>🏛 Alatoo International University</h1>
        <h2>
          {dept ? deptLabel(dept) : (t('tabSchedule')||'Schedule')}
          {' — '}{new Date().toLocaleDateString()}
        </h2>
        {mode === 'group' ? renderByGroup() : renderByDay()}
      </div>
    </div>
  );
};

export default PrintView;