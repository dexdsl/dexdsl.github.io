#!/usr/bin/env node
/**
 * fetch-entry-posters.mjs — self-host entry poster images.
 *
 * The click-to-load video facade uses the entry's own artwork as a first-party
 * poster. Some catalog entries reference an absolute (squarespace-cdn) image_src;
 * using that at runtime would be a third-party request. This downloads those
 * images to docs/assets/catalog/<id>.<ext> so every poster is served first-party.
 *
 * Idempotent: skips ids that already have a local /assets/catalog/<id>.* file.
 * Run: node scripts/fetch-entry-posters.mjs [--force]
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const CATALOG = path.join(ROOT, 'docs', 'assets', 'data', 'catalog.entries.json');
const OUT_DIR = path.join(ROOT, 'docs', 'assets', 'catalog');
const FORCE = process.argv.includes('--force');

const CT_EXT = new Map([
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['image/avif', '.avif'],
]);

function extFromUrl(url) {
  try {
    const p = new URL(url).pathname;
    const m = p.match(/\.([a-zA-Z0-9]+)$/);
    if (!m) return '';
    let ext = `.${m[1].toLowerCase()}`;
    if (ext === '.jpeg') ext = '.jpg';
    return ['.jpg', '.png', '.webp', '.gif', '.avif'].includes(ext) ? ext : '';
  } catch {
    return '';
  }
}

function localFor(id) {
  for (const ext of ['.jpg', '.png', '.webp', '.gif', '.avif']) {
    const f = path.join(OUT_DIR, `${id}${ext}`);
    if (fs.existsSync(f)) return f;
  }
  return null;
}

async function main() {
  const data = JSON.parse(await fsp.readFile(CATALOG, 'utf8'));
  await fsp.mkdir(OUT_DIR, { recursive: true });
  let downloaded = 0;
  let skipped = 0;
  const failures = [];

  for (const e of data.entries) {
    const id = e && e.id;
    const src = String((e && e.image_src) || '');
    if (!id || !/^https?:/i.test(src)) continue; // only remote ones need localizing
    if (!FORCE && localFor(id)) {
      skipped += 1;
      continue;
    }
    try {
      const res = await fetch(src, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ext = extFromUrl(src) || CT_EXT.get((res.headers.get('content-type') || '').split(';')[0].trim()) || '.jpg';
      const buf = Buffer.from(await res.arrayBuffer());
      const out = path.join(OUT_DIR, `${id}${ext}`);
      await fsp.writeFile(out, buf);
      downloaded += 1;
      console.log(`${id}: ${(buf.length / 1024).toFixed(0)}kB -> assets/catalog/${id}${ext}`);
    } catch (err) {
      failures.push(`${id}: ${err.message}`);
    }
  }

  console.log(`\nDownloaded ${downloaded}, skipped ${skipped} (already local), failed ${failures.length}.`);
  if (failures.length) {
    for (const f of failures) console.log(`  FAIL ${f}`);
    process.exitCode = 1;
  }
}

await main();
