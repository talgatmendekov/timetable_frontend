// src/utils/api.js â€” connects to Railway backend

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Log the URL being used so we can debug in browser console
console.log('ðŸ”— API connecting to:', BASE_URL);

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
    // Network failure â€” server unreachable or CORS blocked
    throw new Error(
      `Cannot reach server at ${BASE_URL}. ` +
      `Check your REACT_APP_API_URL in Vercel. (${networkErr.message})`
    );
  }

  // Try to parse JSON â€” if server returned HTML (error page) this will fail
  let data;
  try {
    data = await response.json();
  } catch {
    // Not JSON â€” server returned an HTML error page
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

// â”€â”€ Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const authAPI = {
  login: (username, password) =>
    apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  verify: () => apiCall('/auth/verify'),
};

// â”€â”€ Schedule â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const scheduleAPI = {
  getAll: () => apiCall('/schedules'),

  save: (group, day, time, course, teacher, room, subjectType, duration = 1) =>
    apiCall('/schedules', {
      method: 'POST',
      body: JSON.stringify({ group, day, time, course, teacher, room, subjectType, duration }),
    }),

  delete: (group, day, time) =>
    apiCall(
      `/schedules/${encodeURIComponent(group)}/${day}/${encodeURIComponent(time)}`,
      { method: 'DELETE' }
    ),
};

// â”€â”€ Groups â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const groupsAPI = {
  getAll: () => apiCall('/groups'),

  add: (name) =>
    apiCall('/groups', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  delete: (name) =>
    apiCall(`/groups/${encodeURIComponent(name)}`, { method: 'DELETE' }),
};