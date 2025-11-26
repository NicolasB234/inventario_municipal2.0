document.addEventListener('DOMContentLoaded', () => {
    // Vistas principales
    const batchesListContainer = document.getElementById('batches-list-container');
    const batchDetailContainer = document.getElementById('batch-detail-container');
    const batchesListBody = document.getElementById('batches-list-body');
    
    // Contenedores de detalles
    const batchDetailTitle = document.getElementById('batch-detail-title');
    const stagingItemsBody = document.getElementById('staging-items-body');
    
    // Acciones de Admin
    const adminActions = document.getElementById('batch-actions-admin');
    const approveBatchBtn = document.getElementById('approve-batch-btn');
    const deleteBatchBtn = document.getElementById('delete-batch-btn');
    const backToBatchesBtn = document.getElementById('back-to-batches-btn');

    // --- INICIO MODIFICACIÓN: Cabecera de Acciones ---
    const adminActionsHeader = document.getElementById('admin-actions-header');
    // --- FIN MODIFICACIÓN ---

    // Acciones de Usuario
    const userActions = document.getElementById('batch-actions-user');
    const backToBatchesBtnUser = document.getElementById('back-to-batches-btn-user');

    const API_URL = 'php/';
    let currentBatchId = null;
    let isAdmin = false;

    // --- FUNCIONES PRINCIPALES ---

    // 1. Cargar la lista de lotes (batches)
    async function loadBatches() {
        showView('list');
        batchesListBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando lotes...</td></tr>';
        try {
            const response = await fetch(`${API_URL}get_pending_batches.php`);
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message);
            }

            isAdmin = result.is_admin;
            renderBatches(result.data);

        } catch (error) {
            console.error('Error cargando lotes:', error);
            batchesListBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Error: ${error.message}</td></tr>`;
        }
    }

    // 2. Renderizar la lista de lotes
    function renderBatches(batches) {
        if (batches.length === 0) {
            batchesListBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay importaciones pendientes.</td></tr>';
            return;
        }

        let html = '';
        batches.forEach(batch => {
            html += `
                <tr>
                    <td>${batch.username}</td>
                    <td>${batch.area_id}</td>
                    <td>${new Date(batch.created_at).toLocaleString('es-AR')}</td>
                    <td>${batch.item_count} ítems</td>
                    <td>
                        <button class="button view-batch-btn" data-batch-id="${batch.import_batch_id}">
                            ${isAdmin ? 'Revisar' : 'Ver'}
                        </button>
                    </td>
                </tr>
            `;
        });
        batchesListBody.innerHTML = html;

        document.querySelectorAll('.view-batch-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                loadBatchDetails(btn.dataset.batchId);
            });
        });
    }

    // 3. Cargar los ítems de un lote específico
    async function loadBatchDetails(batchId) {
        currentBatchId = batchId;
        showView('detail');
        stagingItemsBody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Cargando ítems...</td></tr>';
        batchDetailTitle.textContent = `Detalle del Lote: ${batchId}`;
        
        if (isAdmin) {
            adminActions.style.display = 'flex';
            // --- INICIO MODIFICACIÓN: Mostrar cabecera de Acciones ---
            if (adminActionsHeader) adminActionsHeader.style.display = 'table-cell';
            // --- FIN MODIFICACIÓN ---
            userActions.style.display = 'none';
        } else {
            adminActions.style.display = 'none';
            // --- INICIO MODIFICACIÓN: Ocultar cabecera de Acciones ---
            if (adminActionsHeader) adminActionsHeader.style.display = 'none';
            // --- FIN MODIFICACIÓN ---
            userActions.style.display = 'block';
        }

        try {
            const response = await fetch(`${API_URL}get_staging_items.php?batch_id=${batchId}`);
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message);
            }

            renderStagingItems(result.data);

        } catch (error) {
            console.error('Error cargando detalles del lote:', error);
            stagingItemsBody.innerHTML = `<tr><td colspan="10" style="text-align:center;">Error: ${error.message}</td></tr>`;
        }
    }

    // 4. Renderizar la tabla de ítems (¡AQUÍ ESTÁ LA EDICIÓN!)
    function renderStagingItems(items) {
        if (items.length === 0) {
            stagingItemsBody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Este lote está vacío o ya fue procesado.</td></tr>';
            // Ocultamos botones si el lote está vacío
            if (isAdmin) adminActions.style.display = 'none';
            return;
        }

        const keys = ['codigo_item', 'nombre', 'area', 'cantidad', 'categoria', 'descripcion', 'estado', 'encargado', 'incorporacion'];

        let html = '';
        items.forEach(item => {
            const stagingId = item.staging_id;
            const data = item.item_data;
            
            html += `<tr data-staging-id="${stagingId}">`;
            
            // --- INICIO MODIFICACIÓN: Añadir celda de botones de acción ---
            if (isAdmin) {
                html += `
                    <td class="actions" style="white-space: nowrap;">
                        <button class="button save-item-btn" style="display:none; padding: 6px 10px;" title="Guardar cambios">
                            <i class="fas fa-save"></i>
                        </button>
                        <button class="button delete-item-btn" style="padding: 6px 10px; background-color: #c0392b;" title="Eliminar ítem del lote">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
            }
            // --- FIN MODIFICACIÓN ---
            
            keys.forEach(key => {
                const value = data[key] || '';
                html += `
                    <td 
                        contenteditable="${isAdmin}" 
                        data-key="${key}"
                        class="${isAdmin ? 'editable-cell' : ''}"
                    >${value}</td>
                `;
            });

            html += `</tr>`;
        });
        stagingItemsBody.innerHTML = html;

        if (isAdmin) {
            setupAdminEditing();
        }
    }

    // 5. Configurar la edición en línea para el admin
    function setupAdminEditing() {
        document.querySelectorAll('#staging-items-body tr').forEach(row => {
            const stagingId = row.dataset.stagingId;
            const saveBtn = row.querySelector('.save-item-btn');
            const deleteBtn = row.querySelector('.delete-item-btn');

            row.querySelectorAll('td[contenteditable="true"]').forEach(cell => {
                cell.addEventListener('input', () => {
                    saveBtn.style.display = 'inline-block'; // Mostrar botón Guardar
                    row.classList.add('row-edited');
                });
            });

            saveBtn.addEventListener('click', async () => {
                const newItemData = {};
                row.querySelectorAll('td[data-key]').forEach(cell => {
                    newItemData[cell.dataset.key] = cell.textContent.trim();
                });

                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                
                try {
                    const response = await fetch(`${API_URL}update_staging_item.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            staging_id: stagingId,
                            item_data: newItemData
                        })
                    });
                    const result = await response.json();
                    
                    if (!result.success) {
                        throw new Error(result.message);
                    }
                    
                    saveBtn.style.display = 'none';
                    row.classList.remove('row-edited');
                    row.classList.add('row-saved');
                    setTimeout(() => row.classList.remove('row-saved'), 2000);

                } catch (error) {
                    console.error('Error guardando ítem:', error);
                    alert(`Error: ${error.message}`);
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = '<i class="fas fa-save"></i>';
                }
            });

            // --- INICIO MODIFICACIÓN: Lógica del botón Eliminar ---
            deleteBtn.addEventListener('click', () => {
                const itemName = row.querySelector('td[data-key="nombre"]').textContent || 'este ítem';
                if (confirm(`¿Seguro que querés eliminar "${itemName}" de este lote? Esta acción no se puede deshacer.`)) {
                    deleteStagingItem(stagingId, row);
                }
            });
            // --- FIN MODIFICACIÓN ---
        });
    }

    // --- INICIO MODIFICACIÓN: Nueva función para eliminar un ítem del staging ---
    async function deleteStagingItem(stagingId, rowElement) {
        const deleteBtn = rowElement.querySelector('.delete-item-btn');
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            const response = await fetch(`${API_URL}delete_staging_item.php`, { // Se asume un nuevo endpoint
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staging_id: stagingId })
            });
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message);
            }

            // Eliminar la fila de la tabla visualmente
            rowElement.style.transition = 'opacity 0.3s ease';
            rowElement.style.opacity = '0';
            setTimeout(() => {
                rowElement.remove();
                // Opcional: Recargar si la tabla queda vacía
                if (stagingItemsBody.querySelectorAll('tr').length === 0) {
                    loadBatchDetails(currentBatchId);
                }
            }, 300);

        } catch (error) {
            console.error('Error eliminando ítem:', error);
            alert(`Error: ${error.message}`);
            deleteBtn.disabled = false;
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        }
    }
    // --- FIN MODIFICACIÓN ---

    // 6. Aprobar el lote completo
    async function approveBatch() {
        if (!currentBatchId) return;
        if (!confirm(`¿Está seguro de que desea aprobar e importar TODOS los ítems de este lote (${currentBatchId})? Esta acción es irreversible.`)) return;

        approveBatchBtn.disabled = true;
        approveBatchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

        try {
            const response = await fetch(`${API_URL}approve_import_batch.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batch_id: currentBatchId })
            });
            const result = await response.json();
            
            if (!result.success) throw new Error(result.message);

            alert(`¡Éxito! ${result.message}`);
            loadBatches(); // Volver a la lista de lotes

        } catch (error) {
            console.error('Error aprobando lote:', error);
            alert(`Error: ${error.message}`);
        } finally {
            approveBatchBtn.disabled = false;
            approveBatchBtn.innerHTML = '<i class="fas fa-check"></i> Aprobar e Importar Lote';
        }
    }

    // 7. Eliminar/Rechazar el lote completo
    async function deleteBatch() {
        if (!currentBatchId) return;
        if (!confirm(`¿Está seguro de que desea RECHAZAR y ELIMINAR este lote (${currentBatchId})? Todos los ítems subidos se perderán.`)) return;

        deleteBatchBtn.disabled = true;
        deleteBatchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Eliminando...';

        try {
            const response = await fetch(`${API_URL}delete_import_batch.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batch_id: currentBatchId })
            });
            const result = await response.json();
            
            if (!result.success) throw new Error(result.message);

            alert(`Éxito: ${result.message}`);
            loadBatches(); // Volver a la lista de lotes

        } catch (error) {
            console.error('Error eliminando lote:', error);
            alert(`Error: ${error.message}`);
        } finally {
            deleteBatchBtn.disabled = false;
            deleteBatchBtn.innerHTML = '<i class="fas fa-trash"></i> Rechazar y Eliminar Lote';
        }
    }

    // --- UTILIDADES Y EVENTOS ---
    function showView(viewName) {
        if (viewName === 'list') {
            batchesListContainer.style.display = 'block';
            batchDetailContainer.style.display = 'none';
        } else {
            batchesListContainer.style.display = 'none';
            batchDetailContainer.style.display = 'block';
        }
    }

    backToBatchesBtn.addEventListener('click', loadBatches);
    backToBatchesBtnUser.addEventListener('click', loadBatches);
    approveBatchBtn.addEventListener('click', approveBatch);
    deleteBatchBtn.addEventListener('click', deleteBatch);

    loadBatches();
});