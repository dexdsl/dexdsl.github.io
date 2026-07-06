#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { chromium, devices } from 'playwright';

const ROOT = process.cwd();
const DEFAULT_ROUTES = ['/', '/catalog/', '/about/', '/open-access/'];
const BUDGETS = Object.freeze({
  fcp: 1_800,
  lcp: 2_500,
  tbt: 200,
  cls: 0.1,
});

function argValue(name, fallback = '') {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function numberValue(name, fallback) {
  const parsed = Number(argValue(name, String(fallback)));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeRoute(value) {
  const route = String(value || '').trim();
  if (!route) return '';
  return route.startsWith('/') ? route : `/${route}`;
}

function parseRoutes() {
  const configured = argValue('--routes', process.env.PERF_ROUTES || '');
  if (!configured) return DEFAULT_ROUTES;
  const routes = configured.split(',').map(normalizeRoute).filter(Boolean);
  return routes.length ? routes : DEFAULT_ROUTES;
}

async function waitForServer(baseUrl, timeoutMs = 15_000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(baseUrl, { redirect: 'manual' });
      if (response.status < 500) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${baseUrl}: ${lastError?.message || 'server unavailable'}`);
}

async function startLocalServer() {
  const port = numberValue('--port', Number(process.env.PERF_PORT) || 4174);
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(
    process.execPath,
    [path.join(ROOT, 'scripts', 'serve-docs.mjs'), '--host', '127.0.0.1', '--port', String(port)],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  child.on('exit', (code) => {
    if (code && stderr) process.stderr.write(stderr);
  });
  await waitForServer(baseUrl);
  return {
    baseUrl,
    stop: () => {
      if (!child.killed) child.kill('SIGTERM');
    },
  };
}

function metricState(value, budget, lowerIsBetter = true) {
  if (!Number.isFinite(value)) return 'missing';
  return lowerIsBetter ? (value <= budget ? 'pass' : 'fail') : (value >= budget ? 'pass' : 'fail');
}

function round(value, digits = 1) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function measureRoute(browser, baseUrl, route, options) {
  const device = devices['Pixel 5'];
  const context = await browser.newContext({
    ...device,
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.setCacheDisabled', { cacheDisabled: true });
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: options.latency,
    downloadThroughput: options.downloadThroughput,
    uploadThroughput: options.uploadThroughput,
    connectionType: 'cellular4g',
  });
  await client.send('Emulation.setCPUThrottlingRate', { rate: options.cpuThrottle });

  const requestFailures = [];
  const responseFailures = [];
  const consoleErrors = [];
  page.on('requestfailed', (request) => {
    requestFailures.push({
      url: request.url(),
      error: request.failure()?.errorText || 'request failed',
    });
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      responseFailures.push({ url: response.url(), status: response.status() });
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.addInitScript(() => {
    window.__dxPerf = {
      cls: 0,
      fcp: null,
      lcp: null,
      lcpElement: null,
      longTasks: [],
      layoutShifts: [],
    };
    const descriptor = (element) => {
      if (!(element instanceof Element)) return null;
      const className = typeof element.className === 'string'
        ? element.className.trim().split(/\s+/).slice(0, 4).join('.')
        : '';
      return {
        tag: element.tagName.toLowerCase(),
        id: element.id || '',
        className,
        text: String(element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
        url: element.currentSrc || element.src || '',
      };
    };
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.hadRecentInput) continue;
          window.__dxPerf.cls += entry.value;
          window.__dxPerf.layoutShifts.push({
            startTime: entry.startTime,
            value: entry.value,
            sources: Array.from(entry.sources || []).slice(0, 6).map((source) => ({
              node: descriptor(source.node),
              previousRect: source.previousRect
                ? {
                    x: source.previousRect.x,
                    y: source.previousRect.y,
                    width: source.previousRect.width,
                    height: source.previousRect.height,
                  }
                : null,
              currentRect: source.currentRect
                ? {
                    x: source.currentRect.x,
                    y: source.currentRect.y,
                    width: source.currentRect.width,
                    height: source.currentRect.height,
                  }
                : null,
            })),
          });
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {}
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') window.__dxPerf.fcp = entry.startTime;
        }
      }).observe({ type: 'paint', buffered: true });
    } catch {}
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const entry = entries[entries.length - 1];
        if (!entry) return;
        window.__dxPerf.lcp = entry.startTime;
        window.__dxPerf.lcpElement = descriptor(entry.element);
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {}
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__dxPerf.longTasks.push({
            startTime: entry.startTime,
            duration: entry.duration,
          });
        }
      }).observe({ type: 'longtask', buffered: true });
    } catch {}
  });

  const startedAt = Date.now();
  let navigationError = '';
  try {
    await page.goto(new URL(route, baseUrl).href, {
      waitUntil: 'domcontentloaded',
      timeout: options.navigationTimeout,
    });
  } catch (error) {
    navigationError = error instanceof Error ? error.message : String(error);
  }
  await page.waitForTimeout(options.settleMs);

  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');
    const perf = window.__dxPerf || {};
    const longTasks = Array.isArray(perf.longTasks) ? perf.longTasks : [];
    const layoutShifts = Array.isArray(perf.layoutShifts) ? perf.layoutShifts : [];
    const tbt = longTasks.reduce((total, task) => total + Math.max(0, Number(task.duration || 0) - 50), 0);
    const transferSize = resources.reduce((total, resource) => total + Number(resource.transferSize || 0), 0);
    const decodedSize = resources.reduce((total, resource) => total + Number(resource.decodedBodySize || 0), 0);
    const largestResources = resources
      .map((resource) => ({
        url: resource.name,
        duration: resource.duration,
        transferSize: resource.transferSize,
        decodedBodySize: resource.decodedBodySize,
        initiatorType: resource.initiatorType,
      }))
      .sort((left, right) => right.transferSize - left.transferSize)
      .slice(0, 8);
    return {
      url: location.href,
      title: document.title,
      status: document.readyState,
      fcp: perf.fcp,
      lcp: perf.lcp,
      lcpElement: perf.lcpElement,
      cls: perf.cls,
      layoutShifts: layoutShifts
        .sort((left, right) => Number(right.value || 0) - Number(left.value || 0))
        .slice(0, 10),
      tbt,
      longTaskCount: longTasks.length,
      longestTask: longTasks.reduce((longest, task) => Math.max(longest, Number(task.duration || 0)), 0),
      domContentLoaded: navigation?.domContentLoadedEventEnd || null,
      load: navigation?.loadEventEnd || null,
      transferSize,
      decodedSize,
      resourceCount: resources.length,
      domNodes: document.getElementsByTagName('*').length,
      scripts: document.scripts.length,
      images: document.images.length,
      iframes: document.querySelectorAll('iframe').length,
      canvases: document.querySelectorAll('canvas').length,
      grainState: document.querySelector('#gooey-mesh-wrapper')?.getAttribute('data-dx-grain') || '',
      meshMotion: document.querySelector('#gooey-mesh-wrapper')?.getAttribute('data-dx-gooey-motion') || '',
      largestResources,
    };
  }).catch((error) => ({
    evaluationError: error instanceof Error ? error.message : String(error),
  }));

  await context.close();
  return {
    route,
    elapsedMs: Date.now() - startedAt,
    navigationError,
    metrics: {
      ...metrics,
      fcp: round(metrics.fcp),
      lcp: round(metrics.lcp),
      cls: round(metrics.cls, 3),
      tbt: round(metrics.tbt),
      longestTask: round(metrics.longestTask),
      domContentLoaded: round(metrics.domContentLoaded),
      load: round(metrics.load),
      transferSize: Number(metrics.transferSize || 0),
      decodedSize: Number(metrics.decodedSize || 0),
    },
    errors: {
      requestFailures,
      responseFailures,
      consoleErrors,
    },
    budget: {
      fcp: metricState(metrics.fcp, BUDGETS.fcp),
      lcp: metricState(metrics.lcp, BUDGETS.lcp),
      tbt: metricState(metrics.tbt, BUDGETS.tbt),
      cls: metricState(metrics.cls, BUDGETS.cls),
    },
  };
}

async function main() {
  const enforce = process.argv.includes('--enforce');
  const outputPath = path.resolve(argValue(
    '--output',
    process.env.PERF_OUTPUT || path.join(os.tmpdir(), 'dex-mobile-performance.json'),
  ));
  const externalBaseUrl = argValue('--base-url', process.env.PERF_BASE_URL || '').replace(/\/+$/, '');
  const localServer = externalBaseUrl ? null : await startLocalServer();
  const baseUrl = externalBaseUrl || localServer.baseUrl;
  if (externalBaseUrl) await waitForServer(baseUrl);

  const options = {
    cpuThrottle: numberValue('--cpu-throttle', 4),
    latency: numberValue('--latency', 150),
    downloadThroughput: numberValue('--download', 1_638_400 / 8),
    uploadThroughput: numberValue('--upload', 750_000 / 8),
    settleMs: numberValue('--settle', 8_000),
    navigationTimeout: numberValue('--timeout', 45_000),
  };

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const results = [];
    for (const route of parseRoutes()) {
      process.stdout.write(`Measuring ${route} ... `);
      const result = await measureRoute(browser, baseUrl, route, options);
      results.push(result);
      const metric = result.metrics;
      console.log(`FCP ${metric.fcp ?? 'n/a'}ms | LCP ${metric.lcp ?? 'n/a'}ms | TBT ${metric.tbt ?? 'n/a'}ms | CLS ${metric.cls ?? 'n/a'}`);
    }

    const report = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      profile: {
        viewport: '390x844',
        device: 'Pixel 5',
        cache: 'cold',
        ...options,
      },
      budgets: BUDGETS,
      results,
    };
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`Mobile performance report: ${outputPath}`);

    const failures = results.flatMap((result) => (
      Object.entries(result.budget)
        .filter(([, state]) => state !== 'pass')
        .map(([metric, state]) => `${result.route} ${metric} ${state}`)
    ));
    if (failures.length) {
      console.log(`Release budget: ${failures.length} failure(s)`);
      for (const failure of failures) console.log(`- ${failure}`);
      if (enforce) process.exitCode = 1;
    } else {
      console.log('Release budget: passed');
    }
  } finally {
    await browser?.close();
    localServer?.stop();
  }
}

main().catch((error) => {
  console.error(`perf:mobile failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
