import React, { useState } from 'react';
import {
  LayoutGrid,
  FileText,
  Printer,
  Copy,
  Trash2,
  RotateCw,
  Maximize2,
  AlertTriangle,
  ArrowRight,
  Plus,
  Sliders,
  Settings2,
  CheckSquare,
} from 'lucide-react';
import { useJobStore } from '../../stores/jobStore';
import { TabId } from '../../components/layout/Header';
import { PAPER_SIZES, STANDARD_PHOTO_PRESETS } from '../../utils/units';
import { PaperSize, Orientation, FitMode } from '../../types';

interface PageLayoutPageProps {
  onNavigate: (tab: TabId) => void;
}

export const PageLayoutPage: React.FC<PageLayoutPageProps> = ({ onNavigate }) => {
  const {
    pages,
    activePageIndex,
    setActivePageIndex,
    updatePageSettings,
    applyLayoutPreset,
    applyGridPreset,
    applyIdCardFrontBackLayout,
    addPage,
    removePage,
    updatePageItem,
    removePageItem,
    clearPageItems,
    assets,
  } = useJobStore();

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const currentPage = pages[activePageIndex] || pages[0];
  const assetMap = new Map(assets.map((a) => [a.id, a]));

  if (!currentPage) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button className="btn btn-primary" onClick={() => addPage('A4', 'portrait')}>
          Initialize Page
        </button>
      </div>
    );
  }

  // Calculate printable dimensions
  const printableW = currentPage.width_mm - currentPage.margin_left_mm - currentPage.margin_right_mm;
  const printableH = currentPage.height_mm - currentPage.margin_top_mm - currentPage.margin_bottom_mm;

  // Screen scale factor: fit page neatly into workspace
  // Target preview height ~650px
  const scale = 650 / currentPage.height_mm; // px per mm
  const pagePxW = currentPage.width_mm * scale;
  const pagePxH = currentPage.height_mm * scale;

  // Check overflow / clipping warnings
  const items = currentPage.items || [];
  const hasOverflow = items.some(
    (item) =>
      item.position_x_mm + item.width_mm > currentPage.width_mm - currentPage.margin_right_mm ||
      item.position_y_mm + item.height_mm > currentPage.height_mm - currentPage.margin_bottom_mm ||
      item.position_x_mm < currentPage.margin_left_mm ||
      item.position_y_mm < currentPage.margin_top_mm
  );

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* 1. Left Sidebar: Presets & Layout Controls */}
      <aside
        style={{
          width: '320px',
          backgroundColor: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          userSelect: 'none',
        }}
      >
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Paper & Geometry
            </span>
            <span className="badge badge-cyan font-mono" style={{ fontSize: '10px' }}>
              {currentPage.width_mm} × {currentPage.height_mm} mm
            </span>
          </div>

          {/* Paper Size & Orientation */}
          <div className="glass-panel" style={{ padding: '14px' }}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Paper Format
              </label>
              <select
                className="input-select"
                value={currentPage.paper_size}
                onChange={(e) => updatePageSettings(activePageIndex, { paper_size: e.target.value as PaperSize })}
              >
                {Object.entries(PAPER_SIZES).map(([key, def]) => (
                  <option key={key} value={key}>
                    {def.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                className={`tool-btn ${currentPage.orientation === 'portrait' ? 'active' : ''}`}
                onClick={() => updatePageSettings(activePageIndex, { orientation: 'portrait' })}
              >
                Portrait
              </button>
              <button
                className={`tool-btn ${currentPage.orientation === 'landscape' ? 'active' : ''}`}
                onClick={() => updatePageSettings(activePageIndex, { orientation: 'landscape' })}
              >
                Landscape
              </button>
            </div>
          </div>

          {/* Quick Xerox Shop Presets */}
          <div className="glass-panel" style={{ padding: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '10px' }}>
              Xerox Shop Presets
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '12px' }}
                onClick={() => applyLayoutPreset('passport_in', 8)}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-cyan)' }} />
                <span>Indian Passport (8-up A4)</span>
              </button>

              <button
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '12px' }}
                onClick={() => applyLayoutPreset('stamp_in', 12)}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-yellow)' }} />
                <span>Stamp Size (12-up A4)</span>
              </button>

              <button
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '12px' }}
                onClick={() => applyLayoutPreset('passport_us', 6)}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-blue)' }} />
                <span>US Visa 2×2 in (6-up A4)</span>
              </button>

              <button
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '8px 12px', fontSize: '12px' }}
                onClick={() => applyIdCardFrontBackLayout()}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-magenta)' }} />
                <span>ID Card Front & Back (CR80)</span>
              </button>
            </div>
          </div>

          {/* N-Up Grid Presets */}
          <div className="glass-panel" style={{ padding: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '10px' }}>
              Equal Grid Presets
            </span>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
              <button className="tool-btn" onClick={() => applyGridPreset(1, 1)}>
                1-up
              </button>
              <button className="tool-btn" onClick={() => applyGridPreset(2, 1)}>
                2-up
              </button>
              <button className="tool-btn" onClick={() => applyGridPreset(2, 2)}>
                4-up
              </button>
              <button className="tool-btn" onClick={() => applyGridPreset(3, 2)}>
                6-up
              </button>
              <button className="tool-btn" onClick={() => applyGridPreset(4, 2)}>
                8-up
              </button>
              <button className="tool-btn" onClick={() => applyGridPreset(3, 3)}>
                9-up
              </button>
              <button className="tool-btn" onClick={() => applyGridPreset(4, 3)}>
                12-up
              </button>
              <button className="tool-btn" onClick={() => clearPageItems(activePageIndex)}>
                Clear
              </button>
            </div>
          </div>

          {/* Margins & Spacings */}
          <div className="glass-panel" style={{ padding: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '10px' }}>
              Margins & Spacing (mm)
            </span>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Margins</label>
                <input
                  type="number"
                  className="input-text font-mono"
                  value={currentPage.margin_top_mm}
                  onChange={(e) => {
                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                    updatePageSettings(activePageIndex, {
                      margin_top_mm: val,
                      margin_right_mm: val,
                      margin_bottom_mm: val,
                      margin_left_mm: val,
                    });
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Item Gap</label>
                <input
                  type="number"
                  className="input-text font-mono"
                  value={currentPage.spacing_x_mm}
                  onChange={(e) => {
                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                    updatePageSettings(activePageIndex, {
                      spacing_x_mm: val,
                      spacing_y_mm: val,
                    });
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. Center Viewport: Actual WYSIWYG Page View */}
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
        {/* Top Control Bar */}
        <div
          style={{
            height: '48px',
            backgroundColor: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            zIndex: 10,
          }}
        >
          {/* Multi-page tab list */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Pages:
            </span>
            {pages.map((p, idx) => (
              <button
                key={p.id}
                className={`btn ${idx === activePageIndex ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: '11px' }}
                onClick={() => setActivePageIndex(idx)}
              >
                Page {idx + 1}
              </button>
            ))}
            <button
              className="btn btn-ghost"
              style={{ padding: '4px 8px', fontSize: '11px' }}
              onClick={() => addPage(currentPage.paper_size, currentPage.orientation)}
              title="Add New Blank Page"
            >
              <Plus size={14} />
              Add Page
            </button>
          </div>

          {/* Warnings */}
          {hasOverflow && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                color: '#fbbf24',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                padding: '4px 10px',
                borderRadius: '4px',
              }}
            >
              <AlertTriangle size={14} />
              <span>Items exceed printable margins!</span>
            </div>
          )}

          {/* Action: Next to Print Preview */}
          <button
            className="btn btn-accent"
            style={{ padding: '7px 16px', fontSize: '13px' }}
            onClick={() => onNavigate('preview')}
          >
            <span>Preview & Print</span>
            <ArrowRight size={15} />
          </button>
        </div>

        {/* Paper Sheet Rendering Area */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
          }}
        >
          {/* Physical Sheet Container */}
          <div
            style={{
              width: `${pagePxW}px`,
              height: `${pagePxH}px`,
              backgroundColor: currentPage.background_color || '#FFFFFF',
              boxShadow: '0 8px 30px rgba(15, 23, 42, 0.15)',
              position: 'relative',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            {/* Printable Margin Boundary Guide (Dashed line) */}
            <div
              style={{
                position: 'absolute',
                top: `${currentPage.margin_top_mm * scale}px`,
                left: `${currentPage.margin_left_mm * scale}px`,
                width: `${printableW * scale}px`,
                height: `${printableH * scale}px`,
                border: '1px dashed rgba(59, 130, 246, 0.35)',
                pointerEvents: 'none',
              }}
            />

            {/* Placed Page Items */}
            {items.map((item) => {
              const asset = assetMap.get(item.asset_id);
              const isSelected = item.id === selectedItemId;

              const itemLeftPx = item.position_x_mm * scale;
              const itemTopPx = item.position_y_mm * scale;
              const itemWidthPx = item.width_mm * scale;
              const itemHeightPx = item.height_mm * scale;

              return (
                <div
                  key={item.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedItemId(item.id);
                  }}
                  style={{
                    position: 'absolute',
                    left: `${itemLeftPx}px`,
                    top: `${itemTopPx}px`,
                    width: `${itemWidthPx}px`,
                    height: `${itemHeightPx}px`,
                    outline: isSelected ? '2px solid #2563eb' : '1px solid rgba(0, 0, 0, 0.15)',
                    boxShadow: isSelected ? '0 0 10px rgba(37, 99, 235, 0.5)' : 'none',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    backgroundColor: '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {asset && asset.preview_url ? (
                    <img
                      src={asset.preview_url}
                      alt=""
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: item.fit_mode === 'cover' ? 'cover' : 'contain',
                        pointerEvents: 'none',
                      }}
                    />
                  ) : (
                    <FileText size={24} color="#94a3b8" />
                  )}

                  {/* Cut / Border guide for Passport / ID photos */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      border: '0.5px solid rgba(0,0,0,0.1)',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* 3. Right Sidebar: Selected Item Properties */}
      <aside
        style={{
          width: '280px',
          backgroundColor: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-subtle)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
          Item Properties
        </span>

        {selectedItemId ? (
          (() => {
            const it = items.find((x) => x.id === selectedItemId);
            if (!it) return null;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="glass-panel" style={{ padding: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Physical Dimensions (mm)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Width</span>
                      <input
                        type="number"
                        className="input-text font-mono"
                        value={it.width_mm}
                        onChange={(e) =>
                          updatePageItem(activePageIndex, it.id, {
                            width_mm: Math.max(5, parseFloat(e.target.value) || 5),
                          })
                        }
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Height</span>
                      <input
                        type="number"
                        className="input-text font-mono"
                        value={it.height_mm}
                        onChange={(e) =>
                          updatePageItem(activePageIndex, it.id, {
                            height_mm: Math.max(5, parseFloat(e.target.value) || 5),
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Fitting Mode
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      className={`tool-btn ${it.fit_mode === 'contain' ? 'active' : ''}`}
                      onClick={() => updatePageItem(activePageIndex, it.id, { fit_mode: 'contain' })}
                    >
                      Contain (Full)
                    </button>
                    <button
                      className={`tool-btn ${it.fit_mode === 'cover' ? 'active' : ''}`}
                      onClick={() => updatePageItem(activePageIndex, it.id, { fit_mode: 'cover' })}
                    >
                      Cover (Fill)
                    </button>
                  </div>
                </div>

                <button
                  className="btn btn-danger"
                  style={{ width: '100%', marginTop: 'auto' }}
                  onClick={() => {
                    removePageItem(activePageIndex, it.id);
                    setSelectedItemId(null);
                  }}
                >
                  <Trash2 size={14} />
                  Delete Selected Item
                </button>
              </div>
            );
          })()
        ) : (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              color: 'var(--text-secondary)',
              fontSize: '12px',
            }}
          >
            Click any placed image on the sheet to adjust physical millimeters or fit mode.
          </div>
        )}
      </aside>
    </div>
  );
};
