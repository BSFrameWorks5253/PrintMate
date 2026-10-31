import React, { useState, useRef, useCallback } from 'react';
import {
  FileText, FilePlus2, Scissors, LayoutGrid, Shield, RefreshCw,
  Image as ImageIcon, FileSpreadsheet, Layers, Download, Upload,
  CheckCircle2, XCircle, Loader2, ChevronRight, Trash2
} from 'lucide-react';

// ─────────────── Types ───────────────
interface ConverterFile {
  id: string;
  name: string;
  size: number;
  type: string;
  bytes: Uint8Array;
  status: 'ready' | 'processing' | 'done' | 'error';
  error?: string;
  resultBytes?: Uint8Array;
  resultName?: string;
  resultMime?: string;
}

type ConverterTool =
  | 'merge'
  | 'split'
  | 'page-studio'
  | 'security'
  | 'reverse'
  | 'images'
  | 'office'
  | 'cad';

// ─────────────── Helpers ───────────────
const formatBytes = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

const downloadBlob = (bytes: Uint8Array, name: string, mime: string) => {
  const blob = new Blob([bytes as any], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

const readFileBytes = (file: File): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });

// ─────────────── Drop Zone ───────────────
const DropZone: React.FC<{
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  label: string;
  hint?: string;
}> = ({ accept, multiple = false, onFiles, label, hint }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length) onFiles(files);
    },
    [onFiles]
  );

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        relative flex flex-col items-center justify-center gap-3 p-10
        rounded-2xl border-2 border-dashed cursor-pointer transition-all
        ${dragging
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
          : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20'
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={e => {
          const files = Array.from(e.target.files || []);
          if (files.length) onFiles(files);
          e.target.value = '';
        }}
      />
      <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center border border-blue-200 dark:border-blue-800">
        <Upload className="w-7 h-7 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{label}</p>
        {hint && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{hint}</p>}
      </div>
      <span className="text-[11px] px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
        Click or drag & drop
      </span>
    </div>
  );
};

// ─────────────── File List ───────────────
const FileRow: React.FC<{
  file: ConverterFile;
  onRemove: () => void;
  onDownload: () => void;
}> = ({ file, onRemove, onDownload }) => (
  <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60">
    <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
      <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{file.name}</p>
      <p className="text-[10px] text-slate-400">{formatBytes(file.size)}</p>
    </div>
    <div className="flex items-center gap-1.5 shrink-0">
      {file.status === 'processing' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
      {file.status === 'done' && (
        <>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <button
            onClick={onDownload}
            className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all cursor-pointer"
            title="Download result"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </>
      )}
      {file.status === 'error' && (
        <div className="flex items-center gap-1" title={file.error}>
          <XCircle className="w-4 h-4 text-rose-500" />
          <span className="text-[10px] text-rose-500 max-w-[100px] truncate">{file.error}</span>
        </div>
      )}
      <button
        onClick={onRemove}
        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer"
        title="Remove"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

// ─────────────── Tool Panel Wrapper ───────────────
const ToolPanel: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, icon, children }) => (
  <div className="space-y-5">
    <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-700">
      <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center border border-blue-200 dark:border-blue-800">
        {icon}
      </div>
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
    </div>
    {children}
  </div>
);

// ─────────────── PDF Merge Tool ───────────────
const MergeTool: React.FC = () => {
  const [files, setFiles] = useState<ConverterFile[]>([]);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<Uint8Array | null>(null);

  const addFiles = async (rawFiles: File[]) => {
    const newFiles: ConverterFile[] = await Promise.all(
      rawFiles.map(async f => ({
        id: `${Date.now()}-${Math.random()}`,
        name: f.name,
        size: f.size,
        type: f.type,
        bytes: await readFileBytes(f),
        status: 'ready' as const,
      }))
    );
    setFiles(p => [...p, ...newFiles]);
    setResult(null);
  };

  const merge = async () => {
    if (files.length < 2) return;
    setProcessing(true);
    setResult(null);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const merged = await PDFDocument.create();
      for (const f of files) {
        const doc = await PDFDocument.load(f.bytes);
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      }
      const bytes = await merged.save();
      setResult(bytes);
    } catch (e: any) {
      alert('Merge failed: ' + (e.message || 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ToolPanel title="PDF Merge" description="Combine multiple PDFs into one document" icon={<FilePlus2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />}>
      <DropZone accept=".pdf,application/pdf" multiple onFiles={addFiles} label="Add PDF files to merge" hint="Accepted: .pdf" />
      <div className="space-y-2">
        {files.map(f => (
          <FileRow key={f.id} file={f} onRemove={() => setFiles(p => p.filter(x => x.id !== f.id))} onDownload={() => {}} />
        ))}
      </div>
      {files.length >= 2 && !result && (
        <button
          onClick={merge}
          disabled={processing}
          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
        >
          {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FilePlus2 className="w-4 h-4" />}
          {processing ? 'Merging PDFs…' : `Merge ${files.length} PDFs`}
        </button>
      )}
      {result && (
        <button
          onClick={() => downloadBlob(result, 'merged.pdf', 'application/pdf')}
          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Download className="w-4 h-4" /> Download Merged PDF
        </button>
      )}
    </ToolPanel>
  );
};

// ─────────────── PDF Split Tool ───────────────
const SplitTool: React.FC = () => {
  const [file, setFile] = useState<ConverterFile | null>(null);
  const [mode, setMode] = useState<'pages' | 'range' | 'chunk'>('pages');
  const [chunkSize, setChunkSize] = useState(1);
  const [rangeFrom, setRangeFrom] = useState(1);
  const [rangeTo, setRangeTo] = useState(5);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<Uint8Array | null>(null);

  const addFile = async (rawFiles: File[]) => {
    const f = rawFiles[0];
    setFile({ id: Date.now().toString(), name: f.name, size: f.size, type: f.type, bytes: await readFileBytes(f), status: 'ready' });
    setResult(null);
  };

  const split = async () => {
    if (!file) return;
    setProcessing(true);
    setResult(null);
    try {
      const { PdfPageStudioService } = await import('../../services/converter/pdfPageStudio');
      if (mode === 'pages') {
        const zipBytes = await PdfPageStudioService.splitIntoZip(file.bytes, file.name.replace(/\.pdf$/i, ''));
        setResult(zipBytes);
      } else if (mode === 'range') {
        const extracted = await PdfPageStudioService.extractPageRange(file.bytes, `${rangeFrom}-${rangeTo}`);
        setResult(extracted);
      } else {
        const zipBytes = await PdfPageStudioService.splitByChunkSize(file.bytes, file.name.replace(/\.pdf$/i, ''), chunkSize);
        setResult(zipBytes);
      }
    } catch (e: any) {
      alert('Split failed: ' + (e.message || 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  };

  const isZip = mode === 'pages' || mode === 'chunk';

  return (
    <ToolPanel title="PDF Split" description="Split a PDF into individual pages, ranges, or chunks" icon={<Scissors className="w-5 h-5 text-blue-600 dark:text-blue-400" />}>
      <DropZone accept=".pdf,application/pdf" onFiles={addFile} label="Upload PDF to split" hint="Accepted: .pdf" />
      {file && (
        <>
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center gap-3">
            <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate flex-1">{file.name}</span>
            <button onClick={() => { setFile(null); setResult(null); }} className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex gap-2">
            {(['pages', 'range', 'chunk'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${mode === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'}`}>
                {m === 'pages' ? 'Each Page' : m === 'range' ? 'Page Range' : 'Chunks'}
              </button>
            ))}
          </div>
          {mode === 'range' && (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">From Page</label>
                <input type="number" min={1} value={rangeFrom} onChange={e => setRangeFrom(+e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">To Page</label>
                <input type="number" min={1} value={rangeTo} onChange={e => setRangeTo(+e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          )}
          {mode === 'chunk' && (
            <div>
              <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Pages per chunk</label>
              <input type="number" min={1} value={chunkSize} onChange={e => setChunkSize(+e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          {!result && (
            <button onClick={split} disabled={processing} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60">
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />}
              {processing ? 'Splitting…' : 'Split PDF'}
            </button>
          )}
          {result && (
            <button onClick={() => downloadBlob(result, isZip ? 'split-pages.zip' : `extracted-p${rangeFrom}-${rangeTo}.pdf`, isZip ? 'application/zip' : 'application/pdf')} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer">
              <Download className="w-4 h-4" /> Download {isZip ? 'ZIP Archive' : 'Extracted PDF'}
            </button>
          )}
        </>
      )}
    </ToolPanel>
  );
};

// ─────────────── Security / Watermark Tool ───────────────
const SecurityTool: React.FC = () => {
  const [file, setFile] = useState<ConverterFile | null>(null);
  const [mode, setMode] = useState<'watermark-text' | 'page-numbers' | 'compress'>('watermark-text');
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [opacity, setOpacity] = useState(0.25);
  const [pageNumFormat, setPageNumFormat] = useState<'Page {n} of {total}' | '{n}' | 'Page {n}'>('Page {n} of {total}');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<Uint8Array | null>(null);

  const addFile = async (rawFiles: File[]) => {
    const f = rawFiles[0];
    setFile({ id: Date.now().toString(), name: f.name, size: f.size, type: f.type, bytes: await readFileBytes(f), status: 'ready' });
    setResult(null);
  };

  const process = async () => {
    if (!file) return;
    setProcessing(true);
    setResult(null);
    try {
      const { PdfSecurityAndTools } = await import('../../services/converter/pdfSecurityAndTools');
      let out: Uint8Array;
      if (mode === 'watermark-text') {
        out = await PdfSecurityAndTools.applyWatermark(file.bytes, {
          type: 'text',
          text: watermarkText,
          fontSize: 52,
          opacity,
          angle: -40,
          color: 'gray',
          layout: 'tiled',
        });
      } else if (mode === 'page-numbers') {
        out = await PdfSecurityAndTools.addPageNumbers(file.bytes, {
          format: pageNumFormat,
          position: 'bottom-center',
          fontSize: 11,
          startNumber: 1,
          marginOffset: 20,
        });
      } else {
        out = await PdfSecurityAndTools.compressPdf(file.bytes, { quality: 'balanced', scale: 1 });
      }
      setResult(out);
    } catch (e: any) {
      alert('Failed: ' + (e.message || 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  };

  const resultName = () => {
    const base = file?.name.replace(/\.pdf$/i, '') || 'output';
    if (mode === 'watermark-text') return `${base}-watermarked.pdf`;
    if (mode === 'page-numbers') return `${base}-numbered.pdf`;
    return `${base}-compressed.pdf`;
  };

  return (
    <ToolPanel title="PDF Security & Tools" description="Add watermarks, page numbers, or compress PDFs" icon={<Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />}>
      <DropZone accept=".pdf,application/pdf" onFiles={addFile} label="Upload PDF" hint="Accepted: .pdf" />
      {file && (
        <>
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center gap-3">
            <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate flex-1">{file.name}</span>
            <button onClick={() => { setFile(null); setResult(null); }} className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['watermark-text', 'page-numbers', 'compress'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setResult(null); }}
                className={`flex-1 min-w-[80px] py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${mode === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'}`}>
                {m === 'watermark-text' ? 'Watermark' : m === 'page-numbers' ? 'Page Numbers' : 'Compress'}
              </button>
            ))}
          </div>
          {mode === 'watermark-text' && (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Watermark Text</label>
                <input value={watermarkText} onChange={e => setWatermarkText(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Opacity: {Math.round(opacity * 100)}%</label>
                <input type="range" min={0.05} max={1} step={0.05} value={opacity} onChange={e => setOpacity(+e.target.value)} className="mt-1 w-full accent-blue-600" />
              </div>
            </div>
          )}
          {mode === 'page-numbers' && (
            <div>
              <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Format</label>
              <select value={pageNumFormat} onChange={e => setPageNumFormat(e.target.value as any)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="Page {n} of {total}">Page 1 of 10</option>
                <option value="{n}">1</option>
                <option value="Page {n}">Page 1</option>
              </select>
            </div>
          )}
          {mode === 'compress' && (
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
              Compression reduces file size by resampling images to 150 DPI (balanced quality).
            </div>
          )}
          {!result ? (
            <button onClick={process} disabled={processing} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60">
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              {processing ? 'Processing…' : 'Apply'}
            </button>
          ) : (
            <button onClick={() => downloadBlob(result, resultName(), 'application/pdf')} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer">
              <Download className="w-4 h-4" /> Download Result
            </button>
          )}
        </>
      )}
    </ToolPanel>
  );
};

// ─────────────── Reverse Converter (PDF → ...) ───────────────
const ReverseTool: React.FC = () => {
  const [file, setFile] = useState<ConverterFile | null>(null);
  const [mode, setMode] = useState<'docx' | 'images' | 'text'>('docx');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<Uint8Array | null>(null);

  const addFile = async (rawFiles: File[]) => {
    const f = rawFiles[0];
    setFile({ id: Date.now().toString(), name: f.name, size: f.size, type: f.type, bytes: await readFileBytes(f), status: 'ready' });
    setResult(null);
  };

  const convert = async () => {
    if (!file) return;
    setProcessing(true);
    setResult(null);
    try {
      const { ReverseConverter } = await import('../../services/converter/reverseConverter');
      const base = file.name.replace(/\.pdf$/i, '');
      let out: Uint8Array;
      if (mode === 'docx') out = await ReverseConverter.pdfToDocx(file.bytes, base);
      else if (mode === 'images') out = await ReverseConverter.pdfToImagesZip(file.bytes, base);
      else {
        const text = await ReverseConverter.pdfToText(file.bytes);
        out = new TextEncoder().encode(text);
      }
      setResult(out);
    } catch (e: any) {
      alert('Conversion failed: ' + (e.message || 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  };

  const modeConfig = {
    docx: { label: '→ Word (.docx)', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' },
    images: { label: '→ Images (ZIP)', mime: 'application/zip', ext: 'zip' },
    text: { label: '→ Text (.txt)', mime: 'text/plain', ext: 'txt' },
  };

  return (
    <ToolPanel title="Reverse Converter" description="Convert PDF to Word, Images, or Plain Text" icon={<RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400" />}>
      <DropZone accept=".pdf,application/pdf" onFiles={addFile} label="Upload PDF to convert" hint="Accepted: .pdf" />
      {file && (
        <>
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center gap-3">
            <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate flex-1">{file.name}</span>
            <button onClick={() => { setFile(null); setResult(null); }} className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex gap-2">
            {(['docx', 'images', 'text'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setResult(null); }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${mode === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'}`}>
                {modeConfig[m].label}
              </button>
            ))}
          </div>
          {!result ? (
            <button onClick={convert} disabled={processing} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60">
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {processing ? 'Converting…' : 'Convert'}
            </button>
          ) : (
            <button onClick={() => {
              const base = file.name.replace(/\.pdf$/i, '');
              const cfg = modeConfig[mode];
              downloadBlob(result, `${base}.${cfg.ext}`, cfg.mime);
            }} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer">
              <Download className="w-4 h-4" /> Download {modeConfig[mode].label}
            </button>
          )}
        </>
      )}
    </ToolPanel>
  );
};

// ─────────────── Images to PDF ───────────────
const ImagesTool: React.FC = () => {
  const [files, setFiles] = useState<ConverterFile[]>([]);
  const [mode, setMode] = useState<'single' | 'gallery'>('gallery');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<Uint8Array | null>(null);

  const addFiles = async (rawFiles: File[]) => {
    const newFiles: ConverterFile[] = await Promise.all(
      rawFiles.map(async f => ({
        id: `${Date.now()}-${Math.random()}`,
        name: f.name,
        size: f.size,
        type: f.type,
        bytes: await readFileBytes(f),
        status: 'ready' as const,
      }))
    );
    setFiles(p => [...p, ...newFiles]);
    setResult(null);
  };

  const convert = async () => {
    if (!files.length) return;
    setProcessing(true);
    setResult(null);
    try {
      const { ImageConverter } = await import('../../services/converter/imageConverter');
      let out: Uint8Array;
      if (mode === 'gallery') {
        const galleryItems = files.map(f => ({
          id: f.id,
          name: f.name,
          size: f.size,
          bytes: f.bytes,
          previewUrl: '',
          rotation: 0,
          width: 0,
          height: 0,
        }));
        out = await ImageConverter.galleryToPdf(galleryItems, { layout: 2, margin: 20 });
      } else {
        out = await ImageConverter.singleImageToPdf(files[0].bytes, files[0].name, { orientation: 'auto', margin: 20 });
      }
      setResult(out);
    } catch (e: any) {
      alert('Conversion failed: ' + (e.message || 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ToolPanel title="Images to PDF" description="Convert images to PDF — single page or gallery layout" icon={<ImageIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />}>
      <div className="flex gap-2">
        {(['gallery', 'single'] as const).map(m => (
          <button key={m} onClick={() => { setMode(m); setResult(null); }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${mode === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'}`}>
            {m === 'gallery' ? 'Gallery (2-col)' : 'Single Image → A4'}
          </button>
        ))}
      </div>
      <DropZone accept=".jpg,.jpeg,.png,.webp,image/*" multiple={mode === 'gallery'} onFiles={addFiles} label={mode === 'gallery' ? 'Add images for gallery PDF' : 'Upload one image'} hint="Accepted: JPG, PNG, WEBP" />
      <div className="space-y-2">
        {files.map(f => (
          <FileRow key={f.id} file={f} onRemove={() => setFiles(p => p.filter(x => x.id !== f.id))} onDownload={() => {}} />
        ))}
      </div>
      {files.length > 0 && !result && (
        <button onClick={convert} disabled={processing} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60">
          {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          {processing ? 'Converting…' : 'Create PDF'}
        </button>
      )}
      {result && (
        <button onClick={() => downloadBlob(result, 'images.pdf', 'application/pdf')} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer">
          <Download className="w-4 h-4" /> Download PDF
        </button>
      )}
    </ToolPanel>
  );
};

// ─────────────── Office Converter (DOCX/XLSX → PDF) ───────────────
const OfficeTool: React.FC = () => {
  const [files, setFiles] = useState<ConverterFile[]>([]);
  const [processing, setProcessing] = useState(false);

  const addFiles = async (rawFiles: File[]) => {
    const newFiles: ConverterFile[] = await Promise.all(
      rawFiles.map(async f => ({
        id: `${Date.now()}-${Math.random()}`,
        name: f.name,
        size: f.size,
        type: f.type,
        bytes: await readFileBytes(f),
        status: 'ready' as const,
      }))
    );
    setFiles(p => [...p, ...newFiles]);
  };

  const processFile = async (id: string) => {
    setFiles(p => p.map(f => f.id === id ? { ...f, status: 'processing' } : f));
    setProcessing(true);
    try {
      const { OfficeConverter } = await import('../../services/converter/officeConverter');
      const f = files.find(x => x.id === id)!;
      let resultBytes: Uint8Array;
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      if (ext === 'docx' || ext === 'doc') {
        resultBytes = await OfficeConverter.docxToPdf(f.bytes, f.name);
      } else if (ext === 'xlsx' || ext === 'xls') {
        resultBytes = await OfficeConverter.xlsxToPdf(f.bytes, f.name);
      } else if (ext === 'txt') {
        resultBytes = await OfficeConverter.textToPdf(f.bytes, f.name);
      } else {
        throw new Error(`Unsupported format: .${ext}`);
      }
      setFiles(p => p.map(x => x.id === id
        ? { ...x, status: 'done', resultBytes, resultName: x.name.replace(/\.\w+$/, '.pdf'), resultMime: 'application/pdf' }
        : x));
    } catch (e: any) {
      setFiles(p => p.map(x => x.id === id ? { ...x, status: 'error', error: e.message || 'Failed' } : x));
    } finally {
      setProcessing(false);
    }
  };

  const convertAll = async () => {
    const ready = files.filter(f => f.status === 'ready');
    for (const f of ready) await processFile(f.id);
  };

  return (
    <ToolPanel title="Office to PDF" description="Convert Word, Excel, and Text files to PDF" icon={<FileSpreadsheet className="w-5 h-5 text-blue-600 dark:text-blue-400" />}>
      <DropZone accept=".docx,.doc,.xlsx,.xls,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain" multiple onFiles={addFiles} label="Upload Office files" hint="Accepted: .docx, .xlsx, .txt" />
      <div className="space-y-2">
        {files.map(f => (
          <FileRow key={f.id} file={f}
            onRemove={() => setFiles(p => p.filter(x => x.id !== f.id))}
            onDownload={() => f.resultBytes && downloadBlob(f.resultBytes, f.resultName || 'output.pdf', 'application/pdf')}
          />
        ))}
      </div>
      {files.some(f => f.status === 'ready') && (
        <button onClick={convertAll} disabled={processing} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60">
          {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
          {processing ? 'Converting…' : 'Convert All to PDF'}
        </button>
      )}
    </ToolPanel>
  );
};

// ─────────────── CAD Converter ───────────────
const CadTool: React.FC = () => {
  const [file, setFile] = useState<ConverterFile | null>(null);
  const [theme, setTheme] = useState<'blueprint' | 'layers' | 'clean'>('blueprint');
  const [paperSize, setPaperSize] = useState<'a4' | 'a3' | 'a2' | 'a1' | 'letter'>('a4');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<Uint8Array | null>(null);

  const addFile = async (rawFiles: File[]) => {
    const f = rawFiles[0];
    setFile({ id: Date.now().toString(), name: f.name, size: f.size, type: f.type, bytes: await readFileBytes(f), status: 'ready' });
    setResult(null);
  };

  const convert = async () => {
    if (!file) return;
    setProcessing(true);
    setResult(null);
    try {
      const { CadConverter } = await import('../../services/converter/cadConverter');
      const out = await CadConverter.cadToPdf(file.bytes, file.name, { theme, paperSize, orientation, scaleToFit: true });
      setResult(out);
    } catch (e: any) {
      alert('CAD conversion failed: ' + (e.message || 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ToolPanel title="CAD to PDF" description="Convert AutoCAD DXF drawings to professional PDF blueprints" icon={<Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />}>
      <DropZone accept=".dxf,.dwg" onFiles={addFile} label="Upload CAD drawing" hint="Accepted: .dxf (DWG not supported in web)" />
      {file && (
        <>
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center gap-3">
            <Layers className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate flex-1">{file.name}</span>
            <button onClick={() => { setFile(null); setResult(null); }} className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Theme</label>
              <select value={theme} onChange={e => setTheme(e.target.value as any)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="blueprint">Blueprint</option>
                <option value="layers">Layers</option>
                <option value="clean">Clean</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Paper Size</label>
              <select value={paperSize} onChange={e => setPaperSize(e.target.value as any)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['a4', 'a3', 'a2', 'a1', 'letter'].map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Orientation</label>
              <select value={orientation} onChange={e => setOrientation(e.target.value as any)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="landscape">Landscape</option>
                <option value="portrait">Portrait</option>
              </select>
            </div>
          </div>
          {!result ? (
            <button onClick={convert} disabled={processing} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60">
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
              {processing ? 'Rendering Blueprint…' : 'Convert to PDF Blueprint'}
            </button>
          ) : (
            <button onClick={() => downloadBlob(result, file.name.replace(/\.\w+$/, '-blueprint.pdf'), 'application/pdf')} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer">
              <Download className="w-4 h-4" /> Download Blueprint PDF
            </button>
          )}
        </>
      )}
    </ToolPanel>
  );
};

// ─────────────── Page Studio Tool ───────────────
const PageStudioTool: React.FC = () => {
  const [file, setFile] = useState<ConverterFile | null>(null);
  const [mode, setMode] = useState<'odd-even' | 'reverse'>('odd-even');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<Uint8Array | null>(null);

  const addFile = async (rawFiles: File[]) => {
    const f = rawFiles[0];
    setFile({ id: Date.now().toString(), name: f.name, size: f.size, type: f.type, bytes: await readFileBytes(f), status: 'ready' });
    setResult(null);
  };

  const process = async () => {
    if (!file) return;
    setProcessing(true);
    setResult(null);
    try {
      const { PdfPageStudioService } = await import('../../services/converter/pdfPageStudio');
      let out: Uint8Array;
      if (mode === 'odd-even') {
        out = await PdfPageStudioService.splitOddEven(file.bytes, 'odd');
      } else {
        // Reverse: extract pages in reverse order using mergePdfs after splitting
        const { PDFDocument } = await import('pdf-lib');
        const srcDoc = await PDFDocument.load(file.bytes);
        const pageCount = srcDoc.getPageCount();
        const newDoc = await PDFDocument.create();
        const indices = Array.from({ length: pageCount }, (_, i) => pageCount - 1 - i);
        const pages = await newDoc.copyPages(srcDoc, indices);
        pages.forEach(p => newDoc.addPage(p));
        out = await newDoc.save();
      }
      setResult(out);
    } catch (e: any) {
      alert('Failed: ' + (e.message || 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ToolPanel title="Page Studio" description="Reorder, reverse, or extract specific pages from PDFs" icon={<LayoutGrid className="w-5 h-5 text-blue-600 dark:text-blue-400" />}>
      <DropZone accept=".pdf,application/pdf" onFiles={addFile} label="Upload PDF" hint="Accepted: .pdf" />
      {file && (
        <>
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center gap-3">
            <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate flex-1">{file.name}</span>
            <button onClick={() => { setFile(null); setResult(null); }} className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex gap-2">
            {(['odd-even', 'reverse'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setResult(null); }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${mode === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400'}`}>
                {m === 'odd-even' ? 'Odd Pages Only' : 'Reverse Page Order'}
              </button>
            ))}
          </div>
          {!result ? (
            <button onClick={process} disabled={processing} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60">
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <LayoutGrid className="w-4 h-4" />}
              {processing ? 'Processing…' : 'Apply'}
            </button>
          ) : (
            <button onClick={() => downloadBlob(result, file.name.replace(/\.pdf$/i, `-${mode}.pdf`), 'application/pdf')} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer">
              <Download className="w-4 h-4" /> Download Result
            </button>
          )}
        </>
      )}
    </ToolPanel>
  );
};

// ─────────────── Sidebar nav items ───────────────
const NAV_ITEMS: { id: ConverterTool; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'merge', label: 'Merge PDFs', icon: <FilePlus2 className="w-4 h-4" />, description: 'Combine multiple PDFs' },
  { id: 'split', label: 'Split PDF', icon: <Scissors className="w-4 h-4" />, description: 'Extract pages or ranges' },
  { id: 'page-studio', label: 'Page Studio', icon: <LayoutGrid className="w-4 h-4" />, description: 'Reorder & reverse pages' },
  { id: 'security', label: 'Security & Tools', icon: <Shield className="w-4 h-4" />, description: 'Watermark, numbers, compress' },
  { id: 'reverse', label: 'PDF → Other', icon: <RefreshCw className="w-4 h-4" />, description: 'PDF to Word, Images, Text' },
  { id: 'images', label: 'Images → PDF', icon: <ImageIcon className="w-4 h-4" />, description: 'Create gallery or single PDF' },
  { id: 'office', label: 'Office → PDF', icon: <FileSpreadsheet className="w-4 h-4" />, description: 'Word, Excel, Text to PDF' },
  { id: 'cad', label: 'CAD → PDF', icon: <Layers className="w-4 h-4" />, description: 'DXF blueprint rendering' },
];

// ─────────────── Main Converter View ───────────────
export const ConverterView: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ConverterTool>('merge');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const renderTool = () => {
    switch (activeTool) {
      case 'merge': return <MergeTool />;
      case 'split': return <SplitTool />;
      case 'page-studio': return <PageStudioTool />;
      case 'security': return <SecurityTool />;
      case 'reverse': return <ReverseTool />;
      case 'images': return <ImagesTool />;
      case 'office': return <OfficeTool />;
      case 'cad': return <CadTool />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Page Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center border border-blue-200 dark:border-blue-800">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">Master Converter</h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">PDF, Office, Images & CAD — all tools in one place</p>
            </div>
          </div>
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setMobileSidebarOpen(p => !p)}
            className="md:hidden flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            <LayoutGrid className="w-4 h-4" /> Tools
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex gap-6 flex-1">
        {/* Sidebar */}
        <aside className={`
          ${mobileSidebarOpen ? 'block' : 'hidden'} md:block
          w-full md:w-56 lg:w-60 shrink-0
        `}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-3 border-b border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Tools</p>
            </div>
            <nav className="p-2 space-y-0.5">
              {NAV_ITEMS.map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTool(item.id);
                    setMobileSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer group
                    ${activeTool === item.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }
                  `}
                >
                  <span className={`shrink-0 ${activeTool === item.id ? 'text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'}`}>
                    {item.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold leading-tight truncate">{item.label}</p>
                    <p className={`text-[10px] leading-tight truncate ${activeTool === item.id ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'}`}>
                      {item.description}
                    </p>
                  </div>
                  {activeTool === item.id && <ChevronRight className="w-3.5 h-3.5 shrink-0 text-blue-200" />}
                </button>
              ))}
            </nav>
          </div>

          {/* Privacy note */}
          <div className="mt-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1 animate-pulse" />
              <div>
                <p className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300">100% Offline & Private</p>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5 leading-relaxed">All processing happens locally in your browser. No files are uploaded to any server.</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
            {renderTool()}
          </div>
        </main>
      </div>
    </div>
  );
};
