// NotificationManager — gestion des toasts (scoped global/tab)
export class NotificationManager {
  constructor() {
    this.globalContainer = document.getElementById('notificationContainer');
    this.tabContainer = document.getElementById('tabNotificationContainer');
    this.notifications = [];
    this.nextId = 1;
  }

  show(options) {
    const {
      title = '',
      message = '',
      type = 'info', // info, success, warning, error, widget
      duration = 5000,
      icon = this.getDefaultIcon(type),
      closable = true,
      scope = 'global' // 'global' ou 'tab'
    } = options;

    const container = scope === 'tab' ? this.tabContainer : this.globalContainer;
    if (!container) {
      console.warn(`[Notification] Container for scope "${scope}" not found`);
      return null;
    }

    const id = this.nextId++;
    const toast = document.createElement('div');
    toast.className = `notification-toast ${type}`;
    toast.dataset.id = id;
    toast.dataset.scope = scope;

    toast.innerHTML = `
      <div class="notification-toast-icon">${icon}</div>
      <div class="notification-toast-content">
        ${title ? `<div class="notification-toast-title">${this.escapeHtml(title)}</div>` : ''}
        ${message ? `<div class="notification-toast-message">${this.escapeHtml(message)}</div>` : ''}
      </div>
      ${closable ? '<button class="notification-toast-close">×</button>' : ''}
      ${duration > 0 ? `<div class="notification-toast-progress" style="animation-duration: ${duration}ms;"></div>` : ''}
    `;

    container.appendChild(toast);
    this.notifications.push({ id, toast, timeout: null, scope });

    // Close button
    if (closable) {
      const closeBtn = toast.querySelector('.notification-toast-close');
      closeBtn.addEventListener('click', () => this.hide(id));
    }

    // Auto-hide
    if (duration > 0) {
      const notification = this.notifications.find(n => n.id === id);
      notification.timeout = setTimeout(() => this.hide(id), duration);
    }

    return id;
  }

  // Alias pour les notifications d'onglet
  showTab(options) {
    return this.show({ ...options, scope: 'tab' });
  }

  // Alias pour les notifications globales
  showGlobal(options) {
    return this.show({ ...options, scope: 'global' });
  }

  hide(id) {
    const notification = this.notifications.find(n => n.id === id);
    if (!notification) return;

    if (notification.timeout) {
      clearTimeout(notification.timeout);
    }

    notification.toast.classList.add('hiding');
    setTimeout(() => {
      if (notification.toast.parentNode) {
        notification.toast.remove();
      }
      this.notifications = this.notifications.filter(n => n.id !== id);
    }, 300);
  }

  hideAll() {
    this.notifications.forEach(n => this.hide(n.id));
  }

  // Cacher toutes les notifications d'un scope spécifique
  hideByScope(scope) {
    const toHide = this.notifications.filter(n => n.scope === scope);
    toHide.forEach(n => this.hide(n.id));
  }

  // Cacher toutes les notifications d'onglet
  hideTabNotifications() {
    this.hideByScope('tab');
  }

  getDefaultIcon(type) {
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      widget: '📦'
    };
    return icons[type] || icons.info;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
