import { useState, useEffect } from 'react';
import { APP_NAME, APP_VERSION } from '../config';
import { apiFetch } from '../lib/api';

interface MiniappOnlySettings {
  hub: boolean;
  mail: boolean;
  router: boolean;
}

export default function Settings() {
  const [miniappOnly, setMiniappOnly] = useState<MiniappOnlySettings>({ hub: false, mail: false, router: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ miniapp_only: MiniappOnlySettings | boolean }>('/api/settings')
      .then((s) => {
        const mo = s.miniapp_only;
        if (typeof mo === 'object' && mo !== null) {
          setMiniappOnly({ hub: !!mo.hub, mail: !!mo.mail, router: !!mo.router });
        } else {
          // Backward compat: old boolean → apply to all
          const val = !!mo;
          setMiniappOnly({ hub: val, mail: val, router: val });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleService = async (service: keyof MiniappOnlySettings) => {
    const next = { ...miniappOnly, [service]: !miniappOnly[service] };
    setMiniappOnly(next);
    try {
      await apiFetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify({ key: 'miniapp_only', value: next }),
      });
    } catch {
      setMiniappOnly(miniappOnly); // revert on error
    }
  };

  const services: { key: keyof MiniappOnlySettings; label: string; desc: string }[] = [
    { key: 'hub', label: 'Full Access', desc: 'Block external browser access. Only Telegram Mini App allowed' },
    { key: 'mail', label: 'Mail', desc: 'Block JoeMail external browser access.' },
    { key: 'router', label: '9Router', desc: 'Block 9Router external browser access.' },
  ];

  return (
    <div>
      <div className="section-title">Access Control</div>
      <div className="card">
        {services.map((svc, i) => (
          <div className="toggle-row" key={svc.key} style={i === services.length - 1 ? { borderBottom: 'none' } : undefined}>
            <div>
              <span className="list-item-label">MiniApp Only — {svc.label}</span>
              <div className="list-item-desc">{svc.desc}</div>
            </div>
            <button
              className={`toggle ${miniappOnly[svc.key] ? 'active' : ''}`}
              onClick={() => toggleService(svc.key)}
              disabled={loading}
            />
          </div>
        ))}
      </div>

      <div className="section-title">About</div>
      <div className="card">
        <div className="list-item">
          <span className="list-item-label">App</span>
          <span className="list-item-value">{APP_NAME}</span>
        </div>
        <div className="list-item">
          <span className="list-item-label">Version</span>
          <span className="list-item-value">{APP_VERSION}</span>
        </div>
        <div className="list-item" style={{ borderBottom: 'none' }}>
          <span className="list-item-label">Powered by</span>
          <span className="list-item-value">Hermes Agent</span>
        </div>
      </div>
    </div>
  );
}
