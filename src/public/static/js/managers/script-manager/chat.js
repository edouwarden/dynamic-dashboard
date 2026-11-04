/**
 * GlobalScriptManager — logs d'exécution
 * Le chat OpenCode est géré par OpenCodePanel (this.openCodePanel dans core.js)
 * Reste ici : loadLogs, clearLogs
 */
import { GlobalScriptManager } from './core.js?v=331';

Object.assign(GlobalScriptManager.prototype, {
  async loadLogs() {
    if (!this.currentScript) return;
    const logs = await this.dashboard.api(`/scripts/${this.currentScript.id}/logs`).catch(() => []);
    const container = document.getElementById('globalScriptLogsList');
    if (!container) return;

    if (!logs.length) {
      container.innerHTML = `<p style="color:var(--text-secondary);text-align:center;padding:20px;">Aucun log</p>`;
      return;
    }

    container.innerHTML = logs.map(log => {
      const entries    = Array.isArray(log.logs) ? log.logs : [];
      const statusColor = log.status === 'success' ? '#22c55e' : '#ef4444';
      const time       = log.created_at ? new Date(log.created_at).toLocaleString('fr-FR') : '—';
      const triggerIcons = { cron: '⏰', manual: '▶', webhook: '🔗' };
      return `<div class="script-log-entry" style="padding:8px;border-bottom:1px solid var(--border-color);font-size:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="color:${statusColor};font-weight:600;">${log.status === 'success' ? '✓' : '✕'}</span>
          <span style="color:var(--text-muted,#6b7280);">${triggerIcons[log.trigger_type] || '⚡'} ${log.trigger_type}</span>
          <span style="color:var(--text-muted,#6b7280);">${time}</span>
          <span style="color:var(--text-muted,#6b7280);margin-left:auto;">${log.duration_ms}ms</span>
        </div>
        ${entries.map(e => `<div style="font-family:monospace;font-size:11px;color:${e.level === 'error' ? '#ef4444' : e.level === 'warn' ? '#f59e0b' : 'var(--text-secondary)'};">[${e.level}] ${this.dashboard.escapeHtml(e.message)}</div>`).join('')}
        ${log.error ? `<div style="color:#ef4444;font-size:11px;margin-top:2px;">${this.dashboard.escapeHtml(log.error)}</div>` : ''}
      </div>`;
    }).join('');
  },

  async clearLogs() {
    if (!this.currentScript) return;
    await this.dashboard.api(`/scripts/${this.currentScript.id}/logs`, 'DELETE');
    await this.loadLogs();
    await this.loadTimeline();
  },
});
