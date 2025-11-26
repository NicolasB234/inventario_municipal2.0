<?php
require_once 'db_connect.php';
header('Content-Type: application/json');
session_start();

$response = ['success' => false, 'message' => ''];
$is_admin = $_SESSION['is_admin'] ?? false;

if (!$is_admin) {
    $response['message'] = 'Acceso denegado. Se requieren permisos de administrador.';
    echo json_encode($response);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    $response['message'] = 'Método no permitido.';
    echo json_encode($response);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$staging_id = $input['staging_id'] ?? null;
$new_item_data = $input['item_data'] ?? null; // Esto debe ser un objeto/array

if (!$staging_id || !$new_item_data) {
    $response['message'] = 'Datos incompletos. Se requiere staging_id y item_data.';
    echo json_encode($response);
    exit;
}

try {
    // Convertimos los nuevos datos a JSON para guardarlos
    $new_item_data_json = json_encode($new_item_data);

    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Error al codificar los nuevos datos JSON.');
    }

    $stmt = $conn->prepare("UPDATE import_staging SET item_data_json = ?, status = 'edited' WHERE staging_id = ?");
    $stmt->bind_param("si", $new_item_data_json, $staging_id);
    
    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            $response['success'] = true;
            $response['message'] = 'Ítem actualizado en staging.';
        } else {
            $response['message'] = 'No se encontró el ítem en staging o no hubo cambios.';
        }
    } else {
        throw new Exception('Error al actualizar: ' . $stmt->error);
    }

    $stmt->close();

} catch (Exception $e) {
    $response['message'] = 'Error de servidor: ' . $e->getMessage();
}

$conn->close();
echo json_encode($response);
?>