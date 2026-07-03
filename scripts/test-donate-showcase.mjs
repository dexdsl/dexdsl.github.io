#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  normalizeDonationShowcaseEntry,
  selectDonationShowcaseEntries,
} from './lib/donate-showcase.mjs';

function entry(overrides = {}) {
  return {
    id: 'prepared-oboe',
    status: 'active',
    title_raw: 'PREPARED OBOE',
    performer_raw: 'Sky Macklay',
    lookup_raw: 'W.Ob. Ma AV2024 S2',
    season: 'S2',
    instrument_labels: ['Prepared Oboe'],
    entry_href: '/entry/prepared-oboe/',
    image_src: '/assets/catalog/prepared-oboe.webp',
    kind: 'catalog',
    ...overrides,
  };
}

assert.equal(normalizeDonationShowcaseEntry(entry())?.href, '/entry/prepared-oboe/');
assert.equal(normalizeDonationShowcaseEntry(entry({ status: 'draft' })), null);
assert.equal(normalizeDonationShowcaseEntry(entry({ entry_href: 'javascript:alert(1)' })), null);
assert.equal(normalizeDonationShowcaseEntry(entry({ image_src: 'http://insecure.example/image.jpg' })), null);

const payload = {
  entries: [
    entry(),
    entry({
      id: 'prepared-oboe-duplicate',
      entry_href: '/entry/prepared-oboe-duplicate/',
    }),
    entry({
      id: 'amplified-printer',
      title_raw: 'AMPLIFIED PRINTER',
      performer_raw: 'Cameron Church',
      lookup_raw: 'X.Prt. Ch AV2024 S2',
      instrument_labels: ['Amplified Printer'],
      entry_href: '/entry/amplified-printer/',
      image_src: '/assets/catalog/amplified-printer.webp',
    }),
    entry({
      id: 'cello',
      title_raw: 'CELLO',
      performer_raw: 'Emmanuel Losa',
      lookup_raw: 'S.Vlc. Lo AV2023 S1',
      season: 'S1',
      instrument_labels: ['Cello'],
      entry_href: '/entry/cello/',
      image_src: 'https://images.example/cello.jpg',
    }),
    entry({
      id: 'draft',
      status: 'draft',
      entry_href: '/entry/draft/',
    }),
  ],
};

const sequence = [0.11, 0.83, 0.42, 0.67, 0.25];
let sequenceIndex = 0;
const selected = selectDonationShowcaseEntries(payload, {
  count: 3,
  random: () => sequence[sequenceIndex++ % sequence.length],
});

assert.equal(selected.length, 3);
assert.equal(new Set(selected.map((item) => item.id)).size, 3);
assert.equal(new Set(selected.map((item) => item.performer)).size, 3);
assert.equal(new Set(selected.map((item) => item.instrument)).size, 3);
assert.deepEqual(new Set(selected.map((item) => item.season)), new Set(['S1', 'S2']));

console.log('test:donate-showcase passed.');
