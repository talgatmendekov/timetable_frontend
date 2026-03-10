// src/components/AutoScheduler.js
import React, { useState, useCallback } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import './AutoScheduler.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://timetablebackend-production.up.railway.app/api';
const uid = () => Math.random().toString(36).slice(2, 8);

const autoSplit = (total, n) => {
  const count = Math.max(1, Math.min(n, total));
  const base  = Math.floor(total / count);
  const rem   = total % count;
  return Array.from({ length: count }, (_, i) => base + (i < rem ? 1 : 0));
};

const emptyRow = () => ({
  id: uid(), teacher: '', subject: '',
  groups: [''],          // multiple groups for same teacher+subject
  totalHours: 2, slots: [2],
  prefDays: [], prefTimes: [],
  subjectType: 'lecture',
});

const DAYS  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const TYPES = ['lecture','seminar','lab','practice'];

export default function AutoScheduler() {
  const { timeSlots, days, importSchedule, groups: existingGroups, schedule, teachers: existingTeachers } = useSchedule();

  const [rows,      setRows]      = useState([emptyRow()]);
  const [rooms,     setRooms]     = useState('');   // comma-separated
  const [labRooms,  setLabRooms]  = useState('');   // comma-separated
  const [generated, setGenerated] = useState(null);
  const [busy,      setBusy]      = useState(false);
  const [log,       setLog]       = useState([]);
  const [applied,   setApplied]   = useState(false);
  const [expandRow, setExpandRow] = useState(null); // which row shows day/time prefs

  const addLog = (msg, type='info') => setLog(p => [...p, { msg, type }]);

  // ── update a field in a row ───────────────────────────────────────────────
  const upd = (id, field, val) =>
    setRows(p => p.map(r => r.id !== id ? r : { ...r, [field]: val }));

  const changeTotalHours = (id, val) =>
    setRows(p => p.map(r => r.id !== id ? r : {
      ...r, totalHours: val, slots: autoSplit(val, r.slots.length),
    }));

  const changeSlotCount = (id, n) =>
    setRows(p => p.map(r => r.id !== id ? r : {
      ...r, slots: autoSplit(r.totalHours, n),
    }));

  const changeSlotDur = (id, si, val) =>
    setRows(p => p.map(r => r.id !== id ? r : {
      ...r, slots: r.slots.map((d, i) => i === si ? Math.max(1, val) : d),
    }));

  const togglePrefDay = (id, day) =>
    setRows(p => p.map(r => r.id !== id ? r : {
      ...r, prefDays: r.prefDays.includes(day)
        ? r.prefDays.filter(d => d !== day)
        : [...r.prefDays, day],
    }));

  const togglePrefTime = (id, tm) =>
    setRows(p => p.map(r => r.id !== id ? r : {
      ...r, prefTimes: r.prefTimes.includes(tm)
        ? r.prefTimes.filter(t => t !== tm)
        : [...r.prefTimes, tm],
    }));

  // ── parse rooms ───────────────────────────────────────────────────────────
  const getRooms = () => rooms.split(',').map(r => r.trim()).filter(Boolean);
  const getLabs  = () => labRooms.split(',').map(r => r.trim()).filter(Boolean);
  const allRooms = () => [...new Set([...getRooms(), ...getLabs()])];

  // ── algorithm ─────────────────────────────────────────────────────────────
  const runAlgorithm = useCallback(() => {
    const entries   = [];
    const conflicts = [];
    const tBusy = {}, rBusy = {}, gBusy = {}, tDayH = {};
    const key   = (d, tm) => `${d}-${tm}`;
    const initT = n => { if (!tBusy[n]) tBusy[n] = new Set(); };
    const initR = n => { if (!rBusy[n]) rBusy[n] = new Set(); };
    const initG = n => { if (!gBusy[n]) gBusy[n] = new Set(); };

    const ordered = (row) => {
      const all = [];
      days.forEach(d => timeSlots.forEach(tm => all.push({ d, tm })));
      return all.sort((a, b) => {
        const ap = (row.prefDays.includes(a.d) ? -2 : 0) + (row.prefTimes.includes(a.tm) ? -1 : 0);
        const bp = (row.prefDays.includes(b.d) ? -2 : 0) + (row.prefTimes.includes(b.tm) ? -1 : 0);
        return ap - bp;
      });
    };

    rows.forEach(row => {
      if (!row.teacher || !row.subject) return;
      const activeGroups = (row.groups || []).filter(g => g.trim());
      if (!activeGroups.length) return;
      initT(row.teacher);
      const isLab   = row.subjectType === 'lab';
      const pool    = isLab ? getLabs() : getRooms().length ? getRooms() : allRooms();
      const slotList= ordered(row);

      // Schedule each group independently
      activeGroups.forEach(grp => {
        initG(grp);
        row.slots.forEach((dur, si) => {
          let placed = false;
          for (const { d, tm } of slotList) {
            const k = key(d, tm);
            if (tBusy[row.teacher].has(k)) continue;
            if (gBusy[grp].has(k))         continue;
            if (entries.some(e => e.group === grp && e.course === row.subject && e.day === d)) continue;
            tDayH[row.teacher] = tDayH[row.teacher] || {};
            if ((tDayH[row.teacher][d] || 0) + dur > 8) continue;

            let room = '';
            if (pool.length) {
              const fr = pool.find(rn => { initR(rn); return !rBusy[rn].has(k); });
              if (!fr) continue;
              room = fr;
            }

            entries.push({ group: grp, day: d, time: tm, course: row.subject, teacher: row.teacher, room, subjectType: row.subjectType, duration: dur });
            tBusy[row.teacher].add(k);
            gBusy[grp].add(k);
            if (room) { initR(room); rBusy[room].add(k); }
            tDayH[row.teacher][d] = (tDayH[row.teacher][d] || 0) + dur;
            placed = true;
            break;
          }
          if (!placed) conflicts.push({ group: grp, subject: row.subject, teacher: row.teacher, reason: `Session ${si+1} (${dur}h) — no free slot` });
        });
      });
    });

    return { entries, conflicts };
  }, [rows, days, timeSlots, rooms, labRooms]);

  // ── Claude AI fixer ───────────────────────────────────────────────────────
  const fixWithAI = async (entries, conflicts) => {
    if (!conflicts.length) return entries;
    addLog('🤖 Asking AI to fix remaining conflicts…', 'ai');
    try {
      const token  = localStorage.getItem('scheduleToken') || '';
      const prompt = `Fix these university schedule conflicts:\n${JSON.stringify(conflicts)}\nDays:${days.join(',')}\nTimes:${timeSlots.join(',')}\nRooms:${allRooms().join(',')}\nAlready placed:${JSON.stringify(entries.slice(0,50))}\nReturn ONLY a JSON array of new entries, each with: group,day,time,course,teacher,room,subjectType,duration. No markdown.`;
      const res  = await fetch(`${API_URL}/claude/fix-schedule`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({ prompt }) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      const fixes = JSON.parse(data.text.replace(/```json|```/g,'').trim());
      if (Array.isArray(fixes) && fixes.length) {
        addLog(`✅ AI resolved ${fixes.length} conflict(s)`, 'success');
        return [...entries, ...fixes];
      }
    } catch (e) { addLog(`⚠️ AI fix failed: ${e.message}`, 'warn'); }
    return entries;
  };

  const handleGenerate = async () => {
    setBusy(true); setLog([]); setGenerated(null); setApplied(false);
    addLog('⚙️ Generating schedule…');
    await new Promise(r => setTimeout(r, 200));
    const { entries, conflicts } = runAlgorithm();
    addLog(`📋 Placed ${entries.length} sessions`, 'success');
    let final = entries;
    if (conflicts.length) {
      addLog(`⚠️ ${conflicts.length} conflict(s) — asking AI…`, 'warn');
      final = await fixWithAI(entries, conflicts);
    }
    const remaining = conflicts.filter(c => !final.some(e => e.group===c.group && e.course===c.subject));
    addLog(`🏁 Done — ${final.length} sessions placed, ${remaining.length} unresolved`, remaining.length===0?'success':'warn');
    setGenerated({ entries: final, conflicts: remaining });
    setBusy(false);
  };

  const handleApply = async () => {
    try {
      await importSchedule(JSON.stringify(generated.entries));
      setApplied(true);
      addLog('✅ Schedule applied!', 'success');
    } catch (e) { addLog(`❌ ${e.message}`, 'error'); }
  };

  // ── styles ────────────────────────────────────────────────────────────────
  const card = { background:'var(--bg-card,#fff)', border:'1px solid var(--border,#e2e8f0)', borderRadius:14, padding:'16px 18px', marginBottom:12 };
  const chip = (on) => ({
    padding:'3px 10px', borderRadius:20, fontSize:'0.72rem', fontWeight:700, cursor:'pointer',
    border: on ? '2px solid #6366f1' : '1px solid #e2e8f0',
    background: on ? '#6366f1' : 'transparent',
    color: on ? '#fff' : 'var(--text-secondary,#64748b)',
    transition:'all 0.12s',
  });
  const inp = { padding:'7px 10px', borderRadius:8, border:'1px solid var(--border,#e2e8f0)', background:'var(--bg-main,#f8fafc)', color:'var(--text-primary,#0f172a)', fontSize:'0.82rem', outline:'none', width:'100%', boxSizing:'border-box' };
  const sel = { ...inp, cursor:'pointer' };

  return (
    <div style={{ maxWidth:820, margin:'0 auto', padding:'0 0 40px', fontFamily:'-apple-system,sans-serif' }}>

      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#0f172a,#312e81)', borderRadius:16, padding:'20px 24px', color:'#fff', marginBottom:20, display:'flex', alignItems:'center', gap:14 }}>
        <div style={{ fontSize:'2rem' }}>🗓</div>
        <div>
          <div style={{ fontWeight:800, fontSize:'1.1rem' }}>Auto Schedule Generator</div>
          <div style={{ fontSize:'0.78rem', color:'#94a3b8', marginTop:2 }}>Add teachers and subjects → set hours → generate. AI fixes conflicts automatically.</div>
        </div>
      </div>

      {/* Rooms row */}
      <div style={card}>
        <div style={{ fontWeight:700, fontSize:'0.85rem', marginBottom:10, color:'var(--text-primary,#0f172a)' }}>🚪 Rooms <span style={{ fontWeight:400, color:'#94a3b8', fontSize:'0.75rem' }}>(comma separated, e.g. B201, B202)</span></div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:200 }}>
            <label style={{ fontSize:'0.72rem', color:'#64748b', fontWeight:600 }}>Regular rooms</label>
            <input style={inp} placeholder="B201, B202, A101…" value={rooms} onChange={e => setRooms(e.target.value)} />
          </div>
          <div style={{ flex:1, minWidth:200 }}>
            <label style={{ fontSize:'0.72rem', color:'#64748b', fontWeight:600 }}>Lab rooms (for lab subjects)</label>
            <input style={inp} placeholder="LAB1, LAB2…" value={labRooms} onChange={e => setLabRooms(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Teacher/Subject rows */}
      <div style={{ marginBottom:8 }}>
        <div style={{ fontWeight:700, fontSize:'0.85rem', marginBottom:8, color:'var(--text-primary,#0f172a)' }}>👨‍🏫 Teachers & Subjects</div>

        {rows.map((row, idx) => {
          const sumOk = row.slots.reduce((a,b)=>a+b,0) === row.totalHours;
          const isExp = expandRow === row.id;

          return (
            <div key={row.id} style={{ ...card, border: isExp ? '2px solid #6366f1' : '1px solid var(--border,#e2e8f0)' }}>

              {/* Main row */}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-end' }}>

                {/* Teacher */}
                <div style={{ flex:2, minWidth:140 }}>
                  <label style={{ fontSize:'0.68rem', color:'#64748b', fontWeight:600 }}>Teacher</label>
                  <input style={inp} list={`tl-${row.id}`} placeholder="Select or type…" value={row.teacher}
                    onChange={e => upd(row.id,'teacher',e.target.value)} />
                  <datalist id={`tl-${row.id}`}>{existingTeachers.map(n=><option key={n} value={n}/>)}</datalist>
                </div>

                {/* Subject */}
                <div style={{ flex:2, minWidth:140 }}>
                  <label style={{ fontSize:'0.68rem', color:'#64748b', fontWeight:600 }}>Subject</label>
                  <input style={inp} placeholder="e.g. Mathematics" value={row.subject}
                    onChange={e => upd(row.id,'subject',e.target.value)} />
                </div>

                {/* Groups — multiple */}
                <div style={{ flex:2, minWidth:150 }}>
                  <label style={{ fontSize:'0.68rem', color:'#64748b', fontWeight:600 }}>Groups (can add multiple)</label>
                  {row.groups.map((g, gi) => (
                    <div key={gi} style={{ display:'flex', gap:4, marginBottom:4 }}>
                      <input style={{ ...inp, flex:1 }} list={`gl-${row.id}-${gi}`} placeholder="CS-22…" value={g}
                        onChange={e => setRows(p => p.map(r => r.id!==row.id ? r : { ...r, groups: r.groups.map((x,i)=>i===gi?e.target.value:x) }))} />
                      <datalist id={`gl-${row.id}-${gi}`}>{existingGroups.map(g=><option key={g} value={g}/>)}</datalist>
                      {row.groups.length > 1 && (
                        <button onClick={() => setRows(p => p.map(r => r.id!==row.id ? r : { ...r, groups: r.groups.filter((_,i)=>i!==gi) }))}
                          style={{ padding:'4px 8px', borderRadius:7, border:'1px solid #fca5a5', background:'transparent', color:'#ef4444', cursor:'pointer', fontSize:'0.8rem' }}>✕</button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setRows(p => p.map(r => r.id!==row.id ? r : { ...r, groups: [...r.groups, ''] }))}
                    style={{ fontSize:'0.68rem', color:'#6366f1', background:'transparent', border:'1px dashed #6366f1', borderRadius:6, padding:'2px 8px', cursor:'pointer', fontWeight:600 }}>
                    + Add group
                  </button>
                </div>

                {/* Type */}
                <div style={{ minWidth:100 }}>
                  <label style={{ fontSize:'0.68rem', color:'#64748b', fontWeight:600 }}>Type</label>
                  <select style={sel} value={row.subjectType} onChange={e => upd(row.id,'subjectType',e.target.value)}>
                    {TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Hrs/week */}
                <div style={{ minWidth:70 }}>
                  <label style={{ fontSize:'0.68rem', color:'#64748b', fontWeight:600 }}>Hrs/week</label>
                  <input style={inp} type="number" min={1} max={20} value={row.totalHours}
                    onChange={e => changeTotalHours(row.id, Math.max(1,+e.target.value))} />
                </div>

                {/* Preferences toggle */}
                <button onClick={() => setExpandRow(isExp ? null : row.id)}
                  style={{ ...chip(isExp), alignSelf:'flex-end', marginBottom:1, whiteSpace:'nowrap' }}>
                  ⚙️ Preferences
                </button>

                {/* Remove */}
                {rows.length > 1 && (
                  <button onClick={() => setRows(p=>p.filter(r=>r.id!==row.id))}
                    style={{ alignSelf:'flex-end', marginBottom:1, background:'transparent', border:'1px solid #fca5a5', borderRadius:8, color:'#ef4444', cursor:'pointer', padding:'6px 10px', fontSize:'0.8rem' }}>✕</button>
                )}
              </div>

              {/* Slot split */}
              <div style={{ marginTop:12, padding:'10px 12px', background:'#f8fafc', borderRadius:10, border:'1px solid #e2e8f0' }}>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-end' }}>
                  <div>
                    <label style={{ fontSize:'0.67rem', color:'#64748b', fontWeight:600, display:'block', marginBottom:3 }}>Split into sessions</label>
                    <input style={{ ...inp, width:60 }} type="number" min={1} max={row.totalHours} value={row.slots.length}
                      onChange={e => changeSlotCount(row.id, +e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize:'0.67rem', color:'#64748b', fontWeight:600, display:'block', marginBottom:3 }}>Session durations (hrs)</label>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      {row.slots.map((dur,si)=>(
                        <div key={si} style={{ textAlign:'center' }}>
                          <div style={{ fontSize:'0.6rem', color:'#94a3b8' }}>S{si+1}</div>
                          <input type="number" min={1} max={4} value={dur}
                            onChange={e => changeSlotDur(row.id,si,+e.target.value)}
                            style={{ width:46, textAlign:'center', borderRadius:8, border:`2px solid ${sumOk?'#6366f1':'#ef4444'}`, padding:'3px', fontWeight:700, fontSize:'0.85rem', color:'#4f46e5', background:'#eef2ff' }} />
                          <div style={{ fontSize:'0.55rem', color:'#94a3b8' }}>{dur===1?'hr':'hrs'}</div>
                        </div>
                      ))}
                      <span style={{ fontSize:'0.72rem', fontWeight:700, color: sumOk?'#10b981':'#ef4444' }}>
                        {sumOk ? `✓ ${row.totalHours}h/wk` : `⚠️ sum=${row.slots.reduce((a,b)=>a+b,0)}`}
                      </span>
                    </div>
                  </div>
                  {/* Quick presets */}
                  <div>
                    <label style={{ fontSize:'0.67rem', color:'#64748b', fontWeight:600, display:'block', marginBottom:3 }}>Quick split</label>
                    <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                      {Array.from({length:Math.min(row.totalHours,6)},(_,i)=>i+1).filter(n=>autoSplit(row.totalHours,n).every(d=>d<=4)).map(n=>(
                        <button key={n} onClick={()=>changeSlotCount(row.id,n)}
                          style={chip(row.slots.length===n)}>
                          {autoSplit(row.totalHours,n).join('+')}h
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded preferences */}
              {isExp && (
                <div style={{ marginTop:12, padding:'12px 14px', background:'#f0f4ff', borderRadius:10, border:'1px solid #c7d2fe' }}>
                  <div style={{ fontWeight:700, fontSize:'0.78rem', color:'#4338ca', marginBottom:10 }}>
                    ⚙️ Preferred days & times for {row.teacher || 'this teacher'}
                    <span style={{ fontWeight:400, color:'#818cf8', marginLeft:6 }}>— algorithm places sessions here first</span>
                  </div>
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:'0.7rem', fontWeight:600, color:'#64748b', marginBottom:5 }}>📅 Preferred days</div>
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                      {days.map(d=>(
                        <button key={d} onClick={()=>togglePrefDay(row.id,d)} style={chip(row.prefDays.includes(d))}>
                          {d.slice(0,3)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize:'0.7rem', fontWeight:600, color:'#64748b', marginBottom:5 }}>🕐 Preferred times</div>
                    <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                      {timeSlots.map(tm=>(
                        <button key={tm} onClick={()=>togglePrefTime(row.id,tm)} style={{ ...chip(row.prefTimes.includes(tm)), fontSize:'0.65rem' }}>
                          {tm}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <button onClick={() => { const r=emptyRow(); setRows(p=>[...p,r]); setExpandRow(null); }}
          style={{ width:'100%', padding:'10px', borderRadius:10, border:'2px dashed #cbd5e1', background:'transparent', color:'#64748b', fontWeight:700, fontSize:'0.82rem', cursor:'pointer', transition:'all 0.15s' }}>
          + Add another teacher / subject
        </button>
      </div>

      {/* Generate button */}
      <button onClick={handleGenerate} disabled={busy}
        style={{ width:'100%', padding:'14px', borderRadius:12, border:'none', background: busy?'#94a3b8':'linear-gradient(135deg,#6366f1,#4f46e5)', color:'#fff', fontWeight:800, fontSize:'1rem', cursor: busy?'not-allowed':'pointer', marginTop:8, transition:'all 0.2s', boxShadow: busy?'none':'0 4px 20px rgba(99,102,241,0.4)' }}>
        {busy ? '⏳ Generating…' : '🚀 Generate Schedule'}
      </button>

      {/* Log */}
      {log.length > 0 && (
        <div style={{ marginTop:12, background:'#0f172a', borderRadius:12, padding:'12px 16px' }}>
          {log.map((l,i)=>(
            <div key={i} style={{ fontSize:'0.78rem', fontFamily:'monospace', padding:'2px 0',
              color: l.type==='success'?'#4ade80':l.type==='warn'?'#fbbf24':l.type==='error'?'#f87171':l.type==='ai'?'#a78bfa':'#94a3b8' }}>
              {l.msg}
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {generated && (
        <div style={{ marginTop:16 }}>

          {/* Stats */}
          <div style={{ display:'flex', gap:10, marginBottom:12, flexWrap:'wrap' }}>
            {[
              ['✅ Placed', generated.entries.length, '#10b981'],
              ['⚠️ Unresolved', generated.conflicts.length, generated.conflicts.length?'#ef4444':'#10b981'],
            ].map(([lbl,val,color])=>(
              <div key={lbl} style={{ flex:1, minWidth:120, background:'var(--bg-card,#fff)', border:`2px solid ${color}`, borderRadius:12, padding:'12px 16px', textAlign:'center' }}>
                <div style={{ fontSize:'1.5rem', fontWeight:800, color }}>{val}</div>
                <div style={{ fontSize:'0.72rem', color:'#64748b', fontWeight:600 }}>{lbl}</div>
              </div>
            ))}
          </div>

          {/* Conflicts */}
          {generated.conflicts.length > 0 && (
            <div style={{ background:'#fff1f2', border:'1px solid #fca5a5', borderRadius:10, padding:'12px 14px', marginBottom:12 }}>
              <div style={{ fontWeight:700, color:'#ef4444', marginBottom:6 }}>⚠️ Could not place:</div>
              {generated.conflicts.map((c,i)=>(
                <div key={i} style={{ fontSize:'0.78rem', color:'#dc2626', padding:'2px 0' }}>
                  • {c.teacher} → {c.group} · {c.subject} — {c.reason}
                </div>
              ))}
            </div>
          )}

          {/* Preview table */}
          <div style={{ overflowX:'auto', borderRadius:12, border:'1px solid var(--border,#e2e8f0)' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.78rem' }}>
              <thead>
                <tr style={{ background:'#f8fafc' }}>
                  {['Group','Day','Time','Subject','Teacher','Room','Dur','Type'].map(h=>(
                    <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontWeight:700, color:'#475569', borderBottom:'1px solid #e2e8f0', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {generated.entries.map((e,i)=>(
                  <tr key={i} style={{ borderBottom:'1px solid #f1f5f9', background: i%2===0?'transparent':'#fafafa' }}>
                    <td style={{ padding:'7px 10px', fontWeight:700 }}>{e.group}</td>
                    <td style={{ padding:'7px 10px' }}>{e.day}</td>
                    <td style={{ padding:'7px 10px' }}>{e.time}</td>
                    <td style={{ padding:'7px 10px' }}>{e.course}</td>
                    <td style={{ padding:'7px 10px', color:'#6366f1' }}>{e.teacher||'—'}</td>
                    <td style={{ padding:'7px 10px' }}>{e.room||'—'}</td>
                    <td style={{ padding:'7px 10px' }}>{e.duration}h</td>
                    <td style={{ padding:'7px 10px' }}>
                      <span style={{ padding:'2px 8px', borderRadius:20, fontSize:'0.68rem', fontWeight:700,
                        background: e.subjectType==='lab'?'#fef3c7':e.subjectType==='lecture'?'#ede9fe':'#f0fdf4',
                        color: e.subjectType==='lab'?'#92400e':e.subjectType==='lecture'?'#5b21b6':'#166534' }}>
                        {e.subjectType}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Apply */}
          <div style={{ marginTop:12 }}>
            {applied ? (
              <div style={{ textAlign:'center', padding:'14px', background:'#f0fdf4', borderRadius:12, color:'#16a34a', fontWeight:700, fontSize:'0.9rem' }}>
                ✅ Schedule successfully applied to the live timetable!
              </div>
            ) : (
              <button onClick={handleApply}
                style={{ width:'100%', padding:'13px', borderRadius:12, border:'none', background:'linear-gradient(135deg,#10b981,#059669)', color:'#fff', fontWeight:800, fontSize:'0.95rem', cursor:'pointer', boxShadow:'0 4px 16px rgba(16,185,129,0.35)' }}>
                ✅ Apply to Live Schedule
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}