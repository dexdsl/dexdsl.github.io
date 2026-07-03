#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILURES = [];

function readText(relPath) {
  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) {
    FAILURES.push(`Missing required file: ${relPath}`);
    return '';
  }
  return fs.readFileSync(absPath, 'utf8');
}

function assertIncludes(relPath, text, markers) {
  for (const marker of markers) {
    if (!text.includes(marker)) FAILURES.push(`${relPath} missing marker: ${marker}`);
  }
}

const operationalFiles = [
  'scripts/src/submit.samples.entry.mjs',
  'scripts/src/pressroom.entry.mjs',
  'scripts/src/messages.inbox.entry.mjs',
  'scripts/src/messages.submission.entry.mjs',
  'docs/entry/submit/index.html',
  'docs/entry/pressroom/index.html',
  'docs/board/index.html',
  'docs/assets/dex-auth.js',
  'assets/dex-auth.js',
  'docs/assets/dex-auth.js',
  'docs/assets/js/submit.samples.js',
  'assets/js/submit.samples.js',
  'docs/assets/js/submit.samples.js',
  'docs/assets/js/pressroom.js',
  'assets/js/pressroom.js',
  'docs/assets/js/pressroom.js',
  'docs/assets/js/messages.inbox.js',
  'assets/js/messages.inbox.js',
  'docs/assets/js/messages.inbox.js',
  'docs/assets/js/messages.submission.js',
  'assets/js/messages.submission.js',
  'docs/assets/js/messages.submission.js',
  'scripts/lib/staff-links.mjs',
];

for (const relPath of operationalFiles) {
  const text = readText(relPath);
  if (text.includes('script.google.com/macros')) {
    FAILURES.push(`${relPath} still references Apps Script`);
  }
  if (text.includes('docs.google.com/spreadsheets/d/')) {
    FAILURES.push(`${relPath} still references an operational Google Sheet`);
  }
}

assertIncludes('scripts/src/submit.samples.entry.mjs', readText('scripts/src/submit.samples.entry.mjs'), [
  '/me/submissions/quota',
  '/me/submissions',
]);
assertIncludes('scripts/src/pressroom.entry.mjs', readText('scripts/src/pressroom.entry.mjs'), [
  '/me/press-requests/quota',
  '/me/press-requests',
]);
assertIncludes('scripts/src/messages.inbox.entry.mjs', readText('scripts/src/messages.inbox.entry.mjs'), [
  '/me/ops/tickets?limit=200',
  '/me/submissions?limit=200&state=all',
]);
assertIncludes('scripts/src/messages.submission.entry.mjs', readText('scripts/src/messages.submission.entry.mjs'), [
  '/me/press-requests?limit=200',
  '/me/press-requests/${encodeURIComponent(safeRequestId)}/events',
]);
assertIncludes('docs/board/index.html', readText('docs/board/index.html'), [
  '/board/nominations',
  'authorization = "Bearer " + token',
]);
assertIncludes('scripts/dex.mjs', readText('scripts/dex.mjs'), [
  'async function runOpsCommand',
  'dex ops import sheets --kind submissions|press|polls|board',
]);
assertIncludes('scripts/lib/ops-admin-api.mjs', readText('scripts/lib/ops-admin-api.mjs'), [
  '/admin/ops/tickets',
  '/admin/ops/import',
  'DEX_OPS_ADMIN_TOKEN',
]);

if (FAILURES.length > 0) {
  console.error(`verify:ops-migration failed with ${FAILURES.length} issue(s):`);
  for (const failure of FAILURES) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('verify:ops-migration passed.');
