// Frontend: src/components/TeacherTelegramManagement.js
import React, { useState, useEffect, useMemo } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import BroadcastMessage from './BroadcastMessage';
import './TeacherTelegramManagement.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://timetablebackend-production.up.railway.app/api';
const getToken = () =>
  localStorage.getItem('scheduleToken') ||
  localStorage.getItem('token') ||
  localStorage.getItem('authToken') || '';

const TeacherTelegramManagement = ({ isDark = false }) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const { teachers: canonicalTeachers } = useSchedule();

  const [dbTeachers, setDbTeachers]   = useState([]);
  const [groups, setGroups]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState('teachers');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [search, setSearch]           = useState('');

  const [editingName, setEditingName]       = useState(null);
  const [telegramInput, setTelegramInput]   = useState('');
  const [nameInput, setNameInput]           = useState('');
  const [editField, setEditField]           = useState(null);

  const [editingGroup, setEditingGroup]     = useState(null);
  const [addingGroup, setAddingGroup]       = useState(false);
  const [groupError, setGroupError]         = useState('');
  const [newGroupName, setNewGroupName]     = useState('');
  const [newGroupChat, setNewGroupChat]     = useState('');
  const [groupChatInput, setGroupChatInput] = useState('');
  const [confirmDelete, setConfirmDelete]   = useState(null);

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

  const fetchGlobalNotifSetting = async () => {
    try {
      const res  = await fetch(`${API_URL}/settings/notifications_enabled`);
      const data = await res.json();
      if (data.success) setNotificationsEnabled(data.value !== 'false');
    } catch { /* ignore */ }
  };

  const toggleGlobalNotifications = async () => {
    const newVal = !notificationsEnabled;
    try {
      await fetch(`${API_URL}/settings/notifications_enabled`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: String(newVal) }),
      });
      setNotificationsEnabled(newVal);
    } catch (e) { alert('Error: ' + e.message); }
  };

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchDbTeachers(), fetchGroups(), fetchGlobalNotifSetting()]);
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchAll();
    }
  }, [isAuthenticated, authLoading]);

  const { normalizeTeacherName } = useMemo(() => {
    try {
      return require('../context/ScheduleContext');
    } catch {
      return { normalizeTeacherName: (n) => n };
    }
  }, []);

  const merged = useMemo(() => {
    return canonicalTeachers.map(canonName => {
      const matches = dbTeachers.filter(row =>
        (normalizeTeacherName(row.name) || row.name.trim()) === canonName
      );
      const winner = matches.find(r => r.telegram_id) || matches[0] || null;
      return {
        canonName,
        id:                    winner?.id   || null,
        telegram_id:           winner?.telegram_id || null,
        notifications_enabled: winner?.notifications_enabled !== false,
        allIds:                matches.map(r => r.id),
        dupCount:              matches.length,
      };
    });
  }, [canonicalTeachers, dbTeachers, normalizeTeacherName]);

  const displayed = useMemo(() => {
    if (!search.trim()) return merged;
    const q = search.toLowerCase();
    return merged.filter(t => t.canonName.toLowerCase().includes(q));
  }, [merged, search]);

  const linked   = merged.filter(t => t.telegram_id).length;
  const gLinked  = groups.filter(g => g.chat_id).length;

  const apiCall = async (url, method, body) => {
    try {
      const res  = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const text = await res.text();
      try { return { ok: res.ok, ...JSON.parse(text) }; }
      catch { return { ok: false, error: text }; }
    } catch (err) {
      return { ok: false, error: err.message };
    }
  };

  const startEdit = (t, field) => {
    setEditingName(t.canonName);
    setEditField(field);
    setTelegramInput(t.telegram_id || '');
    setNameInput(t.canonName);
  };

  const cancelEdit = () => { setEditingName(null); setEditField(null); };

  const saveTelegramId = async (t) => {
    const trimmed = telegramInput.trim();
    if (!trimmed) { cancelEdit(); return; }
    const token = getToken();
    if (!token) { alert('Not logged in — please refresh the page and try again.'); return; }
    const data = await apiCall(`${API_URL}/teachers/save-telegram`, 'POST', {
      id: t.id || null, name: t.canonName, telegram_id: trimmed,
    });
    if (data.success) { cancelEdit(); fetchDbTeachers(); }
    else if (data.error?.includes('Access denied') || data.error?.includes('token')) {
      alert('Session expired — please refresh the page and log in again.');
    } else {
      alert('Error saving Telegram ID: ' + (data.error || 'unknown'));
    }
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
    await Promise.all(t.allIds.map(id =>
      apiCall(`${API_URL}/teachers/${id}/name`, 'PUT', { name: newName })
    ));
    cancelEdit();
    await fetchDbTeachers();
  };

  const toggleNotifications = async (teacher) => {
    if (!teacher.id) return;
    const newVal = !teacher.notifications_enabled;
    const data = await apiCall(`${API_URL}/teachers/${teacher.id}/notifications`, 'PUT', { enabled: newVal });
    if (data.success) fetchDbTeachers();
    else alert('Error: ' + (data.error || 'unknown'));
  };

  const deleteTeacher = async (t) => {
    if (!t.allIds.length) { alert(`"${t.canonName}" has no database record — nothing to delete.`); return; }
    const note = t.dupCount > 1 ? `\n(removes ${t.dupCount} duplicate DB records)` : '';
    if (!window.confirm(`Delete "${t.canonName}"?${note}`)) return;
    await Promise.all(t.allIds.map(id => apiCall(`${API_URL}/teachers/${id}`, 'DELETE')));
    fetchDbTeachers();
  };

  const saveGroup = async (groupName) => {
    const data = await apiCall(`${API_URL}/group-channels`, 'POST', { group_name: groupName, chat_id: groupChatInput.trim() });
    if (data.success) { setEditingGroup(null); setGroupChatInput(''); fetchGroups(); }
    else alert('Error: ' + data.error);
  };

  const addNewGroup = async () => {
    setGroupError('');
    if (!newGroupName.trim()) { setGroupError('Please enter a group name'); return; }
    if (!newGroupChat.trim()) { setGroupError('Please enter a Chat ID or @username'); return; }
    const data = await apiCall(`${API_URL}/group-channels`, 'POST', {
      group_name: newGroupName.trim(), chat_id: newGroupChat.trim(),
    });
    if (data.success) {
      setAddingGroup(false); setNewGroupName(''); setNewGroupChat(''); setGroupError(''); fetchGroups();
    } else {
      setGroupError(`Failed: ${data.error || 'unknown error'}`);
    }
  };

  const deleteGroup = async (groupName) => {
    setGroupError('');
    setGroups(prev => prev.filter(g => g.group_name !== groupName));
    setConfirmDelete(null);
    const data = await apiCall(`${API_URL}/group-channels/${encodeURIComponent(groupName)}`, 'DELETE');
    if (!data.success) { setGroupError('Delete failed: ' + (data.error || 'unknown')); fetchGroups(); }
  };

  if (loading) return <div className="ttm-loading">{t('loadingData') || 'Loading…'}</div>;

  return (
    <div className="ttm" data-theme={isDark ? "dark" : "light"}>

      {/* HEADER */}
      <div className="ttm-head">
        <div>
          <h2 className="ttm-title">Telegram</h2>
          <p className="ttm-sub">Notifications · Group Channels · Broadcast</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', userSelect:'none' }}>
            <span style={{ fontSize:'0.82rem', fontWeight:600, color: notificationsEnabled ? 'var(--badge-on-txt)' : 'var(--badge-off-txt)' }}>
              {notificationsEnabled ? `🔔 ${t('notificationsOn')||'ON'}` : `🔕 ${t('notificationsOff')||'OFF'}`}
            </span>
            <label className="notif-toggle" title="Toggle all Telegram notifications">
              <input type="checkbox" checked={notificationsEnabled} onChange={toggleGlobalNotifications} />
              <span className="notif-slider" />
            </label>
          </label>
          <button className="ttm-ico-btn" onClick={fetchAll} title={t('refresh') || 'Refresh'}>↻</button>
        </div>
      </div>

      {/* Global notifications warning */}
      {!notificationsEnabled && (
        <div style={{ background:'#4c0519', color:'#fecdd3', border:'1px solid #be123c', borderRadius:10, padding:'10px 16px', marginBottom:16, fontSize:'0.88rem', display:'flex', alignItems:'center', gap:10 }}>
          🔕 <strong>Telegram notifications are disabled.</strong> No messages will be sent until you turn this back on.
        </div>
      )}

      {/* STATS */}
      <div className="ttm-stats">
        <Stat val={linked}                 lbl={t('linked') || 'linked'} />
        <Stat val={merged.length - linked} lbl={t('notLinked') || 'not linked'} color="muted" />
        <Stat val={gLinked}                lbl={t('tabGroupChannels') || 'channels'} />
        <Stat val={merged.length}          lbl={t('tabTeachers') || 'teachers'} color="muted" />
      </div>

      {/* TABS */}
      <div className="ttm-tabs">
        {['teachers','groups','broadcast'].map(id => (
          <button key={id} className={`ttm-tab${tab===id?' active':''}`} onClick={() => setTab(id)}>
            {id === 'teachers' ? (t('tabTeachers') || 'Teachers')
              : id === 'groups' ? (t('tabGroupChannels') || 'Group Channels')
              : (t('tabBroadcast') || 'Broadcast')}
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
                placeholder={t('teacherName') ? `${t('teacherName')}…` : 'Search teacher…'}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && <button className="ttm-search-x" onClick={() => setSearch('')}>×</button>}
            </div>
            <span className="ttm-count">{displayed.length} {t('tabTeachers') || 'teachers'}</span>
          </div>

          <div className="ttm-hint">
            {t('teacherSetupStep1') || 'Teacher sends'} <code>/start</code> → {t('teacherSetupStep2') || 'paste ID below'}
          </div>

          <div className="ttm-scroll">
            <table className="ttm-tbl">
              <thead>
                <tr>
                  <th>{t('teacherName') || 'Teacher'}</th>
                  <th>{t('telegramId') || 'Telegram ID'}</th>
                  <th>{t('notifications') || 'Notifs'}</th>
                  <th>{t('status') || 'Status'}</th>
                  <th>{t('actions') || 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 && (
                  <tr><td colSpan={5} className="ttm-empty">{t('noTeachersFound') || 'No teachers found'}</td></tr>
                )}
                {displayed.map(teacher => {
                  const isEditing    = editingName === teacher.canonName;
                  const editTelegram = isEditing && editField === 'telegram';
                  const editName     = isEditing && editField === 'name';
                  return (
                    <tr key={teacher.canonName} className={teacher.telegram_id ? 'tr-linked' : ''}>
                      <td className="td-name">
                        {editName ? (
                          <input className="ttm-input ttm-input-name" value={nameInput} onChange={e => setNameInput(e.target.value)}
                            onKeyDown={e => { if(e.key==='Enter') saveTeacherName(teacher); if(e.key==='Escape') cancelEdit(); }} autoFocus />
                        ) : (
                          <span className="teacher-name">{teacher.canonName}</span>
                        )}
                      </td>
                      <td className="td-id">
                        {editTelegram ? (
                          <input className="ttm-input ttm-input-id" value={telegramInput} onChange={e => setTelegramInput(e.target.value)}
                            placeholder={t('telegramIdPlaceholder') || 'e.g. 1300165738'}
                            onKeyDown={e => { if(e.key==='Enter') saveTelegramId(teacher); if(e.key==='Escape') cancelEdit(); }} autoFocus />
                        ) : (
                          <span className={teacher.telegram_id ? 'id-chip set' : 'id-chip empty'}>
                            {teacher.telegram_id || t('notSet') || 'not set'}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign:'center' }}>
                        {teacher.telegram_id ? (
                          <label className="notif-toggle" title={teacher.notifications_enabled ? (t('notificationsOn')||'ON') : (t('notificationsOff')||'OFF')}>
                            <input type="checkbox" checked={teacher.notifications_enabled} onChange={() => toggleNotifications(teacher)} />
                            <span className="notif-slider" />
                          </label>
                        ) : <span style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}>—</span>}
                      </td>
                      <td>
                        <span className={`status-dot ${teacher.telegram_id ? 'on' : 'off'}`}>
                          {teacher.telegram_id ? (t('linked') || 'Linked') : (t('notSet') || 'Not set')}
                        </span>
                      </td>
                      <td className="td-actions">
                        {isEditing ? (
                          <div className="act-row">
                            <button className="act save" onClick={() => editField==='name' ? saveTeacherName(teacher) : saveTelegramId(teacher)}>{t('save') || 'Save'}</button>
                            <button className="act cancel" onClick={cancelEdit}>{t('cancel') || 'Cancel'}</button>
                          </div>
                        ) : (
                          <div className="act-row">
                            <button className="act edit" onClick={() => startEdit(teacher, 'telegram')}>{t('edit') || 'Edit'} ID</button>
                            <button className="act rename" onClick={() => startEdit(teacher, 'name')}>Rename</button>
                            {teacher.telegram_id && (
                              <button className="act remove" onClick={() => removeTelegramId(teacher)}>Remove</button>
                            )}
                            <button className="act del" onClick={() => deleteTeacher(teacher)}>{t('delete') || 'Delete'}</button>
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
            Add bot as <strong>Admin</strong> → get chat ID from <code>@getidsbot</code> → paste below
          </div>
          <div className="ttm-toolbar">
            <button className="act save" onClick={() => { setAddingGroup(true); setNewGroupName(''); setNewGroupChat(''); setGroupError(''); }}>
              + {t('tabGroupChannels') || 'Add Channel'}
            </button>
          </div>
          {groupError && (
            <div style={{ background:'#4c0519', color:'#fecdd3', border:'1px solid #be123c', borderRadius:'8px', padding:'10px 14px', marginBottom:'10px', fontSize:'0.88rem' }}>
              ⚠️ {groupError}
            </div>
          )}
          <div className="ttm-scroll">
            <table className="ttm-tbl">
              <thead>
                <tr>
                  <th>{t('group') || 'Group'} / Channel</th>
                  <th>Chat ID</th>
                  <th>{t('status') || 'Status'}</th>
                  <th>{t('actions') || 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {addingGroup && (
                  <tr style={{ background:'var(--hint-bg)' }}>
                    <td><input className="ttm-input ttm-input-name" placeholder="e.g. CS101-A" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} autoFocus /></td>
                    <td><input className="ttm-input ttm-input-id" placeholder="@username or -100123..." value={newGroupChat} onChange={e => setNewGroupChat(e.target.value)} onKeyDown={e => { if(e.key==='Enter') addNewGroup(); if(e.key==='Escape') setAddingGroup(false); }} /></td>
                    <td><span className="status-dot off">New</span></td>
                    <td><div className="act-row">
                      <button className="act save" onClick={addNewGroup}>{t('save') || 'Save'}</button>
                      <button className="act cancel" onClick={() => setAddingGroup(false)}>{t('cancel') || 'Cancel'}</button>
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
                        <input className="ttm-input ttm-input-id" value={groupChatInput} onChange={e => setGroupChatInput(e.target.value)}
                          placeholder="-1001234567890" onKeyDown={e => { if(e.key==='Enter') saveGroup(g.group_name); if(e.key==='Escape') setEditingGroup(null); }} autoFocus />
                      ) : (
                        <span className={g.chat_id ? 'id-chip set' : 'id-chip empty'}>
                          {g.chat_id || (t('notSet') || 'not set')}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`status-dot ${g.chat_id ? 'on' : 'off'}`}>
                        {g.chat_id ? (t('linked') || 'Linked') : (t('notSet') || 'Not set')}
                      </span>
                    </td>
                    <td className="td-actions">
                      {editingGroup === g.group_name ? (
                        <div className="act-row">
                          <button className="act save" onClick={() => saveGroup(g.group_name)}>{t('save') || 'Save'}</button>
                          <button className="act cancel" onClick={() => setEditingGroup(null)}>{t('cancel') || 'Cancel'}</button>
                        </div>
                      ) : (
                        <div className="act-row">
                          <button className="act edit" onClick={() => { setEditingGroup(g.group_name); setGroupChatInput(g.chat_id||''); setConfirmDelete(null); }}>{t('edit') || 'Edit'}</button>
                          {confirmDelete === g.group_name ? (
                            <>
                              <button className="act save" onClick={() => { deleteGroup(g.group_name); setConfirmDelete(null); }}>✓ Yes</button>
                              <button className="act cancel" onClick={() => setConfirmDelete(null)}>✗ No</button>
                            </>
                          ) : (
                            <button className="act del" onClick={() => setConfirmDelete(g.group_name)}>{t('delete') || 'Delete'}</button>
                          )}
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