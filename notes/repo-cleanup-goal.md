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

### Sprint 1 — Eliminate `public/` (pipeline re-root) — 92 scripts
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
- 1a. Build scripts (31, uniform): drop `publicOut`; esbuild `outfile → docs/assets/js/X.js`;
  drop the root `assets/js/X.js` built copy (redundant with source `scripts/src`). Keep
  the 6 hand-authored `assets/js` files (dex.js, dx-scroll-dot.js, dx-uav-entry.js,
  header-slot.js, profile-badges.js, sidebar.js) as source, synced to docs.
- 1b. Generators (32: `extract_catalog_data`, `build-*-data`, `build-call-data-from-registry`,
  etc.): write canonical `data/*` (not `public/data`).
- 1c. `sync_runtime_css.mjs` SYNC_MAP: every `source: 'public/…'` → canonical
  (`data/…` or `css/…`); drop every `public/…` target; keep only `docs/…` targets
  (+ the legit `data/`→`docs/` fan). Fix the 2 dexdrones PNG sources → `assets/img`.
- 1d. Verify contracts (39): replace `public/…` reads with `docs/…` (compare source↔docs).
- 1e. `serve-entry.mjs`: drop `public/*` from `STATIC_RUNTIME_ROOTS` (keep `assets`,`docs/assets`).
- 1f. Add `build:site` (full build+sync) + `verify:site` (full verify) npm scripts. `git rm -r public`.
- 1g. **GATE**: `npm run build:site` twice (2nd = no diff) · `verify:site` green ·
  `git diff docs/` EMPTY · route inventory == `../routes-before.txt`.

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
