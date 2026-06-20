#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { prepareTemplate } from './lib/init-core.mjs';
import { createDriveClient, listDriveTree, parseDriveId } from './lib/google-drive-inventory.mjs';
import {
  DEFAULT_RECORDING_INDEX_SOURCES_PATH,
  discoverRecordingIndexSourcesFromDriveTree,
  readCatalogEntries,
  readRecordingIndexSources,
  validateRecordingIndexSources,
  writeRecordingIndexSources,
} from './lib/recording-index-sources.mjs';
import {
  applyImportedRecordingIndex,
  importSourceForEntry,
} from './lib/recording-index-apply.mjs';

function toText(value) {
  return String(value ?? '').trim();
}

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((item) => toText(item))
    .filter(Boolean);
}

function parseArgs(argv) {
  const [command = 'help', ...rest] = argv.slice(2);
  const options = {
    command,
    season: '',
    driveRoot: '',
    registryPath: DEFAULT_RECORDING_INDEX_SOURCES_PATH,
    catalogPath: path.resolve('data', 'catalog.entries.json'),
    protectedAssetsPath: path.resolve('data', 'protected.assets.json'),
    routeEntryDir: path.resolve('docs', 'entry'),
    templatePath: '',
    serviceAccountKeyPath: '',
    maxDepth: 5,
    write: false,
    dryRun: false,
    json: false,
    importSheets: false,
    updateHtml: true,
    onlySlugs: new Set(),
  };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = String(rest[index] || '');
    const next = String(rest[index + 1] || '');
    const readValue = (name) => {
      if (arg === name && next) {
        index += 1;
        return next;
      }
      if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
      return null;
    };

    const season = readValue('--season');
    if (season !== null) {
      options.season = season.toUpperCase();
      continue;
    }
    const driveRoot = readValue('--drive-root');
    if (driveRoot !== null) {
      options.driveRoot = driveRoot;
      continue;
    }
    const registry = readValue('--registry');
    if (registry !== null) {
      options.registryPath = path.resolve(registry);
      continue;
    }
    const catalog = readValue('--catalog');
    if (catalog !== null) {
      options.catalogPath = path.resolve(catalog);
      continue;
    }
    const assets = readValue('--protected-assets');
    if (assets !== null) {
      options.protectedAssetsPath = path.resolve(assets);
      continue;
    }
    const routeEntryDir = readValue('--route-entry-dir');
    if (routeEntryDir !== null) {
      options.routeEntryDir = path.resolve(routeEntryDir);
      continue;
    }
    const template = readValue('--template');
    if (template !== null) {
      options.templatePath = path.resolve(template);
      continue;
    }
    const keyPath = readValue('--service-account-key');
    if (keyPath !== null) {
      options.serviceAccountKeyPath = path.resolve(keyPath);
      continue;
    }
    const maxDepth = readValue('--max-depth');
    if (maxDepth !== null) {
      options.maxDepth = Math.max(1, Math.trunc(Number(maxDepth) || 5));
      continue;
    }
    const only = readValue('--only') ?? readValue('--only-slugs');
    if (only !== null) {
      parseList(only).forEach((slug) => options.onlySlugs.add(slug));
      continue;
    }

    if (arg === '--write') {
      options.write = true;
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--import') {
      options.importSheets = true;
      continue;
    }
    if (arg === '--no-html') {
      options.updateHtml = false;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function requireSeason(options) {
  if (!options.season) throw new Error('--season is required.');
}

function printUsage() {
  console.log(`Usage:
  node scripts/recording-indexes.mjs init-season --season S1 --drive-root <folder-id-or-url>
  node scripts/recording-indexes.mjs discover --season S1 [--write] [--max-depth 5]
  node scripts/recording-indexes.mjs validate --season S1 [--import] [--only slug-a,slug-b]
  node scripts/recording-indexes.mjs apply --season S1 [--dry-run] [--only slug-a,slug-b] [--no-html]

Options:
  --registry <path>              Registry path (default data/recording-index.sources.json)
  --catalog <path>               Catalog entries path
  --service-account-key <path>   Google service account key path
  --drive-root <id-or-url>       Season Drive root for init/discover
  --max-depth <n>                Drive traversal depth for discover/import
  --write                        Persist discovery results to registry
  --import                       Validate by importing configured sheet/Drive sources
  --dry-run                      Preview apply without writing
  --json                         Emit JSON output
`);
}

function filterSourcesByOptions(registry, options) {
  const onlySet = options.onlySlugs;
  const seasonSources = registry.seasons || {};
  return Object.values(registry.entries || {})
    .filter((source) => toText(source.season).toUpperCase() === options.season)
    .filter((source) => !onlySet.size || onlySet.has(source.slug))
    .map((source) => {
      const seasonSource = seasonSources[toText(source.season).toUpperCase()] || {};
      return {
        ...source,
        importMode: toText(source.importMode || seasonSource.importMode),
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

async function commandInitSeason(options) {
  requireSeason(options);
  const driveRootId = parseDriveId(options.driveRoot);
  if (!driveRootId) throw new Error('--drive-root is required for init-season.');
  const registry = await readRecordingIndexSources(options.registryPath);
  registry.seasons[options.season] = {
    sourceMode: 'drive-tree',
    driveRootFolderId: driveRootId,
  };
  const written = await writeRecordingIndexSources(registry, options.registryPath);
  return {
    registryPath: path.resolve(options.registryPath),
    season: options.season,
    seasonSource: written.seasons[options.season],
  };
}

async function commandDiscover(options) {
  requireSeason(options);
  const registry = await readRecordingIndexSources(options.registryPath);
  const seasonSource = registry.seasons[options.season] || {};
  const rootFolderId = parseDriveId(options.driveRoot || seasonSource.driveRootFolderId || seasonSource.driveRootFolderUrl || '');
  if (!rootFolderId) throw new Error(`No Drive root configured for ${options.season}. Run init-season or pass --drive-root.`);

  const catalogEntries = await readCatalogEntries(options.catalogPath);
  const driveClient = createDriveClient({
    keyPath: options.serviceAccountKeyPath || undefined,
  });
  const tree = await listDriveTree({
    rootFolderId,
    driveClient,
    maxDepth: options.maxDepth,
  });
  const discovered = discoverRecordingIndexSourcesFromDriveTree({
    tree,
    catalogEntries,
    season: options.season,
  });

  const nextRegistry = {
    ...registry,
    seasons: {
      ...(registry.seasons || {}),
      [options.season]: {
        ...(registry.seasons?.[options.season] || {}),
        sourceMode: 'drive-tree',
        driveRootFolderId: rootFolderId,
      },
    },
    entries: {
      ...(registry.entries || {}),
      ...discovered.entries,
    },
  };

  const result = {
    season: options.season,
    rootFolderId,
    discoveredCount: Object.keys(discovered.entries).length,
    unmatchedCount: discovered.unmatched.length,
    entries: discovered.entries,
    unmatched: discovered.unmatched,
    written: false,
  };

  if (options.write) {
    await writeRecordingIndexSources(nextRegistry, options.registryPath);
    result.written = true;
    result.registryPath = path.resolve(options.registryPath);
  }

  return result;
}

async function commandValidate(options) {
  requireSeason(options);
  const registry = await readRecordingIndexSources(options.registryPath);
  const catalogEntries = await readCatalogEntries(options.catalogPath);
  const base = validateRecordingIndexSources({
    registry,
    catalogEntries,
    season: options.season,
    onlySlugs: Array.from(options.onlySlugs),
  });

  if (!options.importSheets) return base;

  const importRows = [];
  for (const source of filterSourcesByOptions(registry, options)) {
    try {
      const imported = await importSourceForEntry({
        source,
        serviceAccountKeyPath: options.serviceAccountKeyPath || undefined,
        driveMaxDepth: options.maxDepth,
      });
      importRows.push({
        slug: source.slug,
        ok: true,
        files: imported.files.length,
        mediaFiles: imported.segments.length,
        sourceMode: imported.source?.mode || '',
        buckets: imported.counts?.buckets || [],
      });
    } catch (error) {
      base.issues.push({
        slug: source.slug,
        severity: 'error',
        code: 'import-failed',
        message: String(error?.message || error),
      });
      importRows.push({
        slug: source.slug,
        ok: false,
        error: String(error?.message || error),
      });
    }
  }

  return {
    ...base,
    ok: !base.issues.some((issue) => issue.severity === 'error'),
    importRows,
  };
}

async function commandApply(options) {
  requireSeason(options);
  const registry = await readRecordingIndexSources(options.registryPath);
  const sources = filterSourcesByOptions(registry, options);
  if (!sources.length) throw new Error(`No registry entries matched ${options.season}.`);
  const { formatKeys } = await prepareTemplate({ templateArg: options.templatePath || undefined });
  const results = [];

  for (const source of sources) {
    const imported = await importSourceForEntry({
      source,
      serviceAccountKeyPath: options.serviceAccountKeyPath || undefined,
      driveMaxDepth: options.maxDepth,
    });
    const result = await applyImportedRecordingIndex({
      source,
      imported,
      formatKeys,
      protectedAssetsPath: options.protectedAssetsPath,
      routeEntryDir: options.routeEntryDir,
      updateHtml: options.updateHtml,
      dryRun: options.dryRun,
    });
    results.push(result);
  }

  return {
    season: options.season,
    dryRun: options.dryRun,
    applied: results.length,
    results,
  };
}

function printHuman(result, options) {
  if (options.command === 'validate') {
    console.log(result.ok ? 'recording-index validate passed' : 'recording-index validate failed');
    for (const issue of result.issues || []) {
      console.log(`${issue.severity || 'info'} ${issue.slug || '-'} ${issue.code || '-'}: ${issue.message}`);
    }
    if (result.importRows) {
      for (const row of result.importRows) {
        console.log(row.ok
          ? `import ${row.slug}: ${row.files} files (${row.sourceMode})`
          : `import ${row.slug}: failed: ${row.error}`);
      }
    }
    return;
  }

  if (options.command === 'discover') {
    console.log(`discovered ${result.discoveredCount} recording index source(s) for ${result.season}`);
    if (result.written) console.log(`wrote ${result.registryPath}`);
    if (result.unmatchedCount) console.log(`unmatched sheets: ${result.unmatchedCount}`);
    for (const source of Object.values(result.entries || {})) {
      console.log(`${source.slug}: ${source.sheetUrl}`);
    }
    return;
  }

  if (options.command === 'apply') {
    console.log(`${result.dryRun ? 'dry-run: ' : ''}applied ${result.applied} recording index source(s) for ${result.season}`);
    for (const row of result.results || []) {
      console.log(`${row.slug}: ${row.files} files, buckets ${row.buckets.join(',')}`);
    }
    return;
  }

  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  const options = parseArgs(process.argv);
  if (options.command === 'help' || options.command === '--help' || options.command === '-h') {
    printUsage();
    return;
  }

  let result;
  if (options.command === 'init-season') {
    result = await commandInitSeason(options);
  } else if (options.command === 'discover') {
    result = await commandDiscover(options);
  } else if (options.command === 'validate') {
    result = await commandValidate(options);
  } else if (options.command === 'apply') {
    result = await commandApply(options);
  } else {
    throw new Error(`Unknown command: ${options.command}`);
  }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHuman(result, options);
  }
  if (options.command === 'validate' && result && result.ok === false) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`recording-indexes failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
