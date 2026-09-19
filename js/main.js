/**
 * Punto de entrada: carga los datos, arma el modelo y conecta la UI.
 */
import { CONFIG } from './config.js';
import { loadCatalog } from './sheets.js';
import { buildCatalog } from './store.js';
import { isPlaceholderNumber } from './whatsapp.js';
import * as ui from './ui.js';
import { startHeroSlides, photoCredits } from './hero.js';

const el = {
  hero:        document.querySelector('[data-hero]'),
  headerStatus:document.querySelector('[data-header-status]'),
  catalog:     document.querySelector('[data-catalog]'),
  filters:     document.querySelector('[data-filters]'),
  grid:        document.querySelector('[data-grid]'),
  gridEmpty:   document.querySelector('[data-grid-empty]'),
  archive:     document.querySelector('[data-archive]'),
  archiveList: document.querySelector('[data-archive-list]'),
  loading:     document.querySelector('[data-loading]'),
  error:       document.querySelector('[data-error]'),
  errorDetail: document.querySelector('[data-error-detail]'),
  retry:       document.querySelector('[data-retry]'),
  modal:       document.querySelector('[data-modal]'),
  modalBody:   document.querySelector('[data-modal-body]'),
  modalClose:  document.querySelector('[data-modal-close]'),
};

const state = {
  catalog: null,
  category: 'all',
  timer: null,          // intervalo de los countdowns
  refreshTimer: null,   // intervalo de relectura de la planilla
  signature: null,      // huella de los ultimos datos leidos
  pendingRender: false, // hay datos nuevos, pero el modal esta abierto
  modalGroup: null,     // grupo abierto en la ficha
  variante: 0,          // estilo elegido dentro de ese grupo
};

/* ------------------------------ marca ------------------------------ */

function applyBrand() {
  document.querySelectorAll('[data-brand-name]').forEach((n) => (n.textContent = CONFIG.brand.name));
  // El descriptor no se pinta en ningun lado del sitio: la marca va sin bajada.
  // Solo alimenta el titulo de la pestana y el resultado en buscadores.
  document.title = `${CONFIG.brand.name} — ${CONFIG.brand.descriptor}`;

  const wa = document.querySelector('[data-wa-footer]');
  if (wa) wa.href = `https://wa.me/${String(CONFIG.whatsapp.number).replace(/\D/g, '')}`;

  const ig = document.querySelector('[data-ig-link]');
  if (ig && CONFIG.brand.instagram) {
    ig.href = `https://instagram.com/${CONFIG.brand.instagram}`;
    ig.hidden = false;
  }
}

/** Banner visible solo mientras falte configurar algo (numero o Sheet). */
function setupWarning() {
  const faltantes = [];
  if (isPlaceholderNumber()) faltantes.push('el numero de WhatsApp');
  if (!CONFIG.sheet.id) faltantes.push('el ID de la planilla');
  if (!faltantes.length) return;

  const bar = document.createElement('div');
  bar.className = 'setup-warning';
  bar.textContent = `Falta configurar ${faltantes.join(' y ')} en js/config.js.`;
  document.body.prepend(bar);
}

/* ----------------------------- ambiente ----------------------------- */

const RING = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M47 15.5 A24 24 0 1 1 19.5 50.5" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round"/><circle cx="32" cy="32" r="8" fill="currentColor"/></svg>';

/** Cinta de frases bajo el hero. Va duplicada para que el bucle no tenga corte. */
function renderTicker() {
  const el = document.querySelector('[data-ticker]');
  const frases = CONFIG.ticker || [];
  if (!el || !frases.length) { if (el) el.hidden = true; return; }
  const tanda = frases.map((f) => `<span>${ui.esc(f)}</span>${RING}`).join('');
  el.innerHTML = `<div class="ticker-track">${tanda}${tanda}</div>`;
}

/**
 * El hero se mete por debajo del header para que la foto llegue hasta arriba.
 * Mientras se ve la foto, el header va transparente; al bajar, recupera fondo.
 */
function setupHeader() {
  const header = document.querySelector('.site-header');
  const wrap = document.querySelector('[data-hero-wrap]');
  if (!header || !wrap) return;

  const medir = () =>
    document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
  medir();
  window.addEventListener('resize', medir, { passive: true });

  let pendiente = false;
  const actualizar = () => {
    pendiente = false;
    const sobreFoto = wrap.getBoundingClientRect().bottom > header.offsetHeight * 2;
    header.classList.toggle('is-over-hero', sobreFoto);
  };
  window.addEventListener('scroll', () => {
    if (!pendiente) { pendiente = true; requestAnimationFrame(actualizar); }
  }, { passive: true });
  actualizar();
}

/* ---------------------------- colorway ----------------------------- */

/** Luminancia relativa sRGB (WCAG), para decidir tinta clara u oscura encima. */
function luminance(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Cada drop puede traer su propio colorway (columna `acento` de la planilla).
 * La marca queda quieta y el drop es el que cambia de color.
 * La tinta de los botones se calcula: un chartreuse necesita texto oscuro y un
 * azul necesita texto claro, y el color lo elige quien carga la planilla.
 */
function applyAccent(drop) {
  const root = document.documentElement.style;
  const color = drop?.accent;

  if (!color) {
    root.removeProperty('--accent');
    root.removeProperty('--accent-ink');
    return;
  }

  root.setProperty('--accent', color);
  root.setProperty('--accent-ink', luminance(color) > 0.45 ? '#0e1417' : '#f2f7f8');
}

/* ----------------------------- render ------------------------------ */

/** La grilla dibuja grupos, no filas: las variantes van juntas en una card. */
function visibleGroups() {
  const all = state.catalog.groups;
  return state.category === 'all'
    ? all
    : all.filter((g) => g.primary.category === state.category);
}

function renderAll() {
  const catalog = state.catalog;

  // El colorway se toma del drop que se esta mostrando: el activo si lo hay,
  // si no el que viene, para que el teaser ya anticipe el color.
  applyAccent(catalog.activeDrop || catalog.upcomingDrop);

  ui.renderHeaderStatus(el.headerStatus, catalog);
  ui.renderHero(el.hero, catalog);

  if (catalog.mode === 'live' && catalog.groups.length) {
    ui.renderFilters(el.filters, catalog.products, state.category);
    ui.renderGrid(el.grid, el.gridEmpty, visibleGroups());
    el.catalog.hidden = false;
  } else {
    el.catalog.hidden = true;
  }

  ui.renderArchive(el.archive, el.archiveList, catalog.pastDrops);

  clearInterval(state.timer);
  state.timer = ui.startCountdowns(() => {
    // El drop abrio o cerro mientras la pagina estaba abierta: recargamos datos.
    clearInterval(state.timer);
    init();
  });
}

/** Mantiene el aria-pressed de los chips en sinc con el filtro activo. */
function syncFilterButtons() {
  el.filters.querySelectorAll('[data-cat]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.cat === state.category));
  });
}

/* ----------------------------- eventos ----------------------------- */

function onFilterChange(cat) {
  state.category = cat;
  syncFilterButtons();
  ui.renderGrid(el.grid, el.gridEmpty, visibleGroups());
}

function openProduct(uid) {
  const grupo = state.catalog.groups.find((g) => g.uid === uid);
  if (!grupo) return;
  state.modalGroup = grupo;
  // Abre en la primera variante con stock: no tiene sentido recibir al
  // visitante con un estilo agotado si el otro esta disponible.
  const conStock = grupo.variants.findIndex((v) => v.stock.units > 0);
  state.variante = conStock === -1 ? 0 : conStock;
  ui.renderModal(el.modalBody, grupo, state.variante);
  el.modal.showModal();
}

function wireEvents() {
  ui.installImageFallback();

  // Abrir el detalle: click o Enter/Espacio sobre la card, pero no sobre el
  // boton de WhatsApp (ese va directo a wa.me).
  el.grid.addEventListener('click', (e) => {
    if (e.target.closest('[data-stop]')) return;
    const card = e.target.closest('[data-uid]');
    if (card) openProduct(card.dataset.uid);
  });

  el.grid.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('[data-uid]');
    if (!card) return;
    e.preventDefault();
    openProduct(card.dataset.uid);
  });

  el.modalClose.addEventListener('click', () => el.modal.close());

  // Cambiar de estilo dentro de la ficha: redibuja imagen, precio, stock y el
  // enlace de WhatsApp, que tiene que apuntar al estilo elegido.
  el.modalBody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-variante]');
    if (!btn || !state.modalGroup) return;
    state.variante = Number(btn.dataset.variante);
    ui.renderModal(el.modalBody, state.modalGroup, state.variante);
  });

  // Click fuera del contenido cierra el dialog
  el.modal.addEventListener('click', (e) => {
    if (e.target === el.modal) el.modal.close();
  });

  // Si llegaron datos nuevos mientras el modal estaba abierto, se vuelcan al
  // cerrarlo. Cubre tambien el cierre con Escape, que no pasa por el boton.
  el.modal.addEventListener('close', () => {
    state.modalGroup = null;
    if (!state.pendingRender) return;
    state.pendingRender = false;
    renderAll();
    syncFilterButtons();
  });

  el.filters.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat]');
    if (btn) onFilterChange(btn.dataset.cat);
  });

  el.retry.addEventListener('click', () => init());

  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-scroll-catalog]');
    if (!link) return;
    e.preventDefault();
    el.catalog.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/* --------------------------- auto-refresh -------------------------- */

/** Huella de los datos crudos, para no redibujar si no cambio nada. */
const signature = (raw) => JSON.stringify([raw.products, raw.drops]);

/** Vuelca los datos nuevos a la pantalla conservando el filtro elegido. */
function applyCatalog(raw) {
  state.catalog = buildCatalog(raw);
  renderAll();
  syncFilterButtons();
}

/**
 * Relectura silenciosa. A diferencia de init(), no muestra el spinner ni la
 * pantalla de error: un fallo puntual de red no tiene por que borrar un
 * catalogo que se esta viendo bien. Si la planilla sigue caida, el proximo
 * init() (o el boton de reintentar) si lo va a reportar.
 */
async function refresh() {
  if (document.visibilityState !== 'visible') return;

  const raw = await loadCatalog();
  if (raw.source === 'none') return;

  const sig = signature(raw);
  if (sig === state.signature) return;   // nada cambio: no tocamos el DOM
  state.signature = sig;

  // Redibujar con el modal abierto se lo cerraria en la cara al visitante.
  // Guardamos los datos y los volcamos cuando lo cierre.
  if (el.modal.open) {
    state.catalog = buildCatalog(raw);
    state.pendingRender = true;
    return;
  }

  applyCatalog(raw);
}

function startAutoRefresh() {
  const secs = CONFIG.sheet.refreshSeconds;
  clearInterval(state.refreshTimer);
  if (!secs) return;
  state.refreshTimer = setInterval(refresh, secs * 1000);
}

/* ------------------------------- init ------------------------------ */

async function init() {
  el.loading.hidden = false;
  el.error.hidden = true;

  const raw = await loadCatalog();

  if (raw.source === 'none') {
    el.loading.hidden = true;
    el.error.hidden = false;
    el.errorDetail.textContent = raw.error || 'Fuente de datos no disponible';
    return;
  }

  state.signature = signature(raw);
  el.loading.hidden = true;
  applyCatalog(raw);

  if (!init._warned) {
    setupWarning();
    init._warned = true;
  }
}

applyBrand();
setupHeader();
renderTicker();
startHeroSlides(document.querySelector('[data-hero-bg]'), document.querySelector('[data-hero-place]'));
{
  const creditos = document.querySelector('[data-photo-credits]');
  if (creditos) creditos.innerHTML = photoCredits();
}
wireEvents();
init().then(startAutoRefresh);

// Al volver a la pestana leemos de una, sin esperar al proximo intervalo.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.catalog) refresh();
});
