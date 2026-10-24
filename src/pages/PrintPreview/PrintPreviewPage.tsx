import React, { useState, useEffect } from 'react';
import {
  Printer,
  FileDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Copy,
  Layers,
  ArrowLeft,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { useJobStore } from '../../stores/jobStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { TabId } from '../../components/layout/Header';
import { generatePrintPdf } from '../../utils/pdf-engine';
import { ColorMode, DuplexMode, ScalingMode } from '../../types';

interface PrintPreviewPageProps {
  onNavigate: (tab: TabId) => void;
}

export const PrintPreviewPage: React.FC<PrintPreviewPageProps> = ({ onNavigate }) => {
  const { pages, activePageIndex, setActivePageIndex, assets, edits, currentJob } = useJobStore();
  const { printers, selectedPrinter, setSelectedPrinter, fetchPrinters, isLoadingPrinters } =
    useSettingsStore();

  const [copies, setCopies] = useState<number>(1);
  const [colorMode, setColorMode] = useState<ColorMode>('color');
  const [duplexMode, setDuplexMode] = useState<DuplexMode>('simplex');
  const [scalingMode, setScalingMode] = useState<ScalingMode>('actual_size');
  const [pageRange, setPageRange] = useState<string>('all');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    fetchPrinters();
  }, []);

  const currentPage = pages[activePageIndex] || pages[0];
  const assetMap = new Map(assets.map((a) => [a.id, a]));

  if (!currentPage) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>No pages configured yet.</p>
      </div>
    );
  }

  // Calculate screen preview scale
  const scale = 620 / currentPage.height_mm;
  const pagePxW = currentPage.width_mm * scale;
  const pagePxH = currentPage.height_mm * scale;

  // Handle Export to PDF
  const handleExportPdf = async () => {
    setIsExporting(true);
    setStatusMessage(null);
    try {
      const pdfBytes = await generatePrintPdf(pages, assets, edits);
      const defaultName = `${currentJob?.name || 'PrintJob'}.pdf`.replace(/[\\/:*?"<>|]/g, '_');

      if (window.electronAPI) {
        const savePath = await window.electronAPI.saveExportFile(defaultName, ['pdf']);
        if (savePath) {
          // Convert Uint8Array to base64
          let binary = '';
          const len = pdfBytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(pdfBytes[i]);
          }
          const base64 = btoa(binary);

          await window.electronAPI.writeExportBuffer(savePath, base64);
          setStatusMessage({ type: 'success', text: `Exported PDF successfully to ${savePath}` });
        }
      } else {
        // Fallback in browser: trigger standard file download
        const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultName;
        a.click();
        URL.revokeObjectURL(url);
        setStatusMessage({ type: 'success', text: 'Downloaded PDF successfully!' });
      }
    } catch (err: any) {
      console.error('Failed to export PDF:', err);
      setStatusMessage({ type: 'error', text: `Export failed: ${err.message || 'Unknown error'}` });
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Print Submission
  const handlePrint = async () => {
    setIsPrinting(true);
    setStatusMessage(null);
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.submitPrint({
          printerName: selectedPrinter,
          copies,
          colorMode,
          duplexMode,
          orientation: currentPage.orientation,
          paperSize: currentPage.paper_size,
        });

        if (result.success) {
          setStatusMessage({
            type: 'success',
            text: `Submitted print job to ${selectedPrinter || 'default printer'}`,
          });
        } else {
          setStatusMessage({
            type: 'error',
            text: `Printer error: ${result.error || 'Submission failed'}. You can still export as PDF.`,
          });
        }
      } else {
        // Web fallback: trigger window.print
        window.print();
        setStatusMessage({ type: 'success', text: 'Triggered system print dialog.' });
      }
    } catch (err: any) {
      console.error('Print submission failed:', err);
      setStatusMessage({ type: 'error', text: `Print failed: ${err.message || 'Unknown error'}` });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* 1. Main Viewport: Print Sheet Preview */}
      <main
        style={{
          flex: 1,
          backgroundColor: 'var(--bg-canvas)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top Preview Controls Bar */}
        <div
          style={{
            height: '48px',
            backgroundColor: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            zIndex: 10,
          }}
        >
          <button className="btn btn-ghost" style={{ fontSize: '12px' }} onClick={() => onNavigate('layout')}>
            <ArrowLeft size={14} />
            Back to Page Layout
          </button>

          {/* Page Navigator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="btn btn-ghost"
              style={{ padding: '6px' }}
              disabled={activePageIndex <= 0}
              onClick={() => setActivePageIndex(activePageIndex - 1)}
            >
              <ChevronLeft size={16} />
            </button>

            <span style={{ fontSize: '13px', fontWeight: 600 }}>
              Page {activePageIndex + 1} of {pages.length}
            </span>

            <button
              className="btn btn-ghost"
              style={{ padding: '6px' }}
              disabled={activePageIndex >= pages.length - 1}
              onClick={() => setActivePageIndex(activePageIndex + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-cyan font-mono" style={{ fontSize: '11px' }}>
              {currentPage.paper_size} ({currentPage.width_mm} × {currentPage.height_mm} mm)
            </span>
          </div>
        </div>

        {/* Status notification toast */}
        {statusMessage && (
          <div
            style={{
              padding: '10px 20px',
              backgroundColor: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
              borderBottom: '1px solid',
              borderColor: statusMessage.type === 'success' ? '#10b981' : '#f43f5e',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              color: '#ffffff',
            }}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 size={16} color="#10b981" />
            ) : (
              <AlertCircle size={16} color="#f43f5e" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Paper Sheet Preview */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '36px',
          }}
        >
          <div
            style={{
              width: `${pagePxW}px`,
              height: `${pagePxH}px`,
              backgroundColor: currentPage.background_color || '#FFFFFF',
              boxShadow: '0 12px 48px rgba(0, 0, 0, 0.75)',
              position: 'relative',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            {(currentPage.items || []).map((item) => {
              const asset = assetMap.get(item.asset_id);
              const leftPx = item.position_x_mm * scale;
              const topPx = item.position_y_mm * scale;
              const widthPx = item.width_mm * scale;
              const heightPx = item.height_mm * scale;

              return (
                <div
                  key={item.id}
                  style={{
                    position: 'absolute',
                    left: `${leftPx}px`,
                    top: `${topPx}px`,
                    width: `${widthPx}px`,
                    height: `${heightPx}px`,
                    overflow: 'hidden',
                  }}
                >
                  {asset && asset.preview_url ? (
                    <img
                      src={asset.preview_url}
                      alt=""
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: item.fit_mode === 'cover' ? 'cover' : 'contain',
                        filter: colorMode === 'grayscale' ? 'grayscale(100%)' : 'none',
                      }}
                    />
                  ) : null}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      border: '0.5px solid rgba(0,0,0,0.1)',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* 2. Right Sidebar: Print & PDF Settings */}
      <aside
        style={{
          width: '320px',
          backgroundColor: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-subtle)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          overflowY: 'auto',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
          Print & Export Studio
        </span>

        {/* Printer Selection */}
        <div className="glass-panel" style={{ padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Destination Printer</label>
            <button
              className="btn btn-ghost"
              style={{ padding: '2px 6px', fontSize: '10px' }}
              onClick={fetchPrinters}
              disabled={isLoadingPrinters}
            >
              <RefreshCw size={10} />
              Refresh
            </button>
          </div>

          <select
            className="input-select"
            value={selectedPrinter || ''}
            onChange={(e) => setSelectedPrinter(e.target.value)}
          >
            {printers.length === 0 ? (
              <option value="">No printers detected (Export PDF)</option>
            ) : (
              printers.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} {p.isDefault ? '(Default)' : ''}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Copies & Color Mode */}
        <div className="glass-panel" style={{ padding: '14px' }}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Number of Copies
            </label>
            <input
              type="number"
              className="input-text font-mono"
              min="1"
              max="99"
              value={copies}
              onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Color Mode
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button
                className={`tool-btn ${colorMode === 'color' ? 'active' : ''}`}
                onClick={() => setColorMode('color')}
              >
                Color
              </button>
              <button
                className={`tool-btn ${colorMode === 'grayscale' ? 'active' : ''}`}
                onClick={() => setColorMode('grayscale')}
              >
                B&W Xerox
              </button>
            </div>
          </div>
        </div>

        {/* Duplex Mode */}
        <div className="glass-panel" style={{ padding: '14px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
            Two-Sided (Duplex) Printing
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              className={`tool-btn ${duplexMode === 'simplex' ? 'active' : ''}`}
              style={{ justifyContent: 'flex-start', padding: '8px 12px' }}
              onClick={() => setDuplexMode('simplex')}
            >
              1-Sided (Simplex)
            </button>
            <button
              className={`tool-btn ${duplexMode === 'long_edge' ? 'active' : ''}`}
              style={{ justifyContent: 'flex-start', padding: '8px 12px' }}
              onClick={() => setDuplexMode('long_edge')}
            >
              2-Sided (Flip on Long Edge)
            </button>
            <button
              className={`tool-btn ${duplexMode === 'short_edge' ? 'active' : ''}`}
              style={{ justifyContent: 'flex-start', padding: '8px 12px' }}
              onClick={() => setDuplexMode('short_edge')}
            >
              2-Sided (Flip on Short Edge)
            </button>
          </div>
        </div>

        {/* Scaling Mode Notice */}
        <div
          style={{
            padding: '10px 12px',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>Actual Size (100%):</span> Preserves exact
          passport and ID card millimeters without printer driver auto-shrinking.
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto' }}>
          <button
            className="btn btn-primary"
            style={{ padding: '12px', fontSize: '14px' }}
            onClick={handlePrint}
            disabled={isPrinting}
          >
            <Printer size={18} />
            <span>{isPrinting ? 'Submitting to Spooler...' : 'Print Now'}</span>
          </button>

          <button
            className="btn btn-secondary"
            style={{ padding: '10px', fontSize: '13px' }}
            onClick={handleExportPdf}
            disabled={isExporting}
          >
            <FileDown size={16} color="var(--accent-magenta)" />
            <span>{isExporting ? 'Generating PDF...' : 'Export PDF Document'}</span>
          </button>
        </div>
      </aside>
    </div>
  );
};
