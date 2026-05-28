import { test, expect, type Page } from 'playwright/test';

async function installGuardRecorder(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __dxAuthGuardEvents?: Array<Record<string, unknown>> }).__dxAuthGuardEvents = [];
    window.addEventListener('dex-auth:guard', (event: Event) => {
      const custom = event as CustomEvent;
      const list = (window as unknown as { __dxAuthGuardEvents?: Array<Record<string, unknown>> }).__dxAuthGuardEvents;
      if (Array.isArray(list)) {
        list.push((custom.detail || {}) as Record<string, unknown>);
      }
    });
  });
}

async function readGuardEvents(page: Page) {
  return page.evaluate(() => {
    const events = (window as unknown as { __dxAuthGuardEvents?: Array<Record<string, unknown>> }).__dxAuthGuardEvents || [];
    return events;
  });
}

test('protected route hard refresh shows auth guard fallback when redirect is loop-blocked', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('dex.auth.guard.redirect', JSON.stringify({
      path: '/entry/settings',
      ts: Date.now(),
    }));
  });
  await installGuardRecorder(page);

  await page.goto('/entry/settings/', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  await expect
    .poll(async () => page.evaluate(() => !!document.getElementById('dx-settings-auth-fallback')), { timeout: 10_000 })
    .toBe(true);

  const guardStatuses = (await readGuardEvents(page)).map((item) => String(item?.status || ''));

  expect(guardStatuses.includes('blocked') || guardStatuses.includes('redirecting')).toBeTruthy();
});

test('non-protected route does not force auth guard redirect on load', async ({ page }) => {
  await installGuardRecorder(page);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');

  const guardCount = (await readGuardEvents(page)).length;
  expect(guardCount).toBe(0);
});

for (const { route, visibleButton } of [
  { route: '/entry/bojun-zhang/', visibleButton: 'Get Files' },
  { route: '/entry/bag/', visibleButton: 'DOWNLOAD BAG' },
]) {
  test(`${route} does not force auth guard redirect on load`, async ({ page }) => {
    await installGuardRecorder(page);

    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');

    expect(new URL(page.url()).pathname).toBe(route);
    await expect(page.locator('#dx-auth-guard-fallback')).toHaveCount(0);
    await expect(page.getByRole('button', { name: visibleButton, exact: true })).toHaveCount(1);
    const guardCount = (await readGuardEvents(page)).length;
    expect(guardCount).toBe(0);
  });
}
