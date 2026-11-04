// ── Life Calendar — app.js ──────────────────────────────────────────

let eras = [], milestones = [], eraImages = {};
let editingEraId = null, editingMilestoneId = null;
let pendingImages = []; // images added in modal before save

// Drag-to-create state
const drag = { startYear: null, endYear: null, active: false };
let dragGuard = false;

const YEAR_START = 2000, YEAR_END = 2239, YEARS_PER_ROW = 20;

const EMOJIS = ['🏆','🎓','💍','👶','🏠','💼','✈️','❤️','🎉','💪',
                '🌟','🎯','📚','🚀','🌱','🤝','💰','🏅','🎨','🎵',
                '🔥','🧠','🌍','🏋️','🎭','🏄','🎸','📸','🌺','⚡'];

const COLOR_PALETTE = [
  '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#84cc16', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1'
];

// ── DATA ──────────────────────────────────────────────────────────────

async function loadAll() {
  try {
    const [erasData, msData, imgsData] = await Promise.all([
      queryDB({ table: 'life_eras', action: 'select' }),
      queryDB({ table: 'life_milestones', action: 'select' }),
      queryDB({ table: 'life_era_images', action: 'select' })
    ]);
    eras = erasData;
    milestones = msData;
    // Group images by era_id
    eraImages = {};
    for (const img of imgsData) {
      if (!eraImages[img.era_id]) eraImages[img.era_id] = [];
      eraImages[img.era_id].push(img);
    }
    // Sort each era's images by order_index
    for (const k of Object.keys(eraImages)) {
      eraImages[k].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    }
    render();
  } catch (e) {
    console.error('loadAll error:', e);
  }
}

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

function yearOf(dateStr) {
  if (!dateStr) return null;
  return parseInt(String(dateStr).substring(0, 4));
}

function formatEraDate(year, month) {
  if (!year) return '…';
  const m = month || 1;
  return `${MONTHS[m - 1]} ${year}`;
}

function getEraForYear(year) {
  return eras.find(e => {
    const s = yearOf(e.start_date);
    const en = e.end_date ? yearOf(e.end_date) : YEAR_END;
    return s !== null && year >= s && year <= en;
  });
}

function getErasForYear(year) {
  return eras.filter(e => {
    const s = yearOf(e.start_date);
    const en = e.end_date ? yearOf(e.end_date) : YEAR_END;
    return s !== null && year >= s && year <= en;
  }).sort((a, b) => (yearOf(a.start_date) || 0) - (yearOf(b.start_date) || 0));
}

function getEraMonthStyleForYear(year, era) {
  // Retourne { startPercent, endPercent } pour remplissage visuel de la cellule
  if (!era) return null;

  const startYear = yearOf(era.start_date);
  const endYear = era.end_date ? yearOf(era.end_date) : YEAR_END;
  const startMonth = era.start_month || 1;
  const endMonth = era.end_month || 12;

  let startPercent = 0, endPercent = 100;

  // Si c'est l'année de début, commencer au mois spécifié
  if (year === startYear) {
    startPercent = ((startMonth - 1) / 12) * 100;
  }

  // Si c'est l'année de fin, finir au mois spécifié
  if (year === endYear) {
    endPercent = (endMonth / 12) * 100;
  }

  return { startPercent, endPercent };
}

function getMilestonesForYear(year) {
  return milestones.filter(m => yearOf(m.date) === year);
}

// ── RENDER ────────────────────────────────────────────────────────────

function render() {
  renderLegend();
  renderTimeline();
}

function renderLegend() {
  const el = document.getElementById('eras-legend');
  if (!eras.length) {
    el.innerHTML = '<span class="no-eras-hint">Aucune ère — clique sur une année pour en créer une</span>';
    return;
  }
  el.innerHTML = [...eras]
    .sort((a, b) => (yearOf(a.start_date) || 0) - (yearOf(b.start_date) || 0))
    .map(e => {
      const s = yearOf(e.start_date);
      const en = e.end_date ? yearOf(e.end_date) : '…';
      const startDisplay = formatEraDate(s, e.start_month);
      const endDisplay = e.end_date ? formatEraDate(en, e.end_month) : '…';
      const imgCount = (eraImages[e.id] || []).length;
      const firstImg = (eraImages[e.id] || [])[0]?.url;
      const eraImgStyle = firstImg ? `background-image:url('${firstImg}')` : '';
      const dotImgStyle = firstImg ? `background-image:url('${firstImg}')` : `background:${e.color}`;

      return `<div class="era-chip"
        style="background:${e.color}22;border-color:${e.color}55;color:${e.color};${eraImgStyle}"
        onclick="openVisionBoard(${e.id})" title="Voir le vision board">
        <span class="era-dot" style="${dotImgStyle}"></span>
        <span>${e.name}</span>
        <span class="era-years">${startDisplay}–${endDisplay}</span>
        ${imgCount ? `<span class="img-count">🖼 ${imgCount}</span>` : ''}
      </div>`;
    }).join('');
}

function renderTimeline() {
  const wrap = document.getElementById('life-timeline');
  const currentYear = new Date().getFullYear();
  let html = '';

  for (let rowStart = YEAR_START; rowStart < YEAR_END; rowStart += YEARS_PER_ROW) {
    html += `<div class="decade-row">
      <div class="decade-label">${rowStart}</div>
      <div class="years-row">`;

    for (let y = rowStart; y < rowStart + YEARS_PER_ROW && y <= YEAR_END; y++) {
      const eras_for_year = getErasForYear(y);
      const ym = getMilestonesForYear(y);
      const isCurrent = (y === currentYear);
      const isPast = (y < currentYear);

      const cls = [
        !eras_for_year.length ? 'no-era' : '',
        isPast ? 'past' : isCurrent ? 'current' : 'future'
      ].filter(Boolean).join(' ');

      const tip = [
        y,
        ...eras_for_year.map(e => `📍 ${e.name}`),
        ...ym.map(m => `${m.icon || '📌'} ${m.title}`)
      ].filter(Boolean).join(' · ');

      html += `<div class="year-cell ${cls}"
        title="${tip}"
        onclick="onYearClick(event,${y})"
        data-year="${y}">`;

      // Créer des couches pour chaque era
      if (eras_for_year.length > 0) {
        eras_for_year.forEach((era, idx) => {
          const monthRange = getEraMonthStyleForYear(y, era);
          if (monthRange) {
            const { startPercent, endPercent } = monthRange;

            const colorStart = era.color || '#6366f1';
            const colorFull = `${colorStart}ff`;
            const colorMedium = `${colorStart}dd`;
            const colorLight = `${colorStart}44`;
            const colorVeryLight = `${colorStart}11`;

            let layerStyle = `position:absolute;top:0;left:0;right:0;bottom:0;z-index:${idx};`;

            if (era.image_url) {
              const maskGradient = `linear-gradient(90deg,
                transparent 0%,
                transparent calc(${startPercent}% - 2%),
                black ${startPercent}%,
                black calc(${endPercent}% - 2%),
                transparent ${endPercent}%,
                transparent 100%
              )`;
              layerStyle += `background:
                url('${era.image_url}') center/cover,
                linear-gradient(90deg,
                  ${colorVeryLight} 0%,
                  ${colorVeryLight} calc(${startPercent}% - 2%),
                  ${colorLight} ${startPercent}%,
                  ${colorMedium} calc(${startPercent}% + 3%),
                  ${colorFull} calc(${startPercent}% + 6%),
                  ${colorFull} calc(${endPercent}% - 6%),
                  ${colorMedium} calc(${endPercent}% - 3%),
                  ${colorLight} ${endPercent}%,
                  ${colorVeryLight} calc(${endPercent}% + 2%),
                  ${colorVeryLight} 100%
                );
                -webkit-mask-image: ${maskGradient};
                mask-image: ${maskGradient};
                opacity:0.7;`;
            } else {
              layerStyle += `background: linear-gradient(90deg,
                ${colorVeryLight} 0%,
                ${colorVeryLight} calc(${startPercent}% - 2%),
                ${colorLight} ${startPercent}%,
                ${colorMedium} calc(${startPercent}% + 3%),
                ${colorFull} calc(${startPercent}% + 6%),
                ${colorFull} calc(${endPercent}% - 6%),
                ${colorMedium} calc(${endPercent}% - 3%),
                ${colorLight} ${endPercent}%,
                ${colorVeryLight} calc(${endPercent}% + 2%),
                ${colorVeryLight} 100%
              );
              opacity:0.8;`;
            }

            html += `<div class="era-layer" style="${layerStyle}"></div>`;
          }
        });
      }

      // Contenu (milestones)
      html += `<div style="position:relative;z-index:10;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">`;

      if (ym.length === 1) {
        html += `<span class="ms-icon">${ym[0].icon || '📌'}</span>`;
      } else if (ym.length > 1) {
        html += `<span class="ms-icon">${ym[0].icon || '📌'}</span>
          <span class="ms-count">+${ym.length - 1}</span>`;
      }

      html += `</div></div>`;
    }

    html += `</div></div>`;
  }

  wrap.innerHTML = html;

  requestAnimationFrame(() => {
    const cur = wrap.querySelector('.year-cell.current');
    if (cur) cur.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
}

// ── DRAG TO CREATE ERA ─────────────────────────────────────────────────

function setupDragCreate() {
  const timeline = document.getElementById('life-timeline');

  timeline.addEventListener('mousedown', e => {
    const cell = e.target.closest('.year-cell');
    if (!cell) return;
    e.preventDefault();
    drag.startYear = parseInt(cell.dataset.year);
    drag.endYear   = drag.startYear;
    drag.active    = false;
    timeline.style.userSelect = 'none';
  });

  window.addEventListener('pointermove', e => {
    if (drag.startYear === null) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cell = el?.closest?.('.year-cell');
    if (!cell) return;
    const y = parseInt(cell.dataset.year);
    if (y !== drag.endYear) {
      if (y !== drag.startYear) drag.active = true;
      drag.endYear = y;
      updateDragHighlight(e.clientX, e.clientY);
    }
  });

  window.addEventListener('mouseup', e => {
    if (drag.startYear === null) return;
    const wasActive = drag.active;
    const from = Math.min(drag.startYear, drag.endYear);
    const to   = Math.max(drag.startYear, drag.endYear);

    clearDragHighlight();
    drag.startYear = null;
    drag.endYear   = null;
    drag.active    = false;
    timeline.style.userSelect = '';

    if (wasActive) {
      dragGuard = true;
      setTimeout(() => { dragGuard = false; }, 80);
      closeMenu();
      openEraModal(null, from, to);
    }
  });
}

function updateDragHighlight(mx, my) {
  const from = Math.min(drag.startYear, drag.endYear);
  const to   = Math.max(drag.startYear, drag.endYear);

  document.querySelectorAll('.year-cell').forEach(cell => {
    const y = parseInt(cell.dataset.year);
    cell.classList.toggle('drag-select', y >= from && y <= to);
  });

  if (!drag.active) return;
  const span = to - from + 1;
  const ind  = document.getElementById('drag-indicator');
  ind.textContent = `🌅 ${from} → ${to} · ${span} an${span > 1 ? 's' : ''}`;
  ind.style.left = Math.min(mx + 18, window.innerWidth - 220) + 'px';
  ind.style.top  = Math.max(my - 40, 6) + 'px';
  ind.classList.add('visible');
}

function clearDragHighlight() {
  document.querySelectorAll('.year-cell.drag-select')
    .forEach(c => c.classList.remove('drag-select'));
  document.getElementById('drag-indicator')?.classList.remove('visible');
}

// ── YEAR CONTEXT MENU ──────────────────────────────────────────────────

function closeMenu() {
  document.getElementById('year-menu').classList.add('hidden');
}

document.addEventListener('click', e => {
  if (!e.target.closest('#year-menu') && !e.target.closest('.year-cell')) closeMenu();
});

function onYearClick(evt, year) {
  if (dragGuard) return;
  evt.stopPropagation();
  const menu = document.getElementById('year-menu');
  const era = getEraForYear(year);
  const ym = getMilestonesForYear(year);

  let msItems = ym.map(m =>
    `<button class="menu-item" onclick="openMilestoneModal(${m.id});closeMenu()">
      ${m.icon || '📌'} ${m.title}
    </button>`
  ).join('');

  menu.innerHTML = `
    <div class="ym-title">📅 ${year}</div>
    ${era ? `<div class="ym-era-badge" style="border-color:${era.color}55;background:${era.color}18;color:${era.color}">${era.name}</div>` : ''}
    ${msItems}
    <button class="menu-item" onclick="openMilestoneModal(null,${year});closeMenu()">📌 Ajouter une étape</button>
    ${era ? `
      <button class="menu-item" onclick="openVisionBoard(${era.id});closeMenu()">🖼️ Vision Board</button>
      <button class="menu-item" onclick="openEraModal(${era.id});closeMenu()">✏️ Modifier l'ère</button>
    ` : `<button class="menu-item" onclick="openEraModal(null,${year});closeMenu()">🌅 Créer une ère ici</button>`}
  `;

  const cell = evt.currentTarget;
  const rect = cell.getBoundingClientRect();
  const menuW = 190, menuH = 160;
  let left = rect.left;
  let top = rect.bottom + 5;
  if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
  if (top + menuH > window.innerHeight - 8) top = rect.top - menuH - 5;

  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
  menu.classList.remove('hidden');
}

// ── ERA MODAL ─────────────────────────────────────────────────────────

function openEraModal(eraId = null, defaultYear = null, defaultEndYear = null) {
  editingEraId = eraId;
  const era = eraId ? eras.find(e => e.id === eraId) : null;

  document.getElementById('era-modal-title').textContent = era ? '✏️ Modifier l\'ère' : '🌅 Nouvelle ère';
  document.getElementById('era-name').value      = era?.name ?? '';
  document.getElementById('era-desc').value      = era?.description ?? '';
  document.getElementById('era-start').value     = era ? (yearOf(era.start_date) ?? '') : (defaultYear ?? new Date().getFullYear());
  document.getElementById('era-start-month').value = era?.start_month ?? '1';
  document.getElementById('era-end').value       = era?.end_date ? (yearOf(era.end_date) ?? '') : (defaultEndYear ?? '');
  document.getElementById('era-end-month').value = era?.end_month ?? '12';
  document.getElementById('era-color').value     = era?.color ?? '#6366f1';
  document.getElementById('era-current').checked = !!era?.is_current;

  pendingImages = eraId ? (eraImages[eraId] || []).map(i => ({ ...i })) : [];
  // Initialiser l'image sélectionnée (de l'ère existante ou vide)
  const selectedImageUrl = era?.image_url ?? '';
  document.getElementById('era-image').value = selectedImageUrl;

  renderEraImagesGrid();
  renderColorPicker();
  renderEraImageSelector();

  document.getElementById('era-delete-btn').style.display = eraId ? 'flex' : 'none';
  document.getElementById('era-modal').classList.remove('hidden');
}

function renderColorPicker() {
  const picker = document.getElementById('era-color-picker');
  const currentColor = document.getElementById('era-color').value;

  picker.innerHTML = COLOR_PALETTE.map(color => `
    <button class="color-swatch ${color === currentColor ? 'selected' : ''}"
      style="background-color:${color}"
      onclick="selectEraColor('${color}')"
      title="${color}">
      ${color === currentColor ? '✓' : ''}
    </button>
  `).join('') + `
    <div class="color-custom-wrapper">
      <input type="color" id="era-color-custom" value="${currentColor}"
        onchange="selectEraColor(this.value)" style="width:100%;height:40px;border:none;border-radius:var(--border-radius)">
    </div>
  `;
}

function selectEraColor(color) {
  document.getElementById('era-color').value = color;
  renderColorPicker();
}

function renderEraImageSelector() {
  const gallery = document.getElementById('era-image-gallery');
  const currentImage = document.getElementById('era-image').value;

  if (!pendingImages.length) {
    gallery.innerHTML = '<div class="image-gallery-empty">Ajoute des images au vision board pour en sélectionner une</div>';
    updateEraPreview();
    return;
  }

  gallery.innerHTML = pendingImages.map((img, idx) => `
    <div class="image-thumb ${img.url === currentImage ? 'selected' : ''}"
      onclick="selectEraImage('${idx}')"
      title="${img.caption || ''}"
      style="background-image:url('${img.url}')">
      ${img.url === currentImage ? '<span class="image-thumb-check">✓</span>' : ''}
    </div>
  `).join('');

  updateEraPreview();
}

function selectEraImage(idx) {
  const img = pendingImages[parseInt(idx)];
  if (img) {
    document.getElementById('era-image').value = img.url;
    renderEraImageSelector();
  }
}

function updateEraPreview() {
  const url = document.getElementById('era-image').value.trim();
  const p = document.getElementById('era-preview');
  const empty = document.querySelector('.era-preview-empty');
  if (url) {
    p.src = url;
    p.style.display = 'block';
    if (empty) empty.style.display = 'none';
  } else {
    p.style.display = 'none';
    if (empty) empty.style.display = 'block';
  }
}

async function saveEra() {
  const name = document.getElementById('era-name').value.trim();
  if (!name) return alert('Le nom est requis');

  const startY = parseInt(document.getElementById('era-start').value);
  const endRaw = document.getElementById('era-end').value;
  const endY = endRaw ? parseInt(endRaw) : null;
  if (isNaN(startY)) return alert('Année de début invalide');

  const explicitImg = document.getElementById('era-image').value.trim();
  const mainImg = explicitImg || (pendingImages.length ? pendingImages[0].url : null);

  const startMonth = parseInt(document.getElementById('era-start-month').value);
  const endMonth = parseInt(document.getElementById('era-end-month').value);

  const data = {
    name,
    description: document.getElementById('era-desc').value.trim() || null,
    start_date: `${startY}-01-01`,
    start_month: startMonth,
    end_date: endY ? `${endY}-12-31` : null,
    end_month: endY ? endMonth : null,
    color: document.getElementById('era-color').value,
    image_url: mainImg,
    is_current: document.getElementById('era-current').checked ? 1 : 0,
    order_index: editingEraId
      ? (eras.find(e => e.id === editingEraId)?.order_index ?? 0)
      : eras.length
  };

  let eraId = editingEraId;
  if (editingEraId) {
    await queryDB({ table: 'life_eras', action: 'update', where: { id: editingEraId }, data });
  } else {
    const result = await queryDB({ table: 'life_eras', action: 'insert', data });
    eraId = result?.lastInsertRowid || result?.id || result?.[0]?.id;
    if (!eraId) {
      const latest = await queryDB({ table: 'life_eras', action: 'select' });
      eraId = latest.length ? latest[latest.length - 1].id : null;
    }
  }

  // Sync images: delete all existing, re-insert pending
  if (eraId) {
    await queryDB({ table: 'life_era_images', action: 'delete', where: { era_id: eraId } });
    for (let i = 0; i < pendingImages.length; i++) {
      await queryDB({
        table: 'life_era_images',
        action: 'insert',
        data: { era_id: eraId, url: pendingImages[i].url, caption: pendingImages[i].caption, order_index: i }
      });
    }
  }

  closeEraModal();
  loadAll();
  showToast(`✅ Ère "${name}" sauvegardée`);
}

async function deleteEra() {
  const ok = await showConfirm('Supprimer cette ère définitivement ?');
  if (!ok) return;
  const name = eras.find(e => e.id === editingEraId)?.name;
  await queryDB({ table: 'life_era_images', action: 'delete', where: { era_id: editingEraId } });
  await queryDB({ table: 'life_eras', action: 'delete', where: { id: editingEraId } });
  closeEraModal();
  loadAll();
  showToast(`🗑 Ère "${name}" supprimée`);
}

function closeEraModal() {
  document.getElementById('era-modal').classList.add('hidden');
  editingEraId = null;
}

// ── MILESTONE MODAL ───────────────────────────────────────────────────

function openMilestoneModal(milestoneId = null, defaultYear = null) {
  editingMilestoneId = milestoneId;
  const m = milestoneId ? milestones.find(x => x.id === milestoneId) : null;

  document.getElementById('ms-modal-title').textContent = m ? '✏️ Modifier l\'étape' : '📌 Nouvelle étape de vie';
  document.getElementById('ms-title').value     = m?.title ?? '';
  document.getElementById('ms-desc').value      = m?.description ?? '';
  document.getElementById('ms-date').value      = m?.date ?? (defaultYear ? `${defaultYear}-06-01` : '');
  document.getElementById('ms-type').value      = m?.type ?? 'achievement';
  document.getElementById('ms-color').value     = m?.color ?? '#f59e0b';
  document.getElementById('ms-achieved').checked = !!m?.achieved;

  const eraSelect = document.getElementById('ms-era');
  eraSelect.innerHTML = '<option value="">— Aucune ère —</option>' +
    [...eras]
      .sort((a, b) => (yearOf(a.start_date) || 0) - (yearOf(b.start_date) || 0))
      .map(e => `<option value="${e.id}" ${m?.era_id == e.id ? 'selected' : ''}>${e.name}</option>`)
      .join('');

  const icon = m?.icon ?? '🏆';
  document.getElementById('ms-icon-val').value = icon;
  document.getElementById('ms-icon-display').textContent = icon;
  renderEmojiPicker(icon);

  document.getElementById('ms-delete-btn').style.display = milestoneId ? 'flex' : 'none';
  document.getElementById('milestone-modal').classList.remove('hidden');
}

function renderEmojiPicker(selected) {
  document.getElementById('emoji-grid').innerHTML = EMOJIS.map(e =>
    `<span class="emoji-opt ${e === selected ? 'sel' : ''}" onclick="pickEmoji('${e}')">${e}</span>`
  ).join('');
}

function pickEmoji(e) {
  document.getElementById('ms-icon-val').value = e;
  document.getElementById('ms-icon-display').textContent = e;
  renderEmojiPicker(e);
}

async function saveMilestone() {
  const title = document.getElementById('ms-title').value.trim();
  const date  = document.getElementById('ms-date').value;
  if (!title) return alert('Le titre est requis');
  if (!date)  return alert('La date est requise');

  const data = {
    title,
    description: document.getElementById('ms-desc').value.trim() || null,
    date,
    type:     document.getElementById('ms-type').value,
    icon:     document.getElementById('ms-icon-val').value || '📌',
    color:    document.getElementById('ms-color').value,
    era_id:   document.getElementById('ms-era').value || null,
    achieved: document.getElementById('ms-achieved').checked ? 1 : 0
  };

  if (editingMilestoneId) {
    await queryDB({ table: 'life_milestones', action: 'update', where: { id: editingMilestoneId }, data });
  } else {
    await queryDB({ table: 'life_milestones', action: 'insert', data });
  }

  closeMilestoneModal();
  loadAll();
}

async function deleteMilestone() {
  const ok = await showConfirm('Supprimer cette étape ?');
  if (!ok) return;
  await queryDB({ table: 'life_milestones', action: 'delete', where: { id: editingMilestoneId } });
  closeMilestoneModal();
  loadAll();
}

function closeMilestoneModal() {
  document.getElementById('milestone-modal').classList.add('hidden');
  editingMilestoneId = null;
}

// ── ERA IMAGES (multi-image in modal) ─────────────────────────────────

function renderEraImagesGrid() {
  const grid = document.getElementById('era-images-grid');
  if (!pendingImages.length) {
    grid.innerHTML = '<div style="font-size:0.68rem;opacity:0.35;padding:8px 0">Aucune image d\'inspiration — ajoute des URLs ou glisse des fichiers</div>';
    return;
  }
  grid.innerHTML = pendingImages.map((img, idx) => `
    <div class="era-img-thumb" onclick="lightboxFromPending(${idx})">
      <img src="${img.url}" alt="${img.caption || ''}" loading="lazy"
        onerror="this.parentElement.style.display='none'">
      ${img.caption ? `<div class="img-caption">${img.caption}</div>` : ''}
      <button class="img-delete" onclick="event.stopPropagation();removePendingImage(${idx})">✕</button>
    </div>
  `).join('');
}

function lightboxFromPending(idx) {
  openLightbox(pendingImages.map(i => ({ url: i.url, caption: i.caption })), idx);
}

function addEraImage() {
  const urlInput = document.getElementById('era-new-image-url');
  const capInput = document.getElementById('era-new-image-caption');
  const url = urlInput.value.trim();
  if (!url) return;
  pendingImages.push({ url, caption: capInput.value.trim() || null, order_index: pendingImages.length });
  urlInput.value = '';
  capInput.value = '';
  renderEraImagesGrid();
  renderEraImageSelector();
}

function removePendingImage(idx) {
  pendingImages.splice(idx, 1);
  // If the removed image was selected, deselect it
  const currentImage = document.getElementById('era-image').value;
  if (pendingImages.length && !pendingImages.some(img => img.url === currentImage)) {
    document.getElementById('era-image').value = '';
  }
  renderEraImagesGrid();
  renderEraImageSelector();
}

// ── DRAG & DROP / FILE UPLOAD ─────────────────────────────────────────

const MAX_IMG_WIDTH = 1200;
const MAX_IMG_HEIGHT = 900;
const JPEG_QUALITY = 0.82;

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > MAX_IMG_WIDTH || h > MAX_IMG_HEIGHT) {
          const ratio = Math.min(MAX_IMG_WIDTH / w, MAX_IMG_HEIGHT / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function processFiles(files) {
  const results = [];
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    try {
      const dataUrl = await resizeImage(file);
      const name = file.name.replace(/\.[^.]+$/, '');
      results.push({ url: dataUrl, caption: name });
    } catch (err) {
      console.error('Image resize error:', err);
    }
  }
  return results;
}

async function handleFileSelect(files) {
  if (!files.length) return;
  const dropZone = document.getElementById('era-drop-zone');
  showDropProgress(dropZone, files.length);
  const imgs = await processFiles(files);
  hideDropProgress(dropZone);
  for (const img of imgs) {
    pendingImages.push({ ...img, order_index: pendingImages.length });
  }
  renderEraImagesGrid();
}

let visionBoardEraId = null;

async function handleVisionFileDrop(files) {
  if (!files.length || !visionBoardEraId) return;
  const dropZone = document.getElementById('vision-drop-zone');
  showDropProgress(dropZone, files.length);
  const imgs = await processFiles(files);
  hideDropProgress(dropZone);

  const existing = eraImages[visionBoardEraId] || [];
  for (let i = 0; i < imgs.length; i++) {
    await queryDB({
      table: 'life_era_images',
      action: 'insert',
      data: {
        era_id: visionBoardEraId,
        url: imgs[i].url,
        caption: imgs[i].caption,
        order_index: existing.length + i
      }
    });
  }

  await loadAll();
  renderVisionBoardContent(visionBoardEraId);
  showToast(`🖼 ${imgs.length} image${imgs.length > 1 ? 's' : ''} ajoutée${imgs.length > 1 ? 's' : ''}`);
}

function showDropProgress(zone, count) {
  const content = zone.querySelector('.drop-zone-content');
  content.innerHTML = `<div class="spinner"></div><span>Traitement de ${count} image${count > 1 ? 's' : ''}…</span>`;
  zone.style.pointerEvents = 'none';
}

function hideDropProgress(zone) {
  zone.style.pointerEvents = '';
  if (zone.id === 'era-drop-zone') {
    zone.querySelector('.drop-zone-content').innerHTML = `
      <div class="drop-icon">📁</div>
      <div>Glisse des images ici ou <label class="drop-browse">parcourir<input type="file" accept="image/*" multiple hidden onchange="handleFileSelect(this.files)"></label></div>`;
  } else {
    zone.querySelector('.drop-zone-content').innerHTML = `
      <div class="drop-icon">📁</div>
      <div>Glisse des images ici ou <label class="drop-browse">parcourir<input type="file" accept="image/*" multiple hidden onchange="handleVisionFileDrop(this.files)"></label></div>`;
  }
}

function setupDropZone(zoneId, handler) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;

  zone.addEventListener('dragenter', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', (e) => {
    if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
  });
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length) handler(files);
  });
}

// Paste support
document.addEventListener('paste', (e) => {
  const eraModal = document.getElementById('era-modal');
  const visionModal = document.getElementById('vision-modal');

  if (!eraModal.classList.contains('hidden')) {
    const files = [];
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith('image/')) files.push(item.getAsFile());
    }
    if (files.length) handleFileSelect(files);
  } else if (!visionModal.classList.contains('hidden')) {
    const files = [];
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith('image/')) files.push(item.getAsFile());
    }
    if (files.length) handleVisionFileDrop(files);
  }
});

// ── VISION BOARD ─────────────────────────────────────────────────────

function openVisionBoard(eraId) {
  const era = eras.find(e => e.id === eraId);
  if (!era) return;

  visionBoardEraId = eraId;

  document.getElementById('vision-modal-title').innerHTML =
    `<span style="color:${era.color}">●</span> ${era.name} — Vision Board`;
  document.getElementById('vision-era-desc').textContent = era.description || '';

  renderVisionBoardContent(eraId);
  document.getElementById('vision-modal').classList.remove('hidden');
}

function renderVisionBoardContent(eraId) {
  const era = eras.find(e => e.id === eraId);
  if (!era) return;

  const imgs = eraImages[eraId] || [];

  // Update counter
  const allImgs = buildVisionImages(era, imgs);
  const countEl = document.getElementById('vision-img-count');
  countEl.textContent = allImgs.length ? `${allImgs.length} image${allImgs.length > 1 ? 's' : ''}` : 'Aucune image';

  const board = document.getElementById('vision-board');

  if (!allImgs.length) {
    board.innerHTML = `
      <div class="vision-board-empty">
        <div class="empty-icon">🖼️</div>
        <div>Aucune image pour cette ère</div>
        <div class="empty-sub">Glisse des images ci-dessus ou ajoute-les depuis l'éditeur d'ère</div>
        <div style="margin-top:14px">
          <button class="btn btn-sm btn-primary" onclick="closeVisionModal();openEraModal(${eraId})">
            ✏️ Modifier l'ère
          </button>
        </div>
      </div>`;
    return;
  }

  // Assign varied sizes for masonry effect
  const sizeClasses = assignCardSizes(allImgs.length);

  board.innerHTML = allImgs.map((img, idx) => {
    const sizeClass = sizeClasses[idx] || '';
    const delay = Math.min(idx * 60, 500);
    const isMainImg = img._isMain;
    const imgDbId = img.id;

    return `
      <div class="vision-card ${sizeClass}" style="animation-delay:${delay}ms"
        draggable="${!isMainImg}"
        data-img-idx="${idx}" data-img-id="${imgDbId || ''}"
        onclick="openLightboxFromVision(${eraId}, ${idx})">
        <img src="${img.url}" alt="${img.caption || ''}" loading="lazy"
          onerror="this.parentElement.style.display='none'">
        ${img.caption ? `<div class="vision-caption">${img.caption}</div>` : ''}
        <div class="vision-card-actions">
          <button class="vision-card-btn" onclick="event.stopPropagation();editVisionCaption(${eraId},${idx})" title="Modifier la légende">✏️</button>
          ${!isMainImg ? `<button class="vision-card-btn delete-btn" onclick="event.stopPropagation();deleteVisionImage(${eraId},${idx})" title="Supprimer">🗑</button>` : ''}
        </div>
      </div>`;
  }).join('') + `
    <div class="vision-add-card" onclick="document.getElementById('vision-drop-zone').querySelector('input[type=file]').click()">
      <div class="vision-add-inner">
        <span class="add-icon">+</span>
        Ajouter
      </div>
    </div>`;

  // Setup drag reorder
  setupVisionDragReorder(board, eraId);
}

function buildVisionImages(era, imgs) {
  const allImgs = [];
  if (era.image_url && !imgs.some(i => i.url === era.image_url)) {
    allImgs.push({ url: era.image_url, caption: 'Image principale', _isMain: true });
  }
  allImgs.push(...imgs);
  return allImgs;
}

function assignCardSizes(count) {
  const sizes = [];
  // Use a deterministic pattern for visual variety
  for (let i = 0; i < count; i++) {
    if (count <= 2) {
      sizes.push('span-wide');
    } else if (i === 0) {
      sizes.push('span-big');
    } else if (i % 7 === 3) {
      sizes.push('span-tall');
    } else if (i % 5 === 2) {
      sizes.push('span-wide');
    } else if (i % 11 === 6) {
      sizes.push('span-tall');
    } else {
      sizes.push('');
    }
  }
  return sizes;
}

// ── Vision Board: Delete image ────────────────────────────────────────

async function deleteVisionImage(eraId, idx) {
  const era = eras.find(e => e.id === eraId);
  if (!era) return;
  const imgs = eraImages[eraId] || [];
  const allImgs = buildVisionImages(era, imgs);
  const img = allImgs[idx];
  if (!img || img._isMain) return;

  const ok = await showConfirm('Supprimer cette image ?');
  if (!ok) return;

  if (img.id) {
    await queryDB({ table: 'life_era_images', action: 'delete', where: { id: img.id } });
  }

  await loadAll();
  renderVisionBoardContent(eraId);
  renderLegend();
  showToast('🗑 Image supprimée');
}

// ── Vision Board: Edit caption inline ─────────────────────────────────

function editVisionCaption(eraId, idx) {
  const era = eras.find(e => e.id === eraId);
  if (!era) return;
  const imgs = eraImages[eraId] || [];
  const allImgs = buildVisionImages(era, imgs);
  const img = allImgs[idx];
  if (!img) return;

  const card = document.querySelectorAll('#vision-board .vision-card')[idx];
  if (!card || card.querySelector('.caption-edit-wrap')) return;

  // Remove existing caption
  const existingCaption = card.querySelector('.vision-caption');
  if (existingCaption) existingCaption.style.display = 'none';

  const wrap = document.createElement('div');
  wrap.className = 'caption-edit-wrap';
  wrap.innerHTML = `
    <input type="text" value="${img.caption || ''}" placeholder="Légende…" autofocus>
    <button onclick="event.stopPropagation();saveCaptionEdit(${eraId},${idx},this)">OK</button>
  `;
  wrap.onclick = (e) => e.stopPropagation();
  card.appendChild(wrap);

  const input = wrap.querySelector('input');
  input.focus();
  input.select();
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveCaptionEdit(eraId, idx, wrap.querySelector('button'));
    if (e.key === 'Escape') {
      wrap.remove();
      if (existingCaption) existingCaption.style.display = '';
    }
  });
}

async function saveCaptionEdit(eraId, idx, btnEl) {
  const wrap = btnEl.closest('.caption-edit-wrap');
  const newCaption = wrap.querySelector('input').value.trim() || null;

  const era = eras.find(e => e.id === eraId);
  if (!era) return;
  const imgs = eraImages[eraId] || [];
  const allImgs = buildVisionImages(era, imgs);
  const img = allImgs[idx];

  if (img._isMain) {
    // Update the era's main description isn't applicable for caption, skip
    wrap.remove();
    return;
  }

  if (img.id) {
    await queryDB({
      table: 'life_era_images',
      action: 'update',
      where: { id: img.id },
      data: { caption: newCaption }
    });
  }

  await loadAll();
  renderVisionBoardContent(eraId);
  showToast('✏️ Légende mise à jour');
}

// ── Vision Board: Drag reorder ────────────────────────────────────────

function setupVisionDragReorder(board, eraId) {
  let dragSrcIdx = null;

  board.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.vision-card');
    if (!card) return;
    dragSrcIdx = parseInt(card.dataset.imgIdx);
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragSrcIdx);
  });

  board.addEventListener('dragend', (e) => {
    const card = e.target.closest('.vision-card');
    if (card) card.classList.remove('dragging');
    board.querySelectorAll('.vision-card').forEach(c => c.classList.remove('drag-over-card'));
    dragSrcIdx = null;
  });

  board.addEventListener('dragover', (e) => {
    e.preventDefault();
    const card = e.target.closest('.vision-card');
    if (!card || card.classList.contains('dragging')) return;
    board.querySelectorAll('.vision-card').forEach(c => c.classList.remove('drag-over-card'));
    card.classList.add('drag-over-card');
  });

  board.addEventListener('drop', async (e) => {
    e.preventDefault();
    const card = e.target.closest('.vision-card');
    if (!card || dragSrcIdx === null) return;
    const targetIdx = parseInt(card.dataset.imgIdx);
    if (isNaN(targetIdx) || targetIdx === dragSrcIdx) return;

    board.querySelectorAll('.vision-card').forEach(c => c.classList.remove('drag-over-card'));

    // Reorder in DB
    const era = eras.find(e => e.id === eraId);
    const imgs = eraImages[eraId] || [];
    const allImgs = buildVisionImages(era, imgs);

    // Filter to only DB images (skip _isMain)
    const dbImgs = allImgs.filter(i => !i._isMain);
    const srcRealIdx = allImgs[dragSrcIdx]?._isMain ? -1 : dbImgs.indexOf(allImgs[dragSrcIdx]);
    const tgtRealIdx = allImgs[targetIdx]?._isMain ? -1 : dbImgs.indexOf(allImgs[targetIdx]);

    if (srcRealIdx === -1 || tgtRealIdx === -1) return;

    // Reorder
    const [moved] = dbImgs.splice(srcRealIdx, 1);
    dbImgs.splice(tgtRealIdx, 0, moved);

    // Update order_index in DB
    for (let i = 0; i < dbImgs.length; i++) {
      if (dbImgs[i].id) {
        await queryDB({
          table: 'life_era_images',
          action: 'update',
          where: { id: dbImgs[i].id },
          data: { order_index: i }
        });
      }
    }

    await loadAll();
    renderVisionBoardContent(eraId);
    showToast('↕️ Ordre mis à jour');
  });
}

// ── Fullscreen toggle ─────────────────────────────────────────────────

function toggleFullscreenVision() {
  const box = document.querySelector('.vision-modal-box');
  box.classList.toggle('fullscreen');
  const btn = document.getElementById('vision-fs-btn');
  btn.textContent = box.classList.contains('fullscreen') ? '⛶' : '⛶';
  btn.title = box.classList.contains('fullscreen') ? 'Quitter le plein écran' : 'Plein écran';
}

function closeVisionModal() {
  document.getElementById('vision-modal').classList.add('hidden');
  document.querySelector('.vision-modal-box')?.classList.remove('fullscreen');
}

// ── LIGHTBOX ─────────────────────────────────────────────────────────

let lightboxData = []; // [{url, caption}]
let lightboxIdx = 0;
let lightboxEraId = null;

function openLightbox(images, idx, eraId = null) {
  lightboxData = images;
  lightboxIdx = idx || 0;
  lightboxEraId = eraId;
  renderLightbox();
}

function openLightboxFromVision(eraId, idx) {
  const era = eras.find(e => e.id === eraId);
  if (!era) return;
  const imgs = eraImages[eraId] || [];
  const allImgs = buildVisionImages(era, imgs);
  openLightbox(allImgs.map(i => ({ url: i.url, caption: i.caption, id: i.id, _isMain: i._isMain })), idx, eraId);
}

function renderLightbox() {
  document.querySelector('.lightbox-overlay')?.remove();

  if (!lightboxData.length) return;
  const img = lightboxData[lightboxIdx];
  const total = lightboxData.length;
  const canDelete = !img._isMain && img.id && lightboxEraId;

  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) closeLightbox(); };

  overlay.innerHTML = `
    <div class="lightbox-top-bar">
      <span class="lightbox-counter">${lightboxIdx + 1} / ${total}</span>
      <div class="lightbox-top-actions">
        ${canDelete ? `<button class="lightbox-top-btn delete" onclick="event.stopPropagation();deleteLightboxImage()" title="Supprimer">🗑</button>` : ''}
        <button class="lightbox-top-btn" onclick="event.stopPropagation();closeLightbox()" title="Fermer">✕</button>
      </div>
    </div>
    <img class="lightbox-img" src="${img.url}" alt="${img.caption || ''}">
    ${img.caption ? `<div class="lightbox-caption">${img.caption}</div>` : ''}
    ${total > 1 ? `
      <button class="lightbox-nav prev" onclick="event.stopPropagation();lightboxPrev()">‹</button>
      <button class="lightbox-nav next" onclick="event.stopPropagation();lightboxNext()">›</button>
    ` : ''}
  `;
  document.body.appendChild(overlay);

  // Keyboard nav
  const keyHandler = (e) => {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') lightboxPrev();
    if (e.key === 'ArrowRight') lightboxNext();
    if (e.key === 'Delete' && canDelete) deleteLightboxImage();
  };
  overlay._keyHandler = keyHandler;
  document.addEventListener('keydown', keyHandler);
}

function closeLightbox() {
  const overlay = document.querySelector('.lightbox-overlay');
  if (overlay) {
    if (overlay._keyHandler) document.removeEventListener('keydown', overlay._keyHandler);
    overlay.remove();
  }
  lightboxData = [];
}

function lightboxPrev() {
  lightboxIdx = (lightboxIdx - 1 + lightboxData.length) % lightboxData.length;
  renderLightbox();
}

function lightboxNext() {
  lightboxIdx = (lightboxIdx + 1) % lightboxData.length;
  renderLightbox();
}

async function deleteLightboxImage() {
  const img = lightboxData[lightboxIdx];
  if (!img || img._isMain || !img.id) return;

  const ok = await showConfirm('Supprimer cette image ?');
  if (!ok) return;

  await queryDB({ table: 'life_era_images', action: 'delete', where: { id: img.id } });

  lightboxData.splice(lightboxIdx, 1);
  if (lightboxData.length === 0) {
    closeLightbox();
  } else {
    lightboxIdx = Math.min(lightboxIdx, lightboxData.length - 1);
    renderLightbox();
  }

  await loadAll();
  if (lightboxEraId) renderVisionBoardContent(lightboxEraId);
  renderLegend();
  showToast('🗑 Image supprimée');
}

// ── UI HELPERS ────────────────────────────────────────────────────────

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

function showConfirm(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box">
        <p>${message}</p>
        <div class="confirm-actions">
          <button class="btn btn-ghost btn-sm" id="confirm-no">Annuler</button>
          <button class="btn btn-danger btn-sm" id="confirm-yes">Confirmer</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#confirm-yes').onclick = () => { overlay.remove(); resolve(true); };
    overlay.querySelector('#confirm-no').onclick = () => { overlay.remove(); resolve(false); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } });

    const keyHandler = (e) => {
      if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', keyHandler); resolve(false); }
      if (e.key === 'Enter') { overlay.remove(); document.removeEventListener('keydown', keyHandler); resolve(true); }
    };
    document.addEventListener('keydown', keyHandler);
  });
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', e => {
    if (e.target === el) { closeEraModal(); closeMilestoneModal(); closeVisionModal(); }
  });
});

// ── DYNAMIC CELL HEIGHT ───────────────────────────────────────────────

function setupResizeObserver() {
  const wrap = document.getElementById('life-timeline');
  const wrapper = document.getElementById('life-timeline')?.parentElement; // .timeline-wrap
  if (!wrap || !wrapper) return;

  const NUM_ROWS = Math.ceil((YEAR_END - YEAR_START) / YEARS_PER_ROW); // 12

  const update = () => {
    // Utiliser la hauteur complète du wrapper (timeline-wrap)
    const wrapperH = wrapper.clientHeight;
    // Compenser padding du wrapper (4px top + 4px bottom) + gap minimal entre lignes
    const available = wrapperH - 8 - (NUM_ROWS - 1) * 2;
    const cellH = Math.max(12, Math.floor(available / NUM_ROWS));
    wrap.style.setProperty('--cell-size', cellH + 'px');
  };

  // ResizeObserver pour écouter les changements de taille du conteneur
  const ro = new ResizeObserver(update);
  ro.observe(wrapper);

  // Aussi écouter les changements globaux de la fenêtre pour être sur
  window.addEventListener('resize', update);

  // Appel initial avec délai pour s'assurer que le DOM est prêt
  requestAnimationFrame(() => {
    setTimeout(update, 100);
  });
}

// ── INIT ──────────────────────────────────────────────────────────────
loadAll();
setupDragCreate();
setupDropZone('era-drop-zone', handleFileSelect);
setupDropZone('vision-drop-zone', handleVisionFileDrop);
setupResizeObserver();
