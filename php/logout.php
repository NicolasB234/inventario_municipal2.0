<?php
// logout.php
session_start(); // Iniciar la sesión para poder destruirla

// Destruir todas las variables de sesión
$_SESSION = array();

// Borrar la cookie de sesión.
// Nota: Esto destruirá la sesión, y no solo los datos de sesión!
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], $params["domain"],
        $params["secure"], $params["httponly"]
    );
}

// Finalmente, destruir la sesión.
session_destroy();

// Redirigir al usuario a la página de inicio de sesión
header("Location: ../login.html"); // Asumiendo que login.html está un nivel arriba
exit();
?>