# 📋 Guía de Verificación y Pruebas — Entrega Feedback Cliente

Este documento detalla el paso a paso para verificar y comprobar el correcto funcionamiento de los **6 puntos corregidos** en la aplicación móvil (Expo) y en el panel web de administración (Next.js).

---

## 📱 Requisitos Previos para la Prueba

1. **Servidor y Base de Datos**: Asegurarse de tener el entorno en ejecución (`pnpm run dev`).
2. **Panel Web**: Acceder a `http://localhost:3000/incidents` con rol Administrador de Fincas (AF).
3. **App Móvil**: Instalar el APK generado ([aconvi-release.apk](file:///Users/johan/Desktop/Proyectos/cisnerol/aconvi-release.apk)) o ejecutar `pnpm run dev:android` en un dispositivo/emulador e iniciar sesión como **Proveedor** o **Vecino**.

---

## 🔍 Punto 1: Navegación entre filtros desde cualquier sección (App Móvil)

### Objetivo:
Verificar que la barra de **Resumen de estados** superior responda inmediatamente desde cualquier sección de la app (incluso estando en *Intervenciones* o *Expiradas hoy*), sin tener que pulsar manualmente *Inicio* primero.

### Pasos de prueba:
1. Abre la aplicación móvil con una cuenta de **Proveedor**.
2. En la barra de navegación inferior, entra en la pestaña **Intervenciones** o abre el menú y pulsa **OT Expiradas**.
3. Estando en esa pantalla, pulsa directamente sobre cualquiera de los 4 botones de la barra superior:
   - **Por responder** (Naranja)
   - **En curso** (Verde)
   - **Programadas** (Azul)
   - **Finalizadas hoy** (Gris)
4. **Resultado esperado**:
   - La app cambia automáticamente a la vista de *Inicio*.
   - El filtro seleccionado se activa de inmediato, mostrando únicamente las órdenes de trabajo correspondientes a ese estado.
   - Al pulsar de nuevo el mismo botón, se desactiva el filtro volviendo a mostrar todas las tareas del día.

---

## 🔍 Punto 2: Notificaciones Push Multirrol (Vecino, Proveedor y AF)

### Objetivo:
Comprobar que cada evento del ciclo de vida de una incidencia genera y entrega la notificación push al rol que corresponde.

### Matriz de Eventos y Destinatarios:

| Evento / Acción | Rol que ejecuta | Rol que recibe Push | Mensaje / Título |
| :--- | :--- | :--- | :--- |
| **1. Crear Incidencia** | Vecino | **Administrador de Fincas (AF)** + Vecino (confirmación) | 📋 *"Nueva incidencia recibida"* |
| **2. Asignar Proveedor** | AF | **Proveedor** (y Vecino en 1ª asignación) | 📋 *"Nueva incidencia asignada"* |
| **3. Aceptar / Agendar OT** | Proveedor | **Vecino** + **AF** | 📅 *"Intervención confirmada"* / *"OT Aceptada"* |
| **4. Llegada al Sitio (Llegué)** | Proveedor | **Vecino** + **AF** | 📍 *"En intervención"* / *"Proveedor en sitio"* |
| **5. Finalizar Trabajo** | Proveedor | **Vecino** + **AF** | ✅ *"Intervención finalizada"* / *"Pendiente de validación"* |
| **6. Rechazar OT** | Proveedor | **AF** | ❌ *"OT Rechazada - Lista para reasignar"* |
| **7. OT Caducada / No Presentada** | Sistema | **AF** | ⏳ *"OT Caducada / No presentada"* |
| **8. Cerrar Expediente** | AF | **Vecino** | 🔒 *"Incidencia cerrada - Ya puedes valorar"* |
| **9. Valorar Servicio (1-5★)** | Vecino | **AF** + **Proveedor** | ⭐ *"Nueva valoración recibida"* |

### Pasos de prueba:
1. Desde la app del vecino o API, reporta una nueva incidencia -> Verifica que los AFs reciben la notificación.
2. Desde el panel web AF, asigna un proveedor -> Verifica que el móvil del profesional recibe *"Nueva incidencia asignada"*.
3. En la app del proveedor, pulsa **Aceptar y Agendar** -> Verifica la notificación en el vecino y en el AF.
4. Pulsa **Ya he llegado** (a la hora de la cita) -> Verifica la notificación de llegada en el vecino y en el AF.
5. Sube la foto final y pulsa **Finalizar trabajo** -> Verifica la notificación de trabajo completado en el vecino y AF.
6. En el panel web, pulsa **Revisar y cerrar expediente** -> Verifica la notificación de cierre en el vecino.
7. En el vecino, califica con 5 estrellas -> Verifica la notificación de valoración en el AF y en el proveedor.

---

## 🔍 Punto 3: OT rechazada — Etiqueta limpia "Rechazada" (Panel Web AF)

### Objetivo:
Verificar que la etiqueta de estado sea `"Rechazada"` (en lugar de *"Rechazada proveedor"*), manteniendo la coherencia visual con el resto de estados.

### Pasos de prueba:
1. En la app móvil del proveedor, ante una OT en estado *"Por responder"*, pulsa **Rechazar**.
2. Abre el panel web en `/incidents`.
3. Observa la tarjeta de la incidencia en la lista y en la columna de detalles.
4. **Resultado esperado**:
   - El badge o píldora de estado muestra el texto exacto **"Rechazada"** en color rojo suave.
   - En el filtro de la parte superior aparece la pestaña **"Rechazadas"**.

---

## 🔍 Punto 4: OT caducada — Liberación automática y reasignación (Panel Web AF)

### Objetivo:
Verificar que cuando una orden de trabajo supera las 2 horas sin que el proveedor responda, pasa automáticamente a `Caducada`, queda sin proveedor asignado y disponible para reasignar.

### Pasos de prueba:
1. En el panel web, asigna una incidencia a un proveedor.
2. Simula o espera el vencimiento de 2 horas (o ejecuta la comprobación automática al recargar `/incidents`).
3. **Resultado esperado**:
   - El estado cambia inmediatamente a **"Caducada"** (badge rojo/rosado).
   - El proveedor queda liberado (`Sin proveedor`).
   - En el panel derecho de la incidencia aparece el botón verde **"Reasignar proveedor"**.
   - El historial de actividad registra: *"Sistema caducó por superar tiempo de respuesta (2h)"*.
   - El AF puede seleccionar otro proveedor en el desplegable y pulsar **"Reasignar proveedor"** para asignársela a un nuevo profesional.

---

## 🔍 Punto 5: OT no presentada — Liberación tras 1h post-cita y notificación (Panel Web AF)

### Objetivo:
Verificar que si un profesional acepta una OT, agenda la visita para una hora específica, pero pasa más de 1 hora de esa hora programada sin pulsar *"Ya he llegado"* / *"Iniciar"*, la OT cambia automáticamente a `No presentada`.

### Pasos de prueba:
1. Ten una incidencia en estado **Agendada** con una hora programada que haya pasado hace más de 60 minutos (ej. programada a las 10:00 y son las 11:05) sin haber iniciado la intervención.
2. Consulta o refresca el panel web `/incidents`.
3. **Resultado esperado**:
   - La incidencia pasa automáticamente a estado **"No presentada"** (badge naranja suave).
   - El proveedor queda desvinculado de la OT.
   - En el historial de actividad aparece el evento con punto naranja: *"Sistema no se presentó a la visita (+1h tras hora programada)"*.
   - El AF recibe la notificación push correspondiente.
   - El botón inferior muestra **"Reasignar proveedor"**, permitiendo al AF asignarla nuevamente al mismo o a otro técnico.

---

## 🔍 Punto 6: Eliminación del bloque "Filtro activo" (App Móvil Expo)

### Objetivo:
Comprobar que al pulsar cualquier estado en la barra de Resumen, no se renderiza ningún cuadro intermedio azul de *"Filtro activo: [estado] / Mostrar todas"*.

### Pasos de prueba:
1. Abre la app móvil del proveedor en la pantalla de **Inicio**.
2. Pulsa en la barra superior sobre **Por responder**, **En curso**, **Programadas** o **Finalizadas hoy**.
3. **Resultado esperado**:
   - La lista inferior cambia y filtra los elementos al instante.
   - El botón pulsado queda marcado con fondo verde menta suave (`statColActive`).
   - **No aparece** ningún bloque azul rectangular debajo del buscador que diga *"Filtro activo: ..."*. La interfaz permanece limpia y directa.
   - Al presionar nuevamente la misma opción, el filtro se deselecciona mostrando todas las incidencias.

---

## 📌 Checklist de Aprobación Final

- [ ] **Punto 1**: Filtros funcionan directamente desde *Intervenciones* y *Expiradas*.
- [ ] **Punto 2**: Notificaciones push enviadas al rol correcto en cada fase del ciclo.
- [ ] **Punto 3**: La etiqueta muestra `"Rechazada"`.
- [ ] **Punto 4**: OT caducada pasa a `"Caducada"` y habilita el botón de reasignación.
- [ ] **Punto 5**: OT no presentada pasa a `"No presentada"` (+1h tras cita), se registra en historial y permite reasignar.
- [ ] **Punto 6**: Bloque *"Filtro activo"* completamente removido de la app móvil.
