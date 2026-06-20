import { expect, test, type Route } from 'playwright/test';

declare global {
  interface Window {
    DEX_AUTH: unknown;
    dexAuth: unknown;
    auth0Sub: string | null;
    __dxBag: {
      clear: (options?: { scope?: string }) => unknown;
      upsertSelection: (input: Record<string, unknown>, options?: { scope?: string }) => unknown;
    };
    __dxOpenedBagUrls: string[];
  }
}

test('bag download falls back when the merged bundle job stalls', async ({ page }) => {
  const apiCalls: string[] = [];
  const fulfillJson = (route: Route, payload: unknown, status = 200) => route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });

  await page.route('https://dex-api.spring-fog-8edd.workers.dev/**', async (route) => {
    const requestUrl = new URL(route.request().url());
    const key = `${route.request().method()} ${requestUrl.pathname}`;
    apiCalls.push(key);

    if (requestUrl.pathname === '/me/assets/Test%20Lookup') {
      await fulfillJson(route, {
        files: [
          {
            bucket: 'A',
            fileId: '001',
            type: 'audio',
            availableTypes: ['audio'],
            label: 'A.001 [WAV]',
            sizeBytes: 1024,
          },
        ],
      });
      return;
    }

    if (requestUrl.pathname === '/me/assets/bag/bundle') {
      await fulfillJson(route, {
        delivery: 'async',
        jobId: 'merged-job',
      });
      return;
    }

    if (requestUrl.pathname === '/me/assets/bundle/merged-job') {
      await fulfillJson(route, {
        status: 'pending',
        pollAfterMs: 1,
      });
      return;
    }

    if (requestUrl.pathname === '/me/assets/Test%20Lookup/bundle') {
      await fulfillJson(route, {
        delivery: 'sync',
        signedUrl: 'https://downloads.example.test/fallback.zip',
      });
      return;
    }

    await fulfillJson(route, {});
  });

  await page.goto('/entry/bag/');
  await page.waitForFunction(() => window.__dxBag && document.querySelector('[data-bag-download]'));
  await page.evaluate(() => {
    const user = { email: 'bag-test@example.test', sub: 'auth0|bag-test' };
    const auth = {
      ready: Promise.resolve({ isAuthenticated: true, user }),
      resolve: () => Promise.resolve({ isAuthenticated: true, user }),
      isAuthenticated: () => Promise.resolve(true),
      getAccessToken: () => Promise.resolve('test-token'),
      getUser: () => Promise.resolve(user),
      signIn: () => Promise.resolve(),
    };
    window.DEX_AUTH = auth;
    window.dexAuth = auth;
    window.auth0Sub = user.sub;
    window.__dxOpenedBagUrls = [];
    window.open = (url: string | URL | undefined) => {
      window.__dxOpenedBagUrls.push(String(url || ''));
      return { closed: false } as Window;
    };
    window.__dxBag.clear({ scope: user.sub });
    window.__dxBag.upsertSelection({
      kind: 'bucket',
      lookup: 'Test Lookup',
      bucket: 'A',
      title: 'Test Entry',
      entryHref: '/entries/test/',
      source: 'test',
    }, { scope: user.sub });
  });

  await expect(page.locator('.dx-bag-card')).toContainText('Test Lookup');
  await page.getByRole('button', { name: 'DOWNLOAD BAG' }).click();

  await expect.poll(
    () => page.evaluate(() => window.__dxOpenedBagUrls),
    { timeout: 12_000 }
  ).toContain('https://downloads.example.test/fallback.zip');
  await expect(page.locator('.dx-bag-status')).toContainText('Bundle ready. Opening download');
  expect(apiCalls.filter((call) => call === 'GET /me/assets/bundle/merged-job')).toHaveLength(14);
  expect(apiCalls).toContain('POST /me/assets/Test%20Lookup/bundle');
});

test('bag download waits for slow lookup bundle fallback instead of timing out', async ({ page }) => {
  test.setTimeout(25_000);
  const apiCalls: string[] = [];
  const fulfillJson = (route: Route, payload: unknown, status = 200) => route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });

  await page.route('https://dex-api.spring-fog-8edd.workers.dev/**', async (route) => {
    const requestUrl = new URL(route.request().url());
    const key = `${route.request().method()} ${requestUrl.pathname}`;
    apiCalls.push(key);

    if (requestUrl.pathname === '/me/assets/Test%20Lookup') {
      await fulfillJson(route, {
        files: [
          {
            bucket: 'A',
            fileId: '001',
            type: 'audio',
            availableTypes: ['audio'],
            label: 'A.001 [WAV]',
            sizeBytes: 1024,
          },
        ],
      });
      return;
    }

    if (requestUrl.pathname === '/me/assets/bag/bundle') {
      await fulfillJson(route, {
        fileCount: 0,
      });
      return;
    }

    if (requestUrl.pathname === '/me/assets/Test%20Lookup/bundle') {
      await new Promise((resolve) => setTimeout(resolve, 9500));
      await fulfillJson(route, {
        delivery: 'sync',
        signedUrl: 'https://downloads.example.test/slow-fallback.zip',
      });
      return;
    }

    await fulfillJson(route, {});
  });

  await page.goto('/entry/bag/');
  await page.waitForFunction(() => window.__dxBag && document.querySelector('[data-bag-download]'));
  await page.evaluate(() => {
    const user = { email: 'bag-test@example.test', sub: 'auth0|bag-test' };
    const auth = {
      ready: Promise.resolve({ isAuthenticated: true, user }),
      resolve: () => Promise.resolve({ isAuthenticated: true, user }),
      isAuthenticated: () => Promise.resolve(true),
      getAccessToken: () => Promise.resolve('test-token'),
      getUser: () => Promise.resolve(user),
      signIn: () => Promise.resolve(),
    };
    window.DEX_AUTH = auth;
    window.dexAuth = auth;
    window.auth0Sub = user.sub;
    window.__dxOpenedBagUrls = [];
    window.open = (url: string | URL | undefined) => {
      window.__dxOpenedBagUrls.push(String(url || ''));
      return { closed: false } as Window;
    };
    window.__dxBag.clear({ scope: user.sub });
    window.__dxBag.upsertSelection({
      kind: 'bucket',
      lookup: 'Test Lookup',
      bucket: 'A',
      title: 'Test Entry',
      entryHref: '/entries/test/',
      source: 'test',
    }, { scope: user.sub });
  });

  await expect(page.locator('.dx-bag-card')).toContainText('Test Lookup');
  await page.getByRole('button', { name: 'DOWNLOAD BAG' }).click();

  await expect.poll(
    () => page.evaluate(() => window.__dxOpenedBagUrls),
    { timeout: 15_000 }
  ).toContain('https://downloads.example.test/slow-fallback.zip');
  await expect(page.locator('.dx-bag-status')).toContainText('Bundle ready. Opening download');
  await expect(page.locator('.dx-bag-status')).not.toContainText('Bundle preparation timed out');
  expect(apiCalls).toContain('POST /me/assets/bag/bundle');
  expect(apiCalls).toContain('POST /me/assets/Test%20Lookup/bundle');
});
