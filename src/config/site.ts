export const siteConfig = {
  name: 'ATP',
  locale: 'es',
  defaultOgImage: '/branding/logo.svg',
  goatcounterSite: 'atpfcm',
  // Canal "ATP FCM". Se usa la playlist de "Subidas" del canal para pedir
  // los últimos videos (ver src/lib/youtube.ts), no una lista de video IDs
  // a mano: YouTube genera esa playlist sola con cada video nuevo, así que
  // siempre está al día sin tocar código. Su ID es siempre el channelId con
  // el prefijo "UC" cambiado por "UU" (documentado por YouTube, no
  // específico de este canal).
  youtubeUploadsPlaylistId: 'UUflMnseCw4PbenQJLBNKKNQ',
  youtubeChannelUrl: 'https://www.youtube.com/@atpcienciasmedicas',
} as const;
