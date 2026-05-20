# Roadmap: Flujo de Incidencias Aconvi

Este documento sirve como tracker de avance para completar al 100% el flujo de incidencias estipulado en el documento funcional de Aconvi (incluyendo el modo offline y la trazabilidad multi-rol).

## Estado de la Base de Datos y Backend Core

- [x] Arquitectura de roles en DB (Vecino, Admin, Proveedor, etc.).
- [x] Estados de incidencias configurados (`RECIBIDA`, `EN_REVISION`, `EN_CURSO`, `RESUELTA`, `RECHAZADA`).
- [x] Mutaciones tRPC base (`create`, `updateStatus`, `assignProvider`, `providerAccept`, `providerComplete`).
- [x] Historial de trazabilidad (`incidentHistory`).
- [x] Panel Web: Buscador funcional, filtros y contador global.
- [x] Panel Web: Botones de simulación de proveedor para pruebas End-to-End.

---

## Fase 1: Persistencia de Imágenes y Storage (Backend)

_Objetivo: Guardar físicamente las imágenes subidas por Vecinos y Proveedores._

- [ ] Elegir y configurar bucket de Storage (ej. AWS S3, Cloudflare R2, o Supabase Storage).
- [ ] Crear ruta de API (Next.js) para emitir URLs prefirmadas (Pre-signed URLs) de subida segura.
- [ ] Refactorizar tRPC mutations para guardar la URL final obtenida del Storage.

## Fase 2: App Móvil - Flujo del Proveedor y Modo Offline

_Objetivo: Interfaz para los trabajadores y robustez frente a mala cobertura (cuartos de contadores, garajes)._

- [x] **UI Asignaciones:** Pantalla donde el proveedor ve sus incidencias asignadas (`job/index.tsx`).
- [x] **Acciones:** Formulario para introducir presupuesto/tiempo y aceptar trabajo (`job/estimate.tsx` → llama a `providerAccept`).
- [x] **Modo Offline:** `onlineManager` de React Query conectado globalmente con NetInfo en `api.tsx`. Toda la app pausa/reanuda mutaciones automáticamente según conectividad.
- [x] **Cola de Sincronización:** `estimate.tsx` y `complete.tsx` guardan localmente en `AsyncStorage` cuando no hay red y suben automáticamente al recuperar señal.

## Fase 3: App Móvil - Flujo del Vecino

_Objetivo: Experiencia rápida y sin fricción para reportar averías._

- [x] **Cámara:** Integrado `expo-image-picker` para captura de evidencia visual (cámara + galería).
- [x] **Formulario en 2 pasos:** Paso 1: selector de categoría visual. Paso 2: título opcional, descripción, selector de prioridad (Baja/Media/Alta/Urgente) y foto.
- [x] **Lista de incidencias:** `incidents/index.tsx` muestra todas las incidencias con badge de estado, chip de categoría y colores de prioridad.
- [x] **Detalle de incidencia:** `incidents/[id].tsx` muestra la foto de la avería, el especialista asignado, el timeline de historial completo y el botón de valoración al resolver.
- [ ] **Categorización (Opcional IA):** Conectar LLM en el backend para auto-clasificar la incidencia basándose en la descripción del vecino.

## Fase 4: Notificaciones Push de Coste Cero

_Objetivo: Avisos en tiempo real sin incurrir en costes de Firebase/SMS._

- [ ] **Infraestructura:** Integrar APNs (Apple) y Web Push API (Service Workers) a nivel global en el proyecto.
- [ ] **Triggers Backend:** Asegurar que `sendPushToUser` procese los tokens de los dispositivos conectados y dispare los avisos correctos al cambiar un estado.
- [ ] **Deep Linking:** Configurar `expo-router` para abrir directamente la incidencia correcta (`/incidencia/[id]`) al tocar la notificación.

## Fase 5: WebSockets (Dashboard Realtime)

_Objetivo: Evitar refrescos manuales en el Backoffice del Administrador._

- [ ] Conectar el panel web (cliente React) al servidor de WebSockets en Coolify.
- [ ] Integrar mutaciones tRPC con el bus de eventos en el backend.
- [ ] Actualizar UI dinámicamente (invalidateQueries) al recibir un evento de WebSocket para que las tablas y contadores del sidebar "se muevan solos".
