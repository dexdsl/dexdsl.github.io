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
  profileAdminApi,
  settingsRuntime,
  packageJson,
] = await Promise.all([
  read('scripts/dex.mjs'),
  read('scripts/lib/profile-admin-api.mjs'),
  read('scripts/src/settings.profile.entry.mjs'),
  read('package.json'),
]);

assert.match(dexCli, /firstNonFlag === 'profiles'/, 'dex CLI must parse profiles as a direct command');
assert.match(dexCli, /async function runProfilesCommand/, 'dex CLI must implement profiles command runner');
assert.match(dexCli, /topLevel\.command === 'profiles'[\s\S]+runProfilesCommand\(topLevel\.rest\)/, 'dex CLI must dispatch profiles commands');
assert.match(dexCli, /dex profiles claims/, 'dex profiles usage must include claims');
assert.match(dexCli, /dex profiles approve/, 'dex profiles usage must include approve');
assert.match(dexCli, /dex profiles reject/, 'dex profiles usage must include reject');
assert.match(dexCli, /dex profiles map sync/, 'dex profiles usage must include map sync');

assert.match(profileAdminApi, /DEX_PROFILES_ADMIN_TOKEN/, 'profiles admin API client must support admin token env');
assert.match(profileAdminApi, /\/admin\/profiles\/claims/, 'profiles admin API client must call claims endpoint');
assert.match(profileAdminApi, /\/admin\/profiles\/public-map/, 'profiles admin API client must call public-map endpoint');
assert.match(profileAdminApi, /writePublicProfilesMap/, 'profiles admin API client must write public profile maps');
assert.match(profileAdminApi, /docs\/data\/public-profiles\.json/, 'map sync must mirror docs data');
assert.match(profileAdminApi, /public\/data\/public-profiles\.json/, 'map sync must mirror public data');

assert.match(settingsRuntime, /payload\?\.status\) === 'approved'/, 'settings must only add claimed contributions after approved status');
assert.match(settingsRuntime, /Private until visible is enabled\./, 'settings must show private URL copy when visibility is off');
assert.match(settingsRuntime, /publicProfilePath/, 'settings must separate profile path from public URL visibility');
assert.match(settingsRuntime, /copyUrl\.disabled = !visible/, 'settings must disable public URL copying while private');

const pkg = JSON.parse(packageJson);
assert.equal(pkg.scripts?.['test:dex-profiles-cli'], 'node scripts/test-dex-profiles-cli.mjs');

console.log('test:dex-profiles-cli passed.');
