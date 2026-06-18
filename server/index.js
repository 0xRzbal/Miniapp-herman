import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { createProxyMiddleware } from 'http-proxy-middleware';
import os from 'os';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 9122;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const JOEMAIL_URL = process.env.JOEMAIL_URL || 'http://localhost:8880';

app.use(compression({ level: 6, threshold: 128 }));
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '1mb' }));

// ── Settings Storage ────────────────────────────────────────
const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'settings.json');

function loadSettings() {
  try {
    if (existsSync(SETTINGS_FILE)) {
      return JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8'));
    }
  } catch {}
  return { miniapp_only: { hub: false, mail: false, router: false } };
}

function saveSettings(settings) {
  try {
    const dir = path.dirname(SETTINGS_FILE);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    return true;
  } catch { return false; }
}

let appSettings = loadSettings();

// ── Tools Registry ──────────────────────────────────────────
const tools = [];
const toolHandlers = {};

function registerTool(config, handler) {
  // Avoid duplicates on hot reload
  if (!tools.find(t => t.id === config.id)) {
    tools.push(config);
  }
  toolHandlers[config.id] = handler;
}

// ── Built-in Tools ──────────────────────────────────────────

registerTool({
  id: 'transform',
  name: 'Text Transform',
  icon: 'Aa',
  description: 'Transform, convert, encode text.',
  placeholder: 'Enter text to transform...',
  options: [
    { label: 'UPPERCASE', value: 'upper' },
    { label: 'lowercase', value: 'lower' },
    { label: 'Title Case', value: 'title' },
    { label: 'Sentence case', value: 'sentence' },
    { label: 'camelCase', value: 'camel' },
    { label: 'snake_case', value: 'snake' },
    { label: 'kebab-case', value: 'kebab' },
    { label: 'Reverse', value: 'reverse' },
    { label: 'Base64 Encode', value: 'b64enc' },
    { label: 'Base64 Decode', value: 'b64dec' },
    { label: 'URL Encode', value: 'urlencode' },
    { label: 'URL Decode', value: 'urldecode' },
    { label: 'Trim Lines', value: 'trim' },
    { label: 'Remove Duplicates', value: 'dedup' },
    { label: 'Sort Lines', value: 'sort' },
    { label: 'Reverse Lines', value: 'revlines' },
    { label: 'Word Count', value: 'wordcount' },
    { label: 'Char Count', value: 'charcount' },
  ],
}, (body) => {
  const { text, mode } = body;
  if (typeof text !== 'string') throw new Error('text is required');
  const lines = text.split(/\r?\n/);
  switch (mode) {
    case 'lower': return text.toLowerCase();
    case 'title': return text.replace(/\b\w/g, c => c.toUpperCase());
    case 'sentence': return text.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, c => c.toUpperCase());
    case 'camel': return text.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase()).replace(/^[A-Z]/, c => c.toLowerCase());
    case 'snake': return text.trim().toLowerCase().replace(/[\s\-]+/g, '_').replace(/[^a-z0-9_]/g, '');
    case 'kebab': return text.trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9\-]/g, '');
    case 'reverse': return text.split('').reverse().join('');
    case 'b64enc': return Buffer.from(text, 'utf-8').toString('base64');
    case 'b64dec': return Buffer.from(text, 'base64').toString('utf-8');
    case 'urlencode': return encodeURIComponent(text);
    case 'urldecode': return decodeURIComponent(text);
    case 'trim': return lines.map(l => l.trim()).filter(l => l.length > 0).join('\n');
    case 'dedup': return [...new Set(lines)].join('\n');
    case 'sort': return lines.sort().join('\n');
    case 'revlines': return lines.reverse().join('\n');
    case 'wordcount': {
      const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
      const chars = text.length;
      const lineCount = lines.length;
      return `${words} words | ${chars} chars | ${lineCount} lines`;
    }
    case 'charcount': {
      const noSpace = text.replace(/\s/g, '').length;
      return `${text.length} total | ${noSpace} no-space | ${new Set(text).size} unique chars`;
    }
    default: return text.toUpperCase();
  }
});

registerTool({
  id: 'format-json',
  name: 'JSON Tools',
  icon: '{ }',
  description: 'Format, validate, convert JSON.',
  placeholder: 'Paste JSON here...',
  options: [
    { label: 'Prettify', value: 'prettify' },
    { label: 'Minify', value: 'minify' },
    { label: 'Validate', value: 'validate' },
    { label: 'Sort Keys', value: 'sortkeys' },
    { label: 'Escape', value: 'escape' },
    { label: 'Unescape', value: 'unescape' },
    { label: 'Keys Only', value: 'keys' },
    { label: 'Values Only', value: 'values' },
    { label: 'Flatten', value: 'flatten' },
    { label: 'Line Count', value: 'linecount' },
  ],
}, (body) => {
  const { text, mode } = body;
  if (typeof text !== 'string') throw new Error('text is required');
  switch (mode) {
    case 'prettify': return JSON.stringify(JSON.parse(text), null, 2);
    case 'minify': return JSON.stringify(JSON.parse(text));
    case 'validate': {
      const parsed = JSON.parse(text);
      const type = Array.isArray(parsed) ? 'array' : typeof parsed;
      const keys = typeof parsed === 'object' && parsed !== null ? Object.keys(parsed).length : 0;
      return `Valid JSON (${type}${keys ? `, ${keys} keys` : ''})`;
    }
    case 'sortkeys': {
      const sort = (obj) => {
        if (Array.isArray(obj)) return obj.map(sort);
        if (obj && typeof obj === 'object') return Object.keys(obj).sort().reduce((acc, k) => { acc[k] = sort(obj[k]); return acc; }, {});
        return obj;
      };
      return JSON.stringify(sort(JSON.parse(text)), null, 2);
    }
    case 'escape': return JSON.stringify(text);
    case 'unescape': return JSON.parse(text);
    case 'keys': {
      const obj = JSON.parse(text);
      if (Array.isArray(obj)) return obj.map((_, i) => i).join('\n');
      return Object.keys(obj).join('\n');
    }
    case 'values': {
      const obj = JSON.parse(text);
      if (Array.isArray(obj)) return obj.map(v => typeof v === 'string' ? v : JSON.stringify(v)).join('\n');
      return Object.values(obj).map(v => typeof v === 'string' ? v : JSON.stringify(v)).join('\n');
    }
    case 'flatten': {
      const flat = (obj, prefix = '') => {
        const result = {};
        for (const [k, v] of Object.entries(obj)) {
          const key = prefix ? `${prefix}.${k}` : k;
          if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(result, flat(v, key));
          else result[key] = v;
        }
        return result;
      };
      return JSON.stringify(flat(JSON.parse(text)), null, 2);
    }
    case 'linecount': {
      const parsed = JSON.parse(text);
      const pretty = JSON.stringify(parsed, null, 2);
      const keys = typeof parsed === 'object' && parsed !== null ? Object.keys(parsed).length : 0;
      return `${pretty.split('\n').length} lines | ${text.length} chars | ${keys} top-level keys`;
    }
    default: return JSON.stringify(JSON.parse(text), null, 2);
  }
});

registerTool({
  id: 'strip-text',
  name: 'Extract Fields',
  icon: '|x|',
  description: 'Split, extract, regex match from text.',
  placeholder: 'Paste text here...',
  hasDelimiter: true,
  options: [
    { label: 'Split & Extract', value: 'default' },
    { label: 'Extract Emails', value: 'emails' },
    { label: 'Extract URLs', value: 'urls' },
    { label: 'Extract IPs', value: 'ips' },
    { label: 'Extract Numbers', value: 'numbers' },
    { label: 'Digits Only', value: 'digits' },
    { label: 'Letters Only', value: 'letters' },
    { label: 'Alphanumeric', value: 'alphanum' },
    { label: 'Remove Empty Lines', value: 'lines' },
    { label: 'Deduplicate Lines', value: 'dedup' },
    { label: 'Sort Lines', value: 'sort' },
    { label: 'Line Numbers', value: 'linenum' },
  ],
}, (body) => {
  const { text, mode } = body;
  if (typeof text !== 'string') throw new Error('text is required');
  const lines = text.split(/\r?\n/);
  switch (mode) {
    case 'emails': return (text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || []).join('\n');
    case 'urls': return (text.match(/https?:\/\/[^\s<>"'\]]+/g) || []).join('\n');
    case 'ips': return (text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || []).join('\n');
    case 'numbers': return (text.match(/-?\d+\.?\d*/g) || []).join('\n');
    case 'digits': return text.replace(/[^0-9]/g, '');
    case 'letters': return text.replace(/[^a-zA-Z]/g, '');
    case 'alphanum': return text.replace(/[^a-zA-Z0-9]/g, '');
    case 'lines': return lines.filter(l => l.trim()).join('\n');
    case 'dedup': return [...new Set(lines)].join('\n');
    case 'sort': return lines.sort().join('\n');
    case 'linenum': return lines.map((l, i) => `${i + 1}: ${l}`).join('\n');
    default: return text.replace(/\s+/g, ' ').trim();
  }
});

// ── Dynamic Tool Loader ─────────────────────────────────────
// Drop .js files into /opt/hermes-miniapp-tools/ to auto-register
// Each file exports: { config: {id, name, ...}, handler: (body) => result }
const TOOLS_DIR = '/opt/hermes-miniapp-tools';

async function loadExternalTools() {
  try {
    const { readdirSync, statSync } = await import('fs');
    if (!statSync(TOOLS_DIR, { throwIfNoEntry: false })) return;
    const files = readdirSync(TOOLS_DIR).filter(f => f.endsWith('.js'));
    for (const file of files) {
      try {
        const mod = await import(path.join(TOOLS_DIR, file));
        const { config, handler } = mod.default || mod;
        if (config?.id && typeof handler === 'function') {
          registerTool(config, handler);
          console.log(`  + tool: ${config.id} (${file})`);
        }
      } catch (err) {
        console.error(`  x failed to load tool ${file}:`, err.message);
      }
    }
  } catch {}
}

await loadExternalTools();

// ── API Routes ──────────────────────────────────────────────

// Tools registry endpoint
app.get('/api/tools', (_req, res) => {
  res.json({ tools: tools.map(({ id, name, icon, description, placeholder, options, hasDelimiter }) => ({
    id, name, icon, description, placeholder, options, hasDelimiter,
  })) });
});

// Generic tool execution
app.post('/api/tools/:id', (req, res) => {
  const handler = toolHandlers[req.params.id];
  if (!handler) return res.status(404).json({ error: `Tool '${req.params.id}' not found` });
  try {
    const result = handler(req.body);
    res.json({ result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), tools: tools.length });
});

// ── Settings API ────────────────────────────────────────────
app.get('/api/settings', (_req, res) => {
  res.json(appSettings);
});

app.post('/api/settings', (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'key is required' });
  appSettings[key] = value;
  if (saveSettings(appSettings)) {
    res.json({ ok: true, settings: appSettings });
  } else {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// ── Auth endpoint for nginx auth_request ─────────────────────
// Used by 9router.rzbal.xyz (and others) to enforce miniapp_only access
const ALLOWED_REFERER = 'miniapp-herman-bot.rzbal.xyz';
const AUTH_BYPASS_TOKEN = process.env.AUTH_BYPASS_TOKEN || 'miniapp-internal-2026';
import { createHmac, randomBytes } from 'crypto';

// Generate a rotating session token (changes every hour)
let sessionToken = randomBytes(32).toString('hex');
let sessionTokenTs = Date.now();
function getSessionToken() {
  if (Date.now() - sessionTokenTs > 3600000) {
    sessionToken = randomBytes(32).toString('hex');
    sessionTokenTs = Date.now();
  }
  return sessionToken;
}

app.get('/api/auth-token', (req, res) => {
  const service = req.query.service;
  const mo = appSettings.miniapp_only;
  // If service specified, check per-service; otherwise check if any service is locked
  if (service && typeof mo === 'object') {
    if (!mo[service]) return res.json({ token: null });
  } else if (typeof mo === 'object') {
    if (!Object.values(mo).some(Boolean)) return res.json({ token: null });
  } else if (!mo) {
    return res.json({ token: null });
  }
  return res.json({ token: getSessionToken() });
});

// Router auth entry: validate token → set cookie → redirect to 9router
const COOKIE_NAME = '_rauth';
app.get('/internal/router-auth', (req, res) => {
  const token = req.query.t || '';
  const target = req.query.redirect || '/';

  // Validate token — check router-specific miniapp_only
  const mo = appSettings.miniapp_only;
  const routerLocked = typeof mo === 'object' ? !!mo.router : !!mo;
  if (!routerLocked || token === sessionToken) {
    // Set cookie on .rzbal.xyz (shared across subdomains)
    const cookie = `${COOKIE_NAME}=${sessionToken}; Domain=.rzbal.xyz; Path=/; SameSite=None; Secure; Max-Age=3600`;
    res.setHeader('Set-Cookie', cookie);
    return res.redirect(302, `https://9router.rzbal.xyz${target}`);
  }

  return res.status(403).send('Unauthorized');
});

app.get('/internal/auth', (req, res) => {
  // Determine which service is being accessed
  const service = req.query.service || req.headers['x-auth-service'] || '';
  const mo = appSettings.miniapp_only;

  // Check per-service or global miniapp_only
  let isLocked = false;
  if (service && typeof mo === 'object') {
    isLocked = !!mo[service];
  } else if (typeof mo === 'object') {
    isLocked = Object.values(mo).some(Boolean);
  } else {
    isLocked = !!mo;
  }

  // Always allow if not locked
  if (!isLocked) return res.status(200).end();

  // Allow bypass from internal proxy
  const bypass = req.headers['x-auth-bypass'] || '';
  if (bypass === AUTH_BYPASS_TOKEN) return res.status(200).end();

  // Allow if valid session token in header or original URI query param
  const token = req.headers['x-auth-token'] || '';
  const originalUri = req.headers['x-original-uri'] || '';
  const tokenFromUri = new URL(originalUri, 'http://localhost').searchParams.get('t') || '';
  const validToken = token || tokenFromUri;
  if (validToken && validToken === sessionToken) return res.status(200).end();

  // Allow if valid session cookie
  const cookie = req.headers.cookie || '';
  const cookieMatch = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (cookieMatch && cookieMatch[1] === sessionToken) return res.status(200).end();

  // Check Referer: must come from the miniapp
  const referer = req.headers.referer || req.headers.origin || '';
  if (referer.includes(ALLOWED_REFERER)) return res.status(200).end();

  return res.status(403).end();
});

// System stats
app.get('/api/system', (_req, res) => {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  let totalIdle = 0, totalTick = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }
  const cpuPct = totalTick > 0 ? ((1 - totalIdle / totalTick) * 100).toFixed(1) : '0.0';

  let disk = { total: 0, used: 0, available: 0, pct: '0.0' };
  try {
    const df = execSync('df -B1 / | tail -1', { encoding: 'utf-8' }).trim().split(/\s+/);
    disk = {
      total: parseInt(df[1]) || 0,
      used: parseInt(df[2]) || 0,
      available: parseInt(df[3]) || 0,
      pct: (df[4] || '0%').replace('%', ''),
    };
  } catch {}

  res.json({
    cpu: { cores: cpus.length, usage: cpuPct, model: cpus[0]?.model || 'Unknown' },
    memory: { total: totalMem, used: usedMem, free: freeMem, pct: ((usedMem / totalMem) * 100).toFixed(1) },
    disk,
    uptime: process.uptime(),
    hostname: os.hostname(),
  });
});

// ── JoeMail Proxy ───────────────────────────────────────────

const mailProxy = createProxyMiddleware({
  target: JOEMAIL_URL,
  changeOrigin: true,
  pathRewrite: { '^/mail': '' },
  ws: true,
  selfHandleResponse: true,
  on: {
    proxyRes: (proxyRes, req, res) => {
      const contentType = proxyRes.headers['content-type'] || '';
      const isHtml = contentType.includes('text/html');
      const isJs = contentType.includes('javascript') || contentType.includes('application/js');

      if (!isHtml && !isJs) {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
        return;
      }

      let body = [];
      proxyRes.on('data', (chunk) => body.push(chunk));
      proxyRes.on('end', () => {
        let text = Buffer.concat(body).toString('utf-8');

        if (isHtml) {
          text = text.replace(/(src|href)=\"\/(?!mail\/|https?:\/\/)([^\"]*)\"/g, '$1=\"/mail/$2\"');
          text = text.replace(/action=\"\/(?!mail\/|https?:\/\/)([^\"]*)\"/g, 'action=\"/mail/$1\"');
          text = text.replace(/url\((?!mail\/|https?:\/\/)([^)]*)\)/g, 'url(/mail/$1)');
        }

        if (isJs) {
          text = text.replace(/API_BASE\s*=\s*'\/api'/g, "API_BASE = '/mail/api'");
          text = text.replace(/API_BASE\s*=\s*"\/api"/g, 'API_BASE = "/mail/api"');
          text = text.replace(/fetch\('\/api\//g, "fetch('/mail/api/");
          text = text.replace(/fetch\("\/api\//g, 'fetch("/mail/api/');
          text = text.replace(/window\.location\s*=\s*'\//g, "window.location = '/mail/'");
          text = text.replace(/window\.location\s*=\s*"\//g, 'window.location = "/mail/"');
        }

        const headers = { ...proxyRes.headers };
        headers['content-length'] = Buffer.byteLength(text);
        delete headers['content-security-policy'];
        delete headers['x-frame-options'];

        // No-cache for HTML to prevent Telegram WebView stale content
        if (isHtml) {
          headers['cache-control'] = 'no-cache, no-store, must-revalidate';
          headers['pragma'] = 'no-cache';
          headers['expires'] = '0';
        }

        res.writeHead(proxyRes.statusCode, headers);
        res.end(text);
      });
    },
  },
});

// ── Mail access guard (per-service miniapp_only) ─────────────
app.use('/mail', (req, res, next) => {
  const mo = appSettings.miniapp_only;
  const mailLocked = typeof mo === 'object' ? !!mo.mail : !!mo;
  if (!mailLocked) return next();

  // Allow if from Telegram MiniApp (check referer/origin)
  const referer = req.headers.referer || req.headers.origin || '';
  if (referer.includes(ALLOWED_REFERER)) return next();

  // Allow if valid session cookie
  const cookie = req.headers.cookie || '';
  const cookieMatch = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (cookieMatch && cookieMatch[1] === sessionToken) return next();

  // Allow bypass from internal proxy
  const bypass = req.headers['x-auth-bypass'] || '';
  if (bypass === AUTH_BYPASS_TOKEN) return next();

  return res.status(403).send('Access restricted to Telegram Mini App');
}, mailProxy);

// ── Static Files
app.use(express.static(path.join(__dirname, '..', 'dist'), {
  maxAge: '1y',
  immutable: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Expires', '0');
    }
    // Preload hints for critical assets
    if (filePath.endsWith('.js')) {
      res.setHeader('Link', `</${path.basename(filePath)}>; rel=preload; as=script`);
    }
    if (filePath.endsWith('.css')) {
      res.setHeader('Link', `</${path.basename(filePath)}>; rel=preload; as=style`);
    }
  },
}));

// SPA fallback
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`rzbal Hub running on http://localhost:${PORT}`);
  console.log(`JoeMail proxy: /mail → ${JOEMAIL_URL}`);
  console.log(`Tools loaded: ${tools.length} (${tools.map(t => t.id).join(', ')})`);
  console.log(`External tools dir: ${TOOLS_DIR}`);
});

