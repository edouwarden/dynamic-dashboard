// Assignments — coursework due dates, priority and progress.

const el = {
  week: document.getElementById('week'),
  done: document.getElementById('done'),
  list: document.getElementById('list'),
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const then = new Date(`${dateStr}T00:00:00`);
  return Math.round((then - startOfToday()) / 86_400_000);
}

function dueLabel(dateStr) {
  const days = daysUntil(dateStr);
  if (days == null) return { main: '—', sub: '', cls: '' };
  if (days < 0) return { main: `${Math.abs(days)}d late`, sub: 'Overdue', cls: 'overdue' };
  if (days === 0) return { main: 'Today', sub: 'Due today', cls: 'soon' };
  if (days === 1) return { main: 'Tomorrow', sub: 'Due tomorrow', cls: 'soon' };
  if (days <= 7) return { main: `${days} days`, sub: 'This week', cls: 'soon' };
  return { main: `${days} days`, sub: new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), cls: '' };
}

function statusLabel(status) {
  if (status === 'completed') return 'Completed';
  if (status === 'in_progress') return 'In progress';
  return 'Not started';
}

function render(rows) {
  if (!rows.length) {
    el.list.innerHTML = '<div class="empty">No assignments yet.</div>';
    return;
  }

  const sorted = [...rows].sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
  const week = sorted.filter((row) => {
    const days = daysUntil(row.due_date);
    return row.status !== 'completed' && days != null && days >= 0 && days <= 7;
  }).length;
  const done = sorted.filter((row) => row.status === 'completed').length;
  el.week.textContent = week;
  el.done.textContent = done;

  el.list.innerHTML = sorted
    .map((row) => {
      const due = dueLabel(row.due_date);
      const progress = Math.max(0, Math.min(Number(row.progress || 0), 100));
      return `<div class="task ${row.status === 'completed' ? 'completed' : ''}" title="${escapeHtml(row.course || '')} · ${escapeHtml(row.title)}">
        <div class="prio ${escapeHtml(row.priority || 'low')}"></div>
        <div class="main">
          <div class="course">${escapeHtml(row.course || 'Course')}</div>
          <div class="task-title">${escapeHtml(row.title)}</div>
          <div class="progress"><i style="width:${progress}%"></i></div>
        </div>
        <div class="due ${due.cls}"><b>${due.main}</b><span>${due.sub}</span></div>
        <div class="status ${row.status === 'completed' ? 'done' : ''}">${statusLabel(row.status)}</div>
      </div>`;
    })
    .join('');
}

async function load() {
  try {
    const rows = await queryDB({ table: 'school_assignments', action: 'select' });
    render(rows || []);
  } catch (error) {
    el.list.innerHTML = `<div class="empty">Could not load assignments.<br>${escapeHtml(error.message)}</div>`;
  }
}

load();
