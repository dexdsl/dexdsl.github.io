#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const FILES = {
  html: path.join(ROOT, 'docs', 'u', 'index.html'),
  notFound: path.join(ROOT, 'docs', '404.html'),
  runtimeSource: path.join(ROOT, 'scripts', 'src', 'profile.public.entry.mjs'),
  runtimeBuilt: path.join(ROOT, 'public', 'assets', 'js', 'profile.public.js'),
  runtimeMirrorA: path.join(ROOT, 'assets', 'js', 'profile.public.js'),
  runtimeMirrorB: path.join(ROOT, 'docs', 'assets', 'js', 'profile.public.js'),
  cssSource: path.join(ROOT, 'css', 'components', 'dx-profile-public.css'),
  cssPublic: path.join(ROOT, 'public', 'css', 'components', 'dx-profile-public.css'),
  cssDocs: path.join(ROOT, 'docs', 'css', 'components', 'dx-profile-public.css'),
  publicProfilesData: path.join(ROOT, 'data', 'public-profiles.json'),
  publicProfilesPublic: path.join(ROOT, 'public', 'data', 'public-profiles.json'),
  publicProfilesDocs: path.join(ROOT, 'docs', 'data', 'public-profiles.json'),
  packageJson: path.join(ROOT, 'package.json'),
  sidebarRuntime: path.join(ROOT, 'public', 'assets', 'dex-sidebar.js'),
  protectedAuthContract: path.join(ROOT, 'scripts', 'verify_protected_auth_contract.mjs'),
};

const failures = [];

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    failures.push(`Missing file: ${path.relative(ROOT, filePath)}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function requireMarkers(label, text, markers) {
  for (const marker of markers) {
    if (!text.includes(marker)) failures.push(`${label} missing marker: ${marker}`);
  }
}

function verifyJsonMirror() {
  const raw = readText(FILES.publicProfilesData);
  const publicRaw = readText(FILES.publicProfilesPublic);
  const docsRaw = readText(FILES.publicProfilesDocs);
  if (raw && publicRaw && raw !== publicRaw) failures.push('public/data/public-profiles.json differs from data/public-profiles.json');
  if (raw && docsRaw && raw !== docsRaw) failures.push('docs/data/public-profiles.json differs from data/public-profiles.json');
  if (!raw) return;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    failures.push('data/public-profiles.json is not valid JSON');
    return;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    failures.push('data/public-profiles.json must contain an object');
    return;
  }
  if (!parsed.entries || typeof parsed.entries !== 'object' || Array.isArray(parsed.entries)) {
    failures.push('data/public-profiles.json must contain entries object');
  }
  if (!parsed.profiles || typeof parsed.profiles !== 'object' || Array.isArray(parsed.profiles)) {
    failures.push('data/public-profiles.json must contain profiles object');
  }
}

function main() {
  const html = readText(FILES.html);
  const notFound = readText(FILES.notFound);
  const source = readText(FILES.runtimeSource);
  const built = readText(FILES.runtimeBuilt);
  const mirrorA = readText(FILES.runtimeMirrorA);
  const mirrorB = readText(FILES.runtimeMirrorB);
  const cssSource = readText(FILES.cssSource);
  const cssPublic = readText(FILES.cssPublic);
  const cssDocs = readText(FILES.cssDocs);
  const pkg = readText(FILES.packageJson);
  const sidebar = readText(FILES.sidebarRuntime);
  const authContract = readText(FILES.protectedAuthContract);

  requireMarkers('docs/u/index.html', html, [
    'id="dex-profile"',
    'data-dx-fetch-state="loading"',
    '/css/components/dx-profile-public.css',
    '/assets/js/profile.public.js',
    // Account menu must mount on profile pages (and persist across SPA nav).
    '/assets/dex-auth.js',
    'member profile',
  ]);
  requireMarkers('docs/404.html', notFound, [
    'data-dx-profile-fallback',
    '/css/components/dx-profile-public.css',
    '/assets/js/profile.public.js',
    // Account menu must mount on the dynamic /u fallback too.
    '/assets/dex-auth.js',
    'id="dex-profile"',
    'member profile',
  ]);
  requireMarkers('profile public source', source, [
    'window.__dxProfilePublicLoaded',
    'GET /u route contract',
    '/data/catalog-performers.json',
    'favoriteRecordFromRef',
    'data-dx-copy',
  ]);
  requireMarkers('profile public css', cssSource, [
    '#dex-profile .dx-prof-shell',
    '#dex-profile .dx-prof-dexid',
    '#dex-profile .dx-prof-grid',
    '@media (max-width: 640px)',
  ]);
  requireMarkers('package.json', pkg, [
    '"profile-public:build"',
    '"verify:profile-public"',
  ]);
  requireMarkers('entry sidebar runtime', sidebar, [
    '/data/public-profiles.json',
    'enhancePublicProfileAttribution',
    'dx-public-profile-link',
  ]);
  if (authContract.includes("'/u'") || authContract.includes("'/u/'")) {
    failures.push('/u must not be listed as a protected route in protected-auth contract');
  }

  if (built && mirrorA && built !== mirrorA) failures.push('assets/js/profile.public.js differs from public built runtime');
  if (built && mirrorB && built !== mirrorB) failures.push('docs/assets/js/profile.public.js differs from public built runtime');
  if (cssSource && cssPublic && cssSource !== cssPublic) failures.push('public dx-profile-public.css differs from source css');
  if (cssSource && cssDocs && cssSource !== cssDocs) failures.push('docs dx-profile-public.css differs from source css');
  verifyJsonMirror();

  if (failures.length) {
    console.error(`verify:profile-public failed with ${failures.length} issue(s):`);
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }
  console.log('verify:profile-public passed.');
}

try {
  main();
} catch (error) {
  console.error(`verify:profile-public error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
