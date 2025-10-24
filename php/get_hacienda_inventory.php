<?php
require_once 'db_connect.php';
header('Content-Type: application/json');
session_start();

$response = ['success' => false, 'data' => [], 'total' => 0, 'message' => ''];
$is_admin = $_SESSION['is_admin'] ?? false;
$user_area_id = $_SESSION['area_id'] ?? '';

// --- Seguridad: Solo Admin o usuarios del área de Hacienda pueden ver esta tabla ---
if (!$is_admin && $user_area_id !== 'sec-hacienda') {
    $response['message'] = 'Acceso denegado. Se requieren permisos de Hacienda o de Administrador.';
    echo json_encode($response);
    exit;
}

$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$limit = 15;
$offset = ($page - 1) * $limit;

try {
    // --- INICIO DE LA CORRECCIÓN ---
    // Se añade un filtro para mostrar solo ítems con datos de Hacienda
    $filter_condition = "WHERE valor IS NOT NULL OR proveedor IS NOT NULL";

    // Primero, contamos el total de ítems CON el filtro
    $count_result = $conn->query("SELECT COUNT(*) as total FROM inventory_items {$filter_condition}");
    $total_items = (int)$count_result->fetch_assoc()['total'];
    $response['total'] = $total_items;

    // Luego, obtenemos los ítems para la página actual, CON el filtro
    $stmt = $conn->prepare(
        "SELECT id, codigo_item, node_id, name, quantity, category, description, incorporacion, status, 
                encargado, valor, garantia, tipo_compra, proveedor, cuit, expediente, numero_expediente, 
                codigo_comprobante, tipo_comprobante, numero_comprobante
         FROM inventory_items 
         {$filter_condition}
         ORDER BY id DESC 
         LIMIT ? OFFSET ?"
    );
    // --- FIN DE LA CORRECCIÓN ---
    
    $stmt->bind_param("ii", $limit, $offset);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $items = [];
    while ($row = $result->fetch_assoc()) {
        $items[] = $row;
    }

    $response['success'] = true;
    $response['data'] = $items;
    $stmt->close();

} catch (Exception $e) {
    $response['message'] = 'Error de servidor: ' . $e->getMessage();
}

$conn->close();
echo json_encode($response);
?>