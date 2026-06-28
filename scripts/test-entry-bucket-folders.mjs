#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  bucketFoldersToProtectedImport,
  listBucketFolderRecursive,
  scanBucketFolder,
} from './lib/entry-bucket-folders.mjs';
import { DRIVE_FOLDER_MIME } from './lib/google-drive-inventory.mjs';

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
});
assert.equal(protectedImport.files.length, 3);
assert.equal(protectedImport.files.find((entry) => entry.label === 'B.1.wav')?.type, 'audio');
assert.equal(protectedImport.files.find((entry) => entry.label === 'B.2.mp4')?.type, 'video');

await assert.rejects(
  listBucketFolderRecursive({
    folderId: ROOT,
    driveClient,
    maxFolders: 2,
  }),
  /2-folder safety limit/,
);

console.log('entry bucket folder recursive scan test passed');
