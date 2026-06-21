(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__dxScrollLineLoaded) return;
  window.__dxScrollLineLoaded = true;

  if (document.documentElement.hasAttribute('data-no-dex-scroll')) return;

  let line = null;
  let fill = null;
  let source = null;
  let raf = 0;

  function getScrollSource() {
    if (typeof window.dxGetSlotScrollRoot === 'function') {
      const slotRoot = window.dxGetSlotScrollRoot();
      if (slotRoot instanceof Element && slotRoot.isConnected) {
        return slotRoot;
      }
    }
    const fallbackSlotRoot = document.getElementById('dx-slot-scroll-root');
    if (fallbackSlotRoot instanceof Element && fallbackSlotRoot.isConnected) {
      return fallbackSlotRoot;
    }
    return window;
  }

  function getMetrics() {
    if (source === window) {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || window.pageYOffset || doc.scrollTop || 0;
      const maxScroll = Math.max(0, doc.scrollHeight - window.innerHeight);
      return { scrollTop, maxScroll };
    }
    return {
      scrollTop: source.scrollTop,
      maxScroll: Math.max(0, source.scrollHeight - source.clientHeight),
    };
  }

  // Single cheap write per frame: a vertical scaleY transform on the fill,
  // GPU-composited, no layout. The line only shows when the page can scroll.
  function update() {
    raf = 0;
    if (!line || !fill) return;
    const { scrollTop, maxScroll } = getMetrics();
    if (maxScroll <= 2) {
      line.classList.remove('is-active');
      fill.style.transform = 'scaleY(0)';
      return;
    }
    const progress = Math.min(1, Math.max(0, scrollTop / maxScroll));
    fill.style.transform = `scaleY(${progress})`;
    line.classList.add('is-active');
  }

  function scheduleUpdate() {
    if (raf) return;
    raf = requestAnimationFrame(update);
  }

  function bindScrollSource() {
    const nextSource = getScrollSource();
    if (nextSource === source) {
      update();
      return;
    }
    if (source) {
      source.removeEventListener('scroll', scheduleUpdate);
    }
    source = nextSource;
    source.addEventListener('scroll', scheduleUpdate, { passive: true });
    update();
  }

  function boot() {
    if (!document.body) return;
    document.documentElement.classList.add('dx-hide-native-scrollbar');
    document.body.classList.add('dx-hide-native-scrollbar');

    document.querySelectorAll('.dex-scroll-dot, .dex-scroll-rail, .dex-scroll-progress')
      .forEach((node) => node.remove());

    line = document.createElement('div');
    line.className = 'dex-scroll-progress';
    line.id = 'dex-scroll-progress-windowY';
    line.setAttribute('aria-hidden', 'true');

    fill = document.createElement('div');
    fill.className = 'dex-scroll-progress-fill';
    line.appendChild(fill);

    document.body.appendChild(line);

    bindScrollSource();

    window.addEventListener('resize', scheduleUpdate, { passive: true });
    window.addEventListener('dx:slotready', bindScrollSource);
    window.addEventListener('pageshow', bindScrollSource);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
