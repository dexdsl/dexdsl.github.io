#!/usr/bin/env node
// One-time (re-runnable) authority pass over the catalog entries data.
//
// For each entry it derives, library-style:
//   PERFORMER (MARC/LCNAF name authority, from performer_raw + performer_norm)
//     - performer_display : proper-cased inverted heading ("Surname, Forename")
//     - performer_norm    : corrected lowercased sort key (fixes Heinemann/LeVeque)
//     - performers         : structured [{ family, given, display, sort }]
//   LOOKUP (faceted call number, from lookup_raw)
//     - lookup_norm        : canonical normalized key (fixes empty/drifted norms)
//     - lookup             : structured facets { family, instrument, cutter, … }
// The raw forms (performer_raw, lookup_raw) are preserved as the source.
//
// Writes the canonical file; run `node scripts/sync_runtime_css.mjs` afterwards
// to mirror it to the data/, assets/, docs/ copies.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveAuthority } from './lib/performer-authority.mjs';
import { parseLookup, normalizeLookup } from './lib/lookup-authority.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANONICAL = path.join(ROOT, 'data', 'catalog.entries.json');

// Structured lookup facets to bake alongside the raw lookup (omitting the
// noisy validity/issue fields, which belong in the audit, not the data).
function lookupFacets(entry) {
  const parsed = parseLookup(entry.lookup_raw, { performers: entry.performers });
  if (!parsed.valid) return null;
  return {
    family: parsed.family,
    family_label: parsed.familyLabel,
    instrument: parsed.instrument,
    cutter: parsed.cutter,
    medium: parsed.medium,
    medium_label: parsed.mediumLabel,
    year: parsed.year,
    season: parsed.season,
  };
}

function normalizeEntry(entry) {
  const authority = deriveAuthority(entry.performer_raw, entry.performer_norm);
  const out = {};
  for (const [key, value] of Object.entries(entry)) {
    if (key === 'performer_display' || key === 'performers' || key === 'lookup') continue; // re-inserted in place
    if (key === 'performer_norm') { out.performer_norm = authority.performer_norm; continue; }
    if (key === 'lookup_norm') { out.lookup_norm = normalizeLookup(entry.lookup_raw); continue; }
    out[key] = value;
    if (key === 'performer_raw') out.performer_display = authority.performer_display;
  }
  if (!('performer_norm' in out)) out.performer_norm = authority.performer_norm;
  if (!('lookup_norm' in out)) out.lookup_norm = normalizeLookup(entry.lookup_raw);
  out.performers = authority.performers;
  const lookup = lookupFacets({ ...entry, performers: authority.performers });
  if (lookup) out.lookup = lookup;
  return out;
}

function main() {
  const data = JSON.parse(fs.readFileSync(CANONICAL, 'utf8'));
  if (!Array.isArray(data.entries)) {
    throw new Error('catalog.entries.json has no entries array');
  }
  data.entries = data.entries.map(normalizeEntry);
  fs.writeFileSync(CANONICAL, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`normalize-catalog-performers: rewrote ${path.relative(ROOT, CANONICAL)} (${data.entries.length} entries)`);
  console.log('next: node scripts/sync_runtime_css.mjs');
}

main();
