import { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { tabs, projects } from './config';
import type { ProjectConfig } from './config';
import Toast from './components/Toast';

const Home = lazy(() => import('./pages/Home'));
const MailPage = lazy(() => import('./pages/MailPage'));
const Tools = lazy(() => import('./pages/Tools'));
const Settings = lazy(() => import('./pages/Settings'));
const ProtectedPage = lazy(() => import('./pages/ProtectedPage'));

// Wrapper to bind project config to ProtectedPage
function makeProjectPage(project: ProjectConfig): React.FC {
  return function ProjectPageWrapper() {
    return <ProtectedPage project={project} />;
  };
}

// Static page map
const staticPages: Record<string, React.LazyExoticComponent<React.FC>> = {
  home: Home,
  mail: MailPage,
  tools: Tools,
  settings: Settings,
};

// Build full page map: static + project pages
function buildPageMap(): Record<string, React.LazyExoticComponent<React.FC>> {
  const map = { ...staticPages };
  for (const project of projects) {
    if (project.enabled) {
      map[project.id] = lazy(() =>
        Promise.resolve({ default: makeProjectPage(project) })
      );
    }
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

  const switchTab = useCallback((id: string) => {
    setActiveTab(id);
    window.history.replaceState(null, '', `#${id}`);
    try { localStorage.setItem('activeTab', id); } catch {}
  }, []);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.expand();
      tg.ready();
      tg.onEvent('viewportChanged', () => tg.expand());
    }
    const setVH = () => {
      document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    };
    setVH();
    window.addEventListener('resize', setVH);
    return () => window.removeEventListener('resize', setVH);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.slice(1).toLowerCase();
      if (hash && VALID_TABS.has(hash)) {
        setActiveTab(hash);
        try { localStorage.setItem('activeTab', hash); } catch {}
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && pageMap[detail]) switchTab(detail);
    };
    window.addEventListener('navigate', handler);
    return () => window.removeEventListener('navigate', handler);
  }, [switchTab]);

  const Page = pageMap[activeTab] || Home;

  return (
    <div className="app">
      <main className="app-content">
        <Suspense fallback={<LoadingFallback />}>
          <Page />
        </Suspense>
      </main>

      <nav className="tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => switchTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <Toast />
    </div>
  );
}
