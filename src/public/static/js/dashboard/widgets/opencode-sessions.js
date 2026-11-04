/**
 * Dashboard widgets — sessions OpenCode (wrapper léger)
 * La logique réelle est dans OpenCodePanel (managers/opencode-panel.js)
 * loadWidgetSessions() reste pour la compatibilité avec les appels existants
 */
import { Dashboard } from '../core.js?v=331';

Object.assign(Dashboard.prototype, {
  // Appeler panel.init() depuis l'extérieur (crud.js, etc.)
  async loadWidgetSessions() {
    if (!this.widgetManager.currentWidget) return;
    await this.widgetOpenCodePanel.init(this.widgetManager.currentWidget.id);
  },
});
