import React, { useState } from 'react';
import { 
  FileText, 
  FileSpreadsheet, 
  Image as ImageIcon, 
  UploadCloud, 
  Download, 
  CheckCircle, 
  AlertCircle,
  Loader2, 
  Trash2, 
  FileType,
  ScanText
} from 'lucide-react';
import { 
  convertPdfToDocx, 
  convertPdfToImagesZip, 
  convertPdfToExcel, 
  convertPdfToText,
  convertPdfWithOcr
} from '../../../services/converter/reverseConverter';

type ExportFormat = 'docx' | 'images' | 'xlsx' | 'txt' | 'ocr';

interface ExportOption {
  id: ExportFormat;
  title: string;
  description: string;
  badge: string;
  icon: any;
  color: string;
  bgColor: string;
  borderColor: string;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: 'docx',
    title: 'Microsoft Word (.docx)',
    description: 'Converts PDF text & flow paragraphs into formatted editable Word document XML packages.',
    badge: 'Popular',
    icon: FileText,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  {
    id: 'images',
    title: 'High-Res Page Images (.zip)',
    description: 'Renders every PDF page at 300 DPI canvas resolution and bundles into an organized ZIP archive.',
    badge: '300 DPI',
    icon: ImageIcon,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200'
  },
  {
    id: 'xlsx',
    title: 'Microsoft Excel (.xlsx)',
    description: 'Detects tabular coordinate lines and text columns to reconstruct native multi-sheet spreadsheets.',
    badge: 'Data Tables',
    icon: FileSpreadsheet,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200'
  },
  {
    id: 'txt',
    title: 'Plain Text (.txt)',
    description: 'Strips formatting and outputs pure UTF-8 plain text preserving logical reading flow.',
    badge: 'Clean Text',
    icon: FileType,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200'
  },
  {
    id: 'ocr',
    title: 'Client-Side OCR Vision (.txt)',
    description: 'Performs on-device Optical Character Recognition on scanned PDFs without external APIs.',
    badge: 'Tesseract OCR',
    icon: ScanText,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200'
  }
];

export const ReverseConverterStudio: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | { name: string; size: number; buffer: ArrayBuffer } | null>(null);
  const [targetFormat, setTargetFormat] = useState<ExportFormat>('docx');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [resultBlob, setResultBlob] = useState<{ blob: Blob; filename: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSelectPdf = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg('Please select a valid PDF file.');
      return;
    }
    setErrorMsg(null);
    setResultBlob(null);
    setSelectedFile(file);
  };

  const handleNativeBrowse = async () => {
    if (window.electronAPI) {
      const files = await window.electronAPI.openFilesDialog({
        filters: [{ name: 'PDF Documents (*.pdf)', extensions: ['pdf'] }]
      });
      if (files && files.length > 0) {
        setErrorMsg(null);
        setResultBlob(null);
        setSelectedFile(files[0]);
      }
    } else {
      document.getElementById('reverse-pdf-input')?.click();
    }
  };

  const handleStartConversion = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    setErrorMsg(null);
    setResultBlob(null);
    setProgressPercent(5);
    setProgressMsg('Loading PDF document into memory...');

    try {
      let arrayBuffer: ArrayBuffer;
      if (selectedFile instanceof File) {
        arrayBuffer = await selectedFile.arrayBuffer();
      } else {
        arrayBuffer = selectedFile.buffer;
      }

      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
      let outBlob: Blob;
      let outFilename: string;

      if (targetFormat === 'docx') {
        setProgressMsg('Extracting structural content & creating Word document...');
        setProgressPercent(25);
        outBlob = await convertPdfToDocx(arrayBuffer, (p, m) => {
          setProgressPercent(p);
          setProgressMsg(m);
        });
        outFilename = `${baseName}_converted.docx`;
      } else if (targetFormat === 'images') {
        setProgressMsg('Rasterizing PDF pages to high-resolution PNGs...');
        setProgressPercent(20);
        outBlob = await convertPdfToImagesZip(arrayBuffer, (p, m) => {
          setProgressPercent(p);
          setProgressMsg(m);
        });
        outFilename = `${baseName}_pages_images.zip`;
      } else if (targetFormat === 'xlsx') {
        setProgressMsg('Parsing tabular data & cell coordinates...');
        setProgressPercent(25);
        outBlob = await convertPdfToExcel(arrayBuffer, (p, m) => {
          setProgressPercent(p);
          setProgressMsg(m);
        });
        outFilename = `${baseName}_tables.xlsx`;
      } else if (targetFormat === 'txt') {
        setProgressMsg('Extracting raw text strings...');
        setProgressPercent(30);
        outBlob = await convertPdfToText(arrayBuffer, (p, m) => {
          setProgressPercent(p);
          setProgressMsg(m);
        });
        outFilename = `${baseName}_extracted.txt`;
      } else {
        setProgressMsg('Scanning PDF pages with local OCR vision...');
        setProgressPercent(20);
        outBlob = await convertPdfWithOcr(arrayBuffer, (p, m) => {
          setProgressPercent(p);
          setProgressMsg(m);
        });
        outFilename = `${baseName}_ocr_extracted.txt`;
      }

      setProgressPercent(100);
      setProgressMsg('Conversion complete!');
      setResultBlob({ blob: outBlob, filename: outFilename });
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Conversion failed: ${err.message || 'Unknown processing error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultBlob) return;
    const url = URL.createObjectURL(resultBlob.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = resultBlob.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] text-slate-800 select-none overflow-y-auto custom-scrollbar font-sans p-6 md:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto w-full mb-6">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-semibold mb-1 border border-orange-100">
              <FileType className="size-3.5" />
              <span>Conversion Studio</span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              PDF to Office, High-Res Images & OCR
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Extract Word (.docx), Excel spreadsheets (.xlsx), 300 DPI images, or searchable OCR text.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-6xl mx-auto w-full">
        {/* Left: Input PDF Selection */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex flex-col gap-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              1. Select Source PDF
            </h3>

            <input 
              id="reverse-pdf-input"
              type="file" 
              accept=".pdf" 
              className="hidden" 
              onChange={(e) => handleSelectPdf(e.target.files)}
            />

            {!selectedFile ? (
              <div 
                onClick={handleNativeBrowse}
                className="border-2 border-dashed border-slate-300 hover:border-orange-500 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-orange-50/20 group shadow-2xs"
              >
                <div className="size-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center mb-3 group-hover:scale-105 transition border border-orange-100">
                  <UploadCloud className="size-6" />
                </div>
                <p className="text-sm font-bold text-slate-800">
                  Choose PDF to Convert
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Drag and drop file here, or click to browse
                </p>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2.5 bg-orange-100 text-orange-700 rounded-lg shrink-0">
                    <FileType className="w-5 h-5" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => { setSelectedFile(null); setResultBlob(null); }}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                  title="Remove file"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Target Format Selection & Action */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs flex flex-col gap-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              2. Choose Output Format
            </h3>

            <div className="grid grid-cols-1 gap-2.5">
              {EXPORT_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = targetFormat === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setTargetFormat(opt.id)}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex items-start gap-3.5 ${
                      isSelected 
                        ? 'border-orange-500 bg-orange-50/60 ring-2 ring-orange-200' 
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 border ${opt.bgColor} ${opt.color} ${opt.borderColor}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{opt.title}</span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {opt.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        {opt.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {isProcessing && (
              <div className="space-y-2 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between text-xs text-slate-700 font-semibold">
                  <span>{progressMsg}</span>
                  <span className="font-mono">{progressPercent}%</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-orange-500 h-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end">
              <button
                onClick={handleStartConversion}
                disabled={!selectedFile || isProcessing}
                className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Convert Now</span>
                  </>
                )}
              </button>
            </div>

            {resultBlob && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between animate-in fade-in">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h4 className="text-xs font-bold text-emerald-900">Conversion Finished</h4>
                    <span className="text-[11px] text-emerald-700">{resultBlob.filename}</span>
                  </div>
                </div>
                <button
                  onClick={handleDownload}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
