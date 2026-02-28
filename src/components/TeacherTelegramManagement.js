// Frontend: src/components/TeacherTelegramManagement.js
import React, { useState, useEffect, useMemo } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import BroadcastMessage from './BroadcastMessage';
import './TeacherTelegramManagement.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const getToken = () => localStorage.getItem('scheduleToken');

const TeacherTelegramManagement = ({ isDark = false }) => {
  // ── teachers comes from context — SAME list as the filter dropdown, zero dupes
  const { teachers: canonicalTeachers } = useSchedule();

  const [dbTeachers, setDbTeachers]   = useState([]);  // raw DB rows for telegram_id lookup
  const [groups, setGroups]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState('teachers');
  const [search, setSearch]           = useState('');

  // Teacher row state
  const [editingName, setEditingName]       = useState(null); // canonical name being edited
  const [telegramInput, setTelegramInput]   = useState('');
  const [nameInput, setNameInput]           = useState('');
  const [editField, setEditField]           = useState(null); // 'telegram' | 'name'

  // Group row state
  const [editingGroup, setEditingGroup]     = useState(null);
  const [addingGroup, setAddingGroup]       = useState(false);
  const [newGroupName, setNewGroupName]     = useState('');
  const [newGroupChat, setNewGroupChat]     = useState('');
  const [groupChatInput, setGroupChatInput] = useState('');

  // ── Fetch DB data ────────────────────────────────────────────────────────────
  const fetchDbTeachers = async () => {
    try {
      const res  = await fetch(`${API_URL}/teachers`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.success) setDbTeachers(data.data);
    } catch (e) { console.error(e); }
  };

  const fetchGroups = async () => {
    try {
      const res  = await fetch(`${API_URL}/group-channels`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.success) setGroups(data.data);
    } catch (e) { console.error(e); }
  };

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchDbTeachers(), fetchGroups()]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // ── Merge canonical list with DB telegram data ───────────────────────────────
  // canonicalTeachers = ['Dr. Ahmad Sarosh', 'Dr. Daniiar Satybaldiev', ...]
  // dbTeachers = [{ id, name, telegram_id }, ...]  (raw dirty names)
  //
  // Strategy: for each canonical name, find DB rows whose name normalizes to it.
  // Keep the row with a telegram_id (prefer), else the first match.
  const { normalizeTeacherName } = useMemo(() => {
    // Import normalizer lazily to avoid circular ref issues
    try {
      return require('../context/ScheduleContext');
    } catch {
      return { normalizeTeacherName: (n) => n };
    }
  }, []);

  const merged = useMemo(() => {
    return canonicalTeachers.map(canonName => {
      // Find all DB rows that map to this canonical name
      const matches = dbTeachers.filter(row =>
        (normalizeTeacherName(row.name) || row.name.trim()) === canonName
      );
      const winner = matches.find(r => r.telegram_id) || matches[0] || null;
      return {
        canonName,
        id:           winner?.id   || null,
        telegram_id:  winner?.telegram_id || null,
        allIds:       matches.map(r => r.id),
        dupCount:     matches.length,
      };
    });
  }, [canonicalTeachers, dbTeachers, normalizeTeacherName]);

  // ── Filtered list ────────────────────────────────────────────────────────────
  const displayed = useMemo(() => {
    if (!search.trim()) return merged;
    const q = search.toLowerCase();
    return merged.filter(t => t.canonName.toLowerCase().includes(q));
  }, [merged, search]);

  // ── Stats ────────────────────────────────────────────────────────────────────
  const linked   = merged.filter(t => t.telegram_id).length;
  const gLinked  = groups.filter(g => g.chat_id).length;

  // ── API helpers ──────────────────────────────────────────────────────────────
  const apiCall = async (url, method, body) => {
    const res  = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    try { return { ok: res.ok, ...JSON.parse(text) }; }
    catch { return { ok: false, error: text }; }
  };

  // ── Teacher actions ──────────────────────────────────────────────────────────
  const startEdit = (t, field) => {
    setEditingName(t.canonName);
    setEditField(field);
    setTelegramInput(t.telegram_id || '');
    setNameInput(t.canonName);
  };

  const cancelEdit = () => { setEditingName(null); setEditField(null); };

  const saveTelegramId = async (t) => {
    if (!t.id) {
      // No DB row yet — need to create one first via PUT (backend handles upsert)
      alert('This teacher has no DB record yet. Please re-import the schedule first.');
      return;
    }
    const data = await apiCall(`${API_URL}/teachers/${t.id}/telegram`, 'PUT', { telegram_id: telegramInput.trim() });
    if (data.success) { cancelEdit(); fetchDbTeachers(); }
    else alert('Error: ' + data.error);
  };

  const removeTelegramId = async (t) => {
    if (!t.id || !t.telegram_id) return;
    if (!window.confirm(`Remove Telegram ID for ${t.canonName}?`)) return;
    const data = await apiCall(`${API_URL}/teachers/${t.id}/telegram`, 'DELETE');
    if (data.success) fetchDbTeachers();
    else alert('Error: ' + (data.error || 'unknown'));
  };

  const saveTeacherName = async (t) => {
    const newName = nameInput.trim();
    if (!newName || newName === t.canonName) { cancelEdit(); return; }
    if (!t.allIds.length) { cancelEdit(); return; }
    // Update ALL duplicate rows to the new canonical name
    await Promise.all(t.allIds.map(id =>
      apiCall(`${API_URL}/teachers/${id}/name`, 'PUT', { name: newName })
    ));
    cancelEdit();
    await fetchDbTeachers();
  };

  const deleteTeacher = async (t) => {
    if (!t.allIds.length) {
      alert(`"${t.canonName}" has no database record — nothing to delete.`);
      return;
    }
    const note = t.dupCount > 1 ? `\n(removes ${t.dupCount} duplicate DB records)` : '';
    if (!window.confirm(`Delete "${t.canonName}"?${note}`)) return;
    await Promise.all(t.allIds.map(id =>
      apiCall(`${API_URL}/teachers/${id}`, 'DELETE')
    ));
    fetchDbTeachers();
  };

  // ── Group actions ────────────────────────────────────────────────────────────
  const saveGroup = async (groupName) => {
    const data = await apiCall(`${API_URL}/group-channels`, 'POST', { group_name: groupName, chat_id: groupChatInput.trim() });
    if (data.success) { setEditingGroup(null); setGroupChatInput(''); fetchGroups(); }
    else alert('Error: ' + data.error);
  };

  const addNewGroup = async () => {
    if (!newGroupName.trim() || !newGroupChat.trim()) return;
    const data = await apiCall(`${API_URL}/group-channels`, 'POST', {
      group_name: newGroupName.trim(),
      chat_id: newGroupChat.trim(),
    });
    if (data.success) {
      setAddingGroup(false);
      setNewGroupName('');
      setNewGroupChat('');
      fetchGroups();
    }
  };

  const deleteGroup = async (groupName) => {
    if (!window.confirm(`Remove channel for ${groupName}?`)) return;
    const data = await apiCall(`${API_URL}/group-channels/${encodeURIComponent(groupName)}`, 'DELETE');
    if (data.success) fetchGroups();
    else alert('Error: ' + (data.error || 'unknown'));
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) return <div className="ttm-loading">Loading…</div>;

  return (
    <div className="ttm" data-theme={isDark ? "dark" : "light"}>

      {/* HEADER */}
      <div className="ttm-head">
        <div>
          <h2 className="ttm-title">Telegram</h2>
          <p className="ttm-sub">Notifications · Group Channels · Broadcast</p>
        </div>
        <button className="ttm-ico-btn" onClick={fetchAll} title="Refresh">↻</button>
      </div>

      {/* STATS */}
      <div className="ttm-stats">
        <Stat val={linked}              lbl="teachers linked"  />
        <Stat val={merged.length - linked} lbl="not linked"   color="muted" />
        <Stat val={gLinked}             lbl="group channels"  />
        <Stat val={merged.length}       lbl="total teachers"  color="muted" />
      </div>

      {/* TABS */}
      <div className="ttm-tabs">
        {['teachers','groups','broadcast'].map(id => (
          <button key={id} className={`ttm-tab${tab===id?' active':''}`} onClick={() => setTab(id)}>
            {id === 'teachers' ? 'Teachers' : id === 'groups' ? 'Group Channels' : 'Broadcast'}
          </button>
        ))}
      </div>

      {/* ── TEACHERS ── */}
      {tab === 'teachers' && (
        <div className="ttm-pane">
          <div className="ttm-toolbar">
            <div className="ttm-search-box">
              <span className="ttm-search-icon">⌕</span>
              <input
                className="ttm-search"
                placeholder="Search teacher…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && <button className="ttm-search-x" onClick={() => setSearch('')}>×</button>}
            </div>
            <span className="ttm-count">{displayed.length} teachers</span>
          </div>

          <div className="ttm-hint">
            Teacher sends <code>/start</code> to your bot → receives their ID → paste it in the row below
          </div>

          <div className="ttm-scroll">
            <table className="ttm-tbl">
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Telegram ID</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 && (
                  <tr><td colSpan={4} className="ttm-empty">No teachers found</td></tr>
                )}
                {displayed.map(t => {
                  const isEditing     = editingName === t.canonName;
                  const editTelegram  = isEditing && editField === 'telegram';
                  const editName      = isEditing && editField === 'name';

                  return (
                    <tr key={t.canonName} className={t.telegram_id ? 'tr-linked' : ''}>

                      {/* NAME */}
                      <td className="td-name">
                        {editName ? (
                          <input
                            className="ttm-input ttm-input-name"
                            value={nameInput}
                            onChange={e => setNameInput(e.target.value)}
                            onKeyDown={e => { if(e.key==='Enter') saveTeacherName(t); if(e.key==='Escape') cancelEdit(); }}
                            autoFocus
                          />
                        ) : (
                          <span className="teacher-name">{t.canonName}</span>
                        )}
                      </td>

                      {/* TELEGRAM ID */}
                      <td className="td-id">
                        {editTelegram ? (
                          <input
                            className="ttm-input ttm-input-id"
                            value={telegramInput}
                            onChange={e => setTelegramInput(e.target.value)}
                            placeholder="e.g. 1300165738"
                            onKeyDown={e => { if(e.key==='Enter') saveTelegramId(t); if(e.key==='Escape') cancelEdit(); }}
                            autoFocus
                          />
                        ) : (
                          <span className={t.telegram_id ? 'id-chip set' : 'id-chip empty'}>
                            {t.telegram_id || 'not set'}
                          </span>
                        )}
                      </td>

                      {/* STATUS */}
                      <td>
                        <span className={`status-dot ${t.telegram_id ? 'on' : 'off'}`}>
                          {t.telegram_id ? 'Linked' : 'Not set'}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td className="td-actions">
                        {isEditing ? (
                          <div className="act-row">
                            <button className="act save" onClick={() => editField==='name' ? saveTeacherName(t) : saveTelegramId(t)}>Save</button>
                            <button className="act cancel" onClick={cancelEdit}>Cancel</button>
                          </div>
                        ) : (
                          <div className="act-row">
                            <button className="act edit" onClick={() => startEdit(t, 'telegram')}>Edit ID</button>
                            <button className="act rename" onClick={() => startEdit(t, 'name')}>Rename</button>
                            {t.telegram_id && (
                              <button className="act remove" onClick={() => removeTelegramId(t)}>Remove ID</button>
                            )}
                            <button className="act del" onClick={() => deleteTeacher(t)}>Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="ttm-footer-note">
            <code>/start</code> — get Telegram ID &nbsp;·&nbsp; <code>/status</code> — check registration
          </div>
        </div>
      )}

      {/* ── GROUPS ── */}
      {tab === 'groups' && (
        <div className="ttm-pane">
          <div className="ttm-hint">
            Add bot as <strong>Admin</strong> → get chat ID from <code>@getidsbot</code> or use <code>@channelusername</code> → paste below
          </div>
          <div className="ttm-toolbar">
            <button className="act save" onClick={() => { setAddingGroup(true); setNewGroupName(''); setNewGroupChat(''); }}>
              + Add Channel
            </button>
          </div>
          <div className="ttm-scroll">
            <table className="ttm-tbl">
              <thead>
                <tr><th>Group / Channel Name</th><th>Chat ID</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {/* ── Add new row ── */}
                {addingGroup && (
                  <tr style={{background:'var(--hint-bg)'}}>
                    <td><input
                      className="ttm-input ttm-input-name"
                      placeholder="e.g. CS101-A"
                      value={newGroupName}
                      onChange={e => setNewGroupName(e.target.value)}
                      autoFocus
                    /></td>
                    <td><input
                      className="ttm-input ttm-input-id"
                      placeholder="@username or -100123..."
                      value={newGroupChat}
                      onChange={e => setNewGroupChat(e.target.value)}
                      onKeyDown={e => { if(e.key==='Enter') addNewGroup(); if(e.key==='Escape') setAddingGroup(false); }}
                    /></td>
                    <td><span className="status-dot off">New</span></td>
                    <td><div className="act-row">
                      <button className="act save" onClick={addNewGroup}>Save</button>
                      <button className="act cancel" onClick={() => setAddingGroup(false)}>Cancel</button>
                    </div></td>
                  </tr>
                )}
                {groups.length === 0 && !addingGroup && (
                  <tr><td colSpan={4} className="ttm-empty">No channels yet — click "+ Add Channel" above</td></tr>
                )}
                {groups.map(g => (
                  <tr key={g.group_name} className={g.chat_id ? 'tr-linked' : ''}>
                    <td className="td-name"><span className="teacher-name">{g.group_name}</span></td>
                    <td className="td-id">
                      {editingGroup === g.group_name ? (
                        <input
                          className="ttm-input ttm-input-id"
                          value={groupChatInput}
                          onChange={e => setGroupChatInput(e.target.value)}
                          placeholder="-1001234567890"
                          onKeyDown={e => { if(e.key==='Enter') saveGroup(g.group_name); if(e.key==='Escape') setEditingGroup(null); }}
                          autoFocus
                        />
                      ) : (
                        <span className={g.chat_id ? 'id-chip set' : 'id-chip empty'}>
                          {g.chat_id || 'not set'}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`status-dot ${g.chat_id ? 'on' : 'off'}`}>
                        {g.chat_id ? 'Linked' : 'Not set'}
                      </span>
                    </td>
                    <td className="td-actions">
                      {editingGroup === g.group_name ? (
                        <div className="act-row">
                          <button className="act save" onClick={() => saveGroup(g.group_name)}>Save</button>
                          <button className="act cancel" onClick={() => setEditingGroup(null)}>Cancel</button>
                        </div>
                      ) : (
                        <div className="act-row">
                          <button className="act edit" onClick={() => { setEditingGroup(g.group_name); setGroupChatInput(g.chat_id||''); }}>Edit</button>
                          <button className="act del" onClick={() => deleteGroup(g.group_name)}>Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── BROADCAST ── */}
      {tab === 'broadcast' && <BroadcastMessage />}
    </div>
  );
};

const Stat = ({ val, lbl, color }) => (
  <div className={`stat-item${color?' stat-'+color:''}`}>
    <span className="stat-val">{val}</span>
    <span className="stat-lbl">{lbl}</span>
  </div>
);

export default TeacherTelegramManagement;