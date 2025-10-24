import { orgStructure } from './org-structure.js'; // Importar la estructura para los nombres de área

// --- NUEVA FUNCIÓN UTILITARIA ---
const nodesMap = (function() {
    const map = new Map();
    function traverse(nodes) {
        nodes.forEach(node => {
            map.set(node.id, node.name);
            if (node.children) traverse(node.children);
        });
    }
    traverse(orgStructure);
    return map;
})();


document.addEventListener('DOMContentLoaded', async () => {
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    if (!isAdmin) {
        window.location.href = 'index.html';
        return;
    }
    loadPendingActions();
});

const API_URL = 'php/';

async function loadPendingActions() {
    const requestsContent = document.getElementById('requests-content');
    requestsContent.innerHTML = '<p>Cargando solicitudes...</p>';
    try {
        const response = await fetch(`${API_URL}get_pending_actions.php`);
        const result = await response.json();

        if (result.success && result.data.length > 0) {
            renderActions(result.data);
        } else if (result.success) {
            requestsContent.innerHTML = '<p>No hay solicitudes pendientes de aprobación.</p>';
        } else {
            requestsContent.innerHTML = `<p>Error al cargar las solicitudes: ${result.message}</p>`;
        }
    } catch (error) {
        console.error('Error de conexión:', error);
        requestsContent.innerHTML = '<p>Error de conexión al cargar las solicitudes.</p>';
    }
}

function renderActions(actions) {
    const requestsContent = document.getElementById('requests-content');
    let html = '';
    actions.forEach(action => {
        const actionDetails = formatActionDetails(action);
        const cardClass = action.action_type === 'hacienda_add' ? 'request-card hacienda-pending' : 'request-card';
        
        html += `
            <div class="${cardClass}">
                <div class="request-header">
                    <span class="action-type ${action.action_type}">${actionDetails.title}</span>
                    <span class="request-user">Usuario: <strong>${action.username}</strong></span>
                    <span class="request-date">${new Date(action.created_at).toLocaleString('es-AR')}</span>
                </div>
                <div class="request-body">
                    ${actionDetails.body}
                </div>
                <div class="request-footer">
                    <button class="button review-btn" data-action-id="${action.id}">Revisar</button>
                </div>
            </div>
        `;
    });
    requestsContent.innerHTML = html;
    
    document.querySelectorAll('.review-btn').forEach(button => {
        button.addEventListener('click', () => {
            const action = actions.find(a => a.id == button.dataset.actionId);
            showReviewModal(action);
        });
    });
}

function formatActionDetails(action) {
    if (!action.action_data) return { title: 'Error', body: '<p>Datos corruptos.</p>' };
    const data = JSON.parse(action.action_data);
    if (!data) return { title: 'Error', body: '<p>No se pudieron leer los detalles.</p>' };

    switch (action.action_type) {
        case 'hacienda_add': {
            let detailsHtml = '<h4>Detalles del Nuevo Bien:</h4><ul>';
            const fieldLabels = {
                name: 'Nombre', quantity: 'Cantidad', category: 'Categoría', description: 'Descripción',
                incorporacion: 'Fecha Incorporación', status: 'Estado Inicial', encargado: 'Encargado',
                valor: 'Valor', garantia: 'Garantía', tipo_compra: 'Tipo de Compra', proveedor: 'Proveedor',
                cuit: 'CUIT', expediente: 'Expediente', numero_expediente: 'N° Expediente',
                codigo_comprobante: 'Cód. Comprobante', tipo_comprobante: 'Tipo Comprobante', numero_comprobante: 'N° Comprobante'
            };
            for (const key in data) {
                if (fieldLabels[key] && data[key]) {
                    detailsHtml += `<li><strong>${fieldLabels[key]}:</strong> ${data[key]}</li>`;
                }
            }
            detailsHtml += '</ul>';

            if (data.itemImages && data.itemImages.length > 0) {
                detailsHtml += '<h4>Imágenes Adjuntas:</h4><div style="display:flex; flex-wrap:wrap; gap:10px;">';
                data.itemImages.forEach(imgPath => {
                    detailsHtml += `<a href="${imgPath}" target="_blank"><img src="${imgPath}" style="max-height:80px; border-radius: 5px; border: 1px solid #ddd;"></a>`;
                });
                detailsHtml += '</div>';
            }
            return { title: 'Alta de Bien (Hacienda)', body: detailsHtml };
        }

        case 'edit': {
            let changesHtml = `<p>Solicitud para editar el ítem <strong>${data.old_data.name}</strong>:</p>
                               <table class="log-table" style="margin-top: 10px;">
                                   <thead><tr><th>Campo</th><th>Valor Anterior</th><th>Valor Nuevo</th></tr></thead>
                                   <tbody>`;
            let hasChanges = false;
            const fields = ['name', 'quantity', 'category', 'description', 'incorporacion', 'status', 'encargado'];
            const fieldLabels = { name: 'Nombre', quantity: 'Cantidad', category: 'Categoría', description: 'Descripción', incorporacion: 'Incorporación', status: 'Estado', encargado: 'Encargado' };

            fields.forEach(key => {
                const oldValue = data.old_data[key] || '';
                const newValue = data.new_data[key] || '';
                if (oldValue.toString() !== newValue.toString()) {
                    hasChanges = true;
                    changesHtml += `<tr>
                                        <td><strong>${fieldLabels[key]}</strong></td>
                                        <td>${oldValue}</td>
                                        <td><strong>${newValue}</strong></td>
                                    </tr>`;
                }
            });
            changesHtml += '</tbody></table>';
            
            if (!hasChanges) {
                changesHtml = "<p>No se propusieron cambios en los campos editables.</p>";
            }

            return { title: 'Edición de Ítem', body: changesHtml };
        }
            
        case 'transfer': {
             const originName = nodesMap.get(data.origin_node_id) || 'Área Desconocida';
             const destinationName = nodesMap.get(data.destination_node_id) || 'Área Desconocida';
             let transferHtml = `<p>Solicitud para traspasar el ítem <strong>${data.item_name}</strong>:</p>
                                 <ul>
                                     <li><strong>Desde:</strong> ${originName}</li>
                                     <li><strong>Hacia:</strong> ${destinationName}</li>
                                     <li><strong>Nuevo Encargado:</strong> ${data.new_encargado}</li>
                                     <li><strong>Motivo:</strong> ${data.reason || 'No especificado'}</li>
                                 </ul>`;

             return { title: 'Traspaso de Ítem', body: transferHtml };
        }

        case 'decommission':
            return { title: 'Solicitud de Baja', body: `<p>Solicitud para dar de baja el ítem: <strong>${data.item_name || `ID ${data.item_id}`}</strong>.</p>` };

        default:
            return { title: 'Desconocido', body: '<p>Detalles no disponibles.</p>' };
    }
}

function showReviewModal(action) {
    const modal = document.getElementById('review-modal');
    const actionDetails = formatActionDetails(action);

    document.getElementById('review-action-id').value = action.id;
    document.getElementById('review-username').textContent = action.username;
    document.getElementById('review-action-type').textContent = actionDetails.title;
    document.getElementById('review-details').innerHTML = actionDetails.body;
    document.getElementById('review-comment').value = '';
    
    const approveBtn = modal.querySelector('.approve-btn');
    const rejectBtn = modal.querySelector('.reject-btn');

    const handleReview = async (status) => {
        const formData = new FormData();
        formData.append('action_id', document.getElementById('review-action-id').value);
        formData.append('comment', document.getElementById('review-comment').value);
        formData.append('status', status);

        try {
            const response = await fetch(`${API_URL}review_action.php`, {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            
            if (result.success) {
                alert('Acción revisada correctamente.');
                if (result.newItemId) {
                    sessionStorage.setItem('highlightItemId', result.newItemId);
                }
                modal.style.display = 'none';
                loadPendingActions();
            } else {
                alert(`Error al revisar: ${result.message}`);
            }

        } catch (error) {
            console.error('Error de conexión:', error);
            alert('Error de conexión al procesar la solicitud.');
        }
    };

    approveBtn.onclick = () => handleReview('approved');
    rejectBtn.onclick = () => handleReview('rejected');
    
    modal.querySelector('.close-modal').onclick = () => {
        modal.style.display = 'none';
        approveBtn.onclick = null;
        rejectBtn.onclick = null;
    };
    
    modal.style.display = 'flex';
}