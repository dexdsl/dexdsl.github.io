#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prepareTemplate, buildEmptyManifestSkeleton } from './lib/init-core.mjs';
import { parseRecordingIndexSheetUrl, importRecordingIndexFromSheet } from './lib/recording-index-import.mjs';
import { upsertProtectedAssetsLookupMapping } from './lib/protected-assets-publisher.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');

const DEFAULT_MASTER_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1up2Jq4Yx5sLuUDHRKlkIg4MDDQH0SZ4lGX20CuriUb4/edit?gid=0#gid=0';
const DEFAULT_TEMPLATE_PATH = path.resolve(ROOT, 'entries', 'test-5', 'index.html');
const DEFAULT_RUN_MANIFEST_PATH = path.resolve(ROOT, 'data', 'entry-population.run-manifest.json');
const DEFAULT_SEED_DIR = path.resolve(ROOT, 'tmp', 'production-entry-seeds');
const DEFAULT_PROTECTED_ASSETS_PATH = path.resolve(ROOT, 'data', 'protected.assets.json');
const DEFAULT_SCOPE = 's2-plus-matt';
const DEFAULT_EXPECTED_TARGET_COUNT = 13;

const LOOKUP_OVERRIDES = new Map([
  ['P.SDR. LE AV2024 S2', {
    slug: 'snare-drum-matt-leveque',
    lookup: 'P.Sdr. Le AV2024 S2',
    title: 'SNARE DRUM',
    performer: 'Matt LeVeque',
    instrument: 'SNARE DRUM',
    season: 'S2',
  }],
  ['P.MUL. JAYO AV2024 S2', {
    slug: 'as-though-im-slipping',
    lookup: 'P.Ens. JaYo AV2024 S2',
  }],
  ['P.DHO. SH A2024 S2', {
    slug: 'anant-shah',
    lookup: 'P.Dho. Sh AV2024 S2',
  }],
  ['V.GAV. YE A2024 S2', {
    slug: 'aidan-yeats',
    lookup: 'V.Sng. Ye AV2024 S2',
  }],
  ['V.GAV. YE AV2024 S2', {
    slug: 'aidan-yeats',
    lookup: 'V.Sng. Ye AV2024 S2',
  }],
]);

function toText(value) {
  return String(value ?? '').trim();
}

function stripZeroWidth(value) {
  return toText(value).replace(/[\u200B-\u200D\u2060\uFEFF]/g, '');
}

function normalizeLookup(value) {
  return stripZeroWidth(value)
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/\bA(\d{4})\b/g, 'AV$1');
}

function parseYearAndSeason(lookup) {
  const raw = toText(lookup);
  const match = raw.match(/(?:AV|A|V|O)(\d{4})(?:\s*(S\d+))?/i);
  return {
    year: match ? Number(match[1]) : NaN,
    season: match && match[2] ? match[2].toUpperCase() : '',
  };
}

function parseCsvRows(csvText = '') {
  const rows = [];
  let row = [];
  let current = '';
  let inQuote = false;
  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    if (inQuote) {
      if (char === '"') {
        if (csvText[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuote = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      inQuote = true;
      continue;
    }
    if (char === ',') {
      row.push(current);
      current = '';
      continue;
    }
    if (char === '\n') {
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
      continue;
    }
    if (char === '\r') continue;
    current += char;
  }
  if (current.length || row.length) {
    row.push(current);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((cell) => toText(cell)));
}

function parseMasterSheetRows(csvText) {
  const rows = parseCsvRows(csvText);
  if (!rows.length) return [];
  const header = rows[0].map((cell) => toText(cell).toLowerCase());
  const lookupIndex = header.indexOf('lookup number');
  const nameIndex = header.indexOf('name');
  const linkIndex = header.indexOf('link');
  if (lookupIndex < 0 || linkIndex < 0) {
    throw new Error('Master sheet CSV must include "lookup number" and "link" columns.');
  }
  return rows.slice(1).map((row) => ({
    lookupNumber: toText(row[lookupIndex]),
    name: stripZeroWidth(row[nameIndex]),
    sheetUrl: toText(row[linkIndex]),
  })).filter((row) => row.lookupNumber && row.sheetUrl);
}

function normalizeExtractedUrl(raw) {
  return toText(raw)
    .replace(/\\\\\//g, '/')
    .replace(/\\u003d/g, '=')
    .replace(/\\u0026/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/\\=/g, '=')
    .replace(/[\\]+$/g, '');
}

function extractUrlsFromHtml(html = '') {
  const matches = [];
  const seen = new Set();
  const patterns = [
    /https?:\\\\\/\\\\\/[^"'\\\s<>]+/g,
    /https?:\/\/[^"'\s<>]+/g,
  ];
  for (const pattern of patterns) {
    const found = html.match(pattern) || [];
    for (const candidate of found) {
      const normalized = normalizeExtractedUrl(candidate);
      if (!normalized || !normalized.startsWith('http')) continue;
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      matches.push(normalized);
    }
  }
  return matches;
}

function extractYouTubeUrlFromSheetHtml(html) {
  const lower = String(html || '').toLowerCase();
  const markerIndex = lower.indexOf('youtube video');
  const scoped = markerIndex >= 0 ? html.slice(markerIndex, markerIndex + 300000) : html;
  const scopedUrls = extractUrlsFromHtml(scoped).filter((url) => /youtu\.be|youtube\.com/i.test(url));
  if (scopedUrls.length > 0) return scopedUrls[0];
  const any = extractUrlsFromHtml(html).filter((url) => /youtu\.be|youtube\.com/i.test(url));
  return any[0] || '';
}

function extractEntryUrlFromSheetHtml(html) {
  const urls = extractUrlsFromHtml(html);
  const entry = urls.find((url) => /\/entry\/[^/]+/i.test(url));
  return entry || '';
}

async function fetchText(url, {
  timeoutMs = 20000,
  retries = 2,
} = {}) {
  const safeTimeout = Math.max(1000, Number(timeoutMs) || 20000);
  const safeRetries = Math.max(0, Number(retries) || 0);
  let lastError = null;
  for (let attempt = 0; attempt <= safeRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('timeout')), safeTimeout);
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const text = await response.text();
      clearTimeout(timer);
      return text;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt >= safeRetries) break;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw lastError || new Error(`Failed to fetch ${url}`);
}

function decodeCatalogPerformer(value) {
  const cleaned = stripZeroWidth(value);
  if (!cleaned) return '';
  const parts = cleaned.split('&').map((chunk) => chunk.trim()).filter(Boolean);
  const normalized = parts.map((part) => {
    if (!part.includes(',')) return part;
    const [last, first] = part.split(',').map((chunk) => chunk.trim()).filter(Boolean);
    return first && last ? `${first} ${last}` : part;
  });
  return normalized.join(' & ');
}

function firstCatalogInstrument(entry) {
  const labels = Array.isArray(entry?.instrument_labels) ? entry.instrument_labels : [];
  for (const value of labels) {
    const cleaned = stripZeroWidth(value);
    if (cleaned) return cleaned;
  }
  return '';
}

function buildManifestFromImport(imported, formatKeys) {
  const manifest = buildEmptyManifestSkeleton(formatKeys);
  const tokens = imported?.bundleTokensByBucketType && typeof imported.bundleTokensByBucketType === 'object'
    ? imported.bundleTokensByBucketType
    : {};
  for (const bucket of Object.keys(manifest.audio || {})) {
    const audioToken = toText(tokens[`${bucket}:audio`]);
    const videoToken = toText(tokens[`${bucket}:video`]);
    for (const key of Object.keys(manifest.audio[bucket] || {})) {
      manifest.audio[bucket][key] = audioToken;
    }
    for (const key of Object.keys(manifest.video[bucket] || {})) {
      manifest.video[bucket][key] = videoToken;
    }
  }
  return manifest;
}

function buildCreditsData({ performer, instrument, year, season }) {
  return {
    artist: performer ? [performer] : [],
    artistAlt: null,
    instruments: instrument ? [instrument] : [],
    video: {
      director: [],
      cinematography: [],
      editing: [],
    },
    audio: {
      recording: [],
      mix: [],
      master: [],
    },
    year: Number.isFinite(Number(year)) ? Number(year) : new Date().getUTCFullYear(),
    season: toText(season) || 'S2',
    location: 'Unknown',
  };
}

function buildSeedPayload({
  slug,
  title,
  performer,
  instrument,
  lookupNumber,
  season,
  year,
  youtubeUrl,
  imported,
  formatKeys,
}) {
  const creditsData = buildCreditsData({ performer, instrument, year, season });
  const buckets = Array.isArray(imported?.counts?.buckets) && imported.counts.buckets.length
    ? imported.counts.buckets
    : Array.from(new Set((imported?.segments || []).map((segment) => toText(segment.bucket).toUpperCase()).filter(Boolean)));
  const manifest = buildManifestFromImport(imported, formatKeys);
  const recordingIndex = imported?.recordingIndex && typeof imported.recordingIndex === 'object'
    ? imported.recordingIndex
    : {};
  const sheetMeta = imported?.sheet && typeof imported.sheet === 'object'
    ? imported.sheet
    : {};

  const sidebarPageConfig = {
    lookupNumber,
    buckets: buckets.length ? buckets : ['A'],
    specialEventImage: '/assets/series/dex.png',
    attributionSentence: `Samples licensed under CC-BY 4.0 by Dex Digital Sample Library and ${performer || 'the contributing artist'}.`,
    credits: creditsData,
    fileSpecs: {
      bitDepth: 24,
      sampleRate: 48000,
      channels: 'stereo',
      staticSizes: { A: '', B: '', C: '', D: '', E: '', X: '' },
    },
    metadata: {
      sampleLength: 'AUTO',
      tags: [],
    },
    downloads: {
      recordingIndexPdfRef: toText(recordingIndex.recordingIndexPdfRef),
      recordingIndexBundleRef: toText(recordingIndex.recordingIndexBundleRef),
      recordingIndexSourceUrl: toText(recordingIndex.recordingIndexSourceUrl),
    },
  };

  return {
    title,
    slug,
    descriptionText: `${title}.`,
    video: {
      dataUrl: youtubeUrl,
      dataUrlOriginal: youtubeUrl,
    },
    series: 'dex',
    creditsData,
    sidebarPageConfig,
    manifest,
    protectedAssetsImport: {
      lookupNumber,
      title,
      status: 'active',
      season: toText(season) || 'S2',
      files: Array.isArray(imported?.files) ? imported.files : [],
      entitlements: [{ type: 'role', value: 'authenticated' }],
      recordingIndex: {
        sheetUrl: toText(recordingIndex.sheetUrl),
        sheetId: toText(recordingIndex.sheetId),
        gid: toText(recordingIndex.gid),
        pdfAssetId: toText(recordingIndex.pdfAssetId),
        bundleAllToken: toText(recordingIndex.bundleAllToken),
        rootFolderUrl: toText(sheetMeta.rootFolderUrl),
        bucketFolderUrls: sheetMeta.bucketFolderUrls && typeof sheetMeta.bucketFolderUrls === 'object'
          ? sheetMeta.bucketFolderUrls
          : {},
      },
      filePath: DEFAULT_PROTECTED_ASSETS_PATH,
    },
  };
}

function parseArgs(argv) {
  const out = {
    masterSheetUrl: DEFAULT_MASTER_SHEET_URL,
    templatePath: DEFAULT_TEMPLATE_PATH,
    runManifestPath: DEFAULT_RUN_MANIFEST_PATH,
    seedDir: DEFAULT_SEED_DIR,
    scope: DEFAULT_SCOPE,
    expectedTargetCount: DEFAULT_EXPECTED_TARGET_COUNT,
    dryRun: false,
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = String(argv[index] || '');
    const next = String(argv[index + 1] || '');
    if (arg === '--master-sheet-url' && next) {
      out.masterSheetUrl = next;
      index += 1;
      continue;
    }
    if (arg.startsWith('--master-sheet-url=')) {
      out.masterSheetUrl = arg.slice('--master-sheet-url='.length);
      continue;
    }
    if (arg === '--template' && next) {
      out.templatePath = next;
      index += 1;
      continue;
    }
    if (arg.startsWith('--template=')) {
      out.templatePath = arg.slice('--template='.length);
      continue;
    }
    if (arg === '--run-manifest' && next) {
      out.runManifestPath = next;
      index += 1;
      continue;
    }
    if (arg.startsWith('--run-manifest=')) {
      out.runManifestPath = arg.slice('--run-manifest='.length);
      continue;
    }
    if (arg === '--seed-dir' && next) {
      out.seedDir = next;
      index += 1;
      continue;
    }
    if (arg.startsWith('--seed-dir=')) {
      out.seedDir = arg.slice('--seed-dir='.length);
      continue;
    }
    if (arg === '--dry-run') {
      out.dryRun = true;
      continue;
    }
    if (arg === '--scope' && next) {
      out.scope = toText(next).toLowerCase();
      index += 1;
      continue;
    }
    if (arg.startsWith('--scope=')) {
      out.scope = toText(arg.slice('--scope='.length)).toLowerCase();
      continue;
    }
    if (arg === '--expected-target-count' && next) {
      out.expectedTargetCount = Number(next);
      index += 1;
      continue;
    }
    if (arg.startsWith('--expected-target-count=')) {
      out.expectedTargetCount = Number(arg.slice('--expected-target-count='.length));
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (!['s2-plus-matt', 'all'].includes(out.scope)) {
    throw new Error(`Unsupported scope: ${out.scope}`);
  }
  if (!Number.isFinite(out.expectedTargetCount)) {
    throw new Error(`Invalid --expected-target-count: ${out.expectedTargetCount}`);
  }
  out.expectedTargetCount = Math.max(0, Math.trunc(out.expectedTargetCount));
  out.templatePath = path.resolve(ROOT, out.templatePath);
  out.runManifestPath = path.resolve(ROOT, out.runManifestPath);
  out.seedDir = path.resolve(ROOT, out.seedDir);
  return out;
}

function runDex(args) {
  const dexPath = path.resolve(ROOT, 'scripts', 'dex.mjs');
  const result = spawnSync(process.execPath, [dexPath, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  return {
    ok: result.status === 0,
    code: Number(result.status ?? 1),
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
    command: `node scripts/dex.mjs ${args.join(' ')}`,
  };
}

function readCatalogEntries(entriesSource) {
  const rows = Array.isArray(entriesSource?.entries) ? entriesSource.entries : [];
  const byId = new Map();
  const byLookupExact = new Map();
  const byLookupNormalized = new Map();
  for (const row of rows) {
    const id = toText(row?.id);
    const lookup = stripZeroWidth(row?.lookup_raw);
    if (id) byId.set(id, row);
    if (lookup) {
      const exactKey = lookup;
      const normalizedKey = normalizeLookup(lookup);
      if (!byLookupExact.has(exactKey)) byLookupExact.set(exactKey, []);
      byLookupExact.get(exactKey).push(row);
      if (!byLookupNormalized.has(normalizedKey)) byLookupNormalized.set(normalizedKey, []);
      byLookupNormalized.get(normalizedKey).push(row);
    }
  }
  return { rows, byId, byLookupExact, byLookupNormalized };
}

function resolveCatalogContext(masterRow, catalogIndex) {
  const sourceLookup = stripZeroWidth(masterRow.lookupNumber);
  const normalizedSourceLookup = normalizeLookup(sourceLookup);
  const override = LOOKUP_OVERRIDES.get(normalizedSourceLookup) || null;

  const resolveByLookup = () => {
    const exact = catalogIndex.byLookupExact.get(sourceLookup) || [];
    if (exact.length === 1) return exact[0];
    const normalized = catalogIndex.byLookupNormalized.get(normalizedSourceLookup) || [];
    if (normalized.length === 1) return normalized[0];
    return null;
  };

  const catalogEntry = (() => {
    if (override?.slug) return catalogIndex.byId.get(override.slug) || null;
    return resolveByLookup();
  })();

  const slug = toText(override?.slug || catalogEntry?.id);
  const lookupNumber = stripZeroWidth(override?.lookup || catalogEntry?.lookup_raw || sourceLookup);
  if (!slug && !override?.slug) {
    throw new Error(`Unable to resolve slug for lookup ${sourceLookup}`);
  }
  if (!lookupNumber) {
    throw new Error(`Unable to resolve catalog lookup for ${slug || sourceLookup}`);
  }

  const fallbackPerformer = decodeCatalogPerformer(catalogEntry?.performer_raw);
  const performer = stripZeroWidth(override?.performer || masterRow.name || fallbackPerformer);
  const instrument = stripZeroWidth(override?.instrument || firstCatalogInstrument(catalogEntry) || catalogEntry?.title_raw || 'UNKNOWN');
  const title = stripZeroWidth(override?.title || catalogEntry?.title_raw || instrument || slug || sourceLookup);
  const lookupMeta = parseYearAndSeason(lookupNumber);
  const season = toText(override?.season || catalogEntry?.season || lookupMeta.season || 'S2').toUpperCase();
  const year = Number.isFinite(Number(lookupMeta.year)) ? Number(lookupMeta.year) : NaN;

  return {
    sourceLookup,
    normalizedSourceLookup,
    slug: toText(override?.slug || slug),
    lookupNumber,
    performer,
    instrument,
    title,
    season,
    year,
    catalogEntryId: toText(catalogEntry?.id),
    resolutionReason: override ? 'override' : (catalogEntry ? 'catalog-match' : 'fallback'),
  };
}

function shouldProcessContext(masterRow, context, scope) {
  if (scope === 'all') {
    return { include: true, reason: 'scope-all' };
  }
  const lookupSeason = parseYearAndSeason(context.lookupNumber).season;
  if (lookupSeason === 'S2') {
    return { include: true, reason: 'season-s2' };
  }
  const mattText = `${toText(masterRow.name)} ${toText(context.performer)} ${toText(context.title)} ${toText(context.lookupNumber)}`;
  if (/\bmatt\b|\bleveque\b/i.test(mattText)) {
    return { include: true, reason: 'matt-override' };
  }
  return { include: false, reason: 'out-of-scope' };
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  process.chdir(ROOT);
  const options = parseArgs(process.argv);
  const { templatePath, templateHtml, formatKeys } = await prepareTemplate({ templateArg: options.templatePath });

  const masterSheet = parseRecordingIndexSheetUrl(options.masterSheetUrl);
  const masterCsvUrl = `https://docs.google.com/spreadsheets/d/${masterSheet.sheetId}/export?format=csv&gid=${encodeURIComponent(masterSheet.gid)}`;
  const masterCsvText = await fetchText(masterCsvUrl, { timeoutMs: 20000, retries: 3 });
  const masterRows = parseMasterSheetRows(masterCsvText);
  if (!masterRows.length) throw new Error('Master recording-index sheet has no rows.');

  const catalogEntriesSource = JSON.parse(await fs.readFile(path.resolve(ROOT, 'data', 'catalog.entries.json'), 'utf8'));
  const catalogIndex = readCatalogEntries(catalogEntriesSource);

  await fs.mkdir(options.seedDir, { recursive: true });
  await fs.mkdir(path.dirname(options.runManifestPath), { recursive: true });

  const existingEntries = new Set(
    (await fs.readdir(path.resolve(ROOT, 'entries'), { withFileTypes: true }))
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name),
  );

  const runManifest = {
    generatedAt: new Date().toISOString(),
    root: ROOT,
    masterSheet: {
      inputUrl: options.masterSheetUrl,
      normalizedUrl: masterSheet.sheetUrl,
      sheetId: masterSheet.sheetId,
      gid: masterSheet.gid,
      csvUrl: masterCsvUrl,
    },
    templatePath,
    formatKeys,
    scope: options.scope,
    expectedTargetCount: options.expectedTargetCount,
    dryRun: !!options.dryRun,
    rows: [],
  };

  let successCount = 0;
  let failureCount = 0;
  let skippedCount = 0;
  let targetedCount = 0;
  for (const masterRow of masterRows) {
    const rowStartedAt = new Date().toISOString();
    const rowReport = {
      startedAt: rowStartedAt,
      sourceLookup: stripZeroWidth(masterRow.lookupNumber),
      sourceName: stripZeroWidth(masterRow.name),
      sourceSheetUrl: toText(masterRow.sheetUrl),
      status: 'pending',
      mode: '',
      slug: '',
      resolvedLookup: '',
      youtubeUrl: '',
      entryUrlFromSheet: '',
      seedPath: '',
      commands: [],
      error: '',
    };

    try {
      const context = resolveCatalogContext(masterRow, catalogIndex);
      rowReport.slug = context.slug;
      rowReport.resolvedLookup = context.lookupNumber;
      rowReport.resolutionReason = context.resolutionReason;
      rowReport.catalogEntryId = context.catalogEntryId;

      const scopeDecision = shouldProcessContext(masterRow, context, options.scope);
      rowReport.scopeReason = scopeDecision.reason;
      if (!scopeDecision.include) {
        rowReport.status = 'skipped';
        rowReport.mode = 'scope-filtered';
        skippedCount += 1;
        continue;
      }
      targetedCount += 1;

      const sheetUrl = parseRecordingIndexSheetUrl(masterRow.sheetUrl).sheetUrl;
      rowReport.sourceSheetUrl = sheetUrl;

      const sheetHtml = await fetchText(sheetUrl, { timeoutMs: 20000, retries: 2 });
      const youtubeUrl = extractYouTubeUrlFromSheetHtml(sheetHtml);
      if (!youtubeUrl) {
        throw new Error(`No YouTube URL found in sheet ${sheetUrl}`);
      }
      rowReport.youtubeUrl = youtubeUrl;
      rowReport.entryUrlFromSheet = extractEntryUrlFromSheetHtml(sheetHtml);

      const imported = await importRecordingIndexFromSheet({
        sheetUrl,
        lookupNumber: context.lookupNumber,
        entrySlug: context.slug,
        timeoutMs: 20000,
        retries: 2,
      });

      const seedPayload = buildSeedPayload({
        slug: context.slug,
        title: context.title,
        performer: context.performer,
        instrument: context.instrument,
        lookupNumber: context.lookupNumber,
        season: context.season,
        year: context.year,
        youtubeUrl,
        imported,
        formatKeys,
      });

      const seedPath = path.resolve(options.seedDir, `${context.slug}.seed.json`);
      rowReport.seedPath = seedPath;
      await fs.writeFile(seedPath, `${JSON.stringify(seedPayload, null, 2)}\n`, 'utf8');

      const entryExists = existingEntries.has(context.slug)
        && await exists(path.resolve(ROOT, 'entries', context.slug, 'index.html'));

      if (entryExists) {
        rowReport.mode = 'existing-update';
        if (!options.dryRun) {
          const linkArgs = [
            'entry',
            'link',
            '--entry', context.slug,
            '--lookup', context.lookupNumber,
            '--season', context.season,
            '--performer', context.performer,
            '--instrument', context.instrument,
            '--title', context.title,
            '--status', 'active',
          ];
          const linkResult = runDex(linkArgs);
          rowReport.commands.push({
            type: 'entry-link',
            command: linkResult.command,
            code: linkResult.code,
            ok: linkResult.ok,
          });
          if (!linkResult.ok) {
            throw new Error(`entry link failed for ${context.slug}: ${linkResult.stderr || linkResult.stdout}`);
          }

          await upsertProtectedAssetsLookupMapping({
            lookupNumber: context.lookupNumber,
            title: context.title,
            status: 'active',
            season: context.season,
            files: Array.isArray(imported.files) ? imported.files : [],
            entitlements: [{ type: 'role', value: 'authenticated' }],
            recordingIndex: {
              sheetUrl: toText(imported?.recordingIndex?.sheetUrl),
              sheetId: toText(imported?.recordingIndex?.sheetId),
              gid: toText(imported?.recordingIndex?.gid),
              pdfAssetId: toText(imported?.recordingIndex?.pdfAssetId),
              bundleAllToken: toText(imported?.recordingIndex?.bundleAllToken),
              rootFolderUrl: toText(imported?.sheet?.rootFolderUrl),
              bucketFolderUrls: imported?.sheet?.bucketFolderUrls && typeof imported.sheet.bucketFolderUrls === 'object'
                ? imported.sheet.bucketFolderUrls
                : {},
            },
            filePath: DEFAULT_PROTECTED_ASSETS_PATH,
          });
          rowReport.commands.push({
            type: 'assets-upsert',
            command: 'upsertProtectedAssetsLookupMapping(...)',
            code: 0,
            ok: true,
          });
        }
      } else {
        rowReport.mode = 'init';
        if (!options.dryRun) {
          const initArgs = [
            'init',
            '--quick',
            '--template', templatePath,
            '--out', './entries',
            '--from', seedPath,
            '--catalog-link', 'create-linked',
            '--catalog-status', 'active',
          ];
          const initResult = runDex(initArgs);
          rowReport.commands.push({
            type: 'init',
            command: initResult.command,
            code: initResult.code,
            ok: initResult.ok,
          });
          if (!initResult.ok) {
            throw new Error(`init failed for ${context.slug}: ${initResult.stderr || initResult.stdout}`);
          }
          existingEntries.add(context.slug);
        }
      }

      rowReport.status = 'success';
      successCount += 1;
    } catch (error) {
      rowReport.status = 'failed';
      rowReport.error = String(error?.message || error);
      failureCount += 1;
    } finally {
      rowReport.finishedAt = new Date().toISOString();
      runManifest.rows.push(rowReport);
    }
  }

  runManifest.summary = {
    total: runManifest.rows.length,
    targeted: targetedCount,
    skipped: skippedCount,
    success: successCount,
    failed: failureCount,
    expectedTargetCount: options.expectedTargetCount,
    targetCountMatchesExpectation: options.expectedTargetCount > 0 ? targetedCount === options.expectedTargetCount : true,
  };
  await fs.writeFile(options.runManifestPath, `${JSON.stringify(runManifest, null, 2)}\n`, 'utf8');

  const targetMismatch = options.expectedTargetCount > 0 && targetedCount !== options.expectedTargetCount;
  console.log(
    `populate:production total=${runManifest.summary.total} targeted=${targetedCount} skipped=${skippedCount} success=${successCount} failed=${failureCount}`,
  );
  console.log(`run-manifest: ${options.runManifestPath}`);
  if (targetMismatch) {
    console.error(
      `populate:production target-count mismatch expected=${options.expectedTargetCount} actual=${targetedCount}`,
    );
    process.exitCode = 1;
  }
  if (failureCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`populate:production error: ${error?.message || String(error)}`);
  process.exit(1);
});
