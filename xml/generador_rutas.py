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
        ancho, alto = 1100, 520
        margen_izquierdo, margen_derecho = 90, 55
        margen_superior, margen_inferior = 70, 105
        grafico_ancho = ancho - margen_izquierdo - margen_derecho
        grafico_alto = alto - margen_superior - margen_inferior
        base_y = alto - margen_inferior

        dists = [p["dist"] for p in puntos]
        alts = [p["alt"] for p in puntos]
        min_d, max_d = min(dists), max(dists)
        min_a, max_a = min(alts), max(alts)
        if min_a == max_a:
            min_a -= 1
            max_a += 1

        def sx(distancia):
            return margen_izquierdo + (distancia - min_d) / (max_d - min_d or 1) * grafico_ancho

        def sy(altitud):
            return base_y - (altitud - min_a) / (max_a - min_a) * grafico_alto

        puntos_linea = [(sx(p["dist"]), sy(p["alt"])) for p in puntos]
        puntos_perfil = " ".join(f"{x:.2f},{y:.2f}" for x, y in puntos_linea)
        puntos_cerrados = (
            f"{margen_izquierdo:.2f},{base_y:.2f} "
            + puntos_perfil
            + f" {margen_izquierdo + grafico_ancho:.2f},{base_y:.2f}"
        )

        lineas_grid = []
        etiquetas_ejes = []
        for paso in range(5):
            proporcion = paso / 4
            x = margen_izquierdo + proporcion * grafico_ancho
            distancia = min_d + proporcion * (max_d - min_d)
            lineas_grid.append(f'<line x1="{x:.2f}" y1="{margen_superior}" x2="{x:.2f}" y2="{base_y}" />')
            etiquetas_ejes.append(f'<text x="{x:.2f}" y="{base_y + 28}" text-anchor="middle">{distancia:.0f} m</text>')

            y = base_y - proporcion * grafico_alto
            altitud = min_a + proporcion * (max_a - min_a)
            lineas_grid.append(f'<line x1="{margen_izquierdo}" y1="{y:.2f}" x2="{margen_izquierdo + grafico_ancho}" y2="{y:.2f}" />')
            etiquetas_ejes.append(f'<text x="{margen_izquierdo - 14}" y="{y + 5:.2f}" text-anchor="end">{altitud:.0f} m</text>')

        marcadores = []
        for indice, punto in enumerate(puntos):
            x, y = puntos_linea[indice]
            nombre_hito = self._escapar(punto["nombre"])
            etiqueta_y = y - 18 if indice % 2 == 0 else y + 34
            if indice == 0:
                ancla = "start"
            elif indice == len(puntos) - 1:
                ancla = "end"
            else:
                ancla = "middle"
            marcadores.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="7" />')
            marcadores.append(f'<text x="{x:.2f}" y="{etiqueta_y:.2f}" text-anchor="{ancla}">{nombre_hito}</text>')
            marcadores.append(f'<text x="{x:.2f}" y="{base_y + 52}" text-anchor="middle">{indice + 1}</text>')

        contenido = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {ancho} {alto}" role="img" aria-label="Altimetría de {self._escapar(nombre)}">
    <title>Altimetría de {self._escapar(nombre)}</title>
    <desc>Perfil altimétrico con distancia horizontal en metros, altitud vertical en metros y nombres de los hitos.</desc>
    <rect x="0" y="0" width="{ancho}" height="{alto}" fill="#ffffff" />
    <text x="{ancho / 2:.2f}" y="34" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#004f59">{self._escapar(nombre)}</text>
    <g stroke="#d6dee2" stroke-width="1">
        {"".join(lineas_grid)}
    </g>
    <line x1="{margen_izquierdo}" y1="{base_y}" x2="{margen_izquierdo + grafico_ancho}" y2="{base_y}" stroke="#263238" stroke-width="2" />
    <line x1="{margen_izquierdo}" y1="{margen_superior}" x2="{margen_izquierdo}" y2="{base_y}" stroke="#263238" stroke-width="2" />
    <polygon points="{puntos_cerrados}" fill="#dff1ed" stroke="none" />
    <polyline points="{puntos_perfil}" fill="none" stroke="#006d75" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
    <g fill="#ffffff" stroke="#7a3b00" stroke-width="4">
        {"".join(marcadores[0::3])}
    </g>
    <g font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#1f2933">
        {"".join(marcadores[1::3])}
    </g>
    <g font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#7a3b00" font-weight="700">
        {"".join(marcadores[2::3])}
    </g>
    <g font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#1f2933">
        {"".join(etiquetas_ejes)}
    </g>
    <text x="{ancho / 2:.2f}" y="{alto - 20}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#1f2933">Distancia acumulada de la ruta en metros</text>
    <text x="24" y="{margen_superior + grafico_alto / 2:.2f}" transform="rotate(-90 24 {margen_superior + grafico_alto / 2:.2f})" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#1f2933">Altitud en metros</text>
</svg>"""
        (self.base / f"altimetria-ruta-{pos}.svg").write_text(contenido, encoding="utf-8")

    @staticmethod
    def _escapar(t): return (t or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

if __name__ == "__main__":
    GeneradorRutas(Path(__file__).with_name("rutas.xml")).ejecutar()
