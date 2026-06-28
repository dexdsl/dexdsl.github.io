import { expect, test, type Page, type Route } from 'playwright/test';

const API = 'https://dex-api.spring-fog-8edd.workers.dev';

type AuthMode = 'token-ready' | 'signed-out';
type SummaryMode = 'none' | 'active' | 'resumable' | 'fail';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type',
};

function futureUnix(days = 30): number {
  return Math.floor(Date.now() / 1000) + days * 86400;
}

function summaryNone() {
  return {
    customerId: 'cus_test',
    status: 'none',
    subscription_status: 'none',
    tier: null,
    interval: null,
    current_period_end: null,
    cancel_at_period_end: false,
    pause_collection: null,
    customer_portal_enabled: true,
    subscription: null,
  };
}

function summaryActive() {
  return {
    customerId: 'cus_test',
    status: 'active',
    subscription_status: 'active',
    tier: 'M',
    interval: 'month',
    current_period_end: futureUnix(),
    cancel_at_period_end: false,
    pause_collection: null,
    customer_portal_enabled: true,
    subscription: {
      id: 'sub_test',
      status: 'active',
      current_period_end: futureUnix(),
      cancel_at_period_end: false,
      pause_collection: null,
    },
  };
}

function summaryResumable() {
  // Active but set to cancel at period end -> the runtime shows "Resume membership".
  return { ...summaryActive(), cancel_at_period_end: true };
}

function plansPayload() {
  return {
    tiers: [
      { tier: 'S', name: 'Dex Steward', intervals: { month: { priceId: 'price_s_m' }, year: { priceId: 'price_s_y' } } },
      { tier: 'M', name: 'Dex Archivist', intervals: { month: { priceId: 'price_m_m' }, year: { priceId: 'price_m_y' } } },
      { tier: 'L', name: 'Dex Producer', intervals: { month: { priceId: 'price_l_m' }, year: { priceId: 'price_l_y' } } },
    ],
  };
}

async function stubDexAuth(page: Page, mode: AuthMode): Promise<void> {
  const script = `
    (() => {
      const mode = ${JSON.stringify(mode)};
      const authed = mode === 'token-ready';
      const user = authed ? { sub: 'auth0|billing-e2e', email: 'billing-e2e@example.com', name: 'Billing E2E' } : null;
      const state = { ready: true, authenticated: authed, isAuthenticated: authed, user, reason: 'resolved' };
      const calls = { signIn: [] };
      window.__dxAuthCalls = calls;
      const auth = {
        ready: Promise.resolve(state),
        resolve: async () => state,
        isAuthenticated: async () => authed,
        getUser: async () => user,
        getAccessToken: async () => (authed ? 'stub-access-token' : ''),
        requireAuth: async () => (authed ? { status: 'authenticated', user } : { status: 'blocked', reason: 'signed-out' }),
        guard: async () => ({ status: authed ? 'authenticated' : 'blocked' }),
        signIn: (returnTo) => { calls.signIn.push(String(returnTo || '')); },
        signOut: async () => {},
      };
      window.DEX_AUTH = auth;
      window.dexAuth = auth;
      window.AUTH0_USER = user;
      try {
        window.dispatchEvent(new CustomEvent('dex-auth:ready', { detail: { isAuthenticated: authed, user } }));
      } catch {}
    })();
  `;
  await page.route('**/assets/dex-auth.js', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: script });
  });
}

type ApiConfig = {
  summary: SummaryMode;
  plansFail?: boolean;
  portalStatus?: number;
  pauseStatus?: number;
  resumeStatus?: number;
  checkoutUrl?: string;
};

type ApiCalls = { checkout: number; resume: number; pause: number; portal: number };

function summaryFor(mode: SummaryMode) {
  if (mode === 'active') return summaryActive();
  if (mode === 'resumable') return summaryResumable();
  return summaryNone();
}

async function stubBillingApi(page: Page, config: ApiConfig): Promise<ApiCalls> {
  const calls: ApiCalls = { checkout: 0, resume: 0, pause: 0, portal: 0 };
  await page.route(`${API}/**`, async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (request.method().toUpperCase() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }

    const json = (status: number, body: unknown) =>
      route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });

    if (path === '/me/billing/plans') {
      if (config.plansFail) return json(500, { error: 'plans down' });
      return json(200, plansPayload());
    }
    if (path === '/me/billing/summary') {
      if (config.summary === 'fail') return json(500, { error: 'summary down' });
      return json(200, summaryFor(config.summary));
    }
    if (path === '/me/billing/portal-session') {
      calls.portal += 1;
      if (config.portalStatus && config.portalStatus >= 400) return json(config.portalStatus, { error: 'portal down' });
      return json(200, { url: 'https://billing.stripe.com/p/session/test' });
    }
    if (path === '/me/billing/subscription/pause') {
      calls.pause += 1;
      if (config.pauseStatus && config.pauseStatus >= 400) return json(config.pauseStatus, { error: 'pause down' });
      return json(200, { customerId: 'cus_test', subscription: { id: 'sub_test', status: 'active', pause_collection: { behavior: 'keep_as_draft' } } });
    }
    if (path === '/me/billing/subscription/resume') {
      calls.resume += 1;
      if (config.resumeStatus && config.resumeStatus >= 400) return json(config.resumeStatus, { error: 'resume down' });
      return json(200, { customerId: 'cus_test', subscription: { id: 'sub_test', status: 'active', pause_collection: null } });
    }
    if (path === '/me/billing/checkout-session') {
      calls.checkout += 1;
      return json(200, { url: config.checkoutUrl || 'https://checkout.stripe.com/c/pay/cs_test' });
    }
    if (path === '/me/invoices') {
      return json(200, { ok: true, invoices: [] });
    }
    // Benign default for any other settings-page bootstrap calls.
    return json(200, { ok: true });
  });
  return calls;
}

async function openMembershipPane(page: Page, target = '/entry/settings#membership'): Promise<void> {
  await page.goto(target, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  const tab = page.locator('#tab-membership');
  await expect(tab).toBeVisible();
  await tab.click();
}

async function waitForMembershipCard(page: Page) {
  const card = page.locator('#dxMembershipV3Card');
  await expect(card).toBeVisible({ timeout: 15000 });
  await expect.poll(async () => card.getAttribute('data-dx-fetch-state'), { timeout: 15000 }).toBe('ready');
  return card;
}

test.describe('membership billing client', () => {
  test('renders the start CTA when the member has no subscription', async ({ page }) => {
    await stubDexAuth(page, 'token-ready');
    await stubBillingApi(page, { summary: 'none' });
    await openMembershipPane(page);
    await waitForMembershipCard(page);

    const primary = page.locator('#dxMemV3Primary');
    await expect(primary).toBeVisible();
    await expect(page.locator('#dxMembershipV3Root')).toHaveAttribute('data-dx-membership-cta-mode', /.+/);
    // Error surface stays hidden on the happy path.
    await expect(page.locator('#dxMemV3Error')).toBeHidden();
  });

  test('shows manage + pause controls for an active subscription', async ({ page }) => {
    await stubDexAuth(page, 'token-ready');
    await stubBillingApi(page, { summary: 'active' });
    await openMembershipPane(page);
    await waitForMembershipCard(page);

    await expect(page.locator('#dxMemV3Secondary')).toBeVisible();
    await expect(page.locator('#dxMemV3Secondary')).toContainText(/manage/i);
    await expect(page.locator('#dxMemV3PauseResume')).toBeVisible();
  });

  test('surfaces a deterministic inline error when the summary fetch fails', async ({ page }) => {
    await stubDexAuth(page, 'token-ready');
    await stubBillingApi(page, { summary: 'fail' });
    await openMembershipPane(page);
    await waitForMembershipCard(page);

    const error = page.locator('#dxMemV3Error');
    await expect(error).toBeVisible();
    await expect(error).toContainText('Could not load billing status right now.');
  });

  test('surfaces a plans-load error without crashing the card', async ({ page }) => {
    await stubDexAuth(page, 'token-ready');
    await stubBillingApi(page, { summary: 'none', plansFail: true });
    await openMembershipPane(page);
    await waitForMembershipCard(page);

    await expect(page.locator('#dxMemV3Error')).toContainText('Could not load plans right now.');
  });

  test('recovers (error + re-enabled controls) when Manage billing portal fails', async ({ page }) => {
    await stubDexAuth(page, 'token-ready');
    await stubBillingApi(page, { summary: 'active', portalStatus: 500 });
    await openMembershipPane(page);
    await waitForMembershipCard(page);

    const manage = page.locator('#dxMemV3Secondary');
    await expect(manage).toBeVisible();
    await manage.click();

    await expect(page.locator('#dxMemV3Error')).toContainText('Could not open Customer Portal right now.');
    // Failsafe: controls must not be left stuck in the busy/disabled state.
    await expect(manage).toBeEnabled();
    await expect(manage).toHaveAttribute('data-billing-busy', 'false');
  });

  test('recovers when pausing a subscription fails', async ({ page }) => {
    await stubDexAuth(page, 'token-ready');
    await stubBillingApi(page, { summary: 'active', pauseStatus: 500 });
    await openMembershipPane(page);
    await waitForMembershipCard(page);

    const pause = page.locator('#dxMemV3PauseResume');
    await expect(pause).toBeVisible();
    await pause.click();

    await expect(page.locator('#dxMemV3Error')).toBeVisible();
    await expect(pause).toBeEnabled();
    await expect(pause).toHaveAttribute('data-billing-busy', 'false');
  });

  test('checkout composer happy path: open modal, pick plan, redirect to Stripe', async ({ page }) => {
    await stubDexAuth(page, 'token-ready');
    // Return a same-origin URL so the redirect lands somewhere benign we can assert.
    const calls = await stubBillingApi(page, {
      summary: 'none',
      checkoutUrl: 'http://localhost:8080/entry/settings?checkout=mock-redirect#membership',
    });
    await openMembershipPane(page);
    await waitForMembershipCard(page);

    // Primary CTA (view-membership) opens the tier composer modal.
    await page.locator('#dxMemV3Primary').click();
    const checkoutBtn = page.locator('#dxMemV3ComposerCheckout');
    await expect(checkoutBtn).toBeVisible();

    await checkoutBtn.click();

    // The runtime sets window.location.href to the Stripe session URL.
    await page.waitForURL(/checkout=mock-redirect/, { timeout: 15000 });
    expect(calls.checkout).toBe(1);
  });

  test('resume flow: a cancel-at-period-end member can resume', async ({ page }) => {
    await stubDexAuth(page, 'token-ready');
    const calls = await stubBillingApi(page, { summary: 'resumable' });
    await openMembershipPane(page);
    await waitForMembershipCard(page);

    const resume = page.locator('#dxMemV3PauseResume');
    await expect(resume).toBeVisible();
    await expect(resume).toContainText(/resume/i);

    await resume.click();

    await expect.poll(() => calls.resume).toBeGreaterThan(0);
    await expect(page.locator('#dxMemV3Error')).toBeHidden();
    await expect(resume).toBeEnabled();
  });

  test('return-from-checkout (?thanks=1) lands on the active membership state', async ({ page }) => {
    await stubDexAuth(page, 'token-ready');
    await stubBillingApi(page, { summary: 'active' });
    await openMembershipPane(page, '/entry/settings?thanks=1#membership');
    await waitForMembershipCard(page);

    await expect(page.locator('#dxMemV3Secondary')).toContainText(/manage/i);
    await expect(page.locator('#dxMemV3Error')).toBeHidden();
  });

  test('signed-out users get the deterministic SIGN IN REQUIRED fallback', async ({ page }) => {
    await stubDexAuth(page, 'signed-out');
    await stubBillingApi(page, { summary: 'none' });
    await openMembershipPane(page);

    const fallback = page.locator('#dx-settings-auth-fallback');
    await expect(fallback).toBeVisible({ timeout: 15000 });
    // NB: the heading text carries an injected zero-width char, so match "SIGN IN" only.
    await expect(fallback).toContainText(/SIGN\s+IN/i);
    await expect(fallback).toHaveAttribute('data-dx-auth-state', /.+/);
  });
});
