"use strict";

class GestorRutasTuristicas {
    constructor() {
        this.contenedor = $("main section").first();
    }

    iniciar() {
        // Inyectamos un contenedor vacío para el mapa base
        const article = $("<article>");
        article.append($("<h3>").text("Mapa de Diagnóstico"));
        const divMapa = $("<div>");
        article.append(divMapa);
        this.contenedor.append(article);

        // Llamada directa a la API
        this.renderizarMapaBase(divMapa[0]);
    }

    renderizarMapaBase(nodo) {
        const mapa = new google.maps.Map(nodo, {
            zoom: 12,
            center: { lat: 37.3891, lng: -5.9845 }, // Centro en Sevilla
            mapTypeId: 'terrain'
        });

        // Marcador de prueba para ver si el mapa responde
        new google.maps.Marker({
            position: { lat: 37.3891, lng: -5.9845 },
            map: mapa,
            title: "Prueba de diagnóstico"
        });
    }
}

// Global para la API
window.initGoogleMaps = () => {
    $(() => {
        new GestorRutasTuristicas().iniciar();
    });
};