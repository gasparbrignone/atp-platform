/**
 * URL del Worker de Cloudflare que hace el check-in rápido por QR (ver
 * cloudflare/checkin-worker/ en la raíz del repo) — solo lo usa
 * src/pages/staff/escanear.astro, como camino RÁPIDO opcional: si no
 * contesta a tiempo o falla, ese archivo cae solo al camino de siempre
 * (Apps Script directo, más lento pero siempre disponible). Nunca es la
 * única fuente de verdad de la asistencia — el Worker persiste cada
 * escaneo en la misma planilla de Google Sheets, solo que en segundo
 * plano (ver el propio Worker).
 */
export const CHECKIN_WORKER_ENDPOINT = 'https://atp-checkin-worker.gasparbrignone1.workers.dev/checkin';
