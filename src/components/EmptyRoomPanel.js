// src/components/EmptyRoomPanel.js
// Shows available (empty) rooms with per-slot stats and a filter
import React, { useState, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import './EmptyRoomPanel.css';

const EmptyRoomPanel = ({
  allRooms = [],
  schedule = {},
  days = [],
  timeSlots = [],
  selectedRoom,
  setSelectedRoom,
}) => {
  const { t } = useLanguage();
  const [expandStats, setExpandStats] = useState(false);

  // For each room, compute how many slots are occupied
  const roomStats = useMemo(() => {
    const total = days.length * timeSlots.length;
    return allRooms.map(room => {
      const occupied = Object.values(schedule).filter(e => e.room === room).length;
      const free     = total - occupied;
      const pct      = total > 0 ? Math.round((free / total) * 100) : 0;
      return { room, occupied, free, total, pct };
    }).sort((a, b) => b.pct - a.pct); // most available first
  }, [allRooms, schedule, days, timeSlots]);

  // For each (day, time) slot, which rooms are free?
  const slotFreeRooms = useMemo(() => {
    const map = {};
    days.forEach(day => {
      timeSlots.forEach(time => {
        const occupiedRooms = new Set(
          Object.values(schedule)
            .filter(e => e.day === day && e.time === time && e.room)
            .map(e => e.room)
        );
        map[`${day}-${time}`] = allRooms.filter(r => !occupiedRooms.has(r));
      });
    });
    return map;
  }, [allRooms, schedule, days, timeSlots]);

  const totalSlots = days.length * timeSlots.length * allRooms.length;
  const totalOccupied = Object.values(schedule).filter(e => e.room).length;
  const totalFree = totalSlots - totalOccupied;
  const overallPct = totalSlots > 0 ? Math.round((totalFree / totalSlots) * 100) : 0;

  if (allRooms.length === 0) return null;

  return (
    <div className="erp-wrap">
      {/* ── Top bar: summary + room selector ── */}
      <div className="erp-bar">

        {/* Summary pill */}
        <div className="erp-summary">
          <div className="erp-summary-icon">🚪</div>
          <div className="erp-summary-body">
            <div className="erp-summary-title">
              {t('roomAvailability') || 'Room Availability'}
            </div>
            <div className="erp-summary-sub">
              <span className="erp-free">{totalFree} free slots</span>
              <span className="erp-sep">·</span>
              <span className="erp-occ">{totalOccupied} occupied</span>
              <span className="erp-sep">·</span>
              <span className="erp-pct">{overallPct}% available</span>
            </div>
          </div>
          <button
            className={`erp-expand-btn${expandStats ? ' active' : ''}`}
            onClick={() => setExpandStats(v => !v)}
            title="Show room stats"
          >
            {expandStats ? '▲' : '▼'} Stats
          </button>
        </div>

        {/* Room filter dropdown */}
        <div className="erp-filter">
          <label className="erp-filter-lbl">
            {t('filterByRoom') || 'Show free slots for room:'}
          </label>
          <select
            className="erp-filter-sel"
            value={selectedRoom || ''}
            onChange={e => setSelectedRoom(e.target.value)}
          >
            <option value="">— {t('allRooms') || 'All rooms'} —</option>
            {roomStats.map(({ room, pct, free }) => (
              <option key={room} value={room}>
                {room}  ({free} free / {pct}% available)
              </option>
            ))}
          </select>
          {selectedRoom && (
            <button className="erp-clear" onClick={() => setSelectedRoom('')}>
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Stats panel (expanded) ── */}
      {expandStats && (
        <div className="erp-stats">
          <div className="erp-stats-grid">
            {roomStats.map(({ room, free, occupied, total, pct }) => (
              <div
                key={room}
                className={`erp-stat-card${selectedRoom === room ? ' selected' : ''}`}
                onClick={() => setSelectedRoom(selectedRoom === room ? '' : room)}
                title={`Click to filter schedule by ${room}`}
              >
                <div className="erp-card-room">{room}</div>
                <div className="erp-card-bar-wrap">
                  <div
                    className="erp-card-bar"
                    style={{ width: `${pct}%`, background: pct > 60 ? '#22c55e' : pct > 30 ? '#f59e0b' : '#ef4444' }}
                  />
                </div>
                <div className="erp-card-nums">
                  <span className="erp-card-free">{free} free</span>
                  <span className="erp-card-pct">{pct}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Per-slot availability heatmap for selected room */}
          {selectedRoom && (
            <div className="erp-heatmap">
              <div className="erp-heatmap-title">
                🗓 Free slots for <strong>{selectedRoom}</strong>
              </div>
              <div className="erp-heatmap-scroll">
                <table className="erp-heatmap-table">
                  <thead>
                    <tr>
                      <th className="erp-ht-corner"></th>
                      {timeSlots.map(tm => <th key={tm}>{tm}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {days.map(day => (
                      <tr key={day}>
                        <td className="erp-ht-day">{t(day) || day}</td>
                        {timeSlots.map(tm => {
                          const key = `${day}-${tm}`;
                          const freeRooms = slotFreeRooms[key] || [];
                          const isFree = freeRooms.includes(selectedRoom);
                          return (
                            <td
                              key={tm}
                              className={`erp-ht-cell${isFree ? ' free' : ' occ'}`}
                              title={isFree ? `${selectedRoom} is FREE` : `${selectedRoom} is OCCUPIED`}
                            >
                              {isFree ? '✓' : '✗'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyRoomPanel;