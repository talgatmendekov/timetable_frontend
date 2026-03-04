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
    en: 'Applied Math', ru: 'Прикладная математика', ky: 'Колдонмо математика',
    groups: ['MATDAIS-25','MATMIE-25','MATDAIS-24','MATMIE-24','MATDAIS-23','MATMIE-23','MATH-22'],
  },
  {
    id: 'ie', icon: '⚙️',
    en: 'Industrial Engineering', ru: 'Промышленная инженерия', ky: 'Өнөр жай инженерия',
    groups: ['IEMIT-25','IEMIT-24','IEMIT-23'],
  },
  {
    id: 'ee', icon: '⚡',
    en: 'Electronics', ru: 'Электроника', ky: 'Электроника',
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
  const getClass       = (group, day, time) => schedule[`${group}-${day}-${time}`] || null;
  const typeOf         = (st) => SUBJECT_TYPES.find(s => s.value === st) || SUBJECT_TYPES[0];

  // ── Print popup ───────────────────────────────────────────────────────────
  const handlePrint = () => {
    const html = printRef.current?.innerHTML;
    if (!html) return;
    const w = window.open('', '_blank');

    // Dynamic sizing: fit all groups of a department on 1-2 A4 landscape pages
    const groupCount = selectedGroup ? 1 : filteredGroups.length;
    const colCount   = timeSlots.length + 1; // +1 for label column

    // A4 landscape usable height ≈ 190mm. Header ≈ 18mm, footer ≈ 8mm, section head ≈ 5mm per group.
    // Each table row ≈ needs ~7-9px at minimum. Target: ≤ 2 pages.
    // Row height budget per group = (190 - 18 - 8) / groupCount - 5 (section head)
    // Base font scales with both column count and group count.
    const rowBudgetMm  = Math.max(8, Math.floor((164) / Math.max(groupCount, 1)));
    const byColFont    = Math.floor(52 / colCount);           // shrink for many columns
    const byGroupFont  = Math.floor(rowBudgetMm * 0.85);     // shrink for many groups
    const baseFontPx   = Math.max(4, Math.min(7, Math.min(byColFont, byGroupFont)));
    const cellPad      = groupCount <= 4 ? '3px 2px' : groupCount <= 8 ? '2px 2px' : '1px 1px';
    const thFontPx     = Math.max(3.5, baseFontPx - 0.5);
    const sectionGap   = groupCount <= 6 ? '5px' : '3px';
    const headerPad    = groupCount <= 6 ? '8px 12px' : '5px 10px';

    w.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>Schedule — Alatoo International University</title>
      <style>
        @page { size: A4 landscape; margin: 5mm 6mm; }
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: Arial, Helvetica, sans-serif; font-size:${baseFontPx}px; color:#000; background:#fff; }

        .pv-header {
          background: #0f172a; padding: ${headerPad};
          display:flex; align-items:center; justify-content:space-between;
        }
        .pv-header-left { display:flex; align-items:center; gap:8px; }
        .pv-header-logo { display:none; }
        .pv-header-seal {
          width:28px; height:28px; background:#fff; border:2px solid #818cf8;
          border-radius:50%; display:flex; align-items:center; justify-content:center;
          font-size:6px; font-weight:900; color:#4f46e5; letter-spacing:-0.5px;
          flex-shrink:0;
        }
        .pv-header-title { font-size:10px; font-weight:800; color:#fff; }
        .pv-header-sub   { font-size:6px; color:#94a3b8; margin-top:1px; }
        .pv-header-dept  { font-size:6.5px; font-weight:700; color:#818cf8; text-transform:uppercase; letter-spacing:0.07em; }
        .pv-header-date  { font-size:6px; color:#cbd5e1; margin-top:2px; }
        .pv-header-meta  { text-align:right; }

        .pv-sections { padding:4px 6px 6px; display:flex; flex-direction:column; gap:5px; }

        .pv-section-head { display:flex; align-items:center; gap:4px; margin-bottom:1px; }
        .pv-section-icon {
          width:13px; height:13px; border-radius:3px; background:#6366f1;
          display:flex; align-items:center; justify-content:center; font-size:7px;
        }
        .pv-section-name  { font-size:7px; font-weight:700; color:#0f172a; }
        .pv-section-count { font-size:5.5px; color:#94a3b8; margin-left:3px; background:#f1f5f9; padding:1px 4px; border-radius:99px; }

        table { width:100%; border-collapse:collapse; table-layout:fixed; border:1px solid #d1d5db; }
        thead { background:#f3f4f6; }
        th {
          padding:${cellPad}; font-size:${thFontPx}px; font-weight:700;
          text-transform:uppercase; letter-spacing:0.04em; color:#6b7280;
          border-bottom:1.5px solid #d1d5db; border-right:1px solid #e5e7eb;
          text-align:center; white-space:nowrap; overflow:hidden;
        }
        th:last-child { border-right:none; }
        th.th-label { text-align:left; padding-left:4px; background:#e9ebee; color:#374151; }

        tr:nth-child(even) { background:#f9fafb; }
        td {
          padding:${cellPad}; border-bottom:1px solid #e5e7eb;
          border-right:1px solid #e5e7eb; vertical-align:top; overflow:hidden;
        }
        td:last-child { border-right:none; }
        tr:last-child td { border-bottom:none; }
        td.td-label {
          font-weight:700; font-size:${Math.max(4.5, baseFontPx - 0.5)}px; color:#374151;
          background:#f3f4f6; white-space:nowrap; padding-left:4px;
          border-right:2px solid #d1d5db;
        }

        .pv-cell { display:flex; flex-direction:column; gap:1px; }
        .pv-cell-pill {
          display:inline-block; padding:0 2px; border-radius:2px;
          font-size:${Math.max(4, baseFontPx - 1.5)}px; font-weight:700; color:#fff; margin-bottom:1px;
        }
        .pv-cell-course  { font-size:${Math.max(4.5, baseFontPx - 0.5)}px; font-weight:700; color:#111827; line-height:1.2; }
        .pv-cell-teacher { font-size:${Math.max(4, baseFontPx - 1)}px; color:#6b7280; line-height:1.2; }
        .pv-cell-room    { font-size:${Math.max(4, baseFontPx - 1.5)}px; color:#9ca3af; line-height:1.2; }
        .pv-cell-empty   { color:#e5e7eb; text-align:center; font-size:8px; }

        .pv-footer {
          border-top:1px solid #e5e7eb; padding:4px 8px;
          display:flex; justify-content:space-between; background:#f9fafb;
        }
        .pv-footer-txt { font-size:5.5px; color:#9ca3af; }

        /* Each section breaks to new page if it won't fit */
        .pv-section { page-break-inside: avoid; }

        * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      </style>
    </head><body>${html}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  };

  // ── Cell renderer ─────────────────────────────────────────────────────────
  // Short text labels for subject types (no emoji for official print)
  const typeShort = (st) => {
    const map = { lecture:'Lec', seminar:'Sem', lab:'Lab', practice:'Prac', other:'—' };
    return map[st] || 'Lec';
  };

  const renderCell = (cls) => {
    if (!cls) return <span className="pv-cell-empty"> </span>;
    const ts = typeOf(cls.subjectType);
    return (
      <div className="pv-cell">
        <span className="pv-cell-pill" style={{ background: ts.color }}>{typeShort(cls.subjectType)}</span>
        <span className="pv-cell-course">{cls.course}</span>
        {cls.teacher && <span className="pv-cell-teacher">{cls.teacher}</span>}
        {cls.room    && <span className="pv-cell-room">{cls.room}</span>}
      </div>
    );
  };

  // ── Render sections ───────────────────────────────────────────────────────
  const renderByGroup = () =>
    (selectedGroup ? [selectedGroup] : filteredGroups).map(group => {
      const total = days.reduce((a, d) => a + timeSlots.filter(tm => getClass(group, d, tm)).length, 0);
      return (
        <div key={group} className="pv-section">
          <div className="pv-section-head">
            <span className="pv-section-name">{group}</span>
            <span className="pv-section-count">{total} classes / week</span>
          </div>
          <table className="pv-table">
            <thead>
              <tr>
                <th className="th-label" style={{width:52}}>{t('day')||'Day'}</th>
                {timeSlots.map(tm => <th key={tm}>{tm}</th>)}
              </tr>
            </thead>
            <tbody>
              {days.map(day => (
                <tr key={day}>
                  <td className="td-label">{t(day)||day}</td>
                  {timeSlots.map(tm => <td key={tm}>{renderCell(getClass(group, day, tm))}</td>)}
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
          <span className="pv-section-name">{t(day)||day}</span>
          <span className="pv-section-count">{filteredGroups.length} groups</span>
        </div>
        <table className="pv-table">
          <thead>
            <tr>
              <th className="th-label" style={{width:70}}>{t('groupTime')||'Group'}</th>
              {timeSlots.map(tm => <th key={tm}>{tm}</th>)}
            </tr>
          </thead>
          <tbody>
            {filteredGroups.map(group => (
              <tr key={group}>
                <td className="td-label">{group}</td>
                {timeSlots.map(tm => <td key={tm}>{renderCell(getClass(group, day, tm))}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ));

  return (
    <div className="pv-wrap">

      {/* ── Controls ── */}
      <div className="pv-bar">

        <div className="pv-ctrl">
          <span className="pv-lbl">🏛 Department</span>
          <div className="pv-row">
            {[{id:'',icon:'🌐',en:'All',ru:'Все',ky:'Баары'}, ...DEPARTMENTS].map(d => (
              <button
                key={d.id}
                className={`pv-btn${deptId === d.id ? ' pv-btn-on' : ''}`}
                onClick={() => { setDeptId(d.id); setSelectedGroup(''); }}
              >
                {d.icon} {deptLabel(d) || 'All'}
              </button>
            ))}
          </div>
        </div>

        <div className="pv-ctrl">
          <span className="pv-lbl">View</span>
          <div className="pv-row">
            <button className={`pv-mode${mode==='group'?' pv-mode-on':''}`} onClick={()=>setMode('group')}>👥 By Group</button>
            <button className={`pv-mode${mode==='day'?' pv-mode-on':''}`}   onClick={()=>setMode('day')}>📅 By Day</button>
          </div>
        </div>

        {mode === 'group' ? (
          <div className="pv-ctrl">
            <span className="pv-lbl">{t('selectGroup')||'Group'}</span>
            <select className="pv-sel" value={selectedGroup} onChange={e=>setSelectedGroup(e.target.value)}>
              <option value="">All ({filteredGroups.length})</option>
              {filteredGroups.map(g=><option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        ) : (
          <div className="pv-ctrl">
            <span className="pv-lbl">{t('selectDay')||'Day'}</span>
            <select className="pv-sel" value={selectedDay} onChange={e=>setSelectedDay(e.target.value)}>
              <option value="">All days</option>
              {days.map(d=><option key={d} value={d}>{t(d)||d}</option>)}
            </select>
          </div>
        )}

        <button className="pv-print" onClick={handlePrint}>🖨️ Print / PDF</button>
      </div>

      {dept && (
        <div className="pv-badge">
          {dept.icon} <strong>{deptLabel(dept)}</strong> — {filteredGroups.length} groups
          <button className="pv-badge-x" onClick={()=>setDeptId('')}>✕</button>
        </div>
      )}

      {/* ── Printable preview ── */}
      <div ref={printRef} className="pv-preview">
        <div className="pv-header">
          <div className="pv-header-left">
            <div className="pv-header-seal">AIU</div>
            <div>
              <div className="pv-header-title">Alatoo International University</div>
              <div className="pv-header-sub">Academic Schedule — {new Date().getFullYear()}</div>
            </div>
          </div>
          <div className="pv-header-meta">
            <div className="pv-header-dept">{dept ? deptLabel(dept) : 'All Departments'}</div>
            <div className="pv-header-date">{new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</div>
          </div>
        </div>

        <div className="pv-sections">
          {mode === 'group' ? renderByGroup() : renderByDay()}
        </div>

        <div className="pv-footer">
          <span className="pv-footer-txt">Alatoo International University · Bishkek, Kyrgyzstan</span>
          <span className="pv-footer-txt">Internal use only · {new Date().getFullYear()}</span>
        </div>
      </div>
    </div>
  );
};

export default PrintView;