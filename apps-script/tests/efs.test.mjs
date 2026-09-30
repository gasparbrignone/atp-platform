// Pruebas de EFS.gs en Node, con simulaciones de los servicios de Google y de
// la API de Mercado Pago. Se corren con:  node apps-script/tests/efs.test.mjs
// Opcional: EFS_MAIN=/ruta/al/script-principal.js carga también el archivo
// principal del proyecto para chequear choques de nombres y no regresión.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const CODIGO_EFS = fs.readFileSync(path.join(aqui, '..', 'EFS.gs'), 'utf8');

// ─────────────────────────── simulación de Google ───────────────────────────

function crearEntorno({ mp, quota = 1500, qrFalla = false, resend = null, brevo = null } = {}) {
  const hojas = new Map();
  const mails = [];
  const resendEnvios = [];
  const brevoEnvios = [];
  const errores = [];
  const props = { EFS_WORKER_SECRET: 'secreto-de-prueba-123', EFS_MP_TOKEN: 'TEST-token', ...(brevo ? { BREVO_API_KEY: 'xkeysib-prueba' } : {}) };
  const cache = new Map();
  let lockTomado = false;

  const guardar = (v) => (typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v);

  function crearHoja(nombre) {
    const datos = [];
    const ancho = () => Math.max(0, ...datos.map((f) => f.length));
    const hoja = {
      nombre,
      datos,
      getName: () => nombre,
      appendRow(fila) { datos.push(fila.map(guardar)); return hoja; },
      getDataRange() {
        return { getValues: () => (datos.length ? datos.map((f) => { const c = f.slice(); while (c.length < ancho()) c.push(''); return c; }) : [[]]) };
      },
      getRange(fila, colu, nf = 1, nc = 1) {
        return {
          setValue(v) { while (datos.length < fila) datos.push([]); datos[fila - 1][colu - 1] = guardar(v); },
          setValues(vals) {
            vals.forEach((f, i) => f.forEach((v, j) => {
              while (datos.length < fila + i) datos.push([]);
              datos[fila + i - 1][colu + j - 1] = guardar(v);
            }));
          },
          getValues: () => Array.from({ length: nf }, (_, i) => Array.from({ length: nc }, (_, j) => (datos[fila + i - 1] || [])[colu + j - 1] ?? '')),
          setNumberFormat() { return this; },
        };
      },
      getLastRow: () => datos.length,
      getLastColumn: () => ancho(),
      getMaxRows: () => 1000,
      setFrozenRows() {},
    };
    return hoja;
  }

  const libro = {
    getSheetByName: (n) => hojas.get(n) || null,
    insertSheet(n) { const h = crearHoja(n); hojas.set(n, h); return h; },
    getSheets: () => [...hojas.values()],
  };

  const respuesta = (code, obj) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(obj), getBlob: () => ({ setName() { return this; }, getBytes: () => [137, 80, 78, 71] }) });

  const ctx = {
    console,
    SpreadsheetApp: { getActiveSpreadsheet: () => libro, flush() {} },
    LockService: {
      getDocumentLock: () => ({
        tryLock() { if (lockTomado) return false; lockTomado = true; return true; },
        waitLock() { if (lockTomado) throw new Error('lock ocupado (deadlock en prueba)'); lockTomado = true; },
        releaseLock() { lockTomado = false; },
      }),
    },
    CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null }) },
    UrlFetchApp: {
      fetch(url, op = {}) {
        if (url.startsWith('https://api.qrserver.com/')) return qrFalla ? respuesta(500, {}) : respuesta(200, {});
        if (url === 'https://api.resend.com/emails') {
          resendEnvios.push({ headers: op.headers, cuerpo: JSON.parse(op.payload) });
          return resend && resend.falla ? respuesta(429, { message: 'daily quota exceeded' }) : respuesta(200, { id: 're_1' });
        }
        if (url === 'https://api.brevo.com/v3/smtp/email') {
          brevoEnvios.push({ headers: op.headers, cuerpo: JSON.parse(op.payload) });
          return brevo && brevo.falla ? respuesta(400, { message: 'sender not valid' }) : respuesta(201, { messageId: 'b1' });
        }
        const u = new URL(url);
            const r = mp.manejar((op.method || 'get').toLowerCase(), u.pathname, u.searchParams, op.payload ? JSON.parse(op.payload) : null, op.headers || {});
        return respuesta(r[0], r[1]);
      },
    },
    GmailApp: { sendEmail(to, asunto, plano, op) { mails.push({ to, asunto, plano, op }); } },
    MailApp: { getRemainingDailyQuota: () => quota },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'admin@ejemplo.org' }) },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create() {} }) }) }) },
    ContentService: { createTextOutput: (t) => ({ texto: t, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      base64Encode: (s) => Buffer.from(String(s)).toString('base64'),
      formatDate: (d, _z, f) => (f.includes('T') ? new Date(d.getTime() - 3 * 3600e3).toISOString().replace('Z', '-03:00') : d.toISOString()),
    },
    Logger: { log() {} },
    logError: (dónde, err, datos) => errores.push({ dónde, err: String(err && err.message ? err.message : err), datos }),
    isValidAdminSession: (t) => t === 'sesion-ok',
    ...(resend ? { RESEND_API_KEY: 're_clave_prueba', RESEND_FROM_EMAIL: 'entradas@ejemplo.org' } : {}),
    escapeHtml: (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
  };
  vm.createContext(ctx);
  vm.runInContext(CODIGO_EFS, ctx, { filename: 'EFS.gs' });
  ctx.efsPrepararHojas();

  // Config de prueba
  const cfg = hojas.get('EFS · Config');
  const poner = (k, v) => { const i = cfg.datos.findIndex((f) => f[0] === k); cfg.datos[i][1] = v; };
  poner('inscripcion_abierta', 'SI');
  poner('collector_id', '999');
  poner('webhook_url', 'https://efs-worker.ejemplo/mp/aviso');

  const post = (params) => JSON.parse(ctx.efsRouter({ parameter: { efs_secreto: props.EFS_WORKER_SECRET, ...params } }).texto);
  return { ctx, hojas, mails, resendEnvios, brevoEnvios, errores, props, post, poner, lock: () => lockTomado };
}

// ─────────────────────────── simulación de Mercado Pago ───────────────────────────

function crearMp() {
  const pagos = new Map();
  const preferencias = new Map();
  const idempotencia = new Map();
  let caido = false;
  let n = 1000;
  const mp = {
    pagos, preferencias,
    caer(v = true) { caido = v; },
    pagar(ref, extra = {}) {
      const id = ++n;
      const pago = {
        id, external_reference: ref, status: 'approved', status_detail: 'accredited', transaction_amount: 5000,
        currency_id: 'ARS', collector_id: 999, live_mode: false, operation_type: 'regular_payment',
        date_created: new Date().toISOString(), ...extra,
      };
      pagos.set(String(id), pago);
      return pago;
    },
    manejar(metodo, ruta, q, cuerpo, headers) {
      if (caido) return [503, { message: 'caído' }];
      if (metodo === 'post' && ruta === '/checkout/preferences') {
        const clave = headers['X-Idempotency-Key'];
        if (clave && idempotencia.has(clave)) return [201, idempotencia.get(clave)];
        const id = 'pref-' + (++n);
        const pref = { id, init_point: 'https://mp/checkout/' + id, sandbox_init_point: 'https://sandbox.mp/checkout/' + id, cuerpo };
        preferencias.set(id, pref);
        if (clave) idempotencia.set(clave, pref);
        return [201, pref];
      }
      if (metodo === 'put' && ruta.startsWith('/checkout/preferences/')) {
        const pref = preferencias.get(ruta.split('/').pop());
        if (pref) pref.vencida = cuerpo.expiration_date_to;
        return [200, pref || {}];
      }
      if (metodo === 'get' && ruta.startsWith('/v1/payments/search')) {
        let lista = [...pagos.values()];
        if (q.get('external_reference')) lista = lista.filter((p) => p.external_reference === q.get('external_reference'));
        const off = Number(q.get('offset') || 0), lim = Number(q.get('limit') || 30);
        return [200, { results: lista.slice(off, off + lim), paging: { total: lista.length, offset: off, limit: lim } }];
      }
      if (metodo === 'get' && ruta.startsWith('/v1/payments/')) {
        const p = pagos.get(ruta.split('/').pop());
        return p ? [200, p] : [404, { message: 'not found' }];
      }
      if (metodo === 'get' && ruta.startsWith('/merchant_orders/')) {
        return [200, { payments: [...pagos.values()].slice(-1).map((p) => ({ id: p.id })) }];
      }
      if (metodo === 'get' && ruta === '/users/me') return [200, { id: 999, nickname: 'PRUEBA' }];
      return [404, { message: 'ruta no simulada ' + ruta }];
    },
  };
  return mp;
}

// ─────────────────────────── pruebas ───────────────────────────

const datos = (extra = {}) => ({
  accion: 'iniciar', intento_id: crypto.randomUUID(), nombre: 'Ana', apellido: 'Pérez', dni: '30.123.456',
  correo: 'Ana@Ejemplo.com', telefono: '341 555-1234', carrera: 'Medicina', anio: '3.º', universidad: 'UNR', ...extra,
});

let ok = 0, fallas = 0;
function prueba(nombre, fn) {
  try { fn(); ok++; console.log('  ✓ ' + nombre); }
  catch (e) { fallas++; console.log('  ✗ ' + nombre + '\n      ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n      ') : e)); }
}
function igual(a, b, msj) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msj || '') + ' esperado ' + JSON.stringify(b) + ', obtenido ' + JSON.stringify(a)); }
function si(v, msj) { if (!v) throw new Error(msj || 'se esperaba verdadero'); }

const filas = (h) => h.datos.slice(1);
const entradas = (env) => filas(env.hojas.get('EFS 2026'));
const pendientes = (env) => filas(env.hojas.get('EFS · Pendientes'));

console.log('\nEFS.gs · inscripción y pagos');

prueba('rechaza sin el secreto del Worker', () => {
  const env = crearEntorno({ mp: crearMp() });
  const r = JSON.parse(env.ctx.efsRouter({ parameter: { accion: 'iniciar', efs_secreto: 'otro' } }).texto);
  igual(r.error, 'no_autorizado');
});

prueba('iniciar crea un pendiente y una preferencia sin efectivo, 1 cuota, precio del servidor', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const r = env.post(datos({ precio: 1 }));
  si(r.ok, JSON.stringify(r)); si(r.referencia.startsWith('EFSP-'));
  const pref = [...mp.preferencias.values()][0].cuerpo;
  igual(pref.items[0].unit_price, 5000); igual(pref.external_reference, r.referencia);
  igual(pref.payment_methods.excluded_payment_types.map((x) => x.id), ['ticket', 'atm']);
  igual(pref.payment_methods.installments, 1);
  igual(pref.binary_mode, true); igual(pref.statement_descriptor, 'EFS 2026');
  igual(pref.items[0].category_id, 'tickets'); si(pref.items[0].description);
  igual(pref.payer.identification, { type: 'DNI', number: '30123456' });
  igual(pref.back_urls.success, 'https://efsarg.com.ar/?pago=aprobado');
  si(pref.notification_url.includes('/mp/aviso'));
  igual(pendientes(env).length, 1);
  si(!env.lock(), 'el candado quedó tomado');
});

prueba('devuelve siempre init_point (Mercado Pago ya no tiene sandbox)', () => {
  const env = crearEntorno({ mp: crearMp() });
  const url = env.post(datos()).pago_url;
  si(url.startsWith('https://mp/checkout/') && !url.includes('sandbox'), url);
});

prueba('modo prueba: se puede volver a http://localhost (sin auto_return); en producción no', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  env.poner('sitio_url', 'http://localhost:8080');
  si(env.post(datos()).ok);
  const pref = [...mp.preferencias.values()][0].cuerpo;
  igual(pref.back_urls.success, 'http://localhost:8080/?pago=aprobado'); igual(pref.auto_return, undefined);
  env.poner('modo', 'produccion');
  igual(env.post(datos({ dni: '29000000' })).error, 'mp');
});

prueba('en producción el retorno es automático (auto_return)', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  env.post(datos());
  igual([...mp.preferencias.values()][0].cuerpo.auto_return, 'approved');
});

prueba('URLs de retorno o de aviso sin https → no se crea el pago', () => {
  const env = crearEntorno({ mp: crearMp() });
  env.poner('webhook_url', 'http://inseguro.ejemplo/aviso');
  igual(env.post(datos()).error, 'mp');
});

prueba('DNI y correo se guardan normalizados y como texto', () => {
  const env = crearEntorno({ mp: crearMp() });
  env.post(datos());
  const h = env.hojas.get('EFS · Pendientes'); const col = h.datos[0];
  const f = filas(h)[0];
  igual(f[col.indexOf('dni')], '30123456'); igual(f[col.indexOf('correo')], 'ana@ejemplo.com');
});

prueba('un nombre que empieza con "=" no queda como fórmula', () => {
  const env = crearEntorno({ mp: crearMp() });
  // la simulación saca el apóstrofo como Sheets; lo que importa es que se haya mandado con apóstrofo
  let enviado;
  const h = env.hojas.get('EFS · Pendientes'); const orig = h.appendRow;
  h.appendRow = (f) => { enviado = f; return orig.call(h, f); };
  env.post(datos({ nombre: '=HYPERLINK("x")' }));
  si(enviado[3].startsWith("'="), 'no se antepuso el apóstrofo');
});

prueba('mismo intento repetido (reintento del Worker) no duplica pendiente ni preferencia', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const d = datos(); const a = env.post(d); const b = env.post(d);
  igual(a.referencia, b.referencia); igual(pendientes(env).length, 1); igual(mp.preferencias.size, 1);
});

prueba('mismo DNI con un intento nuevo reutiliza el pendiente', () => {
  const env = crearEntorno({ mp: crearMp() });
  const a = env.post(datos()); const b = env.post(datos({ correo: 'otro@ejemplo.com' }));
  igual(a.referencia, b.referencia); igual(pendientes(env).length, 1);
});

prueba('datos inválidos se rechazan en el servidor', () => {
  const env = crearEntorno({ mp: crearMp() });
  igual(env.post(datos({ dni: '12' })).campo, 'dni');
  igual(env.post(datos({ correo: 'sin-arroba' })).campo, 'correo');
  igual(env.post(datos({ nombre: '  ' })).campo, 'nombre');
  igual(env.post(datos({ telefono: '' })).campo, 'telefono');
  igual(env.post(datos({ telefono: '12' })).campo, 'telefono');
});

prueba('inscripción cerrada (switch o fecha de cierre)', () => {
  const env = crearEntorno({ mp: crearMp() });
  env.poner('inscripcion_abierta', 'NO'); igual(env.post(datos()).error, 'cerrada');
  env.poner('inscripcion_abierta', 'SI'); env.poner('cierre', '01/01/2020 10:00'); igual(env.post(datos()).error, 'cerrada');
});

prueba('Mercado Pago caído al crear la preferencia: error claro, el pendiente queda y se reutiliza', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  mp.caer(); const d = datos(); igual(env.post(d).error, 'mp');
  mp.caer(false); const r = env.post(d);
  si(r.ok); igual(pendientes(env).length, 1); si(!env.lock());
});

prueba('pago aprobado: emite entrada, manda mail con QR adjunto y vence la preferencia', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const r = env.post(datos());
  const pago = mp.pagar(r.referencia);
  const v = env.post({ accion: 'aviso', tipo: 'payment', id: String(pago.id) });
  igual(v.estado, 'pagado');
  const e = entradas(env); igual(e.length, 1);
  const cab = env.hojas.get('EFS 2026').datos[0];
  si(/^EFS26-[0-9A-HJKMNP-TV-Z]{8}$/.test(e[0][cab.indexOf('RegistrationId')]), 'formato de código');
  igual(e[0][cab.indexOf('EstadoEntrada')], 'activa');
  igual(e[0][cab.indexOf('Asistencias')], '[]');
  igual(e[0][cab.indexOf('Dado de baja')], false);
  igual(env.mails.length, 1); si(env.mails[0].op.inlineImages && env.mails[0].op.inlineImages.qr, 'sin imagen CID');
  si(env.mails[0].op.htmlBody.includes('cid:qr'));
  si([...mp.preferencias.values()][0].vencida, 'no se venció la preferencia');
});

prueba('I-1: el mismo pago avisado 5 veces genera una sola entrada y un solo mail', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const pago = mp.pagar(env.post(datos()).referencia);
  for (let i = 0; i < 5; i++) env.post({ accion: 'aviso', tipo: 'payment', id: String(pago.id) });
  igual(entradas(env).length, 1); igual(env.mails.length, 1);
});

prueba('I-2: segundo pago aprobado sobre la misma referencia → duplicado + aviso, sin segunda entrada', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const ref = env.post(datos()).referencia;
  env.ctx.efsProcesarPago(mp.pagar(ref).id, 'webhook');
  env.ctx.efsProcesarPago(mp.pagar(ref).id, 'webhook');
  igual(entradas(env).length, 1);
  si(env.mails.some((m) => m.asunto.includes('duplicado')), 'no avisó al admin');
});

prueba('I-3: monto distinto, otra moneda, otro cobrador, modo equivocado → anomalía sin entrada', () => {
  for (const extra of [{ transaction_amount: 4999 }, { transaction_amount: 6000 }, { currency_id: 'USD' }, { collector_id: 1 }, { live_mode: true }, { operation_type: 'money_transfer' }]) {
    const mp = crearMp(); const env = crearEntorno({ mp });
    const ref = env.post(datos()).referencia;
    const r = env.ctx.efsProcesarPago(mp.pagar(ref, extra).id, 'webhook');
    igual(r.estado, 'anomalia', JSON.stringify(extra)); igual(entradas(env).length, 0, JSON.stringify(extra));
  }
});

prueba('I-4: pago con referencia EFSP inexistente → anomalía; pago ajeno al EFS → se ignora', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  igual(env.ctx.efsProcesarPago(mp.pagar('EFSP-NOEXISTE00').id, 'barrido').estado, 'anomalia');
  igual(env.ctx.efsProcesarPago(mp.pagar('otra-cosa').id, 'barrido').estado, 'ajeno');
  igual(entradas(env).length, 0);
});

prueba('pago rechazado → sin entrada, el pendiente queda "rechazado" y puede reintentar', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const d = datos(); const ref = env.post(d).referencia;
  env.ctx.efsProcesarPago(mp.pagar(ref, { status: 'rejected' }).id, 'webhook');
  igual(entradas(env).length, 0);
  igual(env.post(datos()).referencia, ref);
});

prueba('pago pendiente (in_process) no emite entrada; cuando pasa a aprobado, sí', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const ref = env.post(datos()).referencia;
  const pago = mp.pagar(ref, { status: 'in_process' });
  env.ctx.efsProcesarPago(pago.id, 'webhook'); igual(entradas(env).length, 0);
  pago.status = 'approved'; env.ctx.efsProcesarPago(pago.id, 'webhook'); igual(entradas(env).length, 1);
});

prueba('devolución total → entrada revocada (I-5: no vuelve sola) + aviso', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const pago = mp.pagar(env.post(datos()).referencia);
  env.ctx.efsProcesarPago(pago.id, 'webhook');
  pago.status = 'refunded'; env.ctx.efsProcesarPago(pago.id, 'barrido');
  const cab = env.hojas.get('EFS 2026').datos[0];
  igual(entradas(env)[0][cab.indexOf('EstadoEntrada')], 'revocada');
  pago.status = 'approved'; env.ctx.efsProcesarPago(pago.id, 'barrido');
  igual(entradas(env)[0][cab.indexOf('EstadoEntrada')], 'revocada');
  si(env.mails.some((m) => m.asunto.includes('revocada')));
});

prueba('ya inscripto con entrada activa → no crea otro pago', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  env.ctx.efsProcesarPago(mp.pagar(env.post(datos()).referencia).id, 'webhook');
  igual(env.post(datos()).error, 'ya_inscripto');
});

prueba('vuelta del pago: devuelve el código solo si la referencia coincide', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const ref = env.post(datos()).referencia; const pago = mp.pagar(ref);
  const bien = env.post({ accion: 'verificar', pago_id: String(pago.id), referencia: ref });
  si(bien.ok && bien.codigo.startsWith('EFS26-')); igual(bien.nombre, 'Ana Pérez');
  igual(env.post({ accion: 'verificar', pago_id: String(pago.id), referencia: 'EFSP-OTRA' }).error, 'no_coincide');
});

prueba('webhook perdido: el barrido encuentra el pago y emite la entrada', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  mp.pagar(env.post(datos()).referencia);
  env.ctx.efsBarrido(); igual(entradas(env).length, 1);
  env.ctx.efsBarrido(); igual(entradas(env).length, 1);
});

prueba('barrido pagina más de 50 pagos', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  for (let i = 0; i < 120; i++) mp.pagar(env.post(datos({ dni: String(20000000 + i) })).referencia);
  env.ctx.efsBarrido(); igual(entradas(env).length, 120);
});

prueba('Gmail sin cupo → la entrada sale por Resend, con el QR adjunto (CID)', () => {
  const mp = crearMp(); const env = crearEntorno({ mp, quota: 5, resend: {} });
  env.ctx.efsProcesarPago(mp.pagar(env.post(datos()).referencia).id, 'webhook');
  igual(env.mails.length, 0); igual(env.resendEnvios.length, 1);
  const r = env.resendEnvios[0];
  igual(r.headers.Authorization, 'Bearer re_clave_prueba'); igual(r.cuerpo.to, ['ana@ejemplo.com']);
  si(r.cuerpo.from.includes('<entradas@ejemplo.org>')); igual(r.cuerpo.attachments[0].content_id, 'qr'); si(r.cuerpo.html.includes('cid:qr'));
  const cab = env.hojas.get('EFS 2026').datos[0];
  si(String(entradas(env)[0][cab.indexOf('MailEntrada')]).includes('(Resend)'));
});

prueba('mail_proveedor = resend usa Resend aunque Gmail tenga cupo; si Resend falla, prueba con Gmail', () => {
  const mp = crearMp(); const env = crearEntorno({ mp, resend: { falla: true } });
  env.poner('mail_proveedor', 'resend');
  env.ctx.efsProcesarPago(mp.pagar(env.post(datos()).referencia).id, 'webhook');
  igual(env.resendEnvios.length, 1); igual(env.mails.length, 1);
});

prueba('Gmail y Resend sin cupo: la entrada se emite igual (I-9) y el mail queda para un barrido posterior', () => {
  const mp = crearMp(); const env = crearEntorno({ mp, quota: 5, resend: { falla: true } });
  env.ctx.efsProcesarPago(mp.pagar(env.post(datos()).referencia).id, 'webhook');
  igual(entradas(env).length, 1);
  const cab = env.hojas.get('EFS 2026').datos[0];
  si(!env.ctx.efsMailEnviado_(entradas(env)[0][cab.indexOf('MailEntrada')]));
});

prueba('cuota de Gmail agotada: la entrada se emite igual (I-9) y el mail sale en un barrido posterior', () => {
  const mp = crearMp(); const env = crearEntorno({ mp, quota: 5 });
  env.ctx.efsProcesarPago(mp.pagar(env.post(datos()).referencia).id, 'webhook');
  igual(entradas(env).length, 1);
  const cab = env.hojas.get('EFS 2026').datos[0];
  si(String(entradas(env)[0][cab.indexOf('MailEntrada')]).startsWith('pendiente'));
});

prueba('si falla el servicio de QR, el mail sale igual con el código y el link', () => {
  const mp = crearMp(); const env = crearEntorno({ mp, qrFalla: true });
  env.ctx.efsProcesarPago(mp.pagar(env.post(datos()).referencia).id, 'webhook');
  igual(env.mails.length, 1); si(!env.mails[0].op.inlineImages); si(env.mails[0].plano.includes('/entrada/#EFS26-'));
});

prueba('devolución parcial → aviso para revisar', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const pago = mp.pagar(env.post(datos()).referencia);
  env.ctx.efsProcesarPago(pago.id, 'webhook');
  pago.transaction_amount_refunded = 1000; env.ctx.efsProcesarPago(pago.id, 'barrido');
  si(env.mails.some((m) => m.asunto.includes('parcial')));
});

prueba('conciliación: cuenta pagos y entradas y manda el reporte', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  for (let i = 0; i < 3; i++) mp.pagar(env.post(datos({ dni: String(31000000 + i) })).referencia);
  const r = env.ctx.efsConciliar();
  igual(r.reporte.aprobados, 3); igual(r.reporte.emitidas, 3); igual(r.reporte.bruto, 15000);
  si(env.mails.some((m) => m.asunto === 'EFS: conciliación'));
});

prueba('panel: sin sesión de admin no responde; con sesión busca por DNI y trae los pagos de MP', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  mp.pagar(env.post(datos()).referencia);
  igual(env.post({ accion: 'admin_buscar', q: '30123456' }).error, 'no_autorizado');
  const r = env.post({ accion: 'admin_buscar', q: '30123456', token: 'sesion-ok' });
  igual(r.resultados.length, 1); igual(r.resultados[0].pagos.length, 1);
});

prueba('errores internos se registran sin el secreto, el DNI ni el correo', () => {
  const env = crearEntorno({ mp: crearMp() });
  env.ctx.efsHoja_ = () => { throw new Error('planilla caída'); };
  env.post(datos());
  const reg = JSON.stringify(env.errores);
  si(env.errores.length > 0); si(!reg.includes('secreto-de-prueba')); si(!reg.includes('30.123.456')); si(!reg.includes('Ana@'));
});

prueba('regla de hojas §10.2: ninguna hoja del EFS tiene true en la columna E ni las internas una columna "Email"', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  for (let i = 0; i < 5; i++) env.ctx.efsProcesarPago(mp.pagar(env.post(datos({ dni: String(32000000 + i) })).referencia).id, 'webhook');
  for (const [nombre, h] of env.hojas) {
    for (const f of h.datos) si(f[4] !== true, nombre + ' tiene true en la columna E');
    if (nombre !== 'EFS 2026') si(!h.datos[0].includes('Email'), nombre + ' tiene columna Email');
  }
  const cab = env.hojas.get('EFS 2026').datos[0].slice(0, 14);
  igual(cab, ['Fecha', 'Nombres', 'Apellidos', 'DNI', 'Teléfono', 'Email', 'Carrera', 'Año', 'RegistrationId', 'Asistencias', 'Dado de baja', 'ActivityId', 'CertificadoEnviado', 'CertificadoError']);
});

// ─────────────────────────── choque con el script principal ───────────────────────────

const principal = process.env.EFS_MAIN;
if (principal) {
  console.log('\nEFS.gs junto al script principal');
  // Se cargan los dos archivos de verdad en contextos separados y se comparan
  // los nombres globales que deja cada uno (así no cuentan las variables
  // locales de las funciones).
  const globales = (src, nombre) => {
    const c = vm.createContext({});
    const base = new Set(Object.getOwnPropertyNames(c));
    vm.runInContext(src, c, { filename: nombre });
    return new Set(Object.getOwnPropertyNames(c).filter((n) => !base.has(n)));
  };
  const deMain = globales(fs.readFileSync(principal, 'utf8'), 'principal.js');
  const deEfs = globales(CODIGO_EFS, 'EFS.gs');
  prueba('ningún nombre global de EFS.gs existe en el script principal', () => {
    igual([...deEfs].filter((n) => deMain.has(n)), []);
  });
  prueba('EFS.gs no declara onOpen, doGet ni doPost', () => {
    for (const n of ['onOpen', 'doGet', 'doPost']) si(!deEfs.has(n), n);
  });
  prueba('sendReminders del script principal no le escribe a nadie de las hojas del EFS', () => {
    const mp = crearMp(); const env = crearEntorno({ mp });
    for (let i = 0; i < 20; i++) env.ctx.efsProcesarPago(mp.pagar(env.post(datos({ dni: String(33000000 + i) })).referencia).id, 'webhook');
    vm.runInContext(fs.readFileSync(principal, 'utf8'), env.ctx, { filename: 'principal.js' });
    const antes = env.mails.length;
    env.ctx.sendReminders();
    igual(env.mails.length - antes, 0);
  });
  prueba('EFS.gs usa solo helpers que existen en el script principal', () => {
    for (const h of ['logError', 'escapeHtml', 'isValidAdminSession']) si(deMain.has(h), 'falta ' + h);
  });
}

prueba('Gmail sin cupo: sale por Brevo, con el QR como imagen enlazada y adjunto, sin tocar Resend', () => {
  const mp = crearMp(); const env = crearEntorno({ mp, quota: 5, resend: {}, brevo: {} });
  env.ctx.efsProcesarPago(mp.pagar(env.post(datos()).referencia).id, 'webhook');
  igual(env.mails.length, 0); igual(env.resendEnvios.length, 0); igual(env.brevoEnvios.length, 1);
  const b = env.brevoEnvios[0];
  igual(b.headers['api-key'], 'xkeysib-prueba'); igual(b.cuerpo.to, [{ email: 'ana@ejemplo.com' }]);
  igual(b.cuerpo.sender.email, 'efs@atpfcm.com.ar');
  si(!b.cuerpo.htmlContent.includes('cid:qr')); si(b.cuerpo.htmlContent.includes('api.qrserver.com/v1/create-qr-code/')); si(b.cuerpo.htmlContent.includes('EFS26-'));
  igual(b.cuerpo.attachment[0].name, 'entrada-efs.png');
  const cab = env.hojas.get('EFS 2026').datos[0];
  si(String(entradas(env)[0][cab.indexOf('MailEntrada')]).includes('(Brevo)'));
});

prueba('Brevo falla: cae a Resend; sin clave de Brevo se saltea', () => {
  const mp = crearMp(); const env = crearEntorno({ mp, quota: 5, resend: {}, brevo: { falla: true } });
  env.ctx.efsProcesarPago(mp.pagar(env.post(datos()).referencia).id, 'webhook');
  igual(env.brevoEnvios.length, 1); igual(env.resendEnvios.length, 1);
  const mp2 = crearMp(); const env2 = crearEntorno({ mp: mp2, quota: 5, resend: {} });
  env2.ctx.efsProcesarPago(mp2.pagar(env2.post(datos()).referencia).id, 'webhook');
  igual(env2.brevoEnvios.length, 0); igual(env2.resendEnvios.length, 1);
});

console.log(`\n${ok} bien, ${fallas} mal\n`);
process.exit(fallas ? 1 : 0);
