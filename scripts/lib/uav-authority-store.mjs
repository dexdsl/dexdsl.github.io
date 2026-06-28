import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { UAV_AUTHORITIES_VERSION, uavAuthoritiesSchema } from './uav-schema.mjs';

function text(value) {
  return String(value ?? '').trim();
}

function configHome() {
  if (text(process.env.DEX_CONFIG_DIR)) return path.resolve(process.env.DEX_CONFIG_DIR);
  if (process.platform === 'win32') return text(process.env.APPDATA) || path.join(os.homedir(), 'AppData', 'Roaming');
  return text(process.env.XDG_CONFIG_HOME) || path.join(os.homedir(), '.config');
}

export function getUavPrivateSitesPath() {
  return text(process.env.DEX_UAV_PRIVATE_SITES_FILE)
    ? path.resolve(process.env.DEX_UAV_PRIVATE_SITES_FILE)
    : path.join(configHome(), 'dexdsl', 'uav-sites.private.json');
}

export async function readUavPrivateSites(filePath = getUavPrivateSitesPath()) {
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, 'utf8'));
    return {
      version: 'uav-private-sites-v1',
      sites: parsed?.sites && typeof parsed.sites === 'object' ? parsed.sites : {},
    };
  } catch (error) {
    if (error?.code === 'ENOENT') return { version: 'uav-private-sites-v1', sites: {} };
    throw error;
  }
}

async function atomicWrite(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temp, filePath);
  await fs.chmod(filePath, 0o600).catch(() => {});
}

export async function writeUavPrivateSite(siteId, coordinates, filePath = getUavPrivateSitesPath()) {
  const id = text(siteId);
  if (!id) throw new Error('siteId is required');
  const lat = Number(coordinates?.lat);
  const lon = Number(coordinates?.lon);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error('Private latitude is invalid');
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) throw new Error('Private longitude is invalid');
  const current = await readUavPrivateSites(filePath);
  current.sites[id] = { lat, lon, updatedAt: new Date().toISOString() };
  await atomicWrite(filePath, current);
  return { filePath, siteId: id, stored: true };
}

export async function removeUavPrivateSite(siteId, filePath = getUavPrivateSitesPath()) {
  const current = await readUavPrivateSites(filePath);
  delete current.sites[text(siteId)];
  await atomicWrite(filePath, current);
  return { filePath, siteId: text(siteId), stored: false };
}

function round(value, precision) {
  const factor = 10 ** precision;
  return Math.round(Number(value) * factor) / factor;
}

export function projectPublicAuthorities(authoritiesInput, privateInput = { sites: {} }) {
  const authorities = structuredClone(uavAuthoritiesSchema.parse(authoritiesInput));
  const privateSites = privateInput?.sites && typeof privateInput.sites === 'object' ? privateInput.sites : {};
  for (const site of authorities.sites) {
    const exact = privateSites[site.id];
    if (site.coordinateVisibility === 'hidden') {
      delete site.publicCoordinates;
      continue;
    }
    if (!exact || !Number.isFinite(Number(exact.lat)) || !Number.isFinite(Number(exact.lon))) {
      // Existing public-safe values remain valid for portability/offline use.
      continue;
    }
    const precision = site.coordinateVisibility === 'rounded'
      ? Number(site.publicCoordinates?.precision ?? 2)
      : Number(site.publicCoordinates?.precision ?? 6);
    site.publicCoordinates = {
      lat: round(exact.lat, precision),
      lon: round(exact.lon, precision),
      precision,
    };
  }
  authorities.version = UAV_AUTHORITIES_VERSION;
  authorities.updatedAt = new Date().toISOString();
  return uavAuthoritiesSchema.parse(authorities);
}

export function assertNoPrivateCoordinates(value, privateInput = { sites: {} }) {
  const serialized = JSON.stringify(value);
  const leaks = [];
  for (const [siteId, coordinates] of Object.entries(privateInput?.sites || {})) {
    const needles = [String(coordinates?.lat), String(coordinates?.lon)].filter((item) => item && item !== 'undefined');
    for (const needle of needles) {
      if (serialized.includes(needle)) leaks.push(`${siteId}:${needle}`);
    }
  }
  if (leaks.length) throw new Error(`Private UAV coordinate leak: ${leaks.join(', ')}`);
  return true;
}

export async function searchLocAuthority(query, kind = 'site') {
  const q = text(query);
  if (!q) return { query: '', kind, results: [] };
  const collection = kind === 'subject' ? 'subjects' : 'names';
  const source = kind === 'subject' ? 'lcsh' : 'lcnaf';
  const endpoint = `https://id.loc.gov/authorities/${collection}/suggest/?q=${encodeURIComponent(q)}`;
  const response = await fetch(endpoint, {
    headers: { accept: 'application/json', 'user-agent': 'dex-uav-authority/1.0 (+https://dexdsl.org)' },
  });
  if (!response.ok) throw new Error(`LOC authority search failed (${response.status})`);
  const payload = await response.json();
  const labels = Array.isArray(payload?.[1]) ? payload[1] : [];
  const uris = Array.isArray(payload?.[3]) ? payload[3] : [];
  const results = labels.map((label, index) => ({
    source,
    label: text(label),
    uri: text(uris[index]),
  })).filter((row) => row.label && /^https?:\/\//i.test(row.uri));
  return { query: q, kind, endpoint, results };
}

