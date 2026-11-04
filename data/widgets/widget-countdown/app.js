// Countdown — upcoming dates with a hero for the next event.

const el = {
  hero: document.getElementById('hero'),
  list: document.getElementById('list'),
  pill: document.getElementById('pill'),
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function daysUntil(dateStr) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const then = new Date(`${dateStr}T00:00:00`);
  return Math.round((then - now) / 86_400_000);
}

function dateLabel(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function remainingLabel(days) {
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days} days`;
}

function render(rows) {
  if (!rows.length) {
    el.hero.innerHTML = '<div class="empty">No upcoming dates.</div>';
    return;
  }

  const sorted = [...rows].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const next = sorted.find((row) => daysUntil(row.date) >= 0) || sorted[sorted.length - 1];
  const days = daysUntil(next.date);
  const total = Math.max(days, 1);
  const progress = Math.max(6, Math.min(100, 100 - Math.min(days, 100)));

  el.pill.textContent = `${sorted.length} events`;
  el.hero.innerHTML = `<div class="event">
      <span class="emoji">${escapeHtml(next.icon || '⏳')}</span>
      <span class="meta">
        <span class="title">${escapeHtml(next.title)}</span>
        <span class="date">${dateLabel(next.date)}</span>
      </span>
      <span class="big">${days >= 0 ? days : 0}<span>days</span></span>
    </div>
    <div class="bar"><i style="width:${progress}%"></i></div>`;

  el.list.innerHTML = sorted
    .filter((row) => row !== next)
    .slice(0, 4)
    .map((row) => {
      const left = daysUntil(row.date);
      return `<div class="item" title="${escapeHtml(row.title)}">
        <span class="emoji">${escapeHtml(row.icon || '⏳')}</span>
        <span class="nm">${escapeHtml(row.title)}</span>
        <span class="days"><b>${left >= 0 ? left : 0}</b>d</span>
      </div>`;
    })
    .join('');
}

async function load() {
  try {
    const rows = await queryDB({ table: 'countdown_events', action: 'select' });
    render(rows || []);
  } catch (error) {
    el.hero.innerHTML = `<div class="empty">Could not load dates.<br>${escapeHtml(error.message)}</div>`;
  }
}

load();
