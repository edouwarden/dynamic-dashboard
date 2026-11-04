/**
 * Dashboard widgets — style et presets
 * Thèmes, presets de style, preview live, application CSS
 * Méthodes : loadStylePresets, renderStylePresets, applyStylePreset, openStyleConfigModal,
 *   saveStyleAsPreset, deletePreset, updateStylePreview, saveStyle, refreshWidgetStyles
 * Méthodes ajoutées au prototype Dashboard
 */
import { Dashboard } from '../core.js?v=331';

Object.assign(Dashboard.prototype, {
  // === STYLE CONFIG ===

  async loadStylePresets() {
    try {
      this.stylePresets = await this.api('/presets');
      console.log('[Style] Presets chargés:', this.stylePresets.length);
    } catch (err) {
      console.error('[Style] Erreur lors du chargement des presets:', err);
      this.stylePresets = [];
    }
  },

  renderStylePresets(searchTerm = '') {
    const container = document.getElementById('presetDropdown');
    if (!container) return;

    let filteredPresets = this.stylePresets;

    // Filtrer par recherche
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filteredPresets = filteredPresets.filter(p =>
        p.name.toLowerCase().includes(term)
      );
    }

    // Trier : dark d'abord, puis le reste, custom à la fin
    const order = { dark: 0, colorful: 1, light: 2, minimal: 3, custom: 4 };
    filteredPresets.sort((a, b) => {
      const catA = order[a.category] ?? 4;
      const catB = order[b.category] ?? 4;
      return catA - catB;
    });

    // Générer le HTML en carrousel plat
    const html = filteredPresets.map(preset => {
      const deleteBtn = preset.isDefault ? '' : `<button class="preset-delete-btn" onclick="dashboard.deletePreset('${preset.id}'); event.stopPropagation();" title="Supprimer">&times;</button>`;
      const s = preset.style;

      return `
        <div class="preset-card" onclick="dashboard.applyStylePreset('${preset.id}')">
          <div class="preset-name">${preset.name}</div>
          <div class="preset-swatches">
            <div class="preset-swatch" style="background:${s.colorPrimary}"></div>
            <div class="preset-swatch" style="background:${s.colorSecondary}"></div>
            <div class="preset-swatch" style="background:${s.colorBackground}"></div>
            <div class="preset-swatch" style="background:${s.colorText}"></div>
          </div>
          ${deleteBtn}
        </div>
      `;
    }).join('');

    container.innerHTML = html || '<div style="padding: 12px; text-align: center; color: var(--text-secondary);">Aucun preset trouvé</div>';
  },

  applyStylePreset(presetId) {
    const preset = this.stylePresets.find(p => p.id === presetId);
    if (!preset) return;

    const style = preset.style;

    // Apply to form
    document.getElementById('stylePrimaryColor').value = style.colorPrimary;
    document.getElementById('stylePrimaryColorText').value = style.colorPrimary;
    document.getElementById('styleSecondaryColor').value = style.colorSecondary;
    document.getElementById('styleSecondaryColorText').value = style.colorSecondary;
    document.getElementById('styleBackgroundColor').value = style.colorBackground;
    document.getElementById('styleBackgroundColorText').value = style.colorBackground;
    document.getElementById('styleTextColor').value = style.colorText;
    document.getElementById('styleTextColorText').value = style.colorText;
    document.getElementById('styleFontFamily').value = style.fontFamily;
    document.getElementById('styleBorderStyle').value = style.borderStyle;
    document.getElementById('styleBorderWidth').value = style.borderWidth;
    document.getElementById('styleBorderRadius').value = style.borderRadius;
    document.getElementById('styleShadowStyle').value = style.shadowStyle;

    // Update preview
    this.updateStylePreview();
  },

  async openStyleConfigModal() {
    if (!this.currentTab) return;

    // Render presets
    this.renderStylePresets();

    const style = this.currentTab.style || {};

    document.getElementById('stylePrimaryColor').value = style.colorPrimary || '#3b82f6';
    document.getElementById('stylePrimaryColorText').value = style.colorPrimary || '#3b82f6';
    document.getElementById('styleSecondaryColor').value = style.colorSecondary || '#8b5cf6';
    document.getElementById('styleSecondaryColorText').value = style.colorSecondary || '#8b5cf6';
    document.getElementById('styleBackgroundColor').value = style.colorBackground || '#ffffff';
    document.getElementById('styleBackgroundColorText').value = style.colorBackground || '#ffffff';
    document.getElementById('styleTextColor').value = style.colorText || '#1f2937';
    document.getElementById('styleTextColorText').value = style.colorText || '#1f2937';
    document.getElementById('styleFontFamily').value = style.fontFamily || 'Inter, sans-serif';
    document.getElementById('styleBorderStyle').value = style.borderStyle || 'solid';
    document.getElementById('styleBorderWidth').value = style.borderWidth || '1px';
    document.getElementById('styleBorderRadius').value = style.borderRadius || '8px';
    document.getElementById('styleShadowStyle').value = style.shadowStyle || 'medium';

    // Initialiser le toggle "appliquer au shell"
    const applyToShell = document.getElementById('styleApplyToShell');
    applyToShell.checked = localStorage.getItem('styleApplyToShell') === 'true';

    this.updateStylePreview();
    this.openModal('styleConfigModal');
  },

  async saveStyleAsPreset() {
    const name = prompt('Nom du preset :');
    if (!name) return;

    const style = {
      colorPrimary: document.getElementById('stylePrimaryColor').value,
      colorSecondary: document.getElementById('styleSecondaryColor').value,
      colorBackground: document.getElementById('styleBackgroundColor').value,
      colorText: document.getElementById('styleTextColor').value,
      fontFamily: document.getElementById('styleFontFamily').value,
      borderStyle: document.getElementById('styleBorderStyle').value,
      borderWidth: document.getElementById('styleBorderWidth').value,
      borderRadius: document.getElementById('styleBorderRadius').value,
      shadowStyle: document.getElementById('styleShadowStyle').value
    };

    try {
      await this.api('/presets', {
        method: 'POST',
        body: JSON.stringify({ name, style })
      });

      await this.loadStylePresets();
      this.renderStylePresets();
      this.showNotification('Preset sauvegardé !', 'success');
    } catch (err) {
      await this.showAlert('Erreur lors de la sauvegarde du preset', 'error');
    }
  },

  async deletePreset(id) {
    if (!(await this.showConfirm('Supprimer ce preset ?'))) return;

    try {
      await this.api(`/presets/${id}`, {
        method: 'DELETE'
      });

      await this.loadStylePresets();
      this.renderStylePresets();
      this.showNotification('Preset supprimé', 'success');
    } catch (err) {
      await this.showAlert('Erreur lors de la suppression du preset', 'error');
    }
  },

  updateStylePreview() {
    const preview = document.getElementById('stylePreview');
    if (!preview) return;

    const style = {
      '--color-primary': document.getElementById('stylePrimaryColor').value,
      '--color-secondary': document.getElementById('styleSecondaryColor').value,
      '--color-bg': document.getElementById('styleBackgroundColor').value,
      '--color-text': document.getElementById('styleTextColor').value,
      '--font-family': document.getElementById('styleFontFamily').value,
      '--border-radius': document.getElementById('styleBorderRadius').value,
      '--border-style': document.getElementById('styleBorderStyle').value,
      '--border-width': document.getElementById('styleBorderWidth').value
    };

    Object.entries(style).forEach(([key, value]) => {
      preview.style.setProperty(key, value);
    });

    const card = preview.querySelector('.style-preview-card');
    if (card) {
      const shadowStyle = document.getElementById('styleShadowStyle').value;
      card.className = `style-preview-card shadow-${shadowStyle}`;
    }
  },

  async saveStyle() {
    if (!this.currentTab) return;

    const style = {
      colorPrimary: document.getElementById('stylePrimaryColor').value,
      colorSecondary: document.getElementById('styleSecondaryColor').value,
      colorBackground: document.getElementById('styleBackgroundColor').value,
      colorText: document.getElementById('styleTextColor').value,
      fontFamily: document.getElementById('styleFontFamily').value,
      borderStyle: document.getElementById('styleBorderStyle').value,
      borderWidth: document.getElementById('styleBorderWidth').value,
      borderRadius: document.getElementById('styleBorderRadius').value,
      shadowStyle: document.getElementById('styleShadowStyle').value
    };

    // Sauvegarder le toggle shell
    const applyToShell = document.getElementById('styleApplyToShell').checked;
    localStorage.setItem('styleApplyToShell', applyToShell);

    try {
      await this.api(`/widgets/tabs/${this.currentTab.id}/style`, {
        method: 'PUT',
        body: JSON.stringify(style)
      });

      this.currentTab.style = style;
      this.applyTabStyle(style);

      // Rafraîchir les widgets pour appliquer le nouveau style
      this.refreshWidgetStyles();

      this.closeModal('styleConfigModal');
      this.showNotification('Style sauvegardé', 'success');
    } catch (err) {
      await this.showAlert('Erreur lors de la sauvegarde du style', 'error');
    }
  },

  refreshWidgetStyles() {
    // Rafraîchir toutes les iframes de widgets avec cache-busting
    const iframes = document.querySelectorAll('.widget-iframe');
    iframes.forEach(iframe => {
      const url = new URL(iframe.src);
      url.searchParams.set('_styleRefresh', Date.now());
      iframe.src = url.toString();
    });
  },
});
