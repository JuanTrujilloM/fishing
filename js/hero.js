/**
 * Fondo del hero: fotos de los embalses del oriente antioqueño con fundido
 * lento. Vive separado del contenido del hero, que se redibuja con cada
 * refresco de la planilla; esto se inicia una sola vez.
 */
import { CONFIG } from './config.js';
import { esc } from './ui.js';

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Solo la primera foto se pide al cargar. Cada siguiente se pide recién
 * cuando está por mostrarse: en celular, las tres juntas son medio mega que
 * nadie pidió todavía.
 */
function cargar(img, s) {
  if (img.dataset.cargada) return;
  img.srcset = `${s.srcSmall || s.src} 900w, ${s.src} 1600w`;
  img.sizes = '100vw';
  img.src = s.src;
  img.dataset.cargada = '1';
}

function lugarHtml(s) {
  const credito = s.autor
    ? `<a href="${esc(s.fuente)}" target="_blank" rel="noopener">Foto: ${esc(s.autor)} · ${esc(s.licencia)}</a>`
    : '';
  return `<span class="place-name">${esc(s.lugar)}</span>${credito}`;
}

export function startHeroSlides(bgEl, placeEl) {
  const slides = (CONFIG.hero?.slides || []).filter((s) => s.src);
  if (!bgEl || !slides.length) return;

  const imgs = slides.map(() => {
    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    bgEl.appendChild(img);
    return img;
  });

  const intervalo = (CONFIG.hero.intervalSeconds || 8) * 1000;
  document.documentElement.style.setProperty('--hero-interval', `${intervalo}ms`);

  // Indicadores: uno por foto, el activo se llena durante el intervalo.
  const barras = slides.length > 1
    ? `<span class="place-bars">${slides.map(() => '<i></i>').join('')}</span>`
    : '';

  let actual = -1;
  const mostrar = (i) => {
    cargar(imgs[i], slides[i]);
    const on = () => {
      imgs.forEach((im, n) => im.classList.toggle('is-on', n === i));
      if (placeEl) {
        placeEl.innerHTML = lugarHtml(slides[i]) + barras;
        placeEl.querySelectorAll('.place-bars i')
          .forEach((b, n) => b.classList.toggle('is-on', n === i));
      }
      actual = i;
      // Precargar la que sigue mientras esta se ve.
      if (slides.length > 1) cargar(imgs[(i + 1) % slides.length], slides[(i + 1) % slides.length]);
    };
    // No mostrar una foto a medio cargar: se esperaría un corte en seco.
    if (imgs[i].complete && imgs[i].naturalWidth) on();
    else imgs[i].addEventListener('load', on, { once: true });
  };

  mostrar(0);

  // Con "reducir movimiento" la primera foto queda fija.
  if (slides.length < 2 || reducedMotion()) return;

  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    mostrar((actual + 1) % slides.length);
  }, intervalo);
}

/** Créditos completos para el pie: la licencia CC exige dar crédito. */
export function photoCredits() {
  const conAutor = (CONFIG.hero?.slides || []).filter((s) => s.autor);
  if (!conAutor.length) return '';
  const lista = conAutor
    .map((s) => `<a href="${esc(s.fuente)}" target="_blank" rel="noopener">${esc(s.autor)}</a> (${esc(s.licencia)})`)
    .join(', ');
  return `Fotos de embalses: ${lista}, vía Wikimedia Commons.`;
}
