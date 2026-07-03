const LEGACY_STYLE_ID = 'dex-entry-gooey-bg-style';
const LEGACY_SCRIPT_ID = 'dex-entry-gooey-bg-script';
export const DX_SHADER_RUNTIME_CACHE_KEY = '20260702shader2';
export const DX_HEADER_SLOT_RUNTIME_SRC = `/assets/js/header-slot.js?v=${DX_SHADER_RUNTIME_CACHE_KEY}`;
export const DX_GRAIN_OVERLAY_RUNTIME_SRC = `/assets/js/dx-grain-overlay.js?v=${DX_SHADER_RUNTIME_CACHE_KEY}`;
export const DX_HEADER_SLOT_RUNTIME_TAG = `<script defer src="${DX_HEADER_SLOT_RUNTIME_SRC}"></script>`;
export const DX_GRAIN_OVERLAY_RUNTIME_TAG = `<script id="dx-gooey-grain-runtime" defer src="${DX_GRAIN_OVERLAY_RUNTIME_SRC}"></script>`;

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function canonicalAssetPath(src) {
  const value = String(src || '').trim();
  if (!value) return '';
  try {
    return new URL(value, 'https://dex.local').pathname;
  } catch {
    return value.split('?')[0].split('#')[0];
  }
}

export function normalizeShaderRuntimeHtml(html) {
  const source = String(html || '');
  const scriptPattern = /<script\b[^>]*\bsrc=(["'])([^"']+)\1[^>]*>\s*<\/script>/gi;
  const runtimeMatches = Array.from(source.matchAll(scriptPattern)).filter((match) => {
    const pathKey = canonicalAssetPath(match[2]);
    return pathKey === '/assets/js/header-slot.js' || pathKey === '/assets/js/dx-grain-overlay.js';
  });
  if (
    runtimeMatches.length === 2
    && runtimeMatches[0][0] === DX_GRAIN_OVERLAY_RUNTIME_TAG
    && runtimeMatches[1][0] === DX_HEADER_SLOT_RUNTIME_TAG
  ) {
    return source;
  }

  let firstRuntimeIndex = -1;
  const withoutRuntime = source.replace(scriptPattern, (full, _quote, src, offset) => {
    const pathKey = canonicalAssetPath(src);
    if (pathKey !== '/assets/js/header-slot.js' && pathKey !== '/assets/js/dx-grain-overlay.js') {
      return full;
    }
    if (firstRuntimeIndex < 0) firstRuntimeIndex = offset;
    return '';
  });

  if (firstRuntimeIndex < 0) return source;
  const runtimePair = `${DX_GRAIN_OVERLAY_RUNTIME_TAG}\n${DX_HEADER_SLOT_RUNTIME_TAG}`;
  return `${withoutRuntime.slice(0, firstRuntimeIndex)}${runtimePair}${withoutRuntime.slice(firstRuntimeIndex)}`;
}

function removeElementById(html, tagName, id) {
  let next = String(html || '');
  const tag = escapeRegex(tagName);
  const targetId = escapeRegex(id);
  const opener = new RegExp(`<${tag}\\b[^>]*\\bid=(["'])${targetId}\\1[^>]*>`, 'i');

  while (true) {
    const match = opener.exec(next);
    if (!match || typeof match.index !== 'number') break;

    const tokenPattern = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
    tokenPattern.lastIndex = match.index;
    let depth = 0;
    let end = -1;
    let token = null;

    while ((token = tokenPattern.exec(next)) !== null) {
      const isClosing = /^<\//.test(token[0]);
      const isSelfClosing = /\/>$/.test(token[0]);
      if (isClosing) depth -= 1;
      else if (!isSelfClosing) depth += 1;
      if (depth === 0) {
        end = tokenPattern.lastIndex;
        break;
      }
    }

    if (end < 0) break;
    const lineStart = next.lastIndexOf('\n', match.index - 1) + 1;
    const removalStart = /^[ \t]*$/.test(next.slice(lineStart, match.index))
      ? lineStart
      : match.index;
    next = `${next.slice(0, removalStart)}${next.slice(end)}`;
  }

  return next;
}

function isLegacyMeshStyle(attrs, css) {
  const idMatch = String(attrs || '').match(/\bid=(["'])([^"']+)\1/i);
  if (String(idMatch?.[2] || '').toLowerCase() === LEGACY_STYLE_ID) return true;
  const text = String(css || '');
  if (text.length >= 5000) return false;
  const targetsBackdrop = text.includes('#gooey-mesh-wrapper') || text.includes('#scroll-gradient-bg');
  if (!targetsBackdrop) return false;
  return text.includes('.gooey-blob')
    || text.includes('.gooey-stage')
    || text.includes('url("#goo")')
    || text.includes("url('#goo')")
    || text.includes('url("#noise")')
    || text.includes("url('#noise')");
}

function isLegacyMeshScript(attrs, code) {
  if (/\bsrc\s*=/i.test(String(attrs || ''))) return false;
  const idMatch = String(attrs || '').match(/\bid=(["'])([^"']+)\1/i);
  if (String(idMatch?.[2] || '').toLowerCase() === LEGACY_SCRIPT_ID) return true;
  const text = String(code || '');
  const targetsBackdrop = text.includes('gooey-mesh-wrapper') || text.includes('gooey-blob');
  const drivesBackdrop = text.includes('requestAnimationFrame')
    || text.includes('setInterval')
    || text.includes('blobs.forEach');
  const drivesGradient = text.includes('scroll-gradient-bg')
    && text.includes('scrollY')
    && text.includes('requestAnimationFrame');
  return (targetsBackdrop && drivesBackdrop) || drivesGradient;
}

export function stripRouteLocalMeshHtml(html, { preserveBackdropMarkup = false } = {}) {
  let next = String(html || '');

  next = next.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (full, attrs, css) => (
    isLegacyMeshStyle(attrs, css) ? '' : full
  ));
  next = next.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (full, attrs, code) => (
    isLegacyMeshScript(attrs, code) ? '' : full
  ));

  if (!preserveBackdropMarkup) {
    next = removeElementById(next, 'div', 'gooey-mesh-wrapper');
    next = next.replace(/^[ \t]*<div\b[^>]*\bid=(["'])scroll-gradient-bg\1[^>]*>[ \t\r\n]*<\/div>[ \t]*$/gim, '');
  }

  return next;
}

export function hasRouteLocalMeshOwnership(html) {
  const text = String(html || '');
  if (text.includes(`id="${LEGACY_STYLE_ID}"`) || text.includes(`id='${LEGACY_STYLE_ID}'`)) return true;
  if (text.includes(`id="${LEGACY_SCRIPT_ID}"`) || text.includes(`id='${LEGACY_SCRIPT_ID}'`)) return true;

  let found = false;
  text.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (full, attrs, css) => {
    if (isLegacyMeshStyle(attrs, css)) found = true;
    return full;
  });
  text.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (full, attrs, code) => {
    if (isLegacyMeshScript(attrs, code)) found = true;
    return full;
  });
  return found;
}
