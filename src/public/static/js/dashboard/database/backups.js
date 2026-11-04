/**
 * Dashboard database — sauvegardes d'onglets
 * Liste, création, aperçu, restauration et suppression des backups
 * Méthodes : loadBackups, formatDate, createBackup, captureTabScreenshot,
 *   showBackupPreview, hideBackupPreview, restoreBackup, deleteBackup
 * Méthodes ajoutées au prototype Dashboard
 */
import { Dashboard } from '../core.js?v=331';

Object.assign(Dashboard.prototype, {
  async loadBackups() {
    if (!this.currentTab) return;

    const container = document.getElementById('backupsList');

    try {
      const backups = await this.api(`/tabs/${this.currentTab.id}/backups`);

      if (backups.length === 0) {
        container.innerHTML = '<div class="empty-state">Aucune sauvegarde</div>';
        return;
      }

      container.innerHTML = backups.map(backup => {
        // Debug: log backup object
        if (!backup.autoName) {
          console.log('[Backup Debug] Missing autoName:', backup);
        }

        const title = backup.autoName || backup.description || 'Sauvegarde';
        const hasChanges = backup.filesChanged && backup.filesChanged.length > 0;
        const changesInfo = hasChanges ? `${backup.filesChanged.length} fichier(s) modifié(s)` : `${backup.files.length} fichier(s)`;
        const hasScreenshot = backup.screenshot;

        return `
          <div class="backup-item ${backup.source ? `backup-${backup.source}` : ''}" ${hasScreenshot ? `onmouseenter="dashboard.showBackupPreview('${backup.id}', event)" onmouseleave="dashboard.hideBackupPreview()"` : ''}>
            ${hasScreenshot ? `<div class="backup-screenshot-thumb">📸</div>` : ''}
            <div class="backup-info">
              <div class="backup-title">${this.escapeHtml(title)}</div>
              <div class="timestamp">${this.formatDate(backup.timestamp)}</div>
              ${backup.description && !backup.autoName ? `<div class="description">${this.escapeHtml(backup.description)}</div>` : ''}
              <div class="files">${changesInfo}</div>
              ${hasChanges ? `<div class="changes-preview">${backup.filesChanged.join(', ')}</div>` : ''}
            </div>
            <div class="backup-actions">
              <button class="btn btn-sm btn-primary" onclick="dashboard.restoreBackup('${backup.id}')">
                Restaurer
              </button>
              <button class="btn btn-sm btn-danger" onclick="dashboard.deleteBackup('${backup.id}')">
                🗑️
              </button>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load backups:', err);
      container.innerHTML = '<div class="empty-state">Erreur de chargement</div>';
    }
  },

  formatDate(isoString) {
    const date = new Date(isoString);
    const locale = (window.i18n?.getLang?.() || 'fr') === 'en' ? 'en-US' : 'fr-FR';
    return date.toLocaleString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  },

  async createBackup() {
    const description = prompt('Description (optionnel):');

    try {
      // Tenter de capturer un screenshot de l'iframe
      let screenshot = null;
      try {
        screenshot = await this.captureTabScreenshot();
      } catch (err) {
        console.log('[Backup] Screenshot capture failed, continuing without it:', err);
      }

      await this.api(`/tabs/${this.currentTab.id}/backups`, {
        method: 'POST',
        body: JSON.stringify({ description, screenshot }),
      });

      this.loadBackups();
    } catch (err) {
      console.error('Failed to create backup:', err);
      await this.showAlert('Erreur lors de la création du backup', 'error');
    }
  },

  async captureTabScreenshot() {
    const frame = document.getElementById('tabFrame');
    if (!frame || !frame.contentWindow) return null;

    try {
      // Utiliser html2canvas si disponible, sinon skip
      if (typeof html2canvas === 'undefined') {
        return null;
      }

      const canvas = await html2canvas(frame.contentDocument.body, {
        width: 1280,
        height: 720,
        scale: 0.5,
        logging: false,
      });

      return canvas.toDataURL('image/png');
    } catch (err) {
      console.error('[Screenshot] Failed to capture:', err);
      return null;
    }
  },

  showBackupPreview(backupId, event) {
    const preview = document.getElementById('backupPreview');
    if (!preview) {
      // Create preview element if doesn't exist
      const div = document.createElement('div');
      div.id = 'backupPreview';
      div.className = 'backup-preview-popup';
      div.innerHTML = '<img src="" alt="Preview">';
      document.body.appendChild(div);
    }

    const img = document.querySelector('#backupPreview img');
    img.src = `/api/tabs/${this.currentTab.id}/backups/${backupId}/screenshot`;

    const previewEl = document.getElementById('backupPreview');
    previewEl.style.display = 'block';
    previewEl.style.left = event.clientX + 20 + 'px';
    previewEl.style.top = event.clientY + 'px';
  },

  hideBackupPreview() {
    const preview = document.getElementById('backupPreview');
    if (preview) {
      preview.style.display = 'none';
    }
  },

  async restoreBackup(backupId) {
    if (!(await this.showConfirm('Restaurer cette sauvegarde ? Un backup automatique sera créé avant la restauration.'))) {
      return;
    }

    try {
      await this.api(`/tabs/${this.currentTab.id}/backups/${backupId}/restore`, {
        method: 'POST',
      });

      // Recharger l'iframe
      const frame = document.getElementById('tabFrame');
      frame.src = frame.src;

      this.loadBackups();
      await this.showAlert('Restauration effectuée', 'success');
    } catch (err) {
      console.error('Failed to restore backup:', err);
      await this.showAlert('Erreur lors de la restauration', 'error');
    }
  },

  async deleteBackup(backupId) {
    if (!(await this.showConfirm('Supprimer cette sauvegarde ?'))) return;

    try {
      await this.api(`/tabs/${this.currentTab.id}/backups/${backupId}`, {
        method: 'DELETE',
      });

      this.loadBackups();
    } catch (err) {
      console.error('Failed to delete backup:', err);
      await this.showAlert('Erreur lors de la suppression', 'error');
    }
  },
});
