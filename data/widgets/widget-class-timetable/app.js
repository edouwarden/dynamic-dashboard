// Class Timetable — Monday to Friday weekly schedule.

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const el = {
  days: document.getElementById('days'),
  week: document.getElementById('week'),
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function render(rows) {
  const today = new Date();
  const jsDay = today.getDay(); // 0 = Sunday
  const todayIndex = jsDay >= 1 && jsDay <= 5 ? jsDay - 1 : -1;
  el.week.textContent = today.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  el.days.innerHTML = DAY_NAMES.map((name, index) => {
    const dayRows = rows
      .filter((row) => Number(row.day) === index + 1)
      .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
    const content = dayRows.length
      ? dayRows
          .map((row) => `<div class="slot" style="border-left-color:${escapeHtml(row.color || '#c084fc')}" title="${escapeHtml(row.course)} · ${escapeHtml(row.teacher || '')}">
            <div class="time">${escapeHtml(row.start_time)}–${escapeHtml(row.end_time)}</div>
            <div class="course">${escapeHtml(row.course)}</div>
            <div class="room">${escapeHtml(row.room || '')}</div>
          </div>`)
          .join('')
      : '<div class="free">free</div>';
    return `<div class="day ${index === todayIndex ? 'today' : ''}">
      <span class="day-name">${name}</span>
      ${content}
    </div>`;
  }).join('');
}

async function load() {
  try {
    const rows = await queryDB({ table: 'school_classes', action: 'select' });
    render(rows || []);
  } catch (error) {
    el.days.innerHTML = `<div class="empty">Could not load timetable.<br>${escapeHtml(error.message)}</div>`;
  }
}

load();
