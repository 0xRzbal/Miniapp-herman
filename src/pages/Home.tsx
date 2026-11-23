import { useState, useEffect } from 'react';
import { APP_NAME, APP_VERSION } from '../config';
import { SkeletonStats } from '../components/Skeleton';
import { apiFetch } from '../lib/api';

interface MiniappOnly { hub: boolean; mail: boolean; router: boolean; }

interface SystemStats {
  cpu: { cores: number; usage: string; model: string };
  memory: { total: number; used: number; free: number; pct: string };
  disk: { total: number; used: number; available: number; pct: string };
  uptime: number;
  hostname: string;
  host?: { distro: string; kernel: string; arch: string; virt: string; hostname: string };
}

const VPS_INFO = {
  provider: 'Contabo', url: 'https://new.contabo.com', email: 'iqbal12963@gmail.com',
  plan: '1 Year VPS', expiryDate: new Date('2027-03-24T23:59:59'),
};

const fmtBytes = (b: number) => b >= 1073741824 ? (b / 1073741824).toFixed(1) + ' GB' : b >= 1048576 ? (b / 1048576).toFixed(0) + ' MB' : (b / 1024).toFixed(0) + ' KB';
const fmtUptime = (s: number) => { const d = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600); const m = Math.floor((s % 3600) / 60); return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`; };

function StatBar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.8s cubic-bezier(0.22, 1, 0.36, 1)' }} />
      </div>
    </div>
  );
}

export default function Home() {
  const [status, setStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(new Date());
  const [access, setAccess] = useState<MiniappOnly>({ hub: false, mail: false, router: false });
  const [accessLoading, setAccessLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          setStatus('online');
          try { const r = await fetch('/api/system', { signal: AbortSignal.timeout(5000) }); if (r.ok) setStats(await r.json()); } catch {}
        } else setStatus('offline');
      } catch { setStatus('offline'); } finally { setReady(true); }
    };
    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);

  useEffect(() => {
    apiFetch<{ miniapp_only: MiniappOnly | boolean }>('/api/settings')
      .then(s => {
        const mo = s.miniapp_only;
        if (typeof mo === 'object' && mo !== null) setAccess({ hub: !!mo.hub, mail: !!mo.mail, router: !!mo.router });
        else { const v = !!mo; setAccess({ hub: v, mail: v, router: v }); }
      })
      .catch(() => {})
      .finally(() => setAccessLoading(false));
  }, []);

  const toggleAccess = async (svc: keyof MiniappOnly) => {
    const prev = access;
    const next = { ...access, [svc]: !access[svc] };
    setAccess(next);
    try {
      await apiFetch('/api/settings', { method: 'POST', body: JSON.stringify({ key: 'miniapp_only', value: next }) });
    } catch {
      setAccess(prev);
    }
  };

  if (!ready) {
    return (
      <div style={{ animation: 'fade-in 0.25s ease' }}>
        <div className="section-title">Server</div>
        <SkeletonStats rows={3} />
        <div className="section-title">Spesifikasi</div>
        <SkeletonStats rows={4} />
      </div>
    );
  }

  const hours = now.getHours();
  const greeting = hours < 12 ? 'Good morning' : hours < 18 ? 'Good afternoon' : 'Good evening';
  const cpuPct = stats ? parseFloat(stats.cpu.usage) : 0;
  const memPct = stats ? parseFloat(stats.memory.pct) : 0;
  const diskPct = stats ? parseFloat(stats.disk.pct) : 0;
  const daysLeft = Math.max(0, Math.ceil((VPS_INFO.expiryDate.getTime() - now.getTime()) / 86400000));
  const cpuModel = stats ? stats.cpu.model.replace(' Processor', '').replace('(with IBPB)', '').replace(/\s+/g, ' ').trim() : '...';

  return (
    <div style={{ animation: 'spring-in 0.4s ease' }}>
      <div className="hero-card">
        <h2>{greeting}</h2>
        <p>Welcome to {APP_NAME}</p>
      </div>

      <div className="section-title">Server</div>
      <div className="card">
        <div className="list-item">
          <span className="list-item-label">Status</span>
          <span className={`badge ${status === 'online' ? 'ok' : 'bad'}`}>{status === 'checking' ? '...' : status === 'online' ? 'Online' : 'Offline'}</span>
        </div>
        <div className="list-item">
          <span className="list-item-label">Provider</span>
          <a href={VPS_INFO.url} target="_blank" rel="noopener noreferrer" className="list-item-value" style={{ textDecoration: 'none', color: 'var(--accent)' }}>{VPS_INFO.provider}</a>
        </div>
        <div className="list-item">
          <span className="list-item-label">Plan</span>
          <span className="list-item-value">{VPS_INFO.plan}</span>
        </div>
        <div className="list-item">
          <span className="list-item-label">Expires</span>
          <span className="list-item-value" style={{ color: daysLeft <= 30 ? '#ef4444' : daysLeft <= 90 ? '#eab308' : '#22c55e' }}>
            {VPS_INFO.expiryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            <span className={`badge ${daysLeft <= 30 ? 'bad' : 'ok'}`} style={{ marginLeft: 8 }}>{daysLeft}d</span>
          </span>
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3,
              width: `${Math.min(100, (daysLeft / 365) * 100)}%`,
              background: daysLeft <= 30 ? '#ef4444' : daysLeft <= 90 ? '#eab308' : '#22c55e',
              transition: 'width 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Mar 24, 2026</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Mar 24, 2027</span>
          </div>
        </div>
      </div>

      <div className="section-title">System</div>
      <div className="card">
        <div className="card-inner" style={{ padding: '16px' }}>
          {stats ? (
            <>
              <StatBar label="CPU" value={`${stats.cpu.usage}%`} pct={cpuPct} color="#ff6b4a" />
              <StatBar label="Memory" value={`${fmtBytes(stats.memory.used)} / ${fmtBytes(stats.memory.total)}`} pct={memPct} color="#a855f7" />
              <StatBar label="Disk" value={`${fmtBytes(stats.disk.used)} / ${fmtBytes(stats.disk.total)}`} pct={diskPct} color="#f59e0b" />
            </>
          ) : <div className="spinner" style={{ margin: '20px auto' }} />}
        </div>
      </div>

      <div className="section-title">Spesifikasi</div>
      <div className="card">
        <div className="list-item">
          <span className="list-item-label">CPU</span>
          <span className="list-item-value spec-val" title={stats?.cpu.model || ''}>{cpuModel}</span>
        </div>
        <div className="list-item"><span className="list-item-label">vCPU</span><span className="list-item-value">{stats ? `${stats.cpu.cores} cores` : '...'}</span></div>
        <div className="list-item"><span className="list-item-label">RAM</span><span className="list-item-value">{stats ? fmtBytes(stats.memory.total) : '...'}</span></div>
        <div className="list-item"><span className="list-item-label">Disk</span><span className="list-item-value">{stats ? `${fmtBytes(stats.disk.total)} NVMe` : '...'}</span></div>
        <div className="list-item"><span className="list-item-label">OS</span><span className="list-item-value spec-val">{stats?.host ? stats.host.distro : '...'}</span></div>
        <div className="list-item"><span className="list-item-label">Kernel</span><span className="list-item-value spec-val">{stats?.host ? stats.host.kernel : '...'}</span></div>
        <div className="list-item"><span className="list-item-label">Virt</span><span className="list-item-value">{stats?.host ? stats.host.virt.toUpperCase() : '...'}</span></div>
        <div className="list-item"><span className="list-item-label">Host</span><span className="list-item-value spec-val">{stats?.host ? stats.host.hostname : '...'}</span></div>
        <div className="list-item"><span className="list-item-label">Arch</span><span className="list-item-value">{stats?.host ? (stats.host.arch === 'x64' ? 'x86_64' : stats.host.arch) : '...'}</span></div>
      </div>

      <div className="section-title">Overview</div>
      <div className="card">
        <div className="list-item"><span className="list-item-label">Uptime</span><span className="list-item-value">{stats ? fmtUptime(stats.uptime) : '...'}</span></div>
        <div className="list-item"><span className="list-item-label">Cores</span><span className="list-item-value">{stats ? stats.cpu.cores : '...'}</span></div>
        <div className="list-item"><span className="list-item-label">API</span><span className="status"><span className={`status-dot ${status}`} />{status === 'online' ? 'Operational' : 'Offline'}</span></div>
      </div>

      <div className="section-title">Access Control</div>
      <div className="card ac-card">
        {([
          { key: 'hub' as const, label: 'Full Access', desc: 'Block external browser access' },
          { key: 'mail' as const, label: 'Mail', desc: 'Block JoeMail external access' },
          { key: 'router' as const, label: '9Router', desc: 'Block 9Router external access' },
        ]).map(svc => (
          <div key={svc.key} className="ac-row">
            <div className="ac-text">
              <div className="ac-label">{svc.label}</div>
              <div className="ac-desc">{svc.desc}</div>
            </div>
            <button
              className={`toggle ${access[svc.key] ? 'active' : ''}`}
              aria-label={`${svc.label} access gate`}
              onClick={() => toggleAccess(svc.key)}
              disabled={accessLoading}
            />
          </div>
        ))}
        <div className="ac-row ac-row-last">
          <div className="ac-text">
            <div className="ac-label">Version</div>
            <div className="ac-desc">{APP_NAME}</div>
          </div>
          <span className="ver-chip">v{APP_VERSION}</span>
        </div>
      </div>
    </div>
  );
}
