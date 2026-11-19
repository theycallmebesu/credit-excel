/* =========================================================
   HARDWARE SHOP - CREDIT KHATA & SEPARATE DAILY SALES + CHART
   ========================================================= */

const state = {
  shopConfig: { shopName: "SHREE PASUPATINATH HARDWARE", port: 3001 },
  customers: [],
  currentCustomer: "",
  currentCustomerRecord: null,
  dailySales: [],
  priceListTopic: 'ALL',
  priceListTopicsExpanded: false,
  salesAnalytics: null,
  itemSuggestions: [],
  itemUnits: {},
  dataUnits: [],
  catalogItems: [],
  chartMode: 'qty', // 'qty' or 'sales'
  activeSuggestionInput: null,
  highlightedSuggestionIndex: -1,
  stagedSaleItems: [], // Multiple products entered before saving daily sale
  creditSort: { by: 'itemName', dir: 'asc' }, // Requirement 1: Ascending order by item on credit khata (default)
  customerSort: { by: 'modifiedAt', dir: 'desc' },
  salesSort: { by: 'modifiedAt', dir: 'desc' },
  creditDateFilter: { from: '', to: '' },      // Requirement 2: Export/filter by date section (from to which date)
  salesDateFilter: { from: '', to: '' },       // Requirement 2 & 3: Daily sales date filter
  salesViewMode: 'grouped',                    // Requirement 3: Group sales by date (default) or flat all sales
  salesExportGrouping: 'grouped',
  exportContext: 'credit',                     // 'credit' or 'sales'
  customUnits: [],                             // Requirement 4: Custom units
  businessInsights: null,
  insightsTrendMode: 'revenue',
  insightsActiveTab: 'sales',
  insightsReturnView: 'customers'
};

const DEFAULT_UNITS = [
  'BAG', 'PIC', 'KG', 'SQ FT', 'LENGTH', 'BUNDLE', 'ROLL', 'PKT', 'MTR', 'LTR', 'TRIP', 'BORA', 'FT', 'INCH', 'SET', 'DRUM'
];
const COMMON_UNITS = DEFAULT_UNITS;

const NEPALI_MONTHS = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

// Helper: Get all active units (default + custom)
function getAllUnits() {
  const custom = state.customUnits || [];
  const set = new Set([...DEFAULT_UNITS, ...(state.dataUnits || []), ...custom]);
  return Array.from(set);
}

// Helper: Auto-detect unit from hardware item name
function detectUnitFromItemName(name) {
  if (!name) return '';
  const upper = String(name).trim().toUpperCase();
  if (state.itemUnits[upper]) return String(state.itemUnits[upper]).trim().toUpperCase();
  if (upper.includes('PER BAG')) return 'BAG';
  if (upper.includes('PER KG') || upper.includes('PER HALF KG')) return 'KG';
  if (upper.includes('PER SQ FT')) return 'SQ FT';
  if (upper.includes('PER PIC')) return 'PIC';
  if (upper.includes('PER BORA')) return 'BORA';
  if (upper.includes('PER MTR')) return 'MTR';
  if (upper.includes('PER LTR')) return 'LTR';
  if (upper.includes('PER PKT')) return 'PKT';
  if (upper.includes('PER TIP')) return 'TRIP';
  if (upper.includes('PER FT')) return 'FT';
  if (upper.includes('PER BUNDLE')) return 'BUNDLE';
  if (upper.includes('PER INCH')) return 'INCH';
  if (upper.includes('ROLL')) return 'ROLL';
  if (upper.includes('SET')) return 'SET';
  if (upper.includes('CEMENT')) return 'BAG';
  if (upper.includes('BALWA') || upper.includes('RODA') || upper.includes('CHIPS') || upper.includes('DHUNGA')) {
    if (upper.includes('BORA')) return 'BORA';
    return 'SQ FT';
  }
  if (upper.includes('JASTA')) return 'BUNDLE';
  if (upper.includes('PIPE')) {
    if (upper.includes('PER MTR')) return 'MTR';
    if (upper.includes('PER KG')) return 'KG';
    return 'LENGTH';
  }
  if (upper.includes('TILE')) {
    if (upper.includes('PER SQ FT')) return 'SQ FT';
    if (upper.includes('PER PIC')) return 'PIC';
    return 'SQ FT';
  }
  return '';
}

function normalizeUnit(unit) {
  return String(unit || '').trim().toUpperCase();
}

function setCreditEntryUnit(unitInput, unit) {
  const normalizedUnit = normalizeUnit(unit);
  unitInput.value = normalizedUnit;
  unitInput.dataset.autoDetectedUnit = normalizedUnit;
}

function setSaleEntryUnit(unitInput, unit) {
  const normalizedUnit = normalizeUnit(unit);
  unitInput.value = normalizedUnit;
  unitInput.dataset.autoDetectedUnit = normalizedUnit;
}

// ---------------- AUDIO CONFIRMATION SOUNDS (100% OFFLINE) ----------------
let successAudioContext = null;

function primeSuccessSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!successAudioContext || successAudioContext.state === 'closed') {
      successAudioContext = new AudioCtx();
    }
    if (successAudioContext.state === 'suspended') {
      successAudioContext.resume().catch((e) => {
        console.warn('Unable to enable save confirmation sound:', e);
      });
    }
  } catch (e) {
    console.warn('Audio playback not supported:', e);
  }
}

async function playSuccessSound() {
  try {
    primeSuccessSound();
    const ctx = successAudioContext;
    if (!ctx) return;
    if (ctx.state === 'suspended') await ctx.resume();
    if (ctx.state !== 'running') {
      throw new Error(`Audio context is ${ctx.state}`);
    }

    const now = ctx.currentTime;

    // First bright chime
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.1); // G5
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second celebratory higher chime
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.08); // A5
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.22); // D6
    gain2.gain.setValueAtTime(0.28, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.6);

    // Low warm confirmation tone
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(293.66, now); // D4
    gain3.gain.setValueAtTime(0.12, now);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now);
    osc3.stop(now + 0.45);
  } catch (e) {
    console.warn('Unable to play save confirmation sound:', e);
  }
}

function playItemAddSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.08); // E5
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  } catch (e) {}
}

document.addEventListener('DOMContentLoaded', async () => {
  const submitCreditSearchOnEnter = event => {
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      const form = document.getElementById('creditSearchForm');
      if (!document.getElementById('creditSearchButton').disabled) form.requestSubmit();
    }
  };
  document.getElementById('priceListSearchInput').addEventListener('input', renderPriceList);
  document.getElementById('creditSearchInput').addEventListener('keydown', submitCreditSearchOnEnter);
  document.getElementById('creditSearchFromDate').addEventListener('keydown', submitCreditSearchOnEnter);
  document.getElementById('creditSearchToDate').addEventListener('keydown', submitCreditSearchOnEnter);
  const priceItemTopic = document.getElementById('priceItemTopic');
  const priceItemNewTopic = document.getElementById('priceItemNewTopic');
  const priceItemName = document.getElementById('priceItemName');
  const priceItemPrice = document.getElementById('priceItemPrice');
  priceItemTopic.addEventListener('change', () => {
    const newTopicGroup = document.getElementById('priceItemNewTopicGroup');
    newTopicGroup.hidden = priceItemTopic.value !== '__NEW__';
    if (priceItemTopic.value === '__NEW__') priceItemNewTopic.focus();
  });
  priceItemTopic.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (priceItemTopic.value === '__NEW__') {
        priceItemNewTopic.focus();
      } else {
        priceItemName.focus();
        priceItemName.select();
      }
    }
  });
  priceItemNewTopic.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      priceItemName.focus();
      priceItemName.select();
    }
  });
  priceItemName.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      priceItemPrice.focus();
      priceItemPrice.select();
    }
  });
  priceItemPrice.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      document.getElementById('priceItemForm').requestSubmit();
    }
  });
  initNepaliDateSelectors();
  loadCustomUnits();
  await loadShopConfig();
  await loadCustomers();
  await loadItemSuggestions();
  await loadCatalogItems();
  initUnitsDatalist();
  setupAutocompleteHandlers();
  setupGlobalKeyboardShortcuts();
  setupNumpadNumericEntry();
  setupCreditEntryKeyboardWorkflow();
  setupCreditEditKeyboardSave();
  setupDailySalesKeyboardWorkflow();
  resetSaleDateToToday();
  updateCreditSortUI();
});

// ---------------- CUSTOM UNITS MANAGEMENT (Requirement 4) ----------------
function loadCustomUnits() {
  try {
    const raw = localStorage.getItem('hardware_custom_units');
    if (raw) {
      const units = JSON.parse(raw);
      state.customUnits = Array.isArray(units)
        ? [...new Set(units
          .filter(unit => typeof unit === 'string')
          .map(unit => unit.trim().toUpperCase())
          .filter(unit => unit && !DEFAULT_UNITS.includes(unit)))]
        : [];
    }
  } catch (e) {
    state.customUnits = [];
  }
}

function saveCustomUnits() {
  try {
    localStorage.setItem('hardware_custom_units', JSON.stringify(state.customUnits));
  } catch (e) {}
  initUnitsDatalist();
}

function rememberCustomUnit(value) {
  const unit = normalizeUnit(value);
  if (!unit || DEFAULT_UNITS.includes(unit) || state.customUnits.includes(unit)) {
    return false;
  }

  state.customUnits.push(unit);
  saveCustomUnits();
  return true;
}

function initUnitsDatalist() {
  const datalist = document.getElementById('commonUnitsDatalist');
  if (datalist) {
    const units = getAllUnits();
    datalist.innerHTML = units.map(u => `<option value="${escapeHtml(u)}"></option>`).join('');
  }

  // Keep the editable sale unit field aligned with the available suggestions.
  const saleUnitSelect = document.getElementById('saleUnit');
  if (saleUnitSelect) {
    saleUnitSelect.value = normalizeUnit(saleUnitSelect.value);
  }
}

// ---------------- HARDWARE ITEMS CATALOG (Requirement 6) ----------------
async function loadCatalogItems() {
  try {
    const res = await fetch('/api/price-items');
    if (res.ok) {
      state.catalogItems = await res.json();
      const badge = document.getElementById('catalogTotalBadge');
      if (badge) badge.textContent = state.catalogItems.length;
      const navCount = document.getElementById('priceListNavCount');
      if (navCount) navCount.textContent = state.catalogItems.length;
      renderPriceList();
      renderItemsCatalog(state.catalogItems);
    }
  } catch (err) {
    console.error('Error loading catalog items:', err);
  }
}

function searchPriceList(event) {
  event.preventDefault();
  renderPriceList();
}

function getPriceListTopics() {
  return [...new Set(state.catalogItems
    .map(item => String(item.topic || 'GENERAL').trim().toUpperCase())
    .filter(Boolean))];
}

function renderPriceList() {
  const chips = document.getElementById('priceTopicChips');
  const groups = document.getElementById('priceListGroups');
  const count = document.getElementById('priceListResultCount');
  if (!chips || !groups || !count) return;

  const topics = getPriceListTopics();
  const query = document.getElementById('priceListSearchInput').value.trim().toLocaleLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);
  const itemCounts = new Map();
  state.catalogItems.forEach(item => {
    const topic = String(item.topic || 'GENERAL').trim().toUpperCase();
    itemCounts.set(topic, (itemCounts.get(topic) || 0) + 1);
  });

  document.getElementById('priceTopicCount').textContent =
    `${topics.length} ${topics.length === 1 ? 'Category' : 'Categories'} Available`;
  chips.classList.toggle('expanded', state.priceListTopicsExpanded);
  document.getElementById('priceTopicToggle').textContent =
    `${state.priceListTopicsExpanded ? 'Show Less' : `Show All (${topics.length})`} ${state.priceListTopicsExpanded ? '▲' : '▼'}`;
  chips.innerHTML = `
    <button type="button" class="price-topic-chip ${state.priceListTopic === 'ALL' ? 'active' : ''}" data-topic="ALL">
      All Topics <span>F2</span> <small>(${state.catalogItems.length})</small>
    </button>
    ${topics.map(topic => `
      <button type="button" class="price-topic-chip ${state.priceListTopic === topic ? 'active' : ''}" data-topic="${escapeHtml(topic)}">
        ${escapeHtml(topic)} <small>(${itemCounts.get(topic)})</small>
      </button>
    `).join('')}
  `;
  chips.querySelectorAll('.price-topic-chip').forEach(button => {
    button.addEventListener('click', () => {
      state.priceListTopic = button.dataset.topic;
      renderPriceList();
    });
  });

  const filtered = state.catalogItems.filter(item => {
    const topic = String(item.topic || 'GENERAL').trim().toUpperCase();
    if (state.priceListTopic !== 'ALL' && topic !== state.priceListTopic) return false;
    if (!terms.length) return true;
    const searchable = `${topic} ${item.name || ''} ${item.price || ''}`.toLocaleLowerCase();
    return terms.every(term => searchable.includes(term));
  });
  count.innerHTML = filtered.length === state.catalogItems.length && state.priceListTopic === 'ALL' && !query
    ? `Showing all <strong>${filtered.length}</strong> items`
    : `Found <strong>${filtered.length}</strong> ${filtered.length === 1 ? 'item' : 'items'}`;

  if (!filtered.length) {
    groups.innerHTML = '<div class="price-list-empty">No products match your search. Try another product name, price, or category.</div>';
    return;
  }

  const grouped = new Map();
  filtered.forEach(item => {
    const topic = String(item.topic || 'GENERAL').trim().toUpperCase();
    if (!grouped.has(topic)) grouped.set(topic, []);
    grouped.get(topic).push(item);
  });

  groups.innerHTML = [...grouped.entries()].map(([topic, items]) => `
    <section class="price-topic-card">
      <header class="price-topic-card-header">
        <div><h2>${escapeHtml(topic)}</h2><span>${items.length} ${items.length === 1 ? 'item' : 'items'}</span></div>
        <button type="button" class="price-topic-add" data-topic="${escapeHtml(topic)}">＋ Add to ${escapeHtml(topic)}</button>
      </header>
      <div class="price-table-wrap">
        <table class="price-table">
          <thead><tr><th>No.</th><th>Item Name</th><th>Price</th><th>Actions</th></tr></thead>
          <tbody>${items.map((item, index) => {
            const price = String(item.price ?? '').trim();
            const isFree = price.toUpperCase() === 'FREE';
            const numericPrice = Number(price);
            const priceDisplay = isFree ? 'FREE' :
              Number.isFinite(numericPrice) ? `Rs. ${numericPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` :
              `Rs. ${escapeHtml(price || '-')}`;
            return `<tr>
              <td class="price-row-number">${index + 1}</td>
              <td class="price-row-name">${escapeHtml(item.name)}</td>
              <td class="price-row-value ${isFree ? 'free' : ''}">${priceDisplay}</td>
              <td class="price-row-actions">
                <button type="button" class="price-edit-button" data-id="${escapeHtml(item.id)}">✎ Edit</button>
                <button type="button" class="price-delete-button" data-id="${escapeHtml(item.id)}">▤ Delete</button>
              </td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
    </section>
  `).join('');

  groups.querySelectorAll('.price-topic-add').forEach(button => {
    button.addEventListener('click', () => openPriceItemModal('', button.dataset.topic));
  });
  groups.querySelectorAll('.price-edit-button').forEach(button => {
    button.addEventListener('click', () => openPriceItemModal(button.dataset.id));
  });
  groups.querySelectorAll('.price-delete-button').forEach(button => {
    button.addEventListener('click', () => deletePriceItem(button.dataset.id));
  });
}

function togglePriceTopics() {
  state.priceListTopicsExpanded = !state.priceListTopicsExpanded;
  renderPriceList();
}

function openPriceItemModal(itemId = '', defaultTopic = '') {
  const item = itemId ? state.catalogItems.find(candidate => String(candidate.id) === String(itemId)) : null;
  if (itemId && !item) {
    showToast('Product was not found in the price list.', 'error');
    return;
  }

  const topicSelect = document.getElementById('priceItemTopic');
  const topics = getPriceListTopics();
  topicSelect.innerHTML = `<option value="">Choose category</option>
    ${topics.map(topic => `<option value="${escapeHtml(topic)}">${escapeHtml(topic)}</option>`).join('')}
    <option value="__NEW__">＋ New Topic</option>`;
  document.getElementById('priceItemId').value = item ? item.id : '';
  document.getElementById('priceItemModalTitle').textContent = item ? 'Edit Product' : 'Add New Product';
  document.getElementById('priceItemSaveButton').innerHTML = item
    ? 'Save Changes&nbsp; <kbd>↵ Enter</kbd>'
    : 'Save &amp; Add Next&nbsp; <kbd>↵ Enter</kbd>';
  topicSelect.value = item ? String(item.topic || 'GENERAL').toUpperCase() :
    defaultTopic || (state.priceListTopic !== 'ALL' ? state.priceListTopic : '');
  document.getElementById('priceItemNewTopic').value = '';
  document.getElementById('priceItemNewTopicGroup').hidden = topicSelect.value !== '__NEW__';
  document.getElementById('priceItemName').value = item ? item.name : '';
  document.getElementById('priceItemPrice').value = item ? item.price : '';
  document.getElementById('priceItemError').hidden = true;
  document.getElementById('modalPriceItem').classList.add('active');
  setTimeout(() => (item ? document.getElementById('priceItemName') : topicSelect).focus(), 80);
}

function closePriceItemModal() {
  document.getElementById('modalPriceItem').classList.remove('active');
}

async function savePriceItem(event) {
  event.preventDefault();
  const topicSelect = document.getElementById('priceItemTopic');
  const topic = topicSelect.value === '__NEW__'
    ? document.getElementById('priceItemNewTopic').value.trim().toUpperCase()
    : topicSelect.value.trim().toUpperCase();
  const name = document.getElementById('priceItemName').value.trim().toUpperCase();
  const price = document.getElementById('priceItemPrice').value.trim();
  const id = document.getElementById('priceItemId').value;
  const error = document.getElementById('priceItemError');

  if (!topic) {
    error.textContent = topicSelect.value === '__NEW__' ? 'Enter a name for the new category.' : 'Choose a category.';
    error.hidden = false;
    (topicSelect.value === '__NEW__' ? document.getElementById('priceItemNewTopic') : topicSelect).focus();
    return;
  }
  if (!name) {
    error.textContent = 'Product name is required.';
    error.hidden = false;
    document.getElementById('priceItemName').focus();
    return;
  }
  if (!price || (price.toUpperCase() !== 'FREE' && !/^\d+(?:\.\d+)?$/.test(price.replace(/,/g, '')))) {
    error.textContent = 'Enter a valid price or type FREE.';
    error.hidden = false;
    document.getElementById('priceItemPrice').focus();
    return;
  }

  const button = document.getElementById('priceItemSaveButton');
  button.disabled = true;
  error.hidden = true;
  try {
    const response = await fetch(id ? `/api/price-items/${encodeURIComponent(id)}` : '/api/price-items', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, name, price: price.toUpperCase() === 'FREE' ? 'FREE' : price.replace(/,/g, '') })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to save product.');

    const savedItem = data.item || data;
    if (id) {
      state.catalogItems = state.catalogItems.map(existing =>
        String(existing.id) === String(id) ? savedItem : existing
      );
      closePriceItemModal();
      showToast(`Updated "${savedItem.name}".`, 'success');
    } else {
      state.catalogItems.push(savedItem);
      topicSelect.innerHTML = `<option value="">Choose category</option>
        ${getPriceListTopics().map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}
        <option value="__NEW__">＋ New Topic</option>`;
      document.getElementById('priceItemName').value = '';
      document.getElementById('priceItemPrice').value = '';
      topicSelect.value = topic;
      document.getElementById('priceItemNewTopicGroup').hidden = true;
      document.getElementById('priceItemName').focus();
      showToast(`Added "${savedItem.name}" to the price list.`, 'success');
    }

    state.priceListTopic = 'ALL';
    const navCount = document.getElementById('priceListNavCount');
    if (navCount) navCount.textContent = state.catalogItems.length;
    const catalogCount = document.getElementById('catalogTotalBadge');
    if (catalogCount) catalogCount.textContent = state.catalogItems.length;
    renderPriceList();
    renderItemsCatalog(state.catalogItems);
    await loadItemSuggestions();
  } catch (err) {
    console.error('Unable to save price list product:', err);
    error.textContent = err.message || 'Unable to save product.';
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
}

async function deletePriceItem(itemId) {
  const item = state.catalogItems.find(candidate => String(candidate.id) === String(itemId));
  if (!item) {
    showToast('Product was not found in the price list.', 'error');
    return;
  }
  if (!window.confirm(`Delete "${item.name}" from the price list?`)) return;

  try {
    const response = await fetch(`/api/price-items/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to delete product.');
    state.catalogItems = state.catalogItems.filter(candidate => String(candidate.id) !== String(itemId));
    const navCount = document.getElementById('priceListNavCount');
    if (navCount) navCount.textContent = state.catalogItems.length;
    const catalogCount = document.getElementById('catalogTotalBadge');
    if (catalogCount) catalogCount.textContent = state.catalogItems.length;
    renderPriceList();
    renderItemsCatalog(state.catalogItems);
    await loadItemSuggestions();
    showToast(`Deleted "${item.name}" from the price list.`, 'success');
  } catch (err) {
    console.error('Unable to delete price list product:', err);
    showToast(err.message || 'Unable to delete product.', 'error');
  }
}

function openItemsCatalogModal() {
  const modal = document.getElementById('modalItemsCatalog');
  if (modal) modal.classList.add('active');
  const search = document.getElementById('catalogSearchInput');
  if (search) {
    search.value = '';
    setTimeout(() => search.focus(), 100);
  }
  renderItemsCatalog(state.catalogItems);
}

function closeItemsCatalogModal() {
  const modal = document.getElementById('modalItemsCatalog');
  if (modal) modal.classList.remove('active');
}

function filterCatalogItems() {
  const q = (document.getElementById('catalogSearchInput').value || '').trim().toLowerCase();
  if (!q) {
    renderItemsCatalog(state.catalogItems);
    return;
  }
  const filtered = state.catalogItems.filter(item =>
    (item.name || '').toLowerCase().includes(q) ||
    String(item.price || '').toLowerCase().includes(q)
  );
  renderItemsCatalog(filtered);
}

function renderItemsCatalog(items) {
  const grid = document.getElementById('catalogItemsGrid');
  if (!grid) return;
  if (!items || items.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:30px; color:#64748b; font-weight:600;">No items found matching your search.</div>`;
    return;
  }

  grid.innerHTML = items.map(it => {
    const priceDisplay = it.price ? (String(it.price).toUpperCase() === 'FREE' ? 'FREE' : `Rs. ${Number(it.price).toLocaleString('en-IN') || it.price}`) : 'Rs. -';
    const escapedName = escapeJs(it.name);
    const escapedPrice = escapeJs(String(it.price || ''));
    return `
      <div class="catalog-item-card">
        <div class="catalog-item-name">${escapeHtml(it.name)}</div>
        <div class="catalog-item-price">${priceDisplay}</div>
        <div style="display:flex; gap:6px; margin-top:8px;">
          <button type="button" class="btn btn-add-khata btn-sm" onclick="addItemFromCatalogToKhata('${escapedName}')">➕ Add to Khata</button>
          <button type="button" class="btn btn-secondary btn-sm" style="flex:1;" onclick="addItemFromCatalogToSale('${escapedName}', '${escapedPrice}')">💰 Sale</button>
        </div>
      </div>
    `;
  }).join('');
}

function addItemFromCatalogToKhata(itemName) {
  if (document.getElementById('view-ledger').classList.contains('active')) {
    const card = document.getElementById('entryFormCard');
    if (card && card.style.display === 'none') {
      card.style.display = 'block';
    }
  } else {
    if (!state.currentCustomer && state.customers.length > 0) {
      openCustomerLedger(state.customers[0].name);
    }
    const card = document.getElementById('entryFormCard');
    if (card) card.style.display = 'block';
  }

  const tbody = document.getElementById('entryRowsTbody');
  if (!tbody) return;

  // Find first empty row or append new row
  let targetRow = null;
  const rows = tbody.querySelectorAll('tr');
  for (let r of rows) {
    const nameInput = r.querySelector('.item-input');
    if (nameInput && !nameInput.value.trim()) {
      targetRow = r;
      break;
    }
  }

  if (!targetRow) {
    appendEntryRow(false);
    targetRow = tbody.lastElementChild;
  }

  const detectedUnit = detectUnitFromItemName(itemName);
  const nameInput = targetRow.querySelector('.item-input');
  const unitInput = targetRow.querySelector('.unit-input');
  const qtyInput = targetRow.querySelector('.qty-input');

  if (nameInput) nameInput.value = itemName.toUpperCase();
  if (unitInput) {
    delete unitInput.dataset.manuallyEdited;
    setCreditEntryUnit(unitInput, detectedUnit);
  }

  playItemAddSound();
  showToast(`Added "${itemName}" to entry row! Enter quantity.`, 'success');

  closeItemsCatalogModal();
  if (qtyInput) qtyInput.focus();
}

function addItemFromCatalogToSale(itemName, price) {
  navigateTo('daily-sales');
  const nameInput = document.getElementById('saleItemName');
  const rateInput = document.getElementById('saleRate');
  const unitSelect = document.getElementById('saleUnit');
  const qtyInput = document.getElementById('saleQty');

  if (nameInput) nameInput.value = itemName.toUpperCase();
  if (rateInput && price && price !== 'FREE') {
    rateInput.value = price;
  }
  if (unitSelect) {
    delete unitSelect.dataset.manuallyEdited;
    setSaleEntryUnit(unitSelect, detectUnitFromItemName(itemName));
  }

  closeItemsCatalogModal();
  showToast(`Added "${itemName}" to Daily Sale! Enter quantity.`, 'info');
  if (qtyInput) qtyInput.focus();
}

function openNewCatalogItemModal() {
  document.getElementById('newCatalogName').value = '';
  document.getElementById('newCatalogPrice').value = '';
  document.getElementById('modalNewCatalogItem').classList.add('active');
  setTimeout(() => document.getElementById('newCatalogName').focus(), 100);
}

function closeNewCatalogItemModal() {
  document.getElementById('modalNewCatalogItem').classList.remove('active');
}

async function submitNewCatalogItem() {
  const name = document.getElementById('newCatalogName').value.trim().toUpperCase();
  const price = document.getElementById('newCatalogPrice').value.trim();

  if (!name) {
    showToast('Item name cannot be empty', 'error');
    return;
  }

  try {
    const res = await fetch('/api/price-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, price })
    });
    if (res.ok) {
      closeNewCatalogItemModal();
      showToast(`Item "${name}" saved to catalog!`, 'success');
      await loadCatalogItems();
      await loadItemSuggestions();
    } else {
      showToast('Failed to save catalog item', 'error');
    }
  } catch (err) {
    showToast('Error saving item to catalog', 'error');
  }
}

// ---------------- DATA FETCHING ----------------
async function loadShopConfig() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      state.shopConfig = await res.json();
      const shopTitle = (state.shopConfig.shopName || 'SHREE PASUPATINATH HARDWARE').toUpperCase();
      document.getElementById('navShopName').textContent = shopTitle;
    }
  } catch (err) {
    console.error('Error fetching config:', err);
  }
}

async function loadCustomers() {
  try {
    const res = await fetch('/api/customers');
    if (res.ok) {
      state.customers = await res.json();
      renderCustomersGrid(state.customers);
      updateCustomersSummary();
    }
  } catch (err) {
    console.error('Error loading customers:', err);
  }
}

async function loadItemSuggestions() {
  try {
    const [suggestionsRes, unitsRes] = await Promise.all([
      fetch('/api/item-suggestions'),
      fetch('/api/item-units')
    ]);
    if (suggestionsRes.ok) state.itemSuggestions = await suggestionsRes.json();
    if (unitsRes.ok) {
      state.itemUnits = await unitsRes.json();
      state.dataUnits = [...new Set(Object.values(state.itemUnits))];
      initUnitsDatalist();
    }
  } catch (err) {
    console.error('Error loading suggestions:', err);
  }
}

function updateCustomersSummary() {
  const total = state.customers.length;
  const totalItems = state.customers.reduce((sum, c) => sum + (c.count || 0), 0);
  document.getElementById('totalCustomersSummary').textContent =
    `${total} Credit Customers • ${totalItems} Total Credit Items on Record`;
}

// ---------------- NAVIGATION ----------------
function navigateToCreditKhata() {
  navigateTo('customers');
  const searchInput = document.getElementById('customerSearchInput');
  if (searchInput) {
    searchInput.focus();
    searchInput.select();
  }
}

function navigateToCreditSearch() {
  navigateTo('credit-search');
  document.getElementById('creditSearchInput').focus();
}

function toggleCreditSearchDateRange() {
  const dateMode = document.getElementById('creditSearchDateMode').value;
  document.getElementById('creditSearchDateRange').hidden = dateMode !== 'range';
}

function searchCreditKhataFromDirectory(event) {
  event.preventDefault();
  const query = document.getElementById('creditKhataSearchInput').value.trim();
  if (!query) {
    document.getElementById('creditKhataSearchInput').focus();
    return;
  }

  document.getElementById('creditSearchInput').value = query;
  document.getElementById('creditSearchScope').value = 'credit';
  document.getElementById('creditSearchDateMode').value = 'all';
  toggleCreditSearchDateRange();
  navigateTo('credit-search');
  document.getElementById('creditSearchForm').requestSubmit();
}

function navigateTo(viewId) {
  document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  document.body.classList.toggle('price-list-active', viewId === 'price-list');
  document.querySelector('.app-subtitle').textContent = viewId === 'price-list'
    ? 'PRICE LIST & PRODUCT CATALOG'
    : 'CREDIT KHATA & DAILY SALES';

  if (viewId === 'price-list') {
    document.getElementById('view-price-list').classList.add('active');
    document.getElementById('btnNavPriceList').classList.add('active');
    renderPriceList();
    window.scrollTo(0, 0);
    document.getElementById('priceListSearchInput').focus();
  } else if (viewId === 'business-insights') {
    document.getElementById('view-business-insights').classList.add('active');
  } else if (viewId === 'credit-search') {
    document.getElementById('view-credit-search').classList.add('active');
    document.getElementById('btnNavCreditSearch').classList.add('active');
  } else if (viewId === 'customers') {
    document.getElementById('view-customers').classList.add('active');
    document.getElementById('btnNavCustomers').classList.add('active');
    loadCustomers();
  } else if (viewId === 'ledger') {
    document.getElementById('view-ledger').classList.add('active');
  } else if (viewId === 'daily-sales') {
    document.getElementById('view-daily-sales').classList.add('active');
    document.getElementById('btnNavDailySales').classList.add('active');
    window.scrollTo(0, 0);
    loadDailySalesAndAnalytics();
  }
}

async function searchCreditKhata(event) {
  event.preventDefault();
  const input = document.getElementById('creditSearchInput');
  const scopeInput = document.getElementById('creditSearchScope');
  const dateModeInput = document.getElementById('creditSearchDateMode');
  const fromDateInput = document.getElementById('creditSearchFromDate');
  const toDateInput = document.getElementById('creditSearchToDate');
  const button = document.getElementById('creditSearchButton');
  const status = document.getElementById('creditSearchStatus');
  const totalsContainer = document.getElementById('creditSearchTotals');
  const resultsBody = document.getElementById('creditSearchResults');
  const query = input.value.trim();
  const scope = scopeInput.value;
  const dateMode = dateModeInput.value;
  const fromDate = fromDateInput.value.trim();
  const toDate = toDateInput.value.trim();
  const scopeLabel = { all: 'sales and credit', sales: 'sales', credit: 'credit' }[scope];

  if (!query) {
    status.textContent = `Enter a product or other detail to search ${scopeLabel}.`;
    totalsContainer.hidden = true;
    totalsContainer.innerHTML = '';
    resultsBody.innerHTML = '<tr><td colspan="11">No search term entered.</td></tr>';
    input.focus();
    return;
  }

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (dateMode === 'range' &&
      (!datePattern.test(fromDate) || !datePattern.test(toDate) || fromDate > toDate)) {
    status.textContent = 'Enter both dates in YYYY-MM-DD format, with the From date on or before the To date.';
    totalsContainer.hidden = true;
    totalsContainer.innerHTML = '';
    resultsBody.innerHTML = '<tr><td colspan="11">Enter a valid date range to search.</td></tr>';
    if (!datePattern.test(fromDate)) fromDateInput.focus();
    else if (!datePattern.test(toDate)) toDateInput.focus();
    else fromDateInput.focus();
    return;
  }

  button.disabled = true;
  button.textContent = 'Searching...';
  const dateLabel = dateMode === 'today' ? ' for today' :
    dateMode === 'range' ? ` from ${fromDate} to ${toDate}` : '';
  status.textContent = `Searching ${scopeLabel} records${dateLabel}...`;
  totalsContainer.hidden = true;
  totalsContainer.innerHTML = '';
  resultsBody.innerHTML = `<tr><td colspan="11">Please wait while ${scopeLabel} records are searched.</td></tr>`;

  try {
    const params = new URLSearchParams({ q: query, scope, dateMode });
    if (dateMode === 'range') {
      params.set('fromDate', fromDate);
      params.set('toDate', toDate);
    }
    const response = await fetch(`/api/credit-search?${params.toString()}`);
    let data;
    try {
      data = await response.json();
    } catch (error) {
      throw new Error(`The server returned an unreadable response (HTTP ${response.status}).`);
    }
    if (!response.ok) throw new Error(data.error || `Search failed (HTTP ${response.status}).`);

    const sourceCounts = data.results.reduce((counts, entry) => {
      counts[entry.type] = (counts[entry.type] || 0) + 1;
      return counts;
    }, {});
    const countSummary = scope === 'all'
      ? `${sourceCounts.sale || 0} sales + ${sourceCounts.credit || 0} credit`
      : `${data.count} ${scope} ${data.count === 1 ? 'entry' : 'entries'}`;
    status.textContent = `${countSummary} matching "${query}"${dateLabel}.`;
    if (!data.results.length) {
      totalsContainer.hidden = true;
      totalsContainer.innerHTML = '';
      resultsBody.innerHTML = `<tr><td colspan="11">No matching ${scopeLabel} entries found. Try a shorter product name or another detail.</td></tr>`;
      return;
    }

    const totals = data.results.reduce((summary, entry) => {
      if (entry.type !== 'sale' && entry.type !== 'credit') return summary;
      const unit = String(entry.unit || 'UNIT NOT SPECIFIED').trim().toUpperCase();
      const quantityText = String(entry.quantity ?? '').trim().replace(/,/g, '');
      const quantity = /^-?\d+(?:\.\d+)?$/.test(quantityText) ? Number(quantityText) : null;
      if (quantity !== null && Number.isFinite(quantity)) {
        summary[entry.type].units[unit] = (summary[entry.type].units[unit] || 0) + quantity;
      }

      if (entry.type === 'sale') {
        const total = Number(entry.total);
        const rate = Number(entry.rate);
        summary.sale.total += Number.isFinite(total)
          ? total
          : quantity !== null && Number.isFinite(rate) ? quantity * rate : 0;
      }
      return summary;
    }, {
      sale: { units: {}, total: 0 },
      credit: { units: {}, total: 0 }
    });
    const renderUnitTotals = units => {
      const labels = Object.entries(units)
        .sort(([unitA], [unitB]) => unitA.localeCompare(unitB))
        .map(([unit, quantity]) =>
          `<span>${escapeHtml(quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 }))} ${escapeHtml(unit)}</span>`);
      return labels.length ? labels.join('') : '<span>No numeric quantities in these matches</span>';
    };
    const hasSales = sourceCounts.sale > 0;
    const hasCredit = sourceCounts.credit > 0;
    totalsContainer.innerHTML = `
      ${hasSales ? `<section class="credit-search-total-group sales">
        <h2>Matched sales totals (${sourceCounts.sale} ${sourceCounts.sale === 1 ? 'entry' : 'entries'})</h2>
        <p><strong>Quantity by unit</strong>${renderUnitTotals(totals.sale.units)}</p>
        <p><strong>Total sales value</strong><span>${formatInsightMoney(totals.sale.total)}</span></p>
      </section>` : ''}
      ${hasCredit ? `<section class="credit-search-total-group credit">
        <h2>Matched credit totals (${sourceCounts.credit} ${sourceCounts.credit === 1 ? 'entry' : 'entries'})</h2>
        <p><strong>Quantity by unit</strong>${renderUnitTotals(totals.credit.units)}</p>
        <small>Credit entries do not store prices, so no money total is available.</small>
      </section>` : ''}
    `;
    totalsContainer.hidden = false;

    resultsBody.innerHTML = data.results.map(entry => `
      <tr>
        <td>${entry.type === 'sale' ? 'SALE' : 'CREDIT'}</td>
        <td>${escapeHtml(entry.date || '-')}</td>
        <td>${entry.type === 'credit'
          ? `<button type="button" class="credit-search-customer" data-customer="${escapeHtml(entry.customerName)}">${escapeHtml(entry.customerName)}</button>`
          : escapeHtml(entry.customerName || '-')}</td>
        <td>${escapeHtml(entry.itemName || '-')}</td>
        <td>${escapeHtml(entry.quantity || '-')}</td>
        <td>${escapeHtml(entry.unit || '-')}</td>
        <td>${entry.type === 'sale' ? escapeHtml(entry.rate || '-') : '-'}</td>
        <td>${entry.type === 'sale' ? escapeHtml(entry.total || '-') : '-'}</td>
        <td>${escapeHtml(entry.driverName || '-')}</td>
        <td>${escapeHtml(entry.vehicleNumber || '-')}</td>
        <td>${escapeHtml(entry.remarks || '-')}</td>
      </tr>
    `).join('');
    resultsBody.querySelectorAll('.credit-search-customer').forEach(customerButton => {
      customerButton.addEventListener('click', () => openCustomerLedger(customerButton.dataset.customer));
    });
  } catch (error) {
    console.error('Sales and credit search failed:', error);
    status.textContent = error.message || 'Could not search sales and credit records.';
    totalsContainer.hidden = true;
    totalsContainer.innerHTML = '';
    resultsBody.innerHTML = '<tr><td colspan="11">Search could not be completed. Please try again.</td></tr>';
  } finally {
    button.disabled = false;
    button.textContent = '🔎 Search';
  }
}

// ---------------- ========================================== ----------------
// ---------------- SECTION 1: CREDIT CUSTOMERS (KHATA) (NO AMOUNTS) -----------
// ---------------- ========================================== ----------------

function onCustomerSearchInput() {
  const q = document.getElementById('customerSearchInput').value.trim().toUpperCase();
  if (!q) {
    renderCustomersGrid(state.customers);
    return;
  }
  const filtered = state.customers.filter(c => c.name.toUpperCase().includes(q));
  renderCustomersGrid(filtered);
}

function renderCustomersGrid(list) {
  const grid = document.getElementById('customersGrid');
  grid.innerHTML = '';
  updateCustomerSortUI();

  if (list.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #777; font-size: 1.15rem; font-weight: 600;">
        No credit customer found matching your search.
      </div>
    `;
    return;
  }

  const { by, dir } = state.customerSort;
  const sortedCustomers = [...list].sort((a, b) => {
    let comparison = 0;
    if (by === 'itemCount') {
      comparison = (Number(a.count) || 0) - (Number(b.count) || 0);
    } else {
      comparison = (Date.parse(a.updatedAt || '') || 0) - (Date.parse(b.updatedAt || '') || 0);
    }
    if (comparison === 0) {
      comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    }
    return dir === 'desc' ? -comparison : comparison;
  });

  sortedCustomers.forEach((cust, idx) => {
    const card = document.createElement('div');
    card.className = 'customer-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Credit sheet for ${cust.name}`);
    card.onclick = () => openCustomerLedger(cust.name);

    card.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openCustomerLedger(cust.name);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = card.nextElementSibling;
        if (next && next.classList.contains('customer-card')) next.focus();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = card.previousElementSibling;
        if (prev && prev.classList.contains('customer-card')) {
          prev.focus();
        } else {
          const sInp = document.getElementById('customerSearchInput');
          if (sInp) sInp.focus();
        }
      }
    };

    const countText = `${cust.count || 0} ${cust.count === 1 ? 'item' : 'items'} on credit`;
    const modifiedAt = cust.updatedAt ? new Date(cust.updatedAt) : null;
    const NepaliDate = window.NepaliDate && (window.NepaliDate.default || window.NepaliDate);
    const modifiedDateBs = modifiedAt && Number.isFinite(modifiedAt.getTime()) && NepaliDate
      ? new NepaliDate(modifiedAt).format('YYYY-MM-DD')
      : '';
    const modifiedText = modifiedDateBs
      ? `Modified: ${modifiedDateBs}`
      : 'Not modified';

    card.innerHTML = `
      <div class="card-top">
        <span class="card-customer-name">${escapeHtml(cust.name)}</span>
        <div class="card-meta-row">
          <span class="card-badge">${countText}</span>
          <span class="card-date modified-date">${escapeHtml(modifiedText)}</span>
        </div>
      </div>
      <div class="customer-card-actions">
        <button type="button" class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); editCustomerName('${escapeJs(cust.name)}')">✎ EDIT NAME</button>
        <button type="button" class="btn btn-secondary btn-sm">📂 Open Credit Sheet &rarr;</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function toggleCustomerSort(field) {
  if (state.customerSort.by === field) {
    state.customerSort.dir = state.customerSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    state.customerSort.by = field;
    state.customerSort.dir = 'desc';
  }
  onCustomerSearchInput();
}

function updateCustomerSortUI() {
  const { by, dir } = state.customerSort;
  const modifiedButton = document.getElementById('btnCustomerSortModified');
  const countButton = document.getElementById('btnCustomerSortCount');
  if (modifiedButton) {
    modifiedButton.classList.toggle('active-sort', by === 'modifiedAt');
    modifiedButton.textContent = `🕒 Last Modified ${by === 'modifiedAt' ? (dir === 'desc' ? '▼' : '▲') : ''}`;
  }
  if (countButton) {
    countButton.classList.toggle('active-sort', by === 'itemCount');
    countButton.textContent = `# Credit Items ${by === 'itemCount' ? (dir === 'desc' ? '▼' : '▲') : ''}`;
  }
}

async function addNewCustomer() {
  const input = document.getElementById('newCustomerInput');
  const name = input.value.trim().toUpperCase();

  if (!name) {
    showToast('Please enter customer name.', 'error');
    return;
  }

  primeSuccessSound();
  try {
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (res.ok) {
      playSuccessSound();
      input.value = '';
      showToast(`Added: ${data.customer}`, 'success');
      await loadCustomers();
      openCustomerLedger(data.customer);
    } else {
      showToast(data.error || 'Failed to add customer', 'error');
    }
  } catch (err) {
    showToast('Server error adding customer', 'error');
  }
}

async function renameCustomer(oldName, newName) {
  const cleanNewName = newName.trim().toUpperCase();
  if (!cleanNewName) {
    showToast('Customer name is required.', 'error');
    return null;
  }

  try {
    const res = await fetch(`/api/customers/${encodeURIComponent(oldName)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: cleanNewName })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unable to rename customer');
    showToast(`Renamed to: ${data.customer}`, 'success');
    return data.customer;
  } catch (err) {
    showToast(err.message || 'Server error renaming customer', 'error');
    return null;
  }
}

async function editCustomerName(customerName) {
  const newName = window.prompt('EDIT CREDIT KHATA CUSTOMER NAME', customerName);
  if (newName === null) return;
  const renamed = await renameCustomer(customerName, newName);
  if (!renamed) return;
  await loadCustomers();
}

async function editCurrentCustomerName() {
  const oldName = state.currentCustomer;
  const newName = window.prompt('EDIT CREDIT KHATA CUSTOMER NAME', oldName);
  if (newName === null) return;
  const renamed = await renameCustomer(oldName, newName);
  if (!renamed) return;
  state.currentCustomer = renamed;
  document.getElementById('ledgerCustomerName').textContent = renamed;
  try { localStorage.setItem('hardware_last_credit_customer', renamed); } catch (err) {}
  await loadCustomers();
  await fetchAndRenderLedger();
}

async function openCustomerLedger(customerName) {
  state.currentCustomer = customerName.toUpperCase();
  try {
    localStorage.setItem('hardware_last_credit_customer', state.currentCustomer);
  } catch (err) {
    console.warn('Unable to remember the last credit customer:', err);
  }
  document.getElementById('ledgerCustomerName').textContent = state.currentCustomer;
  document.getElementById('filterSheetInput').value = '';
  resetCreditDateFilter();

  initEntryFormRows();
  resetDateToToday();
  document.getElementById('entryDriverName').value = '';
  document.getElementById('entryVehicleNumber').value = '';

  navigateTo('ledger');
  await fetchAndRenderLedger();
  const entryForm = document.getElementById('entryFormCard');
  if (entryForm) entryForm.style.display = 'block';
  const driverInput = document.getElementById('entryDriverName');
  if (driverInput) {
    driverInput.focus();
    driverInput.select();
  }
}

async function fetchAndRenderLedger() {
  try {
    const enc = encodeURIComponent(state.currentCustomer);
    const res = await fetch(`/api/records/${enc}`);
    if (res.ok) {
      state.currentCustomerRecord = await res.json();
      renderCustomerLedgerTable(state.currentCustomerRecord.entries || []);
    }
  } catch (err) {
    console.error('Error fetching ledger:', err);
  }
}

function onFilterSheetInput() {
  if (!state.currentCustomerRecord) return;
  renderCustomerLedgerTable(state.currentCustomerRecord.entries || []);
}

// ---------------- CREDIT KHATA SORTING & DATE SECTION (Requirements 1 & 2) ----------------
function toggleCreditSort(field) {
  if (state.creditSort.by === field) {
    state.creditSort.dir = state.creditSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    state.creditSort.by = field;
    state.creditSort.dir = 'asc';
  }
  updateCreditSortUI();
  if (state.currentCustomerRecord) {
    renderCustomerLedgerTable(state.currentCustomerRecord.entries || []);
  }
}

function updateCreditSortUI() {
  const { by, dir } = state.creditSort;
  const arrow = dir === 'asc' ? '▲' : '▼';

  const btnItem = document.getElementById('btnSortItemName');
  const btnDate = document.getElementById('btnSortDate');
  const btnSn = document.getElementById('btnSortSn');

  if (btnItem) {
    btnItem.classList.toggle('active-sort', by === 'itemName');
    btnItem.textContent = `🔤 Item (A-Z) ${by === 'itemName' ? arrow : ''}`;
  }
  if (btnDate) {
    btnDate.classList.toggle('active-sort', by === 'date');
    btnDate.textContent = `📅 Date ${by === 'date' ? arrow : ''}`;
  }
  if (btnSn) {
    btnSn.classList.toggle('active-sort', by === 'sn');
    btnSn.textContent = `# S.N. ${by === 'sn' ? arrow : ''}`;
  }

  const indItem = document.getElementById('sortIndicatorItem');
  const indDate = document.getElementById('sortIndicatorDate');
  const indSn = document.getElementById('sortIndicatorSn');

  if (indItem) indItem.textContent = by === 'itemName' ? arrow : '';
  if (indDate) indDate.textContent = by === 'date' ? arrow : '';
  if (indSn) indSn.textContent = by === 'sn' ? arrow : '';
}

function getTodayNepaliDateString() {
  const today = getTodayNepaliDateObject();
  return `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;
}

function updateCreditDateFilterButtons() {
  const today = getTodayNepaliDateString();
  const isToday = state.creditDateFilter.from === today && state.creditDateFilter.to === today;
  const isAll = !state.creditDateFilter.from && !state.creditDateFilter.to;
  document.getElementById('btnCreditToday')?.classList.toggle('active', isToday);
  document.getElementById('btnCreditAllDates')?.classList.toggle('active', isAll);
}

function setCreditTodayFilter() {
  const today = getTodayNepaliDateString();
  const fromEl = document.getElementById('creditFromDate');
  const toEl = document.getElementById('creditToDate');
  if (fromEl) fromEl.value = today;
  if (toEl) toEl.value = today;
  state.creditDateFilter.from = today;
  state.creditDateFilter.to = today;
  updateCreditDateFilterButtons();
  if (state.currentCustomerRecord) {
    renderCustomerLedgerTable(state.currentCustomerRecord.entries || []);
  }
}

function onCreditDateFilterChange() {
  const fromEl = document.getElementById('creditFromDate');
  const toEl = document.getElementById('creditToDate');
  state.creditDateFilter.from = (fromEl ? fromEl.value : '').trim();
  state.creditDateFilter.to = (toEl ? toEl.value : '').trim();
  updateCreditDateFilterButtons();
  if (state.currentCustomerRecord) {
    renderCustomerLedgerTable(state.currentCustomerRecord.entries || []);
  }
}

function resetCreditDateFilter() {
  const fromEl = document.getElementById('creditFromDate');
  const toEl = document.getElementById('creditToDate');
  if (fromEl) fromEl.value = '';
  if (toEl) toEl.value = '';
  state.creditDateFilter.from = '';
  state.creditDateFilter.to = '';
  updateCreditDateFilterButtons();
  if (state.currentCustomerRecord) {
    renderCustomerLedgerTable(state.currentCustomerRecord.entries || []);
  }
}

function renderCustomerLedgerTable(entries) {
  const tbody = document.getElementById('customerLedgerTbody');
  tbody.innerHTML = '';

  let list = [...entries];

  // Apply search query filter if any
  const filterInput = document.getElementById('filterSheetInput');
  const q = filterInput ? filterInput.value.trim().toLowerCase() : '';
  if (q) {
    list = list.filter(e =>
      (e.itemName || '').toLowerCase().includes(q) ||
      (e.date || '').toLowerCase().includes(q) ||
      (e.unit || '').toLowerCase().includes(q) ||
      String(e.quantity || '').toLowerCase().includes(q) ||
      (e.driverName || '').toLowerCase().includes(q) ||
      (e.vehicleNumber || '').toLowerCase().includes(q) ||
      (e.remarks || '').toLowerCase().includes(q)
    );
  }

  // Apply Date Section filter (From Date to To Date)
  if (state.creditDateFilter.from) {
    list = list.filter(e => (e.date || '') >= state.creditDateFilter.from);
  }
  if (state.creditDateFilter.to) {
    list = list.filter(e => (e.date || '') <= state.creditDateFilter.to);
  }

  // Apply Sorting (Requirement 1: Ascending order by item A-Z by default)
  const { by, dir } = state.creditSort;
  list.sort((a, b) => {
    let cmp = 0;
    if (by === 'itemName') {
      cmp = (a.itemName || '').localeCompare(b.itemName || '', undefined, { sensitivity: 'base' });
    } else if (by === 'date') {
      cmp = (a.date || '').localeCompare(b.date || '');
    } else {
      // 'sn' (preserve natural order)
      cmp = 0;
    }
    return dir === 'desc' ? -cmp : cmp;
  });

  const counterElem = document.getElementById('sheetItemCounter');
  if (counterElem) {
    counterElem.textContent = `${list.length} ${list.length === 1 ? 'item' : 'items'} on credit`;
  }
  const countBadge = document.getElementById('ledgerItemCount');
  if (countBadge) {
    countBadge.textContent = `${list.length} ${list.length === 1 ? 'item' : 'items'} on credit`;
  }

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 36px; color: #777; font-weight: 600;">
          No items on credit match your criteria. Click "➕ Add Items" above or adjust date/search filter.
        </td>
      </tr>
    `;
    return;
  }

  list.forEach((e, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-sn">${idx + 1}</td>
      <td class="col-date">${escapeHtml(e.date)}</td>
      <td class="col-item">${escapeHtml(e.itemName)}</td>
      <td class="col-unit">${escapeHtml(e.unit || '-')}</td>
      <td class="col-qty">${escapeHtml(e.quantity || '-')}</td>
      <td>${escapeHtml(e.driverName || '-')}</td>
      <td>${escapeHtml(e.vehicleNumber || '-')}</td>
      <td style="color:#666;">${escapeHtml(e.remarks || '-')}</td>
      <td class="col-actions"></td>
    `;
    const actions = tr.querySelector('.col-actions');
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'btn btn-secondary btn-sm';
    editButton.textContent = '✏️';
    editButton.title = 'Edit credit item';
    editButton.addEventListener('click', () => openEditCreditModal(e));

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'btn btn-danger btn-sm';
    deleteButton.textContent = '🗑️';
    deleteButton.title = 'Delete credit item';
    deleteButton.addEventListener('click', () => confirmDeleteCreditEntry(e.id));

    actions.append(editButton, deleteButton);
    tbody.appendChild(tr);
  });
}

function toggleAddEntryForm() {
  const card = document.getElementById('entryFormCard');
  if (card.style.display === 'none') {
    card.style.display = 'block';
    const firstInput = card.querySelector('.item-input');
    if (firstInput) firstInput.focus();
  } else {
    card.style.display = 'none';
  }
}

function initEntryFormRows() {
  const tbody = document.getElementById('entryRowsTbody');
  tbody.innerHTML = '';
  for (let i = 1; i <= 3; i++) {
    appendEntryRow(false);
  }
}

function setupCreditEntryKeyboardWorkflow() {
  const fieldIds = [
    'entryYear',
    'entryMonth',
    'entryDay',
    'entryDriverName',
    'entryVehicleNumber'
  ];
  const fields = fieldIds.map(id => document.getElementById(id)).filter(Boolean);

  fields.forEach((field, index) => {
    field.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.isComposing) return;
      event.preventDefault();

      const nextField = fields[index + 1];
      if (nextField) {
        nextField.focus();
        return;
      }

      const firstItemInput = document.querySelector('#entryRowsTbody .item-input');
      if (firstItemInput) firstItemInput.focus();
    });
  });
}

function setupNumpadNumericEntry() {
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) ||
        target.readOnly ||
        !target.matches('.qty-input, #saleQty, #saleRate, #editCreditQty, #editSaleQty, #editSaleRate')) {
      return;
    }

    const digitMatch = event.code.match(/^Numpad([0-9])$/);
    const text = digitMatch ? digitMatch[1] : event.code === 'NumpadDecimal' ? '.' : '';
    if (!text) return;
    if (/^[0-9.]$/.test(event.key)) return;

    event.preventDefault();
    event.stopPropagation();

    if (target.type === 'number') {
      target.value += text;
    } else {
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? start;
      target.setRangeText(text, start, end, 'end');
    }
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }, true);
}

// ---------------- 4-DIRECTIONAL ARROW KEY NAVIGATION IN TABLE (Requirement 5) ----------------
function handleTableInputArrowNavigation(e, input, tr) {
  const popup = document.getElementById('suggestionsPopup');
  const isPopupOpen = popup && popup.style.display === 'block';

  // The item input's vertical arrows belong to autocomplete while it is open.
  if (isPopupOpen && input.classList.contains('item-input') &&
      (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape')) {
    handleNameInputKeydown(e, input, tr.querySelector('.qty-input'));
    return;
  }

  const cells = [
    tr.querySelector('.item-input'),
    tr.querySelector('.unit-input'),
    tr.querySelector('.qty-input'),
    tr.querySelector('.remarks-input')
  ].filter(Boolean);

  const colIdx = cells.indexOf(input);

  if (e.key === 'ArrowRight') {
    const isAtEnd = input.selectionStart === input.value.length;
    if (isAtEnd && colIdx < cells.length - 1) {
      e.preventDefault();
      cells[colIdx + 1].focus();
      cells[colIdx + 1].select?.();
    }
  } else if (e.key === 'ArrowLeft') {
    const isAtStart = input.selectionEnd === 0;
    if (isAtStart && colIdx > 0) {
      e.preventDefault();
      cells[colIdx - 1].focus();
      cells[colIdx - 1].select?.();
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    const nextRow = tr.nextElementSibling;
    if (nextRow) {
      const nextCells = [
        nextRow.querySelector('.item-input'),
        nextRow.querySelector('.unit-input'),
        nextRow.querySelector('.qty-input'),
        nextRow.querySelector('.remarks-input')
      ];
      if (nextCells[colIdx]) {
        nextCells[colIdx].focus();
        nextCells[colIdx].select?.();
      }
    } else {
      // Automatically append a new row on pressing ArrowDown on the last row!
      appendEntryRow(false);
      const newlyCreatedRow = tr.parentElement.lastElementChild;
      const newCells = [
        newlyCreatedRow.querySelector('.item-input'),
        newlyCreatedRow.querySelector('.unit-input'),
        newlyCreatedRow.querySelector('.qty-input'),
        newlyCreatedRow.querySelector('.remarks-input')
      ];
      if (newCells[colIdx]) {
        newCells[colIdx].focus();
      }
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prevRow = tr.previousElementSibling;
    if (prevRow) {
      const prevCells = [
        prevRow.querySelector('.item-input'),
        prevRow.querySelector('.unit-input'),
        prevRow.querySelector('.qty-input'),
        prevRow.querySelector('.remarks-input')
      ];
      if (prevCells[colIdx]) {
        prevCells[colIdx].focus();
        prevCells[colIdx].select?.();
      }
    }
  }
}

function appendEntryRow(focusNew = true) {
  const tbody = document.getElementById('entryRowsTbody');
  const sn = tbody.children.length + 1;
  const tr = document.createElement('tr');

  // Requirement 4: Custom unit text input with common datalist options
  tr.innerHTML = `
    <td style="text-align: center; font-weight: 700; background: #fafafa;">${sn}</td>
    <td>
      <input type="text" class="entry-input item-input" placeholder="Type product name..." autocomplete="off">
    </td>
    <td>
      <input type="text" list="commonUnitsDatalist" class="entry-input unit-input" placeholder="Auto unit or type new unit" aria-label="Unit (auto-detected or editable)" autocomplete="off">
    </td>
    <td>
      <input type="text" class="entry-input qty-input" placeholder="e.g. 10">
    </td>
    <td>
      <input type="text" class="entry-input remarks-input" placeholder="Optional note">
    </td>
    <td style="text-align: center;">
      <button type="button" class="btn-delete-row" onclick="deleteEntryRow(this)">&times;</button>
    </td>
  `;

  tbody.appendChild(tr);

  const nameInput = tr.querySelector('.item-input');
  const unitInput = tr.querySelector('.unit-input');
  const qtyInput = tr.querySelector('.qty-input');
  const remarksInput = tr.querySelector('.remarks-input');
  unitInput.dataset.autoDetectedUnit = unitInput.value;

  nameInput.addEventListener('input', () => {
    nameInput.value = nameInput.value.toUpperCase();
    if (unitInput.dataset.manuallyEdited !== 'true') {
      const detectedUnit = detectUnitFromItemName(nameInput.value);
      const previousAutoUnit = normalizeUnit(unitInput.dataset.autoDetectedUnit);
      if (detectedUnit || unitInput.value === previousAutoUnit) {
        setCreditEntryUnit(unitInput, detectedUnit);
      }
    }
    showSuggestionsFor(nameInput);
  });

  nameInput.addEventListener('focus', () => showSuggestionsFor(nameInput));

  nameInput.addEventListener('keydown', (e) => {
    const popup = document.getElementById('suggestionsPopup');
    const isOpen = popup && popup.style.display === 'block';

    if (e.key === 'Enter') {
      if (!nameInput.value.trim() && (!isOpen || state.highlightedSuggestionIndex < 0)) {
        e.preventDefault();
        hideSuggestions();
        const saveBtn = document.querySelector('.btn-save-big');
        if (saveBtn) saveBtn.focus();
        return;
      }
      if (!isOpen) {
        e.preventDefault();
        unitInput.focus();
        return;
      }
    }
    handleTableInputArrowNavigation(e, nameInput, tr);
  });

  unitInput.addEventListener('change', () => {
    const unit = normalizeUnit(unitInput.value);
    unitInput.value = unit;
    unitInput.dataset.manuallyEdited = 'true';
    if (rememberCustomUnit(unit)) {
      showToast(`Unit "${unit}" added to your unit list.`, 'success');
    }
  });

  unitInput.addEventListener('input', () => {
    unitInput.dataset.manuallyEdited = 'true';
    unitInput.value = normalizeUnit(unitInput.value);
  });

  unitInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      qtyInput.focus();
      return;
    }
    handleTableInputArrowNavigation(e, unitInput, tr);
  });

  qtyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      remarksInput.focus();
      return;
    }
    handleTableInputArrowNavigation(e, qtyInput, tr);
  });

  remarksInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nameInput.value.trim()) {
        const nextRow = tr.nextElementSibling;
        if (nextRow) {
          nextRow.querySelector('.item-input').focus();
        } else {
          appendEntryRow(true);
        }
      } else {
        const saveBtn = document.querySelector('.btn-save-big');
        if (saveBtn) saveBtn.focus();
      }
      return;
    }
    handleTableInputArrowNavigation(e, remarksInput, tr);
  });

  if (focusNew) {
    nameInput.focus();
  }
}

function deleteEntryRow(btn) {
  const tr = btn.closest('tr');
  const tbody = document.getElementById('entryRowsTbody');
  if (tbody.children.length <= 1) {
    tr.querySelector('.item-input').value = '';
    tr.querySelector('.qty-input').value = '';
    tr.querySelector('.remarks-input').value = '';
    return;
  }
  tr.remove();
  tbody.querySelectorAll('tr').forEach((r, idx) => r.children[0].textContent = idx + 1);
}

async function saveNewEntries() {
  const tbody = document.getElementById('entryRowsTbody');
  const rows = tbody.querySelectorAll('tr');
  const dateStr = getSelectedNepaliDateString();
  const driverName = document.getElementById('entryDriverName').value.trim();
  const vehicleNumber = document.getElementById('entryVehicleNumber').value.trim();

  const entriesToSave = [];

  rows.forEach(r => {
    const itemName = r.querySelector('.item-input').value.trim().toUpperCase();
    const unit = normalizeUnit(r.querySelector('.unit-input').value);
    const quantity = r.querySelector('.qty-input').value.trim();
    const remarks = r.querySelector('.remarks-input').value.trim();

    if (itemName) {
      rememberCustomUnit(unit);
      entriesToSave.push({
        date: dateStr,
        itemName,
        unit,
        quantity,
        driverName,
        vehicleNumber,
        remarks
      });
    }
  });

  if (entriesToSave.length === 0) {
    showToast('Please type at least one product name.', 'error');
    return;
  }

  primeSuccessSound();
  try {
    const enc = encodeURIComponent(state.currentCustomer);
    const res = await fetch(`/api/records/${enc}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: entriesToSave })
    });

    const data = await res.json();
    if (res.ok) {
      playSuccessSound();
      showToast(`Saved ${entriesToSave.length} credit items to sheet!`, 'success');
      initEntryFormRows();
      await fetchAndRenderLedger();
      await loadItemSuggestions();
      await loadCustomers();
    } else {
      showToast(data.error || 'Failed to save items', 'error');
    }
  } catch (err) {
    showToast('Server error while saving items', 'error');
  }
}

function openEditCreditModal(entry) {
  document.getElementById('editCreditId').value = entry.id;
  document.getElementById('editCreditDate').value = entry.date || '';
  document.getElementById('editCreditItemName').value = entry.itemName || '';
  document.getElementById('editCreditUnit').value = entry.unit || '';
  document.getElementById('editCreditQty').value = entry.quantity || '';
  document.getElementById('editCreditDriver').value = entry.driverName || '';
  document.getElementById('editCreditVehicle').value = entry.vehicleNumber || '';
  document.getElementById('editCreditRemarks').value = entry.remarks || '';

  document.getElementById('modalEditCreditEntry').classList.add('active');
}

function closeEditCreditModal() {
  document.getElementById('modalEditCreditEntry').classList.remove('active');
}

function setupCreditEditKeyboardSave() {
  const modal = document.getElementById('modalEditCreditEntry');
  if (!modal) return;

  modal.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing ||
        event.target.tagName === 'TEXTAREA' ||
        !modal.classList.contains('active')) {
      return;
    }

    event.preventDefault();
    submitEditCreditEntry();
  });
}

async function submitEditCreditEntry() {
  const entryId = document.getElementById('editCreditId').value;
  const date = document.getElementById('editCreditDate').value.trim();
  const itemName = document.getElementById('editCreditItemName').value.trim().toUpperCase();
  const unit = document.getElementById('editCreditUnit').value.trim();
  const quantity = document.getElementById('editCreditQty').value.trim();
  const driverName = document.getElementById('editCreditDriver').value.trim();
  const vehicleNumber = document.getElementById('editCreditVehicle').value.trim();
  const remarks = document.getElementById('editCreditRemarks').value.trim();

  if (!itemName) {
    showToast('Item name cannot be empty', 'error');
    return;
  }

  try {
    const encCust = encodeURIComponent(state.currentCustomer);
    const encId = encodeURIComponent(entryId);
    const res = await fetch(`/api/records/${encCust}/entries/${encId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, itemName, unit, quantity, driverName, vehicleNumber, remarks })
    });

    if (res.ok) {
      closeEditCreditModal();
      showToast('Credit item updated', 'success');
      await fetchAndRenderLedger();
      await loadCustomers();
      await loadItemSuggestions();
    } else {
      const error = await res.json();
      showToast(error.error || 'Failed to update item', 'error');
    }
  } catch (err) {
    console.error('Error updating credit item:', err);
    showToast(`Error saving changes: ${err.message}`, 'error');
  }
}

async function confirmDeleteCreditEntry(entryId) {
  if (!confirm('Are you sure you want to delete this credit item?')) return;

  try {
    const encCust = encodeURIComponent(state.currentCustomer);
    const encId = encodeURIComponent(entryId);
    const res = await fetch(`/api/records/${encCust}/entries/${encId}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      showToast('Credit item deleted', 'success');
      await fetchAndRenderLedger();
      await loadCustomers();
    } else {
      const error = await res.json();
      showToast(error.error || 'Failed to delete item', 'error');
    }
  } catch (err) {
    console.error('Error deleting credit item:', err);
    showToast(`Error deleting item: ${err.message}`, 'error');
  }
}

function exportCurrentLedgerPdf() {
  if (!state.currentCustomer) return;
  const enc = encodeURIComponent(state.currentCustomer);
  const params = new URLSearchParams();
  if (state.creditDateFilter.from) params.append('fromDate', state.creditDateFilter.from);
  if (state.creditDateFilter.to) params.append('toDate', state.creditDateFilter.to);
  params.append('sortBy', state.creditSort.by);
  params.append('sortDir', state.creditSort.dir);

  const a = document.createElement('a');
  a.href = `/api/records/${enc}/pdf?${params.toString()}`;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast(`Downloading PDF for ${state.currentCustomer}...`, 'success');
}

function exportCurrentLedgerExcel() {
  if (!state.currentCustomer) return;
  const enc = encodeURIComponent(state.currentCustomer);
  const params = new URLSearchParams();
  if (state.creditDateFilter.from) params.append('fromDate', state.creditDateFilter.from);
  if (state.creditDateFilter.to) params.append('toDate', state.creditDateFilter.to);
  params.append('sortBy', state.creditSort.by);
  params.append('sortDir', state.creditSort.dir);

  downloadExcel(
    `/api/records/${enc}/excel?${params.toString()}`,
    `Downloading Excel sheet (.xlsx) for ${state.currentCustomer}...`
  );
}

async function downloadExcel(url, successMessage) {
  try {
    const response = await fetch(url);
    const contentType = response.headers.get('content-type') || '';
    const excelContentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    if (!response.ok || !contentType.includes(excelContentType)) {
      let errorMessage = response.ok
        ? 'The server did not return an Excel workbook.'
        : `Excel export failed (HTTP ${response.status}).`;

      if (contentType.includes('application/json')) {
        const payload = await response.json();
        if (payload && typeof payload.error === 'string') {
          errorMessage = payload.error;
        } else if (response.ok) {
          errorMessage = 'The server returned JSON instead of an Excel workbook.';
        }
      }

      throw new Error(errorMessage);
    }

    const blob = await response.blob();
    const signature = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    if (signature[0] !== 0x50 || signature[1] !== 0x4b) {
      throw new Error('The server response is not a valid .xlsx workbook.');
    }

    const disposition = response.headers.get('content-disposition') || '';
    const filenameMatch = disposition.match(/filename="([^"]+)"/i);
    const filename = filenameMatch ? filenameMatch[1] : 'export.xlsx';
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    showToast(successMessage, 'success');
  } catch (err) {
    console.error('Excel export failed:', err);
    showToast(err.message || 'Failed to download Excel workbook.', 'error');
  }
}

// ---------------- DATE SECTION EXPORT MODAL (Requirements 2 & 3) ----------------
function openExportModal(context = 'credit') {
  state.exportContext = context;
  state.salesExportGrouping = state.salesViewMode;
  const modal = document.getElementById('modalExportDateRange');
  const title = document.getElementById('exportModalTitle');
  const desc = document.getElementById('exportModalDesc');
  const fromInput = document.getElementById('exportFromDate');
  const toInput = document.getElementById('exportToDate');

  if (context === 'credit') {
    if (title) title.textContent = `📥 Export Credit Record: ${state.currentCustomer}`;
    if (desc) desc.textContent = `Filter date section for ${state.currentCustomer} (Sorted by: ${state.creditSort.by === 'itemName' ? 'Item Name (A-Z)' : state.creditSort.by}):`;
    if (fromInput) fromInput.value = state.creditDateFilter.from || '';
    if (toInput) toInput.value = state.creditDateFilter.to || '';
  } else {
    if (title) title.textContent = '📥 Export Daily Sales Records';
    if (desc) desc.textContent = 'Choose a date range. PDF follows the selected layout; Excel includes both the full list and grouped-by-date sheets.';
    if (fromInput) fromInput.value = state.salesDateFilter.from || '';
    if (toInput) toInput.value = state.salesDateFilter.to || '';
  }

  const salesOptions = document.getElementById('salesExportOptions');
  if (salesOptions) salesOptions.style.display = context === 'sales' ? 'block' : 'none';
  updateSalesExportGroupingUI();
  if (modal) modal.classList.add('active');
}

function closeExportModal() {
  const modal = document.getElementById('modalExportDateRange');
  if (modal) modal.classList.remove('active');
}

function setExportRangePreset(preset) {
  const fromInput = document.getElementById('exportFromDate');
  const toInput = document.getElementById('exportToDate');
  const todayStr = state.exportContext === 'sales'
    ? getSelectedSaleNepaliDateString()
    : getTodayNepaliDateString();

  if (preset === 'today') {
    if (fromInput) fromInput.value = todayStr;
    if (toInput) toInput.value = todayStr;
  } else if (preset === 'thisMonth') {
    const parts = todayStr.split('-');
    if (parts.length >= 2) {
      const configMap = (window.NepaliDate && window.NepaliDate.dateConfigMap) ||
        (window.NepaliDate && window.NepaliDate.default && window.NepaliDate.default.dateConfigMap);
      const monthLengths = configMap && configMap[parts[0]];
      const monthKey = monthLengths ? Object.keys(monthLengths)[Number(parts[1]) - 1] : null;
      const monthEnd = monthKey ? monthLengths[monthKey] : 32;
      if (fromInput) fromInput.value = `${parts[0]}-${parts[1]}-01`;
      if (toInput) toInput.value = `${parts[0]}-${parts[1]}-${String(monthEnd).padStart(2, '0')}`;
    }
  } else if (preset === 'all') {
    if (fromInput) fromInput.value = '';
    if (toInput) toInput.value = '';
  }
}

function setSalesExportGrouping(mode) {
  state.salesExportGrouping = mode;
  updateSalesExportGroupingUI();
}

function updateSalesExportGroupingUI() {
  const groupedButton = document.getElementById('btnExportGrouped');
  const flatButton = document.getElementById('btnExportFlat');
  if (groupedButton) groupedButton.classList.toggle('active', state.salesExportGrouping === 'grouped');
  if (flatButton) flatButton.classList.toggle('active', state.salesExportGrouping === 'flat');
}

function triggerDateRangeExport(format) {
  const fromDate = (document.getElementById('exportFromDate').value || '').trim();
  const toDate = (document.getElementById('exportToDate').value || '').trim();

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if ((fromDate && !datePattern.test(fromDate)) || (toDate && !datePattern.test(toDate))) {
    showToast('Enter dates in YYYY-MM-DD format.', 'error');
    return;
  }
  if (fromDate && toDate && fromDate > toDate) {
    showToast('From Date must be on or before To Date.', 'error');
    return;
  }

  const params = new URLSearchParams();
  if (fromDate) params.append('fromDate', fromDate);
  if (toDate) params.append('toDate', toDate);

  let url = '';
  let successMessage = '';
  if (state.exportContext === 'credit') {
    if (!state.currentCustomer) {
      showToast('No credit customer selected', 'error');
      return;
    }
    params.append('sortBy', state.creditSort.by);
    params.append('sortDir', state.creditSort.dir);
    url = `/api/records/${encodeURIComponent(state.currentCustomer)}/${format}?${params.toString()}`;
    successMessage = `Downloading Credit ${format.toUpperCase()} (${fromDate || 'all'} to ${toDate || 'all'})...`;
  } else {
    if (state.salesExportGrouping === 'grouped') {
      params.append('grouped', 'true');
    }
    url = `/api/daily-sales/${format}?${params.toString()}`;
    successMessage = `Downloading Daily Sales ${format.toUpperCase()} (${fromDate || 'all'} to ${toDate || 'all'})...`;
  }

  if (format === 'excel') {
    downloadExcel(url, successMessage);
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(successMessage, 'success');
  }

  closeExportModal();
}

function printCurrentLedger() {
  if (!state.currentCustomerRecord) return;
  const printArea = document.getElementById('printable-area');
  printArea.innerHTML = '';

  const shopName = (state.shopConfig.shopName || 'SHREE PASUPATINATH HARDWARE').toUpperCase();
  const entries = state.currentCustomerRecord.entries || [];

  const page = document.createElement('div');
  page.className = 'print-page';

  let rowsHtml = '';
  entries.forEach((e, idx) => {
    rowsHtml += `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td style="text-align: center;">${escapeHtml(e.date)}</td>
        <td style="font-weight: 700;">${escapeHtml(e.itemName)}</td>
        <td style="text-align: center;">${escapeHtml(e.unit || '-')}</td>
        <td style="text-align: center;">${escapeHtml(e.quantity || '-')}</td>
        <td>${escapeHtml(e.driverName || '-')}</td>
        <td>${escapeHtml(e.vehicleNumber || '-')}</td>
        <td>${escapeHtml(e.remarks || '-')}</td>
      </tr>
    `;
  });

  page.innerHTML = `
    <div class="print-header">
      <div class="print-shop-name">${escapeHtml(shopName)}</div>
      <div class="print-title">CREDIT CUSTOMER RECORD (KHATA)</div>
    </div>

    <div class="print-meta">
      <div><strong>Customer:</strong> ${escapeHtml(state.currentCustomer)}</div>
      <div><strong>Total Items:</strong> ${entries.length} on credit &bull; <strong>Date:</strong> ${escapeHtml(getSelectedNepaliDateString())}</div>
    </div>

    <table class="print-table">
      <thead>
        <tr>
          <th style="width: 35px;">S.N.</th>
          <th style="width: 80px;">Date (BS)</th>
          <th>Item Name / Particulars</th>
          <th style="width: 60px;">Unit</th>
          <th style="width: 60px;">Qty</th>
          <th style="width: 80px;">Driver</th>
          <th style="width: 80px;">Vehicle No.</th>
          <th>Remarks</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="8" style="text-align:center; padding:12px;">No credit items recorded.</td></tr>'}
      </tbody>
    </table>
  `;

  printArea.appendChild(page);
  window.print();
}

// ---------------- ========================================== ----------------
// ---------------- SECTION 2: SEPARATE DAILY SALES & CHART -------------------
// ---------------- ========================================== ----------------

function calculateSaleTotal() {
  const q = parseFloat(document.getElementById('saleQty').value) || 0;
  const r = parseFloat(document.getElementById('saleRate').value) || 0;
  const totInput = document.getElementById('saleTotal');
  if (q > 0 && r > 0) {
    totInput.value = (q * r).toLocaleString('en-IN');
  } else {
    totInput.value = '';
  }
}

function addCurrentProductToSale() {
  const itemName = document.getElementById('saleItemName').value.trim().toUpperCase();
  const unitInput = document.getElementById('saleUnit');
  const unit = normalizeUnit(unitInput.value) || detectUnitFromItemName(itemName);
  const qty = parseFloat(document.getElementById('saleQty').value) || 0;
  const rate = parseFloat(document.getElementById('saleRate').value) || 0;
  const remarks = document.getElementById('saleRemarks').value.trim();

  if (!itemName) {
    showToast('Please type a product name.', 'error');
    document.getElementById('saleItemName').focus();
    return false;
  }
  if (qty <= 0) {
    showToast('Please enter a valid quantity.', 'error');
    document.getElementById('saleQty').focus();
    return false;
  }

  const total = qty * rate;
  state.stagedSaleItems.push({
    itemName,
    unit,
    quantity: qty,
    rate,
    total,
    remarks
  });

  playItemAddSound();
  renderStagedSaleItems();

  // Clear product inputs for next item
  document.getElementById('saleItemName').value = '';
  delete unitInput.dataset.manuallyEdited;
  setSaleEntryUnit(unitInput, '');
  document.getElementById('saleQty').value = '';
  document.getElementById('saleRate').value = '';
  document.getElementById('saleTotal').value = '';
  document.getElementById('saleRemarks').value = '';

  const saveBtn = document.getElementById('btnRecordDailySale');
  if (saveBtn) saveBtn.classList.remove('btn-save-focused');

  // Return focus to Product Name ready to add next product!
  const nameInput = document.getElementById('saleItemName');
  if (nameInput) nameInput.focus();

  showToast(`Added ${itemName} (Total: Rs. ${total.toLocaleString('en-IN')}). Enter next product or press Enter on empty product to Save!`, 'info');
  return true;
}

function renderStagedSaleItems() {
  const container = document.getElementById('stagedProductsCard');
  const tbody = document.getElementById('stagedProductsTbody');
  const countBadge = document.getElementById('stagedItemsCountBadge');
  const totalBadge = document.getElementById('stagedItemsTotalBadge');

  if (!container || !tbody) return;

  if (state.stagedSaleItems.length === 0) {
    container.style.display = 'none';
    tbody.innerHTML = '';
    return;
  }

  container.style.display = 'block';
  tbody.innerHTML = '';

  let grandTotal = 0;
  state.stagedSaleItems.forEach((it, idx) => {
    grandTotal += it.total;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align: center; font-weight: 700; background: #f8fafc;">${idx + 1}</td>
      <td style="font-weight: 800; text-transform: uppercase;">${escapeHtml(it.itemName)}</td>
      <td style="text-align: center; font-weight: 700; color: #555;">${escapeHtml(it.unit)}</td>
      <td style="text-align: center; font-weight: 800;">${it.quantity}</td>
      <td style="text-align: right; font-weight: 700;">Rs. ${it.rate.toLocaleString('en-IN')}</td>
      <td style="text-align: right; font-weight: 800; color: var(--success-green);">Rs. ${it.total.toLocaleString('en-IN')}</td>
      <td style="text-align: center;">
        <button type="button" class="btn btn-danger btn-sm" style="padding: 2px 7px; font-size: 0.8rem;" onclick="removeStagedSaleItem(${idx})">&times;</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (countBadge) countBadge.textContent = `📦 Products Added to Current Sale (${state.stagedSaleItems.length} items)`;
  if (totalBadge) totalBadge.textContent = `Total: Rs. ${grandTotal.toLocaleString('en-IN')}`;
}

function removeStagedSaleItem(idx) {
  state.stagedSaleItems.splice(idx, 1);
  renderStagedSaleItems();
}

function clearStagedSaleItems() {
  state.stagedSaleItems = [];
  renderStagedSaleItems();
}

async function submitDailySale() {
  const buyerName = document.getElementById('saleBuyerName').value.trim() || 'Walk-in / Cash';
  const date = getSelectedSaleNepaliDateString();
  const remarks = document.getElementById('saleRemarks').value.trim();

  // If there are unadded inputs in the current form, auto-stage them
  const currentItemName = document.getElementById('saleItemName').value.trim().toUpperCase();
  const saleUnitInput = document.getElementById('saleUnit');
  const currentQty = parseFloat(document.getElementById('saleQty').value) || 0;
  const currentRate = parseFloat(document.getElementById('saleRate').value) || 0;

  if (currentItemName && currentQty <= 0) {
    showToast('Please enter a valid quantity for the current product.', 'error');
    document.getElementById('saleQty').focus();
    return;
  }

  if (!currentItemName && currentQty > 0) {
    showToast('Please enter a product name for the current quantity.', 'error');
    document.getElementById('saleItemName').focus();
    return;
  }

  if (currentItemName && currentQty > 0) {
    state.stagedSaleItems.push({
      itemName: currentItemName,
      unit: normalizeUnit(saleUnitInput.value) || detectUnitFromItemName(currentItemName),
      quantity: currentQty,
      rate: currentRate,
      total: currentQty * currentRate,
      remarks: remarks
    });
  }

  if (state.stagedSaleItems.length === 0) {
    showToast('Please type a product name and quantity.', 'error');
    document.getElementById('saleItemName').focus();
    return;
  }

  primeSuccessSound();
  try {
    const res = await fetch('/api/daily-sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        buyerName,
        remarks,
        items: state.stagedSaleItems
      })
    });

    if (res.ok) {
      const savedCount = state.stagedSaleItems.length;
      const totalAmount = state.stagedSaleItems.reduce((sum, i) => sum + i.total, 0);

      // Play audio confirmation sound!
      playSuccessSound();

      showToast(`💾 Saved ${savedCount} ${savedCount === 1 ? 'product' : 'products'} for ${buyerName} (Rs. ${totalAmount.toLocaleString('en-IN')})!`, 'success');

      // Clear staged items and inputs
      clearStagedSaleItems();
      document.getElementById('saleItemName').value = '';
      delete saleUnitInput.dataset.manuallyEdited;
      setSaleEntryUnit(saleUnitInput, '');
      document.getElementById('saleQty').value = '';
      document.getElementById('saleRate').value = '';
      document.getElementById('saleTotal').value = '';
      document.getElementById('saleRemarks').value = '';

      const saveBtn = document.getElementById('btnRecordDailySale');
      if (saveBtn) saveBtn.classList.remove('btn-save-focused');

      await loadDailySalesAndAnalytics();
      document.getElementById('saleBuyerName').value = getNextDailySalesCustomerName();
      await loadItemSuggestions();

      const itemInput = document.getElementById('saleItemName');
      if (itemInput) itemInput.focus();
    } else {
      const err = await res.json();
      showToast(err.error || 'Failed to record sale', 'error');
    }
  } catch (e) {
    showToast('Server error recording sale', 'error');
  }
}

function setupDailySalesKeyboardWorkflow() {
  const buyerInput = document.getElementById('saleBuyerName');
  const itemInput = document.getElementById('saleItemName');
  const unitSelect = document.getElementById('saleUnit');
  const qtyInput = document.getElementById('saleQty');
  const rateInput = document.getElementById('saleRate');
  const remarksInput = document.getElementById('saleRemarks');
  const saveBtn = document.getElementById('btnRecordDailySale');

  const formFields = [buyerInput, itemInput, unitSelect, qtyInput, rateInput, remarksInput].filter(Boolean);
  if (unitSelect) {
    unitSelect.dataset.autoDetectedUnit = normalizeUnit(unitSelect.value);
    unitSelect.addEventListener('input', () => {
      unitSelect.dataset.manuallyEdited = 'true';
      unitSelect.value = normalizeUnit(unitSelect.value);
    });
    unitSelect.addEventListener('change', () => {
      const unit = normalizeUnit(unitSelect.value);
      unitSelect.value = unit;
      unitSelect.dataset.manuallyEdited = 'true';
      if (rememberCustomUnit(unit)) {
        showToast(`Unit "${unit}" added to your unit list.`, 'success');
      }
    });
  }

  function handleFieldArrowNav(e, currentField) {
    const idx = formFields.indexOf(currentField);
    if (idx === -1) return;

    if (e.key === 'ArrowRight') {
      const isSelect = currentField.tagName === 'SELECT';
      const isAtEnd = isSelect || currentField.selectionStart == null ||
        currentField.selectionStart === currentField.value.length;
      if (isAtEnd && idx < formFields.length - 1) {
        e.preventDefault();
        focusSalesField(formFields[idx + 1]);
      }
    } else if (e.key === 'ArrowLeft') {
      const isSelect = currentField.tagName === 'SELECT';
      const isAtStart = isSelect || currentField.selectionEnd == null ||
        currentField.selectionEnd === 0;
      if (isAtStart && idx > 0) {
        e.preventDefault();
        focusSalesField(formFields[idx - 1]);
      }
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (currentField.tagName === 'SELECT') return;
      const nextIndex = idx + (e.key === 'ArrowDown' ? 1 : -1);
      if (nextIndex >= 0 && nextIndex < formFields.length) {
        e.preventDefault();
        focusSalesField(formFields[nextIndex]);
      }
    }
  }

  function focusSalesField(field) {
    field.focus();
    if (field.tagName === 'INPUT' && field.type === 'text') {
      field.select();
    }
  }

  if (buyerInput) {
    buyerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (itemInput) itemInput.focus();
        return;
      }
      handleFieldArrowNav(e, buyerInput);
    });
  }

  if (itemInput) {
    itemInput.addEventListener('keydown', (e) => {
      const popup = document.getElementById('suggestionsPopup');
      const isPopupOpen = popup && popup.style.display === 'block';

      if (e.key === 'Enter') {
        if (itemInput.value.trim() && isPopupOpen && state.highlightedSuggestionIndex >= 0) {
          e.preventDefault();
          handleNameInputKeydown(e, itemInput, qtyInput);
          return;
        }

        e.preventDefault();
        setTimeout(() => {
          const val = itemInput.value.trim();
          if (!val) {
            hideSuggestions();
            if (remarksInput) {
              remarksInput.focus();
              const count = state.stagedSaleItems.length;
              showToast(
                count > 0
                  ? `Add an optional payment or delivery note, then press ENTER to save ${count} ${count === 1 ? 'item' : 'items'}.`
                  : 'Add an optional payment or delivery note, then press ENTER to save.',
                'info'
              );
            } else if (saveBtn) {
              saveBtn.focus();
            }
          } else {
            hideSuggestions();
            if (unitSelect) unitSelect.focus();
          }
        }, 30);
        return;
      }

      if (isPopupOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        handleNameInputKeydown(e, itemInput, qtyInput);
      } else {
        handleFieldArrowNav(e, itemInput);
      }
    });
  }

  if (unitSelect) {
    unitSelect.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (qtyInput) qtyInput.focus();
        return;
      }
      handleFieldArrowNav(e, unitSelect);
    });
  }

  if (qtyInput) {
    qtyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        calculateSaleTotal();
        if (rateInput) rateInput.focus();
        return;
      }
      handleFieldArrowNav(e, qtyInput);
    });
  }

  if (rateInput) {
    rateInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        calculateSaleTotal();
        addCurrentProductToSale();
        return;
      }
      handleFieldArrowNav(e, rateInput);
    });
  }

  if (remarksInput) {
    remarksInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!itemInput.value.trim()) {
          submitDailySale();
        } else {
          addCurrentProductToSale();
        }
        return;
      }
      handleFieldArrowNav(e, remarksInput);
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('blur', () => {
      saveBtn.classList.remove('btn-save-focused');
    });
    saveBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        submitDailySale();
      }
    });
  }
}

function setupGlobalKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    const priceListView = document.getElementById('view-price-list');
    const isPriceListActive = priceListView && priceListView.classList.contains('active');

    if (e.key === 'F2' && isPriceListActive) {
      e.preventDefault();
      state.priceListTopic = 'ALL';
      renderPriceList();
      document.getElementById('priceListSearchInput').focus();
      return;
    }

    if (e.key === 'F3' && isPriceListActive) {
      e.preventDefault();
      openPriceItemModal();
      return;
    }

    // F1 or Alt+1: Credit Customers
    if (e.key === 'F1' || (e.altKey && e.key === '1')) {
      e.preventDefault();
      navigateToCreditKhata();
      return;
    }

    // F2 or Alt+2: Daily Sales & Chart
    if (e.key === 'F2' || (e.altKey && e.key === '2')) {
      e.preventDefault();
      navigateTo('daily-sales');
      return;
    }

    // '/' to search (when not inside an input)
    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    const isTyping = activeTag === 'input' || activeTag === 'select' || activeTag === 'textarea';

    if (e.key === '/' && !isTyping) {
      e.preventDefault();
      const viewCustomers = document.getElementById('view-customers');
      if (viewCustomers && viewCustomers.classList.contains('active')) {
        const inp = document.getElementById('customerSearchInput');
        if (inp) { inp.focus(); inp.select(); }
      } else {
        const salesInp = document.getElementById('salesSearchInput');
        if (salesInp) { salesInp.focus(); salesInp.select(); }
      }
      return;
    }

    // Ctrl+S or Alt+S: Save
    if ((e.ctrlKey || e.altKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      const viewLedger = document.getElementById('view-ledger');
      const viewSales = document.getElementById('view-daily-sales');
      if (viewLedger && viewLedger.classList.contains('active')) {
        saveNewEntries();
      } else if (viewSales && viewSales.classList.contains('active')) {
        submitDailySale();
      }
      return;
    }

    // Alt+A: Open Add Items in credit sheet
    if (e.altKey && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      const viewLedger = document.getElementById('view-ledger');
      if (viewLedger && viewLedger.classList.contains('active')) {
        toggleAddEntryForm();
      }
      return;
    }

    // Escape: Close popups, modals, forms, or return to directory
    if (e.key === 'Escape') {
      const priceItemModal = document.getElementById('modalPriceItem');
      if (priceItemModal && priceItemModal.classList.contains('active')) {
        closePriceItemModal();
        return;
      }

      const popup = document.getElementById('suggestionsPopup');
      if (popup && popup.style.display === 'block') {
        hideSuggestions();
        return;
      }

      const modalCredit = document.getElementById('modalEditCreditEntry');
      if (modalCredit && modalCredit.classList.contains('active')) {
        closeEditCreditModal();
        return;
      }

      const modalSale = document.getElementById('modalEditSaleEntry');
      if (modalSale && modalSale.classList.contains('active')) {
        closeEditSaleModal();
        return;
      }

      const salesInvoicesModal = document.getElementById('modalSalesInvoices');
      if (salesInvoicesModal && salesInvoicesModal.classList.contains('active')) {
        closeSalesInvoices();
        return;
      }

      const entryCard = document.getElementById('entryFormCard');
      if (entryCard && entryCard.style.display !== 'none') {
        entryCard.style.display = 'none';
        return;
      }

      const viewLedger = document.getElementById('view-ledger');
      if (viewLedger && viewLedger.classList.contains('active')) {
        navigateTo('customers');
        return;
      }
    }
  });

  // Search input keydown listener
  const searchInput = document.getElementById('customerSearchInput');
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const firstCard = document.querySelector('.customer-card');
        if (firstCard) firstCard.focus();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const firstCard = document.querySelector('.customer-card');
        if (firstCard) firstCard.click();
      }
    });
  }
}

async function loadDailySalesAndAnalytics() {
  try {
    const [salesRes, analyticsRes] = await Promise.all([
      fetch('/api/daily-sales'),
      fetch('/api/daily-sales/analytics')
    ]);

    if (salesRes.ok) {
      state.dailySales = await salesRes.json();
      const buyerInput = document.getElementById('saleBuyerName');
      if (buyerInput && !buyerInput.value.trim()) {
        buyerInput.value = getNextDailySalesCustomerName();
      }
      renderDailySales();
    }

    if (analyticsRes.ok) {
      state.salesAnalytics = await analyticsRes.json();
      renderAnalyticsDashboard(state.salesAnalytics);
    }
  } catch (e) {
    console.error('Error loading daily sales:', e);
  }
}

function getNextDailySalesCustomerName() {
  const highestCustomerNumber = state.dailySales.reduce((highest, sale) => {
    const match = (sale.buyerName || '').trim().match(/^CUSTOMER\s+(\d+)$/i);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);

  return `CUSTOMER ${highestCustomerNumber + 1}`;
}

// ---------------- DAILY SALES VIEW MODE & GROUPING (Requirement 3) ----------------
function setSalesViewMode(mode) {
  state.salesViewMode = mode;
  const btnGrouped = document.getElementById('btnSalesGrouped');
  const btnFlat = document.getElementById('btnSalesFlat');
  const containerGrouped = document.getElementById('salesGroupedContainer');
  const containerFlat = document.getElementById('salesFlatContainer');

  if (btnGrouped) btnGrouped.classList.toggle('active', mode === 'grouped');
  if (btnFlat) btnFlat.classList.toggle('active', mode === 'flat');

  if (mode === 'grouped') {
    if (containerGrouped) containerGrouped.style.display = 'block';
    if (containerFlat) containerFlat.style.display = 'none';
  } else {
    if (containerGrouped) containerGrouped.style.display = 'none';
    if (containerFlat) containerFlat.style.display = 'block';
  }

  renderDailySales();
}

function onSalesDateFilterChange() {
  const fromEl = document.getElementById('salesFromDate');
  const toEl = document.getElementById('salesToDate');
  state.salesDateFilter.from = (fromEl ? fromEl.value : '').trim();
  state.salesDateFilter.to = (toEl ? toEl.value : '').trim();
  updateSalesDateFilterButtons();
  renderDailySales();
}

function updateSalesDateFilterButtons() {
  const today = getTodayNepaliDateString();
  const isToday = state.salesDateFilter.from === today && state.salesDateFilter.to === today;
  const isAll = !state.salesDateFilter.from && !state.salesDateFilter.to;
  document.getElementById('btnSalesToday')?.classList.toggle('active', isToday);
  document.getElementById('btnSalesAllDates')?.classList.toggle('active', isAll);
}

function setSalesTodayFilter() {
  const today = getTodayNepaliDateString();
  const fromEl = document.getElementById('salesFromDate');
  const toEl = document.getElementById('salesToDate');
  if (fromEl) fromEl.value = today;
  if (toEl) toEl.value = today;
  state.salesDateFilter.from = today;
  state.salesDateFilter.to = today;
  updateSalesDateFilterButtons();
  renderDailySales();
}

function resetSalesDateFilter() {
  const fromEl = document.getElementById('salesFromDate');
  const toEl = document.getElementById('salesToDate');
  if (fromEl) fromEl.value = '';
  if (toEl) toEl.value = '';
  state.salesDateFilter.from = '';
  state.salesDateFilter.to = '';
  updateSalesDateFilterButtons();
  renderDailySales();
}

function onSalesSearchInput() {
  renderDailySales();
}

function renderDailySales() {
  let list = [...(state.dailySales || [])];

  // Apply search query filter
  const searchInput = document.getElementById('salesSearchInput');
  const q = searchInput ? searchInput.value.trim().toLowerCase() : '';
  if (q) {
    list = list.filter(s =>
      (s.itemName || '').toLowerCase().includes(q) ||
      (s.buyerName || '').toLowerCase().includes(q) ||
      (s.date || '').toLowerCase().includes(q) ||
      (s.unit || '').toLowerCase().includes(q) ||
      (s.remarks || '').toLowerCase().includes(q)
    );
  }

  // Apply Date Section filter (From Date to To Date)
  if (state.salesDateFilter.from) {
    list = list.filter(s => (s.date || '') >= state.salesDateFilter.from);
  }
  if (state.salesDateFilter.to) {
    list = list.filter(s => (s.date || '') <= state.salesDateFilter.to);
  }

  const { by, dir } = state.salesSort;
  list.sort((a, b) => {
    let comparison = 0;
    if (by === 'quantity') {
      comparison = (Number(a.quantity) || 0) - (Number(b.quantity) || 0);
    } else {
      comparison = (Date.parse(a.updatedAt || a.createdAt || '') || 0) -
        (Date.parse(b.updatedAt || b.createdAt || '') || 0);
    }
    if (comparison === 0) {
      comparison = String(a.date || '').localeCompare(String(b.date || '')) ||
        String(a.itemName || '').localeCompare(String(b.itemName || ''), undefined, { sensitivity: 'base' });
    }
    return dir === 'desc' ? -comparison : comparison;
  });
  updateSalesSortUI();

  // Update total revenue badge
  let totalRev = 0;
  list.forEach(s => totalRev += parseFloat(s.total) || 0);
  const revElem = document.getElementById('salesSummaryRevenue');
  if (revElem) {
    revElem.textContent = `Total Sales: Rs. ${totalRev.toLocaleString('en-IN')}`;
  }

  if (state.salesViewMode === 'grouped') {
    renderGroupedDailySales(list);
  } else {
    renderDailySalesTable(list);
  }
}

function toggleSalesSort(field) {
  if (state.salesSort.by === field) {
    state.salesSort.dir = state.salesSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    state.salesSort.by = field;
    state.salesSort.dir = 'desc';
  }
  renderDailySales();
}

function updateSalesSortUI() {
  const { by, dir } = state.salesSort;
  const modifiedButton = document.getElementById('btnSalesSortModified');
  const quantityButton = document.getElementById('btnSalesSortQuantity');
  if (modifiedButton) {
    modifiedButton.classList.toggle('active-sort', by === 'modifiedAt');
    modifiedButton.textContent = `🕒 Modified ${by === 'modifiedAt' ? (dir === 'desc' ? '▼' : '▲') : ''}`;
  }
  if (quantityButton) {
    quantityButton.classList.toggle('active-sort', by === 'quantity');
    quantityButton.textContent = `# Quantity ${by === 'quantity' ? (dir === 'desc' ? '▼' : '▲') : ''}`;
  }
}

function renderGroupedDailySales(list) {
  const container = document.getElementById('salesGroupedContainer');
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:36px; color:#777; font-weight:600; background:#fff; border-radius:10px;">No daily sales records found matching your date or search filter.</div>`;
    return;
  }

  // Group by date
  const groups = {};
  list.forEach(item => {
    const d = item.date || 'Unspecified Date';
    if (!groups[d]) groups[d] = [];
    groups[d].push(item);
  });

  // Sort dates descending
  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  container.innerHTML = sortedDates.map(dateKey => {
    const items = groups[dateKey];
    let dayTotal = 0;
    let dayUnits = 0;
    items.forEach(it => {
      dayTotal += parseFloat(it.total) || 0;
      dayUnits += parseFloat(it.quantity) || 0;
    });

    const rowsHtml = items.map((s, idx) => {
      const rateText = s.rate ? `Rs. ${Number(s.rate).toLocaleString('en-IN')}` : '-';
      const totalText = s.total ? `Rs. ${Number(s.total).toLocaleString('en-IN')}` : '-';
      return `
        <tr>
          <td class="col-sn" style="text-align:center;">${idx + 1}</td>
          <td><strong>${escapeHtml(s.buyerName || '-')}</strong></td>
          <td class="col-item">${escapeHtml(s.itemName)}</td>
          <td class="col-unit" style="text-align:center;">${escapeHtml(s.unit || '-')}</td>
          <td class="col-qty" style="text-align:center;">${escapeHtml(s.quantity || '-')}</td>
          <td class="col-rate" style="text-align:right;">${rateText}</td>
          <td class="col-total" style="text-align:right;">${totalText}</td>
          <td style="color:#666;">${escapeHtml(s.remarks || '-')}</td>
          <td class="col-actions">
            <button class="btn btn-secondary btn-sm" onclick='openEditSaleModal(${JSON.stringify(s).replace(/'/g, "&apos;")})'>✏️</button>
            <button class="btn btn-danger btn-sm" onclick="confirmDeleteSale('${escapeJs(s.id)}')">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="date-group-card">
        <div class="date-group-header">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="date-group-badge">📅 ${escapeHtml(dateKey)}</span>
            <span style="font-size:0.9rem; color:#64748b; font-weight:600;">(${items.length} ${items.length === 1 ? 'sale' : 'sales'} &bull; ${dayUnits.toLocaleString('en-IN')} units)</span>
          </div>
          <div style="display:flex; align-items:center; gap:12px;">
            <span class="date-group-revenue">Day Total: Rs. ${dayTotal.toLocaleString('en-IN')}</span>
            <button type="button" class="btn btn-secondary btn-sm" onclick="exportSingleDaySales('${escapeJs(dateKey)}')">📥 Export Day</button>
          </div>
        </div>
        <div class="excel-wrapper" style="border:none; border-radius:0;">
          <table class="excel-table">
            <thead>
              <tr>
                <th style="width: 40px; text-align:center;">#</th>
                <th style="width: 140px;">Buyer / Customer</th>
                <th>Product Name</th>
                <th style="width: 70px; text-align:center;">Unit</th>
                <th style="width: 70px; text-align:center;">Qty</th>
                <th style="width: 110px; text-align:right;">Rate (Rs)</th>
                <th style="width: 120px; text-align:right;">Total (Rs)</th>
                <th>Remarks</th>
                <th style="width: 80px; text-align:center;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr class="date-group-subtotal-row">
                <td colspan="4" style="text-align:right; font-weight:800; text-transform:uppercase;">Subtotal for ${escapeHtml(dateKey)}:</td>
                <td style="text-align:center; font-weight:800;">${dayUnits.toLocaleString('en-IN')}</td>
                <td></td>
                <td style="text-align:right; font-weight:800; color:var(--success-green);">Rs. ${dayTotal.toLocaleString('en-IN')}</td>
                <td colspan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
  }).join('');
}

function exportSingleDaySales(dateStr) {
  const params = new URLSearchParams({
    fromDate: dateStr,
    toDate: dateStr,
    grouped: 'true'
  });
  downloadExcel(`/api/daily-sales/excel?${params.toString()}`, `Downloading Excel for ${dateStr}...`);
}

function renderDailySalesTable(list) {
  const tbody = document.getElementById('dailySalesTbody');
  tbody.innerHTML = '';

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:32px; color:#777;">No daily sales recorded yet.</td></tr>`;
    return;
  }

  list.forEach((s, idx) => {
    const tr = document.createElement('tr');
    const rateText = s.rate ? `Rs. ${Number(s.rate).toLocaleString('en-IN')}` : '-';
    const totalText = s.total ? `Rs. ${Number(s.total).toLocaleString('en-IN')}` : '-';

    tr.innerHTML = `
      <td class="col-sn">${idx + 1}</td>
      <td class="col-date">${escapeHtml(s.date)}</td>
      <td><strong>${escapeHtml(s.buyerName || '-')}</strong></td>
      <td class="col-item">${escapeHtml(s.itemName)}</td>
      <td class="col-unit">${escapeHtml(s.unit || '-')}</td>
      <td class="col-qty">${escapeHtml(s.quantity || '-')}</td>
      <td class="col-rate">${rateText}</td>
      <td class="col-total">${totalText}</td>
      <td style="color:#666;">${escapeHtml(s.remarks || '-')}</td>
      <td class="col-actions">
        <button class="btn btn-secondary btn-sm" onclick='openEditSaleModal(${JSON.stringify(s).replace(/'/g, "&apos;")})'>✏️</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteSale('${escapeJs(s.id)}')">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openSalesInvoices() {
  const search = document.getElementById('salesInvoiceSearch');
  const fromDate = document.getElementById('salesInvoiceFromDate');
  const toDate = document.getElementById('salesInvoiceToDate');
  if (search) search.value = '';
  if (fromDate) fromDate.value = '';
  if (toDate) toDate.value = '';
  document.getElementById('modalSalesInvoices').classList.add('active');
  renderSalesInvoices();
  if (search) search.focus();
}

function closeSalesInvoices() {
  document.getElementById('modalSalesInvoices').classList.remove('active');
}

function formatSalesInvoiceNumber(sale) {
  const id = String(sale.id || '').trim();
  if (id) return id.replace(/^sale_/i, 'INV-').toUpperCase();
  const date = String(sale.date || 'UNDATED').replace(/[^a-z0-9]/gi, '');
  return `INV-${date}-${state.dailySales.indexOf(sale) + 1}`;
}

function formatSalesInvoiceAmount(value) {
  const amount = Number(value);
  return (Number.isFinite(amount) ? amount : 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function highlightSalesInvoiceSearch(value, terms) {
  const text = String(value ?? '');
  if (!terms.length) return escapeHtml(text);
  const pattern = terms
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!pattern.length) return escapeHtml(text);

  const matcher = new RegExp(`(${pattern.join('|')})`, 'gi');
  return text.split(matcher).map(part =>
    terms.some(term => part.toLocaleLowerCase() === term)
      ? `<mark class="sales-invoice-search-match">${escapeHtml(part)}</mark>`
      : escapeHtml(part)
  ).join('');
}

function renderSalesInvoices() {
  const container = document.getElementById('salesInvoicesList');
  if (!container) return;

  const search = (document.getElementById('salesInvoiceSearch')?.value || '').trim().toLocaleLowerCase();
  const fromDate = (document.getElementById('salesInvoiceFromDate')?.value || '').trim();
  const toDate = (document.getElementById('salesInvoiceToDate')?.value || '').trim();
  const terms = search.split(/\s+/).filter(Boolean);
  const invoiceMap = new Map();
  (state.dailySales || []).forEach((sale, index) => {
    const date = String(sale.date || 'Unspecified Date');
    const buyerName = String(sale.buyerName || 'Walk-in / Cash').trim();
    const createdAt = String(sale.createdAt || '');
    const transactionKey = createdAt
      ? `${date}\u0000${buyerName.toLocaleLowerCase()}\u0000${createdAt}`
      : `sale-${sale.id || index}`;
    if (!invoiceMap.has(transactionKey)) {
      invoiceMap.set(transactionKey, {
        date,
        buyerName,
        sales: [],
        createdAt,
        transactionKey
      });
    }
    invoiceMap.get(transactionKey).sales.push(sale);
  });

  const invoices = [...invoiceMap.values()].map(invoice => {
    invoice.total = invoice.sales.reduce((sum, sale) => {
      const amount = Number(sale.total);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
    invoice.invoiceNumber = formatSalesInvoiceNumber(invoice.sales[0]);
    invoice.searchable = [
      invoice.invoiceNumber, invoice.date, invoice.buyerName,
      ...invoice.sales.flatMap(sale => [
        sale.itemName, sale.unit, sale.quantity, sale.rate, sale.total,
        formatSalesInvoiceAmount(sale.rate), formatSalesInvoiceAmount(sale.total), sale.remarks
      ])
    ].join(' ').toLocaleLowerCase();
    return invoice;
  });

  const filtered = invoices.filter(invoice => {
    if (fromDate && invoice.date < fromDate) return false;
    if (toDate && invoice.date > toDate) return false;
    return terms.every(term => invoice.searchable.includes(term));
  }).sort((a, b) => b.date.localeCompare(a.date) ||
    (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));

  const resultTotal = filtered.reduce((sum, invoice) => sum + invoice.total, 0);
  document.getElementById('salesInvoiceResultCount').textContent =
    `${filtered.length} ${filtered.length === 1 ? 'invoice' : 'invoices'} · Total Rs. ${formatSalesInvoiceAmount(resultTotal)}`;

  if (filtered.length === 0) {
    container.innerHTML = '<div class="sales-invoice-empty">No sales invoices match your search or date range.</div>';
    return;
  }

  const groupedByDate = new Map();
  filtered.forEach(invoice => {
    const date = invoice.date;
    if (!groupedByDate.has(date)) groupedByDate.set(date, []);
    groupedByDate.get(date).push(invoice);
  });

  container.innerHTML = [...groupedByDate.entries()].map(([date, invoicesForDate]) => {
    const dayTotal = invoicesForDate.reduce((sum, invoice) => sum + invoice.total, 0);
    const rows = invoicesForDate.map(invoice => `
      <tr>
        <td>${highlightSalesInvoiceSearch(invoice.invoiceNumber, terms)}</td>
        <td><strong>${highlightSalesInvoiceSearch(invoice.buyerName, terms)}</strong></td>
        <td>${invoice.sales.map(sale => {
          const itemDetails = [
            sale.itemName || '-',
            `${sale.quantity ?? '-'} ${sale.unit || ''}`.trim(),
            `Rate Rs. ${formatSalesInvoiceAmount(sale.rate)}`,
            `Amount Rs. ${formatSalesInvoiceAmount(sale.total)}`,
            sale.remarks || ''
          ].filter(Boolean).join(' · ');
          return `<div class="sales-invoice-item-detail">${highlightSalesInvoiceSearch(itemDetails, terms)}</div>`;
        }).join('')}</td>
        <td class="invoice-cell-center">${invoice.sales.length}</td>
        <td class="invoice-cell-right"><strong>Rs. ${highlightSalesInvoiceSearch(`Rs. ${formatSalesInvoiceAmount(invoice.total)}`, terms)}</strong></td>
        <td class="invoice-cell-center">
          <button type="button" class="btn btn-primary btn-sm sales-invoice-print-button" data-invoice-key="${escapeHtml(encodeURIComponent(invoice.transactionKey))}">🖨️ Invoice</button>
        </td>
      </tr>
    `).join('');
    return `
      <section class="sales-invoice-date-group">
        <header><strong>📅 ${highlightSalesInvoiceSearch(date, terms)}</strong><span>${invoicesForDate.length} ${invoicesForDate.length === 1 ? 'invoice' : 'invoices'} · Day total Rs. ${highlightSalesInvoiceSearch(formatSalesInvoiceAmount(dayTotal), terms)}</span></header>
        <div class="sales-invoice-table-wrap">
          <table class="sales-invoice-table">
            <thead><tr><th>Invoice No.</th><th>Customer</th><th>Items</th><th>Lines</th><th>Total</th><th>Print</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
    `;
  }).join('');

  container.querySelectorAll('.sales-invoice-print-button').forEach(button => {
    button.addEventListener('click', () => {
      const transactionKey = decodeURIComponent(button.dataset.invoiceKey || '');
      const sales = (state.dailySales || []).filter((sale, index) => {
        const date = String(sale.date || 'Unspecified Date');
        const buyerName = String(sale.buyerName || 'Walk-in / Cash').trim();
        const createdAt = String(sale.createdAt || '');
        const saleKey = createdAt
          ? `${date}\u0000${buyerName.toLocaleLowerCase()}\u0000${createdAt}`
          : `sale-${sale.id || index}`;
        return saleKey === transactionKey;
      });
      printSalesInvoice(sales);
    });
  });
}

function printSalesInvoice(sales) {
  if (!Array.isArray(sales) || sales.length === 0 || sales.some(sale => !(state.dailySales || []).includes(sale))) {
    showToast('This sales record could not be found. Refresh the sales list and try again.', 'error');
    return;
  }

  const printArea = document.getElementById('printable-area');
  const firstSale = sales[0];
  const invoiceNumber = formatSalesInvoiceNumber(firstSale);
  const amount = sales.reduce((sum, sale) => {
    const saleTotal = Number(sale.total);
    return sum + (Number.isFinite(saleTotal) ? saleTotal : 0);
  }, 0);
  const rows = sales.map(sale => {
    const quantity = Number(sale.quantity);
    const rate = Number(sale.rate);
    return `
      <tr>
        <td>${escapeHtml(sale.itemName || '-')}</td>
        <td style="text-align:center;">${escapeHtml(sale.unit || '-')}</td>
        <td style="text-align:right;">${escapeHtml(Number.isFinite(quantity) ? quantity : '-')}</td>
        <td style="text-align:right;">${formatSalesInvoiceAmount(rate)}</td>
        <td style="text-align:right; font-weight:800;">${formatSalesInvoiceAmount(sale.total)}</td>
      </tr>
    `;
  }).join('');
  const remarks = [...new Set(sales.map(sale => String(sale.remarks || '').trim()).filter(Boolean))].join('; ');
  printArea.innerHTML = `
    <article class="print-page sales-invoice-print">
      <header class="sales-invoice-print-header">
        <div class="print-shop-name">HARDWARE PASAL</div>
        <div class="print-title">SALES INVOICE</div>
      </header>
      <div class="sales-invoice-print-meta">
        <div><strong>Invoice No:</strong> ${escapeHtml(invoiceNumber)}</div>
        <div><strong>Date (BS):</strong> ${escapeHtml(firstSale.date || '-')}</div>
        <div><strong>Customer:</strong> ${escapeHtml(firstSale.buyerName || '-')}</div>
      </div>
      <table class="print-table sales-invoice-print-table">
        <thead><tr><th>Item / Particulars</th><th>Unit</th><th>Quantity</th><th>Rate (Rs.)</th><th>Amount (Rs.)</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><th colspan="4" style="text-align:right;">TOTAL</th><th style="text-align:right;">Rs. ${formatSalesInvoiceAmount(amount)}</th></tr></tfoot>
      </table>
      <div class="sales-invoice-print-remarks"><strong>Remarks:</strong> ${escapeHtml(remarks || '-')}</div>
      <p class="sales-invoice-thank-you">Thank you for your business.</p>
    </article>
  `;
  window.print();
}

function openEditSaleModal(sale) {
  document.getElementById('editSaleId').value = sale.id;
  document.getElementById('editSaleDate').value = sale.date || '';
  document.getElementById('editSaleBuyer').value = sale.buyerName || '';
  document.getElementById('editSaleItemName').value = sale.itemName || '';
  document.getElementById('editSaleUnit').value = sale.unit || '';
  document.getElementById('editSaleQty').value = sale.quantity || '';
  document.getElementById('editSaleRate').value = sale.rate || '';
  document.getElementById('editSaleTotal').value = (sale.total || 0).toLocaleString('en-IN');
  document.getElementById('editSaleRemarks').value = sale.remarks || '';

  document.getElementById('modalEditSaleEntry').classList.add('active');
}

function closeEditSaleModal() {
  document.getElementById('modalEditSaleEntry').classList.remove('active');
}

function calculateModalSaleTotal() {
  const q = parseFloat(document.getElementById('editSaleQty').value) || 0;
  const r = parseFloat(document.getElementById('editSaleRate').value) || 0;
  document.getElementById('editSaleTotal').value = (q * r).toLocaleString('en-IN');
}

async function submitEditSaleEntry() {
  const saleId = document.getElementById('editSaleId').value;
  const date = document.getElementById('editSaleDate').value.trim();
  const buyerName = document.getElementById('editSaleBuyer').value.trim();
  const itemName = document.getElementById('editSaleItemName').value.trim().toUpperCase();
  const unit = document.getElementById('editSaleUnit').value.trim();
  const quantity = document.getElementById('editSaleQty').value.trim();
  const rate = document.getElementById('editSaleRate').value.trim();
  const remarks = document.getElementById('editSaleRemarks').value.trim();

  if (!itemName) {
    showToast('Product name cannot be empty', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/daily-sales/${saleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, buyerName, itemName, unit, quantity, rate, remarks })
    });

    if (res.ok) {
      closeEditSaleModal();
      showToast('Sale record updated', 'success');
      await loadDailySalesAndAnalytics();
      await loadItemSuggestions();
    } else {
      showToast('Failed to update sale', 'error');
    }
  } catch (e) {
    showToast('Error saving changes', 'error');
  }
}

async function confirmDeleteSale(saleId) {
  if (!confirm('Are you sure you want to delete this sale record?')) return;

  try {
    const res = await fetch(`/api/daily-sales/${saleId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Sale record deleted', 'success');
      await loadDailySalesAndAnalytics();
    } else {
      showToast('Failed to delete sale', 'error');
    }
  } catch (e) {
    showToast('Error deleting sale', 'error');
  }
}

function exportDailySalesPdf() {
  const params = new URLSearchParams();
  if (state.salesDateFilter.from) params.append('fromDate', state.salesDateFilter.from);
  if (state.salesDateFilter.to) params.append('toDate', state.salesDateFilter.to);
  if (state.salesViewMode === 'grouped') params.append('grouped', 'true');

  const a = document.createElement('a');
  a.href = `/api/daily-sales/pdf?${params.toString()}`;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Downloading Daily Sales PDF report...', 'success');
}

function exportDailySalesExcel() {
  const params = new URLSearchParams();
  if (state.salesDateFilter.from) params.append('fromDate', state.salesDateFilter.from);
  if (state.salesDateFilter.to) params.append('toDate', state.salesDateFilter.to);
  if (state.salesViewMode === 'grouped') params.append('grouped', 'true');

  downloadExcel(`/api/daily-sales/excel?${params.toString()}`, 'Downloading Daily Sales Excel workbook (.xlsx)...');
}

// ---------------- FULL-PAGE SALES & CREDIT INSIGHTS ----------------
async function openBusinessInsights(context) {
  switchInsightsTab('sales');
  const activeSection = document.querySelector('.view-section.active');
  state.insightsReturnView = activeSection && activeSection.id === 'view-ledger' ? 'ledger' :
    activeSection && activeSection.id === 'view-daily-sales' ? 'daily-sales' : 'customers';
  document.getElementById('insightsContext').textContent =
    `${context} REPORT • SEPARATE SALES AND CREDIT ACTIVITY`;
  document.getElementById('insightsStatus').textContent = 'Loading complete business report...';
  navigateTo('business-insights');

  try {
    const res = await fetch('/api/business-insights');
    if (!res.ok) throw new Error('Unable to load business insights');
    state.businessInsights = await res.json();
    renderBusinessInsights(state.businessInsights);
  } catch (err) {
    document.getElementById('insightsStatus').textContent = 'Unable to load the report. Please try again.';
  }
}

function closeBusinessInsights() {
  navigateTo(state.insightsReturnView);
}

function switchInsightsTab(tab) {
  state.insightsActiveTab = tab;
  document.getElementById('insightTabSales').classList.toggle('active', tab === 'sales');
  document.getElementById('insightTabCredit').classList.toggle('active', tab === 'credit');
  document.getElementById('insightPanelSales').classList.toggle('active', tab === 'sales');
  document.getElementById('insightPanelCredit').classList.toggle('active', tab === 'credit');

  requestAnimationFrame(() => {
    if (!state.businessInsights) return;
    if (tab === 'sales') {
      renderInsightTrend(state.businessInsights);
      renderInsightHorizontalChart('insightRevenueCanvas', state.businessInsights.sales.byRevenue.slice(0, 8), 'revenue');
    } else {
      renderInsightHorizontalChart('insightCreditCanvas', state.businessInsights.credit.byQuantity.slice(0, 8), 'credit');
    }
  });
}

function switchInsightTrend(mode) {
  state.insightsTrendMode = mode;
  document.getElementById('insightTrendRevenue').classList.toggle('active', mode === 'revenue');
  document.getElementById('insightTrendUnits').classList.toggle('active', mode === 'units');
  if (state.businessInsights) renderInsightTrend(state.businessInsights);
}

function renderBusinessInsights(data) {
  const sales = data.sales.summary;
  const credit = data.credit.summary;
  document.getElementById('insightsStatus').textContent =
    `Complete report • Sales through ${sales.todayDate || 'today'} • Updated live from records`;
  document.getElementById('insightTodaySales').textContent = formatInsightMoney(sales.todayRevenue);
  document.getElementById('insightTodayOrders').textContent =
    `${sales.todayOrders} ${sales.todayOrders === 1 ? 'order' : 'orders'} today • ${sales.todayUnits.toLocaleString('en-IN')} units`;
  document.getElementById('insightTotalSales').textContent = formatInsightMoney(sales.revenue);
  document.getElementById('insightTotalUnits').textContent = `${sales.units.toLocaleString('en-IN')} units sold`;
  document.getElementById('insightCreditItems').textContent = credit.items.toLocaleString('en-IN');
  document.getElementById('insightCreditCustomers').textContent = `${credit.customers} credit customers`;
  document.getElementById('insightCreditProducts').textContent = credit.uniqueProducts.toLocaleString('en-IN');
  document.getElementById('insightCreditQuantity').textContent = credit.quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 });
  document.getElementById('insightSalesProducts').textContent = sales.uniqueProducts.toLocaleString('en-IN');
  document.getElementById('insightSalesOrders').textContent = `${sales.orders} recorded orders`;

  if (state.insightsActiveTab === 'sales') {
    renderInsightTrend(data);
    renderInsightHorizontalChart('insightRevenueCanvas', data.sales.byRevenue.slice(0, 8), 'revenue');
  } else {
    renderInsightHorizontalChart('insightCreditCanvas', data.credit.byQuantity.slice(0, 8), 'credit');
  }
  renderInsightSalesRanking(data.sales.byQuantity);
  renderInsightSalesRecords(data.sales.records);
  renderInsightCreditRanking(data.credit.byQuantity);
  renderInsightTable(
    'insightCreditCustomersTable',
    data.credit.topCustomers,
    customer => customer.name,
    customer => `${customer.items.toLocaleString('en-IN')}`
  );
  renderInsightTable(
    'insightTopBuyers',
    data.sales.topBuyers,
    buyer => buyer.name,
    buyer => formatInsightMoney(buyer.revenue)
  );
}

function renderInsightCreditRanking(items) {
  const tbody = document.getElementById('insightCreditRanking');
  tbody.innerHTML = items.length ? items.map((item, index) => `
    <tr><td><strong>#${index + 1}</strong></td><td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.unit || '-')}</td>
      <td>${item.quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })}</td>
      <td>${item.entries.toLocaleString('en-IN')}</td></tr>`).join('') :
    '<tr><td colspan="5">No credit products recorded yet.</td></tr>';
}

function renderInsightSalesRecords(records) {
  const tbody = document.getElementById('insightSalesRecords');
  tbody.innerHTML = records.length ? records.map(sale => `
    <tr><td>${escapeHtml(sale.date || '-')}</td><td>${escapeHtml(sale.buyerName || '-')}</td>
      <td>${escapeHtml(sale.itemName || '-')}</td>
      <td>${sale.quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${escapeHtml(sale.unit || '')}</td>
      <td><strong>${formatInsightMoney(sale.rate)}</strong></td>
      <td><strong>${formatInsightMoney(sale.total)}</strong></td></tr>`).join('') :
    '<tr><td colspan="6">No sales recorded yet.</td></tr>';
}

function formatInsightMoney(value) {
  return `Rs. ${Math.round((Number(value) || 0) * 100) / 100}`.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
}

function prepareInsightCanvas(canvasId) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  return { ctx, w: rect.width, h: rect.height };
}

function renderInsightTrend(data) {
  const canvas = prepareInsightCanvas('insightTrendCanvas');
  const ctx = canvas.ctx;
  const values = data.sales.trend;
  if (!values.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.font = '700 16px sans-serif';
    ctx.fillText('No sales dates recorded yet.', canvas.w / 2, canvas.h / 2);
    return;
  }
  const key = state.insightsTrendMode;
  const max = Math.max(...values.map(item => item[key] || 0), 1);
  const left = 70;
  const right = 24;
  const top = 24;
  const bottom = 42;
  const chartW = canvas.w - left - right;
  const chartH = canvas.h - top - bottom;
  const slot = chartW / values.length;
  const barW = Math.max(12, Math.min(46, slot * 0.58));

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#64748b';
  ctx.font = '600 11px sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = top + chartH - (i / 4) * chartH;
    ctx.beginPath();
    ctx.moveTo(left, y); ctx.lineTo(canvas.w - right, y); ctx.stroke();
    const value = (max * i / 4);
    ctx.fillText(key === 'revenue' ? `Rs.${Math.round(value / 1000)}k` : Math.round(value), left - 8, y + 4);
  }

  values.forEach((item, index) => {
    const value = item[key] || 0;
    const barH = (value / max) * chartH;
    const x = left + index * slot + (slot - barW) / 2;
    const y = top + chartH - barH;
    const gradient = ctx.createLinearGradient(0, y, 0, top + chartH);
    gradient.addColorStop(0, key === 'revenue' ? '#c62828' : '#0284c7');
    gradient.addColorStop(1, key === 'revenue' ? '#ef6b6b' : '#38bdf8');
    ctx.fillStyle = gradient;
    ctx.beginPath(); ctx.roundRect(x, y, barW, barH, 6); ctx.fill();
    ctx.fillStyle = '#334155'; ctx.textAlign = 'center'; ctx.font = '700 10px sans-serif';
    ctx.fillText(item.date.slice(5), x + barW / 2, canvas.h - 22);
    ctx.fillStyle = '#0f172a'; ctx.font = '700 10px sans-serif';
    const label = key === 'revenue' ? `${Math.round(value / 1000)}k` : String(value);
    ctx.fillText(label, x + barW / 2, Math.max(14, y - 7));
  });
}

function renderInsightHorizontalChart(canvasId, items, mode) {
  const canvas = prepareInsightCanvas(canvasId);
  const ctx = canvas.ctx;
  if (!items.length) {
    ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'center'; ctx.font = '700 14px sans-serif';
    ctx.fillText('No activity recorded yet.', canvas.w / 2, canvas.h / 2); return;
  }
  const left = Math.min(150, canvas.w * 0.38);
  const right = mode === 'credit' ? 72 : 92;
  const top = 10;
  const gap = 8;
  const rowHeight = Math.min(34, (canvas.h - top - 8 - gap * (items.length - 1)) / items.length);
  const max = Math.max(...items.map(item => mode === 'credit' ? item.quantity : item.revenue), 1);

  items.forEach((item, index) => {
    const value = mode === 'credit' ? item.quantity : item.revenue;
    const y = top + index * (rowHeight + gap);
    ctx.fillStyle = '#1e293b'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.font = '700 11px sans-serif';
    let label = item.unit ? `${item.name} (${item.unit})` : item.name;
    if (label.length > 18) label = `${label.slice(0, 17)}…`;
    ctx.fillText(label, left - 8, y + rowHeight / 2);
    ctx.fillStyle = '#f1f5f9'; ctx.beginPath(); ctx.roundRect(left, y, canvas.w - left - right, rowHeight, 5); ctx.fill();
    const width = Math.max(4, (value / max) * (canvas.w - left - right));
    ctx.fillStyle = mode === 'credit' ? '#0284c7' : '#c62828';
    ctx.beginPath(); ctx.roundRect(left, y, width, rowHeight, 5); ctx.fill();
    ctx.fillStyle = '#334155'; ctx.textAlign = 'left'; ctx.font = '700 11px sans-serif';
    const text = mode === 'credit' ? `${value.toLocaleString('en-IN')} ${item.unit || ''}` : formatInsightMoney(value);
    ctx.fillText(text, left + width + 6, y + rowHeight / 2);
  });
}

function renderInsightSalesRanking(items) {
  const tbody = document.getElementById('insightSalesRanking');
  tbody.innerHTML = items.length ? items.map((item, index) => `
    <tr><td><strong>#${index + 1}</strong></td><td>${escapeHtml(item.name)}</td>
      <td>${item.quantity.toLocaleString('en-IN')} ${escapeHtml(item.unit || '')}</td>
      <td>${item.orders}</td><td><strong>${formatInsightMoney(item.revenue)}</strong></td></tr>`).join('') :
    '<tr><td colspan="5">No sales products recorded yet.</td></tr>';
}

function renderInsightTable(id, items, labelFn, valueFn) {
  const tbody = document.getElementById(id);
  tbody.innerHTML = items.length ? items.map((item, index) => `
    <tr><td><strong>#${index + 1}</strong></td><td>${escapeHtml(labelFn(item))}</td><td>${escapeHtml(valueFn(item))}</td></tr>`).join('') :
    '<tr><td colspan="3">No activity recorded yet.</td></tr>';
}

// ---------------- PRODUCT SALES CHART DASHBOARD ----------------
function switchChartMode(mode) {
  state.chartMode = mode;
  document.getElementById('btnChartModeQty').classList.toggle('active', mode === 'qty');
  document.getElementById('btnChartModeSales').classList.toggle('active', mode === 'sales');
  if (state.salesAnalytics) {
    renderBarChart(state.salesAnalytics);
  }
}

function renderAnalyticsDashboard(data) {
  const summary = data.summary;
  const todayRevenue = Math.round(summary.todayRevenue * 100) / 100;
  document.getElementById('metricTotalRevenue').textContent =
    `Rs. ${todayRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  document.getElementById('metricTodaySalesSub').textContent =
    `BS ${summary.todayDate} • ${summary.todayOrders} ${summary.todayOrders === 1 ? 'item' : 'items'}`;
  document.getElementById('metricTotalUnits').textContent = summary.totalUnits.toLocaleString('en-IN');
  document.getElementById('metricUniqueCount').textContent = summary.uniqueProductsCount;

  const topProduct = data.byQuantity[0];
  if (topProduct) {
    document.getElementById('metricTopProduct').textContent = topProduct.name;
    document.getElementById('metricTopProductSub').textContent =
      `${topProduct.totalQty.toLocaleString('en-IN')} ${topProduct.unit || 'units'} sold (all-time)`;
  } else {
    document.getElementById('metricTopProduct').textContent = 'None yet';
  }

  renderBarChart(data);
  renderPieChart(data);
  renderRankingTable(data);
}

function renderBarChart(data) {
  const canvas = document.getElementById('productBarCanvas');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);

  const items = (state.chartMode === 'qty' ? data.byQuantity : data.bySales).slice(0, 7);
  if (items.length === 0) {
    ctx.font = 'bold 16px "Noto Sans Devanagari", sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText('No daily sales recorded yet.', w / 2, h / 2);
    return;
  }

  const paddingLeft = 140;
  const paddingRight = 85;
  const paddingTop = 20;
  const paddingBottom = 20;

  const chartW = w - paddingLeft - paddingRight;
  const chartH = h - paddingTop - paddingBottom;

  const maxValue = state.chartMode === 'qty'
    ? Math.max(...items.map(i => i.totalQty), 1)
    : Math.max(...items.map(i => i.totalSales), 1);

  const barCount = items.length;
  const barGap = 10;
  const barHeight = Math.min(36, (chartH - (barCount - 1) * barGap) / barCount);

  items.forEach((item, idx) => {
    const val = state.chartMode === 'qty' ? item.totalQty : item.totalSales;
    const barWidth = Math.max(8, (val / maxValue) * chartW);
    const y = paddingTop + idx * (barHeight + barGap);

    ctx.font = 'bold 13px "Noto Sans Devanagari", sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    let label = item.unit ? `${item.name} (${item.unit})` : item.name;
    if (label.length > 16) label = label.slice(0, 15) + '…';
    ctx.fillText(label, paddingLeft - 10, y + barHeight / 2);

    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.roundRect(paddingLeft, y, chartW, barHeight, 6);
    ctx.fill();

    const grad = ctx.createLinearGradient(paddingLeft, y, paddingLeft + barWidth, y);
    grad.addColorStop(0, '#ef4444');
    grad.addColorStop(1, '#b71c1c');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(paddingLeft, y, barWidth, barHeight, 6);
    ctx.fill();

    ctx.font = 'bold 12px "Noto Sans Devanagari", sans-serif';
    ctx.fillStyle = '#7f1d1d';
    ctx.textAlign = 'left';
    const valText = state.chartMode === 'qty'
      ? `${val} ${item.unit || ''}`
      : `Rs. ${val.toLocaleString('en-IN')}`;
    ctx.fillText(valText, paddingLeft + barWidth + 8, y + barHeight / 2);
  });
}

function renderPieChart(data) {
  const canvas = document.getElementById('productPieCanvas');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);

  const items = data.byQuantity.slice(0, 5);
  if (items.length === 0) {
    ctx.font = 'bold 14px "Noto Sans Devanagari", sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText('No sales yet.', w / 2, h / 2);
    return;
  }

  const totalQty = items.reduce((sum, i) => sum + i.totalQty, 0) || 1;
  const colors = ['#c62828', '#e65100', '#2e7d32', '#0284c7', '#7c3aed'];

  const centerX = w / 2;
  const centerY = h / 2 - 25;
  const radius = Math.min(centerX, centerY) - 15;
  const innerRadius = radius * 0.55;

  let currentAngle = -Math.PI / 2;

  items.forEach((item, idx) => {
    const sliceAngle = (item.totalQty / totalQty) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
    ctx.arc(centerX, centerY, innerRadius, currentAngle + sliceAngle, currentAngle, true);
    ctx.closePath();
    ctx.fillStyle = colors[idx % colors.length];
    ctx.fill();

    currentAngle += sliceAngle;
  });

  const legendY = h - 60;
  ctx.font = '600 11px "Noto Sans Devanagari", sans-serif';
  items.slice(0, 4).forEach((item, idx) => {
    const row = Math.floor(idx / 2);
    const col = idx % 2;
    const lx = col === 0 ? 15 : w / 2 + 10;
    const ly = legendY + row * 22;

    ctx.fillStyle = colors[idx % colors.length];
    ctx.fillRect(lx, ly - 8, 10, 10);

    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'left';
    const pieLabel = item.unit ? `${item.name} ${item.unit}` : item.name;
    let txt = `${pieLabel.slice(0, 10)} (${Math.round((item.totalQty / totalQty) * 100)}%)`;
    ctx.fillText(txt, lx + 16, ly);
  });
}

function renderRankingTable(data) {
  const tbody = document.getElementById('productRankingTbody');
  tbody.innerHTML = '';

  const items = data.byQuantity;
  document.getElementById('rankingCounter').textContent = `${items.length} product/unit groups`;

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:#777;">No products sold yet.</td></tr>`;
    return;
  }

  const maxQty = items[0] ? items[0].totalQty : 1;
  const totalRev = data.summary.totalRevenue || 1;

  items.forEach((item, idx) => {
    const tr = document.createElement('tr');
    const pct = Math.round((item.totalQty / maxQty) * 100);
    const revShare = Math.round((item.totalSales / totalRev) * 100);

    tr.innerHTML = `
      <td style="text-align: center; font-weight: 800; font-size:1.1rem; color:${idx < 3 ? 'var(--primary-red)' : '#555'};">
        #${idx + 1}
      </td>
      <td style="font-weight: 800; text-transform: uppercase;">${escapeHtml(item.name)}</td>
      <td style="text-align: center; font-weight:700; color:#555;">${escapeHtml(item.unit || '-')}</td>
      <td style="text-align: center; font-weight: 800; font-size:1.05rem; color:var(--dark-red);">
        ${item.totalQty.toLocaleString('en-IN')}
      </td>
      <td>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${pct}%;"></div>
        </div>
      </td>
      <td style="text-align: right; font-weight: 800; color:var(--success-green);">
        Rs. ${item.totalSales.toLocaleString('en-IN')}
      </td>
      <td style="text-align: center; font-weight: 700;">${item.orderCount}</td>
      <td style="text-align: right; font-weight: 700;">${revShare}%</td>
    `;
    tbody.appendChild(tr);
  });
}

// ---------------- NEPALI DATE LOGIC ----------------
function initNepaliDateSelectors() {
  const yearSel = document.getElementById('entryYear');
  const monthSel = document.getElementById('entryMonth');
  const saleYear = document.getElementById('saleYear');
  const saleMonth = document.getElementById('saleMonth');

  [yearSel, saleYear].forEach(sel => {
    if (!sel) return;
    sel.innerHTML = '';
    for (let y = 2075; y <= 2095; y++) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      sel.appendChild(opt);
    }
  });

  [monthSel, saleMonth].forEach(sel => {
    if (!sel) return;
    sel.innerHTML = '';
    NEPALI_MONTHS.forEach((mName, idx) => {
      const opt = document.createElement('option');
      opt.value = idx + 1;
      opt.textContent = `${idx + 1} - ${mName}`;
      sel.appendChild(opt);
    });
  });

  resetDateToToday();
  resetSaleDateToToday();
}

function getTodayNepaliDateObject() {
  try {
    const ND = (window.NepaliDate && window.NepaliDate.default) ? window.NepaliDate.default : window.NepaliDate;
    if (ND) {
      const d = new ND();
      return { year: d.getYear(), month: d.getMonth() + 1, day: d.getDate() };
    }
  } catch (e) {}
  return { year: 2083, month: 7, day: 7 };
}

function updateDaysDropdown(dayElementId, selectedYear, selectedMonth, currentSelectedDay) {
  const daySel = document.getElementById(dayElementId);
  if (!daySel) return;
  let maxDays = 32;

  try {
    const ND = (window.NepaliDate && window.NepaliDate.default) ? window.NepaliDate.default : window.NepaliDate;
    const configMap = (window.NepaliDate && window.NepaliDate.dateConfigMap) || (ND && ND.dateConfigMap);
    if (configMap && configMap[String(selectedYear)]) {
      const mKey = Object.keys(configMap[String(selectedYear)])[selectedMonth - 1];
      if (mKey && configMap[String(selectedYear)][mKey]) {
        maxDays = configMap[String(selectedYear)][mKey];
      }
    }
  } catch (e) {}

  daySel.innerHTML = '';
  for (let d = 1; d <= maxDays; d++) {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    daySel.appendChild(opt);
  }

  daySel.value = Math.min(currentSelectedDay || 1, maxDays);
}

function onDateDropdownChanged() {
  const y = parseInt(document.getElementById('entryYear').value, 10);
  const m = parseInt(document.getElementById('entryMonth').value, 10);
  const d = parseInt(document.getElementById('entryDay').value, 10);
  updateDaysDropdown('entryDay', y, m, d);
}

function resetDateToToday() {
  const today = getTodayNepaliDateObject();
  const yEl = document.getElementById('entryYear');
  const mEl = document.getElementById('entryMonth');
  if (yEl && mEl) {
    yEl.value = today.year;
    mEl.value = today.month;
    updateDaysDropdown('entryDay', today.year, today.month, today.day);
  }
}

function getSelectedNepaliDateString() {
  const year = document.getElementById('entryYear').value;
  const month = String(document.getElementById('entryMonth').value).padStart(2, '0');
  const day = String(document.getElementById('entryDay').value).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function onSaleDateChanged() {
  const y = parseInt(document.getElementById('saleYear').value, 10);
  const m = parseInt(document.getElementById('saleMonth').value, 10);
  const d = parseInt(document.getElementById('saleDay').value, 10);
  updateDaysDropdown('saleDay', y, m, d);
}

function resetSaleDateToToday() {
  const today = getTodayNepaliDateObject();
  const yEl = document.getElementById('saleYear');
  const mEl = document.getElementById('saleMonth');
  if (yEl && mEl) {
    yEl.value = today.year;
    mEl.value = today.month;
    updateDaysDropdown('saleDay', today.year, today.month, today.day);
  }
}

function getSelectedSaleNepaliDateString() {
  const year = document.getElementById('saleYear').value;
  const month = String(document.getElementById('saleMonth').value).padStart(2, '0');
  const day = String(document.getElementById('saleDay').value).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ---------------- AUTOCOMPLETE SUGGESTIONS ----------------
function setupAutocompleteHandlers() {
  document.addEventListener('click', (e) => {
    const popup = document.getElementById('suggestionsPopup');
    if (!popup.contains(e.target) && e.target !== state.activeSuggestionInput) {
      hideSuggestions();
    }
  });

  const saleItemInput = document.getElementById('saleItemName');
  if (saleItemInput) {
    saleItemInput.addEventListener('input', () => {
      saleItemInput.value = saleItemInput.value.toUpperCase();
      const unitInput = document.getElementById('saleUnit');
      if (unitInput && unitInput.dataset.manuallyEdited !== 'true') {
        const detectedUnit = detectUnitFromItemName(saleItemInput.value);
        const previousAutoUnit = normalizeUnit(unitInput.dataset.autoDetectedUnit);
        if (detectedUnit || unitInput.value === previousAutoUnit) {
          setSaleEntryUnit(unitInput, detectedUnit);
        }
      }
      showSuggestionsFor(saleItemInput);
    });
    saleItemInput.addEventListener('focus', () => showSuggestionsFor(saleItemInput));
  }
}

function showSuggestionsFor(inputElement) {
  state.activeSuggestionInput = inputElement;
  const query = inputElement.value.trim().toUpperCase();
  const popup = document.getElementById('suggestionsPopup');

  if (!state.itemSuggestions || state.itemSuggestions.length === 0) {
    hideSuggestions();
    return;
  }

  let matches = [];
  if (!query) {
    matches = state.itemSuggestions.slice(0, 12);
  } else {
    matches = state.itemSuggestions.filter(item => {
      const name = typeof item === 'object' ? item.name : item;
      return String(name).toUpperCase().includes(query);
    }).slice(0, 18);
  }

  if (matches.length === 0) {
    hideSuggestions();
    return;
  }

  popup.innerHTML = '';
  state.highlightedSuggestionIndex = -1;

  matches.forEach((itemObj, idx) => {
    const itemName = typeof itemObj === 'object' ? itemObj.name : itemObj;
    const itemPrice = typeof itemObj === 'object' && itemObj.price ? itemObj.price : '';

    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.dataset.index = idx;
    div.style.display = 'flex';
    div.style.justifyContent = 'space-between';
    div.style.alignItems = 'center';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = itemName;
    div.appendChild(nameSpan);

    if (itemPrice) {
      const priceSpan = document.createElement('span');
      priceSpan.style.fontSize = '0.82rem';
      priceSpan.style.color = '#10b981';
      priceSpan.style.fontWeight = '700';
      priceSpan.style.marginLeft = '8px';
      priceSpan.textContent = itemPrice === 'FREE' ? 'FREE' : `Rs. ${itemPrice}`;
      div.appendChild(priceSpan);
    }

    div.onmousedown = (e) => {
      e.preventDefault();
      selectSuggestion(itemObj);
    };
    popup.appendChild(div);
  });

  const rect = inputElement.getBoundingClientRect();
  popup.style.top = `${rect.bottom + window.scrollY + 2}px`;
  popup.style.left = `${rect.left + window.scrollX}px`;
  popup.style.width = `${Math.max(rect.width, 320)}px`;
  popup.style.display = 'block';
}

function hideSuggestions() {
  const popup = document.getElementById('suggestionsPopup');
  if (popup) popup.style.display = 'none';
  state.activeSuggestionInput = null;
  state.highlightedSuggestionIndex = -1;
}

function selectSuggestion(itemObj) {
  const itemName = typeof itemObj === 'object' ? itemObj.name : itemObj;
  const itemPrice = typeof itemObj === 'object' && itemObj.price ? itemObj.price : '';

  if (state.activeSuggestionInput) {
    state.activeSuggestionInput.value = String(itemName).toUpperCase();

    const row = state.activeSuggestionInput.closest('tr');
    if (row) {
      // In Credit Khata table
      const unitInput = row.querySelector('.unit-input');
      const detectedUnit = detectUnitFromItemName(itemName);
      if (unitInput) {
        delete unitInput.dataset.manuallyEdited;
        setCreditEntryUnit(unitInput, detectedUnit);
      }
      const qtyInput = row.querySelector('.qty-input');
      if (qtyInput) qtyInput.focus();
    } else if (state.activeSuggestionInput.id === 'saleItemName') {
      // In Daily Sales form
      if (itemPrice && itemPrice !== 'FREE') {
        const rateInput = document.getElementById('saleRate');
        if (rateInput) rateInput.value = itemPrice;
      }
      const unitSelect = document.getElementById('saleUnit');
      if (unitSelect) {
        delete unitSelect.dataset.manuallyEdited;
        setSaleEntryUnit(unitSelect, detectUnitFromItemName(itemName));
      }

      calculateSaleTotal();
      const qtyInput = document.getElementById('saleQty');
      if (qtyInput) qtyInput.focus();
    }
  }
  hideSuggestions();
}

function handleNameInputKeydown(e, nameInput, qtyInput) {
  const popup = document.getElementById('suggestionsPopup');
  const isOpen = popup && popup.style.display === 'block';

  if (!isOpen) {
    if (e.key === 'ArrowDown') showSuggestionsFor(nameInput);
    return;
  }

  const items = popup.querySelectorAll('.suggestion-item');
  if (items.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    state.highlightedSuggestionIndex = (state.highlightedSuggestionIndex + 1) % items.length;
    updateHighlightedSuggestion(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    state.highlightedSuggestionIndex = (state.highlightedSuggestionIndex - 1 + items.length) % items.length;
    updateHighlightedSuggestion(items);
  } else if (e.key === 'Enter') {
    if (state.highlightedSuggestionIndex >= 0 && items[state.highlightedSuggestionIndex]) {
      e.preventDefault();
      const chosenItem = state.itemSuggestions.find(it => {
        const name = typeof it === 'object' ? it.name : it;
        return name === items[state.highlightedSuggestionIndex].firstChild.textContent;
      }) || items[state.highlightedSuggestionIndex].firstChild.textContent;

      selectSuggestion(chosenItem);
    } else {
      hideSuggestions();
      if (qtyInput) qtyInput.focus();
    }
  } else if (e.key === 'Escape') {
    hideSuggestions();
  }
}

function updateHighlightedSuggestion(items) {
  items.forEach((it, idx) => {
    if (idx === state.highlightedSuggestionIndex) {
      it.classList.add('highlighted');
      it.scrollIntoView({ block: 'nearest' });
    } else {
      it.classList.remove('highlighted');
    }
  });
}

// ---------------- UTILITIES ----------------
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : ''}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJs(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
}
