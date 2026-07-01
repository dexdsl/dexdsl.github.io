import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from 'playwright/test';

const ENTRY_ROUTE = '/entry/prepared-bass-viol-suarez-solis/';
const UAV_ROUTE = '/uav/mojave-wind-farm/';
const LONG_CALL_NUMBER = `#${'DR.OBSERVATION.'.repeat(7)}AV2026 T1 X`;

async function installCurrentSidebarAssets(page: Page): Promise<void> {
  const [runtime, css] = await Promise.all([
    readFile(path.resolve(process.cwd(), 'public/assets/dex-sidebar.js'), 'utf8'),
    readFile(path.resolve(process.cwd(), 'public/assets/css/dex.css'), 'utf8'),
  ]);

  await page.route(/\/assets\/dex-sidebar\.js(?:[?#].*)?$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: runtime,
  }));
  await page.route(/\/assets\/css\/dex\.css(?:[?#].*)?$/, (route) => route.fulfill({
    status: 200,
    contentType: 'text/css',
    body: css,
  }));
}

async function waitForRouteReady(page: Page, route: string): Promise<void> {
  if (route === UAV_ROUTE) {
    await expect.poll(() => page.locator('body').getAttribute('data-dx-uav-ready')).toBe('true');
    return;
  }
  await expect.poll(() => page.evaluate(
    () => document.documentElement.dataset.dexSidebarRendered || '',
  )).toBe('1');
}

async function scheduleLookupFit(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as typeof window & {
      __dxEntryComponents?: { bindOverviewLookupFit?: () => void };
    }).__dxEntryComponents?.bindOverviewLookupFit?.();
    window.dispatchEvent(new Event('resize'));
  });
}

async function readLookupState(page: Page) {
  return page.locator('.dex-overview .overview-lookup').evaluate((node) => {
    const element = node as HTMLElement;
    const style = window.getComputedStyle(element);
    const range = document.createRange();
    range.selectNodeContents(element);
    const textWidth = range.getBoundingClientRect().width;
    const availableWidth = Math.max(
      0,
      element.clientWidth
      - Number.parseFloat(style.paddingLeft || '0')
      - Number.parseFloat(style.paddingRight || '0'),
    );
    return {
      text: element.textContent || '',
      textWidth,
      availableWidth,
      computedFontSize: Number.parseFloat(style.fontSize || '0'),
      inlineFontSize: element.style.getPropertyValue('font-size'),
      fitState: element.dataset.dxOverflowFit || '',
      overflowX: style.overflowX,
      textOverflow: style.textOverflow,
    };
  });
}

async function exerciseOverflowOnlyFit(page: Page, route: string): Promise<void> {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await waitForRouteReady(page, route);

  const lookup = page.locator('.dex-overview .overview-lookup');
  await expect(lookup).toBeVisible();
  await page.evaluate(async () => {
    await Promise.race([
      document.fonts?.ready || Promise.resolve(),
      new Promise((resolve) => window.setTimeout(resolve, 500)),
    ]);
  });

  await scheduleLookupFit(page);
  await expect.poll(() => lookup.getAttribute('data-dx-overflow-fit')).toMatch(/^(?:true|false)$/);
  const original = await readLookupState(page);
  expect(original.overflowX).toBe('visible');
  expect(original.textOverflow).toBe('clip');
  expect(original.textWidth).toBeLessThanOrEqual(original.availableWidth + 1);

  await lookup.evaluate((node) => {
    node.textContent = '#D1';
  });
  await scheduleLookupFit(page);
  await expect.poll(() => lookup.getAttribute('data-dx-overflow-fit')).toBe('false');
  const natural = await readLookupState(page);
  expect(natural.inlineFontSize).toBe('');
  expect(natural.text).toBe('#D1');
  expect(natural.textWidth).toBeLessThanOrEqual(natural.availableWidth + 1);

  await lookup.evaluate((node, text) => {
    node.textContent = text;
  }, LONG_CALL_NUMBER);
  await scheduleLookupFit(page);
  await expect.poll(() => lookup.getAttribute('data-dx-overflow-fit')).toBe('true');
  const fitted = await readLookupState(page);
  expect(fitted.text).toBe(LONG_CALL_NUMBER);
  expect(fitted.inlineFontSize).not.toBe('');
  expect(fitted.computedFontSize).toBeLessThan(natural.computedFontSize);
  expect(fitted.textWidth).toBeLessThanOrEqual(fitted.availableWidth + 1);
  expect(fitted.overflowX).toBe('visible');
  expect(fitted.textOverflow).toBe('clip');
}

test.beforeEach(async ({ page }) => {
  await installCurrentSidebarAssets(page);
});

test('entry and UAV sidebar call numbers fit without truncation and scale only on overflow', async ({ page }) => {
  await exerciseOverflowOnlyFit(page, ENTRY_ROUTE);
  await exerciseOverflowOnlyFit(page, UAV_ROUTE);
});
