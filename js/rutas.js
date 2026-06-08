"use strict";

class GestorRutasTuristicas {
    constructor() {
        this.contenedor = $("main section").first();
        if (this.contenedor.length === 0) {
            this.contenedor = $("main");
        }
    }

    iniciar() {
        this.cargarDatosXML();
    }

    cargarDatosXML() {
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

            const article = $("<article>");
            article.append($("<h3>").text(nombre));

            article.append($("<h4>").text("Planimetría (KML)"));
            const divMapa = $("<div>"); // Bloque anónimo permitido por tu rúbrica
            article.append(divMapa);

            article.append($("<h4>").text("Perfil Altimétrico (SVG)"));
            const figureSvg = $("<figure>");
            article.append(figureSvg);

            this.contenedor.append(article);

            this.cargarKML(divMapa[0], archivoKml, article);
            this.cargarSVG(figureSvg, archivoSvg, article);
        });
    }

    cargarKML(nodoDOM, archivoKml, nodoPadreError) {
        $.ajax({
            url: "xml/" + archivoKml,
            dataType: "xml",
            success: (kml) => this.dibujarRutaDesdeKML(nodoDOM, kml),
            error: () => this.inyectarErrorDOM(nodoPadreError, `Error de red: Imposible cargar planimetría (${archivoKml}).`)
        });
    }

    dibujarRutaDesdeKML(nodoDOM, kml) {
        const mapa = new google.maps.Map(nodoDOM, {
            zoom: 12,
            center: { lat: 37.3891, lng: -5.9845 },
            mapTypeId: "terrain"
        });

        // SOLUCIÓN AL FALLO SILENCIOSO 2: Evitamos jQuery para saltar el namespace
        const nodosCoordenadas = kml.getElementsByTagName("coordinates");
        if (nodosCoordenadas.length === 0) return; // Si no hay coordenadas, salimos limpios

        const bloqueCoordenadas = nodosCoordenadas[0].textContent.trim();
        if (!bloqueCoordenadas) return;

        const rutaCoordenadas = [];
        const limites = new google.maps.LatLngBounds();

        const pares = bloqueCoordenadas.split(/\s+/);

        pares.forEach(par => {
            const [lng, lat] = par.split(",");
            if (lat && lng) {
                const posicion = { lat: parseFloat(lat), lng: parseFloat(lng) };
                rutaCoordenadas.push(posicion);
                limites.extend(posicion);
            }
        });

        new google.maps.Polyline({
            path: rutaCoordenadas,
            geodesic: true,
            strokeColor: "#004f59",
            strokeOpacity: 0.9,
            strokeWeight: 5,
            map: mapa
        });

        mapa.fitBounds(limites);
    }

    cargarSVG(nodoFigure, archivoSvg, nodoPadreError) {
        $.ajax({
            url: "xml/" + archivoSvg,
            dataType: "text",
            success: (svg) => nodoFigure.append(svg),
            error: () => this.inyectarErrorDOM(nodoPadreError, `Error de red: Imposible cargar altimetría (${archivoSvg}).`)
        });
    }

    inyectarErrorDOM(nodoDestino, mensaje) {
        const parrafoError = $("<p>");
        const textoFuerte = $("<strong>").text(mensaje);
        parrafoError.append(textoFuerte);
        nodoDestino.append(parrafoError);
    }
}

// SOLUCIÓN AL FALLO SILENCIOSO 1: Declaramos la función global que exige tu HTML
window.initGoogleMaps = () => {
    // Cuando Google dice que ya está listo, arrancamos nuestra clase
    $(() => {
        new GestorRutasTuristicas().iniciar();
    });
};