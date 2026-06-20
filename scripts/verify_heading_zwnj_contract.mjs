#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILURES = [];

const SCAN_ROOTS = [
  'docs',
  'content',
  'components',
  'data',
  'scripts/fixtures/about-reference',
];
const SCAN_FILE_EXT = /\.(?:html|md|json|js|mjs|ts|tsx|css)$/i;

function readText(relPath) {
  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) {
    FAILURES.push(`Missing required file: ${relPath}`);
    return '';
  }
  return fs.readFileSync(absPath, 'utf8');
}

function walkFiles(absPath, out) {
  const stat = fs.statSync(absPath);
  if (stat.isFile()) {
    if (SCAN_FILE_EXT.test(absPath)) out.push(absPath);
    return;
  }

  const entries = fs.readdirSync(absPath, { withFileTypes: true });
  for (const entry of entries) {
    const nextAbsPath = path.join(absPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      walkFiles(nextAbsPath, out);
      continue;
    }
    if (entry.isFile() && SCAN_FILE_EXT.test(nextAbsPath)) {
      out.push(nextAbsPath);
    }
  }
}

function assertIncludes(relPath, text, markers) {
  for (const marker of markers) {
    if (!text.includes(marker)) {
      FAILURES.push(`${relPath} missing marker: ${marker}`);
    }
  }
}

function assertNotIncludes(relPath, text, markers) {
  for (const marker of markers) {
    if (text.includes(marker)) {
      FAILURES.push(`${relPath} still contains marker: ${marker}`);
    }
  }
}

function readJson(relPath) {
  const text = readText(relPath);
  try {
    return JSON.parse(text);
  } catch {
    FAILURES.push(`${relPath} is not valid JSON`);
    return null;
  }
}

function stripHeadingSeparators(value) {
  return String(value || '').replace(/[\u200C\u200D]/g, '');
}

function collectJsonStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectJsonStrings(item, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => collectJsonStrings(item, out));
  return out;
}

function verifyCatalogStaticCopySeparators() {
  const z = '\u200C';
  const requiredSeparatedCopy = [
    `VIEW COL${z}LECTION`,
    `PREPARED FLO${z}OR TOM`,
    `BAS${z}SO${z}ON + ELECTRONICS WITH GENERATIVE VIDEO`,
    `CEL${z}LO`,
    `MULTIPLE PERCUS${z}SION`,
    `PREPARED BAS${z}S VIOL`,
    `PREPARED HAM${z}MERED DULCIMER + DIGITAL SIGNAL PROCES${z}SOR`,
    `SPLINTERINGS for DOUBLE BAS${z}S`,
    `AS THOUGH I’M SLIP${z}PING - MIXED ENSEMBLE`,
    `FE${z}EDBACK TELEVISIONS`,
  ];
  const forbiddenVisibleCopy = [
    'ARTIST SPOOTLIGHT:',
    'List of Syymbols',
    'VIEW COLLECTION',
    'PREPARED FLOOR TOM',
    'BASSOON + ELECTRONICS WITH GENERATIVE VIDEO',
    'CELLO',
    'MULTIPLE PERCUSSION',
    'PREPARED BASS VIOL',
    'PREPARED HAMMERED DULCIMER + DIGITAL SIGNAL PROCESSOR',
    'SPLINTERINGS for DOUBLE BASS',
    'AS THOUGH I’M SLIPPING - MIXED ENSEMBLE',
    'FEEDBACK TELEVISIONS',
  ];
  const catalogRels = [
    'data/catalog.editorial.json',
    'data/catalog.entries.json',
    'data/catalog.data.json',
    'data/catalog.search.json',
    'data/catalog.symbols.json',
    'data/catalog.curation.snapshot.json',
    'public/data/catalog.editorial.json',
    'public/data/catalog.entries.json',
    'public/data/catalog.data.json',
    'public/data/catalog.search.json',
    'public/data/catalog.symbols.json',
    'public/data/catalog.curation.snapshot.json',
    'docs/data/catalog.editorial.json',
    'docs/data/catalog.entries.json',
    'docs/data/catalog.data.json',
    'docs/data/catalog.search.json',
    'docs/data/catalog.symbols.json',
    'docs/data/catalog.curation.snapshot.json',
  ];

  const joinedCatalogText = catalogRels.map(readText).join('\n');
  assertIncludes('catalog static copy', joinedCatalogText, [
    'ARTIST SPOTLIGHT',
    'List of Symbols',
    ...requiredSeparatedCopy,
  ]);
  assertNotIncludes('catalog static copy', joinedCatalogText, forbiddenVisibleCopy);

  const entriesPayload = readJson('data/catalog.entries.json');
  const entryStrings = collectJsonStrings(entriesPayload);
  for (const value of requiredSeparatedCopy) {
    const canonical = stripHeadingSeparators(value);
    if (!entryStrings.some((candidate) => stripHeadingSeparators(candidate) === canonical && candidate.includes(z))) {
      FAILURES.push(`data/catalog.entries.json missing separated display copy for ${canonical}`);
    }
  }
}

function verifyHeadingRuntime() {
  const relPath = 'public/assets/js/header-slot.js';
  const text = readText(relPath);
  assertIncludes(relPath, text, [
    'HEADING_TYPOGRAPHY_SELECTOR',
    "const STRETCH_PRO_CANONICAL_SEPARATOR = '\\u200C';",
    "const STRETCH_PRO_DUPLICATED_SEPARATOR = '\\u200D';",
    'isStretchDuplicateSeparator',
    'HEADING_DUPLICATE_LIGATURE_SUPPORTED',
    'insertCanonicalDoubleLetterSeparators',
    'normalizeRenderedDuplicateSeparators',
    'stripCanonicalHeadingSeparators',
    'pickProbabilisticDuplicateCount',
    'window.__DX_HEADING_RANDOM_SEED',
    'window.__dxHeadingFx',
    'duplicateLigatureLetters',
    'HEADING_DUPLICATE_EXCLUDE_WORDS_ATTR',
    'parseHeadingDuplicateExcludedWords',
    'HEADING_DUPLICATE_EXCLUDE_LETTERS_ATTR',
    'parseHeadingDuplicateExcludedLetters',
    'DONATE_LABEL_CANONICAL',
    'normalizeDonateActionLabels',
    'data-dx-donate-normalized',
    "data-dx-heading-canonical",
    "data-dx-heading-rendered",
    'applyHeadingTypographyAndSupportHooks',
  ]);

  if (!/return\s+stripCanonicalHeadingSeparators\(rendered\s*\|\|\s*separated\);/.test(text)) {
    FAILURES.push(`${relPath} must normalize visible render output via stripCanonicalHeadingSeparators(rendered || separated)`);
  }
  if (/return\s+rendered\s*\|\|\s*separated\s*;/.test(text)) {
    FAILURES.push(`${relPath} must not return raw rendered/separated heading output`);
  }
}

function verifySidebarHeadingSeparatorPolicy() {
  const relPath = 'public/assets/dex-sidebar.js';
  const text = readText(relPath);
  if (/replace\(\s*\/\[\s*\\u200C\\u200D\s*\]\/g,\s*''\s*\)/.test(text)) {
    FAILURES.push(`${relPath} must not strip U+200D from visible randomizeTitle output`);
  }
  if (!/replace\(\s*\/\\u200C\/g,\s*''\s*\)/.test(text)) {
    FAILURES.push(`${relPath} missing canonical separator strip for heading pass-through`);
  }
}

function verifyNoInlineHeadingRandomizers() {
  const indexRel = 'docs/index.html';
  const indexText = readText(indexRel);
  const indexBlocked = [
    /<h[12][^>]*>\s*<script[^>]*>\s*document\.write\s*\(\s*randomizeTitle\(/i,
    /const\s+h1\s*=\s*document\.createElement\(['"]h1['"]\)[\s\S]{0,600}?randomizeTitle\s*\(/i,
    /insertBlanks\s*\(\s*['"]Sign up for Free Access['"]\s*\)/i,
  ];
  for (const pattern of indexBlocked) {
    if (pattern.test(indexText)) {
      FAILURES.push(`${indexRel} contains inline h1/h2 randomization pattern: ${pattern}`);
    }
  }
  if (!indexText.includes('data-dx-heading-duplicate-exclude-words="RECORDING"')) {
    FAILURES.push(`${indexRel} missing hero duplicate exclusion marker for RECORDING`);
  }

  const boardRel = 'docs/board/index.html';
  const boardText = readText(boardRel);
  if (/textContent\s*=\s*randomizeTitle\s*\(\s*el\.textContent\s*\)/i.test(boardText)) {
    FAILURES.push(`${boardRel} still randomizes existing heading text nodes inline`);
  }

  const heroRel = 'docs/hero.html';
  const heroText = readText(heroRel);
  if (/el\s*\(\s*['"]h1['"][\s\S]{0,250}?randomizeTitle\s*\(/i.test(heroText)) {
    FAILURES.push(`${heroRel} still randomizes h1 text inline`);
  }
}

function verifySupportFooterPadding() {
  const relPath = 'docs/support/index.html';
  const text = readText(relPath);
  assertIncludes(relPath, text, [
    'padding-bottom: calc(0.8rem + var(--dx-fixed-header-top, 12px));',
    'padding-bottom: calc(0.62rem + var(--dx-fixed-header-top, 12px));',
    'class="dx-support-title"',
  ]);
}

function verifySettingsHeadingExclusion() {
  const relPath = 'docs/entry/settings/index.html';
  const text = readText(relPath);
  if (!text.includes('id="dexs-title"')) {
    FAILURES.push(`${relPath} missing settings title heading marker`);
  }
  if (/id="dexs-title"[^>]*data-dx-heading-duplicate-exclude-words=/i.test(text)) {
    FAILURES.push(`${relPath} must not exclude #dexs-title from probabilistic heading duplication`);
  }
  if (!/id="dexs-title"[^>]*data-dx-heading-duplicate-exclude-letters=/i.test(text)) {
    FAILURES.push(`${relPath} missing duplicate-letter guard for #dexs-title`);
  }
  assertIncludes(relPath, text, [
    '#dex-settings .hdr h1',
    'letter-spacing: 0;',
    'font-feature-settings: "liga" 1, "clig" 1, "calt" 1;',
  ]);
}

function verifySupportErrorHeadingHooks() {
  const runtimeRel = 'scripts/src/support.status.entry.mjs';
  const runtimeText = readText(runtimeRel);
  assertIncludes(runtimeRel, runtimeText, [
    'decorateHeadingIfAvailable',
    "dispatchHeadingRenderEvent('dx:support-status:rendered')",
    "dispatchHeadingRenderEvent('dx:error-status:rendered')",
    "routeKey: 'support:title'",
    "routeKey: 'error:title'",
  ]);

  const errorRel = 'docs/error/index.html';
  const errorText = readText(errorRel);
  assertIncludes(errorRel, errorText, [
    'id="dx-error-title"',
  ]);
}

function main() {
  verifyCatalogStaticCopySeparators();
  verifyHeadingRuntime();
  verifySidebarHeadingSeparatorPolicy();
  verifyNoInlineHeadingRandomizers();
  verifySupportFooterPadding();
  verifySettingsHeadingExclusion();
  verifySupportErrorHeadingHooks();

  if (FAILURES.length > 0) {
    console.error(`verify:heading-zwnj failed with ${FAILURES.length} issue(s):`);
    for (const failure of FAILURES) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('verify:heading-zwnj passed.');
}

main();
