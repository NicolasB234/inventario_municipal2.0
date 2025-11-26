<?php
// php/search_users.php
require_once 'db_connect.php';

header('Content-Type: application/json');

// Verificamos que la conexión exista
if (!$conn) {
    echo json_encode([]);
    exit;
}

$query = $_GET['q'] ?? '';

if (strlen($query) < 2) {
    echo json_encode([]);
    exit;
}

try {
    // Usamos MySQLi en lugar de PDO
    $stmt = $conn->prepare("SELECT username FROM users WHERE username COLLATE utf8mb4_general_ci LIKE ? LIMIT 8");
    
    if ($stmt === false) {
        throw new Exception("Error en la preparación de la consulta");
    }

    $searchTerm = "%" . $query . "%";
    $stmt->bind_param("s", $searchTerm);
    $stmt->execute();
    
    $result = $stmt->get_result();
    $users = [];

    while ($row = $result->fetch_assoc()) {
        $users[] = $row;
    }

    echo json_encode($users);
    $stmt->close();

} catch (Exception $e) {
    // En caso de error, devolvemos array vacío para no romper el JS
    echo json_encode([]);
}
?>