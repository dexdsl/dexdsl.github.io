#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readPollsFile } from './lib/polls-store.mjs';

const ROOT = process.cwd();
const SITE_ORIGIN = 'https://dexdsl.github.io';
const SHELL_SOURCE_PATH = path.join(ROOT, 'docs', 'index.html');
const SHELL_FALLBACK_PATH = path.join(ROOT, 'docs', 'catalog', 'index.html');

function extractMainWindow(source, label) {
  const mainStart = source.indexOf('<main id="page"');
  if (mainStart < 0) {
    throw new Error(`Unable to find <main id=\"page\"> in ${label}`);
  }
  const mainEnd = source.indexOf('</main>', mainStart);
  if (mainEnd < 0) {
    throw new Error(`Unable to find </main> in ${label}`);
  }
  const preMain = source.slice(0, mainStart);
  const postMain = source.slice(mainEnd + '</main>'.length);
  return { preMain, postMain };
}

function extractBodySuffix(postMain) {
  const footerSectionsStart = postMain.indexOf('<footer class="sections"');
  if (footerSectionsStart >= 0) {
    return postMain.slice(footerSectionsStart);
  }
  return postMain;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function ensureLeadingSlash(value) {
  const raw = String(value || '').trim();
  if (!raw) return '/';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function canonicalUrl(pathname) {
  return `${SITE_ORIGIN}${ensureLeadingSlash(pathname)}`;
}

function readShellParts() {
  const sourcePath = fs.existsSync(SHELL_SOURCE_PATH) ? SHELL_SOURCE_PATH : SHELL_FALLBACK_PATH;
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing shell source: ${path.relative(ROOT, SHELL_SOURCE_PATH)} and ${path.relative(ROOT, SHELL_FALLBACK_PATH)}`);
  }

  const source = fs.readFileSync(sourcePath, 'utf8');
  const mainShell = extractMainWindow(source, path.relative(ROOT, sourcePath));
  let preMain = mainShell.preMain;
  let bodySuffix = extractBodySuffix(mainShell.postMain);

  if (!bodySuffix.includes('class="dex-footer"') && fs.existsSync(SHELL_FALLBACK_PATH)) {
    const fallbackSource = fs.readFileSync(SHELL_FALLBACK_PATH, 'utf8');
    const fallbackShell = extractMainWindow(fallbackSource, path.relative(ROOT, SHELL_FALLBACK_PATH));
    const fallbackSuffix = extractBodySuffix(fallbackShell.postMain);
    if (fallbackSuffix.includes('class="dex-footer"')) {
      bodySuffix = fallbackSuffix;
    }
  }

  const gooStart = preMain.indexOf('<div id="gooey-mesh-wrapper">');
  if (gooStart >= 0) {
    preMain = preMain.slice(0, gooStart);
  }

  const headStart = preMain.indexOf('<head>');
  const headEnd = preMain.indexOf('</head>', headStart);
  if (headStart < 0) {
    throw new Error(`Unable to split shell head/body in ${path.relative(ROOT, sourcePath)}`);
  }

  const htmlPrefix = preMain.slice(0, headStart);
  const sanitizeBodyPrefix = (value) => {
    let next = String(value || '');
    next = next.replace(/(<body\b[^>]*\bclass=")([^"]*)(")/i, (full, before, classValue, after) => {
      const classes = String(classValue || '')
        .split(/\s+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item) => item !== 'homepage');
      return `${before}${classes.join(' ')}${after}`;
    });
    next = next.replace(/(<body\b[^>]*\bclass=')([^']*)(')/i, (full, before, classValue, after) => {
      const classes = String(classValue || '')
        .split(/\s+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item) => item !== 'homepage');
      return `${before}${classes.join(' ')}${after}`;
    });
    return next;
  };

  if (headEnd >= 0) {
    const bodyPrefix = sanitizeBodyPrefix(preMain.slice(headEnd + '</head>'.length));
    return { htmlPrefix, bodyPrefix, bodySuffix };
  }

  const bodyStartMatch = preMain.match(/<body\b/i);
  if (bodyStartMatch && typeof bodyStartMatch.index === 'number') {
    const bodyPrefix = sanitizeBodyPrefix(preMain.slice(bodyStartMatch.index));
    return { htmlPrefix, bodyPrefix, bodySuffix };
  }

  return { htmlPrefix, bodyPrefix: '<body>', bodySuffix };
}

function buildHead({ title, description, canonicalPath, imageSrc }) {
  const canonical = canonicalUrl(canonicalPath);
  const escapedTitle = escapeHtml(title);
  const escapedDescription = escapeAttr(description || 'Dex polls for public and member voting.');
  const escapedImage = escapeAttr(imageSrc || '/assets/img/7142b356c8cfe9d18b7c.png');

  return `<head>
    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <!-- dexdsl -->
<meta charset="utf-8" />
<title>${escapedTitle}</title>
<meta http-equiv="Accept-CH" content="Sec-CH-UA-Platform-Version, Sec-CH-UA-Model" /><link rel="icon" type="image/png" href="/assets/img/dex-favicon.png"/>
<link rel="canonical" href="${escapeAttr(canonical)}"/>
<meta property="og:site_name" content="dex digital sample library"/>
<meta property="og:title" content="${escapedTitle}"/>
<meta property="og:url" content="${escapeAttr(canonical)}"/>
<meta property="og:type" content="website"/>
<meta property="og:image" content="${escapedImage}"/>
<meta itemprop="name" content="${escapedTitle}"/>
<meta itemprop="url" content="${escapeAttr(canonical)}"/>
<meta itemprop="thumbnailUrl" content="${escapedImage}"/>
<link rel="image_src" href="${escapedImage}" />
<meta itemprop="image" content="${escapedImage}"/>
<meta name="twitter:title" content="${escapedTitle}"/>
<meta name="twitter:image" content="${escapedImage}"/>
<meta name="twitter:url" content="${escapeAttr(canonical)}"/>
<meta name="twitter:card" content="summary"/>
<meta name="description" content="${escapedDescription}" />

    <link rel="stylesheet" href="/css/tokens.css">
    <link rel="stylesheet" href="/css/base.css">
    <link rel="stylesheet" href="/css/bridge.squarespace.css">
    <link rel="stylesheet" href="/css/components/dx-layout.css">
    <link rel="stylesheet" href="/css/components/dx-surface.css">
    <link rel="stylesheet" href="/css/components/dx-controls.css">
    <link rel="stylesheet" href="/css/components/dx-nav.css">
    <link rel="stylesheet" href="/css/fonts.css">
    <link rel="stylesheet" href="/assets/css/dex.css">
<script src="/assets/vendor/auth0-spa-js.umd.min.js"></script>
<script defer src="/assets/dex-auth0-config.js"></script>
<script defer src="/assets/dex-auth.js"></script>
<script defer src="/assets/js/header-slot.js"></script>
<script defer src="/assets/js/dx-scroll-dot.js"></script>
<script defer src="/assets/js/polls.app.js"></script>
<!-- header code injection.css -->

<!-- End of legacysite Headers -->
    
  </head>`;
}

function buildMain({ pollId = '' } = {}) {
  const attrId = pollId ? ` data-dx-poll-id="${escapeAttr(pollId)}"` : '';
  const loadingTitle = pollId ? 'Loading poll…' : 'Loading polls…';
  return `
      <main id="page" class="container dx-polls-page" role="main">
        <section class="dx-polls-route-shell" aria-label="Dex polls route shell">
          <div id="dex-console" data-dx-polls-app="true" data-dx-fetch-state="loading" aria-busy="true"${attrId}>
            <div class="dx-route-loader" data-dx-route-loader role="status" aria-live="polite">
              <div class="dx-route-loader-inner">
                <div class="dx-route-loader-meta">
                  <span class="dx-route-loader-phase">Loading</span>
                  <span class="dx-route-loader-detail">${escapeHtml(loadingTitle)}</span>
                </div>
                <div class="dx-route-loader-track"><span class="dx-route-loader-fill"></span></div>
              </div>
            </div>
          </div>
        </section>
      </main>`;
}

function buildDocument(shellParts, pageMeta, mainHtml) {
  const head = buildHead(pageMeta);
  return `${shellParts.htmlPrefix}${head}${shellParts.bodyPrefix}\n${mainHtml}${shellParts.bodySuffix}`;
}

function writePage(relativePath, html) {
  const absolutePath = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, html, 'utf8');
  return absolutePath;
}

function cleanPollDetailDirs(baseDir, validIds) {
  if (!fs.existsSync(baseDir)) return;
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (validIds.has(entry.name)) continue;
    fs.rmSync(path.join(baseDir, entry.name), { recursive: true, force: true });
  }
}

async function main() {
  const shell = readShellParts();
  const { data } = await readPollsFile();
  const polls = Array.isArray(data.polls) ? data.polls : [];

  const listMeta = {
    title: 'Polls — dex digital sample library',
    description: 'Dex community polls for public and member voting.',
    canonicalPath: '/polls/',
    imageSrc: '/assets/img/7142b356c8cfe9d18b7c.png',
  };

  const listHtml = buildDocument(shell, listMeta, buildMain());

  writePage('docs/polls/index.html', listHtml);
  writePage('polls/index.html', listHtml);

  const validIds = new Set(polls.map((poll) => String(poll.id || '').trim()).filter(Boolean));
  cleanPollDetailDirs(path.join(ROOT, 'docs', 'polls'), validIds);
  cleanPollDetailDirs(path.join(ROOT, 'polls'), validIds);

  for (const poll of polls) {
    const pollId = String(poll.id || '').trim();
    if (!pollId) continue;
    const detailMeta = {
      title: `${String(poll.question || 'Poll detail').trim()} — Dex Polls`,
      description: `Dex poll detail for ${String(poll.question || pollId).trim()}.`,
      canonicalPath: `/polls/${encodeURIComponent(pollId)}/`,
      imageSrc: '/assets/img/7142b356c8cfe9d18b7c.png',
    };
    const detailHtml = buildDocument(shell, detailMeta, buildMain({ pollId }));
    writePage(`docs/polls/${pollId}/index.html`, detailHtml);
    writePage(`polls/${pollId}/index.html`, detailHtml);
  }

  console.log(`polls:render wrote list + ${validIds.size} detail routes.`);
}

main().catch((error) => {
  console.error(`polls:render failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
