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

test('routing into Catalog preserves the persistent gooey-mesh field', async ({ page }) => {
  await useLocalHeaderSlot(page);
  await page.goto('/about/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.dxNavigate === 'function');
  await page.waitForFunction(() => document.querySelectorAll('#gooey-mesh-wrapper .gooey-blob').length >= 5);

  const before = await page.evaluate(() => {
    const blobs = Array.from(document.querySelectorAll<HTMLElement>('#gooey-mesh-wrapper .gooey-blob'));
    const width = window.innerWidth;
    const height = window.innerHeight;
    const yRatios = [0.24, 0.72, 0.38, 0.78, 0.52];
    const snapshot = blobs.map((blob, index) => {
      const radius = Number((blob as any)._rad) || (blob.offsetWidth / 2);
      const availableWidth = Math.max(width - (radius * 2), 1);
      const availableHeight = Math.max(height - (radius * 2), 1);
      const x = radius + (availableWidth * ((index + 1) / (blobs.length + 1)));
      const y = radius + (availableHeight * yRatios[index % yRatios.length]);
      const angle = (index + 1) * 1.17;
      const speed = 5.2 + (index * 0.55);
      const phase = (index + 1) * 2.399963229728653;

      (blob as any)._rad = radius;
      (blob as any)._x = x;
      (blob as any)._y = y;
      (blob as any)._vx = Math.cos(angle) * speed;
      (blob as any)._vy = Math.sin(angle) * speed;
      (blob as any)._phase = phase;
      blob.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      return { x, y, phase };
    });

    void window.dxNavigate?.('/catalog/', { pushHistory: true });
    return snapshot;
  });

  await expect(page).toHaveURL(/\/catalog\/?$/);
  await expect(page.locator('.dx-catalog-index-shell')).toBeVisible();
  await page.waitForTimeout(180);

  const after = await page.evaluate(() => (
    Array.from(document.querySelectorAll<HTMLElement>('#gooey-mesh-wrapper .gooey-blob')).map((blob) => ({
      x: Number((blob as any)._x),
      y: Number((blob as any)._y),
      vx: Number((blob as any)._vx),
      vy: Number((blob as any)._vy),
      phase: Number((blob as any)._phase),
    }))
  ));

  expect(after).toHaveLength(before.length);
  for (let index = 0; index < after.length; index += 1) {
    expect(Math.hypot(after[index].x - before[index].x, after[index].y - before[index].y)).toBeLessThan(64);
    expect(Math.hypot(after[index].vx, after[index].vy)).toBeLessThanOrEqual(10.21);
    expect(Math.hypot(after[index].vx, after[index].vy)).toBeGreaterThanOrEqual(4.1);
    expect(after[index].phase).toBeCloseTo(before[index].phase, 8);
  }

  const horizontalSpread = Math.max(...after.map((item) => item.x)) - Math.min(...after.map((item) => item.x));
  const verticalSpread = Math.max(...after.map((item) => item.y)) - Math.min(...after.map((item) => item.y));
  expect(Math.max(horizontalSpread, verticalSpread)).toBeGreaterThan(180);
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
