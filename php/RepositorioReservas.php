<?php
declare(strict_types=1);

class RepositorioReservas
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function autenticarUsuario(string $correo, string $contrasena): ?array
    {
        $consulta = $this->db->prepare('SELECT id_usuario, nombre, contrasena FROM usuarios WHERE correo = ?');
        $consulta->execute([$correo]);
        $usuario = $consulta->fetch();
        if (!$usuario) {
            return null;
        }

        if (!password_verify($contrasena, $usuario['contrasena'])) {
            return null;
        }

        unset($usuario['contrasena']);
        return $usuario;
    }

    public function registrarUsuario(string $nombre, string $correo, string $contrasena): bool
    {
        try {
            $hashContrasena = password_hash($contrasena, PASSWORD_DEFAULT);
            $consulta = $this->db->prepare('INSERT INTO usuarios(nombre, correo, contrasena) VALUES(?, ?, ?)');
            return $consulta->execute([$nombre, $correo, $hashContrasena]);
        } catch (PDOException $e) {
            return false; // Posible correo duplicado
        }
    }

    public function obtenerRecursos(): array
    {
        $sql = 'SELECT r.id_recurso, t.nombre AS tipo, r.nombre, r.descripcion, r.plazas, r.inicio, r.fin, r.precio
                FROM recursos r INNER JOIN tipos_recursos t ON r.id_tipo = t.id_tipo
                ORDER BY r.inicio, r.nombre';
        return $this->db->query($sql)->fetchAll();
    }

    public function crearReserva(int $idUsuario, int $idRecurso, int $plazas): bool
    {
        $consultaRecurso = $this->db->prepare('SELECT plazas, precio FROM recursos WHERE id_recurso = ?');
        $consultaRecurso->execute([$idRecurso]);
        $recurso = $consultaRecurso->fetch();

        if (!$recurso || $recurso['plazas'] < $plazas) {
            return false; // No hay plazas
        }

        $presupuesto = $plazas * (float)$recurso['precio'];
        $consulta = $this->db->prepare('INSERT INTO reservas(id_usuario, id_recurso, id_estado, plazas, presupuesto) VALUES(?, ?, 1, ?, ?)');
        return $consulta->execute([$idUsuario, $idRecurso, $plazas, $presupuesto]);
    }

    public function obtenerReservasUsuario(int $idUsuario): array
    {
        $sql = 'SELECT re.id_reserva, r.nombre, e.nombre AS estado, re.plazas, re.presupuesto, re.fecha_reserva
                FROM reservas re
                INNER JOIN recursos r ON re.id_recurso = r.id_recurso
                INNER JOIN estados_reserva e ON re.id_estado = e.id_estado
                WHERE re.id_usuario = ?
                ORDER BY re.fecha_reserva DESC';
        $consulta = $this->db->prepare($sql);
        $consulta->execute([$idUsuario]);
        return $consulta->fetchAll();
    }

    public function anularReserva(int $idReserva, int $idUsuario): bool
    {
        $sql = 'UPDATE reservas SET id_estado = 2 WHERE id_reserva = ? AND id_usuario = ?';
        $consulta = $this->db->prepare($sql);
        return $consulta->execute([$idReserva, $idUsuario]);
    }
}