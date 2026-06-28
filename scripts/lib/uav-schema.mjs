import { z } from 'zod';
import {
  assertUavLookup,
  formatUavCollectionLookup,
  formatUavItemLookup,
  formatUavSeriesLookup,
  normalizeUavLookup,
  UAV_CAPTURE_CLASSES,
  UAV_SPECTRA,
} from './uav-lookup-authority.mjs';

export const UAV_COLLECTION_VERSION = 'uav-collection-v1';
export const UAV_MANIFEST_VERSION = 'uav-manifest-v1';
export const UAV_AUTHORITIES_VERSION = 'uav-authorities-v1';

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const authorityRefSchema = z.object({
  source: z.enum(['lcnaf', 'lcsh', 'geonames', 'local']),
  uri: z.string().url(),
  label: z.string().trim().min(1),
});
const coordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  precision: z.number().int().min(0).max(6).default(2),
});
const creditLinksSchema = z.record(z.array(z.object({
  label: z.string().trim().min(1),
  href: z.string().url(),
}))).default({});

export const uavAuthoritiesSchema = z.object({
  version: z.literal(UAV_AUTHORITIES_VERSION),
  updatedAt: z.string().min(1),
  subjects: z.array(z.object({
    id: slugSchema,
    code: z.string().regex(/^[A-Z][a-z]{2}$/),
    label: z.string().trim().min(1),
    authority: authorityRefSchema,
    additionalAuthorities: z.array(authorityRefSchema).default([]),
  })),
  sites: z.array(z.object({
    id: slugSchema,
    name: z.string().trim().min(1),
    cutter: z.string().regex(/^[A-Z][a-z]$/),
    admin: z.string().trim().default(''),
    authority: authorityRefSchema,
    coordinateVisibility: z.enum(['exact', 'rounded', 'hidden']).default('rounded'),
    publicCoordinates: coordinateSchema.optional(),
  })),
}).superRefine((value, context) => {
  value.subjects.forEach((subject, index) => {
    if (subject.authority.source !== 'lcsh') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subjects', index, 'authority', 'source'],
        message: 'UAV subject authorities must be LCSH-backed',
      });
    }
  });
});

const technicalSchema = z.object({
  platform: z.string().trim().optional(),
  aircraft: z.string().trim().optional(),
  camera: z.string().trim().optional(),
  sensor: z.string().trim().optional(),
  lens: z.string().trim().optional(),
  filter: z.string().trim().optional(),
  altitude: z.string().trim().optional(),
  attitude: z.enum(['low-oblique', 'high-oblique', 'vertical', 'mixed', 'unknown']).optional(),
  cloudCover: z.number().min(0).max(100).optional(),
  notes: z.string().trim().optional(),
}).default({});

const uavSeriesSchema = z.object({
  id: slugSchema,
  title: z.string().trim().min(1),
  captureClass: z.enum(Object.keys(UAV_CAPTURE_CLASSES)),
  spectrum: z.enum(Object.keys(UAV_SPECTRA)).optional(),
  lookupRaw: z.string().trim().min(1),
  lookupNorm: z.string().trim().min(1),
  capturedFrom: isoDateSchema.optional(),
  capturedTo: isoDateSchema.optional(),
  technical: technicalSchema,
  folders: z.object({
    deliverable: z.string().trim().optional(),
    raw: z.string().trim().optional(),
  }).default({}),
});

export const uavCollectionSchema = z.object({
  version: z.literal(UAV_COLLECTION_VERSION),
  kind: z.literal('uav'),
  slug: slugSchema,
  title: z.string().trim().min(1),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  lookupRaw: z.string().trim().min(1),
  lookupNorm: z.string().trim().min(1),
  identity: z.object({
    wing: z.literal('DR'),
    primarySubjectCode: z.string().regex(/^[A-Z][a-z]{2}$/),
    siteCutter: z.string().regex(/^[A-Z][a-z]$/),
    year: z.number().int().min(2000).max(2100),
    tour: z.string().regex(/^T[1-9]\d*$/),
  }),
  subjectAuthorityIds: z.array(slugSchema).min(1),
  siteAuthorityId: slugSchema,
  capturedFrom: isoDateSchema.optional(),
  capturedTo: isoDateSchema.optional(),
  license: z.string().trim().min(1).default('CC-BY-4.0'),
  attribution: z.string().trim().min(1),
  operators: z.array(z.string().trim().min(1)).default([]),
  contributors: z.array(z.string().trim().min(1)).default([]),
  creditLinks: creditLinksSchema,
  imageSrc: z.string().trim().default(''),
  previewUrl: z.string().trim().default(''),
  description: z.string().default(''),
  series: z.array(uavSeriesSchema).default([]),
  lifecycle: z.object({
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
    publishedAt: z.string().min(1).optional(),
  }),
});

const uavFileSchema = z.object({
  driveFileId: z.string().trim().min(1),
  bucketNumber: z.string().regex(/^[VIADX]\.[1-9]\d{0,5}$/),
  lookupRaw: z.string().trim().min(1),
  originalName: z.string().trim().min(1),
  relativePath: z.string().trim().default(''),
  mime: z.string().trim().default('application/octet-stream'),
  sizeBytes: z.number().int().nonnegative().default(0),
  modifiedAt: z.string().trim().optional(),
  capturedAt: z.string().trim().optional(),
  missing: z.boolean().default(false),
  role: z.enum(['media', 'raw', 'recording_index_pdf', 'support']).default('media'),
  outputSpectrum: z.enum(Object.keys(UAV_SPECTRA)).optional(),
  qualifiers: z.array(z.string().trim().min(1)).default([]),
  sourceXItems: z.array(z.string().trim().min(1)).default([]),
  technical: z.object({
    durationSeconds: z.number().nonnegative().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    frameRate: z.number().positive().optional(),
    codec: z.string().trim().optional(),
    bitDepth: z.number().int().positive().optional(),
    checksum: z.string().trim().optional(),
  }).default({}),
});

const uavBucketSchema = z.object({
  bucket: z.enum(['V', 'I', 'A', 'D', 'X']),
  folderId: z.string().trim().default(''),
  scannedAt: z.string().trim().optional(),
  files: z.array(uavFileSchema).default([]),
});

export const uavManifestSchema = z.object({
  version: z.literal(UAV_MANIFEST_VERSION),
  slug: slugSchema,
  collectionLookup: z.string().trim().min(1),
  groups: z.array(z.object({
    seriesId: slugSchema,
    seriesLookup: z.string().trim().min(1),
    captureClass: z.enum(Object.keys(UAV_CAPTURE_CLASSES)),
    buckets: z.array(uavBucketSchema).default([]),
  })).default([]),
});

function indexAuthorities(authorities) {
  return {
    subjects: new Map(authorities.subjects.map((row) => [row.id, row])),
    sites: new Map(authorities.sites.map((row) => [row.id, row])),
  };
}

export function validateUavCollection(collectionInput, manifestInput, authoritiesInput) {
  const collection = uavCollectionSchema.parse(collectionInput);
  const manifest = uavManifestSchema.parse(manifestInput);
  const authorities = uavAuthoritiesSchema.parse(authoritiesInput);
  const issues = [];
  const authorityIndex = indexAuthorities(authorities);
  const subjectCodeSeen = new Map();
  const siteCutterSeen = new Map();
  for (const row of authorities.subjects) {
    const prior = subjectCodeSeen.get(row.code);
    if (prior && prior !== row.id) issues.push(`Subject code ${row.code} is assigned to both ${prior} and ${row.id}`);
    subjectCodeSeen.set(row.code, row.id);
  }
  for (const row of authorities.sites) {
    const prior = siteCutterSeen.get(row.cutter);
    if (prior && prior !== row.id) issues.push(`Site Cutter ${row.cutter} is assigned to both ${prior} and ${row.id}`);
    siteCutterSeen.set(row.cutter, row.id);
  }
  const subject = [...authorityIndex.subjects.values()].find((row) => row.code === collection.identity.primarySubjectCode);
  const site = authorityIndex.sites.get(collection.siteAuthorityId);

  if (!subject) issues.push(`Primary subject code ${collection.identity.primarySubjectCode} is not registered`);
  if (!collection.subjectAuthorityIds.includes(subject?.id || '')) issues.push('Primary subject authority is not selected');
  for (const id of collection.subjectAuthorityIds) {
    if (!authorityIndex.subjects.has(id)) issues.push(`Unknown subject authority: ${id}`);
  }
  if (!site) issues.push(`Unknown site authority: ${collection.siteAuthorityId}`);
  if (site && site.cutter !== collection.identity.siteCutter) {
    issues.push(`Site Cutter ${collection.identity.siteCutter} does not match authority ${site.cutter}`);
  }
  if (site?.coordinateVisibility === 'hidden' && site.publicCoordinates) {
    issues.push(`Hidden site ${site.id} must not contain publicCoordinates`);
  }

  const expectedCollectionLookup = formatUavCollectionLookup({
    subjectCode: collection.identity.primarySubjectCode,
    siteCutter: collection.identity.siteCutter,
    year: collection.identity.year,
    tour: collection.identity.tour,
  });
  if (collection.lookupRaw !== expectedCollectionLookup) {
    issues.push(`Collection lookup must be ${expectedCollectionLookup}`);
  }
  if (collection.lookupNorm !== normalizeUavLookup(collection.lookupRaw)) issues.push('Collection lookupNorm is stale');
  try {
    assertUavLookup(collection.lookupRaw, 'collection');
  } catch (error) {
    issues.push(String(error?.message || error));
  }
  if (manifest.slug !== collection.slug) issues.push('Manifest slug does not match collection');
  if (manifest.collectionLookup !== collection.lookupRaw) issues.push('Manifest collectionLookup does not match collection');

  const seriesById = new Map();
  const seenLookups = new Set([collection.lookupNorm]);
  for (const series of collection.series) {
    if (seriesById.has(series.id)) issues.push(`Duplicate series id: ${series.id}`);
    seriesById.set(series.id, series);
    const expected = formatUavSeriesLookup({
      subjectCode: collection.identity.primarySubjectCode,
      siteCutter: collection.identity.siteCutter,
      captureClass: series.captureClass,
      year: collection.identity.year,
      tour: collection.identity.tour,
      spectrum: series.spectrum,
    });
    if (series.lookupRaw !== expected) issues.push(`Series ${series.id} lookup must be ${expected}`);
    if (series.lookupNorm !== normalizeUavLookup(series.lookupRaw)) issues.push(`Series ${series.id} lookupNorm is stale`);
    if (seenLookups.has(series.lookupNorm)) issues.push(`Duplicate UAV lookup: ${series.lookupRaw}`);
    seenLookups.add(series.lookupNorm);
    if (series.capturedFrom && series.capturedTo && series.capturedFrom > series.capturedTo) {
      issues.push(`Series ${series.id} capture range ends before it starts`);
    }
  }
  if (collection.capturedFrom && collection.capturedTo && collection.capturedFrom > collection.capturedTo) {
    issues.push('Collection capture range ends before it starts');
  }

  const groupSeen = new Set();
  const driveFileSeen = new Map();
  const itemLookupSeen = new Map();
  const sourceLinks = [];
  const xLookups = new Set();
  for (const group of manifest.groups) {
    if (groupSeen.has(group.seriesId)) issues.push(`Duplicate manifest group for ${group.seriesId}`);
    groupSeen.add(group.seriesId);
    const series = seriesById.get(group.seriesId);
    if (!series) {
      issues.push(`Manifest references unknown series ${group.seriesId}`);
      continue;
    }
    if (group.captureClass !== series.captureClass) issues.push(`Manifest class mismatch for ${group.seriesId}`);
    if (group.seriesLookup !== series.lookupRaw) issues.push(`Manifest lookup mismatch for ${group.seriesId}`);
    const bucketSeen = new Set();
    for (const bucket of group.buckets) {
      if (bucketSeen.has(bucket.bucket)) issues.push(`Duplicate ${bucket.bucket} bucket in ${group.seriesId}`);
      bucketSeen.add(bucket.bucket);
      if (bucket.bucket !== series.captureClass && bucket.bucket !== 'X') {
        issues.push(`${series.captureClass} series ${series.id} cannot contain ${bucket.bucket} bucket`);
      }
      const numberSeen = new Map();
      for (const file of bucket.files) {
        const bucketPrefix = file.bucketNumber.split('.')[0];
        if (bucketPrefix !== bucket.bucket) issues.push(`${file.bucketNumber} does not match bucket ${bucket.bucket}`);
        const expectedItem = formatUavItemLookup(series.lookupRaw, bucket.bucket, file.bucketNumber.split('.')[1]);
        if (file.lookupRaw !== expectedItem) issues.push(`${file.originalName}: item lookup must be ${expectedItem}`);
        const prior = numberSeen.get(file.bucketNumber);
        if (prior && prior !== file.driveFileId) {
          issues.push(`Duplicate ${file.bucketNumber} in ${group.seriesId}`);
        }
        numberSeen.set(file.bucketNumber, file.driveFileId);
        const priorDriveFile = driveFileSeen.get(file.driveFileId);
        if (priorDriveFile && priorDriveFile !== file.lookupRaw) {
          issues.push(`Drive file ${file.driveFileId} is assigned to both ${priorDriveFile} and ${file.lookupRaw}`);
        }
        driveFileSeen.set(file.driveFileId, file.lookupRaw);
        const normalizedItemLookup = normalizeUavLookup(file.lookupRaw);
        const priorLookup = itemLookupSeen.get(normalizedItemLookup);
        if (priorLookup && priorLookup !== file.driveFileId) {
          issues.push(`Duplicate UAV item lookup: ${file.lookupRaw}`);
        }
        itemLookupSeen.set(normalizedItemLookup, file.driveFileId);
        if (bucket.bucket === 'X') xLookups.add(normalizedItemLookup);
        if (bucket.bucket === 'X' && file.sourceXItems.length) {
          issues.push(`${file.bucketNumber}: only deliverables may reference source X items`);
        }
        for (const sourceLookup of file.sourceXItems) {
          sourceLinks.push({ itemLookup: file.lookupRaw, sourceLookup });
        }
        if (bucket.bucket !== 'X' && file.role !== 'media') {
          issues.push(`${file.bucketNumber}: deliverable buckets require media role`);
        }
        if (file.role === 'recording_index_pdf' && bucket.bucket !== 'X') {
          issues.push(`${file.bucketNumber}: recording-index PDF must live in X`);
        }
      }
    }
    if (!bucketSeen.has(series.captureClass)) {
      issues.push(`${series.captureClass} series ${series.id} requires a ${series.captureClass} deliverable bucket`);
    }
  }
  for (const series of collection.series) {
    if (!groupSeen.has(series.id)) issues.push(`Series ${series.id} requires a manifest file group`);
  }
  for (const { itemLookup, sourceLookup } of sourceLinks) {
    const parsedSource = normalizeUavLookup(sourceLookup);
    if (!xLookups.has(parsedSource)) {
      issues.push(`${itemLookup}: source X item does not exist: ${sourceLookup}`);
    }
  }

  return { ok: issues.length === 0, issues, collection, manifest, authorities };
}
