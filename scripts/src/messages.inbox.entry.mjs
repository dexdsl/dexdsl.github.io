import {
  SUBMISSION_MEMBER_STAGE_FLOW,
  normalizeSubmissionStage,
  normalizeSubmissionTimelineEvent,
  submissionStageLabel,
} from './submission-thread-presentation.mjs';

(() => {
  if (typeof window === 'undefined') return;
  if (window.__dxMessagesInboxRuntimeLoaded) {
    if (typeof window.__dxMessagesInboxMount === 'function') {
      try {
        window.__dxMessagesInboxMount();
      } catch {}
    }
    return;
  }
  window.__dxMessagesInboxRuntimeLoaded = true;

  const DX_MIN_SHEEN_MS = 120;
  const AUTH_TIMEOUT_MS = 6000;
  const SYSTEM_FETCH_TIMEOUT_MS = 6000;
  const SUBMISSIONS_FETCH_TIMEOUT_MS = 6000;
  const PRESSROOM_FETCH_TIMEOUT_MS = 6000;
  const ACTION_TIMEOUT_MS = 5000;
  const NON_SUB_RETENTION_DAYS = 90;
  const PREFETCH_SWR_MS = 60000;
  const DEFAULT_API = 'https://dex-api.spring-fog-8edd.workers.dev';
  const SUBMISSION_STATE_PREFIX = 'dex:messages:submission-state:v1:';
  const SUBMISSION_PENDING_SID_KEY = 'dex:messages:pending-submission-sid';
  const MESSAGE_PENDING_THREAD_KEY = 'dex:messages:pending-thread:v1';
  const FETCH_STATE_LOADING = 'loading';
  const FETCH_STATE_READY = 'ready';
  const FETCH_STATE_ERROR = 'error';

  function isObject(value) {
    return typeof value === 'object' && value !== null;
  }

  function withTimeout(promise, timeoutMs, fallbackValue) {
    let timer = 0;
    return Promise.race([
      Promise.resolve(promise),
      new Promise((resolve) => {
        timer = window.setTimeout(() => resolve(fallbackValue), timeoutMs);
      }),
    ]).finally(() => {
      if (timer) window.clearTimeout(timer);
    });
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, Math.max(0, ms)));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function parseTimestamp(value) {
    const ts = Date.parse(String(value || ''));
    return Number.isFinite(ts) ? ts : null;
  }

  function toRecordDate(value) {
    const ts = parseTimestamp(value);
    if (ts === null) return nowIso();
    return new Date(ts).toISOString();
  }

  function toSafeText(value, fallback = '') {
    const raw = String(value == null ? '' : value).trim();
    return raw || fallback;
  }

  function parseMetadata(value) {
    if (isObject(value)) return value;
    if (typeof value !== 'string') return {};
    try {
      const parsed = JSON.parse(value);
      return isObject(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function sanitizeSubmissionId(value) {
    return toSafeText(value, '').replace(/[^a-zA-Z0-9._:-]/g, '');
  }

  function sanitizeRequestId(value) {
    return toSafeText(value, '').replace(/[^a-zA-Z0-9._:-]/g, '');
  }

  function normalizeThreadKind(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'pressroom' ? 'pressroom' : 'submission';
  }

  function setPendingSubmissionSid(sid) {
    const safeSid = sanitizeSubmissionId(sid);
    if (!safeSid) return;
    window.__dxPendingSubmissionSid = safeSid;
    try {
      window.sessionStorage.setItem(SUBMISSION_PENDING_SID_KEY, safeSid);
    } catch {}
  }

  function setPendingMessageThread(thread) {
    const value = isObject(thread) ? thread : {};
    const kind = normalizeThreadKind(value.kind);
    const sid = sanitizeSubmissionId(value.sid || '');
    const rid = sanitizeRequestId(value.rid || '');
    const payload = kind === 'pressroom'
      ? { kind: 'pressroom', rid }
      : { kind: 'submission', sid };

    if (payload.kind === 'submission' && payload.sid) {
      setPendingSubmissionSid(payload.sid);
    }

    window.__dxPendingMessageThread = payload;
    try {
      window.sessionStorage.setItem(MESSAGE_PENDING_THREAD_KEY, JSON.stringify(payload));
    } catch {}
  }

  function parseThreadRefFromHref(href) {
    const rawHref = toSafeText(href, '');
    if (!rawHref) return { kind: 'submission', sid: '', rid: '' };
    try {
      const parsed = new URL(rawHref, window.location.href);
      const kind = normalizeThreadKind(parsed.searchParams.get('kind'));
      const sid = sanitizeSubmissionId(parsed.searchParams.get('sid'));
      const rid = sanitizeRequestId(parsed.searchParams.get('rid'));
      return { kind, sid, rid };
    } catch {
      return { kind: 'submission', sid: '', rid: '' };
    }
  }

  function toApiBase(root) {
    const configured =
      root?.dataset?.api ||
      window.DEX_API_BASE_URL ||
      window.DEX_API_ORIGIN ||
      DEFAULT_API;
    return String(configured || DEFAULT_API).trim().replace(/\/+$/, '');
  }

  function setFetchState(root, state) {
    if (!root) return;
    root.setAttribute('data-dx-fetch-state', state);
    if (state === FETCH_STATE_LOADING) {
      root.setAttribute('aria-busy', 'true');
    } else {
      root.removeAttribute('aria-busy');
    }
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

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeSeverity(value) {
    const severity = String(value || '').trim().toLowerCase();
    if (severity === 'critical' || severity === 'warning' || severity === 'info') return severity;
    return 'info';
  }

  function severityFromSubmissionStatus(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized.includes('rejected')) return 'critical';
    if (normalized.includes('revision')) return 'warning';
    return 'info';
  }

  function normalizePressroomStatus(value) {
    const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (['submitted', 'triage', 'in_review', 'needs_info', 'approved', 'closed'].includes(normalized)) {
      return normalized;
    }
    return 'submitted';
  }

  function severityFromPressroomStatus(status) {
    const normalized = normalizePressroomStatus(status);
    if (normalized === 'needs_info') return 'warning';
    return 'info';
  }

  function getScope(authSnapshot) {
    const sub = toSafeText(authSnapshot?.sub, '');
    return sub || 'anon';
  }

  function getPrefetchRuntime() {
    const runtime = window.__DX_PREFETCH;
    if (!runtime || typeof runtime.getFresh !== 'function' || typeof runtime.set !== 'function') return null;
    return runtime;
  }

  function getPrefetchSubmissionsKey(scope) {
    return `messages:submissions:${scope}`;
  }

  function getPrefetchPressroomKey(scope) {
    return `messages:pressroom:${scope}`;
  }

  function getPrefetchSystemKey(scope) {
    return `messages:system:${scope}`;
  }

  function readPrefetchedRecords(scope, sourceType) {
    const prefetch = getPrefetchRuntime();
    if (!prefetch || !scope) return null;
    let key = '';
    if (sourceType === 'submission') key = getPrefetchSubmissionsKey(scope);
    else if (sourceType === 'pressroom') key = getPrefetchPressroomKey(scope);
    else key = getPrefetchSystemKey(scope);
    const cached = prefetch.getFresh(key, PREFETCH_SWR_MS);
    if (!cached || !Array.isArray(cached.payload)) return null;
    return cached.payload;
  }

  function writePrefetchedRecords(scope, sourceType, records) {
    const prefetch = getPrefetchRuntime();
    if (!prefetch || !scope || !Array.isArray(records)) return;
    let key = '';
    if (sourceType === 'submission') key = getPrefetchSubmissionsKey(scope);
    else if (sourceType === 'pressroom') key = getPrefetchPressroomKey(scope);
    else key = getPrefetchSystemKey(scope);
    prefetch.set(key, records, { scope });
  }

  function loadSubmissionState(scope) {
    const key = `${SUBMISSION_STATE_PREFIX}${scope}`;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return isObject(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function persistSubmissionState(scope, stateMap) {
    const key = `${SUBMISSION_STATE_PREFIX}${scope}`;
    try {
      window.localStorage.setItem(key, JSON.stringify(stateMap || {}));
    } catch {}
  }

  async function fetchJsonWithTimeout(url, init, timeoutMs) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      return {
        ok: response.ok,
        status: response.status,
        payload,
      };
    } finally {
      window.clearTimeout(timer);
    }
  }

  function getAuthRuntime() {
    return window.DEX_AUTH || window.dexAuth || null;
  }

  async function resolveAuthSnapshot(timeoutMs = AUTH_TIMEOUT_MS) {
    const auth = getAuthRuntime();
    if (!auth) {
      return { auth: null, authenticated: false, token: '', user: null, sub: '' };
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
        authenticated = !!(isObject(readyPayload) && readyPayload.isAuthenticated);
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

    const sub = toSafeText(
      user?.sub || window.auth0Sub || window.AUTH0_USER?.sub,
      '',
    );

    let token = '';
    if (authenticated && typeof auth.getAccessToken === 'function') {
      try {
        token = toSafeText(await withTimeout(auth.getAccessToken(), timeoutMs, ''), '');
      } catch {
        token = '';
      }
    }

    return {
      auth,
      authenticated,
      token,
      user,
      sub,
    };
  }

  function normalizeSourceType(value) {
    const sourceType = String(value || '').trim().toLowerCase();
    if (sourceType === 'submission' || sourceType === 'pressroom' || sourceType === 'system') return sourceType;
    return 'system';
  }

  function normalizeSubmissionKind(value) {
    const kind = String(value || '').trim().toLowerCase();
    return kind === 'call' ? 'call' : 'sample';
  }

  function normalizeCategory(value) {
    const category = String(value || '').trim();
    return category || 'general';
  }

  function normalizeSystemRecord(raw, index) {
    const value = isObject(raw) ? raw : {};
    const id = toSafeText(value.id, `system-${index + 1}`);
    const createdAt = toRecordDate(value.createdAt || value.created_at || value.timestamp);
    return {
      id,
      sourceType: normalizeSourceType(value.sourceType || value.source_type || 'system'),
      category: normalizeCategory(value.category),
      severity: normalizeSeverity(value.severity),
      title: toSafeText(value.title, 'Untitled notification'),
      body: toSafeText(value.body || value.message, ''),
      href: toSafeText(value.href, ''),
      metadata: isObject(value.metadata) ? value.metadata : {},
      createdAt,
      readAt: toSafeText(value.readAt || value.read_at, ''),
      archivedAt: toSafeText(value.archivedAt || value.archived_at, ''),
      expiresAt: toSafeText(value.expiresAt || value.expires_at, ''),
      permanent: false,
    };
  }

  function isExpired(record) {
    const expiresTs = parseTimestamp(record?.expiresAt);
    if (expiresTs === null) return false;
    return expiresTs <= Date.now();
  }

  function isBeyondRetention(record) {
    if (!record || record.sourceType === 'submission') return false;
    const createdTs = parseTimestamp(record.createdAt);
    if (createdTs === null) return false;
    return Date.now() - createdTs > NON_SUB_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  }

  function buildSubmissionId(row, index, sub) {
    const rowNumber = toSafeText(row?.row, `${index + 1}`);
    const timestamp = toSafeText(row?.timestamp || row?.createdAt || row?.created_at, 'unknown');
    return `submission:${sub || 'anon'}:${rowNumber}:${timestamp}`;
  }

  function toLookupWord(value, length, fallback) {
    const letters = String(value || '').replace(/[^A-Za-z]/g, '');
    if (!letters) return fallback;
    const padded = letters.slice(0, Math.max(1, length)).padEnd(length, 'X').slice(0, length);
    return `${padded.charAt(0).toUpperCase()}${padded.slice(1).toLowerCase()}`;
  }

  function parseCollectionTypeCode(value) {
    const raw = toSafeText(value, '').toUpperCase();
    if (raw === 'AV') return 'AV';
    if (raw === 'A' || raw.includes('AUDIO')) return 'A';
    if (raw === 'V' || raw.includes('VIDEO')) return 'V';
    return 'O';
  }

  function parseInstrumentTypeCode(category) {
    const raw = toSafeText(category, '').toUpperCase();
    const first = raw.match(/[A-Z]/)?.[0] || '';
    return ['K', 'B', 'E', 'S', 'W', 'P', 'V', 'X'].includes(first) ? first : 'X';
  }

  function parseSurnameCandidate(value) {
    const raw = toSafeText(value, '');
    if (!raw) return '';
    if (raw.includes(',')) return toSafeText(raw.split(',')[0], '');
    const parts = raw.split(/\s+/).filter(Boolean);
    return toSafeText(parts[parts.length - 1], '');
  }

  function resolveAuthSurname() {
    const user = (window.AUTH0_USER && isObject(window.AUTH0_USER)) ? window.AUTH0_USER : null;
    if (!user) return '';
    return toSafeText(
      user.family_name
      || user.surname
      || user.last_name
      || parseSurnameCandidate(user.name || user.nickname || user.email || ''),
      '',
    );
  }

  function parsePerformerToken(performer) {
    const source = toSafeText(performer, '') || resolveAuthSurname();
    const letters = source.replace(/[^A-Za-z]/g, '');
    if (!letters) return 'Un';
    const token = letters.slice(0, 2).padEnd(2, 'X');
    return `${token.charAt(0).toUpperCase()}${token.slice(1).toLowerCase()}`;
  }

  function isPlaceholderSubmissionLookup(value) {
    const lookup = toSafeText(value, '');
    if (!lookup) return false;
    return /^SUB\d{2}-X\.Unk\s+[A-Za-z]{2}\s+O\d{4}$/i.test(lookup);
  }

  function sanitizeLookupValue(value) {
    const lookup = toSafeText(value, '');
    if (!lookup) return '';
    if (isPlaceholderSubmissionLookup(lookup)) return '';
    return lookup;
  }

  function isUntitledSubmissionTitle(value) {
    const title = toSafeText(value, '').toLowerCase();
    if (!title) return false;
    return title === 'untitled submission' || title === 'untitled';
  }

  function sanitizeSubmissionTitle(value) {
    const title = toSafeText(value, '');
    if (!title) return '';
    if (isUntitledSubmissionTitle(title)) return '';
    return title;
  }

  function composeSubmissionCardTitle(submissionTitle, lookup, fallbackTitle) {
    const safeTitle = sanitizeSubmissionTitle(submissionTitle);
    const safeLookup = sanitizeLookupValue(lookup);
    const safeFallback = toSafeText(fallbackTitle, 'Submission');
    if (safeTitle && safeLookup) return `${safeTitle} (${safeLookup})`;
    if (safeTitle) return safeTitle;
    if (safeLookup) return safeLookup;
    return safeFallback;
  }

  function formatCounter(value) {
    const parsed = Number.parseInt(String(value || '0'), 10);
    const safe = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    return String(safe).padStart(2, '0');
  }

  function buildSubmissionLookup(row, fallbackYear, fallbackCounter) {
    const rowCounter = toSafeText(
      row?.submissionSerial
      || row?.submission_serial
      || row?.sourceRow
      || row?.source_row
      || row?.row,
      '',
    );
    const counter = formatCounter(rowCounter || fallbackCounter || 1);
    const category = toSafeText(row?.category || row?.category_raw || row?.instrumentCategory, '');
    const instrument = toSafeText(row?.instrument || row?.instrument_raw, '');
    const performer = toSafeText(row?.performerToken || row?.performer_token, '');
    const instrumentType = parseInstrumentTypeCode(category);
    const instrumentPrefix = toLookupWord(instrument, 3, 'Unk');
    const performerToken = parsePerformerToken(performer);
    const collectionType = parseCollectionTypeCode(row?.collectionType || row?.collection_type);
    const year = Number.parseInt(String(row?.submissionYear || row?.submission_year || fallbackYear || new Date().getFullYear()), 10);
    const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
    return `SUB${counter}-${instrumentType}.${instrumentPrefix} ${performerToken} ${collectionType}${safeYear}`;
  }

  function resolveSubmissionLookup(row, fallbackYear, fallbackCounter) {
    const finalLookupNumber = sanitizeLookupValue(row?.finalLookupNumber || row?.final_lookup_number);
    const submissionLookupNumber = sanitizeLookupValue(row?.submissionLookupNumber || row?.submission_lookup_number);
    const generated = sanitizeLookupValue(row?.submissionLookupGenerated || row?.submission_lookup_generated);
    const lookup = sanitizeLookupValue(row?.lookup || row?.lookupNumber || row?.lookup_number);
    const effective = sanitizeLookupValue(row?.effectiveLookupNumber || row?.effective_lookup_number);
    const resolved = (
      finalLookupNumber
      || submissionLookupNumber
      || generated
      || lookup
      || effective
    );
    if (resolved) return resolved;

    const built = buildSubmissionLookup(row, fallbackYear, fallbackCounter);
    const sanitizedBuilt = sanitizeLookupValue(built);
    if (sanitizedBuilt) return sanitizedBuilt;
    return resolved || '';
  }

  function normalizeSubmissionRecords(rows, sub, submissionState) {
    const safeRows = Array.isArray(rows) ? rows : [];
    const fallbackYear = new Date().getFullYear();
    return safeRows.map((row, index) => {
      const metadata = parseMetadata(row?.metadata || row?.metadata_json || row?.metadataJson || row?.meta);
      const normalizedRow = {
        ...(isObject(row) ? row : {}),
        ...metadata,
      };
      const submissionId = sanitizeSubmissionId(
        normalizedRow?.submissionId
        || normalizedRow?.submission_id
        || normalizedRow?.id,
      );
      const id = submissionId || buildSubmissionId(row, index, sub);
      const state = isObject(submissionState[id]) ? submissionState[id] : {};
      const status = toSafeText(normalizedRow?.status, 'Submitted');
      const createdAt = toRecordDate(
        normalizedRow?.timestamp
        || normalizedRow?.updatedAt
        || normalizedRow?.updated_at
        || normalizedRow?.createdAt
        || normalizedRow?.created_at,
      );
      const fallbackCounter = normalizedRow?.row || normalizedRow?.sourceRow || (index + 1);
      const lookup = resolveSubmissionLookup(normalizedRow, fallbackYear, fallbackCounter);
      const submissionTitle = toSafeText(
        normalizedRow?.title
        || normalizedRow?.submissionTitle
        || normalizedRow?.submission_title,
        '',
      );
      const submissionKind = normalizeSubmissionKind(
        normalizedRow?.submissionKind
        || normalizedRow?.submission_kind
        || normalizedRow?.sourceType
        || normalizedRow?.source_type,
      );
      const sourceLink = toSafeText(normalizedRow?.sourceLink || normalizedRow?.source_link || normalizedRow?.link, '');
      return {
        id,
        sourceType: 'submission',
        category: submissionKind === 'call' ? 'calls' : 'submissions',
        severity: severityFromSubmissionStatus(status),
        title: composeSubmissionCardTitle(submissionTitle, lookup, `Submission ${index + 1}`),
        body: toSafeText(normalizedRow?.latestPublicNote || normalizedRow?.latest_public_note || normalizedRow?.notes || normalizedRow?.note, ''),
        href: submissionId
          ? `/entry/messages/submission/?sid=${encodeURIComponent(submissionId)}`
          : '/entry/submit/',
        metadata: {
          submissionId,
          row: normalizedRow?.row || normalizedRow?.sourceRow || normalizedRow?.source_row,
          status,
          license: normalizedRow?.license,
          collectionType: normalizedRow?.collectionType || normalizedRow?.collection_type,
          lookup,
          submissionKind,
          submissionTitle,
          sourceLink,
          submissionLookupNumber: sanitizeLookupValue(normalizedRow?.submissionLookupNumber || normalizedRow?.submission_lookup_number),
          finalLookupNumber: sanitizeLookupValue(normalizedRow?.finalLookupNumber || normalizedRow?.final_lookup_number),
        },
        createdAt,
        readAt: toSafeText(state.readAt, ''),
        archivedAt: toSafeText(state.archivedAt, ''),
        expiresAt: '',
        permanent: true,
      };
    });
  }

  function normalizeSubmissionThreadRecords(rows, submissionState) {
    const safeRows = Array.isArray(rows) ? rows : [];
    return safeRows.map((row, index) => {
      const value = isObject(row) ? row : {};
      const metadata = parseMetadata(value.metadata || value.metadata_json || value.metadataJson || value.meta);
      const merged = { ...value, ...metadata };
      const submissionId = sanitizeSubmissionId(merged.submissionId || merged.submission_id || merged.id);
      const id = submissionId || `submission-thread-${index + 1}`;
      const state = isObject(submissionState[id]) ? submissionState[id] : {};
      const status = toSafeText(
        merged.currentStatusRaw
        || merged.current_status_raw
        || merged.statusRaw
        || merged.status_raw
        || merged.status,
        'Submitted',
      );
      const createdAt = toRecordDate(
        merged.updatedAt
        || merged.updated_at
        || merged.receivedAt
        || merged.received_at
        || merged.createdAt
        || merged.created_at
        || merged.timestamp,
      );
      const fallbackYear = Number.parseInt(
        String(merged.submissionYear || merged.submission_year || new Date().getFullYear()),
        10,
      );
      const fallbackCounter = merged.sourceRow || merged.source_row || merged.row || (index + 1);
      const lookup = resolveSubmissionLookup(merged, fallbackYear, fallbackCounter);
      const submissionTitle = toSafeText(
        merged.title || merged.submissionTitle || merged.submission_title,
        '',
      );
      const submissionKind = normalizeSubmissionKind(
        merged.submissionKind
        || merged.submission_kind
        || merged.sourceType
        || merged.source_type,
      );
      const title = composeSubmissionCardTitle(submissionTitle, lookup, `Submission ${index + 1}`);
      const sourceRow = merged.sourceRow || merged.source_row || merged.row || '';
      const readAt = toSafeText(merged.acknowledgedAt || merged.acknowledged_at || state.readAt, '');
      const archivedAt = toSafeText(merged.archivedAt || merged.archived_at || state.archivedAt, '');
      const sourceLink = toSafeText(merged.sourceLink || merged.source_link || merged.link, '');
      return {
        id,
        sourceType: 'submission',
        category: submissionKind === 'call' ? 'calls' : 'submissions',
        severity: severityFromSubmissionStatus(status),
        title,
        body: toSafeText(merged.latestPublicNote || merged.latest_public_note || merged.notes || merged.note, ''),
        href: submissionId
          ? `/entry/messages/submission/?sid=${encodeURIComponent(submissionId)}`
          : '/entry/submit/',
        metadata: {
          submissionId,
          row: sourceRow,
          status,
          license: toSafeText(merged.license, ''),
          collectionType: toSafeText(merged.collectionType || merged.collection_type, ''),
          lookup,
          submissionKind,
          submissionTitle,
          sourceLink,
          submissionLookupNumber: sanitizeLookupValue(merged.submissionLookupNumber || merged.submission_lookup_number),
          finalLookupNumber: sanitizeLookupValue(merged.finalLookupNumber || merged.final_lookup_number),
        },
        createdAt,
        readAt,
        archivedAt,
        expiresAt: '',
        permanent: true,
      };
    });
  }

  async function loadSubmissionRecords(apiBase, authSnapshot, submissionState) {
    if (!authSnapshot?.authenticated || !authSnapshot?.token) {
      return {
        records: [],
        warning: '',
      };
    }

    let submissionsResponse = null;
    try {
      submissionsResponse = await fetchJsonWithTimeout(
        `${apiBase}/me/submissions?limit=200&state=all`,
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${authSnapshot.token}`,
            'content-type': 'application/json',
          },
        },
        SUBMISSIONS_FETCH_TIMEOUT_MS,
      );
    } catch {
      submissionsResponse = { ok: false, status: 0, payload: null };
    }

    if (submissionsResponse.ok) {
      const payload = isObject(submissionsResponse.payload) ? submissionsResponse.payload : {};
      const rows = Array.isArray(payload.threads)
        ? payload.threads
        : Array.isArray(payload.items)
          ? payload.items
          : [];
      return {
        records: normalizeSubmissionThreadRecords(rows, submissionState),
        warning: '',
      };
    }

    return {
      records: [],
      warning: 'Submissions are temporarily unavailable.',
    };
  }

  async function loadSystemRecords(apiBase, authSnapshot) {
    if (!authSnapshot.authenticated || !authSnapshot.token) {
      return {
        records: [],
        warning: '',
      };
    }

    const endpoint = `${apiBase}/me/messages?limit=200`;
    let response = null;
    try {
      response = await fetchJsonWithTimeout(
        endpoint,
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${authSnapshot.token}`,
            'content-type': 'application/json',
          },
        },
        SYSTEM_FETCH_TIMEOUT_MS,
      );
    } catch {
      response = { ok: false, status: 0, payload: null };
    }

    if (!response.ok) {
      return {
        records: [],
        warning: 'System notifications are temporarily unavailable.',
      };
    }

    const payload = isObject(response.payload) ? response.payload : {};
    const rows = Array.isArray(payload.messages)
      ? payload.messages
      : Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(payload.items)
          ? payload.items
          : [];

    const records = rows
      .map((row, index) => normalizeSystemRecord(row, index))
      .filter((record) => !isExpired(record))
      .filter((record) => !isBeyondRetention(record));

    return {
      records,
      warning: '',
    };
  }

  function composePressroomCardTitle(project, requestId, fallbackTitle) {
    const safeProject = toSafeText(project, '');
    const safeRequestId = sanitizeRequestId(requestId);
    const fallback = toSafeText(fallbackTitle, 'Pressroom request');
    if (safeProject && safeRequestId) return `${safeProject} (${safeRequestId})`;
    if (safeProject) return safeProject;
    if (safeRequestId) return safeRequestId;
    return fallback;
  }

  function normalizePressroomRecords(rows, submissionState) {
    const safeRows = Array.isArray(rows) ? rows : [];
    return safeRows.map((row, index) => {
      const value = isObject(row) ? row : {};
      const metadata = parseMetadata(value.metadata || value.metadata_json || value.metadataJson || value.meta);
      const merged = { ...value, ...metadata };
      const requestId = sanitizeRequestId(merged.requestId || merged.request_id || merged.id);
      const kind = toSafeText(merged.kind || merged.ticketKind, 'press').toLowerCase();
      const statusRaw = toSafeText(merged.status, 'submitted');
      const normalizedStatus = normalizePressroomStatus(statusRaw);
      const recordId = requestId || `pressroom:${index + 1}:${toSafeText(merged.timestamp, 'unknown')}`;
      const state = isObject(submissionState[recordId]) ? submissionState[recordId] : {};
      const createdAt = toRecordDate(
        merged.updatedAt
        || merged.updated_at
        || merged.timestamp
        || merged.createdAt
        || merged.created_at,
      );
      const project = toSafeText(merged.project || merged.title, '');
      const kindLabel = kind === 'board' ? 'Board' : kind === 'support' ? 'Support' : 'Pressroom';
      const requestTitle = composePressroomCardTitle(project, requestId, `${kindLabel} request ${index + 1}`);
      const sourceLink = toSafeText(merged.links || merged.sourceLink || merged.source_link || merged.link, '');
      return {
        id: recordId,
        sourceType: 'pressroom',
        category: kind === 'board' || kind === 'support' ? kind : 'pressroom',
        severity: severityFromPressroomStatus(normalizedStatus),
        title: kind === 'board' || kind === 'support' ? `${kindLabel}: ${requestTitle}` : requestTitle,
        body: toSafeText(merged.publicNote || merged.public_note || merged.desc || merged.description, ''),
        href: kind === 'press' && requestId
          ? `/entry/messages/submission/?kind=pressroom&rid=${encodeURIComponent(requestId)}`
          : '/entry/messages/',
        metadata: {
          requestId,
          kind,
          status: normalizedStatus,
          name: toSafeText(merged.name, ''),
          email: toSafeText(merged.email, ''),
          project,
          desc: toSafeText(merged.desc || merged.description, ''),
          links: sourceLink,
          budget: toSafeText(merged.budget, ''),
          timeline: toSafeText(merged.timeline, ''),
          timeframe: toSafeText(merged.timeframe, ''),
          timestamp: toSafeText(merged.timestamp, ''),
          updatedAt: toSafeText(merged.updatedAt || merged.updated_at, ''),
          sourceLink,
        },
        createdAt,
        readAt: toSafeText(state.readAt, ''),
        archivedAt: toSafeText(state.archivedAt, ''),
        expiresAt: '',
        permanent: true,
      };
    });
  }

  async function loadPressroomRecords(apiBase, authSnapshot, submissionState) {
    if (!authSnapshot?.authenticated || !authSnapshot?.token) {
      return {
        records: [],
        warning: '',
      };
    }

    try {
      const response = await fetchJsonWithTimeout(
        `${apiBase}/me/ops/tickets?limit=200`,
        {
          method: 'GET',
          headers: {
            authorization: `Bearer ${authSnapshot.token}`,
            'content-type': 'application/json',
          },
        },
        PRESSROOM_FETCH_TIMEOUT_MS,
      );
      if (!response.ok) throw new Error('Worker ops tickets unavailable.');
      const payload = isObject(response.payload) ? response.payload : {};
      const rows = Array.isArray(payload.tickets) ? payload.tickets : [];
      return {
        records: normalizePressroomRecords(rows, submissionState),
        warning: '',
      };
    } catch {
      return {
        records: [],
        warning: 'Pressroom requests are temporarily unavailable.',
      };
    }
  }

  async function mutateSystemRecord(apiBase, authSnapshot, recordId, action) {
    if (!authSnapshot.authenticated || !authSnapshot.token) {
      return { ok: false, status: 401 };
    }

    const actionPath = action === 'read-all'
      ? '/me/messages/read-all'
      : `/me/messages/${encodeURIComponent(recordId)}/${action}`;
    const response = await fetchJsonWithTimeout(
      `${apiBase}${actionPath}`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${authSnapshot.token}`,
          'content-type': 'application/json',
        },
      },
      ACTION_TIMEOUT_MS,
    );

    return { ok: response.ok, status: response.status };
  }

  function ensureStyles() {
    if (document.getElementById('dx-messages-runtime-style')) return;
    const style = document.createElement('style');
    style.id = 'dx-messages-runtime-style';
    style.textContent = `
      #dex-msg{width:100%;
        --dx-msg-ink:var(--dx-blackglass-ink,#f3f3f4);
        --dx-msg-muted:var(--dx-blackglass-muted,rgba(255,255,255,.62));
        --dx-msg-faint:var(--dx-blackglass-faint,rgba(255,255,255,.40));
        --dx-msg-line:var(--dx-blackglass-line,rgba(255,255,255,.14));
        --dx-msg-line-strong:var(--dx-blackglass-line-strong,rgba(255,255,255,.26));
        --dx-msg-accent:var(--dx-accent-solid,#ff5b3a);
        --dx-msg-accent-rail:linear-gradient(180deg,var(--dx-accent-grad-start,#ff1910),var(--dx-accent-grad-end,#ff6a00));
        --dx-msg-accent-grad:var(--dx-accent-gradient,linear-gradient(90deg,#ff1910,#ff6a00));
        font-family:var(--dx-mono,'Courier Prime','Courier New',monospace);}
      #dex-msg .dx-msg-shell{display:flex;flex-direction:column;gap:clamp(14px,1.8vw,20px);height:100%;min-height:0;color:var(--dx-msg-ink);
        background:linear-gradient(145deg,rgba(17,18,24,.92) 0%,rgba(10,11,15,.86) 100%);border:1px solid var(--dx-blackglass-rim,var(--dx-msg-line-strong));border-radius:var(--dx-header-glass-radius,12px);
        box-shadow:var(--dx-blackglass-shadow,0 18px 42px rgba(0,0,0,.42));backdrop-filter:var(--dx-blackglass-backdrop,blur(22px) saturate(135%));-webkit-backdrop-filter:var(--dx-blackglass-backdrop,blur(22px) saturate(135%));padding:clamp(16px,2.1vw,26px);}
      #dex-msg .dx-msg-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap;flex:0 0 auto;}
      #dex-msg .dx-msg-title{margin:0;font-family:'Stretch Pro','Typefesse',var(--dx-mono),sans-serif;font-size:clamp(1.3rem,3vw,1.8rem);letter-spacing:.01em;text-transform:uppercase;display:flex;align-items:center;gap:10px;color:var(--dx-msg-ink) !important;}
      #dex-msg .dx-msg-sub{margin:4px 0 0;color:var(--dx-msg-muted);font-size:.82rem;}
      #dex-msg .dx-msg-controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;flex:0 0 auto;}
      /* source filter — matches the settings tab pills (individual bordered
         pills, 4px radius, gradient-filled active), not a segmented box. */
      #dex-msg .dx-msg-seg{display:inline-flex;flex-wrap:wrap;padding:0;gap:8px;border:0;border-radius:0;background:transparent;}
      #dex-msg .dx-msg-seg-btn{appearance:none;min-height:38px;border:1px solid var(--dx-msg-line);background:rgba(255,255,255,.1);color:var(--dx-msg-ink);border-radius:4px;padding:.42rem .8rem;font:700 clamp(11px,1vw,12px) 'Stretch Pro','Typefesse',sans-serif;letter-spacing:.02em;text-transform:uppercase !important;cursor:pointer;transition:color .18s ease,background .18s ease,border-color .18s ease;}
      #dex-msg .dx-msg-seg-btn:hover{background:rgba(255,255,255,.16);}
      #dex-msg .dx-msg-seg-btn.is-active{border-color:transparent;background:linear-gradient(130deg,var(--dx-msg-accent),#ff9810);color:#fff;box-shadow:none;}
      #dex-msg .dx-msg-btn{appearance:none;border:1px solid var(--dx-msg-line-strong);background:rgba(255,255,255,.06);color:var(--dx-msg-ink);border-radius:999px;padding:7px 13px;font:inherit;font-size:.74rem;letter-spacing:.03em;text-transform:uppercase;line-height:1;cursor:pointer;transition:background .18s ease,border-color .18s ease;}
      #dex-msg .dx-msg-btn:hover{background:rgba(255,255,255,.12);}
      #dex-msg .dx-msg-btn:disabled{opacity:.45;cursor:not-allowed;}
      #dex-msg .dx-msg-btn--accent{background:var(--dx-msg-accent);border-color:transparent;color:#fff;}
      #dex-msg .dx-msg-toggle{display:inline-flex;align-items:center;gap:7px;font-size:.74rem;letter-spacing:.03em;text-transform:uppercase;color:var(--dx-msg-muted);cursor:pointer;}
      #dex-msg .dx-msg-toggle input{accent-color:var(--dx-msg-accent);}
      #dex-msg .dx-msg-badge{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 7px;border-radius:999px;background:var(--dx-msg-accent);color:#fff;font-size:.72rem;line-height:1;}
      #dex-msg .dx-msg-warning{margin:0;padding:9px 12px;border:1px solid rgba(214,147,47,.4);border-radius:9px;background:rgba(214,147,47,.12);color:var(--dx-msg-ink);font-size:.8rem;flex:0 0 auto;}
      /* board */
      #dex-msg .dx-msg-board{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(12px,1.4vw,18px);flex:1 1 auto;min-height:0;overflow-anchor:none;}
      #dex-msg .dx-msg-lane{display:flex;flex-direction:column;min-height:0;border:1px solid var(--dx-msg-line);border-radius:12px;background:rgba(255,255,255,.03);overflow:hidden;}
      #dex-msg .dx-msg-lane-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 13px;border-bottom:1px solid var(--dx-msg-line);position:sticky;top:0;background:rgba(20,21,27,.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:1;}
      #dex-msg .dx-msg-lane-label{margin:0;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--dx-msg-ink);font-weight:700;}
      #dex-msg .dx-msg-lane[data-lane='needs'] .dx-msg-lane-label{color:var(--dx-msg-accent);}
      #dex-msg .dx-msg-lane-count{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;border-radius:999px;border:1px solid var(--dx-msg-line-strong);font-size:.7rem;color:var(--dx-msg-muted);}
      #dex-msg .dx-msg-lane-body{display:flex;flex-direction:column;gap:9px;padding:11px;overflow-y:auto;overflow-anchor:none;min-height:60px;}
      #dex-msg .dx-msg-card{position:relative;isolation:isolate;display:grid;gap:8px;padding:14px 16px 14px 18px;border:1px solid var(--dx-msg-line);border-radius:14px;background:linear-gradient(155deg,rgba(255,255,255,.055),rgba(255,255,255,.018));cursor:pointer;text-align:left;color:inherit;font:inherit;width:100%;transition:transform .18s ease,background .18s ease,border-color .18s ease,box-shadow .18s ease;}
      #dex-msg .dx-msg-card:hover{background:linear-gradient(155deg,rgba(255,255,255,.085),rgba(255,255,255,.03));border-color:var(--dx-msg-line-strong);transform:translateY(-2px);box-shadow:0 14px 30px rgba(0,0,0,.3);}
      #dex-msg .dx-msg-card:focus-visible{outline:2px solid var(--dx-msg-accent);outline-offset:2px;}
      #dex-msg .dx-msg-card::before{content:"";position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:0 3px 3px 0;background:var(--dx-msg-faint);}
      #dex-msg .dx-msg-card[data-source-type='submission']::before{background:var(--dx-msg-accent-rail);box-shadow:0 0 14px rgba(255,60,20,.45);}
      #dex-msg .dx-msg-card[data-source-type='pressroom']::before{background:linear-gradient(180deg,#46b6d0,#2f7fa8);}
      #dex-msg .dx-msg-card[data-source-type='system']::before{background:var(--dx-msg-muted);}
      #dex-msg .dx-msg-card[data-dx-msg-archived='true']{opacity:.6;}
      #dex-msg .dx-msg-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px;}
      #dex-msg .dx-msg-kicker{margin:0;font-size:.64rem;letter-spacing:.07em;text-transform:uppercase;color:var(--dx-msg-faint);}
      #dex-msg .dx-msg-dot{width:8px;height:8px;border-radius:999px;background:var(--dx-msg-accent);flex:0 0 auto;box-shadow:0 0 0 3px rgba(255,91,58,.18);}
      #dex-msg .dx-msg-heading{display:-webkit-box;min-width:0;max-width:100%;margin:0;overflow:hidden;overflow-wrap:anywhere;text-overflow:ellipsis;-webkit-box-orient:vertical;-webkit-line-clamp:2;font-family:'Stretch Pro','Typefesse',var(--dx-mono),sans-serif;font-size:.98rem;line-height:1.2;letter-spacing:.01em;color:var(--dx-msg-ink);}
      #dex-msg .dx-msg-snippet{margin:0;font-size:.78rem;line-height:1.4;color:var(--dx-msg-muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
      #dex-msg .dx-msg-card-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:1px;}
      #dex-msg .dx-msg-time{margin:0;font-size:.7rem;color:var(--dx-msg-faint);}
      #dex-msg .dx-msg-chip{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--dx-msg-line-strong);border-radius:999px;padding:3px 8px;font-size:.66rem;letter-spacing:.03em;text-transform:uppercase;color:var(--dx-msg-ink);background:rgba(255,255,255,.05);}
      #dex-msg .dx-msg-chip--critical{background:rgba(224,34,58,.16);border-color:rgba(224,34,58,.4);color:#f3b0b6;}
      #dex-msg .dx-msg-chip--warning{background:rgba(214,147,47,.16);border-color:rgba(214,147,47,.4);color:#f0cd93;}
      #dex-msg .dx-msg-chip--info{background:rgba(120,170,255,.12);border-color:rgba(120,170,255,.28);color:#c9d9ff;}
      #dex-msg .dx-msg-railmini{display:flex;gap:4px;align-items:center;}
      #dex-msg .dx-msg-railmini i{height:4px;flex:1;border-radius:999px;background:var(--dx-msg-line-strong);}
      #dex-msg .dx-msg-railmini i.on{background:var(--dx-msg-accent-grad);box-shadow:0 0 8px rgba(255,60,20,.4);}
      #dex-msg .dx-msg-lane-empty{margin:0;padding:14px 10px;font-size:.74rem;color:var(--dx-msg-faint);text-align:center;border:1px dashed var(--dx-msg-line);border-radius:9px;}
      #dex-msg .dx-msg-empty{margin:0;padding:16px;border:1px dashed var(--dx-msg-line-strong);border-radius:11px;background:rgba(255,255,255,.03);font-size:.86rem;color:var(--dx-msg-muted);}
      @media (max-width:900px){
        #dex-msg .dx-msg-board{grid-auto-flow:column;grid-auto-columns:78%;grid-template-columns:none;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;}
        #dex-msg .dx-msg-lane{scroll-snap-align:start;}
      }
      /* thread modal — black-glass surface matching the download modal */
      #dex-msg-modal{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;padding:clamp(12px,3vw,40px);font-family:var(--dx-mono,'Courier Prime',monospace);}
      #dex-msg-modal[data-open='true']{display:flex;}
      #dex-msg-modal .dx-msg-modal-backdrop{position:absolute;inset:0;background:rgba(6,7,10,.6);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);}
      #dex-msg-modal .dx-msg-modal-card{position:relative;z-index:1;width:min(720px,100%);max-height:min(86dvh,860px);display:flex;flex-direction:column;color:var(--dx-blackglass-ink,#f3f3f4);
        background:var(--dx-blackglass-bg,linear-gradient(145deg,rgba(15,16,21,.92),rgba(9,10,14,.88)));border:1px solid var(--dx-blackglass-rim,rgba(255,255,255,.16));border-radius:16px;
        box-shadow:0 30px 80px rgba(0,0,0,.6);backdrop-filter:var(--dx-blackglass-backdrop,blur(22px) saturate(135%));-webkit-backdrop-filter:var(--dx-blackglass-backdrop,blur(22px) saturate(135%));overflow:hidden;}
      #dex-msg-modal .dx-msg-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 20px;border-bottom:1px solid var(--dx-blackglass-line,rgba(255,255,255,.14));flex:0 0 auto;}
      #dex-msg-modal .dx-msg-modal-kicker{margin:0;font-size:.66rem;letter-spacing:.08em;text-transform:uppercase;color:var(--dx-blackglass-faint,rgba(255,255,255,.4));}
      #dex-msg-modal .dx-msg-modal-title{margin:5px 0 0;font-family:'Stretch Pro','Typefesse',var(--dx-mono),sans-serif;font-size:1.2rem;line-height:1.18;letter-spacing:.01em;color:var(--dx-blackglass-ink,#f3f3f4) !important;}
      #dex-msg-modal .dx-msg-modal-close{appearance:none;border:1px solid var(--dx-blackglass-line-strong,rgba(255,255,255,.26));background:rgba(255,255,255,.06);color:inherit;border-radius:999px;width:34px;height:34px;font-size:1.1rem;line-height:1;cursor:pointer;flex:0 0 auto;}
      #dex-msg-modal .dx-msg-modal-close:hover{background:rgba(255,255,255,.14);}
      #dex-msg-modal .dx-msg-modal-rail{display:flex;gap:5px;padding:13px 20px 4px;flex:0 0 auto;flex-wrap:wrap;}
      #dex-msg-modal .dx-msg-rail-step{flex:1 1 0;min-width:62px;display:flex;flex-direction:column;gap:5px;}
      #dex-msg-modal .dx-msg-rail-bar{height:4px;border-radius:4px;background:var(--dx-blackglass-line-strong,rgba(255,255,255,.26));}
      #dex-msg-modal .dx-msg-rail-step[data-state='done'] .dx-msg-rail-bar,#dex-msg-modal .dx-msg-rail-step[data-state='active'] .dx-msg-rail-bar{background:var(--dx-accent-solid,#ff5b3a);}
      #dex-msg-modal .dx-msg-rail-step[data-state='active'] .dx-msg-rail-bar{box-shadow:0 0 10px rgba(255,91,58,.5);}
      #dex-msg-modal .dx-msg-rail-label{font-size:.6rem;letter-spacing:.04em;text-transform:uppercase;color:var(--dx-blackglass-faint,rgba(255,255,255,.4));white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      #dex-msg-modal .dx-msg-rail-step[data-state='active'] .dx-msg-rail-label{color:var(--dx-blackglass-ink,#f3f3f4);}
      #dex-msg-modal .dx-msg-modal-body{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-anchor:none;padding:16px 20px;display:flex;flex-direction:column;gap:11px;}
      #dex-msg-modal .dx-msg-bubble{display:grid;gap:7px;padding:12px 14px;border:1px solid var(--dx-blackglass-line,rgba(255,255,255,.14));border-radius:12px;background:rgba(255,255,255,.05);animation:dx-msg-event-in .32s cubic-bezier(.2,.8,.2,1) both;}
      #dex-msg-modal .dx-msg-bubble--member{margin-left:auto;max-width:84%;background:rgba(255,91,58,.14);border-color:rgba(255,91,58,.32);}
      #dex-msg-modal .dx-msg-bubble--staff{margin-right:auto;max-width:88%;background:rgba(255,255,255,.07);}
      #dex-msg-modal .dx-msg-bubble--system{max-width:92%;margin-inline:auto;background:linear-gradient(135deg,rgba(255,255,255,.075),rgba(255,91,58,.055));}
      #dex-msg-modal .dx-msg-bubble[data-tone="success"]{border-color:rgba(103,211,153,.34);box-shadow:0 0 24px rgba(103,211,153,.07);}
      #dex-msg-modal .dx-msg-bubble[data-tone="warning"]{border-color:rgba(255,191,92,.36);}
      #dex-msg-modal .dx-msg-bubble-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;}
      #dex-msg-modal .dx-msg-bubble-type{margin:0;font-size:.66rem;letter-spacing:.06em;text-transform:uppercase;color:var(--dx-blackglass-faint,rgba(255,255,255,.4));}
      #dex-msg-modal .dx-msg-bubble-time{margin:0;font-size:.66rem;color:var(--dx-blackglass-faint,rgba(255,255,255,.4));}
      #dex-msg-modal .dx-msg-bubble-body{margin:0;font-size:.86rem;line-height:1.45;white-space:pre-wrap;}
      #dex-msg-modal .dx-msg-bubble-link{font-size:.76rem;color:var(--dx-accent-solid,#ff5b3a);text-decoration:none;}
      #dex-msg-modal .dx-msg-bubble-link:hover{text-decoration:underline;}
      #dex-msg-modal .dx-msg-modal-empty{margin:auto;color:var(--dx-blackglass-muted,rgba(255,255,255,.62));font-size:.85rem;text-align:center;}
      #dex-msg-modal .dx-msg-modal-foot{flex:0 0 auto;border-top:1px solid var(--dx-blackglass-line,rgba(255,255,255,.14));padding:14px 20px;display:grid;gap:9px;}
      #dex-msg-modal .dx-msg-composer{display:grid;gap:8px;}
      #dex-msg-modal .dx-msg-composer textarea{width:100%;resize:vertical;min-height:64px;border:1px solid var(--dx-blackglass-line-strong,rgba(255,255,255,.26));border-radius:10px;background:rgba(0,0,0,.28);color:inherit;padding:10px 12px;font:inherit;font-size:.86rem;}
      #dex-msg-modal .dx-msg-composer textarea:focus{outline:none;border-color:var(--dx-accent-solid,#ff5b3a);}
      #dex-msg-modal .dx-msg-composer-row{display:flex;align-items:center;justify-content:space-between;gap:10px;}
      #dex-msg-modal .dx-msg-composer-status{font-size:.74rem;color:var(--dx-blackglass-muted,rgba(255,255,255,.62));}
      #dex-msg-modal .dx-msg-modal-actions{display:flex;gap:8px;flex-wrap:wrap;}
      /* Modal lives outside #dex-msg, so it needs its own button skin (otherwise
         the buttons fall back to the white global control style). */
      #dex-msg-modal .dx-msg-btn{appearance:none;border:1px solid var(--dx-blackglass-line-strong,rgba(255,255,255,.26));background:rgba(255,255,255,.06);color:var(--dx-blackglass-ink,#f3f3f4);border-radius:999px;padding:9px 18px;font:inherit;font-size:.74rem;letter-spacing:.06em;text-transform:uppercase;line-height:1;cursor:pointer;transition:background .18s ease,border-color .18s ease,filter .18s ease;}
      #dex-msg-modal .dx-msg-btn:hover{background:rgba(255,255,255,.12);border-color:var(--dx-blackglass-rim,rgba(255,255,255,.32));}
      #dex-msg-modal .dx-msg-btn:disabled{opacity:.45;cursor:not-allowed;}
      #dex-msg-modal .dx-msg-btn--accent{border-color:transparent;background:var(--dx-accent-gradient,linear-gradient(120deg,#ff1910,#ff6a00));color:#fff;box-shadow:0 6px 18px rgba(255,60,20,.32);}
      #dex-msg-modal .dx-msg-btn--accent:hover{filter:brightness(1.07);border-color:transparent;}
      #dex-msg-modal .dx-msg-bubble--member .dx-msg-bubble-type{color:var(--dx-accent-solid,#ff5b3a);}
      #dex-msg-modal .dx-msg-bubble--staff .dx-msg-bubble-type{color:rgba(255,255,255,.82);}
      @keyframes dx-msg-event-in{from{opacity:0;transform:translateY(8px) scale(.99)}to{opacity:1;transform:none}}
      @media (prefers-reduced-motion:reduce){#dex-msg-modal .dx-msg-bubble{animation:none}}
      #dex-msg-modal .dx-msg-modal-note{margin:0;font-size:.72rem;color:var(--dx-blackglass-faint,rgba(255,255,255,.4));}
      @media (max-width:640px){
        #dex-msg-modal .dx-msg-modal-card{max-height:92dvh;}
      }
    `;
    document.head.appendChild(style);
  }

  function severityChipClass(severity) {
    if (severity === 'critical') return 'dx-msg-chip--critical';
    if (severity === 'warning') return 'dx-msg-chip--warning';
    return 'dx-msg-chip--info';
  }

  function normalizeFilter(value) {
    const filter = String(value || '').toLowerCase();
    if (filter === 'submission' || filter === 'pressroom' || filter === 'system') return filter;
    return 'all';
  }

  function visibleRecords(allRecords, filter, includeArchived) {
    return allRecords.filter((record) => {
      if (!includeArchived && record.archivedAt) return false;
      if (filter === 'submission') return record.sourceType === 'submission';
      if (filter === 'pressroom') return record.sourceType === 'pressroom';
      if (filter === 'system') return record.sourceType === 'system';
      return true;
    });
  }

  function unreadCount(allRecords) {
    return allRecords.filter((record) => !record.archivedAt && !record.readAt).length;
  }

  function dispatchUnreadCount(count) {
    const safeCount = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
    window.__dxMessagesUnreadCount = safeCount;
    try {
      window.dispatchEvent(new CustomEvent('dx:messages:unread-count', {
        detail: { count: safeCount },
      }));
    } catch {}
  }

  function compareByNewest(a, b) {
    const tsA = parseTimestamp(a.createdAt) || 0;
    const tsB = parseTimestamp(b.createdAt) || 0;
    return tsB - tsA;
  }

  function mergeRecords(submissions, system) {
    return [...submissions, ...system].sort(compareByNewest);
  }

  function findRecord(records, recordId) {
    return records.find((record) => record.id === recordId) || null;
  }

  function updateSubmissionState(scope, submissionState, recordId, patch) {
    const current = isObject(submissionState[recordId]) ? submissionState[recordId] : {};
    submissionState[recordId] = { ...current, ...patch };
    persistSubmissionState(scope, submissionState);
  }

  // ---- status-lane kanban helpers --------------------------------------
  const STAGE_FLOW = SUBMISSION_MEMBER_STAGE_FLOW;

  function statusToStage(status) {
    return normalizeSubmissionStage(status);
  }

  function submissionStageKey(record) {
    return statusToStage(record?.metadata?.status);
  }

  function threadStageKey(thread) {
    const stage = String(thread?.currentStage || '').toLowerCase();
    if (stage === 'rejected' || stage === 'revision_requested' || STAGE_FLOW.some((s) => s.key === stage)) return stage;
    return statusToStage(thread?.status);
  }

  function stageIndex(stage) {
    const i = STAGE_FLOW.findIndex((s) => s.key === stage);
    return i < 0 ? 2 : i;
  }

  function stageLabel(stage) {
    return submissionStageLabel(stage);
  }

  function stageSev(stage) {
    const s = String(stage || '').toLowerCase();
    if (s === 'rejected') return 'critical';
    if (s === 'needs_info' || s === 'revision_requested') return 'warning';
    return 'info';
  }

  function formatEventType(type) {
    const map = {
      lookup_generated: 'Lookup generated', lookup_finalized: 'Lookup finalized',
      bucket_assigned: 'Bucket assigned', acknowledged: 'Acknowledged',
      user_acknowledged: 'Acknowledged', request_submitted: 'Submitted',
      received: 'Received', reviewing: 'In review', accepted: 'Accepted',
      producing: 'Preparing entry', preflight: 'Preflight',
      rejected: 'Rejected', in_library: 'In library', message: 'Message',
      needs_info: 'Needs info',
    };
    return map[String(type || '').toLowerCase()] || '';
  }

  // Lane assignment: needs-you (member action) → in-progress → resolved.
  function laneFor(record) {
    if (record.archivedAt) return 'resolved';
    if (record.sourceType === 'submission') {
      const stage = submissionStageKey(record);
      if (stage === 'in_library' || stage === 'rejected' || stage === 'closed') return 'resolved';
      if (stage === 'needs_info' || stage === 'revision_requested') return 'needs';
      return 'progress';
    }
    // system / pressroom notifications: unread asks for attention, read is settled.
    return record.readAt ? 'progress' : 'needs';
  }

  function relativeTime(value) {
    const ts = parseTimestamp(value);
    if (ts === null) return '';
    const diff = Date.now() - ts;
    const min = 60000, hr = 3600000, day = 86400000;
    if (diff < min) return 'just now';
    if (diff < hr) return `${Math.floor(diff / min)}m ago`;
    if (diff < day) return `${Math.floor(diff / hr)}h ago`;
    if (diff < day * 7) return `${Math.floor(diff / day)}d ago`;
    return formatDateTime(value);
  }

  function railMiniHtml(stage) {
    const idx = stageIndex(stage);
    return `<div class="dx-msg-railmini" aria-hidden="true">${STAGE_FLOW
      .map((step, i) => `<i class="${i <= idx ? 'on' : ''}"></i>`)
      .join('')}</div>`;
  }

  function cardHtml(record) {
    const sourceLabel = record.sourceType === 'submission' ? 'Submission'
      : record.sourceType === 'pressroom' ? 'Pressroom' : 'System';
    const kind = record.sourceType === 'submission' ? normalizeSubmissionKind(record.metadata?.submissionKind) : '';
    const kindLabel = kind === 'call' ? 'Call' : kind === 'sample' ? 'Sample' : '';
    const kicker = [sourceLabel, kindLabel, record.category].filter(Boolean).join(' · ');
    const unreadDot = !record.readAt && !record.archivedAt ? '<span class="dx-msg-dot" aria-label="Unread"></span>' : '';
    const snippet = record.body ? `<p class="dx-msg-snippet">${escapeHtml(record.body)}</p>` : '';
    const stage = record.sourceType === 'submission' ? submissionStageKey(record) : '';
    const railMini = record.sourceType === 'submission' && stage !== 'rejected' ? railMiniHtml(stage) : '';
    const chipLabel = stage ? (stageLabel(stage) || record.metadata?.status || record.severity) : record.severity;
    const statusChip = `<span class="dx-msg-chip ${severityChipClass(stage ? stageSev(stage) : record.severity)}">${escapeHtml(chipLabel)}</span>`;
    const sid = sanitizeSubmissionId(record.metadata?.submissionId || '');
    const rid = sanitizeRequestId(record.metadata?.requestId || '');
    return `
      <button type="button" class="dx-msg-card" data-dx-msg-open="1" data-record-id="${escapeHtml(record.id)}" data-source-type="${escapeHtml(record.sourceType)}" data-dx-msg-archived="${record.archivedAt ? 'true' : 'false'}"${sid ? ` data-dx-submission-sid="${escapeHtml(sid)}"` : ''}${rid ? ` data-dx-request-id="${escapeHtml(rid)}"` : ''} data-dx-thread-kind="${record.sourceType === 'pressroom' ? 'pressroom' : 'submission'}">
        <div class="dx-msg-card-top"><p class="dx-msg-kicker">${escapeHtml(kicker)}</p>${unreadDot}</div>
        <h3 class="dx-msg-heading">${escapeHtml(record.title)}</h3>
        ${snippet}
        ${railMini}
        <div class="dx-msg-card-foot"><span class="dx-msg-time">${escapeHtml(relativeTime(record.createdAt))}</span>${statusChip}</div>
      </button>`;
  }

  function render(root, model) {
    ensureStyles();

    const sourceFiltered = visibleRecords(model.records, model.filter, model.showArchived);
    const unread = unreadCount(model.records);
    dispatchUnreadCount(unread);

    const lanes = [
      { key: 'needs', label: 'Needs you' },
      { key: 'progress', label: 'In progress' },
      { key: 'resolved', label: 'Resolved' },
    ];
    const byLane = { needs: [], progress: [], resolved: [] };
    for (const record of sourceFiltered) (byLane[laneFor(record)] || byLane.progress).push(record);

    const segs = [
      { key: 'all', label: 'All' },
      { key: 'submission', label: 'Submissions' },
      { key: 'pressroom', label: 'Pressroom' },
      { key: 'system', label: 'System' },
    ];
    const segHtml = segs
      .map((item) => `<button class="dx-msg-seg-btn${model.filter === item.key ? ' is-active' : ''}" type="button" role="tab" aria-selected="${model.filter === item.key}" data-dx-msg-filter="${item.key}">${item.label}</button>`)
      .join('');

    const warningsHtml = model.warnings
      .filter(Boolean)
      .map((warning) => `<p class="dx-msg-warning">${escapeHtml(warning)}</p>`)
      .join('');

    const lanesHtml = lanes
      .map((lane) => {
        const cards = byLane[lane.key];
        const body = cards.length ? cards.map(cardHtml).join('') : '<p class="dx-msg-lane-empty">Nothing here</p>';
        return `
          <section class="dx-msg-lane" data-lane="${lane.key}">
            <header class="dx-msg-lane-head">
              <p class="dx-msg-lane-label">${lane.label}</p>
              <span class="dx-msg-lane-count">${cards.length}</span>
            </header>
            <div class="dx-msg-lane-body">${body}</div>
          </section>`;
      })
      .join('');

    const boardHtml = sourceFiltered.length === 0
      ? '<p class="dx-msg-empty">No messages for this filter yet.</p>'
      : `<div class="dx-msg-board">${lanesHtml}</div>`;

    root.innerHTML = `
      <aside class="dx-msg-shell">
        <section class="dx-msg-head">
          <div>
            <h1 class="dx-msg-title">Inbox${unread ? ` <span class="dx-msg-badge">${unread}</span>` : ''}</h1>
            <p class="dx-msg-sub">Submissions, Pressroom, and account messages — one board.</p>
          </div>
          <div class="dx-msg-controls">
            <div class="dx-msg-seg" role="tablist" aria-label="Filter by source">${segHtml}</div>
            <label class="dx-msg-toggle"><input type="checkbox" data-dx-msg-toggle="archived" ${model.showArchived ? 'checked' : ''}> Archived</label>
            <button class="dx-msg-btn" type="button" data-dx-msg-action="read-all">Mark all read</button>
          </div>
        </section>
        ${warningsHtml}
        ${boardHtml}
      </aside>
    `;
  }

  // ---- thread modal (dark-glass surface) --------------------------------
  let modalKeyHandler = null;
  let modalLastFocus = null;

  function ensureModalEl() {
    let el = document.getElementById('dex-msg-modal');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'dex-msg-modal';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <div class="dx-msg-modal-backdrop" data-dx-msg-modal-close="1"></div>
      <div class="dx-msg-modal-card" role="dialog" aria-modal="true" aria-label="Conversation" tabindex="-1">
        <div class="dx-msg-modal-head">
          <div><p class="dx-msg-modal-kicker" data-dx-modal-kicker></p><h2 class="dx-msg-modal-title" data-dx-modal-title></h2></div>
          <button type="button" class="dx-msg-modal-close" data-dx-msg-modal-close="1" aria-label="Close">×</button>
        </div>
        <div class="dx-msg-modal-rail" data-dx-modal-rail hidden></div>
        <div class="dx-msg-modal-body" data-dx-modal-body></div>
        <div class="dx-msg-modal-foot" data-dx-modal-foot></div>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('[data-dx-msg-modal-close]')) closeThreadModal();
    });
    return el;
  }

  function closeThreadModal() {
    const el = document.getElementById('dex-msg-modal');
    if (!el) return;
    el.removeAttribute('data-open');
    el.setAttribute('aria-hidden', 'true');
    if (modalKeyHandler) {
      document.removeEventListener('keydown', modalKeyHandler);
      modalKeyHandler = null;
    }
    try { document.body.style.overflow = el.__dxPrevOverflow || ''; } catch {}
    if (modalLastFocus && typeof modalLastFocus.focus === 'function') {
      try { modalLastFocus.focus(); } catch {}
    }
  }

  function openModalShell(kicker, title) {
    const el = ensureModalEl();
    modalLastFocus = document.activeElement;
    el.querySelector('[data-dx-modal-kicker]').textContent = kicker || '';
    el.querySelector('[data-dx-modal-title]').textContent = title || '';
    const rail = el.querySelector('[data-dx-modal-rail]');
    rail.hidden = true;
    rail.innerHTML = '';
    el.querySelector('[data-dx-modal-body]').innerHTML = '<p class="dx-msg-modal-empty">Loading…</p>';
    el.querySelector('[data-dx-modal-foot]').innerHTML = '';
    el.setAttribute('data-open', 'true');
    el.setAttribute('aria-hidden', 'false');
    try { el.__dxPrevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; } catch {}
    modalKeyHandler = (event) => { if (event.key === 'Escape') closeThreadModal(); };
    document.addEventListener('keydown', modalKeyHandler);
    const card = el.querySelector('.dx-msg-modal-card');
    if (card) try { card.focus(); } catch {}
    return el;
  }

  async function loadThreadDetail(context, sid) {
    const response = await fetchJsonWithTimeout(
      `${context.apiBase}/me/submissions/${encodeURIComponent(sid)}`,
      { method: 'GET', headers: { authorization: `Bearer ${context.authSnapshot.token || ''}`, 'content-type': 'application/json' } },
      SUBMISSIONS_FETCH_TIMEOUT_MS,
    );
    if (!response.ok) return null;
    const payload = isObject(response.payload) ? response.payload : {};
    const threadPayload = isObject(payload.thread) ? payload.thread : (isObject(payload.submission) ? payload.submission : {});
    const rawTimeline = Array.isArray(payload.timeline) ? payload.timeline : (Array.isArray(payload.events) ? payload.events : []);
    const thread = {
      currentStage: toSafeText(threadPayload.currentStage || threadPayload.current_stage, ''),
      status: toSafeText(threadPayload.currentStatusRaw || threadPayload.current_status_raw || threadPayload.status, ''),
      lookup: toSafeText(threadPayload.lookup || threadPayload.effectiveLookupNumber || threadPayload.effective_lookup_number, ''),
      libraryHref: toSafeText(threadPayload.libraryHref || threadPayload.library_href || threadPayload.entryHref || threadPayload.entry_href, ''),
    };
    const timeline = rawTimeline
      .map((row, index) => normalizeTimelineEvent(row, index, thread))
      .filter(Boolean)
      .sort((a, b) => (parseTimestamp(a.createdAt) || 0) - (parseTimestamp(b.createdAt) || 0));
    return {
      thread,
      timeline,
    };
  }

  function normalizeTimelineEvent(row, index, thread = {}) {
    const normalized = normalizeSubmissionTimelineEvent(row, index, thread);
    if (!normalized.note && !normalized.statusRaw && !normalized.eventType) return null;
    return {
      ...normalized,
      author: normalized.actorType,
      link: normalized.presentation?.link?.href || normalized.link,
    };
  }

  function bubbleHtml(event) {
    const isMember = event.author === 'user';
    const isStaff = event.author === 'staff';
    const cls = isMember ? 'dx-msg-bubble--member' : isStaff ? 'dx-msg-bubble--staff' : 'dx-msg-bubble--system';
    const presentation = isObject(event.presentation) ? event.presentation : {};
    const title = toSafeText(presentation.title, formatEventType(event.eventType) || event.statusRaw || 'Update');
    const type = isMember
      ? 'You'
      : isStaff
        ? `${toSafeText(presentation.actorLabel, 'Dex team')} · ${title}`
        : title;
    const body = toSafeText(presentation.body, event.note || '');
    const note = body ? `<p class="dx-msg-bubble-body">${escapeHtml(body)}</p>` : '';
    const presentationLink = isObject(presentation.link) ? presentation.link : {};
    const linkHref = toSafeText(presentationLink.href, event.link || '');
    const linkLabel = toSafeText(presentationLink.label, 'Open link');
    const link = linkHref ? `<a class="dx-msg-bubble-link" href="${escapeHtml(linkHref)}" target="_blank" rel="noopener">${escapeHtml(linkLabel)} ↗</a>` : '';
    const chip = (event.statusRaw && !isMember) ? `<span class="dx-msg-chip ${severityChipClass(stageSev(event.eventType))}">${escapeHtml(event.statusRaw)}</span>` : '';
    const tone = toSafeText(presentation.tone, isMember ? 'member' : isStaff ? 'staff' : 'system');
    return `<article class="dx-msg-bubble ${cls}" data-actor="${escapeHtml(event.author)}" data-tone="${escapeHtml(tone)}"><div class="dx-msg-bubble-head"><p class="dx-msg-bubble-type">${escapeHtml(type)}</p><p class="dx-msg-bubble-time">${escapeHtml(relativeTime(event.createdAt))}</p></div>${note}${(chip || link) ? `<div>${chip}${link}</div>` : ''}</article>`;
  }

  function railHtml(stage) {
    if (stage === 'rejected') {
      return '<div class="dx-msg-rail-step" data-state="active" style="flex:1"><div class="dx-msg-rail-bar"></div><span class="dx-msg-rail-label">Not selected</span></div>';
    }
    if (stage === 'revision_requested') {
      return '<div class="dx-msg-rail-step" data-state="active" style="flex:1"><div class="dx-msg-rail-bar"></div><span class="dx-msg-rail-label">Revisions requested</span></div>';
    }
    const idx = stageIndex(stage);
    return STAGE_FLOW
      .map((step, i) => `<div class="dx-msg-rail-step" data-state="${i < idx ? 'done' : i === idx ? 'active' : 'todo'}"><div class="dx-msg-rail-bar"></div><span class="dx-msg-rail-label">${escapeHtml(step.label)}</span></div>`)
      .join('');
  }

  function openThreadModal(record, ctx) {
    ensureStyles();
    const kicker = record.sourceType === 'submission' ? 'Submission thread'
      : record.sourceType === 'pressroom' ? 'Pressroom request' : 'Notification';
    const el = openModalShell(kicker, record.title);
    if (record.sourceType === 'submission') {
      void renderSubmissionModal(el, record, ctx);
    } else {
      renderSimpleModal(el, record, ctx);
    }
  }

  async function renderSubmissionModal(el, record, ctx) {
    const { context, model, root } = ctx;
    const body = el.querySelector('[data-dx-modal-body]');
    const foot = el.querySelector('[data-dx-modal-foot]');
    const railEl = el.querySelector('[data-dx-modal-rail]');
    const sid = sanitizeSubmissionId(record.metadata?.submissionId || '');

    if (!record.readAt) {
      performRecordAction('read', record, context).then(() => render(root, model)).catch(() => {});
    }

    let detail = null;
    if (sid) {
      try { detail = await loadThreadDetail(context, sid); } catch { detail = null; }
    }

    const stage = detail?.thread ? threadStageKey(detail.thread) : submissionStageKey(record);
    railEl.hidden = false;
    railEl.innerHTML = railHtml(stage);

    const timeline = Array.isArray(detail?.timeline) ? detail.timeline : [];
    if (timeline.length) {
      body.innerHTML = timeline.map(bubbleHtml).join('');
    } else if (record.body) {
      body.innerHTML = `<article class="dx-msg-bubble dx-msg-bubble--system"><div class="dx-msg-bubble-head"><p class="dx-msg-bubble-type">Update</p><p class="dx-msg-bubble-time">${escapeHtml(relativeTime(record.createdAt))}</p></div><p class="dx-msg-bubble-body">${escapeHtml(record.body)}</p></article>`;
    } else {
      body.innerHTML = '<p class="dx-msg-modal-empty">No messages yet. Start the conversation below.</p>';
    }
    body.scrollTop = body.scrollHeight;

    const deepHref = sid ? `/entry/messages/submission/?sid=${encodeURIComponent(sid)}` : '/entry/submit/';
    foot.innerHTML = `
      <div class="dx-msg-composer">
        <textarea data-dx-msg-reply maxlength="2000" rows="3" placeholder="Add a message to your submission thread…"></textarea>
        <div class="dx-msg-composer-row">
          <span class="dx-msg-composer-status" data-dx-msg-reply-status aria-live="polite"></span>
          <div class="dx-msg-modal-actions">
            ${record.archivedAt ? '' : '<button type="button" class="dx-msg-btn" data-dx-msg-modal-action="archive">Archive</button>'}
            <button type="button" class="dx-msg-btn dx-msg-btn--accent" data-dx-msg-modal-action="reply"${sid ? '' : ' disabled'}>Send</button>
          </div>
        </div>
      </div>
      <p class="dx-msg-modal-note"><a class="dx-msg-bubble-link" href="${escapeHtml(deepHref)}">Open full thread ↗</a></p>`;

    foot.querySelectorAll('[data-dx-msg-modal-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const act = btn.getAttribute('data-dx-msg-modal-action');
        if (act === 'reply') {
          const textarea = foot.querySelector('[data-dx-msg-reply]');
          const statusEl = foot.querySelector('[data-dx-msg-reply-status]');
          const text = toSafeText(textarea && textarea.value, '');
          if (!text || !sid) return;
          btn.setAttribute('disabled', 'disabled');
          if (statusEl) statusEl.textContent = 'Sending…';
          try {
            const res = await fetchJsonWithTimeout(
              `${context.apiBase}/me/submissions/${encodeURIComponent(sid)}/messages`,
              { method: 'POST', headers: { authorization: `Bearer ${context.authSnapshot.token || ''}`, 'content-type': 'application/json' }, body: JSON.stringify({ body: text }) },
              ACTION_TIMEOUT_MS,
            );
            if (!res.ok) throw new Error('send failed');
            if (textarea) textarea.value = '';
            await renderSubmissionModal(el, record, ctx);
          } catch {
            if (statusEl) statusEl.textContent = 'Could not send right now.';
            btn.removeAttribute('disabled');
          }
          return;
        }
        if (act === 'archive') {
          btn.setAttribute('disabled', 'disabled');
          const result = await performRecordAction('archive', record, context);
          render(root, model);
          if (result.ok) closeThreadModal();
          else btn.removeAttribute('disabled');
        }
      });
    });
  }

  function renderSimpleModal(el, record, ctx) {
    const { context, model, root } = ctx;
    const body = el.querySelector('[data-dx-modal-body]');
    const foot = el.querySelector('[data-dx-modal-foot]');
    el.querySelector('[data-dx-modal-rail]').hidden = true;

    if (!record.readAt) {
      performRecordAction('read', record, context).then(() => render(root, model)).catch(() => {});
    }

    body.innerHTML = `<article class="dx-msg-bubble dx-msg-bubble--system"><div class="dx-msg-bubble-head"><p class="dx-msg-bubble-type">${escapeHtml(record.category || 'Notification')}</p><p class="dx-msg-bubble-time">${escapeHtml(relativeTime(record.createdAt))}</p></div>${record.body ? `<p class="dx-msg-bubble-body">${escapeHtml(record.body)}</p>` : '<p class="dx-msg-modal-empty">No additional details.</p>'}</article>`;

    const rid = sanitizeRequestId(record.metadata?.requestId || '');
    const deepHref = record.sourceType === 'pressroom' && rid
      ? `/entry/messages/submission/?kind=pressroom&rid=${encodeURIComponent(rid)}`
      : toSafeText(record.href, '');
    foot.innerHTML = `
      <div class="dx-msg-modal-actions">
        ${record.archivedAt ? '' : '<button type="button" class="dx-msg-btn" data-dx-simple-action="archive">Archive</button>'}
        ${deepHref ? `<a class="dx-msg-btn dx-msg-btn--accent" href="${escapeHtml(deepHref)}">Open ↗</a>` : ''}
      </div>`;
    foot.querySelectorAll('[data-dx-simple-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.setAttribute('disabled', 'disabled');
        const result = await performRecordAction('archive', record, context);
        render(root, model);
        if (result.ok) closeThreadModal();
        else btn.removeAttribute('disabled');
      });
    });
  }

  // Shared record mutation used by the board + the modal.
  async function performRecordAction(action, record, context) {
    const now = nowIso();
    if (action === 'read' || action === 'unread') {
      const value = action === 'read' ? now : '';
      const previous = record.readAt;
      record.readAt = value;
      if (record.sourceType !== 'system') {
        updateSubmissionState(context.scope, context.submissionState, record.id, { readAt: value });
        return { ok: true };
      }
      const response = await mutateSystemRecord(context.apiBase, context.authSnapshot, record.id, action);
      if (!response.ok) { record.readAt = previous; return { ok: false, warning: `Unable to mark message as ${action} right now.` }; }
      return { ok: true };
    }
    if (action === 'archive') {
      const previous = record.archivedAt;
      record.archivedAt = now;
      if (record.sourceType !== 'system') {
        updateSubmissionState(context.scope, context.submissionState, record.id, { archivedAt: now });
        return { ok: true };
      }
      const response = await mutateSystemRecord(context.apiBase, context.authSnapshot, record.id, 'archive');
      if (!response.ok) { record.archivedAt = previous; return { ok: false, warning: 'Unable to archive message right now.' }; }
      return { ok: true };
    }
    if (action === 'ack') {
      if (record.sourceType !== 'submission') return { ok: false };
      const submissionId = toSafeText(record.metadata?.submissionId, '');
      if (!submissionId) return { ok: false, warning: 'Unable to acknowledge submission right now.' };
      const ackResult = await fetchJsonWithTimeout(
        `${context.apiBase}/me/submissions/${encodeURIComponent(submissionId)}/ack`,
        { method: 'POST', headers: { authorization: `Bearer ${context.authSnapshot.token || ''}`, 'content-type': 'application/json' } },
        ACTION_TIMEOUT_MS,
      );
      if (!ackResult.ok) return { ok: false, warning: 'Unable to acknowledge submission right now.' };
      record.readAt = now;
      updateSubmissionState(context.scope, context.submissionState, record.id, { readAt: now });
      return { ok: true };
    }
    return { ok: false };
  }

  function bindHandlers(root, model, context) {
    if (root.__dxMessagesEventAbortController instanceof AbortController) {
      try {
        root.__dxMessagesEventAbortController.abort();
      } catch {}
    }
    const eventAbortController = new AbortController();
    root.__dxMessagesEventAbortController = eventAbortController;
    const eventOptions = { signal: eventAbortController.signal };

    root.addEventListener('click', async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      // Segmented source filter.
      const seg = target.closest('[data-dx-msg-filter]');
      if (seg instanceof HTMLElement) {
        model.filter = normalizeFilter(seg.getAttribute('data-dx-msg-filter'));
        render(root, model);
        return;
      }

      // Open a card → thread modal.
      const openCard = target.closest('[data-dx-msg-open]');
      if (openCard instanceof HTMLElement) {
        const record = findRecord(model.records, openCard.getAttribute('data-record-id'));
        if (record) openThreadModal(record, { context, model, root });
        return;
      }

      const action = target.getAttribute('data-dx-msg-action');
      if (action === 'read-all') {
        const visible = visibleRecords(model.records, model.filter, model.showArchived).filter((record) => !record.readAt);
        if (!visible.length) return;
        target.setAttribute('disabled', 'disabled');
        const markedAt = nowIso();
        for (const record of visible) {
          record.readAt = markedAt;
          if (record.sourceType !== 'system') {
            updateSubmissionState(context.scope, context.submissionState, record.id, { readAt: markedAt });
          }
        }
        if (visible.some((record) => record.sourceType === 'system')) {
          const response = await mutateSystemRecord(context.apiBase, context.authSnapshot, '', 'read-all');
          if (!response.ok) {
            model.warnings = [...model.warnings, 'Unable to persist bulk read for system notifications right now.'];
          }
        }
        render(root, model);
      }
    }, eventOptions);

    root.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.getAttribute('data-dx-msg-toggle') !== 'archived') return;
      if (target instanceof HTMLInputElement) {
        model.showArchived = !!target.checked;
        render(root, model);
      }
    }, eventOptions);
  }

  async function renderSignedOut(root) {
    root.innerHTML = `
      <aside class="dx-msg-shell">
        <section class="dx-msg-head">
          <div>
            <h1 class="dx-msg-title">Inbox</h1>
            <p class="dx-msg-sub">Sign in to view submission, Pressroom, and account messages.</p>
          </div>
        </section>
        <p class="dx-msg-empty" id="dx-msg-signin">Please sign in to view your inbox.</p>
      </aside>
    `;
    dispatchUnreadCount(0);
  }

  async function boot(root) {
    const startTs = performance.now();
    setFetchState(root, FETCH_STATE_LOADING);

    const authSnapshot = await resolveAuthSnapshot(AUTH_TIMEOUT_MS);
    const scope = getScope(authSnapshot);
    const submissionState = loadSubmissionState(scope);
    const apiBase = toApiBase(root);

    if (!authSnapshot.authenticated || !scope || scope === 'anon') {
      ensureStyles();
      await renderSignedOut(root);
      const elapsed = performance.now() - startTs;
      if (elapsed < DX_MIN_SHEEN_MS) await delay(DX_MIN_SHEEN_MS - elapsed);
      setFetchState(root, FETCH_STATE_READY);
      return;
    }

    const cachedSubmissionRecords = readPrefetchedRecords(scope, 'submission') || [];
    const cachedPressroomRecords = readPrefetchedRecords(scope, 'pressroom') || [];
    const cachedSystemRecords = readPrefetchedRecords(scope, 'system') || [];
    const model = {
      records: mergeRecords(
        mergeRecords(cachedSubmissionRecords, cachedPressroomRecords),
        cachedSystemRecords,
      ),
      filter: 'all',
      showArchived: false,
      warnings: [],
    };

    if (cachedSubmissionRecords.length > 0 || cachedPressroomRecords.length > 0 || cachedSystemRecords.length > 0) {
      model.warnings.push('Refreshing inbox…');
      render(root, model);
      bindHandlers(root, model, {
        apiBase,
        authSnapshot,
        scope,
        submissionState,
      });
    }

    let submissionRecords = [];
    let pressroomRecords = [];
    let systemRecords = [];
    const warnings = [];
    let hasFatal = false;

    const settled = await Promise.allSettled([
      loadSubmissionRecords(apiBase, authSnapshot, submissionState),
      loadPressroomRecords(apiBase, authSnapshot, submissionState),
      loadSystemRecords(apiBase, authSnapshot),
    ]);

    const submissionSettled = settled[0];
    const pressroomSettled = settled[1];
    const systemSettled = settled[2];

    if (submissionSettled.status === 'fulfilled') {
      const submissionResult = submissionSettled.value;
      submissionRecords = Array.isArray(submissionResult.records) ? submissionResult.records : [];
      if (submissionResult.warning) warnings.push(submissionResult.warning);
      writePrefetchedRecords(scope, 'submission', submissionRecords);
    } else {
      warnings.push('Submissions are temporarily unavailable.');
    }

    if (pressroomSettled.status === 'fulfilled') {
      const pressroomResult = pressroomSettled.value;
      pressroomRecords = Array.isArray(pressroomResult.records) ? pressroomResult.records : [];
      if (pressroomResult.warning) warnings.push(pressroomResult.warning);
      writePrefetchedRecords(scope, 'pressroom', pressroomRecords);
    } else {
      warnings.push('Pressroom requests are temporarily unavailable.');
    }

    if (systemSettled.status === 'fulfilled') {
      const systemResult = systemSettled.value;
      systemRecords = Array.isArray(systemResult.records) ? systemResult.records : [];
      if (systemResult.warning) warnings.push(systemResult.warning);
      writePrefetchedRecords(scope, 'system', systemRecords);
    } else {
      warnings.push('System notifications are temporarily unavailable.');
    }

    hasFatal =
      submissionSettled.status === 'rejected'
      && pressroomSettled.status === 'rejected'
      && systemSettled.status === 'rejected';

    if (hasFatal && model.records.length === 0) {
      ensureStyles();
      root.innerHTML = `
        <aside class="dx-msg-shell">
          <section class="dx-msg-head">
            <div>
              <h1 class="dx-msg-title">Inbox</h1>
              <p class="dx-msg-sub">Unable to load inbox right now.</p>
            </div>
          </section>
          <p class="dx-msg-empty">Try refreshing this page. If the issue persists, visit support.</p>
        </aside>
      `;
      dispatchUnreadCount(0);
      const elapsed = performance.now() - startTs;
      if (elapsed < DX_MIN_SHEEN_MS) await delay(DX_MIN_SHEEN_MS - elapsed);
      setFetchState(root, FETCH_STATE_ERROR);
      return;
    }

    if (!hasFatal) {
      model.records = mergeRecords(mergeRecords(submissionRecords, pressroomRecords), systemRecords);
      model.warnings = warnings;
    } else if (model.records.length > 0) {
      model.warnings = ['Showing cached inbox data while live sync recovers.'];
    }

    render(root, model);
    bindHandlers(root, model, {
      apiBase,
      authSnapshot,
      scope,
      submissionState,
    });

    const elapsed = performance.now() - startTs;
    if (elapsed < DX_MIN_SHEEN_MS) await delay(DX_MIN_SHEEN_MS - elapsed);
    setFetchState(root, FETCH_STATE_READY);
  }

  async function mount(options = {}) {
    const root = document.getElementById('dex-msg');
    if (!(root instanceof HTMLElement)) return false;

    const force = !!options.force;
    const booting = root.getAttribute('data-dx-msg-booting') === 'true';
    const mounted = root.getAttribute('data-dx-msg-mounted') === 'true';
    if (booting) return true;
    if (mounted && !force) return true;

    root.setAttribute('data-dx-msg-booting', 'true');
    if (force) root.removeAttribute('data-dx-msg-mounted');
    try {
      await boot(root);
      root.setAttribute('data-dx-msg-mounted', 'true');
      return true;
    } catch {
      setFetchState(root, FETCH_STATE_ERROR);
      return false;
    } finally {
      root.removeAttribute('data-dx-msg-booting');
    }
  }

  function scheduleMount(options = {}) {
    mount(options).catch(() => {});
  }

  window.__dxMessagesInboxMount = () => {
    scheduleMount();
  };

  window.addEventListener('dx:slotready', () => {
    scheduleMount({ force: true });
  });
  window.addEventListener('dex-auth:ready', () => {
    scheduleMount({ force: true });
  });
  window.addEventListener('dex-auth:state', () => {
    scheduleMount({ force: true });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      scheduleMount({ force: true });
    }, { once: true });
  } else {
    scheduleMount({ force: true });
  }
})();
