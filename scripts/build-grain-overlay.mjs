#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
const ENTRY = path.join(ROOT, 'scripts', 'src', 'shared', 'dx-grain-overlay.entry.mjs');
const PUBLIC_OUT = path.join(ROOT, 'public', 'assets', 'js', 'dx-grain-overlay.js');
const MIRRORS = [
  path.join(ROOT, 'assets', 'js', 'dx-grain-overlay.js'),
  path.join(ROOT, 'docs', 'assets', 'js', 'dx-grain-overlay.js'),
];

async function main() {
  await fs.mkdir(path.dirname(PUBLIC_OUT), { recursive: true });
  await build({
    entryPoints: [ENTRY],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2019'],
    outfile: PUBLIC_OUT,
    minify: true,
    sourcemap: false,
    legalComments: 'none',
  });

  for (const mirror of MIRRORS) {
    await fs.mkdir(path.dirname(mirror), { recursive: true });
    await fs.copyFile(PUBLIC_OUT, mirror);
  }

  console.log(`grain:build wrote ${path.relative(ROOT, PUBLIC_OUT)}`);
  for (const mirror of MIRRORS) {
    console.log(`grain:build wrote ${path.relative(ROOT, mirror)}`);
  }
}

main().catch((error) => {
  console.error(`grain:build failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
