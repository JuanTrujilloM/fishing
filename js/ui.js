/**
 * Renderizado. Todo el HTML del sitio se arma aca a partir del modelo
 * que devuelve store.buildCatalog().
 */
import { CONFIG } from './config.js';
import { formatMoney, formatDate, countdown, STATE_LABEL } from './store.js';
import { productLink, waitlistLink } from './whatsapp.js';

/* --------------------------- utilidades --------------------------- */

const $ = (sel, root = document) => root.querySelector(sel);

/** Escapa texto que viene del Sheet antes de meterlo en innerHTML. */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const WA_ICON = `<svg class="wa-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.7.2s-.7 1-.9 1.2c-.2.2-.3.2-.6.1s-1.3-.5-2.4-1.5c-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5s0-.4 0-.5c0-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.4z"/><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.1.8.8-3-.2-.3a8.2 8.2 0 1 1 7.2 3.9z"/></svg>`;

const placeholder = (emoji = '🎣') => `<div class="ph" aria-hidden="true">${emoji}</div>`;

/**
 * <img> con fallback a placeholder si la foto todavia no existe.
 * El fallback lo aplica installImageFallback() con un listener delegado,
 * asi evitamos handlers inline (que rompen bajo Content-Security-Policy).
 */
function media(src, alt, emoji = '🎣') {
  if (!src) return placeholder(emoji);
  return `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async" data-ph="${esc(emoji)}">`;
}

/**
 * El evento `error` de <img> no burbujea, pero si se puede capturar.
 * Se instala una sola vez y cubre cards y modal por igual.
 */
export function installImageFallback(root = document) {
  root.addEventListener(
    'error',
    (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || !img.dataset.ph) return;
      const ph = document.createElement('div');
      ph.className = 'ph';
      ph.setAttribute('aria-hidden', 'true');
      ph.textContent = img.dataset.ph;
      img.replaceWith(ph);
    },
    true
  );
}

const catLabel = (id) =>
  CONFIG.categories.find((c) => c.id === id)?.label || id || '';

/* ----------------------------- Hero ------------------------------- */

function countdownHtml(target) {
  const c = countdown(target);
  const unit = (v, l) => `<div class="cd-unit"><b>${String(v).padStart(2, '0')}</b><span>${l}</span></div>`;
  return `<div class="countdown" data-countdown-target="${target ? target.toISOString() : ''}">
    ${unit(c.d, 'días')}${unit(c.h, 'horas')}${unit(c.m, 'min')}${unit(c.s, 'seg')}
  </div>`;
}

export function renderHero(el, catalog) {
  const { mode, activeDrop, upcomingDrop, products } = catalog;
  el.dataset.mode = mode;
  el.hidden = false;

  if (mode === 'live') {
    // Se cuentan cards, no filas: un X-Rap en dos estilos es un producto.
    // Si contara filas, el hero diria "5 productos" sobre una grilla de 4.
    const available = (catalog.groups || []).filter((g) => g.stock.units > 0);
    const totalUnits = products
      .filter((p) => p.stock.units > 0)
      .reduce((sum, p) => sum + p.stock.displayed, 0);
    // El titulo es el nombre del drop y nada mas: "PIQUE 01 · CHARTREUSE" ya
    // dice que es una edicion. Agregarle una bajada seria repetir.
    el.innerHTML = `<div class="wrap">
      <p class="hero-kicker">Drop abierto</p>
      <h1 class="hero-title">${esc(activeDrop.name)}</h1>
      <p class="hero-lead">${esc(activeDrop.description ||
        'Señuelos, varas y carreteles en cantidad limitada. Se cierra por WhatsApp y no hay reposición.')}</p>
      ${activeDrop.end ? countdownHtml(activeDrop.end) : ''}
      <div class="hero-actions">
        <a class="btn btn-primary" href="#contenido" data-scroll-catalog>Ver el drop</a>
        <a class="btn btn-ghost" href="${waitlistLink(activeDrop.name)}" target="_blank" rel="noopener">${WA_ICON} Escríbenos</a>
      </div>
      <div class="hero-meta">
        <div><b>${available.length}</b> productos disponibles</div>
        <div><b>${totalUnits}</b> unidades en total</div>
        ${activeDrop.end ? `<div><b>${esc(formatDate(activeDrop.end))}</b> cierra el drop</div>` : ''}
      </div>
    </div>`;
    return;
  }

  if (mode === 'upcoming') {
    el.innerHTML = `<div class="wrap">
      <p class="hero-kicker">Próximo drop</p>
      <h1 class="hero-title">${esc(upcomingDrop.name)}</h1>
      <p class="hero-lead">${esc(upcomingDrop.description ||
        'Todavía no abre. Escríbenos y te avisamos apenas se libere.')}</p>
      ${countdownHtml(upcomingDrop.start)}
      <div class="hero-actions">
        <a class="btn btn-wa" href="${waitlistLink(upcomingDrop.name)}" target="_blank" rel="noopener">${WA_ICON} Avísame cuando abra</a>
      </div>
      <div class="hero-meta">
        ${upcomingDrop.start ? `<div><b>${esc(formatDate(upcomingDrop.start))}</b> abre el drop</div>` : ''}
        <div><b>Cantidad limitada</b> sin reposición</div>
      </div>
    </div>`;
    return;
  }

  // closed / empty
  el.innerHTML = `<div class="wrap">
    <p class="hero-kicker">Sin drop activo</p>
    <h1 class="hero-title">No hay <em>drop</em> abierto</h1>
    <p class="hero-lead">Trabajamos por lanzamientos limitados, no con catálogo permanente. Escríbenos y te avisamos cuando abra el próximo.</p>
    <div class="hero-actions">
      <a class="btn btn-wa" href="${waitlistLink()}" target="_blank" rel="noopener">${WA_ICON} Avísame del próximo drop</a>
    </div>
  </div>`;
}

/* ---------------------------- Header ------------------------------ */

export function renderHeaderStatus(el, catalog) {
  const { mode, activeDrop, upcomingDrop } = catalog;
  // `name` se oculta en pantallas chicas; `tag` siempre se ve.
  const map = {
    live:     { state: 'activo',  name: activeDrop?.name || 'Drop',   tag: 'En vivo' },
    upcoming: { state: 'proximo', name: upcomingDrop?.name || '',     tag: 'Próximo' },
    closed:   { state: 'cerrado', name: '',                           tag: 'Sin drop activo' },
    empty:    { state: 'cerrado', name: '',                           tag: 'Sin drop activo' },
  };
  const s = map[mode] || map.empty;
  el.dataset.state = s.state;
  el.innerHTML =
    `<span class="dot"></span>` +
    (s.name ? `<span class="hs-name">${esc(s.name)} ·</span>` : '') +
    `<span class="hs-tag">${esc(s.tag)}</span>`;
  el.hidden = false;
}

/* ---------------------------- Filtros ----------------------------- */

/** Dibuja los chips. El click lo maneja el listener delegado de main.js. */
export function renderFilters(el, products, activeCat) {
  const present = new Set(products.map((p) => p.category));
  const cats = [{ id: 'all', label: 'Todo' }].concat(
    CONFIG.categories.filter((c) => present.has(c.id))
  );

  el.innerHTML = cats
    .map(
      (c) =>
        `<button class="chip" type="button" data-cat="${esc(c.id)}"
           aria-pressed="${c.id === activeCat}">${esc(c.label)}</button>`
    )
    .join('');
}

/* ----------------------------- Stock ------------------------------ */

function stockHtml(p) {
  const { displayed, displayedInitial, percent } = p.stock;
  const label = STATE_LABEL[p.state] || '';
  const count = CONFIG.stock.showUnitCount && p.stock.units > 0
    ? `<strong>${displayed}</strong> / ${displayedInitial} u.`
    : '';
  return `<div class="stock" data-state="${esc(p.state)}">
    <div class="stock-bar"><div class="stock-fill" style="width:${percent}%"></div></div>
    <div class="stock-text"><span>${esc(label)}</span>${count}</div>
  </div>`;
}

/* ----------------------------- Cards ------------------------------ */

/** "Rapala X-Rap 06 — Glass Ghost" -> "Rapala X-Rap 06".
 *  En una card agrupada el color sobra: adentro se elige. */
const nombreBase = (n) => String(n).split('—')[0].trim() || n;

/** "... — Glass Ghost" -> "Glass Ghost", para la etiqueta del chip. */
const nombreColor = (n) => {
  const partes = String(n).split('—');
  return partes.length > 1 ? partes.pop().trim() : n;
};

/**
 * Una card por GRUPO, no por fila. Si el grupo tiene varias variantes, la card
 * muestra la principal y avisa cuantos estilos hay; el boton abre la ficha en
 * vez de ir a WhatsApp, porque todavia no se sabe cual estilo quiere.
 */
function cardHtml(g) {
  const p = g.primary;
  const soldOut = g.stock.units <= 0;
  const multi = g.variants.length > 1;

  // Precio vacio en la planilla = "Consultar precio", nunca "$ 0": un cero
  // publicado se lee como gratis. Solo cuentan los precios cargados.
  const conPrecio = g.variants.map((v) => v.price).filter((n) => n > 0);
  const sinPrecio = !conPrecio.length;
  const minimo = Math.min(...conPrecio);
  const precio = sinPrecio
    ? 'Consultar precio'
    : conPrecio.every((n) => n === minimo)
      ? formatMoney(minimo)
      : `desde ${formatMoney(minimo)}`;

  const accion = soldOut
    ? `<span class="btn btn-ghost btn-block" aria-disabled="true">Agotado</span>`
    : multi
      ? `<span class="btn btn-primary btn-block">Ver los ${g.variants.length} estilos</span>`
      : `<a class="btn btn-wa btn-block" href="${productLink(p)}" target="_blank" rel="noopener"
           data-stop>${WA_ICON} Preguntar por WhatsApp</a>`;

  return `<article class="card" data-state="${esc(g.state)}" data-uid="${esc(g.uid)}" tabindex="0" role="button"
      aria-label="Ver detalle de ${esc(p.name)}">
    <div class="card-media">
      ${media(p.image, p.name)}
      <span class="badge" data-state="${esc(g.state)}">${esc(STATE_LABEL[g.state] || '')}</span>
      ${multi ? `<span class="badge badge-variants">${g.variants.length} estilos</span>` : ''}
    </div>
    <div class="card-body">
      <span class="card-cat">${esc(catLabel(p.category))}</span>
      <h3 class="card-name">${esc(multi ? nombreBase(p.name) : p.name)}</h3>
      <span class="card-price${sinPrecio ? ' is-empty' : ''}">${esc(precio)}</span>
      <div class="card-foot">
        ${stockHtml({ stock: g.stock, state: g.state })}
        ${accion}
      </div>
    </div>
  </article>`;
}

export function renderGrid(gridEl, emptyEl, groups) {
  gridEl.innerHTML = groups.map(cardHtml).join('');
  emptyEl.hidden = groups.length > 0;
}

/* ----------------------------- Modal ------------------------------ */

/**
 * Ficha del producto. Recibe el GRUPO y cual variante esta elegida: el selector
 * de estilos cambia imagen, precio, stock y el mensaje de WhatsApp, porque cada
 * estilo es una fila distinta de la planilla con su propio stock.
 */
export function renderModal(bodyEl, group, indice = 0) {
  const variantes = group.variants;
  const i = Math.min(Math.max(indice, 0), variantes.length - 1);
  const p = variantes[i];
  const soldOut = p.stock.units <= 0;
  const multi = variantes.length > 1;

  const selector = !multi ? '' : `
    <div class="variantes">
      <span class="lab-variantes">Estilo</span>
      <div class="variante-lista" role="group" aria-label="Elegir estilo">
        ${variantes.map((v, n) => `
          <button type="button" class="variante" data-variante="${n}"
            aria-pressed="${n === i}" ${v.stock.units <= 0 ? 'data-agotado="si"' : ''}
            title="${esc(v.variantName || v.name)}">
            <span class="variante-img">${media(v.image, v.variantName || v.name)}</span>
            <span class="variante-txt">${esc(v.variantName || nombreColor(v.name))}</span>
          </button>`).join('')}
      </div>
    </div>`;

  bodyEl.innerHTML = `
    <div class="modal-media">${media(p.image, p.name)}</div>
    <div class="modal-info">
      <span class="card-cat">${esc(catLabel(p.category))} · ${esc(p.sku)}</span>
      <h3>${esc(p.name)}</h3>
      <span class="modal-price${p.price > 0 ? '' : ' is-empty'}">${esc(p.price > 0 ? formatMoney(p.price) : 'Consultar precio')}</span>
      ${selector}
      ${p.description ? `<p class="modal-desc">${esc(p.description)}</p>` : ''}
      ${p.specs.length ? `<ul class="specs">${p.specs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${stockHtml(p)}
      ${
        soldOut
          ? `<span class="btn btn-ghost btn-block" aria-disabled="true">Agotado en este drop</span>`
          : `<a class="btn btn-wa btn-block" href="${productLink(p)}" target="_blank" rel="noopener">${WA_ICON} Preguntar por WhatsApp</a>`
      }
      <p class="modal-note">Pago y envío se coordinan por WhatsApp. ${
        p.dropName ? `Pertenece a ${esc(p.dropName)} y no se repone.` : 'Sin reposición.'
      }</p>
    </div>`;
}

/* ---------------------------- Archivo ----------------------------- */

export function renderArchive(el, listEl, pastDrops) {
  if (!pastDrops.length) { el.hidden = true; return; }
  listEl.innerHTML = pastDrops
    .map(
      (d) => `<div class="past-drop">
        <div class="past-drop-head">
          <h3>${esc(d.name)}</h3>
          <span>${d.start ? esc(formatDate(d.start)) : ''} · agotado</span>
        </div>
        <div class="past-list">
          ${d.products.map((p) => `<span class="past-item">${esc(p.name)}</span>`).join('') ||
            '<span class="past-item">sin registro de productos</span>'}
        </div>
      </div>`
    )
    .join('');
  el.hidden = false;
}

/* --------------------------- Countdowns --------------------------- */

/** Actualiza cada segundo todos los countdowns presentes en el DOM. */
export function startCountdowns(onExpire) {
  let expired = false;
  const tick = () => {
    document.querySelectorAll('[data-countdown-target]').forEach((node) => {
      const target = node.dataset.countdownTarget ? new Date(node.dataset.countdownTarget) : null;
      const c = countdown(target);
      const units = node.querySelectorAll('.cd-unit b');
      [c.d, c.h, c.m, c.s].forEach((v, i) => {
        if (units[i]) units[i].textContent = String(v).padStart(2, '0');
      });
      // Cuando el reloj llega a cero el estado del drop cambio: recargamos.
      if (c.done && target && !expired) {
        expired = true;
        onExpire?.();
      }
    });
  };
  tick();
  return setInterval(tick, 1000);
}

export { $ };
