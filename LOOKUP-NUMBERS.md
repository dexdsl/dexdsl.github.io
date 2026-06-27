# dex lookup numbers — schema & authority

This is the canonical specification for the dex catalog's **lookup numbers** and
performer **name authority**. It is written for both humans and machines: if you
are an agent picking up this codebase, read this file before touching anything
that renders, parses, sorts, groups, or validates catalog entries.

The design follows library cataloguing practice. A lookup number is a **faceted
call number** (think Library of Congress call number + Cutter number, organised
as Ranganathan-style facets). Performer names are handled with **name authority
control** (MARC/LCNAF): one authorized form, recorded variants, structured fields.

---

## 1. Anatomy of a lookup number

A full *per-sample* lookup has four parts:

```
K.Hps.  Su      AV2023  S1    B.13      [4K] [Met Perc Cle Lou Poly Exc]
└─ 1 ─┘ └ 1 ─┘  └── 2 ──┘    └─ 3 ─┘    └─────────── 4 ───────────────┘
```

| Part | Form | Meaning |
|------|------|---------|
| **1** | `Family.Instrument. Cutter` | What & who: instrument family class, instrument abbreviation, and the performer Cutter (name code). |
| **2** | `Medium+Year Season` | When & how: `A`=audio / `AV`=audiovisual, 4-digit year, then `S#` season/edition. |
| **3** | `Bucket.Number` | Per-sample ordering: sample-type bucket (`A`–`E`, `X`) and its number within the collection. |
| **4** | `[Quality] [Qualifiers]` | Per-sample descriptors: `[4K]`/`[1080p]`/`[ste]`/`[4ch]`… and signifier codes. |

A **catalog entry** (a collection) is identified by **Parts 1 + 2** only — e.g.
`K.Hps. Su AV2023 S1`. Parts 3–4 belong to individual samples inside a collection.

The code in this repo (`lookup-authority.mjs`) parses and validates the
**entry/collection-level** lookup (Parts 1–2). Parts 3–4 are documented here and
shown in the catalog guide, but are not part of the entry identifier.

---

## 2. Facets & controlled vocabularies

### Family (Part 1, class letter) — **closed vocabulary**
Source of truth: `scripts/lib/lookup-authority.mjs` → `LOOKUP_FAMILIES`, kept in
sync with `catalog.symbols.json → instrument`.

| Code | Family |
|------|--------|
| `V` | Voice + Body |
| `K` | Keyboards |
| `B` | Brass |
| `E` | Electronics |
| `S` | Strings |
| `W` | Winds |
| `P` | Percussion |
| `X` | Other |

### Instrument (Part 1, abbreviation) — **open vocabulary**
A short Title-case abbreviation of the medium of performance (≈ LCMPT / MARC 048):
`Gtr` guitar, `Hps` harpsichord, `Org` organ, `Bsn` bassoon, `Ob` oboe, `Vlc`
cello, `VdG` viol da gamba, `Pdb` (prepared) double bass, `Mod` modular, `Kni`
knives, `Noi` noise, `Prt` printer, `Mul` multimedia, `Tlv` television, `Sng`
song, `Sc` scat, `Obj` objects, `Pto` (prepared) tom, `Mpc` multiple percussion,
`Dho` dholak, `Hdl` hammered dulcimer, `Sdr` snare drum, `Ens` ensemble, … New
instruments are expected; validation checks **format** (1–6 letters), not membership.

### Cutter (Part 1, performer code) — derived from the name authority
A letter-based Cutter (≈ LC Cutter number). Rule (`deriveCutter`):
1. take each performer's **family name** from the authority,
2. fold diacritics to ASCII, strip non-letters,
3. sort surnames alphabetically,
4. take **two letters each** (Title-case: first upper, second lower),
5. concatenate.

`Church → Ch` · `Suarez-Solis → Su` · `Coleman + Tomecek → CoTo` ·
`Jáquez + Yorke → JaYo`. Collisions (e.g. Church/Chanover both `Ch`) are only a
problem at the *full* lookup level; if two share family+instrument+year+cutter,
lengthen the Cutter (LC practice). The audit flags duplicates.

### Medium (Part 2) — **closed vocabulary**
`LOOKUP_MEDIA`: `A` = Audio · `AV` = Audiovisual. **`A` (audio-only) is
intentional**, not a typo.

### Year (Part 2) — 4 digits, 2000–2100.

### Season / edition (Part 2) — `S` + digits (`S1`, `S2`, …). Local facet.

### Bucket (Part 3) — sample-type buckets `A`–`E` and `X`, then `.Number`.

### Quality / Qualifiers (Part 4) — bracketed descriptors.
Source: `catalog.symbols.json → quality` / `qualifier` (e.g. `4K`, `1080p`,
`ste` stereo, `4ch`, and signifier codes `Met` metered, `Perc` percussive, …).

---

## 3. Grammar (entry/collection level)

```
Family   = [A-Za-z]              ; must be in LOOKUP_FAMILIES
Instrument = [A-Za-z]{1,6}
Cutter   = [A-Za-z][A-Za-z'’-]*  ; should equal deriveCutter(performers)
Medium   = "A" | "AV"
Year     = [0-9]{4}              ; 2000–2100
Season   = "S" [0-9]+

Lookup   = Family "." Instrument "." SP Cutter SP Medium Year SP Season
```

Regex of record lives in `scripts/lib/lookup-authority.mjs` (`LOOKUP_RE`).

---

## 4. Stored fields (per entry)

`public/data/catalog.entries.json` (mirrored to `data/`, `assets/`, `docs/`):

```jsonc
{
  "lookup_raw":  "K.Hps. Su AV2023 S1",   // source identifier (do not rewrite)
  "lookup_norm": "k.hps. su av2023 s1",   // canonical normalized key (lowercased)
  "lookup": {                              // structured facets (derived)
    "family": "K", "family_label": "Keyboards",
    "instrument": "Hps", "cutter": "Su",
    "medium": "AV", "medium_label": "Audiovisual",
    "year": 2023, "season": "S1"
  },

  "performer_raw":     "suarez-solis, sebastian",   // source/variant form
  "performer_display": "Suarez-Solis, Sebastian",   // authorized heading (Surname, Forename)
  "performer_norm":    "suarez-solis, sebastian",   // lowercased sort key (collocation)
  "performers": [ { "family": "Suarez-Solis", "given": "Sebastian",
                    "display": "Suarez-Solis, Sebastian",
                    "sort": "suarez-solis, sebastian" } ]
}
```

`*_raw` fields are the **source of truth**. Every other field is **derived** and
may be regenerated at any time.

---

## 5. Validation · normalization · propagation

| Concern | Where | Notes |
|---------|-------|-------|
| Parse/validate a lookup | `lib/lookup-authority.mjs` → `parseLookup()` | grammar + closed vocab + Cutter-vs-authority |
| Canonical norm key | `parseLookup` / `normalizeLookup()` | lowercased, whitespace-collapsed |
| Performer authority | `lib/performer-authority.mjs` → `deriveAuthority()` | inverted heading, multi-artist, diacritics |
| Heading de-ligature | `lib/performer-authority.mjs` → `protectName()` | inserts ZWNJ between repeated letters |
| **Audit / CI gate** | `scripts/audit-lookup-authority.mjs` (`npm run catalog:lookups:audit`) | schema, vocab, Cutter, **uniqueness**, norm drift; in `catalog:all` |
| **Bake derived fields** | `scripts/normalize-catalog-performers.mjs` (`npm run catalog:authority:normalize`) | writes display/norm/performers + lookup_norm/facets |
| **Runtime self-heal** | `scripts/src/catalog.index.entry.mjs` → `normalizeLoadedModel()` | re-derives everything on load, so the app is correct even against raw/stale data — the normalize script is a convenience + CI gate, **not** a runtime dependency |

### Workflow
1. Edit only the `*_raw` fields (or upstream pipeline produces them).
2. `npm run catalog:authority:normalize` → bakes derived fields into the canonical JSON.
3. `node scripts/sync_runtime_css.mjs` → mirrors data to `data/`, `assets/`, `docs/`.
4. `npm run catalog:lookups:audit` → validates (also runs in `catalog:all`).

The reader-facing reference lives at **`/catalog/guide/`** (built from
`scripts/src/catalog.guide.entry.mjs`), which uses the same authority modules.
