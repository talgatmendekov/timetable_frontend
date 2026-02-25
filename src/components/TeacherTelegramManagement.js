// Frontend: src/components/TeacherTelegramManagement.js
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import './TeacherTelegramManagement.css';

const TeacherTelegramManagement = () => {
  const { t } = useLanguage();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [telegramInput, setTelegramInput] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('scheduleToken');
      const response = await fetch(`${API_URL}/teachers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setTeachers(data.data);
      }
    } catch (error) {
      console.error('Error fetching teachers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const handleSaveTelegramId = async (id) => {
    try {
      const token = localStorage.getItem('scheduleToken');
      const response = await fetch(`${API_URL}/teachers/${id}/telegram`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ telegram_id: telegramInput })
      });
      
      const data = await response.json();
      if (data.success) {
        alert(t('telegramIdSaved') || 'Telegram ID saved!');
        setEditingId(null);
        setTelegramInput('');
        fetchTeachers();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const startEdit = (teacher) => {
    setEditingId(teacher.id);
    setTelegramInput(teacher.telegram_id || '');
  };

  if (loading) {
    return <div className="loading">Loading teachers...</div>;
  }

  return (
    <div className="teacher-telegram-management">
      <div className="management-header">
        <h2>ðŸ“± {t('telegramNotifications') || 'Telegram Notifications'}</h2>
        <button onClick={fetchTeachers} className="btn-refresh">ðŸ”„</button>
      </div>

      <div className="info-box">
        <h3>â„¹ï¸ {t('howToSetup') || 'How to Setup'}</h3>
        <ol>
          <li>{t('step1') || 'Create a Telegram bot using @BotFather'}</li>
          <li>{t('step2') || 'Set TELEGRAM_BOT_TOKEN in Railway environment variables'}</li>
          <li>{t('step3') || 'Teachers should start the bot and send /start command'}</li>
          <li>{t('step4') || 'Copy their Telegram ID and paste it here'}</li>
          <li>{t('step5') || 'Teachers will receive notifications 1 hour before classes'}</li>
        </ol>
      </div>

      <div className="teachers-list">
        {teachers.length === 0 ? (
          <div className="no-teachers">
            <p>{t('noTeachersFound') || 'No teachers found. Teachers are auto-created when you add classes.'}</p>
          </div>
        ) : (
          <table className="teachers-table">
            <thead>
              <tr>
                <th>{t('teacherName') || 'Teacher Name'}</th>
                <th>{t('telegramId') || 'Telegram ID'}</th>
                <th>{t('notifications') || 'Notifications'}</th>
                <th>{t('actions') || 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map(teacher => (
                <tr key={teacher.id}>
                  <td className="teacher-name">ðŸ‘¨â€ðŸ« {teacher.name}</td>
                  <td>
                    {editingId === teacher.id ? (
                      <input
                        type="text"
                        value={telegramInput}
                        onChange={(e) => setTelegramInput(e.target.value)}
                        placeholder="123456789"
                        className="telegram-input"
                      />
                    ) : (
                      <span className={teacher.telegram_id ? 'has-id' : 'no-id'}>
                        {teacher.telegram_id || t('notSet') || 'Not set'}
                      </span>
                    )}
                  </td>
                  <td>
                    {teacher.telegram_id ? (
                      <span className={`status ${teacher.notifications_enabled ? 'enabled' : 'disabled'}`}>
                        {teacher.notifications_enabled ? 'âœ… ON' : 'âŒ OFF'}
                      </span>
                    ) : (
                      <span className="status disabled">â€”</span>
                    )}
                  </td>
                  <td>
                    {editingId === teacher.id ? (
                      <>
                        <button
                          onClick={() => handleSaveTelegramId(teacher.id)}
                          className="btn btn-save"
                        >
                          ðŸ’¾ {t('save') || 'Save'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setTelegramInput('');
                          }}
                          className="btn btn-cancel"
                        >
                          {t('cancel') || 'Cancel'}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => startEdit(teacher)}
                        className="btn btn-edit"
                      >
                        âœï¸ {t('edit') || 'Edit'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bot-commands">
        <h3>ðŸ¤– {t('botCommands') || 'Bot Commands for Teachers'}</h3>
        <ul>
          <li><code>/start</code> - {t('cmdStart') || 'Get your Telegram ID'}</li>
          <li><code>/status</code> - {t('cmdStatus') || 'Check registration status'}</li>
          <li><code>/enable</code> - {t('cmdEnable') || 'Enable notifications'}</li>
          <li><code>/disable</code> - {t('cmdDisable') || 'Disable notifications'}</li>
        </ul>
      </div>
    </div>
  );
};

export default TeacherTelegramManagement;