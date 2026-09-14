/**
 * Confirmación de contraseña+TOTP "al paso" (step-up), usada cuando alguien
 * ya entró al panel de staff con Google (solo lectura) e intenta una acción
 * sensible (mandar una campaña o certificados) que sigue exigiendo la sesión
 * admin real — ver docs/GOOGLE_SHEETS_FORM_SETUP.md, sección "PANEL ADMIN".
 *
 * Mismo protocolo de red exacto que el formulario de login de
 * src/pages/staff/panel.astro (adminLoginAttempt POST + adminLoginPoll
 * JSONP) — extraído acá para no duplicarlo en el modal de step-up de
 * panel.astro y en el de certificados.astro. El formulario de login
 * principal de panel.astro NO usa este archivo: mantiene su propia copia
 * inline intacta, así que nada de esto puede afectarlo.
 */
import { jsonpRequest } from '@/lib/jsonp';
import { GOOGLE_FORMS_ENDPOINT } from '@/lib/googleFormsEndpoint';

const ADMIN_SESSION_KEY = 'atp-admin-token';

export function getAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_SESSION_KEY);
}

export function setAdminToken(token: string): void {
  sessionStorage.setItem(ADMIN_SESSION_KEY, token);
}

export interface AdminStepUpResult {
  success: boolean;
  token?: string;
}

export async function attemptAdminLogin(
  password: string,
  code: string,
): Promise<AdminStepUpResult> {
  const loginId = crypto.randomUUID();

  // Igual que el login principal: la contraseña y el código van solo acá,
  // en el body de un POST que no se puede leer (Apps Script no manda
  // headers CORS) — el resultado real se retira aparte con adminLoginPoll.
  await fetch(GOOGLE_FORMS_ENDPOINT, {
    method: 'POST',
    mode: 'no-cors',
    body: new URLSearchParams({ action: 'adminLoginAttempt', password, code, loginId }),
  });

  const response = await jsonpRequest<{ result: string; token?: string }>(GOOGLE_FORMS_ENDPOINT, {
    action: 'adminLoginPoll',
    loginId,
  });

  if (response.result === 'success' && response.token) {
    setAdminToken(response.token);
    return { success: true, token: response.token };
  }

  return { success: false };
}
