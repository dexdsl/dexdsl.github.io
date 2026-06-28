#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildHomeHeroSnapshot, normalizeHomeHeroLibrary } from './lib/home-hero-schema.mjs';
import { renderHomeHero } from './lib/home-hero-render.mjs';
import { writeHomeHeroLibrary } from './lib/home-hero-store.mjs';

const NOW = '2026-06-28T00:00:00.000Z';

function campaign(id = 'campaign-a') {
  return {
    id,
    name: 'Campaign',
    type: 'campaign',
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    headlineLines: ['OPEN ACCESS', 'FOR'],
    rotatingWords: ['EVERYONE.'],
    body: 'Free recordings.',
    primaryCta: { kind: 'link', label: 'Explore', href: '/catalog/' },
    secondaryCta: {
      kind: 'auth-switch',
      guestLabel: 'Sign up',
      authenticatedLabel: 'Submit',
      authenticatedHref: '/entry/submit/',
    },
  };
}

function featured(id = 'featured-a') {
  return {
    id,
    name: 'Featured',
    type: 'featured',
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    title: 'Featured entries',
    source: 'home-featured',
  };
}

function library(overrides = {}) {
  return {
    version: 'home-hero-library-v1',
    activeCompositionId: 'current',
    updatedAt: NOW,
    modules: [campaign(), featured()],
    compositions: [{
      id: 'current',
      name: 'Current',
      layout: 'split',
      slots: ['campaign-a', 'featured-a'],
      createdAt: NOW,
      updatedAt: NOW,
      archived: false,
    }],
    ...overrides,
  };
}

assert.equal(normalizeHomeHeroLibrary(library()).modules.length, 2);
const snapshot = buildHomeHeroSnapshot(library());
assert.equal(snapshot.modules.length, 2);
assert.equal(snapshot.sourceHash.length, 64);
assert.match(renderHomeHero(snapshot), /data-layout="split"/);
assert.match(renderHomeHero(snapshot), /data-module-type="campaign"/);
assert.match(renderHomeHero(snapshot), /data-module-type="featured"/);

assert.throws(() => normalizeHomeHeroLibrary(library({
  compositions: [{
    id: 'current',
    name: 'Broken',
    layout: 'single',
    slots: ['campaign-a', 'featured-a'],
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
  }],
})), /requires exactly 1 module slot/);

assert.throws(() => normalizeHomeHeroLibrary(library({
  compositions: [{
    id: 'current',
    name: 'Duplicate',
    layout: 'split',
    slots: ['campaign-a', 'campaign-a'],
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
  }],
})), /cannot use the same module twice/);

assert.throws(() => normalizeHomeHeroLibrary(library({
  modules: [campaign()],
})), /missing module/);

const unsafe = library();
unsafe.modules[0].primaryCta.href = 'javascript:alert(1)';
assert.throws(() => normalizeHomeHeroLibrary(unsafe), /CTA URLs/);

const temporary = path.join(os.tmpdir(), `home-hero-${process.pid}-${Date.now()}.json`);
await fs.writeFile(temporary, `${JSON.stringify(library(), null, 2)}\n`, 'utf8');
const beforeFailure = await fs.readFile(temporary, 'utf8');
const invalidWrite = library();
invalidWrite.compositions[0].slots = ['campaign-a', 'missing-module'];
await assert.rejects(() => writeHomeHeroLibrary(invalidWrite, temporary), /missing module/);
assert.equal(await fs.readFile(temporary, 'utf8'), beforeFailure, 'failed validation must not alter the canonical file');

const changedType = library();
changedType.modules[0] = featured('campaign-a');
changedType.compositions[0].slots = ['campaign-a', 'featured-a'];
await assert.rejects(() => writeHomeHeroLibrary(changedType, temporary), /type is immutable/);
await fs.unlink(temporary);

// --- Season 3 "Human Credits" module ---------------------------------------
function season3(id = 'season3') {
  return {
    id,
    name: 'Season 3',
    type: 'season3-human-credits',
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    kicker: 'DEX / SEASON 3',
    headline: 'SEASON 3 IS YOU.',
    body: 'Your work. Your name. Your place in the commons.',
    assembleWord: 'YOU',
    pipelineLabels: ['SUBMIT', 'IN CONVERSATION', 'SELECTED', 'IN THE LIBRARY', 'OPEN TO EVERYONE'],
    seedReleases: [
      { lookup: 'A.A. Aa AV2024 S1', name: 'One', role: 'Cello', href: '/entry/one/' },
      { lookup: 'B.B. Bb AV2024 S1', name: 'Two', href: '/entry/two/' },
      { lookup: 'C.C. Cc AV2024 S1', name: 'Three', href: '/entry/three/' },
      { lookup: 'D.D. Dd AV2024 S1', name: 'Four', href: '/entry/four/' },
    ],
    cta: {
      guest: { label: 'JOIN SEASON 3' },
      submit: { label: 'SUBMIT TO SEASON 3', href: '/entry/submit/' },
      active: { label: 'OPEN MY PIPELINE', href: '/account/' },
      published: { label: 'VIEW MY RELEASE', href: '/account/' },
    },
    profileCapacity: 24,
    profileFeed: '/profiles/public',
    presentation: { surface: 'graphite', density: 'balanced', motion: 'cinematic' },
  };
}

function season3Library(overrides = {}) {
  return {
    version: 'home-hero-library-v1',
    activeCompositionId: 's3',
    updatedAt: NOW,
    modules: [season3(), campaign(), featured()],
    compositions: [
      { id: 's3', name: 'S3', layout: 'single', slots: ['season3'], createdAt: NOW, updatedAt: NOW, archived: false },
      { id: 'current', name: 'Current', layout: 'split', slots: ['campaign-a', 'featured-a'], createdAt: NOW, updatedAt: NOW, archived: false },
    ],
    ...overrides,
  };
}

// Valid season3 module + single-slot composition normalizes and renders.
const s3Snapshot = buildHomeHeroSnapshot(season3Library());
assert.equal(s3Snapshot.modules.length, 1);
const s3Html = renderHomeHero(s3Snapshot);
assert.match(s3Html, /data-module-type="season3-human-credits"/);
assert.match(s3Html, /SEASON 3 IS YOU\./);
assert.match(s3Html, /data-cta-guest-label="JOIN SEASON 3"/);
assert.match(s3Html, /dx-s3-card--release/);
assert.match(s3Html, /dx-s3-card--opening/);
// Five pipeline steps render.
assert.equal((s3Html.match(/dx-s3-pipeline__step/g) || []).length, 5);

// Legacy split composition still validates alongside the season3 module (rollback).
const legacySnapshot = buildHomeHeroSnapshot(season3Library(), 'current');
assert.match(renderHomeHero(legacySnapshot), /data-module-type="campaign"/);

// Pipeline must have exactly five labels.
assert.throws(() => normalizeHomeHeroLibrary(season3Library({
  modules: [{ ...season3(), pipelineLabels: ['ONE', 'TWO'] }, campaign(), featured()],
})), /pipelineLabels|array/i);

// Seed release hrefs are safety-checked.
const unsafeSeed = season3Library();
unsafeSeed.modules[0].seedReleases[0].href = 'javascript:alert(1)';
assert.throws(() => normalizeHomeHeroLibrary(unsafeSeed), /root-relative or HTTPS|CTA URLs/);

// Presentation presets are constrained to the curated enums.
assert.throws(() => normalizeHomeHeroLibrary(season3Library({
  modules: [{ ...season3(), presentation: { surface: 'neon', density: 'balanced', motion: 'cinematic' } }, campaign(), featured()],
})), /Invalid|surface/i);

console.log('test:home-hero passed.');
