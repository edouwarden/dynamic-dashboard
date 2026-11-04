// Logique pour World Trend

let allTrends = [];
let currentEditingId = null;

// Elements du DOM
const btnAdd = document.getElementById('btn-add');
const formContainer = document.getElementById('form-container');
const trendForm = document.getElementById('trend-form');
const btnCancel = document.getElementById('btn-cancel');
const btnDelete = document.getElementById('btn-delete');
const trendsList = document.getElementById('trends-list');
const emptyState = document.getElementById('empty-state');
const inputImportance = document.getElementById('input-importance');
const importanceValue = document.getElementById('importance-value');

// Mise à jour du slider d'importance
inputImportance.addEventListener('input', (e) => {
  importanceValue.textContent = e.target.value;
});

// Bouton Ajouter
btnAdd.addEventListener('click', () => {
  currentEditingId = null;
  resetForm();
  showForm();
});

// Form Submit
trendForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = document.getElementById('input-title').value.trim();
  const category = document.getElementById('input-category').value.trim();
  const importance = parseInt(document.getElementById('input-importance').value);
  const description = document.getElementById('input-description').value.trim();

  if (!title) {
    alert('Le titre est obligatoire');
    return;
  }

  try {
    if (currentEditingId) {
      // Éditer une tendance existante
      await queryDB({
        table: 'trend_items',
        action: 'update',
        where: { id: currentEditingId },
        data: {
          title,
          category,
          importance,
          description,
          updated_at: new Date().toISOString()
        }
      });
    } else {
      // Ajouter une nouvelle tendance
      await queryDB({
        table: 'trend_items',
        action: 'insert',
        data: {
          title,
          category: category || null,
          importance,
          description: description || null,
          status: 'active'
        }
      });
    }

    hideForm();
    await loadTrends();
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
    alert('Erreur lors de la sauvegarde: ' + error.message);
  }
});

// Bouton Annuler
btnCancel.addEventListener('click', hideForm);

// Bouton Supprimer
btnDelete.addEventListener('click', async () => {
  if (!currentEditingId || !confirm('Êtes-vous sûr de vouloir supprimer cette tendance ?')) {
    return;
  }

  try {
    await queryDB({
      table: 'trend_items',
      action: 'delete',
      where: { id: currentEditingId }
    });

    hideForm();
    await loadTrends();
  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    alert('Erreur lors de la suppression: ' + error.message);
  }
});

// Charger les tendances depuis la BD
async function loadTrends() {
  try {
    allTrends = await queryDB({
      table: 'trend_items',
      action: 'select',
      where: { status: 'active' }
    });

    renderTrends();
  } catch (error) {
    console.error('Erreur lors du chargement des tendances:', error);
    allTrends = [];
    renderTrends();
  }
}

// Afficher les tendances
function renderTrends() {
  trendsList.innerHTML = '';

  if (allTrends.length === 0) {
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';

  // Trier par importance décroissante
  const sorted = [...allTrends].sort((a, b) => b.importance - a.importance);

  sorted.forEach(trend => {
    const item = document.createElement('div');
    item.className = `trend-item importance-${trend.importance}`;
    item.onclick = () => editTrend(trend);

    const importancePercent = (trend.importance / 10) * 100;

    item.innerHTML = `
      <div class="trend-header">
        <div class="trend-title">${escapeHtml(trend.title)}</div>
        ${trend.category ? `<div class="trend-category">${escapeHtml(trend.category)}</div>` : ''}
      </div>

      <div class="trend-importance">
        <div class="importance-bar">
          <div class="importance-fill" style="width: ${importancePercent}%"></div>
        </div>
        <span>${trend.importance}/10</span>
      </div>

      ${trend.description ? `<div class="trend-description">${escapeHtml(trend.description)}</div>` : ''}

      <div class="trend-meta">
        Créé: ${new Date(trend.created_at).toLocaleDateString('fr-FR')}
      </div>
    `;

    trendsList.appendChild(item);
  });
}

// Éditer une tendance
function editTrend(trend) {
  currentEditingId = trend.id;
  document.getElementById('input-title').value = trend.title;
  document.getElementById('input-category').value = trend.category || '';
  document.getElementById('input-importance').value = trend.importance;
  importanceValue.textContent = trend.importance;
  document.getElementById('input-description').value = trend.description || '';

  btnDelete.classList.remove('hidden');
  document.querySelector('.form-actions .btn-submit').textContent = 'Modifier';

  showForm();
}

// Afficher le formulaire
function showForm() {
  formContainer.classList.remove('hidden');
  document.getElementById('input-title').focus();
}

// Cacher le formulaire
function hideForm() {
  formContainer.classList.add('hidden');
  resetForm();
}

// Réinitialiser le formulaire
function resetForm() {
  trendForm.reset();
  document.getElementById('input-importance').value = 5;
  importanceValue.textContent = 5;
  btnDelete.classList.add('hidden');
  document.querySelector('.form-actions .btn-submit').textContent = 'Ajouter';
  currentEditingId = null;
}

// Échapper les caractères HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialisation au chargement
async function init() {
  console.log('World Trend - Initialisation...');

  try {
    await loadTrends();
    console.log('Tendances chargées:', allTrends.length);
  } catch (error) {
    console.error('Erreur lors de l\'initialisation:', error);
  }
}

// Démarrer l'app
init();
