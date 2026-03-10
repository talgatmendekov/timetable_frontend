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
  groups: [''],
  totalHours: 2, slots: [2],
  prefDays: [], prefTimes: [],
  subjectType: 'lecture',
});

const DAYS  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const TYPES = ['lecture','seminar','lab','practice'];

export default function AutoScheduler() {
  const { timeSlots, days, importSchedule, groups: existingGroups, schedule, teachers: existingTeachers } = useSchedule();

  const [rows,      setRows]      = useState([emptyRow()]);
  const [rooms,     setRooms]     = useState('');
  const [labRooms,  setLabRooms]  = useState('');
  const [generated, setGenerated] = useState(null);
  const [busy,      setBusy]      = useState(false);
  const [log,       setLog]       = useState([]);
  const [applied,   setApplied]   = useState(false);
  const [expandRow, setExpandRow] = useState(null);

  const addLog = (msg, type = 'info') => setLog(p => [...p, { msg, type }]);

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
      ...r, slots: r.slots.map((d, i) => i === si ? Math.max(1, Math.min(4, val)) : d),
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

  const getRooms = () => rooms.split(',').map(r => r.trim()).filter(Boolean);
  const getLabs  = () => labRooms.split(',').map(r => r.trim()).filter(Boolean);
  const allRooms = () => [...new Set([...getRooms(), ...getLabs()])];

  const runAlgorithm = useCallback(() => {
    const entries = [], conflicts = [];
    const tBusy = {}, rBusy = {}, gBusy = {}, tDayH = {};
    const key  = (d, tm) => `${d}-${tm}`;
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
      const isLab  = row.subjectType === 'lab';
      const pool   = isLab ? getLabs() : getRooms().length ? getRooms() : allRooms();
      const slotList = ordered(row);

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
          if (!placed) conflicts.push({ group: grp, subject: row.subject, teacher: row.teacher, reason: `Session ${si + 1} (${dur}h) — no free slot` });
        });
      });
    });

    return { entries, conflicts };
  }, [rows, days, timeSlots, rooms, labRooms]);

  const fixWithAI = async (entries, conflicts) => {
    if (!conflicts.length) return entries;
    addLog('🤖 Asking AI to resolve conflicts…', 'ai');
    try {
      const token  = localStorage.getItem('scheduleToken') || '';
      const prompt = `Fix these university schedule conflicts:\n${JSON.stringify(conflicts)}\nDays:${days.join(',')}\nTimes:${timeSlots.join(',')}\nRooms:${allRooms().join(',')}\nAlready placed:${JSON.stringify(entries.slice(0, 50))}\nReturn ONLY a JSON array of new entries, each with: group,day,time,course,teacher,room,subjectType,duration. No markdown.`;
      const res  = await fetch(`${API_URL}/claude/fix-schedule`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ prompt }) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      const fixes = JSON.parse(data.text.replace(/```json|```/g, '').trim());
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
      addLog(`⚠️ ${conflicts.length} conflict(s) detected — calling AI…`, 'warn');
      final = await fixWithAI(entries, conflicts);
    }
    const remaining = conflicts.filter(c => !final.some(e => e.group === c.group && e.course === c.subject));
    addLog(`🏁 Done — ${final.length} placed, ${remaining.length} unresolved`, remaining.length === 0 ? 'success' : 'warn');
    setGenerated({ entries: final, conflicts: remaining });
    setBusy(false);
  };

  const handleApply = async () => {
    try {
      await importSchedule(JSON.stringify(generated.entries));
      setApplied(true);
      addLog('✅ Schedule applied to live timetable!', 'success');
    } catch (e) { addLog(`❌ ${e.message}`, 'error'); }
  };

  return (
    <div className="as-root">

      {/* Header */}
      <div className="as-header">
        <div className="as-header-inner">
          <div className="as-header-icon">🗓</div>
          <div>
            <div className="as-header-title">Auto Schedule Generator</div>
            <div className="as-header-sub">Add teachers & subjects → set hours → generate. AI resolves conflicts automatically.</div>
          </div>
        </div>
      </div>

      {/* Rooms */}
      <div className="as-section-label">🚪 Rooms</div>
      <div className="as-card" style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:180 }}>
          <label className="as-label">Regular rooms</label>
          <input className="as-input" placeholder="B201, B202, A101…" value={rooms} onChange={e => setRooms(e.target.value)} />
        </div>
        <div style={{ flex:1, minWidth:180 }}>
          <label className="as-label">Lab rooms</label>
          <input className="as-input" placeholder="LAB1, LAB2…" value={labRooms} onChange={e => setLabRooms(e.target.value)} />
        </div>
      </div>

      {/* Teacher rows */}
      <div className="as-section-label" style={{ marginTop:20 }}>👨‍🏫 Teachers & Subjects</div>

      {rows.map((row) => {
        const sumOk = row.slots.reduce((a, b) => a + b, 0) === row.totalHours;
        const isExp = expandRow === row.id;

        return (
          <div key={row.id} className={`as-card${isExp ? ' as-card--active' : ''}`}>

            {/* Main grid */}
            <div className="as-row-grid">
              {/* Teacher */}
              <div>
                <label className="as-label">Teacher</label>
                <input className="as-input" list={`tl-${row.id}`} placeholder="Type name…" value={row.teacher}
                  onChange={e => upd(row.id, 'teacher', e.target.value)} />
                <datalist id={`tl-${row.id}`}>{existingTeachers.map(n => <option key={n} value={n} />)}</datalist>
              </div>

              {/* Subject */}
              <div>
                <label className="as-label">Subject</label>
                <input className="as-input" placeholder="e.g. Mathematics" value={row.subject}
                  onChange={e => upd(row.id, 'subject', e.target.value)} />
              </div>

              {/* Type */}
              <div>
                <label className="as-label">Type</label>
                <select className="as-input as-select" value={row.subjectType}
                  onChange={e => upd(row.id, 'subjectType', e.target.value)}>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Hrs/week */}
              <div>
                <label className="as-label">Hrs / week</label>
                <input className="as-input" type="number" min={1} max={20} value={row.totalHours}
                  onChange={e => changeTotalHours(row.id, Math.max(1, +e.target.value))} />
              </div>

              {/* Pref button */}
              <button className={`as-icon-btn as-icon-btn--pref${isExp ? ' as-icon-btn--active' : ''}`}
                onClick={() => setExpandRow(isExp ? null : row.id)} title="Set preferred days & times"
                style={{ alignSelf:'flex-end' }}>
                ⚙️
              </button>

              {/* Remove */}
              {rows.length > 1 && (
                <button className="as-icon-btn" onClick={() => setRows(p => p.filter(r => r.id !== row.id))}
                  title="Remove" style={{ alignSelf:'flex-end' }}>✕</button>
              )}
            </div>

            {/* Groups */}
            <div className="as-divider" />
            <label className="as-label">Groups taught <span style={{ color:'var(--as-muted)', fontWeight:400, textTransform:'none', letterSpacing:0 }}>— one teacher can teach multiple groups</span></label>
            {row.groups.map((g, gi) => (
              <div key={gi} className="as-group-row">
                <input className="as-input" list={`gl-${row.id}-${gi}`} placeholder="COMSE-25…" value={g}
                  onChange={e => setRows(p => p.map(r => r.id !== row.id ? r : { ...r, groups: r.groups.map((x, i) => i === gi ? e.target.value : x) }))} />
                <datalist id={`gl-${row.id}-${gi}`}>{existingGroups.map(g => <option key={g} value={g} />)}</datalist>
                {row.groups.length > 1 && (
                  <button className="as-icon-btn" onClick={() => setRows(p => p.map(r => r.id !== row.id ? r : { ...r, groups: r.groups.filter((_, i) => i !== gi) }))}>✕</button>
                )}
              </div>
            ))}
            <button className="as-add-group-btn"
              onClick={() => setRows(p => p.map(r => r.id !== row.id ? r : { ...r, groups: [...r.groups, ''] }))}>
              + Add group
            </button>

            {/* Slot split */}
            <div className="as-split-panel" style={{ marginTop:14 }}>
              <div className="as-split-panel-top">
                <div>
                  <label className="as-label">Sessions per week</label>
                  <input className="as-input" type="number" min={1} max={20} value={row.slots.length}
                    style={{ width:70 }} onChange={e => changeSlotCount(row.id, Math.max(1, +e.target.value))} />
                </div>
                <div>
                  <label className="as-label">Duration per session (1–4 hrs)</label>
                  <div className="as-slot-boxes">
                    {row.slots.map((dur, si) => (
                      <div key={si} className="as-slot-box">
                        <span className="as-slot-label">S{si + 1}</span>
                        <input type="number" min={1} max={4} value={dur}
                          className={sumOk ? '' : 'as-slot--error'}
                          onChange={e => changeSlotDur(row.id, si, +e.target.value)} />
                        <span className="as-slot-label">{dur === 1 ? 'hr' : 'hrs'}</span>
                      </div>
                    ))}
                    <span className={`as-slot-sum ${sumOk ? 'as-slot-sum--ok' : 'as-slot-sum--error'}`}>
                      {sumOk ? `✓ ${row.totalHours}h` : `⚠ ${row.slots.reduce((a,b)=>a+b,0)}/${row.totalHours}h`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick presets */}
              <div style={{ marginTop:10 }}>
                <label className="as-label">Quick split</label>
                <div className="as-presets">
                  {Array.from({ length: Math.min(row.totalHours, 6) }, (_, i) => i + 1)
                    .filter(n => autoSplit(row.totalHours, n).every(d => d <= 4))
                    .map(n => (
                      <button key={n}
                        className={`as-preset-btn${row.slots.length === n ? ' as-preset-btn--active' : ''}`}
                        onClick={() => changeSlotCount(row.id, n)}>
                        {autoSplit(row.totalHours, n).join('+')}h
                      </button>
                    ))}
                </div>
              </div>
            </div>

            {/* Preferred days & times */}
            {isExp && (
              <div className="as-pref-panel">
                <div className="as-pref-title">⚙️ Preferred days & times for {row.teacher || 'this teacher'}</div>
                <div style={{ marginBottom:12 }}>
                  <div className="as-pref-sub">📅 Preferred days</div>
                  <div className="as-chips">
                    {days.map(d => (
                      <button key={d} className={`as-chip${row.prefDays.includes(d) ? ' as-chip--on' : ''}`}
                        onClick={() => togglePrefDay(row.id, d)}>{d.slice(0, 3)}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="as-pref-sub">🕐 Preferred times</div>
                  <div className="as-chips">
                    {timeSlots.map(tm => (
                      <button key={tm} className={`as-chip as-chip--time${row.prefTimes.includes(tm) ? ' as-chip--on' : ''}`}
                        onClick={() => togglePrefTime(row.id, tm)}>{tm}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button className="as-add-row-btn" onClick={() => { setRows(p => [...p, emptyRow()]); setExpandRow(null); }}>
        + Add another teacher / subject
      </button>

      {/* Generate */}
      <button className="as-generate-btn" onClick={handleGenerate} disabled={busy}>
        {busy ? '⏳ Generating…' : '🚀 Generate Schedule'}
      </button>

      {/* Log */}
      {log.length > 0 && (
        <div className="as-log">
          {log.map((l, i) => (
            <div key={i} className={`as-log-line as-log-line--${l.type}`}>{l.msg}</div>
          ))}
        </div>
      )}

      {/* Results */}
      {generated && (
        <div style={{ marginTop:20 }}>
          <div className="as-section-label">📊 Results</div>

          <div className="as-stats-row">
            <div className={`as-stat-card as-stat-card--ok`}>
              <div className="as-stat-num as-stat-num--ok">{generated.entries.length}</div>
              <div className="as-stat-lbl">Sessions placed</div>
            </div>
            <div className={`as-stat-card ${generated.conflicts.length ? 'as-stat-card--bad' : 'as-stat-card--ok'}`}>
              <div className={`as-stat-num ${generated.conflicts.length ? 'as-stat-num--bad' : 'as-stat-num--ok'}`}>{generated.conflicts.length}</div>
              <div className="as-stat-lbl">Unresolved</div>
            </div>
          </div>

          {generated.conflicts.length > 0 && (
            <div className="as-conflicts">
              <div className="as-conflict-title">⚠️ Could not place:</div>
              {generated.conflicts.map((c, i) => (
                <div key={i} className="as-conflict-item">• {c.teacher} → {c.group} · {c.subject} — {c.reason}</div>
              ))}
            </div>
          )}

          <div className="as-table-wrap">
            <table className="as-table">
              <thead>
                <tr>
                  {['Group','Day','Time','Subject','Teacher','Room','Dur','Type'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {generated.entries.map((e, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight:700 }}>{e.group}</td>
                    <td>{e.day}</td>
                    <td style={{ fontFamily:'DM Mono,monospace' }}>{e.time}</td>
                    <td>{e.course}</td>
                    <td style={{ color:'var(--as-accent2)' }}>{e.teacher || '—'}</td>
                    <td>{e.room || '—'}</td>
                    <td style={{ fontFamily:'DM Mono,monospace', fontWeight:700 }}>{e.duration}h</td>
                    <td><span className={`as-type-badge as-type-badge--${e.subjectType}`}>{e.subjectType}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {applied ? (
            <div className="as-applied-msg">✅ Schedule successfully applied to the live timetable!</div>
          ) : (
            <button className="as-apply-btn" onClick={handleApply}>
              ✅ Apply to Live Schedule
            </button>
          )}
        </div>
      )}
    </div>
  );
}