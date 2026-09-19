"""Prepara fotos de producto para el catálogo.

Las fotos de señuelo vienen sobre fondo blanco y con lienzos larguísimos
(hasta 4,7:1) llenos de margen vacío. Metidas tal cual en la grilla se ven
recortadas y con un bloque blanco encima de un sitio oscuro.

Este script hace tres cosas:
  1. Vuelve transparente el fondo blanco, pero SOLO el que toca los bordes.
     Un umbral global rompería los señuelos de cuerpo perla o blanco, como el
     Glass Ghost: sus blancos internos tienen que sobrevivir.
  2. Recorta al contenido real, para que el señuelo llene el cuadro en vez de
     nadar en margen vacío.
  3. Guarda PNG (el JPG no tiene canal alfa).

Uso:
    python preparar-imagenes.py assets/products/*.jpg
    python preparar-imagenes.py assets/products/foo.jpg --umbral 30
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

SENTINEL = (255, 0, 255)   # magenta: no aparece en fotos de señuelo
BORDE = 4                  # marco temporal que garantiza fondo conectado
MARGEN = 0.03              # aire alrededor del recorte, como fracción del lado
MAX_ANCHO = 760            # la grilla nunca pasa de ~380 px: esto cubre retina
COLORES = 200              # paleta: baja el peso ~85% sin banding visible


def quitar_fondo(img: Image.Image, umbral: int) -> Image.Image:
    """Marca el fondo con flood fill desde las cuatro esquinas."""
    ancho, alto = img.size
    lienzo = Image.new("RGB", (ancho + BORDE * 2, alto + BORDE * 2), (255, 255, 255))
    lienzo.paste(img, (BORDE, BORDE))

    # Desde cada esquina: cubre fondos partidos en regiones separadas.
    for esquina in [(0, 0), (lienzo.width - 1, 0),
                    (0, lienzo.height - 1), (lienzo.width - 1, lienzo.height - 1)]:
        if lienzo.getpixel(esquina) != SENTINEL:
            ImageDraw.floodfill(lienzo, esquina, SENTINEL, thresh=umbral)

    lienzo = lienzo.crop((BORDE, BORDE, BORDE + ancho, BORDE + alto))

    rgba = lienzo.convert("RGBA")
    pixeles = rgba.load()
    original = img.convert("RGB").load()
    for y in range(alto):
        for x in range(ancho):
            if pixeles[x, y][:3] == SENTINEL:
                pixeles[x, y] = (255, 255, 255, 0)
            else:
                # Devolvemos el color original: el flood fill pudo teñir bordes.
                pixeles[x, y] = original[x, y] + (255,)
    return rgba


def recortar(img: Image.Image) -> Image.Image:
    caja = img.getchannel("A").getbbox()
    if not caja:
        return img
    x0, y0, x1, y1 = caja
    aire_x = int((x1 - x0) * MARGEN)
    aire_y = int((y1 - y0) * MARGEN)
    return img.crop((
        max(0, x0 - aire_x), max(0, y0 - aire_y),
        min(img.width, x1 + aire_x), min(img.height, y1 + aire_y),
    ))


def procesar(ruta: Path, umbral: int) -> None:
    original = Image.open(ruta).convert("RGB")
    limpia = recortar(quitar_fondo(original, umbral))

    # Un PNG con alfa a 1600 px pesa cientos de KB y en la grilla nunca se ve
    # a más de ~380 px. Reducir + cuantizar lo deja en ~40 KB sin banding.
    if limpia.width > MAX_ANCHO:
        alto = round(limpia.height * MAX_ANCHO / limpia.width)
        limpia = limpia.resize((MAX_ANCHO, alto), Image.LANCZOS)

    # FASTOCTREE es el único método de quantize que conserva el canal alfa.
    limpia = limpia.quantize(colors=COLORES, method=Image.FASTOCTREE)

    salida = ruta.with_suffix(".png")
    limpia.save(salida, "PNG", optimize=True)

    w, h = limpia.size
    print(f"  {ruta.name:28} {original.size[0]}x{original.size[1]}"
          f"  ->  {salida.name:28} {w}x{h}  ({w/h:.2f}:1)  {salida.stat().st_size//1024} KB")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    umbral = 25
    if "--umbral" in sys.argv:
        umbral = int(sys.argv[sys.argv.index("--umbral") + 1])

    if not args:
        print(__doc__)
        sys.exit(1)

    print(f"Umbral de fondo: {umbral}")
    for patron in args:
        for ruta in sorted(Path().glob(patron)) or [Path(patron)]:
            if ruta.exists():
                procesar(ruta, umbral)
