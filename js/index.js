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
       // 1. Envolvemos el contenido en el article
       this.#seccion.children("figure, button").wrapAll("<article></article>");

       // 2. Inyectamos el encabezado DENTRO del article (esto quita el warning)
       this.#seccion.find("article").prepend("<h3>Imágenes destacadas</h3>");

       this.#botones.eq(0).on("click", () => this.anterior());
       this.#botones.eq(1).on("click", () => this.siguiente());
       this.mostrar();
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
    #url;
    #apiKey;

    constructor(seccion) {
        this.#seccion = seccion;

        this.#url = "https://api.thenewsapi.com/v1/news/all?search=Sevilla&locale=es&language=es&limit=5";
        this.#apiKey = "t1SKhLXxieUQEgFogCWSqhcuMvCiJJ1QTN4kSez1";
    }

    cargar() {
        $.ajax({
            url: this.#url,
            method: "GET",
            data: { api_token: this.#apiKey },
            dataType: "json",
            timeout: 5000,
            success: (datos) => {

                if (datos && datos.data) {
                    this.mostrar(datos.data);
                } else {
                    this.mostrarAlternativa();
                }
            },
            error: () => this.mostrarAlternativa()
        });
    }

    mostrar(noticias) {


        this.#seccion.find("p").remove();
        let $contenedor = this.#seccion.find("article");

        // Si no tienes article, lo creamos
        if ($contenedor.length === 0) {
            this.#seccion.append("<article></article>");
            $contenedor = this.#seccion.find("article");
        }

        // Inyectamos el h3 al principio
        if ($contenedor.find("h3").length === 0) {
            $contenedor.prepend("<h3>Titulares locales</h3>");
        }

        // Limpiamos la lista anterior si existía para no duplicar
        $contenedor.find("ul").remove();

        const lista = $("<ul></ul>");

        // The News API a veces devuelve un objeto, aseguramos que sea array
        const listaNoticias = Array.isArray(noticias) ? noticias : [];

        listaNoticias.forEach(n => {
            lista.append(
                $("<li></li>").append(
                    $("<a></a>")
                        .attr("href", n.url)
                        .attr("target", "_blank")
                        .text(n.title)
                )
            );
        });

        $contenedor.append(lista);
    }

    mostrarAlternativa() {
        this.#seccion.find("p").remove();
        let $contenedor = this.#seccion.find("article");
        if ($contenedor.length === 0) {
            this.#seccion.append("<article></article>");
            $contenedor = this.#seccion.find("article");
        }

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