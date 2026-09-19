/**
 * Capa de datos: lee la planilla de Google Sheets y la normaliza.
 * No requiere API key: usa el endpoint publico `gviz` (la planilla debe estar
 * compartida como "cualquiera con el enlace puede ver").
 */
import { CONFIG } from './config.js';

/**
 * `headers=1` es obligatorio, no cosmetico: sin el, gviz ADIVINA si la primera
 * fila es encabezado mirando los tipos de dato. En una pestana donde todas las
 * columnas son texto (como `drops`), no puede distinguir el encabezado de los
 * datos, devuelve las columnas como "a", "b", "c"... y trata el encabezado como
 * una fila mas. Forzarlo hace que las dos pestanas se lean igual.
 */
const GVIZ = (id, tab) =>
  `https://docs.google.com/spreadsheets/d/${id}/gviz/tq` +
  `?tqx=out:json&headers=1&sheet=${encodeURIComponent(tab)}` +
  // Rompe cualquier cache intermedio: sin esto una edicion en la planilla
  // puede tardar en verse aunque pidamos `no-store`.
  `&_=${Date.now()}`;

/** El endpoint gviz devuelve JS envuelto, no JSON puro. Lo desenvolvemos. */
function unwrapGviz(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Respuesta de Sheets ilegible');
  return JSON.parse(text.slice(start, end + 1));
}

const pad = (n) => String(n).padStart(2, '0');

/**
 * gviz codifica fechas como el string "Date(2026,8,10,19,0,0)" (mes 0-indexado).
 * Lo devolvemos como texto plano "YYYY-MM-DD HH:MM:SS" SIN convertirlo a Date:
 * la zona horaria la aplica store.js con CONFIG.utcOffset. Si construyeramos el
 * Date aca, quedaria anclado a la zona del navegador de cada visitante.
 */
function parseGvizValue(cell, type) {
  if (cell == null) return '';
  const v = cell.v;
  if (v == null) return '';
  if (type === 'date' || type === 'datetime') {
    if (typeof v === 'string' && v.startsWith('Date(')) {
      const [y, m, d, hh = 0, mm = 0, ss = 0] = v
        .slice(5, -1)
        .split(',')
        .map((n) => parseInt(n, 10));
      return `${y}-${pad(m + 1)}-${pad(d)} ${pad(hh)}:${pad(mm)}:${pad(ss)}`;
    }
    return cell.f || String(v);
  }
  return v;
}

/** Convierte la tabla gviz en un array de objetos con claves = encabezados. */
function tableToRows(table) {
  const headers = table.cols.map((c, i) =>
    String(c.label || c.id || `col${i}`).trim().toLowerCase()
  );
  return table.rows
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => {
        if (!h) return;
        obj[h] = parseGvizValue(row.c?.[i], table.cols[i]?.type);
      });
      return obj;
    })
    .filter((obj) => Object.values(obj).some((v) => v !== '' && v != null));
}

async function fetchTab(id, tab) {
  const res = await fetch(GVIZ(id, tab), { cache: 'no-store' });
  if (!res.ok) throw new Error(`Sheets respondio ${res.status} para la pestana "${tab}"`);
  return tableToRows(unwrapGviz(await res.text()).table);
}

/**
 * La planilla es la UNICA fuente de datos: no hay copia local de respaldo ni
 * cache propio. Cada lectura va a la planilla, asi lo que se ve en pantalla es
 * siempre lo que dice la planilla en ese momento. Quien mantiene fresca la
 * pantalla es el auto-refresh de main.js, no un cache con vencimiento.
 *
 * Devuelve { products, drops, source } con source 'sheet' | 'none'.
 * Nunca lanza: si falla, devuelve listas vacias y un `error`.
 */
export async function loadCatalog() {
  const { id, productsTab, dropsTab } = CONFIG.sheet;

  if (!id) {
    return {
      products: [], drops: [], source: 'none',
      error: 'Falta el ID de la planilla en js/config.js (sheet.id).',
    };
  }

  try {
    const [products, drops] = await Promise.all([
      fetchTab(id, productsTab),
      fetchTab(id, dropsTab),
    ]);
    return { products, drops, source: 'sheet' };
  } catch (err) {
    console.error('[catalogo] No se pudo leer la planilla:', err);
    return {
      products: [], drops: [], source: 'none',
      error:
        `${err.message}. Revisa que la planilla este compartida como ` +
        `"cualquiera con el enlace - Lector" y que las pestanas se llamen ` +
        `"${productsTab}" y "${dropsTab}".`,
    };
  }
}
