/**
 * Dashboard widgets — permissions et gestion des tables
 * Permissions DB, schémas, création/édition de tables et lignes
 * Méthodes : loadWidgetPermissionsEditor, updatePermissionsSummary, loadWidgetTablesList,
 *   toggleWidgetTableAssignment, deleteWidgetTable, showWidgetView, viewWidgetTable,
 *   deleteWidgetTableRow, editWidgetTableSchema, renderWidgetColumnsBuilder,
 *   updateWidgetColumn, removeWidgetColumn, createWidgetTable,
 *   renderWidgetNewColumnsBuilder, updateWidgetNewColumn, removeWidgetNewColumn,
 *   saveWidgetTableChanges, showWidgetAddRowForm, saveWidgetRow,
 *   loadWidgetSettings, removeWidgetPermission, addWidgetPermission,
 *   addWidgetPermissionEditor, loadAvailableTables
 * Méthodes ajoutées au prototype Dashboard
 */
import { Dashboard } from '../core.js?v=331';

Object.assign(Dashboard.prototype, {
  // === WIDGET DATABASE MANAGEMENT ===

  async loadWidgetPermissionsEditor() {
    if (!this.widgetManager.currentWidget) return;

    // Load auto-approve options
    const autoApproveCreate = this.widgetManager.currentWidget.autoApproveCreateTable || false;
    const autoApproveAlter = this.widgetManager.currentWidget.autoApproveAlterTable || false;

    const createCheckbox = document.getElementById('widgetAutoApproveCreateTable');
    const alterCheckbox = document.getElementById('widgetAutoApproveAlterTable');
    if (createCheckbox) createCheckbox.checked = autoApproveCreate;
    if (alterCheckbox) alterCheckbox.checked = autoApproveAlter;

    // Load tables list
    await this.loadWidgetTablesList();

    // Update permissions summary
    this.updatePermissionsSummary();

    // Reset views
    this.showWidgetView('widgetPermissionsView');
  },

  updatePermissionsSummary() {
    const summary = document.getElementById('widgetPermissionsSummary');
    if (!summary || !this.widgetManager.currentWidget) return;

    const perms = this.widgetManager.currentWidget.dbPermissions || [];

    if (perms.length === 0) {
      summary.innerHTML = `
        <div class="wt-summary-empty">
          <span style="font-size: 24px;">📭</span>
          <p>Aucune table assignée à ce widget.</p>
          <p style="font-size: 12px; color: var(--text-secondary);">Assignez des tables depuis la liste à gauche pour qu'OpenCode puisse y accéder.</p>
        </div>
      `;
      return;
    }

    summary.innerHTML = `
      <div class="wt-summary-stats">
        <div class="wt-stat">
          <span class="wt-stat-value">${perms.length}</span>
          <span class="wt-stat-label">table${perms.length > 1 ? 's' : ''} assignée${perms.length > 1 ? 's' : ''}</span>
        </div>
      </div>
      <div class="wt-assigned-list">
        ${perms.map(p => `
          <div class="wt-assigned-item">
            <span class="wt-assigned-name">🔗 ${this.escapeHtml(p.table)}</span>
            <span class="wt-assigned-actions">${p.actions.map(a => `<span class="wt-action-badge">${a}</span>`).join('')}</span>
          </div>
        `).join('')}
      </div>
    `;
  },

  async loadWidgetTablesList() {
    if (!this.widgetManager.currentWidget) {
      console.log('[Widget Tables] No current widget');
      return;
    }

    try {
      const res = await this.api('/database/tables');
      const tablesDiv = document.getElementById('widgetTablesList');

      if (!tablesDiv) return;

      const assignedTables = this.widgetManager.currentWidget.dbPermissions?.map(p => p.table) || [];

      if (!res.tables || res.tables.length === 0) {
        tablesDiv.innerHTML = `
          <div class="empty-state">
            <p>Aucune table disponible</p>
            <p style="font-size: 13px; color: var(--text-secondary); margin-top: 8px;">
              Créez votre première table avec le bouton ci-dessus
            </p>
          </div>
        `;
        return;
      }

      // Grouper : assignées / disponibles (avec données) / vides (non assignées)
      const assigned = [];
      const available = [];
      const empty = [];

      for (const table of res.tables) {
        const isAssigned = assignedTables.includes(table.name);
        if (isAssigned) {
          assigned.push(table);
        } else if (table.rowCount > 0) {
          available.push(table);
        } else {
          empty.push(table);
        }
      }

      // Tri alphabétique dans chaque groupe
      const byName = (a, b) => a.name.localeCompare(b.name);
      assigned.sort(byName);
      available.sort(byName);
      empty.sort(byName);

      const renderCard = (table) => {
        const isAssigned = assignedTables.includes(table.name);
        const colCount = table.columns ? table.columns.length : 0;
        const colNames = table.columns ? table.columns.map(c => c.name).join(', ') : '';

        return `
          <div class="wt-card ${isAssigned ? 'wt-card-assigned' : ''}" data-table="${this.escapeHtml(table.name)}">
            <div class="wt-card-main">
              <button class="wt-assign-btn ${isAssigned ? 'assigned' : ''}"
                      onclick="event.stopPropagation(); dashboard.toggleWidgetTableAssignment('${this.escapeHtml(table.name)}', ${!isAssigned})"
                      title="${isAssigned ? 'Retirer du widget' : 'Assigner au widget'}">
                ${isAssigned ? '✓' : '+'}
              </button>
              <div class="wt-card-info" onclick="${isAssigned ? `dashboard.viewWidgetTable('${this.escapeHtml(table.name)}')` : `dashboard.toggleWidgetTableAssignment('${this.escapeHtml(table.name)}', true)`}">
                <div class="wt-card-title">
                  <span class="wt-table-icon">${isAssigned ? '🔗' : '📊'}</span>
                  <strong>${this.escapeHtml(table.name)}</strong>
                </div>
                <div class="wt-card-meta">
                  <span>${table.rowCount} ligne${table.rowCount !== 1 ? 's' : ''}</span>
                  <span>•</span>
                  <span>${colCount} colonne${colCount !== 1 ? 's' : ''}</span>
                </div>
                ${colCount > 0 ? `<div class="wt-card-cols" title="${this.escapeHtml(colNames)}">${table.columns.map(c => `<span class="wt-col-tag${c.pk ? ' pk' : ''}">${this.escapeHtml(c.name)}<small>${c.type}</small></span>`).join('')}</div>` : ''}
              </div>
            </div>
            <div class="wt-card-actions">
              ${isAssigned ? `
                <button class="btn btn-xs btn-ghost" onclick="event.stopPropagation(); dashboard.viewWidgetTable('${this.escapeHtml(table.name)}')" title="Explorer les données">👁️</button>
                <button class="btn btn-xs btn-ghost" onclick="event.stopPropagation(); dashboard.editWidgetTableSchema('${this.escapeHtml(table.name)}')" title="Modifier le schéma">⚙️</button>
                <button class="btn btn-xs btn-ghost-danger" onclick="event.stopPropagation(); dashboard.toggleWidgetTableAssignment('${this.escapeHtml(table.name)}', false)" title="Retirer du widget">✕</button>
              ` : ''}
              <button class="btn btn-xs btn-ghost-danger" onclick="event.stopPropagation(); dashboard.deleteWidgetTable('${this.escapeHtml(table.name)}')" title="Supprimer la table">🗑️</button>
            </div>
          </div>
        `;
      };

      const renderGroup = (label, icon, tables, collapsedByDefault = false) => {
        if (tables.length === 0) return '';
        const groupId = `wt-group-${label.replace(/\s+/g, '-').toLowerCase()}`;
        return `
          <div class="wt-group">
            <button class="wt-group-header ${collapsedByDefault ? 'collapsed' : ''}" onclick="this.classList.toggle('collapsed'); document.getElementById('${groupId}').classList.toggle('wt-group-hidden')">
              <span class="wt-group-icon">${icon}</span>
              <span class="wt-group-label">${label}</span>
              <span class="wt-group-count">${tables.length}</span>
              <span class="wt-group-chevron">▾</span>
            </button>
            <div id="${groupId}" class="wt-group-body ${collapsedByDefault ? 'wt-group-hidden' : ''}">
              ${tables.map(renderCard).join('')}
            </div>
          </div>
        `;
      };

      tablesDiv.innerHTML =
        renderGroup('Assignées', '🔗', assigned) +
        renderGroup('Disponibles', '📊', available) +
        renderGroup('Tables vides', '📭', empty, true);

    } catch (error) {
      console.error('[Widget Tables] Error:', error);
      const tablesDiv = document.getElementById('widgetTablesList');
      if (tablesDiv) {
        tablesDiv.innerHTML = `
          <div class="empty-state">
            <p style="color: red;">Erreur lors du chargement des tables</p>
            <p style="font-size: 13px;">${error.message}</p>
          </div>
        `;
      }
    }
  },

  async toggleWidgetTableAssignment(tableName, assign) {
    if (!this.widgetManager.currentWidget) {
      console.error('[Toggle Assignment] No current widget');
      return;
    }

    console.log('[Toggle Assignment]', { tableName, assign });

    const permissions = this.widgetManager.currentWidget.dbPermissions || [];

    if (assign) {
      // Vérifier si déjà assignée
      if (permissions.some(p => p.table === tableName)) {
        console.log('[Toggle Assignment] Table already assigned');
        return;
      }

      permissions.push({
        table: tableName,
        actions: ['select', 'insert', 'update', 'delete']
      });
    } else {
      const index = permissions.findIndex(p => p.table === tableName);
      if (index !== -1) {
        permissions.splice(index, 1);
      } else {
        console.log('[Toggle Assignment] Table not found in permissions');
      }
    }

    console.log('[Toggle Assignment] New permissions:', permissions);

    this.widgetManager.currentWidget.dbPermissions = permissions;

    try {
      await this.widgetManager.updateWidget(this.widgetManager.currentWidget.id, {
        dbPermissions: permissions
      });

      await this.loadWidgetTablesList();
      this.updatePermissionsSummary();
      this.showNotification(assign ? 'Table assignée au widget' : 'Table retirée du widget', 'success');
    } catch (error) {
      console.error('[Toggle Assignment] Error updating widget:', error);
      await this.showAlert('Erreur lors de la mise à jour: ' + error.message, 'error');
    }
  },

  async deleteWidgetTable(tableName) {
    if (!(await this.showConfirm(`Supprimer définitivement la table "${tableName}" et toutes ses données ?\n\nCette action est irréversible.`))) {
      return;
    }

    try {
      await this.api(`/database/tables/${tableName}`, 'DELETE');

      // Also remove from widget permissions if assigned
      if (this.widgetManager.currentWidget) {
        const permissions = this.widgetManager.currentWidget.dbPermissions || [];
        const index = permissions.findIndex(p => p.table === tableName);
        if (index !== -1) {
          permissions.splice(index, 1);
          this.widgetManager.currentWidget.dbPermissions = permissions;
          await this.widgetManager.updateWidget(this.widgetManager.currentWidget.id, {
            dbPermissions: permissions
          });
        }
      }

      await this.loadWidgetTablesList();
      this.updatePermissionsSummary();
      this.showNotification(`Table "${tableName}" supprimée`, 'success');
    } catch (error) {
      this.showNotification('Erreur: ' + error.message, 'error');
    }
  },

  showWidgetView(viewId) {
    ['widgetPermissionsView', 'widgetCreateTableView', 'widgetSqlExplorerView',
     'widgetEditTableView', 'widgetEditRowView'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    const view = document.getElementById(viewId);
    if (view) view.style.display = 'block';
  },

  async viewWidgetTable(tableName) {
    this.currentWidgetTable = tableName;
    const span = document.getElementById('widgetExplorerTableName');
    if (span) span.textContent = tableName;

    try {
      const res = await this.api(`/database/tables/${tableName}/explore?limit=50&offset=0`);
      const thead = document.getElementById('widgetExplorerTableHead');
      const tbody = document.getElementById('widgetExplorerTableBody');

      // Use columns from schema if available, or from rows
      const columns = res.columns || (res.rows && res.rows.length > 0 ? Object.keys(res.rows[0]) : []);

      if (!res.rows || res.rows.length === 0) {
        thead.innerHTML = columns.length > 0
          ? `<tr>${columns.map(col => `<th>${this.escapeHtml(col)}</th>`).join('')}<th></th></tr>`
          : '';
        tbody.innerHTML = `<tr><td colspan="${columns.length || 1}" style="padding: 40px; text-align: center; color: var(--text-secondary);">Aucune donnée dans cette table</td></tr>`;
        this.showWidgetView('widgetSqlExplorerView');
        return;
      }

      thead.innerHTML = `<tr>${columns.map(col => `<th>${this.escapeHtml(col)}</th>`).join('')}<th style="width: 70px;">Actions</th></tr>`;
      tbody.innerHTML = res.rows.map(row => {
        const rowId = row.id || row.rowid || '';
        return `
        <tr>
          ${columns.map(col => `<td>${this.escapeHtml(String(row[col] !== null && row[col] !== undefined ? row[col] : 'NULL'))}</td>`).join('')}
          <td>
            <button class="btn btn-xs btn-ghost-danger" onclick="dashboard.deleteWidgetTableRow('${this.escapeHtml(tableName)}', '${rowId}')" title="Supprimer">🗑️</button>
          </td>
        </tr>`;
      }).join('');

      // Pagination info
      const pagination = document.getElementById('widgetExplorerPagination');
      if (pagination) {
        pagination.innerHTML = `<span style="font-size: 13px; color: var(--text-secondary);">${res.totalRows} ligne${res.totalRows !== 1 ? 's' : ''} au total</span>`;
      }

      this.showWidgetView('widgetSqlExplorerView');
    } catch (error) {
      console.error('[Explorer] Error:', error);
      this.showNotification('Erreur lors du chargement des données', 'error');
    }
  },

  async deleteWidgetTableRow(tableName, rowId) {
    if (!rowId) return;
    if (!(await this.showConfirm(`Supprimer la ligne ${rowId} ?`))) return;

    try {
      await this.api(`/database/tables/${tableName}/rows/${rowId}`, 'DELETE');
      this.showNotification('Ligne supprimée', 'success');
      await this.viewWidgetTable(tableName);
    } catch (error) {
      this.showNotification('Erreur: ' + error.message, 'error');
    }
  },

  async editWidgetTableSchema(tableName) {
    this.currentWidgetTable = tableName;
    const nameDiv = document.getElementById('widgetEditTableName');
    if (nameDiv) nameDiv.innerHTML = `<strong>📊 ${this.escapeHtml(tableName)}</strong>`;

    try {
      const res = await this.api(`/database/schema/${tableName}`);
      const container = document.getElementById('widgetCurrentColumnsContainer');
      if (container) {
        container.innerHTML = res.schema.map(col => `
          <div class="wt-schema-row">
            <span class="wt-schema-name">${this.escapeHtml(col.name)}</span>
            <span class="wt-schema-type">${col.type}</span>
            ${col.pk ? '<span class="wt-schema-badge pk">PK</span>' : ''}
            ${col.notnull ? '<span class="wt-schema-badge nn">NOT NULL</span>' : ''}
            ${col.dflt_value !== null ? `<span class="wt-schema-badge def">= ${col.dflt_value}</span>` : ''}
          </div>
        `).join('');
      }

      // Reset new columns
      this.widgetNewColumnsData = [];
      this.renderWidgetNewColumnsBuilder();

      this.showWidgetView('widgetEditTableView');
    } catch (error) {
      this.showNotification('Erreur: ' + error.message, 'error');
    }
  },

  renderWidgetColumnsBuilder() {
    const container = document.getElementById('widgetColumnsContainer');
    if (!container) return;

    if (!this.widgetColumnsData) this.widgetColumnsData = [];

    if (this.widgetColumnsData.length === 0) {
      container.innerHTML = '<div class="empty-state">Aucune colonne. Cliquez sur "+ Ajouter une colonne"</div>';
      return;
    }

    container.innerHTML = this.widgetColumnsData.map((col, index) => `
      <div class="column-row">
        <input type="text" placeholder="Nom" value="${col.name || ''}" onchange="dashboard.updateWidgetColumn(${index}, 'name', this.value)" class="form-input-sm">
        <select onchange="dashboard.updateWidgetColumn(${index}, 'type', this.value)" class="form-input-sm">
          ${['TEXT', 'INTEGER', 'REAL', 'BLOB'].map(t => `<option value="${t}" ${col.type === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
        <label><input type="checkbox" ${col.primaryKey ? 'checked' : ''} onchange="dashboard.updateWidgetColumn(${index}, 'primaryKey', this.checked)"> PK</label>
        <label><input type="checkbox" ${col.notNull ? 'checked' : ''} onchange="dashboard.updateWidgetColumn(${index}, 'notNull', this.checked)"> NOT NULL</label>
        <button class="btn-icon" onclick="dashboard.removeWidgetColumn(${index})">×</button>
      </div>
    `).join('');
  },

  updateWidgetColumn(index, field, value) {
    if (!this.widgetColumnsData) this.widgetColumnsData = [];
    if (!this.widgetColumnsData[index]) this.widgetColumnsData[index] = {};
    this.widgetColumnsData[index][field] = value;
  },

  removeWidgetColumn(index) {
    if (!this.widgetColumnsData) return;
    this.widgetColumnsData.splice(index, 1);
    this.renderWidgetColumnsBuilder();
  },

  async createWidgetTable() {
    const nameInput = document.getElementById('widgetNewTableName');
    const name = nameInput.value.trim();

    if (!name) {
      await this.showAlert('Le nom de la table est requis');
      return;
    }

    if (!this.widgetColumnsData || this.widgetColumnsData.length === 0) {
      await this.showAlert('Ajoutez au moins une colonne');
      return;
    }

    const schema = this.widgetColumnsData.map(col => ({
      name: col.name,
      type: col.type || 'TEXT',
      ...(col.primaryKey ? { primaryKey: true, autoIncrement: true } : {}),
      ...(col.notNull ? { notNull: true } : {})
    }));

    try {
      await this.api('/database/tables', 'POST', { name, schema });

      // Assigner automatiquement si la checkbox est cochée
      const assignCheckbox = document.getElementById('widgetAssignTableAfterCreate');
      if (assignCheckbox && assignCheckbox.checked) {
        await this.toggleWidgetTableAssignment(name, true);
      }

      nameInput.value = '';
      this.widgetColumnsData = [];
      await this.loadWidgetTablesList();
      this.showWidgetView('widgetPermissionsView');
      this.showNotification('Table créée', 'success');
    } catch (err) {
      await this.showAlert(`Erreur: ${err.message || 'Erreur inconnue'}`, 'error');
    }
  },

  // === WIDGET TABLE EDITING ===

  renderWidgetNewColumnsBuilder() {
    const container = document.getElementById('widgetNewColumnsContainer');
    if (!container) return;

    if (!this.widgetNewColumnsData) this.widgetNewColumnsData = [];

    if (this.widgetNewColumnsData.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding: 12px; font-size: 13px;">Cliquez sur "+ Ajouter une colonne" pour ajouter des colonnes</div>';
      return;
    }

    container.innerHTML = this.widgetNewColumnsData.map((col, index) => `
      <div class="column-row">
        <input type="text" placeholder="Nom" value="${col.name || ''}" onchange="dashboard.updateWidgetNewColumn(${index}, 'name', this.value)" class="form-input-sm">
        <select onchange="dashboard.updateWidgetNewColumn(${index}, 'type', this.value)" class="form-input-sm">
          ${['TEXT', 'INTEGER', 'REAL', 'BLOB'].map(t => `<option value="${t}" ${col.type === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
        <label><input type="checkbox" ${col.notNull ? 'checked' : ''} onchange="dashboard.updateWidgetNewColumn(${index}, 'notNull', this.checked)"> NOT NULL</label>
        <button class="btn-icon" onclick="dashboard.removeWidgetNewColumn(${index})">×</button>
      </div>
    `).join('');
  },

  updateWidgetNewColumn(index, field, value) {
    if (!this.widgetNewColumnsData) this.widgetNewColumnsData = [];
    if (!this.widgetNewColumnsData[index]) this.widgetNewColumnsData[index] = {};
    this.widgetNewColumnsData[index][field] = value;
  },

  removeWidgetNewColumn(index) {
    if (!this.widgetNewColumnsData) return;
    this.widgetNewColumnsData.splice(index, 1);
    this.renderWidgetNewColumnsBuilder();
  },

  async saveWidgetTableChanges() {
    if (!this.currentWidgetTable) return;

    const newCols = (this.widgetNewColumnsData || []).filter(c => c.name && c.name.trim());
    if (newCols.length === 0) {
      this.showNotification('Aucune nouvelle colonne à ajouter', 'error');
      return;
    }

    try {
      await this.api(`/database/tables/${this.currentWidgetTable}`, 'PATCH', {
        addColumns: newCols.map(c => ({
          name: c.name.trim(),
          type: c.type || 'TEXT',
          notNull: c.notNull || false
        }))
      });

      this.showNotification('Table modifiée', 'success');
      this.widgetNewColumnsData = [];
      await this.loadWidgetTablesList();
      this.showWidgetView('widgetPermissionsView');
    } catch (error) {
      this.showNotification('Erreur: ' + error.message, 'error');
    }
  },

  async showWidgetAddRowForm() {
    if (!this.currentWidgetTable) return;

    try {
      const res = await this.api(`/database/schema/${this.currentWidgetTable}`);
      const container = document.getElementById('widgetRowFormContainer');
      const title = document.getElementById('widgetEditRowTitle');
      if (title) title.textContent = `➕ Ajouter une ligne dans ${this.currentWidgetTable}`;

      if (container) {
        container.innerHTML = res.schema
          .filter(col => !col.pk) // Skip auto-increment PK
          .map(col => `
            <div class="form-group" style="margin-bottom: 12px;">
              <label style="font-weight: 600; font-size: 13px;">${this.escapeHtml(col.name)} <small style="color: var(--text-secondary);">(${col.type})</small></label>
              <input type="text" class="form-input-sm" data-column="${this.escapeHtml(col.name)}" placeholder="${col.notnull ? 'Requis' : 'Optionnel'}">
            </div>
          `).join('');
      }

      this.showWidgetView('widgetEditRowView');
    } catch (error) {
      this.showNotification('Erreur: ' + error.message, 'error');
    }
  },

  async saveWidgetRow() {
    if (!this.currentWidgetTable) return;

    const container = document.getElementById('widgetRowFormContainer');
    if (!container) return;

    const data = {};
    container.querySelectorAll('input[data-column]').forEach(input => {
      const value = input.value.trim();
      if (value) {
        data[input.dataset.column] = value;
      }
    });

    if (Object.keys(data).length === 0) {
      this.showNotification('Remplissez au moins un champ', 'error');
      return;
    }

    try {
      await this.api(`/database/tables/${this.currentWidgetTable}/rows`, 'POST', data);
      this.showNotification('Ligne ajoutée', 'success');
      await this.viewWidgetTable(this.currentWidgetTable);
    } catch (error) {
      this.showNotification('Erreur: ' + error.message, 'error');
    }
  },

  // === WIDGET SETTINGS ===

  loadWidgetSettings() {
    if (!this.widgetManager.currentWidget) return;

    const w = this.widgetManager.currentWidget;
    document.getElementById('editWidgetName').value = w.name;
    document.getElementById('editWidgetEmoji').value = w.emoji || '📊';
    document.getElementById('editWidgetEmojiPreview').textContent = w.emoji || '📊';
    document.getElementById('editWidgetDescription').value = w.description || '';
    document.getElementById('editWidgetCategory').value = w.category || 'uncategorized';
    document.getElementById('editWidgetCanSendGlobalNotifications').checked = w.canSendGlobalNotifications || false;
    document.getElementById('editWidgetCanSendTabNotifications').checked = w.canSendTabNotifications || false;
  },

  removeWidgetPermission(index) {
    this.widgetPermissions.splice(index, 1);
    this.renderWidgetPermissionsBuilder();
  },

  async addWidgetPermission() {
    // Charger les tables disponibles (pour info)
    const tables = await this.loadAvailableTables();
    const tablesInfo = tables.length > 0
      ? `Tables existantes:\n${tables.join(', ')}\n\n`
      : 'Aucune table existante.\n\n';

    // Créer un form simple pour sélectionner les permissions
    const tableName = prompt(`${tablesInfo}Nom de la table (peut être créée plus tard par OpenCode):`);
    if (!tableName || !tableName.trim()) {
      return;
    }

    // Demander les actions
    const actionsStr = prompt('Actions autorisées (séparez par des virgules):\nExemple: select, insert, update, delete', 'select');
    if (!actionsStr) return;

    const actions = actionsStr.split(',').map(a => a.trim().toLowerCase()).filter(a =>
      ['select', 'insert', 'update', 'delete'].includes(a)
    );

    if (actions.length === 0) {
      await this.showAlert('Au moins une action valide requise (select, insert, update, delete)');
      return;
    }

    // Demander colonnes (optionnel)
    const columnsStr = prompt('Colonnes spécifiques (optionnel, laisser vide pour toutes):', '');
    const columns = columnsStr ? columnsStr.split(',').map(c => c.trim()).filter(c => c) : undefined;

    // Demander limite (optionnel)
    const maxRowsStr = prompt('Limite de lignes (optionnel, laisser vide pour aucune limite):', '');
    const maxRows = maxRowsStr ? parseInt(maxRowsStr) : undefined;

    // Ajouter la permission
    const permission = {
      table: tableName,
      actions,
      ...(columns && columns.length > 0 ? { columns } : {}),
      ...(maxRows ? { maxRows } : {})
    };

    this.widgetPermissions.push(permission);
    this.renderWidgetPermissionsBuilder();
    this.showNotification('Permission ajoutée', 'success');
  },

  async addWidgetPermissionEditor() {
    if (!this.widgetManager.currentWidget) return;

    // Charger les tables disponibles (pour info)
    const tables = await this.loadAvailableTables();
    const tablesInfo = tables.length > 0
      ? `Tables existantes:\n${tables.join(', ')}\n\n`
      : 'Aucune table existante.\n\n';

    // Créer un form simple pour sélectionner les permissions
    const tableName = prompt(`${tablesInfo}Nom de la table (peut être créée plus tard par OpenCode):`);
    if (!tableName || !tableName.trim()) {
      return;
    }

    // Demander les actions
    const actionsStr = prompt('Actions autorisées (séparez par des virgules):\nExemple: select, insert, update, delete', 'select');
    if (!actionsStr) return;

    const actions = actionsStr.split(',').map(a => a.trim().toLowerCase()).filter(a =>
      ['select', 'insert', 'update', 'delete'].includes(a)
    );

    if (actions.length === 0) {
      await this.showAlert('Au moins une action valide requise (select, insert, update, delete)');
      return;
    }

    // Demander colonnes (optionnel)
    const columnsStr = prompt('Colonnes spécifiques (optionnel, laisser vide pour toutes):', '');
    const columns = columnsStr ? columnsStr.split(',').map(c => c.trim()).filter(c => c) : undefined;

    // Demander limite (optionnel)
    const maxRowsStr = prompt('Limite de lignes (optionnel, laisser vide pour aucune limite):', '');
    const maxRows = maxRowsStr ? parseInt(maxRowsStr) : undefined;

    // Ajouter la permission
    const permission = {
      table: tableName,
      actions,
      ...(columns && columns.length > 0 ? { columns } : {}),
      ...(maxRows ? { maxRows } : {})
    };

    const permissions = this.widgetManager.currentWidget.dbPermissions || [];
    permissions.push(permission);
    this.widgetManager.currentWidget.dbPermissions = permissions;

    // Sauvegarder immédiatement
    await this.widgetManager.updateWidget(this.widgetManager.currentWidget.id, {
      dbPermissions: permissions
    });

    this.loadWidgetPermissionsEditor();
    this.showNotification('Permission ajoutée', 'success');
  },

  async loadAvailableTables() {
    try {
      const res = await this.api('/database/tables');
      return res.tables.map(t => typeof t === 'string' ? t : t.name);
    } catch (err) {
      console.error('Failed to load tables:', err);
      return [];
    }
  },
});
