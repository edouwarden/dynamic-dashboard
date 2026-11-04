/**
 * GlobalScriptManager — actions script et liaison d'événements
 * saveCode, runScript, saveConfig, createScript, deleteScript, bindScriptEditorEvents
 * Méthodes : saveCode, _termLine, runScript, saveConfig,
 *   createScript, deleteScript, hideEditorView, bindScriptEditorEvents
 * Méthodes ajoutées au prototype GlobalScriptManager
 */
import { GlobalScriptManager } from './core.js?v=331';

Object.assign(GlobalScriptManager.prototype, {
  // === Actions ===

  async saveCode() {
    if (!this.currentScript || !this.monacoEditor) return;
    const code = this.monacoEditor.getValue();
    await this.dashboard.api(`/scripts/${this.currentScript.id}/code`, 'PUT', { code });
    this.dashboard.showNotification('Script sauvegardé', 'success');
  },

  _termLine(html) {
    const out = document.getElementById('scriptTerminalOutput');
    if (!out) return;
    const placeholder = out.querySelector('.script-terminal-placeholder');
    if (placeholder) placeholder.remove();
    const div = document.createElement('div');
    div.innerHTML = html;
    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
  },

  async runScript() {
    if (!this.currentScript) return;
    const scriptId = this.currentScript.id;

    // Séparateur avec timestamp
    const now = new Date().toLocaleTimeString('fr-FR');
    this._termLine(`<span class="term-separator">─── Exécution ${now} ───────────────────────────</span>`);

    const runBtn = document.getElementById('globalRunScriptBtn');
    if (runBtn) { runBtn.disabled = true; runBtn.textContent = '⏳'; }

    try {
      const response = await fetch(`/api/scripts/${scriptId}/run`, { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'log') {
              const { level, message, ts } = event.data;
              const time = new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              const msg = this.dashboard.escapeHtml(String(message));
              this._termLine(`<span style="color:#484f58">${time}</span> <span class="term-level-${level}">[${level}]</span> <span class="term-msg">${msg}</span>`);
            } else if (event.type === 'done') {
              const { status, error, duration_ms } = event.data;
              if (status === 'success') {
                this._termLine(`<span class="term-level-info">✓ Terminé en ${duration_ms}ms</span>`);
                this.dashboard.showNotification('Script exécuté', 'success');
              } else {
                this._termLine(`<span class="term-level-error">✗ Erreur: ${this.dashboard.escapeHtml(error || 'inconnue')}</span>`);
                this.dashboard.showNotification(`Erreur: ${error}`, 'error');
              }
              await this.loadTimeline();
              await this.loadScripts();
            } else if (event.type === 'error') {
              this._termLine(`<span class="term-level-error">✗ ${this.dashboard.escapeHtml(String(event.data))}</span>`);
              this.dashboard.showNotification('Erreur: ' + event.data, 'error');
            }
          } catch {}
        }
      }
    } catch (err) {
      this._termLine(`<span class="term-level-error">✗ ${this.dashboard.escapeHtml(err.message)}</span>`);
      this.dashboard.showNotification('Erreur: ' + err.message, 'error');
    } finally {
      if (runBtn) { runBtn.disabled = false; runBtn.textContent = '▶'; }
    }
  },

  async saveConfig() {
    if (!this.currentScript) return;
    const enabled = document.getElementById('globalScriptEnabledToggle')?.checked || false;
    const triggers = this.getTriggersFromUI();
    await this.dashboard.api(`/scripts/${this.currentScript.id}/config`, 'PUT', { enabled, triggers });
    this.dashboard.showNotification('Configuration enregistrée', 'success');
    await this.loadScripts();
  },

  async createScript() {
    const name = document.getElementById('newScriptName')?.value?.trim();
    if (!name) return;
    const emoji = document.getElementById('newScriptEmoji')?.value || '⚡';
    const description = document.getElementById('newScriptDescription')?.value?.trim() || '';

    const script = await this.dashboard.api('/scripts', 'POST', { name, emoji, description });
    this.dashboard.closeModal('createScriptModal');
    document.getElementById('newScriptName').value = '';
    document.getElementById('newScriptDescription').value = '';

    await this.loadScripts();
    await this.selectScript(script.id);
    this.dashboard.showNotification('Script créé', 'success');
  },

  async deleteScript() {
    if (!this.currentScript) return;
    const ok = await this.dashboard.showConfirm(`Supprimer le script "${this.currentScript.name}" ? Cette action est irréversible.`);
    if (!ok) return;
    await this.dashboard.api(`/scripts/${this.currentScript.id}`, 'DELETE');
    this.currentScript = null;
    await this.loadScripts();
    this.hideEditorView();
    this.dashboard.showNotification('Script supprimé', 'success');
  },

  hideEditorView() {
    const editorView = document.getElementById('scriptEditorView');
    const contentArea = document.querySelector('.content-area');
    if (editorView) editorView.style.display = 'none';
    if (contentArea) contentArea.style.display = '';
    document.getElementById('currentTabName').textContent = 'Sélectionner un onglet';
  },

  // === Listeners de l'éditeur ===

  bindScriptEditorEvents() {
    // Éviter les doublons
    if (this._editorEventsBound) return;
    this._editorEventsBound = true;

    this.dashboard.safeAddListener('globalSaveScriptBtn', 'click', () => this.saveCode());
    this.dashboard.safeAddListener('globalRunScriptBtn', 'click', () => this.runScript());
    this.dashboard.safeAddListener('globalDeleteScriptBtn', 'click', () => this.deleteScript());
    this.dashboard.safeAddListener('scriptTerminalClearBtn', 'click', () => {
      const out = document.getElementById('scriptTerminalOutput');
      if (out) out.innerHTML = '<span class="script-terminal-placeholder">Exécutez le script pour voir les logs ici...</span>';
    });
    this.dashboard.safeAddListener('globalSaveScriptConfigBtn', 'click', () => this.saveConfig());
    this.dashboard.safeAddListener('globalSaveScriptPermissionsBtn', 'click', () => this.savePermissions());
    this.dashboard.safeAddListener('globalRefreshScriptLogsBtn', 'click', () => this.loadLogs());
    this.dashboard.safeAddListener('globalClearScriptLogsBtn', 'click', () => this.clearLogs());
    this.dashboard.safeAddListener('globalRefreshScriptTimelineBtn', 'click', () => this.loadTimeline());
    this.dashboard.safeAddListener('globalCreateScriptBackupBtn', 'click', () => this.createBackup());

    // Note : les événements du chat OpenCode (input, send, sessions, historique)
    // sont gérés par OpenCodePanel (this.openCodePanel dans core.js)

    // Sous-onglets
    document.querySelectorAll('#globalScriptSubtabs .script-subtab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activateSubtab(btn.dataset.subtab);
        if (btn.dataset.subtab === 'triggers') this.renderTriggers(this.currentScript?.triggers || []);
        if (btn.dataset.subtab === 'logs') this.loadLogs();
        if (btn.dataset.subtab === 'permissions') this.loadPermissions();
        if (btn.dataset.subtab === 'timeline') this.loadTimeline();
        if (btn.dataset.subtab === 'backups') this.loadBackups();
      });
    });
  },
});
