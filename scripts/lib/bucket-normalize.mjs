// Single source of truth for download buckets. Historically an entry's selected
// buckets were stored in three places that could drift:
//   - entry.selectedBuckets                          (top level)
//   - entry.sidebarPageConfig.buckets                (sidebar)
//   - entry.sidebarPageConfig.downloads.selectedBuckets (editor / pipeline)
// normalizeEntryBuckets() reconciles them to one ordered list and mirrors it to
// all three so every consumer (HTML, catalog, verifier, ops editor) agrees.

export const BUCKET_ORDER = ['A', 'B', 'C', 'D', 'E', 'X'];

function toBucketList(value) {
  if (!Array.isArray(value)) return null; // "absent" — let the next source win
  const set = new Set(
    value.map((v) => String(v ?? '').trim().toUpperCase()).filter((b) => BUCKET_ORDER.includes(b)),
  );
  return BUCKET_ORDER.filter((b) => set.has(b)); // ordered; [] means "explicitly none"
}

export function normalizeEntryBuckets(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  const sb = entry.sidebarPageConfig && typeof entry.sidebarPageConfig === 'object' ? entry.sidebarPageConfig : null;
  const dl = sb && sb.downloads && typeof sb.downloads === 'object' ? sb.downloads : null;

  // Priority: the editor/pipeline location, then sidebar, then legacy top-level.
  const canonical =
    toBucketList(dl ? dl.selectedBuckets : undefined) ??
    toBucketList(sb ? sb.buckets : undefined) ??
    toBucketList(entry.selectedBuckets) ??
    [];

  entry.selectedBuckets = canonical;
  if (sb) {
    sb.buckets = canonical;
    const downloads = sb.downloads && typeof sb.downloads === 'object' ? sb.downloads : (sb.downloads = {});
    downloads.selectedBuckets = canonical;
  }
  return entry;
}
