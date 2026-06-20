#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  driveFolderUrl,
  googleSheetUrl,
  parseDriveId,
} from './lib/google-drive-inventory.mjs';
import { buildDriveRecordingIndexImportFromTree } from './lib/recording-index-drive-import.mjs';
import {
  bucketFromFolderName,
  discoverRecordingIndexSourcesFromDriveTree,
  matchCatalogEntry,
  normalizeRecordingIndexSources,
  validateRecordingIndexSources,
} from './lib/recording-index-sources.mjs';

const catalogEntries = [
  {
    id: 'amplified-tv-sam-pluta',
    title_raw: 'AMPLIFIED TV SETS',
    performer_raw: 'pluta, sam',
    instrument_labels: ['FEEDBACK TELEVISIONS'],
    lookup_raw: 'X.Tlv. Pl AV2023 S1',
    season: 'S1',
  },
  {
    id: 'multiperc',
    title_raw: 'MULTIPLE PERCUSSION',
    performer_raw: 'giroux, ben',
    instrument_labels: ['MULTIPLE PERCUSSION'],
    lookup_raw: 'P.Mpc. Gi AV2024 S2',
    season: 'S2',
  },
];

assert.equal(
  parseDriveId('https://drive.google.com/drive/folders/1ta8gWjbaNdUgEVuzcjj2PypAeRAa_a0w?usp=drive_link'),
  '1ta8gWjbaNdUgEVuzcjj2PypAeRAa_a0w',
);
assert.equal(
  parseDriveId('https://docs.google.com/spreadsheets/d/abc123_EDIT/edit?gid=0#gid=0'),
  'abc123_EDIT',
);
assert.equal(
  driveFolderUrl('folder123'),
  'https://drive.google.com/drive/folders/folder123',
);
assert.equal(
  googleSheetUrl('sheet123'),
  'https://docs.google.com/spreadsheets/d/sheet123/edit?gid=0#gid=0',
);

assert.equal(bucketFromFolderName('A'), 'A');
assert.equal(bucketFromFolderName('bucket C alternates'), 'C');
assert.equal(bucketFromFolderName('X recording index'), 'X');
assert.equal(bucketFromFolderName('camera files'), '');

const match = matchCatalogEntry(catalogEntries, ['Sam Pluta', 'Amplified TV Recording Index'], { season: 'S1' });
assert.equal(match?.candidate.slug, 'amplified-tv-sam-pluta');

const registry = normalizeRecordingIndexSources({
  seasons: {
    S1: {
      driveRootFolderUrl: 'https://drive.google.com/drive/folders/root123',
    },
  },
  entries: {
    'amplified-tv-sam-pluta': {
      season: 'S1',
      lookupNumber: 'X.Tlv. Pl AV2023 S1',
      sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet123/edit?gid=0#gid=0',
      driveRootFolderUrl: 'https://drive.google.com/drive/folders/entryRoot',
      bucketFolderUrls: {
        A: 'https://drive.google.com/drive/folders/bucketA',
      },
    },
  },
});
assert.equal(registry.seasons.S1.driveRootFolderId, 'root123');
assert.equal(registry.entries['amplified-tv-sam-pluta'].sheetId, 'sheet123');
assert.equal(registry.entries['amplified-tv-sam-pluta'].bucketFolderIds.A, 'bucketA');

const validation = validateRecordingIndexSources({
  registry,
  catalogEntries,
  season: 'S1',
});
assert.equal(validation.ok, true);

const tree = {
  root: {
    id: 'root',
    name: 'DEX Season 1',
    mimeType: 'application/vnd.google-apps.folder',
    webViewLink: driveFolderUrl('root'),
  },
  files: [
    {
      id: 'entryRoot',
      parentId: 'root',
      parents: ['root'],
      name: 'Sam Pluta - Amplified TV',
      mimeType: 'application/vnd.google-apps.folder',
      webViewLink: driveFolderUrl('entryRoot'),
      depth: 1,
    },
    {
      id: 'bucketA',
      parentId: 'entryRoot',
      parents: ['entryRoot'],
      name: 'A',
      mimeType: 'application/vnd.google-apps.folder',
      webViewLink: driveFolderUrl('bucketA'),
      depth: 2,
    },
    {
      id: 'sheet123',
      parentId: 'entryRoot',
      parents: ['entryRoot'],
      name: 'Amplified TV Recording Index',
      mimeType: 'application/vnd.google-apps.spreadsheet',
      webViewLink: googleSheetUrl('sheet123'),
      depth: 2,
    },
  ],
};
const discovered = discoverRecordingIndexSourcesFromDriveTree({
  tree,
  catalogEntries,
  season: 'S1',
});
assert.equal(discovered.entries['amplified-tv-sam-pluta'].sheetId, 'sheet123');
assert.equal(discovered.entries['amplified-tv-sam-pluta'].bucketFolderIds.A, 'bucketA');

const driveImport = buildDriveRecordingIndexImportFromTree({
  source: {
    slug: 'cello-emmanuel-losa',
    lookupNumber: 'S.Vlc. Lo AV2023 S1',
    sheetUrl: googleSheetUrl('sheet123'),
    sheetId: 'sheet123',
    driveRootFolderId: 'entryRoot',
    driveRootFolderUrl: driveFolderUrl('entryRoot'),
    bucketFolderUrls: {
      A: driveFolderUrl('bucketA'),
      B: driveFolderUrl('bucketB'),
    },
  },
  tree: {
    root: {
      id: 'entryRoot',
      name: 'S.Vlc. Lo AV2023 S1 - Cello, Emmanuel Losa',
      mimeType: 'application/vnd.google-apps.folder',
      webViewLink: driveFolderUrl('entryRoot'),
    },
    folders: [
      {
        id: 'entryRoot',
        name: 'S.Vlc. Lo AV2023 S1 - Cello, Emmanuel Losa',
        mimeType: 'application/vnd.google-apps.folder',
        webViewLink: driveFolderUrl('entryRoot'),
      },
      {
        id: 'bucketB',
        parentId: 'entryRoot',
        name: 'B - Chunks by Texture',
        mimeType: 'application/vnd.google-apps.folder',
        webViewLink: driveFolderUrl('bucketB'),
      },
      {
        id: 'audioVideo',
        parentId: 'bucketB',
        name: 'Audio + Video',
        mimeType: 'application/vnd.google-apps.folder',
        webViewLink: driveFolderUrl('audioVideo'),
      },
      {
        id: 'fourK',
        parentId: 'audioVideo',
        name: '4K',
        mimeType: 'application/vnd.google-apps.folder',
        webViewLink: driveFolderUrl('fourK'),
      },
      {
        id: 'audioOnly',
        parentId: 'bucketB',
        name: 'Audio Only',
        mimeType: 'application/vnd.google-apps.folder',
        webViewLink: driveFolderUrl('audioOnly'),
      },
    ],
    files: [
      {
        id: 'sheet123',
        parentId: 'entryRoot',
        name: 'Recording Index',
        mimeType: 'application/vnd.google-apps.spreadsheet',
      },
      {
        id: 'video1',
        parentId: 'fourK',
        name: 'S.Vlc. Lo AV2023 S1 B.1 [4K].mov',
        mimeType: 'video/quicktime',
        size: 123,
      },
      {
        id: 'audio1',
        parentId: 'audioOnly',
        name: 'S.Vlc. Lo AV2023 S1 B.1 [ste].wav',
        mimeType: 'audio/wav',
        size: 456,
      },
      {
        id: 'bucketFull',
        parentId: 'audioOnly',
        name: 'S.Vlc. Lo AV2023 S1 B..wav',
        mimeType: 'audio/wav',
        size: 789,
      },
      {
        id: 'lookupPrefix',
        parentId: 'fourK',
        name: 'E.Gtr. Ba AV2023 S1 A.1 [4K].mov',
        mimeType: 'video/quicktime',
        size: 987,
      },
    ],
  },
});
assert.equal(driveImport.counts.totalFiles, 4);
assert.equal(driveImport.counts.audioFiles, 2);
assert.equal(driveImport.counts.videoFiles, 2);
assert.deepEqual(driveImport.counts.buckets, ['A', 'B']);
assert(driveImport.files.some((file) => file.bucketNumber === 'B.0' && file.fileId.endsWith('-b-000-stereo')));
assert(driveImport.files.some((file) => file.bucketNumber === 'B.1' && file.fileId.endsWith('-b-001-4k')));
assert(driveImport.files.some((file) => file.bucketNumber === 'A.1' && file.fileId.endsWith('-a-001-4k')));
assert(!driveImport.files.some((file) => file.bucketNumber === 'E.0'));
assert.equal(driveImport.bundleTokensByBucketType['B:audio'], 'bundle:lookup:S.Vlc. Lo AV2023 S1:B:audio');
assert.equal(driveImport.bundleTokensByBucketType['B:video'], 'bundle:lookup:S.Vlc. Lo AV2023 S1:B:video');

console.log('test-recording-indexes passed');
