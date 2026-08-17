import React from 'react';

interface StatCardProps {
  value: number;
  label: string;
  color: string;
}

function StatCardInner({ value, label, color }: StatCardProps) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: '14px 8px',
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 24,
        fontWeight: 700,
        color,
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--text-muted)',
        marginTop: 4,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>{label}</div>
    </div>
  );
}

const StatCard = React.memo(StatCardInner);
export default StatCard;
