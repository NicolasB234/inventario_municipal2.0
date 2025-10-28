<?php
// php/utils.php

/**
 * Busca de forma recursiva el nombre de un nodo (área) a partir de su ID.
 *
 * @param array $nodes La estructura del organigrama donde buscar.
 * @param string $id El ID del nodo a encontrar.
 * @return string|null El nombre del nodo o null si no se encuentra.
 */
function getAreaNameById($nodes, $id) {
    foreach ($nodes as $node) {
        if ($node['id'] === $id) {
            return $node['name'];
        }
        if (!empty($node['children'])) {
            $found = getAreaNameById($node['children'], $id);
            if ($found) {
                return $found;
            }
        }
    }
    return null;
}

/**
 * Crea un mapa asociativo de 'nombre del área en minúsculas' => 'ID del Área'.
 *
 * @param array $structure La estructura completa del organigrama.
 * @return array El mapa generado.
 */
function createAreaMap($structure) {
    $map = [];
    $traverse = function ($nodes, &$map) use (&$traverse) {
        foreach ($nodes as $node) {
            $map[strtolower(trim($node['name']))] = $node['id'];
            if (!empty($node['children'])) {
                $traverse($node['children'], $map);
            }
        }
    };
    $traverse($structure, $map);
    return $map;
}

/**
 * Encuentra el ID del área más cercana basándose en un mapa de alias y luego en similitud.
 *
 * @param string $inputName El nombre del área del archivo de importación.
 * @param array $areaMap El mapa de áreas oficiales ('nombre' => 'id').
 * @return string|null El ID del área con la coincidencia más cercana o null.
 */
function findClosestAreaId(string $inputName, array $areaMap): ?string
{
    $inputName = strtolower(trim($inputName));
    if (isset($areaMap[$inputName])) {
        return $areaMap[$inputName]; // 1. Coincidencia exacta
    }

    $aliasMap = [
        'secretario de gob. y coordinación general' => 'sec-gobierno',
        'direccion de valor agregado' => 'dir-valor-agregado',
        'secretaria de la produccion' => 'sec-produccion',
        'direccion de cultura y turismo' => 'dir-cultura-turismo',
        'secretaria de hacienda' => 'sec-hacienda',
        'secretaria de servicios publicos' => 'sec-servicios-publicos',
        'direccion de transito y seguridad vial' => 'dir-transito',
        'direccion de deportes y recreacion' => 'dir-deportes',
        'subdireccion de sistemas' => 'sub-sistemas',
        'direccion de ceremonial y protocolo' => 'dir-protocolo',
        'direccion de accion social' => 'dir-accion-social',
        'direccion de bromatologia' => 'dir-bromatologia'
    ];

    if (isset($aliasMap[$inputName])) {
        return $aliasMap[$inputName];
    }

    $bestMatchId = null;
    $shortestDistance = -1;

    foreach ($areaMap as $officialName => $id) {
        $distance = levenshtein($inputName, $officialName);

        if ($distance === 0) {
            return $id;
        }

        if ($shortestDistance < 0 || $distance < $shortestDistance) {
            $shortestDistance = $distance;
            $bestMatchId = $id;
        }
    }

    $threshold = strlen($inputName) * 0.7;
    if ($shortestDistance <= $threshold) {
        return $bestMatchId;
    }

    return null; 
}


// --- INICIO DE LAS FUNCIONES MOVIDAS ---
// Estas funciones estaban en 'bulk_import.php' y ahora son globales.

/**
 * Genera un código de ítem único (ej: INV-00123)
 *
 * @param mysqli $conn Conexión a la BD
 * @param int &$last_number Referencia a un contador para evitar consultas repetidas
 * @param string $prefix Prefijo para el código
 * @return string El nuevo código único
 */
function generateUniqueCodigoItem(mysqli $conn, int &$last_number, string $prefix = 'INV-'): string {
    if ($last_number === 0) {
        $stmt = $conn->prepare("SELECT codigo_item FROM inventory_items WHERE codigo_item LIKE ? ORDER BY id DESC LIMIT 1");
        $search_prefix = $prefix . '%';
        $stmt->bind_param("s", $search_prefix);
        $stmt->execute();
        $result = $stmt->get_result();
        $last_item = $result->fetch_assoc();
        $stmt->close();
        if ($last_item) {
            $last_number = (int)str_replace($prefix, '', $last_item['codigo_item']);
        }
    }
    $last_number++;
    return $prefix . str_pad($last_number, 5, '0', STR_PAD_LEFT);
}

/**
 * Permite usar bind_param con un array de parámetros dinámico.
 *
 * @param mysqli_stmt $stmt El statement preparado
 * @param string $types La cadena de tipos (ej: "ssis")
 * @param array &$params El array de parámetros
 * @return bool
 */
function bind_params_array(mysqli_stmt $stmt, string $types, array &$params) {
    $refs = [];
    $refs[] = &$types;
    for ($i = 0; $i < count($params); $i++) {
        $refs[] = &$params[$i];
    }
    return call_user_func_array([$stmt, 'bind_param'], $refs);
}
// --- FIN DE LAS FUNCIONES MOVIDAS ---
?>