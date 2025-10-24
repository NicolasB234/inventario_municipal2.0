<?php
require_once 'db_connect.php';
require_once 'log_activity.php';
require_once 'org-structure-data.php';
require_once 'utils.php';
header('Content-Type: application/json');
session_start();

$response = ['success' => false, 'message' => ''];
$is_admin = isset($_SESSION['is_admin']) && $_SESSION['is_admin'] === true;
$unclassified_area_id = 'unclassified';

ini_set('memory_limit', '512M');

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

if (json_last_error() !== JSON_ERROR_NONE || !is_array($items)) {
    $response['message'] = 'Error en los datos recibidos o formato incorrecto.';
    echo json_encode($response);
    exit;
}

function generateUniqueCodigoItem(mysqli $conn, int &$last_number, string $prefix = 'INV-'): string {
    if ($last_number === 0) {
        $stmt = $conn->prepare("SELECT codigo_item FROM inventory_items WHERE codigo_item LIKE ? ORDER BY id DESC LIMIT 1");
        $search_prefix = $prefix . '%';
        $stmt->bind_param("s", $search_prefix);
        $stmt->execute();
        $result = $stmt->get_result();
        $last_item = $result->fetch_assoc();
        $stmt->close();
        if ($last_item) {
            $last_number = (int)str_replace($prefix, '', $last_item['codigo_item']);
        }
    }
    $last_number++;
    return $prefix . str_pad($last_number, 5, '0', STR_PAD_LEFT);
}

function bind_params_array(mysqli_stmt $stmt, string $types, array &$params) {
    $refs = [];
    $refs[] = &$types;
    for ($i = 0; $i < count($params); $i++) {
        $refs[] = &$params[$i];
    }
    return call_user_func_array([$stmt, 'bind_param'], $refs);
}

function deduplicateAndMerge(array $payload): array {
    $merged_items = [];
    foreach ($payload as $row) {
        $codigo = trim($row['codigo_item'] ?? '');
        if ($codigo === '') {
            $merged_items[] = $row;
            continue;
        }

        if (isset($merged_items[$codigo])) {
            foreach ($row as $key => $value) {
                if (!empty(trim((string)$value))) {
                    $merged_items[$codigo][$key] = $value;
                }
            }
        } else {
            $merged_items[$codigo] = $row;
        }
    }
    return array_values($merged_items);
}

if ($is_admin) {
    $areaMap = createAreaMap($orgStructure);
    $conn->begin_transaction();
    
    $processed_count = 0;
    $unclassified_count = 0;
    $newly_generated_codes = 0;

    try {
        if (empty($items)) {
            throw new Exception("El archivo no contiene ítems para procesar.");
        }
        
        $items_to_process = deduplicateAndMerge($items);

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
        $batchSize = 300;
        $currentBatch = [];
        $last_generated_number = 0;

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

            // --- INICIO DE LA MODIFICACIÓN ---
            
            // Cantidad: Por defecto es 1 si está vacía, es 0, o no es un número válido.
            $quantity = (int)($item['cantidad'] ?? 1);
            if ($quantity <= 0) {
                $quantity = 1;
            }

            // Estado: Mapea el valor y por defecto es 'A' (Apto).
            $statusValue = $item['estado'] ?? $item['status'] ?? '';
            $statusLabel = strtolower(trim($statusValue));
            $statusMap = ['apto' => 'A', 'no apto' => 'N', 'no apto recuperable' => 'R', 'de baja' => 'D'];
            $status = $statusMap[$statusLabel] ?? 'A'; // 'A' de Apto como default

            // Encargado: Por defecto es 'No Asignado' si está vacío.
            $encargadoValue = $item['encargado'] ?? $item['responsable'] ?? '';
            $encargado = trim((string)$encargadoValue);
            if (empty($encargado)) {
                $encargado = 'No Asignado';
            }

            $name = trim((string)($item['nombre'] ?? ''));
            $category = trim((string)($item['categoria'] ?? ''));
            $description = trim((string)($item['descripcion'] ?? ''));
            $imagePath = trim((string)($item['imagePath'] ?? $item['imagen'] ?? ''));
            $incorporacion = !empty($item['incorporacion']) ? trim($item['incorporacion']) : null;
            
            // --- FIN DE LA MODIFICACIÓN ---

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

        if (!empty($currentBatch)) {
            $valuesPart = implode(',', array_fill(0, count($currentBatch) / 10, $placeholdersPerItem));
            $stmt = $conn->prepare($queryBase . $valuesPart . $onDuplicateKeyUpdateClause);
            $types = str_repeat('sssissssss', count($currentBatch) / 10);
            bind_params_array($stmt, $types, $currentBatch);
            if (!$stmt->execute()) throw new Exception("Error ejecutando el último batch: ".$stmt->error);
            $stmt->close();
        }

        $conn->commit();
        $response['success'] = true;
        
        $message = "Importación completada. Se procesaron/actualizaron {$processed_count} ítems.";
        if ($newly_generated_codes > 0) {
            $message .= " Se generaron {$newly_generated_codes} nuevos códigos para ítems que no tenían uno.";
        }
        if ($unclassified_count > 0) {
            $message .= " IMPORTANTE: {$unclassified_count} ítems fueron asignados al área 'A clasificar'. Por favor, revíselos.";
        }
        $response['message'] = $message;
        log_activity($conn, $_SESSION['user_id'], $_SESSION['username'], 'import_admin', $message);

    } catch (Exception $e) {
        $conn->rollback();
        $response['message'] = 'Error durante la importación: '.$e->getMessage();
    }
} else {
    // Lógica para usuarios no-admin se mantiene
    $action_data = json_encode($items);
    $stmt_request = $conn->prepare("INSERT INTO pending_actions (user_id, username, action_type, action_data, status) VALUES (?, ?, 'import', ?, 'pending')");
    $stmt_request->bind_param("iss", $_SESSION['user_id'], $_SESSION['username'], $action_data);
    if ($stmt_request->execute()) {
        $response['success'] = true;
        $response['message'] = 'Solicitud de importación enviada para aprobación.';
    } else {
        $response['message'] = 'Error al enviar la solicitud de importación.';
    }
    $stmt_request->close();
}

$conn->close();
echo json_encode($response);
?>