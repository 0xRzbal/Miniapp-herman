import { useState, useEffect } from 'react';
import { APP_NAME, APP_VERSION } from '../config';
import { apiFetch } from '../lib/api';

interface MiniappOnlySettings { hub: boolean; mail: boolean; router: boolean; }

export default function Settings() {
  const [miniappOnly, setMiniappOnly] = useState<MiniappOnlySettings>({ hub: false, mail: false, router: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ miniapp_only: MiniappOnlySettings | boolean }>('/api/settings')
      .then(s => {
        const mo = s.miniapp_only;
        if (typeof mo === 'object' && mo !== null) setMiniappOnly({ hub: !!mo.hub, mail: !!mo.mail, router: !!mo.router });
        else { const v = !!mo; setMiniappOnly({ hub: v, mail: v, router: v }); }
      }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggle = async (svc: keyof MiniappOnlySettings) => {
    const next = { ...miniappOnly, [svc]: !miniappOnly[svc] };
    setMiniappOnly(next);
    try { await apiFetch('/api/settings', { method: 'POST', body: JSON.stringify({ key: 'miniapp_only', value: next }) }); }
    catch { setMiniappOnly(miniappOnly); }
  };

  const services: { key: keyof MiniappOnlySettings; label: string; desc: string }[] = [
    { key: 'hub', label: 'Full Access', desc: 'Block external browser access. Telegram Mini App only' },
    { key: 'mail', label: 'Mail', desc: 'Block JoeMail external browser access' },
    { key: 'router', label: '9Router', desc: 'Block 9Router external browser access' },
  ];

  return (
    <div style={{ animation: 'spring-in 0.4s ease' }}>
      <div className="section-title">Access Control</div>
      <div className="card">
        {services.map(svc => (
          <div key={svc.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '0.5px solid var(--border)' }}>
            <div>
              <span className="list-item-label">{svc.label}</span>
              <div className="list-item-desc">{svc.desc}</div>
            </div>
            <button className={`toggle ${miniappOnly[svc.key] ? 'active' : ''}`} onClick={() => toggle(svc.key)} disabled={loading} />
          </div>
        ))}
      </div>

      <div className="section-title">About</div>
      <div className="card">
        <div className="list-item"><span className="list-item-label">App</span><span className="list-item-value">{APP_NAME}</span></div>
        <div className="list-item"><span className="list-item-label">Version</span><span className="list-item-value">{APP_VERSION}</span></div>
        <div className="list-item"><span className="list-item-label">Engine</span><span className="list-item-value">Hermes Agent</span></div>
      </div>
    </div>
  );
}
