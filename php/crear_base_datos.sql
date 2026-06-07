CREATE DATABASE IF NOT EXISTS sevilla_reservas
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE sevilla_reservas;

CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL,
    correo VARCHAR(120) NOT NULL UNIQUE,
    contrasena VARCHAR(255) NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tipos_recursos (
    id_tipo INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(60) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS recursos (
    id_recurso INT AUTO_INCREMENT PRIMARY KEY,
    id_tipo INT NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    descripcion TEXT NOT NULL,
    plazas INT NOT NULL,
    inicio DATETIME NOT NULL,
    fin DATETIME NOT NULL,
    precio DECIMAL(8,2) NOT NULL,
    CONSTRAINT fk_recursos_tipos FOREIGN KEY (id_tipo) REFERENCES tipos_recursos(id_tipo)
);

CREATE TABLE IF NOT EXISTS estados_reserva (
    id_estado INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(40) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS reservas (
    id_reserva INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_recurso INT NOT NULL,
    id_estado INT NOT NULL,
    plazas INT NOT NULL,
    presupuesto DECIMAL(8,2) NOT NULL,
    fecha_reserva TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reservas_usuarios FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
    CONSTRAINT fk_reservas_recursos FOREIGN KEY (id_recurso) REFERENCES recursos(id_recurso),
    CONSTRAINT fk_reservas_estados FOREIGN KEY (id_estado) REFERENCES estados_reserva(id_estado)
);

INSERT IGNORE INTO tipos_recursos(id_tipo, nombre) VALUES
(1, 'Ruta guiada'),
(2, 'Museo'),
(3, 'Restaurante'),
(4, 'Mirador'),
(5, 'Actividad cultural');

INSERT IGNORE INTO estados_reserva(id_estado, nombre) VALUES
(1, 'Confirmada'),
(2, 'Anulada');

INSERT IGNORE INTO recursos(id_recurso, id_tipo, nombre, descripcion, plazas, inicio, fin, precio) VALUES
(1, 1, 'Sevilla Monumental y Triana', 'Ruta guiada por el Alcázar, la Catedral, el río y Triana.', 25, '2026-05-02 10:00:00', '2026-05-02 14:00:00', 18.00),
(2, 1, 'Plazas, iglesias y tapas', 'Recorrido de tarde por plazas, iglesias y zonas de tapeo.', 20, '2026-05-03 18:00:00', '2026-05-03 21:00:00', 22.00),
(3, 2, 'Visita al Archivo de Indias', 'Actividad cultural en uno de los espacios patrimoniales del centro.', 30, '2026-05-04 11:00:00', '2026-05-04 12:30:00', 8.00),
(4, 4, 'Mirador urbano de Sevilla', 'Entrada a mirador con explicación panorámica de la ciudad.', 40, '2026-05-05 19:00:00', '2026-05-05 20:00:00', 12.00),
(5, 3, 'Degustación de tapas sevillanas', 'Menú degustación con platos típicos de Sevilla.', 35, '2026-05-06 13:30:00', '2026-05-06 15:00:00', 28.00);
