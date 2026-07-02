/* dx-video-embed.js — click-to-load gate for YouTube embeds on entry pages.
 *
 * Privacy-minimal: entry pages ship a first-party poster facade
 * (.dex-video-facade) instead of a live iframe, so nothing hits YouTube until
 * the visitor asks. On click (or Enter/Space) we swap in the youtube-nocookie
 * iframe and autoplay. If the visitor opted into media embeds on /cookies
 * (window.dexConsent.allows('media')), we load automatically on page load.
 *
 * Idempotent; runs on load and on dx:slotready (soft-nav), per the dx-legal.js /
 * dx-pagenav.js pattern.
 */
(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const FACADE_SELECTOR = '.dex-video-facade[data-dx-video-embed]';

  function buildEmbedSrc(embedUrl) {
    // Add a playback query without clobbering any existing one. autoplay=1 is
    // honoured because the load happens from a user gesture (or explicit consent).
    const sep = embedUrl.includes('?') ? '&' : '?';
    return `${embedUrl}${sep}autoplay=1&rel=0&modestbranding=1&playsinline=1`;
  }

  function makeIframe(embedUrl) {
    const iframe = document.createElement('iframe');
    iframe.src = buildEmbedSrc(embedUrl);
    iframe.title = 'Video';
    iframe.loading = 'eager'; // the user asked for it — load now
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.setAttribute(
      'allow',
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
    );
    iframe.setAttribute('allowfullscreen', '');
    return iframe;
  }

  function loadVideo(facade, { focus = false } = {}) {
    if (!(facade instanceof HTMLElement)) return;
    if (facade.dataset.dxVideoLoaded === '1') return;
    const embedUrl = facade.getAttribute('data-dx-video-embed');
    if (!embedUrl) return;
    facade.dataset.dxVideoLoaded = '1';
    const iframe = makeIframe(embedUrl);
    const parent = facade.parentNode;
    if (!parent) return;
    parent.replaceChild(iframe, facade);
    if (focus && typeof iframe.focus === 'function') {
      // Move focus into the player for keyboard users who activated it.
      try {
        iframe.focus({ preventScroll: true });
      } catch {
        /* older browsers */
      }
    }
  }

  function bind(facade) {
    if (!(facade instanceof HTMLElement)) return;
    if (facade.dataset.dxVideoReady === '1') return;
    facade.dataset.dxVideoReady = '1';

    // Auto-load when the visitor has opted into media embeds.
    const consentAllows =
      window.dexConsent && typeof window.dexConsent.allows === 'function'
        ? window.dexConsent.allows('media')
        : false;
    if (consentAllows) {
      loadVideo(facade);
      return;
    }

    // It's a real <button>, so click + Enter/Space come for free.
    facade.addEventListener('click', () => loadVideo(facade, { focus: true }));
  }

  function enhanceAll(root = document) {
    root.querySelectorAll(FACADE_SELECTOR).forEach((facade) => bind(facade));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => enhanceAll(document), { once: true });
  } else {
    enhanceAll(document);
  }
  window.addEventListener('dx:slotready', () => enhanceAll(document));
})();
