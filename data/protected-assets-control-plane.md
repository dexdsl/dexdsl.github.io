# Protected Assets Control Plane

This document defines the D1 and Worker contracts expected by the assets manifest tooling (`dex assets ...`).

## Tables

```sql
CREATE TABLE IF NOT EXISTS asset_lookup (
  lookup_number TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  season TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS asset_file (
  lookup_number TEXT NOT NULL,
  file_id TEXT NOT NULL,
  bucket_number TEXT NOT NULL,
  bucket TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  drive_file_id TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  mime TEXT,
  media_type TEXT,
  available_types_json TEXT,
  file_role TEXT NOT NULL DEFAULT 'media',
  source_label TEXT,
  position INTEGER NOT NULL,
  storage_bucket TEXT NOT NULL,
  PRIMARY KEY (lookup_number, bucket_number),
  UNIQUE (file_id),
  UNIQUE (r2_key)
);

CREATE TABLE IF NOT EXISTS asset_entitlement (
  lookup_number TEXT NOT NULL,
  entitlement_type TEXT NOT NULL,
  entitlement_value TEXT NOT NULL,
  PRIMARY KEY (lookup_number, entitlement_type, entitlement_value)
);

CREATE TABLE IF NOT EXISTS bundle_job (
  job_id TEXT PRIMARY KEY,
  lookup_number TEXT NOT NULL,
  user_sub TEXT NOT NULL,
  status TEXT NOT NULL,
  zip_key TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## Admin endpoints

- `POST /admin/assets/publish`
  - Bearer token required (`DEX_ASSETS_ADMIN_TOKEN_*`)
  - Request payload from `buildProtectedAssetsPayload(...)` plus `manifestHash`.
  - Must perform idempotent upsert into `asset_lookup`, `asset_file`, `asset_entitlement`.

- `GET /admin/assets/state`
  - Bearer token required.
  - Returns current rows and `manifestHash` for CLI diff.

- `POST /admin/assets/bucket/ensure`
  - Bearer token required.
  - Body: `{ bucket: string, dryRun?: boolean }`.

## User endpoints

- `GET /me/assets/:lookup`
  - Returns lookup metadata and entitled file list.

- `POST /me/assets/:lookup/bundle`
  - Entitlement gated.
  - Hybrid behavior:
    - sync zip when `total_size <= 200MB` and `file_count <= 25`
    - async otherwise (`bundle_job` + signed URL on completion)

- `GET /me/assets/bundle/:jobId`
  - Returns async zip status and signed URL when ready.

## Security constraints

- Frontend must request by lookup/bucket number only.
- Do not expose raw Drive IDs or private R2 keys in public HTML/runtime payloads.
- Entitlement checks must happen server-side before file metadata or bundle URLs are returned.

## Recording Index PDF convention

- Each active linked entry should map one recording-index PDF in `asset_file` under the same `lookup_number`.
- Lookup rows may include optional `recordingIndex` metadata in `data/protected.assets.json`:
  - `sheetUrl`
  - `sheetId`
  - `gid`
  - `pdfAssetId`
  - `bundleAllToken`
- Entry config stores only token references:
  - `recordingIndexPdfRef`: `lookup:<Bucket.Number>` or `asset:<file_id>`
  - `recordingIndexBundleRef`: `bundle:recording-index:<lookup>:all`
- Runtime recording-index download should request both refs so bundle output includes:
  - the recording-index PDF
  - imported per-file recording segments for the lookup
- Set `mime` to `application/pdf` (or ensure `r2_key` ends with `.pdf`) so readiness audits can verify PDF resolution deterministically.
- `available_types_json` should describe all bundle-capable families for each file (for example `["audio","video"]` when one link is dual-capability).
- Use `file_role = 'recording_index_pdf'` for the recording-index document so audit/UI can isolate it from bucket media matrix views.

## Season recording-index source registry

- Canonical season/source mappings live in `data/recording-index.sources.json`.
- Use the season-agnostic CLI for Drive-backed discovery and import:
  - `npm run recording-indexes -- init-season --season S1 --drive-root <folder-id-or-url>`
  - `npm run recording-indexes -- discover --season S1 --write`
  - `npm run recording-indexes -- validate --season S1 --import`
  - `npm run recording-indexes -- apply --season S1 --dry-run`
  - `npm run recording-indexes -- apply --season S1`
- Discovery maps Google Sheets and Drive bucket folders back to catalog entries. Apply reuses the Sheets API recording-index importer so per-cell text-run links like `4K | 1080p | ste` are preserved.
- Drive folders are used as the source inventory and fallback folder-link metadata; the recording-index sheet remains canonical for row order, labels, and rendition links.
- Seasons with placeholder/empty index sheets can set `importMode: "drive-files"` in the registry. That manifests audio/video files directly from the discovered Drive entry roots while still preserving the sheet URL as the recording-index/PDF source.
