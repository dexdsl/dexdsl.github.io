(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__dxPollsAppLoaded && typeof window.__dxPollsQueueBoot === 'function') {
    try {
      window.__dxPollsQueueBoot();
    } catch {}
    return;
  }
  window.__dxPollsAppLoaded = true;

  const STYLE_ID = 'dx-polls-app-style-v2';
  const DX_MIN_SHEEN_MS = 120;
  const PAGE_SIZE_OPEN = 16;
  const PAGE_SIZE_CLOSED = 10;
  const PAGE_SIZE_PUBLISHED = 12;
  const DEFAULT_TAB = 'open';
  const TAB_SET = new Set(['open', 'results', 'archive']);
  const DETAIL_POLL_CACHE_TTL_MS = 45_000;

  const state = {
    tab: DEFAULT_TAB,
    pollId: '',
    closedPage: 1,
    archiveDrawerOpen: false,
    authSnapshot: {
      auth: null,
      authenticated: false,
      token: null,
      user: null,
    },
    collections: {
      open: { polls: [], page: 1, pages: 1, total: 0 },
      closed: { polls: [], page: 1, pages: 1, total: 0 },
      published: { rows: [], page: 1, pages: 1, total: 0 },
    },
    detail: null,
    detailCache: new Map(),
    loading: false,
    error: '',
    busyVote: false,
  };

  function text(value) {
    return String(value ?? '').trim();
  }

  function htmlEscape(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizePath(pathname) {
    const clean = String(pathname || '/').replace(/\/+/g, '/');
    if (clean === '/') return '/';
    return clean.endsWith('/') ? clean.slice(0, -1) : clean;
  }

  function normalizeTab(raw) {
    const value = text(raw).toLowerCase();
    return TAB_SET.has(value) ? value : DEFAULT_TAB;
  }

  function parseRoute(root = null) {
    const query = new URLSearchParams(window.location.search || '');
    let pollId = text(query.get('poll'));
    let tab = normalizeTab(query.get('tab'));

    if (root instanceof Element) {
      const attrPoll = text(root.getAttribute('data-dx-poll-id'));
      if (attrPoll && !pollId) {
        pollId = attrPoll;
        tab = 'open';
      }
    }

    const pathname = normalizePath(window.location.pathname || '/');
    if (pathname.startsWith('/polls/')) {
      const segment = pathname.slice('/polls/'.length).replace(/\/index\.html$/i, '').replace(/\/$/, '');
      if (segment) {
        pollId = decodeURIComponent(segment);
        tab = 'open';
      }
    }

    return { tab, pollId };
  }

  function buildPollsHref(tab, pollId = '') {
    const query = new URLSearchParams();
    const normalizedTab = normalizeTab(tab);
    const normalizedPollId = text(pollId);
    if (normalizedTab === 'open' && normalizedPollId) {
      return `/polls/${encodeURIComponent(normalizedPollId)}/`;
    }
    if (normalizedTab !== DEFAULT_TAB) query.set('tab', normalizedTab);
    if (normalizedPollId) query.set('poll', normalizedPollId);
    const qs = query.toString();
    return `/polls/${qs ? `?${qs}` : ''}`;
  }

  function writeRoute({ tab, pollId }, replace = false) {
    const nextHref = buildPollsHref(tab, pollId);
    const nextPathAndQuery = nextHref.replace(/\/index\.html$/, '/');
    const currentPathAndQuery = `${window.location.pathname}${window.location.search}`;
    if (currentPathAndQuery === nextPathAndQuery) return;
    if (replace) {
      window.history.replaceState({}, '', nextHref);
    } else {
      window.history.pushState({}, '', nextHref);
    }
  }

  function parseDate(value) {
    const ms = Date.parse(String(value || ''));
    return Number.isFinite(ms) ? ms : null;
  }

  function formatDate(value) {
    const ms = parseDate(value);
    if (!ms) return 'TBD';
    try {
      return new Date(ms).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return new Date(ms).toISOString().slice(0, 10);
    }
  }

  function relativeClose(value) {
    const ms = parseDate(value);
    if (!ms) return 'Closing date TBD';
    const delta = ms - Date.now();
    if (delta <= 0) return 'Closed';
    const hours = Math.floor(delta / 36e5);
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    if (days > 0) return `${days}d ${remHours}h left`;
    if (hours > 0) return `${hours}h left`;
    const mins = Math.max(1, Math.floor(delta / 6e4));
    return `${mins}m left`;
  }

  function normalizeOptions(raw) {
    if (Array.isArray(raw)) {
      return raw.map((item) => text(item)).filter(Boolean);
    }
    if (typeof raw === 'string') {
      return raw.split('|').map((item) => text(item)).filter(Boolean);
    }
    return [];
  }

  function normalizePoll(raw) {
    const item = raw && typeof raw === 'object' ? raw : {};
    return {
      id: text(item.id),
      slug: text(item.slug) || null,
      status: text(item.status) || 'draft',
      question: text(item.question) || 'Untitled poll',
      options: normalizeOptions(item.options),
      createdAt: text(item.createdAt || item.created_at),
      closeAt: text(item.closeAt || item.close_at),
      manualClose: Boolean(item.manualClose || item.manual_close),
      visibility: text(item.visibility) === 'members' ? 'members' : 'public',
      closed: Boolean(item.closed),
    };
  }

  function normalizeCountMap(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const [key, value] of Object.entries(raw)) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0) continue;
      out[String(key)] = Math.floor(parsed);
    }
    return out;
  }

  function normalizeResults(raw) {
    const item = raw && typeof raw === 'object' ? raw : {};
    return {
      total: Math.max(0, Number(item.total || 0) || 0),
      counts: Array.isArray(item.counts)
        ? item.counts.map((value) => Math.max(0, Number(value) || 0))
        : normalizeCountMap(item.counts),
      viewerVote: Number.isInteger(Number(item.viewerVote)) ? Number(item.viewerVote) : null,
      closed: Boolean(item.closed),
      mode: text(item.mode || 'live') || 'live',
      publishedSnapshot: item.publishedSnapshot && typeof item.publishedSnapshot === 'object'
        ? item.publishedSnapshot
        : null,
    };
  }

  function normalizeListPayload(raw, fallbackPage = 1) {
    if (Array.isArray(raw)) {
      return {
        polls: raw.map(normalizePoll),
        page: fallbackPage,
        pages: 1,
        total: raw.length,
      };
    }
    const item = raw && typeof raw === 'object' ? raw : {};
    const candidates = [item.polls, item.items, item.data, item.rows];
    const list = candidates.find((value) => Array.isArray(value)) || [];
    return {
      polls: list.map(normalizePoll),
      page: Math.max(1, Number(item.page) || fallbackPage),
      pages: Math.max(1, Number(item.pages || item.totalPages) || 1),
      total: Math.max(0, Number(item.total || item.count || list.length) || 0),
    };
  }

  function normalizePublishedPayload(raw) {
    const item = raw && typeof raw === 'object' ? raw : {};
    const list = Array.isArray(item.items)
      ? item.items
      : Array.isArray(item.rows)
        ? item.rows
        : Array.isArray(item.polls)
          ? item.polls
          : [];
    return {
      rows: list.map((entry) => {
        const poll = entry?.poll && typeof entry.poll === 'object' ? entry.poll : entry;
        const snapshot = entry?.publishedSnapshot && typeof entry.publishedSnapshot === 'object'
          ? entry.publishedSnapshot
          : entry?.snapshot && typeof entry.snapshot === 'object'
            ? entry.snapshot
            : null;
        return {
          poll: normalizePoll(poll),
          snapshot,
        };
      }),
      page: Math.max(1, Number(item.page) || 1),
      pages: Math.max(1, Number(item.pages || item.totalPages) || 1),
      total: Math.max(0, Number(item.total || item.count || list.length) || 0),
    };
  }

  function normalizeTrendPayload(raw) {
    const item = raw && typeof raw === 'object' ? raw : {};
    const trend = item.trend && typeof item.trend === 'object' ? item.trend : item;
    const points = Array.isArray(trend.series)
      ? trend.series
      : Array.isArray(trend.points)
        ? trend.points
        : [];
    return points.map((point) => ({
      t: text(point.t || point.bucket || point.timestamp || point.date || point.label),
      value: Math.max(0, Number(point.value ?? point.count ?? point.total ?? 0) || 0),
    })).filter((point) => point.t);
  }

  function sparkline(points = []) {
    const blocks = '▁▂▃▄▅▆▇█';
    if (!Array.isArray(points) || points.length === 0) return '';
    const values = points.map((point) => Math.max(0, Number(point.value) || 0));
    const max = Math.max(...values, 0);
    if (max <= 0) return '▁'.repeat(values.length);
    return values.map((value) => {
      const ratio = value / max;
      const index = Math.max(0, Math.min(blocks.length - 1, Math.round(ratio * (blocks.length - 1))));
      return blocks[index];
    }).join('');
  }

  function isClosedPoll(poll) {
    if (!poll) return true;
    if (poll.status === 'closed' || poll.manualClose || poll.closed) return true;
    const closeAt = parseDate(poll.closeAt);
    return closeAt ? closeAt <= Date.now() : false;
  }

  function getApiBase() {
    const raw = text(window.DEX_API_BASE_URL || window.DEX_API_ORIGIN || 'https://dex-api.spring-fog-8edd.workers.dev');
    return raw.replace(/\/$/, '');
  }

  async function resolveAuthSnapshot() {
    const auth = window.DEX_AUTH || window.dexAuth || null;
    if (!auth) {
      return { auth: null, authenticated: false, token: null, user: null };
    }
    try {
      if (typeof auth.resolve === 'function') {
        await auth.resolve(2400);
      } else if (auth.ready && typeof auth.ready.then === 'function') {
        await auth.ready;
      }
    } catch {}

    let authenticated = false;
    try {
      if (typeof auth.isAuthenticated === 'function') {
        authenticated = Boolean(await auth.isAuthenticated());
      }
    } catch {}

    let token = null;
    if (authenticated && typeof auth.getAccessToken === 'function') {
      try {
        token = await auth.getAccessToken();
      } catch {
        token = null;
      }
    }

    let user = null;
    try {
      if (typeof auth.getUser === 'function') {
        user = await auth.getUser();
      }
    } catch {}

    return { auth, authenticated, token, user };
  }

  async function promptSignIn() {
    if (!state.authSnapshot?.auth || typeof state.authSnapshot.auth.signIn !== 'function') return;
    try {
      await state.authSnapshot.auth.signIn({
        returnTo: `${window.location.pathname}${window.location.search}${window.location.hash}`,
      });
    } catch {}
  }

  async function fetchJson(pathname, { method = 'GET', body = null, authRequired = false } = {}) {
    const headers = { accept: 'application/json' };
    if (body != null) headers['content-type'] = 'application/json';
    if (state.authSnapshot?.token) headers.authorization = `Bearer ${state.authSnapshot.token}`;
    if (authRequired && !headers.authorization) {
      return { ok: false, status: 401, data: { error: 'AUTH_REQUIRED' } };
    }

    const response = await fetch(`${getApiBase()}${pathname}`, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    return { ok: response.ok, status: response.status, data: payload };
  }

  function setFetchState(root, mode) {
    root.setAttribute('data-dx-fetch-state', mode);
    if (mode === 'loading') {
      root.setAttribute('aria-busy', 'true');
    } else {
      root.removeAttribute('aria-busy');
    }
  }

  // Route loader overlay markup. Kept inside every render so it is never wiped
  // out of the DOM while [data-dx-fetch-state='loading']; CSS shows it during
  // loading and hides it on ready/error (mirrors the achievements route).
  const ROUTE_LOADER_HTML = `
      <div class="dx-route-loader" data-dx-route-loader role="status" aria-live="polite">
        <div class="dx-route-loader-inner">
          <div class="dx-route-loader-meta">
            <span class="dx-route-loader-phase">Loading</span>
            <span class="dx-route-loader-detail">Loading polls…</span>
          </div>
          <div class="dx-route-loader-track"><span class="dx-route-loader-fill"></span></div>
        </div>
      </div>`;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .dx-polls-shell{
        --dx-polls-gap: clamp(14px,1.6vw,20px);
        --dx-polls-line: rgba(255,255,255,.14);
        --dx-polls-line-strong: rgba(255,255,255,.26);
        --dx-polls-ink:#f3f3f4;
        --dx-polls-muted:rgba(255,255,255,.66);
        --dx-polls-faint:rgba(255,255,255,.42);
        --dx-polls-accent:var(--dx-accent-solid,#ff5b3a);
        --dx-polls-accent-grad:var(--dx-accent-gradient,linear-gradient(90deg,#ff1910,#ff6a00));
        width:var(--dx-header-frame-width);
        max-width:var(--dx-header-frame-width);
        margin:0 auto;
        height:100%;
        min-height:0;
        display:flex;
        flex-direction:column;
        font-family:var(--font-body);
        color:var(--dx-polls-ink);
        overflow:hidden;
      }
      /* Fixed header — pinned above the scrolling body */
      .dx-polls-head{
        flex:0 0 auto;
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:var(--dx-polls-gap);
        flex-wrap:wrap;
        padding-bottom:var(--dx-polls-gap);
        border-bottom:1px solid var(--dx-polls-line-strong);
      }
      .dx-polls-title{margin:0;font-family:var(--font-heading);text-transform:uppercase;font-size:clamp(1.6rem,4vw,2.5rem);letter-spacing:0;line-height:1;color:var(--dx-polls-ink)!important}
      .dx-polls-subtitle{margin:8px 0 0 0;font-family:var(--font-body);font-size:.82rem;letter-spacing:.01em;color:var(--dx-polls-muted)}
      .dx-polls-tabs{display:flex;gap:clamp(14px,2vw,26px);flex-wrap:wrap;align-items:center}
      /* Tabs mirror the header nav: gradient underline that wipes in on hover/active. */
      .dx-polls-tab{
        appearance:none;background:none;border:0;cursor:pointer;padding:0 0 7px;position:relative;
        font-family:var(--font-body);font-size:.72rem;text-transform:uppercase;letter-spacing:.16em;
        color:var(--dx-polls-ink);mix-blend-mode:normal;isolation:auto;text-shadow:none;
        transition:transform .2s ease;
      }
      .dx-polls-tab::after{
        content:"";position:absolute;left:0;bottom:0;width:100%;height:2px;
        background:linear-gradient(90deg,var(--dx-accent-grad-start,#ff1910),var(--dx-accent-grad-end,#ff6a00));
        transform:scaleX(0);transform-origin:right;transition:transform .3s ease;
      }
      .dx-polls-tab:hover::after,.dx-polls-tab.is-active::after{transform:scaleX(1);transform-origin:left}

      /* Scrolling body — the only region that scrolls; ends stay fixed against head/footer */
      .dx-polls-body{
        flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;
        display:block;
        padding-top:var(--dx-polls-gap);
      }
      .dx-polls-body::-webkit-scrollbar{width:9px}
      .dx-polls-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:9px}
      .dx-polls-col{min-height:0}

      .dx-polls-section + .dx-polls-section{margin-top:28px}
      .dx-polls-section--current{display:grid;gap:10px}
      .dx-polls-section--current .dx-polls-list{gap:4px}
      .dx-polls-section--current .dx-poll-card{
        border:1px solid var(--dx-polls-line)!important;border-radius:16px;
        padding:clamp(20px,2.3vw,30px) clamp(20px,2.3vw,28px);
        background:linear-gradient(150deg,rgba(255,255,255,.055),rgba(255,255,255,.018));
        cursor:pointer;
        transition:transform .28s var(--dx-motion-ease-standard,cubic-bezier(.22,.8,.24,1)),border-color .28s ease,box-shadow .28s ease;
      }
      .dx-polls-section--current .dx-poll-card::after{
        content:"";position:absolute;inset:0;border-radius:16px;padding:1px;
        background:var(--dx-polls-accent-grad);
        -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
        -webkit-mask-composite:xor;mask-composite:exclude;
        opacity:0;transition:opacity .28s ease;pointer-events:none;
      }
      .dx-polls-section--current .dx-poll-card:hover{transform:translateY(-3px);box-shadow:0 18px 40px rgba(0,0,0,.32)}
      .dx-polls-section--current .dx-poll-card:hover::after{opacity:.9}
      .dx-polls-section--current .dx-poll-question{font-size:clamp(1.22rem,2vw,1.72rem)}
      .dx-polls-archive-drawer{
        margin-top:clamp(20px,2.2vw,28px);
        border-top:1px solid var(--dx-polls-line);
        border-bottom:1px solid var(--dx-polls-line);
      }
      .dx-polls-archive-drawer > summary{
        min-height:48px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
        cursor:pointer;
        list-style:none;
        color:var(--dx-polls-ink);
        font-family:var(--font-body);
        font-size:.72rem;
        letter-spacing:.14em;
        text-transform:uppercase;
      }
      .dx-polls-archive-drawer > summary::-webkit-details-marker{display:none}
      .dx-polls-archive-drawer > summary::after{
        content:"+";
        font-family:var(--font-heading);
        font-size:1rem;
        line-height:1;
        color:var(--dx-polls-accent);
      }
      .dx-polls-archive-drawer[open] > summary::after{content:"-"}
      .dx-polls-archive-count{
        color:var(--dx-polls-muted);
        font-family:var(--font-body);
        font-size:.68rem;
        letter-spacing:.08em;
      }
      .dx-polls-archive-panel{padding:0 0 clamp(12px,1.5vw,18px)}
      .dx-polls-section-label{margin:0 0 4px;font-family:var(--font-body);font-size:.66rem;text-transform:uppercase;letter-spacing:.16em;color:var(--dx-polls-muted)}

      .dx-polls-list{display:grid;gap:0}
      .dx-poll-card{
        position:relative;isolation:auto;background:transparent;
        display:grid;gap:7px;padding:15px 0;
        border-top:1px solid var(--dx-polls-line);
      }
      .dx-poll-card:first-child{border-top:0}
      .dx-poll-card.is-locked{opacity:.72}
      .dx-poll-card:hover .dx-poll-question{color:var(--dx-polls-accent)!important;mix-blend-mode:normal;isolation:auto}
      .dx-poll-card-head{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
      .dx-poll-chip{font-family:var(--font-body);font-size:.62rem;text-transform:uppercase;letter-spacing:.14em;color:var(--dx-polls-muted)}
      .dx-poll-chip.is-accent{color:var(--dx-polls-accent);display:inline-flex;align-items:center;gap:7px}
      .dx-poll-chip.is-accent::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--dx-polls-accent-grad);box-shadow:0 0 8px 1px rgba(255,90,40,.6);animation:dxPollPulse 2s ease-in-out infinite}
      .dx-poll-chip.is-members{color:var(--dx-polls-ink)}
      .dx-poll-question{position:relative;margin:0;font-family:var(--font-heading);font-size:clamp(1rem,1.3vw,1.18rem);line-height:1.16;letter-spacing:.01em;text-transform:uppercase;color:var(--dx-polls-ink)!important;transition:color .15s ease}
      @keyframes dxPollPulse{0%,100%{opacity:1}50%{opacity:.4}}
      .dx-poll-meta{margin:0;font-family:var(--font-body);font-size:.76rem;color:var(--dx-polls-muted)}
      .dx-poll-actions{display:flex;gap:18px;flex-wrap:wrap;align-items:center;margin-top:2px}
      .dx-poll-action,
      .dx-poll-link{
        appearance:none;background:none;border:0;cursor:pointer;text-decoration:none;padding:0;
        font-family:var(--font-body);font-size:.68rem;text-transform:uppercase;letter-spacing:.14em;
        color:var(--dx-polls-muted);transition:color .2s ease;
      }
      .dx-poll-link.is-primary{color:var(--dx-polls-ink)}
      .dx-poll-action:hover,.dx-poll-link:hover{color:var(--dx-polls-accent)}
      .dx-poll-action[disabled]{opacity:.4;cursor:default}
      .dx-poll-action[disabled]:hover{color:var(--dx-polls-muted)}
      .dx-polls-pager{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:18px;padding-top:14px;border-top:1px solid var(--dx-polls-line)}
      .dx-polls-empty{margin:14px 0 0;font-family:var(--font-body);font-size:.82rem;color:var(--dx-polls-muted)}
      .dx-polls-error{margin:0 0 6px;padding:10px 0;font-family:var(--font-body);font-size:.82rem;color:#a31410}

      .dx-poll-trend{margin:0;font-family:var(--font-body);font-size:.72rem;text-transform:uppercase;letter-spacing:.14em;color:var(--dx-polls-muted)}
      .dx-poll-trend-line{margin:4px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.9rem;letter-spacing:.04em;color:var(--dx-polls-ink)}
      .dx-polls-loading{opacity:.6}
      @media (max-width:980px){
        .dx-polls-shell{height:auto;overflow:visible}
        .dx-polls-body{overflow:visible}
      }
    `;
    document.head.appendChild(style);
  }

  function getRootElement() {
    return document.querySelector('[data-dx-polls-app]') || document.getElementById('dx-polls-app') || document.getElementById('dex-console');
  }

  function renderError(root, message) {
    root.innerHTML = `
      ${ROUTE_LOADER_HTML}
      <section class="dx-polls-shell">
        <header class="dx-polls-head">
          <h1 class="dx-polls-title">Polls</h1>
        </header>
        <div class="dx-polls-body">
          <p class="dx-polls-error">${htmlEscape(message || 'Unable to load polls right now.')}</p>
        </div>
      </section>
    `;
  }

  function buildPollCard(poll, { includeTrend = false } = {}) {
    const closed = isClosedPoll(poll);
    const locked = poll.visibility === 'members' && !state.authSnapshot.authenticated;
    const detailHref = buildPollsHref(state.tab, poll.id);
    const trendText = includeTrend && Array.isArray(poll.__trendPoints) && poll.__trendPoints.length
      ? `<p class="dx-poll-trend">90d trend</p><p class="dx-poll-trend-line">${htmlEscape(sparkline(poll.__trendPoints))}</p>`
      : '';

    return `
      <article class="dx-poll-card${locked ? ' is-locked' : ''}" data-dx-poll-id="${htmlEscape(poll.id)}">
        <div class="dx-poll-card-head">
          <span class="dx-poll-chip ${closed ? '' : 'is-accent'}">${closed ? 'Closed' : 'Open'}</span>
          ${poll.visibility === 'members' ? '<span class="dx-poll-chip is-members">Members only</span>' : ''}
        </div>
        <h3 class="dx-poll-question">${htmlEscape(poll.question)}</h3>
        <p class="dx-poll-meta">${closed ? `Closed ${htmlEscape(formatDate(poll.closeAt))}` : `Closes ${htmlEscape(formatDate(poll.closeAt))} (${htmlEscape(relativeClose(poll.closeAt))})`}</p>
        ${trendText}
        <div class="dx-poll-actions">
          <a class="dx-poll-link is-primary" href="${htmlEscape(detailHref)}" data-dx-poll-open="${htmlEscape(poll.id)}" data-dx-soft-nav-skip="true">View Poll</a>
          ${locked ? `<button class="dx-poll-action" type="button" data-dx-poll-signin="true">Sign in</button>` : ''}
        </div>
      </article>
    `;
  }

  function buildPublishedCard(row) {
    const poll = row.poll || normalizePoll({});
    const snapshot = row.snapshot && typeof row.snapshot === 'object' ? row.snapshot : null;
    const total = Number(snapshot?.total || snapshot?.totals?.total || 0) || 0;
    const headline = text(snapshot?.headline || '');
    const summary = text(snapshot?.summaryMarkdown || snapshot?.summary || '');
    const publishedAt = text(snapshot?.publishedAt || snapshot?.published_at);
    return `
      <article class="dx-poll-card" data-dx-poll-id="${htmlEscape(poll.id)}">
        <div class="dx-poll-card-head">
          <span class="dx-poll-chip">Published</span>
          ${poll.visibility === 'members' ? '<span class="dx-poll-chip is-members">Members only</span>' : ''}
        </div>
        <h3 class="dx-poll-question">${htmlEscape(headline || poll.question)}</h3>
        <p class="dx-poll-meta">${publishedAt ? `Published ${htmlEscape(formatDate(publishedAt))}` : 'Official snapshot'} • ${total} votes</p>
        ${summary ? `<div class="dx-poll-published">${htmlEscape(summary.slice(0, 220))}</div>` : ''}
        <div class="dx-poll-actions">
          <a class="dx-poll-link is-primary" href="${htmlEscape(buildPollsHref('results', poll.id))}" data-dx-poll-open="${htmlEscape(poll.id)}" data-dx-soft-nav-skip="true">View snapshot</a>
        </div>
      </article>
    `;
  }

  // ---- Poll modal (black-glass surface, matching the messages / download modal) ----
  const POLL_MODAL_STYLE_ID = 'dx-polls-modal-style';
  let pollModalKeyHandler = null;
  let pollModalLastFocus = null;
  let pollModalAnimTimer = 0;

  function ensurePollModalStyles() {
    if (document.getElementById(POLL_MODAL_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = POLL_MODAL_STYLE_ID;
    style.textContent = `
      #dx-polls-modal{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;padding:clamp(12px,3vw,40px);font-family:var(--font-body);}
      #dx-polls-modal[data-open='true']{display:flex;}
      #dx-polls-modal .dx-pm-backdrop{position:absolute;inset:0;background:rgba(6,7,10,.64);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);opacity:0;transition:opacity .34s ease;}
      #dx-polls-modal[data-anim='in'] .dx-pm-backdrop{opacity:1;}
      #dx-polls-modal .dx-pm-card{position:relative;z-index:1;width:min(620px,100%);max-height:min(88dvh,880px);display:flex;flex-direction:column;
        color:var(--dx-blackglass-ink,#f3f3f4);
        background:var(--dx-blackglass-bg,linear-gradient(145deg,rgba(15,16,21,.92),rgba(9,10,14,.88)));
        border:1px solid var(--dx-blackglass-rim,rgba(255,255,255,.16));border-radius:18px;
        box-shadow:0 40px 100px rgba(0,0,0,.6);
        backdrop-filter:var(--dx-blackglass-backdrop,blur(24px) saturate(170%));-webkit-backdrop-filter:var(--dx-blackglass-backdrop,blur(24px) saturate(170%));
        overflow:hidden;opacity:0;transform:translateY(24px) scale(.96);
        transition:opacity .42s var(--dx-motion-ease-standard,cubic-bezier(.22,.8,.24,1)),transform .44s var(--dx-motion-ease-standard,cubic-bezier(.22,.8,.24,1));}
      #dx-polls-modal[data-anim='in'] .dx-pm-card{opacity:1;transform:none;}
      #dx-polls-modal[data-anim='out'] .dx-pm-card{opacity:0;transform:translateY(12px) scale(.985);transition-duration:.22s;}
      #dx-polls-modal[data-anim='out'] .dx-pm-backdrop{opacity:0;transition-duration:.22s;}
      #dx-polls-modal .dx-pm-card::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:var(--dx-polls-accent-grad,linear-gradient(90deg,#ff1910,#ff6a00));}
      #dx-polls-modal .dx-pm-head{position:relative;flex:0 0 auto;padding:24px 26px 16px;border-bottom:1px solid var(--dx-blackglass-line,rgba(255,255,255,.14));}
      #dx-polls-modal .dx-pm-chips{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding-right:44px;}
      #dx-polls-modal .dx-pm-chip{font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:var(--dx-blackglass-faint,rgba(255,255,255,.4));}
      #dx-polls-modal .dx-pm-chip.is-open{color:#fff;display:inline-flex;align-items:center;gap:7px;}
      #dx-polls-modal .dx-pm-chip.is-open::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--dx-polls-accent-grad,linear-gradient(90deg,#ff1910,#ff6a00));box-shadow:0 0 10px 1px rgba(255,90,40,.7);animation:dxPmPulse 2s ease-in-out infinite;}
      #dx-polls-modal .dx-pm-chip.is-members{color:#fff;}
      #dx-polls-modal .dx-pm-title{margin:14px 0 0;font-family:var(--font-heading);text-transform:uppercase;font-size:clamp(1.25rem,2.6vw,1.75rem);line-height:1.08;letter-spacing:.01em;color:#fff;}
      #dx-polls-modal .dx-pm-meta{margin:9px 0 0;font-size:.78rem;color:var(--dx-blackglass-muted,rgba(255,255,255,.62));}
      #dx-polls-modal .dx-pm-close{position:absolute;top:18px;right:18px;width:36px;height:36px;border-radius:999px;border:1px solid var(--dx-blackglass-line-strong,rgba(255,255,255,.26));background:rgba(255,255,255,.06);color:#fff;font-size:1.15rem;line-height:1;cursor:pointer;transition:background .18s ease,transform .3s var(--dx-motion-ease-standard,cubic-bezier(.22,.8,.24,1));}
      #dx-polls-modal .dx-pm-close:hover{background:rgba(255,255,255,.14);transform:rotate(90deg);}
      #dx-polls-modal .dx-pm-body{flex:1 1 auto;min-height:0;overflow-y:auto;padding:18px 26px;display:flex;flex-direction:column;gap:14px;}
      #dx-polls-modal .dx-pm-body::-webkit-scrollbar{width:8px}
      #dx-polls-modal .dx-pm-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:8px}
      #dx-polls-modal .dx-pm-hint{margin:0;font-size:.76rem;color:var(--dx-blackglass-muted,rgba(255,255,255,.62));padding:11px 13px;border:1px dashed var(--dx-blackglass-line-strong,rgba(255,255,255,.26));border-radius:10px;}
      #dx-polls-modal .dx-pm-empty{margin:auto;padding:40px 0;color:var(--dx-blackglass-muted,rgba(255,255,255,.62));font-size:.85rem;text-align:center;}
      #dx-polls-modal .dx-pm-options{display:grid;gap:9px;}
      #dx-polls-modal .dx-poll-option{display:grid;gap:10px;cursor:pointer;text-align:left;width:100%;border:0;
        padding:14px 16px;border:1px solid var(--dx-blackglass-line,rgba(255,255,255,.14));border-radius:13px;background:rgba(255,255,255,.04);
        transition:border-color .2s ease,background .2s ease,transform .2s ease;
        opacity:0;transform:translateY(10px);animation:dxPmOptIn .46s var(--dx-motion-ease-standard,cubic-bezier(.22,.8,.24,1)) forwards;}
      #dx-polls-modal .dx-poll-option:hover:not([disabled]){background:rgba(255,255,255,.08);border-color:var(--dx-blackglass-line-strong,rgba(255,255,255,.26));transform:translateY(-1px);}
      #dx-polls-modal .dx-poll-option.is-selected{border-color:transparent;background:rgba(255,90,40,.13);box-shadow:0 0 0 1px rgba(255,90,40,.45);}
      #dx-polls-modal .dx-poll-option[disabled]{cursor:default;}
      #dx-polls-modal .dx-poll-option-title{display:flex;align-items:center;gap:8px;font-size:.92rem;letter-spacing:.01em;color:var(--dx-blackglass-ink,#f3f3f4);}
      #dx-polls-modal .dx-poll-option.is-selected .dx-poll-option-title::before{content:"✓";font-size:.72rem;color:#fff;width:16px;height:16px;flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:var(--dx-polls-accent-grad,linear-gradient(90deg,#ff1910,#ff6a00));}
      #dx-polls-modal .dx-poll-bar{position:relative;height:6px;border-radius:6px;background:rgba(255,255,255,.1);overflow:hidden;}
      #dx-polls-modal .dx-poll-bar-fill{height:100%;width:0;border-radius:6px;background:var(--dx-polls-accent-grad,linear-gradient(90deg,#ff1910,#ff6a00));transition:width .62s var(--dx-motion-ease-standard,cubic-bezier(.22,.8,.24,1));}
      #dx-polls-modal .dx-poll-row-foot{display:flex;align-items:center;justify-content:space-between;font-size:.72rem;color:var(--dx-blackglass-muted,rgba(255,255,255,.62));}
      #dx-polls-modal .dx-poll-published{padding:13px 15px;border:1px solid var(--dx-blackglass-line,rgba(255,255,255,.14));border-radius:12px;background:rgba(255,255,255,.03);}
      #dx-polls-modal .dx-poll-published .dx-poll-meta{margin:0;font-size:.76rem;color:var(--dx-blackglass-muted,rgba(255,255,255,.62));}
      #dx-polls-modal .dx-poll-published .dx-poll-meta + .dx-poll-meta{margin-top:5px;}
      #dx-polls-modal .dx-poll-trend-line{margin:6px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:1rem;letter-spacing:.05em;color:#fff;}
      #dx-polls-modal .dx-pm-foot{flex:0 0 auto;border-top:1px solid var(--dx-blackglass-line,rgba(255,255,255,.14));padding:15px 26px;display:flex;align-items:center;justify-content:space-between;gap:10px;}
      #dx-polls-modal .dx-pm-total{font-size:.78rem;color:var(--dx-blackglass-muted,rgba(255,255,255,.62));}
      #dx-polls-modal .dx-pm-total strong{color:#fff;font-weight:600;}
      #dx-polls-modal .dx-pm-signin{appearance:none;border:0;cursor:pointer;font-family:var(--font-body);font-size:.72rem;text-transform:uppercase;letter-spacing:.14em;color:#fff;background:none;padding:0;}
      #dx-polls-modal .dx-pm-signin:hover{color:var(--dx-polls-accent,#ff5b3a);}
      @keyframes dxPmOptIn{to{opacity:1;transform:none;}}
      @keyframes dxPmPulse{0%,100%{opacity:1;}50%{opacity:.4;}}
      @media (max-width:640px){#dx-polls-modal .dx-pm-card{max-height:92dvh;}}
      @media (prefers-reduced-motion:reduce){
        #dx-polls-modal .dx-pm-card,#dx-polls-modal .dx-pm-backdrop{transition-duration:.001ms !important;}
        #dx-polls-modal .dx-poll-option{animation-duration:.001ms !important;opacity:1 !important;transform:none !important;}
        #dx-polls-modal .dx-poll-bar-fill{transition-duration:.001ms !important;}
        #dx-polls-modal .dx-pm-chip.is-open::before{animation:none !important;}
        #dx-polls-modal .dx-pm-close:hover{transform:none !important;}
      }
    `;
    document.head.appendChild(style);
  }

  function ensurePollModalEl() {
    let el = document.getElementById('dx-polls-modal');
    if (el) return el;
    ensurePollModalStyles();
    el = document.createElement('div');
    el.id = 'dx-polls-modal';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <div class="dx-pm-backdrop" data-dx-pm-close="1"></div>
      <div class="dx-pm-card" role="dialog" aria-modal="true" aria-label="Poll" tabindex="-1">
        <div class="dx-pm-head">
          <button type="button" class="dx-pm-close" data-dx-pm-close="1" aria-label="Close">×</button>
          <div class="dx-pm-chips" data-dx-pm-chips></div>
          <h2 class="dx-pm-title" data-dx-pm-title></h2>
          <p class="dx-pm-meta" data-dx-pm-meta></p>
        </div>
        <div class="dx-pm-body" data-dx-pm-body></div>
        <div class="dx-pm-foot" data-dx-pm-foot></div>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest('[data-dx-pm-close]')) { closePollModal(); return; }
      if (target.closest('[data-dx-poll-signin]')) { event.preventDefault(); await promptSignIn(); return; }
      const voteBtn = target.closest('[data-dx-poll-vote]');
      if (voteBtn) {
        const optionIndex = Number(voteBtn.getAttribute('data-dx-poll-vote'));
        await vote(optionIndex);
        renderPollModalContent({ animateBars: true });
      }
    });
    return el;
  }

  function pollModalContent(detail) {
    if (!detail || detail.loading) {
      return { chips: '<span class="dx-pm-chip">Loading</span>', title: 'Loading poll…', meta: '', body: '<p class="dx-pm-empty">Loading…</p>', foot: '' };
    }
    if (detail.error) {
      return { chips: '<span class="dx-pm-chip">Error</span>', title: 'Unable to load poll', meta: '', body: `<p class="dx-pm-empty">${htmlEscape(detail.error)}</p>`, foot: '' };
    }
    if (detail.locked) {
      return {
        chips: '<span class="dx-pm-chip is-members">Members only</span>',
        title: 'Sign in required',
        meta: 'This poll is open to members.',
        body: '<p class="dx-pm-hint">Sign in to view this members-only poll and cast your vote.</p>',
        foot: '<span class="dx-pm-total"></span><button type="button" class="dx-pm-signin" data-dx-poll-signin="true">Sign in →</button>',
      };
    }

    const poll = detail.poll;
    const results = detail.results;
    const closed = isClosedPoll(poll) || Boolean(results.closed);
    const countsByIndex = Array.isArray(results.counts)
      ? results.counts
      : poll.options.map((_, idx) => Number(results.counts?.[String(idx)] ?? results.counts?.[idx] ?? 0));

    const optionsHtml = poll.options.map((label, index) => {
      const votes = Math.max(0, Number(countsByIndex[index]) || 0);
      const pct = results.total > 0 ? Math.round((votes / results.total) * 100) : 0;
      const selected = results.viewerVote === index;
      return `
        <button type="button" class="dx-poll-option${selected ? ' is-selected' : ''}" data-dx-poll-vote="${index}" style="animation-delay:${index * 55}ms" ${closed || state.busyVote ? 'disabled' : ''}>
          <span class="dx-poll-option-title">${htmlEscape(label)}</span>
          <div class="dx-poll-bar"><div class="dx-poll-bar-fill" data-pct="${pct}" style="width:0"></div></div>
          <div class="dx-poll-row-foot"><span>${votes} ${votes === 1 ? 'vote' : 'votes'}</span><span>${pct}%</span></div>
        </button>
      `;
    }).join('');

    const snapshot = results.publishedSnapshot && typeof results.publishedSnapshot === 'object' ? results.publishedSnapshot : null;
    const snapshotMarkup = snapshot
      ? `<div class="dx-poll-published">
            <p class="dx-poll-meta">Official snapshot v${htmlEscape(String(snapshot.version || '1'))}${snapshot.publishedAt ? ` • ${htmlEscape(formatDate(snapshot.publishedAt))}` : ''}</p>
            ${snapshot.summaryMarkdown ? `<p class="dx-poll-meta">${htmlEscape(String(snapshot.summaryMarkdown).slice(0, 280))}</p>` : ''}
          </div>`
      : '';
    const trendMarkup = Array.isArray(detail.trend) && detail.trend.length
      ? `<div class="dx-poll-published">
            <p class="dx-poll-meta">Trend · 90 days</p>
            <p class="dx-poll-trend-line">${htmlEscape(sparkline(detail.trend))}</p>
          </div>`
      : '';
    const hint = !state.authSnapshot.authenticated && !closed
      ? '<p class="dx-pm-hint">Sign in to cast your vote — results stay visible either way.</p>'
      : '';

    return {
      chips: `
        <span class="dx-pm-chip ${closed ? '' : 'is-open'}">${closed ? 'Closed' : 'Open'}</span>
        <span class="dx-pm-chip">${htmlEscape(results.mode || 'live')}</span>
        ${poll.visibility === 'members' ? '<span class="dx-pm-chip is-members">Members only</span>' : ''}`,
      title: poll.question,
      meta: closed
        ? `Closed ${formatDate(poll.closeAt)}`
        : `Closes ${formatDate(poll.closeAt)} · ${relativeClose(poll.closeAt)}`,
      body: `${hint}${snapshotMarkup}${trendMarkup}<div class="dx-pm-options">${optionsHtml}</div>`,
      foot: `<span class="dx-pm-total"><strong>${results.total}</strong> total ${results.total === 1 ? 'vote' : 'votes'}</span>
        ${!state.authSnapshot.authenticated && !closed ? '<button type="button" class="dx-pm-signin" data-dx-poll-signin="true">Sign in →</button>' : ''}`,
    };
  }

  function animatePollBars(el) {
    const fills = el.querySelectorAll('.dx-poll-bar-fill[data-pct]');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fills.forEach((fill) => {
        const pct = Math.max(0, Math.min(100, Number(fill.getAttribute('data-pct')) || 0));
        fill.style.width = `${pct}%`;
      });
    }));
  }

  function renderPollModalContent({ animateBars = true } = {}) {
    const el = document.getElementById('dx-polls-modal');
    if (!el) return;
    const content = pollModalContent(state.detail);
    el.querySelector('[data-dx-pm-chips]').innerHTML = content.chips;
    el.querySelector('[data-dx-pm-title]').textContent = content.title;
    const metaEl = el.querySelector('[data-dx-pm-meta]');
    metaEl.textContent = content.meta;
    metaEl.style.display = content.meta ? '' : 'none';
    el.querySelector('[data-dx-pm-body]').innerHTML = content.body;
    el.querySelector('[data-dx-pm-foot]').innerHTML = content.foot;
    if (animateBars) animatePollBars(el);
  }

  function openPollOverlay() {
    const el = ensurePollModalEl();
    if (el.getAttribute('data-open') === 'true') return el;
    if (pollModalAnimTimer) { clearTimeout(pollModalAnimTimer); pollModalAnimTimer = 0; }
    pollModalLastFocus = document.activeElement;
    el.setAttribute('data-open', 'true');
    el.setAttribute('aria-hidden', 'false');
    try { el.__dxPrevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; } catch {}
    requestAnimationFrame(() => requestAnimationFrame(() => el.setAttribute('data-anim', 'in')));
    if (!pollModalKeyHandler) {
      pollModalKeyHandler = (event) => { if (event.key === 'Escape') closePollModal(); };
      document.addEventListener('keydown', pollModalKeyHandler);
    }
    const card = el.querySelector('.dx-pm-card');
    if (card) try { card.focus(); } catch {}
    return el;
  }

  async function openPollModal(pollId, { push = true } = {}) {
    const id = text(pollId);
    if (!id) return;
    const alreadyOpen = state.pollId === id && document.getElementById('dx-polls-modal')?.getAttribute('data-open') === 'true';
    state.pollId = id;
    if (push) writeRoute({ tab: state.tab, pollId: id }, false);
    openPollOverlay();
    const cached = state.detailCache.get(id);
    if (cached && (Date.now() - cached.cachedAt) <= DETAIL_POLL_CACHE_TTL_MS) {
      state.detail = cached.value;
    } else if (!alreadyOpen) {
      state.detail = { loading: true };
    }
    renderPollModalContent({ animateBars: true });
    try {
      await fetchDetail(id);
    } catch (error) {
      state.detail = { error: error instanceof Error ? error.message : String(error) };
    }
    if (state.pollId !== id) return; // closed or switched while loading
    renderPollModalContent({ animateBars: true });
  }

  function closePollModal({ push = true } = {}) {
    state.pollId = '';
    const el = document.getElementById('dx-polls-modal');
    if (push) writeRoute({ tab: state.tab, pollId: '' }, false);
    if (!el || el.getAttribute('data-open') !== 'true') {
      if (el) { el.removeAttribute('data-open'); el.removeAttribute('data-anim'); }
      return;
    }
    el.setAttribute('data-anim', 'out');
    if (pollModalKeyHandler) { document.removeEventListener('keydown', pollModalKeyHandler); pollModalKeyHandler = null; }
    try { document.body.style.overflow = el.__dxPrevOverflow || ''; } catch {}
    if (pollModalAnimTimer) clearTimeout(pollModalAnimTimer);
    pollModalAnimTimer = window.setTimeout(() => {
      el.removeAttribute('data-open');
      el.removeAttribute('data-anim');
      el.setAttribute('aria-hidden', 'true');
      pollModalAnimTimer = 0;
    }, 240);
    if (pollModalLastFocus && typeof pollModalLastFocus.focus === 'function') {
      try { pollModalLastFocus.focus(); } catch {}
    }
  }

  function syncModalFromState() {
    if (state.pollId) {
      openPollOverlay();
      renderPollModalContent({ animateBars: true });
    } else {
      closePollModal({ push: false });
    }
  }

  function render(root) {
    const openCards = state.collections.open.polls.length
      ? state.collections.open.polls.map((poll) => buildPollCard(poll)).join('')
      : '<p class="dx-polls-empty">No open polls right now.</p>';

    const archiveCards = state.collections.closed.polls.length
      ? state.collections.closed.polls.map((poll) => buildPollCard(poll, { includeTrend: true })).join('')
      : '<p class="dx-polls-empty">No closed polls in this window.</p>';

    const publishedCards = state.collections.published.rows.length
      ? state.collections.published.rows.map((row) => buildPublishedCard(row)).join('')
      : '<p class="dx-polls-empty">No published snapshots yet.</p>';

    const listBody = state.tab === 'open'
      ? `
          <div class="dx-polls-section dx-polls-section--current">
            <p class="dx-polls-section-label">Current polls</p>
            <div class="dx-polls-list">${openCards}</div>
          </div>
          <details class="dx-polls-archive-drawer" data-dx-polls-archive-drawer="true" ${state.archiveDrawerOpen ? 'open' : ''}>
            <summary>
              <span>Past polls</span>
              <span class="dx-polls-archive-count">${state.collections.closed.total} archived</span>
            </summary>
            <div class="dx-polls-archive-panel">
              <div class="dx-polls-list">${archiveCards}</div>
              <div class="dx-polls-pager">
                <button type="button" class="dx-poll-action" data-dx-poll-closed-prev="true" ${state.collections.closed.page <= 1 ? 'disabled' : ''}>Previous</button>
                <span class="dx-poll-meta">Page ${state.collections.closed.page} of ${state.collections.closed.pages}</span>
                <button type="button" class="dx-poll-action" data-dx-poll-closed-next="true" ${state.collections.closed.page >= state.collections.closed.pages ? 'disabled' : ''}>Next</button>
              </div>
            </div>
          </details>
        `
      : state.tab === 'results'
        ? `
          <div class="dx-polls-section">
            <p class="dx-polls-section-label">Published results</p>
            <div class="dx-polls-list">${publishedCards}</div>
          </div>
        `
        : `
          <div class="dx-polls-section">
            <p class="dx-polls-section-label">Archive &amp; trends</p>
            <div class="dx-polls-list">${archiveCards}</div>
            <div class="dx-polls-pager">
              <button type="button" class="dx-poll-action" data-dx-poll-closed-prev="true" ${state.collections.closed.page <= 1 ? 'disabled' : ''}>Previous</button>
              <span class="dx-poll-meta">Page ${state.collections.closed.page} of ${state.collections.closed.pages}</span>
              <button type="button" class="dx-poll-action" data-dx-poll-closed-next="true" ${state.collections.closed.page >= state.collections.closed.pages ? 'disabled' : ''}>Next</button>
            </div>
          </div>
        `;

    root.innerHTML = `
      ${ROUTE_LOADER_HTML}
      <section class="dx-polls-shell${state.loading ? ' dx-polls-loading' : ''}">
        <header class="dx-polls-head">
          <div>
            <h1 class="dx-polls-title">Polls</h1>
            <p class="dx-polls-subtitle">Open voting, official snapshots, and archive trends.</p>
          </div>
          <nav class="dx-polls-tabs" role="tablist" aria-label="Poll views">
            <button type="button" role="tab" class="dx-polls-tab${state.tab === 'open' ? ' is-active' : ''}" data-dx-polls-tab="open">Open</button>
            <button type="button" role="tab" class="dx-polls-tab${state.tab === 'results' ? ' is-active' : ''}" data-dx-polls-tab="results">Results</button>
            <button type="button" role="tab" class="dx-polls-tab${state.tab === 'archive' ? ' is-active' : ''}" data-dx-polls-tab="archive">Archive</button>
          </nav>
        </header>
        ${state.error ? `<p class="dx-polls-error">${htmlEscape(state.error)}</p>` : ''}
        <div class="dx-polls-body">
          <div class="dx-polls-col dx-polls-col--list">${listBody}</div>
        </div>
      </section>
    `;
  }

  async function fetchCollections() {
    const [openRes, closedRes, publishedRes] = await Promise.all([
      fetchJson(`/polls?state=open&page=1&pageSize=${PAGE_SIZE_OPEN}`),
      fetchJson(`/polls?state=closed&page=${state.closedPage}&pageSize=${PAGE_SIZE_CLOSED}`),
      fetchJson(`/polls/published?page=1&pageSize=${PAGE_SIZE_PUBLISHED}`),
    ]);
    if (!openRes.ok) throw new Error('Unable to load open polls');
    if (!closedRes.ok) throw new Error('Unable to load closed polls');
    state.collections.open = normalizeListPayload(openRes.data, 1);
    state.collections.closed = normalizeListPayload(closedRes.data, state.closedPage);
    // Backward compatibility: older API fixtures do not expose /polls/published yet.
    state.collections.published = publishedRes.ok
      ? normalizePublishedPayload(publishedRes.data)
      : { rows: [], page: 1, pages: 1, total: 0 };
    state.closedPage = state.collections.closed.page;
  }

  async function fetchTrendForPoll(pollId) {
    try {
      const response = await fetchJson(`/polls/${encodeURIComponent(pollId)}/trend?bucket=day&window=90d`);
      if (!response.ok) return [];
      return normalizeTrendPayload(response.data);
    } catch {
      return [];
    }
  }

  async function fetchDetail(pollId) {
    const normalizedPollId = text(pollId);
    if (!normalizedPollId) {
      state.detail = null;
      return;
    }
    const cached = state.detailCache.get(normalizedPollId);
    if (cached && (Date.now() - cached.cachedAt) <= DETAIL_POLL_CACHE_TTL_MS && !state.busyVote) {
      state.detail = cached.value;
      return;
    }

    const pollRes = await fetchJson(`/polls/${encodeURIComponent(normalizedPollId)}`);
    if (pollRes.status === 401 || pollRes.status === 403) {
      state.detail = { locked: true, pollId: normalizedPollId };
      return;
    }
    if (!pollRes.ok) {
      throw new Error(`Unable to load poll ${normalizedPollId}`);
    }
    const poll = normalizePoll(pollRes.data?.poll || pollRes.data);
    const resultsRes = await fetchJson(`/polls/${encodeURIComponent(normalizedPollId)}/results`);
    if (!resultsRes.ok) {
      throw new Error(`Unable to load poll results (${normalizedPollId})`);
    }
    const results = normalizeResults(resultsRes.data?.results || resultsRes.data);
    const trend = await fetchTrendForPoll(normalizedPollId);
    const value = {
      locked: false,
      poll,
      results,
      trend,
    };
    state.detail = value;
    state.detailCache.set(normalizedPollId, {
      cachedAt: Date.now(),
      value,
    });
  }

  async function vote(optionIndex) {
    if (!state.detail || state.detail.locked || state.busyVote) return;
    if (!Number.isInteger(optionIndex) || optionIndex < 0) return;
    state.authSnapshot = await resolveAuthSnapshot();
    if (!state.authSnapshot.authenticated) {
      await promptSignIn();
      return;
    }

    state.busyVote = true;
    try {
      const pollId = state.detail.poll.id;
      const response = await fetchJson(`/polls/${encodeURIComponent(pollId)}/vote`, {
        method: 'POST',
        authRequired: true,
        body: { optionIndex },
      });
      if (!response.ok) {
        throw new Error('Vote failed');
      }
      state.detailCache.delete(pollId);
      await fetchDetail(pollId);
    } finally {
      state.busyVote = false;
    }
  }

  function bindActions(root) {
    root.querySelectorAll('[data-dx-polls-tab]').forEach((button) => {
      button.addEventListener('click', async () => {
        const tab = normalizeTab(button.getAttribute('data-dx-polls-tab'));
        if (tab === state.tab) return;
        state.tab = tab;
        state.error = '';
        writeRoute({ tab: state.tab, pollId: state.pollId }, false);
        await refresh(root);
      });
    });

    root.querySelectorAll('[data-dx-poll-signin]').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        await promptSignIn();
      });
    });

    // Opening a poll surfaces the black-glass modal instead of navigating.
    const listCol = root.querySelector('.dx-polls-col--list');
    if (listCol) {
      listCol.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.closest('[data-dx-poll-signin]')) return;
        const opener = target.closest('[data-dx-poll-open]') || target.closest('.dx-poll-card[data-dx-poll-id]');
        if (!opener) return;
        const pollId = opener.getAttribute('data-dx-poll-open') || opener.getAttribute('data-dx-poll-id');
        if (!pollId) return;
        event.preventDefault();
        openPollModal(pollId).catch(() => {});
      });
    }

    const archiveDrawer = root.querySelector('[data-dx-polls-archive-drawer]');
    if (archiveDrawer) {
      archiveDrawer.addEventListener('toggle', () => {
        state.archiveDrawerOpen = Boolean(archiveDrawer.open);
      });
    }

    const prev = root.querySelector('[data-dx-poll-closed-prev]');
    if (prev) {
      prev.addEventListener('click', async () => {
        if (state.closedPage <= 1) return;
        state.closedPage -= 1;
        await refresh(root);
      });
    }

    const next = root.querySelector('[data-dx-poll-closed-next]');
    if (next) {
      next.addEventListener('click', async () => {
        state.closedPage += 1;
        await refresh(root);
      });
    }
  }

  async function hydrateTrendPreviews() {
    if (state.tab !== 'archive') return;
    const targets = state.collections.closed.polls.slice(0, 3);
    if (!targets.length) return;
    await Promise.all(targets.map(async (poll) => {
      if (!poll.id) return;
      const points = await fetchTrendForPoll(poll.id);
      poll.__trendPoints = points;
    }));
  }

  async function refresh(root) {
    state.loading = true;
    render(root);
    bindActions(root);
    try {
      await fetchCollections();
      await hydrateTrendPreviews();
      await fetchDetail(state.pollId);
      state.error = '';
    } catch (error) {
      state.error = error instanceof Error ? error.message : String(error);
    } finally {
      state.loading = false;
      render(root);
      bindActions(root);
      syncModalFromState();
    }
  }

  async function waitMinSheen(startAt) {
    const elapsed = performance.now() - startAt;
    if (elapsed >= DX_MIN_SHEEN_MS) return;
    await new Promise((resolve) => window.setTimeout(resolve, DX_MIN_SHEEN_MS - elapsed));
  }

  async function boot() {
    const root = getRootElement();
    if (!root) return;
    ensureStyles();
    const startAt = performance.now();
    setFetchState(root, 'loading');
    const route = parseRoute(root);
    state.tab = route.tab;
    state.pollId = route.pollId;
    writeRoute({ tab: state.tab, pollId: state.pollId }, true);
    try {
      state.authSnapshot = await resolveAuthSnapshot();
      await refresh(root);
      await waitMinSheen(startAt);
      setFetchState(root, 'ready');
    } catch (error) {
      console.error('[dx-polls] boot error', error);
      renderError(root, 'Unable to load polls right now. Please try again.');
      await waitMinSheen(startAt);
      setFetchState(root, 'error');
    }
  }

  let bootPromise = null;
  let bootQueued = false;
  let lastBootRouteKey = '';

  function getRouteKey() {
    const route = parseRoute(getRootElement());
    const path = normalizePath(window.location.pathname || '/');
    const search = text(window.location.search || '');
    return `${path}?${search}|${route.tab}|${route.pollId}`;
  }

  async function runBootLoop() {
    do {
      bootQueued = false;
      // eslint-disable-next-line no-await-in-loop
      await boot();
      lastBootRouteKey = getRouteKey();
    } while (bootQueued);
  }

  function queueBoot() {
    if (!bootPromise) {
      const root = getRootElement();
      if (root && root.getAttribute('data-dx-fetch-state') === 'ready') {
        const nextRouteKey = getRouteKey();
        if (nextRouteKey === lastBootRouteKey) {
          return Promise.resolve();
        }
      }
    }
    if (bootPromise) {
      bootQueued = true;
      return bootPromise;
    }
    bootPromise = runBootLoop()
      .catch((error) => {
        console.error('[dx-polls] queue boot error', error);
      })
      .finally(() => {
        bootPromise = null;
      });
    return bootPromise;
  }

  window.__dxPollsQueueBoot = queueBoot;
  window.addEventListener('dx:slotready', () => {
    queueBoot().catch(() => {});
  }, { once: true });
  window.addEventListener('popstate', () => {
    const root = getRootElement();
    if (!root) return;
    const route = parseRoute(root);
    // A tab change rebuilds the list; otherwise just sync the modal so back/forward
    // open and close it without reloading the whole route.
    if (route.tab !== state.tab) {
      queueBoot().catch(() => {});
      return;
    }
    if (route.pollId === state.pollId) return;
    if (route.pollId) {
      openPollModal(route.pollId, { push: false }).catch(() => {});
    } else {
      closePollModal({ push: false });
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      queueBoot().catch(() => {});
    }, { once: true });
  } else {
    queueBoot().catch(() => {});
  }
})();
