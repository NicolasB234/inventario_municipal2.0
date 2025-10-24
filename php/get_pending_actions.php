<?php
require_once 'db_connect.php';
header('Content-Type: application/json');
session_start();

$response = ['success' => false, 'data' => [], 'message' => ''];
$is_admin = $_SESSION['is_admin'] ?? false;

if (!$is_admin) {
    $response['message'] = 'Acceso denegado. Se requieren permisos de administrador.';
    echo json_encode($response);
    exit;
}

try {
    $result = $conn->query("SELECT id, user_id, username, action_type, item_id, action_data, created_at FROM pending_actions WHERE status = 'pending' ORDER BY created_at DESC");
    
    $actions = [];
    while ($row = $result->fetch_assoc()) {
        $actions[] = $row;
    }

    $response['success'] = true;
    $response['data'] = $actions;

} catch (Exception $e) {
    $response['message'] = 'Error de servidor: ' . $e->getMessage();
}

$conn->close();
echo json_encode($response);
?>