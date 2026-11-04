/**
 * Dashboard widgets — configuration d'instance
 * Config des valeurs par instance (fixes vs variables d'onglet)
 * Méthodes : openWidgetInstanceConfig, renderConfigFieldInput, toggleConfigFieldMode, saveWidgetInstanceConfig
 * Méthodes ajoutées au prototype Dashboard
 */
import { Dashboard } from '../core.js?v=331';

Object.assign(Dashboard.prototype, {
  // === WIDGET INSTANCE CONFIG ===

  async openWidgetInstanceConfig(instanceId) {
    if (!this.currentTab) return;

    // Trouver l'instance dans le tab courant (root + pages)
    let inst = (this.currentTab.widgets || []).find(w => w.id === instanceId);
    if (!inst && this.currentTab.pages) {
      for (const page of this.currentTab.pages) {
        inst = (page.widgets || []).find(w => w.id === instanceId);
        if (inst) break;
      }
    }
    if (!inst) {
      console.error('[Config] Instance introuvable:', instanceId);
      return;
    }

    // Trouver la définition du widget (pour configSchema)
    const widgetDef = this.widgetManager.widgets.find(w => w.id === inst.widgetId);
    if (!widgetDef) {
      console.error('[Config] Widget définition introuvable:', inst.widgetId);
      return;
    }

    // Stocker pour la sauvegarde
    this._configEditInstanceId = instanceId;
    this._configEditWidgetId = inst.widgetId;

    // Header du modal
    document.getElementById('instanceConfigEmoji').textContent = widgetDef.emoji || '🧩';
    document.getElementById('instanceConfigName').textContent = widgetDef.name;
    document.getElementById('instanceConfigDesc').textContent = widgetDef.description || '';

    const fieldsContainer = document.getElementById('instanceConfigFields');
    const emptyMsg = document.getElementById('instanceConfigEmpty');
    const schema = widgetDef.configSchema;

    // Pas de configSchema → message vide
    if (!schema || Object.keys(schema).length === 0) {
      fieldsContainer.style.display = 'none';
      emptyMsg.style.display = 'block';
      this.openModal('widgetInstanceConfigModal');
      return;
    }

    fieldsContainer.style.display = 'block';
    emptyMsg.style.display = 'none';

    // Variables d'onglet disponibles
    const tabVars = Object.keys(this.currentTab.variables || {});

    // Générer les champs
    const currentConfig = inst.config || {};
    fieldsContainer.innerHTML = Object.entries(schema).map(([key, field]) => {
      const currentVal = currentConfig[key];
      const isVarRef = typeof currentVal === 'string' && currentVal.startsWith('$var:');
      const staticVal = isVarRef ? (field.default ?? '') : (currentVal ?? field.default ?? '');
      const varName = isVarRef ? currentVal.replace('$var:', '') : '';

      return `
        <div class="instance-config-field" data-key="${key}">
          <div class="instance-config-field-header">
            <label>${this.escapeHtml(field.label || key)}</label>
            ${field.description ? `<span class="instance-config-field-desc">${this.escapeHtml(field.description)}</span>` : ''}
          </div>
          <div class="instance-config-mode-toggle">
            <button class="btn btn-sm ${!isVarRef ? 'active' : ''}" data-mode="static" onclick="dashboard.toggleConfigFieldMode(this, '${key}')">Valeur fixe</button>
            <button class="btn btn-sm ${isVarRef ? 'active' : ''}" data-mode="variable" onclick="dashboard.toggleConfigFieldMode(this, '${key}')" ${tabVars.length === 0 ? 'disabled title="Aucune variable d\'onglet"' : ''}>Variable d'onglet</button>
          </div>
          <div class="instance-config-input-static" style="display: ${!isVarRef ? 'block' : 'none'};">
            ${this.renderConfigFieldInput(key, field, staticVal)}
          </div>
          <div class="instance-config-input-variable" style="display: ${isVarRef ? 'block' : 'none'};">
            <select class="form-input" data-key="${key}-var">
              <option value="">-- Choisir une variable --</option>
              ${tabVars.map(v => `<option value="${v}" ${v === varName ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </div>
        </div>
      `;
    }).join('');

    this.openModal('widgetInstanceConfigModal');
  },

  renderConfigFieldInput(key, field, value) {
    const escaped = typeof value === 'string' ? this.escapeHtml(value) : value;
    switch (field.type) {
      case 'boolean':
        return `<label class="instance-config-checkbox"><input type="checkbox" data-key="${key}-val" ${value ? 'checked' : ''}> ${field.label || key}</label>`;
      case 'number':
        return `<input type="number" class="form-input" data-key="${key}-val" value="${escaped ?? ''}">`;
      case 'select':
        return `<select class="form-input" data-key="${key}-val">
          ${(field.options || []).map(opt => `<option value="${opt}" ${opt === String(value) ? 'selected' : ''}>${opt}</option>`).join('')}
        </select>`;
      default: // string
        return `<input type="text" class="form-input" data-key="${key}-val" value="${escaped ?? ''}">`;
    }
  },

  toggleConfigFieldMode(btn, key) {
    const field = btn.closest('.instance-config-field');
    const mode = btn.dataset.mode;

    // Toggle boutons actifs
    field.querySelectorAll('.instance-config-mode-toggle .btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Toggle inputs
    field.querySelector('.instance-config-input-static').style.display = mode === 'static' ? 'block' : 'none';
    field.querySelector('.instance-config-input-variable').style.display = mode === 'variable' ? 'block' : 'none';
  },

  async saveWidgetInstanceConfig() {
    if (!this._configEditInstanceId || !this.currentTab) return;

    const fieldsContainer = document.getElementById('instanceConfigFields');
    const fields = fieldsContainer.querySelectorAll('.instance-config-field');
    const config = {};

    fields.forEach(field => {
      const key = field.dataset.key;
      const activeMode = field.querySelector('.instance-config-mode-toggle .btn.active')?.dataset.mode || 'static';

      if (activeMode === 'variable') {
        const varSelect = field.querySelector(`[data-key="${key}-var"]`);
        const varName = varSelect?.value;
        if (varName) {
          config[key] = `$var:${varName}`;
        }
      } else {
        const input = field.querySelector(`[data-key="${key}-val"]`);
        if (!input) return;
        if (input.type === 'checkbox') {
          config[key] = input.checked;
        } else if (input.type === 'number') {
          config[key] = input.value !== '' ? Number(input.value) : null;
        } else {
          config[key] = input.value;
        }
      }
    });

    try {
      // Sauvegarder via API (passer widgetId pour enrichir la config avec les defaults)
      await this.widgetManager.updateWidgetInstanceConfig(this.currentTab.id, this._configEditInstanceId, config, this._configEditWidgetId);

      // Mettre à jour localement (root + pages)
      const instId = this._configEditInstanceId;
      const updateInst = (widgets) => {
        const w = (widgets || []).find(w => w.id === instId);
        if (w) w.config = config;
      };
      updateInst(this.currentTab.widgets);
      if (this.currentTab.pages) {
        for (const page of this.currentTab.pages) {
          updateInst(page.widgets);
        }
      }

      // Recharger l'iframe de cette instance
      const wrapper = document.querySelector(`[data-instance-id="${this._configEditInstanceId}"]`);
      if (wrapper) {
        const iframe = wrapper.querySelector('iframe');
        if (iframe) {
          const url = new URL(iframe.src);
          url.searchParams.set('config', JSON.stringify(config));
          iframe.src = url.toString();
        }
      }

      this.closeModal('widgetInstanceConfigModal');
      this.showNotification('Configuration enregistrée', 'success');
    } catch (err) {
      console.error('[Config] Erreur sauvegarde:', err);
      await this.showAlert('Erreur lors de la sauvegarde', 'error');
    }
  },
});
