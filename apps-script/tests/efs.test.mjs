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

function crearEntorno({ mp, quota = 1500, qrFalla = false, resend = null, brevo = null, smtp2go = null } = {}) {
  const hojas = new Map();
  const mails = [];
  const resendEnvios = [];
  const brevoEnvios = [];
  const smtp2goEnvios = [];
  const errores = [];
  const props = { EFS_WORKER_SECRET: 'secreto-de-prueba-123', EFS_MP_TOKEN: 'TEST-token', ...(brevo ? { BREVO_API_KEY: 'xkeysib-prueba' } : {}), ...(smtp2go ? { SMTP2GO_API_KEY: 'api-prueba' } : {}) };
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
        if (url === 'https://api.smtp2go.com/v3/email/send') {
          smtp2goEnvios.push({ headers: op.headers, cuerpo: JSON.parse(op.payload) });
          return smtp2go && smtp2go.falla ? respuesta(400, { data: { error: 'sender not verified' } }) : respuesta(200, { data: { succeeded: 1, failed: 0, email_id: 's1' } });
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
      // Como en Apps Script: bytes con signo (-128..127).
      computeDigest: (_alg, texto) => [...crypto.createHash('sha256').update(String(texto), 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b)),
      DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
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
  return { ctx, hojas, mails, cache, resendEnvios, brevoEnvios, smtp2goEnvios, errores, props, post, poner, lock: () => lockTomado };
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

// Conocer el DNI de otra persona no alcanza para pisar su inscripción pendiente (auditoría de seguridad, M1).
const celda = (env, fila, columna) => String(env.hojas.get('EFS · Pendientes').datos[0].indexOf(columna) < 0 ? '' : fila[env.hojas.get('EFS · Pendientes').datos[0].indexOf(columna)]).replace(/^'/, '');

prueba('mismo DNI, otro intento y OTRO correo con un pago en curso: la fila original no se pisa y el cobro usa los datos guardados', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const a = env.post(datos());
  const intentoOriginal = celda(env, pendientes(env)[0], 'intento_id');
  const b = env.post(datos({ nombre: 'Eva', apellido: 'Intrusa', correo: 'eva@intrusa.com', telefono: '999 999-9999' }));
  si(b.ok, JSON.stringify(b)); igual(b.referencia, a.referencia); igual(pendientes(env).length, 1);
  const fila = pendientes(env)[0];
  igual(celda(env, fila, 'correo'), 'ana@ejemplo.com'); igual(celda(env, fila, 'nombre'), 'Ana'); igual(celda(env, fila, 'apellido'), 'Pérez');
  igual(celda(env, fila, 'telefono'), '341 555-1234'); igual(celda(env, fila, 'intento_id'), intentoOriginal);
  const pref = [...mp.preferencias.values()].pop().cuerpo;
  igual(pref.payer.email, 'ana@ejemplo.com'); igual(pref.payer.name, 'Ana');
  // y si ahora paga: la entrada sale a nombre y correo de la inscripción original
  env.ctx.efsProcesarPago(mp.pagar(a.referencia).id, 'webhook');
  const e = entradas(env)[0];
  igual(String(e[5]).replace(/^'/, ''), 'ana@ejemplo.com'); igual(String(e[1]).replace(/^'/, ''), 'Ana');
});

prueba('mismo DNI y mismo correo (la misma persona que recarga la página) sí actualiza los datos', () => {
  const env = crearEntorno({ mp: crearMp() });
  const a = env.post(datos()); const b = env.post(datos({ correo: 'ANA@ejemplo.com', telefono: '341 000-0000', nombre: 'Ana María' }));
  igual(a.referencia, b.referencia); igual(pendientes(env).length, 1);
  const fila = pendientes(env)[0];
  igual(celda(env, fila, 'telefono'), '341 000-0000'); igual(celda(env, fila, 'nombre'), 'Ana María');
});

prueba('un pendiente ya rechazado o abandonado sí se puede reescribir con otro correo', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const a = env.post(datos());
  env.ctx.efsProcesarPago(mp.pagar(a.referencia, { status: 'rejected', status_detail: 'cc_rejected_other_reason' }).id, 'webhook');
  const b = env.post(datos({ correo: 'nuevo@ejemplo.com' }));
  igual(b.referencia, a.referencia);
  igual(celda(env, pendientes(env)[0], 'correo'), 'nuevo@ejemplo.com');
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

prueba('pago combinado (2 medios de $2.500): una sola entrada, sin aviso de duplicado', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const ref = env.post(datos()).referencia;
  const a = mp.pagar(ref, { transaction_amount: 2500 }); const b = mp.pagar(ref, { transaction_amount: 2500 });
  igual(env.ctx.efsProcesarPago(a.id, 'webhook').estado, 'pagado');
  igual(env.ctx.efsProcesarPago(b.id, 'webhook').estado, 'pagado');
  igual(entradas(env).length, 1);
  const cab = env.hojas.get('EFS 2026').datos[0];
  igual(entradas(env)[0][cab.indexOf('PagoId')], [a.id, b.id].sort().join(','));
  si(!env.mails.some((m) => m.asunto.includes('duplicado') || m.asunto.includes('no cumple')), 'avisó de más');
});

prueba('pago combinado: la primera mitad sola es anomalía; al llegar la segunda se emite la entrada', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const ref = env.post(datos()).referencia;
  const a = mp.pagar(ref, { transaction_amount: 2500 });
  igual(env.ctx.efsProcesarPago(a.id, 'webhook').estado, 'anomalia'); igual(entradas(env).length, 0);
  const b = mp.pagar(ref, { transaction_amount: 2500 });
  igual(env.ctx.efsProcesarPago(b.id, 'webhook').estado, 'pagado'); igual(entradas(env).length, 1);
  igual(env.ctx.efsProcesarPago(a.id, 'barrido').estado, 'pagado'); igual(entradas(env).length, 1);
});

prueba('pago combinado que no suma el precio (2500 + 2000) o con un medio devuelto → anomalía', () => {
  for (const [x, y, extraY] of [[2500, 2000, {}], [2500, 2500, { status: 'rejected' }], [2500, 2500, { transaction_amount_refunded: 100 }]]) {
    const mp = crearMp(); const env = crearEntorno({ mp });
    const ref = env.post(datos()).referencia;
    const a = mp.pagar(ref, { transaction_amount: x }); mp.pagar(ref, { transaction_amount: y, ...extraY });
    igual(env.ctx.efsProcesarPago(a.id, 'webhook').estado, 'anomalia', JSON.stringify([x, y, extraY])); igual(entradas(env).length, 0);
  }
});

prueba('pago combinado: devolver una mitad revoca la entrada', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const ref = env.post(datos()).referencia;
  const a = mp.pagar(ref, { transaction_amount: 2500 }); const b = mp.pagar(ref, { transaction_amount: 2500 });
  env.ctx.efsProcesarPago(a.id, 'webhook'); env.ctx.efsProcesarPago(b.id, 'webhook');
  b.status = 'refunded'; env.ctx.efsProcesarPago(b.id, 'barrido');
  const cab = env.hojas.get('EFS 2026').datos[0];
  igual(entradas(env)[0][cab.indexOf('EstadoEntrada')], 'revocada');
});

prueba('pago combinado + un tercer pago completo de $5.000 sí se avisa como duplicado', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const ref = env.post(datos()).referencia;
  const a = mp.pagar(ref, { transaction_amount: 2500 }); const b = mp.pagar(ref, { transaction_amount: 2500 });
  env.ctx.efsProcesarPago(a.id, 'webhook'); env.ctx.efsProcesarPago(b.id, 'webhook');
  env.ctx.efsProcesarPago(mp.pagar(ref).id, 'webhook');
  igual(entradas(env).length, 1);
  si(env.mails.some((m) => m.asunto.includes('duplicado')), 'no avisó el duplicado');
});

prueba('transferencia: la hoja carga la entrada, manda mail, rechaza DNI repetido y datos incompletos', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const h = env.hojas.get('EFS · Transferencias') || (env.ctx.efsHoja_('EFS · Transferencias'), env.hojas.get('EFS · Transferencias'));
  h.datos.push(['Luz', 'Gómez', '31.222.333', 'luz@ejemplo.com', '341 555-9999', 'Medicina', '2.º', 'UNR', 'transf 5000', '', '']);
  h.datos.push(['Ana', 'Pérez', '31.222.333', 'ana@ejemplo.com', '341 555-9999', 'Medicina', '2.º', 'UNR', '', '', '']);
  h.datos.push(['Sin', 'Mail', '31.222.444', 'no-es-mail', '341 555-9999', 'Medicina', '2.º', 'UNR', '', '', '']);
  const r = env.ctx.efsProcesarTransferencias();
  igual(r.emitidas, 1); igual(r.rechazadas, 2);
  igual(entradas(env).length, 1);
  const cab = env.hojas.get('EFS 2026').datos[0];
  igual(entradas(env)[0][cab.indexOf('Origen')], 'transferencia');
  si(String(h.datos[1][9]) === 'ok' && String(h.datos[1][10]).startsWith('EFS26-'), 'fila 1 sin estado');
  si(String(h.datos[2][9]).includes('ya tiene entrada'), 'DNI repetido no rechazado');
  si(String(h.datos[3][9]).includes('correo'), 'correo malo no rechazado');
  si(env.mails.length >= 1, 'no mandó el mail');
  const r2 = env.ctx.efsProcesarTransferencias(); igual(r2.emitidas, 0); igual(entradas(env).length, 1);
});

prueba('transferencia: acepta pasaporte con "PAS", lo guarda normalizado y el mail dice Pasaporte; la web sigue exigiendo DNI', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const h = env.hojas.get('EFS · Transferencias') || (env.ctx.efsHoja_('EFS · Transferencias'), env.hojas.get('EFS · Transferencias'));
  h.datos.push(['Lucía', 'Silva', 'Pasaporte: ab 123.456', 'lucia@ejemplo.com', '+598 99 123 456', 'Medicina', '3.º', 'UdelaR', '', '', '']);
  h.datos.push(['Otra', 'Silva', 'pas AB123456', 'otra@ejemplo.com', '+598 99 123 456', 'Medicina', '3.º', 'UdelaR', '', '', '']);
  h.datos.push(['Sin', 'Prefijo', 'AB123456', 'sp@ejemplo.com', '+598 99 123 456', 'Medicina', '3.º', 'UdelaR', '', '', '']);
  h.datos.push(['Corto', 'Pas', 'PAS 12', 'cp@ejemplo.com', '+598 99 123 456', 'Medicina', '3.º', 'UdelaR', '', '', '']);
  const r = env.ctx.efsProcesarTransferencias();
  igual(r.emitidas, 1); igual(r.rechazadas, 3);
  const cab = env.hojas.get('EFS 2026').datos[0];
  igual(entradas(env)[0][cab.indexOf('DNI')], 'PAS AB123456');
  si(String(h.datos[2][9]).includes('ya tiene entrada'), 'pasaporte repetido no rechazado');
  si(String(h.datos[3][9]).includes('dni') && String(h.datos[4][9]).includes('dni'), 'pasaporte sin PAS o corto no rechazado');
  const m = env.mails.find((x) => x.to === 'lucia@ejemplo.com');
  si(m && m.plano.includes('Pasaporte AB123456') && m.op.htmlBody.includes('Pasaporte'), 'el mail no muestra el pasaporte');
  igual(env.ctx.efsValidarDatos_({ intento_id: 'abcdefgh1', nombre: 'a', apellido: 'b', dni: 'PAS AB123456', correo: 'a@b.com', telefono: '34155599999', carrera: 'm', anio: '1', universidad: 'u' }).error, 'dni');
});

// ─────────────────────────── panel: alta de transferencia (Etapa 2) ───────────────────────────

const transferenciaPanel = (extra = {}) => ({
  accion: 'admin_alta_transferencia', token: 'sesion-ok', nombre: 'Luz', apellido: 'Gómez', dni: '31.222.333',
  correo: 'luz@ejemplo.com', telefono: '341 555-9999', carrera: 'Medicina', anio: '2.º', universidad: 'UNR', ...extra,
});

prueba('admin_alta_transferencia: sin sesión de admin no responde', () => {
  const env = crearEntorno({ mp: crearMp() });
  const r = env.post({ ...transferenciaPanel(), token: '' });
  igual(r.error, 'no_autorizado'); igual(entradas(env).length, 0);
});

prueba('admin_alta_transferencia: emite la entrada, manda el mail y deja fila "ok" con el código en "EFS · Transferencias"', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const r = env.post(transferenciaPanel({ monto: '5000', fecha: '10/04/2026', comprobante: 'COMP-001' }));
  si(r.ok, JSON.stringify(r)); si(/^EFS26-/.test(r.codigo), 'formato de código');
  igual(entradas(env).length, 1);
  const cab = env.hojas.get('EFS 2026').datos[0];
  igual(entradas(env)[0][cab.indexOf('Origen')], 'transferencia');
  igual(entradas(env)[0][cab.indexOf('DNI')], '31222333');
  igual(env.mails.length, 1); igual(env.mails[0].to, 'luz@ejemplo.com');
  const t = env.hojas.get('EFS · Transferencias'); const colT = t.datos[0]; const fila = t.datos[1];
  igual(fila[colT.indexOf('estado')], 'ok'); igual(fila[colT.indexOf('entrada')], r.codigo);
  const nota = String(fila[colT.indexOf('nota')]);
  si(nota.includes('5000') && nota.includes('10/04/2026') && nota.includes('COMP-001'), 'nota incompleta: ' + nota);
  si(!env.lock(), 'el candado quedó tomado');
});

prueba('admin_alta_transferencia: datos inválidos no emiten nada ni tocan ninguna hoja', () => {
  const env = crearEntorno({ mp: crearMp() });
  const r = env.post(transferenciaPanel({ dni: '12' }));
  igual(r.error, 'datos'); igual(r.campo, 'dni');
  igual(entradas(env).length, 0); igual(pendientes(env).length, 0);
  si(!env.hojas.get('EFS · Transferencias'), 'no debería haber creado la hoja');
});

prueba('admin_alta_transferencia: DNI con entrada activa se rechaza y no duplica ni repite el mail', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  env.ctx.efsProcesarPago(mp.pagar(env.post(datos({ dni: '31555666' })).referencia).id, 'webhook');
  igual(entradas(env).length, 1); igual(env.mails.length, 1);
  const r = env.post(transferenciaPanel({ dni: '31.555.666', correo: 'otra@ejemplo.com' }));
  igual(r.error, 'ya_inscripto'); si(/^EFS26-/.test(r.entrada), 'sin código de la entrada existente');
  igual(entradas(env).length, 1); igual(env.mails.length, 1);
});

prueba('admin_alta_transferencia: acepta pasaporte igual que la carga por hoja', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const r = env.post(transferenciaPanel({ dni: 'pas AB123456', correo: 'lucia@ejemplo.com', telefono: '+598 99 123 456', universidad: 'UdelaR' }));
  si(r.ok, JSON.stringify(r));
  const cab = env.hojas.get('EFS 2026').datos[0];
  igual(entradas(env)[0][cab.indexOf('DNI')], 'PAS AB123456');
});

prueba('admin_alta_cortesia: emite con Origen cortesia, manda el mail sin "recibimos tu pago" y anota el motivo', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const r = env.post(transferenciaPanel({ accion: 'admin_alta_cortesia', motivo: 'disertante', monto: '9999' }));
  si(r.ok, JSON.stringify(r)); si(/^EFS26-/.test(r.codigo), 'formato de código');
  const cab = env.hojas.get('EFS 2026').datos[0];
  const e = entradas(env)[0];
  igual(e[cab.indexOf('Origen')], 'cortesia'); igual(e[cab.indexOf('PagoId')], 'cortesia-panel');
  si(String(e[cab.indexOf('Referencia')]).startsWith('CORTESIA-PANEL-'));
  igual(env.mails.length, 1); igual(env.mails[0].to, 'luz@ejemplo.com');
  si(!env.mails[0].op.htmlBody.includes('recibimos tu pago'), 'el mail de cortesía habla de pago');
  si(env.mails[0].op.htmlBody.includes('ya estás inscripto/a'));
  const t = env.hojas.get('EFS · Transferencias'); const colT = t.datos[0]; const fila = t.datos[1];
  igual(fila[colT.indexOf('nota')], 'Cortesía: disertante', 'la nota no debe llevar el monto');
  igual(fila[colT.indexOf('estado')], 'ok'); igual(fila[colT.indexOf('entrada')], r.codigo);
  si(!env.lock(), 'el candado quedó tomado');
});

prueba('admin_alta_cortesia: sin motivo la nota dice solo "Cortesía"; la conciliación la cuenta como cortesía', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  si(env.post(transferenciaPanel({ accion: 'admin_alta_cortesia' })).ok);
  const t = env.hojas.get('EFS · Transferencias');
  igual(t.datos[1][t.datos[0].indexOf('nota')], 'Cortesía');
  const rep = env.ctx.efsConciliar().reporte;
  igual(rep.cortesias, 1); igual(rep.transferencias, 0);
});

prueba('admin_alta_cortesia: sin sesión no responde; DNI con entrada activa se rechaza', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  igual(env.post({ ...transferenciaPanel({ accion: 'admin_alta_cortesia' }), token: '' }).error, 'no_autorizado');
  si(env.post(transferenciaPanel()).ok);
  const r = env.post(transferenciaPanel({ accion: 'admin_alta_cortesia', correo: 'otra@ejemplo.com' }));
  igual(r.error, 'ya_inscripto'); igual(entradas(env).length, 1); igual(env.mails.length, 1);
});

prueba('las transferencias siguen mandando el mail que dice "recibimos tu pago"', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  si(env.post(transferenciaPanel()).ok);
  si(env.mails[0].op.htmlBody.includes('recibimos tu pago'));
});

prueba('admin_alta_transferencia: con el candado tomado devuelve "ocupado" sin crear nada', () => {
  const env = crearEntorno({ mp: crearMp() });
  const l = env.ctx.LockService.getDocumentLock();
  si(l.tryLock());
  const r = env.post(transferenciaPanel());
  igual(r.error, 'ocupado'); igual(entradas(env).length, 0);
  l.releaseLock();
});

const hace = (horas) => new Date(Date.now() - horas * 3600 * 1000).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour12: false }).replace(',', '');
function envejecer(env, horas) {
  const h = env.hojas.get('EFS · Pendientes'); const cab = h.datos[0];
  h.datos.slice(1).forEach((f) => { f[cab.indexOf('alta')] = hace(horas); });
}
const recordatorios = (env) => env.mails.filter((m) => m.asunto.includes('necesitás ayuda'));

prueba('recordatorio: a quien no pagó en 24 h le llega UN mail de ayuda; antes no, y no se repite', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  env.post(datos());
  env.ctx.efsBarrido(); igual(recordatorios(env).length, 0, 'mandó antes de tiempo');
  envejecer(env, 25);
  env.ctx.efsBarrido(); igual(recordatorios(env).length, 1);
  igual(recordatorios(env)[0].to, 'ana@ejemplo.com');
  const cab = env.hojas.get('EFS · Pendientes').datos[0];
  si(String(pendientes(env)[0][cab.indexOf('motivo')]).includes('recordatorio'), 'no quedó anotado');
  env.ctx.efsBarrido(); igual(recordatorios(env).length, 1, 'se repitió');
});

prueba('recordatorio: no se manda a quien ya tiene entrada, ni con recordatorio_horas = 0, ni después del cierre', () => {
  const mp = crearMp(); let env = crearEntorno({ mp });
  const ref = env.post(datos()).referencia;
  env.ctx.efsProcesarPago(mp.pagar(ref).id, 'webhook'); envejecer(env, 30);
  env.ctx.efsBarrido(); igual(recordatorios(env).length, 0, 'mandó a alguien que ya pagó');

  env = crearEntorno({ mp: crearMp() }); env.poner('recordatorio_horas', 0);
  env.post(datos()); envejecer(env, 30); env.ctx.efsBarrido(); igual(recordatorios(env).length, 0, 'mandó con 0');

  env = crearEntorno({ mp: crearMp() }); env.poner('cierre', '1/1/2020 23:59');
  env.post(datos()); envejecer(env, 30); env.ctx.efsBarrido(); igual(recordatorios(env).length, 0, 'mandó después del cierre');
});

prueba('recordatorio: si la persona paga después del mail, la entrada se emite igual', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const ref = env.post(datos()).referencia;
  envejecer(env, 60); env.ctx.efsBarrido();
  igual(recordatorios(env).length, 1);
  env.ctx.efsProcesarPago(mp.pagar(ref).id, 'webhook');
  igual(entradas(env).length, 1);
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

// ─────────────────────────── Meta · API de Conversiones ───────────────────────────

const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const UA = 'Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile';
const FBP = 'fb.1.1759400000000.1234567890';
const FBC = 'fb.1.1759400000000.IwAR2abc_DEF-123';
const celdaMeta = (env, ref, campo) => { const h = env.hojas.get('EFS · Pendientes'); const cab = h.datos[0]; return h.datos.find((f) => f[cab.indexOf('referencia')] === ref)[cab.indexOf(campo)]; };
const ponerMeta = (env, ref, campo, v) => { const h = env.hojas.get('EFS · Pendientes'); const cab = h.datos[0]; h.datos.find((f) => f[cab.indexOf('referencia')] === ref)[cab.indexOf(campo)] = v; };
const envejecerMeta = (env, ref, seg = 600) => ponerMeta(env, ref, 'meta_tiempo', String(Math.floor(Date.now() / 1000) - seg));
function pagadoConMeta(extra = {}) {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const r = env.post(datos({ meta_fbp: FBP, meta_fbc: FBC, meta_ua: UA, ...extra }));
  const pago = mp.pagar(r.referencia);
  env.post({ accion: 'aviso', tipo: 'payment', id: String(pago.id) });
  return { mp, env, ref: r.referencia, pago };
}

prueba('meta: al inscribirse guarda fbp, fbc y navegador; descarta cookies con forma rara', () => {
  const { env, ref } = pagadoConMeta();
  igual(celdaMeta(env, ref, 'meta_fbp'), FBP); igual(celdaMeta(env, ref, 'meta_fbc'), FBC); igual(celdaMeta(env, ref, 'meta_ua'), UA);
  const mp = crearMp(); const env2 = crearEntorno({ mp });
  const r2 = env2.post(datos({ meta_fbp: '<script>', meta_fbc: 'fb.1.2.x"', meta_ua: 'A\nB' }));
  igual(celdaMeta(env2, r2.referencia, 'meta_fbp'), ''); igual(celdaMeta(env2, r2.referencia, 'meta_fbc'), ''); igual(celdaMeta(env2, r2.referencia, 'meta_ua'), 'AB');
});

prueba('meta: el pago aprobado deja el evento efs26-<pago>, pero se espera unos minutos (primero el navegador)', () => {
  const { env, ref, pago } = pagadoConMeta();
  igual(celdaMeta(env, ref, 'meta_evento'), 'efs26-' + pago.id);
  igual(celdaMeta(env, ref, 'meta_estado'), 'pendiente');
  igual(env.post({ accion: 'meta_pendientes' }).eventos.length, 0);
});

prueba('meta: la cola manda correo y teléfono SOLO hasheados y normalizados, con fbp, fbc, navegador y precio', () => {
  const { env, ref, pago } = pagadoConMeta();
  envejecerMeta(env, ref);
  const r = env.post({ accion: 'meta_pendientes' });
  igual(r.eventos.length, 1);
  const e = r.eventos[0];
  igual(e.evento, 'efs26-' + pago.id); igual(e.valor, 5000);
  igual(e.em, sha('ana@ejemplo.com')); igual(e.ph, sha('543415551234'));
  igual(e.fbp, FBP); igual(e.fbc, FBC); igual(e.ua, UA);
  const texto = JSON.stringify(r);
  for (const dato of ['Ana', 'ejemplo.com', '555', '30123456', 'Pérez']) si(!texto.includes(dato), 'sale en claro: ' + dato);
  si(!env.lock(), 'el candado quedó tomado');
});

prueba('meta: un lote pedido no se vuelve a entregar; "ok" lo marca enviado y no sale más', () => {
  const { env, ref } = pagadoConMeta();
  envejecerMeta(env, ref);
  const ev = env.post({ accion: 'meta_pendientes' }).eventos[0].evento;
  igual(env.post({ accion: 'meta_pendientes' }).eventos.length, 0);
  igual(env.post({ accion: 'meta_marcar', eventos: ev, resultado: 'ok' }).marcados, 1);
  si(String(celdaMeta(env, ref, 'meta_estado')).startsWith('enviado '));
  igual(env.post({ accion: 'meta_pendientes' }).eventos.length, 0);
});

prueba('meta: con error de Meta vuelve a la cola; a los 5 errores se deja de lado y se avisa por mail', () => {
  const { env, ref } = pagadoConMeta();
  envejecerMeta(env, ref);
  for (let n = 1; n <= 5; n++) {
    const ev = env.post({ accion: 'meta_pendientes' }).eventos;
    igual(ev.length, 1, 'intento ' + n);
    env.post({ accion: 'meta_marcar', eventos: ev[0].evento, resultado: 'error', detalle: 'Invalid parameter' });
  }
  si(String(celdaMeta(env, ref, 'meta_estado')).startsWith('omitido'), celdaMeta(env, ref, 'meta_estado'));
  igual(env.post({ accion: 'meta_pendientes' }).eventos.length, 0);
  si(env.mails.some((m) => /Meta no aceptó/.test(m.asunto)), 'sin aviso');
  si(env.errores.some((e) => e.dónde === 'efs-meta'));
});

prueba('meta: lote pedido y nunca confirmado vuelve a la cola a los 15 minutos', () => {
  const { env, ref } = pagadoConMeta();
  envejecerMeta(env, ref);
  env.post({ accion: 'meta_pendientes' });
  ponerMeta(env, ref, 'meta_estado', 'enviando:' + (Math.floor(Date.now() / 1000) - 1000) + ':0');
  igual(env.post({ accion: 'meta_pendientes' }).eventos.length, 1);
});

prueba('meta: sin navegador o con más de 6 días se omite; devuelto o sin pagar no entra a la cola', () => {
  const a = pagadoConMeta({ meta_ua: '' });
  envejecerMeta(a.env, a.ref);
  igual(a.env.post({ accion: 'meta_pendientes' }).eventos.length, 0);
  igual(celdaMeta(a.env, a.ref, 'meta_estado'), 'omitido: sin navegador');
  const b = pagadoConMeta();
  envejecerMeta(b.env, b.ref, 7 * 86400);
  igual(b.env.post({ accion: 'meta_pendientes' }).eventos.length, 0);
  const c = pagadoConMeta();
  envejecerMeta(c.env, c.ref);
  c.pago.status = 'refunded';
  c.env.post({ accion: 'aviso', tipo: 'payment', id: String(c.pago.id) });
  igual(c.env.post({ accion: 'meta_pendientes' }).eventos.length, 0);
  const mp = crearMp(); const d = crearEntorno({ mp });
  d.post(datos({ meta_ua: UA }));
  igual(d.post({ accion: 'meta_pendientes' }).eventos.length, 0);
});

prueba('meta: hoja de Pendientes vieja (sin columnas meta) se completa sola y sigue funcionando', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const h = env.hojas.get('EFS · Pendientes');
  h.datos[0] = h.datos[0].filter((c) => !c.startsWith('meta_'));
  const r = env.post(datos({ meta_ua: UA }));
  si(r.ok);
  env.post({ accion: 'aviso', tipo: 'payment', id: String(mp.pagar(r.referencia).id) });
  igual(entradas(env).length, 1);
  si(h.datos[0].includes('meta_evento') && h.datos[0].includes('meta_estado'));
  si(String(celdaMeta(env, r.referencia, 'meta_evento')).startsWith('efs26-'));
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

prueba('Solo Brevo disponible: sale por Brevo, con el QR como imagen enlazada y adjunto', () => {
  const mp = crearMp(); const env = crearEntorno({ mp, quota: 5, brevo: {} });
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

prueba('Gmail sin cupo: sale por SMTP2GO con el QR incrustado (CID) y antes que Resend y Brevo', () => {
  const mp = crearMp(); const env = crearEntorno({ mp, quota: 5, resend: {}, brevo: {}, smtp2go: {} });
  env.ctx.efsProcesarPago(mp.pagar(env.post(datos()).referencia).id, 'webhook');
  igual(env.mails.length, 0); igual(env.smtp2goEnvios.length, 1); igual(env.resendEnvios.length, 0); igual(env.brevoEnvios.length, 0);
  const s = env.smtp2goEnvios[0];
  igual(s.headers['X-Smtp2go-Api-Key'], 'api-prueba'); igual(s.cuerpo.to, ['ana@ejemplo.com']);
  si(s.cuerpo.sender.includes('<efs@atpfcm.com.ar>')); igual(s.cuerpo.inlines[0].filename, 'qr'); si(s.cuerpo.html_body.includes('cid:qr'));
  const cab = env.hojas.get('EFS 2026').datos[0];
  si(String(entradas(env)[0][cab.indexOf('MailEntrada')]).includes('(SMTP2GO)'));
});

prueba('SMTP2GO falla: cae a Resend y, si este también falla, a Brevo', () => {
  const mp = crearMp(); const env = crearEntorno({ mp, quota: 5, resend: { falla: true }, brevo: {}, smtp2go: { falla: true } });
  env.ctx.efsProcesarPago(mp.pagar(env.post(datos()).referencia).id, 'webhook');
  igual(env.smtp2goEnvios.length, 1); igual(env.resendEnvios.length, 1); igual(env.brevoEnvios.length, 1);
});

// ─────────── día del evento: lista y sincronización con el Durable Object ───────────

function pagarUna(env, mp, extra = {}) {
  env.ctx.efsProcesarPago(mp.pagar(env.post(datos(extra)).referencia).id, 'webhook');
  const cab = env.hojas.get('EFS 2026').datos[0];
  const col = (n) => cab.indexOf(n);
  const fila = entradas(env).at(-1);
  return { codigo: fila[col('RegistrationId')], col, celda: (cod, n) => { const f = entradas(env).find((x) => x[col('RegistrationId')] === cod); return f ? f[col(n)] : undefined; } };
}

prueba('staff_lista: solo con el secreto del Worker, con datos mínimos de cada entrada', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const { codigo } = pagarUna(env, mp);
  const r = env.post({ accion: 'staff_lista' });
  igual(r.ok, true); igual(r.entradas.length, 1);
  const x = r.entradas[0];
  igual(x.c, codigo); igual(x.e, 'activa'); igual(x.a, 0); igual(x.dni, '30123456'); igual(x.cr, ''); igual(x.t, '');
  const sinSecreto = JSON.parse(env.ctx.efsRouter({ parameter: { accion: 'staff_lista' } }).texto);
  igual(sinSecreto.error, 'no_autorizado');
});

prueba('staff_sync: deja hora, puesto, credencial, taller y Asistencias; no toca el resto de la fila', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const { codigo, celda } = pagarUna(env, mp);
  const mailAntes = celda(codigo, 'MailEntrada'); const emailAntes = celda(codigo, 'Email');
  const hora = Date.UTC(2026, 9, 17, 12, 30);
  const r = env.post({ accion: 'staff_sync', lote: JSON.stringify([{ c: codigo, a: hora, p: 'Puesto 2', cr: 'EFSC-1234ABCD', t: 'Sutura' }]) });
  igual(r.ok, true); igual(r.n, 1); igual(r.no_encontrados, []);
  igual(celda(codigo, 'Credencial'), 'EFSC-1234ABCD'); igual(celda(codigo, 'Taller'), 'Sutura'); igual(celda(codigo, 'AcreditadoPor'), 'Puesto 2');
  si(String(celda(codigo, 'AcreditadoEn')).includes('2026'));
  igual(JSON.parse(celda(codigo, 'Asistencias')), ['EFS 2026']);
  igual(celda(codigo, 'MailEntrada'), mailAntes); igual(celda(codigo, 'Email'), emailAntes); igual(celda(codigo, 'EstadoEntrada'), 'activa');
  // el listado ya devuelve lo acreditado (para que el Durable Object se pueda recuperar)
  const l = env.post({ accion: 'staff_lista' }).entradas[0];
  igual(l.cr, 'EFSC-1234ABCD'); igual(l.t, 'Sutura'); igual(l.p, 'Puesto 2'); si(l.a > 0);
});

prueba('staff_sync: repetir el lote no duplica nada; desacreditar limpia la asistencia', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const { codigo, celda } = pagarUna(env, mp);
  const lote = JSON.stringify([{ c: codigo, a: Date.UTC(2026, 9, 17, 12, 0), p: 'P1', cr: '', t: '' }]);
  env.post({ accion: 'staff_sync', lote }); env.post({ accion: 'staff_sync', lote });
  igual(JSON.parse(celda(codigo, 'Asistencias')), ['EFS 2026']);
  env.post({ accion: 'staff_sync', lote: JSON.stringify([{ c: codigo, a: 0, p: '', cr: '', t: '' }]) });
  igual(JSON.parse(celda(codigo, 'Asistencias')), []); igual(celda(codigo, 'AcreditadoEn'), ''); igual(celda(codigo, 'Credencial'), '');
});

prueba('staff_sync: un código que no existe se informa y no rompe el lote; un taller con "=" no se vuelve fórmula', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const { codigo, celda } = pagarUna(env, mp);
  const r = env.post({ accion: 'staff_sync', lote: JSON.stringify([{ c: 'EFS26-ZZZZZZZZ', a: 1 }, { c: codigo, a: Date.UTC(2026, 9, 17, 12, 0), p: 'P1', cr: '', t: '=HYPERLINK("x")' }]) });
  igual(r.ok, true); igual(r.n, 1); igual(r.no_encontrados, ['EFS26-ZZZZZZZZ']);
  igual(celda(codigo, 'Taller'), '=HYPERLINK("x")'); // se guardó como texto (con apóstrofo, que Sheets no muestra)
  igual(env.post({ accion: 'staff_sync', lote: 'esto no es json' }).error, 'formato');
});

prueba('staff_sync: la planilla anterior a las columnas del evento las recibe al final', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const { codigo } = pagarUna(env, mp);
  const hoja = env.hojas.get('EFS 2026');
  const fin = hoja.datos[0].indexOf('Credencial');
  for (const f of hoja.datos) f.splice(fin); // simula una hoja vieja sin Credencial/Taller/AcreditadoEn/AcreditadoPor
  const r = env.post({ accion: 'staff_sync', lote: JSON.stringify([{ c: codigo, a: Date.UTC(2026, 9, 17, 12, 0), p: 'P1', cr: 'EFSC-1234ABCD', t: 'RCP' }]) });
  igual(r.ok, true);
  const cab = hoja.datos[0];
  si(cab.includes('Credencial') && cab.includes('Taller') && cab.includes('AcreditadoEn') && cab.includes('AcreditadoPor'));
  igual(hoja.datos[1][cab.indexOf('Taller')], 'RCP');
});

// ─────────── entradas de prueba del escáner ───────────

prueba('efsCrearEntradasPrueba: crea 5 entradas TEST sin mail, sin duplicar al repetir', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  env.ctx.efsCrearEntradasPrueba(); env.ctx.efsCrearEntradasPrueba();
  const cab = env.hojas.get('EFS 2026').datos[0];
  const filas = entradas(env);
  igual(filas.length, 5);
  igual(filas.map((f) => f[cab.indexOf('RegistrationId')]), ['EFS26-TEST0001', 'EFS26-TEST0002', 'EFS26-TEST0003', 'EFS26-TEST0004', 'EFS26-TEST0005']);
  si(filas.every((f) => f[cab.indexOf('EstadoEntrada')] === 'activa' && f[cab.indexOf('Origen')] === 'cortesia'));
  si(filas.every((f) => env.ctx.efsMailEnviado_(f[cab.indexOf('MailEntrada')])), 'el barrido no debe intentar mandarles mail');
  si(filas.every((f) => f[4] === '' && f[4] !== true), 'la columna E no es un booleano');
});

prueba('entradas de prueba: el escáner las ve en staff_lista y no hay reintento de mails', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  env.ctx.efsCrearEntradasPrueba();
  const l = env.post({ accion: 'staff_lista' }).entradas;
  igual(l.length, 5); igual(l[0].c, 'EFS26-TEST0001'); igual(l[0].n, 'TEST Uno'); igual(l[0].e, 'activa');
  env.ctx.efsBarrido && env.ctx.efsReintentarMails_(Date.now());
  igual(env.mails.length, 0);
});

prueba('efsRetirarEntradasPrueba: las deja revocadas y no toca otras entradas', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const real = pagarUna(env, mp);
  env.ctx.efsCrearEntradasPrueba(); env.ctx.efsRetirarEntradasPrueba();
  const cab = env.hojas.get('EFS 2026').datos[0];
  const filas = entradas(env);
  igual(filas.filter((f) => f[cab.indexOf('EstadoEntrada')] === 'revocada').length, 5);
  igual(real.celda(real.codigo, 'EstadoEntrada'), 'activa');
});

prueba('un pago sin inscripción se avisa UNA sola vez aunque el barrido lo vea muchas veces (y aunque venza el freno de 30 min)', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const id = mp.pagar('EFSP-ZZZZZZZZZZ').id;
  const avisos = () => env.mails.filter((m) => m.asunto === 'EFS: pago sin inscripción').length;
  env.ctx.efsProcesarPago(id, 'barrido'); igual(avisos(), 1);
  env.cache.clear(); env.ctx.efsProcesarPago(id, 'barrido'); igual(avisos(), 1);
  env.cache.clear(); env.ctx.efsProcesarPago(id, 'barrido'); igual(avisos(), 1);
});

prueba('un pago sin inscripción DISTINTO sí se avisa', () => {
  const mp = crearMp(); const env = crearEntorno({ mp });
  const a = mp.pagar('EFSP-ZZZZZZZZZZ').id, b = mp.pagar('EFSP-YYYYYYYYYY').id;
  const avisos = () => env.mails.filter((m) => m.asunto === 'EFS: pago sin inscripción').length;
  env.ctx.efsProcesarPago(a, 'barrido'); env.cache.clear(); env.ctx.efsProcesarPago(b, 'barrido');
  igual(avisos(), 2);
});

console.log(`\n${ok} bien, ${fallas} mal\n`);
process.exit(fallas ? 1 : 0);
