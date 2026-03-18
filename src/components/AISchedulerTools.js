// src/components/AISchedulerTools.js
import React, { useState, useRef } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { useLanguage } from '../context/LanguageContext';
import './AISchedulerTools.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://timetablebackend-production.up.railway.app/api';

const getToken = () =>
    localStorage.getItem('token') || localStorage.getItem('scheduleToken') || '';

// ── Call Claude via backend ────────────────────────────────────────────────
const callClaude = async (prompt, systemPrompt) => {
    const res = await fetch(`${API_URL}/claude/fix-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ prompt, system: systemPrompt }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Claude API error');
    return data.text;
};

// ── Parse JSON safely from Claude response ─────────────────────────────────
const parseJSON = (text) => {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
};

// ─────────────────────────────────────────────────────────────────────────────
export default function AISchedulerTools({ onAddEntries }) {
    const { schedule, groups, teachers, days, timeSlots, importSchedule } = useSchedule();
    const { t } = useLanguage();

    const [activeTab, setActiveTab] = useState('nl');   // 'nl' | 'conflict' | 'optimize'

    // ── Natural Language state ─────────────────────────────────────────────
    const [nlInput, setNlInput] = useState('');
    const [nlBusy, setNlBusy] = useState(false);
    const [nlResult, setNlResult] = useState(null);  // parsed entries array
    const [nlError, setNlError] = useState('');
    const [nlApplied, setNlApplied] = useState(false);
    const nlRef = useRef(null);

    // ── Conflict state ─────────────────────────────────────────────────────
    const [conflictBusy, setConflictBusy] = useState(false);
    const [conflictResult, setConflictResult] = useState(null); // { conflicts, explanations, fixes }
    const [conflictError, setConflictError] = useState('');

    // ── Optimize state ─────────────────────────────────────────────────────
    const [optBusy, setOptBusy] = useState(false);
    const [optResult, setOptResult] = useState(null); // { entries, summary }
    const [optError, setOptError] = useState('');
    const [optApplied, setOptApplied] = useState(false);

    // ── Shared context summary for Claude ─────────────────────────────────
    const scheduleContext = () => ({
        days,
        timeSlots,
        groups,
        teachers,
        entries: Object.values(schedule).slice(0, 80), // cap to avoid token overload
        entryCount: Object.values(schedule).length,
    });

    // ── 1. Natural Language Scheduling ────────────────────────────────────
    const handleNL = async () => {
        if (!nlInput.trim()) return;
        setNlBusy(true); setNlError(''); setNlResult(null); setNlApplied(false);
        try {
            const ctx = scheduleContext();
            const system = `You are a university schedule assistant. Given a natural language instruction, return ONLY a valid JSON array of schedule entries. Each entry must have: group, day, time, course, teacher, room, subjectType (lecture|seminar|lab|practice), duration (integer 1-4). Use only these days: ${ctx.days.join(',')}. Use only these times: ${ctx.timeSlots.join(',')}. Known groups: ${ctx.groups.join(',')}. Known teachers: ${ctx.teachers.join(',')}. Return ONLY JSON, no markdown, no explanation.`;
            const prompt = `Instruction: "${nlInput}"\n\nExisting schedule sample (${ctx.entryCount} total entries): ${JSON.stringify(ctx.entries.slice(0, 20))}`;
            const raw = await callClaude(prompt, system);
            const entries = parseJSON(raw);
            if (!Array.isArray(entries) || entries.length === 0) throw new Error('No entries returned');
            setNlResult(entries);
        } catch (e) {
            setNlError(e.message);
        } finally {
            setNlBusy(false);
        }
    };

    const handleNLApply = async () => {
        try {
            if (onAddEntries) {
                await onAddEntries(nlResult);
            } else {
                const merged = [...Object.values(schedule), ...nlResult];
                await importSchedule(JSON.stringify(merged));
            }
            setNlApplied(true);
        } catch (e) {
            setNlError(e.message);
        }
    };

    // ── 2. Conflict Explanation ────────────────────────────────────────────
    const detectRawConflicts = () => {
        const entries = Object.values(schedule);
        const conflicts = [];
        const seen = new Set();
        days.forEach(day => {
            timeSlots.forEach(time => {
                const slot = entries.filter(e => e.day === day && e.time === time);
                if (slot.length < 2) return;
                const tMap = {}, rMap = {};
                slot.forEach(e => {
                    if (e.teacher) tMap[e.teacher.toLowerCase()] = (tMap[e.teacher.toLowerCase()] || []).concat(e);
                    if (e.room) rMap[e.room.toLowerCase()] = (rMap[e.room.toLowerCase()] || []).concat(e);
                });
                Object.entries(tMap).forEach(([k, arr]) => {
                    if (arr.length > 1 && !seen.has(`t-${k}-${day}-${time}`)) {
                        conflicts.push({ type: 'teacher', key: arr[0].teacher, day, time, entries: arr });
                        seen.add(`t-${k}-${day}-${time}`);
                    }
                });
                Object.entries(rMap).forEach(([k, arr]) => {
                    if (arr.length > 1 && !seen.has(`r-${k}-${day}-${time}`)) {
                        conflicts.push({ type: 'room', key: arr[0].room, day, time, entries: arr });
                        seen.add(`r-${k}-${day}-${time}`);
                    }
                });
            });
        });
        return conflicts;
    };

    const handleConflictAnalysis = async () => {
        setConflictBusy(true); setConflictError(''); setConflictResult(null);
        try {
            const raw = detectRawConflicts();
            if (raw.length === 0) {
                setConflictResult({ conflicts: [], explanations: [], fixes: [] });
                setConflictBusy(false);
                return;
            }
            const ctx = scheduleContext();
            const system = `You are a university schedule conflict analyst. Given a list of scheduling conflicts, return a JSON object with three arrays: "explanations" (plain English explanation for each conflict, same order), "fixes" (a concrete actionable fix suggestion for each conflict), and "severity" ("low"|"medium"|"high" for each). Return ONLY JSON, no markdown.`;
            const prompt = `Conflicts to analyze:\n${JSON.stringify(raw)}\n\nAvailable days: ${ctx.days.join(',')}\nAvailable times: ${ctx.timeSlots.join(',')}\nAll groups: ${ctx.groups.join(',')}`;
            const text = await callClaude(prompt, system);
            const parsed = parseJSON(text);
            setConflictResult({ conflicts: raw, ...parsed });
        } catch (e) {
            setConflictError(e.message);
        } finally {
            setConflictBusy(false);
        }
    };

    // ── 3. Auto-Optimize ───────────────────────────────────────────────────
    const handleOptimize = async () => {
        setOptBusy(true); setOptError(''); setOptResult(null); setOptApplied(false);
        try {
            const ctx = scheduleContext();
            const system = `You are a university schedule optimizer. Given the current schedule, return an optimized version as a JSON object with two keys: "entries" (the full optimized schedule array, same format as input) and "summary" (a string listing what was improved: gaps reduced, workload balanced, room utilization improved, conflicts resolved). Optimization goals: 1) Minimize free gaps in groups' days. 2) Spread teacher hours evenly across the week. 3) Avoid teachers having more than 4 consecutive hours. 4) Maximize room reuse efficiency. 5) Resolve all teacher and room conflicts. Keep all existing courses, teachers, groups — only change day/time/room assignments. Return ONLY JSON, no markdown.`;
            const prompt = `Current schedule (${ctx.entryCount} entries):\n${JSON.stringify(ctx.entries)}\n\nDays: ${ctx.days.join(',')}\nTimes: ${ctx.timeSlots.join(',')}`;
            const text = await callClaude(prompt, system);
            const parsed = parseJSON(text);
            if (!Array.isArray(parsed.entries)) throw new Error('Invalid response format');
            setOptResult(parsed);
        } catch (e) {
            setOptError(e.message);
        } finally {
            setOptBusy(false);
        }
    };

    const handleOptApply = async () => {
        try {
            await importSchedule(JSON.stringify(optResult.entries));
            setOptApplied(true);
        } catch (e) {
            setOptError(e.message);
        }
    };

    // ── Severity color ─────────────────────────────────────────────────────
    const sevColor = (s) => s === 'high' ? '#ef4444' : s === 'medium' ? '#f59e0b' : '#10b981';

    const TABS = [
        { id: 'nl', icon: '💬', label: 'Natural Language' },
        { id: 'conflict', icon: '🔍', label: 'Explain Conflicts' },
        { id: 'optimize', icon: '⚡', label: 'Auto-Optimize' },
    ];

    return (
        <div className="ait-wrap">

            {/* Header */}
            <div className="ait-header">
                <div className="ait-header-left">
                    <div className="ait-header-icon">🤖</div>
                    <div>
                        <div className="ait-title">AI Schedule Assistant</div>
                        <div className="ait-sub">Natural language scheduling · Conflict analysis · Auto-optimization</div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="ait-tabs">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        className={`ait-tab${activeTab === tab.id ? ' active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <span className="ait-tab-icon">{tab.icon}</span>
                        <span className="ait-tab-label">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* ── Tab: Natural Language ── */}
            {activeTab === 'nl' && (
                <div className="ait-panel">
                    <div className="ait-panel-title">💬 Natural Language Scheduling</div>
                    <div className="ait-panel-sub">
                        Describe what you want in plain English. Claude will parse it and generate schedule entries.
                    </div>

                    <div className="ait-examples">
                        {[
                            'Schedule Dr. Aibek for Math on Monday and Wednesday at 9:00',
                            'Add a lab for COMSE-25 in LAB1 on Friday mornings',
                            'Put Physics lecture for all groups on Tuesday at 11:00 in B201',
                        ].map(ex => (
                            <button key={ex} className="ait-example-pill" onClick={() => setNlInput(ex)}>
                                {ex}
                            </button>
                        ))}
                    </div>

                    <div className="ait-input-row">
                        <textarea
                            ref={nlRef}
                            className="ait-textarea"
                            placeholder="e.g. Schedule Dr. Aibek for Mathematics on Monday and Wednesday mornings for group COMSE-25 in room B201…"
                            value={nlInput}
                            onChange={e => setNlInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleNL(); }}
                            rows={3}
                        />
                        <button className="ait-run-btn" onClick={handleNL} disabled={nlBusy || !nlInput.trim()}>
                            {nlBusy ? <span className="ait-spinner" /> : '→'}
                        </button>
                    </div>
                    <div className="ait-hint">Tip: Press Cmd/Ctrl + Enter to submit</div>

                    {nlError && <div className="ait-error">⚠️ {nlError}</div>}

                    {nlResult && (
                        <div className="ait-result">
                            <div className="ait-result-header">
                                <span className="ait-result-title">✅ {nlResult.length} entr{nlResult.length === 1 ? 'y' : 'ies'} generated</span>
                                {!nlApplied && (
                                    <button className="ait-apply-btn" onClick={handleNLApply}>
                                        Apply to Schedule
                                    </button>
                                )}
                                {nlApplied && <span className="ait-applied">✓ Applied!</span>}
                            </div>
                            <div className="ait-table-wrap">
                                <table className="ait-table">
                                    <thead>
                                        <tr>
                                            {['Group', 'Day', 'Time', 'Course', 'Teacher', 'Room', 'Type', 'Dur'].map(h => (
                                                <th key={h}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {nlResult.map((e, i) => (
                                            <tr key={i}>
                                                <td><strong>{e.group}</strong></td>
                                                <td>{e.day}</td>
                                                <td style={{ fontFamily: 'monospace' }}>{e.time}</td>
                                                <td>{e.course}</td>
                                                <td style={{ color: '#6366f1', fontWeight: 600 }}>{e.teacher || '—'}</td>
                                                <td>{e.room || '—'}</td>
                                                <td><span className={`ait-badge ${e.subjectType}`}>{e.subjectType}</span></td>
                                                <td style={{ fontFamily: 'monospace' }}>{e.duration}h</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Tab: Conflict Explanation ── */}
            {activeTab === 'conflict' && (
                <div className="ait-panel">
                    <div className="ait-panel-title">🔍 Conflict Explanation</div>
                    <div className="ait-panel-sub">
                        Claude scans your schedule, explains every conflict in plain language, and suggests the best fix for each one.
                    </div>

                    <button className="ait-run-wide-btn" onClick={handleConflictAnalysis} disabled={conflictBusy}>
                        {conflictBusy
                            ? <><span className="ait-spinner" /> Analyzing {Object.values(schedule).length} entries…</>
                            : `🔍 Analyze Schedule (${Object.values(schedule).length} entries)`}
                    </button>

                    {conflictError && <div className="ait-error">⚠️ {conflictError}</div>}

                    {conflictResult && conflictResult.conflicts.length === 0 && (
                        <div className="ait-clean">
                            <div className="ait-clean-icon">✅</div>
                            <div className="ait-clean-title">No conflicts found!</div>
                            <div className="ait-clean-sub">Your schedule is clean — no teacher or room double-bookings.</div>
                        </div>
                    )}

                    {conflictResult && conflictResult.conflicts.length > 0 && (
                        <div className="ait-conflicts-list">
                            <div className="ait-conflicts-summary">
                                Found <strong>{conflictResult.conflicts.length}</strong> conflict{conflictResult.conflicts.length !== 1 ? 's' : ''}
                            </div>
                            {conflictResult.conflicts.map((c, i) => (
                                <div key={i} className="ait-conflict-card">
                                    <div className="ait-conflict-header">
                                        <div className="ait-conflict-meta">
                                            <span className="ait-conflict-type">{c.type === 'teacher' ? '👤' : '🚪'} {c.type}</span>
                                            <span className="ait-conflict-who">{c.key}</span>
                                            <span className="ait-conflict-when">{c.day} · {c.time}</span>
                                        </div>
                                        {conflictResult.severity?.[i] && (
                                            <span className="ait-severity" style={{ background: sevColor(conflictResult.severity[i]) + '22', color: sevColor(conflictResult.severity[i]), border: `1px solid ${sevColor(conflictResult.severity[i])}44` }}>
                                                {conflictResult.severity[i]}
                                            </span>
                                        )}
                                    </div>

                                    <div className="ait-conflict-entries">
                                        {c.entries.map((e, j) => (
                                            <span key={j} className="ait-entry-pill">{e.course} · {e.group}</span>
                                        ))}
                                    </div>

                                    {conflictResult.explanations?.[i] && (
                                        <div className="ait-conflict-explanation">
                                            <span className="ait-label">Why:</span> {conflictResult.explanations[i]}
                                        </div>
                                    )}
                                    {conflictResult.fixes?.[i] && (
                                        <div className="ait-conflict-fix">
                                            <span className="ait-label">Fix:</span> {conflictResult.fixes[i]}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Tab: Auto-Optimize ── */}
            {activeTab === 'optimize' && (
                <div className="ait-panel">
                    <div className="ait-panel-title">⚡ Auto-Optimize Schedule</div>
                    <div className="ait-panel-sub">
                        Claude reshuffles day/time/room assignments to minimize gaps, balance teacher workload, and resolve conflicts — without changing any course, teacher, or group assignments.
                    </div>

                    <div className="ait-optimize-goals">
                        {[
                            { icon: '📉', text: 'Minimize group free gaps' },
                            { icon: '⚖️', text: 'Balance teacher workload' },
                            { icon: '🚪', text: 'Improve room utilization' },
                            { icon: '⚠️', text: 'Resolve all conflicts' },
                        ].map(g => (
                            <div key={g.text} className="ait-goal-pill">
                                <span>{g.icon}</span> {g.text}
                            </div>
                        ))}
                    </div>

                    <div className="ait-optimize-warning">
                        ⚠️ This will replace your current schedule. Make sure to export a backup first.
                    </div>

                    <button className="ait-run-wide-btn optimize" onClick={handleOptimize} disabled={optBusy}>
                        {optBusy
                            ? <><span className="ait-spinner" /> Optimizing {Object.values(schedule).length} entries…</>
                            : `⚡ Optimize Schedule (${Object.values(schedule).length} entries)`}
                    </button>

                    {optError && <div className="ait-error">⚠️ {optError}</div>}

                    {optResult && (
                        <div className="ait-result">
                            <div className="ait-result-header">
                                <span className="ait-result-title">✅ Optimized — {optResult.entries.length} entries</span>
                                {!optApplied && (
                                    <button className="ait-apply-btn" onClick={handleOptApply}>
                                        Apply to Schedule
                                    </button>
                                )}
                                {optApplied && <span className="ait-applied">✓ Applied!</span>}
                            </div>

                            {optResult.summary && (
                                <div className="ait-optimize-summary">
                                    <div className="ait-label">What changed:</div>
                                    <div className="ait-optimize-summary-text">{optResult.summary}</div>
                                </div>
                            )}

                            <div className="ait-table-wrap">
                                <table className="ait-table">
                                    <thead>
                                        <tr>
                                            {['Group', 'Day', 'Time', 'Course', 'Teacher', 'Room', 'Type'].map(h => (
                                                <th key={h}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {optResult.entries.slice(0, 40).map((e, i) => (
                                            <tr key={i}>
                                                <td><strong>{e.group}</strong></td>
                                                <td>{e.day}</td>
                                                <td style={{ fontFamily: 'monospace' }}>{e.time}</td>
                                                <td>{e.course}</td>
                                                <td style={{ color: '#6366f1', fontWeight: 600 }}>{e.teacher || '—'}</td>
                                                <td>{e.room || '—'}</td>
                                                <td><span className={`ait-badge ${e.subjectType}`}>{e.subjectType}</span></td>
                                            </tr>
                                        ))}
                                        {optResult.entries.length > 40 && (
                                            <tr>
                                                <td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', padding: '8px' }}>
                                                    … and {optResult.entries.length - 40} more entries
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
           
        </div>
    );
}