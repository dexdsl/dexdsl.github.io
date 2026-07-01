(() => {
  if (typeof window === 'undefined') return;
  if (window.__dxBagAppLoaded) return;
  window.__dxBagAppLoaded = true;

  const ROOT_ID = 'dex-bag';
  const BAG_ROUTE_PATH = '/entry/bag/';
  const BAG_ROUTE_CLASS = 'dx-bag-page';
  const PROFILE_SHOW_MESH_ROUTE_CLASS = 'dx-route-show-mesh';
  const DEFAULT_API_BASE = 'https://dex-api.spring-fog-8edd.workers.dev';
  const FETCH_TIMEOUT_MS = 9000;
  const BUNDLE_REQUEST_TIMEOUT_MS = 45000;
  const BUNDLE_POLL_TIMEOUT_MS = 18000;
  const BUNDLE_JOB_MAX_ELAPSED_MS = 20 * 60 * 1000;
  const BUNDLE_JOB_MIN_WAIT_MS = 320;
  const BUNDLE_JOB_MAX_WAIT_MS = 5000;
  const RESUME_KEY = 'dex:bag:resume:v1';
  const BACK_CRUMB_MEMORY_KEY = 'dex:bag:back-crumb:v1';
  const BREADCRUMB_FALLBACK_HREF = '/catalog/';
  const RECEIPT_VISIBLE_LIMIT = 8;
  const SHARED_MESH_TEMPLATE_PATHS = ['/__dx/chrome-template', '/', '/index.html', '/docs/', '/docs/index.html'];
  const SHARED_MESH_BOOTSTRAP_ATTR = 'data-dx-shared-mesh-bootstrap';
  const SHARED_MESH_STYLE_ATTR = 'data-dx-shared-mesh-style';
  const CATALOG_ENTRIES_ENDPOINTS = ['/assets/data/catalog.entries.json', '/data/catalog.entries.json'];
  const BAG_DESCRIPTION_COPY = 'Review queued selections across entries, adjust scope, and export one merged download bundle.';
  const BAG_SIGNED_IN_PREFIX = 'Signed in as';
  const LEGACY_BUNDLE_BUCKETS = ['A', 'B', 'C', 'D', 'E', 'X'];
  const BUNDLE_READY_STATUSES = new Set(['ready', 'complete', 'completed', 'done', 'success', 'succeeded', 'finished']);
  const BUNDLE_PENDING_STATUSES = new Set(['', 'accepted', 'created', 'pending', 'queued', 'processing', 'running', 'building', 'preparing', 'started']);
  const BUNDLE_FORBIDDEN_STATUSES = new Set(['forbidden', 'unauthorized', 'unauthorised', 'denied']);
  const BUNDLE_NOT_FOUND_STATUSES = new Set(['not-found', 'not_found', 'missing']);
  const BUNDLE_FAILED_STATUSES = new Set(['error', 'failed', 'failure', 'cancelled', 'canceled', 'expired']);

  function toText(value) {
    return String(value ?? '');
  }

  function createCodedError(code, message = code) {
    const err = new Error(message);
    err.code = code;
    return err;
  }

  function normalizeBundleStatus(payload) {
    return toText(payload?.status || payload?.state || payload?.phase)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
  }

  function getNestedBundlePayload(payload) {
    if (!payload || typeof payload !== 'object') return null;
    return payload.bundle || payload.download || payload.result || payload.data || null;
  }

  function getBundleSignedUrl(payload) {
    const nested = getNestedBundlePayload(payload);
    return toText(
      payload?.signedUrl
      || payload?.url
      || payload?.downloadUrl
      || nested?.signedUrl
      || nested?.url
      || nested?.downloadUrl
    ).trim();
  }

  function parseBundleDownloads(payload) {
    const list = Array.isArray(payload?.downloads) ? payload.downloads : [];
    const out = [];
    const seen = new Set();
    list.forEach((item) => {
      const href = toText(item?.signedUrl || item?.url || item?.downloadUrl).trim();
      if (!href || seen.has(href)) return;
      seen.add(href);
      out.push({ name: toText(item?.name).trim(), signedUrl: href });
    });
    return out;
  }

  function getBundleJobId(payload) {
    const nested = getNestedBundlePayload(payload);
    return toText(
      payload?.jobId
      || payload?.job_id
      || payload?.id
      || nested?.jobId
      || nested?.job_id
      || nested?.id
    ).trim();
  }

  function normalizeLookupKey(value) {
    return toText(value)
      .normalize('NFKD')
      .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function parseDateMs(value) {
    const ms = Date.parse(toText(value));
    return Number.isFinite(ms) ? ms : 0;
  }

  function normalizePath(pathname) {
    const raw = toText(pathname).trim();
    if (!raw) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      try {
        const parsed = new URL(raw, window.location.origin);
        return normalizePath(parsed.pathname || '/');
      } catch {
        return '';
      }
    }
    const normalized = raw.startsWith('/') ? raw : `/${raw}`;
    const clean = normalized.replace(/\/+/, '/').replace(/\/+/g, '/');
    if (clean === '/') return '/';
    return clean.endsWith('/') ? clean : `${clean}/`;
  }

  function isLocalViewerRoute() {
    const host = toText(window.location.hostname || '').trim().toLowerCase();
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
    if (!isLocalHost) return false;
    const pathname = normalizePath(window.location.pathname || '/');
    return pathname.startsWith('/view/');
  }

  function normalizeLookup(value) {
    return toText(value).trim();
  }

  function normalizeBucket(value) {
    const bucket = toText(value).trim().toUpperCase();
    return /^[A-Z]$/.test(bucket) ? bucket : '';
  }

  function normalizeMediaType(value) {
    const mediaType = toText(value).trim().toLowerCase();
    return mediaType === 'audio' || mediaType === 'video' ? mediaType : '';
  }

  function fileIdMatchesSelection(candidateValue, selectedValue) {
    const candidate = toText(candidateValue).trim();
    const selected = toText(selectedValue).trim();
    if (!candidate || !selected) return false;
    return candidate === selected || candidate.startsWith(`${selected}-`);
  }

  function formatElapsedMs(value) {
    const elapsedMs = Math.max(0, Number(value) || 0);
    const seconds = Math.max(1, Math.round(elapsedMs / 1000));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
  }

  function getBundleJobMaxElapsedMs() {
    const override = Number(window.__dxBagBundleJobMaxElapsedMs);
    if (Number.isFinite(override) && override > 0) {
      return Math.max(5000, Math.min(override, 60 * 60 * 1000));
    }
    return BUNDLE_JOB_MAX_ELAPSED_MS;
  }

  function htmlEscape(value) {
    return toText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toAbsoluteUrl(value, baseHref = window.location.origin) {
    const raw = toText(value).trim();
    if (!raw) return '';
    let base = toText(baseHref).trim();
    if (!base) base = window.location.origin;
    if (!/^https?:\/\//i.test(base)) {
      try {
        base = new URL(base, window.location.origin).href;
      } catch {
        base = window.location.origin;
      }
    }
    try {
      const parsed = new URL(raw, base);
      if (!/^https?:$/i.test(parsed.protocol)) return '';
      return parsed.href;
    } catch {
      return '';
    }
  }

  function decodeBase64UrlUtf8(value) {
    const raw = toText(value).trim();
    if (!raw) return '';
    try {
      const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
      const binary = window.atob(padded);
      const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch {
      return '';
    }
  }

  function pathLabelFromSegments(pathname = '') {
    const normalized = normalizePath(pathname);
    if (!normalized || normalized === '/') return 'home';
    if (normalized === '/catalog/') return 'catalog';
    const segments = normalized.split('/').filter(Boolean);
    const last = toText(segments[segments.length - 1] || '').trim();
    if (!last) return 'back';
    return last.replace(/[-_]+/g, ' ');
  }

  function deriveBackLabelFromPath(pathname = '') {
    const normalized = normalizePath(pathname);
    if (!normalized) return 'back';
    if (normalized.startsWith('/entries/') || normalized.startsWith('/entry/')) {
      const parts = normalized.split('/').filter(Boolean);
      const slug = toText(parts[1] || '').trim();
      if (!slug || slug.toLowerCase() === 'bag') return pathLabelFromSegments(normalized);
      return slug.replace(/[-_]+/g, ' ');
    }
    if (normalized.startsWith('/view/')) {
      const parts = normalized.split('/').filter(Boolean);
      const encodedId = toText(parts[1] || '').trim();
      const decodedPath = decodeBase64UrlUtf8(encodedId);
      const entryMatch = decodedPath.match(/\/entries\/([^/]+)\/index\.html$/i);
      if (entryMatch && entryMatch[1]) return toText(entryMatch[1]).replace(/[-_]+/g, ' ');
      const bagMatch = decodedPath.match(/\/entry\/bag\/index\.html$/i);
      if (bagMatch) return 'catalog';
      return 'back';
    }
    return pathLabelFromSegments(normalized);
  }

  function readBackCrumbMemory() {
    try {
      const raw = window.sessionStorage.getItem(BACK_CRUMB_MEMORY_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const href = toText(parsed?.href).trim();
      const label = toText(parsed?.label).trim();
      if (!href || !label) return null;
      return { href, label };
    } catch {
      return null;
    }
  }

  function writeBackCrumbMemory(crumb) {
    const href = toText(crumb?.href).trim();
    const label = toText(crumb?.label).trim();
    if (!href || !label) return;
    try {
      window.sessionStorage.setItem(BACK_CRUMB_MEMORY_KEY, JSON.stringify({ href, label }));
    } catch {}
  }

  function resolveBackCrumb() {
    const fallback = readBackCrumbMemory() || { href: BREADCRUMB_FALLBACK_HREF, label: 'catalog' };
    const referrerRaw = toText(document.referrer).trim();
    if (!referrerRaw) return fallback;
    try {
      const refUrl = new URL(referrerRaw, window.location.origin);
      if (refUrl.origin !== window.location.origin) return fallback;
      const refPath = normalizePath(refUrl.pathname || '/');
      const currentPath = normalizePath(window.location.pathname || '/');
      if (!refPath || refPath === currentPath) return fallback;
      const href = `${refPath}${toText(refUrl.search || '')}${toText(refUrl.hash || '')}`;
      const label = deriveBackLabelFromPath(refPath);
      const next = { href, label: label || fallback.label };
      writeBackCrumbMemory(next);
      return next;
    } catch {
      return fallback;
    }
  }

  function ensureBreadcrumbMotionRuntime() {
    if (window.__dexBreadcrumbMotionRuntimeRequested) return;
    window.__dexBreadcrumbMotionRuntimeRequested = true;
    const fallbackSrc = 'https://dexdsl.github.io/assets/js/dex-breadcrumb-motion.js';
    const localSrc = '/assets/js/dex-breadcrumb-motion.js';
    const loadScript = (src, onError) => {
      const script = document.createElement('script');
      script.defer = true;
      script.src = src;
      if (typeof onError === 'function') script.onerror = onError;
      document.head.appendChild(script);
    };
    if (localSrc === fallbackSrc) {
      loadScript(fallbackSrc);
      return;
    }
    loadScript(localSrc, () => {
      loadScript(fallbackSrc);
    });
  }

  function mountBreadcrumbMotion() {
    if (typeof window.dexBreadcrumbMotionMount === 'function') {
      window.dexBreadcrumbMotionMount();
    }
  }

  function parseJsonScriptById(doc, id) {
    if (!doc || !id) return null;
    const script = doc.getElementById(id);
    if (!(script instanceof HTMLScriptElement)) return null;
    const text = toText(script.textContent).trim();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  async function requestCatalogEntriesIndex() {
    const byLookup = new Map();
    const byEntryHref = new Map();
    const endpoints = Array.isArray(CATALOG_ENTRIES_ENDPOINTS) ? CATALOG_ENTRIES_ENDPOINTS : [];

    for (const endpoint of endpoints) {
      const safeEndpoint = toText(endpoint).trim();
      if (!safeEndpoint) continue;
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(safeEndpoint, {
          method: 'GET',
          headers: { accept: 'application/json,*/*;q=0.9' },
          credentials: 'same-origin',
          signal: ctrl.signal,
        });
        if (!response.ok) continue;
        const payload = await response.json().catch(() => null);
        const rows = Array.isArray(payload?.entries) ? payload.entries : (Array.isArray(payload) ? payload : []);
        rows.forEach((row) => {
          const lookupKey = normalizeLookupKey(row?.lookup_raw || row?.lookup || '');
          const entryHref = normalizePath(row?.entry_href || row?.entryHref || row?.href || '');
          const imageSrc = toAbsoluteUrl(row?.image_src || row?.imageSrc || '', window.location.origin);
          if (lookupKey && imageSrc && !byLookup.has(lookupKey)) byLookup.set(lookupKey, imageSrc);
          if (entryHref && imageSrc && !byEntryHref.has(entryHref)) byEntryHref.set(entryHref, imageSrc);
        });
        if (byLookup.size || byEntryHref.size) return { byLookup, byEntryHref };
      } catch {
      } finally {
        window.clearTimeout(timer);
      }
    }

    return { byLookup, byEntryHref };
  }

  function resolveCatalogThumbnail(index, lookup = '', entryHref = '') {
    const byLookup = index?.byLookup instanceof Map ? index.byLookup : null;
    const byEntryHref = index?.byEntryHref instanceof Map ? index.byEntryHref : null;
    const hrefKey = normalizePath(entryHref || '');
    if (byEntryHref && hrefKey && byEntryHref.has(hrefKey)) return toText(byEntryHref.get(hrefKey)).trim();
    const lookupKey = normalizeLookupKey(lookup);
    if (byLookup && lookupKey && byLookup.has(lookupKey)) return toText(byLookup.get(lookupKey)).trim();
    return '';
  }

  function getApiBase() {
    const configured = toText(window.DEX_API_BASE_URL || window.DEX_API_ORIGIN || DEFAULT_API_BASE).trim();
    return configured.replace(/\/+$/, '');
  }

  function getAuth() {
    return window.DEX_AUTH || window.dexAuth || null;
  }

  function withTimeout(promise, timeoutMs, fallbackValue = null) {
    const ms = Number(timeoutMs);
    const safeMs = Number.isFinite(ms) && ms > 0 ? ms : FETCH_TIMEOUT_MS;
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        if (fallbackValue !== null) {
          resolve(fallbackValue);
          return;
        }
        reject(new Error('timeout'));
      }, safeMs);

      Promise.resolve(promise)
        .then((value) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          if (fallbackValue !== null) {
            resolve(fallbackValue);
            return;
          }
          reject(error);
        });
    });
  }

  async function resolveAuthSnapshot(timeoutMs = 2200) {
    const auth = getAuth();
    if (!auth) {
      return { auth: null, authenticated: false, token: '', user: null };
    }

    try {
      if (typeof auth.resolve === 'function') {
        await withTimeout(auth.resolve(timeoutMs), timeoutMs, null);
      } else if (auth.ready && typeof auth.ready.then === 'function') {
        await withTimeout(auth.ready, timeoutMs, null);
      }
    } catch {}

    let authenticated = false;
    let token = '';
    let user = null;

    try {
      if (typeof auth.isAuthenticated === 'function') {
        authenticated = Boolean(await withTimeout(auth.isAuthenticated(), timeoutMs, false));
      }
    } catch {
      authenticated = false;
    }

    if (authenticated && typeof auth.getAccessToken === 'function') {
      try {
        token = toText(await withTimeout(auth.getAccessToken(), timeoutMs, ''));
      } catch {
        token = '';
      }
    }

    if (authenticated && typeof auth.getUser === 'function') {
      try {
        user = await withTimeout(auth.getUser(), timeoutMs, null);
      } catch {
        user = null;
      }
    }

    return { auth, authenticated, token, user };
  }

  async function requestJson(pathname, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const token = toText(options.token);
    const body = options.body;
    const timeoutMs = Number(options.timeoutMs);
    const safeTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : FETCH_TIMEOUT_MS;
    const headers = { accept: 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';

    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), safeTimeoutMs);
    try {
      const response = await fetch(`${getApiBase()}${pathname}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'omit',
        signal: ctrl.signal,
      });
      const text = await response.text();
      let payload = {};
      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        payload = { raw: text };
      }

      if (!response.ok) {
        const err = new Error(toText(payload?.message || payload?.error || `http_${response.status}`) || `http_${response.status}`);
        err.status = response.status;
        if (response.status === 401 || response.status === 403) err.code = 'forbidden';
        else if (response.status === 404) err.code = 'not-found';
        else err.code = 'failed';
        err.payload = payload;
        throw err;
      }
      return payload;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw createCodedError('timeout', 'request timeout');
      }
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function normalizeAvailableTypes(input, fallbackType = '') {
    const seen = new Set();
    const out = [];
    const add = (value) => {
      const mediaType = normalizeMediaType(value);
      if (!mediaType || seen.has(mediaType)) return;
      seen.add(mediaType);
      out.push(mediaType);
    };
    if (Array.isArray(input)) {
      input.forEach(add);
    } else {
      const raw = toText(input).trim();
      if (raw) raw.split(',').forEach(add);
    }
    if (!out.length) add(fallbackType);
    out.sort();
    return out;
  }

  function normalizeFormatToken(value) {
    const raw = toText(value).trim();
    if (!raw) return '';
    const compact = raw.replace(/^\./, '').replace(/\s+/g, '').toLowerCase();
    if (!compact) return '';
    if (compact === '4k' || compact === '2160p' || compact === 'uhd') return '4K';
    if (compact === '1080p' || compact === 'fhd') return '1080p';
    return compact;
  }

  function parseBracketFormats(value) {
    const out = [];
    const seen = new Set();
    const text = toText(value);
    const re = /\[([^\]]+)\]/g;
    let match = null;
    while ((match = re.exec(text))) {
      const normalized = normalizeFormatToken(match[1]);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(normalized);
    }
    return out;
  }

  function collectRowFormats(row, fileId, label, availableTypes) {
    const out = [];
    const seen = new Set();
    const add = (value) => {
      const normalized = normalizeFormatToken(value);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      out.push(normalized);
    };

    add(row?.format);
    add(row?.fileType);
    add(row?.ext);
    add(row?.extension);
    add(row?.codec);
    add(row?.container);
    add(row?.quality);
    if (Array.isArray(row?.formats)) row.formats.forEach(add);
    if (Array.isArray(row?.availableFormats)) row.availableFormats.forEach(add);
    parseBracketFormats(label).forEach(add);

    const extMatch = toText(fileId).match(/\.([A-Za-z0-9]+)$/);
    if (extMatch) add(extMatch[1]);

    if (!out.length && availableTypes.includes('audio')) add('audio');
    if (!out.length && availableTypes.includes('video')) add('video');
    return out;
  }

  function parseFiniteSizeBytes(value) {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) && asNumber > 0 ? asNumber : 0;
  }

  function normalizeLookupFiles(payload = {}, lookup) {
    const list = Array.isArray(payload?.files)
      ? payload.files
      : (Array.isArray(payload?.lookup?.files)
        ? payload.lookup.files
        : (Array.isArray(payload?.items) ? payload.items : []));

    return list
      .map((row) => {
        const bucket = normalizeBucket(row?.bucket || toText(row?.bucketNumber).split('.')[0]);
        const fileId = toText(row?.fileId || row?.assetId || row?.id).trim();
        const type = normalizeMediaType(row?.type || row?.media_type);
        const availableTypes = normalizeAvailableTypes(row?.availableTypes || row?.available_types, type);
        const label = toText(row?.label || row?.sourceLabel || row?.bucketNumber || fileId).trim();
        const formats = collectRowFormats(row, fileId, label, availableTypes);
        const sizeBytes = parseFiniteSizeBytes(row?.sizeBytes || row?.size_bytes || row?.bytes || row?.size);
        if (!bucket || !fileId) return null;
        return {
          lookup,
          bucket,
          fileId,
          label,
          type,
          availableTypes,
          formats,
          sizeBytes,
        };
      })
      .filter(Boolean);
  }

  function getKindOrder(kind) {
    if (kind === 'collection') return 0;
    if (kind === 'bucket') return 1;
    if (kind === 'type') return 2;
    if (kind === 'file') return 3;
    return 9;
  }

  function joinNatural(parts = []) {
    const list = Array.isArray(parts) ? parts.map((part) => toText(part).trim()).filter(Boolean) : [];
    if (!list.length) return '';
    if (list.length === 1) return list[0];
    if (list.length === 2) return `${list[0]} and ${list[1]}`;
    return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
  }

  function formatBucketLabelList(bucketValues = []) {
    const buckets = Array.from(new Set((Array.isArray(bucketValues) ? bucketValues : []).map((value) => normalizeBucket(value)).filter(Boolean))).sort();
    if (!buckets.length) return '';
    if (buckets.length === 1) return `${buckets[0]} Bucket`;
    return `${joinNatural(buckets)} Buckets`;
  }

  function renderRandomizedHeadingText(value, options = {}) {
    const canonical = toText(value);
    if (!canonical) return '';
    try {
      const headingFx = window.__dxHeadingFx;
      if (headingFx && typeof headingFx.renderHeadingText === 'function') {
        const rendered = headingFx.renderHeadingText(canonical, options);
        return toText(rendered) || canonical;
      }
    } catch {}
    try {
      if (typeof window.randomizeTitle === 'function') {
        const rendered = window.randomizeTitle(canonical, options);
        return toText(rendered) || canonical;
      }
    } catch {}
    return canonical;
  }

  function applyHeadingDuplicateSeparators(renderedValue, canonicalValue = '') {
    const text = toText(renderedValue);
    const canonical = toText(canonicalValue).replace(/\u200C/g, '').replace(/\u200D/g, '');
    if (!text) return '';
    let out = '';
    let canonicalIndex = 0;
    for (let index = 0; index < text.length; index += 1) {
      const current = text[index];
      const next = text[index + 1] || '';
      out += current;
      if (!next) continue;
      if (current === '\u200C' || current === '\u200D') continue;
      if (next === '\u200C' || next === '\u200D') continue;
      const isAlphaPair = current.toLowerCase() !== current.toUpperCase()
        && next.toLowerCase() !== next.toUpperCase();
      if (!isAlphaPair) {
        const canonicalChar = canonical.charAt(canonicalIndex);
        if (canonicalChar && canonicalChar.toLowerCase() === current.toLowerCase()) canonicalIndex += 1;
        continue;
      }
      const canonicalChar = canonical.charAt(canonicalIndex);
      if (canonicalChar && canonicalChar.toLowerCase() === current.toLowerCase()) canonicalIndex += 1;
      if (current.toLowerCase() !== next.toLowerCase()) continue;
      const canonicalNext = canonical.charAt(canonicalIndex);
      const isNaturalPair = canonicalNext && canonicalNext.toLowerCase() === current.toLowerCase();
      out += isNaturalPair ? '\u200C' : '\u200D';
    }
    return out;
  }

  function enforceSummarySeparator(value) {
    const text = toText(value);
    if (!text) return '';
    // Preserve explicit non-joining between the two M's in SUMMARY only.
    return text.replace(/SUM(?:[\u200C\u200D])*MARY/g, 'SUM\u200CMARY');
  }

  function renderJoinedRandomizedHeading(value, options = {}) {
    const canonical = toText(value);
    const rendered = renderRandomizedHeadingText(canonical, options);
    return applyHeadingDuplicateSeparators(rendered, canonical);
  }

  function prefersReducedMotion() {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function waitForTransition(node, timeoutMs = 220) {
    if (!(node instanceof HTMLElement)) return Promise.resolve();
    return new Promise((resolve) => {
      let settled = false;
      const safeDuration = Math.max(140, Number(timeoutMs) || 220);
      const done = () => {
        if (settled) return;
        settled = true;
        node.removeEventListener('transitionend', onEnd);
        window.clearTimeout(timer);
        resolve();
      };
      const onEnd = (event) => {
        if (event && event.target !== node) return;
        done();
      };
      const timer = window.setTimeout(done, safeDuration + 180);
      node.addEventListener('transitionend', onEnd);
    });
  }

  async function animateAndCollapse(node, {
    visualTarget = null,
    visualDurationMs = 240,
    collapseDurationMs = 320,
    settleDurationMs = 60,
    easing = 'cubic-bezier(0.22, 0.8, 0.2, 1)',
  } = {}) {
    if (!(node instanceof HTMLElement)) return false;
    if (node.getAttribute('data-removing') === '1') return false;
    node.setAttribute('data-removing', '1');

    const reduced = prefersReducedMotion();
    const visualNode = visualTarget instanceof HTMLElement ? visualTarget : node;
    visualNode.classList.add('is-removing-visual');
    if (!reduced) {
      await waitForTransition(visualNode, visualDurationMs);
    }

    const styles = window.getComputedStyle(node);
    const startHeight = Math.max(node.offsetHeight, node.getBoundingClientRect().height, 0);
    const startMargins = {
      top: styles.marginTop,
      bottom: styles.marginBottom,
    };
    const startPadding = {
      top: styles.paddingTop,
      bottom: styles.paddingBottom,
    };
    const startBorder = {
      top: styles.borderTopWidth,
      bottom: styles.borderBottomWidth,
    };

    node.classList.add('is-collapsing');
    node.style.overflow = 'hidden';
    node.style.height = `${startHeight}px`;
    node.style.marginTop = startMargins.top;
    node.style.marginBottom = startMargins.bottom;
    node.style.paddingTop = startPadding.top;
    node.style.paddingBottom = startPadding.bottom;
    node.style.borderTopWidth = startBorder.top;
    node.style.borderBottomWidth = startBorder.bottom;

    if (!reduced) {
      node.style.transition = [
        `height ${collapseDurationMs}ms ${easing}`,
        `margin-top ${collapseDurationMs}ms ${easing}`,
        `margin-bottom ${collapseDurationMs}ms ${easing}`,
        `padding-top ${collapseDurationMs}ms ${easing}`,
        `padding-bottom ${collapseDurationMs}ms ${easing}`,
        `border-top-width ${collapseDurationMs}ms ${easing}`,
        `border-bottom-width ${collapseDurationMs}ms ${easing}`,
      ].join(', ');
      void node.offsetHeight;
      node.style.height = '0px';
      node.style.marginTop = '0px';
      node.style.marginBottom = '0px';
      node.style.paddingTop = '0px';
      node.style.paddingBottom = '0px';
      node.style.borderTopWidth = '0px';
      node.style.borderBottomWidth = '0px';
      await waitForTransition(node, collapseDurationMs);
      const settleMs = Math.max(0, Number(settleDurationMs) || 0);
      if (settleMs) {
        await new Promise((resolve) => window.setTimeout(resolve, settleMs));
      }
    }

    return true;
  }

  function captureFlipRects(rootNode, selector, keyAttr, excludeSet = null) {
    const map = new Map();
    if (!(rootNode instanceof HTMLElement)) return map;
    rootNode.querySelectorAll(selector).forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      const key = toText(node.getAttribute(keyAttr)).trim();
      if (!key) return;
      if (excludeSet instanceof Set && excludeSet.has(key)) return;
      const rect = node.getBoundingClientRect();
      map.set(key, rect);
    });
    return map;
  }

  function playFlipForRects(rootNode, selector, keyAttr, previousRects, {
    durationMs = 240,
    easing = 'cubic-bezier(0.16, 1, 0.3, 1)',
  } = {}) {
    if (!(rootNode instanceof HTMLElement)) return;
    if (!(previousRects instanceof Map) || !previousRects.size) return;
    if (prefersReducedMotion()) return;
    rootNode.querySelectorAll(selector).forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      const key = toText(node.getAttribute(keyAttr)).trim();
      if (!key || !previousRects.has(key)) return;
      const prev = previousRects.get(key);
      const next = node.getBoundingClientRect();
      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      node.classList.add('is-flip-moving');
      const animation = node.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: 'translate(0px, 0px)' },
        ],
        {
          duration: Math.max(180, Number(durationMs) || 240),
          easing,
        },
      );
      const cleanup = () => node.classList.remove('is-flip-moving');
      if (animation && typeof animation.addEventListener === 'function') {
        animation.addEventListener('finish', cleanup, { once: true });
        animation.addEventListener('cancel', cleanup, { once: true });
      } else {
        window.setTimeout(cleanup, Math.max(180, Number(durationMs) || 240) + 24);
      }
    });
  }

  function captureFlipState(rootNode, { excludeLookups = null, excludeLineIds = null } = {}) {
    return {
      cards: captureFlipRects(rootNode, '.dx-bag-card-shell[data-bag-lookup]', 'data-bag-lookup', excludeLookups),
      lines: captureFlipRects(rootNode, '.dx-bag-receipt > li[data-bag-line-id]', 'data-bag-line-id', excludeLineIds),
    };
  }

  function playFlipState(rootNode, flipState, options = {}) {
    if (!flipState || !(rootNode instanceof HTMLElement)) return;
    const durationMs = Math.max(180, Number(options?.durationMs) || 240);
    const easing = toText(options?.easing).trim() || 'cubic-bezier(0.16, 1, 0.3, 1)';
    playFlipForRects(rootNode, '.dx-bag-card-shell[data-bag-lookup]', 'data-bag-lookup', flipState.cards, {
      durationMs,
      easing,
    });
    playFlipForRects(rootNode, '.dx-bag-receipt > li[data-bag-line-id]', 'data-bag-line-id', flipState.lines, {
      durationMs,
      easing,
    });
  }

  function summarizeSelection(rows = []) {
    const normalizedRows = Array.isArray(rows) ? rows : [];
    if (!normalizedRows.length) return 'No selection';
    if (normalizedRows.some((row) => row.kind === 'collection')) return 'Entire Collection';

    const bucketRows = normalizedRows.filter((row) => row.kind === 'bucket').map((row) => normalizeBucket(row.bucket)).filter(Boolean);
    const typeRows = normalizedRows
      .filter((row) => row.kind === 'type')
      .map((row) => ({ bucket: normalizeBucket(row.bucket), mediaType: normalizeMediaType(row.mediaType) }))
      .filter((row) => row.bucket && row.mediaType);
    const fileRows = normalizedRows
      .filter((row) => row.kind === 'file')
      .map((row) => ({ bucket: normalizeBucket(row.bucket), fileId: toText(row.fileId).trim() }))
      .filter((row) => row.bucket && row.fileId);

    const buckets = Array.from(new Set(bucketRows)).sort();
    const fileBuckets = Array.from(new Set(fileRows.map((row) => row.bucket))).sort();
    const typeBuckets = Array.from(new Set(typeRows.map((row) => row.bucket))).sort();

    if (buckets.length && !fileRows.length && !typeRows.length) {
      return formatBucketLabelList(buckets);
    }

    if (buckets.length && (fileRows.length || typeRows.length)) {
      const head = formatBucketLabelList(buckets);
      const extraBuckets = Array.from(new Set([...fileBuckets, ...typeBuckets].filter((bucket) => !buckets.includes(bucket)))).sort();
      if (!extraBuckets.length) return head;
      if (extraBuckets.length === 1) {
        const bucket = extraBuckets[0];
        const count = fileRows.filter((row) => row.bucket === bucket).length + typeRows.filter((row) => row.bucket === bucket).length;
        const suffix = count > 1 ? `Various ${bucket} Bucket Files` : `${bucket} Bucket File`;
        return `${head}, plus ${suffix}`;
      }
      return `${head}, plus files from ${formatBucketLabelList(extraBuckets)}`;
    }

    if (!buckets.length && typeRows.length && !fileRows.length) {
      const labels = typeRows.map((row) => `${row.bucket} ${row.mediaType.toUpperCase()} Files`);
      return joinNatural(labels);
    }

    if (fileRows.length) {
      if (fileBuckets.length === 1) {
        return fileRows.length === 1 ? `${fileBuckets[0]} Bucket File` : `Various ${fileBuckets[0]} Bucket Files`;
      }
      return `${fileRows.length} Selected Files Across ${formatBucketLabelList(fileBuckets)}`;
    }

    return 'Scoped Selection';
  }

  function formatDisplayFormat(value) {
    const normalized = normalizeFormatToken(value);
    if (!normalized) return '';
    if (normalized === '4K') return '4K';
    if (normalized === '1080p') return '1080p';
    return normalized.toLowerCase();
  }

  function resolveFileFormatsForNode(node, files = []) {
    const bucket = normalizeBucket(node?.bucket);
    const fileId = toText(node?.fileId).trim();
    if (!bucket || !fileId) {
      return normalizeAvailableTypes(node?.mediaTypes, node?.mediaType).map((value) => value.toUpperCase());
    }

    const preferredTypes = normalizeAvailableTypes(node?.mediaTypes, node?.mediaType);
    const matching = (Array.isArray(files) ? files : []).filter((file) => {
      if (normalizeBucket(file?.bucket) !== bucket) return false;
      if (!fileIdMatchesSelection(file?.fileId, fileId)) return false;
      const fileTypes = normalizeAvailableTypes(file?.availableTypes, file?.type);
      if (!preferredTypes.length) return true;
      return preferredTypes.some((mediaType) => fileTypes.includes(mediaType));
    });

    const out = [];
    const seen = new Set();
    const add = (value) => {
      const label = formatDisplayFormat(value);
      if (!label || seen.has(label)) return;
      seen.add(label);
      out.push(label);
    };

    matching.forEach((file) => {
      if (Array.isArray(file?.formats) && file.formats.length) {
        file.formats.forEach(add);
      } else {
        normalizeAvailableTypes(file?.availableTypes, file?.type).forEach((mediaType) => add(mediaType.toUpperCase()));
      }
    });

    if (!out.length) {
      normalizeAvailableTypes(node?.mediaTypes, node?.mediaType)
        .map((mediaType) => mediaType.toUpperCase())
        .forEach(add);
    }
    return out;
  }

  function buildReceiptLines(lookup, rows = [], files = [], bucketFileStats = null) {
    const safeLookup = normalizeLookup(lookup);
    const normalizedRows = Array.isArray(rows) ? rows.slice() : [];
    const safeFiles = Array.isArray(files) ? files : [];
    const hasResolvedFiles = safeFiles.length > 0;
    const out = [];
    const byText = new Map();

    const countFilesBy = ({ bucket = '', mediaType = '' } = {}) => {
      const safeBucket = normalizeBucket(bucket);
      const safeMediaType = normalizeMediaType(mediaType);
      return safeFiles.filter((file) => {
        if (safeBucket && normalizeBucket(file?.bucket) !== safeBucket) return false;
        if (!safeMediaType) return true;
        const availableTypes = normalizeAvailableTypes(file?.availableTypes, file?.type);
        return availableTypes.includes(safeMediaType);
      }).length;
    };

    const pushLine = (line, count = 0, rowKey = '') => {
      const text = toText(line).trim();
      const safeCount = toCountInt(count);
      const key = toText(rowKey).trim();
      if (!text) return;
      if (byText.has(text)) {
        const index = byText.get(text);
        out[index].count = Math.max(out[index].count || 0, safeCount);
        if (key && !out[index].keys.includes(key)) out[index].keys.push(key);
        return;
      }
      byText.set(text, out.length);
      out.push({ text, count: safeCount, keys: key ? [key] : [] });
    };

    normalizedRows.sort((a, b) => {
      const kindOrder = getKindOrder(a?.kind) - getKindOrder(b?.kind);
      if (kindOrder) return kindOrder;
      const bucketOrder = normalizeBucket(a?.bucket).localeCompare(normalizeBucket(b?.bucket));
      if (bucketOrder) return bucketOrder;
      const fileA = toText(a?.fileId).trim();
      const fileB = toText(b?.fileId).trim();
      const numericA = Number((fileA.match(/(?:^|\.)(\d+(?:\.\d+)?)$/) || fileA.match(/(\d+(?:\.\d+)?)/) || [])[1]);
      const numericB = Number((fileB.match(/(?:^|\.)(\d+(?:\.\d+)?)$/) || fileB.match(/(\d+(?:\.\d+)?)/) || [])[1]);
      if (Number.isFinite(numericA) && Number.isFinite(numericB) && numericA !== numericB) return numericA - numericB;
      return fileA.localeCompare(fileB);
    });

    normalizedRows.forEach((row) => {
      const kind = toText(row?.kind).trim().toLowerCase();
      const bucket = normalizeBucket(row?.bucket);
      const rowKey = toText(row?.key).trim();
      if (kind === 'collection') {
        const count = hasResolvedFiles ? safeFiles.length : sumAllBucketStats(bucketFileStats);
        pushLine(`${safeLookup} ALL BUCKETS`, count, rowKey);
        return;
      }
      if (kind === 'bucket') {
        const count = hasResolvedFiles ? countFilesBy({ bucket }) : sumBucketStats(bucketFileStats, bucket);
        pushLine(`${safeLookup} ${bucket}`, count, rowKey);
        return;
      }
      if (kind === 'type') {
        const mediaType = normalizeMediaType(row?.mediaType);
        const count = hasResolvedFiles ? countFilesBy({ bucket, mediaType }) : sumBucketStats(bucketFileStats, bucket, mediaType);
        pushLine(`${safeLookup} ${bucket} [${mediaType.toUpperCase()}]`, count, rowKey);
        return;
      }
      if (kind === 'file') {
        const fileId = toText(row?.fileId).trim();
        const base = `${safeLookup} ${bucket}.${fileId}`;
        const formats = resolveFileFormatsForNode(row, safeFiles);
        if (!formats.length) {
          pushLine(base, 1, rowKey);
          return;
        }
        formats.forEach((format) => pushLine(`${base} [${format}]`, 1, rowKey));
      }
    });

    return out;
  }

  function isSameNormalizedText(a, b) {
    const textA = toText(a).replace(/\s+/g, ' ').trim().toLowerCase();
    const textB = toText(b).replace(/\s+/g, ' ').trim().toLowerCase();
    if (!textA || !textB) return false;
    return textA === textB;
  }

  function resolveCardTitle(rows = [], lookup, entryMeta = null) {
    const metaTitle = toText(entryMeta?.title).trim();
    if (metaTitle && !isSameNormalizedText(metaTitle, lookup)) {
      return metaTitle;
    }

    const normalizedRows = Array.isArray(rows) ? rows.slice() : [];
    normalizedRows.sort((a, b) => parseDateMs(b?.updatedAt || b?.addedAt) - parseDateMs(a?.updatedAt || a?.addedAt));
    for (const row of normalizedRows) {
      const title = toText(row?.title).trim();
      if (!title) continue;
      if (!isSameNormalizedText(title, lookup)) return title;
    }
    return lookup;
  }

  function toCountInt(value) {
    const count = Number(value);
    if (!Number.isFinite(count) || count < 0) return 0;
    return Math.round(count);
  }

  function normalizeBucketFileStats(input) {
    if (!input || typeof input !== 'object') return null;
    const out = {};
    Object.entries(input).forEach(([bucketKey, bucketValue]) => {
      const bucket = normalizeBucket(bucketKey);
      if (!bucket) return;
      const audioIn = bucketValue && typeof bucketValue === 'object' ? bucketValue.audio : null;
      const videoIn = bucketValue && typeof bucketValue === 'object' ? bucketValue.video : null;
      const audio = {
        mp3: toCountInt(audioIn?.mp3),
        wav: toCountInt(audioIn?.wav),
      };
      const video = {
        '1080p': toCountInt(videoIn?.['1080p']),
        '4K': toCountInt(videoIn?.['4K'] ?? videoIn?.['4k']),
      };
      out[bucket] = { audio, video };
    });
    return Object.keys(out).length ? out : null;
  }

  function sumBucketStats(statsByBucket, bucket, mediaType = '') {
    if (!statsByBucket || typeof statsByBucket !== 'object') return 0;
    const safeBucket = normalizeBucket(bucket);
    if (!safeBucket) return 0;
    const row = statsByBucket[safeBucket];
    if (!row || typeof row !== 'object') return 0;
    const sumAudio = toCountInt(row?.audio?.mp3) + toCountInt(row?.audio?.wav);
    const sumVideo = toCountInt(row?.video?.['1080p']) + toCountInt(row?.video?.['4K']);
    const media = normalizeMediaType(mediaType);
    if (media === 'audio') return sumAudio;
    if (media === 'video') return sumVideo;
    return sumAudio + sumVideo;
  }

  function sumAllBucketStats(statsByBucket) {
    if (!statsByBucket || typeof statsByBucket !== 'object') return 0;
    return Object.keys(statsByBucket).reduce((sum, bucket) => sum + sumBucketStats(statsByBucket, bucket), 0);
  }

  function countFilesFromBucketStats(rows = [], bucketFileStats = null) {
    const safeRows = Array.isArray(rows) ? rows : [];
    if (!safeRows.length || !bucketFileStats) return 0;
    if (safeRows.some((row) => toText(row?.kind).trim().toLowerCase() === 'collection')) {
      return sumAllBucketStats(bucketFileStats);
    }

    let total = 0;
    safeRows.forEach((row) => {
      const kind = toText(row?.kind).trim().toLowerCase();
      const bucket = normalizeBucket(row?.bucket);
      if (kind === 'bucket') {
        total += sumBucketStats(bucketFileStats, bucket);
        return;
      }
      if (kind === 'type') {
        total += sumBucketStats(bucketFileStats, bucket, row?.mediaType);
        return;
      }
      if (kind === 'file') {
        const mediaTypes = normalizeAvailableTypes(row?.mediaTypes, row?.mediaType);
        total += Math.max(1, mediaTypes.length || 0);
      }
    });

    return total;
  }

  function countFilesFromSelectionRows(rows = []) {
    const safeRows = Array.isArray(rows) ? rows : [];
    return safeRows.reduce((sum, row) => {
      const kind = toText(row?.kind).trim().toLowerCase();
      if (kind === 'type') return sum + 1;
      if (kind === 'file') {
        const mediaTypes = normalizeAvailableTypes(row?.mediaTypes, row?.mediaType);
        return sum + Math.max(1, mediaTypes.length || 0);
      }
      return sum;
    }, 0);
  }

  function sanitizeEntryTitle(rawTitle, lookup) {
    const raw = toText(rawTitle).trim();
    if (!raw) return '';
    const stripped = raw.replace(/\s+[—-]\s+dex digital sample library\s*$/i, '').trim();
    if (!stripped) return '';
    if (isSameNormalizedText(stripped, lookup)) return '';
    return stripped;
  }

  function parseEntryMetaFromHtml(htmlText = '', sourceHref = '') {
    const text = toText(htmlText);
    if (!text) return null;
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    if (!doc) return null;

    const cfg = parseJsonScriptById(doc, 'dex-sidebar-page-config') || {};
    const lookup = toText(cfg?.lookupNumber).trim();
    const titleFromConfig = sanitizeEntryTitle(cfg?.title, lookup);
    const titleFromHeader = sanitizeEntryTitle(doc.querySelector('.dex-entry-page-title')?.textContent, lookup);
    const titleFromMeta = sanitizeEntryTitle(doc.querySelector('meta[property="og:title"]')?.getAttribute('content'), lookup);
    const title = titleFromConfig || titleFromHeader || titleFromMeta || '';

    const thumbnailRaw = toText(
      doc.querySelector('meta[itemprop="thumbnailUrl"]')?.getAttribute('content')
      || doc.querySelector('meta[property="og:image"]')?.getAttribute('content')
      || doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content')
      || doc.querySelector('meta[itemprop="image"]')?.getAttribute('content')
    ).trim();
    const thumbnailSrc = toAbsoluteUrl(thumbnailRaw, sourceHref || window.location.origin);

    const canonicalHref = toAbsoluteUrl(doc.querySelector('link[rel="canonical"]')?.getAttribute('href'), sourceHref || window.location.origin);
    const bucketFileStats = normalizeBucketFileStats(cfg?.bucketFileStats);
    const manifest = parseJsonScriptById(doc, 'dex-manifest') || {};
    const manifestBundleTokens = normalizeManifestBundleTokens(manifest);

    return {
      lookup,
      title,
      thumbnailSrc,
      canonicalHref,
      bucketFileStats,
      manifestBundleTokens,
    };
  }

  function normalizeManifestBundleTokens(manifest = {}) {
    const all = [];
    const seen = new Set();
    const byBucketType = new Map();

    const ensureBucketType = (bucket, mediaType) => {
      const safeBucket = normalizeBucket(bucket);
      const safeMediaType = normalizeMediaType(mediaType);
      if (!safeBucket || !safeMediaType) return [];
      const key = `${safeBucket}|${safeMediaType}`;
      if (!byBucketType.has(key)) byBucketType.set(key, []);
      return byBucketType.get(key);
    };

    const appendToken = (rawToken, bucket, mediaType) => {
      const token = toText(rawToken).trim();
      if (!token || !/^bundle:/i.test(token)) return;
      const dedupeKey = token.toLowerCase();
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        all.push(token);
      }
      const list = ensureBucketType(bucket, mediaType);
      if (!list.length || list[list.length - 1] !== token) {
        if (!list.some((existing) => existing.toLowerCase() === dedupeKey)) list.push(token);
      }
    };

    const consumeFamily = (family, mediaType) => {
      if (!family || typeof family !== 'object') return;
      Object.entries(family).forEach(([bucketKey, formatMap]) => {
        const safeBucket = normalizeBucket(bucketKey);
        if (!safeBucket || !formatMap || typeof formatMap !== 'object') return;
        Object.values(formatMap).forEach((tokenValue) => appendToken(tokenValue, safeBucket, mediaType));
      });
    };

    consumeFamily(manifest?.audio, 'audio');
    consumeFamily(manifest?.video, 'video');

    return { all, byBucketType };
  }

  async function requestEntryHtml(entryHref) {
    const absolute = toAbsoluteUrl(entryHref, window.location.origin);
    if (!absolute) return '';
    let parsed = null;
    try {
      parsed = new URL(absolute);
    } catch {
      return '';
    }
    if (!parsed || parsed.origin !== window.location.origin) return '';

    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(parsed.href, {
        method: 'GET',
        headers: { accept: 'text/html,*/*;q=0.9' },
        credentials: 'same-origin',
        signal: ctrl.signal,
      });
      if (!response.ok) return '';
      return toText(await response.text());
    } catch {
      return '';
    } finally {
      window.clearTimeout(timer);
    }
  }

  function formatBytes(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value <= 0) return '\u2014';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unit = 0;
    let scaled = value;
    while (scaled >= 1024 && unit < units.length - 1) {
      scaled /= 1024;
      unit += 1;
    }
    const text = unit === 0 ? Math.round(scaled).toString() : scaled.toFixed(scaled >= 10 ? 1 : 2).replace(/\.0+$/, '');
    return `${text} ${units[unit]}`;
  }

  const ESTIMATED_BYTES_PER_FORMAT = Object.freeze({
    mp3: 9 * 1024 * 1024,
    wav: 42 * 1024 * 1024,
    '1080p': 180 * 1024 * 1024,
    '4K': 420 * 1024 * 1024,
  });

  const ESTIMATED_BYTES_PER_MEDIA = Object.freeze({
    audio: 26 * 1024 * 1024,
    video: 300 * 1024 * 1024,
  });

  function estimateBytesForMediaTypes(mediaTypes = []) {
    const normalizedTypes = normalizeAvailableTypes(mediaTypes, '');
    if (!normalizedTypes.length) return 0;
    return normalizedTypes.reduce((sum, mediaType) => (
      sum + (mediaType === 'video'
        ? ESTIMATED_BYTES_PER_MEDIA.video
        : ESTIMATED_BYTES_PER_MEDIA.audio)
    ), 0);
  }

  function estimateBytesFromLookupFiles(files = []) {
    const safeFiles = Array.isArray(files) ? files : [];
    return safeFiles.reduce((sum, file) => {
      const mediaTypes = normalizeAvailableTypes(file?.availableTypes, file?.type);
      return sum + estimateBytesForMediaTypes(mediaTypes);
    }, 0);
  }

  function estimateBytesFromSelectionRows(rows = []) {
    const safeRows = Array.isArray(rows) ? rows : [];
    return safeRows.reduce((sum, row) => {
      const kind = toText(row?.kind).trim().toLowerCase();
      if (kind === 'type') {
        return sum + estimateBytesForMediaTypes([row?.mediaType]);
      }
      if (kind === 'file') {
        const mediaTypes = normalizeAvailableTypes(row?.mediaTypes, row?.mediaType);
        return sum + estimateBytesForMediaTypes(mediaTypes.length ? mediaTypes : ['audio']);
      }
      return sum;
    }, 0);
  }

  function estimateBucketBytes(statsByBucket, bucket, mediaType = '') {
    if (!statsByBucket || typeof statsByBucket !== 'object') return 0;
    const safeBucket = normalizeBucket(bucket);
    if (!safeBucket) return 0;
    const row = statsByBucket[safeBucket];
    if (!row || typeof row !== 'object') return 0;

    const audioBytes = (toCountInt(row?.audio?.mp3) * ESTIMATED_BYTES_PER_FORMAT.mp3)
      + (toCountInt(row?.audio?.wav) * ESTIMATED_BYTES_PER_FORMAT.wav);
    const videoBytes = (toCountInt(row?.video?.['1080p']) * ESTIMATED_BYTES_PER_FORMAT['1080p'])
      + (toCountInt(row?.video?.['4K']) * ESTIMATED_BYTES_PER_FORMAT['4K']);

    const media = normalizeMediaType(mediaType);
    if (media === 'audio') return audioBytes;
    if (media === 'video') return videoBytes;
    return audioBytes + videoBytes;
  }

  function estimateAllBucketBytes(statsByBucket) {
    if (!statsByBucket || typeof statsByBucket !== 'object') return 0;
    return Object.keys(statsByBucket).reduce((sum, bucket) => sum + estimateBucketBytes(statsByBucket, bucket), 0);
  }

  function estimateBytesFromBucketStats(rows = [], bucketFileStats = null) {
    const safeRows = Array.isArray(rows) ? rows : [];
    if (!safeRows.length || !bucketFileStats) return 0;

    if (safeRows.some((row) => toText(row?.kind).trim().toLowerCase() === 'collection')) {
      return estimateAllBucketBytes(bucketFileStats);
    }

    let total = 0;
    safeRows.forEach((row) => {
      const kind = toText(row?.kind).trim().toLowerCase();
      const bucket = normalizeBucket(row?.bucket);
      if (kind === 'bucket') {
        total += estimateBucketBytes(bucketFileStats, bucket);
        return;
      }
      if (kind === 'type') {
        total += estimateBucketBytes(bucketFileStats, bucket, row?.mediaType);
        return;
      }
      if (kind === 'file') {
        const mediaTypes = normalizeAvailableTypes(row?.mediaTypes, row?.mediaType);
        if (!mediaTypes.length) {
          total += estimateBytesForMediaTypes(['audio']);
          return;
        }
        total += estimateBytesForMediaTypes(mediaTypes);
      }
    });

    return total;
  }

  function formatEstimatedSize(bytes) {
    return formatBytes(bytes);
  }

  function expandSelectionsForLookup(rows, files) {
    const normalizedRows = Array.isArray(rows) ? rows : [];
    const fileRows = Array.isArray(files) ? files : [];
    if (!normalizedRows.length || !fileRows.length) return [];

    const hasCollection = normalizedRows.some((row) => row.kind === 'collection');
    if (hasCollection) {
      return fileRows.map((file) => ({
        ...file,
        dedupeKey: `${file.lookup}|${file.fileId}|${file.availableTypes.join(',')}`,
      }));
    }

    const selectedBuckets = new Set(normalizedRows.filter((row) => row.kind === 'bucket').map((row) => normalizeBucket(row.bucket)).filter(Boolean));
    const selectedTypes = normalizedRows
      .filter((row) => row.kind === 'type')
      .map((row) => ({ bucket: normalizeBucket(row.bucket), mediaType: normalizeMediaType(row.mediaType) }))
      .filter((row) => row.bucket && row.mediaType && !selectedBuckets.has(row.bucket));
    const selectedFiles = normalizedRows
      .filter((row) => row.kind === 'file')
      .map((row) => ({
        bucket: normalizeBucket(row.bucket),
        fileId: toText(row.fileId).trim(),
        mediaTypes: normalizeAvailableTypes(row.mediaTypes, row.mediaType),
      }))
      .filter((row) => row.bucket && row.fileId && !selectedBuckets.has(row.bucket));

    const out = [];
    const addFile = (file, mediaTypesOverride = null) => {
      const mediaTypes = Array.isArray(mediaTypesOverride) && mediaTypesOverride.length
        ? mediaTypesOverride.slice().sort()
        : (Array.isArray(file.availableTypes) ? file.availableTypes.slice().sort() : []);
      const dedupeKey = `${file.lookup}|${file.fileId}|${mediaTypes.join(',')}`;
      out.push({ ...file, availableTypes: mediaTypes, dedupeKey });
    };

    for (const file of fileRows) {
      if (selectedBuckets.has(file.bucket)) {
        addFile(file);
        continue;
      }
      let selectedByType = false;
      for (const typeRow of selectedTypes) {
        if (typeRow.bucket !== file.bucket) continue;
        if (!file.availableTypes.includes(typeRow.mediaType)) continue;
        addFile(file, [typeRow.mediaType]);
        selectedByType = true;
      }
      if (selectedByType) continue;
      const exact = selectedFiles.find((row) => row.bucket === file.bucket && fileIdMatchesSelection(file.fileId, row.fileId));
      if (!exact) continue;
      if (exact.mediaTypes.length) {
        const mediaTypes = exact.mediaTypes.filter((mediaType) => file.availableTypes.includes(mediaType));
        if (!mediaTypes.length) continue;
        addFile(file, mediaTypes);
        continue;
      }
      addFile(file, file.availableTypes.slice());
    }

    const deduped = new Map();
    for (const row of out) {
      if (!deduped.has(row.dedupeKey)) deduped.set(row.dedupeKey, row);
    }
    return Array.from(deduped.values());
  }

  async function requestBagBundle({ token, selections }) {
    return requestJson('/me/assets/bag/bundle', {
      method: 'POST',
      token,
      timeoutMs: BUNDLE_REQUEST_TIMEOUT_MS,
      body: {
        source: 'entry-bag',
        dedupe: true,
        selections: Array.isArray(selections) ? selections : [],
      },
    });
  }

  function resolveBundleReadyPayload(payload) {
    const status = normalizeBundleStatus(payload);
    if (BUNDLE_FORBIDDEN_STATUSES.has(status)) {
      throw createCodedError('forbidden', 'forbidden');
    }
    if (BUNDLE_NOT_FOUND_STATUSES.has(status)) {
      throw createCodedError('not-found', 'not-found');
    }
    if (BUNDLE_FAILED_STATUSES.has(status)) {
      throw createCodedError('failed', toText(payload?.message).trim() || 'failed');
    }
    const signedUrl = getBundleSignedUrl(payload);
    if (signedUrl) {
      return {
        signedUrl,
        expiresAt: toText(payload?.expiresAt).trim(),
      };
    }
    if (BUNDLE_READY_STATUSES.has(status)) {
      throw createCodedError('failed', 'missing signed url');
    }
    return null;
  }

  function shouldFallbackToLookupBundles(error) {
    const code = toText(error?.code).toLowerCase();
    return code === 'not-found' || code === 'empty' || code === 'timeout' || code === 'stalled';
  }

  function formatBundlePollStatus(payload, attempt, elapsedMs = 0) {
    const status = normalizeBundleStatus(payload);
    const label = status && BUNDLE_PENDING_STATUSES.has(status)
      ? status.replace(/-/g, ' ')
      : 'preparing';
    const count = parseBundleHintCount(payload);
    const countLabel = count > 0 ? `, ${count} ${count === 1 ? 'file' : 'files'}` : '';
    return `Preparing secure bundle… ${label}${countLabel} (${formatElapsedMs(elapsedMs)})`;
  }

  async function pollBundleJob({ token, jobId, onTick }) {
    const safeJobId = encodeURIComponent(getBundleJobId({ jobId }));
    if (!safeJobId) throw createCodedError('failed', 'missing job id');
    const startedAt = Date.now();
    const maxElapsedMs = getBundleJobMaxElapsedMs();
    let attempt = 0;
    for (;;) {
      const payload = await requestJson(`/me/assets/bundle/${safeJobId}`, {
        token,
        timeoutMs: BUNDLE_POLL_TIMEOUT_MS,
      });
      const ready = resolveBundleReadyPayload(payload);
      if (ready) return { ...payload, ...ready };
      const waitMs = Number(payload?.pollAfterMs || 1100);
      const elapsedMs = Date.now() - startedAt;
      if (typeof onTick === 'function') {
        onTick({
          attempt,
          payload,
          waitMs,
          elapsedMs,
        });
      }
      if (elapsedMs >= maxElapsedMs) {
        throw createCodedError('stalled', 'bundle job still preparing');
      }
      const nextWaitMs = Math.max(
        BUNDLE_JOB_MIN_WAIT_MS,
        Math.min(waitMs, BUNDLE_JOB_MAX_WAIT_MS, maxElapsedMs - elapsedMs),
      );
      await new Promise((resolve) => window.setTimeout(resolve, nextWaitMs));
      attempt += 1;
    }
  }

  function parseBundleHintCount(payload) {
    const candidates = [
      payload?.fileCount,
      payload?.totalFiles,
      payload?.filesCount,
      payload?.resolvedFileCount,
      payload?.bundleFileCount,
      payload?.count,
    ];
    for (const raw of candidates) {
      if (raw === null || raw === undefined || raw === '') continue;
      const value = Number(raw);
      if (Number.isFinite(value) && value >= 0) return Math.round(value);
    }
    return -1;
  }

  function collectLegacyBundleTokens(lookup, nodes = []) {
    const safeLookup = normalizeLookup(lookup);
    if (!safeLookup) return [];
    const list = [];
    const seen = new Set();

    const addToken = (bucket, mediaType) => {
      const safeBucket = normalizeBucket(bucket);
      const safeMediaType = normalizeMediaType(mediaType);
      if (!safeBucket || !safeMediaType) return;
      const token = `bundle:lookup:${safeLookup}:${safeBucket}:${safeMediaType}`;
      const dedupeKey = token.toLowerCase();
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      list.push(token);
    };

    const safeNodes = Array.isArray(nodes) ? nodes : [];
    safeNodes.forEach((node) => {
      const kind = toText(node?.kind).trim().toLowerCase();
      const bucket = normalizeBucket(node?.bucket);
      const mediaTypes = normalizeAvailableTypes(node?.mediaTypes, node?.mediaType);

      if (kind === 'collection') {
        LEGACY_BUNDLE_BUCKETS.forEach((bucketKey) => {
          addToken(bucketKey, 'audio');
          addToken(bucketKey, 'video');
        });
        return;
      }
      if (kind === 'bucket') {
        addToken(bucket, 'audio');
        addToken(bucket, 'video');
        return;
      }
      if (kind === 'type') {
        addToken(bucket, node?.mediaType);
        return;
      }
      if (kind === 'file') {
        if (!mediaTypes.length) {
          addToken(bucket, 'audio');
          addToken(bucket, 'video');
          return;
        }
        mediaTypes.forEach((mediaType) => addToken(bucket, mediaType));
      }
    });

    return list;
  }

  function collectLegacyBundleTokensFromFiles(lookup, rows = [], files = []) {
    const safeLookup = normalizeLookup(lookup);
    if (!safeLookup) return [];
    const list = [];
    const seen = new Set();

    const addToken = (bucket, mediaType) => {
      const safeBucket = normalizeBucket(bucket);
      const safeMediaType = normalizeMediaType(mediaType);
      if (!safeBucket || !safeMediaType) return;
      const token = `bundle:lookup:${safeLookup}:${safeBucket}:${safeMediaType}`;
      const dedupeKey = token.toLowerCase();
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      list.push(token);
    };

    const safeRows = Array.isArray(rows) ? rows : [];
    const safeFiles = Array.isArray(files) ? files : [];
    const expandedFiles = expandSelectionsForLookup(safeRows, safeFiles);
    expandedFiles.forEach((file) => {
      const bucket = normalizeBucket(file?.bucket);
      const availableTypes = normalizeAvailableTypes(file?.availableTypes, file?.type);
      if (!availableTypes.length) {
        addToken(bucket, 'audio');
        addToken(bucket, 'video');
        return;
      }
      availableTypes.forEach((mediaType) => addToken(bucket, mediaType));
    });
    return list;
  }

  function collectLegacyBundleTokensFromManifest(rows = [], manifestBundleTokens = null) {
    if (!manifestBundleTokens || typeof manifestBundleTokens !== 'object') return [];
    const byBucketType = manifestBundleTokens.byBucketType instanceof Map
      ? manifestBundleTokens.byBucketType
      : new Map();
    const all = Array.isArray(manifestBundleTokens.all) ? manifestBundleTokens.all : [];
    const list = [];
    const seen = new Set();

    const appendToken = (tokenValue) => {
      const token = toText(tokenValue).trim();
      if (!token) return;
      const dedupeKey = token.toLowerCase();
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      list.push(token);
    };
    const appendBucketType = (bucket, mediaType) => {
      const safeBucket = normalizeBucket(bucket);
      const safeMediaType = normalizeMediaType(mediaType);
      if (!safeBucket || !safeMediaType) return;
      const key = `${safeBucket}|${safeMediaType}`;
      const tokens = byBucketType.get(key);
      if (!Array.isArray(tokens)) return;
      tokens.forEach(appendToken);
    };

    const safeRows = Array.isArray(rows) ? rows : [];
    safeRows.forEach((row) => {
      const kind = toText(row?.kind).trim().toLowerCase();
      const bucket = normalizeBucket(row?.bucket);
      const mediaType = normalizeMediaType(row?.mediaType);
      const mediaTypes = normalizeAvailableTypes(row?.mediaTypes, mediaType);
      if (kind === 'collection') {
        all.forEach(appendToken);
        return;
      }
      if (kind === 'bucket') {
        appendBucketType(bucket, 'audio');
        appendBucketType(bucket, 'video');
        return;
      }
      if (kind === 'type') {
        appendBucketType(bucket, mediaType);
        return;
      }
      if (kind === 'file') {
        if (!mediaTypes.length) {
          appendBucketType(bucket, 'audio');
          appendBucketType(bucket, 'video');
          return;
        }
        mediaTypes.forEach((type) => appendBucketType(bucket, type));
      }
    });

    return list;
  }

  async function requestLookupBundle({ token, lookup, tokens, onTick }) {
    const safeLookup = normalizeLookup(lookup);
    if (!safeLookup) {
      const err = new Error('missing lookup');
      err.code = 'not-found';
      throw err;
    }
    const payload = await requestJson(`/me/assets/${encodeURIComponent(safeLookup)}/bundle`, {
      method: 'POST',
      token,
      timeoutMs: BUNDLE_REQUEST_TIMEOUT_MS,
      body: {
        tokens: Array.isArray(tokens) ? tokens : [],
        source: 'entry-bag',
      },
    });

    const delivery = toText(payload?.delivery).toLowerCase();
    if (delivery === 'multi') {
      const downloads = parseBundleDownloads(payload);
      if (!downloads.length) {
        throw createCodedError('not-found', 'no downloads');
      }
      return { downloads };
    }
    if (delivery === 'sync') {
      const signedUrl = getBundleSignedUrl(payload);
      if (!signedUrl) {
        throw createCodedError('failed', 'missing signed url');
      }
      return {
        signedUrl,
        expiresAt: toText(payload?.expiresAt).trim(),
      };
    }
    if (delivery === 'async') {
      return pollBundleJob({
        token,
        jobId: getBundleJobId(payload),
        onTick,
      });
    }

    const ready = resolveBundleReadyPayload(payload);
    if (ready) return ready;

    const jobId = getBundleJobId(payload);
    if (jobId) {
      return pollBundleJob({
        token,
        jobId,
        onTick,
      });
    }

    const directSignedUrl = getBundleSignedUrl(payload);
    if (directSignedUrl) {
      return {
        signedUrl: directSignedUrl,
        expiresAt: toText(payload?.expiresAt).trim(),
      };
    }

    throw createCodedError('failed', 'unsupported bundle response');
  }

  async function requestLegacyBagBundles({ token, selections, filesByLookup = null, entryMetaByLookup = null, onTick }) {
    const safeSelections = Array.isArray(selections) ? selections : [];
    const out = [];
    for (let index = 0; index < safeSelections.length; index += 1) {
      const row = safeSelections[index];
      const lookup = normalizeLookup(row?.lookup);
      const rows = Array.isArray(row?.nodes)
        ? row.nodes.map((node) => ({
          kind: toText(node?.kind).trim().toLowerCase(),
          lookup: normalizeLookup(node?.lookup || lookup),
          bucket: normalizeBucket(node?.bucket),
          mediaType: normalizeMediaType(node?.mediaType),
          mediaTypes: normalizeAvailableTypes(node?.mediaTypes, node?.mediaType),
          fileId: toText(node?.fileId).trim(),
        }))
        : [];
      const lookupFiles = filesByLookup instanceof Map
        ? (filesByLookup.get(lookup) || [])
        : [];
      const entryMeta = entryMetaByLookup instanceof Map
        ? (entryMetaByLookup.get(lookup) || null)
        : null;
      let tokens = collectLegacyBundleTokensFromFiles(lookup, rows, lookupFiles);
      if (!tokens.length) {
        tokens = collectLegacyBundleTokensFromManifest(rows, entryMeta?.manifestBundleTokens || null);
      }
      if (!tokens.length) {
        tokens = collectLegacyBundleTokens(lookup, row?.nodes);
      }
      if (!lookup || !tokens.length) continue;
      if (typeof onTick === 'function') {
        onTick({
          stage: 'request',
          lookup,
          index,
          total: safeSelections.length,
        });
      }
      const result = await requestLookupBundle({
        token,
        lookup,
        tokens,
        onTick: (detail = {}) => {
          if (typeof onTick !== 'function') return;
          onTick({
            stage: 'poll',
            lookup,
            index,
            total: safeSelections.length,
            ...detail,
          });
        },
      });
      out.push({
        lookup,
        ...result,
      });
    }
    return out;
  }

  // Trigger a download/open WITHOUT ever navigating the current tab — navigating
  // away would discard the bag. Bundles are served by the worker as a streamed
  // attachment, so an anchor click downloads in place; if a popup is blocked we
  // still never replace the current document.
  function openSignedUrl(url) {
    const href = toText(url).trim();
    if (!href) return false;
    const win = window.open(href, '_blank', 'noopener');
    if (win) return true;
    try {
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.target = '_blank';
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return true;
    } catch (error) {
      return false;
    }
  }

  // Each file downloads on its own (the worker streams one Drive file per signed URL —
  // no merged zip, so multi-hundred-MB WAVs aren't truncated). Trigger them via anchor
  // clicks rather than window.open so we don't spawn a tab per file, staggered so the
  // browser doesn't drop rapid-fire downloads.
  function triggerAnchorDownload(href, filename) {
    try {
      const anchor = document.createElement('a');
      anchor.href = href;
      const name = toText(filename).trim();
      if (name) anchor.download = name;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return true;
    } catch {
      return false;
    }
  }

  const DOWNLOAD_STAGGER_MS = 320;

  // Fire each per-file download, staggered, reporting progress as each starts and
  // resolving once the last one has been triggered.
  function openDownloadList(downloads = [], onProgress = null) {
    const list = (Array.isArray(downloads) ? downloads : [])
      .map((item) => ({ name: toText(item?.name).trim(), href: toText(item?.signedUrl || item?.url || item?.downloadUrl).trim() }))
      .filter((item) => item.href);
    if (!list.length) return Promise.resolve({ opened: 0, total: 0 });
    const total = list.length;
    return new Promise((resolve) => {
      let started = 0;
      const fire = (item) => {
        triggerAnchorDownload(item.href, item.name);
        started += 1;
        if (typeof onProgress === 'function') {
          try { onProgress(started, total); } catch {}
        }
        if (started >= total) resolve({ opened: total, total });
      };
      list.forEach((item, index) => {
        if (index === 0) fire(item);
        else window.setTimeout(() => fire(item), index * DOWNLOAD_STAGGER_MS);
      });
    });
  }

  function ensureBagToastHost() {
    let host = document.getElementById('dx-bag-toast-host');
    if (!(host instanceof HTMLElement)) {
      host = document.createElement('div');
      host.id = 'dx-bag-toast-host';
      document.body.appendChild(host);
    }
    return host;
  }

  // Glassy completion toast in the dex accent. Click to dismiss; auto-dismisses on a
  // depleting accent timer line.
  function showBagToast({ title = 'Done', detail = '', duration = 5200 } = {}) {
    const host = ensureBagToastHost();
    const toast = document.createElement('div');
    toast.className = 'dx-toast';
    toast.setAttribute('role', 'status');
    const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    toast.innerHTML = `
      <span class="dx-toast-title">${icon}<span>${htmlEscape(title)}</span></span>
      ${detail ? `<span class="dx-toast-detail">${htmlEscape(detail)}</span>` : ''}
      <span class="dx-toast-timer" style="animation-duration:${Math.max(1200, Number(duration) || 5200)}ms"></span>
    `;
    host.appendChild(toast);
    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      window.clearTimeout(timer);
      toast.classList.add('is-leaving');
      window.setTimeout(() => toast.remove(), 380);
    };
    toast.addEventListener('click', dismiss);
    const timer = window.setTimeout(dismiss, Math.max(1200, Number(duration) || 5200));
    return dismiss;
  }

  function readResumeAction() {
    try {
      const raw = window.sessionStorage.getItem(RESUME_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function writeResumeAction(action) {
    try {
      window.sessionStorage.setItem(RESUME_KEY, JSON.stringify(action || {}));
    } catch {}
  }

  function clearResumeAction() {
    try {
      window.sessionStorage.removeItem(RESUME_KEY);
    } catch {}
  }

  function ensureBagRouteClasses() {
    if (!(document.body instanceof HTMLElement)) return;
    document.body.classList.add('dx-entry-page', BAG_ROUTE_CLASS, PROFILE_SHOW_MESH_ROUTE_CLASS);
  }

  function installBagRouteClassGuard() {
    if (!(document.body instanceof HTMLElement)) return;
    if (window.__dxBagRouteClassGuardInstalled) return;
    window.__dxBagRouteClassGuardInstalled = true;
    const required = ['dx-entry-page', BAG_ROUTE_CLASS, PROFILE_SHOW_MESH_ROUTE_CLASS];
    const enforce = () => {
      document.body.classList.add(...required);
    };
    enforce();
    const observer = new MutationObserver(() => {
      const missing = required.some((className) => !document.body.classList.contains(className));
      if (missing) enforce();
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('beforeunload', () => observer.disconnect(), { once: true });
  }

  async function ensureSharedMeshBackdropElements() {
    if (!(document.body instanceof HTMLElement)) return;
    const hasGradient = document.getElementById('scroll-gradient-bg') instanceof HTMLElement;
    const hasMesh = document.getElementById('gooey-mesh-wrapper') instanceof HTMLElement;
    const persistentMeshDriver = window.__dxDisableRouteGooeyBootstrap === true;
    const hasMeshStyle = persistentMeshDriver
      || document.querySelector(`style[${SHARED_MESH_STYLE_ATTR}]`) instanceof HTMLStyleElement;
    const hasMeshBootstrap = persistentMeshDriver
      || document.querySelector(`script[${SHARED_MESH_BOOTSTRAP_ATTR}]`) instanceof HTMLScriptElement;
    if (hasGradient && hasMesh && hasMeshStyle && hasMeshBootstrap) return;

    for (const path of SHARED_MESH_TEMPLATE_PATHS) {
      const templatePath = toText(path).trim();
      if (!templatePath) continue;
      try {
        const response = await fetch(templatePath, {
          credentials: 'same-origin',
          headers: { accept: 'text/html,*/*;q=0.9' },
        });
        const contentType = toText(response.headers.get('content-type')).toLowerCase();
        if (!response.ok || !contentType.includes('text/html')) continue;
        const html = await response.text();
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        if (!(parsed?.body instanceof HTMLElement)) continue;

        for (const backdropId of ['scroll-gradient-bg', 'gooey-mesh-wrapper']) {
          if (document.getElementById(backdropId)) continue;
          const sourceNode = parsed.getElementById(backdropId);
          if (!(sourceNode instanceof HTMLElement)) continue;
          const clone = document.importNode(sourceNode, true);
          if (document.body.firstChild) document.body.insertBefore(clone, document.body.firstChild);
          else document.body.appendChild(clone);
        }

        if (!persistentMeshDriver && !(document.querySelector(`style[${SHARED_MESH_STYLE_ATTR}]`) instanceof HTMLStyleElement)) {
          const meshStyles = Array.from(parsed.querySelectorAll('style')).filter((styleNode) => {
            if (!(styleNode instanceof HTMLStyleElement)) return false;
            const content = toText(styleNode.textContent);
            return content.includes('#scroll-gradient-bg')
              && content.includes('#gooey-mesh-wrapper')
              && content.includes('.gooey-blob');
          });
          if (meshStyles.length) {
            const merged = meshStyles.map((styleNode) => toText(styleNode.textContent)).join('\n\n');
            const runtimeStyle = document.createElement('style');
            runtimeStyle.setAttribute(SHARED_MESH_STYLE_ATTR, 'bag');
            runtimeStyle.textContent = merged;
            document.head.appendChild(runtimeStyle);
          }
        }

        if (!persistentMeshDriver && !document.querySelector(`script[${SHARED_MESH_BOOTSTRAP_ATTR}]`)) {
          const meshBootstrap = Array.from(parsed.querySelectorAll('script')).find((script) => {
            if (!(script instanceof HTMLScriptElement)) return false;
            const content = toText(script.textContent);
            return content.includes('#gooey-mesh-wrapper .gooey-blob')
              && content.includes("document.getElementById('scroll-gradient-bg')")
              && content.includes('requestAnimationFrame');
          });
          if (meshBootstrap instanceof HTMLScriptElement) {
            const runtime = document.createElement('script');
            runtime.setAttribute(SHARED_MESH_BOOTSTRAP_ATTR, 'bag');
            runtime.textContent = toText(meshBootstrap.textContent);
            document.body.appendChild(runtime);
          }
        }

        const ready = document.getElementById('scroll-gradient-bg') instanceof HTMLElement
          && document.getElementById('gooey-mesh-wrapper') instanceof HTMLElement
          && (persistentMeshDriver
            || document.querySelector(`style[${SHARED_MESH_STYLE_ATTR}]`) instanceof HTMLStyleElement)
          && (persistentMeshDriver
            || document.querySelector(`script[${SHARED_MESH_BOOTSTRAP_ATTR}]`) instanceof HTMLScriptElement);
        if (ready) return;
      } catch {}
    }
  }

  function mount() {
    ensureBagRouteClasses();
    installBagRouteClassGuard();
    void ensureSharedMeshBackdropElements();
    ensureBreadcrumbMotionRuntime();
    window.addEventListener('dex:breadcrumb-motion-ready', mountBreadcrumbMotion);

    const root = document.getElementById(ROOT_ID);
    if (!(root instanceof HTMLElement)) return;
    const bagApi = window.__dxBag;
    if (!bagApi || typeof bagApi.list !== 'function' || typeof bagApi.removeSelection !== 'function') {
      root.innerHTML = '<section class="dx-bag-shell"><p class="dx-bag-note">Bag runtime unavailable.</p></section>';
      return;
    }

    const state = {
      auth: { auth: null, authenticated: false, token: '', user: null },
      rows: bagApi.list(),
      filesByLookup: new Map(),
      entryMetaByLookup: new Map(),
      catalogIndex: { byLookup: new Map(), byEntryHref: new Map() },
      error: '',
      busy: '',
      status: '',
      expandedReceipts: new Set(),
      localViewerMode: isLocalViewerRoute(),
      backCrumb: resolveBackCrumb(),
      summaryDisplay: null,
      summaryTweenToken: 0,
      progress: null,
    };
    const PROGRESS_PHASE_LABELS = Object.freeze({
      resolving: 'RESOLVING',
      requesting: 'REQUESTING',
      sending: 'SENDING',
      done: 'COMPLETE',
      preparing: 'PREPARING',
    });
    const BAG_MOTION = Object.freeze({
      visualDurationMs: 320,
      collapseDurationMs: 420,
      collapseSettleMs: 90,
      flipDurationMs: 460,
      summaryCountDurationMs: 640,
      summarySizeSwapDurationMs: 300,
    });
    let suppressBagUpdates = false;

    const setFetchState = (value) => {
      root.setAttribute('data-dx-fetch-state', value);
      if (value === 'loading') root.setAttribute('aria-busy', 'true');
      else root.removeAttribute('aria-busy');
    };

    const renderProgressMarkup = (progress) => {
      const safe = progress && typeof progress === 'object' ? progress : {};
      const phase = toText(safe.phase || 'preparing').trim() || 'preparing';
      const indeterminate = Boolean(safe.indeterminate);
      const ratio = Math.max(0, Math.min(1, Number(safe.ratio) || 0));
      const phaseLabel = PROGRESS_PHASE_LABELS[phase] || 'PREPARING';
      const detail = htmlEscape(toText(safe.detail || ''));
      const width = phase === 'done' ? 100 : Math.round(ratio * 100);
      return `
        <div class="dx-bag-progress" data-bag-progress data-phase="${htmlEscape(phase)}" data-indeterminate="${indeterminate ? 'true' : 'false'}" role="status" aria-live="polite">
          <div class="dx-bag-progress-meta">
            <span class="dx-bag-progress-phase" data-bag-progress-phase>${htmlEscape(phaseLabel)}</span>
            <span class="dx-bag-progress-detail" data-bag-progress-detail>${detail}</span>
          </div>
          <div class="dx-bag-progress-track"><span class="dx-bag-progress-fill" data-bag-progress-fill style="width:${width}%"></span></div>
        </div>
      `;
    };

    // Update the inflight progress UI in place — never re-renders the whole bag (which
    // would re-fetch every card thumbnail and restart animations on each tick).
    const setProgress = (next = {}) => {
      const merged = { ...(state.progress || {}), ...next };
      state.progress = merged;
      const wrap = root.querySelector('[data-bag-progress]');
      if (!(wrap instanceof HTMLElement)) {
        render();
        return;
      }
      const phase = toText(merged.phase || 'preparing').trim() || 'preparing';
      wrap.setAttribute('data-phase', phase);
      wrap.setAttribute('data-indeterminate', merged.indeterminate ? 'true' : 'false');
      const phaseEl = wrap.querySelector('[data-bag-progress-phase]');
      const detailEl = wrap.querySelector('[data-bag-progress-detail]');
      const fillEl = wrap.querySelector('[data-bag-progress-fill]');
      if (phaseEl) phaseEl.textContent = PROGRESS_PHASE_LABELS[phase] || 'PREPARING';
      if (detailEl) detailEl.textContent = toText(merged.detail || '');
      if (fillEl instanceof HTMLElement && !merged.indeterminate && Number.isFinite(Number(merged.ratio))) {
        fillEl.style.width = `${Math.max(0, Math.min(1, Number(merged.ratio))) * 100}%`;
      }
    };

    const clearBagAfterDownload = () => {
      suppressBagUpdates = true;
      try {
        bagApi.clear();
      } finally {
        suppressBagUpdates = false;
      }
      state.filesByLookup.clear();
      state.entryMetaByLookup.clear();
      state.expandedReceipts.clear();
      state.progress = null;
      state.busy = '';
      state.error = '';
      state.status = '';
      refreshRows();
      render();
    };

    const groupedRows = () => {
      const byLookup = new Map();
      for (const row of state.rows) {
        const lookup = normalizeLookup(row.lookup);
        if (!lookup) continue;
        if (!byLookup.has(lookup)) byLookup.set(lookup, []);
        byLookup.get(lookup).push(row);
      }
      return Array.from(byLookup.entries()).sort((a, b) => {
        const latestA = Math.max(...a[1].map((row) => parseDateMs(row?.updatedAt || row?.addedAt) || 0));
        const latestB = Math.max(...b[1].map((row) => parseDateMs(row?.updatedAt || row?.addedAt) || 0));
        if (latestA !== latestB) return latestB - latestA;
        return a[0].localeCompare(b[0]);
      });
    };

    const collectSelectionsPayload = () => groupedRows().map(([lookup, rows]) => ({
      lookup,
      nodes: rows.map((row) => ({
        kind: row.kind,
        lookup,
        bucket: row.bucket || '',
        mediaType: row.mediaType || '',
        mediaTypes: Array.isArray(row.mediaTypes) ? row.mediaTypes.slice() : [],
        fileId: row.fileId || '',
      })),
    }));

    const removeLookupSelections = (lookup) => {
      const keys = state.rows
        .filter((row) => normalizeLookup(row.lookup) === lookup)
        .map((row) => toText(row.key).trim())
        .filter(Boolean);
      if (!keys.length) return;
      keys.forEach((key) => bagApi.removeSelection(key));
      state.expandedReceipts.delete(lookup);
    };

    const getLatestRow = (rows = []) => rows
      .slice()
      .sort((a, b) => parseDateMs(b?.updatedAt || b?.addedAt) - parseDateMs(a?.updatedAt || a?.addedAt))[0] || null;

    const resolveLookupEntryMeta = async () => {
      const groups = groupedRows();
      await Promise.all(groups.map(async ([lookup, rows]) => {
        if (state.entryMetaByLookup.has(lookup)) return;
        const latestRow = getLatestRow(rows);
        const entryHref = normalizePath(latestRow?.entryHref || '');
        if (!entryHref) {
          state.entryMetaByLookup.set(lookup, null);
          return;
        }
        const html = await requestEntryHtml(entryHref);
        if (!html) {
          state.entryMetaByLookup.set(lookup, null);
          return;
        }
        const parsed = parseEntryMetaFromHtml(html, entryHref);
        if (!parsed) {
          state.entryMetaByLookup.set(lookup, null);
          return;
        }
        state.entryMetaByLookup.set(lookup, {
          title: toText(parsed.title).trim(),
          lookup: normalizeLookup(parsed.lookup),
          thumbnailSrc: toAbsoluteUrl(parsed.thumbnailSrc, entryHref),
          canonicalHref: normalizePath(parsed.canonicalHref || ''),
          bucketFileStats: parsed.bucketFileStats || null,
        });
      }));
    };

    const resolveCatalogIndex = async () => {
      if (state.catalogIndex.byLookup.size || state.catalogIndex.byEntryHref.size) return;
      state.catalogIndex = await requestCatalogEntriesIndex();
    };

    const computeGroupModel = (lookup, rows) => {
      const files = state.filesByLookup.get(lookup) || [];
      const entryMeta = state.entryMetaByLookup.get(lookup) || null;
      const expandedFiles = expandSelectionsForLookup(rows, files);
      const hasResolvedLookupFiles = files.length > 0;
      const estimatedBytesFromFiles = expandedFiles.reduce((sum, file) => sum + parseFiniteSizeBytes(file?.sizeBytes), 0);
      const estimatedBytesFromFileTypes = estimateBytesFromLookupFiles(expandedFiles);
      const estimatedBytesFromStats = hasResolvedLookupFiles ? 0 : estimateBytesFromBucketStats(rows, entryMeta?.bucketFileStats || null);
      const estimatedBytesFromRows = estimateBytesFromSelectionRows(rows);
      const estimatedBytes = estimatedBytesFromFiles
        || estimatedBytesFromFileTypes
        || estimatedBytesFromStats
        || estimatedBytesFromRows;
      const receiptLines = buildReceiptLines(lookup, rows, files, entryMeta?.bucketFileStats || null);
      const latestRow = getLatestRow(rows);
      const bucketStatsCount = hasResolvedLookupFiles ? 0 : countFilesFromBucketStats(rows, entryMeta?.bucketFileStats || null);
      const selectedRowsCount = countFilesFromSelectionRows(rows);
      const resolvedCount = expandedFiles.length || bucketStatsCount || selectedRowsCount;
      const entryHref = normalizePath(
        latestRow?.entryHref
        || entryMeta?.canonicalHref
        || ''
      );
      const thumbnailFromCatalog = resolveCatalogThumbnail(state.catalogIndex, lookup, entryHref);
      return {
        lookup,
        title: resolveCardTitle(rows, lookup, entryMeta),
        scopeSummary: summarizeSelection(rows),
        resolvedCount,
        estimatedBytes,
        receiptLines,
        entryHref,
        thumbnailSrc: toAbsoluteUrl(thumbnailFromCatalog || entryMeta?.thumbnailSrc || '', window.location.origin),
      };
    };

    const animateSummaryCounters = (nextSummary) => {
      const entriesNode = root.querySelector('[data-bag-stat="entries"]');
      const unitsNode = root.querySelector('[data-bag-stat="units"]');
      const filesNode = root.querySelector('[data-bag-stat="files"]');
      const sizeNode = root.querySelector('[data-bag-estimated-size]');
      if (!(entriesNode instanceof HTMLElement) || !(unitsNode instanceof HTMLElement) || !(filesNode instanceof HTMLElement)) return;
      if (!(sizeNode instanceof HTMLElement)) return;

      const reduced = prefersReducedMotion();
      const prev = state.summaryDisplay;
      const next = {
        entries: toCountInt(nextSummary?.entries),
        units: toCountInt(nextSummary?.units),
        files: toCountInt(nextSummary?.files),
        estimatedSize: toText(nextSummary?.estimatedSize).trim() || '\u2014',
      };

      if (!prev || reduced) {
        entriesNode.textContent = String(next.entries);
        unitsNode.textContent = String(next.units);
        filesNode.textContent = String(next.files);
        sizeNode.textContent = next.estimatedSize;
        state.summaryDisplay = next;
        state.summaryTweenToken += 1;
        return;
      }

      state.summaryTweenToken += 1;
      const tweenToken = state.summaryTweenToken;
      const durationMs = Math.max(200, Number(BAG_MOTION.summaryCountDurationMs) || 640);
      const start = performance.now();
      const easeInOutCubic = (t) => (t < 0.5
        ? 4 * t * t * t
        : 1 - ((-2 * t + 2) ** 3) / 2);

      const from = {
        entries: toCountInt(prev.entries),
        units: toCountInt(prev.units),
        files: toCountInt(prev.files),
      };

      const tick = (now) => {
        if (tweenToken !== state.summaryTweenToken) return;
        const progress = Math.max(0, Math.min((now - start) / durationMs, 1));
        const eased = easeInOutCubic(progress);
        const currentEntries = Math.round(from.entries + ((next.entries - from.entries) * eased));
        const currentUnits = Math.round(from.units + ((next.units - from.units) * eased));
        const currentFiles = Math.round(from.files + ((next.files - from.files) * eased));
        entriesNode.textContent = String(currentEntries);
        unitsNode.textContent = String(currentUnits);
        filesNode.textContent = String(currentFiles);
        if (progress < 1) {
          window.requestAnimationFrame(tick);
          return;
        }
        entriesNode.textContent = String(next.entries);
        unitsNode.textContent = String(next.units);
        filesNode.textContent = String(next.files);
      };
      window.requestAnimationFrame(tick);

      if (toText(prev.estimatedSize) !== next.estimatedSize) {
        sizeNode.textContent = next.estimatedSize;
        sizeNode.style.setProperty('--dx-bag-size-swap-ms', `${Math.max(160, Number(BAG_MOTION.summarySizeSwapDurationMs) || 300)}ms`);
        sizeNode.classList.remove('is-swapping');
        void sizeNode.offsetWidth;
        sizeNode.classList.add('is-swapping');
      }

      state.summaryDisplay = next;
    };

    const syncSummaryCardHeight = () => {
      const summaryCard = root.querySelector('.dx-bag-summary');
      if (!(summaryCard instanceof HTMLElement)) return;
      summaryCard.style.removeProperty('height');
      summaryCard.style.removeProperty('min-height');
      summaryCard.style.removeProperty('max-height');

      const isDesktop = typeof window.matchMedia === 'function'
        ? window.matchMedia('(min-width: 981px)').matches
        : true;
      if (!isDesktop) return;

      const firstCardShell = root.querySelector('.dx-bag-card-shell');
      if (!(firstCardShell instanceof HTMLElement)) return;
      const firstCard = firstCardShell.querySelector('.dx-bag-card');
      const measureNode = firstCard instanceof HTMLElement ? firstCard : firstCardShell;
      const measuredHeight = Math.ceil(measureNode.getBoundingClientRect().height);
      if (!Number.isFinite(measuredHeight) || measuredHeight <= 0) return;

      const pixelHeight = `${measuredHeight}px`;
      summaryCard.style.height = pixelHeight;
      summaryCard.style.minHeight = pixelHeight;
      summaryCard.style.maxHeight = pixelHeight;
    };

    const render = () => {
      const lookupGroups = groupedRows();
      const models = lookupGroups.map(([lookup, rows]) => computeGroupModel(lookup, rows));
      const selectedLookupCount = models.length;
      const selectedFileCount = models.reduce((sum, model) => sum + model.resolvedCount, 0);
      const selectedUnitCount = models.reduce((sum, model) => sum + (model.receiptLines.length || 0), 0);
      const estimatedBytes = models.reduce((sum, model) => sum + model.estimatedBytes, 0);
      const backHref = toText(state.backCrumb?.href || BREADCRUMB_FALLBACK_HREF).trim() || BREADCRUMB_FALLBACK_HREF;
      const backLabel = toText(state.backCrumb?.label || 'catalog').trim() || 'catalog';
      const signedLabel = BAG_DESCRIPTION_COPY;
      const statusText = htmlEscape(state.error || state.status || '');
      const downloadHeading = 'DOWNLOAD BAG';
      const summaryHeading = 'BAG SUM\u200CMARY';

      const cardMarkup = models.map((model) => {
        const expanded = state.expandedReceipts.has(model.lookup);
        const totalLines = model.receiptLines.length;
        const hiddenCount = Math.max(0, totalLines - RECEIPT_VISIBLE_LIMIT);
        const visibleLines = expanded ? model.receiptLines : model.receiptLines.slice(0, RECEIPT_VISIBLE_LIMIT);
        const editIcon = `
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="dx-bag-control-glyph dx-bag-control-glyph--edit" aria-hidden="true" focusable="false">
            <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
          </svg>
        `;
        const removeIcon = `
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="dx-bag-control-glyph dx-bag-control-glyph--remove" aria-hidden="true" focusable="false">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6 6 18" />
          </svg>
        `;
        const receiptItems = visibleLines.map((line, lineIndex) => {
          const text = htmlEscape(line?.text || '');
          const count = toCountInt(line?.count);
          const keys = Array.isArray(line?.keys) ? line.keys.map((key) => toText(key).trim()).filter(Boolean) : [];
          const encodedKeys = htmlEscape(JSON.stringify(keys));
          const lineId = htmlEscape(`${model.lookup}::${keys.join('|') || toText(line?.text).trim() || lineIndex}`);
          const countSuffix = count > 0 ? `<span class="dx-bag-receipt-count">\u2022 ${count} file${count === 1 ? '' : 's'}</span>` : '';
          const removeLineBtn = keys.length
            ? `<button type="button" class="dx-bag-receipt-remove" data-bag-remove-line="${encodedKeys}" aria-label="Remove receipt item">${removeIcon}</button>`
            : '';
          return `<li data-bag-line-id="${lineId}"><span class="dx-bag-receipt-line-wrap"><span class="dx-bag-receipt-line">${text}</span>${countSuffix}</span>${removeLineBtn}</li>`;
        }).join('');
        const showMore = hiddenCount > 0
          ? `<button type="button" class="dx-bag-receipt-toggle" data-bag-toggle-receipt="${htmlEscape(model.lookup)}">${expanded ? 'Show Less' : `Show All (${hiddenCount} more)`}</button>`
          : '';
        const thumbnailMarkup = model.thumbnailSrc
          ? `<a class="dx-bag-card-thumb" href="${htmlEscape(model.entryHref || '#')}" ${model.entryHref ? '' : 'aria-disabled="true" tabindex="-1"'}><img src="${htmlEscape(model.thumbnailSrc)}" alt="${htmlEscape(`${model.title} preview`)}" loading="lazy" decoding="async"></a>`
          : '';

        return `
          <div class="dx-bag-card-shell" data-bag-lookup="${htmlEscape(model.lookup)}">
            <article class="dx-bag-card">
              <header class="dx-bag-card-head">
                <div class="dx-bag-card-ident">
                  <h3 data-bag-heading="card-title" data-bag-heading-seed="${htmlEscape(`bag:card-title:${model.lookup}`)}" data-bag-heading-canonical="${htmlEscape(model.title)}">${htmlEscape(model.title)}</h3>
                  <p>${htmlEscape(model.lookup)}</p>
                </div>
                <div class="dx-bag-card-controls">
                  <div class="dx-bag-card-actions">
                    <button type="button" class="dx-button-element dx-button-size--sm dx-button-element--secondary dx-bag-icon-btn" data-bag-edit="${htmlEscape(model.lookup)}" aria-label="Edit selection" ${model.entryHref ? '' : 'disabled'}>${editIcon}</button>
                    <button type="button" class="dx-button-element dx-button-size--sm dx-button-element--secondary dx-bag-icon-btn" data-bag-remove-lookup="${htmlEscape(model.lookup)}" aria-label="Remove selection">${removeIcon}</button>
                  </div>
                </div>
              </header>
              <div class="dx-bag-card-main">
                <p class="dx-bag-scope">${htmlEscape(model.scopeSummary)}</p>
                <p class="dx-bag-count">${htmlEscape(`${model.resolvedCount} file${model.resolvedCount === 1 ? '' : 's'} in download`)}</p>
                <div class="dx-bag-card-receipt-row">
                  <ol class="dx-bag-receipt">${receiptItems || '<li><span class="dx-bag-receipt-line">No receipt lines.</span></li>'}</ol>
                  ${thumbnailMarkup}
                </div>
                ${showMore}
              </div>
            </article>
          </div>
        `;
      }).join('');

      root.innerHTML = `
        <section class="dx-bag-shell">
          <header class="dx-bag-head">
            <div class="dex-breadcrumb-overlay" data-dex-breadcrumb-overlay="">
              <div class="dex-breadcrumb" data-dex-breadcrumb="">
                <a class="dex-breadcrumb-back" href="${htmlEscape(backHref)}" data-dex-breadcrumb-back="">${htmlEscape(backLabel)}</a>
                <span class="dex-breadcrumb-delimiter" data-dex-breadcrumb-delimiter="" aria-hidden="true">
                  <svg class="dex-breadcrumb-icon" viewBox="0 0 24 24" width="24" height="24" focusable="false" aria-hidden="true">
                    <path data-dex-breadcrumb-path="" d="M12 1.75L19.85 12L12 22.25L4.15 12Z"></path>
                  </svg>
                </span>
                <span class="dex-breadcrumb-current">bag</span>
              </div>
            </div>
            <h1 data-bag-heading="download" data-bag-heading-seed="bag:h1:download" data-bag-heading-canonical="${htmlEscape(downloadHeading)}">${htmlEscape(downloadHeading)}</h1>
            <p class="dx-bag-note">${signedLabel}</p>
          </header>

          <div class="dx-bag-layout">
            <section class="dx-bag-list" aria-live="polite">
              ${cardMarkup || '<p class="dx-bag-note">No saved selections yet. Use FILES from any entry sidebar.</p>'}
            </section>

            <aside class="dx-bag-summary">
              <div class="dx-bag-summary-block">
                <h2 data-bag-heading="summary" data-bag-heading-seed="bag:h2:summary" data-bag-heading-canonical="${htmlEscape(summaryHeading)}">${htmlEscape(summaryHeading)}</h2>
                <div class="dx-bag-stats">
                  <span><strong data-bag-stat="entries">${selectedLookupCount}</strong> entries</span>
                  <span><strong data-bag-stat="units">${selectedUnitCount}</strong> units</span>
                  <span><strong data-bag-stat="files">${selectedFileCount}</strong> files</span>
                  <span><strong data-bag-estimated-size>${htmlEscape(formatEstimatedSize(estimatedBytes, selectedFileCount))}</strong> estimated size</span>
                </div>
              </div>
              <div class="dx-bag-actions">
                <button type="button" class="dx-button-element dx-button-size--sm dx-button-element--secondary" data-bag-clear ${state.rows.length && !state.busy ? '' : 'disabled'}>CLEAR</button>
                <button type="button" class="dx-button-element dx-button-size--sm dx-button-element--primary${state.busy ? ' is-busy' : ''}" data-bag-download ${state.rows.length ? '' : 'disabled'}>${htmlEscape(state.busy ? 'PREPARING…' : 'DOWNLOAD BAG')}</button>
              </div>
              ${state.busy === 'download' ? renderProgressMarkup(state.progress) : ''}
            </aside>
          </div>

          ${!state.busy && statusText ? `<p class="dx-bag-status" data-tone="${state.error ? 'error' : 'info'}">${statusText}</p>` : ''}
        </section>
      `;

      const applyBagHeadingRandomization = () => {
        root.querySelectorAll('[data-bag-heading]').forEach((heading) => {
          if (!(heading instanceof HTMLElement)) return;
          const canonical = toText(heading.getAttribute('data-bag-heading-canonical') || heading.textContent || '');
          if (!canonical) return;
          const seedKey = toText(heading.getAttribute('data-bag-heading-seed') || '').trim();
          let rendered = renderJoinedRandomizedHeading(canonical, { seedKey });
          if (toText(heading.getAttribute('data-bag-heading')) === 'summary') {
            rendered = enforceSummarySeparator(rendered);
          }
          heading.textContent = rendered;
          heading.setAttribute('data-dx-heading-rendered', rendered);
        });
      };

      applyBagHeadingRandomization();
      window.requestAnimationFrame(() => {
        applyBagHeadingRandomization();
        window.requestAnimationFrame(() => applyBagHeadingRandomization());
      });
      animateSummaryCounters({
        entries: selectedLookupCount,
        units: selectedUnitCount,
        files: selectedFileCount,
        estimatedSize: formatEstimatedSize(estimatedBytes, selectedFileCount),
      });

      mountBreadcrumbMotion();
      syncSummaryCardHeight();
    };

    const refreshRows = () => {
      state.rows = bagApi.list();
    };

    const ensureAuthForAction = async (resumePayload) => {
      state.auth = await resolveAuthSnapshot();
      if (state.auth.authenticated && state.auth.token) return true;
      if (state.localViewerMode) {
        const action = toText(resumePayload?.action).trim().toLowerCase();
        if (action && action !== 'open-bag') {
          state.error = 'Sign in is disabled in local /view mode. Use /entry/bag for secure download actions.';
          render();
        }
        return false;
      }
      const auth = state.auth.auth;
      if (!auth || typeof auth.signIn !== 'function') {
        state.error = 'Sign-in runtime unavailable.';
        render();
        return false;
      }
      writeResumeAction(resumePayload);
      try {
        await auth.signIn(BAG_ROUTE_PATH);
      } catch {
        state.error = 'Unable to start sign-in.';
        render();
      }
      return false;
    };

    const resolveLookupFiles = async () => {
      if (!state.auth.authenticated || !state.auth.token) return;
      const groups = groupedRows();
      await Promise.all(groups.map(async ([lookup]) => {
        if (state.filesByLookup.has(lookup)) return;
        try {
          const payload = await requestJson(`/me/assets/${encodeURIComponent(lookup)}`, {
            token: state.auth.token,
          });
          state.filesByLookup.set(lookup, normalizeLookupFiles(payload, lookup));
        } catch (error) {
          if (toText(error?.code) === 'forbidden') {
            state.filesByLookup.set(lookup, []);
            return;
          }
          state.filesByLookup.set(lookup, []);
        }
      }));
    };

    const pruneLookupCaches = () => {
      const activeLookups = new Set(groupedRows().map(([lookup]) => lookup));
      Array.from(state.filesByLookup.keys()).forEach((lookup) => {
        if (!activeLookups.has(lookup)) state.filesByLookup.delete(lookup);
      });
      Array.from(state.entryMetaByLookup.keys()).forEach((lookup) => {
        if (!activeLookups.has(lookup)) state.entryMetaByLookup.delete(lookup);
      });
    };

    const hydrateLookupData = async () => {
      await Promise.all([
        resolveCatalogIndex(),
        resolveLookupFiles(),
        resolveLookupEntryMeta(),
      ]);
    };

    const executeDownload = async () => {
      refreshRows();
      if (!state.rows.length) {
        state.status = 'Bag is empty.';
        render();
        return;
      }

      if (state.localViewerMode && (!state.auth.authenticated || !state.auth.token)) {
        state.error = 'Download is unavailable in local /view mode. Open /entry/bag after signing in.';
        render();
        return;
      }

      const permitted = await ensureAuthForAction({ action: 'download' });
      if (!permitted) return;

      state.busy = 'download';
      state.error = '';
      state.status = '';
      state.progress = { phase: 'resolving', indeterminate: true, detail: 'reading selection' };
      let startedCount = 0;
      render();

      try {
        await resolveLookupFiles();
        await resolveLookupEntryMeta();
        const selections = collectSelectionsPayload();
        setProgress({ phase: 'requesting', indeterminate: true, detail: 'minting secure links' });
        try {
          const payload = await requestBagBundle({
            token: state.auth.token,
            selections,
          });
          const hintedCount = parseBundleHintCount(payload);
          if (hintedCount === 0 && selections.length) {
            const err = new Error('empty bundle');
            err.code = 'empty';
            throw err;
          }
          const delivery = toText(payload?.delivery).toLowerCase();

          if (delivery === 'multi') {
            const downloads = parseBundleDownloads(payload);
            if (!downloads.length) throw createCodedError('empty', 'no downloads');
            setProgress({ phase: 'sending', indeterminate: false, ratio: 0, detail: `0 / ${downloads.length}` });
            const result = await openDownloadList(downloads, (done, total) => {
              setProgress({ phase: 'sending', indeterminate: false, ratio: total ? done / total : 1, detail: `${done} / ${total}` });
            });
            startedCount = result.total;
          } else if (delivery === 'sync') {
            const signedUrl = getBundleSignedUrl(payload);
            if (!signedUrl) throw new Error('missing signed url');
            setProgress({ phase: 'sending', indeterminate: false, ratio: 1, detail: '1 / 1' });
            openSignedUrl(signedUrl);
            startedCount = 1;
          } else if (delivery === 'async') {
            const result = await pollBundleJob({
              token: state.auth.token,
              jobId: getBundleJobId(payload),
              onTick: ({ payload: pollPayload = null } = {}) => {
                const hint = parseBundleHintCount(pollPayload);
                setProgress({ phase: 'requesting', indeterminate: true, detail: hint > 0 ? `staging ${hint} file${hint === 1 ? '' : 's'}` : 'staging bundle' });
              },
            });
            setProgress({ phase: 'sending', indeterminate: false, ratio: 1, detail: '1 / 1' });
            openSignedUrl(getBundleSignedUrl(result));
            startedCount = 1;
          } else {
            const ready = resolveBundleReadyPayload(payload);
            if (ready) {
              setProgress({ phase: 'sending', indeterminate: false, ratio: 1, detail: '1 / 1' });
              openSignedUrl(ready.signedUrl);
              startedCount = 1;
            } else if (getBundleJobId(payload)) {
              const result = await pollBundleJob({
                token: state.auth.token,
                jobId: getBundleJobId(payload),
                onTick: ({ payload: pollPayload = null } = {}) => {
                  const hint = parseBundleHintCount(pollPayload);
                  setProgress({ phase: 'requesting', indeterminate: true, detail: hint > 0 ? `staging ${hint} file${hint === 1 ? '' : 's'}` : 'staging bundle' });
                },
              });
              setProgress({ phase: 'sending', indeterminate: false, ratio: 1, detail: '1 / 1' });
              openSignedUrl(getBundleSignedUrl(result));
              startedCount = 1;
            } else {
              throw createCodedError('failed', 'unsupported response');
            }
          }
        } catch (bagError) {
          const bagCode = toText(bagError?.code).toLowerCase();
          if (!shouldFallbackToLookupBundles(bagError)) throw bagError;
          setProgress({ phase: 'requesting', indeterminate: true, detail: 'retrying via lookup links' });
          const fallbackBundles = await requestLegacyBagBundles({
            token: state.auth.token,
            selections,
            filesByLookup: state.filesByLookup,
            entryMetaByLookup: state.entryMetaByLookup,
            onTick: ({ stage = '', index = 0, total = 0, payload: pollPayload = null } = {}) => {
              const safeTotal = Number(total) > 1 ? Number(total) : 0;
              const safeIndex = Number(index) + 1;
              const count = parseBundleHintCount(pollPayload);
              const countLabel = count > 0 ? `${count} file${count === 1 ? '' : 's'}` : (stage === 'poll' ? 'staging' : 'requesting');
              setProgress({
                phase: 'requesting',
                indeterminate: true,
                detail: safeTotal ? `${countLabel} (${safeIndex}/${safeTotal})` : countLabel,
              });
            },
          });
          const downloads = [];
          (Array.isArray(fallbackBundles) ? fallbackBundles : []).forEach((bundle) => {
            const list = parseBundleDownloads(bundle);
            if (list.length) {
              downloads.push(...list);
              return;
            }
            const href = toText(bundle?.signedUrl || bundle?.url || bundle?.downloadUrl).trim();
            if (href) downloads.push({ name: '', signedUrl: href });
          });
          if (!downloads.length) {
            const err = new Error('not-found');
            err.code = 'not-found';
            throw err;
          }
          setProgress({ phase: 'sending', indeterminate: false, ratio: 0, detail: `0 / ${downloads.length}` });
          const openResult = await openDownloadList(downloads, (done, total) => {
            setProgress({ phase: 'sending', indeterminate: false, ratio: total ? done / total : 1, detail: `${done} / ${total}` });
          });
          startedCount = openResult.total;
        }
      } catch (error) {
        if (toText(error?.code) === 'not-found') {
          state.error = 'No bundle route available for current selection.';
        } else if (toText(error?.code) === 'forbidden') {
          state.error = 'Access denied for current selection.';
        } else if (toText(error?.code) === 'timeout' || toText(error?.code) === 'stalled') {
          state.error = 'Bundle is still preparing. Try again in a few minutes; staged work can be reused when it finishes.';
        } else {
          state.error = 'Unable to prepare bag bundle.';
        }
      } finally {
        state.busy = '';
      }

      if (startedCount > 0 && !state.error) {
        // Show the bundle "complete", confirm with a toast, then clear the bag.
        setProgress({ phase: 'done', indeterminate: false, ratio: 1, detail: `${startedCount} file${startedCount === 1 ? '' : 's'}` });
        showBagToast({
          title: startedCount > 1 ? 'Sent to downloads' : 'Download started',
          detail: `${startedCount} file${startedCount === 1 ? '' : 's'} → bag cleared`,
        });
        window.setTimeout(() => clearBagAfterDownload(), 900);
      } else {
        state.progress = null;
        render();
      }
    };

    const resolveBreadcrumbBackStrategy = () => {
      const fallbackHref = normalizePath(state.backCrumb?.href || BREADCRUMB_FALLBACK_HREF) || BREADCRUMB_FALLBACK_HREF;
      try {
        if (!document.referrer || !window.location || !window.location.origin || window.history.length < 2) {
          return { useHistoryBack: false, fallbackHref };
        }
        const ref = new URL(document.referrer, window.location.origin);
        if (ref.origin !== window.location.origin) return { useHistoryBack: false, fallbackHref };
        const previousPath = normalizePath(ref.pathname || '/');
        const currentPath = normalizePath(window.location.pathname || '/');
        if (!previousPath || previousPath === currentPath) return { useHistoryBack: false, fallbackHref };
        return { useHistoryBack: true, fallbackHref };
      } catch {
        return { useHistoryBack: false, fallbackHref };
      }
    };

    root.addEventListener('click', async (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const breadcrumbBack = target.closest('[data-dex-breadcrumb-back]');
      if (breadcrumbBack) {
        const strategy = resolveBreadcrumbBackStrategy();
        if (strategy.useHistoryBack) {
          event.preventDefault();
          window.history.back();
        }
        return;
      }

      const removeLookupButton = target.closest('[data-bag-remove-lookup]');
      const removeLookup = removeLookupButton?.getAttribute('data-bag-remove-lookup');
      if (removeLookup) {
        const cardShell = removeLookupButton?.closest('.dx-bag-card-shell');
        const card = cardShell?.querySelector('.dx-bag-card');
        if (cardShell?.getAttribute('data-removing') === '1') return;
        await animateAndCollapse(cardShell, {
          visualTarget: card,
          visualDurationMs: BAG_MOTION.visualDurationMs,
          collapseDurationMs: BAG_MOTION.collapseDurationMs,
          settleDurationMs: BAG_MOTION.collapseSettleMs,
          easing: 'cubic-bezier(0.22, 0.8, 0.2, 1)',
        });
        const flipBefore = captureFlipState(root, {
          excludeLookups: new Set([removeLookup]),
          excludeLineIds: null,
        });
        suppressBagUpdates = true;
        try {
          removeLookupSelections(removeLookup);
        } finally {
          suppressBagUpdates = false;
        }
        refreshRows();
        pruneLookupCaches();
        state.error = '';
        state.status = '';
        render();
        playFlipState(root, flipBefore, {
          durationMs: BAG_MOTION.flipDurationMs,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        });
        return;
      }

      const toggleLookup = target.closest('[data-bag-toggle-receipt]')?.getAttribute('data-bag-toggle-receipt');
      if (toggleLookup) {
        if (state.expandedReceipts.has(toggleLookup)) state.expandedReceipts.delete(toggleLookup);
        else state.expandedReceipts.add(toggleLookup);
        render();
        return;
      }
      const removeLineButton = target.closest('[data-bag-remove-line]');
      const removeLineRaw = removeLineButton?.getAttribute('data-bag-remove-line');
      if (removeLineRaw) {
        let keys = [];
        try {
          const parsed = JSON.parse(removeLineRaw);
          if (Array.isArray(parsed)) {
            keys = parsed.map((value) => toText(value).trim()).filter(Boolean);
          }
        } catch {}
        if (!keys.length) return;
        const receiptLine = removeLineButton?.closest('li');
        if (receiptLine?.getAttribute('data-removing') === '1') return;
        const lineId = toText(receiptLine?.getAttribute('data-bag-line-id')).trim();
        await animateAndCollapse(receiptLine, {
          visualTarget: receiptLine,
          visualDurationMs: BAG_MOTION.visualDurationMs,
          collapseDurationMs: BAG_MOTION.collapseDurationMs,
          settleDurationMs: BAG_MOTION.collapseSettleMs,
          easing: 'cubic-bezier(0.22, 0.8, 0.2, 1)',
        });
        const flipBefore = captureFlipState(root, {
          excludeLookups: null,
          excludeLineIds: lineId ? new Set([lineId]) : null,
        });
        suppressBagUpdates = true;
        try {
          keys.forEach((key) => bagApi.removeSelection(key));
        } finally {
          suppressBagUpdates = false;
        }
        refreshRows();
        pruneLookupCaches();
        state.error = '';
        state.status = '';
        render();
        playFlipState(root, flipBefore, {
          durationMs: BAG_MOTION.flipDurationMs,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        });
        return;
      }

      const editLookup = target.closest('[data-bag-edit]')?.getAttribute('data-bag-edit');
      if (editLookup) {
        const model = groupedRows().map(([lookup, rows]) => computeGroupModel(lookup, rows)).find((item) => item.lookup === editLookup);
        if (model?.entryHref) {
          window.location.assign(model.entryHref);
        }
        return;
      }

      if (target.closest('[data-bag-clear]')) {
        suppressBagUpdates = true;
        try {
          bagApi.clear();
        } finally {
          suppressBagUpdates = false;
        }
        state.filesByLookup.clear();
        state.entryMetaByLookup.clear();
        state.expandedReceipts.clear();
        refreshRows();
        state.error = '';
        state.status = '';
        render();
        return;
      }

      if (target.closest('[data-bag-download]') && !state.busy) {
        void executeDownload();
      }
    });

    const onBagChanged = () => {
      if (suppressBagUpdates) return;
      refreshRows();
      pruneLookupCaches();
      state.error = '';
      state.status = '';
      render();
      void hydrateLookupData().then(() => {
        pruneLookupCaches();
        render();
      });
    };
    bagApi.subscribe(onBagChanged);

    const onResize = () => {
      syncSummaryCardHeight();
    };
    window.addEventListener('resize', onResize);

    const boot = async () => {
      setFetchState('loading');
      state.auth = await resolveAuthSnapshot();
      if (state.localViewerMode && (!state.auth.authenticated || !state.auth.token)) {
        state.status = '';
      }

      refreshRows();
      pruneLookupCaches();
      await hydrateLookupData();
      render();
      setFetchState('ready');

      const resume = readResumeAction();
      if (resume && resume.action === 'download' && state.auth.authenticated && state.auth.token) {
        clearResumeAction();
        await executeDownload();
      }
    };

    boot().catch((error) => {
      state.error = `Bag failed to load: ${toText(error?.message || error)}`;
      render();
      setFetchState('error');
    });

    window.addEventListener('beforeunload', () => {
      window.removeEventListener('resize', onResize);
    }, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
