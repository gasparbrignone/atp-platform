// ============================================================================
// EFS 2026 · Inscripción paga con Mercado Pago (Nivel 1)
// ----------------------------------------------------------------------------
// Archivo aparte dentro del MISMO proyecto de Apps Script de la plataforma.
// Comparte el espacio global con el archivo principal, por eso todo lo de acá
// empieza con "efs" / "EFS_" (no puede haber dos funciones con el mismo
// nombre: la segunda pisaría a la primera en silencio). En particular, NO
// declarar acá onOpen, doGet ni doPost.
//
// Único cambio necesario en el archivo principal, dentro de doPost, ANTES del
// freno de spam global (ver docs/EFS_2026_PLAN.md §10.1):
//
//     if (params.formType === 'efs') return efsRouter(e);
//
// Todo pedido llega desde el Worker del EFS (Cloudflare), nunca directo desde
// un navegador: el Worker verifica Turnstile, frena por IP y manda el secreto
// compartido EFS_WORKER_SECRET. Los secretos viven en Propiedades del script
// (Configuración del proyecto → Propiedades de la secuencia de comandos),
// nunca en este archivo:
//   EFS_WORKER_SECRET  secreto compartido con el Worker
//   EFS_MP_TOKEN       Access Token de Mercado Pago (producción o prueba)
//
// Reglas de forma de las hojas (plan §10.2), porque el código existente
// recorre TODAS las hojas:
//   1. Nunca el booleano true en la columna E (sendReminders).
//   2. Las hojas internas no tienen una columna llamada "Email" (panel).
//   3. "EFS 2026" respeta las 14 columnas de una hoja charla.
//   4. Todo texto que viene del formulario se guarda como texto.
// ============================================================================

var EFS_HOJA_CONFIG = 'EFS · Config';
var EFS_HOJA_PENDIENTES = 'EFS · Pendientes';
var EFS_HOJA_PAGOS = 'EFS · Pagos';
var EFS_HOJA_ENTRADAS = 'EFS 2026';
var EFS_ACTIVITY_ID = 'efs-2026';
var EFS_ZONA = 'America/Argentina/Buenos_Aires';
var EFS_ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // base32 Crockford: sin I, L, O, U

var EFS_COL_PENDIENTES = [
  'referencia', 'alta', 'intento_id', 'nombre', 'dni', 'apellido', 'correo', 'telefono', 'carrera',
  'anio', 'universidad', 'precio', 'estado', 'motivo', 'preferencia_id', 'pago_id', 'entrada', 'actualizado',
];
var EFS_COL_PAGOS = [
  'fecha', 'pago_id', 'referencia', 'status', 'status_detail', 'monto_bruto', 'moneda', 'collector_id',
  'live_mode', 'origen', 'accion', 'detalle',
];
// Las 14 primeras son exactamente las de una hoja charla (mismo orden): así el
// panel y /staff/certificados/ la reconocen sin cambios.
var EFS_COL_ENTRADAS = [
  'Fecha', 'Nombres', 'Apellidos', 'DNI', 'Teléfono', 'Email', 'Carrera', 'Año', 'RegistrationId',
  'Asistencias', 'Dado de baja', 'ActivityId', 'CertificadoEnviado', 'CertificadoError',
  'Universidad', 'Origen', 'PagoId', 'Referencia', 'EstadoEntrada', 'MailEntrada', 'Credencial', 'Taller',
  'AcreditadoEn', 'AcreditadoPor',
];

// Valores iniciales de "EFS · Config". Se editan en la hoja, no acá.
var EFS_CONFIG_INICIAL = [
  ['modo', 'prueba', '"prueba" (usuarios de prueba de Mercado Pago) o "produccion"'],
  ['inscripcion_abierta', 'NO', 'SI / NO'],
  ['cierre', '', 'Fecha y hora de cierre (ej. 16/10/2026 23:59). Vacío = sin cierre automático'],
  ['precio', 5000, 'En pesos. Se congela al abrir la inscripción'],
  ['collector_id', '', 'User ID de la cuenta de Mercado Pago que cobra'],
  ['titulo_cobro', 'Inscripción EFS 2026', 'Lo que ve la persona en Mercado Pago'],
  ['sitio_url', 'https://efsarg.com.ar', 'Sitio al que vuelve la persona después de pagar'],
  ['webhook_url', '', 'URL del Worker del EFS que recibe los avisos de Mercado Pago (termina en /mp/aviso)'],
  ['evento_nombre', 'Encuentro de Formación en Salud', ''],
  ['evento_fecha', '', 'Texto para el mail. Ej.: sábado 10 de mayo, de 9 a 17 h'],
  ['evento_lugar', 'Facultad de Ciencias Médicas (UNR), Santa Fe 3100, Rosario', 'Texto para el mail'],
  ['mail_remitente', 'EFS · Encuentro de Formación en Salud', 'Nombre del remitente'],
  ['mail_responder_a', '', 'Correo al que llegan las respuestas (opcional)'],
  ['mail_admin', '', 'A quién le llegan los avisos de anomalías. Vacío = la cuenta del script'],
  ['mail_proveedor', 'auto', 'auto (Gmail; sin cupo, SMTP2GO, Resend y Brevo) / gmail / smtp2go / resend / brevo'],
  ['acreditacion', '', 'Horario de la acreditación, para el mail. Ej.: Desde las 9 h'],
  ['whatsapp', '5493415845571', 'WhatsApp de consultas que aparece en el mail (solo números, con 549)'],
];

// ─────────────────────────── entrada desde doPost ───────────────────────────

function efsRouter(e) {
  var p = (e && e.parameter) || {};
  try {
    if (!efsSecretoValido_(p.efs_secreto)) return efsJson_({ ok: false, error: 'no_autorizado' });
    switch (p.accion) {
      case 'iniciar': return efsJson_(efsIniciar_(p));
      case 'verificar': return efsJson_(efsVerificar_(p.pago_id, p.referencia));
      case 'aviso': return efsJson_(efsAviso_(p.tipo, p.id));
      case 'admin_resumen': return efsJson_(efsAdmin_(p, efsAdminResumen_));
      case 'admin_buscar': return efsJson_(efsAdmin_(p, efsAdminBuscar_));
      case 'admin_procesar': return efsJson_(efsAdmin_(p, efsAdminProcesar_));
      case 'admin_reenviar': return efsJson_(efsAdmin_(p, efsAdminReenviar_));
      case 'staff_lista': return efsJson_(efsStaffLista_());
      case 'staff_sync': return efsJson_(efsStaffSync_(p.lote));
      case 'admin_conciliar': return efsJson_(efsAdmin_(p, function () { return efsConciliar(); }));
      default: return efsJson_({ ok: false, error: 'accion_desconocida' });
    }
  } catch (err) {
    logError('efs-' + String(p.accion || 'sin-accion'), err, efsParaLog_(p));
    return efsJson_({ ok: false, error: 'interno' });
  }
}

// ─────────────────────────── F1 · iniciar inscripción ───────────────────────────

function efsIniciar_(p) {
  var c = efsConfig_();
  if (!efsInscripcionAbierta_(c)) return { ok: false, error: 'cerrada' };

  var d = efsValidarDatos_(p);
  if (d.error) return { ok: false, error: 'datos', campo: d.error };

  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(10000)) return { ok: false, error: 'ocupado' };
  var ref;
  try {
    var entrada = efsBuscarEntradaActivaPorDni_(d.dni);
    if (entrada) return { ok: false, error: 'ya_inscripto' };

    var hoja = efsHoja_(EFS_HOJA_PENDIENTES);
    var filas = hoja.getDataRange().getValues();
    var col = efsIndices_(filas[0]);
    var i = efsBuscarFila_(filas, col.intento_id, d.intento_id);
    var porDni = false;
    if (i < 0) {
      i = efsBuscarFila_(filas, col.dni, d.dni, function (fila) {
        return ['pendiente', 'rechazado', 'abandonado'].indexOf(String(fila[col.estado])) !== -1;
      });
      porDni = i >= 0;
    }
    var ahora = new Date();
    if (i >= 0) {
      ref = String(filas[i][col.referencia]);
      var fila = filas[i].slice();
      var correoGuardado = String(fila[col.correo]).replace(/^'/, '').trim().toLowerCase();
      if (porDni && String(fila[col.estado]) === 'pendiente' && correoGuardado !== d.correo) {
        // Otro intento con el mismo DNI y OTRO correo mientras hay un pago en curso: conocer el DNI no alcanza para
        // pisar los datos de la inscripción original (si no, la entrada saldría al correo de quien lo reescribió).
        // La fila queda como estaba y el cobro se arma con los datos guardados.
        d.nombre = String(fila[col.nombre]).replace(/^'/, '');
        d.apellido = String(fila[col.apellido]).replace(/^'/, '');
        d.correo = String(fila[col.correo]).replace(/^'/, '');
      } else {
        efsAsignar_(fila, col, {
          intento_id: d.intento_id, nombre: d.nombre, apellido: d.apellido, correo: d.correo, telefono: d.telefono,
          carrera: d.carrera, anio: d.anio, universidad: d.universidad, precio: c.precio, estado: 'pendiente',
          motivo: '', actualizado: ahora,
        });
        hoja.getRange(i + 1, 1, 1, fila.length).setValues([efsComoTexto_(fila, col)]);
      }
    } else {
      ref = efsNuevaReferencia_();
      var nueva = efsFilaVacia_(EFS_COL_PENDIENTES);
      efsAsignar_(nueva, col, {
        referencia: ref, alta: ahora, intento_id: d.intento_id, nombre: d.nombre, dni: d.dni, apellido: d.apellido,
        correo: d.correo, telefono: d.telefono, carrera: d.carrera, anio: d.anio, universidad: d.universidad,
        precio: c.precio, estado: 'pendiente', actualizado: ahora,
      });
      hoja.appendRow(efsComoTexto_(nueva, col));
    }
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  // Fuera del candado: la llamada a Mercado Pago puede tardar segundos y no
  // tiene por qué frenar a las demás inscripciones.
  var preferencia;
  try {
    preferencia = efsCrearPreferencia_(c, ref, d);
  } catch (err) {
    logError('efs-preferencia', err, { referencia: ref });
    return { ok: false, error: 'mp' };
  }
  efsActualizarPendiente_(ref, { preferencia_id: preferencia.id, actualizado: new Date() });
  // Siempre init_point: Mercado Pago ya no tiene sandbox. Las pruebas se hacen
  // con las credenciales del usuario de prueba vendedor y pagando con el
  // usuario de prueba comprador, sobre el mismo init_point.
  return { ok: true, pago_url: preferencia.init_point, referencia: ref };
}

function efsCrearPreferencia_(c, ref, d) {
  var sitio = String(c.sitio_url).replace(/\/$/, '');
  // En modo prueba se permite volver a la vista previa local (http://localhost).
  var local = c.modo !== 'produccion' && /^http:\/\/localhost(:\d+)?$/.test(sitio);
  if (!/^https:\/\//.test(sitio) && !local) throw new Error('sitio_url tiene que empezar con https://');
  if (c.webhook_url && !/^https:\/\//.test(String(c.webhook_url))) throw new Error('webhook_url tiene que empezar con https://');
  var cuerpo = {
    items: [{
      id: EFS_ACTIVITY_ID, title: String(c.titulo_cobro), description: 'Entrada personal al ' + c.evento_nombre,
      category_id: 'tickets', quantity: 1, unit_price: Number(c.precio), currency_id: 'ARS',
    }],
    payer: { name: d.nombre, surname: d.apellido, email: d.correo, identification: { type: 'DNI', number: d.dni } },
    external_reference: ref,
    // Aprobado o rechazado en el momento, sin pagos "en revisión" que se
    // resuelven horas después (recomendación de la lista de calidad de MP).
    binary_mode: true,
    back_urls: {
      success: sitio + '/?pago=aprobado',
      pending: sitio + '/?pago=pendiente',
      failure: sitio + '/?pago=rechazado',
    },
    payment_methods: {
      excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }],
      installments: 1,
    },
    statement_descriptor: 'EFS 2026',
    metadata: { referencia: ref },
  };
  // auto_return exige https: con la vista previa local, Mercado Pago muestra un botón "Volver al sitio".
  if (!local) cuerpo.auto_return = 'approved';
  if (c.webhook_url) cuerpo.notification_url = String(c.webhook_url);
  var cierre = efsFecha_(c.cierre);
  if (cierre) {
    cuerpo.expires = true;
    cuerpo.expiration_date_to = efsIsoMp_(cierre);
  }
  return efsMp_('post', '/checkout/preferences', cuerpo, ref + '-' + d.intento_id);
}

// ─────────────────────────── F2 · procesar un pago ───────────────────────────

// Idempotente: se puede llamar cuantas veces haga falta con el mismo pago
// (webhook, vuelta al sitio, barrido, conciliación, panel) y el resultado es
// siempre el mismo. Devuelve { estado, referencia, codigo, nombre }.
function efsProcesarPago(pagoId, origen) {
  var id = String(pagoId || '').replace(/[^0-9]/g, '');
  if (!id) return { estado: 'invalido' };
  var pago = efsMp_('get', '/v1/payments/' + id);
  return efsProcesarPagoObtenido_(pago, origen);
}

function efsProcesarPagoObtenido_(pago, origen) {
  var c = efsConfig_();
  var ref = String(pago.external_reference || '');
  if (ref.indexOf('EFSP-') !== 0) {
    // La cuenta es personal: puede recibir pagos que no son del EFS. No se tocan.
    return { estado: 'ajeno' };
  }

  var resultado;
  var aEnviar = null;
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    resultado = efsAplicarPago_(pago, c);
    if (resultado.emitida) aEnviar = resultado.codigo;
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  // Un mismo problema del mismo pago se avisa una sola vez: el barrido lo vuelve a ver cada 10 minutos
  // y, sin esto, el aviso se repetiría cada 30 minutos hasta que el pago salga de la ventana de 3 horas.
  var yaAvisado = resultado.aviso ? efsYaRegistrado_(pago.id, resultado.accion, resultado.detalle) : false;
  efsRegistrarPago_(pago, origen, resultado.accion, resultado.detalle);

  if (resultado.aviso && !yaAvisado) efsAvisar_(resultado.aviso, resultado.detalle + '\n\nPago ' + pago.id + ' · referencia ' + ref);
  if (aEnviar) {
    efsVencerPreferencia_(resultado.preferencia_id);
    efsEnviarEntrada_(aEnviar);
  }
  return { estado: resultado.estado, referencia: ref, codigo: resultado.codigo || '', nombre: resultado.nombre || '' };
}

// Decide qué hacer con un pago. Se llama SIEMPRE con el candado tomado.
function efsAplicarPago_(pago, c) {
  var ref = String(pago.external_reference);
  var pagoId = String(pago.id);
  var hoja = efsHoja_(EFS_HOJA_PENDIENTES);
  var filas = hoja.getDataRange().getValues();
  var col = efsIndices_(filas[0]);
  var i = efsBuscarFila_(filas, col.referencia, ref);
  if (i < 0) {
    return { estado: 'anomalia', accion: 'anomalia', detalle: 'Pago con una referencia que no existe en Pendientes', aviso: 'EFS: pago sin inscripción' };
  }
  var fila = filas[i];
  var r = {
    estado: String(fila[col.estado]), preferencia_id: String(fila[col.preferencia_id] || ''),
    nombre: fila[col.nombre] + ' ' + fila[col.apellido], codigo: String(fila[col.entrada] || ''),
  };
  var cambios = { actualizado: new Date() };
  var status = String(pago.status);

  if (status === 'approved') {
    var problema = efsProblemaDelPago_(pago, fila, col, c);
    if (problema) {
      if (r.codigo) {
        r.accion = 'ignorado'; r.detalle = 'Pago inválido (' + problema + ') sobre una referencia que ya tiene entrada';
        r.aviso = 'EFS: pago inválido sobre una inscripción ya paga';
      } else {
        cambios.estado = 'anomalia'; cambios.motivo = problema; cambios.pago_id = pagoId;
        r.estado = 'anomalia'; r.accion = 'anomalia'; r.detalle = problema; r.aviso = 'EFS: pago aprobado que no cumple las condiciones';
      }
    } else if (r.codigo && String(fila[col.pago_id]) === pagoId) {
      r.estado = 'pagado'; r.accion = 'sin_cambios'; r.detalle = 'Ya procesado';
    } else if (r.codigo) {
      r.accion = 'duplicado'; r.detalle = 'Segundo pago aprobado para una inscripción que ya tiene entrada (' + r.codigo + '). Hay que devolverlo.';
      r.aviso = 'EFS: pago duplicado para devolver';
    } else {
      r.codigo = efsEmitirEntrada_(fila, col, pagoId, 'pago');
      cambios.estado = 'pagado'; cambios.motivo = ''; cambios.pago_id = pagoId; cambios.entrada = r.codigo;
      r.estado = 'pagado'; r.accion = 'entrada_emitida'; r.detalle = r.codigo; r.emitida = true;
    }
  } else if (status === 'refunded' || status === 'charged_back') {
    if (r.codigo && String(fila[col.pago_id]) === pagoId) {
      var acreditado = efsRevocarEntrada_(r.codigo);
      cambios.estado = 'devuelto'; cambios.motivo = status;
      r.estado = 'devuelto'; r.accion = 'entrada_revocada'; r.detalle = r.codigo + (acreditado ? ' (YA ESTABA ACREDITADO)' : '');
      r.aviso = 'EFS: entrada revocada por ' + (status === 'refunded' ? 'devolución' : 'contracargo');
    } else {
      r.accion = 'sin_cambios'; r.detalle = 'Devolución de un pago que no generó entrada';
    }
  } else if (status === 'rejected' || status === 'cancelled') {
    if (!r.codigo && r.estado === 'pendiente') { cambios.estado = 'rechazado'; r.estado = 'rechazado'; }
    r.accion = 'sin_cambios'; r.detalle = status;
  } else {
    r.accion = 'sin_cambios'; r.detalle = status; // pending, in_process, authorized...
  }
  // Devolución parcial: el pago sigue "approved" pero con monto devuelto.
  if (status === 'approved' && Number(pago.transaction_amount_refunded || 0) > 0) {
    r.aviso = 'EFS: devolución parcial para revisar';
    r.detalle = (r.detalle ? r.detalle + ' · ' : '') + 'devolución parcial de $' + pago.transaction_amount_refunded;
  }

  var nueva = fila.slice();
  efsAsignar_(nueva, col, cambios);
  hoja.getRange(i + 1, 1, 1, nueva.length).setValues([nueva]);
  return r;
}

// Condición I-3 del plan. Devuelve null si el pago es válido, o el motivo.
function efsProblemaDelPago_(pago, fila, col, c) {
  if (Number(pago.transaction_amount) !== Number(fila[col.precio])) return 'monto ' + pago.transaction_amount + ' distinto de ' + fila[col.precio];
  if (pago.currency_id !== 'ARS') return 'moneda ' + pago.currency_id;
  if (!c.collector_id) return 'falta collector_id en EFS · Config';
  if (String(pago.collector_id) !== String(c.collector_id)) return 'cobrador ' + pago.collector_id + ' distinto del configurado';
  var esperado = c.modo === 'produccion';
  if (Boolean(pago.live_mode) !== esperado) return 'live_mode ' + pago.live_mode + ' en modo ' + c.modo;
  if (pago.operation_type && pago.operation_type !== 'regular_payment') return 'operación ' + pago.operation_type;
  return null;
}

function efsEmitirEntrada_(filaPendiente, col, pagoId, origen) {
  var hoja = efsHoja_(EFS_HOJA_ENTRADAS);
  var existentes = efsColumna_(hoja, 'RegistrationId');
  var codigo;
  do { codigo = efsNuevoCodigo_(); } while (existentes.indexOf(codigo) !== -1);

  var e = efsIndices_(EFS_COL_ENTRADAS);
  var fila = efsFilaVacia_(EFS_COL_ENTRADAS);
  efsAsignar_(fila, e, {
    'Fecha': new Date(), 'Nombres': filaPendiente[col.nombre], 'Apellidos': filaPendiente[col.apellido],
    'DNI': filaPendiente[col.dni], 'Teléfono': filaPendiente[col.telefono], 'Email': filaPendiente[col.correo],
    'Carrera': filaPendiente[col.carrera], 'Año': filaPendiente[col.anio], 'RegistrationId': codigo,
    'Asistencias': '[]', 'Dado de baja': false, 'ActivityId': EFS_ACTIVITY_ID,
    'Universidad': filaPendiente[col.universidad], 'Origen': origen, 'PagoId': pagoId,
    'Referencia': filaPendiente[col.referencia], 'EstadoEntrada': 'activa',
  });
  hoja.appendRow(efsComoTexto_(fila, e));
  return codigo;
}

function efsRevocarEntrada_(codigo) {
  var hoja = efsHoja_(EFS_HOJA_ENTRADAS);
  var filas = hoja.getDataRange().getValues();
  var e = efsIndices_(filas[0]);
  var i = efsBuscarFila_(filas, e.RegistrationId, codigo);
  if (i < 0) return false;
  hoja.getRange(i + 1, e.EstadoEntrada + 1).setValue('revocada');
  return Boolean(filas[i][e.AcreditadoEn]);
}

function efsVencerPreferencia_(preferenciaId) {
  if (!preferenciaId) return;
  try {
    efsMp_('put', '/checkout/preferences/' + preferenciaId, { expires: true, expiration_date_to: efsIsoMp_(new Date()) });
  } catch (err) {
    logError('efs-vencer-preferencia', err, { preferencia: preferenciaId });
  }
}

// ─────────────────────────── F3 · vuelta del pago ───────────────────────────

function efsVerificar_(pagoId, referencia) {
  var r = efsProcesarPago(pagoId, 'retorno');
  if (r.estado === 'invalido' || r.estado === 'ajeno' || r.referencia !== String(referencia || '')) {
    return { ok: false, error: 'no_coincide' };
  }
  if (r.estado !== 'pagado') return { ok: true, estado: r.estado };
  return { ok: true, estado: 'pagado', codigo: r.codigo, nombre: r.nombre };
}

// Aviso de Mercado Pago reenviado por el Worker (tipo payment o merchant_order).
function efsAviso_(tipo, id) {
  var limpio = String(id || '').replace(/[^0-9]/g, '');
  if (!limpio) return { ok: false, error: 'sin_id' };
  if (tipo === 'merchant_order') {
    var orden = efsMp_('get', '/merchant_orders/' + limpio);
    (orden.payments || []).forEach(function (pg) { efsProcesarPago(pg.id, 'webhook'); });
    return { ok: true };
  }
  var r = efsProcesarPago(limpio, 'webhook');
  return { ok: true, estado: r.estado };
}

// ─────────────────────────── F4 · barrido y conciliación ───────────────────────────

// Disparador cada 10 minutos (instalar con efsInstalarBarrido). Es la
// garantía de que ningún pago queda sin procesar aunque se pierdan todos los
// webhooks o el Worker esté caído.
function efsBarrido() {
  var inicio = Date.now();
  var c = efsConfig_();
  var cierre = efsFecha_(c.cierre);
  var terminado = cierre && Date.now() > cierre.getTime() + 36 * 3600 * 1000;

  if (!terminado) {
    // 1. Todo pago del EFS que cambió en las últimas 3 horas (aprobados nuevos,
    //    devoluciones, contracargos). La API no filtra por prefijo: se filtra acá.
    efsBuscarPagos_('range=date_last_updated&begin_date=NOW-3HOURS&end_date=NOW', function (pago) {
      if (Date.now() - inicio > 240000) return false;
      efsProcesarPagoSeguro_(pago, 'barrido');
      return true;
    });

    // 2. Pendientes de menos de 48 h, uno por uno por referencia exacta.
    //    Los más viejos pasan a "abandonado".
    var hoja = efsHoja_(EFS_HOJA_PENDIENTES);
    var filas = hoja.getDataRange().getValues();
    var col = efsIndices_(filas[0]);
    for (var i = 1; i < filas.length && Date.now() - inicio < 240000; i++) {
      if (filas[i][col.estado] !== 'pendiente') continue;
      var alta = efsFecha_(filas[i][col.alta]);
      if (alta && Date.now() - alta.getTime() > 48 * 3600 * 1000) {
        efsActualizarPendiente_(filas[i][col.referencia], { estado: 'abandonado', actualizado: new Date() }, 'pendiente');
        continue;
      }
      efsBuscarPagos_('external_reference=' + encodeURIComponent(filas[i][col.referencia]), function (pago) {
        efsProcesarPagoSeguro_(pago, 'barrido');
        return true;
      });
    }
  }

  // 3. Mails de entradas que no salieron (cuota, error de Gmail, etc.).
  efsReintentarMails_(inicio);
}

// Recorre TODOS los pagos del EFS desde el inicio (paginado), procesa los que
// falten y manda el reporte al admin. Se usa desde el panel y, en el Nivel 2,
// con un disparador diario.
function efsConciliar() {
  var reporte = { aprobados: 0, bruto: 0, emitidas: 0, anomalias: [], devueltos: 0 };
  efsBuscarPagos_('range=date_created&begin_date=NOW-60DAYS&end_date=NOW', function (pago) {
    var r = efsProcesarPagoSeguro_(pago, 'conciliacion');
    if (!r) return true;
    if (pago.status === 'approved') { reporte.aprobados++; reporte.bruto += Number(pago.transaction_amount) || 0; }
    if (r.estado === 'anomalia' || r.estado === 'error') reporte.anomalias.push(pago.id + ' (' + pago.external_reference + ')');
    if (pago.status === 'refunded' || pago.status === 'charged_back') reporte.devueltos++;
    return true;
  });

  var entradas = efsHoja_(EFS_HOJA_ENTRADAS).getDataRange().getValues();
  var e = efsIndices_(entradas[0]);
  var pagas = 0, cortesias = 0, sinMail = 0;
  entradas.slice(1).forEach(function (f) {
    if (f[e.EstadoEntrada] !== 'activa') return;
    if (f[e.Origen] === 'cortesia') cortesias++; else pagas++;
    if (!efsMailEnviado_(f[e.MailEntrada])) sinMail++;
  });
  reporte.emitidas = pagas;
  reporte.cortesias = cortesias;
  reporte.sin_mail = sinMail;
  reporte.cuadra = reporte.aprobados === pagas + reporte.devueltos || reporte.aprobados === pagas;

  var texto = [
    'Pagos aprobados en Mercado Pago: ' + reporte.aprobados + ' (bruto $' + reporte.bruto + ')',
    'Entradas pagas activas: ' + pagas,
    'Cortesías: ' + cortesias,
    'Devoluciones / contracargos: ' + reporte.devueltos,
    'Entradas cuyo mail todavía no salió: ' + sinMail,
    'Anomalías: ' + (reporte.anomalias.length ? reporte.anomalias.join(', ') : 'ninguna'),
    '',
    'Los montos son brutos: lo acreditado en la cuenta es menor por la comisión de Mercado Pago y las retenciones. Eso no es un error.',
  ].join('\n');
  efsAvisar_('EFS: conciliación', texto, true);
  return { ok: true, reporte: reporte };
}

function efsProcesarPagoSeguro_(pago, origen) {
  try {
    return efsProcesarPagoObtenido_(pago, origen);
  } catch (err) {
    logError('efs-procesar-' + origen, err, { pago: pago && pago.id });
    return { estado: 'error' };
  }
}

// Pagina /v1/payments/search. `alVisitar` devuelve false para cortar.
function efsBuscarPagos_(filtro, alVisitar) {
  var offset = 0;
  var limite = 50;
  for (var vueltas = 0; vueltas < 40; vueltas++) {
    var res = efsMp_('get', '/v1/payments/search?sort=date_created&criteria=asc&limit=' + limite + '&offset=' + offset + '&' + filtro);
    var lista = res.results || [];
    for (var k = 0; k < lista.length; k++) {
      if (String(lista[k].external_reference || '').indexOf('EFSP-') !== 0) continue;
      if (alVisitar(lista[k]) === false) return;
    }
    offset += lista.length;
    var total = res.paging ? Number(res.paging.total) : 0;
    if (!lista.length || offset >= total) return;
  }
}

// ─────────────────────────── mails ───────────────────────────

function efsEnviarEntrada_(codigo) {
  var hoja = efsHoja_(EFS_HOJA_ENTRADAS);
  var filas = hoja.getDataRange().getValues();
  var e = efsIndices_(filas[0]);
  var i = efsBuscarFila_(filas, e.RegistrationId, codigo);
  if (i < 0 || filas[i][e.EstadoEntrada] !== 'activa') return false;

  var c = efsConfig_();
  var estado;
  try {
    var usado = efsEnviarMail_(efsArmarMailEntrada_(filas[i], e, c), c);
    if (usado) {
      estado = efsTextoFecha_(new Date()) + (usado === 'gmail' ? '' : ' (' + { smtp2go: 'SMTP2GO', resend: 'Resend', brevo: 'Brevo' }[usado] + ')');
    } else {
      estado = 'pendiente: sin cupo de mails hoy';
      efsAvisar_('EFS: sin cupo de mails', 'Gmail, SMTP2GO, Resend y Brevo no tienen cupo disponible. Las entradas pendientes se mandan solas en los próximos barridos.');
    }
  } catch (err) {
    estado = 'error: ' + String(err && err.message ? err.message : err).slice(0, 120);
    logError('efs-mail', err, { codigo: codigo });
  }
  hoja.getRange(i + 1, e.MailEntrada + 1).setValue(estado);
  return efsMailEnviado_(estado);
}

// Manda por Gmail, SMTP2GO, Resend o Brevo según "mail_proveedor" (auto / gmail / smtp2go / resend / brevo).
// En "auto" usa Gmail mientras le queden al menos 30 envíos en el día; después
// SMTP2GO (1.000 por mes), Resend (100 por día) y por último Brevo (300 por día,
// el único que no incrusta el QR). Si uno falla o no está
// configurado, prueba con el siguiente. Devuelve el proveedor usado o '' si ninguno tiene cupo.
function efsEnviarMail_(mail, c) {
  var cuotaGmail = MailApp.getRemainingDailyQuota();
  var preferido = String(c.mail_proveedor || 'auto').trim().toLowerCase();
  var orden = ['gmail', 'smtp2go', 'resend', 'brevo'];
  if (preferido === 'smtp2go' || preferido === 'brevo' || preferido === 'resend') orden = [preferido].concat(orden.filter(function (p) { return p !== preferido; }));
  var ultimoError = null;
  for (var k = 0; k < orden.length; k++) {
    var p = orden[k];
    if (p === 'gmail' && cuotaGmail < 30) continue;
    if (p === 'smtp2go' && !efsSmtp2goDisponible_()) continue;
    if (p === 'brevo' && !efsBrevoDisponible_()) continue;
    if (p === 'resend' && !efsResendDisponible_()) continue;
    try {
      if (p === 'gmail') efsMandarPorGmail_(mail, c);
      else if (p === 'smtp2go') efsMandarPorSmtp2go_(mail, c);
      else if (p === 'brevo') efsMandarPorBrevo_(mail, c);
      else efsMandarPorResend_(mail, c);
      return p;
    } catch (err) {
      ultimoError = err;
      logError('efs-mail-' + p, err, {});
    }
  }
  if (ultimoError) throw ultimoError;
  return '';
}

function efsMandarPorGmail_(mail, c) {
  var opciones = { name: String(c.mail_remitente), htmlBody: mail.html };
  if (mail.qr) opciones.inlineImages = { qr: mail.qr };
  if (c.mail_responder_a) opciones.replyTo = String(c.mail_responder_a);
  GmailApp.sendEmail(mail.para, mail.asunto, mail.plano, opciones);
}

// RESEND_API_KEY y RESEND_FROM_EMAIL son las del archivo principal (certificados).
function efsResendDisponible_() {
  return typeof RESEND_API_KEY === 'string' && RESEND_API_KEY !== '' &&
    typeof RESEND_FROM_EMAIL === 'string' && RESEND_FROM_EMAIL !== '';
}

// SMTP2GO_API_KEY va en las propiedades de la secuencia de comandos. El remitente
// (SMTP2GO_FROM_EMAIL, opcional) tiene que ser una dirección o dominio verificado en SMTP2GO.
function efsSmtp2goClave_() { return PropertiesService.getScriptProperties().getProperty('SMTP2GO_API_KEY') || ''; }
function efsSmtp2goRemitente_() { return PropertiesService.getScriptProperties().getProperty('SMTP2GO_FROM_EMAIL') || 'efs@atpfcm.com.ar'; }
function efsSmtp2goDisponible_() { return efsSmtp2goClave_() !== ''; }

// SMTP2GO sí incrusta imágenes: el QR va en "inlines" y el HTML lo referencia por cid.
function efsMandarPorSmtp2go_(mail, c) {
  var cuerpo = {
    sender: String(c.mail_remitente) + ' <' + efsSmtp2goRemitente_() + '>',
    to: [mail.para], subject: mail.asunto, html_body: mail.html, text_body: mail.plano,
    custom_headers: [{ header: 'Reply-To', value: String(c.mail_responder_a || Session.getEffectiveUser().getEmail()) }],
  };
  if (mail.qr) cuerpo.inlines = [{ filename: 'qr', mimetype: 'image/png', fileblob: Utilities.base64Encode(mail.qr.getBytes()) }];
  var r = UrlFetchApp.fetch('https://api.smtp2go.com/v3/email/send', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'X-Smtp2go-Api-Key': efsSmtp2goClave_() }, payload: JSON.stringify(cuerpo),
  });
  var texto = String(r.getContentText());
  var datos = {};
  try { datos = JSON.parse(texto).data || {}; } catch (err) { /* respuesta no JSON */ }
  if (r.getResponseCode() >= 300 || datos.failed > 0) throw new Error('SMTP2GO ' + r.getResponseCode() + ': ' + texto.slice(0, 150));
}

// BREVO_API_KEY va en las propiedades de la secuencia de comandos. El remitente
// (BREVO_FROM_EMAIL, opcional) tiene que ser una dirección verificada en Brevo.
function efsBrevoClave_() { return PropertiesService.getScriptProperties().getProperty('BREVO_API_KEY') || ''; }
function efsBrevoRemitente_() { return PropertiesService.getScriptProperties().getProperty('BREVO_FROM_EMAIL') || 'efs@atpfcm.com.ar'; }
function efsBrevoDisponible_() { return efsBrevoClave_() !== ''; }

// Brevo no acepta imágenes incrustadas por CID: el QR va como imagen enlazada
// (mismo generador que usa el sitio) y además adjunto, por si el mail bloquea imágenes.
function efsMandarPorBrevo_(mail, c) {
  var html = mail.html;
  if (mail.qr && mail.codigo) html = html.split('cid:qr').join('https://api.qrserver.com/v1/create-qr-code/?size=480x480&margin=16&ecc=M&format=png&data=' + encodeURIComponent(mail.codigo));
  var cuerpo = {
    sender: { name: String(c.mail_remitente), email: efsBrevoRemitente_() },
    to: [{ email: mail.para }], subject: mail.asunto, htmlContent: html, textContent: mail.plano,
    replyTo: { email: String(c.mail_responder_a || Session.getEffectiveUser().getEmail()) },
  };
  if (mail.qr) cuerpo.attachment = [{ name: 'entrada-efs.png', content: Utilities.base64Encode(mail.qr.getBytes()) }];
  var r = UrlFetchApp.fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'api-key': efsBrevoClave_(), accept: 'application/json' }, payload: JSON.stringify(cuerpo),
  });
  if (r.getResponseCode() >= 300) throw new Error('Brevo ' + r.getResponseCode() + ': ' + String(r.getContentText()).slice(0, 150));
}

function efsMandarPorResend_(mail, c) {
  var cuerpo = {
    from: String(c.mail_remitente) + ' <' + RESEND_FROM_EMAIL + '>',
    to: [mail.para], subject: mail.asunto, html: mail.html, text: mail.plano,
  };
  // Sin "mail_responder_a", las respuestas van a la cuenta del script (no a la casilla de certificados).
  cuerpo.reply_to = String(c.mail_responder_a || Session.getEffectiveUser().getEmail());
  if (mail.qr) cuerpo.attachments = [{ filename: 'entrada-efs.png', content: Utilities.base64Encode(mail.qr.getBytes()), content_id: 'qr' }];
  var r = UrlFetchApp.fetch('https://api.resend.com/emails', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + RESEND_API_KEY }, payload: JSON.stringify(cuerpo),
  });
  if (r.getResponseCode() >= 300) throw new Error('Resend ' + r.getResponseCode() + ': ' + String(r.getContentText()).slice(0, 150));
}

function efsArmarMailEntrada_(fila, e, c) {
  var codigo = String(fila[e.RegistrationId]);
  var nombre = String(fila[e.Nombres]);
  var sitio = String(c.sitio_url).replace(/\/$/, '');
  var link = sitio + '/entrada/#' + codigo;

  var qrBlob = null;
  var imagen = '';
  try {
    // Se pide desde el servidor y va adjunta en el mail (CID): el celular de
    // quien abre el mail no depende de ningún servicio externo.
    var qr = UrlFetchApp.fetch('https://api.qrserver.com/v1/create-qr-code/?size=480x480&margin=16&ecc=M&format=png&data=' + encodeURIComponent(codigo), { muteHttpExceptions: true });
    if (qr.getResponseCode() === 200) {
      qrBlob = qr.getBlob().setName('entrada-efs.png');
      imagen = '<img src="cid:qr" width="240" height="240" alt="Código QR de tu entrada" style="display:block;margin:0 auto 12px;border:0">';
    }
  } catch (err) {
    logError('efs-qr', err, { codigo: codigo });
  }

  var titular = String(fila[e.Nombres]) + ' ' + String(fila[e.Apellidos]);
  var dni = String(fila[e.DNI]).replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  var html = efsHtmlMailEntrada_({
    nombre: nombre, titular: titular, dni: dni, codigo: codigo, link: link, sitio: sitio, qr: imagen !== '',
    fecha: String(c.evento_fecha || ''), lugar: String(c.evento_lugar || ''), evento: String(c.evento_nombre),
    whatsapp: String(c.whatsapp || '').replace(/\D/g, ''), acreditacion: String(c.acreditacion || ''),
  });

  var plano = 'Hola ' + nombre + ', ya estás inscripto/a al ' + c.evento_nombre + ' (EFS 2026).\n\n' +
    'Tu entrada: ' + codigo + '\nA nombre de: ' + titular + ' · DNI ' + dni + '\n' +
    'Abrí tu entrada con el QR acá: ' + link + '\n' +
    (c.evento_fecha ? '\nCuándo: ' + c.evento_fecha : '') + (c.acreditacion ? '\nAcreditación: ' + c.acreditacion : '') +
    (c.evento_lugar ? '\nDónde: ' + c.evento_lugar : '') +
    '\n\nEl día del encuentro mostrá el QR en la acreditación: ahí te damos tu credencial y elegís taller.' +
    '\nLa entrada es personal. Guardá este mail o una captura del QR.\n\nATP · ' + sitio.replace(/^https?:\/\//, '');
  return { para: String(fila[e.Email]), asunto: 'Tu entrada al EFS 2026', html: html, plano: plano, qr: qrBlob, codigo: codigo };
}

// Mail de la entrada con la identidad del EFS. Hecho con tablas y estilos en
// línea (lo único que respetan Gmail, Outlook y Apple Mail); la fuente del
// sitio (Chivo) no carga en los mails, así que usa Arial.
function efsHtmlMailEntrada_(d) {
  var NAVY = '#16283F', AZUL = '#1B5286', CELESTE = '#8FC1E3', PAPEL = '#EAF2F9', GRIS = '#4A5F78';
  var f = 'font-family:Arial,Helvetica,sans-serif;';
  var mono = 'font-family:Consolas,\'Courier New\',monospace;';
  var h = escapeHtml;
  var dato = function (etiqueta, valor) {
    return '<tr><td style="' + f + 'padding:10px 0;border-top:1px solid #D5E3EF;font-size:13px;color:' + GRIS + ';width:96px;vertical-align:top">' + h(etiqueta) + '</td>' +
      '<td style="' + f + 'padding:10px 0;border-top:1px solid #D5E3EF;font-size:15px;color:' + NAVY + ';font-weight:bold">' + h(valor) + '</td></tr>';
  };
  var paso = function (n, texto) {
    return '<tr><td style="' + mono + 'font-size:14px;color:' + AZUL + ';width:34px;vertical-align:top;padding:6px 0">' + n + '</td>' +
      '<td style="' + f + 'font-size:15px;line-height:1.45;color:' + NAVY + ';padding:6px 0">' + texto + '</td></tr>';
  };
  var enlace = function (titulo, texto, url) {
    return '<tr><td style="' + f + 'padding:9px 0;border-top:1px solid #C9D8E6;font-size:15px;font-weight:bold;color:' + NAVY + ';width:150px;vertical-align:top">' + h(titulo) + '</td>' +
      '<td style="' + f + 'padding:9px 0;border-top:1px solid #C9D8E6;font-size:15px"><a href="' + h(url) + '" style="color:' + AZUL + ';text-decoration:underline">' + h(texto) + '</a></td></tr>';
  };
  var detalles = (d.fecha ? dato('Cuándo', d.fecha) : '') + (d.acreditacion ? dato('Acreditación', d.acreditacion) : '') +
    (d.lugar ? dato('Dónde', d.lugar) : '') +
    dato('A nombre de', d.titular) + dato('DNI', d.dni);

  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light"><title>Tu entrada al EFS 2026</title></head>' +
    '<body style="margin:0;padding:0;background:' + PAPEL + '">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0">Tu QR para el EFS 2026: mostralo en la acreditación.</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + PAPEL + '"><tr><td align="center" style="padding:24px 12px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">' +

    // Encabezado
    '<tr><td style="background:' + NAVY + ';padding:26px 28px 22px">' +
      // EFS y ATP a la par: mismo alto, mismo color, sin jerarquía entre los dos.
      '<table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
        '<td style="vertical-align:middle;padding-right:20px"><img src="' + h(d.sitio) + '/assets/img/logo-efs-light.png" width="114" height="40" alt="Encuentro de Formación en Salud" style="display:block;border:0;width:114px;height:40px"></td>' +
        '<td style="vertical-align:middle;padding-left:20px;border-left:1px solid #3A5372"><img src="' + h(d.sitio) + '/assets/img/logo-atp-light.png" width="88" height="28" alt="ATP" style="display:block;border:0;width:88px;height:28px"></td>' +
      '</tr></table>' +
      '<p style="' + mono + 'margin:18px 0 0;font-size:13px;color:' + CELESTE + ';letter-spacing:.04em">2.ª edición · 2026</p>' +
    '</td></tr>' +
    '<tr><td style="background:' + CELESTE + ';height:6px;line-height:6px;font-size:0">&nbsp;</td></tr>' +

    // Cuerpo
    '<tr><td style="background:#ffffff;padding:30px 28px 8px">' +
      '<h1 style="' + f + 'margin:0;font-size:32px;line-height:1.05;color:' + NAVY + ';font-weight:900">Tu entrada</h1>' +
      '<p style="' + f + 'margin:12px 0 0;font-size:16px;line-height:1.5;color:' + NAVY + '">Hola ' + h(d.nombre) + ', recibimos tu pago y ya estás inscripto/a al ' + h(d.evento) + '.</p>' +
    '</td></tr>' +

    // QR
    '<tr><td align="center" style="background:#ffffff;padding:22px 28px 6px">' +
      '<table role="presentation" cellpadding="0" cellspacing="0" style="border:2px solid ' + NAVY + '"><tr><td align="center" style="padding:18px 18px 14px">' +
        (d.qr ? '<img src="cid:qr" width="220" height="220" alt="Código QR de tu entrada" style="display:block;border:0;width:220px;height:220px">' : '') +
        '<p style="' + mono + 'margin:' + (d.qr ? '12px' : '0') + ' 0 0;font-size:20px;letter-spacing:.12em;color:' + NAVY + '">' + h(d.codigo) + '</p>' +
      '</td></tr></table>' +
      '<p style="' + f + 'margin:12px 0 0;font-size:13px;color:' + GRIS + '">¿No ves el QR? Abrí tu entrada con el botón de abajo.</p>' +
    '</td></tr>' +

    // Botón
    '<tr><td align="center" style="background:#ffffff;padding:18px 28px 8px">' +
      '<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:' + NAVY + '">' +
        '<a href="' + h(d.link) + '" style="' + f + 'display:inline-block;padding:14px 26px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none">Abrir mi entrada</a>' +
      '</td></tr></table>' +
    '</td></tr>' +

    // Datos
    '<tr><td style="background:#ffffff;padding:22px 28px 6px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + detalles + '</table>' +
    '</td></tr>' +

    // Cómo se usa
    '<tr><td style="background:#ffffff;padding:22px 28px 30px">' +
      '<p style="' + f + 'margin:0 0 6px;font-size:18px;font-weight:bold;color:' + NAVY + '">El día del encuentro</p>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
        paso('01', 'Tené este mail a mano o una captura del QR, con el brillo de la pantalla alto.') +
        paso('02', 'En la acreditación escaneamos tu QR y te damos tu credencial.') +
        paso('03', 'Ahí mismo elegís el taller al que querés ir.') +
      '</table>' +
      '<p style="' + f + 'margin:14px 0 0;font-size:13px;line-height:1.5;color:' + GRIS + '">La entrada es personal. Tu certificado sale con el nombre y el DNI de arriba: si algo está mal, respondé este mail.</p>' +
    '</td></tr>' +

    // Antes del encuentro
    '<tr><td style="background:' + PAPEL + ';padding:24px 28px 26px;border-top:6px solid ' + CELESTE + '">' +
      '<p style="' + f + 'margin:0 0 10px;font-size:18px;font-weight:bold;color:' + NAVY + '">Antes del encuentro</p>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
        enlace('Programa y talleres', 'Mirá charlas, talleres y horarios', d.sitio + '/#programa') +
        enlace('Instagram', 'Novedades en @efs.atp', 'https://instagram.com/efs.atp') +
        (d.whatsapp ? enlace('¿Dudas?', 'Escribinos por WhatsApp', 'https://wa.me/' + d.whatsapp) : '') +
      '</table>' +
    '</td></tr>' +

    // Pie
    '<tr><td style="background:' + NAVY + ';padding:20px 28px">' +
      '<p style="' + f + 'margin:0;font-size:13px;line-height:1.5;color:#C9D8E6">Organiza ATP, agrupación estudiantil de la Facultad de Ciencias Médicas (UNR).</p>' +
      '<p style="' + f + 'margin:6px 0 0;font-size:13px"><a href="' + h(d.sitio) + '" style="color:#ffffff;text-decoration:underline">' + h(d.sitio.replace(/^https?:\/\//, '')) + '</a>' +
        '<span style="color:' + CELESTE + '">&nbsp;·&nbsp;</span><a href="https://instagram.com/efs.atp" style="color:#ffffff;text-decoration:underline">@efs.atp</a></p>' +
    '</td></tr>' +

    '</table></td></tr></table></body></html>';
}

function efsReintentarMails_(inicio) {
  var hoja = efsHoja_(EFS_HOJA_ENTRADAS);
  var filas = hoja.getDataRange().getValues();
  var e = efsIndices_(filas[0]);
  for (var i = 1; i < filas.length && Date.now() - inicio < 280000; i++) {
    if (filas[i][e.EstadoEntrada] !== 'activa' || efsMailEnviado_(filas[i][e.MailEntrada])) continue;
    efsEnviarEntrada_(filas[i][e.RegistrationId]);
  }
}

function efsMailEnviado_(valor) {
  var v = String(valor || '');
  return v !== '' && v.indexOf('error') !== 0 && v.indexOf('pendiente') !== 0;
}

// Aviso al admin. Sin `siempre`, el mismo asunto no se repite más de una vez
// cada 30 minutos (para no llenar la casilla si algo falla en loop).
function efsAvisar_(asunto, texto, siempre) {
  try {
    var cache = CacheService.getScriptCache();
    var clave = 'efs_aviso_' + Utilities.base64Encode(asunto).slice(0, 40);
    if (!siempre && cache.get(clave)) return;
    cache.put(clave, '1', 1800);
    var c = efsConfig_();
    var destino = String(c.mail_admin || Session.getEffectiveUser().getEmail());
    GmailApp.sendEmail(destino, asunto, texto, { name: 'EFS · Sistema de inscripción' });
  } catch (err) {
    logError('efs-aviso', err, { asunto: asunto });
  }
}

// ─────────────────────────── panel (vía Worker, con sesión de admin) ───────────────────────────

function efsAdmin_(p, accion) {
  if (!isValidAdminSession(p.token)) return { ok: false, error: 'no_autorizado' };
  return accion(p);
}

function efsAdminResumen_() {
  var pend = efsHoja_(EFS_HOJA_PENDIENTES).getDataRange().getValues();
  var col = efsIndices_(pend[0]);
  var estados = {};
  pend.slice(1).forEach(function (f) { estados[f[col.estado]] = (estados[f[col.estado]] || 0) + 1; });

  var ent = efsHoja_(EFS_HOJA_ENTRADAS).getDataRange().getValues();
  var e = efsIndices_(ent[0]);
  var lista = ent.slice(1).map(function (f) {
    return {
      codigo: f[e.RegistrationId], nombre: f[e.Nombres], apellido: f[e.Apellidos], dni: String(f[e.DNI]),
      correo: f[e.Email], origen: f[e.Origen], estado: f[e.EstadoEntrada], mail: String(f[e.MailEntrada] || ''),
    };
  });
  return { ok: true, pendientes: estados, entradas: lista };
}

// Busca por DNI o correo en Pendientes y Entradas, y consulta en Mercado Pago
// los pagos de cada referencia encontrada ("pagué y no figuro").
function efsAdminBuscar_(p) {
  var q = String(p.q || '').trim().toLowerCase().replace(/\./g, '');
  if (q.length < 4) return { ok: false, error: 'busqueda_corta' };
  var pend = efsHoja_(EFS_HOJA_PENDIENTES).getDataRange().getValues();
  var col = efsIndices_(pend[0]);
  var encontrados = pend.slice(1).filter(function (f) {
    return String(f[col.dni]) === q || String(f[col.correo]).toLowerCase() === q;
  }).map(function (f) {
    var pagos = [];
    try {
      var res = efsMp_('get', '/v1/payments/search?external_reference=' + encodeURIComponent(f[col.referencia]));
      pagos = (res.results || []).map(function (pg) {
        return { id: pg.id, status: pg.status, detalle: pg.status_detail, monto: pg.transaction_amount, fecha: pg.date_created };
      });
    } catch (err) {
      pagos = [{ error: 'No se pudo consultar Mercado Pago' }];
    }
    return {
      referencia: f[col.referencia], nombre: f[col.nombre] + ' ' + f[col.apellido], dni: String(f[col.dni]),
      correo: f[col.correo], estado: f[col.estado], motivo: f[col.motivo], entrada: f[col.entrada], pagos: pagos,
    };
  });
  return { ok: true, resultados: encontrados };
}

function efsAdminProcesar_(p) {
  var r = efsProcesarPago(p.pago_id, 'panel');
  return { ok: true, resultado: r };
}

function efsAdminReenviar_(p) {
  var enviado = efsEnviarEntrada_(String(p.codigo || ''));
  return { ok: enviado, error: enviado ? undefined : 'no_enviado' };
}

// ─────────────────────────── día del evento (Worker → planilla) ───────────────────────────

var EFS_SESION_ASISTENCIA = 'EFS 2026';

// Lista completa para el Durable Object del evento (solo la pide el Worker, con
// el secreto compartido). Trae también lo ya acreditado, por si el objeto perdió su estado.
function efsStaffLista_() {
  var filas = efsHoja_(EFS_HOJA_ENTRADAS).getDataRange().getValues();
  var e = efsIndices_(filas[0]);
  var texto = function (fila, nombre) { return e[nombre] === undefined ? '' : String(fila[e[nombre]] == null ? '' : fila[e[nombre]]); };
  var lista = [];
  for (var i = 1; i < filas.length; i++) {
    var codigo = String(filas[i][e.RegistrationId] || '').trim();
    if (!codigo) continue;
    var hora = e.AcreditadoEn === undefined ? null : efsFecha_(filas[i][e.AcreditadoEn]);
    lista.push({
      c: codigo, n: (texto(filas[i], 'Nombres') + ' ' + texto(filas[i], 'Apellidos')).trim(),
      dni: texto(filas[i], 'DNI').replace(/\D/g, ''), e: texto(filas[i], 'EstadoEntrada') || 'activa',
      a: hora ? hora.getTime() : 0, p: texto(filas[i], 'AcreditadoPor'), cr: texto(filas[i], 'Credencial'), t: texto(filas[i], 'Taller'),
    });
  }
  return { ok: true, entradas: lista };
}

// Recibe de a lotes lo que pasó en el evento y lo deja en la planilla: hora y
// puesto de acreditación, credencial, taller y "Asistencias" (que es lo que lee
// el sistema de certificados de la plataforma). Se puede repetir sin efectos dobles.
function efsStaffSync_(loteTexto) {
  var lote;
  try { lote = JSON.parse(String(loteTexto || '[]')); } catch (err) { return { ok: false, error: 'formato' }; }
  if (!Array.isArray(lote) || lote.length > 300) return { ok: false, error: 'formato' };

  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  var noEncontrados = [];
  try {
    var hoja = efsHoja_(EFS_HOJA_ENTRADAS);
    efsAsegurarColumnas_(hoja, ['Credencial', 'Taller', 'AcreditadoEn', 'AcreditadoPor']);
    var filas = hoja.getDataRange().getValues();
    var e = efsIndices_(filas[0]);
    lote.forEach(function (it) {
      var i = efsBuscarFila_(filas, e.RegistrationId, it && it.c);
      if (i < 0) { noEncontrados.push(String(it && it.c)); return; }
      var hora = Number(it.a) > 0 ? new Date(Number(it.a)) : null;
      filas[i][e.Credencial] = efsCeldaSegura_(it.cr);
      filas[i][e.Taller] = efsCeldaSegura_(it.t);
      filas[i][e.AcreditadoEn] = hora ? efsTextoFecha_(hora) : '';
      filas[i][e.AcreditadoPor] = hora ? efsCeldaSegura_(it.p) : '';
      var asistencias = efsListaJson_(filas[i][e.Asistencias]);
      var tiene = asistencias.indexOf(EFS_SESION_ASISTENCIA) !== -1;
      if (hora && !tiene) asistencias.push(EFS_SESION_ASISTENCIA);
      if (!hora && tiene) asistencias = asistencias.filter(function (x) { return x !== EFS_SESION_ASISTENCIA; });
      filas[i][e.Asistencias] = JSON.stringify(asistencias);
    });
    // Se escribe por columnas enteras (5 llamadas en vez de cientos); las demás columnas no se tocan.
    ['Credencial', 'Taller', 'AcreditadoEn', 'AcreditadoPor', 'Asistencias'].forEach(function (nombre) {
      var valores = [];
      for (var k = 1; k < filas.length; k++) valores.push([filas[k][e[nombre]]]);
      if (valores.length) hoja.getRange(2, e[nombre] + 1, valores.length, 1).setValues(valores);
    });
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  return { ok: true, n: lote.length - noEncontrados.length, no_encontrados: noEncontrados };
}

// Si la planilla es anterior a estas columnas, las agrega al final (en formato texto).
function efsAsegurarColumnas_(hoja, nombres) {
  var cab = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0].map(String);
  nombres.forEach(function (nombre) {
    if (cab.indexOf(nombre) !== -1) return;
    var col = cab.length + 1;
    hoja.getRange(1, col).setValue(nombre);
    hoja.getRange(2, col, Math.max(1, hoja.getMaxRows() - 1), 1).setNumberFormat('@');
    cab.push(nombre);
  });
}

// Texto que puede venir de una persona del staff: nunca se interpreta como fórmula.
function efsCeldaSegura_(v) {
  var t = String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 80);
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}

function efsListaJson_(v) {
  try { var x = JSON.parse(String(v || '[]')); return Array.isArray(x) ? x : []; } catch (err) { return []; }
}

// ─────────────────────────── entradas de prueba (para ensayar el escáner) ───────────────────────────

var EFS_PRUEBA_APELLIDOS = ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco'];

// Crea 5 entradas de prueba: EFS26-TEST0001 a EFS26-TEST0005, a nombre de "TEST Uno"... "TEST Cinco".
// No mandan mail y figuran como cortesías (no entran en la cuenta de pagos). Se puede correr más de
// una vez: las que ya existen no se duplican. Al terminar los ensayos, correr efsRetirarEntradasPrueba.
function efsCrearEntradasPrueba() {
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var hoja = efsHoja_(EFS_HOJA_ENTRADAS);
    var existentes = efsColumna_(hoja, 'RegistrationId');
    var e = efsIndices_(EFS_COL_ENTRADAS);
    var creadas = [];
    EFS_PRUEBA_APELLIDOS.forEach(function (apellido, i) {
      var codigo = 'EFS26-TEST000' + (i + 1);
      if (existentes.indexOf(codigo) !== -1) return;
      var fila = efsFilaVacia_(EFS_COL_ENTRADAS);
      efsAsignar_(fila, e, {
        'Fecha': new Date(), 'Nombres': 'TEST', 'Apellidos': apellido, 'DNI': '9900000' + (i + 1), 'Teléfono': '',
        'Email': 'prueba' + (i + 1) + '@ejemplo.invalid', 'Carrera': 'Prueba', 'Año': '-', 'RegistrationId': codigo,
        'Asistencias': '[]', 'Dado de baja': false, 'ActivityId': EFS_ACTIVITY_ID, 'Universidad': 'ATP', 'Origen': 'cortesia',
        'EstadoEntrada': 'activa', 'MailEntrada': 'prueba (sin mail)',
      });
      hoja.appendRow(efsComoTexto_(fila, e));
      creadas.push(codigo);
    });
    SpreadsheetApp.flush();
    Logger.log(creadas.length ? 'Entradas de prueba creadas: ' + creadas.join(', ') : 'Las 5 entradas de prueba ya existían.');
  } finally {
    lock.releaseLock();
  }
}

// Deja las entradas de prueba como revocadas (no cuentan en el total ni se pueden acreditar).
// Las filas quedan en la planilla; se pueden borrar a mano cuando se quiera.
function efsRetirarEntradasPrueba() {
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var hoja = efsHoja_(EFS_HOJA_ENTRADAS);
    var filas = hoja.getDataRange().getValues();
    var e = efsIndices_(filas[0]);
    var retiradas = 0;
    for (var i = 1; i < filas.length; i++) {
      if (!/^EFS26-TEST000[1-5]$/.test(String(filas[i][e.RegistrationId]))) continue;
      hoja.getRange(i + 1, e.EstadoEntrada + 1).setValue('revocada');
      retiradas++;
    }
    SpreadsheetApp.flush();
    Logger.log('Entradas de prueba retiradas: ' + retiradas);
  } finally {
    lock.releaseLock();
  }
}

// ─────────────────────────── puesta en marcha (se corren a mano una vez) ───────────────────────────

function efsPrepararHojas() {
  efsHoja_(EFS_HOJA_CONFIG);
  efsHoja_(EFS_HOJA_PENDIENTES);
  efsHoja_(EFS_HOJA_PAGOS);
  efsHoja_(EFS_HOJA_ENTRADAS);
}

function efsInstalarBarrido() {
  var ya = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'efsBarrido'; });
  if (!ya) ScriptApp.newTrigger('efsBarrido').timeBased().everyMinutes(10).create();
}

// Manda un mail de prueba por Resend a la cuenta del script, con el mismo
// diseño de la entrada. Sirve para confirmar que la clave de Resend anda.
function efsProbarResend() {
  if (!efsResendDisponible_()) throw new Error('No hay RESEND_API_KEY / RESEND_FROM_EMAIL en el archivo principal');
  var c = efsConfig_();
  var yo = Session.getEffectiveUser().getEmail();
  var e = efsIndices_(EFS_COL_ENTRADAS);
  var fila = efsFilaVacia_(EFS_COL_ENTRADAS);
  efsAsignar_(fila, e, { Nombres: 'Prueba', Apellidos: 'Resend', DNI: '12345678', Email: yo, RegistrationId: 'EFS26-PRUEBA00' });
  var mail = efsArmarMailEntrada_(fila, e, c);
  mail.asunto = '[Prueba Resend] ' + mail.asunto;
  efsMandarPorResend_(mail, c);
  Logger.log('Resend anda: mail de prueba enviado a ' + yo);
}

// Igual que efsProbarResend, pero por SMTP2GO.
function efsProbarSmtp2go() {
  if (!efsSmtp2goDisponible_()) throw new Error('Falta la propiedad SMTP2GO_API_KEY');
  var c = efsConfig_();
  var yo = Session.getEffectiveUser().getEmail();
  var e = efsIndices_(EFS_COL_ENTRADAS);
  var fila = efsFilaVacia_(EFS_COL_ENTRADAS);
  efsAsignar_(fila, e, { Nombres: 'Prueba', Apellidos: 'SMTP2GO', DNI: '12345678', Email: yo, RegistrationId: 'EFS26-PRUEBA00' });
  var mail = efsArmarMailEntrada_(fila, e, c);
  mail.asunto = '[Prueba SMTP2GO] ' + mail.asunto;
  efsMandarPorSmtp2go_(mail, c);
  Logger.log('SMTP2GO anda: mail de prueba enviado a ' + yo + ' desde ' + efsSmtp2goRemitente_());
}

// Igual que efsProbarResend, pero por Brevo. Confirma la clave y el remitente.
function efsProbarBrevo() {
  if (!efsBrevoDisponible_()) throw new Error('Falta la propiedad BREVO_API_KEY');
  var c = efsConfig_();
  var yo = Session.getEffectiveUser().getEmail();
  var e = efsIndices_(EFS_COL_ENTRADAS);
  var fila = efsFilaVacia_(EFS_COL_ENTRADAS);
  efsAsignar_(fila, e, { Nombres: 'Prueba', Apellidos: 'Brevo', DNI: '12345678', Email: yo, RegistrationId: 'EFS26-PRUEBA00' });
  var mail = efsArmarMailEntrada_(fila, e, c);
  mail.asunto = '[Prueba Brevo] ' + mail.asunto;
  efsMandarPorBrevo_(mail, c);
  Logger.log('Brevo anda: mail de prueba enviado a ' + yo + ' desde ' + efsBrevoRemitente_());
}

function efsProbarConexion() {
  var yo = efsMp_('get', '/users/me');
  Logger.log('Conectado a Mercado Pago como ' + yo.nickname + ' (User ID ' + yo.id + '). Cuota de mails de hoy: ' + MailApp.getRemainingDailyQuota());
}

// ─────────────────────────── utilidades ───────────────────────────

function efsMp_(metodo, ruta, cuerpo, claveIdempotencia) {
  var token = PropertiesService.getScriptProperties().getProperty('EFS_MP_TOKEN');
  if (!token) throw new Error('Falta EFS_MP_TOKEN en las propiedades del script');
  var op = { method: metodo, muteHttpExceptions: true, contentType: 'application/json', headers: { Authorization: 'Bearer ' + token } };
  if (cuerpo) op.payload = JSON.stringify(cuerpo);
  if (metodo === 'post') op.headers['X-Idempotency-Key'] = claveIdempotencia || Utilities.getUuid();
  var r = UrlFetchApp.fetch('https://api.mercadopago.com' + ruta, op);
  var code = r.getResponseCode();
  var texto = r.getContentText() || '{}';
  if (code >= 300) throw new Error('Mercado Pago ' + code + ' en ' + ruta.split('?')[0] + ': ' + texto.slice(0, 200));
  return JSON.parse(texto);
}

function efsSecretoValido_(recibido) {
  var esperado = PropertiesService.getScriptProperties().getProperty('EFS_WORKER_SECRET');
  if (!esperado || !recibido || String(recibido).length !== esperado.length) return false;
  var dif = 0;
  for (var i = 0; i < esperado.length; i++) dif |= esperado.charCodeAt(i) ^ String(recibido).charCodeAt(i);
  return dif === 0;
}

function efsParaLog_(p) {
  var copia = {};
  Object.keys(p).forEach(function (k) {
    if (k === 'efs_secreto' || k === 'token') return;
    copia[k] = k === 'dni' || k === 'correo' ? '(omitido)' : p[k];
  });
  return copia;
}

function efsConfig_() {
  var hoja = efsHoja_(EFS_HOJA_CONFIG);
  var c = {};
  EFS_CONFIG_INICIAL.forEach(function (x) { c[x[0]] = x[1]; });
  hoja.getDataRange().getValues().slice(1).forEach(function (f) {
    if (f[0] !== '' && f[1] !== '') c[String(f[0]).trim()] = f[1];
  });
  c.modo = String(c.modo).trim().toLowerCase();
  c.precio = Number(c.precio);
  return c;
}

function efsInscripcionAbierta_(c) {
  if (String(c.inscripcion_abierta).trim().toUpperCase() !== 'SI') return false;
  if (!(c.precio > 0)) return false;
  var cierre = efsFecha_(c.cierre);
  return !cierre || Date.now() < cierre.getTime();
}

function efsValidarDatos_(p) {
  var t = function (v, max) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max); };
  var d = {
    intento_id: t(p.intento_id, 64), nombre: t(p.nombre, 60), apellido: t(p.apellido, 60),
    dni: String(p.dni || '').replace(/[\s.]/g, ''), correo: t(p.correo, 120).toLowerCase(),
    telefono: t(p.telefono, 30), carrera: t(p.carrera, 80), anio: t(p.anio, 30), universidad: t(p.universidad, 100),
  };
  if (!/^[A-Za-z0-9-]{8,64}$/.test(d.intento_id)) d.error = 'intento_id';
  else if (!d.nombre) d.error = 'nombre';
  else if (!d.apellido) d.error = 'apellido';
  else if (!/^\d{7,9}$/.test(d.dni)) d.error = 'dni';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.correo)) d.error = 'correo';
  else if (d.telefono.replace(/\D/g, '').length < 8) d.error = 'telefono';
  else if (!d.carrera) d.error = 'carrera';
  else if (!d.anio) d.error = 'anio';
  else if (!d.universidad) d.error = 'universidad';
  return d;
}

function efsBuscarEntradaActivaPorDni_(dni) {
  var filas = efsHoja_(EFS_HOJA_ENTRADAS).getDataRange().getValues();
  var e = efsIndices_(filas[0]);
  var i = efsBuscarFila_(filas, e.DNI, dni, function (f) { return f[e.EstadoEntrada] === 'activa'; });
  return i >= 0 ? filas[i] : null;
}

function efsActualizarPendiente_(ref, cambios, soloSiEstado) {
  var hoja = efsHoja_(EFS_HOJA_PENDIENTES);
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var filas = hoja.getDataRange().getValues();
    var col = efsIndices_(filas[0]);
    var i = efsBuscarFila_(filas, col.referencia, ref);
    if (i < 0) return;
    if (soloSiEstado && filas[i][col.estado] !== soloSiEstado) return;
    var fila = filas[i].slice();
    efsAsignar_(fila, col, cambios);
    hoja.getRange(i + 1, 1, 1, fila.length).setValues([fila]);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

// ¿La bitácora ya tiene este mismo pago con esta misma acción y detalle?
function efsYaRegistrado_(pagoId, accion, detalle) {
  var filas = efsHoja_(EFS_HOJA_PAGOS).getDataRange().getValues();
  var col = efsIndices_(filas[0]);
  for (var i = 1; i < filas.length; i++) {
    if (String(filas[i][col.pago_id]) === String(pagoId) && String(filas[i][col.accion]) === String(accion) &&
        String(filas[i][col.detalle] || '').replace(/^'/, '') === String(detalle || '')) return true;
  }
  return false;
}

function efsRegistrarPago_(pago, origen, accion, detalle) {
  var fila = efsFilaVacia_(EFS_COL_PAGOS);
  efsAsignar_(fila, efsIndices_(EFS_COL_PAGOS), {
    fecha: new Date(), pago_id: String(pago.id), referencia: String(pago.external_reference || ''),
    status: pago.status, status_detail: String(pago.status_detail || ''), monto_bruto: pago.transaction_amount,
    moneda: pago.currency_id, collector_id: String(pago.collector_id || ''), live_mode: String(pago.live_mode),
    origen: origen || '', accion: accion || '', detalle: detalle || '',
  });
  efsHoja_(EFS_HOJA_PAGOS).appendRow(efsComoTexto_(fila, efsIndices_(EFS_COL_PAGOS)));
}

// Crea la hoja con sus encabezados si no existe, con todas las columnas en
// formato texto (así un DNI no se convierte en número ni un "=..." en fórmula).
function efsHoja_(nombre) {
  var libro = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = libro.getSheetByName(nombre);
  if (hoja) return hoja;
  hoja = libro.insertSheet(nombre);
  if (nombre === EFS_HOJA_CONFIG) {
    hoja.appendRow(['clave', 'valor', 'descripción']);
    EFS_CONFIG_INICIAL.forEach(function (x) { hoja.appendRow(x); });
    return hoja;
  }
  var columnas = nombre === EFS_HOJA_PENDIENTES ? EFS_COL_PENDIENTES : nombre === EFS_HOJA_PAGOS ? EFS_COL_PAGOS : EFS_COL_ENTRADAS;
  hoja.appendRow(columnas);
  hoja.getRange(2, 1, hoja.getMaxRows() - 1, columnas.length).setNumberFormat('@');
  hoja.setFrozenRows(1);
  return hoja;
}

// Todo texto que vino del formulario se guarda con apóstrofo adelante: Sheets
// lo trata como texto literal (no número, no fórmula) y el apóstrofo no forma
// parte del valor. Fechas, números y booleanos del sistema quedan como están.
function efsComoTexto_(fila, col) {
  var libres = ['nombre', 'apellido', 'dni', 'correo', 'telefono', 'carrera', 'anio', 'universidad',
    'Nombres', 'Apellidos', 'DNI', 'Teléfono', 'Email', 'Carrera', 'Año', 'Universidad', 'detalle', 'motivo'];
  var salida = fila.slice();
  libres.forEach(function (k) {
    var i = col[k];
    if (i === undefined || i < 0) return;
    var v = salida[i];
    if (typeof v === 'string' && v !== '' && v.charAt(0) !== "'") salida[i] = "'" + v;
  });
  return salida;
}

function efsIndices_(encabezados) {
  var col = {};
  encabezados.forEach(function (h, i) { col[String(h)] = i; });
  return col;
}

function efsFilaVacia_(columnas) {
  return columnas.map(function () { return ''; });
}

function efsAsignar_(fila, col, valores) {
  Object.keys(valores).forEach(function (k) {
    if (col[k] !== undefined) fila[col[k]] = valores[k];
  });
}

function efsBuscarFila_(filas, indice, valor, condicion) {
  if (indice === undefined || valor === '' || valor == null) return -1;
  for (var i = 1; i < filas.length; i++) {
    if (String(filas[i][indice]) === String(valor) && (!condicion || condicion(filas[i]))) return i;
  }
  return -1;
}

function efsColumna_(hoja, nombre) {
  var filas = hoja.getDataRange().getValues();
  var i = filas[0].indexOf(nombre);
  return filas.slice(1).map(function (f) { return String(f[i]); });
}

function efsAleatorio_(largo) {
  // getUuid es aleatorio (v4); se usan sus dígitos hex salvo el de versión.
  var hex = '';
  while (hex.length < largo * 2) hex += Utilities.getUuid().replace(/-/g, '').replace(/^(.{12})./, '$1');
  var s = '';
  for (var i = 0; i < largo; i++) s += EFS_ALFABETO.charAt(parseInt(hex.substr(i * 2, 2), 16) % 32);
  return s;
}

function efsNuevoCodigo_() {
  return 'EFS26-' + efsAleatorio_(8);
}

function efsNuevaReferencia_() {
  return 'EFSP-' + efsAleatorio_(10);
}

function efsFecha_(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? null : v;
  var m = String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) {
    var iso = m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) + 'T' +
      ('0' + (m[4] || '23')).slice(-2) + ':' + (m[5] || '59') + ':00-03:00';
    var d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }
  var otra = new Date(String(v));
  return isNaN(otra.getTime()) ? null : otra;
}

function efsIsoMp_(fecha) {
  return Utilities.formatDate(fecha, EFS_ZONA, "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
}

function efsTextoFecha_(fecha) {
  return Utilities.formatDate(fecha, EFS_ZONA, 'dd/MM/yyyy HH:mm');
}

function efsJson_(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}
