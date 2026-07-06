#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const SYNC_MAP = [
  {
    source: "data/dexnotes.index.json",
    targets: ["docs/data/dexnotes.index.json"],
  },
  {
    source: "data/dexnotes.entries.json",
    targets: ["docs/data/dexnotes.entries.json"],
  },
  {
    source: "data/dexnotes.comments.json",
    targets: ["docs/data/dexnotes.comments.json"],
  },
  {
    source: "data/catalog.data.json",
    targets: ["docs/data/catalog.data.json"],
  },
  {
    source: "data/catalog.entries.json",
    targets: ["docs/data/catalog.entries.json", "assets/data/catalog.entries.json", "docs/assets/data/catalog.entries.json"],
  },
  {
    source: "data/catalog.seasons.json",
    targets: ["docs/data/catalog.seasons.json"],
  },
  {
    source: "data/catalog.editorial.json",
    targets: ["docs/data/catalog.editorial.json"],
  },
  {
    source: "data/catalog.curation.snapshot.json",
    targets: ["docs/data/catalog.curation.snapshot.json"],
  },
  {
    source: "data/home.featured.json",
    targets: ["docs/data/home.featured.json"],
  },
  {
    source: "data/home.featured.snapshot.json",
    targets: ["docs/data/home.featured.snapshot.json"],
  },
  {
    source: "data/protected.assets.json",
    targets: ["docs/data/protected.assets.json"],
  },
  {
    source: "data/entry-runtime-audit.exemptions.json",
    targets: ["docs/data/entry-runtime-audit.exemptions.json"],
  },
  {
    source: "data/catalog.guide.json",
    targets: ["docs/data/catalog.guide.json"],
  },
  {
    source: "data/catalog.symbols.json",
    targets: ["docs/data/catalog.symbols.json"],
  },
  {
    source: "data/catalog.search.json",
    targets: ["docs/data/catalog.search.json"],
  },
  {
    source: "data/call.data.json",
    targets: ["docs/data/call.data.json"],
  },
  {
    source: "data/calls.registry.json",
    targets: ["docs/data/calls.registry.json"],
  },
  {
    source: "data/call.editorial.copy.json",
    targets: ["docs/data/call.editorial.copy.json"],
  },
  {
    source: "data/about.data.json",
    targets: ["docs/data/about.data.json"],
  },
  {
    source: "data/public-profiles.json",
    targets: ["docs/data/public-profiles.json"],
  },
  {
    source: "data/dexdrones.data.json",
    targets: ["docs/data/dexdrones.data.json"],
  },
  {
    source: "data/achievements.registry.json",
    targets: ["docs/data/achievements.registry.json"],
  },
  {
    source: "data/achievements.data.json",
    targets: ["docs/data/achievements.data.json"],
  },
  {
    source: "data/profile-taxonomy.json",
    targets: ["docs/data/profile-taxonomy.json"],
  },
  {
    source: "data/submit.call.schema.json",
    targets: ["docs/data/submit.call.schema.json"],
  },
  {
    source: "data/hdr.media-manifest.json",
    targets: ["docs/data/hdr.media-manifest.json"],
  },
  {
    source: "css/base.css",
    targets: ["docs/css/base.css"],
  },
  {
    source: "css/fonts.css",
    targets: ["docs/css/fonts.css"],
  },
  {
    source: "css/components/dx-catalog-index.css",
    targets: ["docs/css/components/dx-catalog-index.css"],
  },
  {
    source: "css/components/dx-catalog-how.css",
    targets: ["docs/css/components/dx-catalog-how.css"],
  },
  {
    source: "css/components/dx-catalog-guide.css",
    targets: ["docs/css/components/dx-catalog-guide.css"],
  },
  {
    source: "css/components/dx-catalog-symbols.css",
    targets: ["docs/css/components/dx-catalog-symbols.css"],
  },
  {
    source: "css/components/dx-call-editorial.css",
    targets: ["docs/css/components/dx-call-editorial.css"],
  },
  {
    source: "css/components/dx-marketing-newsletter.css",
    targets: ["docs/css/components/dx-marketing-newsletter.css"],
  },
  {
    source: "css/components/dx-polls-embed.css",
    targets: ["docs/css/components/dx-polls-embed.css"],
  },
  {
    source: "css/components/dx-submit-samples.css",
    targets: ["docs/css/components/dx-submit-samples.css"],
  },
  {
    source: "css/components/dx-submission-tracker.css",
    targets: ["docs/css/components/dx-submission-tracker.css"],
  },
  {
    source: "css/components/dx-pressroom.css",
    targets: ["docs/css/components/dx-pressroom.css"],
  },
  {
    source: "css/components/dx-settings-membership.css",
    targets: ["docs/css/components/dx-settings-membership.css"],
  },
  {
    source: "css/components/dx-settings-profile.css",
    targets: ["docs/css/components/dx-settings-profile.css"],
  },
  {
    source: "css/components/dx-controls.css",
    targets: ["docs/css/components/dx-controls.css"],
  },
  {
    source: "css/components/dx-entry-runtime.css",
    targets: ["docs/css/components/dx-entry-runtime.css"],
  },
  {
    source: "css/components/dx-about.css",
    targets: ["docs/css/components/dx-about.css"],
  },
  {
    source: "css/components/dx-dexdrones.css",
    targets: ["docs/css/components/dx-dexdrones.css"],
  },
  {
    source: "css/components/dx-uav-entry.css",
    targets: ["docs/css/components/dx-uav-entry.css"],
  },
  {
    source: "css/components/dx-donate.css",
    targets: ["docs/css/components/dx-donate.css"],
  },
  {
    source: "css/components/dx-contact.css",
    targets: ["docs/css/components/dx-contact.css"],
  },
  {
    source: "css/components/dx-achievements.css",
    targets: ["docs/css/components/dx-achievements.css"],
  },
  {
    source: "css/components/dx-not-found.css",
    targets: ["docs/css/components/dx-not-found.css"],
  },
  {
    source: "css/components/dx-dexnotes-index.css",
    targets: ["docs/css/components/dx-dexnotes-index.css"],
  },
  {
    source: "css/components/dx-dexnotes-entry.css",
    targets: ["docs/css/components/dx-dexnotes-entry.css"],
  },
  {
    source: "css/components/dx-board.css",
    targets: ["docs/css/components/dx-board.css"],
  },
  {
    source: "assets/js/header-slot.js",
    targets: ["docs/assets/js/header-slot.js"],
  },
  {
    source: "assets/js/dx-scroll-dot.js",
    targets: ["docs/assets/js/dx-scroll-dot.js"],
  },
  {
    source: "assets/js/dx-uav-entry.js",
    targets: ["docs/assets/js/dx-uav-entry.js"],
  },
  {
    source: "assets/css/dex.css",
    targets: ["docs/assets/css/dex.css"],
  },
  {
    source: "assets/dex-sidebar.js",
    targets: ["docs/assets/dex-sidebar.js"],
  },
  {
    source: "assets/series/dex.png",
    targets: ["docs/assets/series/dex.png"],
  },
  {
    source: "assets/series/index.png",
    targets: ["docs/assets/series/index.png"],
  },
  {
    source: "assets/series/dexfest.png",
    targets: ["docs/assets/series/dexfest.png"],
  },
  {
    source: "assets/img/dexdrones.png",
    targets: ["docs/assets/img/dexdrones.png"],
  },
  {
    source: "assets/img/dexdrones_background_black-lines_white.png",
    targets: ["docs/assets/img/dexdrones_background_black-lines_white.png"],
  },
  {
    source: "assets/fonts/StretchPro.woff2",
    targets: ["docs/assets/fonts/StretchPro.woff2"],
  },
  {
    source: "assets/img/dex-header-logo.webp",
    targets: ["docs/assets/img/dex-header-logo.webp"],
  },
  {
    source: "assets/img/dex-footer-logo-black.webp",
    targets: ["docs/assets/img/dex-footer-logo-black.webp"],
  },
  {
    source: "assets/img/dex-footer-logo-white.webp",
    targets: ["docs/assets/img/dex-footer-logo-white.webp"],
  },
  {
    source: "assets/img/dex-kolari-logo.webp",
    targets: ["docs/assets/img/dex-kolari-logo.webp"],
  },
  {
    source: "assets/catalog/mojave-wind-farm.webp",
    targets: ["docs/assets/catalog/mojave-wind-farm.webp"],
  },
  {
    source: "assets/catalog/tim-feeney.webp",
    targets: ["docs/assets/catalog/tim-feeney.webp"],
  },
  {
    source: "assets/catalog/prepared-oboe-sky-macklay.webp",
    targets: ["docs/assets/catalog/prepared-oboe-sky-macklay.webp"],
  },
  {
    source: "assets/catalog/multiperc.webp",
    targets: ["docs/assets/catalog/multiperc.webp"],
  },
  {
    source: "assets/catalog/andrew-chanover.webp",
    targets: ["docs/assets/catalog/andrew-chanover.webp"],
  },
  {
    source: "assets/catalog/bojun-zhang.webp",
    targets: ["docs/assets/catalog/bojun-zhang.webp"],
  },
  {
    source: "assets/press/dex-factsheet-2025-08.pdf",
    targets: ["docs/assets/press/dex-factsheet-2025-08.pdf"],
  },
  {
    source: "assets/press/dex-factsheet-dexDRONES.pdf",
    targets: ["docs/assets/press/dex-factsheet-dexDRONES.pdf"],
  },
  {
    source: "assets/press/dex-press-release-dexDRONES-kolari-sponsor-2026-03-09.pdf",
    targets: ["docs/assets/press/dex-press-release-dexDRONES-kolari-sponsor-2026-03-09.pdf"],
  },
  {
    source: "assets/dex-auth.js",
    targets: ["docs/assets/dex-auth.js"],
  },
  {
    source: "assets/dex-runtime-config.js",
    targets: ["docs/assets/dex-runtime-config.js"],
  },
  {
    source: "assets/dex-auth0-config.js",
    targets: ["docs/assets/dex-auth0-config.js"],
  },
  {
    source: "assets/dex-auth-config.js",
    targets: ["docs/assets/dex-auth-config.js"],
  },
  {
    source: "assets/vendor/auth0-spa-js.umd.min.js",
    targets: ["docs/assets/vendor/auth0-spa-js.umd.min.js"],
  },
];

function ensureSourceExists(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing source file: ${relativePath}`);
  }
  return absolutePath;
}

function syncOne(sourceAbsolutePath, sourceRelativePath, targetRelativePath) {
  const targetAbsolutePath = path.join(ROOT, targetRelativePath);
  fs.mkdirSync(path.dirname(targetAbsolutePath), { recursive: true });
  fs.copyFileSync(sourceAbsolutePath, targetAbsolutePath);
  console.log(`synced ${sourceRelativePath} -> ${targetRelativePath}`);
}

function main() {
  for (const entry of SYNC_MAP) {
    const sourceAbsolutePath = ensureSourceExists(entry.source);
    for (const target of entry.targets) {
      syncOne(sourceAbsolutePath, entry.source, target);
    }
  }
}

main();
