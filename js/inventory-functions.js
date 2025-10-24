import { orgStructure } from './org-structure.js';

const API_URL = 'php/';
const ITEMS_PER_PAGE = 900;

let dynamicCategories = []; 
let areCategoriesLoaded = false;
let currentTablePage = 1;
let totalTableItems = 0;
let currentGalleryPage = 1;
let totalGalleryItems = 0;
let currentFilters = {};
let currentSortBy = 'name_asc';

/**
 * Habilita la funcionalidad de arrastrar para hacer scroll horizontal en un elemento.
 * @param {HTMLElement} element El elemento contenedor que tendrá el scroll.
 */
// --- CORRECCIÓN ---
// Se añade la palabra 'export' para que la función pueda ser usada por otros archivos.
export function enableDragToScroll(element) {
    if (!element) return;
    let isDown = false;
    let startX;
    let scrollLeft;

    element.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || e.target.closest('button')) {
            return;
        }
        isDown = true;
        element.classList.add('active-drag');
        startX = e.pageX - element.offsetLeft;
        scrollLeft = element.scrollLeft;
        e.preventDefault();
    });

    element.addEventListener('mouseleave', () => {
        isDown = false;
        element.classList.remove('active-drag');
    });

    element.addEventListener('mouseup', () => {
        isDown = false;
        element.classList.remove('active-drag');
    });

    element.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - element.offsetLeft;
        const walk = (x - startX) * 2;
        element.scrollLeft = scrollLeft - walk;
    });
}

async function loadCategories() {
    if (areCategoriesLoaded) return;
    try {
        const response = await fetch(`${API_URL}get_categories.php`);
        const result = await response.json();
        if (result.success) {
            dynamicCategories = result.data;
            areCategoriesLoaded = true;
        }
    } catch (error) {
        console.error("Error al cargar las categorías:", error);
    }
}

// --- INICIO DE LA MODIFICACIÓN ---
// Se añade la opción 'De Baja' a la lista de estados.
export const statusOptions = [
  { value: 'A', label: 'Apto' },
  { value: 'N', label: 'No Apto' },
  { value: 'R', label: 'No Apto Recuperable' },
  { value: 'D', label: 'De Baja' }
];
// --- FIN DE LA MODIFICACIÓN ---


function getShortNameNodesMap() {
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
}
const nodesMap = getShortNameNodesMap();

function getAllInventoryNodes(structure) {
    let nodes = [];
    function traverse(arr, path = []) {
        arr.forEach(item => {
            const currentPath = [...path, item.name];
            if (['departamento', 'coordinacion', 'area', 'direccion', 'subdireccion', 'subsecretaria', 'secretaria', 'celda', 'intendencia', 'viceintendencia'].includes(item.type)) {
                nodes.push({ id: item.id, name: currentPath.join(' > ') });
            }
            if (item.children) {
                traverse(item.children, currentPath);
            }
        });
    }
    traverse(structure);
    return nodes;
}

function getFullPathNodesMap() {
    const map = new Map();
    function traverse(nodes, path = []) {
        nodes.forEach(node => {
            const currentPath = [...path, node.name];
            map.set(node.id, currentPath.join(' > '));
            if (node.children && node.children.length > 0) {
                traverse(node.children, currentPath);
            }
        });
    }
    traverse(orgStructure);
    return map;
}

function normalizeText(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

let currentFormSubmitHandler = null;

export async function showItemForm(node, item = null) {
    const modal = document.getElementById('modal-agregar-item');
    const form = document.getElementById('form-agregar-item');
    if (!modal || !form) return;

    await loadCategories();

    const isEditing = item !== null;
    form.reset();
    
    const areaDisplayRow = document.getElementById('area-display-row');
    if (isEditing && item && areaDisplayRow) {
        const areaDisplayText = document.getElementById('area-display-text');
        const areaName = nodesMap.get(item.node_id) || 'Área no especificada';
        areaDisplayText.value = areaName;
        areaDisplayRow.style.display = 'block';
    } else if (areaDisplayRow) {
        areaDisplayRow.style.display = 'none';
    }

    const areaSelectionRow = document.getElementById('area-selection-row');
    const nodeIdInput = form.querySelector('[name="node_id"]');
    const areaSearchInput = document.getElementById('area-search-input-modal');

    let newAreaSearchInput = areaSearchInput.cloneNode(true);
    areaSearchInput.parentNode.replaceChild(newAreaSearchInput, areaSearchInput);

    const needsAreaSelection = !isEditing && (!node || !node.id);

    if (needsAreaSelection && newAreaSearchInput && areaSelectionRow) {
        areaSelectionRow.style.display = 'block';
        newAreaSearchInput.required = true;
        nodeIdInput.value = '';

        const searchResults = document.getElementById('area-search-results-modal');
        const allAreas = getAllInventoryNodes(orgStructure);

        const searchHandler = () => {
            const query = normalizeText(newAreaSearchInput.value);
            if (!searchResults) return;
            searchResults.innerHTML = '';
            nodeIdInput.value = '';
            if (query.length < 2) {
                searchResults.style.display = 'none';
                return;
            }
            const filteredAreas = allAreas.filter(area => normalizeText(area.name).includes(query));
            if (filteredAreas.length > 0) {
                filteredAreas.forEach(area => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'result-item';
                    itemDiv.textContent = area.name;
                    itemDiv.addEventListener('click', () => {
                        newAreaSearchInput.value = area.name;
                        nodeIdInput.value = area.id;
                        searchResults.style.display = 'none';
                    });
                    searchResults.appendChild(itemDiv);
                });
                searchResults.style.display = 'block';
            } else {
                searchResults.style.display = 'none';
            }
        };
        newAreaSearchInput.addEventListener('input', searchHandler);

        document.addEventListener('click', function hideResults(e) {
            if (!e.target.closest('.search-container')) {
                if (searchResults) searchResults.style.display = 'none';
            }
        }, { once: true });
    } else {
        if (areaSelectionRow) areaSelectionRow.style.display = 'none';
        if (newAreaSearchInput) newAreaSearchInput.required = false;
        nodeIdInput.value = isEditing ? (item.node_id || '') : (node ? node.id : '');
    }

    modal.querySelector('h2').textContent = isEditing ? `Editar Ítem: ${item ? item.name : ''}` : 'Agregar Nuevo Ítem';
    form.querySelector('[name="id"]').value = isEditing && item ? item.id : '';
    
    const codigoDisplayRow = form.querySelector('#codigo-display-row');
    if (codigoDisplayRow) {
        if (isEditing && item) {
            const codigoDisplayText = document.getElementById('codigo-display-text');
            codigoDisplayText.textContent = item.codigo_item || 'N/A';
            codigoDisplayRow.style.display = 'flex';
        } else {
            codigoDisplayRow.style.display = 'none';
        }
    }
    
    form.querySelector('[name="existingImagePath"]').value = isEditing && item && item.imagePath ? item.imagePath : '';
    form.querySelector('[name="name"]').value = isEditing && item ? item.name : '';
    form.querySelector('[name="quantity"]').value = isEditing && item ? item.quantity : 1;
    form.querySelector('[name="description"]').value = isEditing && item ? item.description : '';
    form.querySelector('[name="incorporacion"]').value = isEditing && item ? item.incorporacion : '';
    form.querySelector('[name="encargado"]').value = isEditing && item ? (item.encargado || 'No Asignado') : 'No Asignado';

    const categorySelect = form.querySelector('[name="category"]');
    categorySelect.innerHTML = dynamicCategories.map(cat => `<option value="${cat}" ${isEditing && item && item.category === cat ? 'selected' : ''}>${cat}</option>`).join('');

    const statusSelect = form.querySelector('[name="status"]');
    statusSelect.innerHTML = statusOptions.map(option => `<option value="${option.value}" ${isEditing && item && item.status === option.value ? 'selected' : ''}>${option.label}</option>`).join('');

    const imagePreview = document.getElementById('imagePreview');
    const imageInput = document.getElementById('form-itemImage');
    if(imageInput && imagePreview){
        imageInput.onchange = () => {
            if (imageInput.files && imageInput.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    imagePreview.src = e.target.result;
                    imagePreview.style.display = 'block';
                };
                reader.readAsDataURL(imageInput.files[0]);
            }
        };

        if (isEditing && item && item.imagePath) {
            imagePreview.src = item.imagePath;
            imagePreview.style.display = 'block';
        } else {
            imagePreview.style.display = 'none';
            imagePreview.src = '#';
        }
    }

    if (currentFormSubmitHandler) {
        form.removeEventListener('submit', currentFormSubmitHandler);
    }

    currentFormSubmitHandler = async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const endpoint = isEditing ? 'update_item.php' : 'add_item.php';

        try {
            const response = await fetch(API_URL + endpoint, { method: 'POST', body: formData });
            const result = await response.json();
            alert(result.message || 'Operación completada.');
            if (result.success) {
                closeItemForm();
                areCategoriesLoaded = false;
                displayInventory(node, sessionStorage.getItem('isAdmin') === 'true', currentTablePage, currentFilters);
            }
        } catch (error) {
            console.error('Error al guardar:', error);
            alert('Error de conexión al guardar el ítem.');
        }
    };
    form.addEventListener('submit', currentFormSubmitHandler);
    modal.style.display = 'flex';
}

export function closeItemForm() {
    const modal = document.getElementById('modal-agregar-item');
    if (modal) modal.style.display = 'none';
}

export function setupModalClosers() {
    const modal = document.getElementById('modal-agregar-item');
    if (modal) {
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) closeBtn.addEventListener('click', closeItemForm);
        const cancelBtn = modal.querySelector('#cancel-item-btn');
        if (cancelBtn) cancelBtn.addEventListener('click', closeItemForm);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeItemForm(); });
    }
}

function showTransferForm(node, items) {
    if (items.length === 0) {
        alert('No hay ítems en esta área para traspasar.');
        return;
    }
    if (document.getElementById('transfer-modal')) return;

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.id = 'transfer-modal';

    const fullPathMap = getFullPathNodesMap();
    const allNodes = Array.from(fullPathMap.entries())
        .filter(([id]) => id !== node.id)
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));

    modalOverlay.innerHTML = `
        <div class="modal-content" style="width: 500px; cursor: default;">
            <button class="close-modal" id="cancel-transfer-btn-x">&times;</button>
            <h3>Traspaso de Ítem</h3>
            <form id="transfer-form">
                <div class="form-row"><label>Área Origen:</label><input type="text" value="${node.name}" disabled></div>
                <div class="form-row"><label for="item-to-transfer">Ítem a Traspasar:</label><select id="item-to-transfer" name="itemId" required>
                    <option value="" disabled selected>Seleccione un ítem...</option>
                    ${items.map(item => `<option value="${item.id}">${item.name} (Código: ${item.codigo_item})</option>`).join('')}
                </select></div>
                <div class="form-row"><label for="destination-area">Área de Destino:</label><select id="destination-area" name="destinationNodeId" required>
                    <option value="" disabled selected>Seleccione un destino...</option>
                    ${allNodes.map(n => `<option value="${n.id}">${n.name}</option>`).join('')}
                </select></div>
                <div class="form-row">
                    <label for="new-encargado">Nuevo Encargado:</label>
                    <input type="text" id="new-encargado" name="new_encargado" placeholder="Nombre del nuevo responsable" value="No Asignado" required>
                </div>
                <div class="form-row"><label for="transfer-reason">Motivo del Traspaso:</label><textarea id="transfer-reason" name="reason" rows="3" placeholder="Especifique el motivo del traspaso..." required></textarea></div>
                <div class="form-row" style="flex-direction: row; justify-content: flex-end; gap: 10px;">
                    <button type="button" id="cancel-transfer-btn" class="button">Cancelar</button>
                    <button type="submit" class="button">Solicitar Traspaso</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modalOverlay);

    const closeModal = () => modalOverlay.remove();
    document.getElementById('cancel-transfer-btn').onclick = closeModal;
    document.getElementById('cancel-transfer-btn-x').onclick = closeModal;
    modalOverlay.onclick = (e) => { if (e.target === modalOverlay) closeModal(); };

    document.getElementById('transfer-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        if (!confirm('¿Está seguro de que desea solicitar el traspaso de este ítem?')) return;

        try {
            const response = await fetch(`${API_URL}transfer_item.php`, { method: 'POST', body: formData });
            const result = await response.json();
            alert(result.message || 'Operación completada.');
            if (result.success) {
                closeModal();
                displayInventory(node, sessionStorage.getItem('isAdmin') === 'true', currentTablePage, currentFilters);
            }
        } catch (error) {
            console.error('Error de conexión:', error);
            alert('Error de conexión al realizar el traspaso.');
        }
    });
}

// ** INICIO DE CÓDIGO ACTUALIZADO PARA LA EXPORTACIÓN **

/* Reemplazar la función `exportToXLSX` con esta versión actualizada */
function exportToXLSX(node, items, isFullExport = false, titleSuffix = '') {
    if (items.length === 0) {
        alert('No hay datos para exportar.');
        return;
    }
    const dataToExport = items.map(item => ({
        'codigo_item': item.codigo_item || '',
        nombre: item.name,
        cantidad: item.quantity,
        categoria: item.category,
        descripcion: item.description || '',
        incorporacion: item.incorporacion,
        estado: statusOptions.find(s => s.value === item.status)?.label || item.status,
        area: nodesMap.get(item.node_id) || 'N/A',
        encargado: item.encargado || 'No Asignado'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");
    
    const pageOrFull = isFullExport ? 'completo' : `pag_${currentTablePage}`;
    const filename = `inventario_${node.id || 'global'}_${pageOrFull}${titleSuffix}.xlsx`;

    XLSX.writeFile(workbook, filename);
}

/* Agregar la nueva función `exportAllToXLSX` */
async function exportAllToXLSX(node, filters) {
    const params = new URLSearchParams({
        node_id: node.id || '',
        ...filters,
        limit: 99999, // Un límite muy alto para obtener todos los items
        page: 1, // Siempre la primera página para la exportación completa
        sort_by: currentSortBy // Mantener el orden de la vista
    });

    try {
        const response = await fetch(`${API_URL}get_inventory.php?${params.toString()}`);
        const result = await response.json();
        if (result.success) {
            exportToXLSX(node, result.data, true);
        } else {
            alert('Error al obtener los datos completos para la exportación.');
            console.error('Error al obtener todos los datos:', result.message);
        }
    } catch (error) {
        alert('Error de conexión al obtener los datos para la exportación.');
        console.error('Error de red:', error);
    }
}

export async function displayInventory(node, isAdmin = false, page = 1, filters = {}, sortBy = 'name_asc') {
    currentFilters = filters;
    currentSortBy = sortBy; // Guardar el estado de ordenación
    const tableView = document.getElementById('table-view');
    const galleryView = document.getElementById('gallery-view');

    if (tableView) tableView.innerHTML = '<p>Cargando inventario...</p>';
    if (galleryView) {
        const galleryContainer = galleryView.querySelector('#gallery-container');
        if (galleryContainer) galleryContainer.innerHTML = '<p>Cargando galería...</p>';
    }
    
    const params = new URLSearchParams({
        node_id: node.id || '',
        page: page,
        limit: ITEMS_PER_PAGE,
        sort_by: sortBy, // Enviar el parámetro de ordenación
        ...filters
    });

    try {
        const response = await fetch(`${API_URL}get_inventory.php?${params.toString()}`);
        const result = await response.json();

        if (result.success) {
            window.currentInventoryContext = { node, items: result.data, isAdmin };
            await setupInventoryUI(node, result.data, isAdmin);
            
            currentTablePage = page;
            totalTableItems = result.total;
            renderTable(node, result.data, isAdmin);

            currentGalleryPage = page;
            totalGalleryItems = result.total;
            renderGallery(node, result.data, isAdmin);
        } else {
            const errorMessage = `<p>Error al cargar el inventario: ${result.message}</p>`;
            if (tableView) tableView.innerHTML = errorMessage;
            if (galleryView) galleryView.querySelector('#gallery-container').innerHTML = errorMessage;
        }
    } catch (error) {
        console.error('Error al obtener el inventario:', error);
        if (tableView) tableView.innerHTML = '<p>Error de conexión al cargar el inventario.</p>';
        if (galleryView) galleryView.querySelector('#gallery-container').innerHTML = '<p>Error de conexión al cargar el inventario.</p>';
    }
}

async function setupInventoryUI(node, items, isAdmin) {
    const controlsContainer = document.getElementById('global-controls-container');
    if (!controlsContainer) return;

    await loadCategories();
    window.currentInventoryContext = { node, items, isAdmin };

    controlsContainer.innerHTML = `
        <div class="inventory-controls">
            <button id="add-item-btn"><i class="fas fa-plus"></i> Agregar Item</button>
            <button id="transfer-item-btn"><i class="fas fa-random"></i> Traspasar Item</button>
            <button id="toggle-filters-btn"><i class="fas fa-filter"></i> Filtros</button>
            
            <div class="sort-by-container" style="display: flex; align-items: center; gap: 8px;">
                <label for="sort-by-select" style="font-weight: 600; font-size: 0.9em;">Ordenar por:</label>
                <select id="sort-by-select">
                    <option value="name_asc">Nombre (A-Z)</option>
                    <option value="name_desc">Nombre (Z-A)</option>
                    <option value="date_desc">Más Recientes</option>
                    <option value="date_asc">Más Antiguos</option>
                </select>
            </div>
            </div>
        <div class="filter-controls-container">
            <div class="filter-row"><label for="filter-codigo">Buscar por Código:</label><input type="text" id="filter-codigo" placeholder="Código del ítem"></div>
            <div class="filter-row"><label for="filter-name">Buscar por Nombre:</label><input type="text" id="filter-name" placeholder="Nombre del ítem"></div>
            <div class="filter-row"><label for="filter-category">Categoría:</label><select id="filter-category"><option value="">Todas</option>${dynamicCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}</select></div>
            <div class="filter-row"><label for="filter-status">Estado:</label><select id="filter-status"><option value="">Todos</option>${statusOptions.map(option => `<option value="${option.value}">${option.label}</option>`).join('')}</select></div>
            <div class="filter-row"><label for="filter-date-from">Incorporado Desde:</label><input type="date" id="filter-date-from"></div>
            <div class="filter-row"><label for="filter-date-to">Incorporado Hasta:</label><input type="date" id="filter-date-to"></div>
            <div class="filter-actions">
                <button id="apply-filters-btn" class="button"><i class="fas fa-check"></i> Aplicar</button>
                <button id="reset-filters-btn" class="button reset-filters-btn"><i class="fas fa-undo"></i> Limpiar</button>
            </div>
        </div>
    `;

    document.getElementById("add-item-btn").addEventListener('click', () => showItemForm(node, null));
    document.getElementById("transfer-item-btn").addEventListener('click', () => {
        const ctx = window.currentInventoryContext || {};
        showTransferForm(node, ctx.items || []);
    });
    
    // Asignar el valor de ordenación actual al select
    const sortBySelect = document.getElementById('sort-by-select');
    sortBySelect.value = currentSortBy;

    // Listener para el cambio de ordenación
    sortBySelect.addEventListener('change', () => {
        const sortByValue = sortBySelect.value;
        const currentFilters = {
            filter_codigo: document.getElementById('filter-codigo').value.trim(),
            filter_name: document.getElementById('filter-name').value.trim(),
            filter_category: document.getElementById('filter-category').value,
            filter_status: document.getElementById('filter-status').value,
            filter_date_from: document.getElementById('filter-date-from').value,
            filter_date_to: document.getElementById('filter-date-to').value,
        };
        displayInventory(node, isAdmin, 1, currentFilters, sortByValue);
    });

    setupHeaderActions();

    const filterControls = controlsContainer.querySelector('.filter-controls-container');
    document.getElementById('toggle-filters-btn').addEventListener('click', () => {
        filterControls.classList.toggle('visible');
        const button = document.getElementById('toggle-filters-btn');
        button.innerHTML = filterControls.classList.contains('visible')
            ? '<i class="fas fa-eye-slash"></i> Ocultar Filtros'
            : '<i class="fas fa-filter"></i> Filtros';
    });
    
    document.getElementById('apply-filters-btn').addEventListener('click', () => {
        const filters = {
            filter_codigo: document.getElementById('filter-codigo').value.trim(),
            filter_name: document.getElementById('filter-name').value.trim(),
            filter_category: document.getElementById('filter-category').value,
            filter_status: document.getElementById('filter-status').value,
            filter_date_from: document.getElementById('filter-date-from').value,
            filter_date_to: document.getElementById('filter-date-to').value,
        };
        const sortByValue = document.getElementById('sort-by-select').value;
        displayInventory(node, isAdmin, 1, filters, sortByValue);
    });

    document.getElementById('reset-filters-btn').addEventListener('click', () => {
        filterControls.querySelectorAll('input, select').forEach(el => el.value = '');
        const sortByValue = document.getElementById('sort-by-select').value;
        displayInventory(node, isAdmin, 1, {}, sortByValue);
    });
}

function setupHeaderActions() {
    if (window.headerActionsInitialized) return;
    window.headerActionsInitialized = true;

    const headerBtn = document.getElementById('header-actions-btn');
    const headerMenu = document.getElementById('header-actions-menu');
    const headerWrapper = headerBtn ? headerBtn.closest('.header-actions') : null;
    const importBtn = document.getElementById('import-btn-header');
    const fileInput = document.getElementById('xlsx-file-input-header');
    const exportXlsxBtn = document.getElementById('export-xlsx-header');
    const exportPdfBtn = document.getElementById('export-pdf-header'); 

    if (!headerBtn || !headerWrapper || !headerMenu) {
        window.headerActionsInitialized = false;
        return;
    }

    const closeMenu = () => {
        headerWrapper.classList.remove('open');
        headerBtn.setAttribute('aria-expanded', 'false');
        headerMenu.style.display = 'none';
    };

    headerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = headerWrapper.classList.toggle('open');
        headerBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        headerMenu.style.display = isOpen ? 'flex' : 'none';
    });

    document.addEventListener('click', (e) => {
        if (!headerWrapper.contains(e.target)) {
            closeMenu();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMenu();
        }
    });

    if (importBtn && fileInput) {
        importBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            await handleXlsxImportFile(file);
            fileInput.value = '';
            closeMenu();
        });
    }

    if (exportXlsxBtn) {
        exportXlsxBtn.addEventListener('click', () => {
            const ctx = window.currentInventoryContext || {};
            const hasFilters = Object.values(currentFilters).some(value => value && value.length > 0);

            if (!ctx.items || ctx.items.length === 0) {
                alert('No hay datos para exportar en la vista actual.');
            } else {
                if (hasFilters) {
                    exportToXLSX(ctx.node || { id: 'global' }, ctx.items, false, '_filtrado');
                } else {
                    exportAllToXLSX(ctx.node || { id: 'global' }, currentFilters);
                }
            }
            closeMenu();
        });
    }

    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', () => {
            const ctx = window.currentInventoryContext || {};
            if (!ctx.items || ctx.items.length === 0) {
                alert('No hay datos para generar el informe en la vista actual.');
            } else {
                exportToPrintableReport(ctx.node || { id: 'global', name: 'Global' }, ctx.items);
            }
            closeMenu();
        });
    }
}

async function handleXlsxImportFile(file) {
    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(data), { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        if (json.length === 0) {
            alert('El archivo XLSX está vacío.');
            return;
        }

        const mappedJson = json
            .filter(row => Object.keys(row).length > 0)
            .map(row => {
                const newRow = {};
                for (const key in row) {
                    const lowerKey = key.toLowerCase().trim().replace(/\s+/g, '');
                    if (lowerKey.startsWith('codigo')) newRow.codigo_item = row[key];
                    else if (lowerKey.startsWith('nombre')) newRow.nombre = row[key];
                    else if (lowerKey.startsWith('cantidad')) newRow.cantidad = row[key];
                    else if (lowerKey.startsWith('categor')) newRow.categoria = row[key];
                    else if (lowerKey.startsWith('descripci')) newRow.descripcion = row[key];
                    else if (lowerKey.startsWith('incorporaci')) {
                        if (row[key]) {
                            const date = new Date(row[key]);
                            if (!isNaN(date.getTime())) {
                                const userTimezoneOffset = date.getTimezoneOffset() * 60000;
                                const correctedDate = new Date(date.getTime() + userTimezoneOffset);
                                const year = correctedDate.getUTCFullYear();
                                const month = String(correctedDate.getUTCMonth() + 1).padStart(2, '0');
                                const day = String(correctedDate.getUTCDate()).padStart(2, '0');
                                newRow.incorporacion = `${year}-${month}-${day}`;
                            } else {
                                newRow.incorporacion = null;
                            }
                        } else {
                            newRow.incorporacion = null;
                        }
                    } else if (lowerKey.startsWith('imagen') || lowerKey.startsWith('image')) {
                        let img = row[key] ? String(row[key]).trim() : '';
                        if (img && !/^https?:\/\//i.test(img) && !img.startsWith('/')) {
                            img = `uploads/${img}`;
                        }
                        newRow.imagePath = img || null;
                    } 
                    else if (lowerKey.startsWith('estado') || lowerKey.startsWith('status')) {
                         newRow.estado = row[key];
                    }
                    else if (lowerKey.startsWith('area')) newRow.area = row[key];
                    else if (lowerKey.startsWith('encargado') || lowerKey.startsWith('responsable')) {
                         newRow.encargado = row[key];
                    }
                }
                return newRow;
            });

        const response = await fetch(`${API_URL}bulk_import.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mappedJson)
        });

        const result = await response.json();
        alert(result.message || 'Proceso de importación finalizado.');
        if (result.success) {
            const ctx = window.currentInventoryContext || {};
            areCategoriesLoaded = false;
            displayInventory(ctx.node || { id: '' }, ctx.isAdmin || false);
        }
    } catch (error) {
        console.error('Error durante la importación:', error);
        alert(`Error al importar los datos: ${error.message || error}`);
    }
}

function renderTable(node, items, isAdmin) {
    const tableContainer = document.getElementById('table-view');
    if (!tableContainer) return;

    if (totalTableItems === 0 && Object.keys(currentFilters).length === 0) {
        tableContainer.innerHTML = '<p>No hay ítems en esta área.</p>';
        return;
    }

    const totalPages = Math.ceil(totalTableItems / ITEMS_PER_PAGE);
    
    let tableHTML = `
        <div class="table-responsive">
            <table id="inventory-table" class="inventory-table">
                <thead><tr>
                    <th>Acciones</th>
                    <th>Codigo item</th>
                    <th>Nombre</th>
                    <th>Cantidad</th>
                    <th>Categoría</th>
                    <th>Descripción</th>
                    <th>Incorporación</th>
                    <th>Estado</th>
                    <th>Área</th>
                    <th>Encargado</th>
                </tr></thead>
                <tbody>
                    ${items.length === 0 ? `<tr><td colspan="10" style="text-align:center;">No se encontraron ítems.</td></tr>` :
                    items.map(item => `
                        <tr>
                            <td class="actions">
                                <button class="edit-btn" data-item-id="${item.id}"><i class="fas fa-edit"></i></button>
                                <button class="delete-btn" data-item-id="${item.id}" title="Dar de baja"><i class="fas fa-arrow-down"></i></button>
                            </td>
                            <td>${item.codigo_item || ''}</td>
                            <td>${item.name || ''}</td>
                            <td>${item.quantity || 0}</td>
                            <td>${item.category || ''}</td>
                            <td>${item.description || ''}</td>
                            <td>${item.incorporacion || 'N/A'}</td>
                            <td>${statusOptions.find(s => s.value === item.status)?.label || 'N/A'}</td>
                            <td>${nodesMap.get(item.node_id) || 'N/A'}</td>
                            <td>${item.encargado || 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    if (totalPages > 1) {
        tableHTML += `
            <div class="pagination-controls">
                <button id="prev-table-page" class="button" ${currentTablePage === 1 ? 'disabled' : ''}>Anterior</button>
                <span>Página ${currentTablePage} de ${totalPages}</span>
                <button id="next-table-page" class="button" ${currentTablePage >= totalPages ? 'disabled' : ''}>Siguiente</button>
            </div>
        `;
    }
    
    tableContainer.innerHTML = tableHTML;
    
    const scrollableTable = tableContainer.querySelector('.table-responsive');
    enableDragToScroll(scrollableTable);

    if (totalPages > 1) {
        document.getElementById('prev-table-page').onclick = () => {
            if (currentTablePage > 1) displayInventory(node, isAdmin, currentTablePage - 1, currentFilters, currentSortBy);
        };
        document.getElementById('next-table-page').onclick = () => {
            if (currentTablePage < totalPages) displayInventory(node, isAdmin, currentTablePage + 1, currentFilters, currentSortBy);
        };
    }

    tableContainer.querySelectorAll('.edit-btn').forEach(button => {
        button.onclick = () => {
            const itemToEdit = items.find(i => i.id == button.dataset.itemId);
            showItemForm(node, itemToEdit);
        };
    });

    tableContainer.querySelectorAll('.delete-btn').forEach(button => {
        button.onclick = async () => {
            const itemToDelete = items.find(i => i.id == button.dataset.itemId);
            if (itemToDelete && confirm(`¿Estás seguro de que deseas solicitar la BAJA del ítem "${itemToDelete.name}"?`)) {
                try {
                    const formData = new FormData();
                    formData.append('id', itemToDelete.id);
                    const response = await fetch(API_URL + 'delete_item.php', { method: 'POST', body: formData });
                    const result = await response.json();
                    alert(result.message || 'Operación completada.');
                    if (result.success) {
                        displayInventory(node, isAdmin, currentTablePage, currentFilters, currentSortBy);
                    }
                } catch (error) {
                    console.error('Error al dar de baja:', error);
                    alert('Error de conexión al procesar la solicitud.');
                }
            }
        };
    });
}

// --- INICIO DE LA SECCIÓN ACTUALIZADA (REDISIEÑO GALERÍA) ---
// Función auxiliar para obtener la primera imagen de un ítem
function getFirstImage(imagePath) {
    if (!imagePath) {
        return null; // No hay ruta de imagen
    }
    // Intentamos decodificar la ruta por si es un JSON
    try {
        const images = JSON.parse(imagePath);
        // Si es un array y tiene al menos una imagen, devolvemos la primera
        if (Array.isArray(images) && images.length > 0) {
            return images[0];
        }
    } catch (e) {
        // Si no es un JSON válido, es una ruta de imagen única
        return imagePath;
    }
    return null; // Devolvemos null si es un JSON vacío o inválido
}

function renderGallery(node, items, isAdmin) {
    const galleryView = document.getElementById('gallery-view');
    const galleryContainer = galleryView.querySelector('#gallery-container');
    if (!galleryContainer || !galleryView) return;

    // 1. Agrupar los ítems por área
    const itemsByArea = new Map();
    items.forEach(item => {
        const firstImage = getFirstImage(item.imagePath);
        if (firstImage) { // Solo agregar ítems que tengan al menos una imagen
            const areaName = nodesMap.get(item.node_id) || 'Sin Área / A Clasificar';
            if (!itemsByArea.has(areaName)) {
                itemsByArea.set(areaName, []);
            }
            itemsByArea.get(areaName).push(item);
        }
    });

    // 2. Generar el HTML para cada grupo
    let galleryHtml = '';
    itemsByArea.forEach((areaItems, areaName) => {
        // Omitir el área 'A Clasificar' si estamos viendo un área específica
        if (node.id && areaName === 'Sin Área / A Clasificar') {
             return;
        }

        galleryHtml += `<div class="gallery-area-group">`;
        galleryHtml += `<h2 class="gallery-area-header">${areaName}</h2>`;
        galleryHtml += `<div class="gallery-image-grid">`;
        
        galleryHtml += areaItems.map(item => {
            const firstImage = getFirstImage(item.imagePath);
            // Mantenemos todos los data-attributes para que el modal (lightbox) siga funcionando
            return `
                <div class="gallery-card" 
                     data-id="${item.id}" 
                     data-codigo="${item.codigo_item || ''}" 
                     data-name="${item.name}" 
                     data-description="${item.description || 'Sin descripción.'}" 
                     data-category="${item.category || ''}"
                     data-quantity="${item.quantity || 0}" 
                     data-status="${statusOptions.find(s => s.value === item.status)?.label || 'N/A'}"
                     data-date="${item.incorporacion || 'N/A'}" 
                     data-img-src='${item.imagePath}'> 
                    <img src="${firstImage}" alt="${item.name}" class="gallery-card-img" loading="lazy">
                    <div class="gallery-card-title">${item.name}</div>
                </div>
            `;
        }).join('');

        galleryHtml += `</div></div>`;
    });

    // 3. Lógica para la paginación y mensajes de "vacío"
    const totalPages = Math.ceil(totalGalleryItems / ITEMS_PER_PAGE);

    if (itemsByArea.size === 0) {
        if (totalGalleryItems === 0 && Object.keys(currentFilters).length === 0) {
            galleryContainer.innerHTML = '<p>No hay ítems en esta área.</p>';
        } else if (items.length === 0) {
            galleryContainer.innerHTML = '<p>No se encontraron ítems con los filtros aplicados en esta página.</p>';
        } else {
            galleryContainer.innerHTML = '<p>No hay ítems con imágenes para mostrar en esta página.</p>';
        }
    } else {
        galleryContainer.innerHTML = galleryHtml;
    }
    
    // 4. Renderizar controles de paginación (sin cambios)
    let paginationControls = galleryView.querySelector('.pagination-controls');
    if (paginationControls) paginationControls.remove();
    if (totalPages > 1) {
        paginationControls = document.createElement('div');
        paginationControls.className = 'pagination-controls';
        galleryView.appendChild(paginationControls);
        paginationControls.innerHTML = `
            <button id="prev-gallery-page" class="button" ${currentGalleryPage === 1 ? 'disabled' : ''}>Anterior</button>
            <span>Página ${currentGalleryPage} de ${totalPages}</span>
            <button id="next-gallery-page" class="button" ${currentGalleryPage >= totalPages ? 'disabled' : ''}>Siguiente</button>
        `;
        document.getElementById('prev-gallery-page').onclick = () => {
            if (currentGalleryPage > 1) displayInventory(node, isAdmin, currentGalleryPage - 1, currentFilters, currentSortBy);
        };
        document.getElementById('next-gallery-page').onclick = () => {
            if (currentGalleryPage < totalPages) displayInventory(node, isAdmin, currentGalleryPage + 1, currentFilters, currentSortBy);
        };
    }
}
// --- FIN DE LA SECCIÓN ACTUALIZADA ---

// --- NUEVO BLOQUE ---
// Detectar visualmente los bienes con estado “Pendiente de revisión”
function aplicarColorPendiente() {
    const filas = document.querySelectorAll('.inventory-table tbody tr');
    filas.forEach(fila => {
        const estadoCelda = fila.querySelector('td[data-field="estado"]');
        if (estadoCelda && estadoCelda.textContent.trim() === "Pendiente de revisión") {
            fila.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
            fila.style.color = 'red';
            fila.dataset.estadoPendiente = 'true';
        }
    });
}

// Efecto visual cuando Hacienda aprueba un bien
export function mostrarDestelloVerde(idFila) {
    const fila = document.querySelector(`tr[data-id="${idFila}"]`);
    if (fila) {
        fila.style.transition = 'background-color 0.5s ease';
        fila.style.backgroundColor = 'rgba(0,255,0,0.3)';
        setTimeout(() => {
            fila.style.backgroundColor = '';
            fila.style.color = '';
            delete fila.dataset.estadoPendiente;
        }, 1200);
    }
}

// Hook para re-aplicar los colores cada vez que se recarga el inventario
const originalDisplayInventory = displayInventory;
window.displayInventory = async function (...args) {
    await originalDisplayInventory.apply(this, args);
    aplicarColorPendiente();
};
// --- FIN DE LA SECCIÓN ACTUALIZADA ---

function exportToPrintableReport(node, items) {
    if (items.length === 0) {
        alert('No hay datos en la página actual para generar el informe.');
        return;
    }

    const reportWindow = window.open('', '_blank');
    reportWindow.document.write('<html><head><title>Acta de Inventario y Responsabilidad Patrimonial</title>');
    
    reportWindow.document.write(`
        <style>
            body { font-family: sans-serif; margin: 40px; font-size: 11pt; }
            .header, .footer { text-align: center; }
            .header h1 { margin: 0; font-size: 16pt; }
            .header h2 { font-size: 14pt; }
            .header p { margin: 5px 0; }
            .content { margin-top: 30px; }
            .content > p { text-align: justify; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10pt; }
            th, td { border: 1px solid #000; padding: 6px; text-align: left; }
            th { background-color: #e0e0e0; }
            .signatures { margin-top: 40px; }
            .signature-container { margin-top: 80px; width: 100%; display: table; }
            .signature-box { display: table-cell; width: 50%; text-align: center; }
            .signature-box p { margin: 2px 0; }
        </style>
    `);
    reportWindow.document.write('</head><body>');

    const currentDate = new Date().toLocaleDateString('es-AR');

    reportWindow.document.write(`
        <div class="header">
            <h1>MUNICIPALIDAD DE CURUZÚ CUATIÁ</h1>
            <p>Dirección de Control Patrimonial</p>
            <p>Berón de Astrada 565- (3460) Curuzú Cuatiá - Corrientes</p>
            <h2>ACTA DE INVENTARIO Y RESPONSABILIDAD PATRIMONIAL</h2>
        </div>
        <div class="content">
            <p><strong>Funcionario Responsable:</strong> _________________________________________________</p>
            <p><strong>Cargo:</strong> _________________________________________________________________</p>
            <p><strong>Área / Subárea:</strong> ${node.name || 'Todas las Áreas'}</p>
            <p><strong>DNI N°:</strong> _________________________</p>
            <p><strong>Fecha de recepción:</strong> ${currentDate}</p>
            <p>En mi carácter de Director de Control Patrimonial de la Municipalidad de Curuzú Cuatiá, hago entrega al funcionario arriba mencionado de los bienes que se detallan en el presente documento, los cuales pasan a su cargo para el buen uso, conservación y destino exclusivo de las funciones propias de su área, quedando el mismo responsable patrimonial de los mismos a partir de la fecha consignada.</p>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Nombre del bien</th>
                        <th>Cantidad</th>
                        <th>Descripción</th>
                        <th>Categoría</th>
                        <th>Incorporación</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr>
                            <td>${item.codigo_item || ''}</td>
                            <td>${item.name}</td>
                            <td>${item.quantity}</td>
                            <td>${item.description || ''}</td>
                            <td>${item.category}</td>
                            <td>${item.incorporacion || 'N/A'}</td>
                            <td>${statusOptions.find(s => s.value === item.status)?.label || item.status}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="signatures">
                <p><strong>Declaración del Funcionario Responsable:</strong> Declaro haber recibido en este acto los bienes consignados en el presente documento, comprometiéndome a su uso responsable, guarda, conservación y mantenimiento, y a comunicar oportunamente cualquier modificación en su estado, destino o localización.</p>
                <div class="signature-container">
                    <div class="signature-box">
                        <p><strong>Entregado por:</strong></p>
                        <p style="padding-top: 60px;">_________________________</p>
                        <p>Director de Control Patrimonial</p>
                    </div>
                    <div class="signature-box">
                        <p><strong>Recibido por:</strong></p>
                        <p style="padding-top: 60px;">_________________________</p>
                        <p>[Nombre y Apellido del Funcionario Responsable]</p>
                        <p style="padding-top: 60px;">_________________________</p>
                        <p>[DNI]</p>
                        <p style="padding-top: 60px;">_________________________</p>
                        <p>[Cargo]</p>
                    </div>
                </div>
                 <p style="text-align: center; margin-top: 40px;"><strong>Fecha:</strong> ${currentDate}</p>
            </div>
        </div>
    `);

    reportWindow.document.write('</body></html>');
    reportWindow.document.close();
    reportWindow.print();
}