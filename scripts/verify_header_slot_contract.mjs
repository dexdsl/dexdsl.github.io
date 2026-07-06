#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { hasRouteLocalMeshOwnership } from './lib/route-local-mesh-html.mjs';

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, 'docs');
const BASE_CSS_PATH = path.join(ROOT, 'docs', 'css', 'base.css');
const SLOT_RUNTIME_PATH = path.join(ROOT, 'docs', 'assets', 'js', 'header-slot.js');
const AUTH_RUNTIME_PATH = path.join(ROOT, 'docs', 'assets', 'dex-auth.js');
const CATALOG_MESH_SOURCE_PATH = path.join(ROOT, 'scripts', 'src', 'shared', 'dx-gooey-mesh.entry.mjs');
const BAG_SOURCE_PATH = path.join(ROOT, 'scripts', 'src', 'bag.app.entry.mjs');
const ROUTE_MESH_SOURCE_PATHS = [
  CATALOG_MESH_SOURCE_PATH,
  path.join(ROOT, 'scripts', 'src', 'call.editorial.entry.mjs'),
  path.join(ROOT, 'scripts', 'src', 'dexnotes.index.entry.mjs'),
  path.join(ROOT, 'scripts', 'src', 'dexnotes.entry.entry.mjs'),
];
const HOME_DOCUMENT_PATH = path.join(ROOT, 'docs', 'index.html');
const HEADER_SLOT_RUNTIME_SRC = '/assets/js/header-slot.js?v=20260702shader2';
const GRAIN_OVERLAY_RUNTIME_SRC = '/assets/js/dx-grain-overlay.js?v=20260702shader2';

const REQUIRED_MARKERS = [
  '--dx-slot-top',
  '--dx-slot-content-offset',
  '--dx-layer-gooey',
  '--dx-layer-foreground',
  '--dx-layer-header',
  'body.dx-slot-enabled',
  '#dx-slot-scroll-root',
  '#dx-slot-foreground-root',
  'body.dx-route-show-mesh #siteWrapper',
  'body.dex-entry-page #siteWrapper',
];

const REQUIRED_DOC_PATHS = [
  'docs/404.html',
  'docs/catalog/lookup/index.html',
  'docs/dexfest/2024/day1/index.html',
  'docs/entry/submit/index.html',
  'docs/messages.html',
];

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${path.relative(ROOT, filePath)}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function listHtmlFiles(dirPath, out = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      listHtmlFiles(absolutePath, out);
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      out.push(absolutePath);
    }
  }
  return out;
}

function needsHeaderSlotRuntime(html) {
  return html.includes('<main id="page"') || html.includes('id="siteWrapper"') || html.includes('data-page-sections=') || html.includes('data-footer-sections');
}

function verifyCssContract(failures) {
  const css = readText(BASE_CSS_PATH);
  for (const marker of REQUIRED_MARKERS) {
    if (!css.includes(marker)) {
      failures.push(`base.css missing marker: ${marker}`);
    }
  }
}

function verifyGlassParityContract(failures) {
  const baseCss = readText(BASE_CSS_PATH);
  const slotRuntime = readText(SLOT_RUNTIME_PATH);
  const authRuntime = readText(AUTH_RUNTIME_PATH);
  const catalogMeshSource = readText(CATALOG_MESH_SOURCE_PATH);
  const bagSource = readText(BAG_SOURCE_PATH);
  const homeDocument = readText(HOME_DOCUMENT_PATH);

  const requiredSlotMarkers = [
    'bootstrapPersistentChromeIfMissing',
    'getHeaderElement(document) || await bootstrapPersistentChromeIfMissing()',
    'hasCompletePersistentChrome(document)',
    "const MOBILE_SITE_TILES = Object.freeze([",
    "const MOBILE_ACCOUNT_TILES = Object.freeze([",
    'const desktopAccountIcon = window.DEX_ACCOUNT_MENU_ICON;',
    'class="dx-mobile-menu-modal"',
    'data-dx-mobile-menu-panel="site"',
    'data-dx-mobile-menu-panel="account"',
    'data-dx-mobile-account-open',
    'data-dx-mobile-account-back="true"',
    'setMobileMenuBackgroundInert(root, true)',
    'getMobileMenuFocusable(root)',
    'function handleMobileMenuRouteClick(root, clickedLink, event)',
    "clickedLink.setAttribute('data-dx-mobile-menu-nav-busy', 'true');",
    'const mobileMenuRoot = anchor.closest(`#${MOBILE_MENU_ROOT_ID}`);',
    'handleMobileMenuRouteClick(mobileMenuRoot, anchor, event);',
    'const hasStableSiteTiles = MOBILE_SITE_TILES.every',
    'const hasStableAccountTiles = MOBILE_ACCOUNT_TILES.every',
    "root.setAttribute('data-dx-mobile-menu-view', nextView);",
    "window.addEventListener('dx:messages:unread-count', syncUnread);",
    'const ROUTE_STYLE_STAGED_ATTR =',
    'const ROUTE_CHROME_GUARD_STYLE_ID =',
    'async function prepareRouteStyles(',
    'const orderedAssets = [];',
    'const desiredLinkNodes = new Set(entries.map(({ node }) => node));',
    'function ensureRouteChromeGuardStyleTag()',
    '#dx-mobile-menu[aria-hidden="true"]',
    'function collectManagedInlineStyleDefinitions(',
    "'/assets/js/dx-grain-overlay.js',",
    'function isLegacyGooeyMeshStyle(',
    'if (isLegacyGooeyMeshStyle(style)) {',
    'style.remove();',
    'neutralizePersistentBackdropSelectors(style);',
    'if (!id || seen.has(id) || isLegacyGooeyMeshStyle(style)) continue;',
    'async function preloadRouteScripts(',
    'const routeDocumentPrefetches = new Map();',
    'function canPrefetchRoutes()',
    'connection.saveData',
    'function warmRouteDependencyCache(payload)',
    'function prefetchRouteDocument(targetUrl)',
    'async function fetchRoutePayload(targetUrl, signal)',
    "document.addEventListener('pointerover'",
    "document.addEventListener('focusin'",
    "document.addEventListener('touchstart'",
    "if (!pathname.startsWith('/assets/')) return false;",
    'routePlan.styleTransaction.commit();',
    'Atomic commit boundary:',
    'function classifyRouteTransition(',
    "return 'dx-detail';",
    "return 'dx-back';",
    "typeof document.startViewTransition === 'function'",
    'viewTransition = document.startViewTransition(commitRoute);',
    'viewTransition.types.add(transitionType);',
    'foregroundRoot.style.viewTransitionName = ROUTE_CONTENT_NAME;',
    'function markSharedRouteSource(',
    'function markSharedRouteDestination(',
    'function ensureRouteStatusElements()',
    "progress.setAttribute('data-dx-route-progress', 'visible');",
    'function announceRouteDestination(',
    'function focusRouteDestination(',
    'const navigationDirection = targetHistoryIndex === null',
    '[HISTORY_INDEX_KEY]: nextHistoryIndex',
    'function installHistoryStateGuard()',
    'history.replaceState = (state, title, url) => {',
    'installHistoryStateGuard();',
    'routePlan = await prepareRouteDocument(parsed, finalUrl, {',
    'if (routePlan && !didCommitRoute) routePlan.styleTransaction.dispose();',
    'ROUTE_SCRIPT_LOAD_TIMEOUT_MS',
    'const GOOEY_MESH_STATE_VERSION = 3;',
    'const GOOEY_SPEED_MAX = 16.2;',
    'const GOOEY_TERRITORY_STRENGTH = 0.0048;',
    'const GOOEY_VISUAL_SCALE = 0.82;',
    'const GOOEY_WAX_TRANSFER_RATE = 0.28;',
    'const GOOEY_WAX_RELAX_RATE = 0.22;',
    'const GOOEY_WAX_MAX_MASS = 2.85;',
    "const GOOEY_GRAIN_RUNTIME_SRC = '/assets/js/dx-grain-overlay.js?v=20260702shader2';",
    'function ensureGooeyGrainOverlay()',
    'window.__dxMountGooeyGrain',
    'window.__dxSyncGooeyGrainMesh(gooeyDriverWrapper, gooeyDriverBlobs);',
    '#dx-gooey-grain-overlay',
    'mix-blend-mode: normal',
    'function resolveGooeyWaxMass(blob)',
    'function repairPersistentGooeyMesh()',
    'function shouldUseStaticGooeyMesh()',
    'if (isMobileViewport()) return;',
    "wrapper.setAttribute('data-dx-gooey-motion', 'static');",
    "wrapper.setAttribute('data-dx-gooey-motion', 'animated');",
    'exchange area while deeply overlapped',
    'const transferArea = Math.min(',
    "blob.setAttribute('data-dx-gooey-wax-state', waxState);",
    'phase: Number(blob._phase),',
    'waxMass: resolveGooeyWaxMass(blob),',
    'if (Number.isFinite(item.phase)) blob._phase = item.phase;',
    'if (Number.isFinite(item.waxMass)) blob._waxMass = item.waxMass;',
  ];
  for (const marker of requiredSlotMarkers) {
    if (!slotRuntime.includes(marker)) {
      failures.push(`header-slot runtime missing required protected-route bootstrap marker: ${marker}`);
    }
  }

  if (!catalogMeshSource.includes('header-slot.js is the single mesh owner')) {
    failures.push('Catalog mesh adapter must delegate ownership to the persistent header-slot driver');
  }
  if (!bagSource.includes("window.dispatchEvent(new CustomEvent('dx:gooey-mesh:request'))")) {
    failures.push('Bag route must request the persistent mesh without creating a local fallback');
  }
  if (bagSource.includes('SHARED_MESH_BOOTSTRAP_ATTR') || bagSource.includes('data-dx-shared-mesh-bootstrap')) {
    failures.push('Bag route must not install a route-local mesh bootstrap');
  }
  for (const sourcePath of ROUTE_MESH_SOURCE_PATHS) {
    const source = readText(sourcePath);
    if (source.includes('gooey-mesh-wrapper') && source.includes('requestAnimationFrame')) {
      failures.push(`${path.relative(ROOT, sourcePath)} must not animate the persistent mesh`);
    }
  }
  if (homeDocument.includes("const blobs=[...document.querySelectorAll('#gooey-mesh-wrapper .gooey-blob')]")) {
    failures.push('Home document must not start a second route-local gooey-mesh loop');
  }

  const requiredBaseCssMarkers = [
    '--dx-glass-shell-bg: var(--dx-header-glass-bg);',
    '--dx-glass-shell-rim: var(--dx-header-glass-rim);',
    '--dx-glass-shell-shadow: var(--dx-header-glass-shadow);',
    '--dx-glass-shell-backdrop: var(--dx-header-glass-backdrop);',
    '.dx-glass-shell--header-match',
    'background: var(--dx-glass-shell-bg);',
    'border: 1px solid var(--dx-glass-shell-rim);',
    'box-shadow: var(--dx-glass-shell-shadow);',
    '-webkit-backdrop-filter: var(--dx-glass-shell-backdrop);',
    'backdrop-filter: var(--dx-glass-shell-backdrop);',
    '--dx-mobile-menu-glass: linear-gradient(145deg, rgba(255, 255, 255, 0.96)',
    '--dx-mobile-menu-inset: clamp(16px, 3.25vw, 24px);',
    '.dx-mobile-menu-modal {',
    'max(var(--dx-mobile-menu-inset), var(--dx-safe-top))',
    'width: min(100%, 720px);',
    'height: min(100%, 900px);',
    '-webkit-backdrop-filter: saturate(145%) blur(28px);',
    'grid-template-columns: repeat(2, minmax(0, 1fr));',
    '@media (min-width: 600px)',
    'grid-template-columns: repeat(3, minmax(0, 1fr));',
    '.dx-mobile-menu[data-dx-mobile-menu-view="account"] .dx-mobile-menu-track',
    '@view-transition {',
    'navigation: auto;',
    "html[data-dx-route-transition-type='dx-peer']::view-transition-old(dx-route-content)",
    "html[data-dx-route-transition-type='dx-detail']::view-transition-new(dx-route-content)",
    "html[data-dx-route-transition-type='dx-back']::view-transition-new(dx-route-content)",
    '::view-transition-group(dx-route-shared)',
    '.dx-route-progress {',
    ".dx-route-progress[data-dx-route-progress='visible']",
    '@keyframes dx-route-progress-scan',
    '.dx-route-announcer {',
    '@keyframes dx-mobile-menu-glass-sweep',
    '@keyframes dx-mobile-menu-tile-in',
    '@keyframes dx-mobile-menu-account-tile-in',
    '@media (prefers-reduced-motion: reduce)',
    '#auth-ui {',
    'display: none !important;',
  ];
  for (const marker of requiredBaseCssMarkers) {
    if (!baseCss.includes(marker)) {
      failures.push(`header-glass parity marker missing in base.css: ${marker}`);
    }
  }

  const mobileBackdropRule = baseCss.match(/\.dx-mobile-menu-backdrop\s*\{([\s\S]*?)\n\s*\}/);
  if (!mobileBackdropRule) {
    failures.push('could not locate .dx-mobile-menu-backdrop rule in base.css');
  } else {
    const ruleText = mobileBackdropRule[1];
    if (/backdrop-filter\s*:/.test(ruleText) || /-webkit-backdrop-filter\s*:/.test(ruleText)) {
      failures.push('.dx-mobile-menu-backdrop should not apply its own backdrop-filter');
    }
  }

  const forbiddenMobileMarkers = [
    'dx-mobile-menu-sheet',
    'dx-mobile-menu-scope-blur',
    'dx-mobile-menu-profile-toggle',
    'dx-mobile-menu-profile-panel',
    'data-dx-mobile-profile-expanded',
    'data-dx-mobile-utility-stacked',
  ];
  for (const marker of forbiddenMobileMarkers) {
    if (slotRuntime.includes(marker) || baseCss.includes(marker)) {
      failures.push(`deprecated mobile drawer marker remains: ${marker}`);
    }
  }

  const accountDestinations = [
    ['/entry/favorites/', 'Favorites'],
    ['/polls', 'Polls'],
    ['/entry/submit/', 'Submit Samples'],
    ['/entry/messages/', 'Messages'],
    ['/entry/pressroom/', 'Press Room'],
    ['/entry/settings/', 'Settings'],
    ['/entry/achievements/', 'Achievements'],
  ];
  const accountRegistryMatch = slotRuntime.match(/const MOBILE_ACCOUNT_TILES = Object\.freeze\(\[([\s\S]*?)\]\);/);
  const accountRegistry = accountRegistryMatch ? accountRegistryMatch[1] : '';
  if (!accountRegistry) {
    failures.push('could not parse MOBILE_ACCOUNT_TILES from header-slot runtime');
  }
  for (const [href, label] of accountDestinations) {
    if (!accountRegistry.includes(`href: '${href}'`) || !accountRegistry.includes(`label: '${label}'`)) {
      failures.push(`mobile account registry missing ${label} (${href})`);
    }
    if (!authRuntime.includes(`getMenuLinkMarkup("${href}", "${label}"`)) {
      failures.push(`desktop account menu parity missing ${label} (${href})`);
    }
  }
  if (accountRegistry.includes("href: '/catalog/'")) {
    failures.push('mobile account registry must not duplicate Catalog');
  }

  const forbiddenAuthMarkers = [
    'buildThickerGlassFilter',
    'extractFilterValue',
    'toFixedCssNumber',
    '--dex-neutral-overlay',
    '--dex-menu-overlay',
    '--dex-grain-opacity',
    '#auth-ui-dropdown::after',
  ];
  for (const marker of forbiddenAuthMarkers) {
    if (authRuntime.includes(marker)) {
      failures.push(`auth runtime still contains deprecated tinted/boosted glass marker: ${marker}`);
    }
  }

  const requiredAuthMarkers = [
    '--dex-glass-filter:var(--dex-header-glass-filter',
    '--dex-glass-webkit-filter:var(--dex-header-glass-webkit-filter',
    '#auth-ui-profile-toggle{position:relative;gap:0;border:1px solid var(--dex-glass-border);background:var(--dex-glass-bg);',
    '#auth-ui-dropdown{position:absolute;right:0;top:calc(100% + 10px);',
    'background:var(--dex-glass-bg);box-shadow:var(--dex-glass-shadow);',
    '#auth-ui .dex-menu-item{position:relative;display:grid;',
    'background:var(--dex-glass-bg);box-shadow:var(--dex-glass-shadow);',
    'var headerFilter = filter || webkitFilter || cssHeaderFilter || "saturate(180%) blur(18px)";',
    'ui.style.setProperty("--dex-header-glass-filter", headerFilter);',
    'ui.style.setProperty("--dex-header-glass-webkit-filter", headerFilter);',
    'function startWhenHeaderIsReady()',
    'document.body.classList.contains("dx-entry-page")',
    'return null;',
    'window.addEventListener("dx:slotready", start);',
    'window.__dxMessagesUnreadCount = safeCount;',
    'dispatchWindowEvent("dx:messages:unread-sync", { count: safeCount });',
    'window.DEX_ACCOUNT_MENU_ICON = getMenuIcon;',
  ];
  for (const marker of requiredAuthMarkers) {
    if (!authRuntime.includes(marker)) {
      failures.push(`auth runtime missing required header-glass parity marker: ${marker}`);
    }
  }
}

function verifyRouteLocalMeshOwnership(failures) {
  const htmlFiles = listHtmlFiles(DOCS_DIR);
  for (const filePath of htmlFiles) {
    const relativePath = path.relative(DOCS_DIR, filePath);
    const html = readText(filePath);
    if (hasRouteLocalMeshOwnership(html)) {
      failures.push(`route-local mesh style or runtime found: docs/${relativePath}`);
    }
    if (relativePath === 'index.html') continue;
    if (/\bid=(["'])(?:scroll-gradient-bg|gooey-mesh-wrapper)\1/i.test(html)) {
      failures.push(`route-local backdrop markup found: docs/${relativePath}`);
    }
  }
}

function verifyHtmlCoverage(failures) {
  if (!fs.existsSync(DOCS_DIR)) {
    failures.push('docs directory is missing');
    return;
  }

  const htmlFiles = listHtmlFiles(DOCS_DIR);
  let requiredCount = 0;
  const verifyRuntimePair = (html, rel) => {
    const scriptTags = Array.from(html.matchAll(/<script\b[^>]*\bsrc=(["'])([^"']+)\1[^>]*>\s*<\/script>/gi));
    const pathMatches = (pathname) => scriptTags.filter((match) => {
      try {
        return new URL(match[2], 'https://dex.local').pathname === pathname;
      } catch {
        return String(match[2] || '').split('?')[0] === pathname;
      }
    });
    const headerScripts = pathMatches('/assets/js/header-slot.js');
    const grainScripts = pathMatches('/assets/js/dx-grain-overlay.js');

    if (headerScripts.length !== 1) {
      failures.push(`${rel} must include exactly one header-slot runtime (found ${headerScripts.length})`);
    } else if (headerScripts[0][2] !== HEADER_SLOT_RUNTIME_SRC) {
      failures.push(`${rel} has non-canonical header-slot runtime: ${headerScripts[0][2]}`);
    }
    if (grainScripts.length !== 1) {
      failures.push(`${rel} must include exactly one grain overlay runtime (found ${grainScripts.length})`);
    } else if (grainScripts[0][2] !== GRAIN_OVERLAY_RUNTIME_SRC) {
      failures.push(`${rel} has non-canonical grain overlay runtime: ${grainScripts[0][2]}`);
    }

    const grainIndex = html.indexOf(`src="${GRAIN_OVERLAY_RUNTIME_SRC}"`);
    const headerIndex = html.indexOf(`src="${HEADER_SLOT_RUNTIME_SRC}"`);
    if (grainIndex < 0 || headerIndex < 0 || grainIndex > headerIndex) {
      failures.push(`${rel} must load the grain overlay before header-slot`);
    }
  };

  for (const absolutePath of htmlFiles) {
    const rel = path.relative(ROOT, absolutePath);
    const html = readText(absolutePath);
    const required = needsHeaderSlotRuntime(html);

    if (required) {
      requiredCount += 1;
      verifyRuntimePair(html, rel);
    }

    const slotOverrideRegex = /#dx-slot-(?:scroll-root|foreground-root)[\s\S]{0,280}?z-index\s*:\s*([0-9]+)/gi;
    let match;
    while ((match = slotOverrideRegex.exec(html)) !== null) {
      const z = Number(match[1]);
      if (Number.isFinite(z) && z >= 1300) {
        failures.push(`slot z-index override too high in ${rel} (z-index: ${z})`);
      }
    }
  }

  for (const relPath of REQUIRED_DOC_PATHS) {
    const absolutePath = path.join(ROOT, relPath);
    const html = readText(absolutePath);
    if (!needsHeaderSlotRuntime(html)) verifyRuntimePair(html, relPath);
  }

  if (requiredCount === 0) {
    failures.push('no html routes were classified as requiring header-slot runtime');
  }
}

function main() {
  const failures = [];

  readText(SLOT_RUNTIME_PATH);
  readText(AUTH_RUNTIME_PATH);
  verifyCssContract(failures);
  verifyGlassParityContract(failures);
  verifyRouteLocalMeshOwnership(failures);
  verifyHtmlCoverage(failures);

  if (failures.length > 0) {
    console.error(`verify:header-slot failed with ${failures.length} issue(s):`);
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('verify:header-slot passed.');
}

try {
  main();
} catch (error) {
  console.error(`verify:header-slot error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
