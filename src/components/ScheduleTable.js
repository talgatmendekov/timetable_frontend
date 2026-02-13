// src/components/ScheduleTable.js

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useSchedule } from '../context/ScheduleContext';
import './ScheduleTable.css';

const ScheduleTable = ({ selectedDay, selectedTeacher, onEditClass, onDeleteGroup }) => {
  const { isAuthenticated } = useAuth();
  const { groups, timeSlots, days, getClassByKey } = useSchedule();

  const daysToShow = selectedDay ? [selectedDay] : days;

  const shouldShowCell = (classData) => {
    if (!classData) return true;
    
    if (selectedTeacher && classData.teacher !== selectedTeacher) {
      return false;
    }
    
    return true;
  };

  const handleCellClick = (group, day, time) => {
    if (isAuthenticated) {
      onEditClass(group, day, time);
    }
  };

  const handleGroupDelete = (group) => {
    if (window.confirm(`Are you sure you want to delete group "${group}" and all its classes?`)) {
      onDeleteGroup(group);
    }
  };

  return (
    <div className="schedule-container">
      <div className="table-wrapper">
        <table className="schedule-table">
          <thead>
            <tr>
              <th className="group-header">
                Group / Time
                {!isAuthenticated && <div className="lock-icon">🔒</div>}
              </th>
              {daysToShow.map(day => (
                <th key={day} className="day-header" colSpan={timeSlots.length}>
                  {day}
                </th>
              ))}
            </tr>
            <tr>
              <th className="group-header"></th>
              {daysToShow.map(day =>
                timeSlots.map(time => (
                  <th key={`${day}-${time}`} className="time-header">
                    {time}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {groups.map(group => (
              <tr key={group}>
                <td className="group-cell">
                  <div className="group-cell-content">
                    <span className="group-name">{group}</span>
                    {isAuthenticated && (
                      <button
                        onClick={() => handleGroupDelete(group)}
                        className="delete-group-btn"
                        title="Delete group"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </td>
                {daysToShow.map(day =>
                  timeSlots.map(time => {
                    const classData = getClassByKey(group, day, time);
                    const show = shouldShowCell(classData);
                    
                    if (!show) {
                      return (
                        <td key={`${group}-${day}-${time}`} className="schedule-cell filtered-out">
                          <div className="filtered-label">Filtered</div>
                        </td>
                      );
                    }

                    return (
                      <td
                        key={`${group}-${day}-${time}`}
                        className={`schedule-cell ${classData ? 'filled' : ''} ${isAuthenticated ? 'editable' : ''}`}
                        onClick={() => handleCellClick(group, day, time)}
                      >
                        {classData ? (
                          <div className="cell-content">
                            <div className="course-name">{classData.course}</div>
                            {classData.teacher && (
                              <div className="teacher-name">👨‍🏫 {classData.teacher}</div>
                            )}
                            {classData.room && (
                              <div className="room-number">🚪 {classData.room}</div>
                            )}
                          </div>
                        ) : (
                          isAuthenticated && <div className="empty-cell">+</div>
                        )}
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ScheduleTable;
