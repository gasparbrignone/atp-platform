// ====== RELAY DE CERTIFICADOS (2026-10-21) ======
//
// Proyecto de Apps Script APARTE del principal: se crea y se implementa
// estando logueado con la cuenta de Google Workspace de ATP, no con la
// que ejecuta el script principal. Manda cada certificado con GmailApp
// desde esa casilla, con el cupo de Workspace (1.500 destinatarios por
// día) en vez del de una cuenta común (100) o el de Resend gratis (100).
//
// El script principal (función sendCertificateEmailViaResend) le hace un
// POST con UrlFetchApp cuando tiene cargadas las propiedades
// CERT_RELAY_URL y CERT_RELAY_SECRET; si no, sigue mandando por Resend.
//
// Puesta en marcha (en este proyecto):
//   1. Correr `probar` desde el editor: autoriza Gmail, crea RELAY_SECRET
//      en las propiedades del script, muestra la cuenta y el cupo que
//      queda hoy, y manda un mail de prueba con un PDF adjunto.
//   2. Implementar → Nueva implementación → Aplicación web, "Ejecutar
//      como: Yo" y "Quién tiene acceso: Cualquier persona". El script
//      principal corre en otra cuenta, así que "solo usuarios del
//      dominio" lo bloquearía. La clave RELAY_SECRET es lo que impide que
//      cualquiera mande mails desde acá.
//   3. En el principal, cargar CERT_RELAY_URL (la URL /exec de la
//      implementación) y CERT_RELAY_SECRET (el mismo valor de acá).

var REMITENTE_NOMBRE = 'ATP - Ciencias Médicas';

// Casilla externa para el mail de `probar` (conviene una Gmail común,
// para ver si llega a la bandeja de entrada o a spam). Vacía = se manda
// a esta misma cuenta.
var PRUEBA_DESTINO = '';

function doPost(e) {
  var datos;
  try {
    datos = JSON.parse(e.postData.contents);
  } catch (err) {
    return relayResponder_({ ok: false, error: 'json_invalido' });
  }

  var secreto = PropertiesService.getScriptProperties().getProperty('RELAY_SECRET');
  if (!secreto || datos.secreto !== secreto) {
    return relayResponder_({ ok: false, error: 'no_autorizado' });
  }

  // Chequeo sin efectos, para probar la conexión desde el principal
  // (probarRelayCertificados) sin mandar nada.
  if (datos.accion === 'cupo') {
    return relayResponder_({
      ok: true,
      cuenta: Session.getEffectiveUser().getEmail(),
      cupo: MailApp.getRemainingDailyQuota(),
    });
  }

  // Un solo destinatario por pedido: sin comas ni punto y coma, que
  // GmailApp interpretaría como varios.
  var para = String(datos.para || '').trim();
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(para)) {
    return relayResponder_({ ok: false, error: 'destinatario_invalido' });
  }
  if (!datos.pdfBase64) {
    return relayResponder_({ ok: false, error: 'sin_adjunto' });
  }

  try {
    var pdf = Utilities.newBlob(
      Utilities.base64Decode(datos.pdfBase64),
      'application/pdf',
      String(datos.nombreArchivo || 'certificado.pdf'),
    );
    GmailApp.sendEmail(para, String(datos.asunto || ''), 'Tu certificado va adjunto a este mail, en PDF.', {
      htmlBody: String(datos.html || ''),
      attachments: [pdf],
      name: REMITENTE_NOMBRE,
    });
    return relayResponder_({ ok: true, cupo: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return relayResponder_({ ok: false, error: String((err && err.message) || err) });
  }
}

function probar() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('RELAY_SECRET')) {
    props.setProperty('RELAY_SECRET', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''));
  }

  var cuenta = Session.getEffectiveUser().getEmail();
  Logger.log('Cuenta que manda: ' + cuenta);
  Logger.log('Cupo de mails que queda hoy: ' + MailApp.getRemainingDailyQuota());
  Logger.log('RELAY_SECRET (copiarlo como CERT_RELAY_SECRET en el script principal): ' + props.getProperty('RELAY_SECRET'));

  var pdf = Utilities.newBlob(
    '<html><body style="font-family:sans-serif"><h1>Prueba de certificado</h1><p>Si ves este PDF, el adjunto funciona.</p></body></html>',
    'text/html',
  ).getAs('application/pdf').setName('prueba-certificado.pdf');

  var destino = PRUEBA_DESTINO || cuenta;
  GmailApp.sendEmail(destino, 'Prueba de envío de certificados', 'Prueba: va un PDF adjunto.', {
    htmlBody: '<p>Prueba del relay de certificados. Va un PDF adjunto.</p>',
    attachments: [pdf],
    name: REMITENTE_NOMBRE,
  });
  Logger.log('Mail de prueba mandado a ' + destino + '. Cupo que queda: ' + MailApp.getRemainingDailyQuota());
}

function relayResponder_(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}
