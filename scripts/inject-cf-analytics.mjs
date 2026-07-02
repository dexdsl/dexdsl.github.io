#!/usr/bin/env node
/**
 * inject-cf-analytics.mjs — add the Cloudflare Web Analytics beacon to pages.
 *
 * Cloudflare Web Analytics is cookieless (no cookies, no cross-site IDs), so it
 * needs no consent — it replaces the Google Analytics that strip-analytics.mjs
 * removed. This inserts the public beacon once, immediately before </head>.
 *
 * The token below is the PUBLIC Web Analytics beacon token (safe to expose in
 * client HTML) — not an API credential.
 *
 * Run: node scripts/inject-cf-analytics.mjs [--check] [rootDir ...]
 *   defaults to: docs entry-template
 *   --check : report files missing the beacon, exit 1 if any, write nothing.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const BEACON_TOKEN = '443e9f568f5e472e89282895eeff6f9e';
const BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';
const SNIPPET =
  `<!-- Cloudflare Web Analytics --><script defer src='${BEACON_SRC}' ` +
  `data-cf-beacon='{"token": "${BEACON_TOKEN}"}'></script><!-- End Cloudflare Web Analytics -->`;

const args = process.argv.slice(2);
const isCheckMode = args.includes('--check');
const roots = args.filter((a) => !a.startsWith('--'));
const ROOTS = (roots.length ? roots : ['docs', 'entry-template']).map((r) => path.resolve(r));

async function collectHtmlFiles(rootDir) {
  const files = [];
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        await walk(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
        files.push(full);
      }
    }
  }
  await walk(rootDir);
  return files;
}

async function main() {
  let files = [];
  for (const root of ROOTS) {
    try {
      files = files.concat(await collectHtmlFiles(root));
    } catch {
      console.warn(`skip missing root: ${root}`);
    }
  }
  if (!files.length) {
    console.error('No HTML files found.');
    process.exit(1);
  }

  let present = 0;
  let injected = 0;
  let skippedNoHead = 0;
  const missing = [];

  for (const file of files) {
    const html = await fs.readFile(file, 'utf8');
    if (html.includes(BEACON_SRC)) {
      present += 1;
      continue;
    }
    // These Squarespace exports don't all have a literal </head>. Insert before
    // the first stable anchor: </head>, else the header-slot.js tag (loaded in
    // head), else </body>. Beacon is a deferred script so any of these is fine.
    let idx = html.search(/<\/head>/i);
    if (idx === -1) {
      const m = html.match(/<script\b[^>]*\bsrc=["'][^"']*\/assets\/js\/header-slot\.js["'][^>]*>/i);
      if (m) idx = m.index;
    }
    if (idx === -1) idx = html.search(/<\/body>/i);
    if (idx === -1) {
      skippedNoHead += 1;
      continue;
    }
    missing.push(path.relative(process.cwd(), file));
    if (!isCheckMode) {
      const updated = `${html.slice(0, idx)}${SNIPPET}\n${html.slice(idx)}`;
      await fs.writeFile(file, updated, 'utf8');
      injected += 1;
    }
  }

  console.log(
    `Scanned ${files.length} files: ${present} already had beacon, ` +
      `${isCheckMode ? missing.length + ' missing' : injected + ' injected'}, ` +
      `${skippedNoHead} without </head> (skipped).`
  );
  if (isCheckMode && missing.length) {
    for (const m of missing.slice(0, 20)) console.log(`  missing: ${m}`);
    process.exit(1);
  }
}

await main();
