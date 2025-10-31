<?php
// php/delete_item.php

require_once 'db_connect.php';
require_once 'log_activity.php';
require_once 'org-structure-data.php';
require_once 'utils.php';
header('Content-Type: application/json');
session_start();

$response = ['success' => false, 'message' => 'Error desconocido.'];
$is_admin = $_SESSION['is_admin'] ?? false;
$user_id = $_SESSION['user_id'] ?? 0;
$username = $_SESSION['username'] ?? 'Usuario desconocido';

if ($user_id === 0) {
    $response['message'] = 'Acceso no autorizado. Inicie sesión.';
    echo json_encode($response);
    exit;
}

// --- Validación de datos ---
$item_id = $_POST['id'] ?? 0;
$reason = $_POST['reason'] ?? '';

if ($item_id <= 0) {
    $response['message'] = 'ID de ítem no válido.';
    echo json_encode($response);
    exit;
}
if (empty($reason)) {
    $response['message'] = 'El motivo de la baja es obligatorio.';
    echo json_encode($response);
    exit;
}
if (!isset($_FILES['decommission_image']) || $_FILES['decommission_image']['error'] != UPLOAD_ERR_OK) {
    $response['message'] = 'La imagen de evidencia es obligatoria.';
    echo json_encode($response);
    exit;
}

// --- Obtener detalles del Ítem ---
$stmt_get = $conn->prepare("SELECT * FROM inventory_items WHERE id = ?");
$stmt_get->bind_param("i", $item_id);
$stmt_get->execute();
$result = $stmt_get->get_result();
$item = $result->fetch_assoc();
$stmt_get->close();

if (!$item) {
    $response['message'] = 'El ítem no existe.';
    echo json_encode($response);
    exit;
}

$areaName = getAreaNameById($orgStructure, $item['node_id']) ?? 'Área desconocida';

// --- Procesar la imagen ---
$upload_dir = '../uploads/bajas/';
if (!is_dir($upload_dir)) {
    mkdir($upload_dir, 0777, true);
}
$image_info = pathinfo($_FILES['decommission_image']['name']);
$image_ext = $image_info['extension'];
$unique_filename = 'baja_' . $item_id . '_' . time() . '.' . $image_ext;
$image_path = $upload_dir . $unique_filename;
$relative_path = 'uploads/bajas/' . $unique_filename; // Ruta para guardar en DB

if (!move_uploaded_file($_FILES['decommission_image']['tmp_name'], $image_path)) {
    $response['message'] = 'Error al guardar la imagen de baja.';
    echo json_encode($response);
    exit;
}

// --- Lógica de Admin vs Usuario ---

$conn->begin_transaction();
try {
    $decommission_status = $is_admin ? 'approved' : 'pending';
    $item_details_json = json_encode([
        'name' => $item['name'],
        'codigo_item' => $item['codigo_item'],
        'category' => $item['category'],
        'node_id' => $item['node_id'],
        'area_name' => $areaName
    ]);

    // 1. Insertar en la nueva tabla de bajas
    $stmt_decomm = $conn->prepare(
        "INSERT INTO decommissioned_items (item_id, reason, image_path, status, user_id, username, item_details_json) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt_decomm->bind_param("isssiss", $item_id, $reason, $relative_path, $decommission_status, $user_id, $username, $item_details_json);
    $stmt_decomm->execute();
    $new_decommission_id = $conn->insert_id;
    $stmt_decomm->close();

    // Preparar datos del acta para la respuesta
    $acta_data = [
        'item_name' => $item['name'],
        'item_code' => $item['codigo_item'],
        'area_name' => $areaName,
        'reason' => $reason,
        'date' => date('Y-m-d H:i:s'),
        'username' => $username,
        'user_id' => $user_id,
        'status' => $decommission_status
    ];

    if ($is_admin) {
        // 2. Si es Admin, da de baja el ítem directamente
        $stmt_update = $conn->prepare("UPDATE inventory_items SET status = 'D' WHERE id = ?");
        $stmt_update->bind_param("i", $item_id);
        $stmt_update->execute();
        $stmt_update->close();

        // 3. Log de Admin
        $log_details = "Admin '{$username}' dio de baja el ítem '{$item['name']}' (ID: {$item_id}) por motivo: {$reason}.";
        log_activity($conn, $user_id, $username, 'item_decommissioned_admin', $log_details);
        
        $response['message'] = 'Ítem dado de baja correctamente.';
    
    } else {
        // 2. Si es Usuario, crea una solicitud pendiente
        $action_data = json_encode([
            'item_id' => $item_id, 
            'item_name' => $item['name'],
            'decommission_id' => $new_decommission_id, // <-- Vinculamos al registro de baja
            'reason' => $reason
        ]);
        
        $stmt_request = $conn->prepare(
            "INSERT INTO pending_actions (user_id, username, action_type, item_id, action_data, status) VALUES (?, ?, 'decommission', ?, ?, 'pending')"
        );
        $stmt_request->bind_param("is_is", $user_id, $username, $item_id, $action_data);
        $stmt_request->execute();
        $stmt_request->close();

        // 3. Log de Usuario
        $log_details = "Usuario '{$username}' solicitó la baja del ítem '{$item['name']}' por motivo: {$reason}.";
        log_activity($conn, $user_id, $username, 'request_decommission', $log_details);

        $response['message'] = 'Tu solicitud de baja ha sido enviada para aprobación.';
    }

    $conn->commit();
    $response['success'] = true;
    $response['acta_data'] = $acta_data; // Enviar datos del acta al frontend

} catch (Exception $e) {
    $conn->rollback();
    $response['message'] = 'Error en la base de datos: ' . $e->getMessage();
    // Eliminar la imagen subida si la transacción falló
    if (file_exists($image_path)) {
        unlink($image_path);
    }
}

$conn->close();
echo json_encode($response);