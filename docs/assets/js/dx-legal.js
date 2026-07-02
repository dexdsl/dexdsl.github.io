/* dx-legal.js — table-of-contents behaviour for the privacy + copyright pages.
 *
 * Idempotent, modelled on dx-pagenav.js: it binds on load and re-binds on every
 * `dx:slotready` event, guarding per-element via a data attribute rather than a
 * global "loaded" flag. That means it survives soft-router commits without any
 * change to header-slot.js / ROUTE_SCRIPT_GUARDS.
 *
 * Responsibilities:
 *   - highlight the active TOC link as the reader scrolls (IntersectionObserver
 *     rooted at the slot scroll root, re-resolved when the slot enables),
 *   - smooth-scroll to a section on TOC click, scrolling the slot root (not the
 *     window) and honouring prefers-reduced-motion.
 */
(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const PAGE_SELECTOR = '[data-dx-legal]';
  const READY_ATTR = 'data-dx-legal-ready';

  const prefersReducedMotion = () =>
    !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Resolve the scroll container the same way dx-scroll-dot.js does, so we track
  // the slot scroll root once the header slot is enabled and fall back to the
  // document/viewport before that.
  function getScrollSource() {
    if (typeof window.dxGetSlotScrollRoot === 'function') {
      const slotRoot = window.dxGetSlotScrollRoot();
      if (slotRoot instanceof Element && slotRoot.isConnected) return slotRoot;
    }
    const fallback = document.getElementById('dx-slot-scroll-root');
    if (fallback instanceof Element && fallback.isConnected) return fallback;
    return null; // null root => viewport
  }

  function scrollToSection(source, section) {
    if (!(section instanceof Element)) return;
    const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
    // The scroll containers apply scroll-padding-top / .dx-legal-section applies
    // scroll-margin-top, so scrollIntoView lands below the fixed header cleanly.
    section.scrollIntoView({ behavior, block: 'start', inline: 'nearest' });
  }

  function bind(page) {
    if (!(page instanceof Element)) return;
    if (page.getAttribute(READY_ATTR) === '1') return;

    const toc = page.querySelector('[data-dx-legal-toc]');
    const article = page.querySelector('[data-dx-legal-article]');
    if (!toc || !article) return;

    const sections = Array.from(article.querySelectorAll('.dx-legal-section[id]'));
    if (!sections.length) return;

    const links = new Map(); // id -> anchor
    toc.querySelectorAll('a[href^="#"]').forEach((a) => {
      const id = decodeURIComponent(a.getAttribute('href').slice(1));
      if (id) links.set(id, a);
    });
    if (!links.size) return;

    page.setAttribute(READY_ATTR, '1');

    let activeId = null;
    const setActive = (id) => {
      if (id === activeId) return;
      if (activeId && links.has(activeId)) links.get(activeId).classList.remove('is-active');
      activeId = id;
      const link = links.get(id);
      if (link) {
        link.classList.add('is-active');
        if (link.setAttribute) link.setAttribute('aria-current', 'true');
      }
      links.forEach((a, key) => {
        if (key !== id) a.removeAttribute('aria-current');
      });
    };

    // Smooth-scroll on click (let the hash update for deep-linking, but drive the
    // scroll ourselves against the correct container).
    toc.addEventListener('click', (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link || !toc.contains(link)) return;
      const id = decodeURIComponent(link.getAttribute('href').slice(1));
      const section = document.getElementById(id);
      if (!section) return;
      event.preventDefault();
      scrollToSection(getScrollSource(), section);
      setActive(id);
      if (window.history && typeof window.history.replaceState === 'function') {
        window.history.replaceState(null, '', `#${id}`);
      }
    });

    let observer = null;
    const buildObserver = () => {
      if (observer) observer.disconnect();
      const root = getScrollSource();
      // Activate a section once its heading region crosses the upper third.
      observer = new IntersectionObserver(
        (entries) => {
          // Pick the entry nearest the top that is intersecting.
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          if (visible.length) {
            setActive(visible[0].target.id);
          }
        },
        {
          root: root || null,
          rootMargin: '-30% 0px -60% 0px',
          threshold: 0,
        }
      );
      sections.forEach((s) => observer.observe(s));
    };

    buildObserver();
    setActive(sections[0].id);

    // The slot scroll root changes identity when the slot enables (hard load) or
    // recommits (soft nav), so rebuild the observer against the fresh root.
    window.addEventListener('dx:slotready', () => {
      if (!page.isConnected) return;
      buildObserver();
    });
  }

  function enhanceAll(root = document) {
    root.querySelectorAll(PAGE_SELECTOR).forEach((page) => bind(page));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => enhanceAll(document), { once: true });
  } else {
    enhanceAll(document);
  }
  window.addEventListener('dx:slotready', () => enhanceAll(document));
})();
