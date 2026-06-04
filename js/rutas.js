"use strict";

class GestorRutasTuristicas {
    constructor() {
        this.rutas = [];
        this.contenedor = $("main section").first();
        this.mapasPendientes = []; // Guarda info para cuando cargue Google Maps
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

        // Una vez procesadas las rutas y creados los contenedores, cargamos la API
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
            // ELIMINADO width: "250". Se controlará mediante CSS.
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
    // ELIMINADO: this.contenedor.append($("<hr>")); -> Se gestiona vía CSS en article
    
    this.mapasPendientes.push({ ruta: ruta, nodo: contenedorMapa[0] });
    this.cargarSvg(ruta.svg, contenedorSvg);
}

    cargarGoogleMapsAPI() {
        // Callback global
        window.initGoogleMaps = () => {
            this.renderizarMapasPendientes();
        };

        // Evitamos recargar la API si ya existe
        if (window.google && window.google.maps) {
            // Si ya está cargada, llamamos directamente al callback
            if (typeof window.initGoogleMaps === 'function') {
                window.initGoogleMaps();
            } else {
                this.renderizarMapasPendientes();
            }
            return;
        }

        const script = document.createElement('script');
        // La clave puede proporcionarse desde la página principal como window.GOOGLE_MAPS_API_KEY
        const apiKey = window.GOOGLE_MAPS_API_KEY || 'AIzaSyAHT7iPZAtmwMJrAFCf4ljOPPTqGosKZgU';

        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=initGoogleMaps`;
        script.async = true;
        script.defer = true;
        // Añadimos manejo de error de carga
        script.onerror = () => console.error('No se pudo cargar la librería de Google Maps. Compruebe la clave API y la conectividad.');
        document.head.appendChild(script);
    }

    renderizarMapasPendientes() {
        this.mapasPendientes.forEach(item => {
            this.renderizarMapaGoogle(item.ruta, item.nodo);
        });
        // Limpiamos la lista
        this.mapasPendientes = [];
    }

    renderizarMapaGoogle(ruta, nodoDOMMapa) {
        // Esperamos a que el nodo esté visible y tenga tamaño para evitar fragmentación visual
        const waitForVisible = (node, timeout = 3000) => new Promise((resolve) => {
            const start = performance.now();
            const check = () => {
                const el = node;
                const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: el.offsetWidth, height: el.offsetHeight };
                const visible = (rect.width > 0 && rect.height > 0) && document.body.contains(el);
                if (visible) return resolve(true);
                if (performance.now() - start > timeout) return resolve(false);
                requestAnimationFrame(check);
            };
            check();
        });

        (async () => {
            const ok = await waitForVisible(nodoDOMMapa, 3000);
            if (!ok) {
                console.warn('Contenedor del mapa no es visible o no tiene tamaño. Intentando crear mapa de todas formas.');
            }

            // Inicializar mapa de Google
            const centro = { lat: ruta.inicio.lat, lng: ruta.inicio.lng };
            const mapa = new google.maps.Map(nodoDOMMapa, {
                zoom: 14,
                center: centro,
                mapTypeId: 'terrain'
            });

            // Marcador de inicio
            new google.maps.Marker({
                position: centro,
                map: mapa,
                title: `Inicio: ${ruta.nombre}`
            });

            // Marcadores de hitos
            ruta.hitos.forEach(hito => {
                if(!isNaN(hito.lat) && !isNaN(hito.lng)) {
                    new google.maps.Marker({
                        position: { lat: hito.lat, lng: hito.lng },
                        map: mapa,
                        title: hito.nombre
                    });
                }
            });

            // Cargar KML trazado (buscamos coordinates dentro del KML local)
            $.ajax({
                url: `xml/${ruta.kml}`,
                dataType: "xml",
                success: (kml) => {
                    let nodosCoords = kml.getElementsByTagNameNS("*", "coordinates");
                    if (nodosCoords.length === 0) nodosCoords = kml.getElementsByTagName("coordinates");

                    if (nodosCoords.length > 0) {
                        const textoCoords = nodosCoords[0].textContent.trim();
                        const coordsKml = textoCoords.split(/\s+/);
                        const trazado = [];
                        const bounds = new google.maps.LatLngBounds();

                        coordsKml.forEach(par => {
                            const partes = par.split(",");
                            if(partes.length >= 2) {
                                const p = { lat: parseFloat(partes[1]), lng: parseFloat(partes[0]) };
                                trazado.push(p);
                                bounds.extend(p);
                            }
                        });

                        const linea = new google.maps.Polyline({
                            path: trazado,
                            geodesic: true,
                            strokeColor: '#d60000',
                            strokeOpacity: 0.8,
                            strokeWeight: 5
                        });

                        linea.setMap(mapa);
                        mapa.fitBounds(bounds);

                        // Trigger resize inmeditamente tras ajustar bounds para evitar teselado
                        google.maps.event.addListenerOnce(mapa, 'idle', () => {
                            google.maps.event.trigger(mapa, 'resize');
                            // centrar de nuevo para evitar desplazamientos
                            if (trazado.length > 0) mapa.setCenter(trazado[0]);
                        });
                    }
                },
                error: () => console.warn(`No se pudo cargar KML: xml/${ruta.kml}`)
            });
        })();
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