// Configure download buckets (A–E, X) by Google Drive folder id: read the files
// in a bucket's Drive folder, summarise them, and merge the result into an entry
// manifest so the bucket is declared + sized for the catalog/download pipeline.

import { createDriveClient, parseDriveId, DRIVE_FOLDER_MIME } from './google-drive-inventory.mjs';
import { hasServiceAccount } from './google-sa-token.mjs';
import { BUCKET_ORDER } from './bucket-normalize.mjs';

export { BUCKET_ORDER };
const DOWNLOADABLE_EXT = /\.(wav|aif|aiff|flac|mp3|m4a|ogg|mov|mp4|m4v|webm|mkv|avi|zip)$/i;
const MAX_BUCKET_FOLDERS = 10_000;

function toText(value) {
  return String(value ?? '').trim();
}

// parseDriveId handles full URLs + /folders/<id>; tolerate a bare id too.
export function resolveBucketFolderId(input) {
  const fromUrl = parseDriveId(input);
  if (fromUrl) return fromUrl;
  const raw = toText(input);
  return /^[A-Za-z0-9_-]{16,}$/.test(raw) ? raw : '';
}

export function humanSize(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

function fileTypeFromName(name) {
  const n = String(name || '').toLowerCase();
  if (/\.(wav|aif|aiff|flac|m4a|ogg|mp3)$/.test(n)) return 'audio';
  if (/\.(mov|mp4|m4v|webm|mkv|avi)$/.test(n)) return 'video';
  if (/\.pdf$/.test(n)) return 'pdf';
  return 'unknown';
}

function safeToken(value, fallback = 'file') {
  const normalized = toText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function bucketNumberFromName(name, bucket, fallbackNumber) {
  const wanted = toText(bucket).toUpperCase();
  const matches = String(name || '').matchAll(/\b([A-EX])\.([0-9]{1,6})\b/gi);
  for (const match of matches) {
    if (String(match[1] || '').toUpperCase() === wanted) {
      return `${wanted}.${Number(match[2])}`;
    }
  }
  return `${wanted}.${Math.max(1, Number(fallbackNumber) || 1)}`;
}

function extensionFromName(name, type) {
  const match = toText(name).match(/\.([A-Za-z0-9]{1,10})$/);
  if (match) return match[1].toLowerCase();
  if (type === 'audio') return 'wav';
  if (type === 'video') return 'mov';
  if (type === 'pdf') return 'pdf';
  return 'bin';
}

function renditionFromName(name, type) {
  const bracket = toText(name).match(/\[([^\]]+)\]/);
  const raw = safeToken(bracket?.[1] || '', '');
  if (raw === 'ste' || raw === 'stereo') return 'stereo';
  if (raw) return raw;
  if (type !== 'unknown') return type;
  const withoutExtension = toText(name).replace(/\.[A-Za-z0-9]{1,10}$/, '');
  return safeToken(withoutExtension, 'file');
}

function uniqueValue(base, used, suffix = '') {
  let candidate = base;
  if (used.has(candidate.toLowerCase())) {
    const safeSuffix = safeToken(suffix, 'duplicate').slice(-16);
    candidate = `${base}-${safeSuffix}`;
  }
  let counter = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

// Build a protected-assets import (files keyed by bucket + Drive file id) from an
// entry's configured + scanned bucket folders. Only published buckets are
// included so Scan → Save → Publish makes exactly the declared buckets
// downloadable — no recording-index sheet required.
export function bucketFoldersToProtectedImport(downloads, meta = {}) {
  const bucketFolders = downloads && typeof downloads.bucketFolders === 'object' ? downloads.bucketFolders : null;
  if (!bucketFolders) return null;
  const selectedRaw = Array.isArray(downloads.selectedBuckets) ? downloads.selectedBuckets : [];
  const selected = new Set(selectedRaw.map((b) => toText(b).toUpperCase()));
  const slug = safeToken(meta.slug || meta.title || meta.lookupNumber, 'entry');
  const existingFiles = Array.isArray(meta.existingFiles) ? meta.existingFiles : [];
  const existingByDriveId = new Map(
    existingFiles
      .filter((file) => toText(file?.driveFileId))
      .map((file) => [toText(file.driveFileId), file]),
  );
  const usedFileIds = new Set();
  const usedR2Keys = new Set();
  const files = [];
  for (const bucket of BUCKET_ORDER) {
    if (selected.size && !selected.has(bucket)) continue; // only published buckets
    const cfg = bucketFolders[bucket];
    const list = cfg && Array.isArray(cfg.files) ? cfg.files : [];
    list.forEach((file, index) => {
      const fileId = toText(file.id || file.fileId);
      if (!fileId) return;
      const name = toText(file.name || file.label);
      const type = fileTypeFromName(name);
      const bucketNumber = bucketNumberFromName(name, bucket, index + 1);
      const existing = existingByDriveId.get(fileId);
      if (existing?.fileId && existing?.r2Key) {
        usedFileIds.add(toText(existing.fileId).toLowerCase());
        usedR2Keys.add(toText(existing.r2Key).toLowerCase());
        files.push({
          ...existing,
          bucket,
          bucketNumber,
          driveFileId: fileId,
          sizeBytes: Number(file.size ?? file.sizeBytes ?? existing.sizeBytes ?? 0) || 0,
          mime: toText(file.mimeType || file.mime || existing.mime) || 'application/octet-stream',
          position: files.length + 1,
          label: toText(existing.label) || name,
          sourceLabel: toText(existing.sourceLabel || existing.label) || name,
          type: toText(existing.type) || type,
          availableTypes: Array.isArray(existing.availableTypes) ? existing.availableTypes : [],
          role: toText(existing.role) || 'media',
        });
        return;
      }

      const number = bucketNumber.split('.')[1].padStart(3, '0');
      const rendition = renditionFromName(name, type);
      const extension = extensionFromName(name, type);
      const baseFileId = `${slug}-${bucket.toLowerCase()}-${number}-${rendition}`.slice(0, 47).replace(/-+$/g, '');
      const generatedFileId = uniqueValue(baseFileId, usedFileIds, fileId).slice(0, 64);
      const baseR2Key = `${slug}/${bucket.toLowerCase()}/${number}-${rendition}.${extension}`;
      const r2Key = uniqueValue(baseR2Key, usedR2Keys, fileId);
      files.push({
        bucket,
        bucketNumber,
        fileId: generatedFileId,
        driveFileId: fileId,
        r2Key,
        sizeBytes: Number(file.size ?? file.sizeBytes ?? 0) || 0,
        mime: toText(file.mimeType || file.mime) || 'application/octet-stream',
        position: files.length + 1,
        label: name,
        sourceLabel: name,
        type,
        availableTypes: [],
        role: 'media',
      });
    });
  }
  // Recording-index PDFs and other explicit support records may not live in a
  // scanned bucket folder. Keep them when rebuilding the mapping so publishing
  // scanned media cannot invalidate an existing recordingIndex reference.
  for (const existing of existingFiles) {
    if (toText(existing?.role).toLowerCase() !== 'recording_index_pdf') continue;
    const fileId = toText(existing.fileId);
    const r2Key = toText(existing.r2Key);
    if (!fileId || !r2Key || usedFileIds.has(fileId.toLowerCase()) || usedR2Keys.has(r2Key.toLowerCase())) continue;
    usedFileIds.add(fileId.toLowerCase());
    usedR2Keys.add(r2Key.toLowerCase());
    files.push({ ...existing, position: files.length + 1 });
  }
  if (!files.length) return null;
  return {
    lookupNumber: toText(meta.lookupNumber),
    title: toText(meta.title),
    season: toText(meta.season),
    status: toText(meta.status),
    files,
  };
}

// Flag buckets that are configured-but-not-published (or published with no
// folder). Returns an array of human-readable warnings.
export function auditEntryBucketFolders(entry) {
  const warnings = [];
  const downloads = entry?.sidebarPageConfig?.downloads;
  if (!downloads) return warnings;
  const bucketFolders = downloads.bucketFolders && typeof downloads.bucketFolders === 'object' ? downloads.bucketFolders : {};
  const selected = new Set((Array.isArray(downloads.selectedBuckets) ? downloads.selectedBuckets : []).map((b) => toText(b).toUpperCase()));
  for (const bucket of BUCKET_ORDER) {
    const cfg = bucketFolders[bucket];
    const hasFolder = Boolean(cfg && toText(cfg.folderId));
    if (hasFolder && !selected.has(bucket)) {
      warnings.push(`bucket ${bucket}: Drive folder configured but not published (add ${bucket} to selectedBuckets, then re-publish)`);
    }
    if (selected.has(bucket) && !hasFolder) {
      warnings.push(`bucket ${bucket}: published but has no Drive folder configured`);
    }
    if (hasFolder && selected.has(bucket) && (!Array.isArray(cfg.files) || cfg.files.length === 0)) {
      warnings.push(`bucket ${bucket}: published with a folder but not scanned (no files captured — open the entry and Scan)`);
    }
  }
  return warnings;
}

// Walk a bucket folder breadth-first. Drive shortcuts are normalized to their
// target ids by createDriveClient(), so seenFolders also prevents shortcut
// cycles (including a nested shortcut back to the bucket root). File ids are
// de-duplicated because the same target can be reachable through more than one
// shortcut/folder path.
export async function listBucketFolderRecursive({
  folderId,
  driveClient,
  maxFolders = MAX_BUCKET_FOLDERS,
} = {}) {
  const id = resolveBucketFolderId(folderId);
  if (!id) throw new Error('A Google Drive folder id or URL is required.');
  if (!driveClient || typeof driveClient.listFolder !== 'function') {
    throw new Error('A Drive client with listFolder() is required.');
  }

  const folderLimit = Math.max(1, Number(maxFolders) || MAX_BUCKET_FOLDERS);
  const queue = [{ id, path: '', depth: 0 }];
  const seenFolders = new Set([id]);
  const seenFiles = new Set();
  const files = [];
  let maxDepth = 0;

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    const entries = await driveClient.listFolder(current.id);
    for (const entry of Array.isArray(entries) ? entries : []) {
      const entryId = toText(entry?.id);
      const name = toText(entry?.name);
      if (!entryId) continue;
      const relativePath = [current.path, name].filter(Boolean).join('/');
      const depth = current.depth + 1;
      maxDepth = Math.max(maxDepth, depth);

      if (entry.mimeType === DRIVE_FOLDER_MIME) {
        if (seenFolders.has(entryId)) continue;
        if (seenFolders.size >= folderLimit) {
          throw new Error(`Bucket folder scan exceeded the ${folderLimit}-folder safety limit.`);
        }
        seenFolders.add(entryId);
        queue.push({ id: entryId, path: relativePath, depth });
        continue;
      }

      if (seenFiles.has(entryId)) continue;
      seenFiles.add(entryId);
      files.push({
        ...entry,
        relativePath,
        parentFolderId: current.id,
        depth,
      });
    }
  }

  return {
    files,
    subfolders: Math.max(0, seenFolders.size - 1),
    foldersScanned: seenFolders.size,
    maxDepth,
  };
}

// Read a bucket's Drive folder and summarise the downloadable files within.
export async function scanBucketFolder({
  folderId,
  keyPath,
  driveClient,
  maxFolders = MAX_BUCKET_FOLDERS,
} = {}) {
  const id = resolveBucketFolderId(folderId);
  if (!id) throw new Error('A Google Drive folder id or URL is required.');
  if (!driveClient && !hasServiceAccount(keyPath)) {
    throw new Error('Google service account is not configured (set GOOGLE_APPLICATION_CREDENTIALS or place the key where google-sa-token resolves it).');
  }
  const client = driveClient || createDriveClient({ keyPath });
  const traversal = await listBucketFolderRecursive({
    folderId: id,
    driveClient: client,
    maxFolders,
  });
  const files = traversal.files
    .filter((file) => file.mimeType !== DRIVE_FOLDER_MIME)
    .filter((file) => DOWNLOADABLE_EXT.test(file.name) || Number(file.size) > 0)
    .map((file) => ({
      id: file.id,
      name: file.name,
      relativePath: file.relativePath,
      size: Number(file.size) || 0,
      mimeType: file.mimeType,
    }))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath, undefined, { numeric: true, sensitivity: 'base' }));
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  return {
    folderId: id,
    count: files.length,
    subfolders: traversal.subfolders,
    foldersScanned: traversal.foldersScanned,
    maxDepth: traversal.maxDepth,
    totalBytes,
    humanSize: humanSize(totalBytes),
    files,
  };
}

// Merge a folder config (and optional scan) into an entry manifest. Mutates a
// copy is the caller's job; this mutates `entry` in place and returns it.
export function applyBucketFolder(entry, bucket, { folderId, scan } = {}) {
  if (!entry || typeof entry !== 'object') throw new Error('entry object is required.');
  const key = toText(bucket).toUpperCase();
  if (!BUCKET_ORDER.includes(key)) throw new Error(`Unknown bucket: ${bucket}`);

  const sidebar = entry.sidebarPageConfig || (entry.sidebarPageConfig = {});
  const downloads = sidebar.downloads || (sidebar.downloads = {});
  const bucketFolders = downloads.bucketFolders || (downloads.bucketFolders = {});

  const id = resolveBucketFolderId(folderId || scan?.folderId);
  const record = {
    folderId: id,
    fileCount: scan ? scan.count : (bucketFolders[key]?.fileCount ?? 0),
    totalBytes: scan ? scan.totalBytes : (bucketFolders[key]?.totalBytes ?? 0),
    scannedAt: scan ? new Date().toISOString() : (bucketFolders[key]?.scannedAt ?? ''),
  };
  bucketFolders[key] = record;

  // Declare the bucket as selected so the catalog/download UI publishes it.
  const current = Array.isArray(downloads.selectedBuckets)
    ? downloads.selectedBuckets
    : (Array.isArray(sidebar.buckets) ? sidebar.buckets : []);
  const set = new Set(current.map((b) => toText(b).toUpperCase()));
  if (id) set.add(key);
  const ordered = BUCKET_ORDER.filter((b) => set.has(b));
  downloads.selectedBuckets = ordered;
  sidebar.buckets = ordered;

  // Populate the human-readable static size for the download card.
  if (scan) {
    const fileSpecs = downloads.fileSpecs || (downloads.fileSpecs = {});
    const staticSizes = fileSpecs.staticSizes || (fileSpecs.staticSizes = {});
    staticSizes[key] = scan.humanSize || humanSize(scan.totalBytes);
  }

  return entry;
}

export function removeBucketFolder(entry, bucket) {
  const key = toText(bucket).toUpperCase();
  const downloads = entry?.sidebarPageConfig?.downloads;
  if (!downloads) return entry;
  if (downloads.bucketFolders) delete downloads.bucketFolders[key];
  const current = Array.isArray(downloads.selectedBuckets) ? downloads.selectedBuckets : [];
  const ordered = BUCKET_ORDER.filter((b) => current.map((x) => toText(x).toUpperCase()).includes(b) && b !== key);
  downloads.selectedBuckets = ordered;
  if (entry.sidebarPageConfig) entry.sidebarPageConfig.buckets = ordered;
  return entry;
}
