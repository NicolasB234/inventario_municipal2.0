<?php
require_once 'db_connect.php';
header('Content-Type: application/json');

$response = ['success' => false, 'data' => []];

try {
    // --- INICIO DE LA MODIFICACIÓN ---
    // Se reemplaza la consulta a la base de datos por una lista fija de categorías.
    // Ahora puedes editar esta lista directamente para cambiar las opciones en el formulario.
    $categories = [
        "Audiovisuales",
        "Elementos de Cocina",
        "Elementos de señalizacion y carteleria",
        "Equipos Eléctricos",
        "Equipos Informáticos y Sistemas",
        "Herramientas",
        "Instrumental de Salud",
        "Maquinarias y Equipo Pesado",
        "Repuestos e insumos de alto valor",
        "Rodados",
        "mobiliario",
        
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