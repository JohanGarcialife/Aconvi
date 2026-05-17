# Mensaje de Entrega - Proyecto Aconvi

Hola José Luis,

¡Espero que estés muy bien! Te escribo para confirmarte que **hemos finalizado la versión de producción** tanto del panel de administración (sitio web) como de la aplicación móvil de **Aconvi**. Todos los módulos están conectados a la base de datos de producción con datos de prueba cargados para que puedas probar todo el ecosistema.

A continuación, te detallo las funcionalidades integradas y un paso a paso para que puedas realizar una prueba completa de inicio a fin (End-to-End).

---

## 🚀 Funcionalidades del Proyecto

### 1. Panel de Administración Web (`aconvi.com`)
El centro de control diseñado para los administradores de fincas y presidentes de comunidad.
*   **Dashboard Interactivo:** Métricas en tiempo real sobre incidencias, zonas comunes, documentos y comunicados.
*   **Gestión de Incidencias:** Recepción de averías reportadas por los vecinos, con posibilidad de cambiar estados (Recibida, En revisión, En curso, Resuelta) y asignar proveedores.
*   **Comunicación:** Creación de avisos y comunicados (ordinarios o urgentes). Cuenta con integración de notificaciones push web.
*   **Zonas Comunes:** Gestión de áreas del edificio (Piscina, Pista de Pádel, Salón), configuración de horarios de apertura, cierre y tiempo por turno.
*   **Documentos:** Repositorio centralizado para subir Actas, Estatutos, Reglamentos y Contratos accesibles a la comunidad.
*   **Directorio de Proveedores:** Gestión de profesionales (fontaneros, electricistas, etc.) para atender incidencias.

### 2. Aplicación Móvil (Vecinos)
La herramienta para que los residentes interactúen con su comunidad desde el bolsillo.
*   **Reporte de Averías:** Creación de nuevas incidencias con descripción e imágenes directamente desde el teléfono.
*   **Tablón de Anuncios:** Visualización de todos los comunicados emitidos por la administración.
*   **Reservas de Espacios:** Calendario interactivo para reservar turnos en las zonas comunes disponibles.
*   **Documentación:** Acceso inmediato a las actas y presupuestos publicados por el administrador.
*   **Estado de Cuenta:** (Módulo de Cuotas) para visualizar los próximos recibos o deudas pendientes.

---

## 🛠️ Guía de Pruebas (End-to-End)

Te sugiero seguir este orden para ver cómo interactúan ambas plataformas en tiempo real:

### Paso 1: Explorar el Panel Administrativo (Web)
1.  Ingresa a **[aconvi.com](https://aconvi.com)** desde tu computadora.
2.  **Dashboard:** Revisa el resumen numérico. Verás que ya hemos cargado datos de prueba (8 incidencias, 4 comunicados, etc.).
3.  **Crear un Comunicado:**
    *   Ve a la pestaña **Comunicación**.
    *   Crea un nuevo aviso (ej. *"Mantenimiento de jardines este viernes"*). Publica el aviso.
4.  **Añadir un Documento:**
    *   Ve a **Documentos** y añade un nuevo archivo (ej. *"Acta de Mayo"*).

### Paso 2: Probar la App Móvil (Vecinos)
1.  **Instalación:** Descarga e instala el archivo **APK** que te adjuntamos en tu teléfono Android.
2.  **Reportar una Incidencia:**
    *   Navega a la sección de **Incidencias** en la app.
    *   Crea una nueva indicando el título, descripción y nivel de urgencia. Confirma el envío.
3.  **Reservar una Zona Común:**
    *   Ve al apartado de **Reservas**.
    *   Selecciona "Pista de Pádel" o "Piscina", elige un día en el calendario y selecciona un horario disponible.
4.  **Revisar Novedades:**
    *   Ve a la sección de **Comunicados**. Deberías ver reflejado automáticamente el aviso de *"Mantenimiento de jardines"* que creaste en el Paso 1.
    *   Ve a **Documentos** y comprueba que puedes acceder al *"Acta de Mayo"*.

### Paso 3: Cerrar el ciclo en la Web
1.  Regresa a **[aconvi.com](https://aconvi.com)**.
2.  Ve a la pestaña de **Incidencias**. Verás que la incidencia que acabas de reportar desde el móvil ya aparece en la lista con estado *Pendiente/Recibida*.
3.  Cámbiale el estado a *"En curso"*, simulando que ya has llamado a un proveedor.

---

Cualquier duda durante tus pruebas o si necesitas afinar algún detalle, estoy a tu disposición. 

¡Un saludo!
