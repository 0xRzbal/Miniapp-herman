import { useEffect, useRef, useState, useMemo } from 'react';

export default function MailPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const mailSrc = useMemo(() => `/mail/?_=${Date.now()}`, []);

  useEffect(() => {
    const resize = () => {
      if (iframeRef.current) {
        iframeRef.current.style.height = `${window.innerHeight - 130}px`;
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <div>
      <div style={{
        position: 'relative', borderRadius: 'var(--radius)', overflow: 'hidden',
        border: '1px solid var(--border)', background: 'var(--bg-card)',
        minHeight: 400,
      }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 12, background: 'var(--bg)', zIndex: 1,
          }}>
            <div className="spinner" />
            <span style={{
              fontSize: 11, color: 'var(--text-muted)', fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>Loading JoeMail</span>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={mailSrc}
          style={{ width: '100%', height: 'calc(100vh - 130px)', border: 'none', display: 'block', background: '#1a1a1a' }}
          title="JoeMail"
          onLoad={() => setLoading(false)}
        />
      </div>
    </div>
  );
}
