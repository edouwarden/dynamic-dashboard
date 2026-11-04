// Checklist Black Swan — app.js

const TABLE = 'risk_events';

const CATEGORIES = ['systemic', 'geopolitique', 'marche', 'credit', 'energie', 'cyber', 'autre'];
const CAT_LABELS = { systemic: 'Systémique', geopolitique: 'Géopolitique', marche: 'Marché', credit: 'Crédit', energie: 'Énergie', cyber: 'Cyber', autre: 'Autre' };
const IMPACTS = ['low', 'medium', 'high', 'extreme'];
const IMPACT_LABELS = { low: 'Faible', medium: 'Moyen', high: 'Élevé', extreme: 'Extrême' };

// Données par défaut
const DEFAULT_EVENTS = [
  { title: 'Effondrement d\'une grande banque centrale', description: 'Perte de confiance systémique dans la monnaie fiat', probability: 4, impact: 'extreme', category: 'systemic' },
  { title: 'Krach obligataire souverain US', description: 'Défaut ou restructuration de la dette américaine', probability: 3, impact: 'extreme', category: 'credit' },
  { title: 'Hyperinflation zone euro', description: 'Inflation > 50%/mois, désintégration de l\'euro', probability: 5, impact: 'extreme', category: 'systemic' },
  { title: 'Cyberattaque infrastructure financière', description: 'Attaque paralysant SWIFT / systèmes de clearing', probability: 8, impact: 'high', category: 'cyber' },
  { title: 'Guerre nucléaire limitée', description: 'Conflit nucléaire tactique impactant marchés mondiaux', probability: 2, impact: 'extreme', category: 'geopolitique' },
  { title: 'Bulle IA / tech éclatement', description: 'Correction > 70% des valeurs tech, récession profonde', probability: 15, impact: 'high', category: 'marche' },
  { title: 'Choc pétrolier majeur', description: 'Pétrole > 300$/baril suite à conflit au Moyen-Orient', probability: 10, impact: 'high', category: 'energie' },
  { title: 'Dépréciation rapide du dollar', description: 'Perte de statut de monnaie de réserve mondiale', probability: 7, impact: 'extreme', category: 'credit' },
];

let events = [];
let editingId = null;

// === HELPERS ===
function probColor(p) {
  if (p <= 5)  return '#10b981';
  if (p <= 15) return '#f59e0b';
  if (p <= 35) return '#ef4444';
  return '#7c3aed';
}

function sliderBg(p) {
  const c = probColor(p);
  return `linear-gradient(to right, ${c} ${p}%, rgba(0,0,0,0.1) ${p}%)`;
}

function catClass(cat) { return 'cat-' + (CATEGORIES.includes(cat) ? cat : 'autre'); }

// === RENDER ===
function renderSummary() {
  const avg = events.length ? events.reduce((s, e) => s + e.probability, 0) / events.length : 0;
  const high = events.filter(e => e.probability >= 15).length;
  const extreme = events.filter(e => e.impact === 'extreme').length;

  document.getElementById('stat-avg').textContent = avg.toFixed(1) + '%';
  document.getElementById('stat-high').textContent = high;
  document.getElementById('stat-extreme').textContent = extreme + '/' + events.length;
}

function renderList() {
  const list = document.getElementById('bs-list');

  if (!events.length) {
    list.innerHTML = `<div class="empty-state"><span class="big">🦢</span>Aucun événement.<br>Cliquez sur + pour en ajouter.</div>`;
    renderSummary();
    return;
  }

  const sorted = [...events].sort((a, b) => b.probability - a.probability);

  list.innerHTML = sorted.map(ev => `
    <div class="bs-card" data-id="${ev.id}">
      <div class="bs-card-top">
        <div class="bs-card-info">
          <div class="bs-card-title">
            <span class="cat-badge ${catClass(ev.category)}">${CAT_LABELS[ev.category] || ev.category}</span>
            ${escHtml(ev.title)}
          </div>
          ${ev.description ? `<div class="bs-card-desc">${escHtml(ev.description)}</div>` : ''}
        </div>
        <div class="bs-card-actions">
          <button class="btn-icon" onclick="openEdit(${ev.id})" title="Modifier">✏️</button>
          <button class="btn-icon del" onclick="deleteEvent(${ev.id})" title="Supprimer">🗑️</button>
        </div>
      </div>
      <div class="bs-slider-zone">
        <span class="impact-dot impact-${ev.impact}" title="${IMPACT_LABELS[ev.impact] || ev.impact}"></span>
        <input
          type="range" min="0" max="100" step="1"
          value="${ev.probability}"
          class="prob-slider"
          style="background: ${sliderBg(ev.probability)}"
          oninput="onSlider(this, ${ev.id})"
          onchange="saveProb(${ev.id}, this.value)"
        />
        <span class="prob-label" style="color:${probColor(ev.probability)}" id="prob-label-${ev.id}">${ev.probability}%</span>
      </div>
    </div>
  `).join('');

  renderSummary();
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Mise à jour live du slider
function onSlider(input, id) {
  const val = parseInt(input.value);
  input.style.background = sliderBg(val);
  const lbl = document.getElementById('prob-label-' + id);
  if (lbl) { lbl.textContent = val + '%'; lbl.style.color = probColor(val); }
  const ev = events.find(e => e.id === id);
  if (ev) ev.probability = val;
  renderSummary();
}

// Sauvegarde en DB
async function saveProb(id, val) {
  try {
    await queryDB({ table: TABLE, action: 'update', where: { id }, data: { probability: parseInt(val) } });
  } catch (e) { console.error('saveProb error', e); }
}

// === CRUD ===
async function loadEvents() {
  try {
    const rows = await queryDB({ table: TABLE, action: 'select', limit: 200 });
    if (rows.length === 0) {
      // Insérer les données par défaut
      for (const ev of DEFAULT_EVENTS) {
        await queryDB({ table: TABLE, action: 'insert', data: ev });
      }
      const fresh = await queryDB({ table: TABLE, action: 'select', limit: 200 });
      events = fresh;
    } else {
      events = rows;
    }
  } catch (e) {
    console.error('loadEvents error', e);
    events = [];
  }
  renderList();
}

async function deleteEvent(id) {
  if (!confirm('Supprimer cet événement ?')) return;
  try {
    await queryDB({ table: TABLE, action: 'delete', where: { id } });
    events = events.filter(e => e.id !== id);
    renderList();
  } catch (e) { console.error('deleteEvent error', e); }
}

// === MODAL ===
function openAdd() {
  editingId = null;
  document.getElementById('modal-title').textContent = '➕ Nouvel événement';
  document.getElementById('f-title').value = '';
  document.getElementById('f-desc').value = '';
  document.getElementById('f-prob').value = '5';
  document.getElementById('f-prob-display').textContent = '5%';
  document.getElementById('f-impact').value = 'extreme';
  document.getElementById('f-category').value = 'systemic';
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('f-title').focus();
}

function openEdit(id) {
  const ev = events.find(e => e.id === id);
  if (!ev) return;
  editingId = id;
  document.getElementById('modal-title').textContent = '✏️ Modifier l\'événement';
  document.getElementById('f-title').value = ev.title;
  document.getElementById('f-desc').value = ev.description || '';
  document.getElementById('f-prob').value = ev.probability;
  document.getElementById('f-prob-display').textContent = ev.probability + '%';
  document.getElementById('f-impact').value = ev.impact;
  document.getElementById('f-category').value = ev.category;
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  editingId = null;
}

async function saveEvent() {
  const title = document.getElementById('f-title').value.trim();
  if (!title) { document.getElementById('f-title').focus(); return; }

  const data = {
    title,
    description: document.getElementById('f-desc').value.trim(),
    probability: parseInt(document.getElementById('f-prob').value),
    impact: document.getElementById('f-impact').value,
    category: document.getElementById('f-category').value,
  };

  try {
    if (editingId !== null) {
      await queryDB({ table: TABLE, action: 'update', where: { id: editingId }, data });
      const idx = events.findIndex(e => e.id === editingId);
      if (idx !== -1) events[idx] = { ...events[idx], ...data };
    } else {
      const inserted = await queryDB({ table: TABLE, action: 'insert', data });
      // Reload pour récupérer l'id auto-incrémenté
      const fresh = await queryDB({ table: TABLE, action: 'select', limit: 200 });
      events = fresh;
    }
    closeModal();
    renderList();
  } catch (e) { console.error('saveEvent error', e); }
}

// === INIT ===
document.getElementById('widget-root').innerHTML = `
  <div class="bs-header">
    <div class="bs-title"><span class="skull">🦢</span> Black Swan Monitor</div>
    <button class="btn-add" onclick="openAdd()">＋ Ajouter</button>
  </div>

  <div class="bs-summary">
    <div class="risk-chip warn">
      <span class="chip-val" id="stat-avg">—</span>
      Prob. moy.
    </div>
    <div class="risk-chip danger">
      <span class="chip-val" id="stat-high">—</span>
      Risques élevés
    </div>
    <div class="risk-chip ok">
      <span class="chip-val" id="stat-extreme">—</span>
      Impact extrême
    </div>
  </div>

  <div class="bs-list" id="bs-list">
    <div class="empty-state"><span class="big">⏳</span>Chargement…</div>
  </div>

  <!-- MODAL -->
  <div class="modal-overlay" id="modal-overlay" onclick="if(event.target===this)closeModal()">
    <div class="modal">
      <h3 id="modal-title">Nouvel événement</h3>
      <div class="form-group">
        <label>Événement</label>
        <input type="text" id="f-title" placeholder="Ex: Krach obligataire souverain…" maxlength="120" />
      </div>
      <div class="form-group">
        <label>Description (optionnel)</label>
        <textarea id="f-desc" placeholder="Contexte, scénario…" rows="2"></textarea>
      </div>
      <div class="form-group">
        <label>Probabilité — <span id="f-prob-display">5%</span></label>
        <input type="range" id="f-prob" min="0" max="100" step="1" value="5"
          oninput="document.getElementById('f-prob-display').textContent=this.value+'%'"
          style="width:100%; accent-color: var(--color-primary, #3b82f6)" />
      </div>
      <div class="form-group">
        <label>Impact</label>
        <select id="f-impact">
          <option value="low">Faible</option>
          <option value="medium">Moyen</option>
          <option value="high">Élevé</option>
          <option value="extreme" selected>Extrême</option>
        </select>
      </div>
      <div class="form-group">
        <label>Catégorie</label>
        <select id="f-category">
          <option value="systemic">Systémique</option>
          <option value="geopolitique">Géopolitique</option>
          <option value="marche">Marché</option>
          <option value="credit">Crédit</option>
          <option value="energie">Énergie</option>
          <option value="cyber">Cyber</option>
          <option value="autre">Autre</option>
        </select>
      </div>
      <div class="modal-actions">
        <button class="btn-cancel" onclick="closeModal()">Annuler</button>
        <button class="btn-save" onclick="saveEvent()">💾 Sauvegarder</button>
      </div>
    </div>
  </div>
`;

loadEvents();
