/**
 * Sesión de staff obtenida con Google Sign-In — solo válida para mirar
 * (actividades, inscriptos, estado de certificados), nunca para mandar
 * nada (eso sigue pidiendo la sesión admin real, ver adminStepUp.ts). Vive
 * en localStorage (no sessionStorage) a propósito: es la parte de
 * "recordame" — sobrevive a cerrar el navegador, a diferencia de
 * atp-admin-token. El login en sí (botón de Google, GIS) solo existe en
 * src/pages/staff/panel.astro; este módulo lo comparte con
 * certificados.astro, que solo necesita LEER la sesión ya obtenida ahí
 * (localStorage es compartido entre páginas del mismo origen).
 */
const STAFF_SESSION_KEY = 'atp-staff-token';

export function getStaffToken(): string | null {
  return localStorage.getItem(STAFF_SESSION_KEY);
}

export function setStaffToken(token: string): void {
  localStorage.setItem(STAFF_SESSION_KEY, token);
}

export function clearStaffToken(): void {
  localStorage.removeItem(STAFF_SESSION_KEY);
}

/** Token admin si existe, si no el de staff — para las acciones de solo lectura, que aceptan cualquiera de los dos. */
export function getAnyToken(adminToken: string | null): string | null {
  return adminToken ?? getStaffToken();
}
