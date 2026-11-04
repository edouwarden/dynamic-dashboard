/**
 * Dashboard UI — modales et dialogues
 * openModal, closeModal, safeAddListener, showAlert, showConfirm, showNotification
 * Méthodes : openModal, closeModal, safeAddListener,
 *   showAlert, showConfirm, showNotification, showNotificationWithTitle
 * Méthodes ajoutées au prototype Dashboard
 */
import { Dashboard } from '../core.js?v=331';

Object.assign(Dashboard.prototype, {
  // === MODALS ===

  openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal || !modal.classList.contains('active')) return;
    modal.classList.add('closing');
    setTimeout(() => {
      modal.classList.remove('active', 'closing');
    }, 200);
  },

  // === EVENTS ===

  // Helper pour attacher un event listener en toute sécurité
  safeAddListener(id, event, handler) {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener(event, handler);
      return true;
    } else {
      console.warn(`Element with id "${id}" not found`);
      return false;
    }
  },

  // Méthode de notification simple
  // Modale custom pour remplacer alert() natif
  showAlert(message, type = 'info') {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'custom-dialog-overlay';
      const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
      overlay.innerHTML = `
        <div class="custom-dialog">
          <div class="custom-dialog-body">
            <span class="custom-dialog-icon">${icon}</span>
            <p class="custom-dialog-message">${this.escapeHtml(message)}</p>
          </div>
          <div class="custom-dialog-actions">
            <button class="btn btn-primary custom-dialog-ok">OK</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('visible'));

      const close = () => {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 200);
        resolve();
      };

      overlay.querySelector('.custom-dialog-ok').addEventListener('click', close);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
      overlay.querySelector('.custom-dialog-ok').focus();
    });
  },

  // Modale custom pour remplacer confirm() natif
  showConfirm(message) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'custom-dialog-overlay';
      overlay.innerHTML = `
        <div class="custom-dialog">
          <div class="custom-dialog-body">
            <span class="custom-dialog-icon">⚠️</span>
            <p class="custom-dialog-message">${this.escapeHtml(message)}</p>
          </div>
          <div class="custom-dialog-actions">
            <button class="btn custom-dialog-cancel">Annuler</button>
            <button class="btn btn-primary custom-dialog-confirm">Confirmer</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('visible'));

      const close = (result) => {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 200);
        resolve(result);
      };

      overlay.querySelector('.custom-dialog-confirm').addEventListener('click', () => close(true));
      overlay.querySelector('.custom-dialog-cancel').addEventListener('click', () => close(false));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
      overlay.querySelector('.custom-dialog-confirm').focus();
    });
  },


  showNotification(message, type = 'info', options = {}) {
    return this.notificationManager.show({
      message,
      type,
      ...options
    });
  },

  showNotificationWithTitle(title, message, type = 'info', options = {}) {
    return this.notificationManager.show({
      title,
      message,
      type,
      ...options
    });
  },
});
