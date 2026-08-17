import { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import type { Tool } from './types';

interface DocsModalProps {
  tool: Tool;
  onClose: () => void;
}

export default function DocsModal({ tool, onClose }: DocsModalProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const endpoint = tool.category === 'doc'
          ? `/api/tools/docs/${tool.id}`
          : `/api/tools/readme/${tool.id}`;
        const d = await apiFetch<{ content: string }>(endpoint);
        setContent(d.content);
      } catch {
        setContent('# No documentation available');
      }
      setLoading(false);
    })();
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
          maxHeight: '85vh',
          overflow: 'auto',
          animation: 'slide-up 0.3s ease',
        }}
      >
        <div style={{
          width: 36,
          height: 4,
          borderRadius: 2,
          background: 'rgba(255,255,255,.15)',
          margin: '0 auto 16px',
        }} />

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{tool.name}</h3>
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

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div className="spinner" />
          </div>
        ) : (
          <pre style={{
            fontSize: 12,
            lineHeight: 1.6,
            color: 'var(--text-muted)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: "'SF Mono', monospace",
            background: 'var(--bg-input)',
            padding: 14,
            borderRadius: 12,
            maxHeight: '65vh',
            overflow: 'auto',
            border: '1px solid var(--border)',
          }}>{content.slice(0, 30000)}</pre>
        )}
      </div>
    </div>
  );
}
