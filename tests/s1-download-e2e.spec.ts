import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page, type Route } from 'playwright/test';

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

const installLocalSidebarRuntime = async (page: Page) => {
  const sidebarRuntime = await readFile(path.resolve(process.cwd(), 'assets/dex-sidebar.js'), 'utf8');
  await page.route('https://dexdsl.github.io/assets/dex-sidebar.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: sidebarRuntime,
    });
  });
};

const readProtectedLookup = async () => {
  const raw = await readFile(path.resolve(process.cwd(), 'data/protected.assets.json'), 'utf8');
  const parsed = JSON.parse(raw) as { lookups?: ProtectedLookup[] };
  const lookup = (parsed.lookups || []).find((row) => row.lookupNumber === LOOKUP);
  if (!lookup) throw new Error(`Missing protected-assets lookup: ${LOOKUP}`);
  return lookup;
};

const installAuthenticatedViewer = async (page: Page) => {
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

const restoreAuthenticatedViewer = async (page: Page) => page.evaluate(({ sub }) => {
  const viewer = window as typeof window & {
    DEX_AUTH?: unknown;
    dexAuth?: unknown;
    auth0Sub?: string;
    __dxBag?: {
      list: (options?: { scope?: string }) => Record<string, unknown>[];
      upsertSelection: (input: Record<string, unknown>, options?: { scope?: string }) => unknown;
    };
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

  const rows = viewer.__dxBag?.list({ scope: sub }) || [];
  if (rows[0]) viewer.__dxBag?.upsertSelection(rows[0], { scope: sub });
  return rows;
}, { sub: TEST_USER_SUB });

test('S1 entry files can be added to the bag and downloaded as a secure bundle', async ({ page }) => {
  const protectedLookup = await readProtectedLookup();
  expect(protectedLookup.files).toHaveLength(51);
  expect(protectedLookup.files.filter((file) => {
    const type = String((file as { type?: unknown }).type || '').toLowerCase();
    return type === 'audio' || type === 'video';
  })).toHaveLength(50);

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
        fileCount: 51,
        signedUrl: 'https://downloads.example.test/s1-cello.zip',
      });
      return;
    }

    await fulfillJson(route, { message: 'Unexpected test API route' }, 404);
  });

  await installLocalSidebarRuntime(page);
  await installAuthenticatedViewer(page);

  await page.goto(ENTRY_PATH);
  await expect(page.locator('#downloads .btn-download')).toBeVisible();
  await page.locator('#downloads .btn-download').click();

  await expect(page.locator('.dex-download-modal--tree')).toBeVisible();
  const modal = page.locator('.dex-download-modal--tree');
  await expect(modal.locator('.dx-file-tree-summary')).toHaveCount(0);
  await expect(modal.locator('.dx-file-folder-stack')).toBeVisible();
  await expect(modal.locator('.dx-file-bucket-tabs[role="tablist"]')).toBeVisible();
  await expect(modal.locator('[data-dx-bucket-tab]')).toHaveCount(3);
  await expect(modal.locator('[data-dx-bucket-tab="A"] .dx-file-bucket-tab-label')).toHaveText('WHOLE FILES');
  await expect(modal.locator('[data-dx-bucket-tab="B"] .dx-file-bucket-tab-label')).toHaveText('CHUNKS');
  await expect(modal.locator('[data-dx-bucket-tab="C"] .dx-file-bucket-tab-label')).toHaveText('PHRASES');
  await expect(modal.locator('[data-dx-bucket-tab="A"]')).toHaveAttribute('aria-selected', 'true');
  await expect(modal.locator('[data-dx-bucket-tab="A"] .dx-file-bucket-tab-media')).toContainText(/wav|mov/);
  await expect(modal.locator('[data-dx-bucket-tab="B"] .dx-file-bucket-tab-media')).toBeHidden();
  await expect(modal.locator('.dx-file-tree-panel[role="tabpanel"]')).toBeVisible();
  await expect(modal.locator('.dx-file-tree-row[data-dx-tree-kind="collection"]')).toHaveCount(0);
  await expect(modal.locator('.dx-file-tree-row[data-dx-tree-kind="bucket"]')).toHaveCount(0);
  await expect(modal.locator('.dx-file-tree-meta')).toHaveCount(0);
  await expect(modal.locator('.dx-file-tree-row[data-dx-tree-kind="audio"]')).toBeVisible();

  await page.getByRole('button', { name: 'Select all files in bucket A' }).click();
  await expect(modal.locator('.dx-file-tree-actions .dx-button-element--primary')).toContainText('(3)');
  await expect(modal.locator('[data-dx-bucket-tab="A"]')).toHaveAttribute('data-dx-bucket-selection', 'full');

  await modal.locator('[data-dx-bucket-tab="B"]').click();
  await expect(modal.locator('[data-dx-bucket-tab="B"]')).toHaveAttribute('aria-selected', 'true');
  await expect(modal.locator('[data-dx-bucket-tab="B"] .dx-file-bucket-tab-media')).toContainText(/wav|mov/);
  await expect(modal.locator('input[placeholder="Filter bucket B"]')).toBeVisible();
  await expect(modal.locator('.dx-file-tree-row[data-dx-tree-kind="bucket"]')).toHaveCount(0);
  await expect(modal.getByText('DEFAULT AUDIO')).toHaveCount(0);
  await expect(modal.getByText('000-stereo.wav')).toBeVisible();
  await page.getByRole('button', { name: 'Select all files in bucket B' }).click();
  await expect(modal.locator('.dx-file-tree-actions .dx-button-element--primary')).toContainText('(30)');
  await expect(modal.locator('[data-dx-bucket-tab="A"]')).toHaveAttribute('data-dx-bucket-selection', 'full');
  await expect(modal.locator('[data-dx-bucket-tab="B"]')).toHaveAttribute('data-dx-bucket-selection', 'full');

  await modal.locator('[data-dx-bucket-tab="C"]').click();
  await expect(modal.locator('[data-dx-bucket-tab="C"]')).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Select all files in bucket C' }).click();
  await expect(modal.locator('.dx-file-tree-actions .dx-button-element--primary')).toContainText('(50)');

  await Promise.all([
    page.waitForURL('**/entry/bag/'),
    page.locator('.dx-file-tree-actions .dx-button-element--primary').click(),
  ]);

  await page.waitForFunction(() => {
    const viewer = window as typeof window & { __dxBag?: unknown };
    return Boolean(viewer.__dxBag);
  });
  const persistedRows = await restoreAuthenticatedViewer(page);
  expect(persistedRows).toEqual(expect.arrayContaining([
    expect.objectContaining({
      kind: 'collection',
      lookup: LOOKUP,
    }),
  ]));

  await expect(page.locator('.dx-bag-card')).toContainText(LOOKUP);

  await page.getByRole('button', { name: 'DOWNLOAD BAG' }).click();

  await expect.poll(
    () => page.evaluate(() => {
      const viewer = window as typeof window & { __dxOpenedBagUrls?: string[] };
      return viewer.__dxOpenedBagUrls || [];
    }),
    { timeout: 12_000 }
  ).toContain('https://downloads.example.test/s1-cello.zip');

  await expect(page.locator('.dx-bag-card')).toHaveCount(0);
  await expect(page.locator('[data-bag-stat="files"]')).toHaveText('0');
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
