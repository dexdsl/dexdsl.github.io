#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  bucketFoldersToProtectedImport,
  listBucketFolderRecursive,
  scanBucketFolder,
} from './lib/entry-bucket-folders.mjs';
import { DRIVE_FOLDER_MIME } from './lib/google-drive-inventory.mjs';
import { normalizeProtectedAssetsFile } from './lib/protected-assets-schema.mjs';

const ROOT = 'root-folder-000001';
const AUDIO = 'audio-folder-00001';
const AUDIO_VIDEO = 'av-folder-00000001';
const VIDEO = 'video-folder-00001';
const VIDEO_1080 = '1080-folder-000001';
const VIDEO_4K = '4k-folder-0000001';

const folder = (id, name) => ({ id, name, mimeType: DRIVE_FOLDER_MIME, size: 0 });
const file = (id, name, size, mimeType) => ({ id, name, size, mimeType });

const tree = new Map([
  [ROOT, [
    folder(AUDIO, 'audio'),
    folder(AUDIO_VIDEO, 'audio and video'),
  ]],
  [AUDIO, [
    file('audio-file-000001', 'B.1.wav', 100, 'audio/wav'),
  ]],
  [AUDIO_VIDEO, [
    folder(VIDEO, 'video'),
  ]],
  [VIDEO, [
    folder(VIDEO_1080, '1080p'),
    folder(VIDEO_4K, '4K'),
  ]],
  [VIDEO_1080, [
    file('video-file-1080-01', 'B.2.mp4', 200, 'video/mp4'),
  ]],
  [VIDEO_4K, [
    file('video-file-4k-0001', 'B.3.mp4', 300, 'video/mp4'),
    // A second route to the 1080p file must not duplicate it.
    file('video-file-1080-01', 'B.2 duplicate shortcut.mp4', 200, 'video/mp4'),
    // Drive folder shortcuts are normalized to their target ids. This models
    // a shortcut back to the bucket root and proves the walker cannot cycle.
    folder(ROOT, 'back to B bucket'),
  ]],
]);

const listed = [];
const driveClient = {
  async listFolder(folderId) {
    listed.push(folderId);
    return tree.get(folderId) || [];
  },
};

const traversal = await listBucketFolderRecursive({
  folderId: ROOT,
  driveClient,
});

assert.equal(traversal.foldersScanned, 6);
assert.equal(traversal.subfolders, 5);
assert.equal(traversal.maxDepth, 4);
assert.equal(traversal.files.length, 3);
assert.equal(new Set(listed).size, listed.length, 'each Drive folder should be listed at most once');
assert.equal(listed.filter((id) => id === ROOT).length, 1, 'cycle must not revisit the bucket root');

const scan = await scanBucketFolder({
  folderId: `https://drive.google.com/drive/folders/${ROOT}`,
  driveClient,
});

assert.equal(scan.folderId, ROOT);
assert.equal(scan.count, 3);
assert.equal(scan.totalBytes, 600);
assert.equal(scan.humanSize, '600 B');
assert.equal(scan.subfolders, 5);
assert.equal(scan.foldersScanned, 6);
assert.equal(scan.maxDepth, 4);
assert.deepEqual(
  new Set(scan.files.map((entry) => entry.relativePath)),
  new Set([
    'audio/B.1.wav',
    'audio and video/video/1080p/B.2.mp4',
    'audio and video/video/4K/B.3.mp4',
  ]),
);

const protectedImport = bucketFoldersToProtectedImport({
  selectedBuckets: ['B'],
  bucketFolders: {
    B: {
      folderId: ROOT,
      files: scan.files,
    },
  },
}, {
  slug: 'unit-entry',
  lookupNumber: 'W.Ob. Ma AV2024 S2',
  title: 'UNIT ENTRY',
  season: 'S2',
  status: 'active',
  existingFiles: [{
    bucketNumber: 'X.1',
    fileId: 'unit-entry-recording-index-pdf',
    bucket: 'X',
    r2Key: 'unit-entry/recording-index/recording-index.pdf',
    driveFileId: '',
    sizeBytes: 10,
    mime: 'application/pdf',
    position: 4,
    label: 'Recording Index PDF',
    sourceLabel: 'Recording Index PDF',
    type: 'pdf',
    availableTypes: ['pdf'],
    role: 'recording_index_pdf',
  }],
});
assert.equal(protectedImport.files.length, 4);
assert.equal(protectedImport.files.find((entry) => entry.label === 'B.1.wav')?.type, 'audio');
assert.equal(protectedImport.files.find((entry) => entry.label === 'B.2.mp4')?.type, 'video');
assert.deepEqual(
  protectedImport.files.filter((entry) => entry.bucket === 'B').map((entry) => entry.bucketNumber).sort(),
  ['B.1', 'B.2', 'B.3'],
);
assert.ok(protectedImport.files.every((entry) => entry.r2Key), 'every scanned file must have an R2 key');
assert.equal(
  new Set(protectedImport.files.map((entry) => entry.r2Key)).size,
  protectedImport.files.length,
  'generated R2 keys must be unique',
);
assert.ok(
  protectedImport.files.some((entry) => entry.role === 'recording_index_pdf'),
  'an existing recording-index PDF must survive a scanned-folder rebuild',
);
normalizeProtectedAssetsFile({
  version: 'protected-assets-v1',
  updatedAt: new Date().toISOString(),
  settings: {
    storageBucket: 'dex-protected-assets',
    allowedBuckets: ['A', 'B', 'C', 'D', 'E', 'X'],
    syncStrategy: 'manifest-publish',
  },
  lookups: [{
    ...protectedImport,
    entitlements: [{ type: 'role', value: 'authenticated' }],
  }],
  exemptions: [],
});

await assert.rejects(
  listBucketFolderRecursive({
    folderId: ROOT,
    driveClient,
    maxFolders: 2,
  }),
  /2-folder safety limit/,
);

console.log('entry bucket folder recursive scan test passed');
