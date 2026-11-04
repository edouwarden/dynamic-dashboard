// Habit Streak — weekly board read from habit_streaks.

const el = {
  list: document.getElementById('list'),
  rate: document.getElementById('rate'),
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function render(habits) {
  if (!habits.length) {
    el.list.innerHTML = '<div class="empty">No habits seeded.</div>';
    el.rate.textContent = '—';
    return;
  }

  let done = 0;
  let total = 0;

  el.list.innerHTML = habits
    .map((habit) => {
      const mask = String(habit.week_mask || '0000000').padEnd(7, '0').slice(0, 7);
      for (const bit of mask) {
        total += 1;
        if (bit === '1') done += 1;
      }
      const color = habit.color || '#60a5fa';
      const dots = mask
        .split('')
        .map((bit) => `<span class="dot ${bit === '1' ? 'on' : ''}"></span>`)
        .join('');
      return `<div class="habit" style="--habit-color:${color}" title="Best streak: ${Number(habit.best_streak || 0)} days">
        <div class="h-icon">${escapeHtml(habit.icon || '•')}</div>
        <div class="h-name">${escapeHtml(habit.name)}</div>
        ${dots}
        <div class="streak"><b>${Number(habit.streak || 0)}</b>d</div>
      </div>`;
    })
    .join('');

  const pct = total ? Math.round((done / total) * 100) : 0;
  el.rate.textContent = `${pct}% week`;
}

async function load() {
  try {
    const habits = await queryDB({ table: 'habit_streaks', action: 'select' });
    render(habits || []);
  } catch (error) {
    el.list.innerHTML = `<div class="empty">Could not load habits.<br>${escapeHtml(error.message)}</div>`;
  }
}

load();
