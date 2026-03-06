// src/components/AutoScheduler.js
// Hybrid AI Schedule Generator: algorithm fills slots, Claude API fixes conflicts
import React, { useState, useCallback } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { useLanguage } from '../context/LanguageContext';
import './AutoScheduler.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://timetablebackend-production.up.railway.app/api';

// ── Helpers ────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 8);

// Build pre-fill data from existing schedule
const extractFromSchedule = (schedule, existingGroups) => {
  const entries = Object.values(schedule);
  // Teachers
  const teacherMap = {};
  entries.forEach(e => {
    if (!e.teacher) return;
    if (!teacherMap[e.teacher]) teacherMap[e.teacher] = { ...emptyTeacher(), name: e.teacher };
  });
  // Rooms
  const roomMap = {};
  entries.forEach(e => {
    if (!e.room) return;
    const isLab = e.subjectType === 'lab' || (e.course || '').toLowerCase().includes('lab');
    if (!roomMap[e.room]) roomMap[e.room] = { ...emptyRoom(), name: e.room, isLab };
  });
  // Groups with subjects
  const groupMap = {};
  existingGroups.forEach(g => { groupMap[g] = { ...emptyGroup(), name: g, subjects: [] }; });
  entries.forEach(e => {
    if (!e.group || !groupMap[e.group]) return;
    const already = groupMap[e.group].subjects.find(s => s.name === e.course);
    if (!already && e.course) {
      groupMap[e.group].subjects.push({
        ...emptySubject(),
        name: e.course,
        teacher: e.teacher || '',
        type: e.subjectType || 'lecture',
        needsLab: e.subjectType === 'lab',
        hoursPerWeek: 2,
      });
    }
  });
  return {
    teachers: Object.values(teacherMap),
    rooms:    Object.values(roomMap),
    groups:   Object.values(groupMap),
  };
};

const SUBJECT_TYPES = ['lecture', 'seminar', 'lab', 'practice'];

const emptyTeacher  = () => ({ id: uid(), name: '', maxHoursPerDay: 4, preferredDays: [], preferredTimes: [], pinnedSlots: [] });
const emptySubject  = () => ({ id: uid(), name: '', type: 'lecture', hoursPerWeek: 2, teacher: '', needsLab: false });
const emptyGroup    = () => ({ id: uid(), name: '', subjects: [] });
const emptyRoom     = () => ({ id: uid(), name: '', isLab: false, capacity: 30 });

// ── STEP LABELS ────────────────────────────────────────────────────────────
const STEPS = ['Setup', 'Teachers', 'Rooms', 'Groups & Subjects', 'Generate', 'Preview'];

export default function AutoScheduler() {
  const { timeSlots, days, importSchedule, groups: existingGroups, schedule } = useSchedule();
  const { t } = useLanguage();

  const [step,        setStep]      = useState(0);
  const [teachers,    setTeachers]  = useState([emptyTeacher()]);
  const [rooms,       setRooms]     = useState([emptyRoom()]);
  const [groups,      setGroups]    = useState([emptyGroup()]);
  const [generated,   setGenerated] = useState(null); // { entries, conflicts, stats }
  const [generating,  setGenerating] = useState(false);
  const [genLog,      setLog]       = useState([]);
  const [applied,     setApplied]   = useState(false);
  const [aiFixing,    setAiFixing]  = useState(false);

  const log = (msg, type = 'info') => setLog(prev => [...prev, { msg, type, ts: Date.now() }]);

  // ── ALGORITHM: fill schedule ───────────────────────────────────────────
  const runAlgorithm = useCallback(() => {
    const entries = [];
    const conflicts = [];
    // Busy trackers
    const teacherBusy  = {}; // teacherName → Set of "day-time"
    const roomBusy     = {}; // roomName    → Set of "day-time"
    const groupBusy    = {}; // groupName   → Set of "day-time"
    const teacherDayH  = {}; // teacherName → { day → count }

    const initTeacher = (n) => { if (!teacherBusy[n])  teacherBusy[n]  = new Set(); };
    const initRoom    = (n) => { if (!roomBusy[n])     roomBusy[n]     = new Set(); };
    const initGroup   = (n) => { if (!groupBusy[n])    groupBusy[n]    = new Set(); };
    const dayHours    = (tName, d) => { teacherDayH[tName] = teacherDayH[tName] || {}; teacherDayH[tName][d] = teacherDayH[tName][d] || 0; return teacherDayH[tName][d]; };

    // Build slot candidates sorted: pinned teacher prefs first
    const slotsFor = (teacherObj, subject) => {
      const allSlots = [];
      days.forEach(d => timeSlots.forEach(tm => allSlots.push({ d, tm })));

      // Pinned slots (teacher must be at exact day/time)
      const pinned = (teacherObj?.pinnedSlots || []).filter(p => p.day && p.time);

      return allSlots.sort((a, b) => {
        const aPin = pinned.some(p => p.day === a.d && p.time === a.tm) ? -1 : 0;
        const bPin = pinned.some(p => p.day === b.d && p.time === b.tm) ? -1 : 0;
        if (aPin !== bPin) return aPin - bPin;
        // Preferred days
        const aPrefDay = teacherObj?.preferredDays?.includes(a.d) ? -1 : 0;
        const bPrefDay = teacherObj?.preferredDays?.includes(b.d) ? -1 : 0;
        if (aPrefDay !== bPrefDay) return aPrefDay - bPrefDay;
        // Preferred times
        const aPrefTm = teacherObj?.preferredTimes?.includes(a.tm) ? -1 : 0;
        const bPrefTm = teacherObj?.preferredTimes?.includes(b.tm) ? -1 : 0;
        return aPrefTm - bPrefTm;
      });
    };

    groups.forEach(grp => {
      if (!grp.name.trim()) return;
      initGroup(grp.name);

      grp.subjects.forEach(subj => {
        if (!subj.name.trim()) return;
        const teacherObj = teachers.find(tc => tc.name === subj.teacher);
        const maxH       = teacherObj?.maxHoursPerDay || 4;
        const needsLab   = subj.needsLab || subj.type === 'lab';
        const hoursLeft  = subj.hoursPerWeek || 2;
        let scheduled    = 0;

        // Find suitable room
        const roomPool = rooms.filter(r => needsLab ? r.isLab : true);

        const slots = slotsFor(teacherObj, subj);

        for (const { d, tm } of slots) {
          if (scheduled >= hoursLeft) break;
          const key = `${d}-${tm}`;

          // Constraint: no same subject twice same day
          const subjSameDay = entries.filter(e =>
            e.group === grp.name && e.subject === subj.name && e.day === d
          ).length;
          if (subjSameDay > 0) continue;

          // Constraint: teacher not double-booked
          if (subj.teacher) {
            initTeacher(subj.teacher);
            if (teacherBusy[subj.teacher].has(key)) continue;
          }

          // Constraint: group not double-booked
          if (groupBusy[grp.name].has(key)) continue;

          // Constraint: teacher max hours per day
          if (subj.teacher && dayHours(subj.teacher, d) >= maxH) continue;

          // Find free room
          const room = roomPool.find(r => { initRoom(r.name); return !roomBusy[r.name].has(key); });
          if (!room && roomPool.length > 0) {
            conflicts.push({ group: grp.name, subject: subj.name, day: d, time: tm, reason: 'No free room' });
            continue;
          }

          // Schedule it
          const entry = {
            group:       grp.name,
            day:         d,
            time:        tm,
            course:      subj.name,
            teacher:     subj.teacher || '',
            room:        room?.name || '',
            subjectType: subj.type || 'lecture',
            duration:    1,
            subject:     subj.name,
          };
          entries.push(entry);

          // Mark busy
          if (subj.teacher) {
            teacherBusy[subj.teacher].add(key);
            teacherDayH[subj.teacher][d]++;
          }
          if (room) roomBusy[room.name].add(key);
          groupBusy[grp.name].add(key);
          scheduled++;
        }

        if (scheduled < hoursLeft) {
          conflicts.push({
            group:   grp.name,
            subject: subj.name,
            reason:  `Could only schedule ${scheduled}/${hoursLeft} hours`,
            type:    'unscheduled',
          });
        }
      });
    });

    return { entries, conflicts };
  }, [groups, teachers, rooms, days, timeSlots]);

  // ── CLAUDE API: fix conflicts ─────────────────────────────────────────
  const fixWithClaude = async (entries, conflicts) => {
    if (conflicts.length === 0) return entries;
    setAiFixing(true);
    log('🤖 Sending conflicts to Claude AI for resolution...', 'ai');

    try {
      const prompt = `You are a university schedule optimizer. 
      
Here is a schedule that was generated algorithmically. Some conflicts remain:
${JSON.stringify(conflicts, null, 2)}

Available resources:
- Days: ${days.join(', ')}
- Time slots: ${timeSlots.join(', ')}
- Teachers: ${JSON.stringify(teachers.map(t => ({ name: t.name, maxHoursPerDay: t.maxHoursPerDay, preferredDays: t.preferredDays, preferredTimes: t.preferredTimes, pinnedSlots: t.pinnedSlots })))}
- Rooms: ${JSON.stringify(rooms.map(r => ({ name: r.name, isLab: r.isLab })))}
- Groups: ${JSON.stringify(groups.map(g => g.name))}

Current schedule entries (already placed):
${JSON.stringify(entries.slice(0, 60), null, 2)}

For each conflict, suggest a resolution as a JSON array of new schedule entries to add or modify. 
Each entry must have: group, day, time, course, teacher, room, subjectType, duration.
Respect all constraints: no teacher double-booking, no room double-booking, no group double-booking, teacher max hours per day, labs in lab rooms only.
Return ONLY a valid JSON array of entries, no explanation, no markdown.`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = await res.json();
      const raw  = (data.content || []).map(b => b.text || '').join('');
      const clean = raw.replace(/```json|```/g, '').trim();
      const fixes = JSON.parse(clean);

      if (Array.isArray(fixes) && fixes.length > 0) {
        log(`✅ Claude resolved ${fixes.length} conflict(s)`, 'success');
        return [...entries, ...fixes];
      }
    } catch (e) {
      log(`⚠️ Claude fix failed: ${e.message} — keeping algorithm result`, 'warn');
    } finally {
      setAiFixing(false);
    }
    return entries;
  };

  // ── GENERATE ──────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setGenerating(true);
    setLog([]);
    setGenerated(null);
    setApplied(false);

    log('⚙️ Running constraint-based algorithm...', 'info');
    await new Promise(r => setTimeout(r, 300));

    const { entries, conflicts } = runAlgorithm();
    log(`📋 Algorithm placed ${entries.length} classes`, 'success');
    if (conflicts.length > 0) {
      log(`⚠️ ${conflicts.length} conflict(s) found — sending to Claude...`, 'warn');
      const fixed = await fixWithClaude(entries, conflicts);
      const remaining = conflicts.filter(c =>
        !fixed.some(e => e.group === c.group && e.course === c.subject)
      );
      log(`🏁 Done — ${fixed.length} classes placed, ${remaining.length} unresolved`, remaining.length === 0 ? 'success' : 'warn');
      setGenerated({ entries: fixed, conflicts: remaining, stats: buildStats(fixed) });
    } else {
      log('🏁 Done — no conflicts!', 'success');
      setGenerated({ entries, conflicts: [], stats: buildStats(entries) });
    }

    setGenerating(false);
    setStep(5);
  };

  const buildStats = (entries) => ({
    total:    entries.length,
    byGroup:  [...new Set(entries.map(e => e.group))].map(g => ({
      name: g, count: entries.filter(e => e.group === g).length,
    })),
    byTeacher: [...new Set(entries.map(e => e.teacher).filter(Boolean))].map(tc => ({
      name: tc, count: entries.filter(e => e.teacher === tc).length,
    })),
    byDay: days.map(d => ({ day: d, count: entries.filter(e => e.day === d).length })),
  });

  // ── APPLY ─────────────────────────────────────────────────────────────
  const handleApply = async () => {
    if (!generated) return;
    try {
      // importSchedule expects a JSON string of entries array
      await importSchedule(JSON.stringify(generated.entries));
      setApplied(true);
      log('✅ Schedule applied to live timetable!', 'success');
    } catch (e) {
      log(`❌ Apply failed: ${e.message}`, 'error');
    }
  };

  // ── PIN SLOT HELPERS ─────────────────────────────────────────────────
  const addPin = (tIdx) => {
    setTeachers(prev => prev.map((tc, i) =>
      i === tIdx ? { ...tc, pinnedSlots: [...tc.pinnedSlots, { id: uid(), day: '', time: '' }] } : tc
    ));
  };
  const updatePin = (tIdx, pIdx, field, val) => {
    setTeachers(prev => prev.map((tc, i) =>
      i === tIdx ? {
        ...tc,
        pinnedSlots: tc.pinnedSlots.map((p, j) => j === pIdx ? { ...p, [field]: val } : p),
      } : tc
    ));
  };
  const removePin = (tIdx, pIdx) => {
    setTeachers(prev => prev.map((tc, i) =>
      i === tIdx ? { ...tc, pinnedSlots: tc.pinnedSlots.filter((_, j) => j !== pIdx) } : tc
    ));
  };

  // ── UI HELPERS ────────────────────────────────────────────────────────
  const addSubjectToGroup = (gIdx) =>
    setGroups(prev => prev.map((g, i) => i === gIdx ? { ...g, subjects: [...g.subjects, emptySubject()] } : g));
  const updateSubject = (gIdx, sIdx, field, val) =>
    setGroups(prev => prev.map((g, i) => i === gIdx ? {
      ...g, subjects: g.subjects.map((s, j) => j === sIdx ? { ...s, [field]: val } : s),
    } : g));
  const removeSubject = (gIdx, sIdx) =>
    setGroups(prev => prev.map((g, i) => i === gIdx ? {
      ...g, subjects: g.subjects.filter((_, j) => j !== sIdx),
    } : g));

  const inp  = { className: 'as-input' };
  const sel  = { className: 'as-select' };

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="as-wrap">
      {/* Header */}
      <div className="as-header">
        <div className="as-header-icon">🤖</div>
        <div>
          <div className="as-title">Auto Schedule Generator</div>
          <div className="as-sub">Hybrid algorithm + Claude AI conflict resolver</div>
        </div>
      </div>

      {/* Step bar */}
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
          <div className="as-panel-title">📋 What is this?</div>
          <div className="as-explainer">
            <div className="as-explainer-step">
              <div className="as-exp-num">1</div>
              <div><strong>Add teachers</strong> with their max hours/day, preferred days/times, and any pinned slots (e.g. "Prof. Asanov must teach Monday at 9:00")</div>
            </div>
            <div className="as-explainer-step">
              <div className="as-exp-num">2</div>
              <div><strong>Add rooms</strong> — mark which are labs so lab subjects get assigned correctly</div>
            </div>
            <div className="as-explainer-step">
              <div className="as-exp-num">3</div>
              <div><strong>Add groups and their subjects</strong> — specify hours per week, teacher, and type</div>
            </div>
            <div className="as-explainer-step">
              <div className="as-exp-num">4</div>
              <div><strong>Generate</strong> — the algorithm places all classes respecting constraints, then Claude AI resolves any remaining conflicts</div>
            </div>
            <div className="as-explainer-step">
              <div className="as-exp-num">5</div>
              <div><strong>Preview and apply</strong> — review the generated schedule before pushing it live</div>
            </div>
          </div>
          <div className="as-setup-btns">
            <button className="as-btn-primary" onClick={() => setStep(1)}>Start Fresh →</button>
            <button className="as-btn-import" onClick={() => {
              const extracted = extractFromSchedule(schedule, existingGroups);
              if (extracted.teachers.length === 0 && extracted.groups.length === 0) {
                alert('No existing schedule data found. Please start fresh.');
                return;
              }
              if (extracted.teachers.length > 0) setTeachers(extracted.teachers);
              if (extracted.rooms.length > 0)    setRooms(extracted.rooms);
              if (extracted.groups.length > 0)   setGroups(extracted.groups);
              setStep(1);
            }}>
              ⚡ Import from Current Schedule
              <span className="as-import-hint">
                {existingGroups.length} groups · {[...new Set(Object.values(schedule).map(e=>e.teacher).filter(Boolean))].length} teachers · {[...new Set(Object.values(schedule).map(e=>e.room).filter(Boolean))].length} rooms
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
                <div className="as-field">
                  <label>Name *</label>
                  <input {...inp} placeholder="e.g. Prof. Asanov" value={tc.name}
                    onChange={e => setTeachers(prev => prev.map((x, i) => i === tIdx ? { ...x, name: e.target.value } : x))} />
                </div>
                <div className="as-field as-field-sm">
                  <label>Max hrs/day</label>
                  <input {...inp} type="number" min={1} max={8} value={tc.maxHoursPerDay}
                    onChange={e => setTeachers(prev => prev.map((x, i) => i === tIdx ? { ...x, maxHoursPerDay: +e.target.value } : x))} />
                </div>
                <button className="as-btn-remove" onClick={() => setTeachers(prev => prev.filter((_, i) => i !== tIdx))}>✕</button>
              </div>

              {/* Preferred days */}
              <div className="as-field">
                <label>Preferred days</label>
                <div className="as-chip-row">
                  {days.map(d => (
                    <button key={d}
                      className={`as-chip ${tc.preferredDays.includes(d) ? 'on' : ''}`}
                      onClick={() => setTeachers(prev => prev.map((x, i) => i === tIdx ? {
                        ...x, preferredDays: x.preferredDays.includes(d)
                          ? x.preferredDays.filter(pd => pd !== d)
                          : [...x.preferredDays, d],
                      } : x))}
                    >{(t(d)||d).slice(0,3)}</button>
                  ))}
                </div>
              </div>

              {/* Preferred times */}
              <div className="as-field">
                <label>Preferred time slots</label>
                <div className="as-chip-row">
                  {timeSlots.map(tm => (
                    <button key={tm}
                      className={`as-chip ${tc.preferredTimes.includes(tm) ? 'on' : ''}`}
                      onClick={() => setTeachers(prev => prev.map((x, i) => i === tIdx ? {
                        ...x, preferredTimes: x.preferredTimes.includes(tm)
                          ? x.preferredTimes.filter(pt => pt !== tm)
                          : [...x.preferredTimes, tm],
                      } : x))}
                    >{tm}</button>
                  ))}
                </div>
              </div>

              {/* Pinned slots */}
              <div className="as-field">
                <label>📌 Pinned slots <span className="as-hint">(must teach at this exact day+time)</span></label>
                {tc.pinnedSlots.map((pin, pIdx) => (
                  <div key={pin.id} className="as-pin-row">
                    <select {...sel} value={pin.day} onChange={e => updatePin(tIdx, pIdx, 'day', e.target.value)}>
                      <option value="">Day</option>
                      {days.map(d => <option key={d} value={d}>{t(d)||d}</option>)}
                    </select>
                    <select {...sel} value={pin.time} onChange={e => updatePin(tIdx, pIdx, 'time', e.target.value)}>
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
              <div className="as-field">
                <label>Room name *</label>
                <input {...inp} placeholder="e.g. B201" value={rm.name}
                  onChange={e => setRooms(prev => prev.map((x, i) => i === rIdx ? { ...x, name: e.target.value } : x))} />
              </div>
              <div className="as-field as-field-sm">
                <label>Capacity</label>
                <input {...inp} type="number" min={1} value={rm.capacity}
                  onChange={e => setRooms(prev => prev.map((x, i) => i === rIdx ? { ...x, capacity: +e.target.value } : x))} />
              </div>
              <div className="as-field as-field-sm">
                <label>Type</label>
                <button
                  className={`as-chip ${rm.isLab ? 'on' : ''}`}
                  onClick={() => setRooms(prev => prev.map((x, i) => i === rIdx ? { ...x, isLab: !x.isLab } : x))}
                >🧪 Lab</button>
              </div>
              <button className="as-btn-remove" onClick={() => setRooms(prev => prev.filter((_, i) => i !== rIdx))}>✕</button>
            </div>
          ))}
          <button className="as-btn-ghost" onClick={() => setRooms(prev => [...prev, emptyRoom()])}>+ Add Room</button>
          <div className="as-nav-row">
            <button className="as-btn-secondary" onClick={() => setStep(1)}>← Back</button>
            <button className="as-btn-primary" onClick={() => setStep(3)}>Next: Groups →</button>
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
                <div className="as-field">
                  <label>Group name *</label>
                  <input {...inp} placeholder="e.g. CS-22" value={grp.name}
                    onChange={e => setGroups(prev => prev.map((x, i) => i === gIdx ? { ...x, name: e.target.value } : x))} />
                </div>
                <button className="as-btn-remove" onClick={() => setGroups(prev => prev.filter((_, i) => i !== gIdx))}>✕</button>
              </div>

              {/* Subjects */}
              <div className="as-subjects">
                {grp.subjects.map((subj, sIdx) => (
                  <div key={subj.id} className="as-subject-row">
                    <input {...inp} placeholder="Subject name" value={subj.name}
                      onChange={e => updateSubject(gIdx, sIdx, 'name', e.target.value)} />
                    <select {...sel} value={subj.type}
                      onChange={e => updateSubject(gIdx, sIdx, 'type', e.target.value)}>
                      {SUBJECT_TYPES.map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                    <select {...sel} value={subj.teacher}
                      onChange={e => updateSubject(gIdx, sIdx, 'teacher', e.target.value)}>
                      <option value="">No teacher</option>
                      {teachers.filter(tc => tc.name.trim()).map(tc => (
                        <option key={tc.id} value={tc.name}>{tc.name}</option>
                      ))}
                    </select>
                    <div className="as-hrs-field">
                      <input {...inp} type="number" min={1} max={5} value={subj.hoursPerWeek}
                        onChange={e => updateSubject(gIdx, sIdx, 'hoursPerWeek', +e.target.value)}
                        title="Hours per week" />
                      <span className="as-hrs-lbl">hrs/wk</span>
                    </div>
                    <button
                      className={`as-chip ${subj.needsLab ? 'on' : ''}`}
                      onClick={() => updateSubject(gIdx, sIdx, 'needsLab', !subj.needsLab)}
                      title="Requires lab room">🧪</button>
                    <button className="as-btn-remove-sm" onClick={() => removeSubject(gIdx, sIdx)}>✕</button>
                  </div>
                ))}
                <button className="as-btn-ghost as-btn-ghost-sm" onClick={() => addSubjectToGroup(gIdx)}>+ Add subject</button>
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

          {/* Summary */}
          <div className="as-summary-grid">
            <div className="as-summary-card">
              <div className="as-summary-val">{teachers.filter(t => t.name.trim()).length}</div>
              <div className="as-summary-lbl">Teachers</div>
            </div>
            <div className="as-summary-card">
              <div className="as-summary-val">{rooms.filter(r => r.name.trim()).length}</div>
              <div className="as-summary-lbl">Rooms</div>
            </div>
            <div className="as-summary-card">
              <div className="as-summary-val">{groups.filter(g => g.name.trim()).length}</div>
              <div className="as-summary-lbl">Groups</div>
            </div>
            <div className="as-summary-card">
              <div className="as-summary-val">{groups.reduce((a, g) => a + g.subjects.length, 0)}</div>
              <div className="as-summary-lbl">Subjects</div>
            </div>
          </div>

          <button
            className="as-btn-generate"
            onClick={handleGenerate}
            disabled={generating || aiFixing}
          >
            {generating ? '⚙️ Running algorithm...' : aiFixing ? '🤖 Claude fixing conflicts...' : '🚀 Generate Schedule'}
          </button>

          {/* Log */}
          {genLog.length > 0 && (
            <div className="as-log">
              {genLog.map((l, i) => (
                <div key={i} className={`as-log-line as-log-${l.type}`}>{l.msg}</div>
              ))}
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

          {/* Stats row */}
          <div className="as-summary-grid">
            <div className="as-summary-card green">
              <div className="as-summary-val">{generated.stats.total}</div>
              <div className="as-summary-lbl">Classes placed</div>
            </div>
            <div className={`as-summary-card ${generated.conflicts.length > 0 ? 'red' : 'green'}`}>
              <div className="as-summary-val">{generated.conflicts.length}</div>
              <div className="as-summary-lbl">Unresolved conflicts</div>
            </div>
            {generated.stats.byGroup.map(g => (
              <div key={g.name} className="as-summary-card">
                <div className="as-summary-val">{g.count}</div>
                <div className="as-summary-lbl">{g.name}</div>
              </div>
            ))}
          </div>

          {/* Conflicts */}
          {generated.conflicts.length > 0 && (
            <div className="as-conflicts">
              <div className="as-conflicts-title">⚠️ Unresolved ({generated.conflicts.length})</div>
              {generated.conflicts.map((c, i) => (
                <div key={i} className="as-conflict-row">
                  <strong>{c.group}</strong> · {c.subject} — {c.reason}
                </div>
              ))}
            </div>
          )}

          {/* Preview table */}
          <div className="as-preview-scroll">
            <table className="as-preview-table">
              <thead>
                <tr>
                  <th>Group</th><th>Day</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Room</th><th>Type</th>
                </tr>
              </thead>
              <tbody>
                {generated.entries.map((e, i) => (
                  <tr key={i}>
                    <td><strong>{e.group}</strong></td>
                    <td>{e.day}</td>
                    <td>{e.time}</td>
                    <td>{e.course}</td>
                    <td>{e.teacher || '—'}</td>
                    <td>{e.room || '—'}</td>
                    <td><span className={`as-type-badge as-type-${e.subjectType}`}>{e.subjectType}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Apply button */}
          {applied ? (
            <div className="as-applied">✅ Schedule successfully applied to the live timetable!</div>
          ) : (
            <div className="as-apply-row">
              <button className="as-btn-secondary" onClick={() => setStep(4)}>← Re-generate</button>
              <button className="as-btn-apply" onClick={handleApply}>
                ✅ Apply to Live Schedule
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}