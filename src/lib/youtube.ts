/**
 * Últimos videos subidos al canal de ATP, vía YouTube Data API v3
 * (`playlistItems.list` sobre la playlist de "Subidas", ver
 * siteConfig.youtubeUploadsPlaylistId). Se llama una vez por página en
 * build time (Astro static: esto corre en Node durante `astro build`, no
 * en el navegador — la API key nunca llega al cliente).
 *
 * Nunca tira si falla: sin key, sin red, cuota agotada o respuesta
 * inesperada devuelven `[]` en vez de romper el build entero — mismo
 * criterio que `optionalUrl` en content.config.ts (ver docs/YOUTUBE_SETUP.md
 * para configurar la key). El caller decide qué mostrar cuando no hay
 * videos (ver YouTubeVideoGrid.astro).
 */
import { siteConfig } from '@/config/site';

export interface YouTubeVideo {
  id: string;
  title: string;
}

export async function getLatestYouTubeVideos(maxResults = 6): Promise<YouTubeVideo[]> {
  const apiKey = import.meta.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('playlistId', siteConfig.youtubeUploadsPlaylistId);
  url.searchParams.set('maxResults', String(maxResults));
  url.searchParams.set('key', apiKey);

  try {
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    if (!Array.isArray(data.items)) return [];

    return data.items
      .filter((item: unknown) => {
        const videoId = (item as { snippet?: { resourceId?: { videoId?: string } } })?.snippet
          ?.resourceId?.videoId;
        return typeof videoId === 'string';
      })
      .map((item: { snippet: { title: string; resourceId: { videoId: string } } }) => ({
        id: item.snippet.resourceId.videoId,
        title: item.snippet.title,
      }));
  } catch {
    return [];
  }
}
