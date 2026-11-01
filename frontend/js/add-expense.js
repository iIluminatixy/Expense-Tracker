/**
 * add-expense.js - Add expense form logic.
 */

let groupData = null;
let groupId = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!API.isLoggedIn()) { API.redirectToLogin(); return; }

  const params = new URLSearchParams(window.location.search);
  groupId = params.get('group');
  if (!groupId) { window.location.href = 'dashboard.html'; return; }

  setupNav();
  await loadGroupData(groupId);
  setupForm();
  setTodayDate();
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
    API.removeToken(); window.location.href = 'index.html';
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
async function loadGroupData(gid) {
  try {
    groupData = await API.get(`/groups/${gid}/`);
    document.getElementById('group-name-display').textContent = groupData.name;
    document.getElementById('back-link').href = `group.html?id=${gid}`;
    populatePaidByDropdown(groupData.members);
    renderParticipants(groupData.members);
    renderCustomSplitsTable(groupData.members);
  } catch (err) {
    document.getElementById('form-container').innerHTML = `
      <div class="alert alert-error">${err.message}</div>
      <a href="dashboard.html" class="btn btn-secondary" style="margin-top:1rem">Back</a>
    `;
  }
}

function populatePaidByDropdown(members) {
  const select = document.getElementById('paid-by');
  if (!select) return;
  const currentUser = API.getCurrentUser();

  select.innerHTML = members.map(m => {
    const name = m.first_name ? `${m.first_name} ${m.last_name}`.trim() : m.username;
    const selected = m.id === currentUser?.id ? 'selected' : '';
    return `<option value="${m.id}" ${selected}>${escHtml(name)} (@${m.username})</option>`;
  }).join('');
}

function renderParticipants(members) {
  const container = document.getElementById('participants-container');
  if (!container) return;

  container.innerHTML = members.map(m => {
    const name = m.first_name ? `${m.first_name} ${m.last_name}`.trim() : m.username;
    return `
      <label class="participant-check checked">
        <input type="checkbox" name="participant" value="${m.id}" checked>
        <div class="user-avatar" style="width:28px;height:28px;font-size:0.75rem">
          ${name.charAt(0).toUpperCase()}
        </div>
        <span>${escHtml(name)}</span>
        <span style="color:var(--gray-400);font-size:0.8rem">@${m.username}</span>
      </label>
    `;
  }).join('');

  // Toggle checked class on label when checkbox changes
  container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const label = cb.closest('.participant-check');
      label.classList.toggle('checked', cb.checked);
    });
  });
}

function renderCustomSplitsTable(members) {
  const tbody = document.getElementById('custom-splits-body');
  if (!tbody) return;

  tbody.innerHTML = members.map(m => {
    const name = m.first_name ? `${m.first_name} ${m.last_name}`.trim() : m.username;
    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:0.5rem">
            <div class="user-avatar" style="width:28px;height:28px;font-size:0.75rem">
              ${name.charAt(0).toUpperCase()}
            </div>
            <span>${escHtml(name)}</span>
          </div>
        </td>
        <td>
          <input
            type="number"
            class="form-control amount-input custom-split-input"
            data-user-id="${m.id}"
            placeholder="0.00"
            min="0"
            step="0.01"
            value="0"
          >
        </td>
      </tr>
    `;
  }).join('');

  // Live sum validation
  tbody.querySelectorAll('.custom-split-input').forEach(input => {
    input.addEventListener('input', updateCustomSplitSum);
  });
}

function updateCustomSplitSum() {
  const inputs = document.querySelectorAll('.custom-split-input');
  let sum = 0;
  inputs.forEach(inp => { sum += parseFloat(inp.value) || 0; });
  const sumEl = document.getElementById('custom-split-sum');
  const totalEl = document.getElementById('expense-amount');
  const total = parseFloat(totalEl?.value) || 0;

  if (sumEl) {
    sumEl.textContent = sum.toFixed(2);
    const sumContainer = document.getElementById('sum-container');
    if (sumContainer) {
      const diff = Math.abs(sum - total);
      if (total > 0 && diff > 0.01) {
        sumContainer.classList.add('sum-mismatch');
      } else {
        sumContainer.classList.remove('sum-mismatch');
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Form Setup
// ---------------------------------------------------------------------------
function setTodayDate() {
  const dateInput = document.getElementById('expense-date');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
}

function setupForm() {
  const splitTypeInputs = document.querySelectorAll('input[name="split-type"]');
  const equalSection = document.getElementById('equal-split-section');
  const customSection = document.getElementById('custom-split-section');

  splitTypeInputs.forEach(input => {
    input.addEventListener('change', () => {
      if (input.value === 'equal') {
        equalSection.style.display = 'block';
        customSection.style.display = 'none';
      } else {
        equalSection.style.display = 'none';
        customSection.style.display = 'block';
        updateCustomSplitSum();
      }
    });
  });

  // Update custom sum when amount changes
  document.getElementById('expense-amount')?.addEventListener('input', updateCustomSplitSum);

  // Form submit
  const form = document.getElementById('add-expense-form');
  form?.addEventListener('submit', handleSubmit);
}

async function handleSubmit(e) {
  e.preventDefault();
  const alertEl = document.getElementById('form-alert');
  alertEl.style.display = 'none';

  const title = document.getElementById('expense-title').value.trim();
  const amount = parseFloat(document.getElementById('expense-amount').value);
  const paidBy = parseInt(document.getElementById('paid-by').value);
  const date = document.getElementById('expense-date').value;
  const splitType = document.querySelector('input[name="split-type"]:checked')?.value || 'equal';

  // Basic validation
  if (!title) { showAlert(alertEl, 'Expense title is required.'); return; }
  if (!amount || amount <= 0) { showAlert(alertEl, 'Please enter a valid amount.'); return; }
  if (!date) { showAlert(alertEl, 'Please select a date.'); return; }

  let participants = [];
  let customSplits = [];

  if (splitType === 'equal') {
    participants = Array.from(
      document.querySelectorAll('input[name="participant"]:checked')
    ).map(cb => parseInt(cb.value));

    if (participants.length === 0) {
      showAlert(alertEl, 'Please select at least one participant.'); return;
    }
  } else {
    const inputs = document.querySelectorAll('.custom-split-input');
    let sum = 0;
    inputs.forEach(inp => {
      const splitAmount = parseFloat(inp.value) || 0;
      if (splitAmount > 0) {
        customSplits.push({ user: parseInt(inp.dataset.userId), amount: splitAmount });
        sum += splitAmount;
      }
    });

    if (customSplits.length === 0) {
      showAlert(alertEl, 'Please enter amounts for at least one participant.'); return;
    }
    if (Math.abs(sum - amount) > 0.01) {
      showAlert(alertEl, `Custom splits total (${sum.toFixed(2)}) must equal the expense amount (${amount.toFixed(2)}).`);
      return;
    }
  }

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner" style="width:16px;height:16px;border-width:2px"></span> Adding Expense…';

  try {
    await API.post(`/groups/${groupId}/expenses/`, {
      title,
      amount,
      paid_by: paidBy,
      date,
      split_type: splitType,
      participants,
      custom_splits: customSplits,
    });
    API.showToast('Expense added successfully!', 'success');
    setTimeout(() => { window.location.href = `group.html?id=${groupId}`; }, 800);
  } catch (err) {
    showAlert(alertEl, err.message);
    btn.disabled = false;
    btn.textContent = 'Add Expense';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function showAlert(el, msg) {
  el.textContent = msg;
  el.className = 'alert alert-error';
  el.style.display = 'flex';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
