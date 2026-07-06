import fs from 'node:fs/promises';
import path from 'node:path';
import {
  projectPublicAuthorities,
  readUavPrivateSites,
} from './uav-authority-store.mjs';
import { uavCollectionToCatalogEntry, mergeUavCollectionsIntoCatalogModel } from './uav-catalog.mjs';
import {
  formatUavCollectionLookup,
  formatUavSeriesLookup,
  normalizeUavLookup,
  UAV_CAPTURE_CLASSES,
  UAV_SPECTRA,
} from './uav-lookup-authority.mjs';
import { generateUavMarcXml, validateUavMarcXmlSchema, verifyUavMarcXml } from './uav-marc.mjs';
import {
  UAV_AUTHORITIES_VERSION,
  UAV_COLLECTION_VERSION,
  UAV_MANIFEST_VERSION,
  uavAuthoritiesSchema,
  uavCollectionSchema,
  uavManifestSchema,
  validateUavCollection,
} from './uav-schema.mjs';
import {
  DEX_FOOTER_MARKUP,
  getDexCollectionContractCss,
} from './sanitize-generated-html.mjs';
import { normalizeProtectedAssetsFile } from './protected-assets-schema.mjs';

function text(value) {
  return String(value ?? '').trim();
}

function countProtectedChars(value) {
  if (typeof value === 'string') return (value.match(/[\u00A0\u200B\u200C\u200D]/g) || []).length;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countProtectedChars(item), 0);
  if (value && typeof value === 'object') return Object.values(value).reduce((sum, item) => sum + countProtectedChars(item), 0);
  return 0;
}

function rootPath(rootDir) {
  return path.resolve(rootDir || process.cwd());
}

function uavRoot(rootDir) {
  return path.join(rootPath(rootDir), 'uav');
}

function marcSchemaPath(rootDir) {
  return path.resolve(process.env.UAV_MARC_XSD || path.join(rootPath(rootDir), 'scripts', 'vendor', 'MARC21slim.xsd'));
}

export function uavAuthoritiesPath(rootDir) {
  return path.join(rootPath(rootDir), 'data', 'uav.authorities.json');
}

function safeJsonForHtml(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function html(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function youtubeEmbedUrl(value) {
  const raw = text(value);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    let id = '';
    if (url.hostname === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
    if (url.hostname.endsWith('youtube.com')) {
      id = url.searchParams.get('v') || url.pathname.match(/\/(?:embed|shorts)\/([^/?#]+)/)?.[1] || '';
    }
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0` : '';
  } catch {
    return '';
  }
}

function uniqueAuthorityRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = text(row?.authority?.uri || row?.id || row?.label).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function atomicWrite(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temp, content, 'utf8');
  await fs.rename(temp, filePath);
}

async function writeJson(filePath, value) {
  await atomicWrite(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function buildUavProtectedLookup(collectionInput, manifestInput) {
  const collection = collectionInput && typeof collectionInput === 'object' ? collectionInput : {};
  const manifest = manifestInput && typeof manifestInput === 'object' ? manifestInput : {};
  const files = [];
  let position = 0;
  for (const group of manifest.groups || []) {
    const mediaType = String(group?.captureClass || '').toUpperCase() === 'A' ? 'audio' : 'video';
    for (const bucket of group?.buckets || []) {
      for (const file of bucket?.files || []) {
        const driveFileId = text(file?.driveFileId);
        if (!driveFileId || file?.missing || file?.role === 'recording_index_pdf') continue;
        position += 1;
        const bucketCode = text(bucket?.bucket).toUpperCase();
        const originalName = text(file?.originalName || file?.relativePath || file?.lookupRaw || driveFileId);
        files.push({
          bucketNumber: text(file?.bucketNumber),
          fileId: `asset:${driveFileId}`,
          bucket: bucketCode,
          r2Key: `uav/${text(collection.slug)}/${bucketCode.toLowerCase()}/${driveFileId}-${originalName}`,
          driveFileId,
          sizeBytes: Number(file?.sizeBytes || 0),
          mime: text(file?.mime) || (mediaType === 'audio' ? 'audio/octet-stream' : 'video/octet-stream'),
          position,
          label: text(file?.lookupRaw || originalName),
          sourceLabel: originalName,
          type: mediaType,
          availableTypes: [mediaType],
          role: 'media',
        });
      }
    }
  }
  if (!files.length) return null;
  return {
    lookupNumber: text(collection.lookupRaw),
    title: text(collection.title),
    status: text(collection.status || 'draft'),
    season: text(collection?.identity?.tour).toUpperCase(),
    files,
    entitlements: [{ type: 'role', value: 'authenticated' }],
  };
}

async function syncUavProtectedAssets(root, uavLookups) {
  const sourcePath = path.join(root, 'data', 'protected.assets.json');
  const current = await readJson(sourcePath, {
    version: 'protected-assets-v1',
    updatedAt: new Date().toISOString(),
    settings: {},
    lookups: [],
    exemptions: [],
  });
  const standardLookups = (current.lookups || []).filter((lookup) => !/^DR\./i.test(text(lookup?.lookupNumber)));
  const nextLookups = [...standardLookups, ...(uavLookups || [])];
  const requiredBuckets = nextLookups.flatMap((lookup) => (lookup.files || []).map((file) => text(file?.bucket).toUpperCase()));
  const allowedBuckets = Array.from(new Set([
    ...(current?.settings?.allowedBuckets || []),
    ...requiredBuckets,
  ].filter(Boolean)));
  const normalized = normalizeProtectedAssetsFile({
    ...current,
    updatedAt: new Date().toISOString(),
    settings: {
      ...(current.settings || {}),
      allowedBuckets,
    },
    lookups: nextLookups,
  });
  for (const servedRoot of ['data', 'docs/data', 'data']) {
    await writeJson(path.join(root, servedRoot, 'protected.assets.json'), normalized);
  }
  return normalized;
}

export async function readUavAuthorities(rootDir) {
  const fallback = {
    version: UAV_AUTHORITIES_VERSION,
    updatedAt: new Date(0).toISOString(),
    subjects: [],
    sites: [],
  };
  return uavAuthoritiesSchema.parse(await readJson(uavAuthoritiesPath(rootDir), fallback));
}

export async function writeUavAuthorities(authorities, rootDir) {
  const validated = uavAuthoritiesSchema.parse(authorities);
  const next = {
    ...validated,
    updatedAt: new Date().toISOString(),
  };
  await writeJson(uavAuthoritiesPath(rootDir), next);
  return { filePath: uavAuthoritiesPath(rootDir), authorities: next };
}

export async function listUavSlugs(rootDir) {
  try {
    const rows = await fs.readdir(uavRoot(rootDir), { withFileTypes: true });
    return rows.filter((row) => row.isDirectory()).map((row) => row.name).sort();
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

export async function readUavCollection(slug, rootDir) {
  const id = text(slug);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`Invalid UAV slug: ${slug}`);
  const folder = path.join(uavRoot(rootDir), id);
  const collectionPath = path.join(folder, 'collection.json');
  const manifestPath = path.join(folder, 'manifest.json');
  const descriptionPath = path.join(folder, 'description.txt');
  const [collectionRaw, manifestRaw, descriptionRaw] = await Promise.all([
    readJson(collectionPath),
    readJson(manifestPath, {
      version: UAV_MANIFEST_VERSION,
      slug: id,
      collectionLookup: '',
      groups: [],
    }),
    fs.readFile(descriptionPath, 'utf8').catch(() => ''),
  ]);
  if (!collectionRaw) throw new Error(`UAV collection not found: ${id}`);
  const collection = uavCollectionSchema.parse({
    ...collectionRaw,
    description: text(descriptionRaw) || collectionRaw.description || '',
  });
  const manifest = uavManifestSchema.parse(manifestRaw);
  return {
    slug: id,
    folder,
    paths: { collectionPath, manifestPath, descriptionPath, indexPath: path.join(folder, 'index.html'), marcPath: path.join(folder, 'marc.xml') },
    collection,
    manifest,
    descriptionText: collection.description,
  };
}

export function renderUavCollectionHtml(collection, manifest, authorities) {
  const site = authorities.sites.find((row) => row.id === collection.siteAuthorityId);
  const subjects = uniqueAuthorityRows(collection.subjectAuthorityIds
    .map((id) => authorities.subjects.find((row) => row.id === id))
    .filter(Boolean));
  const previewEmbed = youtubeEmbedUrl(collection.previewUrl);
  const publicFiles = manifest.groups.flatMap((group) =>
    group.buckets.flatMap((bucket) => bucket.files.filter((file) => !file.missing)));
  const activeBuckets = Array.from(new Set(collection.series.flatMap((series) => {
    const group = manifest.groups.find((row) => row.seriesId === series.id);
    return (group?.buckets || []).map((bucket) => bucket.bucket);
  })));
  const groupMarkup = collection.series.map((series) => {
    const group = manifest.groups.find((row) => row.seriesId === series.id);
    const buckets = (group?.buckets || []).map((bucket) => {
      const files = (bucket.files || []).filter((file) => !file.missing);
      const fileMarkup = files.map((file) => `
              <li>
                <code>${html(file.bucketNumber)}</code>
                <span>${html(file.originalName)}</span>
                <small>${html(file.mime)} · ${Number(file.sizeBytes || 0).toLocaleString()} bytes</small>
              </li>`).join('');
      return `
          <section class="dx-uav-bucket-detail">
            <div class="dx-uav-bucket-detail-heading">
              <strong>${html(bucket.bucket)}</strong>
              <span>${html(bucket.bucket === 'X' ? 'raw + support' : 'deliverables')}</span>
              <b>${files.length}</b>
            </div>
            ${fileMarkup ? `<ul>${fileMarkup}</ul>` : '<p class="dx-uav-muted">No published files.</p>'}
          </section>`;
    }).join('');
    const technical = Object.entries(series.technical || {})
      .filter(([, value]) => value !== '' && value !== null && value !== undefined)
      .map(([key, value]) => `<span class="badge"><b>${html(key.replace(/([A-Z])/g, ' $1'))}</b> ${html(value)}</span>`)
      .join('');
    return `
      <article class="dx-uav-series-card">
        <header>
          <p>${html(series.captureClass)}${series.spectrum ? ` · ${html(series.spectrum)}` : ''}</p>
          <h3>${html(series.title)}</h3>
          <code>${html(series.lookupRaw)}</code>
        </header>
        ${technical ? `<div class="dex-badges">${technical}</div>` : ''}
        <div class="dx-uav-bucket-details">${buckets || '<p class="dx-uav-muted">File inventory pending.</p>'}</div>
      </article>`;
  }).join('');
  const subjectLinks = subjects.map((subject) =>
    `<a href="${html(subject.authority.uri)}" rel="noreferrer">${html(subject.label)}</a>`).join(', ');
  const coordinateCopy = site?.publicCoordinates
    ? `${site.publicCoordinates.lat}, ${site.publicCoordinates.lon} (${site.coordinateVisibility})`
    : 'Coordinates withheld';
  const linkedCredits = (names) => names.map((name) => {
    const links = (collection.creditLinks?.[name] || []).filter((row) => row?.href);
    if (!links.length) return html(name);
    return `<a href="${html(links[0].href)}" rel="noreferrer">${html(name)}</a>${links.length > 1 ? ` <small>+${links.length - 1}</small>` : ''}`;
  }).join(', ');
  const serialized = safeJsonForHtml({ collection, manifest, authorities: { subjects, sites: site ? [site] : [] } });
  const capturedCopy = html([collection.capturedFrom, collection.capturedTo]
    .filter(Boolean)
    .filter((value, index, rows) => index === 0 || value !== rows[index - 1])
    .join(' – ') || String(collection.identity.year));
  const seriesSummary = collection.series
    .map((series) => `${series.captureClass}${series.spectrum ? `/${series.spectrum}` : ''}`)
    .join(' · ');
  const heartIcon = `
    <span class="dx-fav-heart-icon" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="dx-fav-heart-svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"></path>
      </svg>
    </span>`;
  const bucketTiles = activeBuckets.map((bucket) => {
    const fileCount = manifest.groups.reduce((count, group) => {
      const row = group.buckets.find((candidate) => candidate.bucket === bucket);
      return count + (row?.files || []).filter((file) => !file.missing).length;
    }, 0);
    const seriesRows = collection.series.filter((series) => {
      const group = manifest.groups.find((row) => row.seriesId === series.id);
      return group?.buckets.some((candidate) => candidate.bucket === bucket);
    });
    const fileType = bucket === 'X'
      ? 'Raw, Support'
      : ({ V: 'Aerial video', I: 'Field stills', A: 'Ambient sound', D: 'Imaging study' }[bucket] || 'Files');
    const spectrum = Array.from(new Set(seriesRows.map((series) => series.spectrum).filter(Boolean))).join(', ') || 'n/a';
    const seriesLookups = seriesRows.map((series) => series.lookupRaw).join(' · ') || collection.lookupRaw;
    const descriptor = bucket === 'X' ? 'Raw + support files' : `${fileType} deliverables`;
    const metrics = JSON.stringify([
      ['Capture class', bucket === 'X' ? 'X' : bucket],
      ['Spectrum', spectrum],
      ['File types', fileType],
      ['Total files', String(fileCount)],
    ]);
    const tooltip = `${bucket} BUCKET • Status: available • ${descriptor} • Total files: ${fileCount}`;
    return `<span
      class="dx-bucket-tile available"
      data-dx-bucket-key="${html(bucket)}"
      data-dx-bucket-tooltip="${html(tooltip)}"
      data-dx-tooltip="${html(tooltip)}"
      data-dx-tooltip-status="available"
      data-dx-tooltip-descriptor="${html(descriptor)}"
      data-dx-tooltip-metrics="${html(metrics)}"
      data-dx-tooltip-file-types="${html(fileType)}"
      data-dx-tooltip-video-quality="${html(spectrum)}"
      data-dx-tooltip-audio-mp3="n/a"
      data-dx-tooltip-audio-mp3-available="no"
      data-dx-tooltip-audio-wav="0"
      data-dx-tooltip-video-1080p="0"
      data-dx-tooltip-video-4k="0"
      data-dx-tooltip-video-1080p-available="no"
      data-dx-tooltip-video-4k-available="no"
      data-dx-tooltip-total-files="${fileCount}"
      data-dx-uav-series="${html(seriesLookups)}"
      title="${html(tooltip)}"
      aria-label="${html(tooltip)}"
      tabindex="0"
    ><span class="dx-bucket-label">${html(bucket)}</span></span>`;
  }).join('');
  const favoriteBucketButtons = activeBuckets.map((bucket) => `
    <button
      type="button"
      class="dx-button-element--secondary dx-fav-toggle dx-fav-bucket-toggle dx-fav-heart-btn"
      data-dx-fav-ui-ready="1"
      data-bucket="${html(bucket)}"
      data-dx-fav-chip="${html(bucket)}"
      data-dx-fav-chip-case="upper"
      aria-label="Favorite ${html(bucket)}"
      title="Favorite ${html(bucket)}"
    >${heartIcon}<span class="dx-fav-heart-chip">${html(bucket)}</span><span class="dx-fav-sr">Favorite ${html(bucket)}</span></button>`).join('');
  const collectionContractCss = getDexCollectionContractCss();

  return `<!doctype html>
<html lang="en-US">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#e8ebf1">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>${html(collection.title)} — dexDRONES</title>
  <meta name="description" content="${html(collection.description.slice(0, 240))}">
  <link rel="canonical" href="https://dexdsl.org/uav/${html(collection.slug)}/">
  <link rel="stylesheet" href="/css/tokens.css">
  <link rel="stylesheet" href="/css/base.css">
  <link rel="stylesheet" href="/css/bridge.squarespace.css">
  <link rel="stylesheet" href="/css/components/dx-layout.css">
  <link rel="stylesheet" href="/css/components/dx-surface.css">
  <link rel="stylesheet" href="/css/components/dx-controls.css">
  <link rel="stylesheet" href="/css/components/dx-nav.css">
  <link rel="stylesheet" href="/css/fonts.css">
  <link rel="stylesheet" href="/assets/css/dex.css">
  <link rel="stylesheet" href="/css/components/dx-entry-runtime.css">
  <link rel="stylesheet" href="/css/components/dx-uav-entry.css">
  <style id="dex-entry-collection-contract" data-managed="1">${collectionContractCss}</style>
  <script type="application/ld+json">${safeJsonForHtml({
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: collection.title,
    identifier: collection.lookupRaw,
    license: 'https://creativecommons.org/licenses/by/4.0/',
    url: `https://dexdsl.org/uav/${collection.slug}/`,
    spatialCoverage: site?.name || '',
    temporalCoverage: String(collection.identity.year),
  })}</script>
</head>
<body class="dx-entry-page dx-uav-page">
  <main id="page" class="dx-uav-shell">
    <article class="dx-uav-entry-card dex-entry-section">
      <header class="dx-uav-entry-header dex-entry-header">
        <div class="dex-breadcrumb-overlay" data-dex-breadcrumb-overlay>
          <div class="dex-breadcrumb" data-dex-breadcrumb>
            <a class="dex-breadcrumb-back" href="/catalog/" data-dex-breadcrumb-back>catalog</a>
            <span class="dex-breadcrumb-delimiter" data-dex-breadcrumb-delimiter aria-hidden="true">
              <svg class="dex-breadcrumb-icon" viewBox="0 0 24 24" width="24" height="24" focusable="false" aria-hidden="true">
                <path data-dex-breadcrumb-path stroke-width="2.2" d="M12 1.75L19.85 12L12 22.25L4.15 12Z"></path>
              </svg>
            </span>
            <span class="dex-breadcrumb-current">dexDRONES, ${html(site?.name || collection.title)}</span>
          </div>
        </div>
        <h1 class="dex-entry-page-title" data-dex-entry-page-title data-dx-heading-randomize="false">${html(collection.title)}</h1>
        <div class="dex-entry-subtitle" data-dex-entry-subtitle>
          <span class="dex-entry-subtitle-item"><span class="dex-entry-subtitle-label">collection</span><span class="dex-entry-subtitle-value">${html(collection.lookupRaw)}</span></span>
          <span class="dex-entry-subtitle-item"><span class="dex-entry-subtitle-label">capture</span><span class="dex-entry-subtitle-value">${capturedCopy}</span></span>
          <span class="dex-entry-subtitle-item"><span class="dex-entry-subtitle-label">series</span><span class="dex-entry-subtitle-value">${html(seriesSummary || 'pending')}</span></span>
          <span class="dex-entry-subtitle-item"><span class="dex-entry-subtitle-label">files</span><span class="dex-entry-subtitle-value">${publicFiles.length}</span></span>
        </div>
      </header>

      <div class="dx-uav-layout dex-entry-layout">
        <section class="dx-uav-main-rail dex-entry-main" aria-label="Collection overview">
          <div class="dx-uav-media-card dex-video-shell">
            <div class="dex-video">
              <div class="dex-video-aspect">
            ${previewEmbed
              ? `<iframe src="${html(previewEmbed)}" title="${html(collection.title)} preview" loading="eager" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`
              : collection.imageSrc
              ? `<img src="${html(collection.imageSrc)}" alt="${html(collection.title)} preview">`
              : '<div class="dx-uav-media-placeholder">Preview pending</div>'}
              </div>
            </div>
          </div>
          <div class="dx-uav-description dex-entry-desc-scroll" data-dex-scroll-dot="y">
            <div class="dex-entry-desc-content">
              <p><span class="dex-entry-desc-heading" aria-label="description"><span class="dex-entry-desc-heading-label dex-entry-desc-heading-label--base">description</span><span class="dex-entry-desc-heading-label dex-entry-desc-heading-label--hover" aria-hidden="true">dexcription</span></span><span class="dex-entry-desc-heading-gap" aria-hidden="true">&nbsp;</span>${html(collection.description)}</p>
            </div>
          </div>
        </section>

        <aside class="dx-uav-sidebar dex-sidebar" aria-label="dexDRONES collection details">
          <span class="dx-uav-scroll-affordance" aria-hidden="true">↓</span>
          <section class="dex-overview">
            <div class="overview-item overview-item--lookup">
              <span class="overview-lookup">${html(collection.lookupRaw)}</span>
              <p class="p3 overview-label overview-label--lookup">COLLECTION LOOKUP NUMBER</p>
            </div>
            <div class="overview-item overview-item--series">
              <img src="/assets/img/dexdrones.png" alt="dexDRONES" class="overview-series-img">
              <p class="p3 overview-label overview-label--series">Series</p>
            </div>
          </section>

          <section class="dex-collections">
            <h3 data-dx-entry-heading="1">COL‌LECTION</h3>
            <div class="overview-item overview-item--buckets">
              <p class="p3 overview-label">Available Buckets</p>
              <div class="overview-buckets-grid">${bucketTiles || '<span class="dx-uav-muted">Inventory pending</span>'}</div>
            </div>
            <div class="overview-item overview-item--favorite-collection">
              <p class="p3 overview-label">Favorite This Collection</p>
              <button
                type="button"
                class="dx-button-element--primary dx-fav-toggle dx-fav-entry-toggle dx-fav-heart-btn"
                data-dx-fav-ui-ready="1"
                data-dx-fav-chip="${html(collection.lookupRaw)}"
                aria-label="Favorite collection"
                title="Favorite collection"
              >${heartIcon}<span class="dx-fav-heart-chip">${html(collection.lookupRaw)}</span><span class="dx-fav-sr">Favorite collection</span></button>
            </div>
            <div class="overview-item overview-item--favorite-buckets">
              <p class="p3 overview-label">Favorite Buckets</p>
              <div class="overview-badges">${favoriteBucketButtons || '<span class="badge unavailable">No buckets</span>'}</div>
            </div>
          </section>

          <section class="dx-uav-authority-card">
            <h2>AUTHORITIES</h2>
            <div class="dx-uav-detail-row"><b>Site</b><span>${site ? `<a href="${html(site.authority.uri)}" rel="noreferrer">${html(site.name)}</a>` : 'Unresolved'}</span></div>
            <div class="dx-uav-detail-row"><b>Subjects</b><span>${subjectLinks || 'Unresolved'}</span></div>
            <div class="dx-uav-detail-row"><b>Coordinates</b><span>${html(coordinateCopy)}</span></div>
            <div class="dx-uav-detail-row"><b>Authority source</b><span>${html(site?.authority?.source || 'local')}</span></div>
          </section>

          <section class="dx-uav-series-list">
            <h2>CAPTURE SERIES</h2>
            ${groupMarkup || '<p class="dx-uav-muted">Capture series pending.</p>'}
          </section>

          <section class="dx-uav-credits-card">
            <h2>CREDITS</h2>
            <div class="dx-uav-detail-row"><b>Operators</b><span>${linkedCredits(collection.operators) || '—'}</span></div>
            <div class="dx-uav-detail-row"><b>Contributors</b><span>${linkedCredits(collection.contributors) || '—'}</span></div>
            <div class="dx-uav-credit-group">
              <h3>License</h3>
              <div class="dx-uav-detail-row"><b>Terms</b><span>${html(collection.license)}</span></div>
              <p>${html(collection.attribution)}</p>
            </div>
          </section>

          <section class="dx-uav-metadata-card">
            <h2>METADATA</h2>
            <div class="dex-badges">
              <span class="badge">${html(collection.identity.year)}</span>
              <span class="badge">${html(collection.identity.tour)}</span>
              <span class="badge">${html(site?.admin || 'Site admin pending')}</span>
              ${collection.series.map((series) => `<span class="badge">${html(series.captureClass)}${series.spectrum ? ` · ${html(series.spectrum)}` : ''}</span>`).join('')}
            </div>
          </section>

          <section class="dx-uav-download-card dex-file-info">
            <h2>DOWNLOAD</h2>
            <div id="downloads" role="tabpanel" data-dx-download-mode="unified">
              <button type="button" class="btn-download dx-button-element--primary" aria-label="Get Files"><span>GET FILES</span></button>
              <a class="btn-recording-index dx-button-element--secondary" href="marc.xml"><span>MARCXML</span></a>
              <button type="button" class="btn-recording-index dx-button-element--secondary" data-dx-uav-recording-index="1" aria-label="Recording Index PDF"><span>RECORDING INDEX PDF</span></button>
              <span data-dx-download-status="1" hidden></span>
            </div>
          </section>
        </aside>
      </div>
    </article>
  </main>
  <script id="dex-uav-record" type="application/json">${serialized}</script>
  ${DEX_FOOTER_MARKUP.trim()}
  <script defer src="/assets/dex-runtime-config.js"></script>
  <script defer src="/assets/vendor/auth0-spa-js.umd.min.js"></script>
  <script defer src="/assets/dex-auth0-config.js"></script>
  <script defer src="/assets/dex-auth.js"></script>
  <script defer src="/assets/js/header-slot.js?v=20260705perf3"></script>
  <script defer src="/assets/js/dx-scroll-dot.js"></script>
  <script defer src="/assets/js/interactive-hover.js"></script>
  <script defer src="/assets/js/dx-pagenav.js"></script>
  <script defer src="/assets/js/dx-favorites.js"></script>
  <script defer src="/assets/dex-sidebar.js"></script>
  <script defer src="/assets/js/dex-breadcrumb-motion.js"></script>
  <script defer src="/assets/js/dx-uav-entry.js"></script>
</body>
</html>
`;
}

export async function writeUavCollection({
  collection: collectionInput,
  manifest: manifestInput,
  descriptionText,
  rootDir,
  dryRun = false,
}) {
  const authorities = await readUavAuthorities(rootDir);
  const now = new Date().toISOString();
  const collectionCandidate = {
    ...collectionInput,
    description: typeof descriptionText === 'string' ? descriptionText.trim() : collectionInput.description || '',
    lifecycle: {
      createdAt: collectionInput.lifecycle?.createdAt || now,
      updatedAt: now,
      ...(collectionInput.lifecycle?.publishedAt ? { publishedAt: collectionInput.lifecycle.publishedAt } : {}),
    },
  };
  const checked = validateUavCollection(collectionCandidate, manifestInput, authorities);
  if (!checked.ok) throw new Error(`UAV collection invalid: ${checked.issues.join('; ')}`);
  const marcXml = generateUavMarcXml(checked.collection, checked.manifest, authorities);
  const marcCheck = verifyUavMarcXml(marcXml);
  if (!marcCheck.ok) throw new Error(`UAV MARC invalid: ${marcCheck.issues.join('; ')}`);
  const marcSchemaCheck = await validateUavMarcXmlSchema(marcXml, marcSchemaPath(rootDir));
  if (!marcSchemaCheck.ok) throw new Error(`UAV MARC schema invalid: ${marcSchemaCheck.issues.join('; ')}`);
  const indexHtml = renderUavCollectionHtml(checked.collection, checked.manifest, authorities);
  const folder = path.join(uavRoot(rootDir), checked.collection.slug);
  const paths = {
    collection: path.join(folder, 'collection.json'),
    manifest: path.join(folder, 'manifest.json'),
    description: path.join(folder, 'description.txt'),
    html: path.join(folder, 'index.html'),
    marc: path.join(folder, 'marc.xml'),
  };
  if (dryRun) return { dryRun: true, paths, collection: checked.collection, manifest: checked.manifest, marcXml, indexHtml };
  await Promise.all([
    writeJson(paths.collection, checked.collection),
    writeJson(paths.manifest, checked.manifest),
    atomicWrite(paths.description, `${checked.collection.description.trim()}\n`),
    atomicWrite(paths.html, indexHtml),
    atomicWrite(paths.marc, marcXml),
  ]);
  return { dryRun: false, paths, collection: checked.collection, manifest: checked.manifest, marcXml, indexHtml };
}

export async function createUavCollection({
  slug,
  title,
  descriptionText = '',
  primarySubjectId,
  siteAuthorityId,
  year,
  tour,
  captureClass,
  spectrum,
  capturedFrom,
  capturedTo,
  license = 'CC-BY-4.0',
  attribution,
  operators = [],
  contributors = [],
  imageSrc = '',
  previewUrl = '',
  rootDir,
  dryRun = false,
}) {
  const root = rootPath(rootDir);
  const id = text(slug).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`Invalid UAV slug: ${slug}`);
  const existing = await listUavSlugs(root);
  if (existing.includes(id)) throw new Error(`UAV collection already exists: ${id}`);
  const authorities = await readUavAuthorities(root);
  const subject = authorities.subjects.find((row) => row.id === primarySubjectId);
  const site = authorities.sites.find((row) => row.id === siteAuthorityId);
  if (!subject) throw new Error(`Unknown UAV subject authority: ${primarySubjectId}`);
  if (!site) throw new Error(`Unknown UAV site authority: ${siteAuthorityId}`);
  const klass = text(captureClass).toUpperCase();
  const spectralCode = text(spectrum).toUpperCase();
  if (!(klass in UAV_CAPTURE_CLASSES)) throw new Error(`Invalid UAV capture class: ${captureClass}`);
  if (klass === 'A' && spectralCode) throw new Error('Ambient-sound UAV series must omit spectrum');
  if (klass !== 'A' && !(spectralCode in UAV_SPECTRA)) {
    throw new Error(`${klass} UAV series requires one acquisition spectrum`);
  }
  const lookupRaw = formatUavCollectionLookup({
    subjectCode: subject.code,
    siteCutter: site.cutter,
    year,
    tour,
  });
  const seriesLookup = formatUavSeriesLookup({
    subjectCode: subject.code,
    siteCutter: site.cutter,
    captureClass: klass,
    year,
    tour,
    spectrum: spectralCode,
  });
  const seriesId = `${klass.toLowerCase()}-${spectralCode ? spectralCode.toLowerCase() : 'ambient'}-1`;
  const now = new Date().toISOString();
  const collection = {
    version: UAV_COLLECTION_VERSION,
    kind: 'uav',
    slug: id,
    title: text(title) || id,
    status: 'draft',
    lookupRaw,
    lookupNorm: normalizeUavLookup(lookupRaw),
    identity: {
      wing: 'DR',
      primarySubjectCode: subject.code,
      siteCutter: site.cutter,
      year: Number(year),
      tour: text(tour).toUpperCase(),
    },
    subjectAuthorityIds: [subject.id],
    siteAuthorityId: site.id,
    ...(capturedFrom ? { capturedFrom: text(capturedFrom) } : {}),
    ...(capturedTo ? { capturedTo: text(capturedTo) } : {}),
    license: text(license) || 'CC-BY-4.0',
    attribution: text(attribution) || 'Attribution pending.',
    operators: Array.isArray(operators) ? operators.map(text).filter(Boolean) : [],
    contributors: Array.isArray(contributors) ? contributors.map(text).filter(Boolean) : [],
    creditLinks: {},
    imageSrc: text(imageSrc),
    previewUrl: text(previewUrl),
    description: text(descriptionText),
    series: [{
      id: seriesId,
      title: `${UAV_CAPTURE_CLASSES[klass]}${spectralCode ? ` — ${UAV_SPECTRA[spectralCode]}` : ''}`,
      captureClass: klass,
      ...(spectralCode ? { spectrum: spectralCode } : {}),
      lookupRaw: seriesLookup,
      lookupNorm: normalizeUavLookup(seriesLookup),
      ...(capturedFrom ? { capturedFrom: text(capturedFrom) } : {}),
      ...(capturedTo ? { capturedTo: text(capturedTo) } : {}),
      technical: {},
      folders: {},
    }],
    lifecycle: { createdAt: now, updatedAt: now },
  };
  const manifest = {
    version: UAV_MANIFEST_VERSION,
    slug: id,
    collectionLookup: lookupRaw,
    groups: [{
      seriesId,
      seriesLookup,
      captureClass: klass,
      buckets: [
        { bucket: klass, folderId: '', files: [] },
        { bucket: 'X', folderId: '', files: [] },
      ],
    }],
  };
  return writeUavCollection({
    collection,
    manifest,
    descriptionText,
    rootDir: root,
    dryRun,
  });
}

export async function buildUavOutputs({ rootDir, privateFilePath } = {}) {
  const root = rootPath(rootDir);
  const authoritiesSource = await readUavAuthorities(root);
  const privateSites = await readUavPrivateSites(privateFilePath);
  const authorities = projectPublicAuthorities(authoritiesSource, privateSites);
  const slugs = await listUavSlugs(root);
  const collections = [];
  const catalogEntries = [];
  const protectedLookups = [];
  const seenLookups = new Map();
  const failures = [];

  for (const slug of slugs) {
    try {
      const folder = await readUavCollection(slug, root);
      const checked = validateUavCollection(folder.collection, folder.manifest, authorities);
      if (!checked.ok) throw new Error(checked.issues.join('; '));
      const allLookups = [
        checked.collection.lookupRaw,
        ...checked.collection.series.map((row) => row.lookupRaw),
        ...checked.manifest.groups.flatMap((group) => group.buckets.flatMap((bucket) => bucket.files.map((file) => file.lookupRaw))),
      ];
      for (const lookup of allLookups) {
        const key = text(lookup).toLowerCase();
        if (seenLookups.has(key) && seenLookups.get(key) !== slug) {
          throw new Error(`Duplicate UAV lookup ${lookup} (also ${seenLookups.get(key)})`);
        }
        seenLookups.set(key, slug);
      }
      const marcXml = generateUavMarcXml(checked.collection, checked.manifest, authorities);
      const indexHtml = renderUavCollectionHtml(checked.collection, checked.manifest, authorities);
      const marcCheck = verifyUavMarcXml(marcXml);
      if (!marcCheck.ok) throw new Error(marcCheck.issues.join('; '));
      const marcSchemaCheck = await validateUavMarcXmlSchema(marcXml, marcSchemaPath(root));
      if (!marcSchemaCheck.ok) throw new Error(marcSchemaCheck.issues.join('; '));

      for (const servedRoot of ['', 'docs']) {
        const base = servedRoot ? path.join(root, servedRoot, 'uav', slug) : path.join(root, 'uav', slug);
        await Promise.all([
          atomicWrite(path.join(base, 'index.html'), indexHtml),
          atomicWrite(path.join(base, 'marc.xml'), marcXml),
        ]);
      }
      collections.push(checked.collection);
      catalogEntries.push(uavCollectionToCatalogEntry(checked.collection, authorities));
      if (checked.collection.status === 'active') {
        const protectedLookup = buildUavProtectedLookup(checked.collection, checked.manifest);
        if (protectedLookup) protectedLookups.push(protectedLookup);
      }
    } catch (error) {
      failures.push(`${slug}: ${error?.message || error}`);
    }
  }
  if (failures.length) throw new Error(`UAV build failed:\n${failures.join('\n')}`);

  const aggregate = {
    version: 'uav-collections-v1',
    generatedAt: new Date().toISOString(),
    authorities,
    collections,
    entries: catalogEntries,
  };
  for (const servedRoot of ['data', 'docs/data', 'data']) {
    await writeJson(path.join(root, servedRoot, 'uav.collections.json'), aggregate);
  }
  await syncUavProtectedAssets(root, protectedLookups);
  return { aggregate, slugs, collections: collections.length, lookups: seenLookups.size };
}

function buildUavSearchRow(entry) {
  const subjectLabels = (entry.uav?.subjects || []).map((row) => row.label);
  const captureClasses = entry.uav?.capture_classes || [];
  const siteName = entry.uav?.site?.name || '';
  const searchBlob = [
    entry.title_raw,
    entry.lookup_raw,
    siteName,
    entry.uav?.site?.admin,
    ...subjectLabels,
    ...captureClasses,
    ...(entry.uav?.spectra || []),
  ].filter(Boolean).join(' ').toLowerCase();
  return {
    kind: 'uav',
    id: entry.id,
    entry_href: entry.entry_href,
    title_raw: entry.title_raw,
    lookup_raw: entry.lookup_raw,
    title_norm: text(entry.title_raw).toLowerCase(),
    lookup_norm: text(entry.lookup_raw).toLowerCase(),
    site_norm: text(siteName).toLowerCase(),
    subject_norm: subjectLabels.join(' ').toLowerCase(),
    search_blob: searchBlob,
    uav: entry.uav,
  };
}

export async function syncUavCatalogOutputs({ rootDir, aggregate } = {}) {
  const root = rootPath(rootDir);
  const uavData = aggregate || (await readJson(path.join(root, 'data', 'uav.collections.json'), { entries: [] }));
  const sets = [
    ['data/catalog.data.json', 'data/catalog.entries.json', 'data/catalog.search.json'],
    ['docs/data/catalog.data.json', 'docs/data/catalog.entries.json', 'docs/data/catalog.search.json'],
    ['data/catalog.data.json', 'data/catalog.entries.json', 'data/catalog.search.json'],
  ];
  for (const [dataRel, entriesRel, searchRel] of sets) {
    const dataPath = path.join(root, dataRel);
    const entriesPath = path.join(root, entriesRel);
    const searchPath = path.join(root, searchRel);
    const model = await readJson(dataPath, { entries: [], stats: {} });
    const merged = mergeUavCollectionsIntoCatalogModel(model, uavData);
    merged.stats = {
      ...(merged.stats || {}),
      entries_count: merged.entries.length,
      lookup_count: merged.entries.filter((row) => text(row.lookup_raw)).length,
      uav_count: merged.entries.filter((row) => row.kind === 'uav').length,
      protected_char_count: 0,
    };
    merged.stats.protected_char_count = countProtectedChars(merged);
    const entriesPayload = await readJson(entriesPath, { stats: {}, entries: [] });
    entriesPayload.entries = merged.entries;
    entriesPayload.generated_at = new Date().toISOString();
    entriesPayload.stats = { ...(entriesPayload.stats || {}), ...merged.stats };
    entriesPayload.stats.protected_char_count = countProtectedChars(entriesPayload.entries);
    const searchPayload = await readJson(searchPath, { entries: [] });
    const standardSearch = (searchPayload.entries || []).filter((row) => row.kind !== 'uav');
    searchPayload.entries = [...standardSearch, ...(uavData.entries || []).map(buildUavSearchRow)];
    searchPayload.total = searchPayload.entries.length;
    searchPayload.generated_at = new Date().toISOString();
    await Promise.all([writeJson(dataPath, merged), writeJson(entriesPath, entriesPayload), writeJson(searchPath, searchPayload)]);
  }
  // The catalog entries index also has assets/data mirrors.
  const canonicalEntries = await fs.readFile(path.join(root, 'data/catalog.entries.json'), 'utf8');
  for (const rel of ['assets/data/catalog.entries.json', 'docs/assets/data/catalog.entries.json', 'assets/data/catalog.entries.json']) {
    await atomicWrite(path.join(root, rel), canonicalEntries);
  }
  const uavGuidePart = {
    heading_raw: 'dexDRONES / UAV collections',
    body_raw: 'Location collection: DR.Subject. Site YYYY T#. Capture series: DR.Subject. Site (V|I|A|D)YYYY T# [FS|RGB|IR|TH]. Files append the matching deliverable bucket or X raw/support bucket and a running number, for example V.1 or X.1.',
  };
  const uavExamples = [
    'DR.Win. Mo 2026 T1',
    'DR.Win. Mo V2026 T1 [FS]',
    'DR.Win. Mo V2026 T1 [FS] V.1',
    'DR.Win. Mo V2026 T1 [FS] X.1',
  ];
  for (const rel of ['data/catalog.guide.json', 'docs/data/catalog.guide.json', 'data/catalog.guide.json']) {
    const guidePath = path.join(root, rel);
    const guide = await readJson(guidePath, { parts: [], examples: [] });
    guide.parts = (guide.parts || []).filter((part) => part.heading_raw !== uavGuidePart.heading_raw);
    guide.parts.push(uavGuidePart);
    guide.examples = Array.from(new Set([...(guide.examples || []), ...uavExamples]));
    guide.protected_char_count = 0;
    guide.protected_char_count = countProtectedChars(guide);
    await writeJson(guidePath, guide);
  }
  const uavSymbols = [
    { key_raw: 'DR', description_raw: 'dexDRONES wing namespace' },
    { key_raw: 'V', description_raw: 'Aerial video capture series and deliverable bucket' },
    { key_raw: 'I', description_raw: 'Field stills capture series and deliverable bucket' },
    { key_raw: 'A', description_raw: 'Ambient sound capture series and deliverable bucket' },
    { key_raw: 'D', description_raw: 'Imaging study capture series and deliverable bucket' },
    { key_raw: 'X', description_raw: 'Raw and support files, including recording-index PDFs' },
  ];
  const spectrumSymbols = [
    { key_raw: 'FS', description_raw: 'Full-spectrum acquisition' },
    { key_raw: 'RGB', description_raw: 'Visible-light acquisition' },
    { key_raw: 'IR', description_raw: 'Infrared acquisition' },
    { key_raw: 'TH', description_raw: 'Thermal acquisition' },
  ];
  for (const rel of ['data/catalog.symbols.json', 'docs/data/catalog.symbols.json', 'data/catalog.symbols.json']) {
    const symbolsPath = path.join(root, rel);
    const symbols = await readJson(symbolsPath, { collection: [], quality: [] });
    const withoutRows = (rows, additions) => (rows || []).filter((row) =>
      !additions.some((candidate) => candidate.key_raw === row.key_raw && candidate.description_raw === row.description_raw));
    symbols.collection = [...withoutRows(symbols.collection, uavSymbols), ...uavSymbols];
    symbols.quality = [...withoutRows(symbols.quality, spectrumSymbols), ...spectrumSymbols];
    symbols.protected_char_count = 0;
    symbols.protected_char_count = countProtectedChars(symbols);
    await writeJson(symbolsPath, symbols);
  }
  return { entries: uavData.entries?.length || 0 };
}

export async function preflightUavCollection(slug, { rootDir, privateFilePath } = {}) {
  const root = rootPath(rootDir);
  const checks = [];
  const add = (id, ok, detail) => checks.push({ id, ok: Boolean(ok), detail: text(detail) });
  let folder;
  try {
    folder = await readUavCollection(slug, root);
    add('collection_exists', true, `uav/${slug}/collection.json`);
  } catch (error) {
    add('collection_exists', false, error?.message || error);
    return { ok: false, slug, checks, blockers: checks.filter((row) => !row.ok) };
  }
  const sourceAuthorities = await readUavAuthorities(root);
  const privateSites = await readUavPrivateSites(privateFilePath);
  const authorities = projectPublicAuthorities(sourceAuthorities, privateSites);
  const checked = validateUavCollection(folder.collection, folder.manifest, authorities);
  add('schema', checked.ok, checked.ok ? 'Collection, manifest, and identifiers are valid' : checked.issues.join('; '));
  const identifiers = [
    folder.collection.lookupRaw,
    ...folder.collection.series.map((row) => row.lookupRaw),
    ...folder.manifest.groups.flatMap((group) =>
      group.buckets.flatMap((bucket) => bucket.files.map((file) => file.lookupRaw))),
  ];
  const duplicateIdentifiers = [];
  const globalIdentifierOwners = new Map();
  for (const otherSlug of await listUavSlugs(root)) {
    const other = await readUavCollection(otherSlug, root);
    const rows = [
      other.collection.lookupRaw,
      ...other.collection.series.map((row) => row.lookupRaw),
      ...other.manifest.groups.flatMap((group) =>
        group.buckets.flatMap((bucket) => bucket.files.map((file) => file.lookupRaw))),
    ];
    for (const lookup of rows) {
      const key = text(lookup).toLowerCase();
      const prior = globalIdentifierOwners.get(key);
      if (prior && prior !== otherSlug) duplicateIdentifiers.push(`${lookup} (${prior}, ${otherSlug})`);
      globalIdentifierOwners.set(key, otherSlug);
    }
  }
  add(
    'identifier_uniqueness',
    duplicateIdentifiers.length === 0 && new Set(identifiers.map((row) => text(row).toLowerCase())).size === identifiers.length,
    duplicateIdentifiers.length ? duplicateIdentifiers.join('; ') : `${identifiers.length} collection, series, and item identifiers are unique`,
  );
  const driveIds = folder.manifest.groups.flatMap((group) =>
    group.buckets.flatMap((bucket) => bucket.files.map((file) => file.driveFileId)));
  const unscannedFolders = folder.manifest.groups.flatMap((group) =>
    group.buckets
      .filter((bucket) => text(bucket.folderId) && !text(bucket.scannedAt))
      .map((bucket) => `${group.seriesId}/${bucket.bucket}`));
  add(
    'drive_reconciliation',
    new Set(driveIds).size === driveIds.length && unscannedFolders.length === 0,
    unscannedFolders.length
      ? `Configured Drive folders require a reconciliation scan: ${unscannedFolders.join(', ')}`
      : new Set(driveIds).size === driveIds.length
      ? `${driveIds.length} stable Drive file identities; missing files retain their assigned numbers`
      : 'A Drive file identity is assigned more than once',
  );
  const presentFiles = folder.manifest.groups.flatMap((group) =>
    group.buckets.flatMap((bucket) => bucket.files.filter((file) => !file.missing)));
  const downloadableFiles = presentFiles.filter((file) => file.role !== 'recording_index_pdf');
  add(
    'downloadable_files',
    downloadableFiles.length > 0,
    downloadableFiles.length > 0
      ? `${downloadableFiles.length} present downloadable file(s) across buckets`
      : 'No downloadable files: every deliverable bucket is empty or all files are marked missing',
  );
  const marc = generateUavMarcXml(folder.collection, folder.manifest, authorities);
  const marcCheck = verifyUavMarcXml(marc);
  add('marcxml', marcCheck.ok, marcCheck.ok ? 'MARCXML projection is structurally valid' : marcCheck.issues.join('; '));
  const marcSchemaCheck = await validateUavMarcXmlSchema(marc, marcSchemaPath(root));
  add(
    'marcxml_schema',
    marcSchemaCheck.ok,
    marcSchemaCheck.ok
      ? `MARCXML validates against ${path.basename(marcSchemaCheck.schemaPath)}`
      : marcSchemaCheck.issues.join('; '),
  );
  const rendered = renderUavCollectionHtml(folder.collection, folder.manifest, authorities);
  const [storedHtml, storedMarc] = await Promise.all([
    fs.readFile(folder.paths.indexPath, 'utf8').catch(() => ''),
    fs.readFile(folder.paths.marcPath, 'utf8').catch(() => ''),
  ]);
  const detailCurrent = storedHtml === rendered && storedHtml.includes(folder.collection.lookupRaw);
  const marcCurrent = storedMarc === marc;
  add('detail_page', detailCurrent, detailCurrent
    ? 'Generated detail output is current and contains the collection identifier'
    : 'Run the UAV build to refresh uav/<slug>/index.html');
  add('marc_output', marcCurrent, marcCurrent
    ? 'Generated collection-level MARCXML is current'
    : 'Run the UAV build to refresh uav/<slug>/marc.xml');
  const site = authorities.sites.find((row) => row.id === folder.collection.siteAuthorityId);
  const exact = privateSites.sites?.[folder.collection.siteAuthorityId];
  const aggregate = await readJson(path.join(root, 'data', 'uav.collections.json'), { entries: [] });
  const privacySurfaces = [
    rendered,
    marc,
    JSON.stringify(aggregate),
    await fs.readFile(path.join(root, 'docs', 'data', 'uav.collections.json'), 'utf8').catch(() => ''),
    await fs.readFile(path.join(root, 'data', 'uav.collections.json'), 'utf8').catch(() => ''),
    await fs.readFile(path.join(root, 'docs', 'data', 'catalog.entries.json'), 'utf8').catch(() => ''),
    await fs.readFile(path.join(root, 'data', 'catalog.entries.json'), 'utf8').catch(() => ''),
  ].join('\n');
  const privacySafe = !exact || site?.coordinateVisibility === 'exact'
    || (!privacySurfaces.includes(String(exact.lat)) && !privacySurfaces.includes(String(exact.lon)));
  add('coordinate_privacy', privacySafe, privacySafe ? `${site?.coordinateVisibility || 'hidden'} public coordinate policy enforced` : 'Exact private coordinates leaked');
  const linked = (aggregate.entries || []).some((row) => row.id === slug && row.entry_href === `/uav/${slug}/`);
  add('catalog_link', linked, linked ? `/uav/${slug}/ is present in UAV catalog data` : 'Run the UAV build to create catalog linkage');
  const ok = checks.every((row) => row.ok);
  return { ok, slug, lookup: folder.collection.lookupRaw, checks, blockers: checks.filter((row) => !row.ok) };
}
