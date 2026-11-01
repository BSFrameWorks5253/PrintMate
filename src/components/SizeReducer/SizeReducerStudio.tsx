import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FileText,
  Upload,
  Download,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Crop,
  ShieldCheck,
  Maximize2,
  Layers,
  ArrowRight,
  Eye,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import {
  PORTAL_PRESETS,
  SizeReducerEngine,
  type PortalPreset,
  type CompressionResult
} from '../../services/sizeReducerEngine';

export const SizeReducerStudio: React.FC = () => {
  const [selectedPreset, setSelectedPreset] = useState<PortalPreset>(PORTAL_PRESETS[0]);
  const [targetKb, setTargetKb] = useState<number>(PORTAL_PRESETS[0].targetKb);
  const [maxKb, setMaxKb] = useState<number>(PORTAL_PRESETS[0].maxKb);
  const [minKb, setMinKb] = useState<number>(PORTAL_PRESETS[0].minKb);

  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [sourceCanvas, setSourceCanvas] = useState<HTMLCanvasElement | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalSizeKb, setOriginalSizeKb] = useState<number>(0);
  const [fileName, setFileName] = useState<string>('');

  // Signature Enhancer Settings
  const [isSignatureMode, setIsSignatureMode] = useState<boolean>(false);
  const [enableEnhance, setEnableEnhance] = useState<boolean>(false);
  const [whitenessThreshold, setWhitenessThreshold] = useState<number>(185);
  const [contrastBoost, setContrastBoost] = useState<number>(1.35);

  // Compression Output
  const [compressedResult, setCompressedResult] = useState<CompressionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [outputFormat, setOutputFormat] = useState<'image/jpeg' | 'image/png'>('image/jpeg');

  // Handle Preset Selection
  const handleSelectPreset = (preset: PortalPreset) => {
    setSelectedPreset(preset);
    setTargetKb(preset.targetKb);
    setMaxKb(preset.maxKb);
    setMinKb(preset.minKb);
    setIsSignatureMode(preset.type === 'signature');
    if (preset.type === 'signature') {
      setEnableEnhance(true);
    }
  };

  // Handle File Upload
  const handleFileUpload = async (file: File) => {
    setOriginalFile(file);
    setFileName(file.name);
    setOriginalSizeKb(Number((file.size / 1024).toFixed(1)));
    setIsProcessing(true);

    try {
      const img = await SizeReducerEngine.loadImageFromFile(file);
      setSourceImage(img);
      const canvas = SizeReducerEngine.imageToCanvas(img);
      setSourceCanvas(canvas);
    } catch (err) {
      console.error('Error loading image:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Run Compression & Enhancement
  const runCompression = useCallback(async () => {
    if (!sourceCanvas) return;
    setIsProcessing(true);

    try {
      let workingCanvas = sourceCanvas;

      // Apply signature contrast booster if active
      if (isSignatureMode && enableEnhance) {
        workingCanvas = SizeReducerEngine.enhanceSignature(workingCanvas, contrastBoost, whitenessThreshold);
      }

      // Resize if preset recommends specific dimensions
      if (selectedPreset.recommendedWidth && selectedPreset.recommendedHeight) {
        workingCanvas = SizeReducerEngine.resizeCanvas(
          workingCanvas,
          selectedPreset.recommendedWidth,
          selectedPreset.recommendedHeight,
          selectedPreset.enforceDimensions ?? false
        );
      }

      // Execute Binary Search Compression
      const result = await SizeReducerEngine.compressToTargetKb(
        workingCanvas,
        targetKb,
        maxKb,
        minKb,
        outputFormat
      );

      setCompressedResult(result);
    } catch (err) {
      console.error('Compression error:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [sourceCanvas, isSignatureMode, enableEnhance, contrastBoost, whitenessThreshold, selectedPreset, targetKb, maxKb, minKb, outputFormat]);

  // Re-run compression whenever controls or image change
  useEffect(() => {
    if (sourceCanvas) {
      runCompression();
    }
  }, [sourceCanvas, runCompression]);

  // Download Compressed Output
  const handleDownload = () => {
    if (!compressedResult) return;
    const a = document.createElement('a');
    a.href = compressedResult.dataUrl;
    const ext = outputFormat === 'image/jpeg' ? 'jpg' : 'png';
    const baseName = fileName.replace(/\.[^/.]+$/, '') || 'portal_upload';
    a.download = `${baseName}_${selectedPreset.id}_${compressedResult.sizeKb}kb.${ext}`;
    a.click();
  };

  const isWithinLimits = compressedResult && compressedResult.sizeKb <= maxKb && (minKb === 0 || compressedResult.sizeKb >= minKb);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Studio Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white">
                  Government Form Size Reducer
                </h1>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 uppercase tracking-wider">
                  UPSC • SSC • NTA • PAN Ready
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Guaranteed size clamping & 1-click signature background cleanup for exam portals
              </p>
            </div>
          </div>
        </div>

        {compressedResult && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
              className="px-5 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-blue-500/25 flex items-center gap-2 transition-all hover:bg-blue-500 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download ({compressedResult.sizeKb} KB)</span>
            </button>
          </div>
        )}
      </div>

      {/* Preset Selector */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
          Select Exam / Portal Preset:
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {PORTAL_PRESETS.map((preset) => {
            const isSelected = selectedPreset.id === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`p-3 rounded-2xl text-left border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/80 dark:bg-blue-950/50 border-blue-500 ring-2 ring-blue-500/20 text-blue-900 dark:text-blue-100 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <div className="font-extrabold text-xs truncate">{preset.name}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                  Limit: {preset.minKb ? `${preset.minKb}-${preset.maxKb} KB` : `Max ${preset.maxKb} KB`}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Workspace */}
      {!sourceCanvas ? (
        /* Empty Upload Dropzone */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-12 text-center shadow-xs">
          <input
            type="file"
            id="size-reducer-upload"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />
          <label
            htmlFor="size-reducer-upload"
            className="flex flex-col items-center justify-center cursor-pointer group"
          >
            <div className="w-20 h-20 rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform shadow-xs">
              <Upload className="w-10 h-10" />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mb-2">
              Upload Photo, Signature or Document
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
              Drag and drop any oversized photo or mobile signature snap. The intelligent binary search engine will reduce it to your exact target KB without quality loss.
            </p>
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20">
              <FileText className="w-4 h-4" />
              <span>Select Image from Computer</span>
            </div>
          </label>
        </div>
      ) : (
        /* Compression Workspace */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Controls Column (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Target Settings Card */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  <span>Compression Limits</span>
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {selectedPreset.name}
                </span>
              </div>

              {/* Target KB Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Target File Size:</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{targetKb} KB</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="1000"
                  step="5"
                  value={targetKb}
                  onChange={(e) => setTargetKb(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>Min: {minKb} KB</span>
                  <span>Max: {maxKb} KB</span>
                </div>
              </div>

              {/* Format selection */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Output Format:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOutputFormat('image/jpeg')}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      outputFormat === 'image/jpeg'
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    JPEG / JPG (Standard)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutputFormat('image/png')}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      outputFormat === 'image/png'
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    PNG (Lossless)
                  </button>
                </div>
              </div>

              {/* Re-compress trigger */}
              <button
                type="button"
                onClick={runCompression}
                disabled={isProcessing}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                <span>Re-calculate Exact KB</span>
              </button>
            </div>

            {/* Signature Contrast Booster Card */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Signature Contrast Enhancer
                  </h3>
                </div>
                <input
                  type="checkbox"
                  checked={enableEnhance}
                  onChange={(e) => setEnableEnhance(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                />
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Whitens dirty, shadowed mobile phone backgrounds and darkens ink strokes to pure black for 100% portal acceptance.
              </p>

              {enableEnhance && (
                <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400">Background Whitener:</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">{whitenessThreshold}</span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="240"
                      value={whitenessThreshold}
                      onChange={(e) => setWhitenessThreshold(Number(e.target.value))}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400">Ink Darkness Multiplier:</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">{contrastBoost}x</span>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="2.5"
                      step="0.05"
                      value={contrastBoost}
                      onChange={(e) => setContrastBoost(Number(e.target.value))}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Change File Link */}
            <div className="text-center pt-2">
              <label
                htmlFor="size-reupload"
                className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
              >
                Upload different photo/document
              </label>
              <input
                type="file"
                id="size-reupload"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
            </div>

          </div>

          {/* Before & After Comparison Preview Column (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              
              {/* Status Meter Banner */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                isWithinLimits
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100'
              }`}>
                <div className="flex items-center gap-3">
                  {isWithinLimits ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  )}
                  <div>
                    <div className="text-xs font-bold">
                      {isWithinLimits ? 'Portal Acceptance Ready' : 'Size Clamping Active'}
                    </div>
                    <div className="text-[11px] opacity-80">
                      Reduced from <strong>{originalSizeKb} KB</strong> to <strong className="font-mono text-sm underline">{compressedResult?.sizeKb} KB</strong> ({compressedResult?.reductionPercentage}% smaller)
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold">Target Limit</div>
                  <div className="text-[11px] font-mono opacity-80">Max: {maxKb} KB</div>
                </div>
              </div>

              {/* Live Preview Display */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>Processed Output Preview</span>
                  {compressedResult && (
                    <span className="font-mono text-[11px] text-slate-500">
                      {compressedResult.width} × {compressedResult.height} px • Quality {compressedResult.qualityUsed}%
                    </span>
                  )}
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-slate-950 flex items-center justify-center min-h-[360px] overflow-hidden">
                  {compressedResult ? (
                    <img
                      src={compressedResult.dataUrl}
                      alt="Compressed Preview"
                      className="max-h-[380px] max-w-full object-contain rounded-lg shadow-lg bg-white"
                    />
                  ) : (
                    <div className="text-xs text-slate-400">Processing compression...</div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={!compressedResult}
                  style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                  className="w-full py-3 rounded-2xl font-bold text-sm shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 hover:bg-blue-500 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Optimized File ({compressedResult?.sizeKb} KB)</span>
                </button>
              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
};
