import { orgStructure } from './org-structure.js';
import { enableDragToScroll } from './inventory-functions.js';

const API_URL = 'php/';
const ITEMS_PER_PAGE = 15;

// --- FUNCIONES UTILITARIAS ---
function normalizeText(text) {
    if (!text) return '';
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getAllInventoryNodes(structure) {
    let nodes = [];
    function traverse(arr, path = []) {
        arr.forEach(item => {
            const currentPath = [...path, item.name];
            nodes.push({ id: item.id, name: currentPath.join(' > ') });
            if (item.children) {
                traverse(item.children, currentPath);
            }
        });
    }
    traverse(structure);
    return nodes;
}

const nodesMap = (function() {
    const map = new Map();
    function traverse(nodes) {
        nodes.forEach(node => {
            map.set(node.id, node.name);
            if (node.children && node.children.length > 0) {
                traverse(node.children);
            }
        });
    }
    traverse(orgStructure);
    return map;
})();


// --- LÓGICA PRINCIPAL AL CARGAR LA PÁGINA ---
document.addEventListener('DOMContentLoaded', async () => {
    const modal = document.getElementById('modal-hacienda-item');
    const openModalBtn = document.getElementById('add-hacienda-item-btn');
    const form = document.getElementById('form-hacienda-item');
    
    if (modal && openModalBtn && form) {
        const closeModal = () => modal.style.display = 'none';
        
        openModalBtn.addEventListener('click', () => modal.style.display = 'flex');
        modal.querySelector('.close-modal').addEventListener('click', closeModal);
        modal.querySelector('#cancel-hacienda-btn').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

        await loadSelectOptions();
        setupAreaSearch();
        setupImagePreview();
        form.addEventListener('submit', handleFormSubmit);
    }
    
    loadHaciendaInventory();
});

// --- FUNCIONES DEL FORMULARIO ---
async function loadSelectOptions() {
    try {
        const responseCat = await fetch(`${API_URL}get_categories.php`);
        const resultCat = await responseCat.json();
        if (resultCat.success) {
            const categorySelect = document.getElementById('form-category');
            if(categorySelect) {
                categorySelect.innerHTML = resultCat.data.map(cat => `<option value="${cat}">${cat}</option>`).join('');
            }
        }
    } catch (error) {
        console.error("Error al cargar categorías:", error);
    }

    const statusOptions = [
      { value: 'A', label: 'Apto' },
      { value: 'N', label: 'No Apto' },
      { value: 'R', label: 'No Apto Recuperable' },
    ];
    const statusSelect = document.getElementById('form-status');
    if(statusSelect) {
        statusSelect.innerHTML = statusOptions.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('');
    }
}

function setupAreaSearch() {
    const searchInput = document.getElementById('area-search-input-hacienda');
    const searchResults = document.getElementById('area-search-results-hacienda');
    const hiddenAreaIdInput = document.getElementById('node_id_hacienda');
    const allAreas = getAllInventoryNodes(orgStructure);

    searchInput.addEventListener('input', () => {
        const query = normalizeText(searchInput.value);
        searchResults.innerHTML = '';
        hiddenAreaIdInput.value = '';
        if (query.length < 2) {
            searchResults.style.display = 'none';
            return;
        }
        const filteredAreas = allAreas.filter(area => normalizeText(area.name).includes(query));
        if (filteredAreas.length > 0) {
            filteredAreas.forEach(area => {
                const item = document.createElement('div');
                item.className = 'result-item';
                item.textContent = area.name;
                item.addEventListener('click', () => {
                    searchInput.value = area.name;
                    hiddenAreaIdInput.value = area.id;
                    searchResults.style.display = 'none';
                });
                searchResults.appendChild(item);
            });
            searchResults.style.display = 'block';
        } else {
            searchResults.style.display = 'none';
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            if(searchResults) searchResults.style.display = 'none';
        }
    });
}

function setupImagePreview() {
    const imageInput = document.getElementById('form-itemImages');
    const previewContainer = document.getElementById('image-preview-container');

    imageInput.addEventListener('change', () => {
        previewContainer.innerHTML = '';
        const files = imageInput.files;
        if (files) {
            Array.from(files).forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const imgElement = document.createElement('img');
                    imgElement.src = e.target.result;
                    imgElement.style.maxWidth = '100px';
                    imgElement.style.maxHeight = '100px';
                    imgElement.style.borderRadius = 'var(--radio-borde)';
                    previewContainer.appendChild(imgElement);
                }
                reader.readAsDataURL(file);
            });
        }
    });
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const submitButton = form.querySelector('button[type="submit"]');
    
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        const response = await fetch(`${API_URL}add_item_hacienda.php`, {
            method: 'POST',
            body: formData,
        });
        const result = await response.json();
        
        alert(result.message || 'Operación completada.');
        
        if (result.success) {
            form.reset();
            document.getElementById('image-preview-container').innerHTML = '';
            document.getElementById('modal-hacienda-item').style.display = 'none';
            loadHaciendaInventory();
        }

    } catch (error) {
        console.error('Error al enviar el formulario:', error);
        alert('Error de conexión. No se pudo guardar el ítem.');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Guardar Ítem';
    }
}


// --- FUNCIONES PARA LA TABLA DE INVENTARIO ---

async function loadHaciendaInventory(page = 1) {
    const container = document.getElementById('hacienda-table-container');
    container.innerHTML = '<p>Cargando inventario...</p>';

    try {
        const response = await fetch(`${API_URL}get_hacienda_inventory.php?page=${page}`);
        const result = await response.json();

        if (result.success) {
            renderHaciendaTable(result.data, result.total, page);
        } else {
            container.innerHTML = `<p>Error al cargar el inventario: ${result.message}</p>`;
        }
    } catch (error) {
        console.error('Error de conexión:', error);
        container.innerHTML = '<p>Error de conexión al cargar el inventario.</p>';
    }
}

function renderHaciendaTable(items, totalItems, currentPage) {
    const container = document.getElementById('hacienda-table-container');
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    if (items.length === 0) {
        container.innerHTML = '<p>No hay ítems con datos de Hacienda en el inventario.</p>';
        return;
    }

    // --- INICIO DE LA CORRECCIÓN ---
    let tableHTML = `
        <div class="table-responsive">
            <table class="inventory-table">
                <thead>
                    <tr>
                        <th>CÓDIGO ITEM</th>
                        <th>NOMBRE</th>
                        <th>VALOR</th>
                        <th>GARANTÍA</th>
                        <th>PROVEEDOR</th>
                        <th>CUIT</th>
                        <th>TIPO COMPRA</th>
                        <th>CÓD. COMPROBANTE</th>
                        <th>TIPO COMPROBANTE</th>
                        <th>N° COMPROBANTE</th>
                        <th>EXPEDIENTE</th>
                        <th>N° EXPEDIENTE</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr>
                            <td>${item.codigo_item || ''}</td>
                            <td>${item.name || ''}</td>
                            <td>${item.valor ? `$${parseFloat(item.valor).toLocaleString('es-AR')}` : ''}</td>
                            <td>${item.garantia || ''}</td>
                            <td>${item.proveedor || ''}</td>
                            <td>${item.cuit || ''}</td>
                            <td>${item.tipo_compra || ''}</td>
                            <td>${item.codigo_comprobante || ''}</td>
                            <td>${item.tipo_comprobante || ''}</td>
                            <td>${item.numero_comprobante || ''}</td>
                            <td>${item.expediente || ''}</td>
                            <td>${item.numero_expediente || ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    // --- FIN DE LA CORRECCIÓN ---

    if (totalPages > 1) {
        tableHTML += `
            <div class="pagination-controls" style="padding-top: 15px;">
                <button id="prev-page-btn" class="button" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button>
                <span>Página ${currentPage} de ${totalPages}</span>
                <button id="next-page-btn" class="button" ${currentPage >= totalPages ? 'disabled' : ''}>Siguiente</button>
            </div>
        `;
    }

    container.innerHTML = tableHTML;

    const scrollableTable = container.querySelector('.table-responsive');
    enableDragToScroll(scrollableTable);

    if (totalPages > 1) {
        document.getElementById('prev-page-btn').addEventListener('click', () => {
            if (currentPage > 1) loadHaciendaInventory(currentPage - 1);
        });
        document.getElementById('next-page-btn').addEventListener('click', () => {
            if (currentPage < totalPages) loadHaciendaInventory(currentPage + 1);
        });
    }
}