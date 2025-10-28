<?php
require_once 'db_connect.php';
require_once 'log_activity.php';
header('Content-Type: application/json');
session_start();

$response = ['success' => false, 'message' => ''];
$is_admin = $_SESSION['is_admin'] ?? false;

// Solo los admins pueden eliminar ítems de staging
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

if (empty($staging_id) || !is_numeric($staging_id)) {
    $response['message'] = 'ID de ítem no válido.';
    echo json_encode($response);
    exit;
}

try {
    $stmt = $conn->prepare("DELETE FROM import_staging WHERE staging_id = ?");
    $stmt->bind_param("i", $staging_id);
    
    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            $response['success'] = true;
            $response['message'] = 'Ítem eliminado del lote exitosamente.';
            // Opcional: registrar esta acción en el log de actividad
            log_activity($conn, $_SESSION['user_id'], $_SESSION['username'], 'import_staging_delete_item', "Eliminó el ítem de staging ID {$staging_id} de un lote pendiente.");
        } else {
            $response['message'] = 'No se encontró el ítem o ya fue eliminado.';
        }
    } else {
        throw new Exception('Error al ejecutar la consulta: ' . $stmt->error);
    }

    $stmt->close();

} catch (Exception $e) {
    $response['message'] = 'Error de servidor: ' . $e->getMessage();
}

$conn->close();
echo json_encode($response);
?>