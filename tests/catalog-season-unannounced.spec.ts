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

async function selectCarouselGroup(page: Page, groupId: 'current' | 'archive'): Promise<void> {
  const tab = page.locator(`.dx-catalog-index-season-tab[data-dx-carousel-group="${groupId}"]`);
  await expect(tab).toHaveCount(1);
  await tab.click();
}

test.beforeEach(async ({ page }) => {
  await blockExternalRequests(page);
});

test('carousel exposes Current and Archive groups with campaign badges and independent positions', async ({ page }) => {
  await setTeaserSeed(page, 'seed-catalog-groups');
  await loadCatalog(page);

  const tabs = page.locator('.dx-catalog-index-season-tab');
  await expect(tabs).toHaveCount(2);
  expect(await tabs.allTextContents()).toEqual(['Current', 'Archive']);

  const track = page.locator('.dx-catalog-index-season-track');
  const meta = page.locator('.dx-catalog-index-season-meta');
  await expect(track).toHaveAttribute('data-dx-carousel-group', 'current');
  await expect(meta).toHaveText('season 3 + UAV tour 1');

  const entries = readCatalogEntries();
  const expectedCurrentIds = entries
    .filter((entry) => (
      String(entry?.season || '').toUpperCase() === 'S3'
      || (entry?.kind === 'uav' && String(entry?.uav?.tour || '').toUpperCase() === 'T1')
    ))
    .map((entry) => String(entry.id || '').trim())
    .filter(Boolean)
    .sort();
  const currentCards = page.locator('.dx-catalog-index-season-slide[data-dx-season-card-kind="entry"]');
  const currentCardData = await currentCards.evaluateAll((nodes) => nodes.map((node) => ({
    id: node.getAttribute('data-dx-season-card-id') || '',
    campaign: node.getAttribute('data-dx-campaign-id') || '',
    badge: node.querySelector('.dx-catalog-index-season-campaign-badge')?.textContent?.trim() || '',
  })));
  expect(currentCardData.map((row) => row.id).sort()).toEqual(expectedCurrentIds);
  expect(currentCardData.every((row) => ['S3', 'UAV T1'].includes(row.campaign))).toBe(true);
  expect(currentCardData.every((row) => row.badge === row.campaign)).toBe(true);

  const currentSize = Number(await track.getAttribute('data-dx-carousel-size'));
  const currentInitialSlot = Number(await track.getAttribute('data-dx-carousel-active-slot'));
  await clickVisible(page, '[data-dx-carousel-page-button="next"]');
  const currentAdvancedSlot = (currentInitialSlot + 1) % currentSize;
  await expect(track).toHaveAttribute('data-dx-carousel-active-slot', String(currentAdvancedSlot));

  await selectCarouselGroup(page, 'archive');
  await expect(track).toHaveAttribute('data-dx-carousel-group', 'archive');
  await expect(meta).toHaveText('seasons 1–2');

  const expectedArchiveIds = entries
    .filter((entry) => ['S2', 'S1'].includes(String(entry?.season || '').toUpperCase()))
    .map((entry) => String(entry.id || '').trim())
    .filter(Boolean)
    .sort();
  const archiveCards = page.locator('.dx-catalog-index-season-slide[data-dx-season-card-kind="entry"]');
  const archiveCardData = await archiveCards.evaluateAll((nodes) => nodes.map((node) => ({
    id: node.getAttribute('data-dx-season-card-id') || '',
    campaign: node.getAttribute('data-dx-campaign-id') || '',
    badge: node.querySelector('.dx-catalog-index-season-campaign-badge')?.textContent?.trim() || '',
  })));
  expect(archiveCardData.map((row) => row.id).sort()).toEqual(expectedArchiveIds);
  expect(archiveCardData.every((row) => ['S2', 'S1'].includes(row.campaign))).toBe(true);
  expect(archiveCardData.every((row) => row.badge === row.campaign)).toBe(true);

  const archiveSize = Number(await track.getAttribute('data-dx-carousel-size'));
  const archiveInitialSlot = Number(await track.getAttribute('data-dx-carousel-active-slot'));
  await clickVisible(page, '[data-dx-carousel-page-button="next"]');
  await expect(track).toHaveAttribute('data-dx-carousel-active-slot', String((archiveInitialSlot + 1) % archiveSize));

  await selectCarouselGroup(page, 'current');
  await expect(track).toHaveAttribute('data-dx-carousel-active-slot', String(currentAdvancedSlot));
});

test('current carousel renders one non-clickable unannounced collection teaser with growlix token', async ({ page }) => {
  await setTeaserSeed(page, 'seed-catalog-teaser-a');
  await loadCatalog(page);

  const teaserCard = page.locator('.dx-catalog-index-season-slide--unannounced');
  await expect(teaserCard).toHaveCount(1);
  await expect(teaserCard).toBeVisible();
  await expect(teaserCard).toHaveAttribute('data-dx-season-card-kind', 'unannounced');
  await expect(teaserCard).toHaveAttribute('data-dx-campaign-id', 'S3');

  const token = String(await teaserCard.getAttribute('data-dx-growlix-token') || '').trim();
  expect(token.length).toBeGreaterThan(0);
  expect(DEFAULT_POOL).toContain(token);

  await expect(teaserCard.locator('.dx-catalog-index-season-performer')).toHaveText(token);
  await expect(teaserCard).toContainText('this collection has not been announced yet');
  await expect(teaserCard.locator('.dx-catalog-index-season-campaign-badge')).toHaveText('S3');
  await expect(teaserCard.locator('img.dx-catalog-index-season-img')).toHaveAttribute('src', new RegExp(`${HOME_SIGNUP_CARD_IMAGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  await expect(teaserCard.locator('.dx-catalog-index-season-growlix-token')).toHaveCount(0);
  const lockedCta = teaserCard.locator('button.dx-catalog-index-season-open');
  const lockedCtaText = ((await lockedCta.textContent()) || '').replace(/\u200c/g, '').trim();
  expect(lockedCtaText.toLowerCase()).toBe('view collection');
  await expect(lockedCta).toBeDisabled();
  await expect(teaserCard.locator('a')).toHaveCount(0);

  await selectCarouselGroup(page, 'archive');
  await expect(page.locator('.dx-catalog-index-season-slide--unannounced')).toHaveCount(0);
});

test('teaser token is deterministic for a page-load seed and season/index pair', async ({ page, context }) => {
  const primarySeed = 'seed-catalog-primary';
  await setTeaserSeed(page, primarySeed);
  await loadCatalog(page);

  const teaserCard = page.locator('.dx-catalog-index-season-slide--unannounced');
  await expect(teaserCard).toBeVisible();

  const seasonId = String(await teaserCard.getAttribute('data-dx-season-id') || 'S3').toUpperCase();
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

  const tokenTwo = String(await secondPage.locator('.dx-catalog-index-season-slide--unannounced').getAttribute('data-dx-growlix-token') || '').trim();
  expect(tokenTwo).toBe(expectedSecondary);
  if (shouldDiffer) expect(tokenTwo).not.toBe(tokenOne);

  await secondPage.close();
});

test('teaser card insertion index varies by page-load seed (not fixed to trail position)', async ({ page, context }) => {
  const firstSeed = 'seed-catalog-insert-a';
  await setTeaserSeed(page, firstSeed);
  await loadCatalog(page);

  const firstSlides = page.locator('.dx-catalog-index-season-track > .dx-catalog-index-season-slide');
  const firstTotal = await firstSlides.count();
  expect(firstTotal).toBeGreaterThan(0);
  const firstTeaser = page.locator('.dx-catalog-index-season-track > .dx-catalog-index-season-slide--unannounced');
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
    const probeTeaser = probePage.locator('.dx-catalog-index-season-track > .dx-catalog-index-season-slide--unannounced');
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

test('archive carousel includes every valid S1 catalog entry', async ({ page }) => {
  await setTeaserSeed(page, 'seed-catalog-s1-complete');
  await loadCatalog(page);
  await selectCarouselGroup(page, 'archive');

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
});

test('archive carousel pages infinitely by one slot and exposes pips without native scrollbars', async ({ page }) => {
  await setTeaserSeed(page, 'seed-catalog-paged-nav');
  await loadCatalog(page);
  await selectCarouselGroup(page, 'archive');

  const track = page.locator('.dx-catalog-index-season-track');
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

  await clickVisible(page, '[data-dx-carousel-page-button="next"]');
  await expect(track).toHaveAttribute('data-dx-carousel-active-slot', String((initialSlot + 1) % size));

  await clickVisible(page, '[data-dx-carousel-page-button="previous"]');
  await clickVisible(page, '[data-dx-carousel-page-button="previous"]');
  await expect(track).toHaveAttribute('data-dx-carousel-active-slot', String((initialSlot - 1 + size) % size));

  const activePips = page.locator('.dx-catalog-index-season-pips .dx-pagenav__dot.is-active');
  await expect(activePips).toHaveCount(1);
  await expect(activePips).toHaveAttribute('aria-selected', 'true');
  await expect(activePips).toHaveAttribute('aria-label', `Page ${(initialSlot - 1 + size) % size + 1} of ${size}`);
});

test('vertical wheel scrolling survives hover and a preceding horizontal trackpad frame', async ({ page }) => {
  await setTeaserSeed(page, 'seed-catalog-wheel');
  await loadCatalog(page);

  const track = page.locator('.dx-catalog-index-season-track');
  const scrollRoot = page.locator('#dx-slot-scroll-root');
  await expect(scrollRoot).toHaveCount(1);

  const styles = await track.evaluate((node) => {
    const style = window.getComputedStyle(node);
    return {
      overscrollBehaviorX: style.overscrollBehaviorX,
      overscrollBehaviorY: style.overscrollBehaviorY,
    };
  });
  expect(styles.overscrollBehaviorX).toBe('contain');
  expect(styles.overscrollBehaviorY).toBe('auto');

  const card = page.locator('.dx-catalog-index-season-slide[data-dx-carousel-visible-index="0"]');
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + Math.min(box!.height / 2, 120));

  await scrollRoot.evaluate((node) => { (node as HTMLElement).scrollTop = 0; });
  await page.mouse.wheel(0, 320);
  await expect.poll(async () => Number(await scrollRoot.evaluate((node) => (node as HTMLElement).scrollTop))).toBeGreaterThan(0);

  await scrollRoot.evaluate((node) => { (node as HTMLElement).scrollTop = 0; });
  const initialSlot = Number(await track.getAttribute('data-dx-carousel-active-slot'));
  const size = Number(await track.getAttribute('data-dx-carousel-size'));
  await page.mouse.wheel(120, 20);
  await expect(track).toHaveAttribute('data-dx-carousel-active-slot', String((initialSlot + 1) % size));
  expect(Number(await scrollRoot.evaluate((node) => (node as HTMLElement).scrollTop))).toBe(0);

  await page.mouse.wheel(0, 320);
  await expect.poll(async () => Number(await scrollRoot.evaluate((node) => (node as HTMLElement).scrollTop))).toBeGreaterThan(0);
});
