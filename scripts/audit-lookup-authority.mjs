#!/usr/bin/env node
// Lookup-number authority audit + validation.
//
// Checks every catalog lookup number against library-style rules:
//   1. Schema      — matches the faceted grammar + closed family/medium vocab.
//   2. Cutter      — the performer code agrees with the name authority.
//   3. Uniqueness  — a lookup is an identifier; no two entries may share one.
//   4. Normalization/propagation — lookup_norm == canonical normalize(lookup_raw).
//   5. Distribution — facet coverage (informational).
//
// Exits non-zero on HARD failures (schema, vocab, cutter mismatch, duplicates).
// Normalization drift is reported as auto-fixable (run catalog:performers:normalize).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLookup, normalizeLookup, LOOKUP_FAMILIES, LOOKUP_MEDIA } from './lib/lookup-authority.mjs';
import { parseUavLookup, normalizeUavLookup } from './lib/uav-lookup-authority.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANONICAL = path.join(ROOT, 'data', 'catalog.entries.json');

function main() {
  const data = JSON.parse(fs.readFileSync(CANONICAL, 'utf8'));
  const entries = Array.isArray(data.entries) ? data.entries : [];

  const hard = [];
  const fixable = [];
  const seenRaw = new Map();
  const familyCounts = {};
  const mediumCounts = {};
  let uavCount = 0;

  for (const entry of entries) {
    const label = entry.lookup_raw || entry.id || '(unknown)';
    const isUav = entry.kind === 'uav' || /^DR\./i.test(String(entry.lookup_raw || ''));
    const parsed = isUav
      ? parseUavLookup(entry.lookup_raw)
      : parseLookup(entry.lookup_raw, { performers: entry.performers });

    if (!parsed.valid) {
      for (const issue of parsed.issues) hard.push(`${label}: ${issue}`);
    } else if (isUav) {
      uavCount += 1;
    } else {
      familyCounts[parsed.family] = (familyCounts[parsed.family] || 0) + 1;
      mediumCounts[parsed.medium] = (mediumCounts[parsed.medium] || 0) + 1;
    }

    // Uniqueness — lookup_raw is the identifier.
    const rawKey = isUav ? normalizeUavLookup(entry.lookup_raw) : normalizeLookup(entry.lookup_raw);
    if (rawKey) {
      if (seenRaw.has(rawKey)) hard.push(`duplicate lookup "${entry.lookup_raw}" (also ${seenRaw.get(rawKey)})`);
      else seenRaw.set(rawKey, entry.id || label);
    }

    // Normalization/propagation — stored norm must equal canonical norm.
    const expectedNorm = isUav ? normalizeUavLookup(entry.lookup_raw) : normalizeLookup(entry.lookup_raw);
    if (String(entry.lookup_norm || '') !== expectedNorm) {
      fixable.push(`${label}: lookup_norm "${entry.lookup_norm || ''}" → should be "${expectedNorm}"`);
    }
  }

  console.log('— Lookup authority audit —\n');
  console.log(`entries: ${entries.length}`);
  console.log(`families: ${Object.entries(familyCounts).map(([k, v]) => `${k}(${LOOKUP_FAMILIES[k]})×${v}`).join('  ')}`);
  console.log(`media:    ${Object.entries(mediumCounts).map(([k, v]) => `${k}(${LOOKUP_MEDIA[k]})×${v}`).join('  ')}`);
  console.log(`uav:      ${uavCount}`);
  console.log('');

  if (fixable.length) {
    console.log(`normalization drift (auto-fixable via catalog:performers:normalize): ${fixable.length}`);
    for (const f of fixable) console.log(`  · ${f}`);
    console.log('');
  }

  if (hard.length) {
    console.log(`HARD failures: ${hard.length}`);
    for (const h of hard) console.log(`  ✗ ${h}`);
    console.log('\nlookup audit FAILED.');
    process.exit(1);
  }

  console.log('lookup audit passed (schema, vocabulary, cutter authority, uniqueness).');
}

main();
