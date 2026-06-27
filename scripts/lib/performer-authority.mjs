// Performer name authority — a small, MARC/LCNAF-flavoured normaliser.
//
// The catalog has accumulated several name schemas in `performer_raw`:
//   "Andrew Chanover"            (direct order, title case)
//   "cameron church"             (direct order, lower case)
//   "mann, chris"                (already inverted)
//   "Arlo Tomecek, Max Coleman"  (multi-artist, comma as separator)
//   "paul* hermansen"            (junk glyphs)
//
// Libraries don't parse these back out of a string — they keep an authority
// record with one *authorized access point* ("Surname, Forename") plus variant
// forms. We approximate that here: produce a structured `performers` list and a
// proper-cased inverted heading, using the existing lowercased `performer_norm`
// (which already resolved person boundaries + inversion) as the structural
// source of truth, and recovering capitalization/diacritics from `performer_raw`.
//
// Pure ESM, no Node-only deps, so it bundles into the browser catalog entry and
// runs in the data-normalization script alike.

const ZWNJ = '‌';

// Name particles that stay lowercase inside a heading (van Beethoven, de la Rosa).
const LOWER_PARTICLES = new Set([
  'van', 'von', 'der', 'den', 'de', 'del', 'della', 'di', 'da', 'das', 'dos',
  'la', 'le', 'du', 'bin', 'al', "d'", 'ter', 'ten',
]);

export function cleanName(value) {
  return String(value == null ? '' : value)
    .replace(/[​-‍﻿]/g, '') // zero-width
    .replace(/[*†‡^~`]/g, '')              // editorial junk glyphs
    .replace(/\s+/g, ' ')
    .trim();
}

// Title-case a single whitespace-free token, hyphen-aware, but PRESERVE a token
// that already carries an internal capital (LeVeque, McKay, DiCarlo, Suarez-Solis)
// and any diacritics it already has.
function caseToken(token) {
  return token
    .split('-')
    .map((part) => {
      if (!part) return part;
      if (/\p{Ll}\p{Lu}/u.test(part)) return part; // internal cap → leave as authored
      const lower = part.toLocaleLowerCase();
      return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
    })
    .join('-');
}

function caseWords(value) {
  return cleanName(value)
    .split(' ')
    .filter(Boolean)
    .map((token, index) => {
      const lower = token.toLocaleLowerCase();
      if (index > 0 && LOWER_PARTICLES.has(lower)) return lower; // internal particle
      return caseToken(token);
    })
    .join(' ');
}

// Recover the authored casing of a lowercase word from the raw token list
// (so "leveque" → "LeVeque", "suarez-solis" → "Suarez-Solis"). Falls back to
// title-casing when the raw string doesn't contain the word (e.g. the norm fixed
// a spelling/diacritic: "jáquez" where raw said "Jacquez").
function recoverWords(lowerValue, rawTokens) {
  return cleanName(lowerValue)
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      const hit = rawTokens.find((t) => t.toLocaleLowerCase() === word);
      if (hit) {
        // Keep authored casing only when it carries signal — Titlecase ("Chanover")
        // or internal caps ("LeVeque", "DiCarlo"). All-lower ("ataka") or all-upper
        // ("CHURCH") raw tokens get properly title-cased instead.
        const mixed = /\p{Ll}/u.test(hit) && /\p{Lu}/u.test(hit);
        const titled = /^\p{Lu}\p{Ll}/u.test(hit);
        if (mixed || titled) return hit;
      }
      return caseWords(word);
    })
    .join(' ');
}

function splitTokens(raw) {
  return cleanName(raw).split(/[\s,]+/).filter(Boolean);
}

// Order multi-artist people by credit order — first appearance of the surname's
// head token in the raw string — so display follows how they were credited even
// though the sort key is alphabetical.
function orderByCredit(people, rawTokens) {
  const headIndex = (person) => {
    const head = (person.family.split('-')[0] || person.family).toLocaleLowerCase();
    const i = rawTokens.findIndex((t) => t.split('-')[0].toLocaleLowerCase() === head);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  return people
    .map((person, index) => ({ person, index }))
    .sort((a, b) => headIndex(a.person) - headIndex(b.person) || a.index - b.index)
    .map((x) => x.person);
}

function makePerson(family, given) {
  const fam = cleanName(family);
  const giv = cleanName(given);
  const display = giv ? `${fam}, ${giv}` : fam;
  const sort = (giv ? `${fam}, ${giv}` : fam).toLocaleLowerCase();
  return { family: fam, given: giv, display, sort };
}

// Derive the structured authority record for one entry's performer string.
// `norm` is the existing lowercased inverted form (preferred when it looks valid);
// `raw` supplies casing + credit order.
export function deriveAuthority(raw, norm) {
  const rawClean = cleanName(raw);
  const normClean = cleanName(norm).toLocaleLowerCase();
  const rawTokens = splitTokens(rawClean);

  const normPeople = normClean ? normClean.split(/\s*&\s*/).map((s) => s.trim()).filter(Boolean) : [];
  const normValid = normPeople.length > 0 && normPeople.every((p) => p.includes(','));

  let people = [];
  if (normValid) {
    people = normPeople.map((part) => {
      const [familyLower, givenLower = ''] = part.split(',').map((s) => s.trim());
      return makePerson(recoverWords(familyLower, rawTokens), recoverWords(givenLower, rawTokens));
    });
    if (people.length > 1) people = orderByCredit(people, rawTokens);
  } else {
    // No usable norm — parse the raw string. Only split on EXPLICIT multi-artist
    // separators (& ; "and" "with"); a lone comma is treated as inversion.
    const chunks = rawClean.split(/\s*(?:&|;|\band\b|\bwith\b)\s*/i).map((c) => c.trim()).filter(Boolean);
    people = chunks.map((chunk) => {
      if (chunk.includes(',')) {
        const [family, given = ''] = chunk.split(',').map((s) => s.trim());
        return makePerson(caseWords(family), caseWords(given));
      }
      const toks = chunk.split(/\s+/).filter(Boolean);
      const family = toks.pop() || chunk;
      return makePerson(caseWords(family), caseWords(toks.join(' ')));
    });
  }

  if (!people.length) {
    const fallback = caseWords(rawClean) || 'Unknown performer';
    people = [makePerson(fallback, '')];
  }

  return {
    performers: people,
    performer_display: people.map((p) => p.display).join(' & '),
    performer_norm: people.map((p) => p.sort).join(' & '),
  };
}

// Insert a zero-width non-joiner between repeated adjacent letters so the
// Stretch Pro heading face doesn't fuse them into a ligature (ee, tt, nn, mm…).
// Matches the catalog's protectedAllCaps convention, but case-insensitive and
// for arbitrary names.
export function protectName(value) {
  return String(value == null ? '' : value).replace(/(\p{L})\1/gu, `$1${ZWNJ}$1`);
}
