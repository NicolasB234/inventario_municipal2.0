<?php
// --- VERSIÓN DE DIAGNÓSTICO FINAL ---

// Paso 1: Forzar la visualización de todos los errores posibles.
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once 'db_connect.php';
session_start();
header('Content-Type: application/json');

$response = ['success' => false, 'message' => '', 'areaId' => null, 'isAdmin' => false];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim(isset($_POST['username']) ? $_POST['username'] : '');
    $password = trim(isset($_POST['password']) ? $_POST['password'] : '');

    if (empty($username) || empty($password)) {
        $response['message'] = 'Por favor, introduzca el usuario y la contraseña.';
        echo json_encode($response);
        exit();
    }
    
    // CAMBIO: La consulta ahora también selecciona el campo is_admin
    $stmt = $conn->prepare("SELECT id, password_hash, area_id, is_admin FROM users WHERE username = ?");
    
    if ($stmt === false) {
        $response['message'] = 'Error de servidor: Fallo al preparar la consulta. ' . $conn->error;
        echo json_encode($response);
        exit();
    }
    
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 1) {
        $user = $result->fetch_assoc();
        
        if (password_verify($password, $user['password_hash'])) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $username;
            $_SESSION['area_id'] = $user['area_id'];
            // CAMBIO: El rol de admin ahora se lee de la base de datos
            $_SESSION['is_admin'] = (bool)$user['is_admin'];

            $response['success'] = true;
            $response['message'] = 'Inicio de sesión exitosa.';
            $response['areaId'] = $user['area_id'];
            // CAMBIO: Se devuelve el rol de admin desde la base de datos
            $response['isAdmin'] = (bool)$user['is_admin'];
        } else {
            $response['message'] = 'Usuario o contraseña incorrecta.';
        }
    } else {
        $response['message'] = 'Usuario o contraseña incorrectos.';
    }
    $stmt->close();
} else {
    $response['message'] = 'Método de solicitud no válido.';
}

$conn->close();
echo json_encode($response);
?>