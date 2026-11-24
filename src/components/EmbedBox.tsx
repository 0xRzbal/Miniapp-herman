import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Measures the real content area instead of subtracting a fixed vh constant. */
export function useEmbedHeight() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxH, setBoxH] = useState<number | null>(null);

  useEffect(() => {
    const calc = () => {
      const el = boxRef.current;
      if (!el) return;
      const scroller = el.closest('.app-content') as HTMLElement | null;
      if (scroller) {
        const cs = getComputedStyle(scroller);
        const pad = parseFloat(cs.paddingTop || '0') + parseFloat(cs.paddingBottom || '0');
        const avail = scroller.clientHeight - pad;
        if (avail > 200) {
          setBoxH(Math.max(360, Math.round(avail)));
          return;
        }
      }
      const top = el.getBoundingClientRect().top;
      const nav = window.matchMedia('(min-width: 900px)').matches ? 28 : 78;
      setBoxH(Math.max(360, Math.round(window.innerHeight - top - nav)));
    };
    calc();
    const scroller = boxRef.current?.closest('.app-content') as HTMLElement | null;
    const ro = scroller ? new ResizeObserver(calc) : null;
    if (scroller && ro) ro.observe(scroller);
    window.addEventListener('resize', calc);
    const tg = (window as any).Telegram?.WebApp;
    try { tg?.onEvent?.('viewportChanged', calc); } catch {}
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', calc);
      try { tg?.offEvent?.('viewportChanged', calc); } catch {}
    };
  }, []);

  return { boxRef, boxH };
}

export function EmbedSkeleton({ label }: { label: string }) {
  return (
    <div className="embed-skel" aria-busy="true">
      <span style={{
        fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700,
        letterSpacing: '0.12em', textTransform: 'uppercase',
      }}>{label}</span>
      {[0, 1, 2, 3, 4].map(i => (
        <div className="embed-skel-row" key={i}>
          <div className="skeleton" style={{ width: 30, height: 30, borderRadius: 8 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="skeleton" style={{ height: 9, width: `${[58, 72, 46, 66, 52][i]}%`, borderRadius: 4 }} />
            <div className="skeleton" style={{ height: 8, width: `${[34, 46, 28, 40, 30][i]}%`, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function EmbedBox({ label, children, loaded }: { label: string; children: ReactNode; loaded: boolean }) {
  const { boxRef, boxH } = useEmbedHeight();
  return (
    <div className="embed-box" ref={boxRef} style={boxH ? { height: boxH } : undefined}>
      {!loaded && <EmbedSkeleton label={label} />}
      {children}
    </div>
  );
}
