import fs from 'node:fs/promises';
import path from 'node:path';
import { driveFolderUrl, googleSheetUrl, isDriveFolder, isDriveSpreadsheet, parseDriveId } from './google-drive-inventory.mjs';

export const RECORDING_INDEX_SOURCES_VERSION = 'recording-index-sources-v1';
export const DEFAULT_RECORDING_INDEX_SOURCES_PATH = path.resolve('data', 'recording-index.sources.json');
export const BUCKETS = ['A', 'B', 'C', 'D', 'E', 'X'];
export const IMPORT_MODES = new Set(['sheet', 'drive-files', 'auto']);

function toText(value) {
  return String(value ?? '').trim();
}

function stripZeroWidth(value) {
  return toText(value).replace(/[\u200B-\u200D\u2060\uFEFF]/g, '');
}

export function normalizeMatchText(value) {
  return stripZeroWidth(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLookup(value) {
  return normalizeMatchText(value).replace(/\bav?(\d{4})\b/g, 'av $1');
}

function normalizeImportMode(value) {
  const mode = toText(value).toLowerCase();
  return IMPORT_MODES.has(mode) ? mode : '';
}

function splitWords(value) {
  return normalizeMatchText(value).split(/\s+/).filter((word) => word.length >= 2);
}

function reverseCommaName(value) {
  const raw = stripZeroWidth(value);
  if (!raw.includes(',')) return raw;
  const [last, first] = raw.split(',').map((part) => part.trim()).filter(Boolean);
  return first && last ? `${first} ${last}` : raw;
}

function catalogCandidate(entry = {}) {
  const slug = toText(entry.id);
  const lookupNumber = stripZeroWidth(entry.lookup_raw || entry.lookupNumber);
  const title = stripZeroWidth(entry.title_raw || entry.title);
  const performerRaw = stripZeroWidth(entry.performer_raw || entry.performer);
  const performer = reverseCommaName(performerRaw);
  const instrument = Array.isArray(entry.instrument_labels)
    ? stripZeroWidth(entry.instrument_labels[0] || '')
    : stripZeroWidth(entry.instrument || '');
  return {
    slug,
    lookupNumber,
    title,
    performer,
    instrument,
    season: toText(entry.season).toUpperCase(),
    slugText: normalizeMatchText(slug.replace(/-/g, ' ')),
    lookupText: normalizeLookup(lookupNumber),
    titleText: normalizeMatchText(title),
    performerText: normalizeMatchText(performer),
    performerRawText: normalizeMatchText(performerRaw),
    instrumentText: normalizeMatchText(instrument),
  };
}

function scoreCandidate(candidate, haystackText, names) {
  let score = 0;
  const reasons = [];
  const add = (points, reason) => {
    score += points;
    reasons.push(reason);
  };

  if (candidate.lookupText && haystackText.includes(candidate.lookupText)) add(110, 'lookup');
  if (candidate.slugText && haystackText.includes(candidate.slugText)) add(95, 'slug');
  if (candidate.titleText && haystackText.includes(candidate.titleText)) add(55, 'title');
  if (candidate.performerText && haystackText.includes(candidate.performerText)) add(48, 'performer');
  if (candidate.performerRawText && haystackText.includes(candidate.performerRawText)) add(38, 'performer-raw');
  if (candidate.instrumentText && haystackText.includes(candidate.instrumentText)) add(24, 'instrument');

  const words = new Set(splitWords(names.join(' ')));
  const candidateWords = new Set([
    ...splitWords(candidate.slugText),
    ...splitWords(candidate.titleText),
    ...splitWords(candidate.performerText),
  ]);
  let overlap = 0;
  for (const word of candidateWords) {
    if (words.has(word)) overlap += 1;
  }
  if (overlap >= 2) add(Math.min(30, overlap * 6), `word-overlap:${overlap}`);

  return { score, reasons };
}

export function matchCatalogEntry(catalogEntries, names, {
  season = '',
  minimumScore = 34,
} = {}) {
  const sourceNames = (Array.isArray(names) ? names : [names]).map(toText).filter(Boolean);
  const haystackText = normalizeMatchText(sourceNames.join(' '));
  const targetSeason = toText(season).toUpperCase();
  let best = null;

  for (const entry of catalogEntries || []) {
    const candidate = catalogCandidate(entry);
    if (!candidate.slug) continue;
    if (targetSeason && candidate.season !== targetSeason) continue;
    const scored = scoreCandidate(candidate, haystackText, sourceNames);
    if (!best || scored.score > best.score) {
      best = {
        entry,
        candidate,
        score: scored.score,
        reasons: scored.reasons,
      };
    }
  }

  if (!best || best.score < minimumScore) return null;
  return best;
}

export async function readRecordingIndexSources(filePath = DEFAULT_RECORDING_INDEX_SOURCES_PATH) {
  try {
    const raw = JSON.parse(await fs.readFile(path.resolve(filePath), 'utf8'));
    return normalizeRecordingIndexSources(raw);
  } catch (error) {
    if (String(error?.code || '') === 'ENOENT') return defaultRecordingIndexSources();
    throw error;
  }
}

export async function writeRecordingIndexSources(registry, filePath = DEFAULT_RECORDING_INDEX_SOURCES_PATH) {
  const normalized = normalizeRecordingIndexSources({
    ...(registry || {}),
    updatedAt: new Date().toISOString(),
  });
  const target = path.resolve(filePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}

export function defaultRecordingIndexSources() {
  return {
    version: RECORDING_INDEX_SOURCES_VERSION,
    updatedAt: new Date().toISOString(),
    seasons: {},
    entries: {},
  };
}

export function normalizeRecordingIndexSources(raw = {}) {
  const seasons = {};
  for (const [seasonKey, seasonValue] of Object.entries(raw.seasons || {})) {
    const season = toText(seasonKey).toUpperCase();
    if (!season) continue;
    const driveRootFolderId = parseDriveId(seasonValue?.driveRootFolderId || seasonValue?.driveRootFolderUrl || '');
    seasons[season] = {
      sourceMode: toText(seasonValue?.sourceMode || (driveRootFolderId ? 'drive-tree' : 'manual')),
      ...(normalizeImportMode(seasonValue?.importMode) ? { importMode: normalizeImportMode(seasonValue.importMode) } : {}),
      ...(driveRootFolderId ? {
        driveRootFolderId,
        driveRootFolderUrl: driveFolderUrl(driveRootFolderId),
      } : {}),
      ...(seasonValue?.masterSheetUrl ? { masterSheetUrl: toText(seasonValue.masterSheetUrl) } : {}),
      ...(seasonValue?.notes ? { notes: toText(seasonValue.notes) } : {}),
    };
  }

  const entries = {};
  for (const [slugKey, sourceValue] of Object.entries(raw.entries || {})) {
    const slug = toText(sourceValue?.slug || slugKey);
    if (!slug) continue;
    const sheetId = parseDriveId(sourceValue?.sheetId || sourceValue?.sheetUrl || '');
    const driveRootFolderId = parseDriveId(sourceValue?.driveRootFolderId || sourceValue?.driveRootFolderUrl || '');
    const bucketFolderIds = {};
    const bucketFolderUrls = {};
    const inputBucketIds = sourceValue?.bucketFolderIds && typeof sourceValue.bucketFolderIds === 'object'
      ? sourceValue.bucketFolderIds
      : {};
    const inputBucketUrls = sourceValue?.bucketFolderUrls && typeof sourceValue.bucketFolderUrls === 'object'
      ? sourceValue.bucketFolderUrls
      : {};
    for (const bucket of BUCKETS) {
      const bucketId = parseDriveId(inputBucketIds[bucket] || inputBucketUrls[bucket] || inputBucketIds[bucket.toLowerCase()] || inputBucketUrls[bucket.toLowerCase()] || '');
      if (!bucketId) continue;
      bucketFolderIds[bucket] = bucketId;
      bucketFolderUrls[bucket] = driveFolderUrl(bucketId);
    }

    entries[slug] = {
      slug,
      season: toText(sourceValue?.season).toUpperCase(),
      lookupNumber: stripZeroWidth(sourceValue?.lookupNumber || sourceValue?.lookup_raw || ''),
      ...(sheetId ? {
        sheetId,
        sheetUrl: googleSheetUrl(sheetId, sourceValue?.gid || '0'),
      } : sourceValue?.sheetUrl ? { sheetUrl: toText(sourceValue.sheetUrl) } : {}),
      ...(driveRootFolderId ? {
        driveRootFolderId,
        driveRootFolderUrl: driveFolderUrl(driveRootFolderId),
      } : {}),
      bucketFolderIds,
      bucketFolderUrls,
      ...(normalizeImportMode(sourceValue?.importMode) ? { importMode: normalizeImportMode(sourceValue.importMode) } : {}),
      ...(sourceValue?.sourceMode ? { sourceMode: toText(sourceValue.sourceMode) } : {}),
      ...(sourceValue?.confidence ? { confidence: Number(sourceValue.confidence) || 0 } : {}),
      ...(Array.isArray(sourceValue?.discoveredNames) ? { discoveredNames: sourceValue.discoveredNames.map(toText).filter(Boolean) } : {}),
      ...(sourceValue?.discoveredAt ? { discoveredAt: toText(sourceValue.discoveredAt) } : {}),
      ...(sourceValue?.notes ? { notes: toText(sourceValue.notes) } : {}),
    };
  }

  return {
    version: RECORDING_INDEX_SOURCES_VERSION,
    updatedAt: toText(raw.updatedAt) || new Date().toISOString(),
    seasons,
    entries,
  };
}

export async function readCatalogEntries(filePath = path.resolve('data', 'catalog.entries.json')) {
  const raw = JSON.parse(await fs.readFile(path.resolve(filePath), 'utf8'));
  return Array.isArray(raw?.entries) ? raw.entries : [];
}

export function bucketFromFolderName(name) {
  const normalized = normalizeMatchText(name);
  const match = normalized.match(/^(?:bucket\s*)?([abcde]|x)(?:\b|\s|$)/i);
  if (!match) return '';
  return match[1].toUpperCase();
}

function buildParentMap(files, root) {
  const byId = new Map();
  if (root?.id) byId.set(root.id, root);
  for (const file of files || []) byId.set(file.id, file);
  return byId;
}

function ancestorChain(file, byId) {
  const out = [];
  let current = file;
  const seen = new Set();
  while (current) {
    if (current.id) {
      if (seen.has(current.id)) break;
      seen.add(current.id);
    }
    out.push(current);
    const parentId = Array.isArray(current.parents) && current.parents.length
      ? current.parents[0]
      : current.parentId;
    current = parentId ? byId.get(parentId) : null;
  }
  return out;
}

function nearestFolder(chain) {
  return chain.find((node) => isDriveFolder(node)) || null;
}

function findBucketFolders(entryRoot, folders) {
  const rootId = toText(entryRoot?.id);
  if (!rootId) return { bucketFolderIds: {}, bucketFolderUrls: {} };
  const byId = new Map((folders || []).map((folder) => [folder.id, folder]));
  const descendants = [];
  for (const folder of folders || []) {
    let current = folder;
    let depth = 0;
    while (current && depth < 6) {
      const parentId = current.parentId || (Array.isArray(current.parents) ? current.parents[0] : '');
      if (parentId === rootId) {
        descendants.push({ folder, distance: depth + 1 });
        break;
      }
      current = parentId ? byId.get(parentId) : null;
      depth += 1;
    }
  }

  const chosen = {};
  for (const { folder, distance } of descendants) {
    const bucket = bucketFromFolderName(folder.name);
    if (!bucket) continue;
    if (!chosen[bucket] || distance < chosen[bucket].distance) {
      chosen[bucket] = { folder, distance };
    }
  }

  const bucketFolderIds = {};
  const bucketFolderUrls = {};
  for (const bucket of BUCKETS) {
    const folder = chosen[bucket]?.folder;
    if (!folder) continue;
    bucketFolderIds[bucket] = folder.id;
    bucketFolderUrls[bucket] = folder.webViewLink || driveFolderUrl(folder.id);
  }
  return { bucketFolderIds, bucketFolderUrls };
}

export function discoverRecordingIndexSourcesFromDriveTree({
  tree,
  catalogEntries,
  season,
} = {}) {
  const files = Array.isArray(tree?.files) ? tree.files : [];
  const root = tree?.root || null;
  const byId = buildParentMap(files, root);
  const folders = [
    ...(root ? [root] : []),
    ...files.filter((file) => isDriveFolder(file)),
  ];
  const discoveredAt = new Date().toISOString();
  const entries = {};
  const unmatched = [];

  for (const sheet of files.filter((file) => isDriveSpreadsheet(file))) {
    const chain = ancestorChain(sheet, byId);
    const names = chain.map((node) => node.name).filter(Boolean);
    const match = matchCatalogEntry(catalogEntries, names, { season });
    if (!match) {
      unmatched.push({
        id: sheet.id,
        name: sheet.name,
        webViewLink: sheet.webViewLink || googleSheetUrl(sheet.id),
        names,
      });
      continue;
    }

    const slug = match.candidate.slug;
    const entryRoot = nearestFolder(chain.slice(1)) || root;
    const bucketFolders = findBucketFolders(entryRoot, folders);
    const next = {
      slug,
      season: match.candidate.season,
      lookupNumber: match.candidate.lookupNumber,
      sourceMode: 'drive-tree',
      sheetId: sheet.id,
      sheetUrl: sheet.webViewLink && sheet.webViewLink.includes('/spreadsheets/d/')
        ? sheet.webViewLink
        : googleSheetUrl(sheet.id),
      driveRootFolderId: entryRoot?.id || '',
      driveRootFolderUrl: entryRoot?.webViewLink || driveFolderUrl(entryRoot?.id),
      bucketFolderIds: bucketFolders.bucketFolderIds,
      bucketFolderUrls: bucketFolders.bucketFolderUrls,
      confidence: match.score,
      discoveredNames: names,
      discoveredAt,
    };

    const existing = entries[slug];
    if (!existing || next.confidence > existing.confidence) {
      entries[slug] = next;
    }
  }

  return {
    entries,
    unmatched,
  };
}

export function validateRecordingIndexSources({
  registry,
  catalogEntries,
  season,
  onlySlugs = [],
} = {}) {
  const targetSeason = toText(season).toUpperCase();
  const onlySet = new Set((Array.isArray(onlySlugs) ? onlySlugs : []).map(toText).filter(Boolean));
  const catalogBySlug = new Map(
    (catalogEntries || [])
      .filter((entry) => !targetSeason || toText(entry?.season).toUpperCase() === targetSeason)
      .map((entry) => [toText(entry.id), catalogCandidate(entry)]),
  );
  const issues = [];
  const rows = [];

  for (const [slug, catalog] of catalogBySlug.entries()) {
    if (onlySet.size && !onlySet.has(slug)) continue;
    const source = registry?.entries?.[slug] || null;
    if (!source) {
      issues.push({ slug, severity: 'error', code: 'missing-source', message: `Missing recording-index source for ${slug}` });
      rows.push({ slug, ok: false, imported: false });
      continue;
    }
    if (!toText(source.sheetUrl)) {
      issues.push({ slug, severity: 'error', code: 'missing-sheet-url', message: `Missing sheetUrl for ${slug}` });
    }
    if (catalog.lookupNumber && source.lookupNumber && normalizeLookup(catalog.lookupNumber) !== normalizeLookup(source.lookupNumber)) {
      issues.push({ slug, severity: 'error', code: 'lookup-mismatch', message: `Lookup mismatch for ${slug}: catalog ${catalog.lookupNumber}, registry ${source.lookupNumber}` });
    }
    if (!Object.keys(source.bucketFolderUrls || {}).length) {
      issues.push({ slug, severity: 'warning', code: 'missing-bucket-folders', message: `No Drive bucket folders recorded for ${slug}` });
    }
    rows.push({
      slug,
      ok: !issues.some((issue) => issue.slug === slug && issue.severity === 'error'),
      imported: false,
      source,
    });
  }

  return {
    ok: !issues.some((issue) => issue.severity === 'error'),
    issues,
    rows,
  };
}
