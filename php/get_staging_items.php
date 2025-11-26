<?php
require_once 'db_connect.php';
header('Content-Type: application/json');
session_start();

$response = ['success' => false, 'data' => [], 'message' => ''];
$user_id = $_SESSION['user_id'] ?? null;
$is_admin = $_SESSION['is_admin'] ?? false;
$batch_id = $_GET['batch_id'] ?? null;

if (!$user_id) {
    $response['message'] = 'Acceso denegado.';
    echo json_encode($response);
    exit;
}
if (!$batch_id) {
    $response['message'] = 'ID de lote no proporcionado.';
    echo json_encode($response);
    exit;
}

try {
    // Buscamos los ítems del lote
    $sql = "SELECT * FROM import_staging WHERE import_batch_id = ?";
    
    // Verificamos permisos: El admin puede ver todo, el usuario solo sus lotes
    if (!$is_admin) {
        $sql .= " AND user_id = ?";
    }

    $stmt = $conn->prepare($sql);
    
    if (!$is_admin) {
        $stmt->bind_param("si", $batch_id, $user_id);
    } else {
        $stmt->bind_param("s", $batch_id);
    }
    
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        // Esto previene que un admin vea un lote que no existe, o un usuario vea un lote ajeno
        $response['message'] = 'Lote no encontrado o sin permisos para verlo.';
        echo json_encode($response);
        exit;
    }

    $items = [];
    while ($row = $result->fetch_assoc()) {
        // Devolvemos el ítem con su ID de staging y el JSON decodificado
        $items[] = [
            'staging_id' => $row['staging_id'],
            'item_data' => json_decode($row['item_data_json'], true) // Decodificamos el JSON
        ];
    }

    $response['success'] = true;
    $response['data'] = $items;
    $response['is_admin'] = $is_admin;

} catch (Exception $e) {
    $response['message'] = 'Error de servidor: ' . $e->getMessage();
}

$conn->close();
echo json_encode($response);
?>