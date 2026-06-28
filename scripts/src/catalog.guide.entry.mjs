// Catalog guide — a single-page, interactive reference for dex lookup numbers
// and the symbol set. Powered by the same authority module the catalog runtime
// and CI audit use (lib/lookup-authority.mjs), so the live decoder is the spec.
import { parseLookup, LOOKUP_FAMILIES, LOOKUP_MEDIA } from '../lib/lookup-authority.mjs';
import { parseUavLookup } from '../lib/uav-lookup-authority.mjs';
import { protectName } from '../lib/performer-authority.mjs';
import { startBlobMotion } from './shared/dx-gooey-mesh.entry.mjs';

(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__dxGuideLoaded && typeof window.__dxGuideMount === 'function') {
    try { window.__dxGuideMount(); } catch {}
    return;
  }
  window.__dxGuideLoaded = true;

  const SYMBOLS_URL = '/data/catalog.symbols.json';

  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  // Keep the Stretch Pro display face from fusing repeated glyphs.
  const head = (v) => esc(protectName(String(v == null ? '' : v)));

  // The annotated specimen — a full per-sample lookup, segmented by part.
  const SPECIMEN = [
    { text: 'K.Hps.', part: 1 },
    { text: 'Su', part: 1 },
    { text: 'AV2023', part: 2 },
    { text: 'S1', part: 2 },
    { text: 'B.13', part: 3 },
    { text: '[4K]', part: 4 },
    { text: '[Met Perc Cle Lou Poly Exc]', part: 4 },
  ];
  const PARTS = [
    { n: 1, title: 'Instrument · Performer', tag: 'K.Hps. Su',
      body: 'The instrument family class and abbreviation, then the performer’s Cutter — a short code built from their surname. K = Keyboards, Hps = harpsichord, Su = Suarez-Solis.' },
    { n: 2, title: 'Medium · Year · Season', tag: 'AV2023 S1',
      body: 'AV = audiovisual (A would mean audio-only), produced in 2023, from Season 1. We run one or two seasons a year.' },
    { n: 3, title: 'Bucket · Number', tag: 'B.13',
      body: 'Inside a collection: the sample’s type bucket (A–E, or X for other) followed by its running number.' },
    { n: 4, title: 'Quality · Qualifiers', tag: '[4K] [Met…]',
      body: 'Bracketed descriptors — resolution/format first ([4K], [1080p], [ste], [4ch]), then signifier codes describing the sound.' },
  ];
  const BUCKETS = [['A', 'Bucket A'], ['B', 'Bucket B'], ['C', 'Bucket C'], ['D', 'Bucket D'], ['E', 'Bucket E'], ['X', 'Other']];
  const EXAMPLES = ['K.Hps. Su AV2023 S1', 'W.Bsn. CoTo AV2024 S2', 'DR.Win. Mo 2026 T1', 'DR.Win. Mo V2026 T1 [FS]'];

  function symChip(code, label) {
    const t = `${code} ${label}`.toLowerCase();
    return `<div class="dx-guide-sym" data-text="${esc(t)}"><span class="dx-guide-sym-code">${esc(code)}</span><span class="dx-guide-sym-label">${esc(label)}</span></div>`;
  }

  function symGroup(title, chips) {
    if (!chips) return '';
    return `<div class="dx-guide-sym-group"><h3 class="dx-guide-sym-group-title">${head(title)}</h3><div class="dx-guide-sym-grid">${chips}</div></div>`;
  }

  // Split the "Met" legend ("Metered; Fre - Free; Perc - Percussive; …") into
  // individual signifier code→meaning pairs.
  function parseSymbols(model) {
    const quals = Array.isArray(model && model.qualifier) ? model.qualifier : [];
    const legendRow = quals.find((q) => /^met$/i.test(String(q.key_raw || '').trim()));
    const quality = quals
      .filter((q) => q !== legendRow)
      .map((q) => [String(q.key_raw || ''), String(q.description_raw || '')]);
    let signifiers = [];
    if (legendRow) {
      signifiers = String(legendRow.description_raw || '')
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((piece) => {
          const m = piece.split(/\s+-\s+/);
          return m.length >= 2 ? [m[0].trim(), m.slice(1).join(' - ').trim()] : ['Met', piece.trim()];
        });
    }
    return { quality, signifiers };
  }

  function renderDecode(value) {
    const raw = String(value || '').trim();
    if (!raw) {
      return '<p class="dx-guide-decode-empty">Type or paste a collection lookup to decode it.</p>';
    }
    const isUav = /^DR\./i.test(raw);
    const p = isUav ? parseUavLookup(raw) : parseLookup(raw);
    if (!p.valid) {
      const issues = (p.issues || []).map((i) => `<li>${esc(i)}</li>`).join('');
      return `<div class="dx-guide-decode-result is-invalid">
        <p class="dx-guide-decode-status">Not a valid collection lookup</p>
        <ul class="dx-guide-decode-issues">${issues}</ul>
        <p class="dx-guide-decode-grammar"><code>${isUav ? 'DR.Subject. Site [Class]YYYY T# [Spectrum]' : 'Family.Instrument. Cutter (A|AV)YYYY S#'}</code></p>
      </div>`;
    }
    const tile = (label, value, sub) =>
      `<div class="dx-guide-facet"><span class="dx-guide-facet-label">${esc(label)}</span><span class="dx-guide-facet-value">${head(value)}</span>${sub ? `<span class="dx-guide-facet-sub">${esc(sub)}</span>` : ''}</div>`;
    if (isUav) {
      return `<div class="dx-guide-decode-result is-valid">
        <p class="dx-guide-decode-status">Valid dexDRONES ${esc(p.level)} lookup</p>
        <div class="dx-guide-facets">
          ${tile('Wing', p.wing, 'dexDRONES')}
          ${tile('Subject', p.subjectCode, 'LCSH-backed code')}
          ${tile('Site Cutter', p.siteCutter, 'geographic authority')}
          ${p.captureClass ? tile('Class', p.captureClass, 'capture series') : ''}
          ${tile('Year', String(p.year), 'captured')}
          ${tile('Tour', p.tour, 'site-year visit')}
          ${p.spectrum ? tile('Spectrum', p.spectrum, 'acquisition') : ''}
          ${p.bucket ? tile('Bucket', `${p.bucket}.${p.number}`, p.bucket === 'X' ? 'raw/support' : 'deliverable') : ''}
        </div>
      </div>`;
    }
    return `<div class="dx-guide-decode-result is-valid">
      <p class="dx-guide-decode-status">Valid collection lookup</p>
      <div class="dx-guide-facets">
        ${tile('Family', p.family, p.familyLabel)}
        ${tile('Instrument', p.instrument, 'abbreviation')}
        ${tile('Cutter', p.cutter, 'performer')}
        ${tile('Medium', p.medium, p.mediumLabel)}
        ${tile('Year', String(p.year), 'produced')}
        ${tile('Season', p.season, 'edition')}
      </div>
    </div>`;
  }

  function template(symbols) {
    const { quality, signifiers } = symbols;
    const specimen = SPECIMEN
      .map((s) => `<button type="button" class="dx-guide-seg" data-part="${s.part}">${esc(s.text)}</button>`)
      .join('');
    const partCards = PARTS
      .map((p) => `<article class="dx-guide-part" data-part="${p.n}">
        <span class="dx-guide-part-n">${p.n}</span>
        <div class="dx-guide-part-copy">
          <h3 class="dx-guide-part-title">${head(p.title)}</h3>
          <code class="dx-guide-part-tag">${esc(p.tag)}</code>
          <p class="dx-guide-part-body">${esc(p.body)}</p>
        </div>
      </article>`).join('');
    const exampleChips = EXAMPLES
      .map((e) => `<button type="button" class="dx-guide-example" data-lookup="${esc(e)}">${esc(e)}</button>`)
      .join('');

    const familyChips = Object.entries(LOOKUP_FAMILIES).map(([k, v]) => symChip(k, v)).join('');
    const mediumChips = Object.entries(LOOKUP_MEDIA).map(([k, v]) => symChip(k, v)).join('');
    const bucketChips = BUCKETS.map(([k, v]) => symChip(k, v)).join('');
    const qualityChips = quality.length ? quality.map(([k, v]) => symChip(k, v)).join('') : '';
    const signifierChips = signifiers.length ? signifiers.map(([k, v]) => symChip(k, v)).join('') : '';

    return `<div class="dx-guide">
      <header class="dx-guide-hero" id="dex-how">
        <p class="dx-guide-kicker">Catalog reference</p>
        <h1 class="dx-guide-title">${head('Lookup Numbers')}</h1>
        <p class="dx-guide-lede">Every sample in dex carries a faceted lookup number — a compact call number that says which instrument, who played it, when, and how. Here’s how to read one, and a decoder to try your own.</p>
      </header>

      <section class="dx-guide-card dx-guide-anatomy" aria-label="Anatomy of a lookup">
        <p class="dx-guide-section-kicker">Anatomy</p>
        <div class="dx-guide-specimen" role="group" aria-label="Example lookup, by part">${specimen}</div>
        <div class="dx-guide-parts">${partCards}</div>
      </section>

      <section class="dx-guide-card dx-guide-decoder" aria-label="Live decoder">
        <p class="dx-guide-section-kicker">Decoder</p>
        <h2 class="dx-guide-section-title">${head('Decode a lookup')}</h2>
        <label class="dx-guide-input-wrap">
          <span class="dx-guide-input-hint">Collection lookup</span>
          <input class="dx-guide-input" type="text" spellcheck="false" autocomplete="off" autocapitalize="off"
                 value="${esc(EXAMPLES[0])}" placeholder="e.g. K.Hps. Su AV2023 S1" data-dx-guide-input>
        </label>
        <div class="dx-guide-examples">${exampleChips}</div>
        <div class="dx-guide-decode" data-dx-guide-decode>${renderDecode(EXAMPLES[0])}</div>
      </section>

      <section class="dx-guide-card dx-guide-symbols" id="list-of-identifiers" aria-label="List of symbols">
        <div class="dx-guide-symbols-head">
          <div>
            <p class="dx-guide-section-kicker">Reference</p>
            <h2 class="dx-guide-section-title">${head('List of Symbols')}</h2>
          </div>
          <label class="dx-guide-filter-wrap">
            <input class="dx-guide-filter" type="search" placeholder="Filter symbols…" data-dx-guide-filter aria-label="Filter symbols">
          </label>
        </div>
        <div class="dx-guide-sym-groups" data-dx-guide-symbols>
          ${symGroup('Instrument families', familyChips)}
          ${symGroup('Medium', mediumChips)}
          ${symGroup('Sample buckets', bucketChips)}
          ${symGroup('Quality & format', qualityChips)}
          ${symGroup('Signifiers', signifierChips)}
        </div>
        <p class="dx-guide-empty" data-dx-guide-empty hidden>No symbols match that filter.</p>
      </section>
    </div>`;
  }

  function bind(root) {
    // Specimen ↔ part highlighting.
    const segs = Array.from(root.querySelectorAll('.dx-guide-seg'));
    const parts = Array.from(root.querySelectorAll('.dx-guide-part'));
    const setActive = (n) => {
      segs.forEach((s) => s.classList.toggle('is-active', s.getAttribute('data-part') === n));
      parts.forEach((p) => p.classList.toggle('is-active', p.getAttribute('data-part') === n));
    };
    segs.forEach((s) => {
      const n = s.getAttribute('data-part');
      s.addEventListener('mouseenter', () => setActive(n));
      s.addEventListener('focus', () => setActive(n));
      s.addEventListener('click', () => setActive(n));
    });
    parts.forEach((p) => {
      const n = p.getAttribute('data-part');
      p.addEventListener('mouseenter', () => setActive(n));
    });

    // Live decoder.
    const input = root.querySelector('[data-dx-guide-input]');
    const out = root.querySelector('[data-dx-guide-decode]');
    const update = () => { if (out && input) out.innerHTML = renderDecode(input.value); };
    if (input) input.addEventListener('input', update);
    root.querySelectorAll('.dx-guide-example').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!input) return;
        input.value = btn.getAttribute('data-lookup') || '';
        update();
        input.focus();
      });
    });

    // Symbol filter.
    const filter = root.querySelector('[data-dx-guide-filter]');
    const chips = Array.from(root.querySelectorAll('.dx-guide-sym'));
    const groups = Array.from(root.querySelectorAll('.dx-guide-sym-group'));
    const empty = root.querySelector('[data-dx-guide-empty]');
    if (filter) {
      filter.addEventListener('input', () => {
        const q = filter.value.trim().toLowerCase();
        chips.forEach((c) => {
          const hit = !q || (c.getAttribute('data-text') || '').includes(q);
          c.hidden = !hit;
        });
        let anyVisible = false;
        groups.forEach((g) => {
          const visible = g.querySelector('.dx-guide-sym:not([hidden])');
          g.hidden = !visible;
          if (visible) anyVisible = true;
        });
        if (empty) empty.hidden = anyVisible;
      });
    }
  }

  async function loadSymbols() {
    try {
      const res = await fetch(SYMBOLS_URL, { headers: { accept: 'application/json' } });
      if (!res.ok) return { quality: [], signifiers: [] };
      return parseSymbols(await res.json());
    } catch {
      return { quality: [], signifiers: [] };
    }
  }

  async function mount() {
    const root = document.getElementById('dex-guide');
    if (!root) return;
    startBlobMotion(); // exact site gooey-mesh background
    const symbols = await loadSymbols();
    root.innerHTML = template(symbols);
    root.removeAttribute('aria-busy');
    bind(root);
  }

  window.__dxGuideMount = mount;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
