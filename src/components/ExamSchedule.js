// src/components/ExamSchedule.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { useLanguage } from '../context/LanguageContext';
import './ExamSchedule.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://timetablebackend-production.up.railway.app/api';

const DURATIONS  = [60, 90, 120, 150, 180];
const TIME_SLOTS = ['8:00','8:30','9:00','9:30','10:00','10:30','11:00','11:30',
                    '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30',
                    '16:00','16:30','17:00','17:30','18:00'];

const getToken = () =>
  localStorage.getItem('token') ||
  localStorage.getItem('scheduleToken') || '';

const fmt = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
};

const endTime = (start, dur) => {
  const [h, m] = start.split(':').map(Number);
  const total  = h * 60 + m + dur;
  return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
};

const emptyForm = () => ({
  group_name:'', subject:'', teacher:'', room:'',
  exam_date:'', start_time:'9:00', duration:90, notes:''
});

export default function ExamSchedule() {
  const { groups, schedule } = useSchedule();
  const { t } = useLanguage();

  const [exams,     setExams]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState(null);
  const [form,      setForm]      = useState(emptyForm());
  const [error,     setError]     = useState('');
  const [saving,    setSaving]    = useState(false);
  const [filterGrp, setFilterGrp] = useState('');
  const [filterMon, setFilterMon] = useState('');
  const [sending,   setSending]   = useState(false);
  const [sendLog,   setSendLog]   = useState([]);

  // Derive rooms and teachers from schedule
  const allRooms    = useMemo(() => [...new Set(Object.values(schedule).map(e=>e.room).filter(Boolean))].sort(), [schedule]);
  const allTeachers = useMemo(() => [...new Set(Object.values(schedule).map(e=>e.teacher).filter(Boolean))].sort(), [schedule]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/exams`, { headers: { Authorization: `Bearer ${getToken()}` }});
      const d = await r.json();
      if (d.success) setExams(d.data);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setError('');
    if (!form.group_name || !form.subject || !form.room || !form.exam_date || !form.start_time)
      return setError('Please fill in all required fields');
    setSaving(true);
    try {
      const url    = editId ? `${API_URL}/exams/${editId}` : `${API_URL}/exams`;
      const method = editId ? 'PUT' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${getToken()}` },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!d.success) return setError(d.error || 'Failed to save');
      setShowForm(false); setEditId(null); setForm(emptyForm());
      load();
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this exam?')) return;
    await fetch(`${API_URL}/exams/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    setExams(prev => prev.filter(e => e.id !== id));
  };

  const handleEdit = (exam) => {
    setForm({
      group_name: exam.group_name, subject: exam.subject,
      teacher: exam.teacher, room: exam.room,
      exam_date: exam.exam_date?.slice(0,10), start_time: exam.start_time,
      duration: exam.duration, notes: exam.notes || '',
    });
    setEditId(exam.id);
    setShowForm(true);
    setError('');
  };

  // ── Telegram broadcast ────────────────────────────────────────────────
  const handleBroadcast = async (exam) => {
    setSending(true);
    setSendLog([]);
    try {
      const text =
        `🎓 <b>Exam Notice</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📚 <b>${exam.subject}</b>\n` +
        `👥 Group: <b>${exam.group_name}</b>\n` +
        `📅 Date: <b>${fmt(exam.exam_date)}</b>\n` +
        `⏰ Time: <b>${exam.start_time} – ${endTime(exam.start_time, exam.duration)}</b> (${exam.duration} min)\n` +
        `🚪 Room: <b>${exam.room}</b>\n` +
        (exam.teacher ? `👨‍🏫 Examiner: <b>${exam.teacher}</b>\n` : '') +
        (exam.notes   ? `📝 Notes: ${exam.notes}\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `<i>— Alatoo International University</i>`;

      const r = await fetch(`${API_URL}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${getToken()}` },
        body: JSON.stringify({
          subject: `Exam: ${exam.subject}`,
          message: text,
          groupNames: [exam.group_name],
        }),
      });
      const d = await r.json();
      if (d.success) {
        setSendLog([`✅ Sent to ${exam.group_name} — ${d.sent} delivered, ${d.failed} failed`]);
      } else {
        setSendLog([`❌ Failed: ${d.error}`]);
      }
    } catch(e) { setSendLog([`❌ Error: ${e.message}`]); }
    finally { setSending(false); }
  };

  // ── Print / PDF ───────────────────────────────────────────────────────
  const handlePrint = () => {
    const filtered = filteredExams;
    const w = window.open('', '_blank');
    const rows = filtered.map(e => `
      <tr>
        <td>${fmt(e.exam_date)}</td>
        <td>${e.start_time} – ${endTime(e.start_time, e.duration)}</td>
        <td>${e.duration} min</td>
        <td>${e.group_name}</td>
        <td>${e.subject}</td>
        <td>${e.teacher || '—'}</td>
        <td>${e.room}</td>
        <td>${e.notes || '—'}</td>
      </tr>`).join('');

    w.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>Exam Schedule — Alatoo International University</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Times New Roman', serif; font-size: 10pt; color: #000; margin: 0; }
        .header { text-align: center; margin-bottom: 14px; border-bottom: 2px solid #000; padding-bottom: 8px; }
        .header-top { font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; color: #444; }
        .header-title { font-size: 15pt; font-weight: bold; margin: 4px 0; }
        .header-sub { font-size: 9pt; color: #444; }
        .header-meta { display: flex; justify-content: space-between; font-size: 8pt; color: #666; margin-top: 6px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: #1e293b; color: #fff; padding: 6px 8px; font-size: 8pt;
             text-align: left; text-transform: uppercase; letter-spacing: .5px; }
        td { padding: 5px 8px; font-size: 9pt; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        tr:nth-child(even) td { background: #f8fafc; }
        .footer { margin-top: 16px; display: flex; justify-content: space-between;
                  font-size: 7.5pt; color: #666; border-top: 1px solid #ccc; padding-top: 6px; }
        @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
      </style></head><body>
      <div class="header">
        <div class="header-top">Alatoo International University · Bishkek, Kyrgyzstan</div>
        <div class="header-title">EXAMINATION SCHEDULE</div>
        <div class="header-sub">Faculty of Information Technologies</div>
        <div class="header-meta">
          <span>Academic Year ${new Date().getFullYear()}–${new Date().getFullYear()+1}</span>
          <span>Generated: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</span>
        </div>
      </div>
      <table>
        <thead><tr>
          <th>Date</th><th>Time</th><th>Duration</th><th>Group</th>
          <th>Subject</th><th>Examiner</th><th>Room</th><th>Notes</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">
        <span>Alatoo International University · Internal Document</span>
        <span>Page 1</span>
      </div>
      <script>window.onload=()=>{window.print();}</script>
    </body></html>`);
    w.document.close();
  };

  // ── Filter & group by month ───────────────────────────────────────────
  const months = useMemo(() => {
    const ms = new Set(exams.map(e => e.exam_date?.slice(0,7)));
    return [...ms].sort();
  }, [exams]);

  const filteredExams = useMemo(() => exams.filter(e => {
    if (filterGrp && e.group_name !== filterGrp) return false;
    if (filterMon && !e.exam_date?.startsWith(filterMon)) return false;
    return true;
  }), [exams, filterGrp, filterMon]);

  // Group by date for display
  const byDate = useMemo(() => {
    const map = {};
    filteredExams.forEach(e => {
      const d = e.exam_date?.slice(0,10);
      if (!map[d]) map[d] = [];
      map[d].push(e);
    });
    return map;
  }, [filteredExams]);

  // ── Conflict highlights ───────────────────────────────────────────────
  const conflictIds = useMemo(() => {
    const ids = new Set();
    const toMins = (t) => { const [h,m]=(t||'0:0').split(':').map(Number); return h*60+m; };
    const dateGroups = {};
    exams.forEach(e => {
      const k = `${e.exam_date}__${e.room}`;
      dateGroups[k] = dateGroups[k] || [];
      dateGroups[k].push(e);
    });
    Object.values(dateGroups).forEach(group => {
      for (let i = 0; i < group.length; i++) {
        for (let j = i+1; j < group.length; j++) {
          const a = group[i], b = group[j];
          const aS = toMins(a.start_time), aE = aS + a.duration;
          const bS = toMins(b.start_time), bE = bS + b.duration;
          if (aS < bE && aE > bS) { ids.add(a.id); ids.add(b.id); }
        }
      }
    });
    return ids;
  }, [exams]);

  const inp = 'es-input';
  const sel = 'es-select';

  return (
    <div className="es-wrap">
      {/* Header */}
      <div className="es-header">
        <div className="es-header-left">
          <div className="es-header-icon">📋</div>
          <div>
            <div className="es-title">Exam Schedule</div>
            <div className="es-sub">{exams.length} exams · {conflictIds.size > 0 ? `⚠️ ${conflictIds.size/2|0} conflicts` : '✅ No conflicts'}</div>
          </div>
        </div>
        <div className="es-header-actions">
          <button className="es-btn-print" onClick={handlePrint}>🖨 Print / PDF</button>
          <button className="es-btn-add" onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm()); setError(''); }}>
            + Add Exam
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="es-filters">
        <select className={sel} value={filterGrp} onChange={e => setFilterGrp(e.target.value)}>
          <option value="">All Groups</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className={sel} value={filterMon} onChange={e => setFilterMon(e.target.value)}>
          <option value="">All Months</option>
          {months.map(m => <option key={m} value={m}>{new Date(m+'-01').toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</option>)}
        </select>
        {(filterGrp || filterMon) && (
          <button className="es-btn-clear" onClick={() => { setFilterGrp(''); setFilterMon(''); }}>✕ Clear</button>
        )}
        <div className="es-count">{filteredExams.length} exam{filteredExams.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Send log */}
      {sendLog.length > 0 && (
        <div className="es-sendlog">
          {sendLog.map((l,i) => <div key={i}>{l}</div>)}
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="es-form-wrap">
          <div className="es-form-title">{editId ? '✏️ Edit Exam' : '+ New Exam'}</div>
          {error && <div className="es-error">⚠️ {error}</div>}
          <div className="es-form-grid">
            <div className="es-field">
              <label>Group *</label>
              <select className={sel} value={form.group_name} onChange={e => setForm(f=>({...f,group_name:e.target.value}))}>
                <option value="">Select group</option>
                {groups.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="es-field">
              <label>Subject *</label>
              <input className={inp} placeholder="e.g. Mathematics" value={form.subject}
                onChange={e => setForm(f=>({...f,subject:e.target.value}))} />
            </div>
            <div className="es-field">
              <label>Examiner</label>
              <input className={inp} list="es-teachers-list" placeholder="Teacher name" value={form.teacher}
                onChange={e => setForm(f=>({...f,teacher:e.target.value}))} />
              <datalist id="es-teachers-list">
                {allTeachers.map(tc => <option key={tc} value={tc} />)}
              </datalist>
            </div>
            <div className="es-field">
              <label>Room *</label>
              <input className={inp} list="es-rooms-list" placeholder="e.g. B201" value={form.room}
                onChange={e => setForm(f=>({...f,room:e.target.value}))} />
              <datalist id="es-rooms-list">
                {allRooms.map(r => <option key={r} value={r} />)}
              </datalist>
            </div>
            <div className="es-field">
              <label>Date *</label>
              <input className={inp} type="date" value={form.exam_date}
                onChange={e => setForm(f=>({...f,exam_date:e.target.value}))} />
            </div>
            <div className="es-field">
              <label>Start Time *</label>
              <select className={sel} value={form.start_time}
                onChange={e => setForm(f=>({...f,start_time:e.target.value}))}>
                {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="es-field">
              <label>Duration</label>
              <select className={sel} value={form.duration}
                onChange={e => setForm(f=>({...f,duration:+e.target.value}))}>
                {DURATIONS.map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
            <div className="es-field es-field-full">
              <label>Notes</label>
              <input className={inp} placeholder="Optional instructions..." value={form.notes}
                onChange={e => setForm(f=>({...f,notes:e.target.value}))} />
            </div>
          </div>
          {form.start_time && form.duration && (
            <div className="es-time-preview">
              ⏰ {form.start_time} – {endTime(form.start_time, form.duration)} ({form.duration} min)
            </div>
          )}
          <div className="es-form-actions">
            <button className="es-btn-cancel" onClick={() => { setShowForm(false); setEditId(null); setError(''); }}>Cancel</button>
            <button className="es-btn-save" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Exam'}
            </button>
          </div>
        </div>
      )}

      {/* Exam list grouped by date */}
      {loading ? (
        <div className="es-loading">Loading exams...</div>
      ) : Object.keys(byDate).length === 0 ? (
        <div className="es-empty">
          <div style={{fontSize:'2.5rem',marginBottom:8}}>📋</div>
          <div>No exams scheduled yet.</div>
          <div style={{fontSize:'0.8rem',color:'#94a3b8',marginTop:4}}>Click "Add Exam" to create the first exam entry.</div>
        </div>
      ) : (
        <div className="es-list">
          {Object.entries(byDate).sort(([a],[b]) => a.localeCompare(b)).map(([date, dayExams]) => (
            <div key={date} className="es-day-group">
              <div className="es-day-header">
                <div className="es-day-date">{fmt(date)}</div>
                <div className="es-day-dow">
                  {new Date(date).toLocaleDateString('en-GB',{weekday:'long'})}
                </div>
                <div className="es-day-count">{dayExams.length} exam{dayExams.length>1?'s':''}</div>
              </div>
              <div className="es-cards">
                {dayExams.sort((a,b) => a.start_time.localeCompare(b.start_time)).map(exam => (
                  <div key={exam.id} className={`es-card ${conflictIds.has(exam.id) ? 'conflict' : ''}`}>
                    <div className="es-card-time">
                      <div className="es-time-start">{exam.start_time}</div>
                      <div className="es-time-line" />
                      <div className="es-time-end">{endTime(exam.start_time, exam.duration)}</div>
                      <div className="es-time-dur">{exam.duration}m</div>
                    </div>
                    <div className="es-card-body">
                      <div className="es-card-top">
                        <div className="es-card-subject">{exam.subject}</div>
                        {conflictIds.has(exam.id) && <div className="es-conflict-badge">⚠️ Room Conflict</div>}
                      </div>
                      <div className="es-card-meta">
                        <span className="es-meta-item">👥 {exam.group_name}</span>
                        <span className="es-meta-item">🚪 {exam.room}</span>
                        {exam.teacher && <span className="es-meta-item">👨‍🏫 {exam.teacher}</span>}
                      </div>
                      {exam.notes && <div className="es-card-notes">📝 {exam.notes}</div>}
                    </div>
                    <div className="es-card-actions">
                      <button className="es-action-btn tg"
                        onClick={() => handleBroadcast(exam)}
                        disabled={sending}
                        title="Send to group Telegram">
                        {sending ? '...' : '📨'}
                      </button>
                      <button className="es-action-btn edit" onClick={() => handleEdit(exam)} title="Edit">✏️</button>
                      <button className="es-action-btn del" onClick={() => handleDelete(exam.id)} title="Delete">🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}