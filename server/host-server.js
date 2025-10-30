#!/usr/bin/env node
/**
 * Lightweight Express server that serves the built React app and proxies API requests.
 * Intended for running the dashboard directly on a host without Cloudflare Pages.
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const compression = require('compression');

let fetchImpl = globalThis.fetch;
let HeadersImpl = globalThis.Headers;
let AbortControllerImpl = globalThis.AbortController;
if (typeof fetchImpl !== 'function') {
  try {
    const undici = require('undici');
    fetchImpl = undici.fetch;
    HeadersImpl = undici.Headers;
    AbortControllerImpl = undici.AbortController;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to load fetch implementation. Install Node.js 18+ or add undici.');
    process.exit(1);
  }
}

const fetch = (...args) => fetchImpl(...args);
const Headers = HeadersImpl;
const AbortController = AbortControllerImpl;

const PORT = Number.parseInt(process.env.PORT, 10) || 51823;
const BUILD_DIR = path.resolve(__dirname, '..', 'build');
const INDEX_HTML = path.join(BUILD_DIR, 'index.html');

const allowAllTargets = String(process.env.ALLOW_ALL_TARGETS || '').toLowerCase() === 'true';
const allowedHosts = new Set(
  String(process.env.ALLOWED_HOSTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);

function loadKnownHosts() {
  try {
    const configPath = path.resolve(__dirname, '..', 'public', 'servers.json');
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    const entries = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.servers) ? parsed.servers : [];
    for (const entry of entries) {
      const url = typeof entry === 'object' ? entry.url || entry.apiUrl : null;
      if (!url || typeof url !== 'string') continue;
      try {
        const target = new URL(url);
        allowedHosts.add(target.host);
      } catch {
        // ignore malformed urls
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Could not preload hosts from public/servers.json:', err.message);
  }
}

if (!allowAllTargets && allowedHosts.size === 0) {
  loadKnownHosts();
}

function corsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function proxyRequest(req, res) {
  if (req.method === 'OPTIONS') {
    corsHeaders(res);
    return res.sendStatus(204);
  }

  const target = req.query.target;
  if (!target) {
    return res.status(400).json({ error: 'Missing target query parameter.' });
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return res.status(400).json({ error: 'Invalid target URL.' });
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ error: 'Unsupported protocol.' });
  }

  const hostPort = parsed.host;
  if (!allowAllTargets && !allowedHosts.has(hostPort)) {
    return res.status(403).json({ error: 'Target not allowed.', host: hostPort });
  }

  const headers = new Headers();
  headers.set('Accept', req.get('Accept') || 'application/json');
  headers.set('User-Agent', 'oce-server-stalker-host-proxy');
  const forwardHost = req.query.host;
  if (forwardHost) {
    headers.set('Host', forwardHost);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const upstream = await fetch(parsed, {
      method: req.method,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    corsHeaders(res);
    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type') || 'application/json';
    res.setHeader('Content-Type', contentType);
    const cacheControl = upstream.headers.get('cache-control');
    if (cacheControl) {
      res.setHeader('Cache-Control', cacheControl);
    }

    const body = await upstream.arrayBuffer();
    return res.send(Buffer.from(body));
  } catch (err) {
    corsHeaders(res);
    return res.status(502).json({
      error: err instanceof Error ? err.message : 'Proxy error',
      target: parsed.toString(),
    });
  }
}

function ensureBuildExists() {
  if (!fs.existsSync(INDEX_HTML)) {
    // eslint-disable-next-line no-console
    console.error('Build output not found. Run `npm run build` before starting the host server.');
    process.exit(1);
  }
}

ensureBuildExists();

const app = express();
app.use(compression());
app.use(express.static(BUILD_DIR, { fallthrough: true, maxAge: '5m', index: false }));

app.all('/api', proxyRequest);

app.get('*', (req, res) => {
  res.sendFile(INDEX_HTML);
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server stalker dashboard available on port ${PORT}`);
});
