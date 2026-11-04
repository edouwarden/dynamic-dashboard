/**
 * Dashboard — class core : constructor, init, setupDemoMode,
 * loadConfig, setupPersistenceListener, TAB STATE PERSISTENCE, api()
 * Les méthodes de features sont dans tabs.js, widgets.js, database.js, opencode.js, ui.js
 */
import { NotificationManager } from '../managers/notification-manager.js?v=331';
import { NotificationCenter } from '../managers/notification-center.js?v=331';
import { WidgetManager } from '../managers/widget-manager.js?v=331';
import { GlobalScriptManager } from '../managers/script-manager.js?v=331';
import { OpenCodePanel } from '../managers/opencode-panel.js?v=331';

class Dashboard {
  constructor() {
    this.tabs = [];
    this.currentTab = null;
    this.contextMenuTarget = null;
    this.messagesPollingInterval = null;
    this.categories = this.loadCategories();
    this.notificationManager = new NotificationManager();
    this.notificationCenter = new NotificationCenter(this);
    this.editingTab = null; // Tab en cours d'édition
    this.currentSelectedEmoji = '📄'; // Emoji sélectionné dans le modal

    // Widget-related properties
    this.widgetManager = new WidgetManager(this);
    this.gridEditMode = false;
    this.fullscreenMode = false;
    this.draggingWidget = null;
    this.resizingWidget = null;
    this.widgetPermissions = []; // For creating/editing widgets

    // Style presets
    this.stylePresets = [];

    // Mode confidentialité
    this.privacyMode = localStorage.getItem('privacyMode') === 'true';

    // Mode démo (détecté via variable globale injectée par le serveur)
    this.demoMode = window.DEMO_MODE === true;

    this.globalScriptManager = new GlobalScriptManager(this);

    // Widget OpenCode Panel — panel unifié (sessions, queue, SSE, model, thinking)
    this.widgetOpenCodePanel = new OpenCodePanel('widgetOpenCodePanelMount', {
      apiBaseTemplate: '/api/widgets/:id/opencode',
      panelType: 'widget',
      getEntityLabel: () => {
        const w = this.widgetManager.currentWidget;
        return w ? { emoji: w.emoji || '🧩', name: w.name || w.id } : null;
      },
      placeholder: 'Décris ce que tu veux créer ou modifier...',
      onDone: async (entityId) => {
        // Restaurer les settings protégés si OpenCode a modifié le manifest.json
        const prev = this.widgetManager.currentWidget;
        if (prev && prev.id === entityId) {
          try {
            const current = await this.api(`/widgets/${entityId}`);
            const protectedFields = ['name', 'emoji', 'description', 'category',
              'dbPermissions', 'canSendGlobalNotifications', 'canSendTabNotifications'];
            const restore = {};
            let needsRestore = false;
            for (const field of protectedFields) {
              if (prev[field] !== undefined && JSON.stringify(current[field]) !== JSON.stringify(prev[field])) {
                restore[field] = prev[field];
                needsRestore = true;
              }
            }
            if (needsRestore) {
              await this.widgetManager.updateWidget(entityId, restore);
              console.log('[onDone] Settings restaurés après édition OpenCode:', Object.keys(restore));
            }
            // Garder le configSchema mis à jour par OpenCode mais merger avec les settings protégés
            const merged = await this.api(`/widgets/${entityId}`);
            this.widgetManager.currentWidget = merged;
            const idx = this.widgetManager.widgets.findIndex(w => w.id === entityId);
            if (idx !== -1) this.widgetManager.widgets[idx] = merged;
          } catch (err) {
            console.error('[onDone] Erreur restauration settings:', err);
          }
        }

        this.refreshWidgetIframes(entityId);
        // Refresh aussi la preview iframe dans la modale d'édition
        const frame = document.getElementById('widgetPreviewFrame');
        if (frame?.src && frame.src !== 'about:blank') {
          const url = new URL(frame.src);
          url.searchParams.set('_t', Date.now());
          frame.src = 'about:blank';
          setTimeout(() => { frame.src = url.toString(); }, 100);
        }
      },
      onApproveProposal: async (proposalId, entityId, cardEl) => {
        try {
          const res = await this.api(`/widgets/${entityId}/tables/proposals/${proposalId}/approve`, 'POST');
          if (cardEl) cardEl.innerHTML = `<div class="proposal-status accepted">✅ Table <code>${res.table}</code> ${res.type === 'create' ? 'créée et assignée' : 'modifiée'} avec succès</div>`;
          this.showNotification(`Table "${res.table}" ${res.type === 'create' ? 'créée' : 'modifiée'}`, 'success');
          // Recharger le widget pour mettre à jour les permissions
          try {
            const updated = await this.api(`/widgets/${entityId}`);
            this.widgetManager.currentWidget = updated;
            const idx = this.widgetManager.widgets.findIndex(w => w.id === updated.id);
            if (idx !== -1) this.widgetManager.widgets[idx] = updated;
          } catch { /* ignore */ }
          // Refresh preview
          const frame = document.getElementById('widgetPreviewFrame');
          if (frame?.src && frame.src !== 'about:blank') {
            const url = new URL(frame.src);
            url.searchParams.set('_t', Date.now());
            frame.src = 'about:blank';
            setTimeout(() => { frame.src = url.toString(); }, 100);
          }
          this.refreshWidgetIframes(entityId);
        } catch (err) {
          if (cardEl) cardEl.innerHTML = `<div class="proposal-status rejected">❌ Erreur : ${err.message}</div>`;
          this.showNotification('Erreur : ' + err.message, 'error');
        }
      },
      onRejectProposal: async (proposalId, entityId) => {
        await this.api(`/widgets/${entityId}/tables/proposals/${proposalId}`, 'DELETE');
        this.showNotification('Proposition refusée', 'info');
      },
      onUploadFiles: async (files) => {
        const widgetId = this.widgetManager.currentWidget?.id;
        if (!widgetId) return [];
        return await this.uploadAttachments(widgetId, files);
      },
    });

    // SQL Explorer (database.js)
    this.currentExplorerTable = null;
    this.currentExplorerOffset = 0;
    this.currentExplorerLimit = 50;
    this.currentExplorerData = null;
    this.editingRowId = null;

    // Table schema editing (database.js)
    this.currentEditingTable = null;
    this.columnsToAdd = [];
    this.columnsToDelete = [];

    this.init();
  }

  async init() {
    // Charger tabs + widgets + presets + config + scripts en PARALLÈLE
    const [,,,, ] = await Promise.all([
      this.loadTabs(),
      this.widgetManager.loadWidgets(),
      this.loadStylePresets(),
      this.loadConfig(),
      this.globalScriptManager.loadScripts(),
    ]);

    // Opérations synchrones / localStorage (pas de réseau)
    this.startNotificationPolling();
    this.bindEvents();
    this.setupPersistenceListener();
    this.initDashboardOpenCodePanel();

    // Charger les notifications non lues au démarrage
    this.notificationCenter.load();

    // Mode démo — restrictions UI
    if (this.demoMode) {
      this.setupDemoMode();
    }
  }

  setupDemoMode() {
    // Badge "DÉMO" persistant dans le conteneur du titre (sibling de h1, non effacé par textContent)
    const tabTitleContainer = document.querySelector('.tab-title');
    if (tabTitleContainer && !document.getElementById('demoBadge')) {
      const badge = document.createElement('span');
      badge.textContent = '🎭 DÉMO';
      badge.id = 'demoBadge';
      badge.title = 'Mode démo — onglets isolés, données fictives, widgets réels disponibles';
      badge.style.cssText = 'font-size: 11px; background: var(--accent-color, #f59e0b); color: #000; padding: 3px 10px; border-radius: 10px; margin-left: 8px; font-weight: 700; flex-shrink: 0; cursor: help;';
      tabTitleContainer.appendChild(badge);
    }

    // Bannière démo en haut — affichée une seule fois par session
    if (!document.getElementById('demoBanner') && !sessionStorage.getItem('demoBannerClosed')) {
      const banner = document.createElement('div');
      banner.id = 'demoBanner';
      banner.style.cssText = [
        'position:fixed;top:0;left:0;right:0;z-index:9999',
        'background:linear-gradient(90deg,#f59e0b,#fbbf24)',
        'color:#000;text-align:center;padding:5px 12px',
        'font-size:12px;font-weight:600',
        'display:flex;align-items:center;justify-content:center;gap:10px',
      ].join(';');
      banner.innerHTML = [
        '<span>🎭 Mode Démo</span>',
        '<span style="opacity:0.5">|</span>',
        '<span>Onglets isolés · Données fictives · Toutes les fonctions d\'édition disponibles</span>',
        '<button id="demoBannerClose" style="margin-left:8px;background:none;border:none;cursor:pointer;font-size:14px;line-height:1;padding:0 4px;opacity:0.6" title="Masquer">✕</button>',
      ].join('');
      document.body.insertBefore(banner, document.body.firstChild);
      document.body.style.paddingTop = (parseInt(document.body.style.paddingTop || '0') + 31) + 'px';

      document.getElementById('demoBannerClose').addEventListener('click', () => {
        banner.remove();
        document.body.style.paddingTop = '';
        sessionStorage.setItem('demoBannerClosed', '1');
      });
    }
  }

  async loadConfig() {
    try {
      const config = await this.api('/config');
      this.config = config;
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  }

  // === TAB STATE PERSISTENCE ===

  setupPersistenceListener() {
    // Écouter les messages de persistence depuis les iframes
    window.addEventListener('message', async (event) => {
      // Vérifier que le message vient d'un iframe de notre domaine
      if (event.data && event.data.type === 'tab-state-update') {
        const { tabId, state } = event.data;

        // Sauvegarder l'état au serveur
        try {
          await this.api(`/tabs/${tabId}/state`, {
            method: 'POST',
            body: JSON.stringify(state),
          });
          console.log('[Persistence] State saved for tab', tabId);
        } catch (err) {
          console.error('[Persistence] Failed to save state:', err);
        }
      }

      // Notifications depuis les widgets
      if (event.data && event.data.type === 'widget-notification') {
        const { notification } = event.data;
        this.notificationManager.show({
          title: notification.title,
          message: notification.message,
          type: notification.type || 'widget',
          duration: notification.duration || 5000,
          icon: notification.icon,
          scope: notification.scope || 'global'
        });
      }
    });
  }

  // === API ===

  async api(endpoint, methodOrOptions = {}, body = undefined) {
    // Support both signatures:
    // api(endpoint, options)
    // api(endpoint, method, body)
    let options = {};

    if (typeof methodOrOptions === 'string') {
      // Second param is HTTP method
      options = {
        method: methodOrOptions,
        body: body ? JSON.stringify(body) : undefined
      };
    } else {
      // Second param is options object
      options = methodOrOptions;
    }

    // Mode démo : rediriger les endpoints vers l'API démo
    // /widgets/tabs/* → demo API (gestion widgets dans les onglets démo)
    // /widgets seul → API réelle (CRUD widgets : créer, éditer, galerie)
    let apiPrefix = '/api';
    if (this.demoMode) {
      const demoEndpoints = ['/tabs', '/scripts', '/config', '/widgets/tabs', '/notifications'];
      if (demoEndpoints.some(e => endpoint.startsWith(e))) {
        apiPrefix = '/api/demo';
      }
    }

    const response = await fetch(`${apiPrefix}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Request failed');
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json();
    }
    return response.text();
  }


}

export { Dashboard };
