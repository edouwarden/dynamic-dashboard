// NotificationCenter — panneau centralisé des notifications persistées
export class NotificationCenter {
  constructor(dashboard) {
    this.dashboard = dashboard;
    this.panel = document.getElementById('notificationCenterPanel');
    this.badge = document.getElementById('notificationBellBadge');
    this.listEl = document.getElementById('notificationCenterList');
    this.isOpen = false;
    this.notifications = [];
    this.unreadCount = 0;
    this._bindEvents();
  }

  _bindEvents() {
    const bellBtn = document.getElementById('notificationBellBtn');
    if (bellBtn) bellBtn.addEventListener('click', () => this.toggle());

    const markAllBtn = document.getElementById('notifMarkAllReadBtn');
    if (markAllBtn) markAllBtn.addEventListener('click', () => this.markAllRead());

    const clearBtn = document.getElementById('notifClearReadBtn');
    if (clearBtn) clearBtn.addEventListener('click', () => this.clearRead());

    // Fermer si clic hors du panneau
    document.addEventListener('click', (e) => {
      if (!this.isOpen) return;
      const panel = this.panel;
      const bell = document.getElementById('notificationBellBtn');
      if (panel && !panel.contains(e.target) && bell && !bell.contains(e.target)) {
        this.close();
      }
    });
  }

  async load() {
    try {
      const data = await this.dashboard.api('/notifications?limit=50');
      this.notifications = data.notifications || [];
      this.unreadCount = data.unreadCount || 0;
      this._updateBadge();
      if (this.isOpen) this._render();
    } catch (err) {
      console.warn('[NotificationCenter] load error:', err);
    }
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  async open() {
    this.isOpen = true;
    await this.load();
    this._render();
    this.panel?.classList.add('open');
  }

  close() {
    this.isOpen = false;
    this.panel?.classList.remove('open');
  }

  _updateBadge() {
    if (!this.badge) return;
    if (this.unreadCount > 0) {
      this.badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
      this.badge.style.display = 'flex';
    } else {
      this.badge.style.display = 'none';
    }
  }

  _render() {
    if (!this.listEl) return;

    if (this.notifications.length === 0) {
      this.listEl.innerHTML = '<div class="notif-center-empty">Aucune notification</div>';
      return;
    }

    this.listEl.innerHTML = this.notifications.map(n => {
      const time = this._formatTime(n.created_at);
      const icon = n.icon || this._defaultIcon(n.type);
      const unreadClass = n.read ? '' : ' unread';
      const sourceLabel = n.source_name ? `<span class="notif-center-source">${this._escapeHtml(n.source_name)}</span>` : '';
      return `
        <div class="notif-center-item${unreadClass}" data-id="${n.id}">
          <div class="notif-center-icon">${icon}</div>
          <div class="notif-center-body">
            ${n.title ? `<div class="notif-center-title">${this._escapeHtml(n.title)}</div>` : ''}
            <div class="notif-center-msg">${this._escapeHtml(n.message)}</div>
            <div class="notif-center-meta">
              ${sourceLabel}
              <span class="notif-center-time">${time}</span>
            </div>
          </div>
          <button class="notif-center-dismiss" title="Supprimer">×</button>
        </div>
      `;
    }).join('');

    // Bind click events
    for (const item of this.listEl.querySelectorAll('.notif-center-item')) {
      const id = item.dataset.id;

      // Marquer comme lu au clic
      item.addEventListener('click', (e) => {
        if (e.target.closest('.notif-center-dismiss')) return;
        if (item.classList.contains('unread')) {
          this.markRead(id);
          item.classList.remove('unread');
        }
      });

      // Supprimer
      item.querySelector('.notif-center-dismiss')?.addEventListener('click', () => {
        this.deleteNotif(id);
        item.remove();
        this.notifications = this.notifications.filter(n => String(n.id) !== String(id));
        if (this.notifications.length === 0) {
          this.listEl.innerHTML = '<div class="notif-center-empty">Aucune notification</div>';
        }
      });
    }
  }

  async markRead(id) {
    try {
      await this.dashboard.api(`/notifications/${id}/read`, 'PUT');
      this.unreadCount = Math.max(0, this.unreadCount - 1);
      this._updateBadge();
    } catch { /* ignore */ }
  }

  async markAllRead() {
    try {
      await this.dashboard.api('/notifications/read-all', 'PUT');
      this.unreadCount = 0;
      this._updateBadge();
      for (const n of this.notifications) n.read = 1;
      for (const el of this.listEl?.querySelectorAll('.unread') || []) {
        el.classList.remove('unread');
      }
    } catch { /* ignore */ }
  }

  async clearRead() {
    try {
      await this.dashboard.api('/notifications/clear-read', 'DELETE');
      this.notifications = this.notifications.filter(n => !n.read);
      this._render();
    } catch { /* ignore */ }
  }

  async deleteNotif(id) {
    try {
      await this.dashboard.api(`/notifications/${id}`, 'DELETE');
      this.unreadCount = Math.max(0, this.unreadCount - (this.notifications.find(n => String(n.id) === String(id) && !n.read) ? 1 : 0));
      this._updateBadge();
    } catch { /* ignore */ }
  }

  /** Appelé par le polling — ajouter et afficher en temps réel */
  addLive(notif) {
    // Recharger pour avoir les données DB à jour
    this.load();
  }

  _defaultIcon(type) {
    const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌', widget: '📦' };
    return icons[type] || icons.info;
  }

  _formatTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr + (isoStr.endsWith('Z') ? '' : 'Z'));
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'À l\'instant';
    if (diff < 3600000) return `Il y a ${Math.floor(diff / 60000)}min`;
    if (diff < 86400000) return `Il y a ${Math.floor(diff / 3600000)}h`;
    if (diff < 172800000) return 'Hier';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
