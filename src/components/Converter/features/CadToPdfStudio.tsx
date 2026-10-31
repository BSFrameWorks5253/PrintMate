import React, { useState } from 'react';
import { Compass, Download, Sparkles, CheckCircle2, UploadCloud, Loader2 } from 'lucide-react';
import { CadConverter } from '../../../services/converter/cadConverter';
import { CadStudioConfig } from '../../../types/converter';

export const CadToPdfStudio: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [config, setConfig] = useState<CadStudioConfig>({
    theme: 'blueprint',
    paperSize: 'a4',
    orientation: 'landscape',
    scaleToFit: true
  });
  const [isConverting, setIsConverting] = useState(false);
  const [convertedPdf, setConvertedPdf] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleSelectFile = async () => {
    if (window.electronAPI) {
      const files = await window.electronAPI.openFilesDialog({
        filters: [{ name: 'AutoCAD Drawings (*.dwg, *.dxf)', extensions: ['dwg', 'dxf'] }]
      });

      if (files && files.length > 0) {
        const f = files[0];
        setSelectedFile({
          name: f.name,
          bytes: new Uint8Array(f.buffer)
        });
        setConvertedPdf(null);
      }
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.dwg,.dxf';
      input.onchange = (e) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
          const file = target.files[0];
          const reader = new FileReader();
          reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
              setSelectedFile({
                name: file.name,
                bytes: new Uint8Array(reader.result)
              });
              setConvertedPdf(null);
            }
          };
          reader.readAsArrayBuffer(file);
        }
      };
      input.click();
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = Array.from(e.dataTransfer.files).find((f) => {
        const ext = f.name.split('.').pop()?.toLowerCase();
        return ext === 'dwg' || ext === 'dxf';
      });

      if (file) {
        const buffer = await file.arrayBuffer();
        setSelectedFile({
          name: file.name,
          bytes: new Uint8Array(buffer)
        });
        setConvertedPdf(null);
      } else {
        alert('Please drop an AutoCAD DWG or DXF drawing file.');
      }
    }
  };

  const handleConvert = async () => {
    if (!selectedFile) return;
    setIsConverting(true);

    try {
      const pdfBytes = await CadConverter.cadToPdf(selectedFile.bytes, selectedFile.name, config);
      const outName = `${selectedFile.name.replace(/\.(dwg|dxf)$/i, '')}_Blueprint_${config.paperSize.toUpperCase()}.pdf`;
      setConvertedPdf({ name: outName, bytes: pdfBytes });
    } catch (err: any) {
      alert(`CAD Conversion failed: ${err.message}`);
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = async () => {
    if (!convertedPdf) return;

    if (window.electronAPI) {
      const savedPath = await window.electronAPI.saveFileDialog({
        defaultName: convertedPdf.name,
        buffer: convertedPdf.bytes.buffer as ArrayBuffer,
        filterName: 'PDF Document (*.pdf)',
        extension: 'pdf'
      });
      if (savedPath) await window.electronAPI.revealInFolder(savedPath);
    } else {
      const blob = new Blob([convertedPdf.bytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = convertedPdf.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] text-slate-800 select-none overflow-y-auto custom-scrollbar font-sans p-6 md:p-8">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold mb-1 border border-amber-100">
            <Sparkles className="size-3.5" />
            <span>AutoCAD DWG &amp; DXF Vector Drawing Engine</span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            CAD to Architectural Blueprint Converter
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Convert AutoCAD DWG and DXF drawings into crisp, printable vector blueprint PDFs at customizable scales.
          </p>
        </div>

        {/* File Dropzone */}
        <div
          onClick={handleSelectFile}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed transition rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer shadow-2xs group ${
            isDragging
              ? 'border-amber-500 bg-amber-50/50'
              : 'border-slate-300 hover:border-amber-500 bg-white hover:bg-amber-50/20'
          }`}
        >
          <div className="size-14 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 mb-3 group-hover:scale-105 transition border border-amber-100">
            {isDragging ? <UploadCloud className="size-7 animate-bounce" /> : <Compass className="size-7" />}
          </div>
          {selectedFile ? (
            <div>
              <span className="text-sm font-bold text-slate-900 block">{selectedFile.name}</span>
              <span className="text-xs text-emerald-600 font-semibold mt-1 block">
                CAD Drawing ready for blueprint rendering
              </span>
            </div>
          ) : (
            <div>
              <span className="text-sm font-bold text-slate-900 block">Click or Drop AutoCAD DWG / DXF Drawing</span>
              <span className="text-xs text-slate-400 mt-1 block">
                Supports AutoCAD DWG (Release 14 through 2026) &amp; ASCII DXF
              </span>
            </div>
          )}
        </div>

        {/* Blueprint Style Configuration */}
        {selectedFile && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-4 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Blueprint Output Settings
            </h3>

            {/* Themes */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-2">Visual Theme:</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    id: 'blueprint',
                    label: 'Architectural Blueprint',
                    desc: 'White/cyan vectors on dark navy',
                    color: 'bg-blue-950 border-blue-500/40 text-blue-200'
                  },
                  {
                    id: 'monochrome',
                    label: 'Technical Monochrome',
                    desc: 'High-contrast black lines on white',
                    color: 'bg-slate-50 text-slate-900 border-slate-300'
                  },
                  {
                    id: 'layers',
                    label: 'AutoCAD Layer Colors',
                    desc: 'Preserves CAD layer colors',
                    color: 'bg-slate-900 text-sky-300 border-sky-500/40'
                  }
                ].map((th) => (
                  <button
                    key={th.id}
                    onClick={() => setConfig((c) => ({ ...c, theme: th.id as any }))}
                    className={`p-3.5 rounded-xl border text-left transition ${
                      config.theme === th.id
                        ? 'ring-2 ring-amber-500 border-amber-500 shadow-md font-bold'
                        : 'opacity-80 hover:opacity-100'
                    } ${th.color}`}
                  >
                    <span className="text-xs font-bold block">{th.label}</span>
                    <span className="text-[10px] opacity-80 block mt-1">{th.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Paper Size & Orientation */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Standard Paper Format:</label>
                <div className="flex items-center gap-1.5">
                  {(['a4', 'a3', 'a2', 'a1'] as const).map((sz) => (
                    <button
                      key={sz}
                      onClick={() => setConfig((c) => ({ ...c, paperSize: sz }))}
                      className={`px-3 py-1.5 text-xs font-mono uppercase font-bold rounded-lg transition ${
                        config.paperSize === sz
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Sheet Orientation:</label>
                <div className="flex items-center gap-1.5">
                  {(['landscape', 'portrait'] as const).map((ori) => (
                    <button
                      key={ori}
                      onClick={() => setConfig((c) => ({ ...c, orientation: ori }))}
                      className={`px-3.5 py-1.5 text-xs font-bold capitalize rounded-lg transition ${
                        config.orientation === ori
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {ori}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={handleConvert}
                disabled={isConverting}
                className="px-6 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2"
              >
                {isConverting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Rendering Vector PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="size-4" />
                    <span>Render Vector PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Converted Output Banner */}
        {convertedPdf && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-6 text-emerald-600 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-emerald-900">Blueprint Successfully Rendered</h4>
                <p className="text-[11px] text-emerald-700">{convertedPdf.name}</p>
              </div>
            </div>

            <button
              onClick={handleDownload}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              <Download className="size-4" />
              <span>Download PDF</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
