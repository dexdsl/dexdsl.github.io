(() => {
  if (typeof window === 'undefined' || window.__dxUavEntryLoaded) return;
  window.__dxUavEntryLoaded = true;

  const body = document.body;
  if (!(body instanceof HTMLElement) || !body.classList.contains('dx-uav-page')) return;

  let layoutFrame = 0;
  let readyTimer = 0;
  let disposed = false;

  const readRecord = () => {
    const script = document.getElementById('dex-uav-record');
    if (!(script instanceof HTMLScriptElement)) return null;
    try {
      return JSON.parse(script.textContent || '{}');
    } catch {
      return null;
    }
  };

  const extensionFromName = (value) => {
    const match = String(value || '').trim().match(/\.([a-z0-9]{1,12})$/i);
    return match ? match[1].toLowerCase() : '';
  };

  const buildDownloadConfig = (record) => {
    const collection = record?.collection || {};
    const manifest = record?.manifest || {};
    const seriesById = new Map((collection.series || []).map((series) => [series.id, series]));
    const buckets = [];

    for (const group of manifest.groups || []) {
      const series = seriesById.get(group.seriesId) || {};
      for (const bucket of group.buckets || []) {
        const mediaType = group.captureClass === 'A' ? 'audio' : 'video';
        const files = (bucket.files || [])
          .filter((file) => !file.missing && file.role !== 'recording_index_pdf')
          .map((file) => ({
            fileId: `asset:${file.driveFileId}`,
            label: file.lookupRaw || file.originalName,
            filename: file.originalName,
            extension: extensionFromName(file.originalName),
            variantKey: String(file.outputSpectrum || series.spectrum || file.role || 'source').toLowerCase(),
            variantLabel: file.outputSpectrum || series.spectrum || file.role || 'Source',
          }));
        const existing = buckets.find((row) => row.bucket === bucket.bucket);
        const type = { mediaType, files };
        if (existing) existing.types.push(type);
        else buckets.push({ bucket: bucket.bucket, types: [type] });
      }
    }

    return {
      downloads: {
        delivery: 'worker_bundle',
        formats: {
          audio: [{ key: 'source', label: 'Source audio' }],
          video: [{ key: 'source', label: 'Source files' }],
        },
        fileTree: {
          lookup: collection.lookupRaw,
          buckets,
        },
        audioFileIds: {},
        videoFileIds: {},
      },
      bucketFileStats: {},
      fileSpecs: {},
      metadata: {},
    };
  };

  const bindBreadcrumbBack = () => {
    const back = document.querySelector('[data-dex-breadcrumb-back]');
    if (!(back instanceof HTMLAnchorElement) || back.dataset.dxUavBackBound === 'true') return;
    back.dataset.dxUavBackBound = 'true';
    back.addEventListener('click', (event) => {
      try {
        if (!document.referrer || window.history.length < 2) return;
        const referrer = new URL(document.referrer, window.location.origin);
        if (referrer.origin !== window.location.origin) return;
        if (`${referrer.pathname}${referrer.search}` === `${window.location.pathname}${window.location.search}`) return;
        event.preventDefault();
        window.history.back();
      } catch {}
    });
  };

  const bindEntryComponents = async () => {
    if (body.dataset.dxUavComponentsBound === 'true') return true;
    if (body.dataset.dxUavComponentsBinding === 'true') return false;
    const shared = window.__dxEntryComponents;
    const record = readRecord();
    const collection = record?.collection;
    if (!shared || !collection) return false;
    body.dataset.dxUavComponentsBinding = 'true';

    try {
      shared.ensureEntryRuntimeLayoutOverrides?.();
      shared.ensureEntryButtonPrimitiveOverrides?.();
      shared.ensureDownloadTreeStyles?.();
      shared.ensureInteractiveHoverRuntime?.(window.location.origin);
      shared.bindOverviewLookupFit?.();
      shared.bindEntryTooltips?.(document.querySelector('.dex-collections'));

      let favorites = shared.getFavoritesApi?.();
      if (!favorites && typeof shared.ensureFavoritesApi === 'function') {
        favorites = await shared.ensureFavoritesApi(window.location.origin);
      }
      const entryHref = window.location.pathname;
      const entryButton = document.querySelector('.dx-fav-entry-toggle');
      if (entryButton instanceof HTMLElement && favorites) {
        shared.bindFavoriteToggle?.(
          entryButton,
          favorites,
          shared.buildEntryFavoriteRecord?.(collection.lookupRaw, entryHref),
          { active: 'Favorited collection', inactive: 'Favorite collection' },
        );
      }
      document.querySelectorAll('.dx-fav-bucket-toggle').forEach((button) => {
        if (!(button instanceof HTMLElement) || !favorites) return;
        const bucket = String(button.dataset.bucket || '').trim().toUpperCase();
        if (!bucket) return;
        shared.bindFavoriteToggle?.(
          button,
          favorites,
          shared.buildBucketFavoriteRecord?.(collection.lookupRaw, entryHref, bucket),
          { active: `Favorited ${bucket}`, inactive: `Favorite ${bucket}` },
        );
      });
      shared.refreshFavoriteButtons?.(favorites, document);

      shared.attachUnifiedDownload?.(
        buildDownloadConfig(record),
        '#downloads .btn-download',
        { lookup: collection.lookupRaw, entryHref, favoritesApi: favorites },
      );

      const recordingButton = document.querySelector('[data-dx-uav-recording-index="1"]');
      const recordingFile = (record?.manifest?.groups || [])
        .flatMap((group) => group.buckets || [])
        .flatMap((bucket) => bucket.files || [])
        .find((file) => !file.missing && file.role === 'recording_index_pdf');
      if (recordingButton instanceof HTMLButtonElement) {
        if (!recordingFile) {
          recordingButton.disabled = true;
          recordingButton.setAttribute('aria-disabled', 'true');
          recordingButton.title = 'Recording index PDF unavailable';
        } else if (recordingButton.dataset.dxUavDownloadBound !== 'true') {
          recordingButton.dataset.dxUavDownloadBound = 'true';
          recordingButton.addEventListener('click', async () => {
            const row = recordingButton.closest('#downloads') || recordingButton.parentElement;
            shared.setDownloadState?.(row, 'resolving', 'Resolving secure download…');
            recordingButton.disabled = true;
            try {
              const result = await shared.requestBundleDownload?.({
                lookup: collection.lookupRaw,
                tokens: [`asset:${recordingFile.driveFileId}`],
                onQueuedTick: () => shared.setDownloadState?.(row, 'queued', 'Preparing bundle…'),
              });
              shared.setDownloadState?.(row, 'ready', 'Ready. Opening download…');
              shared.openSignedUrl?.(result?.signedUrl);
            } catch (error) {
              const code = String(error?.code || '').toLowerCase();
              shared.setDownloadState?.(
                row,
                code === 'forbidden' ? 'forbidden' : code === 'not-found' ? 'not-found' : 'error',
                code === 'forbidden'
                  ? 'Access denied (403).'
                  : code === 'not-found'
                  ? 'Download not found (404).'
                  : 'Download failed (DX-DL-500).',
              );
            } finally {
              recordingButton.disabled = false;
            }
          });
        }
      }
      body.dataset.dxUavComponentsBound = 'true';
      return true;
    } finally {
      delete body.dataset.dxUavComponentsBinding;
    }
  };

  const updateSidebarCue = () => {
    const sidebar = document.querySelector('.dx-uav-sidebar');
    if (!(sidebar instanceof HTMLElement)) return;
    const scrollable = sidebar.scrollHeight > sidebar.clientHeight + 4;
    const atEnd = !scrollable || sidebar.scrollTop + sidebar.clientHeight >= sidebar.scrollHeight - 4;
    sidebar.dataset.dxScrollable = scrollable ? 'true' : 'false';
    sidebar.dataset.dxScrollAtEnd = atEnd ? 'true' : 'false';
  };

  const measure = () => {
    if (disposed) return;
    layoutFrame = 0;
    const root = document.documentElement;
    const header = document.querySelector('.header-announcement-bar-wrapper, #header, #siteHeader');
    const footer = document.querySelector('.dex-footer:not(.dx-profile-footer-portaled)')
      || document.querySelector('.dex-footer');
    const mobile = window.matchMedia('(max-width: 899px)').matches;

    if (mobile) {
      root.style.removeProperty('--dx-uav-shell-top');
      root.style.removeProperty('--dx-uav-shell-bottom');
      body.dataset.dxUavReady = 'true';
      updateSidebarCue();
      return;
    }

    const headerRect = header instanceof HTMLElement ? header.getBoundingClientRect() : null;
    const footerRect = footer instanceof HTMLElement ? footer.getBoundingClientRect() : null;
    if (!footerRect || footerRect.height <= 0) return;

    const top = Math.max(12, Math.ceil(headerRect?.bottom || 102) + 12);
    const footerTop = Math.floor(footerRect.top);
    const bottom = Math.max(12, Math.ceil(window.innerHeight - footerTop + 24));
    root.style.setProperty('--dx-uav-shell-top', `${top}px`);
    root.style.setProperty('--dx-uav-shell-bottom', `${bottom}px`);
    body.dataset.dxUavReady = 'true';
    updateSidebarCue();
  };

  const schedule = () => {
    if (disposed) return;
    if (layoutFrame) cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(measure);
  };

  const bindSidebar = () => {
    const sidebar = document.querySelector('.dx-uav-sidebar');
    if (!(sidebar instanceof HTMLElement) || sidebar.dataset.dxUavScrollBound === 'true') return;
    sidebar.dataset.dxUavScrollBound = 'true';
    sidebar.addEventListener('scroll', updateSidebarCue, { passive: true });
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(() => {
        schedule();
        updateSidebarCue();
      });
      observer.observe(sidebar);
      Array.from(sidebar.children).forEach((child) => observer.observe(child));
    }
  };

  const observer = new MutationObserver(() => {
    if (disposed) return;
    bindSidebar();
    schedule();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  const onEntryComponentsReady = () => {
    if (!disposed) void bindEntryComponents();
  };

  const teardown = () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    window.removeEventListener('resize', schedule);
    window.removeEventListener('dx:entry-components-ready', onEntryComponentsReady);
    window.removeEventListener('dx:route-transition-out:end', onRouteOutEnd);
    if (layoutFrame) cancelAnimationFrame(layoutFrame);
    if (readyTimer) clearTimeout(readyTimer);
    document.documentElement.style.removeProperty('--dx-uav-shell-top');
    document.documentElement.style.removeProperty('--dx-uav-shell-bottom');
    delete body.dataset.dxUavReady;
    delete body.dataset.dxUavComponentsBound;
    delete body.dataset.dxUavComponentsBinding;
    window.__dxUavEntryLoaded = false;
  };

  const onRouteOutEnd = (event) => {
    const from = String(event?.detail?.from || '');
    const to = String(event?.detail?.to || '');
    if (from.startsWith('/uav/') && !to.startsWith('/uav/')) teardown();
  };

  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('load', schedule, { once: true });
  window.addEventListener('dx:route-transition-out:end', onRouteOutEnd);
  document.fonts?.ready?.then(schedule).catch(() => {});

  bindSidebar();
  bindBreadcrumbBack();
  void bindEntryComponents();
  window.addEventListener('dx:entry-components-ready', onEntryComponentsReady);
  window.dexBreadcrumbMotionMount?.();
  schedule();
  readyTimer = window.setTimeout(() => {
    body.dataset.dxUavReady = 'true';
    schedule();
  }, 1800);

  window.addEventListener('pagehide', teardown, { once: true });
})();
