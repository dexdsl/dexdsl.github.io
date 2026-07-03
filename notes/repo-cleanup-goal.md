# GOAL: De-bloat, de-mirror, de-Squarespace the repo

**Owner:** Seb · **Branch:** `chore/repo-cleanup` · **Started:** 2026-07-02

## North star

A repo with **one canonical source per asset**, a **two-layer pipeline**
(`source → docs/` deploy), **zero live Squarespace dependency**, and a **lean git
history** — without changing a single deployed byte or breaking a route.

Deploy surface = `docs/` (GitHub Pages). That never changes shape. The safety
invariant for every structural sprint: **after rebuild, `git diff docs/` is empty**
and the full verify suite passes.

## Baseline (2026-07-02)

- 12,150 tracked files · ~437 MB working tree · 269 MB `.git` (177 MB pack).
- `node_modules/` was committed (9,695 files). `public/` is a redundant 3rd copy AND
  the pipeline's primary staging root. Built JS exists 3× (scripts/src → public → assets/js → docs).
- 405 KB `bridge.squarespace.css` is load-bearing (`.fe-block` grid on 124 pages).
- 63 catalog images hotlinked live from `images.squarespace-cdn.com` (in catalog data).

## Sprints

### Sprint 0 — Safe cleanup  ✅ DONE (commit `6ee44ef2`, on main)
Untracked `node_modules/artifacts/tmp/.dex-tools/scratch/.DS_Store/tokens.candidates.json`,
expanded `.gitignore`, pruned unused deps (`commander`, `kuva`,
`@fontsource/courier-prime`). Tracked 12,150→2,120. `docs/` content untouched.
`public/` left intact for Sprint 1.

### Sprint 1 — Eliminate `public/` (pipeline re-root) — ✅ DONE + VALIDATED
101 scripts re-rooted, `public/` deleted (348 files). GATE PASSED: `docs/` 0 changes,
`assets/` 0 changes, routes identical (231), verify suite 48 pass / 10 fail — and all 10
failures are PRE-EXISTING (proven: fail identically on original scripts; Squarespace
content = Sprints 2/3, `docs/`+`scripts/src` drift, missing CF env secret). Zero new
failures introduced. Build A/B byte-neutral. Skipped `build:site`/`verify:site`
orchestration (deferred — `build:site` is a footgun until the docs/ drift is reconciled).

**ATOMIC**: must land as one consistent change (a generator on `docs/` while sync still
reads `public/` = broken). Validate the whole thing together, not in shippable slices.

**Repoint rules** (docs/ already byte-identical to public/, so deployed bytes don't change):

| public/ shape (refs) | becomes |
|---|---|
| `public/assets/js/*` (54) | build output → `docs/assets/js` only (source = `scripts/src`) |
| `public/data/*` (51) | canonical `data/*`; sync fans to `docs/data` |
| `public/css/*` (47) | canonical `css/*`; sync fans to `docs/css` |
| `public/assets/{series,press,img,vendor,data}/*` (~35) | canonical `assets/*` → `docs/assets` |

**Subtasks:**
- 1a. ✅ DONE + PROVEN byte-neutral. 26 build-* scripts: esbuild `outfile → docs/assets/js/X.js`,
  keep `assets/js/X.js` mirror (verify contracts read it), drop `public/` js+css copies.
  Renamed `publicOut`→`docsOut`. A/B test: my `build-achievements` output == original, byte-identical.
  Kept BOTH `assets/js`+`docs` (not docs-only) because ~15 verify contracts compare `assets/js`↔`docs`.

  ⚠️ **DISCOVERY — committed `docs/` is DRIFTED from its own build pipeline.** Running the
  build scripts (original OR mine) regenerates 148 HTML + 4 JS files that differ from what's
  committed. This is pre-existing (proven by reverting my edits → same drift), NOT caused by
  the re-root. Consequence: the gate is **"no diff beyond drift"** — discard rebuild noise
  (`git checkout -- docs/ assets/ polls/ public/`) so only script edits remain; validate script
  correctness via A/B (my-vs-original output) + verify suite, NOT via `git diff docs/` after building.
  Verify passes despite drift because it compares *normalized* content (CI green).
- 1b. ✅ DONE. `sync_runtime_css.mjs` SYNC_MAP rewritten via transform: 88→68 entries.
  Canonical source (`data/`,`css/`,`assets/`) → `docs/` targets only; all `public/` dropped;
  19 built-JS entries dropped (build writes assets/js+docs directly); rss entry dropped
  (handled by generator). 0 public refs, valid JS, all 68 sources exist. Preserved
  catalog.entries.json's extra `assets/data`+`docs/assets/data` targets.
- 1c. TODO — Generators repoint OUTPUT `public/`→canonical (do NOT run them; live-scrapers):
  extract_catalog_data (public/data→data), extract_call_data, build-call-data-from-registry,
  build-achievements-data, build-catalog-performers (drop public/data mirror), audit-lookup-authority,
  normalize-catalog-performers, reference_catalog_probe, build_dexnotes_feed (→dexnotes/rss.xml),
  hdr_build_manifest, hdr_inject_picture_sources, fonts_detox, reference_tokens, tokenize_inventory,
  vendorize-auth0-spa, test-uav-collections, build-entry-runtime-css (reads public/ → canonical).
- 1d. TODO — Verify contracts (39): replace `public/…` reads with `docs/…` or canonical; drop
  the public mirror comparisons (keep source↔docs). Many define `PUBLIC_PATH`/`RUNTIME_PUBLIC` consts.
- 1e. TODO — `serve-entry.mjs`: drop `public/*` from `STATIC_RUNTIME_ROOTS`.
- 1f. TODO — add `build:site`/`verify:site` npm scripts; `git rm -r public`; delete public/ on disk.
- 1g. **GATE**: verify suite (the ~44 CI scripts) green · `git diff docs/` EMPTY (never run live
  sync/generators — leave docs frozen) · routes == `../routes-before.txt` · build A/B byte-neutral (1a ✓).

**STATE @ checkpoint:** working tree (uncommitted, atomic) = 26 `build-*.mjs` + `sync_runtime_css.mjs`
re-rooted. Nothing committed/pushed yet — Sprint 1 lands as ONE commit after 1g passes.

**GROUND TRUTH (verified 2026-07-02) — read before editing:**
- Deploy = committed `docs/`. CI (`sanitize.yml`) only *verifies*, never builds. No Pages build step.
- `dev`/`serve-docs.mjs` serve `docs/` only. `public/` is pure build-staging, unused at runtime/dev.
- `sync_runtime_css.mjs` is THE universal sync engine (aliased `styles:sync`/`catalog:sync`/`call:sync`,
  inlined in every `X:all`). 89-entry SYNC_MAP fans files between public/data/css/assets.
- **Source-of-truth is inconsistent today**: Type-A entries `source: public/X` → `[data/X, docs/X]`
  (generator writes public); Type-B `source: data/X|css/X` → `[public/X, docs/X]` (public just a target).
- **`public/` is stale-drifted**: 7 sources ≠ their `docs/` counterpart (dexnotes.*, catalog.entries/search,
  call.data, catalog.editorial). Drift is COSMETIC — verify compares *normalized* JSON (CI green).
- **Generators that re-scrape live** (`extract_catalog_data`, `extract_call_data`, catalog probes):
  DO NOT run during the re-root (non-deterministic). Only repoint their output paths public/→data/.
- **Deterministic/offline generators** = the 24 esbuild `build-*`; safe to run & byte-validate.
- **Generators writing public/** (repoint output → `data/`|`css/`|`assets/`): extract_catalog_data,
  extract_call_data, build-call-data-from-registry, build-achievements-data, audit-lookup-authority,
  normalize-catalog-performers, reference_catalog_probe, build_dexnotes_feed, hdr_build_manifest,
  hdr_inject_picture_sources, fonts_detox, reference_tokens, tokenize_inventory, vendorize-auth0-spa,
  verify-auth0-vendor(read), test-uav-collections. (`dex.mjs` 'public' = visibility flag, NOT a path.)
- **6 hand-authored `assets/js` source files** (edited in root, NOT build output): dex.js, dx-scroll-dot.js,
  dx-uav-entry.js, header-slot.js, profile-badges.js, sidebar.js → make root canonical, sync → docs.
- **Deploy-only (no canonical, LEAVE ALONE)**: docs `dx-legal.css/js`, `dx-consent.js`, `status.*.json`
  (0 build/sync refs). `dx-video-embed.js` referenced by 2 scripts — check before assuming.
- `css/` (root) already == `docs/css`; built JS identical across public/assets/js/docs. Safe to make root canonical.

### Sprint 2 — De-Squarespace images (4a) — data-only
Rehost 63 `images.squarespace-cdn.com` images into `assets/catalog/`; set per-entry
`image_src` override in `data/catalog.editorial.json` (survives live re-scrape — never
edit `catalog.entries.json`). Clear `sanitize.config.json` allowlist; `verify:no-sq-images` green.

### Sprint 3 — De-grid pages (4b) — 124 pages, batched + visually gated
Codemod `.sqs-layout/.row/.col/.fe-block` → semantic containers; port live rules into
`css/components/`. Migrate in route batches (legal pages first), Playwright
screenshot-diff each batch vs baseline. When `grep fe-block docs` is empty, delete
`bridge.squarespace.css`.

### Sprint 4 — History rewrite — irreversible, last
Backup bundle (done: `../dexdsl-backup-*.bundle`). `git filter-repo` to purge
`node_modules/artifacts/public/tmp` from history on `main`+`cli`; `push --force-with-lease`;
re-clone. Reclaims ~150 MB.

## Guardrails
- Backup bundle exists before any rewrite. Route inventory baseline: `../routes-before.txt` (231).
- Never hand-edit `catalog.entries.json` (re-scraped every push).
- Each sprint = its own PR. `docs/` diff must stay empty on structural sprints.
