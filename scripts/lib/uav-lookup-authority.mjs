// dexDRONES identifier authority.
//
// Collection: DR.Win. Mo 2026 T1
// Series:     DR.Win. Mo V2026 T1 [FS]
// Item:       DR.Win. Mo V2026 T1 [FS] V.1
// Raw item:   DR.Win. Mo V2026 T1 [FS] X.1

export const UAV_CAPTURE_CLASSES = Object.freeze({
  V: 'Aerial video',
  I: 'Field stills',
  A: 'Ambient sound',
  D: 'Imaging study',
});

export const UAV_SPECTRA = Object.freeze({
  FS: 'Full-spectrum',
  RGB: 'Visible light',
  IR: 'Infrared',
  TH: 'Thermal',
});

export const UAV_RAW_BUCKET = 'X';
export const UAV_BUCKETS = Object.freeze([...Object.keys(UAV_CAPTURE_CLASSES), UAV_RAW_BUCKET]);

const SUBJECT_RE = /^[A-Z][a-z]{2}$/;
const CUTTER_RE = /^[A-Z][a-z]$/;
const TOUR_RE = /^T[1-9]\d*$/;
const ITEM_NUMBER_RE = /^[1-9]\d{0,5}$/;

function clean(value) {
  return String(value ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalSubject(value) {
  const raw = clean(value);
  return raw ? `${raw.charAt(0).toUpperCase()}${raw.slice(1).toLowerCase()}` : '';
}

function canonicalCutter(value) {
  const raw = clean(value);
  return raw ? `${raw.charAt(0).toUpperCase()}${raw.slice(1).toLowerCase()}` : '';
}

function canonicalTour(value) {
  return clean(value).toUpperCase();
}

export function normalizeUavLookup(value) {
  return clean(value).toLowerCase();
}

export function formatUavCollectionLookup({ subjectCode, siteCutter, year, tour }) {
  const subject = canonicalSubject(subjectCode);
  const cutter = canonicalCutter(siteCutter);
  const tourCode = canonicalTour(tour);
  const numericYear = Number(year);
  if (!SUBJECT_RE.test(subject)) throw new Error(`Invalid UAV subject code: ${subjectCode}`);
  if (!CUTTER_RE.test(cutter)) throw new Error(`Invalid UAV site Cutter: ${siteCutter}`);
  if (!Number.isInteger(numericYear) || numericYear < 2000 || numericYear > 2100) {
    throw new Error(`Invalid UAV year: ${year}`);
  }
  if (!TOUR_RE.test(tourCode)) throw new Error(`Invalid UAV tour: ${tour}`);
  return `DR.${subject}. ${cutter} ${numericYear} ${tourCode}`;
}

export function formatUavSeriesLookup({
  subjectCode,
  siteCutter,
  captureClass,
  year,
  tour,
  spectrum,
}) {
  const collection = formatUavCollectionLookup({ subjectCode, siteCutter, year, tour });
  const klass = clean(captureClass).toUpperCase();
  const spectralCode = clean(spectrum).toUpperCase();
  if (!(klass in UAV_CAPTURE_CLASSES)) throw new Error(`Invalid UAV capture class: ${captureClass}`);
  if (klass === 'A' && spectralCode) throw new Error('Ambient-sound UAV series must omit spectrum');
  if (klass !== 'A' && !(spectralCode in UAV_SPECTRA)) {
    throw new Error(`${klass} UAV series requires one of ${Object.keys(UAV_SPECTRA).join(', ')}`);
  }
  const prefix = collection.replace(` ${Number(year)} `, ` ${klass}${Number(year)} `);
  return spectralCode ? `${prefix} [${spectralCode}]` : prefix;
}

export function formatUavItemLookup(series, bucket, number) {
  const parsedSeries = typeof series === 'string' ? parseUavLookup(series) : series;
  if (!parsedSeries?.valid || parsedSeries.level !== 'series') {
    throw new Error('A valid UAV series lookup is required to format an item');
  }
  const bucketCode = clean(bucket).toUpperCase();
  const itemNumber = clean(number);
  if (bucketCode !== parsedSeries.captureClass && bucketCode !== UAV_RAW_BUCKET) {
    throw new Error(`Series ${parsedSeries.captureClass} accepts only ${parsedSeries.captureClass} or X items`);
  }
  if (!ITEM_NUMBER_RE.test(itemNumber)) throw new Error(`Invalid UAV item number: ${number}`);
  return `${parsedSeries.raw} ${bucketCode}.${Number(itemNumber)}`;
}

export function parseUavLookup(rawValue) {
  const raw = clean(rawValue);
  const invalid = (issues) => ({
    raw,
    norm: normalizeUavLookup(raw),
    valid: false,
    issues: Array.isArray(issues) ? issues : [issues],
  });
  if (!raw) return invalid('empty UAV lookup');

  const collectionMatch = raw.match(/^DR\.([A-Za-z]{3})\.\s+([A-Za-z]{2})\s+(\d{4})\s+(T\d+)$/i);
  if (collectionMatch) {
    const [, subjectRaw, cutterRaw, yearRaw, tourRaw] = collectionMatch;
    const subjectCode = canonicalSubject(subjectRaw);
    const siteCutter = canonicalCutter(cutterRaw);
    const tour = canonicalTour(tourRaw);
    const issues = [];
    if (!SUBJECT_RE.test(subjectCode)) issues.push(`subject code "${subjectRaw}" must be three Title-case letters`);
    if (!CUTTER_RE.test(siteCutter)) issues.push(`site Cutter "${cutterRaw}" must be two Title-case letters`);
    if (!TOUR_RE.test(tour)) issues.push(`tour "${tourRaw}" must match T#`);
    const year = Number(yearRaw);
    if (year < 2000 || year > 2100) issues.push(`year "${yearRaw}" out of range`);
    const canonical = issues.length ? raw : formatUavCollectionLookup({ subjectCode, siteCutter, year, tour });
    if (!issues.length && canonical !== raw) issues.push(`non-canonical form; expected "${canonical}"`);
    return {
      raw,
      norm: normalizeUavLookup(raw),
      level: 'collection',
      wing: 'DR',
      subjectCode,
      siteCutter,
      year,
      tour,
      valid: issues.length === 0,
      issues,
    };
  }

  const itemMatch = raw.match(
    /^DR\.([A-Za-z]{3})\.\s+([A-Za-z]{2})\s+([VIAD])(\d{4})\s+(T\d+)(?:\s+\[(FS|RGB|IR|TH)\])?\s+([VIADX])\.([1-9]\d{0,5})$/i,
  );
  const seriesMatch = raw.match(
    /^DR\.([A-Za-z]{3})\.\s+([A-Za-z]{2})\s+([VIAD])(\d{4})\s+(T\d+)(?:\s+\[(FS|RGB|IR|TH)\])?$/i,
  );
  const match = itemMatch || seriesMatch;
  if (!match) {
    return invalid('does not match UAV collection, capture-series, or item grammar');
  }

  const [, subjectRaw, cutterRaw, classRaw, yearRaw, tourRaw, spectrumRaw] = match;
  const subjectCode = canonicalSubject(subjectRaw);
  const siteCutter = canonicalCutter(cutterRaw);
  const captureClass = classRaw.toUpperCase();
  const spectrum = String(spectrumRaw || '').toUpperCase();
  const tour = canonicalTour(tourRaw);
  const year = Number(yearRaw);
  const issues = [];
  if (!SUBJECT_RE.test(subjectCode)) issues.push(`subject code "${subjectRaw}" must be three Title-case letters`);
  if (!CUTTER_RE.test(siteCutter)) issues.push(`site Cutter "${cutterRaw}" must be two Title-case letters`);
  if (!(captureClass in UAV_CAPTURE_CLASSES)) issues.push(`capture class "${classRaw}" is not controlled`);
  if (captureClass === 'A' && spectrum) issues.push('ambient-sound series must omit spectrum');
  if (captureClass !== 'A' && !(spectrum in UAV_SPECTRA)) {
    issues.push(`${captureClass} series requires one of ${Object.keys(UAV_SPECTRA).join(', ')}`);
  }
  if (!TOUR_RE.test(tour)) issues.push(`tour "${tourRaw}" must match T#`);
  if (year < 2000 || year > 2100) issues.push(`year "${yearRaw}" out of range`);

  const base = {
    subjectCode,
    siteCutter,
    captureClass,
    year,
    tour,
    spectrum,
  };
  const canonicalSeries = issues.length ? '' : formatUavSeriesLookup(base);
  if (itemMatch) {
    const bucket = itemMatch[7].toUpperCase();
    const number = Number(itemMatch[8]);
    if (bucket !== captureClass && bucket !== UAV_RAW_BUCKET) {
      issues.push(`${captureClass} series accepts only ${captureClass} or X items`);
    }
    const canonical = issues.length ? raw : `${canonicalSeries} ${bucket}.${number}`;
    if (!issues.length && canonical !== raw) issues.push(`non-canonical form; expected "${canonical}"`);
    return {
      raw,
      norm: normalizeUavLookup(raw),
      level: 'item',
      wing: 'DR',
      ...base,
      bucket,
      number,
      seriesLookup: canonicalSeries,
      collectionLookup: formatUavCollectionLookup(base),
      valid: issues.length === 0,
      issues,
    };
  }

  if (!issues.length && canonicalSeries !== raw) issues.push(`non-canonical form; expected "${canonicalSeries}"`);
  return {
    raw,
    norm: normalizeUavLookup(raw),
    level: 'series',
    wing: 'DR',
    ...base,
    collectionLookup: issues.length ? '' : formatUavCollectionLookup(base),
    valid: issues.length === 0,
    issues,
  };
}

export function assertUavLookup(raw, expectedLevel) {
  const parsed = parseUavLookup(raw);
  if (!parsed.valid) throw new Error(`${raw || '(empty)'}: ${parsed.issues.join('; ')}`);
  if (expectedLevel && parsed.level !== expectedLevel) {
    throw new Error(`${raw}: expected ${expectedLevel} lookup, received ${parsed.level}`);
  }
  return parsed;
}

