// Grade Tracker — weighted course averages and an overall average.

const el = {
  average: document.getElementById('average'),
  list: document.getElementById('list'),
  credits: document.getElementById('credits'),
  letter: document.getElementById('letter'),
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function letterFor(score) {
  if (score >= 93) return 'A';
  if (score >= 90) return 'A−';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B−';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  return 'C−';
}

function render(rows) {
  if (!rows.length) {
    el.list.innerHTML = '<div class="empty">No grades yet.</div>';
    return;
  }

  const courses = new Map();
  for (const row of rows) {
    if (!courses.has(row.course)) {
      courses.set(row.course, { course: row.course, color: row.color, credits: Number(row.credits || 0), weighted: 0, weight: 0, items: 0 });
    }
    const entry = courses.get(row.course);
    const weight = Number(row.weight || 1);
    entry.weighted += Number(row.grade || 0) * weight;
    entry.weight += weight;
    entry.items += 1;
    entry.credits = Math.max(entry.credits, Number(row.credits || 0));
  }

  const list = [...courses.values()].map((entry) => ({
    ...entry,
    score: entry.weight ? entry.weighted / entry.weight : 0,
  }));

  const totalCredits = list.reduce((sum, entry) => sum + entry.credits, 0);
  const overall = totalCredits
    ? list.reduce((sum, entry) => sum + entry.score * entry.credits, 0) / totalCredits
    : list.reduce((sum, entry) => sum + entry.score, 0) / list.length;

  el.average.textContent = overall.toFixed(1);
  el.letter.textContent = `${letterFor(overall)} average`;
  el.credits.textContent = `${totalCredits} credits · ${list.length} courses`;

  el.list.innerHTML = list
    .map((entry) => `<div class="course" title="${escapeHtml(entry.course)} · ${entry.items} assessments">
      <span class="name">${escapeHtml(entry.course)}</span>
      <span class="val">${entry.score.toFixed(1)}</span>
      <div class="bar"><i style="width:${Math.max(0, Math.min(entry.score, 100))}%;background:${escapeHtml(entry.color || '#c084fc')}"></i></div>
      <div class="course-meta"><span>${entry.credits} credits</span><span>${letterFor(entry.score)}</span></div>
    </div>`)
    .join('');
}

async function load() {
  try {
    const rows = await queryDB({ table: 'school_grades', action: 'select' });
    render(rows || []);
  } catch (error) {
    el.list.innerHTML = `<div class="empty">Could not load grades.<br>${escapeHtml(error.message)}</div>`;
  }
}

load();
