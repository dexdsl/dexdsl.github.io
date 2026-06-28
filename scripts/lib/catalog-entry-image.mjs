// Set an entry's catalog artwork (image_src) from a local image file, copying it
// into the repo's served asset roots and recording the override in the editorial
// store so it survives re-extraction. Used by the ops app entry detail sheet.
import path from 'node:path';
import { promises as fs } from 'node:fs';
import {
  readCatalogEditorialFile,
  writeCatalogEditorialFile,
  upsertCatalogManifestEntry,
  findCatalogManifestEntry,
  defaultCatalogEditorialData,
} from './catalog-editorial-store.mjs';

const SERVED_ROOTS = ['', 'public', 'docs'];
const ASSET_REL = path.join('assets', 'catalog');
const ALLOWED_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif']);

function slugFromToken(token) {
  return String(token || '')
    .toLowerCase()
    .replace(/^\/entry\//, '')
    .replace(/\/+$/, '')
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function setEntryImage({ siteRoot, token, sourcePath } = {}) {
  const root = String(siteRoot || '').trim();
  if (!root) throw new Error('siteRoot is required');
  const slug = slugFromToken(token);
  if (!slug) throw new Error('entry token is required');
  const src = String(sourcePath || '').trim();
  if (!src) throw new Error('source image path is required');

  let ext = path.extname(src).toLowerCase().replace(/^\./, '').replace(/[^a-z0-9]/g, '');
  if (ext === 'jpeg') ext = 'jpg';
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error(`Unsupported image type: .${ext || '?'} (use png/jpg/webp/gif/avif)`);
  }

  const buf = await fs.readFile(src);
  const fileName = `${slug}.${ext}`;
  const webPath = `/assets/catalog/${fileName}`;

  // Write to every served root; drop any prior extension variants for this slug.
  for (const servedRoot of SERVED_ROOTS) {
    const destDir = path.join(root, servedRoot, ASSET_REL);
    await fs.mkdir(destDir, { recursive: true });
    for (const prior of ALLOWED_EXT) {
      if (prior === ext) continue;
      await fs.rm(path.join(destDir, `${slug}.${prior}`), { force: true }).catch(() => {});
    }
    await fs.writeFile(path.join(destDir, fileName), buf);
  }

  // Record the override in the editorial store (canonical, survives re-extract).
  const editorialPath = path.join(root, 'data', 'catalog.editorial.json');
  let data;
  try {
    ({ data } = await readCatalogEditorialFile(editorialPath));
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
    data = defaultCatalogEditorialData();
  }
  const existing = findCatalogManifestEntry(data, slug) || {};
  const updated = upsertCatalogManifestEntry(data, {
    ...existing,
    entry_id: existing.entry_id || slug,
    entry_href: existing.entry_href || `/entry/${slug}/`,
    image_src: webPath,
  });
  await writeCatalogEditorialFile(updated, editorialPath);

  return { ok: true, slug, image_src: webPath, fileName, bytes: buf.length };
}

// Current image_src for an entry (editorial override first, then carousel data),
// so the ops UI can pre-populate the field without overwriting.
export async function getEntryImage({ siteRoot, token } = {}) {
  const root = String(siteRoot || '').trim();
  const slug = slugFromToken(token);
  if (!root || !slug) return { image_src: '' };
  try {
    const { data } = await readCatalogEditorialFile(path.join(root, 'data', 'catalog.editorial.json'));
    const row = findCatalogManifestEntry(data, slug);
    if (row && String(row.image_src || '').trim()) return { image_src: String(row.image_src).trim() };
  } catch {
    /* fall through to entries data */
  }
  try {
    const entries = JSON.parse(await fs.readFile(path.join(root, 'data', 'catalog.entries.json'), 'utf8'));
    const hit = (entries.entries || []).find((e) => (e.slug || e.id) === slug);
    if (hit) return { image_src: String(hit.image_src || '').trim() };
  } catch {
    /* ignore */
  }
  return { image_src: '' };
}
