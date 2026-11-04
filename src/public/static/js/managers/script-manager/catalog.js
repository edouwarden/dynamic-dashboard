/**
 * GlobalScriptManager — chargement et catalogue de scripts
 * loadScripts, renderCatalog, _renderScriptCard, openPanel, closePanel, openEditor
 * Méthodes : loadScripts, renderCatalog, _renderScriptCard, openPanel, closePanel, openEditor
 * Méthodes ajoutées au prototype GlobalScriptManager
 */
import { GlobalScriptManager } from './core.js?v=331';

Object.assign(GlobalScriptManager.prototype, {
  async loadScripts() {
    try {
      this.scripts = await this.dashboard.api('/scripts') || [];
      this.renderCatalog();
      this.renderDayGrid();
    } catch (err) {
      console.error('[Scripts] Erreur chargement:', err);
    }
  },

  renderCatalog() {
    const container = document.getElementById('scriptsCatalog');
    if (!container) return;

    if (!this.scripts.length) {
      container.innerHTML = `<div class="scripts-catalog-empty">
        <span style="font-size:32px">⚡</span>
        <p>Aucun script global</p>
        <button class="btn btn-primary btn-sm" onclick="dashboard.openModal('createScriptModal')">+ Nouveau script</button>
      </div>`;
      return;
    }

    // Grouper par catégorie
    const groups = {};
    for (const s of this.scripts) {
      const cat = s.category || 'Général';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    }

    container.innerHTML = Object.entries(groups).map(([cat, scripts]) => `
      <div class="scripts-catalog-group">
        <div class="scripts-catalog-group-header">${cat}</div>
        <div class="scripts-catalog-cards">
          ${scripts.map(s => this._renderScriptCard(s)).join('')}
        </div>
      </div>
    `).join('');
  },

  _renderScriptCard(s) {
    const dotClass = s.lastStatus === 'success' ? 'success' : s.lastStatus === 'error' ? 'error' : 'idle';
    return `<div class="scripts-catalog-card" draggable="true"
      data-script-id="${s.id}"
      ondragstart="dashboard.globalScriptManager.onCatalogDragStart(event, '${s.id}')">
      <span class="scripts-catalog-drag">⠿</span>
      <span class="scripts-catalog-emoji">${s.emoji || '⚡'}</span>
      <span class="scripts-catalog-name">${this.dashboard.escapeHtml(s.name)}</span>
      <span class="scripts-catalog-dot ${dotClass}" title="${s.lastStatus || 'jamais exécuté'}"></span>
      <div class="scripts-catalog-actions">
        <button type="button" class="btn-icon" onclick="event.stopPropagation(); dashboard.globalScriptManager.copyToClipboard('${s.id}')" title="Copier l'ID">📋</button>
        <button type="button" class="btn-icon" onclick="event.stopPropagation(); dashboard.globalScriptManager.runScriptById('${s.id}')" title="Exécuter">▶</button>
        <button type="button" class="btn-icon" onclick="event.stopPropagation(); dashboard.globalScriptManager.openEditor('${s.id}')" title="Éditer">✏️</button>
      </div>
    </div>`;
  },

  // Ouvre le panel
  openPanel() {
    const panel = document.getElementById('scriptsPanel');
    if (panel) panel.style.display = 'flex';
    this.loadScripts();
  },

  // Ferme le panel
  closePanel() {
    const panel = document.getElementById('scriptsPanel');
    if (panel) panel.style.display = 'none';
  },

  // Ouvrir l'éditeur depuis le panel
  openEditor(scriptId) {
    this.closePanel();
    this.selectScript(scriptId);
  },
});
