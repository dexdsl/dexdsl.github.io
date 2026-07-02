#!/usr/bin/env node
/**
 * strip-analytics.mjs — remove Google Tag Manager / GA4 from all HTML.
 *
 * Dex is dropping Google Analytics for privacy compliance (cookieless
 * Cloudflare Web Analytics replaces it). This idempotent pass removes every
 * shape of the legacy Squarespace-export tracking from `**​/*.html`:
 *   1. the head GTM IIFE loader  (<!-- Google Tag Manager --> … <!-- End … -->)
 *   2. the GA4 gtag.js tag       (<script src=".../gtag/js?id=…"></script>)
 *   3. the GTM <noscript> iframe (<!-- Google Tag Manager (noscript) --> … )
 *   4. any inline gtag('config'|'js', …) init block (defensive; none today)
 *
 * Run: node scripts/strip-analytics.mjs [--check] [rootDir]
 *   --check : report matches, exit 1 if any remain, write nothing.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const isCheckMode = args.includes('--check');
const rootArg = args.find((a) => !a.startsWith('--'));
const ROOT = rootArg ? path.resolve(rootArg) : process.cwd();

const PATTERNS = [
  // Order matters: remove the (noscript) block before the head block so the
  // shorter "<!-- End Google Tag Manager -->" needle can't cross into it.
  {
    name: 'gtm-noscript',
    re: /[ \t]*<!-- Google Tag Manager \(noscript\) -->[\s\S]*?<!-- End Google Tag Manager \(noscript\) -->\n?/g,
  },
  {
    name: 'gtm-head',
    re: /[ \t]*<!-- Google Tag Manager -->[\s\S]*?<!-- End Google Tag Manager -->\n?/g,
  },
  {
    name: 'gtag-js',
    re: /<script\b[^>]*\bsrc=["']https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=[^"']*["'][^>]*><\/script>/gi,
  },
  {
    name: 'gtag-inline',
    re: /[ \t]*<script\b(?:[^>]*)>(?:(?!<\/script>)[\s\S])*?gtag\(\s*["'](?:config|js)["'][\s\S]*?<\/script>\n?/gi,
  },
];

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

function strip(html) {
  let out = html;
  const counts = {};
  for (const { name, re } of PATTERNS) {
    const matches = out.match(re);
    counts[name] = matches ? matches.length : 0;
    if (counts[name]) out = out.replace(re, '');
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { out, counts, total };
}

async function main() {
  const files = await collectHtmlFiles(ROOT);
  if (!files.length) {
    console.error(`No HTML files found in ${ROOT}`);
    process.exit(1);
  }
  let changedFiles = 0;
  let grandTotal = 0;
  const perPattern = { 'gtm-noscript': 0, 'gtm-head': 0, 'gtag-js': 0, 'gtag-inline': 0 };
  for (const file of files) {
    const original = await fs.readFile(file, 'utf8');
    const { out, counts, total } = strip(original);
    if (total > 0) {
      changedFiles += 1;
      grandTotal += total;
      for (const k of Object.keys(perPattern)) perPattern[k] += counts[k];
      console.log(`${path.relative(ROOT, file)}: ${JSON.stringify(counts)}`);
      if (!isCheckMode && out !== original) {
        await fs.writeFile(file, out, 'utf8');
      }
    }
  }
  console.log(
    `\nScanned ${files.length} files. ${
      isCheckMode ? 'Found' : 'Removed'
    } ${grandTotal} block(s) across ${changedFiles} file(s). By type: ${JSON.stringify(perPattern)}`
  );
  if (isCheckMode && grandTotal > 0) {
    console.error('Check failed: analytics blocks still present.');
    process.exit(1);
  }
}

await main();
