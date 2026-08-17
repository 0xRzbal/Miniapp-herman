import express from 'express';
import path from 'path';
import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { execSync, spawn } from 'child_process';
import { randomBytes } from 'crypto';

const router = express.Router();
const TOOLS_BASE = '/opt/hermes-miniapp-tools';
const JOBS_FILE = path.join(TOOLS_BASE, '.jobs.json');
const ACCOUNTS_FILE = path.join(TOOLS_BASE, '.accounts.json');

// ── Helpers ──────────────────────────────────────────────────

function loadJSON(file, fallback) {
  try { if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf-8')); } catch {}
  return fallback;
}

function saveJSON(file, data) {
  writeFileSync(file, JSON.stringify(data, null, 2));
}

function getRegistry() {
  return loadJSON(path.join(TOOLS_BASE, 'registry.json'), { farmers: [], quests: [], social: [], utilities: [], docs: [] });
}

function genId() { return randomBytes(4).toString('hex'); }

// ── Jobs Store ───────────────────────────────────────────────

let jobs = loadJSON(JOBS_FILE, {});

function updateJob(id, patch) {
  if (jobs[id]) { Object.assign(jobs[id], patch); saveJSON(JOBS_FILE, jobs); }
}

// ── Build command from tool registry ─────────────────────────

function buildCommand(tool, args) {
  const scriptPath = path.join(TOOLS_BASE, tool.script);
  const workDir = tool.script.includes('/') ? path.dirname(scriptPath) : TOOLS_BASE;
  const scriptFile = tool.script.includes('/') ? path.basename(tool.script) : tool.script;

  // Use the tool's cmd template if available
  if (tool.cmd) {
    let cmd = tool.cmd.replace('{script}', scriptFile);
    // Replace all {arg} placeholders with actual values
    for (const [key, val] of Object.entries(args)) {
      if (val !== '' && val !== undefined && val !== null) {
        cmd = cmd.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
      }
    }
    // Remove any unreplaced {placeholders}
    cmd = cmd.replace(/\{[^}]+\}/g, '');
    // Clean up double spaces
    cmd = cmd.replace(/\s+/g, ' ').trim();
    // If cmd already starts with cd, don't add another cd
    if (cmd.startsWith('cd ')) {
      return { cmd, workDir };
    }
    return { cmd: `cd ${workDir} && ${cmd}`, workDir };
  }

  // Fallback: build from args
  const argsStr = Object.entries(args)
    .filter(([_, v]) => v !== '' && v !== undefined && v !== null)
    .map(([k, v]) => {
      if (v === true || v === 'true') return `--${k}`;
      return `--${k} ${JSON.stringify(String(v))}`;
    }).join(' ');

  const isGo = tool.type === 'go';
  const PYTHON = '/root/hoodsniper_final/venv/bin/python3';
  const cmd = isGo
    ? `cd ${scriptPath} && go run . ${argsStr}`
    : `cd ${workDir} && ${PYTHON} ${scriptFile} ${argsStr}`.trim();

  return { cmd, workDir };
}

// ── GET /api/tools/registry ──────────────────────────────────

router.get('/registry', (_req, res) => {
  res.json(getRegistry());
});

// ── GET /api/tools/all ───────────────────────────────────────

router.get('/all', (_req, res) => {
  const reg = getRegistry();
  const flat = [
    ...reg.farmers.map(t => ({ ...t, category: 'farmer' })),
    ...reg.quests.map(t => ({ ...t, category: 'quest' })),
    ...reg.social.map(t => ({ ...t, category: 'social' })),
    ...reg.utilities.map(t => ({ ...t, category: 'utility' })),
    ...reg.docs.map(t => ({ ...t, category: 'doc' })),
  ];
  res.json({ tools: flat });
});

// ── POST /api/tools/run ──────────────────────────────────────

router.post('/run', (req, res) => {
  const { toolId, type, args = {} } = req.body;
  if (!toolId) return res.status(400).json({ error: 'toolId required' });

  const reg = getRegistry();
  const allTools = [...reg.farmers, ...reg.quests, ...reg.social, ...reg.utilities];
  const tool = allTools.find(t => t.id === toolId);
  if (!tool) return res.status(404).json({ error: 'Tool not found' });

  // Build job
  const jobId = genId();
  const job = {
    id: jobId, type: tool.type || 'python', toolId, args,
    status: 'pending', output: '', error: '',
    startedAt: null, finishedAt: null, pid: null,
  };
  jobs[jobId] = job;
  saveJSON(JOBS_FILE, jobs);

  // Build command
  const { cmd, workDir } = buildCommand(tool, args);
  console.log(`[tool-run] ${jobId}: ${cmd}`);

  updateJob(jobId, { status: 'running', startedAt: new Date().toISOString(), cmd });

  // Run in background
  const logFile = path.join(TOOLS_BASE, `.job-${jobId}.log`);
  const bg = spawn('bash', ['-c', `${cmd} > ${logFile} 2>&1`], {
    detached: true, stdio: 'ignore', cwd: workDir,
  });
  bg.unref();
  updateJob(jobId, { pid: bg.pid });

  // Watch for completion
  const checkDone = setInterval(() => {
    try {
      execSync(`ps -p ${bg.pid} -o pid= 2>/dev/null`, { encoding: 'utf-8' }).trim();
    } catch {
      clearInterval(checkDone);
      const output = existsSync(logFile) ? readFileSync(logFile, 'utf-8').slice(-10000) : '';
      const errLines = output.split('\n').filter(l => /error|traceback|exception/i.test(l));
      
      // Determine status based on output
      let status = 'completed';
      let error = errLines.join('\n');
      
      if (errLines.length) {
        status = 'error';
      } else if (!output.trim()) {
        // Empty output - tool likely needs credentials or configuration
        status = 'error';
        error = 'Tool completed with no output. Check if credentials/configuration are set.';
      } else if (output.includes('not found') || output.includes('not set') || output.includes('No accounts')) {
        // Tool explicitly says it needs configuration
        status = 'error';
        error = output.split('\n').slice(0, 3).join('\n');
      }
      
      updateJob(jobId, {
        status,
        output,
        error,
        finishedAt: new Date().toISOString(),
      });
    }
  }, 2000);

  // Auto-kill after 5 minutes
  setTimeout(() => {
    try { process.kill(-bg.pid, 'SIGTERM'); } catch {}
    clearInterval(checkDone);
    if (jobs[jobId]?.status === 'running') {
      const output = existsSync(logFile) ? readFileSync(logFile, 'utf-8').slice(-10000) : '';
      updateJob(jobId, { status: 'timeout', output, finishedAt: new Date().toISOString() });
    }
  }, 300000);

  res.json({ ok: true, jobId, cmd });
});

// ── GET /api/tools/jobs ──────────────────────────────────────

router.get('/jobs', (_req, res) => {
  const sorted = Object.values(jobs).sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
  res.json({ jobs: sorted.slice(0, 50) });
});

// ── GET /api/tools/jobs/:id ──────────────────────────────────

router.get('/jobs/:id', (req, res) => {
  const job = jobs[req.params.id];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status === 'running' || job.status === 'pending') {
    const logFile = path.join(TOOLS_BASE, `.job-${job.id}.log`);
    try { job.liveOutput = readFileSync(logFile, 'utf-8').slice(-5000); } catch {}
  }
  res.json(job);
});

// ── DELETE /api/tools/jobs/:id ───────────────────────────────

router.delete('/jobs/:id', (req, res) => {
  const job = jobs[req.params.id];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.pid && job.status === 'running') {
    try { process.kill(-job.pid, 'SIGTERM'); } catch {}
  }
  delete jobs[req.params.id];
  saveJSON(JOBS_FILE, jobs);
  res.json({ ok: true });
});

// ── POST /api/tools/jobs/:id/stop ────────────────────────────

router.post('/jobs/:id/stop', (req, res) => {
  const job = jobs[req.params.id];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.pid) {
    try { process.kill(-job.pid, 'SIGTERM'); } catch {}
    try { process.kill(-job.pid, 'SIGKILL'); } catch {}
  }
  updateJob(job.id, { status: 'stopped', finishedAt: new Date().toISOString() });
  res.json({ ok: true });
});

// ── GET /api/tools/docs/:id ──────────────────────────────────

router.get('/docs/:id', (req, res) => {
  const reg = getRegistry();
  const doc = reg.docs?.find(d => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: 'Doc not found' });
  const filePath = path.join(TOOLS_BASE, doc.file);
  if (!existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  const content = readFileSync(filePath, 'utf-8');
  res.json({ id: doc.id, name: doc.name, type: doc.type, content });
});

// ── GET /api/tools/readme/:toolId ────────────────────────────

router.get('/readme/:toolId', (req, res) => {
  const reg = getRegistry();
  const allTools = [...reg.farmers, ...reg.quests, ...reg.social, ...reg.utilities];
  const tool = allTools.find(t => t.id === req.params.toolId);
  if (!tool) return res.status(404).json({ error: 'Tool not found' });

  const scriptDir = path.dirname(path.join(TOOLS_BASE, tool.script));
  for (const c of ['README.md', 'readme.md', 'CLAUDE.md']) {
    const p = path.join(scriptDir, c);
    if (existsSync(p)) return res.json({ content: readFileSync(p, 'utf-8') });
  }
  res.json({ content: `# ${tool.name}\n\n${tool.description}` });
});

// ── GET /api/tools/accounts ──────────────────────────────────

router.get('/accounts', (_req, res) => {
  res.json(loadJSON(ACCOUNTS_FILE, { farmers: {}, quests: {}, social: {} }));
});

// ── POST /api/tools/accounts ─────────────────────────────────

router.post('/accounts', (req, res) => {
  const { category, toolId, accounts } = req.body;
  const data = loadJSON(ACCOUNTS_FILE, { farmers: {}, quests: {}, social: {} });
  if (!data[category]) data[category] = {};
  if (!data[category][toolId]) data[category][toolId] = [];
  data[category][toolId] = accounts;
  saveJSON(ACCOUNTS_FILE, data);
  res.json({ ok: true });
});

// ── GET /api/tools/status ────────────────────────────────────

router.get('/status', (_req, res) => {
  const running = Object.values(jobs).filter(j => j.status === 'running').length;
  const completed = Object.values(jobs).filter(j => j.status === 'completed').length;
  const failed = Object.values(jobs).filter(j => j.status === 'error').length;
  res.json({ running, completed, failed, total: Object.keys(jobs).length });
});

// ── GET /api/tools/files ─────────────────────────────────────

router.get('/files', (req, res) => {
  const toolPath = req.query.path || '';
  const fullPath = path.join(TOOLS_BASE, toolPath);
  if (!fullPath.startsWith(TOOLS_BASE)) return res.status(403).json({ error: 'Forbidden' });
  if (!existsSync(fullPath)) return res.status(404).json({ error: 'Path not found' });

  try {
    const entries = readdirSync(fullPath);
    const items = entries.map(name => {
      const p = path.join(fullPath, name);
      const stat = statSync(p);
      return { name, type: stat.isDirectory() ? 'dir' : 'file', size: stat.size, modified: stat.mtime.toISOString() };
    });
    res.json({ path: toolPath, items });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/tools/file-content ──────────────────────────────

router.get('/file-content', (req, res) => {
  const filePath = req.query.path || '';
  const fullPath = path.join(TOOLS_BASE, filePath);
  if (!fullPath.startsWith(TOOLS_BASE)) return res.status(403).json({ error: 'Forbidden' });
  if (!existsSync(fullPath)) return res.status(404).json({ error: 'File not found' });
  const stat = statSync(fullPath);
  if (stat.size > 1048576) return res.status(400).json({ error: 'File too large' });
  const content = readFileSync(fullPath, 'utf-8');
  res.json({ path: filePath, content, size: stat.size });
});

export default router;
