/**
 * Pide algo a un endpoint de Apps Script vía JSONP: un Web App de Apps
 * Script no manda headers CORS, así que un `fetch` normal no puede leer la
 * respuesta — un `<script>` (callback=nombreDeFunción) no está sujeto a
 * CORS. Usado por /staff/escanear/ y /staff/panel/, los únicos lugares del
 * sitio que necesitan leer una respuesta real del Apps Script en vez de
 * asumir éxito (ver docs/GOOGLE_SHEETS_FORM_SETUP.md).
 */
export function jsonpRequest<T = unknown>(
  endpoint: string,
  params: Record<string, string>,
  // 30s, no 15s: medido en producción durante un evento real con uso
  // simultáneo genuino, Apps Script puede tardar 17-20s (a veces más) en
  // responder — con 15s, una respuesta que igual iba a llegar bien se
  // descartaba como "sin respuesta" antes de tiempo. Esperar de más nunca
  // rompe nada (solo tarda el cartel de error en aparecer si de verdad no
  // hay conexión); cortar de menos sí puede convertir un escaneo válido
  // pero lento en un error falso.
  timeoutMs = 30000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const callbackName = `atpJsonp_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const script = document.createElement('script');

    const cleanup = () => {
      delete (window as unknown as Record<string, unknown>)[callbackName];
      script.remove();
      window.clearTimeout(timeoutId);
    };

    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('timeout'));
    }, timeoutMs);

    (window as unknown as Record<string, (response: T) => void>)[callbackName] = (response) => {
      cleanup();
      resolve(response);
    };

    const url = new URL(endpoint);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    url.searchParams.set('callback', callbackName);
    script.src = url.toString();
    script.onerror = () => {
      cleanup();
      reject(new Error('network'));
    };
    document.body.appendChild(script);
  });
}
