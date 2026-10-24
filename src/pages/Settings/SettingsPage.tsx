import React, { useEffect } from 'react';
import { Settings, Printer, Database, ShieldCheck, HardDrive, RefreshCw } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { PAPER_SIZES } from '../../utils/units';
import { PaperSize, Orientation } from '../../types';

export const SettingsPage: React.FC = () => {
  const { settings, updateSetting, printers, selectedPrinter, setSelectedPrinter, fetchPrinters, fetchSettings } =
    useSettingsStore();

  useEffect(() => {
    fetchSettings();
    fetchPrinters();
  }, []);

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '32px 40px',
        maxWidth: '1000px',
        margin: '0 auto',
        width: '100%',
      }}
    >
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', marginBottom: '4px' }}>
          Application Settings
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Configure default printing dimensions, paper preferences, and local database storage.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Section 1: Default Paper & Geometry */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Printer size={18} color="var(--accent-cyan)" />
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
              Default Paper & Sheet Dimensions
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Default Paper Size
              </label>
              <select
                className="input-select"
                value={settings.default_paper_size}
                onChange={(e) => updateSetting('default_paper_size', e.target.value as PaperSize)}
              >
                {Object.entries(PAPER_SIZES).map(([key, def]) => (
                  <option key={key} value={key}>
                    {def.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Default Orientation
              </label>
              <select
                className="input-select"
                value={settings.default_orientation}
                onChange={(e) => updateSetting('default_orientation', e.target.value as Orientation)}
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Default Margins (mm)
              </label>
              <input
                type="number"
                className="input-text font-mono"
                value={settings.default_margin_mm}
                onChange={(e) => updateSetting('default_margin_mm', parseFloat(e.target.value) || 0)}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Default Item Spacing / Gap (mm)
              </label>
              <input
                type="number"
                className="input-text font-mono"
                value={settings.default_spacing_mm}
                onChange={(e) => updateSetting('default_spacing_mm', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Default Printer */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Printer size={18} color="var(--accent-blue)" />
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
                Default Windows Printer
              </span>
            </div>
            <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={fetchPrinters}>
              <RefreshCw size={12} />
              Detect Printers
            </button>
          </div>

          <select
            className="input-select"
            value={selectedPrinter || ''}
            onChange={(e) => {
              setSelectedPrinter(e.target.value);
              updateSetting('default_printer', e.target.value);
            }}
          >
            {printers.length === 0 ? (
              <option value="">No printers detected</option>
            ) : (
              printers.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} {p.isDefault ? '(Windows Default)' : ''}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Section 3: Database & Local Storage */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Database size={18} color="var(--accent-magenta)" />
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
              Database & Offline Storage
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Database Engine:</span>
              <span className="font-mono" style={{ color: '#ffffff' }}>SQLite 3 (Local WebAssembly WAL)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Database File Path:</span>
              <span className="font-mono" style={{ color: 'var(--accent-cyan)' }}>%APPDATA%/PrintMate/data/printmate.db</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Operating Mode:</span>
              <span className="badge badge-green">100% Offline / Local-First</span>
            </div>
          </div>
        </div>

        {/* Section 4: Zero Cost & Licensing Verification */}
        <div
          className="glass-panel"
          style={{
            padding: '20px',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <ShieldCheck size={20} color="var(--accent-emerald)" />
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
              ₹0 Cost & Commercial Compliance Verification
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            PrintMate is completely free forever. No cloud API subscriptions, no monthly charges, no mandatory accounts,
            and no telemetry. All documents are processed locally on your hardware without internet transmission.
          </p>
        </div>
      </div>
    </div>
  );
};
