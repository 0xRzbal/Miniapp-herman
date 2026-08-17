import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { showToast } from '../components/Toast';
import StatCard from '../components/farm/StatCard';
import CatBar from '../components/farm/CatBar';
import ToolCard from '../components/farm/ToolCard';
import RunModal from '../components/farm/RunModal';
import DocsModal from '../components/farm/DocsModal';
import ActiveJobBar from '../components/farm/ActiveJobBar';
import RecentJob from '../components/farm/RecentJob';
import { CATS } from '../components/farm/types';
import type { Tool, Job, ToolStatus } from '../components/farm/types';
import { useFavorites } from '../hooks/useFavorites';

export default function FarmDashboard() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [cat, setCat] = useState('farmer');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [status, setStatus] = useState<ToolStatus>({ running: 0, completed: 0, failed: 0, total: 0 });
  const [runModal, setRunModal] = useState<Tool | null>(null);
  const [docsModal, setDocsModal] = useState<Tool | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const { toggleFavorite, isFavorite } = useFavorites();

  const refresh = useCallback(async () => {
    try {
      const [t, j, st] = await Promise.all([
        apiFetch<{ tools: Tool[] }>('/api/tools/all'),
        apiFetch<{ jobs: Job[] }>('/api/tools/jobs'),
        apiFetch<ToolStatus>('/api/tools/status'),
      ]);
      setTools(t.tools);
      setJobs(j.jobs);
      setStatus(st);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 3000);
    return () => clearInterval(iv);
  }, [refresh]);

  const handleRun = async (args: Record<string, string>) => {
    if (!runModal) return;
    try {
      await apiFetch('/api/tools/run', {
        method: 'POST',
        body: JSON.stringify({ toolId: runModal.id, type: runModal.type, args }),
      });
      showToast(`Started ${runModal.name}`, 'success');
      setRunModal(null);
      refresh();
    } catch (err) {
      showToast(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`, 'error');
    }
  };

  const handleStop = async (jobId: string) => {
    try {
      await apiFetch(`/api/tools/jobs/${jobId}/stop`, { method: 'POST' });
      showToast('Stopped', 'info');
      refresh();
    } catch {}
  };

  const handleDelete = async (jobId: string) => {
    try {
      await apiFetch(`/api/tools/jobs/${jobId}`, { method: 'DELETE' });
      showToast('Deleted', 'info');
      refresh();
    } catch {}
  };

  const counts: Record<string, number> = {};
  tools.forEach(t => { counts[t.category] = (counts[t.category] || 0) + 1; });
  const filtered = tools
    .filter(t => t.category === cat)
    .filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase()));
  const runningIds = new Set(jobs.filter(j => j.status === 'running').map(j => j.toolId));
  const activeJobs = jobs.filter(j => j.status === 'running' || j.status === 'pending');

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div style={{ animation: 'spring-in 0.4s ease' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        <StatCard value={status.running} label="Running" color="#3b82f6" />
        <StatCard value={status.completed} label="Done" color="#22c55e" />
        <StatCard value={status.failed} label="Failed" color="#ef4444" />
        <StatCard value={status.total} label="Total" color="var(--text-muted)" />
      </div>

      {/* Active Jobs */}
      {activeJobs.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#3b82f6',
            marginBottom: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
            {activeJobs.length} active
          </div>
          {activeJobs.map(j => (
            <ActiveJobBar key={j.id} job={j} onStop={() => handleStop(j.id)} />
          ))}
        </div>
      )}

      {/* Categories */}
      <div style={{ marginBottom: 12 }}>
        <CatBar cats={CATS} active={cat} counts={counts} onSelect={id => { setCat(id); setSearch(''); }} />
      </div>

      {/* Search */}
      <div style={{ marginBottom: 12, position: 'relative' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${CATS.find(c => c.id === cat)?.label || ''}...`}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--bg-input)',
            color: 'var(--text)',
            fontSize: 15,
            outline: 'none',
          }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 22,
              height: 22,
              borderRadius: 11,
              background: 'rgba(255,255,255,0.08)',
              color: 'var(--text-muted)',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >x</button>
        )}
      </div>

      {/* Section Label */}
      <div style={{
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 8,
        paddingLeft: 2,
      }}>
        {CATS.find(c => c.id === cat)?.label}
        <span style={{ marginLeft: 6, opacity: 0.5 }}>({filtered.length})</span>
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 28,
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 14,
        }}>
          {search ? `No results for "${search}"` : 'Empty'}
        </div>
      )}

      {/* Tools List */}
      {filtered.map(tool => (
        <ToolCard
          key={tool.id}
          tool={tool}
          isRunning={runningIds.has(tool.id)}
          onRun={() => setRunModal(tool)}
          onDocs={() => setDocsModal(tool)}
          isFavorite={isFavorite(tool.id)}
          onToggleFavorite={() => toggleFavorite(tool.id)}
        />
      ))}

      {/* Recent Jobs */}
      {jobs.length > 0 && (
        <>
          <div style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginTop: 20,
            marginBottom: 8,
            paddingLeft: 2,
          }}>Recent</div>
          {jobs.slice(0, 10).map(j => (
            <RecentJob key={j.id} job={j} onDelete={handleDelete} />
          ))}
        </>
      )}

      {/* Modals */}
      {runModal && <RunModal tool={runModal} onRun={handleRun} onClose={() => setRunModal(null)} />}
      {docsModal && <DocsModal tool={docsModal} onClose={() => setDocsModal(null)} />}
    </div>
  );
}
