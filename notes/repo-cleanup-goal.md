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

### Sprint 0 — Safe cleanup  ✅ (nearly done)
Untrack `node_modules/artifacts/tmp/scratch/.DS_Store` (done → 12,150→2,120 files),
expand `.gitignore` (done), prune unused deps (`commander`, `kuva`,
`@fontsource/courier-prime`) + drop `.dex-tools/bin/kuva`. Land as PR #1.
Zero pipeline risk.

### Sprint 1 — Eliminate `public/` (pipeline re-root) — 92 scripts
Re-root so generators write to `data/`/`docs/` directly and every verify contract
compares `source ↔ docs`. Subtasks:
- 1a. Repoint 32 generators (`extract_catalog_data`, `build-*-data`, etc.) off `public/`.
- 1b. Rewrite `sync_runtime_css.mjs` SYNC_MAP: `public/` source → `data/`; drop `public/` targets.
- 1c. Repoint 39 verify contracts: `public/` reads → `docs/` (or source).
- 1d. Build scripts (31): esbuild → `docs/assets/js` only; drop `public/` + root `assets/js` built copies.
- 1e. Fix `serve-entry.mjs` roots + 2 `sync_runtime_css` dexdrones PNG sources (→ `assets/img`).
- 1f. Add `build:site` + `verify:site` orchestration; delete `public/`.
- 1g. Gate: full rebuild + verify suite green + `git diff docs/` empty.

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
