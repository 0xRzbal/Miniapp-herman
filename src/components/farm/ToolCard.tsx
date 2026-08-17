import React from 'react';
import Icon from '../Icon';
import { CATS } from './types';
import type { Tool } from './types';

interface ToolCardProps {
  tool: Tool;
  onRun: () => void;
  onDocs: () => void;
  isRunning: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

function ToolCardInner({ tool, onRun, onDocs, isRunning, isFavorite, onToggleFavorite }: ToolCardProps) {
  const cat = CATS.find(c => c.id === tool.category);
  const needsEnv = tool.env && tool.env.length > 0;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: 0,
      marginBottom: 8,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 16px',
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: `${cat?.color || '#666'}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon name={cat?.icon || 'utility'} size={20} color={cat?.color || '#666'} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
            marginBottom: 2,
          }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
              {tool.name}
            </span>
            {needsEnv && (
              <span style={{
                fontSize: 10,
                padding: '2px 7px',
                borderRadius: 6,
                background: 'rgba(245, 158, 11, 0.12)',
                color: '#f59e0b',
                fontWeight: 600,
              }}>Config</span>
            )}
            {tool.quota && (
              <span style={{
                fontSize: 10,
                padding: '2px 7px',
                borderRadius: 6,
                background: 'rgba(34, 197, 94, 0.12)',
                color: '#22c55e',
                fontWeight: 600,
              }}>{tool.quota}</span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 2,
                marginLeft: 'auto',
              }}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <span style={{ fontSize: 16, color: isFavorite ? '#f59e0b' : 'var(--text-muted)' }}>
                {isFavorite ? '\u2605' : '\u2606'}
              </span>
            </button>
          </div>
          <div style={{
            fontSize: 13,
            color: 'var(--text-muted)',
            lineHeight: 1.4,
          }}>{tool.description}</div>
        </div>
      </div>

      {(tool.features || tool.modules) && (tool.features || tool.modules || []).length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          padding: '0 16px 12px',
        }}>
          {(tool.features || tool.modules || []).slice(0, 5).map(f => (
            <span key={f} style={{
              fontSize: 10,
              padding: '3px 8px',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--text-muted)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>{f}</span>
          ))}
        </div>
      )}

      <div style={{ borderTop: '0.5px solid var(--border)' }}>
        {tool.category === 'doc' ? (
          <button
            onClick={onDocs}
            style={{
              width: '100%',
              padding: '12px 0',
              border: 'none',
              background: 'transparent',
              color: 'var(--accent)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >Docs</button>
        ) : (
          <div style={{ display: 'flex' }}>
            <button
              onClick={onRun}
              disabled={isRunning}
              style={{
                flex: 1,
                padding: '12px 0',
                border: 'none',
                borderRight: '0.5px solid var(--border)',
                background: 'transparent',
                color: isRunning ? '#3b82f6' : 'var(--accent)',
                fontSize: 14,
                fontWeight: 600,
                cursor: isRunning ? 'default' : 'pointer',
              }}
            >{isRunning ? 'Running...' : 'Run'}</button>
            <button
              onClick={onDocs}
              style={{
                flex: 1,
                padding: '12px 0',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >Docs</button>
          </div>
        )}
      </div>
    </div>
  );
}

const ToolCard = React.memo(ToolCardInner);
export default ToolCard;
