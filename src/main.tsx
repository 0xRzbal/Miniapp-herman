import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './App.css';

function showLanding() {
  document.getElementById('splash')?.remove();
  document.getElementById('root')!.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#1a1a1a;font-family:Inter,-apple-system,sans-serif;color:#f5f5f5;padding:24px">
      <div style="background:#242424;border:1px solid rgba(71,71,71,.8);border-radius:14px;padding:40px;max-width:420px;width:100%;text-align:center;box-shadow:0 0 0 1px rgba(255,107,74,.045),0 10px 26px rgba(0,0,0,.22)">
        <div style="width:56px;height:56px;border-radius:14px;background:#ff6b4a;display:grid;place-items:center;margin:0 auto 20px;font-size:24px">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 10l-4 4l6 6l4-16l-18 7l4 2l2 6l3-4"/></svg>
        </div>
        <div style="display:inline-block;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a1a1aa;background:rgba(255,255,255,.06);border:1px solid rgba(63,63,70,.5);border-radius:8px;padding:6px 14px;margin-bottom:16px">Telegram Mini App</div>
        <h1 style="font-size:22px;margin-bottom:8px">rzbal Hub</h1>
        <p style="color:#808080;font-size:14px;line-height:1.6">This app is available exclusively inside Telegram.</p>
        <div style="margin-top:24px;font-size:11px;color:#555">by rzbal</div>
      </div>
    </div>`;
}

function mountApp() {
  createRoot(document.getElementById('root')!).render(<App />);
  requestAnimationFrame(() => {
    const splash = document.getElementById('splash');
    if (splash) {
      splash.classList.add('hide');
      setTimeout(() => splash.remove(), 300);
    }
  });
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}

// Wait for window.load so async scripts (Telegram SDK) have executed
function boot() {
  // Telegram SDK creates window.Telegram.WebApp in ALL environments.
  // Only trust it when initData is non-empty (= real Telegram MiniApp session).
  const tg = (window as any).Telegram?.WebApp;
  const isTg = !!(tg && tg.initData);
  if (isTg) {
    mountApp();
    return;
  }
  fetch('/api/settings')
    .then(r => r.json())
    .then(s => {
      const mo = s.miniapp_only;
      const hubLocked = typeof mo === 'object' ? !!mo.hub : !!mo;
      if (hubLocked) showLanding();
      else mountApp();
    })
    .catch(() => mountApp());
}

if (document.readyState === 'complete') {
  boot();
} else {
  window.addEventListener('load', boot);
}
