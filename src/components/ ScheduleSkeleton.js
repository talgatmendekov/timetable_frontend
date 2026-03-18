// src/components/ScheduleSkeleton.js
import React from 'react';
import './ScheduleSkeleton.css';

// Renders a shimmering skeleton that mimics the real schedule table layout
export default function ScheduleSkeleton({ days = 6, groups = 5, slots = 8 }) {
  return (
    <div className="sk-wrap">
      {/* Top filter bar skeleton */}
      <div className="sk-topbar">
        <div className="sk-bar sk-bar--short" />
        <div className="sk-bar sk-bar--mid" />
        <div className="sk-bar sk-bar--short" />
        <div className="sk-bar sk-bar--long" />
      </div>

      {/* Desktop table skeleton */}
      <div className="sk-table-wrap sk-desktop">
        <table className="sk-table">
          <thead>
            <tr>
              {/* Group column */}
              <th className="sk-th sk-th--group"><div className="sk-cell sk-cell--head" /></th>
              {Array.from({ length: days }).map((_, di) => (
                <th key={di} className="sk-th">
                  <div className="sk-cell sk-cell--head" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: groups }).map((_, gi) => (
              <tr key={gi}>
                <td className="sk-td sk-td--group">
                  <div className="sk-pill" />
                </td>
                {Array.from({ length: days }).map((_, di) => {
                  // ~40% chance of showing a "filled" cell
                  const filled = (gi * 7 + di * 3) % 5 < 2;
                  return (
                    <td key={di} className="sk-td">
                      {filled ? (
                        <div className="sk-card">
                          <div className="sk-line sk-line--title" />
                          <div className="sk-line sk-line--sub" />
                          <div className="sk-line sk-line--sub sk-line--short" />
                        </div>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile list skeleton */}
      <div className="sk-mobile">
        {Array.from({ length: slots }).map((_, i) => {
          const filled = i % 3 !== 0;
          return (
            <div key={i} className="sk-mob-slot">
              <div className="sk-mob-time" />
              {filled ? (
                <div className="sk-mob-card">
                  <div className="sk-line sk-line--title" />
                  <div className="sk-line sk-line--sub" />
                </div>
              ) : (
                <div className="sk-mob-empty" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}