import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from 'playwright/test';

declare global {
  interface Window {
    dxNavigate?: (target: string, options?: Record<string, unknown>) => Promise<boolean>;
    __dxTestViewTransitions?: Array<{ types: string[] }>;
  }
}

async function useLocalHeaderSlot(page: Page, options: { mockViewTransitions?: boolean } = {}): Promise<void> {
  if (options.mockViewTransitions !== false) {
    await page.addInitScript(() => {
      window.__dxTestViewTransitions = [];
      Object.defineProperty(document, 'startViewTransition', {
        configurable: true,
        value: (update: () => void) => {
          const record = { types: [] as string[] };
          window.__dxTestViewTransitions?.push(record);
          const updateCallbackDone = Promise.resolve().then(update);
          const finished = updateCallbackDone.then(() => new Promise<void>((resolve) => {
            window.setTimeout(resolve, 80);
          }));
          return {
            updateCallbackDone,
            ready: updateCallbackDone,
            finished,
            types: {
              add(value: string) {
                if (!record.types.includes(value)) record.types.push(value);
                return this;
              },
            },
            skipTransition() {},
          };
        },
      });
    });
  }
  const runtime = await readFile(path.resolve(process.cwd(), 'public/assets/js/header-slot.js'), 'utf8');
  await page.route(/\/assets\/js\/header-slot\.js(?:[?#].*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: runtime,
    });
  });
}

function createGate() {
  let release!: () => void;
  let markRequested!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requested = new Promise<void>((resolve) => {
    markRequested = resolve;
  });
  return { pending, release, requested, markRequested };
}

test('soft-routing into UAV preloads a complete entry runtime before committing', async ({ page }) => {
  await useLocalHeaderSlot(page);
  await page.goto('/catalog/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.dxNavigate === 'function');

  const sidebarGate = createGate();
  await page.route(/\/assets\/dex-sidebar\.js(?:[?#].*)?$/, async (route) => {
    sidebarGate.markRequested();
    await sidebarGate.pending;
    await route.continue();
  });

  const mojaveCard = page.locator('article').filter({ hasText: 'Mojave Desert' });
  await mojaveCard.getByRole('link', { name: 'Open entry', exact: true }).click();
  await sidebarGate.requested;

  await expect(page).toHaveURL(/\/catalog\/?$/);
  await expect(page.locator('.dx-catalog-index-shell')).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/dx-uav-page/);
  await expect(page.locator('[data-dx-route-progress="visible"]')).toHaveCount(1);

  sidebarGate.release();

  await expect(page).toHaveURL(/\/uav\/mojave-wind-farm\/?$/);
  await expect(page.locator('body[data-dx-uav-ready="true"]')).toHaveClass(/dx-uav-page/);
  await expect(page.locator('.dx-uav-shell')).toBeVisible();
  await expect(page.locator('#dx-entry-runtime-layout-overrides')).toHaveCount(0);
  await expect(page.locator('#dx-entry-button-primitive-overrides')).toHaveCount(0);
  await expect(page.locator('#dx-entry-download-tree-style')).toHaveCount(0);
  await expect(page.locator('link[href*="dx-entry-runtime.css"]')).toHaveCount(1);
  await expect(page.locator('#dex-entry-collection-contract[data-dx-route-inline-style]')).toHaveCount(1);

  const styleState = await page.evaluate(() => {
    const hrefs = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"][href]'))
      .map((link) => new URL(link.href, window.location.href).pathname);
    return {
      hrefs,
      bodyClass: document.body.className,
      stagedCount: document.querySelectorAll('[data-dx-route-style-staged]').length,
    };
  });

  expect(styleState.hrefs).not.toContain('/css/components/dx-catalog-index.css');
  expect(styleState.hrefs).not.toContain('/css/components/dx-marketing-newsletter.css');
  expect(styleState.hrefs.indexOf('/css/components/dx-uav-entry.css'))
    .toBeGreaterThan(styleState.hrefs.indexOf('/assets/css/dex.css'));
  expect(styleState.hrefs.indexOf('/css/components/dx-entry-runtime.css'))
    .toBeGreaterThan(styleState.hrefs.indexOf('/assets/css/dex.css'));
  expect(styleState.hrefs.indexOf('/css/components/dx-uav-entry.css'))
    .toBeGreaterThan(styleState.hrefs.indexOf('/css/components/dx-entry-runtime.css'));
  expect(styleState.bodyClass).not.toContain('homepage');
  expect(styleState.stagedCount).toBe(0);
  await expect(page.locator('[data-dx-route-progress="idle"]')).toHaveCount(1);
  await expect(page.locator('[data-dx-route-shared]')).toHaveCount(0);
  const transitionTypes = await page.evaluate(() => (
    window.__dxTestViewTransitions || []
  ).flatMap((record) => record.types));
  expect(transitionTypes).toContain('dx-detail');
});

test('route intent prefetches UAV HTML before activation', async ({ page }) => {
  await useLocalHeaderSlot(page);
  await page.goto('/catalog/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.dxNavigate === 'function');

  let routeRequests = 0;
  await page.route(/\/uav\/mojave-wind-farm\/?(?:[?#].*)?$/, async (route) => {
    routeRequests += 1;
    await route.continue();
  });

  const mojaveCard = page.locator('article').filter({ hasText: 'Mojave Desert' });
  await mojaveCard.getByRole('link', { name: 'Open entry', exact: true }).hover();
  await expect.poll(() => routeRequests).toBeGreaterThan(0);
  await expect(page).toHaveURL(/\/catalog\/?$/);
  await expect(page.locator('.dx-catalog-index-shell')).toBeVisible();
});

test('routing out of UAV keeps the old body visible until the destination is ready', async ({ page }) => {
  await useLocalHeaderSlot(page);
  await page.goto('/uav/mojave-wind-farm/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.dxNavigate === 'function');
  await expect(page.locator('body[data-dx-uav-ready="true"] .dx-uav-shell')).toBeVisible();

  const aboutGate = createGate();
  await page.route(/\/assets\/js\/dx-about\.js(?:[?#].*)?$/, async (route) => {
    aboutGate.markRequested();
    await aboutGate.pending;
    await route.continue();
  });

  await page.evaluate(() => {
    void window.dxNavigate?.('/about/', { pushHistory: true });
  });
  await aboutGate.requested;

  await expect(page).toHaveURL(/\/uav\/mojave-wind-farm\/?$/);
  await expect(page.locator('body[data-dx-uav-ready="true"] .dx-uav-shell')).toBeVisible();
  await expect(page.locator('#dx-slot-foreground-root')).not.toHaveAttribute('data-dx-motion', 'route-exit');

  aboutGate.release();

  await expect(page).toHaveURL(/\/about\/?$/);
  await expect(page.locator('[data-dx-about-app]')).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/dx-uav-page|dx-entry-page|homepage/);
  await expect(page.locator('#dex-entry-collection-contract')).toHaveCount(0);
  await expect(page.locator('link[href*="dx-uav-entry.css"]')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/dx-slot-routing/);

  const destinationState = await page.evaluate(() => {
    const foreground = document.getElementById('dx-slot-foreground-root');
    const main = foreground?.querySelector('main');
    return {
      foregroundChildren: foreground?.children.length || 0,
      foregroundHeight: foreground instanceof HTMLElement ? foreground.getBoundingClientRect().height : 0,
      foregroundOpacity: foreground instanceof HTMLElement ? getComputedStyle(foreground).opacity : '',
      mainHeight: main instanceof HTMLElement ? main.getBoundingClientRect().height : 0,
    };
  });

  expect(destinationState.foregroundChildren).toBeGreaterThan(0);
  expect(destinationState.foregroundHeight).toBeGreaterThan(100);
  expect(destinationState.mainHeight).toBeGreaterThan(100);
  expect(destinationState.foregroundOpacity).toBe('1');
});

test('history traversal reverses motion and keyboard-directed routing restores focus', async ({ page }) => {
  await useLocalHeaderSlot(page);
  await page.goto('/catalog/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.dxNavigate === 'function');

  const transitionTypes: string[] = [];
  await page.evaluate(() => {
    window.addEventListener('dx:route-transition-in:start', ((event: CustomEvent) => {
      const type = String(event.detail?.type || '');
      if (type) document.documentElement.setAttribute('data-dx-test-last-route-type', type);
    }) as EventListener);
  });

  await page.evaluate(() => window.dxNavigate?.('/about/', {
    pushHistory: true,
    focusDestination: true,
  }));
  await expect(page).toHaveURL(/\/about\/?$/);
  await expect(page.locator('[data-dx-about-app]')).toBeVisible();
  await expect.poll(async () => page.evaluate(() => {
    const active = document.activeElement;
    return Boolean(active && active.closest('#dx-slot-foreground-root'));
  })).toBe(true);
  await expect(page.locator('#dx-route-announcer')).toContainText(/loaded/i);

  transitionTypes.push(...await page.evaluate(() => (
    window.__dxTestViewTransitions || []
  ).flatMap((record) => record.types)));
  expect(transitionTypes).toContain('dx-section');

  await page.goBack();
  await expect(page).toHaveURL(/\/catalog\/?$/);
  await expect(page.locator('html')).toHaveAttribute('data-dx-test-last-route-type', 'dx-back');
});

test('native View Transition path completes with clean routing state', async ({ page }) => {
  await useLocalHeaderSlot(page, { mockViewTransitions: false });
  await page.goto('/catalog/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.dxNavigate === 'function');
  const supported = await page.evaluate(() => typeof document.startViewTransition === 'function');
  test.skip(!supported, 'Browser does not expose document.startViewTransition');

  await page.evaluate(() => window.dxNavigate?.('/about/', { pushHistory: true }));
  await expect(page).toHaveURL(/\/about\/?$/);
  await expect(page.locator('[data-dx-about-app]')).toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute('data-dx-route-transition-type');
  await expect(page.locator('body')).not.toHaveClass(/dx-slot-routing/);
  await expect(page.locator('[data-dx-route-progress="idle"]')).toHaveCount(1);
  await expect(page.locator('#dx-slot-foreground-root')).toHaveCSS('opacity', '1');
});
