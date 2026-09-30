/**
 * Llamadas del Worker al Apps Script del EFS (EFS.gs), de servidor a servidor.
 * Separado de index.ts para que lo compartan las rutas públicas y el Durable
 * Object del evento sin importarse entre sí.
 */

export interface Env {
  APPS_SCRIPT_ENDPOINT: string;
  ALLOWED_ORIGINS: string; // separados por coma
  TURNSTILE_HOSTNAMES: string; // separados por coma
  EVENTO: DurableObjectNamespace; // Durable Object del día del evento
  EFS_WORKER_SECRET: string; // secreto: wrangler secret put
  TURNSTILE_SECRET: string; // secreto: wrangler secret put
  MP_WEBHOOK_SECRET?: string; // secreto opcional: wrangler secret put
  EFS_STAFF_KEY?: string; // secreto: clave de los celulares del staff
  EFS_COORD_KEY?: string; // secreto: clave de coordinación (talleres, credenciales)
}

export type Json = Record<string, unknown>;

export async function appsScript(params: Record<string, string>, env: Env, op: { reintentos: number }): Promise<Json> {
  const cuerpo = new URLSearchParams({ ...params, formType: 'efs', efs_secreto: env.EFS_WORKER_SECRET });
  let ultimo: Json = { ok: false, error: 'servicio' };
  for (let intento = 0; intento <= op.reintentos; intento++) {
    if (intento > 0) await esperar(1000 * intento);
    try {
      // El POST ejecuta doPost; Google responde con un 302 a
      // script.googleusercontent.com y fetch lo sigue para leer el JSON.
      const r = await fetch(env.APPS_SCRIPT_ENDPOINT, {
        method: 'POST',
        body: cuerpo,
        redirect: 'follow',
        signal: AbortSignal.timeout(25000),
      });
      const texto = await r.text();
      let datos: Json;
      try {
        datos = JSON.parse(texto) as Json;
      } catch {
        ultimo = { ok: false, error: 'servicio' };
        continue;
      }
      if (datos.error === 'ocupado' || datos.error === 'interno') { ultimo = datos; continue; }
      return datos;
    } catch {
      ultimo = { ok: false, error: 'servicio' };
    }
  }
  return ultimo;
}

export function esperar(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
