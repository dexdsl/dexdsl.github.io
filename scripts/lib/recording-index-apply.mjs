import fs from 'node:fs/promises';
import path from 'node:path';
import { ALL_BUCKETS } from './entry-schema.mjs';
import { buildEmptyManifestSkeleton, writeEntryFromData } from './init-core.mjs';
import { importRecordingIndexFromDriveSource } from './recording-index-drive-import.mjs';
import { importRecordingIndexFromSheet } from './recording-index-import.mjs';
import { upsertProtectedAssetsLookupMapping } from './protected-assets-publisher.mjs';

const FILE_TREE_BUCKET_ORDER = ['A', 'B', 'C', 'D', 'E', 'X'];

function toText(value) {
  return String(value ?? '').trim();
}

function normalizeMediaType(value) {
  const raw = toText(value).toLowerCase();
  return raw === 'audio' || raw === 'video' || raw === 'pdf' ? raw : '';
}

function normalizeAvailableTypes(file = {}) {
  const out = [];
  const seen = new Set();
  const add = (value) => {
    const mediaType = normalizeMediaType(value);
    if (!mediaType || seen.has(mediaType)) return;
    seen.add(mediaType);
    out.push(mediaType);
  };
  const available = Array.isArray(file?.availableTypes) ? file.availableTypes : [];
  available.forEach(add);
  add(file?.type);
  return out;
}

function guessFileName(file = {}) {
  const explicit = toText(file?.filename || file?.name || file?.path);
  if (explicit) return explicit;
  const r2Key = toText(file?.r2Key);
  if (r2Key) return path.basename(r2Key);
  const rawUrl = toText(file?.rawUrl);
  if (rawUrl) {
    try {
      return path.basename(new URL(rawUrl).pathname || '');
    } catch {}
  }
  return '';
}

function guessExtension(file = {}, filename = '') {
  const explicit = toText(file?.extension || file?.ext || file?.fileExt);
  if (explicit) return explicit.replace(/^\./, '');
  const fromName = toText(filename);
  const idx = fromName.lastIndexOf('.');
  if (idx > 0 && idx < fromName.length - 1) return fromName.slice(idx + 1).toLowerCase();
  const mime = toText(file?.mime).toLowerCase();
  if (mime.includes('audio/')) return 'wav';
  if (mime.includes('video/')) return 'mov';
  if (mime.includes('pdf')) return 'pdf';
  return '';
}

export function buildDownloadFileTreeFromImport(imported, lookupNumber) {
  const lookup = toText(lookupNumber);
  if (!lookup) return undefined;
  const files = Array.isArray(imported?.files) ? imported.files : [];
  const byBucketType = new Map();

  const ensureList = (bucket, mediaType) => {
    const key = `${bucket}|${mediaType}`;
    if (!byBucketType.has(key)) byBucketType.set(key, []);
    return byBucketType.get(key);
  };

  files.forEach((file) => {
    const bucket = toText(file?.bucket).toUpperCase();
    if (!bucket || !FILE_TREE_BUCKET_ORDER.includes(bucket)) return;
    const fileId = toText(file?.fileId || file?.assetId || file?.id);
    if (!fileId) return;
    const availableTypes = normalizeAvailableTypes(file).filter((type) => type === 'audio' || type === 'video');
    if (!availableTypes.length) return;
    const label = toText(file?.label || file?.sourceLabel || fileId) || fileId;
    const filename = guessFileName(file);
    const extension = guessExtension(file, filename);
    availableTypes.forEach((mediaType) => {
      const list = ensureList(bucket, mediaType);
      if (list.some((row) => toText(row?.fileId) === fileId)) return;
      list.push({
        fileId,
        label,
        filename,
        extension,
        variantKey: `default-${mediaType}`,
      });
    });
  });

  const buckets = FILE_TREE_BUCKET_ORDER
    .map((bucket) => {
      const types = ['audio', 'video']
        .map((mediaType) => {
          const filesForType = ensureList(bucket, mediaType);
          if (!filesForType.length) return null;
          return { mediaType, files: filesForType };
        })
        .filter(Boolean);
      if (!types.length) return null;
      return { bucket, types };
    })
    .filter(Boolean);

  return buckets.length ? { lookup, buckets } : undefined;
}

export function buildManifestFromImport(imported, formatKeys = {}) {
  const manifest = buildEmptyManifestSkeleton(formatKeys);
  const tokens = imported?.bundleTokensByBucketType && typeof imported.bundleTokensByBucketType === 'object'
    ? imported.bundleTokensByBucketType
    : {};
  for (const bucket of Object.keys(manifest.audio || {})) {
    const audioToken = toText(tokens[`${bucket}:audio`]);
    const videoToken = toText(tokens[`${bucket}:video`]);
    for (const key of Object.keys(manifest.audio[bucket] || {})) {
      manifest.audio[bucket][key] = audioToken;
    }
    for (const key of Object.keys(manifest.video[bucket] || {})) {
      manifest.video[bucket][key] = videoToken;
    }
  }
  return manifest;
}

function mergeDownloads(existingDownloads = {}, imported, lookupNumber) {
  const recordingIndex = imported?.recordingIndex && typeof imported.recordingIndex === 'object'
    ? imported.recordingIndex
    : {};
  const downloads = {
    ...(existingDownloads && typeof existingDownloads === 'object' ? existingDownloads : {}),
  };
  const recordingIndexPdfRef = toText(recordingIndex.recordingIndexPdfRef);
  const recordingIndexBundleRef = toText(recordingIndex.recordingIndexBundleRef);
  const recordingIndexSourceUrl = toText(recordingIndex.recordingIndexSourceUrl);
  if (recordingIndexPdfRef) downloads.recordingIndexPdfRef = recordingIndexPdfRef;
  if (recordingIndexBundleRef) downloads.recordingIndexBundleRef = recordingIndexBundleRef;
  if (recordingIndexSourceUrl) downloads.recordingIndexSourceUrl = recordingIndexSourceUrl;
  const fileTree = buildDownloadFileTreeFromImport(imported, lookupNumber);
  if (fileTree) downloads.fileTree = fileTree;
  return downloads;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function maybeCopyRouteHtml(slug, routeEntryDir) {
  const sourcePath = path.resolve('entries', slug, 'index.html');
  const routePath = path.resolve(routeEntryDir || path.resolve('docs', 'entry'), slug, 'index.html');
  await fs.mkdir(path.dirname(routePath), { recursive: true });
  await fs.copyFile(sourcePath, routePath);
  return routePath;
}

function buildEntryWriterData(entry, updatedSidebar, manifest, fallbackTitle) {
  return {
    slug: toText(entry.slug),
    title: toText(entry.title || fallbackTitle || entry.slug),
    canonical: entry.canonical,
    lifecycle: entry.lifecycle,
    video: entry.video,
    descriptionText: toText(entry.descriptionText),
    sidebar: updatedSidebar,
    manifest,
    authEnabled: true,
    series: entry.series || 'dex',
    selectedBuckets: Array.isArray(entry.selectedBuckets) && entry.selectedBuckets.length
      ? entry.selectedBuckets
      : (Array.isArray(updatedSidebar.buckets) ? updatedSidebar.buckets : ALL_BUCKETS),
    creditsData: entry.creditsData || updatedSidebar.credits,
    fileSpecs: entry.fileSpecs || updatedSidebar.fileSpecs,
    metadata: entry.metadata || updatedSidebar.metadata,
    outDir: path.resolve('entries'),
  };
}

export async function importSourceForEntry({
  source,
  serviceAccountKeyPath,
  timeoutMs = 20000,
  retries = 2,
  driveMaxDepth = 8,
} = {}) {
  const importMode = toText(source?.importMode).toLowerCase();
  if (importMode === 'drive-files') {
    return importRecordingIndexFromDriveSource({
      source,
      serviceAccountKeyPath,
      maxDepth: driveMaxDepth,
    });
  }
  const bucketFolderUrls = source?.bucketFolderUrls && typeof source.bucketFolderUrls === 'object'
    ? source.bucketFolderUrls
    : {};
  try {
    return await importRecordingIndexFromSheet({
      sheetUrl: source.sheetUrl,
      lookupNumber: source.lookupNumber,
      entrySlug: source.slug,
      serviceAccountKeyPath,
      folderLinks: {
        rootFolderUrl: source.driveRootFolderUrl || '',
        bucketFolderUrls,
      },
      timeoutMs,
      retries,
    });
  } catch (error) {
    if (importMode !== 'auto' || !source?.driveRootFolderId) throw error;
    return importRecordingIndexFromDriveSource({
      source,
      serviceAccountKeyPath,
      maxDepth: driveMaxDepth,
    });
  }
}

export async function applyImportedRecordingIndex({
  source,
  imported,
  formatKeys,
  protectedAssetsPath,
  routeEntryDir = path.resolve('docs', 'entry'),
  updateHtml = true,
  dryRun = false,
} = {}) {
  const slug = toText(source?.slug);
  if (!slug) throw new Error('applyImportedRecordingIndex requires source.slug');
  const lookupNumber = toText(source?.lookupNumber);
  if (!lookupNumber) throw new Error(`Missing lookupNumber for ${slug}`);

  const entryJsonPath = path.resolve('entries', slug, 'entry.json');
  const entryHtmlPath = path.resolve('entries', slug, 'index.html');
  const manifestPath = path.resolve('entries', slug, 'manifest.json');
  const entry = await readJson(entryJsonPath);
  const sidebar = entry.sidebarPageConfig && typeof entry.sidebarPageConfig === 'object'
    ? JSON.parse(JSON.stringify(entry.sidebarPageConfig))
    : {};
  const importedBuckets = Array.isArray(imported?.counts?.buckets) && imported.counts.buckets.length
    ? imported.counts.buckets
    : Array.from(new Set((imported?.segments || []).map((segment) => toText(segment.bucket).toUpperCase()).filter(Boolean)));
  sidebar.lookupNumber = lookupNumber;
  sidebar.buckets = importedBuckets.length ? importedBuckets : (Array.isArray(sidebar.buckets) ? sidebar.buckets : ['A']);
  sidebar.downloads = mergeDownloads(sidebar.downloads, imported, lookupNumber);

  const manifest = buildManifestFromImport(imported, formatKeys);
  const updatedEntry = {
    ...entry,
    sidebarPageConfig: sidebar,
  };

  const recordingIndex = imported?.recordingIndex && typeof imported.recordingIndex === 'object'
    ? imported.recordingIndex
    : {};
  const sheetMeta = imported?.sheet && typeof imported.sheet === 'object'
    ? imported.sheet
    : {};
  const protectedAssetsInput = {
    lookupNumber,
    title: toText(source?.title || entry.title || slug),
    status: 'active',
    season: toText(source?.season),
    files: Array.isArray(imported?.files) ? imported.files : [],
    entitlements: [{ type: 'role', value: 'authenticated' }],
    recordingIndex: {
      sheetUrl: toText(recordingIndex.sheetUrl),
      sheetId: toText(recordingIndex.sheetId),
      gid: toText(recordingIndex.gid),
      pdfAssetId: toText(recordingIndex.pdfAssetId),
      bundleAllToken: toText(recordingIndex.bundleAllToken),
      rootFolderUrl: toText(sheetMeta.rootFolderUrl),
      bucketFolderUrls: sheetMeta.bucketFolderUrls && typeof sheetMeta.bucketFolderUrls === 'object'
        ? sheetMeta.bucketFolderUrls
        : {},
    },
    filePath: protectedAssetsPath,
  };

  if (dryRun) {
    return {
      slug,
      lookupNumber,
      dryRun: true,
      entryJsonPath,
      entryHtmlPath,
      manifestPath,
      routeHtmlPath: path.resolve(routeEntryDir, slug, 'index.html'),
      files: protectedAssetsInput.files.length,
      buckets: sidebar.buckets,
      recordingIndex: protectedAssetsInput.recordingIndex,
    };
  }

  if (updateHtml) {
    const templateHtml = await fs.readFile(entryHtmlPath, 'utf8');
    await writeEntryFromData({
      templateHtml,
      templatePath: entryHtmlPath,
      data: buildEntryWriterData(updatedEntry, sidebar, manifest, source?.title),
      opts: { dryRun: false },
    });
  } else {
    await writeJson(entryJsonPath, updatedEntry);
    await writeJson(manifestPath, manifest);
  }

  const protectedAssets = await upsertProtectedAssetsLookupMapping(protectedAssetsInput);
  const routeHtmlPath = updateHtml ? await maybeCopyRouteHtml(slug, routeEntryDir) : '';

  return {
    slug,
    lookupNumber,
    dryRun: false,
    entryJsonPath,
    entryHtmlPath,
    manifestPath,
    routeHtmlPath,
    protectedAssetsPath: protectedAssets.filePath,
    files: protectedAssetsInput.files.length,
    buckets: sidebar.buckets,
    recordingIndex: protectedAssetsInput.recordingIndex,
  };
}
