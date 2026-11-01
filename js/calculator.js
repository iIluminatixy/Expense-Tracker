/**
 * calculator.js
 * Split logic, balance calculations, and greedy debt-simplification algorithm.
 */

const ExpenseCalculator = {
  // Round to 2 decimal places safely
  round2(num) {
    return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
  },

  /**
   * Calculate equal split among participating members,
   * distributing any remainder cents to ensure total matches exactly.
   */
  computeEqualSplits(totalAmount, memberIds) {
    const amount = Number(totalAmount);
    if (!memberIds || memberIds.length === 0 || isNaN(amount) || amount <= 0) {
      return {};
    }

    const count = memberIds.length;
    const baseShare = Math.floor((amount / count) * 100) / 100;
    let remainder = Math.round((amount - (baseShare * count)) * 100); // in cents

    const splits = {};
    memberIds.forEach((id) => {
      let share = baseShare;
      if (remainder > 0) {
        share = this.round2(share + 0.01);
        remainder--;
      }
      splits[id] = share;
    });

    return splits;
  },

  /**
   * Calculate exact splits from an object of { memberId: amount }
   */
  validateExactSplits(totalAmount, exactMap) {
    const total = this.round2(totalAmount);
    let sum = 0;
    Object.values(exactMap).forEach(v => { sum = this.round2(sum + Number(v || 0)); });
    return {
      isValid: Math.abs(sum - total) < 0.02,
      sum,
      difference: this.round2(total - sum)
    };
  },

  /**
   * Calculate percentage splits from an object of { memberId: percentage }
   */
  computePercentageSplits(totalAmount, percentMap) {
    const amount = Number(totalAmount);
    const splits = {};
    let sumPercentages = 0;

    Object.entries(percentMap).forEach(([id, pct]) => {
      const percentage = Number(pct || 0);
      sumPercentages = this.round2(sumPercentages + percentage);
      splits[id] = this.round2((amount * percentage) / 100);
    });

    return {
      splits,
      isValid: Math.abs(sumPercentages - 100) < 0.01,
      sumPercentages,
      difference: this.round2(100 - sumPercentages)
    };
  },

  /**
   * Calculate shares splits (e.g. 1 share, 2 shares, etc.)
   */
  computeShareSplits(totalAmount, sharesMap) {
    const amount = Number(totalAmount);
    let totalShares = 0;
    Object.values(sharesMap).forEach(s => { totalShares += Number(s || 0); });

    const splits = {};
    if (totalShares <= 0) return { splits, totalShares: 0, isValid: false };

    Object.entries(sharesMap).forEach(([id, s]) => {
      const shareVal = Number(s || 0);
      splits[id] = this.round2((amount * shareVal) / totalShares);
    });

    return { splits, totalShares, isValid: true };
  },

  /**
   * Computes per-member balances:
   * paid: total amount paid by this member as payer
   * share: total cost owed for expenses they participated in
   * settlementsPaid: payments made to other members
   * settlementsReceived: payments received from other members
   * netBalance = (paid - share) + settlementsPaid - settlementsReceived
   */
  calculateBalances(group) {
    if (!group || !group.members) return {};

    const balanceMap = {};

    // Initialize map
    group.members.forEach(m => {
      balanceMap[m.id] = {
        member: m,
        paid: 0,
        share: 0,
        settlementsPaid: 0,
        settlementsReceived: 0,
        netBalance: 0
      };
    });

    // Tally Expenses
    (group.expenses || []).forEach(exp => {
      const payerId = exp.paidBy;
      const amount = Number(exp.amount || 0);

      if (balanceMap[payerId]) {
        balanceMap[payerId].paid = this.round2(balanceMap[payerId].paid + amount);
      }

      if (exp.splits) {
        Object.entries(exp.splits).forEach(([memberId, shareAmount]) => {
          if (balanceMap[memberId]) {
            balanceMap[memberId].share = this.round2(balanceMap[memberId].share + Number(shareAmount || 0));
          }
        });
      }
    });

    // Tally Settlements
    (group.settlements || []).forEach(s => {
      const fromId = s.fromMemberId;
      const toId = s.toMemberId;
      const amount = Number(s.amount || 0);

      if (balanceMap[fromId]) {
        balanceMap[fromId].settlementsPaid = this.round2(balanceMap[fromId].settlementsPaid + amount);
      }
      if (balanceMap[toId]) {
        balanceMap[toId].settlementsReceived = this.round2(balanceMap[toId].settlementsReceived + amount);
      }
    });

    // Calculate final Net Balance
    Object.values(balanceMap).forEach(entry => {
      entry.netBalance = this.round2(
        (entry.paid - entry.share) + entry.settlementsPaid - entry.settlementsReceived
      );
    });

    return balanceMap;
  },

  /**
   * Greedy Debt-Simplification Algorithm (Minimum Cash Flow)
   * Converts all member net balances into the minimal number of direct transfers.
   * Returns array of transactions: [{ from, to, amount }, ...]
   */
  simplifyDebts(group) {
    const balances = this.calculateBalances(group);
    
    // Divide into debtors (< -0.01) and creditors (> 0.01)
    const debtors = [];
    const creditors = [];

    Object.values(balances).forEach(b => {
      if (b.netBalance < -0.01) {
        debtors.push({
          id: b.member.id,
          name: b.member.name,
          avatar: b.member.avatar,
          color: b.member.color,
          balance: b.netBalance // negative
        });
      } else if (b.netBalance > 0.01) {
        creditors.push({
          id: b.member.id,
          name: b.member.name,
          avatar: b.member.avatar,
          color: b.member.color,
          balance: b.netBalance // positive
        });
      }
    });

    // Sort: debtors ascending (largest debt first), creditors descending (largest credit first)
    debtors.sort((a, b) => a.balance - b.balance);
    creditors.sort((a, b) => b.balance - a.balance);

    const transactions = [];
    let d = 0;
    let c = 0;

    while (d < debtors.length && c < creditors.length) {
      const debtor = debtors[d];
      const creditor = creditors[c];

      const debtAmount = Math.abs(debtor.balance);
      const creditAmount = creditor.balance;
      const settleAmount = this.round2(Math.min(debtAmount, creditAmount));

      if (settleAmount > 0.01) {
        transactions.push({
          fromId: debtor.id,
          fromName: debtor.name,
          fromAvatar: debtor.avatar,
          fromColor: debtor.color,
          toId: creditor.id,
          toName: creditor.name,
          toAvatar: creditor.avatar,
          toColor: creditor.color,
          amount: settleAmount
        });
      }

      debtor.balance = this.round2(debtor.balance + settleAmount);
      creditor.balance = this.round2(creditor.balance - settleAmount);

      if (Math.abs(debtor.balance) < 0.01) d++;
      if (Math.abs(creditor.balance) < 0.01) c++;
    }

    return transactions;
  },

  /**
   * Group level high-level analytics & totals
   */
  getGroupStats(group) {
    if (!group) return null;

    const expenses = group.expenses || [];
    const totalSpend = expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
    const totalCount = expenses.length;
    const memberCount = (group.members || []).length || 1;
    const averagePerPerson = this.round2(totalSpend / memberCount);

    // Category breakdown
    const categoryTotals = {};
    expenses.forEach(e => {
      const cat = e.category || 'Other';
      categoryTotals[cat] = this.round2((categoryTotals[cat] || 0) + Number(e.amount || 0));
    });

    // Settlements total
    const settlements = group.settlements || [];
    const totalSettled = settlements.reduce((acc, s) => acc + Number(s.amount || 0), 0);

    // Highest expense
    let highestExpense = null;
    if (expenses.length > 0) {
      highestExpense = expenses.reduce((max, e) => Number(e.amount) > Number(max.amount) ? e : max, expenses[0]);
    }

    return {
      totalSpend: this.round2(totalSpend),
      totalCount,
      memberCount,
      averagePerPerson,
      categoryTotals,
      totalSettled: this.round2(totalSettled),
      highestExpense
    };
  }
};

window.ExpenseCalculator = ExpenseCalculator;
