#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { formatSanitizationIssues, sanitizeGeneratedHtml, verifySanitizedHtml } from './lib/sanitize-generated-html.mjs';

const ENTRIES_DIR = path.resolve('entries');
const dryRun = process.argv.includes('--dry-run');

// Entries whose shells diverge from the standard entry-template — sanitizing them
// rewrites them in destructive ways (e.g. strips required <script> tags from the bag
// minimal shell). Keep them out of the backfill.
const SKIP_SLUGS = new Set(['bag', 'smoke-title', 'test', 'test-2', 'test-3', 'test-4', 'test-5', 'test-5a', 'test-6', 'test-7', 'test-8', 'test-9', 'test-10', 'test-11']);

async function walkEntryHtml(dir, out = []) {
  const dirents = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const dirent of dirents) {
    const fullPath = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      if (dir === ENTRIES_DIR && SKIP_SLUGS.has(dirent.name)) continue;
      await walkEntryHtml(fullPath, out);
      continue;
    }
    if (dirent.isFile() && dirent.name === 'index.html') out.push(fullPath);
  }
  return out;
}

async function main() {
  const files = (await walkEntryHtml(ENTRIES_DIR)).sort();
  if (!files.length) {
    console.log('No entries/**/index.html files found.');
    return;
  }

  let unchanged = 0;
  let rewritten = 0;
  let invalid = 0;
  for (const filePath of files) {
    const current = await fs.readFile(filePath, 'utf8');
    const sanitized = sanitizeGeneratedHtml(current);
    const verify = verifySanitizedHtml(sanitized);
    if (!verify.ok) {
      invalid += 1;
      console.warn(`WARN ${path.relative(process.cwd(), filePath)} :: ${formatSanitizationIssues(verify.issues)}`);
    }

    if (sanitized === current) {
      unchanged += 1;
      continue;
    }

    rewritten += 1;
    if (!dryRun) {
      await fs.writeFile(filePath, sanitized, 'utf8');
    }
    console.log(`${dryRun ? 'DRY-RUN' : 'UPDATED'} ${path.relative(process.cwd(), filePath)}`);
  }

  console.log(`Backfill complete. rewritten=${rewritten} unchanged=${unchanged} invalid=${invalid} total=${files.length}${dryRun ? ' (dry-run)' : ''}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
