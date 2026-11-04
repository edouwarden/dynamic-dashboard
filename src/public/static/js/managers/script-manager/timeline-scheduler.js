/**
 * GlobalScriptManager — exécution depuis panel et scheduler CRON
 * runScriptById, grille 24h drag-drop, getCronHours, assignScriptToHour
 * Méthodes : runScriptById, renderDayGrid, getScriptsAtHour, getCronHours,
 *   onCatalogDragStart, onTimelineDrop, assignScriptToHour, removeScriptCron
 * Méthodes ajoutées au prototype GlobalScriptManager
 */
import { GlobalScriptManager } from './core.js?v=331';

Object.assign(GlobalScriptManager.prototype, {
  // Exécuter un script directement depuis le panel
  async runScriptById(scriptId) {
    this.dashboard.showNotification('Exécution en cours...', 'info');
    try {
      const result = await this.dashboard.api(`/scripts/${scriptId}/run`, 'POST');
      this.dashboard.showNotification(
        result.status === 'success' ? 'Exécuté avec succès' : 'Erreur d\'exécution',
        result.status === 'success' ? 'success' : 'error'
      );
      await this.loadScripts();
    } catch (err) {
      this.dashboard.showNotification('Erreur: ' + err.message, 'error');
    }
  },

  // === Timeline 24h ===

  renderDayGrid() {
    const container = document.getElementById('scriptsDayGrid');
    if (!container) return;

    container.innerHTML = Array.from({ length: 24 }, (_, hour) => {
      const scripts = this.getScriptsAtHour(hour);
      const hh = String(hour).padStart(2, '0');
      return `<div class="scripts-day-row" data-hour="${hour}"
        ondragover="event.preventDefault(); this.classList.add('drag-over')"
        ondragleave="this.classList.remove('drag-over')"
        ondrop="dashboard.globalScriptManager.onTimelineDrop(event, ${hour}); this.classList.remove('drag-over')">
        <div class="scripts-day-hour">${hh}:00</div>
        <div class="scripts-day-scripts">
          ${scripts.map(s => `<div class="scripts-day-script-chip" title="${this.dashboard.escapeHtml(s.name)}">
            <span>${s.emoji || '⚡'}</span>
            <span class="scripts-day-chip-name">${this.dashboard.escapeHtml(s.name)}</span>
            <button class="scripts-day-chip-remove" onclick="event.stopPropagation(); dashboard.globalScriptManager.removeScriptCron('${s.id}')" title="Retirer">×</button>
          </div>`).join('')}
        </div>
      </div>`;
    }).join('');
  },

  getScriptsAtHour(hour) {
    return this.scripts.filter(s => {
      const cronTrigger = s.triggers?.find(t => t.type === 'cron' && t.enabled && t.cron);
      if (!cronTrigger) return false;
      return this.getCronHours(cronTrigger.cron).includes(hour);
    });
  },

  getCronHours(cronExpr) {
    if (!cronExpr) return [];
    const parts = cronExpr.trim().split(/\s+/);
    if (parts.length < 5) return [];
    const f = parts[1];
    if (f === '*') return Array.from({ length: 24 }, (_, i) => i);
    if (f.startsWith('*/')) {
      const step = parseInt(f.slice(2));
      return Array.from({ length: 24 }, (_, i) => i).filter(i => i % step === 0);
    }
    if (f.includes(',')) return f.split(',').map(Number).filter(n => n >= 0 && n <= 23);
    if (f.includes('-')) {
      const [start, end] = f.split('-').map(Number);
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }
    const n = parseInt(f);
    return isNaN(n) ? [] : [n];
  },

  onCatalogDragStart(event, scriptId) {
    event.dataTransfer.setData('scriptId', scriptId);
    event.dataTransfer.effectAllowed = 'copy';
  },

  async onTimelineDrop(event, hour) {
    const scriptId = event.dataTransfer.getData('scriptId');
    if (!scriptId) return;
    await this.assignScriptToHour(scriptId, hour);
  },

  async assignScriptToHour(scriptId, hour) {
    const script = this.scripts.find(s => s.id === scriptId);
    if (!script) return;

    const triggers = [...(script.triggers || [])];
    const idx = triggers.findIndex(t => t.type === 'cron');
    if (idx >= 0) {
      triggers[idx] = { ...triggers[idx], cron: `0 ${hour} * * *`, enabled: true };
    } else {
      triggers.push({ type: 'cron', enabled: true, cron: `0 ${hour} * * *` });
    }

    await this.dashboard.api(`/scripts/${scriptId}/config`, 'PUT', { enabled: true, triggers });

    // Mise à jour locale
    script.triggers = triggers;
    script.enabled = true;
    this.renderDayGrid();
    this.dashboard.showNotification(`Script planifié à ${String(hour).padStart(2, '0')}:00`, 'success');
  },

  async removeScriptCron(scriptId) {
    const script = this.scripts.find(s => s.id === scriptId);
    if (!script) return;
    const triggers = (script.triggers || []).filter(t => t.type !== 'cron');
    await this.dashboard.api(`/scripts/${scriptId}/config`, 'PUT', { enabled: script.enabled, triggers });
    script.triggers = triggers;
    this.renderDayGrid();
  },
});
