import React, { useState, useEffect, useRef } from 'react';
import {
  RotateCcw,
  RotateCw,
  Crop,
  Sparkles,
  Contrast,
  Sun,
  Eye,
  Sliders,
  Check,
  X,
  Trash2,
  Plus,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Palette,
  Layers,
  FileText,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Undo,
  Redo,
  FlipHorizontal,
  FlipVertical,
  ScanLine,
} from 'lucide-react';
import { useJobStore } from '../../stores/jobStore';
import { TabId } from '../../components/layout/Header';
import { renderPdfPages } from '../../utils/pdf-engine';
import {
  loadImage,
  renderProcessedCanvas,
  detectDocumentSkew,
  detectDocumentCorners,
  detectDocumentBounds,
  detectDocumentType,
  autoDetectTone,
  createDefaultEdits,
  calculateAspectCrop,
} from '../../utils/image-processing';
import { BackgroundMode } from '../../types';

interface ImageEditorPageProps {
  onNavigate: (tab: TabId) => void;
}

export const ImageEditorPage: React.FC<ImageEditorPageProps> = ({ onNavigate }) => {
  const {
    assets,
    activeAssetId,
    setActiveAsset,
    edits,
    updateAssetEdits,
    resetAssetEdits,
    undoAssetEdits,
    redoAssetEdits,
    canUndoAsset,
    canRedoAsset,
    removeAsset,
    reorderAssets,
    addAssets,
  } = useJobStore();

  const [zoom, setZoom] = useState<number>(1);
  const [showOriginal, setShowOriginal] = useState<boolean>(false);
  const [isCropping, setIsCropping] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [cropBox, setCropBox] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 0.1,
    y: 0.1,
    w: 0.8,
    h: 0.8,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeAsset = assets.find((a) => a.id === activeAssetId) || assets[0];
  const activeEdits = activeAsset ? edits[activeAsset.id] || createDefaultEdits(activeAsset.id) : null;

  // Keyboard shortcuts: Ctrl+Z (Undo), Ctrl+Y / Ctrl+Shift+Z (Redo), Escape (Cancel crop)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeAsset) return;
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (canUndoAsset(activeAsset.id)) {
          undoAssetEdits(activeAsset.id);
        }
      } else if (
        (isCtrlOrCmd && e.key.toLowerCase() === 'y') ||
        (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        if (canRedoAsset(activeAsset.id)) {
          redoAssetEdits(activeAsset.id);
        }
      } else if (e.key === 'Escape') {
        if (isCropping) {
          setIsCropping(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeAsset, isCropping, canUndoAsset, canRedoAsset, undoAssetEdits, redoAssetEdits]);

  // Render current active asset onto the preview canvas
  useEffect(() => {
    if (!activeAsset || !activeEdits) return;

    let isMounted = true;
    const render = async () => {
      try {
        const src = activeAsset.preview_url || activeAsset.original_path;
        if (!src) return;

        const img = await loadImage(src);
        if (!isMounted) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const editsToApply = showOriginal
          ? createDefaultEdits(activeAsset.id)
          : activeEdits;

        const rendered = await renderProcessedCanvas(img, editsToApply);
        if (!isMounted) return;

        canvas.width = rendered.width;
        canvas.height = rendered.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(rendered, 0, 0);
        }
      } catch (err) {
        console.error('Error rendering image preview:', err);
      }
    };

    render();
    return () => {
      isMounted = false;
    };
  }, [activeAssetId, activeEdits, showOriginal]);

  if (!activeAsset || !activeEdits) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
        }}
      >
        <FileText size={48} color="var(--text-muted)" />
        <h3 style={{ fontSize: '18px', fontWeight: 600 }}>No images imported yet</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Import document scans, photographs, or PDF files to begin editing.
        </p>
        <button className="btn btn-primary" onClick={() => onNavigate('home')}>
          Return to Dashboard
        </button>
      </div>
    );
  }

  // Auto-detect and correct deskew
  const handleAutoDeskew = () => {
    if (!canvasRef.current) return;
    setIsProcessing(true);
    setTimeout(() => {
      try {
        const angle = detectDocumentSkew(canvasRef.current!);
        updateAssetEdits(activeAsset.id, {
          straighten_degrees: Math.round(angle * 10) / 10,
        });
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  };

  // Auto Tone (Exposure & Contrast Balancing)
  const handleAutoTone = () => {
    if (!canvasRef.current) return;
    setIsProcessing(true);
    setTimeout(() => {
      try {
        const tone = autoDetectTone(canvasRef.current!);
        updateAssetEdits(activeAsset.id, {
          brightness: tone.brightness,
          contrast: tone.contrast,
        });
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  };

  // Helper to check if current asset is locked to A4 page dimensions
  const isA4Locked = (): boolean => {
    if (!activeEdits.processing_options_json) return false;
    try {
      const opts = JSON.parse(activeEdits.processing_options_json);
      return !!opts.lockToA4;
    } catch {
      return false;
    }
  };

  const handleToggleLockToA4 = () => {
    const currentLocked = isA4Locked();
    let opts: any = {};
    if (activeEdits.processing_options_json) {
      try { opts = JSON.parse(activeEdits.processing_options_json); } catch {}
    }
    updateAssetEdits(activeAsset.id, {
      processing_options_json: JSON.stringify({ ...opts, lockToA4: !currentLocked }),
    });
  };

  // Auto Align & Crop (Detects page boundaries and deskew angle, applies clean frame)
  const handleAutoAlignAndCrop = () => {
    if (!canvasRef.current || !activeAsset) return;
    setIsProcessing(true);
    setTimeout(() => {
      try {
        const bounds = detectDocumentBounds(canvasRef.current!);
        const angle = bounds.deskewDegrees !== undefined && Math.abs(bounds.deskewDegrees) > 0.3
          ? bounds.deskewDegrees
          : detectDocumentSkew(canvasRef.current!);

        const updates: any = {
          straighten_degrees: Math.round(angle * 10) / 10,
        };

        if (bounds.confidence > 0.6 && bounds.normalizedBox.w < 0.98) {
          updates.crop_x = bounds.normalizedBox.x;
          updates.crop_y = bounds.normalizedBox.y;
          updates.crop_width = bounds.normalizedBox.w;
          updates.crop_height = bounds.normalizedBox.h;
        }

        updateAssetEdits(activeAsset.id, updates);
        setIsCropping(false);
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  };

  // Full Auto Correct (Alignment + Auto Tone + Text Darkener + Sharpening)
  const handleAutoCorrect = () => {
    if (!canvasRef.current || !activeAsset) return;
    setIsProcessing(true);
    setTimeout(() => {
      try {
        const bounds = detectDocumentBounds(canvasRef.current!);
        const angle = bounds.deskewDegrees !== undefined && Math.abs(bounds.deskewDegrees) > 0.3
          ? bounds.deskewDegrees
          : detectDocumentSkew(canvasRef.current!);
        const tone = autoDetectTone(canvasRef.current!);

        const updates: any = {
          straighten_degrees: Math.round(angle * 10) / 10,
          brightness: tone.brightness,
          contrast: tone.contrast,
          text_darkening: 1.2,
          sharpness: 1.5,
        };

        if (bounds.confidence > 0.6 && bounds.normalizedBox.w < 0.98) {
          updates.crop_x = bounds.normalizedBox.x;
          updates.crop_y = bounds.normalizedBox.y;
          updates.crop_width = bounds.normalizedBox.w;
          updates.crop_height = bounds.normalizedBox.h;
        }

        updateAssetEdits(activeAsset.id, updates);
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  };

  // Batch Auto Align All Imported Pages
  const handleBatchAutoAlignAll = async () => {
    if (assets.length === 0) return;
    setIsProcessing(true);
    try {
      for (const asset of assets) {
        const src = asset.preview_url || asset.original_path;
        if (!src) continue;
        try {
          const img = await loadImage(src);
          const currentEdits = edits[asset.id] || createDefaultEdits(asset.id);
          const tempCanvas = await renderProcessedCanvas(img, currentEdits);
          const bounds = detectDocumentBounds(tempCanvas);
          const angle = bounds.deskewDegrees !== undefined && Math.abs(bounds.deskewDegrees) > 0.3
            ? bounds.deskewDegrees
            : detectDocumentSkew(tempCanvas);
          const tone = autoDetectTone(tempCanvas);

          const updates: any = {
            straighten_degrees: Math.round(angle * 10) / 10,
            brightness: tone.brightness,
            contrast: tone.contrast,
          };

          if (bounds.confidence > 0.6 && bounds.normalizedBox.w < 0.98) {
            updates.crop_x = bounds.normalizedBox.x;
            updates.crop_y = bounds.normalizedBox.y;
            updates.crop_width = bounds.normalizedBox.w;
            updates.crop_height = bounds.normalizedBox.h;
          }

          updateAssetEdits(asset.id, updates);
        } catch (e) {
          console.warn('Auto align failed for asset:', asset.id, e);
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRotate = (delta: number) => {
    const current = activeEdits.rotation_degrees || 0;
    const next = (current + delta + 360) % 360;
    updateAssetEdits(activeAsset.id, { rotation_degrees: next });
  };

  const handleApplyCrop = () => {
    updateAssetEdits(activeAsset.id, {
      crop_x: cropBox.x,
      crop_y: cropBox.y,
      crop_width: cropBox.w,
      crop_height: cropBox.h,
    });
    setIsCropping(false);
  };

  const handleResetCrop = () => {
    updateAssetEdits(activeAsset.id, {
      crop_x: null,
      crop_y: null,
      crop_width: null,
      crop_height: null,
    });
    setIsCropping(false);
  };

  const handleSetAspectCrop = (aspect: number) => {
    setCropBox(calculateAspectCrop(aspect));
  };

  const handleToggleFlipHorizontal = () => {
    updateAssetEdits(activeAsset.id, {
      flip_horizontal: !activeEdits.flip_horizontal,
    });
  };

  const handleToggleFlipVertical = () => {
    updateAssetEdits(activeAsset.id, {
      flip_vertical: !activeEdits.flip_vertical,
    });
  };

  const handleAutoBoundary = () => {
    if (!canvasRef.current || !activeAsset) return;
    setIsProcessing(true);
    setTimeout(() => {
      try {
        const bounds = detectDocumentBounds(canvasRef.current!);
        setCropBox(bounds.normalizedBox);
        setIsCropping(true);
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  };

  const handleAutoPerspectiveCorrection = () => {
    if (!canvasRef.current || !activeAsset) return;
    setIsProcessing(true);
    setTimeout(() => {
      try {
        const corners = detectDocumentCorners(canvasRef.current!);
        updateAssetEdits(activeAsset.id, {
          perspective_data_json: JSON.stringify(corners),
        });
      } finally {
        setIsProcessing(false);
      }
    }, 50);
  };

  const addFileInputRef = useRef<HTMLInputElement | null>(null);

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleProcessAddFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    const fileArr = Array.from(files);
    const newAssets: any[] = [];
    const invalidFiles: File[] = [];

    for (let i = 0; i < fileArr.length; i++) {
      const f = fileArr[i];
      const isImg = f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp|tiff)$/i.test(f.name);
      const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');

      if (!isImg && !isPdf) {
        invalidFiles.push(f);
        continue;
      }

      let dataUrl = '';
      if (window.electronAPI && (f as any).path) {
        try {
          dataUrl = await window.electronAPI.readFileAsDataUrl((f as any).path);
        } catch {
          dataUrl = await readFileAsDataUrl(f);
        }
      } else {
        dataUrl = await readFileAsDataUrl(f);
      }

      if (isPdf) {
        try {
          const renderedPages = await renderPdfPages(dataUrl);
          renderedPages.forEach((p) => {
            newAssets.push({
              id: crypto.randomUUID(),
              job_id: activeAsset.job_id,
              original_path: (f as any).path || f.name,
              original_name: `${f.name} (P.${p.pageIndex})`,
              mime_type: 'image/jpeg',
              file_extension: 'pdf',
              file_size_bytes: f.size,
              source_width: p.width,
              source_height: p.height,
              page_count: 1,
              asset_type: 'pdf_page' as const,
              import_status: 'ready' as const,
              sort_order: assets.length + newAssets.length,
              created_at: new Date().toISOString(),
              preview_url: p.dataUrl,
            });
          });
        } catch (err) {
          console.error('Failed to parse dropped PDF:', err);
          invalidFiles.push(f);
        }
      } else {
        // Measure source dimensions
        let width: number | null = null;
        let height: number | null = null;
        try {
          const img = new Image();
          img.src = dataUrl;
          await new Promise((res) => { img.onload = res; img.onerror = res; });
          width = img.naturalWidth || null;
          height = img.naturalHeight || null;
        } catch {}

        newAssets.push({
          id: crypto.randomUUID(),
          job_id: activeAsset.job_id,
          original_path: (f as any).path || f.name,
          original_name: f.name,
          mime_type: f.type || 'image/jpeg',
          file_extension: f.name.split('.').pop() || 'jpg',
          file_size_bytes: f.size,
          source_width: width,
          source_height: height,
          page_count: 1,
          asset_type: 'image' as const,
          import_status: 'ready' as const,
          sort_order: assets.length + newAssets.length,
          created_at: new Date().toISOString(),
          preview_url: dataUrl,
        });
      }
    }

    if (invalidFiles.length > 0) {
      setValidationError(
        `Skipped ${invalidFiles.length} unsupported or unreadable file(s): "${invalidFiles.map((f) => f.name).slice(0, 3).join(', ')}". PrintMate accepts JPG, PNG, WebP, BMP, TIFF, and PDF files.`
      );
    } else {
      setValidationError(null);
    }

    if (newAssets.length > 0) {
      addAssets(newAssets);
    }
  };

  const handleAddMoreFiles = async () => {
    if (window.electronAPI) {
      try {
        const files = await window.electronAPI.selectImages();
        if (files && files.length > 0) {
          const newAssets = await Promise.all(
            files.map(async (f, idx) => {
              const dataUrl = await window.electronAPI!.readFileAsDataUrl(f.path);
              return {
                id: crypto.randomUUID(),
                job_id: activeAsset.job_id,
                original_path: f.path,
                original_name: f.name,
                mime_type: 'image/jpeg',
                file_extension: f.name.split('.').pop() || 'jpg',
                file_size_bytes: f.size,
                source_width: null,
                source_height: null,
                page_count: 1,
                asset_type: 'image' as const,
                import_status: 'ready' as const,
                sort_order: assets.length + idx,
                created_at: new Date().toISOString(),
                preview_url: dataUrl,
              };
            })
          );
          addAssets(newAssets);
        }
        return;
      } catch (err) {
        console.warn('Electron image select failed, falling back to input:', err);
      }
    }

    addFileInputRef.current?.click();
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleProcessAddFiles(e.dataTransfer.files);
        }
      }}
      style={{ flex: 1, display: 'flex', overflow: 'hidden' }}
    >
      <input
        ref={addFileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf"
        style={{ display: 'none' }}
        onChange={(e) => e.target.files && handleProcessAddFiles(e.target.files)}
      />
      {/* 1. Left Thumbnail Sidebar */}
      <aside
        style={{
          width: '260px',
          backgroundColor: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Imported Items ({assets.length})
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="btn btn-secondary"
              style={{ padding: '4px 8px', fontSize: '11px' }}
              onClick={handleBatchAutoAlignAll}
              disabled={isProcessing || assets.length === 0}
              title="Auto align, deskew, and tone balance all pages in batch"
            >
              <Sparkles size={12} color="var(--accent-blue)" />
              Align All
            </button>
            <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={handleAddMoreFiles}>
              <Plus size={13} />
              Add
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {assets.map((asset, idx) => {
              const isSelected = asset.id === activeAsset.id;
              return (
                <div
                  key={asset.id}
                  onClick={() => setActiveAsset(asset.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: isSelected ? 'var(--bg-elevated)' : 'var(--bg-tertiary)',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--accent-blue)' : 'var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {/* Reordering Controls */}
                  {assets.length > 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flexShrink: 0 }}>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '1px', opacity: idx === 0 ? 0.25 : 0.8 }}
                        disabled={idx === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          reorderAssets(idx, idx - 1);
                        }}
                        title="Move Up"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '1px', opacity: idx === assets.length - 1 ? 0.25 : 0.8 }}
                        disabled={idx === assets.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          reorderAssets(idx, idx + 1);
                        }}
                        title="Move Down"
                      >
                        <ChevronDown size={12} />
                      </button>
                    </div>
                  )}

                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {asset.preview_url ? (
                      <img
                        src={asset.preview_url}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <FileText size={18} color="var(--text-muted)" />
                    )}
                  </div>

                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={asset.original_name}
                    >
                      {asset.original_name}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center', marginTop: '2px' }}>
                      <span
                        style={{
                          fontSize: '9px',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          fontWeight: 600,
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          color: 'var(--accent-blue)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {detectDocumentType(asset.source_width || 1, asset.source_height || 1)}
                      </span>
                      <span>{asset.asset_type === 'pdf_page' ? 'PDF' : 'Image'}</span>
                      {asset.source_width && asset.source_height && (
                        <span>• {asset.source_width}×{asset.source_height}</span>
                      )}
                      {asset.file_size_bytes && (
                        <span>• {Math.round(asset.file_size_bytes / 1024)}KB</span>
                      )}
                    </div>
                    {asset.import_status === 'missing' && (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          fontSize: '9px',
                          color: '#b45309',
                          backgroundColor: '#fef3c7',
                          padding: '1px 4px',
                          borderRadius: '3px',
                          marginTop: '2px',
                          fontWeight: 600,
                        }}
                      >
                        <AlertTriangle size={9} /> Missing
                      </div>
                    )}
                  </div>

                  {assets.length > 1 && (
                    <button
                      className="btn btn-ghost"
                      style={{ padding: '4px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAsset(asset.id);
                      }}
                      title="Remove Item"
                    >
                      <Trash2 size={13} color="var(--text-muted)" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* 2. Center Viewport */}
      <main
        style={{
          flex: 1,
          backgroundColor: 'var(--bg-canvas)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Validation Warning Alert */}
        {validationError && (
          <div
            style={{
              padding: '8px 16px',
              backgroundColor: '#fef2f2',
              borderBottom: '1px solid #fee2e2',
              color: '#b91c1c',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              zIndex: 15,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={14} color="#ef4444" />
              <span>{validationError}</span>
            </div>
            <button
              className="btn btn-ghost"
              style={{ padding: '2px 6px', fontSize: '11px' }}
              onClick={() => setValidationError(null)}
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Missing Source File Warning Banner */}
        {activeAsset.import_status === 'missing' && (
          <div
            style={{
              padding: '8px 16px',
              backgroundColor: '#fffbeb',
              borderBottom: '1px solid #fef3c7',
              color: '#92400e',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              zIndex: 15,
            }}
          >
            <AlertTriangle size={14} color="#d97706" />
            <span>
              <strong>Source file missing on disk:</strong> <code>{activeAsset.original_path}</code> could not be found. PrintMate is using the embedded image cache.
            </span>
          </div>
        )}

        {/* Top Viewport Toolbar */}
        <div
          style={{
            height: '48px',
            backgroundColor: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            zIndex: 10,
          }}
        >
          {/* Quick Auto Correct & Alignment Tools */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
              onClick={handleAutoCorrect}
              disabled={isProcessing}
              title="One-click full auto correction: Straighten, detect bounds, tone balance & text sharpening"
            >
              <Sparkles size={14} />
              {isProcessing ? 'Analyzing...' : 'Auto Correct'}
            </button>

            <button
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '12px' }}
              onClick={handleAutoAlignAndCrop}
              disabled={isProcessing}
              title="Automatically detect document paper edges, crop and deskew"
            >
              <Crop size={13} />
              Auto Align & Crop
            </button>

            <button
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '12px' }}
              onClick={handleAutoTone}
              disabled={isProcessing}
              title="Balance shadows and highlights with histogram auto-exposure"
            >
              <Sun size={13} />
              Auto Tone
            </button>

            <button
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '12px' }}
              onClick={handleAutoDeskew}
              disabled={isProcessing}
              title="Detect document skew angle and straighten automatically"
            >
              <RefreshCw size={13} />
              Auto Deskew
            </button>

            <button
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '12px' }}
              onClick={handleAutoPerspectiveCorrection}
              disabled={isProcessing}
              title="Detect document paper boundary and correct perspective warp"
            >
              <ScanLine size={13} />
              Perspective Fix
            </button>

            <button
              className={`btn ${isA4Locked() ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 10px', fontSize: '12px' }}
              onClick={handleToggleLockToA4}
              title="Lock sheet strictly to A4 page dimensions (210×297mm). Prevents page from getting wider when tilted."
            >
              <FileText size={13} />
              {isA4Locked() ? 'A4 Locked' : 'Lock A4'}
            </button>
          </div>

          {/* Center: Undo / Redo / Reset & Hold Original */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              className="btn btn-ghost"
              style={{ padding: '6px', opacity: canUndoAsset(activeAsset.id) ? 1 : 0.35 }}
              onClick={() => undoAssetEdits(activeAsset.id)}
              disabled={!canUndoAsset(activeAsset.id)}
              title="Undo (Ctrl+Z)"
            >
              <Undo size={15} />
            </button>
            <button
              className="btn btn-ghost"
              style={{ padding: '6px', opacity: canRedoAsset(activeAsset.id) ? 1 : 0.35 }}
              onClick={() => redoAssetEdits(activeAsset.id)}
              disabled={!canRedoAsset(activeAsset.id)}
              title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
            >
              <Redo size={15} />
            </button>
            <button
              className="btn btn-ghost"
              style={{ padding: '6px' }}
              onClick={() => resetAssetEdits(activeAsset.id)}
              title="Reset All Edits to Original"
            >
              <RotateCcw size={15} />
            </button>

            <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border-subtle)', margin: '0 4px' }} />

            <button
              className={`btn ${showOriginal ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '12px', padding: '5px 10px' }}
              onMouseDown={() => setShowOriginal(true)}
              onMouseUp={() => setShowOriginal(false)}
              onMouseLeave={() => setShowOriginal(false)}
              title="Hold to see original unedited source"
            >
              <Eye size={14} />
              Hold: Original
            </button>
          </div>

          {/* Zoom & View Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn btn-ghost"
              style={{ padding: '6px' }}
              onClick={() => setZoom((z) => Math.max(0.2, z - 0.2))}
              title="Zoom Out"
            >
              <ZoomOut size={16} />
            </button>
            <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', minWidth: '45px', textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              className="btn btn-ghost"
              style={{ padding: '6px' }}
              onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
              title="Zoom In"
            >
              <ZoomIn size={16} />
            </button>
            <button
              className="btn btn-ghost"
              style={{ padding: '6px' }}
              onClick={() => setZoom(1)}
              title="Reset Zoom (100%)"
            >
              <Maximize2 size={15} />
            </button>

            <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border-subtle)', margin: '0 4px' }} />

            <button
              className="btn btn-accent"
              style={{ padding: '7px 14px', fontSize: '13px' }}
              onClick={() => onNavigate('layout')}
            >
              <span>Add to Page Layout</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Canvas Workspace Area */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            position: 'relative',
          }}
        >
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
              transition: 'transform 100ms ease-out',
              boxShadow: '0 8px 30px rgba(15, 23, 42, 0.12)',
              position: 'relative',
              borderRadius: '2px',
              backgroundColor: '#ffffff',
            }}
          >
            {isA4Locked() && (
              <div
                style={{
                  position: 'absolute',
                  top: '-26px',
                  left: '0',
                  backgroundColor: 'rgba(37, 99, 235, 0.9)',
                  color: '#ffffff',
                  padding: '2px 8px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.12)',
                  whiteSpace: 'nowrap',
                }}
              >
                <FileText size={11} />
                <span>A4 Sheet (210 × 297 mm) Fixed</span>
              </div>
            )}
            <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%', maxHeight: '72vh' }} />

            {/* Interactive Crop Frame Overlay */}
            {isCropping && (
              <div
                style={{
                  position: 'absolute',
                  top: `${cropBox.y * 100}%`,
                  left: `${cropBox.x * 100}%`,
                  width: `${cropBox.w * 100}%`,
                  height: `${cropBox.h * 100}%`,
                  border: '2px dashed #06b6d4',
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
                  cursor: 'move',
                  pointerEvents: 'auto',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '-32px',
                    left: '0',
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Crop size={12} color="var(--accent-cyan)" />
                  <span>Drag Crop Boundary</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 3. Right Editing Controls Inspector */}
      <aside
        style={{
          width: '320px',
          backgroundColor: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          userSelect: 'none',
        }}
      >
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Section: Orientation & Straighten */}
          <div className="glass-panel" style={{ padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Orientation & Deskew
              </span>
              <button
                className="btn btn-secondary"
                style={{ padding: '3px 8px', fontSize: '11px' }}
                onClick={handleAutoDeskew}
                disabled={isProcessing}
                title="Detect document skew angle and straighten automatically"
              >
                <RefreshCw size={11} />
                Auto Deskew
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '8px' }}>
              <button className="tool-btn" onClick={() => handleRotate(-90)} title="Rotate -90°">
                <RotateCcw size={15} />
                <span>-90°</span>
              </button>
              <button className="tool-btn" onClick={() => handleRotate(90)} title="Rotate +90°">
                <RotateCw size={15} />
                <span>+90°</span>
              </button>
              <button className="tool-btn" onClick={() => handleRotate(180)} title="Rotate 180°">
                <RotateCw size={15} />
                <span>180°</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginBottom: '12px' }}>
              <button
                className={`tool-btn ${activeEdits.flip_horizontal ? 'active' : ''}`}
                onClick={handleToggleFlipHorizontal}
                title="Flip Horizontal (Mirror)"
              >
                <FlipHorizontal size={15} />
                <span>Flip Horiz</span>
              </button>
              <button
                className={`tool-btn ${activeEdits.flip_vertical ? 'active' : ''}`}
                onClick={handleToggleFlipVertical}
                title="Flip Vertical (Upside down)"
              >
                <FlipVertical size={15} />
                <span>Flip Vert</span>
              </button>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Straighten Angle</span>
                <span className="font-mono" style={{ color: 'var(--accent-cyan)' }}>
                  {activeEdits.straighten_degrees || 0}°
                </span>
              </div>
              <input
                type="range"
                className="slider-control"
                min="-45"
                max="45"
                step="0.5"
                value={activeEdits.straighten_degrees || 0}
                onChange={(e) =>
                  updateAssetEdits(activeAsset.id, {
                    straighten_degrees: parseFloat(e.target.value),
                  })
                }
              />
            </div>

            <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
              <button
                className={`btn ${isA4Locked() ? 'btn-primary' : 'btn-secondary'}`}
                style={{ width: '100%', padding: '6px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={handleToggleLockToA4}
                title="Lock canvas strictly to standard A4 (210×297mm) sheet. Prevents page from getting wider when adjusting tilt angles."
              >
                <FileText size={13} />
                <span>{isA4Locked() ? 'Locked to A4 Page (210×297mm)' : 'Lock to A4 Page (Fixed Size)'}</span>
              </button>
            </div>
          </div>

          {/* Section: Crop Tool */}
          <div className="glass-panel" style={{ padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Crop Frame
              </span>
              <button
                className={`btn ${isCropping ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 8px', fontSize: '11px' }}
                onClick={() => setIsCropping(!isCropping)}
              >
                <Crop size={12} />
                {isCropping ? 'Editing' : 'Crop'}
              </button>
            </div>

            {isCropping && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  <button className="tool-btn" onClick={() => handleSetAspectCrop(1)}>
                    1:1 Square
                  </button>
                  <button className="tool-btn" onClick={() => handleSetAspectCrop(35 / 45)}>
                    Passport
                  </button>
                  <button className="tool-btn" onClick={() => handleSetAspectCrop(20 / 25)}>
                    Stamp
                  </button>
                  <button className="tool-btn" onClick={() => handleSetAspectCrop(85.6 / 54)}>
                    ID Card
                  </button>
                  <button className="tool-btn" onClick={() => handleSetAspectCrop(6 / 4)}>
                    4x6 Photo
                  </button>
                  <button className="tool-btn" onClick={() => handleSetAspectCrop(210 / 297)}>
                    A4 Doc
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginTop: '4px' }}>
                  <button
                    className="tool-btn"
                    onClick={handleAutoBoundary}
                    title="Detect document paper boundary and adjust crop box"
                  >
                    <ScanLine size={13} />
                    <span>Detect Bounds</span>
                  </button>
                  <button
                    className="tool-btn"
                    onClick={handleAutoAlignAndCrop}
                    title="Auto detect document edges, align skew and crop"
                  >
                    <Sparkles size={13} color="var(--accent-blue)" />
                    <span>Align & Crop</span>
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <button className="btn btn-accent" style={{ flex: 1, padding: '6px' }} onClick={handleApplyCrop}>
                    <Check size={14} />
                    Apply Crop
                  </button>
                  <button className="btn btn-ghost" style={{ padding: '6px' }} onClick={handleResetCrop}>
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section: Document & Text Darkening (Xerox Studio Feature) */}
          <div className="glass-panel" style={{ padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <Sparkles size={16} color="var(--accent-magenta)" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Xerox Text Darkener
              </span>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Faded Text Darkening</span>
                <span className="font-mono" style={{ color: 'var(--accent-magenta)' }}>
                  {activeEdits.text_darkening || 0}
                </span>
              </div>
              <input
                type="range"
                className="slider-control"
                min="0"
                max="2"
                step="0.1"
                value={activeEdits.text_darkening || 0}
                onChange={(e) =>
                  updateAssetEdits(activeAsset.id, {
                    text_darkening: parseFloat(e.target.value),
                  })
                }
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Sharpness (Edge Filter)</span>
                <span className="font-mono" style={{ color: 'var(--accent-magenta)' }}>
                  {activeEdits.sharpness || 0}
                </span>
              </div>
              <input
                type="range"
                className="slider-control"
                min="0"
                max="3"
                step="0.5"
                value={activeEdits.sharpness || 0}
                onChange={(e) =>
                  updateAssetEdits(activeAsset.id, {
                    sharpness: parseFloat(e.target.value),
                  })
                }
              />
            </div>
          </div>

          {/* Section: Brightness, Contrast, Grayscale */}
          <div className="glass-panel" style={{ padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Color & Contrast
              </span>
              <button
                className="btn btn-secondary"
                style={{ padding: '3px 8px', fontSize: '11px' }}
                onClick={handleAutoTone}
                disabled={isProcessing}
                title="Calculate optimal brightness and contrast from histogram"
              >
                <Sun size={11} />
                Auto Tone
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Brightness</span>
                  <span className="font-mono">{Math.round((activeEdits.brightness || 0) * 100)}</span>
                </div>
                <input
                  type="range"
                  className="slider-control"
                  min="-1"
                  max="1"
                  step="0.05"
                  value={activeEdits.brightness || 0}
                  onChange={(e) =>
                    updateAssetEdits(activeAsset.id, {
                      brightness: parseFloat(e.target.value),
                    })
                  }
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Contrast</span>
                  <span className="font-mono">{activeEdits.contrast || 1}</span>
                </div>
                <input
                  type="range"
                  className="slider-control"
                  min="0.2"
                  max="2.5"
                  step="0.05"
                  value={activeEdits.contrast || 1}
                  onChange={(e) =>
                    updateAssetEdits(activeAsset.id, {
                      contrast: parseFloat(e.target.value),
                    })
                  }
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Saturation</span>
                  <span className="font-mono">{Math.round((activeEdits.saturation ?? 1) * 100)}%</span>
                </div>
                <input
                  type="range"
                  className="slider-control"
                  min="0"
                  max="2.5"
                  step="0.05"
                  value={activeEdits.saturation ?? 1}
                  onChange={(e) =>
                    updateAssetEdits(activeAsset.id, {
                      saturation: parseFloat(e.target.value),
                    })
                  }
                />
              </div>

              {/* Grayscale Toggle */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-tertiary)',
                  cursor: 'pointer',
                }}
                onClick={() =>
                  updateAssetEdits(activeAsset.id, {
                    grayscale: !activeEdits.grayscale,
                  })
                }
              >
                <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>Grayscale (B&W Xerox)</span>
                <input
                  type="checkbox"
                  checked={activeEdits.grayscale}
                  onChange={() => {}}
                  style={{ cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>

          {/* Section: Background Replacement (Passport Photo Mode) */}
          <div className="glass-panel" style={{ padding: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '10px' }}>
              Photo Background Replacement
            </span>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginBottom: '10px' }}>
              <button
                className={`tool-btn ${activeEdits.background_mode === 'original' ? 'active' : ''}`}
                onClick={() => updateAssetEdits(activeAsset.id, { background_mode: 'original' })}
              >
                Original
              </button>
              <button
                className={`tool-btn ${activeEdits.background_mode === 'white' ? 'active' : ''}`}
                onClick={() => updateAssetEdits(activeAsset.id, { background_mode: 'white' })}
              >
                Studio White
              </button>
              <button
                className={`tool-btn ${activeEdits.background_mode === 'blue' ? 'active' : ''}`}
                onClick={() => updateAssetEdits(activeAsset.id, { background_mode: 'blue' })}
              >
                Passport Blue
              </button>
              <button
                className={`tool-btn ${activeEdits.background_mode === 'transparent' ? 'active' : ''}`}
                onClick={() => updateAssetEdits(activeAsset.id, { background_mode: 'transparent' })}
              >
                Transparent
              </button>
            </div>
          </div>

          {/* Reset All Changes */}
          <button
            className="btn btn-ghost"
            style={{ width: '100%', color: 'var(--text-secondary)' }}
            onClick={() => resetAssetEdits(activeAsset.id)}
          >
            <RotateCcw size={14} />
            Reset Edits to Original
          </button>
        </div>
      </aside>
    </div>
  );
};
