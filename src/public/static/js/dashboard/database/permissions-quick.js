/**
 * Dashboard database — sélection rapide de permissions
 * selectTable() et addPermissionQuick() pour le flow rapide
 * Méthodes : selectTable, addPermissionQuick
 * Méthodes ajoutées au prototype Dashboard
 */
import { Dashboard } from '../core.js?v=331';

Object.assign(Dashboard.prototype, {
  async selectTable(tableName) {
    if (!this.currentTab) {
      await this.showAlert('Veuillez d\'abord sélectionner un onglet dans la sidebar');
      return;
    }

    // Show a modal/prompt to add permission for this table
    const actions = [];
    if (await this.showConfirm(`Donner accès à la table "${tableName}" pour l'onglet "${this.currentTab.name}" ?\n\nCliquez OK pour continuer la configuration.`)) {
      // Quick permission setup
      const read = await this.showConfirm('Autoriser la LECTURE (SELECT) ?');
      if (read) actions.push('select');

      const write = await this.showConfirm('Autoriser l\'ÉCRITURE (INSERT) ?');
      if (write) actions.push('insert');

      const modify = await this.showConfirm('Autoriser la MODIFICATION (UPDATE) ?');
      if (modify) actions.push('update');

      const remove = await this.showConfirm('Autoriser la SUPPRESSION (DELETE) ?');
      if (remove) actions.push('delete');

      if (actions.length === 0) {
        await this.showAlert('Aucune permission sélectionnée');
        return;
      }

      this.addPermissionQuick(tableName, actions);
    }
  },

  async addPermissionQuick(table, actions) {
    if (!this.currentTab) return;

    try {
      const permissions = await this.api(`/tabs/${this.currentTab.id}/db-permissions`);

      // Check if permission already exists
      const existingIdx = permissions.findIndex(p => p.table === table);
      if (existingIdx >= 0) {
        permissions[existingIdx] = { table, actions, maxRows: 1000 };
      } else {
        permissions.push({ table, actions, maxRows: 1000 });
      }

      await this.api(`/tabs/${this.currentTab.id}/db-permissions`, 'POST', permissions);
      await this.loadPermissions();
      await this.showAlert('✓ Permission ajoutée', 'success');
    } catch (err) {
      console.error('Failed to add permission:', err);
      await this.showAlert('Erreur lors de l\'ajout de la permission', 'error');
    }
  },
});
