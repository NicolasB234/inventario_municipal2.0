<?php
// --- Archivo de Solución: reset_admin_password.php ---

echo "<h1>Restableciendo la Contraseña del Administrador</h1>";

// 1. Incluir la conexión a la base de datos.
require_once 'db_connect.php';
echo "Paso 1: Conectando a la base de datos...<br>";

if ($conn->connect_error) {
    die("<strong>ERROR CRÍTICO:</strong> No se pudo conectar a la base de datos. Verifica 'db_connect.php'.");
}
echo "Conexión exitosa.<br>";

// 2. Definir la nueva contraseña y generar su hash.
$new_password = 'admin';
// Usamos la propia función de tu servidor para generar un hash 100% compatible.
$new_password_hash = password_hash($new_password, PASSWORD_DEFAULT);

echo "Paso 2: Generando un nuevo hash para la contraseña 'admin'...<br>";
echo "Nuevo hash generado: <strong>" . htmlspecialchars($new_password_hash) . "</strong><br>";

// 3. Actualizar la contraseña en la base de datos.
echo "Paso 3: Actualizando la contraseña para el usuario 'admin' en la base de datos...<br>";

$stmt = $conn->prepare("UPDATE users SET password_hash = ? WHERE username = 'admin'");
$stmt->bind_param("s", $new_password_hash);

if ($stmt->execute()) {
    echo "<h2><font color='green'>¡ÉXITO!</font></h2>";
    echo "La contraseña del usuario 'admin' ha sido restablecida correctamente.<br>";
    echo "Ya puedes iniciar sesión con:<br>";
    echo "<ul><li><strong>Usuario:</strong> admin</li><li><strong>Contraseña:</strong> admin</li></ul>";
    echo "<p><strong style='color:red; font-size: 1.2em;'>¡ADVERTENCIA DE SEGURIDAD!</strong><br> Por favor, elimina este archivo (<code>reset_admin_password.php</code>) y cualquier otro archivo de prueba de tu servidor inmediatamente.</p>";
} else {
    echo "<h2><font color='red'>¡FALLO!</font></h2>";
    echo "No se pudo actualizar la contraseña en la base de datos. Error: " . $stmt->error;
}

$stmt->close();
$conn->close();
?>