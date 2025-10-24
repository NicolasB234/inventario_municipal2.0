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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    $response['message'] = 'Método no permitido.';
    echo json_encode($response);
    exit;
}

$itemId = $_POST['itemId'] ?? 0;
$destinationNodeId = $_POST['destinationNodeId'] ?? '';
$reason = $_POST['reason'] ?? '';
$new_encargado = trim($_POST['new_encargado'] ?? 'No Asignado');

if (empty($itemId) || empty($destinationNodeId)) {
    $response['message'] = 'Faltan datos para realizar el traspaso.';
    echo json_encode($response);
    exit;
}

// Lógica para el Administrador (realiza el traspaso directamente)
if ($is_admin) {
    $conn->begin_transaction();
    try {
        $stmt_update = $conn->prepare("UPDATE inventory_items SET node_id = ?, encargado = ? WHERE id = ?");
        $stmt_update->bind_param("ssi", $destinationNodeId, $new_encargado, $itemId);
        
        if ($stmt_update->execute()) {
            $stmt_update->close();
            $conn->commit();
            $response['success'] = true;
            $response['message'] = 'Ítem traspasado correctamente.';

            // Log de la actividad
            $item_info_stmt = $conn->prepare("SELECT name FROM inventory_items WHERE id = ?");
            $item_info_stmt->bind_param("i", $itemId);
            $item_info_stmt->execute();
            $item_name = $item_info_stmt->get_result()->fetch_assoc()['name'] ?? 'ID ' . $itemId;
            $item_info_stmt->close();

            $originAreaName = getAreaNameById($orgStructure, $_POST['originNodeId'] ?? '') ?? 'área desconocida';
            $destinationAreaName = getAreaNameById($orgStructure, $destinationNodeId) ?? 'área desconocida';
            $details = "Admin '{$_SESSION['username']}' traspasó el ítem '{$item_name}' desde '{$originAreaName}' hacia '{$destinationAreaName}'.";
            log_activity($conn, $_SESSION['user_id'], $_SESSION['username'], 'item_transferred_admin', $details);
        } else {
            throw new Exception('No se pudo actualizar el área del ítem.');
        }
    } catch (Exception $e) {
        $conn->rollback();
        $response['message'] = 'Error en el traspaso: ' . $e->getMessage();
    }
} else {
    // Lógica para el Usuario Normal (crea una solicitud)

    // 1. Obtener los datos actuales del ítem, incluyendo su área de origen
    $stmt_item = $conn->prepare("SELECT name, node_id FROM inventory_items WHERE id = ?");
    $stmt_item->bind_param("i", $itemId);
    $stmt_item->execute();
    $item = $stmt_item->get_result()->fetch_assoc();
    $stmt_item->close();

    if (!$item) {
        $response['message'] = 'El ítem a traspasar no existe.';
        echo json_encode($response);
        exit;
    }

    // 2. Crear el paquete de datos con origen y destino
    $action_data = [
        'item_id' => $itemId,
        'item_name' => $item['name'],
        'origin_node_id' => $item['node_id'], // <- Dato de origen añadido
        'destination_node_id' => $destinationNodeId,
        'reason' => $reason,
        'new_encargado' => $new_encargado
    ];
    $json_data = json_encode($action_data);

    // 3. Guardar la solicitud
    $stmt_request = $conn->prepare("INSERT INTO pending_actions (user_id, username, action_type, item_id, action_data, status) VALUES (?, ?, 'transfer', ?, ?, 'pending')");
    $stmt_request->bind_param("isis", $_SESSION['user_id'], $_SESSION['username'], $itemId, $json_data);

    if ($stmt_request->execute()) {
        $response['success'] = true;
        $response['message'] = 'Solicitud de traspaso enviada para aprobación.';
        $originAreaName = getAreaNameById($orgStructure, $item['node_id']) ?? 'área desconocida';
        $destinationAreaName = getAreaNameById($orgStructure, $destinationNodeId) ?? 'área desconocida';
        $details = "Usuario '{$_SESSION['username']}' solicitó traspasar el ítem '{$item['name']}' desde '{$originAreaName}' hacia '{$destinationAreaName}'.";
        log_activity($conn, $_SESSION['user_id'], $_SESSION['username'], 'request_transfer', $details);
    } else {
        $response['message'] = 'Error al enviar la solicitud de traspaso.';
    }
    $stmt_request->close();
}

$conn->close();
echo json_encode($response);
?>