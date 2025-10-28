<?php
require_once 'db_connect.php';
require_once 'log_activity.php';
header('Content-Type: application/json');
session_start();

$response = ['success' => false, 'message' => ''];

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

$json_data = file_get_contents('php://input');
$items = json_decode($json_data, true);

if (json_last_error() !== JSON_ERROR_NONE || !is_array($items) || empty($items)) {
    $response['message'] = 'Error en los datos recibidos o no hay ítems para importar.';
    echo json_encode($response);
    exit;
}

// --- ¡NUEVA LÓGICA DE IMPORTACIÓN A STAGING! ---

$conn->begin_transaction();

try {
    // 1. Generar un ID de lote único para esta subida
    // Usamos microtime para asegurar unicidad
    $import_batch_id = 'batch_' . $_SESSION['user_id'] . '_' . microtime(true);
    
    $user_id = $_SESSION['user_id'];
    $username = $_SESSION['username'];
    // Guardamos el area_id del usuario que importa, como solicitaste
    $area_id = $_SESSION['area_id'] ?? 'unknown'; 

    $stmt = $conn->prepare("INSERT INTO import_staging (import_batch_id, user_id, username, area_id, item_data_json, status) VALUES (?, ?, ?, ?, ?, 'pending')");
    
    if (!$stmt) {
        throw new Exception("Error al preparar la consulta: " . $conn->error);
    }

    $processed_count = 0;
    foreach ($items as $item) {
        // 2. Guardar cada ítem como un JSON individual en la tabla de espera
        // Mantenemos los datos "crudos" tal como vienen del Excel
        $item_data_json = json_encode($item);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            // Si un ítem falla la codificación, lo saltamos, pero podríamos registrar el error
            continue; 
        }

        $stmt->bind_param("sisss", $import_batch_id, $user_id, $username, $area_id, $item_data_json);
        
        if (!$stmt->execute()) {
            // Si un ítem falla, podríamos parar toda la transacción
            throw new Exception("Error al insertar ítem en staging: " . $stmt->error);
        }
        $processed_count++;
    }
    
    $stmt->close();

    // 3. Si todo salió bien, confirmamos la transacción
    $conn->commit();
    
    $response['success'] = true;
    $response['message'] = "Se subieron {$processed_count} ítems para revisión. Serán importados una vez que un administrador los apruebe.";
    // Guardamos el ID del lote para redirigir al usuario si queremos
    $response['batch_id'] = $import_batch_id; 

    log_activity($conn, $user_id, $username, 'import_staging_upload', "Subió {$processed_count} ítems al lote {$import_batch_id} para revisión.");

} catch (Exception $e) {
    $conn->rollback();
    $response['message'] = 'Error durante la subida a staging: ' . $e->getMessage();
}

$conn->close();
echo json_encode($response);
?>