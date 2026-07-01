(() => {
  if (typeof window === 'undefined') return;
  if (window.__dxHeaderSlotLoaded) return;
  window.__dxHeaderSlotLoaded = true;

  const BODY_CLASS = 'dx-slot-enabled';
  const ROUTING_CLASS = 'dx-slot-routing';
  const SLOT_SCROLL_ID = 'dx-slot-scroll-root';
  const SLOT_FOREGROUND_ID = 'dx-slot-foreground-root';
  const ROUTE_SCRIPT_ATTR = 'data-dx-route-script';
  const ROUTE_STYLE_ATTR = 'data-dx-route-style';
  const ROUTE_STYLE_STAGED_ATTR = 'data-dx-route-style-staged';
  const ROUTE_INLINE_STYLE_ATTR = 'data-dx-route-inline-style';
  const ROUTE_STYLE_ANCHOR_ATTR = 'data-dx-route-style-anchor';
  const HISTORY_SLOT_KEY = '__dxSlot';
  const HISTORY_SCROLL_KEY = '__dxSlotScrollTop';
  const HISTORY_INDEX_KEY = '__dxSlotHistoryIndex';
  const ROUTE_PROGRESS_ID = 'dx-route-progress';
  const ROUTE_ANNOUNCER_ID = 'dx-route-announcer';
  const ROUTE_SHARED_NAME = 'dx-route-shared';
  const ROUTE_CONTENT_NAME = 'dx-route-content';
  const ROUTE_TRANSITION_TYPE_ATTR = 'data-dx-route-transition-type';
  const GOOEY_MESH_STATE_STORAGE_KEY = '__dxGooeyMeshState';
  const GOOEY_MESH_CANONICAL_STYLE_ID = 'dx-gooey-mesh-canonical-style';
  const ROUTE_CHROME_GUARD_STYLE_ID = 'dx-route-chrome-guard-style';
  const GOOEY_MESH_STATE_VERSION = 3;
  const GOOEY_SPEED_MIN = 7.2;
  const GOOEY_SPEED_MAX = 16.2;
  const GOOEY_SPEED_DEFAULT = 10.8;
  // Each blob gets a broad roaming territory while close pairs behave like
  // area-conserving lava-lamp wax: attraction, coalescence, a short dwell, then
  // a pinched-off release back toward the original five-color field.
  const GOOEY_TERRITORY_STRENGTH = 0.0048;
  const GOOEY_WANDER_STRENGTH = 0.68;
  const GOOEY_SPEED_RECOVERY = 1.1;
  const GOOEY_VISUAL_SCALE = 0.82;
  const GOOEY_WAX_INFLUENCE_RATIO = 1.12;
  const GOOEY_WAX_MERGE_RATIO = 0.48;
  const GOOEY_WAX_ATTRACTION_STRENGTH = 3.4;
  const GOOEY_WAX_RELEASE_STRENGTH = 11;
  const GOOEY_WAX_TRANSFER_RATE = 0.28;
  const GOOEY_WAX_RELAX_RATE = 0.22;
  const GOOEY_WAX_MIN_MASS = 0.1;
  const GOOEY_WAX_MAX_MASS = 2.85;
  const GOOEY_WAX_DWELL_MIN_MS = 7000;
  const GOOEY_WAX_DWELL_RANGE_MS = 6000;
  const GOOEY_WAX_RELEASE_COOLDOWN_MS = 4200;
  const GOOEY_BLOB_STYLE_PRESETS = Object.freeze([
    '--d:36vmax;--g1a:#ff5f6d;--g1b:#ffc371;--g2a:#47c9e5;--g2b:#845ef7',
    '--d:32vmax;--g1a:#7f00ff;--g1b:#e100ff;--g2a:#00dbde;--g2b:#fc00ff',
    '--d:33vmax;--g1a:#ffd452;--g1b:#ffb347;--g2a:#ff8456;--g2b:#ff5e62',
    '--d:37vmax;--g1a:#13f1fc;--g1b:#0470dc;--g2a:#a1ffce;--g2b:#faffd1',
    '--d:27vmax;--g1a:#f9516d;--g1b:#ff9a44;--g2a:#fa8bff;--g2b:#6f7bf7',
  ]);
  const MOBILE_MENU_ROOT_ID = 'dx-mobile-menu';
  const MOBILE_MENU_OPEN_CLASS = 'dx-mobile-menu-open';
  const MOBILE_BREAKPOINT_QUERY = '(max-width: 980px)';
  const MOBILE_MENU_CLOSE_MS = 340;
  const MOBILE_SITE_TILES = Object.freeze([
    { key: 'catalog', href: '/catalog/', label: 'Catalog', detail: 'Browse the open recording library', icon: 'catalog', featured: true },
    { key: 'call', href: '/call/', label: 'In Dex', detail: 'Calls, submissions, and community', icon: 'call' },
    { key: 'dexnotes', href: '/dexnotes/', label: 'Dex Notes', detail: 'Releases, stories, and field notes', icon: 'notes' },
    { key: 'about', href: '/about/', label: 'About', detail: 'How the archive works', icon: 'about' },
  ]);
  const MOBILE_ACCOUNT_TILES = Object.freeze([
    { key: 'favorites', href: '/entry/favorites/', label: 'Favorites', icon: 'favorites' },
    { key: 'polls', href: '/polls', label: 'Polls', icon: 'polls' },
    { key: 'submit', href: '/entry/submit/', label: 'Submit Samples', icon: 'submit' },
    { key: 'messages', href: '/entry/messages/', label: 'Messages', icon: 'messages', badge: true },
    { key: 'pressroom', href: '/entry/pressroom/', label: 'Press Room', icon: 'press' },
    { key: 'settings', href: '/entry/settings/', label: 'Settings', icon: 'settings' },
    { key: 'achievements', href: '/entry/achievements/', label: 'Achievements', icon: 'achievements' },
  ]);
  const PROFILE_FOOTER_INLINE_QUERY = '(max-width: 900px)';
  const ROUTE_TRANSITION_OUT_START = 'dx:route-transition-out:start';
  const ROUTE_TRANSITION_OUT_END = 'dx:route-transition-out:end';
  const ROUTE_TRANSITION_IN_START = 'dx:route-transition-in:start';
  const ROUTE_TRANSITION_IN_END = 'dx:route-transition-in:end';
  const ROUTE_PREFETCH_DELAY_MS = 90;
  const ROUTE_PREFETCH_TIMEOUT_MS = 6000;
  const ROUTE_PREFETCH_TTL_MS = 45000;
  const ROUTE_PREFETCH_LIMIT = 8;
  const ROUTE_PROGRESS_DELAY_MS = 250;
  const PROFILE_PROTECTED_ROUTE_CLASS = 'dx-route-profile-protected';
  const PROFILE_STANDARD_CHROME_ROUTE_CLASS = 'dx-route-standard-chrome';
  const PROFILE_SHOW_MESH_ROUTE_CLASS = 'dx-route-show-mesh';
  const PROFILE_FOOTER_HEIGHT_VAR = '--dx-profile-footer-height';
  const PROFILE_FOOTER_PORTALED_CLASS = 'dx-profile-footer-portaled';
  const IOS_SAFARI_CLASS = 'dx-ios-safari';
  const IOS_SAFARI_STANDALONE_CLASS = 'dx-ios-safari-standalone';
  const IOS_VIEWPORT_HEIGHT_VAR = '--dx-ios-viewport-height';
  const IOS_VIEWPORT_OFFSET_TOP_VAR = '--dx-ios-viewport-offset-top';
  const IOS_HOME_INDICATOR_VAR = '--dx-ios-home-indicator';
  const PROFILE_PROTECTED_ROUTES = new Set([
    '/favorites',
    '/polls',
    '/submit',
    '/messages',
    '/settings',
    '/achievements',
    '/entry/favorites',
    '/entry/submit',
    '/entry/messages',
    '/entry/messages/submission',
    '/entry/pressroom',
    '/entry/settings',
    '/entry/achievements',
  ]);
  const PROFILE_STANDARD_CHROME_ROUTES = new Set([
    '/entry/messages/submission',
  ]);
  const PROFILE_SHOW_MESH_ROUTES = new Set([
    '/favorites',
    '/polls',
    '/settings',
    '/achievements',
    '/submit',
    '/messages',
    '/entry/favorites',
    '/entry/submit',
    '/entry/messages',
    '/entry/messages/submission',
    '/entry/pressroom',
    '/entry/settings',
    '/entry/achievements',
    '/entry/bag',
  ]);

  const PRESERVED_IDS = new Set(['gooey-mesh-wrapper', 'scroll-gradient-bg', SLOT_SCROLL_ID, SLOT_FOREGROUND_ID]);
  const PRESERVED_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META']);
  const SKIPPED_ROUTE_SCRIPTS = new Set([
    '/assets/dex-auth0-config.js',
    '/assets/dex-auth.js',
    '/assets/vendor/auth0-spa-js.umd.min.js',
    '/assets/js/header-slot.js',
    '/assets/js/dx-scroll-dot.js',
  ]);
  const PERSISTENT_BODY_CLASSES = new Set([
    BODY_CLASS,
    ROUTING_CLASS,
    IOS_SAFARI_CLASS,
    IOS_SAFARI_STANDALONE_CLASS,
  ]);
  const PERSISTENT_HTML_CLASSES = new Set([
    IOS_SAFARI_CLASS,
    IOS_SAFARI_STANDALONE_CLASS,
  ]);
  const HOME_STACK_BLOCK_IDS = [
    'block-448bd8f915f4abba552b',
    'block-ee939fa7ed636a261fd7',
    'block-7ccf390e6577e4e9f69e',
    'block-5976018fa8f9e1213243',
    'block-9f43a906d54ed3a7b492',
  ];
  const ROUTE_SCRIPT_GUARDS = new Map([
    ['/assets/js/call.editorial.js', '__dxCallEditorialLoaded'],
    ['/assets/js/catalog.how.js', '__dxCatalogHowLoaded'],
    ['/assets/js/catalog.index.js', '__dxCatalogIndexLoaded'],
    ['/assets/js/catalog.symbols.js', '__dxCatalogSymbolsLoaded'],
    ['/assets/js/dexnotes.entry.js', '__dxDexnotesEntryLoaded'],
    ['/assets/js/dexnotes.index.js', '__dxDexnotesIndexLoaded'],
    ['/assets/js/dx-about.js', '__dxAboutRouteLoaded'],
    ['/assets/js/dx-uav-entry.js', '__dxUavEntryLoaded'],
    ['/assets/js/dx-scroll-dot.js', '__dxScrollDotLoaded'],
  ]);
  const STRETCH_PRO_CANONICAL_SEPARATOR = '\u200C';
  const STRETCH_PRO_DUPLICATED_SEPARATOR = '\u200D';
  const HEADING_TYPOGRAPHY_SELECTOR = 'h1:not([data-dx-heading-randomize="false"]), h2:not([data-dx-heading-randomize="false"]), [data-dx-heading-randomize="true"]';
  const HEADING_TEXT_IGNORE_SELECTOR = 'script, style, noscript, textarea, code, pre, svg, title, desc';
  const HEADING_DUPLICATE_EXCLUDE_WORDS_ATTR = 'data-dx-heading-duplicate-exclude-words';
  const HEADING_DUPLICATE_EXCLUDE_LETTERS_ATTR = 'data-dx-heading-duplicate-exclude-letters';
  const HEADING_PRESERVE_CANONICAL_ATTR = 'data-dx-heading-preserve-canonical';
  // Based on Stretch Pro shaping: these duplicate-letter pairs map to ligature glyphs (AA.liga, NN.liga, etc).
  const HEADING_DUPLICATE_LIGATURE_SUPPORTED = new Set('ABCDEFGHJKLMNOPQRSTUWZ'.split(''));
  const HEADING_DUPLICATE_EXCLUDED = new Set('–L:TIAWMKX&VYH?!@#$%-1234567890'.split(''));
  const DONATE_LABEL_CANONICAL = 'DONATE';
  const DONATE_LABEL_SELECTOR = '.header-actions-action--cta a[href], .header-menu-cta a[href]';
  window.__dxDisableRouteGooeyBootstrap = true;

  let routeAbortController = null;
  const routeDocumentPrefetches = new Map();
  let routePrefetchTimer = 0;
  let routePrefetchCandidateHref = '';
  let routeProgressTimer = 0;
  let routeHistoryIndex = Number(history.state && history.state[HISTORY_INDEX_KEY]) || 0;
  let historyStateGuardInstalled = false;
  let isNavigating = false;
  let homeHeroAlignerInstalled = false;
  let softRouterInstalled = false;
  let scrollStateInstalled = false;
  let scrollStateRafId = 0;
  let slotLayoutStabilizerInstalled = false;
  let mobileMenuInstalled = false;
  let mobileMenuLastFocused = null;
  let mobileMenuCloseTimer = 0;
  let mobileMenuAuthSnapshot = { authenticated: false, user: null, resolved: false };
  let mobileMenuAuthProbePromise = null;
  let mobileMenuAuthProbeToken = 0;
  let mobileMenuBuildSequence = 0;
  let mobileMenuInertState = [];
  let mobileMenuBodyOverflow = '';
  let mobileMenuScrollOverflow = '';
  let mobileMenuUnreadCount = 0;
  let profileViewportMetricsInstalled = false;
  let profileViewportMetricsRafId = 0;
  let iosSafariViewportSyncInstalled = false;
  let iosSafariViewportSyncRafId = 0;
  let profileFooterPortalState = { footer: null, anchor: null };
  let gooeyDriverInstalled = false;
  let gooeyDriverRafId = 0;
  let gooeyDriverWatchdogId = 0;
  let gooeyDriverLast = 0;
  let gooeyDriverLastFrame = 0;
  let gooeyDriverWrapper = null;
  let gooeyDriverBlobs = [];
  const headingCanonicalTextByNode = new WeakMap();
  const headingRenderedTextByNode = new WeakMap();

  function getHeaderElement(root = document) {
    const wrapper = root.querySelector('.header-announcement-bar-wrapper');
    if (!wrapper) return null;
    return wrapper.closest('header') || wrapper;
  }

  function hasCompletePersistentChrome(root = document) {
    if (!root || !root.querySelector) return false;
    const header = getHeaderElement(root);
    if (!(header instanceof HTMLElement)) return false;
    const hasGradient = !!root.getElementById?.('scroll-gradient-bg');
    const hasMesh = !!root.getElementById?.('gooey-mesh-wrapper');
    const hasSprite = !!root.querySelector('svg[data-usage="social-icons-svg"]');
    const hasFooter = !!getProfileFooterSourceElement(root);
    return hasGradient && hasMesh && hasSprite && hasFooter;
  }

  function shouldForcePersistentChromeBootstrap(pathname = window.location.pathname) {
    if (document.body && document.body.classList && document.body.classList.contains('dx-entry-page')) return true;
    return isProfileProtectedPath(pathname)
      || isProfileStandardChromePath(pathname)
      || isProfileShowMeshPath(pathname);
  }

  function removeLegacyEntryChrome(headerElement = null) {
    const removable = new Set();
    if (headerElement instanceof HTMLElement) removable.add(headerElement);
    const selectors = ['.sqs-announcement-bar-dropzone', '.dx-announcement-bar-dropzone', '.header-announcement-bar-wrapper'];
    for (const selector of selectors) {
      const nodes = Array.from(document.querySelectorAll(selector));
      for (const node of nodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.id === SLOT_SCROLL_ID || node.id === SLOT_FOREGROUND_ID) continue;
        removable.add(node);
      }
    }
    for (const node of removable) {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    }
  }

  function getChromeTemplateCandidates() {
    const runtimeCandidates = Array.isArray(window.__dxChromeTemplateCandidates)
      ? window.__dxChromeTemplateCandidates
      : [];
    const pathname = normalizePathname(window.location.pathname || '/');
    const prefersDocsRoot = pathname === '/docs' || pathname.startsWith('/docs/');
    const fallbackCandidates = prefersDocsRoot
      ? ['/docs/', '/docs/index.html', '/', '/index.html']
      : ['/', '/index.html', '/docs/', '/docs/index.html'];
    const candidates = [...runtimeCandidates, ...fallbackCandidates];
    const seen = new Set();
    const unique = [];
    for (const candidate of candidates) {
      const key = String(candidate || '').trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(key);
    }
    return unique;
  }

  function insertBackdropNode(node) {
    if (!(node instanceof HTMLElement) || !(document.body instanceof HTMLElement)) return;
    const scrollRoot = document.getElementById(SLOT_SCROLL_ID);
    if (scrollRoot && scrollRoot.parentElement === document.body) {
      document.body.insertBefore(node, scrollRoot);
      return;
    }
    if (document.body.firstChild) {
      document.body.insertBefore(node, document.body.firstChild);
      return;
    }
    document.body.appendChild(node);
  }

  function createFallbackBackdropElementsIfMissing() {
    if (!(document.body instanceof HTMLElement)) return;

    if (!document.getElementById('scroll-gradient-bg')) {
      const gradient = document.createElement('div');
      gradient.id = 'scroll-gradient-bg';
      gradient.setAttribute('data-dex-entry-bg', '1');
      insertBackdropNode(gradient);
    }

    if (!document.getElementById('gooey-mesh-wrapper')) {
      const mesh = document.createElement('div');
      mesh.id = 'gooey-mesh-wrapper';
      mesh.setAttribute('data-dex-entry-bg', '1');

      const stage = document.createElement('div');
      stage.className = 'gooey-stage';

      for (const styleText of GOOEY_BLOB_STYLE_PRESETS) {
        const blob = document.createElement('div');
        blob.className = 'gooey-blob';
        blob.setAttribute('style', styleText);
        stage.appendChild(blob);
      }

      mesh.appendChild(stage);
      insertBackdropNode(mesh);
    }
  }

  async function ensureBackdropElementsFromTemplateIfMissing() {
    if (!(document.body instanceof HTMLElement)) return;
    const hasGradient = !!document.getElementById('scroll-gradient-bg');
    const hasMesh = !!document.getElementById('gooey-mesh-wrapper');
    const hasSprite = !!document.querySelector('svg[data-usage="social-icons-svg"]');
    if (hasGradient && hasMesh && hasSprite) return;

    const templateCandidates = getChromeTemplateCandidates();
    for (const templatePath of templateCandidates) {
      try {
        const response = await fetch(templatePath, {
          credentials: 'same-origin',
          headers: { accept: 'text/html,*/*;q=0.9' },
        });
        const contentType = String(response.headers.get('content-type') || '');
        if (!response.ok || !contentType.includes('text/html')) continue;

        const html = await response.text();
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        if (!parsed || !parsed.body) continue;

        let importedBackdrop = false;
        for (const backdropId of ['scroll-gradient-bg', 'gooey-mesh-wrapper']) {
          if (document.getElementById(backdropId)) continue;
          const sourceBackdrop = parsed.getElementById(backdropId);
          if (!(sourceBackdrop instanceof HTMLElement)) continue;
          const backdropNode = document.importNode(sourceBackdrop, true);
          insertBackdropNode(backdropNode);
          importedBackdrop = true;
        }

        let importedSprite = false;
        if (!document.querySelector('svg[data-usage="social-icons-svg"]')) {
          const sourceSprite = parsed.querySelector('svg[data-usage="social-icons-svg"]');
          if (sourceSprite instanceof SVGElement) {
            const spriteNode = document.importNode(sourceSprite, true);
            insertBackdropNode(spriteNode);
            importedSprite = true;
          }
        }

        const readyGradient = !!document.getElementById('scroll-gradient-bg');
        const readyMesh = !!document.getElementById('gooey-mesh-wrapper');
        const readySprite = !!document.querySelector('svg[data-usage="social-icons-svg"]');
        if (readyGradient && readyMesh && readySprite) {
          ensureBackdropLayersOutsideForeground();
          return;
        }

        // This candidate was valid HTML but did not contain what we needed.
        if (!importedBackdrop && !importedSprite) continue;
      } catch {}
    }

    createFallbackBackdropElementsIfMissing();
    ensureBackdropLayersOutsideForeground();
    ensureCanonicalGooeyMeshPresentation();
  }

  async function bootstrapPersistentChromeIfMissing({ force = false } = {}) {
    if (!(document.body instanceof HTMLElement)) return getHeaderElement(document);

    const existingHeader = getHeaderElement(document);
    if (existingHeader && !force) return existingHeader;

    const templateCandidates = getChromeTemplateCandidates();
    for (const templatePath of templateCandidates) {
      try {
        const response = await fetch(templatePath, {
          credentials: 'same-origin',
          headers: { accept: 'text/html,*/*;q=0.9' },
        });
        const contentType = String(response.headers.get('content-type') || '');
        if (!response.ok || !contentType.includes('text/html')) continue;

        const html = await response.text();
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        if (!parsed || !parsed.body) continue;

        const sourceHeader = getHeaderElement(parsed);
        if (!(sourceHeader instanceof HTMLElement)) continue;

        if (force) {
          removeLegacyEntryChrome(existingHeader || getHeaderElement(document));
        } else {
          syncHtmlAttributes(parsed);
          syncBodyAttributes(parsed.body);
        }

        for (const backdropId of ['scroll-gradient-bg', 'gooey-mesh-wrapper']) {
          if (document.getElementById(backdropId)) continue;
          const sourceBackdrop = parsed.getElementById(backdropId);
          if (!(sourceBackdrop instanceof HTMLElement)) continue;
          const importedBackdrop = document.importNode(sourceBackdrop, true);
          if (document.body.firstChild) {
            document.body.insertBefore(importedBackdrop, document.body.firstChild);
          } else {
            document.body.appendChild(importedBackdrop);
          }
        }

        if (!document.querySelector('svg[data-usage="social-icons-svg"]')) {
          const sourceSprite = parsed.querySelector('svg[data-usage="social-icons-svg"]');
          if (sourceSprite instanceof SVGElement) {
            const importedSprite = document.importNode(sourceSprite, true);
            if (document.body.firstChild) {
              document.body.insertBefore(importedSprite, document.body.firstChild);
            } else {
              document.body.appendChild(importedSprite);
            }
          }
        }

        const importedHeader = document.importNode(sourceHeader, true);
        if (document.body.firstChild) {
          document.body.insertBefore(importedHeader, document.body.firstChild);
        } else {
          document.body.appendChild(importedHeader);
        }

        if (!getProfileFooterSourceElement(document)) {
          const sourceFooter = getProfileFooterSourceElement(parsed);
          if (sourceFooter instanceof HTMLElement) {
            sourceFooter.setAttribute('data-surface', sourceFooter.getAttribute('data-surface') || 'light');
            document.body.appendChild(document.importNode(sourceFooter, true));
          }
        }

        const hydratedHeader = getHeaderElement(document);
        if (hydratedHeader) return hydratedHeader;
      } catch {}
    }

    return getHeaderElement(document);
  }

  function isHttpUrl(url) {
    return url.protocol === 'http:' || url.protocol === 'https:';
  }

  function isSameOriginUrl(url) {
    return url.origin === window.location.origin;
  }

  function toAbsoluteUrl(value, baseHref = window.location.href) {
    if (!value) return null;
    try {
      return new URL(value, baseHref);
    } catch {
      return null;
    }
  }

  function normalizePathname(pathname) {
    const raw = String(pathname || '/').replace(/\/{2,}/g, '/');
    if (raw === '/') return '/';
    return raw.endsWith('/') ? raw.slice(0, -1) : raw;
  }

  function decodeViewRoutePath(pathname) {
    const normalized = normalizePathname(pathname);
    if (!normalized.startsWith('/view/')) return '';
    const parts = normalized.split('/').filter(Boolean);
    const encoded = String(parts[1] || '').trim();
    if (!encoded) return '';
    try {
      const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      const binary = window.atob(padded);
      const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
      const decoded = new TextDecoder().decode(bytes);
      if (!decoded) return '';
      const entryMatch = decoded.match(/\/(entries|entry)\/([^/]+)\/index\.html$/i);
      if (entryMatch) {
        return `/${String(entryMatch[1] || '').toLowerCase()}/${String(entryMatch[2] || '')}`;
      }
      const pathOnly = String(decoded).match(/(\/(?:entries|entry)\/[^?#\s]+)/i);
      return pathOnly ? pathOnly[1] : '';
    } catch {
      return '';
    }
  }

  function normalizeProfileRoutePath(pathname) {
    let normalized = normalizePathname(pathname);
    if (normalized === '/docs') {
      normalized = '/';
    } else if (normalized.startsWith('/docs/')) {
      normalized = normalizePathname(normalized.slice('/docs'.length) || '/');
    }
    const decodedViewPath = decodeViewRoutePath(normalized);
    if (decodedViewPath) normalized = normalizePathname(decodedViewPath);
    if (normalized !== '/' && normalized.toLowerCase().endsWith('/index.html')) {
      normalized = normalized.slice(0, -'/index.html'.length) || '/';
    } else if (normalized !== '/' && normalized.toLowerCase().endsWith('.html')) {
      normalized = normalized.slice(0, -'.html'.length) || '/';
    }
    if (!normalized.startsWith('/')) {
      normalized = `/${normalized}`;
    }
    return normalized || '/';
  }

  function isProfileProtectedPath(pathname) {
    const normalized = normalizeProfileRoutePath(pathname);
    return PROFILE_PROTECTED_ROUTES.has(normalized);
  }

  function isProfileStandardChromePath(pathname) {
    const normalized = normalizeProfileRoutePath(pathname);
    return PROFILE_STANDARD_CHROME_ROUTES.has(normalized);
  }

  function isProfileShowMeshPath(pathname) {
    const normalized = normalizeProfileRoutePath(pathname);
    if (PROFILE_SHOW_MESH_ROUTES.has(normalized)) return true;
    if (document.body && document.body.classList && document.body.classList.contains('dx-entry-page')) return true;
    return false;
  }

  function getProfileFooterSourceElement(root = document) {
    if (!root || !root.querySelector) return null;
    const sectionFooter = root.querySelector('#footer-sections .dex-footer');
    if (sectionFooter instanceof HTMLElement) return sectionFooter;
    const firstFooter = root.querySelector('.dex-footer');
    return firstFooter instanceof HTMLElement ? firstFooter : null;
  }

  function clearProfileFooterPortalState() {
    profileFooterPortalState = { footer: null, anchor: null };
  }

  function restoreProfileFooterFromPortal({ removeIfDetached = false } = {}) {
    const footer = profileFooterPortalState.footer;
    const anchor = profileFooterPortalState.anchor;

    if (!(footer instanceof HTMLElement)) {
      clearProfileFooterPortalState();
      return;
    }

    footer.classList.remove(PROFILE_FOOTER_PORTALED_CLASS);
    footer.removeAttribute('data-dx-profile-footer-portaled');

    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(footer, anchor);
      anchor.parentNode.removeChild(anchor);
    } else if ((removeIfDetached || footer.parentElement === document.body) && footer.parentNode) {
      footer.parentNode.removeChild(footer);
    }

    clearProfileFooterPortalState();
  }

  function portalProfileFooterIfNeeded() {
    if (!document.body) return;

    const sourceFooter = getProfileFooterSourceElement(document);
    if (!(sourceFooter instanceof HTMLElement)) {
      restoreProfileFooterFromPortal({ removeIfDetached: true });
      return;
    }

    if (sourceFooter.classList.contains(PROFILE_FOOTER_PORTALED_CLASS)) {
      if (sourceFooter.parentElement !== document.body) {
        document.body.appendChild(sourceFooter);
      }
      profileFooterPortalState.footer = sourceFooter;
      return;
    }

    if (
      profileFooterPortalState.footer &&
      profileFooterPortalState.footer !== sourceFooter
    ) {
      restoreProfileFooterFromPortal({ removeIfDetached: true });
    }

    const parentNode = sourceFooter.parentNode;
    if (!parentNode) return;

    const anchor = document.createComment('dx-profile-footer-anchor');
    parentNode.insertBefore(anchor, sourceFooter);

    sourceFooter.classList.add(PROFILE_FOOTER_PORTALED_CLASS);
    sourceFooter.setAttribute('data-dx-profile-footer-portaled', 'true');
    document.body.appendChild(sourceFooter);

    profileFooterPortalState = {
      footer: sourceFooter,
      anchor,
    };
  }

  function syncProfileFooterPlacementNow() {
    const isProtectedRoute = document.body && document.body.classList.contains(PROFILE_PROTECTED_ROUTE_CLASS);
    const isStandardChromeRoute = document.body && document.body.classList.contains(PROFILE_STANDARD_CHROME_ROUTE_CLASS);
    const isEntryPage = document.body && document.body.classList.contains('dx-entry-page');
    if (isEntryPage) {
      restoreProfileFooterFromPortal();
      return;
    }
    if (isProtectedRoute && !isStandardChromeRoute) {
      if (isProfileFooterInlineViewport()) {
        restoreProfileFooterFromPortal();
        return;
      }
      portalProfileFooterIfNeeded();
      return;
    }
    restoreProfileFooterFromPortal();
  }

  function getProfileFooterElement(root = document) {
    if (!root || !root.querySelectorAll) return null;
    const portaled = root.querySelector(`.dex-footer.${PROFILE_FOOTER_PORTALED_CLASS}`);
    if (portaled instanceof HTMLElement) {
      const rect = portaled.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return portaled;
    }

    const footers = Array.from(root.querySelectorAll('.dex-footer'));
    if (!footers.length) return null;

    let candidate = null;
    for (const footer of footers) {
      if (!(footer instanceof HTMLElement)) continue;
      const rect = footer.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      candidate = footer;
    }

    return candidate;
  }

  function syncProfileViewportMetricsNow() {
    if (!document.body || !document.documentElement) return;
    const isProtectedRoute = document.body.classList.contains(PROFILE_PROTECTED_ROUTE_CLASS);
    const isStandardChromeRoute = document.body.classList.contains(PROFILE_STANDARD_CHROME_ROUTE_CLASS);
    if (!isProtectedRoute || isStandardChromeRoute) {
      syncProfileFooterPlacementNow();
      document.documentElement.style.removeProperty(PROFILE_FOOTER_HEIGHT_VAR);
      return;
    }

    syncProfileFooterPlacementNow();
    if (isProfileFooterInlineViewport()) {
      document.documentElement.style.removeProperty(PROFILE_FOOTER_HEIGHT_VAR);
      return;
    }
    const footer = getProfileFooterElement(document);
    const footerRect = footer ? footer.getBoundingClientRect() : null;
    const footerHeight = footerRect ? Math.max(0, Math.round(footerRect.height)) : 0;
    if (footerHeight > 0) {
      document.documentElement.style.setProperty(PROFILE_FOOTER_HEIGHT_VAR, `${footerHeight}px`);
      return;
    }

    document.documentElement.style.removeProperty(PROFILE_FOOTER_HEIGHT_VAR);
  }

  function scheduleProfileViewportMetricsSync() {
    if (profileViewportMetricsRafId) {
      cancelAnimationFrame(profileViewportMetricsRafId);
      profileViewportMetricsRafId = 0;
    }
    profileViewportMetricsRafId = requestAnimationFrame(() => {
      profileViewportMetricsRafId = 0;
      syncProfileViewportMetricsNow();
    });
  }

  function installProfileViewportMetricsSync() {
    if (profileViewportMetricsInstalled) return;
    profileViewportMetricsInstalled = true;

    window.addEventListener('resize', scheduleProfileViewportMetricsSync, { passive: true });
    window.addEventListener('orientationchange', scheduleProfileViewportMetricsSync);
    window.addEventListener('load', scheduleProfileViewportMetricsSync);
    window.addEventListener('dx:slotready', scheduleProfileViewportMetricsSync);
    window.addEventListener(ROUTE_TRANSITION_IN_END, scheduleProfileViewportMetricsSync);
    if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
      window.visualViewport.addEventListener('resize', scheduleProfileViewportMetricsSync, { passive: true });
    }
  }

  function syncProfileProtectedRouteState(pathname) {
    const isProtected = isProfileProtectedPath(pathname);
    const isStandardChrome = isProfileStandardChromePath(pathname);
    const showMesh = isProfileShowMeshPath(pathname) || isProtected;
    document.body.classList.toggle(PROFILE_PROTECTED_ROUTE_CLASS, isProtected);
    document.body.classList.toggle(PROFILE_STANDARD_CHROME_ROUTE_CLASS, isStandardChrome);
    document.body.classList.toggle(PROFILE_SHOW_MESH_ROUTE_CLASS, showMesh);
    if (showMesh) {
      void ensureBackdropElementsFromTemplateIfMissing();
    }
    syncProfileFooterPlacementNow();
    scheduleProfileViewportMetricsSync();
    if (isProtected) {
      requestAnimationFrame(syncProfileFooterPlacementNow);
      window.setTimeout(syncProfileFooterPlacementNow, 90);
      window.setTimeout(syncProfileFooterPlacementNow, 220);
      requestAnimationFrame(scheduleProfileViewportMetricsSync);
      window.setTimeout(scheduleProfileViewportMetricsSync, 90);
      window.setTimeout(scheduleProfileViewportMetricsSync, 220);
    }
  }

  function getHeaderGlassSnapshot(root = document) {
    if (!root || !root.querySelector || typeof window.getComputedStyle !== 'function') return null;
    const wrapper = root.querySelector('.header-announcement-bar-wrapper');
    if (!(wrapper instanceof HTMLElement)) return null;

    const style = window.getComputedStyle(wrapper);
    const backgroundImage = String(style.backgroundImage || '').trim();
    const backgroundColor = String(style.backgroundColor || '').trim();
    const borderTopColor = String(style.borderTopColor || '').trim();
    const boxShadow = String(style.boxShadow || '').trim();
    const backdropFilter = String(style.backdropFilter || '').trim();
    const webkitBackdropFilter = String(style.webkitBackdropFilter || '').trim();
    const borderRadius = String(style.borderTopLeftRadius || '').trim();

    return {
      background: backgroundImage && backgroundImage !== 'none' ? backgroundImage : backgroundColor,
      borderColor: borderTopColor || '',
      boxShadow: boxShadow || '',
      backdropFilter: backdropFilter || webkitBackdropFilter || '',
      webkitBackdropFilter: webkitBackdropFilter || backdropFilter || '',
      borderRadius: borderRadius || '',
    };
  }

  function syncProfileRouteGlassFromHeader(root = document) {
    void root;
    return;
  }

  function ensureViewportFitCover() {
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!(viewportMeta instanceof HTMLMetaElement)) return;

    const rawContent = String(viewportMeta.getAttribute('content') || '').trim();
    if (!rawContent) {
      viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
      return;
    }

    let cleaned = rawContent
      .replace(/(?:^|,)\s*viewport-fit\s*=\s*[^,]+/ig, '')
      .replace(/\s*,\s*/g, ', ')
      .replace(/^\s*,\s*|\s*,\s*$/g, '')
      .trim();

    if (!cleaned) {
      cleaned = 'width=device-width, initial-scale=1';
    }

    viewportMeta.setAttribute('content', `${cleaned}, viewport-fit=cover`);
  }

  function isLikelyIosFamily() {
    const ua = String(navigator.userAgent || '');
    const platform = String(navigator.platform || '');
    const touchPoints = Number(navigator.maxTouchPoints || 0);
    return /iPad|iPhone|iPod/i.test(ua) || (platform === 'MacIntel' && touchPoints > 1);
  }

  function isSafariEngine() {
    const ua = String(navigator.userAgent || '');
    if (!/AppleWebKit/i.test(ua) || !/Safari/i.test(ua)) return false;
    return !/(CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|YaBrowser|SamsungBrowser)/i.test(ua);
  }

  function isIosSafariBrowser() {
    return isLikelyIosFamily() && isSafariEngine();
  }

  function isStandaloneDisplayMode() {
    try {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
      if (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) return true;
    } catch {}
    return Boolean(window.navigator && window.navigator.standalone === true);
  }

  function clearIosSafariViewportVars() {
    const rootStyle = document.documentElement && document.documentElement.style;
    if (!rootStyle) return;
    rootStyle.removeProperty(IOS_VIEWPORT_HEIGHT_VAR);
    rootStyle.removeProperty(IOS_VIEWPORT_OFFSET_TOP_VAR);
    rootStyle.removeProperty(IOS_HOME_INDICATOR_VAR);
  }

  function syncIosSafariClassAndVarsNow() {
    const enabled = isIosSafariBrowser();
    const standalone = enabled && isStandaloneDisplayMode();
    const html = document.documentElement;
    if (html) {
      html.classList.toggle(IOS_SAFARI_CLASS, enabled);
      html.classList.toggle(IOS_SAFARI_STANDALONE_CLASS, standalone);
      html.setAttribute('data-dx-ios-safari', enabled ? 'true' : 'false');
      html.setAttribute('data-dx-ios-safari-standalone', standalone ? 'true' : 'false');
    }
    if (document.body) {
      document.body.classList.toggle(IOS_SAFARI_CLASS, enabled);
      document.body.classList.toggle(IOS_SAFARI_STANDALONE_CLASS, standalone);
      document.body.setAttribute('data-dx-ios-safari', enabled ? 'true' : 'false');
      document.body.setAttribute('data-dx-ios-safari-standalone', standalone ? 'true' : 'false');
    }
    if (!enabled) {
      clearIosSafariViewportVars();
      return;
    }

    const rootStyle = document.documentElement && document.documentElement.style;
    if (!rootStyle) return;

    const layoutHeight = Math.max(
      Math.round(window.innerHeight || 0),
      Math.round(document.documentElement ? document.documentElement.clientHeight : 0)
    );
    const viewport = window.visualViewport;
    const viewportHeight = viewport ? Math.max(0, Math.round(viewport.height || 0)) : layoutHeight;
    const viewportOffsetTop = standalone && viewport ? Math.max(0, Math.round(viewport.offsetTop || 0)) : 0;
    const occludedBottom = standalone && viewport
      ? Math.max(0, Math.round(layoutHeight - (viewport.height || 0) - (viewport.offsetTop || 0)))
      : 0;

    rootStyle.setProperty(IOS_VIEWPORT_HEIGHT_VAR, `${Math.max(layoutHeight, viewportHeight)}px`);
    rootStyle.setProperty(IOS_VIEWPORT_OFFSET_TOP_VAR, `${viewportOffsetTop}px`);
    rootStyle.setProperty(IOS_HOME_INDICATOR_VAR, `${occludedBottom}px`);
  }

  function scheduleIosSafariViewportSync() {
    if (iosSafariViewportSyncRafId) {
      cancelAnimationFrame(iosSafariViewportSyncRafId);
      iosSafariViewportSyncRafId = 0;
    }
    iosSafariViewportSyncRafId = requestAnimationFrame(() => {
      iosSafariViewportSyncRafId = 0;
      syncIosSafariClassAndVarsNow();
    });
  }

  function installIosSafariViewportSync() {
    if (iosSafariViewportSyncInstalled) return;
    iosSafariViewportSyncInstalled = true;
    scheduleIosSafariViewportSync();

    window.addEventListener('resize', scheduleIosSafariViewportSync, { passive: true });
    window.addEventListener('orientationchange', scheduleIosSafariViewportSync);
    window.addEventListener('pageshow', scheduleIosSafariViewportSync);
    window.addEventListener('focus', scheduleIosSafariViewportSync);
    window.addEventListener('dx:slotready', scheduleIosSafariViewportSync);

    if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
      window.visualViewport.addEventListener('resize', scheduleIosSafariViewportSync, { passive: true });
      window.visualViewport.addEventListener('scroll', scheduleIosSafariViewportSync, { passive: true });
    }
  }

  function normalizeRouteKey(url) {
    return `${normalizePathname(url.pathname)}${url.search || ''}`;
  }

  function isHeaderWordmarkAnchor(anchor) {
    if (!(anchor instanceof Element)) return false;
    return !!anchor.closest('.header-title-logo');
  }

  function normalizeHeaderWordmarkLinks(root = document) {
    const links = Array.from(root.querySelectorAll('.header-title-logo a[href]'));
    for (const link of links) {
      const rawHref = String(link.getAttribute('href') || '').trim();
      const lowerHref = rawHref.toLowerCase();
      if (
        lowerHref === '/' ||
        lowerHref === 'index.html' ||
        lowerHref === './index.html' ||
        lowerHref === 'index.htm' ||
        lowerHref === './'
      ) {
        link.setAttribute('href', '/');
        link.setAttribute('data-dx-home-link', 'true');
        continue;
      }

      const absoluteHref = toAbsoluteUrl(rawHref);
      if (!absoluteHref) continue;
      if (normalizePathname(absoluteHref.pathname) === '/index.html') {
        link.setAttribute('href', '/');
        link.setAttribute('data-dx-home-link', 'true');
      }
    }
  }

  function isAlphabeticCharacter(char) {
    if (!char) return false;
    return char.toLowerCase() !== char.toUpperCase();
  }

  function isStretchDuplicateSeparator(char) {
    return char === STRETCH_PRO_CANONICAL_SEPARATOR || char === STRETCH_PRO_DUPLICATED_SEPARATOR;
  }

  function stripZwnjCharacters(value) {
    // Normalize both canonical (U+200C) and duplicated-run (U+200D) separators.
    return String(value == null ? '' : value).replace(/[\u200C\u200D]/g, '');
  }

  function insertCanonicalDoubleLetterSeparators(value) {
    const source = stripZwnjCharacters(value);
    if (!source) return source;

    const chars = Array.from(source);
    if (chars.length < 2) return source;

    let changed = false;
    const output = [];
    for (let index = 0; index < chars.length; index += 1) {
      const current = chars[index];
      const next = chars[index + 1];
      output.push(current);
      if (!next) continue;
      if (isStretchDuplicateSeparator(current) || isStretchDuplicateSeparator(next)) continue;
      if (!isAlphabeticCharacter(current) || !isAlphabeticCharacter(next)) continue;
      if (current.toLowerCase() !== next.toLowerCase()) continue;
      output.push(STRETCH_PRO_CANONICAL_SEPARATOR);
      changed = true;
    }

    return changed ? output.join('') : source;
  }

  function hashStringToUint32(value) {
    let hash = 2166136261;
    const chars = Array.from(String(value == null ? '' : value));
    for (const char of chars) {
      hash ^= char.codePointAt(0) || 0;
      hash = Math.imul(hash, 16777619);
      hash >>>= 0;
    }
    return hash >>> 0;
  }

  function createSeededRandom(seedValue) {
    let seed = hashStringToUint32(seedValue || 'dx-heading-seed');
    return () => {
      seed += 0x6D2B79F5;
      let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createHeadingRandom(seedKey) {
    const seedBase = window.__DX_HEADING_RANDOM_SEED;
    if (seedBase === null || seedBase === undefined || String(seedBase) === '') {
      return Math.random;
    }
    return createSeededRandom(`${seedBase}|${seedKey || ''}`);
  }

  function pickProbabilisticDuplicateCount(randomFn) {
    const roll = randomFn();
    if (roll < 0.5) return 0;
    return 1;
  }

  function buildExcludedDuplicateGlobalIndexes(nodeValues, excludedWords) {
    if (!(excludedWords instanceof Set) || !excludedWords.size) return null;

    const combinedChars = Array.from(nodeValues.map((value) => String(value || '')).join(''));
    const canonicalChars = [];
    const canonicalToCombinedIndex = [];

    combinedChars.forEach((char, combinedIndex) => {
      if (isStretchDuplicateSeparator(char)) return;
      canonicalChars.push(char);
      canonicalToCombinedIndex.push(combinedIndex);
    });

    if (!canonicalChars.length) return null;

    const canonicalUpper = canonicalChars.join('').toUpperCase();
    const excludedIndexes = new Set();

    for (const word of excludedWords) {
      if (!word || !word.length) continue;
      let fromIndex = 0;
      while (fromIndex < canonicalUpper.length) {
        const foundIndex = canonicalUpper.indexOf(word, fromIndex);
        if (foundIndex < 0) break;
        for (let offset = 0; offset < word.length; offset += 1) {
          const combinedIndex = canonicalToCombinedIndex[foundIndex + offset];
          if (Number.isFinite(combinedIndex)) {
            excludedIndexes.add(combinedIndex);
          }
        }
        fromIndex = foundIndex + word.length;
      }
    }

    return excludedIndexes.size ? excludedIndexes : null;
  }

  function collectEligibleDuplicateTargets(nodeValues, options = {}) {
    const excludedGlobalIndexes = options.excludedGlobalIndexes instanceof Set ? options.excludedGlobalIndexes : null;
    const excludedLetters = options.excludedLetters instanceof Set ? options.excludedLetters : null;
    const eligible = [];
    let globalCharIndex = 0;
    nodeValues.forEach((value, nodeIndex) => {
      const chars = Array.from(String(value || ''));
      function hasSameLetterNeighborAt(charIndex) {
        const current = chars[charIndex];
        if (!current || !isAlphabeticCharacter(current)) return false;
        const currentLower = current.toLowerCase();

        let prevIndex = charIndex - 1;
        while (prevIndex >= 0 && isStretchDuplicateSeparator(chars[prevIndex])) prevIndex -= 1;
        if (prevIndex >= 0) {
          const prev = chars[prevIndex];
          if (isAlphabeticCharacter(prev) && prev.toLowerCase() === currentLower) return true;
        }

        let nextIndex = charIndex + 1;
        while (nextIndex < chars.length && isStretchDuplicateSeparator(chars[nextIndex])) nextIndex += 1;
        if (nextIndex < chars.length) {
          const next = chars[nextIndex];
          if (isAlphabeticCharacter(next) && next.toLowerCase() === currentLower) return true;
        }

        return false;
      }

      for (let charIndex = 0; charIndex < chars.length; charIndex += 1) {
        const char = chars[charIndex];
        const isExcluded = excludedGlobalIndexes && excludedGlobalIndexes.has(globalCharIndex);
        if (
          char &&
          !isStretchDuplicateSeparator(char) &&
          !isExcluded &&
          !hasSameLetterNeighborAt(charIndex) &&
          /\S/.test(char) &&
          isAlphabeticCharacter(char)
        ) {
          const upper = char.toUpperCase();
          if (
            HEADING_DUPLICATE_LIGATURE_SUPPORTED.has(upper) &&
            !HEADING_DUPLICATE_EXCLUDED.has(upper) &&
            !(excludedLetters && excludedLetters.has(upper))
          ) {
            eligible.push({ nodeIndex, charIndex, char });
          }
        }
        globalCharIndex += 1;
      }
    });
    return eligible;
  }

  function applyProbabilisticHeadingDuplicates(nodeValues, randomFn, options = {}) {
    if (!Array.isArray(nodeValues) || !nodeValues.length) return nodeValues;
    const nextValues = nodeValues.map((value) => String(value == null ? '' : value));
    const duplicateCount = pickProbabilisticDuplicateCount(randomFn);
    if (!duplicateCount) return nextValues;

    const excludedGlobalIndexes = buildExcludedDuplicateGlobalIndexes(nextValues, options.excludedWords);
    const eligible = collectEligibleDuplicateTargets(nextValues, {
      excludedGlobalIndexes,
      excludedLetters: options.excludedLetters,
    });
    if (!eligible.length) return nextValues;

    const target = eligible[Math.floor(randomFn() * eligible.length)];
    const chars = Array.from(nextValues[target.nodeIndex] || '');
    let duplicateRun = '';
    for (let index = 0; index < duplicateCount; index += 1) {
      duplicateRun += `${STRETCH_PRO_DUPLICATED_SEPARATOR}${target.char}`;
    }
    chars.splice(target.charIndex + 1, 0, duplicateRun);
    nextValues[target.nodeIndex] = chars.join('');

    return nextValues;
  }

  function normalizeRenderedDuplicateSeparators(nodeValues) {
    if (!Array.isArray(nodeValues) || !nodeValues.length) return [];
    return nodeValues.map((value) => {
      const raw = Array.from(String(value == null ? '' : value));
      if (!raw.length) return '';

      const cleaned = [];
      for (let index = 0; index < raw.length; index += 1) {
        const char = raw[index];
        if (!isStretchDuplicateSeparator(char)) {
          cleaned.push(char);
          continue;
        }

        let prevIndex = cleaned.length - 1;
        while (prevIndex >= 0 && isStretchDuplicateSeparator(cleaned[prevIndex])) prevIndex -= 1;
        let nextIndex = index + 1;
        while (nextIndex < raw.length && isStretchDuplicateSeparator(raw[nextIndex])) nextIndex += 1;
        if (prevIndex < 0 || nextIndex >= raw.length) continue;

        const prevChar = cleaned[prevIndex];
        const nextChar = raw[nextIndex];
        if (!isAlphabeticCharacter(prevChar) || !isAlphabeticCharacter(nextChar)) continue;
        if (prevChar.toLowerCase() !== nextChar.toLowerCase()) continue;

        const trailing = cleaned[cleaned.length - 1];
        if (isStretchDuplicateSeparator(trailing)) {
          if (trailing === STRETCH_PRO_CANONICAL_SEPARATOR && char === STRETCH_PRO_DUPLICATED_SEPARATOR) {
            cleaned[cleaned.length - 1] = STRETCH_PRO_DUPLICATED_SEPARATOR;
          }
          continue;
        }
        cleaned.push(char);
      }

      const normalized = [];
      for (let index = 0; index < cleaned.length; index += 1) {
        const char = cleaned[index];
        normalized.push(char);
        if (isStretchDuplicateSeparator(char)) continue;

        const nextChar = cleaned[index + 1];
        if (!nextChar || isStretchDuplicateSeparator(nextChar)) continue;
        if (!isAlphabeticCharacter(char) || !isAlphabeticCharacter(nextChar)) continue;
        if (char.toLowerCase() !== nextChar.toLowerCase()) continue;
        normalized.push(STRETCH_PRO_CANONICAL_SEPARATOR);
      }

      return normalized.join('');
    });
  }

  function extractHeadingTextNodes(heading) {
    if (!(heading instanceof HTMLElement)) return [];
    if (typeof document.createTreeWalker !== 'function') return [];

    const nodes = [];
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node || typeof node.nodeValue !== 'string') return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (parent && parent.closest(HEADING_TEXT_IGNORE_SELECTOR)) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue.length) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let current = walker.nextNode();
    while (current) {
      nodes.push(current);
      current = walker.nextNode();
    }
    return nodes;
  }

  function canonicalHeadingNodeValue(node) {
    const currentValue = String(node && node.nodeValue ? node.nodeValue : '');
    const lastRendered = headingRenderedTextByNode.get(node);
    const lastCanonical = headingCanonicalTextByNode.get(node);

    if (typeof lastCanonical === 'string' && typeof lastRendered === 'string' && currentValue === lastRendered) {
      return lastCanonical;
    }

    const canonical = stripZwnjCharacters(currentValue);
    headingCanonicalTextByNode.set(node, canonical);
    return canonical;
  }

  function normalizeHeadingRouteKey() {
    return `${normalizePathname(window.location.pathname || '/')}${window.location.search || ''}`;
  }

  function parseHeadingDuplicateExcludedWords(heading) {
    if (!(heading instanceof HTMLElement)) return new Set();
    const raw = String(heading.getAttribute(HEADING_DUPLICATE_EXCLUDE_WORDS_ATTR) || '').trim();
    if (!raw) return new Set();
    const words = raw
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter((value) => value.length > 1);
    return new Set(words);
  }

  function parseHeadingDuplicateExcludedLetters(heading) {
    if (!(heading instanceof HTMLElement)) return new Set();
    const raw = String(heading.getAttribute(HEADING_DUPLICATE_EXCLUDE_LETTERS_ATTR) || '').trim();
    if (!raw) return new Set();
    const letters = raw
      .split(/[\s,]+/g)
      .map((value) => value.trim().toUpperCase())
      .filter((value) => value.length > 0)
      .flatMap((value) => Array.from(value))
      .filter((char) => /^[A-Z]$/.test(char));
    return new Set(letters);
  }

  function shouldPreserveHeadingCanonicalSeparators(heading) {
    if (!(heading instanceof HTMLElement)) return false;
    const raw = String(heading.getAttribute(HEADING_PRESERVE_CANONICAL_ATTR) || '').trim().toLowerCase();
    if (!raw) return false;
    if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') return false;
    return true;
  }

  function decorateHeadingElement(heading, options = {}) {
    if (!(heading instanceof HTMLElement)) return false;
    if (isEntryPageBody()) return false;
    const textNodes = extractHeadingTextNodes(heading);
    if (!textNodes.length) return false;

    const canonicalNodeValues = textNodes.map((node) => canonicalHeadingNodeValue(node));
    const canonicalHeading = canonicalNodeValues.join('');
    if (!/\S/.test(canonicalHeading)) return false;

    const currentRendered = textNodes.map((node) => String(node.nodeValue || '')).join('');
    const routeKey = options.routeKey || normalizeHeadingRouteKey();
    const headingIndex = Number.isFinite(options.headingIndex) ? options.headingIndex : 0;
    const signature = `${routeKey}|${headingIndex}|${canonicalHeading}`;

    if (
      heading.getAttribute('data-dx-heading-signature') === signature &&
      heading.getAttribute('data-dx-heading-rendered') === currentRendered
    ) {
      heading.setAttribute('data-dx-heading-canonical', canonicalHeading);
      return false;
    }

    const separatedNodeValues = canonicalNodeValues.map((value) => insertCanonicalDoubleLetterSeparators(value));
    const randomFn = createHeadingRandom(signature);
    const excludedWords = parseHeadingDuplicateExcludedWords(heading);
    const excludedLetters = parseHeadingDuplicateExcludedLetters(heading);
    const randomizedNodeValues = applyProbabilisticHeadingDuplicates(separatedNodeValues, randomFn, {
      excludedWords,
      excludedLetters,
    });
    const normalizedNodeValues = normalizeRenderedDuplicateSeparators(randomizedNodeValues);
    // Preserve both separator classes in the rendered text:
    // - U+200C keeps organic double letters from forming a synthetic ligature.
    // - U+200D joins a deliberately duplicated letter into the display glyph.
    const renderedNodeValues = normalizedNodeValues;

    textNodes.forEach((node, index) => {
      const nextValue = renderedNodeValues[index] || '';
      node.nodeValue = nextValue;
      headingRenderedTextByNode.set(node, nextValue);
    });

    const renderedHeading = renderedNodeValues.join('');
    heading.setAttribute('data-dx-heading-canonical', canonicalHeading);
    heading.setAttribute('data-dx-heading-rendered', renderedHeading);
    heading.setAttribute('data-dx-heading-signature', signature);
    return true;
  }

  function applyHeadingTypographyEffects(root = document) {
    if (isEntryPageBody()) return 0;
    const scope = root instanceof Document ? (root.body || root.documentElement) : root;
    if (!(scope instanceof Element || scope instanceof DocumentFragment)) return 0;
    if (typeof scope.querySelectorAll !== 'function') return 0;

    const headings = Array.from(scope.querySelectorAll(HEADING_TYPOGRAPHY_SELECTOR));
    const routeKey = normalizeHeadingRouteKey();
    let changedCount = 0;
    headings.forEach((heading, index) => {
      if (decorateHeadingElement(heading, { headingIndex: index, routeKey })) {
        changedCount += 1;
      }
    });
    return changedCount;
  }

  function isEntryPageBody() {
    return !!(document.body && document.body.classList && document.body.classList.contains('dx-entry-page'));
  }

  function renderHeadingText(value, options = {}) {
    const source = options.uppercase === false ? String(value || '') : String(value || '').toUpperCase();
    const canonical = stripZwnjCharacters(source);
    if (isEntryPageBody()) return canonical;
    const separated = insertCanonicalDoubleLetterSeparators(canonical);
    const randomFn = createHeadingRandom(options.seedKey || canonical);
    const [rendered] = normalizeRenderedDuplicateSeparators(applyProbabilisticHeadingDuplicates([separated], randomFn));
    return rendered || separated;
  }

  function isDonateAnchor(anchor) {
    if (!(anchor instanceof HTMLAnchorElement)) return false;
    const hrefValue = String(anchor.getAttribute('href') || '').trim();
    if (!hrefValue) return false;
    const absoluteHref = toAbsoluteUrl(hrefValue);
    if (!absoluteHref) return false;
    if (!isHttpUrl(absoluteHref)) return false;
    if (!isSameOriginUrl(absoluteHref)) return false;
    return normalizePathname(absoluteHref.pathname) === '/donate';
  }

  function renderDonateLabel(options = {}) {
    const canonical = String(options.canonical || DONATE_LABEL_CANONICAL || '').toUpperCase();
    return renderHeadingText(canonical, { uppercase: false, seedKey: options.seedKey || `donate:${canonical}` });
  }

  function normalizeDonateActionLabels(root = document) {
    const scope = root instanceof Document ? (root.body || root.documentElement) : root;
    if (!(scope instanceof Element || scope instanceof DocumentFragment)) return 0;
    if (typeof scope.querySelectorAll !== 'function') return 0;

    const canonical = String(DONATE_LABEL_CANONICAL || '').toUpperCase();
    const routeKey = normalizeHeadingRouteKey();
    let normalizedCount = 0;

    const anchors = Array.from(scope.querySelectorAll(DONATE_LABEL_SELECTOR));
    for (let anchorIndex = 0; anchorIndex < anchors.length; anchorIndex += 1) {
      const anchor = anchors[anchorIndex];
      if (!(anchor instanceof HTMLAnchorElement)) continue;
      if (!isDonateAnchor(anchor)) continue;

      const signature = `${routeKey}|donate|${anchorIndex}|${canonical}`;
      const currentRendered = String(anchor.textContent || '');
      const priorSignature = String(anchor.getAttribute('data-dx-donate-signature') || '');
      const priorRendered = String(anchor.getAttribute('data-dx-donate-rendered') || '');
      const canReuseRendered = priorSignature === signature && priorRendered.length > 0 && currentRendered === priorRendered;
      const nextRendered = canReuseRendered
        ? priorRendered
        : renderDonateLabel({ canonical, seedKey: signature });

      if (currentRendered !== nextRendered) {
        anchor.textContent = nextRendered;
      }
      anchor.setAttribute('data-dx-donate-canonical', canonical);
      anchor.setAttribute('data-dx-donate-rendered', nextRendered);
      anchor.setAttribute('data-dx-donate-signature', signature);
      anchor.setAttribute('data-dx-donate-normalized', 'true');
      normalizedCount += 1;
    }

    return normalizedCount;
  }

  function exposeHeadingTypographyRuntime() {
    const runtime = {
      separator: STRETCH_PRO_DUPLICATED_SEPARATOR,
      canonicalSeparator: STRETCH_PRO_CANONICAL_SEPARATOR,
      duplicatedSeparator: STRETCH_PRO_DUPLICATED_SEPARATOR,
      duplicateLigatureLetters: Array.from(HEADING_DUPLICATE_LIGATURE_SUPPORTED).sort().join(''),
      decorateHeading: (heading, options = {}) => decorateHeadingElement(heading, options),
      decorateHeadings: (root = document) => applyHeadingTypographyEffects(root),
      renderHeadingText: (value, options = {}) => renderHeadingText(value, options),
    };
    try {
      window.__dxHeadingFx = runtime;
    } catch {}
  }

  exposeHeadingTypographyRuntime();

  function applyHeadingTypographyEffectsIfPossible(root = document) {
    try {
      applyHeadingTypographyEffects(root);
    } catch {}
  }

  function applyHeadingTypographyToElementIfPossible(heading, options = {}) {
    if (!(heading instanceof HTMLElement)) return;
    try {
      decorateHeadingElement(heading, options);
      return;
    } catch {}
    try {
      const headingFx = window.__dxHeadingFx;
      if (headingFx && typeof headingFx.decorateHeading === 'function') {
        headingFx.decorateHeading(heading, options);
      }
    } catch {}
  }

  function decorateCanonicalHeadingById(id, options = {}) {
    const heading = document.getElementById(id);
    if (!(heading instanceof HTMLElement)) return;
    applyHeadingTypographyToElementIfPossible(heading, options);
  }

  function decorateCanonicalHeadingBySelector(selector, options = {}) {
    const heading = document.querySelector(selector);
    if (!(heading instanceof HTMLElement)) return;
    applyHeadingTypographyToElementIfPossible(heading, options);
  }

  function decorateSupportAndErrorHeadings() {
    decorateCanonicalHeadingById('dx-error-title', { headingIndex: 0, routeKey: 'error:title' });
    decorateCanonicalHeadingBySelector('#dx-support .dx-support-title', { headingIndex: 0, routeKey: 'support:title' });
  }

  window.addEventListener('dx:support-status:rendered', decorateSupportAndErrorHeadings);
  window.addEventListener('dx:error-status:rendered', decorateSupportAndErrorHeadings);
  window.addEventListener('dx-home-hero:ready', (event) => {
    const root = event && event.target instanceof HTMLElement
      ? event.target
      : document.querySelector('[data-dx-home-hero-root]');
    applyHeadingTypographyEffectsIfPossible(root || document);
  });

  function applyHeadingTypographyAndSupportHooks(root = document) {
    applyHeadingTypographyEffectsIfPossible(root);
    normalizeDonateActionLabels(root);
    decorateSupportAndErrorHeadings();
  }

  function shouldPreserveOutsideSlot(node, headerElement) {
    if (!(node instanceof HTMLElement)) return true;
    if (node === headerElement) return true;
    if (headerElement && node.contains(headerElement)) return true;
    if (PRESERVED_IDS.has(node.id || '')) return true;
    if (PRESERVED_TAGS.has(node.tagName)) return true;
    if (node.hasAttribute('data-dx-slot-preserve')) return true;
    return false;
  }

  function ensureSlotRoots(container, headerElement) {
    let scrollRoot = document.getElementById(SLOT_SCROLL_ID);
    if (!scrollRoot) {
      scrollRoot = document.createElement('div');
      scrollRoot.id = SLOT_SCROLL_ID;
      scrollRoot.setAttribute('data-dx-slot-root', 'true');
    }

    let foregroundRoot = document.getElementById(SLOT_FOREGROUND_ID);
    if (!foregroundRoot) {
      foregroundRoot = document.createElement('div');
      foregroundRoot.id = SLOT_FOREGROUND_ID;
      foregroundRoot.setAttribute('data-dx-slot-foreground', 'true');
    }

    if (!scrollRoot.contains(foregroundRoot)) {
      scrollRoot.appendChild(foregroundRoot);
    }

    const insertAfterHeader = headerElement.nextSibling;
    if (scrollRoot.parentNode !== container) {
      if (insertAfterHeader) {
        container.insertBefore(scrollRoot, insertAfterHeader);
      } else {
        container.appendChild(scrollRoot);
      }
    }

    return { scrollRoot, foregroundRoot };
  }

  function moveForegroundNodes(container, headerElement, scrollRoot, foregroundRoot) {
    const children = Array.from(container.children);
    let canMove = false;

    for (const node of children) {
      if (node === headerElement) {
        canMove = true;
        continue;
      }
      if (!canMove) continue;
      if (node === scrollRoot || node === foregroundRoot) continue;
      if (shouldPreserveOutsideSlot(node, headerElement)) continue;
      foregroundRoot.appendChild(node);
    }
  }

  function moveDetachedFooterSectionsIntoForeground(foregroundRoot) {
    if (!(foregroundRoot instanceof HTMLElement)) return;
    if (!(document.body instanceof HTMLElement)) return;

    const detachedFooters = Array.from(document.body.children).filter((node) =>
      node instanceof HTMLElement
      && node.id === 'footer-sections'
      && node.parentElement === document.body
      && !foregroundRoot.contains(node)
    );

    for (const footer of detachedFooters) {
      foregroundRoot.appendChild(footer);
    }
  }

  function ensureBackdropLayersOutsideForeground() {
    if (!document.body) return;

    const scrollRoot = document.getElementById(SLOT_SCROLL_ID);
    const ids = ['scroll-gradient-bg', 'gooey-mesh-wrapper'];

    for (const id of ids) {
      const nodes = Array.from(document.querySelectorAll(`#${id}`)).filter((node) => node instanceof HTMLElement);
      if (!nodes.length) continue;

      const primary = nodes[nodes.length - 1];
      for (const node of nodes) {
        if (node === primary) continue;
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }

      if (primary.parentElement !== document.body) {
        if (scrollRoot && scrollRoot.parentElement === document.body) {
          document.body.insertBefore(primary, scrollRoot);
        } else {
          document.body.appendChild(primary);
        }
      }

      primary.setAttribute('data-dx-slot-preserve', 'true');
    }
  }

  function extractForegroundNodes(sourceDocument) {
    const sourceHeader = getHeaderElement(sourceDocument);
    let sourceContainer = (sourceHeader && sourceHeader.parentElement) || sourceDocument.body;
    if (!sourceContainer || sourceContainer.tagName === 'HEAD') {
      sourceContainer = sourceDocument.body || sourceDocument.documentElement;
    }
    const sourceChildren = Array.from(sourceContainer ? sourceContainer.children : []);
    const nodes = [];
    let canMove = sourceHeader ? !sourceContainer || !sourceContainer.contains(sourceHeader) : true;

    for (const node of sourceChildren) {
      if (sourceHeader && node === sourceHeader) {
        canMove = true;
        continue;
      }
      if (!canMove) continue;
      if (shouldPreserveOutsideSlot(node, sourceHeader)) continue;
      nodes.push(node);
    }

    return nodes;
  }

  function buildForegroundFragment(sourceDocument) {
    const fragment = document.createDocumentFragment();
    const nodes = extractForegroundNodes(sourceDocument);
    const inlineScripts = [];

    for (const node of nodes) {
      fragment.appendChild(document.importNode(node, true));
    }

    const scripts = Array.from(fragment.querySelectorAll('script'));
    for (const script of scripts) {
      if (script.getAttribute('src')) {
        script.remove();
        continue;
      }
      if (isLikelyGooeyMeshBootstrapScript(script)) {
        script.remove();
        continue;
      }
      const writeOutput = resolveDocumentWriteScriptOutput(script.textContent || '');
      if (writeOutput !== null) {
        script.replaceWith(document.createTextNode(writeOutput));
        continue;
      }
      if (!isExecutableInlineScript(script)) continue;
      inlineScripts.push({
        code: script.textContent || '',
        type: String(script.getAttribute('type') || '').trim(),
        noModule: script.hasAttribute('nomodule'),
      });
      script.remove();
    }

    return { fragment, inlineScripts };
  }

  function isExecutableInlineScript(script) {
    if (!(script instanceof HTMLScriptElement)) return false;
    if (script.getAttribute('src')) return false;

    const type = String(script.getAttribute('type') || '').trim().toLowerCase();
    if (!type) return true;
    if (type === 'text/javascript' || type === 'application/javascript') return true;
    if (type === 'application/ecmascript' || type === 'text/ecmascript') return true;
    return false;
  }

  function isLikelyGooeyMeshBootstrapScript(scriptOrCode) {
    const script = (scriptOrCode instanceof HTMLScriptElement) ? scriptOrCode : null;
    const code = String(script ? (script.textContent || '') : (scriptOrCode || ''));
    if (!code) return false;

    const scriptId = String(script && script.id || '').toLowerCase();
    if (scriptId && (scriptId.includes('gooey') || scriptId.includes('mesh') || scriptId.includes('scroll-gradient'))) {
      return true;
    }

    const hasMeshReference = code.includes('gooey-mesh-wrapper') || code.includes('gooey-blob');
    const hasMeshSelector = code.includes('querySelectorAll(".gooey-blob")')
      || code.includes('querySelectorAll(\'.gooey-blob\')')
      || code.includes('getElementsByClassName("gooey-blob")')
      || code.includes('getElementsByClassName(\'gooey-blob\')');
    const hasMeshLoop = (code.includes('requestAnimationFrame') || code.includes('setInterval'))
      && (
        code.includes('_x')
        || code.includes('_y')
        || code.includes('_vx')
        || code.includes('_vy')
        || code.includes('state.raf')
        || code.includes('blobs.forEach')
      );
    const hasGradientLoop = code.includes('scroll-gradient-bg')
      && (code.includes('addEventListener(\'scroll\'') || code.includes('addEventListener(\"scroll\"') || code.includes('scrollY'));

    return (hasMeshReference && (hasMeshLoop || hasMeshSelector)) || hasGradientLoop;
  }

  function ensureCanonicalGooeyMeshStyleTag() {
    const host = document.head || document.body;
    if (!host) return;

    let styleEl = document.getElementById(GOOEY_MESH_CANONICAL_STYLE_ID);
    if (!(styleEl instanceof HTMLStyleElement)) {
      styleEl = document.createElement('style');
      styleEl.id = GOOEY_MESH_CANONICAL_STYLE_ID;
      host.appendChild(styleEl);
    } else if (styleEl.parentElement !== host) {
      host.appendChild(styleEl);
    }

    styleEl.textContent = [
      'html body #gooey-mesh-wrapper {',
      '  pointer-events: none !important;',
      '}',
      'html body #gooey-mesh-wrapper .gooey-stage {',
      '  position: absolute !important;',
      '  inset: 0 !important;',
      '  filter: url("#goo") !important;',
      '}',
      'html body #gooey-mesh-wrapper .gooey-blob {',
      '  position: absolute !important;',
      '  top: 0 !important;',
      '  left: 0 !important;',
      '  width: var(--d) !important;',
      '  height: var(--d) !important;',
      '  border-radius: 50% !important;',
      '  background: radial-gradient(circle at 30% 30%, var(--g1a) 0%, var(--g1b) 45%, transparent 75%), radial-gradient(circle at 70% 70%, var(--g2a) 0%, var(--g2b) 45%, transparent 75%) !important;',
      '  filter: blur(34px) saturate(150%) !important;',
      '  will-change: transform !important;',
      '}',
      'html body #gooey-mesh-wrapper svg#goo-filter {',
      '  position: absolute !important;',
      '  width: 0 !important;',
      '  height: 0 !important;',
      '  overflow: hidden !important;',
      '  pointer-events: none !important;',
      '}',
    ].join('\n');
  }

  function ensureRouteChromeGuardStyleTag() {
    const host = document.head || document.body;
    if (!host) return;
    let styleEl = document.getElementById(ROUTE_CHROME_GUARD_STYLE_ID);
    if (!(styleEl instanceof HTMLStyleElement)) {
      styleEl = document.createElement('style');
      styleEl.id = ROUTE_CHROME_GUARD_STYLE_ID;
      host.appendChild(styleEl);
    } else if (styleEl.parentElement !== host) {
      host.appendChild(styleEl);
    }
    styleEl.textContent = [
      'html body #dx-mobile-menu[aria-hidden="true"] {',
      '  visibility: hidden !important;',
      '  opacity: 0 !important;',
      '  pointer-events: none !important;',
      '  transition: none !important;',
      '}',
    ].join('\n');
  }

  function ensureCanonicalGooeyFilterMarkup() {
    const wrapper = document.getElementById('gooey-mesh-wrapper');
    if (!(wrapper instanceof HTMLElement)) return;

    let svg = wrapper.querySelector('svg#goo-filter');
    if (!(svg instanceof SVGElement)) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('id', 'goo-filter');
      svg.setAttribute('aria-hidden', 'true');
      wrapper.appendChild(svg);
    }

    let defs = svg.querySelector('defs');
    if (!(defs instanceof Element) || String(defs.tagName || '').toLowerCase() !== 'defs') {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(defs);
    }

    let filter = defs.querySelector('filter#goo');
    if (!(filter instanceof Element) || String(filter.tagName || '').toLowerCase() !== 'filter') {
      filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      filter.setAttribute('id', 'goo');
      defs.appendChild(filter);
    }

    while (filter.firstChild) filter.removeChild(filter.firstChild);

    const blur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
    blur.setAttribute('in', 'SourceGraphic');
    blur.setAttribute('stdDeviation', '15');
    blur.setAttribute('result', 'blur');

    const matrix = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
    matrix.setAttribute('in', 'blur');
    matrix.setAttribute('mode', 'matrix');
    matrix.setAttribute('values', '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8');
    matrix.setAttribute('result', 'goo');

    const blend = document.createElementNS('http://www.w3.org/2000/svg', 'feBlend');
    blend.setAttribute('in', 'SourceGraphic');
    blend.setAttribute('in2', 'goo');
    blend.setAttribute('mode', 'normal');

    filter.appendChild(blur);
    filter.appendChild(matrix);
    filter.appendChild(blend);
  }

  function ensureCanonicalGooeyMeshPresentation() {
    ensureRouteChromeGuardStyleTag();
    ensureCanonicalGooeyMeshStyleTag();
    ensureCanonicalGooeyFilterMarkup();
  }

  function normalizeGooeyVelocityPair(vxRaw, vyRaw, fallbackAngle = 0) {
    const vx = Number(vxRaw);
    const vy = Number(vyRaw);
    if (!Number.isFinite(vx) || !Number.isFinite(vy)) return null;

    const speed = Math.hypot(vx, vy);
    if (!Number.isFinite(speed) || speed <= 0.0001) {
      const angle = Number.isFinite(fallbackAngle) ? fallbackAngle : 0;
      return {
        vx: Math.cos(angle) * GOOEY_SPEED_DEFAULT,
        vy: Math.sin(angle) * GOOEY_SPEED_DEFAULT,
      };
    }

    // Clamp the magnitude into the [MIN, MAX] band rather than pinning every
    // blob to a single DEFAULT speed. Pinning to DEFAULT made velocities visibly
    // snap on every route change (the "speeds up/down" symptom); banding keeps
    // each blob's own pace while preventing runaway/stall speeds.
    const clampedSpeed = Math.min(GOOEY_SPEED_MAX, Math.max(GOOEY_SPEED_MIN, speed));
    const scale = clampedSpeed / speed;
    return {
      vx: vx * scale,
      vy: vy * scale,
    };
  }

  function normalizeGooeyMeshStateSnapshot(state) {
    if (!Array.isArray(state) || !state.length) return null;

    return state.map((item, index) => {
      if (!item || typeof item !== 'object') return item;
      const next = { ...item };
      const fallbackAngle = Number.isFinite(Number(next.rad))
        ? Number(next.rad)
        : ((index + 1) * 2.399963229728653);
      const normalizedVelocity = normalizeGooeyVelocityPair(next.vx, next.vy, fallbackAngle);
      if (normalizedVelocity) {
        next.vx = normalizedVelocity.vx;
        next.vy = normalizedVelocity.vy;
      }
      const phase = Number(next.phase);
      next.phase = Number.isFinite(phase) ? phase : fallbackAngle;
      const waxMass = Number(next.waxMass);
      next.waxMass = Number.isFinite(waxMass)
        ? Math.min(GOOEY_WAX_MAX_MASS, Math.max(GOOEY_WAX_MIN_MASS, waxMass))
        : 1;
      const waxHoldUntil = Number(next.waxHoldUntil);
      next.waxHoldUntil = Number.isFinite(waxHoldUntil) ? Math.max(0, waxHoldUntil) : 0;
      const waxReadyAt = Number(next.waxReadyAt);
      next.waxReadyAt = Number.isFinite(waxReadyAt) ? Math.max(0, waxReadyAt) : 0;
      const waxPartner = Number(next.waxPartner);
      next.waxPartner = Number.isInteger(waxPartner) ? waxPartner : -1;
      return next;
    });
  }

  function normalizeLiveGooeyMeshVelocities() {
    const wrapper = document.getElementById('gooey-mesh-wrapper');
    if (!wrapper) return;
    const blobs = Array.from(wrapper.querySelectorAll('.gooey-blob'));
    if (!blobs.length) return;

    for (let index = 0; index < blobs.length; index += 1) {
      const blob = blobs[index];
      const fallbackAngle = (index + 1) * 2.399963229728653;
      const normalizedVelocity = normalizeGooeyVelocityPair(blob._vx, blob._vy, fallbackAngle);
      if (!normalizedVelocity) continue;
      blob._vx = normalizedVelocity.vx;
      blob._vy = normalizedVelocity.vy;
    }
  }

  function resolveGooeyBlobRadius(blob) {
    if (!(blob instanceof HTMLElement)) return 120;
    const offsetWidth = Number(blob.offsetWidth);
    if (Number.isFinite(offsetWidth) && offsetWidth > 0) {
      return offsetWidth / 2;
    }
    try {
      const computedWidth = Number.parseFloat(window.getComputedStyle(blob).width || '');
      if (Number.isFinite(computedWidth) && computedWidth > 0) {
        return computedWidth / 2;
      }
    } catch {}
    return 120;
  }

  function clampGooeyCoordinate(value, min, max) {
    if (!Number.isFinite(value)) return min;
    if (max <= min) return min;
    return Math.min(max, Math.max(min, value));
  }

  function resolveGooeyWaxMass(blob) {
    const mass = Number(blob && blob._waxMass);
    if (!Number.isFinite(mass)) return 1;
    return Math.min(GOOEY_WAX_MAX_MASS, Math.max(GOOEY_WAX_MIN_MASS, mass));
  }

  function resolveGooeyVisualRadius(blob) {
    const baseRadius = Number(blob && blob._rad) > 0
      ? Number(blob._rad)
      : resolveGooeyBlobRadius(blob);
    return baseRadius * GOOEY_VISUAL_SCALE * Math.sqrt(resolveGooeyWaxMass(blob));
  }

  function applyGooeyBlobTransform(blob) {
    if (!(blob instanceof HTMLElement)) return;
    if (!Number.isFinite(Number(blob._x)) || !Number.isFinite(Number(blob._y))) return;
    const waxMass = resolveGooeyWaxMass(blob);
    const waxScale = GOOEY_VISUAL_SCALE * Math.sqrt(waxMass);
    blob.style.transform = `translate(${Number(blob._x)}px, ${Number(blob._y)}px) translate(-50%, -50%) scale(${waxScale})`;
    const waxState = waxMass <= 0.24 ? 'consumed' : (waxMass >= 1.35 ? 'dominant' : 'free');
    blob.setAttribute('data-dx-gooey-wax-state', waxState);
    blob.style.zIndex = waxState === 'dominant' ? String(Math.round(waxMass * 10)) : '';
    const waxVisibility = Math.min(1, Math.max(0, (waxMass - GOOEY_WAX_MIN_MASS) / 0.18));
    const opacityRoute = String(window.location.pathname || '/');
    const shouldRefreshBaseOpacity = !Number.isFinite(Number(blob._waxBaseOpacity))
      || String(blob._waxBaseOpacityRoute || '') !== opacityRoute;
    if (waxVisibility >= 0.995) {
      if (blob.style.opacity || shouldRefreshBaseOpacity) {
        blob.style.opacity = '';
        const computedOpacity = Number.parseFloat(window.getComputedStyle(blob).opacity || '');
        blob._waxBaseOpacity = Number.isFinite(computedOpacity) ? computedOpacity : 1;
        blob._waxBaseOpacityRoute = opacityRoute;
      }
    } else {
      if (shouldRefreshBaseOpacity) {
        blob.style.opacity = '';
        const computedOpacity = Number.parseFloat(window.getComputedStyle(blob).opacity || '');
        blob._waxBaseOpacity = Number.isFinite(computedOpacity) ? computedOpacity : 1;
        blob._waxBaseOpacityRoute = opacityRoute;
      }
      blob.style.opacity = String(Number(blob._waxBaseOpacity) * waxVisibility);
    }
  }

  function blobsLookStackedAtSpawn(entries) {
    if (!Array.isArray(entries) || entries.length < 2) return false;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    let normalizedDistanceTotal = 0;
    let normalizedDistancePairs = 0;
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const x = Number(entry.x);
      const y = Number(entry.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return true;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (let otherIndex = index + 1; otherIndex < entries.length; otherIndex += 1) {
        const other = entries[otherIndex];
        const radiusSum = Math.max(1, Number(entry.rad) + Number(other.rad));
        normalizedDistanceTotal += Math.hypot(x - Number(other.x), y - Number(other.y)) / radiusSum;
        normalizedDistancePairs += 1;
      }
    }

    const meanNormalizedDistance = normalizedDistancePairs
      ? normalizedDistanceTotal / normalizedDistancePairs
      : Infinity;
    return ((maxX - minX) < 8 && (maxY - minY) < 8)
      || meanNormalizedDistance < 0.72;
  }

  function seedInitialGooeyMeshPositionsIfStacked() {
    const wrapper = document.getElementById('gooey-mesh-wrapper');
    if (!wrapper) return false;
    const blobs = Array.from(wrapper.querySelectorAll('.gooey-blob'));
    if (!blobs.length) return false;

    const viewportWidth = Number(window.innerWidth);
    const viewportHeight = Number(window.innerHeight);
    if (!Number.isFinite(viewportWidth) || !Number.isFinite(viewportHeight) || viewportWidth <= 0 || viewportHeight <= 0) {
      return false;
    }

    const entries = blobs.map((blob, index) => {
      const radius = resolveGooeyBlobRadius(blob);
      if (!Number.isFinite(Number(blob._rad)) || Number(blob._rad) <= 0) {
        blob._rad = radius;
      }
      return {
        blob,
        index,
        rad: Number(blob._rad) > 0 ? Number(blob._rad) : radius,
        x: Number(blob._x),
        y: Number(blob._y),
      };
    });

    if (!blobsLookStackedAtSpawn(entries)) return false;

    const sorted = [...entries].sort((a, b) => b.rad - a.rad);
    const placed = [];
    const anchorX = viewportWidth * 0.5;
    const anchorY = viewportHeight * 0.5;
    const clusterRadius = Math.hypot(viewportWidth, viewportHeight) * 0.38;
    const separationScales = [1.06, 0.94, 0.84];

    for (const entry of sorted) {
      const radius = entry.rad;
      const minX = radius;
      const maxX = viewportWidth - radius;
      const minY = radius;
      const maxY = viewportHeight - radius;
      let point = null;

      for (const scale of separationScales) {
        for (let attempt = 0; attempt < 120; attempt += 1) {
          const angle = Math.random() * Math.PI * 2;
          const distance = Math.pow(Math.random(), 0.72) * clusterRadius;
          const x = clampGooeyCoordinate(anchorX + Math.cos(angle) * distance, minX, maxX);
          const y = clampGooeyCoordinate(anchorY + Math.sin(angle) * distance, minY, maxY);
          let collides = false;

          for (const existing of placed) {
            const minSeparation = Math.max(16, (radius + existing.rad) * scale);
            if (Math.hypot(x - existing.x, y - existing.y) < minSeparation) {
              collides = true;
              break;
            }
          }

          if (!collides) {
            point = { x, y };
            break;
          }
        }
        if (point) break;
      }

      if (!point) {
        const x = clampGooeyCoordinate((0.08 + Math.random() * 0.84) * viewportWidth, minX, maxX);
        const y = clampGooeyCoordinate((0.08 + Math.random() * 0.84) * viewportHeight, minY, maxY);
        point = { x, y };
      }

      entry.blob._x = point.x;
      entry.blob._y = point.y;
      entry.blob._rad = radius;
      applyGooeyBlobTransform(entry.blob);
      placed.push({ x: point.x, y: point.y, rad: radius });
    }

    return true;
  }

  function readPersistedGooeyMeshState() {
    try {
      const raw = sessionStorage.getItem(GOOEY_MESH_STATE_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) && Number(parsed && parsed.version) !== GOOEY_MESH_STATE_VERSION) {
        return null;
      }
      const state = Array.isArray(parsed) ? parsed : parsed && parsed.state;
      return normalizeGooeyMeshStateSnapshot(state);
    } catch {
      return null;
    }
  }

  function persistGooeyMeshState(state = null) {
    const snapshot = normalizeGooeyMeshStateSnapshot(state || captureGooeyMeshState());
    if (!Array.isArray(snapshot) || !snapshot.length) return;
    try {
      sessionStorage.setItem(GOOEY_MESH_STATE_STORAGE_KEY, JSON.stringify({
        version: GOOEY_MESH_STATE_VERSION,
        timestamp: Date.now(),
        state: snapshot,
      }));
    } catch {}
  }

  function resolveDocumentWriteScriptOutput(sourceCode) {
    const code = String(sourceCode || '').trim();
    if (!code) return '';

    const match = code.match(/^document\.write\(([\s\S]*)\);?$/);
    if (!match) return null;

    const expression = String(match[1] || '').trim();
    if (!expression) return '';

    const randomizeCallMatch = expression.match(/^randomizeTitle\(([\s\S]*)\)$/);
    if (randomizeCallMatch) {
      const value = parseSingleJsStringLiteral(randomizeCallMatch[1]);
      return randomizeTitleText(value || '');
    }

    const literal = parseSingleJsStringLiteral(expression);
    if (literal !== null) return literal;

    return '';
  }

  function parseSingleJsStringLiteral(expression) {
    const raw = String(expression || '').trim();
    if (!raw) return '';
    const first = raw[0];
    const last = raw[raw.length - 1];
    if (!first || first !== last) return null;
    if (first !== '\'' && first !== '"' && first !== '`') return null;

    const inner = raw.slice(1, -1);
    if (first === '\'') return inner.replace(/\\'/g, '\'').replace(/\\\\/g, '\\');
    if (first === '`') return inner.replace(/\\`/g, '`').replace(/\\\\/g, '\\');
    try {
      return JSON.parse(raw);
    } catch {
      return inner.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
  }

  function randomizeTitleText(input, options = {}) {
    return renderHeadingText(input, options);
  }

  function dispatchSlotReady(scrollRoot, foregroundRoot, routeUrl = window.location.href) {
    const detail = { scrollRoot, foregroundRoot, url: String(routeUrl || window.location.href) };
    window.__dxLastSlotUrl = detail.url;
    try {
      window.dispatchEvent(new CustomEvent('dx:slotready', { detail }));
      return;
    } catch {}
    const legacyEvent = document.createEvent('Event');
    legacyEvent.initEvent('dx:slotready', false, false);
    legacyEvent.detail = detail;
    window.dispatchEvent(legacyEvent);
  }

  function scrollToHashTarget(hashValue) {
    const hash = String(hashValue || '').trim();
    if (!hash || hash === '#') return;
    let id = hash.replace(/^#/, '');
    try {
      id = decodeURIComponent(id);
    } catch {}
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    try {
      target.scrollIntoView({ block: 'start', inline: 'nearest' });
      return;
    } catch {}
    target.scrollIntoView();
  }

  function alignBlockToHeaderFrame(blockEl, headerRect) {
    if (!(blockEl instanceof HTMLElement)) return;
    if (!Number.isFinite(headerRect.width) || headerRect.width <= 0) return;

    const targetWidth = Math.round(headerRect.width);
    blockEl.style.setProperty('width', `${targetWidth}px`, 'important');
    blockEl.style.setProperty('max-width', `${targetWidth}px`, 'important');
    blockEl.style.setProperty('box-sizing', 'border-box', 'important');
    blockEl.style.setProperty('margin-left', '0', 'important');
    blockEl.style.setProperty('margin-right', '0', 'important');
    blockEl.style.setProperty('left', '0', 'important');
    blockEl.style.setProperty('position', 'relative', 'important');
    blockEl.style.setProperty('transform', 'none', 'important');

    const blockRect = blockEl.getBoundingClientRect();
    const headerCenterX = headerRect.left + (headerRect.width / 2);
    const blockCenterX = blockRect.left + (blockRect.width / 2);
    const shiftX = Math.round((headerCenterX - blockCenterX) * 1000) / 1000;
    blockEl.style.setProperty('transform', `translateX(${shiftX}px)`, 'important');
  }

  function isMobileViewport() {
    try {
      return window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches;
    } catch {
      return window.innerWidth <= 980;
    }
  }

  function isProfileFooterInlineViewport() {
    try {
      return window.matchMedia(PROFILE_FOOTER_INLINE_QUERY).matches;
    } catch {
      return window.innerWidth <= 900;
    }
  }

  function sanitizeClonedNode(node) {
    if (!(node instanceof HTMLElement)) return node;
    if (node.hasAttribute('id')) node.removeAttribute('id');
    const descendantsWithIds = Array.from(node.querySelectorAll('[id]'));
    for (const descendant of descendantsWithIds) {
      descendant.removeAttribute('id');
    }
    return node;
  }

  function getCurrentReturnTo() {
    return `${window.location.pathname || '/'}${window.location.search || ''}${window.location.hash || ''}`;
  }

  async function triggerMobileLogin() {
    const returnTo = getCurrentReturnTo();
    const dexAuth = window.DEX_AUTH || window.dexAuth || null;
    if (dexAuth && typeof dexAuth.signIn === 'function') {
      await Promise.resolve(dexAuth.signIn(returnTo));
      return true;
    }

    const signInButton = document.getElementById('auth-ui-signin');
    if (signInButton instanceof HTMLElement) {
      signInButton.click();
      return true;
    }

    const loginAnchor = document.querySelector('.header-display-desktop .customerAccountLoginDesktop a[href], .header-display-mobile .customerAccountLoginDesktop a[href]');
    if (loginAnchor instanceof HTMLElement) {
      loginAnchor.click();
      return true;
    }

    return false;
  }

  async function triggerMobileLogout() {
    const dexAuth = window.DEX_AUTH || window.dexAuth || null;
    if (dexAuth && typeof dexAuth.signOut === 'function') {
      await Promise.resolve(dexAuth.signOut(window.location.origin));
      return true;
    }

    const logoutButton = document.getElementById('auth-ui-logout');
    if (logoutButton instanceof HTMLElement) {
      logoutButton.click();
      return true;
    }

    window.location.assign('/');
    return true;
  }

  function inferMobileAuthFromDom() {
    if (String(window.auth0Sub || '').trim()) return true;
    if (window.AUTH0_USER && typeof window.AUTH0_USER === 'object') return true;

    const profileWrap = document.getElementById('auth-ui-profile');
    if (profileWrap instanceof HTMLElement) {
      const profileVisible = !profileWrap.hidden && !profileWrap.hasAttribute('hidden');
      if (profileVisible) return true;
    }
    return false;
  }

  function withMobileAuthTimeout(promise, fallback, timeoutMs = 1800) {
    return new Promise((resolve) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve(fallback);
      }, timeoutMs);
      Promise.resolve(promise)
        .then((value) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          resolve(value);
        })
        .catch(() => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          resolve(fallback);
        });
    });
  }

  function resolveMobileMenuAuthSnapshot({ force = false } = {}) {
    if (force) {
      mobileMenuAuthProbeToken += 1;
      mobileMenuAuthProbePromise = null;
      mobileMenuAuthSnapshot = { authenticated: false, user: null, resolved: false };
    }

    if (mobileMenuAuthSnapshot.resolved) {
      return Promise.resolve(mobileMenuAuthSnapshot);
    }

    if (mobileMenuAuthProbePromise) {
      return mobileMenuAuthProbePromise;
    }

    const probeToken = ++mobileMenuAuthProbeToken;
    mobileMenuAuthProbePromise = (async () => {
      let authenticated = inferMobileAuthFromDom();
      let user = window.AUTH0_USER && typeof window.AUTH0_USER === 'object' ? window.AUTH0_USER : null;
      const dexAuth = window.DEX_AUTH || window.dexAuth || null;
      if (dexAuth && typeof dexAuth.isAuthenticated === 'function') {
        authenticated = !!(await withMobileAuthTimeout(dexAuth.isAuthenticated(), authenticated));
      }
      if (authenticated && dexAuth && typeof dexAuth.getUser === 'function') {
        user = await withMobileAuthTimeout(dexAuth.getUser(), user);
      }
      return {
        authenticated,
        user: authenticated ? (user || null) : null,
        resolved: true,
      };
    })()
      .then((snapshot) => {
        if (probeToken === mobileMenuAuthProbeToken) {
          mobileMenuAuthSnapshot = snapshot;
        }
        return snapshot;
      })
      .catch(() => {
        const fallbackSnapshot = {
          authenticated: inferMobileAuthFromDom(),
          user: window.AUTH0_USER && typeof window.AUTH0_USER === 'object' ? window.AUTH0_USER : null,
          resolved: true,
        };
        if (probeToken === mobileMenuAuthProbeToken) {
          mobileMenuAuthSnapshot = fallbackSnapshot;
        }
        return fallbackSnapshot;
      })
      .finally(() => {
        if (probeToken === mobileMenuAuthProbeToken) {
          mobileMenuAuthProbePromise = null;
        }
      });

    return mobileMenuAuthProbePromise;
  }

  function setMobileMenuBackgroundInert(root, inert) {
    if (!(root instanceof HTMLElement)) return;
    if (inert) {
      mobileMenuInertState = [];
      for (const child of Array.from(document.body.children)) {
        if (!(child instanceof HTMLElement) || child === root) continue;
        if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE') continue;
        mobileMenuInertState.push({
          element: child,
          inert: Boolean(child.inert),
          ariaHidden: child.getAttribute('aria-hidden'),
        });
        child.inert = true;
        child.setAttribute('data-dx-mobile-menu-inert', 'true');
      }
      return;
    }

    for (const entry of mobileMenuInertState) {
      if (!entry || !(entry.element instanceof HTMLElement)) continue;
      entry.element.inert = entry.inert;
      entry.element.removeAttribute('data-dx-mobile-menu-inert');
      if (entry.ariaHidden == null) {
        entry.element.removeAttribute('aria-hidden');
      } else {
        entry.element.setAttribute('aria-hidden', entry.ariaHidden);
      }
    }
    mobileMenuInertState = [];
  }

  function getMobileMenuFocusable(root) {
    if (!(root instanceof HTMLElement)) return [];
    return Array.from(root.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => (
      element instanceof HTMLElement
      && !element.hidden
      && element.getAttribute('aria-hidden') !== 'true'
      && !(element.closest('[data-dx-mobile-menu-panel]') instanceof HTMLElement
        && element.closest('[data-dx-mobile-menu-panel]').getAttribute('aria-hidden') === 'true')
      && element.getClientRects().length > 0
    ));
  }

  function setMobileMenuView(root, view, { focus = true } = {}) {
    if (!(root instanceof HTMLElement)) return;
    const nextView = view === 'account' ? 'account' : 'site';
    root.setAttribute('data-dx-mobile-menu-view', nextView);
    const siteView = root.querySelector('[data-dx-mobile-menu-panel="site"]');
    const accountView = root.querySelector('[data-dx-mobile-menu-panel="account"]');
    if (siteView instanceof HTMLElement) {
      siteView.inert = nextView !== 'site';
      siteView.setAttribute('aria-hidden', nextView === 'site' ? 'false' : 'true');
    }
    if (accountView instanceof HTMLElement) {
      accountView.inert = nextView !== 'account';
      accountView.setAttribute('aria-hidden', nextView === 'account' ? 'false' : 'true');
    }
    if (!focus) return;
    const target = nextView === 'account'
      ? root.querySelector('[data-dx-mobile-account-back="true"]')
      : root.querySelector('[data-dx-mobile-account-open="true"], [data-dx-mobile-login-trigger="true"]');
    if (target instanceof HTMLElement) {
      try {
        target.focus({ preventScroll: true });
      } catch {
        target.focus();
      }
    }
  }

  function closeMobileMenu({ restoreFocus = true } = {}) {
    const root = document.getElementById(MOBILE_MENU_ROOT_ID);
    if (!root) return;

    document.body.classList.remove(MOBILE_MENU_OPEN_CLASS);
    if (mobileMenuCloseTimer) {
      clearTimeout(mobileMenuCloseTimer);
      mobileMenuCloseTimer = 0;
    }
    mobileMenuCloseTimer = window.setTimeout(() => {
      if (!document.body.classList.contains(MOBILE_MENU_OPEN_CLASS)) {
        root.setAttribute('aria-hidden', 'true');
        setMobileMenuView(root, 'site', { focus: false });
      }
      mobileMenuCloseTimer = 0;
    }, MOBILE_MENU_CLOSE_MS);

    document.body.style.overflow = mobileMenuBodyOverflow;
    const scrollRoot = document.getElementById(SLOT_SCROLL_ID);
    if (scrollRoot instanceof HTMLElement) {
      if (mobileMenuScrollOverflow) {
        scrollRoot.style.overflowY = mobileMenuScrollOverflow;
      } else {
        scrollRoot.style.removeProperty('overflow-y');
      }
    }
    setMobileMenuBackgroundInert(root, false);

    const burgerButtons = Array.from(document.querySelectorAll('.header-display-mobile .header-burger-btn'));
    for (const button of burgerButtons) {
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-label', 'Open menu');
    }

    if (restoreFocus && mobileMenuLastFocused && mobileMenuLastFocused instanceof HTMLElement) {
      try {
        mobileMenuLastFocused.focus({ preventScroll: true });
      } catch {}
    }
    mobileMenuLastFocused = null;
  }

  function markMobileMenuActiveForPath(pathname) {
    const root = document.getElementById(MOBILE_MENU_ROOT_ID);
    if (!root) return;

    const normalizedTarget = normalizePathname(pathname);
    const links = Array.from(root.querySelectorAll('a[data-dx-mobile-menu-route]'));
    for (const link of links) {
      const routePath = normalizePathname(String(link.getAttribute('data-dx-mobile-menu-route') || ''));
      const isActive = routePath === normalizedTarget
        || (routePath !== '/' && normalizedTarget.startsWith(`${routePath}/`));
      link.setAttribute('data-dx-mobile-menu-active', isActive ? 'true' : 'false');
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    }

    const accountRouteActive = MOBILE_ACCOUNT_TILES.some((item) => {
      const routePath = normalizePathname(item.href);
      return routePath === normalizedTarget || normalizedTarget.startsWith(`${routePath}/`);
    });
    const accountTrigger = root.querySelector('[data-dx-mobile-account-open="true"]');
    if (accountTrigger instanceof HTMLElement) {
      accountTrigger.setAttribute('data-dx-mobile-menu-active', accountRouteActive ? 'true' : 'false');
    }
  }

  function getUniqueAnchors(candidates) {
    const unique = [];
    const seen = new Set();
    for (const anchor of candidates) {
      if (!(anchor instanceof HTMLAnchorElement)) continue;
      const href = String(anchor.getAttribute('href') || '').trim();
      if (!href) continue;
      if (href.startsWith('javascript:')) continue;
      const text = String(anchor.textContent || '').trim();
      const key = `${href}::${text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(anchor);
    }
    return unique;
  }

  function mobileMenuIcon(name) {
    const desktopAccountIcon = window.DEX_ACCOUNT_MENU_ICON;
    if (typeof desktopAccountIcon === 'function') {
      try {
        const sharedIcon = String(desktopAccountIcon(name) || '').trim();
        if (sharedIcon) return sharedIcon;
      } catch {}
    }
    const paths = {
      catalog: '<path d="M4 5.5h6.5A2.5 2.5 0 0 1 13 8v11H6a2 2 0 0 1-2-2V5.5Z"/><path d="M20 5.5h-4.5A2.5 2.5 0 0 0 13 8v11h5a2 2 0 0 0 2-2V5.5Z"/><path d="M7 9h3M16 9h1"/>',
      call: '<path d="M4 12h3l2.1-5 3.3 10 2.2-7 1.6 2H20"/><path d="M18 4v4M16 6h4"/>',
      notes: '<path d="M6 3.5h9l3 3V20H6V3.5Z"/><path d="M15 3.5V7h3M9 11h6M9 15h6"/>',
      about: '<circle cx="12" cy="12" r="8.5"/><path d="M12 10.5V17M12 7.4h.01"/>',
      account: '<circle cx="12" cy="8" r="3.25"/><path d="M5.5 19c.6-3.2 3-5 6.5-5s5.9 1.8 6.5 5"/>',
      donate: '<path d="M12 20s-8-4.4-8-10.2C4 6.7 6 5 8.5 5c1.6 0 2.9.8 3.5 2 .6-1.2 1.9-2 3.5-2C18 5 20 6.7 20 9.8 20 15.6 12 20 12 20Z"/>',
      favorites: '<path d="M12 20s-8-4.4-8-10.2C4 6.7 6 5 8.5 5c1.6 0 2.9.8 3.5 2 .6-1.2 1.9-2 3.5-2C18 5 20 6.7 20 9.8 20 15.6 12 20 12 20Z"/>',
      polls: '<path d="M5 19V10M12 19V5M19 19v-6"/><path d="M3 19h18"/>',
      submit: '<path d="M6 4h8l4 4v12H6V4Z"/><path d="M14 4v4h4M12 17V10M9.5 12.5 12 10l2.5 2.5"/>',
      messages: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="m5 7 7 6 7-6"/>',
      press: '<path d="M4 5h12v15H6a2 2 0 0 1-2-2V5Z"/><path d="M16 9h4v9a2 2 0 0 1-2 2H8M7.5 9h5M7.5 13h5M7.5 17h3"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
      achievements: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8.5 20h7M10 17h4"/>',
      logout: '<path d="M10 5H6v14h4M14 8l4 4-4 4M9 12h9"/>',
    };
    return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><g stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.about}</g></svg>`;
  }

  function createMobileMenuAvatar(user, className = '') {
    const avatar = document.createElement('span');
    avatar.className = `dx-mobile-menu-avatar${className ? ` ${className}` : ''}`;
    const name = String((user && (user.name || user.nickname)) || 'Dex member').trim();
    const picture = String((user && user.picture) || '').trim();
    if (/^https?:\/\//i.test(picture)) {
      const image = document.createElement('img');
      image.src = picture;
      image.alt = '';
      image.referrerPolicy = 'no-referrer';
      avatar.appendChild(image);
    } else {
      const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('') || 'DX';
      avatar.textContent = initials;
    }
    return avatar;
  }

  function getMobileUserName(user) {
    const name = String((user && (user.name || user.nickname)) || '').trim();
    if (name) return name;
    const email = String((user && user.email) || '').trim();
    return email ? email.split('@')[0] : 'Your Dex';
  }

  function createMobileMenuTile(item, options = {}) {
    const isButton = options.button === true;
    const tile = document.createElement(isButton ? 'button' : 'a');
    if (isButton) {
      tile.type = 'button';
    } else {
      tile.href = item.href;
      tile.setAttribute('data-dx-mobile-menu-route', normalizePathname(item.href));
    }
    tile.className = 'dx-mobile-menu-tile';
    if (item.featured) tile.classList.add('dx-mobile-menu-tile--featured');
    if (options.action) tile.classList.add('dx-mobile-menu-tile--action');
    if (options.danger) tile.classList.add('dx-mobile-menu-tile--danger');
    if (options.account) tile.classList.add('dx-mobile-menu-tile--account');
    tile.setAttribute('data-dx-mobile-menu-tile', item.key);
    tile.style.setProperty('--dx-mobile-menu-index', String(options.index || 0));

    const icon = document.createElement('span');
    icon.className = 'dx-mobile-menu-tile-icon';
    if (options.avatar) {
      icon.appendChild(createMobileMenuAvatar(options.user));
    } else {
      icon.innerHTML = mobileMenuIcon(item.icon);
    }

    const copy = document.createElement('span');
    copy.className = 'dx-mobile-menu-tile-copy';
    const label = document.createElement('strong');
    label.className = 'dx-mobile-menu-tile-label';
    label.textContent = item.label;
    copy.appendChild(label);
    if (item.detail) {
      const detail = document.createElement('span');
      detail.className = 'dx-mobile-menu-tile-detail';
      detail.textContent = item.detail;
      copy.appendChild(detail);
    }

    const arrow = document.createElement('span');
    arrow.className = 'dx-mobile-menu-tile-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = options.back ? '←' : '↗';
    tile.append(icon, copy);
    if (item.badge) {
      const badge = document.createElement('span');
      badge.className = 'dx-mobile-menu-unread';
      badge.setAttribute('data-dx-mobile-unread-badge', 'true');
      badge.hidden = true;
      tile.appendChild(badge);
    }
    tile.appendChild(arrow);
    return tile;
  }

  function renderMobileMenuBrand(root) {
    const brand = root.querySelector('[data-dx-mobile-menu-brand="true"]');
    if (!(brand instanceof HTMLElement)) return;
    clearChildren(brand);
    const source = document.querySelector(
      '.header-display-mobile .header-title-logo a[href], .header-display-desktop .header-title-logo a[href]'
    );
    if (source instanceof HTMLAnchorElement) {
      const clone = sanitizeClonedNode(source.cloneNode(true));
      if (clone instanceof HTMLAnchorElement) {
        clone.setAttribute('aria-label', 'Dex home');
        brand.appendChild(clone);
        return;
      }
    }
    const fallback = document.createElement('a');
    fallback.href = '/';
    fallback.setAttribute('aria-label', 'Dex home');
    fallback.textContent = 'dex';
    brand.appendChild(fallback);
  }

  function renderMobileMenuSocial(root) {
    const socialHost = root.querySelector('.dx-mobile-menu-social');
    if (!(socialHost instanceof HTMLElement)) return;
    clearChildren(socialHost);
    const socialCandidates = getUniqueAnchors(Array.from(document.querySelectorAll(
      '.header-display-desktop .header-actions--left .header-actions-action--social a.icon[href], .header-display-mobile .header-actions--left .header-actions-action--social a.icon[href]'
    )));
    for (const anchor of socialCandidates.slice(0, 4)) {
      const clone = sanitizeClonedNode(anchor.cloneNode(true));
      if (!(clone instanceof HTMLAnchorElement)) continue;
      clone.classList.add('icon');
      socialHost.appendChild(clone);
    }
  }

  function readMobileUnreadCount() {
    const fromWindow = Number(window.__dxMessagesUnreadCount);
    if (Number.isFinite(fromWindow) && fromWindow >= 0) return Math.round(fromWindow);
    const sourceBadge = document.getElementById('auth-ui-messages-badge');
    const fromBadge = Number(sourceBadge && sourceBadge.textContent);
    return Number.isFinite(fromBadge) && fromBadge >= 0 ? Math.round(fromBadge) : 0;
  }

  function updateMobileUnreadBadge(root, count) {
    const safeCount = Number.isFinite(Number(count)) ? Math.max(0, Math.round(Number(count))) : 0;
    mobileMenuUnreadCount = safeCount;
    if (!(root instanceof HTMLElement)) return;
    for (const badge of Array.from(root.querySelectorAll('[data-dx-mobile-unread-badge="true"]'))) {
      if (!(badge instanceof HTMLElement)) continue;
      badge.textContent = safeCount > 99 ? '99+' : String(safeCount);
      badge.hidden = safeCount <= 0;
      badge.setAttribute('aria-hidden', safeCount > 0 ? 'false' : 'true');
    }
  }

  function renderMobileSitePanel(root, authSnapshot) {
    const grid = root.querySelector('[data-dx-mobile-site-grid="true"]');
    if (!(grid instanceof HTMLElement)) return;

    const hasStableSiteTiles = MOBILE_SITE_TILES.every((item) =>
      grid.querySelector(`[data-dx-mobile-menu-tile="${item.key}"]`) instanceof HTMLAnchorElement
    );
    if (!hasStableSiteTiles) {
      clearChildren(grid);
      MOBILE_SITE_TILES.forEach((item, index) => {
        grid.appendChild(createMobileMenuTile(item, { index }));
      });
    }

    const resolved = Boolean(authSnapshot && authSnapshot.resolved);
    const authenticated = Boolean(resolved && authSnapshot.authenticated);
    const accountItem = {
      key: 'account',
      label: authenticated ? 'Account' : (resolved ? 'Sign in' : 'Account'),
      detail: authenticated
        ? getMobileUserName(authSnapshot.user)
        : (resolved ? 'Join Dex free' : 'Checking sign-in…'),
      icon: 'account',
    };
    const accountTile = createMobileMenuTile(accountItem, {
      account: true,
      avatar: authenticated,
      button: true,
      index: MOBILE_SITE_TILES.length,
      user: authenticated ? authSnapshot.user : null,
    });
    accountTile.setAttribute('data-dx-mobile-account-state', resolved ? (authenticated ? 'signed-in' : 'signed-out') : 'loading');
    if (!resolved) {
      accountTile.disabled = true;
      accountTile.setAttribute('aria-busy', 'true');
    } else if (authenticated) {
      accountTile.setAttribute('data-dx-mobile-account-open', 'true');
      accountTile.setAttribute('aria-controls', 'dx-mobile-menu-account-panel');
    } else {
      accountTile.setAttribute('data-dx-mobile-login-trigger', 'true');
    }
    const existingAccountTile = grid.querySelector('[data-dx-mobile-menu-tile="account"]');
    if (existingAccountTile instanceof HTMLElement) {
      existingAccountTile.replaceWith(accountTile);
    } else {
      grid.appendChild(accountTile);
    }

    if (!(grid.querySelector('[data-dx-mobile-menu-tile="donate"]') instanceof HTMLAnchorElement)) {
      const donateSource = document.querySelector(
        '.header-display-desktop .header-actions-action--cta a[href], .header-display-mobile .header-actions-action--cta a[href]'
      );
      const donateHref = donateSource instanceof HTMLAnchorElement
        ? String(donateSource.getAttribute('href') || '/donate/')
        : '/donate/';
      const donateTile = createMobileMenuTile({
        key: 'donate',
        href: donateHref,
        label: 'Donate',
        detail: 'Keep the archive open',
        icon: 'donate',
      }, { action: true, index: MOBILE_SITE_TILES.length + 1 });
      grid.appendChild(donateTile);
    }

    normalizeDonateActionLabels(root);
    markMobileMenuActiveForPath(window.location.pathname);
  }

  function renderMobileAccountPanel(root, authSnapshot) {
    const identity = root.querySelector('[data-dx-mobile-account-identity="true"]');
    const grid = root.querySelector('[data-dx-mobile-account-grid="true"]');
    if (!(identity instanceof HTMLElement) || !(grid instanceof HTMLElement)) return;
    clearChildren(identity);
    if (!authSnapshot || !authSnapshot.authenticated) {
      clearChildren(grid);
      return;
    }

    identity.appendChild(createMobileMenuAvatar(authSnapshot.user, 'dx-mobile-menu-avatar--large'));
    const identityCopy = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = getMobileUserName(authSnapshot.user);
    const meta = document.createElement('span');
    meta.textContent = 'Dex member account';
    identityCopy.append(name, meta);
    identity.appendChild(identityCopy);

    const hasStableAccountTiles = MOBILE_ACCOUNT_TILES.every((item) =>
      grid.querySelector(`[data-dx-mobile-menu-tile="${item.key}"]`) instanceof HTMLAnchorElement
    ) && grid.querySelector('[data-dx-mobile-logout-trigger="true"]') instanceof HTMLButtonElement;
    if (!hasStableAccountTiles) {
      clearChildren(grid);
      MOBILE_ACCOUNT_TILES.forEach((item, index) => {
        grid.appendChild(createMobileMenuTile(item, { index }));
      });
      const logoutTile = createMobileMenuTile({
        key: 'logout',
        label: 'Log out',
        detail: 'End this session',
        icon: 'logout',
      }, { button: true, danger: true, index: MOBILE_ACCOUNT_TILES.length });
      logoutTile.setAttribute('data-dx-mobile-logout-trigger', 'true');
      grid.appendChild(logoutTile);
    }
    updateMobileUnreadBadge(root, readMobileUnreadCount());
    markMobileMenuActiveForPath(window.location.pathname);
  }

  function handleMobileMenuRouteClick(root, clickedLink, event) {
    if (!(root instanceof HTMLElement) || !(clickedLink instanceof HTMLAnchorElement)) return false;
    const href = String(clickedLink.getAttribute('href') || '').trim();
    if (!href) return false;

    const targetUrl = isHeaderWordmarkAnchor(clickedLink)
      ? new URL('/', window.location.origin)
      : toAbsoluteUrl(href);
    if (!targetUrl) return false;

    const hasModifiedIntent = Boolean(
      event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
    );
    if (hasModifiedIntent || !shouldHandleSoftNavigation(targetUrl, clickedLink)) {
      closeMobileMenu({ restoreFocus: false });
      return false;
    }

    event.preventDefault();
    clickedLink.setAttribute('data-dx-mobile-menu-nav-busy', 'true');
    clickedLink.setAttribute('aria-busy', 'true');
    closeMobileMenu({ restoreFocus: false });
    void softNavigate(targetUrl, {
      pushHistory: true,
      anchor: clickedLink,
      focusDestination: Number(event.detail) === 0,
    });
    return true;
  }

  async function buildMobileMenuContent(root, { forceAuthRefresh = false } = {}) {
    if (!(root instanceof HTMLElement)) return;
    const buildSequence = ++mobileMenuBuildSequence;
    renderMobileMenuBrand(root);
    renderMobileMenuSocial(root);
    renderMobileSitePanel(root, mobileMenuAuthSnapshot);
    if (mobileMenuAuthSnapshot.authenticated) {
      renderMobileAccountPanel(root, mobileMenuAuthSnapshot);
    }

    const authSnapshot = await resolveMobileMenuAuthSnapshot({ force: forceAuthRefresh });
    if (buildSequence !== mobileMenuBuildSequence || !(root instanceof HTMLElement)) return;
    renderMobileSitePanel(root, authSnapshot);
    renderMobileAccountPanel(root, authSnapshot);
  }

  function openMobileMenu(root, triggerButton = null) {
    if (!(root instanceof HTMLElement)) return;
    if (!isMobileViewport()) return;

    if (mobileMenuCloseTimer) {
      clearTimeout(mobileMenuCloseTimer);
      mobileMenuCloseTimer = 0;
    }
    mobileMenuLastFocused = triggerButton instanceof HTMLElement
      ? triggerButton
      : (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setMobileMenuView(root, 'site', { focus: false });
    renderMobileSitePanel(root, { authenticated: false, user: null, resolved: false });
    void buildMobileMenuContent(root, { forceAuthRefresh: true });
    root.setAttribute('aria-hidden', 'false');
    mobileMenuBodyOverflow = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';
    const scrollRoot = document.getElementById(SLOT_SCROLL_ID);
    if (scrollRoot instanceof HTMLElement) {
      mobileMenuScrollOverflow = scrollRoot.style.overflowY || '';
      scrollRoot.style.overflowY = 'hidden';
    }

    requestAnimationFrame(() => {
      document.body.classList.add(MOBILE_MENU_OPEN_CLASS);
      setMobileMenuBackgroundInert(root, true);
      const dialog = root.querySelector('.dx-mobile-menu-modal');
      if (dialog instanceof HTMLElement) {
        try {
          dialog.focus({ preventScroll: true });
        } catch {
          dialog.focus();
        }
      }
    });

    const burgerButtons = Array.from(document.querySelectorAll('.header-display-mobile .header-burger-btn'));
    for (const button of burgerButtons) {
      button.setAttribute('aria-expanded', 'true');
      button.setAttribute('aria-label', 'Close menu');
    }
  }

  function normalizeMobileBurgerHooks(root = document) {
    const burgerContainers = Array.from(root.querySelectorAll('.header-display-mobile .header-burger'));
    for (const container of burgerContainers) {
      container.classList.remove('header-burger');
      container.classList.add('dx-header-burger');
    }

    const burgerButtons = Array.from(root.querySelectorAll('.header-display-mobile .header-burger-btn'));
    for (const button of burgerButtons) {
      button.setAttribute('type', 'button');
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-expanded', document.body.classList.contains(MOBILE_MENU_OPEN_CLASS) ? 'true' : 'false');
      button.setAttribute('aria-controls', MOBILE_MENU_ROOT_ID);
      button.setAttribute('aria-label', document.body.classList.contains(MOBILE_MENU_OPEN_CLASS) ? 'Close menu' : 'Open menu');
    }
  }

  function setMobileMenuStatus(root, message = '', state = '') {
    if (!(root instanceof HTMLElement)) return;
    const status = root.querySelector('[data-dx-mobile-menu-status="true"]');
    if (!(status instanceof HTMLElement)) return;
    status.textContent = message;
    status.hidden = !message;
    if (state) {
      status.setAttribute('data-state', state);
    } else {
      status.removeAttribute('data-state');
    }
  }

  async function runMobileMenuAuthAction(root, control, kind) {
    if (!(root instanceof HTMLElement) || !(control instanceof HTMLElement)) return;
    if (control.getAttribute('data-dx-mobile-auth-busy') === 'true') return;
    control.setAttribute('data-dx-mobile-auth-busy', 'true');
    control.setAttribute('aria-busy', 'true');
    if ('disabled' in control) control.disabled = true;
    setMobileMenuStatus(root, kind === 'logout' ? 'Signing out…' : 'Opening secure sign in…', 'busy');
    try {
      const completed = kind === 'logout' ? await triggerMobileLogout() : await triggerMobileLogin();
      if (!completed) throw new Error('Auth action unavailable');
      closeMobileMenu({ restoreFocus: false });
    } catch {
      setMobileMenuStatus(
        root,
        kind === 'logout' ? 'Could not sign out. Try again.' : 'Could not open sign in. Try again.',
        'error',
      );
      control.removeAttribute('data-dx-mobile-auth-busy');
      control.removeAttribute('aria-busy');
      if ('disabled' in control) control.disabled = false;
    }
  }

  function installMobileMenu() {
    if (mobileMenuInstalled) return;
    mobileMenuInstalled = true;

    let root = document.getElementById(MOBILE_MENU_ROOT_ID);
    if (!(root instanceof HTMLElement)) {
      root = document.createElement('div');
      root.id = MOBILE_MENU_ROOT_ID;
      root.className = 'dx-mobile-menu';
      document.body.appendChild(root);
    }
    root.setAttribute('aria-hidden', 'true');
    root.setAttribute('data-dx-mobile-menu-view', 'site');
    root.innerHTML = `
      <button class="dx-mobile-menu-backdrop" type="button" tabindex="-1" aria-label="Close menu" data-dx-mobile-menu-close="true"></button>
      <section class="dx-mobile-menu-modal" role="dialog" aria-modal="true" aria-labelledby="dx-mobile-menu-title" tabindex="-1">
        <header class="dx-mobile-menu-head">
          <div class="dx-mobile-menu-brand" data-dx-mobile-menu-brand="true"></div>
          <div class="dx-mobile-menu-heading">
            <span>DEX / NAVIGATION</span>
            <h2 id="dx-mobile-menu-title" data-dx-heading-randomize="false">Menu</h2>
          </div>
          <button class="dx-mobile-menu-close" type="button" aria-label="Close menu" data-dx-mobile-menu-close="true">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6.5 6.5 11 11m0-11-11 11"/></svg>
          </button>
        </header>
        <div class="dx-mobile-menu-viewport">
          <div class="dx-mobile-menu-track">
            <section class="dx-mobile-menu-panel dx-mobile-menu-panel--site" data-dx-mobile-menu-panel="site" aria-hidden="false">
              <p class="dx-mobile-menu-section-label">Explore Dex</p>
              <nav class="dx-mobile-menu-grid" data-dx-mobile-site-grid="true" aria-label="Site navigation"></nav>
              <footer class="dx-mobile-menu-foot">
                <span class="dx-mobile-menu-foot-label">Follow the archive</span>
                <div class="dx-mobile-menu-social" aria-label="Social links"></div>
              </footer>
            </section>
            <section id="dx-mobile-menu-account-panel" class="dx-mobile-menu-panel dx-mobile-menu-panel--account" data-dx-mobile-menu-panel="account" aria-hidden="true" inert>
              <header class="dx-mobile-menu-account-head">
                <button type="button" class="dx-mobile-menu-back" data-dx-mobile-account-back="true">
                  <span aria-hidden="true">←</span> Menu
                </button>
                <div><span>ACCOUNT</span><h3 data-dx-heading-randomize="false">Your Dex</h3></div>
              </header>
              <div class="dx-mobile-menu-account-identity" data-dx-mobile-account-identity="true"></div>
              <nav class="dx-mobile-menu-account-grid" data-dx-mobile-account-grid="true" aria-label="Account navigation"></nav>
              <p class="dx-mobile-menu-status" data-dx-mobile-menu-status="true" role="status" aria-live="polite" hidden></p>
            </section>
          </div>
        </div>
      </section>
    `;

    void buildMobileMenuContent(root, { forceAuthRefresh: true });
    normalizeMobileBurgerHooks(document);

    document.addEventListener('click', (event) => {
      const target = event.target;
      const burgerButton = target && target.closest ? target.closest('.header-display-mobile .header-burger-btn') : null;
      if (!burgerButton) return;
      if (!isMobileViewport()) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }

      if (document.body.classList.contains(MOBILE_MENU_OPEN_CLASS)) {
        closeMobileMenu();
      } else {
        openMobileMenu(root, burgerButton);
      }
    }, true);

    root.addEventListener('click', (event) => {
      const target = event.target;
      const closeTrigger = target && target.closest ? target.closest('[data-dx-mobile-menu-close="true"]') : null;
      if (closeTrigger) {
        event.preventDefault();
        closeMobileMenu();
        return;
      }

      const accountOpen = target && target.closest ? target.closest('[data-dx-mobile-account-open="true"]') : null;
      if (accountOpen) {
        event.preventDefault();
        setMobileMenuStatus(root);
        setMobileMenuView(root, 'account');
        return;
      }

      const accountBack = target && target.closest ? target.closest('[data-dx-mobile-account-back="true"]') : null;
      if (accountBack) {
        event.preventDefault();
        setMobileMenuStatus(root);
        setMobileMenuView(root, 'site');
        return;
      }

      const loginTrigger = target && target.closest ? target.closest('[data-dx-mobile-login-trigger="true"]') : null;
      if (loginTrigger) {
        event.preventDefault();
        void runMobileMenuAuthAction(root, loginTrigger, 'login');
        return;
      }

      const logoutTrigger = target && target.closest ? target.closest('[data-dx-mobile-logout-trigger="true"]') : null;
      if (logoutTrigger) {
        event.preventDefault();
        void runMobileMenuAuthAction(root, logoutTrigger, 'logout');
        return;
      }

      const clickedLink = target && target.closest ? target.closest('a[href]') : null;
      if (!clickedLink) return;
      if (event.defaultPrevented) return;
      handleMobileMenuRouteClick(root, clickedLink, event);
    });

    window.addEventListener('resize', () => {
      if (!isMobileViewport()) {
        closeMobileMenu({ restoreFocus: false });
      }
      normalizeMobileBurgerHooks(document);
      if (isMobileViewport()) void buildMobileMenuContent(root);
    }, { passive: true });

    window.addEventListener('orientationchange', () => {
      if (!isMobileViewport()) {
        closeMobileMenu({ restoreFocus: false });
      }
      normalizeMobileBurgerHooks(document);
      if (isMobileViewport()) void buildMobileMenuContent(root);
    });

    window.addEventListener('keydown', (event) => {
      if (!document.body.classList.contains(MOBILE_MENU_OPEN_CLASS)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (root.getAttribute('data-dx-mobile-menu-view') === 'account') {
          setMobileMenuView(root, 'site');
        } else {
          closeMobileMenu();
        }
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getMobileMenuFocusable(root);
      if (!focusable.length) {
        event.preventDefault();
        const dialog = root.querySelector('.dx-mobile-menu-modal');
        if (dialog instanceof HTMLElement) dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }, true);

    window.addEventListener('dx:slotready', () => {
      closeMobileMenu({ restoreFocus: false });
      normalizeMobileBurgerHooks(document);
      void buildMobileMenuContent(root, { forceAuthRefresh: true });
      markMobileMenuActiveForPath(window.location.pathname);
    });

    window.addEventListener('dex-auth:ready', () => {
      void buildMobileMenuContent(root, { forceAuthRefresh: true });
    });
    window.addEventListener('dex-auth:state', () => {
      void buildMobileMenuContent(root, { forceAuthRefresh: true });
    });
    const syncUnread = (event) => {
      const detail = event && event.detail;
      updateMobileUnreadBadge(root, detail && detail.count);
    };
    window.addEventListener('dx:messages:unread-count', syncUnread);
    window.addEventListener('dx:messages:unread-sync', syncUnread);
  }

  function alignHomeHeroToHeader() {
    if (!document.body.classList.contains('homepage')) return;

    const headerFrame = document.querySelector('.header-announcement-bar-wrapper');
    if (!headerFrame) return;

    const headerRect = headerFrame.getBoundingClientRect();
    if (!Number.isFinite(headerRect.width) || headerRect.width <= 0) return;

    const targetIds = [
      'block-448bd8f915f4abba552b',
      'block-ee939fa7ed636a261fd7',
      'block-7ccf390e6577e4e9f69e',
      'block-5976018fa8f9e1213243',
    ];

    let didAlign = false;
    for (const id of targetIds) {
      const blockEl = document.getElementById(id);
      if (!blockEl) continue;
      alignBlockToHeaderFrame(blockEl, headerRect);
      didAlign = true;
    }

    if (didAlign) return;

    const combined = document.getElementById('dexCombined');
    if (!combined) return;
    const heroBlock = combined.closest('.dx-block') || combined;
    alignBlockToHeaderFrame(heroBlock, headerRect);
  }

  function clearHomeStackSpacingOverrides() {
    document.documentElement.style.removeProperty('--dx-home-uniform-gap');
    for (const id of HOME_STACK_BLOCK_IDS) {
      const block = document.getElementById(id);
      if (!block) continue;
      const section = block.closest('section.page-section');
      if (!section) continue;
      section.style.removeProperty('margin-top');
      section.style.removeProperty('margin-bottom');
    }
  }

  function clampHomeGapAdjustment(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(-320, Math.min(320, Math.round(value)));
  }

  function applyHomeUniformStackGap() {
    if (!document.body.classList.contains('homepage')) {
      clearHomeStackSpacingOverrides();
      return;
    }

    const headerFrame = document.querySelector('.header-announcement-bar-wrapper');
    const hero = document.getElementById('dexCombined');
    if (!(headerFrame instanceof HTMLElement) || !(hero instanceof HTMLElement)) {
      clearHomeStackSpacingOverrides();
      return;
    }

    const headerRect = headerFrame.getBoundingClientRect();
    const heroRect = hero.getBoundingClientRect();
    let targetGap = Math.round(heroRect.top - headerRect.bottom);
    if (!Number.isFinite(targetGap)) {
      clearHomeStackSpacingOverrides();
      return;
    }
    targetGap = Math.max(0, Math.min(240, targetGap));
    document.documentElement.style.setProperty('--dx-home-uniform-gap', `${targetGap}px`);

    const stackElements = [
      hero,
      document.getElementById('dex-board-promo'),
      document.getElementById('dex-signup'),
      document.getElementById('dex-faq'),
      document.querySelector('footer.dex-footer'),
    ].filter((element) => element instanceof HTMLElement);

    if (stackElements.length < 2) {
      clearHomeStackSpacingOverrides();
      return;
    }

    const sectionByElement = new Map();
    const touchedSections = new Set();
    for (let index = 1; index < stackElements.length; index += 1) {
      const section = stackElements[index].closest('section.page-section');
      if (!(section instanceof HTMLElement)) continue;
      sectionByElement.set(stackElements[index], section);
      touchedSections.add(section);
    }

    for (const section of touchedSections) {
      section.style.removeProperty('margin-top');
      section.style.removeProperty('margin-bottom');
    }

    for (let index = 1; index < stackElements.length; index += 1) {
      const previousRect = stackElements[index - 1].getBoundingClientRect();
      const currentRect = stackElements[index].getBoundingClientRect();
      const naturalGap = currentRect.top - previousRect.bottom;
      const section = sectionByElement.get(stackElements[index]);
      if (!(section instanceof HTMLElement) || !Number.isFinite(naturalGap)) continue;
      const adjustment = clampHomeGapAdjustment(targetGap - naturalGap);
      section.style.marginTop = `${adjustment}px`;
    }

    const footer = stackElements[stackElements.length - 1];
    const footerSection = sectionByElement.get(footer);
    if (footer instanceof HTMLElement && footerSection instanceof HTMLElement) {
      const footerRect = footer.getBoundingClientRect();
      const scrollRoot = document.getElementById(SLOT_SCROLL_ID);
      let naturalBottomGap = Number.NaN;
      if (scrollRoot instanceof HTMLElement) {
        const rootRect = scrollRoot.getBoundingClientRect();
        const footerBottomInRoot = (footerRect.bottom - rootRect.top) + scrollRoot.scrollTop;
        naturalBottomGap = scrollRoot.scrollHeight - footerBottomInRoot;
      } else {
        const footerBottomInDocument = footerRect.bottom + window.scrollY;
        const documentBottom = document.documentElement.scrollHeight;
        naturalBottomGap = documentBottom - footerBottomInDocument;
      }
      if (Number.isFinite(naturalBottomGap)) {
        const adjustment = clampHomeGapAdjustment(targetGap - naturalBottomGap);
        footerSection.style.marginBottom = `${adjustment}px`;
      }
    }
  }

  function installHomeHeroAligner() {
    if (homeHeroAlignerInstalled) return;
    homeHeroAlignerInstalled = true;

    let rafId = 0;
    const run = () => {
      alignHomeHeroToHeader();
      applyHomeUniformStackGap();
    };

    const schedule = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        run();
        requestAnimationFrame(run);
      });
    };

    schedule();
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', schedule);
    window.addEventListener('dx:slotready', schedule);
    window.addEventListener('load', schedule);
  }

  function clearChildren(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function collectPersistentClasses(element, allowedClasses) {
    if (!(element instanceof HTMLElement) || !(allowedClasses instanceof Set)) return [];
    return Array.from(element.classList).filter((className) => allowedClasses.has(className));
  }

  function isPersistentBodyAttribute(name) {
    return name === 'data-dx-ios-safari' || name === 'data-dx-ios-safari-standalone';
  }

  function syncBodyAttributes(sourceBody) {
    const sourceClassName = String(sourceBody?.className || '').trim();
    const sourceId = String(sourceBody?.id || '').trim();
    const sourceAttrs = Array.from(sourceBody?.attributes || []);
    const persistentClasses = collectPersistentClasses(document.body, PERSISTENT_BODY_CLASSES);
    const persistentAttrs = new Map(
      Array.from(document.body.attributes)
        .filter((attr) => isPersistentBodyAttribute(attr.name))
        .map((attr) => [attr.name, attr.value]),
    );

    const currentAttrs = Array.from(document.body.attributes);
    const nextAttrs = new Map(sourceAttrs.map((attr) => [attr.name, attr.value]));
    for (const [name, value] of persistentAttrs.entries()) {
      if (!nextAttrs.has(name)) nextAttrs.set(name, value);
    }

    for (const attr of currentAttrs) {
      if (attr.name === 'class' || attr.name === 'id') continue;
      if (!nextAttrs.has(attr.name)) {
        document.body.removeAttribute(attr.name);
      }
    }

    for (const [name, value] of nextAttrs.entries()) {
      if (name === 'class' || name === 'id') continue;
      document.body.setAttribute(name, value);
    }

    if (sourceBody.id) {
      document.body.id = sourceBody.id;
    } else {
      document.body.removeAttribute('id');
    }

    const nextClasses = new Set(
      sourceClassName
        .split(/\s+/)
        .map((className) => className.trim())
        .filter(Boolean),
    );
    persistentClasses.forEach((className) => nextClasses.add(className));
    document.body.className = Array.from(nextClasses).join(' ');
    document.body.classList.add(BODY_CLASS);
    document.documentElement.removeAttribute('data-dx-entry-rail-mode');
    document.documentElement.style.removeProperty('--dx-uav-shell-top');
    document.documentElement.style.removeProperty('--dx-uav-shell-bottom');
  }

  function syncHtmlAttributes(sourceDocument) {
    const nextHtml = sourceDocument.documentElement;
    if (!nextHtml) return;

    if (nextHtml.lang) {
      document.documentElement.lang = nextHtml.lang;
    }

    const nextClasses = new Set(
      String(nextHtml.className || '')
        .split(/\s+/)
        .map((className) => className.trim())
        .filter(Boolean),
    );
    collectPersistentClasses(document.documentElement, PERSISTENT_HTML_CLASSES)
      .forEach((className) => nextClasses.add(className));
    document.documentElement.className = Array.from(nextClasses).join(' ');
  }

  function syncRouteIdentityAttributes(sourceDocument) {
    const nextHtml = sourceDocument && sourceDocument.documentElement;
    const nextBody = sourceDocument && sourceDocument.body;
    const htmlRoute = nextHtml ? String(nextHtml.getAttribute('data-dx-route') || '').trim() : '';
    const bodyRoute = nextBody ? String(nextBody.getAttribute('data-dx-route') || '').trim() : '';

    if (htmlRoute) {
      document.documentElement.setAttribute('data-dx-route', htmlRoute);
    } else {
      document.documentElement.removeAttribute('data-dx-route');
    }

    if (bodyRoute) {
      document.body.setAttribute('data-dx-route', bodyRoute);
    } else {
      document.body.removeAttribute('data-dx-route');
    }
  }

  function markHeaderActiveForPath(pathname) {
    const normalizedTarget = normalizePathname(pathname);
    const items = Array.from(document.querySelectorAll('.header-nav-item'));

    for (const item of items) {
      const link = item.querySelector('a[href]');
      if (!link) continue;

      const hrefUrl = toAbsoluteUrl(link.getAttribute('href'));
      const isActive = !!hrefUrl && normalizePathname(hrefUrl.pathname) === normalizedTarget;

      item.classList.toggle('header-nav-item--active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    }

    markMobileMenuActiveForPath(pathname);
  }

  function shouldIncludeRouteStylesheet(url) {
    if (!url || !isHttpUrl(url)) return false;
    if (!isSameOriginUrl(url)) return true;
    return url.pathname.startsWith('/css/') || url.pathname.startsWith('/assets/css/');
  }

  // Route navigation is staged as an asset transaction. New stylesheets download
  // with a non-matching media query, so the outgoing page remains visually intact.
  // Commit then normalizes the exact destination order and activates everything in
  // the same task as the body-class and foreground swap.
  const ROUTE_STYLE_LOAD_TIMEOUT_MS = 6000;
  const ROUTE_SCRIPT_PRELOAD_TIMEOUT_MS = 8000;
  const ROUTE_SCRIPT_LOAD_TIMEOUT_MS = 6000;

  function collectRouteStyleDefinitions(sourceDocument, baseUrl) {
    const incomingLinks = [
      ...Array.from(sourceDocument.head ? sourceDocument.head.querySelectorAll('link[rel~="stylesheet"][href]') : []),
      ...Array.from(sourceDocument.body ? sourceDocument.body.querySelectorAll('link[rel~="stylesheet"][href]') : []),
    ];
    const definitions = [];
    const seen = new Set();

    for (const link of incomingLinks) {
      const url = toAbsoluteUrl(link.getAttribute('href'), baseUrl);
      if (!url || !shouldIncludeRouteStylesheet(url) || seen.has(url.href)) continue;
      seen.add(url.href);
      definitions.push({
        url,
        media: String(link.getAttribute('media') || '').trim(),
        crossOrigin: link.hasAttribute('crossorigin') ? String(link.getAttribute('crossorigin') || '') : null,
        referrerPolicy: String(link.getAttribute('referrerpolicy') || '').trim(),
        integrity: String(link.getAttribute('integrity') || '').trim(),
      });
    }

    return definitions;
  }

  function collectManagedInlineStyleDefinitions(sourceDocument) {
    const styles = [
      ...Array.from(sourceDocument.head ? sourceDocument.head.querySelectorAll('style[data-managed="1"][id]') : []),
      ...Array.from(sourceDocument.body ? sourceDocument.body.querySelectorAll('style[data-managed="1"][id]') : []),
    ];
    const definitions = [];
    const seen = new Set();

    for (const style of styles) {
      const id = String(style.id || '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      definitions.push({
        id,
        text: String(style.textContent || ''),
        nonce: String(style.getAttribute('nonce') || '').trim(),
      });
    }

    return definitions;
  }

  function waitForStagedStylesheet(link, signal) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let timeoutId = 0;
      const finish = (error = null) => {
        if (settled) return;
        settled = true;
        if (timeoutId) window.clearTimeout(timeoutId);
        if (signal && typeof signal.removeEventListener === 'function') {
          signal.removeEventListener('abort', onAbort);
        }
        if (error) reject(error);
        else resolve();
      };
      const onAbort = () => finish(new DOMException('Route style preload aborted.', 'AbortError'));

      link.addEventListener('load', () => finish(), { once: true });
      link.addEventListener('error', () => finish(new Error(`Failed to preload route stylesheet: ${link.href}`)), { once: true });
      if (signal && typeof signal.addEventListener === 'function') {
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
      }
      timeoutId = window.setTimeout(
        () => finish(new Error(`Timed out preloading route stylesheet: ${link.href}`)),
        ROUTE_STYLE_LOAD_TIMEOUT_MS,
      );
    });
  }

  function ensureRouteStyleAnchor() {
    let anchor = document.head.querySelector(`meta[${ROUTE_STYLE_ANCHOR_ATTR}]`);
    if (anchor instanceof HTMLMetaElement) return anchor;
    anchor = document.createElement('meta');
    anchor.setAttribute(ROUTE_STYLE_ANCHOR_ATTR, 'true');
    const firstStyleAsset = document.head.querySelector('link[rel~="stylesheet"][href], style[data-managed="1"][id]');
    document.head.insertBefore(anchor, firstStyleAsset || document.head.firstChild);
    return anchor;
  }

  async function prepareRouteStyles(sourceDocument, baseUrl, options = {}) {
    const signal = options.signal || null;
    const definitions = collectRouteStyleDefinitions(sourceDocument, baseUrl);
    const inlineDefinitions = collectManagedInlineStyleDefinitions(sourceDocument);
    const styleAnchor = ensureRouteStyleAnchor();
    const existingByHref = new Map();
    for (const node of Array.from(document.querySelectorAll('link[rel~="stylesheet"][href]'))) {
      const url = toAbsoluteUrl(node.getAttribute('href'));
      if (!url || existingByHref.has(url.href)) continue;
      existingByHref.set(url.href, node);
    }

    const entries = [];
    const stagedLinks = [];
    const pending = [];
    let committed = false;

    for (const definition of definitions) {
      let node = existingByHref.get(definition.url.href);
      if (!(node instanceof HTMLLinkElement)) {
        node = document.createElement('link');
        node.rel = 'stylesheet';
        node.href = definition.url.href;
        node.media = 'not all';
        node.setAttribute(ROUTE_STYLE_ATTR, 'true');
        node.setAttribute(ROUTE_STYLE_STAGED_ATTR, 'true');
        if (definition.crossOrigin !== null) node.setAttribute('crossorigin', definition.crossOrigin);
        if (definition.referrerPolicy) node.setAttribute('referrerpolicy', definition.referrerPolicy);
        if (definition.integrity) node.setAttribute('integrity', definition.integrity);
        pending.push(waitForStagedStylesheet(node, signal));
        document.head.appendChild(node);
        stagedLinks.push(node);
        existingByHref.set(definition.url.href, node);
      }
      entries.push({ definition, node });
    }

    try {
      if (pending.length) await Promise.all(pending);
    } catch (error) {
      stagedLinks.forEach((node) => node.remove());
      throw error;
    }

    return {
      commit() {
        if (committed) return;
        committed = true;

        const orderedAssets = [];
        for (const { definition, node } of entries) {
          node.setAttribute(ROUTE_STYLE_ATTR, 'true');
          node.removeAttribute(ROUTE_STYLE_STAGED_ATTR);
          if (definition.media) node.media = definition.media;
          else node.removeAttribute('media');
          if (definition.crossOrigin !== null) node.setAttribute('crossorigin', definition.crossOrigin);
          else node.removeAttribute('crossorigin');
          if (definition.referrerPolicy) node.setAttribute('referrerpolicy', definition.referrerPolicy);
          else node.removeAttribute('referrerpolicy');
          if (definition.integrity) node.setAttribute('integrity', definition.integrity);
          else node.removeAttribute('integrity');
          orderedAssets.push(node);
        }

        const desiredInlineIds = new Set(inlineDefinitions.map((definition) => definition.id));
        for (const node of Array.from(document.querySelectorAll(`style[${ROUTE_INLINE_STYLE_ATTR}], style[data-managed="1"][id]`))) {
          if (!(node instanceof HTMLStyleElement)) continue;
          if (!desiredInlineIds.has(node.id)) node.remove();
        }
        for (const definition of inlineDefinitions) {
          let node = document.getElementById(definition.id);
          if (!(node instanceof HTMLStyleElement)) {
            node = document.createElement('style');
            node.id = definition.id;
          }
          node.setAttribute('data-managed', '1');
          node.setAttribute(ROUTE_INLINE_STYLE_ATTR, 'true');
          if (definition.nonce) node.setAttribute('nonce', definition.nonce);
          else node.removeAttribute('nonce');
          if (node.textContent !== definition.text) node.textContent = definition.text;
          orderedAssets.push(node);
        }

        // Keep shared stylesheets connected throughout the commit. Moving every
        // link through a detached DocumentFragment briefly restored unstyled
        // defaults on persistent chrome, which made the hidden mobile modal
        // transition over Home and cover the gooey mesh.
        let cursor = styleAnchor;
        for (const node of orderedAssets) {
          if (cursor.nextSibling !== node) {
            document.head.insertBefore(node, cursor.nextSibling);
          }
          cursor = node;
        }

        const desiredLinkNodes = new Set(entries.map(({ node }) => node));
        for (const node of Array.from(document.querySelectorAll('link[rel~="stylesheet"][href]'))) {
          if (!desiredLinkNodes.has(node)) node.remove();
        }
      },
      dispose() {
        if (committed) return;
        stagedLinks.forEach((node) => node.remove());
      },
    };
  }

  function isRouteScriptCandidate(url) {
    if (!url || !isHttpUrl(url) || !isSameOriginUrl(url)) return false;
    const pathname = url.pathname;
    if (!pathname.startsWith('/assets/')) return false;
    if (!pathname.endsWith('.js')) return false;
    if (SKIPPED_ROUTE_SCRIPTS.has(pathname)) return false;
    return true;
  }

  function collectRouteScripts(sourceDocument, baseUrl) {
    const orderedScripts = [
      ...Array.from(sourceDocument.head ? sourceDocument.head.querySelectorAll('script[src]') : []),
      ...Array.from(sourceDocument.body ? sourceDocument.body.querySelectorAll('script[src]') : []),
    ];

    const scripts = [];
    const seen = new Set();

    for (const script of orderedScripts) {
      const rawSrc = script.getAttribute('src');
      const url = toAbsoluteUrl(rawSrc, baseUrl);
      if (!url) continue;
      if (!isRouteScriptCandidate(url)) continue;
      if (seen.has(url.href)) continue;
      seen.add(url.href);

      scripts.push({
        url,
        type: script.getAttribute('type') || '',
        noModule: script.hasAttribute('nomodule'),
        crossOrigin: script.getAttribute('crossorigin') || '',
        referrerPolicy: script.getAttribute('referrerpolicy') || '',
        integrity: script.getAttribute('integrity') || '',
      });
    }

    return scripts;
  }

  function clearRouteScripts() {
    const nodes = Array.from(document.querySelectorAll(`script[${ROUTE_SCRIPT_ATTR}="true"]`));
    for (const node of nodes) {
      node.remove();
    }
  }

  function resetRouteScriptGuard(pathname) {
    const guardName = ROUTE_SCRIPT_GUARDS.get(pathname);
    if (!guardName) return;
    try {
      delete window[guardName];
    } catch {}
    window[guardName] = undefined;
  }

  function preloadRouteScript(definition, signal) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let timeoutId = 0;
      const finish = (error = null) => {
        if (settled) return;
        settled = true;
        if (timeoutId) window.clearTimeout(timeoutId);
        if (error) reject(error);
        else resolve();
      };

      timeoutId = window.setTimeout(
        () => finish(new Error(`Timed out preloading route script: ${definition.url.href}`)),
        ROUTE_SCRIPT_PRELOAD_TIMEOUT_MS,
      );

      fetch(definition.url.href, {
        credentials: 'same-origin',
        cache: 'force-cache',
        signal,
      }).then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to preload route script (${response.status}): ${definition.url.href}`);
        }
        return response.arrayBuffer();
      }).then(() => finish()).catch((error) => finish(error));
    });
  }

  async function preloadRouteScripts(definitions, options = {}) {
    if (!definitions.length) return;
    await Promise.all(definitions.map((definition) => preloadRouteScript(definition, options.signal || undefined)));
  }

  function loadRouteScript(definition) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = definition.url.href;
      script.async = false;
      script.setAttribute(ROUTE_SCRIPT_ATTR, 'true');
      let settled = false;
      let timeoutId = 0;
      const finish = (error = null) => {
        if (settled) return;
        settled = true;
        if (timeoutId) window.clearTimeout(timeoutId);
        if (error) {
          script.remove();
          reject(error);
        } else {
          resolve();
        }
      };

      if (definition.type) script.type = definition.type;
      if (definition.noModule) script.noModule = true;
      if (definition.crossOrigin) script.setAttribute('crossorigin', definition.crossOrigin);
      if (definition.referrerPolicy) script.setAttribute('referrerpolicy', definition.referrerPolicy);
      if (definition.integrity) script.setAttribute('integrity', definition.integrity);

      script.addEventListener('load', () => finish(), { once: true });
      script.addEventListener('error', () => finish(new Error(`Failed to load route script: ${definition.url.href}`)), { once: true });
      timeoutId = window.setTimeout(
        () => finish(new Error(`Timed out loading route script: ${definition.url.href}`)),
        ROUTE_SCRIPT_LOAD_TIMEOUT_MS,
      );

      document.body.appendChild(script);
    });
  }

  async function loadRouteScripts(definitions) {
    for (const definition of definitions) {
      resetRouteScriptGuard(definition.url.pathname);
      await loadRouteScript(definition);
    }
  }

  function digestInlineScript(definition) {
    const type = String((definition && definition.type) || '').trim().toLowerCase();
    const code = String((definition && definition.code) || '').trim();
    if (!code) return '';

    let hash = 2166136261;
    const payload = `${type}::${code}`;
    for (let index = 0; index < payload.length; index += 1) {
      hash ^= payload.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `dx-inline-${(hash >>> 0).toString(16)}`;
  }

  function buildInlineRouteScriptBundle(definitions) {
    const seen = new Set();
    const chunks = [];
    for (const definition of definitions) {
      const code = String((definition && definition.code) || '').trim();
      if (!code) continue;
      const digest = digestInlineScript(definition);
      if (digest && seen.has(digest)) continue;
      if (digest) seen.add(digest);
      chunks.push(code);
    }
    if (!chunks.length) return '';

    return `\n(function(){\n  const __dxOriginalAddEventListener = document.addEventListener.bind(document);\n  const __dxDomReadyEvent = (() => {\n    try {\n      return new Event('DOMContentLoaded', { bubbles: true, cancelable: true });\n    } catch {\n      const fallback = document.createEvent('Event');\n      fallback.initEvent('DOMContentLoaded', true, true);\n      return fallback;\n    }\n  })();\n  const __dxDispatchDomReady = (listener) => {\n    if (!listener) return;\n    if (typeof listener === 'function') {\n      listener.call(document, __dxDomReadyEvent);\n      return;\n    }\n    if (listener && typeof listener.handleEvent === 'function') {\n      listener.handleEvent(__dxDomReadyEvent);\n    }\n  };\n  document.addEventListener = function(type, listener, options) {\n    if (String(type || '').toLowerCase() === 'domcontentloaded') {\n      try {\n        __dxDispatchDomReady(listener);\n      } catch (error) {\n        try { console.error(error); } catch {}\n      }\n      return;\n    }\n    return __dxOriginalAddEventListener(type, listener, options);\n  };\n  try {\n${chunks.join('\n;\n')}\n  } finally {\n    document.addEventListener = __dxOriginalAddEventListener;\n  }\n})();\n`;
  }

  function loadInlineRouteScripts(definitions) {
    const bundledCode = buildInlineRouteScriptBundle(definitions);
    if (!bundledCode) return false;

    try {
      const script = document.createElement('script');
      script.setAttribute(ROUTE_SCRIPT_ATTR, 'true');
      script.text = bundledCode;
      document.body.appendChild(script);
      return true;
    } catch (error) {
      try {
        console.warn('[dx-slot] inline route bundle skipped due to execution error.', error);
      } catch {}
      return false;
    }
  }

  function captureGooeyMeshState() {
    const wrapper = document.getElementById('gooey-mesh-wrapper');
    if (!wrapper) return null;
    ensureCanonicalGooeyMeshPresentation();
    const blobs = Array.from(wrapper.querySelectorAll('.gooey-blob'));
    if (!blobs.length) return null;

    const snapshot = blobs.map((blob) => ({
      transform: blob.style.transform || '',
      x: Number(blob._x),
      y: Number(blob._y),
      vx: Number(blob._vx),
      vy: Number(blob._vy),
      rad: Number(blob._rad),
      phase: Number(blob._phase),
      waxMass: resolveGooeyWaxMass(blob),
      waxHoldUntil: Number(blob._waxHoldUntil) || 0,
      waxReadyAt: Number(blob._waxReadyAt) || 0,
      waxPartner: Number.isInteger(Number(blob._waxPartner)) ? Number(blob._waxPartner) : -1,
    }));

    return normalizeGooeyMeshStateSnapshot(snapshot);
  }

  function restoreGooeyMeshState(state) {
    const normalizedState = normalizeGooeyMeshStateSnapshot(state);
    if (!Array.isArray(normalizedState) || normalizedState.length === 0) return;
    ensureCanonicalGooeyMeshPresentation();
    const wrapper = document.getElementById('gooey-mesh-wrapper');
    if (!wrapper) return;
    const blobs = Array.from(wrapper.querySelectorAll('.gooey-blob'));
    if (blobs.length !== normalizedState.length) return;

    for (let index = 0; index < blobs.length; index += 1) {
      const blob = blobs[index];
      const item = normalizedState[index];
      if (!item) continue;

      if (Number.isFinite(item.x)) blob._x = item.x;
      if (Number.isFinite(item.y)) blob._y = item.y;
      if (Number.isFinite(item.vx)) blob._vx = item.vx;
      if (Number.isFinite(item.vy)) blob._vy = item.vy;
      if (Number.isFinite(item.rad)) blob._rad = item.rad;
      if (Number.isFinite(item.phase)) blob._phase = item.phase;
      if (Number.isFinite(item.waxMass)) blob._waxMass = item.waxMass;
      if (Number.isFinite(item.waxHoldUntil)) blob._waxHoldUntil = item.waxHoldUntil;
      if (Number.isFinite(item.waxReadyAt)) blob._waxReadyAt = item.waxReadyAt;
      if (Number.isInteger(item.waxPartner)) blob._waxPartner = item.waxPartner;
      if (typeof item.transform === 'string') blob.style.transform = item.transform;
      applyGooeyBlobTransform(blob);
    }

    for (let index = 0; index < blobs.length; index += 1) {
      const partnerIndex = Number(blobs[index]._waxPartner);
      const validPartner = Number.isInteger(partnerIndex)
        && partnerIndex >= 0
        && partnerIndex < blobs.length
        && partnerIndex !== index
        && Number(blobs[partnerIndex]._waxPartner) === index;
      if (!validPartner) blobs[index]._waxPartner = -1;
    }

    normalizeLiveGooeyMeshVelocities();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Single-owner gooey-mesh animation driver.
  //
  // The #gooey-mesh-wrapper is persistent chrome (PRESERVED_IDS) that survives
  // soft-nav, but the animation loop used to live in a per-entry-page inline
  // script. That meant motion only existed if you *hard-loaded an entry page*,
  // and was absent on the home/polls/settings routes (no inline driver) — the
  // "sometimes doesn't show" symptom — while a second hard load could leave two
  // loops fighting. This driver lives in the persistent header-slot script, so
  // it is the sole owner regardless of entry point. It re-queries live blobs
  // each tick, so it self-heals if a fallback path swaps the wrapper out.
  // The inline entry script now defers to it via window.__dxDisableRouteGooeyBootstrap.
  // ──────────────────────────────────────────────────────────────────────────

  function ensureGooeyBlobKinematics(blob, index, vw, vh) {
    if (!(blob instanceof HTMLElement)) return;
    const radius = resolveGooeyBlobRadius(blob);
    if (!Number.isFinite(Number(blob._rad)) || Number(blob._rad) <= 0) blob._rad = radius;
    const r = Number(blob._rad) > 0 ? Number(blob._rad) : radius;
    if (!Number.isFinite(Number(blob._x))) blob._x = r + Math.random() * Math.max(vw - r * 2, 1);
    if (!Number.isFinite(Number(blob._y))) blob._y = r + Math.random() * Math.max(vh - r * 2, 1);
    if (!Number.isFinite(Number(blob._vx)) || !Number.isFinite(Number(blob._vy))) {
      const angle = (index + 1) * 2.399963229728653 + Math.random() * 0.6;
      const speed = GOOEY_SPEED_MIN + Math.random() * (GOOEY_SPEED_MAX - GOOEY_SPEED_MIN);
      blob._vx = Math.cos(angle) * speed;
      blob._vy = Math.sin(angle) * speed;
    }
    if (!Number.isFinite(Number(blob._phase))) {
      blob._phase = (index + 1) * 2.399963229728653 + Math.random() * 0.35;
    }
    if (!Number.isFinite(Number(blob._waxMass))) blob._waxMass = 1;
    if (!Number.isFinite(Number(blob._waxHoldUntil))) blob._waxHoldUntil = 0;
    if (!Number.isFinite(Number(blob._waxReadyAt))) {
      blob._waxReadyAt = Date.now() + 3200 + (index * 680);
    }
    if (!Number.isInteger(Number(blob._waxPartner))) blob._waxPartner = -1;
  }

  function repairPersistentGooeyMesh() {
    createFallbackBackdropElementsIfMissing();
    let wrapper = document.getElementById('gooey-mesh-wrapper');
    if (!(wrapper instanceof HTMLElement)) return null;

    let stage = wrapper.querySelector('.gooey-stage');
    if (!(stage instanceof HTMLElement)) {
      stage = document.createElement('div');
      stage.className = 'gooey-stage';
      wrapper.insertBefore(stage, wrapper.firstChild);
    }

    const liveBlobs = Array.from(stage.querySelectorAll('.gooey-blob'));
    for (let index = liveBlobs.length; index < GOOEY_BLOB_STYLE_PRESETS.length; index += 1) {
      const blob = document.createElement('div');
      blob.className = 'gooey-blob';
      blob.setAttribute('style', GOOEY_BLOB_STYLE_PRESETS[index]);
      stage.appendChild(blob);
    }

    ensureBackdropLayersOutsideForeground();
    ensureCanonicalGooeyMeshPresentation();
    wrapper = document.getElementById('gooey-mesh-wrapper');
    const persistedState = readPersistedGooeyMeshState();
    if (persistedState) restoreGooeyMeshState(persistedState);
    return wrapper instanceof HTMLElement ? wrapper : null;
  }

  function refreshGooeyDriverBlobs() {
    let wrapper = document.getElementById('gooey-mesh-wrapper');
    if (!(wrapper instanceof HTMLElement) || wrapper.querySelectorAll('.gooey-blob').length < GOOEY_BLOB_STYLE_PRESETS.length) {
      wrapper = repairPersistentGooeyMesh();
    }
    if (!wrapper) {
      gooeyDriverWrapper = null;
      gooeyDriverBlobs = [];
      return;
    }
    const liveBlobs = Array.from(wrapper.querySelectorAll('.gooey-blob'));
    const stale = wrapper !== gooeyDriverWrapper
      || liveBlobs.length !== gooeyDriverBlobs.length
      || gooeyDriverBlobs.some((blob) => !blob || !blob.isConnected);
    if (!stale) return;
    gooeyDriverWrapper = wrapper;
    gooeyDriverBlobs = liveBlobs;
    const vw = Math.max(window.innerWidth || 0, 1);
    const vh = Math.max(window.innerHeight || 0, 1);
    gooeyDriverBlobs.forEach((blob, index) => ensureGooeyBlobKinematics(blob, index, vw, vh));
    gooeyDriverBlobs.forEach((blob, index) => {
      const partnerIndex = Number(blob._waxPartner);
      const validPartner = Number.isInteger(partnerIndex)
        && partnerIndex >= 0
        && partnerIndex < gooeyDriverBlobs.length
        && partnerIndex !== index
        && Number(gooeyDriverBlobs[partnerIndex]._waxPartner) === index;
      if (!validPartner) blob._waxPartner = -1;
    });
  }

  function stepGooeyMesh(now) {
    refreshGooeyDriverBlobs();
    if (!gooeyDriverBlobs.length) {
      gooeyDriverLast = now;
      return;
    }
    const dt = Math.min(Math.max((now - gooeyDriverLast) / 1000, 0), 0.05);
    gooeyDriverLast = now;
    const vw = Math.max(window.innerWidth || 0, 1);
    const vh = Math.max(window.innerHeight || 0, 1);
    const centreX = vw / 2;
    const centreY = vh / 2;
    const nowEpoch = Date.now();

    // Give each blob its own slow steering curve. The phases are persisted with
    // the route state, so navigation never changes the character of the field.
    const elapsed = now / 1000;
    for (let index = 0; index < gooeyDriverBlobs.length; index += 1) {
      const blob = gooeyDriverBlobs[index];
      if (!(blob instanceof HTMLElement)) continue;
      ensureGooeyBlobKinematics(blob, index, vw, vh);
      const phase = Number(blob._phase);
      if (nowEpoch >= Number(blob._waxHoldUntil || 0)) {
        const waxMass = resolveGooeyWaxMass(blob);
        const relaxedMass = waxMass + ((1 - waxMass) * GOOEY_WAX_RELAX_RATE * dt);
        blob._waxMass = Math.abs(relaxedMass - 1) < 0.001 ? 1 : relaxedMass;
      }
      const radius = resolveGooeyVisualRadius(blob);
      const territoryAngle = phase + (elapsed * 0.01);
      const territoryBreath = 0.86 + (Math.sin((elapsed * 0.018) + (phase * 0.43)) * 0.14);
      const territoryRadiusX = Math.max(18, centreX - radius) * 0.78 * territoryBreath;
      const territoryRadiusY = Math.max(18, centreY - radius) * 0.76 * territoryBreath;
      const territoryX = centreX + (Math.cos(territoryAngle) * territoryRadiusX);
      const territoryY = centreY + (Math.sin(territoryAngle) * territoryRadiusY);
      blob._vx += Math.cos((elapsed * 0.055) + phase) * GOOEY_WANDER_STRENGTH * dt;
      blob._vy += Math.sin((elapsed * 0.047) + (phase * 1.17)) * GOOEY_WANDER_STRENGTH * dt;
      blob._vx += (territoryX - blob._x) * GOOEY_TERRITORY_STRENGTH * dt;
      blob._vy += (territoryY - blob._y) * GOOEY_TERRITORY_STRENGTH * dt;
    }

    // Close pairs behave like wax rather than rigid particles. They attract,
    // exchange area while deeply overlapped, dwell as one colored mass, then
    // repel and relax back toward their original areas.
    for (let leftIndex = 0; leftIndex < gooeyDriverBlobs.length; leftIndex += 1) {
      const left = gooeyDriverBlobs[leftIndex];
      if (!(left instanceof HTMLElement)) continue;
      const leftRadius = resolveGooeyVisualRadius(left);
      for (let rightIndex = leftIndex + 1; rightIndex < gooeyDriverBlobs.length; rightIndex += 1) {
        const right = gooeyDriverBlobs[rightIndex];
        if (!(right instanceof HTMLElement)) continue;
        const rightRadius = resolveGooeyVisualRadius(right);
        const radiusSum = Math.max(24, leftRadius + rightRadius);
        const influenceDistance = radiusSum * GOOEY_WAX_INFLUENCE_RATIO;
        let dx = Number(right._x) - Number(left._x);
        let dy = Number(right._y) - Number(left._y);
        let distance = Math.hypot(dx, dy);
        const pairActive = Number(left._waxPartner) === rightIndex
          && Number(right._waxPartner) === leftIndex;
        if (distance >= influenceDistance && !pairActive) continue;

        if (distance < 0.001) {
          const splitAngle = ((leftIndex + 1) * 1.61803398875) + ((rightIndex + 1) * 2.399963229728653);
          dx = Math.cos(splitAngle);
          dy = Math.sin(splitAngle);
          distance = 1;
        }
        const nx = dx / distance;
        const ny = dy / distance;
        const proximity = 1 - Math.min(distance / influenceDistance, 1);
        const leftMass = resolveGooeyWaxMass(left);
        const rightMass = resolveGooeyWaxMass(right);
        const pairHoldUntil = Math.max(Number(left._waxHoldUntil || 0), Number(right._waxHoldUntil || 0));
        const pairReadyAt = Math.max(Number(left._waxReadyAt || 0), Number(right._waxReadyAt || 0));
        const dwelling = pairActive && nowEpoch < pairHoldUntil;
        const massImbalanced = Math.abs(leftMass - 1) >= 0.08
          || Math.abs(rightMass - 1) >= 0.08;
        const releasing = pairActive
          && !dwelling
          && (nowEpoch < pairReadyAt || massImbalanced);

        if (releasing) {
          const releaseImpulse = GOOEY_WAX_RELEASE_STRENGTH * Math.max(0.24, proximity) * dt;
          left._vx -= (nx * releaseImpulse) / Math.max(0.35, leftMass);
          left._vy -= (ny * releaseImpulse) / Math.max(0.35, leftMass);
          right._vx += (nx * releaseImpulse) / Math.max(0.35, rightMass);
          right._vy += (ny * releaseImpulse) / Math.max(0.35, rightMass);
        } else if (distance < influenceDistance) {
          const attractionImpulse = GOOEY_WAX_ATTRACTION_STRENGTH * proximity * dt;
          left._vx += (nx * attractionImpulse) / Math.max(0.5, leftMass);
          left._vy += (ny * attractionImpulse) / Math.max(0.5, leftMass);
          right._vx -= (nx * attractionImpulse) / Math.max(0.5, rightMass);
          right._vy -= (ny * attractionImpulse) / Math.max(0.5, rightMass);
        }

        const mergeDistance = radiusSum * GOOEY_WAX_MERGE_RATIO;
        const canStartPair = Number(left._waxPartner) < 0
          && Number(right._waxPartner) < 0
          && nowEpoch >= Number(left._waxReadyAt || 0)
          && nowEpoch >= Number(right._waxReadyAt || 0);
        const atTransferLimit = leftMass <= GOOEY_WAX_MIN_MASS + 0.01
          || rightMass <= GOOEY_WAX_MIN_MASS + 0.01
          || leftMass >= GOOEY_WAX_MAX_MASS - 0.01
          || rightMass >= GOOEY_WAX_MAX_MASS - 0.01;
        if (!releasing && !atTransferLimit && distance < mergeDistance && (pairActive || canStartPair)) {
          if (canStartPair) {
            left._waxPartner = rightIndex;
            right._waxPartner = leftIndex;
          }

          const mergeDepth = 1 - Math.min(distance / mergeDistance, 1);
          const leftBaseRadius = Number(left._rad) > 0 ? Number(left._rad) : resolveGooeyBlobRadius(left);
          const rightBaseRadius = Number(right._rad) > 0 ? Number(right._rad) : resolveGooeyBlobRadius(right);
          const leftBaseArea = Math.max(1, leftBaseRadius * leftBaseRadius);
          const rightBaseArea = Math.max(1, rightBaseRadius * rightBaseRadius);
          const leftPhysicalArea = leftBaseArea * leftMass;
          const rightPhysicalArea = rightBaseArea * rightMass;
          let winner = left;
          let loser = right;
          let winnerMass = leftMass;
          let loserMass = rightMass;
          if (
            rightPhysicalArea > leftPhysicalArea * 1.04
            || (Math.abs(rightPhysicalArea - leftPhysicalArea) <= Math.min(leftBaseArea, rightBaseArea) * 0.04
              && ((Math.floor(elapsed / 11) + leftIndex + rightIndex) % 2) === 1)
          ) {
            winner = right;
            loser = left;
            winnerMass = rightMass;
            loserMass = leftMass;
          }

          const winnerBaseArea = winner === left ? leftBaseArea : rightBaseArea;
          const loserBaseArea = loser === left ? leftBaseArea : rightBaseArea;
          const availableArea = Math.max(0, (loserMass - GOOEY_WAX_MIN_MASS) * loserBaseArea);
          const winnerCapacity = Math.max(0, (GOOEY_WAX_MAX_MASS - winnerMass) * winnerBaseArea);
          const transferArea = Math.min(
            availableArea,
            winnerCapacity,
            Math.min(winnerBaseArea, loserBaseArea) * GOOEY_WAX_TRANSFER_RATE * mergeDepth * dt,
          );
          if (transferArea > 0) {
            winner._waxMass = winnerMass + (transferArea / winnerBaseArea);
            loser._waxMass = loserMass - (transferArea / loserBaseArea);
            const dwellOffset = (
              ((leftIndex + 1) * 977)
              + ((rightIndex + 1) * 1597)
            ) % GOOEY_WAX_DWELL_RANGE_MS;
            const holdUntil = nowEpoch + GOOEY_WAX_DWELL_MIN_MS + dwellOffset;
            const readyAt = holdUntil + GOOEY_WAX_RELEASE_COOLDOWN_MS;
            left._waxHoldUntil = holdUntil;
            right._waxHoldUntil = holdUntil;
            left._waxReadyAt = readyAt;
            right._waxReadyAt = readyAt;
          }
        }

        if (
          pairActive
          && !dwelling
          && nowEpoch >= pairReadyAt
          && Math.abs(resolveGooeyWaxMass(left) - 1) < 0.08
          && Math.abs(resolveGooeyWaxMass(right) - 1) < 0.08
        ) {
          left._waxPartner = -1;
          right._waxPartner = -1;
          left._waxReadyAt = nowEpoch + GOOEY_WAX_RELEASE_COOLDOWN_MS;
          right._waxReadyAt = nowEpoch + GOOEY_WAX_RELEASE_COOLDOWN_MS;
        }
      }
    }

    for (let index = 0; index < gooeyDriverBlobs.length; index += 1) {
      const blob = gooeyDriverBlobs[index];
      if (!(blob instanceof HTMLElement)) continue;
      const radius = resolveGooeyVisualRadius(blob);
      const speed = Math.hypot(blob._vx, blob._vy);
      if (speed > 0.0001) {
        if (speed > GOOEY_SPEED_MAX) {
          const scale = GOOEY_SPEED_MAX / speed;
          blob._vx *= scale;
          blob._vy *= scale;
        } else if (speed < GOOEY_SPEED_MIN) {
          const recoveredSpeed = Math.min(
            GOOEY_SPEED_MIN,
            speed + (GOOEY_SPEED_RECOVERY * dt),
          );
          const scale = recoveredSpeed / speed;
          blob._vx *= scale;
          blob._vy *= scale;
        }
      }

      blob._x += blob._vx * dt;
      blob._y += blob._vy * dt;

      if ((blob._x - radius <= 0 && blob._vx < 0) || (blob._x + radius >= vw && blob._vx > 0)) blob._vx *= -1;
      if ((blob._y - radius <= 0 && blob._vy < 0) || (blob._y + radius >= vh && blob._vy > 0)) blob._vy *= -1;

      blob._x = clampGooeyCoordinate(blob._x, radius, Math.max(vw - radius, radius));
      blob._y = clampGooeyCoordinate(blob._y, radius, Math.max(vh - radius, radius));
      applyGooeyBlobTransform(blob);
    }
    gooeyDriverLastFrame = now;
  }

  function gooeyMeshTick(now) {
    gooeyDriverRafId = requestAnimationFrame(gooeyMeshTick);
    if (document.hidden) {
      gooeyDriverLast = now;
      gooeyDriverLastFrame = now;
      return;
    }
    try { stepGooeyMesh(now); } catch {}
  }

  function startGooeyMeshDriver() {
    // Idempotent: only one loop per session. On later routes just refresh the
    // blob references in case the wrapper was rebuilt by a fallback path.
    if (gooeyDriverInstalled) {
      refreshGooeyDriverBlobs();
      return;
    }
    if (!document.getElementById('gooey-mesh-wrapper')) {
      repairPersistentGooeyMesh();
    }
    if (!document.getElementById('gooey-mesh-wrapper')) return;
    gooeyDriverInstalled = true;
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    gooeyDriverLast = now;
    gooeyDriverLastFrame = now;
    refreshGooeyDriverBlobs();
    gooeyDriverRafId = requestAnimationFrame(gooeyMeshTick);
    // Watchdog keeps integrating if RAF is starved (throttled/background tab),
    // so motion doesn't snap forward when the tab regains focus.
    gooeyDriverWatchdogId = window.setInterval(() => {
      if (document.hidden) return;
      const tick = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (tick - gooeyDriverLastFrame > 140) {
        try { stepGooeyMesh(tick); } catch {}
      }
    }, 80);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      const tick = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      gooeyDriverLast = tick;
      gooeyDriverLastFrame = tick;
    });
    window.addEventListener('resize', refreshGooeyDriverBlobs, { passive: true });
  }

  function ensureRouteStatusElements() {
    let progress = document.getElementById(ROUTE_PROGRESS_ID);
    if (!(progress instanceof HTMLElement)) {
      progress = document.createElement('div');
      progress.id = ROUTE_PROGRESS_ID;
      progress.className = 'dx-route-progress';
      progress.setAttribute('aria-hidden', 'true');
      progress.setAttribute('data-dx-route-progress', 'idle');
      progress.innerHTML = '<span class="dx-route-progress-track"><span class="dx-route-progress-bar"></span></span>';
      document.body.appendChild(progress);
    }

    let announcer = document.getElementById(ROUTE_ANNOUNCER_ID);
    if (!(announcer instanceof HTMLElement)) {
      announcer = document.createElement('div');
      announcer.id = ROUTE_ANNOUNCER_ID;
      announcer.className = 'dx-route-announcer';
      announcer.setAttribute('role', 'status');
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      document.body.appendChild(announcer);
    }
    return { progress, announcer };
  }

  function setRouteProgressActive(active) {
    const { progress } = ensureRouteStatusElements();
    if (routeProgressTimer) {
      window.clearTimeout(routeProgressTimer);
      routeProgressTimer = 0;
    }
    if (!active) {
      progress.setAttribute('data-dx-route-progress', 'idle');
      return;
    }
    progress.setAttribute('data-dx-route-progress', 'pending');
    routeProgressTimer = window.setTimeout(() => {
      routeProgressTimer = 0;
      if (!isNavigating) return;
      progress.setAttribute('data-dx-route-progress', 'visible');
    }, ROUTE_PROGRESS_DELAY_MS);
  }

  function announceRouteDestination(sourceDocument) {
    const { announcer } = ensureRouteStatusElements();
    const heading = sourceDocument && sourceDocument.querySelector
      ? sourceDocument.querySelector('h1, [role="heading"][aria-level="1"]')
      : null;
    const label = String(
      (heading && heading.textContent)
      || (sourceDocument && sourceDocument.title)
      || document.title
      || 'Page loaded',
    ).replace(/\s+/g, ' ').trim();
    announcer.textContent = '';
    window.setTimeout(() => {
      announcer.textContent = label ? `${label} loaded` : 'Page loaded';
    }, 20);
  }

  function focusRouteDestination(foregroundRoot) {
    if (!(foregroundRoot instanceof HTMLElement)) return;
    const target = foregroundRoot.querySelector(
      'h1, [role="heading"][aria-level="1"], main, [role="main"]',
    );
    if (!(target instanceof HTMLElement)) return;
    const hadTabIndex = target.hasAttribute('tabindex');
    if (!hadTabIndex) target.setAttribute('tabindex', '-1');
    try {
      target.focus({ preventScroll: true });
    } catch {
      target.focus();
    }
    if (!hadTabIndex) {
      target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
    }
  }

  function setRoutingState(active) {
    document.body.classList.toggle(ROUTING_CLASS, active);
    setRouteProgressActive(active);

    const scrollRoot = document.getElementById(SLOT_SCROLL_ID);
    if (!scrollRoot) return;

    if (active) {
      scrollRoot.setAttribute('aria-busy', 'true');
    } else {
      scrollRoot.removeAttribute('aria-busy');
    }
  }

  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch {
      return false;
    }
  }

  function parseCssTimeMs(rawValue, fallbackMs) {
    const raw = String(rawValue || '').trim();
    if (!raw) return fallbackMs;
    if (raw.endsWith('ms')) {
      const parsed = Number.parseFloat(raw.slice(0, -2));
      return Number.isFinite(parsed) ? parsed : fallbackMs;
    }
    if (raw.endsWith('s')) {
      const parsed = Number.parseFloat(raw.slice(0, -1));
      return Number.isFinite(parsed) ? parsed * 1000 : fallbackMs;
    }
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : fallbackMs;
  }

  function parseCssNumber(rawValue, fallbackValue) {
    const parsed = Number.parseFloat(String(rawValue || '').trim());
    return Number.isFinite(parsed) ? parsed : fallbackValue;
  }

  function readCssToken(node, token, fallback) {
    if (!node || typeof window.getComputedStyle !== 'function') return fallback;
    try {
      const style = window.getComputedStyle(node);
      const value = style.getPropertyValue(token);
      return value ? value.trim() : fallback;
    } catch {
      return fallback;
    }
  }

  function dispatchRouteTransitionEvent(name, detail = {}) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail }));
      return;
    } catch {}
    try {
      const legacyEvent = document.createEvent('CustomEvent');
      legacyEvent.initCustomEvent(name, false, false, detail);
      window.dispatchEvent(legacyEvent);
    } catch {}
  }

  function clearRouteMotionState(scopeEl) {
    if (!scopeEl || typeof scopeEl.removeAttribute !== 'function') return;
    scopeEl.removeAttribute('data-dx-motion');
    scopeEl.style.removeProperty('pointer-events');
  }

  function waitForMilliseconds(ms) {
    if (!ms || ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  async function runRouteMotion(scopeEl, mode, options = {}) {
    if (!scopeEl || prefersReducedMotion()) {
      clearRouteMotionState(scopeEl);
      return;
    }

    const signal = options.signal || null;
    const isExit = mode === 'out';
    const durationMs = parseCssTimeMs(
      readCssToken(scopeEl, isExit ? '--dx-motion-dur-sm' : '--dx-motion-dur-md', isExit ? '180ms' : '260ms'),
      isExit ? 180 : 260,
    );
    const distance = parseCssNumber(
      readCssToken(scopeEl, isExit ? '--dx-motion-distance-md' : '--dx-motion-distance-lg', isExit ? '10' : '20'),
      isExit ? 10 : 20,
    );
    const easing = readCssToken(scopeEl, isExit ? '--dx-motion-ease-exit' : '--dx-motion-ease-standard', isExit ? 'cubic-bezier(.4,0,.2,1)' : 'cubic-bezier(.22,.8,.24,1)');
    const keyframes = isExit
      ? [
          { opacity: 1, transform: 'translate3d(0, 0, 0)' },
          { opacity: 0, transform: `translate3d(0, ${distance}px, 0)` },
        ]
      : [
          { opacity: parseCssNumber(readCssToken(scopeEl, '--dx-motion-opacity-enter', '.001'), 0.001), transform: `translate3d(0, ${distance}px, 0)` },
          { opacity: 1, transform: 'translate3d(0, 0, 0)' },
        ];

    if (isExit) {
      scopeEl.setAttribute('data-dx-motion', 'route-exit');
      scopeEl.style.pointerEvents = 'none';
    } else {
      scopeEl.setAttribute('data-dx-motion', 'route-enter');
    }

    if (typeof scopeEl.animate !== 'function') {
      clearRouteMotionState(scopeEl);
      return;
    }

    let animation = null;
    try {
      animation = scopeEl.animate(keyframes, {
        duration: durationMs,
        easing,
        fill: 'both',
      });

      if (signal && typeof signal.addEventListener === 'function') {
        signal.addEventListener('abort', () => {
          try {
            animation.cancel();
          } catch {}
          clearRouteMotionState(scopeEl);
        }, { once: true });
      }

      await animation.finished;
    } catch {
      // Ignore route motion failures and keep navigation resilient.
    } finally {
      if (animation) {
        try {
          animation.cancel();
        } catch {}
      }
      clearRouteMotionState(scopeEl);
    }
  }

  function persistScrollState(scrollRoot) {
    if (!scrollRoot) return;
    const currentState = (history.state && typeof history.state === 'object') ? history.state : {};
    const nextState = {
      ...currentState,
      [HISTORY_SLOT_KEY]: true,
      [HISTORY_SCROLL_KEY]: scrollRoot.scrollTop,
      [HISTORY_INDEX_KEY]: Number.isFinite(Number(currentState[HISTORY_INDEX_KEY]))
        ? Number(currentState[HISTORY_INDEX_KEY])
        : routeHistoryIndex,
    };

    try {
      history.replaceState(nextState, document.title, window.location.href);
    } catch {}
  }

  function installScrollStateTracker(scrollRoot) {
    if (scrollStateInstalled || !scrollRoot) return;
    scrollStateInstalled = true;

    const schedulePersist = () => {
      if (isNavigating) return;
      if (scrollStateRafId) cancelAnimationFrame(scrollStateRafId);
      scrollStateRafId = requestAnimationFrame(() => {
        scrollStateRafId = 0;
        persistScrollState(scrollRoot);
      });
    };

    scrollRoot.addEventListener('scroll', schedulePersist, { passive: true });
    window.addEventListener('beforeunload', () => {
      persistScrollState(scrollRoot);
      persistGooeyMeshState();
    });
    window.addEventListener('pagehide', () => {
      persistGooeyMeshState();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) persistGooeyMeshState();
    });

    persistScrollState(scrollRoot);
  }

  function installSlotLayoutStabilizer(scrollRoot, foregroundRoot) {
    if (slotLayoutStabilizerInstalled || !scrollRoot || !foregroundRoot) return;
    slotLayoutStabilizerInstalled = true;

    let lastHeight = foregroundRoot.getBoundingClientRect().height;
    let rafId = 0;

    const schedule = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const nextHeight = foregroundRoot.getBoundingClientRect().height;
        const delta = nextHeight - lastHeight;
        lastHeight = nextHeight;
        if (!Number.isFinite(delta) || Math.abs(delta) < 0.5) return;

        const maxScroll = Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight);
        const isNearBottom = (maxScroll - scrollRoot.scrollTop) <= 120;
        if (isNearBottom && delta > 0) {
          scrollRoot.scrollTop = maxScroll;
        }
      });
    };

    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(schedule);
      observer.observe(foregroundRoot);
    }

    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('load', schedule);
    window.addEventListener('dx:slotready', () => {
      lastHeight = foregroundRoot.getBoundingClientRect().height;
      schedule();
    });
  }

  function syncDocumentFromRoute(sourceDocument, targetUrl) {
    if (sourceDocument.title) {
      document.title = sourceDocument.title;
    }

    syncHtmlAttributes(sourceDocument);
    syncBodyAttributes(sourceDocument.body);
    syncRouteIdentityAttributes(sourceDocument);
    syncProfileProtectedRouteState(targetUrl.pathname);
    markHeaderActiveForPath(targetUrl.pathname);
    syncProfileRouteGlassFromHeader(document);
  }

  function shouldBypassAnchor(anchor) {
    if (!anchor) return false;
    if (anchor.hasAttribute('download')) return true;
    if (anchor.hasAttribute('data-dx-soft-nav-skip')) return true;
    if (anchor.closest('[data-dx-soft-nav-skip]')) return true;

    const target = (anchor.getAttribute('target') || '').trim().toLowerCase();
    if (target && target !== '_self') return true;

    const href = String(anchor.getAttribute('href') || '').trim();
    if (!href) return true;
    if (href.startsWith('#')) return true;
    if (href.startsWith('javascript:')) return true;
    if (href.startsWith('mailto:') || href.startsWith('tel:')) return true;

    return false;
  }

  // Soft-nav-eligible app routes that live under /entry/. Every *other* /entry/
  // path is a content entry page.
  const SOFT_NAV_ENTRY_APP_ROUTES = new Set([
    '/entry/favorites',
    '/entry/submit',
    '/entry/messages',
    '/entry/messages/submission',
    '/entry/pressroom',
    '/entry/settings',
    '/entry/achievements',
    '/entry/bag',
  ]);

  // Content entry pages (/entry/<slug>/) still use a document-scoped generated
  // shell and dex-sidebar hydration lifecycle. Keep them on normal navigation
  // until that lifecycle is converted to the atomic slot-route contract.
  function isContentEntryRoute(pathname) {
    const normalized = String(pathname || '').toLowerCase().replace(/\/+$/, '') || '/';
    if (!normalized.startsWith('/entry/')) return false;
    return !SOFT_NAV_ENTRY_APP_ROUTES.has(normalized);
  }

  function shouldHandleSoftNavigation(targetUrl, anchor = null) {
    if (!targetUrl) return false;
    if (!isHttpUrl(targetUrl)) return false;
    if (!isSameOriginUrl(targetUrl)) return false;
    if (anchor && shouldBypassAnchor(anchor)) return false;

    const pathname = targetUrl.pathname.toLowerCase();
    if (pathname.endsWith('.xml') || pathname.endsWith('.pdf') || pathname.endsWith('.json')) return false;
    if (pathname.startsWith('/assets/')) return false;
    if (isContentEntryRoute(pathname)) return false;

    return true;
  }

  function routePathSegments(pathname) {
    return normalizePathname(pathname).split('/').filter(Boolean);
  }

  function isRouteDetailPath(pathname) {
    const parts = routePathSegments(pathname);
    if (parts[0] === 'uav' && parts.length >= 2) return true;
    if (parts[0] === 'dexnotes' && parts.length >= 2) return true;
    return false;
  }

  function classifyRouteTransition(fromUrl, toUrl, options = {}) {
    const direction = String(options.navigationDirection || '').trim();
    if (direction === 'back') return 'dx-back';
    const fromPath = normalizePathname(fromUrl && fromUrl.pathname);
    const toPath = normalizePathname(toUrl && toUrl.pathname);
    const fromParts = routePathSegments(fromPath);
    const toParts = routePathSegments(toPath);

    if (isRouteDetailPath(toPath) && !isRouteDetailPath(fromPath)) return 'dx-detail';
    if (direction === 'forward') return 'dx-forward';
    if (isRouteDetailPath(fromPath) && !isRouteDetailPath(toPath)) return 'dx-back';
    if (toParts.length > fromParts.length) return 'dx-forward';
    if (toParts.length < fromParts.length) return 'dx-back';
    if ((fromParts[0] || '') !== (toParts[0] || '')) return 'dx-section';
    return 'dx-peer';
  }

  function canUseViewTransition() {
    return !prefersReducedMotion() && typeof document.startViewTransition === 'function';
  }

  function markSharedRouteSource(anchor, transitionType) {
    if (transitionType !== 'dx-detail' || !(anchor instanceof HTMLAnchorElement)) return null;
    const source = anchor.closest([
      '.dx-catalog-index-row',
      '.dx-catalog-index-season-slide',
      '.dx-catalog-index-spotlight',
      '.dx-dexnotes-card',
      '.dx-dexnotes-lead-card',
    ].join(','));
    if (!(source instanceof HTMLElement)) return null;
    source.style.viewTransitionName = ROUTE_SHARED_NAME;
    source.setAttribute('data-dx-route-shared', 'source');
    return source;
  }

  function markSharedRouteDestination(foregroundRoot, targetUrl, transitionType) {
    if (transitionType !== 'dx-detail' || !(foregroundRoot instanceof HTMLElement)) return null;
    const pathname = normalizePathname(targetUrl && targetUrl.pathname);
    let selector = '[data-dx-route-shared-target]';
    if (pathname.startsWith('/uav/')) {
      selector = '.dx-uav-entry-header, .dx-uav-entry-card';
    } else if (pathname.startsWith('/dexnotes/')) {
      selector = '[data-dexnotes-entry-app], .dx-dexnotes-entry-shell';
    }
    const target = foregroundRoot.querySelector(selector);
    if (!(target instanceof HTMLElement)) return null;
    target.style.viewTransitionName = ROUTE_SHARED_NAME;
    target.setAttribute('data-dx-route-shared', 'destination');
    return target;
  }

  function clearSharedRouteNode(node) {
    if (!(node instanceof HTMLElement)) return;
    node.style.removeProperty('view-transition-name');
    node.removeAttribute('data-dx-route-shared');
  }

  function routePrefetchKey(targetUrl) {
    if (!(targetUrl instanceof URL)) return '';
    const keyUrl = new URL(targetUrl.href);
    keyUrl.hash = '';
    return keyUrl.href;
  }

  function canPrefetchRoutes() {
    if (document.visibilityState === 'hidden') return false;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!connection) return true;
    if (connection.saveData) return false;
    return !/(?:^|-)2g$/i.test(String(connection.effectiveType || ''));
  }

  async function readRouteResponse(response, targetUrl) {
    const contentType = String(response.headers.get('content-type') || '');
    if (!response.ok || !contentType.includes('text/html')) {
      throw new Error(`Soft route fetch failed (${response.status}).`);
    }
    return {
      html: await response.text(),
      responseUrl: response.url || targetUrl.href,
    };
  }

  function warmRouteDependencyCache(payload) {
    if (!payload || !payload.html || !canPrefetchRoutes()) return;
    const parsed = new DOMParser().parseFromString(payload.html, 'text/html');
    if (!parsed || !parsed.body) return;

    const baseUrl = payload.responseUrl || window.location.href;
    const definitions = [
      ...collectRouteStyleDefinitions(parsed, baseUrl),
      ...collectRouteScripts(parsed, baseUrl),
    ];
    const loadedAssets = new Set(Array.from(document.querySelectorAll('link[href], script[src]')).map((node) => {
      const rawUrl = node.getAttribute('href') || node.getAttribute('src');
      return toAbsoluteUrl(rawUrl)?.href || '';
    }).filter(Boolean));
    const urls = Array.from(new Set(definitions
      .map((definition) => definition.url)
      .filter((url) => isSameOriginUrl(url) && !loadedAssets.has(url.href))
      .map((url) => url.href)));

    for (const href of urls) {
      void fetch(href, {
        credentials: 'same-origin',
        cache: 'force-cache',
      }).then((response) => {
        if (!response.ok) throw new Error(`Route dependency prefetch failed (${response.status}).`);
        return response.arrayBuffer();
      }).catch(() => {});
    }
  }

  function installHistoryStateGuard() {
    if (historyStateGuardInstalled) return;
    historyStateGuardInstalled = true;
    const nativeReplaceState = history.replaceState.bind(history);
    history.replaceState = (state, title, url) => {
      const currentState = history.state && typeof history.state === 'object' ? history.state : {};
      const nextState = state && typeof state === 'object' ? { ...state } : {};
      for (const key of [HISTORY_SLOT_KEY, HISTORY_SCROLL_KEY, HISTORY_INDEX_KEY]) {
        if (!(key in nextState) && key in currentState) {
          nextState[key] = currentState[key];
        }
      }
      return nativeReplaceState(nextState, title, url);
    };
  }

  function pruneRoutePrefetches() {
    const now = Date.now();
    for (const [key, record] of routeDocumentPrefetches) {
      if (!record || (now - record.createdAt) > ROUTE_PREFETCH_TTL_MS) {
        routeDocumentPrefetches.delete(key);
      }
    }
    while (routeDocumentPrefetches.size >= ROUTE_PREFETCH_LIMIT) {
      const oldestKey = routeDocumentPrefetches.keys().next().value;
      if (!oldestKey) break;
      routeDocumentPrefetches.delete(oldestKey);
    }
  }

  function prefetchRouteDocument(targetUrl) {
    if (!(targetUrl instanceof URL) || !canPrefetchRoutes()) return null;
    if (!shouldHandleSoftNavigation(targetUrl)) return null;
    if (normalizeRouteKey(targetUrl) === normalizeRouteKey(new URL(window.location.href))) return null;
    const key = routePrefetchKey(targetUrl);
    if (!key) return null;

    const current = routeDocumentPrefetches.get(key);
    if (current && (Date.now() - current.createdAt) <= ROUTE_PREFETCH_TTL_MS) {
      return current.promise;
    }

    pruneRoutePrefetches();
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), ROUTE_PREFETCH_TIMEOUT_MS);
    const promise = fetch(key, {
      credentials: 'same-origin',
      cache: 'force-cache',
      signal: controller.signal,
    })
      .then((response) => readRouteResponse(response, targetUrl))
      .then((payload) => {
        warmRouteDependencyCache(payload);
        return payload;
      })
      .finally(() => window.clearTimeout(timeoutId));
    const record = {
      createdAt: Date.now(),
      promise,
    };
    routeDocumentPrefetches.set(key, record);
    promise.catch(() => {
      if (routeDocumentPrefetches.get(key) === record) {
        routeDocumentPrefetches.delete(key);
      }
    });
    return promise;
  }

  function waitForRoutePayload(promise, signal) {
    if (!signal) return promise;
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', onAbort);
        callback(value);
      };
      const onAbort = () => finish(reject, new DOMException('Route navigation aborted.', 'AbortError'));
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
      promise.then(
        (value) => finish(resolve, value),
        (error) => finish(reject, error),
      );
    });
  }

  async function fetchRoutePayload(targetUrl, signal) {
    const key = routePrefetchKey(targetUrl);
    const prefetched = key ? routeDocumentPrefetches.get(key) : null;
    if (prefetched && (Date.now() - prefetched.createdAt) <= ROUTE_PREFETCH_TTL_MS) {
      try {
        return await waitForRoutePayload(prefetched.promise, signal);
      } catch (error) {
        if (error && error.name === 'AbortError') throw error;
        routeDocumentPrefetches.delete(key);
      }
    }

    const response = await fetch(targetUrl.href, {
      credentials: 'same-origin',
      signal,
    });
    return readRouteResponse(response, targetUrl);
  }

  function scheduleRoutePrefetch(anchor, delayMs = ROUTE_PREFETCH_DELAY_MS) {
    if (!(anchor instanceof HTMLAnchorElement)) return;
    const targetUrl = isHeaderWordmarkAnchor(anchor)
      ? new URL('/', window.location.origin)
      : toAbsoluteUrl(anchor.getAttribute('href'));
    if (!targetUrl || !shouldHandleSoftNavigation(targetUrl, anchor)) return;

    const href = routePrefetchKey(targetUrl);
    if (!href || routeDocumentPrefetches.has(href)) return;
    if (routePrefetchTimer && routePrefetchCandidateHref === href) return;
    if (routePrefetchTimer) window.clearTimeout(routePrefetchTimer);
    routePrefetchCandidateHref = href;
    routePrefetchTimer = window.setTimeout(() => {
      routePrefetchTimer = 0;
      routePrefetchCandidateHref = '';
      void prefetchRouteDocument(targetUrl);
    }, Math.max(0, delayMs));
  }

  async function prepareRouteDocument(sourceDocument, targetUrl, options = {}) {
    const styleTransaction = await prepareRouteStyles(sourceDocument, targetUrl.href, {
      signal: options.signal || null,
    });
    const scripts = collectRouteScripts(sourceDocument, targetUrl.href);

    try {
      await Promise.all([
        preloadRouteScripts(scripts, { signal: options.signal || undefined }),
        ensureBackdropElementsFromTemplateIfMissing(),
      ]);
    } catch (error) {
      styleTransaction.dispose();
      throw error;
    }

    const { fragment, inlineScripts } = buildForegroundFragment(sourceDocument);
    return {
      styleTransaction,
      scripts,
      fragment,
      inlineScripts,
      committed: false,
    };
  }

  async function applyRouteDocument(sourceDocument, targetUrl, options = {}) {
    const headerElement = getHeaderElement(document);
    if (!headerElement) throw new Error('Unable to locate persistent header for soft route.');

    const container = headerElement.parentElement || document.body;
    const { scrollRoot, foregroundRoot } = ensureSlotRoots(container, headerElement);
    const routePlan = options.routePlan || await prepareRouteDocument(sourceDocument, targetUrl, {
      signal: options.signal || null,
    });
    const meshState = captureGooeyMeshState();
    const transitionType = String(options.transitionType || 'dx-peer');
    const useViewTransition = options.useViewTransition === true && canUseViewTransition();
    const sharedSource = options.sharedSource instanceof HTMLElement ? options.sharedSource : null;
    const previousContentTransitionName = foregroundRoot.style.viewTransitionName || '';
    let sharedTarget = null;
    let viewTransition = null;

    const clearTransitionState = () => {
      if (previousContentTransitionName) {
        foregroundRoot.style.viewTransitionName = previousContentTransitionName;
      } else {
        foregroundRoot.style.removeProperty('view-transition-name');
      }
      clearSharedRouteNode(sharedSource);
      clearSharedRouteNode(sharedTarget);
      if (document.documentElement.getAttribute(ROUTE_TRANSITION_TYPE_ATTR) === transitionType) {
        document.documentElement.removeAttribute(ROUTE_TRANSITION_TYPE_ATTR);
      }
    };

    const commitRoute = () => {
      if (routePlan.committed) return;
      if (options.signal && options.signal.aborted) {
        throw new DOMException('Route navigation aborted.', 'AbortError');
      }
      // Atomic commit boundary: styles are already downloaded but disabled. The
      // browser cannot paint between these synchronous mutations, so destination
      // classes, stylesheet order, and foreground content become visible together.
      routePlan.styleTransaction.commit();
      syncDocumentFromRoute(sourceDocument, targetUrl);
      clearChildren(foregroundRoot);
      foregroundRoot.appendChild(routePlan.fragment);
      moveDetachedFooterSectionsIntoForeground(foregroundRoot);
      sharedTarget = markSharedRouteDestination(foregroundRoot, targetUrl, transitionType);
      ensureBackdropLayersOutsideForeground();
      ensureCanonicalGooeyMeshPresentation();
      clearRouteScripts();
      routePlan.committed = true;
      window.__dxLastSlotUrl = targetUrl.href;
      if (typeof options.onCommitted === 'function') {
        options.onCommitted({ scrollRoot, foregroundRoot, routePlan, viewTransition });
      }
    };

    if (useViewTransition) {
      document.documentElement.setAttribute(ROUTE_TRANSITION_TYPE_ATTR, transitionType);
      foregroundRoot.style.viewTransitionName = ROUTE_CONTENT_NAME;
      try {
        viewTransition = document.startViewTransition(commitRoute);
        if (viewTransition && viewTransition.types && typeof viewTransition.types.add === 'function') {
          viewTransition.types.add(transitionType);
        }
        if (viewTransition && viewTransition.updateCallbackDone) {
          await viewTransition.updateCallbackDone;
        }
      } catch {
        try {
          if (viewTransition && typeof viewTransition.skipTransition === 'function') {
            viewTransition.skipTransition();
          }
        } catch {}
        if (options.signal && options.signal.aborted) {
          clearTransitionState();
          throw new DOMException('Route navigation aborted.', 'AbortError');
        }
        commitRoute();
        viewTransition = null;
      }
    } else {
      commitRoute();
    }

    if (viewTransition && viewTransition.finished) {
      Promise.resolve(viewTransition.finished).then(clearTransitionState, clearTransitionState);
    } else {
      clearTransitionState();
    }

    await loadRouteScripts(routePlan.scripts);
    loadInlineRouteScripts(routePlan.inlineScripts);
    applyHeadingTypographyAndSupportHooks(document);

    if (meshState) {
      restoreGooeyMeshState(meshState);
      persistGooeyMeshState(meshState);
      requestAnimationFrame(() => {
        restoreGooeyMeshState(meshState);
        persistGooeyMeshState();
      });
    }

    if (typeof options.restoreScrollTop === 'number' && Number.isFinite(options.restoreScrollTop)) {
      scrollRoot.scrollTop = Math.max(0, options.restoreScrollTop);
    } else if (targetUrl.hash) {
      scrollToHashTarget(targetUrl.hash);
    } else {
      scrollRoot.scrollTop = 0;
    }

    dispatchSlotReady(scrollRoot, foregroundRoot, targetUrl.href);
    announceRouteDestination(sourceDocument);
    if (options.focusDestination === true) {
      focusRouteDestination(foregroundRoot);
    }
    scheduleProfileViewportMetricsSync();
    syncProfileRouteGlassFromHeader(document);
    requestAnimationFrame(() => {
      ensureBackdropLayersOutsideForeground();
      ensureCanonicalGooeyMeshPresentation();
      applyHeadingTypographyAndSupportHooks(document);
      scheduleProfileViewportMetricsSync();
      syncProfileRouteGlassFromHeader(document);
      seedInitialGooeyMeshPositionsIfStacked();
      normalizeLiveGooeyMeshVelocities();
      startGooeyMeshDriver();
      persistGooeyMeshState();
    });
    installScrollStateTracker(scrollRoot);
    persistScrollState(scrollRoot);
    return {
      scrollRoot,
      foregroundRoot,
      routePlan,
      viewTransition,
      transitionType,
    };
  }

  function hardNavigate(url) {
    window.location.assign(url);
  }

  async function softNavigate(target, options = {}) {
    const targetUrl = (target instanceof URL) ? target : toAbsoluteUrl(String(target || ''), window.location.href);
    if (!targetUrl) return false;

    if (!shouldHandleSoftNavigation(targetUrl, options.anchor || null)) {
      if (options.allowHardNavigate === false) return false;
      hardNavigate(targetUrl.href);
      return false;
    }

    const locationUrl = new URL(window.location.href);
    const renderedUrl = toAbsoluteUrl(String(window.__dxLastSlotUrl || ''), locationUrl.href);
    const currentUrl = renderedUrl || locationUrl;
    const sameRoute = normalizeRouteKey(currentUrl) === normalizeRouteKey(targetUrl);
    const scrollRoot = document.getElementById(SLOT_SCROLL_ID);

    if (sameRoute) {
      if (options.pushHistory && currentUrl.hash !== targetUrl.hash) {
        try {
          const nextHistoryIndex = routeHistoryIndex + 1;
          history.pushState({
            [HISTORY_SLOT_KEY]: true,
            [HISTORY_SCROLL_KEY]: scrollRoot ? scrollRoot.scrollTop : 0,
            [HISTORY_INDEX_KEY]: nextHistoryIndex,
          }, document.title, targetUrl.href);
          routeHistoryIndex = nextHistoryIndex;
        } catch {}
      }

      if (typeof options.restoreScrollTop === 'number' && scrollRoot) {
        scrollRoot.scrollTop = Math.max(0, options.restoreScrollTop);
      } else if (targetUrl.hash) {
        scrollToHashTarget(targetUrl.hash);
      }

      if (scrollRoot) persistScrollState(scrollRoot);
      if (!options.pushHistory && Number.isFinite(Number(options.historyIndex))) {
        routeHistoryIndex = Number(options.historyIndex);
      }
      return true;
    }

    if (routeAbortController) {
      routeAbortController.abort();
      routeAbortController = null;
    }

    const abortController = new AbortController();
    routeAbortController = abortController;
    isNavigating = true;
    setRoutingState(true);
    const transitionType = classifyRouteTransition(currentUrl, targetUrl, options);
    const useViewTransition = canUseViewTransition();
    const transitionDetail = {
      from: normalizePathname(currentUrl.pathname),
      to: normalizePathname(targetUrl.pathname),
      type: transitionType,
      direction: String(options.navigationDirection || ''),
    };
    let didDispatchOutStart = false;
    let didDispatchOutEnd = false;
    let didDispatchInStart = false;
    let didDispatchInEnd = false;
    let didCommitRoute = false;
    let routePlan = null;
    let sharedSource = null;

    try {
      // Fetch and stage every destination dependency while the current route is
      // still fully rendered. No route teardown or history mutation happens yet.
      const payload = await fetchRoutePayload(targetUrl, abortController.signal);
      const parsed = new DOMParser().parseFromString(payload.html, 'text/html');
      if (!parsed || !parsed.body) {
        throw new Error('Soft route parse failed.');
      }

      const finalUrl = toAbsoluteUrl(payload.responseUrl || targetUrl.href, targetUrl.href) || targetUrl;
      finalUrl.search = targetUrl.search;
      finalUrl.hash = targetUrl.hash;

      routePlan = await prepareRouteDocument(parsed, finalUrl, {
        signal: abortController.signal,
      });
      if (abortController.signal.aborted) {
        throw new DOMException('Route navigation aborted.', 'AbortError');
      }

      const outgoingScope = document.getElementById(SLOT_FOREGROUND_ID);
      dispatchRouteTransitionEvent(ROUTE_TRANSITION_OUT_START, transitionDetail);
      didDispatchOutStart = true;
      if (!useViewTransition) {
        await Promise.race([
          runRouteMotion(outgoingScope, 'out', { signal: abortController.signal }),
          waitForMilliseconds(220),
        ]);
      }
      if (abortController.signal.aborted) {
        throw new DOMException('Route navigation aborted.', 'AbortError');
      }

      sharedSource = useViewTransition
        ? markSharedRouteSource(options.anchor || null, transitionType)
        : null;
      const appliedRoute = await applyRouteDocument(parsed, finalUrl, {
        ...options,
        signal: abortController.signal,
        routePlan,
        transitionType,
        useViewTransition,
        sharedSource,
        onCommitted: () => {
          didCommitRoute = true;
          dispatchRouteTransitionEvent(ROUTE_TRANSITION_OUT_END, transitionDetail);
          didDispatchOutEnd = true;
          if (useViewTransition) {
            dispatchRouteTransitionEvent(ROUTE_TRANSITION_IN_START, transitionDetail);
            didDispatchInStart = true;
          }
          if (options.pushHistory) {
            try {
              const nextHistoryIndex = routeHistoryIndex + 1;
              history.pushState(
                {
                  [HISTORY_SLOT_KEY]: true,
                  [HISTORY_SCROLL_KEY]: 0,
                  [HISTORY_INDEX_KEY]: nextHistoryIndex,
                },
                parsed.title || document.title,
                finalUrl.href,
              );
              routeHistoryIndex = nextHistoryIndex;
            } catch {}
          } else if (Number.isFinite(Number(options.historyIndex))) {
            routeHistoryIndex = Number(options.historyIndex);
          }
        },
      });
      if (useViewTransition) {
        if (appliedRoute.viewTransition && appliedRoute.viewTransition.finished) {
          await Promise.resolve(appliedRoute.viewTransition.finished).catch(() => {});
        }
      } else {
        dispatchRouteTransitionEvent(ROUTE_TRANSITION_IN_START, transitionDetail);
        didDispatchInStart = true;
        await Promise.race([
          runRouteMotion(document.getElementById(SLOT_FOREGROUND_ID), 'in', { signal: abortController.signal }),
          waitForMilliseconds(320),
        ]);
      }
      dispatchRouteTransitionEvent(ROUTE_TRANSITION_IN_END, transitionDetail);
      didDispatchInEnd = true;

      return true;
    } catch (error) {
      if (routePlan && !didCommitRoute) routePlan.styleTransaction.dispose();
      clearSharedRouteNode(sharedSource);
      if (error && error.name === 'AbortError') return false;
      hardNavigate(targetUrl.href);
      return false;
    } finally {
      if (routeAbortController === abortController) {
        routeAbortController = null;
      }
      if (didCommitRoute && didDispatchOutStart && !didDispatchOutEnd) {
        dispatchRouteTransitionEvent(ROUTE_TRANSITION_OUT_END, transitionDetail);
      }
      if (didDispatchInStart && !didDispatchInEnd) {
        dispatchRouteTransitionEvent(ROUTE_TRANSITION_IN_END, transitionDetail);
      }
      isNavigating = false;
      setRoutingState(false);
    }
  }

  function installSoftRouter() {
    if (softRouterInstalled) return;
    softRouterInstalled = true;

    document.addEventListener('pointerover', (event) => {
      if (event.pointerType === 'touch') return;
      const anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
      scheduleRoutePrefetch(anchor);
    }, { passive: true, capture: true });

    document.addEventListener('focusin', (event) => {
      const anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
      scheduleRoutePrefetch(anchor, 0);
    }, true);

    document.addEventListener('touchstart', (event) => {
      const anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
      scheduleRoutePrefetch(anchor, 0);
    }, { passive: true, capture: true });

    document.addEventListener('click', (event) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
      if (!anchor) return;
      const mobileMenuRoot = anchor.closest(`#${MOBILE_MENU_ROOT_ID}`);
      if (mobileMenuRoot instanceof HTMLElement) {
        handleMobileMenuRouteClick(mobileMenuRoot, anchor, event);
        return;
      }

      const targetUrl = isHeaderWordmarkAnchor(anchor)
        ? new URL('/', window.location.origin)
        : toAbsoluteUrl(anchor.getAttribute('href'));
      if (!targetUrl) return;
      if (!shouldHandleSoftNavigation(targetUrl, anchor)) return;

      if (isHeaderWordmarkAnchor(anchor)) {
        anchor.setAttribute('href', '/');
        anchor.setAttribute('data-dx-home-link', 'true');
      }

      event.preventDefault();
      void softNavigate(targetUrl, {
        pushHistory: true,
        anchor,
        focusDestination: Number(event.detail) === 0,
      });
    }, true);

    window.addEventListener('popstate', (event) => {
      const restoreScrollTop = event && event.state && typeof event.state[HISTORY_SCROLL_KEY] === 'number'
        ? event.state[HISTORY_SCROLL_KEY]
        : null;
      const targetHistoryIndex = event && event.state && Number.isFinite(Number(event.state[HISTORY_INDEX_KEY]))
        ? Number(event.state[HISTORY_INDEX_KEY])
        : null;
      const navigationDirection = targetHistoryIndex === null
        ? ''
        : (targetHistoryIndex < routeHistoryIndex ? 'back' : 'forward');

      void softNavigate(window.location.href, {
        pushHistory: false,
        restoreScrollTop,
        allowHardNavigate: true,
        historyIndex: targetHistoryIndex,
        navigationDirection,
      });
    });
  }

  async function init() {
    ensureViewportFitCover();
    installIosSafariViewportSync();
    installHistoryStateGuard();

    const shouldForceBootstrap = shouldForcePersistentChromeBootstrap(window.location.pathname)
      && !hasCompletePersistentChrome(document);
    // Contract marker: getHeaderElement(document) || await bootstrapPersistentChromeIfMissing()
    const headerElement = await bootstrapPersistentChromeIfMissing({ force: shouldForceBootstrap }) || getHeaderElement(document);
    if (!headerElement) return;

    const container = headerElement.parentElement || document.body;
    const initialScroll = window.scrollY || document.documentElement.scrollTop || 0;
    const { scrollRoot, foregroundRoot } = ensureSlotRoots(container, headerElement);

    moveForegroundNodes(container, headerElement, scrollRoot, foregroundRoot);
    moveDetachedFooterSectionsIntoForeground(foregroundRoot);
    await ensureBackdropElementsFromTemplateIfMissing();
    ensureBackdropLayersOutsideForeground();
    ensureCanonicalGooeyMeshPresentation();
    const persistedMeshState = readPersistedGooeyMeshState();
    if (persistedMeshState) {
      restoreGooeyMeshState(persistedMeshState);
    }

    document.body.classList.add(BODY_CLASS);
    ensureRouteStatusElements();
    syncProfileProtectedRouteState(window.location.pathname);
    normalizeHeaderWordmarkLinks();
    applyHeadingTypographyAndSupportHooks(document);
    syncProfileRouteGlassFromHeader(document);

    window.dxGetSlotScrollRoot = () => document.getElementById(SLOT_SCROLL_ID);
    window.dxGetSlotForegroundRoot = () => document.getElementById(SLOT_FOREGROUND_ID);
    window.dxNavigate = (target, options = {}) => softNavigate(target, { ...options, allowHardNavigate: true });

    installSoftRouter();
    installScrollStateTracker(scrollRoot);
    persistScrollState(scrollRoot);
    installSlotLayoutStabilizer(scrollRoot, foregroundRoot);
    installProfileViewportMetricsSync();
    installMobileMenu();

    requestAnimationFrame(() => {
      ensureBackdropLayersOutsideForeground();
      ensureCanonicalGooeyMeshPresentation();
      if (persistedMeshState) {
        restoreGooeyMeshState(persistedMeshState);
      }
      seedInitialGooeyMeshPositionsIfStacked();
      normalizeLiveGooeyMeshVelocities();
      startGooeyMeshDriver();
      if (initialScroll > 0) {
        scrollRoot.scrollTop = initialScroll;
      }
      scrollToHashTarget(window.location.hash);
      dispatchSlotReady(scrollRoot, foregroundRoot, window.location.href);
      installHomeHeroAligner();
      normalizeMobileBurgerHooks(document);
      applyHeadingTypographyAndSupportHooks(document);
      scheduleProfileViewportMetricsSync();
      syncProfileRouteGlassFromHeader(document);
      persistGooeyMeshState();
      persistScrollState(scrollRoot);
    });

    window.addEventListener('hashchange', () => {
      requestAnimationFrame(() => {
        scrollToHashTarget(window.location.hash);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      void init();
    }, { once: true });
  } else {
    void init();
  }
})();
