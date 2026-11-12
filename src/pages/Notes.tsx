import { useState, useEffect } from 'react';
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
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    try {
      const d = await apiFetch<{ notes: Note[] }>('/api/notes');
      setNotes(d.notes || []);
    } catch {
      showToast('Gagal muat catatan', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const startNew = () => {
    setEditingId(null); setTitle(''); setContent(''); setShowNew(true);
  };

  const startEdit = (n: Note) => {
    setEditingId(n.id); setTitle(n.title); setContent(n.content); setShowNew(true);
  };

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
          <textarea className="textarea" placeholder="Isi catatan..." value={content} onChange={e => setContent(e.target.value)} />
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
        notes.map(n => (
          <div key={n.id} className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {n.title && <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4, wordBreak: 'break-word' }}>{n.title}</div>}
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{n.content}</div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button className="btn btn-sm btn-ghost" onClick={() => startEdit(n)}>Edit</button>
                <button className="btn btn-sm btn-ghost" style={{ color: 'var(--error)' }} onClick={() => remove(n.id)}>Hapus</button>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>{fmtTime(n.updatedAt)}</div>
          </div>
        ))
      )}
    </div>
  );
}
