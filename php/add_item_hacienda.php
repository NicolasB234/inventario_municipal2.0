<?php
require_once 'db_connect.php';
require_once 'log_activity.php';
require_once 'org-structure-data.php';
require_once 'utils.php';

header('Content-Type: application/json');
session_start();

$response = ['success' => false, 'message' => ''];

if (!isset($_SESSION['user_id'])) {
    $response['message'] = 'Acceso no autorizado.';
    echo json_encode($response);
    exit;
}

$action_data = $_POST;

if (empty($action_data['name']) || empty($action_data['category']) || empty($action_data['node_id'])) {
    $response['message'] = 'Faltan datos obligatorios: Nombre, Categoría y Área de Destino.';
    echo json_encode($response);
    exit;
}

$imagePaths = [];
if (isset($_FILES['itemImages']) && !empty($_FILES['itemImages']['name'][0])) {
    $uploadDir = __DIR__ . '/../uploads/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    
    foreach ($_FILES['itemImages']['name'] as $key => $fileName) {
        if ($_FILES['itemImages']['error'][$key] === UPLOAD_ERR_OK) {
            $tmpName = $_FILES['itemImages']['tmp_name'][$key];
            $newFileName = uniqid() . '-' . basename($fileName);
            $targetFile = $uploadDir . $newFileName;
            if (move_uploaded_file($tmpName, $targetFile)) {
                $imagePaths[] = 'uploads/' . $newFileName;
            }
        }
    }
}
$action_data['itemImages'] = $imagePaths;

$json_data = json_encode($action_data, JSON_UNESCAPED_SLASHES);

$stmt_request = $conn->prepare(
    "INSERT INTO pending_actions (user_id, username, action_type, action_data, status) VALUES (?, ?, 'hacienda_add', ?, 'pending')"
);
$stmt_request->bind_param("iss", $_SESSION['user_id'], $_SESSION['username'], $json_data);

if ($stmt_request->execute()) {
    $response['success'] = true;
    $response['message'] = 'Solicitud de carga enviada para aprobación interna en Hacienda.';
    $areaName = getAreaNameById($orgStructure, $action_data['node_id']) ?? 'un área desconocida';
    $details = "Hacienda: El usuario '{$_SESSION['username']}' ha enviado un nuevo bien ('{$action_data['name']}') para su aprobación.";
    log_activity($conn, $_SESSION['user_id'], $_SESSION['username'], 'hacienda_add', $details);
} else {
    $response['message'] = 'Error al enviar la solicitud: ' . $stmt_request->error;
}

$stmt_request->close();
$conn->close();

echo json_encode($response);
?>