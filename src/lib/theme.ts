export type Theme = 'light' | 'dark';

const KEY = 'hub-theme';
const CHROME: Record<Theme, string> = { light: '#fdfaf6', dark: '#1a1a1a' };

export function getTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  return 'dark';
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  root.setAttribute('data-theme', theme);
  try { localStorage.setItem(KEY, theme); } catch {}

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', CHROME[theme]);

  const tg = (window as any).Telegram?.WebApp;
  if (tg) {
    try { tg.setHeaderColor?.(CHROME[theme]); tg.setBackgroundColor?.(CHROME[theme]); } catch {}
  }
  window.dispatchEvent(new Event('hub-theme-change'));
}
