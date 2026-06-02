"use strict";

class GestorRutasTuristicas {
    constructor() {
        this.rutas = [];
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
            error: () => this.contenedor.append($("<p>").text("Error crítico: No se pudo cargar el archivo rutas.xml."))
        });
    }

    procesarXML(xml) {
        this.contenedor.empty();

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
                item.append($("<img>").attr({ src: "multimedia/" + hito.fotos[0], alt: `Foto de ${hito.nombre}`, width: "250" }));
            }
            listaHitos.append(item);
        });
        articulo.append(listaHitos);

        // CREACIÓN ESTRUCTURAL PURA (SIN CSS NI ATRIBUTOS ILEGALES)
        articulo.append($("<h4>").text(`Planimetría (${ruta.kml})`));
        const contenedorMapa = $("<figure>");
        articulo.append(contenedorMapa);

        articulo.append($("<h4>").text(`Altimetría (${ruta.svg})`));
        const contenedorSvg = $("<figure>");
        articulo.append(contenedorSvg);

        this.contenedor.append(articulo);
        this.contenedor.append($("<hr>"));

        setTimeout(() => {
            this.renderizarMapaLeafletYKml(ruta, contenedorMapa[0]);
            this.cargarSvg(ruta.svg, contenedorSvg);
        }, 100);
    }

   renderizarMapaLeafletYKml(ruta, nodoDOMMapa) {
           // 1. Forzamos un tamaño mínimo al nodo antes de que Leaflet lo toque
           nodoDOMMapa.style.height = "25em";

           // 2. Inicializar mapa
           const mapa = L.map(nodoDOMMapa, {
               scrollWheelZoom: false
           }).setView([ruta.inicio.lat, ruta.inicio.lng], 14);

           L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
               maxZoom: 19,
               attribution: '&copy; OpenStreetMap contributors'
           }).addTo(mapa);

           L.marker([ruta.inicio.lat, ruta.inicio.lng]).addTo(mapa)
               .bindPopup(`<b>Inicio:</b> ${ruta.nombre}`);

           ruta.hitos.forEach(hito => {
               if(!isNaN(hito.lat) && !isNaN(hito.lng)) {
                   L.marker([hito.lat, hito.lng]).addTo(mapa)
                       .bindPopup(hito.nombre);
               }
           });

           // 3. Cargar KML (igual que antes)
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
                       coordsKml.forEach(par => {
                           const partes = par.split(",");
                           if(partes.length >= 2) trazado.push([parseFloat(partes[1]), parseFloat(partes[0])]);
                       });

                       const linea = L.polyline(trazado, {color: '#d60000', weight: 5, opacity: 0.8}).addTo(mapa);

                       // 4. El truco de magia: InvalidateSize para que el mapa "se dé cuenta" de su espacio
                       setTimeout(() => {
                           mapa.invalidateSize();
                           if (trazado.length > 0) mapa.fitBounds(linea.getBounds());
                       }, 500);
                   }
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