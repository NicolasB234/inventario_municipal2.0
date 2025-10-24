document.addEventListener('DOMContentLoaded', () => {
    const themeSelector = document.getElementById('theme-selector');

    // Función para aplicar el tema al body y guardar la preferencia
    const applyTheme = (theme) => {
        // Primero, removemos cualquier clase de tema existente
        document.body.classList.remove('dark-mode', 'night-mode');
        
        // Si el tema no es el claro, añadimos la clase correspondiente
        if (theme && theme !== 'light') {
            document.body.classList.add(theme);
        }
        
        // Guardamos la preferencia en el almacenamiento local
        localStorage.setItem('selectedTheme', theme);

        // Actualizamos el valor del selector para que coincida
        if (themeSelector) {
            themeSelector.value = theme;
        }
    };

    // Añadimos el listener para cuando el usuario cambie la opción en el selector
    if (themeSelector) {
        themeSelector.addEventListener('change', () => {
            applyTheme(themeSelector.value);
        });
    }

    // Al cargar la página, aplicamos el tema guardado o el claro por defecto
    const savedTheme = localStorage.getItem('selectedTheme') || 'light';
    applyTheme(savedTheme);
});