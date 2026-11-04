/**
 * Dashboard database — création de table
 * Formulaire de création : column builder, validation, createTable()
 * Méthodes : showCreateTableForm, hideCreateTableForm, hideAllDatabaseViews,
 *   initColumnBuilder, addColumnRow, buildSchemaFromColumns, createTable
 * Méthodes ajoutées au prototype Dashboard
 */
import { Dashboard } from '../core.js?v=331';

Object.assign(Dashboard.prototype, {
  showCreateTableForm() {
    this.hideAllDatabaseViews();
    document.getElementById('createTableView').style.display = 'block';
    // Initialize with one empty column row
    this.initColumnBuilder();
  },

  hideCreateTableForm() {
    document.getElementById('createTableView').style.display = 'none';
    document.getElementById('permissionsView').style.display = 'block';
  },

  hideAllDatabaseViews() {
    document.getElementById('permissionsView').style.display = 'none';
    document.getElementById('createTableView').style.display = 'none';
    document.getElementById('sqlExplorerView').style.display = 'none';
    document.getElementById('editTableView').style.display = 'none';
    document.getElementById('editRowView').style.display = 'none';
  },

  // Column Builder for table creation
  initColumnBuilder() {
    const container = document.getElementById('columnsContainer');
    container.innerHTML = '';
    // Add default ID column
    this.addColumnRow(container, { name: 'id', type: 'INTEGER', pk: true, autoincrement: true });
    // Add one empty column
    this.addColumnRow(container);
  },

  addColumnRow(container, defaults = {}) {
    const row = document.createElement('div');
    row.className = 'column-row';
    row.innerHTML = `
      <input type="text" class="col-name" placeholder="nom_colonne" value="${defaults.name || ''}">
      <select class="col-type">
        <option value="TEXT" ${defaults.type === 'TEXT' ? 'selected' : ''}>TEXT</option>
        <option value="INTEGER" ${defaults.type === 'INTEGER' ? 'selected' : ''}>INTEGER</option>
        <option value="REAL" ${defaults.type === 'REAL' ? 'selected' : ''}>REAL</option>
        <option value="BLOB" ${defaults.type === 'BLOB' ? 'selected' : ''}>BLOB</option>
        <option value="DATETIME" ${defaults.type === 'DATETIME' ? 'selected' : ''}>DATETIME</option>
        <option value="BOOLEAN" ${defaults.type === 'BOOLEAN' ? 'selected' : ''}>BOOLEAN</option>
      </select>
      <div class="column-options">
        <label class="column-option">
          <input type="checkbox" class="col-pk" ${defaults.pk ? 'checked' : ''}> PK
        </label>
        <label class="column-option">
          <input type="checkbox" class="col-notnull" ${defaults.notnull ? 'checked' : ''}> NOT NULL
        </label>
        <label class="column-option">
          <input type="checkbox" class="col-autoincrement" ${defaults.autoincrement ? 'checked' : ''}> AUTO
        </label>
      </div>
      <button type="button" class="column-remove" onclick="this.closest('.column-row').remove()">×</button>
    `;
    container.appendChild(row);
  },

  buildSchemaFromColumns() {
    const container = document.getElementById('columnsContainer');
    const rows = container.querySelectorAll('.column-row');
    const columns = [];

    rows.forEach(row => {
      const name = row.querySelector('.col-name').value.trim();
      const type = row.querySelector('.col-type').value;
      const isPk = row.querySelector('.col-pk').checked;
      const isNotNull = row.querySelector('.col-notnull').checked;
      const isAutoincrement = row.querySelector('.col-autoincrement').checked;

      if (name) {
        let def = `${name} ${type}`;
        if (isPk) def += ' PRIMARY KEY';
        if (isAutoincrement && type === 'INTEGER') def += ' AUTOINCREMENT';
        if (isNotNull && !isPk) def += ' NOT NULL';
        columns.push(def);
      }
    });

    return columns.join(', ');
  },

  async createTable() {
    const nameInput = document.getElementById('newTableName');
    const name = nameInput.value.trim();

    // Build schema from column builder
    const schema = this.buildSchemaFromColumns();

    if (!name) {
      await this.showAlert('Veuillez entrer un nom de table');
      return;
    }

    if (!schema) {
      await this.showAlert('Veuillez ajouter au moins une colonne');
      return;
    }

    // Valider le nom de la table
    if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
      await this.showAlert('Nom de table invalide. Utilisez uniquement des lettres minuscules, chiffres et underscores.');
      return;
    }

    try {
      await this.api('/database/tables', 'POST', { name, schema });
      await this.showAlert('✓ Table créée avec succès', 'success');
      nameInput.value = '';
      await this.loadTables();
      this.hideCreateTableForm();
    } catch (err) {
      console.error('Failed to create table:', err);
      await this.showAlert(`Erreur lors de la création: ${err.message || 'Erreur inconnue'}`, 'error');
    }
  },
});
