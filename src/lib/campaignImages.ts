/*
 * Imágenes embebidas en los mails de campaña del panel (/staff/panel/).
 *
 * El admin arrastra/pega/elige una imagen en el editor: se reduce acá, en el
 * navegador, y viaja DENTRO del mail (adjunto "inline" referenciado por
 * `cid:`), sin link ni hosting. Dos motivos por los que no se guarda en
 * ningún lado público: (1) Gmail y Outlook bloquean `data:` en el cuerpo de
 * un mail, así que no se puede pegar la imagen tal cual; (2) el Apps Script
 * guarda la campaña en CacheService entre pasos, que rechaza valores de más
 * de 100KB — por eso la imagen se achica acá antes de mandarla.
 */

export const MAX_CAMPAIGN_IMAGES = 4;

/** Tope de cada imagen YA reducida (en bytes). El servidor vuelve a validarlo. */
const MAX_IMAGE_BYTES = 250_000;
/** Anchos a probar de mayor a menor hasta que entre en el tope (1200px = pantallas retina de un mail de 600px). */
const WIDTH_STEPS = [1200, 1000, 800, 600];
const JPEG_QUALITY = 0.85;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const INLINE_DATA_URL = /src="(data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+))"/g;
const CID_SRC = /src="cid:(img\d+)"/g;

export interface CampaignImage {
  /** Identificador dentro del mail: `cid:<cid>` en el HTML. */
  cid: string;
  mime: 'image/jpeg' | 'image/png';
  /** Contenido en base64, sin el prefijo `data:...;base64,`. */
  data: string;
}

/** Error con un mensaje listo para mostrarle al admin. */
export class CampaignImageError extends Error {}

function hasTransparency(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): boolean {
  const { data } = context.getImageData(0, 0, width, height);
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 255) return true;
  }
  return false;
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new CampaignImageError('No pudimos procesar la imagen.')),
      mime,
      quality,
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new CampaignImageError('No pudimos leer la imagen.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Reduce la imagen (sin agrandarla nunca) hasta que pese lo suficiente para
 * viajar en el mail. Conserva la transparencia (PNG) cuando la tiene; el
 * resto va a JPEG, mucho más liviano para fotos y capturas. Devuelve un
 * data URL, que es lo que el editor puede mostrar bajo la CSP del sitio.
 */
export async function prepareCampaignImage(file: File): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new CampaignImageError('Solo se pueden agregar imágenes PNG, JPG o WebP.');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new CampaignImageError('No pudimos abrir esa imagen. Probá con otro archivo.');
  }

  try {
    for (const maxWidth of WIDTH_STEPS) {
      const scale = Math.min(1, maxWidth / bitmap.width);
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new CampaignImageError('No pudimos procesar la imagen.');
      context.drawImage(bitmap, 0, 0, width, height);

      const canHaveAlpha = file.type !== 'image/jpeg';
      const keepAlpha = canHaveAlpha && hasTransparency(context, width, height);
      const blob = keepAlpha
        ? await canvasToBlob(canvas, 'image/png')
        : await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY);

      if (blob.size <= MAX_IMAGE_BYTES) return blobToDataUrl(blob);
    }
  } finally {
    bitmap.close();
  }

  throw new CampaignImageError(
    'La imagen es demasiado pesada incluso reducida. Probá con una más simple o más chica.',
  );
}

/**
 * Separa las imágenes del HTML del editor: cada `src="data:..."` pasa a
 * `src="cid:imgN"` y el contenido se devuelve aparte. Una misma imagen
 * repetida en el mensaje viaja una sola vez.
 */
export function extractCampaignImages(editorHtml: string): {
  html: string;
  images: CampaignImage[];
} {
  const images: CampaignImage[] = [];
  const cidByDataUrl = new Map<string, string>();

  const html = editorHtml.replace(
    INLINE_DATA_URL,
    (_match, dataUrl: string, subtype: string, data: string) => {
      let cid = cidByDataUrl.get(dataUrl);
      if (!cid) {
        cid = `img${images.length + 1}`;
        cidByDataUrl.set(dataUrl, cid);
        images.push({ cid, mime: subtype === 'png' ? 'image/png' : 'image/jpeg', data });
      }
      return `src="cid:${cid}"`;
    },
  );

  return { html, images };
}

/** Inverso de extractCampaignImages: vuelve a poner el contenido para poder mostrarlo en la vista previa. */
export function inlineCampaignImages(html: string, images: CampaignImage[]): string {
  const imageByCid = new Map(images.map((image) => [image.cid, image]));
  return html.replace(CID_SRC, (match, cid: string) => {
    const image = imageByCid.get(cid);
    return image ? `src="data:${image.mime};base64,${image.data}"` : match;
  });
}
