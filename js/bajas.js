// js/bajas.js

document.addEventListener('DOMContentLoaded', () => {
    fetchBajas();
});

async function fetchBajas() {
    const tableBody = document.getElementById('bajas-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="7">Cargando historial de bajas...</td></tr>';

    try {
        const response = await fetch('php/get_decommissioned_items.php');
        const result = await response.json();

        if (result.success && result.data.length > 0) {
            tableBody.innerHTML = result.data.map(item => {
                const details = JSON.parse(item.item_details_json || '{}');
                const date = new Date(item.decommission_date).toLocaleString('es-AR');
                const statusLabel = item.status === 'approved' ? 'Aprobada' : 'Pendiente';
                const statusClass = item.status === 'approved' ? 'status-approved' : 'status-pending';

                return `
                    <tr>
                        <td>${date}</td>
                        <td>${details.name || 'N/A'} (${details.codigo_item || 'N/A'})</td>
                        <td>${details.area_name || 'N/A'}</td>
                        <td>${item.reason}</td>
                        <td>${item.username}</td>
                        <td><span class="${statusClass}">${statusLabel}</span></td>
                        <td>
                            <a href="${item.image_path}" target="_blank" class="button" title="Ver imagen">
                                <i class="fas fa-camera"></i>
                            </a>
                        </td>
                    </tr>
                `;
            }).join('');
        } else if (result.success) {
            tableBody.innerHTML = '<tr><td colspan="7">No se encontraron bajas registradas.</td></tr>';
        } else {
            tableBody.innerHTML = `<tr><td colspan="7">Error al cargar: ${result.message}</td></tr>`;
        }
    } catch (error) {
        console.error('Error:', error);
        tableBody.innerHTML = '<tr><td colspan="7">Error de conexión al cargar el historial.</td></tr>';
    }
}