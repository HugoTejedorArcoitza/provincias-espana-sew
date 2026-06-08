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
                nombre: rutaXML.children("nombre").text(),
                tipo: rutaXML.children("tipo").text(),
                medio: rutaXML.children("transporte").text(),
                duracion: rutaXML.children("duracion").text(),
                descripcion: rutaXML.children("descripcion").text(),
                kml: rutaXML.children("planimetria").text(),
                svg: rutaXML.children("altimetria").text(),
                hitos: [],
                referencias: []
            };

            const inicio = rutaXML.children("coordenada");
            ruta.inicio = {
                lat: parseFloat(inicio.children("latitud").text()),
                lng: parseFloat(inicio.children("longitud").text())
            };

            rutaXML.find("hitos hito").each((_, hitoNodo) => {
                const hitoXML = $(hitoNodo);
                const coords = hitoXML.children("coordenada");
                ruta.hitos.push({
                    nombre: hitoXML.children("nombreHito").text(),
                    descripcion: hitoXML.children("descripcionHito").text(),
                    distancia: hitoXML.children("distanciaAnterior").text() + " " + hitoXML.children("distanciaAnterior").attr("unidades"),
                    lat: parseFloat(coords.children("latitud").text()),
                    lng: parseFloat(coords.children("longitud").text()),
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
            const item = $("<li>").html(`<strong>${hito.nombre}</strong>: ${hito.descripcion}. <em>(Distancia: ${hito.distancia})</em>`);
            if(hito.fotos.length > 0) {
                item.append($("<br>"));
                item.append($("<img>").attr({ src: "multimedia/" + hito.fotos[0], alt: `Foto de ${hito.nombre}` }));
            }
            listaHitos.append(item);
        });
        articulo.append(listaHitos);

        articulo.append($("<h4>").text(`Planimetría (${ruta.kml})`));
        const contenedorFiguraMapa = $("<figure>");
        const contenedorMapa = $("<div>").attr({ role: "application", 'aria-label': `Mapa de la ruta ${ruta.nombre}` });
        contenedorFiguraMapa.append(contenedorMapa);
        articulo.append(contenedorFiguraMapa);

        articulo.append($("<h4>").text(`Altimetría (${ruta.svg})`));
        const contenedorSvg = $("<figure>");
        articulo.append(contenedorSvg);

        this.contenedor.append(articulo);

        this.mapasPendientes.push({ ruta: ruta, nodo: contenedorMapa[0] });
        this.cargarSvg(ruta.svg, contenedorSvg);
    }

    cargarGoogleMapsAPI() {
        window.initGoogleMaps = () => {
            this.renderizarMapasPendientes();
        };

        if (window.google && window.google.maps) {
            if (typeof window.initGoogleMaps === 'function') {
                window.initGoogleMaps();
            } else {
                this.renderizarMapasPendientes();
            }
            return;
        }


        const apiKey = window.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            console.error('Error crítico: No se detectó ninguna Google Maps API Key en window.GOOGLE_MAPS_API_KEY.');
            return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=initGoogleMaps`;
        script.async = true;
        script.defer = true;
        script.onerror = () => console.error('No se pudo cargar la librería de Google Maps.');
        document.head.appendChild(script);
    }

    renderizarMapasPendientes() {
        this.mapasPendientes.forEach(item => {
            this.renderizarMapaGoogle(item.ruta, item.nodo);
        });
        this.mapasPendientes = [];
    }

    renderizarMapaGoogle(ruta, nodoDOMMapa) {
            // 1. Aseguramos que el nodo sea un objeto válido antes de instanciar
            if (!nodoDOMMapa) return;

            // 2. Definición limpia del mapa
            const mapa = new google.maps.Map(nodoDOMMapa, {
                zoom: 14,
                center: { lat: ruta.inicio.lat, lng: ruta.inicio.lng },
                mapTypeId: 'terrain'
            });

            // 3. Marcador de inicio
            new google.maps.Marker({
                position: { lat: ruta.inicio.lat, lng: ruta.inicio.lng },
                map: mapa,
                title: `Inicio: ${ruta.nombre}`
            });

            // 4. AJAX robusto para el KML
            $.ajax({
                url: `xml/${ruta.kml}`,
                dataType: "xml",
                success: (kml) => {
                    // Usamos una lógica de extracción más permisiva
                    const coordsNode = kml.querySelector("coordinates");
                    if (!coordsNode) return;

                    const coordsText = coordsNode.textContent.trim();
                    const path = coordsText.split(/\s+/).map(p => {
                        const [lng, lat] = p.split(",");
                        return { lat: parseFloat(lat), lng: parseFloat(lng) };
                    }).filter(p => !isNaN(p.lat));

                    // Dibujar la línea
                    new google.maps.Polyline({
                        path: path,
                        strokeColor: '#d60000',
                        strokeOpacity: 0.8,
                        strokeWeight: 5,
                        map: mapa
                    });

                    // Ajustar vista
                    const bounds = new google.maps.LatLngBounds();
                    path.forEach(p => bounds.extend(p));
                    mapa.fitBounds(bounds);
                },
                error: (xhr, status, error) => {
                    console.error("Fallo al cargar KML:", error);
                    // Inyectamos el error semántico para cumplir la Regla 6
                    $(nodoDOMMapa).append("<p><strong>Error: Planimetría no disponible.</strong></p>");
                }
            });
        }

    cargarSvg(archivoSvg, contenedorJQuerySvg) {
        $.ajax({
            url: `xml/${archivoSvg}`,
            dataType: "text",
            success: (svgXml) => contenedorJQuerySvg.html(svgXml),
            error: () => contenedorJQuerySvg.html("<p>No se encontró el archivo de altimetría.</p>")
        });
    }
}

$(() => {
    new GestorRutasTuristicas().iniciar();
});
