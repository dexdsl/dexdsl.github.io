#!/usr/bin/env node
/**
 * apply-footer-cookies-link.mjs — add a "Cookies" link to the site footer nav.
 *
 * The dex-footer (with <nav class="footer-nav">Privacy / Contact / Copyright</nav>)
 * is copy-pasted across ~100+ static pages, so "Cookie settings always available
 * in the footer" means editing each footer. Idempotent: inserts
 * <a href="/cookies">Cookies</a> after the Privacy link, once per footer nav.
 *
 * Run: node scripts/apply-footer-cookies-link.mjs [--check] [rootDir ...]
 *   defaults to repo root (walks all HTML).
 *   --check : report files needing the link, exit 1 if any, write nothing.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const isCheckMode = args.includes('--check');
const roots = args.filter((a) => !a.startsWith('--'));
const ROOTS = (roots.length ? roots : ['.']).map((r) => path.resolve(r));

const NAV_RE = /<nav class="footer-nav">([\s\S]*?)<\/nav>/g;
const PRIVACY_LINK = '<a href="/privacy">Privacy</a>';
const COOKIES_LINK = '<a href="/cookies">Cookies</a>';

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

function addLink(html) {
  let changed = 0;
  const out = html.replace(NAV_RE, (whole, inner) => {
    if (inner.includes('/cookies')) return whole; // already present
    changed += 1;
    let newInner;
    if (inner.includes(PRIVACY_LINK)) {
      newInner = inner.replace(PRIVACY_LINK, `${PRIVACY_LINK}\n        ${COOKIES_LINK}`);
    } else {
      // No Privacy link — just prepend the Cookies link inside the nav.
      newInner = `\n        ${COOKIES_LINK}${inner}`;
    }
    return `<nav class="footer-nav">${newInner}</nav>`;
  });
  return { out, changed };
}

async function main() {
  let files = [];
  for (const root of ROOTS) {
    try {
      files = files.concat(await collectHtmlFiles(root));
    } catch {
      console.warn(`skip missing root: ${root}`);
    }
  }
  let filesChanged = 0;
  let navsChanged = 0;
  const pending = [];
  for (const file of files) {
    const html = await fs.readFile(file, 'utf8');
    if (!html.includes('<nav class="footer-nav">')) continue;
    const { out, changed } = addLink(html);
    if (changed > 0) {
      pending.push(path.relative(process.cwd(), file));
      filesChanged += 1;
      navsChanged += changed;
      if (!isCheckMode && out !== html) await fs.writeFile(file, out, 'utf8');
    }
  }
  console.log(
    `Scanned ${files.length} files. ${isCheckMode ? 'Need' : 'Updated'} ` +
      `${navsChanged} footer nav(s) across ${filesChanged} file(s).`
  );
  if (isCheckMode && navsChanged > 0) {
    for (const p of pending.slice(0, 20)) console.log(`  needs link: ${p}`);
    process.exit(1);
  }
}

await main();
