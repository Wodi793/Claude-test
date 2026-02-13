// ── Data Layer ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'guitar-collection';

function loadGuitars() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveGuitars(guitars) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(guitars));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── State ───────────────────────────────────────────────────────────────────

let guitars = loadGuitars();
let searchTerm = '';
let deleteTarget = null; // { type: 'guitar'|'restring', guitarId, restringIndex }

// ── DOM References ──────────────────────────────────────────────────────────

const guitarListEl = document.getElementById('guitar-list');
const emptyMsg = document.getElementById('empty-msg');
const searchInput = document.getElementById('search-input');

// Guitar modal
const guitarModal = document.getElementById('guitar-modal');
const guitarForm = document.getElementById('guitar-form');
const modalTitle = document.getElementById('modal-title');
const guitarIdInput = document.getElementById('guitar-id');

// Restring modal
const restringModal = document.getElementById('restring-modal');
const restringForm = document.getElementById('restring-form');
const restringGuitarIdInput = document.getElementById('restring-guitar-id');
const restringModalTitle = document.getElementById('restring-modal-title');

// Detail modal
const detailModal = document.getElementById('detail-modal');
const detailTitle = document.getElementById('detail-title');
const detailBody = document.getElementById('detail-body');

// Confirm modal
const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');

// ── Render ──────────────────────────────────────────────────────────────────

function renderGuitarList() {
  const filtered = getFilteredGuitars();

  // Clear existing cards (keep empty message)
  guitarListEl.querySelectorAll('.guitar-card').forEach(el => el.remove());

  if (filtered.length === 0) {
    emptyMsg.classList.remove('hidden');
    emptyMsg.style.display = '';
    if (searchTerm) {
      emptyMsg.textContent = `No guitars match "${searchTerm}".`;
    } else {
      emptyMsg.textContent = 'No guitars in your collection yet. Click "+ Add Guitar" to get started.';
    }
    return;
  }

  emptyMsg.style.display = 'none';

  filtered.forEach(guitar => {
    const card = createGuitarCard(guitar);
    guitarListEl.appendChild(card);
  });
}

function createGuitarCard(guitar) {
  const card = document.createElement('div');
  card.className = 'guitar-card';
  card.dataset.id = guitar.id;

  const lastRestring = guitar.restrings && guitar.restrings.length > 0
    ? guitar.restrings[0]
    : null;

  const yearDisplay = guitar.year ? ` (${guitar.year})` : '';
  const costDisplay = guitar.cost ? `$${Number(guitar.cost).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '--';

  let stringsHtml = '';
  if (lastRestring) {
    stringsHtml = `
      <div class="card-strings-info">
        <div class="strings-title">Current Strings</div>
        <div class="strings-detail">${escapeHtml(lastRestring.maker)} ${escapeHtml(lastRestring.gauge)} - ${escapeHtml(lastRestring.material)}</div>
        <div class="strings-date">Restrung: ${formatDate(lastRestring.date)}</div>
      </div>`;
  } else {
    stringsHtml = '<div class="no-strings">No string history recorded</div>';
  }

  card.innerHTML = `
    <div class="card-header">
      <h3>
        <span class="card-manufacturer">${escapeHtml(guitar.manufacturer)}</span>
        ${escapeHtml(guitar.model)}${yearDisplay}
      </h3>
      <div class="card-actions">
        <button class="btn-icon" title="Restring" data-action="restring" data-id="${guitar.id}">&#127928;</button>
        <button class="btn-icon" title="Edit" data-action="edit" data-id="${guitar.id}">&#9998;</button>
        <button class="btn-icon danger" title="Delete" data-action="delete" data-id="${guitar.id}">&times;</button>
      </div>
    </div>
    <div class="card-details">
      <span class="card-detail-label">Serial:</span>
      <span class="card-detail-value">${escapeHtml(guitar.serialNumber || '--')}</span>
      <span class="card-detail-label">Where Bought:</span>
      <span class="card-detail-value">${escapeHtml(guitar.whereBought || '--')}</span>
      <span class="card-detail-label">Cost:</span>
      <span class="card-detail-value">${costDisplay}</span>
      <span class="card-detail-label">Restrings:</span>
      <span class="card-detail-value">${guitar.restrings ? guitar.restrings.length : 0}</span>
    </div>
    ${stringsHtml}
  `;

  // Click card to view details (but not if clicking an action button)
  card.addEventListener('click', (e) => {
    if (e.target.closest('[data-action]')) return;
    showDetailModal(guitar.id);
  });

  return card;
}

function getFilteredGuitars() {
  if (!searchTerm) return guitars;
  const term = searchTerm.toLowerCase();
  return guitars.filter(g =>
    g.manufacturer.toLowerCase().includes(term) ||
    g.model.toLowerCase().includes(term) ||
    (g.year && g.year.toString().includes(term)) ||
    (g.serialNumber && g.serialNumber.toLowerCase().includes(term)) ||
    (g.whereBought && g.whereBought.toLowerCase().includes(term)) ||
    (g.notes && g.notes.toLowerCase().includes(term)) ||
    (g.restrings && g.restrings.some(r =>
      r.maker.toLowerCase().includes(term) ||
      r.gauge.toLowerCase().includes(term) ||
      r.material.toLowerCase().includes(term)
    ))
  );
}

// ── Guitar CRUD ─────────────────────────────────────────────────────────────

function openAddGuitarModal() {
  modalTitle.textContent = 'Add Guitar';
  guitarForm.reset();
  guitarIdInput.value = '';
  guitarModal.classList.remove('hidden');
}

function openEditGuitarModal(id) {
  const guitar = guitars.find(g => g.id === id);
  if (!guitar) return;

  modalTitle.textContent = 'Edit Guitar';
  guitarIdInput.value = guitar.id;
  document.getElementById('manufacturer').value = guitar.manufacturer;
  document.getElementById('model').value = guitar.model;
  document.getElementById('year').value = guitar.year || '';
  document.getElementById('serial-number').value = guitar.serialNumber || '';
  document.getElementById('where-bought').value = guitar.whereBought || '';
  document.getElementById('cost').value = guitar.cost || '';
  document.getElementById('notes').value = guitar.notes || '';
  guitarModal.classList.remove('hidden');
}

function saveGuitar(e) {
  e.preventDefault();

  const id = guitarIdInput.value;
  const data = {
    manufacturer: document.getElementById('manufacturer').value.trim(),
    model: document.getElementById('model').value.trim(),
    year: document.getElementById('year').value ? parseInt(document.getElementById('year').value) : null,
    serialNumber: document.getElementById('serial-number').value.trim(),
    whereBought: document.getElementById('where-bought').value.trim(),
    cost: document.getElementById('cost').value ? parseFloat(document.getElementById('cost').value) : null,
    notes: document.getElementById('notes').value.trim(),
  };

  if (id) {
    // Edit existing
    const idx = guitars.findIndex(g => g.id === id);
    if (idx !== -1) {
      guitars[idx] = { ...guitars[idx], ...data };
    }
  } else {
    // Add new
    guitars.push({
      id: generateId(),
      ...data,
      restrings: [],
      createdAt: new Date().toISOString(),
    });
  }

  saveGuitars(guitars);
  guitarModal.classList.add('hidden');
  renderGuitarList();
}

function deleteGuitar(id) {
  guitars = guitars.filter(g => g.id !== id);
  saveGuitars(guitars);
  renderGuitarList();
}

// ── Restring ────────────────────────────────────────────────────────────────

function openRestringModal(guitarId) {
  const guitar = guitars.find(g => g.id === guitarId);
  if (!guitar) return;

  restringModalTitle.textContent = `Restring: ${guitar.manufacturer} ${guitar.model}`;
  restringForm.reset();
  restringGuitarIdInput.value = guitarId;

  // Default to today's date
  document.getElementById('restring-date').value = new Date().toISOString().split('T')[0];

  // Pre-fill with last strings if available
  if (guitar.restrings && guitar.restrings.length > 0) {
    const last = guitar.restrings[0];
    document.getElementById('string-maker').value = last.maker;
    document.getElementById('string-gauge').value = last.gauge;
    document.getElementById('string-material').value = last.material;
  }

  restringModal.classList.remove('hidden');
}

function saveRestring(e) {
  e.preventDefault();

  const guitarId = restringGuitarIdInput.value;
  const guitar = guitars.find(g => g.id === guitarId);
  if (!guitar) return;

  const restring = {
    maker: document.getElementById('string-maker').value.trim(),
    gauge: document.getElementById('string-gauge').value.trim(),
    material: document.getElementById('string-material').value.trim(),
    date: document.getElementById('restring-date').value,
    notes: document.getElementById('restring-notes').value.trim(),
    loggedAt: new Date().toISOString(),
  };

  if (!guitar.restrings) guitar.restrings = [];

  // Insert at beginning (newest first), sorted by date
  guitar.restrings.unshift(restring);
  guitar.restrings.sort((a, b) => new Date(b.date) - new Date(a.date));

  saveGuitars(guitars);
  restringModal.classList.add('hidden');
  renderGuitarList();

  // If detail modal is open, refresh it
  if (!detailModal.classList.contains('hidden')) {
    showDetailModal(guitarId);
  }
}

function deleteRestring(guitarId, index) {
  const guitar = guitars.find(g => g.id === guitarId);
  if (!guitar || !guitar.restrings) return;

  guitar.restrings.splice(index, 1);
  saveGuitars(guitars);
  renderGuitarList();
  showDetailModal(guitarId);
}

// ── Detail Modal ────────────────────────────────────────────────────────────

function showDetailModal(id) {
  const guitar = guitars.find(g => g.id === id);
  if (!guitar) return;

  const yearDisplay = guitar.year ? ` (${guitar.year})` : '';
  detailTitle.textContent = `${guitar.manufacturer} ${guitar.model}${yearDisplay}`;

  const costDisplay = guitar.cost
    ? `$${Number(guitar.cost).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    : '--';

  let restringHistoryHtml = '';
  if (guitar.restrings && guitar.restrings.length > 0) {
    restringHistoryHtml = guitar.restrings.map((r, i) => `
      <div class="restring-entry">
        <div class="restring-info">
          <div class="restring-main">${escapeHtml(r.maker)} ${escapeHtml(r.gauge)} - ${escapeHtml(r.material)}</div>
          <div class="restring-meta">${formatDate(r.date)}${i === 0 ? ' <span class="badge">Current</span>' : ''}</div>
          ${r.notes ? `<div class="restring-note">"${escapeHtml(r.notes)}"</div>` : ''}
        </div>
        <button class="btn-icon danger restring-delete" title="Remove" data-action="delete-restring" data-guitar-id="${guitar.id}" data-index="${i}">&times;</button>
      </div>
    `).join('');
  } else {
    restringHistoryHtml = '<p class="no-history">No restring history yet.</p>';
  }

  detailBody.innerHTML = `
    <div class="detail-actions">
      <button class="btn btn-primary btn-small" data-action="restring" data-id="${guitar.id}">Log Restring</button>
      <button class="btn btn-secondary btn-small" data-action="edit" data-id="${guitar.id}">Edit Guitar</button>
      <button class="btn btn-danger btn-small" data-action="delete" data-id="${guitar.id}">Delete Guitar</button>
    </div>

    <div class="detail-section">
      <h3>Guitar Information</h3>
      <div class="detail-grid">
        <span class="detail-label">Manufacturer</span>
        <span class="detail-value">${escapeHtml(guitar.manufacturer)}</span>
        <span class="detail-label">Model</span>
        <span class="detail-value">${escapeHtml(guitar.model)}</span>
        <span class="detail-label">Year</span>
        <span class="detail-value">${guitar.year || '--'}</span>
        <span class="detail-label">Serial Number</span>
        <span class="detail-value">${escapeHtml(guitar.serialNumber || '--')}</span>
        <span class="detail-label">Where Bought</span>
        <span class="detail-value">${escapeHtml(guitar.whereBought || '--')}</span>
        <span class="detail-label">Cost</span>
        <span class="detail-value">${costDisplay}</span>
        <span class="detail-label">Notes</span>
        <span class="detail-value">${escapeHtml(guitar.notes || '--')}</span>
      </div>
    </div>

    <div class="detail-section">
      <h3>Restring History <span class="badge">${guitar.restrings ? guitar.restrings.length : 0}</span></h3>
      <div class="restring-history">
        ${restringHistoryHtml}
      </div>
    </div>
  `;

  detailModal.classList.remove('hidden');
}

// ── Confirm Delete ──────────────────────────────────────────────────────────

function showConfirmDelete(target) {
  deleteTarget = target;
  if (target.type === 'guitar') {
    const guitar = guitars.find(g => g.id === target.guitarId);
    confirmMessage.textContent = `Are you sure you want to delete "${guitar.manufacturer} ${guitar.model}"? This will also delete all restring history.`;
  } else {
    confirmMessage.textContent = 'Are you sure you want to remove this restring entry?';
  }
  confirmModal.classList.remove('hidden');
}

function executeDelete() {
  if (!deleteTarget) return;

  if (deleteTarget.type === 'guitar') {
    deleteGuitar(deleteTarget.guitarId);
    detailModal.classList.add('hidden');
  } else if (deleteTarget.type === 'restring') {
    deleteRestring(deleteTarget.guitarId, deleteTarget.restringIndex);
  }

  deleteTarget = null;
  confirmModal.classList.add('hidden');
}

// ── Utilities ───────────────────────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function closeAllModals() {
  guitarModal.classList.add('hidden');
  restringModal.classList.add('hidden');
  detailModal.classList.add('hidden');
  confirmModal.classList.add('hidden');
}

// ── Event Listeners ─────────────────────────────────────────────────────────

// Add guitar button
document.getElementById('btn-add-guitar').addEventListener('click', openAddGuitarModal);

// Guitar form submit
guitarForm.addEventListener('submit', saveGuitar);

// Restring form submit
restringForm.addEventListener('submit', saveRestring);

// Close modal buttons
document.getElementById('btn-close-modal').addEventListener('click', () => guitarModal.classList.add('hidden'));
document.getElementById('btn-cancel-guitar').addEventListener('click', () => guitarModal.classList.add('hidden'));
document.getElementById('btn-close-restring').addEventListener('click', () => restringModal.classList.add('hidden'));
document.getElementById('btn-cancel-restring').addEventListener('click', () => restringModal.classList.add('hidden'));
document.getElementById('btn-close-detail').addEventListener('click', () => detailModal.classList.add('hidden'));
document.getElementById('btn-close-confirm').addEventListener('click', () => confirmModal.classList.add('hidden'));
document.getElementById('btn-cancel-delete').addEventListener('click', () => confirmModal.classList.add('hidden'));
document.getElementById('btn-confirm-delete').addEventListener('click', executeDelete);

// Close modals on backdrop click
[guitarModal, restringModal, detailModal, confirmModal].forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });
});

// Close modals on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAllModals();
});

// Search
searchInput.addEventListener('input', (e) => {
  searchTerm = e.target.value.trim();
  renderGuitarList();
});

// Delegated click handler for action buttons (cards and detail modal)
document.addEventListener('click', (e) => {
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;

  const action = actionEl.dataset.action;
  const id = actionEl.dataset.id;

  switch (action) {
    case 'edit':
      detailModal.classList.add('hidden');
      openEditGuitarModal(id);
      break;
    case 'restring':
      detailModal.classList.add('hidden');
      openRestringModal(id);
      break;
    case 'delete':
      showConfirmDelete({ type: 'guitar', guitarId: id });
      break;
    case 'delete-restring':
      showConfirmDelete({
        type: 'restring',
        guitarId: actionEl.dataset.guitarId,
        restringIndex: parseInt(actionEl.dataset.index),
      });
      break;
  }
});

// ── Data Export/Import ──────────────────────────────────────────────────────

function exportData() {
  const dataStr = JSON.stringify(guitars, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `guitar-collection-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) {
        alert('Invalid file format. Expected a JSON array of guitars.');
        return;
      }
      guitars = imported;
      saveGuitars(guitars);
      renderGuitarList();
      alert(`Imported ${imported.length} guitar(s) successfully.`);
    } catch {
      alert('Failed to parse the file. Make sure it is valid JSON.');
    }
  };
  reader.readAsText(file);
}

// ── Initialize ──────────────────────────────────────────────────────────────

renderGuitarList();
