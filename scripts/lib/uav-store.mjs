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
  const subjects = collection.subjectAuthorityIds
    .map((id) => authorities.subjects.find((row) => row.id === id))
    .filter(Boolean);
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
          <section class="dx-uav-bucket">
            <h4>${html(bucket.bucket === 'X' ? 'X / raw + support' : `${bucket.bucket} / deliverables`)}</h4>
            <p>${files.length} file${files.length === 1 ? '' : 's'}</p>
            ${fileMarkup ? `<ul>${fileMarkup}</ul>` : '<p class="dx-uav-muted">No published files.</p>'}
          </section>`;
    }).join('');
    return `
      <article class="dx-uav-series">
        <header>
          <p>${html(series.captureClass)}${series.spectrum ? ` · ${html(series.spectrum)}` : ''}</p>
          <h3>${html(series.title)}</h3>
          <code>${html(series.lookupRaw)}</code>
        </header>
        <div class="dx-uav-buckets">${buckets || '<p class="dx-uav-muted">File inventory pending.</p>'}</div>
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

  return `<!doctype html>
<html lang="en-US">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${html(collection.title)} — dexDRONES</title>
  <meta name="description" content="${html(collection.description.slice(0, 240))}">
  <link rel="canonical" href="https://dexdsl.org/uav/${html(collection.slug)}/">
  <link rel="stylesheet" href="/css/tokens.css">
  <link rel="stylesheet" href="/css/base.css">
  <link rel="stylesheet" href="/css/fonts.css">
  <link rel="stylesheet" href="/css/components/dx-uav-entry.css">
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
<body class="dx-uav-page">
  <main class="dx-uav-shell">
    <nav><a href="/catalog/">← Catalog</a><a href="/dexdrones/">dexDRONES</a></nav>
    <header class="dx-uav-hero">
      <p class="dx-uav-kicker">dexDRONES / UAV COLLECTION</p>
      <code>${html(collection.lookupRaw)}</code>
      <h1>${html(collection.title)}</h1>
      <p>${html(collection.description)}</p>
      ${collection.previewUrl ? `<a class="dx-uav-cta" href="${html(collection.previewUrl)}" rel="noreferrer">Open preview ↗</a>` : ''}
    </header>
    <section class="dx-uav-authority">
      <div><span>Site authority</span><strong>${site ? `<a href="${html(site.authority.uri)}" rel="noreferrer">${html(site.name)}</a>` : 'Unresolved'}</strong></div>
      <div><span>Subjects</span><strong>${subjectLinks || 'Unresolved'}</strong></div>
      <div><span>Capture</span><strong>${html([collection.capturedFrom, collection.capturedTo].filter(Boolean).join(' – ') || String(collection.identity.year))}</strong></div>
      <div><span>Coordinates</span><strong>${html(coordinateCopy)}</strong></div>
      <div><span>License</span><strong>${html(collection.license)}</strong></div>
      <div><span>Attribution</span><strong>${html(collection.attribution)}</strong></div>
      <div><span>Operators</span><strong>${linkedCredits(collection.operators) || '—'}</strong></div>
      <div><span>Contributors</span><strong>${linkedCredits(collection.contributors) || '—'}</strong></div>
    </section>
    <section class="dx-uav-series-list">
      <h2>Capture series</h2>
      ${groupMarkup || '<p class="dx-uav-muted">Capture series pending.</p>'}
    </section>
  </main>
  <script id="dex-uav-record" type="application/json">${serialized}</script>
  <script defer src="/assets/js/header-slot.js"></script>
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

      for (const servedRoot of ['', 'docs', 'public']) {
        const base = servedRoot ? path.join(root, servedRoot, 'uav', slug) : path.join(root, 'uav', slug);
        await Promise.all([
          atomicWrite(path.join(base, 'index.html'), indexHtml),
          atomicWrite(path.join(base, 'marc.xml'), marcXml),
        ]);
      }
      collections.push(checked.collection);
      catalogEntries.push(uavCollectionToCatalogEntry(checked.collection, authorities));
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
  for (const servedRoot of ['data', 'docs/data', 'public/data']) {
    await writeJson(path.join(root, servedRoot, 'uav.collections.json'), aggregate);
  }
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
    ['public/data/catalog.data.json', 'public/data/catalog.entries.json', 'public/data/catalog.search.json'],
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
  const canonicalEntries = await fs.readFile(path.join(root, 'public/data/catalog.entries.json'), 'utf8');
  for (const rel of ['assets/data/catalog.entries.json', 'docs/assets/data/catalog.entries.json', 'public/assets/data/catalog.entries.json']) {
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
  for (const rel of ['data/catalog.guide.json', 'docs/data/catalog.guide.json', 'public/data/catalog.guide.json']) {
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
  for (const rel of ['data/catalog.symbols.json', 'docs/data/catalog.symbols.json', 'public/data/catalog.symbols.json']) {
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
    await fs.readFile(path.join(root, 'public', 'data', 'uav.collections.json'), 'utf8').catch(() => ''),
    await fs.readFile(path.join(root, 'docs', 'data', 'catalog.entries.json'), 'utf8').catch(() => ''),
    await fs.readFile(path.join(root, 'public', 'data', 'catalog.entries.json'), 'utf8').catch(() => ''),
  ].join('\n');
  const privacySafe = !exact || site?.coordinateVisibility === 'exact'
    || (!privacySurfaces.includes(String(exact.lat)) && !privacySurfaces.includes(String(exact.lon)));
  add('coordinate_privacy', privacySafe, privacySafe ? `${site?.coordinateVisibility || 'hidden'} public coordinate policy enforced` : 'Exact private coordinates leaked');
  const linked = (aggregate.entries || []).some((row) => row.id === slug && row.entry_href === `/uav/${slug}/`);
  add('catalog_link', linked, linked ? `/uav/${slug}/ is present in UAV catalog data` : 'Run the UAV build to create catalog linkage');
  const ok = checks.every((row) => row.ok);
  return { ok, slug, lookup: folder.collection.lookupRaw, checks, blockers: checks.filter((row) => !row.ok) };
}
