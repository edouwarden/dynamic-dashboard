// ═══════════════════════════════════════════════
//  WORLD HEATMAP — app.js
// ═══════════════════════════════════════════════

// ─── DONNÉES PAR PAYS (ISO numeric → données) ───
// Sources approximatives 2024 : FMI, Banque Mondiale
const COUNTRY_DATA = {
  // ISO num : { name, flag, gdp (USD/hab), debt (% PIB) }
  4:   { name: "Afghanistan",         flag: "🇦🇫", gdp: 380,   debt: 7   },
  8:   { name: "Albanie",             flag: "🇦🇱", gdp: 6800,  debt: 65  },
  12:  { name: "Algérie",             flag: "🇩🇿", gdp: 4000,  debt: 58  },
  24:  { name: "Angola",              flag: "🇦🇴", gdp: 2100,  debt: 88  },
  32:  { name: "Argentine",           flag: "🇦🇷", gdp: 13000, debt: 89  },
  36:  { name: "Australie",           flag: "🇦🇺", gdp: 64000, debt: 57  },
  40:  { name: "Autriche",            flag: "🇦🇹", gdp: 55000, debt: 74  },
  50:  { name: "Bangladesh",          flag: "🇧🇩", gdp: 2700,  debt: 39  },
  56:  { name: "Belgique",            flag: "🇧🇪", gdp: 49000, debt: 108 },
  64:  { name: "Bhoutan",             flag: "🇧🇹", gdp: 3100,  debt: 112 },
  68:  { name: "Bolivie",             flag: "🇧🇴", gdp: 3800,  debt: 80  },
  76:  { name: "Brésil",              flag: "🇧🇷", gdp: 10300, debt: 88  },
  100: { name: "Bulgarie",            flag: "🇧🇬", gdp: 13000, debt: 29  },
  104: { name: "Myanmar",             flag: "🇲🇲", gdp: 1200,  debt: 60  },
  116: { name: "Cambodge",            flag: "🇰🇭", gdp: 1800,  debt: 37  },
  120: { name: "Cameroun",            flag: "🇨🇲", gdp: 1600,  debt: 45  },
  124: { name: "Canada",              flag: "🇨🇦", gdp: 54000, debt: 106 },
  140: { name: "Centrafrique",        flag: "🇨🇫", gdp: 500,   debt: 50  },
  152: { name: "Chili",               flag: "🇨🇱", gdp: 15000, debt: 38  },
  156: { name: "Chine",               flag: "🇨🇳", gdp: 12700, debt: 77  },
  170: { name: "Colombie",            flag: "🇨🇴", gdp: 7000,  debt: 58  },
  178: { name: "Congo",               flag: "🇨🇬", gdp: 2100,  debt: 101 },
  180: { name: "RD Congo",            flag: "🇨🇩", gdp: 600,   debt: 20  },
  188: { name: "Costa Rica",          flag: "🇨🇷", gdp: 13000, debt: 65  },
  191: { name: "Croatie",             flag: "🇭🇷", gdp: 19000, debt: 63  },
  192: { name: "Cuba",                flag: "🇨🇺", gdp: 9500,  debt: 86  },
  196: { name: "Chypre",              flag: "🇨🇾", gdp: 32000, debt: 78  },
  203: { name: "Tchéquie",            flag: "🇨🇿", gdp: 27000, debt: 45  },
  208: { name: "Danemark",            flag: "🇩🇰", gdp: 67000, debt: 28  },
  214: { name: "Rép. Dominicaine",    flag: "🇩🇴", gdp: 9900,  debt: 57  },
  218: { name: "Équateur",            flag: "🇪🇨", gdp: 6000,  debt: 58  },
  818: { name: "Égypte",              flag: "🇪🇬", gdp: 3800,  debt: 97  },
  222: { name: "Salvador",            flag: "🇸🇻", gdp: 4700,  debt: 82  },
  231: { name: "Éthiopie",            flag: "🇪🇹", gdp: 1100,  debt: 27  },
  233: { name: "Estonie",             flag: "🇪🇪", gdp: 28000, debt: 20  },
  246: { name: "Finlande",            flag: "🇫🇮", gdp: 53000, debt: 73  },
  250: { name: "France",              flag: "🇫🇷", gdp: 43000, debt: 112 },
  266: { name: "Gabon",               flag: "🇬🇦", gdp: 8000,  debt: 70  },
  276: { name: "Allemagne",           flag: "🇩🇪", gdp: 51000, debt: 64  },
  288: { name: "Ghana",               flag: "🇬🇭", gdp: 2400,  debt: 80  },
  300: { name: "Grèce",               flag: "🇬🇷", gdp: 21000, debt: 161 },
  320: { name: "Guatemala",           flag: "🇬🇹", gdp: 5000,  debt: 30  },
  332: { name: "Haïti",               flag: "🇭🇹", gdp: 1700,  debt: 22  },
  340: { name: "Honduras",            flag: "🇭🇳", gdp: 3000,  debt: 50  },
  348: { name: "Hongrie",             flag: "🇭🇺", gdp: 19000, debt: 74  },
  356: { name: "Inde",                flag: "🇮🇳", gdp: 2500,  debt: 83  },
  360: { name: "Indonésie",           flag: "🇮🇩", gdp: 4700,  debt: 39  },
  364: { name: "Iran",                flag: "🇮🇷", gdp: 4900,  debt: 30  },
  368: { name: "Irak",                flag: "🇮🇶", gdp: 6400,  debt: 48  },
  372: { name: "Irlande",             flag: "🇮🇪", gdp: 99000, debt: 43  },
  376: { name: "Israël",              flag: "🇮🇱", gdp: 52000, debt: 62  },
  380: { name: "Italie",              flag: "🇮🇹", gdp: 36000, debt: 139 },
  388: { name: "Jamaïque",            flag: "🇯🇲", gdp: 5900,  debt: 73  },
  392: { name: "Japon",               flag: "🇯🇵", gdp: 33000, debt: 255 },
  400: { name: "Jordanie",            flag: "🇯🇴", gdp: 4300,  debt: 93  },
  398: { name: "Kazakhstan",          flag: "🇰🇿", gdp: 11000, debt: 27  },
  404: { name: "Kenya",               flag: "🇰🇪", gdp: 2100,  debt: 70  },
  408: { name: "Corée du Nord",       flag: "🇰🇵", gdp: 1800,  debt: null},
  410: { name: "Corée du Sud",        flag: "🇰🇷", gdp: 33000, debt: 54  },
  414: { name: "Koweït",              flag: "🇰🇼", gdp: 35000, debt: 7   },
  418: { name: "Laos",                flag: "🇱🇦", gdp: 2400,  debt: 90  },
  422: { name: "Liban",               flag: "🇱🇧", gdp: 4500,  debt: 170 },
  434: { name: "Libye",               flag: "🇱🇾", gdp: 7000,  debt: 150 },
  440: { name: "Lituanie",            flag: "🇱🇹", gdp: 24000, debt: 38  },
  442: { name: "Luxembourg",          flag: "🇱🇺", gdp: 135000,debt: 26  },
  458: { name: "Malaisie",            flag: "🇲🇾", gdp: 13000, debt: 64  },
  466: { name: "Mali",                flag: "🇲🇱", gdp: 900,   debt: 52  },
  484: { name: "Mexique",             flag: "🇲🇽", gdp: 11000, debt: 52  },
  504: { name: "Maroc",               flag: "🇲🇦", gdp: 3800,  debt: 70  },
  508: { name: "Mozambique",          flag: "🇲🇿", gdp: 500,   debt: 102 },
  516: { name: "Namibie",             flag: "🇳🇦", gdp: 5000,  debt: 69  },
  524: { name: "Népal",               flag: "🇳🇵", gdp: 1200,  debt: 46  },
  528: { name: "Pays-Bas",            flag: "🇳🇱", gdp: 57000, debt: 49  },
  554: { name: "Nouvelle-Zélande",    flag: "🇳🇿", gdp: 48000, debt: 52  },
  558: { name: "Nicaragua",           flag: "🇳🇮", gdp: 2400,  debt: 44  },
  566: { name: "Nigéria",             flag: "🇳🇬", gdp: 2200,  debt: 38  },
  578: { name: "Norvège",             flag: "🇳🇴", gdp: 90000, debt: 42  },
  586: { name: "Pakistan",            flag: "🇵🇰", gdp: 1600,  debt: 77  },
  591: { name: "Panama",              flag: "🇵🇦", gdp: 14000, debt: 57  },
  598: { name: "Papouasie",           flag: "🇵🇬", gdp: 2700,  debt: 43  },
  600: { name: "Paraguay",            flag: "🇵🇾", gdp: 5800,  debt: 40  },
  604: { name: "Pérou",               flag: "🇵🇪", gdp: 7200,  debt: 34  },
  608: { name: "Philippines",         flag: "🇵🇭", gdp: 3700,  debt: 57  },
  616: { name: "Pologne",             flag: "🇵🇱", gdp: 21000, debt: 49  },
  620: { name: "Portugal",            flag: "🇵🇹", gdp: 25000, debt: 112 },
  630: { name: "Porto Rico",          flag: "🇵🇷", gdp: 35000, debt: 120 },
  642: { name: "Roumanie",            flag: "🇷🇴", gdp: 15000, debt: 49  },
  643: { name: "Russie",              flag: "🇷🇺", gdp: 15000, debt: 21  },
  682: { name: "Arabie Saoudite",     flag: "🇸🇦", gdp: 28000, debt: 26  },
  688: { name: "Serbie",              flag: "🇷🇸", gdp: 10000, debt: 56  },
  694: { name: "Sierra Leone",        flag: "🇸🇱", gdp: 500,   debt: 78  },
  703: { name: "Slovaquie",           flag: "🇸🇰", gdp: 22000, debt: 57  },
  705: { name: "Slovénie",            flag: "🇸🇮", gdp: 29000, debt: 69  },
  706: { name: "Somalie",             flag: "🇸🇴", gdp: 500,   debt: 70  },
  710: { name: "Afrique du Sud",      flag: "🇿🇦", gdp: 6200,  debt: 74  },
  724: { name: "Espagne",             flag: "🇪🇸", gdp: 33000, debt: 108 },
  729: { name: "Soudan",              flag: "🇸🇩", gdp: 600,   debt: 185 },
  752: { name: "Suède",               flag: "🇸🇪", gdp: 57000, debt: 34  },
  756: { name: "Suisse",              flag: "🇨🇭", gdp: 90000, debt: 40  },
  760: { name: "Syrie",               flag: "🇸🇾", gdp: 600,   debt: null},
  764: { name: "Thaïlande",           flag: "🇹🇭", gdp: 7500,  debt: 61  },
  788: { name: "Tunisie",             flag: "🇹🇳", gdp: 3800,  debt: 82  },
  792: { name: "Turquie",             flag: "🇹🇷", gdp: 14000, debt: 37  },
  800: { name: "Ouganda",             flag: "🇺🇬", gdp: 900,   debt: 51  },
  804: { name: "Ukraine",             flag: "🇺🇦", gdp: 5000,  debt: 88  },
  784: { name: "Émirats Arabes Unis", flag: "🇦🇪", gdp: 44000, debt: 30  },
  826: { name: "Royaume-Uni",         flag: "🇬🇧", gdp: 46000, debt: 101 },
  840: { name: "États-Unis",          flag: "🇺🇸", gdp: 80000, debt: 123 },
  858: { name: "Uruguay",             flag: "🇺🇾", gdp: 17000, debt: 66  },
  860: { name: "Ouzbékistan",         flag: "🇺🇿", gdp: 2300,  debt: 37  },
  862: { name: "Venezuela",           flag: "🇻🇪", gdp: 2600,  debt: null},
  704: { name: "Viêt Nam",            flag: "🇻🇳", gdp: 4100,  debt: 37  },
  887: { name: "Yémen",               flag: "🇾🇪", gdp: 700,   debt: 74  },
  894: { name: "Zambie",              flag: "🇿🇲", gdp: 1300,  debt: 145 },
  716: { name: "Zimbabwe",            flag: "🇿🇼", gdp: 1400,  debt: 96  },
};

// ─── CONFIGURATION DES COUCHES ───
const LAYERS = {
  gdp: {
    label: "PIB par habitant",
    unit: "USD/hab",
    key: "gdp",
    format: v => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`,
    colorScale: (v, min, max) => {
      // rouge → jaune → vert
      const t = Math.pow((v - min) / (max - min), 0.4);
      return d3.interpolateRdYlGn(t);
    },
    gradient: "linear-gradient(to right, #d73027, #fee08b, #1a9850)",
    minLabel: v => `$${(v/1000).toFixed(0)}k`,
    maxLabel: v => `$${(v/1000).toFixed(0)}k`,
  },
  debt: {
    label: "Dette / PIB",
    unit: "% du PIB",
    key: "debt",
    format: v => `${v}%`,
    colorScale: (v, min, max) => {
      // vert (faible dette) → rouge (dette élevée)
      const t = Math.pow((v - min) / (max - min), 0.5);
      return d3.interpolateRdYlGn(1 - t);
    },
    gradient: "linear-gradient(to right, #1a9850, #fee08b, #d73027)",
    minLabel: v => `${v}%`,
    maxLabel: v => `${v}%`,
  }
};

// ─── STATE ───
let currentLayer = 'gdp';
let selectedCountryId = null;
let worldData = null;
let svgEl, projection, path, gCountries, zoom;

// ─── FORMATAGE ───
function formatValue(layer, v) {
  if (v == null) return 'N/D';
  return LAYERS[layer].format(v);
}

function getFlagEmoji(iso2) {
  if (!iso2 || iso2.length !== 2) return '🌍';
  return [...iso2.toUpperCase()].map(c => String.fromCodePoint(0x1F1E0 - 65 + c.charCodeAt(0))).join('');
}

// ─── COULEUR PAYS ───
function getCountryColor(isoNum, layer) {
  const d = COUNTRY_DATA[isoNum];
  if (!d) return null;
  const val = d[LAYERS[layer].key];
  if (val == null) return null;

  const values = Object.values(COUNTRY_DATA)
    .map(c => c[LAYERS[layer].key])
    .filter(v => v != null);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return LAYERS[layer].colorScale(val, min, max);
}

// ─── LÉGENDE ───
function updateLegend(layer) {
  const cfg = LAYERS[layer];
  document.getElementById('legend-gradient').style.background = cfg.gradient;
  document.getElementById('legend-title').textContent = cfg.label;

  const values = Object.values(COUNTRY_DATA)
    .map(c => c[LAYERS[layer].key])
    .filter(v => v != null);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mid = Math.round((min + max) / 2);

  document.getElementById('legend-min').textContent = cfg.minLabel(min);
  document.getElementById('legend-mid').textContent = cfg.minLabel(mid);
  document.getElementById('legend-max').textContent = cfg.maxLabel(max);
}

// ─── CARTE ───
function renderMap(topology) {
  const wrapper = document.getElementById('map-wrapper');
  const W = wrapper.clientWidth;
  const H = wrapper.clientHeight;

  svgEl = d3.select('#world-map')
    .attr('width', W)
    .attr('height', H);

  svgEl.selectAll('*').remove();

  projection = d3.geoNaturalEarth1()
    .scale(W / 6.3)
    .translate([W / 2, H / 2]);

  path = d3.geoPath().projection(projection);

  // Fond océan
  svgEl.append('path')
    .datum({ type: 'Sphere' })
    .attr('class', 'sphere')
    .attr('d', path);

  // Graticule
  svgEl.append('path')
    .datum(d3.geoGraticule()())
    .attr('class', 'graticule')
    .attr('d', path);

  // Groupe pays
  gCountries = svgEl.append('g').attr('class', 'countries');

  const countries = topojson.feature(topology, topology.objects.countries);

  gCountries.selectAll('.country')
    .data(countries.features)
    .join('path')
    .attr('class', 'country')
    .attr('d', path)
    .each(function(d) {
      const isoNum = +d.id;
      const color = getCountryColor(isoNum, currentLayer);
      d3.select(this).attr('fill', color || '#1e293b');
      if (!color) d3.select(this).classed('no-data', true);
    })
    .on('mousemove', onMouseMove)
    .on('mouseleave', onMouseLeave)
    .on('click', onCountryClick);

  // Zoom
  zoom = d3.zoom()
    .scaleExtent([0.8, 12])
    .on('zoom', (event) => {
      gCountries.attr('transform', event.transform);
      // Adapter stroke selon zoom
      const k = event.transform.k;
      gCountries.selectAll('.country').attr('stroke-width', 0.4 / k);
      gCountries.selectAll('.country.selected').attr('stroke-width', 1.8 / k);
    });

  svgEl.call(zoom);

  // Boutons zoom
  document.getElementById('zoom-in').onclick = () => svgEl.transition().call(zoom.scaleBy, 1.5);
  document.getElementById('zoom-out').onclick = () => svgEl.transition().call(zoom.scaleBy, 0.67);
  document.getElementById('zoom-reset').onclick = () => svgEl.transition().call(zoom.transform, d3.zoomIdentity);
}

// ─── MISE À JOUR COULEURS ───
function updateColors() {
  if (!gCountries) return;
  gCountries.selectAll('.country')
    .each(function(d) {
      const isoNum = +d.id;
      const color = getCountryColor(isoNum, currentLayer);
      d3.select(this)
        .attr('fill', color || '#1e293b')
        .classed('no-data', !color);
    });
  updateLegend(currentLayer);
}

// ─── TOOLTIP ───
const tooltip = document.getElementById('tooltip');

function onMouseMove(event, d) {
  const isoNum = +d.id;
  const info = COUNTRY_DATA[isoNum];

  if (!info) {
    tooltip.classList.remove('visible');
    return;
  }

  const val = info[LAYERS[currentLayer].key];

  tooltip.innerHTML = `
    <div class="tt-name">
      <span class="tt-flag">${info.flag}</span>
      ${info.name}
    </div>
    <div class="tt-row">
      <span class="tt-key">${LAYERS[currentLayer].label}</span>
      <span class="tt-val">${formatValue(currentLayer, val)}</span>
    </div>
    ${currentLayer === 'gdp' && info.debt != null ? `
    <div class="tt-row">
      <span class="tt-key">Dette / PIB</span>
      <span class="tt-val">${info.debt}%</span>
    </div>` : ''}
    ${currentLayer === 'debt' && info.gdp != null ? `
    <div class="tt-row">
      <span class="tt-key">PIB/hab</span>
      <span class="tt-val">${formatValue('gdp', info.gdp)}</span>
    </div>` : ''}
    <div class="tt-click">🖱️ Cliquer pour sélectionner</div>
  `;

  const rect = document.getElementById('map-wrapper').getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const ttW = 220, ttH = 100;
  const left = Math.min(x + 14, rect.width - ttW - 10);
  const top = Math.max(y - ttH - 10, 5);

  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
  tooltip.classList.add('visible');
}

function onMouseLeave() {
  tooltip.classList.remove('visible');
}

// ─── SÉLECTION PAYS ───
async function onCountryClick(event, d) {
  const isoNum = +d.id;
  const info = COUNTRY_DATA[isoNum];
  if (!info) return;

  // Désélectionner l'ancien
  if (selectedCountryId !== null) {
    gCountries.selectAll('.country')
      .filter(cd => +cd.id === selectedCountryId)
      .classed('selected', false);
  }

  // Sélectionner le nouveau
  selectedCountryId = isoNum;
  d3.select(event.currentTarget).classed('selected', true);

  // Mettre à jour la barre supérieure
  document.getElementById('selected-flag').textContent = info.flag;
  document.getElementById('selected-name').textContent = info.name;
  document.getElementById('selected-value').textContent = formatValue(currentLayer, info[LAYERS[currentLayer].key]);

  // Publier la variable tab
  await setVar('pays_selectioner', {
    iso_num: isoNum,
    name: info.name,
    flag: info.flag,
    gdp: info.gdp,
    debt: info.debt,
    layer: currentLayer,
    value: info[LAYERS[currentLayer].key]
  });
}

// ─── CHANGEMENT DE COUCHE ───
function switchLayer(layer) {
  if (!LAYERS[layer]) return;
  currentLayer = layer;

  // Mettre à jour les boutons
  document.querySelectorAll('.layer-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.layer === layer);
  });

  // Recolorer la carte
  updateColors();

  // Mettre à jour la valeur affichée dans la barre si un pays est sélectionné
  if (selectedCountryId !== null) {
    const info = COUNTRY_DATA[selectedCountryId];
    if (info) {
      document.getElementById('selected-value').textContent = formatValue(layer, info[LAYERS[layer].key]);
    }
  }
}

// ─── INIT ───
async function init() {
  try {
    // Charger la topologie du monde
    const response = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
    if (!response.ok) throw new Error('Impossible de charger la carte');
    worldData = await response.json();

    renderMap(worldData);
    updateLegend(currentLayer);

    // Écouter les boutons de couche
    document.querySelectorAll('.layer-btn:not(.disabled)').forEach(btn => {
      btn.addEventListener('click', () => switchLayer(btn.dataset.layer));
    });

    // Redimensionnement
    const resizeObs = new ResizeObserver(() => {
      if (worldData) {
        renderMap(worldData);
        updateLegend(currentLayer);
        // Re-sélectionner si pays sélectionné
        if (selectedCountryId !== null) {
          gCountries.selectAll('.country')
            .filter(d => +d.id === selectedCountryId)
            .classed('selected', true);
        }
      }
    });
    resizeObs.observe(document.getElementById('map-wrapper'));

    // Masquer loading
    document.getElementById('loading').style.display = 'none';

  } catch (err) {
    console.error('Erreur init:', err);
    document.getElementById('loading').innerHTML = `
      <span>⚠️ Erreur de chargement</span>
      <span style="font-size:11px;opacity:0.6">${err.message}</span>
    `;
  }
}

// Attendre que D3 soit chargé
if (typeof d3 !== 'undefined' && typeof topojson !== 'undefined') {
  init();
} else {
  window.addEventListener('load', init);
}
