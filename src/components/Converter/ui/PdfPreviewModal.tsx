import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Download, 
  RotateCw,
  Eye,
  Loader2
} from 'lucide-react';

interface PdfPreviewModalProps {
  pdfBytes: Uint8Array;
  filename?: string;
  title?: string;
  onClose: () => void;
  onSave?: () => void;
  onDownload?: () => void;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  pdfBytes,
  filename,
  title,
  onClose,
  onSave,
  onDownload
}) => {
  const displayTitle = filename || title || 'Document Preview.pdf';
  const handleSaveAction = onDownload || onSave;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [scale, setScale] = useState(1.15);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);

    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({
          data: pdfBytes,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
          cMapPacked: true
        });
        const doc = await loadingTask.promise;
        if (!isCancelled) {
          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          setCurrentPage(1);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to load PDF preview:', err);
        if (!isCancelled) setIsLoading(false);
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [pdfBytes]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let renderTask: any = null;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale, rotation });
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;

        renderTask = (page.render as any)({ canvasContext: ctx, viewport, canvas });
        await renderTask.promise;
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error('Page render error:', err);
        }
      }
    };

    renderPage();

    return () => {
      if (renderTask) renderTask.cancel();
    };
  }, [pdfDoc, currentPage, scale, rotation]);

  const handlePrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const handleNext = () => setCurrentPage((p) => Math.min(totalPages, p + 1));
  const handleZoomIn = () => setScale((s) => Math.min(2.5, s + 0.2));
  const handleZoomOut = () => setScale((s) => Math.max(0.6, s - 0.2));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const handleSaveDefault = async () => {
    if (handleSaveAction) {
      handleSaveAction();
      return;
    }
    if (window.electronAPI) {
      await window.electronAPI.saveFileDialog({
        defaultName: displayTitle,
        buffer: pdfBytes.slice().buffer as ArrayBuffer,
        filterName: 'PDF Document (*.pdf)',
        extension: 'pdf'
      });
    } else {
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = displayTitle;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
      {/* Top Toolbar */}
      <div className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between select-none shadow-sm">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-200">
            <Eye className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 truncate max-w-sm">{displayTitle}</h3>
            <p className="text-[11px] text-slate-500">PrintMate Studio In-App Previewer</p>
          </div>
        </div>

        {/* Center Page Controls */}
        <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
          <button
            onClick={handlePrev}
            disabled={currentPage <= 1}
            className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-30 rounded hover:bg-white transition"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-xs font-mono font-bold text-slate-700 min-w-16 text-center">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={handleNext}
            disabled={currentPage >= totalPages}
            className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-30 rounded hover:bg-white transition"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* View & Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            title="Zoom Out"
          >
            <ZoomOut className="size-4" />
          </button>
          <span className="text-xs font-mono font-semibold text-slate-600">{Math.round(scale * 100)}%</span>
          <button
            onClick={handleZoomIn}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            title="Zoom In"
          >
            <ZoomIn className="size-4" />
          </button>
          <button
            onClick={handleRotate}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            title="Rotate View"
          >
            <RotateCw className="size-4" />
          </button>

          <div className="h-5 w-px bg-slate-200 mx-1" />

          <button
            onClick={handleSaveDefault}
            className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            <Download className="size-3.5" />
            <span>Save PDF</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition ml-2"
            title="Close Preview"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 overflow-auto p-8 flex items-center justify-center custom-scrollbar bg-slate-100/90">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Loader2 className="size-8 animate-spin text-sky-600" />
            <span className="text-xs font-medium">Rendering Document Pages...</span>
          </div>
        ) : (
          <div className="shadow-xl rounded-lg overflow-hidden border border-slate-300 bg-white">
            <canvas ref={canvasRef} className="block" />
          </div>
        )}
      </div>
    </div>
  );
};
