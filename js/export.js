/**
 * export.js
 * Comprehensive export functionality:
 * 1. Export all expenses, balances & settlements to CSV with UTF-8 BOM
 * 2. Export beautifully styled PDF report via jsPDF + autoTable (with printable HTML fallback)
 * 3. JSON Backup & Restore for complete data portability
 */

const ExpenseExporter = {
  /**
   * Helper to escape CSV cell contents safely
   */
  escapeCSV(val) {
    if (val === null || val === undefined) return '""';
    let str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  },

  /**
   * Export Group Data to CSV Spreadsheet
   */
  exportToCSV(group) {
    if (!group) return;

    const currency = group.currency || '$';
    const balances = window.ExpenseCalculator.calculateBalances(group);
    const debts = window.ExpenseCalculator.simplifyDebts(group);
    const stats = window.ExpenseCalculator.getGroupStats(group);

    const rows = [];

    // Header Meta
    rows.push([this.escapeCSV('GROUP EXPENSE REPORT')]);
    rows.push([this.escapeCSV('Group Name'), this.escapeCSV(group.name)]);
    rows.push([this.escapeCSV('Description'), this.escapeCSV(group.description || 'N/A')]);
    rows.push([this.escapeCSV('Exported At'), this.escapeCSV(new Date().toLocaleString())]);
    rows.push([this.escapeCSV('Currency'), this.escapeCSV(currency)]);
    rows.push([this.escapeCSV('Total Group Spend'), this.escapeCSV(`${currency} ${stats.totalSpend.toFixed(2)}`)]);
    rows.push([this.escapeCSV('Total Expenses Count'), this.escapeCSV(stats.totalCount)]);
    rows.push([]);

    // -------------------------------------------------------------
    // Section 1: All Expenses
    // -------------------------------------------------------------
    rows.push([this.escapeCSV('--- ALL EXPENSES ---')]);
    rows.push([
      this.escapeCSV('Date'),
      this.escapeCSV('Expense Title'),
      this.escapeCSV('Category'),
      this.escapeCSV(`Amount (${currency})`),
      this.escapeCSV('Paid By'),
      this.escapeCSV('Split Type'),
      this.escapeCSV('Split Breakdown Details'),
      this.escapeCSV('Notes')
    ]);

    const memberLookup = {};
    (group.members || []).forEach(m => { memberLookup[m.id] = m.name; });

    (group.expenses || []).forEach(exp => {
      const payerName = memberLookup[exp.paidBy] || 'Unknown';
      let splitDetails = [];
      if (exp.splits) {
        Object.entries(exp.splits).forEach(([mId, amt]) => {
          const mName = memberLookup[mId] || mId;
          splitDetails.push(`${mName}: ${currency}${Number(amt).toFixed(2)}`);
        });
      }

      rows.push([
        this.escapeCSV(exp.date),
        this.escapeCSV(exp.title),
        this.escapeCSV(exp.category || 'General'),
        this.escapeCSV(Number(exp.amount).toFixed(2)),
        this.escapeCSV(payerName),
        this.escapeCSV(exp.splitType || 'equal'),
        this.escapeCSV(splitDetails.join(' | ')),
        this.escapeCSV(exp.notes || '')
      ]);
    });

    rows.push([]);

    // -------------------------------------------------------------
    // Section 2: Member Balances Summary
    // -------------------------------------------------------------
    rows.push([this.escapeCSV('--- MEMBER NET BALANCES ---')]);
    rows.push([
      this.escapeCSV('Member Name'),
      this.escapeCSV('Email'),
      this.escapeCSV(`Total Paid (${currency})`),
      this.escapeCSV(`Total Share (${currency})`),
      this.escapeCSV(`Settlements Paid (${currency})`),
      this.escapeCSV(`Settlements Recv (${currency})`),
      this.escapeCSV(`Net Balance (${currency})`),
      this.escapeCSV('Status')
    ]);

    Object.values(balances).forEach(b => {
      let status = 'Settled Up';
      if (b.netBalance > 0.01) {
        status = `Gets Back ${currency}${b.netBalance.toFixed(2)}`;
      } else if (b.netBalance < -0.01) {
        status = `Owes ${currency}${Math.abs(b.netBalance).toFixed(2)}`;
      }

      rows.push([
        this.escapeCSV(b.member.name),
        this.escapeCSV(b.member.email || ''),
        this.escapeCSV(b.paid.toFixed(2)),
        this.escapeCSV(b.share.toFixed(2)),
        this.escapeCSV(b.settlementsPaid.toFixed(2)),
        this.escapeCSV(b.settlementsReceived.toFixed(2)),
        this.escapeCSV(b.netBalance.toFixed(2)),
        this.escapeCSV(status)
      ]);
    });

    rows.push([]);

    // -------------------------------------------------------------
    // Section 3: Suggested Settlements (Who Owes Whom)
    // -------------------------------------------------------------
    rows.push([this.escapeCSV('--- SIMPLIFIED SETTLEMENT PLAN (WHO OWES WHOM) ---')]);
    rows.push([
      this.escapeCSV('Debtor (Pays)'),
      this.escapeCSV('Creditor (Receives)'),
      this.escapeCSV(`Amount (${currency})`),
      this.escapeCSV('Status')
    ]);

    if (debts.length === 0) {
      rows.push([this.escapeCSV('All settled! No outstanding debts.'), '', '', '']);
    } else {
      debts.forEach(d => {
        rows.push([
          this.escapeCSV(d.fromName),
          this.escapeCSV(d.toName),
          this.escapeCSV(d.amount.toFixed(2)),
          this.escapeCSV('Pending Settlement')
        ]);
      });
    }

    rows.push([]);

    // -------------------------------------------------------------
    // Section 4: Settlement History
    // -------------------------------------------------------------
    rows.push([this.escapeCSV('--- RECORDED SETTLEMENTS HISTORY ---')]);
    rows.push([
      this.escapeCSV('Date'),
      this.escapeCSV('Paid By'),
      this.escapeCSV('Paid To'),
      this.escapeCSV(`Amount (${currency})`),
      this.escapeCSV('Payment Method'),
      this.escapeCSV('Notes')
    ]);

    (group.settlements || []).forEach(s => {
      rows.push([
        this.escapeCSV(s.date),
        this.escapeCSV(memberLookup[s.fromMemberId] || 'Unknown'),
        this.escapeCSV(memberLookup[s.toMemberId] || 'Unknown'),
        this.escapeCSV(Number(s.amount).toFixed(2)),
        this.escapeCSV(s.method || 'Cash'),
        this.escapeCSV(s.notes || '')
      ]);
    });

    // Build CSV with UTF-8 BOM
    const csvContent = '\uFEFF' + rows.map(r => r.join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const sanitizedName = group.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Expenses_${sanitizedName}_${new Date().toISOString().slice(0, 10)}.csv`;

    this.triggerDownload(blob, filename);
  },

  /**
   * Export Group Data to PDF Report
   */
  exportToPDF(group) {
    if (!group) return;

    const currency = group.currency || '$';
    const balances = window.ExpenseCalculator.calculateBalances(group);
    const debts = window.ExpenseCalculator.simplifyDebts(group);
    const stats = window.ExpenseCalculator.getGroupStats(group);

    const memberLookup = {};
    (group.members || []).forEach(m => { memberLookup[m.id] = m.name; });

    // Check if jsPDF with autotable is available
    if (window.jspdf && window.jspdf.jsPDF) {
      try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        let y = 14;

        // Top Brand Header Banner
        doc.setFillColor(79, 70, 229); // #4F46E5 Indigo
        doc.rect(0, 0, pageWidth, 24, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('SplitWise — Group Expense Report', 14, 11);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generated on ${new Date().toLocaleString()} · Offline Local Storage`, 14, 18);

        y = 32;

        // Group Title & Details
        doc.setTextColor(31, 41, 55); // #1F2937
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(group.name, 14, y);
        y += 6;

        if (group.description) {
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(107, 114, 128);
          doc.text(group.description, 14, y);
          y += 6;
        }

        // Summary Statistics Cards
        const cardWidth = (pageWidth - 28 - 9) / 4;
        const cardHeight = 18;

        const kpis = [
          { label: 'TOTAL SPEND', val: `${currency} ${stats.totalSpend.toFixed(2)}` },
          { label: 'EXPENSES', val: `${stats.totalCount}` },
          { label: 'MEMBERS', val: `${stats.memberCount}` },
          { label: 'AVG / MEMBER', val: `${currency} ${stats.averagePerPerson.toFixed(2)}` }
        ];

        kpis.forEach((kpi, idx) => {
          const x = 14 + idx * (cardWidth + 3);
          doc.setFillColor(243, 244, 246);
          doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'F');

          doc.setFontSize(7);
          doc.setTextColor(107, 114, 128);
          doc.setFont('helvetica', 'bold');
          doc.text(kpi.label, x + 4, y + 6);

          doc.setFontSize(10);
          doc.setTextColor(17, 24, 39);
          doc.setFont('helvetica', 'bold');
          doc.text(kpi.val, x + 4, y + 13);
        });

        y += cardHeight + 8;

        // ---------------------------------------------------------
        // Table 1: Simplified Debts (Who Owes Whom)
        // ---------------------------------------------------------
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 41, 55);
        doc.text('Simplified Settlement Plan (Who Owes Whom)', 14, y);
        y += 4;

        const debtRows = debts.length > 0
          ? debts.map(d => [
              d.fromName,
              '➔ pays to ➔',
              d.toName,
              `${currency} ${d.amount.toFixed(2)}`,
              'Pending'
            ])
          : [['All balances are settled up!', '', '', `${currency} 0.00`, 'Settled']];

        if (typeof doc.autoTable === 'function') {
          doc.autoTable({
            startY: y,
            head: [['Debtor', '', 'Creditor', 'Amount', 'Status']],
            body: debtRows,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 9 },
            styles: { fontSize: 8.5, cellPadding: 2.5 },
            columnStyles: {
              0: { fontStyle: 'bold', cellWidth: 40 },
              1: { halign: 'center', textColor: [107, 114, 128], cellWidth: 25 },
              2: { fontStyle: 'bold', cellWidth: 40 },
              3: { halign: 'right', fontStyle: 'bold', cellWidth: 35 },
              4: { halign: 'center', cellWidth: 25 }
            },
            margin: { left: 14, right: 14 }
          });

          y = doc.lastAutoTable.finalY + 8;
        }

        // ---------------------------------------------------------
        // Table 2: Itemized Expenses
        // ---------------------------------------------------------
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 41, 55);
        doc.text('Detailed Expenses Ledger', 14, y);
        y += 4;

        const expenseRows = (group.expenses || []).map(exp => {
          let splitStr = [];
          if (exp.splits) {
            Object.entries(exp.splits).forEach(([mId, amt]) => {
              splitStr.push(`${memberLookup[mId] || mId}: ${currency}${Number(amt).toFixed(0)}`);
            });
          }

          return [
            exp.date || '',
            exp.title || '',
            exp.category || 'General',
            memberLookup[exp.paidBy] || 'Unknown',
            `${currency} ${Number(exp.amount).toFixed(2)}`,
            splitStr.join(', ')
          ];
        });

        if (typeof doc.autoTable === 'function') {
          doc.autoTable({
            startY: y,
            head: [['Date', 'Title', 'Category', 'Paid By', 'Amount', 'Split Details']],
            body: expenseRows.length > 0 ? expenseRows : [['No expenses recorded yet', '', '', '', '', '']],
            theme: 'striped',
            headStyles: { fillColor: [31, 41, 55], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
            styles: { fontSize: 8, cellPadding: 2.5 },
            columnStyles: {
              0: { cellWidth: 22 },
              1: { fontStyle: 'bold', cellWidth: 42 },
              2: { cellWidth: 28 },
              3: { cellWidth: 26 },
              4: { halign: 'right', fontStyle: 'bold', cellWidth: 26 },
              5: { cellWidth: 38 }
            },
            margin: { left: 14, right: 14 }
          });
        }

        const sanitizedName = group.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        doc.save(`Expense_Report_${sanitizedName}_${new Date().toISOString().slice(0, 10)}.pdf`);
        return;
      } catch (err) {
        console.warn('jsPDF error, falling back to print-to-PDF modal:', err);
      }
    }

    // Fallback: Open print preview modal for standard browser "Save as PDF"
    this.openPrintPreview(group);
  },

  /**
   * Fallback Print Preview Modal (Native Browser Save as PDF)
   */
  openPrintPreview(group) {
    if (!group) return;
    const currency = group.currency || '$';
    const balances = window.ExpenseCalculator.calculateBalances(group);
    const debts = window.ExpenseCalculator.simplifyDebts(group);
    const stats = window.ExpenseCalculator.getGroupStats(group);
    const memberLookup = {};
    (group.members || []).forEach(m => { memberLookup[m.id] = m.name; });

    let printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up was blocked. Please allow pop-ups to open the print/PDF view.');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Expense Report - ${group.name}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #1F2937; }
          .header { border-bottom: 2px solid #4F46E5; padding-bottom: 12px; margin-bottom: 20px; }
          .title { font-size: 24px; font-weight: bold; margin: 0; color: #111827; }
          .subtitle { color: #6B7280; font-size: 13px; margin-top: 4px; }
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
          .kpi-card { background: #F3F4F6; padding: 12px; border-radius: 8px; }
          .kpi-label { font-size: 11px; font-weight: bold; color: #6B7280; text-transform: uppercase; }
          .kpi-value { font-size: 18px; font-weight: bold; color: #111827; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
          th { background: #4F46E5; color: white; text-align: left; padding: 8px 10px; }
          td { border-bottom: 1px solid #E5E7EB; padding: 8px 10px; }
          tr:nth-child(even) { background: #F9FAFB; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: bold; }
          .badge-owed { background: #FEF2F2; color: #DC2626; }
          .badge-get { background: #ECFDF5; color: #059669; }
          @media print {
            body { padding: 0; }
            button { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div class="header" style="flex:1; border:none; margin:0;">
            <h1 class="title">${group.name}</h1>
            <p class="subtitle">Generated on ${new Date().toLocaleString()} · Currency: ${currency}</p>
          </div>
          <button onclick="window.print()" style="background:#4F46E5;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:bold;">
            🖨️ Print / Save as PDF
          </button>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card"><div class="kpi-label">Total Spend</div><div class="kpi-value">${currency} ${stats.totalSpend.toFixed(2)}</div></div>
          <div class="kpi-card"><div class="kpi-label">Expenses</div><div class="kpi-value">${stats.totalCount}</div></div>
          <div class="kpi-card"><div class="kpi-label">Members</div><div class="kpi-value">${stats.memberCount}</div></div>
          <div class="kpi-card"><div class="kpi-label">Average / Member</div><div class="kpi-value">${currency} ${stats.averagePerPerson.toFixed(2)}</div></div>
        </div>

        <h3>Simplified Settlement Plan</h3>
        <table>
          <thead><tr><th>From</th><th>To</th><th style="text-align:right;">Amount</th></tr></thead>
          <tbody>
            ${debts.length > 0 ? debts.map(d => `<tr><td><strong>${d.fromName}</strong></td><td><strong>${d.toName}</strong></td><td style="text-align:right;">${currency} ${d.amount.toFixed(2)}</td></tr>`).join('') : '<tr><td colspan="3">All debts are settled!</td></tr>'}
          </tbody>
        </table>

        <h3>Detailed Expenses</h3>
        <table>
          <thead><tr><th>Date</th><th>Title</th><th>Category</th><th>Paid By</th><th style="text-align:right;">Amount</th><th>Split Breakdown</th></tr></thead>
          <tbody>
            ${(group.expenses || []).map(e => `
              <tr>
                <td>${e.date}</td>
                <td><strong>${e.title}</strong></td>
                <td>${e.category}</td>
                <td>${memberLookup[e.paidBy] || 'Unknown'}</td>
                <td style="text-align:right;"><strong>${currency} ${Number(e.amount).toFixed(2)}</strong></td>
                <td>${e.splits ? Object.entries(e.splits).map(([mId, amt]) => `${memberLookup[mId] || mId}: ${currency}${Number(amt).toFixed(0)}`).join(', ') : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  },

  /**
   * Export all storage state to JSON Backup
   */
  exportJSONBackup() {
    const jsonStr = window.store.exportJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const filename = `ExpenseTracker_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    this.triggerDownload(blob, filename);
  },

  /**
   * Helper to trigger browser download
   */
  triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

window.ExpenseExporter = ExpenseExporter;
