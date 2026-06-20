import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Route } from 'playwright/test';

const API_ORIGIN = 'https://dex-api.spring-fog-8edd.workers.dev';
const LOOKUP = 'S.Vlc. Lo AV2023 S1';
const ENTRY_PATH = '/entry/cello-emmanuel-losa/';
const TEST_USER_SUB = 'auth0|s1-download-e2e';

type ProtectedLookup = {
  lookupNumber: string;
  files: unknown[];
};

const fulfillJson = (route: Route, payload: unknown, status = 200) => route.fulfill({
  status,
  contentType: 'application/json',
  body: JSON.stringify(payload),
});

const readProtectedLookup = async () => {
  const raw = await readFile(path.resolve(process.cwd(), 'data/protected.assets.json'), 'utf8');
  const parsed = JSON.parse(raw) as { lookups?: ProtectedLookup[] };
  const lookup = (parsed.lookups || []).find((row) => row.lookupNumber === LOOKUP);
  if (!lookup) throw new Error(`Missing protected-assets lookup: ${LOOKUP}`);
  return lookup;
};

const installAuthenticatedViewer = async (page: Parameters<typeof test>[0]['page']) => {
  await page.addInitScript(({ sub }) => {
    const viewer = window as typeof window & {
      DEX_AUTH?: unknown;
      dexAuth?: unknown;
      auth0Sub?: string;
      __dxOpenedBagUrls?: string[];
    };
    const user = { email: 's1-download@example.test', sub };
    const auth = {
      ready: Promise.resolve({ isAuthenticated: true, user }),
      resolve: () => Promise.resolve({ isAuthenticated: true, user }),
      isAuthenticated: () => Promise.resolve(true),
      getAccessToken: () => Promise.resolve('s1-download-test-token'),
      getUser: () => Promise.resolve(user),
      signIn: () => Promise.resolve(),
    };
    viewer.DEX_AUTH = auth;
    viewer.dexAuth = auth;
    viewer.auth0Sub = sub;
    viewer.__dxOpenedBagUrls = [];
    window.open = (url: string | URL | undefined) => {
      viewer.__dxOpenedBagUrls?.push(String(url || ''));
      return { closed: false } as Window;
    };
  }, { sub: TEST_USER_SUB });
};

test('S1 entry files can be added to the bag and downloaded as a secure bundle', async ({ page }) => {
  const protectedLookup = await readProtectedLookup();
  expect(protectedLookup.files).toHaveLength(51);

  const apiCalls: string[] = [];
  const bundleBodies: unknown[] = [];

  await page.route(`${API_ORIGIN}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    apiCalls.push(`${request.method()} ${decodeURIComponent(url.pathname)}`);

    if (request.method() === 'GET' && decodeURIComponent(url.pathname) === `/me/assets/${LOOKUP}`) {
      await fulfillJson(route, { files: protectedLookup.files });
      return;
    }

    if (request.method() === 'POST' && url.pathname === '/me/assets/bag/bundle') {
      const rawBody = request.postData() || '{}';
      const body = JSON.parse(rawBody);
      bundleBodies.push(body);
      await fulfillJson(route, {
        delivery: 'sync',
        fileCount: 50,
        signedUrl: 'https://downloads.example.test/s1-cello.zip',
      });
      return;
    }

    await fulfillJson(route, { message: 'Unexpected test API route' }, 404);
  });

  await installAuthenticatedViewer(page);

  await page.goto(ENTRY_PATH);
  await expect(page.locator('#downloads .btn-download')).toBeVisible();
  await page.locator('#downloads .btn-download').click();

  await expect(page.locator('.dex-download-modal--tree')).toBeVisible();
  await expect(page.locator('.dx-file-tree-summary')).toContainText('50 available files');

  await page.locator('.dx-file-tree-tools button').first().click();
  await expect(page.locator('.dx-file-tree-summary')).toContainText('50 of 50 selected');

  await Promise.all([
    page.waitForURL('**/entry/bag/'),
    page.locator('.dx-file-tree-actions .dx-button-element--primary').click(),
  ]);

  await expect(page.locator('.dx-bag-card')).toContainText(LOOKUP);
  await expect(page.locator('.dx-bag-count')).toContainText('50 files in download');

  await page.getByRole('button', { name: 'DOWNLOAD BAG' }).click();

  await expect.poll(
    () => page.evaluate(() => {
      const viewer = window as typeof window & { __dxOpenedBagUrls?: string[] };
      return viewer.__dxOpenedBagUrls || [];
    }),
    { timeout: 12_000 }
  ).toContain('https://downloads.example.test/s1-cello.zip');

  await expect(page.locator('.dx-bag-status')).toContainText('Bundle ready. Opening download');
  expect(apiCalls).toContain(`GET /me/assets/${LOOKUP}`);
  expect(apiCalls).toContain('POST /me/assets/bag/bundle');

  expect(bundleBodies).toHaveLength(1);
  expect(bundleBodies[0]).toMatchObject({
    source: 'entry-bag',
    dedupe: true,
    selections: [
      {
        lookup: LOOKUP,
        nodes: [
          {
            kind: 'collection',
            lookup: LOOKUP,
          },
        ],
      },
    ],
  });
});
