import fs from 'node:fs/promises';
import path from 'node:path';
import { writeEntryFromData as writeEntryFromDataCore } from './init-core.mjs';
import {
  defaultCatalogEditorialData,
  findCatalogManifestEntry,
  readCatalogEditorialFile,
  upsertCatalogManifestEntry,
  writeCatalogEditorialFile,
} from './catalog-editorial-store.mjs';
import {
  resolveCatalogManifestPatchFromInitData,
  resolveEntryLinkageFromInitData,
  assertCatalogManifestRowLinkage,
} from './entry-catalog-linkage.mjs';
import { assertAssetReferenceToken, assertAssetReferenceTokenKinds } from './asset-ref.mjs';
import {
  readProtectedAssetsFile,
  upsertProtectedAssetsLookupMapping,
} from './protected-assets-publisher.mjs';
import { bucketFoldersToProtectedImport } from './entry-bucket-folders.mjs';
import { parseRecordingIndexSheetUrl } from './recording-index-import.mjs';

function toText(value) {
  return String(value || '').trim();
}

function normalizeCatalogLinkMode(value) {
  const raw = toText(value || 'create-linked').toLowerCase();
  if (raw === 'create-linked' || raw === 'attach-existing') return raw;
  throw new Error(`Unsupported catalog link mode: ${value}`);
}

function resolveCatalogLinkConfig(data = {}, opts = {}) {
  const fromOpts = opts.catalogLink && typeof opts.catalogLink === 'object' ? opts.catalogLink : {};
  const mode = normalizeCatalogLinkMode(fromOpts.mode || opts.catalogLinkMode || 'create-linked');
  const enabled = fromOpts.enabled !== false && opts.catalogLink !== false;
  const catalogFilePath = toText(fromOpts.filePath || opts.catalogFilePath || path.resolve(process.cwd(), 'data', 'catalog.editorial.json'));
  const createProtectedAssetsStub = Boolean(fromOpts.createProtectedAssetsStub);
  const protectedAssetsStub = fromOpts.protectedAssetsStub && typeof fromOpts.protectedAssetsStub === 'object'
    ? fromOpts.protectedAssetsStub
    : null;
  const linkage = resolveEntryLinkageFromInitData(data, fromOpts);
  return {
    enabled,
    mode,
    filePath: catalogFilePath || undefined,
    linkage,
    createProtectedAssetsStub,
    protectedAssetsStub,
  };
}

function collectManifestStringValues(manifest, out = []) {
  if (Array.isArray(manifest)) {
    manifest.forEach((item) => collectManifestStringValues(item, out));
    return out;
  }
  if (manifest && typeof manifest === 'object') {
    Object.values(manifest).forEach((item) => collectManifestStringValues(item, out));
    return out;
  }
  if (typeof manifest === 'string') out.push(manifest);
  return out;
}

function assertLookupOnlyManifest(manifest) {
  const values = collectManifestStringValues(manifest, []);
  for (const value of values) {
    const raw = toText(value);
    if (!raw) continue;
    assertAssetReferenceToken(raw, 'Lookup-only mode');
  }
}

function assertRecordingIndexPdfRef(sidebar = {}) {
  const downloads = sidebar?.downloads && typeof sidebar.downloads === 'object'
    ? sidebar.downloads
    : {};
  const recordingIndexPdfRef = String(
    downloads.recordingIndexPdfRef || sidebar?.recordingIndexPdfRef || '',
  ).trim();
  if (!recordingIndexPdfRef) return;
  assertAssetReferenceTokenKinds(
    recordingIndexPdfRef,
    ['lookup', 'asset'],
    'Recording Index PDF token',
  );
}

function assertRecordingIndexBundleRef(sidebar = {}) {
  const downloads = sidebar?.downloads && typeof sidebar.downloads === 'object'
    ? sidebar.downloads
    : {};
  const recordingIndexBundleRef = String(
    downloads.recordingIndexBundleRef || sidebar?.recordingIndexBundleRef || '',
  ).trim();
  if (!recordingIndexBundleRef) return;
  assertAssetReferenceTokenKinds(
    recordingIndexBundleRef,
    ['bundle'],
    'Recording Index bundle token',
  );
}

function assertRecordingIndexSourceUrl(sidebar = {}) {
  const downloads = sidebar?.downloads && typeof sidebar.downloads === 'object'
    ? sidebar.downloads
    : {};
  const recordingIndexSourceUrl = String(
    downloads.recordingIndexSourceUrl || sidebar?.recordingIndexSourceUrl || '',
  ).trim();
  if (!recordingIndexSourceUrl) return;
  try {
    parseRecordingIndexSheetUrl(recordingIndexSourceUrl);
  } catch {
    throw new Error('Recording index source URL must be a valid Google Sheets URL.');
  }
}

async function readCatalogEditorialSafe(filePath) {
  try {
    return await readCatalogEditorialFile(filePath);
  } catch (error) {
    if (String(error?.message || '').includes('ENOENT') || error?.code === 'ENOENT') {
      const fallback = defaultCatalogEditorialData();
      return {
        filePath: filePath ? path.resolve(filePath) : path.resolve(process.cwd(), 'data', 'catalog.editorial.json'),
        data: fallback,
      };
    }
    throw error;
  }
}

async function maybeCreateProtectedAssetsStub(catalogLinkConfig) {
  if (!catalogLinkConfig.createProtectedAssetsStub) return [];
  const stub = catalogLinkConfig.protectedAssetsStub || {};
  const lines = [];
  if (!toText(stub.bucketNumber) || !toText(stub.r2Key) || !toText(stub.entitlementType) || !toText(stub.entitlementValue)) {
    throw new Error(
      'Protected assets stub requested but incomplete. Provide bucketNumber, r2Key, entitlementType, entitlementValue.',
    );
  }
  lines.push(`✓ Protected assets stub requested for ${catalogLinkConfig.linkage.lookupNumber} (${stub.bucketNumber})`);
  return lines;
}

async function syncCatalogLinkageAfterWrite(data, opts) {
  const config = resolveCatalogLinkConfig(data, opts);
  if (!config.enabled) return { linked: false, lines: [] };

  if (!toText(config.linkage.entryId) || !toText(config.linkage.entryHref)) {
    throw new Error('Catalog linkage requires entry_id and entry_href.');
  }
  if (!toText(config.linkage.lookupNumber)) throw new Error('Catalog linkage requires lookup_number.');
  if (!toText(config.linkage.season)) throw new Error('Catalog linkage requires season.');
  if (!toText(config.linkage.performer)) throw new Error('Catalog linkage requires performer.');
  if (!toText(config.linkage.instrument)) throw new Error('Catalog linkage requires instrument.');
  if (!toText(config.linkage.status)) throw new Error('Catalog linkage requires status.');

  const { filePath, data: editorial } = await readCatalogEditorialSafe(config.filePath);
  const existing = findCatalogManifestEntry(editorial, config.linkage.entryId)
    || findCatalogManifestEntry(editorial, config.linkage.entryHref);

  if (config.mode === 'attach-existing') {
    if (!existing) {
      throw new Error(`attach-existing requires an existing catalog row for ${config.linkage.entryId}`);
    }
    const mismatches = [];
    if (toText(existing.lookup_number) && toText(existing.lookup_number).toLowerCase() !== config.linkage.lookupNumber.toLowerCase()) {
      mismatches.push(`lookup_number mismatch (${existing.lookup_number} != ${config.linkage.lookupNumber})`);
    }
    if (toText(existing.season) && toText(existing.season).toLowerCase() !== config.linkage.season.toLowerCase()) {
      mismatches.push(`season mismatch (${existing.season} != ${config.linkage.season})`);
    }
    if (toText(existing.performer) && toText(existing.performer).toLowerCase() !== config.linkage.performer.toLowerCase()) {
      mismatches.push(`performer mismatch (${existing.performer} != ${config.linkage.performer})`);
    }
    if (toText(existing.instrument) && toText(existing.instrument).toLowerCase() !== config.linkage.instrument.toLowerCase()) {
      mismatches.push(`instrument mismatch (${existing.instrument} != ${config.linkage.instrument})`);
    }
    if (mismatches.length) throw new Error(`attach-existing failed: ${mismatches.join('; ')}`);
  }

  const patch = resolveCatalogManifestPatchFromInitData(data, config.linkage);
  const next = upsertCatalogManifestEntry(editorial, patch);
  const writtenRow = (next.manifest || []).find((row) => toText(row.entry_id).toLowerCase() === patch.entry_id.toLowerCase())
    || patch;
  await assertCatalogManifestRowLinkage(writtenRow, {
    rootDir: process.cwd(),
    requireEntryExistsForStatuses: opts.dryRun ? new Set() : new Set(['active']),
  });
  if (!opts.dryRun) {
    await writeCatalogEditorialFile(next, filePath);
  }

  const stubLines = opts.dryRun ? [] : await maybeCreateProtectedAssetsStub(config);
  return {
    linked: true,
    lines: [
      `${opts.dryRun ? '• [dry-run] would link' : '✓ Linked'} entry ${patch.entry_id} to catalog (${config.mode})`,
      `Catalog file: ${path.resolve(filePath)}`,
      ...stubLines,
    ],
  };
}

async function syncProtectedAssetsAfterWrite(data, opts = {}) {
  if (opts?.dryRun) return { synced: false, lines: [] };
  const protectedAssetsFilePath = opts?.protectedAssetsFilePath;
  const requestedLookup = toText(data?.protectedAssetsImport?.lookupNumber || data?.sidebar?.lookupNumber);
  let existingLookup = null;
  try {
    const source = await readProtectedAssetsFile(protectedAssetsFilePath);
    existingLookup = (source.data.lookups || []).find(
      (row) => toText(row?.lookupNumber).toLowerCase() === requestedLookup.toLowerCase(),
    ) || null;
  } catch (error) {
    if (String(error?.code || '') !== 'ENOENT' && !String(error?.message || '').includes('ENOENT')) throw error;
  }

  let importData = data?.protectedAssetsImport && typeof data.protectedAssetsImport === 'object'
    ? data.protectedAssetsImport
    : null;
  // No explicit import? Derive one from the entry's scanned bucket folders so
  // Scan → Save → Publish makes the declared buckets downloadable (no sheet step).
  if (!importData) {
    importData = bucketFoldersToProtectedImport(data?.sidebar?.downloads, {
      slug: toText(data?.slug),
      lookupNumber: toText(data?.sidebar?.lookupNumber),
      title: toText(data?.title),
      season: toText(data?.creditsData?.season || data?.sidebar?.credits?.season || ''),
      status: toText(existingLookup?.status),
      existingFiles: Array.isArray(existingLookup?.files) ? existingLookup.files : [],
    });
  }
  if (!importData) return { synced: false, lines: [] };

  const lookupNumber = toText(importData.lookupNumber || data?.sidebar?.lookupNumber);
  if (!lookupNumber) throw new Error('Protected assets import requires lookupNumber.');
  const files = Array.isArray(importData.files) ? importData.files : [];
  if (!files.length) {
    throw new Error(`Protected assets import for ${lookupNumber} requires at least one file.`);
  }

  const result = await upsertProtectedAssetsLookupMapping({
    lookupNumber,
    title: toText(importData.title || data?.title),
    status: toText(importData.status || existingLookup?.status || 'draft'),
    season: toText(importData.season || data?.creditsData?.season || data?.sidebar?.credits?.season || ''),
    files,
    entitlements: Array.isArray(importData.entitlements) ? importData.entitlements : [],
    recordingIndex: importData.recordingIndex && typeof importData.recordingIndex === 'object'
      ? importData.recordingIndex
      : null,
    filePath: importData.filePath || protectedAssetsFilePath,
  });
  const canonicalProtectedPath = path.resolve(process.cwd(), 'data', 'protected.assets.json');
  if (path.resolve(result.filePath) === canonicalProtectedPath) {
    const json = await fs.readFile(result.filePath, 'utf8');
    for (const servedRoot of ['docs', 'public']) {
      const mirrorPath = path.resolve(process.cwd(), servedRoot, 'data', 'protected.assets.json');
      await fs.mkdir(path.dirname(mirrorPath), { recursive: true });
      await fs.writeFile(mirrorPath, json, 'utf8');
    }
  }
  return {
    synced: true,
    lines: [
      `✓ Updated protected assets lookup ${result.lookupNumber} (${result.files} files)`,
      `Protected assets file: ${path.resolve(result.filePath)}`,
    ],
  };
}

export async function publishEntryRoute(slug, {
  rootDir = process.cwd(),
  entriesDir = path.resolve(rootDir, 'entries'),
  routeEntryDir = path.resolve(rootDir, 'docs', 'entry'),
} = {}) {
  const normalizedSlug = toText(slug);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) {
    throw new Error(`Invalid entry slug for route publish: ${normalizedSlug || '(empty)'}`);
  }
  const sourcePath = path.resolve(entriesDir, normalizedSlug, 'index.html');
  const routePath = path.resolve(routeEntryDir, normalizedSlug, 'index.html');
  const html = await fs.readFile(sourcePath, 'utf8');
  await fs.mkdir(path.dirname(routePath), { recursive: true });
  await fs.writeFile(routePath, html, 'utf8');
  return { sourcePath, routePath, bytes: Buffer.byteLength(html) };
}

export async function writeEntryFromData({ templatePath, templateHtml, data, opts = {}, log = () => {} }) {
  const folder = opts.flat
    ? path.join(path.resolve('.'), data.slug)
    : path.join(path.resolve(data.outDir || './entries'), data.slug);
  let folderExistsBefore = false;
  try {
    await fs.access(folder);
    folderExistsBefore = true;
  } catch {
    folderExistsBefore = false;
  }

  let result;
  try {
    assertLookupOnlyManifest(data.manifest);
    assertRecordingIndexPdfRef(data.sidebar);
    assertRecordingIndexBundleRef(data.sidebar);
    assertRecordingIndexSourceUrl(data.sidebar);
    result = await writeEntryFromDataCore({
      templatePath,
      templateHtml,
      data,
      opts,
    });
    const linkage = await syncCatalogLinkageAfterWrite(data, opts);
    if (Array.isArray(linkage.lines) && linkage.lines.length) {
      result.lines.push(...linkage.lines);
    }
    const assetsSync = await syncProtectedAssetsAfterWrite(data, opts);
    if (Array.isArray(assetsSync.lines) && assetsSync.lines.length) {
      result.lines.push(...assetsSync.lines);
    }
  } catch (error) {
    if (!opts.dryRun && !folderExistsBefore) {
      await fs.rm(folder, { recursive: true, force: true }).catch(() => {});
    }
    throw error;
  }

  result.lines.forEach((line) => log(line));
  return result;
}
