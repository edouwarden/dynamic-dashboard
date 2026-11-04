// Focus Timer — local-only pomodoro.

const RING = 2 * Math.PI * 52; // r = 52

const el = {
  time: document.getElementById('time'),
  phase: document.getElementById('phase'),
  progress: document.getElementById('progress'),
  start: document.getElementById('start'),
  reset: document.getElementById('reset'),
  modes: document.getElementById('modes'),
  sessions: document.getElementById('sessions'),
  hint: document.getElementById('hint'),
  ring: document.querySelector('.ring-wrap'),
};

let total = 1500;
let remaining = total;
let running = false;
let timer = null;
let label = 'focus';

const todayKey = () => `focus-sessions-${new Date().toISOString().slice(0, 10)}`;

function readSessions() {
  const raw = Number(localStorage.getItem(todayKey()) || '0');
  return Number.isFinite(raw) ? raw : 0;
}

function writeSessions(value) {
  localStorage.setItem(todayKey(), String(value));
}

function renderSessions() {
  const count = readSessions();
  el.sessions.textContent = `${count} today`;
}

function format(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function render() {
  el.time.textContent = format(remaining);
  el.phase.textContent = label;
  const ratio = total ? remaining / total : 0;
  el.progress.style.strokeDashoffset = String(RING * (1 - ratio));
  el.progress.style.stroke = running ? 'var(--accent)' : ratio < 0.2 ? '#fbbf24' : 'var(--accent)';
  el.start.textContent = running ? 'Pause' : remaining < total ? 'Resume' : 'Start';
  el.start.classList.toggle('paused', !running);
  el.ring.classList.toggle('running', running);
}

function stop() {
  running = false;
  if (timer) clearInterval(timer);
  timer = null;
  render();
}

function complete() {
  stop();
  const count = readSessions() + 1;
  writeSessions(count);
  renderSessions();
  remaining = 0;
  render();
  el.hint.textContent = 'Session complete. Take a breath.';
  el.hint.classList.add('done');
  setTimeout(() => {
    remaining = total;
    el.hint.textContent = 'One block at a time.';
    el.hint.classList.remove('done');
    render();
  }, 2200);
}

function start() {
  if (running) {
    stop();
    return;
  }
  if (remaining <= 0) remaining = total;
  running = true;
  el.hint.textContent = label === 'focus' ? 'Deep work in progress.' : 'Recovery block.';
  el.hint.classList.remove('done');
  render();
  timer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      complete();
      return;
    }
    render();
  }, 1000);
}

function reset() {
  stop();
  remaining = total;
  el.hint.textContent = 'One block at a time.';
  el.hint.classList.remove('done');
  render();
}

el.start.addEventListener('click', start);
el.reset.addEventListener('click', reset);

el.modes.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-seconds]');
  if (!button) return;
  stop();
  total = Number(button.dataset.seconds);
  remaining = total;
  label = button.dataset.label;
  document.querySelectorAll('#modes button').forEach((b) => b.classList.toggle('active', b === button));
  el.hint.textContent = 'One block at a time.';
  el.hint.classList.remove('done');
  render();
});

renderSessions();
render();
