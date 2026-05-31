<?php
declare(strict_types=1);

class ConexionReservas
{
    private const HOST = 'localhost';
    private const BASE_DATOS = 'sevilla_reservas';
    private const USUARIO = 'DBUSER2026';
    private const CLAVE = 'DBPWD2026';
    private ?PDO $conexion = null;

    public function obtenerConexion(): PDO
    {
        if ($this->conexion === null) {
            $dsn = 'mysql:host=' . self::HOST . ';charset=utf8mb4';
            $this->conexion = new PDO($dsn, self::USUARIO, self::CLAVE, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false
            ]);

            $this->inicializarBaseDatos();
        }
        return $this->conexion;
    }

    private function inicializarBaseDatos(): void
    {
        // Crear BD si no existe y seleccionarla
        $this->conexion->exec("CREATE DATABASE IF NOT EXISTS " . self::BASE_DATOS . " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $this->conexion->exec("USE " . self::BASE_DATOS);

        // Crear tablas (puedes cargar tu archivo .sql aquí con file_get_contents si lo prefieres)
        $sql = file_get_contents(__DIR__ . '/crear_base_datos.sql');
        if ($sql) {
            $this->conexion->exec($sql);
        }

        // Cumplimiento estricto: Cargar CSV dinámicamente si la tabla de tipos está vacía
        $stmt = $this->conexion->query("SELECT COUNT(*) FROM tipos_recursos");
        if ($stmt->fetchColumn() == 0) {
            $this->cargarDatosDesdeCSV(__DIR__ . '/tipos_recursos.csv', "INSERT IGNORE INTO tipos_recursos (id_tipo, nombre) VALUES (?, ?)");
            $this->cargarDatosDesdeCSV(__DIR__ . '/estados_reserva.csv', "INSERT IGNORE INTO estados_reserva (id_estado, nombre) VALUES (?, ?)");
            $this->cargarDatosDesdeCSV(__DIR__ . '/recursos.csv', "INSERT IGNORE INTO recursos (id_recurso, id_tipo, nombre, descripcion, plazas, inicio, fin, precio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        }
    }

    private function cargarDatosDesdeCSV(string $rutaArchivo, string $consultaPreparada): void
    {
        if (!file_exists($rutaArchivo) || ($gestor = fopen($rutaArchivo, 'r')) === false) {
            return;
        }
        $stmt = $this->conexion->prepare($consultaPreparada);
        fgetcsv($gestor); // Saltar cabecera
        while (($datos = fgetcsv($gestor, 1000, ",")) !== false) {
            $stmt->execute($datos);
        }
        fclose($gestor);
    }
}