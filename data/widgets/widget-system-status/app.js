// System Status — service health from system_services.

const el = {
  list: document.getElementById('list'),
  state: document.getElementById('state'),
  ops: document.getElementById('ops'),
  latency: document.getElementById('latency'),
  uptime: document.getElementById('uptime'),
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function render(services) {
  if (!services.length) {
    el.list.innerHTML = '<div class="empty">No services seeded.</div>';
    el.state.textContent = '—';
    return;
  }

  const operational = services.filter((s) => s.status === 'operational').length;
  const degraded = services.length - operational;
  const avgLatency = Math.round(services.reduce((sum, s) => sum + Number(s.latency_ms || 0), 0) / services.length);
  const uptime = services.reduce((sum, s) => sum + Number(s.uptime_pct || 0), 0) / services.length;

  el.ops.textContent = `${operational}/${services.length}`;
  el.latency.textContent = `${avgLatency}ms`;
  el.uptime.textContent = `${uptime.toFixed(2)}%`;
  el.state.textContent = degraded ? `${degraded} degraded` : 'All systems normal';
  el.state.classList.toggle('warn', degraded > 0);

  el.list.innerHTML = services
    .map((service) => {
      const status = service.status === 'operational' ? '' : service.status === 'down' ? 'down' : 'degraded';
      return `<div class="service">
        <span class="dot ${status}"></span>
        <div class="svc"><b>${escapeHtml(service.name)}</b><small>${escapeHtml(service.note || '')}</small></div>
        <span class="lat">${Number(service.latency_ms || 0)}ms</span>
        <span class="up">${Number(service.uptime_pct || 0).toFixed(2)}%</span>
      </div>`;
    })
    .join('');
}

async function load() {
  try {
    const services = await queryDB({ table: 'system_services', action: 'select' });
    render(services || []);
  } catch (error) {
    el.list.innerHTML = `<div class="empty">Could not load services.<br>${escapeHtml(error.message)}</div>`;
  }
}

load();
