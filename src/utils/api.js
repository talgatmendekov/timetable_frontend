// src/utils/api.js — connects to Railway backend
const BASE_URL = process.env.REACT_APP_API_URL || 'https://timetablebackend-production.up.railway.app/api';
console.log('🔗 API connecting to:', BASE_URL);

const getToken = () =>
  localStorage.getItem('token') ||
  localStorage.getItem('scheduleToken') ||
  localStorage.getItem('authToken') || '';

// ── Retry helper ──────────────────────────────────────────────────────────────
// Retries up to `retries` times with exponential backoff on NETWORK errors only.
// 401/403 are auth failures — never retried (retrying with the same empty token
// just spams the console and delays UX on the login page).
const apiCall = async (endpoint, options = {}, retries = 3) => {
  const url = `${BASE_URL}${endpoint}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    // ⚠️  Token is read INSIDE the loop so each retry picks up a freshly-set
    //     token (e.g. after AuthContext finishes writing it to localStorage).
    const token = getToken();

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
      // Pure network failure — retry if attempts remain
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
      // 401 / 403 — auth problem, NEVER retry. Retrying just floods the console
      // and delays the login page while the token is still empty.
      if (response.status === 401 || response.status === 403) {
        throw new Error(data.error || data.message || `Auth failed: ${response.status}`);
      }
      // 5xx server errors — retry
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
  login: (username, password) => {
    // 🔍 DEBUG: remove after fix — shows exactly which component is calling login()
    console.trace('🔍 authAPI.login called, username:', username);
    return apiCall('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  },
  verify: () => apiCall('/auth/verify'),
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