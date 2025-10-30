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
    // --- INICIO DE LA MODIFICACIÓN ---
    // Se añade i.description a la consulta SELECT
    $sql = "SELECT
                p.id, p.user_id, p.username, p.action_type, p.item_id, p.action_data, p.created_at,
                i.codigo_item, i.name, i.imagePath, i.description
            FROM
                pending_actions p
            LEFT JOIN
                inventory_items i ON p.item_id = i.id
            WHERE
                p.status = 'pending'
            ORDER BY
                p.created_at DESC";
    
    $result = $conn->query($sql);
    // --- FIN DE LA MODIFICACIÓN ---

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