import { useState, useEffect } from 'react';
import type { Tool } from './types';

interface RunModalProps {
  tool: Tool;
  onRun: (args: Record<string, string>) => void;
  onClose: () => void;
}

export default function RunModal({ tool, onRun, onClose }: RunModalProps) {
  const [envVals, setEnvVals] = useState<Record<string, string>>({});
  const [argVals, setArgVals] = useState<Record<string, string>>({});

  useEffect(() => {
    const ei: Record<string, string> = {};
    tool.env?.forEach(e => { ei[e] = ''; });
    setEnvVals(ei);

    const ai: Record<string, string> = {};
    tool.args?.forEach(a => { ai[a.name] = String(a.default); });
    setArgVals(ai);
  }, [tool]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          borderRadius: '20px 20px 0 0',
          width: '100%',
          maxWidth: 480,
          padding: '12px 20px 36px',
          maxHeight: '80vh',
          overflow: 'auto',
          animation: 'slide-up 0.3s ease',
        }}
      >
        <div style={{
          width: 36,
          height: 4,
          borderRadius: 2,
          background: 'rgba(255,255,255,0.15)',
          margin: '0 auto 16px',
        }} />

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{tool.name}</h3>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{tool.description}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              background: 'var(--bg-elevated)',
              color: 'var(--text-muted)',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >x</button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onRun({ ...envVals, ...argVals }); }}>
          {tool.env && tool.env.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Environment</div>
              {tool.env.map(e => (
                <div key={e} style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 500 }}>{e}</label>
                  <input
                    className="input"
                    value={envVals[e] || ''}
                    onChange={ev => setEnvVals(p => ({ ...p, [e]: ev.target.value }))}
                    placeholder={e}
                  />
                </div>
              ))}
            </div>
          )}

          {tool.args && tool.args.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Parameters</div>
              {tool.args.map(a => (
                <div key={a.name} style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 500 }}>{a.label}</label>
                  {a.type === 'flag' ? (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '10px 0' }}>
                      <input
                        type="checkbox"
                        checked={argVals[a.name] === 'true'}
                        onChange={e => setArgVals(p => ({ ...p, [a.name]: e.target.checked ? 'true' : 'false' }))}
                        style={{ accentColor: 'var(--accent)', width: 18, height: 18 }}
                      />
                      <span style={{ fontSize: 15, color: 'var(--text)' }}>Enable</span>
                    </label>
                  ) : (
                    <input
                      className="input"
                      type={a.type === 'number' ? 'number' : 'text'}
                      min={a.type === 'number' ? '1' : undefined}
                      value={argVals[a.name] || ''}
                      onChange={e => setArgVals(p => ({ ...p, [a.name]: e.target.value }))}
                      placeholder={a.placeholder}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px 0', fontSize: 16, borderRadius: 14 }}
          >Start</button>
        </form>
      </div>
    </div>
  );
}
