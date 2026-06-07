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
                $claveCli = $this->obtenerClaveCli();
                $exito = $this->repositorio->registrarUsuario(
                    $this->limpiar((string)($_POST['nombre'] ?? '')),
                    $this->obtenerCorreo(),
                    $claveCli
                );
                $_SESSION['mensaje'] = $exito ? 'Usuario registrado. Ya puede iniciar sesion.' : 'Error: no se pudo registrar el usuario.';
            }

            if ($accion === 'login') {
                $claveCli = $this->obtenerClaveCli();
                $usuario = $this->repositorio->autenticarUsuario($this->obtenerCorreo(), $claveCli);
                if ($usuario) {
                    $_SESSION['usuario_id'] = $usuario['id_usuario'];
                    $_SESSION['usuario_nombre'] = $usuario['nombre'];
                } else {
                    $_SESSION['mensaje'] = 'Credenciales incorrectas.';
                }
            }

            if ($accion === 'reserva' && isset($_SESSION['usuario_id'])) {
                $plazas = max(1, (int)($_POST['plazas'] ?? 1));
                $resultado = $this->repositorio->crearReserva($_SESSION['usuario_id'], (int)($_POST['recurso'] ?? 0), $plazas);
                $_SESSION['mensaje'] = $resultado['ok']
                    ? 'Reserva confirmada con exito.'
                    : 'Error al reservar: ' . $resultado['error'];
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

    private function obtenerCorreo(): string
    {
        return $this->limpiar((string)($_POST['correo'] ?? $_POST['email_cli'] ?? ''));
    }

    private function obtenerClaveCli(): string
    {
        return (string)($_POST['clave_cli'] ?? '');
    }
}



