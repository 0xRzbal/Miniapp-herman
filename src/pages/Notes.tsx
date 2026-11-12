import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { showToast } from '../components/Toast';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

const fmtTime = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ── URL auto-linkify ──────────────────────────────────────────
const URL_RE = /\bhttps?:\/\/[^\s<>"']+[^\s<>"',.;!?)]/;
const LINK_STYLE = { color: 'var(--accent)', textDecoration: 'underline', wordBreak: 'break-all' as const };

function renderText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(URL_RE.source, 'g');
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={key++}>{text.slice(last, m.index)}</span>);
    const url = m[0];
    parts.push(
      <a key={key++} href={url} target="_blank" rel="noopener noreferrer" style={LINK_STYLE} onClick={e => e.stopPropagation()}>
        {url}
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<span key={key++}>{text.slice(last)}</span>);
  return parts;
}

// ── Date detection for countdown ──────────────────────────────
const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseDates(text: string): Date[] {
  const out: Date[] = [];
  // ISO yyyy-mm-dd
  const iso = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = iso.exec(text)) !== null) {
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    if (!isNaN(d.getTime())) out.push(d);
  }
  // dd Month yyyy  (12 Nov 2027 / 12 November 2027)
  const dmy = /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})\b/gi;
  while ((m = dmy.exec(text)) !== null) {
    const d = new Date(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
    if (!isNaN(d.getTime())) out.push(d);
  }
  // dd/mm/yyyy or dd-mm-yyyy
  const dm = /\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/g;
  while ((m = dm.exec(text)) !== null) {
    const d = new Date(+m[3], +m[2] - 1, +m[1]);
    if (!isNaN(d.getTime())) out.push(d);
  }
  // dedupe by epoch ms
  const seen = new Set<number>();
  return out.filter(d => { const t = d.getTime(); if (seen.has(t)) return false; seen.add(t); return true; });
}

function CountdownLine({ target }: { target: Date }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force(x => x + 1), 60000);
    return () => clearInterval(t);
  }, [target]);

  const diff = target.getTime() - Date.now();
  const past = diff < 0;
  const abs = Math.abs(diff);
  const days = Math.floor(abs / 86400000);

  return (
    <span style={{ fontFamily: "'SF Mono', monospace", fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
      {past ? '-' : ''}{days}d
    </span>
  );
}

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<{ notes: Note[] }>('/api/notes');
      setNotes(d.notes || []);
    } catch {
      showToast('Gagal muat catatan', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startNew = () => { setEditingId(null); setTitle(''); setContent(''); setShowNew(true); };
  const startEdit = (n: Note) => { setEditingId(n.id); setTitle(n.title); setContent(n.content); setShowNew(true); };

  const save = async () => {
    if (!title.trim() && !content.trim()) return showToast('Catatan kosong', 'error');
    try {
      if (editingId) {
        await apiFetch(`/api/notes/${editingId}`, { method: 'PUT', body: JSON.stringify({ title, content }) });
        showToast('Catatan diperbarui', 'success');
      } else {
        await apiFetch('/api/notes', { method: 'POST', body: JSON.stringify({ title, content }) });
        showToast('Catatan disimpan', 'success');
      }
      setShowNew(false); setEditingId(null); setTitle(''); setContent('');
      await load();
    } catch { showToast('Gagal simpan', 'error'); }
  };

  const remove = async (id: string) => {
    try {
      await apiFetch(`/api/notes/${id}`, { method: 'DELETE' });
      showToast('Catatan dihapus', 'success');
      await load();
    } catch { showToast('Gagal hapus', 'error'); }
  };

  const cancel = () => { setShowNew(false); setEditingId(null); setTitle(''); setContent(''); };

  return (
    <div style={{ animation: 'spring-in 0.4s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="section-title" style={{ margin: 0 }}>Catatan</div>
        {!showNew && <button className="btn btn-sm btn-primary" onClick={startNew}>+ Baru</button>}
      </div>

      {showNew && (
        <div className="card" style={{ marginBottom: 16 }}>
          <input className="input" placeholder="Judul" value={title} onChange={e => setTitle(e.target.value)} style={{ marginBottom: 10 }} />
          <textarea className="textarea" placeholder="Isi catatan (link otomatis jadi klik-able, tanggal otomatis dapat countdown)..." value={content} onChange={e => setContent(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={save}>{editingId ? 'Simpan' : 'Tambah'}</button>
            <button className="btn" onClick={cancel}>Batal</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}><div className="spinner" /></div>
      ) : notes.length === 0 && !showNew ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 18px' }}>
          Belum ada catatan
        </div>
      ) : (
        notes.map(n => {
          const dates = parseDates(`${n.title}\n${n.content}`);
          return (
            <div key={n.id} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {n.title && (
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6, wordBreak: 'break-word' }}>
                      {renderText(n.title)}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {renderText(n.content)}
                  </div>
                  {dates.length > 0 && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid var(--border-subtle)' }}>
                      {dates.map((d, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>⏳</span>
                          <span>{fmtTime(d.toISOString())}</span>
                          <span style={{ color: 'var(--text)' }}><CountdownLine target={d} /></span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button className="btn btn-sm btn-ghost" onClick={() => startEdit(n)}>Edit</button>
                  <button className="btn btn-sm btn-ghost" style={{ color: 'var(--error)' }} onClick={() => remove(n.id)}>Hapus</button>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>{fmtTime(n.updatedAt)}</div>
            </div>
          );
        })
      )}
    </div>
  );
}
