<?php
require_once 'db_connect.php';
require_once 'log_activity.php';
require_once 'org-structure-data.php'; // Necesario para el mapeo de áreas
require_once 'utils.php'; // Necesario para generateUniqueCodigoItem y findClosestAreaId
header('Content-Type: application/json');
session_start();

$response = ['success' => false, 'message' => ''];
$is_admin = $_SESSION['is_admin'] ?? false;

if (!$is_admin) {
    $response['message'] = 'Acceso denegado. Se requieren permisos de administrador.';
    echo json_encode($response);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    $response['message'] = 'Método no permitido.';
    echo json_encode($response);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$batch_id = $input['batch_id'] ?? null;

if (!$batch_id) {
    $response['message'] = 'ID de lote no proporcionado.';
    echo json_encode($response);
    exit;
}

// --- COPIAMOS FUNCIONES NECESARIAS DE TU bulk_import.php ORIGINAL ---
// (Estas funciones ya están en utils.php, pero las aseguramos aquí si es necesario)
// Si no están en utils.php, descomenta y pégalas aquí.
// function generateUniqueCodigoItem(mysqli $conn, int &$last_number, string $prefix = 'INV-'): string { ... }
// function bind_params_array(mysqli_stmt $stmt, string $types, array &$params) { ... }
// function findClosestAreaId(string $areaName, array $areaMap): ?string { ... }
// ---

$unclassified_area_id = 'unclassified';
$areaMap = createAreaMap($orgStructure);
$conn->begin_transaction();

$processed_count = 0;
$unclassified_count = 0;
$newly_generated_codes = 0;

try {
    // 1. Obtener todos los ítems del lote desde staging
    $stmt_get = $conn->prepare("SELECT staging_id, item_data_json FROM import_staging WHERE import_batch_id = ?");
    $stmt_get->bind_param("s", $batch_id);
    $stmt_get->execute();
    $result_items = $stmt_get->get_result();
    
    if ($result_items->num_rows === 0) {
        throw new Exception("No se encontraron ítems en el lote {$batch_id} o ya fue procesado.");
    }

    $items_to_process = [];
    $staging_ids_to_delete = [];
    while ($row = $result_items->fetch_assoc()) {
        $items_to_process[] = json_decode($row['item_data_json'], true);
        $staging_ids_to_delete[] = $row['staging_id'];
    }
    $stmt_get->close();
    
    // Aquí puedes re-usar tu función de de-duplicar si es necesario
    // $items_to_process = deduplicateAndMerge($items_to_process);

    // 2. Preparar la lógica de inserción/actualización (copiada de tu bulk_import.php)
    $onDuplicateKeyUpdateClause = " ON DUPLICATE KEY UPDATE
        node_id = COALESCE(VALUES(node_id), node_id),
        name = COALESCE(NULLIF(VALUES(name), ''), name),
        quantity = COALESCE(VALUES(quantity), quantity),
        category = COALESCE(NULLIF(VALUES(category), ''), category),
        description = COALESCE(VALUES(description), description),
        imagePath = COALESCE(NULLIF(VALUES(imagePath), ''), imagePath),
        incorporacion = COALESCE(VALUES(incorporacion), incorporacion),
        status = COALESCE(NULLIF(VALUES(status), ''), status),
        encargado = COALESCE(NULLIF(VALUES(encargado), ''), encargado)";

    $queryBase = "INSERT INTO inventory_items (codigo_item, node_id, name, quantity, category, description, imagePath, incorporacion, status, encargado) VALUES ";
    $placeholdersPerItem = "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    $batchSize = 300; // O el tamaño que prefieras
    $currentBatch = [];
    $last_generated_number = 0; // Para la función generateUniqueCodigoItem

    // 3. Iterar y procesar cada ítem (lógica de tu bulk_import.php original)
    foreach ($items_to_process as $item) {
        $areaName = trim($item['area'] ?? '');
        $node_id = findClosestAreaId($areaName, $areaMap);

        if ($node_id === null && !empty($areaName)) {
            $node_id = $unclassified_area_id;
            $unclassified_count++;
        } elseif (empty($areaName)) {
            $node_id = null;
        }

        $codigo_item = trim((string)($item['codigo_item'] ?? ''));

        if (empty($codigo_item)) {
            $codigo_item = generateUniqueCodigoItem($conn, $last_generated_number);
            $newly_generated_codes++;
        }
        
        // Mapeo y valores por defecto (de tu bulk_import.php original)
        $quantity = (int)($item['cantidad'] ?? 1);
        if ($quantity <= 0) $quantity = 1;

        $statusValue = $item['estado'] ?? $item['status'] ?? '';
        $statusLabel = strtolower(trim($statusValue));
        $statusMap = ['apto' => 'A', 'no apto' => 'N', 'no apto recuperable' => 'R', 'de baja' => 'D'];
        $status = $statusMap[$statusLabel] ?? 'A';

        $encargadoValue = $item['encargado'] ?? $item['responsable'] ?? '';
        $encargado = trim((string)$encargadoValue);
        if (empty($encargado)) $encargado = 'No Asignado';

        $name = trim((string)($item['nombre'] ?? ''));
        $category = trim((string)($item['categoria'] ?? ''));
        $description = trim((string)($item['descripcion'] ?? ''));
        $imagePath = trim((string)($item['imagePath'] ?? $item['imagen'] ?? ''));
        $incorporacion = !empty($item['incorporacion']) ? trim($item['incorporacion']) : null;
        
        $currentBatch = array_merge($currentBatch, [
            $codigo_item, $node_id, $name, $quantity, $category, 
            $description, $imagePath, $incorporacion, $status, $encargado
        ]);
        $processed_count++;

        if (count($currentBatch) / 10 >= $batchSize) {
            $valuesPart = implode(',', array_fill(0, count($currentBatch) / 10, $placeholdersPerItem));
            $stmt = $conn->prepare($queryBase . $valuesPart . $onDuplicateKeyUpdateClause);
            $types = str_repeat('sssissssss', count($currentBatch) / 10);
            bind_params_array($stmt, $types, $currentBatch);
            if (!$stmt->execute()) throw new Exception("Error ejecutando batch: ".$stmt->error);
            $stmt->close();
            $currentBatch = [];
        }
    }

    // 4. Ejecutar el último lote
    if (!empty($currentBatch)) {
        $valuesPart = implode(',', array_fill(0, count($currentBatch) / 10, $placeholdersPerItem));
        $stmt = $conn->prepare($queryBase . $valuesPart . $onDuplicateKeyUpdateClause);
        $types = str_repeat('sssissssss', count($currentBatch) / 10);
        bind_params_array($stmt, $types, $currentBatch);
        if (!$stmt->execute()) throw new Exception("Error ejecutando el último batch: ".$stmt->error);
        $stmt->close();
    }

    // 5. Si todo fue exitoso, eliminamos los ítems de la tabla staging
    $ids_placeholder = implode(',', array_fill(0, count($staging_ids_to_delete), '?'));
    $stmt_delete = $conn->prepare("DELETE FROM import_staging WHERE staging_id IN ($ids_placeholder)");
    $types_delete = str_repeat('i', count($staging_ids_to_delete));
    bind_params_array($stmt_delete, $types_delete, $staging_ids_to_delete);
    if (!$stmt_delete->execute()) {
        throw new Exception("Error eliminando ítems de staging: " . $stmt_delete->error);
    }
    $stmt_delete->close();

    // 6. Confirmar la transacción
    $conn->commit();
    $response['success'] = true;
    
    $message = "Importación completada. Se procesaron/actualizaron {$processed_count} ítems del lote {$batch_id}.";
    if ($newly_generated_codes > 0) {
        $message .= " Se generaron {$newly_generated_codes} nuevos códigos.";
    }
    if ($unclassified_count > 0) {
        $message .= " IMPORTANTE: {$unclassified_count} ítems fueron asignados a 'A clasificar'.";
    }
    $response['message'] = $message;
    log_activity($conn, $_SESSION['user_id'], $_SESSION['username'], 'import_batch_approve', $message);

} catch (Exception $e) {
    $conn->rollback();
    $response['message'] = 'Error durante la aprobación de la importación: '.$e->getMessage();
}

$conn->close();
echo json_encode($response);
?>