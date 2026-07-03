#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const failures = [];

const pkg = JSON.parse(read('package.json'));
if (pkg.dependencies?.['@paper-design/shaders'] !== '0.0.76') {
  failures.push('@paper-design/shaders must be pinned exactly to 0.0.76');
}
if (pkg.dependencies?.['@paper-design/shaders-react']) {
  failures.push('grain-only runtime must not ship the high-level GrainGradient React package');
}

const source = read('scripts/src/shared/dx-grain-overlay.entry.mjs');
for (const marker of [
  'grainGradientFragmentShader.slice(0, mainIndex)',
  'float paperPerturb =',
  'fragColor = vec4(mixedColor * coverage, coverage);',
  'function syncGooeyGrainMesh(',
  'activeMount.mount.setUniforms({',
  'u_blobGeometry: geometry,',
  'function buildConservedColorUniforms(',
  'const donorShare =',
  'coverage = 1. - (1. - coverage) * (1. - blob.a);',
  'window.__dxSyncGooeyGrainMesh = syncGooeyGrainMesh;',
  'u_blobG1A:',
  'new ShaderMount(',
  'powerPreference: \'low-power\'',
  'webglcontextlost',
  'connection?.saveData === true',
]) {
  if (!source.includes(marker)) failures.push(`grain source missing marker: ${marker}`);
}
if (source.includes('<GrainGradient') || source.includes('new GrainGradient')) {
  failures.push('grain source must not render the GrainGradient shape/color component');
}

const slot = read('docs/assets/js/header-slot.js');
for (const marker of [
  "const GOOEY_GRAIN_RUNTIME_SRC = '/assets/js/dx-grain-overlay.js?v=20260702shader2';",
  'function ensureGooeyGrainOverlay()',
  'window.__dxMountGooeyGrain',
  'window.__dxSyncGooeyGrainMesh(gooeyDriverWrapper, gooeyDriverBlobs);',
  '#dx-gooey-grain-overlay',
  'mix-blend-mode: normal',
  '#gooey-mesh-wrapper[data-dx-grain="ready"] .gooey-stage',
]) {
  if (!slot.includes(marker)) failures.push(`header-slot missing grain marker: ${marker}`);
}

const bundles = [
  'docs/assets/js/dx-grain-overlay.js',
  'assets/js/dx-grain-overlay.js',
  'docs/assets/js/dx-grain-overlay.js',
].map((relativePath) => ({ relativePath, content: read(relativePath) }));
if (!bundles[0].content) failures.push('grain bundle is empty');
for (const bundle of bundles.slice(1)) {
  if (bundle.content !== bundles[0].content) {
    failures.push(`${bundle.relativePath} does not match public grain bundle`);
  }
}
if (/\bfetch\s*\(/.test(bundles[0].content)) {
  failures.push('grain bundle must not make network requests');
}

const notices = read('THIRD_PARTY_NOTICES.md');
for (const marker of ['@paper-design/shaders 0.0.76', 'PolyForm Shield License 1.0.0']) {
  if (!notices.includes(marker)) failures.push(`third-party notices missing marker: ${marker}`);
}

if (failures.length) {
  console.error(`verify:grain-overlay failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('verify:grain-overlay passed.');
