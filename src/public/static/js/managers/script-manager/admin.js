/**
 * GlobalScriptManager — permissions, timeline et backups
 * loadPermissions, togglePermAction, loadTimeline, loadBackups/restore/delete
 * Méthodes : loadPermissions, togglePermAction, savePermissions,
 *   loadTimeline, loadBackups, createBackup, restoreBackup, deleteBackup
 * Méthodes ajoutées au prototype GlobalScriptManager
 */
import { GlobalScriptManager } from './core.js?v=331';

Object.assign(GlobalScriptManager.prototype, {
  // === Permissions ===

  async loadPermissions() {
    if (!this.currentScript) return;
    const script = await this.dashboard.api(`/scripts/${this.currentScript.id}`);
    this.currentScript = script;

    const { tables } = await this.dashboard.api(`/scripts/${this.currentScript.id}/tables`).catch(() => ({ tables: [] }));
    const permissions = script.dbPermissions || [];
    const container = document.getElementById('globalScriptPermissionsPanel');
    if (!container) return;

    // Initialiser les permissions en mémoire
    this._pendingPermissions = {};
    permissions.forEach(p => {
      this._pendingPermissions[p.table] = {};
      p.actions.forEach(a => this._pendingPermissions[p.table][a] = true);
    });

    // Auto-approve
    const autoCreate = document.getElementById('globalScriptAutoApproveCreate');
    const autoAlter = document.getElementById('globalScriptAutoApproveAlter');
    if (autoCreate) autoCreate.checked = script.autoApproveCreateTable || false;
    if (autoAlter) autoAlter.checked = script.autoApproveAlterTable || false;

    if (!tables.length) {
      container.innerHTML = `<p style="color:var(--text-secondary);font-size:12px;padding:8px;">Aucune table disponible</p>`;
      return;
    }

    container.innerHTML = tables.map(table => {
      const name = typeof table === 'string' ? table : table.name;
      const perm = this._pendingPermissions[name] || {};
      const actions = ['select', 'insert', 'update', 'delete'];
      return `<div class="script-perm-table ${perm && Object.values(perm).some(v => v) ? 'assigned' : ''}">
        <span class="script-perm-table-name">${this.dashboard.escapeHtml(name)}</span>
        <div class="script-perm-actions">
          ${actions.map(a => `<button class="script-perm-action ${perm[a] ? 'active' : ''}" onclick="dashboard.globalScriptManager.togglePermAction('${name}','${a}',this)">${a}</button>`).join('')}
        </div>
      </div>`;
    }).join('');
  },

  togglePermAction(tableName, action, btn) {
    if (!this._pendingPermissions[tableName]) this._pendingPermissions[tableName] = {};
    const current = this._pendingPermissions[tableName][action];
    this._pendingPermissions[tableName][action] = !current;
    btn.classList.toggle('active', !current);
    // Update assigned class
    const row = btn.closest('.script-perm-table');
    if (row) {
      const hasAny = Object.values(this._pendingPermissions[tableName]).some(v => v);
      row.classList.toggle('assigned', hasAny);
    }
  },

  async savePermissions() {
    if (!this.currentScript) return;
    const permissions = Object.entries(this._pendingPermissions)
      .filter(([, actions]) => Object.values(actions).some(v => v))
      .map(([table, actions]) => ({
        table,
        actions: Object.entries(actions).filter(([, v]) => v).map(([a]) => a)
      }));

    const autoApproveCreateTable = document.getElementById('globalScriptAutoApproveCreate')?.checked || false;
    const autoApproveAlterTable = document.getElementById('globalScriptAutoApproveAlter')?.checked || false;

    await this.dashboard.api(`/scripts/${this.currentScript.id}/permissions`, 'POST', permissions);
    await this.dashboard.api(`/scripts/${this.currentScript.id}`, 'PUT', { autoApproveCreateTable, autoApproveAlterTable });
    this.dashboard.showNotification('Permissions enregistrées', 'success');
  },

  // === Timeline ===

  async loadTimeline() {
    if (!this.currentScript) return;
    const logs = await this.dashboard.api(`/scripts/${this.currentScript.id}/logs?limit=100`).catch(() => []);
    const container = document.getElementById('globalScriptTimeline');
    if (!container) return;

    if (!logs.length) {
      container.innerHTML = `<p style="color:var(--text-secondary);text-align:center;padding:20px;">Aucune exécution</p>`;
      return;
    }

    container.innerHTML = logs.map((log, i) => {
      const entries = Array.isArray(log.logs) ? log.logs : [];
      const date = log.created_at ? new Date(log.created_at).toLocaleString('fr-FR') : '—';
      const triggerIcons = { cron: '⏰', manual: '▶', webhook: '🔗', 'widget-load': '📦' };
      return `<div class="timeline-entry" onclick="this.classList.toggle('expanded')">
        <div class="timeline-dot ${log.status}"></div>
        <div class="timeline-info">
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="timeline-trigger">${triggerIcons[log.trigger_type] || '⚡'} ${log.trigger_type}</span>
            <span class="timeline-duration">${log.duration_ms}ms</span>
            <span style="color:var(--text-muted);font-size:11px;margin-left:auto;">${date}</span>
          </div>
          <div class="timeline-logs">${entries.map(e => `[${e.level}] ${this.dashboard.escapeHtml(e.message)}`).join('\n')}${log.error ? `\n[error] ${this.dashboard.escapeHtml(log.error)}` : ''}</div>
        </div>
      </div>`;
    }).join('');
  },

  // === Backups ===

  async loadBackups() {
    if (!this.currentScript) return;
    const backups = await this.dashboard.api(`/scripts/${this.currentScript.id}/backups`).catch(() => []);
    const container = document.getElementById('globalScriptBackupsList');
    if (!container) return;

    if (!backups.length) {
      container.innerHTML = `<p style="color:var(--text-secondary);text-align:center;padding:20px;">Aucun backup</p>`;
      return;
    }

    container.innerHTML = backups.map(b => `
      <div style="padding:8px;border-bottom:1px solid var(--border-color);font-size:12px;display:flex;align-items:center;gap:8px;">
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this.dashboard.escapeHtml(b.autoName || b.id.slice(0, 8))}</span>
        <button class="btn btn-sm btn-secondary" onclick="dashboard.globalScriptManager.restoreBackup('${b.id}')">⏮️</button>
        <button class="btn btn-sm" onclick="dashboard.globalScriptManager.deleteBackup('${b.id}', this)" style="color:#ef4444;">🗑️</button>
      </div>
    `).join('');
  },

  async createBackup() {
    if (!this.currentScript) return;
    await this.dashboard.api(`/scripts/${this.currentScript.id}/backups`, 'POST');
    await this.loadBackups();
    this.dashboard.showNotification('Backup créé', 'success');
  },

  async restoreBackup(backupId) {
    if (!this.currentScript) return;
    const ok = await this.dashboard.showConfirm('Restaurer ce backup ? Le code actuel sera écrasé.');
    if (!ok) return;
    await this.dashboard.api(`/scripts/${this.currentScript.id}/backups/${backupId}/restore`, 'POST');
    const { code } = await this.dashboard.api(`/scripts/${this.currentScript.id}/code`);
    if (this.monacoEditor) this.monacoEditor.setValue(code || '');
    await this.loadBackups();
    this.dashboard.showNotification('Backup restauré', 'success');
  },

  async deleteBackup(backupId, btn) {
    if (!this.currentScript) return;
    await this.dashboard.api(`/scripts/${this.currentScript.id}/backups/${backupId}`, 'DELETE');
    btn.closest('div[style]').remove();
  },
});
