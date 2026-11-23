import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { apiFetch } from '../lib/api';
import { showToast } from '../components/Toast';
import { SkeletonCard } from '../components/Skeleton';
import { haptic, bindBackButton } from '../lib/telegram';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
}

const sortNotes = (list: Note[]) => [...list].sort((a, b) => {
  if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
  return (b.updatedAt || '').localeCompare(a.updatedAt || '');
});

const fmtTime = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ── URL auto-linkify (short label, full URL on click) ─────────
const URL_RE = /\bhttps?:\/\/[^\s<>"']+[^\s<>"',.;!?)]/;

function shortLabel(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const path = u.pathname;
    if (/(^|\.)docs\.google\.com$/.test(host)) {
      if (path.includes('/spreadsheets')) return 'spreadsheet';
      if (path.includes('/document')) return 'document';
      if (path.includes('/presentation')) return 'slides';
      if (path.includes('/forms')) return 'form';
      return 'google-docs';
    }
    if (/(^|\.)drive\.google\.com$/.test(host)) return 'drive';
    if (/(^|\.)script\.google(usercontent)?\.com$/.test(host)) return 'apps-script';
    if (host === 'raw.githubusercontent.com') {
      const seg = path.split('/').filter(Boolean);
      return seg.length >= 2 ? `gh-raw/${seg[1]}` : 'gh-raw';
    }
    if (/(^|\.)youtube\.com$/.test(host) || host === 'youtu.be') return 'youtube';
    if (host === 'github.com') {
      const seg = path.split('/').filter(Boolean);
      if (seg.length >= 2) return `github/${seg[0]}/${seg[1]}`;
      return seg[0] ? `github/${seg[0]}` : 'github';
    }
    if (host === 'x.com' || host === 'twitter.com') {
      const seg = path.split('/').filter(Boolean);
      return seg[0] ? `x/${seg[0]}` : 'x';
    }
    const seg = path.split('/').filter(Boolean)[0];
    let label = seg ? `${host}/${seg}` : host;
    if (label.length > 30) label = label.slice(0, 29) + '…';
    return label;
  } catch {
    return url.length > 30 ? url.slice(0, 29) + '…' : url;
  }
}

function renderText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(URL_RE.source, 'g');
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={key++}>{text.slice(last, m.index)}</span>);
    const url = m[0];
    const label = shortLabel(url);
    parts.push(
      <a
        key={key++}
        className="note-link"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={url}
        onClick={e => e.stopPropagation()}
      >
        {label}
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
  const iso = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = iso.exec(text)) !== null) {
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    if (!isNaN(d.getTime())) out.push(d);
  }
  const dmy = /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})\b/gi;
  while ((m = dmy.exec(text)) !== null) {
    const d = new Date(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
    if (!isNaN(d.getTime())) out.push(d);
  }
  const dm = /\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/g;
  while ((m = dm.exec(text)) !== null) {
    const d = new Date(+m[3], +m[2] - 1, +m[1]);
    if (!isNaN(d.getTime())) out.push(d);
  }
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
  const days = Math.floor(Math.abs(diff) / 86400000);
  return <span className="note-date-val">{past ? '-' : ''}{days}d</span>;
}

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  // press "/" to jump into search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') setConfirmId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const [deleting, setDeleting] = useState(false);

  const toggleExpand = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<{ notes: Note[] }>('/api/notes');
      setNotes(sortNotes(d.notes || []));
      setLoadError(false);
    } catch {
      setLoadError(true);
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
      haptic('success');
      await load();
    } catch { showToast('Gagal simpan', 'error'); }
  };

  const remove = async (id: string) => {
    setDeleting(true);
    try {
      await apiFetch(`/api/notes/${id}`, { method: 'DELETE' });
      showToast('Catatan dihapus', 'success');
      setExpanded(prev => { const n = new Set(prev); n.delete(id); return n; });
      setNotes(prev => prev.filter(n => n.id !== id));
      setConfirmId(null);
      haptic('success');
      load().catch(() => {});
    } catch {
      showToast('Gagal hapus', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const cancel = () => { setShowNew(false); setEditingId(null); setTitle(''); setContent(''); };

  const togglePin = async (n: Note) => {
    const next = !n.pinned;
    setNotes(prev => sortNotes(prev.map(x => x.id === n.id ? { ...x, pinned: next } : x)));
    try {
      await apiFetch(`/api/notes/${n.id}`, { method: 'PUT', body: JSON.stringify({ pinned: next }) });
      haptic('light');
      showToast(next ? 'Catatan disematkan' : 'Semat dilepas', 'success');
    } catch {
      setNotes(prev => sortNotes(prev.map(x => x.id === n.id ? { ...x, pinned: !next } : x)));
      showToast('Gagal menyematkan', 'error');
    }
  };

  const exportNotes = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), count: notes.length, notes }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rzbal-notes-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const detailNote = detailId ? notes.find(n => n.id === detailId) || null : null;

  useEffect(() => {
    if (!confirmId && !detailId && !showNew) return;
    return bindBackButton(() => {
      if (confirmId) { setConfirmId(null); return; }
      if (detailId) { setDetailId(null); return; }
      if (showNew) cancel();
    });
  }, [confirmId, detailId, showNew]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(n => `${n.title}\n${n.content}`.toLowerCase().includes(q));
  }, [notes, query]);

  return (
    <div style={{ animation: 'fade-in 0.3s ease' }}>
      <div className="notes-head">
        <div className="section-title" style={{ margin: 0, padding: 0 }}>
          Catatan
          <span className="notes-count">{notes.length}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {notes.length > 0 && <button className="btn btn-sm" onClick={exportNotes}>Export</button>}
          {!showNew && <button className="btn btn-sm btn-primary" onClick={startNew}>+ Baru</button>}
        </div>
      </div>

      {showNew && !editingId && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="note-edit-head">Catatan baru</div>
          <input className="input" placeholder="Judul" value={title} onChange={e => setTitle(e.target.value)} style={{ marginBottom: 10 }} />
          <textarea
            className="textarea"
            rows={Math.min(18, Math.max(6, content.split('\n').length + 1))}
            placeholder="Isi catatan (link otomatis jadi klik-able, tanggal otomatis dapat countdown)..."
            value={content}
            onChange={e => setContent(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={save}>Tambah</button>
            <button className="btn" onClick={cancel}>Batal</button>
          </div>
        </div>
      )}

      {!loading && notes.length > 0 && (
        <div className="search-wrap">
          <span className="search-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
            </svg>
          </span>
          <input
            ref={searchRef}
            className="search-input"
            placeholder="Cari catatan..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button className="search-clear" aria-label="Hapus pencarian" onClick={() => { setQuery(''); searchRef.current?.focus(); }}>
              ×
            </button>
          )}
        </div>
      )}

      {loadError && !loading ? (
        <div className="empty-state">
          <strong>Gagal memuat catatan</strong>
          Koneksi ke server bermasalah.
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-sm btn-primary" onClick={() => { setLoading(true); load(); }}>Coba lagi</button>
          </div>
        </div>
      ) : loading ? (
        <div className="note-grid">
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} lines={i % 2 === 0 ? 3 : 2} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <strong>{notes.length === 0 ? 'Belum ada catatan' : 'Tidak ada hasil'}</strong>
          {notes.length === 0 ? 'Tekan "+ Baru" untuk mulai mencatat.' : `Tidak ada catatan yang cocok dengan "${query}".`}
        </div>
      ) : (
        <div className="note-grid">
          {filtered.map(n => {
            const dates = parseDates(`${n.title}\n${n.content}`);
            if (editingId === n.id) {
              return (
                <div key={n.id} className="card note-edit-card" style={{ marginBottom: 0 }}>
                  <div className="note-edit-head">Edit catatan</div>
                  <input className="input" placeholder="Judul" value={title} onChange={e => setTitle(e.target.value)} style={{ marginBottom: 10 }} />
                  <textarea
                    className="textarea"
                    rows={Math.min(20, Math.max(6, content.split('\n').length + 1))}
                    value={content}
                    onChange={e => setContent(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={save}>Simpan</button>
                    <button className="btn" onClick={cancel}>Batal</button>
                  </div>
                </div>
              );
            }
            return (
              <div
                key={n.id}
                className="card note-card"
                role="button"
                tabIndex={0}
                onClick={() => { haptic('light'); setDetailId(n.id); }}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailId(n.id); } }}
                style={{ marginBottom: 0 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {n.title && (
                      <div className="note-title">
                        {n.pinned && <span className="note-pin-mark" title="Disematkan">●</span>}
                        {renderText(n.title)}
                      </div>
                    )}
                    <div className={`note-body${expanded.has(n.id) ? '' : ' note-body-clamp'}`}>{renderText(n.content)}</div>
                    {n.content.length > 220 && (
                      <button
                        className="note-more"
                        onClick={e => { e.stopPropagation(); toggleExpand(n.id); }}
                        onKeyDown={e => e.stopPropagation()}
                      >
                        {expanded.has(n.id) ? 'Ringkas ▲' : 'Selengkapnya ▼'}
                      </button>
                    )}
                    {dates.length > 0 && (
                      <div className="note-dates">
                        {dates.map((d, i) => (
                          <div key={i} className="note-date-row">
                            <span style={{ color: 'var(--accent)' }}>⏳</span>
                            <span>{fmtTime(d.toISOString())}</span>
                            <CountdownLine target={d} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="note-card-chevron" aria-hidden="true">›</span>
                </div>
                <div className="note-meta">{fmtTime(n.updatedAt)}</div>
              </div>
            );
          })}
        </div>
      )}

      {detailNote && (
        <div className="confirm-overlay" onClick={() => setDetailId(null)}>
          <div className="note-sheet" onClick={e => e.stopPropagation()}>
            <div className="note-sheet-head">
              <div className="note-sheet-title">
                {detailNote.pinned && <span className="note-pin-mark" />}
                {detailNote.title || 'Tanpa judul'}
              </div>
              <button className="note-sheet-close" aria-label="Tutup" onClick={() => setDetailId(null)}>×</button>
            </div>
            <div className="note-sheet-body">{renderText(detailNote.content)}</div>
            {parseDates(`${detailNote.title}
${detailNote.content}`).map((d, i) => (
              <div key={i} className="note-date-row" style={{ marginTop: 8 }}>
                <span style={{ color: 'var(--accent)' }}>⏳</span>
                <span>{fmtTime(d.toISOString())}</span>
                <CountdownLine target={d} />
              </div>
            ))}
            <div className="note-sheet-meta">Diperbarui {fmtTime(detailNote.updatedAt)}</div>
            <div className="note-sheet-actions">
              <button
                className={`btn btn-sm${detailNote.pinned ? ' btn-pin-active' : ''}`}
                onClick={() => togglePin(detailNote)}
              >
                {detailNote.pinned ? 'Lepas semat' : 'Sematkan'}
              </button>
              <button className="btn btn-sm" onClick={() => { setDetailId(null); startEdit(detailNote); }}>Edit</button>
              <button className="btn btn-sm btn-danger" onClick={() => { setDetailId(null); setConfirmId(detailNote.id); }}>Hapus</button>
            </div>
          </div>
        </div>
      )}

      {confirmId && (
        <div className="confirm-overlay" onClick={() => !deleting && setConfirmId(null)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()}>
            <div className="confirm-title">Hapus catatan ini?</div>
            <div className="confirm-text">
              {notes.find(n => n.id === confirmId)?.title || 'Catatan tanpa judul'}
            </div>
            <div className="confirm-sub">Catatan yang dihapus tidak bisa dikembalikan.</div>
            <div className="confirm-actions">
              <button className="btn" style={{ flex: 1 }} onClick={() => setConfirmId(null)} disabled={deleting}>Batal</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => remove(confirmId)} disabled={deleting}>
                {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
