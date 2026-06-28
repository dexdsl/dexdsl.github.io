import path from 'node:path';
import { formatUavItemLookup } from './uav-lookup-authority.mjs';

function text(value) {
  return String(value ?? '').trim();
}

function naturalCompare(a, b) {
  return text(a).localeCompare(text(b), undefined, { numeric: true, sensitivity: 'base' });
}

function numberFromName(name, bucket) {
  const escaped = String(bucket).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text(name).match(new RegExp(`(?:^|\\s)${escaped}\\.([1-9]\\d{0,5})(?=\\s|\\[|\\.|$)`, 'i'));
  return match ? Number(match[1]) : 0;
}

function roleFor(file, bucket) {
  const name = text(file?.name).toLowerCase();
  const mime = text(file?.mimeType).toLowerCase();
  if (bucket === 'X' && (mime.includes('pdf') || name.endsWith('.pdf')) && name.includes('recording')) {
    return 'recording_index_pdf';
  }
  return bucket === 'X' ? 'raw' : 'media';
}

export function reconcileUavBucketFiles({
  seriesLookup,
  bucket,
  existingFiles = [],
  scannedFiles = [],
  scannedAt = new Date().toISOString(),
}) {
  const bucketCode = text(bucket).toUpperCase();
  const existingByDriveId = new Map(
    (Array.isArray(existingFiles) ? existingFiles : [])
      .filter((file) => text(file?.driveFileId))
      .map((file) => [text(file.driveFileId), file]),
  );
  const used = new Set();
  const nextFiles = [];

  for (const existing of existingByDriveId.values()) {
    const number = Number(text(existing.bucketNumber).split('.')[1]);
    if (Number.isInteger(number) && number > 0) used.add(number);
  }

  const normalizedScan = (Array.isArray(scannedFiles) ? scannedFiles : [])
    .map((file) => ({
      driveFileId: text(file.id || file.driveFileId),
      name: text(file.name || file.originalName),
      relativePath: text(file.relativePath || file.name || file.originalName),
      mimeType: text(file.mimeType || file.mime),
      size: Number(file.size ?? file.sizeBytes) || 0,
      modifiedAt: text(file.modifiedTime || file.modifiedAt),
    }))
    .filter((file) => file.driveFileId && file.name)
    .sort((a, b) => naturalCompare(a.relativePath, b.relativePath));

  // Reserve valid numbers already present in filenames before allocating gaps.
  for (const file of normalizedScan) {
    if (existingByDriveId.has(file.driveFileId)) continue;
    const parsed = numberFromName(file.name, bucketCode);
    if (parsed && !used.has(parsed)) used.add(parsed);
  }

  let cursor = 1;
  const allocate = () => {
    while (used.has(cursor)) cursor += 1;
    const value = cursor;
    used.add(value);
    cursor += 1;
    return value;
  };

  for (const scanned of normalizedScan) {
    const existing = existingByDriveId.get(scanned.driveFileId);
    let number = existing ? Number(text(existing.bucketNumber).split('.')[1]) : 0;
    if (!number) {
      const named = numberFromName(scanned.name, bucketCode);
      number = named || allocate();
    }
    const bucketNumber = `${bucketCode}.${number}`;
    nextFiles.push({
      ...(existing || {}),
      driveFileId: scanned.driveFileId,
      bucketNumber,
      lookupRaw: formatUavItemLookup(seriesLookup, bucketCode, number),
      originalName: scanned.name,
      relativePath: scanned.relativePath,
      mime: scanned.mimeType || existing?.mime || 'application/octet-stream',
      sizeBytes: scanned.size,
      ...(scanned.modifiedAt ? { modifiedAt: scanned.modifiedAt } : {}),
      missing: false,
      role: existing?.role || roleFor(scanned, bucketCode),
      outputSpectrum: existing?.outputSpectrum,
      qualifiers: Array.isArray(existing?.qualifiers) ? existing.qualifiers : [],
      sourceXItems: Array.isArray(existing?.sourceXItems) ? existing.sourceXItems : [],
      technical: existing?.technical && typeof existing.technical === 'object' ? existing.technical : {},
    });
  }

  const currentIds = new Set(normalizedScan.map((file) => file.driveFileId));
  for (const existing of existingByDriveId.values()) {
    if (currentIds.has(text(existing.driveFileId))) continue;
    nextFiles.push({ ...existing, missing: true });
  }

  nextFiles.sort((a, b) => {
    const aNumber = Number(text(a.bucketNumber).split('.')[1]) || 0;
    const bNumber = Number(text(b.bucketNumber).split('.')[1]) || 0;
    return aNumber - bNumber || naturalCompare(a.originalName, b.originalName);
  });
  return { bucket: bucketCode, scannedAt, files: nextFiles };
}

export function folderIdFromValue(value) {
  const raw = text(value);
  if (!raw) return '';
  const match = raw.match(/\/folders\/([A-Za-z0-9_-]+)/i);
  return match ? match[1] : raw.replace(/[^A-Za-z0-9_-]/g, '');
}

export function fileExtension(file) {
  return path.extname(text(file?.originalName)).slice(1).toLowerCase();
}

