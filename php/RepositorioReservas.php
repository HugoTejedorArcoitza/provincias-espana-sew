<?php
declare(strict_types=1);

class RepositorioReservas
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function autenticarUsuario(string $correo, string $claveCli): ?array
    {
        try {
            $consulta = $this->db->prepare('SELECT * FROM Cliente WHERE email_cli = ? LIMIT 1');
            $consulta->execute([$correo]);
            $usuario = $consulta->fetch();

            if (!$usuario) {
                return null;
            }

            if (!isset($usuario['clave_cli']) || !password_verify($claveCli, $usuario['clave_cli'])) {
                return null;
            }

            return [
                // Alias de compatibilidad con la clave de sesión usada por el controlador.
                'id_usuario' => (int)$usuario['id_cli'],
                'nombre' => (string)($usuario['nombre_cli'] ?? $usuario['nombre'] ?? ''),
                'email_cli' => (string)$usuario['email_cli']
            ];
        } catch (PDOException $e) {
            return null;
        }
    }

    public function registrarUsuario(string $nombre, string $correo, string $claveCli): bool
    {
        try {
            $hashContrasena = password_hash($claveCli, PASSWORD_DEFAULT);
            $consulta = $this->db->prepare('INSERT INTO Cliente(nombre_cli, email_cli, clave_cli) VALUES(?, ?, ?)');
            return $consulta->execute([$nombre, $correo, $hashContrasena]);
        } catch (PDOException $e) {
            return false;
        }
    }

    public function obtenerRecursos(): array
    {
        $sql = 'SELECT r.id_recurso, t.nombre AS tipo, r.nombre, r.descripcion, r.plazas, r.inicio, r.fin, r.precio
                FROM recursos r INNER JOIN tipos_recursos t ON r.id_tipo = t.id_tipo
                ORDER BY r.inicio, r.nombre';
        return $this->db->query($sql)->fetchAll();
    }

    public function crearReserva(int $idUsuario, int $idRecurso, int $plazas): array
    {
        try {
            if ($plazas < 1) {
                return ['ok' => false, 'error' => 'El numero de plazas debe ser mayor que cero.'];
            }

            $consultaRecurso = $this->db->prepare('SELECT plazas, precio FROM recursos WHERE id_recurso = ?');
            $consultaRecurso->execute([$idRecurso]);
            $recurso = $consultaRecurso->fetch();

            if (!$recurso) {
                return ['ok' => false, 'error' => 'El recurso seleccionado no existe.'];
            }

            $consultaOcupadas = $this->db->prepare('SELECT COALESCE(SUM(plazas), 0) AS ocupadas FROM reservas WHERE id_recurso = ? AND id_estado = 1');
            $consultaOcupadas->execute([$idRecurso]);
            $ocupadas = (int)($consultaOcupadas->fetch()['ocupadas'] ?? 0);
            $disponibles = (int)$recurso['plazas'] - $ocupadas;

            if ($disponibles < $plazas) {
                return ['ok' => false, 'error' => 'No hay plazas suficientes. Disponibles: ' . max(0, $disponibles) . '.'];
            }

            $presupuesto = $plazas * (float)$recurso['precio'];
            $consulta = $this->db->prepare('INSERT INTO reservas(id_cli, id_recurso, id_estado, plazas, presupuesto) VALUES(?, ?, 1, ?, ?)');
            $ok = $consulta->execute([$idUsuario, $idRecurso, $plazas, $presupuesto]);

            if (!$ok) {
                return ['ok' => false, 'error' => 'No se pudo guardar la reserva.'];
            }

            return ['ok' => true, 'error' => ''];
        } catch (PDOException $e) {
            return ['ok' => false, 'error' => 'Error de base de datos: ' . $e->getMessage()];
        }
    }

    public function obtenerReservasUsuario(int $idUsuario): array
    {
        $sql = 'SELECT re.id_reserva, r.nombre, e.nombre AS estado, re.plazas, re.presupuesto, re.fecha_reserva
                FROM reservas re
                INNER JOIN recursos r ON re.id_recurso = r.id_recurso
                INNER JOIN estados_reserva e ON re.id_estado = e.id_estado
                WHERE re.id_cli = ?
                ORDER BY re.fecha_reserva DESC';
        $consulta = $this->db->prepare($sql);
        $consulta->execute([$idUsuario]);
        return $consulta->fetchAll();
    }

    public function anularReserva(int $idReserva, int $idUsuario): bool
    {
        $sql = 'UPDATE reservas SET id_estado = 2 WHERE id_reserva = ? AND id_cli = ?';
        $consulta = $this->db->prepare($sql);
        return $consulta->execute([$idReserva, $idUsuario]);
    }
}
