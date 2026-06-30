#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ENTRY_ROOTS = [
  path.join(ROOT, 'entries'),
  path.join(ROOT, 'docs', 'entry'),
];
const ENTRY_RUNTIME_LINK = '<link rel="stylesheet" href="/css/components/dx-entry-runtime.css">';
const ENTRY_RUNTIME_HREF_PATTERN = /(?:https?:\/\/[^/"']+)?\/css\/components\/dx-entry-runtime\.css(?:[?#][^"']*)?/i;
const DEX_CSS_LINK_PATTERN = /<link\b[^>]*\bhref=(["'])(?:https?:\/\/[^/"']+)?\/assets\/css\/dex\.css(?:[?#][^"']*)?\1[^>]*>/i;

async function listEntryPages(root) {
  const dirents = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  return dirents
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name, 'index.html'));
}

async function syncPage(filePath) {
  let source;
  try {
    source = await fs.readFile(filePath, 'utf8');
  } catch {
    return 'missing';
  }

  if (!source.includes('dex-entry-page') || !/\/assets\/dex-sidebar\.js/i.test(source)) {
    return 'skipped';
  }
  if (ENTRY_RUNTIME_HREF_PATTERN.test(source)) return 'unchanged';
  if (!DEX_CSS_LINK_PATTERN.test(source)) {
    throw new Error(`${path.relative(ROOT, filePath)} is missing the dex.css insertion anchor`);
  }

  const output = source.replace(
    DEX_CSS_LINK_PATTERN,
    (dexCssLink) => `${dexCssLink}${ENTRY_RUNTIME_LINK}`,
  );
  await fs.writeFile(filePath, output, 'utf8');
  return 'updated';
}

async function main() {
  const pages = (await Promise.all(ENTRY_ROOTS.map(listEntryPages))).flat();
  const counts = {
    updated: 0,
    unchanged: 0,
    skipped: 0,
    missing: 0,
  };

  for (const filePath of pages) {
    const status = await syncPage(filePath);
    counts[status] += 1;
  }

  console.log(
    `build:entry-runtime-links updated=${counts.updated} unchanged=${counts.unchanged} `
    + `skipped=${counts.skipped} missing=${counts.missing}`,
  );
}

main().catch((error) => {
  console.error(`build:entry-runtime-links failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
