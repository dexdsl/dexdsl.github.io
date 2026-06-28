#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {
  checkMembershipPriceConsistency,
  parseDefaultTiers,
} from './lib/membership-price-consistency.mjs';

const ROOT = process.cwd();
const MAP_PATH = path.join(ROOT, 'data', 'stripe-membership-products.json');
const RUNTIME_PATH = path.join(ROOT, 'scripts', 'src', 'settings.membership.entry.mjs');

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

const realMap = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
const realDefaultTiers = parseDefaultTiers(fs.readFileSync(RUNTIME_PATH, 'utf8'));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('real shipped data is fully consistent', () => {
  const failures = checkMembershipPriceConsistency({ map: realMap, defaultTiers: realDefaultTiers });
  assert.deepEqual(failures, [], `expected no failures, got:\n${failures.join('\n')}`);
});

test('parseDefaultTiers reads the live displayed prices', () => {
  assert.equal(realDefaultTiers.S.month, 6.99);
  assert.equal(realDefaultTiers.L.year, 249.99);
});

test('detects an amount that drifts from the displayed price', () => {
  const map = clone(realMap);
  map.production.S.month.amount = 5.99; // displayed price is 6.99
  const failures = checkMembershipPriceConsistency({ map, defaultTiers: realDefaultTiers });
  assert.ok(
    failures.some((f) => f.includes('production.S.month') && f.includes('does not match displayed price')),
    `expected a displayed-price mismatch, got:\n${failures.join('\n')}`,
  );
});

test('detects production/test environment price divergence', () => {
  const map = clone(realMap);
  map.test.M.year.amount = 199.99; // production stays 149.99
  const failures = checkMembershipPriceConsistency({ map, defaultTiers: realDefaultTiers });
  assert.ok(
    failures.some((f) => f.includes('M.year') && f.includes('differs across environments')),
    `expected a cross-environment divergence, got:\n${failures.join('\n')}`,
  );
});

test('detects a duplicated priceId (copy/paste error)', () => {
  const map = clone(realMap);
  map.production.L.year.priceId = map.production.L.month.priceId;
  const failures = checkMembershipPriceConsistency({ map, defaultTiers: realDefaultTiers });
  assert.ok(
    failures.some((f) => f.includes('duplicate priceId')),
    `expected a duplicate priceId failure, got:\n${failures.join('\n')}`,
  );
});

test('detects a missing tier node', () => {
  const map = clone(realMap);
  delete map.production.M.month;
  const failures = checkMembershipPriceConsistency({ map, defaultTiers: realDefaultTiers });
  assert.ok(
    failures.some((f) => f.includes('production.M.month') && f.includes('missing')),
    `expected a missing-node failure, got:\n${failures.join('\n')}`,
  );
});

let failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`fail  ${name}`);
    console.error(`      ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed > 0) {
  console.error(`\ntest:membership-price failed: ${failed} of ${tests.length} test(s) failed.`);
  process.exit(1);
}
console.log(`\ntest:membership-price passed: ${tests.length} tests.`);
