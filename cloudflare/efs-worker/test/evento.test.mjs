// Pruebas de la lógica del día del evento (acreditación, credencial, taller). Correr con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Evento } from '../src/evento.ts';
import worker from '../src/index.ts';

function almacen() {
  const m = new Map();
  return { m, get: async (k) => (m.has(k) ? structuredClone(m.get(k)) : undefined), put: async (k, v) => void m.set(k, structuredClone(v)) };
}
const ANA = 'EFS26-AAAAAAAA', BEA = 'EFS26-BBBBBBBB', CAR = 'EFS26-CCCCCCCC', REV = 'EFS26-DDDDDDDD';
const CR1 = 'EFSC-11111111', CR2 = 'EFSC-22222222', CR3 = 'EFSC-33333333';
let opN = 0;
const op = () => 'op-' + String(++opN).padStart(6, '0');

async function nuevo({ validas = false } = {}) {
  const a = almacen();
  const ev = new Evento(a);
  await ev.cargar();
  await ev.fusionar([
    { c: ANA, n: 'Ana Pérez', dni: '30111222', e: 'activa' },
    { c: BEA, n: 'Beatriz Gómez', dni: '31222333', e: 'activa' },
    { c: CAR, n: 'Carlos Díaz', dni: '32333444', e: 'activa' },
    { c: REV, n: 'Dora Revocada', dni: '33444555', e: 'revocada' },
  ]);
  await ev.guardarTaller({ nombre: 'Sutura', cupo: 1, color: '#1B5286' });
  await ev.guardarTaller({ nombre: 'RCP', cupo: 2, color: '#1C7A72' });
  if (validas) await ev.cargarCredenciales([CR1, CR2, CR3]);
  return { a, ev };
}

test('acreditar: ok, y un segundo escaneo (otro puesto) avisa dónde y cuándo', async () => {
  const { ev } = await nuevo();
  const r1 = await ev.acreditar(op(), ANA, 'Puesto 1');
  assert.equal(r1.r, 'ok'); assert.equal(r1.n, 'Ana Pérez');
  const r2 = await ev.acreditar(op(), ANA, 'Puesto 2');
  assert.equal(r2.r, 'ya'); assert.equal(r2.puesto, 'Puesto 1'); assert.ok(r2.hora > 0);
});

test('acreditar: repetir el mismo id devuelve lo mismo (I-8), aunque la persona ya esté acreditada', async () => {
  const { ev } = await nuevo();
  const id = op();
  const r1 = await ev.acreditar(id, ANA, 'P1');
  const r2 = await ev.acreditar(id, ANA, 'P1');
  assert.deepEqual(r2, r1); assert.equal(r2.r, 'ok');
});

test('acreditar: dos pedidos con el MISMO id a la vez (reintento con red lenta) reciben la misma respuesta', async () => {
  const { a, ev } = await nuevo();
  const put = a.put; a.put = async (k, v) => { await new Promise((r) => setTimeout(r, 5)); return put(k, v); }; // el almacén tarda
  const id = op();
  const [r1, r2] = await Promise.all([ev.acreditar(id, ANA, 'P1'), ev.acreditar(id, ANA, 'P1')]);
  assert.equal(r1.r, 'ok'); assert.deepEqual(r2, r1);
  const t = Object.fromEntries(ev.estadoTalleres().map((z) => [z.nombre, z.id]));
  const idT = op();
  const [t1, t2] = await Promise.all([ev.asignarTaller(idT, ANA, t.RCP), ev.asignarTaller(idT, ANA, t.RCP)]);
  assert.equal(t1.r, 'ok'); assert.deepEqual(t2, t1);
});

test('acreditar: revocada, desconocida y mal formada', async () => {
  const { ev } = await nuevo();
  assert.equal((await ev.acreditar(op(), REV, 'P1')).r, 'revocada');
  assert.equal((await ev.acreditar(op(), 'EFS26-ZZZZZZZZ', 'P1')).r, 'no_valido');
  assert.equal((await ev.acreditar(op(), 'hola', 'P1')).r, 'formato');
  assert.equal((await ev.acreditar('x', ANA, 'P1')).error, 'op');
  assert.equal(Object.keys(ev.acred).length, 0);
});

test('vincular: ok, credencial ya de otra persona, persona con otra credencial (I-6)', async () => {
  const { ev } = await nuevo();
  await ev.acreditar(op(), ANA, 'P1'); await ev.acreditar(op(), BEA, 'P1');
  assert.equal((await ev.vincular(op(), ANA, CR1, 'P1')).r, 'ok');
  const dup = await ev.vincular(op(), BEA, CR1, 'P1');
  assert.equal(dup.r, 'credencial_ocupada'); assert.equal(dup.de, 'Ana Pérez');
  const otra = await ev.vincular(op(), ANA, CR2, 'P1');
  assert.equal(otra.r, 'ya_tiene'); assert.equal(otra.cr, CR1);
  assert.equal((await ev.vincular(op(), ANA, CR1, 'P1')).r, 'ok'); // el mismo par es idempotente
  assert.equal(ev.credDe[BEA], undefined);
});

test('vincular: con la lista de credenciales impresas cargada, una inventada se rechaza', async () => {
  const { ev } = await nuevo({ validas: true });
  await ev.acreditar(op(), ANA, 'P1');
  assert.equal((await ev.vincular(op(), ANA, 'EFSC-99999999', 'P1')).r, 'credencial_desconocida');
  assert.equal((await ev.vincular(op(), ANA, 'basura', 'P1')).r, 'formato_credencial');
  assert.equal((await ev.vincular(op(), ANA, CR3, 'P1')).r, 'ok');
});

test('vincular sin que el paso 1 haya llegado (cola sin red): acredita igual', async () => {
  const { ev } = await nuevo();
  const r = await ev.vincular(op(), CAR, CR1, 'P3');
  assert.equal(r.r, 'ok'); assert.ok(ev.acred[CAR]);
});

test('taller: el último lugar es de uno solo (I-7) y quien llega tarde ve sin_cupo', async () => {
  const { ev } = await nuevo();
  await ev.acreditar(op(), ANA, 'P1'); await ev.acreditar(op(), BEA, 'P2');
  const [sutura] = ev.estadoTalleres().filter((t) => t.nombre === 'Sutura');
  const [r1, r2] = await Promise.all([ev.asignarTaller(op(), ANA, sutura.id), ev.asignarTaller(op(), BEA, sutura.id)]);
  assert.deepEqual([r1.r, r2.r].sort(), ['ok', 'sin_cupo']);
  assert.equal(ev.libres(sutura.id), 0);
});

test('taller: exige acreditación, taller existente, y permite cambiar liberando el lugar (T5)', async () => {
  const { ev } = await nuevo();
  const t = Object.fromEntries(ev.estadoTalleres().map((x) => [x.nombre, x.id]));
  assert.equal((await ev.asignarTaller(op(), ANA, t.Sutura)).r, 'sin_acreditar');
  await ev.acreditar(op(), ANA, 'P1'); await ev.acreditar(op(), BEA, 'P1');
  assert.equal((await ev.asignarTaller(op(), ANA, 'inexistente')).r, 'no_taller');
  assert.equal((await ev.asignarTaller(op(), ANA, t.Sutura)).r, 'ok');
  assert.equal((await ev.asignarTaller(op(), BEA, t.Sutura)).r, 'sin_cupo');
  assert.equal((await ev.asignarTaller(op(), ANA, t.RCP)).r, 'ok'); // Ana cambia a RCP
  assert.equal((await ev.asignarTaller(op(), BEA, t.Sutura)).r, 'ok'); // el lugar quedó libre
});

test('puerta: dueño y taller de una credencial', async () => {
  const { ev } = await nuevo();
  const t = Object.fromEntries(ev.estadoTalleres().map((x) => [x.nombre, x.id]));
  await ev.acreditar(op(), ANA, 'P1'); await ev.vincular(op(), ANA, CR1, 'P1'); await ev.asignarTaller(op(), ANA, t.RCP);
  const r = ev.puerta(CR1);
  assert.equal(r.r, 'ok'); assert.equal(r.n, 'Ana Pérez'); assert.equal(r.t, t.RCP); assert.equal(r.tn, 'RCP');
  assert.equal(ev.puerta(CR2).r, 'sin_dueno');
  assert.equal(ev.puerta('x').r, 'formato_credencial');
});

test('el estado sobrevive a que el objeto se reinicie (mismo almacén)', async () => {
  const { a, ev } = await nuevo({ validas: true });
  const t = Object.fromEntries(ev.estadoTalleres().map((x) => [x.nombre, x.id]));
  await ev.acreditar(op(), ANA, 'P1'); await ev.vincular(op(), ANA, CR1, 'P1'); await ev.asignarTaller(op(), ANA, t.RCP);
  const otro = new Evento(a); await otro.cargar();
  assert.equal(otro.puerta(CR1).n, 'Ana Pérez'); assert.equal(otro.puerta(CR1).tn, 'RCP');
  assert.equal(otro.libres(t.RCP), 1); assert.equal(Object.keys(otro.validas).length, 3);
  assert.equal(otro.entradas[ANA].n, 'Ana Pérez');
});

test('lote de sincronización: solo se limpia lo que no cambió mientras viajaba', async () => {
  const { ev } = await nuevo();
  const t = Object.fromEntries(ev.estadoTalleres().map((x) => [x.nombre, x.id]));
  await ev.acreditar(op(), ANA, 'P1'); await ev.acreditar(op(), BEA, 'P1');
  const { items, versiones } = ev.lote();
  assert.equal(items.length, 2);
  await ev.asignarTaller(op(), ANA, t.RCP); // Ana cambia después de armar el lote
  await ev.confirmarLote(versiones);
  assert.deepEqual(Object.keys(ev.sucio), [ANA]);
  const siguiente = ev.lote();
  assert.equal(siguiente.items[0].t, 'RCP'); assert.equal(siguiente.items[0].a > 0, true);
  await ev.confirmarLote(siguiente.versiones);
  assert.equal(Object.keys(ev.sucio).length, 0);
});

test('fusionar: recupera de la planilla lo ya acreditado y no pisa cambios pendientes', async () => {
  const a = almacen(); const ev = new Evento(a); await ev.cargar();
  await ev.guardarTaller({ nombre: 'RCP', cupo: 5, color: '#1C7A72' });
  const hora = Date.now() - 60000;
  await ev.fusionar([{ c: ANA, n: 'Ana Pérez', dni: '30111222', e: 'activa', a: hora, p: 'P9', cr: CR1, t: 'RCP' }]);
  assert.equal(ev.acred[ANA][0], hora); assert.equal(ev.credDe[ANA], CR1); assert.equal(ev.libres(Object.keys(ev.talleres)[0]), 4);
  // un cambio local todavía sin sincronizar no se pisa con la planilla vieja
  await ev.desacreditar(ANA);
  await ev.fusionar([{ c: ANA, n: 'Ana Pérez', dni: '30111222', e: 'activa', a: hora, cr: CR1, t: 'RCP' }]);
  assert.equal(ev.acred[ANA], undefined);
});

test('fusionar: una entrada revocada en la planilla pasa a rojo al instante', async () => {
  const { ev } = await nuevo();
  await ev.fusionar([{ c: ANA, n: 'Ana Pérez', dni: '30111222', e: 'revocada' }]);
  assert.equal((await ev.acreditar(op(), ANA, 'P1')).r, 'revocada');
});

test('buscar por DNI (completo o parcial) y por apellido sin importar tildes', async () => {
  const { ev } = await nuevo();
  assert.equal(ev.buscar('30.111.222').resultados[0].c, ANA);
  assert.equal(ev.buscar('2233').resultados[0].c, BEA);
  assert.equal(ev.buscar('gomez').resultados[0].c, BEA);
  assert.equal(ev.buscar('PÉREZ').resultados[0].c, ANA);
  assert.equal(ev.buscar('ab').error, 'busqueda_corta');
  assert.equal(ev.buscar('30111222').resultados[0].d3, '222'); // al celular solo le llegan 3 dígitos
});

test('lista para el celular: sin DNI completo', async () => {
  const { ev } = await nuevo();
  await ev.acreditar(op(), ANA, 'P1');
  const l = ev.lista();
  assert.equal(l.total, 3); assert.equal(l.acreditados, 1);
  assert.ok(!JSON.stringify(l).includes('30111222'));
  assert.deepEqual(l.entradas.find((x) => x[0] === ANA), [ANA, 'Ana Pérez', '222', 'activa']);
});

test('coordinación: taller con datos inválidos, borrar solo si está vacío, ids únicos', async () => {
  const { ev } = await nuevo();
  assert.equal((await ev.guardarTaller({ nombre: '', cupo: 5, color: '#112233' })).error, 'datos');
  assert.equal((await ev.guardarTaller({ nombre: 'X', cupo: 0, color: '#112233' })).error, 'datos');
  assert.equal((await ev.guardarTaller({ nombre: 'X', cupo: 5, color: 'rojo' })).error, 'datos');
  await ev.guardarTaller({ nombre: 'RCP', cupo: 3, color: '#000000' }); // mismo nombre: id distinto
  assert.equal(ev.estadoTalleres().filter((t) => t.nombre === 'RCP').length, 2);
  const t = Object.fromEntries(ev.estadoTalleres().map((x) => [x.nombre, x.id]));
  await ev.acreditar(op(), ANA, 'P1'); await ev.asignarTaller(op(), ANA, t.Sutura);
  assert.equal((await ev.borrarTaller(t.Sutura)).error, 'con_gente');
  await ev.desacreditar(ANA);
  assert.equal((await ev.borrarTaller(t.Sutura)).ok, true);
});

test('coordinación: desvincular libera la credencial; desacreditar limpia todo', async () => {
  const { ev } = await nuevo();
  await ev.acreditar(op(), ANA, 'P1'); await ev.acreditar(op(), BEA, 'P1');
  await ev.vincular(op(), ANA, CR1, 'P1');
  assert.equal((await ev.desvincular(ANA)).ok, true);
  assert.equal((await ev.vincular(op(), BEA, CR1, 'P1')).r, 'ok'); // ahora es de Bea
  assert.equal((await ev.desacreditar(BEA)).ok, true);
  assert.equal(ev.puerta(CR1).r, 'sin_dueno');
});

// ─────────── ruta /staff del Worker ───────────

function entorno() {
  const llamadas = [];
  const stub = { fetch: async (url, op) => { llamadas.push(JSON.parse(op.body)); return new Response(JSON.stringify({ ok: true, r: 'ok' })); } };
  const env = {
    APPS_SCRIPT_ENDPOINT: 'https://x/exec', ALLOWED_ORIGINS: 'https://efsarg.com.ar', TURNSTILE_HOSTNAMES: 'efsarg.com.ar',
    EFS_WORKER_SECRET: 's', TURNSTILE_SECRET: 't', EFS_STAFF_KEY: 'clave-staff-123', EFS_COORD_KEY: 'clave-coord-456',
    EVENTO: { idFromName: (n) => n, get: () => stub },
  };
  return { env, llamadas };
}
let ipN = 0;
const pedir = (env, cuerpo, ip = '20.0.0.' + ++ipN) => worker.fetch(new Request('https://w/staff', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://efsarg.com.ar', 'CF-Connecting-IP': ip }, body: JSON.stringify(cuerpo),
}), env, { waitUntil() {} }).then((r) => r.json());

test('/staff: sin clave o con clave equivocada no llega al Durable Object', async () => {
  const { env, llamadas } = entorno();
  assert.equal((await pedir(env, { op: 'lista' })).error, 'clave');
  assert.equal((await pedir(env, { op: 'lista', clave: 'mala' })).error, 'clave');
  assert.equal((await pedir(env, { op: 'inventada', clave: env.EFS_STAFF_KEY })).error, 'op');
  assert.equal(llamadas.length, 0);
});

test('/staff: con la clave del staff pasa, y el Durable Object no recibe las claves', async () => {
  const { env, llamadas } = entorno();
  const r = await pedir(env, { op: 'acreditar', clave: env.EFS_STAFF_KEY, id: 'op-000001', codigo: ANA, puesto: 'P1' });
  assert.equal(r.ok, true);
  assert.deepEqual(llamadas[0], { op: 'acreditar', id: 'op-000001', codigo: ANA, puesto: 'P1' });
});

test('/staff: las operaciones de coordinación piden la clave de coordinación, no la del staff', async () => {
  const { env, llamadas } = entorno();
  assert.equal((await pedir(env, { op: 'coord_resumen', clave: env.EFS_STAFF_KEY })).error, 'clave');
  assert.equal((await pedir(env, { op: 'coord_resumen', clave_coord: env.EFS_STAFF_KEY })).error, 'clave');
  assert.equal((await pedir(env, { op: 'coord_resumen', clave_coord: env.EFS_COORD_KEY })).ok, true);
  assert.equal(llamadas.length, 1); assert.equal(llamadas[0].clave_coord, undefined);
});

test('/staff: sin claves configuradas en el Worker todo queda cerrado', async () => {
  const { env } = entorno();
  delete env.EFS_STAFF_KEY; delete env.EFS_COORD_KEY;
  assert.equal((await pedir(env, { op: 'lista', clave: '' })).error, 'clave');
  assert.equal((await pedir(env, { op: 'coord_resumen', clave_coord: '' })).error, 'clave');
});

test('/staff: tras 15 intentos fallidos desde una IP se bloquea aunque después acierte la clave', async () => {
  const { env } = entorno();
  const ip = '99.9.9.9';
  for (let i = 0; i < 15; i++) assert.equal((await pedir(env, { op: 'lista', clave: 'x' + i }, ip)).error, 'clave');
  assert.equal((await pedir(env, { op: 'lista', clave: env.EFS_STAFF_KEY }, ip)).error, 'demasiados_intentos');
  assert.equal((await pedir(env, { op: 'lista', clave: env.EFS_STAFF_KEY }, '99.9.9.10')).ok, true); // otra IP no se ve afectada
});
