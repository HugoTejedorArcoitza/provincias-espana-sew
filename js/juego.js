"use strict";

class Pregunta {
    constructor(enunciado, opciones, correcta) {
        this.enunciado = enunciado;
        this.opciones = opciones;
        this.correcta = correcta;
    }
}

class JuegoTuristico {
    constructor(formulario, preguntas) {
        this.formulario = formulario;
        this.preguntas = preguntas;
    }

    iniciar() {
        this.preguntas.forEach((pregunta, indice) => this.formulario.appendChild(this.crearPregunta(pregunta, indice)));
        const boton = document.createElement("button");
        boton.type = "submit";
        boton.textContent = "Finalizar juego";
        this.formulario.appendChild(boton);
        this.formulario.addEventListener("submit", (evento) => this.corregir(evento));
    }

    crearPregunta(pregunta, indice) {
        const grupo = document.createElement("fieldset");
        const leyenda = document.createElement("legend");
        leyenda.textContent = `${indice + 1}. ${pregunta.enunciado}`;
        grupo.appendChild(leyenda);
        pregunta.opciones.forEach((opcion, posicion) => {
            const etiqueta = document.createElement("label");
            const entrada = document.createElement("input");
            entrada.type = "radio";
            entrada.name = `pregunta${indice}`;
            entrada.value = String(posicion);
            etiqueta.appendChild(entrada);
            etiqueta.appendChild(document.createTextNode(` ${opcion}`));
            grupo.appendChild(etiqueta);
        });
        return grupo;
    }

    corregir(evento) {
        evento.preventDefault();
        if (!this.respondidas()) {
            this.mostrarResultado("Debes responder todas las preguntas antes de finalizar.");
            return;
        }
        const aciertos = this.preguntas.reduce((total, pregunta, indice) => {
            const marcada = this.formulario.querySelector(`input[name="pregunta${indice}"]:checked`);
            return total + (Number(marcada.value) === pregunta.correcta ? 1 : 0);
        }, 0);
        this.mostrarResultado(`Puntuación obtenida: ${aciertos} de 10.`);
    }

    respondidas() {
        return this.preguntas.every((pregunta, indice) => this.formulario.querySelector(`input[name="pregunta${indice}"]:checked`));
    }

    mostrarResultado(texto) {
        let resultado = this.formulario.querySelector("output");
        if (!resultado) {
            resultado = document.createElement("output");
            this.formulario.appendChild(resultado);
        }
        resultado.textContent = texto;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const preguntas = [
        new Pregunta("¿Cuál de los siguientes es un plato principal de la gastronomía sevillana?", ["Paella", "Gazpacho andaluz", "Fabada", "Cocido madrileño", "Lentejas"], 1),
        new Pregunta("¿Qué técnica de marinado es típica en Sevilla?", ["Escabeche", "Adobo", "Salazón", "Ahumado", "Curado"], 1),
        new Pregunta("¿En qué estación es más típico consumir torrijas en Sevilla?", ["Verano", "Otoño", "Invierno", "Semana Santa", "Navidad"], 3),
        new Pregunta("¿Qué tipo de transporte se utiliza en la ruta 'Guadalquivir y Parque de María Luisa'?", ["A pie", "Bicicleta", "Autobús", "Coche", "Metro"], 1),
        new Pregunta("¿Cuál es el punto de inicio de la ruta 'Sevilla Monumental y Triana'?", ["Plaza de España", "Torre del Oro", "Real Alcázar de Sevilla", "Alameda de Hércules", "Plaza Nueva"], 2),
        new Pregunta("¿Qué monumento NO forma parte de la ruta 'Sevilla Monumental y Triana'?", ["Real Alcázar de Sevilla", "Catedral de Sevilla", "Metropol Parasol", "Palacio de San Telmo", "Hospital de los Venerables"], 2),
        new Pregunta("¿Qué tipo de aceituna se menciona en la sección de gastronomía?", ["Kalamata", "Gordal", "Arbequina", "Picual", "Cornicabra"], 1),
        new Pregunta("¿Cómo se llama el pequeño bocadillo típico mencionado en la web?", ["Tapa", "Pincho", "Montadito", "Bocata", "Ración"], 2),
        new Pregunta("¿Qué famoso parque se recorre en una de las rutas en bicicleta?", ["Parque del Retiro", "Parque de María Luisa", "Parque Güell", "Parque del Oeste", "Casa de Campo"], 1),
        new Pregunta("¿Qué edificio histórico es un antiguo colegio de mareantes?", ["Hospital de los Venerables", "Palacio de San Telmo", "Costurero de la Reina", "Real Parroquia de Señora Santa Ana", "Torre del Oro"], 1)
    ];
    new JuegoTuristico(document.querySelector("form"), preguntas).iniciar();
});