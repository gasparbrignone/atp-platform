/**
 * Worker del EFS 2026: puerta pública entre efsarg.com.ar, Mercado Pago y el
 * Apps Script de la plataforma (EFS.gs). Ver docs/EFS_2026_PLAN.md §4.
 *
 * Por qué existe: una página del Apps Script no puede redirigir a Mercado
 * Pago (HtmlService no navega la ventana principal) y Apps Script no ve la IP
 * ni las cabeceras de un pedido. Acá sí: el sitio hace fetch con JSON, este
 * Worker verifica Turnstile, frena por IP, llama al Apps Script de servidor a
 * servidor con el secreto compartido y devuelve JSON legible.
 *
 * Este Worker no guarda nada. Si se cae, no se pierde ningún pago: el barrido
 * del Apps Script (cada 10 min) consulta a Mercado Pago directamente.
 *
 * Rutas:
 *   POST /inscribir   formulario del sitio → link de pago
 *   POST /verificar   vuelta desde Mercado Pago → QR en pantalla
 *   POST /mp/aviso    webhook de Mercado Pago → procesar el pago
 *   POST /admin       panel del EFS (con la sesión de admin de la plataforma)
 *   POST /staff       celulares del día del evento: acreditación, credencial, taller (Durable Object)
 *   GET  /salud       chequeo simple
 */

import { appsScript, esperar } from './apps.ts';
import type { Env, Json } from './apps.ts';

export { EventoDO } from './evento.ts';
export type { Env } from './apps.ts';

const ADMIN_ACCIONES = new Set(['admin_resumen', 'admin_buscar', 'admin_procesar', 'admin_reenviar', 'admin_conciliar']);
const CAMPOS_INSCRIPCION = ['intento_id', 'nombre', 'apellido', 'dni', 'correo', 'telefono', 'carrera', 'anio', 'universidad'];

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const origen = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, origen) });
    if (request.method === 'GET' && url.pathname === '/salud') return json({ ok: true }, env, origen);

    try {
      if (request.method === 'POST' && url.pathname === '/mp/aviso') return await aviso(request, url, env, ctx);
      if (request.method !== 'POST') return json({ ok: false, error: 'metodo' }, env, origen, 405);

      const ip = request.headers.get('CF-Connecting-IP') || 'sin-ip';
      const cuerpo = await leerJson(request);
      if (!cuerpo) return json({ ok: false, error: 'formato' }, env, origen, 400);

      switch (url.pathname) {
        case '/inscribir': return json(await inscribir(cuerpo, ip, env), env, origen);
        case '/verificar': return json(await verificar(cuerpo, ip, env), env, origen);
        case '/admin': return json(await admin(cuerpo, ip, env), env, origen);
        case '/staff': return json(await staff(cuerpo, ip, env), env, origen);
        default: return json({ ok: false, error: 'ruta' }, env, origen, 404);
      }
    } catch (err) {
      console.error('efs-worker', url.pathname, String(err));
      return json({ ok: false, error: 'interno' }, env, origen, 500);
    }
  },
};

// ─────────────────────────── rutas ───────────────────────────

async function inscribir(cuerpo: Json, ip: string, env: Env): Promise<Json> {
  if (frenado('insc:' + ip, 8, 600)) return { ok: false, error: 'demasiados_intentos' };

  const turnstile = await verificarTurnstile(String(cuerpo.turnstile || ''), ip, env);
  if (!turnstile) return { ok: false, error: 'turnstile' };

  const params: Record<string, string> = { accion: 'iniciar' };
  for (const campo of CAMPOS_INSCRIPCION) params[campo] = String(cuerpo[campo] ?? '').slice(0, 200);

  // Si el Apps Script está saturado ("ocupado", timeout o error de red), se
  // reintenta con el MISMO intento_id: del otro lado es idempotente.
  return appsScript(params, env, { reintentos: 2 });
}

async function verificar(cuerpo: Json, ip: string, env: Env): Promise<Json> {
  if (frenado('verif:' + ip, 20, 600)) return { ok: false, error: 'demasiados_intentos' };
  const pagoId = String(cuerpo.pago_id || '').replace(/\D/g, '');
  const referencia = String(cuerpo.referencia || '');
  if (!pagoId || !/^EFSP-[0-9A-Z]{10}$/.test(referencia)) return { ok: false, error: 'formato' };
  return appsScript({ accion: 'verificar', pago_id: pagoId, referencia }, env, { reintentos: 1 });
}

async function admin(cuerpo: Json, ip: string, env: Env): Promise<Json> {
  if (frenado('admin:' + ip, 60, 600)) return { ok: false, error: 'demasiados_intentos' };
  const accion = String(cuerpo.accion || '');
  if (!ADMIN_ACCIONES.has(accion)) return { ok: false, error: 'accion' };
  const params: Record<string, string> = { accion, token: String(cuerpo.token || '') };
  for (const k of ['q', 'pago_id', 'codigo']) if (cuerpo[k] != null) params[k] = String(cuerpo[k]).slice(0, 120);
  return appsScript(params, env, { reintentos: 0 });
}

// Celulares del staff el día del evento. Todo pasa por el mismo Durable Object
// (uno solo para todo el EFS), que es quien evita duplicados y respeta los cupos.
// Dos claves: la del staff (escanear) y la de coordinación (talleres, credenciales).
const OPS_STAFF = new Set(['lista', 'talleres', 'buscar', 'acreditar', 'vincular', 'taller', 'puerta']);
const OPS_COORD = new Set(['coord_resumen', 'coord_taller', 'coord_taller_borrar', 'coord_credenciales', 'coord_desvincular', 'coord_desacreditar', 'coord_despues', 'coord_sincronizar']);

async function staff(cuerpo: Json, ip: string, env: Env): Promise<Json> {
  const op = String(cuerpo.op || '');
  const coord = OPS_COORD.has(op);
  if (!coord && !OPS_STAFF.has(op)) return { ok: false, error: 'op' };

  // Con demasiados intentos fallidos desde una IP se corta ANTES de comparar la
  // clave: así no sirve adivinarla, ni siquiera acertando después.
  if (excedido('clave:' + ip, 15)) return { ok: false, error: 'demasiados_intentos' };
  const esperada = coord ? env.EFS_COORD_KEY : env.EFS_STAFF_KEY;
  const recibida = String((coord ? cuerpo.clave_coord : cuerpo.clave) || '');
  if (!esperada || !igualesSeguro(recibida, esperada)) {
    frenado('clave:' + ip, 15, 600);
    await esperar(300);
    return { ok: false, error: 'clave' };
  }
  if (frenado('staff:' + ip, 1500, 600)) return { ok: false, error: 'demasiados_intentos' };

  const { clave: _c, clave_coord: _k, ...datos } = cuerpo;
  const stub = env.EVENTO.get(env.EVENTO.idFromName('efs-2026'));
  const r = await stub.fetch('https://evento/', { method: 'POST', body: JSON.stringify(datos) });
  return (await r.json()) as Json;
}

// Webhook de Mercado Pago. Responde 200 al instante y reenvía en segundo
// plano: si el reenvío falla, el barrido del Apps Script lo encuentra igual.
async function aviso(request: Request, url: URL, env: Env, ctx: ExecutionContext): Promise<Response> {
  const cuerpo = (await leerJson(request)) || {};
  const data = (cuerpo.data as Json | undefined) || {};
  const tipo = String(url.searchParams.get('type') || url.searchParams.get('topic') || cuerpo.type || cuerpo.topic || '');
  const id = String(url.searchParams.get('data.id') || url.searchParams.get('id') || data.id || '').replace(/\D/g, '');

  if (tipo !== 'payment' && tipo !== 'merchant_order') return new Response('ignorado', { status: 200 });
  if (!id) return new Response('sin id', { status: 200 });

  if (env.MP_WEBHOOK_SECRET && tipo === 'payment') {
    const firmaOk = await firmaMercadoPagoValida(request, url.searchParams.get('data.id') || id, env.MP_WEBHOOK_SECRET);
    if (!firmaOk) return new Response('firma', { status: 401 });
  }

  ctx.waitUntil(appsScript({ accion: 'aviso', tipo, id }, env, { reintentos: 1 }).catch(() => undefined));
  return new Response('ok', { status: 200 });
}

// ─────────────────────────── seguridad ───────────────────────────

async function verificarTurnstile(token: string, ip: string, env: Env): Promise<boolean> {
  if (!token) return false;
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }),
  });
  const res = (await r.json()) as { success?: boolean; hostname?: string };
  if (res.success !== true) return false;
  const permitidos = lista(env.TURNSTILE_HOSTNAMES);
  return !permitidos.length || permitidos.includes(String(res.hostname || ''));
}

// x-signature de Mercado Pago: "ts=...,v1=..." con HMAC-SHA256 de
// "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" (sin las partes que falten).
async function firmaMercadoPagoValida(request: Request, dataId: string, secreto: string): Promise<boolean> {
  const firma = request.headers.get('x-signature') || '';
  const requestId = request.headers.get('x-request-id') || '';
  const partes = Object.fromEntries(firma.split(',').map((p) => p.trim().split('=') as [string, string]));
  if (!partes.ts || !partes.v1) return false;
  let manifiesto = '';
  if (dataId) manifiesto += `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`;
  if (requestId) manifiesto += `request-id:${requestId};`;
  manifiesto += `ts:${partes.ts};`;
  const clave = await crypto.subtle.importKey('raw', new TextEncoder().encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(manifiesto)));
  const esperado = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return igualesSeguro(esperado, partes.v1.toLowerCase());
}

function igualesSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

// Freno por IP en memoria de cada instancia del Worker. No es global (cada
// ubicación de Cloudflare cuenta aparte), pero alcanza como primera barrera
// junto con Turnstile y el control por DNI del Apps Script.
const contadores = new Map<string, { n: number; hasta: number }>();
function frenado(clave: string, max: number, segundos: number): boolean {
  const ahora = Date.now();
  const c = contadores.get(clave);
  if (!c || c.hasta < ahora) {
    if (contadores.size > 5000) contadores.clear();
    contadores.set(clave, { n: 1, hasta: ahora + segundos * 1000 });
    return false;
  }
  c.n++;
  return c.n > max;
}

// Cuenta sin sumar: ¿esta clave ya pasó el máximo dentro de su ventana?
function excedido(clave: string, max: number): boolean {
  const c = contadores.get(clave);
  return Boolean(c && c.hasta > Date.now() && c.n >= max);
}

// ─────────────────────────── utilidades ───────────────────────────

function cors(env: Env, origen: string): HeadersInit {
  const permitidos = lista(env.ALLOWED_ORIGINS);
  return {
    'Access-Control-Allow-Origin': permitidos.includes(origen) ? origen : permitidos[0] || '',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(cuerpo: Json, env: Env, origen: string, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(env, origen) },
  });
}

async function leerJson(request: Request): Promise<Json | null> {
  try {
    const texto = await request.text();
    if (!texto || texto.length > 20000) return null;
    const v = JSON.parse(texto);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null;
  } catch {
    return null;
  }
}

function lista(v: string | undefined): string[] {
  return String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
}
