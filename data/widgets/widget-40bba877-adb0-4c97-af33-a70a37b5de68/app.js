// 🌅 Morning Dew - Lecteur vidéo du jour avec citation

let currentVideos = [];
let currentQuotes = [];
let todayIndex = 0;

/**
 * Extrait l'ID YouTube d'une URL
 * Supporte les formats:
 * - https://www.youtube.com/watch?v=ID
 * - https://youtu.be/ID
 * - Juste l'ID
 */
function extractYouTubeId(url) {
  if (!url) return null;

  // Si c'est déjà juste un ID
  if (!/^https?:\/\//.test(url)) return url;

  // Format: youtube.com/watch?v=ID
  const match1 = url.match(/[?&]v=([^&]+)/);
  if (match1) return match1[1];

  // Format: youtu.be/ID
  const match2 = url.match(/youtu\.be\/([^?&]+)/);
  if (match2) return match2[1];

  return null;
}

/**
 * Obtient l'index de la vidéo du jour (déterministe basé sur la date)
 */
function getTodayIndex(videoCount) {
  if (!videoCount) return 0;
  const today = new Date();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
  return dayOfYear % videoCount;
}

/**
 * Charge la vidéo du jour et sa citation
 */
function loadTodayVideo() {
  if (!currentVideos.length) {
    console.warn('Aucune vidéo configurée');
    return;
  }

  todayIndex = getTodayIndex(currentVideos.length);
  const videoId = extractYouTubeId(currentVideos[todayIndex]);
  const quote = currentQuotes[todayIndex] || '✨';

  // Charger la vidéo
  if (videoId) {
    const iframeUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1&controls=0&rel=0`;
    const player = document.getElementById('videoPlayer');
    if (player) {
      player.src = iframeUrl;
    }
  }

  // Afficher la citation
  const quoteEl = document.getElementById('quoteText');
  if (quoteEl) {
    quoteEl.textContent = quote;
  }

  console.log(`🌅 Vidéo du jour: ${todayIndex + 1}/${currentVideos.length}`);
}


/**
 * Parse une string avec séparateur ||| en array, trim chaque élément
 */
function parseConfig(text) {
  if (Array.isArray(text)) return text;
  if (!text || typeof text !== 'string') return [];
  return text
    .split('|||')
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

/**
 * Initialise le widget
 */
async function initMorningDew() {
  try {
    // Résoudre la config (remplace $var:xxx)
    const cfg = await resolveConfig(config);

    // Parser les listes de vidéos et citations avec séparateur |||
    currentVideos = parseConfig(cfg.videos);
    currentQuotes = parseConfig(cfg.quotes);

    // Valider les listes
    if (!currentVideos.length) {
      console.error('Aucune vidéo configurée. Ajoute des URLs YouTube dans les paramètres (séparées par |||).');
      document.getElementById('quoteText').textContent = '⚙️ Configure les vidéos dans les paramètres';
      return;
    }

    // S'assurer que nous avons autant de citations que de vidéos
    if (currentQuotes.length < currentVideos.length) {
      console.warn(`Seulement ${currentQuotes.length} citations pour ${currentVideos.length} vidéos. Les citations manquantes seront vides.`);
    }

    // Charger la vidéo du jour au démarrage
    loadTodayVideo();

    // Écouter les changements de config
    onConfigChange((newCfg) => {
      currentVideos = parseConfig(newCfg.videos);
      currentQuotes = parseConfig(newCfg.quotes);
      loadTodayVideo();
    });

    console.log('✅ Morning Dew initialisé:', { videos: currentVideos.length, quotes: currentQuotes.length });
  } catch (err) {
    console.error('Erreur lors de l\'initialisation:', err);
  }
}

// Lancer l'initialisation une fois que le DOM est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMorningDew);
} else {
  initMorningDew();
}