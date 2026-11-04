/**
 * Dashboard UI — édition rapide et sélecteur emoji
 * Renommer/changer emoji des widgets inline ; picker universel
 * Méthodes : renameWidgetQuick, changeWidgetEmojiQuick, openEmojiPicker
 * Méthodes ajoutées au prototype Dashboard
 */
import { Dashboard } from '../core.js?v=331';

// Cache pour les emojis chargés
let emojiDatabase = null;

async function loadEmojiDatabase() {
  if (emojiDatabase) return emojiDatabase;

  const response = await fetch('/static/data/emojis.json?v=229');
  emojiDatabase = await response.json();
  return emojiDatabase;
}

Object.assign(Dashboard.prototype, {
  async renameWidgetQuick(widget) {
    const overlay = document.createElement('div');
    overlay.className = 'custom-dialog-overlay';
    overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,1); display: flex; align-items: center; justify-content: center; z-index: 1002;';

    const dialog = document.createElement('div');
    dialog.className = 'custom-dialog';
    dialog.style.cssText = 'background: var(--bg-secondary); padding: 24px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); min-width: 400px;';

    dialog.innerHTML = `
      <h3 style="margin: 0 0 16px 0; color: var(--text-primary);">✏️ Renommer le widget</h3>
      <input type="text" id="quickRenameInput" value="${this.escapeHtml(widget.name)}" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-tertiary); color: var(--text-primary); font-size: 14px; margin-bottom: 16px;">
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button id="quickRenameCancelBtn" class="btn btn-secondary">Annuler</button>
        <button id="quickRenameConfirmBtn" class="btn btn-primary">Renommer</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const input = document.getElementById('quickRenameInput');
    input.focus();
    input.select();

    return new Promise((resolve) => {
      const confirm = async () => {
        const newName = input.value.trim();
        if (newName && newName !== widget.name) {
          try {
            await this.widgetManager.updateWidget(widget.id, { name: newName });
            this.showNotification('Widget renommé', 'success');

            // Re-render la galerie
            const activeBtn = document.querySelector('.widget-category-btn.active');
            const category = activeBtn ? activeBtn.dataset.category : 'all';
            const searchTerm = document.getElementById('widgetSearchInput')?.value || '';
            this.widgetManager.renderWidgetsGallery(category, searchTerm);
          } catch (err) {
            console.error('Erreur renommage:', err);
            this.showNotification('Erreur lors du renommage', 'error');
          }
        }
        document.body.removeChild(overlay);
        resolve();
      };

      const cancel = () => {
        document.body.removeChild(overlay);
        resolve();
      };

      document.getElementById('quickRenameConfirmBtn').addEventListener('click', confirm);
      document.getElementById('quickRenameCancelBtn').addEventListener('click', cancel);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirm();
        if (e.key === 'Escape') cancel();
      });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cancel();
      });
    });
  },

  async changeWidgetEmojiQuick(widget) {
    const emoji = await this.openEmojiPicker(widget.emoji);
    if (!emoji) return;

    try {
      await this.widgetManager.updateWidget(widget.id, { emoji });
      this.showNotification('Icône changée', 'success');

      const activeBtn = document.querySelector('.widget-category-btn.active');
      const category = activeBtn ? activeBtn.dataset.category : 'all';
      const searchTerm = document.getElementById('widgetSearchInput')?.value || '';
      this.widgetManager.renderWidgetsGallery(category, searchTerm);
    } catch (err) {
      console.error('Erreur changement icône:', err);
      this.showNotification('Erreur lors du changement d\'icône', 'error');
    }
  },

  // === EMOJI PICKER UNIVERSEL ===

  async openEmojiPicker(currentEmoji = '') {
    return new Promise(async (resolve) => {
      const emojiData = await loadEmojiDatabase();

      const overlay = document.createElement('div');
      overlay.className = 'emoji-picker-overlay';

      const picker = document.createElement('div');
      picker.className = 'emoji-picker';
      picker.innerHTML = `
        <div class="emoji-picker-header">
          <h3>Choisir un emoji</h3>
          <input type="text" class="emoji-picker-search" placeholder="Rechercher par nom (ex: heart, smile, cat)..." autofocus>
          <div class="emoji-picker-search-hint">💡 Tape une partie du nom</div>
        </div>
        <div class="emoji-picker-categories">
          ${Object.entries(emojiData).map(([key, cat], i) => `<button class="emoji-picker-cat-btn ${i === 0 ? 'active' : ''}" data-cat="${key}" title="${cat.label}">${this.getEmojiForCategory(key)}</button>`).join('')}
        </div>
        <div class="emoji-picker-grid"></div>
      `;

      overlay.appendChild(picker);
      document.body.appendChild(overlay);

      // Animation entrée
      requestAnimationFrame(() => overlay.classList.add('active'));

      const grid = picker.querySelector('.emoji-picker-grid');
      const searchInput = picker.querySelector('.emoji-picker-search');
      let activeCategory = Object.keys(emojiData)[0];
      let allEmojisFlat = [];

      // Créer une liste plate avec métadonnées
      for (const [catKey, cat] of Object.entries(emojiData)) {
        for (const emo of cat.emojis) {
          allEmojisFlat.push({ ...emo, category: catKey });
        }
      }

      // Fonction de recherche fuzzy
      const fuzzyMatch = (text, pattern) => {
        const patternLower = pattern.toLowerCase();
        const textLower = text.toLowerCase();
        if (textLower.includes(patternLower)) return true;
        let patternIdx = 0;
        for (let i = 0; i < textLower.length && patternIdx < patternLower.length; i++) {
          if (textLower[i] === patternLower[patternIdx]) patternIdx++;
        }
        return patternIdx === patternLower.length;
      };

      const renderGrid = (filter = '') => {
        let html = '';
        let resultsCount = 0;

        if (filter.trim()) {
          // Recherche multi-champs
          const matches = allEmojisFlat.filter(emo =>
            fuzzyMatch(emo.name, filter) || fuzzyMatch(emojiData[emo.category].label, filter)
          );

          if (matches.length > 0) {
            // Grouper par catégorie
            const grouped = {};
            matches.forEach(emo => {
              if (!grouped[emo.category]) grouped[emo.category] = [];
              grouped[emo.category].push(emo);
            });

            for (const [catKey, items] of Object.entries(grouped)) {
              html += `<div class="emoji-picker-section-title">${emojiData[catKey].label}</div>`;
              html += items.map(emo => `<button class="emoji-picker-item ${emo.char === currentEmoji ? 'selected' : ''}" data-emoji="${emo.char}" title="${emo.name}">${emo.char}</button>`).join('');
              resultsCount += items.length;
            }
          } else {
            html = `<div class="emoji-picker-empty">Aucun emoji trouvé pour "${filter}"</div>`;
          }
        } else {
          // Afficher la catégorie active
          const cat = emojiData[activeCategory];
          html = cat.emojis.map(emo => `<button class="emoji-picker-item ${emo.char === currentEmoji ? 'selected' : ''}" data-emoji="${emo.char}" title="${emo.name}">${emo.char}</button>`).join('');
          resultsCount = cat.emojis.length;
        }

        grid.innerHTML = html;

        // Bind les clics
        grid.querySelectorAll('.emoji-picker-item').forEach(btn => {
          btn.addEventListener('click', () => {
            close();
            resolve(btn.dataset.emoji);
          });
        });
      };

      renderGrid();

      // Catégories
      picker.querySelectorAll('.emoji-picker-cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          picker.querySelectorAll('.emoji-picker-cat-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          activeCategory = btn.dataset.cat;
          searchInput.value = '';
          renderGrid();
        });
      });

      // Recherche en temps réel
      searchInput.addEventListener('input', () => {
        renderGrid(searchInput.value);
      });

      const close = () => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 200);
      };

      // Fermer au clic sur l'overlay
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          close();
          resolve(null);
        }
      });

      // Escape
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          close();
          resolve(null);
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);
    });
  },

  getEmojiForCategory(catKey) {
    const emojiMap = {
      'smileys': '😀',
      'gestures': '👋',
      'nature': '🌈',
      'animals': '🐶',
      'food': '🍕',
      'activities': '⚽',
      'travel': '🚀',
      'objects': '💻',
      'symbols': '❤️',
      'flags': '🏁'
    };
    return emojiMap[catKey] || '✨';
  },
});
