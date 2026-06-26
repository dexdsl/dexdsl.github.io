import { animate } from 'framer-motion/dom';

(() => {
  if (typeof window === 'undefined') return;
  if (window.__dxPressroomRuntimeLoaded) {
    if (typeof window.__dxPressroomMount === 'function') {
      try {
        window.__dxPressroomMount();
      } catch {}
    }
    return;
  }
  window.__dxPressroomRuntimeLoaded = true;

  const FETCH_STATE_LOADING = 'loading';
  const FETCH_STATE_READY = 'ready';
  const FETCH_STATE_ERROR = 'error';
  const DX_MIN_SHEEN_MS = 120;
  const AUTH_TIMEOUT_MS = 3600;
  const WORKER_TIMEOUT_MS = 9000;
  const SUBMIT_TIMEOUT_MS = 15000;
  const PREFETCH_SWR_MS = 60000;
  const DEFAULT_API = 'https://dex-api.spring-fog-8edd.workers.dev';
  const DEFAULT_MONTHLY_LIMIT = 1;

  const STEPS = [
    { key: 'compose', title: 'Compose Request', short: 'Compose' },
    { key: 'review', title: 'Review + Send', short: 'Review' },
    { key: 'done', title: 'Done', short: 'Done' },
  ];
  const STEP_COMPOSE = 0;
  const STEP_REVIEW = 1;
  const STEP_DONE = 2;
  const REQUIRED_FIELDS = [
    ['name', 'Enter your contact name.'],
    ['email', 'Enter a contact email.'],
    ['project', 'Enter a project title.'],
    ['desc', 'Add a project description.'],
    ['links', 'Add at least one source link.'],
    ['budget', 'Enter a budget estimate.'],
    ['timeframe', 'Enter a preferred timeframe.'],
  ];
  const ADVANCED_FIELDS = new Set(['links', 'budget', 'timeline', 'timeframe']);

  const STATUS_ORDER = ['submitted', 'triage', 'in_review', 'needs_info', 'approved', 'closed'];
  const STATUS_LABELS = {
    submitted: 'Submitted',
    triage: 'Triage',
    in_review: 'In review',
    needs_info: 'Needs info',
    approved: 'Approved',
    closed: 'Closed',
  };

  const EVENT_LABELS = {
    submitted: 'Submitted',
    request_submitted: 'Submitted',
    triage: 'Triage',
    in_review: 'In review',
    needs_info: 'Needs info',
    approved: 'Approved',
    closed: 'Closed',
    public_note: 'Update',
    internal_note: 'Internal note',
  };

  const PREFETCH_KEY_PREFIX = 'pressQuota:';

  let state = null;
  let refs = null;
  let liveRoot = null;
  let hydrationPromise = null;

  function text(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
  }

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function parseTimestamp(value) {
    const parsed = Date.parse(String(value || ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatDateTime(value) {
    const ts = parseTimestamp(value);
    if (ts === null) return 'Unknown time';
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return new Date(ts).toISOString();
    }
  }

  function formatDate(value) {
    const ts = parseTimestamp(value);
    if (ts === null) return 'Unknown date';
    try {
      return new Date(ts).toLocaleDateString();
    } catch {
      return new Date(ts).toISOString().slice(0, 10);
    }
  }

  function withTimeout(promise, timeoutMs, fallback) {
    let timer = 0;
    return Promise.race([
      Promise.resolve(promise),
      new Promise((resolve) => {
        timer = window.setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]).finally(() => {
      if (timer) window.clearTimeout(timer);
    });
  }

  function delay(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, Math.max(0, ms));
    });
  }

  function prefersReducedMotion() {
    try {
      return !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }

  function create(tagName, className = '', textContent = '') {
    const node = document.createElement(tagName);
    if (className) node.className = className;
    if (textContent) node.textContent = textContent;
    return node;
  }

  function setFetchState(root, nextState) {
    if (!root) return;
    root.setAttribute('data-dx-fetch-state', nextState);
    if (nextState === FETCH_STATE_LOADING) {
      root.setAttribute('aria-busy', 'true');
    } else {
      root.removeAttribute('aria-busy');
    }
  }

  async function finalizeFetchState(root, startTs, targetState) {
    if (!root) return;
    const elapsed = performance.now() - startTs;
    if (elapsed < DX_MIN_SHEEN_MS) {
      await delay(DX_MIN_SHEEN_MS - elapsed);
    }
    setFetchState(root, targetState);
  }

  function toConfig(root) {
    const dataset = root && root.dataset ? root.dataset : {};
    const runtime = typeof window.__DX_PRESSROOM_CONFIG === 'object' && window.__DX_PRESSROOM_CONFIG
      ? window.__DX_PRESSROOM_CONFIG
      : {};
    const configuredApi = text(runtime.apiBase || dataset.api || window.DEX_API_BASE_URL || window.DEX_API_ORIGIN, '');
    const configuredLimit = number(dataset.monthlyLimit, DEFAULT_MONTHLY_LIMIT);
    return {
      apiBase: (configuredApi || DEFAULT_API).replace(/\/+$/, ''),
      monthlyLimit: Math.max(1, configuredLimit),
    };
  }

  function createInitialForm() {
    return {
      name: '',
      email: '',
      project: '',
      desc: '',
      links: '',
      budget: '',
      timeline: '',
      timeframe: '',
    };
  }

  // --- Draft persistence (localStorage; survives refresh) ---
  const PRESS_DRAFT_PREFIX = 'dex:press:draft:v1';
  const PRESS_FORM_STEP_MAX = STEPS.length - 2; // steps 0..review persist; last is "done"
  let pressDraftTimer = 0;

  function pressDraftKey(sub) {
    const safeSub = text(sub, '') || 'anon';
    return `${PRESS_DRAFT_PREFIX}:${safeSub}`;
  }

  function readPressDraft(sub) {
    try {
      const raw = window.localStorage.getItem(pressDraftKey(sub));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.form || typeof parsed.form !== 'object') return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function writePressDraft(sub, form, step) {
    try {
      const safeStep = Number.isFinite(step) ? Math.max(0, Math.min(PRESS_FORM_STEP_MAX, step)) : 0;
      window.localStorage.setItem(pressDraftKey(sub), JSON.stringify({ form, step: safeStep, savedAt: Date.now() }));
    } catch {}
  }

  function clearPressDraft(sub) {
    try {
      window.localStorage.removeItem(pressDraftKey(sub));
    } catch {}
  }

  function clearActivePressDrafts() {
    if (!state) return;
    clearPressDraft(state.auth0Sub);
    clearPressDraft('');
  }

  function schedulePressDraftSave() {
    if (!state || pressDraftTimer) return;
    pressDraftTimer = window.setTimeout(() => {
      pressDraftTimer = 0;
      if (!state) return;
      if (state.step >= STEPS.length - 1) {
        clearPressDraft(state.auth0Sub);
        return;
      }
      writePressDraft(state.auth0Sub, state.form, state.step);
    }, 400);
  }

  function pressFormIsPristine() {
    if (!state) return true;
    const base = createInitialForm();
    return state.step === 0 && Object.keys(base).every((key) => !text(state.form[key]));
  }

  function hydratePressDraft(sub) {
    if (!state) return false;
    const stored = readPressDraft(sub);
    if (!stored) return false;
    const base = createInitialForm();
    state.form = { ...base, ...(stored.form && typeof stored.form === 'object' ? stored.form : {}) };
    if (Number.isFinite(stored.step)) {
      state.step = Math.max(0, Math.min(PRESS_FORM_STEP_MAX, stored.step));
    }
    return true;
  }

  function reconcilePressDraftForSub(sub) {
    const safeSub = text(sub, '');
    if (!safeSub || !state) return;
    if (!readPressDraft(safeSub)) {
      const anon = readPressDraft('');
      if (anon) {
        writePressDraft(safeSub, anon.form, anon.step);
        clearPressDraft('');
      }
    }
    if (pressFormIsPristine()) hydratePressDraft(safeSub);
  }

  function makeState(config) {
    return {
      step: 0,
      prevStep: 0,
      auth0Sub: text(window.auth0Sub, ''),
      authUser: null,
      authResolved: false,
      apiBase: config.apiBase,
      form: createInitialForm(),
      ui: { advancedOpen: false },
      stepError: '',
      fieldErrors: {},
      submitError: '',
      isSubmitting: false,
      monthlyLimit: config.monthlyLimit,
      monthlyUsed: 0,
      monthlyRemaining: 0,
      monthStart: '',
      monthEnd: '',
      quotaResolved: false,
      quotaSource: 'none',
      quotaError: '',
      requests: [],
      requestsLoading: false,
      requestsError: '',
      activeRequestId: '',
      eventsByRequest: new Map(),
      eventsLoadingByRequest: new Map(),
      eventsErrorByRequest: new Map(),
      lastRequestId: '',
      lastRow: '',
    };
  }

  function normalizeStatus(value) {
    const raw = text(value, '').toLowerCase().replace(/[\s-]+/g, '_');
    if (STATUS_ORDER.includes(raw)) return raw;
    return 'submitted';
  }

  function statusLabel(value) {
    const normalized = normalizeStatus(value);
    return STATUS_LABELS[normalized] || STATUS_LABELS.submitted;
  }

  function eventLabel(value) {
    const normalized = text(value, '').toLowerCase();
    return EVENT_LABELS[normalized] || statusLabel(normalized);
  }

  function getAuthRuntime() {
    return window.DEX_AUTH || window.dexAuth || null;
  }

  async function resolveAuthSnapshot(timeoutMs = AUTH_TIMEOUT_MS) {
    const auth = getAuthRuntime();
    if (!auth) {
      return {
        authenticated: false,
        user: null,
        sub: text(window.auth0Sub || window.AUTH0_USER?.sub, ''),
      };
    }

    try {
      if (typeof auth.resolve === 'function') {
        await withTimeout(auth.resolve(timeoutMs), timeoutMs, null);
      } else if (auth.ready && typeof auth.ready.then === 'function') {
        await withTimeout(auth.ready, timeoutMs, null);
      }
    } catch {}

    let authenticated = false;
    try {
      if (typeof auth.isAuthenticated === 'function') {
        authenticated = !!(await withTimeout(auth.isAuthenticated(), timeoutMs, false));
      } else if (auth.ready && typeof auth.ready.then === 'function') {
        const readyPayload = await withTimeout(auth.ready, timeoutMs, null);
        authenticated = !!(readyPayload && readyPayload.isAuthenticated);
      }
    } catch {
      authenticated = false;
    }

    let user = null;
    try {
      if (typeof auth.getUser === 'function') {
        user = await withTimeout(auth.getUser(), timeoutMs, null);
      }
    } catch {
      user = null;
    }

    const sub = text(user?.sub || window.auth0Sub || window.AUTH0_USER?.sub, '');
    return { authenticated, user, sub };
  }

  async function resolveAccessToken(timeoutMs = WORKER_TIMEOUT_MS) {
    const auth = getAuthRuntime();
    if (!auth || typeof auth.getAccessToken !== 'function') return '';
    try {
      if (typeof auth.resolve === 'function') {
        await withTimeout(auth.resolve(Math.min(timeoutMs, AUTH_TIMEOUT_MS)), Math.min(timeoutMs, AUTH_TIMEOUT_MS), null);
      } else if (auth.ready && typeof auth.ready.then === 'function') {
        await withTimeout(auth.ready, Math.min(timeoutMs, AUTH_TIMEOUT_MS), null);
      }
    } catch {}
    try {
      const token = await withTimeout(auth.getAccessToken(), timeoutMs, '');
      return text(token, '');
    } catch {
      return '';
    }
  }

  async function fetchWorkerJson(pathname, options = {}) {
    const opts = options && typeof options === 'object' ? options : {};
    if (!state || !text(state.apiBase)) throw new Error('Missing PressRoom API endpoint.');
    const token = opts.token || await resolveAccessToken(opts.timeoutMs || WORKER_TIMEOUT_MS);
    if (!token) throw new Error('Sign in again to refresh your PressRoom session.');
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeout = window.setTimeout(() => {
      if (controller) controller.abort();
    }, Math.max(500, Number(opts.timeoutMs || WORKER_TIMEOUT_MS)));
    try {
      const response = await fetch(`${state.apiBase}${pathname}`, {
        method: opts.method || 'GET',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${token}`,
          ...(opts.body ? { 'content-type': 'application/json' } : {}),
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: controller?.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorMessageFromPayload(payload, response.statusText || 'PressRoom request failed.'));
      return payload;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function getPrefetchRuntime() {
    const runtime = window.__DX_PREFETCH;
    if (!runtime || typeof runtime.getFresh !== 'function' || typeof runtime.set !== 'function') return null;
    return runtime;
  }

  function getQuotaPrefetchKey(scope) {
    return `${PREFETCH_KEY_PREFIX}${scope}`;
  }

  function parseQuotaPayload(payload) {
    if (!payload || typeof payload !== 'object') return null;
    if (text(payload.status, '').toLowerCase() === 'error') return null;

    const monthlyLimit = clamp(number(payload.monthlyLimit, DEFAULT_MONTHLY_LIMIT), 1, 12);
    const monthlyUsed = Math.max(0, number(payload.monthlyUsed, 0));
    const fallbackRemaining = Math.max(0, monthlyLimit - monthlyUsed);
    const monthlyRemaining = clamp(number(payload.monthlyRemaining, fallbackRemaining), 0, monthlyLimit);

    return {
      monthlyLimit,
      monthlyUsed,
      monthlyRemaining,
      monthStart: text(payload.monthStart, ''),
      monthEnd: text(payload.monthEnd, ''),
      updatedAt: text(payload.updatedAt, nowIso()),
    };
  }

  function readCachedQuota(scope) {
    const prefetch = getPrefetchRuntime();
    if (!prefetch || !scope) return null;
    const cached = prefetch.getFresh(getQuotaPrefetchKey(scope), PREFETCH_SWR_MS);
    if (!cached || !cached.payload || typeof cached.payload !== 'object') return null;
    return parseQuotaPayload(cached.payload);
  }

  function writeCachedQuota(scope, payload) {
    const prefetch = getPrefetchRuntime();
    if (!prefetch || !scope || !payload) return;
    prefetch.set(getQuotaPrefetchKey(scope), payload, { scope });
  }

  function setQuotaSource(source) {
    if (!liveRoot) return;
    liveRoot.setAttribute('data-dx-press-quota-source', text(source, 'none'));
  }

  function applyQuotaPayload(payload, source) {
    const parsed = parseQuotaPayload(payload);
    if (!parsed || !state) return false;
    state.monthlyLimit = parsed.monthlyLimit;
    state.monthlyUsed = parsed.monthlyUsed;
    state.monthlyRemaining = parsed.monthlyRemaining;
    state.monthStart = parsed.monthStart;
    state.monthEnd = parsed.monthEnd;
    state.quotaResolved = true;
    state.quotaError = '';
    state.quotaSource = text(source, state.quotaSource || 'none');
    setQuotaSource(state.quotaSource);
    return true;
  }

  function normalizeRequestRow(row, index) {
    const value = row && typeof row === 'object' ? row : {};
    const requestId = text(value.requestId, text(value.submissionId, text(value.id, `REQ-${index + 1}`)));
    const status = normalizeStatus(value.status);
    const timestamp = text(value.clientSubmittedAt || value.timestamp || value.updatedAt, nowIso());
    return {
      row: number(value.row, index + 2),
      requestId,
      status,
      timestamp,
      updatedAt: text(value.updatedAt, timestamp),
      name: text(value.name, ''),
      email: text(value.email, ''),
      project: text(value.project, 'Untitled request'),
      desc: text(value.desc, ''),
      links: text(value.links, ''),
      budget: text(value.budget, ''),
      timeline: text(value.timeline, ''),
      timeframe: text(value.timeframe, ''),
      publicNote: text(value.publicNote, text(value.notes, '')),
      internalNote: text(value.internalNote, ''),
    };
  }

  function sortRequestsDesc(a, b) {
    const aTs = parseTimestamp(a?.timestamp);
    const bTs = parseTimestamp(b?.timestamp);
    if (aTs === null && bTs === null) return 0;
    if (aTs === null) return 1;
    if (bTs === null) return -1;
    return bTs - aTs;
  }

  function normalizeEventRecord(row, index) {
    const value = row && typeof row === 'object' ? row : {};
    const eventTimestamp = text(value.eventTimestamp || value.timestamp || value.createdAt, nowIso());
    const eventType = text(value.eventType, 'submitted').toLowerCase();
    const sourceEventKey = text(value.sourceEventKey, '');
    const metadataJson = text(value.metadataJson, '');

    let metadata = {};
    if (metadataJson) {
      try {
        const parsed = JSON.parse(metadataJson);
        if (parsed && typeof parsed === 'object') metadata = parsed;
      } catch {
        metadata = {};
      }
    }

    return {
      row: number(value.row, index + 2),
      eventId: text(value.eventId, `evt-${index + 1}`),
      eventTimestamp,
      eventType,
      statusRaw: text(value.statusRaw, ''),
      publicNote: text(value.publicNote, ''),
      internalNote: text(value.internalNote, ''),
      actorType: text(value.actorType, ''),
      actorId: text(value.actorId, ''),
      sourceEventKey,
      metadata,
    };
  }

  function dedupeEvents(records) {
    const seen = new Set();
    const out = [];
    for (const record of records) {
      const dedupeKey = text(
        record.sourceEventKey,
        `${record.eventType}|${record.eventTimestamp}|${record.statusRaw}|${record.publicNote}`,
      );
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      out.push(record);
    }
    out.sort((a, b) => {
      const aTs = parseTimestamp(a.eventTimestamp);
      const bTs = parseTimestamp(b.eventTimestamp);
      if (aTs === null && bTs === null) return 0;
      if (aTs === null) return 1;
      if (bTs === null) return -1;
      return bTs - aTs;
    });
    return out;
  }

  function getQuotaSummaryText() {
    if (!state) return 'Monthly requests available: checking your account quota...';
    if (!state.auth0Sub) {
      return 'Monthly requests available: sign in to verify your account quota.';
    }
    if (!state.quotaResolved) {
      if (state.quotaError) {
        return 'Monthly requests available: quota verification failed. Retry in a moment.';
      }
      return 'Monthly requests available: checking your account quota...';
    }
    return `Monthly requests available: ${state.monthlyRemaining} / ${state.monthlyLimit}`;
  }

  function getQuotaDetailText() {
    if (!state) return '';
    if (state.monthStart && state.monthEnd) {
      return `Window ${formatDate(state.monthStart)} - ${formatDate(state.monthEnd)}`;
    }
    return 'One request per calendar month per account.';
  }

  function currentStep() {
    return STEPS[state?.step || 0] || STEPS[0];
  }

  function canBegin() {
    if (!state) return false;
    if (state.isSubmitting) return false;
    if (!state.auth0Sub) return false;
    if (!state.quotaResolved) return false;
    return state.monthlyRemaining > 0;
  }

  function lockUiFlag() {
    return !!(state && state.isSubmitting);
  }

  function requiredChecklist() {
    if (!state) return [];
    return [
      { label: 'Contact name', done: !!text(state.form.name, '') },
      { label: 'Contact email', done: !!text(state.form.email, '') },
      { label: 'Project title', done: !!text(state.form.project, '') },
      { label: 'Project description', done: !!text(state.form.desc, '') },
      { label: 'Source links', done: !!text(state.form.links, '') },
      { label: 'Budget estimate', done: !!text(state.form.budget, '') },
      { label: 'Preferred timeframe', done: !!text(state.form.timeframe, '') },
    ];
  }

  function progressValue() {
    if (!state) return 0;
    return clamp((state.step + 1) / STEPS.length, 0, 1);
  }

  function animateProgressFill() {
    if (!refs?.progressFill || !state) return;
    const target = progressValue();
    if (prefersReducedMotion()) {
      refs.progressFill.style.transform = `scaleX(${target})`;
      state.prevStep = state.step;
      return;
    }

    try {
      animate(
        refs.progressFill,
        { transform: `scaleX(${target})` },
        { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
      );
    } catch {
      refs.progressFill.style.transform = `scaleX(${target})`;
    }
    state.prevStep = state.step;
  }

  function animateStepCard(card) {
    if (!card || prefersReducedMotion()) return;
    try {
      animate(
        card,
        { opacity: [0, 1], y: [10, 0] },
        { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
      );
    } catch {}
  }

  function createStepChip(step, index) {
    const chip = create('button', 'dx-press-step-chip', step.short);
    chip.type = 'button';
    chip.disabled = true;
    if (index === state.step) chip.classList.add('is-active');
    if (index < state.step) chip.classList.add('is-done');
    chip.setAttribute('aria-current', index === state.step ? 'step' : 'false');
    return chip;
  }

  function createField(label, inputNode, options = {}) {
    const field = create('label', 'dx-press-field');
    const title = create('span', 'dx-press-field-label', label);
    if (options.required) {
      const req = create('span', 'dx-press-required', ' *');
      title.appendChild(req);
    }
    field.appendChild(title);
    field.appendChild(inputNode);
    const key = text(options.fieldKey, '');
    if (key) field.setAttribute('data-dx-field', key);
    const errMsg = key ? text(state?.fieldErrors?.[key], '') : '';
    if (errMsg) {
      field.classList.add('has-error');
      const err = create('p', 'dx-press-field-error', errMsg);
      err.setAttribute('role', 'alert');
      field.appendChild(err);
      const clearOnce = () => {
        field.classList.remove('has-error');
        if (err.parentNode) err.remove();
        if (state && state.fieldErrors) delete state.fieldErrors[key];
        field.removeEventListener('input', clearOnce);
        field.removeEventListener('change', clearOnce);
      };
      field.addEventListener('input', clearOnce);
      field.addEventListener('change', clearOnce);
    }
    return field;
  }

  function createInput(type, value, placeholder, onInput) {
    const input = document.createElement('input');
    input.type = type;
    input.className = 'dx-press-input';
    input.value = value;
    input.placeholder = placeholder || '';
    input.disabled = lockUiFlag();
    input.addEventListener('input', (event) => {
      onInput(event);
      schedulePressDraftSave();
    });
    return input;
  }

  function createTextarea(value, placeholder, onInput) {
    const input = document.createElement('textarea');
    input.className = 'dx-press-input dx-press-input--textarea';
    input.value = value;
    input.placeholder = placeholder || '';
    input.disabled = lockUiFlag();
    input.addEventListener('input', (event) => {
      onInput(event);
      schedulePressDraftSave();
    });
    return input;
  }

  function createButton(label, variant = 'primary', onClick) {
    const classes = ['dx-button-element', variant === 'secondary' ? 'dx-button-element--secondary' : 'dx-button-element--primary', 'dx-button-size--md'];
    const button = create('button', classes.join(' '), label);
    button.type = 'button';
    button.disabled = lockUiFlag();
    if (typeof onClick === 'function') {
      button.addEventListener('click', onClick);
    }
    return button;
  }

  function createErrorBanner(message) {
    const banner = create('div', 'dx-press-error');
    banner.setAttribute('role', 'alert');
    banner.appendChild(create('strong', 'dx-press-error-title', 'Action required'));
    banner.appendChild(create('p', 'dx-press-error-copy', message));
    return banner;
  }

  // Returns a per-field error map for all required fields (empty when valid).
  // The compose step gathers every field, so validation is gathered too.
  function validateAllRequired() {
    const errors = {};
    if (!state) return errors;
    for (const [key, message] of REQUIRED_FIELDS) {
      if (!text(state.form[key])) errors[key] = message;
    }
    return errors;
  }

  function setStep(nextStep) {
    if (!state) return;
    if (state.isSubmitting) return;
    const bounded = clamp(Number(nextStep), 0, STEPS.length - 1);
    if (bounded === state.step) {
      renderStep();
      return;
    }
    state.step = bounded;
    state.stepError = '';
    state.fieldErrors = {};
    schedulePressDraftSave();
    renderProgress();
    renderStep();
    renderCommandPanel();
  }

  function goNext() {
    if (!state) return;
    const errors = validateAllRequired();
    const keys = Object.keys(errors);
    if (keys.length) {
      state.fieldErrors = errors;
      state.stepError = 'Complete the required fields before continuing.';
      // Make sure the disclosure that holds an invalid field is open.
      if (state.ui) state.ui.advancedOpen = state.ui.advancedOpen || keys.some((k) => ADVANCED_FIELDS.has(k));
      renderStep();
      const firstInvalid = liveRoot?.querySelector('.dx-press-field.has-error .dx-press-input');
      if (firstInvalid instanceof HTMLElement) {
        try { firstInvalid.focus({ preventScroll: false }); } catch {}
      }
      return;
    }
    state.fieldErrors = {};
    setStep(STEP_REVIEW);
  }

  function goPrev() {
    if (!state) return;
    setStep(state.step - 1);
  }

  function normalizeAppendPayload() {
    if (!state) return null;
    const payload = {
      auth0Sub: state.auth0Sub,
      requestId: (window.crypto && typeof window.crypto.randomUUID === 'function')
        ? window.crypto.randomUUID()
        : `req-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      clientSubmittedAt: nowIso(),
      name: state.form.name,
      email: state.form.email,
      project: state.form.project,
      desc: state.form.desc,
      links: state.form.links,
      budget: state.form.budget,
      timeline: state.form.timeline,
      timeframe: state.form.timeframe,
    };
    return payload;
  }

  function errorMessageFromPayload(payload, fallback) {
    if (payload && typeof payload === 'object') {
      const status = text(payload.status, '').toLowerCase();
      if (status === 'error') {
        const message = text(payload.message, fallback);
        const code = text(payload.code, '');
        if (code) return `${message} (${code})`;
        return message;
      }
    }
    return fallback;
  }

  async function refreshMonthlyQuota(options = {}) {
    if (!state || !state.auth0Sub) return false;
    const opts = options && typeof options === 'object' ? options : {};

    if (opts.useCache) {
      const cached = readCachedQuota(state.auth0Sub);
      if (cached && applyQuotaPayload(cached, 'cache')) {
        renderCommandPanel();
        if (state.step === 0) renderStep();
      }
    }

    try {
      const payload = await fetchWorkerJson('/me/press-requests/quota', {
        timeoutMs: WORKER_TIMEOUT_MS,
      });

      if (!applyQuotaPayload(payload, 'live')) {
        throw new Error(errorMessageFromPayload(payload, 'Could not verify monthly quota right now.'));
      }

      writeCachedQuota(state.auth0Sub, {
        monthlyLimit: state.monthlyLimit,
        monthlyUsed: state.monthlyUsed,
        monthlyRemaining: state.monthlyRemaining,
        monthStart: state.monthStart,
        monthEnd: state.monthEnd,
        updatedAt: nowIso(),
      });

      renderCommandPanel();
      if (state.step === 0) renderStep();
      return true;
    } catch (error) {
      state.quotaError = text(error?.message, 'Could not verify monthly quota right now.');
      if (!state.quotaResolved) {
        state.quotaSource = 'none';
        setQuotaSource('none');
      }
      renderCommandPanel();
      if (state.step === 0) renderStep();
      return false;
    }
  }

  async function loadRequests(options = {}) {
    if (!state || !state.auth0Sub) return false;
    const opts = options && typeof options === 'object' ? options : {};

    state.requestsLoading = true;
    state.requestsError = '';
    renderHistory();
    renderCommandPanel();

    try {
      const payload = await fetchWorkerJson('/me/press-requests?limit=100', {
        timeoutMs: WORKER_TIMEOUT_MS,
      });

      const status = text(payload?.status, '').toLowerCase();
      if (status !== 'ok' || !Array.isArray(payload?.rows)) {
        throw new Error(errorMessageFromPayload(payload, 'Could not load request history right now.'));
      }

      state.requests = payload.rows.map(normalizeRequestRow).sort(sortRequestsDesc);
      if (!state.activeRequestId && state.requests.length > 0) {
        state.activeRequestId = state.requests[0].requestId;
      }
      state.requestsLoading = false;
      state.requestsError = '';
      renderHistory();
      renderCommandPanel();

      if (state.activeRequestId) {
        loadEventsForRequest(state.activeRequestId).catch(() => {});
      }
      return true;
    } catch (error) {
      state.requestsLoading = false;
      state.requestsError = text(error?.message, 'Could not load request history right now.');
      renderHistory();
      renderCommandPanel();
      return false;
    }
  }

  function selectedRequest() {
    if (!state || !state.activeRequestId) return null;
    return state.requests.find((item) => item.requestId === state.activeRequestId) || null;
  }

  async function loadEventsForRequest(requestId, options = {}) {
    if (!state || !state.auth0Sub) return false;
    const safeRequestId = text(requestId, '');
    if (!safeRequestId) return false;

    const opts = options && typeof options === 'object' ? options : {};
    const alreadyLoaded = state.eventsByRequest.has(safeRequestId);
    if (alreadyLoaded && !opts.force) {
      renderHistory();
      return true;
    }

    state.eventsLoadingByRequest.set(safeRequestId, true);
    state.eventsErrorByRequest.delete(safeRequestId);
    renderHistory();

    try {
      const payload = await fetchWorkerJson(`/me/press-requests/${encodeURIComponent(safeRequestId)}/events`, {
        timeoutMs: WORKER_TIMEOUT_MS,
      });

      const status = text(payload?.status, '').toLowerCase();
      if (status !== 'ok' || !Array.isArray(payload?.events)) {
        throw new Error(errorMessageFromPayload(payload, 'Could not load lifecycle events right now.'));
      }

      const records = dedupeEvents(payload.events.map(normalizeEventRecord));
      state.eventsByRequest.set(safeRequestId, records);
      state.eventsErrorByRequest.delete(safeRequestId);
      state.eventsLoadingByRequest.set(safeRequestId, false);
      renderHistory();
      return true;
    } catch (error) {
      state.eventsLoadingByRequest.set(safeRequestId, false);
      state.eventsErrorByRequest.set(
        safeRequestId,
        text(error?.message, 'Lifecycle events are temporarily unavailable.'),
      );
      renderHistory();
      return false;
    }
  }

  async function submitRequest() {
    if (!state || state.isSubmitting) return;

    const errors = validateAllRequired();
    if (Object.keys(errors).length) {
      state.fieldErrors = errors;
      state.stepError = 'Complete the required fields before continuing.';
      if (state.ui) state.ui.advancedOpen = true;
      setStep(STEP_COMPOSE);
      return;
    }

    state.stepError = '';
    state.submitError = '';
    state.isSubmitting = true;
    if (liveRoot) liveRoot.setAttribute('data-dx-press-submitting', 'true');
    renderStep();
    renderCommandPanel();

    try {
      const quotaReady = await refreshMonthlyQuota({ useCache: false, forceLive: true });
      if (!quotaReady || !state.quotaResolved) {
        throw new Error('Could not verify monthly quota right now. Please retry in a moment.');
      }
      if (state.monthlyRemaining <= 0) {
        throw new Error('Monthly request limit reached. Your next request window opens next month.');
      }

      const payload = normalizeAppendPayload();
      const appendPayload = await fetchWorkerJson('/me/press-requests', {
        method: 'POST',
        body: payload,
        timeoutMs: SUBMIT_TIMEOUT_MS,
      });

      const appendStatus = text(appendPayload?.status, '').toLowerCase();
      if (appendStatus !== 'ok') {
        throw new Error(errorMessageFromPayload(appendPayload, 'Request submission failed.'));
      }

      state.lastRequestId = text(appendPayload?.requestId, text(payload?.requestId, ''));
      state.lastRow = text(appendPayload?.row, '');
      state.form = createInitialForm();
      clearActivePressDrafts();

      await loadRequests({ forceLive: true });
      if (state.lastRequestId) {
        state.activeRequestId = state.lastRequestId;
        await loadEventsForRequest(state.lastRequestId, { force: true });
      }
      await refreshMonthlyQuota({ useCache: false, forceLive: true });

      state.submitError = '';
      state.step = STEPS.findIndex((step) => step.key === 'done');
      if (state.step < 0) state.step = STEPS.length - 1;
      renderProgress();
      renderStep();
      renderCommandPanel();
      renderHistory();
    } catch (error) {
      state.submitError = text(error?.message, 'Request submission failed. Please retry.');
      state.step = STEPS.findIndex((step) => step.key === 'review');
      if (state.step < 0) state.step = Math.max(0, STEPS.length - 2);
      renderProgress();
      renderStep();
      renderCommandPanel();
    } finally {
      state.isSubmitting = false;
      if (liveRoot) liveRoot.removeAttribute('data-dx-press-submitting');
      renderStep();
      renderCommandPanel();
    }
  }

  function renderProgress() {
    if (!refs || !state) return;
    refs.progressRow.innerHTML = '';
    for (let i = 0; i < STEPS.length; i += 1) {
      refs.progressRow.appendChild(createStepChip(STEPS[i], i));
    }
    animateProgressFill();
  }

  function pressTextField(label, key, placeholder, opts = {}) {
    const input = createInput(opts.type || 'text', state.form[key], placeholder, (event) => { state.form[key] = event.target.value; });
    if (opts.autocomplete) input.autocomplete = opts.autocomplete;
    return createField(label, input, { required: !!opts.required, fieldKey: key });
  }

  function pressTextareaField(label, key, placeholder, required) {
    const input = createTextarea(state.form[key], placeholder, (event) => { state.form[key] = event.target.value; });
    return createField(label, input, { required: !!required, fieldKey: key });
  }

  function renderComposeStep(hostCard) {
    hostCard.appendChild(create('p', 'dx-press-copy', 'Submit editorial pitches, collaboration requests, and campaign proposals. One request per calendar month per account.'));

    if (!state.auth0Sub) {
      hostCard.appendChild(createErrorBanner('Sign in to start a PressRoom request.'));
    } else if (!state.quotaResolved && state.quotaError) {
      hostCard.appendChild(createErrorBanner(state.quotaError));
    } else if (state.quotaResolved && state.monthlyRemaining <= 0) {
      hostCard.appendChild(createErrorBanner('Monthly request limit reached for this account.'));
    }

    const essentials = create('section', 'dx-press-group');
    essentials.appendChild(create('p', 'dx-press-group-label', 'Essentials'));
    const grid = create('div', 'dx-press-grid');
    grid.append(
      pressTextField('Contact name', 'name', 'Your name', { required: true, autocomplete: 'name' }),
      pressTextField('Contact email', 'email', 'name@example.com', { required: true, type: 'email', autocomplete: 'email' }),
    );
    essentials.appendChild(grid);
    essentials.appendChild(pressTextField('Project title', 'project', 'Project title', { required: true }));
    essentials.appendChild(pressTextareaField('Project description', 'desc', 'Scope, goals, and the editorial angle or support you want.', true));
    hostCard.appendChild(essentials);

    const advanced = create('details', 'dx-press-advanced');
    advanced.open = !!(state.ui && state.ui.advancedOpen);
    advanced.addEventListener('toggle', () => { if (!state.ui) state.ui = {}; state.ui.advancedOpen = advanced.open; });
    advanced.appendChild(create('summary', 'dx-press-advanced-summary', 'Links, budget & scheduling'));
    advanced.appendChild(pressTextareaField('Source links', 'links', 'One link per line — public, clearly named.', true));
    const advGrid = create('div', 'dx-press-grid');
    advGrid.append(
      pressTextField('Budget (USD)', 'budget', '$2,500', { required: true }),
      pressTextField('Preferred timeframe', 'timeframe', 'Desired release window', { required: true }),
      pressTextField('Timeline (optional)', 'timeline', 'Milestones and deadlines'),
    );
    advanced.appendChild(advGrid);
    hostCard.appendChild(advanced);

    if (state.stepError) hostCard.appendChild(createErrorBanner(state.stepError));

    const footer = create('div', 'dx-press-nav');
    const cont = createButton('Continue to review', 'primary', goNext);
    cont.setAttribute('data-dx-press-continue', 'compose');
    if (!canBegin()) {
      cont.disabled = true;
      cont.classList.add('is-disabled');
    }
    footer.appendChild(cont);
    hostCard.appendChild(footer);
  }

  function addReviewRow(parent, label, value) {
    const row = create('div', 'dx-press-review-row');
    row.appendChild(create('dt', 'dx-press-review-label', label));
    row.appendChild(create('dd', 'dx-press-review-value', text(value, '-')));
    parent.appendChild(row);
  }

  function renderReviewStep(hostCard) {
    hostCard.appendChild(create('p', 'dx-press-copy', 'Confirm request details, then submit for PressOps triage.'));

    const review = create('dl', 'dx-press-review');
    addReviewRow(review, 'Contact', `${text(state.form.name, 'Unknown')} (${text(state.form.email, 'n/a')})`);
    addReviewRow(review, 'Project', state.form.project);
    addReviewRow(review, 'Description', state.form.desc);
    addReviewRow(review, 'Links', state.form.links);
    addReviewRow(review, 'Budget', state.form.budget);
    addReviewRow(review, 'Timeline', state.form.timeline);
    addReviewRow(review, 'Timeframe', state.form.timeframe);
    hostCard.appendChild(review);

    if (state.submitError) {
      hostCard.appendChild(createErrorBanner(state.submitError));
    }

    const footer = create('div', 'dx-press-nav');
    footer.appendChild(createButton('Back', 'secondary', goPrev));
    const submit = createButton('Submit request', 'primary', () => {
      submitRequest().catch(() => {});
    });
    submit.disabled = lockUiFlag();
    footer.appendChild(submit);
    hostCard.appendChild(footer);
  }

  function renderDoneStep(hostCard) {
    hostCard.appendChild(create('p', 'dx-press-copy', 'Request submitted successfully. PressOps will update status in this timeline.'));

    const doneBlock = create('div', 'dx-press-done');
    doneBlock.appendChild(create('h3', 'dx-press-done-title', 'Submission Complete'));
    const requestRef = text(state.lastRequestId, text(state.activeRequestId, 'Pending assignment'));
    doneBlock.appendChild(create('p', 'dx-press-done-copy', `Request ID: ${requestRef}`));
    doneBlock.appendChild(create('p', 'dx-press-done-copy', getQuotaSummaryText()));
    hostCard.appendChild(doneBlock);

    const footer = create('div', 'dx-press-nav');
    const timelineRequestId = text(state.lastRequestId, text(state.activeRequestId, ''));

    const openInbox = create('a', 'cta-btn dx-button-element dx-button-element--primary dx-button-size--md', 'Open inbox');
    openInbox.href = '/entry/messages/';
    footer.appendChild(openInbox);

    const newRequest = createButton('Start another request', 'secondary', () => {
      state.form = createInitialForm();
      state.submitError = '';
      state.fieldErrors = {};
      clearActivePressDrafts();
      setStep(0);
      refreshMonthlyQuota({ useCache: false, forceLive: true }).catch(() => {});
    });
    newRequest.disabled = false;
    footer.appendChild(newRequest);

    if (timelineRequestId) {
      const openTimeline = create('a', 'cta-btn dx-button-element dx-button-element--secondary dx-button-size--sm', 'Open this timeline');
      openTimeline.href = `/entry/messages/submission/?kind=pressroom&rid=${encodeURIComponent(timelineRequestId)}`;
      footer.appendChild(openTimeline);
    }

    hostCard.appendChild(footer);
  }

  function renderStep() {
    if (!refs || !state) return;
    refs.stageHost.innerHTML = '';
    const step = currentStep();
    refs.stageHost.setAttribute('data-dx-press-step', step.key);

    const card = create('section', 'dx-press-step-card');
    card.setAttribute('data-dx-press-step', step.key);

    card.appendChild(create('h2', 'dx-press-title', step.title));

    if (step.key === 'compose') {
      renderComposeStep(card);
    } else if (step.key === 'review') {
      renderReviewStep(card);
    } else {
      renderDoneStep(card);
    }

    refs.stageHost.appendChild(card);
    animateStepCard(card);
  }

  function createStatusChip(status) {
    const normalized = normalizeStatus(status);
    const chip = create('span', `dx-press-status dx-press-status--${normalized}`, statusLabel(normalized));
    return chip;
  }

  function renderTimelineForRequest(container, request) {
    const requestId = text(request?.requestId, '');
    if (!requestId) {
      container.appendChild(create('p', 'dx-press-empty', 'Select a request to load lifecycle events.'));
      return;
    }

    const loading = !!state.eventsLoadingByRequest.get(requestId);
    if (loading) {
      container.appendChild(create('p', 'dx-press-muted', 'Syncing timeline...'));
      return;
    }

    const error = text(state.eventsErrorByRequest.get(requestId), '');
    if (error) {
      container.appendChild(createErrorBanner(error));
      const retry = createButton('Retry timeline', 'secondary', () => {
        loadEventsForRequest(requestId, { force: true }).catch(() => {});
      });
      container.appendChild(retry);
      return;
    }

    const events = state.eventsByRequest.get(requestId) || [];
    if (!events.length) {
      container.appendChild(create('p', 'dx-press-empty', 'No lifecycle events yet.'));
      return;
    }

    const list = create('div', 'dx-press-events-list');
    for (const event of events) {
      const card = create('article', 'dx-press-event-card');
      card.appendChild(create('h5', 'dx-press-event-title', eventLabel(event.eventType)));
      card.appendChild(create('p', 'dx-press-event-time', formatDateTime(event.eventTimestamp)));

      const eventCopy = text(
        event.publicNote,
        text(event.metadata?.message, text(event.statusRaw, 'Status updated.')),
      );
      card.appendChild(create('p', 'dx-press-event-copy', eventCopy));
      if (event.statusRaw) {
        card.appendChild(createStatusChip(event.statusRaw));
      }
      list.appendChild(card);
    }
    container.appendChild(list);
  }

  function renderHistory() {
    if (!refs || !state) return;

    refs.historyList.innerHTML = '';
    refs.timelineBody.innerHTML = '';

    if (!state.auth0Sub) {
      refs.historyList.appendChild(create('p', 'dx-press-muted', 'Sign in to view your PressRoom request history.'));
      refs.timelineBody.appendChild(create('p', 'dx-press-empty', 'Timeline appears after sign-in.'));
      return;
    }

    if (state.requestsLoading) {
      refs.historyList.appendChild(create('p', 'dx-press-muted', 'Loading your requests...'));
      refs.timelineBody.appendChild(create('p', 'dx-press-muted', 'Syncing timeline...'));
      return;
    }

    if (state.requestsError) {
      refs.historyList.appendChild(createErrorBanner(state.requestsError));
      const retry = createButton('Retry history', 'secondary', () => {
        loadRequests({ forceLive: true }).catch(() => {});
      });
      refs.historyList.appendChild(retry);
      refs.timelineBody.appendChild(create('p', 'dx-press-empty', 'Resolve history loading to view timeline.'));
      return;
    }

    if (!state.requests.length) {
      refs.historyList.appendChild(create('p', 'dx-press-empty', 'No requests yet. Submit one to start your lifecycle log.'));
      refs.timelineBody.appendChild(create('p', 'dx-press-empty', 'Timeline appears after your first request.'));
      return;
    }

    const list = create('div', 'dx-press-history-list');
    for (const request of state.requests) {
      const isActive = request.requestId === state.activeRequestId;
      const item = create('button', `dx-press-history-item${isActive ? ' is-active' : ''}`);
      item.type = 'button';
      item.disabled = lockUiFlag();
      item.addEventListener('click', () => {
        state.activeRequestId = request.requestId;
        renderHistory();
        loadEventsForRequest(request.requestId).catch(() => {});
        renderCommandPanel();
      });

      const header = create('div', 'dx-press-history-item-head');
      header.appendChild(create('h4', 'dx-press-history-title', text(request.project, 'Untitled request')));
      header.appendChild(createStatusChip(request.status));
      item.appendChild(header);

      const meta = create('p', 'dx-press-history-meta', `${request.requestId} · ${formatDateTime(request.timestamp)}`);
      item.appendChild(meta);

      list.appendChild(item);
    }
    refs.historyList.appendChild(list);

    const active = selectedRequest() || state.requests[0];
    if (active && !state.activeRequestId) {
      state.activeRequestId = active.requestId;
    }

    refs.timelineBody.appendChild(create('h4', 'dx-press-timeline-title', active ? `${active.requestId}` : 'Timeline'));
    renderTimelineForRequest(refs.timelineBody, active);
  }

  function renderCommandPanel() {
    if (!refs || !state) return;

    refs.command.innerHTML = '';

    const heading = create('div', 'dx-press-command-heading');
    heading.appendChild(create('p', 'dx-press-kicker', 'PressOps command'));
    heading.appendChild(create('h3', 'dx-press-command-title', 'Intake + lifecycle'));
    heading.appendChild(create('p', 'dx-press-copy dx-press-copy--compact', getQuotaSummaryText()));
    heading.appendChild(create('p', 'dx-press-copy dx-press-copy--compact', getQuotaDetailText()));
    refs.command.appendChild(heading);

    const checks = requiredChecklist();
    const done = checks.filter((item) => item.done).length;
    const total = checks.length || 1;
    const readinessCard = create('section', 'dx-press-command-card');
    readinessCard.appendChild(create('h4', 'dx-press-command-card-title', 'Readiness'));
    readinessCard.appendChild(create('p', 'dx-press-command-copy', `${done} of ${total} required complete`));
    const meter = create('div', 'dx-press-readiness');
    if (done >= total) meter.classList.add('is-complete');
    const fill = create('span', 'dx-press-readiness-fill');
    fill.style.transform = `scaleX(${Math.max(0, Math.min(1, done / total))})`;
    meter.appendChild(fill);
    readinessCard.appendChild(meter);
    refs.command.appendChild(readinessCard);

    const quotaCard = create('section', 'dx-press-command-card');
    quotaCard.appendChild(create('h4', 'dx-press-command-card-title', 'Monthly quota'));
    quotaCard.appendChild(create('p', 'dx-press-command-copy', `${state.monthlyRemaining} remaining of ${state.monthlyLimit}`));
    const sourceLabel = text(state.quotaSource, 'none');
    quotaCard.appendChild(create('p', 'dx-press-command-copy dx-press-command-copy--muted', `Source: ${sourceLabel}`));

    const quotaActions = create('div', 'dx-press-command-actions');
    const refreshQuotaBtn = createButton('Refresh quota', 'secondary', () => {
      refreshMonthlyQuota({ useCache: false, forceLive: true }).catch(() => {});
    });
    quotaActions.appendChild(refreshQuotaBtn);
    quotaCard.appendChild(quotaActions);
    refs.command.appendChild(quotaCard);

    const checklistCard = create('section', 'dx-press-command-card');
    checklistCard.appendChild(create('h4', 'dx-press-command-card-title', 'Required fields'));
    const checklist = create('ul', 'dx-press-checklist');
    for (const item of requiredChecklist()) {
      const li = create('li', `dx-press-checklist-item${item.done ? ' is-done' : ''}`);
      li.appendChild(create('span', 'dx-press-checklist-dot', item.done ? '●' : '○'));
      li.appendChild(create('span', 'dx-press-checklist-label', item.label));
      checklist.appendChild(li);
    }
    checklistCard.appendChild(checklist);
    refs.command.appendChild(checklistCard);

    const expectationsCard = create('section', 'dx-press-command-card');
    expectationsCard.appendChild(create('h4', 'dx-press-command-card-title', 'Editorial targets'));
    const bullets = create('ul', 'dx-press-bullets');
    bullets.appendChild(create('li', '', 'Publicly accessible links with clear file naming.'));
    bullets.appendChild(create('li', '', 'Budget range and desired delivery window.'));
    bullets.appendChild(create('li', '', 'Clear ask: coverage, funding, collaboration, or package.'));
    expectationsCard.appendChild(bullets);
    refs.command.appendChild(expectationsCard);

    const selected = selectedRequest();
    const statusCard = create('section', 'dx-press-command-card');
    statusCard.appendChild(create('h4', 'dx-press-command-card-title', 'Current status'));
    if (selected) {
      statusCard.appendChild(create('p', 'dx-press-command-copy', text(selected.project, 'Untitled request')));
      statusCard.appendChild(create('p', 'dx-press-command-copy dx-press-command-copy--muted', selected.requestId));
      statusCard.appendChild(createStatusChip(selected.status));
    } else {
      statusCard.appendChild(create('p', 'dx-press-command-copy dx-press-command-copy--muted', 'No active request selected.'));
    }
    refs.command.appendChild(statusCard);
  }

  function renderRootScaffold(root) {
    root.innerHTML = '';

    const shell = create('section', 'dx-press-shell');
    shell.setAttribute('data-dx-press-shell', 'true');

    const main = create('section', 'dx-press-main dx-press-surface');
    const mainHeading = create('header', 'dx-press-heading');
    mainHeading.appendChild(create('p', 'dx-press-kicker', 'Press room'));
    mainHeading.appendChild(create('h1', 'dx-press-heading-title', 'Submit request'));
    mainHeading.appendChild(create('p', 'dx-press-copy', 'Editorial intake and lifecycle tracker.'));
    main.appendChild(mainHeading);

    const progressWrap = create('div', 'dx-press-progress-wrap');
    const progressRow = create('div', 'dx-press-progress-row');
    const progressBar = create('div', 'dx-press-progress-bar');
    const progressFill = create('span', 'dx-press-progress-fill');
    progressBar.appendChild(progressFill);
    progressWrap.appendChild(progressRow);
    progressWrap.appendChild(progressBar);
    main.appendChild(progressWrap);

    const stageHost = create('section', 'dx-press-stage-host');
    stageHost.setAttribute('data-dx-press-step', 'compose');
    main.appendChild(stageHost);

    const history = create('section', 'dx-press-history');
    history.setAttribute('data-dx-press-history', 'true');
    history.appendChild(create('h3', 'dx-press-history-heading', 'My requests'));

    const historyList = create('div', 'dx-press-history-body');
    history.appendChild(historyList);

    const timeline = create('section', 'dx-press-timeline');
    timeline.setAttribute('data-dx-press-timeline', 'true');
    timeline.appendChild(create('h3', 'dx-press-history-heading', 'Lifecycle timeline'));
    const timelineBody = create('div', 'dx-press-timeline-body');
    timeline.appendChild(timelineBody);

    history.appendChild(timeline);
    main.appendChild(history);

    const command = create('aside', 'dx-press-command dx-press-surface');

    shell.appendChild(main);
    shell.appendChild(command);
    root.appendChild(shell);

    refs = {
      shell,
      main,
      command,
      progressRow,
      progressFill,
      stageHost,
      history,
      historyList,
      timelineBody,
    };
  }

  function renderAll() {
    renderProgress();
    renderStep();
    renderHistory();
    renderCommandPanel();
  }

  async function hydrateAuthAndData(options = {}) {
    if (!state) return false;
    const opts = options && typeof options === 'object' ? options : {};
    if (hydrationPromise) return hydrationPromise;

    hydrationPromise = (async () => {
      const snapshot = await resolveAuthSnapshot(AUTH_TIMEOUT_MS);
      state.authUser = snapshot.user;
      state.auth0Sub = text(snapshot.sub, '');
      if (state.auth0Sub) {
        window.auth0Sub = state.auth0Sub;
        reconcilePressDraftForSub(state.auth0Sub);
      }
      state.authResolved = true;
      renderAll();

      if (!state.auth0Sub) return false;
      const quotaOk = await refreshMonthlyQuota({ useCache: true, forceLive: !!opts.forceLive });
      await loadRequests({ forceLive: !!opts.forceLive });
      return quotaOk;
    })()
      .catch(() => false)
      .finally(() => {
        hydrationPromise = null;
      });

    return hydrationPromise;
  }

  async function mount(options = {}) {
    const root = document.getElementById('dex-press');
    if (!(root instanceof HTMLElement)) return false;

    const force = !!options.force;
    if (root.getAttribute('data-dx-press-booting') === 'true') return false;
    if (!force && root.getAttribute('data-dx-press-mounted') === 'true') return true;

    root.setAttribute('data-dx-press-booting', 'true');
    const startTs = performance.now();

    try {
      liveRoot = root;
      setFetchState(root, FETCH_STATE_LOADING);

      const config = toConfig(root);
      state = makeState(config);
      hydratePressDraft(state.auth0Sub || '');
      setQuotaSource('none');

      renderRootScaffold(root);
      renderAll();

      hydrateAuthAndData({ forceLive: false }).catch(() => {});

      await finalizeFetchState(root, startTs, FETCH_STATE_READY);
      root.setAttribute('data-dx-press-mounted', 'true');
      return true;
    } catch (error) {
      root.innerHTML = '';
      const failed = create('section', 'dx-press-main dx-press-surface');
      failed.appendChild(create('h2', 'dx-press-title', 'PressRoom failed to load'));
      failed.appendChild(create('p', 'dx-press-copy', text(error?.message, 'Unknown error')));
      root.appendChild(failed);
      await finalizeFetchState(root, startTs, FETCH_STATE_ERROR);
      return false;
    } finally {
      root.removeAttribute('data-dx-press-booting');
    }
  }

  window.__dxPressroomMount = mount;

  document.addEventListener('dx:slotready', () => {
    mount().catch(() => {});
  });

  document.addEventListener('dex-auth:ready', () => {
    if (!state) return;
    hydrateAuthAndData({ forceLive: true }).catch(() => {});
  });

  window.addEventListener('dx:prefetch:update', (event) => {
    if (!state || !state.auth0Sub) return;
    const detail = event && typeof event.detail === 'object' ? event.detail : null;
    const key = text(detail?.key, '');
    if (!key || key !== getQuotaPrefetchKey(state.auth0Sub)) return;
    const cached = readCachedQuota(state.auth0Sub);
    if (!cached) return;
    if (applyQuotaPayload(cached, 'cache')) {
      renderCommandPanel();
      if (state.step === 0) renderStep();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        mount().catch(() => {});
      },
      { once: true },
    );
  } else {
    mount().catch(() => {});
  }
})();
