"use strict";

class CoordenadaKml {
    constructor(longitud, latitud, altitud) {
        this.longitud = Number(longitud);
        this.latitud = Number(latitud);
        this.altitud = Number(altitud || 0);
    }

    esValida() {
        return Number.isFinite(this.longitud) && Number.isFinite(this.latitud);
    }

    aGoogleMaps() {
        return { lat: this.latitud, lng: this.longitud };
    }
}

class LectorRutasXml {
    constructor(documentoXml) {
        this.documentoXml = documentoXml;
    }

    rutas() {
        return $(this.documentoXml).find("ruta").map((indice, nodo) => this.crearRuta($(nodo))).get();
    }

    crearRuta(rutaXml) {
        return {
            nombre: this.texto(rutaXml, "nombre"),
            tipo: this.texto(rutaXml, "tipo"),
            transporte: this.texto(rutaXml, "transporte"),
            fecha: this.texto(rutaXml, "fecha"),
            hora: this.texto(rutaXml, "hora"),
            duracion: this.texto(rutaXml, "duracion"),
            agencia: this.texto(rutaXml, "agencia"),
            descripcion: this.texto(rutaXml, "descripcion"),
            personas: this.texto(rutaXml, "personas"),
            lugarInicio: this.texto(rutaXml, "lugarInicio"),
            direccionInicio: this.texto(rutaXml, "direccionInicio"),
            recomendacion: this.texto(rutaXml, "recomendacion"),
            inicio: this.coordenada(rutaXml.children("coordenada").first()),
            planimetria: this.texto(rutaXml, "planimetria"),
            altimetria: this.texto(rutaXml, "altimetria"),
            referencias: rutaXml.find("referencias referencia").map((_, nodo) => $(nodo).text().trim()).get(),
            hitos: rutaXml.find("hitos hito").map((_, nodo) => this.crearHito($(nodo))).get()
        };
    }

    crearHito(hitoXml) {
        const distancia = hitoXml.children("distanciaAnterior");
        return {
            nombre: this.texto(hitoXml, "nombreHito"),
            descripcion: this.texto(hitoXml, "descripcionHito"),
            coordenada: this.coordenada(hitoXml.children("coordenada").first()),
            distancia: distancia.text().trim(),
            unidades: distancia.attr("unidades") || "metros",
            fotos: hitoXml.find("galeriaFotos foto").map((_, nodo) => $(nodo).text().trim()).get()
        };
    }

    coordenada(nodo) {
        return new CoordenadaKml(
            nodo.children("longitud").first().text().trim(),
            nodo.children("latitud").first().text().trim(),
            nodo.children("altitud").first().text().trim()
        );
    }

    texto(nodo, selector) {
        return nodo.children(selector).first().text().trim();
    }
}

class CargadorGoogleMaps {
    constructor(claveApi) {
        this.claveApi = claveApi;
        this.promesa = null;
    }

    cargar() {
        if (window.google && window.google.maps) {
            return $.Deferred().resolve(window.google.maps).promise();
        }
        if (!this.claveApi) {
            return $.Deferred().reject("Falta la clave de Google Maps del proyecto.").promise();
        }
        if (this.promesa !== null) {
            return this.promesa;
        }

        const diferido = $.Deferred();
        const nombreCallback = "inicializarGoogleMapsRutas";
        window[nombreCallback] = () => diferido.resolve(window.google.maps);

        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(this.claveApi)}&callback=${nombreCallback}`;
        script.async = true;
        script.defer = true;
        script.onerror = () => diferido.reject("No se pudo cargar la API de Google Maps.");
        document.head.appendChild(script);

        this.promesa = diferido.promise();
        return this.promesa;
    }
}

class LectorKml {
    constructor(archivoKml) {
        this.archivoKml = archivoKml;
    }

    cargar() {
        return $.ajax({
            url: `xml/${this.archivoKml}`,
            dataType: "xml"
        }).then((documentoKml) => this.extraerCoordenadas(documentoKml));
    }

    extraerCoordenadas(documentoKml) {
        const nodos = documentoKml.getElementsByTagNameNS("*", "coordinates");
        const coordenadas = [];
        Array.prototype.forEach.call(nodos, (nodo) => {
            nodo.textContent.trim().split(/\s+/).forEach((tramo) => {
                const partes = tramo.split(",");
                const coordenada = new CoordenadaKml(partes[0], partes[1], partes[2]);
                if (coordenada.esValida()) {
                    coordenadas.push(coordenada);
                }
            });
        });
        return coordenadas;
    }
}

class MapaGoogleKml {
    constructor(contenedor, ruta, cargadorGoogleMaps) {
        this.contenedor = contenedor;
        this.ruta = ruta;
        this.cargadorGoogleMaps = cargadorGoogleMaps;
        this.mapa = null;
    }

    cargar() {
        this.cargadorGoogleMaps.cargar()
            .done(() => this.cargarKml())
            .fail((mensaje) => this.mostrarError(mensaje));
    }

    cargarKml() {
        new LectorKml(this.ruta.planimetria).cargar()
            .done((coordenadas) => this.dibujar(coordenadas))
            .fail(() => this.mostrarError("No se pudo cargar el archivo KML de la ruta."));
    }

    dibujar(coordenadas) {
        if (coordenadas.length === 0) {
            this.mostrarError("El archivo KML no contiene coordenadas válidas.");
            return;
        }

        this.mapa = new google.maps.Map(this.contenedor[0], {
            center: this.ruta.inicio.aGoogleMaps(),
            zoom: 14,
            mapTypeId: "terrain"
        });

        const limites = new google.maps.LatLngBounds();
        const camino = coordenadas.map((coordenada) => {
            const punto = coordenada.aGoogleMaps();
            limites.extend(punto);
            return punto;
        });

        new google.maps.Polyline({
            path: camino,
            geodesic: true,
            strokeColor: "#c21807",
            strokeOpacity: 0.9,
            strokeWeight: 5,
            map: this.mapa
        });

        this.ruta.hitos.forEach((hito) => {
            if (hito.coordenada.esValida()) {
                new google.maps.Marker({
                    position: hito.coordenada.aGoogleMaps(),
                    map: this.mapa,
                    title: hito.nombre
                });
            }
        });

        this.mapa.fitBounds(limites);
    }

    mostrarError(mensaje) {
        this.contenedor.empty().append($("<p></p>").text(mensaje));
    }
}

class VistaRutas {
    constructor(contenedor, cargadorGoogleMaps) {
        this.contenedor = contenedor;
        this.cargadorGoogleMaps = cargadorGoogleMaps;
    }

    mostrar(rutas) {
        this.contenedor.children("article").remove();
        this.contenedor.children("p").remove();
        rutas.forEach((ruta) => this.contenedor.append(this.articuloRuta(ruta)));
    }

    articuloRuta(ruta) {
        const articulo = $("<article></article>");
        articulo.append($("<h3></h3>").text(ruta.nombre));
        articulo.append($("<p></p>").text(ruta.descripcion));
        articulo.append(this.listaDatos(ruta));
        articulo.append($("<h4></h4>").text("Referencias"));
        articulo.append(this.listaReferencias(ruta.referencias));
        articulo.append($("<h4></h4>").text("Hitos de la ruta"));
        articulo.append(this.listaHitos(ruta.hitos));
        articulo.append($("<h4></h4>").text("Planimetría"));

        const figuraMapa = $("<figure></figure>");
        const contenedorMapa = $("<div></div>").attr({
            role: "application",
            "aria-label": `Mapa dinámico de ${ruta.nombre}`
        });
        figuraMapa.append(contenedorMapa);
        figuraMapa.append($("<figcaption></figcaption>").text(`Mapa de Google Maps con la planimetría de ${ruta.planimetria}.`));
        articulo.append(figuraMapa);
        new MapaGoogleKml(contenedorMapa, ruta, this.cargadorGoogleMaps).cargar();

        articulo.append($("<h4></h4>").text("Altimetría"));
        const figuraAltimetria = $("<figure></figure>");
        figuraAltimetria.append($("<figcaption></figcaption>").text(`Altimetría cargada desde ${ruta.altimetria}.`));
        articulo.append(figuraAltimetria);
        this.cargarAltimetria(ruta.altimetria, figuraAltimetria);
        return articulo;
    }

    listaDatos(ruta) {
        const datos = [
            ["Tipo", ruta.tipo],
            ["Transporte", ruta.transporte],
            ["Fecha y hora", `${ruta.fecha || "Flexible"} ${ruta.hora || ""}`.trim()],
            ["Duración", ruta.duracion],
            ["Agencia", ruta.agencia],
            ["Inicio", `${ruta.lugarInicio}, ${ruta.direccionInicio}`],
            ["Personas adecuadas", ruta.personas],
            ["Recomendación", `${ruta.recomendacion} de 10`]
        ];
        const lista = $("<dl></dl>");
        datos.forEach((dato) => {
            lista.append($("<dt></dt>").text(dato[0]));
            lista.append($("<dd></dd>").text(dato[1]));
        });
        return lista;
    }

    listaReferencias(referencias) {
        const lista = $("<ul></ul>");
        referencias.forEach((referencia) => {
            lista.append($("<li></li>").append($("<a></a>").attr("href", referencia).text(referencia)));
        });
        return lista;
    }

    listaHitos(hitos) {
        const lista = $("<ol></ol>");
        hitos.forEach((hito) => {
            const item = $("<li></li>");
            item.append($("<strong></strong>").text(hito.nombre));
            item.append(document.createTextNode(`: ${hito.descripcion}. Distancia desde el hito anterior: ${hito.distancia} ${hito.unidades}.`));
            this.insertarFotoHito(item, hito);
            lista.append(item);
        });
        return lista;
    }

    insertarFotoHito(item, hito) {
        if (hito.fotos.length === 0) {
            return;
        }
        const figura = $("<figure></figure>");
        figura.append($("<img />").attr({
            src: `multimedia/${hito.fotos[0]}`,
            alt: `Fotografía de ${hito.nombre}`
        }));
        figura.append($("<figcaption></figcaption>").text(hito.nombre));
        item.append(figura);
    }

    cargarAltimetria(archivoSvg, figura) {
        $.ajax({
            url: `xml/${archivoSvg}`,
            dataType: "xml"
        }).done((documentoSvg) => {
            const svg = $(documentoSvg.documentElement).clone();
            figura.prepend(svg);
        }).fail(() => figura.prepend($("<p></p>").text("No se pudo cargar el archivo SVG de altimetría.")));
    }
}

class GestorRutasTuristicas {
    constructor() {
        this.contenedor = $("main section").first();
        this.cargadorGoogleMaps = new CargadorGoogleMaps(window.GOOGLE_MAPS_API_KEY);
        this.vista = new VistaRutas(this.contenedor, this.cargadorGoogleMaps);
    }

    iniciar() {
        $.ajax({
            url: "xml/rutas.xml",
            dataType: "xml"
        }).done((xml) => {
            const rutas = new LectorRutasXml(xml).rutas();
            this.vista.mostrar(rutas);
        }).fail(() => {
            this.contenedor.children("p").remove();
            this.contenedor.append($("<p></p>").text("No se pudo cargar el archivo local xml/rutas.xml."));
        });
    }
}

$(function () {
    new GestorRutasTuristicas().iniciar();
});
