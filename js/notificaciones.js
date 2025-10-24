document.addEventListener('DOMContentLoaded', async () => {
    const logsContent = document.getElementById('logs-content');
    const searchInput = document.getElementById('search-input');
    const dateFromInput = document.getElementById('date-from');
    const dateToInput = document.getElementById('date-to');
    const userFilterInput = document.getElementById('user-filter');
    const actionFilterInput = document.getElementById('action-filter');
    const API_URL = 'php/';

    let allLogs = [];

    const actionMap = {
        'agregado': 'add_item',
        'editado': 'edited',    
        'importado': 'import',      
        'exportado': 'exported',
        'baja': 'decommissioned',
        'traspaso': 'transferred' 
    };

    function normalizeText(text) {
        if (!text) return '';
        return text
            .toString()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    // Renderiza tabla
    function renderLogsTable(logs) {
        if (logs.length > 0) {
            const table = document.createElement('table');
            table.className = 'log-table';

            let tableHTML = `
                <thead>
                    <tr>
                        <th>Fecha y Hora</th>
                        <th>Usuario</th>
                        <th>Tipo de Acción</th>
                        <th>Detalles</th>
                    </tr>
                </thead>
                <tbody>
            `;

            logs.forEach(log => {
                const date = new Date(log.timestamp).toLocaleString('es-AR');
                tableHTML += `
                    <tr>
                        <td>${date}</td>
                        <td>${log.username}</td>
                        <td>${log.action_type}</td>
                        <td>${log.details}</td>
                    </tr>
                `;
            });

            tableHTML += '</tbody>';
            table.innerHTML = tableHTML;
            logsContent.innerHTML = '';
            logsContent.appendChild(table);

        } else {
            logsContent.innerHTML = '<p>No se encontraron registros que coincidan con los filtros.</p>';
        }
    }

    // Filtro avanzado (esta función no necesita cambios)
    function applyFilters() {
        const searchTerm = normalizeText(searchInput.value);
        const userTerm = normalizeText(userFilterInput.value);
        const selectedAction = actionFilterInput.value;
        const dateFrom = dateFromInput.value ? new Date(dateFromInput.value) : null;
        const dateTo = dateToInput.value ? new Date(dateToInput.value) : null;

        const filteredLogs = allLogs.filter(log => {
            const logDate = new Date(log.timestamp);
            const searchableText = normalizeText(
                log.timestamp + ' ' +
                log.username + ' ' +
                log.action_type + ' ' +
                log.details
            );

            const englishKeyword = actionMap[selectedAction];
            const matchesAction = selectedAction === '' || (englishKeyword && log.action_type.includes(englishKeyword));

            const matchesText = searchTerm === '' || searchableText.includes(searchTerm);
            const matchesUser = userTerm === '' || normalizeText(log.username).includes(userTerm);
            const matchesDateFrom = !dateFrom || logDate >= dateFrom;
            const matchesDateTo = !dateTo || logDate <= dateTo;

            return matchesText && matchesUser && matchesAction && matchesDateFrom && matchesDateTo;
        });

        renderLogsTable(filteredLogs);
    }

    // Cargar logs iniciales
    try {
        const response = await fetch(`${API_URL}get_log.php`);
        const result = await response.json();

        if (result.success && result.data.length > 0) {
            allLogs = result.data;
            renderLogsTable(allLogs);
        } else if (result.success) {
            logsContent.innerHTML = '<p>No hay registros de actividad en el sistema.</p>';
        } else {
            logsContent.innerHTML = `<p>Error al cargar los registros: ${result.message}</p>`;
        }
    } catch (error) {
        console.error('Error al obtener los logs:', error);
        logsContent.innerHTML = '<p>Error de conexión al cargar el historial de actividad.</p>';
    }

    // Listeners de búsqueda avanzada
    [searchInput, userFilterInput, actionFilterInput, dateFromInput, dateToInput].forEach(input => {
        input.addEventListener('input', applyFilters);
    });
});