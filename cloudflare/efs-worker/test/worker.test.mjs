// Pruebas del Worker del EFS con fetch simulado. Correr con: npm test
// (Node 22.6+ ejecuta el .ts directo, quitando los tipos).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import worker from '../src/index.ts';

const ENDPOINT = 'https://script.google.com/macros/s/X/exec';
const baseEnv = {
  APPS_SCRIPT_ENDPOINT: ENDPOINT,
  ALLOWED_ORIGINS: 'https://efsarg.com.ar,https://atpfcm.com.ar',
  TURNSTILE_HOSTNAMES: 'efsarg.com.ar',
  EFS_WORKER_SECRET: 'secreto-worker',
  TURNSTILE_SECRET: 'secreto-turnstile',
};

// Simula Turnstile y el Apps Script. `respuestas` es la cola de respuestas del Apps Script.
function simular({ dns = 'ok', turnstile = { success: true, hostname: 'efsarg.com.ar' }, respuestas = [{ ok: true, pago_url: 'https://mp/checkout/1', referencia: 'EFSP-ABCDEFGHJK' }] } = {}) {
  const llamadas = { apps: [], turnstile: [] };
  globalThis.fetch = async (url, op = {}) => {
    if (String(url).includes('cloudflare-dns.com')) {
      llamadas.dns = (llamadas.dns || 0) + 1;
      if (dns === 'caido') throw new Error('dns caído');
      if (dns === 'nxdomain') return new Response(JSON.stringify({ Status: 3 }));
      if (dns === 'sinmx') {
        const esMx = String(url).includes('type=MX');
        return new Response(JSON.stringify(esMx ? { Status: 0 } : { Status: 0, Answer: [{ data: '1.2.3.4' }] }));
      }
      return new Response(JSON.stringify({ Status: 0, Answer: [{ data: '10 mx.ejemplo.com.' }] }));
    }
    if (String(url).includes('turnstile')) {
      llamadas.turnstile.push(Object.fromEntries(op.body));
      return new Response(JSON.stringify(turnstile));
    }
    if (String(url) === ENDPOINT) {
      llamadas.apps.push(Object.fromEntries(op.body));
      const r = respuestas.length > 1 ? respuestas.shift() : respuestas[0];
      if (r === 'red') throw new Error('red caída');
      return new Response(typeof r === 'string' ? r : JSON.stringify(r));
    }
    throw new Error('fetch inesperado ' + url);
  };
  return llamadas;
}

let ipN = 0;
function pedido(ruta, cuerpo, { origen = 'https://efsarg.com.ar', ip, headers = {}, metodo = 'POST' } = {}) {
  return new Request('https://efs-worker.ejemplo' + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Origin: origen, 'CF-Connecting-IP': ip || '10.0.0.' + ++ipN, ...headers },
    body: metodo === 'POST' ? (typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)) : undefined,
  });
}

function ctx() {
  const pendientes = [];
  return { waitUntil: (p) => pendientes.push(p), passThroughOnException() {}, esperar: () => Promise.all(pendientes) };
}

const formulario = (extra = {}) => ({
  turnstile: 'tok', intento_id: '11111111-2222-3333-4444-555555555555', nombre: 'Ana', apellido: 'Pérez',
  dni: '30123456', correo: 'ana@ejemplo.com', telefono: '', carrera: 'Medicina', anio: '3.º', universidad: 'UNR', ...extra,
});

test('CORS: responde el preflight solo con orígenes permitidos', async () => {
  const bien = await worker.fetch(pedido('/inscribir', null, { metodo: 'OPTIONS' }), baseEnv, ctx());
  assert.equal(bien.status, 204);
  assert.equal(bien.headers.get('Access-Control-Allow-Origin'), 'https://efsarg.com.ar');
  const mal = await worker.fetch(pedido('/inscribir', null, { metodo: 'OPTIONS', origen: 'https://malo.com' }), baseEnv, ctx());
  assert.notEqual(mal.headers.get('Access-Control-Allow-Origin'), 'https://malo.com');
});

test('inscribir: sin Turnstile válido no llega al Apps Script', async () => {
  const ll = simular({ turnstile: { success: false } });
  const r = await (await worker.fetch(pedido('/inscribir', formulario()), baseEnv, ctx())).json();
  assert.equal(r.error, 'turnstile');
  assert.equal(ll.apps.length, 0);
});

test('inscribir: Turnstile resuelto en otro dominio se rechaza', async () => {
  simular({ turnstile: { success: true, hostname: 'otro-sitio.com' } });
  const r = await (await worker.fetch(pedido('/inscribir', formulario()), baseEnv, ctx())).json();
  assert.equal(r.error, 'turnstile');
});

test('inscribir: reenvía al Apps Script con formType=efs, el secreto y solo los campos esperados', async () => {
  const ll = simular();
  const r = await (await worker.fetch(pedido('/inscribir', formulario({ precio: '1', formType: 'charla' })), baseEnv, ctx())).json();
  assert.equal(r.pago_url, 'https://mp/checkout/1');
  const p = ll.apps[0];
  assert.equal(p.formType, 'efs'); assert.equal(p.accion, 'iniciar'); assert.equal(p.efs_secreto, 'secreto-worker');
  assert.equal(p.dni, '30123456'); assert.equal(p.precio, undefined);
  assert.equal(ll.turnstile[0].remoteip.startsWith('10.0.0.'), true);
});

test('inscribir: si el Apps Script está ocupado o se cae la red, reintenta con el mismo intento', async () => {
  const ll = simular({ respuestas: [{ ok: false, error: 'ocupado' }, 'red', { ok: true, pago_url: 'https://mp/checkout/2' }] });
  const r = await (await worker.fetch(pedido('/inscribir', formulario()), baseEnv, ctx())).json();
  assert.equal(r.pago_url, 'https://mp/checkout/2');
  assert.equal(ll.apps.length, 3);
  assert.equal(new Set(ll.apps.map((a) => a.intento_id)).size, 1);
});

test('inscribir: errores de negocio (ya inscripto, datos) no se reintentan', async () => {
  const ll = simular({ respuestas: [{ ok: false, error: 'ya_inscripto' }] });
  const r = await (await worker.fetch(pedido('/inscribir', formulario()), baseEnv, ctx())).json();
  assert.equal(r.error, 'ya_inscripto'); assert.equal(ll.apps.length, 1);
});

test('inscribir: respuesta no JSON del Apps Script → error de servicio, sin romper', async () => {
  simular({ respuestas: ['<html>error de Google</html>'] });
  const r = await (await worker.fetch(pedido('/inscribir', formulario()), baseEnv, ctx())).json();
  assert.equal(r.error, 'servicio');
});

test('inscribir: freno por IP después de 8 intentos en 10 minutos', async () => {
  simular();
  let ultimo;
  for (let i = 0; i < 9; i++) ultimo = await (await worker.fetch(pedido('/inscribir', formulario(), { ip: '9.9.9.9' }), baseEnv, ctx())).json();
  assert.equal(ultimo.error, 'demasiados_intentos');
});

test('cuerpo inválido → error de formato', async () => {
  simular();
  const r = await worker.fetch(pedido('/inscribir', 'no es json'), baseEnv, ctx());
  assert.equal(r.status, 400);
});

test('verificar: exige referencia con formato EFSP y pago numérico', async () => {
  const ll = simular({ respuestas: [{ ok: true, estado: 'pagado', codigo: 'EFS26-ABCDEFGH' }] });
  assert.equal((await (await worker.fetch(pedido('/verificar', { pago_id: '123', referencia: 'x' }), baseEnv, ctx())).json()).error, 'formato');
  const r = await (await worker.fetch(pedido('/verificar', { pago_id: '123', referencia: 'EFSP-ABCDEFGHJK' }), baseEnv, ctx())).json();
  assert.equal(r.codigo, 'EFS26-ABCDEFGH');
  assert.equal(ll.apps.length, 1); assert.equal(ll.apps[0].accion, 'verificar');
});

// Aviso firmado como lo hace Mercado Pago: HMAC-SHA256 de "id:<data.id>;request-id:<x-request-id>;ts:<ts>;".
const envWebhook = { ...baseEnv, MP_WEBHOOK_SECRET: 'clave-webhook' };
const TS_AHORA = String(Date.now()); // la firma vale 5 minutos (ver firmaMercadoPagoValida)
function avisoFirmado(ruta, { id = '555', reqId = 'req-1', ts = TS_AHORA, clave = 'clave-webhook', ip } = {}) {
  const firma = crypto.createHmac('sha256', clave).update(`id:${id};request-id:${reqId};ts:${ts};`).digest('hex');
  return pedido(ruta, {}, { origen: '', ip, headers: { 'x-signature': `ts=${ts},v1=${firma}`, 'x-request-id': reqId } });
}

test('aviso de Mercado Pago firmado: responde 200 al instante y reenvía en segundo plano', async () => {
  const ll = simular({ respuestas: [{ ok: true }] });
  const c = ctx();
  const r = await worker.fetch(avisoFirmado('/mp/aviso?type=payment&data.id=555'), envWebhook, c);
  assert.equal(r.status, 200);
  await c.esperar();
  assert.equal(ll.apps[0].accion, 'aviso'); assert.equal(ll.apps[0].tipo, 'payment'); assert.equal(ll.apps[0].id, '555');
});

test('aviso: sin firma, con firma falsa o con otra clave se rechaza y no llega al Apps Script', async () => {
  const ll = simular({ respuestas: [{ ok: true }] });
  const c = ctx();
  const sinFirma = await worker.fetch(pedido('/mp/aviso?type=payment&data.id=555', { type: 'payment', data: { id: '555' } }, { origen: '' }), envWebhook, c);
  assert.equal(sinFirma.status, 401);
  const falsa = await worker.fetch(pedido('/mp/aviso?type=payment&data.id=555', {}, { origen: '', headers: { 'x-signature': `ts=${TS_AHORA},v1=${'0'.repeat(64)}`, 'x-request-id': 'req-1' } }), envWebhook, c);
  assert.equal(falsa.status, 401);
  const otraClave = await worker.fetch(avisoFirmado('/mp/aviso?type=payment&data.id=555', { clave: 'otra' }), envWebhook, c);
  assert.equal(otraClave.status, 401);
  const otroId = await worker.fetch(avisoFirmado('/mp/aviso?type=payment&data.id=556'), envWebhook, c); // firma de 555 usada con otro pago
  assert.equal(otroId.status, 401);
  await c.esperar();
  assert.equal(ll.apps.length, 0);
});

test('aviso: sin MP_WEBHOOK_SECRET configurado no se procesa nada (503)', async () => {
  const ll = simular({ respuestas: [{ ok: true }] });
  const c = ctx();
  const r = await worker.fetch(pedido('/mp/aviso?type=payment&data.id=555', { type: 'payment', data: { id: '555' } }, { origen: '' }), baseEnv, c);
  assert.equal(r.status, 503);
  await c.esperar();
  assert.equal(ll.apps.length, 0);
});

test('aviso: merchant_order también exige firma; otros tipos se ignoran sin procesar', async () => {
  const ll = simular({ respuestas: [{ ok: true }] });
  const c = ctx();
  const sinFirma = await worker.fetch(pedido('/mp/aviso?topic=merchant_order&id=777', {}, { origen: '' }), envWebhook, c);
  assert.equal(sinFirma.status, 401);
  const firmada = await worker.fetch(avisoFirmado('/mp/aviso?type=merchant_order&data.id=777', { id: '777' }), envWebhook, c);
  assert.equal(firmada.status, 200);
  const otro = await worker.fetch(pedido('/mp/aviso?type=subscription&data.id=1', {}, { origen: '' }), envWebhook, c);
  assert.equal(otro.status, 200);
  await c.esperar();
  assert.equal(ll.apps.length, 1); assert.equal(ll.apps[0].tipo, 'merchant_order');
});

test('aviso: el data.id del manifiesto sale del query; si el query no lo trae se omite (como dice Mercado Pago)', async () => {
  const ll = simular({ respuestas: [{ ok: true }] });
  const c = ctx();
  const ts = TS_AHORA;
  const firma = crypto.createHmac('sha256', 'clave-webhook').update(`request-id:req-9;ts:${ts};`).digest('hex');
  const r = await worker.fetch(pedido('/mp/aviso', { type: 'payment', data: { id: '555' } }, { origen: '', headers: { 'x-signature': `ts=${ts},v1=${firma}`, 'x-request-id': 'req-9' } }), envWebhook, c);
  assert.equal(r.status, 200);
  await c.esperar();
  assert.equal(ll.apps[0].id, '555');
});

test('aviso: una firma con más de 5 minutos no se acepta (no sirve reenviar uno capturado)', async () => {
  const ll = simular({ respuestas: [{ ok: true }] });
  const c = ctx();
  const viejo = String(Date.now() - 10 * 60 * 1000);
  const r = await worker.fetch(avisoFirmado('/mp/aviso?type=payment&data.id=555', { ts: viejo }), envWebhook, c);
  assert.equal(r.status, 401);
  await c.esperar();
  assert.equal(ll.apps.length, 0);
});

test('aviso: tras 20 firmas falsas desde la misma IP se corta (429), incluso con una firma buena', async () => {
  const ll = simular({ respuestas: [{ ok: true }] });
  const c = ctx();
  for (let i = 0; i < 20; i++) await worker.fetch(pedido('/mp/aviso?type=payment&data.id=555', {}, { origen: '', ip: '7.7.7.7' }), envWebhook, c);
  const buena = await worker.fetch(avisoFirmado('/mp/aviso?type=payment&data.id=555', { ip: '7.7.7.7' }), envWebhook, c);
  assert.equal(buena.status, 429);
  const otraIp = await worker.fetch(avisoFirmado('/mp/aviso?type=payment&data.id=555', { ip: '7.7.7.8' }), envWebhook, c);
  assert.equal(otraIp.status, 200);
  await c.esperar();
  assert.equal(ll.apps.length, 1);
});

test('admin: solo acciones admin_* conocidas, con el token de sesión', async () => {
  const ll = simular({ respuestas: [{ ok: true, entradas: [] }] });
  assert.equal((await (await worker.fetch(pedido('/admin', { accion: 'iniciar' }), baseEnv, ctx())).json()).error, 'accion');
  await worker.fetch(pedido('/admin', { accion: 'admin_resumen', token: 'tok-admin' }), baseEnv, ctx());
  assert.equal(ll.apps.length, 1); assert.equal(ll.apps[0].token, 'tok-admin'); assert.equal(ll.apps[0].efs_secreto, 'secreto-worker');
});

test('admin: las altas del panel reenvían los datos de la persona y la nota; las demás acciones no', async () => {
  const ll = simular({ respuestas: [{ ok: true }] });
  const datos = { nombre: 'Luz', dni: '31222333', correo: 'luz@ejemplo.com', monto: '5000', motivo: 'disertante' };
  await worker.fetch(pedido('/admin', { accion: 'admin_alta_transferencia', token: 't', ...datos }), baseEnv, ctx());
  await worker.fetch(pedido('/admin', { accion: 'admin_alta_cortesia', token: 't', ...datos }), baseEnv, ctx());
  await worker.fetch(pedido('/admin', { accion: 'admin_resumen', token: 't', ...datos }), baseEnv, ctx());
  assert.equal(ll.apps[0].accion, 'admin_alta_transferencia'); assert.equal(ll.apps[0].dni, '31222333'); assert.equal(ll.apps[0].monto, '5000');
  assert.equal(ll.apps[1].accion, 'admin_alta_cortesia'); assert.equal(ll.apps[1].motivo, 'disertante'); assert.equal(ll.apps[1].correo, 'luz@ejemplo.com');
  assert.equal(ll.apps[2].dni, undefined, 'admin_resumen no debe recibir datos personales');
});

test('invitacion: con Turnstile válido reenvía los datos y el código (en mayúsculas), sin campos de más', async () => {
  const ll = simular({ respuestas: [{ ok: true, codigo: 'EFS26-ABCDEFGH', nombre: 'Ana' }] });
  const r = await (await worker.fetch(pedido('/invitacion', formulario({ invitacion: ' inv-abcd2345 ', precio: '1', fbp: 'fb.1.2.3' })), baseEnv, ctx())).json();
  assert.equal(r.codigo, 'EFS26-ABCDEFGH');
  const p = ll.apps[0];
  assert.equal(p.accion, 'invitar'); assert.equal(p.invitacion, 'INV-ABCD2345'); assert.equal(p.formType, 'efs');
  assert.equal(p.efs_secreto, 'secreto-worker'); assert.equal(p.dni, '30123456');
  assert.equal(p.precio, undefined); assert.equal(p.meta_fbp, undefined);
  assert.equal(ll.turnstile.length, 1);
});

test('invitacion: sin Turnstile, con código mal formado o con correo imposible no llega al Apps Script', async () => {
  let ll = simular({ turnstile: { success: false } });
  assert.equal((await (await worker.fetch(pedido('/invitacion', formulario({ invitacion: 'INV-ABCD2345' })), baseEnv, ctx())).json()).error, 'turnstile');
  assert.equal(ll.apps.length, 0);
  ll = simular();
  for (const invitacion of ['', 'INV-123', 'EFS26-ABCDEFGH', 'INV-ABCD234!']) {
    assert.equal((await (await worker.fetch(pedido('/invitacion', formulario({ invitacion })), baseEnv, ctx())).json()).error, 'invitacion', invitacion);
  }
  assert.equal(ll.apps.length, 0); assert.equal(ll.turnstile.length, 0);
  const r = await (await worker.fetch(pedido('/invitacion', formulario({ invitacion: 'INV-ABCD2345', correo: 'ana@gmial.com' })), baseEnv, ctx())).json();
  assert.equal(r.error, 'correo_dominio'); assert.equal(ll.apps.length, 0);
});

test('invitacion: si el Apps Script está ocupado reintenta con el mismo intento; un link agotado no se reintenta', async () => {
  let ll = simular({ respuestas: [{ ok: false, error: 'ocupado' }, { ok: true, codigo: 'EFS26-ABCDEFGH' }] });
  const r = await (await worker.fetch(pedido('/invitacion', formulario({ invitacion: 'INV-ABCD2345' })), baseEnv, ctx())).json();
  assert.equal(r.ok, true); assert.equal(ll.apps.length, 2);
  assert.equal(new Set(ll.apps.map((a) => a.intento_id)).size, 1);
  ll = simular({ respuestas: [{ ok: false, error: 'invitacion_agotada' }] });
  assert.equal((await (await worker.fetch(pedido('/invitacion', formulario({ invitacion: 'INV-ABCD2345' })), baseEnv, ctx())).json()).error, 'invitacion_agotada');
  assert.equal(ll.apps.length, 1);
});

test('invitacion/ver: consulta sin Turnstile y solo manda el código', async () => {
  const ll = simular({ respuestas: [{ ok: true, titular: 'Juan Pérez', libres: 3 }] });
  const r = await (await worker.fetch(pedido('/invitacion/ver', { invitacion: 'inv-abcd2345', dni: '30123456' }), baseEnv, ctx())).json();
  assert.deepEqual(r, { ok: true, titular: 'Juan Pérez', libres: 3 });
  assert.equal(ll.apps[0].accion, 'invitacion_ver'); assert.equal(ll.apps[0].invitacion, 'INV-ABCD2345'); assert.equal(ll.apps[0].dni, undefined);
  assert.equal(ll.turnstile.length, 0);
  assert.equal((await (await worker.fetch(pedido('/invitacion/ver', { invitacion: 'nada' }), baseEnv, ctx())).json()).error, 'invitacion');
  assert.equal(ll.apps.length, 1);
});

test('invitacion: tras 10 códigos inexistentes desde la misma IP se corta, también para un código bueno', async () => {
  const ll = simular({ respuestas: [{ ok: false, error: 'invitacion' }] });
  const ip = '10.9.9.9';
  for (let n = 0; n < 10; n++) {
    assert.equal((await (await worker.fetch(pedido('/invitacion/ver', { invitacion: 'INV-AAAAAAA' + n }, { ip }), baseEnv, ctx())).json()).error, 'invitacion');
  }
  assert.equal((await (await worker.fetch(pedido('/invitacion/ver', { invitacion: 'INV-ABCD2345' }, { ip }), baseEnv, ctx())).json()).error, 'demasiados_intentos');
  assert.equal((await (await worker.fetch(pedido('/invitacion', formulario({ invitacion: 'INV-ABCD2345' }), { ip }), baseEnv, ctx())).json()).error, 'demasiados_intentos');
  assert.equal(ll.apps.length, 10);
});

test('rutas desconocidas y métodos no permitidos', async () => {
  simular();
  assert.equal((await worker.fetch(pedido('/otra', {}), baseEnv, ctx())).status, 404);
  assert.equal((await worker.fetch(pedido('/inscribir', null, { metodo: 'GET' }), baseEnv, ctx())).status, 405);
  assert.equal((await worker.fetch(pedido('/salud', null, { metodo: 'GET' }), baseEnv, ctx())).status, 200);
});

test('correo: dominio inexistente, tipeo conocido o sin formato se rechazan antes de cobrar', async () => {
  for (const [dns, correo, esperado] of [['nxdomain', 'ana@noexiste-zzz.com', 'correo_dominio'], ['ok', 'ana@gmial.com', 'correo_dominio'], ['ok', 'ana@gmail.con', 'correo_dominio'], ['ok', 'ana-sin-arroba', 'datos']]) {
    const llamadas = simular({ dns });
    const r = await (await worker.fetch(pedido('/inscribir', formulario({ correo })), baseEnv, ctx())).json();
    assert.equal(r.ok, false, correo); assert.equal(r.error, esperado, correo);
    assert.equal(llamadas.apps.length, 0, 'no debe llegar al Apps Script: ' + correo);
  }
  const r = await (await worker.fetch(pedido('/inscribir', formulario({ correo: 'Ana@Gmial.com' })), baseEnv, ctx())).json();
  assert.equal(r.sugerencia, 'ana@gmail.com');
});

test('correo: dominio con solo registro A, o con DNS caído, deja pasar', async () => {
  for (const dns of ['sinmx', 'caido', 'ok']) {
    const llamadas = simular({ dns });
    const r = await (await worker.fetch(pedido('/inscribir', formulario()), baseEnv, ctx())).json();
    assert.equal(r.ok, true, dns); assert.equal(llamadas.apps.length, 1, dns);
  }
});

// ─────────────────────────── promo 2x1 ───────────────────────────

const conAcomp = (extra = {}) => formulario({
  promo: '2x1', acomp_nombre: 'Beto', acomp_apellido: 'Gómez', acomp_dni: '40111222', acomp_correo: 'beto@ejemplo.com',
  acomp_telefono: '341 666-7777', acomp_carrera: 'Enfermería', acomp_anio: '1.º', acomp_universidad: 'UNR', ...extra,
});

test('2x1: pasa promo y los datos del acompañante al Apps Script', async () => {
  const ll = simular({ respuestas: [{ ok: true, pago_url: 'https://mp/checkout/1', referencia: 'EFSP-ABCDEFGHJK', promo: '2x1' }] });
  const r = await (await worker.fetch(pedido('/inscribir', conAcomp({ acomp_extra: 'no' })), baseEnv, ctx())).json();
  assert.equal(r.promo, '2x1');
  const p = ll.apps[0];
  assert.equal(p.promo, '2x1'); assert.equal(p.acomp_dni, '40111222'); assert.equal(p.acomp_correo, 'beto@ejemplo.com');
  assert.equal(p.acomp_universidad, 'UNR'); assert.equal(p.acomp_extra, undefined);
});

test('2x1: sin promo no pasa ningún campo del acompañante aunque vengan', async () => {
  const ll = simular();
  await worker.fetch(pedido('/inscribir', conAcomp({ promo: 'otra' })), baseEnv, ctx());
  const p = ll.apps[0];
  assert.equal(p.promo, undefined); assert.equal(p.acomp_dni, undefined);
});

test('2x1: correo del acompañante con dominio mal escrito → correo_dominio con campo acomp_correo, sin llegar al Apps Script', async () => {
  const ll = simular();
  const r = await (await worker.fetch(pedido('/inscribir', conAcomp({ acomp_correo: 'beto@gmial.com' })), baseEnv, ctx())).json();
  assert.equal(r.error, 'correo_dominio'); assert.equal(r.campo, 'acomp_correo'); assert.equal(r.sugerencia, 'beto@gmail.com');
  assert.equal(ll.apps.length, 0);
  const r2 = await (await worker.fetch(pedido('/inscribir', conAcomp({ acomp_correo: 'sin-arroba' })), baseEnv, ctx())).json();
  assert.equal(r2.error, 'datos'); assert.equal(r2.campo, 'acomp_correo');
});
