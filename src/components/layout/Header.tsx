import React from 'react';
import {
  Printer,
  Sliders,
  LayoutGrid,
  Eye,
  History,
  Settings,
  Home,
  Save,
  CheckCircle2,
  FileText,
  Sparkles,
} from 'lucide-react';
import { useJobStore } from '../../stores/jobStore';
import { useSettingsStore } from '../../stores/settingsStore';

export type TabId = 'home' | 'editor' | 'layout' | 'preview' | 'history' | 'settings';

interface HeaderProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onSelectTab }) => {
  const { currentJob, isDirty, isSaving, saveCurrentJob, assets } = useJobStore();
  const { selectedPrinter } = useSettingsStore();

  const tabs: { id: TabId; label: string; icon: React.FC<any>; badge?: number }[] = [
    { id: 'home', label: 'Dashboard', icon: Home },
    { id: 'editor', label: 'Image Editor', icon: Sliders, badge: assets.length },
    { id: 'layout', label: 'Page Layout', icon: LayoutGrid },
    { id: 'preview', label: 'Print Preview', icon: Eye },
    { id: 'history', label: 'Job History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header
      style={{
        height: '62px',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {/* Brand */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
        onClick={() => onSelectTab('home')}
      >
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-sm)',
            background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #ec4899 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(6, 182, 212, 0.3)',
          }}
        >
          <Printer size={22} color="#ffffff" strokeWidth={2.2} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.3px', color: '#ffffff' }}>
              PrintMate
            </span>
            <span className="badge badge-cyan" style={{ fontSize: '9px', padding: '1px 5px' }}>
              PRO STUDIO
            </span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Xerox & Print Workflow
          </span>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--bg-elevated)' : 'transparent',
                border: '1px solid',
                borderColor: isActive ? 'var(--border-medium)' : 'transparent',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <Icon size={16} color={isActive ? 'var(--accent-cyan)' : 'currentColor'} />
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '10px',
                    backgroundColor: isActive ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                    color: '#ffffff',
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Right Controls: Active Job & Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {currentJob && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '5px 12px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <FileText size={14} color="var(--accent-blue)" />
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                maxWidth: '160px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={currentJob.name}
            >
              {currentJob.name}
            </span>

            {isDirty ? (
              <span className="badge badge-amber" style={{ fontSize: '9px', padding: '1px 5px' }}>
                Unsaved
              </span>
            ) : (
              <span className="badge badge-green" style={{ fontSize: '9px', padding: '1px 5px' }}>
                Saved
              </span>
            )}

            <button
              className="btn btn-ghost"
              style={{ padding: '3px 8px', fontSize: '11px' }}
              onClick={() => saveCurrentJob()}
              disabled={isSaving || !isDirty}
              title="Save Job (Ctrl+S)"
            >
              <Save size={13} />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}

        {/* Selected printer badge */}
        {selectedPrinter && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-elevated)',
            }}
            title={`Active Printer: ${selectedPrinter}`}
          >
            <CheckCircle2 size={13} color="var(--accent-emerald)" />
            <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedPrinter}
            </span>
          </div>
        )}
      </div>
    </header>
  );
};
