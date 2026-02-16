// src/context/ScheduleContext.js

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UNIVERSITY_GROUPS, TIME_SLOTS, DAYS } from '../data/constants';

const ScheduleContext = createContext();

export const useSchedule = () => {
  const context = useContext(ScheduleContext);
  if (!context) throw new Error('useSchedule must be used within a ScheduleProvider');
  return context;
};

export const ScheduleProvider = ({ children }) => {
  const [groups, setGroups] = useState(UNIVERSITY_GROUPS);
  const [schedule, setSchedule] = useState({});
  const [teachers, setTeachers] = useState(new Set());

  useEffect(() => {
    const savedSchedule = localStorage.getItem('universitySchedule');
    const savedGroups = localStorage.getItem('universityGroups');
    if (savedSchedule) {
      const parsed = JSON.parse(savedSchedule);
      setSchedule(parsed);
      extractTeachers(parsed);
    }
    if (savedGroups) setGroups(JSON.parse(savedGroups));
  }, []);

  const extractTeachers = (scheduleData) => {
    const teacherSet = new Set();
    Object.values(scheduleData).forEach(e => { if (e.teacher) teacherSet.add(e.teacher); });
    setTeachers(teacherSet);
  };

  const saveSchedule = (newSchedule) => {
    setSchedule(newSchedule);
    localStorage.setItem('universitySchedule', JSON.stringify(newSchedule));
    extractTeachers(newSchedule);
  };

  const addOrUpdateClass = (group, day, time, classData) => {
    const key = `${group}-${day}-${time}`;
    saveSchedule({ ...schedule, [key]: { ...classData, group, day, time } });
  };

  const deleteClass = (group, day, time) => {
    const newSchedule = { ...schedule };
    delete newSchedule[`${group}-${day}-${time}`];
    saveSchedule(newSchedule);
  };

  // Move a class from one slot to another (drag & drop)
  const moveClass = (fromGroup, fromDay, fromTime, toGroup, toDay, toTime) => {
    const fromKey = `${fromGroup}-${fromDay}-${fromTime}`;
    const toKey = `${toGroup}-${toDay}-${toTime}`;
    const classData = schedule[fromKey];
    if (!classData) return { success: false, error: 'Source class not found' };

    const newSchedule = { ...schedule };

    // If destination is occupied, swap
    const destData = schedule[toKey];
    if (destData) {
      newSchedule[fromKey] = { ...destData, group: fromGroup, day: fromDay, time: fromTime };
    } else {
      delete newSchedule[fromKey];
    }

    newSchedule[toKey] = { ...classData, group: toGroup, day: toDay, time: toTime };
    saveSchedule(newSchedule);
    return { success: true };
  };

  const addGroup = (groupName) => {
    const newGroups = [...groups, groupName];
    setGroups(newGroups);
    localStorage.setItem('universityGroups', JSON.stringify(newGroups));
  };

  const deleteGroup = (groupName) => {
    const newGroups = groups.filter(g => g !== groupName);
    setGroups(newGroups);
    localStorage.setItem('universityGroups', JSON.stringify(newGroups));
    const newSchedule = {};
    Object.entries(schedule).forEach(([key, value]) => {
      if (value.group !== groupName) newSchedule[key] = value;
    });
    saveSchedule(newSchedule);
  };

  const clearSchedule = () => saveSchedule({});

  const getClassByKey = (group, day, time) => schedule[`${group}-${day}-${time}`] || null;

  const getScheduleByDay = (day) =>
    Object.entries(schedule).filter(([_, v]) => v.day === day);

  const getScheduleByTeacher = (teacher) =>
    Object.entries(schedule).filter(([_, v]) => v.teacher === teacher);

  const exportSchedule = () =>
    JSON.stringify({ groups, schedule, exportDate: new Date().toISOString() }, null, 2);

  const importSchedule = (jsonData) => {
    try {
      const data = JSON.parse(jsonData);
      if (data.groups && data.schedule) {
        setGroups(data.groups);
        saveSchedule(data.schedule);
        localStorage.setItem('universityGroups', JSON.stringify(data.groups));
        return { success: true };
      }
      return { success: false, error: 'Invalid data format' };
    } catch {
      return { success: false, error: 'Invalid JSON' };
    }
  };

  const value = {
    groups, schedule,
    teachers: Array.from(teachers),
    timeSlots: TIME_SLOTS,
    days: DAYS,
    addOrUpdateClass, deleteClass, moveClass,
    addGroup, deleteGroup, clearSchedule,
    getClassByKey, getScheduleByDay, getScheduleByTeacher,
    exportSchedule, importSchedule
  };

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
};
