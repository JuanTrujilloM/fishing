/**
 * Construccion de los enlaces a WhatsApp con mensaje prellenado.
 * wa.me abre la app en movil y WhatsApp Web en escritorio.
 */
import { CONFIG } from './config.js';
import { formatMoney } from './store.js';

const clean = (n) => String(n).replace(/\D/g, '');

function buildLink(text) {
  const number = clean(CONFIG.whatsapp.number);
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/** Enlace de consulta por un producto puntual. */
export function productLink(product, dropName = '') {
  const text = CONFIG.whatsapp.productTemplate
    .replace('{producto}', product.name)
    .replace('{sku}', product.sku)
    .replace('{precio}', product.price > 0 ? formatMoney(product.price) : 'a consultar')
    .replace('{drop}', dropName || product.dropName || 'catalogo');
  return buildLink(text);
}

/** Enlace para anotarse al aviso del proximo drop. */
export function waitlistLink(dropName = '') {
  const base = CONFIG.whatsapp.waitlistTemplate;
  const text = dropName ? `${base} (${dropName})` : base;
  return buildLink(text);
}

/** True si el numero sigue siendo el placeholder de ejemplo. */
export const isPlaceholderNumber = () => clean(CONFIG.whatsapp.number) === '573001234567';
