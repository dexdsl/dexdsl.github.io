#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { readHomeHeroLibrary, writeHomeHeroSnapshots } from './lib/home-hero-store.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');

const PATHS = {
  entry: path.join(ROOT, 'scripts', 'src', 'home.hero.entry.mjs'),
  css: path.join(ROOT, 'css', 'components', 'dx-home-hero.css'),
  composerCss: path.join(ROOT, 'css', 'components', 'dx-home-hero-composer.css'),
  component: path.join(ROOT, 'components', 'home', 'hero.js'),
  homepage: path.join(ROOT, 'docs', 'index.html'),
  docsJs: path.join(ROOT, 'docs', 'assets', 'js', 'dx-home-hero.js'),
  jsMirrors: [
    path.join(ROOT, 'assets', 'js', 'dx-home-hero.js'),
  ],
  cssMirrors: [
    path.join(ROOT, 'docs', 'css', 'components', 'dx-home-hero.css'),
  ],
  composerCssMirrors: [
    path.join(ROOT, 'docs', 'css', 'components', 'dx-home-hero-composer.css'),
  ],
};

const MOUNT_FRAGMENT = `<!-- DX_HOME_HERO_MOUNT_START -->
<link rel="stylesheet" href="/css/components/dx-home-hero.css">
<link rel="stylesheet" href="/css/components/dx-home-hero-composer.css">
<div id="dx-home-hero-root" data-dx-home-hero-root aria-live="polite">
  <div class="dx-home-featured-loading">Loading hero…</div>
</div>
<script src="/assets/js/dx-home-hero.js" defer></script>
<!-- DX_HOME_HERO_MOUNT_END -->`;

async function ensureParent(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function copy(source, target) {
  await ensureParent(target);
  await fs.copyFile(source, target);
}

function replaceCodeContainer(html, blockId, nextBlockClass, replacement) {
  const blockStart = html.indexOf(`id="${blockId}"`);
  if (blockStart < 0) throw new Error(`Homepage block not found: ${blockId}`);
  const containerStart = html.indexOf('class="dx-code-container"', blockStart);
  if (containerStart < 0) throw new Error(`Code container not found for ${blockId}`);
  const contentStart = html.indexOf('>', containerStart) + 1;
  const boundary = `</div>\n</div></div></div><div class="fe-block ${nextBlockClass}"`;
  const contentEnd = html.indexOf(boundary, contentStart);
  if (contentEnd < 0) throw new Error(`Code container boundary not found for ${blockId}`);
  return `${html.slice(0, contentStart)}\n  ${replacement}\n${html.slice(contentEnd)}`;
}

async function migrateHomepage() {
  let html = await fs.readFile(PATHS.homepage, 'utf8');
  html = replaceCodeContainer(
    html,
    'block-448bd8f915f4abba552b',
    'fe-block-22f4e234192109a5d76c',
    MOUNT_FRAGMENT,
  );
  html = replaceCodeContainer(
    html,
    'block-22f4e234192109a5d76c',
    'fe-block-yui_3_17_2_1_1756613895661_13758',
    '<!-- Legacy duplicate hero retired; managed by data/home.hero-library.json. -->',
  );
  await fs.writeFile(PATHS.homepage, html, 'utf8');
  await fs.writeFile(PATHS.component, `${MOUNT_FRAGMENT}\n`, 'utf8');
}

async function main() {
  const { library } = await readHomeHeroLibrary();
  const assetsOnly = process.argv.includes('--assets-only');
  if (!assetsOnly) await writeHomeHeroSnapshots(library, library.activeCompositionId);

  await ensureParent(PATHS.docsJs);
  await build({
    entryPoints: [PATHS.entry],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2019'],
    outfile: PATHS.docsJs,
    minify: true,
    sourcemap: false,
    legalComments: 'none',
  });
  for (const mirror of PATHS.jsMirrors) await copy(PATHS.docsJs, mirror);
  for (const mirror of PATHS.cssMirrors) await copy(PATHS.css, mirror);
  for (const mirror of PATHS.composerCssMirrors) await copy(PATHS.composerCss, mirror);
  await migrateHomepage();

  console.log(assetsOnly
    ? `home:hero:build refreshed runtime assets without preparing ${library.activeCompositionId}`
    : `home:hero:build prepared ${library.activeCompositionId}`);
  console.log(`home:hero:build wrote ${path.relative(ROOT, PATHS.docsJs)} and ${PATHS.jsMirrors.length} mirrors`);
}

main().catch((error) => {
  console.error(`home:hero:build failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
