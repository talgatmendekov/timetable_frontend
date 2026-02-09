// src/utils/api.js

/**
 * API Service for University Schedule Builder
 * 
 * This module provides a centralized interface for all backend API calls.
 * Currently uses localStorage for data persistence, but can be easily
 * extended to work with a real backend API.
 * 
 * To integrate with a backend:
 * 1. Update the BASE_URL to point to your backend server
 * 2. Uncomment and implement the actual API call functions
 * 3. Update the context files to use these API functions instead of localStorage
 */

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const apiCall = async (endpoint, options = {}) => {
  const token = localStorage.getItem('authToken');
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'API call failed');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Authentication API
export const authAPI = {
  login: async (username, password) => {
    return apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },

  logout: async () => {
    return apiCall('/auth/logout', { method: 'POST' });
  },

  verifyToken: async () => {
    return apiCall('/auth/verify');
  },

  register: async (username, password, role) => {
    return apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, role })
    });
  },

  changePassword: async (currentPassword, newPassword) => {
    return apiCall('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  }
};

// Schedule API
export const scheduleAPI = {
  getAll: async () => {
    return apiCall('/schedules');
  },

  saveClass: async (scheduleData) => {
    return apiCall('/schedules', {
      method: 'POST',
      body: JSON.stringify(scheduleData)
    });
  },

  deleteClass: async (group, day, time) => {
    return apiCall(`/schedules/${encodeURIComponent(group)}/${day}/${time}`, {
      method: 'DELETE'
    });
  },

  getByDay: async (day) => {
    return apiCall(`/schedules/day/${day}`);
  },

  getByTeacher: async (teacher) => {
    return apiCall(`/schedules/teacher/${encodeURIComponent(teacher)}`);
  },

  getByGroup: async (group) => {
    return apiCall(`/schedules/group/${encodeURIComponent(group)}`);
  },

  getAllTeachers: async () => {
    return apiCall('/schedules/teachers');
  }
};

// Groups API
export const groupsAPI = {
  getAll: async () => {
    return apiCall('/groups');
  },

  add: async (groupName) => {
    return apiCall('/groups', {
      method: 'POST',
      body: JSON.stringify({ name: groupName })
    });
  },

  delete: async (groupName) => {
    return apiCall(`/groups/${encodeURIComponent(groupName)}`, {
      method: 'DELETE'
    });
  }
};

const api = {
  auth: authAPI,
  schedule: scheduleAPI,
  groups: groupsAPI
};

export default api;