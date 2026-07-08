#!/usr/bin/env node
/**
 * Runs in CI (.github/workflows/migrate-drive-books.yml) whenever a book
 * entry's `driveUrl` is set but `downloadUrl` isn't yet: downloads the file
 * from Google Drive, uploads it as a GitHub Release asset (same hosting as
 * the 61 books originally bulk-migrated — see STACK_DECISIONS.md →
 * Biblioteca), and writes the resulting URL back into the book's
 * `downloadUrl`. Never touches `driveUrl` — it stays as the audit trail of
 * where the file originally came from.
 *
 * Only ever reads/writes JSON files and shells out to `gdown` (Drive
 * download, handles the large-file virus-scan confirm token), `file`
 * (mime-type sniffing) and `gh` (release management) — no Google API
 * credentials needed, so there's nothing for ATP to provision beyond the
 * GitHub token already used for everything else here.
 */
import { readdirSync, readFileSync, writeFileSync, mkdtempSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const BOOKS_DIR = path.join(process.cwd(), 'src/content/books');
const REPO = process.env.GITHUB_REPOSITORY;

const MIME_EXTENSIONS = {
  'application/pdf': 'pdf',
  'application/epub+zip': 'epub',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/zip': 'zip',
};

function extractDriveId(url) {
  const patterns = [/\/file\/d\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function detectExtension(filePath) {
  const mimeType = execFileSync('file', ['--brief', '--mime-type', filePath]).toString().trim();
  return MIME_EXTENSIONS[mimeType] ?? 'pdf';
}

function releaseTagFor(book) {
  const primaryCareer = book.career[0] ?? 'general';
  return `biblioteca-${primaryCareer}-v1`;
}

function ensureRelease(tag) {
  try {
    execFileSync('gh', ['release', 'view', tag], { stdio: 'ignore' });
  } catch {
    execFileSync('gh', ['release', 'create', tag, '--title', tag, '--notes', 'Material de la Biblioteca de ATP.']);
  }
}

function main() {
  const files = readdirSync(BOOKS_DIR).filter((file) => file.endsWith('.json'));
  const results = { migrated: [], skipped: [], failed: [] };

  for (const file of files) {
    const fullPath = path.join(BOOKS_DIR, file);
    const book = JSON.parse(readFileSync(fullPath, 'utf8'));

    if (!book.driveUrl || book.downloadUrl) continue;

    console.log(`\n→ Migrando "${book.title}" (${file})`);
    const tmpDir = mkdtempSync(path.join(tmpdir(), 'drive-book-'));

    try {
      const driveId = extractDriveId(book.driveUrl);
      if (!driveId) throw new Error(`No se pudo extraer el ID de Drive de: ${book.driveUrl}`);

      const downloadedPath = path.join(tmpDir, 'downloaded');
      // Modern gdown dropped `--id`: the ID (or full URL) is now a plain
      // positional argument.
      execFileSync('gdown', [driveId, '--output', downloadedPath], { stdio: 'inherit' });

      const extension = detectExtension(downloadedPath);
      const assetName = `${slugify(`${book.author}-${book.title}`)}.${extension}`;
      const finalPath = path.join(tmpDir, assetName);
      renameSync(downloadedPath, finalPath);

      const tag = releaseTagFor(book);
      ensureRelease(tag);
      execFileSync('gh', ['release', 'upload', tag, finalPath, '--clobber'], { stdio: 'inherit' });

      book.downloadUrl = `https://github.com/${REPO}/releases/download/${tag}/${assetName}`;
      writeFileSync(fullPath, JSON.stringify(book, null, 2) + '\n', 'utf8');
      results.migrated.push(file);
      console.log(`✓ Migrado a ${book.downloadUrl}`);
    } catch (error) {
      results.failed.push({ file, error: error instanceof Error ? error.message : String(error) });
      console.error(`✗ Falló la migración de ${file}:`, error);
    }
  }

  const summary = [
    `## Migración de libros de Drive`,
    '',
    `- Migrados: ${results.migrated.length}`,
    `- Con error: ${results.failed.length}`,
    '',
    ...results.failed.map(({ file, error }) => `- ⚠️ **${file}**: ${error}`),
  ].join('\n');

  console.log('\n' + summary);
  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n', { flag: 'a' });
  }

  // El commit posterior es el único indicador de "hubo cambios" que le
  // importa al workflow — si nada migró (todo al día o todo falló), no hay
  // nada que commitear y el paso de git en el workflow lo detecta solo.
  if (results.failed.length > 0 && results.migrated.length === 0) {
    process.exitCode = 1;
  }
}

main();
