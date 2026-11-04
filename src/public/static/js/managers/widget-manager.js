// WidgetManager — CRUD widgets + assignments de tab + backups
export class WidgetManager {
  constructor(dashboard) {
    this.dashboard = dashboard;
    this.widgets = [];
    this.currentWidget = null;
    this.widgetChatHistory = [];
    this.isWidgetProcessing = false;
    this.sessions = [];
    this.activeSessionId = null;
    this.promptQueue = [];     // [{ widgetId, sessionId, message, model, thinking }]
    this.queuePaused = false;  // true quand rate limited
  }

  async loadWidgets() {
    try {
      this.widgets = await this.dashboard.api('/widgets');
    } catch (err) {
      console.error('Failed to load widgets:', err);
    }
  }

  async createWidget(data) {
    try {
      const widget = await this.dashboard.api('/widgets', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      this.widgets.push(widget);
      return widget;
    } catch (err) {
      console.error('Failed to create widget:', err);
      throw err;
    }
  }

  async updateWidget(widgetId, data) {
    try {
      await this.dashboard.api(`/widgets/${widgetId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      const index = this.widgets.findIndex(w => w.id === widgetId);
      if (index !== -1) {
        this.widgets[index] = { ...this.widgets[index], ...data };
      }
    } catch (err) {
      console.error('Failed to update widget:', err);
      throw err;
    }
  }

  async deleteWidget(widgetId) {
    try {
      await this.dashboard.api(`/widgets/${widgetId}`, {
        method: 'DELETE'
      });
      this.widgets = this.widgets.filter(w => w.id !== widgetId);
    } catch (err) {
      console.error('Failed to delete widget:', err);
      throw err;
    }
  }

  async addWidgetToTab(tabId, widgetId, position, config) {
    try {
      const instance = await this.dashboard.api(`/widgets/tabs/${tabId}/widgets`, {
        method: 'POST',
        body: JSON.stringify({ widgetId, position, config })
      });
      return instance;
    } catch (err) {
      console.error('Failed to add widget to tab:', err);
      throw err;
    }
  }

  async removeWidgetFromTab(tabId, instanceId) {
    try {
      await this.dashboard.api(`/widgets/tabs/${tabId}/widgets/${instanceId}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error('Failed to remove widget from tab:', err);
      throw err;
    }
  }

  async updateWidgetPosition(tabId, instanceId, position) {
    try {
      await this.dashboard.api(`/widgets/tabs/${tabId}/widgets/${instanceId}`, {
        method: 'PUT',
        body: JSON.stringify({ position })
      });
    } catch (err) {
      console.error('Failed to update widget position:', err);
      throw err;
    }
  }

  async updateWidgetInstanceConfig(tabId, instanceId, config, widgetId) {
    try {
      await this.dashboard.api(`/widgets/tabs/${tabId}/widgets/${instanceId}`, {
        method: 'PUT',
        body: JSON.stringify({ config, widgetId })
      });
    } catch (err) {
      console.error('Failed to update widget config:', err);
      throw err;
    }
  }

  async cloneWidget(widgetId) {
    const widget = await this.dashboard.api(`/widgets/${widgetId}/clone`, {
      method: 'POST'
    });
    this.widgets.unshift(widget);
    return widget;
  }

  async loadWidgetBackups(widgetId) {
    try {
      return await this.dashboard.api(`/widgets/${widgetId}/backups`);
    } catch (err) {
      console.error('Failed to load widget backups:', err);
      return [];
    }
  }

  async createWidgetBackup(widgetId) {
    try {
      return await this.dashboard.api(`/widgets/${widgetId}/backups`, {
        method: 'POST',
        body: JSON.stringify({})
      });
    } catch (err) {
      console.error('Failed to create widget backup:', err);
      throw err;
    }
  }

  async restoreWidgetBackup(widgetId, backupId) {
    try {
      await this.dashboard.api(`/widgets/${widgetId}/backups/${backupId}/restore`, {
        method: 'POST'
      });
    } catch (err) {
      console.error('Failed to restore widget backup:', err);
      throw err;
    }
  }

  renderWidgetsGallery(category = 'all', searchTerm = '') {
    const gallery = document.getElementById('widgetsGallery');
    if (!gallery) return;

    if (this.widgets.length === 0) {
      gallery.innerHTML = `
        <div class="empty-state" style="text-align: center; padding: 40px;">
          <p>Aucun widget créé</p>
          <button class="btn btn-primary" onclick="dashboard.openModal('createWidgetModal')">
            🔧 Créer votre premier widget
          </button>
        </div>
      `;
      return;
    }

    // Filtrer les widgets
    let filteredWidgets = this.widgets;
    const isTrash = category === 'trash';

    // Filtre par catégorie ("all" exclut la corbeille)
    if (category === 'all') {
      filteredWidgets = filteredWidgets.filter(w => (w.category || 'uncategorized') !== 'trash');
    } else {
      filteredWidgets = filteredWidgets.filter(w => (w.category || 'uncategorized') === category);
    }

    // Filtre par recherche
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filteredWidgets = filteredWidgets.filter(w =>
        w.name.toLowerCase().includes(term) ||
        (w.description && w.description.toLowerCase().includes(term))
      );
    }

    if (filteredWidgets.length === 0) {
      gallery.innerHTML = `
        <div class="empty-state" style="text-align: center; padding: 40px;">
          <p>${isTrash ? 'La corbeille est vide' : 'Aucun widget trouvé'}</p>
        </div>
      `;
      return;
    }

    // Header corbeille avec bouton "Vider"
    const trashHeader = isTrash ? `
      <div class="trash-header">
        <span>🗑️ ${filteredWidgets.length} widget${filteredWidgets.length > 1 ? 's' : ''} dans la corbeille</span>
        <button class="btn btn-danger btn-sm" onclick="dashboard.emptyTrash()">Vider la corbeille</button>
      </div>
    ` : '';

    // Générer le HTML
    const html = trashHeader + filteredWidgets.map(w => isTrash ? `
      <div class="widget-card widget-card-trash" draggable="true" data-widget-id="${w.id}">
        <div class="widget-card-header">
          <span class="widget-emoji">${w.emoji || '📦'}</span>
          <button class="btn-icon widget-edit-btn" onclick="event.stopPropagation(); dashboard.restoreFromTrash('${w.id}')" title="Restaurer">♻️</button>
        </div>
        <h3>${this.dashboard.escapeHtml(w.name)}</h3>
        ${w.description ? `<p class="widget-description">${this.dashboard.escapeHtml(w.description)}</p>` : ''}
      </div>
    ` : `
      <div class="widget-card" draggable="true" data-widget-id="${w.id}" onclick="dashboard.selectWidgetToAdd('${w.id}')">
        <div class="widget-card-header">
          <span class="widget-emoji">${w.emoji || '📦'}</span>
          <button class="btn-icon widget-edit-btn" onclick="event.stopPropagation(); dashboard.openEditWidgetModal('${w.id}')" title="Éditer le widget">✏️</button>
        </div>
        <h3>${this.dashboard.escapeHtml(w.name)}</h3>
        ${w.description ? `<p class="widget-description">${this.dashboard.escapeHtml(w.description)}</p>` : ''}
        ${w.dbPermissions && w.dbPermissions.length > 0 ? `<div class="widget-meta"><span>🔒 ${w.dbPermissions.length} DB</span></div>` : ''}
      </div>
    `).join('');

    gallery.innerHTML = html;

    // Drag & drop pour changer de catégorie
    gallery.querySelectorAll('.widget-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.dataset.widgetId);
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('widget-card-dragging');
        document.querySelectorAll('.widget-category-btn:not([data-category="all"])').forEach(btn => {
          btn.classList.add('category-drop-target');
        });
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('widget-card-dragging');
        document.querySelectorAll('.widget-category-btn').forEach(btn => {
          btn.classList.remove('category-drop-target', 'category-drag-over');
        });
      });

      // Menu contextuel
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const widgetId = card.dataset.widgetId;
        const widget = this.widgets.find(w => w.id === widgetId);
        if (widget) {
          this.dashboard.showWidgetContextMenu(e, widget);
        }
      });
    });
  }
}
