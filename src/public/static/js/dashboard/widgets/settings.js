/**
 * Dashboard widgets — paramètres et suppression
 * Sauvegarde paramètres globaux du widget, permissions, suppression
 * Méthodes : saveWidgetSettings, saveWidgetPermissions, deleteCurrentWidget
 * Méthodes ajoutées au prototype Dashboard
 */
import { Dashboard } from '../core.js?v=331';

Object.assign(Dashboard.prototype, {
  initializeWidgetIdCopyButton() {
    const copyBtn = document.getElementById('copyWidgetIdBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const widgetIdEl = document.getElementById('editWidgetId');
        const widgetId = widgetIdEl.textContent;
        if (widgetId && widgetId !== '—') {
          try {
            await navigator.clipboard.writeText(widgetId);
            const originalText = widgetIdEl.textContent;
            widgetIdEl.textContent = '✓ Copié!';
            copyBtn.style.backgroundColor = '#dcfce7';
            copyBtn.style.borderColor = '#86efac';
            setTimeout(() => {
              widgetIdEl.textContent = originalText;
              copyBtn.style.backgroundColor = '';
              copyBtn.style.borderColor = '';
            }, 1500);
          } catch (err) {
            console.error('Failed to copy:', err);
          }
        }
      });
    }
  },

  populateWidgetIdField() {
    const widget = this.widgetManager.currentWidget;
    if (widget) {
      document.getElementById('editWidgetId').textContent = widget.id;
    }
  },

  async saveWidgetSettings() {
    if (!this.widgetManager.currentWidget) return;

    const name = document.getElementById('editWidgetName').value.trim();
    const emoji = document.getElementById('editWidgetEmoji').value.trim();
    const description = document.getElementById('editWidgetDescription').value.trim();
    const canSendGlobalNotifications = document.getElementById('editWidgetCanSendGlobalNotifications').checked;
    const canSendTabNotifications = document.getElementById('editWidgetCanSendTabNotifications').checked;

    if (!name) {
      await this.showAlert('Le nom est requis');
      return;
    }

    try {
      await this.widgetManager.updateWidget(this.widgetManager.currentWidget.id, {
        name,
        emoji,
        description,
        canSendGlobalNotifications,
        canSendTabNotifications
      });

      // Update current widget
      this.widgetManager.currentWidget.name = name;
      this.widgetManager.currentWidget.emoji = emoji;
      this.widgetManager.currentWidget.description = description;
      this.widgetManager.currentWidget.canSendGlobalNotifications = canSendGlobalNotifications;
      this.widgetManager.currentWidget.canSendTabNotifications = canSendTabNotifications;

      // Update modal title
      document.getElementById('currentWidgetName').textContent = name;
      document.getElementById('currentWidgetDescription').textContent = description;

      this.showNotification('Paramètres sauvegardés', 'success');
    } catch (err) {
      await this.showAlert('Erreur lors de la sauvegarde', 'error');
    }
  },

  async saveWidgetPermissions() {
    if (!this.widgetManager.currentWidget) return;

    // Les permissions sont déjà sauvegardées automatiquement lors de l'ajout/suppression
    this.showNotification('Permissions à jour', 'success');
  },

  async deleteCurrentWidget() {
    if (!this.widgetManager.currentWidget) return;

    const widget = this.widgetManager.currentWidget;
    if (!(await this.showConfirm(`Supprimer définitivement le widget "${widget.name}" ?\n\nCette action est irréversible et supprimera toutes les instances de ce widget dans vos onglets.`))) {
      return;
    }

    try {
      await this.widgetManager.deleteWidget(widget.id);
      this.closeModal('editWidgetModal');
      this.showNotification('Widget supprimé', 'success');

      // Reload current tab if it contains this widget
      if (this.currentTab) {
        await this.selectTab(this.currentTab);
      }
    } catch (err) {
      await this.showAlert('Erreur lors de la suppression', 'error');
    }
  },
});
