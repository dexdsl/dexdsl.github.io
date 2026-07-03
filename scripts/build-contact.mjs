#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');

const entry = path.join(ROOT, 'scripts', 'src', 'contact.entry.mjs');
const docsOut = path.join(ROOT, 'docs', 'assets', 'js', 'contact.js');
const mirrors = [
  path.join(ROOT, 'assets', 'js', 'contact.js'),
];

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function copyFile(source, target) {
  await ensureDir(target);
  await fs.copyFile(source, target);
}

async function main() {
  await ensureDir(docsOut);

  await build({
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2019'],
    outfile: docsOut,
    minify: true,
    sourcemap: false,
    legalComments: 'none',
  });

  for (const mirror of mirrors) {
    await copyFile(docsOut, mirror);
  }

  console.log(`contact:build wrote ${path.relative(ROOT, docsOut)}`);
  for (const mirror of mirrors) {
    console.log(`contact:build wrote ${path.relative(ROOT, mirror)}`);
  }
}

main().catch((error) => {
  console.error(`contact:build failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
