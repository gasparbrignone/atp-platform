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
