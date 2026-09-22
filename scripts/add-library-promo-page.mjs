#!/usr/bin/env node
/**
 * Inserta una página promocional de ATP (logo + link a atpfcm.com.ar +
 * redes + QR a la Biblioteca) como página 2 de cada PDF de la colección
 * `books` (después de la portada real del libro, página 1) — pedido
 * explícito del dueño del proyecto, 2026-09-22.
 *
 * Modos:
 *   --preview            Genera solo un PDF de 1 página (tamaño Carta) con
 *                         el diseño de la página promocional, para revisar
 *                         antes de tocar ningún libro real. No descarga ni
 *                         sube nada.
 *   --test-one=<slug>     Descarga UN libro real de R2 (por su id/slug de
 *                         src/content/books/<slug>.json), le inserta la
 *                         página, y guarda el resultado LOCAL (no sube a
 *                         R2) — para poder abrir el PDF completo y
 *                         confirmar que no se rompió nada antes de correr
 *                         el batch real.
 *   (sin flags)            Sin implementar todavía a propósito: el batch
 *                         real sobre los 69 libros (descarga + inserta +
 *                         sube a R2) se agrega recién después de aprobar
 *                         el diseño y verificar --test-one, con
 *                         R2_SECRET_ACCESS_KEY provisto por variable de
 *                         entorno (nunca hardcodeado acá, ver
 *                         docs/SECURITY_DECISIONS.md).
 *
 * GATILLO DE ACTUALIZACIÓN: si el diseño de esta página cambia (logo,
 * copy, redes), actualizar drawPromoPage() acá — es la única fuente de
 * verdad, no hay otra copia del diseño en ningún lado.
 */
import { PDFDocument, StandardFonts, rgb, LineCapStyle } from 'pdf-lib';
import QRCode from 'qrcode';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const BRAND = {
  blue: rgb(0x2e / 255, 0x56 / 255, 0x99 / 255),
  pink: rgb(0xc6 / 255, 0x29 / 255, 0x9e / 255),
  gray: rgb(0x5e / 255, 0x57 / 255, 0x70 / 255),
  white: rgb(1, 1, 1),
};

const SITE_URL = 'atpfcm.com.ar';
const BIBLIOTECA_URL = 'https://atpfcm.com.ar/biblioteca/';
const INSTAGRAM = '@atp.fcm';
const MAIL = 'contacto@atpfcm.com.ar';

// Vectores reales (viewBox 24x24, mismo sistema de coordenadas que SVG),
// no letras/monogramas: Instagram es el path de marca ya usado en
// src/components/icons/InstagramMark.astro (relleno); Web y Mail son los
// íconos "globe"/"mail" de Lucide (trazo — mismo `stroke-width: 2` que
// Lucide usa siempre, ver drawIconBadge). pdf-lib no tiene íconos propios,
// así que se reusan vectores reales en vez de inventar formas nuevas.
const ICONS = {
  web: {
    mode: 'stroke',
    paths: [
      'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0',
      'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20',
      'M2 12h20',
    ],
  },
  instagram: {
    mode: 'fill',
    paths: [
      'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z',
    ],
  },
  mail: {
    mode: 'stroke',
    paths: ['M2 4h20v16h-20z', 'm22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7'],
  },
};

// Dibuja un badge circular de color con un ícono vectorial real adentro
// (nunca una letra/monograma). `x`/`yCenter` son el centro del círculo.
function drawIconBadge(page, icon, x, yCenter, radius, bg) {
  page.drawEllipse({ x, y: yCenter, xScale: radius, yScale: radius, color: bg });
  const iconSize = radius * 1.3; // el ícono ocupa ~65% del diámetro del badge
  const scale = iconSize / 24;
  const originX = x - iconSize / 2;
  const originY = yCenter + iconSize / 2; // ver comentario en drawSvgPath: pdf-lib
  // ya invierte el eje Y del path SVG solo, así que (originX, originY) es
  // directamente la esquina superior-izquierda del ícono en espacio de página.
  for (const d of icon.paths) {
    if (icon.mode === 'fill') {
      page.drawSvgPath(d, { x: originX, y: originY, scale, color: BRAND.white });
    } else {
      page.drawSvgPath(d, {
        x: originX,
        y: originY,
        scale,
        borderColor: BRAND.white,
        borderWidth: 2, // mismo stroke-width que usa Lucide siempre — el `scale` de arriba ya lo proporciona bien
        borderLineCap: LineCapStyle.Round,
      });
    }
  }
}

// Rasteriza el logo a PNG en memoria (no depende de que exista un PNG ya
// generado en el repo) — 'white' para la franja de color de la cabecera,
// no hace falta la versión azul en este diseño.
async function getLogoPngBytes(variant = 'white') {
  const file = variant === 'white' ? 'logo-white.svg' : 'logo.svg';
  return sharp(path.join(ROOT, 'public/branding', file))
    .resize({ width: 900 })
    .png()
    .toBuffer();
}

function centerText(page, text, font, size, y, color) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (page.getWidth() - width) / 2, y, size, font, color });
}

// pdf-lib no hace wrap automático de texto — mide y corta a mano.
function drawWrappedCentered(page, text, font, size, startY, lineHeight, maxWidth, color) {
  const words = text.split(' ');
  let line = '';
  let y = startY;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(testLine, size) > maxWidth && line) {
      centerText(page, line, font, size, y, color);
      line = word;
      y -= lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) centerText(page, line, font, size, y, color);
  return y - lineHeight;
}

/**
 * Dibuja el diseño promocional sobre una página YA CREADA (usa
 * page.getSize() real, así se adapta al tamaño de cada libro en vez de
 * asumir un tamaño fijo tipo Carta/A4).
 *
 * `scale` es clave: no alcanza con basar los tamaños solo en el ancho (W)
 * — algunos libros propios de ATP (mini-resúmenes) tienen portadas
 * "panorámicas" (anchas y bajas, tipo 16:9), y ahí los espacios verticales
 * fijos se salían de la página y pisaban el QR. `scale` toma la dimensión
 * más chica en relación a una página Carta de referencia, así TODO
 * (gaps, tamaños de fuente, franja, QR) se achica junto si la página es
 * baja, ancha, o las dos cosas — bug real encontrado probando con
 * miniresumen-atp-sistema-inmune.json (portada panorámica).
 */
export async function drawPromoPage(pdfDoc, page, logoPngBytes) {
  const { width: W, height: H } = page.getSize();
  const scale = Math.min(1.15, Math.max(0.45, Math.min(W / 612, H / 792)));

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: BRAND.white });
  const pageMargin = Math.max(8, 12 * scale); // solo para no pegar nada al borde, sin dibujar marco

  // Franja superior sólida (rosa) — la pieza más "llamativa" del diseño:
  // antes todo era texto sobre blanco.
  const bandH = Math.min(H * 0.3, H - H * 0.35);
  page.drawRectangle({ x: 0, y: H - bandH, width: W, height: bandH, color: BRAND.pink });

  const logoImage = await pdfDoc.embedPng(logoPngBytes);
  const logoW = Math.min(W * 0.36, 210 * scale);
  const logoH = logoImage.height * (logoW / logoImage.width);
  const logoY = H - bandH / 2 - logoH / 2;
  page.drawImage(logoImage, { x: (W - logoW) / 2, y: logoY, width: logoW, height: logoH });

  let cursorY = H - bandH - 46 * scale;

  const titleSize = Math.max(12, Math.min(26, W / 24, 24 * scale));
  cursorY = drawWrappedCentered(
    page,
    'Este libro y muchos más los podés encontrar gratis en',
    fontBold,
    titleSize,
    cursorY,
    titleSize * 1.3,
    W * 0.78,
    BRAND.blue,
  );
  centerText(page, SITE_URL, fontBold, titleSize * 1.2, cursorY - 6 * scale, BRAND.pink);
  cursorY -= titleSize * 1.2 + 24 * scale;

  const subSize = Math.max(7, Math.min(12.5, W / 48, 11.5 * scale));
  cursorY = drawWrappedCentered(
    page,
    'Apuntes, resúmenes y bibliografía de Medicina, Enfermería, Fonoaudiología y Terapia ' +
      'Ocupacional (UNR), reunidos en un solo lugar por ATP, hecho por estudiantes, para estudiantes.',
    fontRegular,
    subSize,
    cursorY,
    subSize * 1.5,
    W * 0.68,
    BRAND.gray,
  );
  cursorY -= 30 * scale;

  // Contacto: badge circular con ícono vectorial real + texto, un renglón
  // por dato (en vez de "Label: valor" plano) — se ve más como una
  // tarjeta de presentación que como una lista.
  const badgeRadius = Math.max(8, 11 * scale);
  const contactSize = Math.max(7.5, Math.min(13, W / 42, 12.5 * scale));
  const rowGap = badgeRadius * 2 + 20 * scale;
  const rows = [
    { icon: ICONS.web, value: SITE_URL, badge: BRAND.pink },
    { icon: ICONS.instagram, value: INSTAGRAM, badge: BRAND.blue },
    { icon: ICONS.mail, value: MAIL, badge: BRAND.pink },
  ];
  for (const row of rows) {
    const valueW = fontBold.widthOfTextAtSize(row.value, contactSize);
    const totalW = badgeRadius * 2 + 10 * scale + valueW;
    const startX = (W - totalW) / 2;
    drawIconBadge(page, row.icon, startX + badgeRadius, cursorY, badgeRadius, row.badge);
    page.drawText(row.value, {
      x: startX + badgeRadius * 2 + 10 * scale,
      y: cursorY - contactSize * 0.36,
      size: contactSize,
      font: fontBold,
      color: BRAND.gray,
    });
    cursorY -= rowGap;
  }

  cursorY -= 20 * scale;

  // QR solo, sin marco ni fondo de color (pedido explícito) — apoyado
  // directo sobre el blanco de la página.
  const qrDataUrl = await QRCode.toDataURL(BIBLIOTECA_URL, { width: 300, margin: 1 });
  const qrPngBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64');
  const qrImage = await pdfDoc.embedPng(qrPngBytes);
  const qrCaption = 'Escaneá para ver toda la Biblioteca';
  const qrCaptionSize = Math.max(6.5, 9.5 * scale);
  const qrSize = Math.max(38, Math.min(W * 0.17, 96 * scale));
  // Igual que antes: relativo a lo último dibujado (cursorY), nunca a un
  // % fijo de H, para no superponerse en páginas bajas ni quedar pegado
  // al fondo en páginas altas.
  const qrY = Math.max(pageMargin + qrCaptionSize + 6 * scale, cursorY - qrSize);
  page.drawImage(qrImage, { x: (W - qrSize) / 2, y: qrY, width: qrSize, height: qrSize });
  centerText(page, qrCaption, fontRegular, qrCaptionSize, qrY - qrCaptionSize - 6 * scale, BRAND.gray);
}

async function runPreview() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Carta — tamaño de referencia para la preview
  const logoPngBytes = await getLogoPngBytes();
  await drawPromoPage(pdfDoc, page, logoPngBytes);
  const bytes = await pdfDoc.save();
  const outPath = path.join(ROOT, '.tmp-promo-preview.pdf');
  await fs.writeFile(outPath, bytes);
  console.log('OK:', outPath);
}

async function runTestOne(slug) {
  const contentPath = path.join(ROOT, 'src/content/books', `${slug}.json`);
  const raw = JSON.parse(await fs.readFile(contentPath, 'utf-8'));
  if (!raw.downloadUrl) throw new Error(`${slug} no tiene downloadUrl`);

  console.log('Descargando', raw.downloadUrl, '...');
  const res = await fetch(raw.downloadUrl);
  if (!res.ok) throw new Error(`Descarga falló: ${res.status}`);
  const originalBytes = Buffer.from(await res.arrayBuffer());
  console.log('Descargado:', (originalBytes.length / 1024 / 1024).toFixed(1), 'MB');

  const pdfDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
  const totalPagesBefore = pdfDoc.getPageCount();
  const firstPage = pdfDoc.getPage(0);
  const { width, height } = firstPage.getSize();

  const logoPngBytes = await getLogoPngBytes();
  const promoPage = pdfDoc.insertPage(1, [width, height]); // después de la portada (índice 0)
  await drawPromoPage(pdfDoc, promoPage, logoPngBytes);

  const totalPagesAfter = pdfDoc.getPageCount();
  if (totalPagesAfter !== totalPagesBefore + 1) {
    throw new Error(`Conteo de páginas inesperado: antes ${totalPagesBefore}, después ${totalPagesAfter}`);
  }

  const outBytes = await pdfDoc.save();
  const outPath = path.join(ROOT, `.tmp-test-${slug}.pdf`);
  await fs.writeFile(outPath, outBytes);
  console.log('OK:', outPath);
  console.log(`Páginas: ${totalPagesBefore} -> ${totalPagesAfter}`);
  console.log('Tamaño original:', (originalBytes.length / 1024 / 1024).toFixed(2), 'MB');
  console.log('Tamaño con página nueva:', (outBytes.length / 1024 / 1024).toFixed(2), 'MB');
}

// Bug real encontrado corriendo --all sobre los 69: después de que UN
// fetch se cuelga ("terminated"), TODOS los siguientes fallan con "fetch
// failed" — mismo patrón que la migración a R2 original (conexión
// keep-alive reusada y corrupta). Acá el fix es más simple que armar un
// cliente nuevo: pedir 'Connection: close' (no reusar el socket) +
// reintentar con espera creciente.
async function fetchWithRetry(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, { headers: { Connection: 'close' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastError = err;
      if (attempt < attempts) await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
  throw lastError;
}

async function listBookFiles() {
  const dir = path.join(ROOT, 'src/content/books');
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
  return files.map((f) => ({ slug: f.replace(/\.json$/, ''), contentPath: path.join(dir, f) }));
}

function localOriginalPath(slug) {
  return path.join(ROOT, `.tmp-original-${slug}.pdf`);
}
function localProcessedPath(slug) {
  return path.join(ROOT, `.tmp-processed-${slug}.pdf`);
}

/**
 * Descarga (con reintentos), inserta la página, y guarda original +
 * procesado en disco local para UN libro — nunca toca R2 ni el JSON.
 * Compartida entre --all y --retry-failed para no duplicar la lógica.
 */
async function processOneBook(slug, contentPath, logoPngBytes) {
  const raw = JSON.parse(await fs.readFile(contentPath, 'utf-8'));
  if (!raw.downloadUrl) return { slug, status: 'skipped' };

  const originalBytes = await fetchWithRetry(raw.downloadUrl);

  const pdfDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
  const pagesBefore = pdfDoc.getPageCount();
  const { width, height } = pdfDoc.getPage(0).getSize();
  const promoPage = pdfDoc.insertPage(1, [width, height]);
  await drawPromoPage(pdfDoc, promoPage, logoPngBytes);
  const pagesAfter = pdfDoc.getPageCount();
  if (pagesAfter !== pagesBefore + 1) {
    throw new Error(`conteo de páginas raro: ${pagesBefore} -> ${pagesAfter}`);
  }

  const processedBytes = await pdfDoc.save();
  await fs.writeFile(localOriginalPath(slug), originalBytes);
  await fs.writeFile(localProcessedPath(slug), processedBytes);

  const mbBefore = (originalBytes.length / 1024 / 1024).toFixed(1);
  const mbAfter = (processedBytes.length / 1024 / 1024).toFixed(1);
  console.log(`  OK (${mbBefore}MB -> ${mbAfter}MB, ${pagesBefore} -> ${pagesAfter} páginas)`);
  return {
    slug,
    status: 'ok',
    originalSize: originalBytes.length,
    newSize: processedBytes.length,
    filename: decodeURIComponent(raw.downloadUrl.split('/').pop()),
  };
}

function printSummary(results) {
  const ok = results.filter((r) => r.status === 'ok');
  const errors = results.filter((r) => r.status === 'error');
  const skipped = results.filter((r) => r.status === 'skipped');
  console.log(`\n=== RESUMEN ===`);
  console.log(`OK: ${ok.length} | Errores: ${errors.length} | Salteados: ${skipped.length}`);
  if (errors.length > 0) {
    console.log('\nLibros con error (no se tocaron):');
    errors.forEach((r) => console.log(`  - ${r.slug}: ${r.error}`));
  }
}

/**
 * Paso 1 del batch real: para cada uno de los 69 libros, descarga el
 * original de R2, le inserta la página promocional, y guarda los DOS
 * (original + procesado) en disco local — nunca toca R2 ni ningún JSON
 * todavía. Sigue de largo si un libro individual falla (no aborta el
 * batch entero por un solo archivo raro) y al final imprime un resumen
 * con éxitos/fallos para revisar antes de subir nada.
 */
async function runAll() {
  const books = await listBookFiles();
  const logoPngBytes = await getLogoPngBytes();
  const results = [];

  for (let i = 0; i < books.length; i++) {
    const { slug, contentPath } = books[i];
    console.log(`[${i + 1}/${books.length}] ${slug}`);
    try {
      results.push(await processOneBook(slug, contentPath, logoPngBytes));
    } catch (err) {
      console.log(`  ERROR - ${err.message}`);
      results.push({ slug, status: 'error', error: err.message });
    }
    // Pausa chica entre libros — menos presión sobre la conexión que la
    // que causó el problema de "fetch failed" en cadena.
    await new Promise((r) => setTimeout(r, 400));
  }

  printSummary(results);
  await fs.writeFile(path.join(ROOT, '.tmp-batch-results.json'), JSON.stringify(results, null, 2));
  console.log('\nResultados guardados en .tmp-batch-results.json (los lee --upload).');
}

/**
 * Reintenta SOLO los libros que quedaron en 'error' en
 * .tmp-batch-results.json (no vuelve a descargar los que ya salieron
 * bien) — actualiza ese mismo archivo con los resultados nuevos.
 */
async function runRetryFailed() {
  const resultsPath = path.join(ROOT, '.tmp-batch-results.json');
  const previous = JSON.parse(await fs.readFile(resultsPath, 'utf-8'));
  const failedSlugs = previous.filter((r) => r.status === 'error').map((r) => r.slug);

  if (failedSlugs.length === 0) {
    console.log('No hay libros en error en .tmp-batch-results.json — nada para reintentar.');
    return;
  }

  console.log(`Reintentando ${failedSlugs.length} libros que habían fallado...\n`);
  const logoPngBytes = await getLogoPngBytes();
  const updated = new Map(previous.map((r) => [r.slug, r]));

  for (let i = 0; i < failedSlugs.length; i++) {
    const slug = failedSlugs[i];
    const contentPath = path.join(ROOT, 'src/content/books', `${slug}.json`);
    console.log(`[${i + 1}/${failedSlugs.length}] ${slug}`);
    try {
      updated.set(slug, await processOneBook(slug, contentPath, logoPngBytes));
    } catch (err) {
      console.log(`  ERROR - ${err.message}`);
      updated.set(slug, { slug, status: 'error', error: err.message });
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  const results = Array.from(updated.values());
  printSummary(results);
  await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
  console.log('\n.tmp-batch-results.json actualizado.');
}

/**
 * Paso 2, separado a propósito: lee .tmp-batch-results.json (lo que dejó
 * --all) y para cada libro OK sube el PDF procesado a R2 con la MISMA key
 * que ya tenía (mismo nombre de archivo => mismo downloadUrl de siempre,
 * nadie con un link viejo se queda sin nada) y actualiza fileSize en el
 * JSON del libro. Requiere las credenciales reales de R2 por variable de
 * entorno — nunca hardcodeadas acá (ver docs/SECURITY_DECISIONS.md).
 */
async function runUpload() {
  const ACCOUNT_ID = process.env.ATP_R2_ACCOUNT_ID;
  const ACCESS_KEY_ID = process.env.ATP_R2_ACCESS_KEY;
  const SECRET_ACCESS_KEY = process.env.ATP_R2_SECRET;
  if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    throw new Error(
      'Faltan variables de entorno ATP_R2_ACCOUNT_ID / ATP_R2_ACCESS_KEY / ATP_R2_SECRET',
    );
  }

  const { S3Client } = await import('@aws-sdk/client-s3');
  const { NodeHttpHandler } = await import('@smithy/node-http-handler');
  const { Upload } = await import('@aws-sdk/lib-storage');
  const https = await import('node:https');

  const BUCKET = 'atp-biblioteca';
  function freshClient() {
    return new S3Client({
      region: 'auto',
      endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
      requestHandler: new NodeHttpHandler({ httpsAgent: new https.Agent({ keepAlive: false }) }),
    });
  }

  const resultsPath = path.join(ROOT, '.tmp-batch-results.json');
  const results = JSON.parse(await fs.readFile(resultsPath, 'utf-8'));
  const toUpload = results.filter((r) => r.status === 'ok');

  let done = 0;
  let failed = 0;
  let skipped = 0;
  for (let i = 0; i < toUpload.length; i++) {
    const r = toUpload[i];
    const prefix = `[${i + 1}/${toUpload.length}] ${r.slug}`;
    const contentPath = path.join(ROOT, 'src/content/books', `${r.slug}.json`);

    const fileBuffer = await fs.readFile(localProcessedPath(r.slug));

    // Resumable: si una corrida anterior ya subió este libro y actualizó su
    // fileSize al tamaño del PDF procesado, no lo vuelve a subir — clave
    // porque la conexión viene fallando bastante (wifi inestable) y cada
    // corte obliga a repetir --upload desde cero si no se salta lo ya hecho.
    const rawBefore = JSON.parse(await fs.readFile(contentPath, 'utf-8'));
    if (rawBefore.fileSize === fileBuffer.length) {
      console.log(`${prefix}: ya estaba subido, salteado`);
      skipped++;
      continue;
    }

    const MAX_ATTEMPTS = 6;
    let lastError;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const upload = new Upload({
          client: freshClient(),
          params: {
            Bucket: BUCKET,
            Key: r.filename,
            Body: fileBuffer,
            ContentType: 'application/pdf',
          },
          partSize: 10 * 1024 * 1024,
        });
        await upload.done();

        const raw = JSON.parse(await fs.readFile(contentPath, 'utf-8'));
        raw.fileSize = fileBuffer.length;
        await fs.writeFile(contentPath, JSON.stringify(raw, null, 2) + '\n');

        console.log(`${prefix}: OK`);
        done++;
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        console.log(`${prefix}: intento ${attempt}/${MAX_ATTEMPTS} falló - ${err.message}`);
        if (attempt < MAX_ATTEMPTS) await new Promise((r2) => setTimeout(r2, attempt * 3000));
      }
    }
    if (lastError) {
      failed++;
      console.log(`${prefix}: ERROR DEFINITIVO - ${lastError.message}`);
    }
  }

  console.log(`\nSalteados (ya subidos antes): ${skipped}`);
  console.log(`=== RESUMEN SUBIDA ===`);
  console.log(`OK: ${done} | Errores: ${failed}`);
}

const args = process.argv.slice(2);
if (args.includes('--preview')) {
  await runPreview();
} else if (args.includes('--all')) {
  await runAll();
} else if (args.includes('--retry-failed')) {
  await runRetryFailed();
} else if (args.includes('--upload')) {
  await runUpload();
} else {
  const testOneArg = args.find((a) => a.startsWith('--test-one='));
  if (testOneArg) {
    await runTestOne(testOneArg.split('=')[1]);
  } else {
    console.log('Uso:');
    console.log('  node scripts/add-library-promo-page.mjs --preview');
    console.log('  node scripts/add-library-promo-page.mjs --test-one=<slug-del-libro>');
    console.log('  node scripts/add-library-promo-page.mjs --all           (procesa los 69, LOCAL, no sube nada)');
    console.log('  node scripts/add-library-promo-page.mjs --retry-failed  (reintenta solo los que quedaron en error)');
    console.log('  node scripts/add-library-promo-page.mjs --upload        (sube a R2 lo que dejó --all/--retry-failed)');
  }
}
