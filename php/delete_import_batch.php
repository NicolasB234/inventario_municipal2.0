<?php
require_once 'db_connect.php';
require_once 'log_activity.php';
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
$batch_id = $input['batch_id'] ?? null;

if (!$batch_id) {
    $response['message'] = 'ID de lote no proporcionado.';
    echo json_encode($response);
    exit;
}

try {
    $conn->begin_transaction();

    $stmt = $conn->prepare("DELETE FROM import_staging WHERE import_batch_id = ?");
    $stmt->bind_param("s", $batch_id);
    
    if ($stmt->execute()) {
        $affected_rows = $stmt->affected_rows;
        if ($affected_rows > 0) {
            $conn->commit();
            $response['success'] = true;
            $response['message'] = "Lote {$batch_id} eliminado exitosamente. Se eliminaron {$affected_rows} ítems.";
            log_activity($conn, $_SESSION['user_id'], $_SESSION['username'], 'import_batch_delete', "Eliminó el lote {$batch_id} ({$affected_rows} ítems).");
        } else {
            $conn->rollback();
            $response['message'] = 'No se encontraron ítems para ese lote o ya fue eliminado.';
        }
    } else {
        throw new Exception('Error al eliminar: ' . $stmt->error);
    }

    $stmt->close();

} catch (Exception $e) {
    $conn->rollback();
    $response['message'] = 'Error de servidor: ' . $e->getMessage();
}

$conn->close();
echo json_encode($response);
?>