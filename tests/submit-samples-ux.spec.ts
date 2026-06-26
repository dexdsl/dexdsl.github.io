import { expect, test, type Page } from 'playwright/test';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type',
};

const GENERATED_LOOKUP_REGEX = /^SUB\d{2}-[A-Z]\.[A-Za-z]{3}\s+[A-Za-z][A-Za-z\-']*\s+(?:A|V|AV|O)\d{4}$/;

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
      const user = { sub: 'auth0|submit-ui-e2e', name: 'Seb Solis', family_name: 'Solis', email: 'submit@example.com' };
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

async function stubApiBaseline(page: Page): Promise<void> {
  await page.route('https://dex-api.spring-fog-8edd.workers.dev/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/me/submissions')) {
      await route.fallback();
      return;
    }
    if (route.request().method().toUpperCase() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: CORS_HEADERS,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
}

type SubmitWorkerStubOptions = {
  quota?: {
    weeklyLimit: number;
    weeklyUsed: number;
    weeklyRemaining: number;
  };
  quotaDelayMs?: number;
  submitDelayMs?: number;
  onQuota?: () => void;
  onSubmit?: (payload: Record<string, string>) => void;
};

async function stubSubmitWorker(page: Page, options: SubmitWorkerStubOptions = {}): Promise<void> {
  const quota = options.quota || { weeklyLimit: 4, weeklyUsed: 1, weeklyRemaining: 3 };
  await page.route('https://dex-api.spring-fog-8edd.workers.dev/**', async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    if (url.pathname === '/me/submissions/quota' && method === 'GET') {
      if (options.onQuota) options.onQuota();
      if (options.quotaDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.quotaDelayMs));
      }
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', ...quota }),
      });
      return;
    }
    if (url.pathname === '/me/submissions' && method === 'POST') {
      const raw = request.postDataJSON() as Record<string, unknown>;
      const payload = Object.fromEntries(Object.entries(raw || {}).map(([key, value]) => [key, String(value ?? '')]));
      if (options.onSubmit) options.onSubmit(payload);
      if (options.submitDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.submitDelayMs));
      }
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          row: 42,
          submissionId: 'sub-e2e-001',
          ...quota,
          weeklyUsed: Math.min(quota.weeklyLimit, quota.weeklyUsed + 1),
          weeklyRemaining: Math.max(0, quota.weeklyRemaining - 1),
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: CORS_HEADERS,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
}

async function waitReady(page: Page): Promise<void> {
  const root = page.locator('#dex-submit');
  await expect(root).toBeVisible();
  await expect.poll(async () => root.getAttribute('data-dx-fetch-state')).toBe('ready');
}

async function stubNoActiveCallsRegistry(page: Page): Promise<void> {
  await page.route('**/data/calls.registry.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version: 'calls-registry-v1',
        updatedAt: '2026-03-05T00:00:00.000Z',
        sequenceGroup: 'inDex',
        activeCallId: '',
        calls: [],
      }),
    });
  });
}

// Compose is the first step in the redesigned flow (no flow-gate / Begin screen).
async function waitComposeReady(page: Page) {
  await expect(page.locator('[data-dx-submit-step="compose"]')).toBeVisible();
  const cont = page.getByRole('button', { name: 'Continue to rights & send' });
  await expect(cont).toBeVisible();
  await expect.poll(async () => cont.isDisabled()).toBe(false);
  return cont;
}

type SampleEssentials = {
  title: string;
  creator: string;
  category: string;
  instrument: string;
  collection: RegExp;
  link: string;
  notes?: string;
};

async function fillSampleEssentials(page: Page, opts: SampleEssentials): Promise<void> {
  const step = page.locator('[data-dx-submit-step="compose"]');
  await step.locator('.dx-submit-field', { hasText: 'Proposed sample title' }).locator('input').fill(opts.title);
  await step.locator('.dx-submit-field', { hasText: 'Sample creator(s)' }).locator('input').fill(opts.creator);
  await step.locator('.dx-submit-field', { hasText: 'Instrument category' }).locator('select').selectOption(opts.category);
  await step.locator('.dx-submit-field', { hasText: 'Instrument' }).locator('input').fill(opts.instrument);
  await step.locator('.dx-submit-badge').filter({ hasText: opts.collection }).first().click();
  await step.locator('.dx-submit-field', { hasText: 'Public source link' }).locator('input').fill(opts.link);
  if (opts.notes) {
    await step.locator('.dx-submit-field', { hasText: 'Notes for Dex team' }).locator('textarea').fill(opts.notes);
  }
}

async function completeSendStep(page: Page, signature = 'Seb Solis'): Promise<void> {
  const step = page.locator('[data-dx-submit-step="send"]');
  await expect(step).toBeVisible();
  await step.locator('[data-dx-submit-license-signature]').fill(signature);
  const licenseAccept = step.locator('[data-dx-submit-license-accept]');
  if (!(await licenseAccept.isChecked())) await licenseAccept.check();
  const rightsAck = step.locator('[data-dx-submit-rights-ack]');
  if (!(await rightsAck.isChecked())) await rightsAck.check();
}

test('submit shows compose directly with no flow-gate when no active call exists', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubApiBaseline(page);
  await stubNoActiveCallsRegistry(page);

  await page.goto('/entry/submit/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await expect(page.locator('#dex-submit')).toHaveAttribute('data-dx-submit-has-active-call', 'false');
  await expect(page.locator('[data-dx-submit-step="flow-gate"]')).toHaveCount(0);
  await expect(page.locator('[data-dx-submit-step="compose"]')).toBeVisible();
  await expect(page.locator('.dx-submit-switch')).toBeVisible();
  await expect(page.locator('#dex-submit')).toHaveAttribute('data-dx-submit-flow', 'sample');
});

type PitchSystemValue = '12-tet' | '24-tet' | 'ji' | 'atonal' | 'non-pitched';

type PitchSubmitScenario = {
  pitchSystem: PitchSystemValue;
  descriptor?: string;
  expectedKeyCenter: string;
};

const PITCH_SEG_LABEL: Record<PitchSystemValue, string> = {
  '12-tet': '12-TET',
  '24-tet': '24-TET',
  ji: 'Just Intonation (JI)',
  atonal: 'Atonal',
  'non-pitched': 'Non-pitched',
};

async function submitSampleWithPitch(page: Page, scenario: PitchSubmitScenario): Promise<Record<string, string>> {
  let submitParams: Record<string, string> | null = null;

  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubSubmitWorker(page, {
    onSubmit: (payload) => {
      submitParams = payload;
    },
  });

  await page.goto('/entry/submit/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await waitComposeReady(page);
  await fillSampleEssentials(page, {
    title: 'Pitch Scenario Sample',
    creator: 'Pitch Scenario Artist',
    category: 'B - Brass',
    instrument: 'Prepared Trombone',
    collection: /^Audio$/,
    link: 'https://drive.google.com/mock-source',
    notes: 'pitch serialization regression',
  });

  await page.locator('.dx-submit-advanced-summary').click();
  await page.locator('.dx-submit-seg-option', { hasText: PITCH_SEG_LABEL[scenario.pitchSystem] }).click();
  if (scenario.pitchSystem === '12-tet' || scenario.pitchSystem === '24-tet') {
    const label = scenario.descriptor || 'C';
    await page.locator('.dx-submit-notechip').filter({ hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}$`) }).first().click();
  } else if (scenario.pitchSystem === 'ji') {
    await page.locator('[data-dx-submit-step="compose"]').locator('.dx-submit-field', { hasText: 'Tonality' }).locator('input').fill(scenario.descriptor || '');
  }

  await (await waitComposeReady(page)).click();
  await completeSendStep(page);
  await page.getByRole('button', { name: /Submit sample/i }).click();
  await expect(page.locator('[data-dx-submit-step="done"]')).toBeVisible();

  expect(submitParams).not.toBeNull();
  return submitParams || {};
}

test('submit page uses desktop 60/40 shell with sticky command panel', async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width < 1200, 'desktop-only assertion');

  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubApiBaseline(page);

  await page.goto('/entry/submit/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await waitComposeReady(page);
  await expect(page.locator('#dex-submit')).toContainText('uploads available');
  await expect(page.locator('#dex-submit')).not.toContainText('Daily uploads available');

  const layout = await page.evaluate(() => {
    const shell = document.querySelector('[data-dx-submit-shell]') as HTMLElement | null;
    const main = shell?.querySelector('.dx-submit-main') as HTMLElement | null;
    const command = shell?.querySelector('.dx-submit-command') as HTMLElement | null;
    if (!shell || !main || !command) {
      return null;
    }

    const shellRect = shell.getBoundingClientRect();
    const mainRect = main.getBoundingClientRect();
    const commandRect = command.getBoundingClientRect();
    const commandStyle = window.getComputedStyle(command);

    return {
      shellWidth: Math.round(shellRect.width),
      mainWidth: Math.round(mainRect.width),
      commandWidth: Math.round(commandRect.width),
      topDelta: Math.abs(Math.round(mainRect.top - commandRect.top)),
      commandLeft: Math.round(commandRect.left),
      mainRight: Math.round(mainRect.right),
      commandPosition: commandStyle.position,
    };
  });

  expect(layout).not.toBeNull();
  if (!layout) return;

  expect(layout.commandPosition).toBe('sticky');
  expect(layout.topDelta).toBeLessThan(80);
  expect(layout.commandLeft).toBeGreaterThan(layout.mainRight - 4);
  expect(layout.mainWidth).toBeGreaterThan(layout.commandWidth);
});

test('submit page collapses to single-column on mobile with readable field text', async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width > 500, 'mobile-only assertion');

  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubApiBaseline(page);

  await page.goto('/entry/submit/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await waitComposeReady(page);

  const stack = await page.evaluate(() => {
    const shell = document.querySelector('[data-dx-submit-shell]') as HTMLElement | null;
    const main = shell?.querySelector('.dx-submit-main') as HTMLElement | null;
    const command = shell?.querySelector('.dx-submit-command') as HTMLElement | null;
    if (!shell || !main || !command) return null;

    const mainRect = main.getBoundingClientRect();
    const commandRect = command.getBoundingClientRect();
    return {
      commandTop: Math.round(commandRect.top),
      mainBottom: Math.round(mainRect.bottom),
      verticalGap: Math.round(commandRect.top - mainRect.bottom),
    };
  });

  expect(stack).not.toBeNull();
  if (!stack) return;
  expect(stack.commandTop).toBeGreaterThanOrEqual(stack.mainBottom - 2);
  expect(stack.verticalGap).toBeGreaterThanOrEqual(-2);

  const fontSize = await page.evaluate(() => {
    const input = document.querySelector('[data-dx-submit-step="compose"] .dx-submit-input') as HTMLElement | null;
    if (!input) return 0;
    return Number.parseFloat(window.getComputedStyle(input).fontSize || '0');
  });
  expect(fontSize).toBeGreaterThanOrEqual(16);
});

test('submit shell reaches ready before delayed auth resolves, then hydrates quota', async ({ page }) => {
  await stubHeaderRuntimes(page);

  await page.route('**/assets/dex-auth.js', async (route) => {
    const script = `
      (() => {
        const user = { sub: 'auth0|submit-slow-auth', family_name: 'Solis', name: 'Slow Auth User' };
        const delay = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));
        const auth = {
          ready: delay(2800, { isAuthenticated: true }),
          resolve: () => delay(2800, { authenticated: true }),
          requireAuth: () => Promise.resolve({ status: 'authenticated' }),
          isAuthenticated: () => Promise.resolve(true),
          getUser: () => delay(2800, user),
          getAccessToken: () => Promise.resolve('slow-auth-token'),
          signIn: () => Promise.resolve(),
          signOut: () => Promise.resolve(),
        };
        window.DEX_AUTH = auth;
        window.dexAuth = auth;
        window.auth0 = { getUser: () => delay(2800, user) };
        setTimeout(() => {
          window.AUTH0_USER = user;
          window.auth0Sub = user.sub;
          document.dispatchEvent(new Event('dex-auth:ready'));
        }, 2800);
      })();
    `;
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: script });
  });
  await stubSubmitWorker(page);

  const start = Date.now();
  await page.goto('/entry/submit/', { waitUntil: 'domcontentloaded' });
  const root = page.locator('#dex-submit');
  await expect.poll(async () => root.getAttribute('data-dx-fetch-state')).toBe('ready');
  const readyElapsed = Date.now() - start;
  expect(readyElapsed).toBeLessThan(2500);

  await expect(page.locator('[data-dx-submit-step="compose"]')).toBeVisible();
  const cont = page.getByRole('button', { name: 'Continue to rights & send' });
  await expect(cont).toBeVisible();
  await expect(cont).toBeDisabled();
  await expect.poll(async () => (await page.locator('#dex-submit').innerText()).replace(/\u200C/g, '')).toContain('checking your account quota');
  await expect.poll(async () => cont.isDisabled()).toBe(false);
});

test('submit wizard enforces required fields and keeps payload key contract on submit', async ({ page }) => {
  let submitParams: Record<string, string> | null = null;
  let quotaRequestCount = 0;

  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubSubmitWorker(page, {
    quota: { weeklyLimit: 4, weeklyUsed: 0, weeklyRemaining: 4 },
    onQuota: () => {
      quotaRequestCount += 1;
    },
    onSubmit: (payload) => {
      submitParams = payload;
    },
  });

  await page.goto('/entry/submit/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const cont = await waitComposeReady(page);

  await cont.click();
  await expect(page.locator('[data-dx-submit-step="compose"]')).toBeVisible();
  await expect(page.locator('.dx-submit-toast--error').last()).toContainText('Missing');

  const step = page.locator('[data-dx-submit-step="compose"]');
  await fillSampleEssentials(page, {
    title: 'Submission Title E2E',
    creator: 'Jane Doe',
    category: 'B - Brass',
    instrument: 'Prepared Trombone',
    collection: /^Audio$/,
    link: 'https://drive.google.com/mock-source',
    notes: 'submission note for review',
  });
  await page.locator('.dx-submit-advanced-summary').click();
  await step.locator('.dx-submit-seg-option', { hasText: '12-TET' }).click();
  await step.locator('.dx-submit-notechip', { hasText: 'C♯/D♭' }).click();

  await page.getByRole('button', { name: 'Continue to rights & send' }).click();
  await expect(page.locator('[data-dx-submit-step="send"]')).toBeVisible();
  await completeSendStep(page, 'Jane Doe');

  await page.getByRole('button', { name: /Submit sample/i }).click();

  await expect(page.locator('[data-dx-submit-step="done"]')).toBeVisible();
  await expect(page.locator('#dex-submit')).toContainText('Submission received');

  expect(submitParams).not.toBeNull();
  if (!submitParams) return;
  expect(quotaRequestCount).toBeGreaterThan(0);

  const keys = Object.keys(submitParams);
  expect(keys).toEqual(
    expect.arrayContaining([
      'auth0Sub',
      'title',
      'creator',
      'category',
      'instrument',
      'bpm',
      'pitchSystem',
      'pitchDescriptor',
      'keyCenter',
      'scaleQuality',
      'tags',
      'collectionType',
      'outputTypes',
      'services',
      'license',
      'licenseAccepted',
      'rightsAcknowledged',
      'digitalSignatureName',
      'link',
      'notes',
      'submissionYear',
      'performerToken',
      'submissionLookupNumber',
      'finalLookupNumber',
      'status',
    ]),
  );

  expect(submitParams.status).toBe('pending');
  expect(submitParams.auth0Sub).toBe('auth0|submit-ui-e2e');
  expect(submitParams.performerToken).toBe('So');
  expect(submitParams.submissionLookupNumber).toMatch(GENERATED_LOOKUP_REGEX);
  expect(submitParams.finalLookupNumber).toBe('');
  expect(submitParams.pitchSystem).toBe('12-tet');
  expect(submitParams.pitchDescriptor).toBe('C♯/D♭');
  expect(submitParams.keyCenter).toBe('12-TET: C♯/D♭');
  expect(submitParams.collectionType).toBe('A');
  expect(submitParams.licenseAccepted).toBe('yes');
  expect(submitParams.rightsAcknowledged).toBe('yes');
  expect(submitParams.digitalSignatureName).toBe('Jane Doe');
  expect(submitParams.link).toBe('https://drive.google.com/mock-source');

  const lookupText = String(await page.locator('[data-dx-submit-step="done"] .dx-submit-pill--accent').first().textContent() || '').trim();
  expect(lookupText).toMatch(GENERATED_LOOKUP_REGEX);
});

test('submit services chips use custom tooltip contract and sidebar guidance follows focused field', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubSubmitWorker(page, {
    quota: { weeklyLimit: 4, weeklyUsed: 0, weeklyRemaining: 4 },
  });

  await page.goto('/entry/submit/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await waitComposeReady(page);
  const step = page.locator('[data-dx-submit-step="compose"]');
  await step.locator('.dx-submit-field', { hasText: 'Instrument' }).locator('input').fill('Prepared Trombone');
  await step.locator('.dx-submit-field', { hasText: 'Instrument' }).locator('input').focus();
  await expect(page.locator('.dx-submit-command')).toContainText('Instrument guidance');

  await page.locator('.dx-submit-advanced-summary').click();
  const serviceChip = step.locator('.dx-submit-badge', { hasText: 'Color grading' }).first();
  await expect(serviceChip).toHaveAttribute('data-dx-tooltip', /color/i);
  await expect(serviceChip).not.toHaveAttribute('title', /.+/);
  await serviceChip.hover();

  const tooltip = page.locator('#dx-submit-tooltip-layer');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('Shot-to-shot color balancing');

  const tooltipMeta = await page.evaluate(() => {
    const layer = document.getElementById('dx-submit-tooltip-layer');
    if (!(layer instanceof HTMLElement)) return null;
    const style = window.getComputedStyle(layer);
    return {
      parentTag: layer.parentElement?.tagName || '',
      position: style.position,
      backgroundColor: style.backgroundColor,
      color: style.color,
    };
  });
  expect(tooltipMeta).not.toBeNull();
  if (!tooltipMeta) return;
  expect(tooltipMeta.parentTag).toBe('BODY');
  expect(tooltipMeta.position).toBe('fixed');

  const hasZwnj = await page.evaluate(() => {
    const command = document.querySelector('.dx-submit-command');
    return !!command && command.textContent.includes('‌');
  });
  expect(hasZwnj).toBeTruthy();
});

test('submit quota timeout surfaces retry state without page errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(String(error?.message || error));
  });

  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubSubmitWorker(page, {
    quota: { weeklyLimit: 4, weeklyUsed: 0, weeklyRemaining: 4 },
    quotaDelayMs: 12000,
  });

  await page.goto('/entry/submit/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await waitComposeReady(page);
  await fillSampleEssentials(page, {
    title: 'Late quota response',
    creator: 'No Reference Error',
    category: 'B - Brass',
    instrument: 'Prepared Trombone',
    collection: /^Audio$/,
    link: 'https://drive.google.com/mock-source',
  });

  await page.getByRole('button', { name: 'Continue to rights & send' }).click();
  await completeSendStep(page);
  await page.getByRole('button', { name: /Submit sample/i }).click();

  await expect(page.locator('.dx-submit-toast--error').last()).toContainText('Could not verify weekly quota');
  await page.waitForTimeout(12300);
  expect(pageErrors).toHaveLength(0);
});

const PITCH_SERIALIZATION_SCENARIOS: Array<PitchSubmitScenario & { name: string }> = [
  {
    name: '24-TET root',
    pitchSystem: '24-tet',
    descriptor: 'C quarter-sharp',
    expectedKeyCenter: '24-TET: C quarter-sharp',
  },
  {
    name: 'JI descriptor',
    pitchSystem: 'ji',
    descriptor: '5/4 on C',
    expectedKeyCenter: 'JI: 5/4 on C',
  },
  {
    name: 'Atonal quick path',
    pitchSystem: 'atonal',
    expectedKeyCenter: 'Atonal',
  },
  {
    name: 'Non-pitched quick path',
    pitchSystem: 'non-pitched',
    expectedKeyCenter: 'Non-pitched',
  },
];

for (const scenario of PITCH_SERIALIZATION_SCENARIOS) {
  test(`submit serializes ${scenario.name} into canonical keyCenter`, async ({ page }) => {
    const params = await submitSampleWithPitch(page, scenario);
    expect(params.pitchSystem).toBe(scenario.pitchSystem);
    expect(params.pitchDescriptor || '').toBe(scenario.descriptor || '');
    expect(params.keyCenter).toBe(scenario.expectedKeyCenter);
  });
}

test('submit compose locks Continue when weekly quota is exhausted for the signed-in user', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubSubmitWorker(page, {
    quota: { weeklyLimit: 4, weeklyUsed: 4, weeklyRemaining: 0 },
  });

  await page.goto('/entry/submit/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await expect(page.locator('[data-dx-submit-step="compose"]')).toBeVisible();
  await expect(page.locator('#dex-submit')).toContainText('uploads available: 0 / 4');
  const cont = page.getByRole('button', { name: 'Continue to rights & send' });
  await expect(cont).toBeDisabled();
  await expect(page.locator('[data-dx-submit-step="compose"]')).toContainText('Action required');
  await expect(page.locator('[data-dx-submit-step="compose"]')).toContainText('Weekly upload limit reached for this account.');
  await expect(page.locator('[data-dx-submit-step="send"]')).toHaveCount(0);
});

test('submit flow locks controls, shows fetching sheen, then proceeds to done', async ({ page }) => {
  await stubHeaderRuntimes(page);
  await stubDexAuthRuntime(page);
  await stubSubmitWorker(page, {
    quota: { weeklyLimit: 4, weeklyUsed: 0, weeklyRemaining: 4 },
    submitDelayMs: 700,
  });

  await page.goto('/entry/submit/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await waitComposeReady(page);
  await fillSampleEssentials(page, {
    title: 'Submit lock sequence',
    creator: 'Queue Lock',
    category: 'B - Brass',
    instrument: 'Prepared Trombone',
    collection: /^Audio$/,
    link: 'https://drive.google.com/sequence-source',
  });

  await page.getByRole('button', { name: 'Continue to rights & send' }).click();
  await completeSendStep(page);

  const sendStep = page.locator('[data-dx-submit-step="send"]');
  await sendStep.getByRole('button', { name: /Submit sample/i }).click();

  const root = page.locator('#dex-submit');
  await expect(root).toHaveAttribute('data-dx-submit-submitting', 'true');
  await expect(sendStep.locator('[data-dx-submit-license-signature]')).toBeDisabled();
  await expect(sendStep.getByRole('button', { name: 'Back' })).toBeDisabled();
  await expect(sendStep.getByRole('button', { name: /Submitting/i })).toBeDisabled();

  const sheenState = await page.evaluate(() => {
    const el = document.getElementById('dex-submit');
    const main = el?.querySelector('.dx-submit-main');
    if (!(el instanceof HTMLElement) || !(main instanceof HTMLElement)) return null;
    const pseudo = window.getComputedStyle(main, '::after');
    return {
      submitting: el.getAttribute('data-dx-submit-submitting') || '',
      pseudoContent: pseudo.content,
      animationName: pseudo.animationName || '',
    };
  });
  expect(sheenState).not.toBeNull();
  if (!sheenState) return;
  expect(sheenState.submitting).toBe('true');
  expect(sheenState.pseudoContent).not.toBe('none');
  expect(sheenState.animationName).toContain('dx-submit-fetch-sheen');

  await page.waitForTimeout(150);
  await expect(page.locator('[data-dx-submit-step="done"]')).toBeVisible();
  await expect(root).not.toHaveAttribute('data-dx-submit-submitting', 'true');
});

test('submit hard-load uses standard footer geometry and icon sprite', async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip(!viewport || viewport.width < 980, 'desktop-only assertion');

  await stubDexAuthRuntime(page);
  await stubApiBaseline(page);

  await page.goto('/entry/submit/', { waitUntil: 'domcontentloaded' });
  await waitReady(page);

  await expect(page.locator('.header-announcement-bar-wrapper').first()).toBeVisible();
  await expect(page.locator('.dex-footer').first()).toBeVisible();
  await expect(page.locator('svg[data-usage="social-icons-svg"] symbol#youtube-unauth-icon')).toHaveCount(1);

  const footerMetrics = await page.evaluate(() => {
    const footer = document.querySelector('.dex-footer') as HTMLElement | null;
    if (!footer) return null;
    const rect = footer.getBoundingClientRect();
    const logoWidths = Array.from(footer.querySelectorAll('.footer-logo img'))
      .map((node) => (node as HTMLElement).getBoundingClientRect().width)
      .filter((value) => Number.isFinite(value));
    return {
      height: Math.round(rect.height),
      maxLogoWidth: Math.round(logoWidths.length ? Math.max(...logoWidths) : 0),
    };
  });

  expect(footerMetrics).not.toBeNull();
  if (!footerMetrics) return;
  expect(footerMetrics.height).toBeGreaterThan(72);
  expect(footerMetrics.height).toBeLessThan(320);
  expect(footerMetrics.maxLogoWidth).toBeLessThan(220);
});
