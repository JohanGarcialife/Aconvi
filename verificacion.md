# Guía Paso a Paso para Verificar las Correcciones

Sigue estos pasos en tu entorno local para confirmar que los 5 fallos reportados han sido corregidos.

---

## 1. Foto de Vecino (Verificación)
* **Acción**:
  1. Entra al panel web local: [http://localhost:3000/incidents](http://localhost:3000/incidents).
  2. Crea una nueva incidencia desde la app móvil (ej: "Instalaciones: Prueba4") adjuntando una foto.
  3. En el panel web local, selecciona la incidencia y asígnala al proveedor **Pedro Martínez** (`proveedor@test.aconvi.com`).
  4. Inicia sesión como proveedor en la app móvil.
  5. Abre la incidencia asignada.
* **Resultado Esperado**: La foto enviada por el vecino se visualiza correctamente en la parte superior, justo arriba del botón **"ACEPTAR Y AVISAR"** (como se ve en la captura de pantalla).

---

## 2. Teclado y Botón (Verificación)
* **Acción**:
  1. En la app móvil del proveedor, pulsa el botón **"ACEPTAR Y AVISAR"**.
  2. Avanza en el flujo de la incidencia hasta llegar a la pantalla final **"Cerrar trabajo"**.
  3. Pulsa sobre el campo de texto de **"Notas"** para activar el teclado.
* **Resultado Esperado**: El teclado del dispositivo se despliega, la pantalla hace scroll automático hacia arriba de manera limpia (`KeyboardAvoidingView`), y el botón **"Marcar como finalizado"** permanece completamente visible, accesible y no queda cubierto.

---

## 3. Error JSON Parse al finalizar (Verificación)
* **Acción**:
  1. En la misma pantalla **"Cerrar trabajo"**, selecciona una foto desde la cámara o galería.
  2. Escribe una nota de texto en el campo.
  3. Presiona el botón **"Marcar como finalizado"**.
* **Resultado Esperado**: La foto se sube correctamente al servidor sin disparar la alerta `"JSON Parse error: Unexpected character..."`, el flujo finaliza con éxito y se te redirige a la pantalla de confirmación.

---

## 4. Link del Panel Administrador (Verificación)
* **Acción**:
  1. Ve a tu navegador en el panel de administración: [http://localhost:3000/incidents](http://localhost:3000/incidents).
  2. Haz clic en la pestaña **"Resueltas"**.
  3. Selecciona la incidencia que acabas de finalizar.
  4. Haz clic en el botón **"Validar"** o **"Revisar y cerrar expediente"**.
* **Resultado Esperado**: Se debe abrir la ruta de validación en la URL:
  `http://localhost:3000/incidents/validate?incidentId=<ID-DE-LA-INCIDENCIA>`
  y cargar la pantalla correspondiente correctamente (sin mostrar error 404).

---

## 5. Estado "Cerrada" en Barra de Progreso (Verificación)
* **Acción**:
  1. En la pantalla de validación en el navegador, marca la casilla de confirmación.
  2. Haz clic en el botón **"Validar trabajo y cerrar expediente"**.
* **Resultado Esperado**: El estado de la incidencia cambia a **Cerrada**. La barra de progreso (Timeline) del panel web muestra el paso **Cerrada (6)** relleno en color verde y con un icono de check ✅.
