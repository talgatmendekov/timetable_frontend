// src/components/OnboardingTour.js
import React, { useState, useEffect, useRef } from 'react';
import './OnboardingTour.css';

const STEPS = [
  {
    id: 'welcome',
    title: '👋 Welcome to Alatoo Schedule!',
    body: 'This quick tour will show you the key features in about 60 seconds. You can skip at any time.',
    target: null, // centered modal, no highlight
    position: 'center',
  },
  {
    id: 'filters',
    title: '🔍 Filters',
    body: 'Use these dropdowns to filter by day, group, or teacher. Your group selection is saved for next visit.',
    target: '.app-topbar',
    position: 'bottom',
  },
  {
    id: 'addgroup',
    title: '➕ Add Groups',
    body: 'Click "+ Add Group" to create a new group. Then click any empty cell in the schedule to add a class.',
    target: '.app-topbar',
    position: 'bottom',
  },
  {
    id: 'cell',
    title: '📅 Editing Classes',
    body: 'Click any cell in the schedule to add or edit a class. You can set the subject, teacher, room, duration, and even a Zoom/Teams meeting link.',
    target: '.schedule-container',
    position: 'top',
  },
  {
    id: 'sidebar',
    title: '📊 Navigation Sidebar',
    body: 'Use the left sidebar to access Stats, Conflicts, Bookings, Exams, Feedback, and Telegram notifications.',
    target: '.app-sidebar',
    position: 'right',
  },
  {
    id: 'theme',
    title: '🎨 Themes & Language',
    body: 'Switch between light/dark mode, pick a department color theme, and change the interface language — all saved automatically.',
    target: '.app-topbar',
    position: 'bottom',
  },
  {
    id: 'done',
    title: '✅ You\'re all set!',
    body: 'That\'s the tour! You can restart it anytime from the ⋯ admin menu. Good luck managing the schedule!',
    target: null,
    position: 'center',
  },
];

export default function OnboardingTour({ onFinish }) {
  const [step, setStep] = useState(0);
  const [box, setBox]   = useState(null);
  const tooltipRef = useRef(null);

  const current = STEPS[step];

  useEffect(() => {
    if (!current.target) { setBox(null); return; }
    const el = document.querySelector(current.target);
    if (!el) { setBox(null); return; }
    const r = el.getBoundingClientRect();
    setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step, current.target]);

  const finish = () => {
    localStorage.setItem('tourDone', '1');
    onFinish();
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else finish();
  };

  const prev = () => { if (step > 0) setStep(s => s - 1); };

  // Tooltip position calculation
  const getTooltipStyle = () => {
    if (!box || current.position === 'center') {
      return { position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)' };
    }
    const PAD = 12;
    const TH  = 180; // approx tooltip height
    const TW  = 320; // approx tooltip width
    if (current.position === 'bottom') {
      return { position:'fixed', top: box.top + box.height + PAD, left: Math.min(box.left, window.innerWidth - TW - 12) };
    }
    if (current.position === 'top') {
      return { position:'fixed', top: Math.max(8, box.top - TH - PAD), left: Math.min(box.left, window.innerWidth - TW - 12) };
    }
    if (current.position === 'right') {
      return { position:'fixed', top: box.top, left: box.left + box.width + PAD };
    }
    return { position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)' };
  };

  return (
    <div className="tour-overlay">
      {/* Spotlight highlight */}
      {box && (
        <div className="tour-spotlight" style={{
          top:    box.top    - 6,
          left:   box.left   - 6,
          width:  box.width  + 12,
          height: box.height + 12,
        }} />
      )}

      {/* Tooltip */}
      <div className="tour-tooltip" style={getTooltipStyle()} ref={tooltipRef}>
        <div className="tour-progress">
          {STEPS.map((_, i) => (
            <div key={i} className={`tour-dot ${i === step ? 'active' : i < step ? 'done' : ''}`} />
          ))}
        </div>
        <div className="tour-title">{current.title}</div>
        <div className="tour-body">{current.body}</div>
        <div className="tour-actions">
          <button className="tour-skip" onClick={finish}>Skip tour</button>
          <div style={{ display:'flex', gap:8 }}>
            {step > 0 && <button className="tour-btn tour-btn-back" onClick={prev}>← Back</button>}
            <button className="tour-btn tour-btn-next" onClick={next}>
              {step === STEPS.length - 1 ? 'Finish 🎉' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}