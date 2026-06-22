import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from 'playwright/test';

const DEFAULT_POOL = ['???', '!!!', '***', '@@@'];
const HOME_SIGNUP_CARD_IMAGE = '/assets/img/3b1476c230073f7589e3.jpg';

function hashString32(value: string): number {
  let hash = 2166136261;
  const input = String(value || '');
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = (hash * 16777619) >>> 0;
  }
  return hash >>> 0;
}

function expectedToken(seed: string, season: string, index: number, pool: string[]): string {
  const list = Array.isArray(pool) && pool.length ? pool : DEFAULT_POOL;
  const hash = hashString32(`${seed}:${String(season || '').toUpperCase()}:${index}`);
  return list[hash % list.length];
}

function readSeasonTokenPool(seasonId: string): string[] {
  const filePath = path.join(process.cwd(), 'data', 'catalog.seasons.json');
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const seasons = Array.isArray(payload?.seasons) ? payload.seasons : [];
  const season = seasons.find((row: any) => String(row?.id || '').toUpperCase() === String(seasonId || '').toUpperCase());
  const tokens = Array.isArray(season?.unannounced?.tokenPool)
    ? season.unannounced.tokenPool.map((value: unknown) => String(value || '').trim()).filter(Boolean)
    : [];
  return tokens.length ? tokens : DEFAULT_POOL;
}

function readCatalogEntries(): any[] {
  const filePath = path.join(process.cwd(), 'data', 'catalog.entries.json');
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Array.isArray(payload?.entries) ? payload.entries : [];
}

async function clickVisible(page: Page, selector: string): Promise<void> {
  const matches = page.locator(selector);
  const count = await matches.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = matches.nth(index);
    if (await candidate.isVisible()) {
      await candidate.click();
      return;
    }
  }
  throw new Error(`No visible element matched ${selector}`);
}

async function blockExternalRequests(page: Page): Promise<void> {
  await page.route('**/*', async (route) => {
    const rawUrl = route.request().url();
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      await route.continue();
      return;
    }

    if (parsed.protocol === 'data:' || parsed.protocol === 'blob:') {
      await route.continue();
      return;
    }

    if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') {
      await route.continue();
      return;
    }

    await route.abort();
  });
}

async function setTeaserSeed(page: Page, seed: string): Promise<void> {
  await page.addInitScript(({ inputSeed }) => {
    (window as any).__DX_SEASON_TEASER_SEED = inputSeed;
  }, { inputSeed: seed });
}

async function loadCatalog(page: Page): Promise<void> {
  await page.goto('/catalog/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-catalog-index-app]')).toBeVisible();
  await expect(page.locator('.dx-catalog-index-season-track')).toBeVisible();
}

async function selectSeasonTabIfPresent(page: Page, seasonId: string): Promise<void> {
  const tab = page.locator(`.dx-catalog-index-season-tab[data-dx-season-id="${seasonId}"]`).first();
  if (await tab.count()) {
    await tab.click();
  }
}

test.beforeEach(async ({ page }) => {
  await blockExternalRequests(page);
});

test('season carousel renders a non-clickable unannounced teaser card with growlix token', async ({ page }) => {
  await setTeaserSeed(page, 'seed-catalog-teaser-a');
  await loadCatalog(page);
  await selectSeasonTabIfPresent(page, 'S2');

  const teaserCard = page.locator('.dx-catalog-index-season-slide--unannounced').first();
  await expect(teaserCard).toBeVisible();
  await expect(teaserCard).toHaveAttribute('data-dx-season-card-kind', 'unannounced');

  const token = String(await teaserCard.getAttribute('data-dx-growlix-token') || '').trim();
  expect(token.length).toBeGreaterThan(0);
  expect(DEFAULT_POOL).toContain(token);

  await expect(teaserCard.locator('.dx-catalog-index-season-performer').first()).toHaveText(token);
  await expect(teaserCard).toContainText('this artist has not been announced yet');
  await expect(teaserCard.locator('img.dx-catalog-index-season-img').first()).toHaveAttribute('src', new RegExp(`${HOME_SIGNUP_CARD_IMAGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  await expect(teaserCard.locator('.dx-catalog-index-season-growlix-token')).toHaveCount(0);
  const lockedCta = teaserCard.locator('button.dx-catalog-index-season-open').first();
  const lockedCtaText = ((await lockedCta.textContent()) || '').replace(/\u200c/g, '').trim();
  expect(lockedCtaText.toLowerCase()).toBe('view collection');
  await expect(lockedCta).toBeDisabled();
  await expect(teaserCard.locator('a')).toHaveCount(0);
});

test('teaser token is deterministic for a page-load seed and season/index pair', async ({ page, context }) => {
  const primarySeed = 'seed-catalog-primary';
  await setTeaserSeed(page, primarySeed);
  await loadCatalog(page);
  await selectSeasonTabIfPresent(page, 'S2');

  const teaserCard = page.locator('.dx-catalog-index-season-slide--unannounced').first();
  await expect(teaserCard).toBeVisible();

  const seasonId = String(await teaserCard.getAttribute('data-dx-season-id') || 'S2').toUpperCase();
  const index = Number(await teaserCard.getAttribute('data-dx-unannounced-index') || 0);
  const tokenPool = readSeasonTokenPool(seasonId);

  const tokenOne = String(await teaserCard.getAttribute('data-dx-growlix-token') || '').trim();
  expect(tokenOne).toBe(expectedToken(primarySeed, seasonId, index, tokenPool));

  let secondarySeed = 'seed-catalog-secondary';
  let expectedSecondary = expectedToken(secondarySeed, seasonId, index, tokenPool);
  let shouldDiffer = expectedSecondary !== tokenOne;
  if (expectedSecondary === tokenOne) {
    for (let n = 3; n < 30; n += 1) {
      const candidateSeed = `seed-catalog-${n}`;
      const candidateToken = expectedToken(candidateSeed, seasonId, index, tokenPool);
      if (candidateToken !== tokenOne) {
        secondarySeed = candidateSeed;
        expectedSecondary = candidateToken;
        shouldDiffer = true;
        break;
      }
    }
  }

  const secondPage = await context.newPage();
  await blockExternalRequests(secondPage);
  await setTeaserSeed(secondPage, secondarySeed);
  await loadCatalog(secondPage);
  await selectSeasonTabIfPresent(secondPage, seasonId);

  const tokenTwo = String(await secondPage.locator('.dx-catalog-index-season-slide--unannounced').first().getAttribute('data-dx-growlix-token') || '').trim();
  expect(tokenTwo).toBe(expectedSecondary);
  if (shouldDiffer) expect(tokenTwo).not.toBe(tokenOne);

  await secondPage.close();
});

test('teaser card insertion index varies by page-load seed (not fixed to trail position)', async ({ page, context }) => {
  const firstSeed = 'seed-catalog-insert-a';
  await setTeaserSeed(page, firstSeed);
  await loadCatalog(page);
  await selectSeasonTabIfPresent(page, 'S2');

  const firstSlides = page.locator('.dx-catalog-index-season-track > .dx-catalog-index-season-slide');
  const firstTotal = await firstSlides.count();
  expect(firstTotal).toBeGreaterThan(0);
  const firstTeaser = page.locator('.dx-catalog-index-season-track > .dx-catalog-index-season-slide--unannounced').first();
  await expect(firstTeaser).toBeVisible();
  const firstIndex = await firstTeaser.evaluate((node) => {
    const parent = node.parentElement;
    if (!parent) return -1;
    return Array.prototype.indexOf.call(parent.children, node);
  });
  expect(firstIndex).toBeGreaterThanOrEqual(0);

  let secondSeed = 'seed-catalog-insert-b';
  let secondIndex = firstIndex;
  for (let n = 0; n < 40 && secondIndex === firstIndex; n += 1) {
    secondSeed = `seed-catalog-insert-${n + 2}`;
    const probePage = await context.newPage();
    await blockExternalRequests(probePage);
    await setTeaserSeed(probePage, secondSeed);
    await loadCatalog(probePage);
    await selectSeasonTabIfPresent(probePage, 'S2');
    const probeTeaser = probePage.locator('.dx-catalog-index-season-track > .dx-catalog-index-season-slide--unannounced').first();
    await expect(probeTeaser).toBeVisible();
    secondIndex = await probeTeaser.evaluate((node) => {
      const parent = node.parentElement;
      if (!parent) return -1;
      return Array.prototype.indexOf.call(parent.children, node);
    });
    await probePage.close();
  }

  expect(secondIndex).toBeGreaterThanOrEqual(0);
  expect(secondIndex).not.toBe(firstIndex);
});

test('season carousel includes every valid S1 catalog entry, including entries without source images', async ({ page }) => {
  await setTeaserSeed(page, 'seed-catalog-s1-complete');
  await loadCatalog(page);
  await selectSeasonTabIfPresent(page, 'S1');

  const expectedS1 = readCatalogEntries()
    .filter((entry) => String(entry?.season || '').toUpperCase() === 'S1' && String(entry?.lookup_raw || '').trim())
    .map((entry) => String(entry.id || '').trim())
    .filter(Boolean);
  expect(expectedS1.length).toBeGreaterThan(0);

  const renderedIds = await page.locator('.dx-catalog-index-season-track > .dx-catalog-index-season-slide[data-dx-season-card-kind="entry"]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-dx-season-card-id') || ''));

  for (const entryId of expectedS1) {
    expect(renderedIds).toContain(entryId);
  }
  expect(renderedIds).toContain('prepared-bass-viol-suarez-solis');
  expect(renderedIds).toContain('prepared-harpsichord-suarez-solis');

  const sebastianFallbacks = page.locator(
    '.dx-catalog-index-season-slide[data-dx-season-card-id^="prepared-"][data-dx-season-card-id$="suarez-solis"] .dx-catalog-index-season-media--fallback',
  );
  await expect(sebastianFallbacks).toHaveCount(2);
});

test('season carousel pages infinitely by one slot and exposes pips without native scrollbars', async ({ page }) => {
  await setTeaserSeed(page, 'seed-catalog-paged-nav');
  await loadCatalog(page);
  await selectSeasonTabIfPresent(page, 'S1');

  const track = page.locator('.dx-catalog-index-season-track').first();
  await expect(track).toBeVisible();

  const metrics = await track.evaluate((node) => {
    const style = window.getComputedStyle(node);
    return {
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      scrollbarWidth: style.scrollbarWidth,
    };
  });
  expect(metrics.overflowX).toBe('hidden');
  expect(metrics.overflowY).toBe('hidden');
  expect(metrics.scrollbarWidth).toBe('none');

  const size = Number(await track.getAttribute('data-dx-carousel-size'));
  expect(size).toBeGreaterThan(2);
  const initialSlot = Number(await track.getAttribute('data-dx-carousel-active-slot'));
  expect(initialSlot).toBeGreaterThanOrEqual(0);

  await clickVisible(page, '.dx-catalog-index-season-arrow--right');
  await expect(track).toHaveAttribute('data-dx-carousel-active-slot', String((initialSlot + 1) % size));

  await clickVisible(page, '.dx-catalog-index-season-arrow--left');
  await clickVisible(page, '.dx-catalog-index-season-arrow--left');
  await expect(track).toHaveAttribute('data-dx-carousel-active-slot', String((initialSlot - 1 + size) % size));

  const activePips = page.locator('.dx-catalog-index-season-pip.is-active');
  await expect(activePips).toHaveCount(1);
  await expect(activePips.first()).toHaveAttribute('data-dx-carousel-pip', String((initialSlot - 1 + size) % size));
});
