#!/usr/bin/env node
/**
 * apply-video-gate.mjs — convert live YouTube iframes in built entry pages into
 * click-to-load poster facades (privacy phase 2).
 *
 * For each built page containing a live youtube(-nocookie) iframe, this:
 *   1. reads the embed URL from the iframe,
 *   2. looks up the entry's first-party poster (image_src) from
 *      docs/assets/data/catalog.entries.json, keyed by slug (= entry dir name),
 *   3. replaces the iframe with a <button class="dex-video-facade"> facade,
 *   4. ensures /assets/js/dx-video-embed.js is loaded on the page.
 *
 * Idempotent (skips pages already gated). Mirrors the generator output in
 * scripts/lib/entry-html.mjs so built + future pages match.
 *
 * Run: node scripts/apply-video-gate.mjs [--check] [rootDir]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { buildVideoFacade } from './lib/entry-html.mjs';

const args = process.argv.slice(2);
const isCheckMode = args.includes('--check');
const rootArg = args.find((a) => !a.startsWith('--'));
const ROOT = rootArg ? path.resolve(rootArg) : path.resolve('docs/entry');
const CATALOG_PATH = path.resolve('docs/assets/data/catalog.entries.json');
const RUNTIME_SRC = '/assets/js/dx-video-embed.js';
const RUNTIME_TAG = `<script defer src="${RUNTIME_SRC}"></script>`;

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Facade markup is produced by buildVideoFacade() in scripts/lib/entry-html.mjs
// (the same function the generator uses), so built + future pages stay identical.

const CATALOG_IMG_DIR = path.resolve('docs/assets/catalog');
const IMG_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];

// Poster map keyed by entry id (= entry dir name). Sourced from the self-hosted
// files in /assets/catalog (see fetch-entry-posters.mjs) so every poster is
// first-party — never an absolute squarespace-cdn URL.
async function loadPosterMap() {
  const map = new Map();
  let files = [];
  try {
    files = await fs.readdir(CATALOG_IMG_DIR);
  } catch (err) {
    console.warn(`Could not read ${CATALOG_IMG_DIR}: ${err.message}`);
    return map;
  }
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!IMG_EXTS.includes(ext)) continue;
    const id = path.basename(file, path.extname(file));
    if (!map.has(id)) map.set(id, `/assets/catalog/${file}`);
  }
  return map;
}

async function collectHtmlFiles(rootDir) {
  const files = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
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

// Replace a live youtube(-nocookie) iframe with the facade. Returns null if none.
const IFRAME_RE =
  /<iframe\b[^>]*\bsrc=["'](https:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/[^"']+)["'][^>]*>\s*<\/iframe>/i;

function slugFromPath(file) {
  // docs/entry/<slug>/index.html -> <slug>
  const parts = path.dirname(path.relative(process.cwd(), file)).split(path.sep);
  return parts[parts.length - 1] || '';
}

function ensureRuntime(html) {
  if (html.includes(RUNTIME_SRC)) return html;
  const hs = html.match(/<script\b[^>]*\bsrc=["'][^"']*\/assets\/js\/header-slot\.js["'][^>]*>\s*<\/script>/i);
  if (hs) return html.replace(hs[0], `${hs[0]}\n${RUNTIME_TAG}`);
  const headClose = html.search(/<\/head>/i);
  if (headClose !== -1) return `${html.slice(0, headClose)}${RUNTIME_TAG}\n${html.slice(headClose)}`;
  const bodyClose = html.search(/<\/body>/i);
  if (bodyClose !== -1) return `${html.slice(0, bodyClose)}${RUNTIME_TAG}\n${html.slice(bodyClose)}`;
  return html;
}

async function main() {
  const posters = await loadPosterMap();
  const files = await collectHtmlFiles(ROOT);
  let gated = 0;
  let alreadyGated = 0;
  let noVideo = 0;
  const missingPoster = [];

  for (const file of files) {
    let html = await fs.readFile(file, 'utf8');
    if (html.includes('dex-video-facade')) {
      alreadyGated += 1;
      let updated = ensureRuntime(html);
      // Backfill a poster onto a facade that was gated before its poster existed.
      const poster = posters.get(slugFromPath(file));
      if (poster) {
        updated = updated.replace(
          /<button\b([^>]*\bclass="dex-video-facade"[^>]*)>/i,
          (whole, attrs) =>
            /background-image/i.test(attrs)
              ? whole
              : `<button${attrs} style="background-image:url('${escapeAttr(poster)}')">`
        );
      }
      if (!isCheckMode && updated !== html) await fs.writeFile(file, updated, 'utf8');
      continue;
    }
    const m = html.match(IFRAME_RE);
    if (!m) {
      noVideo += 1;
      continue;
    }
    const embedUrl = m[1];
    const slug = slugFromPath(file);
    const poster = posters.get(slug) || '';
    if (!poster) missingPoster.push(slug);
    const facade = buildVideoFacade(embedUrl, poster);
    html = html.replace(m[0], facade);
    html = ensureRuntime(html);
    gated += 1;
    console.log(`${path.relative(process.cwd(), file)} -> gated (poster: ${poster || 'none'})`);
    if (!isCheckMode) await fs.writeFile(file, html, 'utf8');
  }

  console.log(
    `\nScanned ${files.length} files. ${isCheckMode ? 'Would gate' : 'Gated'} ${gated}, ` +
      `already gated ${alreadyGated}, no-video ${noVideo}.`
  );
  if (missingPoster.length) console.log(`No poster for: ${missingPoster.join(', ')}`);
  if (isCheckMode && gated > 0) process.exit(1);
}

await main();
