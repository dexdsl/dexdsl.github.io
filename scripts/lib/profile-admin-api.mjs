import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_API_BY_ENV = {
  prod: 'https://dex-api.spring-fog-8edd.workers.dev',
  test: 'https://dex-api.spring-fog-8edd.workers.dev',
};

function toText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

export function normalizeProfilesEnv(value) {
  const raw = toText(value || 'test').toLowerCase();
  if (raw === 'prod' || raw === 'production') return 'prod';
  if (raw === 'test' || raw === 'staging' || raw === 'sandbox') return 'test';
  throw new Error(`Unsupported profiles env: ${value}`);
}

export function normalizeApiBase(value) {
  const parsed = new URL(toText(value));
  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new Error(`Unsupported API protocol: ${parsed.protocol}`);
  }
  return parsed.toString().replace(/\/$/, '');
}

export function resolveProfilesApiBase(envName = 'test') {
  const env = normalizeProfilesEnv(envName);
  const fromEnv = env === 'prod'
    ? process.env.DEX_PROFILES_API_BASE_PROD || process.env.DEX_API_BASE_PROD || process.env.DEX_API_BASE_URL
    : process.env.DEX_PROFILES_API_BASE_TEST || process.env.DEX_API_BASE_TEST || process.env.DEX_API_BASE_URL;
  return normalizeApiBase(fromEnv || DEFAULT_API_BY_ENV[env]);
}

export function resolveProfilesAdminToken(envName = 'test') {
  const env = normalizeProfilesEnv(envName);
  const direct = env === 'prod'
    ? process.env.DEX_PROFILES_ADMIN_TOKEN_PROD || process.env.PROFILES_ADMIN_TOKEN_PROD
    : process.env.DEX_PROFILES_ADMIN_TOKEN_TEST || process.env.PROFILES_ADMIN_TOKEN_TEST;
  const shared = process.env.DEX_PROFILES_ADMIN_TOKEN
    || process.env.PROFILES_ADMIN_TOKEN
    || process.env.DEX_MAINTENANCE_TOKEN;
  const token = toText(direct || shared);
  if (!token) {
    throw new Error(
      `Missing profiles admin token for ${env}. Set DEX_PROFILES_ADMIN_TOKEN_${env.toUpperCase()} or shared DEX_PROFILES_ADMIN_TOKEN / PROFILES_ADMIN_TOKEN / DEX_MAINTENANCE_TOKEN.`,
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

export async function requestProfilesApi(pathname, {
  env = 'test',
  method = 'GET',
  query = null,
  body = null,
  admin = true,
  apiBase = '',
  adminToken = '',
} = {}) {
  const resolvedEnv = normalizeProfilesEnv(env);
  const base = normalizeApiBase(apiBase || resolveProfilesApiBase(resolvedEnv));
  const headers = { accept: 'application/json' };
  if (body != null) headers['content-type'] = 'application/json';
  if (admin) headers.authorization = `Bearer ${toText(adminToken) || resolveProfilesAdminToken(resolvedEnv)}`;

  const response = await fetch(`${base}${pathname}${serializeQuery(query)}`, {
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
  return { env: resolvedEnv, apiBase: base, payload };
}

export async function listProfileClaims({ env = 'test', status = 'pending', limit = 50, apiBase, adminToken } = {}) {
  return requestProfilesApi('/admin/profiles/claims', {
    env,
    apiBase,
    adminToken,
    query: {
      status: toText(status, 'pending'),
      limit: Math.max(1, Math.min(200, Math.trunc(Number(limit) || 50))),
    },
  });
}

export async function updateProfileClaim({ env = 'test', claimId, status, role, apiBase, adminToken } = {}) {
  const id = toText(claimId);
  if (!id) throw new Error('claimId is required');
  const nextStatus = toText(status).toLowerCase();
  if (!['pending', 'approved', 'rejected', 'withdrawn'].includes(nextStatus)) {
    throw new Error(`Unsupported claim status: ${status}`);
  }
  const body = { status: nextStatus };
  if (role !== undefined) body.role = toText(role);
  return requestProfilesApi(`/admin/profiles/claims/${encodeURIComponent(id)}`, {
    env,
    apiBase,
    adminToken,
    method: 'PATCH',
    body,
  });
}

export function approveProfileClaim(options = {}) {
  return updateProfileClaim({ ...options, status: 'approved' });
}

export function rejectProfileClaim(options = {}) {
  return updateProfileClaim({ ...options, status: 'rejected' });
}

export async function getPublicProfilesMap({ env = 'test', apiBase, adminToken } = {}) {
  return requestProfilesApi('/admin/profiles/public-map', {
    env,
    apiBase,
    adminToken,
  });
}

export async function writePublicProfilesMap(payload, {
  out = 'data/public-profiles.json',
  mirror = true,
  rootDir = process.cwd(),
} = {}) {
  const body = {
    generated_at: toText(payload?.generated_at) || new Date().toISOString(),
    source: toText(payload?.source, 'dex-api-admin-profiles'),
    entries: payload?.entries && typeof payload.entries === 'object' && !Array.isArray(payload.entries)
      ? payload.entries
      : {},
    profiles: payload?.profiles && typeof payload.profiles === 'object' && !Array.isArray(payload.profiles)
      ? payload.profiles
      : {},
  };
  const targets = [path.resolve(rootDir, out)];
  if (mirror) {
    targets.push(path.resolve(rootDir, 'docs/data/public-profiles.json'));
    targets.push(path.resolve(rootDir, 'public/data/public-profiles.json'));
  }
  const content = `${JSON.stringify(body, null, 2)}\n`;
  for (const target of targets) {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, 'utf8');
  }
  return {
    targets,
    entries: Object.keys(body.entries).length,
    profiles: Object.keys(body.profiles).length,
  };
}
