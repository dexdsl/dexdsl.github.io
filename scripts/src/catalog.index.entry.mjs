import { animate } from 'framer-motion/dom';
import Fuse from 'fuse.js';
import { bindDexButtonMotion, bindPaginationMotion, prefersReducedMotion, revealStagger } from './shared/dx-motion.entry.mjs';
import { mountMarketingNewsletter } from './shared/dx-marketing-newsletter.entry.mjs';
import { deriveAuthority, protectName } from '../lib/performer-authority.mjs';
import { parseLookup, normalizeLookup } from '../lib/lookup-authority.mjs';
import { parseUavLookup, normalizeUavLookup } from '../lib/uav-lookup-authority.mjs';
import { startBlobMotion } from './shared/dx-gooey-mesh.entry.mjs';

(() => {
  if (typeof window === 'undefined') return;
  if (window.__dxCatalogIndexLoaded) return;
  window.__dxCatalogIndexLoaded = true;

  const APP_SELECTOR = '[data-catalog-index-app]';
  const ENTRIES_URL = '/data/catalog.entries.json';
  const SEARCH_URL = '/data/catalog.search.json';
  const SEASONS_URL = '/data/catalog.seasons.json';
  const DEFAULT_UNANNOUNCED_MESSAGE = 'this collection has not been announced yet';
  const DEFAULT_UNANNOUNCED_TOKEN_POOL = ['???', '!!!', '***', '@@@'];
  const CATALOG_FALLBACK_IMAGE = '/assets/series/dex.png';
  // While the Current lane has fewer than this many real entries, the S3 slot
  // shows a "submit samples" funnel instead of the unannounced teaser; once the
  // lane fills past it, the teaser returns.
  const CURRENT_LANE_THIN_MAX = 3;
  const SUBMIT_SAMPLES_HREF = '/entry/submit/';
  const CAROUSEL_GROUPS = [
    {
      id: 'current',
      label: 'Current',
      meta: 'season 3 + UAV tour 1',
      campaigns: ['S3', 'UAV T1'],
    },
    {
      id: 'archive',
      label: 'Archive',
      meta: 'seasons 1–2',
      campaigns: ['S2', 'S1'],
    },
  ];
  const REDIRECT_HASHES = {
    '#dex-how': '/catalog/how/#dex-how',
    '#list-of-identifiers': '/catalog/symbols/#list-of-identifiers',
  };

  const MODE_VALUES = ['performer', 'instrument', 'lookup'];
  const SORT_VALUES = ['alpha', 'recent', 'lookup'];
  const DEFAULT_STATE = {
    mode: 'performer',
    season: 'all',
    instrument: 'all',
    q: '',
    sort: 'alpha',
  };

  let model = null;
  let searchModel = null;
  let seasonsModel = null;
  let fuse = null;
  let state = { ...DEFAULT_STATE };
  let drawerOpen = false;
  let seasonCarouselGroup = 'current';
  let seasonCarouselGroupIndexes = new Map();
  let seasonTeaserSeed = '';
  let favoritesSignalsBound = false;
  let newsletterActivated = false;
  let newsletterScrollListenerBound = false;
  const ZWNJ = '\u200C';
  const FAVORITES_STORAGE_PREFIX = 'dex:favorites:v2:';
  const FAVORITES_UI_STYLE_ID = 'dx-favorites-ui-style';
  const FAVORITES_TOAST_ROOT_ID = 'dx-favorites-toast-root';
  const FAVORITES_TOAST_ID = 'dx-favorites-toast';
  const HEART_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6 dx-fav-heart-svg" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
    </svg>
  `.trim();
  const OPEN_ENTRY_ARROW_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6 dx-catalog-index-row-open-svg" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
  `.trim();
  let favoritesToastTimer = 0;

  function redirectLegacyHashes() {
    const target = REDIRECT_HASHES[window.location.hash || ''];
    if (target) {
      window.location.replace(target);
      return true;
    }
    return false;
  }

  function text(value) {
    return String(value ?? '');
  }

  function normalize(value) {
    return text(value).toLowerCase();
  }

  // Standardized performer name (MARC/LCNAF "Surname, Forename"). Prefers the
  // authority fields baked into the catalog data; falls back to deriving on the
  // fly so the page is correct even against un-normalized data.
  function performerHeading(entry) {
    if (entry?.kind === 'uav') return text(entry?.uav?.site?.name || 'Unknown site');
    const baked = text(entry?.performer_display).trim();
    if (baked) return baked;
    return deriveAuthority(entry?.performer_raw, entry?.performer_norm).performer_display || text(entry?.performer_raw);
  }

  // Lowercased authority sort key — used to collocate name variants into one
  // group ("Cameron Church" / "cameron church" → "church, cameron").
  function performerSortKey(entry) {
    if (entry?.kind === 'uav') return normalize(entry?.uav?.site?.name || entry?.title_raw);
    const baked = text(entry?.performer_norm).trim();
    if (baked) return baked;
    return deriveAuthority(entry?.performer_raw, entry?.performer_norm).performer_norm || normalize(entry?.performer_raw);
  }

  // Re-derivation guard: re-compute the performer + lookup authority for every
  // loaded entry, so the page is correct against raw/stale/partly-normalized data
  // without depending on the `catalog:performers:normalize` script having run.
  // The raw forms (performer_raw, lookup_raw) remain the source of truth; the
  // derived fields are overwritten idempotently.
  function normalizeLoadedEntry(entry) {
    if (!entry || typeof entry !== 'object') return entry;
    if (entry.kind === 'uav' || /^DR\./i.test(text(entry.lookup_raw))) {
      entry.kind = 'uav';
      const parsedUav = parseUavLookup(entry.lookup_raw);
      entry.lookup_norm = normalizeUavLookup(entry.lookup_raw);
      if (parsedUav.valid) {
        entry.lookup = {
          wing: parsedUav.wing,
          subject: parsedUav.subjectCode,
          site_cutter: parsedUav.siteCutter,
          year: parsedUav.year,
          tour: parsedUav.tour,
        };
      }
      return entry;
    }
    const authority = deriveAuthority(entry.performer_raw, entry.performer_norm);
    if (authority.performer_display) entry.performer_display = authority.performer_display;
    if (authority.performer_norm) entry.performer_norm = authority.performer_norm;
    if (authority.performers && authority.performers.length) entry.performers = authority.performers;

    const lookupNorm = normalizeLookup(entry.lookup_raw);
    if (lookupNorm) entry.lookup_norm = lookupNorm;
    const parsed = parseLookup(entry.lookup_raw, { performers: entry.performers });
    if (parsed.valid) {
      entry.lookup = {
        family: parsed.family,
        family_label: parsed.familyLabel,
        instrument: parsed.instrument,
        cutter: parsed.cutter,
        medium: parsed.medium,
        medium_label: parsed.mediumLabel,
        year: parsed.year,
        season: parsed.season,
      };
    }
    return entry;
  }

  function normalizeLoadedModel(loaded) {
    if (loaded && Array.isArray(loaded.entries)) {
      loaded.entries = loaded.entries.map(normalizeLoadedEntry);
    }
    return loaded;
  }

  const CATALOG_HEADING_CLASSES = new Set([
    'dx-catalog-index-title',
    'dx-catalog-index-hero-title',
    'dx-catalog-index-spotlight-title',
    'dx-catalog-index-browse-title',
    'dx-catalog-index-season-performer',
    'dx-catalog-index-group-title',
    'dx-catalog-index-row-title',
  ]);

  function markCatalogHeading(element) {
    if (!(element instanceof HTMLElement)) return element;
    if (Array.from(element.classList).some((className) => CATALOG_HEADING_CLASSES.has(className))) {
      element.setAttribute('data-dx-heading-randomize', 'true');
    }
    return element;
  }

  function create(tag, className, textValue = null) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (textValue !== null) element.textContent = textValue;
    return markCatalogHeading(element);
  }

  function decorateCatalogHeadings(root) {
    if (!(root instanceof Element)) return;
    const headingFx = window.__dxHeadingFx;
    if (headingFx && typeof headingFx.decorateHeadings === 'function') {
      headingFx.decorateHeadings(root);
    }
  }

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function activateNewsletter() {
    if (newsletterActivated) return false;
    newsletterActivated = true;
    return true;
  }

  function mountCatalogNewsletter(target) {
    mountMarketingNewsletter(target, {
      source: 'catalog-index-page',
      formClassName: 'dx-catalog-index-newsletter-form',
      inputClassName: 'dx-catalog-index-newsletter-input',
      submitClassName: 'dx-button-element dx-button-size--sm dx-button-element--secondary dx-catalog-index-newsletter-submit',
      feedbackClassName: 'dx-catalog-index-newsletter-feedback',
      submitLabel: 'Subscribe',
      submitBusyLabel: 'Submitting...',
    });
  }

  function bindNewsletterScrollThreshold() {
    if (newsletterScrollListenerBound) return;
    newsletterScrollListenerBound = true;
    const onScroll = () => {
      if (newsletterActivated) {
        window.removeEventListener('scroll', onScroll);
        return;
      }
      const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      const ratio = Math.max(0, Math.min(1, window.scrollY / maxScroll));
      if (ratio < 0.32) return;
      if (activateNewsletter()) {
        render();
      }
      window.removeEventListener('scroll', onScroll);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.setTimeout(onScroll, 100);
  }

  function ensureFavoritesUiStyles() {
    if (document.getElementById(FAVORITES_UI_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = FAVORITES_UI_STYLE_ID;
    style.textContent = `
      .dx-fav-sr {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important;
        border: 0 !important;
      }

      .dx-catalog-index-row-favorite.dx-fav-heart-btn {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.4rem;
        min-width: 2.4rem;
        height: 2.4rem;
        padding: 0;
        border-radius: 999px;
        overflow: visible;
        line-height: 1;
      }

      .dx-fav-heart-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.4rem;
        height: 1.4rem;
        pointer-events: none;
        transition: transform 200ms cubic-bezier(0.22, 0.8, 0.24, 1);
      }

      .dx-catalog-index-row:hover .dx-fav-heart-icon {
        transform: scale(1.14);
      }

      .dx-fav-heart-btn:hover .dx-fav-heart-icon {
        transform: scale(1.28);
      }

      .dx-fav-heart-svg {
        width: 1.4rem;
        height: 1.4rem;
        stroke: currentColor;
      }

      .dx-fav-heart-svg path {
        fill: transparent;
        transition: fill 180ms ease, stroke 180ms ease;
      }

      .dx-fav-heart-btn {
        color: rgba(37, 41, 52, 0.88);
      }

      .dx-fav-heart-btn.is-auth-required {
        color: rgba(37, 41, 52, 0.6);
      }

      .dx-fav-heart-btn.is-active {
        color: #e0245e;
      }

      .dx-fav-heart-btn.is-active .dx-fav-heart-svg path {
        fill: currentColor;
      }

      .dx-fav-heart-btn[data-dx-fav-animating='1'] .dx-fav-heart-icon {
        animation: dx-fav-heart-pop 460ms cubic-bezier(.17,.89,.31,1.35);
      }

      .dx-fav-heart-btn[data-dx-fav-animating='1']::before,
      .dx-fav-heart-btn[data-dx-fav-animating='1']::after {
        content: "";
        position: absolute;
        left: 50%;
        top: 50%;
        pointer-events: none;
      }

      .dx-fav-heart-btn[data-dx-fav-animating='1']::before {
        width: 0.46rem;
        height: 0.46rem;
        border-radius: 999px;
        border: 2px solid rgba(224, 36, 94, 0.45);
        transform: translate(-50%, -50%);
        animation: dx-fav-heart-ring 520ms ease-out;
      }

      .dx-fav-heart-btn[data-dx-fav-animating='1']::after {
        width: 0.16rem;
        height: 0.16rem;
        border-radius: 999px;
        background: rgba(224, 36, 94, 0.9);
        transform: translate(-50%, -50%);
        box-shadow:
          0 -1rem 0 rgba(224, 36, 94, 0.86),
          0.94rem -0.32rem 0 rgba(255, 120, 154, 0.88),
          0.86rem 0.56rem 0 rgba(255, 58, 111, 0.82),
          -0.86rem 0.56rem 0 rgba(255, 89, 129, 0.78),
          -0.94rem -0.32rem 0 rgba(255, 133, 164, 0.84);
        animation: dx-fav-heart-spark 560ms ease-out;
      }

      @keyframes dx-fav-heart-pop {
        0% { transform: scale(0.62); }
        50% { transform: scale(1.22); }
        100% { transform: scale(1); }
      }

      @keyframes dx-fav-heart-ring {
        0% { opacity: 0.78; transform: translate(-50%, -50%) scale(0.2); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(2.2); }
      }

      @keyframes dx-fav-heart-spark {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.2); }
        24% { opacity: 1; }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(1.34); }
      }

      #${FAVORITES_TOAST_ROOT_ID} {
        position: fixed;
        left: 50%;
        bottom: max(18px, env(safe-area-inset-bottom, 0px) + 10px);
        transform: translateX(-50%);
        z-index: 2147482400;
        pointer-events: none;
      }

      #${FAVORITES_TOAST_ID} {
        border: 1px solid rgba(255, 255, 255, 0.42);
        border-radius: 999px;
        background: linear-gradient(128deg, rgba(23, 28, 40, 0.9), rgba(38, 20, 40, 0.88));
        color: #fff2f7;
        font-family: var(--font-mono, "Courier Prime", monospace);
        font-size: 12px;
        letter-spacing: 0.02em;
        line-height: 1;
        padding: 0.62rem 0.96rem;
        box-shadow: 0 12px 30px rgba(14, 16, 24, 0.34);
        backdrop-filter: blur(16px) saturate(150%);
        -webkit-backdrop-filter: blur(16px) saturate(150%);
        opacity: 0;
        transform: translateY(6px) scale(0.97);
        transition: opacity 170ms ease, transform 170ms ease;
      }

      #${FAVORITES_TOAST_ID}.is-visible {
        opacity: 1;
        transform: translateY(0) scale(1);
      }

      @media (prefers-reduced-motion: reduce) {
        .dx-fav-heart-btn[data-dx-fav-animating='1'] .dx-fav-heart-icon,
        .dx-fav-heart-btn[data-dx-fav-animating='1']::before,
        .dx-fav-heart-btn[data-dx-fav-animating='1']::after {
          animation: none !important;
        }
        #${FAVORITES_TOAST_ID} {
          transition: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function showFavoritesToast(message = 'Added to favorites!') {
    ensureFavoritesUiStyles();
    let root = document.getElementById(FAVORITES_TOAST_ROOT_ID);
    if (!root) {
      root = document.createElement('div');
      root.id = FAVORITES_TOAST_ROOT_ID;
      root.setAttribute('aria-live', 'polite');
      root.setAttribute('aria-atomic', 'true');
      document.body.appendChild(root);
    }

    let toast = document.getElementById(FAVORITES_TOAST_ID);
    if (!toast) {
      toast = document.createElement('div');
      toast.id = FAVORITES_TOAST_ID;
      root.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.remove('is-visible');
    void toast.offsetWidth;
    toast.classList.add('is-visible');

    if (favoritesToastTimer) {
      window.clearTimeout(favoritesToastTimer);
      favoritesToastTimer = 0;
    }
    favoritesToastTimer = window.setTimeout(() => {
      toast.classList.remove('is-visible');
      favoritesToastTimer = 0;
    }, 1800);
  }

  function animateFavoriteAdded(button) {
    if (!(button instanceof HTMLElement)) return;
    if (prefersReducedMotion()) return;
    button.setAttribute('data-dx-fav-animating', '1');
    window.setTimeout(() => {
      if (button.getAttribute('data-dx-fav-animating') === '1') {
        button.removeAttribute('data-dx-fav-animating');
      }
    }, 620);
  }

  function ensureFavoriteButtonContent(button) {
    if (!(button instanceof HTMLElement)) return;
    if (button.dataset.dxFavUiReady === '1') return;
    button.dataset.dxFavUiReady = '1';
    button.classList.add('dx-fav-heart-btn');
    button.innerHTML = `
      <span class="dx-fav-heart-icon">${HEART_SVG}</span>
      <span class="dx-fav-sr"></span>
    `;
  }

  function canonicalMode(value) {
    return MODE_VALUES.includes(value) ? value : DEFAULT_STATE.mode;
  }

  function canonicalSort(value) {
    return SORT_VALUES.includes(value) ? value : DEFAULT_STATE.sort;
  }

  function readUrlState() {
    const params = new URLSearchParams(window.location.search);
    return {
      mode: canonicalMode(params.get('mode') || DEFAULT_STATE.mode),
      season: params.get('season') || DEFAULT_STATE.season,
      instrument: params.get('instrument') || DEFAULT_STATE.instrument,
      q: params.get('q') || DEFAULT_STATE.q,
      sort: canonicalSort(params.get('sort') || DEFAULT_STATE.sort),
    };
  }

  function writeUrlState() {
    const url = new URL(window.location.href);
    const params = url.searchParams;

    const setOrDelete = (key, value, fallback) => {
      if (!value || value === fallback) params.delete(key);
      else params.set(key, value);
    };

    setOrDelete('mode', state.mode, DEFAULT_STATE.mode);
    setOrDelete('season', state.season, DEFAULT_STATE.season);
    setOrDelete('instrument', state.instrument, DEFAULT_STATE.instrument);
    setOrDelete('q', state.q, DEFAULT_STATE.q);
    setOrDelete('sort', state.sort, DEFAULT_STATE.sort);

    const nextUrl = `${url.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.history.replaceState({}, document.title, nextUrl);
  }

  function openCta(href, label, variant = 'secondary') {
    const link = create('a', `dx-button-element dx-button-size--sm dx-button-element--${variant}`);
    link.href = href || '#';
    link.textContent = label;
    return link;
  }

  function createEntryOpenArrowCta(href) {
    const link = create('a', 'dx-button-element dx-button-size--sm dx-button-element--secondary dx-catalog-index-row-open');
    link.href = href || '#';
    link.setAttribute('aria-label', 'Open entry');
    link.setAttribute('title', 'Open entry');
    link.innerHTML = OPEN_ENTRY_ARROW_SVG;
    return link;
  }

  function getAuthApi() {
    return window.DEX_AUTH || window.dexAuth || null;
  }

  function hasAuthIdentityHint() {
    const directSub = text(window.auth0Sub).trim();
    if (directSub) return true;
    const authUser = window.AUTH0_USER && typeof window.AUTH0_USER === 'object'
      ? window.AUTH0_USER
      : null;
    const userSub = text(authUser?.sub || authUser?.user_id).trim();
    return Boolean(userSub);
  }

  function withTimeout(promise, timeoutMs, fallbackValue = null) {
    const waitMs = Math.max(120, Number(timeoutMs) || 1200);
    return new Promise((resolve) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve(fallbackValue);
      }, waitMs);
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
          resolve(fallbackValue);
        });
    });
  }

  async function resolveFavoritesAuthState(timeoutMs = 1500) {
    const auth = getAuthApi();
    let authenticated = hasAuthIdentityHint();
    if (!auth) {
      return { auth: null, authenticated };
    }

    try {
      if (typeof auth.resolve === 'function') {
        await withTimeout(auth.resolve(timeoutMs), timeoutMs, null);
      } else if (auth.ready && typeof auth.ready.then === 'function') {
        await withTimeout(auth.ready, timeoutMs, null);
      }
    } catch {}

    try {
      if (typeof auth.isAuthenticated === 'function') {
        authenticated = Boolean(await withTimeout(auth.isAuthenticated(), timeoutMs, authenticated));
      }
    } catch {}

    return { auth, authenticated };
  }

  async function promptFavoritesSignIn(auth) {
    if (!auth || typeof auth.signIn !== 'function') return false;
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    try {
      await auth.signIn({ returnTo });
      return true;
    } catch {}
    try {
      await auth.signIn(returnTo);
      return true;
    } catch {}
    try {
      await auth.signIn();
      return true;
    } catch {}
    return false;
  }

  function getFavoritesApi() {
    const api = window.__dxFavorites;
    if (!api || typeof api.list !== 'function' || typeof api.toggle !== 'function' || typeof api.isFavorite !== 'function') {
      return null;
    }
    return api;
  }

  function favoriteEntryRecord(entry) {
    const entryHref = canonicalEntryHref(entry?.entry_href) || normalizePath(entry?.entry_href || '');
    const lookup = text(entry?.lookup_raw || entry?.title_raw || entry?.performer_raw || 'Unknown entry');
    return {
      kind: 'entry',
      lookupNumber: lookup,
      entryLookupNumber: lookup,
      entryHref,
      title: text(entry?.title_raw || ''),
      performer: text(entry?.kind === 'uav' ? entry?.uav?.site?.name : entry?.performer_raw || ''),
      source: 'catalog',
    };
  }

  function setFavoriteButtonState(button, active, canToggle = true) {
    ensureFavoritesUiStyles();
    ensureFavoriteButtonContent(button);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    button.classList.toggle('is-active', active);
    button.classList.toggle('is-auth-required', !canToggle);
    const sr = button.querySelector('.dx-fav-sr');
    const nextLabel = !canToggle
      ? 'Sign in to save favorites'
      : (active ? 'Favorited' : 'Add to favorites');
    button.setAttribute('aria-label', nextLabel);
    button.setAttribute('title', nextLabel);
    if (sr) sr.textContent = nextLabel;
  }

  function syncFavoriteButtons(root = document) {
    const api = getFavoritesApi();
    const canToggle = hasAuthIdentityHint();
    const buttons = Array.from(root.querySelectorAll('[data-dx-fav-kind="entry"][data-dx-fav-key]'));
    buttons.forEach((button) => {
      const key = text(button.getAttribute('data-dx-fav-key')).trim();
      const active = canToggle && api ? api.isFavorite(key) : false;
      setFavoriteButtonState(button, active, canToggle);
    });
  }

  function bindFavoritesSignals() {
    if (favoritesSignalsBound) return;
    favoritesSignalsBound = true;
    window.addEventListener('dx:favorites:changed', () => {
      syncFavoriteButtons(document);
    });
    window.addEventListener('storage', (event) => {
      const key = text(event?.key).trim();
      if (!key || !key.startsWith(FAVORITES_STORAGE_PREFIX)) return;
      syncFavoriteButtons(document);
    });
  }

  function createEntryFavoriteButton(entry) {
    const button = create('button', 'dx-button-element dx-button-size--sm dx-button-element--secondary dx-catalog-index-row-favorite');
    button.type = 'button';
    ensureFavoriteButtonContent(button);
    const record = favoriteEntryRecord(entry);
    const api = getFavoritesApi();
    const key = api && typeof api.keyFor === 'function'
      ? api.keyFor(record)
      : '';
    if (key) button.setAttribute('data-dx-fav-key', key);
    button.setAttribute('data-dx-fav-kind', 'entry');
    button.setAttribute('data-dx-fav-lookup', record.lookupNumber);
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.getAttribute('data-dx-fav-busy') === '1') return;
      button.setAttribute('data-dx-fav-busy', '1');
      try {
        const authState = await resolveFavoritesAuthState();
        if (!authState.authenticated) {
          setFavoriteButtonState(button, false, false);
          showFavoritesToast('Sign in to save favorites.');
          await promptFavoritesSignIn(authState.auth);
          return;
        }
        const runtime = getFavoritesApi();
        if (!runtime) return;
        const result = runtime.toggle(record);
        if (result && result.action === 'added') {
          animateFavoriteAdded(button);
          showFavoritesToast('Added to favorites!');
        }
        syncFavoriteButtons(document);
      } finally {
        button.removeAttribute('data-dx-fav-busy');
      }
    });
    const canToggle = hasAuthIdentityHint();
    setFavoriteButtonState(button, canToggle && api ? api.isFavorite(record) : false, canToggle);
    return button;
  }

  function normalizePath(pathname) {
    const raw = text(pathname).trim();
    if (!raw) return '';
    const clean = raw.startsWith('/') ? raw.replace(/\/+/g, '/') : `/${raw.replace(/\/+/g, '/')}`;
    if (clean === '/') return '/';
    return clean.endsWith('/') ? clean : `${clean}/`;
  }

  function allEntries() {
    return Array.isArray(model?.entries) ? model.entries : [];
  }

  function canonicalEntryHref(hrefValue) {
    const href = text(hrefValue).trim();
    if (!/^\/(?:entry|uav)\/[^?#]+\/?$/i.test(href)) return '';
    return href.endsWith('/') ? href : `${href}/`;
  }

  function normalizeImageSrc(rawValue) {
    const raw = text(rawValue).trim();
    if (!raw || raw.startsWith('data:')) return '';
    const stripQueryHash = (value) => value.split('#')[0].split('?')[0];

    if (/^https?:\/\//i.test(raw)) {
      try {
        const parsed = new URL(raw);
        const pathname = stripQueryHash(parsed.pathname);
        const file = pathname.split('/').filter(Boolean).pop() || '';
        if (/\.(?:jpe?g|png|webp|gif|avif)$/i.test(file)) {
          return `${parsed.origin}${pathname}`;
        }
        if (parsed.hostname.endsWith('dexdsl.com') || parsed.hostname.endsWith('dexdsl.org')) {
          return pathname || raw;
        }
        return `${parsed.origin}${pathname}`;
      } catch {
        return stripQueryHash(raw);
      }
    }

    return stripQueryHash(raw);
  }

  function imageCandidateForEntry(entry) {
    return normalizeImageSrc(entry?.image_src);
  }

  function positiveModulo(value, length) {
    const size = Number(length) || 0;
    if (size <= 0) return 0;
    return ((Number(value) % size) + size) % size;
  }

  function centeredCarouselIndex(slideCount) {
    const count = Math.max(1, Number(slideCount) || 1);
    return count * 80;
  }

  function randomEntryHref() {
    const pool = allEntries()
      .map((entry) => canonicalEntryHref(entry.entry_href))
      .filter(Boolean);
    if (!pool.length) return '/catalog/';
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function campaignIdForEntry(entry) {
    if (entry?.kind === 'uav') {
      const tour = text(entry?.uav?.tour).trim().toUpperCase();
      return tour ? `UAV ${tour}` : 'UAV';
    }
    return text(entry?.season).trim().toUpperCase();
  }

  function carouselGroupForEntry(entry) {
    const campaignId = campaignIdForEntry(entry);
    return CAROUSEL_GROUPS.find((group) => group.campaigns.includes(campaignId))?.id || '';
  }

  function carouselGroupConfig(groupId) {
    return CAROUSEL_GROUPS.find((group) => group.id === groupId) || CAROUSEL_GROUPS[0];
  }

  function interleaveCampaignEntries(groupId, entries) {
    const group = carouselGroupConfig(groupId);
    const buckets = group.campaigns.map((campaignId) =>
      entries.filter((entry) => campaignIdForEntry(entry) === campaignId));
    const maxBucketSize = Math.max(0, ...buckets.map((bucket) => bucket.length));
    const interleaved = [];
    for (let index = 0; index < maxBucketSize; index += 1) {
      buckets.forEach((bucket) => {
        if (bucket[index]) interleaved.push(bucket[index]);
      });
    }
    return interleaved;
  }

  function clampNumber(value, min, max, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, Math.round(numeric)));
  }

  function dedupeTokens(values) {
    const out = [];
    const seen = new Set();
    (Array.isArray(values) ? values : []).forEach((value) => {
      const token = text(value).trim();
      if (!token) return;
      const key = token.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(token);
    });
    return out;
  }

  function seasonOrderFromId(idValue) {
    const match = text(idValue).toUpperCase().match(/^S(\d+)$/);
    if (!match) return 0;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function normalizeSeasonConfig(rawValue) {
    const rawSeasons = Array.isArray(rawValue?.seasons) ? rawValue.seasons : [];
    const normalized = [];
    const seen = new Set();
    rawSeasons.forEach((season) => {
      const id = text(season?.id).toUpperCase();
      if (!id) return;
      const key = id.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      const unannouncedRaw = season?.unannounced || {};
      const tokenPool = dedupeTokens(unannouncedRaw.tokenPool);
      normalized.push({
        id,
        label: text(season?.label) || '',
        order: Number.isFinite(Number(season?.order)) ? Number(season.order) : seasonOrderFromId(id),
        unannounced: {
          enabled: Boolean(unannouncedRaw.enabled),
          count: clampNumber(unannouncedRaw.count, 0, 3, 1),
          message: text(unannouncedRaw.message) || DEFAULT_UNANNOUNCED_MESSAGE,
          tokenPool: tokenPool.length ? tokenPool : [...DEFAULT_UNANNOUNCED_TOKEN_POOL],
          style: text(unannouncedRaw.style) === 'redacted' ? 'redacted' : 'redacted',
        },
      });
    });
    normalized.sort((a, b) => {
      const orderDiff = Number(b.order || 0) - Number(a.order || 0);
      if (orderDiff !== 0) return orderDiff;
      return text(a.id).localeCompare(text(b.id));
    });
    return {
      version: text(rawValue?.version || ''),
      seasons: normalized,
    };
  }

  function seasonConfigById() {
    const map = new Map();
    const seasons = Array.isArray(seasonsModel?.seasons) ? seasonsModel.seasons : [];
    seasons.forEach((season) => {
      const id = text(season?.id).toUpperCase();
      if (!id) return;
      map.set(id, season);
    });
    return map;
  }

  function seasonConfigFor(seasonRaw) {
    const season = text(seasonRaw).toUpperCase();
    if (!season) return null;
    return seasonConfigById().get(season) || null;
  }

  function resolveSeasonTeaserSeed() {
    if (seasonTeaserSeed) return seasonTeaserSeed;
    if (window.__DX_SEASON_TEASER_SEED != null) {
      seasonTeaserSeed = text(window.__DX_SEASON_TEASER_SEED) || String(window.__DX_SEASON_TEASER_SEED);
      return seasonTeaserSeed;
    }
    const randomPart = Math.floor(Math.random() * 1e9);
    seasonTeaserSeed = `${Date.now()}-${randomPart}`;
    return seasonTeaserSeed;
  }

  function hashString32(value) {
    const source = String(value || '');
    let hash = 2166136261;
    for (let i = 0; i < source.length; i += 1) {
      hash ^= source.charCodeAt(i);
      hash = (hash * 16777619) >>> 0;
    }
    return hash >>> 0;
  }

  function teaserTokenForSeason(season, index, tokenPool) {
    const pool = Array.isArray(tokenPool) && tokenPool.length ? tokenPool : DEFAULT_UNANNOUNCED_TOKEN_POOL;
    if (!pool.length) return '???';
    const seed = resolveSeasonTeaserSeed();
    const hash = hashString32(`${seed}:${text(season).toUpperCase()}:${index}`);
    return pool[hash % pool.length];
  }

  function interleaveSeasonTeasers(season, entries, teasers) {
    const mixed = Array.isArray(entries) ? entries.map((entry) => ({ kind: 'entry', entry })) : [];
    if (!Array.isArray(teasers) || !teasers.length) return mixed;
    const seed = resolveSeasonTeaserSeed();
    teasers.forEach((card, teaserIndex) => {
      const currentLength = mixed.length;
      const hash = hashString32(`${seed}:${text(season).toUpperCase()}:insert:${teaserIndex}:${currentLength}`);
      const insertAt = currentLength <= 0 ? 0 : (hash % (currentLength + 1));
      mixed.splice(insertAt, 0, { kind: 'teaser', card });
    });
    return mixed;
  }

  function buildUnannouncedCardsForSeason(seasonRaw) {
    const season = text(seasonRaw).toUpperCase();
    const configured = seasonConfigFor(season);
    if (!configured || !configured.unannounced?.enabled) return [];
    const count = clampNumber(configured.unannounced.count, 0, 3, 1);
    const cards = [];
    for (let index = 0; index < count; index += 1) {
      cards.push({
        season,
        index,
        message: text(configured.unannounced.message) || DEFAULT_UNANNOUNCED_MESSAGE,
        style: text(configured.unannounced.style) || 'redacted',
        token: teaserTokenForSeason(season, index, configured.unannounced.tokenPool),
      });
    }
    return cards;
  }

  function protectedAllCaps(value) {
    // Prevent ligature-like collapsing in double letters while preserving existing protection semantics.
    const normalized = text(value).replace(/\u200C/g, '').toUpperCase();
    return normalized.replace(/([A-Z])\1/g, `$1${ZWNJ}$1`);
  }

  function buildFuse() {
    if (!Array.isArray(searchModel?.entries)) return null;
    return new Fuse(searchModel.entries, {
      keys: [
        { name: 'title_norm', weight: 0.4 },
        { name: 'performer_norm', weight: 0.3 },
        { name: 'lookup_norm', weight: 0.2 },
        { name: 'instrument_norm', weight: 0.1 },
        { name: 'search_blob', weight: 0.45 },
      ],
      includeScore: true,
      threshold: 0.34,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
  }

  function entriesById() {
    const map = new Map();
    for (const entry of allEntries()) {
      map.set(entry.id, entry);
    }
    return map;
  }

  function sortEntries(entries) {
    const sorter = {
      alpha: (a, b) => {
        const performerCmp = performerSortKey(a).localeCompare(performerSortKey(b));
        if (performerCmp !== 0) return performerCmp;
        return text(a.title_raw).localeCompare(text(b.title_raw));
      },
      recent: (a, b) => {
        if (a.kind === 'uav' || b.kind === 'uav') {
          const yearCmp = Number(b.uav?.year || 0) - Number(a.uav?.year || 0);
          if (yearCmp !== 0) return yearCmp;
        }
        const seasonCmp = text(b.season).localeCompare(text(a.season));
        if (seasonCmp !== 0) return seasonCmp;
        return performerSortKey(a).localeCompare(performerSortKey(b));
      },
      lookup: (a, b) => text(a.lookup_raw).localeCompare(text(b.lookup_raw)),
    };

    entries.sort(sorter[state.sort] || sorter.alpha);
  }

  function activeEntries() {
    let filtered = [...allEntries()];

    if (state.season !== 'all') {
      filtered = filtered.filter((entry) =>
        text(entry.kind === 'uav' ? entry.uav?.tour : entry.season) === state.season);
    }

    if (state.instrument !== 'all') {
      filtered = filtered.filter((entry) => {
        const values = entry.kind === 'uav'
          ? (entry.uav?.subjects || []).map((row) => row.label)
          : (entry.instrument_family || []);
        return values.some((family) => normalize(family) === normalize(state.instrument));
      });
    }

    const query = text(state.q).trim();
    if (query) {
      if (fuse) {
        const resultIds = new Set(fuse.search(query).map((result) => result.item.id));
        filtered = filtered.filter((entry) => resultIds.has(entry.id));
      } else {
        const q = normalize(query);
        filtered = filtered.filter((entry) => {
          const haystack = [entry.title_norm, entry.performer_norm, entry.lookup_norm, entry.instrument_norm, entry.site_norm, entry.subject_norm].join(' ');
          return haystack.includes(q);
        });
      }
    }

    sortEntries(filtered);

    if (query && fuse) {
      const ordered = [];
      const seen = new Set();
      const idMap = entriesById();

      for (const result of fuse.search(query)) {
        const entry = idMap.get(result.item.id);
        if (!entry) continue;
        if (!filtered.includes(entry)) continue;
        if (seen.has(entry.id)) continue;
        ordered.push(entry);
        seen.add(entry.id);
      }

      for (const entry of filtered) {
        if (!seen.has(entry.id)) ordered.push(entry);
      }

      return ordered;
    }

    return filtered;
  }

  function groupEntries(entries) {
    if (state.mode === 'performer') {
      // Group by the authority sort key so name variants collocate; label the
      // group with the standardized "Surname, Forename" heading.
      const groups = new Map();
      for (const entry of entries) {
        const key = performerSortKey(entry) || 'zzzz';
        if (!groups.has(key)) groups.set(key, { label: performerHeading(entry) || 'Unknown performer', items: [] });
        groups.get(key).items.push(entry);
      }
      return Array.from(groups.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, group]) => [group.label, group.items]);
    }

    if (state.mode === 'instrument') {
      const groups = new Map();
      for (const entry of entries) {
        const uavSubjects = (entry.uav?.subjects || []).map((row) => row.label);
        const families = entry.kind === 'uav'
          ? (uavSubjects.length ? uavSubjects : ['Other'])
          : ((entry.instrument_family || []).length ? entry.instrument_family : ['Other']);
        for (const family of families) {
          if (!groups.has(family)) groups.set(family, []);
          groups.get(family).push(entry);
        }
      }
      return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }

    const groups = new Map();
    for (const entry of entries) {
      const lookupRaw = text(entry.lookup_raw);
      const prefix = lookupRaw.split(' ').filter(Boolean)[0] || 'Uncoded';
      const season = entry.kind === 'uav' ? text(entry.uav?.tour || 'T?') : text(entry.season || 'S?');
      const key = `${season} · ${prefix}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }

  function renderControls(target) {
    const controls = create('section', 'dx-catalog-index-controls dx-catalog-index-surface');

    const heading = create('div', 'dx-catalog-index-heading');
    heading.appendChild(create('p', 'dx-catalog-index-kicker', 'Catalog Index'));
    heading.appendChild(create('h1', 'dx-catalog-index-title', 'Browse by performer or site, instrument or subject, or lookup code.'));
    const delta = create('p', 'dx-catalog-index-whats-new', 'Lookup guide and symbol key now live on separate pages.');
    heading.appendChild(delta);
    controls.appendChild(heading);

    const row = create('div', 'dx-catalog-index-toolbar');
    const mode = create('p', 'dx-catalog-index-mode-label', `Mode: ${state.mode}`);
    row.appendChild(mode);

    const searchWrap = create('label', 'dx-catalog-index-search-wrap');
    const search = create('input', 'dx-catalog-index-search');
    search.type = 'search';
    search.autocomplete = 'off';
    search.spellcheck = false;
    search.placeholder = 'Search performer, site, title, lookup, instrument, subject';
    search.value = state.q;
    search.addEventListener('input', (event) => {
      activateNewsletter();
      state.q = event.currentTarget.value || '';
      writeUrlState();
      renderBrowse();
    });
    searchWrap.appendChild(search);
    row.appendChild(searchWrap);

    const filters = create('button', 'dx-button-element dx-button-size--sm dx-button-element--secondary dx-catalog-index-filters-toggle', 'Filters');
    filters.type = 'button';
    filters.setAttribute('aria-expanded', drawerOpen ? 'true' : 'false');
    filters.setAttribute('aria-controls', 'dx-catalog-index-drawer');
    filters.addEventListener('click', () => {
      activateNewsletter();
      drawerOpen = !drawerOpen;
      render();
    });
    row.appendChild(filters);

    controls.appendChild(row);

    if (drawerOpen) {
      const drawer = create('section', 'dx-catalog-index-drawer');
      drawer.id = 'dx-catalog-index-drawer';

      const drawerGrid = create('div', 'dx-catalog-index-drawer-grid');

      const modeWrap = create('label', 'dx-catalog-index-field');
      modeWrap.appendChild(create('span', 'dx-catalog-index-field-label', 'Browse mode'));
      const modeSelect = create('select', 'dx-catalog-index-select');
      MODE_VALUES.forEach((value) => {
        const option = create('option', '', value[0].toUpperCase() + value.slice(1));
        option.value = value;
        if (state.mode === value) option.selected = true;
        modeSelect.appendChild(option);
      });
      modeSelect.addEventListener('change', (event) => {
        activateNewsletter();
        state.mode = canonicalMode(event.currentTarget.value);
        if (state.mode !== 'instrument') state.instrument = 'all';
        writeUrlState();
        render();
      });
      modeWrap.appendChild(modeSelect);
      drawerGrid.appendChild(modeWrap);

      const seasonWrap = create('label', 'dx-catalog-index-field');
      seasonWrap.appendChild(create('span', 'dx-catalog-index-field-label', 'Season / UAV tour'));
      const seasonSelect = create('select', 'dx-catalog-index-select');
      ['all', ...new Set(allEntries()
        .map((entry) => entry.kind === 'uav' ? entry.uav?.tour : entry.season)
        .filter(Boolean))].forEach((season) => {
        const option = create('option', '', season === 'all' ? 'All' : season);
        option.value = season;
        if (state.season === season) option.selected = true;
        seasonSelect.appendChild(option);
      });
      seasonSelect.addEventListener('change', (event) => {
        activateNewsletter();
        state.season = event.currentTarget.value || 'all';
        writeUrlState();
        renderBrowse();
      });
      seasonWrap.appendChild(seasonSelect);
      drawerGrid.appendChild(seasonWrap);

      const instrumentWrap = create('label', 'dx-catalog-index-field');
      instrumentWrap.appendChild(create('span', 'dx-catalog-index-field-label', 'Instrument family / UAV subject'));
      const instrumentSelect = create('select', 'dx-catalog-index-select');
      ['all', ...new Set(allEntries().flatMap((entry) => entry.kind === 'uav'
        ? (entry.uav?.subjects || []).map((row) => row.label)
        : (entry.instrument_family || [])).filter(Boolean))]
        .forEach((instrument) => {
          const option = create('option', '', instrument === 'all' ? 'All' : instrument);
          option.value = instrument;
          if (state.instrument === instrument) option.selected = true;
          instrumentSelect.appendChild(option);
        });
      instrumentSelect.disabled = state.mode !== 'instrument';
      instrumentSelect.addEventListener('change', (event) => {
        activateNewsletter();
        state.instrument = event.currentTarget.value || 'all';
        writeUrlState();
        renderBrowse();
      });
      instrumentWrap.appendChild(instrumentSelect);
      drawerGrid.appendChild(instrumentWrap);

      const sortWrap = create('label', 'dx-catalog-index-field');
      sortWrap.appendChild(create('span', 'dx-catalog-index-field-label', 'Sort'));
      const sortSelect = create('select', 'dx-catalog-index-select');
      [
        ['alpha', 'Alpha'],
        ['recent', 'Recent'],
        ['lookup', 'Lookup'],
      ].forEach(([value, label]) => {
        const option = create('option', '', label);
        option.value = value;
        if (state.sort === value) option.selected = true;
        sortSelect.appendChild(option);
      });
      sortSelect.addEventListener('change', (event) => {
        activateNewsletter();
        state.sort = canonicalSort(event.currentTarget.value);
        writeUrlState();
        renderBrowse();
      });
      sortWrap.appendChild(sortSelect);
      drawerGrid.appendChild(sortWrap);

      drawer.appendChild(drawerGrid);

      const actions = create('div', 'dx-catalog-index-drawer-actions');
      const clear = create('button', 'dx-button-element dx-button-size--sm dx-button-element--secondary', 'Clear filters');
      clear.type = 'button';
      // Keep current mode while resetting query/filter/sort to avoid disorienting mode jumps.
      clear.addEventListener('click', () => {
        activateNewsletter();
        state = { ...DEFAULT_STATE, mode: state.mode };
        writeUrlState();
        render();
      });
      actions.appendChild(clear);

      const guide = openCta('/catalog/guide/', 'Lookup guide', 'secondary');
      const symbols = openCta('/catalog/guide/#list-of-identifiers', 'List of symbols', 'secondary');
      actions.append(guide, symbols);
      drawer.appendChild(actions);

      controls.appendChild(drawer);
    }

    target.appendChild(controls);
  }

  function renderHero(target, existingSection = null) {
    const section = existingSection || create('section', 'dx-catalog-index-hero dx-catalog-index-surface');
    section.setAttribute('data-dx-catalog-static-hero', '');

    let random = section.querySelector('[data-dx-catalog-random-entry]');
    if (!random) {
      const title = create('h1', 'dx-catalog-index-hero-title', 'CATALOG');
      title.setAttribute('data-dx-heading-randomize', 'false');
      const subtitle = create('div', 'dx-catalog-index-hero-subtitle');

      const guide = openCta('/catalog/guide/', 'Lookup guide', 'secondary');
      random = create('button', 'dx-button-element dx-button-size--sm dx-button-element--secondary', 'Random entry');
      random.type = 'button';
      random.setAttribute('data-dx-catalog-random-entry', '');
      subtitle.append(guide, random);
      section.append(title, subtitle);
    }

    if (random.getAttribute('data-dx-random-entry-bound') !== 'true') {
      random.setAttribute('data-dx-random-entry-bound', 'true');
      random.addEventListener('click', () => {
        window.location.assign(randomEntryHref());
      });
    }
    target.appendChild(section);
  }

  function createSeasonCarouselArrow(direction) {
    const sideClass = direction === 'left' ? 'nav-left' : 'nav-right';
    const dir = direction === 'left' ? 'prev' : 'next';
    // Global dx-pagenav chevron button (styled by css/components/dx-controls.css).
    const button = create('button', `dx-catalog-index-season-arrow dx-pagenav-arrow dx-pagenav-arrow--${dir} nav ${sideClass}`);
    button.type = 'button';
    button.setAttribute('aria-label', direction === 'left' ? 'Previous' : 'Next');
    button.innerHTML = direction === 'left'
      ? '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M15.5 19 8.5 12l7-7" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M8.5 5l7 7-7 7" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    if (window.dxPageNav && typeof window.dxPageNav.enhanceArrow === 'function') {
      window.dxPageNav.enhanceArrow(button);
    }
    return button;
  }

  function renderSeasonSlide(entry) {
    const href = canonicalEntryHref(entry.entry_href) || '/catalog/';
    const imageSrc = imageCandidateForEntry(entry);
    const hasImage = Boolean(imageSrc);
    const slide = create('li', 'dx-catalog-index-season-slide');
    const season = text(entry.season).toUpperCase();
    const campaignId = campaignIdForEntry(entry);
    slide.setAttribute('data-dx-season-card-kind', 'entry');
    slide.setAttribute('data-dx-season-card-id', text(entry.id || ''));
    slide.setAttribute('data-dx-season-card-href', href);
    slide.setAttribute('data-dx-season-card-lookup', text(entry.lookup_raw || ''));
    slide.setAttribute('data-dx-campaign-id', campaignId);
    if (season) slide.setAttribute('data-dx-season-id', season);

    const media = create('a', 'dx-catalog-index-season-media');
    media.href = href;
    if (!hasImage) media.classList.add('dx-catalog-index-season-media--fallback');
    const image = create('img', 'dx-catalog-index-season-img');
    image.width = 800;
    image.height = 480;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.alt = text(entry.image_alt_raw || entry.title_raw || entry.performer_raw || 'Catalog entry');
    image.src = imageSrc || CATALOG_FALLBACK_IMAGE;
    media.appendChild(image);
    if (!hasImage) {
      media.appendChild(create('span', 'dx-catalog-index-season-fallback-code', text(entry.lookup_raw || 'DEX')));
    }
    const copy = create('div', 'dx-catalog-index-season-copy');
    copy.appendChild(create('h3', 'dx-catalog-index-season-performer', protectName(performerHeading(entry))));
    copy.appendChild(create('p', 'dx-catalog-index-season-title', text(entry.title_raw || 'Untitled')));

    // Badge + lookup live above the CTA now (out of the photo).
    const metaRow = create('div', 'dx-catalog-index-season-metarow');
    metaRow.appendChild(create('span', 'dx-catalog-index-season-tag', campaignId));
    const lookupText = text(entry.lookup_raw || '');
    if (lookupText) metaRow.appendChild(create('span', 'dx-catalog-index-season-lookup', lookupText));
    copy.appendChild(metaRow);

    const open = openCta(href, protectedAllCaps('View collection'), 'primary');
    open.classList.add('dx-catalog-index-season-open');
    copy.appendChild(open);

    slide.append(media, copy);
    return slide;
  }

  function renderUnannouncedSeasonSlide(card) {
    const season = text(card?.season).toUpperCase();
    const token = text(card?.token) || '???';
    const message = text(card?.message) || DEFAULT_UNANNOUNCED_MESSAGE;
    const index = clampNumber(card?.index, 0, 99, 0);

    const slide = create('li', 'dx-catalog-index-season-slide dx-catalog-index-season-slide--unannounced');
    slide.setAttribute('data-dx-season-card-kind', 'unannounced');
    slide.setAttribute('data-dx-season-id', season || '');
    slide.setAttribute('data-dx-campaign-id', season || 'S3');
    slide.setAttribute('data-dx-growlix-token', token);
    slide.setAttribute('data-dx-unannounced-index', String(index));
    slide.setAttribute('aria-label', 'Unannounced collection teaser');

    const media = create('div', 'dx-catalog-index-season-media dx-catalog-index-season-media--unannounced dx-catalog-index-season-media--campaign');
    media.setAttribute('aria-hidden', 'true');
    media.appendChild(create('span', 'dx-catalog-index-season-campaign-word', token));
    media.appendChild(create('span', 'dx-catalog-index-season-fallback-code', 'Open access · Season 3'));

    const copy = create('div', 'dx-catalog-index-season-copy');
    copy.appendChild(create('h3', 'dx-catalog-index-season-performer', token));
    copy.appendChild(create('p', 'dx-catalog-index-season-title', message));
    const metaRow = create('div', 'dx-catalog-index-season-metarow');
    metaRow.appendChild(create('span', 'dx-catalog-index-season-tag', season || 'S3'));
    copy.appendChild(metaRow);
    const locked = create('button', 'dx-button-element dx-button-size--sm dx-button-element--primary dx-catalog-index-season-open is-disabled', protectedAllCaps('View collection'));
    locked.type = 'button';
    locked.disabled = true;
    locked.setAttribute('aria-disabled', 'true');
    copy.appendChild(locked);

    slide.append(media, copy);
    return slide;
  }

  // The "open call" funnel that occupies the S3 slot while the Current lane is
  // thin. Styled like a collection slide but the CTA routes to sample submission.
  function renderSubmitSeasonSlide() {
    const href = SUBMIT_SAMPLES_HREF;
    const slide = create('li', 'dx-catalog-index-season-slide dx-catalog-index-season-slide--submit');
    slide.setAttribute('data-dx-season-card-kind', 'submit');
    slide.setAttribute('data-dx-season-id', 'S3');
    slide.setAttribute('data-dx-campaign-id', 'S3');

    const media = create('a', 'dx-catalog-index-season-media dx-catalog-index-season-media--submit dx-catalog-index-season-media--campaign');
    media.href = href;
    media.setAttribute('aria-label', 'Submit your work to Season 3');
    media.appendChild(create('span', 'dx-catalog-index-season-campaign-word', 'SEASON 3'));
    media.appendChild(create('span', 'dx-catalog-index-season-fallback-code', 'Open call · CC-BY'));

    const copy = create('div', 'dx-catalog-index-season-copy');
    copy.appendChild(create('h3', 'dx-catalog-index-season-performer', 'Season 3 is open'));
    copy.appendChild(create('p', 'dx-catalog-index-season-title', 'Add your recording to the open-access library — free & CC-BY.'));
    const metaRow = create('div', 'dx-catalog-index-season-metarow');
    metaRow.appendChild(create('span', 'dx-catalog-index-season-tag', 'S3'));
    metaRow.appendChild(create('span', 'dx-catalog-index-season-lookup', 'open call'));
    copy.appendChild(metaRow);
    const open = openCta(href, protectedAllCaps('Submit samples'), 'primary');
    open.classList.add('dx-catalog-index-season-open');
    copy.appendChild(open);

    slide.append(media, copy);
    return slide;
  }

  function renderSeasonCarousel(target) {
    const catalogEntries = allEntries().filter((entry) => {
      return !!canonicalEntryHref(entry.entry_href)
        && !!text(entry.lookup_raw).trim()
        && !!carouselGroupForEntry(entry);
    });

    const groupBuckets = new Map(CAROUSEL_GROUPS.map((group) => [group.id, []]));
    catalogEntries.forEach((entry) => {
      const groupId = carouselGroupForEntry(entry);
      if (!groupId || !groupBuckets.has(groupId)) return;
      groupBuckets.get(groupId).push(entry);
    });

    const currentTeasers = buildUnannouncedCardsForSeason('S3');
    const currentLaneThin = (groupBuckets.get('current') || []).length < CURRENT_LANE_THIN_MAX;
    const groups = CAROUSEL_GROUPS.filter((group) => {
      const entries = groupBuckets.get(group.id) || [];
      return entries.length > 0
        || (group.id === 'current' && (currentTeasers.length > 0 || currentLaneThin));
    });
    if (!groups.length) return;
    if (!groups.some((group) => group.id === seasonCarouselGroup)) {
      seasonCarouselGroup = groups[0].id;
    }

    const section = create('section', 'dx-catalog-index-season-carousel dx-catalog-index-surface');
    section.setAttribute('data-dx-motion', 'pagination');
    section.setAttribute('data-dx-carousel-group', seasonCarouselGroup);

    const tabs = create('div', 'dx-catalog-index-season-tabs');
    const seasonMeta = create('p', 'dx-catalog-index-season-meta', carouselGroupConfig(seasonCarouselGroup).meta);

    const gutter = create('div', 'dx-catalog-index-season-gutter');
    gutter.setAttribute('role', 'region');
    gutter.setAttribute('aria-label', 'Carousel');
    const revealer = create('div', 'dx-catalog-index-season-revealer');
    const track = create('ul', 'dx-catalog-index-season-track');
    track.setAttribute('aria-live', 'polite');
    revealer.appendChild(track);
    const pips = create('div', 'dx-catalog-index-season-pips');
    pips.setAttribute('aria-label', 'Carousel pages');
    gutter.append(revealer, pips);

    const desktopArrows = create('div', 'dx-catalog-index-season-desktop-arrows');
    const desktopLeftWrap = create('div', 'dx-catalog-index-season-arrow-wrap dx-catalog-index-season-arrow-wrap--left');
    const desktopRightWrap = create('div', 'dx-catalog-index-season-arrow-wrap dx-catalog-index-season-arrow-wrap--right');
    const desktopLeft = createSeasonCarouselArrow('left');
    const desktopRight = createSeasonCarouselArrow('right');
    desktopLeftWrap.appendChild(desktopLeft);
    desktopRightWrap.appendChild(desktopRight);
    desktopArrows.append(desktopLeftWrap, desktopRightWrap);

    const mobileArrows = create('div', 'dx-catalog-index-season-mobile-arrows');
    const mobileLeft = createSeasonCarouselArrow('left');
    const mobileRight = createSeasonCarouselArrow('right');
    mobileArrows.append(mobileLeft, mobileRight);

    let currentSlides = [];
    let pageNav = null;

    const carouselIndexForGroup = (slideCount) => {
      const count = Math.max(1, Number(slideCount) || 1);
      const key = text(seasonCarouselGroup).toLowerCase();
      const existing = seasonCarouselGroupIndexes.get(key);
      if (Number.isFinite(existing)) return existing;
      const initial = centeredCarouselIndex(count);
      seasonCarouselGroupIndexes.set(key, initial);
      return initial;
    };

    const setCarouselIndexForGroup = (index) => {
      seasonCarouselGroupIndexes.set(text(seasonCarouselGroup).toLowerCase(), Number(index) || 0);
    };

    const setCarouselSlot = (slot, slideCount) => {
      const count = Math.max(1, Number(slideCount) || 1);
      const current = carouselIndexForGroup(count);
      const currentSlot = positiveModulo(current, count);
      const targetSlot = positiveModulo(slot, count);
      const forward = positiveModulo(targetSlot - currentSlot, count);
      const backward = forward - count;
      const delta = Math.abs(backward) < Math.abs(forward) ? backward : forward;
      setCarouselIndexForGroup(current + delta);
      return delta;
    };

    // Pip strip via the global dx-pagenav primitive (iOS windowed dots + capsule).
    const renderPips = (slides, activeSlot) => {
      if (!slides.length) {
        if (pageNav) pageNav.setCount(0);
        return;
      }
      if (!pageNav && window.dxPageNav && typeof window.dxPageNav.create === 'function') {
        pageNav = window.dxPageNav.create({
          mount: pips,
          count: slides.length,
          ariaLabel: 'Carousel pages',
          onSelect: (index) => {
            const delta = setCarouselSlot(index, currentSlides.length || slides.length);
            renderTrack(delta === 0 ? 0 : (delta > 0 ? 1 : -1));
          },
        });
      }
      if (pageNav) {
        pageNav.setCount(slides.length);
        pageNav.setActive(activeSlot);
      }
    };

    const renderTabs = () => {
      clearNode(tabs);
      groups.forEach((group) => {
        const tab = create('button', 'dx-catalog-index-season-tab', group.label);
        tab.type = 'button';
        tab.setAttribute('data-dx-carousel-group', group.id);
        const active = group.id === seasonCarouselGroup;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-pressed', active ? 'true' : 'false');
        tab.addEventListener('click', () => {
          if (seasonCarouselGroup === group.id) return;
          const currentIndex = groups.findIndex((candidate) => candidate.id === seasonCarouselGroup);
          const nextIndex = groups.findIndex((candidate) => candidate.id === group.id);
          const direction = nextIndex === currentIndex ? 0 : (nextIndex > currentIndex ? 1 : -1);
          seasonCarouselGroup = group.id;
          section.setAttribute('data-dx-carousel-group', seasonCarouselGroup);
          renderTabs();
          renderTrack(direction);
        });
        tabs.appendChild(tab);
      });
    };

    const renderTrack = (direction = 0) => {
      clearNode(track);
      track.setAttribute('data-dx-motion', 'pagination');
      const group = carouselGroupConfig(seasonCarouselGroup);
      seasonMeta.textContent = group.meta;
      track.setAttribute('data-dx-carousel-group', group.id);
      const groupEntries = interleaveCampaignEntries(group.id, groupBuckets.get(group.id) || []);
      const currentLaneThin = (groupBuckets.get('current') || []).length < CURRENT_LANE_THIN_MAX;
      let slides;
      if (group.id === 'current' && currentLaneThin) {
        // Thin lane: lead with the submit funnel in place of the S3 teaser.
        slides = [{ kind: 'submit' }, ...interleaveSeasonTeasers(group.id, groupEntries, [])];
      } else {
        const unannouncedCards = group.id === 'current' ? currentTeasers : [];
        slides = interleaveSeasonTeasers(group.id, groupEntries, unannouncedCards);
      }
      currentSlides = slides;
      const activeIndex = carouselIndexForGroup(slides.length);
      const activeSlot = positiveModulo(activeIndex, slides.length);
      track.setAttribute('data-dx-carousel-active-index', String(activeIndex));
      track.setAttribute('data-dx-carousel-active-slot', String(activeSlot));
      track.setAttribute('data-dx-carousel-size', String(slides.length));
      const orderedSlides = slides.map((_, index) => slides[positiveModulo(activeSlot + index, slides.length)]);
      orderedSlides.forEach((slide, visibleIndex) => {
        const originalIndex = slides.indexOf(slide);
        if (slide.kind === 'entry') track.appendChild(renderSeasonSlide(slide.entry));
        else if (slide.kind === 'teaser') track.appendChild(renderUnannouncedSeasonSlide(slide.card));
        else if (slide.kind === 'submit') track.appendChild(renderSubmitSeasonSlide());
        const rendered = track.lastElementChild;
        if (rendered) {
          rendered.setAttribute('data-dx-carousel-slot', String(originalIndex));
          rendered.setAttribute('data-dx-carousel-visible-index', String(visibleIndex));
        }
      });
      renderPips(slides, activeSlot);
      decorateCatalogHeadings(track);

      if (prefersReducedMotion()) return;
      const offset = direction === 0 ? 0 : direction * 8;
      animate(
        track,
        {
          opacity: [0, 1],
          transform: [`translate3d(${offset}px, 0, 0)`, 'translate3d(0, 0, 0)'],
        },
        {
          duration: 0.24,
          ease: 'easeOut',
        },
      );
    };

    const pageCarousel = (direction) => {
      if (!currentSlides.length) return;
      const count = currentSlides.length;
      const current = carouselIndexForGroup(count);
      setCarouselIndexForGroup(current + direction);
      renderTrack(direction);
    };

    [desktopLeft, mobileLeft].forEach((button) => {
      button.setAttribute('data-dx-carousel-page-button', 'previous');
      button.addEventListener('click', () => pageCarousel(-1));
    });
    [desktopRight, mobileRight].forEach((button) => {
      button.setAttribute('data-dx-carousel-page-button', 'next');
      button.addEventListener('click', () => pageCarousel(1));
    });

    gutter.tabIndex = 0;
    gutter.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      pageCarousel(event.key === 'ArrowLeft' ? -1 : 1);
    });

    // Scroll/swipe paging. The carousel is an infinite, re-rendering pager (not a
    // native scroll container), so only strongly horizontal wheel frames are
    // intercepted. Intent is evaluated per event instead of locking an entire
    // gesture: a horizontal-leading trackpad frame can page the carousel, while
    // any later vertical movement immediately falls through to page scrolling.
    // CSS touch-action: pan-y on the gutter mirrors this for touch.
    const WHEEL_STEP = 40; // accumulated horizontal px before advancing a page
    const WHEEL_COOLDOWN_MS = 280;
    const WHEEL_IDLE_MS = 160;
    const WHEEL_HORIZONTAL_DOMINANCE = 1.75;
    let wheelAccum = 0;
    let wheelReadyAt = 0;
    let wheelIdleTimer = 0;
    gutter.addEventListener('wheel', (event) => {
      const horizontal = event.shiftKey ? event.deltaY : event.deltaX;
      const vertical = event.shiftKey ? 0 : event.deltaY;
      const absX = Math.abs(horizontal);
      const absY = Math.abs(vertical);

      if (wheelIdleTimer) clearTimeout(wheelIdleTimer);
      wheelIdleTimer = window.setTimeout(() => { wheelAccum = 0; }, WHEEL_IDLE_MS);

      const stronglyHorizontal = absX > 6 && absX > absY * WHEEL_HORIZONTAL_DOMINANCE;
      if (!stronglyHorizontal) {
        if (absY > 0) wheelAccum = 0;
        return;
      }

      event.preventDefault();
      const now = Date.now();
      if (now < wheelReadyAt) return;
      wheelAccum += horizontal;
      if (Math.abs(wheelAccum) < WHEEL_STEP) return;
      const direction = wheelAccum > 0 ? 1 : -1;
      wheelAccum = 0;
      wheelReadyAt = now + WHEEL_COOLDOWN_MS;
      pageCarousel(direction);
    }, { passive: false });

    const SWIPE_THRESHOLD = 44;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchActive = false;
    let touchAxis = '';
    gutter.addEventListener('touchstart', (event) => {
      if (event.touches.length !== 1) { touchActive = false; return; }
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
      touchActive = true;
      touchAxis = '';
    }, { passive: true });
    gutter.addEventListener('touchmove', (event) => {
      if (!touchActive || event.touches.length !== 1) return;
      const dx = event.touches[0].clientX - touchStartX;
      const dy = event.touches[0].clientY - touchStartY;
      if (!touchAxis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        touchAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      // Horizontal swipe drives the pager; vertical falls through to page scroll.
      if (touchAxis === 'x') event.preventDefault();
    }, { passive: false });
    gutter.addEventListener('touchend', (event) => {
      if (!touchActive) return;
      touchActive = false;
      if (touchAxis !== 'x') return;
      const dx = event.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) < SWIPE_THRESHOLD) return;
      pageCarousel(dx < 0 ? 1 : -1);
    }, { passive: false });

    renderTabs();
    renderTrack();

    section.append(tabs, seasonMeta, gutter, desktopArrows, mobileArrows);
    target.appendChild(section);
  }

  function renderSpotlight(target) {
    const spotlight = model?.spotlight || {};
    const spotlightHref = canonicalEntryHref(spotlight.cta_href);
    const spotlightEntry = allEntries().find((entry) => {
      const entryHref = canonicalEntryHref(entry.entry_href);
      if (spotlightHref && entryHref === spotlightHref) return true;
      if (text(spotlight.entry_id) && text(entry.id) === text(spotlight.entry_id)) return true;
      return false;
    }) || null;
    const resolvedHref = canonicalEntryHref(spotlightEntry?.entry_href || spotlight.cta_href) || text(spotlight.cta_href || '/catalog/');
    const resolvedTitle = text(spotlightEntry?.title_raw || spotlight.subhead_raw || 'Featured entry');
    const resolvedBody = text(spotlight.body_raw || spotlightEntry?.performer_raw || '');
    const resolvedImage = normalizeImageSrc(text(spotlight.image_src || spotlightEntry?.image_src || ''));
    const section = create('section', 'dx-catalog-index-spotlight dx-catalog-index-surface');

    const copy = create('div', 'dx-catalog-index-spotlight-copy');
    copy.appendChild(create('p', 'dx-catalog-index-kicker', text(spotlight.headline_raw || 'ARTIST SPOTLIGHT')));
    copy.appendChild(create('h2', 'dx-catalog-index-spotlight-title', resolvedTitle));
    if (resolvedBody) copy.appendChild(create('p', 'dx-catalog-index-copy', resolvedBody));
    copy.appendChild(openCta(resolvedHref, text(spotlight.cta_label_raw || 'View entry'), 'primary'));

    section.appendChild(copy);

    if (resolvedImage) {
      const media = create('a', 'dx-catalog-index-spotlight-media');
      media.href = resolvedHref;
      const image = create('img', 'dx-catalog-index-spotlight-img');
      image.width = 1280;
      image.height = 720;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.alt = text(resolvedTitle || spotlight.headline_raw || 'Artist spotlight');
      image.src = resolvedImage;
      media.appendChild(image);
      section.appendChild(media);
    }

    target.appendChild(section);
  }

  function renderEntryRow(entry) {
    const row = create('article', 'dx-catalog-index-row');
    const href = text(entry.entry_href || '#');
    const rowTitle = text(entry.title_raw || entry.lookup_raw || 'entry');

    const code = create('p', 'dx-catalog-index-row-code', text(entry.lookup_raw || '—'));
    const title = create('h4', 'dx-catalog-index-row-title', text(entry.title_raw || 'Untitled'));
    const performer = create('p', 'dx-catalog-index-row-performer', protectName(performerHeading(entry)));
    const metaValues = entry.kind === 'uav'
      ? [
          text(entry.uav?.tour || ''),
          ...(entry.uav?.subjects || []).map((row) => row.label),
          ...(entry.uav?.capture_classes || []),
          ...(entry.uav?.spectra || []),
        ]
      : [text(entry.season || ''), ...(entry.instrument_family || [])];
    const meta = create('p', 'dx-catalog-index-row-meta', metaValues.filter(Boolean).join(' · '));

    const open = createEntryOpenArrowCta(href);
    const favorite = createEntryFavoriteButton(entry);

    const textWrap = create('div', 'dx-catalog-index-row-text');
    textWrap.append(title, performer, meta);

    const actions = create('div', 'dx-catalog-index-row-actions');
    actions.append(favorite, open);

    // Stretched-link overlay: the whole row becomes a click target for the entry
    // page, layered behind the favorite/open controls so those still work. Kept
    // out of the tab order (the explicit arrow link is the keyboard affordance).
    const overlay = create('a', 'dx-catalog-index-row-link');
    overlay.href = href;
    overlay.tabIndex = -1;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('aria-label', `Open ${rowTitle}`);

    row.append(overlay, code, textWrap, actions);

    // Debounced hover: only commit the ink-fill wash once the pointer settles, so
    // skimming the list doesn't flash every row it passes over.
    let hoverTimer = 0;
    const clearHover = () => {
      if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = 0; }
      row.classList.remove('is-hovering');
    };
    row.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'touch') return;
      if (hoverTimer) clearTimeout(hoverTimer);
      hoverTimer = window.setTimeout(() => { row.classList.add('is-hovering'); }, 80);
    });
    row.addEventListener('pointerleave', clearHover);
    row.addEventListener('pointercancel', clearHover);

    return row;
  }

  function renderBrowse() {
    const host = document.querySelector('[data-catalog-index-browse]');
    if (!host) return;
    clearNode(host);

    const entries = activeEntries();
    const browse = create('section', 'dx-catalog-index-browse dx-catalog-index-surface');

    const idByMode = {
      performer: 'dex-performer',
      instrument: 'dex-instrument',
      lookup: 'dex-lookup',
    };
    browse.id = idByMode[state.mode] || 'dex-performer';

    const heading = create('div', 'dx-catalog-index-browse-head');
    heading.appendChild(create('p', 'dx-catalog-index-kicker', `Browse mode: ${state.mode}`));
    heading.appendChild(create('h3', 'dx-catalog-index-browse-title', entries.length ? `${entries.length} matching entries` : 'No matching entries'));
    browse.appendChild(heading);

    if (!entries.length) {
      browse.appendChild(create('p', 'dx-catalog-index-copy', 'Try broadening your query or clearing filters.'));
      host.appendChild(browse);
      decorateCatalogHeadings(browse);
      return;
    }

    const groups = groupEntries(entries);
    const list = create('div', 'dx-catalog-index-list');

    groups.forEach(([label, items]) => {
      const group = create('section', 'dx-catalog-index-group');
      const groupTitle = create('h4', 'dx-catalog-index-group-title', protectName(label));
      group.appendChild(groupTitle);

      const rows = create('div', 'dx-catalog-index-group-rows');
      items.forEach((entry) => rows.appendChild(renderEntryRow(entry)));
      group.appendChild(rows);
      list.appendChild(group);
    });

    browse.appendChild(list);
    host.appendChild(browse);
    decorateCatalogHeadings(browse);

    revealStagger(browse, '.dx-catalog-index-group', {
      key: 'catalog-index-browse-reveal',
      y: 8,
      duration: 0.24,
      stagger: 0.02,
      threshold: 0.1,
      rootMargin: '0px 0px -8% 0px',
    });
    bindDexButtonMotion(browse);
    syncFavoriteButtons(browse);
  }

  function renderError(error) {
    const root = document.querySelector(APP_SELECTOR);
    if (!root) return;
    root.setAttribute('data-dx-catalog-state', 'error');
    root.setAttribute('aria-busy', 'false');
    clearNode(root);
    const pane = create('section', 'dx-catalog-index-surface dx-catalog-index-error');
    pane.appendChild(create('h2', 'dx-catalog-index-title', 'Catalog failed to load'));
    pane.appendChild(create('p', 'dx-catalog-index-copy', text(error?.message || 'Unknown error')));
    root.appendChild(pane);
    decorateCatalogHeadings(root);
  }

  function render() {
    const root = document.querySelector(APP_SELECTOR);
    if (!root || !model) return;

    const staticHero = root.querySelector('[data-dx-catalog-static-hero]');
    const shell = create('div', 'dx-catalog-index-shell');
    renderHero(shell, staticHero);
    renderSeasonCarousel(shell);
    renderSpotlight(shell);
    renderControls(shell);

    const newsletter = create('section', 'dx-catalog-index-surface dx-catalog-index-newsletter');
    if (!newsletterActivated) {
      newsletter.hidden = true;
      newsletter.setAttribute('aria-hidden', 'true');
    } else {
      newsletter.setAttribute('aria-hidden', 'false');
      newsletter.appendChild(create('p', 'dx-catalog-index-kicker', 'Newsletter'));
      newsletter.appendChild(create('h2', 'dx-catalog-index-spotlight-title', 'Get catalog drops and call windows in your inbox.'));
      newsletter.appendChild(
        create(
          'p',
          'dx-catalog-index-copy',
          'Curated release highlights, fresh catalog additions, and opportunities to contribute.',
        ),
      );
      const mount = create('div', 'dx-catalog-index-newsletter-mount');
      mount.setAttribute('data-dx-marketing-newsletter-mount', 'catalog-index-page');
      newsletter.appendChild(mount);
      const privacy = create('a', 'dx-catalog-index-newsletter-privacy', 'Read privacy policy');
      privacy.href = '/privacy/';
      newsletter.appendChild(privacy);
      mountCatalogNewsletter(mount);
    }
    shell.appendChild(newsletter);

    const browseHost = create('div', 'dx-catalog-index-browse-host');
    browseHost.setAttribute('data-catalog-index-browse', 'true');
    shell.appendChild(browseHost);

    clearNode(root);
    root.setAttribute('data-dx-catalog-state', 'ready');
    root.setAttribute('aria-busy', 'false');
    root.appendChild(shell);
    renderBrowse();
    decorateCatalogHeadings(root);
    bindDexButtonMotion(root);
    bindPaginationMotion(root);
    startBlobMotion();
  }

  async function loadJson(url) {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    return await response.json();
  }

  async function loadOptionalJson(url) {
    try {
      return await loadJson(url);
    } catch {
      return null;
    }
  }

  async function boot() {
    if (redirectLegacyHashes()) return;

    state = { ...DEFAULT_STATE, ...readUrlState() };
    bindFavoritesSignals();

    try {
      const [loadedModel, loadedSearch, loadedSeasons] = await Promise.all([
        loadJson(ENTRIES_URL),
        loadJson(SEARCH_URL),
        loadOptionalJson(SEASONS_URL),
      ]);
      model = normalizeLoadedModel(loadedModel);
      searchModel = loadedSearch;
      seasonsModel = normalizeSeasonConfig(loadedSeasons || { seasons: [] });
      fuse = buildFuse();
      writeUrlState();
      render();
      bindNewsletterScrollThreshold();
    } catch (error) {
      renderError(error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
