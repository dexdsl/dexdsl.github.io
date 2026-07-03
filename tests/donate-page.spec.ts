import { expect, test, type Page } from 'playwright/test';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function stubDexAuth(
  page: Page,
  { authenticated, token = 'test-access-token' }: { authenticated: boolean; token?: string },
) {
  await page.route('**/assets/dex-auth.js', async (route) => {
    const script = `
      (() => {
        const state = {
          isAuthenticated: ${authenticated ? 'true' : 'false'},
          user: ${authenticated ? "{ sub: 'auth0|donor', email: 'donor@example.com' }" : 'null'},
        };
        const calls = { signIn: [], signUp: [] };
        window.__dxAuthCalls = calls;
        window.DEX_AUTH = {
          ready: Promise.resolve(state),
          resolve: async () => state,
          isAuthenticated: async () => state.isAuthenticated,
          getAccessToken: async () => state.isAuthenticated ? ${JSON.stringify(token)} : '',
          getUser: async () => state.user,
          signIn: (returnTo) => { calls.signIn.push(String(returnTo || '')); },
          signUp: (returnTo) => { calls.signUp.push(String(returnTo || '')); },
        };
        window.dexAuth = window.DEX_AUTH;
      })();
    `;

    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: script,
    });
  });
}

async function seedTurnstile(
  page: Page,
  {
    token = 'turnstile-token',
    fail = false,
  }: {
    token?: string;
    fail?: boolean;
  } = {},
) {
  await page.addInitScript(({ injectedToken, shouldFail }) => {
    const globalAny = window as any;
    globalAny.DEX_NEWSLETTER_TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
    globalAny.DEX_DONATE_CONFIG = Object.assign({}, globalAny.DEX_DONATE_CONFIG || {}, {
      source: 'donate-page',
      turnstileAction: 'donation_checkout',
      turnstileSiteKey: '1x00000000000000000000AA',
      requireChallengeForUnauth: true,
      minDwellMs: 1200,
    });

    let options: Record<string, unknown> | null = null;
    globalAny.turnstile = {
      render: (_container: Element, nextOptions: Record<string, unknown>) => {
        options = nextOptions || {};
        return 'dx-donate-widget';
      },
      execute: () => {
        if (!options) return;
        if (shouldFail) {
          const onError = options['error-callback'];
          if (typeof onError === 'function') onError('forced-failure');
          return;
        }
        const callback = options.callback;
        if (typeof callback === 'function') callback(injectedToken);
      },
      reset: () => {},
    };
  }, { injectedToken: token, shouldFail: fail });
}

function catalogEntries() {
  return [
    {
      id: 'prepared-oboe',
      status: 'active',
      title_raw: 'PREPARED OBOE',
      performer_raw: 'Sky Macklay',
      lookup_raw: 'W.Ob. Ma AV2024 S2',
      season: 'S2',
      instrument_labels: ['Prepared Oboe'],
      entry_href: '/entry/prepared-oboe/',
      image_src: '/assets/test-donate/prepared-oboe.svg',
      kind: 'catalog',
    },
    {
      id: 'amplified-printer',
      status: 'active',
      title_raw: 'AMPLIFIED PRINTER',
      performer_raw: 'Cameron Church',
      lookup_raw: 'X.Prt. Ch AV2024 S2',
      season: 'S2',
      instrument_labels: ['Amplified Printer'],
      entry_href: '/entry/amplified-printer/',
      image_src: '/assets/test-donate/amplified-printer.svg',
      kind: 'catalog',
    },
    {
      id: 'cello',
      status: 'active',
      title_raw: 'CELLO',
      performer_raw: 'Emmanuel Losa',
      lookup_raw: 'S.Vlc. Lo AV2023 S1',
      season: 'S1',
      instrument_labels: ['Cello'],
      entry_href: '/entry/cello/',
      image_src: '/assets/test-donate/cello.svg',
      kind: 'catalog',
    },
    {
      id: 'modular-synth',
      status: 'active',
      title_raw: 'MODULAR SYNTH',
      performer_raw: 'Bojun Zhang',
      lookup_raw: 'E.Mod. Zh AV2024 S2',
      season: 'S2',
      instrument_labels: ['Modular Synth'],
      entry_href: '/entry/modular-synth/',
      image_src: '/assets/test-donate/modular-synth.svg',
      kind: 'catalog',
    },
    {
      id: 'draft-entry',
      status: 'draft',
      title_raw: 'DRAFT',
      performer_raw: 'Not Public',
      lookup_raw: 'X.Drf. No 0000',
      season: 'S3',
      instrument_labels: ['Draft'],
      entry_href: '/entry/draft-entry/',
      image_src: '/assets/test-donate/draft.svg',
      kind: 'catalog',
    },
  ];
}

async function stubCatalog(page: Page, { failImages = false } = {}) {
  await page.route('**/data/catalog.entries.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ entries: catalogEntries() }),
    });
  });
  await page.route('**/assets/test-donate/*.svg', async (route) => {
    if (failImages) {
      await route.fulfill({ status: 404, body: '' });
      return;
    }
    const name = route.request().url().split('/').pop()?.replace('.svg', '') || 'entry';
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#ff4b2e"/><stop offset=".5" stop-color="#983cff"/><stop offset="1" stop-color="#30b8ff"/></linearGradient></defs><rect width="1200" height="760" fill="url(#g)"/><circle cx="860" cy="280" r="220" fill="rgba(20,21,26,.45)"/><text x="70" y="680" fill="white" font-size="72" font-family="monospace">${name.toUpperCase()}</text></svg>`,
    });
  });
}

async function stubMembershipBilling(page: Page, status = 'none') {
  await page.route('**/me/billing/plans', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        currency: 'USD',
        defaultTier: 'S',
        coverFeesEnabled: true,
        plans: [
          {
            tier: 'S',
            name: 'Steward',
            impact: 'Keeps the commons online and open.',
            month: { amount: 6.99, currency: 'USD' },
            year: { amount: 69.99, currency: 'USD' },
          },
          {
            tier: 'M',
            name: 'Archivist',
            impact: 'Funds artist sessions, storage, and preservation.',
            month: { amount: 14.99, currency: 'USD' },
            year: { amount: 149.99, currency: 'USD' },
          },
          {
            tier: 'L',
            name: 'Producer',
            impact: 'Underwrites new commissions and release velocity.',
            month: { amount: 24.99, currency: 'USD' },
            year: { amount: 249.99, currency: 'USD' },
          },
        ],
      }),
    });
  });
  await page.route('**/me/billing/summary', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status }),
    });
  });
  await page.route('**/me/invoices*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ invoices: [] }),
    });
  });
}

test('one-time happy path (signed out) sends secure payload + idempotency header', async ({ page }) => {
  await stubDexAuth(page, { authenticated: false });
  await seedTurnstile(page);

  let requestCount = 0;
  let payload: Record<string, unknown> | null = null;
  let idem = '';

  await page.route('**/donations/checkout-session', async (route) => {
    requestCount += 1;
    payload = route.request().postDataJSON() as Record<string, unknown>;
    idem = String(route.request().headers()['x-dx-idempotency-key'] || '');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        state: 'checkout_created',
        requestId: 'don_req_1',
        checkoutUrl: '/donate/?donation=thanks',
      }),
    });
  });

  await page.goto('/donate/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1300);
  await page.click('[data-dx-donate-submit]');

  await expect(page).toHaveURL(/donation=thanks/i);
  expect(requestCount).toBe(1);
  expect(payload).toBeTruthy();
  expect(payload?.source).toBe('donate-page');
  expect(payload?.currency).toBe('USD');
  expect(payload?.amountCents).toBe(1000);
  expect(payload?.challengeToken).toBe('turnstile-token');
  expect(payload?.honey).toBe('');
  expect(typeof payload?.submittedAt).toBe('number');
  expect(String(payload?.clientRequestId || '')).toMatch(UUID_RE);
  expect(idem).toMatch(UUID_RE);
});

test('one-time happy path (signed in) skips challenge and sends auth header', async ({ page }) => {
  await stubDexAuth(page, { authenticated: true, token: 'signed-in-token' });

  let requestCount = 0;
  let payload: Record<string, unknown> | null = null;
  let authHeader = '';

  await page.route('**/donations/checkout-session', async (route) => {
    requestCount += 1;
    payload = route.request().postDataJSON() as Record<string, unknown>;
    authHeader = String(route.request().headers().authorization || '');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        state: 'checkout_created',
        requestId: 'don_req_2',
        checkoutUrl: '/donate/?donation=thanks',
      }),
    });
  });

  await page.goto('/donate/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1300);
  await page.click('[data-dx-donate-submit]');

  await expect(page).toHaveURL(/donation=thanks/i);
  expect(requestCount).toBe(1);
  expect(authHeader).toBe('Bearer signed-in-token');
  expect(String(payload?.challengeToken || '')).toBe('');
});

test('challenge failures are deterministic and block submission', async ({ page }) => {
  await stubDexAuth(page, { authenticated: false });
  await seedTurnstile(page, { fail: true });

  let requestCount = 0;
  await page.route('**/donations/checkout-session', async (route) => {
    requestCount += 1;
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false }),
    });
  });

  await page.goto('/donate/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1300);
  await page.click('[data-dx-donate-submit]');

  await expect(page.locator('[data-dx-donate-feedback]')).toContainText(/challenge check failed/i);
  expect(requestCount).toBe(0);
});

test('rate-limit responses show retry messaging and local cooldown', async ({ page }) => {
  await stubDexAuth(page, { authenticated: false });
  await seedTurnstile(page);

  let requestCount = 0;
  await page.route('**/donations/checkout-session', async (route) => {
    requestCount += 1;
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        code: 'RATE_LIMIT',
        requestId: 'don_limit_1',
        retryAfterSeconds: 37,
      }),
    });
  });

  await page.goto('/donate/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1300);
  await page.click('[data-dx-donate-submit]');

  await expect(page.locator('[data-dx-donate-feedback]')).toContainText(/37 seconds/i);
  expect(requestCount).toBe(1);

  await page.click('[data-dx-donate-submit]');
  await expect(page.locator('[data-dx-donate-feedback]')).toContainText(/please wait|too many attempts/i);
  expect(requestCount).toBe(1);
});

test('monthly strip uses the canonical settings membership modal and one contextual CTA', async ({ page }) => {
  await stubDexAuth(page, { authenticated: true });
  await stubMembershipBilling(page);
  await page.goto('/donate/', { waitUntil: 'domcontentloaded' });

  const authedCta = page.locator('[data-dx-donate-monthly-auth="true"]');
  await expect(authedCta).toBeVisible();
  await expect(authedCta).toHaveAttribute('aria-controls', 'dxMembershipModal');
  await authedCta.click();
  await expect(page.locator('#dxMembershipModal')).toHaveCount(1);
  await expect(page.locator('#dxMembershipModal')).toHaveAttribute('data-open', 'true');
  await expect(page.locator('#dxMembershipModal .dx-memv3-modal-card')).toBeVisible();
  await expect(page.locator('#dxMembershipV3Root')).toHaveAttribute('data-dx-membership-external-host', 'true');
  const modalTitle = await page.locator('#dxMemV3ModalTitle').textContent();
  expect(String(modalTitle || '').replace(/\u200C/g, '')).toContain('Keep the archive in motion');
  await expect(page.locator('[data-dx-donate-monthly] .dx-donate-card-index')).toHaveText('MONTHLY MEMBERSHIP');
  await expect(page.locator('[data-dx-donate-monthly]')).not.toContainText('02 ·');
  await expect(page.locator('.dx-donate-monthly-media img')).toHaveAttribute(
    'src',
    '/assets/img/3b1476c230073f7589e3.jpg',
  );

  const unauthPage = await page.context().newPage();
  await stubDexAuth(unauthPage, { authenticated: false });
  await unauthPage.goto('/donate/', { waitUntil: 'domcontentloaded' });

  await expect(unauthPage.locator('[data-dx-donate-monthly-signup="true"]')).toBeVisible();
  await expect(unauthPage.locator('[data-dx-donate-monthly-signin="true"]')).toHaveCount(0);
  await expect(unauthPage.locator('[data-dx-donate-monthly-actions] a, [data-dx-donate-monthly-actions] button')).toHaveCount(1);

  await unauthPage.click('[data-dx-donate-monthly-signup="true"]');
  const signUpTarget = await unauthPage.evaluate(() => (window as any).__dxAuthCalls?.signUp?.[0] || '');
  expect(signUpTarget).toBe('/donate/?membership=choose#membership');
});

test('one-time controls reveal custom amount only on demand and update the CTA', async ({ page }) => {
  await stubDexAuth(page, { authenticated: false });
  await stubCatalog(page);
  await page.goto('/donate/', { waitUntil: 'domcontentloaded' });

  const customWrap = page.locator('[data-dx-donate-custom-wrap]');
  const submit = page.locator('[data-dx-donate-submit]');
  await expect(customWrap).toBeHidden();
  await expect(submit).toHaveText('Donate $10.00');

  await page.click('[data-dx-donate-amount-cents="2500"]');
  await expect(customWrap).toBeHidden();
  await expect(submit).toHaveText('Donate $25.00');

  await page.click('[data-dx-donate-amount-cents="custom"]');
  await expect(customWrap).toBeVisible();
  await page.fill('[data-dx-donate-custom-input]', '42');
  await expect(submit).toHaveText('Donate $42.00');
});

test('display headings lock duplicate letters to the canonical joined treatment', async ({ page }) => {
  await stubDexAuth(page, { authenticated: false });
  await stubCatalog(page);
  await page.goto('/donate/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-dx-donate-showcase]')).toHaveAttribute('data-dx-showcase-state', 'ready');

  const headings = await page.locator('[data-dx-donate-shell] h1, [data-dx-donate-shell] h2, [data-dx-donate-shell] h3').evaluateAll((nodes) => (
    nodes.map((node) => ({
      text: node.textContent || '',
      excluded: node.getAttribute('data-dx-heading-duplicate-exclude-letters') || '',
    }))
  ));
  expect(headings.length).toBeGreaterThan(4);
  headings.forEach((heading) => {
    expect(heading.excluded).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    const chars = Array.from(heading.text);
    for (let index = 1; index < chars.length; index += 1) {
      const current = chars[index];
      const previous = chars[index - 1];
      if (current?.toLowerCase() !== current?.toUpperCase() && previous?.toLowerCase() === current?.toLowerCase()) {
        expect(previous).toBe('\u200C');
      }
    }
  });
  await expect(page.locator('.dx-donate-title')).toContainText('KEEP');
  expect(await page.locator('.dx-donate-title').textContent()).toContain('E\u200CE');
});

test('catalog showcase renders three diverse active entries with controls', async ({ page }) => {
  await stubDexAuth(page, { authenticated: false });
  await stubCatalog(page);
  await page.addInitScript(() => {
    const values = [0.12, 0.81, 0.37, 0.66, 0.23];
    let index = 0;
    (window as any).__DX_TEST_DONATE_RANDOM = () => values[index++ % values.length];
  });
  await page.goto('/donate/', { waitUntil: 'domcontentloaded' });

  const showcase = page.locator('[data-dx-donate-showcase]');
  await expect(showcase).toHaveAttribute('data-dx-showcase-state', 'ready');
  await expect(page.locator('[data-dx-donate-showcase-dot]')).toHaveCount(3);
  await expect(page.locator('.dx-pagenav__dot')).toHaveCount(3);
  await expect(page.locator('[data-dx-donate-showcase-entry]')).toBeVisible();
  await expect(page.locator('[data-dx-donate-showcase-entry]')).not.toContainText('DRAFT');
  await expect(page.locator('[data-dx-donate-showcase-next]')).toBeEnabled();
  await expect(page.locator('[data-dx-donate-showcase-previous]')).toHaveAttribute('data-dx-pagenav-ready', '1');
  await expect(page.locator('[data-dx-donate-showcase-next]')).toHaveAttribute('data-dx-pagenav-ready', '1');
  await expect(page.locator('.dx-donate-entry-actions a')).toHaveCount(2);
  await expect(page.locator('.dx-donate-entry-link')).toBeVisible();
  await expect(page.locator('.dx-donate-catalog-link')).toBeVisible();

  const geometry = await page.evaluate(() => {
    const frame = document.querySelector('.dx-donate-showcase-frame')?.getBoundingClientRect();
    const card = document.querySelector('[data-dx-donate-showcase-entry]')?.getBoundingClientRect();
    const image = document.querySelector('.dx-donate-entry-image');
    const previous = document.querySelector('[data-dx-donate-showcase-previous]')?.getBoundingClientRect();
    const next = document.querySelector('[data-dx-donate-showcase-next]')?.getBoundingClientRect();
    return {
      frame: frame ? { left: frame.left, right: frame.right } : null,
      cardRatio: card && card.height ? card.width / card.height : 0,
      objectFit: image ? getComputedStyle(image).objectFit : '',
      previous: previous ? { left: previous.left, width: previous.width } : null,
      next: next ? { right: next.right, width: next.width } : null,
      viewportWidth: window.innerWidth,
    };
  });
  expect(geometry.objectFit).toBe('cover');
  if (geometry.viewportWidth >= 900) {
    expect(geometry.cardRatio).toBeGreaterThan(2.15);
    expect(geometry.cardRatio).toBeLessThan(2.45);
  }
  expect(geometry.previous && geometry.frame).toBeTruthy();
  expect(geometry.next && geometry.frame).toBeTruthy();
  expect(Math.abs((geometry.previous?.left || 0) + (geometry.previous?.width || 0) / 2 - (geometry.frame?.left || 0))).toBeLessThan(2);
  expect(Math.abs((geometry.next?.right || 0) - (geometry.next?.width || 0) / 2 - (geometry.frame?.right || 0))).toBeLessThan(2);

  const selectedIds = await page.locator('[data-dx-donate-showcase-dot]').evaluateAll((nodes) => (
    nodes.map((node) => node.getAttribute('data-dx-donate-showcase-dot'))
  ));
  expect(new Set(selectedIds).size).toBe(3);

  const firstId = await page.locator('[data-dx-donate-showcase-entry]').getAttribute('data-dx-donate-showcase-entry');
  await page.click('[data-dx-donate-showcase-next]');
  await expect(page.locator('[data-dx-donate-showcase-entry]')).not.toHaveAttribute('data-dx-donate-showcase-entry', firstId || '');
});

test('catalog and image failures degrade without blocking donation', async ({ page }) => {
  await stubDexAuth(page, { authenticated: false });
  await stubCatalog(page, { failImages: true });
  await page.goto('/donate/', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-dx-donate-submit]')).toBeVisible();
  await expect(page.locator('[data-dx-donate-image-fallback]')).toBeVisible();

  const failedFeedPage = await page.context().newPage();
  await stubDexAuth(failedFeedPage, { authenticated: false });
  await failedFeedPage.route('**/data/catalog.entries.json', async (route) => {
    await route.fulfill({ status: 503, body: '' });
  });
  await failedFeedPage.goto('/donate/', { waitUntil: 'domcontentloaded' });
  await expect(failedFeedPage.locator('[data-dx-donate-submit]')).toBeVisible();
  await expect(failedFeedPage.locator('[data-dx-donate-showcase]')).toHaveAttribute('data-dx-showcase-state', 'fallback');
  await expect(failedFeedPage.getByRole('link', { name: 'BROWSE CATALOG ↗' })).toBeVisible();
});

test('editorial donation shell preserves frame, contrast, and responsive geometry', async ({ page }) => {
  await stubDexAuth(page, { authenticated: false });
  await stubCatalog(page);
  await page.addInitScript(() => {
    (window as any).__DX_TEST_DONATE_RANDOM = () => 0.42;
  });
  await page.goto('/donate/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-dx-donate-showcase]')).toHaveAttribute('data-dx-showcase-state', 'ready');
  await page.addStyleTag({
    content: `
      *, *::before, *::after { animation: none !important; transition: none !important; }
      canvas, #dx-gooey-grain-runtime { visibility: hidden !important; }
    `,
  });

  const visualContract = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const bounds = element.getBoundingClientRect();
      return {
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height,
      };
    };
    const color = (selector: string) => {
      const element = document.querySelector(selector);
      return element ? getComputedStyle(element).color : '';
    };
    const image = document.querySelector('.dx-donate-monthly-media img');
    return {
      viewportWidth: window.innerWidth,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      shell: rect('[data-dx-donate-shell]'),
      header: rect('.header-announcement-bar-wrapper'),
      footer: rect('.dex-footer'),
      monthly: rect('[data-dx-donate-monthly]'),
      monthlyContent: rect('.dx-donate-monthly-content'),
      monthlyMedia: rect('.dx-donate-monthly-media'),
      monthlyCta: rect('[data-dx-donate-monthly-actions] .dx-button-element'),
      monthlyTitleColor: color('.dx-donate-monthly h2'),
      showcaseTitleColor: color('.dx-donate-showcase-head h2'),
      monthlyImageFit: image ? getComputedStyle(image).objectFit : '',
    };
  });
  expect(visualContract.overflow).toBeLessThanOrEqual(1);
  expect(visualContract.monthlyImageFit).toBe('cover');
  expect(visualContract.monthlyTitleColor).toBe('rgb(243, 243, 244)');
  expect(visualContract.showcaseTitleColor).toBe('rgb(243, 243, 244)');
  expect(visualContract.monthlyCta?.height || 0).toBeGreaterThanOrEqual(48);

  if (visualContract.header && visualContract.shell) {
    expect(Math.abs(visualContract.header.left - visualContract.shell.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(visualContract.header.right - visualContract.shell.right)).toBeLessThanOrEqual(1);
  }
  if (visualContract.footer && visualContract.shell) {
    expect(Math.abs(visualContract.footer.left - visualContract.shell.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(visualContract.footer.right - visualContract.shell.right)).toBeLessThanOrEqual(1);
  }

  if (visualContract.viewportWidth > 760) {
    expect((visualContract.monthlyMedia?.left || 0)).toBeGreaterThan(visualContract.monthlyContent?.left || 0);
  } else {
    expect((visualContract.monthlyMedia?.top || 0)).toBeGreaterThanOrEqual(visualContract.monthlyContent?.bottom || 0);
  }
});
