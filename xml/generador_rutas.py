import math
import xml.etree.ElementTree as ET
from pathlib import Path

class GeneradorRutas:
    def __init__(self, archivo_xml):
        self.base = Path(archivo_xml).resolve().parent
        self.arbol = ET.parse(archivo_xml)
        self.rutas = self.arbol.getroot().findall("ruta")

    def ejecutar(self):
        for posicion, ruta in enumerate(self.rutas, start=1):
            puntos = self._puntos(ruta)
            self._crear_kml(posicion, ruta.findtext("nombre"), puntos)
            self._crear_svg(posicion, ruta.findtext("nombre"), puntos)

    def _puntos(self, ruta):
        puntos = []
        distancia = 0.0
        for hito in ruta.find("hitos").findall("hito"):
            distancia += float(hito.findtext("distanciaAnterior"))
            coordenada = hito.find("coordenada")
            puntos.append({
                "nombre": hito.findtext("nombreHito"),
                "longitud": float(coordenada.findtext("longitud")),
                "latitud": float(coordenada.findtext("latitud")),
                "altitud": float(coordenada.findtext("altitud")),
                "distancia": distancia,
            })
        return puntos

    def _crear_kml(self, posicion, nombre, puntos):
        coordenadas = " ".join(
            f'{p["longitud"]},{p["latitud"]},{p["altitud"]}' for p in puntos
        )
        marcas = "\n".join(
            f"""        <Placemark>
            <name>{self._escapar(p["nombre"])}</name>
            <Point><coordinates>{p["longitud"]},{p["latitud"]},{p["altitud"]}</coordinates></Point>
        </Placemark>"""
            for p in puntos
        )
        contenido = f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
    <Document>
        <name>{self._escapar(nombre)}</name>
        <Placemark>
            <name>{self._escapar(nombre)}</name>
            <LineString>
                <tessellate>1</tessellate>
                <coordinates>{coordenadas}</coordinates>
            </LineString>
        </Placemark>
{marcas}
    </Document>
</kml>
"""
        (self.base / f"planimetria-ruta-{posicion}.kml").write_text(contenido, encoding="utf-8")

    def _crear_svg(self, posicion, nombre, puntos):
        ancho = 1200
        alto = 450
        margen_lateral = 120
        margen_superior = 100
        margen_inferior = 60

        max_distancia = max(p["distancia"] for p in puntos) or 1
        min_altitud = min(p["altitud"] for p in puntos)
        max_altitud = max(p["altitud"] for p in puntos)
        rango_altitud = max(max_altitud - min_altitud, 1)

        coordenadas = []
        etiquetas = []

        for idx, punto in enumerate(puntos):
            x = margen_lateral + (punto["distancia"] / max_distancia) * (ancho - 2 * margen_lateral)
            y = alto - margen_inferior - ((punto["altitud"] - min_altitud) / rango_altitud) * (alto - margen_superior - margen_inferior)
            coordenadas.append(f"{x:.2f},{y:.2f}")

            # TRUCO 1: Anclaje inteligente según la posición del punto
            if idx == 0:
                anclaje = 'text-anchor="start"'
                offset_x = 8  # Ligeramente desplazado a la derecha
            elif idx == len(puntos) - 1:
                anclaje = 'text-anchor="end"'
                offset_x = -8 # Ligeramente desplazado a la izquierda
            else:
                anclaje = 'text-anchor="middle"'
                offset_x = 0  # Centrado perfecto

            # TRUCO 2: Alternar la altura (zigzag) para que los textos nunca se pisen
            offset_y = 15 if idx % 2 == 0 else 35
            y_texto = max(20, y - offset_y)

            # Generamos el texto completamente en horizontal sin rotaciones raras
            etiquetas.append(
                f'<text x="{(x + offset_x):.2f}" y="{y_texto:.2f}" {anclaje}>{self._escapar(punto["nombre"])}</text>'
            )

        base = f"{margen_lateral},{alto - margen_inferior} " + " ".join(coordenadas) + f" {ancho - margen_lateral},{alto - margen_inferior} {margen_lateral},{alto - margen_inferior}"

        marcas = "\n        ".join(
            f'<circle cx="{par.split(",")[0]}" cy="{par.split(",")[1]}" r="5" fill="#004f59" />' for par in coordenadas
        )

        contenido = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {ancho} {alto}" role="img" aria-label="Altimetría de {self._escapar(nombre)}">
    <title>Altimetría de {self._escapar(nombre)}</title>
    <desc>Polilínea cerrada con escala horizontal en metros y escala vertical en metros.</desc>
    <rect x="0" y="0" width="{ancho}" height="{alto}" fill="#ffffff" />
    
    <line x1="{margen_lateral}" y1="{alto - margen_inferior}" x2="{ancho - margen_lateral}" y2="{alto - margen_inferior}" stroke="#263238" stroke-width="2" />
    <line x1="{margen_lateral}" y1="{margen_superior}" x2="{margen_lateral}" y2="{alto - margen_inferior}" stroke="#263238" stroke-width="2" />
    
    <text x="{ancho / 2}" y="{alto - 20}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#263238">Distancia acumulada: {math.floor(max_distancia)} m</text>
    <text x="35" y="{alto / 2}" transform="rotate(-90 35 {alto / 2})" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#263238">Altitud: {min_altitud:.0f}-{max_altitud:.0f} m</text>
    
    <polyline points="{base}" fill="#dff1ed" stroke="#006d75" stroke-width="4" />
    {marcas}
    <g font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#1f2933">
        {"\n        ".join(etiquetas)}
    </g>
</svg>
"""
        (self.base / f"altimetria-ruta-{posicion}.svg").write_text(contenido, encoding="utf-8")

    @staticmethod
    def _escapar(texto):
        return (texto or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


if __name__ == "__main__":

    GeneradorRutas(Path(__file__).with_name("rutas.xml")).ejecutar()