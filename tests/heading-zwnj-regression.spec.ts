import { expect, test, type Page } from 'playwright/test';

const SEEDED_HEADING_KEY = 'dx-zwnj-seed-2';
const LIGATURE_DUPLICATE_SUPPORTED = new Set(Array.from('ABCDEFGHJKLMNOPQRSTUWZ'));

const LIVE_STATUS_FIXTURE = {
  generatedAt: '2026-02-26T00:00:00.000Z',
  overall: {
    state: 'operational',
    message: 'No incidents reported yet.',
  },
  components: [
    {
      id: 'web',
      name: 'Web App',
      state: 'operational',
      uptime: { h24: 100, d7: null, d30: null },
      latencyMs: 144,
      updatedAt: '2026-02-26T00:00:00.000Z',
    },
  ],
  incidents: [],
};

function stripZwnj(value: string): string {
  return String(value || '').replace(/[\u200c\u200d]/g, '');
}

function countCanonicalDoubleLetters(value: string): number {
  const source = stripZwnj(value);
  const chars = Array.from(source);
  let count = 0;
  for (let index = 0; index < chars.length - 1; index += 1) {
    const current = chars[index];
    const next = chars[index + 1];
    if (!current || !next) continue;
    const currentIsLetter = current.toLowerCase() !== current.toUpperCase();
    const nextIsLetter = next.toLowerCase() !== next.toUpperCase();
    if (!currentIsLetter || !nextIsLetter) continue;
    if (current.toLowerCase() !== next.toLowerCase()) continue;
    count += 1;
  }
  return count;
}

function countJoiner(value: string): number {
  return (String(value || '').match(/\u200d/g) || []).length;
}

function countCanonicalNonJoiner(value: string): number {
  return (String(value || '').match(/\u200c/g) || []).length;
}

function isHeadingJoiner(char: string): boolean {
  return char === '\u200c' || char === '\u200d';
}

function assertAllAdjacentDuplicateLettersJoined(rendered: string): void {
  const chars = Array.from(String(rendered || ''));
  let previousLetter = '';
  let hadSeparatorSincePrevious = false;

  for (const char of chars) {
    if (isHeadingJoiner(char)) {
      hadSeparatorSincePrevious = true;
      continue;
    }

    const isLetter = char.toLowerCase() !== char.toUpperCase();
    if (!isLetter) {
      previousLetter = '';
      hadSeparatorSincePrevious = false;
      continue;
    }

    if (previousLetter && previousLetter.toLowerCase() === char.toLowerCase()) {
      expect(hadSeparatorSincePrevious).toBeTruthy();
    }

    previousLetter = char;
    hadSeparatorSincePrevious = false;
  }
}

function assertJoinersArePlacedBetweenMatchingLetters(rendered: string): void {
  const chars = Array.from(String(rendered || ''));
  for (let index = 0; index < chars.length; index += 1) {
    if (!isHeadingJoiner(chars[index])) continue;

    let prevIndex = index - 1;
    while (prevIndex >= 0 && isHeadingJoiner(chars[prevIndex])) prevIndex -= 1;
    let nextIndex = index + 1;
    while (nextIndex < chars.length && isHeadingJoiner(chars[nextIndex])) nextIndex += 1;

    const prev = prevIndex >= 0 ? chars[prevIndex] : '';
    const next = nextIndex < chars.length ? chars[nextIndex] : '';
    const prevIsLetter = prev.toLowerCase() !== prev.toUpperCase();
    const nextIsLetter = next.toLowerCase() !== next.toUpperCase();
    expect(prevIsLetter).toBeTruthy();
    expect(nextIsLetter).toBeTruthy();
    expect(prev.toLowerCase()).toBe(next.toLowerCase());
  }
}

function findInsertedCharacters(canonical: string, renderedWithoutZwnj: string): string[] {
  const base = Array.from(canonical);
  const rendered = Array.from(renderedWithoutZwnj);
  const inserted: string[] = [];

  let baseIndex = 0;
  let renderedIndex = 0;
  while (baseIndex < base.length && renderedIndex < rendered.length) {
    if (base[baseIndex] === rendered[renderedIndex]) {
      baseIndex += 1;
      renderedIndex += 1;
      continue;
    }
    inserted.push(rendered[renderedIndex]);
    renderedIndex += 1;
  }

  while (renderedIndex < rendered.length) {
    inserted.push(rendered[renderedIndex]);
    renderedIndex += 1;
  }

  return inserted;
}

function hasSingleLetterDuplicateInWord(rendered: string, word: string): boolean {
  const upperRendered = String(rendered || '').toUpperCase();
  const upperWord = String(word || '').toUpperCase();
  if (!upperWord.length) return false;

  const chars = Array.from(upperWord);
  for (let index = 0; index < chars.length; index += 1) {
    const variant = `${chars.slice(0, index + 1).join('')}${chars[index]}${chars.slice(index + 1).join('')}`;
    if (upperRendered.includes(variant)) return true;
  }
  return false;
}

function hasTripleRepeatedLetter(value: string): boolean {
  const source = stripZwnj(value);
  const chars = Array.from(source);
  for (let index = 0; index < chars.length - 2; index += 1) {
    const a = chars[index];
    const b = chars[index + 1];
    const c = chars[index + 2];
    if (!a || !b || !c) continue;
    const aAlpha = a.toLowerCase() !== a.toUpperCase();
    const bAlpha = b.toLowerCase() !== b.toUpperCase();
    const cAlpha = c.toLowerCase() !== c.toUpperCase();
    if (!aAlpha || !bAlpha || !cAlpha) continue;
    if (a.toLowerCase() === b.toLowerCase() && b.toLowerCase() === c.toLowerCase()) return true;
  }
  return false;
}

function assertHeadingTypographyInvariants(heading: { canonical: string; rendered: string; text: string }): void {
  expect(heading.canonical.length).toBeGreaterThan(0);
  expect(heading.rendered.length).toBeGreaterThan(0);
  expect(heading.rendered).toBe(heading.text);
  assertAllAdjacentDuplicateLettersJoined(heading.rendered);
  assertJoinersArePlacedBetweenMatchingLetters(heading.rendered);

  const renderedWithoutZwnj = stripZwnj(heading.rendered);
  const inserted = findInsertedCharacters(heading.canonical, renderedWithoutZwnj);
  const expectedCanonicalNonJoinerCount = countCanonicalDoubleLetters(heading.canonical);
  const expectedDuplicatedJoinerCount = inserted.length;
  expect(countCanonicalNonJoiner(heading.rendered)).toBe(expectedCanonicalNonJoinerCount);
  expect(countJoiner(heading.rendered)).toBe(expectedDuplicatedJoinerCount);
  expect(inserted.length).toBeLessThanOrEqual(1);
  if (inserted.length > 0) {
    const firstUpper = inserted[0]!.toUpperCase();
    expect(inserted.every((char) => char.toUpperCase() === firstUpper)).toBeTruthy();
    expect(LIGATURE_DUPLICATE_SUPPORTED.has(firstUpper)).toBeTruthy();
    expect(new RegExp(`${firstUpper}\\u200d${firstUpper}`, 'i').test(heading.rendered)).toBeTruthy();
  }
}

async function readHeadingBySelector(page: Page, selector: string) {
  return page.locator(selector).evaluate((node) => {
    const element = node as HTMLElement;
    return {
      text: element.textContent || '',
      canonical: element.getAttribute('data-dx-heading-canonical') || '',
      rendered: element.getAttribute('data-dx-heading-rendered') || '',
    };
  });
}

async function collectDonateLabels(page: Page) {
  return page.locator('a[data-dx-donate-normalized="true"]').evaluateAll((nodes) => nodes.map((node) => {
    const anchor = node as HTMLAnchorElement;
    return {
      href: anchor.getAttribute('href') || '',
      text: anchor.textContent || '',
      canonical: anchor.getAttribute('data-dx-donate-canonical') || '',
      rendered: anchor.getAttribute('data-dx-donate-rendered') || '',
    };
  }));
}

async function seedHeadingRuntime(page: Page): Promise<void> {
  await page.addInitScript((seed) => {
    (window as unknown as { __DX_HEADING_RANDOM_SEED?: string }).__DX_HEADING_RANDOM_SEED = seed;
  }, SEEDED_HEADING_KEY);
}

async function stubAuthRuntime(page: Page): Promise<void> {
  const authScript = `
    (() => {
      const auth = {
        ready: Promise.resolve({ isAuthenticated: false }),
        resolve: () => Promise.resolve({ authenticated: false }),
        isAuthenticated: () => Promise.resolve(false),
        getUser: () => Promise.resolve(null),
        signIn: () => Promise.resolve(),
      };
      window.DEX_AUTH = auth;
      window.dexAuth = auth;
      window.auth0Sub = '';
      window.AUTH0_USER = null;
    })();
  `;

  await page.route('**/assets/dex-auth.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: authScript,
    });
  });
}

async function stubStatusEndpoints(page: Page): Promise<void> {
  await page.route('**/data/status.live.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(LIVE_STATUS_FIXTURE),
    });
  });
}

async function collectHeadingMetadata(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((nodes) => nodes
    .map((node) => {
      const element = node as HTMLElement;
      const canonical = element.getAttribute('data-dx-heading-canonical') || '';
      const rendered = element.getAttribute('data-dx-heading-rendered') || '';
      const text = element.textContent || '';
      return {
        tagName: element.tagName.toLowerCase(),
        text,
        canonical,
        rendered,
      };
    })
    .filter((row) => row.text.trim().length > 0));
}

function appendSelectorAttribute(selector: string, attributeSelector: string): string {
  return selector
    .split(',')
    .map((part) => `${part.trim()}${attributeSelector}`)
    .join(', ');
}

async function assertRouteHeadingSurface(page: Page, selector: string, minimumCount: number): Promise<void> {
  await expect.poll(async () => page.locator(selector).count()).toBeGreaterThanOrEqual(minimumCount);
  await expect.poll(async () => page.locator(selector).evaluateAll((nodes) => nodes
    .filter((node) => !node.hasAttribute('data-dx-heading-canonical'))
    .map((node) => ({
      className: node.getAttribute('class') || '',
      text: (node.textContent || '').trim(),
    })))).toEqual([]);

  const headings = await collectHeadingMetadata(page, selector);
  expect(headings.length).toBeGreaterThanOrEqual(minimumCount);
  for (const heading of headings) {
    assertHeadingTypographyInvariants(heading);
  }

  const canonicalOnlySelector = appendSelectorAttribute(
    selector,
    '[data-dx-heading-duplicate-exclude-letters="ABCDEFGHIJKLMNOPQRSTUVWXYZ"]',
  );
  const canonicalOnly = await page.locator(canonicalOnlySelector).evaluateAll((nodes) => nodes.map((node) => ({
    canonical: node.getAttribute('data-dx-heading-canonical') || '',
    rendered: node.getAttribute('data-dx-heading-rendered') || '',
  })));
  for (const heading of canonicalOnly) {
    expect(findInsertedCharacters(heading.canonical, stripZwnj(heading.rendered))).toHaveLength(0);
    expect(countCanonicalNonJoiner(heading.rendered)).toBe(countCanonicalDoubleLetters(heading.canonical));
  }
}

test('every homepage heading string distinguishes organic doubles from display duplicates', async ({ page }) => {
  await seedHeadingRuntime(page);
  await stubAuthRuntime(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-dx-home-hero-root]')).toHaveAttribute('data-ready', 'true');
  await expect.poll(async () => (
    page.locator('body.homepage h1[data-dx-heading-canonical], body.homepage h2[data-dx-heading-canonical]').count()
  )).toBeGreaterThanOrEqual(7);

  const homepageHeadings = await collectHeadingMetadata(
    page,
    'body.homepage h1:not([data-dx-heading-randomize="false"]), '
      + 'body.homepage h2:not([data-dx-heading-randomize="false"]), '
      + 'body.homepage [data-dx-heading-randomize="true"]',
  );
  expect(homepageHeadings.length).toBeGreaterThanOrEqual(7);

  let organicDoubleHeadingCount = 0;
  for (const heading of homepageHeadings) {
    assertHeadingTypographyInvariants(heading);
    const organicDoubleCount = countCanonicalDoubleLetters(heading.canonical);
    if (organicDoubleCount > 0) {
      organicDoubleHeadingCount += 1;
      expect(countCanonicalNonJoiner(heading.rendered)).toBe(organicDoubleCount);
    }
  }
  expect(organicDoubleHeadingCount).toBeGreaterThanOrEqual(3);

  const expectedOrganicHeadings = [
    { selector: '#dex-board-promo-title', pairs: 2 },
    { selector: '#dex-signup .signup-heading', pairs: 3 },
    { selector: '#dex-home-newsletter .dx-home-newsletter-title', pairs: 1 },
  ];
  for (const expected of expectedOrganicHeadings) {
    const heading = await readHeadingBySelector(page, expected.selector);
    assertHeadingTypographyInvariants(heading);
    expect(countCanonicalDoubleLetters(heading.canonical)).toBe(expected.pairs);
    expect(countCanonicalNonJoiner(heading.rendered)).toBe(expected.pairs);
  }

  const rotatingWordSamples = await page.evaluate(() => {
    const target = document.querySelector('[data-dx-hero-rotating]');
    const headingFx = (window as unknown as {
      __dxHeadingFx?: {
        renderHeadingText?: (value: string, options?: Record<string, unknown>) => string;
      };
    }).__dxHeadingFx;
    if (!(target instanceof HTMLElement) || typeof headingFx?.renderHeadingText !== 'function') return [];
    let words: string[] = [];
    try {
      words = JSON.parse(target.getAttribute('data-words') || '[]') as string[];
    } catch {
      words = [];
    }
    return words.map((canonical, index) => {
      const rendered = String(headingFx.renderHeadingText!(canonical, {
        uppercase: false,
        seedKey: `home:rotating:${index}`,
      }) || '');
      return { canonical, rendered, text: rendered };
    });
  });
  expect(rotatingWordSamples.length).toBeGreaterThan(10);
  for (const sample of rotatingWordSamples) {
    assertHeadingTypographyInvariants(sample);
  }

  const featuredTitles = new Set<string>();
  for (let index = 0; index < 4; index += 1) {
    await expect.poll(async () => page.locator('.carousel-title').getAttribute('data-dx-heading-canonical')).toBeTruthy();
    const heading = await readHeadingBySelector(page, '.carousel-title');
    assertHeadingTypographyInvariants(heading);
    featuredTitles.add(heading.canonical);
    if (index < 3) {
      const priorCanonical = heading.canonical;
      await page.locator('.carousel-nav.next').click();
      await expect.poll(async () => (
        page.locator('.carousel-title').getAttribute('data-dx-heading-canonical')
      )).not.toBe(priorCanonical);
    }
  }
  expect(featuredTitles.size).toBe(4);

  const leakedDonateSpellings = await page.locator('body.homepage').evaluate((body) => (
    (body.textContent || '').match(/\bDOONATE\b/gi) || []
  ));
  expect(leakedDonateSpellings).toHaveLength(0);
});

test('catalog, about, and In Dex preserve separator semantics through dynamic and soft renders', async ({ page }) => {
  await seedHeadingRuntime(page);
  await stubAuthRuntime(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });

  const catalogHeadingSelector = [
    '[data-catalog-index-app] .dx-catalog-index-title',
    '[data-catalog-index-app] .dx-catalog-index-hero-title',
    '[data-catalog-index-app] .dx-catalog-index-spotlight-title',
    '[data-catalog-index-app] .dx-catalog-index-browse-title',
    '[data-catalog-index-app] .dx-catalog-index-season-performer',
    '[data-catalog-index-app] .dx-catalog-index-group-title',
    '[data-catalog-index-app] .dx-catalog-index-row-title',
  ].join(', ');
  const aboutHeadingSelector = [
    '[data-dx-about-app] .dx-about-title',
    '[data-dx-about-app] .dx-about-card-title',
    '[data-dx-about-app] .dx-about-team-name',
    '[data-dx-about-app] .dx-about-newsletter-title',
    '[data-dx-about-app] .dx-about-legal-title',
    '[data-dx-about-app] .dx-about-fact-value',
    '[data-dx-about-app] .dx-about-contact-value',
    '[data-dx-about-app] .dx-about-press-value',
  ].join(', ');
  const callHeadingSelector = [
    '[data-call-editorial-app] .dx-call-title',
    '[data-call-editorial-app] .dx-call-section-title',
    '[data-call-editorial-app] .dx-call-lane-title',
    '[data-call-editorial-app] .dx-call-subcall-title',
    '[data-call-editorial-app] .dx-call-timeline-title',
    '[data-call-editorial-app] .dx-call-cycle',
    '[data-call-editorial-app] .dx-call-title-line',
    '[data-call-editorial-app] .dx-call-rail-title',
    '[data-call-editorial-app] .dx-call-utility-cycle',
  ].join(', ');

  await page.goto('/catalog/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.dx-catalog-index-shell')).toBeVisible();
  await page.waitForFunction(() => typeof window.dxNavigate === 'function');
  await assertRouteHeadingSurface(page, catalogHeadingSelector, 12);

  const track = page.locator('.dx-catalog-index-season-track');
  const gutter = page.locator('.dx-catalog-index-season-gutter');
  const priorCarouselIndex = await track.getAttribute('data-dx-carousel-active-index');
  await gutter.focus();
  await gutter.press('ArrowRight');
  await expect.poll(async () => track.getAttribute('data-dx-carousel-active-index')).not.toBe(priorCarouselIndex);
  await assertRouteHeadingSurface(page, catalogHeadingSelector, 12);

  await page.locator('.dx-catalog-index-search').fill('bass');
  await expect(page.locator('.dx-catalog-index-browse-title')).toContainText('matching');
  await assertRouteHeadingSurface(page, catalogHeadingSelector, 5);

  await page.evaluate(() => window.dxNavigate?.('/about/', { pushHistory: true }));
  await expect(page).toHaveURL(/\/about\/?$/);
  await expect(page.locator('.dx-about-editorial')).toBeVisible();
  await assertRouteHeadingSurface(page, aboutHeadingSelector, 12);

  await page.evaluate(() => window.dxNavigate?.('/call/', { pushHistory: true }));
  await expect(page).toHaveURL(/\/call\/?$/);
  await expect(page.locator('.dx-call-shell')).toBeVisible();
  await assertRouteHeadingSurface(page, callHeadingSelector, 10);
  await expect(page.locator('[data-call-editorial-app]')).not.toContainText('RELATTED');
  await expect(page.locator('[data-call-editorial-app]')).not.toContainText('ACTIVEE');
});

test('support and error headings preserve canonical ZWNJ rules with seeded probabilistic duplicates', async ({ page }) => {
  await seedHeadingRuntime(page);
  await stubAuthRuntime(page);
  await stubStatusEndpoints(page);

  await page.goto('/support/', { waitUntil: 'domcontentloaded' });
  await expect.poll(async () => page.locator('#dx-support').getAttribute('data-dx-fetch-state')).toBe('ready');

  const supportHeadings = await collectHeadingMetadata(page, '#dx-support h1, #dx-support h2');
  expect(supportHeadings.length).toBeGreaterThan(0);

  let changedCount = 0;
  let unchangedCount = 0;
  for (const heading of supportHeadings) {
    assertHeadingTypographyInvariants(heading);

    if (stripZwnj(heading.rendered) === heading.canonical) unchangedCount += 1;
    else changedCount += 1;
  }

  expect(changedCount).toBeGreaterThan(0);
  expect(unchangedCount).toBeGreaterThan(0);

  const shellPadding = await page.evaluate(() => {
    const shell = document.querySelector('.dx-support-shell');
    if (!(shell instanceof HTMLElement)) return null;
    const styles = window.getComputedStyle(shell);
    return {
      top: Number.parseFloat(styles.paddingTop || '0'),
      bottom: Number.parseFloat(styles.paddingBottom || '0'),
    };
  });
  expect(shellPadding).not.toBeNull();
  expect(shellPadding!.bottom).toBeGreaterThan(shellPadding!.top);

  await page.goto('/error/?code=500', { waitUntil: 'domcontentloaded' });
  await expect.poll(async () => page.locator('#dx-error').getAttribute('data-dx-fetch-state')).toBe('ready');

  const errorHeading = page.locator('#dx-error-title');
  await expect(errorHeading).toBeVisible();

  const errorCanonical = await errorHeading.getAttribute('data-dx-heading-canonical');
  const errorRendered = await errorHeading.getAttribute('data-dx-heading-rendered');
  const errorText = (await errorHeading.textContent()) || '';

  expect(errorCanonical).toBeTruthy();
  expect(errorRendered).toBeTruthy();
  expect(errorRendered).toBe(errorText);
  const errorRenderedText = errorRendered || '';
  const errorInserted = findInsertedCharacters(errorCanonical || '', stripZwnj(errorRenderedText));
  expect(countCanonicalNonJoiner(errorRenderedText)).toBe(countCanonicalDoubleLetters(errorCanonical || ''));
  expect(countJoiner(errorRenderedText)).toBe(errorInserted.length);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect.poll(async () => page.locator('#featuredTitle').getAttribute('data-dx-heading-canonical')).toBeTruthy();

  const duplicateLigatureLetters = await page.evaluate(
    () => (window as unknown as { __dxHeadingFx?: { duplicateLigatureLetters?: string } }).__dxHeadingFx?.duplicateLigatureLetters || '',
  );
  expect(duplicateLigatureLetters).toBe('ABCDEFGHJKLMNOPQRSTUWZ');
  const headingSeparator = await page.evaluate(
    () => (window as unknown as { __dxHeadingFx?: { separator?: string } }).__dxHeadingFx?.separator || '',
  );
  expect(headingSeparator).toBe('\u200D');
  const headingCanonicalSeparator = await page.evaluate(
    () => (window as unknown as { __dxHeadingFx?: { canonicalSeparator?: string } }).__dxHeadingFx?.canonicalSeparator || '',
  );
  expect(headingCanonicalSeparator).toBe('\u200C');
  const headingDuplicatedSeparator = await page.evaluate(
    () => (window as unknown as { __dxHeadingFx?: { duplicatedSeparator?: string } }).__dxHeadingFx?.duplicatedSeparator || '',
  );
  expect(headingDuplicatedSeparator).toBe('\u200D');
  const spellingsSample = await page.evaluate(() => {
    const canonical = 'SPELLINGS';
    const runtime = (window as unknown as { __dxHeadingFx?: { renderHeadingText?: (value: string, options?: Record<string, unknown>) => string } }).__dxHeadingFx;
    const renderHeadingText = runtime && typeof runtime.renderHeadingText === 'function'
      ? runtime.renderHeadingText
      : null;
    if (!renderHeadingText) return null;
    for (let index = 0; index < 128; index += 1) {
      const rendered = String(renderHeadingText(canonical, { uppercase: false, seedKey: `spellings:${index}` }) || '');
      const plain = rendered.replace(/[\u200c\u200d]/g, '');
      if (plain !== canonical) {
        return { canonical, rendered };
      }
    }
    return { canonical, rendered: String(renderHeadingText(canonical, { uppercase: false, seedKey: 'spellings:none' }) || '') };
  });
  expect(spellingsSample).not.toBeNull();
  expect(spellingsSample!.canonical).toBe('SPELLINGS');
  const spellingsInserted = findInsertedCharacters(spellingsSample!.canonical, stripZwnj(spellingsSample!.rendered));
  expect(spellingsInserted.length).toBeGreaterThan(0);
  assertAllAdjacentDuplicateLettersJoined(spellingsSample!.rendered);
  assertJoinersArePlacedBetweenMatchingLetters(spellingsSample!.rendered);
  expect(countCanonicalNonJoiner(spellingsSample!.rendered)).toBe(1);
  expect(countJoiner(spellingsSample!.rendered)).toBe(spellingsInserted.length);
  expect(new RegExp(`L\\u200cL`, 'i').test(spellingsSample!.rendered)).toBeTruthy();

  const collectionSample = await page.evaluate(() => {
    const runtime = (window as unknown as { __dxHeadingFx?: { renderHeadingText?: (value: string, options?: Record<string, unknown>) => string } }).__dxHeadingFx;
    const renderHeadingText = runtime && typeof runtime.renderHeadingText === 'function'
      ? runtime.renderHeadingText
      : null;
    if (!renderHeadingText) return null;
    const canonical = 'COLLECTION';
    const rendered = String(renderHeadingText(canonical, { uppercase: false, seedKey: 'entry:collection' }) || '');
    return { canonical, rendered };
  });
  expect(collectionSample).not.toBeNull();
  expect(collectionSample!.canonical).toBe('COLLECTION');
  assertAllAdjacentDuplicateLettersJoined(collectionSample!.rendered);
  assertJoinersArePlacedBetweenMatchingLetters(collectionSample!.rendered);
  expect(countCanonicalNonJoiner(collectionSample!.rendered)).toBe(1);
  expect(new RegExp(`L\\u200cL`, 'i').test(collectionSample!.rendered)).toBeTruthy();

  const featuredTitle = await readHeadingBySelector(page, '#featuredTitle');
  assertHeadingTypographyInvariants(featuredTitle);
  expect(featuredTitle.canonical.toUpperCase()).toBe('FEATURED ENTRIES');

  const heroTitle = await readHeadingBySelector(page, '#dexHeroCard h1');
  expect(heroTitle.canonical.length).toBeGreaterThan(0);
  expect(heroTitle.rendered.length).toBeGreaterThan(0);
  const heroInserted = findInsertedCharacters(heroTitle.canonical, stripZwnj(heroTitle.rendered));
  expect(countCanonicalNonJoiner(heroTitle.rendered)).toBe(countCanonicalDoubleLetters(heroTitle.canonical));
  expect(countJoiner(heroTitle.rendered)).toBe(heroInserted.length);
  expect(heroTitle.canonical.toUpperCase()).toContain('RECORDING');
  expect(hasSingleLetterDuplicateInWord(stripZwnj(heroTitle.rendered), 'RECORDING')).toBeFalsy();

  const donateLabels = await collectDonateLabels(page);
  expect(donateLabels.length).toBeGreaterThan(0);
  for (const donate of donateLabels) {
    expect(String(donate.href || '')).toContain('/donate');
    expect(donate.canonical).toBe('DONATE');
    expect(donate.rendered).toBe(donate.text);
    assertAllAdjacentDuplicateLettersJoined(donate.rendered);
    const renderedWithoutZwnj = stripZwnj(donate.rendered);
    const inserted = findInsertedCharacters(donate.canonical, renderedWithoutZwnj);
    expect(countCanonicalNonJoiner(donate.rendered)).toBe(countCanonicalDoubleLetters(donate.canonical));
    expect(countJoiner(donate.rendered)).toBe(inserted.length);
    expect(inserted.length).toBeLessThanOrEqual(1);
    if (inserted.length > 0) {
      const firstUpper = inserted[0]!.toUpperCase();
      expect(inserted.every((char) => char.toUpperCase() === firstUpper)).toBeTruthy();
      expect(LIGATURE_DUPLICATE_SUPPORTED.has(firstUpper)).toBeTruthy();
      expect(new RegExp(`${firstUpper}\\u200d${firstUpper}`, 'i').test(donate.rendered)).toBeTruthy();
    }
  }

  const signupTitle = await readHeadingBySelector(page, '#dex-signup .signup-heading');
  assertHeadingTypographyInvariants(signupTitle);
  expect(signupTitle.canonical.toUpperCase()).toBe('SIGN-UP FOR FREE ACCESS');

  const faqTitle = await readHeadingBySelector(page, '#dex-faq-head');
  assertHeadingTypographyInvariants(faqTitle);
  expect(faqTitle.canonical.toUpperCase()).toBe('FREQUENTLY ASKED QUESTIONS');

  await page.goto('/board/', { waitUntil: 'domcontentloaded' });
  await expect.poll(async () => page.locator('#dexb-title').getAttribute('data-dx-heading-canonical')).toBeTruthy();

  const boardTitle = await readHeadingBySelector(page, '#dexb-title');
  assertHeadingTypographyInvariants(boardTitle);
  expect(boardTitle.canonical.toUpperCase()).toBe('FOUNDING EXPANSION BOARD');

  const boardOverview = await readHeadingBySelector(page, '#p1-overview');
  assertHeadingTypographyInvariants(boardOverview);
  expect(boardOverview.canonical.toUpperCase()).toBe('OVERVIEW');

  await page.goto('/entry/settings/', { waitUntil: 'domcontentloaded' });
  await expect.poll(async () => page.locator('#dexs-title').getAttribute('data-dx-heading-canonical')).toBeTruthy();

  const settingsTitle = await readHeadingBySelector(page, '#dexs-title');
  assertHeadingTypographyInvariants(settingsTitle);
  expect(settingsTitle.canonical.toUpperCase()).toBe('SETTINGS');
  const settingsTitleStyles = await page.locator('#dexs-title').evaluate((el) => {
    const styles = window.getComputedStyle(el);
    return {
      letterSpacing: styles.letterSpacing,
      fontVariantLigatures: styles.fontVariantLigatures,
      fontFeatureSettings: styles.fontFeatureSettings,
    };
  });
  expect(['0px', 'normal']).toContain(settingsTitleStyles.letterSpacing);
  expect(String(settingsTitleStyles.fontVariantLigatures || '').toLowerCase()).not.toBe('none');
  const settingsExcludeLetters = await page.locator('#dexs-title').getAttribute('data-dx-heading-duplicate-exclude-letters');
  expect(settingsExcludeLetters).toBe('G,S,N,I,T');
  const settingsInserted = findInsertedCharacters(settingsTitle.canonical, stripZwnj(settingsTitle.rendered));
  expect(settingsInserted.length).toBe(1);
  const insertedUpper = settingsInserted[0]!.toUpperCase();
  expect(LIGATURE_DUPLICATE_SUPPORTED.has(insertedUpper)).toBeTruthy();
  expect(['G', 'S', 'N', 'I', 'T']).not.toContain(insertedUpper);
  expect(insertedUpper).toBe('E');
  expect(new RegExp(`${insertedUpper}\\u200d${insertedUpper}`, 'i').test(settingsTitle.rendered)).toBeTruthy();
  expect(hasTripleRepeatedLetter(settingsTitle.rendered)).toBeFalsy();

  const settingsHeadings = await collectHeadingMetadata(page, 'main h1, main h2');
  expect(settingsHeadings.length).toBeGreaterThan(0);
  for (const heading of settingsHeadings) {
    assertHeadingTypographyInvariants(heading);
  }
});
