// Configure download buckets (A–E, X) by Google Drive folder id: read the files
// in a bucket's Drive folder, summarise them, and merge the result into an entry
// manifest so the bucket is declared + sized for the catalog/download pipeline.

import { createDriveClient, parseDriveId, DRIVE_FOLDER_MIME } from './google-drive-inventory.mjs';
import { hasServiceAccount } from './google-sa-token.mjs';
import { BUCKET_ORDER } from './bucket-normalize.mjs';

export { BUCKET_ORDER };
const DOWNLOADABLE_EXT = /\.(wav|aif|aiff|flac|mp3|m4a|ogg|zip)$/i;

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
  if (/\.zip$/.test(n)) return 'bundle';
  if (/\.pdf$/.test(n)) return 'pdf';
  if (/\.(jpe?g|png|webp|gif)$/.test(n)) return 'image';
  return 'unknown';
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
  const files = [];
  for (const bucket of BUCKET_ORDER) {
    if (selected.size && !selected.has(bucket)) continue; // only published buckets
    const cfg = bucketFolders[bucket];
    const list = cfg && Array.isArray(cfg.files) ? cfg.files : [];
    list.forEach((file, index) => {
      const fileId = toText(file.id || file.fileId);
      if (!fileId) return;
      const name = toText(file.name || file.label);
      files.push({
        bucket,
        bucketNumber: `${bucket}${index + 1}`,
        fileId,
        driveFileId: fileId,
        sizeBytes: Number(file.size ?? file.sizeBytes ?? 0) || 0,
        mime: toText(file.mimeType || file.mime),
        label: name,
        sourceLabel: name,
        type: fileTypeFromName(name),
        availableTypes: [],
        role: 'recording',
      });
    });
  }
  if (!files.length) return null;
  return {
    lookupNumber: toText(meta.lookupNumber),
    title: toText(meta.title),
    season: toText(meta.season),
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

// Read a bucket's Drive folder and summarise the downloadable files within.
export async function scanBucketFolder({ folderId, keyPath } = {}) {
  const id = resolveBucketFolderId(folderId);
  if (!id) throw new Error('A Google Drive folder id or URL is required.');
  if (!hasServiceAccount(keyPath)) {
    throw new Error('Google service account is not configured (set GOOGLE_APPLICATION_CREDENTIALS or place the key where google-sa-token resolves it).');
  }
  const client = createDriveClient({ keyPath });
  const entries = await client.listFolder(id);
  const files = entries
    .filter((file) => file.mimeType !== DRIVE_FOLDER_MIME)
    .filter((file) => DOWNLOADABLE_EXT.test(file.name) || Number(file.size) > 0)
    .map((file) => ({ id: file.id, name: file.name, size: Number(file.size) || 0, mimeType: file.mimeType }));
  const subfolders = entries.filter((file) => file.mimeType === DRIVE_FOLDER_MIME).length;
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  return {
    folderId: id,
    count: files.length,
    subfolders,
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
