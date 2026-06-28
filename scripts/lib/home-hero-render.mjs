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

export function renderFeaturedCard(row, { preview = false } = {}) {
  const artist = row.artist || row.label_override || row.entry_id || 'Featured entry';
  const title = row.instrument && !String(artist).includes(String(row.instrument))
    ? `${artist} – ${row.instrument}`
    : artist;
  const url = row.url || row.entry_href || '#';
  const id = youtubeId(row.video);
  const media = preview && row.thumbnail
    ? `<img src="${escapeHtml(row.thumbnail)}" alt="${escapeHtml(title)} featured preview" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`
    : id
      ? `<iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(id)}?rel=0&modestbranding=1&playsinline=1" title="${escapeHtml(title)}" style="position:absolute;inset:0;width:100%;height:100%;border:0;transform:translateZ(0)" playsinline allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>`
      : row.thumbnail
        ? `<img src="${escapeHtml(row.thumbnail)}" alt="${escapeHtml(title)} featured preview" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`
        : `<a href="${escapeHtml(url)}" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;text-decoration:none">Open featured entry</a>`;
  const badges = [row.lookup, row.instrument, row.season].filter(Boolean)
    .map((value) => `<span class="badge">${escapeHtml(value)}</span>`).join('');
  return `<div class="carousel-card" style="filter:none;-webkit-backdrop-filter:none">
    <h1 class="carousel-title"><a href="${escapeHtml(url)}">${escapeHtml(title)}</a></h1>
    <div class="meta-badges">${badges}</div>
    <div class="carousel-video" style="position:relative;width:100%;aspect-ratio:16 / 9;background:#000;border-radius:4px;overflow:hidden;isolation:isolate">${media}</div>
    <p class="lead-text">${escapeHtml(row.leadIn || '')}</p>
  </div>`;
}

function featuredMarkup(module, featuredData, preview) {
  const rows = Array.isArray(featuredData?.featured) ? featuredData.featured.slice(0, 4) : [];
  const card = rows[0] ? renderFeaturedCard(rows[0], { preview }) : '';
  const dots = preview
    ? `<div class="dx-pagenav__viewport"><div class="dx-pagenav__track">${rows.map((_, index) => `<button type="button" class="dx-pagenav__dot${index === 0 ? ' is-active' : ''}" role="tab" aria-selected="${index === 0 ? 'true' : 'false'}" aria-label="Page ${index + 1} of ${rows.length}"></button>`).join('')}</div></div>`
    : '';
  const frame = preview && card
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
        <h2 id="featuredTitle" style="
          margin:0;font:700 clamp(1.5rem,4vw,2rem)/1.2 var(--font-heading,'Typefesse',sans-serif);
          text-transform:uppercase;color:inherit;">${escapeHtml(module.title)}</h2>
      </section>
      <div class="dex-body" style="
        flex:1 1 auto;display:flex;flex-direction:column;justify-content:space-between;
        gap:var(--space-3,1rem);overflow:visible;min-height:0;">
        <div id="carousel-frame" class="carousel-frame" style="
          flex:1 1 auto;min-height:0;position:relative;width:100%;display:flex;
          align-items:flex-end;justify-content:flex-start;overflow:visible;">${frame}</div>
        <div id="carousel-indicators" class="carousel-indicators${preview ? ' dx-pagenav' : ''}" ${preview ? 'role="tablist" aria-label="Featured entries"' : ''} style="
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

function season3ReleaseCard(release, index) {
  const role = release.role ? `<span class="dx-s3-card__role">${escapeHtml(release.role)}</span>` : '';
  return `<a class="dx-s3-card dx-s3-card--release" data-card-kind="release" data-card-slot="${index}" role="listitem" href="${escapeHtml(release.href)}" style="--dx-s3-card-i:${index}">
      <span class="dx-s3-card__tag">IN THE LIBRARY</span>
      <span class="dx-s3-card__name">${escapeHtml(release.name)}</span>
      ${role}
      <span class="dx-s3-card__lookup">${escapeHtml(release.lookup)}</span>
    </a>`;
}

function season3OpeningCard(index) {
  return `<div class="dx-s3-card dx-s3-card--opening" data-card-kind="opening" data-card-slot="${index}" role="listitem" style="--dx-s3-card-i:${index}" aria-hidden="true">
      <span class="dx-s3-card__tag">OPEN</span>
      <span class="dx-s3-card__name">@you</span>
    </div>`;
}

function season3Markup(module) {
  const pipeline = module.pipelineLabels.map((label, index) => (
    `<li class="dx-s3-pipeline__step" style="--dx-s3-step-i:${index}"><span class="dx-s3-pipeline__dot" aria-hidden="true"></span><span class="dx-s3-pipeline__label">${escapeHtml(label)}</span></li>`
  )).join('');
  const assemble = String(module.assembleWord).split('').map((char, index) => (
    `<span class="dx-s3-assemble__char" style="--dx-s3-char-i:${index}" aria-hidden="true">${escapeHtml(char)}</span>`
  )).join('');
  const seeds = module.seedReleases.map((release, index) => season3ReleaseCard(release, index)).join('');
  // Total visible tiles fill the field; profiles replace openings first, then seeds.
  const capacity = Math.max(module.seedReleases.length, Math.min(module.profileCapacity, 60));
  const openings = Array.from({ length: capacity - module.seedReleases.length }, (_unused, offset) => (
    season3OpeningCard(module.seedReleases.length + offset)
  )).join('');
  const cta = module.cta;
  return `<section class="dx-home-hero-module dx-s3" data-module-id="${escapeHtml(module.id)}" data-module-type="season3-human-credits"
    data-surface="${escapeHtml(module.presentation.surface)}" data-density="${escapeHtml(module.presentation.density)}" data-motion="${escapeHtml(module.presentation.motion)}"
    data-profile-feed="${escapeHtml(module.profileFeed)}" data-capacity="${escapeHtml(String(module.profileCapacity))}"
    data-cta-guest-label="${escapeHtml(cta.guest.label)}"
    data-cta-submit-label="${escapeHtml(cta.submit.label)}" data-cta-submit-href="${escapeHtml(cta.submit.href || '/entry/submit/')}"
    data-cta-active-label="${escapeHtml(cta.active.label)}" data-cta-active-href="${escapeHtml(cta.active.href || '/account/')}"
    data-cta-published-label="${escapeHtml(cta.published.label)}" data-cta-published-href="${escapeHtml(cta.published.href || '/account/')}">
    <div class="dx-s3__stage">
      <header class="dx-s3__intro">
        <p class="dx-s3__kicker">${escapeHtml(module.kicker)}</p>
        <h1 class="dx-s3__headline">${escapeHtml(module.headline)}</h1>
        <p class="dx-s3__body">${escapeHtml(module.body)}</p>
        <div class="dx-s3__cta-row">
          <a class="dx-s3__cta" data-dx-s3-cta data-mode="guest" href="${escapeHtml(cta.submit.href || '/entry/submit/')}">${escapeHtml(cta.guest.label)}</a>
          <span class="dx-s3__cta-state" data-dx-s3-cta-state hidden></span>
        </div>
      </header>
      <ol class="dx-s3-pipeline" aria-label="Season 3 pipeline">${pipeline}</ol>
      <div class="dx-s3-assemble" aria-hidden="true"><span class="dx-s3-assemble__word">${assemble}</span></div>
      <div class="dx-s3__field" data-dx-s3-field role="list" aria-label="Season 3 contributors">${seeds}${openings}</div>
    </div>
  </section>`;
}

export function renderHomeHero(snapshot, { featuredData = null, preview = false } = {}) {
  const moduleById = new Map((snapshot.modules || []).map((module) => [module.id, module]));
  const slots = (snapshot.composition?.slots || []).map((moduleId) => {
    const module = moduleById.get(moduleId);
    if (!module) return '';
    if (module.type === 'campaign') return campaignMarkup(module);
    if (module.type === 'featured') return featuredMarkup(module, featuredData, preview);
    if (module.type === 'promo') return promoMarkup(module);
    if (module.type === 'season3-human-credits') return season3Markup(module);
    return '';
  }).join('');
  return `<div id="dexCombined" data-layout="${escapeHtml(snapshot.composition?.layout || 'single')}" data-composition-id="${escapeHtml(snapshot.activeCompositionId || '')}" style="
    display:flex;gap:1.75rem;width:100%;height:100%;margin:0;padding:0;box-sizing:border-box;">${slots}</div>`;
}

export function renderHomeHeroPreviewDocument(snapshot, { css = '', featuredData = null } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    html,body{margin:0;min-height:100%;font-family:"Courier Prime",monospace;background:
      radial-gradient(50rem 32rem at 55% 20%,rgba(255,25,16,.25),transparent 55%),
      radial-gradient(46rem 32rem at 30% 45%,rgba(47,206,255,.22),transparent 60%),#f7f7f8;color:#17181d}
    body{padding:18px;box-sizing:border-box}a,button{pointer-events:none}
    ${css}
  </style>
</head>
<body class="homepage" data-dx-hero-preview="true">${renderHomeHero(snapshot, { featuredData, preview: true })}</body>
</html>`;
}
