// Net Worth — assets, liabilities and account breakdown.

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const el = {
  net: document.getElementById('net'),
  assets: document.getElementById('assets'),
  liabilities: document.getElementById('liabilities'),
  delta: document.getElementById('delta'),
  assetBar: document.getElementById('assetBar'),
  debtBar: document.getElementById('debtBar'),
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
    el.list.innerHTML = '<div class="empty">No accounts yet.</div>';
    return;
  }

  const assets = rows.filter((row) => row.kind === 'asset').reduce((sum, row) => sum + Number(row.value || 0), 0);
  const liabilities = rows.filter((row) => row.kind === 'liability').reduce((sum, row) => sum + Number(row.value || 0), 0);
  const net = assets - liabilities;
  const total = assets + liabilities || 1;

  el.net.textContent = money.format(net);
  el.assets.textContent = money.format(assets);
  el.liabilities.textContent = money.format(liabilities);
  el.delta.textContent = `${Math.round((assets / total) * 100)}% equity`;
  el.assetBar.style.width = `${(assets / total) * 100}%`;
  el.debtBar.style.width = `${(liabilities / total) * 100}%`;

  el.list.innerHTML = rows
    .map((row) => `<div class="item ${row.kind === 'liability' ? 'liability' : ''}" title="${escapeHtml(row.name)}">
      <span class="ico">${escapeHtml(row.icon || (row.kind === 'liability' ? '📉' : '💵'))}</span>
      <span class="nm">${escapeHtml(row.name)}</span>
      <span class="vl">${row.kind === 'liability' ? '−' : ''}${money.format(Number(row.value || 0))}</span>
    </div>`)
    .join('');
}

async function load() {
  try {
    const rows = await queryDB({ table: 'net_worth_items', action: 'select' });
    render(rows || []);
  } catch (error) {
    el.list.innerHTML = `<div class="empty">Could not load net worth.<br>${escapeHtml(error.message)}</div>`;
  }
}

load();
