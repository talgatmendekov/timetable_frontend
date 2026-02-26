// src/utils/api.js — connects to Railway backend
const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

console.log('🔗 API connecting to:', BASE_URL);

const getToken = () => localStorage.getItem('scheduleToken');

const apiCall = async (endpoint, options = {}) => {
  const token = getToken();
  const url = `${BASE_URL}${endpoint}`;
  let response;
  try {
    response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      ...options,
    });
  } catch (networkErr) {
    throw new Error(
      `Cannot reach server at ${BASE_URL}. ` +
      `Check your REACT_APP_API_URL in Vercel. (${networkErr.message})`
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      `Server at ${url} returned non-JSON (status ${response.status}). ` +
      `Your REACT_APP_API_URL may be wrong or missing /api at the end.`
    );
  }

  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed: ${response.status}`);
  }
  return data;
};

// ── Auth ───────────────────────────────────────────────────────────────────
export const authAPI = {
  login:  (username, password) => apiCall('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  verify: () => apiCall('/auth/verify'),
};

// ── Schedule ───────────────────────────────────────────────────────────────
export const scheduleAPI = {
  getAll: () => apiCall('/schedules'),

  save: (group, day, time, course, teacher, room, subjectType, duration = 1) =>
    apiCall('/schedules', {
      method: 'POST',
      body: JSON.stringify({ group, day, time, course, teacher, room, subjectType, duration }),
    }),

  // Bulk import: sends all classes in one request — no rate limit issues
  bulk: (groups, entries) =>
    apiCall('/schedules/bulk', {
      method: 'POST',
      body: JSON.stringify({
        groups,
        schedule: Object.fromEntries(
          entries.map(e => [`${e.group}-${e.day}-${e.time}`, e])
        ),
      }),
    }),

  delete: (group, day, time) =>
    apiCall('/schedules', { method: 'DELETE', body: JSON.stringify({ group, day, time }) }),
};

// ── Groups ─────────────────────────────────────────────────────────────────
export const groupsAPI = {
  getAll: () => apiCall('/groups'),
  add:    (name) => apiCall('/groups', { method: 'POST', body: JSON.stringify({ name }) }),
  delete: (name) => apiCall(`/groups/${encodeURIComponent(name)}`, { method: 'DELETE' }),
};