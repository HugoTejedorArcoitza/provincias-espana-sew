"use strict";

class GestorRutasTuristicas {
    constructor() {
        this.contenedor = $("main section").first();
    }

    iniciar() {
        this.cargarDatosXML();
    }

    cargarDatosXML() {
        $.ajax({
            url: "xml/rutas.xml",
            dataType: "xml",
            success: (xml) => this.procesarXML(xml),
            error: () => this.contenedor.append($("<p>").text("Error crítico: No se pudo cargar rutas.xml."))
        });
    }

    procesarXML(xml) {
        $(xml).find("ruta").each((i, nodo) => {
            const ruta = $(nodo);
            const nombre = ruta.children("nombre").text();
            const archivoKml = ruta.children("planimetria").text();

            const article = $("<article>");
            article.append($("<h3>").text(nombre));

            // Excepción aplicada: Uso permitido de <div> para mapas dinámicos
            const divMapa = $("<div>");
            article.append(divMapa);
            this.contenedor.append(article);

            this.inicializarMapa(divMapa[0], archivoKml);
        });
    }

    inicializarMapa(contenedor, archivoKml) {
        const mapa = new google.maps.Map(contenedor, {
            zoom: 12,
            center: { lat: 37.3891, lng: -5.9845 },
            mapTypeId: "terrain"
        });

        const lectorKml = new google.maps.KmlLayer({
            url: window.location.origin + "/xml/" + archivoKml,
            map: mapa,
            preserveViewport: false
        });

        // REGLA 6 APLICADA A KML: Si falla la lectura en local, mostramos el error semántico
        google.maps.event.addListenerOnce(lectorKml, 'status_changed', () => {
            const estado = lectorKml.getStatus();
            if (estado !== 'OK') {
                $(contenedor).after($("<p>").html(`<strong>Error KML (${estado}):</strong> El archivo ${archivoKml} no pudo ser cargado por Google. Recuerda que para KmlLayer el archivo debe estar desplegado en un servidor público.`));
            }
        });

        google.maps.event.addListenerOnce(lectorKml, 'defaultviewport_changed', () => {
            const limites = lectorKml.getDefaultViewport();
            mapa.fitBounds(limites);
        });
    }
}

$(() => {
    new GestorRutasTuristicas().iniciar();
});