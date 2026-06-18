import { useState, useEffect } from 'react';
import { APP_NAME } from '../config';


interface SystemStats {
  cpu: { cores: number; usage: string; model: string };
  memory: { total: number; used: number; free: number; pct: string };
  disk: { total: number; used: number; available: number; pct: string };
  uptime: number;
  hostname: string;
}

const VPS_INFO = {
  provider: 'Contabo',
  url: 'https://new.contabo.com',
  email: 'iqbal12963@gmail.com',
  plan: '1 Year VPS',
  expiryDate: new Date('2027-03-24T23:59:59'),
};

const fmtBytes = (b: number) => {
  if (b >= 1073741824) return (b / 1073741824).toFixed(1) + ' GB';
  if (b >= 1048576) return (b / 1048576).toFixed(0) + ' MB';
  return (b / 1024).toFixed(0) + ' KB';
};

const fmtUptime = (s: number) => {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const barColor = (pct: number) => {
  if (pct >= 90) return 'var(--error)';
  if (pct >= 70) return 'var(--warning)';
  return 'var(--success)';
};

const expiryColor = (daysLeft: number) => {
  if (daysLeft <= 30) return 'var(--error)';
  if (daysLeft <= 90) return 'var(--warning)';
  return 'var(--success)';
};

function Skel({ w = '60%', h = 14 }: { w?: string; h?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 6,
      background: 'linear-gradient(90deg, rgba(255,255,255,.04) 25%, rgba(255,255,255,.08) 50%, rgba(255,255,255,.04) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s ease-in-out infinite',
    }} />
  );
}

function StatBar({ label, value, pct, sub }: {
  label: string; value: string; pct: number; sub: string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: barColor(pct) }}>{value}</span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 20, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: barColor(pct),
          borderRadius: 20,
          transition: 'width 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
        }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="home-ready">
      <div className="section-title">Dashboard</div>
      <div className="hero-card" style={{ minHeight: 80 }}>
        <Skel w="45%" h={20} />
        <div style={{ marginTop: 10 }}><Skel w="70%" h={14} /></div>
      </div>
      <div className="section-title">Server</div>
      <div className="card">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="list-item">
            <Skel w={i % 2 === 0 ? '60px' : '80px'} />
            <Skel w={i % 2 === 0 ? '100px' : '60px'} />
          </div>
        ))}
      </div>
      <div className="section-title">System</div>
      <div className="card">
        {[0, 1, 2].map(i => (
          <div key={i} style={{ marginBottom: i < 2 ? 14 : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <Skel w="30px" /><Skel w="36px" />
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 20 }} />
            <div style={{ marginTop: 4 }}><Skel w="50px" h={10} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [status, setStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          setStatus('online');
          try {
            const sysRes = await fetch('/api/system', { signal: AbortSignal.timeout(5000) });
            if (sysRes.ok) setStats(await sysRes.json());
          } catch {}
        } else {
          setStatus('offline');
        }
      } catch {
        setStatus('offline');
      } finally {
        setReady(true);
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  if (!ready) return <HomeSkeleton />;

  const hours = now.getHours();
  const greeting = hours < 12 ? 'Good morning' : hours < 18 ? 'Good afternoon' : 'Good evening';
  const cpuPct = stats ? parseFloat(stats.cpu.usage) : 0;
  const memPct = stats ? parseFloat(stats.memory.pct) : 0;
  const diskPct = stats ? parseFloat(stats.disk.pct) : 0;
  const msLeft = VPS_INFO.expiryDate.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(msLeft / 86400000));
  const expiryPct = Math.min(100, Math.max(0, (daysLeft / 365) * 100));

  return (
    <div className="home-ready">
      {/* Hero */}
      <div className="hero-card">
        <h2>{greeting}</h2>
        <p>Welcome to {APP_NAME}</p>
      </div>

      {/* VPS Info */}
      <div className="section-title">Server</div>
      <div className="card">
        <div className="list-item">
          <span className="list-item-label">Status</span>
          <span className={`badge ${status === 'online' ? 'ok' : status === 'offline' ? 'bad' : ''}`}>
            {status === 'checking' ? '...' : status === 'online' ? 'Online' : 'Offline'}
          </span>
        </div>
        <div className="list-item">
          <span className="list-item-label">Provider</span>
          <a href={VPS_INFO.url} target="_blank" rel="noopener noreferrer"
            className="list-item-value" style={{ textDecoration: 'none' }}>
            {VPS_INFO.provider} ↗
          </a>
        </div>
        <div className="list-item">
          <span className="list-item-label">Plan</span>
          <span className="list-item-value">{VPS_INFO.plan}</span>
        </div>
        <div className="list-item">
          <span className="list-item-label">Email</span>
          <span className="list-item-value">{VPS_INFO.email}</span>
        </div>
        <div className="list-item">
          <span className="list-item-label">Expires</span>
          <span className="list-item-value" style={{ color: expiryColor(daysLeft), fontWeight: 700 }}>
            {VPS_INFO.expiryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            <span className={`badge ${daysLeft <= 30 ? 'bad' : daysLeft <= 90 ? '' : 'ok'}`} style={{ marginLeft: 8 }}>
              {daysLeft}d
            </span>
          </span>
        </div>
        <div style={{ marginTop: 4 }}>
          <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 20, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${expiryPct}%`, background: expiryColor(daysLeft),
              borderRadius: 20, transition: 'width 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
            }} />
          </div>
        </div>
      </div>

      {/* System */}
      <div className="section-title">System</div>
      <div className="card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {stats ? (
            <>
              <StatBar label="CPU" value={`${stats.cpu.usage}%`} pct={cpuPct} sub={`${stats.cpu.cores} cores`} />
              <StatBar label="Memory" value={`${fmtBytes(stats.memory.used)} / ${fmtBytes(stats.memory.total)}`} pct={memPct} sub={`${stats.memory.pct}% used`} />
              <StatBar label="Disk" value={`${fmtBytes(stats.disk.used)} / ${fmtBytes(stats.disk.total)}`} pct={diskPct} sub={`${stats.disk.pct}% used - ${fmtBytes(stats.disk.available)} free`} />
            </>
          ) : (
            <>
              {[0, 1, 2].map(i => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Skel w="30px" /><Skel w={i === 0 ? '36px' : '90px'} />
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 20 }} />
                  <div style={{ marginTop: 4 }}><Skel w="50px" h={10} /></div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="section-title">Overview</div>
      <div className="card">
        <div className="list-item">
          <span className="list-item-label">Uptime</span>
          <span className="list-item-value">{stats ? fmtUptime(stats.uptime) : '...'}</span>
        </div>
        <div className="list-item">
          <span className="list-item-label">CPU Cores</span>
          <span className="list-item-value">{stats ? stats.cpu.cores : '...'}</span>
        </div>
        <div className="list-item">
          <span className="list-item-label">API Health</span>
          <span className="status">
            <span className={`status-dot ${status}`} />
            {status === 'checking' ? 'Checking...' : status === 'online' ? 'Operational' : 'Offline'}
          </span>
        </div>
      </div>
    </div>
  );
}
