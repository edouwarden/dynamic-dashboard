// Gestion des notes avec localStorage
const STORAGE_KEY = 'notes-widget-data';
let notes = [];

// Charger les notes
function loadNotes() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) notes = JSON.parse(saved);
  renderNotes();
}

// Sauvegarder les notes
function saveNotes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

// Créer une nouvelle note
function createNote() {
  const note = {
    id: Date.now(),
    content: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  notes.unshift(note);
  saveNotes();
  renderNotes();

  setTimeout(() => {
    const textarea = document.querySelector(`[data-note-id="${note.id}"]`);
    if (textarea) textarea.focus();
  }, 100);
}

// Mettre à jour une note
function updateNote(id, content) {
  const note = notes.find(n => n.id === id);
  if (note) {
    note.content = content;
    note.updatedAt = new Date().toISOString();
    saveNotes();
  }
}

// Supprimer une note
function deleteNote(id) {
  notes = notes.filter(n => n.id !== id);
  saveNotes();
  renderNotes();
}

// Formater la date
function formatDate(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'À l\'instant';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} h`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// Afficher les notes
function renderNotes() {
  const container = document.getElementById('notesContainer');

  if (notes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div style="font-size: 3rem;">📭</div>
        <p>Aucune note pour le moment</p>
        <p style="font-size: 0.9rem; margin-top: 4px;">Cliquez sur "+ Nouvelle note" pour commencer</p>
      </div>
    `;
    return;
  }

  container.innerHTML = notes.map(note => `
    <div class="note-card">
      <textarea class="note-input" data-note-id="${note.id}" placeholder="Écrivez votre note...">${note.content}</textarea>
      <div class="note-footer">
        <span class="note-date">${formatDate(note.updatedAt)}</span>
        <button class="btn-delete" data-note-id="${note.id}" title="Supprimer">🗑️</button>
      </div>
    </div>
  `).join('');

  attachEvents();
}

// Attacher les événements
function attachEvents() {
  document.querySelectorAll('.note-input').forEach(textarea => {
    textarea.addEventListener('input', (e) => {
      const id = parseInt(e.target.dataset.noteId);
      updateNote(id, e.target.value);
    });

    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  });

  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt(e.target.dataset.noteId);
      if (confirm('Supprimer cette note ?')) deleteNote(id);
    });
  });
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  loadNotes();
  document.getElementById('addNote').addEventListener('click', createNote);

  setInterval(() => {
    document.querySelectorAll('.note-date').forEach((dateEl, index) => {
      if (notes[index]) dateEl.textContent = formatDate(notes[index].updatedAt);
    });
  }, 60000);
});