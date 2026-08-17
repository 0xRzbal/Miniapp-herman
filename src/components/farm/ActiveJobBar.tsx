import { useState } from 'react';
import { STATUS_MAP } from './types';
import type { Job } from './types';

interface ActiveJobBarProps {
  job: Job;
  onStop: () => void;
}

export default function ActiveJobBar({ job, onStop }: ActiveJobBarProps) {
  const [open, setOpen] = useState(false);
  const st = STATUS_MAP[job.status] || STATUS_MAP.pending;
  const elapsed = job.startedAt
    ? Math.floor((Date.now() - new Date(job.startedAt).getTime()) / 1000)
    : 0;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '10px 12px',
      marginBottom: 6,
    }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
        }}
      >
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: st.c,
          boxShadow: `0 0 8px ${st.c}`,
        }} />
        <span style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>{job.toolId}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: st.c }}>{st.l} {elapsed}s</span>
        <button
          onClick={e => { e.stopPropagation(); onStop(); }}
          style={{
            padding: '4px 10px',
            borderRadius: 8,
            background: 'rgba(239,68,68,.1)',
            color: '#ef4444',
            fontSize: 12,
            fontWeight: 600,
            border: '1px solid rgba(239,68,68,.2)',
          }}
        >Stop</button>
      </div>

      {open && (
        <div style={{ marginTop: 8 }}>
          {job.cmd && (
            <div style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              fontFamily: "'SF Mono', monospace",
              padding: '6px 10px',
              borderRadius: 8,
              background: 'var(--bg-input)',
              marginBottom: 6,
              wordBreak: 'break-all',
              border: '1px solid var(--border)',
            }}>$ {job.cmd}</div>
          )}
          <pre style={{
            fontSize: 11,
            lineHeight: 1.5,
            color: 'var(--text-muted)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: "'SF Mono', monospace",
            background: 'var(--bg-input)',
            padding: 10,
            borderRadius: 10,
            maxHeight: 200,
            overflow: 'auto',
            border: '1px solid var(--border)',
          }}>{job.liveOutput || job.output || job.error || 'No output yet'}</pre>
        </div>
      )}
    </div>
  );
}
