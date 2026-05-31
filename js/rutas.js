"use strict";

class GestorRutasTuristicas {
    constructor() {
        this.rutas = [];
        this.contenedor = $("main section").first();
    }

    iniciar() {
            // Como Leaflet ya está cargado de forma segura en el HTML,
            // disparamos la lectura del XML directamente.
            this.cargarDatosXML();
        }

    cargarDatosXML() {
        // Obligatorio: uso de $.ajax (jQuery) encapsulado
        $.ajax({
            url: "xml/rutas.xml",
            dataType: "xml",
            success: (xml) => this.procesarXML(xml),
            error: () => this.contenedor.append($("<p>").text("Error crítico: No se pudo cargar el archivo rutas.xml."))
        });
    }

    procesarXML(xml) {
            this.contenedor.empty();

            $(xml).find("ruta").each((indice, nodo) => {
                const rutaXML = $(nodo);
                const ruta = {
                    id: indice,
                    nombre: rutaXML.children("nombre").text(),
                    tipo: rutaXML.children("tipo").text(),
                    medio: rutaXML.children("transporte").text(), // Tu XML usa <transporte>
                    duracion: rutaXML.children("duracion").text(),
                    descripcion: rutaXML.children("descripcion").text(),
                    kml: rutaXML.children("planimetria").text(),
                    svg: rutaXML.children("altimetria").text(),
                    hitos: [],
                    referencias: []
                };

                // Extracción de coordenadas de inicio (Tu XML usa <coordenada>)
                const inicio = rutaXML.children("coordenada");
                ruta.inicio = {
                    lat: parseFloat(inicio.children("latitud").text()),
                    lng: parseFloat(inicio.children("longitud").text())
                };

                // Extracción de hitos
                rutaXML.find("hitos hito").each((_, hitoNodo) => {
                    const hitoXML = $(hitoNodo);
                    // Tu XML usa <coordenada> dentro de hito
                    const coords = hitoXML.children("coordenada");
                    ruta.hitos.push({
                        nombre: hitoXML.children("nombreHito").text(),
                        descripcion: hitoXML.children("descripcionHito").text(),
                        // Tu XML usa <distanciaAnterior>
                        distancia: hitoXML.children("distanciaAnterior").text() + " " + hitoXML.children("distanciaAnterior").attr("unidades"),
                        lat: parseFloat(coords.children("latitud").text()),
                        lng: parseFloat(coords.children("longitud").text()),
                        // Tu XML usa <foto> dentro de <galeriaFotos>
                        fotos: hitoXML.find("galeriaFotos foto").map((_, f) => $(f).text()).get()
                    });
                });

                this.rutas.push(ruta);
                this.construirArticulo(ruta);
            });
        }

    construirArticulo(ruta) {
        const articulo = $("<article>");
        articulo.append($("<h3>").text(ruta.nombre));
        articulo.append($("<p>").text(ruta.descripcion));

        // Lista de datos principales
        const lista = $("<ul>");
        lista.append($("<li>").text(`Tipo de ruta: ${ruta.tipo}`));
        lista.append($("<li>").text(`Transporte: ${ruta.medio}`));
        lista.append($("<li>").text(`Duración: ${ruta.duracion}`));
        articulo.append(lista);

        // Hitos
        articulo.append($("<h4>").text("Puntos de interés (Hitos)"));
        const listaHitos = $("<ol>");
        ruta.hitos.forEach(hito => {
            const item = $("<li>").html(`<strong>${hito.nombre}</strong>: ${hito.descripcion}. <em>(Distancia: ${hito.distancia})</em>`);
            if(hito.fotos.length > 0) {
                item.append($("<br>"));
                item.append($("<img>").attr({ src: "multimedia/" + hito.fotos[0], alt: `Foto de ${hito.nombre}`, width: "250" }));
            }
            listaHitos.append(item);
        });
        articulo.append(listaHitos);

        // Contenedor del Mapa (Obligatorio un ID único para Leaflet)
        articulo.append($("<h4>").text(`Planimetría (${ruta.kml})`));
        const idMapa = `mapa-leaflet-${ruta.id}`;
        const divMapa = $("<div>").attr("id", idMapa).css({ width: "100%", height: "450px", marginBottom: "20px", zIndex: 1 });
        articulo.append(divMapa);

        // Contenedor del SVG
        articulo.append($("<h4>").text(`Altimetría (${ruta.svg})`));
        const divSvg = $("<div>").attr("id", `svg-${ruta.id}`);
        articulo.append(divSvg);

        this.contenedor.append(articulo);
        this.contenedor.append($("<hr>"));

        // Retrasamos la carga del mapa un milisegundo para asegurar que el DOM ha pintado el <div>
        setTimeout(() => {
            this.renderizarMapaLeafletYKml(ruta, idMapa);
            this.cargarSvg(ruta.svg, divSvg);
        }, 100);
    }

    renderizarMapaLeafletYKml(ruta, idContenedor) {
        // 1. Inicializar el mapa centrado en el inicio de la ruta
        const mapa = L.map(idContenedor).setView([ruta.inicio.lat, ruta.inicio.lng], 14);

        // 2. Cargar las teselas gratuitas de OpenStreetMap
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(mapa);

        // 3. Colocar chincheta en el inicio
        L.marker([ruta.inicio.lat, ruta.inicio.lng]).addTo(mapa)
            .bindPopup(`<b>Inicio:</b> ${ruta.nombre}`);

        // 4. Colocar chinchetas en los hitos
        ruta.hitos.forEach(hito => {
            if(!isNaN(hito.lat) && !isNaN(hito.lng)) {
                L.marker([hito.lat, hito.lng]).addTo(mapa)
                    .bindPopup(hito.nombre);
            }
        });

        // 5. Cargar el KML real usando jQuery y pintar la ruta
        $.ajax({
            url: `xml/${ruta.kml}`,
            dataType: "xml",
            success: (kml) => {
                let nodosCoords = kml.getElementsByTagNameNS("*", "coordinates");
                if (nodosCoords.length === 0) {
                    nodosCoords = kml.getElementsByTagName("coordinates");
                }

                if (nodosCoords.length > 0) {
                    const textoCoords = nodosCoords[0].textContent.trim();
                    const coordsKml = textoCoords.split(/\s+/);
                    const trazado = [];

                    coordsKml.forEach(par => {
                        const partes = par.split(",");
                        if(partes.length >= 2) {
                            // KML guarda como [Longitud, Latitud]. Leaflet necesita [Latitud, Longitud]
                            trazado.push([parseFloat(partes[1]), parseFloat(partes[0])]);
                        }
                    });



                    // Auto-ajustar el zoom para que la ruta completa encaje en la pantalla
                    // Dibujar la línea sobre el mapa
                    const linea = L.polyline(trazado, {color: '#d60000', weight: 5, opacity: 0.8}).addTo(mapa);

                    // Auto-ajustar el zoom SOLO si hay trazado
                    if (trazado.length > 0) {
                        mapa.fitBounds(linea.getBounds());
                    }
                }
            },
            error: () => console.error(`Error de red al cargar xml/${ruta.kml}`)
        });
    }

    cargarSvg(archivoSvg, divContenedor) {
        $.ajax({
            url: `xml/${archivoSvg}`,
            dataType: "text",
            success: (svgXml) => divContenedor.html(svgXml),
            error: () => divContenedor.html("<p>No se encontró el archivo de altimetría.</p>")
        });
    }
}

// Inicialización de la clase cuando el DOM está listo
$(() => {
    new GestorRutasTuristicas().iniciar();
});