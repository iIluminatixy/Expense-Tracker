/**
 * dashboard.js - Groups overview page logic.
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!API.isLoggedIn()) { API.redirectToLogin(); return; }

  setupNav();
  await loadGroups();
  setupCreateGroupModal();
  setupAddMemberModal();
});

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------
function setupNav() {
  const user = API.getCurrentUser();
  if (user) {
    updateNavUI(user);
  }

  // Fetch fresh user profile in background
  API.get('/auth/me/').then((freshUser) => {
    API.setCurrentUser(freshUser);
    updateNavUI(freshUser);
  }).catch(() => {});

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      API.removeToken();
      window.location.href = 'index.html';
    });
  }
}

function updateNavUI(user) {
  const nameEl = document.getElementById('nav-username');
  const avatarContainer = document.getElementById('nav-avatar-container');
  if (nameEl) nameEl.textContent = user.first_name || user.username;
  if (avatarContainer) {
    avatarContainer.innerHTML = API.renderAvatarElement(user, 'avatar-sm');
  }
}

// ---------------------------------------------------------------------------
// Load Groups
// ---------------------------------------------------------------------------
async function loadGroups() {
  const container = document.getElementById('groups-container');
  if (!container) return;

  container.innerHTML = `
    <div class="loading-overlay">
      <div class="loading-spinner" style="width:36px;height:36px;border-width:3px"></div>
      <span>Loading groups…</span>
    </div>
  `;

  try {
    const groups = await API.get('/groups/');
    renderGroups(groups, container);
  } catch (err) {
    container.innerHTML = `
      <div class="alert alert-error">${err.message}</div>
    `;
  }
}

function renderGroups(groups, container) {
  if (!groups || groups.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👥</div>
        <p class="empty-title">No groups yet</p>
        <p class="empty-desc">Create your first group to start tracking shared expenses.</p>
        <button class="btn btn-primary" onclick="openCreateModal()">
          + Create Group
        </button>
      </div>
    `;
    return;
  }

  const html = groups.map(g => groupCardHTML(g)).join('');
  container.innerHTML = `<div class="grid grid-2" style="align-items:start">${html}</div>`;

  // Attach add-member buttons
  container.querySelectorAll('.add-member-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const groupId = btn.dataset.groupId;
      const groupName = btn.dataset.groupName;
      openAddMemberModal(groupId, groupName);
    });
  });
}

function groupCardHTML(g) {
  const total = parseFloat(g.total_expenses || 0).toLocaleString('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 2,
  });

  return `
    <div class="card group-card" onclick="window.location.href='group.html?id=${g.id}'">
      <div class="group-card-body">
        <div class="group-card-title">${escHtml(g.name)}</div>
        <div class="group-card-desc">${escHtml(g.description || 'No description')}</div>
        <div class="group-card-meta">
          <span class="meta-item">
            <span class="meta-icon">👤</span>
            ${g.member_count} member${g.member_count !== 1 ? 's' : ''}
          </span>
          <span class="meta-item">
            <span class="meta-icon">🧾</span>
            ${g.expense_count} expense${g.expense_count !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      <div class="group-card-footer">
        <span class="total-amount">Total: ${total}</span>
        <button class="btn btn-sm btn-secondary add-member-btn"
          data-group-id="${g.id}" data-group-name="${escHtml(g.name)}">
          + Member
        </button>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Create Group Modal
// ---------------------------------------------------------------------------
function setupCreateGroupModal() {
  const modal = document.getElementById('create-group-modal');
  if (!modal) return;

  const form = document.getElementById('create-group-form');
  const alertEl = document.getElementById('create-group-alert');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertEl.style.display = 'none';

    const name = form.querySelector('#group-name').value.trim();
    const description = form.querySelector('#group-desc').value.trim();

    if (!name) {
      showModalAlert(alertEl, 'Group name is required.');
      return;
    }

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner" style="width:14px;height:14px;border-width:2px"></span> Creating…';

    try {
      await API.post('/groups/', { name, description });
      API.showToast('Group created successfully!', 'success');
      closeModal('create-group-modal');
      form.reset();
      await loadGroups();
    } catch (err) {
      showModalAlert(alertEl, err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Group';
    }
  });
}

function openCreateModal() {
  document.getElementById('create-group-form').reset();
  document.getElementById('create-group-alert').style.display = 'none';
  openModal('create-group-modal');
}

// ---------------------------------------------------------------------------
// Add Member Modal
// ---------------------------------------------------------------------------
let currentAddMemberGroupId = null;

function setupAddMemberModal() {
  const form = document.getElementById('add-member-form');
  const alertEl = document.getElementById('add-member-alert');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertEl.style.display = 'none';

    const username = form.querySelector('#member-username').value.trim();
    if (!username) {
      showModalAlert(alertEl, 'Please enter a username.'); return;
    }
    if (!currentAddMemberGroupId) return;

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner" style="width:14px;height:14px;border-width:2px"></span> Adding…';

    try {
      await API.post(`/groups/${currentAddMemberGroupId}/members/`, { username });
      API.showToast(`${username} added to group!`, 'success');
      closeModal('add-member-modal');
      form.reset();
      await loadGroups();
    } catch (err) {
      showModalAlert(alertEl, err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Add Member';
    }
  });
}

function openAddMemberModal(groupId, groupName) {
  currentAddMemberGroupId = groupId;
  document.getElementById('add-member-group-name').textContent = groupName;
  document.getElementById('add-member-form').reset();
  document.getElementById('add-member-alert').style.display = 'none';
  openModal('add-member-modal');
}

// ---------------------------------------------------------------------------
// Modal helpers
// ---------------------------------------------------------------------------
function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function showModalAlert(el, msg) {
  el.textContent = msg;
  el.className = 'alert alert-error';
  el.style.display = 'flex';
}

// Expose for inline onclick
window.openCreateModal = openCreateModal;
window.openAddMemberModal = openAddMemberModal;
window.closeModal = closeModal;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
