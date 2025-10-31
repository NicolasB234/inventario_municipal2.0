<?php
// php/get_decommissioned_items.php

require_once 'db_connect.php';
header('Content-Type: application/json');
session_start();

$response = ['success' => false, 'message' => ''];
$is_admin = $_SESSION['is_admin'] ?? false;

if (!$is_admin) {
    $response['message'] = 'Acceso no autorizado. Solo los administradores pueden ver esta sección.';
    echo json_encode($response);
    exit;
}

try {
    $stmt = $conn->prepare("SELECT * FROM decommissioned_items ORDER BY decommission_date DESC");
    $stmt->execute();
    $result = $stmt->get_result();
    $data = $result->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    
    $response['success'] = true;
    $response['data'] = $data;

} catch (Exception $e) {
    $response['message'] = 'Error de base de datos: ' . $e->getMessage();
}

$conn->close();
echo json_encode($response);