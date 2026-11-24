import { useState, useEffect, lazy, Suspense, useCallback, useRef } from 'react';
import { tabs, projects } from './config';
import type { ProjectConfig } from './config';
import Icon from './components/Icon';
import { haptic } from './lib/telegram';
import { getTheme, applyTheme } from './lib/theme';
import type { Theme } from './lib/theme';
import type { IconName } from './components/Icon';
import Toast from './components/Toast';
import AuthModal from './components/AuthModal';
import ErrorBoundary from './components/ErrorBoundary';

const Home = lazy(() => import('./pages/Home'));
const FarmDashboard = lazy(() => import('./pages/FarmDashboard'));
const MailPage = lazy(() => import('./pages/MailPage'));
const Tools = lazy(() => import('./pages/Tools'));
const Notes = lazy(() => import('./pages/Notes'));
const ProtectedPage = lazy(() => import('./pages/ProtectedPage'));

function makeProjectPage(project: ProjectConfig): React.FC {
  return function ProjectPageWrapper() { return <ProtectedPage project={project} />; };
}

const staticPages: Record<string, React.LazyExoticComponent<React.FC>> = {
  home: Home, farm: FarmDashboard, mail: MailPage, tools: Tools, notes: Notes,
};

function buildPageMap(): Record<string, React.LazyExoticComponent<React.FC>> {
  const map = { ...staticPages };
  for (const project of projects) {
    if (project.enabled) map[project.id] = lazy(() => Promise.resolve({ default: makeProjectPage(project) }));
  }
  return map;
}

const pageMap = buildPageMap();
const VALID_TABS = new Set(tabs.map(t => t.id));

function getInitialTab(): string {
  const hash = window.location.hash.slice(1).toLowerCase();
  if (hash && VALID_TABS.has(hash)) return hash;
  const stored = localStorage.getItem('activeTab');
  if (stored && VALID_TABS.has(stored)) return stored;
  return tabs[0].id;
}

function LoadingFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
      <div className="spinner" />
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [user, setUser] = useState<{ id: string; username: string; role: string } | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [theme, setTheme] = useState<Theme>(getTheme);

  useEffect(() => { applyTheme(theme); }, [theme]);

  // Check for existing auth on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('auth_user');
    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
      } catch {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    }
  }, []);

  const handleLogin = useCallback((_userData: { id: string; username: string; role: string }, _token: string) => {
    setUser(_userData);
    setShowAuth(false);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setUser(null);
  }, []);

  const switchTab = useCallback((id: string) => {
    haptic('light');
    setActiveTab(id);
    window.history.replaceState(null, '', `#${id}`);
    try { localStorage.setItem('activeTab', id); } catch {}
  }, []);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) { tg.expand(); tg.ready(); tg.onEvent('viewportChanged', () => tg.expand()); }
    const setVH = () => { document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`); };
    setVH(); window.addEventListener('resize', setVH);
    return () => window.removeEventListener('resize', setVH);
  }, []);

  useEffect(() => { document.documentElement.setAttribute('data-theme', 'dark'); }, []);

  useEffect(() => {
    const onHashChange = () => {
      let hash = window.location.hash.slice(1).toLowerCase();
      if (hash === 'settings') hash = 'home'; // Settings merged into Home
      if (hash && VALID_TABS.has(hash)) { setActiveTab(hash); try { localStorage.setItem('activeTab', hash); } catch {} }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => { const detail = (e as CustomEvent).detail; if (detail && pageMap[detail]) switchTab(detail); };
    window.addEventListener('navigate', handler);
    return () => window.removeEventListener('navigate', handler);
  }, [switchTab]);

  const Page = pageMap[activeTab] || Home;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollMemory = useRef<Record<string, number>>({});
  const prevTab = useRef(activeTab);

  // remember per-tab scroll position so switching tabs feels native
  const activeTabRef = useRef(activeTab);
  const restoring = useRef(false);
  activeTabRef.current = activeTab;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (restoring.current) return;
      scrollMemory.current[activeTabRef.current] = el.scrollTop;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (prevTab.current === activeTab || !el) return;
    const target = scrollMemory.current[activeTab] ?? 0;
    prevTab.current = activeTab;
    if (!target) { el.scrollTop = 0; return; }
    // content mounts (and fetches) lazily: keep re-applying until the page is tall enough
    restoring.current = true;
    let tries = 0;
    const restore = () => {
      el.scrollTop = target;
      const done = Math.abs(el.scrollTop - target) <= 2 || tries++ > 20;
      if (done) { restoring.current = false; return; }
      setTimeout(restore, 60);
    };
    requestAnimationFrame(restore);
  }, [activeTab]);

  return (
    <div className="app">
      <nav className="tab-bar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-logo">🐴</div>
          <div>
            <div className="sidebar-brand-name">rzbal Hub</div>
            <div className="sidebar-brand-sub">Operator Console</div>
          </div>
        </div>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`tab-item ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              aria-label={tab.label}
              onClick={() => switchTab(tab.id)}
            >
              <span className="tab-icon">
                <Icon name={tab.icon as IconName} size={22} color={isActive ? 'var(--accent)' : 'var(--text-muted)'} />
              </span>
              <span className="tab-label">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="app-main">
        <div className="hub-bar">
          <div className="hub-bar-left">
            <span className="hub-bar-name">rzbal Hub</span>
            <span className="hub-bar-sub">{tabs.find(t => t.id === activeTab)?.label ?? ''}</span>
          </div>
          <button
            className="theme-toggle"
            onClick={() => { haptic('light'); setTheme(t => (t === 'dark' ? 'light' : 'dark')); }}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              </svg>
            )}
            {theme === 'dark' ? 'Dark' : 'Light'}
          </button>
        </div>

        {/* Header with user info */}
        {user && (
          <div className="app-header">
            <div className="app-header-left">
              <Icon name="settings" size={16} color="var(--text-muted)" />
              <span className="app-header-user">{user.username}</span>
              <span className="app-header-role">{user.role}</span>
            </div>
            <button className="app-header-logout" onClick={handleLogout}>Logout</button>
          </div>
        )}

        <main className="app-content" ref={scrollRef}>
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              <div key={activeTab} className="page-transition">
                <Page />
              </div>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {/* Auth Modal */}
      {showAuth && <AuthModal onLogin={handleLogin} />}

      <Toast />
    </div>
  );
}
