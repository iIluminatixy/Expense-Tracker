/**
 * api.js - Central API helper with JWT token management and fetch wrapper.
 */

const API_BASE = 'http://127.0.0.1:8000/api';

// ---------------------------------------------------------------------------
// Token Management
// ---------------------------------------------------------------------------
function getToken() {
  return localStorage.getItem('access_token');
}

function setToken(access, refresh) {
  localStorage.setItem('access_token', access);
  if (refresh) localStorage.setItem('refresh_token', refresh);
}

function getRefreshToken() {
  return localStorage.getItem('refresh_token');
}

function removeToken() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('current_user');
}

function setCurrentUser(user) {
  localStorage.setItem('current_user', JSON.stringify(user));
}

function getCurrentUser() {
  const raw = localStorage.getItem('current_user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function isLoggedIn() {
  return !!getToken();
}

function redirectToLogin() {
  removeToken();
  window.location.href = 'index.html';
}

// ---------------------------------------------------------------------------
// Token Refresh
// ---------------------------------------------------------------------------
async function tryRefreshToken() {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setToken(data.access, null);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Core Fetch Wrapper
// ---------------------------------------------------------------------------
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  let res = await fetch(url, { ...options, headers });

  // Attempt token refresh on 401
  if (res.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getToken()}`;
      res = await fetch(url, { ...options, headers });
    } else {
      redirectToLogin();
      throw new Error('Session expired. Please log in again.');
    }
  }

  // No content
  if (res.status === 204) return null;

  let data;
  try {
    data = await res.json();
  } catch {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return null;
  }

  if (!res.ok) {
    // Build a human-friendly error message from DRF error responses
    const message = extractErrorMessage(data);
    throw new Error(message);
  }

  return data;
}

function extractErrorMessage(data) {
  if (!data) return 'An unknown error occurred.';
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  if (data.error) return data.error;
  if (data.non_field_errors) return data.non_field_errors.join(' ');

  // Collect field-level errors
  const messages = [];
  for (const [field, errors] of Object.entries(data)) {
    const errText = Array.isArray(errors) ? errors.join(' ') : String(errors);
    messages.push(`${field}: ${errText}`);
  }
  return messages.join('\n') || 'An error occurred.';
}

// ---------------------------------------------------------------------------
// Convenience Methods
// ---------------------------------------------------------------------------
async function get(path) {
  return apiFetch(path, { method: 'GET' });
}

async function post(path, data) {
  return apiFetch(path, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async function put(path, data) {
  return apiFetch(path, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

async function patch(path, data) {
  return apiFetch(path, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ---------------------------------------------------------------------------
// File Upload & Download Helpers
// ---------------------------------------------------------------------------
async function upload(path, formData, method = 'PATCH') {
  const token = getToken();
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  let res = await fetch(url, {
    method,
    headers,
    body: formData,
  });

  if (res.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getToken()}`;
      res = await fetch(url, { method, headers, body: formData });
    } else {
      redirectToLogin();
      throw new Error('Session expired. Please log in again.');
    }
  }

  if (res.status === 204) return null;

  let data;
  try {
    data = await res.json();
  } catch {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return null;
  }

  if (!res.ok) {
    throw new Error(extractErrorMessage(data));
  }
  return data;
}

async function download(path, defaultFilename = 'download') {
  const token = getToken();
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  let res = await fetch(url, { method: 'GET', headers });

  if (res.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getToken()}`;
      res = await fetch(url, { method: 'GET', headers });
    } else {
      redirectToLogin();
      throw new Error('Session expired. Please log in again.');
    }
  }

  if (!res.ok) {
    let errMessage = `Download failed (${res.status})`;
    try {
      const errData = await res.json();
      errMessage = extractErrorMessage(errData);
    } catch {}
    throw new Error(errMessage);
  }

  let filename = defaultFilename;
  const disposition = res.headers.get('Content-Disposition');
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename=["']?([^"';]+)["']?/);
    if (match && match[1]) filename = match[1];
  }

  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(downloadUrl);
}

// ---------------------------------------------------------------------------
// Avatar / Color Utilities
// ---------------------------------------------------------------------------
const AVATAR_COLORS = [
  '#4F46E5', '#7C3AED', '#2563EB', '#0D9488',
  '#059669', '#D97706', '#DC2626', '#DB2777'
];

function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function getUserInitials(name) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function renderAvatarElement(user, customClass = '') {
  const name = (user?.first_name || user?.username || 'User');
  const initials = getUserInitials(name);
  const color = getAvatarColor(user?.username || name);
  let avatarUrl = user?.avatar_url;
  if (avatarUrl && !avatarUrl.startsWith('http')) {
    avatarUrl = `http://127.0.0.1:8000${avatarUrl}`;
  }

  if (avatarUrl) {
    return `<img src="${avatarUrl}" alt="${name}" class="avatar-img ${customClass}" onerror="this.outerHTML='<div class=\\'user-avatar ${customClass}\\' style=\\'background-color:${color}\\'>${initials}</div>'">`;
  }
  return `<div class="user-avatar ${customClass}" style="background-color: ${color};">${initials}</div>`;
}

// ---------------------------------------------------------------------------
// Toast Notifications
// ---------------------------------------------------------------------------
function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slide-in 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Expose to window
window.API = {
  get, post, put, patch, upload, download, apiFetch,
  getToken, setToken, removeToken, getRefreshToken,
  setCurrentUser, getCurrentUser, isLoggedIn, redirectToLogin,
  getUserInitials, getAvatarColor, renderAvatarElement,
  showToast,
};
