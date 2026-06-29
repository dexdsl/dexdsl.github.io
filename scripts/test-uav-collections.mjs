#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  assertUavLookup,
  formatUavCollectionLookup,
  formatUavItemLookup,
  formatUavSeriesLookup,
  parseUavLookup,
} from './lib/uav-lookup-authority.mjs';
import { projectPublicAuthorities } from './lib/uav-authority-store.mjs';
import { reconcileUavBucketFiles } from './lib/uav-file-inventory.mjs';
import { generateUavMarcXml, validateUavMarcXmlSchema, verifyUavMarcXml } from './lib/uav-marc.mjs';
import { uavCollectionToCatalogEntry } from './lib/uav-catalog.mjs';
import {
  buildUavProtectedLookup,
  createUavCollection,
  readUavAuthorities,
  readUavCollection,
  renderUavCollectionHtml,
} from './lib/uav-store.mjs';
import { validateUavCollection } from './lib/uav-schema.mjs';

const root = process.cwd();
const collectionLookup = formatUavCollectionLookup({
  subjectCode: 'Win',
  siteCutter: 'Mo',
  year: 2026,
  tour: 'T1',
});
assert.equal(collectionLookup, 'DR.Win. Mo 2026 T1');
const seriesLookup = formatUavSeriesLookup({
  subjectCode: 'Win',
  siteCutter: 'Mo',
  captureClass: 'V',
  year: 2026,
  tour: 'T1',
  spectrum: 'FS',
});
assert.equal(seriesLookup, 'DR.Win. Mo V2026 T1 [FS]');
assert.equal(formatUavItemLookup(seriesLookup, 'V', 1), 'DR.Win. Mo V2026 T1 [FS] V.1');
assert.equal(formatUavItemLookup(seriesLookup, 'X', 7), 'DR.Win. Mo V2026 T1 [FS] X.7');
assert.equal(assertUavLookup(collectionLookup, 'collection').siteCutter, 'Mo');
assert.equal(assertUavLookup(seriesLookup, 'series').spectrum, 'FS');
assert.equal(assertUavLookup(`${seriesLookup} X.1`, 'item').bucket, 'X');
for (const [captureClass, spectrum] of [['I', 'RGB'], ['D', 'TH'], ['A', '']]) {
  const lookup = formatUavSeriesLookup({
    subjectCode: 'Win',
    siteCutter: 'Mo',
    captureClass,
    year: 2026,
    tour: 'T1',
    spectrum,
  });
  assert.equal(assertUavLookup(lookup, 'series').captureClass, captureClass);
  assert.equal(assertUavLookup(formatUavItemLookup(lookup, captureClass, 1), 'item').bucket, captureClass);
}
assert.equal(parseUavLookup('DR.Win Mo 2026 T1').valid, false);
assert.equal(parseUavLookup('DR.Win. Mo V2026 [FS]').valid, false);
assert.equal(parseUavLookup('DR.Win. Mo A2026 T1 [FS]').valid, false);
assert.equal(parseUavLookup('DR.Win. Mo 2026 T0').valid, false);
assert.throws(() => formatUavCollectionLookup({
  subjectCode: 'Win',
  siteCutter: 'Moj',
  year: 2026,
  tour: 'T1',
}), /site Cutter/);
assert.throws(() => formatUavSeriesLookup({
  subjectCode: 'Win',
  siteCutter: 'Mo',
  captureClass: 'V',
  year: 2026,
  tour: 'T1',
}), /requires one of/);
assert.throws(() => formatUavItemLookup(seriesLookup, 'I', 1), /accepts only V or X/);

const first = reconcileUavBucketFiles({
  seriesLookup,
  bucket: 'V',
  scannedFiles: [
    { id: 'drive-beta-00000001', name: 'clip 10.mov', mimeType: 'video/quicktime', size: 10 },
    { id: 'drive-alpha-0000001', name: 'clip 2.mov', mimeType: 'video/quicktime', size: 20 },
    { id: 'drive-named-0000001', name: `${seriesLookup} V.9 [6K].mov`, mimeType: 'video/quicktime', size: 30 },
  ],
  scannedAt: '2026-06-27T00:00:00.000Z',
});
assert.deepEqual(first.files.map((row) => row.bucketNumber), ['V.1', 'V.2', 'V.9']);
assert.equal(first.files.find((row) => row.driveFileId === 'drive-alpha-0000001').bucketNumber, 'V.1');
const second = reconcileUavBucketFiles({
  seriesLookup,
  bucket: 'V',
  existingFiles: first.files,
  scannedFiles: [
    { id: 'drive-beta-00000001', name: 'renamed.mov', mimeType: 'video/quicktime', size: 11 },
    { id: 'drive-named-0000001', name: `${seriesLookup} V.9 [6K].mov`, mimeType: 'video/quicktime', size: 30 },
    { id: 'drive-new-000000001', name: 'clip 3.mov', mimeType: 'video/quicktime', size: 12 },
  ],
});
assert.equal(second.files.find((row) => row.driveFileId === 'drive-beta-00000001').bucketNumber, 'V.2');
assert.equal(second.files.find((row) => row.driveFileId === 'drive-alpha-0000001').missing, true);
assert.equal(second.files.find((row) => row.driveFileId === 'drive-new-000000001').bucketNumber, 'V.3');

const raw = reconcileUavBucketFiles({
  seriesLookup,
  bucket: 'X',
  scannedFiles: [
    { id: 'drive-pdf-000000001', name: 'recording index.pdf', mimeType: 'application/pdf', size: 100 },
    { id: 'drive-raw-000000001', name: 'DJI_0001.DNG', mimeType: 'image/x-adobe-dng', size: 200 },
  ],
});
assert.equal(raw.files.find((row) => row.originalName.endsWith('.pdf')).role, 'recording_index_pdf');
assert.equal(raw.files.find((row) => row.originalName.endsWith('.DNG')).role, 'raw');
assert.equal(raw.files[0].bucketNumber, 'X.1');

const authorities = await readUavAuthorities(root);
const folder = await readUavCollection('mojave-wind-farm', root);
const privateSites = {
  version: 'uav-private-sites-v1',
  sites: {
    'site-mojave-desert': { lat: 35.012345, lon: -115.476543 },
  },
};
const projected = projectPublicAuthorities(authorities, privateSites);
const projectedSite = projected.sites.find((row) => row.id === 'site-mojave-desert');
assert.deepEqual(projectedSite.publicCoordinates, { lat: 35.01, lon: -115.48, precision: 2 });
assert.ok(!JSON.stringify(projected).includes('35.012345'));
assert.ok(!JSON.stringify(projected).includes('-115.476543'));
const hiddenAuthorities = structuredClone(authorities);
const hiddenSiteSource = hiddenAuthorities.sites.find((row) => row.id === 'site-mojave-desert');
hiddenSiteSource.coordinateVisibility = 'hidden';
const hiddenProjected = projectPublicAuthorities(hiddenAuthorities, privateSites);
const hiddenSite = hiddenProjected.sites.find((row) => row.id === 'site-mojave-desert');
assert.equal(hiddenSite.publicCoordinates, undefined);

const validated = validateUavCollection(folder.collection, folder.manifest, projected);
assert.equal(validated.ok, true, validated.issues.join('; '));
const protectedLookup = buildUavProtectedLookup(folder.collection, folder.manifest);
assert.equal(protectedLookup.lookupNumber, collectionLookup);
assert.equal(protectedLookup.season, 'T1');
assert.equal(protectedLookup.files.length, 5);
assert.ok(protectedLookup.files.every((file) => file.bucket === 'X'));
assert.ok(protectedLookup.files.every((file) => file.fileId.startsWith('asset:')));
const linkedCreditsCollection = structuredClone(folder.collection);
linkedCreditsCollection.creditLinks = {
  [linkedCreditsCollection.operators[0]]: [{
    label: 'Portfolio',
    href: 'https://example.com/operator',
  }],
};
assert.equal(validateUavCollection(linkedCreditsCollection, folder.manifest, projected).ok, true);
assert.ok(renderUavCollectionHtml(linkedCreditsCollection, folder.manifest, projected).includes('https://example.com/operator'));
const parityHtml = renderUavCollectionHtml(folder.collection, folder.manifest, projected);
for (const marker of [
  'class="dx-uav-entry-card dex-entry-section"',
  'class="dx-uav-entry-header dex-entry-header"',
  'class="dex-entry-page-title"',
  'class="dx-uav-layout dex-entry-layout"',
  'class="dx-uav-main-rail dex-entry-main"',
  'class="dx-uav-sidebar dex-sidebar"',
  'class="dex-overview"',
  'COLLECTION LOOKUP NUMBER',
  'class="overview-series-img"',
  'class="dex-collections"',
  'id="dex-entry-collection-contract"',
  'border-color: transparent !important',
  'data-dx-fav-ui-ready="1"',
  'class="dx-bucket-tile available"',
  'data-dx-tooltip-metrics=',
  'dx-fav-entry-toggle',
  'dx-fav-bucket-toggle',
  'class="btn-download dx-button-element--primary"',
  'data-dx-uav-recording-index="1"',
  'data-dex-breadcrumb-delimiter',
  'data-dex-breadcrumb-path stroke-width="2.2"',
  '/assets/js/dex-breadcrumb-motion.js',
  '/assets/dex-sidebar.js',
  '/assets/js/dx-uav-entry.js',
]) {
  assert.ok(parityHtml.includes(marker), `UAV entry parity marker missing: ${marker}`);
}
const controlsCss = await fs.readFile(path.join(root, 'public', 'css', 'components', 'dx-controls.css'), 'utf8');
for (const marker of [
  'overview-item--favorite-collection button.dx-fav-entry-toggle.dx-fav-heart-btn',
  'border: 0 !important',
  'box-shadow: var(--dx-btn-primary-shadow) !important',
  'border-radius: var(--dx-test5-header-radius) !important',
]) {
  assert.ok(controlsCss.includes(marker), `shared entry controls CSS missing ${marker}`);
}
assert.equal((parityHtml.match(/<footer\b/g) || []).length, 1, 'UAV entry must emit one canonical footer');
assert.ok(!parityHtml.includes('data-dx-slot-preserve'), 'UAV route content must be replaceable by soft navigation');
const uavCss = await fs.readFile(path.join(root, 'css', 'components', 'dx-uav-entry.css'), 'utf8');
for (const marker of [
  'aspect-ratio: 16 / 9 !important',
  'font-family: "Courier New", monospace !important',
  'grid-template-columns: 65% 35% !important',
  'stroke-width: 2.2 !important',
  'transform: scale(var(--dx-motion-scale-hover, 1.015))',
]) {
  assert.ok(uavCss.includes(marker), `UAV entry parity CSS marker missing: ${marker}`);
}
const uavRuntime = await fs.readFile(path.join(root, 'public', 'assets', 'js', 'dx-uav-entry.js'), 'utf8');
assert.ok(uavRuntime.includes('shared.ensureInteractiveHoverRuntime?.'), 'UAV entry must load the shared hover runtime');
assert.ok(uavRuntime.includes('shared.ensureEntryRuntimeLayoutOverrides?.'), 'UAV entry must load shared entry shell styles');
assert.ok(uavRuntime.includes('shared.bindEntryTooltips?.'), 'UAV entry must bind shared bucket tooltips');
assert.ok(uavRuntime.includes("dx:route-transition-out:end"), 'UAV entry must clean up route state after soft navigation');
assert.ok(uavRuntime.includes('window.__dxUavEntryLoaded = false'), 'UAV entry must permit clean soft-navigation remounts');
const linkedManifest = structuredClone(folder.manifest);
linkedManifest.groups[0].buckets = [structuredClone(first), structuredClone(raw)];
linkedManifest.groups[0].buckets[0].files[0].sourceXItems = [raw.files[0].lookupRaw];
assert.equal(validateUavCollection(folder.collection, linkedManifest, projected).ok, true);
const missingRawLink = structuredClone(linkedManifest);
missingRawLink.groups[0].buckets[0].files[0].sourceXItems = [`${seriesLookup} X.99`];
assert.match(
  validateUavCollection(folder.collection, missingRawLink, projected).issues.join('; '),
  /source X item does not exist/,
);
const createdAmbient = await createUavCollection({
  slug: 'ambient-dry-run',
  title: 'Ambient dry run',
  primarySubjectId: 'subject-win',
  siteAuthorityId: 'site-mojave-desert',
  year: 2027,
  tour: 'T2',
  captureClass: 'A',
  attribution: 'Test attribution.',
  rootDir: root,
  dryRun: true,
});
assert.equal(createdAmbient.collection.lookupRaw, 'DR.Win. Mo 2027 T2');
assert.equal(createdAmbient.collection.series[0].lookupRaw, 'DR.Win. Mo A2027 T2');
assert.deepEqual(createdAmbient.manifest.groups[0].buckets.map((row) => row.bucket), ['A', 'X']);
const missingDeliverable = structuredClone(folder.manifest);
missingDeliverable.groups[0].buckets = missingDeliverable.groups[0].buckets.filter((row) => row.bucket !== 'V');
assert.match(
  validateUavCollection(folder.collection, missingDeliverable, projected).issues.join('; '),
  /requires a V deliverable bucket/,
);
const duplicateGroup = structuredClone(folder.manifest);
duplicateGroup.groups.push(structuredClone(duplicateGroup.groups[0]));
assert.match(
  validateUavCollection(folder.collection, duplicateGroup, projected).issues.join('; '),
  /Duplicate manifest group/,
);
const marc = generateUavMarcXml(folder.collection, folder.manifest, projected);
assert.equal(verifyUavMarcXml(marc).ok, true);
const vendoredMarcSchema = process.env.UAV_MARC_XSD || path.join(root, 'scripts', 'vendor', 'MARC21slim.xsd');
const schemaValidation = await validateUavMarcXmlSchema(marc, vendoredMarcSchema);
assert.equal(schemaValidation.ok, true, schemaValidation.issues.join('; '));
assert.ok(marc.includes('DR.Win. Mo 2026 T1'));
assert.ok(marc.includes('Wind power plants'));
assert.ok(marc.includes('Mojave Desert'));
assert.ok(!marc.includes('35.012345'));
assert.ok(marc.includes('<controlfield tag="007">'));
assert.ok(marc.includes('<datafield tag="034"'));
assert.ok(marc.includes('<datafield tag="518"'));
assert.ok(marc.includes('<datafield tag="508"'));
const linkedMarc = generateUavMarcXml(folder.collection, linkedManifest, projected);
assert.ok(linkedMarc.includes('<datafield tag="347"'));
const hiddenMarc = generateUavMarcXml(folder.collection, folder.manifest, hiddenProjected);
const hiddenHtml = renderUavCollectionHtml(folder.collection, folder.manifest, hiddenProjected);
const hiddenCatalog = uavCollectionToCatalogEntry(folder.collection, hiddenProjected);
for (const surface of [hiddenMarc, hiddenHtml, JSON.stringify(hiddenCatalog)]) {
  assert.ok(!surface.includes('35.012345'));
  assert.ok(!surface.includes('-115.476543'));
  assert.ok(!surface.includes('35.01'));
  assert.ok(!surface.includes('-115.47'));
}

if (process.env.UAV_MARC_XSD) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'dex-uav-marc-'));
  const marcPath = path.join(temp, 'record.xml');
  await fs.writeFile(marcPath, marc, 'utf8');
  execFileSync('xmllint', ['--noout', '--schema', process.env.UAV_MARC_XSD, marcPath], { stdio: 'pipe' });
}

console.log('uav:test passed (grammar, inventory, authority privacy, schema, MARCXML).');
