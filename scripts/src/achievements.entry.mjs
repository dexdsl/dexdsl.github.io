(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__dxAchievementsRuntimeLoaded && typeof window.__dxAchievementsMount === 'function') {
    try {
      window.__dxAchievementsMount();
    } catch {}
    return;
  }
  window.__dxAchievementsRuntimeLoaded = true;

  const FETCH_STATE_LOADING = 'loading';
  const FETCH_STATE_READY = 'ready';
  const FETCH_STATE_ERROR = 'error';
  const STATE_LOADING = 'loading';
  const STATE_READY = 'ready';
  const STATE_ERROR = 'error';
  const STATE_EMPTY = 'empty';
  const STATE_SIGNED_OUT = 'signed-out';
  const PAGE_OVERVIEW = 'overview';
  const PAGE_SECRET = 'secret-vault';
  const PAGE_HISTORY = 'history';
  const DX_MIN_SHEEN_MS = 120;
  const AUTH_READY_TIMEOUT_MS = 2600;
  const TOKEN_TIMEOUT_MS = 2600;
  const API_TIMEOUT_MS = 9000;
  const HISTORY_PAGE_SIZE = 40;
  const BADGES_PER_PAGE = 8;
  const FOCUS_BADGE_PARAM = 'badge';

  const DEFAULT_API_BASE = 'https://dex-api.spring-fog-8edd.workers.dev';

  const HEROICON_BASE_PATH = '/assets/vendor/heroicons/24/outline/';
  const HEROICON_FILES = {
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
    secret: 'lock-closed.svg',
    'secret-license': 'shield-check.svg',
    'secret-release': 'archive-box-arrow-down.svg',
    vault: 'key.svg',
  };

  function toText(value, fallback = '') {
    const text = String(value ?? '').trim();
    return text || fallback;
  }

  function clamp(min, max, value) {
    return Math.min(max, Math.max(min, value));
  }

  function nowMs() {
    return Date.now();
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
  }

  function withTimeout(promiseLike, timeoutMs, fallback = null) {
    let timer = null;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve(fallback), Math.max(1, timeoutMs));
    });
    return Promise.race([
      Promise.resolve(typeof promiseLike === 'function' ? promiseLike() : promiseLike).catch(() => fallback),
      timeout,
    ]).finally(() => {
      if (timer !== null) {
        clearTimeout(timer);
      }
    });
  }

  function createRequestId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    const seed = Math.floor(Math.random() * 1e9).toString(16);
    return `dx-achv-${seed}-${Date.now()}`;
  }

  function getApiBase() {
    const raw = toText(window.DEX_API_BASE_URL || window.DEX_API_ORIGIN || DEFAULT_API_BASE, DEFAULT_API_BASE);
    return raw.replace(/\/+$/, '');
  }

  function setFetchState(root, state) {
    if (!(root instanceof HTMLElement)) return;
    root.setAttribute('data-dx-fetch-state', state);
    if (state === FETCH_STATE_LOADING) {
      root.setAttribute('aria-busy', 'true');
    } else {
      root.setAttribute('aria-busy', 'false');
    }
  }

  function setAppState(root, app, state, page) {
    if (root instanceof HTMLElement) {
      root.setAttribute('data-dx-achievements-state', state);
      root.setAttribute('data-dx-achievements-page', page);
    }
    if (app instanceof HTMLElement) {
      app.setAttribute('data-dx-achievements-state', state);
      app.setAttribute('data-dx-achievements-page', page);
    }
  }

  function getAuthApi() {
    return window.DEX_AUTH || window.dexAuth || null;
  }

  async function resolveAuthSnapshot() {
    const auth = getAuthApi();
    if (!auth) {
      return {
        auth: null,
        authenticated: false,
        token: '',
        user: null,
      };
    }

    try {
      if (typeof auth.resolve === 'function') {
        await withTimeout(() => auth.resolve(AUTH_READY_TIMEOUT_MS), AUTH_READY_TIMEOUT_MS, null);
      } else if (auth.ready && typeof auth.ready.then === 'function') {
        await withTimeout(auth.ready, AUTH_READY_TIMEOUT_MS, null);
      }
    } catch {}

    let authenticated = false;
    try {
      if (typeof auth.isAuthenticated === 'function') {
        authenticated = Boolean(await withTimeout(() => auth.isAuthenticated(), AUTH_READY_TIMEOUT_MS, false));
      }
    } catch {
      authenticated = false;
    }

    let token = '';
    if (authenticated && typeof auth.getAccessToken === 'function') {
      token = toText(await withTimeout(() => auth.getAccessToken(), TOKEN_TIMEOUT_MS, ''), '');
    }

    let user = null;
    try {
      if (typeof auth.getUser === 'function') {
        user = await withTimeout(() => auth.getUser(), AUTH_READY_TIMEOUT_MS, null);
      }
    } catch {
      user = null;
    }

    return {
      auth,
      authenticated,
      token,
      user,
    };
  }

  async function fetchJson(path, {
    method = 'GET',
    token = '',
    body = null,
    timeoutMs = API_TIMEOUT_MS,
    headers = {},
  } = {}) {
    const url = `${getApiBase()}${path}`;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutId = setTimeout(() => {
      if (controller) controller.abort();
    }, Math.max(1000, timeoutMs));

    try {
      const response = await fetch(url, {
        method,
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body ? { 'content-type': 'application/json' } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller ? controller.signal : undefined,
      });
      const payload = await response.json().catch(() => null);
      return { ok: response.ok, status: response.status, payload };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        payload: {
          ok: false,
          code: 'NETWORK_ERROR',
          detail: error instanceof Error ? error.message : String(error),
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function htmlEscape(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function badgeGlyphSvg(glyphKey, { silhouette = false } = {}) {
    const key = toText(glyphKey, 'secret').toLowerCase();
    const fileName = HEROICON_FILES[key] || HEROICON_FILES.secret;
    const src = `${HEROICON_BASE_PATH}${fileName}`;
    const className = silhouette ? 'dx-achievement-glyph-svg is-silhouette' : 'dx-achievement-glyph-svg';
    return `<img src="${htmlEscape(src)}" class="${className}" alt="" loading="lazy" decoding="async" aria-hidden="true">`;
  }

  function progressStroke(value, threshold) {
    const pct = threshold > 0 ? clamp(0, 100, Math.round((value / threshold) * 100)) : 0;
    const radius = 18;
    const c = 2 * Math.PI * radius;
    const dash = Math.round((pct / 100) * c * 1000) / 1000;
    return { pct, c, dash };
  }

  function normalizeBadge(raw, state) {
    const item = raw && typeof raw === 'object' ? raw : {};
    const id = toText(item.id).toLowerCase();
    const secret = Boolean(item.secret);
    const threshold = Math.max(1, Number(item.threshold) || 1);
    const progress = Math.max(0, Number(item.progress ?? item.metricValue ?? 0) || 0);
    const unlocked = Boolean(item.unlocked) || progress >= threshold;
    const newly = state.newlyUnlockedSet.has(id) || Boolean(item.newlyUnlocked);
    let cardState = 'locked';
    if (unlocked && newly) cardState = 'new';
    else if (unlocked) cardState = 'unlocked';
    else if (progress > 0) cardState = 'progress';

    return {
      id,
      title: toText(item.title, 'Untitled Achievement'),
      description: toText(item.description, ''),
      category: toText(item.category, 'general'),
      tier: toText(item.tier, 'bronze'),
      glyph: toText(item.glyph, 'secret'),
      points: Math.max(0, Number(item.points) || 0),
      threshold,
      progress,
      unlocked,
      newly,
      cardState,
      secret,
      clueGrowlix: toText(item.clueGrowlix, '???'),
      claimable: Boolean(item.claimable) || id === 'vault-easter-egg',
    };
  }

  function renderBadgeCard(badge) {
    const ring = progressStroke(badge.progress, badge.threshold);
    const title = badge.secret && !badge.unlocked ? 'CLASSIFIED' : badge.title;
    const description = badge.secret && !badge.unlocked
      ? `Clue: ${badge.clueGrowlix || '???'}`
      : badge.description;

    const claimButton = badge.secret && !badge.unlocked && badge.claimable
      ? `<button type="button" class="dx-button-element dx-button-element--secondary dx-button-size--sm dx-achievement-claim" data-dx-achievement-claim="${htmlEscape(badge.id)}" data-dx-motion-include="true">Claim</button>`
      : '';

    return `
      <article
        class="badge-card dx-achievement-card dx-achievement-card--${htmlEscape(badge.cardState)}"
        data-dx-achievement-id="${htmlEscape(badge.id)}"
        data-dx-achievement-state="${htmlEscape(badge.cardState)}"
        data-dx-achievement-secret="${badge.secret ? 'true' : 'false'}"
        data-dx-motion-include="true"
      >
        <div class="dx-achievement-card-top">
          <span class="dx-achievement-tier">${htmlEscape(badge.tier.toUpperCase())}</span>
          ${badge.newly ? '<span class="dx-achievement-new">NEW</span>' : ''}
        </div>
        <div class="dx-achievement-glyph-wrap" style="--dx-achievement-progress: ${ring.pct}%;">
          ${badgeGlyphSvg(badge.glyph, { silhouette: badge.secret && !badge.unlocked })}
        </div>
        <h3 class="dx-achievement-title">${htmlEscape(title)}</h3>
        <p class="dx-achievement-desc">${htmlEscape(description)}</p>
        <div class="dx-achievement-meta">
          <span>${badge.unlocked ? 'Unlocked' : `Progress ${Math.min(badge.progress, badge.threshold)}/${badge.threshold}`}</span>
          <span>${badge.points} pts</span>
        </div>
        ${claimButton}
      </article>
    `;
  }

  function getPaginatedBadgeRows(state, page, cards) {
    const totalPages = Math.max(1, Math.ceil(cards.length / BADGES_PER_PAGE));
    const current = clamp(0, totalPages - 1, Number(state.badgePages[page]) || 0);
    state.badgePages[page] = current;
    const start = current * BADGES_PER_PAGE;
    return {
      totalPages,
      current,
      visible: cards.slice(start, start + BADGES_PER_PAGE),
    };
  }

  function renderBadgeSideControls(page, totalPages, current) {
    if (totalPages <= 1) return '';
    const prevDisabled = current <= 0 ? ' disabled aria-disabled="true"' : '';
    const nextDisabled = current >= totalPages - 1 ? ' disabled aria-disabled="true"' : '';
    return `
      <button type="button" class="carousel-nav prev" data-dx-achievements-badge-page-prev="${htmlEscape(page)}" aria-label="Previous achievements page"${prevDisabled}></button>
      <button type="button" class="carousel-nav next" data-dx-achievements-badge-page-next="${htmlEscape(page)}" aria-label="Next achievements page"${nextDisabled}></button>
    `;
  }

  function renderBadgeGridPage(state, page, cards) {
    const rows = getPaginatedBadgeRows(state, page, cards);
    return `
      <div class="dx-achievements-carousel-frame" data-dx-achievements-pager="${htmlEscape(page)}" data-dx-achievements-pager-index="${rows.current}" data-dx-achievements-pager-total="${rows.totalPages}">
        ${renderBadgeSideControls(page, rows.totalPages, rows.current)}
        <div class="dx-achievements-grid" data-dx-achievements-grid-page="${htmlEscape(page)}">${rows.visible.map(renderBadgeCard).join('')}</div>
      </div>
    `;
  }

  function renderHistoryEvent(event) {
    const item = event && typeof event === 'object' ? event : {};
    const title = toText(item.title || item.badgeTitle || item.badgeId || 'Achievement event');
    const at = toText(item.createdAt || item.eventAt || '');
    const when = at ? new Date(at).toLocaleString() : 'Unknown time';
    const detail = toText(item.detail || item.body || item.eventType || '');
    return `
      <article class="dx-achievement-history-item" data-dx-motion-include="true">
        <div class="dx-achievement-history-head">
          <h4>${htmlEscape(title)}</h4>
          <span>${htmlEscape(when)}</span>
        </div>
        <p>${htmlEscape(detail)}</p>
      </article>
    `;
  }

  function showToast(state, message, { error = false } = {}) {
    const stack = state.root.querySelector('[data-dx-achievements-toasts]');
    if (!(stack instanceof HTMLElement)) return;
    const toast = document.createElement('p');
    toast.className = `dx-achievements-toast${error ? ' dx-achievements-toast--error' : ''}`;
    toast.textContent = message;
    stack.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3400);
  }

  function dispatchEvent(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    } catch {}
  }

  function readFocusBadgeFromUrl() {
    try {
      const url = new URL(window.location.href);
      return toText(url.searchParams.get(FOCUS_BADGE_PARAM), '').toLowerCase();
    } catch {
      return '';
    }
  }

  function focusBadgeCard(state, badgeId) {
    if (!badgeId) return;
    const selector = `[data-dx-achievement-id="${CSS.escape(badgeId)}"]`;
    const card = state.root.querySelector(selector);
    if (!(card instanceof HTMLElement)) return;
    try {
      card.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch {
      card.scrollIntoView();
    }
    card.classList.add('dx-achievement-card--focus');
    setTimeout(() => card.classList.remove('dx-achievement-card--focus'), 1800);
  }

  function renderSignedOut(state) {
    const body = state.root.querySelector('[data-dx-achievements-body]');
    if (!(body instanceof HTMLElement)) return;
    body.innerHTML = `
      <article class="dx-achievements-empty" data-dx-motion-include="true">
        <h3>SIGN IN REQUIRED</h3>
        <p>Please sign in to view achievements and unlock history.</p>
        <button type="button" class="dx-button-element dx-button-element--secondary dx-button-size--sm" data-dx-achievements-signin="true" data-dx-motion-include="true">Sign in</button>
      </article>
    `;
    const signInButton = body.querySelector('[data-dx-achievements-signin="true"]');
    if (signInButton instanceof HTMLButtonElement) {
      signInButton.addEventListener('click', async () => {
        const auth = state.authSnapshot.auth;
        if (auth && typeof auth.signIn === 'function') {
          try {
            await auth.signIn({ returnTo: `${window.location.pathname}${window.location.search}${window.location.hash}` });
            return;
          } catch {}
        }
        window.location.assign('/');
      });
    }
  }

  function updateHeaderSummary(state) {
    const totalsEl = state.root.querySelector('[data-dx-achievements-totals]');
    const metricsEl = state.root.querySelector('[data-dx-achievements-metrics]');
    const warningEl = state.root.querySelector('[data-dx-achievements-warning]');

    const summary = state.summary;
    if (!(totalsEl instanceof HTMLElement) || !(metricsEl instanceof HTMLElement) || !(warningEl instanceof HTMLElement)) return;
    if (!summary) {
      totalsEl.textContent = 'No summary available.';
      metricsEl.textContent = '';
      warningEl.hidden = true;
      warningEl.textContent = '';
      return;
    }

    const totals = summary.totals && typeof summary.totals === 'object' ? summary.totals : {};
    const unlocked = Math.max(0, Number(totals.unlocked) || 0);
    const total = Math.max(0, Number(totals.total || summary.badges.length) || summary.badges.length);
    const points = Math.max(0, Number(totals.points) || 0);
    totalsEl.textContent = `${unlocked} / ${total} unlocked · ${points} points`;

    const metrics = summary.metrics && typeof summary.metrics === 'object' ? summary.metrics : {};
    const submissions = Math.max(0, Number(metrics.submissionsTotal) || 0);
    const releases = Math.max(0, Number(metrics.releasesTotal) || 0);
    const votes = Math.max(0, Number(metrics.pollVotes) || 0);
    const favorites = Math.max(0, Number(metrics.favoritesCount) || 0);
    metricsEl.textContent = `Submissions ${submissions} · Releases ${releases} · Votes ${votes} · Favorites ${favorites}`;

    const warnings = Array.isArray(summary.warnings) ? summary.warnings.filter(Boolean) : [];
    if (warnings.length) {
      warningEl.hidden = false;
      warningEl.textContent = warnings.join(' · ');
    } else {
      warningEl.hidden = true;
      warningEl.textContent = '';
    }
  }

  function renderOverview(state) {
    const overview = state.root.querySelector('[data-dx-achievements-page-panel="overview"]');
    if (!(overview instanceof HTMLElement)) return;
    const cards = state.badges.filter((badge) => !badge.secret);
    if (!cards.length) {
      overview.innerHTML = '<p class="dx-achievements-empty-text">No public achievements found.</p>';
      return;
    }
    overview.innerHTML = renderBadgeGridPage(state, PAGE_OVERVIEW, cards);
  }

  function renderSecretVault(state) {
    const vault = state.root.querySelector('[data-dx-achievements-page-panel="secret-vault"]');
    if (!(vault instanceof HTMLElement)) return;
    const cards = state.badges.filter((badge) => badge.secret);
    if (!cards.length) {
      vault.innerHTML = '<p class="dx-achievements-empty-text">Secret vault is empty.</p>';
      return;
    }
    vault.innerHTML = renderBadgeGridPage(state, PAGE_SECRET, cards);
  }

  function renderHistory(state) {
    const historyRoot = state.root.querySelector('[data-dx-achievements-page-panel="history"]');
    if (!(historyRoot instanceof HTMLElement)) return;
    if (!state.historyLoaded && state.historyLoading) {
      historyRoot.innerHTML = '<p class="dx-achievements-empty-text">Loading history…</p>';
      return;
    }
    const items = Array.isArray(state.historyEvents) ? state.historyEvents : [];
    const rows = items.length
      ? items.map(renderHistoryEvent).join('')
      : '<p class="dx-achievements-empty-text">No unlock history yet.</p>';
    historyRoot.innerHTML = `
      <div class="dx-achievements-history">${rows}</div>
      <div class="dx-achievements-history-actions">
        ${state.historyNextCursor ? '<button type="button" class="dx-button-element dx-button-element--secondary dx-button-size--sm" data-dx-achievements-load-more="true" data-dx-motion-include="true">Load more</button>' : ''}
      </div>
    `;
  }

  function switchPage(state, page) {
    const next = page === PAGE_SECRET || page === PAGE_HISTORY ? page : PAGE_OVERVIEW;
    state.page = next;

    const app = state.root.querySelector('[data-dx-achievements-app="v2"]');
    setAppState(state.root, app, state.visualState, state.page);

    const buttons = state.root.querySelectorAll('[data-dx-achievements-page]');
    buttons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const isActive = toText(button.getAttribute('data-dx-achievements-page')) === state.page;
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      button.classList.toggle('is-active', isActive);
    });

    const panels = state.root.querySelectorAll('[data-dx-achievements-page-panel]');
    panels.forEach((panel) => {
      if (!(panel instanceof HTMLElement)) return;
      const active = toText(panel.getAttribute('data-dx-achievements-page-panel')) === state.page;
      panel.hidden = !active;
    });

    if (state.page === PAGE_HISTORY && !state.historyLoaded && !state.historyLoading && state.authSnapshot.authenticated) {
      void loadHistory(state, { append: false });
    }
  }

  async function loadSummary(state) {
    const token = toText(state.authSnapshot.token, '');
    const requestId = createRequestId();
    const response = await fetchJson('/me/achievements/summary', {
      method: 'GET',
      token,
      headers: {
        'x-dx-request-id': requestId,
      },
    });

    if (!response.ok || !response.payload || response.payload.ok !== true) {
      return {
        ok: false,
        status: response.status,
        payload: response.payload,
      };
    }

    return {
      ok: true,
      payload: response.payload,
    };
  }

  async function loadHistory(state, { append = false } = {}) {
    if (!state.authSnapshot.authenticated) return;
    if (state.historyLoading) return;

    state.historyLoading = true;
    renderHistory(state);

    const token = toText(state.authSnapshot.token, '');
    const cursorQuery = state.historyNextCursor ? `&cursor=${encodeURIComponent(state.historyNextCursor)}` : '';
    const response = await fetchJson(`/me/achievements/history?limit=${HISTORY_PAGE_SIZE}${cursorQuery}`, {
      method: 'GET',
      token,
      headers: {
        'x-dx-request-id': createRequestId(),
      },
    });

    if (response.ok && response.payload && response.payload.ok === true) {
      const events = Array.isArray(response.payload.events) ? response.payload.events : [];
      state.historyEvents = append ? state.historyEvents.concat(events) : events;
      state.historyNextCursor = toText(response.payload.nextCursor, '');
      state.historyLoaded = true;
    } else if (!append && !state.historyLoaded) {
      state.historyEvents = [];
      state.historyNextCursor = '';
      state.historyLoaded = true;
    }

    state.historyLoading = false;
    renderHistory(state);
  }

  async function markSeen(state, badgeIds = []) {
    if (!state.authSnapshot.authenticated) return;
    const token = toText(state.authSnapshot.token, '');
    const payload = {
      badgeIds: Array.isArray(badgeIds) ? badgeIds : [],
    };

    const response = await fetchJson('/me/achievements/seen', {
      method: 'POST',
      token,
      body: payload,
      headers: {
        'x-dx-request-id': createRequestId(),
      },
    });

    if (!response.ok || !response.payload || response.payload.ok !== true) {
      showToast(state, 'Unable to clear new badge markers.', { error: true });
      return;
    }

    showToast(state, 'New badge markers cleared.');
    const summaryResult = await loadSummary(state);
    if (summaryResult.ok) {
      applySummary(state, summaryResult.payload);
    }
  }

  async function claimSecret(state, badgeId) {
    if (!state.authSnapshot.authenticated) return;
    const token = toText(state.authSnapshot.token, '');
    const idempotencyKey = createRequestId();

    const response = await fetchJson('/me/achievements/secret-claim', {
      method: 'POST',
      token,
      body: {
        claim: badgeId,
        badgeId,
        clientRequestId: idempotencyKey,
      },
      headers: {
        'x-dx-request-id': createRequestId(),
        'x-dx-idempotency-key': idempotencyKey,
      },
    });

    if (!response.ok || !response.payload || response.payload.ok !== true) {
      showToast(state, 'Secret claim failed.', { error: true });
      return;
    }

    const claimState = toText(response.payload.state, '');
    if (claimState === 'already_unlocked') {
      showToast(state, 'Secret already unlocked.');
    } else if (claimState === 'unlocked') {
      showToast(state, 'Secret unlocked.');
    } else if (claimState === 'not_eligible') {
      showToast(state, 'Not eligible yet.', { error: true });
    } else {
      showToast(state, 'Invalid claim.', { error: true });
    }

    const summaryResult = await loadSummary(state);
    if (summaryResult.ok) {
      applySummary(state, summaryResult.payload);
    }
  }

  function applySummary(state, payload) {
    const summary = payload && typeof payload === 'object' ? payload : {};
    const badgesRaw = Array.isArray(summary.badges) ? summary.badges : [];
    const newly = Array.isArray(summary.newlyUnlocked)
      ? summary.newlyUnlocked.map((item) => toText(item && typeof item === 'object' ? item.id : item, '').toLowerCase()).filter(Boolean)
      : [];

    state.summary = {
      ...summary,
      badges: badgesRaw,
    };
    state.newlyUnlockedSet = new Set(newly);
    state.badges = badgesRaw.map((row) => normalizeBadge(row, state));

    updateHeaderSummary(state);
    renderOverview(state);
    renderSecretVault(state);

    dispatchEvent('dx:achievements:updated', summary);
    for (const badge of state.badges) {
      if (!badge.newly || state.emittedUnlocked.has(badge.id)) continue;
      state.emittedUnlocked.add(badge.id);
      dispatchEvent('dx:achievements:unlocked', {
        badgeId: badge.id,
        title: badge.title,
        tier: badge.tier,
        secret: badge.secret,
      });
    }

    const badgeIdFromQuery = readFocusBadgeFromUrl();
    if (badgeIdFromQuery) {
      const target = state.badges.find((badge) => badge.id === badgeIdFromQuery);
      if (target) {
        if (target.secret) {
          const secretCards = state.badges.filter((badge) => badge.secret);
          const secretIndex = secretCards.findIndex((badge) => badge.id === badgeIdFromQuery);
          state.badgePages[PAGE_SECRET] = Math.max(0, Math.floor(secretIndex / BADGES_PER_PAGE));
          renderSecretVault(state);
          switchPage(state, PAGE_SECRET);
        } else {
          const publicCards = state.badges.filter((badge) => !badge.secret);
          const publicIndex = publicCards.findIndex((badge) => badge.id === badgeIdFromQuery);
          state.badgePages[PAGE_OVERVIEW] = Math.max(0, Math.floor(publicIndex / BADGES_PER_PAGE));
          renderOverview(state);
          switchPage(state, PAGE_OVERVIEW);
        }
        focusBadgeCard(state, badgeIdFromQuery);
      }
    }

    state.visualState = state.badges.length ? STATE_READY : STATE_EMPTY;
    const app = state.root.querySelector('[data-dx-achievements-app="v2"]');
    setAppState(state.root, app, state.visualState, state.page);
    setFetchState(state.root, FETCH_STATE_READY);

    const markSeenButton = state.root.querySelector('[data-dx-achievements-mark-seen]');
    if (markSeenButton instanceof HTMLButtonElement) {
      markSeenButton.hidden = state.newlyUnlockedSet.size === 0;
    }
  }

  function bindEvents(state) {
    const navButtons = state.root.querySelectorAll('[data-dx-achievements-page]');
    navButtons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      button.addEventListener('click', () => {
        switchPage(state, button.getAttribute('data-dx-achievements-page'));
      });
    });

    const refresh = state.root.querySelector('[data-dx-achievements-refresh]');
    if (refresh instanceof HTMLButtonElement) {
      refresh.addEventListener('click', async () => {
        refresh.disabled = true;
        const summaryResult = await loadSummary(state);
        if (summaryResult.ok) {
          applySummary(state, summaryResult.payload);
          showToast(state, 'Achievements refreshed.');
        } else {
          showToast(state, 'Unable to refresh achievements.', { error: true });
        }
        refresh.disabled = false;
      });
    }

    const markSeenButton = state.root.querySelector('[data-dx-achievements-mark-seen]');
    if (markSeenButton instanceof HTMLButtonElement) {
      markSeenButton.addEventListener('click', async () => {
        if (markSeenButton.disabled) return;
        markSeenButton.disabled = true;
        await markSeen(state, Array.from(state.newlyUnlockedSet));
        markSeenButton.disabled = false;
      });
    }

    state.root.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const claimButton = target.closest('[data-dx-achievement-claim]');
      if (claimButton instanceof HTMLButtonElement) {
        const badgeId = toText(claimButton.getAttribute('data-dx-achievement-claim'), '').toLowerCase();
        if (!badgeId) return;
        claimButton.disabled = true;
        void claimSecret(state, badgeId).finally(() => {
          claimButton.disabled = false;
        });
        return;
      }
      const loadMore = target.closest('[data-dx-achievements-load-more="true"]');
      if (loadMore instanceof HTMLButtonElement) {
        if (!state.historyNextCursor) return;
        loadMore.disabled = true;
        void loadHistory(state, { append: true }).finally(() => {
          loadMore.disabled = false;
        });
        return;
      }
      const pagerButton = target.closest('[data-dx-achievements-badge-page-index]');
      if (pagerButton instanceof HTMLButtonElement) {
        const page = toText(pagerButton.getAttribute('data-dx-achievements-badge-page'), PAGE_OVERVIEW);
        const index = Number(pagerButton.getAttribute('data-dx-achievements-badge-page-index')) || 0;
        state.badgePages[page] = index;
        if (page === PAGE_SECRET) renderSecretVault(state);
        else renderOverview(state);
        return;
      }
      const prevButton = target.closest('[data-dx-achievements-badge-page-prev]');
      if (prevButton instanceof HTMLButtonElement) {
        const page = toText(prevButton.getAttribute('data-dx-achievements-badge-page-prev'), PAGE_OVERVIEW);
        state.badgePages[page] = Math.max(0, (Number(state.badgePages[page]) || 0) - 1);
        if (page === PAGE_SECRET) renderSecretVault(state);
        else renderOverview(state);
        return;
      }
      const nextButton = target.closest('[data-dx-achievements-badge-page-next]');
      if (nextButton instanceof HTMLButtonElement) {
        const page = toText(nextButton.getAttribute('data-dx-achievements-badge-page-next'), PAGE_OVERVIEW);
        state.badgePages[page] = (Number(state.badgePages[page]) || 0) + 1;
        if (page === PAGE_SECRET) renderSecretVault(state);
        else renderOverview(state);
      }
    });
  }

  function renderShell(root) {
    root.innerHTML = `
      <div class="dx-fetch-shell-overlay" aria-hidden="true">
        <div class="dx-fetch-shell dx-fetch-shell--card">
          <span class="dx-fetch-shell-pill"></span>
          <span class="dx-fetch-shell-line"></span>
          <span class="dx-fetch-shell-line"></span>
          <span class="dx-fetch-shell-line" style="width: 68%;"></span>
        </div>
      </div>
      <div class="dex-sidebar dx-achievements-shell" data-dx-achievements-app="v2" data-dx-achievements-state="loading" data-dx-achievements-page="overview">
        <div class="dx-achievements-panel" data-dx-achievements-body>
          <header class="dx-achievements-header">
            <div>
              <p class="dx-achievements-kicker">PROFILE</p>
              <h1>YOUR ACHIEVEMENTS</h1>
              <p class="dx-achievements-sub" data-dx-achievements-totals>Loading achievement summary…</p>
              <p class="dx-achievements-sub" data-dx-achievements-metrics></p>
            </div>
            <div class="dx-achievements-actions">
              <button type="button" class="dx-button-element dx-button-element--secondary dx-button-size--sm" data-dx-achievements-refresh data-dx-motion-include="true">Refresh</button>
              <button type="button" class="dx-button-element dx-button-element--secondary dx-button-size--sm" data-dx-achievements-mark-seen data-dx-motion-include="true" hidden>Mark seen</button>
            </div>
          </header>
          <p class="dx-achievements-warning" data-dx-achievements-warning hidden></p>
          <nav class="dx-achievements-nav" aria-label="Achievements pages">
            <button type="button" class="dx-button-element dx-button-element--secondary dx-button-size--sm is-active" aria-pressed="true" data-dx-achievements-page="overview" data-dx-motion-include="true">Overview</button>
            <button type="button" class="dx-button-element dx-button-element--secondary dx-button-size--sm" aria-pressed="false" data-dx-achievements-page="secret-vault" data-dx-motion-include="true">Secret Vault</button>
            <button type="button" class="dx-button-element dx-button-element--secondary dx-button-size--sm" aria-pressed="false" data-dx-achievements-page="history" data-dx-motion-include="true">History</button>
          </nav>
          <div class="dx-achievements-page" data-dx-achievements-page-panel="overview"></div>
          <div class="dx-achievements-page" data-dx-achievements-page-panel="secret-vault" hidden></div>
          <div class="dx-achievements-page" data-dx-achievements-page-panel="history" hidden></div>
        </div>
        <div class="dx-achievements-toast-stack" data-dx-achievements-toasts></div>
      </div>
    `;
  }

  async function mountRoot(root) {
    if (!(root instanceof HTMLElement)) return;
    if (root.getAttribute('data-dx-achievements-mounted') === 'true') return;
    root.setAttribute('data-dx-achievements-mounted', 'true');

    setFetchState(root, FETCH_STATE_LOADING);
    renderShell(root);

    const state = {
      root,
      page: PAGE_OVERVIEW,
      visualState: STATE_LOADING,
      summary: null,
      badges: [],
      historyEvents: [],
      historyNextCursor: '',
      historyLoaded: false,
      historyLoading: false,
      badgePages: {
        [PAGE_OVERVIEW]: 0,
        [PAGE_SECRET]: 0,
      },
      newlyUnlockedSet: new Set(),
      emittedUnlocked: new Set(),
      authSnapshot: {
        auth: null,
        authenticated: false,
        token: '',
        user: null,
      },
    };

    bindEvents(state);
    setAppState(root, root.querySelector('[data-dx-achievements-app="v2"]'), STATE_LOADING, PAGE_OVERVIEW);

    const bootStart = nowMs();

    state.authSnapshot = await resolveAuthSnapshot();

    if (!state.authSnapshot.authenticated || !toText(state.authSnapshot.token, '')) {
      state.visualState = STATE_SIGNED_OUT;
      setAppState(root, root.querySelector('[data-dx-achievements-app="v2"]'), STATE_SIGNED_OUT, PAGE_OVERVIEW);
      renderSignedOut(state);
      const remaining = DX_MIN_SHEEN_MS - (nowMs() - bootStart);
      if (remaining > 0) {
        await wait(remaining);
      }
      setFetchState(root, FETCH_STATE_READY);
      return;
    }

    const summaryResult = await loadSummary(state);
    if (!summaryResult.ok) {
      state.visualState = STATE_ERROR;
      setAppState(root, root.querySelector('[data-dx-achievements-app="v2"]'), STATE_ERROR, PAGE_OVERVIEW);
      const body = root.querySelector('[data-dx-achievements-body]');
      if (body instanceof HTMLElement) {
        body.innerHTML = `
          <article class="dx-achievements-empty" data-dx-motion-include="true">
            <h3>Unable to load achievements</h3>
            <p>Try again in a moment. If this persists, open Messages for system updates.</p>
          </article>
        `;
      }
      const remaining = DX_MIN_SHEEN_MS - (nowMs() - bootStart);
      if (remaining > 0) {
        await wait(remaining);
      }
      setFetchState(root, FETCH_STATE_ERROR);
      return;
    }

    applySummary(state, summaryResult.payload);
    switchPage(state, PAGE_OVERVIEW);

    const remaining = DX_MIN_SHEEN_MS - (nowMs() - bootStart);
    if (remaining > 0) {
      await wait(remaining);
    }
    setFetchState(root, FETCH_STATE_READY);
  }

  function mountAll() {
    const roots = document.querySelectorAll('#dex-achv');
    roots.forEach((root) => {
      void mountRoot(root);
    });
  }

  window.__dxAchievementsMount = mountAll;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      mountAll();
    }, { once: true });
  } else {
    mountAll();
  }

  window.addEventListener('dx:slotready', () => {
    mountAll();
  });
})();
