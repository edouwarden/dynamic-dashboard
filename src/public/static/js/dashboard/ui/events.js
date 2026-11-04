/**
 * Dashboard UI — liaison des événements
 * bindEvents() : tous les event listeners du dashboard
 * Méthodes : bindEvents
 * Méthodes ajoutées au prototype Dashboard
 */
import { Dashboard } from '../core.js?v=331';

Object.assign(Dashboard.prototype, {
  bindEvents() {
    // Sidebar toggle
    this.safeAddListener('sidebarToggle', 'click', () => {
      const sidebar = document.getElementById('sidebar');
      const backdrop = document.getElementById('sidebarBackdrop');
      if (!sidebar) return;
      if (window.innerWidth <= 768) {
        // Mobile : fermer l'overlay
        sidebar.classList.remove('mobile-open');
        backdrop?.classList.remove('visible');
      } else {
        // Desktop : réduire/agrandir
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
      }
    });

    // Hamburger mobile — ouvrir la sidebar
    this.safeAddListener('mobileMenuBtn', 'click', () => {
      document.getElementById('sidebar')?.classList.add('mobile-open');
      document.getElementById('sidebarBackdrop')?.classList.add('visible');
    });

    // Backdrop — fermer la sidebar
    this.safeAddListener('sidebarBackdrop', 'click', () => {
      document.getElementById('sidebar')?.classList.remove('mobile-open');
      document.getElementById('sidebarBackdrop')?.classList.remove('visible');
    });

    // Double-clic sur un widget → plein écran (hors mode édition)
    // Fermer la sidebar mobile quand un onglet est sélectionné
    const tabsList = document.getElementById('tabsList');
    if (tabsList) {
      tabsList.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          document.getElementById('sidebar')?.classList.remove('mobile-open');
          document.getElementById('sidebarBackdrop')?.classList.remove('visible');
        }
      });
    }

    // === Mode confidentialité ===
    // Restaurer l'état au démarrage
    if (this.privacyMode) {
      document.body.classList.add('privacy-mode');
      const privBtn = document.getElementById('privacyToggleBtn');
      if (privBtn) privBtn.querySelector('span').textContent = '🔒';
    }

    // Toggle confidentialité
    this.safeAddListener('privacyToggleBtn', 'click', () => {
      this.privacyMode = !this.privacyMode;
      document.body.classList.toggle('privacy-mode', this.privacyMode);
      const privBtn = document.getElementById('privacyToggleBtn');
      if (privBtn) privBtn.querySelector('span').textContent = this.privacyMode ? '🔒' : '🔓';
      localStorage.setItem('privacyMode', this.privacyMode);
      // Retirer tous les reveals quand on toggle
      document.querySelectorAll('.widget-wrapper.privacy-revealed').forEach(w => w.classList.remove('privacy-revealed'));
    });

    // Clic/tap sur un widget en mode confidentialité → reveal uniquement celui-ci
    const handlePrivacyTap = (e) => {
      if (!this.privacyMode) return;
      // Éviter le double-déclenchement touch+click sur mobile
      if (e.type === 'click' && e._fromTouch) return;
      const wrapper = e.target.closest('.widget-wrapper');
      if (wrapper) {
        // Retirer le reveal de tous les autres
        document.querySelectorAll('.widget-wrapper.privacy-revealed').forEach(w => {
          if (w !== wrapper) w.classList.remove('privacy-revealed');
        });
        // Toggle le reveal sur celui-ci
        wrapper.classList.toggle('privacy-revealed');
      } else {
        // Clic sur le fond → tout reflouter
        document.querySelectorAll('.widget-wrapper.privacy-revealed').forEach(w => w.classList.remove('privacy-revealed'));
      }
    };
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.addEventListener('click', handlePrivacyTap);
      // Sur iOS/mobile, click ne se propage pas bien depuis éléments non-interactifs
      mainContent.addEventListener('touchend', (e) => {
        if (!this.privacyMode) return;
        const touch = e.changedTouches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!target) return;
        const wrapper = target.closest('.widget-wrapper');
        // Ne bloquer le comportement natif que si on tape sur un widget flou (pas révélé)
        if (wrapper && !wrapper.classList.contains('privacy-revealed')) {
          e.preventDefault();
          handlePrivacyTap({ target, type: 'touchend' });
        }
        // Si tap sur un widget révélé ou sur le fond → laisser faire le click natif
      }, { passive: false });
    }

    // Restaurer l'état de la sidebar (desktop uniquement)
    const sidebar = document.getElementById('sidebar');
    if (sidebar && localStorage.getItem('sidebarCollapsed') === 'true') {
      sidebar.classList.add('collapsed');
    }

    // New tab buttons
    const addTabBtn = document.getElementById('addTabBtn');
    if (addTabBtn) {
      addTabBtn.addEventListener('click', () => {
        this.openModal('newTabModal');
        const tabNameInput = document.getElementById('tabName');
        if (tabNameInput) tabNameInput.focus();
      });
    }

    const welcomeAddBtn = document.getElementById('welcomeAddBtn');
    if (welcomeAddBtn) {
      welcomeAddBtn.addEventListener('click', () => {
        this.openModal('newTabModal');
        const tabNameInput = document.getElementById('tabName');
        if (tabNameInput) tabNameInput.focus();
      });
    }

    // Create tab
    this.safeAddListener('createTabBtn', 'click', () => {
      const nameInput = document.getElementById('tabName');
      const name = nameInput?.value.trim();
      if (name) this.createTab(name);
    });

    this.safeAddListener('tabName', 'keydown', (e) => {
      if (e.key === 'Enter') {
        const name = e.target.value.trim();
        if (name) this.createTab(name);
      }
    });

    // Add page button
    // Add page buttons (barre de pages + toolbar édition)
    this.safeAddListener('addPageBtn', 'click', () => {
      this.addPage();
    });
    this.safeAddListener('addPageBtnToolbar', 'click', () => {
      this.addPage();
    });

    // Edit tab modal
    this.safeAddListener('saveTabBtn', 'click', () => {
      this.saveTabChanges();
    });

    this.safeAddListener('editTabName', 'keydown', (e) => {
      if (e.key === 'Enter') {
        this.saveTabChanges();
      }
    });

    // Tab variables
    this.safeAddListener('addVariableBtn', 'click', () => {
      this.addTabVariable();
    });

    this.safeAddListener('newVariableKey', 'keydown', (e) => {
      if (e.key === 'Enter') {
        this.addTabVariable();
      }
    });

    this.safeAddListener('newVariableValue', 'keydown', (e) => {
      if (e.key === 'Enter') {
        this.addTabVariable();
      }
    });

    // Header actions (anciens boutons backupsBtn, claudeBtn, databaseBtn supprimés de l'interface)

    // Scripts globaux
    this.safeAddListener('scriptsSidebarBtn', 'click', () => {
      this.globalScriptManager.openPanel();
    });
    this.safeAddListener('scriptsPanelCloseBtn', 'click', () => {
      this.globalScriptManager.closePanel();
    });
    this.safeAddListener('panelNewScriptBtn', 'click', () => {
      this.openModal('createScriptModal');
    });
    this.safeAddListener('confirmCreateScriptBtn', 'click', () => {
      this.globalScriptManager.createScript();
    });
    this.safeAddListener('pickNewScriptEmojiBtn', 'click', async () => {
      const emoji = await this.openEmojiPicker(document.getElementById('newScriptEmoji').value);
      if (emoji) {
        document.getElementById('newScriptEmoji').value = emoji;
        document.getElementById('newScriptEmojiPreview').textContent = emoji;
      }
    });

    // Database modal
    this.safeAddListener('showCreateTableBtn', 'click', () => {
      this.showCreateTableForm();
    });

    this.safeAddListener('cancelCreateTableBtn', 'click', () => {
      this.hideCreateTableForm();
    });

    this.safeAddListener('createTableBtn', 'click', () => {
      this.createTable();
    });

    // Add column button in create table form
    this.safeAddListener('addColumnBtn', 'click', () => {
      const container = document.getElementById('columnsContainer');
      if (container) this.addColumnRow(container);
    });

    // SQL Explorer buttons
    this.safeAddListener('closeExplorerBtn', 'click', () => {
      this.closeExplorer();
    });

    this.safeAddListener('addRowBtn', 'click', () => {
      this.addNewRow();
    });

    this.safeAddListener('editTableSchemaBtn', 'click', () => {
      this.openEditTableSchema();
    });

    this.safeAddListener('refreshExplorerBtn', 'click', () => {
      this.loadExplorerData();
    });

    // Edit row buttons
    this.safeAddListener('cancelEditRowBtn', 'click', () => {
      this.cancelEditRow();
    });

    this.safeAddListener('saveRowBtn', 'click', () => {
      this.saveRow();
    });

    // Edit table schema buttons
    this.safeAddListener('cancelEditTableBtn', 'click', () => {
      this.cancelEditTable();
    });

    this.safeAddListener('addNewColumnBtn', 'click', () => {
      this.addNewColumnToEdit();
    });

    this.safeAddListener('saveTableChangesBtn', 'click', () => {
      this.saveTableChanges();
    });

    // Auto-create tables checkbox (legacy - removed)

    // Backups modal
    this.safeAddListener('createBackupBtn', 'click', () => {
      this.createBackup();
    });

    // === WIDGET EVENT HANDLERS ===

    // Note : les événements du chat OpenCode (input, send, sessions, attachments)
    // sont gérés directement par OpenCodePanel (managers/opencode-panel.js)

    // Mode plein écran widget
    this.safeAddListener('fullscreenModeBtn', 'click', () => {
      if (this.fullscreenMode) {
        this.exitFullscreenMode();
      } else {
        this.enterFullscreenMode();
      }
    });

    // Mode édition
    this.safeAddListener('enterEditModeBtn', 'click', () => {
      this.enterEditMode();
    });

    this.safeAddListener('exitEditModeBtn', 'click', () => {
      this.exitEditMode();
    });

    this.safeAddListener('tabSettingsBtn', 'click', () => {
      if (this.currentTab) this.showEditTabModal(this.currentTab);
    });

    // Dashboard OpenCode panel
    this.safeAddListener('dashboardOpenCodeBtn', 'click', () => {
      this.openDashboardOpenCodePanel();
    });

    this.safeAddListener('dashboardOpenCodePanelCloseBtn', 'click', () => {
      this.closeDashboardOpenCodePanel();
    });

    // Fermer overlay en cliquant en dehors du panel
    const dashboardOpenCodeOverlay = document.getElementById('dashboardOpenCodeOverlay');
    if (dashboardOpenCodeOverlay) {
      dashboardOpenCodeOverlay.addEventListener('click', (e) => {
        if (e.target === dashboardOpenCodeOverlay) this.closeDashboardOpenCodePanel();
      });
    }

    // Create widget
    this.safeAddListener('createWidgetBtn', 'click', () => {
      this.openCreateWidgetModal();
    });

    // Emoji pickers pour widgets
    this.safeAddListener('widgetEmojiPreview', 'click', async () => {
      const current = document.getElementById('widgetEmoji').value || '📊';
      const emoji = await this.openEmojiPicker(current);
      if (emoji) {
        document.getElementById('widgetEmoji').value = emoji;
        document.getElementById('widgetEmojiPreview').textContent = emoji;
      }
    });

    this.safeAddListener('editWidgetEmojiPreview', 'click', async () => {
      const current = document.getElementById('editWidgetEmoji').value || '📊';
      const emoji = await this.openEmojiPicker(current);
      if (emoji) {
        document.getElementById('editWidgetEmoji').value = emoji;
        document.getElementById('editWidgetEmojiPreview').textContent = emoji;
      }
    });

    this.safeAddListener('saveWidgetBtn', 'click', () => {
      this.saveWidget();
    });

    this.safeAddListener('addWidgetPermissionBtn', 'click', () => {
      this.addWidgetPermission();
    });

    // Add widget to tab
    this.safeAddListener('addWidgetBtn', 'click', () => {
      this.openAddWidgetModal();
    });


    // Style config
    this.safeAddListener('styleConfigBtn', 'click', () => {
      this.openStyleConfigModal();
    });

    this.safeAddListener('saveInstanceConfigBtn', 'click', () => {
      this.saveWidgetInstanceConfig();
    });

    this.safeAddListener('saveStyleBtn', 'click', () => {
      this.saveStyle();
    });

    this.safeAddListener('savePresetBtn', 'click', () => {
      this.saveStyleAsPreset();
    });

    // Preset search input
    this.safeAddListener('presetSearchInput', 'input', (e) => {
      this.renderStylePresets(e.target.value);
    });

    // Style color pickers sync with text inputs
    ['stylePrimaryColor', 'styleSecondaryColor', 'styleBackgroundColor', 'styleTextColor'].forEach(id => {
      const colorInput = document.getElementById(id);
      const textInput = document.getElementById(id + 'Text');
      if (colorInput && textInput) {
        colorInput.addEventListener('input', (e) => {
          textInput.value = e.target.value;
          this.updateStylePreview();
        });
        textInput.addEventListener('input', (e) => {
          if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
            colorInput.value = e.target.value;
            this.updateStylePreview();
          }
        });
      }
    });

    // Style selects
    ['styleFontFamily', 'styleBorderStyle', 'styleBorderWidth', 'styleBorderRadius', 'styleShadowStyle'].forEach(id => {
      this.safeAddListener(id, 'change', () => {
        this.updateStylePreview();
      });
    });

    // Widget edit modal tabs
    // Widget tabs - using event delegation
    const widgetTabsContainer = document.querySelector('.widget-tabs');
    if (widgetTabsContainer) {
      widgetTabsContainer.addEventListener('click', (e) => {
        const tab = e.target.closest('.widget-tab');
        if (tab && tab.dataset.tab) {
          console.log('[DEBUG] Widget tab clicked:', tab.dataset.tab);
          this.switchWidgetTab(tab.dataset.tab);
        }
      });
    }

    // Widget backups
    this.safeAddListener('createWidgetBackupBtn', 'click', async () => {
      if (this.widgetManager.currentWidget) {
        try {
          await this.widgetManager.createWidgetBackup(this.widgetManager.currentWidget.id);
          this.loadWidgetBackupsList();
          this.showNotification('Backup créé', 'success');
        } catch (err) {
          await this.showAlert('Erreur lors de la création du backup', 'error');
        }
      }
    });

    this.safeAddListener('refreshPreviewBtn', 'click', () => {
      const frame = document.getElementById('widgetPreviewFrame');
      if (frame) {
        const url = new URL(frame.src);
        url.searchParams.set('_t', Date.now());
        frame.src = 'about:blank';
        // Forcer un vrai rechargement (vide l'iframe puis recharge) pour invalider le cache CSS/JS
        setTimeout(() => { frame.src = url.toString(); }, 50);
      }
    });

    // Preview device modes
    this.safeAddListener('previewDeviceAuto', 'click', () => this.setPreviewMode('auto'));
    this.safeAddListener('previewDevicePhone', 'click', () => this.setPreviewMode('phone'));
    this.safeAddListener('previewDeviceTablet', 'click', () => this.setPreviewMode('tablet'));

    // Ouvrir dans un nouvel onglet
    this.safeAddListener('openWidgetInNewTabBtn', 'click', () => {
      const frame = document.getElementById('widgetPreviewFrame');
      if (frame && frame.src) window.open(frame.src, '_blank');
    });

    // Widget settings
    this.safeAddListener('saveWidgetSettingsBtn', 'click', () => {
      this.saveWidgetSettings();
    });

    // Widget database management
    this.safeAddListener('widgetShowCreateTableBtn', 'click', () => {
      this.showWidgetView('widgetCreateTableView');
      this.widgetColumnsData = [];
      this.renderWidgetColumnsBuilder();
    });

    this.safeAddListener('widgetCancelCreateTableBtn', 'click', () => {
      this.showWidgetView('widgetPermissionsView');
    });

    this.safeAddListener('widgetCloseExplorerBtn', 'click', () => {
      this.showWidgetView('widgetPermissionsView');
    });

    this.safeAddListener('widgetAutoApproveCreateTable', 'change', async (e) => {
      if (this.widgetManager.currentWidget) {
        await this.widgetManager.updateWidget(this.widgetManager.currentWidget.id, {
          autoApproveCreateTable: e.target.checked
        });
        this.widgetManager.currentWidget.autoApproveCreateTable = e.target.checked;
      }
    });

    this.safeAddListener('widgetAutoApproveAlterTable', 'change', async (e) => {
      if (this.widgetManager.currentWidget) {
        await this.widgetManager.updateWidget(this.widgetManager.currentWidget.id, {
          autoApproveAlterTable: e.target.checked
        });
        this.widgetManager.currentWidget.autoApproveAlterTable = e.target.checked;
      }
    });

    this.safeAddListener('widgetAddColumnBtn', 'click', () => {
      if (!this.widgetColumnsData) this.widgetColumnsData = [];
      this.widgetColumnsData.push({ name: '', type: 'TEXT' });
      this.renderWidgetColumnsBuilder();
    });

    this.safeAddListener('widgetCreateTableBtn', 'click', () => {
      this.createWidgetTable();
    });

    // Edit table schema listeners
    this.safeAddListener('widgetCancelEditTableBtn', 'click', () => {
      this.showWidgetView('widgetPermissionsView');
    });

    this.safeAddListener('widgetAddNewColumnBtn', 'click', () => {
      if (!this.widgetNewColumnsData) this.widgetNewColumnsData = [];
      this.widgetNewColumnsData.push({ name: '', type: 'TEXT' });
      this.renderWidgetNewColumnsBuilder();
    });

    this.safeAddListener('widgetSaveTableChangesBtn', 'click', () => {
      this.saveWidgetTableChanges();
    });

    // Explorer actions
    this.safeAddListener('widgetAddRowBtn', 'click', () => {
      this.showWidgetAddRowForm();
    });

    this.safeAddListener('widgetEditTableSchemaBtn', 'click', () => {
      if (this.currentWidgetTable) {
        this.editWidgetTableSchema(this.currentWidgetTable);
      }
    });

    this.safeAddListener('widgetRefreshExplorerBtn', 'click', () => {
      if (this.currentWidgetTable) {
        this.viewWidgetTable(this.currentWidgetTable);
      }
    });

    this.safeAddListener('widgetCancelEditRowBtn', 'click', () => {
      this.showWidgetView('widgetSqlExplorerView');
    });

    this.safeAddListener('widgetSaveRowBtn', 'click', () => {
      this.saveWidgetRow();
    });

    this.safeAddListener('deleteWidgetBtn', 'click', () => {
      this.deleteCurrentWidget();
    });

    // Context menu (tabs)
    document.querySelectorAll('#contextMenu .context-item').forEach(item => {
      item.addEventListener('click', () => {
        this.handleContextAction(item.dataset.action);
      });
    });

    // Context menu (widgets)
    document.querySelectorAll('#widgetContextMenu .context-item').forEach(item => {
      item.addEventListener('click', () => {
        this.handleWidgetContextAction(item.dataset.action);
      });
    });

    document.addEventListener('click', () => this.hideContextMenu());

    // Modal close buttons and backdrops
    document.querySelectorAll('.modal').forEach(modal => {
      modal.querySelector('.btn-close')?.addEventListener('click', () => {
        this.closeModal(modal.id);
      });

      modal.querySelector('.modal-backdrop')?.addEventListener('click', () => {
        this.closeModal(modal.id);
      });

      modal.querySelectorAll('.modal-cancel').forEach(btn => {
        btn.addEventListener('click', () => {
          this.closeModal(modal.id);
        });
      });
    });

    // Escape key to close modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
          this.closeModal(modal.id);
        });
        this.hideContextMenu();
      }
    });
  },
});
