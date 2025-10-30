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
    // Apuntamos al nuevo tbody de la tabla
    const requestsContent = document.getElementById('requests-table-body');
    if (!requestsContent) {
        console.error('No se encontró el elemento #requests-table-body');
        return;
    }
    // --- MODIFICACIÓN: Colspan cambiado a 9 ---
    requestsContent.innerHTML = '<tr><td colspan="9" style="text-align:center;">Cargando solicitudes...</td></tr>';
    
    try {
        const response = await fetch(`${API_URL}get_pending_actions.php`);
        const result = await response.json();

        if (result.success && result.data.length > 0) {
            renderActions(result.data);
        } else if (result.success) {
            // --- MODIFICACIÓN: Colspan cambiado a 9 ---
            requestsContent.innerHTML = '<tr><td colspan="9" style="text-align:center;">No hay solicitudes pendientes de aprobación.</td></tr>';
        } else {
            // --- MODIFICACIÓN: Colspan cambiado a 9 ---
            requestsContent.innerHTML = `<tr><td colspan="9" style="text-align:center;">Error al cargar: ${result.message}</td></tr>`;
        }
    } catch (error) {
        console.error('Error de conexión:', error);
        // --- MODIFICACIÓN: Colspan cambiado a 9 ---
        requestsContent.innerHTML = '<tr><td colspan="9" style="text-align:center;">Error de conexión al cargar las solicitudes.</td></tr>';
    }
}

// --- INICIO DE LA MODIFICACIÓN ---
// Se re-escribe renderActions para que genere filas de tabla
function renderActions(actions) {
    const tableBody = document.getElementById('requests-table-body');
    let html = '';

    actions.forEach(action => {
        const actionDetails = formatActionDetails(action);
        
        // Lógica para obtener la primera imagen (si imagePath es un JSON)
        let firstImage = 'img/icono_municipal.png'; // Imagen por defecto
        if (action.imagePath) {
            try {
                // Si imagePath es un string JSON (ej: ["img1.jpg", "img2.jpg"])
                const images = JSON.parse(action.imagePath);
                if (Array.isArray(images) && images.length > 0) {
                    firstImage = images[0];
                }
            } catch (e) {
                // Si no es JSON, es una ruta simple (ej: "img1.jpg")
                firstImage = action.imagePath; 
            }
        }
        
        // Para solicitudes 'hacienda_add', el ítem aún no existe, así que tomamos el nombre de action_data
        let itemNombre = action.name; // Nombre de la tabla inventory_items
        let itemCodigo = action.codigo_item; // Código de la tabla inventory_items

        // --- NUEVA LÓGICA para Descripción ---
        let itemDescription = action.description || ''; // Descripción desde i.description (para edit, transfer, decommission)
        
        if (action.action_type === 'hacienda_add') {
            try {
                const data = JSON.parse(action.action_data);
                itemNombre = data.name || 'Alta de Hacienda';
                itemCodigo = 'N/A (Nuevo)';
                itemDescription = data.description || ''; // Descripción desde action_data
                if (data.itemImages && data.itemImages.length > 0) {
                    firstImage = data.itemImages[0];
                }
            } catch (e) { /* Mantener valores por defecto */ }
        }

        html += `
            <tr>
                <td>${itemCodigo || 'N/A'}</td>
                
                <td><img src="${firstImage}" 
                         class="solicitud-imagen-clickable"
                         data-full-src="${firstImage}"
                         data-item-name="${itemNombre || 'N/A'}"
                         data-item-desc="${itemDescription || 'Sin descripción.'}"
                         data-item-user="${action.username}"
                         data-request-type="${actionDetails.title}"
                         style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; cursor: pointer;" 
                         alt="img">
                </td>
                
                <td>${itemNombre || 'N/A'}</td>
                
                <td style="white-space: normal; max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${itemDescription || ''}">
                    ${itemDescription || ''}
                </td>

                <td><span class="action-type ${action.action_type}">${actionDetails.title}</span></td>
                <td>${action.username}</td>
                <td>${new Date(action.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td>${actionDetails.body}</td> 
                <td>
                    <button class="button review-btn" data-action-id="${action.id}" style="padding: 8px 12px;">Revisar</button>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
    
    // --- NUEVO: Llamar a la función para configurar el modal ---
    setupImageModalListeners();
    
    // Volver a asignar los listeners a los nuevos botones
    document.querySelectorAll('.review-btn').forEach(button => {
        button.addEventListener('click', () => {
            const action = actions.find(a => a.id == button.dataset.actionId);
            showReviewModal(action);
        });
    });
}
// --- FIN DE LA MODIFICACIÓN ---


function formatActionDetails(action) {
    if (!action.action_data) return { title: 'Error', body: '<p>Datos corruptos.</p>' };
    const data = JSON.parse(action.action_data);
    if (!data) return { title: 'Error', body: '<p>No se pudieron leer los detalles.</p>' };

    switch (action.action_type) {
        case 'hacienda_add': {
            let detailsHtml = '<ul>';
            const fieldLabels = {
                name: 'Nombre', quantity: 'Cantidad', category: 'Categoría',
                valor: 'Valor', proveedor: 'Proveedor'
            };
            for (const key in data) {
                if (fieldLabels[key] && data[key]) {
                    detailsHtml += `<li><strong>${fieldLabels[key]}:</strong> ${data[key]}</li>`;
                }
            }
            detailsHtml += '</ul>';
            // Para el modal, mostramos todo. Para la tabla, un resumen.
            const fullDetails = '<h4>Detalles del Nuevo Bien:</h4>' + detailsHtml.replace('<ul>', '').replace('</ul>', '').split('<li>').join('<p>').split('</li>').join('</p>');
            
            // Lógica completa para el modal
            const modalBody = formatHaciendaAddModalBody(data);

            return { title: 'Alta (Hacienda)', body: detailsHtml, modalBody: modalBody };
        }

        case 'edit': {
            let changesHtml = `<p>Cambios propuestos:</p><ul>`;
            let hasChanges = false;
            const fields = ['name', 'quantity', 'category', 'description', 'incorporacion', 'status', 'encargado'];
            const fieldLabels = { name: 'Nombre', quantity: 'Cantidad', category: 'Categoría', description: 'Descripción', incorporacion: 'Incorporación', status: 'Estado', encargado: 'Encargado' };

            fields.forEach(key => {
                const oldValue = data.old_data[key] || '';
                const newValue = data.new_data[key] || '';
                if (oldValue.toString() !== newValue.toString()) {
                    hasChanges = true;
                    changesHtml += `<li><strong>${fieldLabels[key]}:</strong> ${oldValue} ➔ <strong>${newValue}</strong></li>`;
                }
            });
            changesHtml += '</ul>';
            
            if (!hasChanges) {
                changesHtml = "<p>Sin cambios detectados.</p>";
            }
            
            // Cuerpo completo para el modal (tabla de comparación)
            const modalBody = `<p>Solicitud para editar el ítem <strong>${data.old_data.name}</strong>:</p>
                               <table class="log-table" style="margin-top: 10px; width:100%;">
                                   <thead><tr><th>Campo</th><th>Valor Anterior</th><th>Valor Nuevo</th></tr></thead>
                                   <tbody>
                                    ${fields.map(key => {
                                        const oldValue = data.old_data[key] || '';
                                        const newValue = data.new_data[key] || '';
                                        if (oldValue.toString() !== newValue.toString()) {
                                            return `<tr>
                                                        <td><strong>${fieldLabels[key]}</strong></td>
                                                        <td>${oldValue}</td>
                                                        <td><strong>${newValue}</strong></td>
                                                    </tr>`;
                                        }
                                        return '';
                                    }).join('')}
                                   </tbody>
                               </table>`;

            return { title: 'Edición de Ítem', body: changesHtml, modalBody: modalBody };
        }
            
        case 'transfer': {
             const originName = nodesMap.get(data.origin_node_id) || 'Área Desconocida';
             const destinationName = nodesMap.get(data.destination_node_id) || 'Área Desconocida';
             let transferHtml = `<ul>
                                     <li><strong>Hacia:</strong> ${destinationName}</li>
                                     <li><strong>Motivo:</strong> ${data.reason || 'N/D'}</li>
                                 </ul>`;
             
             // Cuerpo completo para el modal
             const modalBody = `<p>Solicitud para traspasar el ítem <strong>${data.item_name}</strong>:</p>
                                 <ul>
                                     <li><strong>Desde:</strong> ${originName}</li>
                                     <li><strong>Hacia:</strong> ${destinationName}</li>
                                     <li><strong>Nuevo Encargado:</strong> ${data.new_encargado}</li>
                                     <li><strong>Motivo:</strong> ${data.reason || 'No especificado'}</li>
                                 </ul>`;

             return { title: 'Traspaso de Ítem', body: transferHtml, modalBody: modalBody };
        }

        case 'decommission':
            const modalBody = `<p>Solicitud para dar de baja el ítem: <strong>${data.item_name || `ID ${data.item_id}`}</strong>.</p><p>Esta acción marcará el ítem como 'De Baja' (D) y lo ocultará de las vistas principales.</p>`;
            return { title: 'Solicitud de Baja', body: `<p>Dar de baja: <strong>${data.item_name}</strong></p>`, modalBody: modalBody };

        default:
            return { title: 'Desconocido', body: '<p>Detalles no disponibles.</p>', modalBody: '<p>Detalles no disponibles.</p>' };
    }
}

// Nueva función auxiliar para el modal de Hacienda
function formatHaciendaAddModalBody(data) {
    let detailsHtml = '<h4>Detalles del Nuevo Bien:</h4><ul style="list-style-type: none; padding-left: 0;">';
    const fieldLabels = {
        name: 'Nombre', quantity: 'Cantidad', category: 'Categoría', description: 'Descripción',
        incorporacion: 'Fecha Incorporación', status: 'Estado Inicial', encargado: 'Encargado',
        valor: 'Valor', garantia: 'Garantía', tipo_compra: 'Tipo de Compra', proveedor: 'Proveedor',
        cuit: 'CUIT', expediente: 'Expediente', numero_expediente: 'N° Expediente',
        codigo_comprobante: 'Cód. Comprobante', tipo_comprobante: 'Tipo Comprobante', numero_comprobante: 'N° Comprobante'
    };
    for (const key in data) {
        if (fieldLabels[key] && data[key]) {
            detailsHtml += `<li style="padding: 4px 0;"><strong>${fieldLabels[key]}:</strong> ${data[key]}</li>`;
        }
    }
    detailsHtml += '</ul>';

    if (data.itemImages && data.itemImages.length > 0) {
        detailsHtml += '<h4 style="margin-top: 15px;">Imágenes Adjuntas:</h4><div style="display:flex; flex-wrap:wrap; gap:10px;">';
        data.itemImages.forEach(imgPath => {
            detailsHtml += `<a href="${imgPath}" target="_blank"><img src="${imgPath}" style="height:80px; width: 80px; object-fit: cover; border-radius: 5px; border: 1px solid #ddd;"></a>`;
        });
        detailsHtml += '</div>';
    }
    return detailsHtml;
}


function showReviewModal(action) {
    const modal = document.getElementById('review-modal');
    // Usamos .modalBody si existe, si no, usamos .body
    const actionDetails = formatActionDetails(action);
    const modalBodyContent = actionDetails.modalBody || actionDetails.body;


    document.getElementById('review-action-id').value = action.id;
    document.getElementById('review-username').textContent = action.username;
    document.getElementById('review-action-type').textContent = actionDetails.title;
    document.getElementById('review-details').innerHTML = modalBodyContent; // Aquí usamos el contenido del modal
    document.getElementById('review-comment').value = '';
    
    const approveBtn = modal.querySelector('.approve-btn');
    const rejectBtn = modal.querySelector('.reject-btn');

    // Clonamos los botones para limpiar listeners antiguos
    const approveBtnClone = approveBtn.cloneNode(true);
    const rejectBtnClone = rejectBtn.cloneNode(true);
    approveBtn.parentNode.replaceChild(approveBtnClone, approveBtn);
    rejectBtn.parentNode.replaceChild(rejectBtnClone, rejectBtn);


    const handleReview = async (status) => {
        // Deshabilitar botones para evitar doble click
        approveBtnClone.disabled = true;
        rejectBtnClone.disabled = true;

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
                loadPendingActions(); // Recargar la lista
            } else {
                alert(`Error al revisar: ${result.message}`);
            }

        } catch (error) {
            console.error('Error de conexión:', error);
            alert('Error de conexión al procesar la solicitud.');
        } finally {
            // Habilitar botones de nuevo en caso de error
            approveBtnClone.disabled = false;
            rejectBtnClone.disabled = false;
        }
    };

    approveBtnClone.addEventListener('click', () => handleReview('approved'));
    rejectBtnClone.addEventListener('click', () => handleReview('rejected'));
    
    modal.querySelector('.close-modal').onclick = () => {
        modal.style.display = 'none';
    };
    
    modal.style.display = 'flex';
}

// --- NUEVA FUNCIÓN PARA CONTROLAR EL MODAL DE IMAGEN ---
function setupImageModalListeners() {
    const modal = document.getElementById('image-modal');
    if (!modal) return;

    // Elementos dentro del modal que actualizaremos
    const modalImage = document.getElementById('modal-image');
    const modalItemName = document.getElementById('modal-item-name');
    const modalItemDesc = document.getElementById('modal-item-description');
    const modalItemUser = document.getElementById('modal-item-user');
    const modalItemRequestType = document.getElementById('modal-item-request-type');
    const closeModalBtn = modal.querySelector('.close-modal-gallery');

    const closeModal = () => modal.style.display = "none";

    // Asignar evento a todas las imágenes clickables
    document.querySelectorAll('.solicitud-imagen-clickable').forEach(img => {
        img.addEventListener('click', () => {
            const data = img.dataset; // Obtener todos los atributos data-*
            
            // Llenar el modal con la información
            modalImage.src = data.fullSrc;
            modalItemName.textContent = data.itemName;
            modalItemDesc.textContent = data.itemDesc;
            modalItemUser.textContent = data.itemUser;
            modalItemRequestType.textContent = data.requestType;
            
            // Mostrar el modal
            modal.style.display = "flex";
        });
    });

    // Eventos para cerrar el modal
    closeModalBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        // Cerrar si se hace clic en el fondo oscuro
        if (e.target === modal) closeModal();
    });
}