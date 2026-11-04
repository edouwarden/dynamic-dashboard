/**
 * Dashboard widgets — utilitaires queue/iframe/polling
 * La logique SSE et queue est dans OpenCodePanel (managers/opencode-panel.js)
 * Reste ici : refreshWidgetIframes, notification polling, wrappers
 */
import { Dashboard } from '../core.js?v=331';

Object.assign(Dashboard.prototype, {
  // Wrapper pour les appelants externes (backward compat)
  async sendWidgetChatMessage(overrideMessage) {
    await this.widgetOpenCodePanel.send(overrideMessage);
  },

  // Wrapper backward compat pour clearQueue
  clearQueue() {
    this.widgetOpenCodePanel.clearQueue();
  },

  // Wrapper backward compat pour cancelRateLimitRetry
  cancelRateLimitRetry() {
    this.widgetOpenCodePanel.cancelRateLimitRetry();
  },

  // Rafraîchir les iframes d'un widget sur le dashboard principal
  refreshWidgetIframes(widgetId) {
    if (!widgetId) return;
    const iframes = document.querySelectorAll(`.grid-stack-item iframe[src*="${widgetId}"]`);
    iframes.forEach(iframe => {
      if (iframe.src && iframe.src !== 'about:blank') {
        const url = new URL(iframe.src);
        url.searchParams.set('_t', Date.now());
        const newSrc = url.toString();
        iframe.src = 'about:blank';
        setTimeout(() => { iframe.src = newSrc; }, 100);
      }
    });
  },

  // Polling des notifications depuis les scripts globaux
  startNotificationPolling() {
    if (this._notifPolling) clearInterval(this._notifPolling);
    this._notifPolling = setInterval(async () => {
      if (document.hidden) return;
      try {
        const { notifications } = await this.api('/scripts/notifications/pending');
        if (notifications?.length) {
          for (const notif of notifications) {
            this.showNotificationWithTitle(
              notif.title || `${notif.scriptEmoji || '⚡'} ${notif.scriptName}`,
              notif.message,
              notif.type || 'info',
              { duration: notif.duration }
            );
          }
          // Rafraîchir le badge du centre de notifications
          this.notificationCenter.load();
        }
      } catch { /* ignore */ }
    }, 8000);
  },

  stopNotificationPolling() {
    if (this._notifPolling) {
      clearInterval(this._notifPolling);
      this._notifPolling = null;
    }
  },
});
