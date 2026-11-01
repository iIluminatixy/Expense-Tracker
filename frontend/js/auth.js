/**
 * auth.js - Login and Register page logic.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Redirect to dashboard if already logged in
  if (API.isLoggedIn()) {
    window.location.href = 'dashboard.html';
    return;
  }

  setupTabs();
  setupLoginForm();
  setupRegisterForm();
});

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------
function setupTabs() {
  const tabs = document.querySelectorAll('.auth-tab');
  const panels = document.querySelectorAll('.tab-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`panel-${target}`).classList.add('active');
      clearAlerts();
    });
  });
}

function clearAlerts() {
  document.querySelectorAll('.form-alert').forEach(el => {
    el.textContent = '';
    el.className = 'form-alert';
    el.style.display = 'none';
  });
}

function showAlert(elementId, message, type = 'error') {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.className = `alert alert-${type} form-alert`;
  el.style.display = 'flex';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ---------------------------------------------------------------------------
// Login Form
// ---------------------------------------------------------------------------
function setupLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlerts();
    const btn = form.querySelector('[type="submit"]');
    const username = form.querySelector('#login-username').value.trim();
    const password = form.querySelector('#login-password').value;

    if (!username || !password) {
      showAlert('login-alert', 'Please enter your username and password.');
      return;
    }

    setButtonLoading(btn, true, 'Logging in…');

    try {
      const data = await API.post('/auth/login/', { username, password });
      API.setToken(data.access, data.refresh);
      API.setCurrentUser(data.user);
      API.showToast('Welcome back! Redirecting…', 'success', 1500);
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);
    } catch (err) {
      showAlert('login-alert', err.message || 'Login failed. Please check your credentials.');
    } finally {
      setButtonLoading(btn, false, 'Log In');
    }
  });
}

// ---------------------------------------------------------------------------
// Register Form
// ---------------------------------------------------------------------------
function setupRegisterForm() {
  const form = document.getElementById('register-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlerts();
    const btn = form.querySelector('[type="submit"]');

    const username  = form.querySelector('#reg-username').value.trim();
    const email     = form.querySelector('#reg-email').value.trim();
    const firstName = form.querySelector('#reg-firstname').value.trim();
    const lastName  = form.querySelector('#reg-lastname').value.trim();
    const password  = form.querySelector('#reg-password').value;
    const password2 = form.querySelector('#reg-password2').value;

    if (!username || !email || !password) {
      showAlert('register-alert', 'Username, email, and password are required.');
      return;
    }

    if (password !== password2) {
      showAlert('register-alert', 'Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      showAlert('register-alert', 'Password must be at least 6 characters.');
      return;
    }

    setButtonLoading(btn, true, 'Creating account…');

    try {
      const data = await API.post('/auth/register/', {
        username,
        email,
        password,
        first_name: firstName,
        last_name: lastName,
      });
      API.setToken(data.access, data.refresh);
      API.setCurrentUser(data.user);
      API.showToast('Account created! Welcome aboard 🎉', 'success', 2000);
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
    } catch (err) {
      showAlert('register-alert', err.message || 'Registration failed. Please try again.');
    } finally {
      setButtonLoading(btn, false, 'Create Account');
    }
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function setButtonLoading(btn, loading, text) {
  btn.disabled = loading;
  btn.innerHTML = loading
    ? `<span class="loading-spinner" style="width:16px;height:16px;border-width:2px"></span> ${text}`
    : text;
}
