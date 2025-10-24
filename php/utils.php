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
 * --- INICIO DE LA NUEVA FUNCIONALIDAD ---
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

    // 2. Mapa de Alias (Traductor de nombres comunes del Excel a IDs oficiales)
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
        // Puedes agregar más alias aquí si encuentras otros nombres problemáticos
    ];

    if (isset($aliasMap[$inputName])) {
        return $aliasMap[$inputName];
    }

    // 3. Búsqueda por similitud (Levenshtein) como último recurso
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

    // Umbral de tolerancia ajustado para ser más flexible
    $threshold = strlen($inputName) * 0.7;
    if ($shortestDistance <= $threshold) {
        return $bestMatchId;
    }

    return null; // No se encontró ninguna coincidencia
}
// --- FIN DE LA NUEVA FUNCIONALIDAD ---
?>