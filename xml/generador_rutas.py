import math
import xml.etree.ElementTree as ET
from pathlib import Path

class GeneradorRutas:
    def __init__(self, archivo_xml):
        self.base = Path(archivo_xml).resolve().parent
        self.arbol = ET.parse(archivo_xml)
        self.rutas = self.arbol.getroot().findall("ruta")

    def haversine(self, lat1, lon1, lat2, lon2):
        R = 6371000.0
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi, dlambda = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
        a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

    def ejecutar(self):
        for posicion, ruta in enumerate(self.rutas, start=1):
            puntos = self._procesar_puntos(ruta)
            self._generar_kml(posicion, ruta.findtext("nombre"), puntos)
            self._generar_svg(posicion, ruta.findtext("nombre"), puntos)

    def _procesar_puntos(self, ruta):
        puntos = []
        distancia_acumulada = 0.0
        prev_lat = prev_lon = None
        for hito in ruta.find("hitos").findall("hito"):
            coord = hito.find("coordenada")
            lat = float(coord.findtext("latitud"))
            lon = float(coord.findtext("longitud"))
            alt = float(coord.findtext("altitud"))

            if prev_lat is not None:
                distancia_acumulada += self.haversine(prev_lat, prev_lon, lat, lon)

            puntos.append({"nombre": hito.findtext("nombreHito"), "lat": lat, "lon": lon, "alt": alt, "dist": distancia_acumulada})
            prev_lat, prev_lon = lat, lon
        return puntos

    def _generar_kml(self, pos, nombre, puntos):
        coords = "\n".join([f"{p['lon']},{p['lat']},{p['alt']}" for p in puntos])
        contenido = f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
    <Document>
        <name>{self._escapar(nombre)}</name>
        <Placemark>
            <LineString>
                <tessellate>1</tessellate>
                <coordinates>{coords}</coordinates>
            </LineString>
        </Placemark>
    </Document>
</kml>"""
        (self.base / f"planimetria-ruta-{pos}.kml").write_text(contenido, encoding="utf-8")

    def _generar_svg(self, pos, nombre, puntos):
        w, h, m = 1000, 400, 60
        dists = [p["dist"] for p in puntos]
        alts = [p["alt"] for p in puntos]
        min_d, max_d = min(dists), max(dists)
        min_a, max_a = min(alts), max(alts) or 1

        def sx(d): return m + (d - min_d) / (max_d - min_d or 1) * (w - 2*m)
        def sy(a): return h - m - (a - min_a) / (max_a - min_a or 1) * (h - 2*m)

        poly = " ".join([f"{sx(p['dist'])},{sy(p['alt'])}" for p in puntos])

        contenido = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">
    <polyline points="{poly}" fill="none" stroke="red" stroke-width="2" />
    <text x="{w/2}" y="{m/2}" text-anchor="middle">{self._escapar(nombre)}</text>
</svg>"""
        (self.base / f"altimetria-ruta-{pos}.svg").write_text(contenido, encoding="utf-8")

    @staticmethod
    def _escapar(t): return (t or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

if __name__ == "__main__":
    GeneradorRutas(Path(__file__).with_name("rutas.xml")).ejecutar()