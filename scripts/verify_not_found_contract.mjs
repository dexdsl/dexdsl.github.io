#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const failures = [];

function read(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) {
    failures.push(`missing ${relativePath}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function expectMarker(text, marker, label) {
  if (!text.includes(marker)) failures.push(`${label} missing marker: ${marker}`);
}

const html = read('docs/404.html');
const source = read('scripts/src/not-found.entry.mjs');
const built = read('public/assets/js/not-found.js');
const css = read('public/css/components/dx-not-found.css');

for (const marker of [
  'id="dex-not-found"',
  'data-dx-not-found-title',
  'data-dx-not-found-suggestion',
  'data-dx-808-achievements',
  'id="dex-profile"',
  '/assets/js/not-found.js',
  '/css/components/dx-not-found.css',
]) {
  expectMarker(html, marker, '404 HTML');
}

if (/document\.body\.innerHTML/.test(html)) failures.push('404 HTML must not replace the document body');
if ((html.match(/<main\b/g) || []).length !== 1) failures.push('404 HTML must contain exactly one main element');

for (const marker of [
  '/me/achievements/route-visit',
  '/me/achievements/secret-claim',
  'vault-easter-egg',
  'dx:achievement:pending:v1',
  'credentials: \'omit\'',
  'window.location.assign(ACHIEVEMENTS_HREF)',
]) {
  expectMarker(source, marker, '404 source');
}

for (const marker of ['/me/achievements/route-visit', 'vault-easter-egg']) {
  expectMarker(built, marker, '404 bundle');
}

for (const marker of [
  '.dx-not-found-surface',
  '.dx-not-found-achievements',
  'overflow-x: clip',
  '@media (max-width: 600px)',
  '@media (prefers-reduced-motion: reduce)',
]) {
  expectMarker(css, marker, '404 CSS');
}

for (const marker of ['data-dx-808-machine', 'dx-808-step', 'Page missing. Beat found.']) {
  if (html.includes(marker) || source.includes(marker) || css.includes(marker)) {
    failures.push(`removed 808 visual marker still present: ${marker}`);
  }
}

if (failures.length) {
  console.error(`verify:not-found failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('verify:not-found passed.');
