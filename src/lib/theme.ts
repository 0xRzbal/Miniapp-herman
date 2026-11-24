export type Theme = 'dark';

const CHROME = '#1a1a1a';

/** The hub ships dark-only; kept as a function so callers stay unchanged. */
export function getTheme(): Theme {
  return 'dark';
}

export function applyTheme(_theme?: Theme) {
  const root = document.documentElement;
  root.classList.add('dark');
  root.style.colorScheme = 'dark';
  root.setAttribute('data-theme', 'dark');
  try { localStorage.removeItem('hub-theme'); } catch {}

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', CHROME);

  const tg = (window as any).Telegram?.WebApp;
  if (tg) {
    try { tg.setHeaderColor?.(CHROME); tg.setBackgroundColor?.(CHROME); } catch {}
  }
  window.dispatchEvent(new Event('hub-theme-change'));
}
