import crypto from 'node:crypto';

const DEFAULT_API_BY_ENV = {
  prod: 'https://dex-api.spring-fog-8edd.workers.dev',
  test: 'https://dex-api.spring-fog-8edd.workers.dev',
};

function toText(value) {
  return String(value ?? '').trim();
}

export function normalizeOpsEnv(value) {
  const raw = toText(value).toLowerCase();
  if (!raw || raw === 'test' || raw === 'sandbox' || raw === 'staging') return 'test';
  if (raw === 'prod' || raw === 'production') return 'prod';
  throw new Error(`Unsupported ops env: ${value}`);
}

export function normalizeOpsKind(value, fallback = '') {
  const raw = toText(value).toLowerCase();
  if (!raw) return fallback;
  if (raw === 'submissions') return 'submission';
  if (raw === 'pressroom') return 'press';
  if (['submission', 'press', 'board', 'support', 'all'].includes(raw)) return raw;
  throw new Error(`Unsupported ops kind: ${value}`);
}

export function normalizeOpsApiBase(value) {
  const parsed = new URL(toText(value));
  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new Error(`Unsupported API protocol: ${parsed.protocol}`);
  }
  return parsed.toString().replace(/\/$/, '');
}

export function resolveOpsApiBase(envName = 'test', override = '') {
  if (override) return normalizeOpsApiBase(override);
  const env = normalizeOpsEnv(envName);
  const fromEnv = env === 'prod'
    ? process.env.DEX_OPS_API_BASE_PROD || process.env.DEX_API_BASE_PROD || process.env.DEX_API_BASE_URL
    : process.env.DEX_OPS_API_BASE_TEST || process.env.DEX_API_BASE_TEST || process.env.DEX_API_BASE_URL;
  return normalizeOpsApiBase(fromEnv || DEFAULT_API_BY_ENV[env]);
}

export function resolveOpsAdminToken(envName = 'test', override = '') {
  const env = normalizeOpsEnv(envName);
  const direct = env === 'prod'
    ? process.env.DEX_OPS_ADMIN_TOKEN_PROD || process.env.DEX_ADMIN_TOKEN_PROD
    : process.env.DEX_OPS_ADMIN_TOKEN_TEST || process.env.DEX_ADMIN_TOKEN_TEST;
  const token = toText(override || direct || process.env.DEX_OPS_ADMIN_TOKEN || process.env.DEX_ADMIN_TOKEN || process.env.DEX_MAINTENANCE_TOKEN);
  if (!token) {
    throw new Error(
      `Missing ops admin token for ${env}. Set DEX_OPS_ADMIN_TOKEN_${env.toUpperCase()} or shared DEX_OPS_ADMIN_TOKEN.`,
    );
  }
  return token;
}

function parseResponseText(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

function serializeQuery(query = {}) {
  const params = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(query || {})) {
    if (rawValue == null) continue;
    const value = toText(rawValue);
    if (!value) continue;
    params.set(key, value);
  }
  const out = params.toString();
  return out ? `?${out}` : '';
}

export async function requestOpsApi(pathname, {
  env = 'test',
  apiBase = '',
  adminToken = '',
  method = 'GET',
  query = null,
  body = null,
  idempotencyKey = '',
} = {}) {
  const resolvedEnv = normalizeOpsEnv(env);
  const resolvedBase = resolveOpsApiBase(resolvedEnv, apiBase);
  const requestId = crypto.randomUUID();
  const headers = {
    accept: 'application/json',
    authorization: `Bearer ${resolveOpsAdminToken(resolvedEnv, adminToken)}`,
    'x-dx-request-id': requestId,
  };
  if (body != null) headers['content-type'] = 'application/json';
  if (idempotencyKey) headers['x-dx-idempotency-key'] = toText(idempotencyKey);

  const response = await fetch(`${resolvedBase}${pathname}${serializeQuery(query || {})}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const payload = parseResponseText(text);
  if (!response.ok) {
    const detail = payload && typeof payload === 'object'
      ? JSON.stringify(payload)
      : String(payload || text || '');
    throw new Error(`${method} ${pathname} failed (${response.status}): ${detail}`);
  }
  return {
    env: resolvedEnv,
    apiBase: resolvedBase,
    requestId,
    payload,
  };
}

export async function listOpsTickets({
  env = 'test',
  apiBase = '',
  adminToken = '',
  kind = 'all',
  status = '',
  limit = 50,
} = {}) {
  const normalizedKind = normalizeOpsKind(kind, 'all');
  return requestOpsApi('/admin/ops/tickets', {
    env,
    apiBase,
    adminToken,
    query: {
      kind: normalizedKind === 'all' ? '' : normalizedKind,
      status,
      limit: Math.max(1, Math.min(200, Math.trunc(Number(limit) || 50))),
    },
  });
}

export async function getOpsTicket({ ticketId, env = 'test', apiBase = '', adminToken = '' } = {}) {
  const id = toText(ticketId);
  if (!id) throw new Error('ticketId is required');
  return requestOpsApi(`/admin/ops/tickets/${encodeURIComponent(id)}`, {
    env,
    apiBase,
    adminToken,
  });
}

export async function createOpsTicket({
  env = 'test',
  apiBase = '',
  adminToken = '',
  kind = 'support',
  title = '',
  message = '',
  email = '',
  name = '',
  status = 'received',
  priority = '',
  assignee = '',
  metadata = null,
  idempotencyKey = '',
} = {}) {
  const normalizedKind = normalizeOpsKind(kind, 'support');
  return requestOpsApi('/admin/ops/tickets', {
    env,
    apiBase,
    adminToken,
    method: 'POST',
    idempotencyKey: idempotencyKey || crypto.randomUUID(),
    body: {
      kind: normalizedKind,
      title,
      message,
      email,
      name,
      status,
      priority,
      assignee,
      metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
    },
  });
}

export async function patchOpsTicket({
  ticketId,
  env = 'test',
  apiBase = '',
  adminToken = '',
  status,
  assignee,
  priority,
  title,
  publicNote,
  internalNote,
  metadata,
} = {}) {
  const id = toText(ticketId);
  if (!id) throw new Error('ticketId is required');
  const body = {};
  for (const [key, value] of Object.entries({
    status,
    assignee,
    priority,
    title,
    publicNote,
    internalNote,
    metadata,
  })) {
    if (value !== undefined) body[key] = value;
  }
  return requestOpsApi(`/admin/ops/tickets/${encodeURIComponent(id)}`, {
    env,
    apiBase,
    adminToken,
    method: 'PATCH',
    body,
  });
}

export async function replyOpsTicket({
  ticketId,
  env = 'test',
  apiBase = '',
  adminToken = '',
  message = '',
  publicNote = '',
  internalNote = '',
  status = '',
} = {}) {
  const id = toText(ticketId);
  if (!id) throw new Error('ticketId is required');
  return requestOpsApi(`/admin/ops/tickets/${encodeURIComponent(id)}/messages`, {
    env,
    apiBase,
    adminToken,
    method: 'POST',
    body: {
      message: toText(message || publicNote),
      publicNote: toText(publicNote || message),
      internalNote,
      status,
    },
  });
}

export async function importOpsRows({
  env = 'test',
  apiBase = '',
  adminToken = '',
  kind = 'support',
  rows = [],
  dryRun = true,
  idempotencyKey = '',
} = {}) {
  const normalizedKind = normalizeOpsKind(kind, 'support');
  if (!Array.isArray(rows)) throw new Error('rows must be an array');
  return requestOpsApi('/admin/ops/import', {
    env,
    apiBase,
    adminToken,
    method: 'POST',
    idempotencyKey: idempotencyKey || crypto.randomUUID(),
    body: {
      kind: normalizedKind,
      rows,
      dryRun: dryRun !== false,
      write: dryRun === false,
    },
  });
}

// ---------------------------------------------------------------------------
// Submission threads / kanban board (messaging-kanban-system.md, P1/P2)
// ---------------------------------------------------------------------------

export async function listAdminThreads({ env = 'test', kind = '', apiBase = '', adminToken = '' } = {}) {
  return requestOpsApi('/admin/threads', {
    env,
    apiBase,
    adminToken,
    query: kind ? { kind } : {},
  });
}

export async function getAdminThread({ env = 'test', submissionId, apiBase = '', adminToken = '' } = {}) {
  const id = toText(submissionId);
  if (!id) throw new Error('submissionId is required');
  return requestOpsApi(`/admin/threads/${encodeURIComponent(id)}`, { env, apiBase, adminToken });
}

export async function patchAdminThread({ env = 'test', submissionId, patch = {}, apiBase = '', adminToken = '' } = {}) {
  const id = toText(submissionId);
  if (!id) throw new Error('submissionId is required');
  return requestOpsApi(`/admin/threads/${encodeURIComponent(id)}`, {
    env,
    apiBase,
    adminToken,
    method: 'PATCH',
    body: patch,
  });
}

export async function postAdminThreadMessage({ env = 'test', submissionId, body = '', visibility = 'public', apiBase = '', adminToken = '' } = {}) {
  const id = toText(submissionId);
  if (!id) throw new Error('submissionId is required');
  return requestOpsApi(`/admin/threads/${encodeURIComponent(id)}/messages`, {
    env,
    apiBase,
    adminToken,
    method: 'POST',
    body: { body: toText(body, '', 4000), visibility: visibility === 'internal' ? 'internal' : 'public' },
  });
}

export async function postAdminThreadAction({
  env = 'test',
  submissionId,
  action,
  apiBase = '',
  adminToken = '',
  idempotencyKey = '',
} = {}) {
  const id = toText(submissionId);
  if (!id) throw new Error('submissionId is required');
  if (!action || typeof action !== 'object') throw new Error('action is required');
  const key = toText(idempotencyKey || action.idempotencyKey || crypto.randomUUID());
  return requestOpsApi(`/admin/threads/${encodeURIComponent(id)}/actions`, {
    env,
    apiBase,
    adminToken,
    method: 'POST',
    idempotencyKey: key,
    body: { ...action, idempotencyKey: key },
  });
}

export async function getAdminThreadsAudit({
  env = 'test',
  verifyLive = false,
  apiBase = '',
  adminToken = '',
} = {}) {
  return requestOpsApi('/admin/threads/audit', {
    env,
    apiBase,
    adminToken,
    query: verifyLive ? { verifyLive: '1' } : {},
  });
}
