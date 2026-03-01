// Frontend: src/components/BroadcastMessage.js
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import './BroadcastMessage.css';

const BroadcastMessage = () => {
  const { t } = useLanguage();
  const [teachers, setTeachers] = useState([]);
  const [groups, setGroups]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const [result, setResult]     = useState(null);

  const [recipientType, setRecipientType]     = useState('all');
  const [selectedTeachers, setSelectedTeachers] = useState(new Set());
  const [selectedGroups, setSelectedGroups]     = useState(new Set());

  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
  const token = () =>
    localStorage.getItem('token') ||
    localStorage.getItem('scheduleToken') ||
    localStorage.getItem('authToken') ||
    localStorage.getItem('jwt') ||
    sessionStorage.getItem('token') ||
    sessionStorage.getItem('scheduleToken') || '';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [tRes, gRes] = await Promise.all([
          fetch(`${API_URL}/teachers`,       { headers: { Authorization: `Bearer ${token()}` } }),
          fetch(`${API_URL}/group-channels`, { headers: { Authorization: `Bearer ${token()}` } }),
        ]);
        const [tData, gData] = await Promise.all([tRes.json(), gRes.json()]);
        if (tData.success) setTeachers(tData.data.filter(t => t.telegram_id));
        if (gData.success) setGroups(gData.data.filter(g => g.chat_id));
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, []);

  const toggleTeacher = (id) => setSelectedTeachers(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
  });
  const toggleGroup = (name) => setSelectedGroups(prev => {
    const s = new Set(prev); s.has(name) ? s.delete(name) : s.add(name); return s;
  });

  const recipientSummary = () => {
    if (recipientType === 'all')
      return `${t('broadcastEveryone') || 'Everyone'} (${teachers.length} ${t('broadcastTeachers') || 'teachers'} + ${groups.length} ${t('broadcastGroups') || 'groups'})`;
    if (recipientType === 'teachers')
      return `${t('broadcastAllTeachers') || 'All Teachers'} (${teachers.length})`;
    if (recipientType === 'groups')
      return `${t('broadcastAllGroups') || 'All Groups'} (${groups.length})`;
    const parts = [];
    if (selectedTeachers.size) parts.push(`${selectedTeachers.size} ${t('broadcastPickTeachers') || 'teacher(s)'}`);
    if (selectedGroups.size)   parts.push(`${selectedGroups.size} ${t('broadcastPickGroups') || 'group(s)'}`);
    return parts.length ? parts.join(' + ') : (t('broadcastNoRecipientsConfigured') || 'Nobody selected yet');
  };

  const handleSend = async () => {
    if (!message.trim()) { alert(t('broadcastMessagePlaceholder') || 'Please enter a message.'); return; }

    let teacherIds = [], groupNames = [];
    if (recipientType === 'all')      { teacherIds = teachers.map(t => t.id); groupNames = groups.map(g => g.group_name); }
    else if (recipientType === 'teachers') { teacherIds = teachers.map(t => t.id); }
    else if (recipientType === 'groups')   { groupNames = groups.map(g => g.group_name); }
    else { teacherIds = [...selectedTeachers]; groupNames = [...selectedGroups]; }

    if (!teacherIds.length && !groupNames.length) {
      alert(t('broadcastNoRecipientsConfigured') || 'No recipients selected.');
      return;
    }

    setSending(true);
    setResult(null);
    try {
      const res  = await fetch(`${API_URL}/broadcast`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim(), teacherIds, groupNames }),
      });
      const data = await res.json();
      if (data.success) { setResult(data); setMessage(''); setSubject(''); }
      else alert(`Failed: ${data.error}`);
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="bc-loading">{t('loading') || 'Loading...'}</div>;

  const totalReachable = teachers.length + groups.length;

  const TYPES = [
    { value: 'all',      icon: '🌐', label: t('broadcastEveryone')    || 'Everyone',      sub: `${teachers.length} + ${groups.length}` },
    { value: 'teachers', icon: '👨‍🏫', label: t('broadcastAllTeachers') || 'All Teachers',  sub: `${teachers.length}` },
    { value: 'groups',   icon: '👥', label: t('broadcastAllGroups')    || 'All Groups',    sub: `${groups.length}` },
    { value: 'pick',     icon: '🎯', label: t('broadcastPickManually') || 'Pick manually', sub: '...' },
  ];

  return (
    <div className="broadcast-wrap">
      <div className="bc-header">
        <h2>📢 {t('broadcastTitle') || 'Broadcast Message'}</h2>
        <p className="bc-subtitle">
          {t('broadcastSubtitle') || 'Send a Telegram message to teachers and/or group channels.'}
          <br />
          <span className="bc-reach">
            {t('broadcastReach') || 'Currently reachable:'}{' '}
            <strong>{teachers.length} {t('broadcastTeachers') || 'teachers'}</strong> + <strong>{groups.length} {t('broadcastGroups') || 'group channels'}</strong>.
          </span>
          {totalReachable === 0 && (
            <span className="bc-warn"> ⚠️ {t('broadcastNoRecipients') || 'No recipients configured yet.'}</span>
          )}
        </p>
      </div>

      {/* Step 1 — Recipients */}
      <div className="bc-card">
        <h3 className="bc-step">① {t('broadcastRecipients') || 'Recipients'}</h3>

        <div className="bc-type-grid">
          {TYPES.map(opt => (
            <button
              key={opt.value}
              className={`bc-type-btn ${recipientType === opt.value ? 'selected' : ''}`}
              onClick={() => setRecipientType(opt.value)}
            >
              <span className="bc-type-icon">{opt.icon}</span>
              <span className="bc-type-label">{opt.label}</span>
              <span className="bc-type-sub">{opt.sub}</span>
            </button>
          ))}
        </div>

        {recipientType === 'pick' && (
          <div className="bc-picker">
            {teachers.length > 0 && (
              <div className="bc-pick-section">
                <div className="bc-pick-header">
                  <span>👨‍🏫 {t('broadcastPickTeachers') || 'Teachers'}</span>
                  <div className="bc-pick-actions">
                    <button onClick={() => setSelectedTeachers(new Set(teachers.map(t => t.id)))} className="bc-link">
                      {t('broadcastSelectAll') || 'Select all'}
                    </button>
                    <button onClick={() => setSelectedTeachers(new Set())} className="bc-link">
                      {t('broadcastClear') || 'Clear'}
                    </button>
                  </div>
                </div>
                <div className="bc-chips">
                  {teachers.map(t => (
                    <button
                      key={t.id}
                      className={`bc-chip ${selectedTeachers.has(t.id) ? 'selected' : ''}`}
                      onClick={() => toggleTeacher(t.id)}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {groups.length > 0 && (
              <div className="bc-pick-section">
                <div className="bc-pick-header">
                  <span>👥 {t('broadcastPickGroups') || 'Group Channels'}</span>
                  <div className="bc-pick-actions">
                    <button onClick={() => setSelectedGroups(new Set(groups.map(g => g.group_name)))} className="bc-link">
                      {t('broadcastSelectAll') || 'Select all'}
                    </button>
                    <button onClick={() => setSelectedGroups(new Set())} className="bc-link">
                      {t('broadcastClear') || 'Clear'}
                    </button>
                  </div>
                </div>
                <div className="bc-chips">
                  {groups.map(g => (
                    <button
                      key={g.group_name}
                      className={`bc-chip ${selectedGroups.has(g.group_name) ? 'selected' : ''}`}
                      onClick={() => toggleGroup(g.group_name)}
                    >
                      {g.group_name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {teachers.length === 0 && groups.length === 0 && (
              <p className="bc-empty">{t('broadcastNoRecipientsConfigured') || 'No recipients configured yet.'}</p>
            )}
          </div>
        )}

        <div className="bc-summary">
          📬 {t('broadcastWillSendTo') || 'Will send to:'} <strong>{recipientSummary()}</strong>
        </div>
      </div>

      {/* Step 2 — Message */}
      <div className="bc-card">
        <h3 className="bc-step">② {t('broadcastMessage') || 'Message'}</h3>

        <input
          className="bc-subject"
          type="text"
          placeholder={t('broadcastSubjectPlaceholder') || 'Subject / title (optional)'}
          value={subject}
          onChange={e => setSubject(e.target.value)}
          maxLength={120}
        />

        <textarea
          className="bc-textarea"
          placeholder={t('broadcastMessagePlaceholder') || 'Type your message here…'}
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={6}
          maxLength={3000}
        />
        <div className="bc-char-count">{message.length} / 3000</div>

        {(subject || message) && (
          <div className="bc-preview">
            <p className="bc-preview-label">{t('broadcastPreview') || 'Preview:'}</p>
            <div className="bc-preview-bubble">
              <p className="bc-preview-from">🏛 <strong>Alatoo International University</strong></p>
              <p className="bc-preview-subfrom"><em>Faculty Administration</em></p>
              <p className="bc-preview-divider">━━━━━━━━━━━━━━━━</p>
              {subject && <p className="bc-preview-subject">📌 <strong>{subject}</strong></p>}
              <p className="bc-preview-body">{message || '…'}</p>
              <p className="bc-preview-divider">━━━━━━━━━━━━━━━━</p>
              <p className="bc-preview-footer"><em>— Faculty Administration</em></p>
            </div>
          </div>
        )}
      </div>

      {/* Send */}
      <button
        className="bc-send-btn"
        onClick={handleSend}
        disabled={sending || !message.trim() || totalReachable === 0}
      >
        {sending
          ? `⏳ ${t('broadcastSending') || 'Sending…'}`
          : `🚀 ${t('broadcastSend') || 'Send Message'}`}
      </button>

      {/* Result */}
      {result && (
        <div className={`bc-result ${result.failed === 0 ? 'success' : 'partial'}`}>
          <p>
            ✅ {t('broadcastSentTo') || 'Sent to'} <strong>{result.sent}</strong> {t('broadcastRecipient') || 'recipient(s)'}
            {result.failed > 0 && <span> · ❌ {t('broadcastFailed') || 'Failed:'} <strong>{result.failed}</strong></span>}
          </p>
          {result.details?.length > 0 && (
            <details>
              <summary>{t('broadcastDetails') || 'Details'}</summary>
              <ul>
                {result.details.map((d, i) => (
                  <li key={i} className={d.ok ? 'ok' : 'fail'}>
                    {d.ok ? '✅' : '❌'} {d.name} ({d.type})
                    {!d.ok && d.error && <span className="err-msg"> — {d.error}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
};

export default BroadcastMessage;