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
if (!$id) {
    $response['message'] = 'ID de ítem no válido.';
    echo json_encode($response);
    exit;
}

// Lógica para el Administrador (actualiza directamente)
if ($is_admin) {
    $imagePathJson = $_POST['existingImagePath'] ?? null;

    if (isset($_FILES['itemImage']) && !empty($_FILES['itemImage']['name'][0])) {
        $upload_dir = __DIR__ . '/../uploads/';
        $newImagePaths = [];

        if ($imagePathJson) {
            $oldImages = json_decode($imagePathJson, true);
            if (is_array($oldImages)) {
                foreach ($oldImages as $oldImg) {
                    if (file_exists(__DIR__ . '/../' . $oldImg)) {
                        @unlink(__DIR__ . '/../' . $oldImg);
                    }
                }
            }
        }

        foreach ($_FILES['itemImage']['name'] as $key => $fileName) {
            if ($_FILES['itemImage']['error'][$key] === UPLOAD_ERR_OK) {
                $tmpName = $_FILES['itemImage']['tmp_name'][$key];
                $newFileName = uniqid() . '_' . basename($fileName);
                $targetFile = $upload_dir . $newFileName;
                if (move_uploaded_file($tmpName, $targetFile)) {
                    $newImagePaths[] = 'uploads/' . $newFileName;
                }
            }
        }
        $imagePathJson = !empty($newImagePaths) ? json_encode($newImagePaths, JSON_UNESCAPED_SLASHES) : null;
    }

    $stmt_update = $conn->prepare("UPDATE inventory_items SET name=?, quantity=?, category=?, description=?, incorporacion=?, status=?, encargado=?, imagePath=? WHERE id=?");
    $stmt_update->bind_param(
        "sissssssi",
        $_POST['name'],
        $_POST['quantity'],
        $_POST['category'],
        $_POST['description'],
        $_POST['incorporacion'],
        $_POST['status'],
        $_POST['encargado'],
        $imagePathJson,
        $id
    );

    if ($stmt_update->execute()) {
        $response['success'] = true;
        $response['message'] = 'Ítem actualizado correctamente por el administrador.';
        log_activity($conn, $_SESSION['user_id'], $_SESSION['username'], 'item_edited_admin', "Admin '{$_SESSION['username']}' actualizó el ítem '{$_POST['name']}'.");
    } else {
        $response['message'] = 'Error al actualizar el ítem.';
    }
    $stmt_update->close();

} else {
    // Lógica para el Usuario Normal (crea una solicitud de edición)
    
    // 1. Obtener los datos actuales del ítem ANTES de proponer el cambio
    $stmt_get = $conn->prepare("SELECT * FROM inventory_items WHERE id = ?");
    $stmt_get->bind_param("i", $id);
    $stmt_get->execute();
    $currentItem = $stmt_get->get_result()->fetch_assoc();
    $stmt_get->close();

    if (!$currentItem) {
        $response['message'] = 'El ítem que intenta editar no existe.';
        echo json_encode($response);
        exit;
    }
    
    // 2. Organizar los datos en un formato "antiguo" vs "nuevo"
    $action_data = [
        'old_data' => [
            'name' => $currentItem['name'],
            'quantity' => $currentItem['quantity'],
            'category' => $currentItem['category'],
            'description' => $currentItem['description'],
            'incorporacion' => $currentItem['incorporacion'],
            'status' => $currentItem['status'],
            'encargado' => $currentItem['encargado']
        ],
        'new_data' => [
            'id' => $id,
            'name' => $_POST['name'],
            'quantity' => $_POST['quantity'],
            'category' => $_POST['category'],
            'description' => $_POST['description'],
            'incorporacion' => !empty($_POST['incorporacion']) ? $_POST['incorporacion'] : null,
            'status' => $_POST['status'],
            'encargado' => $_POST['encargado'] ?? 'No Asignado'
        ]
    ];
    $json_data = json_encode($action_data);

    // 3. Guardar la solicitud con la nueva estructura de datos
    $stmt_request = $conn->prepare("INSERT INTO pending_actions (user_id, username, action_type, item_id, action_data, status) VALUES (?, ?, 'edit', ?, ?, 'pending')");
    $stmt_request->bind_param("isis", $_SESSION['user_id'], $_SESSION['username'], $id, $json_data);

    if ($stmt_request->execute()) {
        $response['success'] = true;
        $response['message'] = 'Solicitud de edición enviada para aprobación.';
        $areaName = getAreaNameById($orgStructure, $currentItem['node_id']) ?? 'área desconocida';
        $details = "Usuario '{$_SESSION['username']}' solicitó editar el ítem '{$currentItem['name']}' en el área '{$areaName}'.";
        log_activity($conn, $_SESSION['user_id'], $_SESSION['username'], 'request_edit', $details);
    } else {
        $response['message'] = 'Error al enviar la solicitud: ' . $stmt_request->error;
    }
    $stmt_request->close();
}

$conn->close();
echo json_encode($response);
?>