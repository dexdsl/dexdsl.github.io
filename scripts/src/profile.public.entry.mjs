(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__dxProfilePublicLoaded && typeof window.__dxProfilePublicMount === 'function') {
    try { window.__dxProfilePublicMount(); } catch {}
    return;
  }
  window.__dxProfilePublicLoaded = true;

  const DEFAULT_API_BASE = 'https://dex-api.spring-fog-8edd.workers.dev';
  const CATALOG_INDEX_URL = '/data/catalog-performers.json';
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
  function loadCatalogIndex() {
    if (!catalogIndexPromise) {
      catalogIndexPromise = fetchJson(CATALOG_INDEX_URL).then((res) => {
        const map = new Map();
        const entries = (res.body && Array.isArray(res.body.entries)) ? res.body.entries : [];
        for (const e of entries) {
          const record = {
            lookup: toText(e.lookup),
            slug: toText(e.slug) || slugFromHref(e.href),
            href: normalizePath(e.href),
            title: toText(e.title) || toText(e.lookup, 'Catalog entry'),
            performer: toText(e.performer_display),
          };
          if (record.lookup) map.set(`lookup:${foldLookup(record.lookup)}`, record);
          if (record.slug) map.set(`slug:${record.slug.toLowerCase()}`, record);
          if (record.href) map.set(`href:${record.href.toLowerCase()}`, record);
        }
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

  function renderContributionCard(ref, catalog) {
    const meta = catalogMetaFor(ref, catalog);
    const lookup = toText(ref?.lookup || ref?.entry_lookup || ref?.entryLookupNumber || ref?.lookupNumber || meta.lookup);
    const title = toText(ref?.title || meta.title) || lookup || 'Catalog entry';
    const href = normalizePath(ref?.href || ref?.entryHref || ref?.entryUrl || meta.href);
    const role = toText(ref.role);
    const inner =
      (lookup ? `<span class="dx-prof-card-lookup">${htmlEscape(lookup)}</span>` : '') +
      `<h3 class="dx-prof-card-title">${htmlEscape(title)}</h3>` +
      (role ? `<span class="dx-prof-card-role">${htmlEscape(role)}</span>` : '');
    const cls = `dx-prof-card${ref.featured ? ' is-featured' : ''}`;
    return href
      ? `<a class="${cls}" href="${htmlEscape(href)}">${inner}</a>`
      : `<div class="${cls}">${inner}</div>`;
  }

  function favoriteRecordFromRef(ref, catalog) {
    if (typeof ref === 'string') {
      const trimmed = toText(ref);
      const parts = trimmed.split('|');
      if (parts.length >= 2) {
        const kind = parts[0];
        const lookup = parts[1];
        const bucket = parts[2] || '';
        const meta = catalogMetaFor({ lookup }, catalog);
        return {
          lookup,
          href: meta.href,
          title: kind === 'bucket' && bucket
            ? `${toText(meta.title, lookup)} — Bucket ${bucket}`
            : toText(meta.title, lookup),
          role: kind === 'file' ? 'Favorite file' : kind === 'bucket' ? 'Favorite bucket' : 'Favorite entry',
        };
      }
      return { lookup: trimmed };
    }
    return {
      lookup: ref?.entryLookupNumber || ref?.entryLookup || ref?.lookupNumber || ref?.lookup || ref?.key || '',
      href: ref?.entryHref || ref?.entryUrl || ref?.href || '',
      title: ref?.title || ref?.lookupNumber || ref?.lookup || '',
      role: ref?.kind ? `Favorite ${ref.kind}` : '',
    };
  }

  function renderProfile(profile, catalog) {
    const name = toText(profile.credit_name) || toText(profile.handle) || 'Member';
    const dexId = toText(profile.dex_id);
    const meta = [];
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
           <p class="dx-prof-section-label">Favorite samples &amp; collections</p>
           <div class="dx-prof-grid">${favorites
             .map((ref) => renderContributionCard(favoriteRecordFromRef(ref, catalog), catalog))
             .join('')}</div>
         </section>`
      : '';

    const rolesHtml = renderChips(profile.roles, profile.role_primary);
    const instrHtml = renderChips(profile.instruments, profile.instrument_primary);

    return `
      <section class="dx-prof-shell">
        <header class="dx-prof-head">
          <div class="dx-prof-avatar" aria-hidden="true">${htmlEscape(initialsOf(name))}</div>
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
        ${(rolesHtml || instrHtml) ? `<section class="dx-prof-section">${rolesHtml}${instrHtml}</section>` : ''}
        <section class="dx-prof-section">
          <p class="dx-prof-section-label">Contributions</p>
          ${contribHtml}
        </section>
        ${favHtml}
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

    function paint(html, state) {
      const elapsed = ((window.performance && performance.now) ? performance.now() : Date.now()) - startedAt;
      const finish = () => {
        root.innerHTML = '';
        if (loader) root.appendChild(loader);
        root.insertAdjacentHTML('beforeend', html);
        setFetchState(root, state);
        if (state === 'ready') {
          const heading = root.querySelector('.dx-prof-name');
          if (heading && typeof window.__dxHeadingFx === 'object') {
            // leave heading as-is (randomize disabled) — names are not catalog headings
          }
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
      document.title = `${toText(res.body.credit_name) || toText(res.body.handle) || 'Member'} — dex digital sample library`;
      paint(renderProfile(res.body, catalog), 'ready');
    } else {
      paint(renderNotFound(), 'error');
    }
  }

  bindCopy(document);
  window.__dxProfilePublicMount = mount;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
