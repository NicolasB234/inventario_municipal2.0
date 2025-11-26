<?php
session_start();
require_once 'db_connect.php'; // Usa tu conexión MySQLi existente
header('Content-Type: application/json');

// 1. Verificar sesión
if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit;
}

// 2. Verificar conexión a DB
if (!$conn) {
    echo json_encode(['success' => false, 'message' => 'Error de conexión a la base de datos']);
    exit;
}

try {
    // --- CONSULTA PRINCIPAL (Ajustada a tu tabla 'inventory_items') ---
    $sql_main = "
        SELECT
            COUNT(*) as total_general,
            SUM(CASE WHEN status = 'A' THEN 1 ELSE 0 END) as total_aptos,
            SUM(CASE WHEN status = 'N' THEN 1 ELSE 0 END) as total_no_aptos,
            SUM(CASE WHEN status = 'R' THEN 1 ELSE 0 END) as total_recuperables,
            SUM(CASE WHEN status = 'D' THEN 1 ELSE 0 END) as total_baja
        FROM inventory_items 
    ";

    $result_main = $conn->query($sql_main);

    if (!$result_main) {
        throw new Exception("Error en la consulta: " . $conn->error);
    }

    $stats = $result_main->fetch_assoc();

    // --- CONSULTA DE PENDIENTES (Opcional, maneja error si no existe la tabla) ---
    $stats['total_pendientes'] = 0;
    
    // Solo intentamos consultar si existe la tabla de staging
    $check_table = $conn->query("SHOW TABLES LIKE 'staging_inventory'");
    if ($check_table && $check_table->num_rows > 0) {
        $sql_pending = "SELECT COUNT(*) as total_pendientes FROM staging_inventory";
        $result_pending = $conn->query($sql_pending);
        if ($result_pending) {
            $pending = $result_pending->fetch_assoc();
            $stats['total_pendientes'] = $pending['total_pendientes'] ?? 0;
        }
    }

    // --- LIMPIEZA DE DATOS (Null a 0) ---
    foreach ($stats as $key => $value) {
        $stats[$key] = $value ?? 0;
    }

    echo json_encode(['success' => true, 'data' => $stats]);

} catch (Exception $e) {
    // Devuelve error 500 pero con mensaje JSON para que el JS no falle silenciosamente
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error del servidor: ' . $e->getMessage()]);
}
?>