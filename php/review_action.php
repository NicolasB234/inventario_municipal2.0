<?php
require_once 'db_connect.php';
require_once 'log_activity.php';
header('Content-Type: application/json');
session_start();

$response = ['success' => false, 'message' => ''];
$is_admin = isset($_SESSION['is_admin']) && $_SESSION['is_admin'] === true;

if (!$is_admin) {
    $response['message'] = 'Acceso denegado.';
    echo json_encode($response);
    exit;
}

$action_id = isset($_POST['action_id']) ? (int)$_POST['action_id'] : 0;
$review_status = isset($_POST['status']) ? $_POST['status'] : '';
$review_comment = isset($_POST['comment']) ? trim($_POST['comment']) : '';

if (empty($action_id) || !in_array($review_status, ['approved', 'rejected'])) {
    $response['message'] = 'Datos de revisión no válidos.';
    echo json_encode($response);
    exit;
}

$conn->begin_transaction();
try {
    $stmt_get = $conn->prepare("SELECT * FROM pending_actions WHERE id = ? AND status = 'pending'");
    $stmt_get->bind_param("i", $action_id);
    $stmt_get->execute();
    $result = $stmt_get->get_result();
    $action = $result->fetch_assoc();
    $stmt_get->close();

    if (!$action) {
        throw new Exception("Solicitud no encontrada o ya procesada.");
    }
    
    $requester_id = (int)$action['user_id'];
    $admin_username = $_SESSION['username'];
    $admin_id = $_SESSION['user_id'];
    
    if ($review_status === 'approved') {
        $action_data = json_decode($action['action_data'], true);
        
        switch ($action['action_type']) {
            case 'hacienda_add':
                $action_text = 'agregar el bien';
                $item_name_for_log = $action_data['name'] ?? 'ítem de Hacienda';

                function generateUniqueCodigoItem($conn, $prefix = 'INV-') {
                    $stmt = $conn->prepare("SELECT codigo_item FROM inventory_items ORDER BY id DESC LIMIT 1");
                    $stmt->execute();
                    $last_item = $stmt->get_result()->fetch_assoc();
                    $stmt->close();
                    $number = $last_item ? (int)preg_replace('/[^0-9]/', '', $last_item['codigo_item']) : 0;
                    return $prefix . str_pad($number + 1, 5, '0', STR_PAD_LEFT);
                }
                $codigo_item = generateUniqueCodigoItem($conn);
                $imagePathsJson = isset($action_data['itemImages']) ? json_encode($action_data['itemImages'], JSON_UNESCAPED_SLASHES) : null;
                
                $stmt_insert = $conn->prepare("INSERT INTO inventory_items (codigo_item, name, quantity, category, description, encargado, node_id, valor, garantia, tipo_compra, proveedor, cuit, expediente, numero_expediente, codigo_comprobante, tipo_comprobante, numero_comprobante, incorporacion, status, creado_por, imagePath) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                
                $status_apto = 'A';
                $stmt_insert->bind_param("ssisssssdssssssssssss", $codigo_item, $action_data['name'], $action_data['quantity'], $action_data['category'], $action_data['description'], $action_data['encargado'], $action_data['node_id'], $action_data['valor'], $action_data['garantia'], $action_data['tipo_compra'], $action_data['proveedor'], $action_data['cuit'], $action_data['expediente'], $action_data['numero_expediente'], $action_data['codigo_comprobante'], $action_data['tipo_comprobante'], $action_data['numero_comprobante'], $action_data['incorporacion'], $status_apto, $action['username'], $imagePathsJson);

                if (!$stmt_insert->execute()) throw new Exception('Error al insertar el ítem: ' . $stmt_insert->error);
                $response['newItemId'] = $conn->insert_id;
                $stmt_insert->close();
                break;

            // --- SECCIÓN RESTAURADA Y CORREGIDA ---
            case 'edit':
                $action_text = 'editar';
                $item_name_for_log = $action_data['old_data']['name'] ?? 'ítem editado';
                $newData = $action_data['new_data'];

                $stmt_edit = $conn->prepare("UPDATE inventory_items SET name=?, quantity=?, category=?, description=?, incorporacion=?, status=?, encargado=? WHERE id=?");
                $stmt_edit->bind_param("sisssssi", 
                    $newData['name'], 
                    $newData['quantity'], 
                    $newData['category'], 
                    $newData['description'], 
                    $newData['incorporacion'], 
                    $newData['status'], 
                    $newData['encargado'], 
                    $newData['id']
                );
                
                if (!$stmt_edit->execute()) throw new Exception('Error al actualizar el ítem: ' . $stmt_edit->error);
                $stmt_edit->close();
                break;
            
            case 'transfer':
                $action_text = 'traspasar';
                $item_name_for_log = $action_data['item_name'] ?? 'ítem traspasado';
                
                $new_encargado = $action_data['new_encargado'] ?? 'No Asignado';
                $stmt_transfer = $conn->prepare("UPDATE inventory_items SET node_id = ?, encargado = ? WHERE id = ?");
                $stmt_transfer->bind_param("ssi", $action_data['destination_node_id'], $new_encargado, $action_data['item_id']);
                
                if (!$stmt_transfer->execute()) throw new Exception('Error al traspasar el ítem: ' . $stmt_transfer->error);
                $stmt_transfer->close();
                break;
            // --- FIN DE LA SECCIÓN RESTAURADA ---
            
            case 'decommission':
                $action_text = 'dar de baja';
                $item_name_for_log = $action_data['item_name'] ?? 'un ítem';
                $status_baja = 'D';
                
                // 1. Actualiza el ítem principal
                $stmt_decommission = $conn->prepare("UPDATE inventory_items SET status = ? WHERE id = ?");
                $stmt_decommission->bind_param("si", $status_baja, $action_data['item_id']);
                if (!$stmt_decommission->execute()) throw new Exception('Error al dar de baja el ítem.');
                $stmt_decommission->close();

                // --- INICIO DE MODIFICACIÓN ---
                // 2. Actualiza la tabla de bajas
                $decommission_id = $action_data['decommission_id'] ?? null;
                if ($decommission_id) {
                    $stmt_decomm_approve = $conn->prepare("UPDATE decommissioned_items SET status = 'approved' WHERE id = ?");
                    $stmt_decomm_approve->bind_param("i", $decommission_id);
                    $stmt_decomm_approve->execute();
                    $stmt_decomm_approve->close();
                }
                // --- FIN DE MODIFICACIÓN ---
                break;

            default:
                throw new Exception("Tipo de acción desconocido para aprobación.");
        }
        
        $log_details = "Su solicitud para {$action_text} ('{$item_name_for_log}') ha sido APROBADA.";
        if (!empty($review_comment)) $log_details .= " Comentario: '" . $review_comment . "'";
        log_activity($conn, $admin_id, $admin_username, 'request_approved', $log_details, $requester_id);

    } else { // Si es rechazada
        $action_data = json_decode($action['action_data'], true);
        $item_name_for_log = $action_data['name'] ?? $action_data['item_name'] ?? 'un ítem';
        $action_text = match($action['action_type']) {
            'edit' => 'editar', 'transfer' => 'traspasar', 'decommission' => 'dar de baja', 'import' => 'importar', 'hacienda_add' => 'agregar el bien',
            default => 'realizar una acción'
        };

        // --- INICIO DE MODIFICACIÓN ---
        // Si la acción rechazada es 'decommission', actualizar también la tabla de bajas
        if ($action['action_type'] === 'decommission') {
            $decommission_id = $action_data['decommission_id'] ?? null;
            if ($decommission_id) {
                $stmt_decomm_reject = $conn->prepare("UPDATE decommissioned_items SET status = 'rejected' WHERE id = ?");
                $stmt_decomm_reject->bind_param("i", $decommission_id);
                $stmt_decomm_reject->execute();
                $stmt_decomm_reject->close();
            }
        }
        // --- FIN DE MODIFICACIÓN ---
        
        $log_details = "Su solicitud para {$action_text} ('{$item_name_for_log}') ha sido RECHAZADA.";
        if (!empty($review_comment)) $log_details .= " Comentario: '" . $review_comment . "'";
        log_activity($conn, $admin_id, $admin_username, 'request_rejected', $log_details, $requester_id);
    }
    
    $stmt_update = $conn->prepare("UPDATE pending_actions SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_comment = ? WHERE id = ?");
    $stmt_update->bind_param("sisi", $review_status, $admin_id, $review_comment, $action_id);
    if (!$stmt_update->execute()) throw new Exception("Fallo al actualizar el estado de la solicitud.");
    $stmt_update->close();

    $conn->commit();
    $response['success'] = true;
    $response['message'] = 'Solicitud procesada correctamente.';

} catch (Exception $e) {
    $conn->rollback();
    $response['message'] = 'Error al procesar la solicitud: ' . $e->getMessage();
}

$conn->close();
echo json_encode($response);
?>