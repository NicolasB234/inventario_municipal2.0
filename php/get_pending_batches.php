<?php
require_once 'db_connect.php';
header('Content-Type: application/json');
session_start();

$response = ['success' => false, 'data' => [], 'message' => ''];
$user_id = $_SESSION['user_id'] ?? null;
$is_admin = $_SESSION['is_admin'] ?? false;

if (!$user_id) {
    $response['message'] = 'Acceso denegado.';
    echo json_encode($response);
    exit;
}

try {
    // Agrupamos por batch_id para obtener un resumen de cada lote
    $sql = "SELECT 
                import_batch_id, 
                user_id, 
                username, 
                area_id, 
                MIN(created_at) as created_at, 
                COUNT(*) as item_count
            FROM 
                import_staging 
            WHERE 
                status != 'approved'"; // Mostramos todos los que no estén aprobados
    
    if (!$is_admin) {
        // Si no es admin, solo puede ver sus propios lotes
        $sql .= " AND user_id = ?";
    }
    
    $sql .= " GROUP BY import_batch_id, user_id, username, area_id ORDER BY created_at DESC";

    $stmt = $conn->prepare($sql);
    
    if (!$is_admin) {
        $stmt->bind_param("i", $user_id);
    }
    
    $stmt->execute();
    $result = $stmt->get_result();
    
    $batches = [];
    while ($row = $result->fetch_assoc()) {
        $batches[] = $row;
    }

    $response['success'] = true;
    $response['data'] = $batches;
    $response['is_admin'] = $is_admin; // Devolvemos esto para la lógica del frontend

} catch (Exception $e) {
    $response['message'] = 'Error de servidor: ' . $e->getMessage();
}

$conn->close();
echo json_encode($response);
?>