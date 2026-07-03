#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const RUNTIME_SOURCE_PATH = path.join(ROOT, 'scripts', 'src', 'donate.entry.mjs');
const SHOWCASE_HELPER_PATH = path.join(ROOT, 'scripts', 'lib', 'donate-showcase.mjs');
const BUNDLE_PATH = path.join(ROOT, 'docs', 'assets', 'js', 'donate.js');
const BUNDLE_MIRROR_PATH = path.join(ROOT, 'assets', 'js', 'donate.js');
const CSS_PATH = path.join(ROOT, 'docs', 'css', 'components', 'dx-donate.css');
const CSS_SOURCE_PATH = path.join(ROOT, 'css', 'components', 'dx-donate.css');
const PAGE_PATH = path.join(ROOT, 'docs', 'donate', 'index.html');

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${path.relative(ROOT, filePath)}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function assertIncludes(label, source, markers, failures) {
  markers.forEach((marker) => {
    if (!source.includes(marker)) {
      failures.push(`${label} missing marker: ${marker}`);
    }
  });
}

function assertExcludes(label, source, markers, failures) {
  markers.forEach((marker) => {
    if (source.includes(marker)) {
      failures.push(`${label} contains forbidden marker: ${marker}`);
    }
  });
}

function assertEqual(label, actual, expected, failures) {
  if (actual !== expected) {
    failures.push(`${label} is out of sync`);
  }
}

function main() {
  const failures = [];

  const runtimeSource = readText(RUNTIME_SOURCE_PATH);
  const showcaseHelper = readText(SHOWCASE_HELPER_PATH);
  const bundle = readText(BUNDLE_PATH);
  const bundleMirror = readText(BUNDLE_MIRROR_PATH);
  const css = readText(CSS_PATH);
  const cssSource = readText(CSS_SOURCE_PATH);
  const page = readText(PAGE_PATH);

  assertIncludes('donate runtime source', runtimeSource, [
    '/donations/checkout-session',
    'x-dx-idempotency-key',
    'challengeToken',
    'submittedAt',
    'honey',
    '/entry/settings?via=donate#membership',
    'catalogUrl',
    'hydrateShowcase',
    'Become a monthly member',
    'window.dxPageNav.create',
    'dx-glass-shell--header-match',
    'data-dx-heading-duplicate-exclude-letters',
    'joinCanonicalDuplicateLetters',
    'window.__dxSettingsMembershipOpen',
    '/assets/img/3b1476c230073f7589e3.jpg',
  ], failures);

  assertIncludes('donate showcase helper', showcaseHelper, [
    'normalizeDonationShowcaseEntry',
    'selectDonationShowcaseEntries',
    'diversityScore',
  ], failures);

  assertIncludes('donate bundle', bundle, [
    '/donations/checkout-session',
    'x-dx-idempotency-key',
    '/data/catalog.entries.json',
    'data-dx-donate-showcase-entry',
  ], failures);

  assertIncludes('donate css', css, [
    '.dx-donate-shell',
    '.dx-donate-card',
    '.dx-donate-honey-wrap',
    '.dx-donate-showcase',
    '.dx-donate-entry-card',
    '.dx-donate-entry-actions',
    '.dx-donate-showcase-frame',
    '.dx-donate-monthly',
    '.dx-donate-monthly-media',
    '.dx-donate-monthly-content',
    '--dx-donate-nav-size',
  ], failures);

  assertIncludes('donate page', page, [
    'data-dx-donate-app',
    '/css/components/dx-donate.css',
    '/css/components/dx-settings-membership.css',
    '/assets/js/donate.js',
    '/assets/js/settings.membership.js',
    '/assets/dex-runtime-config.js',
    'window.DEX_DONATE_CONFIG',
    "catalogUrl: '/data/catalog.entries.json'",
    'challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
  ], failures);

  assertExcludes('donate runtime source', runtimeSource, [
    'data-dx-donate-monthly-signin',
    '02 · MONTHLY MEMBERSHIP',
    'public/',
  ], failures);

  assertExcludes('donate page', page, [
    'website.components.donation',
    'data-definition-name="website.components.donation"',
    'dx-donation-block-container',
    'patreon.com/dexdsl',
    "Y.use('website.components.donation'",
  ], failures);

  assertEqual('donate JS docs/assets mirror', bundle, bundleMirror, failures);
  assertEqual('donate CSS source/docs mirror', css, cssSource, failures);

  if (failures.length) {
    console.error(`verify:donate failed with ${failures.length} issue(s):`);
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  console.log('verify:donate passed.');
}

try {
  main();
} catch (error) {
  console.error(`verify:donate failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
