import { useEffect, useRef, useState } from 'react';

interface ProjectConfig {
  id: string;
  name: string;
  icon: string;
  url: string;
  domain: string;
  entryPath: string;
  port: number;
}

export default function ProtectedPage({ project }: { project: ProjectConfig }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth-token')
      .then(r => r.json())
      .then(({ token }) => {
        if (token) {
          setSrc(`/internal/router-auth?t=${token}&redirect=${project.entryPath}`);
        } else {
          setSrc(`${project.url}${project.entryPath}`);
        }
      })
      .catch(() => setSrc(`${project.url}${project.entryPath}`));
  }, [project]);

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
        {!loaded && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 12, background: 'var(--bg)', zIndex: 2,
          }}>
            <div className="spinner" />
            <span style={{
              fontSize: 11, color: 'var(--text-muted)', fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>Loading {project.name}</span>
          </div>
        )}

        {src && (
          <iframe
            ref={iframeRef}
            src={src}
            style={{
              width: '100%', height: 'calc(100vh - 130px)',
              border: 'none', display: 'block', background: '#1a1a1a',
            }}
            title={project.name}
            onLoad={() => setLoaded(true)}
          />
        )}
      </div>
    </div>
  );
}
