/**
 * Cloudflare Turnstile inserta un `<input type="hidden" name="cf-turnstile-response">`
 * dentro del `<div class="cf-turnstile">` una vez que resuelve el desafío
 * (casi siempre solo, sin que la persona toque nada — ver docs/GOOGLE_SHEETS_FORM_SETUP.md).
 * Los tres formularios que postean al Apps Script arman el body con
 * `new FormData(form)`, así que ese campo viaja solo con el resto — acá
 * solo se chequea que ya exista antes de dejar enviar.
 */
export function hasTurnstileToken(form: HTMLFormElement): boolean {
  const input = form.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]');
  return Boolean(input?.value);
}

/**
 * Cada token es de un solo uso — sin resetear el widget después de cada
 * intento (éxito o error, `mode: 'no-cors'` no distingue uno de otro acá),
 * un reintento manda el mismo token ya usado y el Apps Script lo rechaza
 * (`timeout-or-duplicate`) incluso si la persona hizo todo bien.
 */
export function resetTurnstile(): void {
  window.turnstile?.reset();
}

declare global {
  interface Window {
    turnstile?: { reset: (widgetId?: string) => void };
  }
}
