# GOOGLE_SHEETS_FORM_SETUP.md

# Puesta en marcha del formulario de inscripción propio + mails automáticos

## Objetivo

Documentar el único paso pendiente para que el formulario de inscripción
propio de las actividades guarde cada envío en un Google Sheet, mande un mail
de confirmación al toque, y (si la persona lo pide) un mail recordatorio el
día antes de cada clase.

---

# Cómo funciona

`src/components/ActivityRegistrationForm.astro` envía cada inscripción por
POST a un **Google Apps Script Web App** atado a un Google Sheet — no hay
backend propio: el script vive dentro del mismo Sheet. Todas las actividades
comparten el mismo Sheet/script, pero cada actividad tiene su propia hoja
(pestaña), nombrada igual que la actividad.

Al guardar la fila, el script manda **de una** un mail de confirmación
(marca ATP, en HTML) con el nombre de la persona, la actividad y el
cronograma de clases. Si la persona tildó el checkbox "quiero que me
recuerden por mail el día antes de cada clase", el script también guarda esa
preferencia; un disparador diario (que hay que crear una sola vez, paso 5)
revisa todas las inscripciones y le manda un mail recordatorio a quien tenga
una clase al día siguiente. Todo mail incluye un link de "darme de baja".

El bloque "Próximas actividades de ATP" que aparece al final del mail de
confirmación no está escrito a mano en el script: lo trae en el momento desde
`https://atpfcm.com.ar/actividades-newsletter.json` (generado solo en cada
deploy del sitio, con las actividades destacadas y publicadas) — así se
mantiene solo, sin tener que editar el script cada vez que cambian las
actividades.

Se activa por actividad: en el CMS, el campo **"¿Usar formulario propio en
vez de link externo?"** de esa actividad. Si está activado, la página de
detalle muestra este formulario en vez del botón que linkea a "Link de
inscripción" — nunca ambos a la vez.

---

# Qué ya está listo (código)

- `src/components/ActivityRegistrationForm.astro`: el formulario, el
  checkbox de recordatorio y el fetch que lo envía.
- `src/lib/activitySchedule.ts` (`getReminderSessions`): calcula qué clases
  de la actividad tienen fecha puntual (las únicas que se pueden recordar
  "el día antes") y se las pasa al formulario.
- `src/pages/actividades-newsletter.json.ts`: el endpoint de "próximas
  actividades" que consume el script.
- `src/content.config.ts` / `public/admin/config.yml`: el campo
  `useRegistrationForm` en el CMS.
- `src/pages/actividades/[slug].astro`: elige formulario propio vs. botón
  externo según ese campo.

Falta un solo paso externo: (re)cargar el código nuevo del Apps Script y
crear el disparador diario de recordatorios (pasos 2 y 5 de abajo). Si ya
tenías el script del formulario simple andando, es exactamente el mismo
Google Sheet — solo hay que reemplazar el código.

---

# Qué falta (acción externa)

## 1. El Google Sheet ya existe

Si ya seguiste esta guía antes, es la misma planilla ("Inscripciones a
actividades - ATP") — no hace falta crear nada nuevo acá. Si es la primera
vez: crear una planilla en [sheets.google.com](https://sheets.google.com/)
con la cuenta de ATP (`atpcienciasmedicas@gmail.com`); no hace falta tocar la
primera hoja ni cargar encabezados a mano, el script crea una hoja por
actividad solo.

## 2. Reemplazar el código del Apps Script

1. En la planilla: menú **Extensiones → Apps Script**.
2. Seleccionar todo el código existente (Ctrl+A) y borrarlo.
3. Pegar exactamente este código (todo junto, sin agregar nada antes ni
   después, y sin las comillas de bloque de este mensaje de chat):

   ```js
   // ====== CONFIGURACIÓN ======
   var SENDER_NAME = 'ATP - Ciencias Médicas';
   var PROMO_JSON_URL = 'https://atpfcm.com.ar/actividades-newsletter.json';
   var BRAND_COLOR = '#2e5699';

   // ====== PUNTOS DE ENTRADA ======

   function doPost(e) {
     var params = e.parameter;
     var sheetName = sanitizeSheetName(params.activityTitle || 'Sin actividad');
     var sheet = getOrCreateSheet(sheetName);

     var wantsReminder = params.wantsReminder === 'true';
     var sessions = safeParseJson(params.sessions) || [];

     sheet.appendRow([
       new Date(),
       params.name || '',
       params.email || '',
       params.phone || '',
       wantsReminder,
       false, // Dado de baja
       JSON.stringify(sessions),
       JSON.stringify([]), // Recordatorios ya enviados
     ]);

     try {
       sendConfirmationEmail(params.email, params.name, params.activityTitle, sessions, sheetName);
     } catch (err) {
       // Si falla el mail no revertimos el guardado: la inscripción ya
       // quedó en la planilla, que es lo importante.
     }

     return ContentService
       .createTextOutput(JSON.stringify({ result: 'success' }))
       .setMimeType(ContentService.MimeType.JSON);
   }

   function doGet(e) {
     if (e.parameter.action === 'unsubscribe') {
       return handleUnsubscribe(e.parameter.sheet, e.parameter.email);
     }
     return HtmlService.createHtmlOutput('ATP');
   }

   // ====== RECORDATORIOS (correr sendReminders con un disparador diario) ======

   function sendReminders() {
     var tomorrow = getTomorrowDateString();
     var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();

     sheets.forEach(function (sheet) {
       var data = sheet.getDataRange().getValues();
       for (var i = 1; i < data.length; i++) {
         var row = data[i];
         var name = row[1];
         var email = row[2];
         var wantsReminder = row[4] === true;
         var unsubscribed = row[5] === true;
         if (!wantsReminder || unsubscribed || !email) continue;

         var sessions = safeParseJson(row[6]) || [];
         var alreadySent = safeParseJson(row[7]) || [];

         var tomorrowSessions = sessions.filter(function (session) {
           var key = session.date + '|' + session.title;
           return session.date === tomorrow && alreadySent.indexOf(key) === -1;
         });

         if (tomorrowSessions.length === 0) continue;

         try {
           sendReminderEmail(email, name, sheet.getName(), tomorrowSessions);
           tomorrowSessions.forEach(function (session) {
             alreadySent.push(session.date + '|' + session.title);
           });
           sheet.getRange(i + 1, 8).setValue(JSON.stringify(alreadySent));
         } catch (err) {
           // seguir con las demás filas aunque una falle
         }
       }
     });
   }

   function getTomorrowDateString() {
     var now = new Date();
     var tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
     var y = tomorrow.getFullYear();
     var m = String(tomorrow.getMonth() + 1);
     var d = String(tomorrow.getDate());
     if (m.length < 2) m = '0' + m;
     if (d.length < 2) d = '0' + d;
     return y + '-' + m + '-' + d;
   }

   // ====== DARSE DE BAJA ======

   function handleUnsubscribe(sheetName, email) {
     var sheet = sheetName ? SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName) : null;
     if (sheet && email) {
       var data = sheet.getDataRange().getValues();
       for (var i = 1; i < data.length; i++) {
         if (String(data[i][2]).toLowerCase() === String(email).toLowerCase()) {
           sheet.getRange(i + 1, 6).setValue(true); // columna F: Dado de baja
         }
       }
     }
     return HtmlService.createHtmlOutput(
       '<div style="font-family:Arial,sans-serif;max-width:480px;margin:60px auto;text-align:center;color:' + BRAND_COLOR + ';">' +
       '<h1 style="font-size:20px;">Listo, te diste de baja</h1>' +
       '<p style="color:#555;">No vas a recibir más mails de ATP para esta actividad.</p>' +
       '</div>'
     );
   }

   // ====== MAILS ======

   function sendConfirmationEmail(email, name, activityTitle, sessions, sheetName) {
     if (!email) return;
     var unsubscribeUrl = buildUnsubscribeUrl(sheetName, email);
     var body = buildConfirmationBody(name, activityTitle, sessions);
     var html = wrapEmailHtml(body, unsubscribeUrl);

     GmailApp.sendEmail(email, 'Te anotaste a ' + activityTitle + ' — ATP', '', {
       htmlBody: html,
       name: SENDER_NAME,
     });
   }

   function sendReminderEmail(email, name, sheetName, sessions) {
     var unsubscribeUrl = buildUnsubscribeUrl(sheetName, email);
     var body = buildReminderBody(name, sessions);
     var html = wrapEmailHtml(body, unsubscribeUrl);

     GmailApp.sendEmail(email, 'Mañana: ' + sheetName + ' — ATP', '', {
       htmlBody: html,
       name: SENDER_NAME,
     });
   }

   function buildConfirmationBody(name, activityTitle, sessions) {
     var greeting =
       '<p>Hola ' + (name || '') + ',</p>' +
       '<p><strong>Te anotaste a "' + activityTitle + '"</strong> — ¡te esperamos!</p>';

     var sessionsHtml = '';
     if (sessions.length > 0) {
       var rows = sessions.map(function (session) {
         var when = formatDateEs(session.date);
         var time = formatTimeRangeEs(session.time, session.endTime);
         var line = [when, time, session.location].filter(Boolean).join(' · ');
         return (
           '<tr><td style="padding:10px 0;border-bottom:1px solid #eeeeee;">' +
           '<div style="font-weight:600;">' + session.title + '</div>' +
           '<div style="color:#555555;font-size:14px;margin-top:2px;">' + line + '</div>' +
           '</td></tr>'
         );
       }).join('');
       sessionsHtml = '<table style="width:100%;border-collapse:collapse;margin-top:16px;">' + rows + '</table>';
     }

     return greeting + sessionsHtml + getPromoActivitiesHtml();
   }

   function buildReminderBody(name, sessions) {
     var greeting = '<p>Hola ' + (name || '') + ',</p><p><strong>Te esperamos mañana:</strong></p>';

     var rows = sessions.map(function (session) {
       var time = formatTimeRangeEs(session.time, session.endTime);
       var line = [time, session.location].filter(Boolean).join(' · ');
       return (
         '<tr><td style="padding:10px 0;border-bottom:1px solid #eeeeee;">' +
         '<div style="font-weight:600;">' + session.title + '</div>' +
         '<div style="color:#555555;font-size:14px;margin-top:2px;">' + line + '</div>' +
         '</td></tr>'
       );
     }).join('');

     return greeting + '<table style="width:100%;border-collapse:collapse;margin-top:8px;">' + rows + '</table>';
   }

   function wrapEmailHtml(bodyHtml, unsubscribeUrl) {
     return (
       '<div style="background:#f4f4f7;padding:24px 0;font-family:Arial,Helvetica,sans-serif;">' +
       '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">' +
       '<div style="background:' + BRAND_COLOR + ';padding:24px;text-align:center;">' +
       '<span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:0.5px;">ATP</span>' +
       '<div style="color:#ffffff;opacity:0.85;font-size:13px;margin-top:4px;">Agrupación estudiantil · Facultad de Ciencias Médicas (UNR)</div>' +
       '</div>' +
       '<div style="padding:32px 28px;color:#222222;font-size:15px;line-height:1.6;">' + bodyHtml + '</div>' +
       '<div style="padding:20px 28px;border-top:1px solid #eeeeee;color:#999999;font-size:12px;text-align:center;">' +
       'ATP · Facultad de Ciencias Médicas, UNR<br>' +
       '<a href="' + unsubscribeUrl + '" style="color:#999999;">Darme de baja de estos mails</a>' +
       '</div>' +
       '</div>' +
       '</div>'
     );
   }

   function getPromoActivitiesHtml() {
     try {
       var response = UrlFetchApp.fetch(PROMO_JSON_URL, { muteHttpExceptions: true });
       var json = JSON.parse(response.getContentText());
       var activities = json.activities || [];
       if (activities.length === 0) return '';

       var items = activities.map(function (activity) {
         return (
           '<tr><td style="padding:8px 0;border-bottom:1px solid #e5e5e5;">' +
           '<a href="' + activity.url + '" style="color:' + BRAND_COLOR + ';font-weight:600;text-decoration:none;">' + activity.title + '</a>' +
           '<div style="color:#666666;font-size:13px;margin-top:4px;">' + activity.summary + '</div>' +
           '</td></tr>'
         );
       }).join('');

       return (
         '<h3 style="color:' + BRAND_COLOR + ';font-size:16px;margin:32px 0 12px;">Próximas actividades de ATP</h3>' +
         '<table style="width:100%;border-collapse:collapse;">' + items + '</table>'
       );
     } catch (err) {
       return '';
     }
   }

   // ====== UTILIDADES ======

   var WEEKDAY_NAMES_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
   var MONTH_NAMES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

   function formatDateEs(dateStr) {
     var parts = dateStr.split('-');
     var year = Number(parts[0]);
     var month = Number(parts[1]) - 1;
     var day = Number(parts[2]);
     var date = new Date(year, month, day);
     return WEEKDAY_NAMES_ES[date.getDay()] + ' ' + day + ' de ' + MONTH_NAMES_ES[month];
   }

   function formatTimeRangeEs(time, endTime) {
     if (time && endTime) return time + ' a ' + endTime + 'hs';
     if (time) return time + 'hs';
     return '';
   }

   function buildUnsubscribeUrl(sheetName, email) {
     return ScriptApp.getService().getUrl() + '?action=unsubscribe&sheet=' + encodeURIComponent(sheetName) + '&email=' + encodeURIComponent(email);
   }

   function getOrCreateSheet(sheetName) {
     var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
     var sheet = spreadsheet.getSheetByName(sheetName);
     if (!sheet) {
       sheet = spreadsheet.insertSheet(sheetName);
       sheet.appendRow([
         'Fecha', 'Nombre y apellido', 'Email', 'Teléfono',
         'Quiere recordatorio', 'Dado de baja', 'Sessions', 'Recordatorios enviados',
       ]);
     }
     return sheet;
   }

   function sanitizeSheetName(name) {
     return name.replace(/[:\\\/\?\*\[\]]/g, '').substring(0, 100);
   }

   function safeParseJson(text) {
     try {
       return JSON.parse(text);
     } catch (err) {
       return null;
     }
   }

   // ====== PROBAR SIN USAR EL SITIO ======

   function testDoPost() {
     var fakeEvent = {
       parameter: {
         activityId: 'test',
         activityTitle: 'Prueba',
         name: 'Test Nombre',
         email: 'test@test.com',
         phone: '123456789',
         wantsReminder: 'true',
         sessions: JSON.stringify([
           { title: 'Clase de prueba', date: getTomorrowDateString(), time: '18:00', endTime: '20:00', location: 'Aula 1' },
         ]),
       },
     };
     doPost(fakeEvent);
   }

   function testSendReminders() {
     sendReminders();
   }
   ```

4. Guardar (Ctrl+S).

## 3. Poner el huso horario del proyecto en Argentina

Esto es lo que hace que "mañana" se calcule bien para los recordatorios.

1. En el editor, ícono de tuerca (**Configuración del proyecto**) en el menú
   de la izquierda.
2. Bajo **Zona horaria**, elegir **(GMT-03:00) Argentina Standard Time -
   America/Argentina/Buenos_Aires**.

## 4. Publicar el script como "Aplicación web"

1. Arriba a la derecha, botón **Implementar → Administrar implementaciones**.
2. Si ya existe una implementación (de la versión anterior del script):
   ícono de lápiz → en **Versión** elegir **Nueva versión** → **Implementar**.
   Si es la primera vez: **Implementar → Nueva implementación** → ícono de
   engranaje → **Aplicación web** → **Ejecutar como**: `Yo` → **Quién tiene
   acceso**: `Cualquier usuario` → **Implementar**.
3. Puede volver a pedir autorizar permisos (pantalla de "Google no verificó
   esta app") — aceptar igual: **Configuración avanzada** → **Ir a "..."
   (no seguro)** → **Permitir**.
4. Si es la primera vez, copiar la **URL de la aplicación web** (termina en
   `/exec`) y pegámela para que la cargue en el código — o reemplazar vos
   mismo `REGISTRATION_FORM_ENDPOINT` en
   `src/components/ActivityRegistrationForm.astro`. Si ya la habías cargado
   antes, esta URL **no cambia** al actualizar la implementación a una
   versión nueva, así que no hay nada que tocar del lado del sitio.

## 5. Crear el disparador diario de recordatorios

1. En el editor, ícono del reloj (**Activadores**) en el menú de la
   izquierda.
2. **+ Añadir activador** (abajo a la derecha).
3. Completar:
   - **Función a ejecutar**: `sendReminders`.
   - **Origen del evento**: `Basado en tiempo`.
   - **Tipo de activador basado en tiempo**: `Temporizador diario`.
   - **Intervalo de tiempo**: por ejemplo `9 a 10` (corre una vez por día en
     esa franja horaria).
4. Guardar. Puede pedir autorizar permisos de nuevo — aceptar igual.

Con esto ya queda corriendo solo, todos los días, sin que haga falta volver a
tocar nada.

---

# Si ya tenías una pestaña de una actividad de antes

Los encabezados de una pestaña que ya existía (creada con la versión vieja
del script) tienen solo 4 columnas (Fecha, Nombre y apellido, Email,
Teléfono). El script nuevo sigue funcionando igual con esas pestañas — solo
que las etiquetas de las columnas E-H (Quiere recordatorio, Dado de baja,
Sessions, Recordatorios enviados) no van a estar escritas en la fila 1. Es
puramente estético: si querés, agregalas a mano en esa fila; si no, no
rompe nada.

---

# Verificar que funciona

1. En el CMS, activar **"¿Usar formulario propio...?"** en una actividad de
   prueba que tenga al menos una clase con fecha puntual cargada (para que
   aparezca el checkbox de recordatorio).
2. Entrar a esa actividad en el sitio, completar el formulario con un mail
   real tuyo, tildar el checkbox de recordatorio, y enviar.
3. Revisar esa casilla de mail: debería llegar el mail de confirmación
   (revisar también Spam/Promociones las primeras veces).
4. En el editor de Apps Script, elegir `testSendReminders` en el desplegable
   de funciones y **Ejecutar** — si hay alguna inscripción con clase mañana
   y recordatorio activado, debería llegar el mail recordatorio al toque
   (no hace falta esperar al disparador diario para probarlo).
5. Si algo no llega: revisar el **Registro de ejecución** (ícono del reloj
   con flecha, o `Ver → Registros`) del editor para ver el error exacto.

---

# Límites a tener en cuenta

- Una cuenta de Gmail común (no Workspace) puede mandar **hasta 100 mails
  por día** vía Apps Script. Para el volumen de una organización estudiantil
  alcanza de sobra, pero si algún día se satura, la alternativa es migrar la
  cuenta a Google Workspace (sube el límite a 1500/día).
- El link de "darme de baja" es un botón visible dentro del mail (no el
  header técnico `List-Unsubscribe` que Gmail/Outlook reconocen como
  "unsubscribe nativo") — funciona igual para la persona, pero Gmail/Outlook
  no le agregan su propio botón arriba del mail.
