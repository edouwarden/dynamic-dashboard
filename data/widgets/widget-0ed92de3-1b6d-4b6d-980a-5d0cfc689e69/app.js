/**
 * === POINT D'ENTRÉE PRINCIPAL ===
 * Coordonne l'initialisation et les interactions du système de révision
 */

console.log('🃏 Widget Flashcards - Spaced Repetition');
console.log('Initialisation en cours...');

// Global app state
const AppState = {
  cards: [],
  reviews: [],
  userProfile: null,
  currentSessionCards: [],
  currentSessionIndex: 0,
  sessionStartTime: null,
  currentCard: null,
  revealedAt: null,
  isRevealed: false
};

/**
 * Initialise l'application complète
 */
async function initializeApp() {
  try {
    // Vérifier que State est initialisé
    if (!window.State || !window.State.isInitialized) {
      console.log('En attente de l\'initialisation de State...');
      return setTimeout(initializeApp, 100);
    }

    console.log('✅ State initialisé');
    console.log(`📊 Cartes: ${State.cards.length}`);
    console.log(`📝 Révisions: ${State.reviews.length}`);
    console.log(`👤 Profil utilisateur: ${State.userProfile?.totalReviews || 0} révisions`);

    // Initialiser l'UI
    if (window.UI) {
      UI.init();
      console.log('✅ UI initialisée');

      // Mettre à jour le dashboard
      UI.updateDashboard();

      // Setup auto-update du dashboard tous les 30s
      setInterval(() => {
        UI.updateDashboard();
      }, 30000);
    }

    console.log('✅ Système de révision intelligent PRÊT! 🚀');
  } catch (err) {
    console.error('❌ Erreur initialisation:', err);
    if (window.UI) {
      UI.showToast('Erreur lors de l\'initialisation', 'error');
    }
  }
}

// Attendre le chargement du DOM + des assets
document.addEventListener('DOMContentLoaded', () => {
  // Attendre un peu pour que les assets se chargent
  setTimeout(initializeApp, 500);
});

/**
 * Expose les fonctions globales pour la console/debug
 */
window.FlashcardDebug = {
  help: () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║ 🃏 DEBUG GUIDE - Flashcards                             ║
╚════════════════════════════════════════════════════════╝

📊 CONSULTATION:
  • FlashcardDebug.state()           → État complet du système
  • FlashcardDebug.cards()           → Liste des cartes
  • FlashcardDebug.reviews()         → Historique révisions
  • FlashcardDebug.stats()           → Statistiques
  • FlashcardDebug.profile()         → Profil utilisateur

🎬 ACTIONS:
  • FlashcardDebug.addTestCard()     → Ajouter 1 carte test
  • FlashcardDebug.importTestDeck()  → Ajouter 5 cartes test
  • FlashcardDebug.simulateReview(id, conf)  → Simuler révision
  • FlashcardDebug.export()          → Exporter JSON

⚠️ ACTIONS DESTRUCTIVES:
  • FlashcardDebug.cleanDB()         → RESET TOTAL (irréversible!)

💡 EXEMPLES:
  FlashcardDebug.state()
  FlashcardDebug.addTestCard('Qui était Léonard de Vinci?', 'Artiste/savant')
  FlashcardDebug.simulateReview(State.cards[0].id, 5)
════════════════════════════════════════════════════════
    `);
  },

  state: () => {
    console.log('📊 STATE COMPLET:', {
      cards: State.cards,
      reviews: State.reviews,
      userProfile: State.userProfile,
      stats: State.stats
    });
    return State;
  },

  cards: () => {
    console.log('🃏 CARTES:', State.cards);
    return State.cards;
  },

  reviews: () => {
    console.log('📝 RÉVISIONS:', State.reviews);
    return State.reviews;
  },

  stats: () => {
    console.log('📈 STATS:', State.stats);
    return State.stats;
  },

  profile: () => {
    console.log('👤 PROFIL:', State.userProfile);
    return State.userProfile;
  },

  addTestCard: async (front, back) => {
    const f = front || 'Quel est le plus haut sommet du monde?';
    const b = back || 'Mont Everest';
    console.log(`➕ Ajout carte: "${f}" → "${b}"`);
    const result = await State.addCard(f, b, ['test']);
    UI.updateDashboard();
    return result;
  },

  importTestDeck: async () => {
    const testCards = [
      { front: 'Quelle est la capitale de la France?', back: 'Paris', tags: ['géographie'] },
      { front: 'Quel est le plus haut sommet du monde?', back: 'Mont Everest', tags: ['géographie'] },
      { front: '2 + 2 = ?', back: '4', tags: ['math'] },
      { front: 'En quelle année l\'homme a-t-il marché sur la Lune?', back: '1969', tags: ['histoire'] },
      { front: 'Quel est le plus grand océan?', back: 'Océan Pacifique', tags: ['géographie'] }
    ];

    console.log(`📥 Importation de ${testCards.length} cartes test...`);
    for (const card of testCards) {
      await State.addCard(card.front, card.back, card.tags);
    }
    UI.updateDashboard();
    console.log(`✅ ${testCards.length} cartes importées`);
  },

  simulateReview: async (cardId, confidence = 4) => {
    const card = State.cards.find(c => c.id === cardId);
    if (!card) {
      console.error('❌ Carte non trouvée:', cardId);
      return;
    }
    const responseTime = Math.random() * 5000 + 2000;
    console.log(`🎯 Simulation révision: "${card.front.substring(0,30)}..." (confiance: ${confidence})`);
    await State.recordReview(cardId, responseTime, confidence);
    UI.updateDashboard();
  },

  export: () => {
    const data = {
      exportDate: new Date().toISOString(),
      cards: State.cards,
      reviews: State.reviews,
      userProfile: State.userProfile,
      stats: State.stats
    };
    console.log('📦 EXPORT JSON:');
    console.log(JSON.stringify(data, null, 2));
    return data;
  },

  cleanDB: async () => {
    if (!confirm('⚠️ ATTENTION: Cela supprimera TOUTES les cartes et révisions.\n\nContinuer?')) {
      console.log('❌ Annulé');
      return;
    }
    try {
      console.log('🗑️ Nettoyage de la DB...');
      await queryDB({ table: 'flashcards', action: 'delete', where: {} });
      await queryDB({ table: 'flashcard_reviews', action: 'delete', where: {} });
      console.log('✅ DB nettoyée. Reload...');
      location.reload();
    } catch (err) {
      console.error('❌ Erreur:', err);
    }
  }
};

console.log('💡 Tapez FlashcardDebug.help() pour le guide complet');
