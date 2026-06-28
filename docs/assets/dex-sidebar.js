(function () {
  if (window.__dexSidebarRuntimeBound) return;
  window.__dexSidebarRuntimeBound = true;

  const ALL_BUCKETS = ['A', 'B', 'C', 'D', 'E', 'X'];
  const FAVORITES_STORAGE_PREFIX = 'dex:favorites:v2:';
  const FAVORITES_RUNTIME_PATH = '/assets/js/dx-favorites.js';
  const BAG_RUNTIME_PATH = '/assets/js/dx-bag.js';
  const INTERACTIVE_HOVER_RUNTIME_PATH = '/assets/js/interactive-hover.js';
  const PUBLIC_PROFILES_URL = '/data/public-profiles.json';
  const BAG_ROUTE_PATH = '/entry/bag/';
  const FAVORITES_UI_STYLE_ID = 'dx-favorites-ui-style';
  const FAVORITES_TOAST_ROOT_ID = 'dx-favorites-toast-root';
  const FAVORITES_TOAST_ID = 'dx-favorites-toast';
  const HEART_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="dx-fav-heart-svg" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
    </svg>
  `.trim();
  let favoritesRuntimePromise = null;
  let bagRuntimePromise = null;
  let favoritesSignalsBound = false;
  let favoritesToastTimer = 0;
  let activeEntryTooltipTarget = null;
  let entryRailLayoutBound = false;
  let entryRailFooterResizeObserver = null;
  let entryRailFooterMutationObserver = null;
  let entryRailObservedFooter = null;
  let entryRailLastMode = '';
  const ENTRY_RAIL_BREAKPOINT = 900;
  const COLLECTION_HEADING_CANONICAL = 'COL\u200CLECTION';
  const BUCKET_TOOLTIP_CACHE_PREFIX = 'dx:entry:bucket-tooltips:v1:';
  const ENTRY_RUNTIME_STYLE_ID = 'dx-entry-runtime-layout-overrides';
  const ENTRY_BUTTON_STYLE_ID = 'dx-entry-button-primitive-overrides';
  const DOWNLOAD_TREE_STYLE_ID = 'dx-entry-download-tree-style';
  const DX_MIN_SHEEN_MS = 120;
  const DX_ENTRY_TARGET_TIMEOUT_MS = 15000;
  const FETCH_STATE_LOADING = 'loading';
  const FETCH_STATE_READY = 'ready';
  const FETCH_STATE_ERROR = 'error';
  const ENTRY_FETCH_SHELL_MARKER = 'data-dx-entry-fetch-shell';
  const TOOLTIP_FETCH_SHELL_MARKER = 'data-dx-tooltip-fetch-shell';
  const ENTRY_FETCH_TARGET_SPECS = [
    { key: 'layout', selectors: ['[data-dx-entry-fetch-target="layout"]', '.dex-entry-layout'], variant: 'rows' },
    { key: 'header', selectors: ['[data-dx-entry-fetch-target="header"]', '.dex-entry-header'], variant: 'rows' },
    { key: 'media', selectors: ['[data-dx-entry-fetch-target="media"]', '.dex-entry-media', '.dex-video-shell'], variant: 'card' },
    { key: 'description', selectors: ['[data-dx-entry-fetch-target="description"]', '.dex-entry-desc-scroll'], variant: 'rows' },
    { key: 'overview', selectors: ['[data-dx-entry-fetch-target="overview"]', '.dex-overview'], variant: 'card' },
    { key: 'collections', selectors: ['[data-dx-entry-fetch-target="collections"]', '.dex-collections'], variant: 'rows' },
    { key: 'license', selectors: ['[data-dx-entry-fetch-target="license"]', '.dex-license'], variant: 'card' },
  ];
  const ENTRY_FETCH_WATCH_OPTIONS = { childList: true, subtree: true, characterData: true, attributes: true };
  const BUCKET_TOOLTIP_METRIC_ATTRS = [
    'data-dx-tooltip-status',
    'data-dx-tooltip-file-types',
    'data-dx-tooltip-video-quality',
    'data-dx-tooltip-audio-mp3',
    'data-dx-tooltip-audio-mp3-available',
    'data-dx-tooltip-audio-wav',
    'data-dx-tooltip-video-1080p',
    'data-dx-tooltip-video-4k',
    'data-dx-tooltip-video-1080p-available',
    'data-dx-tooltip-video-4k-available',
    'data-dx-tooltip-total-files',
  ];
  let overviewLookupFitBound = false;
  let overviewLookupResizeObserver = null;
  let activeEntryTooltipMetricsObserver = null;
  let entryPageTitleSeparatorObserver = null;
  let publicProfileMapPromise = null;

  const normalizeBuckets = (pageBuckets) => (Array.isArray(pageBuckets) ? pageBuckets : []);

  const prefersReducedMotion = () => {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch {
      return false;
    }
  };

  const animateNode = (node, keyframes, options) => {
    if (!node || prefersReducedMotion()) return null;
    if (typeof node.animate !== 'function') return null;
    try {
      return node.animate(keyframes, options);
    } catch {
      return null;
    }
  };

  const delay = (ms) => new Promise((resolve) => window.setTimeout(resolve, Math.max(0, ms)));

  const encodeBase64UrlUtf8 = (value) => {
    const input = String(value || '');
    if (!input) return '';
    try {
      const bytes = new TextEncoder().encode(input);
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    } catch {
      try {
        return btoa(unescape(encodeURIComponent(input))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
      } catch {
        return '';
      }
    }
  };

  const decodeBase64UrlUtf8 = (value) => {
    const input = String(value || '').trim();
    if (!input) return '';
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '==='.slice((normalized.length + 3) % 4);
    try {
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch {
      try {
        return decodeURIComponent(escape(atob(padded)));
      } catch {
        return '';
      }
    }
  };

  const resolveBagRoutePath = () => {
    const pathname = String(window.location.pathname || '');
    if (!pathname.startsWith('/view/')) return BAG_ROUTE_PATH;
    const match = pathname.match(/^\/view\/([^/]+)/);
    if (!match) return BAG_ROUTE_PATH;
    const currentFilePath = decodeBase64UrlUtf8(match[1]).replace(/\?+$/g, '');
    const marker = '/entries/';
    const markerIndex = currentFilePath.indexOf(marker);
    if (markerIndex < 0) return BAG_ROUTE_PATH;
    const root = currentFilePath.slice(0, markerIndex);
    const bagFilePath = `${root}${marker}bag/index.html`;
    const bagId = encodeBase64UrlUtf8(bagFilePath);
    if (!bagId) return BAG_ROUTE_PATH;
    return `/view/${bagId}/`;
  };

  const readCaseInsensitiveProp = (source, key) => {
    if (!source || typeof source !== 'object') return undefined;
    const normalized = String(key || '').trim().toLowerCase();
    if (!normalized) return undefined;
    for (const [entryKey, entryValue] of Object.entries(source)) {
      if (String(entryKey || '').trim().toLowerCase() === normalized) return entryValue;
    }
    return undefined;
  };

  const parseNonNegativeInt = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) return null;
    return parsed;
  };

  const listAvailableManifestFormats = (cfg, type, bucket) => {
    const source = type === 'audio'
      ? cfg?.downloads?.audioFileIds?.[bucket]
      : cfg?.downloads?.videoFileIds?.[bucket];
    if (!source || typeof source !== 'object') return [];
    return Object.entries(source).reduce((result, [formatKey, tokenValue]) => {
      const safeKey = String(formatKey || '').trim();
      if (!safeKey) return result;
      if (parseAssetRefToken(tokenValue)) result.push(safeKey);
      return result;
    }, []);
  };

  const listAvailableEmbeddedFormats = (embeddedTree, type, bucket) => {
    if (!embeddedTree || !Array.isArray(embeddedTree.buckets)) return [];
    const safeBucket = String(bucket || '').trim().toUpperCase();
    const safeType = String(type || '').trim().toLowerCase();
    if (!safeBucket || !safeType) return [];

    const bucketRow = embeddedTree.buckets.find(
      (row) => String(row?.bucket || '').trim().toUpperCase() === safeBucket,
    );
    const typeRow = Array.isArray(bucketRow?.types)
      ? bucketRow.types.find((row) => String(row?.mediaType || '').trim().toLowerCase() === safeType)
      : null;
    if (!typeRow) return [];

    const keys = [];
    const pushUnique = (value) => {
      const safeValue = String(value || '').trim();
      if (!safeValue) return;
      if (!keys.includes(safeValue)) keys.push(safeValue);
    };

    const variants = Array.isArray(typeRow?.variants) ? typeRow.variants : [];
    variants.forEach((variantRow) => {
      const files = Array.isArray(variantRow?.files) ? variantRow.files : [];
      if (!files.length) return;
      pushUnique(variantRow?.variantKey || variantRow?.label);
    });
    if (keys.length) return keys;

    const files = Array.isArray(typeRow?.files) ? typeRow.files : [];
    files.forEach((fileRow) => {
      const directKey = String(fileRow?.variantKey || fileRow?.variantLabel || '').trim();
      if (directKey) {
        pushUnique(directKey);
        return;
      }
      const extension = String(fileRow?.extension || fileRow?.ext || '').trim().toLowerCase();
      if (safeType === 'audio') {
        if (extension === 'mp3') pushUnique('mp3');
        if (extension === 'wav') pushUnique('wav');
        return;
      }
      if (safeType === 'video') {
        const haystack = `${String(fileRow?.filename || '')} ${String(fileRow?.label || '')}`.toLowerCase();
        if (/\b4k\b|\b2160p?\b|\buhd\b/.test(haystack)) pushUnique('4K');
        else if (/\b1080p?\b/.test(haystack)) pushUnique('1080p');
      }
    });
    return keys;
  };

  const readEmbeddedVariantCount = (embeddedTree, bucket, type, formatKeys = []) => {
    if (!embeddedTree || !Array.isArray(embeddedTree.buckets)) return null;
    const probes = Array.isArray(formatKeys)
      ? formatKeys.map((key) => String(key || '').trim().toLowerCase()).filter(Boolean)
      : [];
    if (!probes.length) return null;

    const safeBucket = String(bucket || '').trim().toUpperCase();
    const safeType = String(type || '').trim().toLowerCase();
    if (!safeBucket || !safeType) return null;

    const bucketRow = embeddedTree.buckets.find(
      (row) => String(row?.bucket || '').trim().toUpperCase() === safeBucket,
    );
    const typeRow = Array.isArray(bucketRow?.types)
      ? bucketRow.types.find((row) => String(row?.mediaType || '').trim().toLowerCase() === safeType)
      : null;
    if (!typeRow) return null;

    let matched = false;
    let total = 0;
    const variants = Array.isArray(typeRow?.variants) ? typeRow.variants : [];
    if (variants.length) {
      variants.forEach((variantRow) => {
        const variantKey = String(variantRow?.variantKey || variantRow?.label || '').trim().toLowerCase();
        if (!variantKey) return;
        const isMatch = probes.some((probe) => variantKey === probe || variantKey.includes(probe));
        if (!isMatch) return;
        const files = Array.isArray(variantRow?.files) ? variantRow.files : [];
        matched = true;
        total += files.length;
      });
      if (matched) return total;
    }

    const files = Array.isArray(typeRow?.files) ? typeRow.files : [];
    files.forEach((fileRow) => {
      const hints = [
        String(fileRow?.variantKey || '').trim().toLowerCase(),
        String(fileRow?.variantLabel || '').trim().toLowerCase(),
        String(fileRow?.extension || fileRow?.ext || '').trim().toLowerCase(),
        `${String(fileRow?.filename || '')} ${String(fileRow?.label || '')}`.toLowerCase(),
      ].filter(Boolean);
      const isMatch = probes.some((probe) => hints.some((hint) => hint === probe || hint.includes(probe)));
      if (!isMatch) return;
      matched = true;
      total += 1;
    });
    return matched ? total : null;
  };

  const hasFormatVariant = (availableFormatKeys, variants = []) => {
    const keys = Array.isArray(availableFormatKeys) ? availableFormatKeys : [];
    const probes = Array.isArray(variants)
      ? variants.map((variant) => String(variant || '').trim().toLowerCase()).filter(Boolean)
      : [];
    if (!probes.length) return false;
    return keys.some((key) => {
      const normalized = String(key || '').trim().toLowerCase();
      if (!normalized) return false;
      return probes.some((probe) => normalized === probe || normalized.includes(probe));
    });
  };

  const readBucketFileStatsValue = (cfg, bucket, type, formatKeys = []) => {
    const bucketStats = readCaseInsensitiveProp(cfg?.bucketFileStats, bucket);
    const typeStats = readCaseInsensitiveProp(bucketStats, type);
    const probes = Array.isArray(formatKeys) ? formatKeys : [];
    for (const probe of probes) {
      const rawValue = readCaseInsensitiveProp(typeStats, probe);
      if (rawValue === undefined || rawValue === null || rawValue === '') continue;
      return parseNonNegativeInt(rawValue);
    }
    return null;
  };

  const resolveCountDisplay = (isAvailable, count) => {
    if (!isAvailable) return 'n/a';
    if (Number.isInteger(count) && count >= 0) return String(count);
    return '—';
  };

  const computeBucketStats = (cfg, bucket, selectedBuckets = [], embeddedTree = null) => {
    const hasEmbeddedTree = !!(embeddedTree && Array.isArray(embeddedTree.buckets));
    const audioFormats = hasEmbeddedTree
      ? listAvailableEmbeddedFormats(embeddedTree, 'audio', bucket)
      : listAvailableManifestFormats(cfg, 'audio', bucket);
    const videoFormats = hasEmbeddedTree
      ? listAvailableEmbeddedFormats(embeddedTree, 'video', bucket)
      : listAvailableManifestFormats(cfg, 'video', bucket);
    const audioCount = audioFormats.length;
    const videoCount = videoFormats.length;
    const selected = selectedBuckets.includes(bucket);
    const audioMp3Available = hasFormatVariant(audioFormats, ['mp3']);
    const audioWavAvailable = hasFormatVariant(audioFormats, ['wav']);
    const video1080Available = hasFormatVariant(videoFormats, ['1080p', '1080']);
    const video4kAvailable = hasFormatVariant(videoFormats, ['4k', '2160', 'uhd']);

    const audioMp3Count = hasEmbeddedTree
      ? readEmbeddedVariantCount(embeddedTree, bucket, 'audio', ['mp3'])
      : readBucketFileStatsValue(cfg, bucket, 'audio', ['mp3']);
    const audioWavCount = hasEmbeddedTree
      ? readEmbeddedVariantCount(embeddedTree, bucket, 'audio', ['wav'])
      : readBucketFileStatsValue(cfg, bucket, 'audio', ['wav']);
    const video1080Count = hasEmbeddedTree
      ? readEmbeddedVariantCount(embeddedTree, bucket, 'video', ['1080p', '1080'])
      : readBucketFileStatsValue(cfg, bucket, 'video', ['1080p', '1080']);
    const video4kCount = hasEmbeddedTree
      ? readEmbeddedVariantCount(embeddedTree, bucket, 'video', ['4K', '4k', '2160p', '2160', 'uhd'])
      : readBucketFileStatsValue(cfg, bucket, 'video', ['4K', '4k', '2160p', '2160', 'uhd']);

    const fileTypes = [];
    if (audioCount > 0) fileTypes.push('Audio');
    if (videoCount > 0) fileTypes.push('Video');
    const fileTypesLabel = fileTypes.length ? fileTypes.join(', ') : 'None';

    const videoQuality = [];
    if (video1080Available) videoQuality.push('1080p');
    if (video4kAvailable) videoQuality.push('4K');
    const videoQualityLabel = videoQuality.length ? videoQuality.join(', ') : 'None';

    const audioMp3Display = resolveCountDisplay(audioMp3Available, audioMp3Count);
    const audioWavDisplay = resolveCountDisplay(audioWavAvailable, audioWavCount);
    const video1080Display = resolveCountDisplay(video1080Available, video1080Count);
    const video4kDisplay = resolveCountDisplay(video4kAvailable, video4kCount);

    const numericCounts = [];
    if (audioMp3Available && Number.isInteger(audioMp3Count)) numericCounts.push(audioMp3Count);
    if (audioWavAvailable && Number.isInteger(audioWavCount)) numericCounts.push(audioWavCount);
    if (video1080Available && Number.isInteger(video1080Count)) numericCounts.push(video1080Count);
    if (video4kAvailable && Number.isInteger(video4kCount)) numericCounts.push(video4kCount);
    const totalFiles = numericCounts.reduce((sum, value) => sum + value, 0);
    return {
      bucket,
      selected,
      audioCount,
      videoCount,
      totalMapped: audioCount + videoCount,
      fileTypesLabel,
      videoQualityLabel,
      audioMp3Available,
      audioWavAvailable,
      video1080Available,
      video4kAvailable,
      audioMp3Display,
      audioWavDisplay,
      video1080Display,
      video4kDisplay,
      totalFilesDisplay: String(totalFiles),
    };
  };

  const getBucketTooltipStatus = (stats) => ((stats?.selected || stats?.totalMapped > 0) ? 'available' : 'unavailable');

  const formatBucketTooltip = (stats) => {
    if (!stats) return '';
    const status = getBucketTooltipStatus(stats);
    const rows = [
      `${stats.bucket.toUpperCase()} BUCKET`,
      `Status: ${status}`,
      `File types: ${stats.fileTypesLabel}`,
      `Video quality: ${stats.videoQualityLabel}`,
      `Audio WAV: ${stats.audioWavDisplay}`,
    ];
    if (stats.audioMp3Available) rows.push(`Audio MP3: ${stats.audioMp3Display}`);
    if (stats.video1080Available) rows.push(`Video 1080p: ${stats.video1080Display}`);
    if (stats.video4kAvailable) rows.push(`Video 4K: ${stats.video4kDisplay}`);
    rows.push(`Total files: ${stats.totalFilesDisplay}`);
    return rows.join(' • ');
  };

  const readBucketTooltipCache = (lookupNumber = '') => {
    const safeLookup = String(lookupNumber || '').trim();
    if (!safeLookup) return {};
    try {
      const raw = window.localStorage?.getItem(`${BUCKET_TOOLTIP_CACHE_PREFIX}${safeLookup}`);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const writeBucketTooltipCache = (lookupNumber = '', nextMap = {}) => {
    const safeLookup = String(lookupNumber || '').trim();
    if (!safeLookup) return;
    try {
      window.localStorage?.setItem(`${BUCKET_TOOLTIP_CACHE_PREFIX}${safeLookup}`, JSON.stringify(nextMap || {}));
    } catch {}
  };

  const buildBucketsHtml = (pageBuckets, cfg, lookupNumber = '') => {
    const selected = normalizeBuckets(pageBuckets);
    const embeddedTree = normalizeEmbeddedDownloadTree(cfg, lookupNumber);
    const tooltipCache = readBucketTooltipCache(lookupNumber);
    const nextTooltipCache = { ...tooltipCache };
    const html = ALL_BUCKETS
      .map((bucket) => {
        const available = selected.includes(bucket) || bucketHasAnyAsset(cfg, bucket);
        const cls = available ? 'available' : 'unavailable';
        const stats = computeBucketStats(cfg, bucket, selected, embeddedTree);
        const liveTooltip = formatBucketTooltip(stats);
        const persistedTooltip = String(tooltipCache[bucket] || '').trim();
        const tooltipText = String(liveTooltip || persistedTooltip || `${bucket} BUCKET`).trim();
        nextTooltipCache[bucket] = tooltipText;
        const tooltip = escapeHtml(tooltipText);
        const status = escapeHtml(getBucketTooltipStatus(stats));
        const fileTypes = escapeHtml(String(stats?.fileTypesLabel || 'None'));
        const videoQuality = escapeHtml(String(stats?.videoQualityLabel || 'None'));
        const audioMp3 = escapeHtml(String(stats?.audioMp3Display || 'n/a'));
        const audioMp3Available = escapeHtml(stats?.audioMp3Available ? 'yes' : 'no');
        const audioWav = escapeHtml(String(stats?.audioWavDisplay || 'n/a'));
        const video1080 = escapeHtml(String(stats?.video1080Display || 'n/a'));
        const video4k = escapeHtml(String(stats?.video4kDisplay || 'n/a'));
        const video1080Available = escapeHtml(stats?.video1080Available ? 'yes' : 'no');
        const video4kAvailable = escapeHtml(stats?.video4kAvailable ? 'yes' : 'no');
        const totalFiles = escapeHtml(String(stats?.totalFilesDisplay || '0'));
        return `<span class="dx-bucket-tile ${cls}" data-dx-bucket-key="${bucket}" data-dx-bucket-tooltip="${tooltip}" data-dx-tooltip="${tooltip}" data-dx-tooltip-status="${status}" data-dx-tooltip-file-types="${fileTypes}" data-dx-tooltip-video-quality="${videoQuality}" data-dx-tooltip-audio-mp3="${audioMp3}" data-dx-tooltip-audio-mp3-available="${audioMp3Available}" data-dx-tooltip-audio-wav="${audioWav}" data-dx-tooltip-video-1080p="${video1080}" data-dx-tooltip-video-4k="${video4k}" data-dx-tooltip-video-1080p-available="${video1080Available}" data-dx-tooltip-video-4k-available="${video4kAvailable}" data-dx-tooltip-total-files="${totalFiles}" title="${tooltip}" aria-label="${tooltip}" tabindex="0"><span class="dx-bucket-label">${bucket}</span></span>`;
      })
      .join('');
    writeBucketTooltipCache(lookupNumber, nextTooltipCache);
    return html;
  };

  const getSidebarAssetOrigin = () => {
    const s = document.querySelector('script[src*="dex-sidebar.js"]');
    if (s && s.src) {
      try {
        return new URL(s.src, window.location.href).origin;
      } catch {}
    }
    return window.location.origin;
  };

  const ensureProfileChromeRuntime = (origin) => {
    if (!(document.body instanceof HTMLElement)) return;
    document.body.classList.add('dx-entry-page');
    document.body.classList.remove('dx-route-profile-protected', 'dx-route-standard-chrome', 'dx-route-show-mesh');
    document.body.classList.remove('announcement-bar-reserved-space');
    const scriptPath = '/assets/js/header-slot.js';
    const existing = Array.from(document.querySelectorAll('script[src]')).find((script) => {
      try {
        const parsed = new URL(script.src, window.location.href);
        return parsed.pathname === scriptPath;
      } catch {
        return false;
      }
    });
    if (existing || window.__dxHeaderSlotLoaded) return;
    const script = document.createElement('script');
    script.defer = true;
    script.src = new URL(scriptPath, origin || window.location.origin).toString();
    document.head.appendChild(script);
  };

  const ensureInteractiveHoverRuntime = (origin) => {
    if (!(document.head instanceof HTMLElement)) return;
    const existing = Array.from(document.querySelectorAll('script[src]')).find((script) => {
      try {
        const parsed = new URL(script.src, window.location.href);
        return parsed.pathname === INTERACTIVE_HOVER_RUNTIME_PATH;
      } catch {
        return false;
      }
    });
    if (existing || window.__dxInteractiveHover) {
      window.__dxInteractiveHover?.apply?.(document);
      return;
    }
    const script = document.createElement('script');
    script.defer = true;
    script.src = new URL(INTERACTIVE_HOVER_RUNTIME_PATH, origin || window.location.origin).toString();
    script.addEventListener('load', () => {
      window.__dxInteractiveHover?.apply?.(document);
    }, { once: true });
    document.head.appendChild(script);
  };

  const ensureEntryRuntimeLayoutOverrides = () => {
    if (!(document.head instanceof HTMLElement)) return;
    if (document.getElementById(ENTRY_RUNTIME_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = ENTRY_RUNTIME_STYLE_ID;
    style.textContent = `
      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page,
      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page #siteWrapper,
      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page #page,
      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page #sections,
      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-entry-section,
      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-entry-host,
      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-entry-host .dx-code-container {
        max-height: none !important;
        min-height: 0 !important;
      }

      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-entry-layout {
        height: var(--dx-entry-rails-height, 62vh) !important;
        min-height: 0 !important;
        overflow: visible !important;
        align-items: stretch !important;
      }

      body.dx-entry-page .dex-entry-section {
        margin-bottom: var(--dx-entry-footer-gap, clamp(18px, 2.2vh, 30px)) !important;
      }

      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-entry-section {
        margin-bottom: var(--dx-entry-footer-gap, clamp(14px, 1.2vw, 20px)) !important;
      }

      body.dx-entry-page .dex-entry-main,
      body.dx-entry-page .dex-sidebar {
        padding-bottom: var(--dx-entry-footer-gap, clamp(18px, 2.2vh, 30px)) !important;
      }

      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-entry-main,
      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-sidebar {
        height: var(--dx-entry-rails-height, 62vh) !important;
        max-height: var(--dx-entry-rails-height, 62vh) !important;
        min-height: 0 !important;
        overscroll-behavior: contain !important;
        scrollbar-gutter: stable !important;
        padding-bottom: var(--dx-entry-footer-gap, clamp(14px, 1.2vw, 20px)) !important;
      }

      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-entry-main {
        overflow-y: hidden !important;
        overflow-x: hidden !important;
      }

      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-sidebar {
        overflow-y: auto !important;
        overflow-x: hidden !important;
        padding-bottom: var(--dx-entry-footer-gap, clamp(14px, 1.2vw, 20px)) !important;
      }

      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-entry-main > :last-child {
        margin-bottom: var(--dx-entry-footer-gap, clamp(14px, 1.2vw, 20px)) !important;
      }

      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-sidebar > section:last-of-type {
        margin-bottom: var(--dx-entry-footer-gap, clamp(14px, 1.2vw, 20px)) !important;
      }

      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-sidebar {
        padding-right: var(--dx-entry-rail-inline-pad, clamp(16px, 1.6vw, 22px)) !important;
      }

      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-sidebar section {
        padding-top: clamp(16px, 1.35vw, 22px) !important;
        padding-bottom: clamp(16px, 1.35vw, 22px) !important;
        padding-left: var(--dx-entry-rail-inline-pad, clamp(16px, 1.6vw, 22px)) !important;
        padding-right: var(--dx-entry-rail-inline-pad, clamp(16px, 1.6vw, 22px)) !important;
      }

      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-sidebar section + section {
        margin-top: clamp(12px, 1.05vw, 18px) !important;
      }

      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-footer-section {
        position: static !important;
        left: auto !important;
        right: auto !important;
        bottom: auto !important;
        margin: 0 !important;
        padding-top: 0 !important;
        padding-bottom: 0 !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        min-height: 0 !important;
      }

      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page #footer-sections {
        position: relative !important;
        width: 100vw !important;
        max-width: 100vw !important;
        margin-left: calc(50% - 50vw) !important;
        margin-right: calc(50% - 50vw) !important;
        margin-top: 0 !important;
        margin-bottom: 0 !important;
        padding: 0 !important;
        height: auto !important;
        min-height: 0 !important;
        overflow: visible !important;
        pointer-events: auto !important;
        z-index: calc(var(--dx-layer-foreground) + 2) !important;
      }

      html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page #footer-sections .dex-footer-section {
        width: var(--dx-header-frame-width-vw) !important;
        max-width: var(--dx-header-frame-width-vw) !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }

      body.dx-entry-page #footer-sections .page-section,
      body.dx-entry-page #footer-sections .content-wrapper,
      body.dx-entry-page #footer-sections .content,
      body.dx-entry-page #footer-sections .fluid-engine,
      body.dx-entry-page #footer-sections .fe-block,
      body.dx-entry-page #footer-sections .sqs-block,
      body.dx-entry-page #footer-sections .sqs-block-content,
      body.dx-entry-page #footer-sections .sqs-code-container,
      body.dx-entry-page #footer-sections .dx-block,
      body.dx-entry-page #footer-sections .dx-block-content,
      body.dx-entry-page #footer-sections .dx-code-container {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        overflow: visible !important;
      }

      body.dx-entry-page #footer-sections .fe-block {
        grid-column: 1 / -1 !important;
      }

      body.dx-entry-page #footer-sections .sqs-block {
        justify-self: stretch !important;
        place-self: auto stretch !important;
      }

      body.dx-entry-page #footer-sections .dex-footer {
        position: relative !important;
        left: auto !important;
        right: auto !important;
        bottom: auto !important;
        transform: none !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 auto calc(var(--dx-fixed-header-top, 12px) + env(safe-area-inset-bottom, 0px)) !important;
        z-index: calc(var(--dx-layer-foreground) + 3) !important;
        pointer-events: auto !important;
      }

      body.dx-entry-page .dex-footer.dx-profile-footer-portaled {
        display: none !important;
      }

      body.dx-entry-page .dex-sidebar section {
        height: auto !important;
        min-height: max-content !important;
        padding: clamp(16px, 1.35vw, 22px) clamp(16px, 1.6vw, 22px) !important;
        box-sizing: border-box !important;
      }

      body.dx-entry-page .dex-sidebar section + section {
        margin-top: clamp(12px, 1.05vw, 18px) !important;
      }

      @media (max-width: 899px) {
        html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-entry-layout,
        html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-entry-main,
        html[data-dx-entry-rail-mode="desktop-fixed"] body.dx-entry-page .dex-sidebar {
          height: auto !important;
          max-height: none !important;
          overflow: visible !important;
        }
      }
    `;
    document.head.appendChild(style);
  };

  const ensureEntryButtonPrimitiveOverrides = () => {
    if (!(document.head instanceof HTMLElement)) return;
    if (document.getElementById(ENTRY_BUTTON_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = ENTRY_BUTTON_STYLE_ID;
    style.textContent = `
      body.dx-entry-page .dex-sidebar .dex-license-controls .copy-btn,
      body.dx-entry-page .dex-sidebar .dex-license-controls .usage-btn,
      body.dx-entry-page .dex-sidebar #downloads .btn-audio,
      body.dx-entry-page .dex-sidebar #downloads .btn-video,
      body.dx-entry-page .dex-sidebar #downloads .btn-download {
        position: relative !important;
        overflow: hidden !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: var(--space-2, 0.5rem) !important;
        border: 0 !important;
        border-radius: var(--dx-btn-radius, 4px) !important;
        background: var(--dx-btn-primary-bg, linear-gradient(130deg, var(--dex-accent, #ff1910), #ff9810)) !important;
        color: #fff !important;
        box-shadow: var(--dx-btn-primary-shadow, 0 0 0 1px rgba(255, 255, 255, 0.35) inset, 0 10px 30px rgba(255, 0, 80, 0.25)) !important;
        font-family: var(--font-heading, "Stretch Pro", sans-serif) !important;
        font-size: var(--dx-btn-font-size-md, clamp(12px, 1.05vw, 13px)) !important;
        font-weight: var(--dx-btn-primary-weight, 800) !important;
        line-height: 1.05 !important;
        letter-spacing: 0 !important;
        text-transform: none !important;
      }

      body.dx-entry-page .dex-sidebar #downloads .btn-recording-index {
        position: relative !important;
        overflow: hidden !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: var(--space-2, 0.5rem) !important;
        border: 0 !important;
        border-radius: var(--dx-btn-radius, 4px) !important;
        background: var(--dx-btn-secondary-bg, linear-gradient(145deg, rgba(255, 255, 255, 0.78), rgba(245, 249, 255, 0.52))) !important;
        color: #000 !important;
        box-shadow: none !important;
        font-family: var(--font-heading, "Stretch Pro", sans-serif) !important;
        font-size: var(--dx-btn-font-size-md, clamp(12px, 1.05vw, 13px)) !important;
        font-weight: var(--dx-btn-secondary-weight, 700) !important;
        line-height: 1.05 !important;
        letter-spacing: 0 !important;
        text-transform: none !important;
      }

      body.dx-entry-page .dex-sidebar .dex-license-controls .copy-btn:hover,
      body.dx-entry-page .dex-sidebar .dex-license-controls .usage-btn:hover,
      body.dx-entry-page .dex-sidebar #downloads .btn-audio:hover,
      body.dx-entry-page .dex-sidebar #downloads .btn-video:hover,
      body.dx-entry-page .dex-sidebar #downloads .btn-download:hover {
        box-shadow: var(--dx-btn-primary-shadow-hover, 0 12px 36px rgba(255, 0, 80, 0.28)) !important;
      }

      body.dx-entry-page .dex-sidebar #downloads .btn-recording-index:hover {
        box-shadow: none !important;
      }

      body.dx-entry-page .dex-sidebar #downloads .btn-recording-index:focus-visible {
        outline: 2px solid rgba(255, 25, 16, 0.32) !important;
        outline-offset: 2px !important;
        box-shadow: none !important;
      }
    `;
    document.head.appendChild(style);
  };

  const ensureDownloadTreeStyles = () => {
    if (!(document.head instanceof HTMLElement)) return;
    if (document.getElementById(DOWNLOAD_TREE_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = DOWNLOAD_TREE_STYLE_ID;
    style.textContent = `
      .dex-download-modal--tree {
        --dx-tree-rim: rgba(23, 28, 38, 0.14);
        --dx-tree-rim-strong: rgba(23, 28, 38, 0.24);
        --dx-tree-ink: rgba(18, 21, 28, 0.95);
        --dx-tree-muted: rgba(18, 21, 28, 0.58);
        --dx-tree-hot: #ff3b24;
        --dx-tree-hot-2: #ff9816;
      }

      .dex-download-modal--tree .dex-download-modal-inner {
        grid-template-rows: auto auto minmax(0, 1fr) auto;
      }

      .dx-file-bucket-tabs {
        position: relative;
        z-index: 3;
        display: flex;
        align-items: flex-end;
        gap: 4px;
        overflow-x: auto;
        scrollbar-gutter: stable;
        padding: 4px 4px 0;
        margin-bottom: -1px;
      }

      .dx-file-folder-stack {
        display: grid;
        min-height: 0;
      }

      /* Folder-style tabs: the active tab shares the body fill, drops its bottom
         border, and overlaps the body by 1px so it merges into the panel below. */
      .dx-file-bucket-tab {
        appearance: none;
        position: relative;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        grid-template-areas:
          "letter label"
          "letter media";
        column-gap: 9px;
        row-gap: 2px;
        align-items: center;
        min-width: 132px;
        min-height: 38px;
        padding: 6px 11px 8px 10px;
        border: 1px solid transparent;
        border-bottom: 0;
        border-radius: 8px 8px 0 0;
        background: rgba(232, 233, 236, 0.72);
        color: var(--dx-tree-muted);
        cursor: pointer;
        text-align: left;
        transition: background 140ms ease, color 140ms ease, border-color 140ms ease;
      }

      .dx-file-bucket-tab:hover,
      .dx-file-bucket-tab:focus-visible {
        background: rgba(255, 255, 255, 0.7);
        color: var(--dx-tree-ink);
        outline: 0;
      }

      .dx-file-bucket-tab[aria-selected="true"] {
        z-index: 4;
        min-height: 42px;
        border-color: var(--dx-tree-rim);
        border-bottom: 0;
        background: rgba(255, 255, 255, 0.92);
        color: var(--dx-tree-ink);
        box-shadow: inset 0 2px 0 0 var(--dx-tree-hot);
      }

      .dx-file-bucket-tab[data-dx-bucket-selection="full"]:not([aria-selected="true"]) {
        color: var(--dx-tree-ink);
        box-shadow: inset 0 2px 0 0 rgba(255, 59, 36, 0.55);
      }

      .dx-file-bucket-tab[data-dx-bucket-selection="partial"]:not([aria-selected="true"]) {
        color: var(--dx-tree-ink);
        box-shadow: inset 0 2px 0 0 rgba(255, 152, 22, 0.5);
      }

      .dx-file-bucket-tab-letter {
        grid-area: letter;
        color: rgba(18, 21, 28, 0.96);
        font: 900 0.9rem/1 "Stretch Pro", var(--font-heading, sans-serif);
      }

      .dx-file-bucket-tab-label {
        grid-area: label;
        min-width: 0;
        color: rgba(18, 21, 28, 0.84);
        font: 800 0.54rem/1.1 "Stretch Pro", var(--font-heading, sans-serif);
        letter-spacing: 0;
        text-transform: uppercase;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .dx-file-bucket-tab-media {
        grid-area: media;
        min-width: 0;
        color: var(--dx-tree-muted);
        font: 700 0.56rem/1.1 var(--font-body, "Courier Prime", monospace);
        letter-spacing: 0;
        text-transform: uppercase;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        opacity: 0;
        visibility: hidden;
        transition: opacity 150ms ease;
      }

      .dx-file-bucket-tab[aria-selected="true"] .dx-file-bucket-tab-media {
        opacity: 0.72;
        visibility: visible;
      }

      .dx-file-tree-tools {
        position: relative;
        top: 0;
        z-index: 2;
        padding: 12px 12px 8px;
        border: 1px solid var(--dx-tree-rim);
        border-bottom: 0;
        border-radius: 0 8px 0 0;
        background: rgba(255, 255, 255, 0.92);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      }

      .dx-file-tree-panel {
        position: relative;
        display: grid;
        min-height: 0;
        z-index: 2;
      }

      .dx-file-tree-wrap {
        align-content: start;
        border: 1px solid var(--dx-tree-rim);
        border-top-color: rgba(0, 0, 0, 0.08);
        border-radius: 0 0 8px 8px;
        background: rgba(255, 255, 255, 0.58);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.72);
        padding: 8px;
        scrollbar-gutter: stable;
      }

      .dx-file-tree-node {
        display: grid;
        gap: 4px;
      }

      .dx-file-tree-row {
        display: grid;
        gap: 8px;
        align-items: center;
        min-height: 36px;
        padding: 4px 7px;
        border: 1px solid transparent;
        border-radius: 7px;
        color: var(--dx-tree-ink);
        cursor: pointer;
        position: relative;
        transition: background 140ms ease, border-color 140ms ease, transform 140ms ease;
      }

      .dx-file-tree-row:hover,
      .dx-file-tree-row:focus-visible {
        background: rgba(255, 255, 255, 0.76);
        border-color: var(--dx-tree-rim);
        outline: 0;
      }

      .dx-file-tree-row.is-selected {
        background: rgba(255, 72, 32, 0.095);
        border-color: rgba(255, 72, 32, 0.32);
      }

      .dx-file-tree-row.is-partial {
        background: rgba(255, 152, 22, 0.09);
        border-color: rgba(255, 152, 22, 0.24);
      }

      .dx-file-tree-toggle {
        display: grid;
        place-items: center;
        width: 22px;
        height: 22px;
        padding: 0;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: var(--dx-tree-ink);
        font: 900 0.82rem/1 var(--font-body, "Courier Prime", monospace);
        cursor: pointer;
      }

      .dx-file-tree-toggle:hover,
      .dx-file-tree-toggle:focus-visible {
        background: rgba(18, 21, 28, 0.07);
        outline: 0;
      }

      .dx-file-tree-checkbox {
        width: 18px;
        height: 18px;
        margin: 0;
        accent-color: var(--dx-tree-hot);
        cursor: pointer;
      }

      .dx-file-tree-copy {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        align-items: center;
        min-width: 0;
      }

      .dx-file-tree-label {
        min-width: 0;
        overflow: visible;
        text-overflow: clip;
        white-space: normal;
        font: 800 0.79rem/1.08 var(--font-heading, "Typefesse", sans-serif);
        letter-spacing: 0.01em;
        text-transform: uppercase;
      }

      .dx-file-tree-node--file .dx-file-tree-label {
        font: 700 0.75rem/1.2 var(--font-body, "Courier Prime", monospace);
        text-transform: none;
        word-break: break-word;
      }

      .dx-file-tree-children {
        display: grid;
        gap: 4px;
        margin-left: 12px;
        padding-left: 12px;
        border-left: 1px solid rgba(18, 20, 26, 0.14);
      }

      .dx-file-tree-actions {
        position: static;
        padding-top: 8px;
        background: transparent;
      }

      @media (max-width: 680px) {
        .dex-download-modal--tree .dex-download-modal-inner {
          width: calc(100vw - 18px) !important;
          max-height: calc(100vh - 18px) !important;
        }

        .dx-file-tree-tools {
          grid-template-columns: minmax(0, 1fr) !important;
          padding: 12px 10px 8px;
        }

        .dx-file-bucket-tabs {
          padding-top: 4px;
        }

        .dx-file-bucket-tab {
          min-width: 113px;
          min-height: 39px;
          padding: 7px 9px 8px;
          column-gap: 6px;
        }

        .dx-file-bucket-tab[aria-selected="true"] {
          min-height: 43px;
        }

        .dx-file-bucket-tab-letter {
          font-size: 0.78rem;
        }

        .dx-file-bucket-tab-label {
          font-size: 0.46rem;
          overflow: visible;
          text-overflow: clip;
          white-space: normal;
        }

        .dx-file-bucket-tab-media {
          font-size: 0.5rem;
        }

        .dx-file-tree-wrap {
          max-height: min(40vh, 340px) !important;
        }

        .dx-file-tree-copy {
          grid-template-columns: minmax(0, 1fr) !important;
        }
      }
    `;
    document.head.appendChild(style);
  };

  const parseCssPx = (value) => {
    const num = Number.parseFloat(String(value || '').trim().replace(/px$/i, ''));
    return Number.isFinite(num) ? num : 0;
  };

  const parseFirstCssPx = (...values) => {
    for (const value of values) {
      const parsed = parseCssPx(value);
      if (parsed > 0) return parsed;
    }
    return 0;
  };

  const setFetchState = (root, state) => {
    if (!(root instanceof HTMLElement)) return;
    root.setAttribute('data-dx-fetch-state', state);
    if (state === FETCH_STATE_LOADING) {
      root.setAttribute('aria-busy', 'true');
    } else {
      root.removeAttribute('aria-busy');
    }
  };

  const createFetchShell = (variant = 'card') => {
    const shell = document.createElement('div');
    shell.className = `dx-fetch-shell dx-fetch-shell--${variant === 'rows' ? 'rows' : 'card'}`;
    if (variant === 'rows') {
      shell.innerHTML = `
        <span class="dx-fetch-shell-pill"></span>
        <span class="dx-fetch-shell-line" style="width: 94%;"></span>
        <span class="dx-fetch-shell-line" style="width: 86%;"></span>
        <span class="dx-fetch-shell-line" style="width: 72%;"></span>
      `;
      return shell;
    }

    shell.innerHTML = `
      <span class="dx-fetch-shell-pill"></span>
      <span class="dx-fetch-shell-line"></span>
      <span class="dx-fetch-shell-line" style="width: 76%;"></span>
    `;
    return shell;
  };

  const nowTs = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());

  const ensureFetchShell = (target, variant = 'card', marker = ENTRY_FETCH_SHELL_MARKER) => {
    if (!(target instanceof HTMLElement)) return;
    const existing = target.querySelector(`:scope > .dx-fetch-shell-overlay[${marker}="1"]`);
    if (existing) return;
    const overlay = document.createElement('div');
    overlay.className = 'dx-fetch-shell-overlay';
    overlay.setAttribute(marker, '1');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.appendChild(createFetchShell(variant));
    target.prepend(overlay);
  };

  const resolveEntryFetchTarget = (selectors = []) => {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (node instanceof HTMLElement) return node;
    }
    return null;
  };

  const queueFetchTransition = (record, nextState) => {
    if (!record) return Promise.resolve();
    record.pending = (record.pending || Promise.resolve()).then(async () => {
      if (record.state !== FETCH_STATE_LOADING) return;
      const elapsed = nowTs() - Number(record.startTs || 0);
      if (elapsed < DX_MIN_SHEEN_MS) {
        await delay(DX_MIN_SHEEN_MS - elapsed);
      }
      if (record.state !== FETCH_STATE_LOADING) return;
      record.state = nextState;
      setFetchState(record.target, nextState);
      if (record.timeoutId) {
        window.clearTimeout(record.timeoutId);
        record.timeoutId = 0;
      }
    });
    return record.pending;
  };

  const collectEntryFetchTargets = () => {
    const seen = new Set();
    const byKey = new Map();
    ENTRY_FETCH_TARGET_SPECS.forEach((spec) => {
      const target = resolveEntryFetchTarget(spec.selectors);
      if (!(target instanceof HTMLElement) || seen.has(target)) return;
      seen.add(target);
      target.setAttribute('data-dx-entry-fetch-target', spec.key);
      byKey.set(spec.key, {
        key: spec.key,
        target,
        variant: spec.variant === 'rows' ? 'rows' : 'card',
        state: '',
        startTs: 0,
        timeoutId: 0,
        pending: Promise.resolve(),
      });
    });
    return {
      byKey,
      list: Array.from(byKey.values()),
    };
  };

  const getEntryFetchRecord = (targets, key) => {
    if (!targets || !(targets.byKey instanceof Map)) return null;
    return targets.byKey.get(String(key || '').trim()) || null;
  };

  const entryTargetAlreadyReady = (record) => {
    if (!record || !(record.target instanceof HTMLElement)) return false;
    if (record.key === 'header') return isHeaderReady(record.target);
    if (record.key === 'description') return isDescriptionReady(record.target);
    if (record.key === 'media') return mediaTargetLooksReady(record.target);
    return false;
  };

  const startTargetLoading = (record, targets = null) => {
    if (!record || !(record.target instanceof HTMLElement)) return;
    if (entryTargetAlreadyReady(record)) {
      record.state = FETCH_STATE_READY;
      record.startTs = nowTs();
      setFetchState(record.target, FETCH_STATE_READY);
      return;
    }
    record.state = FETCH_STATE_LOADING;
    record.startTs = nowTs();
    setFetchState(record.target, FETCH_STATE_LOADING);
    if (record.key !== 'layout') {
      ensureFetchShell(record.target, record.variant, ENTRY_FETCH_SHELL_MARKER);
    }
    if (record.timeoutId) {
      window.clearTimeout(record.timeoutId);
      record.timeoutId = 0;
    }
    record.timeoutId = window.setTimeout(() => {
      if (record.state !== FETCH_STATE_LOADING) return;
      if (targets && record.key) {
        void markTargetError(targets, record.key);
        return;
      }
      void queueFetchTransition(record, FETCH_STATE_ERROR);
    }, DX_ENTRY_TARGET_TIMEOUT_MS);
  };

  const ensureEntryFetchShells = (targets = []) => {
    if (!targets || !Array.isArray(targets.list)) return;
    targets.list.forEach((record) => {
      startTargetLoading(record, targets);
    });
  };

  const maybeMarkEntryLayoutReady = async (targets) => {
    const layout = getEntryFetchRecord(targets, 'layout');
    if (!layout || layout.state !== FETCH_STATE_LOADING) return;
    const keys = ['header', 'media', 'description', 'overview', 'collections', 'license'];
    const unresolved = keys.some((key) => {
      const record = getEntryFetchRecord(targets, key);
      return record && record.state === FETCH_STATE_LOADING;
    });
    if (unresolved) return;
    await queueFetchTransition(layout, FETCH_STATE_READY);
  };

  const markTargetReady = async (targets, key) => {
    const record = getEntryFetchRecord(targets, key);
    if (!record) return;
    await queueFetchTransition(record, FETCH_STATE_READY);
    if (key !== 'layout') await maybeMarkEntryLayoutReady(targets);
  };

  const markTargetError = async (targets, key) => {
    const record = getEntryFetchRecord(targets, key);
    if (!record) return;
    await queueFetchTransition(record, FETCH_STATE_ERROR);
    if (key !== 'layout') await maybeMarkEntryLayoutReady(targets);
  };

  const markAllEntryFetchTargets = async (targets, state = FETCH_STATE_ERROR) => {
    if (!targets || !Array.isArray(targets.list)) return;
    const nextState = state === FETCH_STATE_READY ? FETCH_STATE_READY : FETCH_STATE_ERROR;
    await Promise.all(
      targets.list.map((record) => {
        if (!record || record.state !== FETCH_STATE_LOADING) return Promise.resolve();
        return queueFetchTransition(record, nextState);
      }),
    );
  };

  const hasMeaningfulText = (value) => String(value || '').replace(/\s+/g, ' ').trim().length > 0;

  const isHeaderReady = (target) => {
    if (!(target instanceof HTMLElement)) return false;
    const title = target.querySelector('[data-dex-entry-page-title], .dex-entry-page-title');
    const subtitle = target.querySelector('[data-dex-entry-subtitle], .dex-entry-subtitle');
    if (!(title instanceof HTMLElement) || !(subtitle instanceof HTMLElement)) return false;
    const titleTextReady = hasMeaningfulText(title.textContent);
    const subtitleValues = Array.from(subtitle.querySelectorAll('.dex-entry-subtitle-value'))
      .filter((node) => node instanceof HTMLElement)
      .map((node) => node.textContent)
      .filter((value) => hasMeaningfulText(value));
    const subtitleReady = subtitleValues.length > 0 || hasMeaningfulText(subtitle.textContent);
    return titleTextReady && subtitleReady;
  };

  const isDescriptionReady = (target) => {
    if (!(target instanceof HTMLElement)) return false;
    const content = target.querySelector('.dex-entry-desc-content') || target;
    if (!(content instanceof HTMLElement)) return false;
    const text = String(content.textContent || '').replace(/\s+/g, ' ').trim();
    return text.length >= 16;
  };

  const watchTargetUntilReady = (target, isReady, onReady) => {
    if (!(target instanceof HTMLElement) || typeof isReady !== 'function' || typeof onReady !== 'function') return null;
    if (isReady()) {
      onReady();
      return null;
    }
    if (typeof MutationObserver !== 'function') return null;
    const observer = new MutationObserver(() => {
      if (!isReady()) return;
      observer.disconnect();
      onReady();
    });
    observer.observe(target, ENTRY_FETCH_WATCH_OPTIONS);
    return observer;
  };

  const bindHeaderFetchLifecycle = (targets) => {
    const record = getEntryFetchRecord(targets, 'header');
    if (!record) return;
    watchTargetUntilReady(record.target, () => isHeaderReady(record.target), () => {
      void markTargetReady(targets, 'header');
    });
  };

  const bindDescriptionFetchLifecycle = (targets) => {
    const record = getEntryFetchRecord(targets, 'description');
    if (!record) return;
    watchTargetUntilReady(record.target, () => isDescriptionReady(record.target), () => {
      void markTargetReady(targets, 'description');
    });
  };

  const mediaTargetLooksReady = (target) => {
    if (!(target instanceof HTMLElement)) return false;
    const mediaNode = target.querySelector('iframe, img, video, canvas');
    if (!(mediaNode instanceof Element)) return false;
    const targetRect = target.getBoundingClientRect();
    const mediaRect = mediaNode.getBoundingClientRect();
    return targetRect.width >= 120
      && targetRect.height >= 64
      && mediaRect.width >= 120
      && mediaRect.height >= 64;
  };

  const bindMediaFetchLifecycle = (targets) => {
    const record = getEntryFetchRecord(targets, 'media');
    if (!record || !(record.target instanceof HTMLElement)) return;
    let disposed = false;
    let rafId = 0;
    let observer = null;
    const nodesBound = new WeakSet();

    const cleanup = () => {
      disposed = true;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (observer instanceof MutationObserver) {
        observer.disconnect();
        observer = null;
      }
    };

    const settle = () => {
      if (disposed) return;
      cleanup();
      void markTargetReady(targets, 'media');
    };

    const maybeSettle = () => {
      if (disposed) return;
      if (!mediaTargetLooksReady(record.target)) return;
      settle();
    };

    const bindLoadHandlers = () => {
      const nodes = Array.from(record.target.querySelectorAll('iframe, img, video'));
      nodes.forEach((node) => {
        if (!(node instanceof HTMLElement) || nodesBound.has(node)) return;
        nodesBound.add(node);
        node.addEventListener('load', maybeSettle, { once: true, passive: true });
      });
    };

    bindLoadHandlers();
    maybeSettle();
    if (record.state !== FETCH_STATE_LOADING) return;

    if (typeof MutationObserver === 'function') {
      observer = new MutationObserver(() => {
        bindLoadHandlers();
        maybeSettle();
      });
      observer.observe(record.target, ENTRY_FETCH_WATCH_OPTIONS);
    }

    const tick = () => {
      maybeSettle();
      const current = getEntryFetchRecord(targets, 'media');
      if (!disposed && current && current.state === FETCH_STATE_LOADING) {
        rafId = window.requestAnimationFrame(tick);
      }
    };
    rafId = window.requestAnimationFrame(tick);
    window.setTimeout(maybeSettle, 60);
    window.setTimeout(maybeSettle, 240);
  };

  const fitOverviewLookupText = () => {
    const lookup = document.querySelector('.dex-overview .overview-lookup');
    if (!(lookup instanceof HTMLElement)) return;
    const lookupItem = lookup.closest('.overview-item--lookup');
    const host = lookupItem instanceof HTMLElement ? lookupItem : lookup.parentElement;
    if (!(host instanceof HTMLElement)) return;

    const hostStyle = window.getComputedStyle(host);
    const availableWidth = Math.max(
      56,
      host.clientWidth
      - parseCssPx(hostStyle.paddingLeft)
      - parseCssPx(hostStyle.paddingRight)
      - 8,
    );

    const MIN_SIZE = 12;
    const MAX_SIZE = 34;
    const lookupStyle = window.getComputedStyle(lookup);
    const probe = document.createElement('span');
    probe.textContent = String(lookup.textContent || '').trim();
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    probe.style.whiteSpace = 'nowrap';
    probe.style.fontFamily = lookupStyle.fontFamily;
    probe.style.fontWeight = lookupStyle.fontWeight;
    probe.style.fontStyle = lookupStyle.fontStyle;
    probe.style.letterSpacing = lookupStyle.letterSpacing;
    probe.style.lineHeight = lookupStyle.lineHeight;
    probe.style.textTransform = lookupStyle.textTransform;
    probe.style.fontSize = `${MAX_SIZE}px`;
    host.appendChild(probe);
    const measuredWidth = Math.max(1, Math.ceil(probe.getBoundingClientRect().width));
    probe.remove();

    const SAFE_RATIO = 0.94;
    const fitSize = measuredWidth > availableWidth
      ? Math.max(MIN_SIZE, Math.floor((MAX_SIZE * (availableWidth / measuredWidth) * SAFE_RATIO) * 100) / 100)
      : MAX_SIZE;
    lookup.style.setProperty('font-size', `${fitSize}px`, 'important');
  };

  const bindOverviewLookupFit = () => {
    const schedule = () => window.requestAnimationFrame(() => fitOverviewLookupText());
    if (overviewLookupFitBound) {
      schedule();
      return;
    }
    overviewLookupFitBound = true;
    window.addEventListener('resize', schedule, { passive: true });
    if (typeof window.ResizeObserver === 'function') {
      overviewLookupResizeObserver = new ResizeObserver(schedule);
      const overview = document.querySelector('.dex-overview');
      const lookup = document.querySelector('.dex-overview .overview-lookup');
      if (overview instanceof HTMLElement) overviewLookupResizeObserver.observe(overview);
      if (lookup instanceof HTMLElement) overviewLookupResizeObserver.observe(lookup);
    }
    schedule();
    window.setTimeout(schedule, 60);
    window.setTimeout(schedule, 240);
  };

  const normalizeLocationPath = (pathname) => {
    const raw = String(pathname || '').trim();
    if (!raw) return '/';
    const clean = raw.startsWith('/') ? raw.replace(/\/+/g, '/') : `/${raw.replace(/\/+/g, '/')}`;
    if (clean === '/') return '/';
    return clean.endsWith('/') ? clean : `${clean}/`;
  };

  const seriesKey = (page) => {
    const raw = String(page.series || '').toLowerCase();
    if (raw === 'index' || raw === 'indes') return 'index';
    if (raw === 'dexfest') return 'dexfest';
    if (raw === 'dex') return 'dex';
    const u = String(page.specialEventImage || '').toLowerCase();
    if (u.includes('dexfest')) return 'dexfest';
    if (u.includes('/index')) return 'index';
    return 'dex';
  };

  const parseJsonScript = (id) => {
    const el = document.getElementById(id);
    if (!el) return null;
    try {
      return JSON.parse(el.textContent || '{}');
    } catch (error) {
      console.error(`Invalid JSON in #${id}`, error);
      return null;
    }
  };

  const normalizePublicProfileKey = (value) => String(value || '')
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const normalizePublicProfilePath = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const parsed = new URL(raw, window.location.href);
      return normalizeLocationPath(parsed.pathname || '/');
    } catch {
      return normalizeLocationPath(raw);
    }
  };

  const normalizePublicProfileRecord = (record) => {
    if (!record || typeof record !== 'object') return null;
    const handle = String(record.handle || '').replace(/^@+/, '').trim();
    const dexId = String(record.dex_id || record.dexId || '').trim();
    const creditName = String(record.credit_name || record.creditName || record.name || '').replace(/\s+/g, ' ').trim();
    if (!handle && !dexId) return null;
    const href = handle ? `/u/${encodeURIComponent(handle)}/` : '';
    return {
      handle,
      dex_id: dexId,
      credit_name: creditName,
      href,
    };
  };

  const publicProfileRecordsFromValue = (value) => {
    const source = Array.isArray(value) ? value : [value];
    return source.map(normalizePublicProfileRecord).filter(Boolean);
  };

  const loadPublicProfileMap = () => {
    if (publicProfileMapPromise) return publicProfileMapPromise;
    publicProfileMapPromise = fetch(PUBLIC_PROFILES_URL, { cache: 'no-store', credentials: 'same-origin' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const entries = payload && typeof payload === 'object' && payload.entries && typeof payload.entries === 'object'
          ? payload.entries
          : {};
        const direct = new Map();
        const folded = new Map();
        Object.entries(entries).forEach(([key, value]) => {
          const records = publicProfileRecordsFromValue(value);
          if (!records.length) return;
          const directKey = String(key || '').trim();
          const foldedKey = normalizePublicProfileKey(directKey);
          if (directKey) direct.set(directKey, records);
          if (foldedKey) folded.set(foldedKey, records);
        });
        return { direct, folded };
      })
      .catch(() => ({ direct: new Map(), folded: new Map() }));
    return publicProfileMapPromise;
  };

  const getPublicProfileCandidates = (map, page, lookup, entryHref) => {
    const keys = [
      lookup,
      page?.lookup,
      page?.lookupNumber,
      page?.slug,
      page?.entry_slug,
      page?.entrySlug,
      page?.entry_id,
      page?.entryId,
      page?.href,
      page?.url,
      entryHref,
      normalizePublicProfilePath(entryHref),
      String(window.location.pathname || ''),
      normalizePublicProfilePath(window.location.pathname || ''),
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    const seenKeys = new Set();
    const records = [];
    const seenProfiles = new Set();
    const addRecords = (items) => {
      publicProfileRecordsFromValue(items).forEach((record) => {
        const key = `${record.handle}|${record.dex_id}|${record.credit_name}`;
        if (seenProfiles.has(key)) return;
        seenProfiles.add(key);
        records.push(record);
      });
    };
    keys.forEach((key) => {
      if (seenKeys.has(key)) return;
      seenKeys.add(key);
      addRecords(map.direct.get(key));
      addRecords(map.folded.get(normalizePublicProfileKey(key)));
    });
    return records;
  };

  const readPersonLinks = (holder) => {
    try {
      const parsed = JSON.parse(holder.getAttribute('data-links') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writePersonLinks = (holder, links) => {
    if (!(holder instanceof HTMLElement)) return;
    holder.setAttribute('data-links', JSON.stringify(links || []));
  };

  const enhancePublicProfileAttribution = async ({ page, lookup, entryHref } = {}) => {
    const map = await loadPublicProfileMap();
    const records = getPublicProfileCandidates(map, page, lookup, entryHref);
    if (!records.length) return;
    const recordsByName = new Map();
    records.forEach((record) => {
      const key = normalizePublicProfileKey(record.credit_name);
      if (key && !recordsByName.has(key)) recordsByName.set(key, record);
    });
    if (!recordsByName.size) return;

    document.querySelectorAll('.dex-credits [data-person], .dex-credits [data-person-linkable="false"]').forEach((holder) => {
      if (!(holder instanceof HTMLElement)) return;
      const personName = String(holder.getAttribute('data-person') || holder.textContent || '').replace(/\s+/g, ' ').trim();
      const record = recordsByName.get(normalizePublicProfileKey(personName));
      if (!record || !record.href) return;
      holder.classList.add('dx-public-profile-linked');
      holder.setAttribute('data-dx-public-profile-href', record.href);

      if (holder.getAttribute('data-person-linkable') === 'true') {
        const links = readPersonLinks(holder)
          .map((link) => ({
            label: String(link?.label || '').trim(),
            href: String(link?.href || '').trim(),
          }))
          .filter((link) => link.label && link.href);
        if (!links.some((link) => link.href === record.href)) {
          links.unshift({ label: 'Dex profile', href: record.href });
          writePersonLinks(holder, links);
        }
        return;
      }

      if (holder.dataset.dxPublicProfileLinked === '1') return;
      holder.dataset.dxPublicProfileLinked = '1';
      const anchor = document.createElement('a');
      anchor.className = 'person-text dx-public-profile-link';
      anchor.setAttribute('data-dx-public-profile-link', 'true');
      anchor.href = record.href;
      anchor.textContent = holder.textContent || personName;
      holder.replaceWith(anchor);
    });
  };

  const pin = (person) => {
    if (!person || typeof person === 'string') return person || '';
    const name = person.name || '';
    const links = Array.isArray(person.links) ? person.links : [];
    if (!links.length) return `<span class="person-text" data-person="${escapeHtml(name)}" data-person-linkable="false">${escapeHtml(name)}</span>`;
    return `<span class="person-link" data-person="${escapeHtml(name)}" data-links='${escapeHtml(JSON.stringify(links))}' data-person-linkable="true" role="button" tabindex="0" aria-haspopup="dialog" aria-expanded="false">${escapeHtml(name)}<span class="person-pin" aria-hidden="true"></span></span>`;
  };

  const normalizePersonKey = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();

  const normalizeLinksByPersonMap = (raw) => {
    const map = new Map();
    if (!raw || typeof raw !== 'object') return map;
    Object.entries(raw).forEach(([nameRaw, linksRaw]) => {
      const key = normalizePersonKey(nameRaw);
      if (!key) return;
      const links = Array.isArray(linksRaw) ? linksRaw : [];
      const next = links
        .map((link) => ({
          label: String(link?.label || '').trim(),
          href: String(link?.href || '').trim(),
        }))
        .filter((link) => link.label && link.href);
      if (next.length) map.set(key, next);
    });
    return map;
  };

  const pinWithLinks = (name, linksByPerson = new Map()) => {
    const clean = String(name || '').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    const links = linksByPerson.get(normalizePersonKey(clean)) || [];
    return pin({ name: clean, links });
  };

  const pinValue = (value, linksByPerson = new Map()) => {
    if (Array.isArray(value)) {
      return value
        .map((item) => pinValue(item, linksByPerson))
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .join(', ');
    }
    if (value && typeof value === 'object') {
      if (typeof value.name === 'string') {
        const cleanName = String(value.name || '').replace(/\s+/g, ' ').trim();
        if (!cleanName) return '';
        const ownLinks = Array.isArray(value.links)
          ? value.links
            .map((link) => ({
              label: String(link?.label || '').trim(),
              href: String(link?.href || '').trim(),
            }))
            .filter((link) => link.label && link.href)
          : [];
        const fallbackLinks = linksByPerson.get(normalizePersonKey(cleanName)) || [];
        return pin({ name: cleanName, links: ownLinks.length ? ownLinks : fallbackLinks });
      }
      return '';
    }
    const text = String(value || '').trim();
    if (!text) return '';
    if (/<[^>]+>/.test(text) || /data-person-linkable\s*=/.test(text)) return text;
    return text
      .split(',')
      .map((part) => pinWithLinks(part, linksByPerson))
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .join(', ');
  };

  const renderStretchHeading = (value, { seedKey = '', uppercase = true } = {}) => {
    const input = uppercase ? String(value || '').toUpperCase() : String(value || '');
    const runtime = window.__dxHeadingFx;
    const stripHeadingSeparators = (text) => String(text == null ? '' : text).replace(/\u200C/g, '');
    if (runtime && typeof runtime.renderHeadingText === 'function') {
      try {
        return stripHeadingSeparators(runtime.renderHeadingText(input, { uppercase: false, seedKey: seedKey || input }) || input);
      } catch {}
    }
    return stripHeadingSeparators(input);
  };

  const randomizeTitle = (txt, options = {}) => renderStretchHeading(txt, options);
  const injectCollectionZwnj = (value) => String(value == null ? '' : value).replace(/(L)(L)/i, '$1\u200C$2');
  let entryPageTitleCanonicalCache;
  const resolveEntryPageTitleCanonical = () => {
    if (entryPageTitleCanonicalCache !== undefined) return entryPageTitleCanonicalCache;
    const pageCfg = parseJsonScript('dex-sidebar-page-config') || window.dexSidebarPageConfig || {};
    const canonical = String(pageCfg?.title || '').trim();
    entryPageTitleCanonicalCache = canonical;
    return entryPageTitleCanonicalCache;
  };
  const addNaturalDuplicateSeparators = (value, canonicalValue = '') => {
    const source = String(value == null ? '' : value);
    const canonical = String(canonicalValue == null ? '' : canonicalValue).replace(/\u200C/g, '').replace(/\u200D/g, '');
    let output = '';
    let canonicalIndex = 0;
    for (let i = 0; i < source.length; i += 1) {
      const current = source.charAt(i);
      const next = source.charAt(i + 1);
      output += current;
      if (!next) continue;
      if (current === '\u200C' || current === '\u200D' || next === '\u200C' || next === '\u200D') continue;
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
      output += isNaturalPair ? '\u200C' : '\u200D';
    }
    return output;
  };
  const clearEntryPageTitleSeparatorWatcher = () => {
    if (!(entryPageTitleSeparatorObserver instanceof MutationObserver)) return;
    try {
      entryPageTitleSeparatorObserver.disconnect();
    } catch {}
    entryPageTitleSeparatorObserver = null;
  };
  const normalizeEntryPageTitleSeparators = (scope = document) => {
    if (!(scope instanceof Document || scope instanceof HTMLElement)) return;
    const titles = scope.querySelectorAll('[data-dex-entry-page-title], .dex-entry-page-title');
    titles.forEach((titleNode) => {
      if (!(titleNode instanceof HTMLElement)) return;
      const raw = String(titleNode.textContent || '');
      if (!raw) return;
      const canonicalFromNode = String(titleNode.getAttribute('data-dx-title-canonical') || '').trim();
      const canonicalTitle = canonicalFromNode || resolveEntryPageTitleCanonical() || raw;
      if (!canonicalFromNode && canonicalTitle) {
        titleNode.setAttribute('data-dx-title-canonical', canonicalTitle);
      }
      const normalized = addNaturalDuplicateSeparators(raw, canonicalTitle);
      if (normalized !== raw) titleNode.textContent = normalized;
    });
  };
  const buildSubtitleTagsText = (cfg = {}) => {
    const tags = Array.isArray(cfg?.metadata?.tags)
      ? cfg.metadata.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
      : [];
    if (!tags.length) return '';
    return `🏷 Tags: ${tags.join(', ')}`;
  };
  const buildSubtitleSpecsText = (cfg = {}) => {
    const parts = [];
    const bitDepth = String(cfg?.fileSpecs?.bitDepth ?? '').trim();
    const sampleRate = String(cfg?.fileSpecs?.sampleRate ?? '').trim();
    const channels = String(cfg?.fileSpecs?.channels ?? '').trim();
    if (bitDepth) parts.push(`🎚 ${bitDepth}-bit`);
    if (sampleRate) parts.push(`🔊 ${sampleRate} Hz`);
    if (channels) parts.push(`🎧 ${channels}`);
    return parts.join(' ');
  };
  const applySubtitleMetaItems = (cfg = {}) => {
    const subtitle = document.querySelector('[data-dex-entry-subtitle], .dex-entry-subtitle');
    if (!(subtitle instanceof HTMLElement)) return;

    Array.from(subtitle.querySelectorAll('[data-dx-subtitle-extra]')).forEach((node) => node.remove());

    const appendItem = (kind, value) => {
      const text = String(value || '').trim();
      if (!text) return;
      const item = document.createElement('span');
      item.className = 'dex-entry-subtitle-item dex-entry-subtitle-item--meta';
      item.setAttribute('data-dx-subtitle-extra', kind);
      const content = document.createElement('span');
      content.className = 'dex-entry-subtitle-value';
      content.textContent = text;
      item.appendChild(content);
      subtitle.appendChild(item);
    };

    appendItem('tags', buildSubtitleTagsText(cfg));
    appendItem('specs', buildSubtitleSpecsText(cfg));
  };
  const ensureDownloadOnlyFileInfoCard = (seedBase = '') => {
    const fileInfo = document.querySelector('.dex-file-info');
    if (!(fileInfo instanceof HTMLElement)) return;
    const headingSeed = seedBase || `${window.location.pathname || '/'}|file-info|download`;
    fileInfo.innerHTML = `
      <h3 data-dx-entry-heading="1">${randomizeTitle('Download', { seedKey: headingSeed })}</h3>
      <div class="file-info-panels">
        <div id="downloads" role="tabpanel"></div>
      </div>
    `;
  };
  const bindEntryPageTitleSeparatorWatcher = (scope = document) => {
    if (!(scope instanceof Document || scope instanceof HTMLElement)) return;
    clearEntryPageTitleSeparatorWatcher();

    const applyNow = () => normalizeEntryPageTitleSeparators(scope instanceof Document ? scope : document);
    applyNow();
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(applyNow);
    } else {
      window.setTimeout(applyNow, 0);
    }
    window.setTimeout(applyNow, 60);

    if (typeof MutationObserver !== 'function') return;
    const observer = new MutationObserver(() => {
      applyNow();
    });

    const titleTargets = Array.from(
      (scope instanceof Document ? scope : document).querySelectorAll('[data-dex-entry-page-title], .dex-entry-page-title'),
    ).filter((node) => node instanceof HTMLElement);

    if (titleTargets.length) {
      titleTargets.forEach((node) => {
        observer.observe(node, { childList: true, characterData: true, subtree: true });
      });
    }

    const header = (scope instanceof Document ? scope : document).querySelector('.dex-entry-header');
    if (header instanceof HTMLElement) {
      observer.observe(header, { childList: true, subtree: true });
    } else if ((scope instanceof Document ? scope.body : scope) instanceof HTMLElement) {
      observer.observe((scope instanceof Document ? scope.body : scope), { childList: true, subtree: true });
    }
    entryPageTitleSeparatorObserver = observer;
  };
  const addZeroWidthJoiners = (value) => {
    const cleaned = String(value == null ? '' : value).replace(/\u200C/g, '');
    let output = '';
    for (let i = 0; i < cleaned.length; i += 1) {
      const current = cleaned.charAt(i);
      const next = cleaned.charAt(i + 1);
      output += current;
      if (!next) continue;
      const isAlphaPair = current.toLowerCase() !== current.toUpperCase()
        && next.toLowerCase() !== next.toUpperCase();
      if (!isAlphaPair) continue;
      if (current.toLowerCase() !== next.toLowerCase()) continue;
      output += '\u200D';
    }
    return output;
  };
  const randomizeTitleWithJoiners = (txt, options = {}) => addZeroWidthJoiners(randomizeTitle(txt, options));
  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const render = (sel, title, html, noHeader = false) => {
    const el = document.querySelector(sel);
    if (!el) return;
    const headingSeed = `${window.location.pathname || '/'}|${sel}|${title}`;
    const header = noHeader ? '' : `<h3 data-dx-entry-heading="1">${randomizeTitle(title, { seedKey: headingSeed })}</h3>`;
    el.innerHTML = `${header}${html}`;
  };

  const DEFAULT_ASSETS_API = 'https://dex-api.spring-fog-8edd.workers.dev';
  const MAX_BUNDLE_POLLS = 30;

  const resolveAssetsApiBase = () => {
    const configured = String(window.DEX_API_BASE_URL || window.DEX_API_ORIGIN || DEFAULT_ASSETS_API || '').trim();
    return configured.replace(/\/+$/, '');
  };

  const parseAssetRefToken = (value) => {
    const raw = String(value || '').trim();
    if (!raw || /^https?:\/\//i.test(raw)) return null;
    const pivot = raw.indexOf(':');
    if (pivot <= 0 || pivot >= raw.length - 1) return null;
    const kind = raw.slice(0, pivot).toLowerCase();
    const tokenValue = raw.slice(pivot + 1).trim();
    if (!tokenValue) return null;
    if (kind === 'lookup') {
      if (!/^[A-Z]\.[A-Za-z0-9._-]{1,64}$/i.test(tokenValue)
        && !/^SUB\d{2,4}-[A-Z]\.[A-Za-z]{3}\s[A-Za-z]{2}\s(?:AV|A|V|O)\d{4}$/i.test(tokenValue)
        && !/^[A-Z]\.[A-Za-z]{3}\.\s[A-Za-z]{2}\s(?:AV|A|V|O)\d{4}(?:\sS\d+)?$/i.test(tokenValue)) {
        return null;
      }
      return { kind, value: tokenValue, normalized: `lookup:${tokenValue}` };
    }
    if (kind === 'asset' || kind === 'bundle') {
      const pattern = kind === 'bundle'
        ? /^[A-Za-z0-9._:\- ]{3,240}$/
        : /^[A-Za-z0-9._:-]{3,160}$/;
      if (!pattern.test(tokenValue)) return null;
      return { kind, value: tokenValue, normalized: `${kind}:${tokenValue}` };
    }
    return null;
  };

  const parseRecordingIndexPdfToken = (value) => {
    const parsed = parseAssetRefToken(value);
    if (!parsed) return null;
    if (parsed.kind === 'lookup' || parsed.kind === 'asset') return parsed;
    return null;
  };

  const parseRecordingIndexBundleToken = (value) => {
    const parsed = parseAssetRefToken(value);
    if (!parsed) return null;
    if (parsed.kind === 'bundle') return parsed;
    return null;
  };

  const buildEntryTooltipMarkup = (target, fallbackTooltip = '') => {
    if (!(target instanceof HTMLElement)) return '';
    const bucketKey = String(target.getAttribute('data-dx-bucket-key') || '').trim().toUpperCase();
    const statusRaw = String(target.getAttribute('data-dx-tooltip-status') || '').trim().toLowerCase();
    const fileTypes = String(target.getAttribute('data-dx-tooltip-file-types') || '').trim();
    const videoQuality = String(target.getAttribute('data-dx-tooltip-video-quality') || '').trim();
    const audioMp3 = String(target.getAttribute('data-dx-tooltip-audio-mp3') || '').trim();
    const audioMp3Available = String(target.getAttribute('data-dx-tooltip-audio-mp3-available') || '').trim().toLowerCase() === 'yes';
    const audioWav = String(target.getAttribute('data-dx-tooltip-audio-wav') || '').trim();
    const video1080 = String(target.getAttribute('data-dx-tooltip-video-1080p') || '').trim();
    const video4k = String(target.getAttribute('data-dx-tooltip-video-4k') || '').trim();
    const video1080Available = String(target.getAttribute('data-dx-tooltip-video-1080p-available') || '').trim().toLowerCase() === 'yes';
    const video4kAvailable = String(target.getAttribute('data-dx-tooltip-video-4k-available') || '').trim().toLowerCase() === 'yes';
    const totalFiles = String(target.getAttribute('data-dx-tooltip-total-files') || '').trim();

    const hasStructuredMetrics = statusRaw
      || fileTypes
      || videoQuality
      || audioMp3
      || audioWav
      || video1080
      || video4k
      || totalFiles;
    if (!hasStructuredMetrics) return '';

    const title = escapeHtml(bucketKey ? `${bucketKey} BUCKET` : String(fallbackTooltip || '').trim());
    const bucketDescriptorMap = {
      A: 'Full edited cut',
      B: 'Files split by Part',
      C: 'Files split by Section',
      D: 'Files split by Phrase',
      E: 'Files per by Moment',
      X: 'Extras',
    };
    const descriptor = escapeHtml(bucketDescriptorMap[bucketKey] || '');
    const status = statusRaw === 'available' ? 'available' : 'unavailable';
    const statusLabel = status === 'available' ? 'Available' : 'Unavailable';
    const normalizeLabel = (value, fallback = '—') => {
      const safe = String(value || '').trim();
      return safe || fallback;
    };
    const metrics = [
      ['File Types', normalizeLabel(fileTypes, 'None')],
      ['Video Quality', normalizeLabel(videoQuality, 'None')],
      ['Audio WAV', normalizeLabel(audioWav, 'n/a')],
    ];
    if (audioMp3Available) metrics.push(['Audio MP3', normalizeLabel(audioMp3, '—')]);
    if (video1080Available) metrics.push(['Video 1080p', normalizeLabel(video1080, '—')]);
    if (video4kAvailable) metrics.push(['Video 4K', normalizeLabel(video4k, '—')]);
    metrics.push(['Total Files', normalizeLabel(totalFiles, '0')]);
    const metricRows = metrics
      .map(([label, value]) => `
        <div class="dx-submit-tooltip-metric" style="display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:8px;align-items:baseline;">
          <dt style="margin:0;font:600 0.58rem/1.15 var(--font-body, 'Courier Prime', monospace);letter-spacing:0.02em;text-transform:uppercase;opacity:0.72;">${escapeHtml(label)}</dt>
          <dd style="margin:0;font:700 0.63rem/1.15 var(--font-body, 'Courier Prime', monospace);letter-spacing:0.01em;text-transform:uppercase;">${escapeHtml(value)}</dd>
        </div>
      `)
      .join('');

    return `
      <div class="dx-submit-tooltip-card" style="display:grid;gap:8px;min-width:196px;max-width:min(312px,calc(100vw - 16px));">
        <div class="dx-submit-tooltip-head" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <span class="dx-submit-tooltip-title" style="margin:0;font:800 0.78rem/1 var(--font-heading, 'Typefesse', sans-serif);letter-spacing:0.05em;text-transform:uppercase;">${title}</span>
          <span class="dx-submit-tooltip-status is-${status}" style="display:inline-flex;align-items:center;justify-content:center;padding:2px 8px;border-radius:999px;border:1px solid ${status === 'available' ? 'rgba(255,25,16,0.55)' : 'rgba(20,22,29,0.24)'};font:700 0.56rem/1 var(--font-body, 'Courier Prime', monospace);letter-spacing:0.03em;text-transform:uppercase;white-space:nowrap;color:${status === 'available' ? '#fff' : 'rgba(20,22,29,0.82)'};background:${status === 'available' ? 'linear-gradient(130deg, rgba(255, 25, 16, 0.92), rgba(255, 140, 16, 0.92))' : 'rgba(255,255,255,0.76)'};">${statusLabel}</span>
        </div>
        ${descriptor ? `<p class="dx-submit-tooltip-descriptor" style="margin:0;font:500 0.61rem/1.25 var(--font-body, 'Courier Prime', monospace);letter-spacing:0.01em;opacity:0.8;">${descriptor}</p>` : ''}
        <dl class="dx-submit-tooltip-metrics" style="margin:0;display:grid;gap:3px;">${metricRows}</dl>
      </div>
    `;
  };

  const ensureEntryTooltipLayer = () => {
    let layer = document.getElementById('dx-submit-tooltip-layer');
    if (layer instanceof HTMLElement) {
      ensureFetchShell(layer, 'rows', TOOLTIP_FETCH_SHELL_MARKER);
      return layer;
    }
    layer = document.createElement('div');
    layer.id = 'dx-submit-tooltip-layer';
    layer.setAttribute('role', 'tooltip');
    layer.setAttribute('aria-hidden', 'true');
    layer.setAttribute('data-state', 'hidden');
    layer.setAttribute('data-dx-tooltip-layer', '1');
    layer.setAttribute('data-dx-fetch-state', FETCH_STATE_READY);
    layer.hidden = true;
    layer.style.position = 'fixed';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '2147483000';
    layer.style.left = '0px';
    layer.style.top = '0px';
    layer.style.visibility = 'hidden';
    layer.style.opacity = '0';
    layer.style.setProperty('display', 'none', 'important');
    layer.style.padding = '10px 12px';
    layer.style.borderRadius = '10px';
    layer.style.border = '1px solid rgba(15, 19, 28, 0.18)';
    layer.style.background = 'linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 255, 0.95))';
    layer.style.boxShadow = '0 14px 28px rgba(9, 14, 24, 0.2)';
    layer.style.backdropFilter = 'blur(10px)';
    layer.style.webkitBackdropFilter = 'blur(10px)';
    layer.style.whiteSpace = 'normal';
    layer.style.color = 'rgba(18, 21, 28, 0.94)';
    layer.style.font = "600 11px/1.35 var(--font-body, 'Courier Prime', monospace)";
    layer.appendChild(document.createElement('div')).className = 'dx-submit-tooltip-content';
    ensureFetchShell(layer, 'rows', TOOLTIP_FETCH_SHELL_MARKER);
    document.body.appendChild(layer);
    return layer;
  };

  const getTooltipContentNode = (layer) => {
    if (!(layer instanceof HTMLElement)) return null;
    let content = layer.querySelector(':scope > .dx-submit-tooltip-content');
    if (content instanceof HTMLElement) return content;
    content = document.createElement('div');
    content.className = 'dx-submit-tooltip-content';
    layer.appendChild(content);
    return content;
  };

  const clearEntryTooltipMetricObserver = () => {
    if (!(activeEntryTooltipMetricsObserver instanceof MutationObserver)) return;
    try {
      activeEntryTooltipMetricsObserver.disconnect();
    } catch {}
    activeEntryTooltipMetricsObserver = null;
  };

  const hasBucketTooltipMetrics = (target) => {
    if (!(target instanceof HTMLElement)) return false;
    return BUCKET_TOOLTIP_METRIC_ATTRS.every((attr) => hasMeaningfulText(target.getAttribute(attr)));
  };

  const setTooltipFetchState = (layer, state) => {
    if (!(layer instanceof HTMLElement)) return;
    setFetchState(layer, state);
    layer.setAttribute('data-dx-tooltip-fetch-state', state);
  };

  const armEntryTooltipMetricObserver = (target) => {
    clearEntryTooltipMetricObserver();
    if (!(target instanceof HTMLElement)) return;
    if (hasBucketTooltipMetrics(target)) return;
    if (typeof MutationObserver !== 'function') return;
    const observer = new MutationObserver(() => {
      if (!(activeEntryTooltipTarget instanceof HTMLElement) || activeEntryTooltipTarget !== target) {
        clearEntryTooltipMetricObserver();
        return;
      }
      if (!hasBucketTooltipMetrics(target)) return;
      clearEntryTooltipMetricObserver();
      showEntryTooltip(target);
    });
    observer.observe(target, { attributes: true, attributeFilter: BUCKET_TOOLTIP_METRIC_ATTRS });
    activeEntryTooltipMetricsObserver = observer;
  };

  const hideEntryTooltip = () => {
    activeEntryTooltipTarget = null;
    clearEntryTooltipMetricObserver();
    const layer = document.getElementById('dx-submit-tooltip-layer');
    if (!(layer instanceof HTMLElement)) return;
    const content = getTooltipContentNode(layer);
    if (content instanceof HTMLElement) content.textContent = '';
    setTooltipFetchState(layer, FETCH_STATE_READY);
    layer.setAttribute('aria-hidden', 'true');
    layer.setAttribute('data-state', 'hidden');
    layer.hidden = true;
    layer.style.setProperty('display', 'none', 'important');
    layer.style.setProperty('visibility', 'hidden', 'important');
    layer.style.setProperty('opacity', '0', 'important');
    layer.removeAttribute('data-rich');
  };

  const positionEntryTooltip = (layer, target) => {
    if (!(layer instanceof HTMLElement) || !(target instanceof HTMLElement)) return;
    const viewportPadding = 8;
    layer.style.left = '0px';
    layer.style.top = '0px';
    layer.style.maxWidth = `${Math.max(160, Math.min(280, window.innerWidth - viewportPadding * 2))}px`;

    const targetRect = target.getBoundingClientRect();
    const tooltipRect = layer.getBoundingClientRect();

    let left = targetRect.left + ((targetRect.width - tooltipRect.width) / 2);
    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - tooltipRect.width - viewportPadding));

    let top = targetRect.bottom + 8;
    if (top + tooltipRect.height > window.innerHeight - viewportPadding) {
      top = targetRect.top - tooltipRect.height - 8;
    }
    top = Math.max(viewportPadding, top);

    layer.style.left = `${Math.round(left)}px`;
    layer.style.top = `${Math.round(top)}px`;
  };

  const showEntryTooltip = (target) => {
    if (!(target instanceof HTMLElement)) return;
    const tooltip = String(target.getAttribute('data-dx-tooltip') || '').trim();
    if (!tooltip) {
      hideEntryTooltip();
      return;
    }
    const layer = ensureEntryTooltipLayer();
    const content = getTooltipContentNode(layer);
    if (!(content instanceof HTMLElement)) return;
    clearEntryTooltipMetricObserver();
    const richMarkup = buildEntryTooltipMarkup(target, tooltip);
    if (richMarkup) {
      content.innerHTML = richMarkup;
      layer.setAttribute('data-rich', '1');
      setTooltipFetchState(layer, FETCH_STATE_READY);
    } else {
      content.textContent = tooltip;
      layer.removeAttribute('data-rich');
      setTooltipFetchState(layer, FETCH_STATE_LOADING);
      armEntryTooltipMetricObserver(target);
    }
    layer.hidden = false;
    layer.removeAttribute('hidden');
    layer.style.setProperty('display', 'block', 'important');
    layer.style.setProperty('visibility', 'visible', 'important');
    layer.style.setProperty('opacity', '1', 'important');
    layer.style.setProperty('z-index', '2147483000', 'important');
    layer.style.setProperty('pointer-events', 'none', 'important');
    layer.setAttribute('aria-hidden', 'false');
    layer.setAttribute('data-state', 'visible');
    activeEntryTooltipTarget = target;
    positionEntryTooltip(layer, target);
  };

  const resolveEntryTooltipTarget = (input, scope) => {
    if (!(input instanceof Element)) return null;
    const target = input.closest('[data-dx-tooltip]');
    if (!(target instanceof HTMLElement)) return null;
    if (!(scope instanceof HTMLElement) || !scope.contains(target)) return null;
    return target;
  };

  const resolveActiveEntryFooter = () => {
    const candidates = Array.from(document.querySelectorAll('.dx-slot-profile-footer .dex-footer-section, #footer-sections .dex-footer-section, .dex-footer.dx-profile-footer-portaled, #footer-sections .dex-footer, .dex-footer'));
    let best = null;
    let bestScore = -1;
    candidates.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number.parseFloat(style.opacity || '1') <= 0) return;
      const rect = node.getBoundingClientRect();
      if (rect.height <= 1 || rect.width <= 1) return;
      const bottomDistance = Math.abs(window.innerHeight - rect.bottom);
      const bottomProximity = Math.max(0, 420 - bottomDistance);
      const bottomOcclusion = Math.max(0, window.innerHeight - Math.max(0, rect.top));
      const footerExtent = Math.max(rect.height, bottomOcclusion);
      const score = (footerExtent * 6) + (bottomProximity * 5);
      if (score > bestScore) {
        bestScore = score;
        best = node;
      }
    });
    return best;
  };

  const bindEntryTooltips = (scope) => {
    if (!(scope instanceof HTMLElement)) return;
    if (scope.__dxEntryTooltipAbortController instanceof AbortController) {
      try {
        scope.__dxEntryTooltipAbortController.abort();
      } catch {}
    }

    const controller = new AbortController();
    scope.__dxEntryTooltipAbortController = controller;
    const options = { signal: controller.signal };
    const pointerSupported = typeof window.PointerEvent === 'function';
    const addScopedListener = (target, type, handler, opts = options) => {
      try {
        target.addEventListener(type, handler, opts);
      } catch {
        target.addEventListener(type, handler);
      }
    };

    hideEntryTooltip();
    const tooltipNodes = Array.from(scope.querySelectorAll('[data-dx-tooltip]'));
    tooltipNodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      const tooltipText = String(node.getAttribute('data-dx-tooltip') || '').trim();
      if (!tooltipText) return;
      node.removeAttribute('title');
      if (!node.getAttribute('aria-label')) node.setAttribute('aria-label', tooltipText);
    });

    addScopedListener(scope, 'focusin', (event) => {
      const target = resolveEntryTooltipTarget(event.target, scope);
      if (!target) return;
      showEntryTooltip(target);
    });

    addScopedListener(scope, 'focusout', (event) => {
      const next = resolveEntryTooltipTarget(event.relatedTarget, scope);
      if (next) {
        showEntryTooltip(next);
        return;
      }
      hideEntryTooltip();
    });

    const leaveToNextTarget = (event, node) => {
      const next = resolveEntryTooltipTarget(event?.relatedTarget, scope);
      if (next && next !== node) {
        showEntryTooltip(next);
        return;
      }
      if (activeEntryTooltipTarget === node) hideEntryTooltip();
    };

    tooltipNodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (pointerSupported) {
        addScopedListener(node, 'pointerenter', () => showEntryTooltip(node), { ...options, capture: true });
        addScopedListener(node, 'pointerleave', (event) => leaveToNextTarget(event, node), { ...options, capture: true });
      } else {
        addScopedListener(node, 'mouseenter', () => showEntryTooltip(node), { ...options, capture: true });
        addScopedListener(node, 'mouseleave', (event) => leaveToNextTarget(event, node), { ...options, capture: true });
      }
    });

    addScopedListener(scope, 'keydown', (event) => {
      if (event.key !== 'Escape') return;
      hideEntryTooltip();
    });

    addScopedListener(window, 'scroll', () => {
      if (!(activeEntryTooltipTarget instanceof HTMLElement)) return;
      const layer = document.getElementById('dx-submit-tooltip-layer');
      if (layer instanceof HTMLElement && !layer.hidden) {
        if (!document.contains(activeEntryTooltipTarget)) {
          hideEntryTooltip();
          return;
        }
        positionEntryTooltip(layer, activeEntryTooltipTarget);
      }
    }, { signal: controller.signal, passive: true });

    addScopedListener(window, 'resize', () => {
      if (!(activeEntryTooltipTarget instanceof HTMLElement)) return;
      const layer = document.getElementById('dx-submit-tooltip-layer');
      if (layer instanceof HTMLElement && !layer.hidden) {
        if (!document.contains(activeEntryTooltipTarget)) {
          hideEntryTooltip();
          return;
        }
        positionEntryTooltip(layer, activeEntryTooltipTarget);
      }
    });
  };

  const applyEntryRailLayout = () => {
    const layout = document.querySelector('.dex-entry-layout');
    const main = layout?.querySelector('.dex-entry-main');
    const sidebar = layout?.querySelector('.dex-sidebar');
    const header = document.querySelector('.dex-entry-header');
    const footer = resolveActiveEntryFooter();
    if (!(layout instanceof HTMLElement) || !(main instanceof HTMLElement) || !(sidebar instanceof HTMLElement) || !(header instanceof HTMLElement)) return;

    const desktop = window.innerWidth >= ENTRY_RAIL_BREAKPOINT;
    const root = document.documentElement;
    const globalHeader = document.querySelector('.header-announcement-bar-wrapper, #header, #siteHeader');
    const docStyle = window.getComputedStyle(document.documentElement);
    const bodyStyle = window.getComputedStyle(document.body);
    let headerOffset = parseCssPx(docStyle.getPropertyValue('--dx-fixed-header-top'))
      + parseCssPx(docStyle.getPropertyValue('--dx-slot-content-offset'));
    if (!headerOffset && globalHeader instanceof HTMLElement) {
      const style = window.getComputedStyle(globalHeader);
      if (style.position === 'fixed' || style.position === 'sticky') {
        const rect = globalHeader.getBoundingClientRect();
        headerOffset = Math.min(120, Math.max(0, Math.ceil(rect.bottom + 8)));
      }
    }
    root.style.setProperty('--dx-entry-header-offset', `${headerOffset}px`);
    if (!desktop) {
      root.setAttribute('data-dx-entry-rail-mode', 'mobile-flow');
      document.body.setAttribute('data-dx-entry-rail-mode', 'mobile-flow');
      document.body.classList.remove('dx-entry-desktop-fixed');
      root.style.removeProperty('--dx-entry-rails-height');
      root.style.removeProperty('--dx-entry-rail-inline-pad');
      root.style.removeProperty('--dx-entry-footer-inline-pad');
      root.style.removeProperty('--dx-entry-footer-gap');
      document.body.style.removeProperty('overflow');
      main.style.removeProperty('height');
      main.style.removeProperty('max-height');
      sidebar.style.removeProperty('height');
      sidebar.style.removeProperty('max-height');
      main.style.removeProperty('overflow-y');
      sidebar.style.removeProperty('overflow-y');
      layout.setAttribute('data-dx-entry-rail-mode', 'mobile-flow');
      entryRailLastMode = 'mobile-flow';
      return;
    }

    const resetEntryScrollRoots = () => {
      const resetElement = (node) => {
        if (!(node instanceof HTMLElement)) return;
        node.scrollTop = 0;
        node.scrollLeft = 0;
        try { node.scrollTo({ top: 0, left: 0, behavior: 'auto' }); } catch {}
      };
      resetElement(document.scrollingElement);
      resetElement(document.documentElement);
      resetElement(document.body);
      resetElement(document.getElementById('dx-slot-scroll-root'));
      resetElement(document.getElementById('dx-slot-foreground-root'));
      resetElement(document.getElementById('siteWrapper'));
      resetElement(document.querySelector('.site-wrapper'));
      try { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); } catch {}
    };

    const docScroll = Math.max(
      Math.abs(window.scrollY || 0),
      Math.abs(window.pageYOffset || 0),
      Math.abs((document.scrollingElement && document.scrollingElement.scrollTop) || 0),
      Math.abs(document.documentElement.scrollTop || 0),
      Math.abs(document.body.scrollTop || 0)
    );
    const slotRoot = document.getElementById('dx-slot-scroll-root');
    const slotScroll = slotRoot instanceof HTMLElement ? Math.abs(slotRoot.scrollTop || 0) : 0;
    if (entryRailLastMode !== 'desktop-fixed' || docScroll > 1 || slotScroll > 1) {
      resetEntryScrollRoots();
      window.requestAnimationFrame(resetEntryScrollRoots);
      window.setTimeout(resetEntryScrollRoots, 40);
    }

    let bottomInset = 20;
    let footerIsOverlay = false;
    if (footer instanceof HTMLElement) {
      const footerStyle = window.getComputedStyle(footer);
      footerIsOverlay = footerStyle.position === 'fixed' || footerStyle.position === 'sticky';
    }
    const footerBottomVar = parseFirstCssPx(
      docStyle.getPropertyValue('--dx-profile-footer-bottom'),
      bodyStyle.getPropertyValue('--dx-profile-footer-bottom')
    );
    const footerHeightVar = parseFirstCssPx(
      docStyle.getPropertyValue('--dx-profile-footer-height'),
      docStyle.getPropertyValue('--dx-profile-footer-height-effective'),
      bodyStyle.getPropertyValue('--dx-profile-footer-height'),
      bodyStyle.getPropertyValue('--dx-profile-footer-height-effective')
    );
    if (footerHeightVar > 0 && (footerIsOverlay || !(footer instanceof HTMLElement))) {
      bottomInset = Math.max(bottomInset, Math.ceil(footerBottomVar + footerHeightVar + 12));
    }
    if (footer instanceof HTMLElement) {
      const footerRect = footer.getBoundingClientRect();
      const footerStyle = window.getComputedStyle(footer);
      const isOverlayFooter = footerStyle.position === 'fixed' || footerStyle.position === 'sticky';
      const bottomOcclusion = Math.max(0, window.innerHeight - Math.max(0, footerRect.top));
      const footerExtent = isOverlayFooter ? Math.max(footerRect.height, bottomOcclusion) : footerRect.height;
      if (footerExtent > 0) {
        const footerPad = isOverlayFooter ? 12 : 8;
        bottomInset = Math.max(bottomInset, Math.ceil(footerExtent + footerPad));
      }
    }

    const layoutRect = layout.getBoundingClientRect();
    const topInset = Math.max(0, Math.ceil(layoutRect.top));
    const available = Math.max(280, Math.floor(window.innerHeight - topInset - bottomInset));
    const railInlinePad = Math.max(14, Math.min(24, Math.round(window.innerWidth * 0.016)));
    const footerGap = Math.max(16, Math.min(42, Math.round(Math.max(railInlinePad * 1.1, bottomInset * 0.16))));
    root.style.setProperty('--dx-entry-rails-height', `${available}px`);
    root.style.setProperty('--dx-entry-rail-inline-pad', `${railInlinePad}px`);
    root.style.setProperty('--dx-entry-footer-inline-pad', `${railInlinePad}px`);
    root.style.setProperty('--dx-entry-footer-gap', `${footerGap}px`);
    root.setAttribute('data-dx-entry-rail-mode', 'desktop-fixed');
    document.body.setAttribute('data-dx-entry-rail-mode', 'desktop-fixed');
    document.body.classList.add('dx-entry-desktop-fixed');
    document.body.style.overflow = 'hidden';

    main.style.setProperty('height', `${available}px`, 'important');
    main.style.setProperty('max-height', `${available}px`, 'important');
    sidebar.style.setProperty('height', `${available}px`, 'important');
    sidebar.style.setProperty('max-height', `${available}px`, 'important');
    main.style.setProperty('overflow-y', 'hidden', 'important');
    sidebar.style.setProperty('overflow-y', 'auto', 'important');

    layout.setAttribute('data-dx-entry-rail-mode', 'desktop-fixed');
    entryRailLastMode = 'desktop-fixed';

    const desc = main.querySelector('.dex-entry-desc-scroll');
    if (desc instanceof HTMLElement) {
      desc.style.minHeight = '0px';
      if (typeof window.__dexDescSyncSchedule === 'function') {
        try { window.__dexDescSyncSchedule(); } catch {}
      }
    }
  };

  const bindEntryRailLayout = () => {
    if (entryRailLayoutBound) {
      applyEntryRailLayout();
      return;
    }
    entryRailLayoutBound = true;
    let bindFooterObservers = () => {};
    const schedule = () => window.requestAnimationFrame(() => {
      bindFooterObservers();
      applyEntryRailLayout();
    });
    const scheduleBurst = () => {
      schedule();
      window.setTimeout(schedule, 80);
      window.setTimeout(schedule, 220);
      window.setTimeout(schedule, 420);
      window.setTimeout(() => bindFooterObservers(), 50);
      window.setTimeout(() => bindFooterObservers(), 180);
    };
    bindFooterObservers = () => {
      const footer = resolveActiveEntryFooter();
      if (!(footer instanceof HTMLElement)) return;
      if (entryRailObservedFooter === footer) return;
      if (entryRailFooterResizeObserver instanceof ResizeObserver) {
        try { entryRailFooterResizeObserver.disconnect(); } catch {}
      }
      if (entryRailFooterMutationObserver instanceof MutationObserver) {
        try { entryRailFooterMutationObserver.disconnect(); } catch {}
      }
      entryRailObservedFooter = footer;
      if (typeof window.ResizeObserver === 'function') {
        entryRailFooterResizeObserver = new ResizeObserver(() => schedule());
        entryRailFooterResizeObserver.observe(footer);
      }
      if (typeof window.MutationObserver === 'function') {
        entryRailFooterMutationObserver = new MutationObserver(() => schedule());
        entryRailFooterMutationObserver.observe(footer, { attributes: true, childList: true, subtree: true });
      }
    };
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('load', schedule, { once: true });
    window.addEventListener('load', () => bindFooterObservers(), { once: true });
    window.addEventListener('dx:slotready', scheduleBurst);
    window.addEventListener('dx:route-transition-in:end', scheduleBurst);
    window.addEventListener('dx:route-transition-out:end', scheduleBurst);
    schedule();
    window.setTimeout(bindFooterObservers, 40);
    window.setTimeout(schedule, 60);
    window.setTimeout(bindFooterObservers, 120);
    window.setTimeout(schedule, 240);
    window.setTimeout(bindFooterObservers, 420);
  };

  const bindBreadcrumbSpinFallback = () => {
    const delimiter = document.querySelector('[data-dex-breadcrumb-delimiter]');
    if (!(delimiter instanceof HTMLElement) || delimiter.dataset.dxSpinBound === '1') return;
    delimiter.dataset.dxSpinBound = '1';
    const triggerSpin = () => {
      const shouldSpin = Math.random() < 0.82;
      if (!shouldSpin) return;
      const path = delimiter.querySelector('[data-dex-breadcrumb-path]');
      if (path instanceof SVGElement) {
        path.style.opacity = '1';
        path.style.visibility = 'visible';
      }
      delimiter.classList.remove('dx-spin-once');
      void delimiter.offsetWidth;
      delimiter.classList.add('dx-spin-once');
      window.setTimeout(() => delimiter.classList.remove('dx-spin-once'), 780);
    };
    document.addEventListener('click', (event) => {
      const target = event && event.target && event.target.closest
        ? event.target.closest('[data-dex-breadcrumb-back], [data-dex-breadcrumb-delimiter], .dex-breadcrumb-current')
        : null;
      if (!target) return;
      triggerSpin();
    }, true);
  };

  const setDownloadState = (row, state, message) => {
    if (!row) return;
    const statusEl = row.querySelector('[data-dx-download-status]');
    row.setAttribute('data-dx-download-state', state || 'idle');
    if (!statusEl) return;
    statusEl.textContent = String(message || '');
    statusEl.hidden = !String(message || '').trim();
  };

  const getAccessToken = async () => {
    const auth = window.DEX_AUTH || window.dexAuth || null;
    if (!auth || typeof auth.getAccessToken !== 'function') return '';
    try {
      const token = await Promise.race([
        auth.getAccessToken(),
        new Promise((resolve) => {
          window.setTimeout(() => resolve(''), 2500);
        }),
      ]);
      return String(token || '').trim();
    } catch {
      return '';
    }
  };

  const resolveDownloadAuthState = async () => {
    const auth = window.DEX_AUTH || window.dexAuth || null;
    if (!auth || typeof auth.resolve !== 'function') return null;
    try {
      return await auth.resolve(1500);
    } catch {
      return null;
    }
  };

  const signInForDownloadAction = async () => {
    const auth = window.DEX_AUTH || window.dexAuth || null;
    if (!auth || typeof auth.signIn !== 'function') return false;
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    await auth.signIn(returnTo);
    return true;
  };

  const requestAssetsJson = async ({ path, method, body }) => {
    const token = await getAccessToken();
    if (!token) {
      const err = new Error('unauthorized');
      err.code = 'forbidden';
      throw err;
    }

    const headers = {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
    };
    if (body !== undefined) headers['content-type'] = 'application/json';

    const res = await fetch(`${resolveAssetsApiBase()}${path}`, {
      method: method || 'GET',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'omit',
    });
    const text = await res.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { raw: text };
    }
    if (!res.ok) {
      const err = new Error(payload?.message || payload?.error || `http_${res.status}`);
      if (res.status === 403) err.code = 'forbidden';
      else if (res.status === 404) err.code = 'not-found';
      else err.code = 'failed';
      err.status = res.status;
      err.payload = payload;
      throw err;
    }
    return payload;
  };

  const resolveBundleReadyPayload = (payload) => {
    const status = String(payload?.status || '').toLowerCase();
    if (status === 'forbidden') {
      const err = new Error('forbidden');
      err.code = 'forbidden';
      throw err;
    }
    if (status === 'not_found' || status === 'not-found') {
      const err = new Error('not-found');
      err.code = 'not-found';
      throw err;
    }
    if (status === 'error' || status === 'failed') {
      const err = new Error(payload?.message || 'failed');
      err.code = 'failed';
      throw err;
    }
    const signedUrl = String(payload?.signedUrl || payload?.url || payload?.downloadUrl || '').trim();
    if (status === 'ready' && signedUrl) {
      return { signedUrl, expiresAt: String(payload?.expiresAt || '').trim() };
    }
    return null;
  };

  const pollBundleReady = async (jobId, onQueuedTick) => {
    const safeJobId = encodeURIComponent(String(jobId || '').trim());
    if (!safeJobId) {
      const err = new Error('missing job id');
      err.code = 'failed';
      throw err;
    }
    for (let attempt = 0; attempt < MAX_BUNDLE_POLLS; attempt += 1) {
      const payload = await requestAssetsJson({
        path: `/me/assets/bundle/${safeJobId}`,
        method: 'GET',
      });
      const ready = resolveBundleReadyPayload(payload);
      if (ready) return ready;
      if (typeof onQueuedTick === 'function') onQueuedTick(attempt, payload);
      const waitMs = Number(payload?.pollAfterMs || 1200);
      await new Promise((resolve) => window.setTimeout(resolve, Math.max(350, Math.min(waitMs, 3000))));
    }
    const err = new Error('bundle_timeout');
    err.code = 'failed';
    throw err;
  };

  const openSignedUrl = (url) => {
    const href = String(url || '').trim();
    if (!href) return false;
    const win = window.open(href, '_blank', 'noopener');
    if (win) return true;
    window.location.assign(href);
    return true;
  };

  const requestBundleDownload = async ({ lookup, tokens, onQueuedTick }) => {
    const safeLookup = String(lookup || '').trim();
    if (!safeLookup) {
      const err = new Error('missing lookup');
      err.code = 'not-found';
      throw err;
    }
    const payload = await requestAssetsJson({
      path: `/me/assets/${encodeURIComponent(safeLookup)}/bundle`,
      method: 'POST',
      body: {
        tokens: Array.isArray(tokens) ? tokens : [],
        source: 'entry-sidebar',
      },
    });
    const delivery = String(payload?.delivery || '').toLowerCase();
    if (delivery === 'sync') {
      const signedUrl = String(payload?.signedUrl || payload?.url || '').trim();
      if (!signedUrl) {
        const err = new Error('missing signed url');
        err.code = 'failed';
        throw err;
      }
      return { signedUrl, expiresAt: String(payload?.expiresAt || '').trim() };
    }
    if (delivery === 'async') {
      const jobId = String(payload?.jobId || '').trim();
      return pollBundleReady(jobId, onQueuedTick);
    }
    const fallback = resolveBundleReadyPayload(payload);
    if (fallback) return fallback;
    const err = new Error('unsupported bundle response');
    err.code = 'failed';
    throw err;
  };

  const bucketHasAnyAsset = (cfg, bucket) => {
    const audio = Object.values(cfg.downloads.audioFileIds?.[bucket] || {});
    const video = Object.values(cfg.downloads.videoFileIds?.[bucket] || {});
    return [...audio, ...video].some((value) => String(value || '').trim());
  };

  const getFavoritesApi = () => {
    const api = window.__dxFavorites;
    if (!api || typeof api.toggle !== 'function' || typeof api.isFavorite !== 'function' || typeof api.keyFor !== 'function') {
      return null;
    }
    return api;
  };

  const ensureFavoritesApi = (origin) => {
    const existing = getFavoritesApi();
    if (existing) return Promise.resolve(existing);
    if (favoritesRuntimePromise) return favoritesRuntimePromise;

    favoritesRuntimePromise = new Promise((resolve) => {
      const done = () => resolve(getFavoritesApi());
      const src = new URL(FAVORITES_RUNTIME_PATH, origin || window.location.origin).toString();
      const found = Array.from(document.querySelectorAll('script[src]')).find((script) => {
        try {
          const parsed = new URL(script.src, window.location.href);
          return parsed.pathname === FAVORITES_RUNTIME_PATH;
        } catch {
          return false;
        }
      });

      if (found) {
        if (getFavoritesApi()) {
          done();
          return;
        }
        found.addEventListener('load', done, { once: true });
        found.addEventListener('error', done, { once: true });
        window.setTimeout(done, 3000);
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      script.onload = done;
      script.onerror = done;
      document.head.appendChild(script);
      window.setTimeout(done, 3000);
    });

    return favoritesRuntimePromise;
  };

  const activateFavoritesApi = (favoritesApi, root = document) => {
    const api = favoritesApi || getFavoritesApi();
    if (!api) return null;
    if (typeof api.migrateLegacy === 'function') {
      try {
        api.migrateLegacy();
      } catch {}
    }
    bindFavoritesSignals(api);
    refreshFavoriteButtons(api, root);
    return api;
  };

  const getBagApi = () => {
    const api = window.__dxBag;
    if (!api || typeof api.list !== 'function' || typeof api.upsertSelection !== 'function' || typeof api.removeSelection !== 'function') {
      return null;
    }
    return api;
  };

  const ensureBagApi = (origin) => {
    const existing = getBagApi();
    if (existing) return Promise.resolve(existing);
    if (bagRuntimePromise) return bagRuntimePromise;

    bagRuntimePromise = new Promise((resolve) => {
      const done = () => resolve(getBagApi());
      const src = new URL(BAG_RUNTIME_PATH, origin || window.location.origin).toString();
      const found = Array.from(document.querySelectorAll('script[src]')).find((script) => {
        try {
          const parsed = new URL(script.src, window.location.href);
          return parsed.pathname === BAG_RUNTIME_PATH;
        } catch {
          return false;
        }
      });

      if (found) {
        if (getBagApi()) {
          done();
          return;
        }
        found.addEventListener('load', done, { once: true });
        found.addEventListener('error', done, { once: true });
        window.setTimeout(done, 3000);
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      script.onload = done;
      script.onerror = done;
      document.head.appendChild(script);
      window.setTimeout(done, 3000);
    });

    return bagRuntimePromise;
  };

  const ensureFavoritesUiStyles = () => {
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

      .dx-fav-heart-btn {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.3rem;
        min-width: 2rem;
        min-height: 2rem;
        width: auto;
        padding: 0.42rem 0.56rem;
        border-radius: 999px;
        border: 1px solid rgba(27, 33, 45, 0.24);
        background: rgba(255, 255, 255, 0.3);
        color: rgba(29, 33, 42, 0.86);
        line-height: 1;
        cursor: pointer;
        overflow: visible;
        transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease, transform 180ms ease;
      }

      .dx-fav-heart-btn:hover,
      .dx-fav-heart-btn:focus-visible {
        transform: translateY(-1px);
        border-color: rgba(224, 36, 94, 0.42);
      }

      .dx-fav-heart-btn .dx-fav-heart-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.1rem;
        height: 1.1rem;
        pointer-events: none;
      }

      .dx-fav-heart-btn .dx-fav-heart-svg {
        width: 1.1rem;
        height: 1.1rem;
        stroke: currentColor;
        filter: drop-shadow(0 0 0.25px rgba(0, 0, 0, 0.25));
      }

      .dx-fav-heart-btn .dx-fav-heart-svg path {
        stroke-width: 1.8;
        fill: transparent;
        transition: fill 160ms ease, stroke 160ms ease;
      }

      .dx-fav-heart-btn .dx-fav-heart-chip {
        font-family: var(--font-heading, "Typefesse", sans-serif);
        font-size: 0.76rem;
        letter-spacing: 0.02em;
        text-transform: none;
        line-height: 1;
        font-weight: 700;
      }

      .dx-fav-heart-btn.is-active {
        color: #e0245e;
        border-color: rgba(224, 36, 94, 0.44);
        background: rgba(224, 36, 94, 0.1);
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
        width: 0.42rem;
        height: 0.42rem;
        border-radius: 999px;
        border: 2px solid rgba(224, 36, 94, 0.45);
        transform: translate(-50%, -50%);
        animation: dx-fav-heart-ring 520ms ease-out;
      }

      .dx-fav-heart-btn[data-dx-fav-animating='1']::after {
        width: 0.15rem;
        height: 0.15rem;
        border-radius: 999px;
        background: rgba(224, 36, 94, 0.92);
        transform: translate(-50%, -50%);
        box-shadow:
          0 -1rem 0 rgba(224, 36, 94, 0.86),
          0.94rem -0.32rem 0 rgba(255, 120, 154, 0.88),
          0.86rem 0.56rem 0 rgba(255, 58, 111, 0.82),
          -0.86rem 0.56rem 0 rgba(255, 89, 129, 0.78),
          -0.94rem -0.32rem 0 rgba(255, 133, 164, 0.84);
        animation: dx-fav-heart-spark 560ms ease-out;
      }

      .overview-item .dx-fav-heart-btn {
        min-width: 2.05rem;
      }

      .dx-fav-file-toggle {
        min-height: 1.9rem;
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
        bottom: max(16px, env(safe-area-inset-bottom, 0px) + 8px);
        transform: translateX(-50%);
        z-index: 2147482400;
        pointer-events: none;
      }

      #${FAVORITES_TOAST_ID} {
        border: 1px solid rgba(255, 255, 255, 0.42);
        border-radius: 999px;
        background: linear-gradient(128deg, rgba(23, 28, 40, 0.9), rgba(38, 20, 40, 0.88));
        color: #fff2f7;
        font-family: "Courier Prime", monospace;
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
  };

  const showFavoritesToast = (message = 'Added to favorites!') => {
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
  };

  const animateFavoriteAdded = (button) => {
    if (!(button instanceof HTMLElement)) return;
    if (prefersReducedMotion()) return;
    button.setAttribute('data-dx-fav-animating', '1');
    window.setTimeout(() => {
      if (button.getAttribute('data-dx-fav-animating') === '1') {
        button.removeAttribute('data-dx-fav-animating');
      }
    }, 620);
  };

  const ensureFavoriteButtonContent = (button) => {
    if (!(button instanceof HTMLElement)) return;
    if (button.dataset.dxFavUiReady === '1') return;
    button.dataset.dxFavUiReady = '1';
    button.classList.add('dx-fav-heart-btn');
    const chipRaw = String(button.getAttribute('data-dx-fav-chip') || '').trim();
    const chipCase = String(button.getAttribute('data-dx-fav-chip-case') || '').trim().toLowerCase();
    const chip = chipCase === 'upper' ? chipRaw.toUpperCase() : chipRaw;
    button.innerHTML = `
      <span class="dx-fav-heart-icon">${HEART_SVG}</span>
      ${chip ? `<span class="dx-fav-heart-chip">${chip}</span>` : ''}
      <span class="dx-fav-sr"></span>
    `;
  };

  const setFavoriteButtonState = (button, active, activeLabel, inactiveLabel) => {
    ensureFavoritesUiStyles();
    ensureFavoriteButtonContent(button);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    button.classList.toggle('is-active', active);
    const label = active ? activeLabel : inactiveLabel;
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    const sr = button.querySelector('.dx-fav-sr');
    if (sr) sr.textContent = label;
  };

  const refreshFavoriteButtons = (favoritesApi, root = document) => {
    const api = favoritesApi || getFavoritesApi();
    if (!api) return;
    root.querySelectorAll('[data-dx-fav-key]').forEach((button) => {
      const key = String(button.getAttribute('data-dx-fav-key') || '').trim();
      if (!key) return;
      const active = api.isFavorite(key);
      const activeLabel = String(button.getAttribute('data-dx-fav-active-label') || 'Favorited');
      const inactiveLabel = String(button.getAttribute('data-dx-fav-inactive-label') || 'Favorite');
      setFavoriteButtonState(button, active, activeLabel, inactiveLabel);
    });
  };

  const bindFavoritesSignals = (favoritesApi) => {
    if (favoritesSignalsBound) return;
    const api = favoritesApi || getFavoritesApi();
    if (!api) return;
    favoritesSignalsBound = true;
    window.addEventListener('dx:favorites:changed', () => {
      refreshFavoriteButtons(api, document);
    });
    window.addEventListener('storage', (event) => {
      const key = String(event?.key || '').trim();
      if (!key || !key.startsWith(FAVORITES_STORAGE_PREFIX)) return;
      refreshFavoriteButtons(api, document);
    });
  };

  const bindFavoriteToggle = (button, favoritesApi, record, labels) => {
    const api = favoritesApi || getFavoritesApi();
    if (!api || !button || !record) return;
    const activeLabel = labels?.active || 'Favorited';
    const inactiveLabel = labels?.inactive || 'Favorite';
    const key = api.keyFor(record);
    if (!key) return;

    button.setAttribute('data-dx-fav-key', key);
    button.setAttribute('data-dx-fav-kind', String(record.kind || 'entry'));
    button.setAttribute('data-dx-fav-lookup', String(record.lookupNumber || ''));
    button.setAttribute('data-dx-fav-active-label', activeLabel);
    button.setAttribute('data-dx-fav-inactive-label', inactiveLabel);

    if (button.dataset.dxFavBound !== '1') {
      button.dataset.dxFavBound = '1';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const result = api.toggle(record);
        if (result && result.action === 'added') {
          animateFavoriteAdded(button);
          showFavoritesToast('Added to favorites!');
        }
        refreshFavoriteButtons(api, document);
      });
    }

    setFavoriteButtonState(button, api.isFavorite(key), activeLabel, inactiveLabel);
  };

  const buildEntryFavoriteRecord = (lookup, entryHref) => ({
    kind: 'entry',
    lookupNumber: String(lookup || 'Unknown lookup').trim() || 'Unknown lookup',
    entryLookupNumber: String(lookup || 'Unknown lookup').trim() || 'Unknown lookup',
    entryHref: normalizeLocationPath(entryHref || window.location.pathname || '/'),
    source: 'entry-sidebar',
  });

  const buildBucketFavoriteRecord = (lookup, entryHref, bucket) => {
    const bucketLabel = String(bucket || '').trim().toUpperCase();
    const entryLookup = String(lookup || 'Unknown lookup').trim() || 'Unknown lookup';
    return {
      kind: 'bucket',
      lookupNumber: `${entryLookup} ${bucketLabel}`,
      entryLookupNumber: entryLookup,
      entryHref: normalizeLocationPath(entryHref || window.location.pathname || '/'),
      bucket: bucketLabel,
      source: 'entry-sidebar',
    };
  };

  const buildFileFavoriteRecord = ({ lookup, entryHref, bucket, format, fileId, type }) => {
    const entryLookup = String(lookup || 'Unknown lookup').trim() || 'Unknown lookup';
    const bucketLabel = String(bucket || '').trim().toUpperCase();
    const formatKey = String(format?.key || '').trim();
    const formatLabel = String(format?.label || formatKey || '').trim();
    return {
      kind: 'file',
      lookupNumber: `${entryLookup} ${bucketLabel} [${formatLabel || formatKey || type}]`,
      entryLookupNumber: entryLookup,
      entryHref: normalizeLocationPath(entryHref || window.location.pathname || '/'),
      bucket: bucketLabel,
      formatKey,
      formatLabel,
      fileId: String(fileId || '').trim(),
      source: 'entry-sidebar',
    };
  };

  const getDownloadModalConfig = (cfg = {}) => {
    const raw = cfg?.downloads?.modal && typeof cfg.downloads.modal === 'object'
      ? cfg.downloads.modal
      : {};
    const groupBy = String(raw.groupBy || 'bucket').toLowerCase() === 'format' ? 'format' : 'bucket';
    const defaultFilter = String(raw.defaultFilter || 'available').toLowerCase() === 'all' ? 'all' : 'available';
    return {
      groupBy,
      showUnavailable: Boolean(raw.showUnavailable),
      defaultFilter,
      enableBatch: raw.enableBatch !== false,
    };
  };

  const buildDownloadRows = ({ cfg, type, buckets, formats }) => {
    const rows = [];
    for (const bucket of buckets) {
      const fileIds = (type === 'audio' ? cfg.downloads.audioFileIds?.[bucket] : cfg.downloads.videoFileIds?.[bucket]) || {};
      for (const fmt of formats) {
        const tokenRaw = String(fileIds?.[fmt.key] || '').trim();
        const parsedToken = parseAssetRefToken(tokenRaw);
        rows.push({
          bucket,
          format: fmt,
          tokenRaw,
          parsedToken,
          available: Boolean(parsedToken),
          invalid: Boolean(tokenRaw && !parsedToken),
          rowId: `${bucket}:${fmt.key}`,
        });
      }
    }
    return rows;
  };

  const sortDownloadRows = (rows, groupBy) => {
    const list = Array.isArray(rows) ? rows.slice() : [];
    list.sort((a, b) => {
      if (groupBy === 'format') {
        const f = String(a.format?.label || a.format?.key || '').localeCompare(String(b.format?.label || b.format?.key || ''));
        if (f !== 0) return f;
      } else {
        const bucketCmp = String(a.bucket || '').localeCompare(String(b.bucket || ''));
        if (bucketCmp !== 0) return bucketCmp;
      }
      return String(a.format?.label || a.format?.key || '').localeCompare(String(b.format?.label || b.format?.key || ''));
    });
    return list;
  };

  const buildDownloadRowsForRender = (rows, { filterMode, showUnavailable }) => {
    let nextRows = Array.isArray(rows) ? rows.slice() : [];
    if (filterMode === 'available') {
      nextRows = nextRows.filter((row) => row.available);
    } else if (!showUnavailable) {
      nextRows = nextRows.filter((row) => row.available || row.invalid);
    }
    return nextRows;
  };

  const normalizeAvailableMediaTypes = (value, fallback = '') => {
    const out = [];
    const seen = new Set();
    const append = (entry) => {
      const mediaType = String(entry || '').trim().toLowerCase();
      if (mediaType !== 'audio' && mediaType !== 'video') return;
      if (seen.has(mediaType)) return;
      seen.add(mediaType);
      out.push(mediaType);
    };
    if (Array.isArray(value)) {
      value.forEach(append);
    } else {
      const raw = String(value || '').trim();
      if (raw) raw.split(',').forEach(append);
    }
    append(fallback);
    out.sort();
    return out;
  };

  const normalizeLookupFiles = (payload = {}, lookup) => {
    const files = Array.isArray(payload?.files)
      ? payload.files
      : (Array.isArray(payload?.lookup?.files)
        ? payload.lookup.files
        : (Array.isArray(payload?.items) ? payload.items : []));
    return files
      .map((file) => {
        const bucketFromNumber = String(file?.bucketNumber || '').split('.')[0];
        const bucket = String(file?.bucket || bucketFromNumber || '').trim().toUpperCase();
        const fileId = String(file?.fileId || file?.assetId || file?.id || file?.bucketNumber || '').trim();
        const type = String(file?.type || file?.media_type || '').trim().toLowerCase();
        const mediaTypes = normalizeAvailableMediaTypes(file?.availableTypes || file?.available_types, type);
        if (!bucket || !fileId) return null;
        return {
          lookup,
          bucket,
          fileId,
          label: String(file?.label || file?.sourceLabel || file?.bucketNumber || fileId).trim(),
          filename: String(file?.filename || file?.name || file?.path || '').trim(),
          extension: String(file?.extension || file?.ext || file?.fileExt || '').trim(),
          variantKey: String(file?.variantKey || file?.quality || file?.resolution || file?.formatKey || '').trim(),
          variantLabel: String(file?.variantLabel || file?.qualityLabel || '').trim(),
          mediaTypes,
        };
      })
      .filter(Boolean);
  };

  const collectTypeTokens = (cfg, bucket, type) => {
    const source = type === 'audio'
      ? cfg?.downloads?.audioFileIds?.[bucket]
      : cfg?.downloads?.videoFileIds?.[bucket];
    if (!source || typeof source !== 'object') return [];
    const tokens = [];
    Object.values(source).forEach((rawToken) => {
      const parsed = parseAssetRefToken(rawToken);
      if (!parsed?.normalized) return;
      if (!tokens.includes(parsed.normalized)) tokens.push(parsed.normalized);
    });
    return tokens;
  };

  const buildFallbackDownloadTree = (cfg, lookup) => {
    const buckets = ALL_BUCKETS.map((bucket) => {
      const audioTokens = collectTypeTokens(cfg, bucket, 'audio');
      const videoTokens = collectTypeTokens(cfg, bucket, 'video');
      return {
        bucket,
        types: [
          audioTokens.length > 0 ? { mediaType: 'audio', files: [] } : null,
          videoTokens.length > 0 ? { mediaType: 'video', files: [] } : null,
        ].filter(Boolean),
      };
    }).filter((row) => row.types.length > 0);
    return { lookup, buckets, source: 'manifest' };
  };

  const normalizeEmbeddedDownloadTree = (cfg, lookup) => {
    const root = cfg?.downloads?.fileTree;
    if (!root || typeof root !== 'object' || Array.isArray(root)) return null;

    let lookupTree = null;
    if (root.lookup && root.buckets) {
      if (String(root.lookup || '').trim() === lookup) lookupTree = root;
    }
    if (!lookupTree && root[lookup] && typeof root[lookup] === 'object' && !Array.isArray(root[lookup])) {
      lookupTree = root[lookup];
    }
    if (!lookupTree) return null;

    const buckets = Array.isArray(lookupTree.buckets) ? lookupTree.buckets : [];
    const normalizedBuckets = buckets
      .map((bucketRow) => {
        const bucket = String(bucketRow?.bucket || '').trim().toUpperCase();
        if (!bucket || !ALL_BUCKETS.includes(bucket)) return null;
        const types = Array.isArray(bucketRow?.types)
          ? bucketRow.types
          : [];
        const normalizedTypes = types
          .map((typeRow) => {
            const mediaType = String(typeRow?.mediaType || '').trim().toLowerCase();
            if (mediaType !== 'audio' && mediaType !== 'video') return null;
            const normalizeVariantKey = (rawValue = '', fallbackValue = '') => {
              const direct = String(rawValue || '').trim();
              if (direct) return direct;
              const fallback = String(fallbackValue || '').trim();
              if (fallback) return fallback;
              return `default-${mediaType}`;
            };
            const normalizeFile = (fileRow, variantKey = '') => {
              const fileId = String(fileRow?.fileId || '').trim();
              if (!fileId) return null;
              const label = String(fileRow?.label || fileId).trim();
              const resolvedVariantKey = normalizeVariantKey(fileRow?.variantKey, variantKey);
              return {
                lookup,
                bucket,
                fileId,
                label,
                filename: String(fileRow?.filename || fileRow?.name || fileRow?.path || '').trim(),
                extension: String(fileRow?.extension || fileRow?.ext || '').trim(),
                variantKey: resolvedVariantKey,
                variantLabel: String(fileRow?.variantLabel || '').trim(),
                mediaType,
                mediaTypes: [mediaType],
              };
            };

            const variantRows = Array.isArray(typeRow?.variants) ? typeRow.variants : [];
            const legacyFiles = Array.isArray(typeRow?.files) ? typeRow.files : [];
            const normalizedVariants = [];

            if (variantRows.length) {
              variantRows.forEach((variantRow) => {
                const variantKey = normalizeVariantKey(variantRow?.variantKey);
                const variantLabel = String(variantRow?.label || variantKey).trim();
                const variantFiles = Array.isArray(variantRow?.files) ? variantRow.files : [];
                const normalizedVariantFiles = variantFiles
                  .map((fileRow) => {
                    const normalizedFile = normalizeFile(fileRow, variantKey);
                    if (!normalizedFile) return null;
                    if (!normalizedFile.variantLabel) normalizedFile.variantLabel = variantLabel;
                    return normalizedFile;
                  })
                  .filter(Boolean);
                normalizedVariants.push({
                  variantKey,
                  label: variantLabel,
                  files: normalizedVariantFiles,
                });
              });
            } else if (legacyFiles.length) {
              const syntheticVariantKey = `default-${mediaType}`;
              normalizedVariants.push({
                variantKey: syntheticVariantKey,
                label: mediaType === 'video' ? 'Default Video' : 'Default Audio',
                files: legacyFiles
                  .map((fileRow) => normalizeFile(fileRow, syntheticVariantKey))
                  .filter(Boolean),
              });
            }

            const normalizedFiles = normalizedVariants.flatMap((variant) => (Array.isArray(variant.files) ? variant.files : []));
            return {
              mediaType,
              files: normalizedFiles,
              variants: normalizedVariants,
            };
          })
          .filter(Boolean);
        if (!normalizedTypes.length) return null;
        return {
          bucket,
          types: normalizedTypes,
        };
      })
      .filter(Boolean);

    if (!normalizedBuckets.length) return null;
    return {
      lookup,
      buckets: normalizedBuckets,
      source: 'embedded',
    };
  };

  const buildInventoryDownloadTree = (cfg, lookup, payload = {}) => {
    const files = normalizeLookupFiles(payload, lookup);
    const inferVariantKey = (mediaType, file = {}) => {
      const direct = String(file?.variantKey || file?.quality || file?.resolution || file?.formatKey || '').trim();
      if (direct) return direct;
      const extension = String(file?.extension || '').trim().toLowerCase();
      if (mediaType === 'audio') {
        if (extension === 'wav') return 'wav';
        if (extension === 'mp3') return 'mp3';
      }
      if (mediaType === 'video') {
        const haystack = `${String(file?.label || '')} ${String(file?.filename || '')}`.toLowerCase();
        if (/\b4k\b|\b2160p?\b|\buhd\b/.test(haystack)) return '4K';
        if (/\b1080p?\b/.test(haystack)) return '1080p';
      }
      return `default-${mediaType}`;
    };
    const buckets = ALL_BUCKETS.map((bucket) => {
      const byBucket = files.filter((file) => file.bucket === bucket);
      const byType = {
        audio: new Map(),
        video: new Map(),
      };
      byBucket.forEach((file) => {
        file.mediaTypes.forEach((mediaType) => {
          if (mediaType !== 'audio' && mediaType !== 'video') return;
          const variantKey = inferVariantKey(mediaType, file);
          const variantMap = byType[mediaType];
          if (!(variantMap instanceof Map)) return;
          if (!variantMap.has(variantKey)) variantMap.set(variantKey, []);
          variantMap.get(variantKey).push({
            lookup,
            bucket,
            fileId: file.fileId,
            label: file.label || file.fileId,
            filename: file.filename || '',
            extension: file.extension || '',
            variantKey,
            variantLabel: String(file.variantLabel || variantKey).trim(),
            mediaType,
            mediaTypes: [mediaType],
          });
        });
      });
      const types = ['audio', 'video']
        .map((mediaType) => {
          const variantMap = byType[mediaType];
          const variants = variantMap instanceof Map
            ? Array.from(variantMap.entries()).map(([variantKey, variantFiles]) => ({
              variantKey,
              label: variantKey,
              files: Array.isArray(variantFiles) ? variantFiles : [],
            }))
            : [];
          const filesFlat = variants.flatMap((variant) => variant.files);
          return {
            mediaType,
            files: filesFlat,
            variants,
          };
        })
        .filter((row) => row.files.length > 0 || row.variants.length > 0);
      return {
        bucket,
        types,
      };
    }).filter((row) => row.types.length > 0);
    return { lookup, buckets, source: 'inventory' };
  };

  const buildNodeKey = (node) => {
    const kind = String(node?.kind || '').trim().toLowerCase();
    const lookup = String(node?.lookup || '').trim();
    const bucket = String(node?.bucket || '').trim().toUpperCase();
    const mediaType = String(node?.mediaType || '').trim().toLowerCase();
    const fileId = String(node?.fileId || '').trim();
    const variantKey = String(node?.variantKey || '').trim().toLowerCase();
    const mediaTypes = normalizeAvailableMediaTypes(node?.mediaTypes, mediaType).join(',');
    if (kind === 'collection') return `collection|${lookup}`;
    if (kind === 'bucket') return `bucket|${lookup}|${bucket}`;
    if (kind === 'type') return `type|${lookup}|${bucket}|${mediaType}`;
    return `file|${lookup}|${bucket}|${variantKey}|${fileId}|${mediaTypes}`;
  };

  const normalizeNodeForBag = (node, context) => ({
    kind: String(node?.kind || '').trim().toLowerCase(),
    lookup: String(node?.lookup || context?.lookup || '').trim(),
    bucket: String(node?.bucket || '').trim().toUpperCase(),
    mediaType: String(node?.mediaType || '').trim().toLowerCase(),
    mediaTypes: normalizeAvailableMediaTypes(node?.mediaTypes, node?.mediaType),
    fileId: String(node?.fileId || '').trim(),
    variantKey: String(node?.variantKey || '').trim(),
    source: 'entry-sidebar',
    entryHref: normalizeLocationPath(context?.entryHref || window.location.pathname || '/'),
    title: String(context?.lookup || '').trim(),
  });

  const expandNodesToLegacyTokens = (cfg, nodes = []) => {
    const tokens = [];
    const addToken = (token) => {
      if (!token) return;
      if (!tokens.includes(token)) tokens.push(token);
    };
    const addBucketType = (bucket, type) => {
      collectTypeTokens(cfg, bucket, type).forEach(addToken);
    };
    nodes.forEach((node) => {
      const kind = String(node?.kind || '').trim().toLowerCase();
      const bucket = String(node?.bucket || '').trim().toUpperCase();
      const mediaTypes = normalizeAvailableMediaTypes(node?.mediaTypes, node?.mediaType);
      if (kind === 'collection') {
        ALL_BUCKETS.forEach((bucketKey) => {
          addBucketType(bucketKey, 'audio');
          addBucketType(bucketKey, 'video');
        });
        return;
      }
      if (kind === 'bucket') {
        addBucketType(bucket, 'audio');
        addBucketType(bucket, 'video');
        return;
      }
      if (kind === 'type') {
        const mediaType = String(node?.mediaType || '').trim().toLowerCase();
        if (mediaType === 'audio' || mediaType === 'video') addBucketType(bucket, mediaType);
        return;
      }
      if (kind === 'file') {
        if (!mediaTypes.length) {
          addBucketType(bucket, 'audio');
          addBucketType(bucket, 'video');
          return;
        }
        mediaTypes.forEach((mediaType) => addBucketType(bucket, mediaType));
      }
    });
    return tokens;
  };

  const attach = (cfg, type, btnSel, context) => {
    const btn = document.querySelector(btnSel);
    if (!btn || btn.dataset.dexBound === '1') return;
    btn.dataset.dexBound = '1';
    btn.addEventListener('click', () => {
      const formats = cfg.downloads.formats[type] || [];
      const allBuckets = ALL_BUCKETS;
      const modalConfig = getDownloadModalConfig(cfg);
      const rows = sortDownloadRows(
        buildDownloadRows({
          cfg,
          type,
          buckets: allBuckets,
          formats,
        }),
        modalConfig.groupBy,
      );
      const selectedTokens = new Set();
      let filterMode = modalConfig.defaultFilter;

      const modal = document.createElement('div');
      modal.className = 'dex-download-modal';
      modal.style.setProperty('position', 'fixed', 'important');
      modal.style.setProperty('inset', '0', 'important');
      modal.style.setProperty('z-index', '2147483000', 'important');
      modal.style.setProperty('background', 'rgba(7, 8, 12, 0.62)', 'important');
      modal.style.setProperty('display', 'flex', 'important');
      modal.style.setProperty('align-items', 'center', 'important');
      modal.style.setProperty('justify-content', 'center', 'important');
      modal.style.setProperty('padding', 'clamp(10px, 2vw, 18px)', 'important');
      modal.style.setProperty('box-sizing', 'border-box', 'important');
      modal.style.setProperty('pointer-events', 'auto', 'important');
      modal.style.setProperty('opacity', '1', 'important');
      modal.style.setProperty('visibility', 'visible', 'important');
      modal.style.setProperty('filter', 'none', 'important');

      const inner = document.createElement('div');
      inner.className = 'dex-download-modal-inner';
      inner.style.setProperty('position', 'relative', 'important');
      inner.style.setProperty('display', 'grid', 'important');
      inner.style.setProperty('gap', '0.62rem', 'important');
      inner.style.setProperty('width', 'min(760px, 100%)', 'important');
      inner.style.setProperty('max-height', 'min(86vh, 920px)', 'important');
      inner.style.setProperty('overflow', 'auto', 'important');
      inner.style.setProperty('padding', '0.9rem', 'important');
      inner.style.setProperty('border-radius', 'var(--dx-header-glass-radius, var(--dx-entry-card-radius, 10px))', 'important');
      inner.style.setProperty('border', '1px solid rgba(228, 232, 242, 0.92)', 'important');
      inner.style.setProperty('background', 'linear-gradient(180deg, rgba(255, 255, 255, 0.985), rgba(245, 248, 255, 0.972))', 'important');
      inner.style.setProperty('box-shadow', '0 18px 42px rgba(0, 0, 0, 0.28)', 'important');
      inner.style.setProperty('backdrop-filter', 'none', 'important');
      inner.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
      inner.style.setProperty('filter', 'none', 'important');
      const close = document.createElement('button');
      close.className = 'close';
      close.setAttribute('aria-label', 'Close');
      close.type = 'button';
      close.textContent = '×';
      close.style.justifySelf = 'end';
      close.style.width = '2rem';
      close.style.height = '2rem';
      close.style.borderRadius = '999px';
      close.style.border = '1px solid rgba(0, 0, 0, 0.22)';
      close.style.background = 'rgba(255, 255, 255, 0.8)';
      close.style.cursor = 'pointer';

      const heading = document.createElement('h4');
      heading.textContent = `${type === 'audio' ? 'Audio' : 'Video'} downloads`;
      heading.style.margin = '0 0 0.35rem';
      heading.style.fontFamily = '"Typefesse", sans-serif';
      heading.style.letterSpacing = '0.02em';
      heading.style.textTransform = 'uppercase';

      const statusBanner = document.createElement('p');
      statusBanner.style.margin = '0';
      statusBanner.style.fontSize = '0.75rem';
      statusBanner.style.lineHeight = '1.35';
      statusBanner.style.opacity = '0.82';
      statusBanner.hidden = true;

      const setModalStatus = (state, message) => {
        const text = String(message || '').trim();
        if (!text) {
          statusBanner.hidden = true;
          statusBanner.textContent = '';
          statusBanner.removeAttribute('data-dx-download-state');
          return;
        }
        statusBanner.hidden = false;
        statusBanner.setAttribute('data-dx-download-state', String(state || 'idle'));
        statusBanner.textContent = text;
      };

      const controls = document.createElement('div');
      controls.style.display = 'flex';
      controls.style.alignItems = 'center';
      controls.style.justifyContent = 'space-between';
      controls.style.gap = '0.45rem';
      controls.style.flexWrap = 'wrap';

      const chipWrap = document.createElement('div');
      chipWrap.style.display = 'inline-flex';
      chipWrap.style.gap = '0.35rem';

      const chipAll = document.createElement('button');
      chipAll.type = 'button';
      chipAll.className = 'dx-button-element--secondary';
      chipAll.textContent = 'All';
      chipAll.style.padding = '0.34rem 0.55rem';
      chipAll.style.fontSize = '0.7rem';

      const chipAvailable = document.createElement('button');
      chipAvailable.type = 'button';
      chipAvailable.className = 'dx-button-element--secondary';
      chipAvailable.textContent = 'Available';
      chipAvailable.style.padding = '0.34rem 0.55rem';
      chipAvailable.style.fontSize = '0.7rem';

      const batchButton = document.createElement('button');
      batchButton.type = 'button';
      batchButton.className = 'dx-button-element--secondary';
      batchButton.textContent = 'Download selected';
      batchButton.style.padding = '0.34rem 0.55rem';
      batchButton.style.fontSize = '0.72rem';
      batchButton.hidden = !modalConfig.enableBatch;
      batchButton.disabled = true;

      chipWrap.appendChild(chipAll);
      chipWrap.appendChild(chipAvailable);
      controls.appendChild(chipWrap);
      controls.appendChild(batchButton);

      const list = document.createElement('div');
      list.style.display = 'grid';
      list.style.gap = '0.4rem';
      list.style.maxHeight = '60vh';
      list.style.overflowY = 'auto';
      list.style.paddingRight = '0.15rem';

      const updateChipState = () => {
        chipAll.setAttribute('aria-pressed', String(filterMode === 'all'));
        chipAvailable.setAttribute('aria-pressed', String(filterMode === 'available'));
        chipAll.style.opacity = filterMode === 'all' ? '1' : '0.75';
        chipAvailable.style.opacity = filterMode === 'available' ? '1' : '0.75';
      };

      const updateBatchState = () => {
        batchButton.disabled = selectedTokens.size === 0;
        batchButton.textContent = selectedTokens.size > 0
          ? `Download selected (${selectedTokens.size})`
          : 'Download selected';
      };

      const removeModal = () => {
        document.removeEventListener('keydown', onKeyDown);
        modal.remove();
      };
      const onKeyDown = (event) => {
        if (event.key === 'Escape') removeModal();
      };

      const renderRows = () => {
        list.replaceChildren();
        const visibleRows = buildDownloadRowsForRender(rows, {
          filterMode,
          showUnavailable: modalConfig.showUnavailable,
        });
        if (!visibleRows.length) {
          const empty = document.createElement('p');
          empty.style.margin = '0';
          empty.style.opacity = '0.75';
          empty.textContent = 'No downloads available for this filter.';
          list.appendChild(empty);
          updateBatchState();
          return;
        }

        visibleRows.forEach((rowData) => {
          const row = document.createElement('div');
          row.style.display = 'grid';
          row.style.gridTemplateColumns = modalConfig.enableBatch ? 'auto minmax(0,1fr) auto' : 'minmax(0,1fr) auto';
          row.style.alignItems = 'center';
          row.style.gap = '0.45rem';
          row.style.padding = '0.35rem 0.4rem';
          row.style.border = '1px solid rgba(0,0,0,0.12)';
          row.style.borderRadius = '10px';
          row.setAttribute('data-dx-download-state', 'idle');

          if (modalConfig.enableBatch) {
            const select = document.createElement('input');
            select.type = 'checkbox';
            select.disabled = !rowData.available;
            select.checked = rowData.available && selectedTokens.has(rowData.parsedToken?.normalized);
            select.addEventListener('change', () => {
              if (!rowData.available || !rowData.parsedToken?.normalized) return;
              if (select.checked) selectedTokens.add(rowData.parsedToken.normalized);
              else selectedTokens.delete(rowData.parsedToken.normalized);
              updateBatchState();
            });
            row.appendChild(select);
          }

          const actionWrap = document.createElement('div');
          actionWrap.style.display = 'inline-flex';
          actionWrap.style.flexDirection = 'column';
          actionWrap.style.gap = '0.2rem';

          const actionButton = document.createElement('button');
          actionButton.type = 'button';
          actionButton.className = 'dx-button-element--secondary';
          actionButton.style.justifySelf = 'start';
          actionButton.textContent = `${rowData.bucket} · ${rowData.format?.label || rowData.format?.key || 'file'}`;

          const status = document.createElement('span');
          status.setAttribute('data-dx-download-status', '1');
          status.style.opacity = '0.8';
          status.style.fontSize = '0.74rem';
          status.hidden = true;

          if (!rowData.available) {
            actionButton.disabled = true;
            actionButton.setAttribute('aria-disabled', 'true');
            if (rowData.invalid) {
              setDownloadState(row, 'error', 'Invalid token (DX-DL-422).');
            } else {
              setDownloadState(row, 'not-found', 'Unavailable (DX-DL-404).');
            }
          } else {
            actionButton.addEventListener('click', async () => {
              setDownloadState(row, 'resolving', 'Resolving secure download…');
              actionButton.disabled = true;
              try {
                const result = await requestBundleDownload({
                  lookup: context?.lookup,
                  tokens: [rowData.parsedToken.normalized],
                  onQueuedTick: () => {
                    setDownloadState(row, 'queued', 'Preparing bundle…');
                    setModalStatus('queued', 'Preparing secure bundle…');
                  },
                });
                setDownloadState(row, 'ready', 'Ready. Opening download…');
                setModalStatus('ready', 'Bundle ready. Opening signed URL…');
                openSignedUrl(result?.signedUrl);
                window.setTimeout(() => setDownloadState(row, 'idle', ''), 2200);
              } catch (error) {
                const code = String(error?.code || '').toLowerCase();
                if (code === 'forbidden') {
                  setDownloadState(row, 'forbidden', 'Access denied (DX-DL-403).');
                  setModalStatus('forbidden', 'Access denied for this token (DX-DL-403).');
                } else if (code === 'not-found') {
                  setDownloadState(row, 'not-found', 'Download not found (DX-DL-404).');
                  setModalStatus('not-found', 'Bundle source not found (DX-DL-404).');
                } else {
                  setDownloadState(row, 'error', 'Download failed (DX-DL-500).');
                  setModalStatus('error', 'Bundle request failed. Retry or refresh (DX-DL-500).');
                }
              } finally {
                actionButton.disabled = false;
              }
            });
          }

          actionWrap.appendChild(actionButton);
          actionWrap.appendChild(status);
          row.appendChild(actionWrap);

          const favoritesApi = context?.favoritesApi || getFavoritesApi();
          if (favoritesApi && rowData.tokenRaw) {
            const favButton = document.createElement('button');
            favButton.type = 'button';
            favButton.className = 'dx-button-element--secondary dx-fav-toggle dx-fav-file-toggle';
            favButton.setAttribute('aria-label', 'Add file to favorites');
            favButton.setAttribute('title', 'Add file to favorites');
            const record = buildFileFavoriteRecord({
              lookup: context?.lookup,
              entryHref: context?.entryHref,
              bucket: rowData.bucket,
              format: rowData.format,
              fileId: rowData.tokenRaw,
              type,
            });
            bindFavoriteToggle(favButton, favoritesApi, record, {
              active: 'Favorited file',
              inactive: 'Favorite file',
            });
            row.appendChild(favButton);
          }
          list.appendChild(row);
        });
        updateBatchState();
      };

      chipAll.addEventListener('click', () => {
        filterMode = 'all';
        updateChipState();
        renderRows();
      });
      chipAvailable.addEventListener('click', () => {
        filterMode = 'available';
        updateChipState();
        renderRows();
      });

      batchButton.addEventListener('click', async () => {
        if (!selectedTokens.size) return;
        batchButton.disabled = true;
        setModalStatus('resolving', `Resolving ${selectedTokens.size} selected item(s)…`);
        try {
          const result = await requestBundleDownload({
            lookup: context?.lookup,
            tokens: Array.from(selectedTokens),
          });
          setModalStatus('ready', 'Batch bundle ready. Opening signed URL…');
          openSignedUrl(result?.signedUrl);
        } catch (error) {
          const msg = String(error?.code || 'failed').toLowerCase();
          if (msg === 'forbidden') setModalStatus('forbidden', 'Batch request denied (DX-DL-403).');
          else if (msg === 'not-found') setModalStatus('not-found', 'Batch source not found (DX-DL-404).');
          else setModalStatus('error', 'Batch download failed (DX-DL-500).');
        } finally {
          updateBatchState();
        }
      });

      inner.appendChild(close);
      inner.appendChild(heading);
      inner.appendChild(statusBanner);
      inner.appendChild(controls);
      inner.appendChild(list);
      modal.appendChild(inner);
      document.body.appendChild(modal);
      updateChipState();
      renderRows();
      close.addEventListener('click', removeModal);
      modal.addEventListener('click', (event) => {
        if (event.target === modal) removeModal();
      });
      document.addEventListener('keydown', onKeyDown);
      refreshFavoriteButtons(context?.favoritesApi || getFavoritesApi(), modal);
    });
  };

  const attachUnifiedDownload = (cfg, btnSel, context) => {
    const buttons = Array.from(document.querySelectorAll(btnSel));
    if (!buttons.length) return;
    buttons.forEach((btn) => {
      if (!(btn instanceof HTMLElement) || btn.dataset.dexBound === '1') return;
      btn.dataset.dexBound = '1';
      btn.addEventListener('click', async () => {
        const lookup = String(context?.lookup || '').trim();
        if (!lookup) return;
        ensureDownloadTreeStyles();
        const fallbackTree = buildFallbackDownloadTree(cfg, lookup);
        const embeddedTree = normalizeEmbeddedDownloadTree(cfg, lookup);
        let downloadTree = embeddedTree || fallbackTree;
        const selectedLeafKeys = new Set();
        const expandedNodeKeys = new Set();
        const modalId = `dx-file-modal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        let filterQuery = '';
        let activeBucketKey = '';

        const modal = document.createElement('div');
        modal.className = 'dex-download-modal dex-download-modal--tree';
        modal.style.setProperty('position', 'fixed', 'important');
        modal.style.setProperty('inset', '0', 'important');
        modal.style.setProperty('z-index', '2147483000', 'important');
        modal.style.setProperty('display', 'flex', 'important');
        modal.style.setProperty('align-items', 'center', 'important');
        modal.style.setProperty('justify-content', 'center', 'important');
        modal.style.setProperty('padding', 'clamp(12px, 2.4vw, 24px)', 'important');
        modal.style.setProperty('box-sizing', 'border-box', 'important');
        modal.style.setProperty('background', 'rgba(7, 9, 14, 0.62)', 'important');
        modal.style.setProperty('backdrop-filter', 'blur(2px)', 'important');
        modal.style.setProperty('-webkit-backdrop-filter', 'blur(2px)', 'important');
        modal.style.setProperty('filter', 'none', 'important');
        modal.style.setProperty('opacity', '1', 'important');
        modal.style.setProperty('visibility', 'visible', 'important');
        modal.style.setProperty('pointer-events', 'auto', 'important');
        modal.style.setProperty('isolation', 'isolate', 'important');

        const inner = document.createElement('div');
        inner.className = 'dex-download-modal-inner';
        inner.style.setProperty('position', 'relative', 'important');
        inner.style.setProperty('display', 'grid', 'important');
        inner.style.setProperty('gap', '0.62rem', 'important');
        inner.style.setProperty('width', 'min(820px, calc(100vw - clamp(28px, 8vw, 120px)))', 'important');
        inner.style.setProperty('max-height', 'min(86vh, 860px)', 'important');
        inner.style.setProperty('overflow', 'hidden', 'important');
        inner.style.setProperty('padding', 'clamp(12px, 1.8vw, 18px)', 'important');
        inner.style.setProperty('border-radius', 'var(--dx-header-glass-radius, var(--dx-entry-card-radius, 10px))', 'important');
        inner.style.setProperty('border', '1px solid rgba(214, 220, 232, 0.96)', 'important');
        inner.style.setProperty('background', 'linear-gradient(180deg, rgba(255, 255, 255, 0.995), rgba(248, 250, 255, 0.985))', 'important');
        inner.style.setProperty('box-shadow', '0 20px 50px rgba(0, 0, 0, 0.32)', 'important');
        inner.style.setProperty('backdrop-filter', 'none', 'important');
        inner.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
        inner.style.setProperty('filter', 'none', 'important');

        const close = document.createElement('button');
        close.className = 'close';
        close.setAttribute('aria-label', 'Close');
        close.type = 'button';
        close.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        `;
        close.style.setProperty('display', 'grid', 'important');
        close.style.setProperty('place-items', 'center', 'important');
        close.style.setProperty('width', '1.4rem', 'important');
        close.style.setProperty('height', '1.4rem', 'important');
        close.style.setProperty('border', '0', 'important');
        close.style.setProperty('background', 'transparent', 'important');
        close.style.setProperty('padding', '0', 'important');
        close.style.setProperty('color', 'rgba(20, 22, 28, 0.94)', 'important');
        close.style.setProperty('cursor', 'pointer', 'important');
        close.style.setProperty('line-height', '0', 'important');
        const closeIcon = close.querySelector('svg');
        if (closeIcon instanceof SVGElement) {
          closeIcon.style.width = '100%';
          closeIcon.style.height = '100%';
        }

        const heading = document.createElement('h4');
        const headingSeedKey = `${window.location.pathname || '/'}|download-modal-heading`;
        const headingRaw = randomizeTitle('FILES', { seedKey: headingSeedKey });
        heading.textContent = addZeroWidthJoiners(headingRaw);
        heading.style.margin = '0';
        heading.style.fontFamily = '"Typefesse", sans-serif';
        heading.style.letterSpacing = '0.02em';
        heading.style.fontSize = 'clamp(1.06rem, 1.48vw, 1.3rem)';
        heading.style.lineHeight = '1';
        heading.style.textTransform = 'none';

        const titleRow = document.createElement('div');
        titleRow.style.display = 'flex';
        titleRow.style.alignItems = 'center';
        titleRow.style.justifyContent = 'space-between';
        titleRow.style.gap = '0.62rem';
        titleRow.style.margin = '0 0 0.12rem';
        titleRow.appendChild(heading);
        titleRow.appendChild(close);

        const statusBanner = document.createElement('p');
        statusBanner.style.margin = '0';
        statusBanner.style.fontSize = '0.75rem';
        statusBanner.style.lineHeight = '1.35';
        statusBanner.style.opacity = '0.84';
        statusBanner.hidden = true;

        const setModalStatus = (state, message) => {
          const text = String(message || '').trim();
          if (!text) {
            statusBanner.hidden = true;
            statusBanner.textContent = '';
            statusBanner.removeAttribute('data-dx-download-state');
            return;
          }
          statusBanner.hidden = false;
          statusBanner.setAttribute('data-dx-download-state', String(state || 'idle'));
          statusBanner.textContent = text;
        };

        const bucketTabs = document.createElement('div');
        bucketTabs.className = 'dx-file-bucket-tabs';
        bucketTabs.setAttribute('role', 'tablist');
        bucketTabs.setAttribute('aria-label', 'Available buckets');

        const folderStack = document.createElement('div');
        folderStack.className = 'dx-file-folder-stack';

        const treeTools = document.createElement('div');
        treeTools.className = 'dx-file-tree-tools';
        treeTools.style.display = 'grid';
        treeTools.style.gridTemplateColumns = 'minmax(0,1fr) auto';
        treeTools.style.gap = '0.45rem';
        treeTools.style.alignItems = 'center';

        const filterInput = document.createElement('input');
        filterInput.type = 'text';
        filterInput.placeholder = 'Filter files';
        filterInput.autocomplete = 'off';
        filterInput.style.width = '100%';
        filterInput.style.minHeight = '34px';
        filterInput.style.padding = '0.45rem 0.58rem';
        filterInput.style.border = '1px solid rgba(0,0,0,0.14)';
        filterInput.style.borderRadius = '9px';
        filterInput.style.font = 'inherit';
        filterInput.style.fontSize = '0.76rem';
        filterInput.style.background = 'rgba(255,255,255,0.92)';

        const quickControls = document.createElement('div');
        quickControls.style.display = 'inline-flex';
        quickControls.style.flexWrap = 'wrap';
        quickControls.style.gap = '0.35rem';

        const enforceDarkButtonText = (button) => {
          if (!(button instanceof HTMLElement)) return;
          button.style.setProperty('color', 'rgba(18, 20, 26, 0.95)', 'important');
          button.style.setProperty('-webkit-text-fill-color', 'rgba(18, 20, 26, 0.95)', 'important');
        };

        const makeSecondaryControl = (label) => {
          const control = document.createElement('button');
          control.type = 'button';
          control.className = 'dx-button-element--secondary';
          control.textContent = String(label || '').toUpperCase();
          control.style.padding = '0.34rem 0.55rem';
          control.style.fontSize = '0.7rem';
          control.style.fontFamily = '"Typefesse", sans-serif';
          control.style.letterSpacing = '0.015em';
          control.style.textTransform = 'uppercase';
          enforceDarkButtonText(control);
          control.addEventListener('mouseenter', () => {
            enforceDarkButtonText(control);
          });
          control.addEventListener('mouseleave', () => {
            enforceDarkButtonText(control);
          });
          return control;
        };

        const selectAllButton = makeSecondaryControl('Select');
        const clearButton = makeSecondaryControl('Clear');
        const expandAllButton = makeSecondaryControl('Expand');
        const collapseAllButton = makeSecondaryControl('Collapse');
        quickControls.appendChild(selectAllButton);
        quickControls.appendChild(clearButton);
        quickControls.appendChild(expandAllButton);
        quickControls.appendChild(collapseAllButton);

        treeTools.appendChild(filterInput);
        treeTools.appendChild(quickControls);

        const treePanel = document.createElement('div');
        treePanel.className = 'dx-file-tree-panel';
        treePanel.id = `${modalId}-panel`;
        treePanel.setAttribute('role', 'tabpanel');

        const treeWrap = document.createElement('div');
        treeWrap.className = 'dx-file-tree-wrap';
        treeWrap.setAttribute('role', 'tree');
        treeWrap.setAttribute('aria-label', 'Download file tree');
        treeWrap.style.display = 'grid';
        treeWrap.style.gap = '0.46rem';
        treeWrap.style.maxHeight = 'min(52vh, 520px)';
        treeWrap.style.overflowY = 'auto';
        treeWrap.style.paddingRight = '0.12rem';
        treeWrap.style.paddingBottom = '0.08rem';
        treePanel.appendChild(treeWrap);

        const controls = document.createElement('div');
        controls.className = 'dx-file-tree-actions';
        controls.style.display = 'flex';
        controls.style.flexWrap = 'wrap';
        controls.style.gap = '0.42rem';
        controls.style.alignItems = 'center';

        const addToBagButton = document.createElement('button');
        addToBagButton.type = 'button';
        addToBagButton.className = 'dx-button-element--primary';
        const addToBagBaseLabel = `ADD\u200C TO BAG`.replace('ADD\u200C', 'AD\u200CD');
        addToBagButton.textContent = addToBagBaseLabel;
        addToBagButton.style.textTransform = 'uppercase';

        const downloadNowButton = document.createElement('button');
        downloadNowButton.type = 'button';
        downloadNowButton.className = 'dx-button-element--secondary';
        downloadNowButton.textContent = 'DOWNLOAD NOW';
        downloadNowButton.style.textTransform = 'uppercase';
        downloadNowButton.style.fontFamily = '"Typefesse", sans-serif';
        downloadNowButton.style.letterSpacing = '0.015em';
        enforceDarkButtonText(downloadNowButton);
        downloadNowButton.addEventListener('mouseenter', () => {
          enforceDarkButtonText(downloadNowButton);
        });
        downloadNowButton.addEventListener('mouseleave', () => {
          enforceDarkButtonText(downloadNowButton);
        });

        const removeModal = () => {
          document.removeEventListener('keydown', onKeyDown);
          modal.remove();
        };
        const onKeyDown = (event) => {
          if (event.key === 'Escape') removeModal();
        };

        const normalizeTree = (tree) => {
          const buckets = Array.isArray(tree?.buckets)
            ? tree.buckets
            : [];
          return {
            lookup,
            source: tree?.source || 'unknown',
            buckets: buckets
              .map((bucketRow) => {
                const bucket = String(bucketRow?.bucket || '').trim().toUpperCase();
                if (!bucket || !ALL_BUCKETS.includes(bucket)) return null;
                const typeRows = Array.isArray(bucketRow?.types)
                  ? bucketRow.types
                  : [];
                const types = typeRows
                  .map((typeRow) => {
                    const mediaType = String(typeRow?.mediaType || '').trim().toLowerCase();
                    if (mediaType !== 'audio' && mediaType !== 'video') return null;
                    const normalizeVariantKey = (rawValue = '', fallbackValue = '') => {
                      const direct = String(rawValue || '').trim();
                      if (direct) return direct;
                      const fallback = String(fallbackValue || '').trim();
                      if (fallback) return fallback;
                      return `default-${mediaType}`;
                    };
                    const normalizeFile = (fileRow, variantKey = '', variantLabel = '') => {
                      const fileId = String(fileRow?.fileId || '').trim();
                      if (!fileId) return null;
                      const label = String(fileRow?.label || fileId).trim();
                      const resolvedVariantKey = normalizeVariantKey(fileRow?.variantKey, variantKey);
                      return {
                        lookup,
                        bucket,
                        mediaType,
                        mediaTypes: [mediaType],
                        fileId,
                        label,
                        filename: String(fileRow?.filename || fileRow?.name || '').trim(),
                        extension: String(fileRow?.extension || fileRow?.ext || '').trim(),
                        variantKey: resolvedVariantKey,
                        variantLabel: String(fileRow?.variantLabel || variantLabel || resolvedVariantKey).trim(),
                      };
                    };

                    const variantRows = Array.isArray(typeRow?.variants) ? typeRow.variants : [];
                    const legacyFiles = Array.isArray(typeRow?.files) ? typeRow.files : [];
                    const normalizedVariants = [];

                    if (variantRows.length) {
                      variantRows.forEach((variantRow) => {
                        const variantKey = normalizeVariantKey(variantRow?.variantKey);
                        const variantLabel = String(variantRow?.label || variantKey).trim();
                        const variantFiles = Array.isArray(variantRow?.files) ? variantRow.files : [];
                        const normalizedVariantFiles = variantFiles
                          .map((fileRow) => normalizeFile(fileRow, variantKey, variantLabel))
                          .filter(Boolean);
                        normalizedVariants.push({
                          variantKey,
                          label: variantLabel,
                          files: normalizedVariantFiles,
                        });
                      });
                    } else if (legacyFiles.length) {
                      const syntheticVariantKey = `default-${mediaType}`;
                      normalizedVariants.push({
                        variantKey: syntheticVariantKey,
                        label: mediaType === 'video' ? 'Default Video' : 'Default Audio',
                        files: legacyFiles
                          .map((fileRow) => normalizeFile(fileRow, syntheticVariantKey, syntheticVariantKey))
                          .filter(Boolean),
                      });
                    }

                    const normalizedFiles = normalizedVariants.flatMap((variant) => (Array.isArray(variant.files) ? variant.files : []));
                    return {
                      mediaType,
                      files: normalizedFiles,
                      variants: normalizedVariants,
                    };
                  })
                  .filter(Boolean);
                if (!types.length) return null;
                return {
                  bucket,
                  types,
                };
              })
              .filter(Boolean),
          };
        };

        const treeState = {
          tree: normalizeTree(downloadTree),
          leaves: [],
          allLeafKeys: [],
          leafByKey: new Map(),
          leafKeysByBucket: new Map(),
          leafKeysByType: new Map(),
          leafKeysByVariant: new Map(),
          nodeLeafCounts: new Map(),
          leafAncestorNodeIds: new Map(),
        };

        const getBucketRows = () => (Array.isArray(treeState.tree?.buckets) ? treeState.tree.buckets : []);
        const getBucketRow = (bucketKey = activeBucketKey) => {
          const safeBucket = String(bucketKey || '').trim().toUpperCase();
          if (!safeBucket) return null;
          return getBucketRows().find((bucketRow) => String(bucketRow?.bucket || '').trim().toUpperCase() === safeBucket) || null;
        };
        const getBucketKeys = () => getBucketRows()
          .map((bucketRow) => String(bucketRow?.bucket || '').trim().toUpperCase())
          .filter(Boolean);
        const ensureActiveBucketKey = () => {
          const bucketKeys = getBucketKeys();
          if (!bucketKeys.length) {
            activeBucketKey = '';
            return '';
          }
          if (activeBucketKey && bucketKeys.includes(activeBucketKey)) return activeBucketKey;
          activeBucketKey = bucketKeys.includes('A') ? 'A' : bucketKeys[0];
          return activeBucketKey;
        };
        const getBucketLeafKeys = (bucketKey = activeBucketKey) => (
          treeState.leafKeysByBucket.get(String(bucketKey || '').trim().toUpperCase()) || []
        );
        const getActiveBucketLeafKeys = () => getBucketLeafKeys(ensureActiveBucketKey()).slice();

        const setLeaves = () => {
          treeState.leaves = [];
          treeState.leafByKey = new Map();
          treeState.leafKeysByBucket = new Map();
          treeState.leafKeysByType = new Map();
          treeState.leafKeysByVariant = new Map();
          treeState.nodeLeafCounts = new Map();
          treeState.leafAncestorNodeIds = new Map();
          const collectionNodeId = `collection|${lookup}`;
          const countNodeLeaf = (nodeId) => {
            treeState.nodeLeafCounts.set(nodeId, (treeState.nodeLeafCounts.get(nodeId) || 0) + 1);
          };
          treeState.tree.buckets.forEach((bucketRow) => {
            const bucketKeys = [];
            const bucketNodeId = `bucket|${lookup}|${bucketRow.bucket}`;
            bucketRow.types.forEach((typeRow) => {
              const typeKey = `${bucketRow.bucket}|${typeRow.mediaType}`;
              const typeNodeId = `type|${lookup}|${bucketRow.bucket}|${typeRow.mediaType}`;
              const typeLeafKeys = [];
              const variantRows = Array.isArray(typeRow.variants) ? typeRow.variants : [];
              if (variantRows.length) {
                variantRows.forEach((variantRow) => {
                  const variantKey = String(variantRow?.variantKey || '').trim() || `default-${typeRow.mediaType}`;
                  const variantNodeId = `variant|${lookup}|${bucketRow.bucket}|${typeRow.mediaType}|${variantKey}`;
                  const variantLeafKeys = [];
                  const variantFiles = Array.isArray(variantRow?.files) ? variantRow.files : [];
                  variantFiles.forEach((fileRow) => {
                    const leafKey = `file|${lookup}|${bucketRow.bucket}|${typeRow.mediaType}|${variantKey}|${fileRow.fileId}`;
                    const fileNodeId = `file-node|${lookup}|${bucketRow.bucket}|${typeRow.mediaType}|${variantKey}|${fileRow.fileId}`;
                    const leaf = {
                      kind: 'file',
                      lookup,
                      bucket: bucketRow.bucket,
                      mediaType: typeRow.mediaType,
                      mediaTypes: [typeRow.mediaType],
                      variantKey,
                      variantLabel: String(fileRow?.variantLabel || variantRow?.label || variantKey).trim(),
                      fileId: fileRow.fileId,
                      label: fileRow.label || fileRow.fileId,
                      filename: fileRow.filename || '',
                      extension: fileRow.extension || '',
                      leafKey,
                    };
                    treeState.leaves.push(leaf);
                    treeState.leafByKey.set(leafKey, leaf);
                    typeLeafKeys.push(leafKey);
                    variantLeafKeys.push(leafKey);
                    bucketKeys.push(leafKey);
                    const ancestorIds = [collectionNodeId, bucketNodeId, typeNodeId, variantNodeId, fileNodeId];
                    treeState.leafAncestorNodeIds.set(leafKey, ancestorIds);
                    ancestorIds.forEach(countNodeLeaf);
                  });
                  treeState.leafKeysByVariant.set(`${bucketRow.bucket}|${typeRow.mediaType}|${variantKey}`, variantLeafKeys);
                });
              } else if (Array.isArray(typeRow.files) && typeRow.files.length) {
                typeRow.files.forEach((fileRow) => {
                  const variantKey = String(fileRow?.variantKey || '').trim() || `default-${typeRow.mediaType}`;
                  const variantNodeId = `variant|${lookup}|${bucketRow.bucket}|${typeRow.mediaType}|${variantKey}`;
                  const leafKey = `file|${lookup}|${bucketRow.bucket}|${typeRow.mediaType}|${variantKey}|${fileRow.fileId}`;
                  const fileNodeId = `file-node|${lookup}|${bucketRow.bucket}|${typeRow.mediaType}|${variantKey}|${fileRow.fileId}`;
                  const leaf = {
                    kind: 'file',
                    lookup,
                    bucket: bucketRow.bucket,
                    mediaType: typeRow.mediaType,
                    mediaTypes: [typeRow.mediaType],
                    variantKey,
                    variantLabel: String(fileRow?.variantLabel || variantKey).trim(),
                    fileId: fileRow.fileId,
                    label: fileRow.label || fileRow.fileId,
                    filename: fileRow.filename || '',
                    extension: fileRow.extension || '',
                    leafKey,
                  };
                  treeState.leaves.push(leaf);
                  treeState.leafByKey.set(leafKey, leaf);
                  typeLeafKeys.push(leafKey);
                  bucketKeys.push(leafKey);
                  const variantMapKey = `${bucketRow.bucket}|${typeRow.mediaType}|${variantKey}`;
                  const existingVariantLeafKeys = treeState.leafKeysByVariant.get(variantMapKey) || [];
                  existingVariantLeafKeys.push(leafKey);
                  treeState.leafKeysByVariant.set(variantMapKey, existingVariantLeafKeys);
                  const ancestorIds = [collectionNodeId, bucketNodeId, typeNodeId, variantNodeId, fileNodeId];
                  treeState.leafAncestorNodeIds.set(leafKey, ancestorIds);
                  ancestorIds.forEach(countNodeLeaf);
                });
              } else {
                const leafKey = `type|${lookup}|${bucketRow.bucket}|${typeRow.mediaType}`;
                const leaf = {
                  kind: 'type',
                  lookup,
                  bucket: bucketRow.bucket,
                  mediaType: typeRow.mediaType,
                  mediaTypes: [typeRow.mediaType],
                  fileId: '',
                  label: `${bucketRow.bucket} ${typeRow.mediaType.toUpperCase()}`,
                  leafKey,
                };
                treeState.leaves.push(leaf);
                treeState.leafByKey.set(leafKey, leaf);
                typeLeafKeys.push(leafKey);
                bucketKeys.push(leafKey);
                const ancestorIds = [collectionNodeId, bucketNodeId, typeNodeId];
                treeState.leafAncestorNodeIds.set(leafKey, ancestorIds);
                ancestorIds.forEach(countNodeLeaf);
              }
              treeState.leafKeysByType.set(typeKey, typeLeafKeys);
            });
            treeState.leafKeysByBucket.set(bucketRow.bucket, bucketKeys);
          });
          treeState.allLeafKeys = treeState.leaves.map((leaf) => leaf.leafKey);
          selectedLeafKeys.forEach((leafKey) => {
            if (!treeState.leafByKey.has(leafKey)) selectedLeafKeys.delete(leafKey);
          });
          ensureActiveBucketKey();
          if (!expandedNodeKeys.size) {
            expandedNodeKeys.add(`collection|${lookup}`);
            const buckets = Array.isArray(treeState.tree?.buckets) ? treeState.tree.buckets : [];
            if (buckets.length) {
              const defaultBucket = buckets.find((bucketRow) => String(bucketRow?.bucket || '').toUpperCase() === 'A') || buckets[0];
              if (defaultBucket?.bucket) {
                expandedNodeKeys.add(`bucket|${lookup}|${defaultBucket.bucket}`);
              }
              buckets.forEach((bucketRow) => {
                const bucketName = String(bucketRow?.bucket || '').trim();
                const typeRows = Array.isArray(bucketRow?.types) ? bucketRow.types : [];
                typeRows.forEach((typeRow) => {
                  const mediaType = String(typeRow?.mediaType || '').trim().toLowerCase();
                  if (!bucketName || !mediaType) return;
                  const variantRows = Array.isArray(typeRow?.variants) ? typeRow.variants : [];
                  if (variantRows.length !== 1) return;
                  expandedNodeKeys.add(`type|${lookup}|${bucketName}|${mediaType}`);
                  const onlyVariant = variantRows[0];
                  const variantKey = String(onlyVariant?.variantKey || '').trim() || `default-${mediaType}`;
                  expandedNodeKeys.add(`variant|${lookup}|${bucketName}|${mediaType}|${variantKey}`);
                });
              });
            }
          }
        };

        const setLeafSet = (leafKeys, checked) => {
          leafKeys.forEach((leafKey) => {
            if (checked) selectedLeafKeys.add(leafKey);
            else selectedLeafKeys.delete(leafKey);
          });
        };

        const getSelectionState = (leafKeys) => {
          const total = Array.isArray(leafKeys) ? leafKeys.length : 0;
          if (total <= 0) return { checked: false, indeterminate: false };
          let selected = 0;
          leafKeys.forEach((leafKey) => {
            if (selectedLeafKeys.has(leafKey)) selected += 1;
          });
          if (selected <= 0) return { checked: false, indeterminate: false };
          if (selected >= total) return { checked: true, indeterminate: false };
          return { checked: false, indeterminate: true };
        };

        const compileSelectionNodes = () => {
          const selectedSet = new Set(selectedLeafKeys);
          if (!selectedSet.size) return [];

          const out = [];
          const consumed = new Set();

          if (selectedSet.size === treeState.allLeafKeys.length && treeState.allLeafKeys.length > 0) {
            return [{ kind: 'collection', lookup }];
          }

          treeState.tree.buckets.forEach((bucketRow) => {
            const bucketKeys = treeState.leafKeysByBucket.get(bucketRow.bucket) || [];
            const isBucketFull = bucketKeys.length > 0 && bucketKeys.every((leafKey) => selectedSet.has(leafKey));
            if (isBucketFull) {
              out.push({
                kind: 'bucket',
                lookup,
                bucket: bucketRow.bucket,
              });
              bucketKeys.forEach((leafKey) => consumed.add(leafKey));
              return;
            }

            bucketRow.types.forEach((typeRow) => {
              const typeKey = `${bucketRow.bucket}|${typeRow.mediaType}`;
              const typeLeafKeys = treeState.leafKeysByType.get(typeKey) || [];
              const isTypeFull = typeLeafKeys.length > 0 && typeLeafKeys.every((leafKey) => selectedSet.has(leafKey));
              if (isTypeFull) {
                out.push({
                  kind: 'type',
                  lookup,
                  bucket: bucketRow.bucket,
                  mediaType: typeRow.mediaType,
                  mediaTypes: [typeRow.mediaType],
                });
                typeLeafKeys.forEach((leafKey) => consumed.add(leafKey));
              }
            });
          });

          selectedSet.forEach((leafKey) => {
            if (consumed.has(leafKey)) return;
            const leaf = treeState.leafByKey.get(leafKey);
            if (!leaf) return;
            if (leaf.kind === 'type') {
              out.push({
                kind: 'type',
                lookup,
                bucket: leaf.bucket,
                mediaType: leaf.mediaType,
                mediaTypes: [leaf.mediaType],
              });
              return;
            }
            out.push({
              kind: 'file',
              lookup,
              bucket: leaf.bucket,
              fileId: leaf.fileId,
              variantKey: leaf.variantKey || '',
              mediaType: leaf.mediaType,
              mediaTypes: [leaf.mediaType],
            });
          });

          const deduped = new Map();
          out.forEach((node) => {
            const key = buildNodeKey(node);
            if (!deduped.has(key)) deduped.set(key, node);
          });
          return Array.from(deduped.values());
        };

        const resolveNormalizedSelection = async () => {
          const compiled = compileSelectionNodes();
          const raw = compiled.map((node) => normalizeNodeForBag(node, context));
          if (!raw.length) return [];
          const bagApi = await ensureBagApi(window.location.origin);
          if (bagApi && typeof bagApi.normalizeSelections === 'function') {
            const normalized = bagApi.normalizeSelections(raw);
            return Array.isArray(normalized) ? normalized : raw;
          }
          return raw;
        };

        const updateActiveBucketControls = () => {
          const bucket = ensureActiveBucketKey();
          const suffix = bucket || '';
          const hasBucket = Boolean(bucket && getActiveBucketLeafKeys().length);
          filterInput.placeholder = bucket ? `Filter bucket ${bucket}` : 'Filter files';
          selectAllButton.textContent = suffix ? `SELECT ${suffix}` : 'SELECT';
          clearButton.textContent = suffix ? `CLEAR ${suffix}` : 'CLEAR';
          expandAllButton.textContent = suffix ? `EXPAND ${suffix}` : 'EXPAND';
          collapseAllButton.textContent = suffix ? `COL\u200CLAPSE ${suffix}` : 'COL\u200CLAPSE';
          selectAllButton.setAttribute('aria-label', bucket ? `Select all files in bucket ${bucket}` : 'Select all files');
          clearButton.setAttribute('aria-label', bucket ? `Clear selected files in bucket ${bucket}` : 'Clear selected files');
          expandAllButton.setAttribute('aria-label', bucket ? `Expand bucket ${bucket}` : 'Expand files');
          collapseAllButton.setAttribute('aria-label', bucket ? `Collapse bucket ${bucket}` : 'Collapse files');
          selectAllButton.disabled = !hasBucket;
          clearButton.disabled = !hasBucket;
          expandAllButton.disabled = !hasBucket;
          collapseAllButton.disabled = !hasBucket;
          treePanel.setAttribute('aria-label', bucket ? `Bucket ${bucket} files` : 'Download files');
          if (bucket) treePanel.setAttribute('aria-labelledby', `${modalId}-bucket-${bucket}`);
          else treePanel.removeAttribute('aria-labelledby');
          treeWrap.setAttribute('aria-label', bucket ? `Bucket ${bucket} download file tree` : 'Download file tree');
        };

        const updateActionState = () => {
          const selectedCount = selectedLeafKeys.size;
          ensureActiveBucketKey();
          updateActiveBucketControls();
          addToBagButton.disabled = selectedCount === 0;
          downloadNowButton.disabled = selectedCount === 0;
          addToBagButton.textContent = selectedCount > 0 ? `${addToBagBaseLabel} (${selectedCount})` : addToBagBaseLabel;
          if (typeof renderBucketTabs === 'function') renderBucketTabs();
        };

        const extractBucketOrdinal = (bucket, fileRow = {}) => {
          const label = String(fileRow?.label || '').trim();
          const fromLabel = label.match(/\b([A-Z]\.\d+)\b/i);
          if (fromLabel?.[1]) return fromLabel[1].toUpperCase();
          const fileId = String(fileRow?.fileId || '').trim();
          const fromFileId = fileId.match(/-([a-z])-0*([0-9]+)$/i);
          if (fromFileId?.[1] && fromFileId?.[2]) {
            return `${String(fromFileId[1] || bucket).toUpperCase()}.${String(Number(fromFileId[2]))}`;
          }
          return `${String(bucket || '').toUpperCase()}.1`;
        };

        const AUDIO_DISPLAY_EXTENSIONS = new Set(['wav', 'wave', 'mp3', 'aif', 'aiff', 'flac', 'm4a']);
        const VIDEO_DISPLAY_EXTENSIONS = new Set(['mov', 'mp4', 'm4v', 'mxf', 'mkv', 'webm']);

        const normalizeDisplayExtension = (value) => String(value || '')
          .trim()
          .toLowerCase()
          .replace(/^\./, '');

        const extractExtension = (value) => {
          const match = String(value || '').trim().match(/\.([a-z0-9]{2,6})(?:$|\s)/i);
          return match?.[1] ? normalizeDisplayExtension(match[1]) : '';
        };

        const extensionSetForMediaType = (mediaType) => (
          mediaType === 'video'
            ? VIDEO_DISPLAY_EXTENSIONS
            : (mediaType === 'audio' ? AUDIO_DISPLAY_EXTENSIONS : null)
        );

        const canonicalDisplayExtension = (extension) => (
          normalizeDisplayExtension(extension) === 'wave' ? 'wav' : normalizeDisplayExtension(extension)
        );

        const fileExtensionForMediaType = (mediaType, fileRow = {}) => {
          const safeMediaType = String(mediaType || '').trim().toLowerCase();
          const candidates = [
            fileRow?.displayExtension,
            fileRow?.downloadExtension,
            fileRow?.extension,
            fileRow?.ext,
            fileRow?.format,
            extractExtension(fileRow?.filename || fileRow?.name || ''),
            extractExtension(fileRow?.fileId || ''),
            extractExtension(fileRow?.label || ''),
          ].map(canonicalDisplayExtension).filter(Boolean);
          const allowedExtensions = extensionSetForMediaType(safeMediaType);
          if (allowedExtensions) {
            return candidates.find((extension) => allowedExtensions.has(extension))
              || (safeMediaType === 'video' ? 'mov' : 'wav');
          }
          return candidates[0] || 'file';
        };

        const filenameWithDisplayExtension = (filename, extension) => {
          const safeName = String(filename || '').trim();
          const safeExtension = canonicalDisplayExtension(extension);
          if (!safeName) return '';
          if (!safeExtension) return safeName;
          const extensionMatch = safeName.match(/^(.*)\.([a-z0-9]{2,6})$/i);
          if (!extensionMatch) return `${safeName}.${safeExtension}`;
          const currentExtension = canonicalDisplayExtension(extensionMatch[2]);
          if (currentExtension === safeExtension) return safeName;
          return `${extensionMatch[1]}.${safeExtension}`;
        };

        const buildDisplayFilename = (bucket, mediaType, variantKey = '', fileRow = {}) => {
          const explicitName = String(fileRow?.filename || '').trim();
          const extension = fileExtensionForMediaType(mediaType, fileRow);
          if (explicitName) return filenameWithDisplayExtension(explicitName, extension);
          const ordinal = extractBucketOrdinal(bucket, fileRow);
          const variant = String(variantKey || fileRow?.variantKey || '').trim();
          if (variant && !/^default-/i.test(variant)) {
            return `${lookup} ${ordinal}.${String(variant).toLowerCase()}.${extension}`;
          }
          return `${lookup} ${ordinal}.${extension}`;
        };

        const BUCKET_TAB_LABELS = {
          A: 'WHOLE FILES',
          B: 'CHUNKS',
          C: 'PHRASES',
          D: 'MOMENTS',
          E: 'IMPULSES',
          X: 'EXTRAS',
        };
        const BUCKET_EXTENSION_ORDER = ['wav', 'mp3', 'aif', 'aiff', 'flac', 'm4a', 'mov', 'mp4', 'm4v', 'mxf', 'mkv', 'webm'];
        const bucketSemanticLabel = (bucket) => BUCKET_TAB_LABELS[String(bucket || '').trim().toUpperCase()] || `BUCKET ${String(bucket || '').trim().toUpperCase()}`;
        const sortedDisplayExtensions = (extensions) => Array.from(extensions || [])
          .map(canonicalDisplayExtension)
          .filter(Boolean)
          .sort((a, b) => {
            const ai = BUCKET_EXTENSION_ORDER.indexOf(a);
            const bi = BUCKET_EXTENSION_ORDER.indexOf(b);
            if (ai >= 0 && bi >= 0) return ai - bi;
            if (ai >= 0) return -1;
            if (bi >= 0) return 1;
            return a.localeCompare(b);
          });
        const bucketDisplayExtensions = (bucketRow = {}) => {
          const extensions = new Set();
          (Array.isArray(bucketRow?.types) ? bucketRow.types : []).forEach((typeRow) => {
            const mediaType = String(typeRow?.mediaType || '').trim().toLowerCase();
            (Array.isArray(typeRow?.files) ? typeRow.files : []).forEach((fileRow) => {
              extensions.add(fileExtensionForMediaType(mediaType, fileRow));
            });
            (Array.isArray(typeRow?.variants) ? typeRow.variants : []).forEach((variantRow) => {
              (Array.isArray(variantRow?.files) ? variantRow.files : []).forEach((fileRow) => {
                extensions.add(fileExtensionForMediaType(mediaType, fileRow));
              });
            });
          });
          return sortedDisplayExtensions(extensions);
        };

        const fileCountLabel = (count) => {
          const safeCount = Number(count);
          const total = Number.isFinite(safeCount) && safeCount > 0 ? Math.round(safeCount) : 0;
          return `${total} file${total === 1 ? '' : 's'}`;
        };

        const mediaTypeLabel = (mediaType) => {
          const safeType = String(mediaType || '').trim().toLowerCase();
          if (safeType === 'audio') return 'Audio';
          if (safeType === 'video') return 'Video';
          return safeType || 'Files';
        };

        const renderBucketTabs = () => {
          const bucketRows = getBucketRows();
          ensureActiveBucketKey();
          bucketTabs.replaceChildren();
          if (!bucketRows.length) {
            bucketTabs.hidden = true;
            return;
          }
          bucketTabs.hidden = false;
          const activeIndex = bucketRows.findIndex((bucketRow) => String(bucketRow?.bucket || '').toUpperCase() === activeBucketKey);
          const activateBucket = (bucketKey, focusTab = false) => {
            const safeBucket = String(bucketKey || '').trim().toUpperCase();
            if (!safeBucket || safeBucket === activeBucketKey) return;
            activeBucketKey = safeBucket;
            renderBucketTabs();
            renderTree();
            if (focusTab) {
              const nextTab = bucketTabs.querySelector(`[data-dx-bucket-tab="${safeBucket}"]`);
              if (nextTab instanceof HTMLElement) nextTab.focus();
            }
          };

          bucketRows.forEach((bucketRow, index) => {
            const bucket = String(bucketRow?.bucket || '').trim().toUpperCase();
            if (!bucket) return;
            const bucketLeafKeys = getBucketLeafKeys(bucket);
            const selectionState = getSelectionState(bucketLeafKeys);
            const selectedState = selectionState.checked
              ? 'full'
              : (selectionState.indeterminate ? 'partial' : 'none');
            const semanticLabel = bucketSemanticLabel(bucket);
            const fileTypes = bucketDisplayExtensions(bucketRow);
            const fileTypesLabel = fileTypes.length ? fileTypes.join(' ') : 'files';
            const isActive = bucket === activeBucketKey;
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.className = 'dx-file-bucket-tab';
            tab.id = `${modalId}-bucket-${bucket}`;
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-selected', String(isActive));
            tab.setAttribute('aria-controls', treePanel.id);
            tab.setAttribute('tabindex', isActive ? '0' : '-1');
            tab.setAttribute('data-dx-bucket-tab', bucket);
            tab.setAttribute('data-dx-bucket-selection', selectedState);
            tab.setAttribute('aria-label', `Bucket ${bucket}, ${semanticLabel}, ${fileCountLabel(bucketLeafKeys.length)}, ${fileTypesLabel}`);

            const letter = document.createElement('span');
            letter.className = 'dx-file-bucket-tab-letter';
            letter.textContent = bucket;

            const label = document.createElement('span');
            label.className = 'dx-file-bucket-tab-label';
            label.textContent = semanticLabel;

            const media = document.createElement('span');
            media.className = 'dx-file-bucket-tab-media';
            media.textContent = fileTypesLabel;

            tab.appendChild(letter);
            tab.appendChild(label);
            tab.appendChild(media);
            tab.addEventListener('click', () => {
              activateBucket(bucket);
            });
            tab.addEventListener('keydown', (event) => {
              const lastIndex = bucketRows.length - 1;
              let nextIndex = -1;
              if (event.key === 'ArrowRight') nextIndex = index >= lastIndex ? 0 : index + 1;
              else if (event.key === 'ArrowLeft') nextIndex = index <= 0 ? lastIndex : index - 1;
              else if (event.key === 'Home') nextIndex = 0;
              else if (event.key === 'End') nextIndex = lastIndex;
              if (nextIndex < 0) return;
              event.preventDefault();
              const nextBucket = String(bucketRows[nextIndex]?.bucket || '').trim().toUpperCase();
              activateBucket(nextBucket, true);
            });
            bucketTabs.appendChild(tab);
          });
          if (activeIndex < 0) ensureActiveBucketKey();
          updateActiveBucketControls();
        };

        const isDefaultVariant = (variantKey = '', variantLabel = '', mediaType = '') => {
          const key = String(variantKey || '').trim().toLowerCase();
          const label = String(variantLabel || '').trim().toLowerCase();
          const type = String(mediaType || '').trim().toLowerCase();
          return key === `default-${type}`
            || key === 'default'
            || label === 'default'
            || label === `default ${type}`
            || label === `default-${type}`;
        };

        const buildTreeModel = () => {
          const rootNode = {
            id: `collection|${lookup}`,
            kind: 'collection',
            label: `entry/${lookup}`,
            leafKeys: treeState.allLeafKeys.slice(),
            children: [],
          };
          const bucketRow = getBucketRow(ensureActiveBucketKey());
          if (!bucketRow) return rootNode;
          bucketRow.types.forEach((typeRow) => {
              const typeNode = {
                id: `type|${lookup}|${bucketRow.bucket}|${typeRow.mediaType}`,
                kind: String(typeRow.mediaType || '').trim().toLowerCase() || 'type',
                label: mediaTypeLabel(typeRow.mediaType),
                leafKeys: (treeState.leafKeysByType.get(`${bucketRow.bucket}|${typeRow.mediaType}`) || []).slice(),
                children: [],
              };
              const appendFileNode = (parentNode, variantKey, variantLabel, fileRow) => {
                const leafKey = `file|${lookup}|${bucketRow.bucket}|${typeRow.mediaType}|${variantKey}|${fileRow.fileId}`;
                const displayName = buildDisplayFilename(bucketRow.bucket, typeRow.mediaType, variantKey, fileRow);
                parentNode.children.push({
                  id: `file-node|${lookup}|${bucketRow.bucket}|${typeRow.mediaType}|${variantKey}|${fileRow.fileId}`,
                  kind: 'file',
                  label: displayName,
                  leafKeys: [leafKey],
                  children: [],
                });
              };
              const variantRows = Array.isArray(typeRow.variants) ? typeRow.variants : [];
              if (variantRows.length) {
                variantRows.forEach((variantRow) => {
                  const variantKey = String(variantRow?.variantKey || '').trim() || `default-${typeRow.mediaType}`;
                  const variantLabel = String(variantRow?.label || variantKey).trim();
                  const variantMapKey = `${bucketRow.bucket}|${typeRow.mediaType}|${variantKey}`;
                  const variantFiles = Array.isArray(variantRow?.files) ? variantRow.files : [];
                  if (isDefaultVariant(variantKey, variantLabel, typeRow.mediaType)) {
                    variantFiles.forEach((fileRow) => appendFileNode(typeNode, variantKey, variantLabel, fileRow));
                    return;
                  }
                  const variantNode = {
                    id: `variant|${lookup}|${bucketRow.bucket}|${typeRow.mediaType}|${variantKey}`,
                    kind: 'variant',
                    label: variantLabel,
                    leafKeys: (treeState.leafKeysByVariant.get(variantMapKey) || []).slice(),
                    children: [],
                  };
                  variantFiles.forEach((fileRow) => {
                    appendFileNode(variantNode, variantKey, variantLabel, fileRow);
                  });
                  typeNode.children.push(variantNode);
                });
              } else if (Array.isArray(typeRow.files) && typeRow.files.length) {
                typeRow.files.forEach((fileRow) => {
                  const variantKey = String(fileRow?.variantKey || '').trim() || `default-${typeRow.mediaType}`;
                  appendFileNode(typeNode, variantKey, String(fileRow?.variantLabel || variantKey).trim(), fileRow);
                });
              }
              rootNode.children.push(typeNode);
            });
          return rootNode;
        };

        const collectExpandableNodeIds = (node, out = []) => {
          if (!node || !Array.isArray(node.children) || !node.children.length) return out;
          out.push(node.id);
          node.children.forEach((child) => collectExpandableNodeIds(child, out));
          return out;
        };

        const pruneTreeByFilter = (node) => {
          const query = String(filterQuery || '').trim().toLowerCase();
          if (!query) return node;
          const children = Array.isArray(node.children)
            ? node.children.map((child) => pruneTreeByFilter(child)).filter(Boolean)
            : [];
          const needle = `${String(node.label || '')} ${String(node.meta || '')}`.toLowerCase();
          const selfMatches = node.kind !== 'collection' && needle.includes(query);
          if (!selfMatches && !children.length) return null;
          return {
            ...node,
            children,
          };
        };

        const checkboxBindings = [];
        const expandBindings = [];
        const refreshCheckboxStates = () => {
          const selectedCountByNode = new Map();
          selectedLeafKeys.forEach((leafKey) => {
            const ancestorIds = treeState.leafAncestorNodeIds.get(leafKey) || [];
            ancestorIds.forEach((nodeId) => {
              selectedCountByNode.set(nodeId, (selectedCountByNode.get(nodeId) || 0) + 1);
            });
          });
          checkboxBindings.forEach(({ checkbox, nodeId, row }) => {
            const total = Number(treeState.nodeLeafCounts.get(nodeId) || 0);
            const selected = Number(selectedCountByNode.get(nodeId) || 0);
            checkbox.checked = total > 0 && selected >= total;
            checkbox.indeterminate = selected > 0 && selected < total;
            if (row instanceof HTMLElement) {
              row.classList.toggle('is-selected', total > 0 && selected >= total);
              row.classList.toggle('is-partial', selected > 0 && selected < total);
            }
          });
          updateActionState();
        };
        const refreshExpandedStates = () => {
          expandBindings.forEach(({ nodeId, toggle, childrenWrap, row, label: nodeLabel }) => {
            const isExpanded = expandedNodeKeys.has(nodeId);
            if (toggle instanceof HTMLElement) {
              toggle.textContent = isExpanded ? 'v' : '>';
              toggle.setAttribute('aria-expanded', String(isExpanded));
              toggle.setAttribute('aria-label', `${isExpanded ? 'Collapse' : 'Expand'} ${nodeLabel || 'group'}`);
            }
            if (row instanceof HTMLElement) {
              row.setAttribute('aria-expanded', String(isExpanded));
            }
            if (childrenWrap instanceof HTMLElement) {
              childrenWrap.style.display = isExpanded ? 'grid' : 'none';
            }
          });
        };

        const renderTreeNode = (node, parent, depth = 0) => {
          if (!node || !Array.isArray(node.leafKeys) || !node.leafKeys.length) return;
          const hasChildren = Array.isArray(node.children) && node.children.length > 0;
          const isExpanded = hasChildren && expandedNodeKeys.has(node.id);

          const shell = document.createElement('div');
          shell.className = `dx-file-tree-node dx-file-tree-node--${String(node.kind || 'node').toLowerCase()}`;
          shell.style.display = 'grid';
          shell.style.gap = '0.25rem';

          const row = document.createElement('div');
          row.className = 'dx-file-tree-row';
          row.setAttribute('role', 'treeitem');
          row.setAttribute('tabindex', '0');
          row.setAttribute('data-dx-tree-depth', String(depth));
          row.setAttribute('data-dx-tree-kind', String(node.kind || 'node'));
          if (hasChildren) row.setAttribute('aria-expanded', String(isExpanded));
          row.style.display = 'grid';
          row.style.gridTemplateColumns = hasChildren ? '22px 24px minmax(0,1fr)' : '24px minmax(0,1fr)';
          row.style.gap = '0.5rem';
          row.style.alignItems = 'center';
          row.style.position = 'relative';

          let toggle = null;
          let childrenWrap = null;
          if (hasChildren) {
            toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'dx-file-tree-toggle';
            toggle.setAttribute('aria-label', `${isExpanded ? 'Collapse' : 'Expand'} ${node.label}`);
            toggle.setAttribute('aria-expanded', String(isExpanded));
            toggle.style.width = '22px';
            toggle.style.height = '22px';
            toggle.style.display = 'grid';
            toggle.style.placeItems = 'center';
            toggle.style.padding = '0';
            toggle.style.cursor = 'pointer';
            toggle.style.lineHeight = '1';
            toggle.textContent = isExpanded ? 'v' : '>';
          }

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'dx-file-tree-checkbox';
          const state = getSelectionState(node.leafKeys);
          checkbox.checked = state.checked;
          checkbox.indeterminate = state.indeterminate;
          checkbox.addEventListener('change', () => {
            setLeafSet(node.leafKeys, Boolean(checkbox.checked));
            refreshCheckboxStates();
          });
          checkbox.addEventListener('click', (event) => {
            event.stopPropagation();
          });
          checkboxBindings.push({ checkbox, nodeId: node.id, row });

          const copy = document.createElement('div');
          copy.className = 'dx-file-tree-copy';
          copy.style.display = 'grid';
          copy.style.gridTemplateColumns = 'minmax(0,1fr)';
          copy.style.alignItems = 'center';

          const label = document.createElement('span');
          label.className = 'dx-file-tree-label';
          label.textContent = node.label;
          label.style.fontFamily = node.kind === 'file' ? 'var(--font-body)' : '"Typefesse", sans-serif';
          label.style.fontSize = node.kind === 'file' ? '0.72rem' : '0.76rem';
          label.style.letterSpacing = '0.01em';
          label.style.textTransform = node.kind === 'file' ? 'none' : 'uppercase';

          copy.appendChild(label);

          let favButton = null;
          if (node.kind === 'file' && Array.isArray(node.leafKeys) && node.leafKeys.length === 1) {
            const leaf = treeState.leafByKey.get(node.leafKeys[0]);
            const favoritesApi = context?.favoritesApi || getFavoritesApi();
            if (leaf && leaf.fileId && favoritesApi) {
              favButton = document.createElement('button');
              favButton.type = 'button';
              favButton.className = 'dx-button-element--secondary dx-fav-toggle dx-fav-file-toggle';
              favButton.style.justifySelf = 'end';
              const record = buildFileFavoriteRecord({
                lookup: leaf.lookup,
                entryHref: context?.entryHref,
                bucket: leaf.bucket,
                format: { key: leaf.variantKey, label: leaf.variantLabel },
                fileId: leaf.fileId,
                type: leaf.mediaType,
              });
              bindFavoriteToggle(favButton, favoritesApi, record, {
                active: 'Favorited file',
                inactive: 'Favorite file',
              });
            }
          }

          if (toggle) row.appendChild(toggle);
          row.appendChild(checkbox);
          row.appendChild(copy);
          if (favButton) {
            row.style.gridTemplateColumns = hasChildren ? '22px 24px minmax(0,1fr) auto' : '24px minmax(0,1fr) auto';
            row.appendChild(favButton);
          }
          shell.appendChild(row);

          if (hasChildren) {
            childrenWrap = document.createElement('div');
            childrenWrap.className = 'dx-file-tree-children';
            childrenWrap.setAttribute('role', 'group');
            childrenWrap.style.display = isExpanded ? 'grid' : 'none';
            expandBindings.push({ nodeId: node.id, toggle, childrenWrap, row, label: node.label });
            shell.appendChild(childrenWrap);
            if (isExpanded) {
              node.children.forEach((child) => renderTreeNode(child, childrenWrap, depth + 1));
            }
            if (toggle instanceof HTMLButtonElement) {
              toggle.addEventListener('click', (event) => {
                event.preventDefault();
                const nextExpanded = !expandedNodeKeys.has(node.id);
                if (nextExpanded) expandedNodeKeys.add(node.id);
                else expandedNodeKeys.delete(node.id);
                if (nextExpanded && childrenWrap instanceof HTMLElement && childrenWrap.childElementCount === 0) {
                  node.children.forEach((child) => renderTreeNode(child, childrenWrap, depth + 1));
                }
                refreshExpandedStates();
                refreshCheckboxStates();
              });
            }
          }
          row.addEventListener('click', (event) => {
            if (event.target instanceof HTMLElement && event.target.closest('button, input, a')) return;
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
          });
          row.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              checkbox.checked = !checkbox.checked;
              checkbox.dispatchEvent(new Event('change', { bubbles: true }));
              return;
            }
            if (event.key === 'ArrowRight' && hasChildren && !expandedNodeKeys.has(node.id)) {
              event.preventDefault();
              toggle.click();
              return;
            }
            if (event.key === 'ArrowLeft' && hasChildren && expandedNodeKeys.has(node.id)) {
              event.preventDefault();
              toggle.click();
            }
          });
          parent.appendChild(shell);
        };

        const renderTree = () => {
          treeWrap.replaceChildren();
          checkboxBindings.length = 0;
          expandBindings.length = 0;
          const treeRoot = buildTreeModel();
          const filteredRoot = pruneTreeByFilter(treeRoot);
          const visibleNodes = Array.isArray(filteredRoot?.children) ? filteredRoot.children : [];
          if (!visibleNodes.length) {
            const empty = document.createElement('p');
            empty.style.margin = '0';
            empty.style.opacity = '0.75';
            empty.textContent = filterQuery
              ? `No matching files in bucket ${activeBucketKey || ''}.`
              : `No files available in bucket ${activeBucketKey || ''}.`;
            treeWrap.appendChild(empty);
            updateActionState();
            return;
          }
          visibleNodes.forEach((child) => renderTreeNode(child, treeWrap, 0));
          refreshExpandedStates();
          refreshCheckboxStates();
        };

        const requestBagBundleFromSidebar = async (nodes) => {
          const payload = await requestAssetsJson({
            path: '/me/assets/bag/bundle',
            method: 'POST',
            body: {
              source: 'entry-sidebar',
              dedupe: true,
              selections: [{
                lookup,
                nodes: nodes.map((node) => ({
                  kind: node.kind,
                  lookup,
                  bucket: node.bucket || '',
                  mediaType: node.mediaType || '',
                  mediaTypes: normalizeAvailableMediaTypes(node.mediaTypes, node.mediaType),
                  fileId: node.fileId || '',
                })),
              }],
            },
          });
          return payload;
        };

        const executeDownloadNow = async () => {
          const nodes = await resolveNormalizedSelection();
          if (!nodes.length) return;
          downloadNowButton.disabled = true;
          setModalStatus('resolving', 'Resolving secure bundle…');
          try {
            const authState = await resolveDownloadAuthState();
            if (authState && !authState.authenticated) {
              setModalStatus('resolving', 'Sign in required for download.');
              try {
                if (await signInForDownloadAction()) return;
              } catch {
                setModalStatus('forbidden', 'Unable to start sign-in flow.');
                return;
              }
              setModalStatus('forbidden', 'Sign in required for download.');
              return;
            }
            const token = await getAccessToken();
            if (!token) {
              setModalStatus('resolving', 'Sign in required for download.');
              try {
                if (await signInForDownloadAction()) return;
              } catch {
                setModalStatus('forbidden', 'Unable to start sign-in flow.');
                return;
              }
              setModalStatus('forbidden', 'Sign in required for download.');
              return;
            }

            try {
              const payload = await requestBagBundleFromSidebar(nodes);
              const delivery = String(payload?.delivery || '').toLowerCase();
              if (delivery === 'sync') {
                const signedUrl = String(payload?.signedUrl || payload?.url || '').trim();
                if (!signedUrl) throw new Error('missing signed url');
                setModalStatus('ready', 'Bundle ready. Opening signed URL…');
                openSignedUrl(signedUrl);
                return;
              }
              if (delivery === 'async') {
                const jobId = String(payload?.jobId || '').trim();
                const result = await pollBundleReady(jobId, () => {
                  setModalStatus('queued', 'Preparing secure bundle…');
                });
                setModalStatus('ready', 'Bundle ready. Opening signed URL…');
                openSignedUrl(result?.signedUrl);
                return;
              }
              const fallback = resolveBundleReadyPayload(payload);
              if (fallback) {
                setModalStatus('ready', 'Bundle ready. Opening signed URL…');
                openSignedUrl(fallback?.signedUrl);
                return;
              }
              throw new Error('unsupported bag bundle response');
            } catch (bagError) {
              if (String(bagError?.code || '').toLowerCase() !== 'not-found') throw bagError;
              const legacyTokens = expandNodesToLegacyTokens(cfg, nodes);
              if (!legacyTokens.length) {
                setModalStatus('not-found', 'No bundle tokens found for this selection.');
                return;
              }
              const result = await requestBundleDownload({
                lookup,
                tokens: legacyTokens,
                onQueuedTick: () => {
                  setModalStatus('queued', 'Preparing secure bundle…');
                },
              });
              setModalStatus('ready', 'Bundle ready. Opening signed URL…');
              openSignedUrl(result?.signedUrl);
            }
          } catch (error) {
            const code = String(error?.code || '').toLowerCase();
            if (code === 'forbidden') {
              setModalStatus('forbidden', 'Access denied for one or more selected files.');
            } else if (code === 'not-found') {
              setModalStatus('not-found', 'Bundle source not found (DX-DL-404).');
            } else {
              setModalStatus('error', 'Bundle request failed. Retry or refresh (DX-DL-500).');
            }
          } finally {
            downloadNowButton.disabled = false;
            updateActionState();
          }
        };

        addToBagButton.addEventListener('click', async () => {
          const nodes = await resolveNormalizedSelection();
          if (!nodes.length) return;
          const bagApi = await ensureBagApi(window.location.origin);
          if (!bagApi) {
            setModalStatus('error', 'Bag runtime unavailable.');
            return;
          }
          nodes.forEach((node) => {
            bagApi.upsertSelection(normalizeNodeForBag(node, context));
          });
          setModalStatus('ready', `Added ${nodes.length} selection${nodes.length === 1 ? '' : 's'} to bag.`);
          window.location.assign(resolveBagRoutePath());
        });

        downloadNowButton.addEventListener('click', () => {
          void executeDownloadNow();
        });

        filterInput.addEventListener('input', () => {
          filterQuery = String(filterInput.value || '').trim().toLowerCase();
          renderTree();
        });
        selectAllButton.addEventListener('click', () => {
          setLeafSet(getActiveBucketLeafKeys(), true);
          refreshCheckboxStates();
        });
        clearButton.addEventListener('click', () => {
          setLeafSet(getActiveBucketLeafKeys(), false);
          refreshCheckboxStates();
        });
        expandAllButton.addEventListener('click', () => {
          const allExpandableIds = collectExpandableNodeIds(buildTreeModel(), []);
          allExpandableIds.forEach((nodeId) => expandedNodeKeys.add(nodeId));
          renderTree();
        });
        collapseAllButton.addEventListener('click', () => {
          const allExpandableIds = collectExpandableNodeIds(buildTreeModel(), []);
          allExpandableIds.forEach((nodeId) => expandedNodeKeys.delete(nodeId));
          renderTree();
        });

        controls.appendChild(addToBagButton);
        controls.appendChild(downloadNowButton);

        inner.appendChild(titleRow);
        inner.appendChild(statusBanner);
        folderStack.appendChild(bucketTabs);
        folderStack.appendChild(treeTools);
        folderStack.appendChild(treePanel);

        inner.appendChild(folderStack);
        inner.appendChild(controls);
        modal.appendChild(inner);
        document.body.appendChild(modal);
        close.addEventListener('click', removeModal);
        modal.addEventListener('click', (event) => {
          if (event.target === modal) removeModal();
        });
        document.addEventListener('keydown', onKeyDown);

        setLeaves();
        renderTree();
        setModalStatus('idle', '');

        const skipRemoteInventoryFetch = treeState.tree?.source === 'embedded'
          && treeState.leaves.some((leaf) => leaf?.kind === 'file');
        if (skipRemoteInventoryFetch) return;

        try {
          const token = await getAccessToken();
          if (!token) return;
          const payload = await requestAssetsJson({
            path: `/me/assets/${encodeURIComponent(lookup)}`,
            method: 'GET',
          });
          downloadTree = buildInventoryDownloadTree(cfg, lookup, payload);
          treeState.tree = normalizeTree(downloadTree);
          setLeaves();
          renderTree();
          setModalStatus('idle', '');
        } catch (error) {
          const code = String(error?.code || '').toLowerCase();
          if (code === 'forbidden') {
            setModalStatus('idle', '');
          } else {
            setModalStatus('error', 'Unable to load file tree. Using local tree fallback.');
          }
        }
      });
    });
  };

  const attachRecordingIndex = (cfg, btnSel, context) => {
    const buttons = Array.from(document.querySelectorAll(btnSel));
    if (!buttons.length) return;
    buttons.forEach((btn) => {
      if (!(btn instanceof HTMLElement) || btn.dataset.dexBound === '1') return;
      btn.dataset.dexBound = '1';

      const row = btn.closest('[data-dx-recording-index-row]');
      const pdfTokenRaw = String(cfg?.downloads?.recordingIndexPdfRef || '').trim();
      const bundleTokenRaw = String(cfg?.downloads?.recordingIndexBundleRef || '').trim();
      const parsedPdfToken = parseRecordingIndexPdfToken(pdfTokenRaw);
      const parsedBundleToken = parseRecordingIndexBundleToken(bundleTokenRaw);

      if (!row) return;
      row.setAttribute('data-dx-download-kind', 'recording-index-pdf');
      row.setAttribute('data-dx-download-state', 'idle');

      if (!parsedPdfToken || !parsedBundleToken) {
        btn.disabled = true;
        btn.setAttribute('aria-disabled', 'true');
        setDownloadState(row, 'not-found', 'Recording index bundle unavailable.');
        return;
      }

      btn.disabled = false;
      btn.removeAttribute('aria-disabled');
      setDownloadState(row, 'idle', '');
      btn.addEventListener('click', async () => {
        setDownloadState(row, 'resolving', 'Resolving secure download…');
        btn.disabled = true;
        try {
          const authState = await resolveDownloadAuthState();
          if (authState && !authState.authenticated) {
            setDownloadState(row, 'resolving', 'Sign in required for download.');
            try {
              if (await signInForDownloadAction()) return;
            } catch {
              setDownloadState(row, 'forbidden', 'Unable to start sign-in flow.');
              return;
            }
            setDownloadState(row, 'forbidden', 'Sign in required for download.');
            return;
          }
          const token = await getAccessToken();
          if (!token) {
            setDownloadState(row, 'resolving', 'Sign in required for download.');
            try {
              if (await signInForDownloadAction()) return;
            } catch {
              setDownloadState(row, 'forbidden', 'Unable to start sign-in flow.');
              return;
            }
            setDownloadState(row, 'forbidden', 'Sign in required for download.');
            return;
          }
          const tokens = [];
          if (parsedPdfToken?.normalized) tokens.push(parsedPdfToken.normalized);
          if (parsedBundleToken?.normalized && !tokens.includes(parsedBundleToken.normalized)) {
            tokens.push(parsedBundleToken.normalized);
          }
          const result = await requestBundleDownload({
            lookup: context?.lookup,
            tokens,
            onQueuedTick: () => {
              setDownloadState(row, 'queued', 'Preparing bundle…');
            },
          });
          setDownloadState(row, 'ready', 'Ready. Opening download…');
          openSignedUrl(result?.signedUrl);
          window.setTimeout(() => setDownloadState(row, 'idle', ''), 2200);
        } catch (error) {
          const code = String(error?.code || '').toLowerCase();
          if (code === 'forbidden') {
            setDownloadState(row, 'forbidden', 'Access denied (403).');
          } else if (code === 'not-found') {
            setDownloadState(row, 'not-found', 'Download not found (404).');
          } else {
            setDownloadState(row, 'error', 'Download failed (DX-DL-500).');
          }
        } finally {
          btn.disabled = false;
        }
      });
    });
  };

  const initPersonPins = () => {
    let activePopup = null;
    let activeHolder = null;
    const POPUP_MARGIN = 8;

    const parseLinks = (holder) => {
      let links = [];
      try {
        const parsed = JSON.parse(holder.getAttribute('data-links') || '[]');
        links = Array.isArray(parsed) ? parsed : [];
      } catch {
        links = [];
      }
      return links
        .map((link) => ({
          label: String(link?.label || '').trim(),
          href: String(link?.href || '').trim(),
        }))
        .filter((link) => link.label && link.href);
    };

    const setExpanded = (holder, expanded) => {
      if (!(holder instanceof HTMLElement)) return;
      holder.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    };

    const closePopup = ({ restoreFocus = false } = {}) => {
      if (activePopup instanceof HTMLElement) {
        activePopup.remove();
      }
      activePopup = null;
      if (activeHolder instanceof HTMLElement) {
        const target = activeHolder;
        setExpanded(target, false);
        activeHolder = null;
        if (restoreFocus) {
          try {
            target.focus({ preventScroll: true });
          } catch {
            target.focus();
          }
        }
      }
    };

    const positionPopup = (popup, holder) => {
      if (!(popup instanceof HTMLElement) || !(holder instanceof HTMLElement)) return;
      const rect = holder.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset || 0;
      const scrollY = window.scrollY || window.pageYOffset || 0;
      popup.style.left = `${Math.max(POPUP_MARGIN, scrollX + rect.left)}px`;
      popup.style.top = `${Math.max(POPUP_MARGIN, scrollY + rect.bottom + POPUP_MARGIN)}px`;

      const popupRect = popup.getBoundingClientRect();
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const maxLeft = scrollX + viewportWidth - popupRect.width - POPUP_MARGIN;
      const clampedLeft = Math.min(Math.max(scrollX + rect.left, POPUP_MARGIN), Math.max(POPUP_MARGIN, maxLeft));

      let top = scrollY + rect.bottom + POPUP_MARGIN;
      const maxTop = scrollY + viewportHeight - popupRect.height - POPUP_MARGIN;
      if (top > maxTop) {
        top = scrollY + rect.top - popupRect.height - POPUP_MARGIN;
      }
      const clampedTop = Math.max(POPUP_MARGIN, Math.min(top, Math.max(POPUP_MARGIN, maxTop)));
      popup.style.left = `${clampedLeft}px`;
      popup.style.top = `${clampedTop}px`;
    };

    const openPopup = (holder) => {
      if (!(holder instanceof HTMLElement)) return;
      const links = parseLinks(holder);
      if (!links.length) return;

      closePopup();
      const popup = document.createElement('div');
      const personLabel = String(holder.getAttribute('data-person') || 'Credit links').trim();
      popup.className = 'person-popup person-popup--dx';
      popup.setAttribute('role', 'dialog');
      popup.setAttribute('aria-label', `${personLabel} links`);
      popup.style.position = 'absolute';
      popup.style.zIndex = '2147483000';
      popup.style.minWidth = '196px';
      popup.style.maxWidth = 'min(312px, calc(100vw - 16px))';
      popup.style.padding = '10px 12px';
      popup.style.borderRadius = '10px';
      popup.style.border = '1px solid rgba(15, 19, 28, 0.18)';
      popup.style.background = 'linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 255, 0.95))';
      popup.style.boxShadow = '0 14px 28px rgba(9, 14, 24, 0.2)';
      popup.style.backdropFilter = 'blur(10px)';
      popup.style.webkitBackdropFilter = 'blur(10px)';
      popup.style.display = 'grid';
      popup.style.gap = '4px';
      popup.innerHTML = links
        .map((link) => `<a class="person-popup-link" href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`)
        .join('');
      document.body.append(popup);
      positionPopup(popup, holder);
      activePopup = popup;
      activeHolder = holder;
      setExpanded(holder, true);
    };

    const togglePopup = (holder) => {
      if (holder === activeHolder && activePopup instanceof HTMLElement) {
        closePopup();
        return;
      }
      openPopup(holder);
    };

    document.addEventListener('click', (event) => {
      if (!(activePopup instanceof HTMLElement)) return;
      const target = event.target;
      if (activePopup.contains(target)) return;
      if (activeHolder instanceof HTMLElement && activeHolder.contains(target)) return;
      closePopup();
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (!(activePopup instanceof HTMLElement)) return;
      event.preventDefault();
      closePopup({ restoreFocus: true });
    }, true);

    window.addEventListener('resize', () => {
      if (!(activePopup instanceof HTMLElement) || !(activeHolder instanceof HTMLElement)) return;
      positionPopup(activePopup, activeHolder);
    }, { passive: true });

    window.addEventListener('scroll', () => {
      if (!(activePopup instanceof HTMLElement) || !(activeHolder instanceof HTMLElement)) return;
      positionPopup(activePopup, activeHolder);
    }, { passive: true, capture: true });

    document.querySelectorAll('[data-person-linkable="true"][data-person]').forEach((holder) => {
      if (!(holder instanceof HTMLElement)) return;
      if (holder.dataset.dexPinBound === '1') return;
      holder.dataset.dexPinBound = '1';
      holder.classList.add('person-link');
      holder.style.cursor = 'pointer';
      holder.style.textDecoration = holder.style.textDecoration || 'underline';
      holder.style.textUnderlineOffset = holder.style.textUnderlineOffset || '0.12em';
      holder.setAttribute('role', holder.getAttribute('role') || 'button');
      holder.setAttribute('tabindex', holder.getAttribute('tabindex') || '0');
      holder.setAttribute('aria-haspopup', holder.getAttribute('aria-haspopup') || 'dialog');
      setExpanded(holder, false);

      holder.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        togglePopup(holder);
      });

      holder.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        togglePopup(holder);
      });
    });
  };

  const installSidebarRevealMotion = () => {
    if (prefersReducedMotion()) return;
    if (!(window.IntersectionObserver && typeof window.IntersectionObserver === 'function')) return;

    const sections = Array.from(document.querySelectorAll('.dex-sidebar section'));
    if (!sections.length) return;
    const sidebar = document.querySelector('.dex-sidebar');

    const observer = new IntersectionObserver(
      (entries, instance) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const node = entry.target;
          if (node.dataset.dexMotionReveal === '1') {
            instance.unobserve(node);
            return;
          }
          node.dataset.dexMotionReveal = '1';
          const index = Number(node.dataset.dexMotionRevealIndex || 0);
          animateNode(
            node,
            [
              { opacity: 0, transform: 'translate3d(0, 14px, 0)' },
              { opacity: 1, transform: 'translate3d(0, 0, 0)' },
            ],
            {
              duration: 320,
              delay: Math.min(index * 28, 240),
              easing: 'cubic-bezier(.22,.8,.24,1)',
              fill: 'both',
            },
          );
          instance.unobserve(node);
        });
      },
      {
        root: sidebar instanceof HTMLElement ? sidebar : null,
        threshold: 0.15,
        rootMargin: '0px 0px -8% 0px',
      },
    );

    sections.forEach((section, index) => {
      if (section.dataset.dexMotionReveal === '1') return;
      section.dataset.dexMotionRevealIndex = String(index);
      section.style.opacity = '0';
      section.style.transform = 'translate3d(0, 14px, 0)';
      observer.observe(section);
    });
    window.setTimeout(() => {
      sections.forEach((section) => {
        if (section.dataset.dexMotionReveal === '1') return;
        section.dataset.dexMotionReveal = '1';
        section.style.opacity = '1';
        section.style.transform = 'translate3d(0, 0, 0)';
        observer.unobserve(section);
      });
    }, 700);
  };

  const installSidebarInteractiveMotion = () => {
    if (prefersReducedMotion()) return;
    const nodes = Array.from(
      document.querySelectorAll('.dex-sidebar section, .dex-sidebar .license-btn, .dex-sidebar #downloads .btn-audio, .dex-sidebar #downloads .btn-video, .dex-sidebar #downloads .btn-download, .dex-sidebar #downloads .btn-recording-index'),
    );
    nodes.forEach((node) => {
      if (node.dataset.dexMotionBound === '1') return;
      node.dataset.dexMotionBound = '1';
      node.addEventListener('pointerenter', () => {
        animateNode(
          node,
          [
            { transform: 'translate3d(0, 0, 0) scale(1)' },
            { transform: 'translate3d(0, -2px, 0) scale(1.01)' },
          ],
          {
            duration: 180,
            easing: 'cubic-bezier(.2,.9,.25,1)',
            fill: 'forwards',
          },
        );
      });
      node.addEventListener('pointerleave', () => {
        animateNode(
          node,
          [
            { transform: 'translate3d(0, -2px, 0) scale(1.01)' },
            { transform: 'translate3d(0, 0, 0) scale(1)' },
          ],
          {
            duration: 140,
            easing: 'cubic-bezier(.22,.8,.24,1)',
            fill: 'forwards',
          },
        );
      });
    });
  };

  const boot = async () => {
    if (document.documentElement.dataset.dexSidebarRendered === '1') return;
    bindEntryPageTitleSeparatorWatcher(document);
    const fetchTargets = collectEntryFetchTargets();
    ensureEntryFetchShells(fetchTargets);
    bindHeaderFetchLifecycle(fetchTargets);
    bindDescriptionFetchLifecycle(fetchTargets);
    bindMediaFetchLifecycle(fetchTargets);
    try {
      const pageJson = parseJsonScript('dex-sidebar-page-config');
      const page = pageJson || window.dexSidebarPageConfig;
      if (!page) {
        throw new Error('Missing per-page sidebar config');
      }

      const globalCfg = parseJsonScript('dex-sidebar-config') || {};
      const manifest = parseJsonScript('dex-manifest') || { audio: {}, video: {} };

      const credits = page.credits || {};
      const linksByPerson = normalizeLinksByPersonMap(credits.linksByPerson);
      const instrumentValues = Array.isArray(credits.instruments)
        ? credits.instruments
        : [credits.instruments];
      const cfg = {
        license: globalCfg.license || {},
        attributionSentence: page.attributionSentence,
        credits: {
          ...credits,
          artist: pinValue(credits.artist, linksByPerson),
          artistAlt: credits.artistAlt,
          instruments: instrumentValues
            .map((value) => pinValue(value, linksByPerson))
            .map((value) => String(value || '').trim())
            .filter(Boolean),
          video: {
            director: pinValue(credits.video?.director, linksByPerson),
            cinematography: pinValue(credits.video?.cinematography, linksByPerson),
            editing: pinValue(credits.video?.editing, linksByPerson),
          },
          audio: {
            recording: pinValue(credits.audio?.recording, linksByPerson),
            mix: pinValue(credits.audio?.mix, linksByPerson),
            master: pinValue(credits.audio?.master, linksByPerson),
          },
        },
        downloads: {
          delivery: 'worker_bundle',
          formats: {
            audio: Array.isArray(globalCfg?.downloads?.formats?.audio) ? globalCfg.downloads.formats.audio : [],
            video: Array.isArray(globalCfg?.downloads?.formats?.video) ? globalCfg.downloads.formats.video : [],
          },
          recordingIndexPdfRef: String(
            page?.downloads?.recordingIndexPdfRef
            || page?.recordingIndexPdfRef
            || '',
          ).trim(),
          recordingIndexBundleRef: String(
            page?.downloads?.recordingIndexBundleRef
            || page?.recordingIndexBundleRef
            || '',
          ).trim(),
          recordingIndexSourceUrl: String(
            page?.downloads?.recordingIndexSourceUrl
            || page?.recordingIndexSourceUrl
            || '',
          ).trim(),
          fileTree: page?.downloads?.fileTree && typeof page.downloads.fileTree === 'object'
            ? page.downloads.fileTree
            : null,
          audioFileIds: manifest.audio || {},
          videoFileIds: manifest.video || {},
        },
        bucketFileStats: page?.bucketFileStats && typeof page.bucketFileStats === 'object'
          ? page.bucketFileStats
          : {},
        fileSpecs: page.fileSpecs || {},
        metadata: page.metadata || {},
      };

      const lookup = String(page.lookupNumber || '').trim() || 'Unknown lookup';
      const selected = normalizeBuckets(page.buckets);
      const badgesHtml = buildBucketsHtml(page.buckets, cfg, lookup);
      const favoriteBuckets = (selected.length ? selected : ALL_BUCKETS.filter((bucket) => bucketHasAnyAsset(cfg, bucket)));
      applySubtitleMetaItems(cfg);

      const origin = getSidebarAssetOrigin();
      ensureProfileChromeRuntime(origin);
      ensureInteractiveHoverRuntime(origin);
      ensureEntryRuntimeLayoutOverrides();
      ensureEntryButtonPrimitiveOverrides();
      let favoritesApi = activateFavoritesApi(getFavoritesApi());
      const favoritesHydrationPromise = favoritesApi
        ? Promise.resolve(favoritesApi)
        : ensureFavoritesApi(origin).then((api) => activateFavoritesApi(api));

      const SERIES_PATHS = {
        dex: '/assets/series/dex.png',
        index: '/assets/series/index.png',
        dexfest: '/assets/series/dexfest.png',
      };
      const sk = seriesKey(page);
      const seriesSrc = new URL(SERIES_PATHS[sk] || SERIES_PATHS.dex, origin).toString();
      const entryHref = normalizeLocationPath(window.location.pathname || '/');

      const overviewEl = document.querySelector('.dex-overview');
      if (overviewEl) {
        overviewEl.innerHTML = `
          <div class="overview-item overview-item--lookup">
            <span class="overview-lookup">#${lookup}</span>
            <p class="p3 overview-label overview-label--lookup">Lookup #</p>
          </div>
          <div class="overview-item overview-item--series">
            <img src="${seriesSrc}" alt="Series" class="overview-series-img"/>
            <p class="p3 overview-label overview-label--series">Series</p>
          </div>
        `;
        bindOverviewLookupFit();
        fitOverviewLookupText();
        await markTargetReady(fetchTargets, 'overview');
      }

      const collectionsEl = document.querySelector('.dex-collections');
      if (collectionsEl) {
        const bucketFavoriteButtonsHtml = favoriteBuckets
          .map((bucket) => `
            <button
              type="button"
              class="dx-button-element--secondary dx-fav-toggle dx-fav-bucket-toggle"
              data-bucket="${bucket}"
              data-dx-fav-chip="${bucket}"
              data-dx-fav-chip-case="upper"
              aria-label="Add bucket ${bucket} to favorites"
              title="Add bucket ${bucket} to favorites"
            ></button>
          `)
          .join('');
        const lookupChip = escapeHtml(lookup);
        collectionsEl.innerHTML = `
          <h3 data-dx-entry-heading="1">${injectCollectionZwnj(randomizeTitle(COLLECTION_HEADING_CANONICAL, { uppercase: false, seedKey: `${window.location.pathname || '/'}|collection` }))}</h3>
          <div class="overview-item overview-item--buckets">
            <p class="p3 overview-label">Available Buckets</p>
            <div class="overview-buckets-grid">${badgesHtml}</div>
          </div>
          <div class="overview-item overview-item--favorite-collection">
            <p class="p3 overview-label">Favorite This Collection</p>
            <button
              type="button"
              class="dx-button-element--primary dx-fav-toggle dx-fav-entry-toggle"
              data-dx-fav-chip="${lookupChip}"
              aria-label="Add entry to favorites"
              title="Add entry to favorites"
            ></button>
          </div>
          <div class="overview-item overview-item--favorite-buckets">
            <p class="p3 overview-label">Favorite Buckets</p>
            <div class="overview-badges">${bucketFavoriteButtonsHtml || '<span class="badge unavailable">No buckets</span>'}</div>
          </div>
        `;

        bindEntryTooltips(collectionsEl);

        const bindCollectionFavorites = (api) => {
          const activeApi = activateFavoritesApi(api, collectionsEl);
          if (!activeApi) return;
          const entryFavButton = collectionsEl.querySelector('.dx-fav-entry-toggle');
          if (entryFavButton) {
            bindFavoriteToggle(entryFavButton, activeApi, buildEntryFavoriteRecord(lookup, entryHref), {
              active: 'Favorited entry',
              inactive: 'Favorite entry',
            });
          }

          collectionsEl.querySelectorAll('.dx-fav-bucket-toggle').forEach((bucketButton) => {
            const bucket = String(bucketButton.getAttribute('data-bucket') || '').trim().toUpperCase();
            if (!bucket) return;
            bindFavoriteToggle(bucketButton, activeApi, buildBucketFavoriteRecord(lookup, entryHref, bucket), {
              active: `Favorited ${bucket}`,
              inactive: `Favorite ${bucket}`,
            });
          });
          favoritesApi = activeApi;
        };

        if (favoritesApi) {
          bindCollectionFavorites(favoritesApi);
        } else {
          const entryFavButton = collectionsEl.querySelector('.dx-fav-entry-toggle');
          if (entryFavButton) ensureFavoriteButtonContent(entryFavButton);
          collectionsEl.querySelectorAll('.dx-fav-bucket-toggle').forEach((bucketButton) => {
            ensureFavoriteButtonContent(bucketButton);
          });
          void favoritesHydrationPromise.then((api) => {
            if (!api) return;
            bindCollectionFavorites(api);
          });
        }
        await markTargetReady(fetchTargets, 'collections');
      }

      const labelSeedBase = `${window.location.pathname || '/'}|sidebar-label`;
      const copyLabel = randomizeTitleWithJoiners('Copy', { seedKey: `${labelSeedBase}|copy` });
      const usageNotesLabel = randomizeTitleWithJoiners('Usage Notes', { seedKey: `${labelSeedBase}|usage-notes` });
      const filesLabel = randomizeTitleWithJoiners('Get Files', { seedKey: `${labelSeedBase}|get-files` });
      const recordingIndexLabel = randomizeTitleWithJoiners('Recording Index', { seedKey: `${labelSeedBase}|recording-index` });
      ensureDownloadOnlyFileInfoCard(`${labelSeedBase}|download-card`);

      render('.dex-license', 'License', `
        <a class="dex-license-badge" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener"><img src="https://mirrors.creativecommons.org/presskit/buttons/88x31/svg/by.svg" alt="Creative Commons Attribution 4.0" class="badge-by"/></a>
        <p class="dex-attrib">This work contains samples licensed under CC-BY 4.0 by Dex Digital Sample Library and ${cfg.credits.artist}</p>
        <div class="dex-license-controls">
          <button type="button" class="license-btn copy-btn dx-button-element--primary" title="Copy attribution"><span class="copy-text">${copyLabel}</span></button>
          <button type="button" class="license-btn usage-btn dx-button-element--primary" onclick="window.open('https://dexdsl.com/copyright','_blank')">${usageNotesLabel}</button>
        </div>
      `);

      const copyBtn = document.querySelector('.dex-license .copy-btn');
      if (copyBtn && copyBtn.dataset.dexBound !== '1') {
        copyBtn.dataset.dexBound = '1';
        copyBtn.addEventListener('click', () => {
          const txt = `This work contains samples licensed under CC-BY 4.0 by Dex Digital Sample Library and ${cfg.credits.artist}`;
          navigator.clipboard?.writeText(txt);
          const span = copyBtn.querySelector('.copy-text');
          const orig = span?.textContent || copyLabel;
          if (span) {
            span.textContent = 'Copied!';
            setTimeout(() => {
              span.textContent = orig;
            }, 2000);
          }
        });
      }
      await markTargetReady(fetchTargets, 'license');

      const blankCredit = '<span class="person-text" data-person-linkable="false">—</span>';
      const creditValue = (value) => {
        const text = String(value || '').trim();
        return text || blankCredit;
      };
      const creditRow = (label, value, { role = false } = {}) => `
        <div class="${role ? 'dex-credits-role' : 'dex-credits-row'}">
          <span class="dex-credits-key">${label}</span>
          <span class="dex-credits-value">${creditValue(value)}</span>
        </div>
      `;
      const instrumentsLine = Array.isArray(cfg.credits.instruments) ? cfg.credits.instruments.join(', ') : String(cfg.credits.instruments || '');
      render('.dex-credits', 'Credits', `
        <div class="dex-credits-grid">
          ${creditRow('Artist', cfg.credits.artist)}
          ${cfg.credits.artistAlt ? creditRow('Alias', cfg.credits.artistAlt) : ''}
          ${creditRow('Instrument', instrumentsLine)}
          <div class="dex-credits-group">
            <div class="dex-credits-group-title">Video</div>
            ${creditRow('Dir', cfg.credits.video.director, { role: true })}
            ${creditRow('Cin', cfg.credits.video.cinematography, { role: true })}
            ${creditRow('Edit', cfg.credits.video.editing, { role: true })}
          </div>
          <div class="dex-credits-group">
            <div class="dex-credits-group-title">Audio</div>
            ${creditRow('Rec', cfg.credits.audio.recording, { role: true })}
            ${creditRow('Mix', cfg.credits.audio.mix, { role: true })}
            ${creditRow('Master', cfg.credits.audio.master, { role: true })}
          </div>
        </div>
        <div class="dex-badges">
          <span class="badge">${cfg.credits.season || ''} ${cfg.credits.year || ''}</span>
          <span class="badge">${cfg.credits.location || ''}</span>
        </div>
      `);
      void enhancePublicProfileAttribution({ page, lookup, entryHref });

      render('#downloads', 'Download', `<button type="button" class="btn-download dx-button-element--primary" aria-label="Get Files"><span>${filesLabel}</span></button><div class="dx-download-inline" data-dx-recording-index-row="1" data-dx-download-kind="recording-index-pdf" data-dx-download-state="idle"><button type="button" class="btn-recording-index dx-button-element--secondary" aria-label="Recording Index" data-dx-download-kind="recording-index-pdf"><span>${recordingIndexLabel}</span></button><span data-dx-download-status="1" hidden></span></div>`, true);
      const downloadsEl = document.querySelector('#downloads');
      if (downloadsEl instanceof HTMLElement) {
        downloadsEl.setAttribute('data-dx-download-mode', 'unified');
        downloadsEl.style.setProperty('display', 'grid', 'important');
        downloadsEl.style.setProperty('grid-template-columns', 'minmax(0, 1fr)', 'important');
        downloadsEl.style.setProperty('grid-auto-flow', 'row', 'important');
        downloadsEl.style.setProperty('align-items', 'stretch', 'important');
        downloadsEl.style.setProperty('gap', 'var(--space-2, 0.5rem)', 'important');
        const primaryDownloadBtn = downloadsEl.querySelector('.btn-download');
        const recordingRow = downloadsEl.querySelector('.dx-download-inline');
        const recordingBtn = downloadsEl.querySelector('.btn-recording-index');
        if (primaryDownloadBtn instanceof HTMLElement) {
          primaryDownloadBtn.style.setProperty('width', '100%', 'important');
          primaryDownloadBtn.style.setProperty('justify-self', 'stretch', 'important');
        }
        if (recordingRow instanceof HTMLElement) {
          recordingRow.style.setProperty('display', 'grid', 'important');
          recordingRow.style.setProperty('grid-template-columns', 'minmax(0, 1fr)', 'important');
          recordingRow.style.setProperty('grid-column', '1 / -1', 'important');
          recordingRow.style.setProperty('width', '100%', 'important');
        }
        if (recordingBtn instanceof HTMLElement) {
          recordingBtn.style.setProperty('width', '100%', 'important');
          recordingBtn.style.setProperty('justify-self', 'stretch', 'important');
          recordingBtn.style.setProperty('margin', '0', 'important');
        }
      }

      attachUnifiedDownload(cfg, '#downloads .btn-download', { lookup, entryHref, favoritesApi });
      attachRecordingIndex(cfg, '#downloads .btn-recording-index', { lookup, entryHref, favoritesApi });
      initPersonPins();
      installSidebarRevealMotion();
      installSidebarInteractiveMotion();
      bindEntryRailLayout();
      bindBreadcrumbSpinFallback();
      refreshFavoriteButtons(favoritesApi, document);
      void favoritesHydrationPromise.then((api) => {
        if (api) refreshFavoriteButtons(api, document);
      });

      document.documentElement.dataset.dexSidebarRendered = '1';
      await maybeMarkEntryLayoutReady(fetchTargets);
    } catch (error) {
      await markAllEntryFetchTargets(fetchTargets, FETCH_STATE_ERROR);
      throw error;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      boot().catch((error) => {
        console.error('[dex-sidebar] boot error', error);
      });
    }, { once: true });
  } else {
    boot().catch((error) => {
      console.error('[dex-sidebar] boot error', error);
    });
  }
})();
