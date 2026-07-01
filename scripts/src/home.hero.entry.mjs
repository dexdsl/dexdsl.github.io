import { renderFeaturedCard, renderHomeHero } from '../lib/home-hero-render.mjs';

const SNAPSHOT_URL = '/data/home.hero.snapshot.json';
const FEATURED_URL = '/data/home.featured.snapshot.json';

async function fetchJson(url) {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} failed (${response.status})`);
  return response.json();
}

function reducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function decorateDynamicHeadings(root, routeKey) {
  if (!(root instanceof Element)) return;
  const headingFx = window.__dxHeadingFx;
  if (!headingFx) return;
  if (
    root.matches('h1, h2, [data-dx-heading-randomize="true"]')
    && typeof headingFx.decorateHeading === 'function'
  ) {
    headingFx.decorateHeading(root, { routeKey });
  }
  if (typeof headingFx.decorateHeadings === 'function') {
    headingFx.decorateHeadings(root);
  }
}

function initCampaign(root) {
  const target = root.querySelector('[data-dx-hero-rotating]');
  if (!target) return;
  let words = [];
  try {
    words = JSON.parse(target.getAttribute('data-words') || '[]');
  } catch {
    words = [];
  }
  if (!words.length) return;
  const chosen = words[Math.floor(Math.random() * words.length)] || words[0];
  if (reducedMotion()) {
    target.textContent = chosen;
    decorateDynamicHeadings(target.closest('h1, h2') || target, 'home:hero:campaign');
  } else {
    target.textContent = '';
    target.classList.add('typing-complete');
    try { target.focus(); } catch {}
    let index = 0;
    const tick = () => {
      target.textContent = chosen.slice(0, index);
      try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(target);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      } catch {}
      index += 1;
      if (index <= chosen.length + 1) {
        window.setTimeout(tick, 100);
      } else {
        target.classList.remove('typing-complete');
        decorateDynamicHeadings(target.closest('h1, h2') || target, 'home:hero:campaign');
      }
    };
    tick();
  }

  const authButton = root.querySelector('[data-dx-hero-auth-cta]');
  if (!authButton) return;
  const applyAuth = (authenticated) => {
    const mode = authenticated ? 'submit' : 'signup';
    if (authButton.getAttribute('data-dx-hero-cta-mode') === mode) return;
    authButton.setAttribute('data-dx-hero-cta-mode', mode);
    const label = authButton.querySelector('[data-dx-hero-cta-label]');
    if (label) {
      label.textContent = authenticated
        ? authButton.dataset.authLabel || 'Submit samples ↗'
        : authButton.dataset.guestLabel || 'Sign up free ↗';
    }
    authButton.setAttribute('aria-label', authenticated ? 'Submit samples' : 'Sign up free');
  };
  const onAuth = (event) => applyAuth(Boolean(event?.detail?.isAuthenticated));
  window.addEventListener('dex-auth:state', onAuth);
  window.addEventListener('dex-auth:ready', onAuth);
  authButton.addEventListener('click', () => {
    if (authButton.getAttribute('data-dx-hero-cta-mode') === 'submit') {
      const href = authButton.dataset.authHref || '/entry/submit/';
      if (typeof window.dxNavigate === 'function') window.dxNavigate(href);
      else window.location.href = href;
      return;
    }
    if (window.DEX_AUTH && typeof window.DEX_AUTH.signUp === 'function') window.DEX_AUTH.signUp();
    else document.getElementById('auth-ui-signin')?.click();
  });
  if (window.DEX_AUTH?.ready && typeof window.DEX_AUTH.ready.then === 'function') {
    window.DEX_AUTH.ready.then((state) => applyAuth(Boolean(state?.isAuthenticated))).catch(() => {});
  }
}

function initFeatured(root, payload) {
  const rows = (Array.isArray(payload?.featured) ? payload.featured : [])
    .filter((row) => Array.isArray(row.tags) && row.tags.length ? row.tags.includes('dexFest') : true)
    .filter((row) => row.url || row.entry_href)
    .slice(0, 4);
  const frame = root.querySelector('#carousel-frame');
  const dots = root.querySelector('#carousel-indicators');
  if (!frame || !dots || !rows.length) return;
  let index = 0;
  let busy = false;
  let currentCard = null;
  let pageNav = null;
  const cardHost = document.createElement('div');
  cardHost.className = 'carousel-card-host';

  function makeCard(row) {
    const template = document.createElement('template');
    template.innerHTML = renderFeaturedCard(row).trim();
    return template.content.firstElementChild;
  }

  function renderDots() {
    if (window.dxPageNav && typeof window.dxPageNav.create === 'function') {
      if (!pageNav) {
        pageNav = window.dxPageNav.create({
          mount: dots,
          count: rows.length,
          ariaLabel: 'Featured entries',
          onSelect: (next) => {
            if (next === index || busy) return;
            goTo(next);
          },
        });
      }
      pageNav.setCount(rows.length);
      pageNav.setActive(index);
      return;
    }
    dots.innerHTML = '';
    rows.forEach((_, dotIndex) => {
      const dot = document.createElement('div');
      dot.className = `dot${dotIndex === index ? ' active' : ''}`;
      dot.addEventListener('click', () => {
        if (dotIndex !== index && !busy) goTo(dotIndex);
      });
      dots.appendChild(dot);
    });
  }

  const previous = document.createElement('button');
  previous.className = 'carousel-nav prev';
  previous.setAttribute('aria-label', 'Previous');
  previous.addEventListener('click', () => {
    if (!busy) goTo((index + rows.length - 1) % rows.length);
  });
  const next = document.createElement('button');
  next.className = 'carousel-nav next';
  next.setAttribute('aria-label', 'Next');
  next.addEventListener('click', () => {
    if (!busy) goTo((index + 1) % rows.length);
  });
  frame.replaceChildren(previous, cardHost, next);
  if (window.dxPageNav && typeof window.dxPageNav.upgradeLegacyArrow === 'function') {
    window.dxPageNav.upgradeLegacyArrow(previous);
    window.dxPageNav.upgradeLegacyArrow(next);
  }

  function commit(card, nextIndex) {
    cardHost.replaceChildren(card);
    card.style.opacity = '';
    decorateDynamicHeadings(card, `home:featured:${nextIndex}`);
    currentCard = card;
    index = nextIndex;
    renderDots();
  }

  function goTo(nextIndex) {
    const card = makeCard(rows[nextIndex]);
    if (!currentCard || reducedMotion() || !currentCard.animate) {
      commit(card, nextIndex);
      return;
    }
    busy = true;
    const exit = currentCard.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: 160, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' },
    );
    Promise.resolve(exit.finished).catch(() => {}).then(() => {
      commit(card, nextIndex);
      card.style.opacity = '0';
      const enter = card.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: 220, easing: 'cubic-bezier(.22,.8,.24,1)', fill: 'forwards' },
      );
      return Promise.resolve(enter.finished).catch(() => {});
    }).finally(() => {
      card.style.opacity = '';
      busy = false;
    });
  }
  goTo(0);
}

// ---------------------------------------------------------------------------
// Season 3 "Human Credits" hero
// ---------------------------------------------------------------------------

const DEFAULT_API_BASE = 'https://dex-api.spring-fog-8edd.workers.dev';

function apiBase() {
  const configured = String(window.DEX_API_BASE_URL || window.DEX_API_ORIGIN || DEFAULT_API_BASE || '').trim();
  return configured.replace(/\/+$/, '');
}

function resolveFeedUrl(feed) {
  const value = String(feed || '').trim();
  if (/^https:\/\//i.test(value)) return value;
  return `${apiBase()}${value.startsWith('/') ? value : `/${value}`}`;
}

// Deterministic per-day shuffle so the visible set is stable within a day but
// rotates across days. FNV-1a hash keyed by handle + day index.
function dailyRank(handle, dayIndex) {
  let hash = 0x811c9dc5;
  const key = `${handle}#${dayIndex}`;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function escapeAttr(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function profileCardElement(profile, slot) {
  const meta = [profile.role, profile.instrument].filter(Boolean).join(' · ');
  const picture = profile.picture
    ? `<img class="dx-s3-card__avatar" src="${escapeAttr(profile.picture)}" alt="" loading="lazy" decoding="async">`
    : '';
  const template = document.createElement('template');
  template.innerHTML = `<a class="dx-s3-card dx-s3-card--profile" data-card-kind="profile" data-card-slot="${slot}" role="listitem" href="${escapeAttr(profile.profile_url)}" style="--dx-s3-card-i:${slot}">
      <span class="dx-s3-card__tag">OPEN TO EVERYONE</span>
      ${picture}
      <span class="dx-s3-card__name">${escapeAttr(profile.display_name || profile.handle)}</span>
      ${meta ? `<span class="dx-s3-card__role">${escapeAttr(meta)}</span>` : ''}
      <span class="dx-s3-card__lookup">@${escapeAttr(profile.handle)}</span>
    </a>`.trim();
  return template.content.firstElementChild;
}

async function fetchPublicProfiles(feedUrl) {
  const response = await fetch(feedUrl, { credentials: 'omit', cache: 'no-store' });
  if (!response.ok) throw new Error(`profiles feed failed (${response.status})`);
  const payload = await response.json();
  return Array.isArray(payload?.profiles) ? payload.profiles : [];
}

function placeProfiles(root, profiles, ownHandle) {
  const field = root.querySelector('[data-dx-s3-field]');
  if (!field || !profiles.length) return;
  const capacity = Math.max(1, Number(root.getAttribute('data-capacity')) || profiles.length);

  // Stable daily rotation once we exceed capacity; always pin the member's own
  // card so they see themselves regardless of rotation.
  const dayIndex = Math.floor(Date.now() / 86400000);
  const own = ownHandle ? profiles.filter((p) => p.handle === ownHandle) : [];
  const rest = profiles.filter((p) => !ownHandle || p.handle !== ownHandle);
  rest.sort((a, b) => dailyRank(a.handle, dayIndex) - dailyRank(b.handle, dayIndex));
  const ordered = [...own, ...rest].slice(0, capacity);

  // Replace openings first, then seed releases — never drop a real release card
  // until every @you opening has been filled.
  const openings = Array.from(field.querySelectorAll('[data-card-kind="opening"]'));
  const seeds = Array.from(field.querySelectorAll('[data-card-kind="release"]'));
  const replaceable = [...openings, ...seeds];

  ordered.forEach((profile, index) => {
    const target = replaceable[index];
    if (!target) return;
    const slot = target.getAttribute('data-card-slot') || String(index);
    const card = profileCardElement(profile, slot);
    if (own.length && profile.handle === ownHandle) card.classList.add('is-own');
    if (!reducedMotion()) card.classList.add('dx-s3-card--enter');
    target.replaceWith(card);
  });
  field.setAttribute('data-profiles-loaded', 'true');
}

async function ownPublicHandle(token) {
  if (!token) return '';
  try {
    const response = await fetch(`${apiBase()}/me/profile`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!response.ok) return '';
    const payload = await response.json();
    return String(payload?.public_profile?.handle || '').trim();
  } catch {
    return '';
  }
}

async function resolveSeason3Cta(root, token) {
  // Authenticated viewers: derive state from their submissions. Active work
  // takes precedence over published work; any failure keeps the submit CTA.
  if (!token) return { mode: 'submit' };
  try {
    const response = await fetch(`${apiBase()}/me/submissions`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!response.ok) return { mode: 'submit' };
    const payload = await response.json();
    const threads = Array.isArray(payload?.threads) ? payload.threads : [];
    if (!threads.length) return { mode: 'submit' };
    const active = threads.find((t) => t.currentStage && t.currentStage !== 'in_library');
    if (active) return { mode: 'active' };
    const published = threads.find((t) => t.currentStage === 'in_library');
    if (published) return { mode: 'published', href: published.libraryHref || published.library_href || '' };
    return { mode: 'submit' };
  } catch {
    return { mode: 'submit' };
  }
}

function applySeason3Cta(root, state, ownHandle) {
  const cta = root.querySelector('[data-dx-s3-cta]');
  if (!cta) return;
  const stageNote = root.querySelector('[data-dx-s3-cta-state]');
  const data = root.dataset;
  const set = (label, href, mode, note) => {
    cta.textContent = label;
    cta.setAttribute('data-mode', mode);
    if (href) cta.setAttribute('href', href);
    cta.setAttribute('aria-label', label);
    if (stageNote) {
      if (note) { stageNote.textContent = note; stageNote.hidden = false; }
      else { stageNote.hidden = true; }
    }
  };
  if (state.mode === 'guest') {
    set(data.ctaGuestLabel, data.ctaSubmitHref, 'guest');
  } else if (state.mode === 'active') {
    set(data.ctaActiveLabel, data.ctaActiveHref, 'active', 'Your pipeline is live — private to you.');
  } else if (state.mode === 'published') {
    const href = state.href || (ownHandle ? `/u/${ownHandle}/` : data.ctaPublishedHref);
    set(data.ctaPublishedLabel, href, 'published');
  } else {
    set(data.ctaSubmitLabel, data.ctaSubmitHref, 'submit');
  }
}

function initSeason3(root) {
  const module = root.querySelector('[data-module-type="season3-human-credits"]');
  if (!module) return;

  // --- Choreography (code-owned, class-toggled CSS keyframes) ---
  const motion = module.getAttribute('data-motion') || 'cinematic';
  const animate = motion !== 'quiet' && !reducedMotion();
  if (!animate) {
    module.classList.add('is-static');
  } else if ('IntersectionObserver' in window) {
    // Play once in view; pause offscreen motion to spare the main thread.
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        module.classList.toggle('is-playing', entry.isIntersecting);
        if (entry.isIntersecting) module.classList.add('has-played');
      }
    }, { threshold: 0.15 });
    observer.observe(module);
  } else {
    module.classList.add('is-playing', 'has-played');
  }

  // --- CTA wiring (guest default rendered server-side) ---
  const cta = module.querySelector('[data-dx-s3-cta]');
  if (cta) {
    cta.addEventListener('click', (event) => {
      if (cta.getAttribute('data-mode') !== 'guest') return; // real link otherwise
      event.preventDefault();
      const returnTo = `${window.location.origin}${module.dataset.ctaSubmitHref || '/entry/submit/'}`;
      if (window.DEX_AUTH && typeof window.DEX_AUTH.signUp === 'function') window.DEX_AUTH.signUp(returnTo);
      else document.getElementById('auth-ui-signin')?.click();
    });
  }

  // --- Public profile feed (always; independent of auth) ---
  const feedUrl = resolveFeedUrl(module.getAttribute('data-profile-feed'));
  let ownHandle = '';
  let loadedProfiles = null;
  const renderProfiles = () => {
    if (loadedProfiles) placeProfiles(module, loadedProfiles, ownHandle);
  };
  const applyAuthState = async (authenticated) => {
    if (!authenticated) {
      applySeason3Cta(module, { mode: 'guest' });
      return;
    }
    const token = window.DEX_AUTH && typeof window.DEX_AUTH.getAccessToken === 'function'
      ? await window.DEX_AUTH.getAccessToken().catch(() => '')
      : '';
    const nextOwn = await ownPublicHandle(token);
    const ctaState = await resolveSeason3Cta(module, token);
    applySeason3Cta(module, ctaState, nextOwn);
    // Re-place only when the member's own card is now known but not yet pinned.
    if (nextOwn && nextOwn !== ownHandle) {
      ownHandle = nextOwn;
      if (!module.querySelector('.dx-s3-card.is-own')) renderProfiles();
    }
  };

  // Render guest hero immediately, then react to auth resolution.
  applySeason3Cta(module, { mode: 'guest' });
  if (window.DEX_AUTH?.ready && typeof window.DEX_AUTH.ready.then === 'function') {
    window.DEX_AUTH.ready
      .then((state) => applyAuthState(Boolean(state?.isAuthenticated)))
      .catch(() => {});
  }
  window.addEventListener('dex-auth:state', (event) => applyAuthState(Boolean(event?.detail?.isAuthenticated)));

  // Load the public feed; API failure silently retains the seed/open-slot field.
  fetchPublicProfiles(feedUrl)
    .then((profiles) => { loadedProfiles = profiles; renderProfiles(); })
    .catch(() => {});
}

async function boot() {
  const mount = document.querySelector('[data-dx-home-hero-root]');
  if (!mount || mount.dataset.ready === 'true') return;
  mount.dataset.ready = 'true';
  try {
    const [snapshot, featured] = await Promise.all([
      fetchJson(SNAPSHOT_URL),
      fetchJson(FEATURED_URL).catch(() => ({ featured: [] })),
    ]);
    mount.innerHTML = renderHomeHero(snapshot);
    initCampaign(mount);
    initFeatured(mount, featured);
    initSeason3(mount);
    mount.dispatchEvent(new CustomEvent('dx-home-hero:ready', { bubbles: true, detail: { compositionId: snapshot.activeCompositionId } }));
  } catch (error) {
    mount.innerHTML = `<div class="dx-home-featured-loading">Hero unavailable.</div>`;
    console.error('[dex] home hero failed', error);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();

document.addEventListener('dex:page-ready', boot);
