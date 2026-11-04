/**
 * === GESTION D'ÉTAT GLOBAL ===
 * Synchronise l'état de l'app avec la base de données
 */

const State = {
  // === STORE LOCAL ===
  cards: [],
  reviews: [],
  userProfile: {
    id: 'default_user',
    consolidationSpeedMs: 15000,
    totalReviews: 0,
    lastSessionAt: null,
    currentStreak: 0,
    streakStartAt: null
  },

  // === SESSION ACTUELLE ===
  currentSession: {
    cards: [],
    currentIndex: 0,
    startedAt: null,
    finishedAt: null
  },

  // === STATISTIQUES EN TEMPS RÉEL ===
  stats: {
    readyCount: 0,
    todayCount: '0/20',
    nextSessionIn: null
  },

  // === FLAGS ===
  isInitialized: false,

  /**
   * Initialise l'état depuis la DB
   */
  async init() {
    try {
      // Charger les cartes
      try {
        this.cards = await queryDB({
          table: 'flashcards',
          action: 'select'
        }) || [];
      } catch (e) {
        console.warn('Erreur chargement cartes:', e);
        this.cards = [];
      }

      // Charger les révisions
      try {
        this.reviews = await queryDB({
          table: 'flashcard_reviews',
          action: 'select'
        }) || [];
      } catch (e) {
        console.warn('Erreur chargement révisions:', e);
        this.reviews = [];
      }

      // Charger ou créer le profil utilisateur
      try {
        const userResult = await queryDB({
          table: 'learner_profile',
          action: 'select',
          limit: 1
        });

        if (userResult && userResult.length > 0) {
          this.userProfile = userResult[0];
        } else {
          // Créer un profil utilisateur vierge
          const newProfile = {
            id: 'default_user',
            consolidationSpeedMs: 15000,
            totalReviews: 0,
            currentStreak: 0,
            streakStartAt: null,
            lastSessionAt: null
          };
          await queryDB({
            table: 'learner_profile',
            action: 'insert',
            data: newProfile
          });
          this.userProfile = newProfile;
        }
      } catch (e) {
        console.warn('Erreur profil utilisateur:', e);
      }

      // Traiter les tags (convert JSON string to array)
      this.cards = this.cards.map(card => ({
        ...card,
        tags: typeof card.tags === 'string' ? JSON.parse(card.tags || '[]') : (card.tags || [])
      }));

      // Mettre à jour les stats
      this.updateStats();

      this.isInitialized = true;
      console.log('✅ State initialisé:', {
        cartes: this.cards.length,
        révisions: this.reviews.length,
        profil: this.userProfile.totalReviews
      });
      return true;
    } catch (err) {
      console.error('❌ Erreur init State:', err);
      return false;
    }
  },

  /**
   * Ajoute une nouvelle carte
   */
  async addCard(front, back, tags = []) {
    const cardId = `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const cardData = {
      id: cardId,
      front,
      back,
      tags: JSON.stringify(tags),
      createdAt: now,
      nextReviewAt: now,
      lastReviewAt: null,
      lastInterval: null,
      reviewCount: 0,
      personalConsolidationSpeed: null,
      priorityBoost: 0,
      status: 'active'
    };

    try {
      await queryDB({
        table: 'flashcards',
        action: 'insert',
        data: cardData
      });

      this.cards.push({
        ...cardData,
        tags: tags
      });
      this.updateStats();
      return cardId;
    } catch (err) {
      console.error('Erreur ajout carte:', err);
      throw err;
    }
  },

  /**
   * Enregistre une révision
   */
  async recordReview(cardId, responseTimeMs, confidence) {
    const now = Date.now();
    const reviewId = `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Trouver la carte
    const card = this.cards.find(c => c.id === cardId);
    if (!card) throw new Error('Carte non trouvée');

    // Calculer le nouvel intervalle
    const nextReviewAt = calculateNextReview(card, { responseTimeMs, confidence }, this.userProfile);

    // Mettre à jour la carte
    card.lastReviewAt = now;
    card.nextReviewAt = nextReviewAt;
    card.reviewCount = (card.reviewCount || 0) + 1;
    card.lastInterval = (nextReviewAt - now) / 60000;

    if (card.priorityBoost > 0 && confidence >= 3) {
      card.priorityBoost = Math.max(0, card.priorityBoost - 1);
    }

    try {
      // Insérer la révision
      await queryDB({
        table: 'flashcard_reviews',
        action: 'insert',
        data: {
          id: reviewId,
          cardId,
          timestamp: now,
          responseTimeMs,
          confidence,
          lastInterval: card.lastInterval
        }
      });

      // Mettre à jour la carte
      await queryDB({
        table: 'flashcards',
        action: 'update',
        where: { id: cardId },
        data: {
          lastReviewAt: now,
          nextReviewAt: nextReviewAt,
          reviewCount: card.reviewCount,
          lastInterval: card.lastInterval,
          priorityBoost: card.priorityBoost
        }
      });

      // Ajouter au store local
      this.reviews.push({
        id: reviewId,
        cardId,
        timestamp: now,
        responseTimeMs,
        confidence,
        lastInterval: card.lastInterval
      });

      // Mettre à jour profil utilisateur
      this.userProfile.totalReviews++;

      if (this.reviews.length % 20 === 0) {
        this.userProfile.consolidationSpeedMs = updateUserProfile(this.reviews);
        await queryDB({
          table: 'learner_profile',
          action: 'update',
          where: { id: 'default_user' },
          data: {
            consolidationSpeedMs: this.userProfile.consolidationSpeedMs,
            totalReviews: this.userProfile.totalReviews
          }
        });
      }

      this.updateStats();
      return { nextReviewAt, lastInterval: card.lastInterval };
    } catch (err) {
      console.error('Erreur enregistrement révision:', err);
      throw err;
    }
  },

  /**
   * Récupère les cartes prêtes pour une session
   */
  getReadyCards() {
    return getReadyCards(this.cards);
  },

  /**
   * Démarre une nouvelle session
   */
  startSession(cardIds = null) {
    let sessionCards = cardIds
      ? this.cards.filter(c => cardIds.includes(c.id))
      : this.getReadyCards();

    // Mélanger l'ordre
    sessionCards = sessionCards.sort(() => Math.random() - 0.5);

    this.currentSession = {
      cards: sessionCards,
      currentIndex: 0,
      startedAt: Date.now(),
      finishedAt: null
    };

    return this.currentSession;
  },

  /**
   * Finit la session actuelle
   */
  async finishSession() {
    this.currentSession.finishedAt = Date.now();
    this.userProfile.lastSessionAt = Date.now();
    this.userProfile.currentStreak = calculateStreak(this.reviews, this.userProfile);

    try {
      await queryDB({
        table: 'learner_profile',
        action: 'update',
        where: { id: 'default_user' },
        data: {
          lastSessionAt: this.userProfile.lastSessionAt,
          currentStreak: this.userProfile.currentStreak
        }
      });
    } catch (err) {
      console.error('Erreur finish session:', err);
    }

    this.updateStats();
  },

  /**
   * Met à jour les statistiques affichées
   */
  updateStats() {
    const readyCards = this.getReadyCards();
    this.stats.readyCount = readyCards.length;

    const dailyProgress = getDailyProgress(this.reviews, 20);
    this.stats.todayCount = `${dailyProgress.done}/${dailyProgress.goal}`;

    const upcomingCards = getUpcomingCards(this.cards);
    if (upcomingCards.length > 0) {
      this.stats.nextSessionIn = upcomingCards[0].timeUntilReady;
    } else {
      this.stats.nextSessionIn = null;
    }
  },

  /**
   * Suspend une carte
   */
  async suspendCard(cardId) {
    const card = this.cards.find(c => c.id === cardId);
    if (card) {
      card.status = 'suspended';
      try {
        await queryDB({
          table: 'flashcards',
          action: 'update',
          where: { id: cardId },
          data: { status: 'suspended' }
        });
        this.updateStats();
      } catch (err) {
        console.error('Erreur suspension carte:', err);
      }
    }
  },

  /**
   * Réactive une carte
   */
  async unsuspendCard(cardId) {
    const card = this.cards.find(c => c.id === cardId);
    if (card) {
      card.status = 'active';
      try {
        await queryDB({
          table: 'flashcards',
          action: 'update',
          where: { id: cardId },
          data: { status: 'active' }
        });
        this.updateStats();
      } catch (err) {
        console.error('Erreur réactivation carte:', err);
      }
    }
  },

  /**
   * Supprime une carte
   */
  async deleteCard(cardId) {
    try {
      await queryDB({
        table: 'flashcards',
        action: 'delete',
        where: { id: cardId }
      });

      await queryDB({
        table: 'flashcard_reviews',
        action: 'delete',
        where: { cardId }
      });

      this.cards = this.cards.filter(c => c.id !== cardId);
      this.reviews = this.reviews.filter(r => r.cardId !== cardId);
      this.updateStats();
    } catch (err) {
      console.error('Erreur suppression carte:', err);
    }
  },

  /**
   * Édite une carte
   */
  async editCard(cardId, front, back, tags) {
    const card = this.cards.find(c => c.id === cardId);
    if (card) {
      card.front = front;
      card.back = back;
      card.tags = tags;

      try {
        await queryDB({
          table: 'flashcards',
          action: 'update',
          where: { id: cardId },
          data: {
            front,
            back,
            tags: JSON.stringify(tags)
          }
        });
      } catch (err) {
        console.error('Erreur édition carte:', err);
      }
    }
  },

  /**
   * Importe des cartes depuis un fichier CSV
   */
  async importCardsFromCSV(csvText) {
    const cardsData = parseCSV(csvText);
    const importedIds = [];

    for (const card of cardsData) {
      try {
        const id = await this.addCard(card.front, card.back, card.tags);
        importedIds.push(id);
      } catch (err) {
        console.error('Erreur import carte:', err);
      }
    }

    return importedIds;
  }
};

// Expose to the other scripts: top-level `const` is not a window property.
window.State = State;

// Auto-init au chargement du DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    State.init().catch(console.error);
  });
} else {
  State.init().catch(console.error);
}
