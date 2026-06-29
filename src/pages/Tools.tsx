import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../lib/api';
import { showToast } from '../components/Toast';

interface ToolOption {
  label: string;
  value: string;
}

interface Tool {
  id: string;
  name: string;
  icon: string;
  description: string;
  placeholder: string;
  options?: ToolOption[];
  hasDelimiter?: boolean;
}

// Tools that run entirely client-side (no server API needed)
const LOCAL_TOOLS: Tool[] = [
  { id: 'pair-lines', name: 'Pair Lines', icon: '||', description: 'Group entries by paragraph, pick columns, join with delimiter.', placeholder: 'Paste text...' },
];

/* ── Shared style helpers ─────────────────────────────── */
const CHK_ON = { width: 18, height: 18, borderRadius: 4, border: '2px solid rgba(255,255,255,.4)', background: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--bg)', flexShrink: 0 } as const;
const CHK_OFF = { width: 18, height: 18, borderRadius: 4, border: '2px solid var(--border)', background: 'transparent', flexShrink: 0 } as const;
const FIELD_BTN = (on: boolean) => ({
  display: 'flex' as const, alignItems: 'center' as const, gap: 10, padding: '8px 12px', borderRadius: 8,
  border: `1.5px solid ${on ? 'rgba(255,255,255,.25)' : 'var(--border)'}`,
  background: on ? 'rgba(255,255,255,.04)' : 'transparent',
  color: 'var(--text)', fontSize: 13, fontFamily: "'SF Mono', 'Fira Code', monospace",
  cursor: 'pointer' as const, textAlign: 'left' as const, width: '100%' as const, transition: 'all 0.15s',
});

function PairLinesTool({ onResult }: { onResult: (r: string) => void }) {
  const [input, setInput] = useState('');
  const [delimiter, setDelimiter] = useState('|');
  const [stripSpaces, setStripSpaces] = useState(true);
  const [parsed, setParsed] = useState<{ entries: string[][], maxCols: number } | null>(null);
  const [selectedCols, setSelectedCols] = useState<Set<number>>(new Set());

  /* Parse input: split by 2+ blank lines, each paragraph → lines */
  const parse = () => {
    if (!input.trim()) return showToast('Paste some text first', 'error');
    const lines = input.split('\n');
    const blocks: string[][] = [];
    let current: string[] = [];
    let blankRun = 0;
    for (const line of lines) {
      if (line.trim() === '') {
        blankRun++;
        if (blankRun >= 2 && current.length > 0) { blocks.push(current); current = []; }
      } else {
        blankRun = 0;
        current.push(stripSpaces ? line.trim().replace(/\s+/g, '') : line.trim());
      }
    }
    if (current.length > 0) blocks.push(current);
    if (!blocks.length) return showToast('No entries found', 'error');
    const maxCols = Math.max(...blocks.map(b => b.length));
    setParsed({ entries: blocks, maxCols });
    setSelectedCols(new Set(Array.from({ length: maxCols }, (_, i) => i)));
    showToast(`${blocks.length} entries, ${maxCols} column${maxCols > 1 ? 's' : ''}`, 'info');
  };

  const toggleCol = (col: number) => setSelectedCols(prev => {
    const next = new Set(prev);
    next.has(col) ? next.delete(col) : next.add(col);
    return next;
  });

  const extractCols = () => {
    if (!parsed || !selectedCols.size) return showToast('Select at least one column', 'error');
    const output = parsed.entries
      .map(entry => {
        const cols = [...selectedCols].sort((a, b) => a - b);
        return cols.map(c => entry[c] ?? '').join(delimiter);
      })
      .join('\n');
    onResult(output);
    showToast('Extracted', 'success');
  };

  /* Build column summary: for each col, show first few values */
  const colSummaries: { col: number, values: string[] }[] = [];
  if (parsed) {
    for (let c = 0; c < parsed.maxCols; c++) {
      const values = parsed.entries.map(e => e[c]).filter(Boolean);
      colSummaries.push({ col: c, values });
    }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input className="input" value={delimiter} onChange={e => setDelimiter(e.target.value)}
          placeholder="Delim" style={{ width: 70, textAlign: 'center' }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={stripSpaces} onChange={e => setStripSpaces(e.target.checked)}
            style={{ accentColor: 'var(--accent)' }} />
          Strip spaces
        </label>
      </div>
      <textarea className="textarea" placeholder="Paste entries separated by 2+ blank lines..." value={input} onChange={e => setInput(e.target.value)} />
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={parse} style={{ flex: 1 }}>Parse</button>
        <button className="btn" onClick={() => { setInput(''); setParsed(null); setSelectedCols(new Set()); }}>Clear</button>
      </div>

      {parsed && (
        <div style={{ marginTop: 14 }}>
          <div className="list-item" style={{ padding: '10px 0' }}>
            <span className="list-item-label">{parsed.entries.length} entries &times; {parsed.maxCols} cols</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-sm btn-ghost" onClick={() => setSelectedCols(new Set(Array.from({ length: parsed.maxCols }, (_, i) => i)))}>All</button>
              <button className="btn btn-sm btn-ghost" onClick={() => setSelectedCols(new Set())}>None</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {colSummaries.map(({ col, values }) => (
              <button key={col} onClick={() => toggleCol(col)} style={FIELD_BTN(selectedCols.has(col))}>
                <span style={selectedCols.has(col) ? CHK_ON : CHK_OFF}>
                  {selectedCols.has(col) ? '\u2713' : ''}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 20 }}>Col {col + 1}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {values.slice(0, 3).join(', ')}{values.length > 3 ? '...' : ''}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 4 }}>({values.length})</span>
              </button>
            ))}
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={extractCols} disabled={!selectedCols.size}>
            Extract {selectedCols.size > 0 ? `(${selectedCols.size} col${selectedCols.size > 1 ? 's' : ''})` : ''}
          </button>
        </div>
      )}
    </>
  );
}

function ExtractFieldsTool({ onResult }: { onResult: (r: string) => void }) {
  const [input, setInput] = useState('');
  const [delimiter, setDelimiter] = useState('|');
  const [fields, setFields] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const detectDelimiter = (text: string): string => {
    const candidates = ['|', ',', ';', ':', '\t', '-'];
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return '|';
    let best = '|', bestScore = 0;
    for (const d of candidates) {
      const counts = lines.map(l => l.split(d).length);
      const score = counts[0];
      const consistent = counts.every(c => c === score);
      if (consistent && score > 1 && score > bestScore) { best = d; bestScore = score; }
    }
    return best;
  };

  const split = () => {
    if (!input.trim()) return showToast('Paste some text first', 'error');
    const dl = detectDelimiter(input);
    setDelimiter(dl);
    const regex = new RegExp(dl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const parts = input.split(regex).map(s => s.trim()).filter(s => s.length > 0);
    if (!parts.length) return showToast('No fields found', 'error');
    setFields(parts);
    setSelected(new Set());
    showToast(`Found ${parts.length} fields`, 'info');
  };

  const toggle = (i: number) => setSelected(prev => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

  const extract = () => {
    if (!selected.size) return showToast('Select at least one field', 'error');
    onResult(fields.filter((_, i) => selected.has(i)).join(delimiter === '\n' ? '\n' : delimiter));
    showToast('Extracted', 'success');
  };

  return (
    <>
      <textarea className="textarea" placeholder="Paste text here..." value={input} onChange={e => setInput(e.target.value)} />
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={split} style={{ flex: 1 }}>Split</button>
        <button className="btn" onClick={() => { setInput(''); setFields([]); setSelected(new Set()); }}>Clear</button>
      </div>
      {fields.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="list-item" style={{ padding: '10px 0' }}>
            <span className="list-item-label">{fields.length} fields</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set(fields.map((_, i) => i)))}>All</button>
              <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set())}>None</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {fields.map((f, i) => (
              <button key={i} onClick={() => toggle(i)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8,
                border: `1.5px solid ${selected.has(i) ? 'rgba(255,255,255,.25)' : 'var(--border)'}`,
                background: selected.has(i) ? 'rgba(255,255,255,.04)' : 'transparent',
                color: 'var(--text)', fontSize: 13, fontFamily: "'SF Mono', 'Fira Code', monospace",
                cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s',
              }}>
                <span style={{
                  width: 18, height: 18, borderRadius: 4,
                  border: `2px solid ${selected.has(i) ? 'rgba(255,255,255,.4)' : 'var(--border)'}`,
                  background: selected.has(i) ? 'var(--text)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, color: selected.has(i) ? 'var(--bg)' : 'transparent',
                  flexShrink: 0, transition: 'all 0.15s',
                }}>{selected.has(i) ? '\u2713' : ''}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 20 }}>{i + 1}.</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</span>
              </button>
            ))}
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={extract} disabled={!selected.size}>
            Extract {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      )}
    </>
  );
}

export default function Tools() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [activeTool, setActiveTool] = useState('');
  const [input, setInput] = useState('');
  const [option, setOption] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const mergedRef = useRef(false);

  useEffect(() => {
    if (mergedRef.current) return;
    mergedRef.current = true;

    const loadTools = (serverTools: Tool[]) => {
      // Always include local tools (pair-lines, etc.) in addition to server tools
      const seen = new Set(serverTools.map(t => t.id));
      const merged = [...serverTools, ...LOCAL_TOOLS.filter(t => !seen.has(t.id))];
      setTools(merged);
      merged.length && setActiveTool(merged[0].id);
    };

    fetch('/api/tools', { signal: AbortSignal.timeout(3000) })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => {
        if (d.tools?.length) {
          loadTools(d.tools);
        } else {
          loadTools([]);
        }
      })
      .catch(() => { loadTools([]); });
  }, []);

  const tool = tools.find(t => t.id === activeTool) || tools[0];
  const isExtractFields = activeTool === 'strip-text';
  const isPairLines = activeTool === 'pair-lines';

  const runTool = async () => {
    if (!input.trim()) return showToast('Please enter some input', 'error');
    setLoading(true);
    setResult('');
    try {
      const body: Record<string, string> = { text: input };
      if (tool?.options) body.mode = option || tool.options[0].value;
      const data = await apiFetch<{ result: string }>(`/api/tools/${activeTool}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setResult(data.result);
      showToast('Done', 'success');
    } catch (err) {
      showToast(`Error: ${err instanceof Error ? err.message : 'Unknown'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyResult = () => {
    navigator.clipboard.writeText(result);
    showToast('Copied', 'success');
  };

  if (!tools.length) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}><div className="spinner" /></div>;
  }

  return (
    <div>
      <div className="card">
        {tools.map((t, i) => (
          <button key={t.id}
            className={`list-item`}
            style={{
              width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left',
              borderBottom: i < tools.length - 1 ? '1px solid var(--border)' : 'none',
              color: 'var(--text)', padding: '14px 0',
            }}
            onClick={() => { setActiveTool(t.id); setResult(''); setInput(''); setOption(''); }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                fontSize: 14, fontWeight: 800, fontFamily: "'SF Mono', 'Fira Code', monospace",
                color: activeTool === t.id ? 'var(--text)' : 'var(--text-muted)',
                minWidth: 28, textAlign: 'center',
              }}>{t.icon}</span>
              <div>
                <div className="list-item-label" style={{ color: activeTool === t.id ? 'var(--text)' : 'var(--text-muted)' }}>{t.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t.description}</div>
              </div>
            </div>
            {activeTool === t.id && <span className="badge ok" style={{ flexShrink: 0 }}>Active</span>}
          </button>
        ))}
      </div>

      <div className="section-title">{tool?.name || 'Input'}</div>
      <div className="card">
        {isExtractFields ? (
          <ExtractFieldsTool onResult={setResult} />
        ) : isPairLines ? (
          <PairLinesTool onResult={setResult} />
        ) : (
          <>
            {tool?.options && (
              <select className="select" style={{ width: '100%', marginBottom: 10 }}
                value={option || tool.options[0].value} onChange={e => setOption(e.target.value)}>
                {tool.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
            <textarea className="textarea" placeholder={tool?.placeholder} value={input} onChange={e => setInput(e.target.value)} />
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={runTool} disabled={loading} style={{ flex: 1 }}>
                {loading && <span className="spinner" />}{loading ? 'Running...' : 'Run'}
              </button>
              <button className="btn" onClick={() => { setInput(''); setResult(''); }}>Clear</button>
            </div>
          </>
        )}
      </div>

      {result && (
        <>
          <div className="section-title">Result</div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
              <button className="btn btn-sm btn-ghost" onClick={copyResult}>Copy</button>
            </div>
            <div className="result-area">{result}</div>
          </div>
        </>
      )}
    </div>
  );
}
