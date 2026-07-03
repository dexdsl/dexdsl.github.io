// Static asset inventory + reference scanning for the ops app's Assets tab.
//
// The repo serves static files from three mirrored roots — repo root (''),
// `docs/` — under the URL prefixes /assets, /css, /static. This
// module enumerates those files (with mirror presence + reference counts) and
// resolves which repo files reference a given web path, so the desktop app can
// safely browse, swap, and delete assets.
//
// The URL-extraction logic mirrors scripts/where_are_assets.mjs (the diag CLI);
// it is factored here so the bridge and the CLI share one source of truth.

import fs from 'node:fs';
import path from 'node:path';

// Served roots, relative to the site root. '' is the repo root (canonical).
export const SERVED_ROOTS = ['', 'docs'];
// URL prefixes that map 1:1 to a served root's filesystem path.
export const STATIC_PREFIXES = ['/css/', '/assets/', '/static/'];
// Directories (under each served root) that hold tracked static files.
const STATIC_DIRS = ['assets', 'css', 'static'];
// File types whose contents can reference an asset.
const TEXT_REF_EXTENSIONS = new Set(['.html', '.css', '.js', '.mjs', '.cjs']);
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'tmp', 'test-results']);

function toPosix(value) {
  return String(value).split(path.sep).join('/');
}

export function kindForExtension(ext) {
  const e = String(ext || '').toLowerCase().replace(/^\./, '');
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'ico'].includes(e)) return 'image';
  if (e === 'svg') return 'svg';
  if (['woff', 'woff2', 'otf', 'ttf', 'eot'].includes(e)) return 'font';
  if (['mp4', 'mov', 'webm', 'm3u8', 'mp3', 'wav', 'aac', 'ogg'].includes(e)) return 'media';
  if (['js', 'mjs', 'cjs'].includes(e)) return 'js';
  if (e === 'css') return 'css';
  if (e === 'pdf') return 'pdf';
  if (['json', 'txt', 'md', 'xml'].includes(e)) return 'data';
  return 'other';
}

// Absolute filesystem paths for every served-root copy of a /-rooted web path.
export function mirrorRootsFor(siteRoot, webPath) {
  const rel = String(webPath || '').replace(/^\/+/, '');
  return SERVED_ROOTS.map((root) => ({
    root: root || '.',
    abs: path.join(siteRoot, root, rel),
  }));
}

function walkFiles(absDir, relBase, out) {
  let entries;
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === '.DS_Store' || entry.name.startsWith('.')) continue;
    const abs = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walkFiles(abs, relBase, out);
    } else if (entry.isFile()) {
      out.push(toPosix(path.relative(relBase, abs)));
    }
  }
  return out;
}

// Enumerate every tracked static file as { webPath, relPath, ext, kind,
// sizeBytes, mtime, mirrors } — `mirrors` listing which served roots hold it.
export function listStaticAssets({ siteRoot } = {}) {
  const root = String(siteRoot || '').trim();
  if (!root) throw new Error('listStaticAssets requires { siteRoot }');

  // webPath -> { mirrors:Set, canonicalAbs }
  const map = new Map();
  for (const servedRoot of SERVED_ROOTS) {
    for (const dir of STATIC_DIRS) {
      const base = path.join(root, servedRoot);
      const absDir = path.join(base, dir);
      const rels = walkFiles(absDir, base, []);
      for (const rel of rels) {
        const webPath = `/${rel}`;
        let record = map.get(webPath);
        if (!record) {
          record = { mirrors: new Set(), canonicalAbs: '' };
          map.set(webPath, record);
        }
        record.mirrors.add(servedRoot || 'root');
        // Prefer the repo-root copy as canonical for size/mtime.
        if (!record.canonicalAbs || servedRoot === '') {
          record.canonicalAbs = path.join(base, rel);
        }
      }
    }
  }

  const rows = [];
  for (const [webPath, record] of map) {
    const ext = path.extname(webPath).toLowerCase();
    let sizeBytes = 0;
    let mtime = '';
    try {
      const st = fs.statSync(record.canonicalAbs);
      sizeBytes = st.size;
      mtime = st.mtime.toISOString();
    } catch {
      /* canonical may have been removed mid-scan */
    }
    rows.push({
      webPath,
      relPath: webPath.replace(/^\/+/, ''),
      ext: ext.replace(/^\./, ''),
      kind: kindForExtension(ext),
      sizeBytes,
      mtime,
      mirrors: SERVED_ROOTS.filter((r) => record.mirrors.has(r || 'root')).map((r) => r || 'root'),
    });
  }
  rows.sort((a, b) => a.webPath.localeCompare(b.webPath));
  return rows;
}

function stripQueryAndHash(value) {
  const hashIndex = value.indexOf('#');
  const queryIndex = value.indexOf('?');
  const end = Math.min(
    hashIndex === -1 ? value.length : hashIndex,
    queryIndex === -1 ? value.length : queryIndex,
  );
  return value.slice(0, end);
}

function isTracked(value) {
  return STATIC_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function extractRefs(content, add) {
  const attrPattern = /\b(?:href|src|content|data-src|poster)\s*=\s*(["'])([^"']+)\1/gi;
  const srcsetPattern = /\bsrcset\s*=\s*(["'])([^"']+)\1/gi;
  const cssUrlPattern = /url\(\s*(["']?)([^"')\s]+)\1\s*\)/gi;
  let m;
  while ((m = attrPattern.exec(content))) {
    const v = stripQueryAndHash(String(m[2] || '').trim());
    if (isTracked(v)) add(v);
  }
  while ((m = srcsetPattern.exec(content))) {
    for (const part of String(m[2] || '').split(',')) {
      const candidate = stripQueryAndHash((part.trim().split(/\s+/)[0] || '').trim());
      if (isTracked(candidate)) add(candidate);
    }
  }
  while ((m = cssUrlPattern.exec(content))) {
    const v = stripQueryAndHash(String(m[2] || '').trim());
    if (isTracked(v)) add(v);
  }
}

function walkTextFiles(absDir, root, out) {
  let entries;
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walkTextFiles(abs, root, out);
    } else if (entry.isFile() && TEXT_REF_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      out.push(toPosix(path.relative(root, abs)));
    }
  }
  return out;
}

// Build Map<webPath, string[]> — files that reference each tracked web path.
export function scanAssetReferences({ siteRoot } = {}) {
  const root = String(siteRoot || '').trim();
  if (!root) throw new Error('scanAssetReferences requires { siteRoot }');

  const index = new Map();
  const textFiles = walkTextFiles(root, root, []);
  for (const rel of textFiles) {
    let content;
    try {
      content = fs.readFileSync(path.join(root, rel), 'utf8');
    } catch {
      continue;
    }
    extractRefs(content, (webPath) => {
      let set = index.get(webPath);
      if (!set) {
        set = new Set();
        index.set(webPath, set);
      }
      set.add(rel);
    });
  }
  return index;
}

// Combined inventory: assets enriched with refCount + a sample referencing file.
export function inventory({ siteRoot } = {}) {
  const assets = listStaticAssets({ siteRoot });
  const refIndex = scanAssetReferences({ siteRoot });
  for (const asset of assets) {
    const refs = refIndex.get(asset.webPath);
    asset.refCount = refs ? refs.size : 0;
    asset.refSample = refs ? Array.from(refs).sort()[0] : '';
  }
  return { assets, scannedAt: new Date().toISOString(), totalFiles: assets.length };
}

// Full list of files referencing a single web path (for the detail/confirm view).
export function assetReferences({ siteRoot, webPath } = {}) {
  const target = stripQueryAndHash(String(webPath || '').trim());
  if (!target) return { webPath: target, refs: [] };
  const refIndex = scanAssetReferences({ siteRoot });
  const refs = refIndex.get(target);
  return { webPath: target, refs: refs ? Array.from(refs).sort() : [] };
}
