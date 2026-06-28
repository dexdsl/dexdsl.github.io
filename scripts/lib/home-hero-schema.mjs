import crypto from 'node:crypto';
import { z } from 'zod';

export const HOME_HERO_LIBRARY_VERSION = 'home-hero-library-v1';
export const HOME_HERO_SNAPSHOT_VERSION = 'home-hero-snapshot-v1';

const isoTimestamp = z.string().refine((value) => Number.isFinite(Date.parse(value)), {
  message: 'Expected an ISO timestamp',
});

const idSchema = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Expected a stable kebab-case id').max(120);
const shortText = z.string().trim().min(1).max(240);
const bodyText = z.string().trim().min(1).max(1200);

function safeHref(value) {
  const href = String(value || '').trim();
  if (href.startsWith('/') && !href.startsWith('//') && !href.includes('..')) return true;
  if (!/^https:\/\//i.test(href)) return false;
  try {
    return new URL(href).protocol === 'https:';
  } catch {
    return false;
  }
}

const hrefSchema = z.string().trim().min(1).max(1000).refine(safeHref, {
  message: 'CTA URLs must be root-relative or HTTPS',
});

const linkCtaSchema = z.object({
  kind: z.literal('link'),
  label: shortText,
  href: hrefSchema,
});

const authSwitchCtaSchema = z.object({
  kind: z.literal('auth-switch'),
  guestLabel: shortText,
  authenticatedLabel: shortText,
  authenticatedHref: hrefSchema,
});

const moduleBase = {
  id: idSchema,
  name: shortText,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
  archived: z.boolean().default(false),
};

const campaignModuleSchema = z.object({
  ...moduleBase,
  type: z.literal('campaign'),
  headlineLines: z.array(shortText).min(1).max(6),
  rotatingWords: z.array(shortText).min(1).max(40),
  body: bodyText,
  primaryCta: linkCtaSchema,
  secondaryCta: z.union([linkCtaSchema, authSwitchCtaSchema]),
});

const featuredModuleSchema = z.object({
  ...moduleBase,
  type: z.literal('featured'),
  title: shortText,
  source: z.literal('home-featured'),
});

const promoModuleSchema = z.object({
  ...moduleBase,
  type: z.literal('promo'),
  eyebrow: shortText,
  headline: shortText,
  body: bodyText,
  values: z.array(z.object({
    title: shortText,
    text: bodyText,
  })).max(6),
  stats: z.array(z.object({
    value: shortText,
    label: shortText,
  })).max(6),
  sponsor: z.object({
    label: shortText,
    name: shortText,
    image: z.string().trim().max(1000).refine((value) => (
      value.startsWith('/assets/') || safeHref(value)
    ), { message: 'Sponsor image must use /assets/ or HTTPS' }),
  }).nullable(),
  ctas: z.array(linkCtaSchema).min(1).max(2),
});

const seedReleaseSchema = z.object({
  lookup: shortText,
  name: shortText,
  role: shortText.optional(),
  href: hrefSchema,
});

const season3CtaSchema = z.object({
  label: shortText,
  href: hrefSchema.optional(),
});

const season3PresentationSchema = z.object({
  surface: z.enum(['graphite', 'paper']),
  density: z.enum(['calm', 'balanced', 'dense']),
  motion: z.enum(['cinematic', 'quiet']),
});

const season3ModuleSchema = z.object({
  ...moduleBase,
  type: z.literal('season3-human-credits'),
  kicker: shortText,
  headline: shortText,
  body: bodyText,
  assembleWord: shortText,
  pipelineLabels: z.array(shortText).length(5),
  seedReleases: z.array(seedReleaseSchema).length(4),
  cta: z.object({
    guest: season3CtaSchema,
    submit: season3CtaSchema,
    active: season3CtaSchema,
    published: season3CtaSchema,
  }),
  profileCapacity: z.number().int().min(4).max(120),
  profileFeed: z.string().trim().min(1).max(1000).refine(
    (value) => value.startsWith('/') || /^https:\/\//i.test(value),
    { message: 'profileFeed must be root-relative or HTTPS' },
  ),
  presentation: season3PresentationSchema,
});

export const heroModuleSchema = z.discriminatedUnion('type', [
  campaignModuleSchema,
  featuredModuleSchema,
  promoModuleSchema,
  season3ModuleSchema,
]);

const compositionSchema = z.object({
  id: idSchema,
  name: shortText,
  layout: z.enum(['single', 'split']),
  slots: z.array(idSchema).min(1).max(2),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
  archived: z.boolean().default(false),
});

const librarySchema = z.object({
  version: z.literal(HOME_HERO_LIBRARY_VERSION),
  activeCompositionId: idSchema,
  updatedAt: isoTimestamp,
  modules: z.array(heroModuleSchema).min(1),
  compositions: z.array(compositionSchema).min(1),
});

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function computeHomeHeroSourceHash(library) {
  return crypto.createHash('sha256').update(stableStringify(library)).digest('hex');
}

export function normalizeHomeHeroLibrary(rawValue) {
  const parsed = librarySchema.parse(rawValue);
  const moduleIds = new Set();
  for (const module of parsed.modules) {
    if (moduleIds.has(module.id)) throw new Error(`Duplicate hero module id: ${module.id}`);
    moduleIds.add(module.id);
  }

  const compositionIds = new Set();
  for (const composition of parsed.compositions) {
    if (compositionIds.has(composition.id)) throw new Error(`Duplicate hero composition id: ${composition.id}`);
    compositionIds.add(composition.id);
    const expectedSlots = composition.layout === 'split' ? 2 : 1;
    if (composition.slots.length !== expectedSlots) {
      throw new Error(`${composition.name} requires exactly ${expectedSlots} module slot${expectedSlots === 1 ? '' : 's'}`);
    }
    if (new Set(composition.slots).size !== composition.slots.length) {
      throw new Error(`${composition.name} cannot use the same module twice`);
    }
    for (const moduleId of composition.slots) {
      const module = parsed.modules.find((item) => item.id === moduleId);
      if (!module) throw new Error(`${composition.name} references missing module: ${moduleId}`);
      if (module.archived) throw new Error(`${composition.name} references archived module: ${moduleId}`);
    }
  }

  const active = parsed.compositions.find((item) => item.id === parsed.activeCompositionId);
  if (!active) throw new Error(`Active hero composition is missing: ${parsed.activeCompositionId}`);
  if (active.archived) throw new Error(`Active hero composition is archived: ${parsed.activeCompositionId}`);

  return {
    version: HOME_HERO_LIBRARY_VERSION,
    activeCompositionId: parsed.activeCompositionId,
    updatedAt: new Date(parsed.updatedAt).toISOString(),
    modules: parsed.modules.map((module) => ({
      ...module,
      createdAt: new Date(module.createdAt).toISOString(),
      updatedAt: new Date(module.updatedAt).toISOString(),
    })),
    compositions: parsed.compositions.map((composition) => ({
      ...composition,
      createdAt: new Date(composition.createdAt).toISOString(),
      updatedAt: new Date(composition.updatedAt).toISOString(),
    })),
  };
}

export function buildHomeHeroSnapshot(rawLibrary, compositionId = '') {
  const library = normalizeHomeHeroLibrary(rawLibrary);
  const selectedId = String(compositionId || library.activeCompositionId);
  const composition = library.compositions.find((item) => item.id === selectedId);
  if (!composition) throw new Error(`Hero composition not found: ${selectedId}`);
  if (composition.archived) throw new Error(`Hero composition is archived: ${selectedId}`);
  const modules = composition.slots.map((moduleId) => {
    const module = library.modules.find((item) => item.id === moduleId);
    if (!module || module.archived) throw new Error(`Unavailable hero module: ${moduleId}`);
    return module;
  });
  const preparedLibrary = selectedId === library.activeCompositionId
    ? library
    : { ...library, activeCompositionId: selectedId };
  return {
    version: HOME_HERO_SNAPSHOT_VERSION,
    generatedAt: preparedLibrary.updatedAt,
    sourceHash: computeHomeHeroSourceHash(preparedLibrary),
    activeCompositionId: selectedId,
    composition,
    modules,
  };
}

export function homeHeroLibraryJsonSchema() {
  return librarySchema;
}
