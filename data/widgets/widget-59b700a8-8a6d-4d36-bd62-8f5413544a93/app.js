// Chart widget — TradingView intégration avec variable d'onglet "asset"

let currentSymbol = null;
let currentCfg = {};

// Résout un ticker asset → symbole TradingView
function resolveSymbol(asset) {
  if (!asset) return 'BINANCE:BTCUSDT';
  const upper = asset.toString().toUpperCase();

  // Si déjà formaté avec exchange (ex: BINANCE:BTCUSDT, NASDAQ:AAPL)
  if (upper.includes(':')) return upper;

  // Crypto connues → Binance
  const cryptos = ['BTC','ETH','BNB','SOL','XRP','ADA','DOGE','AVAX','DOT','MATIC','LINK','LTC','BCH','ATOM','UNI','OP','ARB','SUI','APT'];
  if (cryptos.includes(upper)) return `BINANCE:${upper}USDT`;

  // Indices
  const indices = { SPX: 'SP:SPX', SPY: 'AMEX:SPY', QQQ: 'NASDAQ:QQQ', NDX: 'NASDAQ:NDX', DJI: 'DJ:DJI', VIX: 'CBOE:VIX' };
  if (indices[upper]) return indices[upper];

  // Forex
  const forex = ['EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','USDCAD','NZDUSD','XAUUSD','XAGUSD'];
  if (forex.includes(upper)) return `FX:${upper}`;

  // Commodités
  const commodities = { GLD: 'AMEX:GLD', XAU: 'TVC:GOLD', GOLD: 'TVC:GOLD', OIL: 'TVC:USOIL', SILVER: 'TVC:SILVER' };
  if (commodities[upper]) return commodities[upper];

  // Par défaut → tente NASDAQ
  return `NASDAQ:${upper}`;
}

function getTheme() {
  const bg = getComputedStyle(document.body).getPropertyValue('--color-bg').trim() || '#ffffff';
  const r = parseInt(bg.replace('#','').slice(0,2) || 'ff', 16);
  return r < 128 ? 'dark' : 'light';
}

// Construit les overrides TradingView (couleurs bougies + background)
function buildOverrides(cfg, theme) {
  const overrides = {};

  // --- Background ---
  if (cfg.backgroundMode === 'gradient') {
    const defaultStart = theme === 'dark' ? '#1a1a2e' : '#ffffff';
    const defaultEnd   = theme === 'dark' ? '#16213e' : '#f0f0f0';
    overrides['paneProperties.backgroundType'] = 'gradient';
    overrides['paneProperties.backgroundGradientStartColor'] = cfg.gradientColorStart || defaultStart;
    overrides['paneProperties.backgroundGradientEndColor']   = cfg.gradientColorEnd   || defaultEnd;
  } else if (cfg.backgroundColor && cfg.backgroundColor.trim()) {
    overrides['paneProperties.backgroundType'] = 'solid';
    overrides['paneProperties.background']     = cfg.backgroundColor.trim();
  }

  // --- Couleurs des bougies ---
  const defaults = {
    up:   { body: '#089981', border: '#089981', wick: '#089981' },
    down: { body: '#f23645', border: '#f23645', wick: '#f23645' }
  };

  const upBody   = cfg.candleUpColor        || defaults.up.body;
  const downBody = cfg.candleDownColor      || defaults.down.body;
  const upBorder = cfg.candleBorderUpColor  || upBody;
  const downBorder = cfg.candleBorderDownColor || downBody;
  const upWick   = cfg.candleWickUpColor    || upBody;
  const downWick = cfg.candleWickDownColor  || downBody;

  overrides['mainSeriesProperties.candleStyle.upColor']         = upBody;
  overrides['mainSeriesProperties.candleStyle.downColor']       = downBody;
  overrides['mainSeriesProperties.candleStyle.borderUpColor']   = upBorder;
  overrides['mainSeriesProperties.candleStyle.borderDownColor'] = downBorder;
  overrides['mainSeriesProperties.candleStyle.wickUpColor']     = upWick;
  overrides['mainSeriesProperties.candleStyle.wickDownColor']   = downWick;

  return overrides;
}

// Construit la liste des études TradingView à partir d'une string "SMA,EMA,RSI"
function buildStudies(indicatorString) {
  if (!indicatorString || indicatorString.trim() === '') return [];

  // Format correct pour l'embed TradingView : "RSI@tv-basicstudies"
  const studyMap = {
    'SMA':    'MASimple@tv-basicstudies',
    'EMA':    'MAExp@tv-basicstudies',
    'RSI':    'RSI@tv-basicstudies',
    'MACD':   'MACD@tv-basicstudies',
    'BBANDS': 'BB@tv-basicstudies',
    'BB':     'BB@tv-basicstudies',
    'STOCH':  'Stochastic@tv-basicstudies',
    'ATR':    'ATR@tv-basicstudies',
    'ADX':    'ADX@tv-basicstudies',
    'CCI':    'CCI@tv-basicstudies',
    'OBV':    'OBV@tv-basicstudies',
    'MOM':    'Momentum@tv-basicstudies',
    'ROC':    'ROC@tv-basicstudies',
    'VOL':    'Volume@tv-basicstudies'
  };

  const studies = [];
  indicatorString.split(',').forEach(s => {
    const key = s.trim().toUpperCase();
    if (studyMap[key]) studies.push(studyMap[key]);
  });

  return studies;
}

function loadTradingView(symbol, cfg) {
  const container = document.getElementById('tradingview-widget');
  container.innerHTML = '';

  const theme = getTheme();

  const tvContainer = document.createElement('div');
  tvContainer.className = 'tradingview-widget-container';
  tvContainer.style.cssText = 'width:100%;height:100%;';

  const widget = document.createElement('div');
  widget.className = 'tradingview-widget-container__widget';
  widget.style.cssText = 'width:100%;height:100%;';

  const uiLang = new URLSearchParams(window.location.search).get('lang');

  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
  script.async = true;

  const tvParams = {
    autosize: true,
    symbol: symbol,
    interval: cfg.interval || 'D',
    timezone: cfg.timezone || 'Etc/UTC',
    theme: theme,
    style: cfg.chartStyle || '1',
    locale: cfg.locale || (uiLang === 'en' ? 'en' : 'fr'),
    allow_symbol_change: cfg.allowSymbolChange === true,
    calendar: cfg.showCalendar === true,
    support_host: 'https://www.tradingview.com',
    hide_top_toolbar: cfg.hideToolbar === true,
    hide_side_toolbar: cfg.hideSideToolbar === true,
    hide_legend: cfg.hideLegend === true,
    save_image: false,
    hide_volume: cfg.hideVolume === true,
    withdateranges: cfg.showDateRanges !== false
  };

  // Overrides couleurs + background (seule méthode supportée par l'embed)
  const overrides = buildOverrides(cfg, theme);
  if (overrides && Object.keys(overrides).length > 0) {
    tvParams.overrides = overrides;
  }

  // Indicateurs par défaut
  const studies = buildStudies(cfg.defaultIndicators || '');
  if (studies.length > 0) {
    tvParams.studies = studies;
  }

  // Panneau indicateurs ouvert par défaut
  if (cfg.defaultIndicatorsOpen === true) {
    tvParams.details = true;
  }

  // Échelle des prix
  if (cfg.scalePosition && cfg.scalePosition !== 'right') {
    tvParams.scale_position = cfg.scalePosition;
  }
  if (cfg.scaleMode && cfg.scaleMode !== 'Normal') {
    tvParams.scale_mode = cfg.scaleMode;
  }

  script.textContent = JSON.stringify(tvParams);

  tvContainer.appendChild(widget);
  tvContainer.appendChild(script);
  container.appendChild(tvContainer);
}

function updateHeader(cfg) {
  const header = document.getElementById('chart-header');
  const titleEl = document.getElementById('chart-title-text');
  const tooltipWrapper = document.getElementById('chart-tooltip-wrapper');
  const tooltipPopup = tooltipWrapper ? tooltipWrapper.querySelector('.chart-tooltip-popup') : null;

  const title = (cfg.chartTitle || '').trim();
  const tooltip = (cfg.chartTooltip || '').trim();

  if (title) {
    titleEl.textContent = title;
    header.style.display = 'flex';
  } else {
    header.style.display = 'none';
  }

  if (title && tooltip) {
    tooltipPopup.textContent = tooltip;
    tooltipWrapper.style.display = 'flex';
  } else {
    tooltipWrapper.style.display = 'none';
  }
}

function updateChart(asset, cfg) {
  const symbol = resolveSymbol(asset);
  const cfgKey = JSON.stringify(cfg);

  // Recharge si le symbole OU la config change
  if (symbol === currentSymbol && cfgKey === JSON.stringify(currentCfg)) return;
  currentSymbol = symbol;
  currentCfg = { ...cfg };

  loadTradingView(symbol, cfg);
}

// Init
async function init() {
  try {
    const cfg = await resolveConfig(config);

    updateHeader(cfg);

    if (cfg.ticker) {
      updateChart(cfg.ticker, cfg);

      onConfigChange((newCfg) => {
        updateHeader(newCfg);
        if (newCfg.ticker) updateChart(newCfg.ticker, newCfg);
      });
    } else {
      const asset = await getVar('asset');
      updateChart(asset || 'BTC', cfg);

      onConfigChange((newCfg) => {
        updateHeader(newCfg);
        updateChart(currentSymbol, newCfg);
      });

      watchVar('asset', (newVal) => {
        if (newVal) updateChart(newVal, currentCfg);
      });
    }
  } catch (err) {
    console.error('[Chart] Erreur init:', err);
    updateChart('BTC', {});
  }
}

init();
