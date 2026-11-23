/** Lightweight skeleton placeholders — keeps layout stable while data loads. */

export function SkeletonLine({ width = '100%', height = 12 }: { width?: string | number; height?: number }) {
  return <div className="skeleton" style={{ width, height, borderRadius: 6 }} />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div className="skeleton" style={{ width: '45%', height: 15, borderRadius: 6 }} />
        <div className="skeleton" style={{ width: 54, height: 15, borderRadius: 6 }} />
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton" style={{ width: i === lines - 1 ? '62%' : '100%', height: 11, borderRadius: 5, marginBottom: 8 }} />
      ))}
      <div className="skeleton" style={{ width: 90, height: 9, borderRadius: 5, marginTop: 10 }} />
    </div>
  );
}

export function SkeletonStats({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="skeleton" style={{ width: 70, height: 12, borderRadius: 5 }} />
            <div className="skeleton" style={{ width: 48, height: 12, borderRadius: 5 }} />
          </div>
          <div className="skeleton" style={{ width: '100%', height: 6, borderRadius: 3 }} />
        </div>
      ))}
    </div>
  );
}
