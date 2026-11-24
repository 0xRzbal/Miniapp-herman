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

function highlight(text: string, q: string, keyBase: number): React.ReactNode[] {
  if (!q) return [<span key={keyBase}>{text}</span>];
  const out: React.ReactNode[] = [];
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  let i = 0;
  let k = 0;
  while (true) {
    const at = lower.indexOf(needle, i);
    if (at === -1) break;
    if (at > i) out.push(<span key={`${keyBase}-${k++}`}>{text.slice(i, at)}</span>);
    out.push(<mark key={`${keyBase}-${k++}`} className="hl">{text.slice(at, at + needle.length)}</mark>);
    i = at + needle.length;
  }
  if (i < text.length) out.push(<span key={`${keyBase}-${k++}`}>{text.slice(i)}</span>);
  return out;
}

function renderText(text: string, query = ''): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(URL_RE.source, 'g');
  let key = 0;
  const q = query.trim();
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(...highlight(text.slice(last, m.index), q, key++));
    const url = m[0];
    const label = shortLabel(url);
    parts.push(
      <a
        key={`l${key++}`}
        className="note-link"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={url}
        onClick={e => e.stopPropagation()}
      >
        {q && label.toLowerCase().includes(q.toLowerCase())
          ? <mark className="hl">{label}</mark>
          : label}
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(...highlight(text.slice(last), q, key++));
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

type CatId = 'all' | 'project' | 'bounty' | 'farm' | 'infra' | 'other';

const CAT_MATCHERS: { id: Exclude<CatId, 'all' | 'other'>; label: string; re: RegExp }[] = [
  { id: 'project', label: 'Project', re: /^\s*project\s*:/i },
  { id: 'bounty', label: 'Bounty', re: /bounty|vulnerab|exploit|pentest|hunting|bug\s?hunt|poc\b/i },
  { id: 'farm', label: 'Farm', re: /farm|airdrop|mining|mint|claim|regist|account|account\b/i },
  { id: 'infra', label: 'Infra', re: /vps|nginx|docker|systemd|cron|domain|dns|server|ssl|port\b/i },
];

function catOf(note: { title: string; content: string }): CatId {
  const hay = `${note.title}\n${note.content}`;
  for (const m of CAT_MATCHERS.slice(1)) if (m.re.test(hay)) return m.id;
  if (CAT_MATCHERS[0].re.test(note.title)) return 'project';
  return 'other';
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
  const [cat, setCat] = useState<CatId>('all');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const bodyRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pressTimer = useRef<number | null>(null);

  // press "/" to jump into search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setConfirmId(null);
        setBulkConfirm(false);
        setSelectMode(false);
        setSelected(new Set());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const [deleting, setDeleting] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState(false);

  const CLAMP_H = 125;

  const toggleExpand = (id: string) => {
    const el = bodyRefs.current[id];
    const isOpen = expanded.has(id);
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    if (!el) return;
    const from = Math.round(el.getBoundingClientRect().height);
    el.style.maxHeight = from + 'px';
    requestAnimationFrame(() => {
      const to = isOpen ? CLAMP_H : el.scrollHeight;
      const anim = el.animate(
        [{ maxHeight: `${from}px` }, { maxHeight: `${to}px` }],
        { duration: 240, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
      );
      const settle = () => { el.style.maxHeight = isOpen ? `${CLAMP_H}px` : 'none'; };
      anim.onfinish = settle;
      anim.oncancel = settle;
    });
  };

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

  const DRAFT_KEY = 'hub-note-draft';

  // restore an unfinished draft (tab switch, webview reload, app kill)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as { id?: string | null; title?: string; content?: string; at?: number };
      if (!d || (!(d.title || '').trim() && !(d.content || '').trim())) return;
      if (Date.now() - (d.at || 0) > 7 * 864e5) { localStorage.removeItem(DRAFT_KEY); return; }
      setEditingId(d.id ?? null);
      setTitle(d.title || '');
      setContent(d.content || '');
      setShowNew(true);
      showToast('Draft dipulihkan', 'success');
    } catch {}
  }, []);

  // keep the draft on disk while typing (debounced)
  useEffect(() => {
    if (!showNew) return;
    const t = setTimeout(() => {
      try {
        if (!title.trim() && !content.trim()) { localStorage.removeItem(DRAFT_KEY); return; }
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ id: editingId, title, content, at: Date.now() }));
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [showNew, editingId, title, content]);

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
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
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

  const cancel = () => {
    setShowNew(false); setEditingId(null); setTitle(''); setContent('');
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
  };

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

  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };

  const cancelPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };

  const startPress = (id: string) => {
    if (selectMode) return;
    cancelPress();
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null;
      haptic('medium');
      setSelectMode(true);
      setSelected(new Set([id]));
    }, 450);
  };

  useEffect(() => cancelPress, []);

  const toggleSelect = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const bulkPin = async (pinned: boolean) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setBulkBusy(true);
    const snapshot = notes;
    setNotes(prev => sortNotes(prev.map(x => (selected.has(x.id) ? { ...x, pinned } : x))));
    try {
      await Promise.all(ids.map(id => apiFetch(`/api/notes/${id}`, { method: 'PUT', body: JSON.stringify({ pinned }) })));
      setNotes(prev => sortNotes(prev.map(x => (selected.has(x.id) ? { ...x, pinned } : x))));
      haptic('success');
      showToast(pinned ? `${ids.length} catatan disematkan` : `Semat ${ids.length} catatan dilepas`, 'success');
      exitSelect();
    } catch {
      setNotes(snapshot);
      showToast('Gagal menyematkan', 'error');
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      await Promise.all(ids.map(id => apiFetch(`/api/notes/${id}`, { method: 'DELETE' })));
      setNotes(prev => prev.filter(n => !selected.has(n.id)));
      showToast(`${ids.length} catatan dihapus`, 'success');
      haptic('success');
      setBulkConfirm(false);
      exitSelect();
    } catch {
      showToast('Gagal hapus', 'error');
    } finally {
      setBulkBusy(false);
    }
  };

  useEffect(() => {
    if (!confirmId && !showNew) return;
    return bindBackButton(() => {
      if (confirmId) { setConfirmId(null); return; }
      if (bulkConfirm) { setBulkConfirm(false); return; }
      if (showNew) cancel();
    });
  }, [confirmId, showNew, bulkConfirm]);

  useEffect(() => {
    if (!selectMode) return;
    return bindBackButton(() => exitSelect());
  }, [selectMode]);

  const catCounts = useMemo(() => {
    const c: Record<string, number> = { all: notes.length, project: 0, bounty: 0, farm: 0, infra: 0, other: 0 };
    for (const n of notes) c[catOf(n)] = (c[catOf(n)] || 0) + 1;
    return c;
  }, [notes]);

  const pinnedCount = useMemo(() => notes.filter(n => n.pinned).length, [notes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter(n => {
      if (pinnedOnly && !n.pinned) return false;
      if (cat !== 'all' && catOf(n) !== cat) return false;
      if (!q) return true;
      return `${n.title}\n${n.content}`.toLowerCase().includes(q);
    });
  }, [notes, query, cat, pinnedOnly]);

  const shownIds = filtered.map(n => n.id);
  const allShownSelected = shownIds.length > 0 && shownIds.every(id => selected.has(id));

  return (
    <div style={{ animation: 'fade-in 0.3s ease' }}>
      <div className="notes-head">
        <div className="section-title" style={{ margin: 0, padding: 0 }}>
          Catatan
          <span className="notes-count">{notes.length}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {!showNew && notes.length > 0 && (
            <button className={`btn btn-sm${selectMode ? '' : ' btn-ghost'}`} onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}>
              {selectMode ? 'Batal' : 'Pilih'}
            </button>
          )}
          {!showNew && !selectMode && <button className="btn btn-sm btn-primary" onClick={startNew}>+ Baru</button>}
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

      {!loading && notes.length > 0 && (
        <div className="cat-bar" role="tablist" aria-label="Kategori catatan">
          {pinnedCount > 0 && (
            <button
              type="button"
              aria-pressed={pinnedOnly}
              className={`cat-chip pin-chip${pinnedOnly ? ' active' : ''}`}
              onClick={() => setPinnedOnly(v => !v)}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill={pinnedOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 17v5" /><path d="M9 10.5V4h6v6.5l2 3.5H7l2-3.5z" />
              </svg>
              Semat
              <span className="cat-chip-count">{pinnedCount}</span>
            </button>
          )}
          {(['all', 'project', 'bounty', 'farm', 'infra', 'other'] as CatId[]).map(id => {
            const label = id === 'all' ? 'Semua' : id === 'other' ? 'Lainnya' : CAT_MATCHERS.find(m => m.id === id)!.label;
            const count = catCounts[id] || 0;
            if (id !== 'all' && count === 0) return null;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={cat === id}
                className={`cat-chip${cat === id ? ' active' : ''}`}
                onClick={() => setCat(id)}
              >
                {label}
                <span className="cat-chip-count">{count}</span>
              </button>
            );
          })}
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
          {notes.length > 0 && (cat !== 'all' || pinnedOnly) && (
            <div style={{ marginTop: 10 }}>
              <button className="btn btn-sm" onClick={() => { setCat('all'); setPinnedOnly(false); }}>Reset filter</button>
            </div>
          )}
          {notes.length === 0 ? 'Tekan "+ Baru" untuk mulai mencatat.' : `Tidak ada catatan yang cocok dengan "${query}".`}
        </div>
      ) : (
        <div className={`note-grid${selectMode ? ' selecting' : ''}`}>
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
                className={`card note-card${selectMode ? ' selectable' : ''}${selected.has(n.id) ? ' selected' : ''}`}
                style={{ marginBottom: 0 }}
                onClick={selectMode ? () => toggleSelect(n.id) : undefined}
                onPointerDown={selectMode ? undefined : () => startPress(n.id)}
                onPointerUp={cancelPress}
                onPointerLeave={cancelPress}
                onPointerCancel={cancelPress}
                onContextMenu={e => { if (pressTimer.current) e.preventDefault(); }}
              >
                <div className="note-card-head">
                  {selectMode && (
                    <span className={`note-check${selected.has(n.id) ? ' on' : ''}`} aria-hidden="true">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </span>
                  )}
                  <div className="note-title">
                    {n.pinned && <span className="note-pin-mark" title="Disematkan">●</span>}
                    {renderText(n.title || 'Tanpa judul', query)}
                  </div>
                  <div className="note-actions" style={selectMode ? { display: 'none' } : undefined}>
                    <button
                      className={`note-act${n.pinned ? ' on' : ''}`}
                      aria-label={n.pinned ? 'Lepas semat' : 'Sematkan'}
                      title={n.pinned ? 'Lepas semat' : 'Sematkan'}
                      onClick={() => togglePin(n)}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill={n.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 17v5" /><path d="M9 10.5V4h6v6.5l2 3.5H7l2-3.5z" />
                      </svg>
                    </button>
                    <button className="note-act" aria-label="Edit" title="Edit" onClick={() => startEdit(n)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                      </svg>
                    </button>
                    <button className="note-act danger" aria-label="Hapus" title="Hapus" onClick={() => setConfirmId(n.id)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div
                  ref={el => {
                    bodyRefs.current[n.id] = el;
                    if (el && !el.style.maxHeight) el.style.maxHeight = expanded.has(n.id) ? 'none' : `${CLAMP_H}px`;
                  }}
                  className={`note-body note-body-anim${expanded.has(n.id) ? '' : ' is-clamped'}`}
                >{renderText(n.content, query)}</div>
                {n.content.length > 220 && (
                  <button className="note-more" onClick={() => toggleExpand(n.id)}>
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
                <div className="note-meta">{fmtTime(n.updatedAt)}</div>
              </div>
            );
          })}
        </div>
      )}

      {selectMode && (
        <div className="bulk-bar">
          <button className="bulk-link" onClick={() => setSelected(allShownSelected ? new Set() : new Set(shownIds))}>
            {allShownSelected ? 'Kosongkan' : 'Pilih semua'}
          </button>
          <span className="bulk-count">{selected.size} dipilih</span>
          <div className="bulk-acts">
            <button className="bulk-btn" disabled={!selected.size || bulkBusy} onClick={() => bulkPin(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 17v5" /><path d="M9 10.5V4h6v6.5l2 3.5H7l2-3.5z" />
              </svg>
              Semat
            </button>
            <button className="bulk-btn" disabled={!selected.size || bulkBusy} onClick={() => bulkPin(false)}>Lepas</button>
            <button className="bulk-btn danger" disabled={!selected.size || bulkBusy} onClick={() => setBulkConfirm(true)}>Hapus</button>
          </div>
        </div>
      )}

      {bulkConfirm && (
        <div className="confirm-overlay" onClick={() => !bulkBusy && setBulkConfirm(false)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()}>
            <div className="confirm-title">Hapus {selected.size} catatan?</div>
            <div className="confirm-text">{Array.from(selected).map(id => notes.find(n => n.id === id)?.title || 'Tanpa judul').slice(0, 3).join(' · ')}{selected.size > 3 ? ` · +${selected.size - 3} lagi` : ''}</div>
            <div className="confirm-sub">Catatan yang dihapus tidak bisa dikembalikan.</div>
            <div className="confirm-actions">
              <button className="btn" style={{ flex: 1 }} onClick={() => setBulkConfirm(false)} disabled={bulkBusy}>Batal</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={bulkDelete} disabled={bulkBusy}>
                {bulkBusy ? 'Menghapus...' : 'Hapus semua'}
              </button>
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
