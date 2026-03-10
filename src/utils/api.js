// src/utils/api.js — connects to Railway backend
const BASE_URL = process.env.REACT_APP_API_URL || 'https://timetablebackend-production.up.railway.app/api';

const getToken = () =>
  localStorage.getItem('scheduleToken') ||
  localStorage.getItem('token') ||
  localStorage.getItem('authToken') || '';

// ── Retry helper ──────────────────────────────────────────────────────────────
const apiCall = async (endpoint, options = {}, retries = 3) => {
  const url = `${BASE_URL}${endpoint}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const token = getToken();

    let response;
    try {
      response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          // ⚠️ Only send Authorization header when a real token exists.
          // An empty "Bearer " header causes the backend to return 401
          // even for guests who never logged in.
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
        ...options,
      });
    } catch (networkErr) {
      if (attempt < retries) {
        const delay = attempt * 500;
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
        `Server at ${url} returned non-JSON (status ${response.status}).`
      );
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        // Silently return the error data — don't throw, don't log to console.
        // This prevents browser password manager autofill attempts from
        // showing as red 401 errors in the console.
        return { success: false, error: data.error || data.message || 'Auth failed' };
      }
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

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (username, password) =>
    apiCall('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  // ⚠️ Only call verify() when a token actually exists.
  // Calling it with no token sends "Bearer " to the backend which returns 401.
  verify: () => {
    const token = getToken();
    if (!token) return Promise.resolve({ success: false, valid: false });
    return apiCall('/auth/verify').catch(() => ({ success: false, valid: false }));
  },
};

// ── Schedule ─────────────────────────────────────────────────────────────────
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

// ── Groups ───────────────────────────────────────────────────────────────────
export const groupsAPI = {
  getAll: () => apiCall('/groups'),
  add:    (name) => apiCall('/groups', { method: 'POST', body: JSON.stringify({ name }) }),
  delete: (name) => apiCall(`/groups/${encodeURIComponent(name)}`, { method: 'DELETE' }),
};