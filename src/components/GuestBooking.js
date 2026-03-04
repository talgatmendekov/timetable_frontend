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

  const emptyForm = {
    name: '', email: '', phone: '', entity: '',
    day: '', start_time: '', end_time: '', purpose: '', room: '',
  };

  const [form,       setForm]       = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [error,      setError]      = useState('');

  // Pre-fill day/time when opened from a cell click
  useEffect(() => {
    if (isOpen) {
      setForm(prev => ({
        ...emptyForm,
        day:        prefilledDay  || '',
        start_time: prefilledTime || '',
      }));
      setSubmitted(false);
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, prefilledDay, prefilledTime]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async () => {
    setError('');

    // ── Validation ──────────────────────────────────────────────────────────
    if (!form.name.trim())
      return setError('Name is required');
    if (!form.email.trim())
      return setError('Email is required');
    if (!form.email.toLowerCase().endsWith('@alatoo.edu.kg'))
      return setError('Only @alatoo.edu.kg corporate emails are permitted to book');
    if (!form.day)
      return setError('Day is required');
    if (!form.start_time)
      return setError('Start time is required');
    if (!form.end_time)
      return setError('End time is required');
    if (!form.room.trim())
      return setError('Room is required');
    if (!form.purpose.trim())
      return setError('Purpose is required');

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/booking-requests`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:       form.name.trim(),
          email:      form.email.trim().toLowerCase(),
          phone:      form.phone.trim(),
          entity:     form.entity.trim(),
          day:        form.day,
          start_time: form.start_time,
          end_time:   form.end_time,
          purpose:    form.purpose.trim(),
          room:       form.room.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        if (onBooked) onBooked(data.data);
      } else {
        setError(data.error || 'Submission failed');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // ── Styles ─────────────────────────────────────────────────────────────────
  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
    zIndex: 1000, display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: 16,
  };
  const card = {
    background: '#fff', borderRadius: 16, padding: '28px 28px 24px',
    width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  };
  const inp = {
    width: '100%', padding: '9px 12px', marginTop: 4,
    border: '1.5px solid #e2e8f0', borderRadius: 8,
    fontSize: '0.9rem', color: '#1e293b', background: '#fff',
    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
    transition: 'border-color 0.14s',
  };
  const lbl = { fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block' };
  const req = { color: '#ef4444', marginLeft: 2 };
  const row = { marginBottom: 14 };
  const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 };

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={card}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div>
            <h2 style={{ margin:0, fontSize:'1.15rem', fontWeight:800, color:'#0f172a' }}>
              🏫 {t('bookLab') || 'Book a Lab Room'}
            </h2>
            <p style={{ margin:'3px 0 0', fontSize:'0.75rem', color:'#64748b' }}>
              Only @alatoo.edu.kg email addresses may book
            </p>
          </div>
          <button onClick={onClose} style={{
            background:'none', border:'none', fontSize:'1.5rem',
            cursor:'pointer', color:'#94a3b8', lineHeight:1, padding:4,
          }}>×</button>
        </div>

        {/* ── Success state ── */}
        {submitted ? (
          <div style={{ textAlign:'center', padding:'24px 0' }}>
            <div style={{ fontSize:'2.8rem', marginBottom:12 }}>✅</div>
            <h3 style={{ color:'#166534', marginBottom:8, fontSize:'1.1rem' }}>Request Submitted!</h3>
            <p style={{ color:'#64748b', fontSize:'0.88rem', marginBottom:20, lineHeight:1.5 }}>
              Your booking is pending admin approval.<br/>
              It will appear in <strong style={{color:'#ca8a04'}}>yellow</strong> on the schedule until approved.
            </p>
            <button onClick={onClose} style={{
              padding:'10px 28px', background:'#4f46e5', color:'#fff',
              border:'none', borderRadius:10, fontSize:'0.95rem',
              fontWeight:700, cursor:'pointer',
            }}>Close</button>
          </div>
        ) : (
          <>
            {/* Pre-fill badge */}
            {(prefilledDay || prefilledTime) && (
              <div style={{
                background:'#eef2ff', border:'1.5px solid #c7d2fe',
                borderRadius:10, padding:'8px 14px', marginBottom:16,
                fontSize:'0.84rem', color:'#3730a3',
              }}>
                📅 {prefilledGroup && <><strong>{prefilledGroup}</strong> — </>}
                {prefilledDay}{prefilledTime && <> at <strong>{prefilledTime}</strong></>}
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{
                background:'#fff1f2', border:'1px solid #fecdd3',
                borderRadius:8, padding:'9px 13px', marginBottom:14,
                color:'#be123c', fontSize:'0.86rem', fontWeight:500,
              }}>
                ⚠️ {error}
              </div>
            )}

            {/* Name */}
            <div style={row}>
              <label style={lbl}>Full Name <span style={req}>*</span></label>
              <input style={inp} placeholder="Your full name"
                value={form.name} onChange={e => set('name', e.target.value)} />
            </div>

            {/* Email */}
            <div style={row}>
              <label style={lbl}>
                University Email <span style={req}>*</span>
                <span style={{ fontWeight:400, color:'#94a3b8', marginLeft:6 }}>
                  must end with @alatoo.edu.kg
                </span>
              </label>
              <input
                style={{
                  ...inp,
                  borderColor: form.email && !form.email.toLowerCase().endsWith('@alatoo.edu.kg')
                    ? '#ef4444' : '#e2e8f0',
                }}
                type="email"
                placeholder="yourname@alatoo.edu.kg"
                value={form.email}
                onChange={e => set('email', e.target.value)}
              />
              {form.email && !form.email.toLowerCase().endsWith('@alatoo.edu.kg') && (
                <span style={{ fontSize:'0.75rem', color:'#ef4444', marginTop:3, display:'block' }}>
                  ✗ Only @alatoo.edu.kg emails permitted
                </span>
              )}
              {form.email && form.email.toLowerCase().endsWith('@alatoo.edu.kg') && (
                <span style={{ fontSize:'0.75rem', color:'#16a34a', marginTop:3, display:'block' }}>
                  ✓ Valid university email
                </span>
              )}
            </div>

            {/* Phone + Entity */}
            <div style={grid2}>
              <div>
                <label style={lbl}>Phone</label>
                <input style={inp} placeholder="+996 XXX XXX XXX"
                  value={form.phone} onChange={e => set('phone', e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Department / Entity</label>
                <input style={inp} placeholder="e.g. CS Dept, Lab 3"
                  value={form.entity} onChange={e => set('entity', e.target.value)} />
              </div>
            </div>

            {/* Day + Room */}
            <div style={grid2}>
              <div>
                <label style={lbl}>Day <span style={req}>*</span></label>
                <select style={inp} value={form.day} onChange={e => set('day', e.target.value)}>
                  <option value="">Select day</option>
                  {days.map(d => <option key={d} value={d}>{t(d) || d}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Room <span style={req}>*</span></label>
                <input style={inp} placeholder="e.g. B201"
                  value={form.room} onChange={e => set('room', e.target.value)} />
              </div>
            </div>

            {/* Start + End time */}
            <div style={grid2}>
              <div>
                <label style={lbl}>Start Time <span style={req}>*</span></label>
                <select style={inp} value={form.start_time} onChange={e => set('start_time', e.target.value)}>
                  <option value="">Select time</option>
                  {timeSlots.map(tm => <option key={tm} value={tm}>{tm}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>End Time <span style={req}>*</span></label>
                <select style={inp} value={form.end_time} onChange={e => set('end_time', e.target.value)}>
                  <option value="">Select time</option>
                  {timeSlots.map(tm => <option key={tm} value={tm}>{tm}</option>)}
                </select>
              </div>
            </div>

            {/* Purpose */}
            <div style={row}>
              <label style={lbl}>Purpose <span style={req}>*</span></label>
              <textarea
                style={{ ...inp, minHeight:72, resize:'vertical' }}
                placeholder="Describe why you need this room (class, exam, event...)"
                value={form.purpose}
                onChange={e => set('purpose', e.target.value)}
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                width:'100%', padding:'12px',
                background: submitting ? '#94a3b8' : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                color:'#fff', border:'none', borderRadius:10,
                fontSize:'1rem', fontWeight:700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                boxShadow: submitting ? 'none' : '0 4px 14px rgba(79,70,229,.35)',
                transition: 'all 0.15s',
              }}
            >
              {submitting ? '⏳ Submitting...' : '📤 Submit Booking Request'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default GuestBooking;