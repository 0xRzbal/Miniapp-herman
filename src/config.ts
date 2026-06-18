export interface Tab {
  id: string;
  label: string;
  icon: string;
  type?: 'page' | 'project';
  project?: ProjectConfig;
}

export interface ProjectConfig {
  id: string;
  name: string;
  icon: string;
  url: string;
  domain: string;
  entryPath: string;
  port: number;
  enabled: boolean;
}

export const APP_NAME = 'rzbal Hub';
export const APP_VERSION = '1.0.0';

// Static tabs (non-project pages)
const staticTabs: Tab[] = [
  { id: 'home', label: 'Home', icon: '\u2302', type: 'page' },
  { id: 'mail', label: 'Mail', icon: '\u2709', type: 'page' },
  { id: 'tools', label: 'Tools', icon: '\u2692', type: 'page' },
];

// Project tabs loaded from projects.json (injected at build time)
declare const __PROJECTS__: ProjectConfig[];
export const projects: ProjectConfig[] = typeof __PROJECTS__ !== 'undefined' ? __PROJECTS__ : [];

const projectTabs: Tab[] = projects
  .filter(p => p.enabled)
  .map(p => ({
    id: p.id,
    label: p.name,
    icon: p.icon,
    type: 'project' as const,
    project: p,
  }));

// Settings tab always last
const settingsTab: Tab = { id: 'settings', label: 'Settings', icon: '\u2699', type: 'page' };

export const tabs: Tab[] = [...staticTabs, ...projectTabs, settingsTab];
