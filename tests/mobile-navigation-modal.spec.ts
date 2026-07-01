import { expect, test, type Page } from 'playwright/test';

type AuthMode = 'guest' | 'member';

async function stubAuth(page: Page, mode: AuthMode): Promise<void> {
  const authenticated = mode === 'member';
  const user = authenticated
    ? {
        sub: 'auth0|mobile-menu-member',
        name: 'Avery Sample',
        nickname: 'avery',
        email: 'avery@example.com',
      }
    : null;

  const script = `
    (() => {
      const authenticated = ${JSON.stringify(authenticated)};
      const user = ${JSON.stringify(user)};
      window.__dxMobileAuthCalls = { signIn: [], signOut: [] };
      window.__dxMobileAuthReject = { signIn: false, signOut: false };
      const state = { isAuthenticated: authenticated, user };
      const auth = {
        ready: Promise.resolve(state),
        resolve: () => Promise.resolve({ authenticated, user }),
        requireAuth: () => Promise.resolve(authenticated
          ? { status: 'authenticated', user }
          : { status: 'blocked' }),
        isAuthenticated: () => Promise.resolve(authenticated),
        getUser: () => Promise.resolve(user),
        getAccessToken: () => Promise.resolve(authenticated ? 'mobile-menu-token' : ''),
        signIn: (returnTo) => {
          window.__dxMobileAuthCalls.signIn.push(returnTo);
          return window.__dxMobileAuthReject.signIn
            ? Promise.reject(new Error('sign in rejected'))
            : Promise.resolve();
        },
        signOut: (returnTo) => {
          window.__dxMobileAuthCalls.signOut.push(returnTo);
          return window.__dxMobileAuthReject.signOut
            ? Promise.reject(new Error('sign out rejected'))
            : Promise.resolve();
        },
      };
      window.DEX_AUTH = auth;
      window.dexAuth = auth;
      window.DEX_ACCOUNT_MENU_ICON = (iconName) =>
        '<svg data-desktop-account-icon="' + iconName + '" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16"></path></svg>';
      window.AUTH0_USER = user;
      window.auth0Sub = user ? user.sub : '';

      const publish = () => {
        if (!document.getElementById('auth-ui')) {
          const ui = document.createElement('div');
          ui.id = 'auth-ui';
          ui.innerHTML = '<button id="auth-ui-profile-toggle">Profile</button><div id="auth-ui-dropdown">Desktop account menu</div>';
          document.body.appendChild(ui);
        }
        window.dispatchEvent(new CustomEvent('dex-auth:ready', { detail: state }));
        window.dispatchEvent(new CustomEvent('dex-auth:state', { detail: state }));
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(publish, 0), { once: true });
      } else {
        setTimeout(publish, 0);
      }
    })();
  `;

  await page.route('**/assets/dex-auth.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: script,
    });
  });

  await page.route('https://dex-api.spring-fog-8edd.workers.dev/**', async (route) => {
    const method = route.request().method().toUpperCase();
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204 });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, count: 0, favorites: [], entries: [] }),
    });
  });
}

async function openMobileMenu(page: Page) {
  const burger = page.locator('.header-display-mobile .header-burger-btn[aria-controls="dx-mobile-menu"]');
  await expect(burger).toHaveCount(1);
  await expect(burger).toBeVisible();
  await expect(burger).toHaveAttribute('aria-label', 'Open menu');
  await burger.click();

  const root = page.locator('#dx-mobile-menu');
  await expect(root).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('.dx-mobile-menu-modal')).toBeVisible();
  return { burger, root };
}

test.describe('mobile navigation modal', () => {
  test('guest menu is an inset white-glass tile modal and sign-in is retryable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubAuth(page, 'guest');
    await page.goto('/?mobile-menu=1#featured', { waitUntil: 'domcontentloaded' });

    const { root } = await openMobileMenu(page);
    await expect(page.locator('#auth-ui')).toBeHidden();
    await expect(root).toHaveAttribute('data-dx-mobile-menu-view', 'site');

    await expect.poll(() => page.evaluate(() => {
      const modal = document.querySelector('.dx-mobile-menu-modal') as HTMLElement | null;
      const rect = modal?.getBoundingClientRect();
      return {
        left: rect ? Math.round(rect.left) : -1,
        top: rect ? Math.round(rect.top) : -1,
        right: rect ? Math.round(window.innerWidth - rect.right) : -1,
        bottom: rect ? Math.round(window.innerHeight - rect.bottom) : -1,
      };
    })).toEqual({ left: 16, top: 16, right: 16, bottom: 16 });

    const metrics = await page.evaluate(() => {
      const modal = document.querySelector('.dx-mobile-menu-modal') as HTMLElement | null;
      const style = modal ? window.getComputedStyle(modal) : null;
      return {
        backgroundImage: style?.backgroundImage || '',
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        inertSiblings: document.querySelectorAll('[data-dx-mobile-menu-inert="true"]').length,
      };
    });
    expect(metrics.backgroundImage).toContain('linear-gradient');
    expect(metrics.pageOverflow).toBe(0);
    expect(metrics.inertSiblings).toBeGreaterThan(0);

    await expect(root.locator('[data-dx-mobile-menu-tile="catalog"]')).toHaveCount(1);
    await expect(root.locator('[data-dx-mobile-menu-tile="catalog"]')).toHaveClass(/dx-mobile-menu-tile--featured/);
    await expect(root.locator('[data-dx-mobile-menu-tile="call"]')).toHaveCount(1);
    await expect(root.locator('[data-dx-mobile-menu-tile="dexnotes"]')).toHaveCount(1);
    await expect(root.locator('[data-dx-mobile-menu-tile="about"]')).toHaveCount(1);
    await expect(root.locator('[data-dx-mobile-menu-tile="donate"]')).toHaveCount(1);
    await expect(root.locator('.dx-mobile-menu-social a.icon')).toHaveCount(4);
    const tileGeometry = await page.evaluate(() => Array.from(
      document.querySelectorAll<HTMLElement>('[data-dx-mobile-site-grid="true"] .dx-mobile-menu-tile'),
    ).map((tile) => {
      const copy = tile.querySelector<HTMLElement>('.dx-mobile-menu-tile-copy');
      return {
        radius: window.getComputedStyle(tile).borderRadius,
        textClipsX: copy ? copy.scrollWidth > copy.clientWidth + 1 : true,
        textClipsY: copy ? copy.scrollHeight > copy.clientHeight + 1 : true,
      };
    }));
    expect(new Set(tileGeometry.map((tile) => tile.radius)).size).toBe(1);
    expect(tileGeometry.every((tile) => !tile.textClipsX && !tile.textClipsY)).toBeTruthy();

    const account = root.locator('[data-dx-mobile-login-trigger="true"]');
    await expect(account).toHaveCount(1);
    await expect(account).toContainText('Sign in');

    await page.evaluate(() => {
      (window as any).__dxMobileAuthReject.signIn = true;
    });
    await account.click();
    await expect(root.locator('[data-dx-mobile-menu-status="true"]')).toContainText('Could not open sign in');
    await expect(root).toHaveAttribute('aria-hidden', 'false');
    await expect(account).toBeEnabled();

    await page.evaluate(() => {
      (window as any).__dxMobileAuthReject.signIn = false;
    });
    await account.click();
    await expect(root).toHaveAttribute('aria-hidden', 'true');
    const signInCalls = await page.evaluate(() => (window as any).__dxMobileAuthCalls.signIn);
    expect(signInCalls).toEqual(['/?mobile-menu=1#featured', '/?mobile-menu=1#featured']);
  });

  test('signed-in account drill-in has route parity, unread updates, and two-stage Escape', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubAuth(page, 'member');
    await page.goto('/entry/favorites/', { waitUntil: 'domcontentloaded' });

    const { burger, root } = await openMobileMenu(page);
    const account = root.locator('[data-dx-mobile-account-open="true"]');
    await expect(account).toHaveCount(1);
    await expect(account).toContainText('Avery Sample');
    await expect(account).toHaveAttribute('data-dx-mobile-menu-active', 'true');
    await expect(root).toHaveAttribute('data-dx-mobile-menu-view', 'site');

    await account.click();
    await expect(root).toHaveAttribute('data-dx-mobile-menu-view', 'account');
    await expect(root.locator('[data-dx-mobile-account-back="true"]')).toBeFocused();

    const expectedRoutes = [
      '/entry/favorites/',
      '/polls',
      '/entry/submit/',
      '/entry/messages/',
      '/entry/pressroom/',
      '/entry/settings/',
      '/entry/achievements/',
    ];
    const accountRoutes = await root.locator('[data-dx-mobile-account-grid="true"] a[data-dx-mobile-menu-route]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    expect(accountRoutes).toEqual(expectedRoutes);
    await expect(root.locator('[data-dx-mobile-account-grid="true"] [data-dx-mobile-menu-tile="catalog"]')).toHaveCount(0);
    await expect(root.locator('[data-dx-mobile-account-grid="true"] [data-desktop-account-icon]')).toHaveCount(8);

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('dx:messages:unread-count', { detail: { count: 7 } }));
    });
    const unread = root.locator('[data-dx-mobile-unread-badge="true"]');
    await expect(unread).toBeVisible();
    await expect(unread).toHaveText('7');

    await page.keyboard.press('Escape');
    await expect(root).toHaveAttribute('data-dx-mobile-menu-view', 'site');
    await expect(root).toHaveAttribute('aria-hidden', 'false');
    await page.keyboard.press('Escape');
    await expect(root).toHaveAttribute('aria-hidden', 'true');
    await expect(burger).toBeFocused();

    await burger.click();
    await expect(root).toHaveAttribute('aria-hidden', 'false');
    await root.locator('[data-dx-mobile-account-open="true"]').click();
    const logout = root.locator('[data-dx-mobile-logout-trigger="true"]');
    await page.evaluate(() => {
      (window as any).__dxMobileAuthReject.signOut = true;
    });
    await logout.click();
    await expect(root.locator('[data-dx-mobile-menu-status="true"]')).toContainText('Could not sign out');
    await expect(logout).toBeEnabled();

    await page.evaluate(() => {
      (window as any).__dxMobileAuthReject.signOut = false;
    });
    await logout.click();
    await expect(root).toHaveAttribute('aria-hidden', 'true');
    const signOutCalls = await page.evaluate(() => (window as any).__dxMobileAuthCalls.signOut);
    expect(signOutCalls).toEqual([windowOrigin(page), windowOrigin(page)]);
  });

  test('site and account tiles own their navigation and close only after activation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      const nextLoadCount = Number(window.sessionStorage.getItem('dx-mobile-menu-document-loads') || '0') + 1;
      window.sessionStorage.setItem('dx-mobile-menu-document-loads', String(nextLoadCount));
    });
    await stubAuth(page, 'member');
    await page.goto('/about/', { waitUntil: 'domcontentloaded' });

    let menu = await openMobileMenu(page);
    const catalogTile = menu.root.locator('[data-dx-mobile-menu-tile="catalog"]');
    await expect(catalogTile).toHaveAttribute('href', '/catalog/');
    await catalogTile.click();
    await expect(page).toHaveURL(/\/catalog\/?$/);
    await expect(page.locator('.dx-catalog-index-shell')).toBeVisible();
    await expect(menu.root).toHaveAttribute('aria-hidden', 'true');
    await expect.poll(() => page.evaluate(
      () => window.sessionStorage.getItem('dx-mobile-menu-document-loads'),
    )).toBe('1');

    menu = await openMobileMenu(page);
    await menu.root.locator('[data-dx-mobile-account-open="true"]').click();
    const settingsTile = menu.root.locator('[data-dx-mobile-menu-tile="settings"]');
    await expect(settingsTile).toHaveAttribute('href', '/entry/settings/');
    await settingsTile.click();
    await expect(page).toHaveURL(/\/entry\/settings\/?$/);
    await expect(menu.root).toHaveAttribute('aria-hidden', 'true');
    await expect.poll(() => page.evaluate(
      () => window.sessionStorage.getItem('dx-mobile-menu-document-loads'),
    )).toBe('1');
  });

  test('tablet layout uses three columns, traps focus, restores inert state, and reduces motion', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await stubAuth(page, 'guest');
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const { root } = await openMobileMenu(page);
    const tabletMetrics = await page.evaluate(() => {
      const grid = document.querySelector('[data-dx-mobile-site-grid="true"]') as HTMLElement | null;
      const modal = document.querySelector('.dx-mobile-menu-modal') as HTMLElement | null;
      const track = document.querySelector('.dx-mobile-menu-track') as HTMLElement | null;
      return {
        columns: grid ? window.getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length : 0,
        modalTransition: modal ? window.getComputedStyle(modal).transitionDuration : '',
        trackTransition: track ? window.getComputedStyle(track).transitionDuration : '',
        horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(tabletMetrics.columns).toBe(3);
    expect(tabletMetrics.modalTransition).toBe('0s');
    expect(tabletMetrics.trackTransition).toBe('0s');
    expect(tabletMetrics.horizontalOverflow).toBe(0);

    const focusTargets = await page.evaluate(() => {
      const root = document.getElementById('dx-mobile-menu');
      if (!root) return { first: '', last: '' };
      const elements = Array.from(root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => {
        const panel = element.closest('[data-dx-mobile-menu-panel]');
        return element.getClientRects().length > 0 && (!panel || panel.getAttribute('aria-hidden') !== 'true');
      });
      const first = elements[0];
      const last = elements[elements.length - 1];
      first?.setAttribute('data-dx-focus-edge', 'first');
      last?.setAttribute('data-dx-focus-edge', 'last');
      last?.focus();
      return {
        first: first?.getAttribute('data-dx-focus-edge') || '',
        last: last?.getAttribute('data-dx-focus-edge') || '',
      };
    });
    expect(focusTargets).toEqual({ first: 'first', last: 'last' });
    await page.keyboard.press('Tab');
    await expect(root.locator('[data-dx-focus-edge="first"]')).toBeFocused();

    await root.locator('[data-dx-mobile-menu-close="true"].dx-mobile-menu-backdrop').click({
      position: { x: 2, y: 2 },
    });
    await expect(root).toHaveAttribute('aria-hidden', 'true');
    await expect.poll(() => page.evaluate(
      () => document.querySelectorAll('[data-dx-mobile-menu-inert="true"]').length,
    )).toBe(0);
  });
});

test.describe('mobile navigation touch routing', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('a real tap commits the destination without reloading the document', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      const nextLoadCount = Number(window.sessionStorage.getItem('dx-mobile-menu-touch-loads') || '0') + 1;
      window.sessionStorage.setItem('dx-mobile-menu-touch-loads', String(nextLoadCount));
    });
    await stubAuth(page, 'guest');
    await page.goto('/about/', { waitUntil: 'domcontentloaded' });

    const burger = page.locator('.header-display-mobile .header-burger-btn[aria-controls="dx-mobile-menu"]');
    await expect(burger).toHaveCount(1);
    await burger.tap();

    const root = page.locator('#dx-mobile-menu');
    await expect(root).toHaveAttribute('aria-hidden', 'false');
    const catalogTile = root.locator('[data-dx-mobile-menu-tile="catalog"]');
    await expect(catalogTile).toHaveCount(1);
    await catalogTile.evaluate((tile) => {
      tile.addEventListener('click', (event) => event.stopPropagation(), { once: true });
    });
    await catalogTile.tap();

    await expect(page).toHaveURL(/\/catalog\/?$/);
    await expect(page.locator('.dx-catalog-index-shell')).toBeVisible();
    await expect.poll(() => page.evaluate(
      () => window.sessionStorage.getItem('dx-mobile-menu-touch-loads'),
    )).toBe('1');
  });
});

function windowOrigin(page: Page): string {
  return new URL(page.url()).origin;
}
