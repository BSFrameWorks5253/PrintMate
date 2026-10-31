import React, { useState } from 'react';
import {
  Layers,
  UploadCloud,
  FileText,
  Download,
  Eye,
  CheckCircle,
  RefreshCw,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  Sparkles
} from 'lucide-react';
import { PdfPageStudioService } from '../../../services/converter/pdfPageStudio';
import { PdfPreviewModal } from '../ui/PdfPreviewModal';

interface MergeItem {
  id: string;
  name: string;
  bytes: Uint8Array;
  size: number;
}

export const PdfMergeStudio: React.FC<{ initialFiles?: Array<{ name: string; bytes: Uint8Array; size: number }> }> = ({
  initialFiles = []
}) => {
  const [items, setItems] = useState<MergeItem[]>(
    initialFiles.map((f, i) => ({
      id: `${Date.now()}-${i}-${f.name}`,
      name: f.name,
      bytes: f.bytes,
      size: f.size
    }))
  );

  const [isLoading, setIsLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [mergedPdf, setMergedPdf] = useState<{ bytes: Uint8Array; name: string } | null>(null);
  const [previewPdf, setPreviewPdf] = useState<{ bytes: Uint8Array; name: string } | null>(null);

  const handleFileDrop = async (files: FileList | File[]) => {
    const pdfs = Array.from(files).filter((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length === 0) return;

    const newItems: MergeItem[] = [];
    for (let i = 0; i < pdfs.length; i++) {
      const f = pdfs[i];
      const buffer = await f.arrayBuffer();
      newItems.push({
        id: `${Date.now()}-${i}-${f.name}`,
        name: f.name,
        bytes: new Uint8Array(buffer),
        size: f.size
      });
    }

    setItems((prev) => [...prev, ...newItems]);
    setMergedPdf(null);
  };

  const handleBrowseFiles = async () => {
    if (window.electronAPI) {
      const files = await window.electronAPI.openFilesDialog({
        filters: [{ name: 'PDF Documents (*.pdf)', extensions: ['pdf'] }]
      });
      if (files && files.length > 0) {
        const newItems: MergeItem[] = files.map((f: any, i: number) => ({
          id: `${Date.now()}-${i}-${f.name}`,
          name: f.name,
          bytes: new Uint8Array(f.buffer),
          size: f.size
        }));
        setItems((prev) => [...prev, ...newItems]);
        setMergedPdf(null);
      }
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf';
      input.multiple = true;
      input.onchange = (e) => {
        const target = e.target as HTMLInputElement;
        if (target.files) handleFileDrop(target.files);
      };
      input.click();
    }
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const newItems = [...items];
    const [moved] = newItems.splice(index, 1);
    newItems.splice(targetIdx, 0, moved);
    setItems(newItems);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleExecuteMerge = async () => {
    if (items.length < 2) {
      alert('Please add at least 2 PDF files to merge.');
      return;
    }

    setIsLoading(true);
    setProgressMsg('Combining PDF pages in sequence...');

    try {
      const outBytes = await PdfPageStudioService.mergePdfs(
        items.map((i) => ({ bytes: i.bytes, name: i.name })),
        (curr, tot) => setProgressMsg(`Merging document ${curr} of ${tot}...`)
      );

      const firstBase = items[0].name.replace(/\.pdf$/i, '');
      const outName = `${firstBase}_Merged_Bundle.pdf`;

      setMergedPdf({
        bytes: outBytes,
        name: outName
      });
    } catch (err: any) {
      alert(`Merge failed: ${err.message}`);
    } finally {
      setIsLoading(false);
      setProgressMsg(null);
    }
  };

  const handleDownload = async () => {
    if (!mergedPdf) return;
    if (window.electronAPI) {
      const savedPath = await window.electronAPI.saveFileDialog({
        defaultName: mergedPdf.name,
        buffer: mergedPdf.bytes.buffer as ArrayBuffer,
        filterName: 'PDF Document (*.pdf)',
        extension: 'pdf'
      });
      if (savedPath) {
        await window.electronAPI.revealInFolder(savedPath);
      }
    } else {
      const blob = new Blob([mergedPdf.bytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = mergedPdf.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return Math.round(bytes / 1024) + ' KB';
  };

  const totalPayloadSize = items.reduce((acc, it) => acc + it.size, 0);

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] text-slate-800 select-none overflow-hidden font-sans">
      {/* HEADER */}
      <div className="bg-white border-b border-slate-200/90 px-6 py-3 shadow-2xs flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
            <Layers className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
              Merge PDF Studio
            </h2>
            <p className="text-xs text-slate-500">
              Combine multiple PDF documents into a single unified file in custom sequence.
            </p>
          </div>
        </div>

        {items.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
              {items.length} Files ({formatSize(totalPayloadSize)})
            </span>
            <button
              onClick={handleBrowseFiles}
              className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold rounded-xl transition flex items-center gap-1"
            >
              <Plus className="size-3.5" />
              <span>Add More</span>
            </button>
            <button
              onClick={() => { setItems([]); setMergedPdf(null); }}
              className="px-3 py-1.5 text-slate-500 hover:text-rose-600 text-xs font-semibold rounded-xl transition"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* WORKSPACE */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center custom-scrollbar">
        {items.length === 0 ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFileDrop(e.dataTransfer.files);
            }}
            onClick={handleBrowseFiles}
            className="p-12 border-2 border-dashed border-slate-300 hover:border-sky-500 rounded-3xl bg-white hover:bg-sky-50/30 transition cursor-pointer text-center flex flex-col items-center justify-center group shadow-xs max-w-lg w-full"
          >
            <div className="size-16 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mb-4 group-hover:scale-105 transition border border-sky-100">
              <UploadCloud className="size-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Select Multiple PDFs to Merge</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Drag and drop files here to reorder and combine into one document.
            </p>
            <button className="mt-5 px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-xs transition">
              Browse PDF Files
            </button>
          </div>
        ) : (
          <div className="max-w-2xl w-full bg-white border border-slate-200/90 rounded-3xl p-6 shadow-2xs space-y-6">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">Document Merge Sequence</h3>
              <p className="text-xs text-slate-500">
                Use the arrows to adjust order. Documents will be merged top-to-bottom.
              </p>
            </div>

            {/* List of PDFs */}
            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar p-1">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-3 bg-slate-50 border border-slate-200/90 rounded-2xl flex items-center justify-between gap-3 hover:border-slate-300 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="size-7 rounded-lg bg-slate-800 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <FileText className="size-5 text-rose-500 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-900 block truncate">{item.name}</span>
                      <span className="text-[11px] text-slate-400 block">{formatSize(item.size)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      disabled={idx === 0}
                      onClick={() => moveItem(idx, 'up')}
                      className="p-1.5 text-slate-500 hover:text-slate-800 disabled:opacity-20 hover:bg-white rounded-lg transition"
                      title="Move Up"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      disabled={idx === items.length - 1}
                      onClick={() => moveItem(idx, 'down')}
                      className="p-1.5 text-slate-500 hover:text-slate-800 disabled:opacity-20 hover:bg-white rounded-lg transition"
                      title="Move Down"
                    >
                      <ArrowDown className="size-4" />
                    </button>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Remove"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div>
                {progressMsg && (
                  <span className="text-xs font-semibold text-sky-700 flex items-center gap-2">
                    <RefreshCw className="size-3.5 animate-spin text-sky-600" />
                    <span>{progressMsg}</span>
                  </span>
                )}
              </div>

              <button
                onClick={handleExecuteMerge}
                disabled={isLoading || items.length < 2}
                className="px-6 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-sky-600/20 transition flex items-center gap-2"
              >
                <Layers className="size-4" />
                <span>Merge {items.length} Documents</span>
              </button>
            </div>

            {/* Results Card */}
            {mergedPdf && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between animate-in fade-in">
                <div className="flex items-center gap-3">
                  <CheckCircle className="size-6 text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-emerald-900">Merge Succeeded!</h4>
                    <span className="text-[11px] text-emerald-700">
                      {mergedPdf.name} ({formatSize(mergedPdf.bytes.length)})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewPdf(mergedPdf)}
                    className="px-3 py-1.5 bg-white text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                  >
                    <Eye className="size-3.5 text-slate-500" />
                    <span>Preview</span>
                  </button>
                  <button
                    onClick={handleDownload}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                  >
                    <Download className="size-3.5" />
                    <span>Save to Disk</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* PDF PREVIEW MODAL */}
      {previewPdf && (
        <PdfPreviewModal
          pdfBytes={previewPdf.bytes}
          title={previewPdf.name}
          onClose={() => setPreviewPdf(null)}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
};
