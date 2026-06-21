#!/usr/bin/env node
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
const DOCS_DIR = path.join(ROOT, 'docs');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function argValue(name, fallback = '') {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function contentTypeFor(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function safePathFor(urlPath) {
  let decoded = '/';
  try {
    decoded = decodeURIComponent(String(urlPath || '/'));
  } catch {
    decoded = '/';
  }
  const clean = decoded.replace(/\\/g, '/').replace(/^\/+/, '');
  const candidate = path.resolve(DOCS_DIR, clean);
  const relative = path.relative(DOCS_DIR, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return candidate;
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function resolveFile(urlPath) {
  const exact = safePathFor(urlPath);
  if (!exact) return null;
  const candidates = [];
  if (String(urlPath || '').endsWith('/')) {
    candidates.push(path.join(exact, 'index.html'));
  } else {
    candidates.push(exact);
    if (!path.extname(exact)) candidates.push(path.join(exact, 'index.html'));
  }
  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }
  return null;
}

async function sendFile(res, status, filePath) {
  const body = await fs.readFile(filePath);
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': contentTypeFor(filePath),
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

const host = argValue('--host', process.env.HOST || '127.0.0.1');
const port = Number(argValue('--port', process.env.PORT || '8080')) || 8080;
const notFoundPath = path.join(DOCS_DIR, '404.html');

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || `${host}:${port}`}`);
    const filePath = await resolveFile(url.pathname);
    if (filePath) {
      await sendFile(res, 200, filePath);
      return;
    }
    if (await fileExists(notFoundPath)) {
      await sendFile(res, 404, notFoundPath);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(error instanceof Error ? error.message : String(error));
  }
});

server.listen(port, host, () => {
  console.log(`Dex docs server running at http://${host}:${port}/`);
});
