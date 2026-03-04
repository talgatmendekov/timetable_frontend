// src/components/BookingManagement.js
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useSchedule } from '../context/ScheduleContext';
import './BookingManagement.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://timetablebackend-production.up.railway.app/api';
const getToken = () => localStorage.getItem('scheduleToken');

const BookingManagement = () => {
  const { t } = useLanguage();
  const { reload } = useSchedule();
  const [bookings, setBookings]  = useState([]);
  const [loading, setLoading]    = useState(true);
  const [filter, setFilter]      = useState('pending');

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/booking-requests`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) setBookings(data.data);
    } catch (err) {
      console.error('Error fetching bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBookings(); }, []);

  // ── Approve ────────────────────────────────────────────────────────────────
  const handleApprove = async (id) => {
    if (!window.confirm(t('confirmApproveBooking') || 'Approve this booking?')) return;
    try {
      const res  = await fetch(`${API_URL}/booking-requests/${id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body:    JSON.stringify({ status: 'approved' }),
      });
      const data = await res.json();
      if (data.success) {
        setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'approved' } : b));
        if (reload) await reload();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) { alert(`Error: ${err.message}`); }
  };

  // ── Reject ─────────────────────────────────────────────────────────────────
  const handleReject = async (id) => {
    if (!window.confirm(t('confirmRejectBooking') || 'Reject this booking?')) return;
    try {
      const res  = await fetch(`${API_URL}/booking-requests/${id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body:    JSON.stringify({ status: 'rejected' }),
      });
      const data = await res.json();
      if (data.success) {
        setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'rejected' } : b));
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) { alert(`Error: ${err.message}`); }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm(t('confirmDeleteBooking') || 'Delete this booking?')) return;
    try {
      const res  = await fetch(`${API_URL}/booking-requests/${id}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        setBookings(prev => prev.filter(b => b.id !== id)); // ← state only, no reload
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) { alert(`Error: ${err.message}`); }
  };

  const filteredBookings = bookings.filter(b => filter === 'all' || b.status === filter);
  const pendingCount     = bookings.filter(b => b.status === 'pending').length;

  if (loading) return <div className="booking-loading">⏳ Loading bookings...</div>;

  return (
    <div className="booking-management">
      <div className="booking-header">
        <h2>🏫 {t('labBookings') || 'Lab Booking Requests'}</h2>
        <button onClick={fetchBookings} className="btn-refresh">🔄 {t('refresh') || 'Refresh'}</button>
      </div>

      <div className="booking-filters">
        <button className={`filter-btn ${filter === 'pending'  ? 'active' : ''}`} onClick={() => setFilter('pending')}>
          ⏳ {t('pending')  || 'Pending'} {pendingCount > 0 && <span className="badge">{pendingCount}</span>}
        </button>
        <button className={`filter-btn ${filter === 'approved' ? 'active' : ''}`} onClick={() => setFilter('approved')}>
          ✅ {t('approved') || 'Approved'}
        </button>
        <button className={`filter-btn ${filter === 'rejected' ? 'active' : ''}`} onClick={() => setFilter('rejected')}>
          ❌ {t('rejected') || 'Rejected'}
        </button>
        <button className={`filter-btn ${filter === 'all'      ? 'active' : ''}`} onClick={() => setFilter('all')}>
          📋 {t('all')      || 'All'}
        </button>
      </div>

      {filteredBookings.length === 0 ? (
        <div className="no-bookings">
          <div className="no-bookings-icon">📭</div>
          <p>{t('noBookings') || 'No booking requests found'}</p>
        </div>
      ) : (
        <div className="booking-list">
          {filteredBookings.map(booking => (
            <div key={booking.id} className={`booking-card status-${booking.status}`}>

              <div className="booking-status-badge">
                {booking.status === 'pending'  && '⏳'}
                {booking.status === 'approved' && '✅'}
                {booking.status === 'rejected' && '❌'}
                {' '}{booking.status}
              </div>

              <div className="booking-info">
                <div className="booking-row">
                  <div className="booking-field">
                    <span className="field-label">👤 {t('name') || 'Name'}:</span>
                    <span className="field-value">{booking.name}</span>
                  </div>
                  <div className="booking-field">
                    <span className="field-label">📧 Email:</span>
                    <span className="field-value">{booking.email || '—'}</span>
                  </div>
                </div>

                {booking.phone && (
                  <div className="booking-field">
                    <span className="field-label">📞 {t('phone') || 'Phone'}:</span>
                    <span className="field-value">{booking.phone}</span>
                  </div>
                )}

                {booking.entity && (
                  <div className="booking-field">
                    <span className="field-label">🏢 Entity:</span>
                    <span className="field-value">{booking.entity}</span>
                  </div>
                )}

                <div className="booking-row">
                  <div className="booking-field">
                    <span className="field-label">🚪 {t('room') || 'Room'}:</span>
                    <span className="field-value highlight">{booking.room}</span>
                  </div>
                  <div className="booking-field">
                    <span className="field-label">📅 {t('day') || 'Day'}:</span>
                    <span className="field-value">{t(booking.day) || booking.day}</span>
                  </div>
                  <div className="booking-field">
                    <span className="field-label">⏰ Start:</span>
                    <span className="field-value">{booking.start_time}</span>
                  </div>
                  <div className="booking-field">
                    <span className="field-label">⏱ End:</span>
                    <span className="field-value">{booking.end_time || '—'}</span>
                  </div>
                </div>

                <div className="booking-field full-width">
                  <span className="field-label">📝 {t('purpose') || 'Purpose'}:</span>
                  <p className="field-value purpose">{booking.purpose}</p>
                </div>

                <div className="booking-meta">
                  <small>Submitted: {new Date(booking.created_at).toLocaleString()}</small>
                </div>
              </div>

              <div className="booking-actions">
                {booking.status === 'pending' && (
                  <>
                    <button onClick={() => handleApprove(booking.id)} className="btn btn-approve">
                      ✅ {t('approve') || 'Approve'}
                    </button>
                    <button onClick={() => handleReject(booking.id)} className="btn btn-reject">
                      ❌ {t('reject') || 'Reject'}
                    </button>
                  </>
                )}
                <button onClick={() => handleDelete(booking.id)} className="btn btn-delete">
                  🗑️ {t('delete') || 'Delete'}
                </button>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BookingManagement;