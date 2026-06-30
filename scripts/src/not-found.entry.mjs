(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (document.documentElement.getAttribute('data-dx-profile-fallback') === 'true') return;

  const DEFAULT_API_BASE = 'https://dex-api.spring-fog-8edd.workers.dev';
  const SECRET_BADGE_ID = 'vault-easter-egg';
  const PENDING_SECRET_KEY = 'dx:achievement:pending:v1';
  const ACHIEVEMENTS_HREF = `/entry/achievements/?badge=${encodeURIComponent(SECRET_BADGE_ID)}`;
  const ROUTES = [
    { path: '/', label: 'Home', keys: ['home'] },
    { path: '/catalog/', label: 'Catalog', keys: ['catalog', 'samples', 'library'] },
    { path: '/dexnotes/', label: 'Dex Notes', keys: ['dexnotes', 'notes', 'journal'] },
    { path: '/call/', label: 'IN DEX', keys: ['call', 'index', 'in-dex'] },
    { path: '/about/', label: 'About', keys: ['about'] },
    { path: '/programs/', label: 'Programs', keys: ['programs', 'program'] },
    { path: '/polls/', label: 'Polls', keys: ['polls', 'poll'] },
    { path: '/donate/', label: 'Donate', keys: ['donate', 'support-dex'] },
    { path: '/support/', label: 'Support', keys: ['support', 'help'] },
    { path: '/contact/', label: 'Contact', keys: ['contact'] },
    { path: '/privacy/', label: 'Privacy', keys: ['privacy'] },
  ];
  const root = document.getElementById('dex-not-found');
  if (!(root instanceof HTMLElement)) return;

  const pathNormalized = normalizePath(window.location.pathname);
  const is808 = pathNormalized === '/808';
  const displayedPath = `${window.location.pathname || '/'}${window.location.search || ''}${window.location.hash || ''}`;
  const pathNode = root.querySelector('[data-dx-not-found-path]');
  const feedback = root.querySelector('[data-dx-not-found-feedback]');

  if (pathNode) pathNode.textContent = displayedPath;
  document.title = 'Page not found — Dex';

  configureBackAction();
  renderSuggestion();
  if (is808) enable808Achievement();
  void unlockRegular404();
  void resumePendingSecretClaim();

  function normalizePath(value) {
    const text = String(value || '/').trim().toLowerCase();
    if (text === '/') return '/';
    return `/${text.replace(/^\/+|\/+$/g, '')}`;
  }

  function apiBase() {
    const configured = String(window.DEX_API_BASE_URL || window.DEX_API_ORIGIN || DEFAULT_API_BASE).trim();
    return (configured || DEFAULT_API_BASE).replace(/\/+$/g, '');
  }

  function requestId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function editDistance(leftValue, rightValue) {
    const left = String(leftValue || '');
    const right = String(rightValue || '');
    const rows = Array.from({ length: left.length + 1 }, (_, index) => index);
    for (let column = 1; column <= right.length; column += 1) {
      let diagonal = rows[0];
      rows[0] = column;
      for (let row = 1; row <= left.length; row += 1) {
        const previous = rows[row];
        const cost = left[row - 1] === right[column - 1] ? 0 : 1;
        rows[row] = Math.min(rows[row] + 1, rows[row - 1] + 1, diagonal + cost);
        diagonal = previous;
      }
    }
    return rows[left.length];
  }

  function routeLookupKey(pathname) {
    try {
      return decodeURIComponent(String(pathname || '/'))
        .toLowerCase()
        .replace(/^\/+|\/+$/g, '')
        .replace(/[^a-z0-9-]+/g, '');
    } catch {
      return '';
    }
  }

  function closestRoute(pathname) {
    const lookup = routeLookupKey(pathname);
    if (!lookup || lookup === '808') return null;
    const candidates = [];
    for (const route of ROUTES) {
      const keys = new Set([routeLookupKey(route.path), ...(route.keys || []).map(routeLookupKey)]);
      for (const key of keys) {
        if (!key || key === lookup) continue;
        candidates.push({ route, distance: editDistance(lookup, key), keyLength: key.length });
      }
    }
    candidates.sort((a, b) => a.distance - b.distance || a.keyLength - b.keyLength);
    const best = candidates[0];
    if (!best) return null;
    const maxDistance = lookup.length <= 4 ? 1 : lookup.length <= 8 ? 2 : 3;
    if (best.distance > maxDistance || best.distance / Math.max(lookup.length, best.keyLength) > 0.34) return null;
    return best.route;
  }

  function renderSuggestion() {
    const suggestion = root.querySelector('[data-dx-not-found-suggestion]');
    const link = root.querySelector('[data-dx-not-found-suggestion-link]');
    if (!(suggestion instanceof HTMLElement) || !(link instanceof HTMLAnchorElement)) return;
    const match = closestRoute(window.location.pathname);
    if (!match) return;
    link.href = match.path;
    link.textContent = `${match.label} (${match.path})`;
    suggestion.hidden = false;
  }

  function configureBackAction() {
    const button = root.querySelector('[data-dx-not-found-back]');
    if (!(button instanceof HTMLButtonElement)) return;
    let canGoBack = false;
    try {
      canGoBack = window.history.length > 1
        && Boolean(document.referrer)
        && new URL(document.referrer).origin === window.location.origin;
    } catch {
      canGoBack = false;
    }
    button.hidden = !canGoBack;
    if (!canGoBack) return;
    button.addEventListener('click', () => window.history.back());
  }

  function enable808Achievement() {
    const achievementButton = root.querySelector('[data-dx-808-achievements]');
    if (achievementButton instanceof HTMLButtonElement) {
      achievementButton.hidden = false;
      achievementButton.addEventListener('click', () => void handleSecretClaim(achievementButton));
    }
  }

  async function authSnapshot() {
    const auth = window.DEX_AUTH || window.dexAuth;
    if (!auth) return { auth: null, authenticated: false, token: '' };
    try {
      if (auth.ready && typeof auth.ready.then === 'function') await auth.ready;
      const authenticated = typeof auth.isAuthenticated === 'function' ? await auth.isAuthenticated() : false;
      if (!authenticated) return { auth, authenticated: false, token: '' };
      const token = typeof auth.getAccessToken === 'function' ? await auth.getAccessToken() : '';
      return { auth, authenticated: true, token: String(token || '') };
    } catch {
      return { auth, authenticated: false, token: '' };
    }
  }

  async function postAchievement(path, token, body, prefix) {
    const idempotencyKey = requestId(prefix);
    const response = await fetch(`${apiBase()}${path}`, {
      method: 'POST',
      credentials: 'omit',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'x-dx-idempotency-key': idempotencyKey,
        'x-dx-request-id': requestId(prefix),
      },
      body: JSON.stringify({ ...body, clientRequestId: idempotencyKey }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok !== true) {
      throw new Error(String(payload?.code || `HTTP_${response.status}`));
    }
    return payload;
  }

  async function unlockRegular404() {
    const snapshot = await authSnapshot();
    if (!snapshot.authenticated || !snapshot.token) return;
    try {
      await postAchievement(
        '/me/achievements/route-visit',
        snapshot.token,
        { kind: 'not-found' },
        'route-visit',
      );
    } catch {
      // A 404 remains a recovery page; achievement failures stay non-blocking.
    }
  }

  function savePendingSecretClaim() {
    try {
      window.sessionStorage.setItem(PENDING_SECRET_KEY, JSON.stringify({
        badgeId: SECRET_BADGE_ID,
        returnTo: '/808/',
        createdAt: Date.now(),
      }));
    } catch {}
  }

  function takePendingSecretClaim() {
    try {
      const raw = window.sessionStorage.getItem(PENDING_SECRET_KEY);
      if (!raw) return false;
      window.sessionStorage.removeItem(PENDING_SECRET_KEY);
      const parsed = JSON.parse(raw);
      return parsed?.badgeId === SECRET_BADGE_ID
        && parsed?.returnTo === '/808/'
        && Date.now() - Number(parsed?.createdAt || 0) < 30 * 60 * 1000;
    } catch {
      return false;
    }
  }

  async function claimSecret(token) {
    const payload = await postAchievement(
      '/me/achievements/secret-claim',
      token,
      { claim: SECRET_BADGE_ID, badgeId: SECRET_BADGE_ID },
      'secret-claim',
    );
    if (payload.state !== 'unlocked' && payload.state !== 'already_unlocked') {
      throw new Error(String(payload.state || 'invalid_claim'));
    }
  }

  async function handleSecretClaim(button) {
    if (!is808 || button.disabled) return;
    button.disabled = true;
    button.textContent = 'Opening…';
    if (feedback) feedback.textContent = '';

    const snapshot = await authSnapshot();
    if (!snapshot.authenticated || !snapshot.token) {
      savePendingSecretClaim();
      if (snapshot.auth && typeof snapshot.auth.signIn === 'function') {
        await snapshot.auth.signIn('/808/');
        return;
      }
      button.disabled = false;
      button.textContent = 'Achievements';
      if (feedback) feedback.textContent = 'Sign in to unlock this achievement.';
      return;
    }

    try {
      await claimSecret(snapshot.token);
      window.location.assign(ACHIEVEMENTS_HREF);
    } catch {
      button.disabled = false;
      button.textContent = 'Achievements';
      if (feedback) feedback.textContent = 'Couldn’t unlock the achievement. Try again.';
    }
  }

  async function resumePendingSecretClaim() {
    if (!is808) return;
    const pending = takePendingSecretClaim();
    if (!pending) return;
    const button = root.querySelector('[data-dx-808-achievements]');
    if (!(button instanceof HTMLButtonElement)) return;
    const snapshot = await authSnapshot();
    if (!snapshot.authenticated || !snapshot.token) return;
    button.disabled = true;
    button.textContent = 'Opening…';
    try {
      await claimSecret(snapshot.token);
      window.location.assign(ACHIEVEMENTS_HREF);
    } catch {
      button.disabled = false;
      button.textContent = 'Achievements';
      if (feedback) feedback.textContent = 'Couldn’t unlock the achievement. Try again.';
    }
  }
})();
