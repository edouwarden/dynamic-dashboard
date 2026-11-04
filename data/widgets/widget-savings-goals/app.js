// Savings Goals — progress toward named targets.

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const el = {
  total: document.getElementById('total'),
  list: document.getElementById('list'),
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
    el.list.innerHTML = '<div class="empty">No savings goals yet.</div>';
    return;
  }

  const saved = rows.reduce((sum, row) => sum + Number(row.saved || 0), 0);
  const target = rows.reduce((sum, row) => sum + Number(row.target || 0), 0);
  el.total.textContent = `${money.format(saved)} / ${money.format(target)}`;

  el.list.innerHTML = rows
    .map((row) => {
      const savedValue = Number(row.saved || 0);
      const targetValue = Number(row.target || 0);
      const pct = targetValue ? Math.min((savedValue / targetValue) * 100, 100) : 0;
      return `<div class="goal" title="${escapeHtml(row.name)}">
        <div class="top">
          <span class="emoji">${escapeHtml(row.icon || '🎯')}</span>
          <span class="name">${escapeHtml(row.name)}</span>
          <span class="pct">${Math.round(pct)}%</span>
        </div>
        <div class="bar"><i style="width:${pct}%;background:${escapeHtml(row.color || '#fbbf24')}"></i></div>
        <div class="amount"><span><b>${money.format(savedValue)}</b> saved</span><span>${money.format(targetValue)}</span></div>
      </div>`;
    })
    .join('');
}

async function load() {
  try {
    const rows = await queryDB({ table: 'savings_goals', action: 'select' });
    render(rows || []);
  } catch (error) {
    el.list.innerHTML = `<div class="empty">Could not load goals.<br>${escapeHtml(error.message)}</div>`;
  }
}

load();
