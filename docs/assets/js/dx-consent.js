/* dx-consent.js — first-party, no-banner consent preferences for Dex.
 *
 * Dex is privacy-minimal: nothing optional loads on page load, so there is NO
 * interstitial cookie banner. Instead this module stores a small, versioned,
 * revocable preference and renders an on-demand preferences panel (on the
 * /cookies page). Essential storage and cookieless Cloudflare analytics need no
 * consent; the only optional category today is third-party media embeds
 * (YouTube), which the phase-2 entry-page gate will read from here.
 *
 * Public API (window.dexConsent):
 *   get()                -> { version, media, updatedAt }
 *   set(category, bool)  -> persists + notifies
 *   allows(category)     -> boolean
 *   onChange(cb)         -> unsubscribe fn
 *   CATEGORIES           -> ['media']
 *
 * Idempotent; (re)renders any [data-dx-consent-panel] on load and dx:slotready,
 * following the dx-legal.js / dx-pagenav.js pattern.
 */
(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.dexConsent) {
    // Already initialised (e.g. re-executed after soft nav) — just re-render.
    window.dexConsent._render(document);
    return;
  }

  const STORAGE_KEY = 'dex_consent_v1';
  const VERSION = 1;
  const OPTIONAL_CATEGORIES = ['media'];
  const DEFAULTS = { version: VERSION, media: false, updatedAt: null };
  const listeners = new Set();

  function read() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || parsed.version !== VERSION) {
        return { ...DEFAULTS };
      }
      return { ...DEFAULTS, ...parsed, version: VERSION };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function write(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage may be unavailable (private mode) — preferences just won't persist */
    }
  }

  function get() {
    return read();
  }

  function allows(category) {
    if (!OPTIONAL_CATEGORIES.includes(category)) return true; // essential/analytics
    return read()[category] === true;
  }

  function set(category, value) {
    if (!OPTIONAL_CATEGORIES.includes(category)) return get();
    const state = read();
    state[category] = value === true;
    state.updatedAt = new Date().toISOString();
    state.version = VERSION;
    write(state);
    listeners.forEach((cb) => {
      try {
        cb(state);
      } catch {
        /* a bad listener shouldn't break the others */
      }
    });
    return state;
  }

  function onChange(cb) {
    if (typeof cb === 'function') listeners.add(cb);
    return () => listeners.delete(cb);
  }

  // ---- Preferences panel rendering -------------------------------------------

  const ROWS = [
    {
      key: 'essential',
      title: 'Essential',
      desc: 'Login sessions, saved favorites, checkout/security, and remembering these choices. Required — always on.',
      always: true,
    },
    {
      key: 'analytics',
      title: 'Analytics',
      desc: 'Cloudflare Web Analytics — cookieless, no cross-site identifiers. Needs no consent; always on.',
      always: true,
    },
    {
      key: 'media',
      title: 'Media embeds',
      desc: 'Load third-party media (e.g. YouTube on some pages) automatically. Off by default.',
      always: false,
    },
  ];

  function buildRow(row, state) {
    const el = document.createElement('div');
    el.className = 'dx-consent-row';
    el.dataset.category = row.key;

    const text = document.createElement('div');
    text.className = 'dx-consent-row-text';
    const title = document.createElement('span');
    title.className = 'dx-consent-row-title';
    title.textContent = row.title;
    const desc = document.createElement('span');
    desc.className = 'dx-consent-row-desc';
    desc.textContent = row.desc;
    text.append(title, desc);

    const control = document.createElement('div');
    control.className = 'dx-consent-row-control';
    if (row.always) {
      const badge = document.createElement('span');
      badge.className = 'dx-consent-badge';
      badge.textContent = 'Always on';
      control.appendChild(badge);
    } else {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'dx-consent-switch';
      sw.setAttribute('role', 'switch');
      const on = state[row.key] === true;
      sw.setAttribute('aria-checked', on ? 'true' : 'false');
      sw.setAttribute('aria-label', `${row.title}: ${on ? 'on' : 'off'}`);
      sw.addEventListener('click', () => {
        const next = sw.getAttribute('aria-checked') !== 'true';
        set(row.key, next);
        sw.setAttribute('aria-checked', next ? 'true' : 'false');
        sw.setAttribute('aria-label', `${row.title}: ${next ? 'on' : 'off'}`);
        flashSaved(el.closest('.dx-consent'));
      });
      control.appendChild(sw);
    }

    el.append(text, control);
    return el;
  }

  function flashSaved(panel) {
    if (!panel) return;
    const note = panel.querySelector('.dx-consent-saved');
    if (!note) return;
    note.textContent = 'Preferences saved.';
    note.classList.add('is-visible');
    window.clearTimeout(note._t);
    note._t = window.setTimeout(() => note.classList.remove('is-visible'), 2400);
  }

  function renderPanel(mount) {
    if (!(mount instanceof HTMLElement)) return;
    if (mount.dataset.dxConsentReady === '1') return;
    mount.dataset.dxConsentReady = '1';

    const state = read();
    const panel = document.createElement('div');
    panel.className = 'dx-consent';
    ROWS.forEach((row) => panel.appendChild(buildRow(row, state)));
    const saved = document.createElement('p');
    saved.className = 'dx-consent-saved';
    saved.setAttribute('aria-live', 'polite');
    panel.appendChild(saved);

    mount.textContent = '';
    mount.appendChild(panel);
  }

  function render(root = document) {
    root.querySelectorAll('[data-dx-consent-panel]').forEach((mount) => renderPanel(mount));
  }

  window.dexConsent = {
    get,
    set,
    allows,
    onChange,
    CATEGORIES: OPTIONAL_CATEGORIES.slice(),
    _render: render,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => render(document), { once: true });
  } else {
    render(document);
  }
  window.addEventListener('dx:slotready', () => render(document));
})();
