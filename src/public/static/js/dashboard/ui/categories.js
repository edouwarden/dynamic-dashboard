/**
 * Dashboard UI — gestion des catégories
 * Catégories de widgets : localStorage, CRUD, drag&drop, corbeille
 * Méthodes : loadCategories, saveCategories, renderCategoryButtons, openManageCategoriesModal,
 *   renderCategoriesManager, addCategory, changeCategoryEmoji, deleteCategory,
 *   restoreFromTrash, emptyTrash
 * Méthodes ajoutées au prototype Dashboard
 */
import { Dashboard } from '../core.js?v=331';

Object.assign(Dashboard.prototype, {
  // === GESTION DES CATÉGORIES ===

  loadCategories() {
    const defaultCategories = [
      { id: 'uncategorized', name: 'Non catégorisés', emoji: '❓', locked: false },
      { id: 'charts', name: 'Graphiques & Visualisations', emoji: '📊', locked: false },
      { id: 'tables', name: 'Tableaux & Listes', emoji: '📝', locked: false },
      { id: 'tools', name: 'Outils & Utilitaires', emoji: '🔧', locked: false },
      { id: 'controls', name: 'Contrôles & Formulaires', emoji: '🎛️', locked: false },
      { id: 'other', name: 'Autres', emoji: '📦', locked: true },
      { id: 'trash', name: 'Corbeille', emoji: '🗑️', locked: true }
    ];

    const saved = localStorage.getItem('widgetCategories');
    if (saved) {
      try {
        const cats = JSON.parse(saved);
        // S'assurer que la corbeille existe
        if (!cats.find(c => c.id === 'trash')) {
          cats.push({ id: 'trash', name: 'Corbeille', emoji: '🗑️', locked: true });
        }
        return cats;
      } catch (err) {
        console.error('Failed to load categories:', err);
        return defaultCategories;
      }
    }
    return defaultCategories;
  },

  saveCategories() {
    localStorage.setItem('widgetCategories', JSON.stringify(this.categories));
  },

  renderCategoryButtons() {
    const container = document.getElementById('widgetCategoriesList');
    if (!container) return;

    const trashCount = this.widgetManager.widgets.filter(w => (w.category || 'other') === 'trash').length;

    // Déterminer la catégorie active (dernier utilisée ou première disponible)
    const savedCat = localStorage.getItem('lastWidgetCategory');
    const activeCat = (savedCat && (savedCat === 'all' || this.categories.some(c => c.id === savedCat && c.id !== 'trash')))
      ? savedCat
      : 'all';

    const html = `
      <button class="widget-category-btn${activeCat === 'all' ? ' active' : ''}" data-category="all" data-locked="true">
        🗂️ Tous les widgets
      </button>
      ${this.categories.filter(c => c.id !== 'trash').map((cat) => `
        <button class="widget-category-btn${cat.id === activeCat ? ' active' : ''}" data-category="${cat.id}" data-locked="${cat.locked}">
          ${cat.emoji} ${cat.name}
        </button>
      `).join('')}
      <button class="widget-category-btn trash-category-btn" data-category="trash">
        🗑️ Corbeille${trashCount > 0 ? ` <span class="trash-badge">${trashCount}</span>` : ''}
      </button>
      <button class="widget-category-btn-add" id="addCategoryBtnInline" title="Ajouter une catégorie">
        ➕
      </button>
    `;

    container.innerHTML = html;

    // Bouton ajouter catégorie
    const addBtn = document.getElementById('addCategoryBtnInline');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.addCategory());
    }

    // Re-bind les events sur les boutons de catégories
    container.querySelectorAll('.widget-category-btn').forEach(btn => {
      const category = btn.dataset.category;
      const isLocked = btn.dataset.locked === 'true';

      // Click pour filtrer
      btn.addEventListener('click', (e) => {
        // Ignorer le click si c'est un context menu
        if (e.button !== 0) return;
        container.querySelectorAll('.widget-category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        localStorage.setItem('lastWidgetCategory', category);
        const searchTerm = document.getElementById('widgetSearchInput')?.value || '';
        this.widgetManager.renderWidgetsGallery(category, searchTerm);
      });

      // Context menu pour supprimer (sauf locked)
      btn.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        if (isLocked || category === 'trash') return;

        const confirmed = await this.showConfirm(
          `Supprimer la catégorie "${btn.textContent.trim()}" ?\n\nTous les widgets de cette catégorie seront déplacés vers "Non catégorisés".`
        );
        if (!confirmed) return;

        await this.deleteCategory(category);
      });

      // Drag & drop
      btn.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        btn.classList.add('category-drag-over');
      });

      btn.addEventListener('dragleave', () => {
        btn.classList.remove('category-drag-over');
      });

      btn.addEventListener('drop', async (e) => {
        e.preventDefault();
        btn.classList.remove('category-drag-over');

        if (category === 'all') return;

        const widgetId = e.dataTransfer.getData('text/plain');
        if (!widgetId) return;

        // Garder la catégorie active actuelle avant le drag
        const activeBtn = document.querySelector('.widget-category-btn.active');
        const previousCategory = activeBtn ? activeBtn.dataset.category : 'uncategorized';

        try {
          await this.widgetManager.updateWidget(widgetId, { category });
        } catch (err) {
          console.error('Erreur changement catégorie:', err);
          this.showNotification('Erreur lors du changement de catégorie', 'error');
          return;
        }

        this.showNotification('Catégorie changée', 'success');
        this.renderCategoryButtons();
        // Rester dans la catégorie d'origine
        const previousBtn = document.querySelector(`[data-category="${previousCategory}"]`);
        if (previousBtn) {
          document.querySelectorAll('.widget-category-btn').forEach(b => b.classList.remove('active'));
          previousBtn.classList.add('active');
        }
        const searchTerm = document.getElementById('widgetSearchInput')?.value || '';
        this.widgetManager.renderWidgetsGallery(previousCategory, searchTerm);
      });
    });
  },

  openManageCategoriesModal() {
    this.renderCategoriesManager();
    this.openModal('manageCategoriesModal');
  },

  renderCategoriesManager() {
    const container = document.getElementById('categoriesList');
    if (!container) return;

    const html = this.categories.map(cat => `
      <div class="category-item" style="display: flex; align-items: center; gap: 8px; padding: 10px; background: var(--bg-tertiary); border-radius: 6px; margin-bottom: 8px;">
        <span style="font-size: 24px;">${cat.emoji}</span>
        <input type="text" value="${this.escapeHtml(cat.name)}" data-category-id="${cat.id}" class="category-name-input" style="flex: 1; padding: 6px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-secondary); color: var(--text-primary);" ${cat.locked ? 'disabled' : ''}>
        ${!cat.locked ? `
          <button class="btn-icon" onclick="dashboard.changeCategoryEmoji('${cat.id}')" title="Changer l'emoji">😊</button>
          <button class="btn-icon" onclick="dashboard.deleteCategory('${cat.id}')" title="Supprimer">🗑️</button>
        ` : '<span style="color: var(--text-secondary); font-size: 12px;">Système</span>'}
      </div>
    `).join('');

    container.innerHTML = html;

    // Bind input changes
    container.querySelectorAll('.category-name-input').forEach(input => {
      input.addEventListener('blur', () => {
        const categoryId = input.dataset.categoryId;
        const newName = input.value.trim();
        if (newName) {
          const cat = this.categories.find(c => c.id === categoryId);
          if (cat) {
            cat.name = newName;
            this.saveCategories();
            this.renderCategoryButtons();
          }
        }
      });
    });
  },

  async addCategory() {
    const overlay = document.createElement('div');
    overlay.className = 'custom-dialog-overlay';
    overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,1); display: flex; align-items: center; justify-content: center; z-index: 1002;';

    const dialog = document.createElement('div');
    dialog.className = 'custom-dialog';
    dialog.style.cssText = 'background: var(--bg-secondary); padding: 24px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); min-width: 400px;';

    let selectedCatEmoji = '📁';

    dialog.innerHTML = `
      <h3 style="margin: 0 0 16px 0; color: var(--text-primary);">➕ Nouvelle catégorie</h3>
      <input type="text" id="newCategoryName" placeholder="Nom de la catégorie" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-tertiary); color: var(--text-primary); font-size: 14px; margin-bottom: 8px; box-sizing: border-box;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
        <span id="newCategoryEmojiPreview" style="font-size: 28px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px;">📁</span>
        <button id="pickNewCategoryEmojiBtn" class="btn btn-secondary btn-sm" type="button">Choisir un emoji</button>
      </div>
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button id="addCategoryCancelBtn" class="btn btn-secondary">Annuler</button>
        <button id="addCategoryConfirmBtn" class="btn btn-primary">Ajouter</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const nameInput = document.getElementById('newCategoryName');
    nameInput.focus();

    document.getElementById('pickNewCategoryEmojiBtn').addEventListener('click', async () => {
      const emoji = await this.openEmojiPicker(selectedCatEmoji);
      if (emoji) {
        selectedCatEmoji = emoji;
        document.getElementById('newCategoryEmojiPreview').textContent = emoji;
      }
    });

    return new Promise((resolve) => {
      const confirm = () => {
        const name = nameInput.value.trim();
        const emoji = selectedCatEmoji;
        if (name) {
          const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          this.categories.push({ id, name, emoji, locked: false });
          this.saveCategories();
          this.renderCategoryButtons();
          this.renderCategoriesManager();
          this.showNotification('Catégorie ajoutée', 'success');
        }
        document.body.removeChild(overlay);
        resolve();
      };

      const cancel = () => {
        document.body.removeChild(overlay);
        resolve();
      };

      document.getElementById('addCategoryConfirmBtn').addEventListener('click', confirm);
      document.getElementById('addCategoryCancelBtn').addEventListener('click', cancel);
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirm();
        if (e.key === 'Escape') cancel();
      });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cancel();
      });
    });
  },

  async changeCategoryEmoji(categoryId) {
    const category = this.categories.find(c => c.id === categoryId);
    if (!category) return;

    const emoji = await this.openEmojiPicker(category.emoji);
    if (!emoji) return;

    category.emoji = emoji;
    this.saveCategories();
    this.renderCategoryButtons();
    this.renderCategoriesManager();
    this.showNotification('Icône changée', 'success');
  },

  async deleteCategory(categoryId) {
    const category = this.categories.find(c => c.id === categoryId);
    if (!category || category.locked) return;

    const confirmed = await this.showConfirm(`Supprimer la catégorie "${category.name}" ?\n\nTous les widgets de cette catégorie seront déplacés vers "Non catégorisés".`);
    if (!confirmed) return;

    // Déplacer tous les widgets de cette catégorie vers "uncategorized"
    const widgetsToMove = this.widgetManager.widgets.filter(w => w.category === categoryId);
    for (const widget of widgetsToMove) {
      try {
        await this.widgetManager.updateWidget(widget.id, { category: 'uncategorized' });
      } catch (err) {
        console.error(`Failed to move widget ${widget.id}:`, err);
      }
    }

    // Supprimer la catégorie
    this.categories = this.categories.filter(c => c.id !== categoryId);
    this.saveCategories();
    this.renderCategoryButtons();
    this.renderCategoriesManager();

    // Re-render la galerie si on était sur cette catégorie
    const activeBtn = document.querySelector('.widget-category-btn.active');
    if (activeBtn?.dataset.category === categoryId) {
      document.querySelector('.widget-category-btn[data-category="all"]')?.classList.add('active');
      this.widgetManager.renderWidgetsGallery('uncategorized', '');
    } else {
      const category = activeBtn?.dataset.category || 'uncategorized';
      const searchTerm = document.getElementById('widgetSearchInput')?.value || '';
      this.widgetManager.renderWidgetsGallery(category, searchTerm);
    }

    this.showNotification(`Catégorie supprimée, ${widgetsToMove.length} widget(s) déplacé(s)`, 'success');
  },

  // Restaurer un widget depuis la corbeille vers "Autres"
  async restoreFromTrash(widgetId) {
    try {
      await this.widgetManager.updateWidget(widgetId, { category: 'other' });
      this.showNotification('Widget restauré', 'success');
      // Refresh la galerie
      const activeBtn = document.querySelector('.widget-category-btn.active');
      const category = activeBtn?.dataset.category || 'uncategorized';
      const searchTerm = document.getElementById('widgetSearchInput')?.value || '';
      this.widgetManager.renderWidgetsGallery(category, searchTerm);
      this.renderCategoryButtons();
    } catch (err) {
      console.error('Erreur restauration widget:', err);
      this.showNotification('Erreur lors de la restauration', 'error');
    }
  },

  // Vider la corbeille : supprime définitivement tous les widgets dedans
  async emptyTrash() {
    const trashWidgets = this.widgetManager.widgets.filter(w => (w.category || 'other') === 'trash');
    if (trashWidgets.length === 0) return;

    const confirmed = await this.showConfirm(`Supprimer définitivement ${trashWidgets.length} widget${trashWidgets.length > 1 ? 's' : ''} ? Cette action est irréversible.`);
    if (!confirmed) return;

    let deleted = 0;
    for (const widget of trashWidgets) {
      try {
        await this.widgetManager.deleteWidget(widget.id);
        deleted++;
      } catch (err) {
        console.error(`Erreur suppression widget ${widget.id}:`, err);
      }
    }

    this.showNotification(`${deleted} widget${deleted > 1 ? 's' : ''} supprimé${deleted > 1 ? 's' : ''} définitivement`, 'success');
    // Refresh
    const activeBtn = document.querySelector('.widget-category-btn.active');
    const category = activeBtn?.dataset.category || 'uncategorized';
    const searchTerm = document.getElementById('widgetSearchInput')?.value || '';
    this.widgetManager.renderWidgetsGallery(category, searchTerm);
    this.renderCategoryButtons();
  },
});
