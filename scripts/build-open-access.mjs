#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
const SOURCE = path.join(ROOT, 'components', 'open-access', 'index.html');
const TARGET = path.join(ROOT, 'docs', 'open-access', 'index.html');

async function main() {
  await fs.mkdir(path.dirname(TARGET), { recursive: true });
  await fs.copyFile(SOURCE, TARGET);
  console.log(`open-access:build wrote ${path.relative(ROOT, TARGET)}`);
}

main().catch((error) => {
  console.error(`open-access:build failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
