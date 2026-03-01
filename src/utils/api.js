// src/utils/api.js — connects to Railway backend
const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
console.log('🔗 API connecting to:', BASE_URL);

const getToken = () =>
  localStorage.getItem('token') ||
  localStorage.getItem('scheduleToken') ||
  localStorage.getItem('authToken') || '';

// ── Retry helper ───────────────────────────────────────────────────────────
// Retries up to `retries` times with exponential backoff (500ms, 1000ms, 2000ms)
// This fixes the "first load fails" race condition where Railway cold-starts
const apiCall = async (endpoint, options = {}, retries = 3) => {
  const token = getToken();
  const url = `${BASE_URL}${endpoint}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
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
      // Network failure — retry if attempts remain
      if (attempt < retries) {
        const delay = attempt * 500; // 500ms, 1000ms, 1500ms
        console.warn(`⚠️ API attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
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
      // Don't retry 4xx errors — only retry on 5xx or network issues
      if (response.status >= 500 && attempt < retries) {
        const delay = attempt * 500;
        console.warn(`⚠️ Server error ${response.status}, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw new Error(data.error || data.message || `Request failed: ${response.status}`);
    }

    return data;
  }
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