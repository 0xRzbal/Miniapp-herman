export interface ToolArg { name: string; label: string; type: 'text' | 'number' | 'flag'; default: string | boolean; placeholder?: string; }
export interface Tool { id: string; name: string; description: string; category: string; type: string; env?: string[]; args?: ToolArg[]; quota?: string; features?: string[]; modules?: string[]; }
export interface Job { id: string; toolId: string; status: string; output: string; error: string; cmd?: string; startedAt: string | null; finishedAt: string | null; pid: number | null; liveOutput?: string; }
export interface ToolStatus { running: number; completed: number; failed: number; total: number; }

import type { IconName } from '../Icon';

export const CATS: { id: string; label: string; icon: IconName; color: string }[] = [
  { id: 'farmer', label: 'Farmers', icon: 'farm', color: '#22c55e' },
  { id: 'quest', label: 'Quests', icon: 'quest', color: '#3b82f6' },
  { id: 'social', label: 'Social', icon: 'social', color: '#a855f7' },
  { id: 'utility', label: 'Utils', icon: 'utility', color: '#f59e0b' },
  { id: 'doc', label: 'Docs', icon: 'doc', color: '#ef4444' },
];

export const STATUS_MAP: Record<string, { c: string; l: string }> = {
  pending: { c: 'var(--text-muted)', l: 'Pending' },
  running: { c: '#3b82f6', l: 'Running' },
  completed: { c: '#22c55e', l: 'Done' },
  error: { c: '#ef4444', l: 'Error' },
  stopped: { c: '#f59e0b', l: 'Stopped' },
  timeout: { c: '#f97316', l: 'Timeout' },
};
