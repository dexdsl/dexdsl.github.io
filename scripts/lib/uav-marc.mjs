import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { UAV_CAPTURE_CLASSES } from './uav-lookup-authority.mjs';

const NS = 'http://www.loc.gov/MARC21/slim';
const SCHEMA = 'http://www.loc.gov/standards/marcxml/schema/MARC21slim.xsd';
const execFileAsync = promisify(execFile);

function text(value) {
  return String(value ?? '').trim();
}

function xml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function controlfield(tag, value) {
  return `    <controlfield tag="${tag}">${xml(value)}</controlfield>`;
}

function datafield(tag, ind1, ind2, subfields) {
  const body = subfields
    .filter(([, value]) => text(value))
    .map(([code, value]) => `      <subfield code="${code}">${xml(value)}</subfield>`)
    .join('\n');
  return `    <datafield tag="${tag}" ind1="${ind1}" ind2="${ind2}">\n${body}\n    </datafield>`;
}

function dateFor033(value) {
  return text(value).replace(/-/g, '').slice(0, 8);
}

function remoteSensing007(series) {
  // r/u/#/b/u/u/b/b/b + data type (visible, near IR, thermal IR, combination).
  const dataType = { RGB: 'aa', IR: 'da', TH: 'dd', FS: 'dv' }[series.spectrum] || 'uu';
  return `ru#buubbb${dataType}`;
}

function contentTerm(captureClass) {
  return {
    V: 'two-dimensional moving image',
    I: 'still image',
    A: 'sounds',
    D: 'text',
  }[captureClass] || 'other';
}

export function generateUavMarcXml(collection, manifest, authorities) {
  const site = authorities.sites.find((row) => row.id === collection.siteAuthorityId);
  const subjects = collection.subjectAuthorityIds
    .map((id) => authorities.subjects.find((row) => row.id === id))
    .filter(Boolean);
  const groups = Array.isArray(manifest?.groups) ? manifest.groups : [];
  const files = groups.flatMap((group) => (group.buckets || []).flatMap((bucket) => bucket.files || []))
    .filter((file) => !file.missing);
  const controlFields = [
    controlfield('001', `dex-uav-${collection.slug}`),
    controlfield('003', 'DexDSL'),
    controlfield('005', new Date(collection.lifecycle.updatedAt).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '.0')),
  ];
  const dataFields = [
    datafield('099', ' ', ' ', [['a', collection.lookupRaw]]),
    datafield('245', '0', '0', [['a', collection.title]]),
    datafield('264', ' ', '1', [['a', 'United States'], ['b', 'Dex Digital Sample Library'], ['c', String(collection.identity.year)]]),
    datafield('300', ' ', ' ', [['a', `${collection.series.length} capture series (${files.length} digital files)`]]),
  ];

  for (const series of collection.series) {
    if (series.captureClass === 'A') controlFields.push(controlfield('007', 'sr||||||||||||'));
    else controlFields.push(controlfield('007', remoteSensing007(series)));
    dataFields.push(datafield('336', ' ', ' ', [
      ['a', contentTerm(series.captureClass)],
      ['2', 'rdacontent'],
      ['3', series.lookupRaw],
    ]));
  }
  dataFields.push(datafield('337', ' ', ' ', [['a', 'computer'], ['2', 'rdamedia']]));
  dataFields.push(datafield('338', ' ', ' ', [['a', 'online resource'], ['2', 'rdacarrier']]));

  const uniqueDigital = new Map();
  for (const file of files) {
    const extension = text(file.originalName).split('.').pop()?.toUpperCase() || '';
    const key = `${file.mime}|${extension}|${file.technical?.width || ''}|${file.technical?.height || ''}`;
    if (!uniqueDigital.has(key)) uniqueDigital.set(key, file);
  }
  for (const file of uniqueDigital.values()) {
    const resolution = file.technical?.width && file.technical?.height
      ? `${file.technical.width} x ${file.technical.height} pixels`
      : '';
    dataFields.push(datafield('347', ' ', ' ', [
      ['a', file.mime?.startsWith('video/') ? 'video file' : file.mime?.startsWith('audio/') ? 'audio file' : file.mime?.startsWith('image/') ? 'image file' : 'data file'],
      ['b', text(file.originalName).split('.').pop()?.toUpperCase() || ''],
      ['c', file.sizeBytes ? `${file.sizeBytes} bytes` : ''],
      ['d', resolution],
      ['3', file.bucketNumber],
      ['2', 'rdaft'],
    ]));
  }

  const from = collection.capturedFrom || collection.series.find((row) => row.capturedFrom)?.capturedFrom;
  const to = collection.capturedTo || collection.series.find((row) => row.capturedTo)?.capturedTo;
  if (from) {
    dataFields.push(datafield('033', to && to !== from ? '2' : '0', '0', [
      ['a', dateFor033(from)],
      ...(to && to !== from ? [['a', dateFor033(to)]] : []),
      ['p', site?.name || ''],
      ['1', site?.authority?.uri || ''],
    ]));
  }
  if (site?.publicCoordinates) {
    const { lat, lon } = site.publicCoordinates;
    dataFields.push(datafield('034', '0', ' ', [
      ['d', String(lon)],
      ['e', String(lon)],
      ['f', String(lat)],
      ['g', String(lat)],
      ['1', site.authority?.uri || ''],
      ['3', 'Place of capture'],
    ]));
  }
  if (from || site?.name) {
    dataFields.push(datafield('518', ' ', ' ', [
      ['o', 'Captured'],
      ['d', [from, to && to !== from ? to : ''].filter(Boolean).join(' to ')],
      ['p', site?.name || ''],
      ['1', site?.authority?.uri || ''],
    ]));
  }
  if (collection.description) dataFields.push(datafield('520', ' ', ' ', [['a', collection.description]]));
  if (collection.operators.length || collection.contributors.length) {
    dataFields.push(datafield('508', ' ', ' ', [[
      'a',
      [
        collection.operators.length ? `UAV operators: ${collection.operators.join(', ')}` : '',
        collection.contributors.length ? `Contributors: ${collection.contributors.join(', ')}` : '',
      ].filter(Boolean).join('; '),
    ]]));
  }
  dataFields.push(datafield('540', ' ', ' ', [['a', collection.attribution], ['u', `https://creativecommons.org/licenses/by/4.0/`]]));

  for (const subject of subjects) {
    dataFields.push(datafield('650', ' ', subject.authority.source === 'lcsh' ? '0' : '7', [
      ['a', subject.authority.label || subject.label],
      ['1', subject.authority.uri],
      ...(subject.authority.source === 'lcsh' ? [] : [['2', subject.authority.source]]),
    ]));
  }
  if (site) {
    dataFields.push(datafield('651', ' ', site.authority.source === 'lcnaf' ? '0' : '7', [
      ['a', site.authority.label || site.name],
      ['1', site.authority.uri],
      ...(site.authority.source === 'lcnaf' ? [] : [['2', site.authority.source]]),
    ]));
  }
  for (const series of collection.series) {
    dataFields.push(datafield('655', ' ', '7', [
      ['a', UAV_CAPTURE_CLASSES[series.captureClass]],
      ['2', 'local'],
      ['3', series.lookupRaw],
    ]));
  }
  dataFields.push(datafield('856', '4', '0', [
    ['u', `https://dexdsl.org/uav/${collection.slug}/`],
    ['y', 'Open dexDRONES collection'],
  ]));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<record xmlns="${NS}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="${NS} ${SCHEMA}">`,
    '    <leader>00000npc a2200000 i 4500</leader>',
    ...controlFields,
    ...dataFields,
    '</record>',
    '',
  ].join('\n');
}

export function verifyUavMarcXml(marcXml) {
  const issues = [];
  const source = String(marcXml || '');
  if (!source.startsWith('<?xml version="1.0"')) issues.push('missing XML declaration');
  if (!source.includes(`<record xmlns="${NS}"`)) issues.push('missing MARC21 slim namespace');
  const leader = source.match(/<leader>([^<]+)<\/leader>/)?.[1] || '';
  if (leader.length !== 24) issues.push('MARC leader must contain 24 characters');
  for (const tag of ['001', '245', '540', '651', '856']) {
    if (!source.includes(`tag="${tag}"`)) issues.push(`missing MARC field ${tag}`);
  }
  return { ok: issues.length === 0, issues };
}

export async function validateUavMarcXmlSchema(marcXml, schemaPath) {
  const xsdPath = path.resolve(schemaPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dex-uav-marc-'));
  const recordPath = path.join(tempDir, 'record.xml');
  try {
    await fs.writeFile(recordPath, String(marcXml || ''), 'utf8');
    await execFileAsync('xmllint', ['--noout', '--schema', xsdPath, recordPath], {
      maxBuffer: 2 * 1024 * 1024,
    });
    return { ok: true, schemaPath: xsdPath, issues: [] };
  } catch (error) {
    const detail = String(error?.stderr || error?.message || error).trim();
    return { ok: false, schemaPath: xsdPath, issues: [detail || 'MARCXML schema validation failed'] };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
