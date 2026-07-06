#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, 'components', 'open-access', 'index.html');
const TARGET = path.join(ROOT, 'docs', 'open-access', 'index.html');

async function main() {
  const [source, target] = await Promise.all([
    fs.readFile(SOURCE, 'utf8'),
    fs.readFile(TARGET, 'utf8'),
  ]);
  assert.equal(target, source, 'open-access route must match its canonical component');
  for (const marker of [
    '<link rel="canonical" href="https://dexdsl.org/open-access/">',
    '501(c)(3)',
    'CC BY 4.0',
    'Browse the catalog',
    'How Dex works',
    'Submit samples',
    'info@dexdsl.org',
  ]) {
    assert.ok(target.includes(marker), `open-access route missing marker: ${marker}`);
  }
  assert.doesNotMatch(target, /<script\b/i, 'open-access route must not ship JavaScript');
  assert.doesNotMatch(target, /<(?:img|video|iframe)\b/i, 'open-access route must not load visual media');
  assert.doesNotMatch(target, /<(?:link|source)[^>]+(?:stylesheet|preload|src)=/i, 'open-access route must not depend on external render assets');
  console.log('verify:open-access passed.');
}

main().catch((error) => {
  console.error(`verify:open-access failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
