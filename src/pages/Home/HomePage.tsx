import React, { useEffect, useState, useRef } from 'react';
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
  Printer,
  Sparkles,
  CloudUpload,
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
  const { fetchPrinters } = useSettingsStore();
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

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

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Central file processor for Drag & Drop and File Input
  const processImportFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsImporting(true);

    try {
      const fileArr = Array.from(files);
      const pdfFiles = fileArr.filter(
        (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
      );
      const imageFiles = fileArr.filter(
        (f) => f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp|tiff)$/i.test(f.name)
      );

      const allAssets: any[] = [];
      createNewJob(`Job (${fileArr.length} files)`);

      // Process image files
      for (let i = 0; i < imageFiles.length; i++) {
        const f = imageFiles[i];
        let dataUrl = '';
        if (window.electronAPI && (f as any).path) {
          try {
            dataUrl = await window.electronAPI.readFileAsDataUrl((f as any).path);
          } catch {
            dataUrl = await readFileAsDataUrl(f);
          }
        } else {
          dataUrl = await readFileAsDataUrl(f);
        }

        allAssets.push({
          id: crypto.randomUUID(),
          job_id: 'pending',
          original_path: (f as any).path || f.name,
          original_name: f.name,
          mime_type: f.type || 'image/jpeg',
          file_extension: f.name.split('.').pop() || 'jpg',
          file_size_bytes: f.size,
          source_width: null,
          source_height: null,
          page_count: 1,
          asset_type: 'image' as const,
          import_status: 'ready' as const,
          sort_order: allAssets.length,
          created_at: new Date().toISOString(),
          preview_url: dataUrl,
        });
      }

      // Process PDF files
      for (const pdf of pdfFiles) {
        let pdfDataUrl = '';
        if (window.electronAPI && (pdf as any).path) {
          try {
            pdfDataUrl = await window.electronAPI.readFileAsDataUrl((pdf as any).path);
          } catch {
            pdfDataUrl = await readFileAsDataUrl(pdf);
          }
        } else {
          pdfDataUrl = await readFileAsDataUrl(pdf);
        }

        const pages = await renderPdfPages(pdfDataUrl);
        pages.forEach((p) => {
          allAssets.push({
            id: crypto.randomUUID(),
            job_id: 'pending',
            original_path: (pdf as any).path || pdf.name,
            original_name: `${pdf.name} (P.${p.pageIndex})`,
            mime_type: 'image/jpeg',
            file_extension: 'pdf',
            file_size_bytes: pdf.size,
            source_width: p.width,
            source_height: p.height,
            page_count: 1,
            asset_type: 'pdf_page' as const,
            import_status: 'ready' as const,
            sort_order: allAssets.length,
            created_at: new Date().toISOString(),
            preview_url: p.dataUrl,
          });
        });
      }

      if (allAssets.length > 0) {
        addAssets(allAssets);
        onNavigate('editor');
      }
    } catch (err) {
      console.error('Failed to process dropped/selected files:', err);
    } finally {
      setIsImporting(false);
      setIsDragging(false);
    }
  };

  // Open Image Picker (Electron Dialog with HTML Input fallback)
  const handleOpenFiles = async () => {
    if (window.electronAPI) {
      try {
        const files = await window.electronAPI.selectImages();
        if (files && files.length > 0) {
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
        }
        return;
      } catch (err) {
        console.warn('Electron dialog failed, falling back to browser input:', err);
      }
    }

    // HTML5 File Input fallback
    fileInputRef.current?.click();
  };

  // Open PDF Picker (Electron Dialog with HTML Input fallback)
  const handleOpenPdf = async () => {
    if (window.electronAPI) {
      try {
        const pdfFile = await window.electronAPI.selectPdf();
        if (pdfFile) {
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
        }
        return;
      } catch (err) {
        console.warn('Electron PDF dialog failed, falling back to browser input:', err);
      }
    }

    // HTML5 File Input fallback
    pdfInputRef.current?.click();
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

  // Drag and drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processImportFiles(e.dataTransfer.files);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '32px 40px',
        maxWidth: '1360px',
        margin: '0 auto',
        width: '100%',
        position: 'relative',
      }}
    >
      {/* Hidden File Inputs for 100% Guaranteed Box Opening */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/bmp,image/tiff"
        style={{ display: 'none' }}
        onChange={(e) => e.target.files && processImportFiles(e.target.files)}
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => e.target.files && processImportFiles(e.target.files)}
      />

      {/* Full-screen Drag Overlay when user drags files over window */}
      {isDragging && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(37, 99, 235, 0.15)',
            backdropFilter: 'blur(4px)',
            border: '3px dashed var(--accent-blue)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              padding: '24px 36px',
              backgroundColor: '#ffffff',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <CloudUpload size={48} color="var(--accent-blue)" />
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Drop Images or PDF files here
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Release to instantly import into PrintMate Workspace
            </p>
          </div>
        </div>
      )}

      {/* Hero Banner in Light Mode */}
      <div
        className="glass-card"
        style={{
          padding: '32px 36px',
          background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 60%, #eff6ff 100%)',
          border: '1px solid var(--border-medium)',
          marginBottom: '28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{ maxWidth: '640px', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span className="badge badge-cyan">OFFLINE-FIRST STUDIO</span>
            <span className="badge badge-green">₹0 OPERATING COST</span>
          </div>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 800,
              letterSpacing: '-0.5px',
              color: 'var(--text-primary)',
              marginBottom: '10px',
            }}
          >
            Welcome to PrintMate Studio
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Professional document alignment, photocopy text darkening, passport photo 8-up grids, and ID card front &
            back layouts with exact physical millimeter accuracy.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', zIndex: 1 }}>
          <button
            className="btn btn-primary"
            style={{ padding: '12px 20px', fontSize: '14px' }}
            onClick={handleOpenFiles}
            disabled={isImporting}
          >
            <Upload size={18} />
            {isImporting ? 'Importing...' : 'Import Images'}
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '12px 20px', fontSize: '14px' }}
            onClick={handleOpenPdf}
            disabled={isImporting}
          >
            <FileText size={18} color="var(--accent-magenta)" />
            Import PDF
          </button>
        </div>
      </div>

      {/* Prominent Drag & Drop Zone */}
      <div
        onClick={handleOpenFiles}
        style={{
          border: '2px dashed var(--border-medium)',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--bg-secondary)',
          padding: '24px 32px',
          marginBottom: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          cursor: 'pointer',
          transition: 'all var(--transition-normal)',
          boxShadow: 'var(--shadow-sm)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent-blue)';
          e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.03)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-medium)';
          e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CloudUpload size={24} color="var(--accent-blue)" />
        </div>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px' }}>
            Drag and Drop your scans, photos, or PDFs here
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            or click to browse files from your computer (supports JPG, PNG, WEBP, BMP, PDF)
          </div>
        </div>
      </div>

      {/* Quick Workflow Workspaces in Light Mode */}
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
                backgroundColor: 'rgba(2, 132, 199, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <UserCheck size={22} color="var(--accent-cyan)" />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
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
                backgroundColor: 'rgba(79, 70, 229, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <CreditCard size={22} color="var(--accent-indigo)" />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
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
                backgroundColor: 'rgba(219, 39, 119, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <Sparkles size={22} color="var(--accent-magenta)" />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
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
                backgroundColor: 'rgba(5, 150, 105, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <FilePlus size={22} color="var(--accent-emerald)" />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
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
                      backgroundColor: 'var(--bg-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Printer size={18} color="var(--accent-blue)" />
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '3px' }}>
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
