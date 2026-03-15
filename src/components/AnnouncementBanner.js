// src/components/AnnouncementBanner.js
import React, { useState, useEffect, useCallback } from 'react';
import './AnnouncementBanner.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://timetablebackend-production.up.railway.app/api';
const getToken = () => localStorage.getItem('scheduleToken') || localStorage.getItem('token') || '';

const COLORS = [
  { id:'blue',   label:'🔵 Info',    bg:'#1e40af', text:'#fff' },
  { id:'green',  label:'🟢 Success', bg:'#065f46', text:'#fff' },
  { id:'yellow', label:'🟡 Warning', bg:'#92400e', text:'#fff' },
  { id:'red',    label:'🔴 Urgent',  bg:'#991b1b', text:'#fff' },
];

export default function AnnouncementBanner({ isAdmin }) {
  const [announcements, setAnnouncements] = useState([]);
  const [dismissed,     setDismissed]     = useState(() => {
    try { return JSON.parse(localStorage.getItem('dismissedAnnouncements') || '[]'); }
    catch { return []; }
  });
  const [showForm, setShowForm]   = useState(false);
  const [form,     setForm]       = useState({ message:'', color:'blue', expires:'' });
  const [saving,   setSaving]     = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/announcements`);
      const d = await r.json();
      if (d.success) setAnnouncements(d.data || []);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const dismiss = (id) => {
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem('dismissedAnnouncements', JSON.stringify(next));
  };

  const handleSave = async () => {
    if (!form.message.trim()) return;
    setSaving(true);
    try {
      const r = await fetch(`${API_URL}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${getToken()}` },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (d.success) { setShowForm(false); setForm({ message:'', color:'blue', expires:'' }); load(); }
    } catch {}
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    await fetch(`${API_URL}/announcements/${id}`, {
      method:'DELETE',
      headers:{ Authorization:`Bearer ${getToken()}` }
    });
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  const visible = announcements.filter(a => !dismissed.includes(a.id));

  return (
    <div className="ann-wrap">
      {/* Admin controls */}
      {isAdmin && (
        <div className="ann-admin-bar">
          <span className="ann-admin-label">📢 Announcements</span>
          <button className="ann-add-btn" onClick={() => setShowForm(s => !s)}>
            {showForm ? '✕ Cancel' : '+ New Announcement'}
          </button>
        </div>
      )}

      {/* Add form */}
      {isAdmin && showForm && (
        <div className="ann-form">
          <textarea
            className="ann-textarea"
            placeholder="e.g. Exams start Monday 20th — all groups report 30 min early"
            value={form.message}
            onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
            rows={2}
          />
          <div className="ann-form-row">
            <div className="ann-color-row">
              {COLORS.map(c => (
                <button key={c.id}
                  className={`ann-color-btn ${form.color === c.id ? 'active' : ''}`}
                  style={{ background: c.bg, color: c.text }}
                  onClick={() => setForm(f => ({ ...f, color: c.id }))}
                >{c.label}</button>
              ))}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <label style={{ fontSize:'0.72rem', color:'var(--text-secondary)', whiteSpace:'nowrap' }}>Expires:</label>
              <input type="date" className="ann-date"
                value={form.expires}
                onChange={e => setForm(f => ({ ...f, expires: e.target.value }))}
              />
            </div>
            <button className="ann-save-btn" onClick={handleSave} disabled={saving || !form.message.trim()}>
              {saving ? '...' : '📢 Post'}
            </button>
          </div>
        </div>
      )}

      {/* Active announcements */}
      {visible.map(ann => {
        const colorDef = COLORS.find(c => c.id === ann.color) || COLORS[0];
        return (
          <div key={ann.id} className="ann-banner" style={{ background: colorDef.bg, color: colorDef.text }}>
            <span className="ann-icon">📢</span>
            <span className="ann-message">{ann.message}</span>
            {ann.expires && (
              <span className="ann-expires">Until {new Date(ann.expires).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</span>
            )}
            <div className="ann-actions">
              {isAdmin && (
                <button className="ann-del-btn" onClick={() => handleDelete(ann.id)} title="Delete">🗑</button>
              )}
              <button className="ann-dismiss-btn" onClick={() => dismiss(ann.id)} title="Dismiss">✕</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}