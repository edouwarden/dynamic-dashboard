/**
 * Dashboard tabs : loadTabs, selectTab, renderGrid, GRID EDITOR, drag-resize, style
 * Méthodes ajoutées au prototype Dashboard
 */
import { Dashboard } from './core.js?v=331';

Object.assign(Dashboard.prototype, {
  // === TABS ===

  calculateResponsiveGridCols(defaultCols) {
    // Calculer le nombre de colonnes en fonction de la largeur de la fenêtre
    const containerWidth = document.getElementById('tabGridContainer')?.offsetWidth || window.innerWidth;
    const sidebarWidth = 280; // largeur approximative de la sidebar
    const availableWidth = Math.max(containerWidth - sidebarWidth - 32, 400); // 32px = padding

    // Définir des breakpoints pour la responsivité
    if (availableWidth < 600) return Math.max(4, Math.floor(availableWidth / 150));
    if (availableWidth < 1000) return Math.max(8, Math.floor(availableWidth / 120));
    if (availableWidth < 1400) return Math.max(12, Math.floor(availableWidth / 110));

    // Pour les écrans larges, utiliser le défaut
    return defaultCols;
  },

  calculateResponsiveRowHeight(defaultRowHeight) {
    // Calculer la hauteur de ligne en fonction de la hauteur disponible
    const container = document.getElementById('tabGridContainer');
    const availableHeight = container?.clientHeight || (window.innerHeight - 80);

    // Adapter la hauteur de ligne pour que tout tienne sans scroll
    // Utiliser la hauteur disponible divisée par un nombre de lignes adaptatif
    // Minimum 40px, maximum au défaut fourni
    const adaptiveHeight = Math.max(40, Math.min(defaultRowHeight, Math.floor((availableHeight - 32) / 5)));
    return adaptiveHeight;
  },

  async loadTabs() {
    try {
      this.tabs = await this.api('/tabs');
      this.renderTabs();

      // Restaurer l'onglet actif depuis le localStorage
      const savedTabId = localStorage.getItem('currentTabId');
      if (savedTabId) {
        const tab = this.tabs.find(t => t.id === savedTabId);
        if (tab) {
          this.selectTab(tab);
          return;
        }
      }

      // Premier lancement : ouvrir le premier onglet au lieu d'un écran vide
      if (this.tabs.length > 0) {
        this.selectTab(this.tabs[0]);
      }
    } catch (err) {
      console.error('Failed to load tabs:', err);
    }
  },

  renderTabs() {
    const list = document.getElementById('tabsList');
    list.innerHTML = '';

    if (this.tabs.length === 0) {
      list.innerHTML = '<li class="empty-state">Aucun onglet</li>';
      return;
    }

    // Event delegation : un seul listener sur le parent (attaché une fois dans _setupTabsDelegation)
    if (!this._tabsDelegationSetup) {
      this._setupTabsDelegation(list);
    }

    const fragment = document.createDocumentFragment();
    this.tabs.forEach(tab => {
      const li = document.createElement('li');
      li.className = `tab-item${this.currentTab?.id === tab.id ? ' active' : ''}`;
      li.dataset.id = tab.id;
      li.draggable = true;

      const emojiSpan = document.createElement('span');
      emojiSpan.className = 'tab-emoji';
      emojiSpan.textContent = tab.emoji || '📄';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'tab-name';
      nameSpan.textContent = tab.name;

      li.appendChild(emojiSpan);
      li.appendChild(nameSpan);
      fragment.appendChild(li);
    });
    list.appendChild(fragment);
  },

  _setupTabsDelegation(list) {
    this._tabsDelegationSetup = true;
    list.addEventListener('click', (e) => {
      const li = e.target.closest('.tab-item');
      if (!li) return;
      const tab = this.tabs.find(t => t.id === li.dataset.id);
      if (tab) this.selectTab(tab);
    });
    list.addEventListener('contextmenu', (e) => {
      const li = e.target.closest('.tab-item');
      if (!li) return;
      const tab = this.tabs.find(t => t.id === li.dataset.id);
      if (tab) this.showContextMenu(e, tab);
    });

    // Drag-and-drop reorder
    let dragSrc = null;

    list.addEventListener('dragstart', (e) => {
      const li = e.target.closest('.tab-item');
      if (!li) return;
      dragSrc = li;
      li.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    list.addEventListener('dragend', (e) => {
      const li = e.target.closest('.tab-item');
      if (li) li.classList.remove('dragging');
      list.querySelectorAll('.tab-item.drag-over').forEach(el => el.classList.remove('drag-over'));
      dragSrc = null;
    });

    list.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const li = e.target.closest('.tab-item');
      if (!li || li === dragSrc) return;
      list.querySelectorAll('.tab-item.drag-over').forEach(el => el.classList.remove('drag-over'));
      li.classList.add('drag-over');
    });

    list.addEventListener('dragleave', (e) => {
      const li = e.target.closest('.tab-item');
      if (li) li.classList.remove('drag-over');
    });

    list.addEventListener('drop', async (e) => {
      e.preventDefault();
      const target = e.target.closest('.tab-item');
      if (!target || !dragSrc || target === dragSrc) return;
      target.classList.remove('drag-over');

      const items = [...list.querySelectorAll('.tab-item')];
      const srcIdx = items.indexOf(dragSrc);
      const tgtIdx = items.indexOf(target);

      // Reorder DOM
      if (srcIdx < tgtIdx) {
        target.after(dragSrc);
      } else {
        target.before(dragSrc);
      }

      // Persist order
      const newOrder = [...list.querySelectorAll('.tab-item')].map(el => el.dataset.id);
      this.tabs.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
      try {
        await this.api('/tabs/order', 'PUT', { tabIds: newOrder });
      } catch (err) {
        console.error('Failed to save tab order:', err);
      }
    });
  },

  async selectTab(tab) {
    // Cache des éléments DOM fréquemment accédés
    const els = this._cachedEls || (this._cachedEls = {
      scriptEditorView: document.getElementById('scriptEditorView'),
      contentArea: document.querySelector('.content-area'),
      tabName: document.getElementById('currentTabName'),
      headerActions: document.getElementById('headerActions'),
      editToolbar: document.getElementById('editToolbar'),
      welcomeScreen: document.getElementById('welcomeScreen'),
      gridContainer: document.getElementById('tabGridContainer'),
      pagesBar: document.getElementById('pagesBar'),
    });

    // Masquer la vue script si visible
    if (els.scriptEditorView) els.scriptEditorView.style.display = 'none';
    if (els.contentArea) els.contentArea.style.display = '';
    if (this.globalScriptManager) {
      this.globalScriptManager.currentScript = null;
    }

    this.currentTab = tab;
    localStorage.setItem('currentTabId', tab.id);

    // Quitter le mode édition si actif
    if (this.gridEditMode) {
      this.gridEditMode = false;
      this.disableGridEditing();
      this.saveAllWidgetPositions();
    }

    // Cacher les notifications de l'onglet précédent
    this.notificationManager.hideTabNotifications();

    // Mettre à jour l'UI (batch DOM writes)
    els.tabName.textContent = tab.name;
    els.headerActions.style.display = 'flex';
    els.editToolbar.style.display = 'none';
    els.welcomeScreen.style.display = 'none';

    // Transition fluide via CSS (non-bloquante)
    const hasOldContent = els.gridContainer && els.gridContainer.querySelector('.grid-container');
    if (hasOldContent) {
      els.gridContainer.style.opacity = '0';
    }

    // Utiliser les données déjà chargées si disponibles (évite un fetch inutile)
    // On re-fetch uniquement si la tab n'a pas ses widgets (données partielles)
    let fullTab = tab;
    if (!tab.widgets && !tab.gridConfig) {
      fullTab = await this.api(`/tabs/${tab.id}`);
    }
    this.currentTab = fullTab;

    // Injecter le currentPageId depuis localStorage pour que renderPages/getCurrentPage
    // utilisent la page sauvegardée localement (pas celle du serveur qui peut être désync)
    const savedPageId = localStorage.getItem(`currentPageId_${fullTab.id}`);
    if (savedPageId && fullTab.pages?.find(p => p.id === savedPageId)) {
      fullTab.currentPageId = savedPageId;
    }

    // Afficher la barre de pages si le tab a des pages
    this.renderPages(fullTab);

    // Trouver la page courante à afficher
    const currentPage = this.getCurrentPage(fullTab);
    this.currentPageId = currentPage?.id || null;

    await this.renderGrid(fullTab, currentPage);
    els.gridContainer.style.opacity = '1';

    // Listener pour adapter les colonnes au resize (sans re-render complet)
    if (this._gridResizeHandler) {
      window.removeEventListener('resize', this._gridResizeHandler);
    }
    let resizeTimeout;
    this._gridResizeHandler = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const baseGridConfig = (this.currentTab?.gridConfig) || { cols: 24, rowHeight: 40, gap: 12 };
        const gridEl = document.querySelector('.grid-container');
        if (gridEl) {
          gridEl.style.gridTemplateColumns = `repeat(${baseGridConfig.cols}, minmax(0, 1fr))`;
        }
      }, 150); // Throttle à 150ms
    };
    window.addEventListener('resize', this._gridResizeHandler);

    this.renderTabs();
  },

  /**
   * Récupérer la page courante d'un tab
   */
  getCurrentPage(tab) {
    if (!tab.pages || tab.pages.length === 0) return null;
    // Chercher la page courante sauvegardée
    const savedPageId = tab.currentPageId || localStorage.getItem(`currentPageId_${tab.id}`);
    if (savedPageId) {
      const page = tab.pages.find(p => p.id === savedPageId);
      if (page) return page;
    }
    // Par défaut, première page
    return tab.pages[0];
  },

  /**
   * Afficher la barre de navigation des pages
   */
  renderPages(tab) {
    const pagesBar = document.getElementById('pagesBar');
    const pagesTabs = document.getElementById('pagesTabs');
    if (!pagesBar || !pagesTabs) return;

    // Masquer si pas de pages ou une seule page
    if (!tab.pages || tab.pages.length <= 1) {
      pagesBar.style.display = 'none';
      return;
    }

    pagesBar.style.display = 'flex';

    // Trier par ordre
    const sortedPages = [...tab.pages].sort((a, b) => a.order - b.order);
    const currentPage = this.getCurrentPage(tab);

    const fragment = document.createDocumentFragment();
    for (const page of sortedPages) {
      const div = document.createElement('div');
      div.className = `page-tab${currentPage?.id === page.id ? ' active' : ''}`;
      div.dataset.pageId = page.id;

      if (page.emoji) {
        const emojiSpan = document.createElement('span');
        emojiSpan.className = 'page-tab-emoji';
        emojiSpan.textContent = page.emoji;
        div.appendChild(emojiSpan);
      }

      const nameSpan = document.createElement('span');
      nameSpan.className = 'page-tab-name';
      nameSpan.textContent = page.name;
      div.appendChild(nameSpan);

      fragment.appendChild(div);
    }

    pagesTabs.innerHTML = '';
    pagesTabs.appendChild(fragment);

    // Event delegation (une seule fois)
    if (!this._pagesDelegationSetup) {
      this._setupPagesDelegation(pagesTabs);
    }
  },

  _setupPagesDelegation(container) {
    this._pagesDelegationSetup = true;

    container.addEventListener('click', (e) => {
      const pageTab = e.target.closest('.page-tab');
      if (!pageTab) return;
      this.selectPage(pageTab.dataset.pageId);
    });

    container.addEventListener('contextmenu', (e) => {
      const pageTab = e.target.closest('.page-tab');
      if (!pageTab) return;
      e.preventDefault();
      this.showPageContextMenu(e, pageTab.dataset.pageId);
    });

    // Double-clic pour renommer
    container.addEventListener('dblclick', (e) => {
      const pageTab = e.target.closest('.page-tab');
      if (!pageTab) return;
      this.renamePageInline(pageTab.dataset.pageId);
    });
  },

  /**
   * Sélectionner une page
   */
  async selectPage(pageId) {
    if (!this.currentTab?.pages) return;

    const page = this.currentTab.pages.find(p => p.id === pageId);
    if (!page) return;

    // Quitter le mode édition si actif
    if (this.gridEditMode) {
      this.gridEditMode = false;
      this.disableGridEditing();
      this.saveAllWidgetPositions();
    }

    this.currentPageId = pageId;
    localStorage.setItem(`currentPageId_${this.currentTab.id}`, pageId);
    // Mettre à jour en mémoire pour que selectTab réutilise la bonne page
    this.currentTab.currentPageId = pageId;

    // Sauvegarder côté serveur
    this.api(`/tabs/${this.currentTab.id}/current-page`, {
      method: 'PUT',
      body: JSON.stringify({ pageId })
    }).catch(err => console.error('Failed to save current page:', err));

    // Transition
    const gridContainer = document.getElementById('tabGridContainer');
    if (gridContainer) gridContainer.style.opacity = '0';

    await this.renderGrid(this.currentTab, page);

    if (gridContainer) gridContainer.style.opacity = '1';

    // Mettre à jour la barre de pages (classe active)
    this.renderPages(this.currentTab);
  },

  /**
   * Menu contextuel pour une page
   */
  showPageContextMenu(event, pageId) {
    // Fermer un menu existant
    this.hidePageContextMenu();

    const page = this.currentTab?.pages?.find(p => p.id === pageId);
    if (!page) return;

    const isOnlyPage = this.currentTab.pages.length <= 1;

    const menu = document.createElement('div');
    menu.className = 'page-context-menu';
    menu.id = 'pageContextMenu';
    menu.innerHTML = `
      <div class="page-context-item" data-action="rename">✏️ Renommer</div>
      <div class="page-context-item" data-action="emoji">😀 Changer l'emoji</div>
      ${!isOnlyPage ? '<div class="page-context-item danger" data-action="delete">🗑️ Supprimer</div>' : ''}
    `;

    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;

    menu.addEventListener('click', async (e) => {
      const item = e.target.closest('.page-context-item');
      if (!item) return;
      const action = item.dataset.action;
      this.hidePageContextMenu();

      if (action === 'rename') {
        this.renamePageInline(pageId);
      } else if (action === 'emoji') {
        const emoji = await this.openEmojiPicker(page.emoji || '');
        if (emoji) {
          await this.api(`/tabs/${this.currentTab.id}/pages/${pageId}`, {
            method: 'PATCH',
            body: JSON.stringify({ emoji })
          });
          page.emoji = emoji;
          this.renderPages(this.currentTab);
        }
      } else if (action === 'delete') {
        if (await this.showConfirm(`Supprimer la page "${page.name}" ?`)) {
          await this.api(`/tabs/${this.currentTab.id}/pages/${pageId}`, { method: 'DELETE' });
          this.currentTab = await this.api(`/tabs/${this.currentTab.id}`);
          const newPage = this.getCurrentPage(this.currentTab);
          this.currentPageId = newPage?.id || null;
          this.renderPages(this.currentTab);
          await this.renderGrid(this.currentTab, newPage);
        }
      }
    });

    document.body.appendChild(menu);

    // Fermer au clic extérieur
    const closeHandler = (e) => {
      if (!menu.contains(e.target)) {
        this.hidePageContextMenu();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  },

  hidePageContextMenu() {
    const menu = document.getElementById('pageContextMenu');
    if (menu) menu.remove();
  },

  /**
   * Renommer une page inline
   */
  renamePageInline(pageId) {
    const page = this.currentTab?.pages?.find(p => p.id === pageId);
    if (!page) return;

    const pageTab = document.querySelector(`.page-tab[data-page-id="${pageId}"]`);
    if (!pageTab) return;

    const nameSpan = pageTab.querySelector('.page-tab-name');
    if (!nameSpan) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = page.name;
    input.style.cssText = 'width: 80px; font-size: 12px; padding: 1px 4px; border: 1px solid var(--color-primary); border-radius: 4px; background: var(--bg-secondary); color: var(--text-primary); outline: none;';

    nameSpan.replaceWith(input);
    input.focus();
    input.select();

    const save = async () => {
      const newName = input.value.trim();
      if (newName && newName !== page.name) {
        await this.api(`/tabs/${this.currentTab.id}/pages/${pageId}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: newName })
        });
        page.name = newName;
      }
      this.renderPages(this.currentTab);
    };

    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') {
        input.value = page.name;
        input.blur();
      }
    });
  },

  async renderGrid(tab, page) {
    const container = document.getElementById('tabGridContainer');
    if (!container) return;

    container.style.display = 'block';

    const style = tab.style || {};
    // Si une page est fournie, utiliser ses widgets/gridConfig
    const baseGridConfig = (page?.gridConfig) || tab.gridConfig || { cols: 24, rowHeight: 40, gap: 12 };
    const gridConfig = {
      ...baseGridConfig,
      // Positions are stored against the tab's own column count. Scaling the
      // column count at runtime creates implicit tracks and breaks the spans.
      cols: baseGridConfig.cols,
      rowHeight: this.calculateResponsiveRowHeight(baseGridConfig.rowHeight)
    };
    const widgets = (page?.widgets) || tab.widgets || [];

    // Appliquer les variables CSS
    this.applyTabStyle(style);

    // Générer le HTML du grid
    container.innerHTML = `
      <div class="grid-container grid-fade-in" style="
        display: grid;
        grid-template-columns: repeat(${gridConfig.cols}, minmax(0, 1fr));
        gap: ${gridConfig.gap}px;
        grid-auto-rows: minmax(${gridConfig.rowHeight}px, auto);
        padding: 16px;
        background: var(--color-bg);
        min-height: 100%;
      ">
        ${widgets.map((inst, idx) => `
          <div class="widget-wrapper widget-enter ${this.gridEditMode ? 'editable' : ''}"
               data-instance-id="${inst.id}"
               data-widget-id="${inst.widgetId}"
               data-tab-id="${tab.id}"
               data-config="${encodeURIComponent(JSON.stringify(inst.config || {}))}"
               data-cols="${inst.position.cols}"
               data-rows="${inst.position.rows}"
               data-x="${inst.position.x}"
               data-y="${inst.position.y}"
               style="
                 grid-column: ${inst.position.x + 1} / span ${inst.position.cols};
                 grid-row: ${inst.position.y + 1} / span ${inst.position.rows};
                 border: var(--border-width) var(--border-style) var(--color-primary);
                 border-radius: var(--border-radius);
                 overflow: hidden;
                 position: relative;
                 background: var(--color-bg);
                 animation-delay: ${idx * 60}ms;
                 opacity: 0;
               "
               class="shadow-${style.shadowStyle || 'medium'}">
            <div class="widget-skeleton"></div>
            <iframe class="widget-iframe"
                    src="/widgets/${inst.widgetId}/index.html?instanceId=${inst.id}&tabId=${tab.id}&lang=${encodeURIComponent(window.i18n?.getLang?.() || 'en')}&config=${encodeURIComponent(JSON.stringify(inst.config || {}))}"
                    loading="lazy"
                    style="width: 100%; height: 100%; border: none; opacity: 0; transition: opacity 0.3s ease;"
                    onload="this.style.opacity='1'; const skel = this.previousElementSibling; if(skel) skel.remove();">
            </iframe>
          </div>
        `).join('')}
      </div>
    `;

    // Animation unbox pour un widget fraîchement ajouté
    if (this._lastAddedInstanceId) {
      const addedWidget = container.querySelector(`[data-instance-id="${this._lastAddedInstanceId}"]`);
      if (addedWidget) {
        addedWidget.classList.remove('widget-enter');
        addedWidget.classList.add('widget-added');
        addedWidget.style.opacity = '1';
        addedWidget.style.animationDelay = '0ms';
        // Nettoyer la classe après l'animation
        setTimeout(() => addedWidget.classList.remove('widget-added'), 1200);
      }
      this._lastAddedInstanceId = null;
    }

    // Si mode édition activé, ajouter les handles
    if (this.gridEditMode) {
      this.enableGridEditing();
    }
  },

  openWidgetFullscreen(instanceId, widgetId, tabId, configJson) {
    // Fermer un précédent overlay si existant
    this.closeWidgetFullscreen(false);

    const src = `/widgets/${widgetId}/index.html?instanceId=${instanceId}&tabId=${tabId}&lang=${encodeURIComponent(window.i18n?.getLang?.() || 'en')}&config=${encodeURIComponent(typeof configJson === 'string' ? configJson : JSON.stringify(configJson))}`;

    const overlay = document.createElement('div');
    overlay.className = 'widget-fullscreen-overlay';
    overlay.id = 'widgetFullscreenOverlay';

    overlay.innerHTML = `
      <div class="widget-fullscreen-modal">
        <iframe src="${src}" allowfullscreen></iframe>
        <button class="widget-fullscreen-close" title="Fermer (Échap)">✕</button>
      </div>
    `;

    // Fermeture via backdrop
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeWidgetFullscreen();
    });

    // Fermeture via bouton close
    overlay.querySelector('.widget-fullscreen-close').addEventListener('click', () => {
      this.closeWidgetFullscreen();
    });

    document.body.appendChild(overlay);

    // Fermeture via Escape
    this._fullscreenEscHandler = (e) => {
      if (e.key === 'Escape') this.closeWidgetFullscreen();
    };
    document.addEventListener('keydown', this._fullscreenEscHandler);

    // Déclencher l'animation
    requestAnimationFrame(() => overlay.classList.add('visible'));
  },

  closeWidgetFullscreen(animate = true) {
    const overlay = document.getElementById('widgetFullscreenOverlay');
    if (!overlay) return;

    if (this._fullscreenEscHandler) {
      document.removeEventListener('keydown', this._fullscreenEscHandler);
      this._fullscreenEscHandler = null;
    }

    if (animate) {
      overlay.classList.remove('visible');
      overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    } else {
      overlay.remove();
    }
  },

  // Mode plein écran : active un overlay cliquable sur chaque widget
  enterFullscreenMode() {
    if (this.gridEditMode) return;
    this.fullscreenMode = true;

    const btn = document.getElementById('fullscreenModeBtn');
    if (btn) btn.classList.add('active');

    // Ajouter un overlay cliquable sur chaque widget
    document.querySelectorAll('.widget-wrapper').forEach(wrapper => {
      const overlay = document.createElement('div');
      overlay.className = 'widget-fs-overlay';
      overlay.title = 'Cliquer pour agrandir';
      overlay.addEventListener('click', () => {
        const instanceId = wrapper.dataset.instanceId;
        const widgetId   = wrapper.dataset.widgetId;
        const tabId      = wrapper.dataset.tabId;
        const config     = decodeURIComponent(wrapper.dataset.config || '{}');
        this.exitFullscreenMode();
        this.openWidgetFullscreen(instanceId, widgetId, tabId, config);
      });
      wrapper.appendChild(overlay);
    });

    // Escape pour annuler
    this._fsModeEscHandler = (e) => {
      if (e.key === 'Escape') this.exitFullscreenMode();
    };
    document.addEventListener('keydown', this._fsModeEscHandler);
  },

  exitFullscreenMode() {
    this.fullscreenMode = false;

    const btn = document.getElementById('fullscreenModeBtn');
    if (btn) btn.classList.remove('active');

    // Retirer les overlays
    document.querySelectorAll('.widget-fs-overlay').forEach(el => el.remove());

    if (this._fsModeEscHandler) {
      document.removeEventListener('keydown', this._fsModeEscHandler);
      this._fsModeEscHandler = null;
    }
  },

  // Helper : parse hex en {r,g,b}
  hexToRgb(hex) {
    const h = hex.replace('#', '');
    return {
      r: parseInt(h.substring(0, 2), 16),
      g: parseInt(h.substring(2, 4), 16),
      b: parseInt(h.substring(4, 6), 16)
    };
  },

  // Helper : mélange deux couleurs (ratio 0→color1, 1→color2)
  mixColors(hex1, hex2, ratio) {
    const c1 = this.hexToRgb(hex1);
    const c2 = this.hexToRgb(hex2);
    const r = Math.round(c1.r + (c2.r - c1.r) * ratio);
    const g = Math.round(c1.g + (c2.g - c1.g) * ratio);
    const b = Math.round(c1.b + (c2.b - c1.b) * ratio);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  },

  applyTabStyle(style) {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', style.colorPrimary || '#3b82f6');
    root.style.setProperty('--color-secondary', style.colorSecondary || '#8b5cf6');
    root.style.setProperty('--color-bg', style.colorBackground || '#ffffff');
    root.style.setProperty('--color-text', style.colorText || '#1f2937');
    root.style.setProperty('--font-family', style.fontFamily || 'Inter, sans-serif');
    root.style.setProperty('--border-radius', style.borderRadius || '8px');
    root.style.setProperty('--border-style', style.borderStyle || 'solid');
    root.style.setProperty('--border-width', style.borderWidth || '1px');

    // Dériver les couleurs sidebar du style tab actif
    const primary = style.colorPrimary || '#3b82f6';
    const secondary = style.colorSecondary || '#8b5cf6';
    const bg = style.colorBackground || '#ffffff';
    const text = style.colorText || '#1f2937';

    // Appliquer le thème au shell (sidebar + header) si activé
    const applyToShell = localStorage.getItem('styleApplyToShell') === 'true';

    if (applyToShell) {
      const sidebarBg = this.mixColors(bg, '#000000', 0.85);
      const sidebarBgHover = this.mixColors(bg, '#000000', 0.75);
      const {r: pr, g: pg, b: pb} = this.hexToRgb(primary);

      root.style.setProperty('--sidebar-bg', sidebarBg);
      root.style.setProperty('--sidebar-bg-hover', sidebarBgHover);
      root.style.setProperty('--sidebar-border', `rgba(${pr}, ${pg}, ${pb}, 0.15)`);
      root.style.setProperty('--sidebar-text', this.mixColors(text, bg, 0.5));
      root.style.setProperty('--sidebar-text-muted', this.mixColors(text, bg, 0.7));
      root.style.setProperty('--sidebar-accent', `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`);
      root.style.setProperty('--sidebar-accent-color', primary);
      root.style.setProperty('--sidebar-accent-shadow', `rgba(${pr}, ${pg}, ${pb}, 0.25)`);

      const headerBg = this.mixColors(bg, '#000000', 0.80);
      const hb = this.hexToRgb(headerBg);
      const headerLum = 0.2126 * hb.r + 0.7152 * hb.g + 0.0722 * hb.b;
      root.style.setProperty('--header-bg', headerBg);
      root.style.setProperty('--header-border', `rgba(${pr}, ${pg}, ${pb}, 0.15)`);
      root.style.setProperty('--header-text', headerLum > 150 ? '#111827' : '#f8fafc');
    } else {
      // Réinitialiser aux valeurs par défaut du thème dark
      root.style.setProperty('--sidebar-bg', '#1a1a2e');
      root.style.setProperty('--sidebar-bg-hover', '#252542');
      root.style.setProperty('--sidebar-border', 'rgba(255, 255, 255, 0.1)');
      root.style.setProperty('--sidebar-text', '#a0a0b0');
      root.style.setProperty('--sidebar-text-muted', '#6a6a7a');
      root.style.setProperty('--sidebar-accent', 'linear-gradient(135deg, #00d4ff 0%, #7b2cbf 100%)');
      root.style.setProperty('--sidebar-accent-color', '#00d4ff');
      root.style.setProperty('--sidebar-accent-shadow', 'rgba(0, 212, 255, 0.25)');
      root.style.setProperty('--header-bg', 'transparent');
      root.style.setProperty('--header-border', 'rgba(255, 255, 255, 0.1)');
      root.style.setProperty('--header-text', '#ffffff');
    }
  },

  // === GRID EDITOR ===

  enterEditMode() {
    this.gridEditMode = true;
    document.getElementById('headerActions').style.display = 'none';
    document.getElementById('editToolbar').style.display = 'flex';
    this.enableGridEditing();
  },

  exitEditMode() {
    this.gridEditMode = false;
    document.getElementById('editToolbar').style.display = 'none';
    document.getElementById('headerActions').style.display = 'flex';
    this.disableGridEditing();
    this.saveAllWidgetPositions();
  },

  // Compatibilité legacy (au cas où)
  toggleGridEditMode() {
    if (this.gridEditMode) {
      this.exitEditMode();
    } else {
      this.enterEditMode();
    }
  },

  enableGridEditing() {
    const widgets = document.querySelectorAll('.widget-wrapper');
    widgets.forEach(widget => {
      widget.classList.add('editable');

      // Ajouter bouton de suppression
      if (!widget.querySelector('.widget-delete-btn')) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'widget-delete-btn';
        deleteBtn.textContent = '×';
        deleteBtn.title = 'Retirer de l\'onglet';
        deleteBtn.onclick = (e) => {
          e.stopPropagation();
          this.removeWidgetFromGrid(widget.dataset.instanceId);
        };
        widget.appendChild(deleteBtn);
      }

      // Ajouter bouton de config
      if (!widget.querySelector('.widget-config-btn')) {
        const configBtn = document.createElement('button');
        configBtn.className = 'widget-config-btn';
        configBtn.textContent = '⚙️';
        configBtn.title = 'Paramètres de l\'instance';
        configBtn.onclick = (e) => {
          e.stopPropagation();
          this.openWidgetInstanceConfig(widget.dataset.instanceId);
        };
        widget.appendChild(configBtn);
      }

      // Ajouter handle de resize
      if (!widget.querySelector('.widget-resize-handle')) {
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'widget-resize-handle';
        resizeHandle.title = 'Redimensionner';
        widget.appendChild(resizeHandle);
      }
    });

    this.attachGridEditHandlers();
  },

  disableGridEditing() {
    const widgets = document.querySelectorAll('.widget-wrapper');
    const btnsToRemove = [];

    widgets.forEach(widget => {
      widget.classList.remove('editable');
      // Fade-out des boutons avant suppression
      const btns = widget.querySelectorAll('.widget-delete-btn, .widget-config-btn');
      btns.forEach(btn => {
        btn.classList.add('fade-out');
        btnsToRemove.push(btn);
      });
      widget.querySelector('.widget-resize-handle')?.remove();
    });

    // Supprimer après l'animation
    setTimeout(() => {
      btnsToRemove.forEach(btn => btn.remove());
    }, 150);

    this.detachGridEditHandlers();
  },

  attachGridEditHandlers() {
    // Stocker les références bound pour pouvoir les retirer
    if (!this._boundHandleMouseMove) {
      this._boundHandleMouseMove = this.handleMouseMove.bind(this);
      this._boundHandleMouseUp = this.handleMouseUp.bind(this);
      this._boundHandleWidgetMouseDown = this.handleWidgetMouseDown.bind(this);
      this._boundHandleResizeMouseDown = this.handleResizeMouseDown.bind(this);
    }

    const widgets = document.querySelectorAll('.widget-wrapper');
    widgets.forEach(widget => {
      widget.addEventListener('mousedown', this._boundHandleWidgetMouseDown);
      const resizeHandle = widget.querySelector('.widget-resize-handle');
      if (resizeHandle) {
        resizeHandle.addEventListener('mousedown', this._boundHandleResizeMouseDown);
      }
    });

    document.addEventListener('mousemove', this._boundHandleMouseMove);
    document.addEventListener('mouseup', this._boundHandleMouseUp);
  },

  detachGridEditHandlers() {
    if (this._boundHandleMouseMove) {
      document.removeEventListener('mousemove', this._boundHandleMouseMove);
      document.removeEventListener('mouseup', this._boundHandleMouseUp);
    }
    // Retirer aussi les listeners des widgets
    const widgets = document.querySelectorAll('.widget-wrapper');
    widgets.forEach(widget => {
      widget.removeEventListener('mousedown', this._boundHandleWidgetMouseDown);
      const resizeHandle = widget.querySelector('.widget-resize-handle');
      if (resizeHandle) {
        resizeHandle.removeEventListener('mousedown', this._boundHandleResizeMouseDown);
      }
    });
  },

  handleWidgetMouseDown(e) {
    if (e.target.classList.contains('widget-resize-handle')) return;
    if (e.target.classList.contains('widget-delete-btn')) return;
    if (e.target.closest('.widget-iframe')) return;

    const widget = e.currentTarget;
    this.draggingWidget = {
      element: widget,
      startX: e.clientX,
      startY: e.clientY,
      originalX: parseInt(widget.style.gridColumnStart || 1) - 1,
      originalY: parseInt(widget.style.gridRowStart || 1) - 1
    };

    widget.classList.add('dragging');
    e.preventDefault();
  },

  handleResizeMouseDown(e) {
    e.stopPropagation();
    e.preventDefault();

    const widget = e.target.closest('.widget-wrapper');
    this.resizingWidget = {
      element: widget,
      startX: e.clientX,
      startY: e.clientY,
      originalCols: parseInt(widget.dataset.cols),
      originalRows: parseInt(widget.dataset.rows)
    };

    widget.classList.add('resizing');
  },

  handleMouseMove(e) {
    if (!this.draggingWidget && !this.resizingWidget) return;

    // Throttle via rAF pour éviter le layout thrashing
    if (this._moveRafId) return;
    this._moveRafId = requestAnimationFrame(() => {
      this._moveRafId = null;
      this._processMouseMove(e);
    });
  },

  _processMouseMove(e) {
    // Lecture unique du layout pour drag ET resize
    // Utiliser le gridConfig de la page courante si on est dans une page
    const currentPage = this.currentPageId && this.currentTab?.pages?.find(p => p.id === this.currentPageId);
    const baseGridConfig = (currentPage?.gridConfig) || this.currentTab?.gridConfig || { cols: 24, rowHeight: 40, gap: 12 };
    // En mode édition, utiliser les colonnes par défaut (pas de calcul responsive)
    const gridConfig = {
      ...baseGridConfig,
      cols: baseGridConfig.cols,
      rowHeight: this.calculateResponsiveRowHeight(baseGridConfig.rowHeight)
    };
    const container = document.querySelector('.grid-container');
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const colWidth = containerRect.width / baseGridConfig.cols;

    if (this.draggingWidget) {
      const deltaX = e.clientX - this.draggingWidget.startX;
      const deltaY = e.clientY - this.draggingWidget.startY;

      const newX = Math.max(0, Math.min(gridConfig.cols - parseInt(this.draggingWidget.element.dataset.cols),
                                        this.draggingWidget.originalX + Math.round(deltaX / colWidth)));
      const newY = Math.max(0, this.draggingWidget.originalY + Math.round(deltaY / (gridConfig.rowHeight + gridConfig.gap)));

      this.draggingWidget.element.style.gridColumnStart = newX + 1;
      this.draggingWidget.element.style.gridRowStart = newY + 1;
    }

    if (this.resizingWidget) {
      const deltaX = e.clientX - this.resizingWidget.startX;
      const deltaY = e.clientY - this.resizingWidget.startY;

      const newCols = Math.max(1, Math.min(gridConfig.cols, this.resizingWidget.originalCols + Math.round(deltaX / colWidth)));
      const newRows = Math.max(1, this.resizingWidget.originalRows + Math.round(deltaY / (gridConfig.rowHeight + gridConfig.gap)));

      this.resizingWidget.element.style.gridColumnEnd = `span ${newCols}`;
      this.resizingWidget.element.style.gridRowEnd = `span ${newRows}`;
      this.resizingWidget.element.dataset.cols = newCols;
      this.resizingWidget.element.dataset.rows = newRows;
    }
  },

  handleMouseUp() {
    // Annuler un rAF en cours
    if (this._moveRafId) {
      cancelAnimationFrame(this._moveRafId);
      this._moveRafId = null;
    }

    if (this.draggingWidget) {
      this.draggingWidget.element.classList.remove('dragging');
      this.draggingWidget = null;
    }

    if (this.resizingWidget) {
      this.resizingWidget.element.classList.remove('resizing');
      this.resizingWidget = null;
    }
  },

  async saveAllWidgetPositions() {
    if (!this.currentTab) return;

    const widgets = document.querySelectorAll('.widget-wrapper');
    const updates = [];

    widgets.forEach(widget => {
      // gridColumnStart est défini uniquement si le widget a été déplacé (via _processMouseMove)
      // Sinon, lire depuis data-x/data-y qui sont initialisés au render
      const colStart = widget.style.gridColumnStart;
      const rowStart = widget.style.gridRowStart;
      const position = {
        x: colStart ? parseInt(colStart) - 1 : parseInt(widget.dataset.x || '0'),
        y: rowStart ? parseInt(rowStart) - 1 : parseInt(widget.dataset.y || '0'),
        cols: parseInt(widget.dataset.cols),
        rows: parseInt(widget.dataset.rows)
      };

      updates.push({
        instanceId: widget.dataset.instanceId,
        position
      });
    });

    // Sauvegarder via API — utiliser la route page si on est dans une page
    const tabId = this.currentTab.id;
    const pageId = this.currentPageId;

    for (const update of updates) {
      try {
        if (pageId && this.currentTab.pages?.length > 0) {
          await this.api(`/tabs/${tabId}/pages/${pageId}/widgets/${update.instanceId}`, {
            method: 'PUT',
            body: JSON.stringify({ position: update.position })
          });
          // Mettre à jour la position en mémoire dans la page
          const page = this.currentTab.pages.find(p => p.id === pageId);
          if (page) {
            const inst = page.widgets.find(w => w.id === update.instanceId);
            if (inst) inst.position = update.position;
          }
        } else {
          await this.widgetManager.updateWidgetPosition(tabId, update.instanceId, update.position);
          // Mettre à jour la position en mémoire dans tab.widgets
          const inst = this.currentTab.widgets?.find(w => w.id === update.instanceId);
          if (inst) inst.position = update.position;
        }
      } catch (err) {
        console.error('Failed to save widget position:', err);
      }
    }

    this.showNotification('Positions sauvegardées', 'success');
  },

  async removeWidgetFromGrid(instanceId) {
    if (!(await this.showConfirm('Retirer ce widget de l\'onglet ?'))) return;

    try {
      // Animation de décomposition + particules
      const wrapper = document.querySelector(`[data-instance-id="${instanceId}"]`);
      if (wrapper) {
        this.spawnParticles(wrapper);
        wrapper.classList.add('widget-removing');
        await new Promise(r => setTimeout(r, 500));
      }

      const tabId = this.currentTab.id;
      const pageId = this.currentPageId;

      if (pageId && this.currentTab.pages?.length > 0) {
        await this.api(`/tabs/${tabId}/pages/${pageId}/widgets/${instanceId}`, { method: 'DELETE' });
      } else {
        await this.widgetManager.removeWidgetFromTab(tabId, instanceId);
      }

      // Recharger le tab depuis le serveur pour avoir les données à jour
      const updatedTab = await this.api(`/tabs/${this.currentTab.id}`);
      this.currentTab = updatedTab;

      // Re-render la grille avec les données fraîches
      const currentPage = this.getCurrentPage(this.currentTab);
      this.currentPageId = currentPage?.id || null;
      await this.renderGrid(this.currentTab, currentPage);
      this.showNotification('Widget retiré', 'success');
    } catch (err) {
      console.error('Error removing widget:', err);
      await this.showAlert('Erreur lors de la suppression', 'error');
    }
  },

  // Particules de décomposition pour la suppression de widget
  spawnParticles(element) {
    const rect = element.getBoundingClientRect();
    const colors = ['var(--accent-primary)', 'var(--accent-secondary)', '#ff6b6b', '#ffd93d', '#6bcb77'];
    const count = 12;

    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.className = 'widget-particle';
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const distance = 60 + Math.random() * 80;
      const px = Math.cos(angle) * distance;
      const py = Math.sin(angle) * distance;
      const pr = (Math.random() - 0.5) * 360;

      particle.style.cssText = `
        left: ${rect.left + rect.width / 2}px;
        top: ${rect.top + rect.height / 2}px;
        background: ${colors[i % colors.length]};
        --px: ${px}px;
        --py: ${py}px;
        --pr: ${pr}deg;
        position: fixed;
      `;
      document.body.appendChild(particle);
      setTimeout(() => particle.remove(), 600);
    }
  },

});
