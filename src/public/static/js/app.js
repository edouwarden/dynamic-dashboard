/**
 * Dashboard - Point d'entrée JavaScript (ES module)
 *
 * Structure :
 *   managers/notification-manager.js  – NotificationManager
 *   managers/widget-manager.js        – WidgetManager
 *   managers/script-manager.js        – GlobalScriptManager (→ script-manager/)
 *   dashboard/core.js                 – class Dashboard (constructor, init, api)
 *   dashboard/tabs.js                 – loadTabs, renderGrid, GRID EDITOR
 *   dashboard/widgets.js              – → widgets/ (instance-config, crud, style, sessions, permissions, attachments, queue, proposals, settings)
 *   dashboard/tabs-ops.js             – createTab, TAB VARIABLES, deleteTab
 *   dashboard/database.js             – → database/ (backups, tables, permissions, create-table, explorer)
 *   dashboard/ui.js                   – → ui/ (context-menus, emoji, modals-dialogs, categories, events)
 */

import { initI18n } from './i18n.js?v=331';

// Importer les fichiers de méthodes Dashboard (effets de bord : augmentent Dashboard.prototype)
import './dashboard/tabs.js?v=331';
import './dashboard/widgets.js?v=331';
import './dashboard/tabs-ops.js?v=331';
import './dashboard/database.js?v=331';
import './dashboard/ui.js?v=331';
import './dashboard/dashboard-opencode.js?v=331';

import { Dashboard } from './dashboard/core.js?v=331';

// Enregistrement du Service Worker PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[PWA] Service Worker non enregistré:', err);
    });
  });
}

// Initialize when DOM is ready
let dashboard;

function boot() {
  initI18n();
  dashboard = new Dashboard();
  window.dashboard = dashboard;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
