import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  FileText, 
  Download, 
  Sparkles, 
  CheckCircle2, 
  Loader2, 
  Eye, 
  Trash2, 
  UploadCloud 
} from 'lucide-react';
import JSZip from 'jszip';
import { OfficeConverter } from '../../../services/converter/officeConverter';
import { PdfPreviewModal } from '../ui/PdfPreviewModal';

export const OfficeConverterStudio: React.FC = () => {
  const [files, setFiles] = useState<Array<{ name: string; bytes: Uint8Array; type: 'docx' | 'xlsx' | 'txt' }>>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [convertedPdfs, setConvertedPdfs] = useState<Array<{ name: string; bytes: Uint8Array }>>([]);
  const [previewPdf, setPreviewPdf] = useState<{ bytes: Uint8Array; name: string } | null>(null);
  const [batchStatus, setBatchStatus] = useState<string | null>(null);

  const handleFilesInput = (fileList: FileList | File[]) => {
    Array.from(fileList).forEach((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      if (['docx', 'xlsx', 'xls', 'txt'].includes(ext || '')) {
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) {
            setFiles((prev) => [
              ...prev,
              {
                name: f.name,
                bytes: new Uint8Array(reader.result as ArrayBuffer),
                type: (ext === 'docx' ? 'docx' : ext === 'xlsx' || ext === 'xls' ? 'xlsx' : 'txt') as any
              }
            ]);
          }
        };
        reader.readAsArrayBuffer(f);
      }
    });
  };

  const handleSelectFiles = async () => {
    if (window.electronAPI) {
      const selected = await window.electronAPI.openFilesDialog({
        filters: [
          { name: 'Office Documents (*.docx, *.xlsx, *.txt)', extensions: ['docx', 'xlsx', 'xls', 'txt'] }
        ]
      });

      if (selected && Array.isArray(selected)) {
        selected.forEach((f: any) => {
          const ext = f.name.split('.').pop()?.toLowerCase();
          setFiles((prev) => [
            ...prev,
            {
              name: f.name,
              bytes: new Uint8Array(f.buffer),
              type: (ext === 'docx' ? 'docx' : ext === 'xlsx' || ext === 'xls' ? 'xlsx' : 'txt') as any
            }
          ]);
        });
      }
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.docx,.xlsx,.xls,.txt';
      input.multiple = true;
      input.onchange = (e) => {
        const target = e.target as HTMLInputElement;
        if (target.files) handleFilesInput(target.files);
      };
      input.click();
    }
  };

  const handleConvertAll = async () => {
    if (files.length === 0) return;
    setIsConverting(true);
    setConvertedPdfs([]);

    const results: Array<{ name: string; bytes: Uint8Array }> = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setBatchStatus(`Synthesizing (${i + 1}/${files.length}): ${f.name}`);

      try {
        let pdfBytes: Uint8Array;
        if (f.type === 'docx') {
          pdfBytes = await OfficeConverter.docxToPdf(f.bytes, f.name);
        } else if (f.type === 'xlsx') {
          pdfBytes = await OfficeConverter.xlsxToPdf(f.bytes, f.name);
        } else {
          pdfBytes = await OfficeConverter.textToPdf(f.bytes, f.name);
        }

        const outName = f.name.replace(/\.[^/.]+$/, '') + '.pdf';
        results.push({ name: outName, bytes: pdfBytes });
      } catch (err: any) {
        console.error(`Conversion failed for ${f.name}:`, err);
      }
    }

    setConvertedPdfs(results);
    setIsConverting(false);
    setBatchStatus(null);
  };

  const handleDownloadSingle = async (pdf: { name: string; bytes: Uint8Array }) => {
    if (window.electronAPI) {
      await window.electronAPI.saveFileDialog({
        defaultName: pdf.name,
        buffer: pdf.bytes.buffer as ArrayBuffer,
        filterName: 'PDF Documents (*.pdf)',
        extension: 'pdf'
      });
    } else {
      const blob = new Blob([pdf.bytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdf.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleExportAllZip = async () => {
    if (convertedPdfs.length === 0) return;
    const zip = new JSZip();
    const folder = zip.folder('Converted_Office_PDFs') || zip;

    convertedPdfs.forEach((pdf) => {
      folder.file(pdf.name, pdf.bytes);
    });

    const zipBytes = await zip.generateAsync({ type: 'uint8array' });
    const filename = `Converted_Office_Batch_${new Date().toISOString().slice(0, 10)}.zip`;

    if (window.electronAPI) {
      await window.electronAPI.saveFileDialog({
        defaultName: filename,
        buffer: zipBytes.buffer as ArrayBuffer,
        filterName: 'ZIP Archive (*.zip)',
        extension: 'zip'
      });
    } else {
      const blob = new Blob([zipBytes as BlobPart], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] text-slate-800 select-none overflow-y-auto custom-scrollbar font-sans p-6 md:p-8">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold mb-1 border border-emerald-100">
              <Sparkles className="size-3.5" />
              <span>Office Document Engine</span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Word (.docx) & Excel (.xlsx) to PDF
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Render formatted Microsoft Office documents into pristine PDFs completely offline.
            </p>
          </div>
        </div>

        {/* Upload Zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFilesInput(e.dataTransfer.files);
          }}
          onClick={handleSelectFiles}
          className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-white hover:bg-emerald-50/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition shadow-2xs group"
        >
          <div className="size-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-3 group-hover:scale-105 transition border border-emerald-100">
            <UploadCloud className="size-7" />
          </div>
          <span className="text-sm font-bold text-slate-900 block">
            {files.length > 0 ? `${files.length} Office files queued (Click or drop to add more)` : 'Click or Drop Word (.docx) or Excel (.xlsx) Files'}
          </span>
          <span className="text-xs text-slate-400 mt-1 block">Supports multi-file 1-to-1 batch synthesis</span>
        </div>

        {files.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Selected Documents ({files.length}):</span>
              <button
                onClick={() => { setFiles([]); setConvertedPdfs([]); }}
                className="text-slate-400 hover:text-rose-600 transition"
              >
                Clear All
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
              {files.map((file, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-slate-200/90 rounded-xl p-3 flex items-center justify-between shadow-2xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {file.type === 'docx' ? (
                      <FileText className="size-5 text-blue-500 shrink-0" />
                    ) : (
                      <FileSpreadsheet className="size-5 text-emerald-500 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{file.name}</p>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                        {file.type}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded-lg"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 flex items-center justify-between">
              <div>
                {batchStatus && (
                  <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                    <Loader2 className="size-3.5 animate-spin text-emerald-600" />
                    <span>{batchStatus}</span>
                  </span>
                )}
              </div>

              <button
                onClick={handleConvertAll}
                disabled={isConverting}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2"
              >
                <Download className="size-4" />
                <span>{isConverting ? 'Converting...' : `Convert All to PDF (${files.length})`}</span>
              </button>
            </div>
          </div>
        )}

        {/* Converted Results */}
        {convertedPdfs.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-600" />
                <h3 className="text-xs font-bold text-emerald-900">
                  Successfully converted {convertedPdfs.length} PDFs
                </h3>
              </div>

              <button
                onClick={handleExportAllZip}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <Download className="size-3.5" />
                <span>Download All as ZIP</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {convertedPdfs.map((pdf, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-emerald-100 rounded-xl p-3 flex items-center justify-between shadow-2xs"
                >
                  <span className="text-xs font-bold text-slate-800 truncate max-w-[200px]">
                    {pdf.name}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPreviewPdf(pdf)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-50"
                      title="Preview"
                    >
                      <Eye className="size-4" />
                    </button>
                    <button
                      onClick={() => handleDownloadSingle(pdf)}
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg font-bold"
                      title="Download"
                    >
                      <Download className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {previewPdf && (
        <PdfPreviewModal
          pdfBytes={previewPdf.bytes}
          title={previewPdf.name}
          onClose={() => setPreviewPdf(null)}
          onDownload={() => handleDownloadSingle(previewPdf)}
        />
      )}
    </div>
  );
};
