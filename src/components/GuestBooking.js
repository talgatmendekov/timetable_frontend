// src/components/GuestBooking.js
import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import './GuestBooking.css';

const GuestBooking = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    room: '',
    day: 'Monday',
    startTime: '08:00',
    duration: 1,
    purpose: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const TIMES = ['08:00', '08:45', '09:30', '10:15', '11:00', '11:45', '12:30', 
                 '13:10', '14:00', '14:45', '15:30', '16:15', '17:00', '17:45'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/booking-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSubmitted(true);
        setTimeout(() => {
          onClose();
          setSubmitted(false);
          setFormData({
            name: '', email: '', phone: '', room: '', day: 'Monday',
            startTime: '08:00', duration: 1, purpose: '',
          });
        }, 2000);
      } else {
        alert(t('bookingFailed') || 'Booking request failed. Please try again.');
      }
    } catch (error) {
      alert(t('bookingError') || 'Network error. Please check your connection.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content guest-booking-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🏫 {t('bookLab') || 'Book a Lab'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {submitted ? (
          <div className="booking-success">
            <div className="success-icon">✅</div>
            <h3>{t('bookingSubmitted') || 'Request Submitted!'}</h3>
            <p>{t('bookingSubmittedMsg') || 'Admin will review and approve your booking request.'}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>{t('yourName') || 'Your Name'} *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    required
                    placeholder={t('enterName') || 'Enter your name'}
                  />
                </div>

                <div className="form-group">
                  <label>{t('email') || 'Email'} *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    required
                    placeholder="example@mail.com"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{t('phone') || 'Phone'}</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    placeholder="+996..."
                  />
                </div>

                <div className="form-group">
                  <label>{t('roomNumber') || 'Room/Lab'} *</label>
                  <input
                    type="text"
                    value={formData.room}
                    onChange={e => setFormData({...formData, room: e.target.value})}
                    required
                    placeholder="BIGLAB, B107, etc."
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{t('day') || 'Day'} *</label>
                  <select
                    value={formData.day}
                    onChange={e => setFormData({...formData, day: e.target.value})}
                    required
                  >
                    {DAYS.map(day => (
                      <option key={day} value={day}>{t(day)}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>{t('startTime') || 'Start Time'} *</label>
                  <select
                    value={formData.startTime}
                    onChange={e => setFormData({...formData, startTime: e.target.value})}
                    required
                  >
                    {TIMES.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>{t('duration') || 'Duration'} *</label>
                  <select
                    value={formData.duration}
                    onChange={e => setFormData({...formData, duration: parseInt(e.target.value)})}
                    required
                  >
                    <option value={1}>1 {t('slot')} (40 min)</option>
                    <option value={2}>2 {t('slots')} (80 min)</option>
                    <option value={3}>3 {t('slots')} (120 min)</option>
                    <option value={4}>4 {t('slots')} (160 min)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>{t('purpose') || 'Purpose/Reason'} *</label>
                <textarea
                  value={formData.purpose}
                  onChange={e => setFormData({...formData, purpose: e.target.value})}
                  required
                  rows="3"
                  placeholder={t('describePurpose') || 'Describe why you need this lab...'}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" onClick={onClose} className="btn btn-secondary">
                {t('cancel')}
              </button>
              <button type="submit" className="btn btn-primary">
                📨 {t('submitRequest') || 'Submit Request'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default GuestBooking;
