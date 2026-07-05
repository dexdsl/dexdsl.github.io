(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__dxAchievementsRuntimeLoaded && typeof window.__dxAchievementsMount === 'function') {
    try {
      window.__dxAchievementsMount();
    } catch {}
    return;
  }
  window.__dxAchievementsRuntimeLoaded = true;

  const FETCH_STATE_LOADING = 'loading';
  const FETCH_STATE_READY = 'ready';
  const FETCH_STATE_ERROR = 'error';
  const STATE_LOADING = 'loading';
  const STATE_READY = 'ready';
  const STATE_ERROR = 'error';
  const STATE_EMPTY = 'empty';
  const STATE_SIGNED_OUT = 'signed-out';
  const PAGE_OVERVIEW = 'overview';
  const PAGE_SECRET = 'secret-vault';
  const PAGE_HISTORY = 'history';
  const DX_MIN_SHEEN_MS = 120;
  const AUTH_READY_TIMEOUT_MS = 2600;
  const TOKEN_TIMEOUT_MS = 2600;
  const API_TIMEOUT_MS = 9000;
  const HISTORY_PAGE_SIZE = 40;
  const DEFAULT_BADGES_PER_PAGE = 8;
  const FOCUS_BADGE_PARAM = 'badge';

  const DEFAULT_API_BASE = 'https://dex-api.spring-fog-8edd.workers.dev';

  const HEROICON_BASE_PATH = '/assets/vendor/heroicons/24/outline/';
  const HEROICON_FILES = {
    submission: 'document-arrow-up.svg',
    'submission-stack': 'rectangle-stack.svg',
    release: 'arrow-down-tray.svg',
    license: 'check-circle.svg',
    joint: 'share.svg',
    poll: 'list-bullet.svg',
    streak: 'star.svg',
    call: 'eye.svg',
    lane: 'bars-3.svg',
    favorite: 'heart.svg',
    profile: 'user-circle.svg',
    explorer: 'eye.svg',
    rhythm: 'list-bullet.svg',
    secret: 'lock-closed.svg',
    'secret-license': 'shield-check.svg',
    'secret-release': 'archive-box-arrow-down.svg',
    vault: 'key.svg',
    archive: 'archive-box-arrow-down.svg',
  };
  const CATEGORY_SHADER_COLORS = {
    submissions: [1.0, 0.25, 0.08],
    releases: [0.12, 0.68, 1.0],
    license: [0.28, 0.96, 0.68],
    polls: [0.67, 0.33, 1.0],
    calls: [1.0, 0.28, 0.58],
    favorites: [1.0, 0.16, 0.28],
    profile: [0.2, 0.72, 1.0],
    secret: [0.64, 0.7, 0.94],
    house: [1.0, 0.78, 0.24],
    general: [1.0, 0.35, 0.12],
  };
  const TIER_SHADER_COLORS = {
    bronze: [0.78, 0.36, 0.15],
    silver: [0.72, 0.8, 0.92],
    gold: [1.0, 0.66, 0.1],
    legend: [0.68, 0.36, 1.0],
  };
  const INSPECT_DEFAULT_ROTATION = Object.freeze({ x: -5, y: -8 });

  function toText(value, fallback = '') {
    const text = String(value ?? '').trim();
    return text || fallback;
  }

  function clamp(min, max, value) {
    return Math.min(max, Math.max(min, value));
  }

  function nowMs() {
    return Date.now();
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
  }

  function withTimeout(promiseLike, timeoutMs, fallback = null) {
    let timer = null;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve(fallback), Math.max(1, timeoutMs));
    });
    return Promise.race([
      Promise.resolve(typeof promiseLike === 'function' ? promiseLike() : promiseLike).catch(() => fallback),
      timeout,
    ]).finally(() => {
      if (timer !== null) {
        clearTimeout(timer);
      }
    });
  }

  function createRequestId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    const seed = Math.floor(Math.random() * 1e9).toString(16);
    return `dx-achv-${seed}-${Date.now()}`;
  }

  function getApiBase() {
    const raw = toText(window.DEX_API_BASE_URL || window.DEX_API_ORIGIN || DEFAULT_API_BASE, DEFAULT_API_BASE);
    return raw.replace(/\/+$/, '');
  }

  function setFetchState(root, state) {
    if (!(root instanceof HTMLElement)) return;
    root.setAttribute('data-dx-fetch-state', state);
    if (state === FETCH_STATE_LOADING) {
      root.setAttribute('aria-busy', 'true');
    } else {
      root.setAttribute('aria-busy', 'false');
    }
  }

  function setAppState(root, app, state, page) {
    if (root instanceof HTMLElement) {
      root.setAttribute('data-dx-achievements-state', state);
      root.setAttribute('data-dx-achievements-page', page);
    }
    if (app instanceof HTMLElement) {
      app.setAttribute('data-dx-achievements-state', state);
      app.setAttribute('data-dx-achievements-page', page);
    }
  }

  function getAuthApi() {
    return window.DEX_AUTH || window.dexAuth || null;
  }

  async function resolveAuthSnapshot() {
    const auth = getAuthApi();
    if (!auth) {
      return {
        auth: null,
        authenticated: false,
        token: '',
        user: null,
      };
    }

    try {
      if (typeof auth.resolve === 'function') {
        await withTimeout(() => auth.resolve(AUTH_READY_TIMEOUT_MS), AUTH_READY_TIMEOUT_MS, null);
      } else if (auth.ready && typeof auth.ready.then === 'function') {
        await withTimeout(auth.ready, AUTH_READY_TIMEOUT_MS, null);
      }
    } catch {}

    let authenticated = false;
    try {
      if (typeof auth.isAuthenticated === 'function') {
        authenticated = Boolean(await withTimeout(() => auth.isAuthenticated(), AUTH_READY_TIMEOUT_MS, false));
      }
    } catch {
      authenticated = false;
    }

    let token = '';
    if (authenticated && typeof auth.getAccessToken === 'function') {
      token = toText(await withTimeout(() => auth.getAccessToken(), TOKEN_TIMEOUT_MS, ''), '');
    }

    let user = null;
    try {
      if (typeof auth.getUser === 'function') {
        user = await withTimeout(() => auth.getUser(), AUTH_READY_TIMEOUT_MS, null);
      }
    } catch {
      user = null;
    }

    return {
      auth,
      authenticated,
      token,
      user,
    };
  }

  async function fetchJson(path, {
    method = 'GET',
    token = '',
    body = null,
    timeoutMs = API_TIMEOUT_MS,
    headers = {},
  } = {}) {
    const url = `${getApiBase()}${path}`;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutId = setTimeout(() => {
      if (controller) controller.abort();
    }, Math.max(1000, timeoutMs));

    try {
      const response = await fetch(url, {
        method,
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body ? { 'content-type': 'application/json' } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller ? controller.signal : undefined,
      });
      const payload = await response.json().catch(() => null);
      return { ok: response.ok, status: response.status, payload };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        payload: {
          ok: false,
          code: 'NETWORK_ERROR',
          detail: error instanceof Error ? error.message : String(error),
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function htmlEscape(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function badgeGlyphSvg(glyphKey, { silhouette = false } = {}) {
    const key = toText(glyphKey, 'secret').toLowerCase();
    const fileName = HEROICON_FILES[key] || HEROICON_FILES.secret;
    const src = `${HEROICON_BASE_PATH}${fileName}`;
    const className = silhouette ? 'dx-achievement-glyph-svg is-silhouette' : 'dx-achievement-glyph-svg';
    return `<img src="${htmlEscape(src)}" class="${className}" alt="" loading="lazy" decoding="async" aria-hidden="true">`;
  }

  function progressStroke(value, threshold) {
    const pct = threshold > 0 ? clamp(0, 100, Math.round((value / threshold) * 100)) : 0;
    const radius = 18;
    const c = 2 * Math.PI * radius;
    const dash = Math.round((pct / 100) * c * 1000) / 1000;
    return { pct, c, dash };
  }

  function badgeDisplayTitle(badge) {
    return badge.secret && !badge.unlocked ? 'CLASSIFIED' : badge.title;
  }

  function badgeDisplayDescription(badge) {
    return badge.secret && !badge.unlocked
      ? `Clue: ${badge.clueGrowlix || '???'}`
      : badge.description;
  }

  function badgeStatusLabel(badge) {
    if (badge.secret && !badge.unlocked) return 'Signal encrypted';
    if (badge.unlocked) return badge.newly ? 'Newly unlocked' : 'Unlocked';
    return `Progress ${Math.min(badge.progress, badge.threshold)} / ${badge.threshold}`;
  }

  function badgePointsLabel(badge) {
    return badge.secret && !badge.unlocked ? 'Points hidden' : `${badge.points} pts`;
  }

  function badgeCategoryLabel(badge) {
    return badge.secret && !badge.unlocked ? 'Secret vault' : badge.category;
  }

  function badgeUnlockDateLabel(badge) {
    if (!badge.unlockedAt) return badge.unlocked ? 'Recorded in the Dex archive' : 'Not yet unlocked';
    const parsed = new Date(badge.unlockedAt);
    if (Number.isNaN(parsed.getTime())) return 'Recorded in the Dex archive';
    return `Unlocked ${parsed.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })}`;
  }

  function normalizeBadge(raw, state) {
    const item = raw && typeof raw === 'object' ? raw : {};
    const id = toText(item.id).toLowerCase();
    const secret = Boolean(item.secret);
    const threshold = Math.max(1, Number(item.threshold) || 1);
    const progress = Math.max(0, Number(item.progress ?? item.metricValue ?? 0) || 0);
    const unlocked = Boolean(item.unlocked) || progress >= threshold;
    const newly = state.newlyUnlockedSet.has(id) || Boolean(item.newlyUnlocked);
    const visibility = toText(item.visibility, 'default').toLowerCase();
    let cardState = 'locked';
    if (unlocked && newly) cardState = 'new';
    else if (unlocked) cardState = 'unlocked';
    else if (progress > 0) cardState = 'progress';

    return {
      id,
      title: toText(item.title, 'Untitled Achievement'),
      description: toText(item.description, ''),
      category: toText(item.category, 'general'),
      tier: toText(item.tier, 'bronze'),
      glyph: toText(item.glyph, 'secret'),
      points: Math.max(0, Number(item.points) || 0),
      threshold,
      progress,
      unlocked,
      newly,
      cardState,
      secret,
      visibility,
      unlockedAt: toText(item.unlockedAt || item.unlocked_at || item.earnedAt || item.earned_at, ''),
      clueGrowlix: toText(item.clueGrowlix, '???'),
      claimable: visibility === 'hidden-until-unlocked' ? false : Boolean(item.claimable),
    };
  }

  function renderBadgeCard(badge) {
    const ring = progressStroke(badge.progress, badge.threshold);
    const title = badgeDisplayTitle(badge);
    const description = badgeDisplayDescription(badge);

    const claimButton = badge.secret && !badge.unlocked && badge.claimable
      ? `<button type="button" class="dx-button-element dx-button-element--secondary dx-button-size--sm dx-achievement-claim" data-dx-achievement-claim="${htmlEscape(badge.id)}" data-dx-motion-include="true">Claim</button>`
      : '';

    return `
      <article
        class="badge-card dx-achievement-card dx-achievement-card--${htmlEscape(badge.cardState)}"
        data-dx-achievement-id="${htmlEscape(badge.id)}"
        data-dx-achievement-state="${htmlEscape(badge.cardState)}"
        data-dx-achievement-secret="${badge.secret ? 'true' : 'false'}"
        data-dx-achievement-category="${htmlEscape(badge.category)}"
        data-dx-achievement-tier="${htmlEscape(badge.tier)}"
        data-dx-achievement-open="${htmlEscape(badge.id)}"
        style="--dx-achievement-progress: ${ring.pct}%;"
        data-dx-motion-include="true"
      >
        <button
          type="button"
          class="dx-achievement-open-target"
          data-dx-achievement-open="${htmlEscape(badge.id)}"
          aria-haspopup="dialog"
          aria-label="Inspect achievement: ${htmlEscape(title)}"
        ></button>
        <span class="dx-achievement-material" aria-hidden="true"></span>
        <div class="dx-achievement-card-top">
          <span class="dx-achievement-category">${htmlEscape(badgeCategoryLabel(badge))}</span>
          <span class="dx-achievement-tier">${htmlEscape(badge.tier.toUpperCase())}</span>
          ${badge.newly ? '<span class="dx-achievement-new">NEW</span>' : ''}
        </div>
        <div class="dx-achievement-crest" aria-hidden="true">
          <span class="dx-achievement-crest-rim"></span>
          <div class="dx-achievement-glyph-wrap">
            ${badgeGlyphSvg(badge.glyph, { silhouette: badge.secret && !badge.unlocked })}
          </div>
        </div>
        <div class="dx-achievement-copy">
          <h3 class="dx-achievement-title">${htmlEscape(title)}</h3>
          <p class="dx-achievement-desc">${htmlEscape(description)}</p>
        </div>
        <div class="dx-achievement-progress" aria-hidden="true">
          <span></span>
        </div>
        <div class="dx-achievement-meta">
          <span>${htmlEscape(badgeStatusLabel(badge))}</span>
          <span>${htmlEscape(badgePointsLabel(badge))}</span>
        </div>
        ${claimButton}
      </article>
    `;
  }

  function renderInspectPlate(badge) {
    const ring = progressStroke(badge.progress, badge.threshold);
    const title = badgeDisplayTitle(badge);
    const description = badgeDisplayDescription(badge);
    const isClassified = badge.secret && !badge.unlocked;
    const progressRecord = isClassified
      ? 'Unlock criteria remain classified.'
      : badge.unlocked
        ? 'Achievement complete.'
        : `${Math.min(badge.progress, badge.threshold)} of ${badge.threshold} recorded.`;
    const depthLayers = Array.from(
      { length: 13 },
      (_, index) => `<i style="--dx-achievement-depth-z:${-9 + (index * 1.5)}px"></i>`,
    ).join('');

    return `
      <div
        class="dx-achievement-inspect-object${badge.newly ? ' is-cinematic' : ''}"
        data-dx-achievement-inspect-object
        data-dx-achievement-state="${htmlEscape(badge.cardState)}"
        data-dx-achievement-category="${htmlEscape(badge.category)}"
        data-dx-achievement-tier="${htmlEscape(badge.tier)}"
        style="--dx-achievement-progress: ${ring.pct}%;"
        role="group"
        aria-label="3D achievement object: ${htmlEscape(title)}"
        tabindex="0"
      >
        <div class="dx-achievement-inspect-plate" data-dx-achievement-inspect-plate>
          <span class="dx-achievement-inspect-depth" aria-hidden="true">
            ${depthLayers}
            <b class="dx-achievement-inspect-edge dx-achievement-inspect-edge--top"></b>
            <b class="dx-achievement-inspect-edge dx-achievement-inspect-edge--right"></b>
            <b class="dx-achievement-inspect-edge dx-achievement-inspect-edge--bottom"></b>
            <b class="dx-achievement-inspect-edge dx-achievement-inspect-edge--left"></b>
          </span>
          <section class="dx-achievement-inspect-face dx-achievement-inspect-front">
            <canvas class="dx-achievement-inspect-shader" data-dx-achievement-inspect-shader aria-hidden="true"></canvas>
            <span class="dx-achievement-inspect-foil" aria-hidden="true"></span>
            <header class="dx-achievement-inspect-head">
              <span>${htmlEscape(badgeCategoryLabel(badge))}</span>
              <span>${htmlEscape(badge.tier.toUpperCase())}</span>
            </header>
            <div class="dx-achievement-inspect-crest" aria-hidden="true">
              <span class="dx-achievement-inspect-crest-rim"></span>
              <span class="dx-achievement-inspect-glyph">
                ${badgeGlyphSvg(badge.glyph, { silhouette: isClassified })}
              </span>
            </div>
            <div class="dx-achievement-inspect-copy">
              <p class="dx-achievement-inspect-kicker">${htmlEscape(badgeStatusLabel(badge))}</p>
              <h2 id="dx-achievement-inspect-title">${htmlEscape(title)}</h2>
              <p>${htmlEscape(description)}</p>
            </div>
            <div class="dx-achievement-inspect-meter" aria-hidden="true"><span></span></div>
            <footer class="dx-achievement-inspect-foot">
              <span>${htmlEscape(badgePointsLabel(badge))}</span>
              <span>${htmlEscape(badgeUnlockDateLabel(badge))}</span>
            </footer>
          </section>
          <section class="dx-achievement-inspect-face dx-achievement-inspect-back" aria-label="Achievement record">
            <div class="dx-achievement-inspect-back-seal" aria-hidden="true">DX</div>
            <p class="dx-achievement-inspect-kicker">Archive record</p>
            <h3>${htmlEscape(title)}</h3>
            <dl>
              <div><dt>Category</dt><dd>${htmlEscape(badgeCategoryLabel(badge))}</dd></div>
              <div><dt>Tier</dt><dd>${htmlEscape(badge.tier)}</dd></div>
              <div><dt>Status</dt><dd>${htmlEscape(badgeStatusLabel(badge))}</dd></div>
              <div><dt>Record</dt><dd>${htmlEscape(progressRecord)}</dd></div>
            </dl>
            <p class="dx-achievement-inspect-back-id">${isClassified ? 'DEX-ACHV-CLASSIFIED' : htmlEscape(badge.id)}</p>
          </section>
        </div>
      </div>
    `;
  }

  function createInspectorShader(canvas, badge) {
    if (!(canvas instanceof HTMLCanvasElement)) return null;
    const fallback = () => {
      canvas.setAttribute('data-dx-shader-state', 'fallback');
      return null;
    };

    let gl = null;
    try {
      gl = canvas.getContext('webgl', {
        alpha: true,
        antialias: false,
        depth: false,
        premultipliedAlpha: true,
        powerPreference: 'low-power',
      });
    } catch {
      return fallback();
    }
    if (!gl) return fallback();

    const vertexSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;
    const fragmentSource = `
      precision highp float;
      varying vec2 v_uv;
      uniform float u_time;
      uniform vec2 u_pointer;
      uniform vec3 u_category;
      uniform vec3 u_tier;
      uniform float u_unlocked;
      uniform float u_secret;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      void main() {
        vec2 uv = v_uv;
        vec2 pointer = clamp(u_pointer, 0.0, 1.0);
        float time = u_time * 0.12;
        float grain = noise(uv * vec2(22.0, 15.0) + time);
        float micro = noise(uv * vec2(96.0, 64.0));
        float diagonal = uv.x * 0.92 + uv.y * 0.42;
        float travel = fract(diagonal + time * 0.11 + pointer.x * 0.24);
        float foil = pow(max(0.0, 1.0 - abs(travel - 0.5) * 2.0), 5.0);
        float bands = 0.5 + 0.5 * sin((diagonal * 12.0 + grain * 1.8 + time) * 6.28318);
        float spot = exp(-10.0 * distance(uv, pointer));
        float edge = smoothstep(0.64, 0.98, distance(uv, vec2(0.5)) * 1.42);

        vec3 rainbow = vec3(
          0.5 + 0.5 * sin(6.28318 * (bands + 0.00)),
          0.5 + 0.5 * sin(6.28318 * (bands + 0.33)),
          0.5 + 0.5 * sin(6.28318 * (bands + 0.67))
        );
        vec3 metal = mix(u_tier, u_category, 0.28 + grain * 0.3);
        vec3 color = mix(metal, rainbow, foil * (0.42 + u_unlocked * 0.42));
        color += u_category * spot * 0.56;
        color += vec3(0.7, 0.78, 0.92) * edge * 0.2;
        color += (micro - 0.5) * 0.065;

        float alpha = 0.035 + foil * 0.2 + spot * 0.18 + edge * 0.08;
        alpha *= mix(0.72, 1.0, u_unlocked);
        alpha *= mix(1.0, 0.72, u_secret);
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.5));
      }
    `;

    function compile(type, source) {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return fallback();

    const program = gl.createProgram();
    if (!program) return fallback();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return fallback();
    }

    const buffer = gl.createBuffer();
    if (!buffer) {
      gl.deleteProgram(program);
      return fallback();
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1,
    ]), gl.STATIC_DRAW);
    gl.useProgram(program);

    const position = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      time: gl.getUniformLocation(program, 'u_time'),
      pointer: gl.getUniformLocation(program, 'u_pointer'),
      category: gl.getUniformLocation(program, 'u_category'),
      tier: gl.getUniformLocation(program, 'u_tier'),
      unlocked: gl.getUniformLocation(program, 'u_unlocked'),
      secret: gl.getUniformLocation(program, 'u_secret'),
    };
    const categoryColor = CATEGORY_SHADER_COLORS[badge.category] || CATEGORY_SHADER_COLORS.general;
    const tierColor = TIER_SHADER_COLORS[badge.tier] || TIER_SHADER_COLORS.silver;
    gl.uniform3fv(uniforms.category, categoryColor);
    gl.uniform3fv(uniforms.tier, tierColor);
    gl.uniform1f(uniforms.unlocked, badge.unlocked ? 1 : 0);
    gl.uniform1f(uniforms.secret, badge.secret && !badge.unlocked ? 1 : 0);

    let pointer = [0.5, 0.42];
    let frame = 0;
    let running = true;
    let observer = null;
    const reduced = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      const width = Math.max(1, Math.round(rect.width * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
    }

    function draw(now) {
      if (!running) return;
      resize();
      gl.useProgram(program);
      gl.uniform1f(uniforms.time, Math.max(0, Number(now) || 0) / 1000);
      gl.uniform2fv(uniforms.pointer, pointer);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!reduced && !document.hidden) frame = window.requestAnimationFrame(draw);
    }

    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(resize);
      observer.observe(canvas);
    }
    canvas.setAttribute('data-dx-shader-state', 'ready');
    frame = window.requestAnimationFrame(draw);

    return {
      setPointer(x, y) {
        pointer = [clamp(0, 1, Number(x) || 0), clamp(0, 1, Number(y) || 0)];
        if (reduced) draw(0);
      },
      dispose() {
        running = false;
        if (frame) window.cancelAnimationFrame(frame);
        if (observer) observer.disconnect();
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
      },
    };
  }

  function updateInspectorTransform(state) {
    const object = state.root.querySelector('[data-dx-achievement-inspect-object]');
    if (!(object instanceof HTMLElement)) return;
    object.style.setProperty('--dx-inspect-rotate-x', `${state.inspector.rotationX}deg`);
    object.style.setProperty('--dx-inspect-rotate-y', `${state.inspector.rotationY}deg`);
  }

  function resetInspectorRotation(state) {
    state.inspector.rotationX = INSPECT_DEFAULT_ROTATION.x;
    state.inspector.rotationY = INSPECT_DEFAULT_ROTATION.y;
    updateInspectorTransform(state);
  }

  function closeBadgeInspector(state) {
    const dialog = state.root.querySelector('[data-dx-achievement-inspector]');
    if (!(dialog instanceof HTMLDialogElement)) return;
    if (dialog.open) dialog.close();
  }

  function openBadgeInspector(state, badgeId, opener = null) {
    const badge = state.badges.find((item) => item.id === badgeId);
    const dialog = state.root.querySelector('[data-dx-achievement-inspector]');
    const viewport = state.root.querySelector('[data-dx-achievement-inspect-viewport]');
    if (!badge || !(dialog instanceof HTMLDialogElement) || !(viewport instanceof HTMLElement)) return;

    if (state.inspector.shader) {
      state.inspector.shader.dispose();
      state.inspector.shader = null;
    }
    state.inspector.badgeId = badge.id;
    state.inspector.opener = opener instanceof HTMLElement ? opener : null;
    viewport.innerHTML = renderInspectPlate(badge);
    dialog.setAttribute('aria-label', `Inspect achievement: ${badgeDisplayTitle(badge)}`);
    dialog.setAttribute('data-dx-achievement-state', badge.cardState);
    dialog.setAttribute('data-dx-achievement-category', badge.category);
    dialog.setAttribute('data-dx-achievement-tier', badge.tier);
    resetInspectorRotation(state);

    try {
      if (!dialog.open) dialog.showModal();
    } catch {
      dialog.setAttribute('open', '');
    }

    window.requestAnimationFrame(() => {
      dialog.classList.add('is-visible');
      const object = viewport.querySelector('[data-dx-achievement-inspect-object]');
      const canvas = viewport.querySelector('[data-dx-achievement-inspect-shader]');
      if (canvas instanceof HTMLCanvasElement) {
        state.inspector.shader = createInspectorShader(canvas, badge);
      }
      if (object instanceof HTMLElement) object.focus({ preventScroll: true });
    });
  }

  function responsiveBadgePageSize(state) {
    const rect = state.root.getBoundingClientRect();
    const width = Math.max(0, rect.width || window.innerWidth || 0);
    const height = Math.max(0, rect.height || window.innerHeight || 0);
    if (width <= 640) return 3;
    if (width <= 900) return 6;
    if (height > 0 && height < 520) return 4;
    return DEFAULT_BADGES_PER_PAGE;
  }

  function getPaginatedBadgeRows(state, page, cards) {
    const pageSize = responsiveBadgePageSize(state);
    state.badgePageSize = pageSize;
    const totalPages = Math.max(1, Math.ceil(cards.length / pageSize));
    const current = clamp(0, totalPages - 1, Number(state.badgePages[page]) || 0);
    state.badgePages[page] = current;
    const start = current * pageSize;
    return {
      pageSize,
      totalPages,
      current,
      visible: cards.slice(start, start + pageSize),
    };
  }

  function renderBadgeSideControls(page, totalPages, current) {
    if (totalPages <= 1) return '';
    const prevDisabled = current <= 0 ? ' disabled aria-disabled="true"' : '';
    const nextDisabled = current >= totalPages - 1 ? ' disabled aria-disabled="true"' : '';
    return `
      <span class="dx-achievements-carousel-edge dx-achievements-carousel-edge--left">
        <button type="button" class="carousel-nav prev dx-pagenav-arrow dx-pagenav-arrow--prev dx-pagenav-arrow--on-dark" data-dx-achievements-badge-page-prev="${htmlEscape(page)}" aria-label="Previous achievements page"${prevDisabled}></button>
      </span>
      <span class="dx-achievements-carousel-edge dx-achievements-carousel-edge--right">
        <button type="button" class="carousel-nav next dx-pagenav-arrow dx-pagenav-arrow--next dx-pagenav-arrow--on-dark" data-dx-achievements-badge-page-next="${htmlEscape(page)}" aria-label="Next achievements page"${nextDisabled}></button>
      </span>
    `;
  }

  function renderBadgeGridPage(state, page, cards) {
    const rows = getPaginatedBadgeRows(state, page, cards);
    return `
      <div class="dx-achievements-carousel-frame" data-dx-achievements-pager="${htmlEscape(page)}" data-dx-achievements-pager-index="${rows.current}" data-dx-achievements-pager-total="${rows.totalPages}" data-dx-achievements-page-size="${rows.pageSize}">
        ${renderBadgeSideControls(page, rows.totalPages, rows.current)}
        <div class="dx-achievements-grid" data-dx-achievements-grid-page="${htmlEscape(page)}">${rows.visible.map(renderBadgeCard).join('')}</div>
      </div>
    `;
  }

  function renderHistoryEvent(event) {
    const item = event && typeof event === 'object' ? event : {};
    const title = toText(item.title || item.badgeTitle || item.badgeId || 'Achievement event');
    const at = toText(item.createdAt || item.eventAt || '');
    const when = at ? new Date(at).toLocaleString() : 'Unknown time';
    const detail = toText(item.detail || item.body || item.eventType || '');
    return `
      <article class="dx-achievement-history-item" data-dx-motion-include="true">
        <div class="dx-achievement-history-head">
          <h4>${htmlEscape(title)}</h4>
          <span>${htmlEscape(when)}</span>
        </div>
        <p>${htmlEscape(detail)}</p>
      </article>
    `;
  }

  function showToast(state, message, { error = false } = {}) {
    const stack = state.root.querySelector('[data-dx-achievements-toasts]');
    if (!(stack instanceof HTMLElement)) return;
    const toast = document.createElement('p');
    toast.className = `dx-achievements-toast${error ? ' dx-achievements-toast--error' : ''}`;
    toast.textContent = message;
    stack.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3400);
  }

  function dispatchEvent(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    } catch {}
  }

  function readFocusBadgeFromUrl() {
    try {
      const url = new URL(window.location.href);
      return toText(url.searchParams.get(FOCUS_BADGE_PARAM), '').toLowerCase();
    } catch {
      return '';
    }
  }

  function focusBadgeCard(state, badgeId) {
    if (!badgeId) return;
    const selector = `[data-dx-achievement-id="${CSS.escape(badgeId)}"]`;
    const card = state.root.querySelector(selector);
    if (!(card instanceof HTMLElement)) return;
    try {
      card.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch {
      card.scrollIntoView();
    }
    card.classList.add('dx-achievement-card--focus');
    setTimeout(() => card.classList.remove('dx-achievement-card--focus'), 1800);
  }

  function renderSignedOut(state) {
    const body = state.root.querySelector('[data-dx-achievements-body]');
    if (!(body instanceof HTMLElement)) return;
    body.innerHTML = `
      <article class="dx-achievements-empty" data-dx-motion-include="true">
        <h3>SIGN IN REQUIRED</h3>
        <p>Please sign in to view achievements and unlock history.</p>
        <button type="button" class="dx-button-element dx-button-element--secondary dx-button-size--sm" data-dx-achievements-signin="true" data-dx-motion-include="true">Sign in</button>
      </article>
    `;
    const signInButton = body.querySelector('[data-dx-achievements-signin="true"]');
    if (signInButton instanceof HTMLButtonElement) {
      signInButton.addEventListener('click', async () => {
        const auth = state.authSnapshot.auth;
        if (auth && typeof auth.signIn === 'function') {
          try {
            await auth.signIn({ returnTo: `${window.location.pathname}${window.location.search}${window.location.hash}` });
            return;
          } catch {}
        }
        window.location.assign('/');
      });
    }
  }

  function updateHeaderSummary(state) {
    const totalsEl = state.root.querySelector('[data-dx-achievements-totals]');
    const metricsEl = state.root.querySelector('[data-dx-achievements-metrics]');
    const warningEl = state.root.querySelector('[data-dx-achievements-warning]');

    const summary = state.summary;
    if (!(totalsEl instanceof HTMLElement) || !(metricsEl instanceof HTMLElement) || !(warningEl instanceof HTMLElement)) return;
    if (!summary) {
      totalsEl.textContent = 'No summary available.';
      metricsEl.textContent = '';
      warningEl.hidden = true;
      warningEl.textContent = '';
      return;
    }

    const totals = summary.totals && typeof summary.totals === 'object' ? summary.totals : {};
    const unlocked = Math.max(0, Number(totals.unlocked) || 0);
    const total = Math.max(0, Number(totals.total || summary.badges.length) || summary.badges.length);
    const points = Math.max(0, Number(totals.points) || 0);
    totalsEl.textContent = `${unlocked} / ${total} unlocked · ${points} points`;

    const metrics = summary.metrics && typeof summary.metrics === 'object' ? summary.metrics : {};
    const submissions = Math.max(0, Number(metrics.submissionsTotal) || 0);
    const releases = Math.max(0, Number(metrics.releasesTotal) || 0);
    const votes = Math.max(0, Number(metrics.pollVotes) || 0);
    const favorites = Math.max(0, Number(metrics.favoritesCount) || 0);
    metricsEl.textContent = `Submissions ${submissions} · Releases ${releases} · Votes ${votes} · Favorites ${favorites}`;

    const warnings = Array.isArray(summary.warnings) ? summary.warnings.filter(Boolean) : [];
    if (warnings.length) {
      warningEl.hidden = false;
      warningEl.textContent = warnings.join(' · ');
    } else {
      warningEl.hidden = true;
      warningEl.textContent = '';
    }
  }

  function renderOverview(state) {
    const overview = state.root.querySelector('[data-dx-achievements-page-panel="overview"]');
    if (!(overview instanceof HTMLElement)) return;
    const cards = state.badges.filter((badge) => !badge.secret);
    if (!cards.length) {
      overview.innerHTML = '<p class="dx-achievements-empty-text">No public achievements found.</p>';
      return;
    }
    overview.innerHTML = renderBadgeGridPage(state, PAGE_OVERVIEW, cards);
  }

  function renderSecretVault(state) {
    const vault = state.root.querySelector('[data-dx-achievements-page-panel="secret-vault"]');
    if (!(vault instanceof HTMLElement)) return;
    const cards = state.badges.filter((badge) => badge.secret);
    if (!cards.length) {
      vault.innerHTML = '<p class="dx-achievements-empty-text">Secret vault is empty.</p>';
      return;
    }
    vault.innerHTML = renderBadgeGridPage(state, PAGE_SECRET, cards);
  }

  function renderHistory(state) {
    const historyRoot = state.root.querySelector('[data-dx-achievements-page-panel="history"]');
    if (!(historyRoot instanceof HTMLElement)) return;
    if (!state.historyLoaded && state.historyLoading) {
      historyRoot.innerHTML = '<p class="dx-achievements-empty-text">Loading history…</p>';
      return;
    }
    const items = Array.isArray(state.historyEvents) ? state.historyEvents : [];
    const rows = items.length
      ? items.map(renderHistoryEvent).join('')
      : '<p class="dx-achievements-empty-text">No unlock history yet.</p>';
    historyRoot.innerHTML = `
      <div class="dx-achievements-history">${rows}</div>
      <div class="dx-achievements-history-actions">
        ${state.historyNextCursor ? '<button type="button" class="dx-button-element dx-button-element--secondary dx-button-size--sm" data-dx-achievements-load-more="true" data-dx-motion-include="true">Load more</button>' : ''}
      </div>
    `;
  }

  function switchPage(state, page) {
    const next = page === PAGE_SECRET || page === PAGE_HISTORY ? page : PAGE_OVERVIEW;
    state.page = next;

    const app = state.root.querySelector('[data-dx-achievements-app="v2"]');
    setAppState(state.root, app, state.visualState, state.page);

    const buttons = state.root.querySelectorAll('[data-dx-achievements-page]');
    buttons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const isActive = toText(button.getAttribute('data-dx-achievements-page')) === state.page;
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      button.classList.toggle('is-active', isActive);
    });

    const panels = state.root.querySelectorAll('[data-dx-achievements-page-panel]');
    panels.forEach((panel) => {
      if (!(panel instanceof HTMLElement)) return;
      const active = toText(panel.getAttribute('data-dx-achievements-page-panel')) === state.page;
      panel.hidden = !active;
    });

    if (state.page === PAGE_HISTORY && !state.historyLoaded && !state.historyLoading && state.authSnapshot.authenticated) {
      void loadHistory(state, { append: false });
    }
  }

  async function loadSummary(state) {
    const token = toText(state.authSnapshot.token, '');
    const requestId = createRequestId();
    const response = await fetchJson('/me/achievements/summary', {
      method: 'GET',
      token,
      headers: {
        'x-dx-request-id': requestId,
      },
    });

    if (!response.ok || !response.payload || response.payload.ok !== true) {
      return {
        ok: false,
        status: response.status,
        payload: response.payload,
      };
    }

    return {
      ok: true,
      payload: response.payload,
    };
  }

  async function loadHistory(state, { append = false } = {}) {
    if (!state.authSnapshot.authenticated) return;
    if (state.historyLoading) return;

    state.historyLoading = true;
    renderHistory(state);

    const token = toText(state.authSnapshot.token, '');
    const cursorQuery = state.historyNextCursor ? `&cursor=${encodeURIComponent(state.historyNextCursor)}` : '';
    const response = await fetchJson(`/me/achievements/history?limit=${HISTORY_PAGE_SIZE}${cursorQuery}`, {
      method: 'GET',
      token,
      headers: {
        'x-dx-request-id': createRequestId(),
      },
    });

    if (response.ok && response.payload && response.payload.ok === true) {
      const events = Array.isArray(response.payload.events) ? response.payload.events : [];
      state.historyEvents = append ? state.historyEvents.concat(events) : events;
      state.historyNextCursor = toText(response.payload.nextCursor, '');
      state.historyLoaded = true;
    } else if (!append && !state.historyLoaded) {
      state.historyEvents = [];
      state.historyNextCursor = '';
      state.historyLoaded = true;
    }

    state.historyLoading = false;
    renderHistory(state);
  }

  async function markSeen(state, badgeIds = []) {
    if (!state.authSnapshot.authenticated) return;
    const token = toText(state.authSnapshot.token, '');
    const payload = {
      badgeIds: Array.isArray(badgeIds) ? badgeIds : [],
    };

    const response = await fetchJson('/me/achievements/seen', {
      method: 'POST',
      token,
      body: payload,
      headers: {
        'x-dx-request-id': createRequestId(),
      },
    });

    if (!response.ok || !response.payload || response.payload.ok !== true) {
      showToast(state, 'Unable to clear new badge markers.', { error: true });
      return;
    }

    showToast(state, 'New badge markers cleared.');
    const summaryResult = await loadSummary(state);
    if (summaryResult.ok) {
      applySummary(state, summaryResult.payload);
    }
  }

  async function claimSecret(state, badgeId) {
    if (!state.authSnapshot.authenticated) return;
    const token = toText(state.authSnapshot.token, '');
    const idempotencyKey = createRequestId();

    const response = await fetchJson('/me/achievements/secret-claim', {
      method: 'POST',
      token,
      body: {
        claim: badgeId,
        badgeId,
        clientRequestId: idempotencyKey,
      },
      headers: {
        'x-dx-request-id': createRequestId(),
        'x-dx-idempotency-key': idempotencyKey,
      },
    });

    if (!response.ok || !response.payload || response.payload.ok !== true) {
      showToast(state, 'Secret claim failed.', { error: true });
      return;
    }

    const claimState = toText(response.payload.state, '');
    if (claimState === 'already_unlocked') {
      showToast(state, 'Secret already unlocked.');
    } else if (claimState === 'unlocked') {
      showToast(state, 'Secret unlocked.');
    } else if (claimState === 'not_eligible') {
      showToast(state, 'Not eligible yet.', { error: true });
    } else {
      showToast(state, 'Invalid claim.', { error: true });
    }

    const summaryResult = await loadSummary(state);
    if (summaryResult.ok) {
      applySummary(state, summaryResult.payload);
    }
  }

  function applySummary(state, payload) {
    const summary = payload && typeof payload === 'object' ? payload : {};
    const badgesRaw = (Array.isArray(summary.badges) ? summary.badges : []).filter((row) => {
      if (!row || typeof row !== 'object') return true;
      const visibility = toText(row.visibility, 'default').toLowerCase();
      if (visibility !== 'hidden-until-unlocked') return true;
      const threshold = Math.max(1, Number(row.threshold) || 1);
      const progress = Math.max(0, Number(row.progress ?? row.metricValue ?? 0) || 0);
      return Boolean(row.unlocked) || progress >= threshold;
    });
    const newly = Array.isArray(summary.newlyUnlocked)
      ? summary.newlyUnlocked.map((item) => toText(item && typeof item === 'object' ? item.id : item, '').toLowerCase()).filter(Boolean)
      : [];

    state.summary = {
      ...summary,
      badges: badgesRaw,
    };
    state.newlyUnlockedSet = new Set(newly);
    state.badges = badgesRaw.map((row) => normalizeBadge(row, state));

    updateHeaderSummary(state);
    renderOverview(state);
    renderSecretVault(state);

    dispatchEvent('dx:achievements:updated', summary);
    for (const badge of state.badges) {
      if (!badge.newly || state.emittedUnlocked.has(badge.id)) continue;
      state.emittedUnlocked.add(badge.id);
      dispatchEvent('dx:achievements:unlocked', {
        badgeId: badge.id,
        title: badge.title,
        tier: badge.tier,
        secret: badge.secret,
      });
    }

    const badgeIdFromQuery = readFocusBadgeFromUrl();
    if (badgeIdFromQuery) {
      const target = state.badges.find((badge) => badge.id === badgeIdFromQuery);
      if (target) {
        if (target.secret) {
          const secretCards = state.badges.filter((badge) => badge.secret);
          const secretIndex = secretCards.findIndex((badge) => badge.id === badgeIdFromQuery);
          state.badgePages[PAGE_SECRET] = Math.max(0, Math.floor(secretIndex / responsiveBadgePageSize(state)));
          renderSecretVault(state);
          switchPage(state, PAGE_SECRET);
        } else {
          const publicCards = state.badges.filter((badge) => !badge.secret);
          const publicIndex = publicCards.findIndex((badge) => badge.id === badgeIdFromQuery);
          state.badgePages[PAGE_OVERVIEW] = Math.max(0, Math.floor(publicIndex / responsiveBadgePageSize(state)));
          renderOverview(state);
          switchPage(state, PAGE_OVERVIEW);
        }
        focusBadgeCard(state, badgeIdFromQuery);
      }
    }

    state.visualState = state.badges.length ? STATE_READY : STATE_EMPTY;
    const app = state.root.querySelector('[data-dx-achievements-app="v2"]');
    setAppState(state.root, app, state.visualState, state.page);
    setFetchState(state.root, FETCH_STATE_READY);

    const markSeenButton = state.root.querySelector('[data-dx-achievements-mark-seen]');
    if (markSeenButton instanceof HTMLButtonElement) {
      markSeenButton.hidden = state.newlyUnlockedSet.size === 0;
    }
  }

  function bindInspectorEvents(state) {
    const dialog = state.root.querySelector('[data-dx-achievement-inspector]');
    const closeButton = state.root.querySelector('[data-dx-achievement-inspector-close]');
    if (!(dialog instanceof HTMLDialogElement)) return;

    if (closeButton instanceof HTMLButtonElement) {
      closeButton.addEventListener('click', () => closeBadgeInspector(state));
    }

    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) closeBadgeInspector(state);
    });

    dialog.addEventListener('close', () => {
      dialog.classList.remove('is-visible');
      state.inspector.dragging = false;
      state.inspector.pointerId = null;
      if (state.inspector.shader) {
        state.inspector.shader.dispose();
        state.inspector.shader = null;
      }
      const opener = state.inspector.opener;
      state.inspector.opener = null;
      if (opener && opener.isConnected) {
        window.requestAnimationFrame(() => opener.focus({ preventScroll: true }));
      }
    });

    dialog.addEventListener('pointerdown', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const object = target ? target.closest('[data-dx-achievement-inspect-object]') : null;
      if (!(object instanceof HTMLElement)) return;
      state.inspector.dragging = true;
      state.inspector.pointerId = event.pointerId;
      state.inspector.startX = event.clientX;
      state.inspector.startY = event.clientY;
      state.inspector.startRotationX = state.inspector.rotationX;
      state.inspector.startRotationY = state.inspector.rotationY;
      object.classList.add('is-dragging');
      try {
        object.setPointerCapture(event.pointerId);
      } catch {}
      event.preventDefault();
    });

    dialog.addEventListener('pointermove', (event) => {
      const object = dialog.querySelector('[data-dx-achievement-inspect-object]');
      if (!(object instanceof HTMLElement)) return;
      const rect = object.getBoundingClientRect();
      const px = rect.width > 0 ? clamp(0, 1, (event.clientX - rect.left) / rect.width) : 0.5;
      const py = rect.height > 0 ? clamp(0, 1, 1 - ((event.clientY - rect.top) / rect.height)) : 0.5;
      if (state.inspector.shader) state.inspector.shader.setPointer(px, py);
      object.style.setProperty('--dx-inspect-light-x', `${px * 100}%`);
      object.style.setProperty('--dx-inspect-light-y', `${(1 - py) * 100}%`);

      if (!state.inspector.dragging || state.inspector.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - state.inspector.startX;
      const deltaY = event.clientY - state.inspector.startY;
      state.inspector.rotationY = state.inspector.startRotationY + deltaX * 0.48;
      state.inspector.rotationX = clamp(-34, 34, state.inspector.startRotationX - deltaY * 0.36);
      updateInspectorTransform(state);
      event.preventDefault();
    });

    const endDrag = (event) => {
      if (!state.inspector.dragging) return;
      if (state.inspector.pointerId !== null && event.pointerId !== state.inspector.pointerId) return;
      state.inspector.dragging = false;
      state.inspector.pointerId = null;
      const object = dialog.querySelector('[data-dx-achievement-inspect-object]');
      if (object instanceof HTMLElement) object.classList.remove('is-dragging');
    };
    dialog.addEventListener('pointerup', endDrag);
    dialog.addEventListener('pointercancel', endDrag);

    dialog.addEventListener('dblclick', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || !target.closest('[data-dx-achievement-inspect-object]')) return;
      resetInspectorRotation(state);
    });

    dialog.addEventListener('keydown', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || !target.closest('[data-dx-achievement-inspect-object]')) return;
      const step = event.shiftKey ? 24 : 12;
      if (event.key === 'ArrowLeft') state.inspector.rotationY -= step;
      else if (event.key === 'ArrowRight') state.inspector.rotationY += step;
      else if (event.key === 'ArrowUp') state.inspector.rotationX = clamp(-34, 34, state.inspector.rotationX - step * 0.6);
      else if (event.key === 'ArrowDown') state.inspector.rotationX = clamp(-34, 34, state.inspector.rotationX + step * 0.6);
      else if (event.key === 'Home') resetInspectorRotation(state);
      else return;
      updateInspectorTransform(state);
      event.preventDefault();
    });
  }

  function bindEvents(state) {
    const navButtons = state.root.querySelectorAll('[data-dx-achievements-page]');
    navButtons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      button.addEventListener('click', () => {
        switchPage(state, button.getAttribute('data-dx-achievements-page'));
      });
    });

    const refresh = state.root.querySelector('[data-dx-achievements-refresh]');
    if (refresh instanceof HTMLButtonElement) {
      refresh.addEventListener('click', async () => {
        refresh.disabled = true;
        const summaryResult = await loadSummary(state);
        if (summaryResult.ok) {
          applySummary(state, summaryResult.payload);
          showToast(state, 'Achievements refreshed.');
        } else {
          showToast(state, 'Unable to refresh achievements.', { error: true });
        }
        refresh.disabled = false;
      });
    }

    const markSeenButton = state.root.querySelector('[data-dx-achievements-mark-seen]');
    if (markSeenButton instanceof HTMLButtonElement) {
      markSeenButton.addEventListener('click', async () => {
        if (markSeenButton.disabled) return;
        markSeenButton.disabled = true;
        await markSeen(state, Array.from(state.newlyUnlockedSet));
        markSeenButton.disabled = false;
      });
    }

    bindInspectorEvents(state);

    if (typeof ResizeObserver === 'function') {
      let resizeFrame = 0;
      state.layoutObserver = new ResizeObserver(() => {
        if (resizeFrame) return;
        resizeFrame = window.requestAnimationFrame(() => {
          resizeFrame = 0;
          const nextSize = responsiveBadgePageSize(state);
          if (nextSize === state.badgePageSize || !state.summary) return;
          state.badgePageSize = nextSize;
          renderOverview(state);
          renderSecretVault(state);
        });
      });
      state.layoutObserver.observe(state.root);
    }

    state.root.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch') return;
      const target = event.target instanceof Element ? event.target : null;
      const card = target ? target.closest('.dx-achievement-card') : null;
      if (!(card instanceof HTMLElement)) return;
      const rect = card.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = clamp(0, 1, (event.clientX - rect.left) / rect.width);
      const y = clamp(0, 1, (event.clientY - rect.top) / rect.height);
      card.style.setProperty('--dx-card-light-x', `${x * 100}%`);
      card.style.setProperty('--dx-card-light-y', `${y * 100}%`);
      card.style.setProperty('--dx-card-tilt-x', `${(0.5 - y) * 2.4}deg`);
      card.style.setProperty('--dx-card-tilt-y', `${(x - 0.5) * 3.2}deg`);
    });

    state.root.addEventListener('pointerout', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const card = target ? target.closest('.dx-achievement-card') : null;
      if (!(card instanceof HTMLElement)) return;
      const related = event.relatedTarget instanceof Node ? event.relatedTarget : null;
      if (related && card.contains(related)) return;
      card.style.removeProperty('--dx-card-light-x');
      card.style.removeProperty('--dx-card-light-y');
      card.style.removeProperty('--dx-card-tilt-x');
      card.style.removeProperty('--dx-card-tilt-y');
    });

    state.root.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target instanceof Element ? event.target : null;
      const card = target ? target.closest('[data-dx-achievement-open]') : null;
      if (!(card instanceof HTMLElement) || target instanceof HTMLButtonElement) return;
      const badgeId = toText(card.getAttribute('data-dx-achievement-open'), '').toLowerCase();
      if (!badgeId) return;
      openBadgeInspector(state, badgeId, card);
      event.preventDefault();
    });

    state.root.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const claimButton = target.closest('[data-dx-achievement-claim]');
      if (claimButton instanceof HTMLButtonElement) {
        const badgeId = toText(claimButton.getAttribute('data-dx-achievement-claim'), '').toLowerCase();
        if (!badgeId) return;
        claimButton.disabled = true;
        void claimSecret(state, badgeId).finally(() => {
          claimButton.disabled = false;
        });
        return;
      }
      const loadMore = target.closest('[data-dx-achievements-load-more="true"]');
      if (loadMore instanceof HTMLButtonElement) {
        if (!state.historyNextCursor) return;
        loadMore.disabled = true;
        void loadHistory(state, { append: true }).finally(() => {
          loadMore.disabled = false;
        });
        return;
      }
      const pagerButton = target.closest('[data-dx-achievements-badge-page-index]');
      if (pagerButton instanceof HTMLButtonElement) {
        const page = toText(pagerButton.getAttribute('data-dx-achievements-badge-page'), PAGE_OVERVIEW);
        const index = Number(pagerButton.getAttribute('data-dx-achievements-badge-page-index')) || 0;
        state.badgePages[page] = index;
        if (page === PAGE_SECRET) renderSecretVault(state);
        else renderOverview(state);
        return;
      }
      const prevButton = target.closest('[data-dx-achievements-badge-page-prev]');
      if (prevButton instanceof HTMLButtonElement) {
        const page = toText(prevButton.getAttribute('data-dx-achievements-badge-page-prev'), PAGE_OVERVIEW);
        state.badgePages[page] = Math.max(0, (Number(state.badgePages[page]) || 0) - 1);
        if (page === PAGE_SECRET) renderSecretVault(state);
        else renderOverview(state);
        return;
      }
      const nextButton = target.closest('[data-dx-achievements-badge-page-next]');
      if (nextButton instanceof HTMLButtonElement) {
        const page = toText(nextButton.getAttribute('data-dx-achievements-badge-page-next'), PAGE_OVERVIEW);
        state.badgePages[page] = (Number(state.badgePages[page]) || 0) + 1;
        if (page === PAGE_SECRET) renderSecretVault(state);
        else renderOverview(state);
        return;
      }
      const card = target.closest('[data-dx-achievement-open]');
      if (!(card instanceof HTMLElement)) return;
      const badgeId = toText(card.getAttribute('data-dx-achievement-open'), '').toLowerCase();
      if (!badgeId) return;
      openBadgeInspector(state, badgeId, card);
    });
  }

  function renderShell(root) {
    root.innerHTML = `
      <div class="dx-route-loader" data-dx-route-loader role="status" aria-live="polite">
        <div class="dx-route-loader-inner">
          <div class="dx-route-loader-meta">
            <span class="dx-route-loader-phase">Loading</span>
            <span class="dx-route-loader-detail">your achievements</span>
          </div>
          <div class="dx-route-loader-track"><span class="dx-route-loader-fill"></span></div>
        </div>
      </div>
      <div class="dex-sidebar dx-achievements-shell" data-dx-achievements-app="v2" data-dx-achievements-state="loading" data-dx-achievements-page="overview">
        <div class="dx-achievements-panel" data-dx-achievements-body>
          <header class="dx-achievements-header">
            <div>
              <p class="dx-achievements-kicker">PROFILE</p>
              <h1>YOUR ACHIEVEMENTS</h1>
              <p class="dx-achievements-sub" data-dx-achievements-totals>Loading achievement summary…</p>
              <p class="dx-achievements-sub" data-dx-achievements-metrics></p>
            </div>
            <div class="dx-achievements-actions">
              <button type="button" class="dx-button-element dx-button-element--secondary dx-button-size--sm" data-dx-achievements-refresh data-dx-motion-include="true">Refresh</button>
              <button type="button" class="dx-button-element dx-button-element--secondary dx-button-size--sm" data-dx-achievements-mark-seen data-dx-motion-include="true" hidden>Mark seen</button>
            </div>
          </header>
          <p class="dx-achievements-warning" data-dx-achievements-warning hidden></p>
          <nav class="dx-achievements-nav" aria-label="Achievements pages">
            <button type="button" class="dx-button-element dx-button-element--secondary dx-button-size--sm is-active" aria-pressed="true" data-dx-achievements-page="overview" data-dx-motion-include="true">Overview</button>
            <button type="button" class="dx-button-element dx-button-element--secondary dx-button-size--sm" aria-pressed="false" data-dx-achievements-page="secret-vault" data-dx-motion-include="true">Secret Vault</button>
            <button type="button" class="dx-button-element dx-button-element--secondary dx-button-size--sm" aria-pressed="false" data-dx-achievements-page="history" data-dx-motion-include="true">History</button>
          </nav>
          <div class="dx-achievements-page" data-dx-achievements-page-panel="overview"></div>
          <div class="dx-achievements-page" data-dx-achievements-page-panel="secret-vault" hidden></div>
          <div class="dx-achievements-page" data-dx-achievements-page-panel="history" hidden></div>
        </div>
        <div class="dx-achievements-toast-stack" data-dx-achievements-toasts></div>
      </div>
      <dialog class="dx-achievement-inspector" data-dx-achievement-inspector aria-modal="true">
        <button type="button" class="dx-achievement-inspector-close" data-dx-achievement-inspector-close aria-label="Close achievement viewer">Close</button>
        <div class="dx-achievement-inspector-stage">
          <div class="dx-achievement-inspect-viewport" data-dx-achievement-inspect-viewport></div>
        </div>
        <p class="dx-achievement-inspector-hint">Drag to rotate · Arrow keys inspect · Double-click resets · Esc closes</p>
      </dialog>
    `;
  }

  async function mountRoot(root) {
    if (!(root instanceof HTMLElement)) return;
    if (root.getAttribute('data-dx-achievements-mounted') === 'true') return;
    root.setAttribute('data-dx-achievements-mounted', 'true');

    setFetchState(root, FETCH_STATE_LOADING);
    renderShell(root);

    const state = {
      root,
      page: PAGE_OVERVIEW,
      visualState: STATE_LOADING,
      summary: null,
      badges: [],
      historyEvents: [],
      historyNextCursor: '',
      historyLoaded: false,
      historyLoading: false,
      badgePages: {
        [PAGE_OVERVIEW]: 0,
        [PAGE_SECRET]: 0,
      },
      newlyUnlockedSet: new Set(),
      emittedUnlocked: new Set(),
      authSnapshot: {
        auth: null,
        authenticated: false,
        token: '',
        user: null,
      },
      inspector: {
        badgeId: '',
        opener: null,
        shader: null,
        dragging: false,
        pointerId: null,
        startX: 0,
        startY: 0,
        startRotationX: INSPECT_DEFAULT_ROTATION.x,
        startRotationY: INSPECT_DEFAULT_ROTATION.y,
        rotationX: INSPECT_DEFAULT_ROTATION.x,
        rotationY: INSPECT_DEFAULT_ROTATION.y,
      },
      badgePageSize: DEFAULT_BADGES_PER_PAGE,
      layoutObserver: null,
    };

    bindEvents(state);
    setAppState(root, root.querySelector('[data-dx-achievements-app="v2"]'), STATE_LOADING, PAGE_OVERVIEW);

    const bootStart = nowMs();

    state.authSnapshot = await resolveAuthSnapshot();

    if (!state.authSnapshot.authenticated || !toText(state.authSnapshot.token, '')) {
      state.visualState = STATE_SIGNED_OUT;
      setAppState(root, root.querySelector('[data-dx-achievements-app="v2"]'), STATE_SIGNED_OUT, PAGE_OVERVIEW);
      renderSignedOut(state);
      const remaining = DX_MIN_SHEEN_MS - (nowMs() - bootStart);
      if (remaining > 0) {
        await wait(remaining);
      }
      setFetchState(root, FETCH_STATE_READY);
      return;
    }

    const summaryResult = await loadSummary(state);
    if (!summaryResult.ok) {
      state.visualState = STATE_ERROR;
      setAppState(root, root.querySelector('[data-dx-achievements-app="v2"]'), STATE_ERROR, PAGE_OVERVIEW);
      const body = root.querySelector('[data-dx-achievements-body]');
      if (body instanceof HTMLElement) {
        body.innerHTML = `
          <article class="dx-achievements-empty" data-dx-motion-include="true">
            <h3>Unable to load achievements</h3>
            <p>Try again in a moment. If this persists, open Messages for system updates.</p>
          </article>
        `;
      }
      const remaining = DX_MIN_SHEEN_MS - (nowMs() - bootStart);
      if (remaining > 0) {
        await wait(remaining);
      }
      setFetchState(root, FETCH_STATE_ERROR);
      return;
    }

    applySummary(state, summaryResult.payload);
    if (!readFocusBadgeFromUrl()) switchPage(state, PAGE_OVERVIEW);

    const remaining = DX_MIN_SHEEN_MS - (nowMs() - bootStart);
    if (remaining > 0) {
      await wait(remaining);
    }
    setFetchState(root, FETCH_STATE_READY);
  }

  function mountAll() {
    const roots = document.querySelectorAll('#dex-achv');
    roots.forEach((root) => {
      void mountRoot(root);
    });
  }

  window.__dxAchievementsMount = mountAll;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      mountAll();
    }, { once: true });
  } else {
    mountAll();
  }

  window.addEventListener('dx:slotready', () => {
    mountAll();
  });
})();
