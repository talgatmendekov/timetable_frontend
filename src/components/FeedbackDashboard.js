// src/components/FeedbackDashboard.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './FeedbackDashboard.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://timetablebackend-production.up.railway.app/api';
const getToken = () => localStorage.getItem('token') || localStorage.getItem('scheduleToken') || '';

const STATUS_LABELS = { new: 'New', read: 'Read', resolved: 'Resolved' };
const STATUS_COLORS = { new: '#ef4444', read: '#f59e0b', resolved: '#22c55e' };
const CAT_ICONS     = { room: '🏛', teacher: '👨‍🏫', group: '👥', general: '📝' };
const CATEGORIES    = [
  { value: 'room',    label: '🏛 Room',    hint: 'e.g. B201, A105' },
  { value: 'teacher', label: '👨‍🏫 Teacher', hint: 'e.g. Prof. Asanov' },
  { value: 'group',   label: '👥 Group',   hint: 'e.g. CS-22' },
  { value: 'general', label: '📝 General', hint: '' },
];

const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '';

// ─────────────────────────────────────────────────────────────────────────────
// GUEST: Submit Feedback Form
// ─────────────────────────────────────────────────────────────────────────────
function GuestFeedbackForm({ schedule, groups }) {
  const [step,      setStep]     = useState(0); // 0=category 1=subject 2=message 3=identity 4=done
  const [category,  setCategory] = useState('');
  const [subject,   setSubject]  = useState('');
  const [message,   setMessage]  = useState('');
  const [anonymous, setAnonymous]= useState(null); // null=not chosen yet
  const [name,      setName]     = useState('');
  const [submitting,setSubmitting]= useState(false);
  const [error,     setError]    = useState('');

  // Derive rooms from schedule for suggestions
  const allRooms    = useMemo(() => [...new Set(Object.values(schedule || {}).map(e => e.room).filter(Boolean))].sort(), [schedule]);
  const allTeachers = useMemo(() => [...new Set(Object.values(schedule || {}).map(e => e.teacher).filter(Boolean))].sort(), [schedule]);

  const reset = () => { setStep(0); setCategory(''); setSubject(''); setMessage(''); setAnonymous(null); setName(''); setError(''); };

  const handleSubmit = async () => {
    if (!message.trim() || message.trim().length < 5) return setError('Please write at least 5 characters.');
    if (anonymous === false && !name.trim()) return setError('Please enter your name.');
    setSubmitting(true);
    setError('');
    try {
      const r = await fetch(`${API_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          subject:     subject || 'General',
          message:     message.trim(),
          anonymous:   anonymous !== false,
          sender_name: anonymous === false ? name.trim() : null,
        }),
      });
      const d = await r.json();
      if (d.success) setStep(4);
      else setError(d.error || 'Failed to submit. Please try again.');
    } catch (e) {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step 4: Success ──────────────────────────────────────────────────────
  if (step === 4) {
    return (
      <div className="fb-guest-wrap">
        <div className="fb-guest-success">
          <div className="fb-success-icon">✅</div>
          <div className="fb-success-title">Feedback Submitted!</div>
          <div className="fb-success-msg">
            Thank you — your feedback has been sent to the administration.
            {anonymous !== false && <><br /><span className="fb-anon-note">🔒 Submitted anonymously</span></>}
          </div>
          <button className="fb-btn-primary" onClick={reset}>Submit Another</button>
        </div>
      </div>
    );
  }

  const selectedCat = CATEGORIES.find(c => c.value === category);

  return (
    <div className="fb-guest-wrap">
      {/* Header */}
      <div className="fb-guest-header">
        <div className="fb-guest-icon">💬</div>
        <div>
          <div className="fb-guest-title">Student Feedback</div>
          <div className="fb-guest-sub">Help improve your university — anonymous or named</div>
        </div>
      </div>

      {/* Progress steps */}
      <div className="fb-steps">
        {['Category','About','Message','Identity'].map((s, i) => (
          <div key={i} className={`fb-step ${step === i ? 'active' : step > i ? 'done' : ''}`}>
            <div className="fb-step-dot">{step > i ? '✓' : i + 1}</div>
            <div className="fb-step-label">{s}</div>
          </div>
        ))}
      </div>

      <div className="fb-guest-card">
        {error && <div className="fb-guest-error">⚠️ {error}</div>}

        {/* Step 0 — Category */}
        {step === 0 && (
          <div className="fb-step-content">
            <div className="fb-step-title">What is your feedback about?</div>
            <div className="fb-cat-grid">
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  className={`fb-cat-btn ${category === c.value ? 'selected' : ''}`}
                  onClick={() => setCategory(c.value)}
                >
                  <span className="fb-cat-emoji">{CAT_ICONS[c.value]}</span>
                  <span>{c.label.replace(/^.\s/, '')}</span>
                </button>
              ))}
            </div>
            <button
              className="fb-btn-primary"
              disabled={!category}
              onClick={() => {
                setError('');
                if (category === 'general') { setSubject('General'); setStep(2); }
                else setStep(1);
              }}
            >
              Next →
            </button>
          </div>
        )}

        {/* Step 1 — Subject */}
        {step === 1 && (
          <div className="fb-step-content">
            <div className="fb-step-title">
              {category === 'room'    && 'Which room?'}
              {category === 'teacher' && 'Which teacher?'}
              {category === 'group'   && 'Which group?'}
            </div>
            <div className="fb-step-hint">{selectedCat?.hint}</div>
            <input
              className="fb-input"
              list="fb-subject-list"
              placeholder={selectedCat?.hint || 'Enter name'}
              value={subject}
              onChange={e => setSubject(e.target.value)}
              autoFocus
            />
            <datalist id="fb-subject-list">
              {category === 'room'    && allRooms.map(r => <option key={r} value={r} />)}
              {category === 'teacher' && allTeachers.map(t => <option key={t} value={t} />)}
              {category === 'group'   && (groups || []).map(g => <option key={g} value={g} />)}
            </datalist>
            <div className="fb-step-actions">
              <button className="fb-btn-back" onClick={() => { setStep(0); setSubject(''); setError(''); }}>← Back</button>
              <button className="fb-btn-primary" disabled={!subject.trim()} onClick={() => { setError(''); setStep(2); }}>Next →</button>
            </div>
          </div>
        )}

        {/* Step 2 — Message */}
        {step === 2 && (
          <div className="fb-step-content">
            <div className="fb-step-title">Describe the issue or feedback</div>
            <div className="fb-step-hint">
              {category !== 'general' ? `About: ${CAT_ICONS[category]} ${subject}` : ''}
            </div>
            <div className="fb-example-prompts">
              {category === 'room'    && ['Room too cold/hot', 'Projector not working', 'Room was locked', 'Needs cleaning'].map(p => (
                <button key={p} className="fb-prompt-chip" onClick={() => setMessage(p)}>{p}</button>
              ))}
              {category === 'teacher' && ['Class was cancelled', 'Starts late', 'Schedule not updated', 'Room changed'].map(p => (
                <button key={p} className="fb-prompt-chip" onClick={() => setMessage(p)}>{p}</button>
              ))}
              {category === 'group'   && ['Wrong room assigned', 'Schedule conflict', 'Class not on timetable', 'Duplicate entry'].map(p => (
                <button key={p} className="fb-prompt-chip" onClick={() => setMessage(p)}>{p}</button>
              ))}
              {category === 'general' && ['Timetable has errors', 'App not working', 'Missing group', 'Suggestion'].map(p => (
                <button key={p} className="fb-prompt-chip" onClick={() => setMessage(p)}>{p}</button>
              ))}
            </div>
            <textarea
              className="fb-textarea"
              placeholder="Write your feedback here..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              autoFocus
            />
            <div className="fb-char-count">{message.length} characters</div>
            <div className="fb-step-actions">
              <button className="fb-btn-back" onClick={() => { setStep(category === 'general' ? 0 : 1); setError(''); }}>← Back</button>
              <button className="fb-btn-primary" disabled={message.trim().length < 5} onClick={() => { setError(''); setStep(3); }}>Next →</button>
            </div>
          </div>
        )}

        {/* Step 3 — Identity */}
        {step === 3 && (
          <div className="fb-step-content">
            <div className="fb-step-title">Submit anonymously or with your name?</div>
            <div className="fb-identity-choices">
              <button
                className={`fb-identity-btn ${anonymous === true ? 'selected' : ''}`}
                onClick={() => setAnonymous(true)}
              >
                <span className="fb-identity-icon">🔒</span>
                <div>
                  <div className="fb-identity-label">Anonymous</div>
                  <div className="fb-identity-desc">Admin sees feedback but not who sent it</div>
                </div>
              </button>
              <button
                className={`fb-identity-btn ${anonymous === false ? 'selected' : ''}`}
                onClick={() => setAnonymous(false)}
              >
                <span className="fb-identity-icon">👤</span>
                <div>
                  <div className="fb-identity-label">With my name</div>
                  <div className="fb-identity-desc">Admin can follow up with you</div>
                </div>
              </button>
            </div>
            {anonymous === false && (
              <input
                className="fb-input"
                placeholder="Your name (e.g. Aizat Mamytova)"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            )}
            {/* Summary */}
            {anonymous !== null && (
              <div className="fb-summary">
                <div className="fb-summary-title">Summary</div>
                <div className="fb-summary-row"><span>Category</span><span>{CAT_ICONS[category]} {category}</span></div>
                <div className="fb-summary-row"><span>About</span><span>{subject}</span></div>
                <div className="fb-summary-row"><span>Message</span><span>"{message.slice(0,60)}{message.length > 60 ? '…' : ''}"</span></div>
                <div className="fb-summary-row"><span>Identity</span><span>{anonymous ? '🔒 Anonymous' : `👤 ${name || '…'}`}</span></div>
              </div>
            )}
            <div className="fb-step-actions">
              <button className="fb-btn-back" onClick={() => { setStep(2); setError(''); }}>← Back</button>
              <button
                className="fb-btn-submit"
                disabled={anonymous === null || (anonymous === false && !name.trim()) || submitting}
                onClick={handleSubmit}
              >
                {submitting ? 'Submitting...' : '✓ Submit Feedback'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Feedback Dashboard
// ─────────────────────────────────────────────────────────────────────────────
function AdminFeedbackDashboard() {
  const [items,      setItems]      = useState([]);
  const [stats,      setStats]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [filterCat,  setFilterCat]  = useState('');
  const [filterStat, setFilterStat] = useState('');
  const [filterSub,  setFilterSub]  = useState('');
  const [search,     setSearch]     = useState('');
  const [expanded,   setExpanded]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [feedRes, statRes] = await Promise.all([
        fetch(`${API_URL}/feedback`,       { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_URL}/feedback/stats`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      const feedData = await feedRes.json();
      const statData = await statRes.json();
      if (feedData.success) setItems(feedData.data);
      if (statData.success) setStats(statData);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id, status) => {
    try {
      await fetch(`${API_URL}/feedback/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ status }),
      });
      setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this feedback?')) return;
    await fetch(`${API_URL}/feedback/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` },
    });
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleExpand = (id) => {
    setExpanded(expanded === id ? null : id);
    const item = items.find(i => i.id === id);
    if (item?.status === 'new') updateStatus(id, 'read');
  };

  const allSubjects = useMemo(() => [...new Set(items.map(i => i.subject))].sort(), [items]);
  const filtered    = useMemo(() => items.filter(i => {
    if (filterCat  && i.category !== filterCat)  return false;
    if (filterStat && i.status   !== filterStat) return false;
    if (filterSub  && i.subject  !== filterSub)  return false;
    if (search && !i.message.toLowerCase().includes(search.toLowerCase()) &&
        !i.subject.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [items, filterCat, filterStat, filterSub, search]);

  const newCount = items.filter(i => i.status === 'new').length;

  return (
    <div className="fb-wrap">
      {/* Header */}
      <div className="fb-header">
        <div className="fb-header-left">
          <div className="fb-header-icon">💬</div>
          <div>
            <div className="fb-title">Student Feedback</div>
            <div className="fb-sub">
              {stats?.total || 0} total · {newCount > 0 ? `🔴 ${newCount} unread` : '✅ All read'}
            </div>
          </div>
        </div>
        <button className="fb-refresh" onClick={load}>↻ Refresh</button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="fb-stats">
          <div className="fb-stat-card"><div className="fb-stat-val">{stats.total}</div><div className="fb-stat-lbl">Total</div></div>
          <div className="fb-stat-card red"><div className="fb-stat-val">{stats.unread}</div><div className="fb-stat-lbl">Unread</div></div>
          {stats.byCategory?.map(c => (
            <div key={c.category} className="fb-stat-card">
              <div className="fb-stat-val">{CAT_ICONS[c.category]} {c.count}</div>
              <div className="fb-stat-lbl">{c.category}</div>
            </div>
          ))}
        </div>
      )}

      {/* Top reported */}
      {stats?.bySubject?.length > 0 && (
        <div className="fb-top-subjects">
          <div className="fb-section-title">🔥 Most Reported</div>
          <div className="fb-subject-pills">
            {stats.bySubject.slice(0, 8).map((s, i) => (
              <button
                key={i}
                className={`fb-subject-pill ${filterSub === s.subject ? 'active' : ''}`}
                onClick={() => setFilterSub(filterSub === s.subject ? '' : s.subject)}
              >
                {CAT_ICONS[s.category]} {s.subject}
                <span className="fb-pill-count">{s.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="fb-filters">
        <input className="fb-search" placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="fb-select" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">All Categories</option>
          <option value="room">🏛 Room</option>
          <option value="teacher">👨‍🏫 Teacher</option>
          <option value="group">👥 Group</option>
          <option value="general">📝 General</option>
        </select>
        <select className="fb-select" value={filterStat} onChange={e => setFilterStat(e.target.value)}>
          <option value="">All Status</option>
          <option value="new">🔴 New</option>
          <option value="read">🟡 Read</option>
          <option value="resolved">🟢 Resolved</option>
        </select>
        <select className="fb-select" value={filterSub} onChange={e => setFilterSub(e.target.value)}>
          <option value="">All Subjects</option>
          {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(filterCat || filterStat || filterSub || search) && (
          <button className="fb-clear" onClick={() => { setFilterCat(''); setFilterStat(''); setFilterSub(''); setSearch(''); }}>✕ Clear</button>
        )}
        <div className="fb-count">{filtered.length} item{filtered.length !== 1 ? 's' : ''}</div>
      </div>

      {/* List */}
      {loading ? (
        <div className="fb-loading">Loading feedback...</div>
      ) : filtered.length === 0 ? (
        <div className="fb-empty">
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>💬</div>
          <div>{items.length === 0 ? 'No feedback received yet.' : 'No feedback matches your filters.'}</div>
          {items.length === 0 && (
            <div className="fb-empty-hint">Students submit feedback via the <strong>💬 Feedback</strong> tab in guest mode.</div>
          )}
        </div>
      ) : (
        <div className="fb-list">
          {filtered.map(item => (
            <div key={item.id} className={`fb-item ${item.status} ${expanded === item.id ? 'expanded' : ''}`}>
              <div className="fb-item-header" onClick={() => handleExpand(item.id)}>
                <div className="fb-item-left">
                  <span className="fb-cat-icon">{CAT_ICONS[item.category]}</span>
                  <div className="fb-item-info">
                    <div className="fb-item-subject">{item.subject}</div>
                    <div className="fb-item-preview">
                      {item.message.length > 80 && expanded !== item.id ? item.message.slice(0, 80) + '…' : item.message}
                    </div>
                  </div>
                </div>
                <div className="fb-item-right">
                  <span className="fb-status-dot" style={{ background: STATUS_COLORS[item.status] }} title={STATUS_LABELS[item.status]} />
                  <span className="fb-item-date">{fmt(item.created_at)}</span>
                  <span className="fb-chevron">{expanded === item.id ? '▲' : '▼'}</span>
                </div>
              </div>
              {expanded === item.id && (
                <div className="fb-item-detail">
                  <div className="fb-detail-message">"{item.message}"</div>
                  <div className="fb-detail-meta">
                    <div className="fb-meta-row"><span className="fb-meta-key">Category</span><span className="fb-meta-val">{CAT_ICONS[item.category]} {item.category}</span></div>
                    <div className="fb-meta-row"><span className="fb-meta-key">Sender</span><span className="fb-meta-val">{item.anonymous ? '🔒 Anonymous' : `👤 ${item.sender_name || 'Unknown'}`}</span></div>
                    <div className="fb-meta-row"><span className="fb-meta-key">Submitted</span><span className="fb-meta-val">{fmt(item.created_at)}</span></div>
                    <div className="fb-meta-row"><span className="fb-meta-key">Status</span><span className="fb-meta-val" style={{ color: STATUS_COLORS[item.status] }}>● {STATUS_LABELS[item.status]}</span></div>
                  </div>
                  <div className="fb-detail-actions">
                    {item.status !== 'new'      && <button className="fb-action new"      onClick={() => updateStatus(item.id, 'new')}>Mark New</button>}
                    {item.status !== 'read'     && <button className="fb-action read"     onClick={() => updateStatus(item.id, 'read')}>Mark Read</button>}
                    {item.status !== 'resolved' && <button className="fb-action resolved" onClick={() => updateStatus(item.id, 'resolved')}>✓ Resolve</button>}
                    <button className="fb-action delete" onClick={() => handleDelete(item.id)}>🗑 Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root export — switches between guest form and admin dashboard
// ─────────────────────────────────────────────────────────────────────────────
export default function FeedbackDashboard({ guestMode = false, schedule = {}, groups = [] }) {
  if (guestMode) return <GuestFeedbackForm schedule={schedule} groups={groups} />;
  return <AdminFeedbackDashboard />;
}