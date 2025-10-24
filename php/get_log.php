<?php
require_once 'db_connect.php';
header('Content-Type: application/json');

$response = ['success' => false, 'data' => []];

// --- INICIO DE LA MODIFICACIÓN ---
// Se añade un límite configurable, con un valor por defecto de 20.
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
// Nos aseguramos de que el límite no sea excesivo.
if ($limit <= 0 || $limit > 200) {
    $limit = 20;
}
// --- FIN DE LA MODIFICACIÓN ---

try {
    // La consulta ahora usa el límite configurable.
    $stmt = $conn->prepare("SELECT id, username, action_type, details, timestamp FROM activity_log ORDER BY id DESC LIMIT ?");
    $stmt->bind_param("i", $limit);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $logs = [];
    while ($row = $result->fetch_assoc()) {
        $logs[] = $row;
    }

    $response['success'] = true;
    $response['data'] = $logs;

} catch (Exception $e) {
    $response['message'] = 'Error de servidor: ' . $e->getMessage();
}

$conn->close();
echo json_encode($response);
?>