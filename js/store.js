/**
 * store.js
 * Browser-local persistence layer using localStorage.
 * Supports multiple groups, member management, photo compression,
 * expense tracking, settlement ledger, and backup/restore.
 */

const STORAGE_KEY = 'group_expense_tracker_db_v2';

class DataStore {
  constructor() {
    this.state = null;
    this.listeners = [];
    this.init();
  }

  init() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.state = JSON.parse(raw);
        // Ensure structure validity
        if (!this.state.groups || !Array.isArray(this.state.groups) || this.state.groups.length === 0) {
          this.loadDefaultData();
        }
      } else {
        this.loadDefaultData();
      }
    } catch (e) {
      console.warn('Failed to parse localStorage data, loading demo defaults:', e);
      this.loadDefaultData();
    }
    this.persist();
  }

  loadDefaultData() {
    if (typeof window.SAMPLE_DATA !== 'undefined') {
      this.state = JSON.parse(JSON.stringify(window.SAMPLE_DATA));
    } else {
      this.state = {
        version: '2.0',
        currentGroupId: 'default_group',
        currentUserId: 'default_user',
        groups: [
          {
            id: 'default_group',
            name: 'My Friends Group 🌟',
            currency: '$',
            description: 'Group expenses',
            createdAt: new Date().toISOString(),
            members: [
              {
                id: 'default_user',
                name: 'You',
                email: 'you@example.com',
                avatar: null,
                color: '#4F46E5'
              }
            ],
            expenses: [],
            settlements: []
          }
        ]
      };
    }
  }

  persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.notify();
    } catch (e) {
      console.error('Storage quota exceeded or error persisting state:', e);
      alert('Local storage is full. Please remove some attachments or old expenses.');
    }
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notify() {
    this.listeners.forEach(cb => {
      try { cb(this.state); } catch (e) { console.error('Listener error:', e); }
    });
  }

  // -------------------------------------------------------------
  // Group Operations
  // -------------------------------------------------------------
  getGroups() {
    return this.state.groups || [];
  }

  getCurrentGroup() {
    const group = this.state.groups.find(g => g.id === this.state.currentGroupId);
    if (!group && this.state.groups.length > 0) {
      this.state.currentGroupId = this.state.groups[0].id;
      return this.state.groups[0];
    }
    return group;
  }

  setCurrentGroup(groupId) {
    const exists = this.state.groups.some(g => g.id === groupId);
    if (exists) {
      this.state.currentGroupId = groupId;
      // Also ensure current user is updated if not member of new group
      const currentGroup = this.getCurrentGroup();
      if (currentGroup && currentGroup.members.length > 0) {
        const isMember = currentGroup.members.some(m => m.id === this.state.currentUserId);
        if (!isMember) {
          this.state.currentUserId = currentGroup.members[0].id;
        }
      }
      this.persist();
    }
  }

  addGroup({ name, currency = '$', description = '' }) {
    const id = 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    
    // Copy the active user as the first member or create one
    let initialUser = this.getCurrentUser();
    if (!initialUser) {
      initialUser = {
        id: 'member_' + Date.now(),
        name: 'You',
        email: 'you@example.com',
        avatar: null,
        color: '#4F46E5'
      };
    } else {
      initialUser = { ...initialUser };
    }

    const newGroup = {
      id,
      name: name.trim() || 'New Group',
      currency: currency || '$',
      description: description.trim(),
      createdAt: new Date().toISOString(),
      members: [initialUser],
      expenses: [],
      settlements: []
    };

    this.state.groups.push(newGroup);
    this.state.currentGroupId = id;
    this.persist();
    return newGroup;
  }

  updateGroup(groupId, { name, currency, description }) {
    const group = this.state.groups.find(g => g.id === groupId);
    if (!group) return null;

    if (name !== undefined) group.name = name.trim();
    if (currency !== undefined) group.currency = currency.trim();
    if (description !== undefined) group.description = description.trim();

    this.persist();
    return group;
  }

  deleteGroup(groupId) {
    if (this.state.groups.length <= 1) {
      throw new Error('Cannot delete the last remaining group. Create another group first.');
    }
    this.state.groups = this.state.groups.filter(g => g.id !== groupId);
    this.state.currentGroupId = this.state.groups[0].id;
    this.persist();
  }

  // -------------------------------------------------------------
  // Member Operations
  // -------------------------------------------------------------
  getCurrentUser() {
    const currentGroup = this.getCurrentGroup();
    if (!currentGroup || !currentGroup.members) return null;
    return currentGroup.members.find(m => m.id === this.state.currentUserId) || currentGroup.members[0] || null;
  }

  getCurrentUserId() {
    return this.state.currentUserId || (this.getCurrentUser()?.id) || null;
  }

  setCurrentUser(memberId) {
    const currentGroup = this.getCurrentGroup();
    if (currentGroup && currentGroup.members.some(m => m.id === memberId)) {
      this.state.currentUserId = memberId;
      this.persist();
    }
  }

  getMembers(groupId = null) {
    const group = groupId ? this.state.groups.find(g => g.id === groupId) : this.getCurrentGroup();
    return group ? (group.members || []) : [];
  }

  getMemberById(memberId, groupId = null) {
    const members = this.getMembers(groupId);
    return members.find(m => m.id === memberId) || null;
  }

  addMember({ name, email = '', avatar = null, color = null }) {
    const group = this.getCurrentGroup();
    if (!group) throw new Error('No active group found.');

    const colors = ['#4F46E5', '#059669', '#DC2626', '#D97706', '#7C3AED', '#2563EB', '#DB2777', '#0891B2'];
    const assignedColor = color || colors[group.members.length % colors.length];

    // Compute initials for default avatar if none provided
    let finalAvatar = avatar;
    if (!finalAvatar) {
      const parts = name.trim().split(/\s+/);
      const initials = parts.length >= 2 
        ? (parts[0][0] + parts[1][0]).toUpperCase() 
        : (name.slice(0, 2) || 'U').toUpperCase();
      finalAvatar = window.createSvgAvatar ? window.createSvgAvatar(initials, assignedColor, '#1F2937') : null;
    }

    const newMember = {
      id: 'member_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: name.trim(),
      email: email.trim(),
      avatar: finalAvatar,
      color: assignedColor
    };

    group.members.push(newMember);
    this.persist();
    return newMember;
  }

  updateMember(memberId, { name, email, avatar, color }) {
    const group = this.getCurrentGroup();
    if (!group) return null;

    const member = group.members.find(m => m.id === memberId);
    if (!member) return null;

    if (name !== undefined) member.name = name.trim();
    if (email !== undefined) member.email = email.trim();
    if (avatar !== undefined) member.avatar = avatar;
    if (color !== undefined) member.color = color;

    this.persist();
    return member;
  }

  deleteMember(memberId) {
    const group = this.getCurrentGroup();
    if (!group) return;

    if (group.members.length <= 1) {
      throw new Error('A group must have at least one member.');
    }

    // Check if member is involved in any expense
    const hasExpenses = (group.expenses || []).some(
      e => e.paidBy === memberId || (e.splits && e.splits[memberId] > 0)
    );
    const hasSettlements = (group.settlements || []).some(
      s => s.fromMemberId === memberId || s.toMemberId === memberId
    );

    if (hasExpenses || hasSettlements) {
      throw new Error('Cannot delete a member with existing expense or settlement records. Settle or remove those records first.');
    }

    group.members = group.members.filter(m => m.id !== memberId);
    if (this.state.currentUserId === memberId) {
      this.state.currentUserId = group.members[0].id;
    }

    this.persist();
  }

  // -------------------------------------------------------------
  // Expense Operations
  // -------------------------------------------------------------
  getExpenses(groupId = null) {
    const group = groupId ? this.state.groups.find(g => g.id === groupId) : this.getCurrentGroup();
    return group ? (group.expenses || []) : [];
  }

  getExpenseById(expenseId) {
    const group = this.getCurrentGroup();
    return group ? (group.expenses || []).find(e => e.id === expenseId) : null;
  }

  addExpense({ title, amount, category = 'General', date, paidBy, splitType = 'equal', splits = {}, notes = '' }) {
    const group = this.getCurrentGroup();
    if (!group) throw new Error('No active group.');

    const newExpense = {
      id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      title: title.trim(),
      amount: parseFloat(amount),
      category: category.trim(),
      date: date || new Date().toISOString().split('T')[0],
      paidBy,
      splitType,
      splits,
      notes: notes.trim(),
      createdAt: new Date().toISOString()
    };

    if (!group.expenses) group.expenses = [];
    group.expenses.unshift(newExpense);
    this.persist();
    return newExpense;
  }

  updateExpense(expenseId, updates) {
    const group = this.getCurrentGroup();
    if (!group || !group.expenses) return null;

    const idx = group.expenses.findIndex(e => e.id === expenseId);
    if (idx === -1) return null;

    group.expenses[idx] = {
      ...group.expenses[idx],
      ...updates,
      amount: updates.amount !== undefined ? parseFloat(updates.amount) : group.expenses[idx].amount
    };

    this.persist();
    return group.expenses[idx];
  }

  deleteExpense(expenseId) {
    const group = this.getCurrentGroup();
    if (!group || !group.expenses) return;

    group.expenses = group.expenses.filter(e => e.id !== expenseId);
    this.persist();
  }

  // -------------------------------------------------------------
  // Settlements Operations
  // -------------------------------------------------------------
  getSettlements(groupId = null) {
    const group = groupId ? this.state.groups.find(g => g.id === groupId) : this.getCurrentGroup();
    return group ? (group.settlements || []) : [];
  }

  addSettlement({ fromMemberId, toMemberId, amount, date, method = 'Cash', notes = '' }) {
    const group = this.getCurrentGroup();
    if (!group) throw new Error('No active group.');

    const newSettlement = {
      id: 'settle_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      fromMemberId,
      toMemberId,
      amount: parseFloat(amount),
      date: date || new Date().toISOString().split('T')[0],
      method: method || 'Cash',
      notes: notes.trim(),
      createdAt: new Date().toISOString()
    };

    if (!group.settlements) group.settlements = [];
    group.settlements.unshift(newSettlement);
    this.persist();
    return newSettlement;
  }

  deleteSettlement(settlementId) {
    const group = this.getCurrentGroup();
    if (!group || !group.settlements) return;

    group.settlements = group.settlements.filter(s => s.id !== settlementId);
    this.persist();
  }

  // -------------------------------------------------------------
  // Photo Compression Helper (Canvas -> Base64)
  // -------------------------------------------------------------
  async compressImage(file, maxDimension = 180, quality = 0.82) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        return reject(new Error('Selected file is not an image.'));
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Failed to load image.'));
        img.onload = () => {
          let { width, height } = img;
          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Export compressed JPEG base64
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // -------------------------------------------------------------
  // Backup / Restore / Reset
  // -------------------------------------------------------------
  exportJSON() {
    return JSON.stringify(this.state, null, 2);
  }

  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.groups || !Array.isArray(parsed.groups)) {
        throw new Error('Invalid JSON format: missing groups list.');
      }
      this.state = parsed;
      this.persist();
      return true;
    } catch (e) {
      console.error('Import failed:', e);
      throw e;
    }
  }

  resetToDemo() {
    this.loadDefaultData();
    this.persist();
  }

  clearAll() {
    localStorage.removeItem(STORAGE_KEY);
    this.init();
  }
}

// Global instance
window.store = new DataStore();
