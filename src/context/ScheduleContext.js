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

export const ScheduleProvider = ({ children }) => {
  const [groups,   setGroups]   = useState(UNIVERSITY_GROUPS);
  const [schedule, setSchedule] = useState({});
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  // ── Load everything from backend on mount ──────────────────────────────────
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

  // Derived: list of unique teachers from schedule
  const teachers = [...new Set(
    Object.values(schedule)
      .map(e => e.teacher)
      .filter(Boolean)
  )].sort();

  // ── Schedule mutations ─────────────────────────────────────────────────────
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
      setSchedule(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (err) {
      alert(`Failed to delete class: ${err.message}`);
    }
  };

  const moveClass = async (fromGroup, fromDay, fromTime, toGroup, toDay, toTime) => {
    const fromKey = `${fromGroup}-${fromDay}-${fromTime}`;
    const toKey   = `${toGroup}-${toDay}-${toTime}`;
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
        if (toData) {
          next[fromKey] = { ...toData, group: fromGroup, day: fromDay, time: fromTime };
        } else {
          delete next[fromKey];
        }
        return next;
      });
    } catch (err) {
      alert(`Failed to move class: ${err.message}`);
      loadAll();
    }
  };

  // ── Group mutations ────────────────────────────────────────────────────────
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
        Object.entries(prev).forEach(([k, v]) => {
          if (v.group !== groupName) next[k] = v;
        });
        return next;
      });
    } catch (err) {
      alert(`Failed to delete group: ${err.message}`);
    }
  };

  const clearSchedule = async () => {
    try {
      await Promise.all(
        Object.values(schedule).map(e => scheduleAPI.delete(e.group, e.day, e.time))
      );
      setSchedule({});
    } catch (err) {
      alert(`Failed to clear schedule: ${err.message}`);
      loadAll();
    }
  };

  // ── Read helpers ───────────────────────────────────────────────────────────
  const getClassByKey = (group, day, time) =>
    schedule[`${group}-${day}-${time}`] || null;

  const getScheduleByDay = (day) =>
    Object.entries(schedule).filter(([, v]) => v.day === day);

  const getScheduleByTeacher = (teacher) =>
    Object.entries(schedule).filter(([, v]) => v.teacher === teacher);

  // ── Export ─────────────────────────────────────────────────────────────────
  const exportSchedule = () =>
    JSON.stringify({ groups, schedule, exportDate: new Date().toISOString() }, null, 2);

  // ── Import — uses bulk endpoint: 1 request for all 444 classes ────────────
  const importSchedule = async (jsonData) => {
    try {
      const data = JSON.parse(jsonData);

      // Support both formats:
      //   { groups, schedule }  ← from importFromExcel / exportSchedule
      //   Array of class objects ← from parseAlatooSchedule
      let entries = [];
      let groupList = [];

      if (Array.isArray(data)) {
        // Alatoo parser returns a flat array
        entries = data;
        groupList = [...new Set(data.map(e => e.group).filter(Boolean))];
      } else if (data.schedule) {
        // Generic import returns { groups, schedule }
        entries = Object.values(data.schedule);
        groupList = data.groups || [...new Set(entries.map(e => e.group).filter(Boolean))];
      } else {
        return { success: false, error: 'Invalid data format' };
      }

      if (entries.length === 0)
        return { success: false, error: 'No schedule entries found' };

      // Single bulk request — no rate limit issues
      const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('token');

      const response = await fetch(`${apiBase}/schedules/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ groups: groupList, schedule: Object.fromEntries(entries.map(e => [`${e.group}-${e.day}-${e.time}`, e])) }),
      });

      if (!response.ok) {
        const text = await response.text();
        let msg = `Server error ${response.status}`;
        try { msg = JSON.parse(text).error || msg; } catch {}
        return { success: false, error: msg };
      }

      const result = await response.json();
      if (!result.success) return { success: false, error: result.error || 'Bulk import failed' };

      await loadAll(); // Reload canonical state from backend
      return { success: true, imported: result.imported };

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