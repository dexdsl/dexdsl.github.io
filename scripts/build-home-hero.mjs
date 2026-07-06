#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { readHomeHeroLibrary, writeHomeHeroSnapshots } from './lib/home-hero-store.mjs';
import { buildHomeHeroSnapshot } from './lib/home-hero-schema.mjs';
import { renderHomeHero } from './lib/home-hero-render.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');

const PATHS = {
  entry: path.join(ROOT, 'scripts', 'src', 'home.hero.entry.mjs'),
  css: path.join(ROOT, 'css', 'components', 'dx-home-hero.css'),
  composerCss: path.join(ROOT, 'css', 'components', 'dx-home-hero-composer.css'),
  featuredSnapshot: path.join(ROOT, 'data', 'home.featured.snapshot.json'),
  catalogEntries: path.join(ROOT, 'data', 'catalog.entries.json'),
  publicProfiles: path.join(ROOT, 'data', 'public-profiles.json'),
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

function serializeInlineJson(value) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

function buildMountFragment(snapshot, featuredData, catalogData, profilesData) {
  const hero = renderHomeHero(snapshot, { featuredData, catalogData, profilesData });
  return `<!-- DX_HOME_HERO_MOUNT_START -->
<div id="dx-home-hero-root" data-dx-home-hero-root data-dx-home-hero-ssr="true" data-composition-id="${snapshot.activeCompositionId}">
  ${hero}
</div>
<script type="application/json" data-dx-home-featured-data>${serializeInlineJson(featuredData)}</script>
<script src="/assets/js/dx-home-hero.js" defer></script>
<!-- DX_HOME_HERO_MOUNT_END -->`;
}

const HOME_SLOT_BOOTSTRAP = `<script data-dx-home-slot-bootstrap>
(() => {
  const header = document.getElementById('header');
  if (!(header instanceof HTMLElement) || !(document.body instanceof HTMLElement)) return;
  const container = header.parentElement || document.body;
  let scrollRoot = document.getElementById('dx-slot-scroll-root');
  if (!(scrollRoot instanceof HTMLElement)) {
    scrollRoot = document.createElement('div');
    scrollRoot.id = 'dx-slot-scroll-root';
    scrollRoot.setAttribute('data-dx-slot-root', 'true');
  }
  let foregroundRoot = document.getElementById('dx-slot-foreground-root');
  if (!(foregroundRoot instanceof HTMLElement)) {
    foregroundRoot = document.createElement('div');
    foregroundRoot.id = 'dx-slot-foreground-root';
    foregroundRoot.setAttribute('data-dx-slot-foreground', 'true');
  }
  if (!scrollRoot.contains(foregroundRoot)) scrollRoot.appendChild(foregroundRoot);
  if (scrollRoot.parentElement !== container) header.after(scrollRoot);
  const preservedIds = new Set(['gooey-mesh-wrapper', 'scroll-gradient-bg', 'dx-slot-scroll-root', 'dx-slot-foreground-root']);
  const preservedTags = new Set(['SCRIPT', 'STYLE', 'LINK', 'META']);
  let afterHeader = false;
  for (const node of Array.from(container.children)) {
    if (node === header) {
      afterHeader = true;
      continue;
    }
    if (!afterHeader || node === scrollRoot || node === foregroundRoot) continue;
    if (preservedIds.has(node.id || '') || preservedTags.has(node.tagName) || node.hasAttribute('data-dx-slot-preserve')) continue;
    foregroundRoot.appendChild(node);
  }
  document.body.classList.add('dx-slot-enabled');
})();
</script>`;

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

async function migrateHomepage(mountFragment) {
  let html = await fs.readFile(PATHS.homepage, 'utf8');
  html = html
    .replace(/\s*<link rel="stylesheet" href="\/css\/components\/dx-home-hero\.css">\s*/g, '\n')
    .replace(/\s*<link rel="stylesheet" href="\/css\/components\/dx-home-hero-composer\.css">\s*/g, '\n');
  const headAssets = [
    '<link rel="stylesheet" href="/css/components/dx-home-hero.css">',
    '<link rel="stylesheet" href="/css/components/dx-home-hero-composer.css">',
  ].join('\n');
  html = html.replace('</head>', `${headAssets}\n</head>`);
  html = replaceCodeContainer(
    html,
    'block-448bd8f915f4abba552b',
    'fe-block-22f4e234192109a5d76c',
    mountFragment,
  );
  html = replaceCodeContainer(
    html,
    'block-22f4e234192109a5d76c',
    'fe-block-yui_3_17_2_1_1756613895661_13758',
    '<!-- Legacy duplicate hero retired; managed by data/home.hero-library.json. -->',
  );
  html = html.replace(/\s*<script data-dx-home-slot-bootstrap>[\s\S]*?<\/script>\s*/g, '\n');
  html = html.replace('</body>', `${HOME_SLOT_BOOTSTRAP}\n</body>`);
  await fs.writeFile(PATHS.homepage, html, 'utf8');
  await fs.writeFile(PATHS.component, `${mountFragment}\n`, 'utf8');
}

export async function buildHomeHero({ assetsOnly = false } = {}) {
  const { library } = await readHomeHeroLibrary();
  const snapshot = assetsOnly
    ? buildHomeHeroSnapshot(library, library.activeCompositionId)
    : await writeHomeHeroSnapshots(library, library.activeCompositionId);
  const [featuredData, catalogData, profilesData] = await Promise.all([
    fs.readFile(PATHS.featuredSnapshot, 'utf8').then(JSON.parse),
    fs.readFile(PATHS.catalogEntries, 'utf8').then(JSON.parse),
    fs.readFile(PATHS.publicProfiles, 'utf8').then(JSON.parse),
  ]);
  const mountFragment = buildMountFragment(snapshot, featuredData, catalogData, profilesData);

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
  await migrateHomepage(mountFragment);

  console.log(assetsOnly
    ? `home:hero:build refreshed runtime assets without preparing ${library.activeCompositionId}`
    : `home:hero:build prepared ${library.activeCompositionId}`);
  console.log(`home:hero:build wrote ${path.relative(ROOT, PATHS.docsJs)} and ${PATHS.jsMirrors.length} mirrors`);
}

const isCli = Boolean(process.argv[1])
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  buildHomeHero({ assetsOnly: process.argv.includes('--assets-only') }).catch((error) => {
    console.error(`home:hero:build failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
