import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from 'playwright/test';

test('entry template contains overview -> collections -> license sidebar order', async () => {
  const html = await readFile(path.resolve(process.cwd(), 'entry-template/index.html'), 'utf8');

  const overviewIdx = html.indexOf('<section class="dex-overview"></section>');
  const collectionsIdx = html.indexOf('<section class="dex-collections"></section>');
  const licenseIdx = html.indexOf('<section class="dex-license"></section>');

  expect(overviewIdx).toBeGreaterThan(-1);
  expect(collectionsIdx).toBeGreaterThan(-1);
  expect(licenseIdx).toBeGreaterThan(-1);
  expect(overviewIdx).toBeLessThan(collectionsIdx);
  expect(collectionsIdx).toBeLessThan(licenseIdx);
});

test('sidebar runtime and css expose download + credits contracts', async ({ page }) => {
  const runtimeRes = await page.request.get('/assets/dex-sidebar.js');
  expect(runtimeRes.ok()).toBeTruthy();
  const runtime = await runtimeRes.text();

  expect(runtime).toContain('buildDownloadRows');
  expect(runtime).toContain('getDownloadModalConfig');
  expect(runtime).toContain('Download selected');
  expect(runtime).toContain('data-person-linkable="true"');
  expect(runtime).toContain('bindEntryTooltips');
  expect(runtime).toContain("const COLLECTION_HEADING_CANONICAL = 'COL\\u200CLECTION'");
  expect(runtime).toContain('data-dx-entry-heading="1"');
  expect(runtime).toContain('data-dx-entry-rail-mode');
  expect(runtime).toContain('attachUnifiedDownload');
  expect(runtime).toContain('btn-download');
  expect(runtime).toContain('INTERACTIVE_HOVER_RUNTIME_PATH');
  expect(runtime).toContain('ensureInteractiveHoverRuntime(origin)');
  expect(runtime).toContain('ADD\\u200C TO BAG');
  expect(runtime).toContain('data-dx-bucket-tab');
  expect(runtime).toContain('dx-file-folder-stack');
  expect(runtime).toContain('dx-file-bucket-tabs');
  expect(runtime).toContain('dx-file-bucket-tab-label');
  expect(runtime).toContain('dx-file-tree-panel');
  expect(runtime).toContain('WHOLE FILES');
  expect(runtime).toContain("const BAG_ROUTE_PATH = '/entry/bag/'");
  expect(runtime).toContain('data-dx-download-kind="recording-index-pdf"');
  expect(runtime).toContain("delivery === 'multi'");
  expect(runtime).toContain('openDownloadDelivery');
  expect(runtime).toContain('recordingIndexPdfExportUrl');
  expect(runtime).toContain('[data-person-linkable="true"][data-person]');

  const cssRes = await page.request.get('/assets/css/dex.css');
  expect(cssRes.ok()).toBeTruthy();
  const css = await cssRes.text();
  expect(css).toContain('#dx-submit-tooltip-layer');
  expect(css).toContain('.dx-bucket-tile');
  expect(css).toContain('data-dx-entry-rail-mode');
  expect(css).toContain('.dex-sidebar #downloads .btn-recording-index');
  expect(css).toContain('body.dx-entry-page .dex-sidebar #downloads .btn-download');
  expect(css).toContain('body.dx-entry-page .dex-sidebar #downloads .btn-recording-index');
  const primaryBlock = css.match(/\.dex-sidebar\s+\.dex-license-controls\s+\.copy-btn,[\s\S]*?\.dex-sidebar\s+#downloads\s+\.btn-video\s*\{[\s\S]*?\}/i)?.[0] || '';
  expect(primaryBlock).not.toContain('btn-recording-index');
});
