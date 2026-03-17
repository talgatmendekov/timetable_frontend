// src/components/EmptyRoomPanel.js
// Admin Room Heatmap — fullscreen modal showing room × timeslot availability
import React, { useState, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import './EmptyRoomPanel.css';

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const getTodayName = () => DAY_NAMES[new Date().getDay()];

// Find the nearest time slot to right now (within ±60 min)
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

  // ── Build occupancy map ────────────────────────────────────────────────────
  const occupancy = useMemo(() => {
    const map = {};
    allRooms.forEach(r => {
      map[r] = {};
      days.forEach(d => { map[r][d] = {}; });
    });
    Object.values(schedule).forEach(e => {
      if (!e.room || !map[e.room]) return;
      if (!map[e.room][e.day]) map[e.room][e.day] = {};
      const dur = Math.min(6, Math.max(1, parseInt(e.duration) || 1));
      const idx = timeSlots.indexOf(e.time);
      for (let i = 0; i < dur; i++) {
        const tm = timeSlots[idx + i];
        if (tm) map[e.room][e.day][tm] = { course: e.course, teacher: e.teacher };
      }
    });
    return map;
  }, [allRooms, schedule, days, timeSlots]);

  // ── Free right now ─────────────────────────────────────────────────────────
  const freeNowRooms = useMemo(() => {
    if (!currentSlot || !days.includes(todayName)) return allRooms;
    return allRooms.filter(r => !occupancy[r]?.[todayName]?.[currentSlot]);
  }, [allRooms, occupancy, todayName, currentSlot, days]);

  const busyNowRooms = useMemo(() => {
    if (!currentSlot || !days.includes(todayName)) return [];
    return allRooms.filter(r => !!occupancy[r]?.[todayName]?.[currentSlot]);
  }, [allRooms, occupancy, todayName, currentSlot, days]);

  // ── Per-room stats ─────────────────────────────────────────────────────────
  const roomStats = useMemo(() => {
    const daysFilter = selDay ? [selDay] : days;
    return allRooms
      .filter(r => r.toLowerCase().includes(search.toLowerCase()))
      .map(room => {
        const total = daysFilter.length * timeSlots.length;
        const busy  = daysFilter.reduce((a, d) =>
          a + timeSlots.filter(tm => occupancy[room]?.[d]?.[tm]).length, 0);
        const free  = total - busy;
        const pct   = total > 0 ? Math.round((free / total) * 100) : 0;
        return { room, total, busy, free, pct };
      })
      .sort((a, b) => {
        if (sortBy === 'free') return b.free - a.free;
        if (sortBy === 'busy') return b.busy - a.busy;
        return a.room.localeCompare(b.room);
      });
  }, [allRooms, occupancy, days, timeSlots, selDay, search, sortBy]);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const daysFilter = selDay ? [selDay] : days;
    const total = allRooms.length * daysFilter.length * timeSlots.length;
    const busy  = roomStats.reduce((a, r) => a + r.busy, 0);
    return { total, busy, free: total - busy,
      pct: total > 0 ? Math.round(((total - busy) / total) * 100) : 0 };
  }, [roomStats, allRooms, days, timeSlots, selDay]);

  // ── Color helpers ──────────────────────────────────────────────────────────
  const heatColor = (pct) => {
    if (pct >= 70) return { bg: '#dcfce7', border: '#22c55e', text: '#166534' };
    if (pct >= 40) return { bg: '#fef9c3', border: '#eab308', text: '#854d0e' };
    return { bg: '#fff1f2', border: '#ef4444', text: '#be123c' };
  };
  const cellColor = (occ) =>
    occ ? { bg: '#fee2e2', text: '#991b1b' } : { bg: '#dcfce7', text: '#166534' };

  const daysToShow = selDay ? [selDay] : days;

  return (
    <>
      {/* ── Compact trigger bar ───────────────────────────────────────────── */}
      <div className="erp-trigger-bar">
        <div className="erp-trigger-stats">
          <span className="erp-stat-pill free">{summary.free} free slots</span>
          <span className="erp-stat-pill busy">{summary.busy} occupied</span>
          <span className="erp-stat-pill rooms">{allRooms.length} rooms · {summary.pct}% available</span>
          {/* Free right now inline pill */}
          {allRooms.length > 0 && currentSlot && days.includes(todayName) && (
            <span className="erp-stat-pill now" title={`Free rooms at ${currentSlot} today`}>
              🚪 {freeNowRooms.length} free now
            </span>
          )}
        </div>
        <div className="erp-trigger-actions">
          {selectedRoom && (
            <div className="erp-active-filter">
              Filtering: <strong>{selectedRoom}</strong>
              <button onClick={() => setSelectedRoom('')} className="erp-clear-btn">✕ Clear</button>
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

            {/* Header */}
            <div className="erp-modal-header">
              <div className="erp-modal-title-block">
                <div className="erp-modal-icon">🗓</div>
                <div>
                  <div className="erp-modal-title">Room Availability Heatmap</div>
                  <div className="erp-modal-sub">
                    {allRooms.length} rooms · {summary.free} free slots · {summary.pct}% available
                  </div>
                </div>
              </div>
              <button className="erp-close-btn" onClick={() => setOpen(false)}>✕</button>
            </div>

            {/* Controls */}
            <div className="erp-modal-controls">
              <input
                className="erp-search"
                placeholder="Search room..."
                value={search}
                onChange={e => setSrc(e.target.value)}
              />
              <div className="erp-day-tabs">
                <button
                  className={`erp-day-tab ${selDay === '' ? 'active' : ''}`}
                  onClick={() => setDay('')}
                >All Days</button>
                {days.map(d => (
                  <button
                    key={d}
                    className={`erp-day-tab ${selDay === d ? 'active' : ''}`}
                    onClick={() => setDay(d)}
                  >{t(d) || d}</button>
                ))}
              </div>
              <div className="erp-sort-row">
                <span className="erp-sort-label">Sort by:</span>
                {[['name','Name'],['free','Most Free'],['busy','Most Busy']].map(([k,l]) => (
                  <button
                    key={k}
                    className={`erp-sort-btn ${sortBy === k ? 'active' : ''}`}
                    onClick={() => setSrt(k)}
                  >{l}</button>
                ))}
              </div>
            </div>

            {/* ── Content ─────────────────────────────────────────────────── */}
            <div className="erp-modal-body">

              {/* ── FREE RIGHT NOW section ── */}
              {allRooms.length > 0 && currentSlot && days.includes(todayName) && (
                <div className="erp-free-now-section">
                  <div className="erp-free-now-header">
                    <span className="erp-free-now-title">🚪 Free right now</span>
                    <span className="erp-free-now-meta">
                      {todayName} · {currentSlot}
                    </span>
                  </div>
                  <div className="erp-free-now-body">
                    <div className="erp-free-now-col">
                      <div className="erp-free-now-col-label free">
                        ✅ Available ({freeNowRooms.length})
                      </div>
                      <div className="erp-free-now-rooms">
                        {freeNowRooms.length === 0
                          ? <span className="erp-free-now-empty">All rooms in use</span>
                          : freeNowRooms.map(r => (
                            <button
                              key={r}
                              className={`erp-now-room free${selectedRoom === r ? ' selected' : ''}`}
                              onClick={() => { setSelectedRoom(selectedRoom === r ? '' : r); setOpen(false); }}
                              title="Click to filter schedule by this room"
                            >{r}</button>
                          ))
                        }
                      </div>
                    </div>
                    {busyNowRooms.length > 0 && (
                      <div className="erp-free-now-col">
                        <div className="erp-free-now-col-label busy">
                          🔴 In use ({busyNowRooms.length})
                        </div>
                        <div className="erp-free-now-rooms">
                          {busyNowRooms.map(r => {
                            const info = occupancy[r]?.[todayName]?.[currentSlot];
                            return (
                              <div key={r} className="erp-now-room busy" title={info?.course || ''}>
                                <span className="erp-now-room-name">{r}</span>
                                {info?.course && (
                                  <span className="erp-now-room-course">{info.course}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Summary cards row */}
              <div className="erp-summary-row">
                {[
                  { label: 'Total Slots',     val: summary.total,         color: '#6366f1' },
                  { label: 'Free Slots',      val: summary.free,          color: '#22c55e' },
                  { label: 'Occupied',        val: summary.busy,          color: '#ef4444' },
                  { label: '% Available',     val: `${summary.pct}%`,     color: '#f59e0b' },
                  { label: 'Free right now',  val: freeNowRooms.length,   color: '#0ea5e9' },
                ].map(s => (
                  <div key={s.label} className="erp-summary-card" style={{ borderTop: `3px solid ${s.color}` }}>
                    <div className="erp-summary-val" style={{ color: s.color }}>{s.val}</div>
                    <div className="erp-summary-lbl">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Two-panel layout: room list + heatmap */}
              <div className="erp-panels">

                {/* LEFT: Room list */}
                <div className="erp-room-list">
                  <div className="erp-panel-head">Rooms ({roomStats.length})</div>
                  {roomStats.map(({ room, free, busy, pct }) => {
                    const col        = heatColor(pct);
                    const isSelected = selectedRoom === room;
                    const isFreeNow  = freeNowRooms.includes(room);
                    return (
                      <div
                        key={room}
                        className={`erp-room-row ${isSelected ? 'selected' : ''}`}
                        style={{ borderLeft: `3px solid ${col.border}` }}
                        onClick={() => { setSelectedRoom(isSelected ? '' : room); setOpen(false); }}
                        title="Click to filter schedule by this room"
                      >
                        <div className="erp-room-name">
                          {room}
                          {isFreeNow && days.includes(todayName) && currentSlot && (
                            <span className="erp-room-now-dot" title="Free right now" />
                          )}
                        </div>
                        <div className="erp-room-bar-wrap">
                          <div
                            className="erp-room-bar"
                            style={{ width: `${pct}%`, background: col.border }}
                          />
                        </div>
                        <div className="erp-room-nums" style={{ color: col.text }}>
                          {free}✓ {busy}✗ {pct}%
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* RIGHT: Heatmap grid */}
                <div className="erp-heatmap-wrap">
                  <div className="erp-panel-head">
                    Slot Heatmap
                    <span className="erp-legend">
                      <span className="erp-leg-item free">■ Free</span>
                      <span className="erp-leg-item busy">■ Occupied</span>
                    </span>
                  </div>
                  <div className="erp-heatmap-scroll">
                    <table className="erp-heatmap-table">
                      <thead>
                        <tr>
                          <th className="erp-th-room">Room</th>
                          {daysToShow.map(d =>
                            timeSlots.map(tm => (
                              <th
                                key={`${d}-${tm}`}
                                className={`erp-th-slot${d === todayName && tm === currentSlot ? ' erp-th-now' : ''}`}
                              >
                                <div className="erp-th-day">{(t(d)||d).slice(0,3)}</div>
                                <div className="erp-th-time">{tm}</div>
                              </th>
                            ))
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {roomStats.map(({ room, pct }) => {
                          const rowCol = heatColor(pct);
                          return (
                            <tr key={room}
                              className={selectedRoom === room ? 'erp-hm-selected' : ''}
                              onClick={() => { setSelectedRoom(selectedRoom === room ? '' : room); setOpen(false); }}
                              style={{ cursor: 'pointer' }}
                            >
                              <td
                                className="erp-hm-room"
                                style={{ color: rowCol.text, borderLeft: `3px solid ${rowCol.border}` }}
                              >{room}</td>
                              {daysToShow.map(d =>
                                timeSlots.map(tm => {
                                  const occ    = occupancy[room]?.[d]?.[tm];
                                  const col    = cellColor(!!occ);
                                  const isNow  = d === todayName && tm === currentSlot;
                                  return (
                                    <td
                                      key={`${d}-${tm}`}
                                      className={`erp-hm-cell${isNow ? ' erp-hm-now' : ''}`}
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