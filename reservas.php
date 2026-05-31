<?php
session_start();
require_once 'php/ConexionReservas.php';
require_once 'php/RepositorioReservas.php';

class AplicacionReservas
{
    private RepositorioReservas $repositorio;
    public string $mensajeSistema = '';
    public array $datosRecursos = [];
    public array $datosReservas = [];

    public function __construct()
    {
        $conexion = new ConexionReservas();
        $this->repositorio = new RepositorioReservas($conexion->obtenerConexion());
    }

    public function procesarPeticiones(): void
    {
        if (isset($_GET['cerrar_sesion'])) {
            session_destroy();
            header("Location: reservas.php");
            exit;
        }

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $accion = $_POST['accion'] ?? '';

            if ($accion === 'registro') {
                $exito = $this->repositorio->registrarUsuario($this->limpiar($_POST['nombre']), $this->limpiar($_POST['correo']), $this->limpiar($_POST['telefono']));
                $_SESSION['mensaje'] = $exito ? "Usuario registrado. Ya puede iniciar sesión." : "Error: El correo ya está registrado.";
            }

            if ($accion === 'login') {
                $usuario = $this->repositorio->autenticarUsuario($this->limpiar($_POST['correo']), $this->limpiar($_POST['telefono']));
                if ($usuario) {
                    $_SESSION['usuario_id'] = $usuario['id_usuario'];
                    $_SESSION['usuario_nombre'] = $usuario['nombre'];
                } else {
                    $_SESSION['mensaje'] = "Credenciales incorrectas.";
                }
            }

            if ($accion === 'reserva' && isset($_SESSION['usuario_id'])) {
                $plazas = max(1, (int)($_POST['plazas'] ?? 1));
                $exito = $this->repositorio->crearReserva($_SESSION['usuario_id'], (int)$_POST['recurso'], $plazas);
                $_SESSION['mensaje'] = $exito ? "Reserva confirmada con éxito." : "Error: No hay plazas suficientes.";
            }

            if ($accion === 'anular' && isset($_SESSION['usuario_id'])) {
                $this->repositorio->anularReserva((int)$_POST['reserva'], $_SESSION['usuario_id']);
                $_SESSION['mensaje'] = "La reserva ha sido anulada.";
            }

            // Patrón Post-Redirect-Get para evitar reenvío de formularios
            header("Location: reservas.php");
            exit;
        }

        // Cargar datos necesarios para la vista
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

// Inicializamos y ejecutamos la lógica antes de renderizar nada de HTML
$app = new AplicacionReservas();
$app->procesarPeticiones();
?>
<!DOCTYPE HTML>
<html lang="es">
<head>
    <meta charset="UTF-8" />
    <title>Sevilla-Desktop - Reservas</title>
    <meta name="author" content="Tu Nombre Aquí" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" type="text/css" href="estilo/estilo.css" />
    <link rel="stylesheet" type="text/css" href="estilo/layout.css" />
</head>
<body>
    <header>
        <h1><a href="index.html" title="Volver a la página principal">Sevilla-Desktop</a></h1>
        <nav>
            <a href="index.html" title="Inicio">Inicio</a>
            <a href="gastronomia.html" title="Gastronomía">Gastronomía</a>
            <a href="rutas.html" title="Rutas">Rutas</a>
            <a href="meteorologia.html" title="Meteorología">Meteorología</a>
            <a href="juego.html" title="Juego">Juego</a>
            <a href="reservas.php" class="activo" title="Reservas">Reservas</a>
            <a href="ayuda.html" title="Ayuda">Ayuda</a>
        </nav>
    </header>

    <p>Estás en: <a href="index.html">Inicio</a> &gt; Reservas</p>

    <main>
        <section>
            <h2>Central de reservas turísticas</h2>

            <?php if ($app->mensajeSistema !== ''): ?>
                <p><strong><?php echo $app->mensajeSistema; ?></strong></p>
            <?php endif; ?>

            <?php if (!isset($_SESSION['usuario_id'])): ?>
                <article>
                    <h3>Acceso de Usuarios</h3>
                    <form action="reservas.php" method="post">
                        <input type="hidden" name="accion" value="login" />
                        <label>Correo electrónico <input type="email" name="correo" required /></label>
                        <label>Teléfono (Contraseña) <input type="tel" name="telefono" required /></label>
                        <button type="submit">Entrar</button>
                    </form>
                </article>

                <article>
                    <h3>Nuevo Registro</h3>
                    <form action="reservas.php" method="post">
                        <input type="hidden" name="accion" value="registro" />
                        <label>Nombre <input type="text" name="nombre" required /></label>
                        <label>Correo electrónico <input type="email" name="correo" required /></label>
                        <label>Teléfono <input type="tel" name="telefono" required /></label>
                        <button type="submit">Registrarse</button>
                    </form>
                </article>

            <?php else: ?>
                <p>Bienvenido, <strong><?php echo htmlspecialchars($_SESSION['usuario_nombre']); ?></strong>. <a href="reservas.php?cerrar_sesion=1">Cerrar sesión</a></p>

                <article>
                    <h3>Mis Reservas</h3>
                    <?php if (count($app->datosReservas) === 0): ?>
                        <p>No tienes reservas activas.</p>
                    <?php else: ?>
                        <table>
                            <caption>Tus actividades reservadas</caption>
                            <thead>
                                <tr>
                                    <th scope="col">Recurso</th>
                                    <th scope="col">Estado</th>
                                    <th scope="col">Plazas</th>
                                    <th scope="col">Total</th>
                                    <th scope="col">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($app->datosReservas as $reserva): ?>
                                    <tr>
                                        <td><?php echo $reserva['nombre']; ?></td>
                                        <td><?php echo $reserva['estado']; ?></td>
                                        <td><?php echo $reserva['plazas']; ?></td>
                                        <td><?php echo number_format((float)$reserva['presupuesto'], 2, ',', '.'); ?> €</td>
                                        <td>
                                            <?php if ($reserva['estado'] === 'Confirmada'): ?>
                                                <form action="reservas.php" method="post">
                                                    <input type="hidden" name="accion" value="anular" />
                                                    <input type="hidden" name="reserva" value="<?php echo $reserva['id_reserva']; ?>" />
                                                    <button type="submit">Anular</button>
                                                </form>
                                            <?php endif; ?>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    <?php endif; ?>
                </article>

                <article>
                    <h3>Nueva Reserva</h3>
                    <form action="reservas.php" method="post">
                        <input type="hidden" name="accion" value="reserva" />
                        <label>Recurso:
                            <select name="recurso" required>
                                <option value="" disabled selected>Selecciona un recurso...</option>
                                <?php foreach ($app->datosRecursos as $recurso): ?>
                                    <option value="<?php echo $recurso['id_recurso']; ?>">
                                        <?php echo htmlspecialchars($recurso['nombre']); ?> (<?php echo $recurso['precio']; ?>€) - Plazas: <?php echo $recurso['plazas']; ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </label>
                        <label>Plazas: <input type="number" name="plazas" min="1" value="1" required /></label>
                        <button type="submit">Confirmar Reserva</button>
                    </form>
                </article>
            <?php endif; ?>
        </section>
    </main>
    <footer>
        <p>Proyecto de Software y Estándares para la Web.</p>
    </footer>
</body>
</html>