/**
 * Dashboard OpenCode — panneau OpenCode pour modifier le dashboard global
 * Réutilise OpenCodePanel unifié avec apiBaseTemplate pointant vers /api/dashboard
 * Méthodes ajoutées au prototype Dashboard
 */
import { Dashboard } from './core.js?v=331';
import { OpenCodePanel } from '../managers/opencode-panel.js?v=331';

// =====================================================================
// Gestion du token d'auth (hash SHA-256 du mot de passe)
// Stocké en localStorage, demandé une seule fois
// =====================================================================

const TOKEN_KEY = 'dashboardOpenCodeToken';

async function _sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function _getDashboardToken() {
  const stored = localStorage.getItem(TOKEN_KEY);
  if (stored) return stored;
  return null;
}

async function _promptAndStoreToken() {
  const pwd = prompt('🔐 Mot de passe requis pour accéder au panel OpenCode Dashboard :');
  if (!pwd) return null;
  const hash = await _sha256(pwd);
  localStorage.setItem(TOKEN_KEY, hash);
  return hash;
}

Object.assign(Dashboard.prototype, {

  /** Initialiser le panel OpenCode dashboard (appelé depuis core.js après init) */
  initDashboardOpenCodePanel() {
    this.dashboardOpenCodePanel = new OpenCodePanel('dashboardOpenCodePanelMount', {
      apiBaseTemplate: '/api/dashboard/opencode',
      panelType: 'dashboard',
      getEntityLabel: () => ({ emoji: '🏠', name: 'Dashboard' }),
      placeholder: 'Décris ce que tu veux modifier sur le dashboard...',
      suggestions: [
        { label: '🔧 Toolbar', prompt: 'Ajoute un bouton dans la toolbar' },
        { label: '🎨 Style', prompt: 'Modifie le style du sidebar' },
        { label: '✨ Feature', prompt: 'Crée une nouvelle feature' },
        { label: '🐛 Bug', prompt: 'Corrige ce bug : ' },
      ],
      features: { upload: false },
      getExtraHeaders: () => {
        const token = localStorage.getItem(TOKEN_KEY);
        return token ? { 'X-Dashboard-Token': token } : {};
      },
      onAuthError: () => {
        // Mot de passe incorrect — effacer le token pour forcer une nouvelle saisie
        localStorage.removeItem(TOKEN_KEY);
      },
      onDone: async () => {
        // Suggérer un reload après que OpenCode a modifié des fichiers
        this._showDashboardReloadBanner();
      },
    });

    // Charger les sessions dashboard (entité fixe 'dashboard')
    this.dashboardOpenCodePanel.init('dashboard');
  },

  /** Ouvrir le panel OpenCode dashboard — demande le mot de passe si nécessaire */
  async openDashboardOpenCodePanel() {
    const overlay = document.getElementById('dashboardOpenCodeOverlay');
    if (!overlay) return;

    // Vérifier / obtenir le token
    let token = await _getDashboardToken();
    if (!token) {
      token = await _promptAndStoreToken();
      if (!token) return; // annulé par l'utilisateur
    }

    overlay.style.display = 'flex';
    // S'assurer que le panel est initialisé
    if (!this.dashboardOpenCodePanel) {
      this.initDashboardOpenCodePanel();
    } else {
      this.dashboardOpenCodePanel.init('dashboard');
    }
  },

  /** Fermer le panel OpenCode dashboard */
  closeDashboardOpenCodePanel() {
    const overlay = document.getElementById('dashboardOpenCodeOverlay');
    if (overlay) overlay.style.display = 'none';
  },

  /** Afficher une bannière suggérant un reload après modifications OpenCode */
  _showDashboardReloadBanner() {
    // Éviter les doublons
    if (document.getElementById('dashboardReloadBanner')) return;

    const banner = document.createElement('div');
    banner.id = 'dashboardReloadBanner';
    banner.className = 'dashboard-reload-banner';
    banner.innerHTML = `
      <span>🤖 OpenCode a modifié le dashboard. Rechargez la page pour voir les changements.</span>
      <div class="dashboard-reload-actions">
        <button class="btn btn-sm btn-primary" id="dashboardReloadBtn">🔄 Recharger</button>
        <button class="btn btn-sm btn-ghost" id="dashboardReloadDismissBtn">Plus tard</button>
      </div>
    `;
    document.body.appendChild(banner);

    document.getElementById('dashboardReloadBtn')?.addEventListener('click', () => {
      window.location.reload();
    });
    document.getElementById('dashboardReloadDismissBtn')?.addEventListener('click', () => {
      banner.remove();
    });
  },

});
