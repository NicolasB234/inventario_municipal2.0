<?php


class Database {
    private static $conn = null;

    private function __construct() {
    }

    // El método estático que obtiene la conexión.
    public static function getInstance() {
        if (self::$conn === null) {
            $servername = "srv1432.hstgr.io";
            $username = "u715915870_root"; // Tu usuario de Hostinger
            $password = "Inventario7F%"; // Tu contraseña de la base de datos
            $dbname = "u715915870_inventario2"; // Tu nombre de base de datos

            try {
                self::$conn = new mysqli($servername, $username, $password, $dbname);

                if (self::$conn->connect_error) {
                    throw new Exception("Error de conexión: " . self::$conn->connect_error);
                }

                self::$conn->set_charset("utf8mb4");

            } catch (Exception $e) {
                header('Content-Type: application/json');
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Error de conexión a la base de datos: ' . $e->getMessage()
                ]);
                exit();
            }
        }
        return self::$conn;
    }

    // Método para cerrar la conexión (opcional, pero buena práctica)
    public static function closeInstance() {
        if (self::$conn !== null) {
            self::$conn->close();
            self::$conn = null;
        }
    }
}

// --- Uso en toda la aplicación ---
// Ahora, en lugar de crear una nueva conexión, obtenemos la instancia existente.
$conn = Database::getInstance();

?>