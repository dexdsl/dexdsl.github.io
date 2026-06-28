import { normalizeUavLookup } from './uav-lookup-authority.mjs';

function text(value) {
  return String(value ?? '').trim();
}

function normalize(value) {
  return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function uavCollectionToCatalogEntry(collection, authorities) {
  const site = authorities.sites.find((row) => row.id === collection.siteAuthorityId);
  const subjects = collection.subjectAuthorityIds
    .map((id) => authorities.subjects.find((row) => row.id === id))
    .filter(Boolean);
  const classes = Array.from(new Set(collection.series.map((row) => row.captureClass)));
  const spectra = Array.from(new Set(collection.series.map((row) => row.spectrum).filter(Boolean)));
  return {
    kind: 'uav',
    id: collection.slug,
    title_raw: collection.title,
    lookup_raw: collection.lookupRaw,
    lookup_norm: normalizeUavLookup(collection.lookupRaw),
    entry_href: `/uav/${collection.slug}/`,
    image_src: collection.imageSrc || '',
    image_alt_raw: collection.title,
    featured: false,
    status: collection.status,
    sort_key: `UAV::${collection.lookupRaw}`,
    title_norm: normalize(collection.title),
    site_norm: normalize([site?.name, site?.admin].filter(Boolean).join(' ')),
    subject_norm: normalize(subjects.map((row) => row.label).join(' ')),
    uav: {
      collection_lookup: collection.lookupRaw,
      site: site ? {
        id: site.id,
        name: site.name,
        cutter: site.cutter,
        admin: site.admin,
        authority: site.authority,
        coordinateVisibility: site.coordinateVisibility,
        ...(site.publicCoordinates ? { publicCoordinates: site.publicCoordinates } : {}),
      } : null,
      primary_subject_code: collection.identity.primarySubjectCode,
      subjects: subjects.map((row) => ({
        id: row.id,
        code: row.code,
        label: row.label,
        authority: row.authority,
      })),
      year: collection.identity.year,
      tour: collection.identity.tour,
      capture_classes: classes,
      spectra,
      series: collection.series.map((row) => ({
        id: row.id,
        title: row.title,
        lookup_raw: row.lookupRaw,
        capture_class: row.captureClass,
        spectrum: row.spectrum || '',
      })),
    },
  };
}

export function mergeUavCollectionsIntoCatalogModel(model, uavData) {
  const base = model && typeof model === 'object' ? structuredClone(model) : { entries: [] };
  const standard = (Array.isArray(base.entries) ? base.entries : [])
    .filter((entry) => entry?.kind !== 'uav')
    .map((entry) => ({ ...entry, kind: 'catalog' }));
  const uavEntries = Array.isArray(uavData?.entries) ? uavData.entries : [];
  base.entries = [...standard, ...uavEntries].sort((a, b) => text(a.sort_key).localeCompare(text(b.sort_key)));
  return base;
}
