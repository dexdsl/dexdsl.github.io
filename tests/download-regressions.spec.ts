import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page, type Route } from 'playwright/test';

const API_ORIGIN = 'https://dex-api.spring-fog-8edd.workers.dev';
const CELLO_LOOKUP = 'S.Vlc. Lo AV2023 S1';
const UAV_LOOKUP = 'DR.Win. Mo 2026 T1';

type ProtectedFile = {
  fileId: string;
  bucket: string;
  [key: string]: unknown;
};

type ProtectedLookup = {
  lookupNumber: string;
  files: ProtectedFile[];
};

const fulfillJson = (route: Route, payload: unknown, status = 200) => route.fulfill({
  status,
  contentType: 'application/json',
  body: JSON.stringify(payload),
});

const readProtectedLookup = async (lookupNumber: string) => {
  const raw = await readFile(path.resolve(process.cwd(), 'data/protected.assets.json'), 'utf8');
  const parsed = JSON.parse(raw) as { lookups?: ProtectedLookup[] };
  const lookup = (parsed.lookups || []).find((row) => row.lookupNumber === lookupNumber);
  if (!lookup) throw new Error(`Missing protected-assets lookup: ${lookupNumber}`);
  return lookup;
};

const installDownloadHarness = async (page: Page) => {
  await page.addInitScript(() => {
    const viewer = window as typeof window & {
      DEX_AUTH?: unknown;
      dexAuth?: unknown;
      auth0Sub?: string;
      __dxDownloads?: string[];
      __dxBag?: {
        list: (options?: { scope?: string }) => Record<string, unknown>[];
        upsertSelection: (input: Record<string, unknown>, options?: { scope?: string }) => unknown;
      };
    };
    const user = { email: 'download-regression@example.test', sub: 'auth0|download-regression' };
    const auth = {
      ready: Promise.resolve({ authenticated: true, isAuthenticated: true, user }),
      resolve: () => Promise.resolve({ authenticated: true, isAuthenticated: true, user }),
      isAuthenticated: () => Promise.resolve(true),
      getAccessToken: () => Promise.resolve('download-regression-token'),
      getUser: () => Promise.resolve(user),
      signIn: () => Promise.resolve(),
    };
    viewer.DEX_AUTH = auth;
    viewer.dexAuth = auth;
    viewer.auth0Sub = user.sub;
    viewer.__dxDownloads = [];
    window.open = (url: string | URL | undefined) => {
      viewer.__dxDownloads?.push(String(url || ''));
      return { closed: false } as Window;
    };
    HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
      viewer.__dxDownloads?.push(this.href);
    };
    const rows = viewer.__dxBag?.list({ scope: user.sub }) || [];
    if (rows[0]) viewer.__dxBag?.upsertSelection(rows[0], { scope: user.sub });
  });
};

const restoreDownloadHarness = async (page: Page) => {
  await page.evaluate(() => {
    const viewer = window as typeof window & {
      DEX_AUTH?: unknown;
      dexAuth?: unknown;
      auth0Sub?: string;
      __dxDownloads?: string[];
      __dxBag?: {
        list: (options?: { scope?: string }) => Record<string, unknown>[];
        upsertSelection: (input: Record<string, unknown>, options?: { scope?: string }) => unknown;
      };
    };
    const user = { email: 'download-regression@example.test', sub: 'auth0|download-regression' };
    const auth = {
      ready: Promise.resolve({ authenticated: true, isAuthenticated: true, user }),
      resolve: () => Promise.resolve({ authenticated: true, isAuthenticated: true, user }),
      isAuthenticated: () => Promise.resolve(true),
      getAccessToken: () => Promise.resolve('download-regression-token'),
      getUser: () => Promise.resolve(user),
      signIn: () => Promise.resolve(),
    };
    viewer.DEX_AUTH = auth;
    viewer.dexAuth = auth;
    viewer.auth0Sub = user.sub;
    viewer.__dxDownloads ||= [];
    window.open = (url: string | URL | undefined) => {
      viewer.__dxDownloads?.push(String(url || ''));
      return { closed: false } as Window;
    };
    HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
      viewer.__dxDownloads?.push(this.href);
    };
    const rows = viewer.__dxBag?.list({ scope: user.sub }) || [];
    if (rows[0]) viewer.__dxBag?.upsertSelection(rows[0], { scope: user.sub });
  });
};

const installLocalSidebarRuntime = async (page: Page) => {
  const runtime = await readFile(path.resolve(process.cwd(), 'public/assets/dex-sidebar.js'), 'utf8');
  await page.route('https://dexdsl.github.io/assets/dex-sidebar.js', (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: runtime,
  }));
};

test('entry Download Now starts every file returned by multi delivery', async ({ page }) => {
  const cello = await readProtectedLookup(CELLO_LOOKUP);
  const bundleBodies: unknown[] = [];

  await page.route(`${API_ORIGIN}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'POST' && url.pathname === '/me/assets/bag/bundle') {
      bundleBodies.push(JSON.parse(request.postData() || '{}'));
      await fulfillJson(route, {
        status: 'ready',
        delivery: 'multi',
        fileCount: 2,
        downloads: [
          { name: 'cello-a.wav', signedUrl: `${API_ORIGIN}/me/assets/bundle/download?t=entry-a` },
          { name: 'cello-b.mov', signedUrl: `${API_ORIGIN}/me/assets/bundle/download?t=entry-b` },
        ],
      });
      return;
    }
    if (request.method() === 'GET' && decodeURIComponent(url.pathname) === `/me/assets/${CELLO_LOOKUP}`) {
      await fulfillJson(route, { files: cello.files });
      return;
    }
    await fulfillJson(route, { error: 'Unexpected test route' }, 404);
  });

  await installLocalSidebarRuntime(page);
  await installDownloadHarness(page);
  await page.goto('/entry/cello-emmanuel-losa/');
  await restoreDownloadHarness(page);
  await page.locator('#downloads .btn-download').click();

  const modal = page.locator('.dex-download-modal--tree');
  await expect(modal).toBeVisible();
  await page.getByRole('button', { name: 'Select all files in bucket A' }).click();
  await modal.getByRole('button', { name: 'DOWNLOAD NOW' }).click();

  await expect.poll(() => page.evaluate(
    () => (window as typeof window & { __dxDownloads?: string[] }).__dxDownloads || [],
  )).toEqual(expect.arrayContaining([
    `${API_ORIGIN}/me/assets/bundle/download?t=entry-a`,
    `${API_ORIGIN}/me/assets/bundle/download?t=entry-b`,
  ]));
  expect(bundleBodies).toHaveLength(1);
});

test('recording-index buttons use the configured public PDF export', async ({ page }) => {
  await installLocalSidebarRuntime(page);
  await installDownloadHarness(page);
  await page.goto('/entry/cello-emmanuel-losa/');
  await restoreDownloadHarness(page);

  const button = page.locator('#downloads .btn-recording-index');
  await expect(button).toBeEnabled();
  await button.click();

  await expect.poll(() => page.evaluate(
    () => (window as typeof window & { __dxDownloads?: string[] }).__dxDownloads || [],
  )).toContain(
    'https://docs.google.com/spreadsheets/d/1-ZsNlXLIdfAzLgUJakHb9k9rPVn2wFBH_8JLmELA6nA/export?format=pdf&gid=0',
  );
});

test('Mojave X files work through Download Now and bag, with visible bag glyphs', async ({ page }) => {
  const uav = await readProtectedLookup(UAV_LOOKUP);
  expect(uav.files).toHaveLength(5);
  expect(uav.files.every((file) => file.bucket === 'X')).toBe(true);
  const bundleBodies: Array<{ selections?: Array<{ lookup?: string; nodes?: unknown[] }> }> = [];

  await page.route(`${API_ORIGIN}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET' && decodeURIComponent(url.pathname) === `/me/assets/${UAV_LOOKUP}`) {
      await fulfillJson(route, { files: uav.files });
      return;
    }
    if (request.method() === 'POST' && url.pathname === '/me/assets/bag/bundle') {
      bundleBodies.push(JSON.parse(request.postData() || '{}'));
      await fulfillJson(route, {
        status: 'ready',
        delivery: 'multi',
        fileCount: 2,
        downloads: [
          { name: 'DJI_0872.MOV', signedUrl: `${API_ORIGIN}/me/assets/bundle/download?t=uav-a` },
          { name: 'DJI_0873.MOV', signedUrl: `${API_ORIGIN}/me/assets/bundle/download?t=uav-b` },
        ],
      });
      return;
    }
    await fulfillJson(route, { error: 'Unexpected test route' }, 404);
  });

  await installDownloadHarness(page);
  await page.goto('/uav/mojave-wind-farm/');
  await restoreDownloadHarness(page);

  const recordingButton = page.getByRole('button', { name: 'Recording Index PDF' });
  await expect(recordingButton).toBeEnabled();
  await recordingButton.click();
  await expect.poll(() => page.evaluate(
    () => (window as typeof window & { __dxDownloads?: string[] }).__dxDownloads || [],
  )).toContain(
    'https://docs.google.com/spreadsheets/d/1w-mnwQj-uZTLk7pO3ObfrVw10WSQBhQNfrhkdMBgXhM/export?format=pdf&gid=0',
  );

  await page.getByRole('button', { name: 'Get Files' }).click();
  const modal = page.locator('.dex-download-modal--tree');
  await expect(modal.locator('[data-dx-bucket-tab]')).toHaveCount(1);
  await expect(modal.locator('[data-dx-bucket-tab="X"]')).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Select all files in bucket X' }).click();
  await modal.getByRole('button', { name: 'DOWNLOAD NOW' }).click();
  await expect.poll(() => page.evaluate(
    () => (window as typeof window & { __dxDownloads?: string[] }).__dxDownloads || [],
  )).toEqual(expect.arrayContaining([
    `${API_ORIGIN}/me/assets/bundle/download?t=uav-a`,
    `${API_ORIGIN}/me/assets/bundle/download?t=uav-b`,
  ]));

  await modal.getByRole('button', { name: 'Close' }).click();
  await restoreDownloadHarness(page);
  await page.getByRole('button', { name: 'Get Files' }).click();
  const secondModal = page.locator('.dex-download-modal--tree');
  await page.getByRole('button', { name: 'Select all files in bucket X' }).click();
  await Promise.all([
    page.waitForURL('**/entry/bag/'),
    secondModal.locator('.dx-file-tree-actions .dx-button-element--primary').click(),
  ]);
  await restoreDownloadHarness(page);

  await expect(page.locator('.dx-bag-card')).toContainText(UAV_LOOKUP);
  const glyphs = page.locator('.dx-bag-card-actions .dx-bag-control-glyph');
  await expect(glyphs).toHaveCount(2);
  const glyphMetrics = await glyphs.evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    const style = window.getComputedStyle(node);
    return {
      height: rect.height,
      opacity: style.opacity,
      stroke: style.stroke,
      visibility: style.visibility,
      width: rect.width,
    };
  }));
  expect(glyphMetrics).toEqual([
    expect.objectContaining({ width: 16, height: 16, opacity: '1', visibility: 'visible' }),
    expect.objectContaining({ width: 16, height: 16, opacity: '1', visibility: 'visible' }),
  ]);
  expect(glyphMetrics.every((glyph) => glyph.stroke !== 'none')).toBe(true);

  await page.getByRole('button', { name: 'DOWNLOAD BAG' }).click();
  await expect.poll(() => bundleBodies.length).toBe(2);
  expect(bundleBodies).toEqual(expect.arrayContaining([
    expect.objectContaining({
      selections: [expect.objectContaining({
        lookup: UAV_LOOKUP,
        nodes: [expect.objectContaining({ kind: 'collection', lookup: UAV_LOOKUP })],
      })],
    }),
  ]));
});
