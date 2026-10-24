import React, { useEffect, useState } from 'react';
import {
  FilePlus,
  Image as ImageIcon,
  FileText,
  CreditCard,
  UserCheck,
  Upload,
  ArrowRight,
  Clock,
  Trash2,
  Copy,
  Printer,
  Sparkles,
  CheckCircle,
  FolderOpen,
} from 'lucide-react';
import { useJobStore } from '../../stores/jobStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { TabId } from '../../components/layout/Header';
import { renderPdfPages } from '../../utils/pdf-engine';

interface HomePageProps {
  onNavigate: (tab: TabId) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { createNewJob, addAssets, loadJobFromDb, applyLayoutPreset, applyIdCardFrontBackLayout } =
    useJobStore();
  const { selectedPrinter, fetchPrinters } = useSettingsStore();
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetchPrinters();
    loadRecentJobs();
  }, []);

  const loadRecentJobs = async () => {
    if (window.electronAPI) {
      try {
        const jobs = await window.electronAPI.listRecentJobs(10);
        setRecentJobs(jobs);
      } catch (e) {
        console.error('Failed to list recent jobs:', e);
      }
    }
  };

  const handleCreateNew = (preset?: 'passport' | 'id_card' | 'blank') => {
    createNewJob();
    if (preset === 'passport') {
      applyLayoutPreset('passport_in', 8);
    } else if (preset === 'id_card') {
      applyIdCardFrontBackLayout();
    }
    onNavigate('editor');
  };

  const handleOpenFiles = async () => {
    if (!window.electronAPI) return;
    try {
      const files = await window.electronAPI.selectImages();
      if (files.length === 0) return;

      createNewJob(`Job (${files.length} images)`);
      const newAssets = await Promise.all(
        files.map(async (f, idx) => {
          const dataUrl = await window.electronAPI!.readFileAsDataUrl(f.path);
          return {
            id: crypto.randomUUID(),
            job_id: 'pending',
            original_path: f.path,
            original_name: f.name,
            mime_type: 'image/jpeg',
            file_extension: f.name.split('.').pop() || 'jpg',
            file_size_bytes: f.size,
            source_width: null,
            source_height: null,
            page_count: 1,
            asset_type: 'image' as const,
            import_status: 'ready' as const,
            sort_order: idx,
            created_at: new Date().toISOString(),
            preview_url: dataUrl,
          };
        })
      );

      addAssets(newAssets);
      onNavigate('editor');
    } catch (err) {
      console.error('Failed to import images:', err);
    }
  };

  const handleOpenPdf = async () => {
    if (!window.electronAPI) return;
    try {
      const pdfFile = await window.electronAPI.selectPdf();
      if (!pdfFile) return;

      const pdfDataUrl = await window.electronAPI.readFileAsDataUrl(pdfFile.path);
      const renderedPages = await renderPdfPages(pdfDataUrl);

      createNewJob(`PDF: ${pdfFile.name}`);

      const newAssets = renderedPages.map((p, idx) => ({
        id: crypto.randomUUID(),
        job_id: 'pending',
        original_path: pdfFile.path,
        original_name: `${pdfFile.name} (Page ${p.pageIndex})`,
        mime_type: 'image/jpeg',
        file_extension: 'pdf',
        file_size_bytes: pdfFile.size,
        source_width: p.width,
        source_height: p.height,
        page_count: 1,
        asset_type: 'pdf_page' as const,
        import_status: 'ready' as const,
        sort_order: idx,
        created_at: new Date().toISOString(),
        preview_url: p.dataUrl,
      }));

      addAssets(newAssets);
      onNavigate('editor');
    } catch (err) {
      console.error('Failed to import PDF:', err);
    }
  };

  const handleResumeJob = async (jobId: string) => {
    const success = await loadJobFromDb(jobId);
    if (success) {
      onNavigate('layout');
    }
  };

  const handleDeleteJob = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    if (!window.confirm('Delete this print job history record? (Original source files remain safe)')) return;
    if (window.electronAPI) {
      await window.electronAPI.deleteJob(jobId);
      loadRecentJobs();
    }
  };

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '32px 40px',
        maxWidth: '1360px',
        margin: '0 auto',
        width: '100%',
      }}
    >
      {/* Hero Banner */}
      <div
        className="glass-card"
        style={{
          padding: '32px 36px',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)',
          border: '1px solid var(--border-medium)',
          marginBottom: '32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ maxWidth: '640px', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="badge badge-cyan">OFFLINE-FIRST ENGINE</span>
            <span className="badge badge-green">₹0 OPERATING COST</span>
          </div>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 800,
              letterSpacing: '-0.5px',
              color: '#ffffff',
              marginBottom: '10px',
            }}
          >
            Welcome to PrintMate Studio
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Professional document alignment, faded text darkening, passport photo 8-up grids, and ID card front &
            back preparation with millimetre physical accuracy.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', zIndex: 1 }}>
          <button className="btn btn-primary" style={{ padding: '12px 20px', fontSize: '14px' }} onClick={handleOpenFiles}>
            <Upload size={18} />
            Import Images
          </button>
          <button className="btn btn-secondary" style={{ padding: '12px 20px', fontSize: '14px' }} onClick={handleOpenPdf}>
            <FileText size={18} color="var(--accent-magenta)" />
            Import PDF
          </button>
        </div>
      </div>

      {/* Quick Workflow Workspaces */}
      <div style={{ marginBottom: '36px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
          One-Click Xerox & Print Workflows
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '16px',
          }}
        >
          {/* Card 1: Indian Passport Photo */}
          <div
            className="glass-card"
            style={{ padding: '20px', cursor: 'pointer' }}
            onClick={() => handleCreateNew('passport')}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(6, 182, 212, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <UserCheck size={22} color="var(--accent-cyan)" />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
              Passport Photos (8-up)
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              Standard 35×45 mm photos arranged on A4 sheet with border guides & exact crop.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--accent-cyan)', fontWeight: 600 }}>
              <span>Launch Preset</span>
              <ArrowRight size={14} />
            </div>
          </div>

          {/* Card 2: ID Card Front & Back */}
          <div
            className="glass-card"
            style={{ padding: '20px', cursor: 'pointer' }}
            onClick={() => handleCreateNew('id_card')}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <CreditCard size={22} color="var(--accent-indigo)" />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
              ID Card Front & Back
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              Aadhaar, PAN, and Voter ID cards aligned at 85.6×54 mm stacked on a single sheet.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--accent-indigo)', fontWeight: 600 }}>
              <span>Launch Preset</span>
              <ArrowRight size={14} />
            </div>
          </div>

          {/* Card 3: Document Xerox / Text Darkener */}
          <div
            className="glass-card"
            style={{ padding: '20px', cursor: 'pointer' }}
            onClick={() => handleCreateNew('blank')}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(236, 72, 153, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <Sparkles size={22} color="var(--accent-magenta)" />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
              Xerox Text Darkener
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              Make faded photocopies and mobile phone photos crisp with auto-straighten & deskew.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--accent-magenta)', fontWeight: 600 }}>
              <span>Start Job</span>
              <ArrowRight size={14} />
            </div>
          </div>

          {/* Card 4: New Blank Canvas */}
          <div
            className="glass-card"
            style={{ padding: '20px', cursor: 'pointer' }}
            onClick={() => handleCreateNew('blank')}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <FilePlus size={22} color="var(--accent-emerald)" />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
              Custom Print Layout
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              A4, A3, or Letter canvas with custom margins, N-up grids, and manual placement.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--accent-emerald)', fontWeight: 600 }}>
              <span>Start Blank</span>
              <ArrowRight size={14} />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Jobs Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Recent Print Jobs
          </h2>
          <button className="btn btn-ghost" style={{ fontSize: '12px' }} onClick={() => onNavigate('history')}>
            View Full History
            <ArrowRight size={14} />
          </button>
        </div>

        {recentJobs.length === 0 ? (
          <div
            className="glass-panel"
            style={{
              padding: '40px',
              textAlign: 'center',
              color: 'var(--text-secondary)',
            }}
          >
            <Clock size={36} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              No recent print jobs found
            </p>
            <p style={{ fontSize: '13px' }}>
              Import images or start a new print job above to begin.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentJobs.slice(0, 5).map((job) => (
              <div
                key={job.id}
                className="glass-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 20px',
                  cursor: 'pointer',
                }}
                onClick={() => handleResumeJob(job.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-elevated)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Printer size={18} color="var(--accent-blue)" />
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', marginBottom: '3px' }}>
                      {job.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Updated {new Date(job.updated_at).toLocaleDateString()} at{' '}
                      {new Date(job.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="badge badge-blue">{job.status}</span>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: '6px' }}
                    onClick={(e) => handleDeleteJob(e, job.id)}
                    title="Delete Job"
                  >
                    <Trash2 size={16} color="var(--text-muted)" />
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                    Open Job
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
