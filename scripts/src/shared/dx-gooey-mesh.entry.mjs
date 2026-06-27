// Shared gooey-mesh background — the exact animated blob field used on the
// catalog index, extracted so other catalog-family pages (e.g. the lookup guide)
// render the identical background. Styled by base.css + dx-catalog-index.css.
import { prefersReducedMotion } from './dx-motion.entry.mjs';

const BLOB_STYLES = [
  '--d:36vmax;--g1a:#ff5f6d;--g1b:#ffc371;--g2a:#47c9e5;--g2b:#845ef7',
  '--d:32vmax;--g1a:#7F00FF;--g1b:#E100FF;--g2a:#00DBDE;--g2b:#FC00FF',
  '--d:33vmax;--g1a:#FFD452;--g1b:#FFB347;--g2a:#FF8456;--g2b:#FF5E62',
  '--d:37vmax;--g1a:#13F1FC;--g1b:#0470DC;--g2a:#A1FFCE;--g2b:#FAFFD1',
  '--d:27vmax;--g1a:#F9516D;--g1b:#FF9A44;--g2a:#FA8BFF;--g2b:#6F7BF7',
];

let blobRaf = 0;
let blobResizeHandler = null;

export function ensureGooeyMesh() {
  let wrapper = document.getElementById('gooey-mesh-wrapper');
  if (wrapper) return wrapper;

  wrapper = document.createElement('div');
  wrapper.id = 'gooey-mesh-wrapper';

  const stage = document.createElement('div');
  stage.className = 'gooey-stage';
  BLOB_STYLES.forEach((styleValue) => {
    const blob = document.createElement('div');
    blob.className = 'gooey-blob';
    blob.setAttribute('style', styleValue);
    stage.appendChild(blob);
  });
  wrapper.appendChild(stage);

  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('id', 'goo-filter');
  svg.setAttribute('aria-hidden', 'true');
  const defs = document.createElementNS(svgNs, 'defs');
  const filter = document.createElementNS(svgNs, 'filter');
  filter.setAttribute('id', 'goo');
  const blur = document.createElementNS(svgNs, 'feGaussianBlur');
  blur.setAttribute('in', 'SourceGraphic');
  blur.setAttribute('stdDeviation', '15');
  blur.setAttribute('result', 'blur');
  const matrix = document.createElementNS(svgNs, 'feColorMatrix');
  matrix.setAttribute('in', 'blur');
  matrix.setAttribute('mode', 'matrix');
  matrix.setAttribute('values', '1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 18 -8');
  matrix.setAttribute('result', 'goo');
  const blend = document.createElementNS(svgNs, 'feBlend');
  blend.setAttribute('in', 'SourceGraphic');
  blend.setAttribute('in2', 'goo');
  blend.setAttribute('mode', 'normal');
  filter.appendChild(blur);
  filter.appendChild(matrix);
  filter.appendChild(blend);
  defs.appendChild(filter);
  svg.appendChild(defs);
  wrapper.appendChild(svg);

  document.body.appendChild(wrapper);
  return wrapper;
}

export function startBlobMotion() {
  const mesh = ensureGooeyMesh();
  if (!mesh || prefersReducedMotion()) return;

  const blobs = Array.from(mesh.querySelectorAll('.gooey-blob'));
  if (!blobs.length) return;

  const w = () => window.innerWidth;
  const h = () => window.innerHeight;

  blobs.forEach((el) => {
    const speed = 60 + Math.random() * 60;
    const angle = Math.random() * Math.PI * 2;
    el._rad = el.offsetWidth / 2;
    el._x = w() / 2;
    el._y = h() / 2;
    el._vx = Math.cos(angle) * speed * 0.25;
    el._vy = Math.sin(angle) * speed * 0.25;
  });

  if (blobRaf) cancelAnimationFrame(blobRaf);
  let last = performance.now();
  const tick = (now) => {
    const dt = (now - last) / 1000;
    last = now;
    blobs.forEach((el) => {
      el._x += el._vx * dt;
      el._y += el._vy * dt;
      if (el._x - el._rad <= 0 && el._vx < 0) el._vx *= -1;
      if (el._x + el._rad >= w() && el._vx > 0) el._vx *= -1;
      if (el._y - el._rad <= 0 && el._vy < 0) el._vy *= -1;
      if (el._y + el._rad >= h() && el._vy > 0) el._vy *= -1;
      el.style.transform = `translate(${el._x}px,${el._y}px) translate(-50%,-50%)`;
    });
    blobRaf = requestAnimationFrame(tick);
  };
  blobRaf = requestAnimationFrame(tick);

  if (blobResizeHandler) window.removeEventListener('resize', blobResizeHandler);
  blobResizeHandler = () => {
    blobs.forEach((el) => {
      el._x = Math.min(Math.max(el._rad, el._x), w() - el._rad);
      el._y = Math.min(Math.max(el._rad, el._y), h() - el._rad);
    });
  };
  window.addEventListener('resize', blobResizeHandler);
}

export function stopBlobMotion() {
  if (blobRaf) {
    cancelAnimationFrame(blobRaf);
    blobRaf = 0;
  }
  if (blobResizeHandler) {
    window.removeEventListener('resize', blobResizeHandler);
    blobResizeHandler = null;
  }
}
