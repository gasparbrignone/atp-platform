export const siteConfig = {
  name: 'ATP',
  locale: 'es',
  defaultOgImage: '/branding/logo.svg',
  goatcounterSite: 'atpfcm',
  // Canal "ATP FCM" (youtube.com/@atpcienciasmedicas). Se usa la playlist de
  // "Subidas" del canal, no una lista de video IDs a mano: YouTube genera
  // esa playlist sola con cada video nuevo, así que el embed siempre
  // muestra lo más reciente sin tocar código. Su ID es siempre el
  // channelId con el prefijo "UC" cambiado por "UU" (documentado por
  // YouTube, no específico de este canal).
  youtubeUploadsPlaylistId: 'UUflMnseCw4PbenQJLBNKKNQ',
} as const;
