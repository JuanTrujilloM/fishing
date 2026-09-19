/**
 * Normalizacion del catalogo y reglas de negocio del modelo de drops.
 * Aca vive toda la logica de estados: que drop esta activo, que stock se
 * muestra y en que estado esta cada producto.
 */
import { CONFIG } from './config.js';

/* ------------------------- helpers de parseo ------------------------- */

const str = (v) => (v == null ? '' : String(v).trim());

const num = (v, fallback = 0) => {
  if (typeof v === 'number') return v;
  const cleaned = str(v).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : fallback;
};

const bool = (v, fallback = true) => {
  const s = str(v).toLowerCase();
  if (!s) return fallback;
  return ['si', 'sí', 'true', '1', 'x', 'yes', 'activo'].includes(s);
};

/**
 * Las fechas de la planilla se escriben en hora de Colombia ("2026-09-10 19:00")
 * sin indicar zona. Si las pasaramos tal cual a `new Date`, cada visitante las
 * interpretaria en SU zona horaria y el drop abriria a distinta hora en cada
 * pais. Por eso, cuando el valor no trae zona, le pegamos CONFIG.utcOffset.
 */
const date = (v) => {
  if (!v) return null;
  let s = str(v);

  // Ya trae zona explicita (Z o +/-HH:MM): se respeta.
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(s);
  const isPlain = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(s);

  if (isPlain && !hasZone) {
    s = s.replace(' ', 'T');
    if (!/T/.test(s)) s += 'T00:00:00';        // solo fecha -> medianoche
    if (s.length === 16) s += ':00';           // sin segundos
    s += CONFIG.utcOffset;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Slug para ids y anclas. */
const slug = (s) =>
  str(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* --------------------------- formateo -------------------------------- */

const moneyFmt = new Intl.NumberFormat(CONFIG.locale, {
  style: 'currency',
  currency: CONFIG.currency,
  maximumFractionDigits: 0,
});

export const formatMoney = (n) => moneyFmt.format(n);

export const formatDate = (d) =>
  d
    ? new Intl.DateTimeFormat(CONFIG.locale, {
        day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
        timeZone: CONFIG.timezone,
      }).format(d)
    : '';

/* --------------------------- productos ------------------------------- */

/**
 * `units` son las unidades tal como vienen de la planilla; `displayed` es lo
 * que ve el visitante. Con CONFIG.stock.defaultMultiplier en 1 son el mismo
 * numero (la planilla ya trae las unidades infladas). Con el multiplicador en
 * 10, el sitio hace la inflacion y `units` serian las unidades reales.
 */
function computeStock(units, unitsInitial, multiplier) {
  const m = multiplier > 0 ? multiplier : 1;
  const now = Math.max(0, units);
  const initial = Math.max(now, unitsInitial || now);
  return {
    units: now,
    unitsInitial: initial,
    displayed: now * m,
    displayedInitial: initial * m,
    multiplier: m,
    percent: initial > 0 ? Math.round((now / initial) * 100) : 0,
  };
}

function productState(stock, dropState) {
  if (stock.units <= 0) return 'agotado';
  if (dropState === 'proximo') return 'proximo';
  if (dropState === 'cerrado') return 'cerrado';
  if (stock.units <= CONFIG.stock.lowStockThreshold) return 'ultimas';
  return 'disponible';
}

export const STATE_LABEL = {
  disponible: 'Disponible',
  ultimas: 'Últimas unidades',
  agotado: 'Agotado',
  proximo: 'Próximamente',
  cerrado: 'Drop cerrado',
};

function normalizeProduct(raw, dropsById, index) {
  const sku = str(raw.sku) || slug(raw.nombre);
  const dropId = str(raw.drop_id);
  const drop = dropsById.get(dropId);
  // `stock_actual` es el nombre vigente. Se acepta `stock_real` por si quedan
  // planillas viejas dando vueltas.
  const actual = str(raw.stock_actual) !== '' ? raw.stock_actual : raw.stock_real;
  const stock = computeStock(
    num(actual, 0),
    num(raw.stock_inicial, 0),
    num(raw.multiplicador, CONFIG.stock.defaultMultiplier)
  );

  return {
    // Identificador interno por posicion de fila. El sku NO sirve para esto:
    // si la planilla repite un sku, buscar por sku devolveria siempre la
    // primera fila y al tocar la segunda card se abriria la ficha equivocada.
    uid: `r${index}`,
    sku,
    // Varias filas con el mismo `grupo` se juntan en UNA card, y adentro de la
    // ficha se eligen entre si. Cada una sigue siendo su propia fila en la
    // planilla, con su stock y su precio.
    group: str(raw.grupo),
    // Nombre corto del estilo, para el selector de la ficha. Sin esto se usa
    // el nombre completo, que suele ser muy largo para un chip.
    variantName: str(raw.estilo),
    name: str(raw.nombre) || 'Sin nombre',
    category: slug(raw.categoria),
    description: str(raw.descripcion),
    specs: str(raw.specs)
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean),
    price: num(raw.precio, 0),
    image: str(raw.imagen) || `assets/products/${sku}.jpg`,
    dropId,
    dropName: drop?.name || '',
    featured: bool(raw.destacado, false),
    active: bool(raw.activo, true),
    stock,
    state: productState(stock, drop?.state || 'cerrado'),
  };
}

/* ----------------------------- drops --------------------------------- */

/**
 * Estado de un drop:
 *   proximo  -> anunciado, todavia no abrio
 *   activo   -> abierto, se puede comprar
 *   cerrado  -> ya paso (archivo)
 * La columna `estado` del Sheet, si viene, manda sobre las fechas.
 */
function dropState(start, end, override, now) {
  const forced = str(override).toLowerCase();
  if (['activo', 'proximo', 'cerrado'].includes(forced)) return forced;
  if (start && now < start) return 'proximo';
  if (end && now > end) return 'cerrado';
  if (start && now >= start) return 'activo';
  return 'cerrado';
}

/** Acepta #RGB o #RRGGBB. Cualquier otra cosa se ignora en silencio. */
const hex = (v) => {
  const s = str(v).trim();
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(s) ? s : '';
};

function normalizeDrop(raw, now) {
  const start = date(raw.fecha_inicio);
  const end = date(raw.fecha_fin);
  return {
    id: str(raw.drop_id),
    name: str(raw.nombre) || 'Drop',
    description: str(raw.descripcion),
    hero: str(raw.imagen_hero),
    // Colorway del drop: pisa --accent mientras ese drop este abierto.
    // Vacio = se usa el cian de la marca.
    accent: hex(raw.acento),
    start,
    end,
    state: dropState(start, end, raw.estado, now),
  };
}

/* ---------------------------- grupos --------------------------------- */

/** Para decidir el estado de un grupo: gana el mejor de sus variantes. */
const RANGO_ESTADO = { disponible: 3, ultimas: 2, proximo: 1, cerrado: 1, agotado: 0 };

/**
 * Junta en un solo grupo las filas que comparten `grupo`. Un producto sin
 * `grupo` queda como grupo de uno, asi la grilla dibuja siempre lo mismo.
 *
 * El grupo suma el stock de sus variantes y toma el mejor estado: si queda una
 * disponible, la card NO puede decir "agotado" aunque la otra se haya acabado.
 */
function groupProducts(list) {
  const mapa = new Map();
  list.forEach((p) => {
    const clave = p.group || p.uid;
    if (!mapa.has(clave)) mapa.set(clave, []);
    mapa.get(clave).push(p);
  });

  return [...mapa.values()].map((variants) => {
    const primary = variants.find((v) => v.featured) || variants[0];
    const suma = (f) => variants.reduce((s, v) => s + f(v), 0);

    const units = suma((v) => v.stock.units);
    const unitsInitial = suma((v) => v.stock.unitsInitial);
    const precios = variants.map((v) => v.price);

    const state = variants.reduce(
      (mejor, v) => (RANGO_ESTADO[v.state] > RANGO_ESTADO[mejor] ? v.state : mejor),
      'agotado'
    );

    return {
      uid: primary.uid,
      primary,
      variants,
      state,
      priceMin: Math.min(...precios),
      priceMax: Math.max(...precios),
      stock: {
        units,
        unitsInitial,
        displayed: suma((v) => v.stock.displayed),
        displayedInitial: suma((v) => v.stock.displayedInitial),
        percent: unitsInitial > 0 ? Math.round((units / unitsInitial) * 100) : 0,
      },
    };
  });
}

/* --------------------------- ensamblado ------------------------------ */

/**
 * Toma las filas crudas del Sheet y devuelve el modelo que consume la UI.
 * `mode` decide que pantalla se renderiza:
 *   live     -> hay un drop abierto, se muestra la grilla
 *   upcoming -> no hay drop abierto pero si uno anunciado (teaser + countdown)
 *   closed   -> no hay nada abierto ni anunciado (solo archivo)
 *   empty    -> no hay datos
 */
export function buildCatalog({ products = [], drops = [] }, now = new Date()) {
  const allDrops = drops.map((d) => normalizeDrop(d, now)).filter((d) => d.id);
  const dropsById = new Map(allDrops.map((d) => [d.id, d]));

  const allProducts = products
    .map((p, i) => normalizeProduct(p, dropsById, i))
    .filter((p) => p.active && p.sku);

  // Un sku repetido casi siempre es una fila duplicada por error al cargar.
  // El sitio no se rompe (cada fila tiene su uid), pero las dos comparten foto
  // y conviene avisarlo para que se limpie la planilla.
  const vistos = new Set();
  const repetidos = new Set();
  allProducts.forEach((p) => (vistos.has(p.sku) ? repetidos.add(p.sku) : vistos.add(p.sku)));
  if (repetidos.size) {
    console.warn(
      `[catalogo] Hay sku repetidos en la planilla: ${[...repetidos].join(', ')}. ` +
        'Cada fila se muestra igual, pero comparten la misma foto.'
    );
  }

  const byDrop = (id) => allProducts.filter((p) => p.dropId === id);

  const activeDrop = allDrops.find((d) => d.state === 'activo') || null;

  const upcomingDrop =
    allDrops
      .filter((d) => d.state === 'proximo')
      .sort((a, b) => (a.start?.getTime() || 0) - (b.start?.getTime() || 0))[0] || null;

  const pastDrops = allDrops
    .filter((d) => d.state === 'cerrado')
    .sort((a, b) => (b.start?.getTime() || 0) - (a.start?.getTime() || 0));

  let mode = 'empty';
  if (activeDrop) mode = 'live';
  else if (upcomingDrop) mode = 'upcoming';
  else if (pastDrops.length) mode = 'closed';

  return {
    mode,
    activeDrop,
    upcomingDrop,
    pastDrops: pastDrops.map((d) => ({ ...d, products: byDrop(d.id) })),
    // `products` queda plano para buscar una variante puntual; `groups` es lo
    // que dibuja la grilla, con las variantes ya juntadas.
    products: activeDrop ? byDrop(activeDrop.id) : [],
    groups: activeDrop ? groupProducts(byDrop(activeDrop.id)) : [],
    categories: CONFIG.categories,
  };
}

/* --------------------------- countdown ------------------------------- */

/** Diferencia hasta `target` desglosada. `done` cuando ya paso. */
export function countdown(target, now = new Date()) {
  const ms = target ? target.getTime() - now.getTime() : 0;
  if (!target || ms <= 0) return { done: true, d: 0, h: 0, m: 0, s: 0 };
  const s = Math.floor(ms / 1000);
  return {
    done: false,
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}
