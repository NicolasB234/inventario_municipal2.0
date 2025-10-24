<?php
require_once 'db_connect.php';
session_start();
header('Content-Type: application/json');

$response = [
    'new_notifications' => [],
    'pending_admin_requests' => 0,
    'refresh_inventory' => false
];

if (!isset($_SESSION['user_id'])) {
    echo json_encode($response);
    exit;
}

// Definimos las variables a partir de la sesión y los parámetros GET.
$user_id = (int)$_SESSION['user_id'];
$is_admin = isset($_SESSION['is_admin']) && $_SESSION['is_admin'] === true;
$last_id = isset($_GET['last_id']) ? (int)$_GET['last_id'] : 0;

try {
    // --- LÓGICA PARA ADMINISTRADORES ---
    if ($is_admin) {
        $result_pending = $conn->query("SELECT COUNT(*) as count FROM pending_actions WHERE status = 'pending'");
        if ($result_pending) {
            $response['pending_admin_requests'] = (int)$result_pending->fetch_assoc()['count'];
        }
        
        $stmt_logs = $conn->prepare("SELECT * FROM activity_log WHERE recipient_user_id IS NULL AND id > ? ORDER BY id ASC");
        $stmt_logs->bind_param("i", $last_id);
        $stmt_logs->execute();
        $result_logs = $stmt_logs->get_result();
        
        while ($row = $result_logs->fetch_assoc()) {
            $response['new_notifications'][] = $row;
        }
        $stmt_logs->close();

    // --- LÓGICA PARA USUARIOS NORMALES ---
    } else {
        $stmt = $conn->prepare("SELECT * FROM activity_log WHERE recipient_user_id = ? AND id > ? ORDER BY id ASC");
        $stmt->bind_param("ii", $user_id, $last_id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        while ($row = $result->fetch_assoc()) {
            $response['new_notifications'][] = $row;
            if (in_array($row['action_type'], ['request_approved', 'request_rejected', 'item_added_by_admin', 'item_edited_by_admin', 'item_decommissioned_by_admin', 'bulk_import_by_admin'])) {
                $response['refresh_inventory'] = true;
            }
        }
        $stmt->close();
    }

} catch (Exception $e) {
    // Silencio en caso de error.
}

$conn->close();
echo json_encode($response);
?>