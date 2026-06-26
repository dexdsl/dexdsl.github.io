import { expect, test, type Page } from 'playwright/test';

async function stubHeaderRuntimes(page: Page): Promise<void> {
  await page.route('**/assets/js/header-slot.js', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.__dxHeaderSlotStub = true;' });
  });

  await page.route('**/assets/js/dx-scroll-dot.js', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.__dxScrollDotStub = true;' });
  });
}

async function stubDexAuthRuntime(page: Page): Promise<void> {
  const script = `
    (() => {
      const user = { sub: 'auth0|submit-call-e2e', name: 'Call Submitter', family_name: 'Submitter', email: 'submit-call@example.com' };
      const auth = {
        ready: Promise.resolve({ isAuthenticated: true }),
        resolve: () => Promise.resolve({ authenticated: true }),
        requireAuth: () => Promise.resolve({ status: 'authenticated' }),
        isAuthenticated: () => Promise.resolve(true),
        getUser: () => Promise.resolve(user),
        getAccessToken: () => Promise.resolve('stub-access-token'),
        signIn: () => Promise.resolve(),
        signOut: () => Promise.resolve(),
      };
      window.DEX_AUTH = auth;
      window.dexAuth = auth;
      window.auth0 = { getUser: () => Promise.resolve(user) };
      window.AUTH0_USER = user;
      window.auth0Sub = user.sub;
    })();
  `;

  await page.route('**/assets/dex-auth.js', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: script });
  });
}

async function waitReady(page: Page): Promise<void> {
  const root = page.locator('#dex-submit');
  await expect(root).toBeVisible();
  await expect.poll(async () => root.getAttribute('data-dx-fetch-state')).toBe('ready');
}

async function stubCallsRegistry(page: Page): Promise<void> {
  await page.route('**/data/calls.registry.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version: 'calls-registry-v1',
        updatedAt: '2026-03-05T00:00:00.000Z',
        sequenceGroup: 'inDex',
        activeCallId: 'in-dex-a-2026-9',
        calls: [
          {
            id: 'in-dex-a-2026-9',
            status: 'active',
            lane: 'in-dex-a',
            year: 2026,
            sequence: 9,
            cycleCode: 'A2026.9',
            cycleLabel: 'IN DEX A2026.9',
            title: 'Test Active A lane',
          },
        ],
      }),
    });
  });
}

async function completeSendStep(page: Page, signature = 'Call Submitter'): Promise<void> {
  const step = page.locator('[data-dx-submit-step="send"]');
  await expect(step).toBeVisible();
  await step.locator('[data-dx-submit-license-signature]').fill(signature);

  const licenseAccept = step.locator('[data-dx-submit-license-accept]');
  if (!(await licenseAccept.isChecked())) {
    await licenseAccept.check();
  }

  const rightsAck = step.locator('[data-dx-submit-rights-ack]');
  if (!(await rightsAck.isChecked())) {
    await rightsAck.check();
  }
}

const WORKER = 'https://dex-api.spring-fog-8edd.workers.dev';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type',
};

test('call deep link boots call flow and submits via the worker submit_call payload', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubCallsRegistry(page);

  let quotaKind = '';
  let submitParams: Record<string, string> | null = null;

  // Calls route through the same worker as samples (no Google Apps Script).
  await page.route(`${WORKER}/**`, async (route) => {
    const req = route.request();
    const method = req.method().toUpperCase();
    const url = new URL(req.url());
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    const json = (body: unknown) => route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/me/submissions/quota') {
      quotaKind = url.searchParams.get('kind') || '';
      return json({ weeklyLimit: 2, weeklyUsed: 0, weeklyRemaining: 2 });
    }
    if (url.pathname === '/me/submissions' && method === 'POST') {
      submitParams = req.postDataJSON();
      return json({ status: 'ok', row: 88, submissionId: 'sub_call_88', weeklyUsed: 1, weeklyRemaining: 1, submissionKind: 'call' });
    }
    return json({ ok: true });
  });

  await page.goto('/entry/submit/?flow=call&lane=in-dex-a&subcall=b&cycle=IN%20DEX%20A2026.9&via=call', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await expect(page.locator('#dex-submit')).toHaveAttribute('data-dx-submit-flow', 'call');
  await expect(page.locator('#dex-submit')).toHaveAttribute('data-dx-submit-lane', 'in-dex-a');
  await expect(page.locator('[data-dx-submit-step="compose"]')).toBeVisible();

  const compose = page.locator('[data-dx-submit-step="compose"]');
  await compose.locator('.dx-submit-field', { hasText: 'Proposal title' }).locator('input').fill('IN DEX A call proposal');
  await compose.locator('.dx-submit-field', { hasText: 'Proposer / creator' }).locator('input').fill('Call Submitter');
  await compose.locator('.dx-submit-field', { hasText: 'Subcall' }).locator('select').selectOption('b');
  await compose.locator('.dx-submit-field', { hasText: 'Proposal format' }).locator('select').selectOption('act');
  await compose.locator('.dx-submit-field', { hasText: 'Public materials link' }).locator('input').fill('https://drive.google.com/mock-call-source');
  await compose.locator('.dx-submit-field', { hasText: 'Notes for Dex team' }).locator('textarea').fill('call note');

  await page.getByRole('button', { name: 'Continue to rights & send' }).click();
  await completeSendStep(page, 'Call Submitter');
  await page.getByRole('button', { name: 'Submit call' }).click();

  await expect(page.locator('[data-dx-submit-step="done"]')).toContainText('Call submission received');

  expect(quotaKind).toBe('call');
  expect(submitParams).not.toBeNull();
  if (!submitParams) return;
  expect(submitParams.action).toBe('submit_call');
  expect(submitParams.callLane).toBe('in-dex-a');
  expect(submitParams.callSubcall).toBe('b');
  expect(submitParams.callCycle).toBe('IN DEX A2026.9');
  expect(submitParams.sourceType).toBe('call');
  expect(submitParams.submissionKind).toBe('call');
  expect(submitParams.licenseAccepted).toBe('yes');
  expect(submitParams.rightsAcknowledged).toBe('yes');
  expect(submitParams.digitalSignatureName).toBe('Call Submitter');
});
