import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HOME_HERO_LIBRARY_VERSION,
  buildHomeHeroSnapshot,
  computeHomeHeroSourceHash,
  normalizeHomeHeroLibrary,
} from './home-hero-schema.mjs';
import { renderHomeHeroPreviewDocument } from './home-hero-render.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..', '..');

export const HOME_HERO_PATHS = {
  library: path.join(ROOT, 'data', 'home.hero-library.json'),
  snapshot: path.join(ROOT, 'data', 'home.hero.snapshot.json'),
  docsSnapshot: path.join(ROOT, 'docs', 'data', 'home.hero.snapshot.json'),
  publicSnapshot: path.join(ROOT, 'data', 'home.hero.snapshot.json'),
  previewCss: [
    path.join(ROOT, 'css', 'tokens.css'),
    path.join(ROOT, 'css', 'base.css'),
    path.join(ROOT, 'css', 'components', 'dx-controls.css'),
    path.join(ROOT, 'assets', 'css', 'dex.css'),
    path.join(ROOT, 'css', 'fonts.css'),
    path.join(ROOT, 'css', 'components', 'dx-home-hero.css'),
    path.join(ROOT, 'css', 'components', 'dx-home-hero-composer.css'),
  ],
  featuredSnapshot: path.join(ROOT, 'data', 'home.featured.snapshot.json'),
  catalogEntries: path.join(ROOT, 'data', 'catalog.entries.json'),
};

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

async function buildPreviewFontCss() {
  const [stretch, courierRegular, courierBold] = await Promise.all([
    fs.readFile(path.join(ROOT, 'assets', 'fonts', 'StretchPro.otf')),
    fs.readFile(path.join(ROOT, 'assets', 'fonts', 'courier-prime', 'CourierPrime-Regular.woff2')),
    fs.readFile(path.join(ROOT, 'assets', 'fonts', 'courier-prime', 'CourierPrime-Bold.woff2')),
  ]);
  const stretchUrl = `data:font/otf;base64,${stretch.toString('base64')}`;
  const regularUrl = `data:font/woff2;base64,${courierRegular.toString('base64')}`;
  const boldUrl = `data:font/woff2;base64,${courierBold.toString('base64')}`;
  return `
@font-face{font-family:"Stretch Pro";src:url("${stretchUrl}") format("opentype");font-style:normal;font-weight:400;font-display:swap}
@font-face{font-family:"Courier Prime";src:url("${regularUrl}") format("woff2");font-style:normal;font-weight:400;font-display:swap}
@font-face{font-family:"Courier Prime";src:url("${boldUrl}") format("woff2");font-style:normal;font-weight:700;font-display:swap}
`;
}

async function atomicWrite(filePath, text) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(temporary, text, 'utf8');
  await fs.rename(temporary, filePath);
}

async function atomicWriteJson(filePath, value) {
  await atomicWrite(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function readHomeHeroLibrary(customPath = '') {
  const filePath = customPath ? path.resolve(customPath) : HOME_HERO_PATHS.library;
  const raw = await readJson(filePath);
  if (!raw) throw new Error(`Missing hero library: ${filePath}`);
  return { filePath, library: normalizeHomeHeroLibrary(raw) };
}

export async function writeHomeHeroLibrary(rawLibrary, customPath = '') {
  const filePath = customPath ? path.resolve(customPath) : HOME_HERO_PATHS.library;
  const previous = await readJson(filePath, null);
  const candidate = {
    ...rawLibrary,
    version: HOME_HERO_LIBRARY_VERSION,
    updatedAt: new Date().toISOString(),
  };
  const library = normalizeHomeHeroLibrary(candidate);
  if (previous) {
    const previousIds = new Map((previous.modules || []).map((item) => [item.id, item.type]));
    for (const module of library.modules) {
      if (previousIds.has(module.id) && previousIds.get(module.id) !== module.type) {
        throw new Error(`Hero module type is immutable for ${module.id}`);
      }
    }
  }
  await atomicWriteJson(filePath, library);
  return { filePath, library };
}

export async function writeHomeHeroSnapshots(library, compositionId = '') {
  const snapshot = buildHomeHeroSnapshot(library, compositionId);
  const json = `${JSON.stringify(snapshot, null, 2)}\n`;
  for (const filePath of [
    HOME_HERO_PATHS.snapshot,
    HOME_HERO_PATHS.docsSnapshot,
    HOME_HERO_PATHS.publicSnapshot,
  ]) {
    await atomicWrite(filePath, json);
  }
  return snapshot;
}

export async function readHomeHeroWorkspace() {
  const { filePath, library } = await readHomeHeroLibrary();
  const snapshot = await readJson(HOME_HERO_PATHS.snapshot, null);
  const sourceHash = computeHomeHeroSourceHash(library);
  const prepared = Boolean(
    snapshot
    && snapshot.sourceHash === sourceHash
    && snapshot.activeCompositionId === library.activeCompositionId
  );
  return {
    filePath,
    library,
    snapshot,
    sourceHash,
    prepared,
    status: prepared ? 'prepared' : 'needs-preparation',
  };
}

export async function prepareHomeHero(compositionId) {
  const { library } = await readHomeHeroLibrary();
  const now = new Date().toISOString();
  const selected = library.compositions.find((item) => item.id === compositionId);
  if (!selected) throw new Error(`Hero composition not found: ${compositionId}`);
  if (selected.archived) throw new Error(`Hero composition is archived: ${compositionId}`);
  const preparedLibrary = normalizeHomeHeroLibrary({
    ...library,
    activeCompositionId: compositionId,
    updatedAt: now,
  });
  await atomicWriteJson(HOME_HERO_PATHS.library, preparedLibrary);
  const snapshot = await writeHomeHeroSnapshots(preparedLibrary, compositionId);
  return {
    library: preparedLibrary,
    snapshot,
    sourceHash: snapshot.sourceHash,
    prepared: true,
    status: 'prepared',
  };
}

export async function previewHomeHero(rawLibrary, compositionId) {
  const library = normalizeHomeHeroLibrary(rawLibrary);
  const snapshot = buildHomeHeroSnapshot({
    ...library,
    activeCompositionId: compositionId,
  }, compositionId);
  const [cssSources, fontCss, featuredData, catalogData] = await Promise.all([
    Promise.all(HOME_HERO_PATHS.previewCss.map((filePath) => fs.readFile(filePath, 'utf8'))),
    buildPreviewFontCss(),
    readJson(HOME_HERO_PATHS.featuredSnapshot, { featured: [] }),
    readJson(HOME_HERO_PATHS.catalogEntries, { entries: [] }),
  ]);
  const styles = [
    ...cssSources.map((css) => css.replace(/@font-face\s*\{[^}]*\}/g, '')),
    fontCss,
  ];
  return {
    html: renderHomeHeroPreviewDocument(snapshot, { styles, featuredData, catalogData }),
    sourceHash: snapshot.sourceHash,
  };
}
