// src/components/PrintView.js
import React, { useState, useRef } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { useLanguage } from '../context/LanguageContext';
import { SUBJECT_TYPES } from '../data/i18n';
import './PrintView.css';

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

  const [mode, setMode]                   = useState('group');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedDay, setSelectedDay]     = useState('');
  const [deptId, setDeptId]               = useState('');
  const printRef = useRef();

  const dept           = DEPARTMENTS.find(d => d.id === deptId);
  const deptLabel      = (d) => (d && (d[lang] || d.en)) || '';
  const filteredGroups = deptId ? groups.filter(g => dept?.groups.includes(g)) : groups;

  const getClass = (group, day, time) => schedule[`${group}-${day}-${time}`] || null;
  const typeOf   = (st) => SUBJECT_TYPES.find(s => s.value === st) || SUBJECT_TYPES[0];

  // ── Print popup ──────────────────────────────────────────────────────────
  const handlePrint = () => {
    const html = printRef.current?.innerHTML;
    if (!html) return;
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>Schedule — Alatoo International University</title>
      <style>
        @page { size: A4 landscape; margin: 6mm 7mm; }
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 7px; color:#000; background:#fff; }

        .pv-header {
          background: #0f172a;
          padding: 10px 14px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .pv-header-left { display: flex; align-items: center; gap: 10px; }
        .pv-header-logo {
          width:28px; height:28px; background:#6366f1; border-radius:6px;
          display:flex; align-items:center; justify-content:center; font-size:14px;
        }
        .pv-header-title { font-size:11px; font-weight:800; color:#fff; }
        .pv-header-sub   { font-size:7px; color:#94a3b8; margin-top:1px; }
        .pv-header-dept  { font-size:7px; font-weight:700; color:#818cf8; text-transform:uppercase; letter-spacing:0.08em; }
        .pv-header-date  { font-size:7px; color:#cbd5e1; margin-top:2px; }
        .pv-header-meta  { text-align:right; }

        .pv-sections { padding: 6px 8px 8px; display:flex; flex-direction:column; gap:6px; }

        .pv-section-head { display:flex; align-items:center; gap:6px; margin-bottom:3px; }
        .pv-section-icon {
          width:16px; height:16px; border-radius:4px; background:#6366f1;
          display:flex; align-items:center; justify-content:center; font-size:9px;
        }
        .pv-section-name { font-size:8px; font-weight:700; color:#0f172a; }

        table { width:100%; border-collapse:collapse; table-layout:fixed; border:1px solid #e2e8f0; margin-bottom:2px; }
        thead { background:#f8fafc; }
        th {
          padding:3px 2px; font-size:6px; font-weight:700; text-transform:uppercase;
          letter-spacing:0.05em; color:#64748b;
          border-bottom:1px solid #e2e8f0; border-right:1px solid #edf0f4;
          text-align:center; white-space:nowrap; overflow:hidden;
        }
        th:last-child { border-right:none; }
        th.th-label { text-align:left; padding-left:5px; background:#f1f5f9; color:#475569; }
        tr:nth-child(even) { background:#fafbfd; }
        td {
          padding:2px 2px; border-bottom:1px solid #edf0f4;
          border-right:1px solid #edf0f4; vertical-align:top; overflow:hidden;
        }
        td:last-child { border-right:none; }
        tr:last-child td { border-bottom:none; }
        td.td-label {
          font-weight:700; font-size:6.5px; color:#334155;
          background:#f8fafc; white-space:nowrap;
          padding-left:5px; border-right:2px solid #e2e8f0;
        }
        .pv-cell { display:flex; flex-direction:column; gap:1px; }
        .pv-cell-pill {
          display:inline-block; padding:0 3px; border-radius:2px;
          font-size:5.5px; font-weight:700; color:#fff; margin-bottom:1px;
        }
        .pv-cell-course  { font-size:6.5px; font-weight:700; color:#0f172a; line-height:1.2; }
        .pv-cell-teacher { font-size:5.8px; color:#475569; line-height:1.2; }
        .pv-cell-room    { font-size:5.5px; color:#94a3b8; line-height:1.2; }
        .pv-cell-empty   { color:#e2e8f0; text-align:center; font-size:9px; }

        .pv-footer {
          border-top:1px solid #e2e8f0; padding:5px 10px;
          display:flex; align-items:center; justify-content:space-between;
          background:#f8fafc;
        }
        .pv-footer-txt { font-size:6px; color:#94a3b8; }

        .pv-section { page-break-inside: avoid; }
        * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      </style>
    </head><body>${html}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  };

  // ── Cell renderer ────────────────────────────────────────────────────────
  const renderCell = (cls) => {
    if (!cls) return <span className="pv-cell-empty">·</span>;
    const ts = typeOf(cls.subjectType);
    return (
      <div className="pv-cell">
        <span className="pv-cell-pill" style={{ background: ts.color }}>{ts.icon} {ts.label || ''}</span>
        <span className="pv-cell-course">{cls.course}</span>
        {cls.teacher && <span className="pv-cell-teacher">👤 {cls.teacher}</span>}
        {cls.room    && <span className="pv-cell-room">🚪 {cls.room}</span>}
      </div>
    );
  };

  // ── Render sections ──────────────────────────────────────────────────────
  const renderByGroup = () =>
    (selectedGroup ? [selectedGroup] : filteredGroups).map(group => {
      const totalClasses = days.reduce((acc, day) =>
        acc + timeSlots.filter(tm => getClass(group, day, tm)).length, 0);
      return (
        <div key={group} className="pv-section">
          <div className="pv-section-head">
            <div className="pv-section-icon">📋</div>
            <span className="pv-section-name">{group}</span>
            <span className="pv-section-count">{totalClasses} classes</span>
          </div>
          <table className="pv-table">
            <thead>
              <tr>
                <th className="th-label" style={{width:60}}>{t('day')||'Day'}</th>
                {timeSlots.map(tm => <th key={tm}>{tm}</th>)}
              </tr>
            </thead>
            <tbody>
              {days.map(day => (
                <tr key={day}>
                  <td className="td-label">{t(day)||day}</td>
                  {timeSlots.map(tm => (
                    <td key={tm}>{renderCell(getClass(group, day, tm))}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    });

  const renderByDay = () =>
    (selectedDay ? [selectedDay] : days).map(day => (
      <div key={day} className="pv-section">
        <div className="pv-section-head">
          <div className="pv-section-icon">📅</div>
          <span className="pv-section-name">{t(day)||day}</span>
          <span className="pv-section-count">{filteredGroups.length} groups</span>
        </div>
        <table className="pv-table">
          <thead>
            <tr>
              <th className="th-label" style={{width:80}}>{t('groupTime')||'Group'}</th>
              {timeSlots.map(tm => <th key={tm}>{tm}</th>)}
            </tr>
          </thead>
          <tbody>
            {filteredGroups.map(group => (
              <tr key={group}>
                <td className="td-label">{group}</td>
                {timeSlots.map(tm => (
                  <td key={tm}>{renderCell(getClass(group, day, tm))}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ));

  return (
    <div className="pv-wrap">

      {/* Controls */}
      <div className="pv-bar">

        {/* Department filter */}
        <div className="pv-ctrl">
          <span className="pv-lbl">🏛 Department</span>
          <div className="pv-row">
            {[{id:'',icon:'🌐',en:'All',ru:'Все',ky:'Баары'}, ...DEPARTMENTS].map(d => (
              <button
                key={d.id}
                className={`pv-btn${deptId === d.id ? ' pv-btn-on' : ''}`}
                onClick={() => { setDeptId(d.id); setSelectedGroup(''); }}
                title={d.groups ? d.groups.join(', ') : 'All departments'}
              >
                {d.icon} {deptLabel(d)}
              </button>
            ))}
          </div>
        </div>

        {/* View mode */}
        <div className="pv-ctrl">
          <span className="pv-lbl">View Mode</span>
          <div className="pv-row">
            <button className={`pv-mode${mode === 'group' ? ' pv-mode-on' : ''}`} onClick={() => setMode('group')}>
              👥 {t('printByGroup')||'By Group'}
            </button>
            <button className={`pv-mode${mode === 'day' ? ' pv-mode-on' : ''}`} onClick={() => setMode('day')}>
              📅 {t('printByDay')||'By Day'}
            </button>
          </div>
        </div>

        {/* Group / Day selector */}
        {mode === 'group' ? (
          <div className="pv-ctrl">
            <span className="pv-lbl">{t('selectGroup')||'Select Group'}</span>
            <select className="pv-sel" value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>
              <option value="">{t('allGroups')||'All Groups'} ({filteredGroups.length})</option>
              {filteredGroups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        ) : (
          <div className="pv-ctrl">
            <span className="pv-lbl">{t('selectDay')||'Select Day'}</span>
            <select className="pv-sel" value={selectedDay} onChange={e => setSelectedDay(e.target.value)}>
              <option value="">{t('allDays')||'All Days'}</option>
              {days.map(d => <option key={d} value={d}>{t(d)||d}</option>)}
            </select>
          </div>
        )}

        <button className="pv-print" onClick={handlePrint}>
          🖨️ {t('printNow')||'Print / Save PDF'}
        </button>
      </div>

      {/* Dept badge */}
      {dept && (
        <div className="pv-badge">
          {dept.icon} <strong>{deptLabel(dept)}</strong>
          &nbsp;—&nbsp;{filteredGroups.length} groups
          <button className="pv-badge-x" onClick={() => setDeptId('')}>✕</button>
        </div>
      )}

      {/* ── Printable preview ── */}
      <div ref={printRef} className="pv-preview">

        {/* Dark header */}
        <div className="pv-header">
          <div className="pv-header-left">
            <div className="pv-header-logo">🏛</div>
            <div>
              <div className="pv-header-title">Alatoo International University</div>
              <div className="pv-header-sub">Academic Schedule — {new Date().getFullYear()}</div>
            </div>
          </div>
          <div className="pv-header-meta">
            <div className="pv-header-dept">
              {dept ? deptLabel(dept) : (t('tabSchedule')||'All Departments')}
            </div>
            <div className="pv-header-date">Generated: {new Date().toLocaleDateString('en-GB', {day:'2-digit', month:'long', year:'numeric'})}</div>
          </div>
        </div>

        {/* Sections */}
        <div className="pv-sections">
          {mode === 'group' ? renderByGroup() : renderByDay()}
        </div>

        {/* Footer */}
        <div className="pv-footer">
          <span className="pv-footer-txt">🏛 Alatoo International University — Bishkek, Kyrgyzstan</span>
          <span className="pv-footer-txt">Confidential · Internal use only · Page 1</span>
        </div>

      </div>
    </div>
  );
};

export default PrintView;