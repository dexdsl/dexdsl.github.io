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

async function ensureFileExists(relativePath) {
  const absolute = path.resolve(relativePath);
  try {
    await fs.access(absolute);
  } catch {
    fail(`missing required series asset: ${relativePath}`);
  }
}

function ensureOrderedSections(html) {
  const overviewIdx = html.indexOf('<section class="dex-overview"></section>');
  const collectionsIdx = html.indexOf('<section class="dex-collections"></section>');
  const licenseIdx = html.indexOf('<section class="dex-license"></section>');
  if (overviewIdx < 0) fail('entry-template missing .dex-overview section');
  if (collectionsIdx < 0) fail('entry-template missing .dex-collections section');
  if (licenseIdx < 0) fail('entry-template missing .dex-license section');
  if (!(overviewIdx < collectionsIdx && collectionsIdx < licenseIdx)) {
    fail('entry-template sidebar sections must be ordered overview -> collections -> license');
  }
}

function ensureRecordingIndexSecondary(templateCss) {
  const primaryBlockRx = /\.dex-sidebar\s+\.dex-license-controls\s+\.copy-btn,[\s\S]*?\.dex-sidebar\s+#downloads\s+\.btn-video\s*\{[\s\S]*?\}/i;
  const match = templateCss.match(primaryBlockRx);
  if (!match) fail('template CSS missing primary CTA block for license/download buttons');
  if (/btn-recording-index/i.test(match[0])) {
    fail('template primary CTA selector must not include .btn-recording-index');
  }
  if (!/\.dex-sidebar\s+#downloads\s+\.btn-recording-index\s*\{/i.test(templateCss)) {
    fail('template CSS missing explicit secondary style block for .btn-recording-index');
  }
}

function ensureRuntimeMarkers(runtimeJs) {
  const required = [
    'buildDownloadRows',
    'getDownloadModalConfig',
    'Download selected',
    'data-person-linkable="true"',
    'bindEntryTooltips',
    'AUDIO_DISPLAY_EXTENSIONS',
    'filenameWithDisplayExtension',
    'COLLECTION',
    'COLLECTION_HEADING_CANONICAL',
    'randomizeTitle(COLLECTION_HEADING_CANONICAL',
    '.dex-collections',
    'data-dx-tooltip-status=',
    'data-dx-tooltip-file-types=',
    'data-dx-tooltip-video-quality=',
    'data-dx-tooltip-audio-mp3=',
    'data-dx-tooltip-audio-wav=',
    'data-dx-tooltip-video-1080p=',
    'data-dx-tooltip-video-4k=',
    'data-dx-tooltip-video-1080p-available=',
    'data-dx-tooltip-video-4k-available=',
    'data-dx-tooltip-total-files=',
    'buildEntryTooltipMarkup',
    'dx-submit-tooltip-status',
    'class="btn-download dx-button-element--primary"',
    'INTERACTIVE_HOVER_RUNTIME_PATH',
    'ensureInteractiveHoverRuntime(origin)',
    'attachUnifiedDownload(cfg, \'#downloads .btn-download\'',
    'data-dx-download-kind="recording-index-pdf"',
    'resolveDownloadAuthState',
    'signInForDownloadAction',
    'Sign in required for download.',
    'Unable to start sign-in flow.',
    'data-dx-entry-rail-mode',
    'DX_ENTRY_TARGET_TIMEOUT_MS = 15000',
    'ENTRY_FETCH_TARGET_SPECS',
    'markAllEntryFetchTargets',
    'bindHeaderFetchLifecycle',
    'bindDescriptionFetchLifecycle',
    'bindMediaFetchLifecycle',
    'data-dx-entry-fetch-target',
    'TOOLTIP_FETCH_SHELL_MARKER',
    'setTooltipFetchState(layer, FETCH_STATE_LOADING)',
    'activateFavoritesApi(getFavoritesApi())',
    'favoritesHydrationPromise',
    "record.key !== 'layout'",
    'entryTargetAlreadyReady',
    'DOWNLOAD_TREE_STYLE_ID',
    'ENTRY_RUNTIME_CSS_PATH',
    'hasStaticEntryRuntimeStyles',
    'dx-file-tree-wrap',
    'dx-file-folder-stack',
    'dx-file-bucket-tabs',
    'dx-file-bucket-tab-label',
    'data-dx-bucket-tab',
    'dx-file-tree-panel',
    'WHOLE FILES',
    'root: sidebar instanceof HTMLElement ? sidebar : null',
    "section.style.opacity = '1'",
    'readEmbeddedFileCount',
    'groupedFiles',
    'saturate(180%) blur(18px)',
    'margin-bottom: var(--dx-entry-footer-gap',
    '.dex-entry-subtitle-item--meta',
    'body.dx-entry-page #page',
    'ensureSidebarScrollAffordance',
    'data-dx-scrollable',
    'scrollbar-width: none',
    'position: fixed !important',
    'grid-template-columns: repeat(6, minmax(0, 1fr))',
    "lookup.style.removeProperty('font-size')",
    "lookup.style.setProperty('overflow', 'visible', 'important')",
    "lookup.style.setProperty('text-overflow', 'clip', 'important')",
    "lookup.dataset.dxOverflowFit = 'true'",
    'measuredWidth > availableWidth + 0.5',
  ];
  for (const marker of required) {
    if (!runtimeJs.includes(marker)) {
      fail(`runtime missing marker: ${marker}`);
    }
  }
}

function ensurePublicEntryChromeContract(runtimeJs) {
  if (/classList\.add\([^)]*['"]dx-route-profile-protected['"]/s.test(runtimeJs)
    || /classList\.add\([^)]*['"]dx-route-show-mesh['"]/s.test(runtimeJs)) {
    fail('entry sidebar runtime must not self-apply profile protected or profile mesh route classes');
  }
}

function ensureCollectionHeadingLigatureContract(dexCss) {
  const headingRule = /body\.dx-entry-page\s+\.dex-collections\s*>\s*h3\[data-dx-entry-heading(?:="1")?\][\s\S]*?\{([\s\S]*?)\}/i.exec(dexCss);
  if (!headingRule) {
    fail('dex.css missing body.dx-entry-page .dex-collections > h3[data-dx-entry-heading] rule');
  }
  const ruleBody = headingRule[1];
  if (/font-variant-ligatures\s*:\s*none/i.test(ruleBody)) {
    fail('collection heading rule must not disable ligatures');
  }
  if (/font-feature-settings\s*:\s*"liga"\s*0/i.test(ruleBody)) {
    fail('collection heading rule must not disable liga/calt');
  }
  if (!/font-variant-ligatures\s*:\s*common-ligatures/i.test(ruleBody)) {
    fail('collection heading rule missing ligature-enabled declaration');
  }
}

function ensureTooltipCssContract(dexCss) {
  const legacyPseudoTooltipRx = /dx-bucket-tile\[data-dx-tooltip\]:(?:hover|focus-visible)::after/i;
  if (legacyPseudoTooltipRx.test(dexCss)) {
    fail('dex.css still contains legacy pseudo-element tooltip renderer for bucket tiles');
  }
  const requiredMarkers = [
    '#dx-submit-tooltip-layer .dx-submit-tooltip-head',
    '#dx-submit-tooltip-layer[data-dx-fetch-state="loading"]',
    '#dx-submit-tooltip-layer .dx-fetch-shell-overlay[data-dx-tooltip-fetch-shell="1"]',
    '.dx-submit-tooltip-status.is-available',
    '.dx-submit-tooltip-metric dt',
    '.overview-item--buckets',
  ];
  for (const marker of requiredMarkers) {
    if (!dexCss.includes(marker)) {
      fail(`dex.css missing tooltip polish marker: ${marker}`);
    }
  }
}

function ensureLookupNumberFitCssContract(dexCss) {
  const lookupRule = /body\.dx-entry-page\s+\.dex-overview\s+\.overview-lookup\s*\{([\s\S]*?)\}/gi;
  const matches = Array.from(dexCss.matchAll(lookupRule));
  if (!matches.length) {
    fail('dex.css missing entry overview lookup rule');
  }
  const finalRuleBody = matches[matches.length - 1][1];
  if (!/overflow\s*:\s*visible\s*!important/i.test(finalRuleBody)) {
    fail('entry overview lookup must remain visible rather than clip');
  }
  if (!/text-overflow\s*:\s*clip\s*!important/i.test(finalRuleBody)) {
    fail('entry overview lookup must not render an ellipsis');
  }
  if (/text-overflow\s*:\s*ellipsis/i.test(finalRuleBody)) {
    fail('entry overview lookup final rule must not truncate with ellipsis');
  }
}

function ensureCompilerMarkers(entryHtmlSource) {
  const required = [
    'linksByPerson',
    'instrumentLinksEnabled',
    'normalizeLinksByPerson',
    'titleRegion.content === nextTitleRegion',
  ];
  for (const marker of required) {
    if (!entryHtmlSource.includes(marker)) {
      fail(`entry HTML compiler missing marker: ${marker}`);
    }
  }
}

async function ensureGeneratedEntryRouteContract() {
  const catalog = JSON.parse(await read('data/catalog.entries.json'));
  const s1Slugs = (Array.isArray(catalog?.entries) ? catalog.entries : [])
    .filter((entry) => String(entry?.season || '').toUpperCase() === 'S1')
    .map((entry) => String(entry?.id || '').trim())
    .filter(Boolean);
  const requiredSlugs = Array.from(new Set([...s1Slugs, 'tim-feeney', 'prepared-oboe-sky-macklay']));
  if (!s1Slugs.length) fail('catalog.entries.json must include S1 entries for generated route contract');

  for (const slug of requiredSlugs) {
    const routePath = `docs/entry/${slug}/index.html`;
    const html = await read(routePath);
    if (/Dex — Protected \(Dev Stub\)|Protected Area \(Dev\)/.test(html)) {
      fail(`${routePath} must not be a protected dev stub`);
    }
    if (html.includes('https://dexdsl.org/test')) {
      fail(`${routePath} must not use stale test-page canonical metadata`);
    }
    if (/ajax\.googleapis\.com\/ajax\/libs\/jquery|sparkplugin\.com/i.test(html)) {
      fail(`${routePath} must not carry stale legacy Squarespace script chrome`);
    }
    const requiredMarkers = [
      'class="dex-entry-layout"',
      'id="dex-sidebar-page-config"',
      '/assets/js/header-slot.js',
      '/assets/dex-sidebar.js',
      '/css/components/dx-entry-runtime.css',
    ];
    for (const marker of requiredMarkers) {
      if (!html.includes(marker)) {
        fail(`${routePath} missing generated entry chrome marker: ${marker}`);
      }
    }
  }

  const skyRoutePath = 'docs/entry/prepared-oboe-sky-macklay/index.html';
  const skySourcePath = 'entries/prepared-oboe-sky-macklay/index.html';
  const [skyHtml, skySourceHtml] = await Promise.all([
    read(skyRoutePath),
    read(skySourcePath),
  ]);
  if (/id="spark-app"|<header data-test="header"/i.test(skyHtml)) {
    fail(`${skyRoutePath} must preserve the production route shell`);
  }
  if (/id="(?:dx-remove-body-card(?:-runtime)?|dx-test5-sidebar-padding-final)"/.test(skyHtml)) {
    fail(`${skyRoutePath} must not contain retired entry layout overrides`);
  }
  if (!/html:not\(\[data-dex-sidebar-rendered="1"\]\) body\.dx-entry-page #page/.test(skyHtml)) {
    fail(`${skyRoutePath} must hide the entry page until the sidebar runtime is ready`);
  }
  const pageConfigMatch = skyHtml.match(
    /<script id="dex-sidebar-page-config" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!pageConfigMatch) fail(`${skyRoutePath} is missing sidebar page config`);
  const pageConfig = JSON.parse(pageConfigMatch[1]);
  if (!/class="dex-footer"[^>]*data-managed="1"/.test(skyHtml)) {
    fail(`${skyRoutePath} must contain the current managed canonical footer`);
  }
  const footerPattern = /<footer class="dex-footer"[\s\S]*?<\/footer>/;
  const routeFooter = skyHtml.match(footerPattern)?.[0] || '';
  const sourceFooter = skySourceHtml.match(footerPattern)?.[0] || '';
  if (!routeFooter || routeFooter !== sourceFooter) {
    fail(`${skyRoutePath} footer must match the current generated entry footer`);
  }
  if (!/dex-entry-subtitle-label">location<\/span><span class="dex-entry-subtitle-value">Baltimore, MD</.test(skyHtml)) {
    fail(`${skyRoutePath} title metadata must contain Sky's authored location`);
  }
  const credits = pageConfig?.credits || {};
  for (const [label, value] of [
    ['video director', credits?.video?.director],
    ['video cinematography', credits?.video?.cinematography],
    ['video editing', credits?.video?.editing],
    ['audio recording', credits?.audio?.recording],
    ['audio mix', credits?.audio?.mix],
    ['audio master', credits?.audio?.master],
  ]) {
    if (!String(value || '').trim()) {
      fail(`${skyRoutePath} ${label} credit must not be blank`);
    }
  }
  if (String(pageConfig?.metadata?.sampleLength || '') !== '15:25'
    || !Array.isArray(pageConfig?.metadata?.tags)
    || pageConfig.metadata.tags.length === 0) {
    fail(`${skyRoutePath} must contain Sky's authored duration and metadata tags`);
  }
  const fileTree = pageConfig?.downloads?.fileTree;
  if (String(fileTree?.lookup || '') !== 'W.Ob. Ma AV2024 S2') {
    fail(`${skyRoutePath} download file tree must be keyed to Sky's lookup`);
  }
  const protectedAssets = JSON.parse(await read('data/protected.assets.json'));
  const protectedLookup = (protectedAssets.lookups || []).find(
    (row) => String(row?.lookupNumber || '') === 'W.Ob. Ma AV2024 S2',
  );
  const expectedCounts = new Map();
  for (const file of protectedLookup?.files || []) {
    const type = String(file?.type || '').toLowerCase();
    if (!['audio', 'video'].includes(type) || String(file?.role || 'media') !== 'media') continue;
    const bucket = String(file?.bucket || '').toUpperCase();
    expectedCounts.set(bucket, (expectedCounts.get(bucket) || 0) + 1);
  }
  const actualCounts = new Map(
    (fileTree?.buckets || []).map((bucketRow) => [
      String(bucketRow?.bucket || '').toUpperCase(),
      (bucketRow?.types || []).reduce(
        (sum, typeRow) => sum + (Array.isArray(typeRow?.files) ? typeRow.files.length : 0),
        0,
      ),
    ]),
  );
  for (const bucket of ['A', 'B', 'C', 'D', 'E', 'X']) {
    if (!expectedCounts.get(bucket) || actualCounts.get(bucket) !== expectedCounts.get(bucket)) {
      fail(`${skyRoutePath} bucket ${bucket} file count does not match protected assets`);
    }
  }
}

async function main() {
  const [templateHtml, runtimeJs, entryHtmlSource, dexCss, entryRuntimeCss] = await Promise.all([
    read('entry-template/index.html'),
    read('assets/dex-sidebar.js'),
    read('scripts/lib/entry-html.mjs'),
    read('assets/css/dex.css'),
    read('docs/css/components/dx-entry-runtime.css'),
  ]);

  await Promise.all([
    ensureFileExists('docs/assets/series/dex.png'),
    ensureFileExists('docs/assets/series/index.png'),
    ensureFileExists('docs/assets/series/dexfest.png'),
  ]);

  ensureOrderedSections(templateHtml);
  ensureRecordingIndexSecondary(templateHtml);
  ensureRuntimeMarkers(runtimeJs);
  ensurePublicEntryChromeContract(runtimeJs);
  ensureCollectionHeadingLigatureContract(dexCss);
  ensureTooltipCssContract(dexCss);
  ensureLookupNumberFitCssContract(dexCss);
  for (const marker of [
    'Generated by scripts/build-entry-runtime-css.mjs',
    'html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page',
    'body.dx-entry-page .dex-sidebar #downloads .btn-recording-index',
    '.dex-download-modal--tree',
  ]) {
    if (!entryRuntimeCss.includes(marker)) {
      fail(`static entry runtime CSS missing marker: ${marker}`);
    }
  }
  ensureCompilerMarkers(entryHtmlSource);
  await ensureGeneratedEntryRouteContract();
  console.log('verify:entry-sidebar-contract passed');
}

main().catch((error) => {
  console.error(`verify:entry-sidebar-contract failed: ${error.message || String(error)}`);
  process.exit(1);
});
