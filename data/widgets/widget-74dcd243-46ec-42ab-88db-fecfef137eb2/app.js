// ── Config ───────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'sentiment_v3';

const SOURCES = [
  { key: 'twitter', label: 'X / Twitter' },
  { key: 'reddit',  label: 'Reddit' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'trends',  label: 'Trends' },
];

// ── Data ─────────────────────────────────────────────────────────────────────
let entries = [];

function load() {
  try { entries = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { entries = []; }
  if (!entries.length) seed();
}

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }

function seed() {
  const now = Date.now();
  entries = [
    { id: now+1, source: 'twitter', score:  4 },
    { id: now+2, source: 'twitter', score:  2 },
    { id: now+3, source: 'reddit',  score:  3 },
    { id: now+4, source: 'reddit',  score: -1 },
    { id: now+5, source: 'youtube', score:  1 },
    { id: now+6, source: 'youtube', score: -2 },
    { id: now+7, source: 'trends',  score:  3 },
    { id: now+8, source: 'trends',  score:  2 },
  ];
  save();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function avg(list) {
  if (!list.length) return null;
  return list.reduce((s, e) => s + e.score, 0) / list.length;
}

// Convert score (-5..+5) to fill percentage (0..100)
function toPercent(score) {
  return ((score + 5) / 10) * 100;
}

function scoreColor(score) {
  if (score === null) return 'rgba(128,128,128,.3)';
  if (score >=  2) return '#22c55e';
  if (score >=  0.5) return '#86efac';
  if (score > -0.5) return '#94a3b8';
  if (score > -2) return '#fca5a5';
  return '#ef4444';
}

function scoreLabel(score) {
  if (score === null) return 'No data';
  if (score >=  2) return 'Positive';
  if (score >=  0.5) return 'Slightly positive';
  if (score > -0.5) return 'Neutral';
  if (score > -2) return 'Slightly negative';
  return 'Negative';
}

function fmt(score) {
  if (score === null) return '—';
  return (score >= 0 ? '+' : '') + score.toFixed(1);
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  // Global
  const globalAvg = avg(entries);
  const globalColor = scoreColor(globalAvg);
  const globalPct = globalAvg !== null ? toPercent(globalAvg) : 50;

  const globalScoreEl = document.getElementById('globalScore');
  const globalFillEl  = document.getElementById('globalFill');
  const globalLabelEl = document.getElementById('globalLabel');

  globalScoreEl.textContent = fmt(globalAvg);
  globalScoreEl.style.color = globalColor;
  globalFillEl.style.width = globalPct + '%';
  globalFillEl.style.background = globalColor;
  globalLabelEl.textContent = scoreLabel(globalAvg);

  // Sources
  const container = document.getElementById('sources');
  container.innerHTML = SOURCES.map(({ key, label }) => {
    const items = entries.filter(e => e.source === key);
    const a = avg(items);
    const color = scoreColor(a);
    const pct = a !== null ? toPercent(a) : 50;
    return `
      <div class="source-row">
        <div class="source-top">
          <span class="source-name">${label}</span>
          <span class="source-score" style="color:${color}">${fmt(a)}</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
      </div>`;
  }).join('');
}

// ── Modal ─────────────────────────────────────────────────────────────────────
const modal   = document.getElementById('modal');
const form    = document.getElementById('sentimentForm');
const slider  = document.getElementById('fScore');
const scoreDisplay = document.getElementById('fScoreVal');

document.getElementById('addBtn').addEventListener('click', () => {
  form.reset();
  slider.value = 0;
  scoreDisplay.textContent = '0';
  modal.classList.remove('hidden');
});

slider.addEventListener('input', () => {
  const v = parseInt(slider.value);
  scoreDisplay.textContent = (v >= 0 ? '+' : '') + v;
});

function closeModal() { modal.classList.add('hidden'); }
document.getElementById('cancelBtn').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

form.addEventListener('submit', e => {
  e.preventDefault();
  entries.push({
    id:     Date.now() + Math.random(),
    source: document.getElementById('fSource').value,
    score:  parseInt(slider.value),
  });
  save();
  render();
  closeModal();
});

// ── Init ──────────────────────────────────────────────────────────────────────
load();
render();
