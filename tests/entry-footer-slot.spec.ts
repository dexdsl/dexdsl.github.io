import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from 'playwright/test';

declare global {
  interface Window {
    dxNavigate?: (target: string, options?: Record<string, unknown>) => Promise<boolean>;
  }
}

async function useLocalHeaderSlot(page: Page): Promise<void> {
  const runtime = await readFile(path.resolve(process.cwd(), 'public/assets/js/header-slot.js'), 'utf8');
  await page.route(/\/assets\/js\/header-slot\.js(?:[?#].*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: runtime,
    });
  });
}

async function waitForEntryFooterSlot(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const foregroundRoot = document.getElementById('dx-slot-foreground-root');
    const footer = document.getElementById('footer-sections');
    return foregroundRoot instanceof HTMLElement
      && footer instanceof HTMLElement
      && foregroundRoot.contains(footer);
  });
}

async function getEntryFooterMetrics(page: Page) {
  return page.evaluate(() => {
    const foregroundRoot = document.getElementById('dx-slot-foreground-root');
    const footer = document.getElementById('footer-sections');
    const header = document.querySelector('.header-announcement-bar-wrapper');
    const entryLayout = document.querySelector('.dex-entry-layout');
    const footerRect = footer instanceof HTMLElement ? footer.getBoundingClientRect() : null;
    const headerRect = header instanceof HTMLElement ? header.getBoundingClientRect() : null;
    const relation = entryLayout && footer ? entryLayout.compareDocumentPosition(footer) : 0;

    return {
      directBodyFooterCount: Array.from(document.body.children).filter((node) => node.id === 'footer-sections').length,
      footerCount: document.querySelectorAll('#footer-sections').length,
      footerInsideForeground: !!(foregroundRoot && footer && foregroundRoot.contains(footer)),
      footerFollowsEntryLayout: Boolean(relation & Node.DOCUMENT_POSITION_FOLLOWING),
      footerTop: footerRect ? Math.round(footerRect.top) : 0,
      footerHeight: footerRect ? Math.round(footerRect.height) : 0,
      headerBottom: headerRect ? Math.round(headerRect.bottom) : 0,
    };
  });
}

function getEntryCases(): Array<{ slug: string; label: string }> {
  const catalogPath = path.resolve(process.cwd(), 'data/catalog.entries.json');
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  const entries = Array.isArray(catalog?.entries) ? catalog.entries : [];
  const cases = [
    { slug: 'tim-feeney', label: 'Tim Feeney' },
  ];
  const seen = new Set(cases.map((entry) => entry.slug));

  for (const entry of entries) {
    const slug = String(entry?.id || '').trim();
    if (!slug || seen.has(slug)) continue;
    if (String(entry?.season || '').toUpperCase() !== 'S1') continue;
    seen.add(slug);
    cases.push({ slug, label: `S1 ${slug}` });
  }

  return cases;
}

for (const { slug, label } of getEntryCases()) {
  test(`${label} entry keeps the footer in the slot foreground`, async ({ page }) => {
    await useLocalHeaderSlot(page);

    await page.goto(`/entry/${slug}/`, { waitUntil: 'domcontentloaded' });
    await waitForEntryFooterSlot(page);

    const metrics = await getEntryFooterMetrics(page);

    expect(metrics.footerCount).toBe(1);
    expect(metrics.directBodyFooterCount).toBe(0);
    expect(metrics.footerInsideForeground).toBeTruthy();
    expect(metrics.footerFollowsEntryLayout).toBeTruthy();
    expect(metrics.footerHeight).toBeGreaterThan(0);
    expect(metrics.footerTop).toBeGreaterThan(metrics.headerBottom + 20);
  });
}

test('entry footer does not persist across a soft navigation to the bag route', async ({ page }) => {
  await useLocalHeaderSlot(page);

  await page.goto('/entry/tim-feeney/', { waitUntil: 'domcontentloaded' });
  await waitForEntryFooterSlot(page);

  await page.waitForFunction(() => typeof window.dxNavigate === 'function');
  await page.evaluate(async () => {
    const navigate = window.dxNavigate;
    if (typeof navigate !== 'function') throw new Error('dxNavigate unavailable');
    await navigate('/entry/bag/', { pushHistory: true });
  });

  await page.waitForFunction(() => window.location.pathname.replace(/\/+$/, '') === '/entry/bag');
  await page.waitForFunction(() => !!document.getElementById('dex-bag'));

  const footerState = await page.evaluate(() => ({
    directBodyFooterCount: Array.from(document.body.children).filter((node) => node.id === 'footer-sections').length,
    footerCount: document.querySelectorAll('#footer-sections').length,
  }));

  expect(footerState.directBodyFooterCount).toBe(0);
  expect(footerState.footerCount).toBe(0);
});
