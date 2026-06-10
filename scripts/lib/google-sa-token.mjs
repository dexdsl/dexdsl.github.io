// Mint a read-only Google access token from a service-account JSON key using only
// Node's built-in crypto (no external deps). Used by recording-index tooling to
// call the Sheets API v4, which is the only source that exposes per-cell text-run
// hyperlinks (xlsx/ods/gviz exports collapse a cell to a single link).
import fs from 'node:fs';
import crypto from 'node:crypto';

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function candidatePaths(explicitPath) {
  return [
    explicitPath,
    process.env.DEX_SHEETS_SA_KEY,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    'scripts/.secrets/sheets-sa.json',
    '.secrets/sheets-sa.json',
  ].filter(Boolean);
}

export function hasServiceAccount(explicitPath) {
  return candidatePaths(explicitPath).some((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });
}

export function resolveServiceAccount(explicitPath) {
  for (const p of candidatePaths(explicitPath)) {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  throw new Error(
    'No service-account key found. Set DEX_SHEETS_SA_KEY / GOOGLE_APPLICATION_CREDENTIALS or place .secrets/sheets-sa.json',
  );
}

export async function getAccessToken({
  keyPath,
  scope = 'https://www.googleapis.com/auth/spreadsheets.readonly',
} = {}) {
  const sa = resolveServiceAccount(keyPath);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope,
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(signingInput)
    .sign(sa.private_key);
  const assertion = `${signingInput}.${b64url(signature)}`;

  const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`token exchange failed (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  if (!json.access_token) throw new Error('token exchange returned no access_token');
  return json.access_token;
}
