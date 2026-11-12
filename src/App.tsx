import { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { tabs, projects } from './config';
import type { ProjectConfig } from './config';
import Icon from './components/Icon';
import type { IconName } from './components/Icon';
import Toast from './components/Toast';
import AuthModal from './components/AuthModal';
import ErrorBoundary from './components/ErrorBoundary';

const Home = lazy(() => import('./pages/Home'));
const FarmDashboard = lazy(() => import('./pages/FarmDashboard'));
const MailPage = lazy(() => import('./pages/MailPage'));
const Tools = lazy(() => import('./pages/Tools'));
const Notes = lazy(() => import('./pages/Notes'));
const Settings = lazy(() => import('./pages/Settings'));
const ProtectedPage = lazy(() => import('./pages/ProtectedPage'));

function makeProjectPage(project: ProjectConfig): React.FC {
  return function ProjectPageWrapper() { return <ProtectedPage project={project} />; };
}

const staticPages: Record<string, React.LazyExoticComponent<React.FC>> = {
  home: Home, farm: FarmDashboard, mail: MailPage, tools: Tools, notes: Notes, settings: Settings,
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
      const hash = window.location.hash.slice(1).toLowerCase();
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

  return (
    <div className="app">
      {/* Header with user info */}
      {user && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="settings" size={16} color="var(--text-muted)" />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{user.username}</span>
            <span style={{
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 4,
              background: user.role === 'admin' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255, 255, 255, 0.06)',
              color: user.role === 'admin' ? '#22c55e' : 'var(--text-muted)',
            }}>{user.role}</span>
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >Logout</button>
        </div>
      )}

      <main className="app-content">
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <Page />
          </Suspense>
        </ErrorBoundary>
      </main>

      <nav className="tab-bar">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`tab-item ${isActive ? 'active' : ''}`}
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

      {/* Auth Modal */}
      {showAuth && <AuthModal onLogin={handleLogin} />}

      <Toast />
    </div>
  );
}
