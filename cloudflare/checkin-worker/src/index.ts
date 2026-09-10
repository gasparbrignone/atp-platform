/**
 * Check-in rápido de QR para /staff/escanear/ (ver ese archivo en el repo
 * principal) — pensado para reemplazar, solo en el camino feliz, el viaje
 * directo a Apps Script (que tiene un piso de latencia de varios segundos
 * por el redirect fijo a script.googleusercontent.com, no arreglable
 * optimizando ese código). Este Worker NUNCA es la única fuente de
 * verdad: /staff/escanear/ sigue teniendo el camino de Apps Script de
 * siempre como respaldo automático si esto falla o no responde a tiempo.
 *
 * Diseño (2026-09-10): en vez de hablarle directo a Google Sheets (que
 * requeriría una cuenta de servicio de Google, fuera de alcance hoy), el
 * Durable Object mantiene en su propia memoria/storage quién ya está
 * marcado presente para una actividad+encuentro puntual — eso es lo que
 * lo hace instantáneo y, más importante, lo que evita que dos celulares
 * escaneando a la vez dejen pasar dos veces a la misma persona (un
 * Durable Object procesa sus pedidos de a uno, siempre el mismo objeto
 * para el mismo activityId+session, sin importar desde qué borde de
 * Cloudflare llegue cada pedido). El guardado real en la planilla de
 * Sheets pasa en segundo plano (ctx.waitUntil), reusando la MISMA acción
 * `checkin` del Apps Script de siempre — cero lógica de escritura nueva,
 * cero riesgo de reinventar ese camino ya probado en producción.
 */

export interface Env {
  CHECKIN_DO: DurableObjectNamespace;
  STAFF_CHECKIN_SECRET: string;
  APPS_SCRIPT_ENDPOINT: string;
  ALLOWED_ORIGIN: string;
}

interface CheckinRequestBody {
  id?: string;
  session?: string;
  activityId?: string;
  secret?: string;
}

interface CheckinResult {
  result: 'ok' | 'duplicate' | 'not_found' | 'unauthorized' | 'error';
  name?: string;
  totalForSession?: number;
}

function corsHeaders(env: Env): HeadersInit {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(body: CheckinResult, env: Env, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
  });
}

// Llama a la acción `checkin` de siempre del Apps Script para dejar el
// escaneo persistido en la planilla real — el celular ya recibió su
// respuesta rápida del Durable Object, esto corre después, sin que nadie
// lo espere. Un reintento único: una falla de red pasajera no debería
// dejar a esa persona sin registro en la planilla para siempre.
async function syncToAppsScript(
  env: Env,
  id: string,
  session: string,
  activityId: string,
): Promise<void> {
  const url = new URL(env.APPS_SCRIPT_ENDPOINT);
  url.searchParams.set('action', 'checkin');
  url.searchParams.set('id', id);
  url.searchParams.set('session', session);
  url.searchParams.set('activityId', activityId);
  url.searchParams.set('secret', env.STAFF_CHECKIN_SECRET);
  url.searchParams.set('callback', 'x');

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url.toString());
      if (response.ok) return;
    } catch {
      // reintenta abajo (si queda un intento) o se resigna en silencio
    }
  }
  // Si los dos intentos fallan: el estado "presente" sigue siendo correcto
  // en el Durable Object (autoritativo para el evento en vivo), pero la
  // fila de Sheets puede quedar atrasada para esa persona puntual hasta
  // que alguien note la discrepancia — riesgo residual aceptado a cambio
  // de no bloquear/enlentecer la respuesta al celular.
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/checkin' || request.method !== 'POST') {
      return jsonResponse({ result: 'error' }, env, 404);
    }

    let body: CheckinRequestBody;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ result: 'error' }, env, 400);
    }

    // Mismo chequeo de clave que el Apps Script (sin el mismo freno
    // gradual de fuerza bruta: el peor caso de abuso acá es idéntico al
    // de siempre — marcar gente al azar como presente — y el Apps Script
    // sigue siendo la fuente de verdad final igual, así que no vale la
    // pena la complejidad extra hoy).
    if (!body.secret || body.secret !== env.STAFF_CHECKIN_SECRET) {
      return jsonResponse({ result: 'unauthorized' }, env);
    }

    const { id, session, activityId } = body;
    if (!id || !session || !activityId) {
      return jsonResponse({ result: 'error' }, env);
    }

    // JSON.stringify (no un simple `${activityId}::${session}`) para que
    // no haya forma de que dos combinaciones distintas de
    // activityId/session, con caracteres raros de por medio, terminen
    // apuntando al mismo Durable Object.
    const doId = env.CHECKIN_DO.idFromName(JSON.stringify([activityId, session]));
    const stub = env.CHECKIN_DO.get(doId);

    const doResponse = await stub.fetch('https://do/checkin', {
      method: 'POST',
      body: JSON.stringify({ id, session, activityId }),
      headers: { 'Content-Type': 'application/json' },
    });
    const result = (await doResponse.json()) as CheckinResult;

    if (result.result === 'ok') {
      ctx.waitUntil(syncToAppsScript(env, id, session, activityId));
    }

    return jsonResponse(result, env);
  },
};

interface RosterEntryStored {
  name: string;
  sessions: string[];
}

interface RosterEntry {
  name: string;
  sessions: Set<string>;
}

export class CheckinDurableObject implements DurableObject {
  state: DurableObjectState;
  env: Env;
  roster: Map<string, RosterEntry> | null = null;
  rosterFailedAt = 0;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  // Un Durable Object es siempre para UN SOLO activityId+session (ver
  // idFromName arriba) — el roster una vez cargado nunca cambia de
  // actividad, así que alcanza con cargarlo una vez por vida del objeto
  // (persistido en su storage, sobrevive si Cloudflare lo hiberna por
  // inactividad y lo despierta de nuevo más tarde).
  async ensureRoster(activityId: string): Promise<boolean> {
    if (this.roster) return true;

    const stored = await this.state.storage.get<Record<string, RosterEntryStored>>('roster');
    if (stored) {
      this.roster = new Map(
        Object.entries(stored).map(([id, v]) => [id, { name: v.name, sessions: new Set(v.sessions) }]),
      );
      return true;
    }

    // No martillar al Apps Script si la última carga falló hace poco
    // (p. ej. clave mal configurada) — cada scan mientras tanto cae al
    // camino lento (Apps Script directo) del lado del cliente, que sigue
    // siendo correcto aunque no sea rápido.
    if (Date.now() - this.rosterFailedAt < 5000) return false;

    try {
      const url = new URL(this.env.APPS_SCRIPT_ENDPOINT);
      url.searchParams.set('action', 'checkinRoster');
      url.searchParams.set('activityId', activityId);
      url.searchParams.set('secret', this.env.STAFF_CHECKIN_SECRET);
      url.searchParams.set('callback', 'x');

      const response = await fetch(url.toString());
      const text = await response.text();
      // El Apps Script siempre responde JSONP ("x({...})") — nunca JSON
      // puro, así que hay que pelarlo antes de parsear.
      const match = text.match(/^\s*[a-zA-Z0-9_]+\((.*)\)\s*;?\s*$/s);
      if (!match) throw new Error('respuesta inesperada');
      const data = JSON.parse(match[1]) as {
        result: string;
        attendees?: { id: string; name: string; sessions: string[] }[];
      };
      if (data.result !== 'success' || !data.attendees) throw new Error('roster: ' + data.result);

      const roster = new Map<string, RosterEntry>();
      for (const attendee of data.attendees) {
        roster.set(attendee.id, { name: attendee.name, sessions: new Set(attendee.sessions) });
      }

      this.roster = roster;
      await this.persistRoster();
      return true;
    } catch {
      this.rosterFailedAt = Date.now();
      return false;
    }
  }

  async persistRoster(): Promise<void> {
    if (!this.roster) return;
    const serializable: Record<string, RosterEntryStored> = {};
    for (const [id, entry] of this.roster) {
      serializable[id] = { name: entry.name, sessions: [...entry.sessions] };
    }
    await this.state.storage.put('roster', serializable);
  }

  countForSession(session: string): number {
    let count = 0;
    for (const entry of this.roster?.values() ?? []) {
      if (entry.sessions.has(session)) count++;
    }
    return count;
  }

  async fetch(request: Request): Promise<Response> {
    const { id, session, activityId } = (await request.json()) as {
      id: string;
      session: string;
      activityId: string;
    };

    const ready = await this.ensureRoster(activityId);
    if (!ready || !this.roster) {
      return new Response(JSON.stringify({ result: 'not_found' } satisfies CheckinResult));
    }

    const targetId = id.trim();
    const entry = this.roster.get(targetId);

    if (!entry) {
      return new Response(JSON.stringify({ result: 'not_found' } satisfies CheckinResult));
    }

    if (entry.sessions.has(session)) {
      const body: CheckinResult = {
        result: 'duplicate',
        name: entry.name,
        totalForSession: this.countForSession(session),
      };
      return new Response(JSON.stringify(body));
    }

    entry.sessions.add(session);
    await this.persistRoster();

    const body: CheckinResult = {
      result: 'ok',
      name: entry.name,
      totalForSession: this.countForSession(session),
    };
    return new Response(JSON.stringify(body));
  }
}
