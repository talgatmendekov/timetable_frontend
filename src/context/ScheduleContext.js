// src/context/ScheduleContext.js

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UNIVERSITY_GROUPS, TIME_SLOTS, DAYS } from '../data/constants';
import { scheduleAPI, groupsAPI } from '../utils/api';

const ScheduleContext = createContext();

export const useSchedule = () => {
  const context = useContext(ScheduleContext);
  if (!context) throw new Error('useSchedule must be used within a ScheduleProvider');
  return context;
};

// ─── Teacher name normalisation ───────────────────────────────────────────────
// Handles every messy pattern found in the Ala-Too Excel schedule:
//
//  Spacing variants:   "Dr.Ahmad" → "Dr. Ahmad",  "Ms Iskra" → "Ms. Iskra"
//  Trailing rooms:     "Dr. X B110 LAB" / "B 202" / "b109" → "Dr. X"
//  Trailing notes:     "... with own device" / "own device" / "make up ..." → stripped
//  Trailing LAB refs:  "LAB3(210)" / "BIGLAB" / "untill 10:15" → stripped
//  Leading slash:      "/Ms.Asina" → "Ms. Asina"
//  Trailing slash:     "Ms. X B204/" → "Ms. X"
//  Slash mid-string:   "Alimpieva L./Tsoi A. B102" → "Alimpieva L." (keep first person)
//  Comma+room:         "Ms.Orozalieva D.,B103" → "Ms. Orozalieva D."
//  Bare room as name:  "B201(COM)" → "" (excluded from list)
export function normalizeTeacherName(raw) {
  if (!raw) return '';
  let s = raw.trim();

  // 1. Strip leading slash  e.g. "/Ms.Asina"
  s = s.replace(/^\/+/, '').trim();

  // 2. Cut at slash — keep only the first person in multi-teacher cells
  //    e.g. "Alimpieva L./Tsoi A. B102\103"  →  "Alimpieva L."
  s = s.replace(/\/.*$/, '').trim();

  // 3. Remove trailing parenthetical noise  e.g. "(APPLE LAB)", "(with own device)"
  s = s.replace(/\s*\([^)]*\)\s*$/, '').trim();

  // 4. Remove "untill/until ..." and everything after
  s = s.replace(/\s+until+\b.*/i, '').trim();

  // 5. Remove "own device" / "with own device" / "with own ..." and everything after
  s = s.replace(/\s+(?:with\s+)?own\b.*/i, '').trim();

  // 6. Remove "make up ..." and everything after
  s = s.replace(/\s+make\s+up\b.*/i, '').trim();

  // 7. Remove trailing slash and anything after  e.g. "B204/"  or  "LAB3(210) untill 10:15/"
  s = s.replace(/\s*\/.*$/, '').trim();

  // 8. Repeatedly strip trailing room/location tokens until stable
  //    Matches: B110, B 202, b109, A204, LAB, LAB3, LAB3(210), BIGLAB, BigLab,
  //             LINK, WEB, link, и102, WeB
  const TRAILING_ROOM = /\s+([Bb]\s?\d+\w*|[Aa]\d+|LAB\d*(\(\d+\))?|BIGLAB|BigLab|Lab\d*(\(\d+\))?|LINK|WEB|web|link|WeB|и\d+)$/i;
  let prev;
  do { prev = s; s = s.replace(TRAILING_ROOM, '').trim(); } while (s !== prev);

  // 9. Strip trailing "+ ..." noise  e.g. "+ make up"
  s = s.replace(/\s*\+.*$/, '').trim();

  // 10. Strip comma+room at end  e.g. ",B103"  or  ", B102 untill 16:10"
  s = s.replace(/,\s*[Bb]\d+.*$/, '').trim();

  // 11. Strip trailing comma / period
  s = s.replace(/[,]+$/, '').trim();

  // 12. Normalize title spacing so dot+space variants collapse to one form:
  //     "Dr.Ahmad" → "Dr. Ahmad"
  //     "Dr Ahmad" → "Dr. Ahmad"   (no dot)
  //     "Ms Iskra"  → "Ms. Iskra"
  //     "Mr.Talgat" → "Mr. Talgat"
  s = s.replace(/\b(Dr|Mr|Ms|Mrs|Prof)\.(\w)/g, '$1. $2');   // "Dr.X" → "Dr. X"
  s = s.replace(/\b(Dr|Mr|Ms|Mrs|Prof)\s+(?!\.)/g, '$1. ');  // "Dr X"  → "Dr. X"

  // 13. Collapse multiple spaces
  s = s.replace(/\s{2,}/g, ' ').trim();

  // 14. Exclude bare room strings that got mis-parsed as teacher names
  if (/^[Bb]\d+(\(\w+\))?$/.test(s)) return '';

  return s;
}

// Deduplicated sorted teacher list — normalises every raw string first
function buildTeacherList(scheduleMap) {
  const seen   = new Set();
  const result = [];
  Object.values(scheduleMap).forEach(entry => {
    const norm = normalizeTeacherName(entry.teacher);
    if (!norm || seen.has(norm)) return;
    seen.add(norm);
    result.push(norm);
  });
  return result.sort();
}

export const ScheduleProvider = ({ children }) => {
  const [groups,   setGroups]   = useState(UNIVERSITY_GROUPS);
  const [schedule, setSchedule] = useState({});
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [scheduleData, groupsData] = await Promise.all([
        scheduleAPI.getAll(),
        groupsAPI.getAll(),
      ]);
      setSchedule(scheduleData || {});
      if (groupsData?.length > 0) setGroups(groupsData);
    } catch (err) {
      console.error('Failed to load data from backend:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Clean deduplicated teacher list for the filter dropdown
  const teachers = buildTeacherList(schedule);

  // Match schedule entries by normalised teacher name so that selecting
  // "Dr. Remudin Mekuria" returns entries stored as any dirty variant
  const getScheduleByTeacher = (teacherName) => {
    const target = normalizeTeacherName(teacherName);
    return Object.entries(schedule).filter(
      ([, v]) => normalizeTeacherName(v.teacher) === target
    );
  };

  const addOrUpdateClass = async (group, day, time, classData) => {
    const { course, teacher, room, subjectType, duration = 1 } = classData;
    try {
      await scheduleAPI.save(group, day, time, course, teacher, room, subjectType, duration);
      const key = `${group}-${day}-${time}`;
      setSchedule(prev => ({
        ...prev,
        [key]: { group, day, time, course, teacher: teacher || '', room: room || '', subjectType: subjectType || 'lecture', duration }
      }));
    } catch (err) {
      alert(`Failed to save class: ${err.message}`);
    }
  };

  const deleteClass = async (group, day, time) => {
    try {
      await scheduleAPI.delete(group, day, time);
      const key = `${group}-${day}-${time}`;
      setSchedule(prev => { const next = { ...prev }; delete next[key]; return next; });
    } catch (err) {
      alert(`Failed to delete class: ${err.message}`);
    }
  };

  const moveClass = async (fromGroup, fromDay, fromTime, toGroup, toDay, toTime) => {
    const fromKey  = `${fromGroup}-${fromDay}-${fromTime}`;
    const toKey    = `${toGroup}-${toDay}-${toTime}`;
    const fromData = schedule[fromKey];
    const toData   = schedule[toKey];
    if (!fromData) return;
    try {
      await scheduleAPI.save(toGroup, toDay, toTime, fromData.course, fromData.teacher, fromData.room, fromData.subjectType);
      if (toData) {
        await scheduleAPI.save(fromGroup, fromDay, fromTime, toData.course, toData.teacher, toData.room, toData.subjectType);
      } else {
        await scheduleAPI.delete(fromGroup, fromDay, fromTime);
      }
      setSchedule(prev => {
        const next = { ...prev };
        next[toKey] = { ...fromData, group: toGroup, day: toDay, time: toTime };
        if (toData) { next[fromKey] = { ...toData, group: fromGroup, day: fromDay, time: fromTime }; }
        else { delete next[fromKey]; }
        return next;
      });
    } catch (err) {
      alert(`Failed to move class: ${err.message}`);
      loadAll();
    }
  };

  const addGroup = async (groupName) => {
    try {
      await groupsAPI.add(groupName);
      setGroups(prev => [...prev, groupName]);
    } catch (err) {
      alert(`Failed to add group: ${err.message}`);
    }
  };

  const deleteGroup = async (groupName) => {
    try {
      await groupsAPI.delete(groupName);
      setGroups(prev => prev.filter(g => g !== groupName));
      setSchedule(prev => {
        const next = {};
        Object.entries(prev).forEach(([k, v]) => { if (v.group !== groupName) next[k] = v; });
        return next;
      });
    } catch (err) {
      alert(`Failed to delete group: ${err.message}`);
    }
  };

  const clearSchedule = async () => {
    try {
      await Promise.all(Object.values(schedule).map(e => scheduleAPI.delete(e.group, e.day, e.time)));
      setSchedule({});
    } catch (err) {
      alert(`Failed to clear schedule: ${err.message}`);
      loadAll();
    }
  };

  const getClassByKey    = (group, day, time) => schedule[`${group}-${day}-${time}`] || null;
  const getScheduleByDay = (day) => Object.entries(schedule).filter(([, v]) => v.day === day);
  const exportSchedule   = () => JSON.stringify({ groups, schedule, exportDate: new Date().toISOString() }, null, 2);

  const importSchedule = async (jsonData) => {
    try {
      const data = JSON.parse(jsonData);
      let entries = [], groupList = [];
      if (Array.isArray(data)) {
        entries   = data;
        groupList = [...new Set(data.map(e => e.group).filter(Boolean))];
      } else if (data.schedule) {
        entries   = Object.values(data.schedule);
        groupList = data.groups || [...new Set(entries.map(e => e.group).filter(Boolean))];
      } else {
        return { success: false, error: 'Invalid data format' };
      }
      if (entries.length === 0) return { success: false, error: 'No schedule entries found in file' };

      if (scheduleAPI.bulk) {
        const result = await scheduleAPI.bulk(groupList, entries);
        if (!result.success) return { success: false, error: result.error || 'Bulk import failed' };
      } else {
        for (const g of groupList) {
          if (!groups.includes(g)) { try { await groupsAPI.add(g); } catch { /* exists */ } }
        }
        const BATCH = 10;
        for (let i = 0; i < entries.length; i += BATCH) {
          await Promise.all(entries.slice(i, i + BATCH).map(
            e => scheduleAPI.save(e.group, e.day, e.time, e.course, e.teacher, e.room, e.subjectType)
          ));
          if (i + BATCH < entries.length) await new Promise(r => setTimeout(r, 300));
        }
      }
      await loadAll();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  return (
    <ScheduleContext.Provider value={{
      groups, schedule, teachers,
      timeSlots: TIME_SLOTS,
      days: DAYS,
      loading, error,
      addOrUpdateClass, deleteClass, moveClass,
      addGroup, deleteGroup, clearSchedule,
      getClassByKey, getScheduleByDay, getScheduleByTeacher,
      exportSchedule, importSchedule,
      reload: loadAll,
    }}>
      {children}
    </ScheduleContext.Provider>
  );
};