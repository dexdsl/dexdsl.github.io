function text(value, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function listValue(value) {
  if (!Array.isArray(value)) return '';
  return value.map((item) => text(item)).find(Boolean) || '';
}

function canonicalArchiveHref(value) {
  const href = text(value);
  if (!/^\/(?:entry|uav)\/[a-z0-9][a-z0-9-]*\/?$/i.test(href)) return '';
  return href.endsWith('/') ? href : `${href}/`;
}

function safeImageSrc(value) {
  const src = text(value);
  if (src.startsWith('/')) return src;
  if (/^https:\/\//i.test(src)) return src;
  return '';
}

export function normalizeDonationShowcaseEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  if (text(entry.status, 'active').toLowerCase() !== 'active') return null;

  const href = canonicalArchiveHref(entry.entry_href);
  const imageSrc = safeImageSrc(entry.image_src);
  const title = text(entry.title_raw || entry.title);
  const performer = text(entry.performer_raw || entry.performer);
  const lookup = text(entry.lookup_raw || entry.lookup_number || entry.lookup);
  const instrument = text(
    listValue(entry.instrument_labels)
    || listValue(entry.instrument_family)
    || entry.instrument,
    title,
  );

  if (!href || !imageSrc || !title || !performer || !lookup) return null;

  return {
    id: text(entry.id || entry.entry_id, href),
    title,
    performer,
    lookup,
    season: text(entry.season, 'OPEN ARCHIVE'),
    instrument,
    href,
    imageSrc,
    imageAlt: text(entry.image_alt_raw, `${performer} — ${title}`),
    kind: text(entry.kind, href.startsWith('/uav/') ? 'uav' : 'catalog').toLowerCase(),
  };
}

function shuffled(entries, random) {
  const output = entries.slice();
  for (let index = output.length - 1; index > 0; index -= 1) {
    const unit = Number(random());
    const safeUnit = Number.isFinite(unit) ? Math.min(0.999999999, Math.max(0, unit)) : 0;
    const swapIndex = Math.floor(safeUnit * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
}

function diversityScore(candidate, selected) {
  if (!selected.length) return 0;
  let score = 0;
  if (selected.every((entry) => entry.performer.toLowerCase() !== candidate.performer.toLowerCase())) score += 8;
  if (selected.every((entry) => entry.instrument.toLowerCase() !== candidate.instrument.toLowerCase())) score += 5;
  if (selected.every((entry) => entry.season.toLowerCase() !== candidate.season.toLowerCase())) score += 2;
  if (selected.every((entry) => entry.kind !== candidate.kind)) score += 1;
  return score;
}

export function selectDonationShowcaseEntries(
  payload,
  {
    count = 3,
    random = Math.random,
  } = {},
) {
  const source = Array.isArray(payload) ? payload : Array.isArray(payload?.entries) ? payload.entries : [];
  const wanted = Math.max(0, Math.min(12, Number.isFinite(Number(count)) ? Math.floor(Number(count)) : 3));
  const normalized = source
    .map((entry) => normalizeDonationShowcaseEntry(entry))
    .filter(Boolean);

  const unique = [];
  const seen = new Set();
  normalized.forEach((entry) => {
    if (seen.has(entry.id) || seen.has(entry.href)) return;
    seen.add(entry.id);
    seen.add(entry.href);
    unique.push(entry);
  });

  const pool = shuffled(unique, typeof random === 'function' ? random : Math.random);
  const selected = [];
  while (selected.length < wanted && pool.length) {
    let bestIndex = 0;
    let bestScore = -1;
    pool.forEach((candidate, index) => {
      const score = diversityScore(candidate, selected);
      if (score > bestScore) {
        bestIndex = index;
        bestScore = score;
      }
    });
    selected.push(pool.splice(bestIndex, 1)[0]);
  }

  return selected;
}
