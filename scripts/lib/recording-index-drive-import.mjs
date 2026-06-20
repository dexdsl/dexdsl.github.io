import path from 'node:path';
import {
  createDriveClient,
  driveFileUrl,
  driveFolderUrl,
  listDriveTree,
  parseDriveId,
} from './google-drive-inventory.mjs';
import { parseRecordingIndexSheetUrl } from './recording-index-import.mjs';

const BUCKET_ORDER = new Map(['A', 'B', 'C', 'D', 'E', 'X'].map((bucket, index) => [bucket, index]));
const AUDIO_EXTENSIONS = new Set(['wav', 'aif', 'aiff', 'flac', 'mp3', 'm4a']);
const VIDEO_EXTENSIONS = new Set(['mov', 'mp4', 'mkv', 'webm']);

function toText(value) {
  return String(value ?? '').trim();
}

function slugifyToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'entry';
}

function formatSlug(value) {
  return toText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 16);
}

function padNumber(value) {
  return String(Math.max(0, Number(value) || 0)).padStart(3, '0');
}

function inferExtension(filename = '') {
  const ext = path.extname(toText(filename)).replace(/^\./, '').toLowerCase();
  return ext;
}

function inferMimeFromExtension(extension, fallbackType = 'unknown') {
  const ext = toText(extension).toLowerCase();
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'aif' || ext === 'aiff') return 'audio/aiff';
  if (ext === 'flac') return 'audio/flac';
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'm4a') return 'audio/mp4';
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'mkv') return 'video/x-matroska';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'pdf') return 'application/pdf';
  if (fallbackType === 'audio') return 'audio/*';
  if (fallbackType === 'video') return 'video/*';
  return '';
}

function mediaTypeForFile(file = {}) {
  const mime = toText(file.mimeType || file.mime).toLowerCase();
  const ext = inferExtension(file.name);
  if (mime.startsWith('audio/') || AUDIO_EXTENSIONS.has(ext)) return 'audio';
  if (mime.startsWith('video/') || VIDEO_EXTENSIONS.has(ext)) return 'video';
  return '';
}

function extractBucketNumber(name) {
  const raw = toText(name);
  const numbered = raw.match(/(?:^|[^A-Za-z0-9])([A-E])\s*\.\s*([0-9]{1,6})(?=[^0-9]|$)/i);
  const bucketOnly = numbered
    ? null
    : raw.match(/(?:^|[^A-Za-z0-9])([A-E])\s*\.\s*(?=\.)/i);
  const match = numbered || bucketOnly;
  if (!match) return null;
  const bucket = match[1].toUpperCase();
  const numberText = numbered ? toText(match[2]) : '';
  const number = numberText ? Number(numberText) : 0;
  if (!Number.isFinite(number) || number < 0) return null;
  return {
    bucket,
    number,
    bucketNumber: `${bucket}.${number}`,
  };
}

function formatFromContext(file = {}, lineageNames = [], type = '') {
  const name = toText(file.name);
  const bracket = name.match(/\[([^\]]+)\]/);
  const text = [
    bracket?.[1] || '',
    ...lineageNames,
    name,
  ].join(' ').toLowerCase();
  if (/\b(4k|2160p?)\b/.test(text)) return { format: '4k', ext: 'mov' };
  if (/\b1080p?\b/.test(text)) return { format: '1080p', ext: 'mov' };
  if (/\b720p?\b/.test(text)) return { format: '720p', ext: 'mov' };
  if (/\b480p?\b/.test(text)) return { format: '480p', ext: 'mov' };
  if (/\b(ste|stereo)\b/.test(text)) return { format: 'stereo', ext: 'wav' };
  if (/\bmono\b/.test(text)) return { format: 'mono', ext: 'wav' };
  if (/\b(audio only|audio|wav|aiff?|flac)\b/.test(text)) return { format: 'stereo', ext: 'wav' };
  const ext = inferExtension(name);
  if (ext) return { format: formatSlug(ext) || type || 'file', ext };
  return {
    format: type || 'file',
    ext: type === 'audio' ? 'wav' : type === 'video' ? 'mov' : 'bin',
  };
}

function buildParentMaps(tree = {}) {
  const byId = new Map();
  if (tree.root?.id) byId.set(tree.root.id, tree.root);
  for (const folder of tree.folders || []) {
    if (folder?.id) byId.set(folder.id, folder);
  }
  for (const file of tree.files || []) {
    if (file?.id) byId.set(file.id, file);
  }
  return byId;
}

function lineageForFile(file = {}, byId) {
  const out = [];
  let parentId = file.parentId || (Array.isArray(file.parents) ? file.parents[0] : '');
  const seen = new Set();
  while (parentId && byId.has(parentId) && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    out.push(parent);
    parentId = parent.parentId || (Array.isArray(parent.parents) ? parent.parents[0] : '');
  }
  return out;
}

function bucketFromFolderName(name) {
  const normalized = toText(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const match = normalized.match(/^(?:bucket\s*)?([abcde]|x)(?:\b|\s|$)/i);
  return match ? match[1].toUpperCase() : '';
}

function bucketFolderUrlsFromTree(tree = {}, source = {}) {
  const out = {
    ...(source.bucketFolderUrls && typeof source.bucketFolderUrls === 'object' ? source.bucketFolderUrls : {}),
  };
  for (const folder of tree.folders || []) {
    if (!folder?.id || folder.id === tree.root?.id || !folder.parentId) continue;
    const bucket = bucketFromFolderName(folder.name);
    if (!bucket || out[bucket]) continue;
    out[bucket] = folder.webViewLink || driveFolderUrl(folder.id);
  }
  return out;
}

function resolvePdfBucketNumber(files) {
  const existing = new Set(
    (files || [])
      .map((item) => toText(item.bucketNumber).toUpperCase())
      .filter(Boolean),
  );
  let next = 1;
  while (existing.has(`X.${next}`)) next += 1;
  return `X.${next}`;
}

function buildBundleTokensByBucketType(files, lookupNumber) {
  const out = {};
  for (const file of files) {
    if (!file.enabled) continue;
    if (file.type === 'audio') out[`${file.bucket}:audio`] = `bundle:lookup:${lookupNumber}:${file.bucket}:audio`;
    if (file.type === 'video') out[`${file.bucket}:video`] = `bundle:lookup:${lookupNumber}:${file.bucket}:video`;
  }
  return out;
}

export function buildDriveRecordingIndexImportFromTree({
  source,
  tree,
} = {}) {
  const lookupNumber = toText(source?.lookupNumber);
  if (!lookupNumber) throw new Error('lookupNumber is required for Drive recording-index import.');
  const slug = slugifyToken(source?.slug || lookupNumber);
  const sheet = parseRecordingIndexSheetUrl(source?.sheetUrl);
  const byId = buildParentMaps(tree);
  const seenFileIds = new Set();
  const seenOutputIds = new Map();
  const files = [];

  for (const file of tree?.files || []) {
    if (!file || file.id === source?.sheetId) continue;
    const type = mediaTypeForFile(file);
    if (!type) continue;
    const parsed = extractBucketNumber(file.name);
    if (!parsed) continue;
    const lineage = lineageForFile(file, byId);
    const lineageNames = lineage.map((item) => item.name).filter(Boolean);
    const { format, ext: formatExt } = formatFromContext(file, lineageNames, type);
    const ext = inferExtension(file.name) || formatExt || (type === 'audio' ? 'wav' : 'mov');
    const formatKey = formatSlug(format || ext || type) || type;
    const base = `${slug}-${parsed.bucket.toLowerCase()}-${padNumber(parsed.number)}-${formatKey}`;
    const duplicateIndex = seenOutputIds.get(base) || 0;
    seenOutputIds.set(base, duplicateIndex + 1);
    const fileId = duplicateIndex ? `${base}-${duplicateIndex + 1}` : base;
    if (seenFileIds.has(file.id)) continue;
    seenFileIds.add(file.id);
    files.push({
      bucketNumber: parsed.bucketNumber,
      bucket: parsed.bucket,
      segmentNumber: parsed.number,
      format: formatKey,
      label: toText(file.name),
      sourceLabel: toText(file.name),
      rawUrl: file.webViewLink || driveFileUrl(file.id),
      driveFileId: file.id,
      type,
      typeReason: 'drive-file',
      availableTypes: [type],
      fileId,
      r2Key: `${slug}/${parsed.bucket.toLowerCase()}/${padNumber(parsed.number)}-${formatKey}.${ext}`,
      sizeBytes: Number(file.size || 0) || 0,
      mime: toText(file.mimeType) || inferMimeFromExtension(ext, type),
      position: files.length + 1,
      enabled: true,
      role: 'media',
    });
  }

  files.sort((a, b) => {
    const bucketDiff = (BUCKET_ORDER.get(a.bucket) ?? 999) - (BUCKET_ORDER.get(b.bucket) ?? 999);
    if (bucketDiff) return bucketDiff;
    if (a.segmentNumber !== b.segmentNumber) return a.segmentNumber - b.segmentNumber;
    const typeDiff = a.type.localeCompare(b.type);
    if (typeDiff) return typeDiff;
    return a.format.localeCompare(b.format);
  });
  files.forEach((file, index) => {
    file.position = index + 1;
  });

  if (!files.length) {
    throw new Error(`No Drive audio/video files with bucket numbers were found for ${source?.slug || lookupNumber}.`);
  }

  const pdfAssetId = `${slug}-recording-index-pdf`;
  const bundleAllToken = `bundle:recording-index:${lookupNumber}:all`;
  const pdfBucketNumber = resolvePdfBucketNumber(files);
  const pdfFile = {
    bucketNumber: pdfBucketNumber,
    bucket: 'X',
    segmentNumber: Number(String(pdfBucketNumber).split('.')[1] || 1),
    label: 'Recording Index PDF',
    sourceLabel: 'Recording Index PDF',
    rawUrl: sheet.pdfExportUrl,
    driveFileId: '',
    type: 'pdf',
    availableTypes: ['pdf'],
    fileId: pdfAssetId,
    r2Key: `${slug}/recording-index/recording-index.pdf`,
    sizeBytes: 0,
    mime: 'application/pdf',
    position: files.length + 1,
    enabled: true,
    role: 'recording_index_pdf',
  };

  const buckets = Array.from(new Set(files.map((file) => file.bucket))).sort((a, b) => (
    (BUCKET_ORDER.get(a) ?? 999) - (BUCKET_ORDER.get(b) ?? 999)
  ));
  const counts = {
    totalFiles: files.length,
    audioFiles: files.filter((file) => file.type === 'audio').length,
    videoFiles: files.filter((file) => file.type === 'video').length,
    unknownFiles: 0,
    buckets,
  };
  const bucketFolderUrls = bucketFolderUrlsFromTree(tree, source);

  return {
    sheet: {
      ...sheet,
      rootFolderUrl: source?.driveRootFolderUrl || driveFolderUrl(source?.driveRootFolderId),
      bucketFolderUrls,
    },
    source: {
      mode: 'drive-files',
      value: source?.driveRootFolderUrl || driveFolderUrl(source?.driveRootFolderId),
      warning: '',
    },
    files: [...files, pdfFile],
    segments: files,
    bundleTokensByBucketType: buildBundleTokensByBucketType(files, lookupNumber),
    recordingIndex: {
      sheetUrl: sheet.sheetUrl,
      sheetId: sheet.sheetId,
      gid: sheet.gid,
      pdfAssetId,
      bundleAllToken,
      recordingIndexPdfRef: `asset:${pdfAssetId}`,
      recordingIndexBundleRef: bundleAllToken,
      recordingIndexSourceUrl: sheet.sheetUrl,
    },
    counts,
  };
}

export async function importRecordingIndexFromDriveSource({
  source,
  serviceAccountKeyPath,
  maxDepth = 8,
} = {}) {
  const rootId = parseDriveId(source?.driveRootFolderId || source?.driveRootFolderUrl || '');
  if (!rootId) {
    throw new Error(`Missing Drive root folder for ${source?.slug || source?.lookupNumber || 'recording index'}.`);
  }
  const driveClient = createDriveClient({ keyPath: serviceAccountKeyPath });
  const tree = await listDriveTree({
    rootFolderId: rootId,
    driveClient,
    maxDepth,
  });
  return buildDriveRecordingIndexImportFromTree({ source, tree });
}
