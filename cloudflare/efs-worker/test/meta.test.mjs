// Pruebas de la API de Conversiones de Meta (src/meta.ts) y de lo que el Worker
// le pasa al Apps Script al inscribirse. Correr con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import worker from '../src/index.ts';
import { armarEventos, enviarConversiones, META_API } from '../src/meta.ts';

const ENDPOINT = 'https://script.google.com/macros/s/X/exec';
const TOKEN = 'EAAprueba-token-secreto';
const env = (extra = {}) => ({
  APPS_SCRIPT_ENDPOINT: ENDPOINT, ALLOWED_ORIGINS: 'https://efsarg.com.ar', TURNSTILE_HOSTNAMES: 'efsarg.com.ar',
  EFS_WORKER_SECRET: 'secreto-worker', TURNSTILE_SECRET: 'secreto-turnstile',
  META_PIXEL_ID: '1096888216454556', META_CAPI_TOKEN: TOKEN, ...extra,
});
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const COLA = [{
  evento: 'efs26-123456789', tiempo: 1760000000, valor: 5000, em: sha('ana@ejemplo.com'), ph: sha('543415551234'),
  fbp: 'fb.1.1759400000000.1234567890', fbc: 'fb.1.1759400000000.IwAR2abc', ua: 'Mozilla/5.0 Prueba',
}];

// fetch simulado: Apps Script (cola y marcado), Meta, Turnstile y DNS.
function simular({ cola = COLA, meta = { status: 200, cuerpo: (n) => ({ events_received: n, fbtrace_id: 'x' }) } } = {}) {
  const ll = { apps: [], meta: [] };
  globalThis.fetch = async (url, op = {}) => {
    const u = String(url);
    if (u === ENDPOINT) {
      const p = Object.fromEntries(op.body); ll.apps.push(p);
      if (p.accion === 'meta_pendientes') return new Response(JSON.stringify({ ok: true, eventos: cola }));
      if (p.accion === 'meta_marcar') return new Response(JSON.stringify({ ok: true, marcados: 1 }));
      return new Response(JSON.stringify({ ok: true, pago_url: 'https://mp/checkout/1' }));
    }
    if (u.startsWith(META_API)) {
      const cuerpo = JSON.parse(op.body); ll.meta.push({ url: u, cuerpo });
      return new Response(JSON.stringify(meta.cuerpo(cuerpo.data.length)), { status: meta.status });
    }
    if (u.includes('turnstile')) return new Response(JSON.stringify({ success: true, hostname: 'efsarg.com.ar' }));
    if (u.includes('cloudflare-dns.com')) return new Response(JSON.stringify({ Status: 0, Answer: [{ data: '10 mx.' }] }));
    throw new Error('fetch inesperado ' + u);
  };
  return ll;
}

test('armarEventos: Purchase + CompleteRegistration con el mismo event_id del navegador y los datos que pide Meta', () => {
  const d = armarEventos(COLA);
  assert.deepEqual(d.map((e) => e.event_name), ['Purchase', 'CompleteRegistration']);
  for (const e of d) {
    assert.equal(e.event_id, 'efs26-123456789');
    assert.equal(e.event_time, 1760000000);
    assert.equal(e.action_source, 'website');
    assert.equal(e.event_source_url, 'https://efsarg.com.ar');
    assert.deepEqual(e.custom_data.value, 5000); assert.equal(e.custom_data.currency, 'ARS');
    assert.deepEqual(e.user_data.em, [sha('ana@ejemplo.com')]);
    assert.deepEqual(e.user_data.ph, [sha('543415551234')]);
    assert.equal(e.user_data.fbp, COLA[0].fbp); assert.equal(e.user_data.fbc, COLA[0].fbc);
    assert.equal(e.user_data.client_user_agent, 'Mozilla/5.0 Prueba');
  }
});

test('armarEventos: un correo o teléfono que no es un hash no se manda; sin navegador o id raro, se descarta', () => {
  const d = armarEventos([{ ...COLA[0], em: 'ana@ejemplo.com', ph: '3415551234' }]);
  assert.equal(d[0].user_data.em, undefined); assert.equal(d[0].user_data.ph, undefined);
  assert.equal(armarEventos([{ ...COLA[0], ua: '' }]).length, 0);
  assert.equal(armarEventos([{ ...COLA[0], evento: 'EFS26-ABCD' }]).length, 0);
});

test('enviarConversiones: sin token o sin píxel no llama a nadie', async () => {
  const ll = simular();
  assert.equal((await enviarConversiones(env({ META_CAPI_TOKEN: '' }))).error, 'sin_configurar');
  assert.equal((await enviarConversiones(env({ META_PIXEL_ID: '' }))).error, 'sin_configurar');
  assert.equal(ll.apps.length + ll.meta.length, 0);
});

test('enviarConversiones: cola vacía no llama a Meta', async () => {
  const ll = simular({ cola: [] });
  const r = await enviarConversiones(env());
  assert.equal(r.enviados, 0); assert.equal(ll.meta.length, 0);
});

test('enviarConversiones: manda el lote al píxel con el token en la URL y lo marca "ok"', async () => {
  const ll = simular();
  const r = await enviarConversiones(env());
  assert.equal(r.ok, true); assert.equal(r.enviados, 1);
  assert.equal(ll.meta.length, 1);
  assert.ok(ll.meta[0].url.startsWith(`${META_API}/1096888216454556/events?access_token=`));
  assert.equal(ll.meta[0].cuerpo.data.length, 2);
  assert.equal(ll.meta[0].cuerpo.test_event_code, undefined);
  const marca = ll.apps.find((p) => p.accion === 'meta_marcar');
  assert.equal(marca.resultado, 'ok'); assert.equal(marca.eventos, 'efs26-123456789');
  // Ningún dato en claro en lo que sale hacia Meta
  const texto = JSON.stringify(ll.meta[0].cuerpo);
  for (const dato of ['ana@', '3415551234', 'Ana']) assert.ok(!texto.includes(dato), dato);
});

test('enviarConversiones: con META_TEST_EVENT_CODE va el código de prueba', async () => {
  const ll = simular();
  const r = await enviarConversiones(env({ META_TEST_EVENT_CODE: 'TEST12345' }));
  assert.equal(ll.meta[0].cuerpo.test_event_code, 'TEST12345'); assert.equal(r.prueba, true);
});

test('enviarConversiones: si Meta rechaza, se marca "error" con el motivo y sin el token', async () => {
  const ll = simular({ meta: { status: 400, cuerpo: () => ({ error: { code: 190, message: `Invalid OAuth access token ${TOKEN}` } }) } });
  const r = await enviarConversiones(env());
  assert.equal(r.ok, false);
  const marca = ll.apps.find((p) => p.accion === 'meta_marcar');
  assert.equal(marca.resultado, 'error');
  assert.match(marca.detalle, /HTTP 400 \(190\)/);
  assert.ok(!marca.detalle.includes(TOKEN), 'el token quedó en el detalle');
});

test('enviarConversiones: si Meta recibe menos eventos de los mandados, no se da por enviado', async () => {
  const ll = simular({ meta: { status: 200, cuerpo: () => ({ events_received: 1 }) } });
  await enviarConversiones(env());
  assert.equal(ll.apps.find((p) => p.accion === 'meta_marcar').resultado, 'error');
});

test('cron: el Worker tiene scheduled y manda la cola', async () => {
  const ll = simular();
  const pend = [];
  await worker.scheduled({}, env(), { waitUntil: (p) => pend.push(p) });
  await Promise.all(pend);
  assert.equal(ll.meta.length, 1);
});

test('inscribir: pasa al Apps Script fbp, fbc y el navegador; cookies con otra forma no pasan', async () => {
  const pedido = (cuerpo) => new Request('https://efs-worker.ejemplo/inscribir', {
    method: 'POST', body: JSON.stringify(cuerpo),
    headers: { 'Content-Type': 'application/json', Origin: 'https://efsarg.com.ar', 'CF-Connecting-IP': '10.9.9.' + Math.floor(Math.random() * 200), 'User-Agent': 'Mozilla/5.0 Celular' },
  });
  const base = { turnstile: 'tok', intento_id: crypto.randomUUID(), nombre: 'Ana', apellido: 'Pérez', dni: '30123456', correo: 'ana@ejemplo.com', telefono: '3415551234', carrera: 'Medicina', anio: '3.º', universidad: 'UNR' };
  let ll = simular();
  await worker.fetch(pedido({ ...base, fbp: COLA[0].fbp, fbc: COLA[0].fbc }), env(), { waitUntil() {} });
  let p = ll.apps.find((x) => x.accion === 'iniciar');
  assert.equal(p.meta_fbp, COLA[0].fbp); assert.equal(p.meta_fbc, COLA[0].fbc); assert.equal(p.meta_ua, 'Mozilla/5.0 Celular');
  ll = simular();
  await worker.fetch(pedido({ ...base, fbp: 'fb.1.x.<script>', fbc: 12 }), env(), { waitUntil() {} });
  p = ll.apps.find((x) => x.accion === 'iniciar');
  assert.equal(p.meta_fbp, ''); assert.equal(p.meta_fbc, '');
});
