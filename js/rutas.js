"use strict";

class GestorRutasTuristicas {
    constructor() {
        // Regla 1 y 4: Encapsulamiento y uso de jQuery
        this.contenedor = $("main section").first();
        if (this.contenedor.length === 0) {
            this.contenedor = $("main");
        }
    }

    iniciar() {
        this.cargarDatosXML();
    }

    cargarDatosXML() {
        // Regla 4 y 6: Uso estricto de $.ajax con control de errores
        $.ajax({
            url: "xml/rutas.xml",
            dataType: "xml",
            success: (xml) => this.procesarXML(xml),
            error: () => this.inyectarErrorDOM(this.contenedor, "Error crítico: No se pudo cargar rutas.xml.")
        });
    }

    procesarXML(xml) {
        $(xml).find("ruta").each((_, nodo) => {
            const ruta = $(nodo);
            const nombre = ruta.children("nombre").text();
            const archivoKml = ruta.children("planimetria").text();
            const archivoSvg = ruta.children("altimetria").text();

            // Regla 2: Nodos semánticos puros sin clases
            const article = $("<article>");
            article.append($("<h3>").text(nombre));

            // Planimetría (KML)
            article.append($("<h4>").text("Planimetría (KML)"));
            const divMapa = $("<div>"); // Excepción permitida por rúbrica para mapas
            article.append(divMapa);

            // Altimetría (SVG)
            article.append($("<h4>").text("Perfil Altimétrico (SVG)"));
            const figureSvg = $("<figure>");
            article.append(figureSvg);

            this.contenedor.append(article);

            // Delegamos la carga de archivos externos a métodos asíncronos
            this.cargarKML(divMapa[0], archivoKml, article);
            this.cargarSVG(figureSvg, archivoSvg, article);
        });
    }

    cargarKML(nodoDOM, archivoKml, nodoPadreError) {
        // Leemos el KML nosotros mismos, cumpliendo la rúbrica y esquivando el bloqueo de Azure
        $.ajax({
            url: "xml/" + archivoKml,
            dataType: "xml",
            success: (kml) => this.dibujarRutaDesdeKML(nodoDOM, kml),
            error: () => this.inyectarErrorDOM(nodoPadreError, `Error de red: Imposible cargar el archivo de planimetría (${archivoKml}).`)
        });
    }

    dibujarRutaDesdeKML(nodoDOM, kml) {
        const mapa = new google.maps.Map(nodoDOM, {
            zoom: 12,
            center: { lat: 37.3891, lng: -5.9845 },
            mapTypeId: "terrain"
        });

        // Buscamos la etiqueta <coordinates> dentro del KML real
        const bloqueCoordenadas = $(kml).find("coordinates").text().trim();
        if (!bloqueCoordenadas) return;

        const rutaCoordenadas = [];
        const limites = new google.maps.LatLngBounds();

        // Separamos los pares de coordenadas generados por Python
        const pares = bloqueCoordenadas.split(/\s+/);

        pares.forEach(par => {
            const [lng, lat] = par.split(",");
            if (lat && lng) {
                const posicion = { lat: parseFloat(lat), lng: parseFloat(lng) };
                rutaCoordenadas.push(posicion);
                limites.extend(posicion); // Expandimos los límites del mapa
            }
        });

        // Trazamos la línea exacta del KML
        new google.maps.Polyline({
            path: rutaCoordenadas,
            geodesic: true,
            strokeColor: "#004f59", // Ajustado a los colores de tu proyecto
            strokeOpacity: 0.9,
            strokeWeight: 5,
            map: mapa
        });

        // Auto-centramos el mapa para que abarque toda la ruta
        mapa.fitBounds(limites);
    }

    cargarSVG(nodoFigure, archivoSvg, nodoPadreError) {
        $.ajax({
            url: "xml/" + archivoSvg,
            dataType: "text", // El SVG se procesa como texto puro para inyectarlo
            success: (svg) => {
                nodoFigure.append(svg);
            },
            error: () => this.inyectarErrorDOM(nodoPadreError, `Error de red: Imposible cargar el archivo de altimetría (${archivoSvg}).`)
        });
    }

    inyectarErrorDOM(nodoDestino, mensaje) {
        // Regla 6: Control de errores visible en el DOM usando etiquetas semánticas
        const parrafoError = $("<p>");
        const textoFuerte = $("<strong>").text(mensaje);
        parrafoError.append(textoFuerte);
        nodoDestino.append(parrafoError);
    }
}

// Inicialización limpia
$(() => {
    new GestorRutasTuristicas().iniciar();
});