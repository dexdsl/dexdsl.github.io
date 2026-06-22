#!/usr/bin/env node
// Flags entries whose bucket Drive folders are configured but not published
// (or published with no folder / not scanned). Configured-but-not-published
// means the operator added a Drive folder for a bucket but never added that
// bucket to selectedBuckets, so it never reaches the download pipeline.

import fs from 'node:fs/promises';
import path from 'node:path';
import { auditEntryBucketFolders } from './lib/entry-bucket-folders.mjs';

const ROOT = process.cwd();
const ENTRIES_DIR = path.join(ROOT, 'entries');

async function main() {
  let dirents;
  try {
    dirents = await fs.readdir(ENTRIES_DIR, { withFileTypes: true });
  } catch {
    console.log('verify:bucket-folders — no entries/ directory; nothing to check.');
    return;
  }

  const findings = [];
  for (const dirent of dirents) {
    if (!dirent.isDirectory()) continue;
    const slug = dirent.name;
    const file = path.join(ENTRIES_DIR, slug, 'entry.json');
    let entry;
    try {
      entry = JSON.parse(await fs.readFile(file, 'utf8'));
    } catch {
      continue; // no/invalid entry.json
    }
    const warnings = auditEntryBucketFolders(entry);
    if (warnings.length) findings.push({ slug, warnings });
  }

  if (!findings.length) {
    console.log('verify:bucket-folders passed — no configured-but-unpublished buckets.');
    return;
  }

  // Configured-but-not-published is the actionable failure; the rest are notes.
  let hardFailures = 0;
  for (const { slug, warnings } of findings) {
    console.log(`\n${slug}:`);
    for (const warning of warnings) {
      const isHard = warning.includes('configured but not published');
      if (isHard) hardFailures += 1;
      console.log(`  ${isHard ? '✗' : '•'} ${warning}`);
    }
  }

  if (hardFailures > 0) {
    console.error(`\nverify:bucket-folders failed: ${hardFailures} bucket(s) configured but not published.`);
    process.exit(1);
  }
  console.log('\nverify:bucket-folders passed (with notes).');
}

main().catch((error) => {
  console.error(`verify:bucket-folders error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
