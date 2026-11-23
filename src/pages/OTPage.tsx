import { useState } from 'react';
import { apiFetch } from '../lib/api';
import { showToast } from '../components/Toast';

/**
 * Burn-after-read secret link tool.
 * Embedded inside the Tools page (the former standalone "Secret" tab).
 */
export default function SecretLinkTool() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fullUrl = result ? `${window.location.origin}${result}` : null;

  const handleCreate = async () => {
    if (!text.trim()) { showToast('Isi teks dulu', 'error'); return; }
    setBusy(true);
    try {
      const res = await apiFetch<{ token: string; url: string }>('/api/ot/create', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      setResult(res.url);
      setCopied(false);
    } catch (e: any) {
      const msg = (e?.message || '').includes('401') ? 'Sesi login kedaluwarsa, login ulang' : `Gagal: ${e?.message || e}`;
      showToast(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!fullUrl) return;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Tidak bisa salin otomatis', 'error');
    }
  };

  return (
    <>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 12 }}>
        Link sekali-baca: teks dihapus setelah dibuka 1 kali. Maks 100.000 karakter.
      </p>

      <textarea
        className="textarea"
        style={{ minHeight: 140 }}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Tulis rahasia / pesan yang mau dibagikan sekali pakai..."
      />

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
        <button className="btn btn-primary" onClick={handleCreate} disabled={busy} style={{ flex: 1 }}>
          {busy && <span className="spinner" />}{busy ? 'Membuat...' : 'Buat link'}
        </button>
        <button className="btn" onClick={() => { setText(''); setResult(null); }}>Clear</button>
      </div>

      {result && fullUrl && (
        <div className="card" style={{ marginTop: 14, marginBottom: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 700 }}>
            Link siap dibagikan (1x buka)
          </div>
          <div className="result-area" style={{ fontSize: 12.5, marginBottom: 10 }}>{fullUrl}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm btn-primary" onClick={handleCopy} style={{ flex: 1 }}>
              {copied ? 'Tersalin' : 'Salin link'}
            </button>
            <button className="btn btn-sm" onClick={() => { setResult(null); setText(''); }}>Buat lagi</button>
          </div>
        </div>
      )}
    </>
  );
}
