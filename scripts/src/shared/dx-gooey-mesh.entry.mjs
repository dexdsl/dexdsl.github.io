// Route bundles may query the persistent backdrop, but they never create or
// animate it. header-slot.js is the single mesh owner across soft navigation.

export function ensureGooeyMesh() {
  return document.getElementById('gooey-mesh-wrapper');
}

export function startBlobMotion() {
  try {
    window.dispatchEvent(new CustomEvent('dx:gooey-mesh:request'));
  } catch {}
  return ensureGooeyMesh();
}

export function stopBlobMotion() {}
