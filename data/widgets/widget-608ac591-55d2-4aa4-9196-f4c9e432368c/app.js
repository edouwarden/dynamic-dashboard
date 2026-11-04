// ── Routine — app.js ──

const DEFAULT_TASKS = {
  matin: [
    { icon: '⏰', title: 'Se lever' },
    { icon: '🚿', title: 'Douche' },
    { icon: '🦷', title: 'Brosser les dents' },
    { icon: '👗', title: 'S\'habiller' },
    { icon: '☕', title: 'Petit déjeuner' },
    { icon: '💊', title: 'Vitamines / médicaments' },
    { icon: '🧘', title: 'Méditation / respiration' },
    { icon: '📖', title: 'Lecture / apprentissage' },
  ],
  soir: [
    { icon: '🍽️', title: 'Dîner' },
    { icon: '🧹', title: 'Ranger la cuisine' },
    { icon: '📋', title: 'Planifier le lendemain' },
    { icon: '📵', title: 'Arrêter les écrans' },
    { icon: '🛁', title: 'Douche / hygiène' },
    { icon: '📚', title: 'Lecture' },
    { icon: '🌙', title: 'Méditation / relaxation' },
    { icon: '😴', title: 'Aller dormir' },
  ]
};

let TABLE   = 'morning_tasks';
let tasks   = [];
let editMode = false;
let today   = '';

// ── Helpers ──────────────────────────────────────────

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function isCheckedToday(task) {
  return task.last_done_date === today;
}

// ── Mode ─────────────────────────────────────────────

function applyMode(mode) {
  const isSoir = mode === 'soir';
  TABLE = isSoir ? 'evening_tasks' : 'morning_tasks';
  document.getElementById('header-title').textContent = isSoir ? '🌙 Routine Soir' : '☀️ Routine Matin';
  document.getElementById('all-done').textContent     = isSoir
    ? '🎉 Routine complète — Bonne nuit !'
    : '🎉 Routine complète — Bonne journée !';
}

// ── Render ───────────────────────────────────────────

function renderProgress() {
  const total = tasks.length;
  const done  = tasks.filter(isCheckedToday).length;
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100);

  document.getElementById('progress-text').textContent = `${done} / ${total} tâche${total !== 1 ? 's' : ''}`;
  document.getElementById('progress-pct').textContent  = `${pct}%`;

  const fill = document.getElementById('progress-fill');
  fill.style.width = pct + '%';
  fill.classList.toggle('done', pct === 100);

  const allDone = document.getElementById('all-done');
  allDone.classList.toggle('visible', total > 0 && done === total);
}

function renderTasks() {
  const list  = document.getElementById('task-list');
  const empty = document.getElementById('empty-state');

  list.querySelectorAll('.task-item').forEach(el => el.remove());

  if (tasks.length === 0) {
    empty.style.display = 'block';
    renderProgress();
    return;
  }
  empty.style.display = 'none';

  tasks.forEach(task => {
    const checked = isCheckedToday(task);
    const item    = document.createElement('div');
    item.className = 'task-item' + (checked ? ' checked' : '') + (editMode ? ' edit-mode' : '');
    item.dataset.id = task.id;

    if (!editMode) {
      item.addEventListener('click', () => toggleTask(task));
    }

    item.innerHTML = `
      <div class="task-checkbox">${checked ? '✓' : ''}</div>
      <span class="task-icon">${task.icon || '✅'}</span>
      <span class="task-title">${task.title}</span>
      ${editMode ? `<button class="btn-delete" data-id="${task.id}" title="Supprimer">🗑️</button>` : ''}
    `;

    if (editMode) {
      item.querySelector('.btn-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTask(task.id);
      });
    }

    list.appendChild(item);
  });

  renderProgress();
}

// ── Actions ──────────────────────────────────────────

async function toggleTask(task) {
  const wasChecked = isCheckedToday(task);
  const newDate    = wasChecked ? '' : today;

  task.last_done_date = newDate;
  renderTasks();

  try {
    await queryDB({ table: TABLE, action: 'update', where: { id: task.id }, data: { last_done_date: newDate } });
  } catch (err) {
    task.last_done_date = wasChecked ? today : '';
    renderTasks();
    console.error('Erreur toggle:', err);
  }
}

async function deleteTask(id) {
  try {
    await queryDB({ table: TABLE, action: 'delete', where: { id } });
    tasks = tasks.filter(t => t.id !== id);
    renderTasks();
  } catch (err) {
    console.error('Erreur suppression:', err);
  }
}

async function addTask() {
  const iconInput  = document.getElementById('add-icon');
  const titleInput = document.getElementById('add-title');
  const icon  = (iconInput.value.trim() || '✅');
  const title = titleInput.value.trim();
  if (!title) { titleInput.focus(); return; }

  try {
    await queryDB({ table: TABLE, action: 'insert', data: { title, icon, order_index: tasks.length, last_done_date: '' } });
    await loadTasks();
    titleInput.value = '';
    iconInput.value  = '✅';
    titleInput.focus();
  } catch (err) {
    console.error('Erreur ajout:', err);
  }
}

// ── Load & Seed ───────────────────────────────────────

async function loadTasks() {
  try {
    tasks = await queryDB({ table: TABLE, action: 'select', limit: 200 });
    tasks.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    renderTasks();
  } catch (err) {
    console.error('Erreur chargement:', err);
  }
}

async function seedDefaultTasks(mode) {
  const defaults = DEFAULT_TASKS[mode] || DEFAULT_TASKS.matin;
  for (let i = 0; i < defaults.length; i++) {
    const t = defaults[i];
    await queryDB({ table: TABLE, action: 'insert', data: { title: t.title, icon: t.icon, order_index: i, last_done_date: '' } });
  }
}

// ── Edit mode ─────────────────────────────────────────

function toggleEditMode() {
  editMode = !editMode;
  document.getElementById('btn-edit').textContent = editMode ? '✅ Terminer' : '✏️ Éditer';
  document.getElementById('add-form').classList.toggle('visible', editMode);
  renderTasks();
}

// ── Init ──────────────────────────────────────────────

async function init() {
  today = getToday();
  document.getElementById('header-date').textContent = formatDate(today);

  document.getElementById('btn-edit').addEventListener('click', toggleEditMode);
  document.getElementById('btn-add-confirm').addEventListener('click', addTask);
  document.getElementById('add-title').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTask();
  });

  // Config initiale
  const cfg  = await resolveConfig();
  const mode = cfg.mode || 'matin';
  applyMode(mode);

  await loadTasks();
  if (tasks.length === 0) {
    await seedDefaultTasks(mode);
    await loadTasks();
  }

  // Changement de mode via settings
  onConfigChange(async (newCfg, changedKey) => {
    if (changedKey === 'mode') {
      if (editMode) toggleEditMode(); // ferme le mode édition
      applyMode(newCfg.mode);
      await loadTasks();
      if (tasks.length === 0) {
        await seedDefaultTasks(newCfg.mode);
        await loadTasks();
      }
    }
  });
}

init();
