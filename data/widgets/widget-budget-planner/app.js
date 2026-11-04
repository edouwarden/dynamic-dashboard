// Budget Planner — category budget vs. actual spend.

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const el = {
  month: document.getElementById('month'),
  spent: document.getElementById('spent'),
  remaining: document.getElementById('remaining'),
  meter: document.getElementById('meter'),
  list: document.getElementById('list'),
  count: document.getElementById('count'),
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function render(rows) {
  if (!rows.length) {
    el.list.innerHTML = '<div class="empty">No budget categories yet.</div>';
    return;
  }

  const totalBudget = rows.reduce((sum, row) => sum + Number(row.budget || 0), 0);
  const totalSpent = rows.reduce((sum, row) => sum + Number(row.spent || 0), 0);
  const remaining = totalBudget - totalSpent;
  const ratio = totalBudget ? Math.min(totalSpent / totalBudget, 1) : 0;

  el.spent.textContent = money.format(totalSpent);
  el.remaining.textContent = money.format(remaining);
  el.remaining.style.color = remaining < 0 ? '#f87171' : '';
  el.meter.style.width = `${Math.round(ratio * 100)}%`;
  el.count.textContent = `${Math.round(ratio * 100)}%`;

  el.list.innerHTML = rows
    .map((row) => {
      const budget = Number(row.budget || 0);
      const spent = Number(row.spent || 0);
      const pct = budget ? Math.min((spent / budget) * 100, 100) : 0;
      const over = spent > budget;
      return `<div class="row ${over ? 'over' : ''}" title="${escapeHtml(row.name)} · ${money.format(spent)} / ${money.format(budget)}">
        <div class="emoji">${escapeHtml(row.icon || '•')}</div>
        <div>
          <div class="name">${escapeHtml(row.name)}</div>
          <div class="bar"><i style="width:${pct}%;background:${escapeHtml(row.color || '#34d399')}"></i></div>
        </div>
        <div class="amount ${over ? 'over' : ''}"><b>${money.format(spent)}</b> / ${money.format(budget)}</div>
      </div>`;
    })
    .join('');
}

function monthLabel() {
  try {
    return new Date().toLocaleDateString(lang, { month: 'long', year: 'numeric' });
  } catch {
    return new Date().toLocaleDateString('en', { month: 'long', year: 'numeric' });
  }
}

async function load() {
  el.month.textContent = monthLabel();
  try {
    const rows = await queryDB({ table: 'budget_categories', action: 'select' });
    render(rows || []);
  } catch (error) {
    el.list.innerHTML = `<div class="empty">Could not load budget.<br>${escapeHtml(error.message)}</div>`;
  }
}

load();
