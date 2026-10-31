import React, { useState } from 'react';
import {
  Scissors,
  UploadCloud,
  FileText,
  Download,
  Eye,
  CheckCircle,
  RefreshCw,
  Trash2,
  Layers,
  Sparkles,
  FileCheck
} from 'lucide-react';
import { PdfPageStudioService } from '../../../services/converter/pdfPageStudio';
import { PdfPreviewModal } from '../ui/PdfPreviewModal';

type SplitMode = 'range' | 'all-to-zip' | 'chunk' | 'odd-even';

export const PdfSplitStudio: React.FC<{ initialFile?: { name: string; bytes: Uint8Array; size: number } | null }> = ({
  initialFile = null
}) => {
  const [selectedFile, setSelectedFile] = useState<{ name: string; bytes: Uint8Array; size: number } | null>(initialFile);
  const [splitMode, setSplitMode] = useState<SplitMode>('range');
  const [rangeInput, setRangeInput] = useState<string>('1-3, 5');
  const [chunkSize, setChunkSize] = useState<number>(2);
  const [parity, setParity] = useState<'odd' | 'even'>('odd');

  const [isLoading, setIsLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [resultItem, setResultItem] = useState<{ bytes: Uint8Array; name: string; isZip: boolean } | null>(null);
  const [previewPdf, setPreviewPdf] = useState<{ bytes: Uint8Array; name: string } | null>(null);

  const handleFileDrop = async (files: FileList | File[]) => {
    const file = Array.from(files).find((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (!file) return;

    const buffer = await file.arrayBuffer();
    setSelectedFile({
      name: file.name,
      bytes: new Uint8Array(buffer),
      size: file.size
    });
    setResultItem(null);
  };

  const handleBrowseFile = async () => {
    if (window.electronAPI) {
      const files = await window.electronAPI.openFilesDialog({
        filters: [{ name: 'PDF Documents (*.pdf)', extensions: ['pdf'] }]
      });
      if (files && files.length > 0) {
        setSelectedFile({
          name: files[0].name,
          bytes: new Uint8Array(files[0].buffer),
          size: files[0].size
        });
        setResultItem(null);
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

  const handleExecuteSplit = async () => {
    if (!selectedFile) return;
    setIsLoading(true);
    const baseName = selectedFile.name.replace(/\.pdf$/i, '');

    try {
      if (splitMode === 'range') {
        setProgressMsg('Extracting requested page range...');
        const outBytes = await PdfPageStudioService.extractPageRange(selectedFile.bytes, rangeInput);
        setResultItem({
          bytes: outBytes,
          name: `${baseName}_Extracted.pdf`,
          isZip: false
        });
      } else if (splitMode === 'all-to-zip') {
        setProgressMsg('Splitting all pages into individual files...');
        const zipBytes = await PdfPageStudioService.splitIntoZip(
          selectedFile.bytes,
          baseName,
          (curr, tot) => setProgressMsg(`Extracting page ${curr} of ${tot}...`)
        );
        setResultItem({
          bytes: zipBytes,
          name: `${baseName}_Split_Pages.zip`,
          isZip: true
        });
      } else if (splitMode === 'chunk') {
        setProgressMsg(`Splitting into documents of ${chunkSize} pages...`);
        const zipBytes = await PdfPageStudioService.splitByChunkSize(
          selectedFile.bytes,
          baseName,
          chunkSize,
          (curr, tot) => setProgressMsg(`Creating document part ${curr} of ${tot}...`)
        );
        setResultItem({
          bytes: zipBytes,
          name: `${baseName}_Chunks_of_${chunkSize}.zip`,
          isZip: true
        });
      } else if (splitMode === 'odd-even') {
        setProgressMsg(`Extracting ${parity} numbered pages...`);
        const outBytes = await PdfPageStudioService.splitOddEven(selectedFile.bytes, parity);
        setResultItem({
          bytes: outBytes,
          name: `${baseName}_${parity === 'odd' ? 'Odd_Pages' : 'Even_Pages'}.pdf`,
          isZip: false
        });
      }
    } catch (err: any) {
      alert(`Split failed: ${err.message}`);
    } finally {
      setIsLoading(false);
      setProgressMsg(null);
    }
  };

  const handleDownload = async () => {
    if (!resultItem) return;
    const isZip = resultItem.isZip;

    if (window.electronAPI) {
      const savedPath = await window.electronAPI.saveFileDialog({
        defaultName: resultItem.name,
        buffer: resultItem.bytes.buffer as ArrayBuffer,
        filterName: isZip ? 'ZIP Archive (*.zip)' : 'PDF Document (*.pdf)',
        extension: isZip ? 'zip' : 'pdf'
      });
      if (savedPath) {
        await window.electronAPI.revealInFolder(savedPath);
      }
    } else {
      const blob = new Blob([resultItem.bytes as BlobPart], {
        type: isZip ? 'application/zip' : 'application/pdf'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resultItem.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return Math.round(bytes / 1024) + ' KB';
  };

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] text-slate-800 select-none overflow-hidden font-sans">
      {/* HEADER */}
      <div className="bg-white border-b border-slate-200/90 px-6 py-3 shadow-2xs flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
            <Scissors className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
              Split PDF Studio
            </h2>
            <p className="text-xs text-slate-500">
              Extract page ranges, split every page to individual files, or divide into chunks.
            </p>
          </div>
        </div>

        {selectedFile && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <FileCheck className="size-4 text-rose-600 shrink-0" />
            <span className="text-xs font-bold text-slate-800 max-w-xs truncate">{selectedFile.name}</span>
            <span className="text-[11px] text-slate-400">({formatSize(selectedFile.size)})</span>
            <button
              onClick={() => { setSelectedFile(null); setResultItem(null); }}
              className="text-slate-400 hover:text-rose-600 ml-1"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* WORKSPACE */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center custom-scrollbar">
        {!selectedFile ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFileDrop(e.dataTransfer.files);
            }}
            onClick={handleBrowseFile}
            className="p-12 border-2 border-dashed border-slate-300 hover:border-rose-500 rounded-3xl bg-white hover:bg-rose-50/30 transition cursor-pointer text-center flex flex-col items-center justify-center group shadow-xs max-w-lg w-full"
          >
            <div className="size-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 group-hover:scale-105 transition border border-rose-100">
              <UploadCloud className="size-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Drop PDF to Split</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Extract single pages, ranges, or separate documents locally
            </p>
            <button className="mt-5 px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-xs transition">
              Select PDF
            </button>
          </div>
        ) : (
          <div className="max-w-2xl w-full bg-white border border-slate-200/90 rounded-3xl p-6 shadow-2xs space-y-6">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">Choose Split Method</h3>
              <p className="text-xs text-slate-500">
                Select how you would like to divide or extract content from this document.
              </p>
            </div>

            {/* Split Modes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: 'range' as const, label: 'Custom Range', desc: 'e.g. 1-3, 5, 8' },
                { id: 'all-to-zip' as const, label: 'All Pages to ZIP', desc: '1 page = 1 file' },
                { id: 'chunk' as const, label: 'Fixed Chunks', desc: 'Every N pages' },
                { id: 'odd-even' as const, label: 'Odd / Even', desc: 'Separate parity' }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setSplitMode(m.id); setResultItem(null); }}
                  className={`p-3 rounded-2xl border text-left transition ${
                    splitMode === m.id
                      ? 'border-rose-500 bg-rose-50/60 ring-2 ring-rose-200 text-rose-950 font-bold'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <span className="text-xs font-bold block">{m.label}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{m.desc}</span>
                </button>
              ))}
            </div>

            {/* Split Config Inputs */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              {splitMode === 'range' && (
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Page Range to Extract (comma separated):
                  </label>
                  <input
                    type="text"
                    value={rangeInput}
                    onChange={(e) => setRangeInput(e.target.value)}
                    placeholder="e.g. 1-3, 5, 7-10"
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-rose-500"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Extracts specified pages in exact order into one output PDF.
                  </span>
                </div>
              )}

              {splitMode === 'all-to-zip' && (
                <p className="text-xs text-slate-600">
                  Every single page of the document will be extracted as a standalone PDF and bundled into a organized ZIP archive.
                </p>
              )}

              {splitMode === 'chunk' && (
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-700">Split every:</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={chunkSize}
                    onChange={(e) => setChunkSize(Math.max(1, Number(e.target.value)))}
                    className="w-20 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-center"
                  />
                  <span className="text-xs text-slate-700">pages per PDF file</span>
                </div>
              )}

              {splitMode === 'odd-even' && (
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-700">Extract:</span>
                  <button
                    onClick={() => setParity('odd')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition ${
                      parity === 'odd' ? 'bg-rose-500 text-white' : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    Odd Pages (1, 3, 5, ...)
                  </button>
                  <button
                    onClick={() => setParity('even')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition ${
                      parity === 'even' ? 'bg-rose-500 text-white' : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    Even Pages (2, 4, 6, ...)
                  </button>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2">
              <div>
                {progressMsg && (
                  <span className="text-xs font-semibold text-rose-700 flex items-center gap-2">
                    <RefreshCw className="size-3.5 animate-spin text-rose-600" />
                    <span>{progressMsg}</span>
                  </span>
                )}
              </div>

              <button
                onClick={handleExecuteSplit}
                disabled={isLoading}
                className="px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-600/20 transition flex items-center gap-2"
              >
                <Scissors className="size-4" />
                <span>Execute Split</span>
              </button>
            </div>

            {/* Results */}
            {resultItem && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between animate-in fade-in">
                <div className="flex items-center gap-3">
                  <CheckCircle className="size-6 text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-emerald-900">Split Finished!</h4>
                    <span className="text-[11px] text-emerald-700">
                      {resultItem.name} ({formatSize(resultItem.bytes.length)})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!resultItem.isZip && (
                    <button
                      onClick={() => setPreviewPdf({ bytes: resultItem.bytes, name: resultItem.name })}
                      className="px-3 py-1.5 bg-white text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                    >
                      <Eye className="size-3.5 text-slate-500" />
                      <span>Preview</span>
                    </button>
                  )}
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
