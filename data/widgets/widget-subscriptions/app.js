// Subscriptions — recurring payments normalized to a monthly total.

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const el = {
  monthly: document.getElementById('monthly'),
  list: document.getElementById('list'),
  count: document.getElementById('count'),
  yearly: document.getElementById('yearly'),
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function monthlyValue(row) {
  const amount = Number(row.amount || 0);
  if (row.cycle === 'yearly') return amount / 12;
  if (row.cycle === 'weekly') return amount * 4.33;
  return amount;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const then = new Date(`${dateStr}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((then - now) / 86_400_000);
}

function nextLabel(dateStr) {
  const days = daysUntil(dateStr);
  if (days == null) return '—';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `in ${days}d`;
}

function render(rows) {
  if (!rows.length) {
    el.list.innerHTML = '<div class="empty">No subscriptions yet.</div>';
    return;
  }

  const active = rows.filter((row) => Number(row.active ?? 1) !== 0);
  const monthly = active.reduce((sum, row) => sum + monthlyValue(row), 0);
  el.monthly.textContent = money.format(monthly);
  el.count.textContent = `${active.length} active`;
  el.yearly.textContent = `${money.format(monthly * 12)} / year`;

  el.list.innerHTML = rows
    .map((row) => `<div class="row" title="${escapeHtml(row.name)} · ${escapeHtml(row.category || '')}">
      <span class="emoji">${escapeHtml(row.icon || '🔁')}</span>
      <span class="meta">
        <span class="name">${escapeHtml(row.name)}</span>
        <span class="next">${nextLabel(row.next_charge)}</span>
      </span>
      <span class="price">${money.format(Number(row.amount || 0))}</span>
    </div>`)
    .join('');
}

async function load() {
  try {
    const rows = await queryDB({ table: 'subscriptions', action: 'select' });
    render(rows || []);
  } catch (error) {
    el.list.innerHTML = `<div class="empty">Could not load subscriptions.<br>${escapeHtml(error.message)}</div>`;
  }
}

load();
