import React from 'react';
import Icon from '../Icon';
import type { IconName } from '../Icon';

interface CatBarProps {
  cats: { id: string; label: string; icon: IconName; color: string }[];
  active: string;
  counts: Record<string, number>;
  onSelect: (id: string) => void;
}

function CatBarInner({ cats, active, counts, onSelect }: CatBarProps) {
  return (
    <div style={{
      display: 'flex',
      gap: 6,
      overflowX: 'auto',
      paddingBottom: 4,
      scrollbarWidth: 'none',
    }}>
      {cats.map(c => {
        const on = active === c.id;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            style={{
              flex: '0 0 auto',
              padding: '8px 14px',
              borderRadius: 20,
              border: `1.5px solid ${on ? c.color : 'var(--border)'}`,
              background: on ? `${c.color}15` : 'var(--bg-card)',
              color: on ? c.color : 'var(--text-muted)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            <Icon name={c.icon} size={14} color={on ? c.color : 'var(--text-muted)'} />
            {c.label}
            <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.7 }}>
              {counts[c.id] || 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const CatBar = React.memo(CatBarInner);
export default CatBar;
