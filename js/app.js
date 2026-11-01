/**
 * app.js
 * Main UI Controller for SplitWise Group Expense Tracker.
 * Manages tabs, reactive rendering, modals, split logic UI,
 * profile photo uploads, debt settlement, and exports.
 */

class AppController {
  constructor() {
    this.currentTab = 'dashboard';
    this.expenseSearchQuery = '';
    this.expenseCategoryFilter = 'all';
    this.expenseMemberFilter = 'all';

    // Editing states
    this.editingExpenseId = null;
    this.editingMemberId = null;
    this.currentMemberAvatarBase64 = null;

    this.init();
  }

  init() {
    // Subscribe to store updates
    window.store.subscribe(() => {
      this.render();
    });

    this.bindGlobalEvents();
    this.render();
  }

  // -------------------------------------------------------------
  // Global Event Listeners & Modals
  // -------------------------------------------------------------
  bindGlobalEvents() {
    // Navigation Tabs
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Group Switcher
    const groupSelect = document.getElementById('header-group-select');
    if (groupSelect) {
      groupSelect.addEventListener('change', (e) => {
        if (e.target.value === '__NEW__') {
          this.openNewGroupModal();
          // Reset select back to current group
          groupSelect.value = window.store.getCurrentGroup()?.id;
        } else {
          window.store.setCurrentGroup(e.target.value);
          this.showToast('Switched group successfully', 'info');
        }
      });
    }

    // User "Viewing As" Switcher
    const userSelect = document.getElementById('header-user-select');
    if (userSelect) {
      userSelect.addEventListener('change', (e) => {
        window.store.setCurrentUser(e.target.value);
        this.showToast(`Switched perspective to ${window.store.getCurrentUser()?.name}`, 'info');
      });
    }

    // Modal Close Buttons (data-close-modal)
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.closeAllModals();
      });
    });

    // Close modals on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this.closeAllModals();
        }
      });
    });

    // Expense Form Submit
    const expenseForm = document.getElementById('expense-form');
    if (expenseForm) {
      expenseForm.addEventListener('submit', (e) => this.handleExpenseFormSubmit(e));
    }

    // Split Type Selector Change
    const splitTypeSelect = document.getElementById('expense-split-type');
    if (splitTypeSelect) {
      splitTypeSelect.addEventListener('change', () => this.renderSplitDetailsInputs());
    }

    // Expense Amount input change -> update split amounts dynamically
    const expenseAmountInput = document.getElementById('expense-amount');
    if (expenseAmountInput) {
      expenseAmountInput.addEventListener('input', () => {
        const splitType = document.getElementById('expense-split-type')?.value || 'equal';
        if (splitType === 'equal') {
          this.onEqualSplitCheckboxChange();
        } else if (splitType === 'exact') {
          this.onExactSplitInputChange();
        } else if (splitType === 'percentage') {
          this.onPercentageSplitInputChange();
        } else if (splitType === 'shares') {
          this.onShareSplitInputChange();
        }
      });
    }

    // Member Form Submit
    const memberForm = document.getElementById('member-form');
    if (memberForm) {
      memberForm.addEventListener('submit', (e) => this.handleMemberFormSubmit(e));
    }

    // Member Photo File Upload Change
    const memberPhotoInput = document.getElementById('member-photo-input');
    if (memberPhotoInput) {
      memberPhotoInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          try {
            const compressed = await window.store.compressImage(file);
            this.currentMemberAvatarBase64 = compressed;
            this.updateMemberPhotoPreview(compressed);
            this.showToast('Photo uploaded & optimized!', 'success');
          } catch (err) {
            this.showToast(err.message, 'error');
          }
        }
      });
    }

    // Member Remove Photo Button
    const removePhotoBtn = document.getElementById('btn-remove-photo');
    if (removePhotoBtn) {
      removePhotoBtn.addEventListener('click', () => {
        this.currentMemberAvatarBase64 = null;
        this.updateMemberPhotoPreview(null);
      });
    }

    // Settle Up Form Submit
    const settleForm = document.getElementById('settle-form');
    if (settleForm) {
      settleForm.addEventListener('submit', (e) => this.handleSettleFormSubmit(e));
    }

    // New Group Form Submit
    const groupForm = document.getElementById('group-form');
    if (groupForm) {
      groupForm.addEventListener('submit', (e) => this.handleGroupFormSubmit(e));
    }

    // Expenses Search & Filters
    const searchInput = document.getElementById('expense-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.expenseSearchQuery = e.target.value.toLowerCase();
        this.renderExpensesTab();
      });
    }

    const catFilter = document.getElementById('expense-filter-category');
    if (catFilter) {
      catFilter.addEventListener('change', (e) => {
        this.expenseCategoryFilter = e.target.value;
        this.renderExpensesTab();
      });
    }

    const memberFilter = document.getElementById('expense-filter-member');
    if (memberFilter) {
      memberFilter.addEventListener('change', (e) => {
        this.expenseMemberFilter = e.target.value;
        this.renderExpensesTab();
      });
    }

    // Global Export Buttons
    const exportCsvBtn = document.getElementById('btn-export-csv');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => {
        const group = window.store.getCurrentGroup();
        window.ExpenseExporter.exportToCSV(group);
        this.showToast('CSV export downloaded!', 'success');
      });
    }

    const exportPdfBtn = document.getElementById('btn-export-pdf');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => {
        const group = window.store.getCurrentGroup();
        window.ExpenseExporter.exportToPDF(group);
        this.showToast('PDF export generated!', 'success');
      });
    }

    const backupBtn = document.getElementById('btn-export-backup');
    if (backupBtn) {
      backupBtn.addEventListener('click', () => {
        window.ExpenseExporter.exportJSONBackup();
        this.showToast('Backup JSON file downloaded!', 'success');
      });
    }

    const importInput = document.getElementById('input-import-backup');
    if (importInput) {
      importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            window.store.importJSON(event.target.result);
            this.showToast('Backup restored successfully!', 'success');
            importInput.value = '';
          } catch (err) {
            this.showToast('Failed to import backup: ' + err.message, 'error');
          }
        };
        reader.readAsText(file);
      });
    }

    const resetDemoBtn = document.getElementById('btn-reset-demo');
    if (resetDemoBtn) {
      resetDemoBtn.addEventListener('click', () => {
        if (confirm('Reset to demo sample data? Any unsaved changes in current session will be replaced.')) {
          window.store.resetToDemo();
          this.showToast('Sample demo data reloaded!', 'info');
        }
      });
    }
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      const active = btn.dataset.tab === tabName;
      btn.classList.toggle('text-indigo-600', active);
      btn.classList.toggle('border-indigo-600', active);
      btn.classList.toggle('border-b-2', active);
      btn.classList.toggle('text-gray-500', !active);
    });

    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('hidden', pane.id !== `tab-pane-${tabName}`);
    });

    this.render();
  }

  closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
    this.editingExpenseId = null;
    this.editingMemberId = null;
    this.currentMemberAvatarBase64 = null;
  }

  // -------------------------------------------------------------
  // Render Orchestrator
  // -------------------------------------------------------------
  render() {
    this.renderHeaderControls();

    switch (this.currentTab) {
      case 'dashboard':
        this.renderDashboardTab();
        break;
      case 'expenses':
        this.renderExpensesTab();
        break;
      case 'balances':
        this.renderBalancesTab();
        break;
      case 'members':
        this.renderMembersTab();
        break;
      case 'settings':
        this.renderSettingsTab();
        break;
    }
  }

  // -------------------------------------------------------------
  // Header Controls (Group Switcher & User Perspective)
  // -------------------------------------------------------------
  renderHeaderControls() {
    const groups = window.store.getGroups();
    const currentGroup = window.store.getCurrentGroup();
    const currentUser = window.store.getCurrentUser();

    // Group dropdown
    const groupSelect = document.getElementById('header-group-select');
    if (groupSelect && currentGroup) {
      groupSelect.innerHTML = groups.map(g => `
        <option value="${g.id}" ${g.id === currentGroup.id ? 'selected' : ''}>
          ${this.escapeHTML(g.name)} (${g.currency || '$'})
        </option>
      `).join('') + `<option value="__NEW__">+ Create New Group...</option>`;
    }

    // User perspective dropdown
    const userSelect = document.getElementById('header-user-select');
    if (userSelect && currentGroup) {
      userSelect.innerHTML = (currentGroup.members || []).map(m => `
        <option value="${m.id}" ${currentUser && m.id === currentUser.id ? 'selected' : ''}>
          👤 ${this.escapeHTML(m.name)} ${currentUser && m.id === currentUser.id ? '(You)' : ''}
        </option>
      `).join('');
    }

    // Header active user avatar preview
    const userAvatarEl = document.getElementById('header-user-avatar');
    if (userAvatarEl && currentUser) {
      userAvatarEl.innerHTML = this.renderAvatarHTML(currentUser, 'w-8 h-8 text-xs');
    }
  }

  // -------------------------------------------------------------
  // Tab 1: Dashboard / Overview
  // -------------------------------------------------------------
  renderDashboardTab() {
    const group = window.store.getCurrentGroup();
    if (!group) return;

    const currency = group.currency || '$';
    const currentUser = window.store.getCurrentUser();
    const balances = window.ExpenseCalculator.calculateBalances(group);
    const debts = window.ExpenseCalculator.simplifyDebts(group);
    const stats = window.ExpenseCalculator.getGroupStats(group);

    // Group title & description
    const titleEl = document.getElementById('dash-group-title');
    if (titleEl) titleEl.textContent = group.name;

    const descEl = document.getElementById('dash-group-desc');
    if (descEl) descEl.textContent = group.description || 'No description provided';

    // Summary Metric Cards
    const totalSpendEl = document.getElementById('dash-total-spend');
    if (totalSpendEl) totalSpendEl.textContent = `${currency}${stats.totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Current User Perspective
    const myBalance = (currentUser && balances[currentUser.id]) ? balances[currentUser.id].netBalance : 0;
    const myBalanceCard = document.getElementById('dash-my-balance-card');
    const myBalanceText = document.getElementById('dash-my-balance');
    const myBalanceSub = document.getElementById('dash-my-balance-sub');

    if (myBalanceCard && myBalanceText && myBalanceSub) {
      if (myBalance > 0.01) {
        myBalanceText.textContent = `+${currency}${myBalance.toFixed(2)}`;
        myBalanceText.className = 'text-2xl font-bold text-emerald-600';
        myBalanceSub.textContent = 'You are owed in total';
      } else if (myBalance < -0.01) {
        myBalanceText.textContent = `-${currency}${Math.abs(myBalance).toFixed(2)}`;
        myBalanceText.className = 'text-2xl font-bold text-rose-600';
        myBalanceSub.textContent = 'You owe to the group';
      } else {
        myBalanceText.textContent = `${currency}0.00`;
        myBalanceText.className = 'text-2xl font-bold text-gray-700';
        myBalanceSub.textContent = 'You are completely settled up';
      }
    }

    const expensesCountEl = document.getElementById('dash-expenses-count');
    if (expensesCountEl) expensesCountEl.textContent = stats.totalCount;

    const membersCountEl = document.getElementById('dash-members-count');
    if (membersCountEl) membersCountEl.textContent = stats.memberCount;

    // Debt Simplification Highlights on Dashboard
    const debtListEl = document.getElementById('dash-debt-list');
    if (debtListEl) {
      if (debts.length === 0) {
        debtListEl.innerHTML = `
          <div class="text-center py-6 text-gray-500">
            <div class="text-3xl mb-1">🎉</div>
            <p class="font-medium text-gray-700">All debts are settled!</p>
            <p class="text-xs text-gray-400">No pending transfers needed.</p>
          </div>
        `;
      } else {
        debtListEl.innerHTML = debts.map(d => `
          <div class="flex items-center justify-between p-3.5 bg-white border border-gray-100 rounded-xl shadow-sm hover:border-indigo-100 transition">
            <div class="flex items-center gap-3">
              ${this.renderAvatarHTML({ name: d.fromName, avatar: d.fromAvatar, color: d.fromColor }, 'w-9 h-9 text-xs')}
              <div>
                <p class="text-sm font-semibold text-gray-800">
                  <span class="text-gray-900">${this.escapeHTML(d.fromName)}</span>
                  <span class="text-gray-400 font-normal mx-1">owes</span>
                  <span class="text-indigo-600 font-semibold">${this.escapeHTML(d.toName)}</span>
                </p>
                <p class="text-xs text-gray-400">Suggested minimal settlement</p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-base font-bold text-gray-900">${currency}${d.amount.toFixed(2)}</span>
              <button onclick="window.app.openSettleModal('${d.fromId}', '${d.toId}', ${d.amount})" 
                class="px-3 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition">
                Settle
              </button>
            </div>
          </div>
        `).join('');
      }
    }

    // Recent Expenses List on Dashboard
    const recentExpensesEl = document.getElementById('dash-recent-expenses');
    if (recentExpensesEl) {
      const expenses = (group.expenses || []).slice(0, 5);
      if (expenses.length === 0) {
        recentExpensesEl.innerHTML = `
          <div class="text-center py-8 text-gray-400 text-sm">
            No expenses added yet. Click <strong>+ Add Expense</strong> to begin!
          </div>
        `;
      } else {
        const memberLookup = {};
        (group.members || []).forEach(m => { memberLookup[m.id] = m; });

        recentExpensesEl.innerHTML = expenses.map(e => {
          const payer = memberLookup[e.paidBy] || { name: 'Unknown' };
          return `
            <div class="flex items-center justify-between py-3 border-b border-gray-100 last:border-none">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-100 text-lg">
                  ${this.getCategoryIcon(e.category)}
                </div>
                <div>
                  <h4 class="text-sm font-semibold text-gray-900">${this.escapeHTML(e.title)}</h4>
                  <p class="text-xs text-gray-500">
                    Paid by <strong class="text-gray-700">${this.escapeHTML(payer.name)}</strong> · ${e.date}
                  </p>
                </div>
              </div>
              <div class="text-right">
                <span class="text-sm font-bold text-gray-900">${currency}${Number(e.amount).toFixed(2)}</span>
                <span class="block text-xs text-gray-400 capitalize">${this.escapeHTML(e.splitType || 'equal')} split</span>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Category Spending Breakdown on Dashboard
    const categoryBreakdownEl = document.getElementById('dash-category-breakdown');
    if (categoryBreakdownEl) {
      const catTotals = stats.categoryTotals;
      const categories = Object.keys(catTotals);

      if (categories.length === 0 || stats.totalSpend === 0) {
        categoryBreakdownEl.innerHTML = `<p class="text-xs text-gray-400 text-center py-4">No spending data yet.</p>`;
      } else {
        categoryBreakdownEl.innerHTML = categories.map(cat => {
          const amt = catTotals[cat];
          const pct = Math.round((amt / stats.totalSpend) * 100);
          return `
            <div class="mb-3 last:mb-0">
              <div class="flex justify-between text-xs font-medium text-gray-600 mb-1">
                <span>${this.getCategoryIcon(cat)} ${this.escapeHTML(cat)}</span>
                <span class="font-semibold text-gray-800">${currency}${amt.toFixed(2)} (${pct}%)</span>
              </div>
              <div class="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div class="bg-indigo-600 h-2 rounded-full" style="width: ${pct}%"></div>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  }

  // -------------------------------------------------------------
  // Tab 2: Expenses List & Filtering
  // -------------------------------------------------------------
  renderExpensesTab() {
    const group = window.store.getCurrentGroup();
    if (!group) return;

    const currency = group.currency || '$';
    const memberLookup = {};
    (group.members || []).forEach(m => { memberLookup[m.id] = m; });

    // Populate category and member filters
    const filterCatSelect = document.getElementById('expense-filter-category');
    if (filterCatSelect && filterCatSelect.options.length <= 1) {
      const categories = ['Food & Dining', 'Transportation', 'Accommodation', 'Groceries', 'Entertainment', 'Shopping', 'Utilities', 'Other'];
      categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = `${this.getCategoryIcon(cat)} ${cat}`;
        filterCatSelect.appendChild(opt);
      });
    }

    const filterMemberSelect = document.getElementById('expense-filter-member');
    if (filterMemberSelect) {
      filterMemberSelect.innerHTML = `<option value="all">All Members</option>` + 
        (group.members || []).map(m => `
          <option value="${m.id}" ${this.expenseMemberFilter === m.id ? 'selected' : ''}>
            ${this.escapeHTML(m.name)}
          </option>
        `).join('');
    }

    // Filter expenses
    let expenses = group.expenses || [];

    if (this.expenseSearchQuery) {
      expenses = expenses.filter(e => 
        e.title.toLowerCase().includes(this.expenseSearchQuery) ||
        (e.notes && e.notes.toLowerCase().includes(this.expenseSearchQuery))
      );
    }

    if (this.expenseCategoryFilter && this.expenseCategoryFilter !== 'all') {
      expenses = expenses.filter(e => e.category === this.expenseCategoryFilter);
    }

    if (this.expenseMemberFilter && this.expenseMemberFilter !== 'all') {
      expenses = expenses.filter(e => 
        e.paidBy === this.expenseMemberFilter || 
        (e.splits && e.splits[this.expenseMemberFilter] > 0)
      );
    }

    const listEl = document.getElementById('expenses-list-container');
    if (!listEl) return;

    if (expenses.length === 0) {
      listEl.innerHTML = `
        <div class="text-center py-16 bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
          <div class="text-4xl mb-3">🧾</div>
          <h3 class="text-base font-semibold text-gray-800">No expenses found</h3>
          <p class="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            ${this.expenseSearchQuery || this.expenseCategoryFilter !== 'all' || this.expenseMemberFilter !== 'all' 
              ? 'No expenses match your current search or filter criteria.' 
              : 'Start tracking group spending by clicking the button below.'}
          </p>
          <button onclick="window.app.openAddExpenseModal()" class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-md transition">
            + Add First Expense
          </button>
        </div>
      `;
      return;
    }

    listEl.innerHTML = expenses.map(exp => {
      const payer = memberLookup[exp.paidBy] || { name: 'Unknown' };
      
      // Build split tags
      let splitTagsHTML = '';
      if (exp.splits) {
        splitTagsHTML = Object.entries(exp.splits).map(([mId, amt]) => {
          const m = memberLookup[mId] || { name: mId };
          return `
            <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-100 text-xs text-gray-700">
              <span class="font-medium">${this.escapeHTML(m.name)}:</span>
              <span class="font-bold text-gray-900">${currency}${Number(amt).toFixed(0)}</span>
            </span>
          `;
        }).join('');
      }

      return `
        <div class="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm hover:shadow-md transition mb-3">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-start gap-3.5">
              <div class="w-12 h-12 rounded-2xl flex items-center justify-center bg-indigo-50 text-2xl flex-shrink-0">
                ${this.getCategoryIcon(exp.category)}
              </div>
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <h4 class="text-base font-bold text-gray-900">${this.escapeHTML(exp.title)}</h4>
                  <span class="cat-badge ${this.getCategoryBadgeClass(exp.category)}">
                    ${this.escapeHTML(exp.category || 'General')}
                  </span>
                  <span class="text-xs text-gray-400 capitalize bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
                    ${this.escapeHTML(exp.splitType || 'equal')} split
                  </span>
                </div>
                <p class="text-xs text-gray-500 mt-1 flex items-center gap-1.5 flex-wrap">
                  <span>📅 ${exp.date}</span>
                  <span>·</span>
                  <span class="flex items-center gap-1">
                    Paid by
                    <strong class="text-gray-800">${this.escapeHTML(payer.name)}</strong>
                  </span>
                  ${exp.notes ? `<span>·</span> <span class="italic text-gray-400 truncate max-w-xs">"${this.escapeHTML(exp.notes)}"</span>` : ''}
                </p>
              </div>
            </div>

            <div class="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-none pt-2 sm:pt-0">
              <div class="sm:text-right">
                <span class="text-xl font-extrabold text-gray-900">${currency}${Number(exp.amount).toFixed(2)}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <button onclick="window.app.openEditExpenseModal('${exp.id}')" title="Edit Expense" 
                  class="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition">
                  ✏️
                </button>
                <button onclick="window.app.deleteExpense('${exp.id}')" title="Delete Expense" 
                  class="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition">
                  🗑️
                </button>
              </div>
            </div>
          </div>

          <!-- Split Breakdown Pill Row -->
          <div class="mt-3 pt-3 border-t border-gray-50 flex items-center gap-2 flex-wrap text-xs text-gray-500">
            <span class="font-medium text-gray-400">Splits:</span>
            ${splitTagsHTML}
          </div>
        </div>
      `;
    }).join('');
  }

  // -------------------------------------------------------------
  // Tab 3: Balances & Settle Up
  // -------------------------------------------------------------
  renderBalancesTab() {
    const group = window.store.getCurrentGroup();
    if (!group) return;

    const currency = group.currency || '$';
    const balances = window.ExpenseCalculator.calculateBalances(group);
    const debts = window.ExpenseCalculator.simplifyDebts(group);

    // Render Balances of each member
    const balanceGridEl = document.getElementById('balances-grid-container');
    if (balanceGridEl) {
      balanceGridEl.innerHTML = Object.values(balances).map(b => {
        const isCreditor = b.netBalance > 0.01;
        const isDebtor = b.netBalance < -0.01;
        const isSettled = !isCreditor && !isDebtor;

        return `
          <div class="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div class="flex items-center gap-3 mb-4">
              ${this.renderAvatarHTML(b.member, 'w-12 h-12 text-sm')}
              <div class="flex-1 min-w-0">
                <h4 class="text-base font-bold text-gray-900 truncate">${this.escapeHTML(b.member.name)}</h4>
                <p class="text-xs text-gray-400 truncate">${this.escapeHTML(b.member.email || 'No email')}</p>
              </div>
              <div>
                ${isCreditor ? '<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">Gets Back</span>' : ''}
                ${isDebtor ? '<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-100 text-rose-800">Owes</span>' : ''}
                ${isSettled ? '<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-gray-100 text-gray-600">Settled</span>' : ''}
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2 text-xs py-3 border-y border-gray-50 mb-3">
              <div>
                <span class="text-gray-400 block">Total Paid Out</span>
                <span class="font-bold text-gray-800 text-sm">${currency}${b.paid.toFixed(2)}</span>
              </div>
              <div>
                <span class="text-gray-400 block">Total Share</span>
                <span class="font-bold text-gray-800 text-sm">${currency}${b.share.toFixed(2)}</span>
              </div>
            </div>

            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-gray-500">Net Balance:</span>
              <span class="text-lg font-extrabold ${isCreditor ? 'text-emerald-600' : isDebtor ? 'text-rose-600' : 'text-gray-600'}">
                ${isCreditor ? '+' : ''}${currency}${b.netBalance.toFixed(2)}
              </span>
            </div>
          </div>
        `;
      }).join('');
    }

    // Simplified Debt Transfers (Who owes whom)
    const simplifiedDebtsEl = document.getElementById('simplified-debts-container');
    if (simplifiedDebtsEl) {
      if (debts.length === 0) {
        simplifiedDebtsEl.innerHTML = `
          <div class="text-center py-10 bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
            <div class="text-4xl mb-2">🎉</div>
            <h4 class="text-base font-bold text-gray-900">All balances are completely settled!</h4>
            <p class="text-xs text-gray-500 mt-1">No money is owed between any members.</p>
          </div>
        `;
      } else {
        simplifiedDebtsEl.innerHTML = debts.map(d => `
          <div class="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
            <div class="flex items-center gap-3">
              ${this.renderAvatarHTML({ name: d.fromName, avatar: d.fromAvatar, color: d.fromColor }, 'w-10 h-10 text-xs')}
              <div>
                <p class="text-sm font-semibold text-gray-900">
                  <span>${this.escapeHTML(d.fromName)}</span>
                  <span class="text-gray-400 font-normal mx-1">needs to pay</span>
                  <span class="text-indigo-600 font-bold">${this.escapeHTML(d.toName)}</span>
                </p>
                <p class="text-xs text-gray-400">Greedy debt-minimization algorithm result</p>
              </div>
            </div>

            <div class="flex items-center justify-between sm:justify-end gap-4">
              <span class="text-xl font-extrabold text-gray-900">${currency}${d.amount.toFixed(2)}</span>
              <button onclick="window.app.openSettleModal('${d.fromId}', '${d.toId}', ${d.amount})"
                class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition">
                ✓ Record Settlement
              </button>
            </div>
          </div>
        `).join('');
      }
    }

    // Settlements Ledger (Past settlements)
    const settlementsListEl = document.getElementById('settlements-history-container');
    if (settlementsListEl) {
      const settlements = group.settlements || [];
      const memberLookup = {};
      (group.members || []).forEach(m => { memberLookup[m.id] = m; });

      if (settlements.length === 0) {
        settlementsListEl.innerHTML = `<p class="text-xs text-gray-400 text-center py-4">No settlements recorded yet.</p>`;
      } else {
        settlementsListEl.innerHTML = settlements.map(s => {
          const fromMember = memberLookup[s.fromMemberId] || { name: 'Unknown' };
          const toMember = memberLookup[s.toMemberId] || { name: 'Unknown' };

          return `
            <div class="flex items-center justify-between py-3 border-b border-gray-100 last:border-none text-xs">
              <div>
                <span class="font-bold text-gray-800">${this.escapeHTML(fromMember.name)}</span>
                <span class="text-gray-400 mx-1">paid</span>
                <span class="font-bold text-indigo-600">${this.escapeHTML(toMember.name)}</span>
                <span class="text-gray-400 ml-2">via ${this.escapeHTML(s.method || 'Cash')} on ${s.date}</span>
                ${s.notes ? `<span class="italic text-gray-400 ml-2">("${this.escapeHTML(s.notes)}")</span>` : ''}
              </div>
              <div class="flex items-center gap-3">
                <span class="font-extrabold text-emerald-600 text-sm">${currency}${Number(s.amount).toFixed(2)}</span>
                <button onclick="window.app.deleteSettlement('${s.id}')" title="Delete record" class="text-gray-400 hover:text-rose-600">
                  🗑️
                </button>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  }

  // -------------------------------------------------------------
  // Tab 4: Members & Profiles
  // -------------------------------------------------------------
  renderMembersTab() {
    const group = window.store.getCurrentGroup();
    if (!group) return;

    const currency = group.currency || '$';
    const balances = window.ExpenseCalculator.calculateBalances(group);
    const container = document.getElementById('members-grid-container');
    if (!container) return;

    container.innerHTML = (group.members || []).map(m => {
      const b = balances[m.id] || { paid: 0, share: 0, netBalance: 0 };
      const isYou = window.store.getCurrentUser()?.id === m.id;

      return `
        <div class="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition">
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3.5">
              ${this.renderAvatarHTML(m, 'w-14 h-14 text-base ring-4 ring-indigo-50')}
              <div>
                <div class="flex items-center gap-2">
                  <h4 class="text-base font-bold text-gray-900">${this.escapeHTML(m.name)}</h4>
                  ${isYou ? '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">You</span>' : ''}
                </div>
                <p class="text-xs text-gray-400 mt-0.5">${this.escapeHTML(m.email || 'No email provided')}</p>
              </div>
            </div>

            <div class="flex items-center gap-1">
              <button onclick="window.app.openEditMemberModal('${m.id}')" title="Edit Profile & Photo" 
                class="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition">
                ✏️
              </button>
              ${group.members.length > 1 ? `
                <button onclick="window.app.deleteMember('${m.id}')" title="Delete Member" 
                  class="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition">
                  🗑️
                </button>
              ` : ''}
            </div>
          </div>

          <div class="mt-4 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span class="text-gray-400 block">Total Out of Pocket</span>
              <span class="font-bold text-gray-800">${currency}${b.paid.toFixed(2)}</span>
            </div>
            <div>
              <span class="text-gray-400 block">Net Balance</span>
              <span class="font-bold ${b.netBalance > 0.01 ? 'text-emerald-600' : b.netBalance < -0.01 ? 'text-rose-600' : 'text-gray-600'}">
                ${b.netBalance > 0.01 ? '+' : ''}${currency}${b.netBalance.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // -------------------------------------------------------------
  // Tab 5: Settings, Groups & Backups
  // -------------------------------------------------------------
  renderSettingsTab() {
    const group = window.store.getCurrentGroup();
    if (!group) return;

    // Fill current group settings form
    const nameInput = document.getElementById('settings-group-name');
    if (nameInput) nameInput.value = group.name;

    const descInput = document.getElementById('settings-group-desc');
    if (descInput) descInput.value = group.description || '';

    const currInput = document.getElementById('settings-group-currency');
    if (currInput) currInput.value = group.currency || '$';

    // Group list in settings
    const groupListContainer = document.getElementById('settings-groups-list');
    if (groupListContainer) {
      const groups = window.store.getGroups();
      groupListContainer.innerHTML = groups.map(g => `
        <div class="flex items-center justify-between p-3 rounded-xl border ${g.id === group.id ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-100 bg-white'}">
          <div>
            <h5 class="text-sm font-bold text-gray-900">${this.escapeHTML(g.name)}</h5>
            <p class="text-xs text-gray-500">${(g.members || []).length} members · ${(g.expenses || []).length} expenses · Currency: ${g.currency || '$'}</p>
          </div>
          <div class="flex items-center gap-2">
            ${g.id !== group.id ? `
              <button onclick="window.store.setCurrentGroup('${g.id}')" class="px-3 py-1 text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:border-indigo-600 rounded-lg">
                Switch
              </button>
            ` : '<span class="text-xs font-bold text-indigo-600 px-2 py-1">Active</span>'}
            ${groups.length > 1 ? `
              <button onclick="window.app.deleteGroup('${g.id}')" title="Delete Group" class="p-1 text-gray-400 hover:text-rose-600">
                🗑️
              </button>
            ` : ''}
          </div>
        </div>
      `).join('');
    }
  }

  // -------------------------------------------------------------
  // Add / Edit Expense Modal Logic
  // -------------------------------------------------------------
  openAddExpenseModal() {
    this.editingExpenseId = null;
    const group = window.store.getCurrentGroup();
    if (!group) return;

    document.getElementById('modal-expense-title').textContent = 'Add New Expense';
    document.getElementById('expense-form').reset();
    document.getElementById('expense-id').value = '';
    document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];

    // Populate Payer dropdown
    const payerSelect = document.getElementById('expense-paid-by');
    const currentUserId = window.store.getCurrentUserId();
    const members = group.members || [];
    payerSelect.innerHTML = members.map((m, idx) => `
      <option value="${m.id}" ${(currentUserId ? m.id === currentUserId : idx === 0) ? 'selected' : ''}>
        ${this.escapeHTML(m.name)}
      </option>
    `).join('');

    // Default split type: equal
    document.getElementById('expense-split-type').value = 'equal';
    this.renderSplitDetailsInputs();

    document.getElementById('modal-expense').classList.add('active');
  }

  openEditExpenseModal(expenseId) {
    const group = window.store.getCurrentGroup();
    const exp = window.store.getExpenseById(expenseId);
    if (!group || !exp) return;

    this.editingExpenseId = expenseId;
    document.getElementById('modal-expense-title').textContent = 'Edit Expense';
    document.getElementById('expense-id').value = exp.id;
    document.getElementById('expense-title').value = exp.title;
    document.getElementById('expense-amount').value = exp.amount;
    document.getElementById('expense-category').value = exp.category || 'Food & Dining';
    document.getElementById('expense-date').value = exp.date || new Date().toISOString().split('T')[0];
    document.getElementById('expense-notes').value = exp.notes || '';

    // Payer
    const payerSelect = document.getElementById('expense-paid-by');
    payerSelect.innerHTML = (group.members || []).map(m => `
      <option value="${m.id}" ${m.id === exp.paidBy ? 'selected' : ''}>
        ${this.escapeHTML(m.name)}
      </option>
    `).join('');

    // Split type
    document.getElementById('expense-split-type').value = exp.splitType || 'equal';
    this.renderSplitDetailsInputs(exp.splits);

    document.getElementById('modal-expense').classList.add('active');
  }

  renderSplitDetailsInputs(existingSplits = null) {
    const group = window.store.getCurrentGroup();
    if (!group) return;

    const splitType = document.getElementById('expense-split-type').value;
    const amount = parseFloat(document.getElementById('expense-amount').value) || 0;
    const currency = group.currency || '$';
    const container = document.getElementById('expense-splits-container');
    const members = group.members || [];

    if (splitType === 'equal') {
      // Checkboxes for each member
      const activeMemberIds = existingSplits 
        ? Object.keys(existingSplits)
        : members.map(m => m.id);

      const computed = window.ExpenseCalculator.computeEqualSplits(amount, activeMemberIds);

      container.innerHTML = `
        <div class="space-y-2">
          <p class="text-xs text-gray-500 mb-2">Select members who share this expense equally:</p>
          ${members.map(m => {
            const isChecked = activeMemberIds.includes(m.id);
            const share = computed[m.id] || 0;
            return `
              <label class="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer">
                <div class="flex items-center gap-2.5">
                  <input type="checkbox" name="split_equal_member" value="${m.id}" ${isChecked ? 'checked' : ''}
                    class="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    onchange="window.app.onEqualSplitCheckboxChange()">
                  <span class="text-sm font-semibold text-gray-800">${this.escapeHTML(m.name)}</span>
                </div>
                <span class="text-xs font-bold text-gray-600 equal-share-tag" data-member-id="${m.id}">
                  ${currency}${share.toFixed(2)}
                </span>
              </label>
            `;
          }).join('')}
        </div>
      `;
    } else if (splitType === 'exact') {
      container.innerHTML = `
        <div class="space-y-2">
          <div class="flex justify-between items-center text-xs text-gray-500 mb-2">
            <span>Specify exact amount per member:</span>
            <span id="exact-split-status" class="font-bold text-rose-500"></span>
          </div>
          ${members.map(m => {
            const val = existingSplits && existingSplits[m.id] !== undefined ? existingSplits[m.id] : '';
            return `
              <div class="flex items-center justify-between gap-3 p-2 rounded-xl border border-gray-100">
                <span class="text-sm font-semibold text-gray-800 flex-1">${this.escapeHTML(m.name)}</span>
                <div class="flex items-center gap-1 w-32">
                  <span class="text-xs text-gray-400 font-bold">${currency}</span>
                  <input type="number" step="0.01" min="0" data-exact-member="${m.id}" value="${val}" placeholder="0.00"
                    class="w-full text-right px-2 py-1 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                    oninput="window.app.onExactSplitInputChange()">
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
      this.onExactSplitInputChange();
    } else if (splitType === 'percentage') {
      container.innerHTML = `
        <div class="space-y-2">
          <div class="flex justify-between items-center text-xs text-gray-500 mb-2">
            <span>Specify percentage per member (must sum to 100%):</span>
            <span id="percentage-split-status" class="font-bold text-rose-500"></span>
          </div>
          ${members.map(m => {
            let pct = '';
            if (existingSplits && amount > 0 && existingSplits[m.id]) {
              pct = Math.round((existingSplits[m.id] / amount) * 100);
            }
            return `
              <div class="flex items-center justify-between gap-3 p-2 rounded-xl border border-gray-100">
                <span class="text-sm font-semibold text-gray-800 flex-1">${this.escapeHTML(m.name)}</span>
                <div class="flex items-center gap-1 w-28">
                  <input type="number" step="1" min="0" max="100" data-pct-member="${m.id}" value="${pct}" placeholder="0"
                    class="w-full text-right px-2 py-1 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                    oninput="window.app.onPercentageSplitInputChange()">
                  <span class="text-xs text-gray-400 font-bold">%</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
      this.onPercentageSplitInputChange();
    } else if (splitType === 'shares') {
      container.innerHTML = `
        <div class="space-y-2">
          <p class="text-xs text-gray-500 mb-2">Assign relative shares (e.g. 1 share, 2 shares):</p>
          ${members.map(m => `
            <div class="flex items-center justify-between gap-3 p-2 rounded-xl border border-gray-100">
              <span class="text-sm font-semibold text-gray-800 flex-1">${this.escapeHTML(m.name)}</span>
              <div class="flex items-center gap-1 w-24">
                <input type="number" step="1" min="0" data-share-member="${m.id}" value="1"
                  class="w-full text-right px-2 py-1 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                  oninput="window.app.onShareSplitInputChange()">
                <span class="text-xs text-gray-400">share</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  onEqualSplitCheckboxChange() {
    const group = window.store.getCurrentGroup();
    const currency = group?.currency || '$';
    const amount = parseFloat(document.getElementById('expense-amount').value) || 0;
    const checkedBoxes = Array.from(document.querySelectorAll('input[name="split_equal_member"]:checked'));
    const memberIds = checkedBoxes.map(cb => cb.value);

    const computed = window.ExpenseCalculator.computeEqualSplits(amount, memberIds);
    document.querySelectorAll('.equal-share-tag').forEach(tag => {
      const mId = tag.dataset.memberId;
      tag.textContent = `${currency}${(computed[mId] || 0).toFixed(2)}`;
    });
  }

  onExactSplitInputChange() {
    const amount = parseFloat(document.getElementById('expense-amount').value) || 0;
    const currency = window.store.getCurrentGroup()?.currency || '$';
    const exactInputs = document.querySelectorAll('[data-exact-member]');
    const exactMap = {};

    exactInputs.forEach(inp => {
      exactMap[inp.dataset.exactMember] = parseFloat(inp.value) || 0;
    });

    const val = window.ExpenseCalculator.validateExactSplits(amount, exactMap);
    const statusEl = document.getElementById('exact-split-status');

    if (statusEl) {
      if (val.isValid) {
        statusEl.textContent = '✓ Total matches exactly';
        statusEl.className = 'font-bold text-emerald-600';
      } else {
        const diff = val.difference;
        statusEl.textContent = diff > 0 
          ? `Remaining: ${currency}${diff.toFixed(2)}` 
          : `Over by: ${currency}${Math.abs(diff).toFixed(2)}`;
        statusEl.className = 'font-bold text-rose-500';
      }
    }
  }

  onPercentageSplitInputChange() {
    const pctInputs = document.querySelectorAll('[data-pct-member]');
    let sum = 0;
    pctInputs.forEach(inp => { sum += parseFloat(inp.value) || 0; });

    const statusEl = document.getElementById('percentage-split-status');
    if (statusEl) {
      if (Math.abs(sum - 100) < 0.01) {
        statusEl.textContent = '✓ Exactly 100%';
        statusEl.className = 'font-bold text-emerald-600';
      } else {
        statusEl.textContent = `Current total: ${sum}% (${100 - sum}% remaining)`;
        statusEl.className = 'font-bold text-rose-500';
      }
    }
  }

  onShareSplitInputChange() {
    // shares are auto-normalized on submit
  }

  handleExpenseFormSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('expense-title').value.trim();
    const amount = parseFloat(document.getElementById('expense-amount').value);
    const category = document.getElementById('expense-category').value;
    const dateInput = document.getElementById('expense-date');
    const date = (dateInput && dateInput.value) ? dateInput.value : new Date().toISOString().split('T')[0];
    const payerSelect = document.getElementById('expense-paid-by');
    let paidBy = payerSelect ? payerSelect.value : null;
    if (!paidBy) {
      const group = window.store.getCurrentGroup();
      if (group && group.members && group.members.length > 0) {
        paidBy = group.members[0].id;
      }
    }
    const splitType = document.getElementById('expense-split-type').value;
    const notes = document.getElementById('expense-notes').value.trim();

    if (!paidBy) {
      this.showToast('Please select who paid this expense.', 'error');
      return;
    }

    if (!title || isNaN(amount) || amount <= 0) {
      this.showToast('Please provide a valid title and positive amount.', 'error');
      return;
    }

    // Compute splits based on selected type
    let splits = {};
    if (splitType === 'equal') {
      const checkedBoxes = Array.from(document.querySelectorAll('input[name="split_equal_member"]:checked'));
      const memberIds = checkedBoxes.map(cb => cb.value);
      if (memberIds.length === 0) {
        this.showToast('Select at least one member to split the expense with.', 'error');
        return;
      }
      splits = window.ExpenseCalculator.computeEqualSplits(amount, memberIds);
    } else if (splitType === 'exact') {
      const exactInputs = document.querySelectorAll('[data-exact-member]');
      const exactMap = {};
      exactInputs.forEach(inp => { exactMap[inp.dataset.exactMember] = parseFloat(inp.value) || 0; });
      const val = window.ExpenseCalculator.validateExactSplits(amount, exactMap);
      if (!val.isValid) {
        this.showToast(`Exact split sum does not match total amount. Diff: ${val.difference}`, 'error');
        return;
      }
      splits = exactMap;
    } else if (splitType === 'percentage') {
      const pctInputs = document.querySelectorAll('[data-pct-member]');
      const pctMap = {};
      pctInputs.forEach(inp => { pctMap[inp.dataset.pctMember] = parseFloat(inp.value) || 0; });
      const val = window.ExpenseCalculator.computePercentageSplits(amount, pctMap);
      if (!val.isValid) {
        this.showToast(`Percentages must sum up to 100%. Current sum: ${val.sumPercentages}%`, 'error');
        return;
      }
      splits = val.splits;
    } else if (splitType === 'shares') {
      const shareInputs = document.querySelectorAll('[data-share-member]');
      const shareMap = {};
      shareInputs.forEach(inp => { shareMap[inp.dataset.shareMember] = parseFloat(inp.value) || 0; });
      const val = window.ExpenseCalculator.computeShareSplits(amount, shareMap);
      if (!val.isValid) {
        this.showToast('Total shares must be greater than zero.', 'error');
        return;
      }
      splits = val.splits;
    }

    if (this.editingExpenseId) {
      window.store.updateExpense(this.editingExpenseId, {
        title,
        amount,
        category,
        date,
        paidBy,
        splitType,
        splits,
        notes
      });
      this.showToast('Expense updated successfully!', 'success');
    } else {
      window.store.addExpense({
        title,
        amount,
        category,
        date,
        paidBy,
        splitType,
        splits,
        notes
      });
      this.showToast('New expense added!', 'success');
    }

    this.closeAllModals();
  }

  deleteExpense(expenseId) {
    if (confirm('Are you sure you want to delete this expense?')) {
      window.store.deleteExpense(expenseId);
      this.showToast('Expense deleted.', 'info');
    }
  }

  // -------------------------------------------------------------
  // Member Profile & Picture Management Logic
  // -------------------------------------------------------------
  openAddMemberModal() {
    this.editingMemberId = null;
    this.currentMemberAvatarBase64 = null;

    document.getElementById('modal-member-title').textContent = 'Add Group Member';
    document.getElementById('member-form').reset();
    document.getElementById('member-id').value = '';
    this.updateMemberPhotoPreview(null);

    document.getElementById('modal-member').classList.add('active');
  }

  openEditMemberModal(memberId) {
    const member = window.store.getMemberById(memberId);
    if (!member) return;

    this.editingMemberId = memberId;
    this.currentMemberAvatarBase64 = member.avatar;

    document.getElementById('modal-member-title').textContent = 'Edit Member Profile';
    document.getElementById('member-id').value = member.id;
    document.getElementById('member-name').value = member.name;
    document.getElementById('member-email').value = member.email || '';
    document.getElementById('member-color').value = member.color || '#4F46E5';

    this.updateMemberPhotoPreview(member.avatar, member.name, member.color);
    document.getElementById('modal-member').classList.add('active');
  }

  updateMemberPhotoPreview(avatarUrl, name = 'User', color = '#4F46E5') {
    const previewContainer = document.getElementById('member-photo-preview');
    if (!previewContainer) return;

    if (avatarUrl) {
      previewContainer.innerHTML = `<img src="${avatarUrl}" class="avatar-img" alt="Profile preview">`;
    } else {
      const initials = (name.slice(0, 2) || 'U').toUpperCase();
      previewContainer.innerHTML = `
        <div class="avatar-badge w-full h-full text-xl" style="background: ${color}">
          ${initials}
        </div>
      `;
    }
  }

  handleMemberFormSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('member-name').value.trim();
    const email = document.getElementById('member-email').value.trim();
    const color = document.getElementById('member-color').value;

    if (!name) {
      this.showToast('Please enter member name.', 'error');
      return;
    }

    if (this.editingMemberId) {
      window.store.updateMember(this.editingMemberId, {
        name,
        email,
        avatar: this.currentMemberAvatarBase64,
        color
      });
      this.showToast('Member profile updated!', 'success');
    } else {
      window.store.addMember({
        name,
        email,
        avatar: this.currentMemberAvatarBase64,
        color
      });
      this.showToast(`Added ${name} to group!`, 'success');
    }

    this.closeAllModals();
  }

  deleteMember(memberId) {
    try {
      if (confirm('Delete this member from the group?')) {
        window.store.deleteMember(memberId);
        this.showToast('Member removed from group.', 'info');
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // -------------------------------------------------------------
  // Settle Up Modal & Debt Settlement Logic
  // -------------------------------------------------------------
  openSettleModal(fromMemberId = null, toMemberId = null, defaultAmount = null) {
    const group = window.store.getCurrentGroup();
    if (!group) return;

    const fromSelect = document.getElementById('settle-from');
    const toSelect = document.getElementById('settle-to');

    fromSelect.innerHTML = (group.members || []).map(m => `
      <option value="${m.id}" ${m.id === fromMemberId ? 'selected' : ''}>
        ${this.escapeHTML(m.name)}
      </option>
    `).join('');

    toSelect.innerHTML = (group.members || []).map(m => `
      <option value="${m.id}" ${m.id === toMemberId ? 'selected' : ''}>
        ${this.escapeHTML(m.name)}
      </option>
    `).join('');

    document.getElementById('settle-amount').value = defaultAmount ? Number(defaultAmount).toFixed(2) : '';
    document.getElementById('settle-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('settle-method').value = 'UPI';
    document.getElementById('settle-notes').value = '';

    document.getElementById('modal-settle').classList.add('active');
  }

  handleSettleFormSubmit(e) {
    e.preventDefault();
    const fromMemberId = document.getElementById('settle-from').value;
    const toMemberId = document.getElementById('settle-to').value;
    const amount = parseFloat(document.getElementById('settle-amount').value);
    const date = document.getElementById('settle-date').value;
    const method = document.getElementById('settle-method').value;
    const notes = document.getElementById('settle-notes').value.trim();

    if (fromMemberId === toMemberId) {
      this.showToast('Payer and receiver cannot be the same member.', 'error');
      return;
    }

    if (isNaN(amount) || amount <= 0) {
      this.showToast('Please enter a valid settlement amount.', 'error');
      return;
    }

    window.store.addSettlement({
      fromMemberId,
      toMemberId,
      amount,
      date,
      method,
      notes
    });

    this.closeAllModals();
    this.showToast('Settlement payment recorded!', 'success');

    // Trigger celebration confetti
    if (typeof window.confetti === 'function') {
      window.confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }

  deleteSettlement(settlementId) {
    if (confirm('Delete this settlement record?')) {
      window.store.deleteSettlement(settlementId);
      this.showToast('Settlement record deleted.', 'info');
    }
  }

  // -------------------------------------------------------------
  // Group Management Modals
  // -------------------------------------------------------------
  openNewGroupModal() {
    document.getElementById('group-form').reset();
    document.getElementById('group-currency').value = '$';
    document.getElementById('modal-group').classList.add('active');
  }

  handleGroupFormSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('group-name').value.trim();
    const currency = document.getElementById('group-currency').value.trim();
    const description = document.getElementById('group-description').value.trim();

    if (!name) {
      this.showToast('Group name is required.', 'error');
      return;
    }

    const newGroup = window.store.addGroup({ name, currency, description });
    this.closeAllModals();
    this.showToast(`Group "${newGroup.name}" created!`, 'success');
  }

  deleteGroup(groupId) {
    try {
      if (confirm('Are you sure you want to delete this group? All expenses will be lost.')) {
        window.store.deleteGroup(groupId);
        this.showToast('Group deleted.', 'info');
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // -------------------------------------------------------------
  // Toast Notification System
  // -------------------------------------------------------------
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span><span>${this.escapeHTML(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  // -------------------------------------------------------------
  // Utility & HTML Formatters
  // -------------------------------------------------------------
  renderAvatarHTML(member, sizeClasses = 'w-10 h-10 text-xs') {
    if (!member) {
      return `<div class="avatar-badge ${sizeClasses} bg-gray-400">?</div>`;
    }

    if (member.avatar) {
      return `
        <div class="avatar-badge ${sizeClasses}">
          <img src="${member.avatar}" alt="${this.escapeHTML(member.name)}" class="avatar-img" />
        </div>
      `;
    }

    const parts = (member.name || 'User').trim().split(/\s+/);
    const initials = parts.length >= 2 
      ? (parts[0][0] + parts[1][0]).toUpperCase() 
      : ((member.name || 'U').slice(0, 2)).toUpperCase();
    const bg = member.color || '#4F46E5';

    return `
      <div class="avatar-badge ${sizeClasses}" style="background-color: ${bg}">
        ${initials}
      </div>
    `;
  }

  getCategoryIcon(cat) {
    switch (cat) {
      case 'Food & Dining': return '🍕';
      case 'Transportation': return '🚗';
      case 'Accommodation': return '🏠';
      case 'Groceries': return '🛒';
      case 'Entertainment': return '🎟️';
      case 'Shopping': return '🛍️';
      case 'Utilities': return '💡';
      default: return '📦';
    }
  }

  getCategoryBadgeClass(cat) {
    switch (cat) {
      case 'Food & Dining': return 'cat-food';
      case 'Transportation': return 'cat-transit';
      case 'Accommodation': return 'cat-stay';
      case 'Groceries': return 'cat-groceries';
      case 'Entertainment': return 'cat-entertainment';
      case 'Shopping': return 'cat-shopping';
      case 'Utilities': return 'cat-utilities';
      default: return 'cat-other';
    }
  }

  escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Instantiate upon DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.app = new AppController();
});
