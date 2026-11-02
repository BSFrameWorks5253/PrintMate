import React, { useState, useEffect } from 'react';
import {
  Scissors,
  UploadCloud,
  FileText,
  Download,
  Eye,
  CheckCircle,
  RefreshCw,
  Trash2,
  Plus,
  FileCheck,
  Image as ImageIcon,
  Files,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { PdfPageStudioService } from '../../../services/converter/pdfPageStudio';
import { PdfPreviewModal } from '../ui/PdfPreviewModal';

export interface PageRangeItem {
  id: string;
  from: number;
  to: number;
}

export type SplitOutputChoice = 'separate-pdf' | 'combined-pdf' | 'all-jpg';

export const PdfSplitStudio: React.FC<{
  initialFile?: { name: string; bytes: Uint8Array; size: number } | null;
}> = ({ initialFile = null }) => {
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    bytes: Uint8Array;
    size: number;
  } | null>(initialFile);

  const [totalPages, setTotalPages] = useState<number>(0);
  const [isInspecting, setIsInspecting] = useState(false);

  // Range boxes: list of "From [X] To [Y]"
  const [ranges, setRanges] = useState<PageRangeItem[]>([
    { id: '1', from: 1, to: 1 }
  ]);

  // Output choice asked to user:
  // 1) Each range as different PDF
  // 2) All at once in 1 PDF
  // 3) All in JPG download
  const [outputChoice, setOutputChoice] = useState<SplitOutputChoice>('separate-pdf');

  const [isLoading, setIsLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [resultItem, setResultItem] = useState<{
    bytes: Uint8Array;
    name: string;
    isZip: boolean;
  } | null>(null);
  const [previewPdf, setPreviewPdf] = useState<{ bytes: Uint8Array; name: string } | null>(null);

  // Load PDF metadata and count pages whenever file changes
  useEffect(() => {
    if (!selectedFile) {
      setTotalPages(0);
      setRanges([{ id: '1', from: 1, to: 1 }]);
      setResultItem(null);
      return;
    }

    let isMounted = true;
    setIsInspecting(true);

    PdfPageStudioService.getPageCount(selectedFile.bytes)
      .then((count) => {
        if (!isMounted) return;
        setTotalPages(count);
        setRanges([
          {
            id: '1',
            from: 1,
            to: Math.min(count, Math.max(1, count > 3 ? 3 : count))
          }
        ]);
      })
      .catch((err) => {
        console.error('Failed to read PDF page count:', err);
        if (isMounted) setTotalPages(1);
      })
      .finally(() => {
        if (isMounted) setIsInspecting(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedFile]);

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

  const addRange = () => {
    const lastRange = ranges[ranges.length - 1];
    let nextFrom = 1;
    let nextTo = totalPages || 1;

    if (lastRange && totalPages > 0) {
      if (lastRange.to < totalPages) {
        nextFrom = lastRange.to + 1;
        nextTo = Math.min(totalPages, nextFrom + 1);
      } else {
        nextFrom = 1;
        nextTo = totalPages;
      }
    }

    setRanges((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        from: nextFrom,
        to: nextTo
      }
    ]);
    setResultItem(null);
  };

  const updateRange = (id: string, field: 'from' | 'to', value: number) => {
    setRanges((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const val = Math.max(1, value);
        return {
          ...r,
          [field]: totalPages > 0 ? Math.min(totalPages, val) : val
        };
      })
    );
    setResultItem(null);
  };

  const removeRange = (id: string) => {
    if (ranges.length <= 1) return;
    setRanges((prev) => prev.filter((r) => r.id !== id));
    setResultItem(null);
  };

  // Calculate distinct pages covered
  const getCoveredPages = () => {
    const pageSet = new Set<number>();
    for (const r of ranges) {
      const from = Math.min(r.from, r.to);
      const to = Math.max(r.from, r.to);
      const limit = totalPages > 0 ? Math.min(totalPages, to) : to;
      for (let p = from; p <= limit; p++) {
        pageSet.add(p);
      }
    }
    return Array.from(pageSet).sort((a, b) => a - b);
  };

  const coveredPages = getCoveredPages();

  const handleExecuteSplit = async () => {
    if (!selectedFile) return;
    setIsLoading(true);
    const baseName = selectedFile.name.replace(/\.pdf$/i, '');

    try {
      if (outputChoice === 'separate-pdf') {
        setProgressMsg('Generating separate PDF documents for each range...');
        const result = await PdfPageStudioService.extractRangesSeparate(
          selectedFile.bytes,
          ranges,
          baseName,
          (curr, tot) => setProgressMsg(`Exporting range ${curr} of ${tot}...`)
        );
        setResultItem(result);
      } else if (outputChoice === 'combined-pdf') {
        setProgressMsg('Extracting all ranges and merging into one PDF...');
        const result = await PdfPageStudioService.extractRangesCombined(
          selectedFile.bytes,
          ranges,
          baseName
        );
        setResultItem(result);
      } else if (outputChoice === 'all-jpg') {
        setProgressMsg('Rendering requested pages into high-resolution JPG images...');
        const result = await PdfPageStudioService.extractPagesToJpgZip(
          selectedFile.bytes,
          coveredPages,
          baseName,
          (curr, tot) => setProgressMsg(`Converting page ${curr} of ${tot} to JPG...`)
        );
        setResultItem(result);
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
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 select-none overflow-hidden font-sans">
      {/* HEADER */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200/90 dark:border-slate-800 px-6 py-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-100 dark:border-rose-900/50 shadow-xs">
            <Scissors className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                Split PDF Studio
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                MULTI-RANGE
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Set custom page ranges (From – To) and export as separate PDFs, one combined PDF, or high-res JPGs.
            </p>
          </div>
        </div>

        {selectedFile && (
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-1.5 rounded-xl text-xs font-semibold">
            <FileCheck className="size-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="font-bold text-slate-800 dark:text-slate-100 max-w-xs truncate">
              {selectedFile.name}
            </span>
            <span className="text-slate-400 font-mono text-[11px]">
              ({formatSize(selectedFile.size)})
            </span>
            {totalPages > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 font-bold text-[10px]">
                {totalPages} {totalPages === 1 ? 'Page' : 'Pages'}
              </span>
            )}
            <button
              onClick={() => {
                setSelectedFile(null);
                setResultItem(null);
              }}
              className="text-slate-400 hover:text-rose-600 ml-1.5 cursor-pointer p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="Remove File"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col items-center justify-start custom-scrollbar">
        {!selectedFile ? (
          <div className="my-auto max-w-lg w-full">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFileDrop(e.dataTransfer.files);
              }}
              onClick={handleBrowseFile}
              className="p-10 sm:p-14 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-rose-500 dark:hover:border-rose-500 rounded-3xl bg-white dark:bg-slate-900 hover:bg-rose-50/20 dark:hover:bg-rose-950/10 transition cursor-pointer text-center flex flex-col items-center justify-center group shadow-md"
            >
              <div className="size-16 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4 group-hover:scale-105 transition border border-rose-100 dark:border-rose-900/50 shadow-sm">
                <UploadCloud className="size-8" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Drop PDF Document Here
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-xs leading-relaxed">
                Click to browse or drop any PDF. You can select exact page ranges and download as separate PDFs, combined, or JPGs.
              </p>
              <button
                type="button"
                className="mt-6 px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-600/20 transition cursor-pointer flex items-center gap-2"
              >
                <Scissors className="size-3.5" />
                <span>Select PDF File</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl w-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-md space-y-6 animate-in fade-in">
            {/* Step 1: Range Boxes */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-xs flex items-center justify-center font-bold">
                      1
                    </span>
                    <span>Set Page Ranges (From Where to Where)</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Define the starting and ending page numbers you want to extract.
                  </p>
                </div>

                {totalPages > 0 && (
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-xl">
                    Total: <span className="text-rose-600 dark:text-rose-400 font-mono">{totalPages} Pages</span>
                  </div>
                )}
              </div>

              {/* Range Input List */}
              <div className="space-y-3">
                {ranges.map((range, idx) => {
                  const rangePageCount = Math.max(0, range.to - range.from + 1);
                  const isOutOfRange =
                    totalPages > 0 && (range.from > totalPages || range.to > totalPages);
                  const isInvalid = range.from > range.to;

                  return (
                    <div
                      key={range.id}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          Range {idx + 1}:
                        </span>
                      </div>

                      {/* FROM / TO INPUT BOXES */}
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            From:
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={totalPages || 9999}
                            value={range.from}
                            onChange={(e) =>
                              updateRange(range.id, 'from', parseInt(e.target.value) || 1)
                            }
                            className="w-20 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-center text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                          />
                        </div>

                        <span className="text-slate-400 font-bold">→</span>

                        <div className="flex items-center gap-1.5">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            To:
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={totalPages || 9999}
                            value={range.to}
                            onChange={(e) =>
                              updateRange(range.id, 'to', parseInt(e.target.value) || 1)
                            }
                            className="w-20 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-center text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                          />
                        </div>
                      </div>

                      {/* BADGE & REMOVE */}
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-xl ${
                            isInvalid || isOutOfRange
                              ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                              : 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200'
                          }`}
                        >
                          {isInvalid
                            ? 'Invalid: From > To'
                            : isOutOfRange
                            ? `Exceeds max (${totalPages})`
                            : `${rangePageCount} ${rangePageCount === 1 ? 'Page' : 'Pages'} (P${range.from}–P${range.to})`}
                        </span>

                        {ranges.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRange(range.id)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                            title="Remove this range"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Range & Preset Helpers */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={addRange}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="size-3.5 text-rose-600" />
                  <span>+ Add Another Range</span>
                </button>

                {totalPages > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Quick set:</span>
                    <button
                      type="button"
                      onClick={() => setRanges([{ id: '1', from: 1, to: totalPages }])}
                      className="text-rose-600 dark:text-rose-400 font-bold hover:underline cursor-pointer"
                    >
                      All Pages (1–{totalPages})
                    </button>
                    {totalPages > 1 && (
                      <>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <button
                          type="button"
                          onClick={() => {
                            const half = Math.ceil(totalPages / 2);
                            setRanges([
                              { id: '1', from: 1, to: half },
                              { id: '2', from: half + 1, to: totalPages }
                            ]);
                          }}
                          className="text-rose-600 dark:text-rose-400 font-bold hover:underline cursor-pointer"
                        >
                          Split into 2 Halves
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Output Options Asked to User */}
            <div className="space-y-3 pt-2">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-xs flex items-center justify-center font-bold">
                    2
                  </span>
                  <span>How Would You Like to Download the Split Output?</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Choose whether you want each range in its own file, merged into 1 PDF, or converted to JPGs.
                </p>
              </div>

              {/* 3 Prominent Option Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Option 1: Each Range Different PDF */}
                <button
                  type="button"
                  onClick={() => {
                    setOutputChoice('separate-pdf');
                    setResultItem(null);
                  }}
                  className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    outputChoice === 'separate-pdf'
                      ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/40 ring-2 ring-rose-400/50 text-slate-900 dark:text-white'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="size-9 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300 flex items-center justify-center">
                        <Files className="size-5" />
                      </div>
                      {outputChoice === 'separate-pdf' && (
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                      )}
                    </div>
                    <div className="text-xs font-black block">Each Range Different PDF</div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Saves every specified range into its own separate PDF document.
                    </p>
                  </div>
                  <span className="mt-3 text-[10px] font-bold text-rose-600 dark:text-rose-400 font-mono">
                    {ranges.length > 1 ? `${ranges.length} PDFs in ZIP` : '1 Individual PDF'}
                  </span>
                </button>

                {/* Option 2: All At Once (Merged) */}
                <button
                  type="button"
                  onClick={() => {
                    setOutputChoice('combined-pdf');
                    setResultItem(null);
                  }}
                  className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    outputChoice === 'combined-pdf'
                      ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/40 ring-2 ring-rose-400/50 text-slate-900 dark:text-white'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="size-9 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 flex items-center justify-center">
                        <FileText className="size-5" />
                      </div>
                      {outputChoice === 'combined-pdf' && (
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                      )}
                    </div>
                    <div className="text-xs font-black block">All At Once (1 Merged PDF)</div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Extracts and combines all selected ranges together into a single unified PDF file.
                    </p>
                  </div>
                  <span className="mt-3 text-[10px] font-bold text-blue-600 dark:text-blue-400 font-mono">
                    1 Single Combined PDF
                  </span>
                </button>

                {/* Option 3: All in JPG Download */}
                <button
                  type="button"
                  onClick={() => {
                    setOutputChoice('all-jpg');
                    setResultItem(null);
                  }}
                  className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    outputChoice === 'all-jpg'
                      ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/40 ring-2 ring-rose-400/50 text-slate-900 dark:text-white'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="size-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                        <ImageIcon className="size-5" />
                      </div>
                      {outputChoice === 'all-jpg' && (
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                      )}
                    </div>
                    <div className="text-xs font-black block">All in JPG Download</div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Renders every page within your ranges as crisp, high-resolution JPG images.
                    </p>
                  </div>
                  <span className="mt-3 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    High-Res Images (.ZIP)
                  </span>
                </button>
              </div>
            </div>

            {/* Step 3: Action Execution */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {isLoading && progressMsg ? (
                  <span className="text-xs font-bold text-rose-600 flex items-center gap-2">
                    <RefreshCw className="size-4 animate-spin text-rose-600" />
                    <span>{progressMsg}</span>
                  </span>
                ) : (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Selected pages: <strong className="text-slate-900 dark:text-white">{coveredPages.length}</strong> of{' '}
                    {totalPages} total
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleExecuteSplit}
                disabled={isLoading || coveredPages.length === 0}
                className="px-7 py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs sm:text-sm font-extrabold rounded-2xl shadow-lg shadow-rose-600/30 transition flex items-center gap-2 cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <Scissors className="size-4" />
                <span>
                  {outputChoice === 'separate-pdf'
                    ? 'Split into Separate PDFs'
                    : outputChoice === 'combined-pdf'
                    ? 'Extract to 1 Combined PDF'
                    : 'Download Pages as JPGs'}
                </span>
              </button>
            </div>

            {/* Results Success Box */}
            {resultItem && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 animate-in fade-in">
                <div className="flex items-center gap-3.5">
                  <div className="size-11 rounded-2xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <CheckCircle className="size-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-emerald-900 dark:text-emerald-100">
                      Split Finished Successfully!
                    </h4>
                    <span className="text-xs text-emerald-700 dark:text-emerald-300 block font-mono mt-0.5">
                      {resultItem.name} • {formatSize(resultItem.bytes.length)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {!resultItem.isZip && (
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewPdf({
                          bytes: resultItem.bytes,
                          name: resultItem.name
                        })
                      }
                      className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <Eye className="size-4 text-slate-500" />
                      <span>Preview</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDownload}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl shadow-md shadow-emerald-600/25 transition flex items-center gap-2 cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <Download className="size-4" />
                    <span>Download File</span>
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
