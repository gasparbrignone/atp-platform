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

Cada actividad puede tener, además, un mensaje puntual propio (campos
"Mensaje después de inscribirse" / "Texto del botón" / "Link del botón" en
el CMS) — pensado para el link de una clase virtual (Meet/Zoom) o cualquier
aviso que solo aplique a esa actividad. Si está cargado, apenas la persona
se inscribe el formulario se reemplaza por una tarjeta fija con ese mensaje
(no un toast: así puede volver a leerlo con calma), y el mismo mensaje viaja
también en el mail de confirmación.

Los recordatorios no se basan en una foto congelada del día de la
inscripción: cada corrida diaria de `sendReminders` primero consulta
`https://atpfcm.com.ar/actividades-sessions.json` (generado en cada deploy
del sitio, con el cronograma vigente de cada actividad publicada) y lo usa
como fuente de verdad. Si editás la fecha/hora/lugar de una actividad en el
CMS, el próximo recordatorio ya sale con el dato nuevo. Si borrás la
actividad o la despublicás, se dejan de mandar recordatorios para ella — sin
que haga falta tocar la planilla a mano. Si por algún motivo ese archivo no
se puede leer (sin red, deploy caído), el script usa como respaldo la foto
guardada en la planilla en vez de no mandar nada ese día.

Si una actividad se reprograma (cambia de fecha, lugar, o se cancela), la
planilla tiene un menú propio, **ATP → "Reprogramar esta actividad (mail a
inscriptos)"**: abrís la pestaña de esa actividad, elegís esa opción del
menú, escribís el mensaje ("Pasamos la clase al viernes 22/8 a las 18hs,
mismo lugar.") y se manda por mail a todos los inscriptos de esa pestaña que
no se dieron de baja. No actualiza nada del sitio — si la fecha visible en
`atpfcm.com.ar` también tiene que cambiar, eso se edita aparte en el CMS,
como cualquier otro dato de la actividad.

Para charlas/capacitaciones que emiten certificado, activá además
**"¿Recolectar datos completos para certificado + QR de acceso?"** en el CMS.
En vez del formulario simple, la persona completa nombre, apellido, DNI,
teléfono, email, carrera y año, confirma en una pantalla de revisión que
esos datos están bien (el certificado se emite tal cual), y recibe un QR de
acceso — en pantalla (para capturar) y por mail. Ese QR es lo que el staff
escanea el día del evento en `atpfcm.com.ar/staff/escanear/` (con la clave
`STAFF_CHECKIN_SECRET` de este script) para tomar asistencia: cada escaneo
marca presente al toque, sin tocar nada más, y avisa si esa persona ya
había sido escaneada para ese mismo encuentro (una actividad puede tener
más de un encuentro — el staff tipea el nombre del encuentro una sola vez
al empezar a escanear, ej. "Encuentro 1", y eso es lo que queda guardado
junto con cada asistencia).

Como cualquier Web App público de Apps Script, este endpoint lo puede
invocar cualquiera (no solo el sitio) — el script tiene varias protecciones
para eso, salidas de las auditorías de seguridad de agosto y septiembre de
2026: un freno de envíos por email/global (`isRateLimited`), todo campo que
un formulario manda se **escapa** antes de meterlo en el HTML de un mail
(`escapeHtml`, evita que alguien use el campo "actividad" o "nombre" para
inyectar un link/botón falso en un mail que sale con el remitente real de
ATP), el link de "darme de baja" va **firmado** (`signUnsubscribe`) para
que no se pueda dar de baja a otra persona sabiendo solo su email, y los 3
formularios que postean acá (inscripción simple, charla con certificado,
agenda) están protegidos por **Cloudflare Turnstile** (`verifyTurnstile`) —
un script que le pegue directo a este endpoint sin pasar por un navegador
real resolviendo el widget nunca va a tener un token válido.

El bloque "Próximas actividades de ATP" que aparece al final del mail de
confirmación no está escrito a mano en el script: lo trae en el momento desde
`https://atpfcm.com.ar/actividades-newsletter.json` (generado solo en cada
deploy del sitio, con las actividades destacadas y publicadas) — así se
mantiene solo, sin tener que editar el script cada vez que cambian las
actividades. `https://atpfcm.com.ar/actividades-sessions.json` es el mismo
tipo de archivo pero para los recordatorios (ver más arriba y la sección de
recordatorios abajo).

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
- `src/pages/actividades-sessions.json.ts`: el endpoint con el cronograma
  vigente de cada actividad, que consume `sendReminders` para no recordar
  actividades borradas/despublicadas y reflejar ediciones de fecha/hora.
- `src/content.config.ts` / `public/admin/config.yml`: los campos
  `useRegistrationForm`, `confirmationMessage`, `confirmationLinkLabel`,
  `confirmationLinkUrl` y `collectCertificateData` en el CMS.
- `src/pages/actividades/[slug].astro`: elige formulario propio, formulario
  de charla con certificado, o botón externo, según esos campos.
- `src/components/ActivityCertificateRegistrationForm.astro`: el formulario
  de charla/capacitación (datos completos, revisión antes de enviar, QR de
  acceso generado en el navegador con la librería `qrcode`).
- `src/pages/staff/escanear.astro`: la herramienta de check-in (cámara +
  librería `jsqr`, sin login, protegida por la clave `STAFF_CHECKIN_SECRET`
  del script).
- `src/lib/turnstile.ts` + el widget de Cloudflare Turnstile en los 3
  formularios (`ActivityRegistrationForm.astro`,
  `ActivityCertificateRegistrationForm.astro`, `AgendaSaleSection.astro`):
  anti-bot, la Site Key pública vive en `src/config/site.ts`.
- `src/pages/staff/index.astro`: hub con acceso a las herramientas de
  staff (`/staff/escanear/`, `/staff/panel/`).
- `src/pages/staff/panel.astro` + `src/lib/jsonp.ts`: panel admin — login
  con contraseña + código de Google Authenticator (TOTP), ver quiénes se
  inscribieron a una actividad, y mandarles una campaña de mail con
  etiquetas `<nombre>`/`<apellido>`/`<email>`. Ver "Configurar el panel
  admin" más abajo — es el único de todos estos pasos que además requiere
  cargar un código en tu celular, no solo pegar código en el script.

Falta un solo paso externo: (re)cargar el código nuevo del Apps Script,
**cambiar `STAFF_CHECKIN_SECRET`, `UNSUBSCRIBE_SECRET`,
`TURNSTILE_SECRET_KEY`, `ADMIN_PASSWORD` y `ADMIN_TOTP_SECRET` por valores
propios** antes de publicarlo (la Secret Key de Turnstile es la que
Cloudflare te dio al crear el widget en Turnstile → tu sitio — no la Site
Key, esa va en el código, no acá), y crear el disparador diario de
recordatorios (pasos 2 y 5 de abajo). Si ya tenías el script del
formulario simple andando, es exactamente el mismo Google Sheet — solo hay
que reemplazar el código.

**Si cambiás `UNSUBSCRIBE_SECRET` después de que ya salieron mails con el
link viejo:** esos links de "darme de baja" van a dejar de funcionar (van a
mostrar "Este link no es válido"), porque la firma se calcula con la clave
que esté puesta en ese momento. No pasa nada grave — la persona puede
escribirle a ATP para darse de baja a mano — pero por eso conviene fijar
esta clave una vez y no andar cambiándola sin necesidad.

**Si ya tenías el script cargado de antes:** el mensaje puntual por
actividad (`confirmationMessage`/`confirmationLinkLabel`/
`confirmationLinkUrl`) no va a viajar en el mail de confirmación hasta que
vuelvas a pegar el código del paso 2 (versión actualizada más abajo) y
publiques una nueva versión de la implementación (paso 4, "Nueva versión").
En el sitio ya funciona igual (la tarjeta que reemplaza el formulario no
depende del script) — lo único que falta actualizar es el mail.

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
   var ACTIVE_SESSIONS_JSON_URL = 'https://atpfcm.com.ar/actividades-sessions.json';
   var SITE_URL = 'https://atpfcm.com.ar';
   var BRAND_COLOR = '#2e5699';
   var ACCENT_COLOR = '#c6299e';

   // Venta puntual de la agenda ATP (2do cuatrimestre 2026) — ver
   // src/components/AgendaSaleSection.astro. Cuando termine la venta, este
   // bloque y esa sección se pueden borrar juntos.
   var AGENDA_PRICE = 3500;
   var AGENDA_ALIAS = 'ATP.FCM';
   var AGENDA_WHATSAPP = '5493406404841';
   var AGENDA_SHEET_NAME = 'Reserva Agenda 2C 2026';

   // Charlas/capacitaciones con certificado + QR de acceso (ver
   // ActivityCertificateRegistrationForm.astro y src/pages/staff/escanear.astro).
   // CAMBIAR este valor por una clave propia antes de publicar el script —
   // es lo único que protege /staff/escanear/: quien no la sepa no puede
   // marcar a nadie como presente aunque encuentre esa URL.
   var STAFF_CHECKIN_SECRET = 'CAMBIAR-ESTA-CLAVE';

   // Firma el link de "darme de baja" para que nadie pueda dar de baja a
   // otra persona adivinando su email + el nombre de una hoja (ver
   // handleUnsubscribe). CAMBIAR también este valor por uno propio.
   var UNSUBSCRIBE_SECRET = 'CAMBIAR-ESTA-OTRA-CLAVE';

   // Secret Key de Cloudflare Turnstile (anti-bot en los 3 formularios que
   // postean acá — inscripción simple, charla con certificado, agenda) —
   // ver verifyTurnstile() más abajo. CAMBIAR por la Secret Key real de tu
   // widget (Cloudflare → Turnstile → tu sitio). Nunca la Site Key acá:
   // esa es la pública, va en el código del sitio (src/config/site.ts).
   var TURNSTILE_SECRET_KEY = 'CAMBIAR-ESTA-CLAVE-DE-TURNSTILE';

   // Panel admin (src/pages/staff/panel.astro): login con contraseña +
   // código de Google Authenticator. CAMBIAR los dos antes de publicar —
   // ADMIN_TOTP_SECRET es un secreto en formato base32, el mismo que se
   // carga en la app de Authenticator (ver la sección del panel en este
   // doc para generarlo). Ninguno de los dos debe quedar con el valor de
   // ejemplo.
   var ADMIN_PASSWORD = 'CAMBIAR-ESTA-CLAVE-DE-ADMIN';
   var ADMIN_TOTP_SECRET = 'CAMBIAR-ESTE-SECRETO-BASE32';

   // Pestaña donde queda el historial de campañas realmente enviadas
   // (fecha, hoja, asunto, cuántos de cuántos) — ver logCampaignSent().
   // Nunca es una hoja de inscripciones, así que getEligibleActivitySheet
   // ya la excluye sola (no tiene columna "Email").
   var CAMPAIGNS_LOG_SHEET_NAME = 'Campañas enviadas';

   // ====== PUNTOS DE ENTRADA ======

   function doPost(e) {
     try {
       var params = e.parameter;

       // Login del panel admin: la contraseña y el código de Authenticator
       // viajan acá, en el body de un POST, y en ningún otro lado — nunca
       // en una URL (a diferencia de la versión anterior de este script).
       // Esta rama no puede pasar por isValidAdminSession (todavía no hay
       // sesión: es justamente cómo se consigue una) ni por el freno de
       // spam pensado para los formularios públicos — tiene el suyo propio
       // (rl_admin_login_fail, dentro de handleAdminLoginAttempt). El
       // resultado se recoge aparte con adminLoginPoll (GET/JSONP, ver
       // doGet) porque este POST no tiene forma de devolver una respuesta
       // legible del lado del navegador.
       if (params.action === 'adminLoginAttempt') {
         return handleAdminLoginAttempt(params);
       }

       // Panel admin: solo prepara el mail de campaña en el cache (un
       // cuerpo de mail puede ser más largo de lo que entra en una URL de
       // GET) — la vista previa y el envío real pasan por
       // adminPreviewCampaign/adminSendCampaign (GET, JSONP, ver doGet). Va
       // primero y aparte de todo lo demás: ya está protegido por la sesión
       // de admin (isValidAdminSession, dentro de handleAdminStageCampaign)
       // — no tiene sentido pasarlo además por el freno de spam o
       // Turnstile, pensados para los formularios públicos, no para esto.
       if (params.action === 'adminStageCampaign') {
         return handleAdminStageCampaign(params);
       }

       // Freno básico de spam/abuso: máximo 5 envíos por email por hora, y
       // 40 en total cada 10 minutos entre todo el mundo — ver
       // isRateLimited(). No es infalible (alguien puede rotar de email),
       // pero corta cualquier script que golpee el endpoint en loop.
       if (isRateLimited('rl_email_' + String(params.email || 'sin-email').toLowerCase(), 5, 3600) ||
           isRateLimited('rl_global', 40, 600)) {
         return ContentService
           .createTextOutput(JSON.stringify({ result: 'rate_limited' }))
           .setMimeType(ContentService.MimeType.JSON);
       }

       // Anti-bot: un script que le pegue directo a este endpoint (sin pasar
       // por un navegador real resolviendo el widget de Turnstile) nunca va
       // a tener un token válido acá — se corta antes de guardar nada.
       var turnstileCheck = verifyTurnstile(params['cf-turnstile-response']);
       if (!turnstileCheck.success) {
         logError('turnstile', new Error('Rechazado: ' + turnstileCheck.errorCodes.join(', ')), params);
         return ContentService
           .createTextOutput(JSON.stringify({ result: 'error' }))
           .setMimeType(ContentService.MimeType.JSON);
       }

       // La reserva de la agenda no es una inscripción a actividad — mismo
       // Web App, mismo Sheet, pero una rama y una hoja completamente
       // aparte (ver AgendaSaleSection.astro, que manda `formType=agenda`).
       if (params.formType === 'agenda') {
         return handleAgendaReservation(params);
       }

       // Charla/capacitación con certificado: otra rama y otra hoja aparte
       // (columnas distintas — DNI, carrera, año, QR — ver
       // ActivityCertificateRegistrationForm.astro, que manda `formType=charla`).
       if (params.formType === 'charla') {
         return handleCharlaRegistration(params);
       }

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
         params.activityId || '',
       ]);

       try {
         sendConfirmationEmail(
           params.email,
           params.name,
           params.activityTitle,
           params.activityId,
           sessions,
           sheetName,
           params.confirmationMessage,
           params.confirmationLinkLabel,
           params.confirmationLinkUrl
         );
       } catch (mailErr) {
         // Si falla el mail no revertimos el guardado: la inscripción ya
         // quedó en la planilla, que es lo importante. Igual queda
         // registrado en la pestaña "Errores" para poder revisarlo.
         logError('mail', mailErr, params);
       }

       return ContentService
         .createTextOutput(JSON.stringify({ result: 'success' }))
         .setMimeType(ContentService.MimeType.JSON);
     } catch (err) {
       // La interfaz de "Ejecuciones" de Apps Script no siempre muestra el
       // texto del error cuando lo dispara un pedido real (Aplicación web) en
       // vez del editor — por eso, además, lo guardamos nosotros mismos acá.
       logError('doPost', err, e && e.parameter);
       return ContentService
         .createTextOutput(JSON.stringify({ result: 'error' }))
         .setMimeType(ContentService.MimeType.JSON);
     }
   }

   function logError(context, err, params) {
     try {
       var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Errores');
       if (!sheet) {
         sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Errores');
         sheet.appendRow(['Fecha', 'Dónde', 'Error', 'Datos']);
       }
       sheet.appendRow([
         new Date(),
         context,
         String(err && err.message ? err.message : err),
         JSON.stringify(params || {}),
       ]);
     } catch (loggingErr) {
       // Si ni guardar el error funciona, no hay nada más que hacer acá.
     }
   }

   function doGet(e) {
     if (e.parameter.action === 'unsubscribe') {
       return handleUnsubscribe(e.parameter.sheet, e.parameter.email, e.parameter.sig);
     }
     // JSONP, no una respuesta JSON común: un Web App de Apps Script no manda
     // headers CORS, así que un `fetch` normal del navegador no puede leer la
     // respuesta — src/pages/staff/escanear.astro pide esto con un <script>
     // (callback=nombreDeFunción), que no está sujeto a CORS.
     if (e.parameter.action === 'checkin') {
       return handleCheckin(e.parameter);
     }
     // Panel admin (src/pages/staff/panel.astro) — igual que checkin, vía
     // JSONP porque hace falta leer la respuesta real (lista de
     // inscriptos, vista previa, confirmación de envío), no solo saber que
     // "no hubo error de red".
     if (e.parameter.action === 'adminLoginPoll') {
       return handleAdminLoginPoll(e.parameter);
     }
     if (e.parameter.action === 'adminLogout') {
       return handleAdminLogout(e.parameter);
     }
     if (e.parameter.action === 'adminListActivities') {
       return handleAdminListActivities(e.parameter);
     }
     if (e.parameter.action === 'adminListRegistrations') {
       return handleAdminListRegistrations(e.parameter);
     }
     if (e.parameter.action === 'adminPreviewCampaign') {
       return handleAdminPreviewCampaign(e.parameter);
     }
     if (e.parameter.action === 'adminSendCampaign') {
       return handleAdminSendCampaign(e.parameter);
     }
     return HtmlService.createHtmlOutput('ATP');
   }

   // ====== PANEL ADMIN (login + ver inscriptos + campañas de mail) ======
   //
   // src/pages/staff/panel.astro. Login con contraseña + código de 6
   // dígitos de Google Authenticator (TOTP, ver la sección de TOTP más
   // abajo) — nada de esto queda expuesto en el sitio: cada acción exige
   // un token de sesión que solo entrega handleAdminLogin, después de
   // validar los dos factores.

   // Paso 1 de 2 del login: recibe contraseña + código por POST (nunca por
   // URL) y decide si son correctos. No puede devolver la respuesta acá
   // mismo (este POST se manda con fetch/no-cors, igual que
   // adminStageCampaign, porque Apps Script no manda headers CORS y un
   // fetch normal no podría leer la respuesta) — el resultado queda
   // guardado bajo `loginId` (un UUID que generó el propio navegador, no
   // un dato secreto) para que handleAdminLoginPoll lo retire enseguida.
   function handleAdminLoginAttempt(params) {
     if (!params.loginId) {
       return ContentService
         .createTextOutput(JSON.stringify({ result: 'error' }))
         .setMimeType(ContentService.MimeType.JSON);
     }

     // Mismo criterio que handleCheckin: el freno solo penaliza intentos
     // MAL (contraseña o código incorrectos) — un login correcto nunca lo
     // toca, sea cual sea el volumen de intentos previos.
     var passwordOk = (params.password || '') === ADMIN_PASSWORD;
     var codeOk = verifyTotpCode(params.code, ADMIN_TOTP_SECRET);
     var result;

     if (!passwordOk || !codeOk) {
       var failCount = bumpCounter('rl_admin_login_fail', 300);
       if (failCount > 5) {
         Utilities.sleep(Math.min(8000, (failCount - 5) * 1000));
       }
       result = { result: 'unauthorized' };
     } else {
       var token = Utilities.getUuid();
       // 21600s = 6hs, el máximo que permite CacheService — pasado ese
       // tiempo hay que volver a loguearse (contraseña + código de nuevo).
       CacheService.getScriptCache().put('admin_session_' + token, 'valid', 21600);
       result = { result: 'success', token: token };
     }

     // 60s alcanzan de sobra: el POST de arriba y el GET de
     // handleAdminLoginPoll pasan en la misma fracción de segundo, uno
     // apenas termina el otro. Un solo uso: lo borra quien lo lee primero.
     CacheService.getScriptCache().put('admin_login_result_' + params.loginId, JSON.stringify(result), 60);

     return ContentService
       .createTextOutput(JSON.stringify({ result: 'queued' }))
       .setMimeType(ContentService.MimeType.JSON);
   }

   // Paso 2 de 2 del login: retira (GET/JSONP, así se puede leer de
   // verdad) lo que dejó handleAdminLoginAttempt bajo el mismo `loginId`
   // — nunca lleva la contraseña ni el código, solo un id de un solo uso
   // sin valor por sí mismo una vez consumido.
   function handleAdminLoginPoll(params) {
     var cache = CacheService.getScriptCache();
     var key = 'admin_login_result_' + (params.loginId || '');
     var stored = cache.get(key);
     if (!stored) return jsonpResponse({ result: 'pending' }, params.callback);
     cache.remove(key);
     return jsonpResponse(JSON.parse(stored), params.callback);
   }

   function handleAdminLogout(params) {
     if (params.token) CacheService.getScriptCache().remove('admin_session_' + params.token);
     return jsonpResponse({ result: 'success' }, params.callback);
   }

   function isValidAdminSession(token) {
     if (!token) return false;
     return CacheService.getScriptCache().get('admin_session_' + token) === 'valid';
   }

   // Único punto que decide qué hoja puede ver o usar el panel admin —
   // ninguna acción de abajo debería llamar a getSheetByName directo con
   // un nombre que vino del cliente sin pasar por acá primero. Excluye
   // "Errores" (no es una actividad) y la Agenda (AGENDA_SHEET_NAME: sus
   // mails son puntuales/transaccionales, sin link de darse de baja —
   // nunca deben poder recibir una campaña ni listarse acá, ver
   // SECURITY_DECISIONS.md). Cualquier otra hoja sin columna "Email"
   // tampoco es una hoja de inscripciones (ej. la de log de campañas,
   // CAMPAIGNS_LOG_SHEET_NAME, queda afuera sola por este mismo motivo).
   function getEligibleActivitySheet(sheetName) {
     if (!sheetName || sheetName === AGENDA_SHEET_NAME) return null;
     var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
     if (!sheet || sheet.getName() === 'Errores') return null;
     if (sheet.getLastRow() < 1) return null;

     var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
     if (headers.indexOf('Email') === -1) return null;

     return sheet;
   }

   // Recorre todas las hojas elegibles y cuenta cuántos inscriptos activos
   // (no dados de baja) tiene cada una — así el panel arma la lista de
   // actividades a partir de datos reales de la planilla, no de una lista
   // fija que podría no coincidir (una actividad sin ninguna inscripción
   // todavía no tiene ni hoja propia).
   function handleAdminListActivities(params) {
     if (!isValidAdminSession(params.token)) {
       return jsonpResponse({ result: 'unauthorized' }, params.callback);
     }

     var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
     var activities = [];
     sheets.forEach(function (sheetRef) {
       var name = sheetRef.getName();
       var sheet = getEligibleActivitySheet(name);
       if (!sheet) return;

       var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
       var unsubCol = headers.indexOf('Dado de baja');
       var data = sheet.getDataRange().getValues();
       var active = 0;
       for (var i = 1; i < data.length; i++) {
         if (unsubCol === -1 || data[i][unsubCol] !== true) active++;
       }

       activities.push({ sheetName: name, total: data.length - 1, active: active });
     });

     return jsonpResponse({ result: 'success', activities: activities }, params.callback);
   }

   function handleAdminListRegistrations(params) {
     if (!isValidAdminSession(params.token)) {
       return jsonpResponse({ result: 'unauthorized' }, params.callback);
     }

     var sheet = getEligibleActivitySheet(params.sheetName);
     if (!sheet) return jsonpResponse({ result: 'not_found' }, params.callback);

     var data = sheet.getDataRange().getValues();
     var headers = data[0];
     var unsubCol = headers.indexOf('Dado de baja');
     var registrations = [];
     for (var i = 1; i < data.length; i++) {
       var tags = buildTemplateTags(headers, data[i]);
       registrations.push({
         nombre: [tags.nombre, tags.apellido].filter(Boolean).join(' '),
         email: tags.email || '',
         dadoDeBaja: unsubCol !== -1 && data[i][unsubCol] === true,
       });
     }

     return jsonpResponse({ result: 'success', registrations: registrations }, params.callback);
   }

   // Paso 1 de 2 para mandar una campaña: guarda el asunto/cuerpo en el
   // cache del script bajo un id que manda el propio navegador
   // (crypto.randomUUID(), igual que el registrationId del QR) — así el
   // panel no depende de leer nada de esta respuesta (se manda con
   // fetch/no-cors, igual que los formularios públicos, porque el cuerpo
   // de un mail puede ser más largo de lo que entra en la URL de un GET).
   // El envío real es handleAdminSendCampaign (paso 2), que sí es legible.
   function handleAdminStageCampaign(params) {
     if (!isValidAdminSession(params.token)) {
       return ContentService
         .createTextOutput(JSON.stringify({ result: 'unauthorized' }))
         .setMimeType(ContentService.MimeType.JSON);
     }

     // Nunca guardar (ni mucho menos dejar mandar después) una campaña
     // apuntada a una hoja que no es una actividad real — ver
     // getEligibleActivitySheet. Antes este chequeo no existía acá, así
     // que un sheetName cualquiera (ej. la Agenda) quedaba aceptado igual.
     if (!getEligibleActivitySheet(params.sheetName)) {
       return ContentService
         .createTextOutput(JSON.stringify({ result: 'not_found' }))
         .setMimeType(ContentService.MimeType.JSON);
     }

     CacheService.getScriptCache().put('admin_campaign_' + params.campaignId, JSON.stringify({
       sheetName: params.sheetName || '',
       subject: params.subject || '',
       body: params.body || '',
     }), 300); // 5 minutos alcanzan de sobra entre estos pasos

     return ContentService
       .createTextOutput(JSON.stringify({ result: 'success' }))
       .setMimeType(ContentService.MimeType.JSON);
   }

   // Vista previa: arma el asunto y el cuerpo tal cual van a salir de
   // verdad (mismas funciones que el envío real: applyTemplateTags +
   // wrapEmailHtml), usando los datos reales de la primera persona activa
   // de esa hoja — así lo que se ve en pantalla antes de confirmar es
   // exactamente lo que le va a llegar a alguien, no una aproximación. A
   // diferencia de handleAdminSendCampaign, esto NO borra el campaignId
   // del cache: se puede pedir vista previa las veces que hagan falta
   // antes de decidirse a mandar.
   function handleAdminPreviewCampaign(params) {
     if (!isValidAdminSession(params.token)) {
       return jsonpResponse({ result: 'unauthorized' }, params.callback);
     }

     var staged = CacheService.getScriptCache().get('admin_campaign_' + params.campaignId);
     if (!staged) return jsonpResponse({ result: 'not_found' }, params.callback);

     var campaign = JSON.parse(staged);
     var sheet = getEligibleActivitySheet(campaign.sheetName);
     if (!sheet) return jsonpResponse({ result: 'not_found' }, params.callback);

     var data = sheet.getDataRange().getValues();
     var headers = data[0];
     var unsubCol = headers.indexOf('Dado de baja');
     var sampleTags = null;
     var activeCount = 0;

     for (var i = 1; i < data.length; i++) {
       var unsubscribed = unsubCol !== -1 && data[i][unsubCol] === true;
       var tags = buildTemplateTags(headers, data[i]);
       if (!tags.email || unsubscribed) continue;
       activeCount++;
       if (!sampleTags) sampleTags = tags;
     }

     if (!sampleTags) return jsonpResponse({ result: 'no_recipients' }, params.callback);

     var subject = applyTemplateTags(campaign.subject, sampleTags);
     var bodyHtml = applyTemplateTags(String(campaign.body).replace(/\n/g, '<br>'), sampleTags);
     var unsubscribeUrl = buildUnsubscribeUrl(campaign.sheetName, sampleTags.email);

     return jsonpResponse({
       result: 'success',
       subject: subject,
       bodyHtml: wrapEmailHtml(bodyHtml, unsubscribeUrl),
       sampleName: [sampleTags.nombre, sampleTags.apellido].filter(Boolean).join(' ') || sampleTags.email,
       activeCount: activeCount,
     }, params.callback);
   }

   // Paso final: busca lo que se guardó en el staging, manda un mail
   // personalizado (etiquetas <nombre>/<apellido>/<email>) a cada
   // inscripto activo (no dado de baja) de esa hoja, deja registro en
   // CAMPAIGNS_LOG_SHEET_NAME, y devuelve cuántos se mandaron de verdad —
   // a diferencia de los formularios públicos, acá sí importa saber el
   // resultado real, por eso es JSONP y no fetch/no-cors.
   function handleAdminSendCampaign(params) {
     if (!isValidAdminSession(params.token)) {
       return jsonpResponse({ result: 'unauthorized' }, params.callback);
     }

     // Candado real, no solo "leer y borrar": sin esto, dos pedidos casi
     // simultáneos con el mismo campaignId (ej. un reintento automático
     // del navegador tras un corte de red a mitad del pedido anterior)
     // podrían leer el mismo staged antes de que ninguno lo borre, y
     // mandar la misma campaña dos veces. Con el candado, el segundo
     // pedido espera a que el primero termine de borrar y encuentra
     // "not_found" en vez de repetir el envío completo.
     var lock = LockService.getScriptLock();
     lock.waitLock(30000);

     var campaign;
     try {
       var cache = CacheService.getScriptCache();
       var staged = cache.get('admin_campaign_' + params.campaignId);
       if (!staged) return jsonpResponse({ result: 'not_found' }, params.callback);
       cache.remove('admin_campaign_' + params.campaignId); // un solo uso
       campaign = JSON.parse(staged);
     } finally {
       lock.releaseLock();
     }

     // Se revalida acá también (no solo al guardar en el paso anterior):
     // barato, y cierra cualquier camino futuro que llegue a armar un
     // campaignId sin pasar por handleAdminStageCampaign.
     var sheet = getEligibleActivitySheet(campaign.sheetName);
     if (!sheet) return jsonpResponse({ result: 'not_found' }, params.callback);

     var data = sheet.getDataRange().getValues();
     var headers = data[0];
     var unsubCol = headers.indexOf('Dado de baja');
     var sent = 0;
     var total = 0;

     for (var i = 1; i < data.length; i++) {
       var unsubscribed = unsubCol !== -1 && data[i][unsubCol] === true;
       var tags = buildTemplateTags(headers, data[i]);
       if (!tags.email || unsubscribed) continue;
       total++;

       try {
         var subject = applyTemplateTags(campaign.subject, tags);
         var bodyHtml = applyTemplateTags(String(campaign.body).replace(/\n/g, '<br>'), tags);
         var unsubscribeUrl = buildUnsubscribeUrl(campaign.sheetName, tags.email);
         GmailApp.sendEmail(tags.email, subject, '', {
           htmlBody: wrapEmailHtml(bodyHtml, unsubscribeUrl),
           name: SENDER_NAME,
         });
         sent++;
       } catch (mailErr) {
         logError('campaign', mailErr, { email: tags.email, sheetName: campaign.sheetName });
       }
     }

     logCampaignSent(campaign.sheetName, campaign.subject, sent, total);

     return jsonpResponse({ result: 'success', sent: sent, total: total }, params.callback);
   }

   // Historial de campañas realmente enviadas — no vive en ningún otro
   // lado, así que si alguna vez hay que confirmar "¿le mandé esto a esta
   // lista?", esta pestaña es la única fuente real. Nunca debe frenar un
   // envío que ya salió: si ni esto falla, se ignora en silencio, igual
   // que logError.
   function logCampaignSent(sheetName, subject, sent, total) {
     try {
       var log = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CAMPAIGNS_LOG_SHEET_NAME);
       if (!log) {
         log = SpreadsheetApp.getActiveSpreadsheet().insertSheet(CAMPAIGNS_LOG_SHEET_NAME);
         log.appendRow(['Fecha', 'Hoja', 'Asunto', 'Enviados', 'Total']);
       }
       log.appendRow([new Date(), sheetName, subject, sent, total]);
     } catch (err) {
       // Sin acción: un fallo acá no debe deshacer ni bloquear un envío
       // que ya salió de verdad.
     }
   }

   // Junta las columnas que puede tener una fila (según el tipo de hoja —
   // inscripción simple: "Nombre y apellido"; charla: "Nombres" +
   // "Apellidos" separados, ver getOrCreateSheet/getOrCreateCharlaSheet)
   // en un mismo formato {nombre, apellido, email}, para no repetir esta
   // lógica en cada handler de arriba.
   function buildTemplateTags(headers, row) {
     var tags = {};
     var simpleNameCol = headers.indexOf('Nombre y apellido');
     if (simpleNameCol !== -1) tags.nombre = row[simpleNameCol];
     var firstCol = headers.indexOf('Nombres');
     var lastCol = headers.indexOf('Apellidos');
     if (firstCol !== -1) tags.nombre = row[firstCol];
     if (lastCol !== -1) tags.apellido = row[lastCol];
     var emailCol = headers.indexOf('Email');
     if (emailCol !== -1) tags.email = row[emailCol];
     return tags;
   }

   // Reemplaza <nombre>, <apellido>, <email> (case-insensitive) por el
   // dato real de esa fila — una etiqueta sin dato para esa persona
   // también se escapa (`escapeHtml(match)`, no el texto crudo): el cuerpo
   // del mail es HTML, así que una etiqueta sin reemplazar y sin escapar
   // (ej. "<inventada>") no se ve como texto de error, el navegador la
   // interpreta como una etiqueta HTML desconocida y la esconde entera —
   // exactamente lo contrario de la idea de que el error se note.
   function applyTemplateTags(text, tags) {
     return String(text || '').replace(/<(\w+)>/g, function (match, tagName) {
       var value = tags[tagName.toLowerCase()];
       return escapeHtml(value !== undefined && value !== '' ? value : match);
     });
   }

   // ====== TOTP (código de Google Authenticator — RFC 6238) ======
   //
   // Mismo estándar que usa la app de Google Authenticator (y cualquier
   // otra de códigos de un solo uso): HMAC-SHA1 sobre un contador de
   // tiempo, verificado contra los 3 vectores de prueba oficiales del RFC
   // 6238 antes de escribir esto acá. Acepta el código de la ventana
   // actual y de una hacia atrás/adelante (±30s) para tolerar que el reloj
   // del celular y el de Apps Script no estén perfectamente sincronizados.

   var BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

   function padLeft(str, len) {
     var result = String(str);
     while (result.length < len) result = '0' + result;
     return result;
   }

   function base32Decode(base32) {
     var clean = String(base32).toUpperCase().replace(/[^A-Z2-7]/g, '');
     var bits = '';
     for (var i = 0; i < clean.length; i++) {
       var val = BASE32_ALPHABET.indexOf(clean.charAt(i));
       if (val === -1) continue;
       bits += padLeft(val.toString(2), 5);
     }
     var bytes = [];
     for (var j = 0; j + 8 <= bits.length; j += 8) {
       bytes.push(parseInt(bits.substring(j, j + 8), 2));
     }
     return bytes;
   }

   function totpCounterBytes(counter) {
     var bytes = [0, 0, 0, 0, 0, 0, 0, 0];
     for (var i = 7; i >= 0 && counter > 0; i--) {
       bytes[i] = counter % 256;
       counter = Math.floor(counter / 256);
     }
     return bytes;
   }

   function generateTotp(secretBase32, unixSeconds) {
     var counter = Math.floor(unixSeconds / 30);
     var counterBytes = totpCounterBytes(counter);
     var keyBytes = base32Decode(secretBase32);
     // Utilities.computeHmacSha1Signature NO existe en Apps Script (a
     // diferencia de computeHmacSha256Signature, que sí) — solo existe el
     // método genérico computeHmacSignature con el algoritmo como primer
     // parámetro. Bug real encontrado en producción el 2026-09-05: el login
     // del panel nunca funcionó porque esta línea tiraba "TypeError:
     // Utilities.computeHmacSha1Signature is not a function" en cada
     // intento, y esa excepción quedaba silenciada por el try/catch de
     // doPost — el panel devolvía "Contraseña o código incorrectos" pase lo
     // que pase, sin importar si eran correctos. Ver SECURITY_DECISIONS.md.
     var hmac = Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, counterBytes, keyBytes);
     // Apps Script devuelve bytes con signo (-128 a 127) — normalizar a
     // 0-255 antes de la truncación dinámica del estándar (RFC 4226 §5.3).
     var unsigned = hmac.map(function (b) { return b < 0 ? b + 256 : b; });
     var offset = unsigned[unsigned.length - 1] & 0x0f;
     var binary =
       ((unsigned[offset] & 0x7f) << 24) |
       ((unsigned[offset + 1] & 0xff) << 16) |
       ((unsigned[offset + 2] & 0xff) << 8) |
       (unsigned[offset + 3] & 0xff);
     return padLeft(String(binary % 1000000), 6);
   }

   function verifyTotpCode(code, secretBase32) {
     if (!/^\d{6}$/.test(String(code || ''))) return false;
     var now = Math.floor(new Date().getTime() / 1000);
     for (var step = -1; step <= 1; step++) {
       if (generateTotp(secretBase32, now + step * 30) === String(code)) return true;
     }
     return false;
   }

   // ====== CHARLAS/CAPACITACIONES CON CERTIFICADO + QR DE ACCESO ======

   function handleCharlaRegistration(params) {
     try {
       var sheetName = sanitizeSheetName(params.activityTitle || 'Sin actividad');
       var sheet = getOrCreateCharlaSheet(sheetName);

       // Alguien puede reenviar el formulario más de una vez para la misma
       // charla (conexión lenta, no vio la confirmación, corrigió un dato) —
       // en vez de sumar una fila nueva cada vez, se actualiza la fila
       // existente de ese DNI: mismos datos y QR más recientes, sin perder
       // asistencias ya marcadas ni el estado de "dado de baja" de esa fila.
       var existingRow = findCharlaRowByDni(sheet, params.dni);

       if (existingRow) {
         sheet.getRange(existingRow, 1, 1, 9).setValues([[
           new Date(),
           params.firstName || '',
           params.lastName || '',
           params.dni || '',
           params.phone || '',
           params.email || '',
           params.career || '',
           params.year || '',
           params.registrationId || '',
         ]]);
       } else {
         sheet.appendRow([
           new Date(),
           params.firstName || '',
           params.lastName || '',
           params.dni || '',
           params.phone || '',
           params.email || '',
           params.career || '',
           params.year || '',
           params.registrationId || '',
           JSON.stringify([]), // Asistencias (una entrada por encuentro confirmado)
           false, // Dado de baja
           params.activityId || '',
         ]);
       }

       try {
         sendCharlaConfirmationEmail(params, sheetName);
       } catch (mailErr) {
         logError('mail-charla', mailErr, params);
       }

       return ContentService
         .createTextOutput(JSON.stringify({ result: 'success' }))
         .setMimeType(ContentService.MimeType.JSON);
     } catch (err) {
       logError('charla', err, params);
       return ContentService
         .createTextOutput(JSON.stringify({ result: 'error' }))
         .setMimeType(ContentService.MimeType.JSON);
     }
   }

   function getOrCreateCharlaSheet(sheetName) {
     var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
     var sheet = spreadsheet.getSheetByName(sheetName);
     if (!sheet) {
       sheet = spreadsheet.insertSheet(sheetName);
       sheet.appendRow([
         'Fecha', 'Nombres', 'Apellidos', 'DNI', 'Teléfono', 'Email',
         'Carrera', 'Año', 'RegistrationId', 'Asistencias', 'Dado de baja', 'ActivityId',
       ]);
     }
     return sheet;
   }

   // Columna D (índice 3) = DNI, según los encabezados de arriba. Usado por
   // handleCharlaRegistration para no duplicar la fila de alguien que
   // reenvía el formulario para la misma charla.
   function findCharlaRowByDni(sheet, dni) {
     if (!dni) return null;
     var data = sheet.getDataRange().getValues();
     for (var i = 1; i < data.length; i++) {
       if (String(data[i][3]) === String(dni)) return i + 1;
     }
     return null;
   }

   function sendCharlaConfirmationEmail(params, sheetName) {
     if (!params.email) return;
     var unsubscribeUrl = buildUnsubscribeUrl(sheetName, params.email);
     var body = buildCharlaConfirmationBody(params);
     var html = wrapEmailHtml(body, unsubscribeUrl);

     GmailApp.sendEmail(params.email, 'Tu entrada a ' + params.activityTitle, '', {
       htmlBody: html,
       name: SENDER_NAME,
     });
   }

   // El QR se genera igual (mismo contenido: el registrationId a secas) que
   // el que ve la persona en pantalla al inscribirse
   // (ActivityCertificateRegistrationForm.astro, con la librería `qrcode` en
   // el navegador) — acá, en cambio, vía una API pública gratuita
   // (api.qrserver.com) referenciada por URL, porque Apps Script no tiene
   // forma nativa de dibujar un QR. El contenido codificado es el mismo, así
   // que da igual con qué se haya dibujado: cualquier lector lo lee igual.
   function buildQrImageUrl(data) {
     return 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(data);
   }

   function buildCharlaConfirmationBody(params) {
     var greeting =
       '<p style="margin:0 0 4px;color:#6b7280;font-size:14px;">Hola ' + escapeHtml(params.firstName) + ',</p>' +
       '<h1 style="margin:0 0 20px;font-size:21px;color:#111827;line-height:1.4;">Quedaste anotado/a a<br>"' + escapeHtml(params.activityTitle) + '"</h1>' +
       '<p style="margin:0 0 24px;color:#374151;">Este es tu QR de acceso: te lo van a escanear en la entrada. Guardá este mail o sacale una captura.</p>';

     var qrHtml =
       '<div style="text-align:center;margin:0 0 24px;">' +
       '<img src="' + buildQrImageUrl(params.registrationId) + '" width="220" height="220" alt="Código QR de acceso" style="display:inline-block;">' +
       '</div>';

     var dataRecap =
       '<div style="border:1px solid #e5e9f0;background:#f8f9fb;border-radius:10px;padding:18px 20px;">' +
       '<p style="margin:0 0 4px;color:#6b7280;font-size:12px;">El certificado se emite con estos datos:</p>' +
       '<p style="margin:0;color:#111827;">' + escapeHtml(params.firstName) + ' ' + escapeHtml(params.lastName) + ' · DNI ' + escapeHtml(params.dni) + '</p>' +
       '</div>';

     return greeting + qrHtml + dataRecap;
   }

   // Busca el registrationId del QR en todas las hojas de charlas (no hace
   // falta saber de antemano en cuál está: el id es un UUID generado en el
   // navegador, único entre todas las actividades). Ubica las columnas por
   // nombre de encabezado en vez de un índice fijo, así no se rompe si el
   // orden de columnas de esta hoja cambia el día de mañana.
   function handleCheckin(params) {
     var result;
     if (params.secret !== STAFF_CHECKIN_SECRET) {
       // Nunca afecta un escaneo legítimo (siempre manda la clave
       // correcta, así sean cientos en pocos minutos entre varios
       // puntos de escaneo a la vez) — solo hace más lento a alguien
       // probando claves al azar: pasados los primeros 10 intentos
       // fallidos en 5 minutos (entre TODOS los que estén probando,
       // Apps Script no expone la IP de quien llama para poder frenar
       // por ahí), cada intento de más suma una demora antes de
       // responder, hasta 8 segundos. Hallazgo de la segunda auditoría
       // de seguridad, septiembre 2026: este endpoint es el único de
       // todo el script sin ninguna otra protección contra fuerza bruta.
       var failCount = bumpCounter('rl_checkin_wrong_secret', 300);
       if (failCount > 10) {
         Utilities.sleep(Math.min(8000, (failCount - 10) * 500));
       }
       result = { result: 'unauthorized' };
     } else {
       result = findAndMarkAttendance(params.id, params.session);
     }
     return jsonpResponse(result, params.callback);
   }

   function findAndMarkAttendance(registrationId, sessionLabel) {
     if (!registrationId) return { result: 'not_found' };

     var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
     for (var s = 0; s < sheets.length; s++) {
       var sheet = sheets[s];
       var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
       var idCol = headers.indexOf('RegistrationId');
       var attendanceCol = headers.indexOf('Asistencias');
       if (idCol === -1 || attendanceCol === -1) continue; // no es una hoja de charla

       var data = sheet.getDataRange().getValues();
       for (var i = 1; i < data.length; i++) {
         if (String(data[i][idCol]) !== String(registrationId)) continue;

         var name = (data[i][1] || '') + ' ' + (data[i][2] || '');
         var attendance = safeParseJson(data[i][attendanceCol]) || [];

         if (attendance.indexOf(sessionLabel) !== -1) {
           return { result: 'duplicate', name: name.trim() };
         }

         attendance.push(sessionLabel);
         sheet.getRange(i + 1, attendanceCol + 1).setValue(JSON.stringify(attendance));
         return { result: 'ok', name: name.trim() };
       }
     }

     return { result: 'not_found' };
   }

   // El nombre del callback lo manda el navegador (uno nuevo por escaneo) —
   // se valida el charset antes de interpolarlo en JS para no permitir nada
   // raro ahí, aunque solo lo ejecuta el propio celular del staff que lo pidió.
   function jsonpResponse(data, callbackName) {
     var safeCallback = /^[a-zA-Z0-9_]+$/.test(callbackName || '') ? callbackName : 'callback';
     return ContentService
       .createTextOutput(safeCallback + '(' + JSON.stringify(data) + ')')
       .setMimeType(ContentService.MimeType.JAVASCRIPT);
   }

   // ====== REPROGRAMAR ACTIVIDAD (menú "ATP" de la planilla) ======

   // Corre solo al abrir la planilla — agrega el menú "ATP" de arriba.
   function onOpen() {
     SpreadsheetApp.getUi()
       .createMenu('ATP')
       .addItem('Reprogramar esta actividad (mail a inscriptos)', 'promptReschedule')
       .addToUi();
   }

   // Usa la pestaña que la persona tiene abierta como "la actividad" — así
   // no hay que escribir el nombre a mano ni elegirlo de una lista. Manda un
   // mail con el mensaje tipeado a cada inscripto/a de esa pestaña que no se
   // haya dado de baja (misma columna F que usan sendReminders/doPost).
   function promptReschedule() {
     var ui = SpreadsheetApp.getUi();
     var sheet = SpreadsheetApp.getActiveSheet();
     var sheetName = sheet.getName();

     if (sheetName === 'Errores' || sheetName === AGENDA_SHEET_NAME) {
       ui.alert('Abrí la pestaña de la actividad que querés reprogramar (no esta) y probá de nuevo.');
       return;
     }

     var response = ui.prompt(
       'Reprogramar "' + sheetName + '"',
       'Escribí el mensaje que va a recibir cada inscripto/a, por ejemplo:\n' +
       '"Pasamos la clase al viernes 22/8 a las 18hs, mismo lugar."\n\n' +
       'Se manda por mail a todos los inscriptos de esta pestaña que no se dieron de baja.',
       ui.ButtonSet.OK_CANCEL
     );

     if (response.getSelectedButton() !== ui.Button.OK) return;

     var message = response.getResponseText().trim();
     if (!message) {
       ui.alert('No escribiste ningún mensaje. No se mandó nada.');
       return;
     }

     var data = sheet.getDataRange().getValues();
     var recipients = [];
     for (var i = 1; i < data.length; i++) {
       var email = data[i][2];
       var unsubscribed = data[i][5] === true;
       if (email && !unsubscribed) {
         recipients.push({ name: data[i][1], email: email });
       }
     }

     if (recipients.length === 0) {
       ui.alert('No hay inscriptos activos (sin dar de baja) en esta pestaña. No se mandó nada.');
       return;
     }

     var confirm = ui.alert(
       'Confirmar envío',
       'Se va a mandar este mail a ' + recipients.length + ' persona(s) inscripta(s) en "' + sheetName + '":\n\n' +
       '"' + message + '"\n\n¿Confirmás?',
       ui.ButtonSet.YES_NO
     );
     if (confirm !== ui.Button.YES) return;

     var sent = 0;
     recipients.forEach(function (recipient) {
       try {
         sendRescheduleEmail(recipient.email, recipient.name, sheetName, message);
         sent++;
       } catch (err) {
         logError('reschedule', err, { email: recipient.email, sheet: sheetName });
       }
     });

     ui.alert('Listo: se mandó el mail a ' + sent + ' de ' + recipients.length + ' persona(s).');
   }

   function sendRescheduleEmail(email, name, sheetName, message) {
     var unsubscribeUrl = buildUnsubscribeUrl(sheetName, email);
     var body = buildRescheduleBody(name, sheetName, message);
     var html = wrapEmailHtml(body, unsubscribeUrl);

     GmailApp.sendEmail(email, 'Cambio en ' + sheetName, '', {
       htmlBody: html,
       name: SENDER_NAME,
     });
   }

   function buildRescheduleBody(name, activityTitle, message) {
     var greeting =
       '<p style="margin:0 0 4px;color:#6b7280;font-size:14px;">Hola ' + escapeHtml(name) + ',</p>' +
       '<h1 style="margin:0 0 20px;font-size:21px;color:#111827;line-height:1.4;">Hubo un cambio en<br>"' + escapeHtml(activityTitle) + '"</h1>';

     var messageHtml =
       '<div style="border:1px solid #e5e9f0;background:#f8f9fb;border-radius:10px;padding:18px 20px;">' +
       '<p style="margin:0;color:#111827;white-space:pre-line;">' + escapeHtml(message) + '</p>' +
       '</div>';

     return greeting + messageHtml;
   }

   // ====== RESERVA DE LA AGENDA ======

   function handleAgendaReservation(params) {
     try {
       var sheet = getOrCreateAgendaSheet();
       var quantity = Math.max(1, Number(params.quantity) || 1);
       var total = quantity * AGENDA_PRICE;

       sheet.appendRow([
         new Date(),
         params.name || '',
         params.lastName || '',
         params.email || '',
         params.phone || '',
         quantity,
         total,
       ]);

       try {
         sendAgendaConfirmationEmail(params.email, params.name, quantity, total);
       } catch (mailErr) {
         logError('mail-agenda', mailErr, params);
       }

       return ContentService
         .createTextOutput(JSON.stringify({ result: 'success' }))
         .setMimeType(ContentService.MimeType.JSON);
     } catch (err) {
       logError('agenda', err, params);
       return ContentService
         .createTextOutput(JSON.stringify({ result: 'error' }))
         .setMimeType(ContentService.MimeType.JSON);
     }
   }

   function getOrCreateAgendaSheet() {
     var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
     var sheet = spreadsheet.getSheetByName(AGENDA_SHEET_NAME);
     if (!sheet) {
       sheet = spreadsheet.insertSheet(AGENDA_SHEET_NAME);
       sheet.appendRow(['Fecha', 'Nombre', 'Apellido', 'Email', 'Teléfono', 'Cantidad', 'Total']);
     }
     return sheet;
   }

   // ====== RECORDATORIOS (correr sendReminders con un disparador diario) ======

   function sendReminders() {
     var tomorrow = getTomorrowDateString();
     // null si falló el pedido (sin red, deploy caído, etc.) — en ese caso
     // se sigue usando la foto guardada en la planilla como respaldo, en vez
     // de no mandar ningún recordatorio ese día por un problema pasajero.
     var activeSessionsByActivity = fetchActiveSessionsByActivity();
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

         var activityId = row[8] || '';

         // Si la actividad todavía existe y está publicada, usar su
         // cronograma actual (recién bajado del sitio) en vez de la foto
         // vieja de la columna G — así una edición de fecha/hora/lugar se
         // refleja sola. Si ya no existe (se borró o despublicó), no se
         // manda más ningún recordatorio para ella.
         var sessions;
         if (activeSessionsByActivity && activityId) {
           if (!Object.prototype.hasOwnProperty.call(activeSessionsByActivity, activityId)) continue;
           sessions = activeSessionsByActivity[activityId];
         } else {
           sessions = safeParseJson(row[6]) || [];
         }

         var alreadySent = safeParseJson(row[7]) || [];

         var tomorrowSessions = sessions.filter(function (session) {
           var key = session.date + '|' + session.title;
           return session.date === tomorrow && alreadySent.indexOf(key) === -1;
         });

         if (tomorrowSessions.length === 0) continue;

         try {
           sendReminderEmail(email, name, sheet.getName(), activityId, tomorrowSessions);
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

   // Ver comentario en sendReminders(): esto es lo que le permite "enterarse"
   // de que una actividad se borró/despublicó o le cambiaron fecha/hora.
   function fetchActiveSessionsByActivity() {
     try {
       var response = UrlFetchApp.fetch(ACTIVE_SESSIONS_JSON_URL, { muteHttpExceptions: true });
       if (response.getResponseCode() !== 200) return null;
       var json = JSON.parse(response.getContentText());
       return json.activities || {};
     } catch (err) {
       return null;
     }
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

   function handleUnsubscribe(sheetName, email, sig) {
     // Sin la firma correcta, no se toca nada — evita que alguien dé de baja
     // a otra persona a partir de adivinar/conocer su email y el nombre de
     // una hoja (ambos son fáciles de adivinar: el nombre de la hoja es el
     // título de la actividad).
     if (!sheetName || !email || sig !== signUnsubscribe(sheetName, email)) {
       return HtmlService.createHtmlOutput(
         '<div style="font-family:Arial,sans-serif;max-width:480px;margin:60px auto;text-align:center;color:#555;">' +
         '<h1 style="font-size:20px;">Este link no es válido</h1>' +
         '<p>Puede que esté incompleto. Probá abrirlo directamente desde el mail original.</p>' +
         '</div>'
       );
     }

     var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
     if (sheet) {
       var data = sheet.getDataRange().getValues();
       for (var i = 1; i < data.length; i++) {
         if (String(data[i][2]).toLowerCase() === String(email).toLowerCase()) {
           sheet.getRange(i + 1, 6).setValue(true); // columna F: Dado de baja
         }
       }
     }
     return HtmlService.createHtmlOutput(
       '<div style="font-family:Arial,sans-serif;max-width:480px;margin:60px auto;text-align:center;color:' + ACCENT_COLOR + ';">' +
       '<h1 style="font-size:20px;">Listo, te dimos de baja</h1>' +
       '<p style="color:#555;">No te va a llegar más ningún mail nuestro para esta actividad.</p>' +
       '</div>'
     );
   }

   // ====== MAILS ======

   function sendConfirmationEmail(email, name, activityTitle, activityId, sessions, sheetName, confirmationMessage, confirmationLinkLabel, confirmationLinkUrl) {
     if (!email) return;
     var unsubscribeUrl = buildUnsubscribeUrl(sheetName, email);
     var body = buildConfirmationBody(name, activityTitle, activityId, sessions, confirmationMessage, confirmationLinkLabel, confirmationLinkUrl);
     var html = wrapEmailHtml(body, unsubscribeUrl);

     GmailApp.sendEmail(email, 'Confirmamos tu inscripción a ' + activityTitle, '', {
       htmlBody: html,
       name: SENDER_NAME,
     });
   }

   function sendReminderEmail(email, name, sheetName, activityId, sessions) {
     var unsubscribeUrl = buildUnsubscribeUrl(sheetName, email);
     var body = buildReminderBody(name, sheetName, activityId, sessions);
     var html = wrapEmailHtml(body, unsubscribeUrl);

     GmailApp.sendEmail(email, 'Mañana: ' + sheetName, '', {
       htmlBody: html,
       name: SENDER_NAME,
     });
   }

   // Logo real de ATP (fuerza el color a blanco, ver
   // public/branding/logo-white.svg en el repo) sobre fondo rosa, en vez de
   // un círculo con las letras "ATP" — se referencia por URL (no en base64
   // adentro del mail) porque muchos clientes de mail bloquean por default
   // las imágenes en base64 pero sí cargan una imagen de una URL normal.
   // `unsubscribeUrl` es opcional: los mails de reserva de la agenda son
   // transaccionales (la persona acaba de pedir algo puntual, no es una
   // suscripción a una lista), así que no llevan pie de "darme de baja".
   function wrapEmailHtml(bodyHtml, unsubscribeUrl) {
     var footerLink = unsubscribeUrl
       ? '<br><a href="' + unsubscribeUrl.replace(/&/g, '&amp;') + '" style="color:#9aa3af;text-decoration:underline;">Darme de baja de estos mails</a>'
       : '';

     return (
       '<div style="background:#eef1f6;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;">' +
       '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(198,41,158,0.12);">' +
       '<div style="background:' + ACCENT_COLOR + ';padding:32px 28px;text-align:center;">' +
       '<img src="' + SITE_URL + '/branding/logo-white.svg" alt="ATP" width="88" style="height:auto;max-width:88px;display:inline-block;">' +
       '<div style="color:#ffffff;opacity:0.9;font-size:13px;margin-top:14px;">Agrupación estudiantil de la Facultad de Ciencias Médicas</div>' +
       '</div>' +
       '<div style="padding:36px 32px;color:#1f2937;font-size:15px;line-height:1.65;">' + bodyHtml + '</div>' +
       '<div style="padding:22px 32px;background:#f8f9fb;border-top:1px solid #eef1f6;color:#9aa3af;font-size:12px;text-align:center;line-height:1.6;">' +
       'ATP, Facultad de Ciencias Médicas (UNR).' + footerLink +
       '</div>' +
       '</div>' +
       '</div>'
     );
   }

   function sendAgendaConfirmationEmail(email, name, quantity, total) {
     if (!email) return;
     var html = wrapEmailHtml(buildAgendaConfirmationBody(name, quantity, total));

     GmailApp.sendEmail(email, 'Reservamos tu agenda ATP', '', {
       htmlBody: html,
       name: SENDER_NAME,
     });
   }

   function buildAgendaConfirmationBody(name, quantity, total) {
     var greeting =
       '<p style="margin:0 0 4px;color:#6b7280;font-size:14px;">Hola ' + escapeHtml(name) + ',</p>' +
       '<h1 style="margin:0 0 20px;font-size:21px;color:#111827;line-height:1.4;">Reservamos tu agenda ATP</h1>' +
       '<p style="margin:0 0 24px;color:#374151;">Cantidad: ' + quantity + '. Total: $' + total + '.</p>';

     var steps =
       '<div style="border:1px solid #e5e9f0;border-radius:10px;padding:18px 20px;">' +
       '<p style="margin:0 0 12px;color:#111827;"><strong>1.</strong> Transferí $' + total + ' al alias <strong>' + AGENDA_ALIAS + '</strong>.</p>' +
       '<p style="margin:0 0 12px;color:#111827;"><strong>2.</strong> Mandanos el comprobante por WhatsApp al <a href="https://wa.me/' + AGENDA_WHATSAPP + '" style="color:' + BRAND_COLOR + ';">3406 40-4841</a>.</p>' +
       '<p style="margin:0;color:#111827;"><strong>3.</strong> La retirás por nuestra mesita a partir del lunes 10/8, de 10 a 14hs.</p>' +
       '</div>';

     return greeting + steps;
   }

   // Tono compañero, no de campaña de marketing: nada de "confirmamos tu
   // registro", nada de mayúsculas de urgencia. Sin guion largo (—): se
   // reemplaza siempre por punto y aparte o una oración corta nueva.
   function buildConfirmationBody(name, activityTitle, activityId, sessions, confirmationMessage, confirmationLinkLabel, confirmationLinkUrl) {
     var greeting =
       '<p style="margin:0 0 4px;color:#6b7280;font-size:14px;">Hola ' + escapeHtml(name) + ',</p>' +
       '<h1 style="margin:0 0 20px;font-size:21px;color:#111827;line-height:1.4;">Quedaste anotado/a a<br>"' + escapeHtml(activityTitle) + '"</h1>' +
       '<p style="margin:0 0 24px;color:#374151;">Te esperamos. Guardá este mail que tiene el cronograma con las clases.</p>';

     var sessionsHtml = sessions.length > 0 ? buildSessionCards(sessions, true) : '';
     var confirmationMessageHtml = buildConfirmationMessageBox(confirmationMessage, confirmationLinkLabel, confirmationLinkUrl);
     var ctaHtml = buildCtaButton(activityId, 'Ver la actividad');

     return greeting + sessionsHtml + confirmationMessageHtml + ctaHtml + getPromoActivitiesHtml();
   }

   // Mensaje puntual de la actividad (ej. link de Meet), cargado en el CMS
   // (campos "Mensaje después de inscribirse" / "Texto del botón" / "Link
   // del botón" de esa actividad) — ver
   // src/components/ActivityRegistrationForm.astro, que manda estos mismos
   // tres valores como campos ocultos del formulario.
   function buildConfirmationMessageBox(message, linkLabel, linkUrl) {
     if (!message && !(linkLabel && linkUrl)) return '';

     var hasLink = linkLabel && linkUrl && isSafeUrl(linkUrl);

     var messageHtml = message
       ? '<p style="margin:0 0 ' + (hasLink ? '16px' : '0') + ';color:#111827;white-space:pre-line;">' + escapeHtml(message) + '</p>'
       : '';

     var linkHtml = hasLink
       ? '<a href="' + escapeHtml(linkUrl) + '" style="display:inline-block;background:' + BRAND_COLOR + ';color:#ffffff;font-weight:700;font-size:14px;padding:10px 22px;border-radius:999px;text-decoration:none;">' + escapeHtml(linkLabel) + '</a>'
       : '';

     return (
       '<div style="border:1px solid #e5e9f0;background:#f8f9fb;border-radius:10px;padding:18px 20px;margin-bottom:24px;">' +
       messageHtml + linkHtml +
       '</div>'
     );
   }

   function buildReminderBody(name, activityTitle, activityId, sessions) {
     var greeting =
       '<p style="margin:0 0 4px;color:#6b7280;font-size:14px;">Hola ' + escapeHtml(name) + ',</p>' +
       '<div style="display:inline-block;background:' + ACCENT_COLOR + '1a;color:' + ACCENT_COLOR + ';font-weight:700;font-size:12px;padding:4px 12px;border-radius:999px;margin-bottom:12px;">MAÑANA</div>' +
       '<h1 style="margin:0 0 20px;font-size:21px;color:#111827;line-height:1.4;">Te esperamos en<br>"' + escapeHtml(activityTitle) + '"</h1>';

     return greeting + buildSessionCards(sessions, false) + buildCtaButton(activityId, 'Ver la actividad');
   }

   function buildSessionCards(sessions, includeDate) {
     var cards = sessions.map(function (session) {
       var when = includeDate ? formatDateEs(session.date) : null;
       var time = formatTimeRangeEs(session.time, session.endTime);
       var line = escapeHtml([when, time, session.location].filter(Boolean).join(' · '));
       return (
         '<div style="border:1px solid #e5e9f0;border-radius:10px;padding:14px 16px;margin-bottom:10px;">' +
         '<div style="font-weight:700;color:#111827;font-size:14.5px;">' + escapeHtml(session.title) + '</div>' +
         '<div style="color:#6b7280;font-size:13.5px;margin-top:4px;">' + line + '</div>' +
         '</div>'
       );
     }).join('');

     return '<div style="margin:8px 0 24px;">' + cards + '</div>';
   }

   function buildCtaButton(activityId, label) {
     if (!activityId) return '';
     var url = SITE_URL + '/actividades/' + encodeURIComponent(activityId) + '/';
     return (
       '<div style="text-align:center;margin:8px 0 4px;">' +
       '<a href="' + url + '" style="display:inline-block;background:' + ACCENT_COLOR + ';color:#ffffff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:999px;text-decoration:none;">' + escapeHtml(label) + '</a>' +
       '</div>'
     );
   }

   function getPromoActivitiesHtml() {
     try {
       var response = UrlFetchApp.fetch(PROMO_JSON_URL, { muteHttpExceptions: true });
       var json = JSON.parse(response.getContentText());
       var activities = json.activities || [];
       if (activities.length === 0) return '';

       var items = activities
         .filter(function (activity) { return isSafeUrl(activity.url); })
         .map(function (activity) {
           return (
             '<a href="' + escapeHtml(activity.url) + '" style="display:block;border:1px solid #e5e9f0;border-radius:10px;padding:14px 16px;margin-bottom:10px;text-decoration:none;">' +
             '<div style="font-weight:700;color:' + BRAND_COLOR + ';font-size:14px;">' + escapeHtml(activity.title) + '</div>' +
             '<div style="color:#6b7280;font-size:13px;margin-top:4px;">' + escapeHtml(activity.summary) + '</div>' +
             '</a>'
           );
         }).join('');

       return (
         '<h3 style="color:' + BRAND_COLOR + ';font-size:15px;margin:36px 0 14px;font-weight:700;">Además, te puede interesar</h3>' +
         items
       );
     } catch (err) {
       return '';
     }
   }

   // ====== UTILIDADES ======

   // Valida el token de Turnstile contra la API de Cloudflare — es el único
   // lugar donde realmente se confirma que el envío vino de un navegador
   // real resolviendo el widget, no de un script pegándole directo a este
   // endpoint. `muteHttpExceptions` para que un error de red de Cloudflare
   // no tire una excepción sin controlar: si la verificación en sí falla,
   // se trata como token inválido (falla cerrado, no abierto). Devuelve
   // `errorCodes` (no solo true/false) para que quede el motivo real en la
   // pestaña "Errores" en vez de un genérico "inválido" — los códigos que
   // manda Cloudflare (`invalid-input-secret`, `timeout-or-duplicate`, etc.)
   // están documentados en developers.cloudflare.com/turnstile.
   function verifyTurnstile(token) {
     if (!token) return { success: false, errorCodes: ['missing-token'] };
     try {
       var response = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
         method: 'post',
         payload: { secret: TURNSTILE_SECRET_KEY, response: token },
         muteHttpExceptions: true,
       });
       var result = JSON.parse(response.getContentText());
       return { success: result.success === true, errorCodes: result['error-codes'] || [] };
     } catch (err) {
       return { success: false, errorCodes: ['fetch-exception: ' + String(err)] };
     }
   }

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
     return ScriptApp.getService().getUrl() +
       '?action=unsubscribe&sheet=' + encodeURIComponent(sheetName) +
       '&email=' + encodeURIComponent(email) +
       '&sig=' + signUnsubscribe(sheetName, email);
   }

   // HMAC-SHA256 de "hoja|email" con UNSUBSCRIBE_SECRET, en hex — sin esto,
   // cualquiera podría armar a mano una URL de "darme de baja" para el email
   // de otra persona con solo saber (o adivinar) el nombre de la actividad.
   function signUnsubscribe(sheetName, email) {
     var raw = String(sheetName) + '|' + String(email).toLowerCase();
     var bytes = Utilities.computeHmacSha256Signature(raw, UNSUBSCRIBE_SECRET);
     return bytes.map(function (b) {
       var hex = (b < 0 ? b + 256 : b).toString(16);
       return hex.length === 1 ? '0' + hex : hex;
     }).join('');
   }

   // Cuenta envíos dentro de una ventana de tiempo usando el cache del
   // propio script (compartido entre todas las ejecuciones, hasta 6hs de
   // vida por entrada). No reemplaza un rate limit "de verdad" (por IP) —
   // Apps Script no expone la IP de quien llama — pero frena un script que
   // golpee el endpoint en loop con el mismo email o en general.
   function isRateLimited(key, maxPerWindow, windowSeconds) {
     var cache = CacheService.getScriptCache();
     var current = Number(cache.get(key) || '0');
     if (current >= maxPerWindow) return true;
     cache.put(key, String(current + 1), windowSeconds);
     return false;
   }

   // Como isRateLimited, pero devuelve cuántas veces se llamó dentro de la
   // ventana en vez de solo sí/no — handleCheckin lo usa para ir alargando
   // la demora a medida que se acumulan intentos fallidos, en vez de
   // cortar de golpe en un número fijo.
   function bumpCounter(key, windowSeconds) {
     var cache = CacheService.getScriptCache();
     var current = Number(cache.get(key) || '0') + 1;
     cache.put(key, String(current), windowSeconds);
     return current;
   }

   // Convierte texto a HTML seguro para insertar dentro de un mail — sin
   // esto, alguien podría mandar como "nombre" o "actividad" un pedacito de
   // HTML que termine pareciendo parte legítima del mail (ver auditoría de
   // seguridad, hallazgo "Endpoints de Apps Script sin autenticación, con
   // HTML sin escapar en mails salientes"). Se aplica a TODO campo que
   // venga de un parámetro del formulario antes de meterlo en un mail.
   function escapeHtml(value) {
     return String(value == null ? '' : value)
       .replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;')
       .replace(/'/g, '&#39;');
   }

   // Antes de usar una URL como href, exigir que sea http(s) de verdad —
   // sin esto, alguien podría cargar `confirmationLinkUrl` con algo como
   // "javascript:..." y que termine como link clickeable en el mail.
   function isSafeUrl(url) {
     return typeof url === 'string' && /^https?:\/\//i.test(url);
   }

   function getOrCreateSheet(sheetName) {
     var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
     var sheet = spreadsheet.getSheetByName(sheetName);
     if (!sheet) {
       sheet = spreadsheet.insertSheet(sheetName);
       sheet.appendRow([
         'Fecha', 'Nombre y apellido', 'Email', 'Teléfono',
         'Quiere recordatorio', 'Dado de baja', 'Sessions', 'Recordatorios enviados', 'ActivityId',
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
   //
   // Desde que existe verifyTurnstile() (segunda auditoría de seguridad,
   // septiembre 2026), estas dos funciones van a devolver `{result:'error'}`
   // sin llegar a guardar nada: llaman a doPost directo, sin pasar por el
   // widget de Turnstile, así que nunca tienen un token válido — es el
   // freno funcionando, no un bug. Para probar el flujo completo de verdad,
   // usar el sitio real (ver "Verificar que funciona" más abajo).

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

   function testAgendaReservation() {
     var fakeEvent = {
       parameter: {
         formType: 'agenda',
         name: 'Test Nombre',
         lastName: 'Test Apellido',
         email: 'test@test.com',
         phone: '123456789',
         quantity: '2',
       },
     };
     doPost(fakeEvent);
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

## 6. Configurar el panel admin (`atpfcm.com.ar/staff/panel/`)

Dos valores para cambiar en el script, igual que los otros:

1. **`ADMIN_PASSWORD`**: elegí una contraseña propia (cuanto más larga
   mejor — a diferencia de un PIN de 4 dígitos, acá no hay límite de
   longitud). Pegala en el script.
2. **`ADMIN_TOTP_SECRET`**: este es distinto a los demás — no es algo que
   vos elijas, tiene que ser aleatorio de verdad, y además hay que
   cargarlo en tu app de Google Authenticator (como una cuenta nueva, en
   el mismo celular donde ya tenés las demás). Pasos:
   1. Abrí Google Authenticator en tu celular → **+** (agregar) →
      **Ingresar una clave de configuración** (no "Escanear código QR",
      salvo que generes vos mismo un QR a partir de la clave — no hace
      falta).
   2. **Nombre de la cuenta**: algo que reconozcas, ej. "ATP Panel".
   3. **Tu clave**: pegá acá un secreto en base32 generado al azar (20
      bytes/160 bits, el tamaño recomendado por el estándar) — pedíselo a
      Claude en el chat si estás siguiendo esta guía con su ayuda, o
      generá uno vos mismo con cualquier herramienta de confianza que
      produzca un secreto TOTP en base32.
   4. **Tipo de clave**: `Basado en tiempo`.
   5. Guardar. Ya te tiene que aparecer un código de 6 dígitos que cambia
      cada 30 segundos.
   6. Pegá ese mismo secreto base32 (el de la clave, no un código de 6
      dígitos puntual) en `ADMIN_TOTP_SECRET` del script.

**Nunca compartas `ADMIN_TOTP_SECRET` con nadie más que quiera loguearse
al panel** — cualquiera que lo tenga puede generar los códigos de 6
dígitos sin necesitar tu celular. Si alguna vez se filtra, generá uno
nuevo (repetí los pasos de arriba con un secreto distinto) y volvé a
publicar el script.

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
6. Para el menú de reprogramar: volvé a la pestaña del navegador con la
   planilla abierta y recargala (F5) — el menú **ATP** solo aparece al abrir
   la planilla, así que si la tenías abierta desde antes de pegar el código
   nuevo no va a estar todavía. Abrí la pestaña de la actividad de prueba,
   **ATP → Reprogramar esta actividad**, escribí cualquier mensaje y
   confirmá — debería llegarte el mail a la misma casilla con la que te
   inscribiste en el paso 2.
7. Para charla con certificado + check-in: activá también **"¿Recolectar
   datos completos para certificado + QR de acceso?"** en esa misma
   actividad de prueba. Entrá a la actividad en el sitio, completá el
   formulario nuevo (nombre, apellido, DNI, teléfono, email, carrera, año),
   confirmá en la pantalla de revisión — te debería aparecer el QR en
   pantalla y llegarte por mail.
8. Abrí `atpfcm.com.ar/staff/escanear/` desde el celular. Escribí la clave
   que pusiste en `STAFF_CHECKIN_SECRET` y un nombre de encuentro cualquiera
   (ej. "Encuentro 1"), aceptá el permiso de cámara, y apuntá al QR del paso
   7 (en la pantalla de otro dispositivo o impreso) — debería marcar
   "presente" solo, sin tocar nada, y mostrar tu nombre. Escaneá el mismo QR
   de nuevo: tiene que avisar que ya había entrado a ese encuentro en vez de
   duplicar.
9. Para el link de "darme de baja": abrí el mail de confirmación del paso 3
   y clickeá "Darme de baja de estos mails" — te tiene que llevar a "Listo,
   te dimos de baja". Después, probá pegar esa misma URL pero cambiándole
   el email por otro cualquiera (dejando el resto igual): tiene que mostrar
   "Este link no es válido" en vez de dar de baja a esa otra dirección.
10. Para el freno de envíos: no hace falta probarlo a mano (implica mandar
    varios formularios seguidos) — si alguna vez ves en la planilla que
    dejaron de llegar inscripciones nuevas por un rato después de una racha
    de envíos, revisá la pestaña "Errores" y el registro de ejecución del
    editor; un resultado `rate_limited` es esperado si se mandaron muchas
    en poco tiempo, no un bug.
11. Para el panel admin: abrí `atpfcm.com.ar/staff/` y entrá a "Panel
    admin". Poné `ADMIN_PASSWORD` y el código de 6 dígitos que te muestre
    Google Authenticator para "ATP Panel" en ese momento (cambia cada 30
    segundos, así que tipealo rápido) — te tiene que dejar entrar y
    mostrar el desplegable de actividades con inscriptos reales. Elegí la
    de prueba del paso 7, revisá que aparezca en la tabla, escribí un
    asunto y un mensaje con `<nombre>` en alguna parte, y apretá "Ver
    vista previa" — te tiene que mostrar el asunto y el mensaje ya armados
    con el nombre real de una persona de esa lista, no la etiqueta cruda.
    Recién ahí el botón de mandar se habilita; confirmá el envío y
    revisá tres cosas: que te llegue a tu propio mail con el nombre real,
    que aparezca una fila nueva en la pestaña "Campañas enviadas" (Fecha,
    Hoja, Asunto, Enviados, Total), y que si volvés a tocar cualquier
    campo del formulario después de la vista previa, el botón de mandar se
    vuelve a deshabilitar hasta pedir una vista previa nueva (así nunca se
    manda algo distinto de lo que se vio en pantalla). Probá también con
    la contraseña bien y el código mal (tiene que rechazarlo) antes de
    confiar en que "cualquiera" no puede entrar.

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
- El QR que va **en el mail** de las charlas se genera vía una API pública
  gratuita (api.qrserver.com), no en el propio Apps Script (no tiene forma
  nativa de dibujar un QR) — le llega el `registrationId` (un identificador
  al azar, no datos personales) para que dibuje la imagen. El QR que la
  persona ve **en el sitio** al inscribirse no depende de esto: se genera
  en su propio navegador, sin salir a ningún servicio externo.
