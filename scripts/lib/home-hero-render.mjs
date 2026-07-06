function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function ctaMarkup(cta, className = '') {
  if (cta.kind === 'auth-switch') {
    return `<button type="button" class="dx-home-hero-cta ${className}" data-dx-hero-auth-cta data-mode="guest" data-guest-label="${escapeHtml(cta.guestLabel)}" data-auth-label="${escapeHtml(cta.authenticatedLabel)}" data-auth-href="${escapeHtml(cta.authenticatedHref)}">${escapeHtml(cta.guestLabel)}</button>`;
  }
  return `<a class="dx-home-hero-cta ${className}" href="${escapeHtml(cta.href)}">${escapeHtml(cta.label)}</a>`;
}

function renderHeadlineLine(value) {
  return escapeHtml(value).replaceAll('ACCESS', 'AC&#8204;CES&#8204;S');
}

function renderCampaignButtonLabel(value) {
  return escapeHtml(value)
    .replaceAll('FREE', 'FRE&#8204;E')
    .replaceAll(' ', '&nbsp;');
}

function campaignMarkup(module) {
  const headline = module.headlineLines.map((line) => renderHeadlineLine(line)).join('<br>');
  const secondary = module.secondaryCta.kind === 'auth-switch'
    ? `<div class="product-block">
        <div class="productDetails center">
          <button id="dx-hero-cta" data-dx-hero-cta data-dx-hero-cta-mode="signup"
            data-guest-label="${escapeHtml(module.secondaryCta.guestLabel)}"
            data-auth-label="${escapeHtml(module.secondaryCta.authenticatedLabel)}"
            data-auth-href="${escapeHtml(module.secondaryCta.authenticatedHref)}"
            class="join-button dx-button-element dx-button-element--secondary dx-button-size--md dx-button-block dx-block-button-element dx-block-button-element--secondary dx-block-button-element--large">
            <div class="dx-add-to-cart-button-inner" data-dx-hero-cta-label>${renderCampaignButtonLabel(module.secondaryCta.guestLabel)}</div>
          </button>
        </div>
      </div>`
    : `<a href="${escapeHtml(module.secondaryCta.href)}" class="dx-button-element dx-button-element--secondary dx-button-size--md dx-button-block dx-block-button-element dx-block-button-element--secondary dx-block-button-element--large">${escapeHtml(module.secondaryCta.label)}</a>`;
  return `<div id="dexHeroSide" data-module-id="${escapeHtml(module.id)}" data-module-type="campaign" style="
    flex:1 1 0;margin:0;padding:0;display:flex;flex-direction:column;height:100%;box-sizing:border-box;">
    <div id="dexHeroCard" style="
      flex:1 1 auto;display:flex;flex-direction:column;justify-content:flex-start;gap:1.25rem;
      width:100%;padding:clamp(2rem,5vw,3rem);box-sizing:border-box;">
      <h1 data-dx-heading-duplicate-exclude-words="RECORDING" style="
        margin:0;font:700 clamp(2rem,5vw,3rem)/1.15 var(--font-heading,sans-serif);text-transform:uppercase;">
        ${headline}<br>
        <span id="heroWord" data-dx-hero-rotating data-words="${escapeHtml(JSON.stringify(module.rotatingWords))}"
          contenteditable="true" spellcheck="false" style="
            background:linear-gradient(135deg,#ff3c3c 0%,#ff9d32 100%);
            -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
            color:transparent;background-color:transparent;display:inline-block;outline:none;
            white-space:pre-line;caret-color:#ff9d32;"></span>
      </h1>
      <p style="margin:0;font:1.25rem/1.45 var(--font-body,sans-serif);opacity:.85;">${escapeHtml(module.body)}</p>
      <div style="display:flex;flex-direction:column;gap:1rem;margin-top:1.5rem;">
        <a id="heroExplore" href="${escapeHtml(module.primaryCta.href)}"
          class="dx-button-element dx-button-element--primary dx-button-size--md dx-button-block dx-block-button-element dx-block-button-element--primary dx-block-button-element--large">${escapeHtml(module.primaryCta.label)}</a>
        ${secondary}
      </div>
    </div>
  </div>`;
}

function youtubeId(value) {
  try {
    const parsed = new URL(String(value || ''));
    if (parsed.hostname === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] || '';
    if (parsed.hostname.includes('youtube.com')) return parsed.searchParams.get('v') || parsed.pathname.split('/embed/')[1] || '';
  } catch {
    return '';
  }
  return '';
}

export function renderFeaturedCard(row, { preview = false, priority = false } = {}) {
  const artist = row.artist || row.label_override || row.entry_id || 'Featured entry';
  const title = row.instrument && !String(artist).includes(String(row.instrument))
    ? `${artist} – ${row.instrument}`
    : artist;
  const url = row.url || row.entry_href || '#';
  const videoId = youtubeId(row.video);
  const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : '';
  const poster = row.thumbnail
    ? `<img class="dx-home-featured-poster" src="${escapeHtml(row.thumbnail)}" alt="" width="960" height="540" loading="${priority ? 'eager' : 'lazy'}" decoding="async"${priority ? ' fetchpriority="high"' : ''}>`
    : '';
  const media = embedUrl
    ? `<button type="button" class="dex-video-facade dx-home-featured-facade" data-dx-video-embed="${escapeHtml(embedUrl)}" data-dx-video-title="${escapeHtml(title)}" aria-label="Play video (loads YouTube)">${poster}<span class="dex-video-play" aria-hidden="true"></span><span class="dex-video-facade-label">Watch · loads YouTube on play</span></button>`
    : `<a class="dx-home-featured-media-link" href="${escapeHtml(url)}" aria-label="Open ${escapeHtml(title)}">${poster}<span class="dex-video-facade-label">Open entry ↗</span></a>`;
  const badges = [row.lookup, row.instrument, row.season].filter(Boolean)
    .map((value) => `<span class="badge">${escapeHtml(value)}</span>`).join('');
  return `<div class="carousel-card" style="filter:none;-webkit-backdrop-filter:none">
    <h1 class="carousel-title" data-dx-heading-randomize="false"><a href="${escapeHtml(url)}">${escapeHtml(title)}</a></h1>
    <div class="meta-badges">${badges}</div>
    <div class="carousel-video" style="position:relative;width:100%;aspect-ratio:16 / 9;background:#000;border-radius:4px;overflow:hidden;isolation:isolate">${media}</div>
    <p class="lead-text">${escapeHtml(row.leadIn || '')}</p>
  </div>`;
}

function featuredMarkup(module, featuredData, preview) {
  const rows = Array.isArray(featuredData?.featured) ? featuredData.featured.slice(0, 4) : [];
  const card = rows[0] ? renderFeaturedCard(rows[0], { preview, priority: true }) : '';
  const dots = rows.length
    ? `<div class="dx-pagenav__viewport"><div class="dx-pagenav__track">${rows.map((_, index) => `<button type="button" class="dx-pagenav__dot${index === 0 ? ' is-active' : ''}" role="tab" aria-selected="${index === 0 ? 'true' : 'false'}" aria-label="Page ${index + 1} of ${rows.length}"></button>`).join('')}</div></div>`
    : '';
  const frame = card
    ? `<button type="button" class="carousel-nav prev dx-pagenav-arrow dx-pagenav-arrow--prev" aria-label="Previous"></button><div class="carousel-card-host">${card}</div><button type="button" class="carousel-nav next dx-pagenav-arrow dx-pagenav-arrow--next" aria-label="Next"></button>`
    : '';
  return `<div id="dexFeaturedSide" data-module-id="${escapeHtml(module.id)}" data-module-type="featured" data-featured-source="${escapeHtml(module.source)}" style="
    flex:1 1 0;margin:0;padding:0;display:flex;flex-direction:column;height:100%;box-sizing:border-box;">
    <aside class="dex-sidebar" style="
      flex:1 1 auto;display:flex;flex-direction:column;gap:var(--space-3,1rem);padding:var(--space-5,2rem);
      background:var(--dex-bg,rgba(0,0,0,0.15));backdrop-filter:blur(12px);border-radius:4px;
      box-shadow:var(--shadow-md,0 8px 24px rgba(0,0,0,0.12));color:#111;
      font-family:var(--font-body,'Courier New',monospace);box-sizing:border-box;min-height:0;">
      <section class="dex-header" style="text-align:left;margin:0 0 var(--space-2,0.5rem);">
        <h2 id="featuredTitle" data-dx-heading-randomize="false" style="
          margin:0;font:700 clamp(1.5rem,4vw,2rem)/1.2 var(--font-heading,'Typefesse',sans-serif);
          text-transform:uppercase;color:inherit;">${escapeHtml(module.title)}</h2>
      </section>
      <div class="dex-body" style="
        flex:1 1 auto;display:flex;flex-direction:column;justify-content:space-between;
        gap:var(--space-3,1rem);overflow:visible;min-height:0;">
        <div id="carousel-frame" class="carousel-frame" style="
          flex:1 1 auto;min-height:0;position:relative;width:100%;display:flex;
          align-items:flex-end;justify-content:flex-start;overflow:visible;">${frame}</div>
        <div id="carousel-indicators" class="carousel-indicators${rows.length ? ' dx-pagenav' : ''}" ${rows.length ? 'role="tablist" aria-label="Featured entries"' : ''} style="
          display:flex;gap:var(--space-2,0.5rem);justify-content:center;margin-top:var(--space-2,0.5rem);">${dots}</div>
      </div>
    </aside>
  </div>`;
}

function promoMarkup(module) {
  const values = module.values.map((item) => `<li><span class="dx-home-promo-symbol" aria-hidden="true">＋</span><span><strong>${escapeHtml(item.title)}</strong> ${escapeHtml(item.text)}</span></li>`).join('');
  const stats = module.stats.map((item) => `<div><strong>${escapeHtml(item.value)}</strong><small>${escapeHtml(item.label)}</small></div>`).join('');
  const sponsor = module.sponsor
    ? `<div class="dx-home-promo-sponsor"><span>${escapeHtml(module.sponsor.label)}</span><img src="${escapeHtml(module.sponsor.image)}" alt="${escapeHtml(module.sponsor.name)}"><strong>${escapeHtml(module.sponsor.name)}</strong></div>`
    : '';
  const ctas = module.ctas.map((cta, index) => ctaMarkup(cta, index === 0 ? 'is-primary' : 'is-secondary')).join('');
  return `<section class="dx-home-hero-module dx-home-hero-promo" data-module-id="${escapeHtml(module.id)}" data-module-type="promo">
    <div class="dx-home-promo-surface">
      <header>
        <p class="dx-home-promo-eyebrow">${escapeHtml(module.eyebrow)}</p>
        <h1>${escapeHtml(module.headline)}</h1>
        <p>${escapeHtml(module.body)}</p>
      </header>
      ${values ? `<ul>${values}</ul>` : ''}
      ${stats ? `<div class="dx-home-promo-stats">${stats}</div>` : ''}
      <div class="dx-home-promo-footer">${sponsor}<div class="dx-home-promo-ctas">${ctas}</div></div>
    </div>
  </section>`;
}

// Duotone <defs>: desaturate, then map luminance onto a deep-red → orange ramp so
// every still/avatar reads as one wash. Referenced by the tiles via filter:url(#…).
// Hover lifts the filter (full colour) in CSS. Kept inline so it ships with the module.
function season3DuotoneDefs() {
  return `<svg class="dx-s3-defs" aria-hidden="true" focusable="false" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden">
      <filter id="dx-s3-duotone" color-interpolation-filters="sRGB">
        <feColorMatrix type="saturate" values="0"></feColorMatrix>
        <feComponentTransfer>
          <feFuncR type="table" tableValues="0.52 1.00"></feFuncR>
          <feFuncG type="table" tableValues="0.18 0.70"></feFuncG>
          <feFuncB type="table" tableValues="0.14 0.30"></feFuncB>
        </feComponentTransfer>
      </filter>
    </svg>`;
}

// Normalise a catalog entry into a wall tile. image_src is already root-relative
// and deployed; performer/instrument/lookup come straight off the entry.
function catalogEntryToTile(entry) {
  const instrument = Array.isArray(entry.instrument_labels) && entry.instrument_labels.length
    ? entry.instrument_labels[0]
    : (Array.isArray(entry.instrument_family) ? entry.instrument_family[0] : '') || '';
  return {
    kind: 'work',
    name: entry.performer_raw || entry.title_raw || '',
    instrument,
    lookup: entry.lookup_raw || '',
    href: entry.entry_href || '#',
    image: entry.image_src || '',
    season: entry.season || '',
  };
}

// Season-bias order: S3 (accepted) first, then S2, then S1, then anything else.
function seasonRank(season, order) {
  const index = order.indexOf(String(season || '').toUpperCase());
  return index === -1 ? order.length : index;
}

// Build the baseline (SSR/preview) tile set from the catalog: real stills only,
// biased toward the newest season, deduped by performer, capped to capacity.
function catalogTiles(catalogData, module) {
  const entries = Array.isArray(catalogData?.entries) ? catalogData.entries : [];
  const order = ['S3', 'S2', 'S1'];
  const seen = new Set();
  return entries
    .filter((entry) => entry.image_src && (entry.performer_raw || entry.title_raw) && entry.status !== 'hidden')
    .map(catalogEntryToTile)
    .filter((tile) => {
      const key = tile.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => seasonRank(a.season, order) - seasonRank(b.season, order))
    .slice(0, module.wall.capacity);
}

function season3TileMarkup(tile, index) {
  const meta = tile.kind === 'face'
    ? [tile.role, tile.instrument].filter(Boolean).join(' · ')
    : escapeHtml(tile.instrument);
  // Monogram sits behind the image; if the still fails to load it becomes the tile.
  const media = `<span class="dx-s3-tile__mono" aria-hidden="true">${escapeHtml(monogram(tile.name))}</span>${
    tile.image ? `<img class="dx-s3-tile__img" src="${escapeHtml(tile.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.style.display='none'">` : ''
  }`;
  const tag = tile.tag ? `<span class="dx-s3-tile__tag">${escapeHtml(tile.tag)}</span>` : '';
  const lookup = tile.lookup ? `<span class="dx-s3-tile__lookup">${escapeHtml(tile.lookup)}</span>` : '';
  return `<a class="dx-s3-tile dx-s3-tile--${escapeHtml(tile.kind)}" data-card-kind="${escapeHtml(tile.kind)}" data-card-slot="${index}" role="listitem" href="${escapeHtml(tile.href || '#')}" style="--dx-s3-tile-i:${index}">
      <span class="dx-s3-tile__media">${media}<span class="dx-s3-tile__wash" aria-hidden="true"></span></span>
      <span class="dx-s3-tile__body">
        ${tag}
        <span class="dx-s3-tile__name">${escapeHtml(tile.name)}</span>
        ${meta ? `<span class="dx-s3-tile__role">${meta}</span>` : ''}
        ${lookup}
      </span>
    </a>`;
}

function monogram(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '★';
}

function season3OpenTile(index, label, href = '/entry/submit/?flow=sample') {
  return `<a class="dx-s3-tile dx-s3-tile--open" data-card-kind="open" data-card-slot="${index}" role="listitem" href="${escapeHtml(href || '/entry/submit/?flow=sample')}" data-dx-s3-open style="--dx-s3-tile-i:${index}">
      <span class="dx-s3-tile__media"><span class="dx-s3-tile__mono" aria-hidden="true">＋</span><span class="dx-s3-tile__wash" aria-hidden="true"></span></span>
      <span class="dx-s3-tile__body">
        <span class="dx-s3-tile__tag">OPEN</span>
        <span class="dx-s3-tile__name">${escapeHtml(label)}</span>
      </span>
    </a>`;
}

function season3WallMarkup(module, catalogData) {
  const cta = module.cta;
  const wall = module.wall;
  // Baseline tiles for SSR / preview / no-JS. The client re-hydrates this field
  // with member faces + their work, shuffled fresh per load.
  const tiles = catalogTiles(catalogData, module).map((tile) => ({ ...tile, tag: wall.tagLabel }));
  const openLabel = '@you';
  // Open slot leads so "your face here" reads top-left (client keeps it first too).
  const seededTiles = tiles.length
    ? season3OpenTile(0, openLabel, cta.submit.href || '/entry/submit/?flow=sample') + tiles.map((tile, index) => season3TileMarkup(tile, index + 1)).join('')
    : '';
  return `<section class="dx-home-hero-module dx-s3" data-module-id="${escapeHtml(module.id)}" data-module-type="season3-human-credits"
    data-surface="${escapeHtml(module.presentation.surface)}" data-density="${escapeHtml(module.presentation.density)}" data-motion="${escapeHtml(module.presentation.motion)}"
    data-faces-feed="${escapeHtml(wall.facesFeed)}" data-works-feed="${escapeHtml(wall.worksFeed)}"
    data-capacity="${escapeHtml(String(wall.capacity))}" data-face-bias="${wall.faceBias ? 'true' : 'false'}"
    data-fill-stills="${wall.fillWithStills ? 'true' : 'false'}" data-tag-label="${escapeHtml(wall.tagLabel)}"
    data-cta-guest-label="${escapeHtml(cta.guest.label)}"
    data-cta-submit-label="${escapeHtml(cta.submit.label)}" data-cta-submit-href="${escapeHtml(cta.submit.href || '/entry/submit/?flow=sample')}"
    data-cta-active-label="${escapeHtml(cta.active.label)}" data-cta-active-href="${escapeHtml(cta.active.href || '/account/')}"
    data-cta-published-label="${escapeHtml(cta.published.label)}" data-cta-published-href="${escapeHtml(cta.published.href || '/account/')}">
    ${season3DuotoneDefs()}
    <div class="dx-s3__stage">
      <div class="dx-s3__wall" data-dx-s3-wall role="list" aria-label="Dex members and their work">${seededTiles}</div>
      <div class="dx-s3__well">
        <header class="dx-s3__intro">
          <p class="dx-s3__kicker">${escapeHtml(module.kicker)}</p>
          <h1 class="dx-s3__headline" data-dx-heading-duplicate-exclude-words="SEASON,YOU,IS">${escapeHtml(module.headline)}</h1>
          <p class="dx-s3__body">${escapeHtml(module.body)}</p>
          <div class="dx-s3__cta-row">
            <a class="dx-s3__cta" data-dx-s3-cta data-mode="guest" href="${escapeHtml(cta.submit.href || '/entry/submit/?flow=sample')}">${escapeHtml(cta.guest.label)}</a>
            <span class="dx-s3__cta-state" data-dx-s3-cta-state hidden></span>
          </div>
        </header>
      </div>
    </div>
  </section>`;
}

export function renderHomeHero(snapshot, { featuredData = null, catalogData = null, preview = false } = {}) {
  const moduleById = new Map((snapshot.modules || []).map((module) => [module.id, module]));
  const slots = (snapshot.composition?.slots || []).map((moduleId) => {
    const module = moduleById.get(moduleId);
    if (!module) return '';
    if (module.type === 'campaign') return campaignMarkup(module);
    if (module.type === 'featured') return featuredMarkup(module, featuredData, preview);
    if (module.type === 'promo') return promoMarkup(module);
    if (module.type === 'season3-human-credits') return season3WallMarkup(module, catalogData);
    return '';
  }).join('');
  return `<div id="dexCombined" data-layout="${escapeHtml(snapshot.composition?.layout || 'single')}" data-composition-id="${escapeHtml(snapshot.activeCompositionId || '')}" style="
    display:flex;gap:1.75rem;width:100%;height:100%;margin:0;padding:0;box-sizing:border-box;">${slots}</div>`;
}

export function renderHomeHeroPreviewDocument(snapshot, { css = '', styles = [], featuredData = null, catalogData = null } = {}) {
  const styleSheets = Array.isArray(styles) && styles.length ? styles : [css];
  const styleMarkup = styleSheets
    .map((style, index) => `<style data-dx-hero-preview-stylesheet="${index + 1}">\n${String(style || '').replaceAll('</style', '<\\/style')}\n</style>`)
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  ${styleMarkup}
  <style data-dx-hero-preview-shell>
    html,body{margin:0;min-height:100%;background:
      radial-gradient(50rem 32rem at 55% 20%,rgba(255,25,16,.25),transparent 55%),
      radial-gradient(46rem 32rem at 30% 45%,rgba(47,206,255,.22),transparent 60%),#f7f7f8;color:#17181d}
    body{box-sizing:border-box;padding:0!important}
    [data-dx-hero-preview-frame],
    [data-dx-hero-preview-frame]>.dx-block-content,
    [data-dx-hero-preview-frame]>.dx-block-content>.dx-code-container{
      position:static!important;inset:auto!important;transform:none!important;
      min-height:0!important;height:auto!important;box-sizing:border-box!important
    }
    [data-dx-hero-preview-frame]>.dx-block-content,
    [data-dx-hero-preview-frame]>.dx-block-content>.dx-code-container{
      width:100%!important;max-width:none!important;margin:0!important;padding:0!important
    }
    a,button{pointer-events:none}
  </style>
</head>
<body class="homepage" data-dx-hero-preview="true">
  <div id="block-448bd8f915f4abba552b" class="dx-block dx-block-code" data-dx-hero-preview-frame>
    <div class="dx-block-content">
      <div class="dx-code-container">
        <div id="dx-home-hero-root" data-dx-home-hero-root>${renderHomeHero(snapshot, { featuredData, catalogData, preview: true })}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
