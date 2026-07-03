#!/usr/bin/env node
// Generates a compact performer index used by the dex-api worker to verify
// member contribution claims (entry lookup -> folded performer names) and to
// power claimable-candidate matching. Output is keyed by folded lookup number.
//
// Writes:
//   data/catalog-performers.json                (frontend artifact, mirrored)
//   <dex-api>/src/data/catalog-performers.json  (bundled into the worker, if present)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
const WORKER_DATA = path.resolve(ROOT, '..', 'dex-api-worker', 'dex-api', 'src', 'data', 'catalog-performers.json');

function readJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  } catch {
    return null;
  }
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    const found = Object.values(value).find(Array.isArray);
    if (found) return found;
  }
  return [];
}

function foldName(value) {
  return String(value == null ? '' : value)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function foldPersonName(value) {
  const raw = String(value == null ? '' : value).trim();
  const flipped = /,/.test(raw) ? raw.split(',').map((p) => p.trim()).reverse().join(' ') : raw;
  return foldName(flipped);
}

function foldLookup(value) {
  return String(value == null ? '' : value).toLowerCase().replace(/\s+/g, ' ').trim();
}

function slugFromHref(href) {
  const m = String(href || '').match(/\/entry\/([^/]+)\/?/);
  return m ? m[1] : '';
}

function main() {
  const editorial = asArray(readJson('data/catalog.editorial.json'));
  const entries = asArray(readJson('data/catalog.entries.json'));

  const byLookup = new Map();

  function upsert({ lookup, slug, href, performer, title, performerDisplay }) {
    const folded = foldLookup(lookup);
    if (!folded) return;
    if (!byLookup.has(folded)) {
      byLookup.set(folded, {
        lookup: String(lookup || '').trim(),
        slug: slug || '',
        href: href || '',
        title: '',
        performerDisplay: '',
        performers: new Set(),
      });
    }
    const rec = byLookup.get(folded);
    if (!rec.slug && slug) rec.slug = slug;
    if (!rec.href && href) rec.href = href;
    if (!rec.title && title) rec.title = String(title).trim();
    if (!rec.performerDisplay && performerDisplay) rec.performerDisplay = String(performerDisplay).trim();
    const pf = foldPersonName(performer);
    if (pf) rec.performers.add(pf);
  }

  for (const e of editorial) {
    upsert({
      lookup: e.lookup_number,
      slug: e.entry_id || slugFromHref(e.entry_href),
      href: e.entry_href,
      performer: e.performer,
      performerDisplay: e.performer,
      title: e.title_raw,
    });
  }
  for (const e of entries) {
    upsert({
      lookup: e.lookup_raw,
      slug: e.id || slugFromHref(e.entry_href),
      href: e.entry_href,
      performer: e.performer_raw,
      performerDisplay: e.performer_raw,
      title: e.title_raw,
    });
  }

  const index = Array.from(byLookup.values())
    .map((rec) => ({
      lookup: rec.lookup,
      slug: rec.slug,
      href: rec.href,
      title: rec.title,
      performer_display: rec.performerDisplay,
      performers: Array.from(rec.performers).sort(),
    }))
    .sort((a, b) => a.lookup.localeCompare(b.lookup));

  const payload = {
    generated_at: new Date().toISOString(),
    source: 'catalog.editorial.json + catalog.entries.json',
    count: index.length,
    entries: index,
  };

  const outFront = path.join(ROOT, 'data', 'catalog-performers.json');
  fs.writeFileSync(outFront, JSON.stringify(payload, null, 2));
  console.log(`catalog-performers: wrote ${path.relative(ROOT, outFront)} (${index.length} entries)`);

  // Mirror into the docs/ deploy surface (canonical source is data/catalog-performers.json above).
  for (const mirror of ['docs/data/catalog-performers.json']) {
    const dest = path.join(ROOT, mirror);
    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, JSON.stringify(payload, null, 2));
      console.log(`catalog-performers: wrote ${mirror}`);
    } catch (error) {
      console.warn(`catalog-performers: could not write ${mirror}: ${error.message}`);
    }
  }

  // Bundle into the worker for authoritative claim verification, when present.
  try {
    fs.mkdirSync(path.dirname(WORKER_DATA), { recursive: true });
    fs.writeFileSync(WORKER_DATA, JSON.stringify(payload, null, 2));
    console.log(`catalog-performers: wrote ${WORKER_DATA}`);
  } catch (error) {
    console.warn(`catalog-performers: worker data not written (${error.message})`);
  }
}

main();
