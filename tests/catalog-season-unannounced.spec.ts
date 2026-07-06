import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from 'playwright/test';

const DEFAULT_POOL = ['???', '!!!', '***', '@@@'];
const HOME_SIGNUP_CARD_IMAGE = '/assets/img/dex-signup-open-access.webp';

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
  await expect(page.locator('[data-catalog-index-app]')).toHaveAttribute('data-dx-catalog-state', 'ready');
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
    badge: node.querySelector('.dx-catalog-index-season-tag')?.textContent?.trim() || '',
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
    badge: node.querySelector('.dx-catalog-index-season-tag')?.textContent?.trim() || '',
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

test('current thin lane renders the static-first Season 3 submission card with the shared WebP', async ({ page }) => {
  await loadCatalog(page);

  const teaserCard = page.locator('.dx-catalog-index-season-slide--submit');
  await expect(teaserCard).toHaveCount(1);
  await expect(teaserCard).toBeVisible();
  await expect(teaserCard).toHaveAttribute('data-dx-season-card-kind', 'submit');
  await expect(teaserCard).toHaveAttribute('data-dx-campaign-id', 'S3');
  await expect(teaserCard).toContainText('Season 3 is open');
  const image = teaserCard.locator('img[data-dx-season-teaser-image]');
  await expect(image).toHaveAttribute('src', new RegExp(`${HOME_SIGNUP_CARD_IMAGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  await expect(image).toHaveAttribute('loading', 'eager');
  await expect(image).toHaveAttribute('fetchpriority', 'high');
  await expect(teaserCard.locator('a[href="/entry/submit/"]')).toHaveCount(2);

  await selectCarouselGroup(page, 'archive');
  await expect(page.locator('.dx-catalog-index-season-slide--submit')).toHaveCount(0);
});

test('unannounced teaser token derivation remains deterministic', async () => {
  const seasonId = 'S3';
  const index = 0;
  const tokenPool = readSeasonTokenPool(seasonId);
  const seed = 'seed-catalog-primary';
  expect(expectedToken(seed, seasonId, index, tokenPool)).toBe(expectedToken(seed, seasonId, index, tokenPool));
});

test('Season 3 submission card leads the current thin lane after hydration', async ({ page }) => {
  await loadCatalog(page);

  const submitCard = page.locator('.dx-catalog-index-season-track > .dx-catalog-index-season-slide--submit');
  await expect(submitCard).toBeVisible();
  const submitIndex = await submitCard.evaluate((node) => {
    const parent = node.parentElement;
    if (!parent) return -1;
    return Array.prototype.indexOf.call(parent.children, node);
  });
  expect(submitIndex).toBe(0);
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
