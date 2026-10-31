import React, { useState } from 'react';
import { 
  FilePlus, 
  Layers, 
  Trash2, 
  MoveUp, 
  MoveDown, 
  FileText, 
  FileSpreadsheet, 
  Image as ImageIcon, 
  Compass, 
  CheckCircle2, 
  Download,
  Loader2,
  Sparkles,
  FolderOpen,
  Eye
} from 'lucide-react';
import { QueueItem } from '../../../types/converter';
import { UniversalMerger } from '../../../services/converter/universalMerger';
import { PdfPreviewModal } from '../ui/PdfPreviewModal';

export const UniversalFusionStudio: React.FC = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [lastMergedPdf, setLastMergedPdf] = useState<{ bytes: Uint8Array; name: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleFileDrop = (files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let type: QueueItem['type'] = 'unknown';

      if (['jpg', 'jpeg', 'png', 'webp', 'bmp', 'svg'].includes(ext)) type = 'jpg';
      else if (ext === 'docx') type = 'docx';
      else if (ext === 'xlsx' || ext === 'xls') type = 'xlsx';
      else if (ext === 'dxf') type = 'dxf';
      else if (ext === 'pdf') type = 'pdf';
      else if (['txt', 'md', 'json', 'csv'].includes(ext)) type = 'txt';

      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          setQueue((prev) => [
            ...prev,
            {
              id: Math.random().toString(36).substring(2, 9),
              name: file.name,
              size: file.size,
              type,
              bytes: new Uint8Array(reader.result as ArrayBuffer),
              status: 'queued'
            }
          ]);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const handleBrowseFiles = async () => {
    if (window.electronAPI) {
      const files = await window.electronAPI.openFilesDialog();
      if (files && Array.isArray(files)) {
        const newQueue = files.map((f) => {
          const ext = f.name.split('.').pop()?.toLowerCase() || '';
          let type: QueueItem['type'] = 'unknown';
          if (['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(ext)) type = 'jpg';
          else if (ext === 'docx') type = 'docx';
          else if (ext === 'xlsx' || ext === 'xls') type = 'xlsx';
          else if (ext === 'dxf') type = 'dxf';
          else if (ext === 'pdf') type = 'pdf';
          else if (['txt', 'md', 'json', 'csv'].includes(ext)) type = 'txt';

          return {
            id: Math.random().toString(36).substring(2, 9),
            name: f.name,
            size: f.size,
            type,
            bytes: new Uint8Array(f.buffer),
            status: 'queued' as const
          };
        });

        setQueue((prev) => [...prev, ...newQueue]);
      }
    }
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= queue.length) return;
    const newQueue = [...queue];
    const [moved] = newQueue.splice(index, 1);
    newQueue.splice(targetIdx, 0, moved);
    setQueue(newQueue);
  };

  const removeItem = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const clearQueue = () => {
    setQueue([]);
    setLastMergedPdf(null);
  };

  // Master Fuse Execution
  const handleFuseDocuments = async () => {
    if (queue.length === 0) return;

    setIsProcessing(true);
    setCurrentProgress({ current: 0, total: queue.length, name: 'Starting universal fusion...' });

    try {
      const mergedBytes = await UniversalMerger.fuseMultipleDocuments(
        queue,
        (current, total, name) => {
          setCurrentProgress({ current, total, name });
        }
      );

      const resultName = `Master_Fused_${new Date().toISOString().slice(0, 10)}.pdf`;
      setLastMergedPdf({ bytes: mergedBytes, name: resultName });
    } catch (err: any) {
      alert(`Conversion Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setCurrentProgress(null);
    }
  };

  const handleSaveResult = async () => {
    if (!lastMergedPdf) return;

    if (window.electronAPI) {
      const savedPath = await window.electronAPI.saveFileDialog({
        defaultName: lastMergedPdf.name,
        buffer: lastMergedPdf.bytes.buffer as ArrayBuffer
      });
      if (savedPath) {
        alert(`Master Document successfully saved to: ${savedPath}`);
      }
    } else {
      const blob = new Blob([lastMergedPdf.bytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = lastMergedPdf.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return Math.round(bytes / 1024) + ' KB';
  };

  const getTypeIcon = (type: QueueItem['type']) => {
    switch (type) {
      case 'docx':
        return <FileText className="size-5 text-blue-400" />;
      case 'xlsx':
      case 'xls':
        return <FileSpreadsheet className="size-5 text-emerald-400" />;
      case 'dxf':
        return <Compass className="size-5 text-amber-400" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'webp':
        return <ImageIcon className="size-5 text-purple-400" />;
      default:
        return <FileText className="size-5 text-sky-400" />;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-[#171a23] via-[#212634] to-[#171a23] border border-[#2b3142] rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold mb-3">
              <Sparkles className="size-3.5" />
              <span>Multi-Document Universal Staggered Fusion Engine</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Heterogeneous Document Merger
            </h1>
            <p className="text-sm text-gray-400 mt-2 leading-relaxed">
              Combine any combination of documents in any order: e.g. <strong className="text-gray-200">2 Word (.docx)</strong> + <strong className="text-gray-200">3 JPG</strong> + <strong className="text-gray-200">2 PNG</strong> + <strong className="text-gray-200">1 Excel (.xlsx)</strong> + <strong className="text-gray-200">AutoCAD (.dxf)</strong> + <strong className="text-gray-200">3 Word documents</strong> into a single unified Master PDF!
            </p>
          </div>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files) handleFileDrop(e.dataTransfer.files);
          }}
          onClick={handleBrowseFiles}
          className="border-2 border-dashed border-[#2f3547] hover:border-sky-500/60 bg-[#141720] hover:bg-[#181c27] rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 group"
        >
          <div className="size-16 rounded-2xl bg-sky-500/10 group-hover:bg-sky-500/20 flex items-center justify-center text-sky-400 mb-4 transition-transform group-hover:scale-105">
            <FilePlus className="size-8" />
          </div>
          <h3 className="text-base font-bold text-white group-hover:text-sky-400 transition-colors">
            Click to Browse or Drag & Drop Multiple Documents
          </h3>
          <p className="text-xs text-gray-400 mt-1.5">
            Accepts: Word (.docx), Excel (.xlsx, .xls), AutoCAD DXF (.dxf), Images (JPG, PNG, WebP), Text (.txt), and PDF files
          </p>
        </div>

        {/* Queue Bar */}
        {queue.length > 0 && (
          <div className="flex items-center justify-between bg-[#171a23] px-4 py-3 rounded-xl border border-[#2b3142]">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                Staggered Queue ({queue.length} items)
              </span>
              <span className="text-xs font-mono text-gray-500">
                Total: {formatSize(queue.reduce((acc, i) => acc + i.size, 0))}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={clearQueue}
                className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white bg-[#222736] hover:bg-[#2d3447] rounded-lg transition"
              >
                Clear All
              </button>

              <button
                disabled={isProcessing}
                onClick={handleFuseDocuments}
                className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#0284c7] to-[#0ea5e9] hover:from-[#0369a1] hover:to-[#0284c7] rounded-lg shadow-lg shadow-sky-500/25 transition flex items-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Fusing ({currentProgress?.current}/{currentProgress?.total})...</span>
                  </>
                ) : (
                  <>
                    <Layers className="size-4" />
                    <span>Fuse All into Single Master PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Progress Display */}
        {isProcessing && currentProgress && (
          <div className="bg-[#171a24] border border-sky-500/30 rounded-xl p-4 shadow-lg animate-pulse">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-sky-400">Converting: {currentProgress.name}</span>
              <span className="font-mono text-gray-400">
                {currentProgress.current} / {currentProgress.total} documents
              </span>
            </div>
            <div className="w-full bg-[#242938] h-2 rounded-full overflow-hidden">
              <div
                className="bg-sky-500 h-full transition-all duration-300 rounded-full"
                style={{ width: `${(currentProgress.current / currentProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Items List */}
        <div className="space-y-2">
          {queue.map((item, index) => (
            <div
              key={item.id}
              className="bg-[#161922] hover:bg-[#1b1f2b] border border-[#272c3b] rounded-xl p-3.5 flex items-center justify-between transition-all group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="text-xs font-mono font-bold text-gray-500 w-6 text-center">
                  #{index + 1}
                </span>

                <div className="p-2 rounded-lg bg-[#212635] border border-[#2d3448]">
                  {getTypeIcon(item.type)}
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate max-w-md">
                    {item.name}
                  </p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">
                    {formatSize(item.size)} • <span className="uppercase font-bold text-gray-300">{item.type}</span>
                  </p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  disabled={index === 0}
                  onClick={() => moveItem(index, 'up')}
                  className="p-1.5 rounded-lg bg-[#212635] hover:bg-[#2d3448] text-gray-400 hover:text-white disabled:opacity-30 transition"
                  title="Move Up in Fuse Order"
                >
                  <MoveUp className="size-4" />
                </button>

                <button
                  disabled={index === queue.length - 1}
                  onClick={() => moveItem(index, 'down')}
                  className="p-1.5 rounded-lg bg-[#212635] hover:bg-[#2d3448] text-gray-400 hover:text-white disabled:opacity-30 transition"
                  title="Move Down in Fuse Order"
                >
                  <MoveDown className="size-4" />
                </button>

                <button
                  onClick={() => removeItem(item.id)}
                  className="p-1.5 rounded-lg bg-[#212635] hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition ml-1"
                  title="Remove from Queue"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Merged Banner */}
        {lastMergedPdf && (
          <div className="bg-sky-950/30 border border-sky-500/40 rounded-2xl p-5 flex items-center justify-between shadow-xl">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-6 text-sky-400" />
              <div>
                <p className="text-sm font-bold text-white">Master Unified Document Ready!</p>
                <p className="text-xs text-gray-400 font-mono mt-0.5">
                  {lastMergedPdf.name} ({formatSize(lastMergedPdf.bytes.length)})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPreview(true)}
                className="px-4 py-2 text-xs font-bold text-sky-400 hover:text-sky-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg shadow-md transition flex items-center gap-1.5"
              >
                <Eye className="size-4" />
                <span>Preview</span>
              </button>
              <button
                onClick={handleSaveResult}
                className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-md transition flex items-center gap-1.5"
              >
                <Download className="size-4" />
                <span>Download Master PDF</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {showPreview && lastMergedPdf && (
        <PdfPreviewModal
          pdfBytes={lastMergedPdf.bytes}
          filename={lastMergedPdf.name}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
};
