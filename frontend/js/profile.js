/**
 * profile.js - Profile & Settings page logic.
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!API.isLoggedIn()) {
    API.redirectToLogin();
    return;
  }

  setupNav();
  setupBioCounter();
  setupNotificationPrefs();
  setupAvatarUpload();
  setupProfileForm();
  await loadProfile();
});

// ---------------------------------------------------------------------------
// Navbar Setup
// ---------------------------------------------------------------------------
function setupNav() {
  const user = API.getCurrentUser();
  if (user) {
    updateNavUser(user);
  }

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    API.removeToken();
    window.location.href = 'index.html';
  });
}

function updateNavUser(user) {
  const nameEl = document.getElementById('nav-username');
  const avatarContainer = document.getElementById('nav-avatar-container');
  if (nameEl) nameEl.textContent = user.first_name || user.username;
  if (avatarContainer) {
    avatarContainer.innerHTML = API.renderAvatarElement(user, 'avatar-sm');
  }
}

// ---------------------------------------------------------------------------
// Load Profile Data
// ---------------------------------------------------------------------------
async function loadProfile() {
  try {
    const data = await API.get('/auth/profile/');
    
    // Update inputs
    const usernameInput = document.getElementById('profile-username');
    const emailInput = document.getElementById('profile-email');
    const bioInput = document.getElementById('profile-bio');
    const bioCount = document.getElementById('bio-count');

    if (usernameInput) usernameInput.value = data.username || '';
    if (emailInput) emailInput.value = data.email || '';
    if (bioInput) {
      bioInput.value = data.bio || '';
      if (bioCount) bioCount.textContent = `${bioInput.value.length}/200`;
    }

    // Render avatar
    renderProfileAvatar(data);

    // Update stored user object with avatar_url
    const current = API.getCurrentUser() || {};
    current.username = data.username;
    current.email = data.email;
    current.avatar_url = data.avatar_url;
    API.setCurrentUser(current);
    updateNavUser(current);

  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

function renderProfileAvatar(data) {
  const container = document.getElementById('profile-avatar-container');
  if (!container) return;
  const userObj = {
    username: data.username,
    first_name: data.first_name,
    avatar_url: data.avatar_url,
  };
  container.innerHTML = API.renderAvatarElement(userObj, 'avatar-xl');
}

// ---------------------------------------------------------------------------
// Avatar Upload Handling
// ---------------------------------------------------------------------------
function setupAvatarUpload() {
  const wrapper = document.getElementById('avatar-wrapper');
  const fileInput = document.getElementById('avatar-input');

  if (!wrapper || !fileInput) return;

  wrapper.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      API.showToast('Please select a valid image file (JPG, PNG).', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      API.showToast('Image size should be less than 5MB.', 'error');
      return;
    }

    // Preview immediately
    const reader = new FileReader();
    reader.onload = (event) => {
      const container = document.getElementById('profile-avatar-container');
      if (container) {
        container.innerHTML = `<img src="${event.target.result}" alt="Avatar Preview" class="avatar-img avatar-xl">`;
      }
    };
    reader.readAsDataURL(file);

    // Upload to backend
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      API.showToast('Uploading photo…', 'info', 2000);
      const res = await API.upload('/auth/profile/', formData);
      API.showToast('Profile photo updated successfully!', 'success');
      
      const current = API.getCurrentUser() || {};
      current.avatar_url = res.avatar_url;
      API.setCurrentUser(current);
      updateNavUser(current);
      renderProfileAvatar(res);
    } catch (err) {
      API.showToast(err.message || 'Failed to upload photo.', 'error');
      // Revert preview on failure
      const user = API.getCurrentUser();
      if (user) renderProfileAvatar(user);
    }
  });
}

// ---------------------------------------------------------------------------
// Bio / Profile Form Submit
// ---------------------------------------------------------------------------
function setupBioCounter() {
  const bioInput = document.getElementById('profile-bio');
  const bioCount = document.getElementById('bio-count');
  if (!bioInput || !bioCount) return;

  bioInput.addEventListener('input', () => {
    bioCount.textContent = `${bioInput.value.length}/200`;
  });
}

function setupProfileForm() {
  const form = document.getElementById('profile-form');
  const saveBtn = document.getElementById('save-profile-btn');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bio = document.getElementById('profile-bio')?.value.trim() || '';

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
      await API.patch('/auth/profile/', { bio });
      API.showToast('Profile details updated!', 'success');
    } catch (err) {
      API.showToast(err.message || 'Failed to update profile.', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Profile';
    }
  });
}

// ---------------------------------------------------------------------------
// Notification Preferences
// ---------------------------------------------------------------------------
const PREFS_KEY = 'notification_prefs';

function setupNotificationPrefs() {
  const expenseToggle = document.getElementById('notify-expense');
  const groupToggle = document.getElementById('notify-group');
  const settleToggle = document.getElementById('notify-settle');
  const saveBtn = document.getElementById('save-notify-btn');

  // Load saved preferences
  const raw = localStorage.getItem(PREFS_KEY);
  if (raw) {
    try {
      const prefs = JSON.parse(raw);
      if (expenseToggle) expenseToggle.checked = !!prefs.notify_expense;
      if (groupToggle) groupToggle.checked = !!prefs.notify_group;
      if (settleToggle) settleToggle.checked = !!prefs.notify_settle;
    } catch {}
  }

  saveBtn?.addEventListener('click', () => {
    const prefs = {
      notify_expense: expenseToggle ? expenseToggle.checked : true,
      notify_group: groupToggle ? groupToggle.checked : true,
      notify_settle: settleToggle ? settleToggle.checked : true,
    };
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    API.showToast('Notification preferences saved!', 'success');
  });
}
