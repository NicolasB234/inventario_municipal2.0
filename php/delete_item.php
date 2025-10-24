<?php
require_once 'db_connect.php';
require_once 'log_activity.php';
require_once 'org-structure-data.php';
require_once 'utils.php';
header('Content-Type: application/json');
session_start();

$response = ['success' => false, 'message' => ''];
$is_admin = $_SESSION['is_admin'] ?? false;

if (!isset($_SESSION['user_id'])) {
    $response['message'] = 'Acceso no autorizado.';
    echo json_encode($response);
    exit;
}

$id = $_POST['id'] ?? 0;

if ($id > 0) {
    // Primero, obtenemos los detalles del ítem para poder registrarlos antes de modificarlos.
    $stmt_get = $conn->prepare("SELECT * FROM inventory_items WHERE id = ?");
    $stmt_get->bind_param("i", $id);
    $stmt_get->execute();
    $result = $stmt_get->get_result();
    $item = $result->fetch_assoc();
    $stmt_get->close();

    if (!$item) {
        $response['message'] = 'El ítem no existe.';
        echo json_encode($response);
        exit;
    }

    $areaName = getAreaNameById($orgStructure, $item['node_id']) ?? 'un área desconocida';

    if ($is_admin) {
        // --- INICIO DE LA CORRECCIÓN ---
        // Se implementa un borrado lógico (soft delete) en lugar de un borrado físico.
        $stmt_delete = $conn->prepare("UPDATE inventory_items SET status = 'D' WHERE id = ?");
        // --- FIN DE LA CORRECCIÓN ---
        
        $stmt_delete->bind_param("i", $id);
        
        if ($stmt_delete->execute()) {
            $response['success'] = true;
            $response['message'] = 'Ítem dado de baja correctamente.';
            
            // Se actualiza el mensaje de log para reflejar el cambio de estado.
            $admin_log_details = "Admin '{$_SESSION['username']}' dio de baja el ítem '{$item['name']}' (ID: {$id}) del área '{$areaName}'.";
            log_activity($conn, $_SESSION['user_id'], $_SESSION['username'], 'item_decommissioned_admin', $admin_log_details);

            // Notificamos a los usuarios del área afectada que el ítem fue dado de baja.
            $stmt_find_users = $conn->prepare("SELECT id FROM users WHERE area_id = ?");
            $stmt_find_users->bind_param("s", $item['node_id']);
            $stmt_find_users->execute();
            $users_result = $stmt_find_users->get_result();
            
            while ($user = $users_result->fetch_assoc()) {
                $user_notification_details = "El administrador '{$_SESSION['username']}' dio de baja el ítem '{$item['name']}' de tu área.";
                log_activity($conn, $_SESSION['user_id'], $_SESSION['username'], 'item_decommissioned_by_admin', $user_notification_details, $user['id']);
            }
            $stmt_find_users->close();

        } else {
            $response['message'] = 'Error al dar de baja el ítem.';
        }
        $stmt_delete->close();

    } else {
        // La lógica para la solicitud del usuario normal no cambia.
        // Sigue generando una solicitud de baja para que el admin la apruebe.
        $action_data = json_encode(['item_id' => $id, 'item_name' => $item['name']]);
        $stmt_request = $conn->prepare(
            "INSERT INTO pending_actions (user_id, username, action_type, item_id, action_data, status) VALUES (?, ?, 'decommission', ?, ?, 'pending')"
        );
        $stmt_request->bind_param("isis", $_SESSION['user_id'], $_SESSION['username'], $id, $action_data);
        
        if ($stmt_request->execute()) {
            $response['success'] = true;
            $response['message'] = 'Tu solicitud de baja ha sido enviada para aprobación.';
            $details = "Usuario '{$_SESSION['username']}' solicitó dar de baja el ítem '{$item['name']}' del área '{$areaName}'.";
            log_activity($conn, $_SESSION['user_id'], $_SESSION['username'], 'request_decommission', $details);
        } else {
            $response['message'] = 'Error al enviar la solicitud.';
        }
        $stmt_request->close();
    }
} else {
    $response['message'] = 'ID de ítem no válido.';
}

$conn->close();
echo json_encode($response);