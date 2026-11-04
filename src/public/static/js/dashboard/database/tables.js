/**
 * Dashboard database — tables, permissions et proposals
 * Modal DB, liste des tables, permissions, proposals CREATE/ALTER
 * Méthodes : showDatabaseModal, loadTables, loadPermissions, viewTableSchema, deleteTable,
 *   removePermission, loadAutoCreateConfig, toggleAutoCreate, toggleAutoModify,
 *   loadTableProposals, approveProposal, rejectProposal,
 *   loadTableModificationProposals, approveModificationProposal, rejectModificationProposal
 * Méthodes ajoutées au prototype Dashboard
 */
import { Dashboard } from '../core.js?v=331';

Object.assign(Dashboard.prototype, {
  // === DATABASE ===

  async showDatabaseModal() {
    try {
      // Reset UI - hide all views except permissions
      document.getElementById('permissionsView').style.display = 'block';
      document.getElementById('createTableView').style.display = 'none';
      document.getElementById('sqlExplorerView').style.display = 'none';
      document.getElementById('editTableView').style.display = 'none';
      document.getElementById('editRowView').style.display = 'none';

      // Load tables
      await this.loadTables();

      this.openModal('databaseModal');
    } catch (error) {
      console.error('[ERROR] Error in showDatabaseModal:', error);
      await this.showAlert('Erreur lors de l\'ouverture du modal: ' + error.message, 'error');
    }
  },

  async loadTables() {
    try {
      const res = await this.api('/database/tables');
      const tablesDiv = document.getElementById('tablesList');

      if (!res.tables || res.tables.length === 0) {
        tablesDiv.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📊</div>
            <p>Aucune table dans la base de données</p>
            <p style="font-size: 12px; color: var(--text-muted);">Cliquez sur "+ Nouvelle table" pour commencer</p>
          </div>`;
        return;
      }

      // Get stats for each table
      const tablesWithStats = await Promise.all(
        res.tables.map(async (table) => {
          try {
            const stats = await this.api(`/database/tables/${table}/stats`);
            return { name: table, rowCount: stats.stats?.rowCount || 0 };
          } catch {
            return { name: table, rowCount: '?' };
          }
        })
      );

      tablesDiv.innerHTML = tablesWithStats.map(({ name, rowCount }) => `
        <div class="db-table-card" onclick="dashboard.selectTable('${name}')">
          <div class="db-table-card-header">
            <div class="db-table-name">📊 ${name}</div>
            <div class="db-table-actions" onclick="event.stopPropagation()">
              <button class="btn btn-icon-sm btn-primary" onclick="dashboard.openSqlExplorer('${name}')" title="Explorer les données">
                🔍
              </button>
              <button class="btn btn-icon-sm btn-secondary" onclick="dashboard.viewTableSchema('${name}')" title="Voir le schéma">
                👁️
              </button>
              <button class="btn btn-icon-sm btn-danger" onclick="dashboard.deleteTable('${name}')" title="Supprimer">
                🗑️
              </button>
            </div>
          </div>
          <div class="db-table-info">
            <span class="db-table-badge">${rowCount} lignes</span>
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.error('Failed to load tables:', err);
      await this.showAlert('Erreur lors du chargement des tables', 'error');
    }
  },

  async loadPermissions() {
    const permissionsDiv = document.getElementById('permissionsList');

    if (!this.currentTab) {
      permissionsDiv.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔐</div>
          <p>Aucun onglet sélectionné</p>
          <p style="font-size: 12px; color: var(--text-muted);">Sélectionnez un onglet dans la sidebar pour gérer ses permissions</p>
        </div>`;
      return;
    }

    try {
      const permissions = await this.api(`/tabs/${this.currentTab.id}/db-permissions`);

      if (!permissions || permissions.length === 0) {
        permissionsDiv.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🔓</div>
            <p>Aucune permission configurée</p>
            <p style="font-size: 12px; color: var(--text-muted);">Cliquez sur une table à gauche pour lui donner accès</p>
          </div>`;
        return;
      }

      permissionsDiv.innerHTML = permissions.map((perm, idx) => `
        <div class="permission-card">
          <div class="permission-card-header">
            <div class="permission-card-title">📊 ${perm.table}</div>
            <button class="btn btn-icon-sm btn-danger" onclick="dashboard.removePermission(${idx})" title="Supprimer">
              🗑️
            </button>
          </div>
          <div class="permission-badges">
            ${perm.actions.map(action => `
              <span class="permission-badge ${action}">${action}</span>
            `).join('')}
          </div>
          <div style="margin-top: 8px; font-size: 12px; color: var(--text-secondary);">
            ${perm.columns ? `Colonnes: ${perm.columns.join(', ')}` : 'Toutes les colonnes'} •
            Max ${perm.maxRows || 1000} lignes
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.error('Failed to load permissions:', err);
    }
  },

  async viewTableSchema(tableName) {
    try {
      const res = await this.api(`/database/schema/${tableName}`);
      const schema = res.schema.map(col =>
        `${col.name} ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.pk ? ' PRIMARY KEY' : ''}`
      ).join('\n');
      await this.showAlert(`Schéma de ${tableName}:\n\n${schema}`);
    } catch (err) {
      console.error('Failed to get schema:', err);
      await this.showAlert('Erreur lors de la récupération du schéma', 'error');
    }
  },

  async deleteTable(tableName) {
    if (!(await this.showConfirm(`Supprimer la table "${tableName}" ?\n\nCette action est irréversible et supprimera toutes les données.`))) {
      return;
    }

    try {
      await this.api(`/database/tables/${tableName}`, 'DELETE');
      await this.loadTables();
      await this.showAlert('Table supprimée', 'success');
    } catch (err) {
      console.error('Failed to delete table:', err);
      await this.showAlert('Erreur lors de la suppression', 'error');
    }
  },

  async removePermission(index) {
    if (!this.currentTab) return;

    try {
      const permissions = await this.api(`/tabs/${this.currentTab.id}/db-permissions`);
      permissions.splice(index, 1);
      await this.api(`/tabs/${this.currentTab.id}/db-permissions`, 'POST', permissions);
      await this.loadPermissions();
    } catch (err) {
      console.error('Failed to remove permission:', err);
      await this.showAlert('Erreur lors de la suppression', 'error');
    }
  },

  // === AUTO-CREATE TABLES === (Legacy - removed with tab permissions)

  async loadAutoCreateConfig() {
    // No longer used - widgets have their own permissions
  },

  async toggleAutoCreate() {
    // Legacy - no longer used
  },

  async toggleAutoModify() {
    // Legacy - no longer used

    try {
      await this.api(`/tabs/${this.currentTab.id}/db-auto-modify`, {
        method: 'POST',
        body: JSON.stringify({ enabled })
      });

      await this.loadAutoCreateConfig();

      if (enabled) {
        await this.showAlert('✓ Modification automatique de tables activée\n\nOpenCode pourra ajouter/supprimer des colonnes dans les tables existantes.', 'success');
      } else {
        await this.showAlert('✓ Modification automatique désactivée', 'success');
      }
    } catch (err) {
      console.error('Failed to toggle auto-modify:', err);
      await this.showAlert('Erreur: ' + err.message, 'error');
      // Remettre à l'état précédent
      checkbox.checked = !enabled;
    }
  },

  // === TABLE PROPOSALS ===

  async loadTableProposals() {
    if (!this.currentTab) return;

    try {
      const proposals = await this.api(`/tabs/${this.currentTab.id}/table-proposals`);

      const section = document.getElementById('proposalsSection');
      const listDiv = document.getElementById('proposalsList');

      if (!proposals || proposals.length === 0) {
        section.style.display = 'none';
        return;
      }

      section.style.display = 'block';

      listDiv.innerHTML = proposals.map(proposal => `
        <div class="proposal-card">
          <div class="proposal-header">
            <div class="proposal-title">📋 ${this.escapeHtml(proposal.name)}</div>
            <div class="proposal-actions">
              <button class="btn btn-sm btn-primary" onclick="dashboard.approveProposal('${proposal.id}')">
                ✓ Approuver
              </button>
              <button class="btn btn-sm btn-secondary" onclick="dashboard.rejectProposal('${proposal.id}')">
                ✗ Refuser
              </button>
            </div>
          </div>
          <div class="proposal-reason">${this.escapeHtml(proposal.reason || 'Aucune raison fournie')}</div>
          <div class="proposal-schema">
            <strong>Schéma:</strong>
            <code>${this.escapeHtml(proposal.schema)}</code>
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.error('Failed to load proposals:', err);
    }
  },

  async approveProposal(proposalId) {
    if (!this.currentTab) return;

    if (!(await this.showConfirm('Créer cette table et lui donner les permissions complètes ?'))) {
      return;
    }

    try {
      await this.api(`/tabs/${this.currentTab.id}/table-proposals/${proposalId}/approve`, {
        method: 'POST'
      });

      await this.showAlert('✓ Table créée avec succès', 'success');
      await this.loadTables();
      await this.loadPermissions();
      await this.loadTableProposals();
    } catch (err) {
      console.error('Failed to approve proposal:', err);
      await this.showAlert('Erreur: ' + err.message, 'error');
    }
  },

  async rejectProposal(proposalId) {
    if (!this.currentTab) return;

    if (!(await this.showConfirm('Refuser cette proposition de table ?'))) {
      return;
    }

    try {
      await this.api(`/tabs/${this.currentTab.id}/table-proposals/${proposalId}`, {
        method: 'DELETE'
      });

      await this.showAlert('✓ Proposition refusée', 'success');
      await this.loadTableProposals();
    } catch (err) {
      console.error('Failed to reject proposal:', err);
      await this.showAlert('Erreur: ' + err.message, 'error');
    }
  },

  // === TABLE MODIFICATION PROPOSALS ===

  async loadTableModificationProposals() {
    if (!this.currentTab) return;

    try {
      const proposals = await this.api(`/tabs/${this.currentTab.id}/table-modification-proposals`);

      const section = document.getElementById('modificationProposalsSection');
      const listDiv = document.getElementById('modificationProposalsList');

      if (!proposals || proposals.length === 0) {
        section.style.display = 'none';
        return;
      }

      section.style.display = 'block';

      listDiv.innerHTML = proposals.map(proposal => {
        const changes = [];
        if (proposal.addColumns && proposal.addColumns.length > 0) {
          changes.push(`+ Ajouter: ${proposal.addColumns.map(c => `${c.name} (${c.type})`).join(', ')}`);
        }
        if (proposal.dropColumns && proposal.dropColumns.length > 0) {
          changes.push(`- Supprimer: ${proposal.dropColumns.join(', ')}`);
        }

        return `
          <div class="proposal-card">
            <div class="proposal-header">
              <div class="proposal-title">✏️ ${this.escapeHtml(proposal.tableName)}</div>
              <div class="proposal-actions">
                <button class="btn btn-sm btn-primary" onclick="dashboard.approveModificationProposal('${proposal.id}')">
                  ✓ Approuver
                </button>
                <button class="btn btn-sm btn-secondary" onclick="dashboard.rejectModificationProposal('${proposal.id}')">
                  ✗ Refuser
                </button>
              </div>
            </div>
            <div class="proposal-reason">${this.escapeHtml(proposal.reason || 'Aucune raison fournie')}</div>
            <div class="proposal-schema">
              <strong>Modifications:</strong>
              ${changes.map(c => `<div>${this.escapeHtml(c)}</div>`).join('')}
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load modification proposals:', err);
    }
  },

  async approveModificationProposal(proposalId) {
    if (!this.currentTab) return;

    if (!(await this.showConfirm('Appliquer cette modification à la table ?'))) {
      return;
    }

    try {
      await this.api(`/tabs/${this.currentTab.id}/table-modification-proposals/${proposalId}/approve`, {
        method: 'POST'
      });

      await this.showAlert('✓ Table modifiée avec succès', 'success');
      await this.loadTables();
      await this.loadPermissions();
      await this.loadTableModificationProposals();
    } catch (err) {
      console.error('Failed to approve modification proposal:', err);
      await this.showAlert('Erreur: ' + err.message, 'error');
    }
  },

  async rejectModificationProposal(proposalId) {
    if (!this.currentTab) return;

    if (!(await this.showConfirm('Refuser cette proposition de modification ?'))) {
      return;
    }

    try {
      await this.api(`/tabs/${this.currentTab.id}/table-modification-proposals/${proposalId}`, {
        method: 'DELETE'
      });

      await this.showAlert('✓ Proposition refusée', 'success');
      await this.loadTableModificationProposals();
    } catch (err) {
      console.error('Failed to reject modification proposal:', err);
      await this.showAlert('Erreur: ' + err.message, 'error');
    }
  },
});
