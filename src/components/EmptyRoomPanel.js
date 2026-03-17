// src/components/EmptyRoomPanel.js
import React, { useState, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import './EmptyRoomPanel.css';

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const getTodayName = () => DAY_NAMES[new Date().getDay()];

const getCurrentTimeSlot = (timeSlots) => {
  if (!timeSlots?.length) return null;
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  for (const slot of timeSlots) {
    const match = slot.match(/(\d{1,2}):(\d{2})/);
    if (!match) continue;
    const slotMins = parseInt(match[1]) * 60 + parseInt(match[2]);
    if (Math.abs(nowMins - slotMins) <= 60) return slot;
  }
  return timeSlots[0];
};

const normalizeRoom = (r) => r?.trim().toUpperCase() || '';

const EmptyRoomPanel = ({
  allRooms    = [],
  schedule    = {},
  days        = [],
  timeSlots   = [],
  selectedRoom,
  setSelectedRoom,
}) => {
  const { t }            = useLanguage();
  const [open, setOpen]  = useState(false);
  const [selDay, setDay] = useState('');
  const [search, setSrc] = useState('');

  const todayName   = getTodayName();
  const currentSlot = getCurrentTimeSlot(timeSlots);

  // ── Deduplicate rooms by normalized name ───────────────────────────────────
  const normalizedRooms = useMemo(() => {
    const seen = new Map();
    allRooms.forEach(r => {
      const key = normalizeRoom(r);
      if (key && !seen.has(key)) seen.set(key, r.trim());
    });
    return Array.from(seen.entries()).map(([key, display]) => ({ key, display }));
  }, [allRooms]);

  // ── Occupancy map ──────────────────────────────────────────────────────────
  const occupancy = useMemo(() => {
    const map = {};
    normalizedRooms.forEach(({ key }) => {
      map[key] = {};
      days.forEach(d => { map[key][d] = {}; });
    });
    Object.values(schedule).forEach(e => {
      if (!e.room) return;
      const key = normalizeRoom(e.room);
      if (!map[key]) return;
      if (!map[key][e.day]) map[key][e.day] = {};
      const dur = Math.min(6, Math.max(1, parseInt(e.duration) || 1));
      const idx = timeSlots.indexOf(e.time);
      for (let i = 0; i < dur; i++) {
        const tm = timeSlots[idx + i];
        if (tm) map[key][e.day][tm] = { course: e.course, teacher: e.teacher };
      }
    });
    return map;
  }, [normalizedRooms, schedule, days, timeSlots]);

  // ── Free right now ─────────────────────────────────────────────────────────
  const isToday = days.includes(todayName);

  const freeNowRooms = useMemo(() => {
    if (!currentSlot || !isToday) return normalizedRooms;
    return normalizedRooms.filter(({ key }) => !occupancy[key]?.[todayName]?.[currentSlot]);
  }, [normalizedRooms, occupancy, todayName, currentSlot, isToday]);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const daysFilter = selDay ? [selDay] : days;
    const total = normalizedRooms.length * daysFilter.length * timeSlots.length;
    let busy = 0;
    normalizedRooms.forEach(({ key }) => {
      daysFilter.forEach(d => {
        timeSlots.forEach(tm => { if (occupancy[key]?.[d]?.[tm]) busy++; });
      });
    });
    return { total, busy, free: total - busy,
      pct: total > 0 ? Math.round(((total - busy) / total) * 100) : 0 };
  }, [normalizedRooms, occupancy, days, timeSlots, selDay]);

  // ── Filtered rooms for heatmap ─────────────────────────────────────────────
  const filteredRooms = useMemo(() =>
    normalizedRooms.filter(({ display }) =>
      display.toLowerCase().includes(search.toLowerCase())
    ),
    [normalizedRooms, search]
  );

  const cellColor = (occ) =>
    occ ? { bg: '#fee2e2', text: '#991b1b' } : { bg: '#dcfce7', text: '#166634' };

  const daysToShow = selDay ? [selDay] : days;

  const handleSelectRoom = (displayName) => {
    const normalized = normalizeRoom(displayName);
    const currentNormalized = normalizeRoom(selectedRoom);
    setSelectedRoom(normalized === currentNormalized ? '' : displayName);
  };

  return (
    <>
      {/* ── Trigger bar ───────────────────────────────────────────────────── */}
      <div className="erp-trigger-bar">
        <div className="erp-trigger-stats">
          <span className="erp-stat-pill free">{summary.free} {t('freeSlots') || 'free slots'}</span>
          <span className="erp-stat-pill busy">{summary.busy} {t('busySlots') || 'busy'}</span>
          <span className="erp-stat-pill rooms">{normalizedRooms.length} {t('rooms') || 'rooms'}</span>
          {normalizedRooms.length > 0 && currentSlot && isToday && (
            <span className="erp-stat-pill now">🚪 {freeNowRooms.length} {t('freeNow') || 'free now'}</span>
          )}
        </div>
        <div className="erp-trigger-actions">
          {selectedRoom && (
            <div className="erp-active-filter">
              {normalizeRoom(selectedRoom)}
              <button onClick={() => setSelectedRoom('')} className="erp-clear-btn">✕</button>
            </div>
          )}
          <button className="erp-open-btn" onClick={() => setOpen(true)}>
            🗓 {t('roomHeatmap') || 'Room Heatmap'}
          </button>
        </div>
      </div>

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      {open && (
        <div className="erp-overlay" onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div className="erp-modal">

            <div className="erp-modal-header">
              <div>
                <div className="erp-modal-title">{t('roomAvailability') || 'Room Availability'}</div>
                <div className="erp-modal-sub">
                  {normalizedRooms.length} {t('rooms') || 'rooms'} · {summary.pct}% {t('free') || 'available'}
                </div>
              </div>
              <button className="erp-close-btn" onClick={() => setOpen(false)}>✕</button>
            </div>

            <div className="erp-modal-controls">
              <input
                className="erp-search"
                placeholder={t('searchRoom') || 'Search room…'}
                value={search}
                onChange={e => setSrc(e.target.value)}
              />
              <div className="erp-day-tabs">
                <button
                  className={`erp-day-tab ${selDay === '' ? 'active' : ''}`}
                  onClick={() => setDay('')}
                >
                  {t('allDaysTab') || 'All'}
                </button>
                {days.map(d => (
                  <button
                    key={d}
                    className={`erp-day-tab ${selDay === d ? 'active' : ''}`}
                    onClick={() => setDay(d)}
                  >
                    {t(d) || d}
                  </button>
                ))}
              </div>
            </div>

            <div className="erp-modal-body">

              {/* ── FREE RIGHT NOW ── */}
              {normalizedRooms.length > 0 && currentSlot && isToday && (
                <div className="erp-free-now-section">
                  <div className="erp-free-now-header">
                    <span className="erp-free-now-title">{t('freeRightNow') || '🚪 Free right now'}</span>
                    <span className="erp-free-now-meta">{t(todayName) || todayName} · {currentSlot}</span>
                  </div>
                  <div className="erp-free-now-rooms">
                    {freeNowRooms.length === 0
                      ? <span className="erp-free-now-empty">{t('allRoomsInUse') || 'All rooms currently in use'}</span>
                      : freeNowRooms.map(({ key, display }) => (
                        <button
                          key={key}
                          className={`erp-now-pill${normalizeRoom(selectedRoom) === key ? ' selected' : ''}`}
                          onClick={() => { handleSelectRoom(display); setOpen(false); }}
                        >{normalizeRoom(display)}</button>
                      ))
                    }
                  </div>
                </div>
              )}

              {/* ── Heatmap ── */}
              <div className="erp-heatmap-wrap">
                <div className="erp-panel-head">
                  {t('heatmapTitle') || 'Heatmap'}
                  <span className="erp-legend">
                    <span className="erp-leg-item free">■ {t('free') || 'Free'}</span>
                    <span className="erp-leg-item busy">■ {t('busy') || 'Busy'}</span>
                  </span>
                </div>
                <div className="erp-heatmap-scroll">
                  <table className="erp-heatmap-table">
                    <thead>
                      <tr>
                        <th className="erp-th-room">{t('room') || 'Room'}</th>
                        {daysToShow.map(d =>
                          timeSlots.map(tm => (
                            <th key={`${d}-${tm}`} className="erp-th-slot">
                              <div className="erp-th-day">{(t(d)||d).slice(0,3)}</div>
                              <div className="erp-th-time">{tm}</div>
                            </th>
                          ))
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRooms.map(({ key, display }) => {
                        const isSelected = normalizeRoom(selectedRoom) === key;
                        return (
                          <tr
                            key={key}
                            className={isSelected ? 'erp-hm-selected' : ''}
                            onClick={() => { handleSelectRoom(display); setOpen(false); }}
                            style={{ cursor: 'pointer' }}
                          >
                            <td className="erp-hm-room" style={{ color: isSelected ? '#4f46e5' : undefined }}>
                              {normalizeRoom(display)}
                            </td>
                            {daysToShow.map(d =>
                              timeSlots.map(tm => {
                                const occ = occupancy[key]?.[d]?.[tm];
                                const col = cellColor(!!occ);
                                return (
                                  <td
                                    key={`${d}-${tm}`}
                                    className="erp-hm-cell"
                                    style={{ background: col.bg, color: col.text }}
                                    title={occ
                                      ? `${occ.course}${occ.teacher ? ' · ' + occ.teacher : ''}`
                                      : (t('free') || 'Free')}
                                  >
                                    {occ ? '✗' : '✓'}
                                  </td>
                                );
                              })
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EmptyRoomPanel;