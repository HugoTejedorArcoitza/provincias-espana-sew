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
            distancia: distancia.text().trim(),
            unidades: distancia.attr("unidades") || "metros",
            fotos: hitoXml.find("galeriaFotos foto").map((_, nodo) => $(nodo).text().trim()).get()
        };
    }

    texto(nodo, selector) {
        return nodo.children(selector).first().text().trim();
    }
}

class MapaOsmKml {
    constructor(contenedor, archivoKml, nombreRuta) {
        this.contenedor = contenedor;
        this.archivoKml = archivoKml;
        this.nombreRuta = nombreRuta;
        this.zoom = 15;
        this.tamanoTesela = 256;
        this.dimensionTeselas = 3;
    }

    cargar() {
        $.ajax({
            url: `xml/${this.archivoKml}`,
            dataType: "xml"
        }).done((documentoKml) => this.dibujar(documentoKml))
            .fail(() => this.mostrarError("No se pudo cargar el archivo KML de la ruta."));
    }

    dibujar(documentoKml) {
        const coordenadas = this.extraerCoordenadas(documentoKml);
        if (coordenadas.length === 0) {
            this.mostrarError("El archivo KML no contiene coordenadas válidas.");
            return;
        }

        const centro = this.centroGeografico(coordenadas);
        const teselaCentro = this.coordenadaATesela(centro, this.zoom);
        const origen = {
            x: Math.floor(teselaCentro.x) - 1,
            y: Math.floor(teselaCentro.y) - 1
        };

        this.contenedor.empty();
        this.insertarTeselas(origen);
        this.insertarTrazado(coordenadas, origen);
    }

    extraerCoordenadas(documentoKml) {
        const nodos = documentoKml.getElementsByTagNameNS("*", "coordinates");
        const coordenadas = [];
        Array.prototype.forEach.call(nodos, (nodo) => {
            nodo.textContent.trim().split(/\s+/).forEach((tramo) => {
                const partes = tramo.split(",");
                const punto = new CoordenadaKml(partes[0], partes[1], partes[2]);
                if (punto.esValida()) {
                    coordenadas.push(punto);
                }
            });
        });
        return coordenadas;
    }

    centroGeografico(coordenadas) {
        const suma = coordenadas.reduce((acumulado, punto) => ({
            longitud: acumulado.longitud + punto.longitud,
            latitud: acumulado.latitud + punto.latitud
        }), { longitud: 0, latitud: 0 });
        return new CoordenadaKml(
            suma.longitud / coordenadas.length,
            suma.latitud / coordenadas.length,
            0
        );
    }

    insertarTeselas(origen) {
        for (let fila = 0; fila < this.dimensionTeselas; fila += 1) {
            for (let columna = 0; columna < this.dimensionTeselas; columna += 1) {
                const x = origen.x + columna;
                const y = origen.y + fila;
                const imagen = $("<img />").attr({
                    src: `https://tile.openstreetmap.org/${this.zoom}/${x}/${y}.png`,
                    alt: `Tesela cartográfica de OpenStreetMap para ${this.nombreRuta}`
                });
                this.contenedor.append(imagen);
            }
        }
    }

    insertarTrazado(coordenadas, origen) {
        const ancho = this.tamanoTesela * this.dimensionTeselas;
        const alto = this.tamanoTesela * this.dimensionTeselas;
        const puntos = coordenadas.map((punto) => {
            const proyectado = this.coordenadaATesela(punto, this.zoom);
            const x = (proyectado.x - origen.x) * this.tamanoTesela;
            const y = (proyectado.y - origen.y) * this.tamanoTesela;
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        }).join(" ");

        const svg = $(document.createElementNS("http://www.w3.org/2000/svg", "svg")).attr({
            viewBox: `0 0 ${ancho} ${alto}`,
            role: "img",
            "aria-label": `Planimetría de ${this.nombreRuta}`
        });
        const linea = $(document.createElementNS("http://www.w3.org/2000/svg", "polyline")).attr({
            points: puntos,
            fill: "none",
            stroke: "#c21807",
            "stroke-width": "8",
            "stroke-linecap": "round",
            "stroke-linejoin": "round"
        });
        svg.append(linea);
        coordenadas.forEach((punto) => {
            const proyectado = this.coordenadaATesela(punto, this.zoom);
            const marca = $(document.createElementNS("http://www.w3.org/2000/svg", "circle")).attr({
                cx: ((proyectado.x - origen.x) * this.tamanoTesela).toFixed(2),
                cy: ((proyectado.y - origen.y) * this.tamanoTesela).toFixed(2),
                r: "7",
                fill: "#ffffff",
                stroke: "#004f59",
                "stroke-width": "4"
            });
            svg.append(marca);
        });
        this.contenedor.append(svg);
    }

    coordenadaATesela(coordenada, zoom) {
        const latitudRad = coordenada.latitud * Math.PI / 180;
        const escala = 2 ** zoom;
        return {
            x: ((coordenada.longitud + 180) / 360) * escala,
            y: ((1 - Math.log(Math.tan(latitudRad) + 1 / Math.cos(latitudRad)) / Math.PI) / 2) * escala
        };
    }

    mostrarError(mensaje) {
        this.contenedor.empty().append($("<p></p>").text(mensaje));
    }
}

class VistaRutas {
    constructor(contenedor) {
        this.contenedor = contenedor;
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
        figuraMapa.append($("<figcaption></figcaption>").text(`Mapa cargado desde ${ruta.planimetria}.`));
        articulo.append(figuraMapa);
        new MapaOsmKml(contenedorMapa, ruta.planimetria, ruta.nombre).cargar();
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
        this.vista = new VistaRutas(this.contenedor);
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
