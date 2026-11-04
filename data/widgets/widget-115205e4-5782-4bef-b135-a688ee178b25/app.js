// Daily Tracking - stats tracker logic

// ========== STATE ==========
let currentDate = new Date();
let metrics = [];
let stats = [];
let currentMetric = null;

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', init);

async function init() {
  setupDatePicker();
  setupEventListeners();
  await loadMetrics();
  await loadStats();
  render();
}

// ========== DATE MANAGEMENT ==========
function setupDatePicker() {
  const dateInput = document.getElementById('currentDate');
  dateInput.value = formatDate(currentDate);
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
  // Date navigation
  document.getElementById('prevDay').addEventListener('click', () => changeDate(-1));
  document.getElementById('nextDay').addEventListener('click', () => changeDate(1));
  document.getElementById('today').addEventListener('click', goToToday);
  document.getElementById('currentDate').addEventListener('change', (e) => {
    currentDate = new Date(e.target.value + 'T00:00:00');
    loadStats();
    render();
  });

  // Metric modal
  document.getElementById('addMetricBtn').addEventListener('click', () => openMetricModal());
  document.getElementById('closeMetricModal').addEventListener('click', closeMetricModal);
  document.getElementById('cancelMetric').addEventListener('click', closeMetricModal);
  document.getElementById('metricForm').addEventListener('submit', saveMetric);

  // Value modal
  document.getElementById('closeValueModal').addEventListener('click', closeValueModal);
  document.getElementById('cancelValue').addEventListener('click', closeValueModal);
  document.getElementById('valueForm').addEventListener('submit', saveValue);

  // Chart modal
  document.getElementById('closeChartModal').addEventListener('click', closeChartModal);
  document.getElementById('chartPeriod').addEventListener('change', () => {
    if (currentMetric) showChart(currentMetric);
  });
}

function changeDate(days) {
  currentDate.setDate(currentDate.getDate() + days);
  document.getElementById('currentDate').value = formatDate(currentDate);
  loadStats();
  render();
}

function goToToday() {
  currentDate = new Date();
  document.getElementById('currentDate').value = formatDate(currentDate);
  loadStats();
  render();
}

// ========== DATA LOADING ==========
async function loadMetrics() {
  try {
    metrics = await queryDB({
      table: 'metrics',
      action: 'select',
      where: { is_active: 1 },
      orderBy: 'order_index ASC'
    });
  } catch (error) {
    console.error('Error loading metrics:', error);
    metrics = [];
  }
}

async function loadStats() {
  const dateStr = formatDate(currentDate);
  try {
    stats = await queryDB({
      table: 'metric_entries',
      action: 'select',
      where: { date: dateStr }
    });
  } catch (error) {
    console.error('Error loading stats:', error);
    stats = [];
  }
}

// ========== RENDER ==========
function render() {
  const grid = document.getElementById('metricsGrid');

  if (metrics.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <p>Aucune métrique configurée</p>
        <p style="font-size: 0.85rem;">Cliquez sur "+ Métrique" pour commencer</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = metrics.map(metric => {
    const stat = stats.find(s => s.metric_id === metric.id);
    const trend = calculateTrend(metric.id);

    return `
      <div class="metric-card" style="border-color: ${metric.color}">
        <div class="metric-header">
          <div class="metric-title">
            <span class="metric-icon">${metric.icon}</span>
            ${metric.name}
          </div>
          <div class="metric-actions">
            <button class="btn-sm" onclick="showChart(${metric.id})" title="Graphique">📈</button>
            <button class="btn-sm" onclick="editMetric(${metric.id})" title="Modifier">✏️</button>
            <button class="btn-sm" onclick="deleteMetric(${metric.id})" title="Supprimer">🗑️</button>
          </div>
        </div>
        <div class="metric-value" style="color: ${metric.color}" onclick="openValueModal(${metric.id}, ${stat?.id || 'null'})">
          ${stat ? stat.value : '<span class="no-value">--</span>'}
          <span class="metric-unit">${metric.unit}</span>
        </div>
        <div class="metric-footer">
          ${trend.html}
          ${metric.target ? `<span class="metric-target">Obj: ${metric.target} ${metric.unit}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function calculateTrend(metricId) {
  // Get previous value (yesterday or last entry)
  const today = formatDate(currentDate);
  const yesterday = new Date(currentDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDate(yesterday);

  // This would need async, so we'll simplify for now
  return { html: '<span class="metric-trend">--</span>' };
}

// ========== METRIC MODAL ==========
function openMetricModal(metric = null) {
  const modal = document.getElementById('metricModal');
  const title = document.getElementById('metricModalTitle');
  const form = document.getElementById('metricForm');

  if (metric) {
    title.textContent = 'Modifier la métrique';
    document.getElementById('metricId').value = metric.id;
    document.getElementById('metricName').value = metric.name;
    document.getElementById('metricUnit').value = metric.unit;
    document.getElementById('metricIcon').value = metric.icon;
    document.getElementById('metricColor').value = metric.color;
    document.getElementById('metricTarget').value = metric.target || '';
  } else {
    title.textContent = 'Nouvelle métrique';
    form.reset();
    document.getElementById('metricId').value = '';
    document.getElementById('metricColor').value = '#3b82f6';
  }

  modal.classList.add('active');
}

function closeMetricModal() {
  document.getElementById('metricModal').classList.remove('active');
}

async function saveMetric(e) {
  e.preventDefault();

  const id = document.getElementById('metricId').value;
  const data = {
    name: document.getElementById('metricName').value,
    unit: document.getElementById('metricUnit').value,
    icon: document.getElementById('metricIcon').value || '📊',
    color: document.getElementById('metricColor').value,
    target: parseFloat(document.getElementById('metricTarget').value) || null
  };

  try {
    if (id) {
      await queryDB({
        table: 'metrics',
        action: 'update',
        data,
        where: { id: parseInt(id) }
      });
    } else {
      data.order_index = metrics.length;
      await queryDB({
        table: 'metrics',
        action: 'insert',
        data
      });
    }

    await loadMetrics();
    render();
    closeMetricModal();
  } catch (error) {
    alert('Erreur: ' + error.message);
  }
}

async function editMetric(id) {
  const metric = metrics.find(m => m.id === id);
  if (metric) openMetricModal(metric);
}

async function deleteMetric(id) {
  if (!confirm('Supprimer cette métrique et toutes ses données ?')) return;

  try {
    // Delete associated stats first
    await queryDB({
      table: 'metric_entries',
      action: 'delete',
      where: { metric_id: id }
    });

    // Delete metric
    await queryDB({
      table: 'metrics',
      action: 'delete',
      where: { id }
    });

    await loadMetrics();
    await loadStats();
    render();
  } catch (error) {
    alert('Erreur: ' + error.message);
  }
}

// ========== VALUE MODAL ==========
function openValueModal(metricId, statId = null) {
  const metric = metrics.find(m => m.id === metricId);
  if (!metric) return;

  const modal = document.getElementById('valueModal');
  const title = document.getElementById('valueModalTitle');
  const label = document.getElementById('valueLabel');
  const form = document.getElementById('valueForm');

  title.textContent = metric.name;
  label.textContent = `Valeur (${metric.unit})`;

  document.getElementById('valueMetricId').value = metricId;
  document.getElementById('valueStatId').value = statId || '';

  if (statId) {
    const stat = stats.find(s => s.id === statId);
    if (stat) {
      document.getElementById('valueInput').value = stat.value;
      document.getElementById('valueNotes').value = stat.notes || '';
    }
  } else {
    form.reset();
  }

  modal.classList.add('active');
  setTimeout(() => document.getElementById('valueInput').focus(), 100);
}

function closeValueModal() {
  document.getElementById('valueModal').classList.remove('active');
}

async function saveValue(e) {
  e.preventDefault();

  const metricId = parseInt(document.getElementById('valueMetricId').value);
  const statId = document.getElementById('valueStatId').value;
  const data = {
    metric_id: metricId,
    date: formatDate(currentDate),
    value: parseFloat(document.getElementById('valueInput').value),
    notes: document.getElementById('valueNotes').value || null
  };

  try {
    if (statId) {
      await queryDB({
        table: 'metric_entries',
        action: 'update',
        data,
        where: { id: parseInt(statId) }
      });
    } else {
      await queryDB({
        table: 'metric_entries',
        action: 'insert',
        data
      });
    }

    await loadStats();
    render();
    closeValueModal();
  } catch (error) {
    alert('Erreur: ' + error.message);
  }
}

// ========== CHART MODAL ==========
async function showChart(metricId) {
  const metric = metrics.find(m => m.id === metricId);
  if (!metric) return;

  currentMetric = metric;

  const modal = document.getElementById('chartModal');
  const title = document.getElementById('chartModalTitle');

  title.textContent = `${metric.icon} ${metric.name}`;
  modal.classList.add('active');

  await renderChart(metric);
}

function closeChartModal() {
  document.getElementById('chartModal').classList.remove('active');
  currentMetric = null;
}

async function renderChart(metric) {
  const period = parseInt(document.getElementById('chartPeriod').value);

  // Get data for period
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);

  try {
    const data = await queryDB({
      table: 'metric_entries',
      action: 'select',
      where: { metric_id: metric.id },
      orderBy: 'date ASC'
    });

    // Filter by date range
    const filteredData = data.filter(d => {
      const date = new Date(d.date);
      return date >= startDate && date <= endDate;
    });

    drawChart(metric, filteredData);
    displayStats(filteredData, metric);
  } catch (error) {
    console.error('Error loading chart data:', error);
  }
}

function drawChart(metric, data) {
  const canvas = document.getElementById('chartCanvas');
  const ctx = canvas.getContext('2d');

  // Set canvas size
  canvas.width = canvas.offsetWidth;
  canvas.height = 300;

  const width = canvas.width;
  const height = canvas.height;
  const padding = 40;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  if (data.length === 0) {
    ctx.fillStyle = '#9ca3af';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Aucune donnée pour cette période', width / 2, height / 2);
    return;
  }

  // Calculate scales
  const values = data.map(d => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  // Draw axes
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();

  // Draw line chart
  if (data.length > 1) {
    ctx.strokeStyle = metric.color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((point, i) => {
      const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((point.value - minVal) / range) * (height - 2 * padding);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw points
    ctx.fillStyle = metric.color;
    data.forEach((point, i) => {
      const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((point.value - minVal) / range) * (height - 2 * padding);

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });
  }

  // Draw target line if exists
  if (metric.target) {
    const targetY = height - padding - ((metric.target - minVal) / range) * (height - 2 * padding);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding, targetY);
    ctx.lineTo(width - padding, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label
    ctx.fillStyle = '#10b981';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Objectif: ${metric.target}`, width - padding - 5, targetY - 5);
  }

  // Draw labels
  ctx.fillStyle = '#6b7280';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';

  // Min/Max values
  ctx.textAlign = 'right';
  ctx.fillText(maxVal.toFixed(1), padding - 5, padding + 5);
  ctx.fillText(minVal.toFixed(1), padding - 5, height - padding + 5);
}

function displayStats(data, metric) {
  const statsDiv = document.getElementById('chartStats');

  if (data.length === 0) {
    statsDiv.innerHTML = '<p style="text-align: center; color: #9ca3af;">Aucune donnée</p>';
    return;
  }

  const values = data.map(d => d.value);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const latest = values[values.length - 1];
  const first = values[0];
  const change = latest - first;
  const changePercent = first !== 0 ? (change / first * 100) : 0;

  statsDiv.innerHTML = `
    <div class="stat-item">
      <div class="stat-label">Moyenne</div>
      <div class="stat-value">${avg.toFixed(1)} ${metric.unit}</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">Min</div>
      <div class="stat-value">${min.toFixed(1)} ${metric.unit}</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">Max</div>
      <div class="stat-value">${max.toFixed(1)} ${metric.unit}</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">Évolution</div>
      <div class="stat-value" style="color: ${change >= 0 ? '#10b981' : '#ef4444'}">
        ${change >= 0 ? '+' : ''}${change.toFixed(1)} ${metric.unit}
        <div style="font-size: 0.8rem;">(${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}%)</div>
      </div>
    </div>
  `;
}

// Make functions global for onclick handlers
window.openValueModal = openValueModal;
window.editMetric = editMetric;
window.deleteMetric = deleteMetric;
window.showChart = showChart;
