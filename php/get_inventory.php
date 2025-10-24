<?php
require_once 'db_connect.php';
header('Content-Type: application/json');
session_start();

$response = ['success' => false, 'data' => [], 'total' => 0];
$node_id = $_GET['node_id'] ?? '';
$is_admin = $_SESSION['is_admin'] ?? false;
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 800;
$offset = ($page - 1) * $limit;

if (empty($node_id) && !$is_admin) {
    $response['message'] = 'Node ID no proporcionado.';
    echo json_encode($response);
    exit;
}

try {
    // --- INICIO DE LA MODIFICACIÓN ---
    $base_sql = "FROM inventory_items";
    $where_clauses = [];
    $params = [];
    $types = "";

    // Filtro base por área (si no es admin viendo todas las áreas)
    if (!($is_admin && empty($node_id))) {
        $where_clauses[] = "node_id = ?";
        $params[] = $node_id;
        $types .= "s";
    }

    // Filtro de estado modificado
    $filter_status = $_GET['filter_status'] ?? '';
    if (!empty($filter_status)) {
        // Si se pide un estado específico (A, N, R, D), lo filtramos.
        $where_clauses[] = "status = ?";
        $params[] = $filter_status;
        $types .= "s";
    } else {
        // Por defecto, si no se especifica un estado, ocultamos los de baja.
        $where_clauses[] = "status != 'D'";
    }

    // Añadir el resto de los filtros de la URL
    if (!empty($_GET['filter_codigo'])) {
        $where_clauses[] = "codigo_item LIKE ?";
        $params[] = '%' . $_GET['filter_codigo'] . '%';
        $types .= "s";
    }
    if (!empty($_GET['filter_name'])) {
        $where_clauses[] = "name LIKE ?";
        $params[] = '%' . $_GET['filter_name'] . '%';
        $types .= "s";
    }
    if (!empty($_GET['filter_category'])) {
        $where_clauses[] = "category = ?";
        $params[] = $_GET['filter_category'];
        $types .= "s";
    }
    if (!empty($_GET['filter_date_from'])) {
        $where_clauses[] = "incorporacion >= ?";
        $params[] = $_GET['filter_date_from'];
        $types .= "s";
    }
    if (!empty($_GET['filter_date_to'])) {
        $where_clauses[] = "incorporacion <= ?";
        $params[] = $_GET['filter_date_to'];
        $types .= "s";
    }
    
    // Unimos las condiciones WHERE
    if (!empty($where_clauses)) {
        $base_sql .= " WHERE " . implode(' AND ', $where_clauses);
    }
    
    // Lógica de Ordenación (ORDER BY)
    $sort_by = $_GET['sort_by'] ?? 'name_asc';
    $order_clause = "ORDER BY ";
    switch ($sort_by) {
        case 'name_desc':
            $order_clause .= "name DESC";
            break;
        case 'date_desc':
            $order_clause .= "incorporacion DESC, id DESC";
            break;
        case 'date_asc':
            $order_clause .= "incorporacion ASC, id ASC";
            break;
        case 'name_asc':
        default:
            $order_clause .= "name ASC";
            break;
    }

    // --- Contar el total de ítems CON filtros ---
    $count_sql = "SELECT COUNT(*) as total " . $base_sql;
    $stmt_count = $conn->prepare($count_sql);
    if ($types) {
        $stmt_count->bind_param($types, ...$params);
    }
    $stmt_count->execute();
    $count_result = $stmt_count->get_result()->fetch_assoc();
    $response['total'] = (int)$count_result['total'];
    $stmt_count->close();

    // --- Obtener los ítems paginados CON filtros y ordenación ---
    $data_sql = "SELECT id, node_id, name, quantity, category, description, incorporacion, status, imagePath, encargado, codigo_item " . $base_sql . " " . $order_clause . " LIMIT ? OFFSET ?";
    $params[] = $limit;
    $params[] = $offset;
    $types .= "ii";

    $stmt = $conn->prepare($data_sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $items = [];
    while ($row = $result->fetch_assoc()) {
        $row['id'] = (int)$row['id'];
        $row['quantity'] = (int)$row['quantity'];
        $items[] = $row;
    }

    $response['success'] = true;
    $response['data'] = $items;
    $stmt->close();
    // --- FIN DE LA MODIFICACIÓN ---

} catch (Exception $e) {
    $response['message'] = 'Error de servidor: ' . $e->getMessage();
}

$conn->close();
echo json_encode($response, JSON_INVALID_UTF8_SUBSTITUTE);
?>