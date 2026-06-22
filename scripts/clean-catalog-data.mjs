#!/usr/bin/env node
// One-off maintenance: apply catalog hygiene (strip invisible directional marks + drop
// dev-stub entries) to the committed catalog JSON, since the live re-extraction pipeline
// (extract_catalog_data.mjs) needs network access. Uses the same shared logic so the
// committed state matches what a fresh extraction would now produce.
import fs from 'node:fs';
import path from 'node:path';
import { sanitizeCatalogJson, EXCLUDED_ENTRY_IDS } from './lib/catalog-sanitize.mjs';

const ROOT = process.cwd();

const JSON_TARGETS = [
  'data/catalog.data.json',
  'data/catalog.entries.json',
  'data/catalog.search.json',
  'data/catalog.curation.snapshot.json',
  'data/catalog.editorial.json',
  'data/catalog.guide.json',
  'data/catalog.symbols.json',
  'public/data/catalog.data.json',
  'public/data/catalog.entries.json',
  'public/data/catalog.search.json',
  'public/data/catalog.curation.snapshot.json',
  'public/data/catalog.editorial.json',
  'public/data/catalog.guide.json',
  'public/data/catalog.symbols.json',
  'docs/data/catalog.data.json',
  'docs/data/catalog.entries.json',
  'docs/data/catalog.search.json',
  'docs/data/catalog.curation.snapshot.json',
  'docs/data/catalog.editorial.json',
  'docs/data/catalog.guide.json',
  'docs/data/catalog.symbols.json',
  'assets/data/catalog.entries.json',
  'public/assets/data/catalog.entries.json',
  'docs/assets/data/catalog.entries.json',
];

// Dev-stub route directories to remove (the excluded entries' placeholder pages).
const ROUTE_DIRS = [...EXCLUDED_ENTRY_IDS].flatMap((id) => [
  `docs/entry/${id}`,
  `public/entry/${id}`,
  `entry/${id}`,
]);

let changed = 0;
for (const rel of JSON_TARGETS) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  const before = fs.readFileSync(abs, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(before);
  } catch {
    console.warn(`skip (invalid JSON): ${rel}`);
    continue;
  }
  const cleaned = sanitizeCatalogJson(parsed);
  // Keep entry-count stats consistent after dropping dev-stub entries.
  const entriesArr = Array.isArray(cleaned) ? cleaned : (Array.isArray(cleaned.entries) ? cleaned.entries : null);
  if (entriesArr && cleaned && typeof cleaned === 'object' && cleaned.stats) {
    if (typeof cleaned.stats.entries_count === 'number') cleaned.stats.entries_count = entriesArr.length;
    if (typeof cleaned.stats.lookup_count === 'number') {
      cleaned.stats.lookup_count = entriesArr.filter((e) => String(e?.lookup_raw || e?.lookup || '').trim()).length;
    }
  }
  const after = `${JSON.stringify(cleaned, null, 2)}\n`;
  if (after !== before) {
    fs.writeFileSync(abs, after, 'utf8');
    changed += 1;
    console.log(`cleaned ${rel}`);
  }
}

let removed = 0;
for (const rel of ROUTE_DIRS) {
  const abs = path.join(ROOT, rel);
  if (fs.existsSync(abs)) {
    fs.rmSync(abs, { recursive: true, force: true });
    removed += 1;
    console.log(`removed stub route ${rel}`);
  }
}

console.log(`catalog:clean done (${changed} json file(s) cleaned, ${removed} stub route dir(s) removed)`);
