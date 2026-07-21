# GOOGLE_SHEETS_FORM_SETUP.md

# Puesta en marcha del formulario de inscripción propio

## Objetivo

Documentar el único paso pendiente para que el formulario de inscripción
propio (nombre, email, teléfono) de las actividades guarde cada envío en un
Google Sheet, y cómo activarlo por actividad desde el CMS.

---

# Cómo funciona

`src/components/ActivityRegistrationForm.astro` envía cada inscripción por
POST a un **Google Apps Script Web App** atado a un Google Sheet — no hay
backend propio: el script vive dentro del mismo Sheet y escribe una fila por
cada envío. Todas las actividades comparten el mismo Sheet/script; cada fila
identifica de qué actividad es (columna "Actividad").

Se activa por actividad: en el CMS, el campo **"¿Usar formulario propio en
vez de link externo?"** de esa actividad. Si está activado, la página de
detalle muestra este formulario en vez del botón que linkea a "Link de
inscripción" — nunca ambos a la vez.

---

# Qué ya está listo (código)

- `src/components/ActivityRegistrationForm.astro`: el formulario y el fetch
  que lo envía.
- `src/content.config.ts` / `public/admin/config.yml`: el campo
  `useRegistrationForm` en el CMS.
- `src/pages/actividades/[slug].astro`: elige formulario propio vs. botón
  externo según ese campo.

Falta un solo paso externo: crear el Google Sheet + Apps Script y pegar su
URL en el código (paso 3 de abajo).

---

# Qué falta (acción externa)

## 1. Crear el Google Sheet

1. Ir a [sheets.google.com](https://sheets.google.com/) con la cuenta de
   Google de ATP (`atpcienciasmedicas@gmail.com`).
2. Crear una planilla nueva, nombrarla por ejemplo
   **"Inscripciones a actividades - ATP"**.
3. Renombrar la primera hoja (pestaña de abajo) a **`Inscripciones`**.
4. En la fila 1, cargar estos encabezados, uno por columna:
   `Fecha` | `Actividad` | `Nombre y apellido` | `Email` | `Teléfono`

## 2. Crear el Apps Script

1. En la misma planilla: menú **Extensiones → Apps Script**.
2. Borrar todo el código de ejemplo que aparece (`function myFunction() {...}`).
3. Pegar exactamente este código:

   ```js
   function doPost(e) {
     var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Inscripciones');
     var params = e.parameter;

     sheet.appendRow([
       new Date(),
       params.activityTitle || '',
       params.name || '',
       params.email || '',
       params.phone || '',
     ]);

     return ContentService
       .createTextOutput(JSON.stringify({ result: 'success' }))
       .setMimeType(ContentService.MimeType.JSON);
   }
   ```

4. Arriba a la izquierda, hacer click en "Proyecto sin título" y ponerle un
   nombre, por ejemplo **"Formulario inscripciones ATP"**.
5. Guardar (ícono de disquete o Ctrl+S).

## 3. Publicar el script como "Aplicación web"

1. Arriba a la derecha, botón **Implementar → Nueva implementación**.
2. Al lado de "Selecciona el tipo", el ícono de engranaje → elegir
   **Aplicación web**.
3. Completar:
   - **Ejecutar como**: `Yo` (la cuenta de ATP).
   - **Quién tiene acceso**: `Cualquier usuario`.
4. Botón **Implementar**.
5. Google va a pedir autorizar permisos:
   - Elegir la cuenta de ATP.
   - Puede aparecer una pantalla de advertencia ("Google no verificó esta
     app") porque es un script propio, no publicado — es esperable. Click en
     **Configuración avanzada** (o "Avanzado") → **Ir a "Formulario
     inscripciones ATP" (no seguro)** → **Permitir**.
6. Copiar la **URL de la aplicación web** que aparece (termina en `/exec`).
   Esa es la URL que hay que pegarme para que la cargue en el código — o, si
   preferís hacerlo vos mismo, reemplazar el valor de
   `REGISTRATION_FORM_ENDPOINT` en
   `src/components/ActivityRegistrationForm.astro` por esa URL.

Cada vez que se edite el código del script (paso 2) hay que repetir este
paso 3 como **"Nueva implementación"** para que el cambio tome efecto — Guardar
solo no alcanza.

---

# Verificar que funciona

1. En el CMS, activar **"¿Usar formulario propio...?"** en una actividad de
   prueba.
2. Entrar a esa actividad en el sitio y completar el formulario con datos de
   prueba.
3. Volver al Google Sheet: debería aparecer una fila nueva con esos datos en
   un momento (sin recargar la planilla, F5 si no aparece).
4. Si no aparece nada: revisar que la hoja se llame exactamente
   `Inscripciones` (mayúscula inicial) y que la implementación del paso 3 use
   "Cualquier usuario" en acceso — son los dos motivos más comunes de que el
   script no reciba o no encuentre la hoja.
