/**
 * Dashboard UI — menus contextuels
 * Menus contextuels des onglets et widgets (clic droit)
 * Méthodes : showContextMenu, hideContextMenu, handleContextAction,
 *   showWidgetContextMenu, handleWidgetContextAction
 * Méthodes ajoutées au prototype Dashboard
 */
import { Dashboard } from '../core.js?v=331';

Object.assign(Dashboard.prototype, {
  // === CONTEXT MENU ===

  showContextMenu(event, tab) {
    event.preventDefault();
    this.contextMenuTarget = tab;

    const menu = document.getElementById('contextMenu');
    menu.style.left = `${event.pageX}px`;
    menu.style.top = `${event.pageY}px`;
    menu.classList.add('active');
  },

  hideContextMenu() {
    const menus = [document.getElementById('contextMenu'), document.getElementById('widgetContextMenu')];
    menus.forEach(menu => {
      if (menu && menu.classList.contains('active')) {
        menu.classList.remove('active');
        menu.classList.add('closing');
        setTimeout(() => menu.classList.remove('closing'), 120);
      }
    });
    this.contextMenuTarget = null;
    this.widgetContextMenuTarget = null;
  },

  handleContextAction(action) {
    if (!this.contextMenuTarget) return;

    switch (action) {
      case 'edit-emoji':
      case 'rename':
        this.showEditTabModal(this.contextMenuTarget);
        break;
      case 'settings':
        this.showEditTabModal(this.contextMenuTarget);
        break;
      case 'delete':
        this.deleteTab(this.contextMenuTarget);
        break;
    }

    this.hideContextMenu();
  },

  // Widget context menu
  showWidgetContextMenu(event, widget) {
    event.preventDefault();
    this.widgetContextMenuTarget = widget;

    const menu = document.getElementById('widgetContextMenu');
    menu.style.left = `${event.pageX}px`;
    menu.style.top = `${event.pageY}px`;
    menu.classList.add('active');
  },

  async handleWidgetContextAction(action) {
    if (!this.widgetContextMenuTarget) return;
    const widget = this.widgetContextMenuTarget;

    switch (action) {
      case 'rename':
        await this.renameWidgetQuick(widget);
        break;
      case 'change-emoji':
        await this.changeWidgetEmojiQuick(widget);
        break;
      case 'edit':
        this.openEditWidgetModal(widget.id);
        break;
      case 'clone':
        try {
          const cloned = await this.widgetManager.cloneWidget(widget.id);
          this.widgetManager.renderWidgetsGallery();
          this.showNotification(`Widget "${cloned.name}" créé`, 'success');
        } catch (err) {
          this.showNotification('Erreur lors du clonage', 'error');
        }
        break;
    }

    this.hideContextMenu();
  },
});
