#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { normalizeCatalogSeasonsFile } from './lib/catalog-seasons-schema.mjs';

const ROOT = process.cwd();
const SOURCE_PATH = path.join(ROOT, 'data', 'catalog.seasons.json');
const PUBLIC_PATH = path.join(ROOT, 'docs', 'data', 'catalog.seasons.json');
const DOCS_PATH = path.join(ROOT, 'docs', 'data', 'catalog.seasons.json');
const INDEX_RUNTIME_PATH = path.join(ROOT, 'scripts', 'src', 'catalog.index.entry.mjs');
const INDEX_CSS_PATH = path.join(ROOT, 'docs', 'css', 'components', 'dx-catalog-index.css');

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${path.relative(ROOT, filePath)}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${path.relative(ROOT, filePath)}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function main() {
  const failures = [];

  const source = normalizeCatalogSeasonsFile(readJson(SOURCE_PATH));
  const publicMirror = normalizeCatalogSeasonsFile(readJson(PUBLIC_PATH));
  const docsMirror = normalizeCatalogSeasonsFile(readJson(DOCS_PATH));

  if (JSON.stringify(source.seasons) !== JSON.stringify(publicMirror.seasons)) {
    failures.push('docs/data/catalog.seasons.json does not match data/catalog.seasons.json seasons payload');
  }
  if (JSON.stringify(source.seasons) !== JSON.stringify(docsMirror.seasons)) {
    failures.push('docs/data/catalog.seasons.json does not match data/catalog.seasons.json seasons payload');
  }

  if (!Array.isArray(source.seasons) || source.seasons.length === 0) {
    failures.push('catalog.seasons config must include at least one season row');
  }

  const runtimeSource = readText(INDEX_RUNTIME_PATH);
  const requiredRuntimeMarkers = [
    "const SEASONS_URL = '/data/catalog.seasons.json';",
    'data-dx-season-card-kind',
    'data-dx-growlix-token',
    'dx-catalog-index-season-slide--unannounced',
    'dx-catalog-index-season-pips',
    'data-dx-carousel-active-slot',
    'data-dx-carousel-page-button',
    'data-dx-carousel-group',
    'data-dx-campaign-id',
    'dx-catalog-index-season-media--campaign',
    'CATALOG_FALLBACK_IMAGE',
    '__DX_SEASON_TEASER_SEED',
  ];
  for (const marker of requiredRuntimeMarkers) {
    if (!runtimeSource.includes(marker)) {
      failures.push(`catalog index runtime missing marker: ${marker}`);
    }
  }
  if (runtimeSource.includes('/assets/img/3b1476c230073f7589e3.jpg')) {
    failures.push('catalog index must not load the oversized homepage teaser image');
  }

  const cssSource = readText(INDEX_CSS_PATH);
  const requiredCssMarkers = [
    '.dx-catalog-index-season-slide--unannounced',
    '.dx-catalog-index-season-growlix-token',
    '.dx-catalog-index-season-media--unannounced',
    '.dx-catalog-index-season-pips',
    '.dx-catalog-index-season-media--fallback',
    '.dx-catalog-index-season-media--campaign',
    '.dx-catalog-index-season-campaign-badge',
    'overscroll-behavior-y: auto',
  ];
  for (const marker of requiredCssMarkers) {
    if (!cssSource.includes(marker)) {
      failures.push(`catalog index css missing marker: ${marker}`);
    }
  }

  if (failures.length > 0) {
    console.error(`catalog:seasons:verify failed with ${failures.length} issue(s):`);
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(`catalog:seasons:verify passed (${source.seasons.length} configured seasons).`);
}

try {
  main();
} catch (error) {
  console.error(`catalog:seasons:verify failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
