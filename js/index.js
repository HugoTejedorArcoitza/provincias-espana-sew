"use strict";

class CarruselFotos {
    #seccion;
    #imagenes;
    #posicion;
    #figura;
    #imagen;
    #pie;
    #botones;

    constructor(seccion, imagenes) {
        this.#seccion = seccion;
        this.#imagenes = imagenes;
        this.#posicion = 0;

        // Buscamos los elementos dentro de la sección asignada
        this.#figura = this.#seccion.find("figure").first();
        this.#imagen = this.#figura.find("img").first();
        this.#pie = this.#figura.find("figcaption").first();
        this.#botones = this.#seccion.find("button");
    }

    iniciar() {
        // Envolvemos el contenido en un <article> si no lo tiene, para cumplir semántica HTML5
        if (this.#seccion.find("article").length === 0) {
            this.#seccion.wrapInner("<article></article>");
        }

        this.#botones.eq(0).on("click", () => this.anterior());
        this.#botones.eq(1).on("click", () => this.siguiente());

        this.mostrar();
        window.setInterval(() => this.siguiente(), 6000);
    }

    anterior() {
        this.#posicion = (this.#posicion + this.#imagenes.length - 1) % this.#imagenes.length;
        this.mostrar();
    }

    siguiente() {
        this.#posicion = (this.#posicion + 1) % this.#imagenes.length;
        this.mostrar();
    }

    mostrar() {
        const actual = this.#imagenes[this.#posicion];
        this.#imagen.attr("src", actual.src).attr("alt", actual.alt);
        this.#pie.text(actual.titulo);
    }
}

class NoticiasSevilla {
    #seccion;
    #servicio;

    constructor(seccion) {
        this.#seccion = seccion;
        this.#servicio = "https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.europapress.es%2Frss%2Frss.aspx%3Fch%3D00054";
    }

    cargar() {
        // Garantizamos el contenedor semántico
        if (this.#seccion.find("article").length === 0) {
            this.#seccion.append("<article></article>");
        }

        $.ajax({
            url: this.#servicio,
            method: "GET",
            dataType: "json",
            timeout: 5000
        }).done((datos) => {
            if(datos && datos.items) {
                this.mostrar(this.procesarInformacion(datos.items));
            } else {
                this.mostrarAlternativa();
            }
        }).fail(() => this.mostrarAlternativa());
    }

    procesarInformacion(items) {
        // Separamos la lógica de procesado (Copiado de las buenas prácticas de tu amigo)
        return items.slice(0, 5).map(noticia => ({
            titulo: noticia.title,
            enlace: noticia.link
        }));
    }

    mostrar(noticias) {
        this.#seccion.find("p").remove(); // Limpiamos mensaje de carga
        const $contenedor = this.#seccion.find("article");
        const lista = $("<ul></ul>");

        noticias.forEach((noticia) => {
            const enlace = $("<a></a>")
                .attr("href", noticia.enlace)
                .attr("target", "_blank")
                .text(noticia.titulo);
            lista.append($("<li></li>").append(enlace));
        });

        $contenedor.append(lista);
    }

    mostrarAlternativa() {
        this.#seccion.find("p").remove();
        const $contenedor = this.#seccion.find("article");
        const lista = $("<ul></ul>");

        [
            "Consulta la agenda turística oficial de Sevilla en nuestro menú.",
            "Revisa la meteorología antes de elegir una ruta.",
            "Explora las rutas monumentales y paisajísticas del proyecto."
        ].forEach((texto) => lista.append($("<li></li>").text(texto)));

        $contenedor.append(lista);
    }
}

class Principal {
    #secciones;

    constructor() {
        this.#secciones = $("main section");
    }

    iniciar() {
        const imagenes = [
            { src: "multimedia/mapa_sevilla.svg", alt: "Mapa de situación de la provincia de Sevilla en Andalucía", titulo: "Mapa de situación de Sevilla" },
            { src: "multimedia/catedral.jpg", alt: "Catedral de Sevilla y Giralda", titulo: "Catedral de Sevilla" },
            { src: "multimedia/alcazar.jpg", alt: "Jardines y arquitectura del Real Alcázar de Sevilla", titulo: "Real Alcázar" },
            { src: "multimedia/santelmo.jpg", alt: "Fachada del Palacio de San Telmo", titulo: "Palacio de San Telmo" },
            { src: "multimedia/santaana.jpg", alt: "Real Parroquia de Santa Ana en Triana", titulo: "Santa Ana de Triana" }
        ];
        new CarruselFotos(this.#secciones.eq(1), imagenes).iniciar();
        new NoticiasSevilla(this.#secciones.eq(2)).cargar();
    }
}

$(() => new Principal().iniciar());