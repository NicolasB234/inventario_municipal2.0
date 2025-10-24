<?php
require_once 'db_connect.php';
header('Content-Type: application/json');

$response = ['success' => false, 'data' => []];

try {
    // --- INICIO DE LA MODIFICACIÓN ---
    // Se reemplaza la consulta a la base de datos por una lista fija de categorías.
    // Ahora puedes editar esta lista directamente para cambiar las opciones en el formulario.
    $categories = [
        "Equipos Informáticos y Sistemas",
        "Equipos Eléctricos",
        "Audiovisuales",
        "Rodados",
        "Maquinarias y Equipo Pesado",
        "Repuestos e insumos de alto valor",
        "Instrumental de Salud",
        "Elementos de señalizacion y carteleria",
        "Elementos de Cocina",
        
    ];
    // --- FIN DE LA MODIFICACIÓN ---
    
    $response['success'] = true;
    $response['data'] = $categories;

} catch (Exception $e) {
    $response['message'] = 'Error de servidor: ' . $e->getMessage();
}

$conn->close();
echo json_encode($response);
?>