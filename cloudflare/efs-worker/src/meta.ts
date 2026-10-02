/**
 * API de Conversiones de Meta para el EFS.
 *
 * El Apps Script deja en "EFS · Pendientes" un evento por cada pago aprobado (venga del
 * webhook, de la vuelta al sitio o del barrido). Cada 5 minutos (cron del Worker) se pide
 * esa cola, se manda a Meta Purchase + CompleteRegistration con el mismo event_id que usa
 * el píxel del navegador (efs26-<n.º de pago>) para que Meta deduplique, y se avisa al
 * Apps Script cómo salió.
 *
 * Correo y teléfono llegan ya hasheados (SHA-256) desde el Apps Script: este Worker nunca
 * ve ni manda esos datos en claro. fbp, fbc y el navegador van sin hashear, como pide Meta.
 * El token es un secreto del Worker (wrangler secret put META_CAPI_TOKEN), nunca va al repo.
 */

import { appsScript } from './apps.ts';
import type { Env, Json } from './apps.ts';

// Versión de la Graph API de los ejemplos de la documentación de la API de Conversiones (oct. 2026).
export const META_API = 'https://graph.facebook.com/v25.0';
export const SITIO = 'https://efsarg.com.ar';

export interface EventoCola {
  evento: string; // efs26-<n.º de pago>
  tiempo: number; // segundos Unix
  valor: number;
  em?: string; // SHA-256 del correo normalizado
  ph?: string; // SHA-256 del teléfono normalizado
  fbp?: string;
  fbc?: string;
  ua: string;
}

const HASH = /^[0-9a-f]{64}$/;

// Purchase y CompleteRegistration por cada pago, con el mismo event_id que el navegador.
export function armarEventos(cola: EventoCola[]): Json[] {
  const salida: Json[] = [];
  for (const e of cola) {
    if (!/^efs26-\d+$/.test(String(e.evento)) || !e.ua) continue;
    const user_data: Json = { client_user_agent: String(e.ua) };
    if (e.em && HASH.test(e.em)) user_data.em = [e.em];
    if (e.ph && HASH.test(e.ph)) user_data.ph = [e.ph];
    if (e.fbp) user_data.fbp = String(e.fbp);
    if (e.fbc) user_data.fbc = String(e.fbc);
    const comun = { event_time: Math.floor(Number(e.tiempo)), event_id: e.evento, action_source: 'website', event_source_url: SITIO, user_data };
    const valor = { value: Number(e.valor) || 0, currency: 'ARS' };
    salida.push({ event_name: 'Purchase', ...comun, custom_data: valor });
    salida.push({ event_name: 'CompleteRegistration', ...comun, custom_data: { ...valor, content_name: 'Inscripción EFS 2026' } });
  }
  return salida;
}

// Una vuelta: pide la cola, la manda y la marca. Sin token o sin píxel no hace nada.
export async function enviarConversiones(env: Env): Promise<Json> {
  if (!env.META_CAPI_TOKEN || !env.META_PIXEL_ID) return { ok: false, error: 'sin_configurar' };
  const r = await appsScript({ accion: 'meta_pendientes' }, env, { reintentos: 0 });
  const cola = (Array.isArray(r.eventos) ? r.eventos : []) as EventoCola[];
  if (r.ok !== true || !cola.length) return { ok: r.ok === true, enviados: 0 };

  const data = armarEventos(cola);
  const cuerpo: Json = { data };
  if (env.META_TEST_EVENT_CODE) cuerpo.test_event_code = env.META_TEST_EVENT_CODE;
  let resultado = 'error';
  let detalle = '';
  try {
    if (!data.length) throw new Error('lote sin eventos válidos');
    const resp = await fetch(`${META_API}/${encodeURIComponent(env.META_PIXEL_ID)}/events?access_token=${encodeURIComponent(env.META_CAPI_TOKEN)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(15000),
    });
    const res = (await resp.json().catch(() => ({}))) as { events_received?: number; error?: { message?: string; code?: number } };
    if (resp.ok && Number(res.events_received) === data.length) resultado = 'ok';
    else detalle = `HTTP ${resp.status} ${res.error ? `(${res.error.code}) ${res.error.message}` : 'recibidos ' + res.events_received}`;
  } catch (err) {
    detalle = String(err);
  }
  // El token nunca va al detalle (se guarda en el registro de errores de la planilla).
  detalle = detalle.split(env.META_CAPI_TOKEN).join('***').slice(0, 300);
  await appsScript({ accion: 'meta_marcar', eventos: cola.map((e) => e.evento).join(','), resultado, detalle }, env, { reintentos: 2 });
  if (resultado !== 'ok') console.error('efs-worker meta', detalle);
  return { ok: resultado === 'ok', enviados: resultado === 'ok' ? cola.length : 0, prueba: Boolean(env.META_TEST_EVENT_CODE) };
}

// Cookies del píxel que manda el navegador al inscribirse. Solo pasan si tienen la forma de Meta.
export function cookieMeta(v: unknown): string {
  const s = String(v ?? '').trim();
  return /^fb\.[0-9]\.[0-9]{10,13}\.[A-Za-z0-9_-]{1,500}$/.test(s) ? s : '';
}
