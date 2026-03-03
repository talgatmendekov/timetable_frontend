// src/components/GuestBooking.js
import React, { useState, useEffect } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { useLanguage } from '../context/LanguageContext';

const API_URL = process.env.REACT_APP_API_URL || 'https://timetablebackend-production.up.railway.app/api';

const GuestBooking = ({
  isOpen, onClose, onBooked,
  prefilledGroup = '', prefilledDay = '', prefilledTime = '',
}) => {
  const { days, timeSlots } = useSchedule();
  const { t } = useLanguage();

  const [form, setForm] = useState({
    name: '', phone: '', day: '',
    start_time: '', end_time: '', purpose: '', room: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]           = useState('');

  // Pre-fill when opened from cell click
  useEffect(() => {
    if (isOpen) {
      setForm(prev => ({
        ...prev,
        day:        prefilledDay   || prev.day,
        start_time: prefilledTime  || prev.start_time,
      }));
      setSubmitted(false);
      setError('');
    }
  }, [isOpen, prefilledGroup, prefilledDay, prefilledTime]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async () => {
    setError('');
    if (!form.name.trim()) { setError('Please enter your name'); return; }
    if (!form.room.trim())    { setError('Please enter a room'); return; }
    if (!form.day)               { setError('Please select a day'); return; }
    if (!form.start_time)        { setError('Please select a time'); return; }
    if (!form.purpose.trim())    { setError('Please enter a purpose'); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/booking-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          group_name: prefilledGroup || '',
          day: form.day,
          start_time: form.start_time,
          end_time: form.end_time,
          purpose: form.purpose.trim(),
          room: form.room.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        if (onBooked) onBooked(data.data);
      } else {
        setError(data.error || 'Submission failed');
      }
    } catch (e) {
      setError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const inputStyle = {
    width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0',
    borderRadius:8, fontSize:'0.9rem', color:'#374151', background:'#fff',
    outline:'none', boxSizing:'border-box', marginTop:4,
  };
  const labelStyle = { fontSize:'0.82rem', fontWeight:600, color:'#374151', display:'block' };
  const fieldStyle = { marginBottom:14 };

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
      zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16,
    }}>
      <div style={{
        background:'#fff', borderRadius:16, padding:28, width:'100%', maxWidth:480,
        maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.25)',
      }}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <h2 style={{margin:0,fontSize:'1.2rem',color:'#0f172a'}}>🏫 {t('bookLab')||'Book a Lab'}</h2>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:'1.4rem',cursor:'pointer',color:'#64748b'}}>×</button>
        </div>

        {submitted ? (
          <div style={{textAlign:'center',padding:'24px 0'}}>
            <div style={{fontSize:'2.5rem',marginBottom:12}}>✅</div>
            <h3 style={{color:'#166534',marginBottom:8}}>{t('bookingSubmitted')||'Request Submitted!'}</h3>
            <p style={{color:'#64748b',fontSize:'0.9rem',marginBottom:20}}>
              {t('bookingSubmittedMsg')||'Admin will review and approve your request. You can see the status in yellow on the schedule.'}
            </p>
            <button onClick={onClose} style={{
              padding:'10px 24px',background:'#4f46e5',color:'#fff',border:'none',
              borderRadius:10,fontSize:'0.95rem',fontWeight:700,cursor:'pointer',
            }}>Close</button>
          </div>
        ) : (
          <>
            {/* Pre-filled info badge */}
            {(prefilledGroup || prefilledDay || prefilledTime) && (
              <div style={{
                background:'#eef2ff',border:'1.5px solid #c7d2fe',borderRadius:10,
                padding:'8px 14px',marginBottom:16,fontSize:'0.85rem',color:'#3730a3',
              }}>
                📅 Booking for: <strong>{prefilledGroup}</strong> — {prefilledDay} at <strong>{prefilledTime}</strong>
              </div>
            )}

            {error && (
              <div style={{background:'#fff1f2',border:'1px solid #fecdd3',borderRadius:8,padding:'8px 12px',marginBottom:14,color:'#be123c',fontSize:'0.88rem'}}>
                ⚠️ {error}
              </div>
            )}

            <div style={fieldStyle}>
              <label style={labelStyle}>{t('yourName')||'Your Name'} *</label>
              <input style={inputStyle} placeholder={t('enterName')||'Enter your name'} value={form.name} onChange={e=>set('name',e.target.value)} />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>{t('phone')||'Phone'}</label>
              <input style={inputStyle} placeholder="+996 XXX XXX XXX" value={form.phone} onChange={e=>set('phone',e.target.value)} />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>{t('selectDay')||'Day'} *</label>
              <select style={inputStyle} value={form.day} onChange={e=>set('day',e.target.value)}>
                <option value="">Select day</option>
                {days.map(d=><option key={d} value={d}>{t(d)||d}</option>)}
              </select>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
              <div>
                <label style={labelStyle}>{t('startTime')||'Start Time'} *</label>
                <select style={inputStyle} value={form.start_time} onChange={e=>set('start_time',e.target.value)}>
                  <option value="">Select time</option>
                  {timeSlots.map(tm=><option key={tm} value={tm}>{tm}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>End Time</label>
                <select style={inputStyle} value={form.end_time} onChange={e=>set('end_time',e.target.value)}>
                  <option value="">Optional</option>
                  {timeSlots.map(tm=><option key={tm} value={tm}>{tm}</option>)}
                </select>
              </div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Room *</label>
              <input style={inputStyle} placeholder="e.g. B201" value={form.room} onChange={e=>set('room',e.target.value)} />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>{t('purpose')||'Purpose'} *</label>
              <textarea style={{...inputStyle, minHeight:80, resize:'vertical'}}
                placeholder={t('describePurpose')||'Describe why you need this lab...'}
                value={form.purpose} onChange={e=>set('purpose',e.target.value)}
              />
            </div>

            <button
              onClick={handleSubmit} disabled={submitting}
              style={{
                width:'100%', padding:'11px', background: submitting ? '#94a3b8' : '#4f46e5',
                color:'#fff', border:'none', borderRadius:10,
                fontSize:'1rem', fontWeight:700, cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? '⏳ Submitting...' : `📤 ${t('submitRequest')||'Submit Request'}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default GuestBooking;