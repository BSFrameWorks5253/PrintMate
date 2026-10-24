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
} from 'lucide-react';
import { useJobStore } from '../../stores/jobStore';
import { TabId } from '../../components/layout/Header';
import {
  loadImage,
  renderProcessedCanvas,
  detectDocumentSkew,
  createDefaultEdits,
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
    removeAsset,
    addAssets,
  } = useJobStore();

  const [zoom, setZoom] = useState<number>(1);
  const [showOriginal, setShowOriginal] = useState<boolean>(false);
  const [isCropping, setIsCropping] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [cropBox, setCropBox] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 0.1,
    y: 0.1,
    w: 0.8,
    h: 0.8,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeAsset = assets.find((a) => a.id === activeAssetId) || assets[0];
  const activeEdits = activeAsset ? edits[activeAsset.id] || createDefaultEdits(activeAsset.id) : null;

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

  // Full Auto Correct
  const handleAutoCorrect = () => {
    if (!canvasRef.current) return;
    setIsProcessing(true);
    setTimeout(() => {
      try {
        const angle = detectDocumentSkew(canvasRef.current!);
        updateAssetEdits(activeAsset.id, {
          straighten_degrees: Math.round(angle * 10) / 10,
          text_darkening: 1.2,
          contrast: 1.25,
          sharpness: 1.5,
        });
      } finally {
        setIsProcessing(false);
      }
    }, 50);
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
    // Center aspect box
    let w = 0.8;
    let h = 0.8;
    if (aspect > 1) {
      h = w / aspect;
    } else {
      w = h * aspect;
    }
    setCropBox({
      x: (1 - w) / 2,
      y: (1 - h) / 2,
      w,
      h,
    });
  };

  const handleAddMoreFiles = async () => {
    if (!window.electronAPI) return;
    try {
      const files = await window.electronAPI.selectImages();
      if (files.length === 0) return;

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
    } catch (err) {
      console.error('Failed to add more images:', err);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
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
          <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={handleAddMoreFiles}>
            <Plus size={13} />
            Add
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {assets.map((asset) => {
              const isSelected = asset.id === activeAsset.id;
              return (
                <div
                  key={asset.id}
                  onClick={() => setActiveAsset(asset.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: isSelected ? 'var(--bg-elevated)' : 'var(--bg-tertiary)',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--accent-blue)' : 'var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '4px',
                      backgroundColor: '#000000',
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
                      <FileText size={20} color="var(--text-muted)" />
                    )}
                  </div>

                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: isSelected ? '#ffffff' : 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={asset.original_name}
                    >
                      {asset.original_name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {asset.asset_type === 'pdf_page' ? 'PDF Page' : 'Image'}
                    </div>
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
          {/* Quick Auto Correct Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
              onClick={handleAutoCorrect}
              disabled={isProcessing}
            >
              <Sparkles size={14} />
              {isProcessing ? 'Analyzing...' : 'Auto Correct'}
            </button>

            <button
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
              onClick={handleAutoDeskew}
              disabled={isProcessing}
              title="Detect document skew angle and straighten automatically"
            >
              <RefreshCw size={13} />
              Auto Deskew
            </button>
          </div>

          {/* Zoom & View Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

            <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border-subtle)' }} />

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
          </div>

          {/* Layout Next Button */}
          <div>
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
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              position: 'relative',
              borderRadius: '2px',
              backgroundColor: '#111827',
            }}
          >
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
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '10px' }}>
              Orientation & Deskew
            </span>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button className="tool-btn" style={{ flex: 1 }} onClick={() => handleRotate(-90)}>
                <RotateCcw size={16} />
                <span>Rotate -90°</span>
              </button>
              <button className="tool-btn" style={{ flex: 1 }} onClick={() => handleRotate(90)}>
                <RotateCw size={16} />
                <span>Rotate +90°</span>
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
                  <button className="tool-btn" onClick={() => handleSetAspectCrop(85.6 / 54)}>
                    ID Card
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
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '10px' }}>
              Color & Contrast
            </span>

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
