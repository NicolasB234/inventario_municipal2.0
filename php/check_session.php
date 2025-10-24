<?php
// check_session.php
session_start();
header('Content-Type: application/json');

$response = ['loggedIn' => false, 'username' => null, 'areaId' => null, 'isAdmin' => false];

if (isset($_SESSION['user_id']) && isset($_SESSION['username'])) {
    $response['loggedIn'] = true;
    $response['username'] = $_SESSION['username'];
    $response['areaId'] = $_SESSION['area_id'] ?? null;
    // --- CAMBIO: Devolver el estado de admin desde la sesión ---
    $response['isAdmin'] = $_SESSION['is_admin'] ?? false;
}

echo json_encode($response);
?>