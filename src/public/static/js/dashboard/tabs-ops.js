/**
 * Dashboard tabs operations : createTab, saveTabChanges, TAB VARIABLES, deleteTab
 * Méthodes ajoutées au prototype Dashboard
 */
import { Dashboard } from './core.js?v=331';

Object.assign(Dashboard.prototype, {
  async createTab(name) {
    try {
      const tab = await this.api('/tabs', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });

      this.tabs.push(tab);
      this.selectTab(tab);
      this.closeModal('newTabModal');
    } catch (err) {
      console.error('Failed to create tab:', err);
      await this.showAlert('Erreur lors de la création de l\'onglet', 'error');
    }
  },

  showEditTabModal(tab) {
    this.editingTab = tab;

    // Remplir les champs
    document.getElementById('editTabName').value = tab.name;

    // Initialiser le sélecteur d'emoji
    this.initEmojiSelector(tab.emoji || '📄');

    // Charger les variables
    this.loadTabVariables(tab);

    // Ouvrir le modal
    this.openModal('editTabModal');
    document.getElementById('editTabName').focus();
  },

  initEmojiSelector(currentEmoji) {
    const selectedEmoji = document.getElementById('selectedEmoji');

    // Mettre à jour l'emoji sélectionné
    selectedEmoji.textContent = currentEmoji;
    this.currentSelectedEmoji = currentEmoji;

    // Ajouter l'event listener au bouton emoji
    selectedEmoji.addEventListener('click', async () => {
      const emoji = await this.openEmojiPicker(this.currentSelectedEmoji);
      if (emoji) {
        this.currentSelectedEmoji = emoji;
        selectedEmoji.textContent = emoji;
      }
    });
  },

  async saveTabChanges() {
    if (!this.editingTab) return;

    const newName = document.getElementById('editTabName').value.trim();
    if (!newName) {
      await this.showAlert('Le nom ne peut pas être vide');
      return;
    }

    try {
      const updated = await this.api(`/tabs/${this.editingTab.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: newName,
          emoji: this.currentSelectedEmoji
        }),
      });

      const index = this.tabs.findIndex(t => t.id === this.editingTab.id);
      if (index !== -1) this.tabs[index] = updated;

      if (this.currentTab?.id === this.editingTab.id) {
        this.currentTab = updated;
        document.getElementById('currentTabName').textContent = updated.name;
      }

      this.renderTabs();
      this.closeModal('editTabModal');
      this.editingTab = null;
    } catch (err) {
      console.error('Failed to update tab:', err);
      await this.showAlert('Erreur lors de la modification', 'error');
    }
  },

  // === TAB VARIABLES ===

  loadTabVariables(tab) {
    const list = document.getElementById('tabVariablesList');
    const variables = tab.variables || {};

    if (Object.keys(variables).length === 0) {
      list.innerHTML = '<p style="color: var(--text-muted); font-size: 13px; margin: 8px 0;">Aucune variable définie</p>';
      return;
    }

    list.innerHTML = Object.entries(variables).map(([key, value]) => `
      <div class="tab-variable-item" data-key="${key}">
        <div class="tab-variable-key">${key}</div>
        <input type="text" class="tab-variable-value" value="${this.escapeHtml(String(value))}" data-key="${key}">
        <div class="tab-variable-actions">
          <button class="save-btn" onclick="dashboard.saveTabVariable('${key}', this)">💾</button>
          <button class="delete-btn" onclick="dashboard.deleteTabVariable('${key}')">🗑️</button>
        </div>
      </div>
    `).join('');
  },

  async saveTabVariable(key, btn) {
    if (!this.editingTab) return;

    const input = btn.closest('.tab-variable-item').querySelector('.tab-variable-value');
    const value = input.value.trim();

    try {
      await this.api(`/tabs/${this.editingTab.id}/variables/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value })
      });

      // Mettre à jour localement
      if (!this.editingTab.variables) this.editingTab.variables = {};
      this.editingTab.variables[key] = value;

      // Notifier tous les widgets de l'onglet du changement
      if (this.currentTab?.id === this.editingTab.id) {
        this.broadcastVariableChange(key, value);
      }

      // Feedback visuel
      btn.textContent = '✅';
      setTimeout(() => { btn.textContent = '💾'; }, 1000);
    } catch (err) {
      console.error('Failed to save variable:', err);
      await this.showAlert('Erreur lors de la sauvegarde', 'error');
    }
  },

  async deleteTabVariable(key) {
    if (!this.editingTab) return;

    if (!(await this.showConfirm(`Supprimer la variable "${key}" ?`))) {
      return;
    }

    try {
      await this.api(`/tabs/${this.editingTab.id}/variables/${key}`, {
        method: 'DELETE'
      });

      // Mettre à jour localement
      if (this.editingTab.variables) {
        delete this.editingTab.variables[key];
      }

      // Recharger l'affichage
      this.loadTabVariables(this.editingTab);

      // Notifier tous les widgets de l'onglet du changement
      if (this.currentTab?.id === this.editingTab.id) {
        this.broadcastVariableChange(key, undefined);
      }
    } catch (err) {
      console.error('Failed to delete variable:', err);
      await this.showAlert('Erreur lors de la suppression', 'error');
    }
  },

  async addTabVariable() {
    if (!this.editingTab) return;

    const keyInput = document.getElementById('newVariableKey');
    const valueInput = document.getElementById('newVariableValue');

    const key = keyInput.value.trim();
    const value = valueInput.value.trim();

    if (!key) {
      await this.showAlert('Le nom de la variable est requis');
      return;
    }

    // Validation du nom de variable (alphanumérique + underscore)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      await this.showAlert('Le nom de variable doit commencer par une lettre ou _ et contenir uniquement des lettres, chiffres et _');
      return;
    }

    try {
      await this.api(`/tabs/${this.editingTab.id}/variables/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value })
      });

      // Mettre à jour localement
      if (!this.editingTab.variables) this.editingTab.variables = {};
      this.editingTab.variables[key] = value;

      // Recharger l'affichage
      this.loadTabVariables(this.editingTab);

      // Notifier tous les widgets de l'onglet du changement
      if (this.currentTab?.id === this.editingTab.id) {
        this.broadcastVariableChange(key, value);
      }

      // Vider les champs
      keyInput.value = '';
      valueInput.value = '';
      keyInput.focus();
    } catch (err) {
      console.error('Failed to add variable:', err);
      await this.showAlert('Erreur lors de l\'ajout', 'error');
    }
  },

  broadcastVariableChange(key, value) {
    // Envoyer un message à tous les iframes de widgets pour les notifier du changement
    const iframes = document.querySelectorAll('.widget-iframe');
    iframes.forEach(iframe => {
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'tab-variable-changed',
          key,
          value
        }, '*');
      }
    });
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  async deleteTab(tab) {
    if (!(await this.showConfirm(`Supprimer l'onglet "${tab.name}" ? Cette action est irréversible.`))) {
      return;
    }

    try {
      await this.api(`/tabs/${tab.id}`, { method: 'DELETE' });

      this.tabs = this.tabs.filter(t => t.id !== tab.id);

      if (this.currentTab?.id === tab.id) {
        this.currentTab = null;
        this.gridEditMode = false;
        localStorage.removeItem('currentTabId');
        document.getElementById('currentTabName').textContent = 'Sélectionner un onglet';
        document.getElementById('headerActions').style.display = 'none';
        document.getElementById('editToolbar').style.display = 'none';
        const tabFrame = document.getElementById('tabFrame');
        if (tabFrame) tabFrame.style.display = 'none';
        const tabGrid = document.getElementById('tabGridContainer');
        if (tabGrid) tabGrid.style.display = 'none';
        document.getElementById('welcomeScreen').style.display = 'flex';
      }

      this.renderTabs();
    } catch (err) {
      console.error('Failed to delete tab:', err);
      await this.showAlert('Erreur lors de la suppression', 'error');
    }
  },

  // === PAGES ===

  /**
   * Ajouter une page au tab courant
   */
  async addPage() {
    if (!this.currentTab) return;

    // Si le tab n'a pas encore de pages, migrer d'abord
    if (!this.currentTab.pages || this.currentTab.pages.length === 0) {
      // Créer la première page à partir des widgets existants
      await this.api(`/tabs/${this.currentTab.id}/pages`, {
        method: 'POST',
        body: JSON.stringify({ name: 'Page 1' })
      });

      // Recharger le tab pour avoir la migration
      this.currentTab = await this.api(`/tabs/${this.currentTab.id}`);
    }

    const name = `Page ${(this.currentTab.pages?.length || 0) + 1}`;
    try {
      const page = await this.api(`/tabs/${this.currentTab.id}/pages`, {
        method: 'POST',
        body: JSON.stringify({ name })
      });

      // Recharger le tab
      this.currentTab = await this.api(`/tabs/${this.currentTab.id}`);

      // Basculer sur la nouvelle page
      this.selectPage(page.id);

      this.showNotification(`Page "${name}" ajoutée`, 'success');
    } catch (err) {
      console.error('Failed to add page:', err);
      await this.showAlert('Erreur lors de l\'ajout de la page', 'error');
    }
  },

  // === BACKUPS ===

});
