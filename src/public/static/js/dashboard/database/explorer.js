/**
 * Dashboard database — explorateur SQL
 * Navigation tables, pagination, édition/ajout/suppression lignes, ALTER TABLE
 * Méthodes : openSqlExplorer, loadExplorerData, renderExplorerTable, escapeHtml,
 *   renderExplorerPagination, explorerPrevPage, explorerNextPage, closeExplorer,
 *   editRow, addNewRow, renderRowForm, saveRow, cancelEditRow, deleteRow,
 *   openEditTableSchema, loadCurrentSchema, initNewColumnsContainer,
 *   addNewColumnToEdit, markColumnForDeletion, saveTableChanges, cancelEditTable,
 *   addPermission
 * Méthodes ajoutées au prototype Dashboard
 */
import { Dashboard } from '../core.js?v=331';

Object.assign(Dashboard.prototype, {
  // === SQL EXPLORER ===

  async openSqlExplorer(tableName) {
    this.currentExplorerTable = tableName;
    this.currentExplorerOffset = 0;

    this.hideAllDatabaseViews();
    document.getElementById('sqlExplorerView').style.display = 'block';
    document.getElementById('explorerTableName').textContent = tableName;

    await this.loadExplorerData();
  },

  async loadExplorerData() {
    if (!this.currentExplorerTable) return;

    try {
      const data = await this.api(
        `/database/tables/${this.currentExplorerTable}/explore?limit=${this.currentExplorerLimit}&offset=${this.currentExplorerOffset}`
      );
      this.currentExplorerData = data;
      this.renderExplorerTable(data);
      this.renderExplorerPagination(data);
    } catch (err) {
      console.error('Failed to load explorer data:', err);
      await this.showAlert('Erreur lors du chargement des données', 'error');
    }
  },

  renderExplorerTable(data) {
    const thead = document.getElementById('explorerTableHead');
    const tbody = document.getElementById('explorerTableBody');

    // Header
    thead.innerHTML = `
      <tr>
        ${data.columns.map(col => `<th>${col}</th>`).join('')}
        <th style="width: 80px;">Actions</th>
      </tr>
    `;

    // Body
    if (data.rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="${data.columns.length + 1}" style="text-align: center; padding: 40px; color: var(--text-muted);">
            Aucune donnée dans cette table
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = data.rows.map((row, idx) => {
      const rowId = row.rowid || row.id || idx;
      return `
        <tr data-rowid="${rowId}">
          ${data.columns.map(col => {
            const value = row[col];
            if (value === null || value === undefined) {
              return `<td class="null-value">NULL</td>`;
            }
            return `<td title="${String(value).replace(/"/g, '&quot;')}">${this.escapeHtml(String(value))}</td>`;
          }).join('')}
          <td>
            <div class="row-actions">
              <button class="btn btn-icon-sm btn-secondary" onclick="dashboard.editRow(${rowId})" title="Modifier">✏️</button>
              <button class="btn btn-icon-sm btn-danger" onclick="dashboard.deleteRow(${rowId})" title="Supprimer">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  renderExplorerPagination(data) {
    const pagination = document.getElementById('explorerPagination');
    const start = data.offset + 1;
    const end = Math.min(data.offset + data.rows.length, data.totalRows);
    const currentPage = Math.floor(data.offset / data.limit) + 1;
    const totalPages = Math.ceil(data.totalRows / data.limit);

    pagination.innerHTML = `
      <div class="pagination-info">
        <span>${start}-${end} sur ${data.totalRows} lignes</span>
        <span>Page ${currentPage}/${totalPages}</span>
      </div>
      <div class="pagination-buttons">
        <button class="btn btn-sm btn-secondary" onclick="dashboard.explorerPrevPage()" ${data.offset === 0 ? 'disabled' : ''}>
          ◀ Précédent
        </button>
        <button class="btn btn-sm btn-secondary" onclick="dashboard.explorerNextPage()" ${!data.hasMore ? 'disabled' : ''}>
          Suivant ▶
        </button>
      </div>
    `;
  },

  explorerPrevPage() {
    if (this.currentExplorerOffset > 0) {
      this.currentExplorerOffset = Math.max(0, this.currentExplorerOffset - this.currentExplorerLimit);
      this.loadExplorerData();
    }
  },

  explorerNextPage() {
    if (this.currentExplorerData?.hasMore) {
      this.currentExplorerOffset += this.currentExplorerLimit;
      this.loadExplorerData();
    }
  },

  closeExplorer() {
    this.hideAllDatabaseViews();
    document.getElementById('permissionsView').style.display = 'block';
    this.currentExplorerTable = null;
  },

  // === ROW EDITING ===

  async editRow(rowId) {
    this.editingRowId = rowId;
    const data = this.currentExplorerData;
    const row = data.rows.find(r => (r.rowid || r.id) == rowId);

    if (!row) {
      await this.showAlert('Ligne non trouvée', 'error');
      return;
    }

    this.hideAllDatabaseViews();
    document.getElementById('editRowView').style.display = 'block';
    document.getElementById('editRowTitle').textContent = '✏️ Modifier la ligne';

    this.renderRowForm(data.columns, row);
  },

  addNewRow() {
    this.editingRowId = null;
    const data = this.currentExplorerData;

    this.hideAllDatabaseViews();
    document.getElementById('editRowView').style.display = 'block';
    document.getElementById('editRowTitle').textContent = '➕ Ajouter une ligne';

    this.renderRowForm(data.columns, {});
  },

  async renderRowForm(columns, row) {
    const container = document.getElementById('rowFormContainer');

    // Get schema for column types
    const schemaRes = await this.api(`/database/schema/${this.currentExplorerTable}`);
    const schema = schemaRes.schema;

    container.innerHTML = columns.map(col => {
      const colSchema = schema.find(s => s.name === col) || {};
      const value = row[col] ?? '';
      const isAutoIncrement = col === 'id' || (colSchema.pk && colSchema.type === 'INTEGER');
      const isReadonly = isAutoIncrement && this.editingRowId !== null;

      return `
        <div class="row-form-field ${isReadonly ? 'readonly' : ''}">
          <label>
            ${col}
            <span class="field-type">${colSchema.type || 'TEXT'}${colSchema.notnull ? ' NOT NULL' : ''}${colSchema.pk ? ' PK' : ''}</span>
          </label>
          <input
            type="${colSchema.type === 'INTEGER' || colSchema.type === 'REAL' ? 'number' : 'text'}"
            name="${col}"
            value="${this.escapeHtml(String(value))}"
            ${isReadonly ? 'readonly' : ''}
            ${colSchema.type === 'REAL' ? 'step="any"' : ''}
          >
        </div>
      `;
    }).join('');
  },

  async saveRow() {
    const container = document.getElementById('rowFormContainer');
    const inputs = container.querySelectorAll('input:not([readonly])');
    const data = {};

    inputs.forEach(input => {
      const value = input.value.trim();
      if (value !== '') {
        // Convert to number if needed
        if (input.type === 'number') {
          data[input.name] = input.step === 'any' ? parseFloat(value) : parseInt(value);
        } else {
          data[input.name] = value;
        }
      }
    });

    try {
      if (this.editingRowId !== null) {
        // Update existing row
        await this.api(`/database/tables/${this.currentExplorerTable}/rows/${this.editingRowId}`, 'PUT', data);
        await this.showAlert('✓ Ligne modifiée', 'success');
      } else {
        // Insert new row
        await this.api(`/database/tables/${this.currentExplorerTable}/rows`, 'POST', data);
        await this.showAlert('✓ Ligne ajoutée', 'success');
      }

      this.cancelEditRow();
      await this.loadExplorerData();
      await this.loadTables(); // Refresh row counts
    } catch (err) {
      console.error('Failed to save row:', err);
      await this.showAlert(`Erreur: ${err.message}`, 'error');
    }
  },

  cancelEditRow() {
    this.editingRowId = null;
    this.hideAllDatabaseViews();
    document.getElementById('sqlExplorerView').style.display = 'block';
  },

  async deleteRow(rowId) {
    if (!(await this.showConfirm('Supprimer cette ligne ?'))) return;

    try {
      await this.api(`/database/tables/${this.currentExplorerTable}/rows/${rowId}`, 'DELETE');
      await this.loadExplorerData();
      await this.loadTables(); // Refresh row counts
    } catch (err) {
      console.error('Failed to delete row:', err);
      await this.showAlert(`Erreur: ${err.message}`, 'error');
    }
  },

  // === TABLE SCHEMA EDITING ===

  async openEditTableSchema() {
    if (!this.currentExplorerTable) return;

    this.currentEditingTable = this.currentExplorerTable;
    this.columnsToAdd = [];
    this.columnsToDelete = [];

    this.hideAllDatabaseViews();
    document.getElementById('editTableView').style.display = 'block';
    document.getElementById('editTableName').textContent = `📊 ${this.currentEditingTable}`;

    await this.loadCurrentSchema();
    this.initNewColumnsContainer();
  },

  async loadCurrentSchema() {
    const container = document.getElementById('currentColumnsContainer');

    try {
      const res = await this.api(`/database/schema/${this.currentEditingTable}`);
      const schema = res.schema;

      container.innerHTML = schema.map(col => `
        <div class="current-column" data-column="${col.name}">
          <div class="current-column-info">
            <span class="current-column-name">${col.name}</span>
            <span class="current-column-type">${col.type}</span>
            <div class="current-column-badges">
              ${col.pk ? '<span class="column-badge pk">PK</span>' : ''}
              ${col.notnull ? '<span class="column-badge notnull">NOT NULL</span>' : ''}
              ${col.dflt_value !== null ? `<span class="column-badge default">= ${col.dflt_value}</span>` : ''}
            </div>
          </div>
          ${!col.pk ? `<button class="btn btn-icon-sm btn-danger" onclick="dashboard.markColumnForDeletion('${col.name}')" title="Supprimer">🗑️</button>` : ''}
        </div>
      `).join('');
    } catch (err) {
      console.error('Failed to load schema:', err);
      container.innerHTML = '<p>Erreur lors du chargement du schéma</p>';
    }
  },

  initNewColumnsContainer() {
    const container = document.getElementById('newColumnsContainer');
    container.innerHTML = '';
  },

  addNewColumnToEdit() {
    const container = document.getElementById('newColumnsContainer');
    this.addColumnRow(container);
  },

  async markColumnForDeletion(columnName) {
    if (!(await this.showConfirm(`Supprimer la colonne "${columnName}" ? Cette action supprimera toutes les données de cette colonne.`))) {
      return;
    }

    this.columnsToDelete.push(columnName);
    const el = document.querySelector(`.current-column[data-column="${columnName}"]`);
    if (el) {
      el.style.opacity = '0.4';
      el.style.textDecoration = 'line-through';
      el.querySelector('button').disabled = true;
    }
  },

  async saveTableChanges() {
    const newColumnsContainer = document.getElementById('newColumnsContainer');
    const rows = newColumnsContainer.querySelectorAll('.column-row');
    const addColumns = [];

    let invalidCol = false;
    for (const row of rows) {
      const name = row.querySelector('.col-name').value.trim();
      const type = row.querySelector('.col-type').value;
      const isNotNull = row.querySelector('.col-notnull').checked;

      if (name) {
        if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
          await this.showAlert(`Nom de colonne invalide: ${name}`);
          invalidCol = true;
          break;
        }
        addColumns.push({
          name,
          type,
          notNull: isNotNull,
          defaultValue: isNotNull ? (type === 'TEXT' ? "''" : '0') : undefined
        });
      }
    }
    if (invalidCol) return;

    if (addColumns.length === 0 && this.columnsToDelete.length === 0) {
      await this.showAlert('Aucune modification à effectuer');
      return;
    }

    try {
      await this.api(`/database/tables/${this.currentEditingTable}`, 'PATCH', {
        addColumns: addColumns.length > 0 ? addColumns : undefined,
        dropColumns: this.columnsToDelete.length > 0 ? this.columnsToDelete : undefined
      });

      await this.showAlert('✓ Table modifiée avec succès', 'success');
      this.cancelEditTable();
      await this.loadTables();
      await this.loadExplorerData();
    } catch (err) {
      console.error('Failed to alter table:', err);
      await this.showAlert(`Erreur: ${err.message}`, 'error');
    }
  },

  cancelEditTable() {
    this.currentEditingTable = null;
    this.columnsToAdd = [];
    this.columnsToDelete = [];
    this.hideAllDatabaseViews();
    document.getElementById('sqlExplorerView').style.display = 'block';
  },

  async addPermission() {
    if (!this.currentTab) return;

    const tableSelect = document.getElementById('permTable');
    const selectCheckbox = document.getElementById('permSelect');
    const insertCheckbox = document.getElementById('permInsert');
    const updateCheckbox = document.getElementById('permUpdate');
    const deleteCheckbox = document.getElementById('permDelete');
    const maxRowsInput = document.getElementById('permMaxRows');

    const table = tableSelect.value;
    if (!table) {
      await this.showAlert('Veuillez sélectionner une table');
      return;
    }

    const actions = [];
    if (selectCheckbox.checked) actions.push('select');
    if (insertCheckbox.checked) actions.push('insert');
    if (updateCheckbox.checked) actions.push('update');
    if (deleteCheckbox.checked) actions.push('delete');

    if (actions.length === 0) {
      await this.showAlert('Veuillez sélectionner au moins une action');
      return;
    }

    const maxRows = parseInt(maxRowsInput.value) || 1000;

    try {
      const permissions = await this.api(`/tabs/${this.currentTab.id}/db-permissions`);

      // Vérifier si la table a déjà une permission
      if (permissions.find(p => p.table === table)) {
        await this.showAlert('Cette table a déjà une permission configurée');
        return;
      }

      permissions.push({ table, actions, maxRows });
      await this.api(`/tabs/${this.currentTab.id}/db-permissions`, 'POST', permissions);

      // Réinitialiser le formulaire
      tableSelect.value = '';
      insertCheckbox.checked = false;
      updateCheckbox.checked = false;
      deleteCheckbox.checked = false;
      maxRowsInput.value = '1000';

      await this.loadPermissions();
      await this.showAlert('Permission ajoutée', 'success');
    } catch (err) {
      console.error('Failed to add permission:', err);
      await this.showAlert('Erreur lors de l\'ajout de la permission', 'error');
    }
  },
});
