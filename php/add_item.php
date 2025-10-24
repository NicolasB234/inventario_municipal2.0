<?php
require_once 'db_connect.php';
require_once 'log_activity.php';
header('Content-Type: application/json');
session_start();

$response = ['success' => false, 'message' => ''];

if (!isset($_SESSION['user_id'])) {
    $response['message'] = 'Acceso no autorizado.';
    echo json_encode($response);
    exit;
}

function generateUniqueCodigoItem($conn, $prefix = 'INV-') {
    $stmt = $conn->prepare("SELECT codigo_item FROM inventory_items ORDER BY id DESC LIMIT 1");
    $stmt->execute();
    $last_item = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $number = $last_item ? (int)preg_replace('/[^0-9]/', '', $last_item['codigo_item']) : 0;
    return $prefix . str_pad($number + 1, 5, '0', STR_PAD_LEFT);
}

if (!isset($_POST['name']) || !isset($_POST['category']) || !isset($_POST['status'])) {
    $response['message'] = 'Faltan datos requeridos (nombre, categoría, estado).';
    echo json_encode($response);
    exit;
}

$node_id = !empty($_POST['node_id']) ? $_POST['node_id'] : null;
$name = trim($_POST['name']);
$quantity = (int)($_POST['quantity'] ?? 1);
$category = trim($_POST['category']);
$description = trim($_POST['description'] ?? '');
$incorporacion = !empty($_POST['incorporacion']) ? trim($_POST['incorporacion']) : null;
$status = trim($_POST['status']);
$encargado = trim($_POST['encargado'] ?? 'No Asignado');
$codigo_item = generateUniqueCodigoItem($conn);

// --- INICIO DE LA CORRECCIÓN ---
$imagePaths = [];
// El nombre del campo en el HTML es 'itemImage[]', por lo que aquí usamos 'itemImage'.
if (isset($_FILES['itemImage']) && !empty($_FILES['itemImage']['name'][0])) {
    $uploadDir = __DIR__ . '/../uploads/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    
    foreach ($_FILES['itemImage']['name'] as $key => $fileName) {
        if ($_FILES['itemImage']['error'][$key] === UPLOAD_ERR_OK) {
            $tmpName = $_FILES['itemImage']['tmp_name'][$key];
            $newFileName = uniqid() . '-' . basename($fileName);
            $targetFile = $uploadDir . $newFileName;
            if (move_uploaded_file($tmpName, $targetFile)) {
                $imagePaths[] = 'uploads/' . $newFileName;
            }
        }
    }
}
$imagePathsJson = !empty($imagePaths) ? json_encode($imagePaths, JSON_UNESCAPED_SLASHES) : null;
// --- FIN DE LA CORRECCIÓN ---

$sql = "INSERT INTO inventory_items (codigo_item, node_id, name, quantity, category, description, incorporacion, status, imagePath, encargado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
$stmt = $conn->prepare($sql);

$stmt->bind_param("sssissssss", $codigo_item, $node_id, $name, $quantity, $category, $description, $incorporacion, $status, $imagePathsJson, $encargado);

if ($stmt->execute()) {
    $response['success'] = true;
    $response['message'] = 'Ítem agregado con éxito.';
    $log_details = "Usuario '{$_SESSION['username']}' agregó el nuevo ítem '$name' con código '$codigo_item'.";
    log_activity($conn, $_SESSION['user_id'], $_SESSION['username'], 'add_item', $log_details);
} else {
    $response['message'] = 'Error al agregar el ítem: ' . $stmt->error;
}

$stmt->close();
$conn->close();
echo json_encode($response);
?>