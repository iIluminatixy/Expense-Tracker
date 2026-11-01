/**
 * group.js - Group detail page logic.
 */

let currentGroup = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!API.isLoggedIn()) { API.redirectToLogin(); return; }

  const params = new URLSearchParams(window.location.search);
  const groupId = params.get('id');
  if (!groupId) { window.location.href = 'dashboard.html'; return; }

  setupNav();
  await loadGroup(groupId);
  setupAddMemberModal(groupId);
});

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------
function setupNav() {
  const user = API.getCurrentUser();
  if (user) {
    updateNavUI(user);
  }

  API.get('/auth/me/').then((freshUser) => {
    API.setCurrentUser(freshUser);
    updateNavUI(freshUser);
  }).catch(() => {});

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    API.removeToken();
    window.location.href = 'index.html';
  });
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
// Load Group
// ---------------------------------------------------------------------------
async function loadGroup(groupId) {
  try {
    const group = await API.get(`/groups/${groupId}/`);
    currentGroup = group;
    renderGroupHeader(group);
    renderMembers(group.members);

    await loadExpenses(groupId);
  } catch (err) {
    document.getElementById('group-content').innerHTML = `
      <div class="alert alert-error">${err.message}</div>
      <a href="dashboard.html" class="btn btn-secondary" style="margin-top:1rem">← Back to Dashboard</a>
    `;
  }
}

function renderGroupHeader(group) {
  document.title = `${group.name} — Expense Tracker`;

  const titleEl = document.getElementById('group-title');
  const descEl = document.getElementById('group-desc');
  const addExpBtn = document.getElementById('add-expense-btn');
  const settlementBtn = document.getElementById('settlement-btn');

  if (titleEl) titleEl.textContent = group.name;
  if (descEl) descEl.textContent = group.description || '';

  if (addExpBtn) {
    addExpBtn.href = `add-expense.html?group=${group.id}`;
  }
  if (settlementBtn) {
    settlementBtn.href = `settlement.html?group=${group.id}`;
  }
}

function renderMembers(members) {
  const container = document.getElementById('members-container');
  if (!container) return;

  if (!members || members.length === 0) {
    container.innerHTML = '<span class="meta-item" style="color:var(--gray-400)">No members yet</span>';
    return;
  }

  container.innerHTML = members.map(m => {
    const initial = API.getUserInitials(m.first_name || m.username);
    const color = API.getAvatarColor(m.username);
    const name = m.first_name ? `${m.first_name} ${m.last_name}`.trim() : m.username;
    let avatarHtml = `<div class="chip-avatar" style="background-color:${color}">${initial}</div>`;
    if (m.avatar_url) {
      const src = m.avatar_url.startsWith('http') ? m.avatar_url : `http://127.0.0.1:8000${m.avatar_url}`;
      avatarHtml = `<img src="${src}" alt="${name}" class="chip-avatar" style="object-fit:cover;" onerror="this.outerHTML='<div class=\\'chip-avatar\\' style=\\'background-color:${color}\\'>${initial}</div>'">`;
    }
    return `
      <div class="member-chip">
        ${avatarHtml}
        <span>${escHtml(name)}</span>
      </div>
    `;
  }).join('');
}

// ---------------------------------------------------------------------------
// Load Expenses
// ---------------------------------------------------------------------------
async function loadExpenses(groupId) {
  const container = document.getElementById('expenses-container');
  if (!container) return;

  container.innerHTML = `
    <div class="loading-overlay">
      <div class="loading-spinner" style="width:28px;height:28px;border-width:2.5px"></div>
      <span>Loading expenses…</span>
    </div>
  `;

  try {
    const expenses = await API.get(`/groups/${groupId}/expenses/`);
    renderExpenses(expenses, container);
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error" style="margin:1rem">${err.message}</div>`;
  }
}

function renderExpenses(expenses, container) {
  if (!expenses || expenses.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💸</div>
        <p class="empty-title">No expenses yet</p>
        <p class="empty-desc">Add the first expense to this group to start tracking costs.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = expenses.map(expense => expenseItemHTML(expense)).join('');
}

function expenseItemHTML(expense) {
  const amount = parseFloat(expense.amount).toLocaleString('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 2,
  });
  const paidBy = expense.paid_by?.first_name
    ? `${expense.paid_by.first_name} ${expense.paid_by.last_name}`.trim()
    : expense.paid_by?.username || '—';
  const date = new Date(expense.date).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  const badge = expense.split_type === 'equal'
    ? '<span class="badge badge-primary">Equal</span>'
    : '<span class="badge badge-warning">Custom</span>';

  return `
    <div class="expense-item" onclick="window.location.href='#'" style="cursor:default">
      <div class="expense-info">
        <div class="expense-title">${escHtml(expense.title)}</div>
        <div class="expense-meta">
          Paid by <strong>${escHtml(paidBy)}</strong> · ${date} · ${badge}
        </div>
      </div>
      <div class="expense-amount">${amount}</div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Add Member Modal
// ---------------------------------------------------------------------------
function setupAddMemberModal(groupId) {
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

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner" style="width:14px;height:14px;border-width:2px"></span> Adding…';

    try {
      const updated = await API.post(`/groups/${groupId}/members/`, { username });
      API.showToast(`${username} added!`, 'success');
      closeModal('add-member-modal');
      form.reset();
      renderMembers(updated.members);
    } catch (err) {
      showModalAlert(alertEl, err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Add Member';
    }
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function showModalAlert(el, msg) {
  el.textContent = msg;
  el.className = 'alert alert-error';
  el.style.display = 'flex';
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// ---------------------------------------------------------------------------
// Export Dropdown & Download
// ---------------------------------------------------------------------------
function toggleExportMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('export-menu');
  if (menu) menu.classList.toggle('show');
}

// Close export dropdown when clicking anywhere outside
document.addEventListener('click', (e) => {
  const dropdown = document.querySelector('.export-dropdown');
  if (dropdown && !dropdown.contains(e.target)) {
    document.getElementById('export-menu')?.classList.remove('show');
  }
});

async function exportGroupCSV() {
  if (!currentGroup) return;
  document.getElementById('export-menu')?.classList.remove('show');
  try {
    API.showToast('Generating CSV report…', 'info', 2000);
    const safeName = currentGroup.name.replace(/\s+/g, '_');
    await API.download(`/groups/${currentGroup.id}/export/csv/`, `group_${safeName}_expenses.csv`);
    API.showToast('CSV report downloaded!', 'success');
  } catch (err) {
    API.showToast(err.message || 'Failed to export CSV.', 'error');
  }
}

async function exportGroupPDF() {
  if (!currentGroup) return;
  document.getElementById('export-menu')?.classList.remove('show');
  try {
    API.showToast('Generating PDF report…', 'info', 2500);
    const safeName = currentGroup.name.replace(/\s+/g, '_');
    await API.download(`/groups/${currentGroup.id}/export/pdf/`, `group_${safeName}_report.pdf`);
    API.showToast('PDF report downloaded!', 'success');
  } catch (err) {
    API.showToast(err.message || 'Failed to export PDF.', 'error');
  }
}

window.openModal = openModal;
window.closeModal = closeModal;
window.toggleExportMenu = toggleExportMenu;
window.exportGroupCSV = exportGroupCSV;
window.exportGroupPDF = exportGroupPDF;
