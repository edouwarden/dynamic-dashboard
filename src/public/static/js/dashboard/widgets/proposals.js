/**
 * Dashboard widgets — propositions de tables OpenCode
 * Approbation et refus des CREATE/ALTER TABLE proposés par OpenCode
 * Méthodes : approveTableProposal, rejectTableProposal
 * Méthodes ajoutées au prototype Dashboard
 */
import { Dashboard } from '../core.js?v=331';

Object.assign(Dashboard.prototype, {
  async approveTableProposal(proposalId, btnEl) {
    if (!this.widgetManager.currentWidget) return;

    const card = btnEl.closest('.proposal-card-inline');
    if (card) {
      card.innerHTML = '<div class="proposal-status pending">⏳ Création en cours...</div>';
    }

    try {
      const res = await this.api(
        `/widgets/${this.widgetManager.currentWidget.id}/tables/proposals/${proposalId}/approve`,
        'POST'
      );

      if (card) {
        card.innerHTML = `<div class="proposal-status accepted">✅ Table <code>${this.escapeHtml(res.table)}</code> ${res.type === 'create' ? 'créée et assignée' : 'modifiée'} avec succès</div>`;
      }

      this.showNotification(`Table "${res.table}" ${res.type === 'create' ? 'créée' : 'modifiée'}`, 'success');

      // Recharger le widget pour mettre à jour les permissions en mémoire
      try {
        const updatedWidget = await this.api(`/widgets/${this.widgetManager.currentWidget.id}`);
        this.widgetManager.currentWidget = updatedWidget;
        // Mettre à jour aussi dans la liste
        const idx = this.widgetManager.widgets.findIndex(w => w.id === updatedWidget.id);
        if (idx !== -1) this.widgetManager.widgets[idx] = updatedWidget;
      } catch (e) {
        console.error('Erreur lors du rechargement du widget:', e);
      }

      // Refresh preview (vider puis recharger pour forcer CSS)
      const previewFrame = document.getElementById('widgetPreviewFrame');
      if (previewFrame && previewFrame.src && previewFrame.src !== 'about:blank') {
        const url = new URL(previewFrame.src);
        url.searchParams.set('_t', Date.now());
        const newSrc = url.toString();
        previewFrame.src = 'about:blank';
        setTimeout(() => { previewFrame.src = newSrc; }, 100);
      }
      this.refreshWidgetIframes(this.widgetManager.currentWidget?.id);
    } catch (error) {
      if (card) {
        card.innerHTML = `<div class="proposal-status rejected">❌ Erreur: ${this.escapeHtml(error.message)}</div>`;
      }
      this.showNotification('Erreur: ' + error.message, 'error');
    }
  },

  async rejectTableProposal(proposalId, btnEl) {
    if (!this.widgetManager.currentWidget) return;

    const card = btnEl.closest('.proposal-card-inline');

    try {
      await this.api(
        `/widgets/${this.widgetManager.currentWidget.id}/tables/proposals/${proposalId}`,
        'DELETE'
      );

      if (card) {
        card.innerHTML = '<div class="proposal-status rejected">🚫 Proposition refusée</div>';
      }

      this.showNotification('Proposition refusée', 'info');
    } catch (error) {
      this.showNotification('Erreur: ' + error.message, 'error');
    }
  },
});
