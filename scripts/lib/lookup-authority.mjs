// Lookup-number authority — a faceted "call number" parser/validator/normaliser
// modelled on library classification practice (LCC call numbers + Cutter numbers
// + Ranganathan-style facets).
//
// A dex lookup number is a faceted classmark:
//
//     E.Gtr.  Ch     AV2024   S2
//     │  │    │      │  │     │
//     │  │    │      │  └ year (Time facet)
//     │  │    │      └ medium (A = audio, AV = audiovisual)
//     │  │    └ performer Cutter (authorized-name code, like an LC Cutter)
//     │  └ instrument abbreviation (Medium-of-Performance facet, open vocab)
//     └ family class (closed vocab — the top-level "class letter")
//                                              … S2 = season/edition (local facet)
//
// Library mapping:
//   family      ≈ LCC class letter (closed, documented set)
//   instrument  ≈ Medium of Performance (LCMPT / MARC 048) — open, format-checked
//   cutter      ≈ LC Cutter number, but derived from the *name authority* surname
//   medium+year ≈ format + date facets
//   season      ≈ local edition facet
//
// Pure ESM; bundles into the browser entry and runs in Node scripts alike.

// Closed vocabulary: the top-level family class letters. Mirrors the catalog
// "List of Symbols" instrument authority (catalog.symbols.json → instrument).
export const LOOKUP_FAMILIES = {
  V: 'Voice + Body',
  K: 'Keyboards',
  B: 'Brass',
  E: 'Electronics',
  S: 'Strings',
  W: 'Winds',
  P: 'Percussion',
  X: 'Other',
};

// Closed vocabulary: the medium-of-recording facet prefixing the year.
export const LOOKUP_MEDIA = {
  A: 'Audio',
  AV: 'Audiovisual',
};

const LOOKUP_RE = new RegExp(
  '^' +
    '([A-Za-z])' + // family class
    '\\.([A-Za-z]{1,6})' + // instrument abbreviation
    '\\.?\\s+' +
    '([A-Za-z][A-Za-z\'’-]*)' + // performer cutter
    '\\s+(AV|A)(\\d{4})' + // medium + year
    '\\s+(S\\d+)' + // season / edition
    '$',
);

function clean(value) {
  return String(value == null ? '' : value)
    .replace(/[​-‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function foldDiacritics(value) {
  return String(value == null ? '' : value).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// The canonical normalized sort/lookup key: lowercased, whitespace-collapsed.
export function normalizeLookup(raw) {
  return clean(raw).toLowerCase();
}

// Derive the performer Cutter from the structured authority — surnames sorted
// alphabetically, two ASCII letters each (Title-case), concatenated. Mirrors how
// the existing lookups encode performers (Church → "Ch", Coleman+Tomecek → "CoTo").
export function deriveCutter(performers) {
  const families = (Array.isArray(performers) ? performers : [])
    .map((p) => foldDiacritics(p && p.family).replace(/[^A-Za-z]/g, ''))
    .filter(Boolean)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  return families
    .map((s) => (s.charAt(0).toUpperCase() + (s.charAt(1) || '').toLowerCase()))
    .join('');
}

// Parse + validate one lookup number into structured facets. `options.performers`
// (the entry's authority) enables a Cutter-consistency check.
export function parseLookup(raw, options = {}) {
  const value = clean(raw);
  const issues = [];

  if (!value) {
    return { raw: '', valid: false, issues: ['empty lookup number'], norm: '' };
  }

  // Strip a non-standard submission/working prefix (e.g. "SUB01-…") but flag it.
  let body = value;
  const prefixMatch = value.match(/^([A-Za-z]+\d*)-(.+)$/);
  if (prefixMatch && !LOOKUP_RE.test(value)) {
    body = prefixMatch[2];
    issues.push(`non-standard prefix "${prefixMatch[1]}-"`);
  }

  const m = LOOKUP_RE.exec(body);
  if (!m) {
    return {
      raw: value,
      valid: false,
      issues: [...issues, 'does not match grammar "Family.Instrument. Cutter (A|AV)YYYY S#"'],
      norm: normalizeLookup(value),
    };
  }

  const [, familyRaw, instrument, cutter, medium, yearStr, season] = m;
  const family = familyRaw.toUpperCase();

  if (!(family in LOOKUP_FAMILIES)) issues.push(`family "${family}" not in controlled vocabulary`);
  if (!(medium in LOOKUP_MEDIA)) issues.push(`medium "${medium}" not in controlled vocabulary`);
  const year = Number(yearStr);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) issues.push(`year "${yearStr}" out of range`);

  const expectedCutter = deriveCutter(options.performers);
  const cutterMatches = !expectedCutter || expectedCutter.toLowerCase() === cutter.toLowerCase();
  if (expectedCutter && !cutterMatches) {
    issues.push(`cutter "${cutter}" ≠ authority-derived "${expectedCutter}"`);
  }

  return {
    raw: value,
    family,
    familyLabel: LOOKUP_FAMILIES[family] || '',
    instrument,
    cutter,
    expectedCutter,
    cutterMatches,
    medium,
    mediumLabel: LOOKUP_MEDIA[medium] || '',
    year,
    season,
    norm: normalizeLookup(value),
    valid: issues.length === 0,
    issues,
  };
}
