import { test, type Page } from 'playwright/test';
import fs from 'node:fs';

const OUT = '/private/tmp/claude-501/-Users-seb-dexdsl-github-io/dd139c6a-fa1d-46ff-8d5d-76a99e4f4a6f/scratchpad';
const API = 'https://dex-api.spring-fog-8edd.workers.dev';
const HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type',
};

function summaryPayload() {
  const cats = ['submissions','polls','favorites','releases','license','calls','profile','secret'];
  const badges = [];
  for (let i = 0; i < 14; i++) {
    badges.push({
      id: `b${i}`, title: `Achievement ${i}`, description: `Do the thing number ${i} to earn this badge.`,
      category: cats[i % cats.length], tier: ['bronze','silver','gold','legend'][i % 4],
      glyph: ['submission','poll','favorite','release','license','call','profile','vault'][i % 8],
      threshold: 10, progress: i % 11, points: 10 + i, secret: i >= 12, unlocked: i < 6,
      clueGrowlix: i >= 12 ? '@@@ hidden @@@' : '',
    });
  }
  return { ok: true, requestId: 'r', catalogVersion: '2026.03.v1',
    totals: { unlocked: 6, total: 14, points: 220 },
    metrics: { submissionsTotal: 4, releasesTotal: 2, pollVotes: 12, favoritesCount: 7 },
    badges, newlyUnlocked: [{ id: 'b3' }], warnings: [] };
}

async function stubAuth(page: Page) {
  const user = { sub: 'auth0|shots', name: 'Mobile Shots', email: 'shots@example.com', picture: '' };
  const script = `(() => {
    const user = ${JSON.stringify(user)};
    const auth = {
      ready: Promise.resolve({ isAuthenticated: true }),
      resolve: () => Promise.resolve({ authenticated: true, user }),
      requireAuth: () => Promise.resolve({ status: 'authenticated', user }),
      guard: () => Promise.resolve({ status: 'authenticated', user }),
      isAuthenticated: () => Promise.resolve(true),
      getUser: () => Promise.resolve(user),
      getAccessToken: () => Promise.resolve('stub-token'),
      signIn: () => Promise.resolve(), signOut: () => Promise.resolve(),
    };
    window.DEX_AUTH = auth; window.dexAuth = auth; window.AUTH0_USER = user;
    window.auth0Sub = user.sub; window.auth0 = { getUser: () => Promise.resolve(user) };
    try { window.dispatchEvent(new CustomEvent('dex-auth:ready', { detail: { isAuthenticated: true, user } })); } catch {}
  })();`;
  await page.route('**/assets/dex-auth.js', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: script }));
}

async function stubApi(page: Page) {
  await page.route(`${API}/**`, async (route) => {
    const req = route.request();
    const method = req.method().toUpperCase();
    const path = new URL(req.url()).pathname;
    const json = (body: unknown) => route.fulfill({ status: 200, headers: HEADERS, contentType: 'application/json', body: JSON.stringify(body) });
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: HEADERS });

    if (path === '/me/messages') return json({ messages: [
      { id: 'sys-001', sourceType: 'system', category: 'billing', severity: 'critical', title: 'Payment failed', body: 'Your latest payment attempt failed. Update your billing method now or your membership will lapse.', href: '/entry/settings/#membership', createdAt: '2026-06-20T18:00:00.000Z', readAt: '', archivedAt: '' },
      { id: 'sys-002', sourceType: 'system', category: 'polls', severity: 'info', title: 'Poll closed', body: 'A poll you interacted with has closed and results are available.', href: '/polls/', createdAt: '2026-06-19T15:00:00.000Z', readAt: '2026-06-19T16:00:00.000Z', archivedAt: '' },
    ] });

    if (path === '/me/submissions') return json({
      threads: [
        { submissionId: 'sub-001', lookup: 'SUB12-B.Pre Do A2026', title: 'Brass Session', creator: 'John Doe', currentStage: 'reviewing', currentStatusRaw: 'Pending Review', latestPublicNote: 'Please share one dry alternate take of the brass swell.', sourceRow: 12, collectionType: 'A', license: 'Joint', updatedAt: '2026-02-26T09:00:00.000Z', acknowledgedAt: '', archivedAt: '' },
        { submissionId: 'sub-002', lookup: 'SUB08-K.Org Do AV2026', title: 'Organ Session', creator: 'Jane Doe', currentStage: 'accepted', currentStatusRaw: 'Accepted', latestPublicNote: 'Accepted for the next release set.', sourceRow: 8, collectionType: 'C', license: 'CC0', updatedAt: '2026-02-24T10:30:00.000Z', acknowledgedAt: '2026-02-24T11:00:00.000Z', archivedAt: '' },
      ],
      submissions: [
        { row: 12, timestamp: '2026-02-26T09:00:00.000Z', collectionType: 'A', license: 'Joint', status: 'Pending Review', note: 'Please share one dry alternate take.' },
      ],
    });

    if (path === '/me/ops/tickets') return json({ ok: true, tickets: [
      { id: 'req-press-01', requestId: 'req-press-01', kind: 'press', status: 'in_review', title: 'Pressroom Launch Story', name: 'Alex Tester', email: 'alex@example.com', links: 'https://example.com/pressroom-launch', timeframe: 'Q2 2026', createdAt: '2026-02-25T10:00:00.000Z', updatedAt: '2026-02-26T12:00:00.000Z', publicNote: 'Press request received and queued for triage.', metadata: {} },
    ] });

    if (path === '/me/profile') return json({
      sub: 'auth0|shots', name: 'Mobile Shots', email: 'shots@example.com',
      creator_default: 'Mobile Shots', instrument_default: 'Drums', bio: 'Test bio.',
      public_profile: { handle: 'mobile-shots', display_name: 'Mobile Shots', profile_public: true, profile_url: '/u/mobile-shots/' },
    });

    if (path.startsWith('/me/achievements/summary')) return json(summaryPayload());
    if (path.startsWith('/me/achievements/history')) return json({ ok: true, requestId: 'h', events: [
      { id: 'e1', badgeId: 'b3', badgeTitle: 'Achievement 3', eventType: 'unlocked', createdAt: '2026-03-05T10:00:00.000Z', detail: 'Unlocked.' },
    ], nextCursor: '' });
    if (path.startsWith('/me/achievements')) return json({ ok: true, requestId: 's' });

    if (path === '/me/billing/summary' || path === '/me/subscription') return json({ ok: true, plan: 'free', status: 'none', subscription: null });
    if (path === '/me/billing/plans') return json({ ok: true, plans: [] });
    if (path.startsWith('/me/invoices')) return json({ ok: true, invoices: [] });
    if (path.startsWith('/me/contributions')) return json({ ok: true, claims: [], claimable: [] });

    return json({ ok: true });
  });
}

const ROUTES: Array<[string, string, string]> = [
  ['/entry/messages/', 'messages', '#dex-msg'],
  ['/entry/settings/', 'settings', '#page'],
  ['/entry/achievements/', 'achievements', '#dex-achv'],
];

for (const [path, name] of ROUTES) {
  test(`shot ${name}`, async ({ page }) => {
    await stubAuth(page);
    await stubApi(page);
    const errs: string[] = [];
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    const ov = await page.evaluate(() => {
      const W = window.innerWidth;
      const offenders: Array<{ sel: string; w: number; right: number; oxy: string }> = [];
      document.querySelectorAll('main *').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.right > W + 1 || r.width > W + 1) {
          const cs = getComputedStyle(el);
          const sel = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
          offenders.push({ sel, w: Math.round(r.width), right: Math.round(r.right), oxy: cs.overflowX });
        }
      });
      return { docW: document.documentElement.scrollWidth, winW: W,
        fetchState: (document.querySelector('[data-dx-fetch-state]') as HTMLElement)?.getAttribute('data-dx-fetch-state'),
        offenders: offenders.slice(0, 25),
        mainH: Math.round((document.querySelector('main') as HTMLElement)?.getBoundingClientRect().height || 0),
        winH: window.innerHeight };
    });
    const probe = await page.evaluate(() => {
      const out: Array<Record<string, unknown>> = [];
      document.querySelectorAll('body *').forEach((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (r.width < window.innerWidth * 0.7) return;
        if (r.height < 18 || r.height > 200) return;
        const op = parseFloat(cs.opacity);
        const bg = cs.backgroundColor;
        const looksFaint = (op > 0 && op < 0.95) || /rgba\([^)]*0?\.[0-3]\d*\)/.test(bg);
        if (!looksFaint) return;
        out.push({ tag: el.tagName.toLowerCase(), id: el.id, cls: (typeof el.className === 'string' ? el.className : ''),
          top: Math.round(r.top), h: Math.round(r.height), pos: cs.position, op: cs.opacity, bg, z: cs.zIndex });
      });
      return out.slice(0, 30);
    });
    fs.writeFileSync(`${OUT}/${name}.info.json`, JSON.stringify({ ov, errs, probe }, null, 1));
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  });
}
