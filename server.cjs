const http = require('http');
const https = require('https');
const os = require('os');
const { execSync } = require('child_process');
const { URL } = require('url');

const PORT = 9123;
const ROUTER_HOST = '127.0.0.1';
const ROUTER_PORT = 20128;
const ROUTER_PASSWORD = 'Rizki12345';

// ── Auth token cache ──
let authToken = null;
let tokenExpiresAt = 0;

async function authenticateRouter() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ password: ROUTER_PASSWORD });
    const req = http.request({
      hostname: ROUTER_HOST,
      port: ROUTER_PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const setCookie = res.headers['set-cookie'];
          if (setCookie) {
            const match = setCookie[0]?.match(/auth_token=([^;]+)/);
            if (match) {
              authToken = match[1];
              tokenExpiresAt = Date.now() + 23 * 3600 * 1000; // refresh at 23h (JWT expires at 24h)
              console.log('[router-auth] Token acquired');
              return resolve(authToken);
            }
          }
        }
        console.error('[router-auth] Failed:', res.statusCode, data);
        reject(new Error('Auth failed'));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function getRouterToken() {
  if (authToken && Date.now() < tokenExpiresAt) return authToken;
  try {
    return await authenticateRouter();
  } catch (e) {
    console.error('[router-auth] Error:', e.message);
    return null;
  }
}

// ── System stats ──
function getSystem() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  let cpuUsage = '0.0';
  try {
    const load = os.loadavg();
    cpuUsage = ((load[0] / cpus.length) * 100).toFixed(1);
    if (parseFloat(cpuUsage) > 100) cpuUsage = '100.0';
  } catch {}
  let disk = { total: 0, used: 0, available: 0, pct: '0.0' };
  try {
    const df = execSync("df -B1 / | tail -1", { encoding: 'utf8' }).trim().split(/\s+/);
    disk = {
      total: parseInt(df[1]), used: parseInt(df[2]), available: parseInt(df[3]),
      pct: ((parseInt(df[2]) / parseInt(df[1])) * 100).toFixed(1),
    };
  } catch {}
  return {
    cpu: { cores: cpus.length, usage: cpuUsage, model: cpus[0]?.model || 'Unknown' },
    memory: { total: totalMem, used: usedMem, free: freeMem, pct: ((usedMem / totalMem) * 100).toFixed(1) },
    disk, uptime: os.uptime(), hostname: os.hostname(),
  };
}

// ── Tools ──
const tools = [
  { id: 'transform', name: 'Text Transform', icon: 'Aa', description: 'Uppercase, lowercase, reverse, slug.', placeholder: 'Enter text...', options: [
    { label: 'Uppercase', value: 'upper' }, { label: 'Lowercase', value: 'lower' },
    { label: 'Reverse', value: 'reverse' }, { label: 'Slug', value: 'slug' },
    { label: 'Base64 Encode', value: 'b64encode' }, { label: 'Base64 Decode', value: 'b64decode' },
  ]},
  { id: 'format-json', name: 'JSON Formatter', icon: '{ }', description: 'Prettify or minify JSON.', placeholder: 'Paste JSON...', options: [
    { label: 'Prettify', value: 'prettify' }, { label: 'Minify', value: 'minify' },
  ]},
  { id: 'strip-text', name: 'Extract Fields', icon: '|x|', description: 'Split & extract fields by delimiter.', placeholder: 'Paste text...', hasDelimiter: true },
];

function runTool(id, text, mode) {
  switch (id) {
    case 'transform':
      switch (mode) {
        case 'upper': return text.toUpperCase();
        case 'lower': return text.toLowerCase();
        case 'reverse': return text.split('').reverse().join('');
        case 'slug': return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        case 'b64encode': return Buffer.from(text).toString('base64');
        case 'b64decode': return Buffer.from(text, 'base64').toString('utf8');
        default: return text.toUpperCase();
      }
    case 'format-json':
      try {
        const obj = JSON.parse(text);
        return mode === 'minify' ? JSON.stringify(obj) : JSON.stringify(obj, null, 2);
      } catch { return 'Error: Invalid JSON'; }
    default: return 'Unknown tool';
  }
}

// ── 9Router proxy ──
function rewriteHtml(body, reqHost) {
  // Rewrite paths in HTML so Next.js assets resolve through our proxy
  return body
    .replace(/"\/_next\//g, '"/9router/_next/')
    .replace(/'\/_next\//g, "'/9router/_next/")
    .replace(/href="\/(?!9router|_next|api)/g, 'href="/9router/')
    .replace(/src="\/(?!9router|_next|api)/g, 'src="/9router/')
    .replace(/action="\/(?!9router|_next|api)/g, 'action="/9router/');
}

function proxyToRouter(clientReq, clientRes, token) {
  const targetPath = clientReq.url.replace(/^\/9router/, '') || '/';
  const isHtml = clientReq.headers.accept?.includes('text/html');

  // Forward body for POST/PUT
  const chunks = [];
  clientReq.on('data', c => chunks.push(c));
  clientReq.on('end', () => {
    const bodyBuf = chunks.length ? Buffer.concat(chunks) : null;

    const headers = {
      ...clientReq.headers,
      host: `${ROUTER_HOST}:${ROUTER_PORT}`,
      'x-forwarded-for': clientReq.socket.remoteAddress,
      'x-forwarded-proto': 'http',
    };
    // Remove proxy-specific headers
    delete headers['accept-encoding']; // let us handle encoding

    // Inject auth cookie
    if (token) {
      const existing = headers.cookie || '';
      headers.cookie = existing ? `${existing}; auth_token=${token}` : `auth_token=${token}`;
    }

    if (bodyBuf) {
      headers['content-length'] = Buffer.byteLength(bodyBuf);
    }

    const proxyReq = http.request({
      hostname: ROUTER_HOST,
      port: ROUTER_PORT,
      path: targetPath,
      method: clientReq.method,
      headers,
    }, (proxyRes) => {
      // Rewrite redirects
      let location = proxyRes.headers.location;
      if (location) {
        location = location.replace(/^https?:\/\/[^/]+/, '');
        if (location.startsWith('/') && !location.startsWith('/9router/')) {
          location = '/9router' + location;
        }
        proxyRes.headers.location = location;
      }

      // Rewrite set-cookie path
      if (proxyRes.headers['set-cookie']) {
        proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map(c =>
          c.replace(/Path=\//gi, 'Path=/9router/')
        );
      }

      const contentType = proxyRes.headers['content-type'] || '';
      const isTextHtml = contentType.includes('text/html');

      if (isTextHtml) {
        // Buffer HTML for rewriting
        const htmlChunks = [];
        proxyRes.on('data', c => htmlChunks.push(c));
        proxyRes.on('end', () => {
          let html = Buffer.concat(htmlChunks).toString('utf8');
          html = rewriteHtml(html, clientReq.headers.host);
          const buf = Buffer.from(html);
          delete proxyRes.headers['content-length'];
          delete proxyRes.headers['content-encoding'];
          proxyRes.headers['content-length'] = buf.length;
          clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
          clientRes.end(buf);
        });
      } else {
        // Stream non-HTML responses directly
        clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(clientRes);
      }
    });

    proxyReq.on('error', (e) => {
      console.error('[router-proxy] Error:', e.message);
      if (!clientRes.headersSent) {
        clientRes.writeHead(502);
        clientRes.end(JSON.stringify({ error: 'Proxy error' }));
      }
    });

    if (bodyBuf) proxyReq.write(bodyBuf);
    proxyReq.end();
  });
}

// ── Server ──
const server = http.createServer(async (req, res) => {
  // API endpoints
  if (req.url === '/api/health') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    return res.end(JSON.stringify({ success: true, status: 'healthy', timestamp: new Date().toISOString() }));
  }

  if (req.url === '/api/system') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    return res.end(JSON.stringify(getSystem()));
  }

  if (req.url === '/api/tools') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    return res.end(JSON.stringify({ tools }));
  }

  const toolMatch = req.url?.match(/^\/api\/tools\/(.+)$/);
  if (toolMatch && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { text, mode } = JSON.parse(body);
        const result = runTool(toolMatch[1], text, mode);
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({ result }));
      } catch (e) {
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });
    return;
  }

  // 9Router proxy
  if (req.url === '/9router' || req.url?.startsWith('/9router/')) {
    try {
      const token = await getRouterToken();
      if (!token) {
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(502);
        return res.end(JSON.stringify({ error: 'Failed to authenticate with 9router' }));
      }
      return proxyToRouter(req, res, token);
    } catch (e) {
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(502);
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  // 404
  res.setHeader('Content-Type', 'application/json');
  res.writeHead(404);
  res.end(JSON.stringify({ success: false, message: 'Endpoint not found' }));
});

server.listen(PORT, '127.0.0.1', async () => {
  console.log(`MiniApp API listening on 127.0.0.1:${PORT}`);
  // Pre-authenticate with 9router
  try {
    await authenticateRouter();
    console.log('[router-auth] Pre-authenticated successfully');
  } catch (e) {
    console.error('[router-auth] Pre-auth failed:', e.message);
  }
});
