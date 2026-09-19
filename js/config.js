/**
 * Configuracion del catalogo.
 * Este es el unico archivo que necesitas tocar para poner el sitio en marcha.
 */
export const CONFIG = {
  /* ---------------- Marca ---------------- */
  brand: {
    name: 'PIQUE',

    // NO se muestra en el sitio: la marca va sin bajada, el nombre y el numero
    // del drop cargan solos. Esto alimenta el titulo de la pestana y lo que ven
    // los buscadores, que si necesitan palabras.
    descriptor: 'Equipo de pesca en drops limitados',

    instagram: '',          // ej: 'pique.co' (sin @). Vacio = no se muestra
  },

  /* ---------------- Hero ---------------- */
  // Fotos de fondo del hero. Rotan con un fundido lento.
  // Las actuales son de Wikimedia Commons con licencia libre para uso
  // comercial: exigen dar credito al autor, y el sitio lo muestra solo en la
  // esquina del hero. Si agregas fotos tuyas, deja `autor` vacio y no sale
  // ningun credito. Para preparar una: 1600 px de ancho + version -sm de 900.
  hero: {
    intervalSeconds: 8,
    slides: [
      {
        src: 'assets/hero/guatape-islas.webp',
        srcSmall: 'assets/hero/guatape-islas-sm.webp',
        lugar: 'Embalse Peñol-Guatapé',
        autor: 'Danielcgold',
        licencia: 'CC BY-SA 4.0',
        fuente: 'https://commons.wikimedia.org/wiki/File:Dan-gold-guatape-colombia.jpg',
      },
      {
        src: 'assets/hero/penol-piedra.webp',
        srcSmall: 'assets/hero/penol-piedra-sm.webp',
        lugar: 'Piedra del Peñol',
        autor: 'Juan Gómez',
        licencia: 'CC BY 2.0',
        fuente: 'https://commons.wikimedia.org/wiki/File:Piedra_y_Embalse_del_Pe%C3%B1ol_desde_dron_05.jpg',
      },
      {
        src: 'assets/hero/guatape-atardecer.webp',
        srcSmall: 'assets/hero/guatape-atardecer-sm.webp',
        lugar: 'Atardecer en Guatapé',
        autor: 'D.Medin',
        licencia: 'CC BY-SA 4.0',
        fuente: 'https://commons.wikimedia.org/wiki/File:Atardecer_En_El_Embalse_Pe%C3%B1ol-Guatap%C3%A9_Municipio_D(14).jpg',
      },
    ],
  },

  // Cinta que corre debajo del hero. Frases cortas, se repiten solas.
  ticker: [
    'Sin reposición',
    'Señuelos · Varas · Carreteles',
    'Oriente antioqueño',
    'Se cierra por WhatsApp',
    'Cuando se agota, se agota',
  ],

  /* ---------------- WhatsApp ---------------- */
  whatsapp: {
    // Numero en formato internacional SIN +, sin espacios ni guiones.
    // Colombia = 57 + numero.
    number: '573052936080',

    // {producto} {sku} {precio} {drop} se reemplazan automaticamente.
    // Voz de la marca: directa y sin adornos. Ni signos de exclamacion ni
    // formulas de vendedor.
    productTemplate:
      'Hola, quiero el {producto} ({sku}) de {drop}. Precio {precio}. Hay disponible?',

    waitlistTemplate:
      'Hola, avisenme cuando abra el proximo drop.',
  },

  /* ---------------- Fuente de datos ---------------- */
  sheet: {
    // ID de la planilla de Google. Se saca de la URL:
    // docs.google.com/spreadsheets/d/<ESTE_ES_EL_ID>/edit
    // Planilla: "Catalogo Drops — Pesca (datos del sitio)"
    id: '1Mp09AM1HVMh89w9H1ziBpJBXxpLcFrD9XF23sijmDCQ',

    // Nombres de las pestanas dentro de la planilla
    productsTab: 'productos',
    dropsTab: 'drops',

    // Cada cuantos segundos una pestana abierta vuelve a leer la planilla.
    // Si vendes algo durante un drop, el contador baja en la pantalla del
    // visitante sin que tenga que recargar.
    // Solo corre con la pestana a la vista: en segundo plano se pausa.
    refreshSeconds: 45,
  },

  /* ---------------- Stock ---------------- */
  stock: {
    // Multiplicador de display. En 1, el sitio muestra tal cual el numero de la
    // planilla: ahi se cargan las unidades ya infladas (80, 60, 50...) y se
    // bajan de a 10 por venta. Asi el numero real no queda escrito en ningun
    // lado, y la planilla es publica (su ID viaja en este mismo archivo).
    // Ponerlo en 10 delegaria la multiplicacion al sitio, pero entonces la
    // columna de stock de la planilla delataria el stock verdadero.
    defaultMultiplier: 1,

    // Cuando las unidades caen a este valor o menos -> "ultimas unidades".
    // Con las unidades infladas de a 10, 20 equivale a las ultimas 2 reales.
    lowStockThreshold: 20,

    // Mostrar el numero exacto de unidades o solo la barra + etiqueta
    showUnitCount: true,
  },

  /* ---------------- Formato ---------------- */
  locale: 'es-CO',
  currency: 'COP',
  timezone: 'America/Bogota',

  // Zona horaria en que se escriben las fechas de la planilla.
  // Colombia es -05:00 todo el ano (no tiene horario de verano).
  // Sin esto, "2026-09-10 19:00" se interpretaria en la zona de quien mira el
  // sitio y el drop abriria a distinta hora en cada pais.
  utcOffset: '-05:00',

  /* ---------------- Categorias ---------------- */
  // El `id` debe coincidir con la columna `categoria` del Sheet.
  categories: [
    { id: 'senuelos',   label: 'Señuelos'   },
    { id: 'varas',      label: 'Varas'      },
    { id: 'carreteles', label: 'Carreteles' },
  ],
};
