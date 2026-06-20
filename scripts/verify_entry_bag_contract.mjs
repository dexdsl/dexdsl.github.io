#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

function fail(message) {
  throw new Error(message);
}

async function read(relativePath) {
  const absolute = path.resolve(relativePath);
  return fs.readFile(absolute, 'utf8');
}

function ensureBagRouteHtml(routeHtml) {
  const required = [
    '<div id="dex-bag"',
    '/assets/js/dx-bag.js',
    '/assets/js/bag.app.js',
    '/assets/dex-auth.js',
    '/assets/js/header-slot.js',
  ];
  for (const marker of required) {
    if (!routeHtml.includes(marker)) {
      fail(`bag route missing marker: ${marker}`);
    }
  }
  if (routeHtml.includes('dx-route-profile-protected')) {
    fail('bag route HTML must not include page-wide protected route class');
  }
}

function ensureBagRuntimeSource(runtimeSource) {
  const required = [
    'window.__dxBag',
    'dex:bag:v1:',
    'normalizeSelections',
    'mergeAnonIntoScope',
    "const BAG_KINDS = new Set(['collection', 'bucket', 'type', 'file'])",
  ];
  for (const marker of required) {
    if (!runtimeSource.includes(marker)) {
      fail(`bag runtime source missing marker: ${marker}`);
    }
  }
}

function ensureBagAppSource(appSource) {
  const required = [
    'DOWNLOAD BAG',
    '/me/assets/bag/bundle',
    '/me/assets/bundle/',
    'BUNDLE_JOB_MAX_POLLS',
    'shouldFallbackToLookupBundles',
    'formatBundlePollStatus',
    'Merged bundle is still preparing. Retrying via lookup bundles',
    'dex:bag:resume:v1',
    'Signed in as',
    "auth.signIn(BAG_ROUTE_PATH)",
    "ensureAuthForAction({ action: 'download' })",
    'dx-bag-layout',
    'dx-bag-receipt-toggle',
    'estimateBytesFromLookupFiles',
    'estimateBytesFromSelectionRows',
    'countFilesFromSelectionRows',
  ];
  for (const marker of required) {
    if (!appSource.includes(marker)) {
      fail(`bag app source missing marker: ${marker}`);
    }
  }
  const forbidden = [
    'Public fallback mode. Sign in to resolve protected files and download.',
    'Local preview mode: bag is viewable without auth; secure downloads stay protected.',
    '~${fileCount} files',
  ];
  for (const marker of forbidden) {
    if (appSource.includes(marker)) {
      fail(`bag app source contains forbidden fallback marker: ${marker}`);
    }
  }
  if (appSource.includes('PROFILE_PROTECTED_ROUTE_CLASS')
    || appSource.includes("'dx-route-profile-protected'")
    || appSource.includes('"dx-route-profile-protected"')) {
    fail('bag app source must not self-apply dx-route-profile-protected');
  }
}

function ensureSidebarUnifiedDownload(runtimeJs) {
  const required = [
    'attachUnifiedDownload',
    "class=\"btn-download dx-button-element--primary\"",
    '/me/assets/bag/bundle',
    'addToBagButton',
    "downloadNowButton.textContent = 'DOWNLOAD NOW'",
    "const BAG_ROUTE_PATH = '/entry/bag/'",
    "randomizeTitleWithJoiners('Get Files'",
  ];
  for (const marker of required) {
    if (!runtimeJs.includes(marker)) {
      fail(`sidebar runtime missing bag marker: ${marker}`);
    }
  }
  const forbidden = [
    'Go to Bag',
    'Keep Browsing',
    'Per-file selection unavailable. Using bucket-level selection.',
  ];
  for (const marker of forbidden) {
    if (runtimeJs.includes(marker)) {
      fail(`sidebar runtime contains removed marker: ${marker}`);
    }
  }
}

function ensureProtectedAuthContract(authJs, headerSlotJs) {
  if (authJs.includes('"/entry/bag": true')) {
    fail('dex-auth protected paths must not include /entry/bag');
  }
  const protectedRoutesStart = headerSlotJs.indexOf('const PROFILE_PROTECTED_ROUTES = new Set(');
  const protectedRoutesEnd = protectedRoutesStart >= 0 ? headerSlotJs.indexOf(']);', protectedRoutesStart) : -1;
  const protectedBlock = protectedRoutesStart >= 0 && protectedRoutesEnd >= 0
    ? headerSlotJs.slice(protectedRoutesStart, protectedRoutesEnd)
    : '';
  const meshRoutesStart = headerSlotJs.indexOf('const PROFILE_SHOW_MESH_ROUTES = new Set(');
  const meshRoutesEnd = meshRoutesStart >= 0 ? headerSlotJs.indexOf(']);', meshRoutesStart) : -1;
  const meshBlock = meshRoutesStart >= 0 && meshRoutesEnd >= 0
    ? headerSlotJs.slice(meshRoutesStart, meshRoutesEnd)
    : '';
  if (protectedBlock.includes("'/entry/bag'")) {
    fail('header-slot protected route set must not include /entry/bag');
  }
  if (!meshBlock.includes("'/entry/bag'")) {
    fail('header-slot mesh route set must include /entry/bag');
  }
}

async function main() {
  const [
    bagRouteHtml,
    bagRuntimeSource,
    bagAppSource,
    sidebarRuntime,
    authJs,
    headerSlotJs,
  ] = await Promise.all([
    read('docs/entry/bag/index.html'),
    read('scripts/src/bag.runtime.entry.mjs'),
    read('scripts/src/bag.app.entry.mjs'),
    read('assets/dex-sidebar.js'),
    read('assets/dex-auth.js'),
    read('assets/js/header-slot.js'),
  ]);

  ensureBagRouteHtml(bagRouteHtml);
  ensureBagRuntimeSource(bagRuntimeSource);
  ensureBagAppSource(bagAppSource);
  ensureSidebarUnifiedDownload(sidebarRuntime);
  ensureProtectedAuthContract(authJs, headerSlotJs);
  console.log('verify:entry-bag-contract passed');
}

main().catch((error) => {
  console.error(`verify:entry-bag-contract failed: ${error.message || String(error)}`);
  process.exit(1);
});
