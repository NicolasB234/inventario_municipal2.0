export const orgStructure = [
    {
        id: 'auditor',
        name: 'Auditor',
        type: 'area',
        children: []
    },
    {
        id: 'tribunal-faltas',
        name: 'Tribunal de Faltas',
        type: 'area',
        children: []
    },
    {
        id: 'intendencia',
        name: 'Intendencia',
        type: 'intendencia',
        children: [
            {
                id: 'unclassified',
                name: 'Área No Reconocida / A Clasificar',
                type: 'area',
                children: []
            },
            {
                id: 'sec-gobierno',
                name: 'Secretaría de Gobierno y Coordinación',
                type: 'secretaria',
                children: [
                    {
                        id: 'dir-catastro',
                        name: 'Dirección de Catastro',
                        type: 'direccion',
                        children: []
                    },
                    {
                        id: 'dir-bromatologia',
                        name: 'Dirección de Bromatología',
                        type: 'direccion',
                        children: [
                            { id: 'coord-concientizacion-ambiental', name: 'Coordinación de Concientización Ambiental', type: 'coordinacion', children: [] },
                            { id: 'coord-zoonosis', name: 'Coordinación de Zoonosis', type: 'coordinacion', children: [] },
                        ]
                    },
                    { id: 'dir-empleo-capacitacion', name: 'Dirección de Empleo y Capacitación', type: 'direccion', children: [] },
                    { id: 'dir-administrativa', name: 'Dirección Administrativa', type: 'direccion', children: [] },
                    { id: 'dir-gestion-provincial', name: 'Dirección de Gestión Provincial', type: 'direccion', children: [] },
                    {
                        id: 'dir-cultura-turismo',
                        name: 'Dirección de Cultura y Turismo',
                        type: 'direccion',
                        children: [
                            { id: 'coord-musicos', name: 'Coordinación de Músicos', type: 'coordinacion', children: [] },
                        ]
                    },
                    {
                        id: 'dir-transito',
                        name: 'Dirección de Tránsito y Seguridad Vial',
                        type: 'direccion',
                        children: [
                            { id: 'coord-licencias', name: 'Coordinación de Licencias de Conducir', type: 'coordinacion', children: [] },
                        ]
                    },
                    { id: 'dir-deportes', name: 'Dirección de Deportes y Recreación', type: 'direccion', children: [] },
                    { id: 'dir-ninez-familia', name: 'Dirección de Niñez, Adolescencia y Familia', type: 'direccion', children: [] },
                    { id: 'sub-familia', name: 'Subdirección de Familia', type: 'subdireccion', children: [] },
                    { id: 'dir-recursos-naturales', name: 'Dirección de Recursos Naturales', type: 'direccion', children: [] },
                    { id: 'centro-reclamos', name: 'Centro de Reclamos', type: 'area', children: [] },
                ]
            },
            {
                id: 'sec-hacienda',
                name: 'Secretaría de Hacienda',
                type: 'secretaria',
                children: [
                    { id: 'caja-recaudadora-invico', name: 'Caja Recaudadora Barrio Invico', type: 'area', children: [] },
                    { id: 'sub-compras', name: 'Subdirección de Compras', type: 'subdireccion', children: [] },
                    {
                        id: 'dir-ingresos-publicos',
                        name: 'Dirección de Ingresos Públicos',
                        type: 'direccion',
                        children: [
                            { id: 'atencion-publico', name: 'Atención al Público (Municipio)', type: 'area', children: [] },
                            { id: 'impresion-masiva', name: 'Impresión Masiva (Catastro)', type: 'area', children: [] }
                        ]
                    },
                    { id: 'coord-tesoreria', name: 'Coordinación de Tesorería', type: 'coordinacion', children: [] },
                    { id: 'coord-convenios-pagos', name: 'Coordinación de Convenios y Planes de Pagos', type: 'coordinacion', children: [] },
                    { id: 'dir-contable-presupuestaria', name: 'Dirección Contable y de Ejecución Presupuestaria', type: 'direccion', children: [] },
                    { id: 'sub-liquidacion-sueldos', name: 'Subdirección de Liquidación de Sueldos', type: 'subdireccion', children: [] },
                    { id: 'sub-sistemas', name: 'Subdirección de Sistemas', type: 'subdireccion', children: [] },
                ]
            },
            {
                id: 'sec-produccion',
                name: 'Secretaría de Producción',
                type: 'secretaria',
                children: [
                    { id: 'dir-valor-agregado', name: 'Dirección de Valor Agregado', type: 'direccion', children: [] },
                ]
            },
            {
                id: 'sec-obras-publicas',
                name: 'Secretaría de Obras Públicas',
                type: 'secretaria',
                children: [
                    { id: 'dir-taller-municipal', name: 'Dirección de Taller Municipal', type: 'direccion', children: [] },
                    {
                        id: 'dir-infraestructura-vial',
                        name: 'Dirección de Infraestructura Vial',
                        type: 'direccion',
                        children: [
                            { id: 'coord-bacheo', name: 'Coordinación de Bacheo', type: 'coordinacion', children: [] },
                            { id: 'coord-calles-ripio', name: 'Coordinación de Mantenimiento de Calles de Ripio', type: 'coordinacion', children: [] },
                        ]
                    },
                    {
                        id: 'sub-planeamiento-urbano',
                        name: 'Subdirección de Planeamiento Urbano',
                        type: 'subdireccion',
                        children: [
                            { id: 'coord-obras-privadas', name: 'Coordinación de Obras Privadas', type: 'coordinacion', children: [] },
                        ]
                    },
                    {
                        id: 'sub-parques-plazas',
                        name: 'Subdirección de Parques, Plazas y Paseos',
                        type: 'subdireccion',
                        children: [
                            {
                                id: 'coord-mantenimiento-plazas', name: 'Coordinación de Mantenimiento de Plazas y Paseos', type: 'coordinacion', children: [
                                    { id: 'Parque-Mita-Rori', name: 'Parque Mita Rori', type: 'parque', children: [] },
                                    { id: 'camping-municipal', name: 'Camping Municipal', type: 'parque', children: [] },
                                ]
                            },
                            { id: 'coord-embellecimiento', name: 'Coordinación de Embellecimiento de Parques, Plazas y Paseos', type: 'coordinacion', children: [] },
                            { id: 'coord-recoleccion', name: 'Coordinación de Recolección', type: 'coordinacion', children: [] },
                            { id: 'coord-agua-cloacas', name: 'Coordinación de Conexión de Agua y Cloacas', type: 'coordinacion', children: [] },
                            { id: 'coord-cementerio', name: 'Cementerio', type: 'area', children: [] },
                            { id: 'coord-parque-acuatico', name: 'Parque Acuático', type: 'area', children: [] },
                        ]
                    },
                    { id: 'sub-alumbrado-publico', name: 'Subdirección de Alumbrado Público', type: 'subdireccion', children: [] },
                    { id: 'parque-martin-fierro', name: 'Parque Martín Fierro', type: 'parque', children: [] },
                ]
            },
            {
                id: 'sec-servicios-publicos',
                name: 'Secretaría de Servicios Públicos',
                type: 'secretaria',
                children: [
                    { id: 'subsec-servicios-publicos', name: 'Subsecretaría de Servicios Públicos', type: 'subsecretaria', children: [] },
                    { id: 'sub-barrido-limpieza', name: 'Subdirección de Barrido y Limpieza', type: 'subdireccion', children: [] },
                    // CORRECCIÓN AQUÍ: 'dir-plamares' en lugar de 'dir-palmares'
                    { id: 'dir-plamares', name: 'Dirección de Plamares', type: 'direccion', children: [] },
                    { id: 'coord-corte-pasto', name: 'Coordinación de Corte de Pasto, Poda y Recolección', type: 'coordinacion', children: [] },
                    { id: 'coord-infra-eventos', name: 'Coordinación de Infraestructura de Eventos', type: 'coordinacion', children: [] },
                    // ELIMINADO: Entrada duplicada 'Plamares'
                ]
            },
            {
                id: 'sec-legales',
                name: 'Secretaría de Legales',
                type: 'secretaria',
                children: [
                    { id: 'coord-ejecucion-fiscal', name: 'Coordinación de Ejecución Fiscal', type: 'coordinacion', children: [] },
                ]
            },
            { id: 'dir-protocolo', name: 'Dirección de Ceremonial y Protocolo', type: 'direccion', children: [] },
            {
                id: 'dir-personal',
                name: 'Dirección de Personal',
                type: 'direccion',
                
                children: [
                    { id: 'oficina-informes-terminal', name: 'Oficina de Informes (Terminal)', type: 'area', children: [] },
                    { id: 'Terminal', name: 'Terminal', type: 'area', children: [
                        { id: 'Informe', name: 'Informe', type: 'area', children: [] },
                        { id: 'Proveduria', name: 'Proveduria', type: 'area', children: [] },
                        { id: 'Edificio Espacio Publico Terminal', name: 'Edificio Espacio Publico Terminal', type: 'area', children: [] },
                        ] },
                   
                ]
            },
            { id: 'dir-secretaria-privada', name: 'Dirección de Secretaría Privada', type: 'direccion', children: [] },
            {
                id: 'dir-prensa',
                name: 'Dirección de Prensa y Comunicación',
                type: 'direccion',
                children: [
                    { id: 'repetidora-fm', name: 'Repetidora FM Municipal', type: 'area', children: [] },
                    { id: 'radio-fm-ciudad', name: 'Radio FM Ciudad', type: 'area', children: [] }
                ]
            },
            { id: 'dir-control-patrimonial', name: 'Dirección de Control Patrimonial', type: 'direccion', children: [] },
            {
                id: 'dir-accion-social',
                name: 'Dirección de Acción Social',
                type: 'direccion',
                children: [
                    { id: 'salon-vieja-estacion', name: 'Salón Vieja Estación', type: 'area', children: [] },
                    { id: 'sub-accion-social', name: 'Subdirección de Acción Social', type: 'subdireccion', children: [] },
                    { id: 'coord-cim', name: 'Coordinación del CIM', type: 'coordinacion', children: [] },
                    { id: 'coord-cic', name: 'CIC Acción Social', type: 'area', children: [] },
                    {
                        id: 'coord-refugio',
                        name: 'Coordinación de Refugio',
                        type: 'coordinacion',
                        children: [
                            { id: 'salon-barrio-norte', name: 'Salón Barrio Norte', type: 'area', children: [] },
                        ]
                    },
                ]
            },
            {
                id: 'viceintendencia',
                name: 'Viceintendencia',
                type: 'viceintendencia',
                children: [
                    {
                        id: 'dir-salud',
                        name: 'Dirección de Salud',
                        type: 'direccion',
                        children: [
                            { id: 'sala-salud-Juan', name: 'Sala de Salud Juan Pedro Sorribes', type: 'area', children: [] },
                            { id: 'sala-salud-teresita', name: 'Sala de Salud Hermana Teresita', type: 'area', children: [] },
                            { id: 'sala-salud-Grossi', name: 'Sala de Salud Martinez Grossi', type: 'area', children: [] },
                            { id: 'sala-salud-garcia', name: 'Sala de Salud Dr. Otto Garcia', type: 'area', children: [] },
                            { id: 'centro-odontologico', name: 'CIC Salud', type: 'area', children: [] },
                            { id: 'sala-salud-Ramon', name: 'Sala de Salud San Ramon', type: 'area', children: [] },
                            { id: 'sala-salud-Rodriguez', name: 'Sala de Salud Dr. Carlos Rodriguez', type: 'area', children: [] },
                            { id: 'sala-salud-Obregon', name: 'Sala de Salud Dr. Pedro Obregon', type: 'area', children: [] },
                            { id: 'sala-salud-Juana', name: 'Sala de Salud Juana Garin de Benta', type: 'area', children: [] },
                        ]
                    },
                    { id: 'coord-club-dia', name: 'Coordinación Club de Día', type: 'coordinacion', children: [] },
                    { id: 'sub-discapacidad', name: 'Subdirección de Discapacidad', type: 'subdireccion', children: [] },
                    { id: 'coord-salud', name: 'Coordinación de Salud', type: 'coordinacion', children: [] },
                ]
            },
        ]
    }
];