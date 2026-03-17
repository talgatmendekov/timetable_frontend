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

// Normalize room name: trim + uppercase so "b101" and "B101" are the same room
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
  const [sortBy, setSrt] = useState('name');

  const todayName   = getTodayName();
  const currentSlot = getCurrentTimeSlot(timeSlots);

  // ── Deduplicate rooms by normalized name ───────────────────────────────────
  // Keep the first encountered casing as the display name
  const normalizedRooms = useMemo(() => {
    const seen = new Map(); // normalizedKey -> displayName
    allRooms.forEach(r => {
      const key = normalizeRoom(r);
      if (key && !seen.has(key)) seen.set(key, r.trim());
    });
    return Array.from(seen.entries()).map(([key, display]) => ({ key, display }));
  }, [allRooms]);

  // ── Occupancy map (keyed by normalized room name) ──────────────────────────
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

  // ── Per-room stats ─────────────────────────────────────────────────────────
  const roomStats = useMemo(() => {
    const daysFilter = selDay ? [selDay] : days;
    return normalizedRooms
      .filter(({ display }) => display.toLowerCase().includes(search.toLowerCase()))
      .map(({ key, display }) => {
        const total = daysFilter.length * timeSlots.length;
        const busy  = daysFilter.reduce((a, d) =>
          a + timeSlots.filter(tm => occupancy[key]?.[d]?.[tm]).length, 0);
        const free  = total - busy;
        const pct   = total > 0 ? Math.round((free / total) * 100) : 0;
        return { key, display, total, busy, free, pct };
      })
      .sort((a, b) => {
        if (sortBy === 'free') return b.free - a.free;
        if (sortBy === 'busy') return b.busy - a.busy;
        return a.display.localeCompare(b.display);
      });
  }, [normalizedRooms, occupancy, days, timeSlots, selDay, search, sortBy]);

  // ── Summary ────────────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const daysFilter = selDay ? [selDay] : days;
    const total = normalizedRooms.length * daysFilter.length * timeSlots.length;
    const busy  = roomStats.reduce((a, r) => a + r.busy, 0);
    return { total, busy, free: total - busy,
      pct: total > 0 ? Math.round(((total - busy) / total) * 100) : 0 };
  }, [roomStats, normalizedRooms, days, timeSlots, selDay]);

  const heatColor = (pct) => {
    if (pct >= 70) return { border: '#22c55e', text: '#166534' };
    if (pct >= 40) return { border: '#eab308', text: '#854d0e' };
    return { border: '#ef4444', text: '#be123c' };
  };
  const cellColor = (occ) =>
    occ ? { bg: '#fee2e2', text: '#991b1b' } : { bg: '#dcfce7', text: '#166534' };

  const daysToShow = selDay ? [selDay] : days;

  // When setting selected room, normalize so filter works regardless of casing
  const handleSelectRoom = (displayName, currentSelected) => {
    const normalized = normalizeRoom(displayName);
    const currentNormalized = normalizeRoom(currentSelected);
    if (normalized === currentNormalized) {
      setSelectedRoom('');
    } else {
      setSelectedRoom(displayName);
    }
  };

  return (
    <>
      {/* ── Trigger bar ───────────────────────────────────────────────────── */}
      <div className="erp-trigger-bar">
        <div className="erp-trigger-stats">
          <span className="erp-stat-pill free">{summary.free} free slots</span>
          <span className="erp-stat-pill busy">{summary.busy} busy</span>
          <span className="erp-stat-pill rooms">{normalizedRooms.length} rooms</span>
          {normalizedRooms.length > 0 && currentSlot && isToday && (
            <span className="erp-stat-pill now">🚪 {freeNowRooms.length} free now</span>
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
            🗓 Room Heatmap
          </button>
        </div>
      </div>

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      {open && (
        <div className="erp-overlay" onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div className="erp-modal">

            <div className="erp-modal-header">
              <div>
                <div className="erp-modal-title">Room Availability</div>
                <div className="erp-modal-sub">{normalizedRooms.length} rooms · {summary.pct}% available</div>
              </div>
              <button className="erp-close-btn" onClick={() => setOpen(false)}>✕</button>
            </div>

            <div className="erp-modal-controls">
              <input
                className="erp-search"
                placeholder="Search room..."
                value={search}
                onChange={e => setSrc(e.target.value)}
              />
              <div className="erp-day-tabs">
                <button className={`erp-day-tab ${selDay === '' ? 'active' : ''}`} onClick={() => setDay('')}>All</button>
                {days.map(d => (
                  <button key={d} className={`erp-day-tab ${selDay === d ? 'active' : ''}`} onClick={() => setDay(d)}>
                    {t(d) || d}
                  </button>
                ))}
              </div>
              <div className="erp-sort-row">
                <span className="erp-sort-label">Sort:</span>
                {[['name','Name'],['free','Most Free'],['busy','Most Busy']].map(([k,l]) => (
                  <button key={k} className={`erp-sort-btn ${sortBy === k ? 'active' : ''}`} onClick={() => setSrt(k)}>{l}</button>
                ))}
              </div>
            </div>

            <div className="erp-modal-body">

              {/* ── FREE RIGHT NOW ──────────────────────────────────────── */}
              {normalizedRooms.length > 0 && currentSlot && isToday && (
                <div className="erp-free-now-section">
                  <div className="erp-free-now-header">
                    <span className="erp-free-now-title">🚪 Free right now</span>
                    <span className="erp-free-now-meta">{todayName} · {currentSlot}</span>
                  </div>
                  <div className="erp-free-now-rooms">
                    {freeNowRooms.length === 0
                      ? <span className="erp-free-now-empty">All rooms currently in use</span>
                      : freeNowRooms.map(({ key, display }) => (
                        <button
                          key={key}
                          className={`erp-now-pill${normalizeRoom(selectedRoom) === key ? ' selected' : ''}`}
                          onClick={() => { handleSelectRoom(display, selectedRoom); setOpen(false); }}
                        >{normalizeRoom(display)}</button>
                      ))
                    }
                  </div>
                </div>
              )}

              {/* ── Two-panel: room list + heatmap ── */}
              <div className="erp-panels">

                <div className="erp-room-list">
                  <div className="erp-panel-head">Rooms ({roomStats.length})</div>
                  {roomStats.map(({ key, display, free, busy, pct }) => {
                    const col        = heatColor(pct);
                    const isSelected = normalizeRoom(selectedRoom) === key;
                    return (
                      <div
                        key={key}
                        className={`erp-room-row${isSelected ? ' selected' : ''}`}
                        style={{ borderLeft: `3px solid ${col.border}` }}
                        onClick={() => { handleSelectRoom(display, selectedRoom); setOpen(false); }}
                        title="Click to filter schedule by this room"
                      >
                        <div className="erp-room-name">{normalizeRoom(display)}</div>
                        <div className="erp-room-bar-wrap">
                          <div className="erp-room-bar" style={{ width: `${pct}%`, background: col.border }} />
                        </div>
                        <div className="erp-room-nums" style={{ color: col.text }}>{free}✓ {busy}✗</div>
                      </div>
                    );
                  })}
                </div>

                <div className="erp-heatmap-wrap">
                  <div className="erp-panel-head">
                    Heatmap
                    <span className="erp-legend">
                      <span className="erp-leg-item free">■ Free</span>
                      <span className="erp-leg-item busy">■ Busy</span>
                    </span>
                  </div>
                  <div className="erp-heatmap-scroll">
                    <table className="erp-heatmap-table">
                      <thead>
                        <tr>
                          <th className="erp-th-room">Room</th>
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
                        {roomStats.map(({ key, display, pct }) => {
                          const rowCol     = heatColor(pct);
                          const isSelected = normalizeRoom(selectedRoom) === key;
                          return (
                            <tr
                              key={key}
                              className={isSelected ? 'erp-hm-selected' : ''}
                              onClick={() => { handleSelectRoom(display, selectedRoom); setOpen(false); }}
                              style={{ cursor: 'pointer' }}
                            >
                              <td className="erp-hm-room" style={{ color: rowCol.text, borderLeft: `3px solid ${rowCol.border}` }}>
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
                                      title={occ ? `${occ.course}${occ.teacher ? ' · ' + occ.teacher : ''}` : 'Free'}
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
        </div>
      )}
    </>
  );
};

export default EmptyRoomPanel;