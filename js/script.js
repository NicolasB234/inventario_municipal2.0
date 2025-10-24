// --- INICIO DE LA MODIFICACIÓN ---
// Se elimina la importación innecesaria y errónea de 'statusOptions'.
import { orgStructure } from './org-structure.js';
import { displayInventory, setupModalClosers } from './inventory-functions.js';

/**
 * Normaliza un texto: lo convierte a minúsculas y le quita los acentos.
 * Esto permite hacer búsquedas flexibles que ignoran tildes y mayúsculas.
 * @param {string} text El texto a normalizar.
 * @returns {string} El texto normalizado.
 */
function normalizeText(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .normalize("NFD") // Descompone los caracteres acentuados en letra + acento
        .replace(/[\u0300-\u036f]/g, ""); // Elimina los acentos
}
// --- FIN DE LA MODIFICACIÓN ---

const PHP_BASE_URL = 'php/';

// --- LÓGICA DE NOTIFICACIONES ---
let localNotifications = [];
let lastNotificationId = 0;
let lastAdminRequestCount = 0;
let lastAdminLogId = 0;
let pollingInterval;

function startPolling() {
    if (pollingInterval) return;
    fetchUpdates();
    pollingInterval = setInterval(fetchUpdates, 5000);
}

function stopPolling() {
    clearInterval(pollingInterval);
    pollingInterval = null;
}

function addNotificationToList(notif) {
    localNotifications.unshift({
        id: notif.id,
        message: notif.details,
        timestamp: notif.timestamp,
        action_type: notif.action_type // Se añade el tipo de acción
    });
    if (localNotifications.length > 20) localNotifications.pop();
}

function updateNotificationCounter(count) {
    const counterElement = document.getElementById('notification-counter');
    const bellButton = document.getElementById('notification-bell-btn');
    if (!counterElement || !bellButton) return;

    if (count > 0) {
        counterElement.textContent = count;
        counterElement.style.display = 'block';
        bellButton.classList.add('has-notifications');
    } else {
        counterElement.style.display = 'none';
        bellButton.classList.remove('has-notifications');
    }
}

function shakeBell() {
    const bellButton = document.getElementById('notification-bell-btn');
    if (bellButton) {
        bellButton.classList.add('new-notification');
        setTimeout(() => bellButton.classList.remove('new-notification'), 500);
    }
}

async function fetchUpdates() {
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    const lastId = isAdmin ? lastAdminLogId : lastNotificationId;

    try {
        const response = await fetch(`${PHP_BASE_URL}get_updates.php?last_id=${lastId}`);
        const data = await response.json();

        if (data.new_notifications && data.new_notifications.length > 0) {
            data.new_notifications.forEach(notif => {
                addNotificationToList(notif);
                if(isAdmin) {
                    lastAdminLogId = Math.max(lastAdminLogId, notif.id);
                } else {
                    lastNotificationId = Math.max(lastNotificationId, notif.id);
                }

                // Lógica de destello verde para ítems aprobados
                if(notif.action_type === 'item_added_by_admin') {
                    try {
                        const details = JSON.parse(notif.details);
                        if(details.itemId) {
                            highlightItem(details.itemId);
                        }
                    } catch(e) { /* No es un JSON, ignorar */ }
                }
            });
            shakeBell();
        }

        if (isAdmin) {
            const newRequestCount = data.pending_admin_requests || 0;
            updateNotificationCounter(newRequestCount);
            lastAdminRequestCount = newRequestCount;
        } else {
            updateNotificationCounter(localNotifications.length);
        }

        if (data.refresh_inventory) {
            const selectedNodeElement = document.querySelector('#org-nav .node-content.selected');
            if (selectedNodeElement) {
                selectedNodeElement.click(); // Simula un click para recargar la vista
            }
        }
    } catch (error) {
        console.error('Error en el polling de actualizaciones:', error);
    }
}

function initializeNotifications() {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopPolling();
        } else {
            startPolling();
        }
    });

    if (!document.hidden) {
        startPolling();
    }
}

function toggleNotifPanel() {
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    const notificationBellButton = document.getElementById('notification-bell-btn');
    const existingPanel = document.querySelector('.notifications-panel');
    if (existingPanel) {
        existingPanel.remove();
        return;
    }

    const notifPanel = document.createElement('div');
    notifPanel.className = 'notifications-panel';
    let notificationsHtml = `<h3>${isAdmin ? 'Actividad del Sistema' : 'Mis Notificaciones'}</h3><div class="notifications-list">`;

    if (localNotifications.length === 0 && (!isAdmin || lastAdminRequestCount === 0)) {
        notificationsHtml += '<p>No hay notificaciones nuevas.</p>';
    } else {
        if (isAdmin && lastAdminRequestCount > 0) {
             notificationsHtml += `<p class="notif-pending">Hay <strong>${lastAdminRequestCount}</strong> solicitud(es) esperando revisión.</p>`;
        }
        localNotifications.forEach(notif => {
             const date = new Date(notif.timestamp).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
             
             let colorClass = '';
             // Se verifica primero si es 'aprobada' o 'agregada' para asignarle el color verde.
             if (notif.action_type.includes('approved') || notif.action_type.includes('added')) {
                 colorClass = 'notif-approved'; // Verde para aprobadas
             } 
             // Si no es aprobada, se verifica si es una solicitud pendiente para el color rojo.
             else if (notif.action_type === 'hacienda_add' || notif.action_type.includes('request')) {
                 colorClass = 'notif-pending'; // Rojo para pendientes y rechazadas
             }
             let message = notif.message;
             // Si el mensaje es un JSON (para los aprobados), lo extraemos
             try {
                 const details = JSON.parse(message);
                 if(details.message) message = details.message;
             } catch(e) { /* No es JSON, usamos el texto plano */ }

             notificationsHtml += `<p class="${colorClass}">[${date}] <strong>${message}</strong></p>`;
        });
    }

    const link = isAdmin ? 'solicitudes.html' : 'notificaciones.html';
    const linkText = isAdmin ? `Ir a Solicitudes (${lastAdminRequestCount})` : 'Ver todo el historial';
    notificationsHtml += `</div><a href="${link}" class="view-all-notifs">${linkText}</a>`;

    notifPanel.innerHTML = notificationsHtml;
    document.body.appendChild(notifPanel);

    if (!isAdmin) {
        localNotifications = [];
        updateNotificationCounter(0);
    }

    setTimeout(() => {
        const closePanel = (e) => {
            if (!notifPanel.contains(e.target) && e.target !== notificationBellButton && !notificationBellButton.contains(e.target)) {
                notifPanel.remove();
                document.removeEventListener('click', closePanel);
            }
        };
        document.addEventListener('click', closePanel);
    }, 0);
}
async function handleLogin(username, password) {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    try {
        const response = await fetch(`${PHP_BASE_URL}login.php`, { method: 'POST', body: formData });
        return await response.json();
    } catch (error) {
        console.error('Error en handleLogin:', error);
        return { success: false, message: 'Error de conexión.' };
    }
}

// CAMBIO: La función de registro ahora también envía si el usuario es admin
async function handleRegister(username, password, areaId, isAdmin) {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    formData.append('area_id', areaId);
    if (isAdmin) {
        formData.append('is_admin', '1');
    }
    try {
        const response = await fetch(`${PHP_BASE_URL}register.php`, { method: 'POST', body: formData });
        return await response.json();
    } catch (error) {
        console.error('Error en handleRegister:', error);
        return { success: false, message: 'Error de conexión.' };
    }
}

async function checkLoginStatusFromServer() {
    try {
        const response = await fetch(`${PHP_BASE_URL}check_session.php`);
        return await response.json();
    } catch (error) {
        console.error('Error en checkLoginStatusFromServer:', error);
        return { loggedIn: false };
    }
}

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

function findNodeById(id, nodes) {
    for (const node of nodes) {
        if (node.id === id) {
            return node;
        }
        if (node.children) {
            const found = findNodeById(id, node.children);
            if (found) {
                return found;
            }
        }
    }
    return null;
}

document.addEventListener('DOMContentLoaded', async () => {

    if (document.getElementById('login-section')) {
        const loginStatus = await checkLoginStatusFromServer();
        if (loginStatus.loggedIn) {
            window.location.href = 'index.html';
            return;
        }

        const loginForm = document.getElementById('login-section');
        const registerForm = document.getElementById('register-section');
        const loginMessage = document.getElementById('login-message');
        const registerMessage = document.getElementById('register-message');

        document.querySelectorAll('.toggle-form').forEach(button => {
            button.addEventListener('click', () => {
                loginForm.classList.toggle('active');
                registerForm.classList.toggle('active');
                loginMessage.textContent = '';
                registerMessage.textContent = '';
            });
        });

        document.getElementById('login-btn').addEventListener('click', async () => {
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value.trim();
            if (!username || !password) {
                loginMessage.textContent = 'Por favor, introduce usuario y contraseña.';
                return;
            }
            const result = await handleLogin(username, password);
            if (result.success) {
                sessionStorage.setItem('userAreaId', result.areaId);
                sessionStorage.setItem('username', username);
                sessionStorage.setItem('isAdmin', result.isAdmin || false);
                window.location.href = 'index.html';
            } else {
                loginMessage.textContent = result.message || 'Error al iniciar sesión.';
            }
        });

        const searchInput = document.getElementById('area-search-input');
        const searchResults = document.getElementById('area-search-results');
        const hiddenAreaIdInput = document.getElementById('register-area-id');
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
                searchResults.style.display = 'none';
            }
        });

        document.getElementById('register-btn').addEventListener('click', async () => {
            const username = document.getElementById('register-username').value.trim();
            const password = document.getElementById('register-password').value.trim();
            const areaId = hiddenAreaIdInput.value;
            // CAMBIO: Leer el valor del checkbox
            const isAdmin = document.getElementById('register-is-admin').checked;

            if (!username || !password || !areaId) {
                registerMessage.textContent = 'Por favor, rellene todos los campos (incluyendo el área).';
                return;
            }
            // CAMBIO: Enviar el valor del checkbox a la función
            const result = await handleRegister(username, password, areaId, isAdmin);
            registerMessage.textContent = result.message;
            registerMessage.style.color = result.success ? '#2ecc71' : '#e74c3c';
            if (result.success) {
                setTimeout(() => {
                    loginForm.classList.add('active');
                    registerForm.classList.remove('active');
                }, 2000);
            }
        });

    } else if (document.getElementById('inventory-section')) {
        const loginStatus = await checkLoginStatusFromServer();
        if (!loginStatus.loggedIn) {
            window.location.href = 'login.html';
            return;
        }

        setupModalClosers();

        const notificationBellButton = document.getElementById('notification-bell-btn');
        if (notificationBellButton) {
            notificationBellButton.addEventListener('click', toggleNotifPanel);
        }

        initializeNotifications();

        const viewButtons = document.querySelectorAll('.view-btn');
        const viewSections = document.querySelectorAll('.view-section');

        function switchView(viewId) {
            viewSections.forEach(section => section.classList.remove('active'));
            viewButtons.forEach(button => button.classList.remove('active'));
            const activeSection = document.getElementById(viewId);
            if (activeSection) activeSection.classList.add('active');
            const activeButton = document.getElementById(`show-${viewId}-btn`);
            if (activeButton) activeButton.classList.add('active');
        }

        viewButtons.forEach(button => {
            button.addEventListener('click', () => {
                const viewId = button.id.replace('show-', '').replace('-btn', '');
                switchView(viewId);
            });
        });

        const orgNav = document.getElementById('org-nav');
        const contentTitle = document.getElementById('content-title');
        let selectedNodeElement = null;

        function buildOrgTree(nodes, parentElement) {
            const ul = document.createElement('ul');
            nodes.forEach(node => {
                const li = document.createElement('li');
                li.dataset.nodeId = node.id;
                const nodeContent = document.createElement('div');
                nodeContent.className = 'node-content';
                
                const toggle = document.createElement('span');
                toggle.className = 'toggle';

                const nodeNameSpan = document.createElement('span');
                nodeNameSpan.textContent = node.name;
                nodeNameSpan.className = 'node-name';

                // Se usa una clase para que CSS maneje el ícono, en lugar de fa-bars
                if (node.children && node.children.length > 0) {
                    li.classList.add('has-children');
                }

                nodeContent.append(toggle, nodeNameSpan);

                nodeContent.onclick = () => {
                    selectNode(li, node);
                    if (node.children && node.children.length > 0) {
                        toggleNode(li);
                    }
                };

                li.appendChild(nodeContent);
                if (node.children) {
                    buildOrgTree(node.children, li);
                }
                ul.appendChild(li);
            });
            parentElement.appendChild(ul);
        }

        function toggleNode(liElement) {
            liElement.classList.toggle('expanded');
        }

        const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
        const sidebarOverlay = document.getElementById('sidebar-overlay');
        const body = document.body;

        const openSidebar = () => body.classList.add('sidebar-open');
        const closeSidebar = () => body.classList.remove('sidebar-open');
        
        if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', openSidebar);
        if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

        function selectNode(liElement, node) {
            if (selectedNodeElement) {
                selectedNodeElement.classList.remove('selected');
            }

            if (liElement) {
                 liElement.querySelector('.node-content').classList.add('selected');
                 selectedNodeElement = liElement.querySelector('.node-content');
            } else {
                const allAreasButton = document.getElementById('all-areas-btn');
                if (allAreasButton) {
                    allAreasButton.classList.add('selected');
                    selectedNodeElement = allAreasButton;
                }
            }
            
            const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
            
            displayInventory({ id: node.id, name: node.name }, isAdmin);
        }
        
        function setupHeaderButtons() {
            const container = document.getElementById('header-right-container');
            if (!container) return;

            const dynamicButtons = container.querySelectorAll('.header-btn, #requests-btn');
            dynamicButtons.forEach(btn => btn.remove());
            
            const historyButton = document.createElement('button');
            historyButton.id = 'history-btn';
            historyButton.innerHTML = '<i class="fas fa-history"></i>';
            historyButton.title = "Historial";
            historyButton.className = "header-btn";
            historyButton.onclick = () => { window.location.href = 'notificaciones.html'; };
            
            const logoutButton = document.createElement('button');
            logoutButton.id = 'logout-btn';
            logoutButton.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
            logoutButton.title = "Cerrar Sesión";
            logoutButton.className = "header-btn";
            logoutButton.addEventListener('click', () => { window.location.href = `${PHP_BASE_URL}logout.php`; });
            
            container.prepend(logoutButton);
            container.prepend(historyButton);
            
            const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
            if (isAdmin) {
                const requestsButton = document.createElement('button');
                requestsButton.id = 'requests-btn';
                requestsButton.innerHTML = '<i class="fas fa-inbox"></i>';
                requestsButton.title = "Solicitudes Pendientes";
                requestsButton.className = "header-btn";
                requestsButton.onclick = () => { window.location.href = 'solicitudes.html'; };
                container.prepend(requestsButton);
            }
        }
        
        function init() {
            orgNav.innerHTML = '';
            
            const userAreaId = sessionStorage.getItem('userAreaId');
            const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
            const currentUsername = sessionStorage.getItem('username');

            let welcomeMessage = `Bienvenido`;
            if (isAdmin) {
                welcomeMessage += ` Jefe de Área`;
            }
            welcomeMessage += `, ${currentUsername}`;
            contentTitle.textContent = welcomeMessage;

            setupHeaderButtons();

            const haciendaAreaId = 'sec-hacienda'; 
            if (isAdmin || userAreaId === haciendaAreaId) {
                const headerLeft = document.querySelector('.header-left');
                if(headerLeft) {
                    const haciendaButton = document.createElement('a');
                    haciendaButton.href = 'hacienda.html';
                    haciendaButton.className = 'button';
                    haciendaButton.innerHTML = '<i class="fas fa-landmark"></i> Carga Hacienda';
                    haciendaButton.style.textDecoration = 'none';
                    
                    const actionsMenu = headerLeft.querySelector('.header-actions');
                    if (actionsMenu) {
                        actionsMenu.insertAdjacentElement('afterend', haciendaButton);
                    } else {
                        headerLeft.appendChild(haciendaButton);
                    }
                }
            }

            const searchContainer = document.querySelector('.sidebar-search-container');

            if (isAdmin) {
                if (searchContainer) searchContainer.style.display = 'block';
                const allAreasButton = document.createElement('div');
                allAreasButton.id = 'all-areas-btn';
                allAreasButton.className = 'node-content';
                allAreasButton.innerHTML = `<i class="fas fa-globe" style="margin-right: 10px;"></i> Todas las Áreas`;
                allAreasButton.onclick = () => selectNode(null, { id: '', name: 'Todas las Áreas' });
                orgNav.appendChild(allAreasButton);
                buildOrgTree(orgStructure, orgNav);
                selectNode(null, { id: '', name: 'Todas las Áreas' });
            } else {
                if (searchContainer) searchContainer.style.display = 'none';
                const userNode = findNodeById(userAreaId, orgStructure);
                
                if (!userNode) {
                    contentTitle.textContent = 'Error de Configuración';
                    document.getElementById('table-view').innerHTML = `<p class="error-message"><b>Error:</b> Su área asignada ('${userAreaId}') no se encontró.</p>`;
                } else {
                    const userAreaStructure = [userNode];
                    buildOrgTree(userAreaStructure, orgNav);
                    
                    const nodeElement = orgNav.querySelector(`li[data-node-id="${userNode.id}"]`);
                    if (nodeElement) {
                       selectNode(nodeElement, userNode);
                       nodeElement.classList.add('expanded');
                    }
                }
            }
        }

        init();
        
        const downloadProtocolBtn = document.getElementById('download-protocol-btn');
        if (downloadProtocolBtn) {
            downloadProtocolBtn.addEventListener('click', () => {
                if (confirm("¿Desea descargar la información sobre el Protocolo de Carga?")) {
                    const link = document.createElement('a');
                    link.href = 'uploads/PROTOCOLO DE CARGA.docx';
                    link.download = 'PROTOCOLO DE CARGA.docx';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
            });
        }
        
        // --- INICIO DE LA SECCIÓN ACTUALIZADA ---
        // 2. Lógica para la galería de imágenes con navegación (VERSIÓN ACTUALIZADA)
        const imageModal = document.getElementById('image-modal');
        let galleryItems = []; // Lista de todos los ítems de la galería en la vista actual
        let currentItemIndex = -1; // Índice del ítem actual que se está viendo
        
        let currentItemImages = []; // Array con las URLs de las imágenes del ítem actual
        let currentImageSubIndex = 0; // Índice de la foto que se está viendo dentro del ítem actual

        // Función para actualizar el contenido del modal con los datos de un ítem
        function updateModalContent(itemIndex) {
            if (itemIndex < 0 || itemIndex >= galleryItems.length) return;
            
            currentItemIndex = itemIndex;
            const itemData = galleryItems[itemIndex].dataset;
            
            // Llenar los detalles del ítem (nombre, descripción, etc.)
            document.getElementById('modal-item-name').textContent = itemData.name;
            document.getElementById('modal-item-description').textContent = itemData.description;
            document.getElementById('modal-item-category').textContent = itemData.category;
            document.getElementById('modal-item-quantity').textContent = itemData.quantity;
            document.getElementById('modal-item-status').textContent = itemData.status;
            document.getElementById('modal-item-date').textContent = itemData.date;
            
            // Decidir cómo manejar las imágenes
            const imagePathData = itemData.imgSrc;
            const prevBtn = imageModal.querySelector('.prev-gallery-btn');
            const nextBtn = imageModal.querySelector('.next-gallery-btn');

            try {
                // Intentar interpretar como un array de imágenes
                currentItemImages = JSON.parse(imagePathData);
                if (!Array.isArray(currentItemImages)) throw new Error(); // Forzar el catch si no es un array
            } catch (e) {
                // Si falla, es una sola imagen, la envolvemos en un array
                currentItemImages = [imagePathData];
            }

            // Mostrar u ocultar los botones de navegación de imágenes
            if (currentItemImages.length > 1) {
                prevBtn.style.display = 'block';
                nextBtn.style.display = 'block';
            } else {
                prevBtn.style.display = 'none';
                nextBtn.style.display = 'none';
            }
            
            // Empezar mostrando la primera imagen
            currentImageSubIndex = 0;
            updateModalImage();
        }

        // Función para cambiar la imagen mostrada dentro del modal
        function updateModalImage() {
            const modalImageElement = document.getElementById('modal-image');
            if (currentItemImages.length > 0) {
                modalImageElement.src = currentItemImages[currentImageSubIndex];
            } else {
                modalImageElement.src = ''; // O una imagen placeholder
            }
        }

        if (imageModal) {
            const closeBtn = imageModal.querySelector('.close-modal-gallery');
            const prevBtn = imageModal.querySelector('.prev-gallery-btn');
            const nextBtn = imageModal.querySelector('.next-gallery-btn');

            const closeModal = () => imageModal.style.display = "none";
            
            if(closeBtn) closeBtn.addEventListener('click', closeModal);
            imageModal.addEventListener('click', (e) => {
                 if (e.target === imageModal) closeModal();
            });

            // Nueva lógica para los botones: navegan entre FOTOS, no entre ítems.
            if(prevBtn) {
                prevBtn.addEventListener('click', () => {
                    currentImageSubIndex = (currentImageSubIndex - 1 + currentItemImages.length) % currentItemImages.length;
                    updateModalImage();
                });
            }

            if(nextBtn) {
                nextBtn.addEventListener('click', () => {
                    currentImageSubIndex = (currentImageSubIndex + 1) % currentItemImages.length;
                    updateModalImage();
                });
            }
        }
        
        // El listener para abrir el modal no cambia mucho
        const galleryView = document.getElementById('gallery-view');
        if(galleryView) {
            galleryView.addEventListener('click', (event) => {
                const card = event.target.closest('.gallery-card');
                if (card && imageModal) {
                    // Obtenemos la lista actualizada de ítems en la galería
                    galleryItems = Array.from(galleryView.querySelectorAll('.gallery-card'));
                    const clickedItemIndex = galleryItems.findIndex(item => item === card);
                    
                    updateModalContent(clickedItemIndex);
                    imageModal.style.display = "flex";
                }
            });
        }
        
// --- 🔧 INICIO DE PÁTRIBOT CHATBOT GLOBAL ---

const patribotButton = document.createElement('div');
patribotButton.id = 'patribot-btn';
patribotButton.innerHTML = '🤖 Pátribot';
document.body.appendChild(patribotButton);

const patribotWindow = document.createElement('div');
patribotWindow.id = 'patribot-window';
patribotWindow.innerHTML = `
  <div class="patribot-header">
    <span>🤖 Pátribot</span>
    <button id="close-patribot">&times;</button>
  </div>
  <div class="patribot-messages" id="patribot-messages">
    <div class="patribot-message bot">
      ¡Hola! Soy <b>Pátribot</b> 🤖<br>
      Podés pedirme ayuda sobre:
      <br>1️⃣ Cómo cargar un ítem
      <br>2️⃣ Cómo editar un ítem
      <br>3️⃣ Cómo imprimir un ítem
      <br>4️⃣ Descargar protocolo
      <br><br>Escribí el número o la palabra clave 👇
    </div>
  </div>
  <div class="patribot-input">
    <input type="text" id="patribot-input-text" placeholder="Escribí tu mensaje...">
    <button id="patribot-send">Enviar</button>
  </div>
`;
document.body.appendChild(patribotWindow);

patribotButton.addEventListener('click', () => {
  patribotWindow.classList.toggle('visible');
});

document.getElementById('close-patribot').addEventListener('click', () => {
  patribotWindow.classList.remove('visible');
});

const patribotInput = document.getElementById('patribot-input-text');
const patribotSend = document.getElementById('patribot-send');
const patribotMessages = document.getElementById('patribot-messages');

// ✅ AQUÍ PODÉS EDITAR Y PERSONALIZAR LAS PREGUNTAS Y RESPUESTAS DE PÁTRIBOT
// ---------------------------------------------------------------------------
const patribotResponses = {
  // --- 1️⃣ Cargar un ítem ---
  "1": "🟢 <b>Cómo cargar un ítem:</b><br>1. Ingresá al panel de tu área.<br>2. Hacé clic en el botón <b>“Agregar ítem”</b>.<br>3. Completá los campos requeridos (nombre, categoría, cantidad, descripción, etc.).<br>4. Presioná <b>Guardar</b> para finalizar la carga.",
  "cargar": "🟢 <b>Cómo cargar un ítem:</b><br>1. Ingresá al panel de tu área.<br>2. Hacé clic en el botón <b>“Agregar ítem”</b>.<br>3. Completá los campos requeridos (nombre, categoría, cantidad, descripción, etc.).<br>4. Presioná <b>Guardar</b> para finalizar la carga.",
  "nuevo ítem": "🟢 <b>Cómo cargar un ítem:</b><br>1. Ingresá al panel de tu área.<br>2. Hacé clic en el botón <b>“Agregar ítem”</b>.<br>3. Completá los campos requeridos (nombre, categoría, cantidad, descripción, etc.).<br>4. Presioná <b>Guardar</b> para finalizar la carga.",

  // --- 2️⃣ Editar un ítem ---
  "2": "🟡 <b>Cómo editar un ítem:</b><br>1. Buscá el ítem en tu listado o usá el buscador.<br>2. Presioná el ícono <b>✏️ Editar</b> junto al registro que querés modificar.<br>3. Cambiá los datos necesarios y luego hacé clic en <b>Guardar cambios</b>.",
  "editar": "🟡 <b>Cómo editar un ítem:</b><br>1. Buscá el ítem en tu listado o usá el buscador.<br>2. Presioná el ícono <b>✏️ Editar</b> junto al registro que querés modificar.<br>3. Cambiá los datos necesarios y luego hacé clic en <b>Guardar cambios</b>.",
  "modificar": "🟡 <b>Cómo editar un ítem:</b><br>1. Buscá el ítem en tu listado o usá el buscador.<br>2. Presioná el ícono <b>✏️ Editar</b> junto al registro que querés modificar.<br>3. Cambiá los datos necesarios y luego hacé clic en <b>Guardar cambios</b>.",

  // --- 3️⃣ Imprimir un ítem ---
  "3": "🖨️ <b>Cómo imprimir un ítem:</b><br>1. Filtrá los ítems que querés imprimir o simplemente imprimí todos los ítems de tu área.<br>2. Presioná el ícono <b>🧾</b> que aparece junto a las notificaciones y elegí la opción <b>PDF INFORME</b>.<br>3. Se abrirá una vista previa o un PDF listo para descargar o imprimir.",
  "imprimir": "🖨️ <b>Cómo imprimir un ítem:</b><br>1. Filtrá los ítems que querés imprimir o simplemente imprimí todos los ítems de tu área.<br>2. Presioná el ícono <b>🧾</b> que aparece junto a las notificaciones y elegí la opción <b>PDF INFORME</b>.<br>3. Se abrirá una vista previa o un PDF listo para descargar o imprimir.",

  // --- 4️⃣ Descargar protocolo ---
  "4": "📄 <b>Descargar protocolo:</b><br>Podés descargar el documento oficial del <b>Protocolo de Carga</b> desde el siguiente enlace:<br><br><a href='uploads/PROTOCOLO DE CARGA.docx' download class='patribot-download' target='_blank'>⬇️ Descargar Protocolo</a>",
  "protocolo": "📄 <b>Descargar protocolo:</b><br>Podés descargar el documento oficial del <b>Protocolo de Carga</b> desde el siguiente enlace:<br><br><a href='uploads/PROTOCOLO DE CARGA.docx' download class='patribot-download' target='_blank'>⬇️ Descargar Protocolo</a>"
};
// ---------------------------------------------------------------------------

function addPatribotMessage(sender, text) {
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('patribot-message', sender);
  msgDiv.innerHTML = text;
  patribotMessages.appendChild(msgDiv);
  patribotMessages.scrollTop = patribotMessages.scrollHeight;
}

function processPatribotMessage(userText) {
  const normalized = userText.toLowerCase().trim();
  let foundResponse = null;

  for (const key in patribotResponses) {
    if (normalized === key || normalized.includes(key)) {
      foundResponse = patribotResponses[key];
      break;
    }
  }

  if (!foundResponse) {
    foundResponse = "🤔 No entendí eso.<br>Podés escribirme:<br>1️⃣ Cómo cargar un ítem<br>2️⃣ Cómo editar un ítem<br>3️⃣ Cómo imprimir un ítem<br>4️⃣ Descargar protocolo";
  }

  addPatribotMessage("bot", foundResponse);
}

patribotSend.addEventListener('click', () => {
  const text = patribotInput.value.trim();
  if (!text) return;
  addPatribotMessage("user", text);
  patribotInput.value = "";
  setTimeout(() => processPatribotMessage(text), 500);
});

patribotInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') patribotSend.click();
});

// --- 🔧 FIN DE PÁTRIBOT CHATBOT GLOBAL ---

        const orgSearchInput = document.getElementById('org-search-input');
        if (orgSearchInput) {
            orgSearchInput.addEventListener('input', () => {
                const searchTerm = normalizeText(orgSearchInput.value);
                const allNodes = orgNav.querySelectorAll('#org-nav li');

              allNodes.forEach(li => {
                    const nodeNameElement = li.querySelector('.node-content > span.node-name');
                    const nodeName = nodeNameElement ? normalizeText(nodeNameElement.textContent) : '';
                    
                    // Si no hay término de búsqueda, mostrar todo y colapsar
                    if (!searchTerm) {
                        li.style.display = "";
                        li.classList.remove('expanded');
                        return;
                    }

                    // Si el nombre coincide, mostrarlo y expandir sus padres
                    if (nodeName.includes(searchTerm)) {
                        li.style.display = "";
                        let parent = li.parentElement.closest('li');
                        while(parent) {
                            parent.style.display = "";
                            parent.classList.add('expanded'); // Solo se añade la clase, no se toca el ícono
                            parent = parent.parentElement.closest('li');
                        }
                    } else {
                        li.style.display = "none";
                    }
                });
                if(!searchTerm) {
                     allNodes.forEach(li => {
                        li.style.display = "";
                        li.classList.remove('expanded');
                        const toggle = li.querySelector('.toggle');
                        if(toggle && toggle.textContent === '▾') toggle.textContent = '▸';
                     });
                }
            });
        }
    }
});