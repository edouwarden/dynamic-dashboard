// Données des marchés mondiaux avec fuseaux horaires
const MARKETS = [
  {
    id: 'nyse',
    name: 'New York',
    exchange: 'NYSE/NASDAQ',
    openTime: '09:30',
    closeTime: '16:00',
    timezone: 'America/New_York',
    symbol: '🗽',
    color: '#1E90FF'
  },
  {
    id: 'lse',
    name: 'Londres',
    exchange: 'LSE',
    openTime: '08:00',
    closeTime: '16:30',
    timezone: 'Europe/London',
    symbol: '🇬🇧',
    color: '#DC143C'
  },
  {
    id: 'euronext',
    name: 'Paris',
    exchange: 'Euronext',
    openTime: '09:00',
    closeTime: '17:30',
    timezone: 'Europe/Paris',
    symbol: '🇫🇷',
    color: '#FFD700'
  },
  {
    id: 'tse',
    name: 'Tokyo',
    exchange: 'TSE',
    openTime: '09:00',
    closeTime: '15:00',
    timezone: 'Asia/Tokyo',
    symbol: '🗾',
    color: '#FF6B6B'
  },
  {
    id: 'hkex',
    name: 'Hong Kong',
    exchange: 'HKEx',
    openTime: '09:30',
    closeTime: '16:00',
    timezone: 'Asia/Hong_Kong',
    symbol: '🇭🇰',
    color: '#FF1493'
  },
  {
    id: 'sse',
    name: 'Shanghai',
    exchange: 'SSE',
    openTime: '09:30',
    closeTime: '15:00',
    timezone: 'Asia/Shanghai',
    symbol: '🇨🇳',
    color: '#FF4500'
  },
  {
    id: 'sgx',
    name: 'Singapour',
    exchange: 'SGX',
    openTime: '09:00',
    closeTime: '17:00',
    timezone: 'Asia/Singapore',
    symbol: '🇸🇬',
    color: '#228B22'
  },
  {
    id: 'asx',
    name: 'Sydney',
    exchange: 'ASX',
    openTime: '10:00',
    closeTime: '16:00',
    timezone: 'Australia/Sydney',
    symbol: '🇦🇺',
    color: '#00CED1'
  },
  {
    id: 'tsx',
    name: 'Toronto',
    exchange: 'TSX',
    openTime: '09:30',
    closeTime: '16:00',
    timezone: 'America/Toronto',
    symbol: '🇨🇦',
    color: '#FF0000'
  }
];

// Fonction pour obtenir l'heure actuelle dans un fuseau donné
function getTimeInTimezone(timezone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  return formatter.format(new Date());
}

// Fonction pour convertir HH:MM en minutes
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Fonction pour formater les minutes en HH:MM
function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// Analyser l'état d'un marché
function analyzeMarket(market) {
  const currentTimeStr = getTimeInTimezone(market.timezone);
  const [hours, minutes, seconds] = currentTimeStr.split(':').map(Number);
  const currentMinutes = hours * 60 + minutes;

  const openMinutes = timeToMinutes(market.openTime);
  const closeMinutes = timeToMinutes(market.closeTime);

  let isOpen = false;
  let timeUntilChange = 0;
  let nextEvent = '';

  if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
    // Marché ouvert
    isOpen = true;
    timeUntilChange = closeMinutes - currentMinutes;
    nextEvent = 'Fermeture';
  } else if (currentMinutes < openMinutes) {
    // Marché pas encore ouvert (même jour)
    isOpen = false;
    timeUntilChange = openMinutes - currentMinutes;
    nextEvent = 'Ouverture';
  } else {
    // Marché fermé (réouverture demain)
    isOpen = false;
    timeUntilChange = (24 * 60) - currentMinutes + openMinutes;
    nextEvent = 'Réouverture';
  }

  return {
    ...market,
    currentTime: currentTimeStr,
    isOpen,
    timeUntilChange,
    nextEvent,
    seconds
  };
}

// Formater le temps restant
function formatTimeRemaining(minutes) {
  if (minutes < 60) {
    return `${minutes} min`;
  } else {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }
}

// Créer le HTML pour une ligne de marché
function createMarketRow(market) {
  const cls = market.isOpen ? 'open' : 'closed';
  const timeText = formatTimeRemaining(market.timeUntilChange);
  return `
    <div class="market-row">
      <span class="market-flag">${market.symbol}</span>
      <span class="market-name">${market.name}</span>
      <span class="market-dot ${cls}"></span>
      <span class="market-countdown ${cls}">${timeText}</span>
    </div>
  `;
}

// Fonction principale de mise à jour
function updateMarkets() {
  const analyzedMarkets = MARKETS.map(analyzeMarket);

  // Trier : ouverts d'abord, puis par temps restant
  analyzedMarkets.sort((a, b) => {
    if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
    return a.timeUntilChange - b.timeUntilChange;
  });

  const list = document.getElementById('markets-list');
  if (list) list.innerHTML = analyzedMarkets.map(createMarketRow).join('');
}

// Initialiser le widget
async function init() {
  const cfg = await resolveConfig();

  // Mise à jour initiale
  updateMarkets();

  // Mise à jour toutes les secondes
  setInterval(updateMarkets, 1000);

  // Optionnel : écouter les changements de config
  onConfigChange((newCfg, changedKey, newValue) => {
    console.log(`Config changée: ${changedKey} = ${newValue}`);
  });
}

// Démarrer quand le DOM est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
