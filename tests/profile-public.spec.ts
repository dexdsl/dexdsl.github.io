import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from 'playwright/test';

const API_BASE = 'https://dex-api.spring-fog-8edd.workers.dev';

const profileShellPath = path.resolve(process.cwd(), 'docs/u/index.html');
const sidebarRuntimePath = path.resolve(process.cwd(), 'docs/assets/dex-sidebar.js');

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type',
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function routeProfileShell(page: Page, handle: string): Promise<void> {
  const html = await readFile(profileShellPath, 'utf8');
  await page.route(`**/u/${handle}/`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: html,
    });
  });
}

async function routePublicProfileApi(page: Page, handle: string, body: unknown, status = 200): Promise<void> {
  const pattern = new RegExp(`^${escapeRegExp(API_BASE)}/u/${escapeRegExp(handle)}/?$`);
  await page.route(pattern, async (route) => {
    await route.fulfill({
      status,
      headers: corsHeaders,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

async function routeCatalog(page: Page): Promise<void> {
  const catalogEntries = [
    {
      lookup: 'S.Vlc. Lo AV2023 S1',
      slug: 'cello-emmanuel-losa',
      href: '/entry/cello-emmanuel-losa/',
      title: 'Cello - Emmanuel Losa',
      performer_display: 'emmanuel losa',
      image_src: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 fill=%22%23ff2d13%22/%3E%3C/svg%3E',
      image_alt_raw: 'Cello preview',
    },
  ];
  await page.route('**/data/catalog-performers.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generated_at: '2026-06-21T00:00:00.000Z',
        entries: catalogEntries,
      }),
    });
  });
  await page.route('**/data/catalog.entries.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generated_at: '2026-06-21T00:00:00.000Z',
        entries: catalogEntries.map((entry) => ({
          lookup_raw: entry.lookup,
          id: entry.slug,
          entry_href: entry.href,
          title_raw: entry.title,
          performer_raw: entry.performer_display,
          image_src: entry.image_src,
          image_alt_raw: entry.image_alt_raw,
        })),
      }),
    });
  });
}

async function routeLocalSidebarRuntime(page: Page): Promise<void> {
  const runtime = await readFile(sidebarRuntimePath, 'utf8');
  await page.route('https://dexdsl.github.io/assets/dex-sidebar.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: runtime,
    });
  });
}

test('public profile static fallback loads shell assets for dynamic /u handles', async ({ page }) => {
  await routeCatalog(page);
  await routePublicProfileApi(page, 'tester', {
    dex_id: 'DEX-7Q2KP4',
    handle: 'tester',
    profile_public: true,
    credit_name: 'Test Performer',
    bio: 'Builds playable sample instruments.',
    links: [],
    roles: [],
    instruments: [],
    contributions: [],
    favorites_public: false,
    favorites: [],
  });

  const response = await page.goto('/u/tester/', { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(404);

  await expect(page.locator('html')).toHaveAttribute('data-dx-profile-fallback', 'true');
  await expect(page.locator('link[href="/css/components/dx-profile-public.css"]')).toHaveCount(1);
  await expect(page.locator('#dex-profile')).toHaveAttribute('data-dx-fetch-state', 'ready');
  await expect(page.locator('h1.dx-prof-name')).toHaveText('Test Performer');
  await expect
    .poll(() => page.evaluate(() => Boolean((window as typeof window & { __dxProfilePublicLoaded?: boolean }).__dxProfilePublicLoaded)))
    .toBeTruthy();
});

test('public profile route renders logged out with hydrated contributions, favorites, and copyable Dex ID', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:8080' });
  await routeCatalog(page);
  await routeProfileShell(page, 'tester');

  // The auth runtime must load on profile pages so the header account menu
  // mounts (and survives SPA navigation). The page still renders publicly.
  let authRuntimeRequested = false;
  await page.route('**/assets/dex-auth.js', async (route) => {
    authRuntimeRequested = true;
    await route.fulfill({ status: 404, contentType: 'application/javascript', body: '' });
  });

  await routePublicProfileApi(page, 'tester', {
    dex_id: 'DEX-7Q2KP4',
    handle: 'tester',
    profile_public: true,
    name: 'Test Performer',
    bio: 'Builds playable sample instruments.',
    pronouns: 'they/them',
    location: 'Los Angeles',
    provider: {
      picture: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 fill=%22%2300a1ff%22/%3E%3C/svg%3E',
    },
    links: [{ label: 'Site', url: 'https://example.com' }],
    roles: ['Performer', 'Composer'],
    role_primary: 'Performer',
    instruments: ['Cello'],
    instrument_primary: 'Cello',
    contributions: [
      {
        lookup: 'S.Vlc. Lo AV2023 S1',
        role: 'Performer',
        featured: true,
      },
    ],
    favorites_public: true,
    favorites: ['entry|S.Vlc. Lo AV2023 S1'],
  });

  await page.goto('/u/tester/', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#dex-profile')).toHaveAttribute('data-dx-fetch-state', 'ready');
  await expect(page.locator('h1.dx-prof-name')).toHaveText('Test Performer');
  await expect(page.locator('.dx-prof-handle')).toHaveText('@tester');
  await expect(page.locator('.dx-prof-avatar-img')).toBeVisible();
  await expect(page.locator('.dx-prof-bio')).toContainText('Builds playable sample instruments.');
  await expect(page.locator('.dx-prof-link')).toHaveAttribute('href', 'https://example.com');
  // Contributions render as collection cards; favorites keep the compact card.
  await expect(page.locator('.dx-prof-collection-title').filter({ hasText: 'Cello - Emmanuel Losa' })).toHaveCount(1);
  await expect(page.locator('.dx-prof-card-title').filter({ hasText: 'Cello - Emmanuel Losa' })).toHaveCount(1);
  await expect(page.locator('.dx-prof-grid--favorites .dx-prof-card-thumb img')).toBeVisible();
  await expect(page.locator('.dx-prof-grid--favorites a.dx-prof-card')).toHaveAttribute('href', '/entry/cello-emmanuel-losa/');
  await expect(page.locator('.dx-prof-section-title').filter({ hasText: 'Favorite samples & collections' })).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/dx-route-profile-protected/);
  expect(authRuntimeRequested).toBe(true);

  const dexButton = page.locator('[data-dx-copy="DEX-7Q2KP4"]');
  await dexButton.click();
  await expect(dexButton).toHaveText('Copied');
});

test('public profile route keeps loader visible before private or missing profiles resolve', async ({ page }) => {
  await routeCatalog(page);
  await routeProfileShell(page, 'private');
  let releaseApi: () => void = () => {};
  const apiGate = new Promise<void>((resolve) => {
    releaseApi = resolve;
  });

  await page.route(new RegExp(`^${escapeRegExp(API_BASE)}/u/private/?$`), async (route) => {
    await apiGate;
    await route.fulfill({
      status: 404,
      headers: corsHeaders,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'not_found' }),
    });
  });

  await page.goto('/u/private/', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-dx-route-loader]')).toHaveCount(1);
  await expect(page.locator('#dex-profile')).toHaveAttribute('data-dx-fetch-state', 'loading');
  releaseApi();
  await expect(page.locator('#dex-profile')).toHaveAttribute('data-dx-fetch-state', 'error');
  await expect(page.locator('h1')).toHaveText('Profile not found');
  await expect(page.locator('body')).not.toHaveClass(/dx-route-profile-protected/);
});

test('entry sidebar links credited performers when public profile map contains a match', async ({ page }) => {
  await routeLocalSidebarRuntime(page);

  await page.route('**/data/public-profiles.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generated_at: '2026-06-21T00:00:00.000Z',
        source: 'profile-public-e2e',
        entries: {
          'S.Vlc. Lo AV2023 S1': {
            handle: 'tester',
            dex_id: 'DEX-7Q2KP4',
            credit_name: 'emmanuel losa',
          },
        },
        profiles: {},
      }),
    });
  });

  await page.goto('/entry/cello-emmanuel-losa/', { waitUntil: 'domcontentloaded' });

  const publicLink = page.locator('.dex-credits a.dx-public-profile-link[href="/u/tester/"]').first();
  await expect(publicLink).toBeVisible();
  await expect
    .poll(async () => publicLink.evaluate((node) => (node.textContent || '').replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()))
    .toBe('emmanuel losa');
});

test('house account /u/dex renders the archivist treatment with vault module', async ({ page }) => {
  await routeCatalog(page);
  await routeProfileShell(page, 'dex');

  await routePublicProfileApi(page, 'dex', {
    dex_id: 'DEX-000000',
    handle: 'dex',
    profile_public: true,
    credit_name: 'Dex',
    bio: 'The front desk of the archive.',
    links: [],
    roles: ['Archivist'],
    role_primary: 'Archivist',
    instruments: [],
    contributions: [],
    favorites_public: true,
    favorites: ['entry|S.Vlc. Lo AV2023 S1'],
  });

  await page.goto('/u/dex/', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#dex-profile')).toHaveAttribute('data-dx-fetch-state', 'ready');
  await expect(page.locator('.dx-prof-shell')).toHaveClass(/is-house/);
  await expect(page.locator('.dx-prof-house-stamp')).toBeVisible();
  await expect(page.locator('.dx-prof-section-label').filter({ hasText: 'House record' })).toBeVisible();
  await expect(page.locator('.dx-prof-section-title').filter({ hasText: 'Staff picks' })).toBeVisible();
  await expect(page.locator('.dx-prof-empty')).toContainText('The archive speaks through its members.');

  // The vault: present, locked copy, and a members-only gate when signed out.
  const vault = page.locator('[data-dx-vault]');
  await expect(vault).toBeVisible();
  await expect(vault.locator('.dx-prof-section-title')).toHaveText('The Vault');
  await vault.locator('input[name="combination"]').fill('11-22-33');
  await vault.locator('button[type="submit"]').click();
  await expect(vault.locator('[data-dx-vault-feedback]')).toContainText('only opens for members');
});

test('regular profiles get no house treatment', async ({ page }) => {
  await routeCatalog(page);
  await routeProfileShell(page, 'tester');
  await routePublicProfileApi(page, 'tester', {
    dex_id: 'DEX-7Q2KP4',
    handle: 'tester',
    profile_public: true,
    credit_name: 'Test Performer',
    bio: '',
    links: [],
    roles: [],
    instruments: [],
    contributions: [],
    favorites_public: false,
    favorites: [],
  });

  await page.goto('/u/tester/', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#dex-profile')).toHaveAttribute('data-dx-fetch-state', 'ready');
  await expect(page.locator('.dx-prof-shell')).not.toHaveClass(/is-house/);
  await expect(page.locator('.dx-prof-house-stamp')).toHaveCount(0);
  await expect(page.locator('[data-dx-vault]')).toHaveCount(0);
});
