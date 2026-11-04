/**
 * Dashboard widgets — CRUD + backups
 * Créer, éditer, supprimer widgets ; sauvegardes ; galerie
 * Méthodes : openCreateWidgetModal, renderWidgetPermissionsBuilder, saveWidget, openEditWidgetModal,
 *   checkWidgetMissingTables, updateEditModalSize, setPreviewMode, switchWidgetTab,
 *   loadWidgetBackupsList, restoreWidgetBackup, selectWidgetToAdd, openAddWidgetModal
 * Méthodes ajoutées au prototype Dashboard
 */
import { Dashboard } from '../core.js?v=331';

Object.assign(Dashboard.prototype, {
  // === WIDGET OPERATIONS ===

  async openCreateWidgetModal() {
    document.getElementById('widgetName').value = '';
    document.getElementById('widgetEmoji').value = '📊';
    document.getElementById('widgetEmojiPreview').textContent = '📊';
    this.openModal('createWidgetModal');
  },

  async saveWidget() {
    const name = document.getElementById('widgetName').value.trim();
    const emoji = document.getElementById('widgetEmoji').value.trim();

    if (!name) {
      await this.showAlert('Le nom est requis');
      return;
    }

    try {
      const widget = await this.widgetManager.createWidget({
        name,
        emoji: emoji || '📦',
        description: '',
        category: 'uncategorized',
        dbPermissions: [],
        canSendGlobalNotifications: false,
        canSendTabNotifications: false
      });

      this.closeModal('createWidgetModal');
      this.showNotification('Widget créé', 'success');

      // Ouvrir le modal d'édition avec OpenCode
      await this.openEditWidgetModal(widget.id);
    } catch (err) {
      await this.showAlert('Erreur lors de la création du widget', 'error');
    }
  },

  async openEditWidgetModal(widgetId) {
    // Fermer toute modal ouverte avant d'ouvrir l'édition
    this.closeModal('addWidgetModal');
    this.closeModal('createWidgetModal');

    const widget = this.widgetManager.widgets.find(w => w.id === widgetId);
    if (!widget) {
      await this.widgetManager.loadWidgets();
      const w = this.widgetManager.widgets.find(w => w.id === widgetId);
      if (!w) {
        this.showNotification('Widget introuvable', 'error');
        return;
      }
      this.widgetManager.currentWidget = w;
    } else {
      this.widgetManager.currentWidget = widget;
    }

    // Mettre à jour le header du modal
    document.getElementById('currentWidgetName').textContent = widget.name;
    document.getElementById('currentWidgetDescription').textContent = widget.description || '';
    const emojiEl = document.getElementById('currentWidgetEmoji');
    if (emojiEl) emojiEl.textContent = widget.emoji || '🧩';


    // Preview - inclure instanceId et tabId pour que queryDB() fonctionne
    const tabId = this.currentTab ? this.currentTab.id : '';
    const currentPage = this.getCurrentPage?.(this.currentTab);
    const tabWidgets = (currentPage?.widgets) || this.currentTab?.widgets || [];
    const instance = tabWidgets.find(w => w.widgetId === widgetId);
    const instanceId = instance ? instance.id : '';
    const config = instance ? JSON.stringify(instance.config || {}) : '{}';

    let previewUrl = `/widgets/${widgetId}/index.html`;
    const params = new URLSearchParams();
    if (tabId) params.set('tabId', tabId);
    if (instanceId) params.set('instanceId', instanceId);
    params.set('lang', window.i18n?.getLang?.() || 'en');
    params.set('config', config);
    previewUrl += '?' + params.toString();

    document.getElementById('widgetPreviewFrame').src = previewUrl;

    // Initialiser le mode preview auto
    this.setPreviewMode('auto');

    // Initialiser le panel OpenCode pour ce widget (sessions + historique)
    await this.widgetOpenCodePanel.init(widgetId);

    // Vérifier les tables manquantes
    this.checkWidgetMissingTables(widgetId);

    // Populate widget ID field in settings tab
    this.populateWidgetIdField();
    this.initializeWidgetIdCopyButton();

    // Switch to editor tab
    this.switchWidgetTab('editor');

    this.openModal('editWidgetModal');
  },

  /**
   * Vérifie si le widget a des tables référencées mais absentes de la DB
   */
  async checkWidgetMissingTables(widgetId) {
    try {
      const result = await this.api(`/widgets/${widgetId}/tables/check`);
      if (result && !result.ok && result.missing?.length > 0) {
        const tables = result.missing.join(', ');
        this.showNotification(
          `⚠️ Tables manquantes : ${tables}. Le widget ne fonctionnera pas correctement. Demandez à OpenCode de les recréer.`,
          'error',
          8000
        );
      }
    } catch (err) {
      // Pas critique, on ignore silencieusement
    }
  },

  // Adapter la taille du modal selon les dimensions du widget
  updateEditModalSize(cols, rows) {
    const modal = document.querySelector('.modal-edit-widget');
    if (!modal) return;

    // Widget large (>=16 cols) → modal plus large
    // Widget petit (<= 8 cols) → modal moins large
    if (cols >= 20) {
      modal.style.width = '96vw';
      modal.style.maxWidth = '1800px';
    } else if (cols >= 14) {
      modal.style.width = '95vw';
      modal.style.maxWidth = '1600px';
    } else if (cols <= 6) {
      modal.style.width = '85vw';
      modal.style.maxWidth = '1200px';
    } else {
      modal.style.width = '92vw';
      modal.style.maxWidth = '1400px';
    }

    // Widget très haut → modal plus haut
    if (rows >= 16) {
      modal.style.height = '94vh';
    } else if (rows <= 4) {
      modal.style.height = '75vh';
    } else {
      modal.style.height = '90vh';
    }
  },

  // Mode de preview (auto, phone, tablet)
  setPreviewMode(mode) {
    const viewport = document.getElementById('previewViewport');
    if (!viewport) return;

    // Retirer tous les modes
    viewport.classList.remove('mode-auto', 'mode-phone', 'mode-tablet');
    viewport.classList.add(`mode-${mode}`);

    // Mettre à jour les boutons actifs
    document.querySelectorAll('.preview-action-btn[id^="previewDevice"]').forEach(btn => {
      btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`previewDevice${mode.charAt(0).toUpperCase() + mode.slice(1)}`);
    if (activeBtn) activeBtn.classList.add('active');

    // Mettre à jour le badge de taille
    const badge = document.getElementById('previewSizeBadge');
    if (badge) {
      const labels = { auto: 'Taille réelle', phone: '375×667', tablet: '768px' };
      badge.textContent = labels[mode] || '';
    }
  },

  switchWidgetTab(tabName) {
    console.log('[DEBUG] Switching to tab:', tabName);

    // Update tab buttons
    document.querySelectorAll('.widget-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab contents - hide all first
    document.querySelectorAll('.widget-tab-content').forEach(content => {
      content.style.display = 'none';
      content.classList.remove('active');
    });

    // Show the selected tab
    const selectedTab = document.querySelector(`.widget-tab-content[data-tab="${tabName}"]`);
    if (selectedTab) {
      selectedTab.style.display = 'block';
      selectedTab.classList.add('active');
      console.log('[DEBUG] Activated tab:', tabName);
    } else {
      console.error('[DEBUG] Tab not found:', tabName);
    }

    // Load data for specific tabs
    if (tabName === 'editor') {
      // Historique déjà chargé par widgetOpenCodePanel.init() lors de l'ouverture du modal
    } else if (tabName === 'backups') {
      this.loadWidgetBackupsList();
    } else if (tabName === 'permissions') {
      this.loadWidgetPermissionsEditor();
    } else if (tabName === 'settings') {
      this.loadWidgetSettings();
    }
  },

  async loadWidgetBackupsList() {
    if (!this.widgetManager.currentWidget) return;

    const container = document.getElementById('widgetBackupsList');
    const backups = await this.widgetManager.loadWidgetBackups(this.widgetManager.currentWidget.id);

    if (backups.length === 0) {
      container.innerHTML = '<div class="empty-state">Aucun backup</div>';
      return;
    }

    container.innerHTML = backups.map(backup => `
      <div class="backup-item backup-${backup.source}">
        <div class="backup-info">
          <div class="backup-title">${this.escapeHtml(backup.autoName || 'Backup')}</div>
          <div class="timestamp">${this.formatDate(backup.timestamp)}</div>
          <div class="files">${backup.filesChanged?.length || backup.files?.length || 0} fichier(s)</div>
        </div>
        <div class="backup-actions">
          <button class="btn btn-sm btn-primary" onclick="dashboard.restoreWidgetBackup('${backup.id}')">
            Restaurer
          </button>
        </div>
      </div>
    `).join('');
  },

  async restoreWidgetBackup(backupId) {
    if (!this.widgetManager.currentWidget) return;
    if (!(await this.showConfirm('Restaurer ce backup ? Les modifications non sauvegardées seront perdues.'))) return;

    try {
      await this.widgetManager.restoreWidgetBackup(this.widgetManager.currentWidget.id, backupId);
      // Refresh preview with cache busting
      const frame = document.getElementById('widgetPreviewFrame');
      if (frame) {
        const url = new URL(frame.src);
        url.searchParams.set('_t', Date.now());
        frame.src = url.toString();
      }
      this.showNotification('Backup restauré', 'success');
    } catch (err) {
      await this.showAlert('Erreur lors de la restauration', 'error');
    }
  },

  async selectWidgetToAdd(widgetId) {
    if (!this.currentTab) return;

    try {
      const wasEditing = this.gridEditMode;
      const page = this.getCurrentPage?.(this.currentTab);
      const placedWidgets = page?.widgets || this.currentTab.widgets || [];
      const gridCols = page?.gridConfig?.cols || this.currentTab.gridConfig?.cols || 24;
      const size = { cols: 4, rows: 3 };
      let position = null;
      const bounds = placedWidgets
        .map((w) => w.position)
        .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
      const maxY = bounds.reduce((max, p) => Math.max(max, p.y + p.rows), 0);

      for (let y = 0; y <= maxY && !position; y += 1) {
        for (let x = 0; x <= gridCols - size.cols; x += 1) {
          const overlaps = bounds.some((p) =>
            x < p.x + p.cols && x + size.cols > p.x &&
            y < p.y + p.rows && y + size.rows > p.y
          );
          if (!overlaps) {
            position = { x, y, ...size };
            break;
          }
        }
      }
      position = position || { x: 0, y: maxY, ...size };

      let result;
      const pageId = this.currentPageId;
      if (pageId && this.currentTab.pages?.length > 0) {
        // Ajouter à la page courante
        result = await this.api(`/tabs/${this.currentTab.id}/pages/${pageId}/widgets`, {
          method: 'POST',
          body: JSON.stringify({ widgetId, position, config: {} })
        });
      } else {
        result = await this.widgetManager.addWidgetToTab(this.currentTab.id, widgetId, position, {});
      }

      // Stocker l'ID de l'instance ajoutée pour l'animation unbox
      this._lastAddedInstanceId = result?.id || null;

      // Forcer le re-fetch du tab (sinon selectTab réutilise le cache sans le nouveau widget)
      delete this.currentTab.widgets;
      delete this.currentTab.gridConfig;
      await this.selectTab(this.currentTab);

      this.closeModal('addWidgetModal');
      this.showNotification('Widget ajouté', 'success');

      // Reste en mode édition et amène le nouveau widget dans le champ de vision.
      if (wasEditing) this.enterEditMode();
      if (result?.id) {
        requestAnimationFrame(() => {
          const added = document.querySelector(`[data-instance-id="${result.id}"]`);
          added?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
      }
    } catch (err) {
      await this.showAlert('Erreur lors de l\'ajout du widget', 'error');
    }
  },

  async openAddWidgetModal() {
    await this.widgetManager.loadWidgets();
    this.renderCategoryButtons(); // Générer les boutons de catégories
    // Afficher la dernière catégorie utilisée, ou la première par défaut
    const availableIds = this.categories.filter(c => c.id !== 'trash').map(c => c.id);
    const savedCategory = localStorage.getItem('lastWidgetCategory');
    const firstCategory = (savedCategory && (savedCategory === 'all' || availableIds.includes(savedCategory)))
      ? savedCategory
      : 'all';
    this.widgetManager.renderWidgetsGallery(firstCategory, '');
    this.openModal('addWidgetModal');

    // Bind search input
    const searchInput = document.getElementById('widgetSearchInput');
    if (searchInput) {
      searchInput.value = '';
      searchInput.addEventListener('input', (e) => {
        // Si recherche : affiche tous les widgets (toutes catégories), sinon : catégorie active
        const searchTerm = e.target.value.trim();
        const activeBtn = document.querySelector('.widget-category-btn.active');
        const category = searchTerm ? 'all' : (activeBtn?.dataset.category || 'uncategorized');
        this.widgetManager.renderWidgetsGallery(category, searchTerm);
      });
    }
  },
});
