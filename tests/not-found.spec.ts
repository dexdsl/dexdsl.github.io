import { expect, test, type Page } from 'playwright/test';

type AuthState = { mode: 'signed-out' | 'token-ready' };
type ApiCall = { path: string; body: Record<string, unknown>; headers: Record<string, string> };

async function stubAuth(page: Page, state: AuthState): Promise<void> {
  await page.route('**/assets/dex-auth.js', async (route) => {
    const mode = state.mode;
    const script = `
      (() => {
        const mode = ${JSON.stringify(mode)};
        const user = mode === 'signed-out' ? null : { sub: 'auth0|not-found-e2e', name: '404 Tester' };
        const auth = {
          ready: Promise.resolve({ isAuthenticated: mode !== 'signed-out' }),
          resolve: () => Promise.resolve({ authenticated: mode !== 'signed-out' }),
          isAuthenticated: () => Promise.resolve(mode !== 'signed-out'),
          getUser: () => Promise.resolve(user),
          getAccessToken: () => Promise.resolve(mode === 'signed-out' ? '' : 'stub-access-token'),
          signIn: (returnTo) => {
            window.__dxTestSignInReturnTo = returnTo;
            return Promise.resolve();
          },
          signOut: () => Promise.resolve(),
          guard: () => Promise.resolve({ status: mode === 'signed-out' ? 'blocked' : 'authenticated' }),
        };
        window.DEX_AUTH = auth;
        window.dexAuth = auth;
        window.auth0Sub = user ? user.sub : '';
        window.AUTH0_USER = user;
        window.dispatchEvent(new CustomEvent('dex-auth:ready', {
          detail: { isAuthenticated: !!user, user }
        }));
      })();
    `;
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: script });
  });
}

async function stubAchievementApi(page: Page, calls: ApiCall[]): Promise<void> {
  await page.route('https://dex-api.spring-fog-8edd.workers.dev/me/achievements/**', async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'authorization,content-type,x-dx-idempotency-key,x-dx-request-id',
    };
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (method === 'POST') {
      calls.push({
        path: url.pathname,
        body: request.postDataJSON() as Record<string, unknown>,
        headers: request.headers(),
      });
    }
    const isSecret = url.pathname.endsWith('/secret-claim');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers,
      body: JSON.stringify({
        ok: true,
        requestId: 'not_found_test',
        state: 'unlocked',
        badgeId: isSecret ? 'vault-easter-egg' : 'found-404',
      }),
    });
  });
}

test('ordinary 404 is a contained recovery page with a useful typo suggestion', async ({ page }) => {
  await stubAuth(page, { mode: 'signed-out' });
  const calls: ApiCall[] = [];
  await stubAchievementApi(page, calls);

  const response = await page.goto('/catlog/');
  expect(response?.status()).toBe(404);

  const heading = page.locator('[data-dx-not-found-title]');
  await expect(heading).toBeVisible();
  await expect.poll(async () => (await heading.innerText()).replace(/\u200c/g, '')).toBe('Page not found.');
  await expect(page.locator('[data-dx-not-found-path]')).toHaveText('/catlog/');
  await expect(page.locator('[data-dx-not-found-suggestion]')).toBeVisible();
  await expect(page.locator('[data-dx-not-found-suggestion-link]')).toHaveAttribute('href', '/catalog/');
  await expect(page.locator('[data-dx-808-machine]')).toBeHidden();
  await expect(page.locator('[data-dx-808-achievements]')).toBeHidden();

  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    surfaceWidth: document.querySelector('.dx-not-found-surface')?.getBoundingClientRect().width || 0,
  }));
  expect(layout.scroll).toBeLessThanOrEqual(layout.viewport);
  expect(layout.surfaceWidth).toBeGreaterThan(250);
  expect(calls).toHaveLength(0);
});

test('unrelated paths do not receive speculative route suggestions', async ({ page }) => {
  await stubAuth(page, { mode: 'signed-out' });
  await stubAchievementApi(page, []);
  await page.goto('/unrelated-random-destination/');
  await expect(page.locator('[data-dx-not-found-suggestion]')).toBeHidden();
});

test('/u profile fallback bypasses the 404 experience', async ({ page }) => {
  await stubAuth(page, { mode: 'signed-out' });
  await page.route('https://dex-api.spring-fog-8edd.workers.dev/u/fallback-tester', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        handle: 'fallback-tester',
        display_name: 'Fallback Tester',
        profile_public: true,
      }),
    });
  });

  const response = await page.goto('/u/fallback-tester/');
  expect(response?.status()).toBe(404);
  await expect(page.locator('html')).toHaveAttribute('data-dx-profile-fallback', 'true');
  await expect(page.locator('#dex-not-found')).toBeHidden();
  await expect.poll(() => page.locator('#dex-profile').getAttribute('data-dx-fetch-state')).toBe('ready');
  await expect(page.locator('#dex-profile')).toContainText('Fallback Tester');
});

test('signed-in 404 visit unlocks the regular achievement without sending route data', async ({ page }) => {
  await stubAuth(page, { mode: 'token-ready' });
  const calls: ApiCall[] = [];
  await stubAchievementApi(page, calls);

  await page.goto('/missing-private-looking-route/?token=not-sent#fragment');
  await expect.poll(() => calls.filter((call) => call.path.endsWith('/route-visit')).length).toBe(1);
  const visit = calls.find((call) => call.path.endsWith('/route-visit'));
  expect(visit?.body).toMatchObject({ kind: 'not-found' });
  expect(visit?.body).not.toHaveProperty('badgeId');
  expect(JSON.stringify(visit?.body)).not.toContain('missing-private-looking-route');
  expect(JSON.stringify(visit?.body)).not.toContain('not-sent');
  expect(visit?.headers.authorization).toBe('Bearer stub-access-token');
});

test('/808 keeps the regular 404 design and claims the canonical secret', async ({ page }) => {
  await stubAuth(page, { mode: 'token-ready' });
  const calls: ApiCall[] = [];
  await stubAchievementApi(page, calls);

  await page.goto('/808');
  await expect(page).toHaveURL(/\/808\/$/);
  const heading = page.locator('[data-dx-not-found-title]');
  await expect(heading).toBeVisible();
  await expect.poll(async () => (await heading.innerText()).replace(/\u200c/g, '')).toBe('Page not found.');
  await expect(page.locator('.dx-not-found-visual')).toBeVisible();
  await expect(page.locator('[data-dx-808-machine], [data-dx-808-step]')).toHaveCount(0);

  const achievements = page.locator('[data-dx-808-achievements]');
  await expect(achievements).toBeVisible();
  await achievements.click();
  await page.waitForURL('**/entry/achievements/?badge=vault-easter-egg');

  const visit = calls.find((call) => call.path.endsWith('/route-visit'));
  const secret = calls.find((call) => call.path.endsWith('/secret-claim'));
  expect(visit?.body).toMatchObject({ kind: 'not-found' });
  expect(secret?.body).toMatchObject({
    claim: 'vault-easter-egg',
    badgeId: 'vault-easter-egg',
  });
});

test('signed-out /808 click stores intent and resumes after authentication', async ({ page }) => {
  const state: AuthState = { mode: 'signed-out' };
  await stubAuth(page, state);
  const calls: ApiCall[] = [];
  await stubAchievementApi(page, calls);

  await page.goto('/808/');
  await page.locator('[data-dx-808-achievements]').click();
  await expect.poll(() => page.evaluate(() => (window as any).__dxTestSignInReturnTo)).toBe('/808/');
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('dx:achievement:pending:v1'))).toContain('vault-easter-egg');

  state.mode = 'token-ready';
  await page.reload();
  await page.waitForURL('**/entry/achievements/?badge=vault-easter-egg');
  expect(calls.some((call) => call.path.endsWith('/secret-claim'))).toBe(true);
});
