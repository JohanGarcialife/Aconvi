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
*Objetivo: Guardar físicamente las imágenes subidas por Vecinos y Proveedores.*
- [ ] Elegir y configurar bucket de Storage (ej. AWS S3, Cloudflare R2, o Supabase Storage).
- [ ] Crear ruta de API (Next.js) para emitir URLs prefirmadas (Pre-signed URLs) de subida segura.
- [ ] Refactorizar tRPC mutations para guardar la URL final obtenida del Storage.

## Fase 2: App Móvil - Flujo del Proveedor y Modo Offline
*Objetivo: Interfaz para los trabajadores y robustez frente a mala cobertura (cuartos de contadores, garajes).*
- [ ] **UI Asignaciones:** Pantalla donde el proveedor ve sus incidencias asignadas.
- [ ] **Acciones:** Formulario para introducir presupuesto/tiempo y aceptar trabajo (llama a `providerAccept`).
- [ ] **Modo Offline:** Configurar SQLite o `AsyncStorage` + persistencia de `@tanstack/react-query` para guardar la sesión y datos locales.
- [ ] **Cola de Sincronización:** Detectar red (NetInfo) y enviar peticiones encoladas (ej. `providerComplete` con foto final) de manera silenciosa al recuperar cobertura.

## Fase 3: App Móvil - Flujo del Vecino
*Objetivo: Experiencia rápida y sin fricción para reportar averías.*
- [ ] **Cámara:** Integrar `expo-camera` o `expo-image-picker` para captura de evidencia visual.
- [ ] **Formulario:** Pantalla de reporte (título, descripción, envío).
- [ ] **Categorización (Opcional IA):** Conectar LLM en el backend para auto-clasificar la incidencia basándose en la descripción del vecino.

## Fase 4: Notificaciones Push de Coste Cero
*Objetivo: Avisos en tiempo real sin incurrir en costes de Firebase/SMS.*
- [ ] **Infraestructura:** Integrar APNs (Apple) y Web Push API (Service Workers) a nivel global en el proyecto.
- [ ] **Triggers Backend:** Asegurar que `sendPushToUser` procese los tokens de los dispositivos conectados y dispare los avisos correctos al cambiar un estado.
- [ ] **Deep Linking:** Configurar `expo-router` para abrir directamente la incidencia correcta (`/incidencia/[id]`) al tocar la notificación.

## Fase 5: WebSockets (Dashboard Realtime)
*Objetivo: Evitar refrescos manuales en el Backoffice del Administrador.*
- [ ] Conectar el panel web (cliente React) al servidor de WebSockets en Coolify.
- [ ] Integrar mutaciones tRPC con el bus de eventos en el backend.
- [ ] Actualizar UI dinámicamente (invalidateQueries) al recibir un evento de WebSocket para que las tablas y contadores del sidebar "se muevan solos".
