/**
 * settlement.js - Settlement/balance summary page logic.
 */

let groupId = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!API.isLoggedIn()) { API.redirectToLogin(); return; }

  const params = new URLSearchParams(window.location.search);
  groupId = params.get('group');
  if (!groupId) { window.location.href = 'dashboard.html'; return; }

  setupNav();
  await loadGroupInfo();
  await loadSettlements();
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
// Load Group Info
// ---------------------------------------------------------------------------
async function loadGroupInfo() {
  try {
    const group = await API.get(`/groups/${groupId}/`);
    document.getElementById('group-name').textContent = group.name;
    document.getElementById('back-link').href = `group.html?id=${groupId}`;
    document.title = `Settlements – ${group.name}`;
  } catch (err) {
    // Non-critical, continue
  }
}

// ---------------------------------------------------------------------------
// Load Settlements
// ---------------------------------------------------------------------------
async function loadSettlements() {
  const balanceContainer = document.getElementById('balance-container');
  const txContainer = document.getElementById('transactions-container');

  balanceContainer.innerHTML = `
    <div class="loading-overlay">
      <div class="loading-spinner" style="width:28px;height:28px;border-width:2.5px"></div>
    </div>
  `;
  txContainer.innerHTML = '';

  try {
    const data = await API.get(`/groups/${groupId}/settlements/`);
    renderBalances(data.member_balances, balanceContainer);
    renderTransactions(data.transactions, txContainer);
  } catch (err) {
    balanceContainer.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    txContainer.innerHTML = '';
  }
}

function renderBalances(balances, container) {
  if (!balances || balances.length === 0) {
    container.innerHTML = `<p class="empty-desc" style="padding:1rem">No members found.</p>`;
    return;
  }

  container.innerHTML = `<div style="display:flex;flex-direction:column;gap:0.6rem">
    ${balances.map(b => {
      const net = parseFloat(b.net_balance);
      const cls = net > 0.009 ? 'positive' : net < -0.009 ? 'negative' : 'neutral';
      const prefix = net > 0.009 ? '+' : '';
      const label = net > 0.009 ? 'gets back' : net < -0.009 ? 'owes' : 'settled up';

      const formatted = Math.abs(net).toLocaleString('en-IN', {
        style: 'currency', currency: 'INR', maximumFractionDigits: 2,
      });

      const initial = (b.display_name || b.username).charAt(0).toUpperCase();

      return `
        <div class="balance-card ${cls}">
          <div class="balance-user">
            <div class="user-avatar" style="width:36px;height:36px">${initial}</div>
            <div>
              <div class="balance-name">${escHtml(b.display_name || b.username)}</div>
              <div style="font-size:0.75rem;color:var(--gray-500)">@${b.username}</div>
            </div>
          </div>
          <div>
            <div class="balance-amount">${prefix}${formatted}</div>
            <div style="font-size:0.75rem;text-align:right;color:var(--gray-500)">${label}</div>
          </div>
        </div>
      `;
    }).join('')}
  </div>`;
}

function renderTransactions(transactions, container) {
  if (!transactions || transactions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎉</div>
        <p class="empty-title">All settled up!</p>
        <p class="empty-desc">There are no outstanding debts in this group.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `<div style="display:flex;flex-direction:column;gap:0.75rem">
    ${transactions.map(tx => {
      const amount = parseFloat(tx.amount).toLocaleString('en-IN', {
        style: 'currency', currency: 'INR', maximumFractionDigits: 2,
      });
      const fromInitial = tx.from_name.charAt(0).toUpperCase();
      const toInitial = tx.to_name.charAt(0).toUpperCase();

      return `
        <div class="transaction-row" id="tx-${tx.from_id}-${tx.to_id}">
          <div class="transaction-info">
            <div class="user-avatar" style="width:36px;height:36px">${fromInitial}</div>
            <div>
              <div style="font-weight:600;color:var(--gray-900)">${escHtml(tx.from_name)}</div>
              <div style="font-size:0.8rem;color:var(--gray-500)">pays</div>
            </div>
            <div class="transaction-arrow">→</div>
            <div class="user-avatar" style="width:36px;height:36px">${toInitial}</div>
            <div>
              <div style="font-weight:600;color:var(--gray-900)">${escHtml(tx.to_name)}</div>
              <div style="font-size:0.8rem;color:var(--gray-500)">receives</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
            <div class="transaction-amount">${amount}</div>
            <button class="btn btn-sm btn-success settle-btn"
              data-from="${tx.from_id}" data-to="${tx.to_id}">
              ✓ Mark Settled
            </button>
          </div>
        </div>
      `;
    }).join('')}
  </div>`;

  // Attach settle buttons
  container.querySelectorAll('.settle-btn').forEach(btn => {
    btn.addEventListener('click', () => handleMarkSettled(btn));
  });
}

async function handleMarkSettled(btn) {
  const fromId = btn.dataset.from;
  const toId = btn.dataset.to;

  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner" style="width:12px;height:12px;border-width:2px"></span>';

  try {
    // Find unsettled splits where this person owes the other
    // We'll call the settlements API to get split IDs if needed.
    // Since we track transactions as aggregate, we reload after settlement.
    // The backend settle endpoint works per-split; here we reload to recalculate.
    // For a better UX, we mark the row as settled and reload.
    await settleTransactionSplits(parseInt(fromId), parseInt(toId));
    API.showToast('Payment marked as settled!', 'success');
    await loadSettlements();
  } catch (err) {
    API.showToast(err.message || 'Failed to mark as settled.', 'error');
    btn.disabled = false;
    btn.textContent = '✓ Mark Settled';
  }
}

/**
 * Settle all unsettled splits where `fromUserId` owes `toUserId` in the group.
 * We fetch expenses in the group, find splits where user=fromUserId and expense.paid_by=toUserId,
 * and mark each as settled.
 */
async function settleTransactionSplits(fromUserId, toUserId) {
  const expenses = await API.get(`/groups/${groupId}/expenses/`);

  const settlePromises = [];
  for (const expSummary of expenses) {
    // Only process expenses paid by the creditor (toUserId)
    if (expSummary.paid_by?.id !== toUserId) continue;

    // Fetch full expense with splits
    const expense = await API.get(`/expenses/${expSummary.id}/`);
    for (const split of expense.splits) {
      if (split.user?.id === fromUserId && !split.is_settled) {
        settlePromises.push(API.post(`/splits/${split.id}/settle/`, {}));
      }
    }
  }

  if (settlePromises.length === 0) {
    throw new Error('No unsettled splits found for this transaction.');
  }

  await Promise.all(settlePromises);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
