<?php
declare(strict_types=1);

class ConexionReservas
{
    private const HOST = 'localhost';
    private const BASE_DATOS = 'sevilla_reservas';
    private const USUARIO = 'DBUSER2026';
    private const CLAVE = 'DBPWD2026';
    private ?PDO $conexion = null;

    public function obtener(): PDO
    {
        if ($this->conexion === null) {
            $dsn = 'mysql:host=' . self::HOST . ';dbname=' . self::BASE_DATOS . ';charset=utf8mb4';
            $this->conexion = new PDO($dsn, self::USUARIO, self::CLAVE, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
        }
        return $this->conexion;
    }
}

class RepositorioReservas
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function registrarUsuario(string $nombre, string $correo, string $telefono): void
    {
        $consulta = $this->db->prepare('INSERT INTO usuarios(nombre, correo, telefono) VALUES(?, ?, ?)');
        $consulta->execute([$nombre, $correo, $telefono]);
    }

    public function recursos(): array
    {
        $sql = 'SELECT r.id_recurso, t.nombre AS tipo, r.nombre, r.descripcion, r.plazas, r.inicio, r.fin, r.precio
                FROM recursos r INNER JOIN tipos_recursos t ON r.id_tipo = t.id_tipo
                ORDER BY r.inicio, r.nombre';
        return $this->db->query($sql)->fetchAll();
    }

    public function recurso(int $id): ?array
    {
        $consulta = $this->db->prepare('SELECT * FROM recursos WHERE id_recurso = ?');
        $consulta->execute([$id]);
        $recurso = $consulta->fetch();
        return $recurso ?: null;
    }

    public function usuarioPorCorreo(string $correo): ?array
    {
        $consulta = $this->db->prepare('SELECT * FROM usuarios WHERE correo = ?');
        $consulta->execute([$correo]);
        $usuario = $consulta->fetch();
        return $usuario ?: null;
    }

    public function crearReserva(int $usuario, int $recurso, int $plazas, float $presupuesto): void
    {
        $estado = $this->estadoConfirmada();
        $consulta = $this->db->prepare('INSERT INTO reservas(id_usuario, id_recurso, id_estado, plazas, presupuesto) VALUES(?, ?, ?, ?, ?)');
        $consulta->execute([$usuario, $recurso, $estado, $plazas, $presupuesto]);
    }

    public function reservasUsuario(string $correo): array
    {
        $sql = 'SELECT re.id_reserva, r.nombre, e.nombre AS estado, re.plazas, re.presupuesto, re.fecha_reserva
                FROM reservas re
                INNER JOIN usuarios u ON re.id_usuario = u.id_usuario
                INNER JOIN recursos r ON re.id_recurso = r.id_recurso
                INNER JOIN estados_reserva e ON re.id_estado = e.id_estado
                WHERE u.correo = ?
                ORDER BY re.fecha_reserva DESC';
        $consulta = $this->db->prepare($sql);
        $consulta->execute([$correo]);
        return $consulta->fetchAll();
    }

    public function anularReserva(int $reserva, string $correo): void
    {
        $estado = $this->estadoAnulada();
        $sql = 'UPDATE reservas re INNER JOIN usuarios u ON re.id_usuario = u.id_usuario
                SET re.id_estado = ?
                WHERE re.id_reserva = ? AND u.correo = ?';
        $consulta = $this->db->prepare($sql);
        $consulta->execute([$estado, $reserva, $correo]);
    }

    private function estadoConfirmada(): int
    {
        return $this->estadoPorNombre('Confirmada');
    }

    private function estadoAnulada(): int
    {
        return $this->estadoPorNombre('Anulada');
    }

    private function estadoPorNombre(string $nombre): int
    {
        $consulta = $this->db->prepare('SELECT id_estado FROM estados_reserva WHERE nombre = ?');
        $consulta->execute([$nombre]);
        return (int)$consulta->fetchColumn();
    }
}

class AplicacionReservas
{
    private ?RepositorioReservas $repositorio = null;
    private string $mensaje = '';

    public function ejecutar(): void
    {
        try {
            $this->repositorio = new RepositorioReservas((new ConexionReservas())->obtener());
            $this->procesar();
            $this->imprimirPagina();
        } catch (Throwable $error) {
            $this->mensaje = 'No se pudo conectar con la base de datos. Revisa que MySQL/MariaDB tenga creada la base sevilla_reservas y el usuario DBUSER2026.';
            $this->imprimirPagina(false);
        }
    }

    private function procesar(): void
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return;
        }
        $accion = $_POST['accion'] ?? '';
        if ($accion === 'registro') {
            $this->repositorio->registrarUsuario($this->texto('nombre'), $this->texto('correo'), $this->texto('telefono'));
            $this->mensaje = 'Usuario registrado correctamente.';
        }
        if ($accion === 'reserva') {
            $this->reservar();
        }
        if ($accion === 'anular') {
            $this->repositorio->anularReserva((int)($_POST['reserva'] ?? 0), $this->texto('correo'));
            $this->mensaje = 'Reserva anulada correctamente.';
        }
    }

    private function reservar(): void
    {
        $usuario = $this->repositorio->usuarioPorCorreo($this->texto('correo'));
        $recurso = $this->repositorio->recurso((int)($_POST['recurso'] ?? 0));
        $plazas = max(1, (int)($_POST['plazas'] ?? 1));
        if ($usuario === null || $recurso === null) {
            $this->mensaje = 'El usuario debe estar registrado y el recurso debe existir.';
            return;
        }
        if ($plazas > (int)$recurso['plazas']) {
            $this->mensaje = 'No hay plazas suficientes para ese recurso.';
            return;
        }
        $presupuesto = $plazas * (float)$recurso['precio'];
        $this->repositorio->crearReserva((int)$usuario['id_usuario'], (int)$recurso['id_recurso'], $plazas, $presupuesto);
        $this->mensaje = 'Reserva confirmada. Presupuesto total: ' . number_format($presupuesto, 2, ',', '.') . ' euros.';
    }

    private function texto(string $campo): string
    {
        return trim((string)($_POST[$campo] ?? ''));
    }

    private function imprimirPagina(bool $conDatos = true): void
    {
        $recursos = $conDatos && $this->repositorio !== null ? $this->repositorio->recursos() : [];
        $reservas = $conDatos && $this->repositorio !== null && isset($_POST['correo']) ? $this->repositorio->reservasUsuario($this->texto('correo')) : [];
        echo '<!DOCTYPE HTML><html lang="es"><head><meta charset="UTF-8" />';
        echo '<title>Sevilla-Desktop - Reservas</title><meta name="author" content="Hugo Tejedor" />';
        echo '<meta name="description" content="Central de reservas de recursos turísticos de Sevilla" />';
        echo '<meta name="viewport" content="width=device-width, initial-scale=1.0" />';
        echo '<link rel="stylesheet" type="text/css" href="estilo/estilo.css" />';
        echo '<link rel="stylesheet" type="text/css" href="estilo/layout.css" /></head><body>';
        $this->cabecera();
        echo '<p>Estás en: <a href="index.html">Inicio</a> &gt; Reservas</p><main><section>';
        echo '<h2>Central de reservas turísticas</h2>';
        if ($this->mensaje !== '') {
            echo '<p>' . htmlspecialchars($this->mensaje, ENT_QUOTES, 'UTF-8') . '</p>';
        }
        $this->formularioRegistro();
        $this->tablaRecursos($recursos);
        $this->formularioReserva($recursos);
        $this->tablaReservas($reservas);
        echo '</section></main><footer><p>Proyecto de Software y Estándares para la Web.</p></footer></body></html>';
    }

    private function cabecera(): void
    {
        echo '<header><h1><a href="index.html" title="Volver a la página principal">Sevilla-Desktop</a></h1><nav>';
        echo '<a href="index.html" title="Inicio">Inicio</a>';
        echo '<a href="gastronomia.html" title="Gastronomía">Gastronomía</a>';
        echo '<a href="rutas.html" title="Rutas">Rutas</a>';
        echo '<a href="meteorologia.html" title="Meteorología">Meteorología</a>';
        echo '<a href="juego.html" title="Juego">Juego</a>';
        echo '<a href="reservas.php" class="activo" title="Reservas">Reservas</a>';
        echo '<a href="ayuda.html" title="Ayuda">Ayuda</a>';
        echo '</nav></header>';
    }

    private function formularioRegistro(): void
    {
        echo '<article><h3>Registro de usuarios</h3><form action="reservas.php" method="post">';
        echo '<input type="hidden" name="accion" value="registro" />';
        echo '<label>Nombre <input type="text" name="nombre" required /></label>';
        echo '<label>Correo electrónico <input type="email" name="correo" required /></label>';
        echo '<label>Teléfono <input type="tel" name="telefono" required /></label>';
        echo '<button type="submit">Registrarse</button></form></article>';
    }

    private function tablaRecursos(array $recursos): void
    {
        echo '<article><h3>Recursos turísticos disponibles</h3><table><caption>Recursos reservables</caption>';
        echo '<thead><tr><th scope="col">Recurso</th><th scope="col">Tipo</th><th scope="col">Plazas</th><th scope="col">Horario</th><th scope="col">Precio</th></tr></thead><tbody>';
        foreach ($recursos as $recurso) {
            echo '<tr><td>' . htmlspecialchars($recurso['nombre'], ENT_QUOTES, 'UTF-8') . '</td>';
            echo '<td>' . htmlspecialchars($recurso['tipo'], ENT_QUOTES, 'UTF-8') . '</td>';
            echo '<td>' . (int)$recurso['plazas'] . '</td>';
            echo '<td>' . htmlspecialchars($recurso['inicio'] . ' - ' . $recurso['fin'], ENT_QUOTES, 'UTF-8') . '</td>';
            echo '<td>' . number_format((float)$recurso['precio'], 2, ',', '.') . ' euros</td></tr>';
        }
        echo '</tbody></table></article>';
    }

    private function formularioReserva(array $recursos): void
    {
        echo '<article><h3>Reserva de recurso turístico</h3><form action="reservas.php" method="post">';
        echo '<input type="hidden" name="accion" value="reserva" />';
        echo '<label>Correo registrado <input type="email" name="correo" required /></label>';
        echo '<label>Recurso <select name="recurso" required>';
        echo '<option value="" disabled selected>Selecciona un recurso...</option>';
        foreach ($recursos as $recurso) {
            echo '<option value="' . (int)$recurso['id_recurso'] . '">' . htmlspecialchars($recurso['nombre'], ENT_QUOTES, 'UTF-8') . '</option>';
        }
        echo '</select></label><label>Plazas <input type="number" name="plazas" min="1" value="1" required /></label>';
        echo '<button type="submit">Confirmar reserva</button></form></article>';
    }

    private function tablaReservas(array $reservas): void
    {
        echo '<article><h3>Consulta y anulación de reservas</h3><form action="reservas.php" method="post">';
        echo '<input type="hidden" name="accion" value="consulta" />';
        echo '<label>Correo registrado <input type="email" name="correo" required /></label>';
        echo '<button type="submit">Consultar reservas</button></form>';
        if (count($reservas) === 0) {
            echo '<p>No hay reservas que mostrar para el correo indicado.</p></article>';
            return;
        }
        echo '<table><caption>Reservas del usuario</caption><thead><tr><th scope="col">Recurso</th><th scope="col">Estado</th><th scope="col">Plazas</th><th scope="col">Presupuesto</th><th scope="col">Acción</th></tr></thead><tbody>';
        foreach ($reservas as $reserva) {
            echo '<tr><td>' . htmlspecialchars($reserva['nombre'], ENT_QUOTES, 'UTF-8') . '</td>';
            echo '<td>' . htmlspecialchars($reserva['estado'], ENT_QUOTES, 'UTF-8') . '</td>';
            echo '<td>' . (int)$reserva['plazas'] . '</td>';
            echo '<td>' . number_format((float)$reserva['presupuesto'], 2, ',', '.') . ' euros</td><td>';
            echo '<form action="reservas.php" method="post"><input type="hidden" name="accion" value="anular" />';
            echo '<input type="hidden" name="correo" value="' . htmlspecialchars($this->texto('correo'), ENT_QUOTES, 'UTF-8') . '" />';
            echo '<input type="hidden" name="reserva" value="' . (int)$reserva['id_reserva'] . '" />';
            echo '<button type="submit">Anular</button></form></td></tr>';
        }
        echo '</tbody></table></article>';
    }
}