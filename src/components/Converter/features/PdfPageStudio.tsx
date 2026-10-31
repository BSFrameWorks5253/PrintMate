import React, { useState } from 'react';
import { 
  Scissors, 
  RotateCw, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  UploadCloud, 
  Eye, 
  Sparkles,
  FileCheck,
  Undo2,
  RefreshCw,
  Archive,
  Layers
} from 'lucide-react';
import { PdfPageStudioService, PageThumbnail } from '../../../services/converter/pdfPageStudio';
import { PdfPreviewModal } from '../ui/PdfPreviewModal';

export const PdfPageStudio: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [pages, setPages] = useState<PageThumbnail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [rangeInput, setRangeInput] = useState('');
  const [previewPdf, setPreviewPdf] = useState<{ bytes: Uint8Array; name: string } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleFileDrop = async (files: FileList | File[]) => {
    const file = Array.from(files).find((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (!file) return;

    setIsLoading(true);
    setStatusMessage('Reading PDF and generating page thumbnails...');
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      setSelectedFile({ name: file.name, bytes });

      const thumbs = await PdfPageStudioService.loadThumbnails(bytes, (current, total) => {
        setProgress({ current, total });
      });
      setPages(thumbs);
      setStatusMessage(null);
    } catch (err: any) {
      alert(`Error loading PDF: ${err.message}`);
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  };

  const handleBrowseFile = async () => {
    if (window.electronAPI) {
      const files = await window.electronAPI.openFilesDialog({
        filters: [{ name: 'PDF Documents (*.pdf)', extensions: ['pdf'] }]
      });
      if (files && files.length > 0) {
        const f = files[0];
        setIsLoading(true);
        setStatusMessage('Reading PDF and generating page thumbnails...');
        try {
          const bytes = new Uint8Array(f.buffer);
          setSelectedFile({ name: f.name, bytes });
          const thumbs = await PdfPageStudioService.loadThumbnails(bytes, (current, total) => {
            setProgress({ current, total });
          });
          setPages(thumbs);
          setStatusMessage(null);
        } catch (err: any) {
          alert(`Error loading PDF: ${err.message}`);
        } finally {
          setIsLoading(false);
          setProgress(null);
        }
      }
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf';
      input.onchange = (e) => {
        const target = e.target as HTMLInputElement;
        if (target.files) handleFileDrop(target.files);
      };
      input.click();
    }
  };

  const rotatePage = (index: number) => {
    setPages((prev) =>
      prev.map((p, idx) => (idx === index ? { ...p, rotation: (p.rotation + 90) % 360 } : p))
    );
  };

  const toggleDelete = (index: number) => {
    setPages((prev) =>
      prev.map((p, idx) => (idx === index ? { ...p, isDeleted: !p.isDeleted } : p))
    );
  };

  const movePage = (index: number, direction: 'left' | 'right') => {
    const targetIdx = direction === 'left' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= pages.length) return;
    const newPages = [...pages];
    const [moved] = newPages.splice(index, 1);
    newPages.splice(targetIdx, 0, moved);
    setPages(newPages);
  };

  const rotateAll = (deg: number) => {
    setPages((prev) => prev.map((p) => ({ ...p, rotation: (p.rotation + deg) % 360 })));
  };

  const resetAll = () => {
    setPages((prev) => prev.map((p) => ({ ...p, rotation: 0, isDeleted: false })));
  };

  const handleExportModified = async () => {
    if (!selectedFile) return;
    try {
      setIsLoading(true);
      setStatusMessage('Compiling modified PDF with rotations and ordering...');
      const modifiedBytes = await PdfPageStudioService.exportModifiedPdf(selectedFile.bytes, pages);
      const filename = `${selectedFile.name.replace(/\.pdf$/i, '')}_Organized.pdf`;

      if (window.electronAPI) {
        const saved = await window.electronAPI.saveFileDialog({
          defaultName: filename,
          buffer: modifiedBytes.buffer as ArrayBuffer
        });
        if (saved) alert(`Modified PDF saved to: ${saved}`);
      } else {
        const blob = new Blob([modifiedBytes as BlobPart], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      alert(`Error exporting PDF: ${err.message}`);
    } finally {
      setIsLoading(false);
      setStatusMessage(null);
    }
  };

  const handlePreviewModified = async () => {
    if (!selectedFile) return;
    try {
      setIsLoading(true);
      const modifiedBytes = await PdfPageStudioService.exportModifiedPdf(selectedFile.bytes, pages);
      setPreviewPdf({
        bytes: modifiedBytes,
        name: `${selectedFile.name.replace(/\.pdf$/i, '')}_Preview.pdf`
      });
    } catch (err: any) {
      alert(`Error generating preview: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSplitToZip = async () => {
    if (!selectedFile) return;
    try {
      setIsLoading(true);
      setStatusMessage('Extracting every page into individual single-page PDFs...');
      const baseName = selectedFile.name.replace(/\.pdf$/i, '');
      const zipBytes = await PdfPageStudioService.splitIntoZip(selectedFile.bytes, baseName, (curr, tot) => {
        setProgress({ current: curr, total: tot });
      });

      const zipFilename = `${baseName}_All_Pages.zip`;

      if (window.electronAPI) {
        await window.electronAPI.saveFileDialog({
          defaultName: zipFilename,
          buffer: zipBytes.buffer as ArrayBuffer,
          filterName: 'ZIP Archive (*.zip)',
          extension: 'zip'
        });
      } else {
        const blob = new Blob([zipBytes as BlobPart], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = zipFilename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      alert(`Error splitting PDF: ${err.message}`);
    } finally {
      setIsLoading(false);
      setStatusMessage(null);
      setProgress(null);
    }
  };

  const handleExtractRange = async () => {
    if (!selectedFile || !rangeInput.trim()) return;
    try {
      setIsLoading(true);
      setStatusMessage(`Extracting page range (${rangeInput})...`);
      const rangeBytes = await PdfPageStudioService.extractPageRange(selectedFile.bytes, rangeInput);
      const filename = `${selectedFile.name.replace(/\.pdf$/i, '')}_Pages_${rangeInput.replace(/[^0-9-]/g, '_')}.pdf`;

      if (window.electronAPI) {
        await window.electronAPI.saveFileDialog({
          defaultName: filename,
          buffer: rangeBytes.buffer as ArrayBuffer
        });
      } else {
        const blob = new Blob([rangeBytes as BlobPart], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      alert(`Error extracting range: ${err.message}`);
    } finally {
      setIsLoading(false);
      setStatusMessage(null);
    }
  };

  const activePagesCount = pages.filter((p) => !p.isDeleted).length;

  return (
    <div className="h-full flex flex-col bg-slate-950 p-6 overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
              <Scissors className="size-4" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">PDF Page Studio & Splitter</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
              REORDER • ROTATE • EXTRACT
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Visual page organizer: Reorder, delete individual pages, rotate 90°, extract ranges, or split into single PDFs.
          </p>
        </div>

        {selectedFile && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => rotateAll(90)}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg border border-slate-800 flex items-center gap-1.5 transition"
            >
              <RotateCw className="size-3.5" />
              <span>Rotate All 90°</span>
            </button>
            <button
              onClick={resetAll}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg border border-slate-800 flex items-center gap-1.5 transition"
            >
              <Undo2 className="size-3.5" />
              <span>Reset</span>
            </button>
            <button
              onClick={handlePreviewModified}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-1.5 transition"
            >
              <Eye className="size-3.5" />
              <span>Preview</span>
            </button>
            <button
              onClick={handleExportModified}
              className="px-4 py-1.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-rose-600/20 flex items-center gap-1.5 transition"
            >
              <Download className="size-3.5" />
              <span>Save Organized PDF ({activePagesCount} pgs)</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Workspace */}
      {!selectedFile ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFileDrop(e.dataTransfer.files);
            }}
            onClick={handleBrowseFile}
            className="w-full max-w-xl p-12 rounded-3xl border-2 border-dashed border-slate-800 hover:border-rose-500/60 bg-slate-900/40 hover:bg-rose-950/10 flex flex-col items-center justify-center text-center cursor-pointer transition group shadow-2xl"
          >
            <div className="size-16 rounded-2xl bg-slate-800 group-hover:bg-rose-500/20 text-slate-400 group-hover:text-rose-400 flex items-center justify-center mb-4 transition-transform group-hover:scale-110 border border-slate-700">
              <UploadCloud className="size-8" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Drop a PDF here to organize or split pages</h3>
            <p className="text-xs text-slate-400 max-w-sm mb-4">
              Inspect all page thumbnails, flip orientation, discard blank sheets, or extract exact sections.
            </p>
            <span className="px-4 py-2 rounded-xl bg-slate-800 group-hover:bg-rose-600 text-white text-xs font-semibold transition">
              Browse PDF File
            </span>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden pt-4 gap-4">
          {/* Action Ribbon for Split and Extract */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <FileCheck className="size-4 text-emerald-400" />
                {selectedFile.name}
              </span>
              <span className="text-[11px] text-slate-500">
                ({pages.length} total pages, {activePagesCount} active)
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Range Extraction */}
              <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                <span className="text-[11px] text-slate-400">Extract Range:</span>
                <input
                  type="text"
                  placeholder="e.g. 1-3, 5"
                  value={rangeInput}
                  onChange={(e) => setRangeInput(e.target.value)}
                  className="w-24 bg-transparent text-xs text-white focus:outline-none placeholder-slate-600 font-mono"
                />
                <button
                  onClick={handleExtractRange}
                  disabled={!rangeInput.trim()}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-[11px] font-semibold rounded transition"
                >
                  Extract
                </button>
              </div>

              {/* Split to single pages ZIP */}
              <button
                onClick={handleSplitToZip}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-1.5 transition"
              >
                <Archive className="size-3.5 text-amber-400" />
                <span>Split All to ZIP</span>
              </button>

              <button
                onClick={() => { setSelectedFile(null); setPages([]); }}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                title="Close Document"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>

          {/* Page Grid */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                <RefreshCw className="size-8 animate-spin text-rose-500" />
                <span className="text-xs">{statusMessage || 'Processing pages...'}</span>
                {progress && (
                  <span className="text-[11px] font-mono text-slate-500">
                    Page {progress.current} of {progress.total}
                  </span>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 pb-12">
                {pages.map((p, index) => (
                  <div
                    key={p.pageNum}
                    className={`relative flex flex-col rounded-xl border transition-all overflow-hidden bg-slate-900 group ${
                      p.isDeleted
                        ? 'opacity-40 border-rose-900/50 bg-rose-950/10 grayscale'
                        : 'border-slate-800 hover:border-slate-700 shadow-lg'
                    }`}
                  >
                    {/* Page Thumbnail */}
                    <div className="relative aspect-[3/4] bg-slate-950 p-2 flex items-center justify-center overflow-hidden">
                      <img
                        src={p.thumbnailUrl}
                        alt={`Page ${p.pageNum}`}
                        style={{ transform: `rotate(${p.rotation}deg)` }}
                        className="max-h-full max-w-full object-contain shadow rounded transition-transform duration-200"
                      />

                      {/* Deleted Overlay Banner */}
                      {p.isDeleted && (
                        <div className="absolute inset-0 bg-red-950/70 flex items-center justify-center">
                          <span className="text-xs font-bold text-red-300 uppercase tracking-wider px-2 py-1 bg-red-900/60 rounded border border-red-700">
                            Excluded
                          </span>
                        </div>
                      )}

                      {/* Page Number Pill */}
                      <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] font-mono text-slate-300 border border-white/10">
                        #{p.pageNum}
                      </span>
                    </div>

                    {/* Bottom Action Controls */}
                    <div className="h-9 bg-slate-900/90 border-t border-slate-800/80 px-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => movePage(index, 'left')}
                          disabled={index === 0}
                          className="p-1 text-slate-400 hover:text-white disabled:opacity-20 rounded"
                          title="Move Left"
                        >
                          <ChevronLeft className="size-3.5" />
                        </button>
                        <button
                          onClick={() => movePage(index, 'right')}
                          disabled={index === pages.length - 1}
                          className="p-1 text-slate-400 hover:text-white disabled:opacity-20 rounded"
                          title="Move Right"
                        >
                          <ChevronRight className="size-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => rotatePage(index)}
                          className="p-1 text-slate-400 hover:text-amber-400 rounded transition"
                          title="Rotate 90°"
                        >
                          <RotateCw className="size-3.5" />
                        </button>
                        <button
                          onClick={() => toggleDelete(index)}
                          className={`p-1 rounded transition ${
                            p.isDeleted ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-400 hover:text-rose-400'
                          }`}
                          title={p.isDeleted ? 'Restore Page' : 'Exclude Page'}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PDF Instant Previewer Modal */}
      {previewPdf && (
        <PdfPreviewModal
          pdfBytes={previewPdf.bytes}
          filename={previewPdf.name}
          onClose={() => setPreviewPdf(null)}
        />
      )}
    </div>
  );
};
