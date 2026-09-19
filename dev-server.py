"""Servidor estatico para desarrollo, sin cache.

`python -m http.server` manda Last-Modified y deja que el navegador cachee por
heuristica: al editar un .js seguis viendo el viejo hasta un refresco forzado.
Esto sirve todo con no-store para que cada recarga traiga lo ultimo.
Solo para desarrollo local; en GitHub Pages no se usa.
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # menos ruido en la consola


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
    print(f"Catalogo en http://localhost:{port}  (sin cache)")
    ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
