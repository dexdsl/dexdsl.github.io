/* profile-badges.js — read-only "Badges" section on a public member profile.
 *
 * The public profile at /u/:handle is rendered by profile.public.js from static
 * catalog data; achievements live in the dex-api worker. This module fetches the
 * member's unlocked badges from GET {DEX_API}/u/:handle/achievements (public,
 * gated on profile_public, secret badges omitted) and appends a Badges section
 * to #dex-profile. It never mutates anything.
 *
 * profile.public.js sets #dex-profile via innerHTML, so we observe the node and
 * (re-)inject after each render. Idempotent; runs on load and dx:slotready.
 */
(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const API_ORIGIN = String(
    window.DEX_API_ORIGIN || window.DEX_API_BASE_URL || 'https://dex-api.spring-fog-8edd.workers.dev'
  ).replace(/\/+$/, '');
  const HEROICONS = '/assets/vendor/heroicons/24/outline/';

  // Badge glyph -> heroicon, mirroring the map in achievements.js.
  const GLYPHS = {
    submission: 'document-arrow-up.svg',
    'submission-stack': 'rectangle-stack.svg',
    release: 'arrow-down-tray.svg',
    license: 'check-circle.svg',
    joint: 'share.svg',
    poll: 'list-bullet.svg',
    streak: 'star.svg',
    call: 'eye.svg',
    lane: 'bars-3.svg',
    favorite: 'heart.svg',
    profile: 'user-circle.svg',
    explorer: 'eye.svg',
    rhythm: 'list-bullet.svg',
    vault: 'key.svg',
    secret: 'lock-closed.svg',
    archive: 'archive-box-arrow-down.svg',
  };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function handleFromPath() {
    const match = (window.location.pathname || '').match(/\/u\/([^/]+)\/?/i);
    return match ? decodeURIComponent(match[1]).trim() : '';
  }

  let cache; // undefined = not fetched, null = no badges, object = payload
  let fetchInFlight = null;

  async function loadBadges(handle) {
    if (cache !== undefined) return cache;
    if (fetchInFlight) return fetchInFlight;
    fetchInFlight = (async () => {
      try {
        const res = await fetch(`${API_ORIGIN}/u/${encodeURIComponent(handle)}/achievements`, {
          credentials: 'omit',
          cache: 'no-store',
        });
        if (!res.ok) return (cache = null);
        const payload = await res.json().catch(() => null);
        if (!payload || payload.ok !== true || !Array.isArray(payload.badges) || !payload.badges.length) {
          return (cache = null);
        }
        return (cache = payload);
      } catch {
        return (cache = null);
      } finally {
        fetchInFlight = null;
      }
    })();
    return fetchInFlight;
  }

  function badgeMarkup(badge) {
    const icon = HEROICONS + (GLYPHS[String(badge.glyph || '').toLowerCase()] || GLYPHS.streak);
    return `<li class="dx-profile-badge" data-tier="${esc(badge.tier)}" data-category="${esc(
      badge.category
    )}" title="${esc(badge.title)}">
      <span class="dx-profile-badge-glyph-wrap">
        <img src="${esc(icon)}" class="dx-profile-badge-glyph" alt="" loading="lazy" decoding="async" aria-hidden="true">
      </span>
      <span class="dx-profile-badge-title">${esc(badge.title)}</span>
    </li>`;
  }

  function inject(root, payload) {
    if (!(root instanceof HTMLElement)) return;
    if (root.querySelector('[data-dx-profile-badges]')) return; // already present after this render
    const section = document.createElement('section');
    section.className = 'dx-profile-badges';
    section.setAttribute('data-dx-profile-badges', '');
    const total = payload.totals && Number(payload.totals.unlocked) ? Number(payload.totals.unlocked) : payload.badges.length;
    section.innerHTML = `
      <h2 class="dx-profile-badges-heading">Badges <span class="dx-profile-badges-count">${esc(total)}</span></h2>
      <ul class="dx-profile-badges-list">${payload.badges.map(badgeMarkup).join('')}</ul>`;
    root.appendChild(section);
  }

  async function enhance() {
    const root = document.getElementById('dex-profile');
    if (!(root instanceof HTMLElement) || !root.children.length) return; // wait for profile render
    const handle = handleFromPath();
    if (!handle) return;
    const payload = await loadBadges(handle);
    if (!payload) return;
    inject(root, payload);
  }

  function watch() {
    const root = document.getElementById('dex-profile');
    if (root instanceof HTMLElement && typeof MutationObserver === 'function') {
      const observer = new MutationObserver(() => enhance());
      observer.observe(root, { childList: true });
    }
    enhance();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watch, { once: true });
  } else {
    watch();
  }
  window.addEventListener('dx:slotready', () => {
    cache = undefined; // handle may have changed on soft-nav
    enhance();
  });
})();
