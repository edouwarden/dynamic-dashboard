/**
 * === RENDU DYNAMIQUE & INTERACTIONS ===
 * Gère l'affichage et les interactions utilisateur
 */

const UI = {
  elements: {},
  sessionState: {
    currentCard: null,
    responseStartTime: null,
    currentConfidence: null,
    timerInterval: null
  },

  /**
   * Initialise tous les éléments DOM et les event listeners
   */
  init() {
    if (this._initialized) return;
    this._initialized = true;
    // Récupérer les éléments DOM
    this.elements.dashboardView = document.getElementById('dashboard-view');
    this.elements.reviewView = document.getElementById('review-view');

    this.elements.readyCount = document.getElementById('ready-count');
    this.elements.streakCount = document.getElementById('streak-count');
    this.elements.todayCount = document.getElementById('today-count');
    this.elements.nextSessionContent = document.getElementById('next-session-content');
    this.elements.startBtn = document.getElementById('start-btn');
    this.elements.addCardBtn = document.getElementById('add-card-btn');
    this.elements.importBtn = document.getElementById('import-btn');
    this.elements.manageBtn = document.getElementById('manage-btn');

    this.elements.sessionProgress = document.getElementById('session-progress');
    this.elements.reviewCount = document.getElementById('review-count');
    this.elements.cardFront = document.getElementById('card-front');
    this.elements.cardBack = document.getElementById('card-back');
    this.elements.revealBtn = document.getElementById('reveal-btn');
    this.elements.confidenceSection = document.getElementById('confidence-section');
    this.elements.responseTime = document.getElementById('response-time');
    this.elements.confBtns = Array.from(document.querySelectorAll('.conf-btn'));
    this.elements.nextBtn = document.getElementById('next-btn');
    this.elements.skipBtn = document.getElementById('skip-btn');
    this.elements.quitBtn = document.getElementById('quit-btn');
    this.elements.reviewActions = document.getElementById('review-actions');

    this.elements.addCardModal = document.getElementById('add-card-modal');
    this.elements.addCardForm = document.getElementById('add-card-form');
    this.elements.closeAddModal = document.getElementById('close-add-modal');
    this.elements.manageModal = document.getElementById('manage-modal');
    this.elements.closeManageModal = document.getElementById('close-manage-modal');
    this.elements.searchCardsInput = document.getElementById('search-cards');
    this.elements.cardsList = document.getElementById('cards-list');
    this.elements.toastContainer = document.getElementById('toast-container');

    // Event listeners - Dashboard
    this.elements.startBtn.addEventListener('click', () => this.startSession());
    this.elements.addCardBtn.addEventListener('click', () => this.showAddCardModal());
    this.elements.importBtn.addEventListener('click', () => this.showImportModal());
    this.elements.manageBtn.addEventListener('click', () => this.showManageModal());

    // Event listeners - Add Card Modal
    this.elements.closeAddModal.addEventListener('click', () => this.hideAddCardModal());
    this.elements.addCardForm.addEventListener('submit', (e) => this.handleAddCard(e));

    // Event listeners - Manage Modal
    this.elements.closeManageModal.addEventListener('click', () => this.hideManageModal());
    this.elements.searchCardsInput.addEventListener('input', (e) => this.filterCards(e.target.value));

    // Event listeners - Review Session
    this.elements.revealBtn.addEventListener('click', () => this.revealCard());
    this.elements.confBtns.forEach(btn => {
      btn.addEventListener('click', (e) => this.submitConfidence(parseInt(e.target.dataset.confidence)));
    });
    this.elements.nextBtn.addEventListener('click', () => this.nextCard());
    this.elements.skipBtn.addEventListener('click', () => this.skipCard());
    this.elements.quitBtn.addEventListener('click', () => this.quitSession());

    console.log('✅ UI initialisée');
  },

  /**
   * Met à jour le dashboard
   */
  updateDashboard() {
    const readyCards = State.getReadyCards();

    this.elements.readyCount.textContent = readyCards.length;
    this.elements.streakCount.textContent = State.userProfile.currentStreak || 0;
    this.elements.todayCount.textContent = State.stats.todayCount;

    // Mettre à jour bouton démarrage
    if (readyCards.length > 0) {
      this.elements.startBtn.disabled = false;
    } else {
      this.elements.startBtn.disabled = true;
    }

    // Affichage prochaine session
    if (State.stats.nextSessionIn !== null && readyCards.length === 0) {
      this.elements.nextSessionContent.innerHTML = `
        <p class="session-countdown">Prochaine révision optimale dans ${formatDelay(State.stats.nextSessionIn)}</p>
      `;
    } else if (readyCards.length > 0) {
      this.elements.nextSessionContent.innerHTML = `
        <p class="session-ready">✨ ${readyCards.length} cartes prêtes!</p>
      `;
    } else {
      this.elements.nextSessionContent.innerHTML = `
        <p style="opacity: 0.7; margin: 0;">Aucune carte à réviser</p>
      `;
    }
  },

  /**
   * Affiche le modal d'ajout de carte
   */
  showAddCardModal() {
    this.elements.addCardForm.reset();
    this.elements.addCardModal.classList.remove('hidden');
  },

  /**
   * Cache le modal d'ajout de carte
   */
  hideAddCardModal() {
    this.elements.addCardModal.classList.add('hidden');
  },

  /**
   * Traite l'ajout d'une nouvelle carte
   */
  async handleAddCard(e) {
    e.preventDefault();

    const front = document.getElementById('card-front-input').value.trim();
    const back = document.getElementById('card-back-input').value.trim();
    const tagsInput = document.getElementById('card-tags-input').value.trim();
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()) : [];

    if (!front || !back) {
      this.showToast('Veuillez remplir le front et le back', 'error');
      return;
    }

    try {
      await State.addCard(front, back, tags);
      this.showToast(`✅ Carte ajoutée!`, 'success');
      this.hideAddCardModal();
      this.updateDashboard();
    } catch (err) {
      console.error('Erreur ajout carte:', err);
      this.showToast('Erreur lors de l\'ajout de la carte', 'error');
    }
  },

  /**
   * Affiche le modal d'import
   */
  showImportModal() {
    const textarea = document.createElement('textarea');
    const result = prompt('Paste CSV (front,back,tags):\nExample:\nQuestion 1?,Reponse 1,tag1;tag2', '');

    if (result !== null && result.trim()) {
      this.handleImportCSV(result);
    }
  },

  /**
   * Traite l'import CSV
   */
  async handleImportCSV(csvText) {
    try {
      const imported = await State.importCardsFromCSV(csvText);
      this.showToast(`✅ ${imported.length} cartes importées!`, 'success');
      this.updateDashboard();
    } catch (err) {
      console.error('Erreur import:', err);
      this.showToast('Erreur lors de l\'import', 'error');
    }
  },

  /**
   * Affiche le modal de gestion des cartes
   */
  showManageModal() {
    this.elements.manageModal.classList.remove('hidden');
    this.renderCardsList(State.cards);
  },

  /**
   * Cache le modal de gestion
   */
  hideManageModal() {
    this.elements.manageModal.classList.add('hidden');
  },

  /**
   * Filtre et affiche la liste des cartes
   */
  filterCards(searchTerm) {
    const filtered = State.cards.filter(card => {
      const search = searchTerm.toLowerCase();
      return card.front.toLowerCase().includes(search) ||
             card.back.toLowerCase().includes(search) ||
             (card.tags || []).some(tag => tag.toLowerCase().includes(search));
    });
    this.renderCardsList(filtered);
  },

  /**
   * Affiche la liste des cartes
   */
  renderCardsList(cards) {
    this.elements.cardsList.innerHTML = cards.map(card => {
      const tags = typeof card.tags === 'string' ? JSON.parse(card.tags || '[]') : (card.tags || []);
      return `
        <div class="card-item">
          <div class="card-item-content">
            <div class="card-item-front">${card.front.substring(0, 50)}</div>
            <div class="card-item-back">${card.back.substring(0, 50)}</div>
            ${tags.length > 0 ? `<div style="font-size: 0.75rem; opacity: 0.5; margin-top: 4px;">${tags.join(', ')}</div>` : ''}
          </div>
          <div class="card-item-actions">
            <button class="card-item-btn" onclick="UI.suspendCard('${card.id}')">
              ${card.status === 'active' ? '⏸️' : '▶️'}
            </button>
            <button class="card-item-btn" onclick="UI.deleteCard('${card.id}')" style="color: var(--color-error);">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Suspend une carte
   */
  async suspendCard(cardId) {
    const card = State.cards.find(c => c.id === cardId);
    if (card.status === 'active') {
      await State.suspendCard(cardId);
      this.showToast('Carte suspendue', 'success');
    } else {
      await State.unsuspendCard(cardId);
      this.showToast('Carte réactivée', 'success');
    }
    this.filterCards(this.elements.searchCardsInput.value);
  },

  /**
   * Supprime une carte
   */
  async deleteCard(cardId) {
    if (confirm('Êtes-vous sûr? Cette action est irréversible.')) {
      await State.deleteCard(cardId);
      this.showToast('Carte supprimée', 'success');
      this.filterCards(this.elements.searchCardsInput.value);
      this.updateDashboard();
    }
  },

  /**
   * Démarre une session de révision
   */
  startSession() {
    const readyCards = State.getReadyCards();
    if (readyCards.length === 0) {
      this.showToast('Aucune carte prête à réviser', 'error');
      return;
    }

    State.startSession();
    this.showReviewView();
    this.loadCard();
  },

  /**
   * Bascule vers la vue de révision
   */
  showReviewView() {
    this.elements.dashboardView.classList.remove('active');
    this.elements.reviewView.classList.add('active');
  },

  /**
   * Bascule vers la vue du dashboard
   */
  showDashboardView() {
    this.elements.reviewView.classList.remove('active');
    this.elements.dashboardView.classList.add('active');
    this.updateDashboard();
  },

  /**
   * Charge et affiche la prochaine carte
   */
  loadCard() {
    const session = State.currentSession;

    if (session.currentIndex >= session.cards.length) {
      this.finishSession();
      return;
    }

    const card = session.cards[session.currentIndex];
    this.sessionState.currentCard = card;
    this.sessionState.currentConfidence = null;

    // Afficher progress
    this.elements.reviewCount.textContent = `${session.currentIndex + 1}/${session.cards.length}`;
    this.elements.sessionProgress.style.width = `${((session.currentIndex + 1) / session.cards.length) * 100}%`;

    // Afficher la face avant
    this.elements.cardFront.innerHTML = `<p>${card.front}</p>`;
    this.elements.cardBack.classList.add('hidden');
    this.elements.cardBack.innerHTML = '';
    this.elements.revealBtn.classList.remove('hidden');
    this.elements.confidenceSection.classList.add('hidden');
    this.elements.reviewActions.classList.add('hidden');

    // Réinitialiser le timer
    if (this.sessionState.timerInterval) clearInterval(this.sessionState.timerInterval);
    this.sessionState.responseStartTime = Date.now();
  },

  /**
   * Révèle la réponse
   */
  revealCard() {
    const card = this.sessionState.currentCard;

    this.elements.cardBack.classList.remove('hidden');
    this.elements.cardBack.innerHTML = `<p>${card.back}</p>`;
    this.elements.revealBtn.classList.add('hidden');
    this.elements.confidenceSection.classList.remove('hidden');

    // Démarrer le timer
    this.startResponseTimer();
  },

  /**
   * Démarre le timer de réponse
   */
  startResponseTimer() {
    if (this.sessionState.timerInterval) clearInterval(this.sessionState.timerInterval);

    this.sessionState.timerInterval = setInterval(() => {
      const elapsed = Math.round((Date.now() - this.sessionState.responseStartTime) / 1000);
      this.elements.responseTime.textContent = `Temps: ${elapsed}s`;
    }, 100);
  },

  /**
   * Soumet la confiance
   */
  async submitConfidence(confidence) {
    if (this.sessionState.currentConfidence !== null) return; // Déjà soumis

    this.sessionState.currentConfidence = confidence;
    const responseTimeMs = Date.now() - this.sessionState.responseStartTime;

    // Clear timer
    if (this.sessionState.timerInterval) clearInterval(this.sessionState.timerInterval);

    // Marquer le bouton sélectionné
    this.elements.confBtns.forEach(btn => btn.classList.remove('active'));
    const selectedBtn = this.elements.confBtns.find(btn => btn.dataset.confidence === String(confidence));
    if (selectedBtn) selectedBtn.classList.add('active');

    // Enregistrer la révision
    try {
      await State.recordReview(this.sessionState.currentCard.id, responseTimeMs, confidence);

      // Afficher boutons action
      this.elements.confidenceSection.classList.add('hidden');
      this.elements.reviewActions.classList.remove('hidden');
    } catch (err) {
      console.error('Erreur enregistrement révision:', err);
      this.showToast('Erreur lors de l\'enregistrement', 'error');
    }
  },

  /**
   * Passe à la carte suivante
   */
  nextCard() {
    State.currentSession.currentIndex++;
    this.loadCard();
  },

  /**
   * Saute la carte actuelle
   */
  skipCard() {
    // Pas d'enregistrement, juste passer
    this.nextCard();
  },

  /**
   * Quitte la session
   */
  async quitSession() {
    if (confirm('Quitter la session?')) {
      await State.finishSession();
      this.showDashboardView();
      this.showToast('✅ Session terminée!', 'success');
    }
  },

  /**
   * Termine la session
   */
  async finishSession() {
    await State.finishSession();
    this.showDashboardView();
    this.showToast('🎉 Session terminée avec succès!', 'success');
  },

  /**
   * Affiche un toast de notification
   */
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    this.elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastSlideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
};

// Expose to the other scripts: top-level `const` is not a window property.
window.UI = UI;

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (window.UI && window.State && window.State.isInitialized) {
      UI.init();
      UI.updateDashboard();
    }
  }, 100);
});
