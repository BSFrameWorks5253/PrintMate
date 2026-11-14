import React from 'react';
import { 
  Grid,
  UploadCloud,
  Layers,
  Scissors,
  ShieldCheck,
  Image as ImageIcon,
  FileSpreadsheet,
  FileDigit,
  ArrowLeft,
  SlidersHorizontal
} from 'lucide-react';
import type { NavigationTab } from '../../../types/converter';

interface NavigationRibbonProps {
  currentTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
}

export const NavigationRibbon: React.FC<NavigationRibbonProps> = ({
  currentTab,
  onTabChange
}) => {
  const tabs: Array<{
    id: NavigationTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    badgeColor?: string;
    title?: string;
  }> = [
    {
      id: 'all-tools',
      label: 'All Tools Hub',
      icon: Grid
    },
    {
      id: 'workspace',
      label: 'Smart Dropzone',
      icon: UploadCloud,
      badge: 'Auto',
      badgeColor: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
    },
    {
      id: 'size-reducer',
      label: 'Size Reducer',
      icon: SlidersHorizontal,
      badge: 'Govt',
      badgeColor: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      title: 'UPSC, SSC, NEET Portal Image Size Clamping'
    },
    {
      id: 'pdf-merge',
      label: 'Merge & Fusion',
      icon: Layers
    },
    {
      id: 'pdf-split',
      label: 'Split PDF',
      icon: Scissors
    },
    {
      id: 'pdf-organizer',
      label: 'Page Studio',
      icon: FileDigit
    },
    {
      id: 'office-suite',
      label: 'Office to PDF',
      icon: FileSpreadsheet
    },
    {
      id: 'image-gallery',
      label: 'Photos to PDF',
      icon: ImageIcon
    },
    {
      id: 'pdf-security',
      label: 'Security & Protect',
      icon: ShieldCheck
    }
  ];

  return (
    <div className="h-12 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between select-none shadow-2xs shrink-0 relative z-40 transition-colors duration-200">
      {/* DIRECT STUDIO TABS (Scrollable on small viewports) */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-1">
        {tabs.map((tab, idx) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <React.Fragment key={tab.id}>
              {idx === 3 && (
                <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 mx-1 shrink-0" />
              )}
              <button
                type="button"
                onClick={() => onTabChange(tab.id)}
                title={tab.title || tab.label}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
                  isActive
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-300 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className={`size-3.5 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[9.5px] px-1 py-0.2 rounded font-mono font-bold uppercase border ${
                    isActive ? 'bg-blue-700 text-white border-blue-500' : tab.badgeColor
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* RIGHT: CONTEXTUAL ACTIONS */}
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {currentTab !== 'all-tools' && (
          <button
            type="button"
            onClick={() => onTabChange('all-tools')}
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition font-bold text-xs flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 shadow-2xs cursor-pointer active:scale-95 whitespace-nowrap"
            title="Return to All Tools Hub"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Hub</span>
          </button>
        )}
      </div>
    </div>
  );
};
