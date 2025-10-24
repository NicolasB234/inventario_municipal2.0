<?php
// Este archivo ahora contiene una función reutilizable para registrar la actividad.

function log_activity($conn, $user_id, $username, $action_type, $details, $recipient_user_id = null) {
    // Usamos un 'try-catch' para que un fallo en el log no detenga la acción principal.
    try {
        // --- INICIO DE LA CORRECIÓN ---
        // La consulta ahora incluye la nueva columna para el destinatario.
        $stmt = $conn->prepare(
            "INSERT INTO activity_log (user_id, username, action_type, details, recipient_user_id) VALUES (?, ?, ?, ?, ?)"
        );
        // El 'isssi' corresponde a los tipos de datos: integer, string, string, string, integer.
        $stmt->bind_param("isssi", $user_id, $username, $action_type, $details, $recipient_user_id);
        // --- FIN DE LA CORRECCIÓN ---
        
        $stmt->execute();
        $stmt->close();
        return true;
    } catch (Exception $e) {
        // En un entorno de producción, aquí se podría registrar el error en un archivo de sistema.
        // error_log('Error al registrar actividad: ' . $e->getMessage());
        return false;
    }
}
?>