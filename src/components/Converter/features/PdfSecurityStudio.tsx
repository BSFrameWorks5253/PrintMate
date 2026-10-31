import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Stamp, 
  FileDigit, 
  Minimize2, 
  Lock, 
  Unlock,
  UploadCloud, 
  Download, 
  Eye, 
  CheckCircle, 
  RefreshCw, 
  Trash2,
  FileCheck,
  Sparkles,
  Layers,
  Wrench,
  FileText
} from 'lucide-react';
import { 
  PdfSecurityAndToolsService, 
  TextWatermarkConfig,
  ImageWatermarkConfig,
  PageNumberConfig, 
  CompressConfig,
  PdfMetadata 
} from '../../../services/converter/pdfSecurityAndTools';
import { PdfPreviewModal } from '../ui/PdfPreviewModal';

type ActiveTool = 
  | 'watermark' 
  | 'compress' 
  | 'page-numbers' 
  | 'protect' 
  | 'unlock'
  | 'metadata' 
  | 'flatten' 
  | 'repair';

export const PdfSecurityStudio: React.FC<{ initialFile?: { name: string; bytes: Uint8Array; size: number } | null }> = ({
  initialFile = null
}) => {
  const [selectedFile, setSelectedFile] = useState<{ name: string; bytes: Uint8Array; size: number } | null>(initialFile);
  const [activeTool, setActiveTool] = useState<ActiveTool>('watermark');
  const [isLoading, setIsLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [resultPdf, setResultPdf] = useState<{ bytes: Uint8Array; name: string; size: number } | null>(null);
  const [previewPdf, setPreviewPdf] = useState<{ bytes: Uint8Array; name: string } | null>(null);

  // Watermark Settings
  const [wmKind, setWmKind] = useState<'text' | 'image'>('text');
  const [wmText, setWmText] = useState('CONFIDENTIAL');
  const [wmSize, setWmSize] = useState(48);
  const [wmOpacity, setWmOpacity] = useState(0.25);
  const [wmAngle, setWmAngle] = useState(45);
  const [wmColor, setWmColor] = useState<TextWatermarkConfig['color']>('red');
  const [wmLayout, setWmLayout] = useState<'center' | 'tiled'>('center');
  const [wmImageLogo, setWmImageLogo] = useState<string | null>(null);

  // Page Number Settings
  const [pnFormat, setPnFormat] = useState<PageNumberConfig['format']>('Page {n} of {total}');
  const [pnPosition, setPnPosition] = useState<PageNumberConfig['position']>('bottom-center');
  const [pnSize, setPnSize] = useState(10);
  const [pnStart, setPnStart] = useState(1);
  const [pnMargin, setPnMargin] = useState(25);

  // Compression Settings
  const [compQuality, setCompQuality] = useState<CompressConfig['quality']>('balanced');

  // Protection / Encryption Settings
  const [password, setPassword] = useState('');

  // Metadata Settings
  const [metadata, setMetadata] = useState<PdfMetadata>({
    title: '',
    author: '',
    subject: '',
    keywords: [],
    creator: ''
  });

  useEffect(() => {
    if (selectedFile && activeTool === 'metadata') {
      PdfSecurityAndToolsService.getMetadata(selectedFile.bytes).then((meta) => {
        setMetadata(meta);
      });
    }
  }, [selectedFile, activeTool]);

  const handleFileDrop = async (files: FileList | File[]) => {
    const file = Array.from(files).find((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (!file) return;

    const buffer = await file.arrayBuffer();
    setSelectedFile({
      name: file.name,
      bytes: new Uint8Array(buffer),
      size: file.size
    });
    setResultPdf(null);
  };

  const handleBrowseFile = async () => {
    if (window.electronAPI) {
      const files = await window.electronAPI.openFilesDialog({
        filters: [{ name: 'PDF Documents (*.pdf)', extensions: ['pdf'] }]
      });
      if (files && files.length > 0) {
        const f = files[0];
        setSelectedFile({
          name: f.name,
          bytes: new Uint8Array(f.buffer),
          size: f.size
        });
        setResultPdf(null);
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

  const handleUploadLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setWmImageLogo(ev.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExecuteTool = async () => {
    if (!selectedFile) return;
    setIsLoading(true);
    const baseName = selectedFile.name.replace(/\.pdf$/i, '');

    try {
      let outBytes: Uint8Array;
      let outName: string;

      if (activeTool === 'watermark') {
        setProgressMsg('Applying diagonal vector watermark...');
        if (wmKind === 'text') {
          outBytes = await PdfSecurityAndToolsService.applyWatermark(selectedFile.bytes, {
            type: 'text',
            text: wmText,
            fontSize: wmSize,
            opacity: wmOpacity,
            angle: wmAngle,
            color: wmColor,
            layout: wmLayout
          });
        } else {
          if (!wmImageLogo) throw new Error('Please select a logo image first.');
          outBytes = await PdfSecurityAndToolsService.applyWatermark(selectedFile.bytes, {
            type: 'image',
            imageDataUrl: wmImageLogo,
            scale: 0.5,
            opacity: wmOpacity,
            angle: wmAngle,
            layout: 'center'
          });
        }
        outName = `${baseName}_Watermarked.pdf`;
      } else if (activeTool === 'page-numbers') {
        setProgressMsg('Stamping dynamic page indices...');
        outBytes = await PdfSecurityAndToolsService.addPageNumbers(selectedFile.bytes, {
          format: pnFormat,
          position: pnPosition,
          fontSize: pnSize,
          startNumber: pnStart,
          marginOffset: pnMargin
        });
        outName = `${baseName}_Numbered.pdf`;
      } else if (activeTool === 'compress') {
        setProgressMsg('Optimizing embedded streams and rasterizing...');
        const scaleVal = compQuality === 'maximum' ? 1.0 : compQuality === 'high-compression' ? 1.25 : 1.5;
        outBytes = await PdfSecurityAndToolsService.compressPdf(
          selectedFile.bytes,
          { quality: compQuality, scale: scaleVal },
          (curr, tot) => setProgressMsg(`Compressing page ${curr} of ${tot}...`)
        );
        outName = `${baseName}_Compressed.pdf`;
      } else if (activeTool === 'protect') {
        if (!password.trim()) throw new Error('Please enter a password.');
        setProgressMsg('Encrypting security dictionary...');
        outBytes = await PdfSecurityAndToolsService.protectPdf(selectedFile.bytes, password);
        outName = `${baseName}_Protected.pdf`;
      } else if (activeTool === 'unlock') {
        setProgressMsg('Decrypting and stripping restrictions...');
        outBytes = await PdfSecurityAndToolsService.unlockPdf(selectedFile.bytes);
        outName = `${baseName}_Unlocked.pdf`;
      } else if (activeTool === 'metadata') {
        setProgressMsg('Updating document properties...');
        outBytes = await PdfSecurityAndToolsService.updateMetadata(selectedFile.bytes, metadata);
        outName = `${baseName}_MetaUpdated.pdf`;
      } else if (activeTool === 'flatten') {
        setProgressMsg('Flattening form fields and annotations...');
        outBytes = await PdfSecurityAndToolsService.flattenPdf(selectedFile.bytes);
        outName = `${baseName}_Flattened.pdf`;
      } else if (activeTool === 'repair') {
        setProgressMsg('Reconstructing xref table and streams...');
        outBytes = await PdfSecurityAndToolsService.repairPdf(selectedFile.bytes);
        outName = `${baseName}_Repaired.pdf`;
      } else {
        throw new Error('Unknown tool selection');
      }

      setResultPdf({
        bytes: outBytes,
        name: outName,
        size: outBytes.length
      });
    } catch (err: any) {
      alert(`Operation failed: ${err.message}`);
    } finally {
      setIsLoading(false);
      setProgressMsg(null);
    }
  };

  const handleDownload = async () => {
    if (!resultPdf) return;
    if (window.electronAPI) {
      const savedPath = await window.electronAPI.saveFileDialog({
        defaultName: resultPdf.name,
        buffer: resultPdf.bytes.buffer as ArrayBuffer,
        filterName: 'PDF Documents (*.pdf)',
        extension: 'pdf'
      });
      if (savedPath) {
        await window.electronAPI.revealInFolder(savedPath);
      }
    } else {
      const blob = new Blob([resultPdf.bytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resultPdf.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return Math.round(bytes / 1024) + ' KB';
  };

  const toolsList: Array<{ id: ActiveTool; name: string; desc: string; icon: any; color: string }> = [
    {
      id: 'watermark',
      name: 'Watermark PDF',
      desc: 'Add custom text or image logo watermarks across pages',
      icon: Stamp,
      color: 'text-amber-600 bg-amber-50 border-amber-200'
    },
    {
      id: 'compress',
      name: 'Compress PDF',
      desc: 'Reduce file size while preserving high visual clarity',
      icon: Minimize2,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
    },
    {
      id: 'page-numbers',
      name: 'Page Numbers',
      desc: 'Stamp header/footer page numbers with custom formats',
      icon: FileDigit,
      color: 'text-sky-600 bg-sky-50 border-sky-200'
    },
    {
      id: 'protect',
      name: 'Protect PDF',
      desc: 'Encrypt document with user password & security markers',
      icon: Lock,
      color: 'text-purple-600 bg-purple-50 border-purple-200'
    },
    {
      id: 'unlock',
      name: 'Unlock PDF',
      desc: 'Remove security restrictions and passwords',
      icon: Unlock,
      color: 'text-slate-700 bg-slate-100 border-slate-300'
    },
    {
      id: 'metadata',
      name: 'Edit Metadata',
      desc: 'Inspect and edit Title, Author, Subject, Keywords',
      icon: FileText,
      color: 'text-blue-600 bg-blue-50 border-blue-200'
    },
    {
      id: 'flatten',
      name: 'Flatten PDF',
      desc: 'Burn interactive form fields into static uneditable pages',
      icon: Layers,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200'
    },
    {
      id: 'repair',
      name: 'Repair PDF',
      desc: 'Reconstruct broken xref tables and damaged streams',
      icon: Wrench,
      color: 'text-rose-600 bg-rose-50 border-rose-200'
    }
  ];

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] text-slate-800 select-none overflow-hidden font-sans">
      {/* HEADER SECTION */}
      <div className="bg-white border-b border-slate-200/90 px-6 py-3 shadow-2xs flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
              Security & Optimization Studio
            </h2>
            <p className="text-xs text-slate-500">
              Watermarking, dynamic pagination, compression, metadata editing, and encryption.
            </p>
          </div>
        </div>

        {selectedFile && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <FileCheck className="size-4 text-teal-600 shrink-0" />
            <span className="text-xs font-bold text-slate-800 max-w-xs truncate">{selectedFile.name}</span>
            <span className="text-[11px] text-slate-400">({formatSize(selectedFile.size)})</span>
            <button
              onClick={() => { setSelectedFile(null); setResultPdf(null); }}
              className="text-slate-400 hover:text-rose-600 ml-1"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* MAIN TWO-COLUMN WORKSPACE */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col lg:flex-row gap-6 custom-scrollbar">
        {/* LEFT COLUMN: Tool Navigator & Input Zone */}
        <div className="w-full lg:w-96 flex flex-col gap-4 shrink-0">
          {/* File Picker Card if no file loaded */}
          {!selectedFile ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFileDrop(e.dataTransfer.files);
              }}
              onClick={handleBrowseFile}
              className="p-8 border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-3xl bg-white hover:bg-teal-50/30 transition cursor-pointer text-center flex flex-col items-center justify-center group shadow-2xs"
            >
              <div className="size-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3 group-hover:scale-105 transition border border-teal-100">
                <UploadCloud className="size-7" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Select PDF Document</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Drag and drop your PDF here or click to browse.
              </p>
              <button className="mt-4 px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow-xs transition">
                Browse PDF
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Active Document</span>
                <span className="text-xs font-bold text-slate-900 block truncate max-w-[200px]">{selectedFile.name}</span>
                <span className="text-[11px] text-teal-600 font-semibold">{formatSize(selectedFile.size)}</span>
              </div>
              <button
                onClick={handleBrowseFile}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Change
              </button>
            </div>
          )}

          {/* Tools Grid */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Select Tool
            </span>
            <div className="space-y-1.5">
              {toolsList.map((t) => {
                const Icon = t.icon;
                const isActive = activeTool === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setActiveTool(t.id);
                      setResultPdf(null);
                    }}
                    className={`w-full p-2.5 rounded-xl text-left transition flex items-center gap-3 border ${
                      isActive
                        ? 'bg-teal-50/80 border-teal-300 ring-2 ring-teal-200'
                        : 'bg-white border-slate-200/70 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 border ${t.color}`}>
                      <Icon className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                        <span>{t.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{t.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Tool Configuration & Execution Panel */}
        <div className="flex-1 flex flex-col gap-5">
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-2xs flex-1 flex flex-col justify-between">
            <div className="space-y-5">
              {/* TOOL TITLE */}
              <div className="pb-4 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">
                  {toolsList.find((t) => t.id === activeTool)?.name}
                </h3>
                <p className="text-xs text-slate-500">
                  {toolsList.find((t) => t.id === activeTool)?.desc}
                </p>
              </div>

              {/* TOOL 1: WATERMARK */}
              {activeTool === 'watermark' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setWmKind('text')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                        wmKind === 'text' ? 'bg-amber-500 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      Text Watermark
                    </button>
                    <button
                      onClick={() => setWmKind('image')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                        wmKind === 'image' ? 'bg-amber-500 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      Image / Logo Watermark
                    </button>
                  </div>

                  {wmKind === 'text' ? (
                    <>
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Watermark Text</label>
                        <input
                          type="text"
                          value={wmText}
                          onChange={(e) => setWmText(e.target.value)}
                          placeholder="e.g. CONFIDENTIAL, DRAFT, VERIFIED"
                          className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Color</label>
                          <select
                            value={wmColor}
                            onChange={(e) => setWmColor(e.target.value as any)}
                            className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                          >
                            <option value="red">Red</option>
                            <option value="blue">Blue</option>
                            <option value="amber">Amber</option>
                            <option value="green">Green</option>
                            <option value="gray">Gray</option>
                            <option value="black">Black</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Font Size: {wmSize}pt</label>
                          <input
                            type="range"
                            min={18}
                            max={90}
                            value={wmSize}
                            onChange={(e) => setWmSize(Number(e.target.value))}
                            className="w-full"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Opacity: {Math.round(wmOpacity * 100)}%</label>
                          <input
                            type="range"
                            min={0.05}
                            max={1.0}
                            step={0.05}
                            value={wmOpacity}
                            onChange={(e) => setWmOpacity(Number(e.target.value))}
                            className="w-full"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Rotation: {wmAngle}°</label>
                          <input
                            type="range"
                            min={0}
                            max={360}
                            step={15}
                            value={wmAngle}
                            onChange={(e) => setWmAngle(Number(e.target.value))}
                            className="w-full"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700">Layout:</span>
                        <button
                          onClick={() => setWmLayout('center')}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg border ${
                            wmLayout === 'center' ? 'bg-amber-50 border-amber-300 text-amber-800 font-bold' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          Diagonal Center
                        </button>
                        <button
                          onClick={() => setWmLayout('tiled')}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg border ${
                            wmLayout === 'tiled' ? 'bg-amber-50 border-amber-300 text-amber-800 font-bold' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          Tiled Repeat Grid
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-4 border-2 border-dashed border-slate-200 rounded-2xl text-center bg-slate-50">
                        {wmImageLogo ? (
                          <div className="flex items-center justify-center gap-3">
                            <img src={wmImageLogo} alt="Logo preview" className="h-16 object-contain" />
                            <button
                              onClick={() => setWmImageLogo(null)}
                              className="text-xs text-rose-600 font-bold"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <label className="cursor-pointer block">
                            <UploadCloud className="size-6 text-amber-500 mx-auto mb-1" />
                            <span className="text-xs font-bold text-slate-700 block">Choose Logo Image (PNG / JPG)</span>
                            <input
                              type="file"
                              accept="image/png, image/jpeg"
                              onChange={handleUploadLogo}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TOOL 2: COMPRESS PDF */}
              {activeTool === 'compress' && (
                <div className="space-y-4">
                  <span className="text-xs font-bold text-slate-700 block">Select Target Compression Level:</span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      {
                        id: 'balanced' as const,
                        label: 'Balanced (Recommended)',
                        desc: 'Medium size reduction, high visual clarity (150 DPI)',
                        badge: '~50% Reduction'
                      },
                      {
                        id: 'high-compression' as const,
                        label: 'Extreme Compression',
                        desc: 'Maximum file size reduction (100 DPI)',
                        badge: '~70% Reduction'
                      },
                      {
                        id: 'maximum' as const,
                        label: 'Light Compression',
                        desc: 'Crisp text and original graphics, light pass',
                        badge: '~25% Reduction'
                      }
                    ].map((c) => (
                      <div
                        key={c.id}
                        onClick={() => setCompQuality(c.id)}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition ${
                          compQuality === c.id
                            ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-200'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 block w-fit mb-2">
                          {c.badge}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900">{c.label}</h4>
                        <p className="text-[11px] text-slate-500 mt-1">{c.desc}</p>
                      </div>
                    ))}
                  </div>

                  {selectedFile && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium">Original File Size:</span>
                      <span className="font-mono font-bold text-slate-800">{formatSize(selectedFile.size)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* TOOL 3: PAGE NUMBERS */}
              {activeTool === 'page-numbers' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Numbering Format</label>
                      <select
                        value={pnFormat}
                        onChange={(e) => setPnFormat(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                      >
                        <option value="Page {n} of {total}">Page 1 of 10</option>
                        <option value="{n} / {total}">1 / 10</option>
                        <option value="{n}">1</option>
                        <option value="Page {n}">Page 1</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Position on Page</label>
                      <select
                        value={pnPosition}
                        onChange={(e) => setPnPosition(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                      >
                        <option value="bottom-center">Bottom Center (Standard)</option>
                        <option value="bottom-right">Bottom Right</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="top-center">Top Center</option>
                        <option value="top-right">Top Right</option>
                        <option value="top-left">Top Left</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Font Size: {pnSize}pt</label>
                      <input
                        type="range"
                        min={8}
                        max={20}
                        value={pnSize}
                        onChange={(e) => setPnSize(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Start Page Number</label>
                      <input
                        type="number"
                        min={1}
                        value={pnStart}
                        onChange={(e) => setPnStart(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TOOL 4: PROTECT PDF */}
              {activeTool === 'protect' && (
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Set Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter strong password..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Applies 128-bit security flags and password protection markers directly to the PDF stream.
                    </p>
                  </div>
                </div>
              )}

              {/* TOOL 5: UNLOCK PDF */}
              {activeTool === 'unlock' && (
                <div className="space-y-3 max-w-md">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Strips user password restrictions, printing limits, and permission constraints to generate a clean, unlocked PDF.
                  </p>
                </div>
              )}

              {/* TOOL 6: EDIT METADATA */}
              {activeTool === 'metadata' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Document Title</label>
                      <input
                        type="text"
                        value={metadata.title || ''}
                        onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                        placeholder="e.g. Annual Financial Report"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Author</label>
                      <input
                        type="text"
                        value={metadata.author || ''}
                        onChange={(e) => setMetadata({ ...metadata, author: e.target.value })}
                        placeholder="e.g. Burhanuddin Sounasath"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Subject</label>
                      <input
                        type="text"
                        value={metadata.subject || ''}
                        onChange={(e) => setMetadata({ ...metadata, subject: e.target.value })}
                        placeholder="e.g. Legal Specification"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Keywords (comma separated)</label>
                      <input
                        type="text"
                        value={metadata.keywords?.join(', ') || ''}
                        onChange={(e) =>
                          setMetadata({
                            ...metadata,
                            keywords: e.target.value.split(',').map((s) => s.trim())
                          })
                        }
                        placeholder="e.g. contract, 2026, certified"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TOOL 7: FLATTEN PDF */}
              {activeTool === 'flatten' && (
                <div className="space-y-3 max-w-lg">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Turns all fillable form fields, checkboxes, text boxes, and interactive digital signatures into permanent static page graphics. Form contents can never be altered or tampered with.
                  </p>
                </div>
              )}

              {/* TOOL 8: REPAIR PDF */}
              {activeTool === 'repair' && (
                <div className="space-y-3 max-w-lg">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Re-indexes corrupted cross-reference tables, fixes damaged page trees, and strips invalid stream offsets to restore unreadable PDFs.
                  </p>
                </div>
              )}
            </div>

            {/* ACTION FOOTER */}
            <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                {progressMsg && (
                  <span className="text-xs font-semibold text-teal-700 flex items-center gap-2">
                    <RefreshCw className="size-3.5 animate-spin text-teal-600" />
                    <span>{progressMsg}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExecuteTool}
                  disabled={!selectedFile || isLoading}
                  className="px-6 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-teal-600/20 transition flex items-center gap-2"
                >
                  <Sparkles className="size-4" />
                  <span>Execute {toolsList.find((t) => t.id === activeTool)?.name}</span>
                </button>
              </div>
            </div>
          </div>

          {/* RESULT STATUS CARD */}
          {resultPdf && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <CheckCircle className="size-6 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-900">Operation Succeeded!</h4>
                  <span className="text-[11px] text-emerald-700">
                    {resultPdf.name} ({formatSize(resultPdf.size)})
                    {activeTool === 'compress' && selectedFile && (
                      <strong className="ml-1 font-bold">
                        ({Math.round(((selectedFile.size - resultPdf.size) / selectedFile.size) * 100)}% smaller)
                      </strong>
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewPdf({ bytes: resultPdf.bytes, name: resultPdf.name })}
                  className="px-3 py-1.5 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
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
      </div>

      {/* PREVIEW MODAL */}
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
