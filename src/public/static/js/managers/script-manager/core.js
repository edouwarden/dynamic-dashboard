/**
 * GlobalScriptManager — classe core (constructeur)
 * Les méthodes sont dans les sous-modules via Object.assign(GlobalScriptManager.prototype, {...})
 */
import { OpenCodePanel } from '../opencode-panel.js?v=331';

export class GlobalScriptManager {
  constructor(dashboard) {
    this.dashboard = dashboard;
    this.scripts = [];
    this.currentScript = null;
    this.monacoEditor = null;
    this._pendingPermissions = {}; // { table: { select, insert, update, delete } }

    // Script OpenCode Panel — panel unifié (sessions, SSE, model, thinking)
    this.openCodePanel = new OpenCodePanel('scriptOpenCodePanelMount', {
      apiBaseTemplate: '/api/scripts/:id/opencode',
      panelType: 'script',
      getEntityLabel: () => {
        const s = this.currentScript;
        return s ? { emoji: s.emoji || '⚡', name: s.name || s.id } : null;
      },
      placeholder: 'Demande à OpenCode de modifier le script...',
      emptyStateTitle: 'Modifier le script',
      emptyStateDesc: 'Décris les modifications à apporter et OpenCode s\'en charge.',
      onDone: async (entityId) => {
        // Rafraîchir le code Monaco après réponse OpenCode
        try {
          const { code } = await dashboard.api(`/scripts/${entityId}/code`);
          if (this.monacoEditor && code !== null) {
            this.monacoEditor.setValue(code || '');
          }
        } catch { /* ignore */ }
        if (this.loadTimeline) await this.loadTimeline();
      },
      onApproveProposal: async (proposalId, entityId, cardEl) => {
        try {
          await dashboard.api(`/scripts/${entityId}/tables/proposals/${proposalId}/approve`, 'POST');
          if (cardEl) cardEl.innerHTML = '<div class="proposal-status accepted">✅ Table créée avec succès</div>';
          if (this.loadPermissions) await this.loadPermissions();
          dashboard.showNotification('Table approuvée', 'success');
        } catch (err) {
          if (cardEl) cardEl.innerHTML = `<div class="proposal-status rejected">❌ Erreur : ${err.message}</div>`;
          dashboard.showNotification('Erreur : ' + err.message, 'error');
        }
      },
      onRejectProposal: async (proposalId, entityId) => {
        await dashboard.api(`/scripts/${entityId}/tables/proposals/${proposalId}`, 'DELETE');
      },
    });
  }

  // Copie texte dans le presse-papier (fallback pour HTTP)
  copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => this.dashboard.showAlert('ID copié !', 'success'))
        .catch(() => this._fallbackCopy(text));
    } else {
      this._fallbackCopy(text);
    }
  }

  _fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    this.dashboard.showAlert('ID copié !', 'success');
  }
}
