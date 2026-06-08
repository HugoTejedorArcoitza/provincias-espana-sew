"use strict";

class GestorRutasTuristicas {
    constructor() {
        this.rutas = [];
        this.contenedor = $("main section").first();
        this.mapasPendientes = [];
    }

    iniciar() {
        this.cargarDatosXML();
    }

    cargarDatosXML() {
        $.ajax({
            url: "xml/rutas.xml",
            dataType: "xml",
            success: (xml) => this.procesarXML(xml),
            error: () => this.contenedor.append($("<p>").text("Error crítico: No se pudo cargar el archivo rutas.xml."))
        });
    }

    procesarXML(xml) {
        this.contenedor.find("article").remove();
        this.contenedor.find("p:contains('Cargando')").remove();

        $(xml).find("ruta").each((indice, nodo) => {
            const rutaXML = $(nodo);
            const ruta = {
                nombre:      rutaXML.children("nombre").text(),
                tipo:        rutaXML.children("tipo").text(),
                medio:       rutaXML.children("transporte").text(),
                duracion:    rutaXML.children("duracion").text(),
                descripcion: rutaXML.children("descripcion").text(),
                kml:         rutaXML.children("planimetria").text(),
                svg:         rutaXML.children("altimetria").text(),
                hitos:       [],
                referencias: []
            };

            const inicio = rutaXML.children("coordenada");
            ruta.inicio = {
                lat: parseFloat(inicio.children("latitud").text()),
                lng: parseFloat(inicio.children("longitud").text())
            };

            rutaXML.find("hitos hito").each((_, hitoNodo) => {
                const hitoXML = $(hitoNodo);
                const coords  = hitoXML.children("coordenada");
                ruta.hitos.push({
                    nombre:      hitoXML.children("nombreHito").text(),
                    descripcion: hitoXML.children("descripcionHito").text(),
                    distancia:   hitoXML.children("distanciaAnterior").text() + " " +
                                 hitoXML.children("distanciaAnterior").attr("unidades"),
                    lat:  parseFloat(coords.children("latitud").text()),
                    lng:  parseFloat(coords.children("longitud").text()),
                    fotos: hitoXML.find("galeriaFotos foto").map((_, f) => $(f).text()).get()
                });
            });

            this.rutas.push(ruta);
            this.construirArticulo(ruta);
        });

        this.cargarGoogleMapsAPI();
    }

    construirArticulo(ruta) {
        const articulo = $("<article>");
        articulo.append($("<h3>").text(ruta.nombre));
        articulo.append($("<p>").text(ruta.descripcion));

        const lista = $("<ul>");
        lista.append($("<li>").text(`Tipo de ruta: ${ruta.tipo}`));
        lista.append($("<li>").text(`Transporte: ${ruta.medio}`));
        lista.append($("<li>").text(`Duración: ${ruta.duracion}`));
        articulo.append(lista);

        articulo.append($("<h4>").text("Puntos de interés (Hitos)"));
        const listaHitos = $("<ol>");
        ruta.hitos.forEach(hito => {
            const item = $("<li>").html(
                `<strong>${hito.nombre}</strong>: ${hito.descripcion}. <em>(Distancia: ${hito.distancia})</em>`
            );
            if (hito.fotos.length > 0) {
                item.append($("<br>"));
                item.append($("<img>").attr({ src: "multimedia/" + hito.fotos[0], alt: `Foto de ${hito.nombre}` }));
            }
            listaHitos.append(item);
        });
        articulo.append(listaHitos);

        // --- Planimetría ---
        articulo.append($("<h4>").text(`Planimetría (${ruta.kml})`));
        const figMapa      = $("<figure>");
        const contenedorMapa = $("<div>").attr({
            role:        "application",
            "aria-label": `Mapa de la ruta ${ruta.nombre}`
        });
        figMapa.append(contenedorMapa);
        articulo.append(figMapa);

        // --- Altimetría ---
        articulo.append($("<h4>").text(`Altimetría (${ruta.svg})`));
        const figSvg = $("<figure>");
        articulo.append(figSvg);

        this.contenedor.append(articulo);

        this.mapasPendientes.push({ ruta: ruta, nodo: contenedorMapa[0] });
        this.cargarSvg(ruta.svg, figSvg);
    }

    cargarGoogleMapsAPI() {
        // El callback global que invocará la API una vez descargada
        window.initGoogleMaps = () => this.renderizarMapasPendientes();

        // Si la API ya estaba cargada (p.ej. recarga parcial), renderizamos directamente
        if (window.google && window.google.maps) {
            this.renderizarMapasPendientes();
            return;
        }

        const apiKey = window.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            console.error("Error crítico: No se detectó ninguna Google Maps API Key en window.GOOGLE_MAPS_API_KEY.");
            return;
        }

        const script = document.createElement("script");
        script.src     = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=initGoogleMaps`;
        script.async   = true;
        script.defer   = true;
        script.onerror = () => console.error("No se pudo cargar la librería de Google Maps.");
        document.head.appendChild(script);
    }

    renderizarMapasPendientes() {
        this.mapasPendientes.forEach(item => this.renderizarMapaGoogle(item.ruta, item.nodo));
        this.mapasPendientes = [];
    }

    renderizarMapaGoogle(ruta, nodoDOMMapa) {
        if (!nodoDOMMapa) return;

        const mapa = new google.maps.Map(nodoDOMMapa, {
            zoom:      14,
            center:    { lat: ruta.inicio.lat, lng: ruta.inicio.lng },
            mapTypeId: "terrain"
        });

        new google.maps.Marker({
            position: { lat: ruta.inicio.lat, lng: ruta.inicio.lng },
            map:      mapa,
            title:    `Inicio: ${ruta.nombre}`
        });

        $.ajax({
            url:      `xml/${ruta.kml}`,
            dataType: "xml",
            success: (kml) => {
                /*
                 * CORRECCIÓN CLAVE: el KML lleva xmlns="http://www.opengis.net/kml/2.2"
                 * como espacio de nombres por defecto. querySelector("coordinates") falla
                 * en ese caso porque el motor CSS no resuelve nombres sin prefijo contra
                 * elementos con espacio de nombres. getElementsByTagName() busca solo por
                 * nombre local ignorando el espacio de nombres, por lo que funciona siempre.
                 */
                const nodos = kml.getElementsByTagName("coordinates");
                if (!nodos || nodos.length === 0) {
                    console.warn(`KML de "${ruta.nombre}": no se encontró el elemento <coordinates>.`);
                    return;
                }

                const texto = nodos[0].textContent.trim();
                const path  = texto
                    .split(/\s+/)
                    .filter(tramo => tramo.length > 0)
                    .map(tramo => {
                        // Formato KML: longitud,latitud[,altitud]
                        const partes = tramo.split(",");
                        return { lng: parseFloat(partes[0]), lat: parseFloat(partes[1]) };
                    })
                    .filter(punto => !isNaN(punto.lat) && !isNaN(punto.lng));

                if (path.length === 0) return;

                new google.maps.Polyline({
                    path:          path,
                    strokeColor:   "#d60000",
                    strokeOpacity: 0.8,
                    strokeWeight:  5,
                    map:           mapa
                });

                // Ajustar la vista para que englobe toda la ruta
                const bounds = new google.maps.LatLngBounds();
                path.forEach(punto => bounds.extend(punto));
                mapa.fitBounds(bounds);
            },
            error: (xhr, status, error) => {
                console.error(`Fallo al cargar KML de "${ruta.nombre}":`, error);
                $(nodoDOMMapa).append($("<p>").html("<strong>Error: Planimetría no disponible.</strong>"));
            }
        });
    }

    cargarSvg(archivoSvg, contenedorJQuerySvg) {
        $.ajax({
            url:      `xml/${archivoSvg}`,
            dataType: "text",
            success:  (svgXml) => contenedorJQuerySvg.html(svgXml),
            error:    () => contenedorJQuerySvg.html("<p>No se encontró el archivo de altimetría.</p>")
        });
    }
}

$(() => {
    new GestorRutasTuristicas().iniciar();
});