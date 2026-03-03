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
  const [deptId, setDeptId]           = useState('');
  const printRef = useRef();

  const dept = DEPARTMENTS.find(d => d.id === deptId);
  const deptLabel = (d) => d[lang] || d.en;
  const filteredGroups = deptId ? groups.filter(g => dept?.groups.includes(g)) : groups;

  const getClass  = (group, day, time) => schedule[`${group}-${day}-${time}`] || null;
  const typeOf    = (st) => SUBJECT_TYPES.find(s => s.value === st) || SUBJECT_TYPES[0];

  const handlePrint = () => {
    const html = printRef.current?.innerHTML;
    if (!html) return;
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>Schedule — Alatoo International University</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,sans-serif;font-size:11px;color:#000;padding:16px}
        h1{font-size:15px;text-align:center;margin:0 0 4px}
        h2{font-size:11px;text-align:center;color:#555;margin:0 0 14px}
        h3{font-size:11px;margin:14px 0 5px;padding:4px 8px;background:#f0f0f0;border-left:3px solid #6366f1}
        table{width:100%;border-collapse:collapse;margin-bottom:12px;page-break-inside:avoid}
        th,td{border:1px solid #ccc;padding:4px 6px;font-size:9px;vertical-align:top}
        th{background:#e8e8e8;font-weight:700;text-align:center;white-space:nowrap}
        .course{font-weight:700;font-size:9px}
        .teacher,.room{color:#555;font-size:8px}
        .pill{display:inline-block;padding:1px 4px;border-radius:3px;font-size:7px;color:#fff;margin-bottom:2px}
        .empty{color:#bbb;text-align:center}
        @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
      </style></head><body>${html}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  };

  const renderCell = (cls) => {
    if (!cls) return <span className="empty">—</span>;
    const ts = typeOf(cls.subjectType);
    return <>
      <div className="pill" style={{background: ts.color}}>{ts.icon}</div>
      <div className="course">{cls.course}</div>
      {cls.teacher && <div className="teacher">👨‍🏫 {cls.teacher}</div>}
      {cls.room    && <div className="room">🚪 {cls.room}</div>}
    </>;
  };

  const renderByGroup = () =>
    (selectedGroup ? [selectedGroup] : filteredGroups).map(group => (
      <div key={group} style={{marginBottom:24}}>
        <h3>📋 {group}</h3>
        <table>
          <thead><tr>
            <th style={{width:70}}>{t('day')||'Day'}</th>
            {timeSlots.map(tm => <th key={tm}>{tm}</th>)}
          </tr></thead>
          <tbody>{days.map(day => (
            <tr key={day}>
              <td style={{fontWeight:700,background:'#f8f8f8',whiteSpace:'nowrap'}}>{t(day)||day}</td>
              {timeSlots.map(tm => <td key={tm}>{renderCell(getClass(group,day,tm))}</td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
    ));

  const renderByDay = () =>
    (selectedDay ? [selectedDay] : days).map(day => (
      <div key={day} style={{marginBottom:24}}>
        <h3>📅 {t(day)||day}</h3>
        <table>
          <thead><tr>
            <th style={{width:110}}>{t('groupTime')||'Group'}</th>
            {timeSlots.map(tm => <th key={tm}>{tm}</th>)}
          </tr></thead>
          <tbody>{filteredGroups.map(group => (
            <tr key={group}>
              <td style={{fontWeight:700,background:'#f8f8f8'}}>{group}</td>
              {timeSlots.map(tm => <td key={tm}>{renderCell(getClass(group,day,tm))}</td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
    ));

  return (
    <div style={{maxWidth:1100,margin:'0 auto',padding:'24px 16px'}}>

      {/* Controls */}
      <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:14,padding:'20px 24px',marginBottom:20,display:'flex',flexWrap:'wrap',gap:20,alignItems:'flex-end'}}>

        {/* Department */}
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <label style={{fontSize:'0.75rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'#64748b'}}>🏛 Department</label>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {[{id:'',icon:'🌐',en:'All',ru:'Все',ky:'Баары'},...DEPARTMENTS].map(d => (
              <button key={d.id}
                onClick={() => { setDeptId(d.id); setSelectedGroup(''); }}
                style={{
                  padding:'7px 13px',border:'1.5px solid',borderRadius:9,
                  fontSize:'0.83rem',fontWeight: deptId===d.id ? 700 : 500,cursor:'pointer',
                  background: deptId===d.id ? '#6366f1' : '#fff',
                  color:      deptId===d.id ? '#fff'    : '#374151',
                  borderColor:deptId===d.id ? '#6366f1' : '#e2e8f0',
                  transition:'all 0.15s',
                }}
              >{d.icon} {deptLabel(d)}</button>
            ))}
          </div>
        </div>

        {/* Mode */}
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <label style={{fontSize:'0.75rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'#64748b'}}>{t('printByGroup')||'Mode'}</label>
          <div style={{display:'flex',gap:6}}>
            {[{id:'group',label:`👥 ${t('printByGroup')||'By Group'}`},{id:'day',label:`📅 ${t('printByDay')||'By Day'}`}].map(m => (
              <button key={m.id} onClick={()=>setMode(m.id)} style={{
                padding:'7px 16px',border:'1.5px solid',borderRadius:9,fontSize:'0.88rem',
                fontWeight: mode===m.id ? 700 : 500,cursor:'pointer',
                background: mode===m.id ? '#4f46e5' : '#fff',
                color:      mode===m.id ? '#fff'    : '#374151',
                borderColor:mode===m.id ? '#4f46e5' : '#e2e8f0',
              }}>{m.label}</button>
            ))}
          </div>
        </div>

        {/* Group select */}
        {mode === 'group' && (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <label style={{fontSize:'0.75rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'#64748b'}}>{t('filterByGroup')||'Group'}</label>
            <select value={selectedGroup} onChange={e=>setSelectedGroup(e.target.value)}
              style={{padding:'8px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:'0.9rem',minWidth:180,background:'#fff'}}>
              <option value="">{t('allGroups')||'All Groups'} ({filteredGroups.length})</option>
              {filteredGroups.map(g=><option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        )}

        {/* Day select */}
        {mode === 'day' && (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <label style={{fontSize:'0.75rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'#64748b'}}>{t('filterByDay')||'Day'}</label>
            <select value={selectedDay} onChange={e=>setSelectedDay(e.target.value)}
              style={{padding:'8px 12px',border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:'0.9rem',minWidth:160,background:'#fff'}}>
              <option value="">{t('allDays')||'All Days'}</option>
              {days.map(d=><option key={d} value={d}>{t(d)||d}</option>)}
            </select>
          </div>
        )}

        <button onClick={handlePrint} style={{
          padding:'10px 24px',background:'#4f46e5',color:'#fff',border:'none',
          borderRadius:10,fontSize:'0.95rem',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',
        }}>🖨️ {t('printNow')||'Print / PDF'}</button>
      </div>

      {/* Dept badge */}
      {dept && (
        <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'#eef2ff',border:'1.5px solid #c7d2fe',borderRadius:10,padding:'7px 14px',marginBottom:16,fontSize:'0.88rem',color:'#3730a3'}}>
          {dept.icon} <strong>{deptLabel(dept)}</strong> — {filteredGroups.length} groups
          <button onClick={()=>setDeptId('')} style={{background:'none',border:'none',cursor:'pointer',color:'#6366f1',fontSize:'1rem',padding:'0 0 0 4px'}}>✕</button>
        </div>
      )}

      {/* Printable area */}
      <div ref={printRef}>
        <h1>🏛 Alatoo International University</h1>
        <h2>{dept ? deptLabel(dept) : (t('tabSchedule')||'Schedule')} — {new Date().toLocaleDateString()}</h2>
        {mode === 'group' ? renderByGroup() : renderByDay()}
      </div>
    </div>
  );
};

export default PrintView;