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
        // Creación y selección de la base de datos del proyecto.
        $this->conexion->exec("CREATE DATABASE IF NOT EXISTS " . self::BASE_DATOS . " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $this->conexion->exec("USE " . self::BASE_DATOS);

        // Carga del esquema canónico desde crear_base_datos.sql.
        $sql = file_get_contents(__DIR__ . '/crear_base_datos.sql');
        if ($sql) {
            $this->conexion->exec($sql);
        }

        // Carga los CSV de apoyo cuando sus tablas correspondientes están vacías.
        $this->normalizarEsquemaExistente();

        if ($this->tablaVacia('tipos_recursos')) {
            $this->cargarDatosDesdeCSV(__DIR__ . '/tipos_recursos.csv', "INSERT IGNORE INTO tipos_recursos (id_tipo, nombre) VALUES (?, ?)");
        }

        if ($this->tablaVacia('estados_reserva')) {
            $this->cargarDatosDesdeCSV(__DIR__ . '/estados_reserva.csv', "INSERT IGNORE INTO estados_reserva (id_estado, nombre) VALUES (?, ?)");
        }

        if ($this->tablaVacia('recursos')) {
            $this->cargarDatosDesdeCSV(__DIR__ . '/recursos.csv', "INSERT IGNORE INTO recursos (id_recurso, id_tipo, nombre, descripcion, plazas, inicio, fin, precio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        }

        if ($this->tablaVacia('Cliente')) {
            $this->cargarUsuariosDesdeCSV(__DIR__ . '/usuarios.csv');
        }

        if ($this->tablaVacia('reservas')) {
            $this->cargarDatosDesdeCSV(__DIR__ . '/reservas.csv', "INSERT IGNORE INTO reservas (id_reserva, id_cli, id_recurso, id_estado, plazas, presupuesto) VALUES (?, ?, ?, ?, ?, ?)");
        }
    }

    private function normalizarEsquemaExistente(): void
    {
        if ($this->existeColumna('reservas', 'id_usuario') && !$this->existeColumna('reservas', 'id_cli')) {
            $this->conexion->exec('ALTER TABLE reservas CHANGE id_usuario id_cli INT NOT NULL');
        }

        if ($this->existeColumna('Cliente', 'id_usuario') && !$this->existeColumna('Cliente', 'id_cli')) {
            $this->conexion->exec('ALTER TABLE Cliente CHANGE id_usuario id_cli INT NOT NULL AUTO_INCREMENT');
        }

        if ($this->existeColumna('Cliente', 'nombre') && !$this->existeColumna('Cliente', 'nombre_cli')) {
            $this->conexion->exec('ALTER TABLE Cliente CHANGE nombre nombre_cli VARCHAR(80) NOT NULL');
        }

        if ($this->existeColumna('Cliente', 'correo') && !$this->existeColumna('Cliente', 'email_cli')) {
            $this->conexion->exec('ALTER TABLE Cliente CHANGE correo email_cli VARCHAR(120) NOT NULL');
        }

        if ($this->existeColumna('Cliente', 'contrasena') && !$this->existeColumna('Cliente', 'clave_cli')) {
            $this->conexion->exec('ALTER TABLE Cliente CHANGE contrasena clave_cli VARCHAR(255) NOT NULL');
        }

        if ($this->existeColumna('Cliente', 'contrasena') && $this->existeColumna('Cliente', 'clave_cli')) {
            $this->conexion->exec("UPDATE Cliente SET clave_cli = contrasena WHERE clave_cli = ''");
        }

        if (!$this->existeColumna('Cliente', 'clave_cli')) {
            $this->conexion->exec("ALTER TABLE Cliente ADD clave_cli VARCHAR(255) NOT NULL DEFAULT ''");
        }
    }

    private function existeColumna(string $tabla, string $columna): bool
    {
        $consulta = $this->conexion->prepare(
            'SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?'
        );
        $consulta->execute([self::BASE_DATOS, $tabla, $columna]);
        return (int)$consulta->fetchColumn() > 0;
    }

    private function tablaVacia(string $tabla): bool
    {
        $stmt = $this->conexion->query("SELECT COUNT(*) FROM " . $tabla);
        return (int)$stmt->fetchColumn() === 0;
    }

    private function cargarDatosDesdeCSV(string $rutaArchivo, string $consultaPreparada): void
    {
        if (!file_exists($rutaArchivo) || ($gestor = fopen($rutaArchivo, 'r')) === false) {
            return;
        }
        $stmt = $this->conexion->prepare($consultaPreparada);
        fgetcsv($gestor); // Omite la cabecera del CSV.
        while (($datos = fgetcsv($gestor, 1000, ",")) !== false) {
            $stmt->execute($datos);
        }
        fclose($gestor);
    }

    private function cargarUsuariosDesdeCSV(string $rutaArchivo): void
    {
        if (!file_exists($rutaArchivo) || ($gestor = fopen($rutaArchivo, 'r')) === false) {
            return;
        }

        $stmt = $this->conexion->prepare('INSERT IGNORE INTO Cliente (id_cli, nombre_cli, email_cli, clave_cli) VALUES (?, ?, ?, ?)');
        fgetcsv($gestor);
        while (($datos = fgetcsv($gestor, 1000, ",")) !== false) {
            $datos[3] = password_hash($datos[3], PASSWORD_DEFAULT);
            $stmt->execute($datos);
        }
        fclose($gestor);
    }
}
