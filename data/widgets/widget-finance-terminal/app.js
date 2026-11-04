// Finance Terminal — compact, self-contained market panel.

const CASH = 18420;
const state = {
  watchlist: [],
  positions: [],
  news: [],
  alerts: [],
  view: 'watchlist',
};

const el = {
  kpis: document.getElementById('kpis'),
  table: document.getElementById('table'),
  news: document.getElementById('news'),
  alerts: document.getElementById('alerts'),
  rowMeta: document.getElementById('rowMeta'),
  alertCount: document.getElementById('alertCount'),
  updated: document.getElementById('updated'),
  clock: document.getElementById('clock'),
  marketLabel: document.getElementById('marketLabel'),
  liveDot: document.querySelector('.live-dot'),
};

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

function fmtPrice(value) {
  const n = Number(value);
  const digits = Math.abs(n) >= 1000 ? 2 : Math.abs(n) >= 10 ? 2 : 4;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

function fmtMoney(value) {
  const n = Number(value) || 0;
  return (n >= 0 ? '+' : '-') + money.format(Math.abs(n));
}

function pct(value) {
  const n = Number(value) || 0;
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function sparkline(raw, up) {
  const values = String(raw || '')
    .split(',')
    .map(Number)
    .filter((n) => Number.isFinite(n));
  if (values.length < 2) return '<svg class="spark"></svg>';

  const w = 64;
  const h = 22;
  const pad = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = pad + (index / (values.length - 1)) * (w - pad * 2);
      const y = h - pad - ((value - min) / span) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const color = up ? '#34d399' : '#f87171';
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="${points}" stroke="${color}" />
  </svg>`;
}

function badge(symbol) {
  const value = String(symbol || '?').toUpperCase();
  if (value.startsWith('BTC')) return '₿';
  if (value.startsWith('ETH')) return 'Ξ';
  if (value.startsWith('EUR') || value.endsWith('USD') && value.length <= 6) return '€';
  return value.slice(0, 1);
}

function renderKpis() {
  const totalValue = state.positions.reduce((sum, p) => sum + Number(p.value || 0), 0);
  const totalPnl = state.positions.reduce((sum, p) => sum + Number(p.pnl || 0), 0);
  const dayPnl = state.positions.reduce((sum, p) => {
    const quote = state.watchlist.find((w) => w.symbol === p.symbol);
    return sum + Number(p.value || 0) * (Number(quote?.change_pct || 0) / 100);
  }, 0);
  const net = totalValue + CASH;

  const card = (label, value, hint, tone = '') =>
    `<div class="kpi ${tone}"><span>${label}</span><strong>${value}</strong><em>${hint}</em></div>`;

  el.kpis.innerHTML = [
    card('Net worth', money.format(net), 'positions + cash'),
    card('Day P/L', fmtMoney(dayPnl), 'unrealised today', dayPnl >= 0 ? 'good' : 'bad'),
    card('Total P/L', fmtMoney(totalPnl), 'since entry', totalPnl >= 0 ? 'good' : 'bad'),
    card('Cash', money.format(CASH), 'dry powder'),
  ].join('');
}

function renderWatchlist() {
  if (!state.watchlist.length) {
    el.table.innerHTML = '<div class="empty">No watchlist rows seeded.</div>';
    return;
  }
  el.table.innerHTML = state.watchlist
    .map((w) => {
      const up = Number(w.change_pct) >= 0;
      return `<div class="row">
        <div class="sym">
          <div class="sym-badge">${badge(w.symbol)}</div>
          <div class="sym-text"><b>${w.symbol}</b><small>${w.name}</small></div>
        </div>
        ${sparkline(w.spark, up)}
        <div class="px"><b>${fmtPrice(w.price)}</b><small>Vol ${w.volume || '—'}</small></div>
        <span class="chg ${up ? 'up' : 'down'}">${pct(w.change_pct)}</span>
      </div>`;
    })
    .join('');
  el.rowMeta.textContent = `${state.watchlist.length} symbols`;
}

function renderPositions() {
  if (!state.positions.length) {
    el.table.innerHTML = '<div class="empty">No positions seeded.</div>';
    return;
  }
  el.table.innerHTML = state.positions
    .map((p) => {
      const up = Number(p.pnl) >= 0;
      return `<div class="row pos">
        <div class="sym">
          <div class="sym-badge">${badge(p.symbol)}</div>
          <div class="sym-text"><b>${p.symbol}</b><small>${p.name}</small></div>
        </div>
        <div class="px"><b>${Number(p.quantity)}</b><small>qty</small></div>
        <div class="px"><b>${money.format(Number(p.value))}</b><small>@ ${fmtPrice(p.avg_price)}</small></div>
        <span class="chg ${up ? 'up' : 'down'}">${fmtMoney(p.pnl)}</span>
      </div>`;
    })
    .join('');
  el.rowMeta.textContent = `${state.positions.length} positions`;
}

function ago(iso) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function renderNews() {
  if (!state.news.length) {
    el.news.innerHTML = '<div class="empty">No news seeded.</div>';
    return;
  }
  el.news.innerHTML = state.news
    .map(
      (n) => `<div class="news-item">
        <span class="news-bar ${n.sentiment || 'neutral'}"></span>
        <div class="news-body">
          <p class="news-title">${n.title}</p>
          <div class="news-meta">
            <span class="news-tag">${n.tag || 'Market'}</span>
            <span>·</span>
            <span>${n.source}</span>
            <span>·</span>
            <span>${ago(n.published_at)}</span>
          </div>
        </div>
      </div>`,
    )
    .join('');
}

function renderAlerts() {
  const active = state.alerts.filter((a) => a.status === 'active');
  el.alertCount.textContent = `${active.length} active`;
  if (!state.alerts.length) {
    el.alerts.innerHTML = '<div class="empty">No alerts.</div>';
    return;
  }
  el.alerts.innerHTML = state.alerts
    .map(
      (a) => `<div class="alert-item">
        <span class="alert-sym">${a.symbol}</span>
        <span class="alert-cond">${a.condition === 'above' ? 'above' : 'below'}</span>
        <span class="alert-target">${fmtPrice(a.target)}</span>
      </div>`,
    )
    .join('');
}

function render() {
  renderKpis();
  if (state.view === 'positions') renderPositions();
  else renderWatchlist();
  renderNews();
  renderAlerts();
}

async function load() {
  try {
    const [watchlist, positions, news, alerts] = await Promise.all([
      queryDB({ table: 'finance_watchlist', action: 'select' }),
      queryDB({ table: 'finance_positions', action: 'select' }),
      queryDB({ table: 'finance_news', action: 'select' }),
      queryDB({ table: 'finance_alerts', action: 'select' }),
    ]);
    state.watchlist = watchlist || [];
    state.positions = positions || [];
    state.news = (news || []).slice(0, 8);
    state.alerts = alerts || [];
    el.updated.textContent = `updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    render();
  } catch (error) {
    el.table.innerHTML = `<div class="empty">Could not load demo data.<br>${error.message}</div>`;
  }
}

document.getElementById('viewTabs')?.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-view]');
  if (!button) return;
  state.view = button.dataset.view;
  document.querySelectorAll('#viewTabs button').forEach((b) => b.classList.toggle('active', b === button));
  if (state.view === 'positions') renderPositions();
  else renderWatchlist();
});

function tickClock() {
  const now = new Date();
  el.clock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const hours = now.getUTCHours();
  const weekday = now.getUTCDay();
  const open = weekday >= 1 && weekday <= 5 && hours >= 13 && hours < 21;
  el.marketLabel.textContent = open ? 'US session open' : 'US session closed';
  el.liveDot?.classList.toggle('closed', !open);
}

tickClock();
setInterval(tickClock, 30000);
load();
