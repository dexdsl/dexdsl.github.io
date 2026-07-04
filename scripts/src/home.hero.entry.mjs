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

// Fresh random order per load so the wall feels alive and every member rotates
// through the visible set. Fisher–Yates.
function shuffle(list) {
  const items = list.slice();
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

// Normalised name key for matching a member to their catalog work.
function nameKey(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z\s-]/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeAttr(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function monogram(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '★';
}

// Season-bias order shared with the SSR renderer: newest accepted season first.
function seasonRank(season) {
  const index = ['S3', 'S2', 'S1'].indexOf(String(season || '').toUpperCase());
  return index === -1 ? 3 : index;
}

function profileToTile(profile, tagLabel) {
  return {
    kind: 'face',
    name: profile.display_name || profile.handle || '',
    role: profile.role || '',
    instrument: profile.instrument || '',
    href: profile.profile_url || '#',
    image: profile.picture || '',
    tag: 'DEX MEMBER',
    handle: profile.handle || '',
    hasPicture: Boolean(profile.picture),
  };
}

function catalogEntryToTile(entry, tagLabel) {
  const instrument = (Array.isArray(entry.instrument_labels) && entry.instrument_labels[0])
    || (Array.isArray(entry.instrument_family) && entry.instrument_family[0])
    || '';
  return {
    kind: 'work',
    name: entry.performer_raw || entry.title_raw || '',
    instrument,
    lookup: entry.lookup_raw || '',
    href: entry.entry_href || '#',
    image: entry.image_src || '',
    season: entry.season || '',
    tag: tagLabel,
  };
}

// Build one wall tile as a DOM node, with an initials fallback if a (often
// short-lived Google) avatar URL fails to load.
function tileElement(tile, index) {
  const metaParts = tile.kind === 'face' ? [tile.role, tile.instrument] : [tile.instrument];
  const meta = metaParts.filter(Boolean).join(' · ');
  const media = tile.image
    ? `<img class="dx-s3-tile__img" src="${escapeAttr(tile.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
    : `<span class="dx-s3-tile__mono" aria-hidden="true">${escapeAttr(tile.kind === 'open' ? '＋' : monogram(tile.name))}</span>`;
  const template = document.createElement('template');
  template.innerHTML = `<a class="dx-s3-tile dx-s3-tile--${tile.kind}${tile.isOwn ? ' is-own' : ''}" data-card-kind="${tile.kind}" role="listitem" href="${escapeAttr(tile.href || '#')}" style="--dx-s3-tile-i:${index}"${tile.kind === 'open' ? ' data-dx-s3-open' : ''}>
      <span class="dx-s3-tile__media">${media}<span class="dx-s3-tile__wash" aria-hidden="true"></span></span>
      <span class="dx-s3-tile__body">
        ${tile.tag ? `<span class="dx-s3-tile__tag">${escapeAttr(tile.tag)}</span>` : ''}
        <span class="dx-s3-tile__name">${escapeAttr(tile.name)}</span>
        ${meta ? `<span class="dx-s3-tile__role">${escapeAttr(meta)}</span>` : ''}
        ${tile.lookup ? `<span class="dx-s3-tile__lookup">${escapeAttr(tile.lookup)}</span>` : ''}
      </span>
    </a>`.trim();
  const element = template.content.firstElementChild;
  const image = element.querySelector('img');
  if (image) {
    image.addEventListener('error', () => {
      const mono = document.createElement('span');
      mono.className = 'dx-s3-tile__mono';
      mono.setAttribute('aria-hidden', 'true');
      mono.textContent = monogram(tile.name);
      image.replaceWith(mono);
    }, { once: true });
  }
  if (!reducedMotion()) element.classList.add('dx-s3-tile--enter');
  return element;
}

async function fetchPublicProfiles(feedUrl) {
  const response = await fetch(feedUrl, { credentials: 'omit', cache: 'no-store' });
  if (!response.ok) throw new Error(`profiles feed failed (${response.status})`);
  const payload = await response.json();
  return Array.isArray(payload?.profiles) ? payload.profiles : [];
}

async function fetchWorks(feedPath) {
  const response = await fetch(feedPath, { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error(`works feed failed (${response.status})`);
  const payload = await response.json();
  return Array.isArray(payload?.entries) ? payload.entries : (Array.isArray(payload) ? payload : []);
}

// Assemble the visible tile set: every member face (bias-sorted), a random
// dynamic slice of their + past work, one open slot. Faces always survive the
// cap so the wall stays face-first as the catalog dwarfs the member count.
function assembleWall(profiles, entries, options) {
  const { capacity, faceBias, fillWithStills, tagLabel, ownHandle } = options;

  let faces = profiles.map((profile) => profileToTile(profile, tagLabel));
  if (faceBias) faces = faces.slice().sort((a, b) => (b.hasPicture ? 1 : 0) - (a.hasPicture ? 1 : 0));

  const seen = new Set();
  const works = [];
  for (const entry of entries) {
    if (!entry.image_src || !(entry.performer_raw || entry.title_raw) || entry.status === 'hidden') continue;
    const tile = catalogEntryToTile(entry, tagLabel);
    const key = tile.name.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    works.push(tile);
  }

  // Attribute works to members by name so a member's own recordings ride along.
  const faceKeys = faces.map((face) => ({ face, key: nameKey(face.name) })).filter((item) => item.key.length >= 3);
  for (const work of works) {
    const workKey = nameKey(work.name);
    const match = faceKeys.find((item) => workKey.includes(item.key) || item.key.includes(workKey));
    if (match) { work.attributedTo = match.face.handle; match.face.hasWork = true; }
  }

  let chosenWorks = fillWithStills ? works : works.filter((work) => work.attributedTo);
  // Accepted Season 3 work always leads; everything else is a fresh random draw.
  const s3 = chosenWorks.filter((work) => String(work.season).toUpperCase() === 'S3');
  const rest = shuffle(chosenWorks.filter((work) => String(work.season).toUpperCase() !== 'S3'));
  chosenWorks = [...s3, ...rest];

  const room = Math.max(0, capacity - faces.length - 1);
  const pickedWorks = chosenWorks.slice(0, room);

  // Faces lead (shuffled among themselves) so members stay in the visible band;
  // work fills behind them. The open slot anchors the CTA.
  let combined = [...shuffle(faces), ...pickedWorks];
  const open = { kind: 'open', name: '@you', href: '#' };
  if (ownHandle) {
    const index = combined.findIndex((tile) => tile.kind === 'face' && tile.handle === ownHandle);
    if (index >= 0) {
      combined[index].isOwn = true;
      const [own] = combined.splice(index, 1);
      combined.unshift(own);
    }
    combined.push(open);
  } else {
    combined.unshift(open);
  }
  return combined.slice(0, capacity);
}

function renderWall(root, tiles) {
  const wall = root.querySelector('[data-dx-s3-wall]');
  if (!wall) return;
  const fragment = document.createDocumentFragment();
  tiles.forEach((tile, index) => fragment.appendChild(tileElement(tile, index)));
  wall.replaceChildren(fragment);
  wall.setAttribute('data-wall-loaded', 'true');
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

  // --- Headline: run through the site heading FX (duplication + letter joining).
  // The hero mounts after header-slot's first pass, so retry until the FX loads.
  const headline = module.querySelector('.dx-s3__headline');
  if (headline) {
    const decorate = () => decorateDynamicHeadings(headline, 'home:hero:season3');
    decorate();
    if (!window.__dxHeadingFx) {
      let tries = 0;
      const timer = window.setInterval(() => {
        if (window.__dxHeadingFx || tries > 20) { window.clearInterval(timer); decorate(); }
        tries += 1;
      }, 100);
    }
  }

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
  const submitHref = module.dataset.ctaSubmitHref || '/entry/submit/';
  const startSubmission = () => {
    const returnTo = `${window.location.origin}${submitHref}`;
    if (window.DEX_AUTH && typeof window.DEX_AUTH.signUp === 'function') window.DEX_AUTH.signUp(returnTo);
    else document.getElementById('auth-ui-signin')?.click();
  };
  const cta = module.querySelector('[data-dx-s3-cta]');
  if (cta) {
    cta.addEventListener('click', (event) => {
      if (cta.getAttribute('data-mode') !== 'guest') return; // real link otherwise
      event.preventDefault();
      startSubmission();
    });
  }
  // The "@you" open slot behaves like the CTA. Tiles hydrate later, so delegate.
  module.addEventListener('click', (event) => {
    const open = event.target.closest('[data-dx-s3-open]');
    if (!open) return;
    event.preventDefault();
    if (module.querySelector('[data-dx-s3-cta]')?.getAttribute('data-mode') === 'guest') startSubmission();
    else if (typeof window.dxNavigate === 'function') window.dxNavigate(submitHref);
    else window.location.href = submitHref;
  });

  // --- Wall data: member faces + their (and past contributors') work ---
  const facesUrl = resolveFeedUrl(module.getAttribute('data-faces-feed'));
  const worksPath = module.getAttribute('data-works-feed') || '/data/catalog.entries.json';
  const options = {
    capacity: Math.max(4, Number(module.getAttribute('data-capacity')) || 24),
    faceBias: module.getAttribute('data-face-bias') !== 'false',
    fillWithStills: module.getAttribute('data-fill-stills') !== 'false',
    tagLabel: module.getAttribute('data-tag-label') || 'dexFest',
  };
  let ownHandle = '';
  let profiles = [];
  let works = [];
  const paint = () => {
    if (!profiles.length && !works.length) return; // keep the SSR/seed wall on total failure
    renderWall(module, assembleWall(profiles, works, { ...options, ownHandle }));
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
    // Repaint so the member's own face is pinned + ringed once known.
    if (nextOwn && nextOwn !== ownHandle) {
      ownHandle = nextOwn;
      if (!module.querySelector('.dx-s3-tile.is-own')) paint();
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

  // Load faces + works in parallel; either source failing still paints the other.
  Promise.allSettled([fetchPublicProfiles(facesUrl), fetchWorks(worksPath)])
    .then(([faces, entries]) => {
      profiles = faces.status === 'fulfilled' ? faces.value : [];
      works = entries.status === 'fulfilled' ? entries.value : [];
      paint();
    });
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
