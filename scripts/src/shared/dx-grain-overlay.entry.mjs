import {
  ShaderFitOptions,
  ShaderMount,
  getShaderColorFromString,
  getShaderNoiseTexture,
  grainGradientFragmentShader,
} from '@paper-design/shaders';

const ROOT_ID = 'dx-gooey-grain-overlay';
const READY_STATE = 'ready';
const FALLBACK_STATE = 'fallback';
const GRAIN_MAIN_MARKER = 'void main() {';
const BLOB_COUNT = 5;
const BLOB_COLORS = Object.freeze({
  g1a: ['#ff5f6d', '#7f00ff', '#ffd452', '#13f1fc', '#f9516d'],
  g1b: ['#ffc371', '#e100ff', '#ffb347', '#0470dc', '#ff9a44'],
  g2a: ['#47c9e5', '#00dbde', '#ff8456', '#a1ffce', '#fa8bff'],
  g2b: ['#845ef7', '#fc00ff', '#ff5e62', '#faffd1', '#6f7bf7'],
});
const BASE_BLOB_COLORS = Object.freeze(
  Object.fromEntries(
    Object.entries(BLOB_COLORS).map(([key, colors]) => [
      key,
      Object.freeze(colors.map((color) => Object.freeze(getShaderColorFromString(color)))),
    ]),
  ),
);
const MESH_UNIFORMS = `
uniform vec3 u_blobGeometry[${BLOB_COUNT}];
uniform vec4 u_blobG1A[${BLOB_COUNT}];
uniform vec4 u_blobG1B[${BLOB_COUNT}];
uniform vec4 u_blobG2A[${BLOB_COUNT}];
uniform vec4 u_blobG2B[${BLOB_COUNT}];
`;
const GRAINED_MESH_MAIN = `void main() {
  vec2 fragCss = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y) / u_pixelRatio;
  vec2 grain_uv = fragCss * .95;

  float baseNoise = snoise(grain_uv * .5);
  vec4 fbmVals = fbmR(
    .002 * grain_uv + 10.,
    .003 * grain_uv,
    .001 * grain_uv,
    rotate(.4 * grain_uv, 2.)
  );
  float grainDist = baseNoise * snoise(grain_uv * .2) - fbmVals.x - fbmVals.y;
  float rawNoise = .75 * baseNoise - fbmVals.w - fbmVals.z;
  float noise = clamp(rawNoise, 0., 1.);

  // GrainGradient's exact perturbation weights for intensity=.5, noise=.25,
  // and four color bands. The field now perturbs our radial blob material.
  float paperPerturb = .25 * (grainDist + .5) + .625 * noise;
  float centeredPerturb = (paperPerturb - .16) * 2.4;
  float chromaGrain = smoothstep(-.28, .28, baseNoise + .55 * grainDist);

  vec3 colorSum = vec3(0.);
  float colorWeight = 0.;
  float coverage = 0.;
  for (int i = 0; i < ${BLOB_COUNT}; i++) {
    vec3 geometry = u_blobGeometry[i];
    float radius = geometry.z;
    if (radius <= 0.) continue;

    vec2 local = (fragCss - geometry.xy) / radius;
    float edgeFeather = clamp(50. / radius, .12, .42);
    float circleDistance = length(local) + .18 * centeredPerturb;
    float circleAlpha = 1. - smoothstep(.58, 1.16 + edgeFeather, circleDistance);

    float d1 = length(local - vec2(-.34));
    float d2 = length(local - vec2(.34));
    float perturbedD1 = d1 + .5 * centeredPerturb;
    float perturbedD2 = d2 - .38 * centeredPerturb;

    float alpha1 = (1. - smoothstep(.52, 1.08, perturbedD1)) * circleAlpha;
    float alpha2 = (1. - smoothstep(.52, 1.08, perturbedD2)) * circleAlpha;
    float colorT1 = clamp(smoothstep(.2, .72, perturbedD1) + .22 * (chromaGrain - .5), 0., 1.);
    float colorT2 = clamp(smoothstep(.2, .72, perturbedD2) - .18 * (chromaGrain - .5), 0., 1.);

    vec4 color1 = mix(u_blobG1A[i], u_blobG1B[i], colorT1);
    vec4 color2 = mix(u_blobG2A[i], u_blobG2B[i], colorT2);
    vec4 layer2 = vec4(color2.rgb * alpha2, alpha2);
    vec4 layer1 = vec4(color1.rgb * alpha1, alpha1);
    vec4 blob = layer1 + layer2 * (1. - layer1.a);
    blob *= .73;

    float weight = blob.a;
    colorSum += (blob.rgb / max(blob.a, .0001)) * weight;
    colorWeight += weight;
    coverage = 1. - (1. - coverage) * (1. - blob.a);
  }

  vec3 mixedColor = colorWeight > 0. ? colorSum / colorWeight : vec3(0.);
  fragColor = vec4(mixedColor * coverage, coverage);
}`;

const mainIndex = grainGradientFragmentShader.indexOf(GRAIN_MAIN_MARKER);
if (mainIndex < 0) {
  throw new Error('Paper Grain Gradient output contract changed.');
}
const grainOnlyFragmentShader = [
  grainGradientFragmentShader.slice(0, mainIndex),
  MESH_UNIFORMS,
  GRAINED_MESH_MAIN,
].join('\n');

let activeMount = null;
let mountPromise = null;

function resolveBlobGeometry(blob, wrapperRect) {
  if (!(blob instanceof HTMLElement)) return null;

  const x = Number(blob._x);
  const y = Number(blob._y);
  const radius = Number(blob._rad);
  if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(radius) && radius > 0) {
    const waxMass = Number.isFinite(Number(blob._waxMass))
      ? Math.max(0.1, Number(blob._waxMass))
      : 1;
    return {
      x,
      y,
      radius: radius * 0.82 * Math.sqrt(waxMass),
      baseRadius: radius,
      mass: waxMass,
      partner: Number.isInteger(Number(blob._waxPartner)) ? Number(blob._waxPartner) : -1,
    };
  }

  const rect = blob.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: rect.left - wrapperRect.left + (rect.width / 2),
    y: rect.top - wrapperRect.top + (rect.height / 2),
    radius: Math.max(rect.width, rect.height) / 2,
    baseRadius: Math.max(rect.width, rect.height) / (2 * 0.82),
    mass: 1,
    partner: -1,
  };
}

function mixColor(left, right, amount) {
  return left.map((channel, index) => channel + ((right[index] - channel) * amount));
}

function buildConservedColorUniforms(resolved) {
  const colors = Object.fromEntries(
    Object.entries(BASE_BLOB_COLORS).map(([key, values]) => [
      key,
      values.map((color) => [...color]),
    ]),
  );

  for (let index = 0; index < resolved.length; index += 1) {
    const item = resolved[index];
    const partnerIndex = Number(item?.partner);
    if (!item || partnerIndex <= index || partnerIndex >= resolved.length) continue;
    const partner = resolved[partnerIndex];
    if (!partner || Number(partner.partner) !== index) continue;

    let winnerIndex = index;
    let donorIndex = partnerIndex;
    let winner = item;
    let donor = partner;
    if (partner.mass > item.mass) {
      winnerIndex = partnerIndex;
      donorIndex = index;
      winner = partner;
      donor = item;
    }
    if (winner.mass <= 1 || donor.mass >= 1) continue;

    const baseArea = Math.max(1, winner.baseRadius * winner.baseRadius);
    const currentArea = baseArea * winner.mass;
    const gainedArea = Math.max(0, currentArea - baseArea);
    const donorShare = Math.min(1, gainedArea / Math.max(currentArea, 1));
    if (donorShare <= 0) continue;

    for (const key of Object.keys(colors)) {
      colors[key][winnerIndex] = mixColor(
        BASE_BLOB_COLORS[key][winnerIndex],
        BASE_BLOB_COLORS[key][donorIndex],
        donorShare,
      );
    }
  }

  return {
    u_blobG1A: colors.g1a,
    u_blobG1B: colors.g1b,
    u_blobG2A: colors.g2a,
    u_blobG2B: colors.g2b,
  };
}

function syncGooeyGrainMesh(
  wrapper = document.getElementById('gooey-mesh-wrapper'),
  blobs = null,
) {
  if (!(wrapper instanceof HTMLElement)) return false;
  const root = wrapper.querySelector(`#${ROOT_ID}`);
  if (!(root instanceof HTMLElement)) return false;

  const liveBlobs = Array.isArray(blobs)
    ? blobs
    : Array.from(wrapper.querySelectorAll('.gooey-blob'));
  const wrapperRect = wrapper.getBoundingClientRect();
  const resolved = liveBlobs
    .slice(0, BLOB_COUNT)
    .map((blob) => resolveBlobGeometry(blob, wrapperRect));
  const hasLiveGeometry = resolved.some((geometry) =>
    geometry
    && geometry.x > 1
    && geometry.y > 1
    && geometry.radius > 1
  );
  const geometry = Array.from({ length: BLOB_COUNT }, (_, index) => {
    const item = resolved[index];
    return item ? [item.x, item.y, item.radius] : [0, 0, 0];
  });

  if (hasLiveGeometry && activeMount?.root === root) {
    activeMount.mount.setUniforms({
      u_blobGeometry: geometry,
      ...buildConservedColorUniforms(resolved),
    });
    root.setAttribute('data-dx-grain-state', READY_STATE);
    wrapper.setAttribute('data-dx-grain', READY_STATE);
  }
  return hasLiveGeometry;
}

function shouldUseFallback() {
  const userAgent = String(navigator.userAgent || '');
  if (navigator.webdriver === true) return true;
  if (/HeadlessChrome|HeadlessChromium|Chrome-Lighthouse|Googlebot|AdsBot-Google/i.test(userAgent)) return true;
  if (window.matchMedia?.('(max-width: 900px)').matches) return true;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true;
  if (window.matchMedia?.('(forced-colors: active)').matches) return true;
  if (window.matchMedia?.('print').matches) return true;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (connection?.saveData === true) return true;
  const deviceMemory = Number(navigator.deviceMemory || 0);
  if (deviceMemory > 0 && deviceMemory <= 4) return true;
  const hardwareConcurrency = Number(navigator.hardwareConcurrency || 0);
  return hardwareConcurrency > 0 && hardwareConcurrency <= 4;
}

function waitForImage(image) {
  if (!(image instanceof HTMLImageElement)) {
    return Promise.reject(new Error('Paper grain texture is unavailable.'));
  }
  if (image.complete && image.naturalWidth > 0) return Promise.resolve(image);

  return new Promise((resolve, reject) => {
    const onLoad = () => {
      cleanup();
      resolve(image);
    };
    const onError = () => {
      cleanup();
      reject(new Error('Paper grain texture failed to load.'));
    };
    const cleanup = () => {
      image.removeEventListener('load', onLoad);
      image.removeEventListener('error', onError);
    };
    image.addEventListener('load', onLoad, { once: true });
    image.addEventListener('error', onError, { once: true });
  });
}

function ensureRoot(wrapper) {
  let root = wrapper.querySelector(`#${ROOT_ID}`);
  if (!(root instanceof HTMLElement)) {
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('aria-hidden', 'true');
    root.setAttribute('data-dx-grain-state', 'pending');
    wrapper.appendChild(root);
  }
  return root;
}

function disposeActiveMount() {
  if (!activeMount) return;
  try {
    activeMount.mount.dispose();
  } catch {}
  if (activeMount.root instanceof HTMLElement) {
    activeMount.root.replaceChildren();
  }
  activeMount = null;
}

function markFallback(wrapper, root) {
  root.setAttribute('data-dx-grain-state', FALLBACK_STATE);
  wrapper.setAttribute('data-dx-grain', FALLBACK_STATE);
  root.replaceChildren();
}

async function mountGooeyGrain(wrapper = document.getElementById('gooey-mesh-wrapper')) {
  if (!(wrapper instanceof HTMLElement)) return null;

  if (
    activeMount
    && activeMount.wrapper === wrapper
    && activeMount.root.isConnected
  ) {
    return activeMount.root;
  }

  if (mountPromise) return mountPromise;

  mountPromise = (async () => {
    if (activeMount?.wrapper !== wrapper) disposeActiveMount();

    const root = ensureRoot(wrapper);
    if (shouldUseFallback()) {
      markFallback(wrapper, root);
      return root;
    }

    try {
      const noiseTexture = await waitForImage(getShaderNoiseTexture());
      if (!wrapper.isConnected) return null;

      const maxPixelCount = window.matchMedia?.('(max-width: 900px)').matches
        ? 921_600
        : 2_073_600;
      const mount = new ShaderMount(
        root,
        grainOnlyFragmentShader,
        {
          u_noiseTexture: noiseTexture,
          u_fit: ShaderFitOptions.cover,
          u_scale: 1,
          u_rotation: 0,
          u_offsetX: 0,
          u_offsetY: 0,
          u_originX: 0.5,
          u_originY: 0.5,
          u_worldWidth: 0,
          u_worldHeight: 0,
          u_blobGeometry: Array.from({ length: BLOB_COUNT }, () => [0, 0, 0]),
          u_blobG1A: BASE_BLOB_COLORS.g1a,
          u_blobG1B: BASE_BLOB_COLORS.g1b,
          u_blobG2A: BASE_BLOB_COLORS.g2a,
          u_blobG2B: BASE_BLOB_COLORS.g2b,
        },
        {
          alpha: true,
          antialias: false,
          depth: false,
          stencil: false,
          premultipliedAlpha: true,
          preserveDrawingBuffer: false,
          powerPreference: 'low-power',
        },
        0,
        0,
        1,
        maxPixelCount,
      );

      activeMount = { mount, root, wrapper };
      syncGooeyGrainMesh(wrapper);

      const canvas = mount.canvasElement;
      canvas?.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        if (activeMount?.mount === mount) activeMount = null;
        try {
          mount.dispose();
        } catch {}
        markFallback(wrapper, root);
      }, { once: true });

      return root;
    } catch (error) {
      markFallback(wrapper, root);
      try {
        console.warn('[dx-grain] Paper grain overlay unavailable.', error);
      } catch {}
      return root;
    }
  })();

  try {
    return await mountPromise;
  } finally {
    mountPromise = null;
  }
}

window.__dxMountGooeyGrain = mountGooeyGrain;
window.__dxSyncGooeyGrainMesh = syncGooeyGrainMesh;
void mountGooeyGrain();
