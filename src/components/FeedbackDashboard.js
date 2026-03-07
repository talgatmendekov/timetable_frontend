// src/components/FeedbackDashboard.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import './FeedbackDashboard.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://timetablebackend-production.up.railway.app/api';
const getToken = () => localStorage.getItem('token') || localStorage.getItem('scheduleToken') || '';

// Static — no t() needed here
const STATUS_COLORS = { new: '#ef4444', read: '#f59e0b', resolved: '#22c55e' };
const CAT_ICONS     = { room: '🏛', teacher: '👨‍🏫', group: '👥', general: '📝' };

const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '';

// ─────────────────────────────────────────────────────────────────────────────
// GUEST: Submit Feedback Form
// ─────────────────────────────────────────────────────────────────────────────
function GuestFeedbackForm({ schedule, groups }) {
  const { t } = useLanguage();

  // Built inside component so t() is available
  const CATEGORIES = [
    { value: 'room',    label: t('feedbackCatRoom')    || 'Room',    hint: 'e.g. B201, A105' },
    { value: 'teacher', label: t('feedbackCatTeacher') || 'Teacher', hint: 'e.g. Prof. Asanov' },
    { value: 'group',   label: t('feedbackCatGroup')   || 'Group',   hint: 'e.g. CS-22' },
    { value: 'general', label: t('feedbackCatGeneral') || 'General', hint: '' },
  ];

  const [step,       setStep]      = useState(0);
  const [category,   setCategory]  = useState('');
  const [subject,    setSubject]   = useState('');
  const [message,    setMessage]   = useState('');
  const [name,       setName]      = useState('');
  const [email,      setEmail]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]     = useState('');

  const allRooms    = useMemo(() => [...new Set(Object.values(schedule || {}).map(e => e.room).filter(Boolean))].sort(), [schedule]);
  const allTeachers = useMemo(() => [...new Set(Object.values(schedule || {}).map(e => e.teacher).filter(Boolean))].sort(), [schedule]);

  const reset = () => { setStep(0); setCategory(''); setSubject(''); setMessage(''); setName(''); setEmail(''); setError(''); };

  const handleSubmit = async () => {
    if (!message.trim() || message.trim().length < 5) return setError(t('feedbackErrMessage') || 'Please write at least 5 characters.');
    if (!name.trim()) return setError(t('feedbackErrName') || 'Please enter your name.');
    if (!email.trim() || !email.trim().toLowerCase().endsWith('@alatoo.edu.kg')) return setError(t('feedbackErrEmail') || 'Email must end with @alatoo.edu.kg');
    setSubmitting(true);
    setError('');
    try {
      const r = await fetch(`${API_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          subject:      subject || 'General',
          message:      message.trim(),
          anonymous:    false,
          sender_name:  name.trim(),
          sender_email: email.trim(),
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

  // Step 4: Success
  if (step === 4) {
    return (
      <div className="fb-guest-wrap">
        <div className="fb-guest-success">
          <div className="fb-success-icon">✅</div>
          <div className="fb-success-title">{t('feedbackSuccessTitle') || 'Feedback Submitted!'}</div>
          <div className="fb-success-msg">{t('feedbackSuccessMsg') || 'Thank you — your feedback has been sent to the administration.'}</div>
          <button className="fb-btn-primary" onClick={reset}>{t('feedbackSubmitAnother') || 'Submit Another'}</button>
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
          <div className="fb-guest-title">{t('feedbackTitle') || 'Student Feedback'}</div>
          <div className="fb-guest-sub">{t('feedbackSubtitle') || 'Help improve your university — name and email required'}</div>
        </div>
      </div>

      {/* Progress steps */}
      <div className="fb-steps">
        {[
          t('feedbackStepCategory') || 'Category',
          t('feedbackStepAbout')    || 'About',
          t('feedbackStepMessage')  || 'Message & Name',
        ].map((s, i) => (
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
            <div className="fb-step-title">{t('feedbackCategoryTitle') || 'What is your feedback about?'}</div>
            <div className="fb-cat-grid">
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  className={`fb-cat-btn ${category === c.value ? 'selected' : ''}`}
                  onClick={() => setCategory(c.value)}
                >
                  <span className="fb-cat-emoji">{CAT_ICONS[c.value]}</span>
                  <span>{c.label}</span>
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
              {t('next') || 'Next'} →
            </button>
          </div>
        )}

        {/* Step 1 — Subject */}
        {step === 1 && (
          <div className="fb-step-content">
            <div className="fb-step-title">
              {category === 'room'    && (t('feedbackWhichRoom')    || 'Which room?')}
              {category === 'teacher' && (t('feedbackWhichTeacher') || 'Which teacher?')}
              {category === 'group'   && (t('feedbackWhichGroup')   || 'Which group?')}
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
              {category === 'teacher' && allTeachers.map(tc => <option key={tc} value={tc} />)}
              {category === 'group'   && (groups || []).map(g => <option key={g} value={g} />)}
            </datalist>
            <div className="fb-step-actions">
              <button className="fb-btn-back" onClick={() => { setStep(0); setSubject(''); setError(''); }}>← {t('back') || 'Back'}</button>
              <button className="fb-btn-primary" disabled={!subject.trim()} onClick={() => { setError(''); setStep(2); }}>{t('next') || 'Next'} →</button>
            </div>
          </div>
        )}

        {/* Step 2 — Message + Name + Email */}
        {step === 2 && (
          <div className="fb-step-content">
            <div className="fb-step-title">{t('feedbackMessageTitle') || 'Describe the issue or feedback'}</div>
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
              placeholder={t('feedbackMessagePlaceholder') || 'Write your feedback here...'}
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              autoFocus
            />
            <div className="fb-char-count">{message.length} characters</div>
            <div className="fb-identity-row">
              <input
                className="fb-input"
                placeholder={t('feedbackNamePlaceholder') || 'Your full name (e.g. Aizat Mamytova)'}
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <input
                className="fb-input"
                type="email"
                placeholder={t('feedbackEmailPlaceholder') || 'Your university email (e.g. aizat@alatoo.edu.kg)'}
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="fb-step-actions">
              <button className="fb-btn-back" onClick={() => { setStep(category === 'general' ? 0 : 1); setError(''); }}>← {t('back') || 'Back'}</button>
              <button
                className="fb-btn-submit"
                disabled={message.trim().length < 5 || !name.trim() || !email.trim() || submitting}
                onClick={handleSubmit}
              >
                {submitting ? (t('feedbackSubmitting') || 'Submitting...') : (t('feedbackSubmit') || '✓ Submit Feedback')}
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
  const { t } = useLanguage();

  // Status labels built inside component so t() is available
  const STATUS_LABELS = {
    new:      'New',
    read:     'Read',
    resolved: t('feedbackResolve') || 'Resolved',
  };

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
    if (!window.confirm(t('confirmDeleteBooking') || 'Delete this feedback?')) return;
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
            <div className="fb-title">{t('feedbackTitle') || 'Student Feedback'}</div>
            <div className="fb-sub">
              {stats?.total || 0} {t('feedbackTotal') || 'total'} ·{' '}
              {newCount > 0 ? `🔴 ${newCount} ${t('feedbackUnread') || 'unread'}` : `✅ ${t('feedbackAllRead') || 'All read'}`}
            </div>
          </div>
        </div>
        <button className="fb-refresh" onClick={load}>↻ {t('refresh') || 'Refresh'}</button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="fb-stats">
          <div className="fb-stat-card">
            <div className="fb-stat-val">{stats.total}</div>
            <div className="fb-stat-lbl">{t('feedbackTotal') || 'Total'}</div>
          </div>
          <div className="fb-stat-card red">
            <div className="fb-stat-val">{stats.unread}</div>
            <div className="fb-stat-lbl">{t('feedbackUnread') || 'Unread'}</div>
          </div>
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
          <div className="fb-section-title">🔥 {t('feedbackMostReported') || 'Most Reported'}</div>
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
        <input
          className="fb-search"
          placeholder={`🔍 ${t('feedbackSearchSubject') || 'Search...'}`}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="fb-select" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">{t('feedbackAllCategories') || 'All Categories'}</option>
          <option value="room">🏛 {t('feedbackCatRoom') || 'Room'}</option>
          <option value="teacher">👨‍🏫 {t('feedbackCatTeacher') || 'Teacher'}</option>
          <option value="group">👥 {t('feedbackCatGroup') || 'Group'}</option>
          <option value="general">📝 {t('feedbackCatGeneral') || 'General'}</option>
        </select>
        <select className="fb-select" value={filterStat} onChange={e => setFilterStat(e.target.value)}>
          <option value="">{t('feedbackAllStatus') || 'All Status'}</option>
          <option value="new">🔴 New</option>
          <option value="read">🟡 Read</option>
          <option value="resolved">🟢 Resolved</option>
        </select>
        <select className="fb-select" value={filterSub} onChange={e => setFilterSub(e.target.value)}>
          <option value="">{t('feedbackAllSubjects') || 'All Subjects'}</option>
          {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(filterCat || filterStat || filterSub || search) && (
          <button className="fb-clear" onClick={() => { setFilterCat(''); setFilterStat(''); setFilterSub(''); setSearch(''); }}>
            ✕ {t('clearAll') || 'Clear'}
          </button>
        )}
        <div className="fb-count">{filtered.length} item{filtered.length !== 1 ? 's' : ''}</div>
      </div>

      {/* List */}
      {loading ? (
        <div className="fb-loading">{t('loadingData') || 'Loading...'}</div>
      ) : filtered.length === 0 ? (
        <div className="fb-empty">
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>💬</div>
          <div>{items.length === 0 ? (t('feedbackNoData') || 'No feedback received yet.') : 'No feedback matches your filters.'}</div>
          {items.length === 0 && (
            <div className="fb-empty-hint">{t('feedbackEmptyHint') || 'Students submit feedback via the Feedback tab in guest mode.'}</div>
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
                    <div className="fb-meta-row">
                      <span className="fb-meta-key">{t('feedbackCategory') || 'Category'}</span>
                      <span className="fb-meta-val">{CAT_ICONS[item.category]} {item.category}</span>
                    </div>
                    <div className="fb-meta-row">
                      <span className="fb-meta-key">{t('feedbackSender') || 'Sender'}</span>
                      <span className="fb-meta-val">
                        {item.anonymous ? `🔒 ${t('feedbackAnonymous') || 'Anonymous'}` : `👤 ${item.sender_name || 'Unknown'}`}
                      </span>
                    </div>
                    {item.sender_email && (
                      <div className="fb-meta-row">
                        <span className="fb-meta-key">{t('feedbackEmail') || 'Email'}</span>
                        <span className="fb-meta-val">
                          <a href={`mailto:${item.sender_email}`} style={{ color: '#6366f1' }}>{item.sender_email}</a>
                        </span>
                      </div>
                    )}
                    <div className="fb-meta-row">
                      <span className="fb-meta-key">{t('feedbackSubmittedAt') || 'Submitted'}</span>
                      <span className="fb-meta-val">{fmt(item.created_at)}</span>
                    </div>
                    <div className="fb-meta-row">
                      <span className="fb-meta-key">{t('status') || 'Status'}</span>
                      <span className="fb-meta-val" style={{ color: STATUS_COLORS[item.status] }}>
                        ● {STATUS_LABELS[item.status]}
                      </span>
                    </div>
                  </div>
                  <div className="fb-detail-actions">
                    {item.status !== 'new'      && <button className="fb-action new"      onClick={() => updateStatus(item.id, 'new')}>{t('feedbackMarkNew') || 'Mark New'}</button>}
                    {item.status !== 'read'     && <button className="fb-action read"     onClick={() => updateStatus(item.id, 'read')}>{t('feedbackMarkRead') || 'Mark Read'}</button>}
                    {item.status !== 'resolved' && <button className="fb-action resolved" onClick={() => updateStatus(item.id, 'resolved')}>✓ {t('feedbackResolve') || 'Resolve'}</button>}
                    <button className="fb-action delete" onClick={() => handleDelete(item.id)}>🗑 {t('delete') || 'Delete'}</button>
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
// Root export
// ─────────────────────────────────────────────────────────────────────────────
export default function FeedbackDashboard({ guestMode = false, schedule = {}, groups = [] }) {
  if (guestMode) return <GuestFeedbackForm schedule={schedule} groups={groups} />;
  return <AdminFeedbackDashboard />;
}