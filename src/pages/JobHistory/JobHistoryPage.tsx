import React, { useState, useEffect } from 'react';
import { History, Search, Trash2, FolderOpen, Printer, Calendar, Clock, ArrowRight } from 'lucide-react';
import { useJobStore } from '../../stores/jobStore';
import { TabId } from '../../components/layout/Header';

interface JobHistoryPageProps {
  onNavigate: (tab: TabId) => void;
}

export const JobHistoryPage: React.FC<JobHistoryPageProps> = ({ onNavigate }) => {
  const { loadJobFromDb } = useJobStore();
  const [jobs, setJobs] = useState<any[]>([]);
  const [search, setSearch] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setIsLoading(true);
    if (window.electronAPI) {
      try {
        const list = await window.electronAPI.listRecentJobs(50);
        setJobs(list);
      } catch (err) {
        console.error('Failed to load jobs list:', err);
      }
    }
    setIsLoading(false);
  };

  const handleOpenJob = async (jobId: string) => {
    const success = await loadJobFromDb(jobId);
    if (success) {
      onNavigate('layout');
    }
  };

  const handleDelete = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this job history record?')) return;
    if (window.electronAPI) {
      await window.electronAPI.deleteJob(jobId);
      loadJobs();
    }
  };

  const filtered = jobs.filter((j) =>
    (j.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '32px 40px',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Job History & Archives
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            All print jobs are persisted in local SQLite storage. Reopen any job to resume or reprint.
          </p>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: '280px' }}>
          <Search
            size={16}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="input-text"
            style={{ paddingLeft: '36px' }}
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          Loading jobs from SQLite database...
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center' }}>
          <History size={48} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
            No print jobs found
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Completed and draft jobs will be listed here automatically.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map((job) => (
            <div
              key={job.id}
              className="glass-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                cursor: 'pointer',
              }}
              onClick={() => handleOpenJob(job.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Printer size={20} color="var(--accent-blue)" />
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {job.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <span>
                      Created: {new Date(job.created_at).toLocaleDateString()}
                    </span>
                    <span>
                      Updated: {new Date(job.updated_at).toLocaleDateString()} at{' '}
                      {new Date(job.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="badge badge-blue">{job.status}</span>
                <button
                  className="btn btn-ghost"
                  style={{ padding: '8px' }}
                  onClick={(e) => handleDelete(e, job.id)}
                  title="Delete from SQLite database"
                >
                  <Trash2 size={16} color="var(--text-muted)" />
                </button>
                <button className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '12px' }}>
                  <span>Open Job</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
