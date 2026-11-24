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
  procUptime?: number;
  load?: number[];
  hostname: string;
  host?: { distro: string; kernel: string; arch: string; virt: string; hostname: string };
}

const VPS_INFO = {
  provider: 'Contabo', url: 'https://new.contabo.com', email: 'iqbal12963@gmail.com',
  plan: '1 Year VPS', expiryDate: new Date('2027-03-24T23:59:59'),
};

const fmtBytes = (b: number) => b >= 1073741824 ? (b / 1073741824).toFixed(1) + ' GB' : b >= 1048576 ? (b / 1048576).toFixed(0) + ' MB' : (b / 1024).toFixed(0) + ' KB';
const fmtUptime = (s: number) => { const d = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600); const m = Math.floor((s % 3600) / 60); return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`; };

function Bar({ label, value, pct, color, over }: { label: string; value: string; pct: number; color: string; over?: boolean }) {
  return (
    <div className="metric">
      <div className="metric-head">
        <span className="metric-label">{label}</span>
        <span className="metric-value" style={{ color }}>{value}</span>
      </div>
      <div className="metric-track">
        <div className={`metric-fill ${over ? 'over' : ''}`} style={{ width: `${Math.min(100, pct)}%`, background: color }} />
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
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          setStatus('online');
          setSyncedAt(new Date());
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
      <div className="bento" style={{ animation: 'fade-in 0.25s ease' }}>
        <div className="tile tile-hero"><SkeletonStats rows={2} /></div>
        <div className="tile tile-server"><SkeletonStats rows={3} /></div>
        <div className="tile tile-spec"><SkeletonStats rows={4} /></div>
      </div>
    );
  }

  const hours = now.getHours();
  const greeting = hours < 12 ? 'Good morning' : hours < 18 ? 'Good afternoon' : 'Good evening';
  const cpuPct = stats ? parseFloat(stats.cpu.usage) : 0;
  const memPct = stats ? parseFloat(stats.memory.pct) : 0;
  const diskPct = stats ? parseFloat(stats.disk.pct) : 0;
  const daysLeft = Math.max(0, Math.ceil((VPS_INFO.expiryDate.getTime() - now.getTime()) / 86400000));
  const arch = stats?.host ? (stats.host.arch === 'x64' ? 'x86_64' : stats.host.arch) : '';
  const cpuShort = stats ? stats.cpu.model.replace(' Processor', '').replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim() : '';
  const daysColor = daysLeft <= 30 ? 'var(--ios-red)' : daysLeft <= 90 ? 'var(--ios-yellow)' : 'var(--ios-green)';

  return (
    <div className="bento" style={{ animation: 'spring-in 0.35s ease' }}>
      <div className="tile tile-hero">
        <div className="hero-top">
          <div>
            <h2>{greeting}</h2>
            <p>{APP_NAME}</p>
          </div>
          <div className="hero-right">
            <div className="hero-clock">
              <strong>{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</strong>
              <span>{now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="tile tile-server">
        <div className="tile-title">Server</div>
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
          <span className="list-item-value" style={{ color: daysColor }}>
            {VPS_INFO.expiryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        <div className="renew-track">
          <div className="renew-fill" style={{ width: `${Math.min(100, (daysLeft / 365) * 100)}%`, background: daysColor }} />
        </div>
                <div className="renew-legend">
          <span>Mar 2026</span>
          <span className="renew-days" style={{ color: daysColor }}>{daysLeft} hari lagi</span>
        </div>
      </div>

      <div className="tile tile-spec">
        <div className="tile-title">Specs</div>
        <table className="spec-table">
          <tbody>
            <tr><th>CPU</th><td title={stats?.cpu.model || ''}>{stats ? `${cpuShort} · ${stats.cpu.cores} vCPU` : '...'}</td></tr>
            <tr><th>RAM</th><td>{stats ? fmtBytes(stats.memory.total) : '...'}</td></tr>
            <tr><th>Disk</th><td>{stats ? `${fmtBytes(stats.disk.total)} NVMe` : '...'}</td></tr>
            <tr><th>OS</th><td>{stats?.host ? stats.host.distro : '...'}</td></tr>
            <tr><th>Kernel</th><td>{stats?.host ? stats.host.kernel : '...'}</td></tr>
            <tr><th>Virt</th><td>{stats?.host ? `${stats.host.virt.toUpperCase()} · ${arch}` : '...'}</td></tr>
            <tr><th>Host</th><td>{stats?.host ? stats.host.hostname : '...'}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="tile tile-system">
        <div className="tile-title">System</div>
        {stats ? (
          <div className="metric-list">
            <Bar label="CPU" value={`${stats.cpu.usage}%`} pct={cpuPct} color="var(--color-primary)" />
            <Bar label="Memory" value={`${fmtBytes(stats.memory.used)} / ${fmtBytes(stats.memory.total)}`} pct={memPct} color="var(--ios-purple)" />
            <Bar label="Disk" value={`${fmtBytes(stats.disk.used)} / ${fmtBytes(stats.disk.total)}`} pct={diskPct} color="var(--ios-yellow)" />
          </div>
        ) : (
          <div className="metric-list">
            {[0, 1, 2].map(i => (
              <div className="metric" key={i}>
                <div className="metric-head">
                  <span className="skeleton skel-bar" style={{ width: i === 0 ? '32px' : i === 1 ? '54px' : '30px', height: '10px' }} />
                  <span className="skeleton skel-bar" style={{ width: '52px', height: '10px' }} />
                </div>
                <div className="metric-track">
                  <div className="skeleton" style={{ width: `${[38, 52, 74][i]}%`, height: '100%', borderRadius: '999px' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="tile tile-overview">
        <div className="tile-title">Overview</div>
        <div className="mini-grid">
          <div className="mini-stat"><span>Uptime</span><strong>{stats ? fmtUptime(stats.uptime) : '…'}</strong></div>
          <div className="mini-stat">
            <span>API</span>
            <strong className="stat-live" title={syncedAt ? `Synced ${syncedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'Waiting for first sync'}>
              <i className={`live-dot ${status === 'online' ? 'on' : status === 'offline' ? 'off' : ''}`} />
              {status === 'online' ? 'OK' : status === 'checking' ? '…' : 'DOWN'}
            </strong>
          </div>
          <div className="mini-stat"><span>Load</span><strong>{stats?.load ? stats.load[0].toFixed(2) : '…'}</strong></div>
        </div>
      </div>

      <div className="tile tile-access">
        <div className="tile-title">Access Control<span>v{APP_VERSION}</span></div>
        {([
          { key: 'hub' as const, label: 'Full Access', desc: 'Block external browser access', url: 'miniapp-herman-bot.rzbal.xyz', href: 'https://miniapp-herman-bot.rzbal.xyz' },
          { key: 'mail' as const, label: 'Mail', desc: 'Block JoeMail external access', url: 'mail.rzbal.xyz', href: 'https://mail.rzbal.xyz' },
          { key: 'router' as const, label: '9Router', desc: 'Block 9Router external access', url: '9router.rzbal.xyz', href: 'https://9router.rzbal.xyz' },
        ]).map(svc => (
          <div key={svc.key} className="ac-row">
            <div className="ac-text">
              <div className="ac-label">{svc.label}</div>
              <div className="ac-desc">{svc.desc}</div>
              <a className="ac-link" href={svc.href} target="_blank" rel="noopener noreferrer">{svc.url}</a>
            </div>
            <button
              className={`toggle ${access[svc.key] ? 'active' : ''}`}
              aria-label={`${svc.label} access gate`}
              onClick={() => toggleAccess(svc.key)}
              disabled={accessLoading}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
