#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
const entry = path.join(ROOT, 'scripts', 'src', 'not-found.entry.mjs');
const publicOut = path.join(ROOT, 'public', 'assets', 'js', 'not-found.js');
const mirrors = [
  path.join(ROOT, 'assets', 'js', 'not-found.js'),
  path.join(ROOT, 'docs', 'assets', 'js', 'not-found.js'),
];

async function copyFile(source, target) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}

async function main() {
  await fs.mkdir(path.dirname(publicOut), { recursive: true });
  await build({
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2019'],
    outfile: publicOut,
    minify: true,
    sourcemap: false,
    legalComments: 'none',
  });
  for (const mirror of mirrors) await copyFile(publicOut, mirror);
  console.log('not-found:build wrote public and runtime mirrors');
}

main().catch((error) => {
  console.error(`not-found:build failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
