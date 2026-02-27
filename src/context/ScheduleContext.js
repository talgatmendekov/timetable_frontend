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
// Strips trailing room tokens (B110, LAB, BIGLAB, LAB5(213), A202, и102 …)
// so that "Dr. Mekuria B202", "Dr. Mekuria B204", "Dr. Mekuria" all collapse
// to the same canonical name "Dr. Mekuria".
const ROOM_TOKEN = /^(B\d+|A\d+|LAB\d*(\(\d+\))?|BIGLAB|Lab\d*(\(\d+\))?|и\d+)$/i;

function normalizeTeacherName(raw) {
  if (!raw) return '';
  const parts = raw.trim().split(/\s+/);
  // Drop tokens from the right as long as they look like room identifiers
  let end = parts.length;
  while (end > 0 && ROOM_TOKEN.test(parts[end - 1])) end--;
  return parts.slice(0, end).join(' ').trim();
}

// Build a deduplicated, sorted teacher list from the schedule.
// Uses the *normalised* name for deduplication but keeps the
// shortest/cleanest version as the display value.
function buildTeacherList(scheduleMap) {
  // Collect all raw teacher strings
  const raw = Object.values(scheduleMap)
    .map(e => e.teacher)
    .filter(Boolean);

  // Map normalised name → best (shortest clean) display name
  const canonical = new Map(); // normalisedName → displayName
  raw.forEach(t => {
    const norm = normalizeTeacherName(t);
    if (!norm) return;
    if (!canonical.has(norm)) {
      canonical.set(norm, norm); // use the normalised form as display
    }
  });

  return [...canonical.values()].sort();
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

  // ── Deduplicated teacher list (normalised names, no room suffixes) ──────────
  const teachers = buildTeacherList(schedule);

  // ── getScheduleByTeacher must also match via normalised name ────────────────
  const getScheduleByTeacher = (teacherName) => {
    const normTarget = normalizeTeacherName(teacherName);
    return Object.entries(schedule).filter(
      ([, v]) => normalizeTeacherName(v.teacher) === normTarget
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

  // ── Import ─────────────────────────────────────────────────────────────────
  const importSchedule = async (jsonData) => {
    try {
      const data = JSON.parse(jsonData);

      let entries   = [];
      let groupList = [];

      if (Array.isArray(data)) {
        entries   = data;
        groupList = [...new Set(data.map(e => e.group).filter(Boolean))];
      } else if (data.schedule) {
        entries   = Object.values(data.schedule);
        groupList = data.groups || [...new Set(entries.map(e => e.group).filter(Boolean))];
      } else {
        return { success: false, error: 'Invalid data format' };
      }

      if (entries.length === 0)
        return { success: false, error: 'No schedule entries found in file' };

      if (scheduleAPI.bulk) {
        const result = await scheduleAPI.bulk(groupList, entries);
        if (!result.success) return { success: false, error: result.error || 'Bulk import failed' };
      } else {
        for (const g of groupList) {
          if (!groups.includes(g)) {
            try { await groupsAPI.add(g); } catch { /* already exists */ }
          }
        }
        const BATCH = 10;
        for (let i = 0; i < entries.length; i += BATCH) {
          const batch = entries.slice(i, i + BATCH);
          await Promise.all(
            batch.map(e => scheduleAPI.save(e.group, e.day, e.time, e.course, e.teacher, e.room, e.subjectType))
          );
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