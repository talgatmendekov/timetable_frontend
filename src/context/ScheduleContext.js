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

  // â”€â”€ Load everything from backend on mount â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Schedule mutations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const addOrUpdateClass = async (group, day, time, classData) => {
    const { course, teacher, room, subjectType, duration = 1 } = classData;
    try {
      await scheduleAPI.save(group, day, time, course, teacher, room, subjectType, duration);
      // Optimistic update
      const key = `${group}-${day}-${time}`;
      setSchedule(prev => ({
        ...prev,
        [key]: { group, day, time, course, teacher: teacher||'', room: room||'', subjectType: subjectType||'lecture', duration }
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

  // Move = update destination + delete source (or swap)
  const moveClass = async (fromGroup, fromDay, fromTime, toGroup, toDay, toTime) => {
    const fromKey = `${fromGroup}-${fromDay}-${fromTime}`;
    const toKey   = `${toGroup}-${toDay}-${toTime}`;
    const fromData = schedule[fromKey];
    const toData   = schedule[toKey];
    if (!fromData) return;

    try {
      // Save dragged class to new position
      await scheduleAPI.save(
        toGroup, toDay, toTime,
        fromData.course, fromData.teacher, fromData.room, fromData.subjectType
      );
      // If destination was occupied, move that class back to source position (swap)
      if (toData) {
        await scheduleAPI.save(
          fromGroup, fromDay, fromTime,
          toData.course, toData.teacher, toData.room, toData.subjectType
        );
      } else {
        // Source slot is now empty
        await scheduleAPI.delete(fromGroup, fromDay, fromTime);
      }

      // Optimistic state update
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
      loadAll(); // Re-sync from server on error
    }
  };

  // â”€â”€ Group mutations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      // Remove all schedule entries for this group from local state
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
    // Delete every entry from the backend
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

  // â”€â”€ Read helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const getClassByKey = (group, day, time) =>
    schedule[`${group}-${day}-${time}`] || null;

  const getScheduleByDay = (day) =>
    Object.entries(schedule).filter(([, v]) => v.day === day);

  const getScheduleByTeacher = (teacher) =>
    Object.entries(schedule).filter(([, v]) => v.teacher === teacher);

  // â”€â”€ Import / Export (still uses the backend format) â”€
  const exportSchedule = () =>
    JSON.stringify({ groups, schedule, exportDate: new Date().toISOString() }, null, 2);

  const importSchedule = async (jsonData) => {
    try {
      const data = JSON.parse(jsonData);
      if (!data.groups || !data.schedule)
        return { success: false, error: 'Invalid data format' };

      // Add any new groups first
      for (const g of data.groups) {
        if (!groups.includes(g)) {
          try { await groupsAPI.add(g); } catch { /* already exists */ }
        }
      }

      // Save every class
      await Promise.all(
        Object.values(data.schedule).map(e =>
          scheduleAPI.save(e.group, e.day, e.time, e.course, e.teacher, e.room, e.subjectType)
        )
      );

      await loadAll(); // Reload from backend to get canonical state
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