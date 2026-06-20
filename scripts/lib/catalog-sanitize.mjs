// Shared catalog data hygiene used by extraction (extract_catalog_data.mjs) and the
// one-off cleanup (clean-catalog-data.mjs).
//
// Invisible directional / formatting marks (U+200E LRM, U+200F RLM, embeddings/overrides,
// isolates, ZWSP, BOM) get scraped from the live catalog HTML into performer names and
// break identity grouping (e.g. "man‎‏n, chris"). We strip those.
//
// IMPORTANT: U+200C (ZWNJ) and U+200D (ZWJ) are intentional Stretch Pro heading separators
// in TITLE fields, so they are deliberately preserved.
const INVISIBLE_MARKS_RE = /[​‎‏‪-‮⁠⁦-⁩﻿]/g;

// Entry ids that are dev-stub placeholders (never populated with production data) and should
// be excluded from the catalog. Deletions made here survive a live re-extraction.
export const EXCLUDED_ENTRY_IDS = new Set([
  'splinterings-jakob-heinemann',
  'sebastian-suarez-solis',
]);

// Performer-name corrections applied to the scraped catalog. Keys are the (lowercase)
// name as it appears in the live source; values are the desired catalog form. Each name
// is distinctive enough that a plain substring replacement is safe (it also reaches the
// concatenated search_blob field, not just performer_raw/performer_norm).
export const PERFORMER_ALIASES = new Map([
  ['sebastian suarez-solis', 'suarez-solis, sebastian'],
]);

export function stripInvisibleMarks(value) {
  return typeof value === 'string' ? value.replace(INVISIBLE_MARKS_RE, '') : value;
}

export function applyPerformerAliases(value, aliases = PERFORMER_ALIASES) {
  if (typeof value === 'string') {
    let out = value;
    for (const [from, to] of aliases) {
      if (out.includes(from)) out = out.split(from).join(to);
    }
    return out;
  }
  if (Array.isArray(value)) return value.map((item) => applyPerformerAliases(item, aliases));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = applyPerformerAliases(item, aliases);
    return out;
  }
  return value;
}

// Deep-clean every string in an arbitrary JSON value, stripping invisible marks.
export function deepStripInvisibleMarks(value) {
  if (typeof value === 'string') return stripInvisibleMarks(value);
  if (Array.isArray(value)) return value.map(deepStripInvisibleMarks);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = deepStripInvisibleMarks(item);
    return out;
  }
  return value;
}

function entryIdsOf(item) {
  if (!item || typeof item !== 'object') return [];
  const ids = [];
  for (const key of ['id', 'entry_id', 'entryId', 'slug']) {
    if (typeof item[key] === 'string' && item[key].trim()) ids.push(item[key].trim());
  }
  for (const key of ['entry_href', 'href', 'entryHref', 'url']) {
    const raw = typeof item[key] === 'string' ? item[key].trim() : '';
    const m = raw.match(/\/entry\/([^/?#]+)/);
    if (m) ids.push(m[1]);
  }
  return ids;
}

export function isExcludedEntry(item, excluded = EXCLUDED_ENTRY_IDS) {
  return entryIdsOf(item).some((id) => excluded.has(id));
}

// Remove excluded entries from any array-of-entries found within the JSON tree.
export function removeExcludedEntries(value, excluded = EXCLUDED_ENTRY_IDS) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => !isExcludedEntry(item, excluded))
      .map((item) => removeExcludedEntries(item, excluded));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = removeExcludedEntries(item, excluded);
    return out;
  }
  return value;
}

// One call: strip invisible marks + apply performer aliases + drop dev-stub entries.
export function sanitizeCatalogJson(value, excluded = EXCLUDED_ENTRY_IDS) {
  return removeExcludedEntries(applyPerformerAliases(deepStripInvisibleMarks(value)), excluded);
}
