import { useState } from 'react';
import { apiFetch } from '../lib/api';
import { showToast } from '../components/Toast';

export default function OTPage() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fullUrl = result ? `${window.location.origin}${result}` : null;

  const handleCreate = async () => {
    if (!text.trim()) { showToast('Isi teks dulu'); return; }
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
      showToast(msg);
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
      showToast('Tidak bisa salin otomatis');
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 48px' }}>
      <h1 style={{ fontSize: 24, letterSpacing: '-0.03em', marginBottom: 6 }}>Burn-after-read</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>
        Buat link sekali-baca: isi teks, bagikan link-nya, dan link hanya bisa dibuka 1 kali lalu hancur.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Tulis rahasia / pesan yang mau dibagikan sekali pakai…"
          style={{
            minHeight: 140, padding: 12, borderRadius: 10,
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--ink)', fontSize: 14, lineHeight: 1.5, resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={handleCreate}
            disabled={busy}
            style={{
              padding: '10px 20px', borderRadius: 10, cursor: busy ? 'wait' : 'pointer',
              background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 600,
            }}
          >
            {busy ? 'Membuat…' : 'Buat link'}
          </button>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>
            maks 100.000 karakter
          </span>
        </div>

        {result && fullUrl && (
          <div style={{
            marginTop: 8, padding: 14, borderRadius: 12,
            border: '1px solid var(--border-strong)', background: 'var(--canvas-2)',
          }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
              Link siap dibagikan (hanya bisa dibuka 1x):
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <code style={{
                flex: 1, wordBreak: 'break-all', fontSize: 13,
                padding: '8px 10px', borderRadius: 8, background: 'var(--surface)',
                border: '1px solid var(--border)',
              }}>
                {fullUrl}
              </code>
              <button
                onClick={handleCopy}
                style={{
                  padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                  background: 'var(--accent)', color: '#fff', border: 'none', minWidth: 80,
                }}
              >
                {copied ? 'Tersalin ✓' : 'Salin'}
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 12 }}>
              <button
                onClick={() => { setResult(null); setText(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12 }}
              >
                Buat lagi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
