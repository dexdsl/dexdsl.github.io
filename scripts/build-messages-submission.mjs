#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');

const BUILD_TARGET = {
  entry: path.join(ROOT, 'scripts', 'src', 'messages.submission.entry.mjs'),
  docsOut: path.join(ROOT, 'docs', 'assets', 'js', 'messages.submission.js'),
  mirrors: [
    path.join(ROOT, 'assets', 'js', 'messages.submission.js'),
  ],
};

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function copyFile(source, target) {
  await ensureDir(target);
  await fs.copyFile(source, target);
}

async function main() {
  await ensureDir(BUILD_TARGET.docsOut);
  await build({
    entryPoints: [BUILD_TARGET.entry],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2019'],
    outfile: BUILD_TARGET.docsOut,
    minify: true,
    sourcemap: false,
    legalComments: 'none',
  });

  for (const mirror of BUILD_TARGET.mirrors) {
    await copyFile(BUILD_TARGET.docsOut, mirror);
  }

  console.log(`messages:submission:build wrote ${path.relative(ROOT, BUILD_TARGET.docsOut)}`);
  for (const mirror of BUILD_TARGET.mirrors) {
    console.log(`messages:submission:build wrote ${path.relative(ROOT, mirror)}`);
  }
}

main().catch((error) => {
  console.error(`messages:submission:build failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
