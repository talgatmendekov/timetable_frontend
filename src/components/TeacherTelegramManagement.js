// Frontend: src/components/TeacherTelegramManagement.js
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import BroadcastMessage from './BroadcastMessage';
import './TeacherTelegramManagement.css';
import { normalizeTeacherName } from '../context/ScheduleContext';

const TeacherTelegramManagement = () => {
  const { t } = useLanguage();
  const [teachers, setTeachers]           = useState([]);
  const [groups, setGroups]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [activeSection, setActiveSection] = useState('teachers');

  const [editingId, setEditingId]             = useState(null);
  const [telegramInput, setTelegramInput]     = useState('');
  const [editingGroupId, setEditingGroupId]   = useState(null);
  const [groupChatInput, setGroupChatInput]   = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
  const token   = () => localStorage.getItem('scheduleToken');

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchTeachers = async () => {
    try {
      const res  = await fetch(`${API_URL}/teachers`, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      if (!data.success) return;

      // Deduplicate using the same normalizeTeacherName as the schedule filter.
      // For each canonical name, keep the row that has a telegram_id (preferred),
      // or the first row if none have one. Collect all raw IDs in the group so
      // deleting the canonical entry also removes all duplicates.
      const canonical = new Map(); // canonicalName → best row
      const allIds    = new Map(); // canonicalName → [id, id, ...]

      for (const teacher of data.data) {
        const norm = normalizeTeacherName(teacher.name) || teacher.name.trim();
        if (!allIds.has(norm)) allIds.set(norm, []);
        allIds.get(norm).push(teacher.id);

        if (!canonical.has(norm)) {
          canonical.set(norm, teacher);
        } else {
          // Prefer the row that already has a telegram_id
          const existing = canonical.get(norm);
          if (!existing.telegram_id && teacher.telegram_id) {
            canonical.set(norm, teacher);
          }
        }
      }

      // Attach the list of all duplicate DB ids so we can delete them all at once
      const deduped = Array.from(canonical.values()).map(t => ({
        ...t,
        _allIds: allIds.get(normalizeTeacherName(t.name) || t.name.trim()),
      }));

      // Sort alphabetically
      deduped.sort((a, b) => a.name.localeCompare(b.name));
      setTeachers(deduped);
    } catch (e) { console.error(e); }
  };

  const fetchGroupChannels = async () => {
    try {
      const res  = await fetch(`${API_URL}/group-channels`, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      if (data.success) setGroups(data.data);
    } catch (e) { console.error(e); }
  };

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchTeachers(), fetchGroupChannels()]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // ── Teacher actions ─────────────────────────────────────────────────────────
  const handleSaveTelegramId = async (id) => {
    try {
      const res  = await fetch(`${API_URL}/teachers/${id}/telegram`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_id: telegramInput.trim() }),
      });
      const data = await res.json();
      if (data.success) { setEditingId(null); setTelegramInput(''); fetchTeachers(); }
      else alert(`Error: ${data.error}`);
    } catch (e) { alert(`Error: ${e.message}`); }
  };

  const handleDeleteTelegramId = async (id, name) => {
    if (!window.confirm(`Remove Telegram ID for ${name}?`)) return;
    try {
      const url = `${API_URL}/teachers/${id}/telegram`;
      console.log('DELETE', url);
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      console.log('Response status:', res.status);
      const text = await res.text();
      console.log('Response body:', text);
      let data;
      try { data = JSON.parse(text); } catch { data = { success: false, error: text }; }
      if (data.success) {
        fetchTeachers();
      } else {
        alert('Delete failed (HTTP ' + res.status + '):\n' + (data.error || text));
      }
    } catch (e) {
      alert('Network error: ' + e.message);
    }
  };

  const handleDeleteTeacher = async (teacher) => {
    const dupeCount = teacher._allIds ? teacher._allIds.length : 1;
    const dupeNote  = dupeCount > 1 ? `\n(This will also delete ${dupeCount - 1} duplicate record(s) from the database.)` : '';
    if (!window.confirm(`⚠️ Permanently delete teacher "${teacher.name}"?\nThis cannot be undone.${dupeNote}`)) return;
    try {
      // Delete all duplicate rows for this canonical name
      const ids = teacher._allIds || [teacher.id];
      const results = await Promise.all(ids.map(id =>
        fetch(`${API_URL}/teachers/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token()}` },
        }).then(r => r.json())
      ));
      const anyFail = results.find(r => !r.success);
      if (anyFail) {
        alert('Some deletes failed: ' + anyFail.error);
      }
      fetchTeachers();
    } catch (e) {
      alert('Network error: ' + e.message);
    }
  };

  // ── Group channel actions ───────────────────────────────────────────────────
  const handleSaveGroupChannel = async (groupName) => {
    try {
      const res  = await fetch(`${API_URL}/group-channels`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_name: groupName, chat_id: groupChatInput.trim() }),
      });
      const data = await res.json();
      if (data.success) { setEditingGroupId(null); setGroupChatInput(''); fetchGroupChannels(); }
      else alert(`Error: ${data.error}`);
    } catch (e) { alert(`Error: ${e.message}`); }
  };

  const handleDeleteGroupChannel = async (groupName) => {
    if (!window.confirm(`Remove Telegram channel for group ${groupName}?`)) return;
    try {
      const url = `${API_URL}/group-channels/${encodeURIComponent(groupName)}`;
      console.log('DELETE', url);
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      console.log('Response status:', res.status);
      const text = await res.text();
      console.log('Response body:', text);
      let data;
      try { data = JSON.parse(text); } catch { data = { success: false, error: text }; }
      if (data.success) {
        fetchGroupChannels();
      } else {
        alert('Delete failed (HTTP ' + res.status + '):\n' + (data.error || text));
      }
    } catch (e) {
      alert('Network error: ' + e.message);
    }
  };

  if (loading) return <div className="loading">{t('loading') || 'Loading...'}</div>;

  const SECTIONS = [
    { id: 'teachers',  icon: '👨‍🏫', label: t('tabTeachers')       || 'Teachers'       },
    { id: 'groups',    icon: '👥',   label: t('tabGroupChannels')   || 'Group Channels' },
    { id: 'broadcast', icon: '📢',   label: t('tabBroadcast')       || 'Broadcast'      },
  ];

  return (
    <div className="teacher-telegram-management">

      {/* Header */}
      <div className="management-header">
        <h2>📱 {t('telegramNotifications') || 'Telegram Notifications'}</h2>
        <button onClick={fetchAll} className="btn-refresh" title={t('refresh') || 'Refresh'}>🔄</button>
      </div>

      {/* Section tabs */}
      <div className="section-tabs">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            className={`section-tab ${activeSection === s.id ? 'active' : ''}`}
            onClick={() => setActiveSection(s.id)}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          TEACHERS TAB
      ══════════════════════════════════════════════════════ */}
      {activeSection === 'teachers' && (
        <>
          <div className="info-box">
            <h3>ℹ️ {t('howToSetup') || 'How to Setup'}</h3>
            <ol>
              <li>{t('teacherSetupStep1') || 'Teachers open the bot and send /start'}</li>
              <li>{t('teacherSetupStep2') || 'They receive their Telegram ID — paste it below'}</li>
              <li>{t('teacherSetupStep3') || 'They get schedule-change alerts + 1-hour class reminders'}</li>
            </ol>
          </div>

          <div className="teachers-list">
            {teachers.length === 0 ? (
              <p className="no-teachers">{t('noTeachersFound') || 'No teachers found.'}</p>
            ) : (
              <table className="teachers-table">
                <thead>
                  <tr>
                    <th>{t('teacherName')    || 'Teacher Name'}</th>
                    <th>{t('telegramId')     || 'Telegram ID'}</th>
                    <th>{t('notifications')  || 'Notifications'}</th>
                    <th>{t('actions')        || 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map(teacher => (
                    <tr key={teacher.id}>

                      <td className="teacher-name">
                        {teacher.name}
                        {teacher._allIds && teacher._allIds.length > 1 && (
                          <span className="dupe-badge" title={`${teacher._allIds.length} duplicate records merged`}>
                            ×{teacher._allIds.length}
                          </span>
                        )}
                      </td>

                      {/* Telegram ID cell */}
                      <td>
                        {editingId === teacher.id ? (
                          <input
                            type="text"
                            value={telegramInput}
                            onChange={e => setTelegramInput(e.target.value)}
                            placeholder={t('telegramIdPlaceholder') || 'e.g. 1300165738'}
                            className="telegram-input"
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter')  handleSaveTelegramId(teacher.id);
                              if (e.key === 'Escape') { setEditingId(null); setTelegramInput(''); }
                            }}
                          />
                        ) : (
                          <span className={teacher.telegram_id ? 'has-id' : 'no-id'}>
                            {teacher.telegram_id || (t('notSet') || 'Not set')}
                          </span>
                        )}
                      </td>

                      {/* Status cell */}
                      <td>
                        <span className={`status ${teacher.telegram_id && teacher.notifications_enabled ? 'enabled' : 'disabled'}`}>
                          {teacher.telegram_id
                            ? (teacher.notifications_enabled
                                ? (t('notificationsOn')  || 'ON')
                                : (t('notificationsOff') || 'OFF'))
                            : '—'}
                        </span>
                      </td>

                      {/* ── ACTION BUTTONS ── */}
                      <td className="action-cell">
                        {editingId === teacher.id ? (
                          /* Editing mode: Save + Cancel */
                          <>
                            <button
                              onClick={() => handleSaveTelegramId(teacher.id)}
                              className="btn btn-save"
                            >
                              💾 {t('save') || 'Save'}
                            </button>
                            <button
                              onClick={() => { setEditingId(null); setTelegramInput(''); }}
                              className="btn btn-cancel"
                            >
                              ✕ {t('cancel') || 'Cancel'}
                            </button>
                          </>
                        ) : (
                          /* View mode: Edit + Delete */
                          <>
                            <button
                              onClick={() => { setEditingId(teacher.id); setTelegramInput(teacher.telegram_id || ''); }}
                              className="btn btn-edit"
                            >
                              ✏️ {t('edit') || 'Edit'}
                            </button>
                            {/* Delete Telegram ID button */}
                            <button
                              onClick={() => handleDeleteTelegramId(teacher.id, teacher.name)}
                              className="btn btn-delete"
                              disabled={!teacher.telegram_id}
                              title={!teacher.telegram_id ? 'No Telegram ID to remove' : 'Remove Telegram ID only'}
                            >
                              📵 {t('deleteTelegramId') || 'Remove ID'}
                            </button>
                            {/* Delete Teacher entirely button */}
                            <button
                              onClick={() => handleDeleteTeacher(teacher)}
                              className="btn btn-delete-teacher"
                              title="Delete this teacher from the database"
                            >
                              🗑️ {t('deleteTeacher') || 'Delete Teacher'}
                            </button>
                          </>
                        )}
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bot-commands">
            <h3>{t('botCommands') || 'Bot Commands for Teachers'}</h3>
            <ul>
              <li><code>/start</code>   — {t('cmdStart')   || 'Get your Telegram ID'}</li>
              <li><code>/status</code>  — {t('cmdStatus')  || 'Check registration status'}</li>
              <li><code>/enable</code>  — {t('cmdEnable')  || 'Enable notifications'}</li>
              <li><code>/disable</code> — {t('cmdDisable') || 'Disable notifications'}</li>
            </ul>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          GROUP CHANNELS TAB
      ══════════════════════════════════════════════════════ */}
      {activeSection === 'groups' && (
        <>
          <div className="info-box">
            <h3>ℹ️ {t('howToLinkGroup') || 'How to link a group channel'}</h3>
            <ol>
              <li>{t('groupSetupStep1') || 'Create a Telegram group or channel for each student group'}</li>
              <li>{t('groupSetupStep2') || 'Add your bot as an Admin'}</li>
              <li>
                {t('groupSetupStep3') || 'Get the chat ID (negative number, e.g.'} <code>-1001234567890</code>)
                {' '}{t('groupSetupStep3b') || 'via @getidsbot'}
              </li>
              <li>{t('groupSetupStep4') || 'Paste it here — students receive schedule changes automatically'}</li>
            </ol>
          </div>

          <div className="teachers-list">
            <table className="teachers-table">
              <thead>
                <tr>
                  <th>{t('group')        || 'Group'}</th>
                  <th>{t('telegramChatId') || 'Telegram Chat ID'}</th>
                  <th>{t('status')       || 'Status'}</th>
                  <th>{t('actions')      || 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 && (
                  <tr>
                    <td colSpan={4} className="no-teachers">
                      {t('noGroupChannels') || 'No group channels configured yet.'}
                    </td>
                  </tr>
                )}
                {groups.map(group => (
                  <tr key={group.group_name}>

                    <td className="teacher-name">{group.group_name}</td>

                    {/* Chat ID cell */}
                    <td>
                      {editingGroupId === group.group_name ? (
                        <input
                          type="text"
                          value={groupChatInput}
                          onChange={e => setGroupChatInput(e.target.value)}
                          placeholder={t('chatIdPlaceholder') || 'e.g. -1001234567890'}
                          className="telegram-input"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter')  handleSaveGroupChannel(group.group_name);
                            if (e.key === 'Escape') { setEditingGroupId(null); setGroupChatInput(''); }
                          }}
                        />
                      ) : (
                        <span className={group.chat_id ? 'has-id' : 'no-id'}>
                          {group.chat_id || (t('notSet') || 'Not set')}
                        </span>
                      )}
                    </td>

                    {/* Status cell */}
                    <td>
                      <span className={`status ${group.chat_id ? 'enabled' : 'disabled'}`}>
                        {group.chat_id
                          ? (t('linked')    || 'Linked')
                          : (t('notLinked') || 'Not linked')}
                      </span>
                    </td>

                    {/* ── ACTION BUTTONS ── */}
                    <td className="action-cell">
                      {editingGroupId === group.group_name ? (
                        /* Editing mode: Save + Cancel */
                        <>
                          <button
                            onClick={() => handleSaveGroupChannel(group.group_name)}
                            className="btn btn-save"
                          >
                            💾 {t('save') || 'Save'}
                          </button>
                          <button
                            onClick={() => { setEditingGroupId(null); setGroupChatInput(''); }}
                            className="btn btn-cancel"
                          >
                            ✕ {t('cancel') || 'Cancel'}
                          </button>
                        </>
                      ) : (
                        /* View mode: Edit + Delete */
                        <>
                          <button
                            onClick={() => { setEditingGroupId(group.group_name); setGroupChatInput(group.chat_id || ''); }}
                            className="btn btn-edit"
                          >
                            ✏️ {t('edit') || 'Edit'}
                          </button>
                          {/* Delete button — always shown, disabled when no chat_id */}
                          <button
                            onClick={() => handleDeleteGroupChannel(group.group_name)}
                            className="btn btn-delete"
                            disabled={!group.chat_id}
                            title={!group.chat_id ? (t('noIdToDelete') || 'No ID to delete') : (t('deleteGroupChannel') || 'Remove group channel')}
                          >
                            🗑️ {t('delete') || 'Delete'}
                          </button>
                        </>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          BROADCAST TAB
      ══════════════════════════════════════════════════════ */}
      {activeSection === 'broadcast' && <BroadcastMessage />}

    </div>
  );
};

export default TeacherTelegramManagement;