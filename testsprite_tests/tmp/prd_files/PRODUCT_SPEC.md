# Documento de Especificación de Producto (PRD) - Aconvi

## 1. Visión General del Proyecto
**Aconvi** es una plataforma integral de gestión de fincas y comunidades de vecinos. Permite la administración transparente de incidencias, comunicación entre vecinos, administradores y proveedores de servicio, así como la gestión de votaciones y avisos comunitarios.

---

## 2. Roles de Usuario
- **Vecino / Residente**: Crea y consulta el estado de sus incidencias, recibe avisos, participa en votaciones y califica el servicio prestado por los proveedores.
- **Proveedor de Servicios / Técnico**: Recibe órdenes de trabajo (OT), acepta/rechaza asignaciones en un tiempo límite, registra su llegada al sitio, sube evidencia fotográfica de cierre y finaliza trabajos.
- **Administrador de Fincas (AF)**: Gestiona el panel web (`https://aconvi.com`), asigna proveedores a las incidencias, valida trabajos resueltos, emite comunicados y cierra expedientes oficiales.

---

## 3. Flujo de Estados de Incidencias
El ciclo de vida de una incidencia consta de 6 estados primarios estrictos:
1. `Sin asignar (RECIBIDA)`: Creada por el vecino.
2. `Asignada (EN_REVISION)`: Asignada a un proveedor por el Administrador.
3. `Agendada (AGENDADA)`: Aceptada por el proveedor dentro del límite de tiempo.
4. `En curso (EN_CURSO)`: El técnico confirma llegada a sitio e inicia la reparación.
5. `Resuelta (RESUELTA)`: Trabajo finalizado por el proveedor con foto y descripción de cierre.
6. `Cerrada (CERRADA)`: Expediente validado y cerrado oficialmente por el Administrador.

---

## 4. Funcionalidades Clave y Requerimientos de Pruebas

### 4.1 Gestión de Incidencias y Registro
- Permite la creación de incidencias especificando título, descripción, categoría y fotografía inicial.
- Visualización de la lista de incidencias filtrada por rol y estado.

### 4.2 Temporizador de Orden de Trabajo (OT)
- Temporizador independiente de 2 horas desde la asignación.
- Si el tiempo expira sin aceptación, la asignación queda deshabilitada y la incidencia regresa a estado `RECIBIDA` para reasignación.

### 4.3 Temporizador de Intervención en Vivo
- Muestra el tiempo transcurrido (`HH:MM:SS`) de la reparación en progreso.
- Debe ser persistente entre bloqueos de pantalla o reinicios de la aplicación.

### 4.4 Valoración y Calificación del Servicio
- Una vez la incidencia está `RESUELTA` o `CERRADA`, el vecino puede enviar una calificación (1 a 5 estrellas) con comentarios.
- El evento se registra en la línea de tiempo sin alterar el estado `CERRADA`.

### 4.5 Notificaciones Push en Tiempo Real
- Notificaciones de alta prioridad enviadas al instante ante cambios de estado, asignación, llegada de técnico, resolución, cierre y comunicados.

---

## 5. Arquitectura Técnica
- **Frontend Web**: Next.js 16, React 19, Tailwind CSS.
- **App Móvil**: Expo (React Native), Expo Router, Tailwind/Native.
- **Backend / API**: tRPC, Drizzle ORM, PostgreSQL.
- **Servicios**: Firebase Cloud Messaging (FCM), WebSockets (Socket.IO).
