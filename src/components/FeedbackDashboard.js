// src/components/FeedbackDashboard.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './FeedbackDashboard.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://timetablebackend-production.up.railway.app/api';
const getToken = () => localStorage.getItem('token') || localStorage.getItem('scheduleToken') || '';

const STATUS_LABELS = { new:'New', read:'Read', resolved:'Resolved' };
const STATUS_COLORS = { new:'#ef4444', read:'#f59e0b', resolved:'#22c55e' };
const CAT_ICONS     = { room:'🏛', teacher:'👨‍🏫', group:'👥', general:'📝' };

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB',{ day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '';

export default function FeedbackDashboard() {
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
        fetch(`${API_URL}/feedback`, { headers: { Authorization: `Bearer ${getToken()}` } }),
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
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${getToken()}` },
        body: JSON.stringify({ status }),
      });
      setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i));
      // update stats unread count
      setStats(prev => prev ? {
        ...prev,
        unread: prev.unread + (status === 'new' ? 1 : -1),
      } : prev);
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this feedback?')) return;
    await fetch(`${API_URL}/feedback/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    setItems(prev => prev.filter(i => i.id !== id));
  };

  // Auto-mark as read when expanded
  const handleExpand = (id) => {
    setExpanded(expanded === id ? null : id);
    const item = items.find(i => i.id === id);
    if (item?.status === 'new') updateStatus(id, 'read');
  };

  // Unique subjects for filter
  const allSubjects = useMemo(() => [...new Set(items.map(i => i.subject))].sort(), [items]);

  const filtered = useMemo(() => items.filter(i => {
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

      {/* Stats cards */}
      {stats && (
        <div className="fb-stats">
          <div className="fb-stat-card">
            <div className="fb-stat-val">{stats.total}</div>
            <div className="fb-stat-lbl">Total</div>
          </div>
          <div className="fb-stat-card red">
            <div className="fb-stat-val">{stats.unread}</div>
            <div className="fb-stat-lbl">Unread</div>
          </div>
          {stats.byCategory?.map(c => (
            <div key={c.category} className="fb-stat-card">
              <div className="fb-stat-val">{CAT_ICONS[c.category]} {c.count}</div>
              <div className="fb-stat-lbl">{c.category}</div>
            </div>
          ))}
        </div>
      )}

      {/* Top reported subjects */}
      {stats?.bySubject?.length > 0 && (
        <div className="fb-top-subjects">
          <div className="fb-section-title">🔥 Most Reported</div>
          <div className="fb-subject-pills">
            {stats.bySubject.slice(0,8).map((s,i) => (
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
          className="fb-search" placeholder="🔍 Search feedback..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
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
          <button className="fb-clear" onClick={() => { setFilterCat(''); setFilterStat(''); setFilterSub(''); setSearch(''); }}>
            ✕ Clear
          </button>
        )}
        <div className="fb-count">{filtered.length} item{filtered.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Feedback list */}
      {loading ? (
        <div className="fb-loading">Loading feedback...</div>
      ) : filtered.length === 0 ? (
        <div className="fb-empty">
          <div style={{ fontSize:'2.5rem', marginBottom:8 }}>💬</div>
          <div>{items.length === 0 ? 'No feedback received yet.' : 'No feedback matches your filters.'}</div>
          {items.length === 0 && (
            <div className="fb-empty-hint">
              Students can send feedback via the Telegram bot using <code>/feedback</code>
            </div>
          )}
        </div>
      ) : (
        <div className="fb-list">
          {filtered.map(item => (
            <div
              key={item.id}
              className={`fb-item ${item.status} ${expanded === item.id ? 'expanded' : ''}`}
            >
              {/* Item header */}
              <div className="fb-item-header" onClick={() => handleExpand(item.id)}>
                <div className="fb-item-left">
                  <span className="fb-cat-icon">{CAT_ICONS[item.category]}</span>
                  <div className="fb-item-info">
                    <div className="fb-item-subject">{item.subject}</div>
                    <div className="fb-item-preview">
                      {item.message.length > 80 && expanded !== item.id
                        ? item.message.slice(0,80) + '…'
                        : item.message}
                    </div>
                  </div>
                </div>
                <div className="fb-item-right">
                  <span
                    className="fb-status-dot"
                    style={{ background: STATUS_COLORS[item.status] }}
                    title={STATUS_LABELS[item.status]}
                  />
                  <span className="fb-item-date">{fmt(item.created_at)}</span>
                  <span className="fb-chevron">{expanded === item.id ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Expanded detail */}
              {expanded === item.id && (
                <div className="fb-item-detail">
                  <div className="fb-detail-message">"{item.message}"</div>

                  <div className="fb-detail-meta">
                    <div className="fb-meta-row">
                      <span className="fb-meta-key">Category</span>
                      <span className="fb-meta-val">{CAT_ICONS[item.category]} {item.category}</span>
                    </div>
                    <div className="fb-meta-row">
                      <span className="fb-meta-key">Sender</span>
                      <span className="fb-meta-val">
                        {item.anonymous
                          ? '🔒 Anonymous'
                          : `👤 ${item.sender_name || 'Unknown'}`}
                      </span>
                    </div>
                    <div className="fb-meta-row">
                      <span className="fb-meta-key">Submitted</span>
                      <span className="fb-meta-val">{fmt(item.created_at)}</span>
                    </div>
                    <div className="fb-meta-row">
                      <span className="fb-meta-key">Status</span>
                      <span className="fb-meta-val" style={{ color: STATUS_COLORS[item.status] }}>
                        ● {STATUS_LABELS[item.status]}
                      </span>
                    </div>
                  </div>

                  {/* Status actions */}
                  <div className="fb-detail-actions">
                    {item.status !== 'new' && (
                      <button className="fb-action new" onClick={() => updateStatus(item.id, 'new')}>
                        Mark New
                      </button>
                    )}
                    {item.status !== 'read' && (
                      <button className="fb-action read" onClick={() => updateStatus(item.id, 'read')}>
                        Mark Read
                      </button>
                    )}
                    {item.status !== 'resolved' && (
                      <button className="fb-action resolved" onClick={() => updateStatus(item.id, 'resolved')}>
                        ✓ Resolve
                      </button>
                    )}
                    <button className="fb-action delete" onClick={() => handleDelete(item.id)}>
                      🗑 Delete
                    </button>
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