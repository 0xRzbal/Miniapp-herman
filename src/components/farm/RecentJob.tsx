import { useState } from 'react';
import { STATUS_MAP } from './types';
import type { Job } from './types';

interface RecentJobProps {
  job: Job;
  onDelete: (id: string) => void;
}

export default function RecentJob({ job, onDelete }: RecentJobProps) {
  const [expanded, setExpanded] = useState(false);
  const st = STATUS_MAP[job.status] || STATUS_MAP.pending;
  const out = job.output || job.error || job.liveOutput || '';

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '10px 12px',
      marginBottom: 6,
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
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
        }} />
        <span style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>{job.toolId}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: st.c }}>{st.l}</span>
        <button
          onClick={e => { e.stopPropagation(); onDelete(job.id); }}
          style={{
            padding: '4px 10px',
            borderRadius: 8,
            background: 'rgba(239,68,68,.1)',
            color: '#ef4444',
            fontSize: 12,
            fontWeight: 600,
            border: '1px solid rgba(239,68,68,.2)',
          }}
        >Delete</button>
      </div>

      {expanded && out && (
        <div style={{ marginTop: 8 }}>
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
          }}>{out}</pre>
        </div>
      )}
    </div>
  );
}
