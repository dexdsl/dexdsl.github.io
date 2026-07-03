#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizeHomeHeroLibrary, computeHomeHeroSourceHash, buildHomeHeroSnapshot } from './lib/home-hero-schema.mjs';
import { renderHomeHero } from './lib/home-hero-render.mjs';

const ROOT = process.cwd();
const rel = (...parts) => path.join(ROOT, ...parts);

async function readJson(...parts) {
  return JSON.parse(await fs.readFile(rel(...parts), 'utf8'));
}

async function readText(...parts) {
  return fs.readFile(rel(...parts), 'utf8');
}

async function main() {
  const library = normalizeHomeHeroLibrary(await readJson('data', 'home.hero-library.json'));
  const source = await readJson('data', 'home.hero.snapshot.json');
  const docs = await readJson('docs', 'data', 'home.hero.snapshot.json');
  const publicCopy = await readJson('docs', 'data', 'home.hero.snapshot.json');
  assert.deepEqual(source, docs, 'docs hero snapshot must mirror data');
  assert.deepEqual(source, publicCopy, 'public hero snapshot must mirror data');
  assert.equal(source.sourceHash, computeHomeHeroSourceHash(library), 'hero snapshot is stale; run npm run home:hero:build');
  assert.equal(source.activeCompositionId, library.activeCompositionId);
  assert.equal(source.modules.length, source.composition.slots.length);
  // The retained legacy composition must still render its production-compatible
  // markup so rollback stays safe even while a newer composition is active.
  const rollbackComposition = library.compositions.find((item) => (
    item.id !== library.activeCompositionId && !item.archived
      && item.slots.every((slotId) => {
        const module = library.modules.find((m) => m.id === slotId);
        return module && (module.type === 'campaign' || module.type === 'featured' || module.type === 'promo');
      })
  ));
  assert.ok(rollbackComposition, 'a non-active legacy composition must be retained for rollback');
  const legacyRendered = renderHomeHero(buildHomeHeroSnapshot(library, rollbackComposition.id));
  for (const marker of [
    'id="dexCombined"',
    'id="dexHeroSide"',
    'id="dexHeroCard"',
    'id="heroExplore"',
    'id="dx-hero-cta"',
    'id="dexFeaturedSide"',
    'id="carousel-frame"',
    'id="carousel-indicators"',
    'dx-button-element--primary',
    'dx-button-element--secondary',
  ]) {
    assert.ok(legacyRendered.includes(marker), `rollback hero missing production compatibility marker: ${marker}`);
  }

  // The Season 3 composition remains renderable regardless of which saved
  // composition is currently active in the builder.
  const season3Module = library.modules.find((item) => item.type === 'season3-human-credits' && !item.archived);
  assert.ok(season3Module, 'a non-archived Season 3 module must be retained');
  const season3Composition = library.compositions.find((item) => (
    !item.archived && item.slots.length === 1 && item.slots[0] === season3Module.id
  ));
  assert.ok(season3Composition, 'a non-archived Season 3 composition must be retained');
  const rendered = renderHomeHero(buildHomeHeroSnapshot(library, season3Composition.id));
  for (const marker of [
    'data-module-type="season3-human-credits"',
    'dx-s3__stage',
    'dx-s3-pipeline',
    'data-dx-s3-cta',
    'data-dx-s3-field',
    'dx-s3-card--release',
  ]) {
    assert.ok(rendered.includes(marker), `rendered hero missing Season 3 marker: ${marker}`);
  }

  const homepage = await readText('docs', 'index.html');
  assert.equal((homepage.match(/data-dx-home-hero-root/g) || []).length, 1, 'homepage must have exactly one hero mount');
  assert.equal((homepage.match(/id="dexCombined"/g) || []).length, 0, 'legacy duplicated hero remains in homepage');
  assert.match(homepage, /\/css\/components\/dx-home-hero\.css/);
  assert.match(homepage, /\/css\/components\/dx-home-hero-composer\.css/);
  assert.match(homepage, /\/assets\/js\/dx-home-hero\.js/);

  const component = await readText('components', 'home', 'hero.js');
  assert.match(component, /DX_HOME_HERO_MOUNT_START/);

  const runtimeSource = await readText('scripts', 'src', 'home.hero.entry.mjs');
  for (const marker of [
    'dxPageNav.create',
    'upgradeLegacyArrow',
    "duration: 160",
    "duration: 220",
    "className = 'carousel-nav prev'",
    "className = 'carousel-nav next'",
  ]) {
    assert.ok(runtimeSource.includes(marker), `hero runtime missing production interaction marker: ${marker}`);
  }

  const jsCopies = await Promise.all([
    readText('assets', 'js', 'dx-home-hero.js'),
    readText('docs', 'assets', 'js', 'dx-home-hero.js'),
    readText('docs', 'assets', 'js', 'dx-home-hero.js'),
  ]);
  assert.ok(jsCopies[0].length > 1000, 'hero runtime bundle is unexpectedly empty');
  assert.ok(jsCopies.every((value) => value === jsCopies[0]), 'hero runtime mirrors differ');

  const cssCopies = await Promise.all([
    readText('css', 'components', 'dx-home-hero.css'),
    readText('docs', 'css', 'components', 'dx-home-hero.css'),
    readText('docs', 'css', 'components', 'dx-home-hero.css'),
  ]);
  assert.ok(cssCopies.every((value) => value === cssCopies[0]), 'hero CSS mirrors differ');
  const composerCopies = await Promise.all([
    readText('css', 'components', 'dx-home-hero-composer.css'),
    readText('docs', 'css', 'components', 'dx-home-hero-composer.css'),
    readText('docs', 'css', 'components', 'dx-home-hero-composer.css'),
  ]);
  assert.ok(composerCopies.every((value) => value === composerCopies[0]), 'hero composer CSS mirrors differ');
  console.log(`verify:home-hero passed (${library.modules.length} modules, ${library.compositions.length} compositions).`);
}

main().catch((error) => {
  console.error(`verify:home-hero failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
