# Guía Paso a Paso: Verificación de Correcciones del Sistema de Votaciones

Esta guía detalla las pruebas funcionales para comprobar los 6 puntos corregidos del flujo de votaciones tanto en el panel web de administración (`apps/nextjs`) como en la aplicación móvil de vecinos (`apps/expo`).

---

## 0. Prerrequisitos de Entorno

1. **Base de Datos PostgreSQL en el VPS del Cliente**:
   El proyecto está conectado a la base de datos PostgreSQL que corre en el VPS del cliente (`127.0.0.1:5433`). Asegúrate de que el túnel/conexión activa al VPS esté abierta en tu terminal.

2. **Sincronizar Esquema en la BD del VPS**:
   Con la conexión al VPS activa, ejecuta desde la raíz del proyecto:
   ```bash
   pnpm db:push
   ```
   *Esto aplicará de inmediato en el PostgreSQL del VPS la nueva tabla `vote_budget_proposal`, las columnas `voting_override` y `voting_override_reason` en `member`, y las columnas de sincronización de junta en `vote_session` y `vote_item`.*

3. **Iniciar los servidores de desarrollo**:
   - Web Admin:
     ```bash
     pnpm dev:next
     ```
   - App Móvil:
     ```bash
     pnpm expo start
     ```

---

## 1. Verificación: Votaciones Activas y Cerradas (Punto 1)

### A. Cuenta atrás en tiempo real
1. En la app móvil Expo, inicia sesión con un usuario vecino.
2. En la pantalla principal (`(vecino)/index.tsx`), ubica la tarjeta de una votación activa.
3. **Comprobar**:
   - La cabecera muestra el icono de reloj y el contador en formato `XD Xh Xm Xs` o `Xh Xm Xs`.
   - El segundero disminuye en tiempo real cada segundo.
4. Entra al detalle de la votación (`(vecino)/voting.tsx`):
   - **Comprobar**: La cuenta atrás también aparece destacada en la parte superior con fondo de contraste y barra de estado.

### B. Resumen de resultados al cerrarse
1. Desde el panel web de administración (`/votes`), cambia el estado de una votación a `CLOSED` (o espera que finalice su fecha límite).
2. Abre la app móvil o el panel web:
   - **En Admin (`apps/nextjs/src/app/(dashboard)/votes/page.tsx`)**: En la pestaña "Cerradas Recientes", la tarjeta muestra un banner superior: `Resultado Oficial: Aprobado por el 82.5 % de las cuotas` (o rechazado según corresponda).
   - **En Móvil (`(vecino)/voting.tsx`)**: Al abrir una votación cerrada o con voto emitido, la tarjeta muestra el resultado oficial ponderado y el acta oficial. En la pantalla de inicio se preserva el diseño limpio original (sin bloque de decisiones cerradas en Home).
   - **En Web Admin (`apps/nextjs/src/app/(dashboard)/votes/page.tsx`)**: En la pestaña "Cerradas Recientes", la tarjeta muestra el banner superior: `Resultado Oficial: Aprobado por el X % de las cuotas`.

### C. Archivo automático tras 48h
1. Para probar el archivo automático sin esperar 48 horas reales:
   - Puedes invocar el endpoint cron en tu navegador o vía curl:
     ```bash
     curl -X GET http://localhost:3000/api/cron/auto-archive
     ```
2. **Comprobar**:
   - Devuelve `{ "success": true, "archivedCount": X }`.
   - Las votaciones con más de 48h cerradas reciben `archived_at` y se mueven automáticamente a la pestaña "Histórico" en el panel web.

---

## 2. Verificación: Carrusel Horizontal de Votaciones Activas y Botón Oficial (Punto 2)

### A. Carrusel de Votaciones Activas en la App Móvil (Vecino)
1. Con varias votaciones activas en el sistema (por ejemplo, una Junta Extraordinaria y una Votación Individual):
2. Abre la pantalla principal de la app del vecino (`(vecino)/index.tsx`).
3. **Comprobar**:
   - Las votaciones activas **no se muestran apiladas una debajo de otra**, sino en un elegante **carrusel horizontal**.
   - Cada tarjeta ocupa el ancho completo de la pantalla (con márgenes laterales) y se desliza con snap suave.
   - En la parte inferior del carrusel se muestran los indicadores de paginación (dots) sincronizados con la tarjeta activa.

### B. Botón de Acción ("Votar ahora" / "Ver mi voto / Resultados")
1. Observa el botón inferior dentro de cada tarjeta del carrusel:
2. **Comprobar**:
   - Tanto si el vecino no ha votado ("Votar ahora" / "Entrar a votar") como si ya ha votado ("Ver mi voto / Resultados"), el botón tiene el diseño oficial idéntico a la imagen de referencia:
     - Color de fondo: Verde azulado corporativo Aconvi (`#027580`). **No** aparece en color oscuro/negro.
     - Ancho completo de la tarjeta (`width: 100%`).
     - Esquinas redondeadas suaves (`borderRadius: 14`).
     - Texto centrado en blanco con flecha indicadora (`→`).
3. Toca el botón para acceder directamente al detalle de votación o a la pantalla de resultados del acta.

---

## 3. Verificación: Excepción a Morosos con Motivo Escrito (Punto 3)

### A. Otorgar permiso excepcional por el AF
1. Entra al panel web como Administrador de Fincas en `/votes`.
2. Haz clic en el botón superior **"Derechos de Voto"**.
3. Se abrirá el modal interactivo con la lista de vecinos de la comunidad.
4. Localiza a un vecino con recibos pendientes (moroso).
5. Activa el conmutador **"Permitir voto"**:
   - Se desplegará un campo obligatorio: *"Motivo justificado (ej. impugnación judicial en trámite)"*.
   - Escribe el motivo (ejemplo: *"Impugnación judicial en curso - Auto judicial nº 44/2026"*).
   - Haz clic en **"Guardar Excepción"**.

### B. Emisión del voto en la App Móvil
1. Inicia sesión en la app móvil con las credenciales de ese vecino moroso que tiene la excepción activa.
2. Entra a una votación activa:
   - **Comprobar**: No aparece el bloqueo habitual de morosidad; los botones de emisión de voto están habilitados.
   - Emite el voto: **Comprobar**: El voto se registra con éxito en backend sin error `DEBTOR_CANNOT_VOTE`.
3. Vuelve al panel admin, abre "Derechos de Voto" y desactiva la excepción para ese usuario.
4. Intenta votar nuevamente con ese usuario en otra votación:
   - **Comprobar**: El sistema bloquea la votación con el aviso formal de privación de voto conforme a la LPH.

---

## 4. Verificación: Puntos del Orden del Día con Voto Previo vs Presencial (Punto 4)

1. En el panel admin (`/votes`), abre el asistente **"Crear Junta"**.
2. En el paso 2 (Orden del Día), agrega dos puntos:
   - **Punto 1**: *"Aprobación de cuentas anuales 2025"*. Activa la casilla **"Permitir votación online previa a la junta"**.
   - **Punto 2**: *"Ruegos y preguntas / Informe de presidencia"*. Deja la casilla **desactivada** (solo presencial).
3. Guarda la junta.
4. Entra a la app móvil como vecino y abre esta junta:
   - **Comprobar en Punto 1**: Muestra los botones de votación interactivos (*A Favor*, *En Contra*, *Abstención*).
   - **Comprobar en Punto 2**: No muestra botones de voto. Muestra un recuadro informativo con icono gris y el texto:
     `Punto informativo / Votación presencial en junta` - *"Este punto se deliberará y votará presencialmente durante la junta"*.
5. Si un usuario intenta enviar un voto al backend para el Punto 2, el backend lo descarta de forma segura.

---

## 5. Verificación: Presupuestos Comparativos con PDF y Selección Única (Punto 5)

### A. Configuración de Presupuestos
1. En el asistente de "Crear Junta" (o creación de votación), crea un punto del orden del día (ej. *"Reparación e impermeabilización de fachada"*).
2. Haz clic en **"+ Añadir Propuesta de Empresa"** y agrega al menos dos alternativas:
   - Empresa A: *"Rehabilitaciones S.L."* | Importe: `14500` | URL PDF: `https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf`
   - Empresa B: *"Construcciones Norte"* | Importe: `12800` | URL PDF: `https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf`
3. Guarda la votación.

### B. Votación por el Vecino en la App Móvil
1. Abre la votación en la app móvil.
2. Ubica el punto con propuestas presupuestarias:
   - **Comprobar**: Aparecen las tarjetas de ambas empresas con su nombre y el importe formateado en euros (ej. `14.500,00 €`).
   - Cada tarjeta cuenta con un botón **"Ver presupuesto (PDF)"**. Tócalo para verificar que abre el visor de documentos en el dispositivo.
3. Toca sobre una de las empresas:
   - **Comprobar**: Queda seleccionada con el borde azul y el indicador circular marcado. Solo se puede seleccionar **una** empresa a la vez.
4. Emite el voto:
   - En el modal de confirmación, verifica que se resume la empresa elegida. Confirma el voto.

### C. Comprobación del Escrutinio (Resultados)
1. En el panel admin (`/votes`), consulta el desglose de resultados de esa sesión:
   - **Comprobar**: En la sección de resultados del punto, aparece el desglose por cada empresa con el número de votos, coeficiente total y porcentaje alcanzado.

---

## 6. Verificación: Asistente "Crear Junta" Sincronizado (Punto 6)

1. En el panel admin (`/votes`), pulsa en el botón azul **"Crear Junta"**.
2. **Paso 1: Datos de la Junta**:
   - Escribe el título (ej. *"Junta General Ordinaria 2026"*).
   - Selecciona Fecha y hora de 1ª Convocatoria.
   - Selecciona Fecha y hora de 2ª Convocatoria (automáticamente sugerida 30 min después).
   - Escribe el Lugar de celebración (ej. *"Sala comunitaria del edificio"*).
   - Establece la fecha y hora de cierre para los votos telemáticos.
3. **Paso 2: Orden del Día**:
   - Agrega los puntos a tratar, conmutando el voto online en los que aplique.
4. **Paso 3: Convocatoria Formal**:
   - **Comprobar**: El sistema genera en tiempo real el texto formal completo de la citación según el **Artículo 16 de la Ley de Propiedad Horizontal (LPH)**, incluyendo fecha, horas, lugar, lista ordenada de puntos y recordatorio del voto telemático.
   - Prueba el botón **"Copiar Convocatoria"** para verificar que copia el texto al portapapeles.
5. Pulsa en **"Crear y Publicar Junta"**:
   - **Comprobar**: La junta se crea en la base de datos con todos sus campos sincronizados (`meeting_date`, `meeting_location`, `second_call_date`), y queda inmediatamente disponible tanto en la lista de gestión como en la app móvil.

---

## 7. Matriz de Verificación Rápida

| # | Característica | ¿Dónde comprobar? | Criterio de Aceptación |
|---|---|---|---|
| 1 | Cuenta atrás | Expo móvil | Contador en vivo decrementa cada segundo |
| 1 | Resumen resultado | Web & Expo | Tarjeta cerrada muestra "Aprobado por el X% de cuotas" |
| 1 | Archivo >48h | Cron `/api/cron/auto-archive` | Pasa a pestaña "Histórico" tras 48h |
| 2 | Máximo 2 en primer plano | Expo móvil | 2 tarjetas verticales; 3ª o más en carrusel horizontal |
| 2 | Alerta AF >= 2 activas | Web admin `/votes` | Banner amarillo advirtiendo desborde a cola |
| 3 | Excepción morosos | Modal "Derechos de Voto" | Permite votar a moroso solo con motivo escrito guardado |
| 4 | Puntos informativos | Expo móvil | Sin botones de voto; badge "Votación presencial en junta" |
| 5 | Presupuestos con PDF | Expo móvil & Web | Selector único entre empresas, botón de PDF y desglose % |
| 6 | Asistente Junta y LPH | Web admin "Crear Junta" | Generación de convocatoria formal art. 16 LPH sincronizada |
