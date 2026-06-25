// dx-pagenav — the one global paged-navigation primitive for the whole site.
//
// Provides an Apple-HIG (iOS UIPageControl) page-indicator: a windowed strip of
// dots where the active dot morphs to a capsule, edge dots shrink, and the strip
// scrolls to keep the active dot centred — so it scales from 3 to 50+ pages. Plus
// canonical L/R chevron buttons (.dx-pagenav-arrow) styled by dx-controls.css.
//
// Dependency-free (Web Animations API) so it can load on every page cheaply.
// Visuals live in css/components/dx-controls.css. Surfaces call
// `window.dxPageNav.create(...)` for pip strips; arrows are plain markup that this
// script auto-enhances (injects the chevron + adds press motion).

(() => {
  if (typeof window === 'undefined' || window.dxPageNav) return;

  const SPRING = 'cubic-bezier(0.22, 0.61, 0.36, 1)';
  const reduced = () =>
    Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const CHEVRON = { prev: 'M15.5 19 8.5 12l7-7', next: 'M8.5 5l7 7-7 7' };
  function chevronSvg(dir) {
    return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="${CHEVRON[dir] || CHEVRON.next}" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function pressMotion(node) {
    if (!node || reduced() || typeof node.animate !== 'function') return;
    node.animate(
      [{ transform: 'scale(0.84)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }],
      { duration: 320, easing: SPRING },
    );
  }

  function arrowDirection(node) {
    if (node.classList.contains('dx-pagenav-arrow--prev')) return 'prev';
    if (node.classList.contains('dx-pagenav-arrow--next')) return 'next';
    const data = (node.getAttribute('data-dx-pagenav-arrow') || '').toLowerCase();
    return data === 'prev' ? 'prev' : 'next';
  }

  // Normalise an arrow into the glyphless dex tab + wire press motion once.
  function enhanceArrow(node, opts = {}) {
    if (!(node instanceof HTMLElement) || node.dataset.dxPagenavReady === '1') return;
    node.dataset.dxPagenavReady = '1';
    const dir = arrowDirection(node);
    if (!node.classList.contains('dx-pagenav-arrow--prev') && !node.classList.contains('dx-pagenav-arrow--next')) {
      node.classList.add(`dx-pagenav-arrow--${dir}`);
    }
    // Glyphless to match the hero tab; clear any legacy icon when upgrading.
    if (opts.replaceGlyph) node.innerHTML = '';
    if (!node.getAttribute('aria-label')) node.setAttribute('aria-label', dir === 'prev' ? 'Previous' : 'Next');
    node.addEventListener('pointerdown', () => pressMotion(node));
  }

  // Legacy L/R nav buttons across the site (edge tabs, ::before glyphs, heroicons)
  // get upgraded to the one chevron-glass button. Keeps their original classes so
  // existing positioning + click handlers still apply.
  const LEGACY_ARROW_SELECTOR = [
    '.carousel-nav',
    'button.nav.nav-left',
    'button.nav.nav-right',
    '.dx-dexnotes-entry-pagination-prev',
    '.dx-dexnotes-entry-pagination-next',
  ].join(', ');
  function legacyDirection(node) {
    if (node.classList.contains('prev') || node.classList.contains('nav-left')
      || /prev|left|previous/i.test(node.getAttribute('aria-label') || '')
      || node.className.includes('pagination-prev')) return 'prev';
    if (node.classList.contains('next') || node.classList.contains('nav-right')
      || node.className.includes('pagination-next')) return 'next';
    return /prev|left|previous/i.test(node.getAttribute('aria-label') || '') ? 'prev' : 'next';
  }
  function upgradeLegacyArrow(node) {
    if (!(node instanceof HTMLElement) || node.dataset.dxPagenavReady === '1') return;
    const dir = legacyDirection(node);
    node.classList.add('dx-pagenav-arrow', `dx-pagenav-arrow--${dir}`);
    enhanceArrow(node, { replaceGlyph: true });
  }

  function makeArrow(dir, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `dx-pagenav-arrow dx-pagenav-arrow--${dir}`;
    enhanceArrow(btn);
    if (typeof onClick === 'function') btn.addEventListener('click', () => onClick());
    return btn;
  }

  function readToken(el, name, fallback) {
    const raw = parseFloat(getComputedStyle(el).getPropertyValue(name));
    return Number.isFinite(raw) ? raw : fallback;
  }

  // The windowed dot strip.
  function create(opts = {}) {
    const mount = opts.mount;
    if (!(mount instanceof HTMLElement)) throw new Error('dxPageNav.create requires { mount }');

    mount.textContent = '';
    mount.classList.add('dx-pagenav');
    if (opts.onDark) mount.classList.add('dx-pagenav--on-dark');
    mount.setAttribute('role', 'tablist');
    if (opts.ariaLabel) mount.setAttribute('aria-label', opts.ariaLabel);

    const viewport = document.createElement('div');
    viewport.className = 'dx-pagenav__viewport';
    const track = document.createElement('div');
    track.className = 'dx-pagenav__track';
    viewport.appendChild(track);
    mount.appendChild(viewport);

    let count = 0;
    let active = 0;
    let dots = [];
    let lastOffset = 0;

    function buildDots(n) {
      track.textContent = '';
      dots = [];
      for (let i = 0; i < n; i += 1) {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'dx-pagenav__dot';
        dot.setAttribute('role', 'tab');
        dot.setAttribute('aria-label', `Page ${i + 1} of ${n}`);
        const index = i;
        dot.addEventListener('click', () => {
          if (typeof opts.onSelect === 'function') opts.onSelect(index);
        });
        track.appendChild(dot);
        dots.push(dot);
      }
    }

    function layout(animateMove) {
      if (!count) return;
      const size = readToken(mount, '--dx-pagenav-size', 8);
      const gap = readToken(mount, '--dx-pagenav-gap', 7);
      const windowMax = Math.max(3, readToken(mount, '--dx-pagenav-window', 7));
      const activeExtra = readToken(mount, '--dx-pagenav-active-extra', size * 1.4);
      const unit = size + gap;
      const visible = Math.min(count, windowMax);

      // Viewport width holds the visible window + the active capsule's extra width.
      viewport.style.width = `${visible * unit - gap + activeExtra}px`;

      let first = active - Math.floor(visible / 2);
      first = Math.max(0, Math.min(first, count - visible));
      const leftMore = first > 0;
      const rightMore = first + visible < count;

      dots.forEach((dot, i) => {
        const isActive = i === active;
        dot.classList.toggle('is-active', isActive);
        dot.setAttribute('aria-selected', isActive ? 'true' : 'false');
        let edge = 0;
        if (leftMore && i === first) edge = 2;
        else if (leftMore && i === first + 1) edge = 1;
        else if (rightMore && i === first + visible - 1) edge = 2;
        else if (rightMore && i === first + visible - 2) edge = 1;
        dot.setAttribute('data-edge', String(edge));
      });

      // Offset so the window starts at `first`, plus half the active capsule's
      // extra width once the active dot is left of centre (keeps it visually centred).
      const offset = -(first * unit);
      const from = lastOffset;
      lastOffset = offset;
      track.style.transform = `translate3d(${offset}px, 0, 0)`;
      if (animateMove && !reduced() && typeof track.animate === 'function' && from !== offset) {
        track.animate(
          [{ transform: `translate3d(${from}px, 0, 0)` }, { transform: `translate3d(${offset}px, 0, 0)` }],
          { duration: 380, easing: SPRING },
        );
      }
    }

    const api = {
      setCount(n) {
        const next = Math.max(0, Math.floor(Number(n) || 0));
        if (next === count) return api;
        count = next;
        if (active > count - 1) active = Math.max(0, count - 1);
        mount.toggleAttribute('data-dx-pagenav-hidden', count <= 1);
        buildDots(count);
        lastOffset = 0;
        layout(false);
        return api;
      },
      setActive(i) {
        const next = Math.max(0, Math.min(Math.floor(Number(i) || 0), count - 1));
        active = next;
        layout(true);
        return api;
      },
      get active() { return active; },
      get count() { return count; },
      destroy() {
        mount.textContent = '';
        mount.classList.remove('dx-pagenav', 'dx-pagenav--on-dark');
        mount.removeAttribute('role');
        mount.removeAttribute('data-dx-pagenav-hidden');
      },
    };

    api.setCount(opts.count || 0);
    if (typeof opts.getActive === 'function') api.setActive(opts.getActive());
    else if (Number.isFinite(opts.active)) api.setActive(opts.active);
    return api;
  }

  // Wire a horizontal-scroll carousel (track scrolls; slides snap) to a pip strip
  // + arrows. Used by scroll-based carousels (not the catalog index-rotator).
  function bindScrollCarousel(opts = {}) {
    const { track, prev, next, pagenav } = opts;
    if (!(track instanceof HTMLElement)) return null;
    const slides = () => Array.from(track.children).filter((n) => n.nodeType === 1);
    const pageNav = pagenav && pagenav.setActive ? pagenav : (opts.mount ? create({ mount: opts.mount, count: slides().length, onSelect: scrollTo, onDark: opts.onDark }) : null);

    function scrollTo(i) {
      const el = slides()[i];
      if (el) el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
    }
    function activeIndex() {
      const list = slides();
      const center = track.scrollLeft + track.clientWidth / 2;
      let best = 0; let bestDist = Infinity;
      list.forEach((el, i) => {
        const elCenter = el.offsetLeft + el.offsetWidth / 2;
        const d = Math.abs(elCenter - center);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      return best;
    }
    let raf = 0;
    track.addEventListener('scroll', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; if (pageNav) pageNav.setActive(activeIndex()); });
    }, { passive: true });
    if (prev) prev.addEventListener('click', () => { pressMotion(prev); scrollTo(Math.max(0, activeIndex() - 1)); });
    if (next) next.addEventListener('click', () => { pressMotion(next); scrollTo(Math.min(slides().length - 1, activeIndex() + 1)); });
    if (pageNav) { pageNav.setCount(slides().length); pageNav.setActive(activeIndex()); }
    return pageNav;
  }

  function enhanceAll(root = document) {
    root.querySelectorAll('.dx-pagenav-arrow').forEach((node) => enhanceArrow(node));
    root.querySelectorAll(LEGACY_ARROW_SELECTOR).forEach(upgradeLegacyArrow);
  }

  window.dxPageNav = { create, bindScrollCarousel, makeArrow, enhanceArrow, upgradeLegacyArrow, enhanceAll, pressMotion, chevronSvg };

  function init() { enhanceAll(document); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  // Re-enhance after slot soft-navigation injects new content.
  window.addEventListener('dx:slotready', () => enhanceAll(document));
})();
