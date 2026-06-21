#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

async function read(relPath) {
  return fs.readFile(path.join(ROOT, relPath), 'utf8');
}

const [
  dexCli,
  opsAdminApi,
  pollsAdminApi,
  dashboard,
  packageJson,
] = await Promise.all([
  read('scripts/dex.mjs'),
  read('scripts/lib/ops-admin-api.mjs'),
  read('scripts/lib/polls-admin-api.mjs'),
  read('scripts/ui/dashboard.mjs'),
  read('package.json'),
]);

for (const command of ['ops', 'submissions', 'press', 'board', 'support']) {
  assert.match(dexCli, new RegExp(`topLevel\\.command === '${command}'`), `dex CLI must dispatch ${command}`);
}

assert.match(dexCli, /async function runOpsCommand/, 'dex CLI must implement ops command runner');
assert.match(dexCli, /dex ops import sheets --kind submissions\|press\|polls\|board/, 'ops usage must document Sheets import migration');
assert.match(dexCli, /patchOpsTicket/, 'ops CLI must support staff advancement');
assert.match(dexCli, /replyOpsTicket/, 'ops CLI must support staff replies');
assert.match(dexCli, /importOpsRows/, 'ops CLI must support idempotent imports');

assert.match(opsAdminApi, /DEX_OPS_ADMIN_TOKEN/, 'ops admin API client must support DEX_OPS_ADMIN_TOKEN');
assert.match(opsAdminApi, /\/admin\/ops\/tickets/, 'ops admin API client must call tickets endpoint');
assert.match(opsAdminApi, /\/admin\/ops\/import/, 'ops admin API client must call import endpoint');
assert.match(opsAdminApi, /\/messages/, 'ops admin API client must call message endpoint');

assert.match(pollsAdminApi, /\/admin\/polls/, 'polls admin API client must call poll CRUD endpoints');
assert.match(pollsAdminApi, /createAdminPollDefinition/, 'polls admin API client must create polls');
assert.match(pollsAdminApi, /setAdminPollDefinitionStatus/, 'polls admin API client must open and close polls');
assert.match(pollsAdminApi, /DEX_OPS_ADMIN_TOKEN/, 'polls admin API client must accept shared ops admin token');

assert.match(dashboard, /OpsManager/, 'dashboard must expose ops desk manager');
assert.match(dashboard, /id: 'ops'/, 'dashboard menu must include ops mode');

const pkg = JSON.parse(packageJson);
assert.equal(pkg.scripts?.['test:dex-ops-cli'], 'node scripts/test-dex-ops-cli.mjs');

console.log('test:dex-ops-cli passed.');
