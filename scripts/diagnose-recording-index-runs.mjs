#!/usr/bin/env node
// Read-only diagnostic: dumps per-cell text-run hyperlinks from a recording-index
// Google Sheet via the Sheets API v4. Exports (xlsx/ods/gviz) collapse a cell to a
// single link, hiding the per-run audio/video links — this uses the API to reveal
// them so we can wire `dex init` to capture audio downloads correctly.
//
// Usage:
//   node scripts/diagnose-recording-index-runs.mjs <sheetId|sheetUrl> [a1Range]
// Defaults to the bassoon recording index, range A1:E40.
import { getAccessToken } from './lib/google-sa-token.mjs';

const DEFAULT_ID = '1TPhEoNoGlHYaANKdKlBvLDa4JHrpDkNwfm7EwwUwIxo';
const DEFAULT_RANGE = 'A1:E40';

function parseSheetId(arg) {
  const raw = String(arg || '').trim();
  if (!raw) return DEFAULT_ID;
  const m = raw.match(/\/spreadsheets\/d\/([^/]+)/);
  return m ? m[1] : raw;
}

const sheetId = parseSheetId(process.argv[2]);
const a1Range = String(process.argv[3] || DEFAULT_RANGE).trim();
const token = await getAccessToken();

const fields = encodeURIComponent(
  'sheets(properties(title),data(startRow,startColumn,rowData(values(formattedValue,hyperlink,textFormatRuns))))',
);
const url =
  `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}` +
  `?ranges=${encodeURIComponent(a1Range)}&includeGridData=true&fields=${fields}`;

const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
if (!res.ok) {
  console.error(`Sheets API ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const data = await res.json();
const sheet = (data.sheets || [])[0];
console.log(`sheet: ${sheet?.properties?.title || '(unknown)'}  range: ${a1Range}\n`);

const grid = (sheet?.data || [])[0] || {};
const startRow = grid.startRow || 0;
const startCol = grid.startColumn || 0;
const colLetter = (i) => String.fromCharCode(65 + i);

let multiLinkCells = 0;
let totalLinks = 0;

(grid.rowData || []).forEach((row, rIdx) => {
  (row.values || []).forEach((cell, cIdx) => {
    const text = cell.formattedValue;
    if (!text && !cell.hyperlink && !cell.textFormatRuns) return;
    const addr = `${colLetter(startCol + cIdx)}${startRow + rIdx + 1}`;

    const runs = Array.isArray(cell.textFormatRuns) ? cell.textFormatRuns : [];
    const links = [];
    if (runs.length) {
      for (let i = 0; i < runs.length; i += 1) {
        const start = runs[i].startIndex || 0;
        const end = i + 1 < runs.length ? (runs[i + 1].startIndex || 0) : String(text || '').length;
        const segment = String(text || '').slice(start, end);
        const uri = runs[i].format?.link?.uri || '';
        if (uri) links.push({ segment: segment.trim(), uri });
      }
    }
    if (!links.length && cell.hyperlink) links.push({ segment: '(whole cell)', uri: cell.hyperlink });

    if (links.length > 1) multiLinkCells += 1;
    totalLinks += links.length;

    if (links.length) {
      console.log(`${addr}  "${String(text || '').replace(/\n/g, ' ⏎ ').slice(0, 50)}"  [${links.length} link(s)]`);
      links.forEach((l) => console.log(`     • "${l.segment}"  ->  ${l.uri}`));
    }
  });
});

console.log(`\nsummary: ${totalLinks} link(s) total, ${multiLinkCells} cell(s) with >1 link`);
