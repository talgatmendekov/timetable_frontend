// src/components/GuestBookingStatus.js
// Shows guest their own submitted bookings with live status (pending/approved/rejected)
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import './GuestBookingStatus.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://timetablebackend-production.up.railway.app/api';

const GuestBookingStatus = ({ bookings = [], onRefresh }) => {
  const { t } = useLanguage();
  const [email, setEmail]       = useState(() => localStorage.getItem('guestEmail') || '');
  const [input, setInput]       = useState('');
  const [myBookings, setMy]     = useState([]);
  const [checking, setChecking] = useState(false);
  const [searched, setSearched] = useState(false);

  // Auto-filter when email is already saved
  useEffect(() => {
    if (email && bookings.length > 0) {
      filterByEmail(email, bookings);
    }
  }, [email, bookings]);

  const filterByEmail = (em, list) => {
    const filtered = list.filter(b =>
      b.email && b.email.toLowerCase() === em.toLowerCase()
    );
    setMy(filtered);
    setSearched(true);
  };

  const handleCheck = async () => {
    const em = input.trim().toLowerCase();
    if (!em) return;
    if (!em.endsWith('@alatoo.edu.kg')) {
      alert('Please enter your @alatoo.edu.kg email');
      return;
    }
    setChecking(true);
    try {
      const res  = await fetch(`${API_URL}/booking-requests`);
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('guestEmail', em);
        setEmail(em);
        filterByEmail(em, data.data || []);
        if (onRefresh) onRefresh(data.data || []);
      }
    } catch { /* ignore */ }
    finally { setChecking(false); }
  };

  const statusConfig = {
    pending:  { bg: '#fef9c3', border: '#eab308', icon: '⏳', label: 'Pending Review',    text: '#854d0e' },
    approved: { bg: '#dcfce7', border: '#22c55e', icon: '✅', label: 'Approved',           text: '#166534' },
    rejected: { bg: '#fff1f2', border: '#ef4444', icon: '❌', label: 'Rejected',           text: '#be123c' },
  };

  return (
    <div className="gbs-wrap">
      <div className="gbs-header">
        <div className="gbs-header-icon">🏫</div>
        <div>
          <div className="gbs-title">My Booking Requests</div>
          <div className="gbs-sub">Track your lab booking status</div>
        </div>
      </div>

      {/* Email lookup */}
      {!email ? (
        <div className="gbs-lookup">
          <div className="gbs-lookup-hint">
            Enter your university email to see your booking status
          </div>
          <div className="gbs-lookup-row">
            <input
              className="gbs-input"
              type="email"
              placeholder="yourname@alatoo.edu.kg"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCheck()}
            />
            <button
              className="gbs-btn"
              onClick={handleCheck}
              disabled={checking}
            >
              {checking ? '...' : 'Check Status'}
            </button>
          </div>
        </div>
      ) : (
        <div className="gbs-email-bar">
          <span>📧 Showing bookings for <strong>{email}</strong></span>
          <button className="gbs-change" onClick={() => {
            setEmail(''); setInput(''); setMy([]); setSearched(false);
            localStorage.removeItem('guestEmail');
          }}>Change</button>
        </div>
      )}

      {/* Results */}
      {searched && (
        myBookings.length === 0 ? (
          <div className="gbs-empty">
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>📭</div>
            <div>No bookings found for this email.</div>
          </div>
        ) : (
          <div className="gbs-list">
            {myBookings.map(b => {
              const cfg = statusConfig[b.status] || statusConfig.pending;
              return (
                <div
                  key={b.id}
                  className="gbs-card"
                  style={{ borderLeft: `4px solid ${cfg.border}`, background: cfg.bg }}
                >
                  {/* Status badge */}
                  <div className="gbs-card-top">
                    <div className="gbs-status" style={{ color: cfg.text, background: `${cfg.border}22` }}>
                      {cfg.icon} {cfg.label}
                    </div>
                    <div className="gbs-card-date">
                      {new Date(b.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="gbs-card-body">
                    <div className="gbs-detail-grid">
                      <div className="gbs-detail">
                        <span className="gbs-dlbl">🚪 Room</span>
                        <span className="gbs-dval highlight">{b.room}</span>
                      </div>
                      <div className="gbs-detail">
                        <span className="gbs-dlbl">📅 Day</span>
                        <span className="gbs-dval">{b.day}</span>
                      </div>
                      <div className="gbs-detail">
                        <span className="gbs-dlbl">⏰ Time</span>
                        <span className="gbs-dval">{b.start_time} – {b.end_time}</span>
                      </div>
                      {b.entity && (
                        <div className="gbs-detail">
                          <span className="gbs-dlbl">🏢 Entity</span>
                          <span className="gbs-dval">{b.entity}</span>
                        </div>
                      )}
                    </div>
                    <div className="gbs-purpose">
                      <span className="gbs-dlbl">📝 Purpose: </span>
                      {b.purpose}
                    </div>

                    {/* Status message */}
                    {b.status === 'pending' && (
                      <div className="gbs-msg pending">
                        ⏳ Your request is under review. The admin will approve or reject it soon.
                        It will appear as a <strong>yellow cell</strong> on the schedule.
                      </div>
                    )}
                    {b.status === 'approved' && (
                      <div className="gbs-msg approved">
                        ✅ Your booking is confirmed! The room is reserved and shown as a
                        <strong> green cell</strong> on the schedule for your time slot.
                      </div>
                    )}
                    {b.status === 'rejected' && (
                      <div className="gbs-msg rejected">
                        ❌ Your request was not approved. Please submit a new request with a
                        different room or time.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
};

export default GuestBookingStatus;