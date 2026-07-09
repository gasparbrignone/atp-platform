#!/usr/bin/env node
/**
 * Runs before `astro dev`/`astro build` (see package.json). Sveltia CMS
 * uploads land in public/uploads/ at whatever resolution the person's
 * phone or drive file happened to have — book covers and activity photos
 * referencing a local upload get displayed at small sizes (40×56 for a
 * cover, up to 1200px wide for an activity photo) but without this script
 * ship the full original, sometimes several MB, to every visitor. This
 * generates a resized WebP alongside each referenced original so pages can
 * serve that instead. The naming convention (`/uploads/thumbs/<kind>-<slug>.webp`)
 * is duplicated in src/lib/uploadThumb.ts, which pages use to point at the
 * same file — keep both in sync if either changes.
 *
 * Skips remote covers (e.g. covers.openlibrary.org — already small) and
 * only regenerates when the source file is newer than its thumbnail.
 */
import { readdirSync, readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();

function uploadThumbPath(uploadPath, kind) {
  const base = path
    .basename(uploadPath, path.extname(uploadPath))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `/uploads/thumbs/${kind}-${base}.webp`;
}

const TARGETS = [
  { dir: 'src/content/books', field: 'cover', kind: 'cover', width: 120 },
  { dir: 'src/content/activities', field: 'image', kind: 'activity', width: 1600 },
];

async function processEntry(entryPath, field, kind, width) {
  const data = JSON.parse(readFileSync(entryPath, 'utf8'));
  const value = data[field];
  if (typeof value !== 'string' || !value.startsWith('/uploads/')) return;

  const sourcePath = path.join(ROOT, 'public', decodeURIComponent(value));
  if (!existsSync(sourcePath)) return;

  const outUrl = uploadThumbPath(value, kind);
  const outPath = path.join(ROOT, 'public', outUrl.slice(1));

  if (existsSync(outPath) && statSync(outPath).mtimeMs >= statSync(sourcePath).mtimeMs) return;

  mkdirSync(path.dirname(outPath), { recursive: true });
  await sharp(sourcePath).resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toFile(outPath);
  console.log(`  thumbnail: ${path.basename(sourcePath)} -> ${outUrl}`);
}

for (const { dir, field, kind, width } of TARGETS) {
  const fullDir = path.join(ROOT, dir);
  if (!existsSync(fullDir)) continue;
  const files = readdirSync(fullDir).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    await processEntry(path.join(fullDir, file), field, kind, width);
  }
}
