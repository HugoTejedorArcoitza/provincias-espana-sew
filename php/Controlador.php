<?php
declare(strict_types=1);

require_once __DIR__ . '/ConexionReservas.php';
require_once __DIR__ . '/RepositorioReservas.php';

class Controlador
{
    private RepositorioReservas $repositorio;
    public string $mensajeSistema = '';
    public array $datosRecursos = [];
    public array $datosReservas = [];

    public static function ejecutar(): self
    {
        session_start();
        $controlador = new self();
        $controlador->procesarPeticiones();
        return $controlador;
    }

    public function __construct()
    {
        $conexion = new ConexionReservas();
        $this->repositorio = new RepositorioReservas($conexion->obtenerConexion());
    }

    public function procesarPeticiones(): void
    {
        if (isset($_GET['cerrar_sesion'])) {
            session_destroy();
            header('Location: reservas.php');
            exit;
        }

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $accion = $_POST['accion'] ?? '';

            if ($accion === 'registro') {
                $exito = $this->repositorio->registrarUsuario($this->limpiar($_POST['nombre']), $this->limpiar($_POST['correo']), $this->limpiar($_POST['telefono']));
                $_SESSION['mensaje'] = $exito ? 'Usuario registrado. Ya puede iniciar sesión.' : 'Error: El correo ya está registrado.';
            }

            if ($accion === 'login') {
                $usuario = $this->repositorio->autenticarUsuario($this->limpiar($_POST['correo']), $this->limpiar($_POST['telefono']));
                if ($usuario) {
                    $_SESSION['usuario_id'] = $usuario['id_usuario'];
                    $_SESSION['usuario_nombre'] = $usuario['nombre'];
                } else {
                    $_SESSION['mensaje'] = 'Credenciales incorrectas.';
                }
            }

            if ($accion === 'reserva' && isset($_SESSION['usuario_id'])) {
                $plazas = max(1, (int)($_POST['plazas'] ?? 1));
                $exito = $this->repositorio->crearReserva($_SESSION['usuario_id'], (int)$_POST['recurso'], $plazas);
                $_SESSION['mensaje'] = $exito ? 'Reserva confirmada con éxito.' : 'Error: No hay plazas suficientes.';
            }

            if ($accion === 'anular' && isset($_SESSION['usuario_id'])) {
                $this->repositorio->anularReserva((int)$_POST['reserva'], $_SESSION['usuario_id']);
                $_SESSION['mensaje'] = 'La reserva ha sido anulada.';
            }

            header('Location: reservas.php');
            exit;
        }

        if (isset($_SESSION['mensaje'])) {
            $this->mensajeSistema = $_SESSION['mensaje'];
            unset($_SESSION['mensaje']);
        }

        $this->datosRecursos = $this->repositorio->obtenerRecursos();
        if (isset($_SESSION['usuario_id'])) {
            $this->datosReservas = $this->repositorio->obtenerReservasUsuario($_SESSION['usuario_id']);
        }
    }

    private function limpiar(string $dato): string
    {
        return htmlspecialchars(trim($dato), ENT_QUOTES, 'UTF-8');
    }
}



