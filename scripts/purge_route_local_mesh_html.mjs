#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  hasRouteLocalMeshOwnership,
  normalizeShaderRuntimeHtml,
  stripRouteLocalMeshHtml,
} from './lib/route-local-mesh-html.mjs';

const ROOT = process.cwd();
const CHECK_ONLY = process.argv.includes('--check');
const SURFACE_ROOTS = ['docs', 'entries', 'entry-template', 'polls', 'tim-feeney'];

function listHtmlFiles(dirPath, out = []) {
  if (!fs.existsSync(dirPath)) return out;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) listHtmlFiles(absolutePath, out);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) out.push(absolutePath);
  }
  return out;
}

function main() {
  const files = SURFACE_ROOTS.flatMap((relativeRoot) => listHtmlFiles(path.join(ROOT, relativeRoot)));
  const failures = [];
  let updated = 0;

  for (const filePath of files) {
    const relativePath = path.relative(ROOT, filePath);
    const html = fs.readFileSync(filePath, 'utf8');
    const preserveBackdropMarkup = relativePath === path.join('docs', 'index.html');
    const next = normalizeShaderRuntimeHtml(
      stripRouteLocalMeshHtml(html, { preserveBackdropMarkup }),
    );

    if (hasRouteLocalMeshOwnership(next)) {
      failures.push(`${relativePath}: route-local mesh style or runtime remains`);
    }
    if (!preserveBackdropMarkup && /\bid=(["'])(?:scroll-gradient-bg|gooey-mesh-wrapper)\1/i.test(next)) {
      failures.push(`${relativePath}: route-local backdrop markup remains`);
    }
    if (next === html) continue;

    updated += 1;
    if (!CHECK_ONLY) fs.writeFileSync(filePath, next, 'utf8');
  }

  if (failures.length) {
    for (const failure of failures) console.error(`route-mesh: ${failure}`);
    process.exit(1);
  }
  if (CHECK_ONLY && updated) {
    console.error(`route-mesh: ${updated} HTML file(s) require cleanup`);
    process.exit(1);
  }

  console.log(`route-mesh: ${CHECK_ONLY ? 'verified' : 'cleaned'} ${files.length} HTML files (${updated} changed)`);
}

main();
