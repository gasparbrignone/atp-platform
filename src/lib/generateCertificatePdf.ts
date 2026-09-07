import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import type { CertificateField } from '@/lib/certificateFields';

/**
 * Fase 4 del sistema de certificados: dado el PDF de la plantilla (subido
 * en la Fase 3, nunca modificado — acá se genera una COPIA nueva) y la
 * posición de cada campo, escribe el valor real de cada persona.
 *
 * Fuente Helvetica estándar de pdf-lib: soporta acentos y Ñ/ñ sin
 * necesidad de embeber una fuente propia (codificación WinAnsi).
 *
 * Si un valor no entra en el ancho del campo (nombres/apellidos largos),
 * se reduce el tamaño de letra en pasos chicos hasta que entre, con un
 * piso mínimo — nunca se corta ni se superpone con otro campo.
 */

const MIN_FONT_SIZE_PT = 6;
const FONT_SIZE_STEP_PT = 1;

function fitFontSize(
  font: PDFFont,
  text: string,
  maxWidthPt: number,
  startingSize: number,
): number {
  let fontSize = startingSize;
  while (fontSize > MIN_FONT_SIZE_PT && font.widthOfTextAtSize(text, fontSize) > maxWidthPt) {
    fontSize -= FONT_SIZE_STEP_PT;
  }
  return fontSize;
}

export async function generateCertificatePdf(
  templateBytes: Uint8Array,
  fields: CertificateField[],
  // Diccionario libre (key del campo -> texto), no una forma fija: así
  // sumar un campo nuevo (p. ej. "carrera") no requiere tocar esta
  // función, solo el array de fields y quien arma este objeto.
  values: Record<string, string>,
): Promise<Uint8Array> {
  // ignoreEncryption: muchos exportadores de diseño (Canva, Adobe,
  // impresión a PDF de varios programas) marcan el PDF como "encriptado"
  // con una contraseña de dueño vacía — nunca piden clave al abrirlo en
  // un lector normal, pero pdf-lib igual rechaza cargarlo por default
  // (EncryptedPDFError). Esto no habilita leer un PDF con clave real
  // (pdf-lib no descifra contenido), solo evita este falso rechazo.
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.getPages()[0];

  for (const field of fields) {
    const text = values[field.key] ?? '';
    if (!text) continue;

    const fontSize = fitFontSize(font, text, field.widthPt, field.fontSize);
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    // pdf-lib no expone ascent/descent por separado en esta versión —
    // se derivan restando la altura con y sin el descendente (la parte de
    // la letra que baja de la línea de base, como en "g" o "j").
    const heightWithDescender = font.heightAtSize(fontSize);
    const heightWithoutDescender = font.heightAtSize(fontSize, { descender: false });
    const descent = heightWithDescender - heightWithoutDescender;

    // Centrado dentro del recuadro que dibujó el staff en la Fase 3, tanto
    // horizontal como vertical (drawText posiciona por la base del texto,
    // no por una esquina, así que hay que compensar).
    const x = field.xPt + (field.widthPt - textWidth) / 2;
    const y = field.yPt + (field.heightPt - heightWithDescender) / 2 + descent;

    // Color explícito (aunque negro ya sea el default de pdf-lib): más
    // claro de leer acá que confiar en un default implícito de la
    // librería, y a prueba de que ese default cambie el día de mañana.
    page.drawText(text, { x, y, size: fontSize, font, color: rgb(0, 0, 0) });
  }

  return pdfDoc.save();
}
