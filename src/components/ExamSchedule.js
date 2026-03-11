// src/components/ExamSchedule.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useSchedule } from '../context/ScheduleContext';
import './ExamSchedule.css';

const API_URL  = process.env.REACT_APP_API_URL || 'https://timetablebackend-production.up.railway.app/api';
const DURATIONS = [60, 90, 120, 150, 180];
const TIME_SLOTS = [
  '8:00','8:30','9:00','9:30','10:00','10:30','11:00','11:30',
  '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30',
  '16:00','16:30','17:00','17:30','18:00',
];

const getToken = () =>
  localStorage.getItem('token') ||
  localStorage.getItem('scheduleToken') || '';

const fmt = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
};

const endTime = (start, dur) => {
  try {
    const parts = (start || '').split(':');
    const h = Math.min(23, Math.max(0, parseInt(parts[0]) || 0));
    const m = Math.min(59, Math.max(0, parseInt(parts[1]) || 0));
    const d = Math.min(300, Math.max(0, parseInt(dur) || 0));
    const total = h * 60 + m + d;
    const endH  = Math.floor(total / 60) % 24;
    const endM  = total % 60;
    return `${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}`;
  } catch { return '??:??'; }
};

const emptyForm = () => ({
  group_names: [],
  subject:     '',
  teacher:     '',
  room:        '',
  exam_date:   '',
  start_time:  '9:00',
  duration:    90,
  notes:       '',
});

const toMinsLocal = (t) => {
  const [h,m] = (t||'0:0').split(':').map(Number);
  return h*60+m;
};

// GroupPicker
const GroupPicker = ({ groups, selected, onChange, t }) => {
  const [search, setSearch] = useState('');
  const filtered = groups.filter(g => g.toLowerCase().includes(search.toLowerCase()));
  const toggle = (g) => {
    if (selected.includes(g)) onChange(selected.filter(x => x !== g));
    else onChange([...selected, g]);
  };
  return (
    <div className="es-group-picker">
      <div className="es-gp-header">
        <span className="es-gp-count">
          {selected.length > 0 ? `${selected.length} group${selected.length > 1 ? 's' : ''} selected` : 'No groups selected'}
        </span>
        <div className="es-gp-actions">
          <button type="button" className="es-gp-btn" onClick={() => onChange([...groups])}>All</button>
          <button type="button" className="es-gp-btn" onClick={() => onChange([])}>Clear</button>
        </div>
      </div>
      <input className="es-input es-gp-search" placeholder={t('examSearchGroups')||'Search groups...'} value={search} onChange={e => setSearch(e.target.value)} />
      <div className="es-gp-grid">
        {filtered.map(g => (
          <button key={g} type="button" className={`es-gp-chip ${selected.includes(g) ? 'on' : ''}`} onClick={() => toggle(g)}>
            {selected.includes(g) && <span className="es-gp-check">✓</span>}{g}
          </button>
        ))}
      </div>
      {selected.length > 0 && (
        <div className="es-gp-selected">
          {selected.map(g => (
            <span key={g} className="es-gp-pill">{g}<button type="button" onClick={() => toggle(g)}>×</button></span>
          ))}
        </div>
      )}
    </div>
  );
};

export default function ExamSchedule({ readOnly = false, showExamsToGuests = false, setShowExamsToGuests = null }) {
  const { t } = useLanguage();
  const { groups, schedule } = useSchedule();

  const [exams,    setExams]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [form,     setForm]     = useState(emptyForm());
  const [error,    setError]    = useState('');
  const [saving,   setSaving]   = useState(false);
  const [filterGrp,setFilterGrp]= useState('');
  const [filterSubj,setFilterSubj]= useState('');
  const [sending,  setSending]  = useState(null);
  const [sendLog,  setSendLog]  = useState([]);

  const allRooms    = useMemo(() => [...new Set(Object.values(schedule).map(e=>e.room).filter(Boolean))].sort(), [schedule]);
  const allTeachers = useMemo(() => [...new Set(Object.values(schedule).map(e=>e.teacher).filter(Boolean))].sort(), [schedule]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/exams`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const d = await r.json();
      if (d.success) setExams(d.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggleGuestExams = async (val) => {
    try {
      await fetch(`${API_URL}/settings/show_exams_to_guests`, {
        method: 'PUT',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${getToken()}` },
        body: JSON.stringify({ value: String(val) }),
      });
      if (setShowExamsToGuests) setShowExamsToGuests(val);
    } catch (e) { console.error('Toggle failed:', e); }
  };

  const handleSave = async () => {
    setError('');
    if (!form.group_names || form.group_names.length === 0) return setError('Select at least one group');
    if (!form.subject.trim()) return setError('Subject is required');
    if (!form.room.trim()) return setError('Room is required');
    if (!form.exam_date) return setError('Date is required');
    if (!form.start_time) return setError('Start time is required');
    setSaving(true);
    try {
      const url = editId ? `${API_URL}/exams/${editId}` : `${API_URL}/exams`;
      const method = editId ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: { 'Content-Type':'application/json', Authorization:`Bearer ${getToken()}` }, body: JSON.stringify(form) });
      const d = await r.json();
      if (!d.success) return setError(d.error || 'Failed to save');
      setShowForm(false); setEditId(null); setForm(emptyForm()); load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('examDeleteConfirm') || 'Delete this exam?')) return;
    await fetch(`${API_URL}/exams/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
    setExams(prev => prev.filter(e => e.id !== id));
  };

  const handleEdit = (exam) => {
    setForm({
      group_names: exam.group_names || [],
      subject: exam.subject, teacher: exam.teacher || '',
      room: exam.room, exam_date: exam.exam_date?.slice(0,10) || '',
      start_time: exam.start_time, duration: exam.duration, notes: exam.notes || '',
    });
    setEditId(exam.id); setShowForm(true); setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBroadcast = async (exam) => {
    setSending(exam.id); setSendLog([]);
    const groupNames = exam.group_names || [];
    try {
      const text = `🎓 <b>Exam Notice</b>\n━━━━━━━━━━━━━━━━━━━━━━\n📚 <b>${exam.subject}</b>\n👥 Groups: <b>${groupNames.join(', ')}</b>\n📅 Date: <b>${fmt(exam.exam_date)}</b>\n⏰ Time: <b>${exam.start_time} – ${endTime(exam.start_time, exam.duration)}</b> (${exam.duration} min)\n🚪 Room: <b>${exam.room}</b>\n${exam.teacher ? `👨‍🏫 Examiner: <b>${exam.teacher}</b>\n` : ''}${exam.notes ? `📝 Notes: ${exam.notes}\n` : ''}━━━━━━━━━━━━━━━━━━━━━━\n<i>— Alatoo International University</i>`;
      const r = await fetch(`${API_URL}/broadcast`, { method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${getToken()}`}, body: JSON.stringify({ subject:`Exam: ${exam.subject}`, message:text, groupNames }) });
      const d = await r.json();
      if (d.success) setSendLog([`✅ Sent to ${groupNames.length} group(s) — ${d.sent} delivered, ${d.failed} failed`]);
      else setSendLog([`❌ Failed: ${d.error}`]);
    } catch (e) { setSendLog([`❌ Error: ${e.message}`]); }
    finally { setSending(null); }
  };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    const rows = filteredExams.map(e => {
      const gNames = (e.group_names || []).join(', ');
      return `<tr><td>${fmt(e.exam_date)}</td><td>${e.start_time} – ${endTime(e.start_time, e.duration)}</td><td>${e.duration} min</td><td>${gNames}</td><td>${e.subject}</td><td>${e.teacher || '—'}</td><td>${e.room}</td><td>${e.notes || '—'}</td></tr>`;
    }).join('');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Exam Schedule</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:'Times New Roman',serif;font-size:10pt}table{width:100%;border-collapse:collapse}th{background:#1e293b;color:#fff;padding:6px 8px;font-size:8pt;text-align:left}td{padding:5px 8px;font-size:9pt;border-bottom:1px solid #e2e8f0}tr:nth-child(even) td{background:#f8fafc}</style></head><body><h2 style="text-align:center">Examination Schedule — Alatoo International University</h2><table><thead><tr><th>Date</th><th>Time</th><th>Duration</th><th>Groups</th><th>Subject</th><th>Examiner</th><th>Room</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>{window.print()}</script></body></html>`);
    w.document.close();
  };

  const subjects = useMemo(() => {
    return [...new Set(exams.map(e => e.subject).filter(Boolean))].sort();
  }, [exams]);

  const filteredExams = useMemo(() => exams.filter(e => {
    if (filterGrp && !(e.group_names || []).includes(filterGrp)) return false;
    if (filterSubj && e.subject !== filterSubj) return false;
    return true;
  }), [exams, filterGrp, filterSubj]);

  const byDate = useMemo(() => {
    const map = {};
    filteredExams.forEach(e => {
      const d = e.exam_date?.slice(0,10);
      if (!map[d]) map[d] = [];
      map[d].push(e);
    });
    return map;
  }, [filteredExams]);

  const conflictIds = useMemo(() => {
    const ids = new Set();
    const byDateRoom = {};
    exams.forEach(e => {
      const k = `${e.exam_date}__${e.room}`;
      byDateRoom[k] = byDateRoom[k] || [];
      byDateRoom[k].push(e);
    });
    Object.values(byDateRoom).forEach(group => {
      for (let i = 0; i < group.length; i++) {
        for (let j = i+1; j < group.length; j++) {
          const a = group[i], b = group[j];
          const aS = toMinsLocal(a.start_time), aE = aS + a.duration;
          const bS = toMinsLocal(b.start_time), bE = bS + b.duration;
          if (aS < bE && aE > bS) { ids.add(a.id); ids.add(b.id); }
        }
      }
    });
    return ids;
  }, [exams]);

  return (
    <div className="es-wrap">
      <div className="es-header">
        <div className="es-header-left">
          <div className="es-header-icon">📋</div>
          <div>
            <div className="es-title">{t('examSchedule') || 'Exam Schedule'}</div>
            <div className="es-sub">
              {exams.length} exam{exams.length !== 1 ? 's' : ''}
              {conflictIds.size > 0 ? ` · ⚠️ ${Math.floor(conflictIds.size/2)} room conflict(s)` : ' · ✅ No conflicts'}
            </div>
          </div>
        </div>
        <div className="es-header-actions">
          {!readOnly && (
            <label className="es-guest-toggle">
              <div className={`es-toggle-track ${showExamsToGuests ? 'on' : ''}`} onClick={() => handleToggleGuestExams(!showExamsToGuests)}>
                <div className="es-toggle-thumb" />
              </div>
              <span className="es-toggle-label">{showExamsToGuests ? '👁 Visible to guests' : '🔒 Hidden from guests'}</span>
            </label>
          )}
          <button className="es-btn-print" onClick={handlePrint}>🖨 {t('examPrint') || 'Print / PDF'}</button>
          {!readOnly && (
            <button className="es-btn-add" onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm()); setError(''); }}>
              + {t('addExam') || 'Add Exam'}
            </button>
          )}
        </div>
      </div>

      <div className="es-filters">
        <select className="es-select" value={filterGrp} onChange={e => setFilterGrp(e.target.value)}>
          <option value="">{t('examFilterGroup') || 'All Groups'}</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className="es-select" value={filterSubj} onChange={e => setFilterSubj(e.target.value)}>
          <option value="">{t('examFilterSubject') || 'All Subjects'}</option>
          {subjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(filterGrp || filterSubj) && (
          <button className="es-btn-clear" onClick={() => { setFilterGrp(''); setFilterSubj(''); }}>✕ Clear</button>
        )}
        <div className="es-count">{filteredExams.length} exam{filteredExams.length !== 1 ? 's' : ''}</div>
      </div>

      {sendLog.length > 0 && (
        <div className="es-sendlog">{sendLog.map((l,i) => <div key={i}>{l}</div>)}</div>
      )}

      {showForm && !readOnly && (
        <div className="es-form-wrap">
          <div className="es-form-title">{editId ? `✏️ ${t('editExam')||'Edit Exam'}` : `+ ${t('addExam')||'New Exam'}`}</div>
          {error && <div className="es-error">⚠️ {error}</div>}
          <div className="es-form-grid">
            <div className="es-field">
              <label>{t('examSubject') || 'Subject'} *</label>
              <input className="es-input" placeholder="e.g. Mathematics" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
            </div>
            <div className="es-field">
              <label>{t('examTeacher') || 'Examiner'}</label>
              <input className="es-input" list="es-teachers-list" placeholder={t('examTeacherName')||'Teacher name'} value={form.teacher} onChange={e => setForm(f => ({ ...f, teacher: e.target.value }))} />
              <datalist id="es-teachers-list">{allTeachers.map(tc => <option key={tc} value={tc} />)}</datalist>
            </div>
            <div className="es-field">
              <label>{t('examRoom') || 'Room'} *</label>
              <input className="es-input" list="es-rooms-list" placeholder="e.g. B201" value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} />
              <datalist id="es-rooms-list">{allRooms.map(r => <option key={r} value={r} />)}</datalist>
            </div>
            <div className="es-field">
              <label>{t('examDate') || 'Date'} *</label>
              <input className="es-input" type="date" value={form.exam_date} onChange={e => setForm(f => ({ ...f, exam_date: e.target.value }))} />
            </div>
            <div className="es-field">
              <label>{t('examTime') || 'Start Time'} *</label>
              <select className="es-select" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}>
                {TIME_SLOTS.map(ts => <option key={ts} value={ts}>{ts}</option>)}
              </select>
            </div>
            <div className="es-field">
              <label>{t('examDuration') || 'Duration'}</label>
              <select className="es-select" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: +e.target.value }))}>
                {DURATIONS.map(d => <option key={d} value={d}>{d} {t('examMinutes')||'min'}</option>)}
              </select>
            </div>
            <div className="es-field es-field-full">
              <label>{t('examNotes') || 'Notes'}</label>
              <input className="es-input" placeholder={t('examOptionalNotes')||'Optional instructions...'} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          {form.start_time && form.duration && (
            <div className="es-time-preview">⏰ {form.start_time} – {endTime(form.start_time, form.duration)} ({form.duration} {t('examMinutes')||'min'})</div>
          )}
          <div className="es-field es-field-full" style={{ marginBottom:14 }}>
            <label style={{ fontSize:'0.68rem', fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6, display:'block' }}>
              {t('examGroups') || 'Groups'} *
              <span style={{ color:'#94a3b8', fontWeight:400, textTransform:'none', marginLeft:6 }}>— select all groups taking this exam</span>
            </label>
            <GroupPicker groups={groups} selected={form.group_names} onChange={val => setForm(f => ({ ...f, group_names: val }))} t={t} />
          </div>
          <div className="es-form-actions">
            <button className="es-btn-cancel" onClick={() => { setShowForm(false); setEditId(null); setError(''); }}>{t('cancel') || 'Cancel'}</button>
            <button className="es-btn-save" onClick={handleSave} disabled={saving}>{saving ? '...' : editId ? t('save')||'Save Changes' : t('addExam')||'Add Exam'}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="es-loading">{t('loading') || 'Loading...'}</div>
      ) : Object.keys(byDate).length === 0 ? (
        <div className="es-empty">
          <div style={{ fontSize:'2.5rem', marginBottom:8 }}>📋</div>
          <div>{t('examNoData') || 'No exams scheduled yet.'}</div>
          {!readOnly && <div style={{ fontSize:'0.78rem', color:'#94a3b8', marginTop:4 }}>Click "+ Add Exam" to create the first entry.</div>}
        </div>
      ) : (
        <div className="es-table-wrap">
          <table className="es-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Subject</th>
                <th>Groups</th>
                <th>Examiner</th>
                <th>Room</th>
                <th>Notes</th>
                {!readOnly && <th></th>}
              </tr>
            </thead>
            <tbody>
              {Object.entries(byDate)
                .sort(([a],[b]) => a.localeCompare(b))
                .flatMap(([date, dayExams]) => [
                  <tr key={`d-${date}`} className="es-date-row">
                    <td colSpan={readOnly ? 7 : 8}>
                      📅 {fmt(date)} — {new Date(date).toLocaleDateString('en-GB',{ weekday:'long' })}
                    </td>
                  </tr>,
                  ...dayExams
                    .sort((a,b) => a.start_time.localeCompare(b.start_time))
                    .map(exam => {
                      const gNames = exam.group_names || [];
                      return (
                        <tr key={exam.id} className={conflictIds.has(exam.id) ? 'es-row-conflict' : ''}>
                          <td className="es-td-date">{fmt(exam.exam_date)}</td>
                          <td className="es-td-time">
                            {exam.start_time}–{endTime(exam.start_time, exam.duration)}
                            <span className="es-td-dur">{exam.duration}m</span>
                          </td>
                          <td className="es-td-subject">
                            {exam.subject}
                            {conflictIds.has(exam.id) && <span className="es-conflict-badge">⚠️ conflict</span>}
                          </td>
                          <td>
                            <div className="es-td-groups">
                              {gNames.map(g => <span key={g} className="es-group-pill">{g}</span>)}
                              {gNames.length > 1 && <span className="es-group-joint">joint</span>}
                            </div>
                          </td>
                          <td style={{ fontSize:'0.78rem' }}>{exam.teacher || '—'}</td>
                          <td style={{ fontSize:'0.78rem', fontWeight:600 }}>{exam.room}</td>
                          <td className="es-td-notes">{exam.notes || ''}</td>
                          {!readOnly && (
                            <td>
                              <div className="es-td-actions">
                                <button className="es-action-btn tg" onClick={() => handleBroadcast(exam)} disabled={sending === exam.id} title="Send Telegram">{sending === exam.id ? '⏳' : '📨'}</button>
                                <button className="es-action-btn edit" onClick={() => handleEdit(exam)} title="Edit">✏️</button>
                                <button className="es-action-btn del" onClick={() => handleDelete(exam.id)} title="Delete">🗑</button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                ])}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}