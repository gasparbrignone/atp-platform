export const siteConfig = {
  name: 'ATP',
  locale: 'es',
  defaultOgImage: '/branding/logo.svg',
  goatcounterSite: 'atpfcm',
  // Microsoft Clarity (grabación de sesiones + mapas de calor — ver
  // docs/ANALYTICS_SETUP.md). Público a propósito, igual que el site code
  // de GoatCounter de arriba: solo identifica a qué proyecto de Clarity
  // van los datos, no es un secreto.
  clarityProjectId: 'ye99sgprf3',
  // Canal "ATP FCM". Se usa la playlist de "Subidas" del canal para pedir
  // los últimos videos (ver src/lib/youtube.ts), no una lista de video IDs
  // a mano: YouTube genera esa playlist sola con cada video nuevo, así que
  // siempre está al día sin tocar código. Su ID es siempre el channelId con
  // el prefijo "UC" cambiado por "UU" (documentado por YouTube, no
  // específico de este canal).
  youtubeUploadsPlaylistId: 'UUflMnseCw4PbenQJLBNKKNQ',
  youtubeChannelUrl: 'https://www.youtube.com/@atpcienciasmedicas',
  // Site Key de Cloudflare Turnstile (anti-bot en los formularios que
  // postean al Apps Script) — público a propósito, viaja en el HTML de
  // cada página con un formulario. La Secret Key correspondiente NUNCA va
  // acá: vive solo en el Apps Script (ver docs/GOOGLE_SHEETS_FORM_SETUP.md).
  turnstileSiteKey: '0x4AAAAAAElHJ7cNiPDYozuw',
  // Client ID de Google Sign-In (Google Identity Services) para el login de
  // staff del panel admin (src/pages/staff/panel.astro) — público a
  // propósito, igual que turnstileSiteKey: solo identifica la app ante
  // Google, no autoriza nada por sí solo. El Apps Script tiene el mismo
  // valor (constante GOOGLE_OAUTH_CLIENT_ID) para validar el campo `aud`
  // del token — deben coincidir exactamente. No hay Client Secret: este
  // flujo (botón "Sign In with Google") es de cliente público, sin uno.
  googleOAuthClientId: 'CAMBIAR-ESTE-CLIENT-ID.apps.googleusercontent.com',
} as const;
