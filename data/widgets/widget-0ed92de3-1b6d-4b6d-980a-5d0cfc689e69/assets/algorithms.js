/**
 * === ALGORITHME DE CONSOLIDATION ADAPTATIVE ===
 * Calcule les intervalles de révision basés sur la plasticité attentionnelle
 * et les mécanismes de consolidation mnésique en temps réel
 */

const BASE_INTERVALS = [
  45,      // Stage 0: 45 minutes (première fenêtre de labilité)
  240,     // Stage 1: 4 heures
  1200,    // Stage 2: 20 heures
  5760,    // Stage 3: 4 jours
  17280,   // Stage 4: 12 jours
  43200    // Stage 5: 30 jours
];

/**
 * Calcule la fenêtre de révision suivante pour une carte
 * @param {Object} card - Objet carte avec historique
 * @param {Object} lastReview - Dernière révision {responseTimeMs, confidence}
 * @param {Object} userProfile - Profil consolidation utilisateur
 * @returns {number} Timestamp de la prochaine révision idéale
 */
function calculateNextReview(card, lastReview, userProfile) {
  const now = Date.now();

  // === STEP 1: Déterminer l'intervalle de base selon le stade ===
  const stage = Math.min(card.reviewCount || 0, BASE_INTERVALS.length - 1);
  let nextInterval = BASE_INTERVALS[stage];

  // === STEP 2: Ajuster selon le TIMING de la révision ===
  const lastReviewTime = card.lastReviewAt || now;
  const timeSinceLastReview = (now - lastReviewTime) / 60000; // en minutes
  const expectedWindow = card.lastInterval || BASE_INTERVALS[Math.max(0, stage - 1)] || 45;
  const timingRatio = timeSinceLastReview / expectedWindow;

  let timingMultiplier = 1;
  if (timingRatio < 0.7) {
    timingMultiplier = 0.4; // Trop tôt
  } else if (timingRatio >= 0.9 && timingRatio <= 1.1) {
    timingMultiplier = 1.5; // Optimal
  } else if (timingRatio > 1.5) {
    timingMultiplier = 0.8; // Trop tard
  }

  // === STEP 3: Ajuster selon la CONFIANCE ===
  const confidenceBoosts = {
    1: 0.25,   // Oubli
    2: 0.65,   // Hésitant
    3: 1.0,    // Moyen
    4: 1.3,    // Je sais
    5: 1.8     // Auto
  };
  const confidenceBoost = confidenceBoosts[lastReview.confidence] || 1.0;

  // === STEP 4: Mode PERSONNALISÉ si >= 5 révisions ===
  let finalInterval = nextInterval * timingMultiplier * confidenceBoost;

  if (card.reviewCount >= 5 && userProfile?.consolidationSpeedMs) {
    const userSpeedFactor = (userProfile.consolidationSpeedMs || 15000) / 15000;
    finalInterval = nextInterval * userSpeedFactor * confidenceBoost;
  }

  // === STEP 5: Gestion des OUBLIS ===
  if (lastReview.confidence === 1) {
    finalInterval = Math.max(15, finalInterval);
    card.priorityBoost = (card.priorityBoost || 0) + 2;
  }

  const minimumInterval = Math.max(15, finalInterval);
  return now + (minimumInterval * 60 * 1000);
}

/**
 * Met à jour le profil de consolidation utilisateur
 */
function updateUserProfile(reviews) {
  if (!reviews || reviews.length < 20) {
    return 15000;
  }

  const effectiveConsolidations = reviews
    .filter(r => r.confidence >= 4)
    .map(r => r.responseTimeMs)
    .filter(t => t > 0);

  if (effectiveConsolidations.length === 0) {
    return 15000;
  }

  const avgRecent = effectiveConsolidations.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, effectiveConsolidations.length);
  const avgAll = effectiveConsolidations.reduce((a, b) => a + b, 0) / effectiveConsolidations.length;
  const weightedSpeed = avgRecent * 0.6 + avgAll * 0.4;

  return Math.max(5000, Math.min(30000, weightedSpeed));
}

/**
 * Obtient les cartes "prêtes maintenant"
 */
function getReadyCards(cards, now = Date.now()) {
  const ONE_HOUR = 60 * 60 * 1000;

  return cards
    .filter(card => {
      const isReady = (card.nextReviewAt || 0) <= now && card.status === 'active';
      const recentlyReviewed = card.lastReviewAt && (now - card.lastReviewAt) < ONE_HOUR;
      return isReady && !recentlyReviewed;
    })
    .sort((a, b) => {
      const priorityDiff = (b.priorityBoost || 0) - (a.priorityBoost || 0);
      if (priorityDiff !== 0) return priorityDiff;
      return (a.nextReviewAt || 0) - (b.nextReviewAt || 0);
    });
}

/**
 * Obtient les cartes "prêtes bientôt"
 */
function getUpcomingCards(cards, now = Date.now()) {
  const NEXT_24H = 24 * 60 * 60 * 1000;

  return cards
    .filter(card => {
      const nextReview = card.nextReviewAt || now + 24 * 60 * 60 * 1000;
      const isUpcoming = nextReview > now && nextReview <= now + NEXT_24H;
      const isActive = card.status === 'active';
      return isUpcoming && isActive;
    })
    .map(card => ({
      ...card,
      timeUntilReady: (card.nextReviewAt || now) - now
    }))
    .sort((a, b) => a.timeUntilReady - b.timeUntilReady);
}

/**
 * Formate un délai en temps lisible
 */
function formatDelay(ms) {
  const totalSeconds = Math.round(ms / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor((totalSeconds / 3600) % 24);
  const days = Math.floor(totalSeconds / (3600 * 24));

  if (days > 0) return `${days}j ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

/**
 * Calcule la progression de la journée
 */
function getDailyProgress(reviews, goalPerDay = 20) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();

  const todayReviews = (reviews || []).filter(r => r.timestamp >= todayStart);
  const done = todayReviews.length;
  const goal = goalPerDay;
  const percentage = Math.min(100, Math.round((done / goal) * 100));

  return { done, goal, percentage };
}

/**
 * Calcule le streak actuel
 */
function calculateStreak(reviews, userProfile) {
  if (!reviews || reviews.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let currentDate = today.getTime();
  let streak = 0;

  for (let i = 0; i < 365; i++) {
    const dayStart = currentDate;
    const dayEnd = currentDate + 24 * 60 * 60 * 1000;
    const reviewsThisDay = reviews.filter(r => r.timestamp >= dayStart && r.timestamp < dayEnd);

    if (reviewsThisDay.length > 0) {
      streak++;
      currentDate -= 24 * 60 * 60 * 1000;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Parser CSV simple (front,back,tags)
 */
function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  const cards = [];

  for (const line of lines) {
    const parts = line.split(',').map(s => s.trim());
    if (parts[0] && parts[1]) {
      cards.push({
        front: parts[0],
        back: parts[1],
        tags: parts[2] ? parts[2].split(';').map(t => t.trim()) : []
      });
    }
  }

  return cards;
}
