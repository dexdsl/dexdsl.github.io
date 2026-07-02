#!/usr/bin/env node
/**
 * strip-font-preconnects.mjs — remove dead third-party font-host preconnects.
 *
 * Dex self-hosts its only fonts (Courier Prime + Stretch Pro, see
 * docs/css/fonts.css → /assets/fonts/…), so the legacy Adobe Typekit
 * (use/p.typekit.net) and its sanitized fonthost.net aliases are dead
 * <link rel="preconnect"> hints that fetch nothing. This removes them from all
 * HTML. Idempotent.
 *
 * Run: node scripts/strip-font-preconnects.mjs [--check] [rootDir]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const isCheckMode = args.includes('--check');
const rootArg = args.find((a) => !a.startsWith('--'));
const ROOT = rootArg ? path.resolve(rootArg) : process.cwd();

// All such links in the repo are rel="preconnect" hints (verified). Match any
// <link ...> pointing at use/p . typekit|fonthost . net, plus its line indent
// and trailing newline.
const RE = /[ \t]*<link\b[^>]*href=["']https:\/\/(?:use|p)\.(?:typekit|fonthost)\.net["'][^>]*>\n?/gi;

async function collectHtmlFiles(rootDir) {
  const files = [];
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        await walk(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
        files.push(full);
      }
    }
  }
  await walk(rootDir);
  return files;
}

async function main() {
  const files = await collectHtmlFiles(ROOT);
  let changedFiles = 0;
  let removed = 0;
  for (const file of files) {
    const html = await fs.readFile(file, 'utf8');
    const matches = html.match(RE);
    if (!matches) continue;
    changedFiles += 1;
    removed += matches.length;
    console.log(`${path.relative(ROOT, file)}: ${matches.length}`);
    if (!isCheckMode) await fs.writeFile(file, html.replace(RE, ''), 'utf8');
  }
  console.log(
    `\nScanned ${files.length} files. ${isCheckMode ? 'Found' : 'Removed'} ` +
      `${removed} preconnect(s) across ${changedFiles} file(s).`
  );
  if (isCheckMode && removed > 0) process.exit(1);
}

await main();
