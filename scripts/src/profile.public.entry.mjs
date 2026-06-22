(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__dxProfilePublicLoaded && typeof window.__dxProfilePublicMount === 'function') {
    try { window.__dxProfilePublicMount(); } catch {}
    return;
  }
  window.__dxProfilePublicLoaded = true;

  const DEFAULT_API_BASE = 'https://dex-api.spring-fog-8edd.workers.dev';
  const CATALOG_INDEX_URL = '/data/catalog-performers.json';
  const CATALOG_ENTRIES_URL = '/data/catalog.entries.json';
  const API_TIMEOUT_MS = 9000;
  const MIN_SHEEN_MS = 140;

  function toText(value, fallback = '') {
    const text = String(value == null ? '' : value).trim();
    return text || fallback;
  }

  function htmlEscape(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function firstText(...values) {
    for (const value of values) {
      const next = toText(value);
      if (next) return next;
    }
    return '';
  }

  function getApiBase() {
    const raw = toText(window.DEX_API_BASE_URL || window.DEX_API_ORIGIN || DEFAULT_API_BASE, DEFAULT_API_BASE);
    return raw.replace(/\/+$/, '');
  }

  function setFetchState(root, state) {
    if (!(root instanceof HTMLElement)) return;
    root.setAttribute('data-dx-fetch-state', state);
    if (state === 'loading') root.setAttribute('aria-busy', 'true');
    else root.removeAttribute('aria-busy');
  }

  function foldLookup(value) {
    return toText(value).toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function normalizePath(pathname) {
    const raw = toText(pathname);
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
    const clean = normalized.replace(/\/+/g, '/');
    if (clean === '/') return '/';
    return clean.endsWith('/') ? clean : `${clean}/`;
  }

  function slugFromHref(href) {
    const match = normalizePath(href).match(/\/entry\/([^/]+)\/?/i);
    return match ? match[1] : '';
  }

  // Pull the handle from /u/<handle>/ (or ?u= fallback for local dev).
  function resolveHandle() {
    const fromQuery = new URLSearchParams(window.location.search).get('u');
    if (fromQuery) return decodeURIComponent(fromQuery).trim();
    const m = window.location.pathname.match(/\/u\/([^/]+)\/?/i);
    return m ? decodeURIComponent(m[1]).trim() : '';
  }

  function initialsOf(name) {
    const parts = toText(name).split(/\s+/).filter(Boolean);
    if (!parts.length) return '—';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // Deterministic, on-brand gradient so an empty avatar never looks barren.
  function hashSeed(value) {
    const text = toText(value) || 'dex';
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
      hash >>>= 0;
    }
    return hash >>> 0;
  }

  function avatarGradient(seedValue) {
    const seed = hashSeed(seedValue);
    const hueA = seed % 360;
    const hueB = (hueA + 50 + ((seed >> 8) % 130)) % 360;
    return { a: `hsl(${hueA}, 78%, 62%)`, b: `hsl(${hueB}, 70%, 50%)` };
  }

  // Map a social profile URL to an avatar resolver (unavatar). Best-effort:
  // the loader falls back to the gradient when nothing resolves.
  const SOCIAL_AVATAR_PROVIDERS = [
    { host: /(^|\.)twitter\.com$/i, provider: 'twitter' },
    { host: /(^|\.)x\.com$/i, provider: 'twitter' },
    { host: /(^|\.)instagram\.com$/i, provider: 'instagram' },
    { host: /(^|\.)tiktok\.com$/i, provider: 'tiktok' },
    { host: /(^|\.)github\.com$/i, provider: 'github' },
    { host: /(^|\.)soundcloud\.com$/i, provider: 'soundcloud' },
    { host: /(^|\.)youtube\.com$/i, provider: 'youtube' },
    { host: /(^|\.)dribbble\.com$/i, provider: 'dribbble' },
    { host: /(^|\.)twitch\.tv$/i, provider: 'twitch' },
    { host: /(^|\.)reddit\.com$/i, provider: 'reddit' },
  ];

  function socialAvatarUrl(rawUrl) {
    const value = toText(rawUrl);
    if (!value) return '';
    let parsed;
    try { parsed = new URL(value, window.location.origin); } catch { return ''; }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    const match = SOCIAL_AVATAR_PROVIDERS.find((p) => p.host.test(parsed.hostname));
    if (!match) return '';
    const segments = parsed.pathname.split('/').filter(Boolean);
    let username = segments[0] || '';
    if (match.provider === 'youtube' && (segments[0] === 'channel' || segments[0] === 'c' || segments[0] === 'user')) {
      username = segments[1] || '';
    }
    username = username.replace(/^@/, '');
    if (!username) return '';
    return `https://unavatar.io/${match.provider}/${encodeURIComponent(username)}?fallback=false`;
  }

  function avatarCandidates(profile) {
    const out = [];
    const explicitFields = [
      profile?.provider?.picture,
      profile?.provider?.avatar_url,
      profile?.provider?.avatarUrl,
      profile?.provider?.image_url,
      profile?.social_profile?.picture,
      profile?.social_profile?.avatarAssetUrl,
      profile?.socialProfile?.picture,
      profile?.socialProfile?.avatarAssetUrl,
      profile?.identity?.provider?.picture,
      profile?.identity?.picture,
      profile?.avatarAssetUrl,
      profile?.avatar_asset_url,
      profile?.avatarUrl,
      profile?.avatar_url,
      profile?.avatar,
      profile?.picture,
      profile?.profile_picture,
      profile?.profilePicture,
      profile?.photo_url,
      profile?.photoUrl,
      profile?.image_url,
      profile?.imageUrl,
      profile?.icon_url,
      profile?.iconUrl,
    ];
    for (const value of explicitFields) {
      const src = toText(value);
      if (src && !out.includes(src)) out.push(src);
    }
    const links = Array.isArray(profile.links) ? profile.links : [];
    for (const link of links) {
      const url = socialAvatarUrl(link && link.url);
      if (url && !out.includes(url)) out.push(url);
    }
    return out;
  }

  function renderAvatar(profile, name) {
    const grad = avatarGradient(profile.dex_id || profile.handle || name);
    const style = `--dx-av-a:${grad.a};--dx-av-b:${grad.b}`;
    return `<div class="dx-prof-avatar" data-dx-avatar style="${htmlEscape(style)}">`
      + `<span class="dx-prof-avatar-initials" aria-hidden="true">${htmlEscape(initialsOf(name))}</span>`
      + `<img class="dx-prof-avatar-img" alt="" decoding="async" referrerpolicy="no-referrer" data-dx-avatar-img hidden>`
      + `</div>`;
  }

  // Try each candidate via an off-DOM probe so a failed fetch never flashes a
  // broken image over the gradient. First success wins.
  function hydrateAvatar(root, candidates) {
    if (!Array.isArray(candidates) || !candidates.length) return;
    const img = root.querySelector('[data-dx-avatar-img]');
    const shell = root.querySelector('[data-dx-avatar]');
    if (!(img instanceof HTMLImageElement)) return;
    let index = 0;
    const tryNext = () => {
      if (index >= candidates.length) return;
      const src = candidates[index];
      index += 1;
      const probe = new Image();
      probe.referrerPolicy = 'no-referrer';
      probe.onload = () => {
        if (!probe.naturalWidth) { tryNext(); return; }
        img.src = src;
        img.hidden = false;
        img.removeAttribute('hidden');
        if (shell) shell.setAttribute('data-dx-avatar-ready', 'true');
      };
      probe.onerror = tryNext;
      probe.src = src;
    };
    tryNext();
  }

  async function fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      let body = null;
      try { body = await res.json(); } catch {}
      return { ok: res.ok, status: res.status, body };
    } catch {
      return { ok: false, status: 0, body: null };
    } finally {
      clearTimeout(timer);
    }
  }

  let catalogIndexPromise = null;

  function mergeCatalogRecord(existing, next) {
    if (!existing) return next;
    return {
      lookup: firstText(existing.lookup, next.lookup),
      slug: firstText(existing.slug, next.slug),
      href: firstText(existing.href, next.href),
      title: firstText(existing.title, next.title),
      performer: firstText(existing.performer, next.performer),
      imageSrc: firstText(existing.imageSrc, next.imageSrc),
      imageAlt: firstText(existing.imageAlt, next.imageAlt),
    };
  }

  function addCatalogRecord(map, record) {
    if (!record || typeof record !== 'object') return;
    const normalized = {
      lookup: toText(record.lookup || record.lookup_raw || record.lookupNumber),
      slug: toText(record.slug || record.id || record.entry_id) || slugFromHref(record.href || record.entry_href || record.entryHref),
      href: normalizePath(record.href || record.entry_href || record.entryHref),
      title: toText(record.title || record.title_raw) || toText(record.lookup || record.lookup_raw, 'Catalog entry'),
      performer: toText(record.performer_display || record.performer || record.performer_raw),
      imageSrc: toText(record.imageSrc || record.image_src || record.thumbnailSrc || record.thumbnail),
      imageAlt: toText(record.imageAlt || record.image_alt || record.image_alt_raw),
    };
    const keys = [];
    if (normalized.lookup) keys.push(`lookup:${foldLookup(normalized.lookup)}`);
    if (normalized.slug) keys.push(`slug:${normalized.slug.toLowerCase()}`);
    if (normalized.href) keys.push(`href:${normalized.href.toLowerCase()}`);
    for (const key of keys) map.set(key, mergeCatalogRecord(map.get(key), normalized));
  }

  function entriesFromCatalogPayload(body) {
    return body && Array.isArray(body.entries) ? body.entries : [];
  }

  function loadCatalogIndex() {
    if (!catalogIndexPromise) {
      catalogIndexPromise = Promise.all([
        fetchJson(CATALOG_INDEX_URL),
        fetchJson(CATALOG_ENTRIES_URL),
      ]).then(([performerRes, entriesRes]) => {
        const map = new Map();
        for (const e of entriesFromCatalogPayload(performerRes.body)) addCatalogRecord(map, e);
        for (const e of entriesFromCatalogPayload(entriesRes.body)) addCatalogRecord(map, e);
        return map;
      }).catch(() => new Map());
    }
    return catalogIndexPromise;
  }

  function catalogMetaFor(ref, catalog) {
    const lookup = toText(ref?.lookup || ref?.entry_lookup || ref?.entryLookupNumber || ref?.lookupNumber || ref);
    const slug = toText(ref?.slug) || slugFromHref(ref?.href || ref?.entryHref || ref?.entryUrl || '');
    const href = normalizePath(ref?.href || ref?.entryHref || ref?.entryUrl || '');
    return (
      (lookup && catalog.get(`lookup:${foldLookup(lookup)}`)) ||
      (slug && catalog.get(`slug:${slug.toLowerCase()}`)) ||
      (href && catalog.get(`href:${href.toLowerCase()}`)) ||
      {}
    );
  }

  function renderChips(items, primary) {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!list.length) return '';
    return `<div class="dx-prof-chips">${list
      .map((item) => `<span class="dx-prof-chip${item === primary ? ' is-primary' : ''}">${htmlEscape(item)}</span>`)
      .join('')}</div>`;
  }

  function renderEntryCard(ref, catalog, options = {}) {
    const meta = catalogMetaFor(ref, catalog);
    const lookup = toText(ref?.lookup || ref?.entry_lookup || ref?.entryLookupNumber || ref?.lookupNumber || meta.lookup);
    const title = toText(ref?.title || meta.title) || lookup || 'Catalog entry';
    const href = normalizePath(ref?.href || ref?.entryHref || ref?.entryUrl || meta.href);
    const role = toText(ref.role);
    const imageSrc = toText(ref?.imageSrc || ref?.image_src || ref?.thumbnailSrc || ref?.thumbnail || meta.imageSrc);
    const imageAlt = toText(ref?.imageAlt || ref?.image_alt || ref?.image_alt_raw || meta.imageAlt || title);
    const thumb = options.preview && imageSrc
      ? `<span class="dx-prof-card-thumb"><img src="${htmlEscape(imageSrc)}" alt="${htmlEscape(imageAlt)}" loading="lazy" decoding="async"></span>`
      : (options.preview ? '<span class="dx-prof-card-thumb is-empty" aria-hidden="true"></span>' : '');
    const copy =
      `<span class="dx-prof-card-copy">` +
      (lookup ? `<span class="dx-prof-card-lookup">${htmlEscape(lookup)}</span>` : '') +
      `<span class="dx-prof-card-title">${htmlEscape(title)}</span>` +
      (role ? `<span class="dx-prof-card-role">${htmlEscape(role)}</span>` : '') +
      `</span>`;
    const arrow = href ? '<span class="dx-prof-card-arrow" aria-hidden="true">View</span>' : '';
    const inner = `${thumb}${copy}${arrow}`;
    const cls = `dx-prof-card${options.preview ? ' dx-prof-card--media' : ''}${ref.featured ? ' is-featured' : ''}`;
    return href
      ? `<a class="${cls}" href="${htmlEscape(href)}">${inner}</a>`
      : `<div class="${cls}">${inner}</div>`;
  }

  function renderContributionCard(ref, catalog) {
    return renderEntryCard(ref, catalog);
  }

  function favoriteRecordFromRef(ref, catalog) {
    if (typeof ref === 'string') {
      const trimmed = toText(ref);
      const parts = trimmed.split('|');
      if (parts.length >= 2) {
        const kind = parts[0];
        const value = parts[1];
        const bucket = parts[2] || '';
        // Favorite refs encode the entry as either a lookup number or an entry
        // href (e.g. "entry|/entry/2-organs-midori-ataka/"). Resolve catalog
        // metadata by href when it looks like a path so the card gets a real
        // title, thumbnail, and a working link to the entry page.
        const looksLikeHref = /^(https?:)?\//.test(value);
        const meta = catalogMetaFor(looksLikeHref ? { href: value } : { lookup: value }, catalog);
        const lookup = toText(meta.lookup) || (looksLikeHref ? '' : value);
        const href = toText(meta.href) || (looksLikeHref ? normalizePath(value) : '');
        const baseTitle = toText(meta.title) || lookup || (looksLikeHref ? '' : value);
        return {
          lookup,
          href,
          title: kind === 'bucket' && bucket ? `${baseTitle} — Bucket ${bucket}` : baseTitle,
          role: kind === 'file' ? 'Favorite file' : kind === 'bucket' ? 'Favorite bucket' : 'Favorite entry',
          imageSrc: toText(meta.imageSrc),
          imageAlt: toText(meta.imageAlt, baseTitle),
        };
      }
      return { lookup: trimmed };
    }
    return {
      lookup: ref?.entryLookupNumber || ref?.entryLookup || ref?.lookupNumber || ref?.lookup || ref?.key || '',
      href: ref?.entryHref || ref?.entryUrl || ref?.href || '',
      title: ref?.title || ref?.lookupNumber || ref?.lookup || '',
      role: ref?.kind ? `Favorite ${ref.kind}` : '',
      imageSrc: ref?.imageSrc || ref?.image_src || ref?.thumbnailSrc || ref?.thumbnail || '',
      imageAlt: ref?.imageAlt || ref?.image_alt || ref?.image_alt_raw || '',
    };
  }

  function displayNameForProfile(profile) {
    return firstText(
      profile?.credit_name,
      profile?.name,
      profile?.display_name,
      profile?.displayName,
      profile?.full_name,
      profile?.fullName,
      profile?.provider?.name,
      profile?.provider?.displayName,
      profile?.identity?.name,
      profile?.handle,
      'Member',
    );
  }

  function handleLabel(handle) {
    const value = toText(handle).replace(/^@+/, '');
    return value ? `@${value}` : '';
  }

  function renderProfile(profile, catalog) {
    const name = displayNameForProfile(profile);
    const handle = toText(profile.handle).replace(/^@+/, '');
    const dexId = toText(profile.dex_id);
    const meta = [];
    if (handle) {
      meta.push(`<a class="dx-prof-handle" href="/u/${htmlEscape(encodeURIComponent(handle))}/">${htmlEscape(handleLabel(handle))}</a>`);
    }
    if (toText(profile.location)) meta.push(`<span>${htmlEscape(profile.location)}</span>`);
    if (toText(profile.pronouns)) meta.push(`<span class="dx-prof-pronouns">${htmlEscape(profile.pronouns)}</span>`);

    const links = Array.isArray(profile.links) ? profile.links : [];
    const linksHtml = links.length
      ? `<div class="dx-prof-links">${links
          .map((l) => `<a class="dx-prof-link" href="${htmlEscape(l.url)}" rel="me noopener" target="_blank">${htmlEscape(l.label || l.url)}</a>`)
          .join('')}</div>`
      : '';

    const contributions = Array.isArray(profile.contributions) ? profile.contributions : [];
    const contribHtml = contributions.length
      ? `<div class="dx-prof-grid">${contributions.map((c) => renderContributionCard(c, catalog)).join('')}</div>`
      : '<p class="dx-prof-empty">No public contributions yet.</p>';

    const favorites = Array.isArray(profile.favorites) ? profile.favorites : [];
    const favHtml = favorites.length
      ? `<section class="dx-prof-section">
           <div class="dx-prof-section-head">
             <p class="dx-prof-section-label">Saved</p>
             <h2 class="dx-prof-section-title">Favorite samples &amp; collections</h2>
           </div>
           <div class="dx-prof-grid dx-prof-grid--favorites">${favorites
             .map((ref) => renderEntryCard(favoriteRecordFromRef(ref, catalog), catalog, { preview: true }))
             .join('')}</div>
         </section>`
      : '';

    const rolesHtml = renderChips(profile.roles, profile.role_primary);
    const instrHtml = renderChips(profile.instruments, profile.instrument_primary);

    return `
      <section class="dx-prof-shell">
        <header class="dx-prof-head">
          ${renderAvatar(profile, name)}
          <div class="dx-prof-id">
            <h1 class="dx-prof-name" data-dx-heading-randomize="false">${htmlEscape(name)}</h1>
            <div class="dx-prof-metarow">
              ${dexId ? `<button type="button" class="dx-prof-dexid" data-dx-copy="${htmlEscape(dexId)}" title="Copy Dex ID">${htmlEscape(dexId)}</button>` : ''}
              ${meta.join('')}
            </div>
            ${toText(profile.bio) ? `<p class="dx-prof-bio">${htmlEscape(profile.bio)}</p>` : ''}
            ${linksHtml}
          </div>
        </header>
        <div class="dx-prof-body">
          ${(rolesHtml || instrHtml) ? `<section class="dx-prof-section dx-prof-section--chips">${rolesHtml}${instrHtml}</section>` : ''}
          <section class="dx-prof-section">
            <div class="dx-prof-section-head">
              <p class="dx-prof-section-label">Public record</p>
              <h2 class="dx-prof-section-title">Contributions</h2>
            </div>
            ${contribHtml}
          </section>
          ${favHtml}
        </div>
      </section>`;
  }

  function renderNotFound() {
    return `
      <section class="dx-prof-shell">
        <div class="dx-prof-notfound">
          <h1>Profile not found</h1>
          <p class="dx-prof-empty">This member profile is private or does not exist.</p>
          <p class="dx-prof-empty"><a class="dx-prof-link" href="/catalog/">Browse the catalog</a></p>
        </div>
      </section>`;
  }

  // The header runtime only publishes --dx-profile-footer-height for protected
  // routes; /u is public, so it never reserves footer space and the glass would
  // run under the fixed footer. Measure the footer ourselves into a separate
  // variable the CSS falls back to (so we never fight the header runtime).
  function syncFooterMetrics() {
    if (typeof document === 'undefined' || !document.documentElement) return;
    const footers = document.querySelectorAll('.dex-footer');
    let height = 0;
    footers.forEach((footer) => {
      if (!(footer instanceof HTMLElement)) return;
      const rect = footer.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) height = Math.max(height, Math.round(rect.height));
    });
    const root = document.documentElement;
    if (height > 0) root.style.setProperty('--dx-prof-measured-footer', `${height}px`);
    else root.style.removeProperty('--dx-prof-measured-footer');
  }

  let footerMetricsBound = false;
  function bindFooterMetrics() {
    syncFooterMetrics();
    // The footer is injected asynchronously by the header runtime; retry a few
    // times so the first paint still settles on the right height.
    [120, 320, 700, 1400].forEach((delay) => setTimeout(syncFooterMetrics, delay));
    if (footerMetricsBound) return;
    footerMetricsBound = true;
    window.addEventListener('resize', syncFooterMetrics, { passive: true });
    window.addEventListener('dx:slotready', syncFooterMetrics);
    window.addEventListener('dx:route-transition-in:end', syncFooterMetrics);
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(() => syncFooterMetrics());
      const target = document.querySelector('.dex-footer') || document.body;
      if (target) observer.observe(target);
    }
  }

  function bindCopy(root) {
    root.addEventListener('click', (event) => {
      const btn = event.target instanceof Element ? event.target.closest('[data-dx-copy]') : null;
      if (!btn) return;
      const value = btn.getAttribute('data-dx-copy') || '';
      if (navigator.clipboard && value) {
        navigator.clipboard.writeText(value).then(() => {
          const prev = btn.textContent;
          btn.textContent = 'Copied';
          setTimeout(() => { btn.textContent = prev; }, 1200);
        }).catch(() => {});
      }
    });
  }

  async function mount() {
    const root = document.getElementById('dex-profile');
    if (!root) return;

    setFetchState(root, 'loading');
    const startedAt = (window.performance && performance.now) ? performance.now() : Date.now();
    const handle = resolveHandle();

    const loader = root.querySelector('.dx-route-loader');

    function paint(html, state, afterPaint) {
      const elapsed = ((window.performance && performance.now) ? performance.now() : Date.now()) - startedAt;
      const finish = () => {
        root.innerHTML = '';
        if (loader) root.appendChild(loader);
        root.insertAdjacentHTML('beforeend', html);
        setFetchState(root, state);
        if (typeof afterPaint === 'function') {
          try { afterPaint(); } catch {}
        }
      };
      if (elapsed < MIN_SHEEN_MS) setTimeout(finish, MIN_SHEEN_MS - elapsed);
      else finish();
    }

    if (!handle) {
      paint(renderNotFound(), 'error');
      return;
    }

    // GET /u route contract: public profile endpoint, no auth required.
    const [res, catalog] = await Promise.all([
      fetchJson(`${getApiBase()}/u/${encodeURIComponent(handle)}`),
      loadCatalogIndex(),
    ]);

    if (res.ok && res.body && typeof res.body === 'object') {
      document.title = `${displayNameForProfile(res.body)} — dex digital sample library`;
      const candidates = avatarCandidates(res.body);
      paint(renderProfile(res.body, catalog), 'ready', () => hydrateAvatar(root, candidates));
    } else {
      paint(renderNotFound(), 'error');
    }
  }

  bindCopy(document);
  bindFooterMetrics();
  window.__dxProfilePublicMount = mount;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
