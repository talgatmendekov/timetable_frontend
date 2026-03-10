// src/components/AutoScheduler.js
// Hybrid AI Schedule Generator — teacher-first with slot splitting + preferences
import React, { useState, useCallback } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { useLanguage } from '../context/LanguageContext';
import './AutoScheduler.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://timetablebackend-production.up.railway.app/api';
const uid = () => Math.random().toString(36).slice(2, 8);

const SUBJECT_TYPES = ['lecture', 'seminar', 'lab', 'practice'];

// Auto-split N hours evenly into `count` sessions
const autoSplit = (total, count) => {
  const n    = Math.max(1, Math.min(count, total));
  const base = Math.floor(total / n);
  const rem  = total % n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
};

const emptySubject = () => ({
  id: uid(), name: '', type: 'lecture', teacher: '', needsLab: false,
  totalHours: 2,   // hrs / week
  slots: [2],      // array of durations that must sum to totalHours
});
const emptyGroup   = () => ({ id: uid(), name: '', subjects: [emptySubject()] });
const emptyTeacher = () => ({ id: uid(), name: '', maxHoursPerDay: 4, preferredDays: [], preferredTimes: [], pinnedSlots: [] });
const emptyRoom    = () => ({ id: uid(), name: '', isLab: false, capacity: 30 });

const extractFromSchedule = (schedule, existingGroups) => {
  const entries  = Object.values(schedule);
  const teachers = [...new Set(entries.map(e => e.teacher).filter(Boolean))].map(name => ({ ...emptyTeacher(), name }));
  const rooms    = [...new Set(entries.map(e => e.room).filter(Boolean))].map(name => ({
    ...emptyRoom(), name,
    isLab: entries.some(e => e.room === name && e.subjectType === 'lab'),
  }));
  const groups = existingGroups.map(g => {
    const gEntries = entries.filter(e => e.group === g);
    const subjects = [...new Map(gEntries.map(e => [e.course, e])).values()].map(e => ({
      ...emptySubject(),
      name: e.course || '', type: e.subjectType || 'lecture',
      teacher: e.teacher || '', needsLab: e.subjectType === 'lab',
      totalHours: gEntries.filter(x => x.course === e.course).length * 2,
      slots: autoSplit(gEntries.filter(x => x.course === e.course).length * 2,
                       gEntries.filter(x => x.course === e.course).length),
    }));
    return { ...emptyGroup(), name: g, subjects };
  });
  return { teachers, rooms, groups };
};

// ─────────────────────────────────────────────────────────────────────────────
export default function AutoScheduler() {
  const { timeSlots, days, importSchedule, groups: existingGroups, schedule, teachers: existingTeachers } = useSchedule();
  const { t } = useLanguage();

  const STEPS = ['Setup', 'Teachers', 'Rooms', 'Groups & Subjects', 'Generate', 'Preview'];

  const [step,       setStep]      = useState(0);
  const [teachers,   setTeachers]  = useState([emptyTeacher()]);
  const [rooms,      setRooms]     = useState([emptyRoom()]);
  const [groups,     setGroups]    = useState([emptyGroup()]);
  const [generated,  setGenerated] = useState(null);
  const [generating, setGenerating]= useState(false);
  const [genLog,     setLog]       = useState([]);
  const [applied,    setApplied]   = useState(false);
  const [aiFixing,   setAiFixing]  = useState(false);

  const log = (msg, type = 'info') => setLog(prev => [...prev, { msg, type }]);

  // ── Subject helpers ────────────────────────────────────────────────────────
  const updateSubject = (gIdx, sIdx, field, val) =>
    setGroups(prev => prev.map((g, i) => i !== gIdx ? g : {
      ...g, subjects: g.subjects.map((s, j) => j !== sIdx ? s : { ...s, [field]: val }),
    }));

  const changeTotalHours = (gIdx, sIdx, newTotal) =>
    setGroups(prev => prev.map((g, i) => i !== gIdx ? g : {
      ...g, subjects: g.subjects.map((s, j) => j !== sIdx ? s : {
        ...s, totalHours: newTotal, slots: autoSplit(newTotal, s.slots.length),
      }),
    }));

  const changeSlotCount = (gIdx, sIdx, n) =>
    setGroups(prev => prev.map((g, i) => i !== gIdx ? g : {
      ...g, subjects: g.subjects.map((s, j) => j !== sIdx ? s : {
        ...s, slots: autoSplit(s.totalHours, Math.max(1, n)),
      }),
    }));

  const changeSlotDuration = (gIdx, sIdx, slotIdx, val) =>
    setGroups(prev => prev.map((g, i) => i !== gIdx ? g : {
      ...g, subjects: g.subjects.map((s, j) => j !== sIdx ? s : {
        ...s, slots: s.slots.map((d, k) => k === slotIdx ? Math.max(1, val) : d),
      }),
    }));

  const slotWarning = (s) => {
    const sum = s.slots.reduce((a, b) => a + b, 0);
    return sum !== s.totalHours ? `⚠️ Sessions sum to ${sum}h but total is ${s.totalHours}h` : null;
  };

  // ── Pin helpers ────────────────────────────────────────────────────────────
  const addPin    = (tIdx)           => setTeachers(prev => prev.map((tc, i) => i !== tIdx ? tc : { ...tc, pinnedSlots: [...tc.pinnedSlots, { id: uid(), day: '', time: '' }] }));
  const updatePin = (tIdx, pIdx, f, v) => setTeachers(prev => prev.map((tc, i) => i !== tIdx ? tc : { ...tc, pinnedSlots: tc.pinnedSlots.map((p, j) => j !== pIdx ? p : { ...p, [f]: v }) }));
  const removePin = (tIdx, pIdx)     => setTeachers(prev => prev.map((tc, i) => i !== tIdx ? tc : { ...tc, pinnedSlots: tc.pinnedSlots.filter((_, j) => j !== pIdx) }));

  // ── Algorithm ──────────────────────────────────────────────────────────────
  const runAlgorithm = useCallback(() => {
    const entries = [], conflicts = [];
    const teacherBusy = {}, roomBusy = {}, groupBusy = {}, teacherDayH = {};
    const initT = n => { if (!teacherBusy[n]) teacherBusy[n] = new Set(); };
    const initR = n => { if (!roomBusy[n])    roomBusy[n]    = new Set(); };
    const initG = n => { if (!groupBusy[n])   groupBusy[n]   = new Set(); };
    const dayH  = (n, d) => { teacherDayH[n] = teacherDayH[n] || {}; teacherDayH[n][d] = teacherDayH[n][d] || 0; return teacherDayH[n][d]; };

    const orderedSlots = (tc) => {
      const all = [];
      days.forEach(d => timeSlots.forEach(tm => all.push({ d, tm })));
      const pinned = (tc?.pinnedSlots || []).filter(p => p.day && p.time);
      return all.sort((a, b) => {
        const aPin = pinned.some(p => p.day === a.d && p.time === a.tm) ? -3 : 0;
        const bPin = pinned.some(p => p.day === b.d && p.time === b.tm) ? -3 : 0;
        if (aPin !== bPin) return aPin - bPin;
        const aPD = tc?.preferredDays?.includes(a.d)  ? -2 : 0;
        const bPD = tc?.preferredDays?.includes(b.d)  ? -2 : 0;
        if (aPD !== bPD) return aPD - bPD;
        const aPT = tc?.preferredTimes?.includes(a.tm) ? -1 : 0;
        const bPT = tc?.preferredTimes?.includes(b.tm) ? -1 : 0;
        return aPT - bPT;
      });
    };

    groups.forEach(grp => {
      if (!grp.name.trim()) return;
      initG(grp.name);

      grp.subjects.forEach(subj => {
        if (!subj.name.trim()) return;
        const tc      = teachers.find(x => x.name === subj.teacher);
        const maxH    = tc?.maxHoursPerDay || 4;
        const roomPool= rooms.filter(r => r.name.trim() && (subj.needsLab ? r.isLab : true));
        const ordered = orderedSlots(tc);

        // Each slot duration is placed as a separate class entry
        subj.slots.forEach((dur, slotIdx) => {
          let placed = false;

          for (const { d, tm } of ordered) {
            const key = `${d}-${tm}`;

            if (subj.teacher) { initT(subj.teacher); if (teacherBusy[subj.teacher].has(key)) continue; }
            if (groupBusy[grp.name].has(key)) continue;
            if (subj.teacher && dayH(subj.teacher, d) + dur > maxH) continue;

            // Don't place same subject twice on same day
            if (entries.some(e => e.group === grp.name && e.course === subj.name && e.day === d)) continue;

            // Room assignment
            let chosenRoom = '';
            if (roomPool.length > 0) {
              const free = roomPool.find(r => { initR(r.name); return !roomBusy[r.name].has(key); });
              if (!free) continue;
              chosenRoom = free.name;
            }

            entries.push({ group: grp.name, day: d, time: tm, course: subj.name, teacher: subj.teacher || '', room: chosenRoom, subjectType: subj.type || 'lecture', duration: dur });
            if (subj.teacher) { teacherBusy[subj.teacher].add(key); teacherDayH[subj.teacher][d] = (teacherDayH[subj.teacher][d] || 0) + dur; }
            if (chosenRoom) { initR(chosenRoom); roomBusy[chosenRoom].add(key); }
            groupBusy[grp.name].add(key);
            placed = true;
            break;
          }

          if (!placed) conflicts.push({ group: grp.name, subject: subj.name, teacher: subj.teacher, reason: `Session ${slotIdx + 1} (${dur}h) — no free slot found` });
        });
      });
    });

    return { entries, conflicts };
  }, [groups, teachers, rooms, days, timeSlots]);

  // ── Claude conflict fixer ──────────────────────────────────────────────────
  const fixWithClaude = async (entries, conflicts) => {
    if (!conflicts.length) return entries;
    setAiFixing(true);
    log('🤖 Sending conflicts to Claude AI...', 'ai');
    try {
      const token = localStorage.getItem('scheduleToken') || localStorage.getItem('token') || '';
      const prompt = `You are a university schedule optimizer. Fix these conflicts:\n${JSON.stringify(conflicts, null, 2)}\nDays: ${days.join(', ')}\nTimeSlots: ${timeSlots.join(', ')}\nTeachers: ${JSON.stringify(teachers.map(tc => ({ name: tc.name, maxHoursPerDay: tc.maxHoursPerDay, preferredDays: tc.preferredDays, preferredTimes: tc.preferredTimes })))}\nRooms: ${JSON.stringify(rooms.map(r => ({ name: r.name, isLab: r.isLab })))}\nPlaced so far: ${JSON.stringify(entries.slice(0, 60))}\nReturn ONLY a valid JSON array of new entries, each with: group, day, time, course, teacher, room, subjectType, duration. No markdown.`;
      const res  = await fetch(`${API_URL}/claude/fix-schedule`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ prompt }) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      const fixes = JSON.parse(data.text.replace(/```json|```/g, '').trim());
      if (Array.isArray(fixes) && fixes.length) { log(`✅ Claude resolved ${fixes.length} conflict(s)`, 'success'); return [...entries, ...fixes]; }
    } catch (e) { log(`⚠️ Claude fix failed: ${e.message}`, 'warn'); }
    finally { setAiFixing(false); }
    return entries;
  };

  const buildStats = entries => ({
    total: entries.length,
    byGroup:   [...new Set(entries.map(e => e.group))].map(g => ({ name: g, count: entries.filter(e => e.group === g).length })),
    byTeacher: [...new Set(entries.map(e => e.teacher).filter(Boolean))].map(tc => ({ name: tc, count: entries.filter(e => e.teacher === tc).length })),
    byDay:     days.map(d => ({ day: d, count: entries.filter(e => e.day === d).length })),
  });

  const handleGenerate = async () => {
    setGenerating(true); setLog([]); setGenerated(null); setApplied(false);
    log('⚙️ Running constraint-based algorithm...', 'info');
    await new Promise(r => setTimeout(r, 300));
    const { entries, conflicts } = runAlgorithm();
    log(`📋 Algorithm placed ${entries.length} classes`, 'success');
    if (conflicts.length) {
      log(`⚠️ ${conflicts.length} conflict(s) — sending to Claude...`, 'warn');
      const fixed = await fixWithClaude(entries, conflicts);
      const remaining = conflicts.filter(c => !fixed.some(e => e.group === c.group && e.course === c.subject));
      log(`🏁 Done — ${fixed.length} placed, ${remaining.length} unresolved`, remaining.length === 0 ? 'success' : 'warn');
      setGenerated({ entries: fixed, conflicts: remaining, stats: buildStats(fixed) });
    } else {
      log('🏁 Done — no conflicts!', 'success');
      setGenerated({ entries, conflicts: [], stats: buildStats(entries) });
    }
    setGenerating(false); setStep(5);
  };

  const handleApply = async () => {
    try { await importSchedule(JSON.stringify(generated.entries)); setApplied(true); log('✅ Applied!', 'success'); }
    catch (e) { log(`❌ ${e.message}`, 'error'); }
  };

  const inp = 'as-input';
  const sel = 'as-select';

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="as-wrap">

      <div className="as-header">
        <div className="as-header-icon">🤖</div>
        <div>
          <div className="as-title">Auto Schedule Generator</div>
          <div className="as-sub">Set teacher hours → split into sessions → set preferences → generate</div>
        </div>
      </div>

      <div className="as-steps">
        {STEPS.map((s, i) => (
          <div key={s} className={`as-step ${i === step ? 'active' : i < step ? 'done' : ''}`}
            onClick={() => i < step && setStep(i)}>
            <div className="as-step-dot">{i < step ? '✓' : i + 1}</div>
            <div className="as-step-label">{s}</div>
            {i < STEPS.length - 1 && <div className="as-step-line" />}
          </div>
        ))}
      </div>

      {/* ── STEP 0: Setup ── */}
      {step === 0 && (
        <div className="as-panel">
          <div className="as-panel-title">📋 How it works</div>
          <div className="as-explainer">
            {[
              ['1', 'Add teachers', 'Set max hours/day, preferred days & times, pinned slots'],
              ['2', 'Add rooms', 'Mark labs so lab subjects get the right room'],
              ['3', 'Add groups & subjects', 'Set total weekly hours, then split into sessions (e.g. 6h → 2+2+2 or 3+3)'],
              ['4', 'Generate', 'Algorithm places all sessions respecting constraints; Claude AI fixes any remaining conflicts'],
              ['5', 'Preview & apply', 'Review before pushing live'],
            ].map(([n, title, body]) => (
              <div key={n} className="as-explainer-step">
                <div className="as-exp-num">{n}</div>
                <div><strong>{title}</strong> — {body}</div>
              </div>
            ))}
          </div>
          <div className="as-setup-btns">
            <button className="as-btn-primary" onClick={() => setStep(1)}>Start Fresh →</button>
            <button className="as-btn-import" onClick={() => {
              const ex = extractFromSchedule(schedule, existingGroups);
              if (!ex.teachers.length && !ex.groups.length) { alert('No existing schedule data found.'); return; }
              if (ex.teachers.length) setTeachers(ex.teachers);
              if (ex.rooms.length)    setRooms(ex.rooms);
              if (ex.groups.length)   setGroups(ex.groups);
              setStep(1);
            }}>
              ⚡ Import from Current Schedule
              <span className="as-import-hint">
                {existingGroups.length} groups · {[...new Set(Object.values(schedule).map(e => e.teacher).filter(Boolean))].length} teachers · {[...new Set(Object.values(schedule).map(e => e.room).filter(Boolean))].length} rooms
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 1: Teachers ── */}
      {step === 1 && (
        <div className="as-panel">
          <div className="as-panel-title">👨‍🏫 Teachers</div>
          {teachers.map((tc, tIdx) => (
            <div key={tc.id} className="as-card">
              <div className="as-card-row">
                <div className="as-field" style={{ flex: 2 }}>
                  <label>Name *</label>
                  <input className={inp} list={`tcl-${tIdx}`} placeholder="Type or select teacher…"
                    value={tc.name} onChange={e => setTeachers(prev => prev.map((x, i) => i === tIdx ? { ...x, name: e.target.value } : x))} />
                  <datalist id={`tcl-${tIdx}`}>{existingTeachers.map(n => <option key={n} value={n} />)}</datalist>
                </div>
                <div className="as-field as-field-sm">
                  <label>Max hrs/day</label>
                  <input className={inp} type="number" min={1} max={10} value={tc.maxHoursPerDay}
                    onChange={e => setTeachers(prev => prev.map((x, i) => i === tIdx ? { ...x, maxHoursPerDay: +e.target.value } : x))} />
                </div>
                <button className="as-btn-remove" onClick={() => setTeachers(prev => prev.filter((_, i) => i !== tIdx))}>✕</button>
              </div>

              {/* Preferred days */}
              <div className="as-field">
                <label>📅 Preferred days <span className="as-hint">— algorithm places sessions here first</span></label>
                <div className="as-chip-row">
                  {days.map(d => (
                    <button key={d} className={`as-chip ${tc.preferredDays.includes(d) ? 'on' : ''}`}
                      onClick={() => setTeachers(prev => prev.map((x, i) => i !== tIdx ? x : {
                        ...x, preferredDays: x.preferredDays.includes(d) ? x.preferredDays.filter(v => v !== d) : [...x.preferredDays, d],
                      }))}>
                      {d.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preferred times */}
              <div className="as-field">
                <label>🕐 Preferred time slots</label>
                <div className="as-chip-row" style={{ flexWrap: 'wrap' }}>
                  {timeSlots.map(tm => (
                    <button key={tm} className={`as-chip ${tc.preferredTimes.includes(tm) ? 'on' : ''}`}
                      style={{ fontSize: '0.7rem' }}
                      onClick={() => setTeachers(prev => prev.map((x, i) => i !== tIdx ? x : {
                        ...x, preferredTimes: x.preferredTimes.includes(tm) ? x.preferredTimes.filter(v => v !== tm) : [...x.preferredTimes, tm],
                      }))}>
                      {tm}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pinned slots */}
              <div className="as-field">
                <label>📌 Pinned slots <span className="as-hint">— must teach at this exact day+time</span></label>
                {tc.pinnedSlots.map((pin, pIdx) => (
                  <div key={pin.id} className="as-pin-row">
                    <select className={sel} value={pin.day} onChange={e => updatePin(tIdx, pIdx, 'day', e.target.value)}>
                      <option value="">Day</option>
                      {days.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select className={sel} value={pin.time} onChange={e => updatePin(tIdx, pIdx, 'time', e.target.value)}>
                      <option value="">Time</option>
                      {timeSlots.map(tm => <option key={tm} value={tm}>{tm}</option>)}
                    </select>
                    <button className="as-btn-remove-sm" onClick={() => removePin(tIdx, pIdx)}>✕</button>
                  </div>
                ))}
                <button className="as-btn-ghost" onClick={() => addPin(tIdx)}>+ Add pinned slot</button>
              </div>
            </div>
          ))}
          <button className="as-btn-ghost" onClick={() => setTeachers(prev => [...prev, emptyTeacher()])}>+ Add Teacher</button>
          <div className="as-nav-row">
            <button className="as-btn-secondary" onClick={() => setStep(0)}>← Back</button>
            <button className="as-btn-primary" onClick={() => setStep(2)}>Next: Rooms →</button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Rooms ── */}
      {step === 2 && (
        <div className="as-panel">
          <div className="as-panel-title">🚪 Rooms</div>
          {rooms.map((rm, rIdx) => (
            <div key={rm.id} className="as-card as-card-row">
              <div className="as-field"><label>Room name *</label>
                <input className={inp} placeholder="e.g. B201" value={rm.name}
                  onChange={e => setRooms(prev => prev.map((x, i) => i === rIdx ? { ...x, name: e.target.value } : x))} />
              </div>
              <div className="as-field as-field-sm"><label>Capacity</label>
                <input className={inp} type="number" min={1} value={rm.capacity}
                  onChange={e => setRooms(prev => prev.map((x, i) => i === rIdx ? { ...x, capacity: +e.target.value } : x))} />
              </div>
              <div className="as-field as-field-sm"><label>Type</label>
                <button className={`as-chip ${rm.isLab ? 'on' : ''}`}
                  onClick={() => setRooms(prev => prev.map((x, i) => i === rIdx ? { ...x, isLab: !x.isLab } : x))}>
                  🧪 Lab
                </button>
              </div>
              <button className="as-btn-remove" onClick={() => setRooms(prev => prev.filter((_, i) => i !== rIdx))}>✕</button>
            </div>
          ))}
          <button className="as-btn-ghost" onClick={() => setRooms(prev => [...prev, emptyRoom()])}>+ Add Room</button>
          <div className="as-nav-row">
            <button className="as-btn-secondary" onClick={() => setStep(1)}>← Back</button>
            <button className="as-btn-primary" onClick={() => setStep(3)}>Next: Groups & Subjects →</button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Groups & Subjects ── */}
      {step === 3 && (
        <div className="as-panel">
          <div className="as-panel-title">👥 Groups & Subjects</div>
          {groups.map((grp, gIdx) => (
            <div key={grp.id} className="as-card">
              <div className="as-card-row">
                <div className="as-field" style={{ flex: 1 }}>
                  <label>Group name *</label>
                  <input className={inp} list={`grpl-${gIdx}`} placeholder="e.g. CS-22" value={grp.name}
                    onChange={e => setGroups(prev => prev.map((x, i) => i === gIdx ? { ...x, name: e.target.value } : x))} />
                  <datalist id={`grpl-${gIdx}`}>{existingGroups.map(g => <option key={g} value={g} />)}</datalist>
                </div>
                <button className="as-btn-remove" onClick={() => setGroups(prev => prev.filter((_, i) => i !== gIdx))}>✕</button>
              </div>

              <div className="as-subjects">
                {grp.subjects.map((subj, sIdx) => (
                  <div key={subj.id} className="as-subject-block">

                    {/* Subject row 1: name + type + teacher + room + lab toggle */}
                    <div className="as-subject-row">
                      <input className={inp} placeholder="Subject name" value={subj.name}
                        onChange={e => updateSubject(gIdx, sIdx, 'name', e.target.value)} style={{ flex: 2 }} />
                      <select className={sel} value={subj.type}
                        onChange={e => updateSubject(gIdx, sIdx, 'type', e.target.value)}>
                        {SUBJECT_TYPES.map(st => <option key={st} value={st}>{st}</option>)}
                      </select>
                      <select className={sel} value={subj.teacher}
                        onChange={e => updateSubject(gIdx, sIdx, 'teacher', e.target.value)}>
                        <option value="">No teacher</option>
                        {teachers.filter(tc => tc.name.trim()).map(tc => <option key={tc.id} value={tc.name}>{tc.name}</option>)}
                      </select>
                      <button className={`as-chip ${subj.needsLab ? 'on' : ''}`} title="Requires lab room"
                        onClick={() => updateSubject(gIdx, sIdx, 'needsLab', !subj.needsLab)}>🧪 Lab</button>
                      <button className="as-btn-remove-sm"
                        onClick={() => setGroups(prev => prev.map((g, i) => i !== gIdx ? g : { ...g, subjects: g.subjects.filter((_, j) => j !== sIdx) }))}>✕</button>
                    </div>

                    {/* Subject row 2: hours + slot split ← THE NEW PART */}
                    <div className="as-slot-box">
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>

                        {/* Total hours */}
                        <div className="as-field" style={{ minWidth: 110 }}>
                          <label style={{ fontSize: '0.67rem' }}>⏱ Total hrs/week</label>
                          <input className={inp} type="number" min={1} max={20} value={subj.totalHours}
                            onChange={e => changeTotalHours(gIdx, sIdx, Math.max(1, +e.target.value))} />
                        </div>

                        {/* Number of sessions */}
                        <div className="as-field" style={{ minWidth: 120 }}>
                          <label style={{ fontSize: '0.67rem' }}>✂️ Split into N sessions</label>
                          <input className={inp} type="number" min={1} max={subj.totalHours} value={subj.slots.length}
                            onChange={e => changeSlotCount(gIdx, sIdx, +e.target.value)} />
                        </div>

                        {/* Editable session durations */}
                        <div className="as-field" style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.67rem' }}>🎯 Session durations (edit each)</label>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            {subj.slots.map((dur, slotIdx) => (
                              <div key={slotIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                <span style={{ fontSize: '0.55rem', color: '#94a3b8' }}>S{slotIdx + 1}</span>
                                <input type="number" min={1} max={subj.totalHours} value={dur}
                                  onChange={e => changeSlotDuration(gIdx, sIdx, slotIdx, +e.target.value)}
                                  style={{ width: 48, textAlign: 'center', borderRadius: 8, border: '2px solid #6366f1', padding: '3px 2px', fontWeight: 700, fontSize: '0.9rem', color: '#4f46e5', background: '#eef2ff' }} />
                                <span style={{ fontSize: '0.55rem', color: '#94a3b8' }}>{dur === 1 ? 'hr' : 'hrs'}</span>
                              </div>
                            ))}
                            {slotWarning(subj)
                              ? <span style={{ fontSize: '0.68rem', color: '#ef4444', fontWeight: 600 }}>{slotWarning(subj)}</span>
                              : <span style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 600 }}>✓ {subj.totalHours}h/wk</span>}
                          </div>
                        </div>
                      </div>

                      {/* Quick-split presets */}
                      <div style={{ marginTop: 8, display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600 }}>Quick split:</span>
                        {Array.from({ length: Math.min(subj.totalHours, 6) }, (_, i) => i + 1).map(n => (
                          <button key={n} onClick={() => changeSlotCount(gIdx, sIdx, n)}
                            style={{
                              padding: '2px 9px', borderRadius: 20, fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer',
                              border: '1px solid #e2e8f0',
                              background: subj.slots.length === n ? '#6366f1' : '#f1f5f9',
                              color: subj.slots.length === n ? '#fff' : '#475569',
                              transition: 'all 0.15s',
                            }}>
                            {autoSplit(subj.totalHours, n).join('+')}h
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                <button className="as-btn-ghost as-btn-ghost-sm" style={{ marginTop: 8 }}
                  onClick={() => setGroups(prev => prev.map((g, i) => i !== gIdx ? g : { ...g, subjects: [...g.subjects, emptySubject()] }))}>
                  + Add subject
                </button>
              </div>
            </div>
          ))}
          <button className="as-btn-ghost" onClick={() => setGroups(prev => [...prev, emptyGroup()])}>+ Add Group</button>
          <div className="as-nav-row">
            <button className="as-btn-secondary" onClick={() => setStep(2)}>← Back</button>
            <button className="as-btn-primary" onClick={() => setStep(4)}>Next: Generate →</button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Generate ── */}
      {step === 4 && (
        <div className="as-panel">
          <div className="as-panel-title">🚀 Generate Schedule</div>
          <div className="as-summary-grid">
            {[
              [teachers.filter(tc => tc.name.trim()).length, 'Teachers'],
              [rooms.filter(r => r.name.trim()).length, 'Rooms'],
              [groups.filter(g => g.name.trim()).length, 'Groups'],
              [groups.reduce((a, g) => a + g.subjects.length, 0), 'Subjects'],
              [groups.reduce((a, g) => a + g.subjects.reduce((b, s) => b + s.slots.length, 0), 0), 'Total sessions'],
            ].map(([val, lbl]) => (
              <div key={lbl} className="as-summary-card">
                <div className="as-summary-val">{val}</div>
                <div className="as-summary-lbl">{lbl}</div>
              </div>
            ))}
          </div>
          <button className="as-btn-generate" onClick={handleGenerate} disabled={generating || aiFixing}>
            {generating ? '⚙️ Running algorithm...' : aiFixing ? '🤖 Claude fixing conflicts...' : '🚀 Generate Schedule'}
          </button>
          {genLog.length > 0 && (
            <div className="as-log">
              {genLog.map((l, i) => <div key={i} className={`as-log-line as-log-${l.type}`}>{l.msg}</div>)}
              {(generating || aiFixing) && <div className="as-log-line as-log-info as-pulse">⏳ Processing...</div>}
            </div>
          )}
          <div className="as-nav-row">
            <button className="as-btn-secondary" onClick={() => setStep(3)}>← Back</button>
          </div>
        </div>
      )}

      {/* ── STEP 5: Preview ── */}
      {step === 5 && generated && (
        <div className="as-panel">
          <div className="as-panel-title">👁 Preview & Apply</div>
          <div className="as-summary-grid">
            <div className="as-summary-card green"><div className="as-summary-val">{generated.stats.total}</div><div className="as-summary-lbl">Classes placed</div></div>
            <div className={`as-summary-card ${generated.conflicts.length > 0 ? 'red' : 'green'}`}><div className="as-summary-val">{generated.conflicts.length}</div><div className="as-summary-lbl">Unresolved</div></div>
            {generated.stats.byTeacher.map(tc => (
              <div key={tc.name} className="as-summary-card"><div className="as-summary-val">{tc.count}</div><div className="as-summary-lbl">{tc.name}</div></div>
            ))}
          </div>
          {generated.conflicts.length > 0 && (
            <div className="as-conflicts">
              <div className="as-conflicts-title">⚠️ Unresolved ({generated.conflicts.length})</div>
              {generated.conflicts.map((c, i) => (
                <div key={i} className="as-conflict-row"><strong>{c.teacher || c.group}</strong> → {c.group} · {c.subject} — {c.reason}</div>
              ))}
            </div>
          )}
          <div className="as-preview-scroll">
            <table className="as-preview-table">
              <thead><tr><th>Group</th><th>Day</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Room</th><th>Dur.</th><th>Type</th></tr></thead>
              <tbody>
                {generated.entries.map((e, i) => (
                  <tr key={i}>
                    <td><strong>{e.group}</strong></td>
                    <td>{e.day}</td><td>{e.time}</td><td>{e.course}</td>
                    <td>{e.teacher || '—'}</td><td>{e.room || '—'}</td>
                    <td>{e.duration}h</td>
                    <td><span className={`as-type-badge as-type-${e.subjectType}`}>{e.subjectType}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {applied
            ? <div className="as-applied">✅ Schedule applied to live timetable!</div>
            : <div className="as-apply-row">
                <button className="as-btn-secondary" onClick={() => setStep(4)}>← Re-generate</button>
                <button className="as-btn-apply" onClick={handleApply}>✅ Apply to Live Schedule</button>
              </div>}
        </div>
      )}
    </div>
  );
}