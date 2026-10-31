import React, { useState, useRef, useEffect } from 'react';
import { 
  Grid,
  UploadCloud,
  PenTool,
  Layers,
  Scissors,
  ShieldCheck,
  RefreshCcw,
  Image as ImageIcon,
  FileSpreadsheet,
  Compass,
  FileDigit,
  ChevronDown,
  ArrowLeft,
  Check
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
  const [openDropdown, setOpenDropdown] = useState<'organize' | 'convert' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Close dropdown on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenDropdown(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const organizeItems: Array<{
    id: NavigationTab;
    label: string;
    description: string;
    icon: any;
  }> = [
    {
      id: 'pdf-merge',
      label: 'Merge & Fusion',
      description: 'Combine multiple PDFs, CAD & Office documents',
      icon: Layers
    },
    {
      id: 'pdf-split',
      label: 'Split PDF',
      description: 'Extract page ranges or split each page to ZIP',
      icon: Scissors
    },
    {
      id: 'pdf-organizer',
      label: 'Page Studio',
      description: 'Visual grid to rotate 90°, delete, & reorder',
      icon: FileDigit
    }
  ];

  const convertItems: Array<{
    id: NavigationTab;
    label: string;
    description: string;
    icon: any;
    badge?: string;
  }> = [
    {
      id: 'office-suite',
      label: 'Office to PDF',
      description: 'Convert Word (.docx) and Excel (.xlsx) to PDF',
      icon: FileSpreadsheet
    },
    {
      id: 'reverse-suite',
      label: 'PDF to Office & OCR',
      description: 'Extract to editable Word, Excel, & Tesseract OCR',
      icon: RefreshCcw
    },
    {
      id: 'image-gallery',
      label: 'Photos to PDF',
      description: 'Sequence JPG & PNG photos into high-res PDF albums',
      icon: ImageIcon
    }
  ];

  const isOrganizeActive = organizeItems.some(item => item.id === currentTab);
  const activeOrganizeItem = organizeItems.find(item => item.id === currentTab);

  const isConvertActive = convertItems.some(item => item.id === currentTab);
  const activeConvertItem = convertItems.find(item => item.id === currentTab);

  const getButtonClass = (isActive: boolean) => `
    px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border
    ${isActive
      ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-bold'
      : 'text-slate-600 dark:text-slate-300 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
    }
  `;

  return (
    <div 
      ref={dropdownRef}
      className="h-12 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between select-none shadow-2xs shrink-0 relative z-40 transition-colors duration-200"
    >
      {/* LEFT: PRIMARY HUBS & STREAMLINED TABS */}
      <div className="flex items-center gap-1.5 overflow-x-hidden no-scrollbar">
        {/* 1. All Tools Hub */}
        <button
          onClick={() => {
            onTabChange('all-tools');
            setOpenDropdown(null);
          }}
          className={getButtonClass(currentTab === 'all-tools')}
        >
          <Grid className={`size-3.5 ${currentTab === 'all-tools' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
          <span>All Tools Hub</span>
        </button>

        {/* 2. Auto Dropzone */}
        <button
          onClick={() => {
            onTabChange('workspace');
            setOpenDropdown(null);
          }}
          className={getButtonClass(currentTab === 'workspace')}
        >
          <UploadCloud className={`size-3.5 ${currentTab === 'workspace' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
          <span>Smart Dropzone</span>
          <span className={`text-[9.5px] px-1 py-0.2 rounded font-mono font-bold uppercase ${
            currentTab === 'workspace' ? 'bg-blue-700 text-white' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
          }`}>
            Auto
          </span>
        </button>

        {/* Elegant Subtle Divider */}
        <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 mx-1 shrink-0" />

        {/* 3. Edit & Sign */}
        <button
          onClick={() => {
            onTabChange('pdf-editor');
            setOpenDropdown(null);
          }}
          className={getButtonClass(currentTab === 'pdf-editor')}
        >
          <PenTool className={`size-3.5 ${currentTab === 'pdf-editor' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
          <span>Edit & Sign</span>
        </button>

        {/* 4. Organize Dropdown (Merge, Split, Page Studio) */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'organize' ? null : 'organize')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
              isOrganizeActive
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-bold'
                : openDropdown === 'organize'
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-300 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className={`size-3.5 ${isOrganizeActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
            <span>{isOrganizeActive ? `Organize: ${activeOrganizeItem?.label}` : 'Organize'}</span>
            <ChevronDown className={`size-3 transition-transform ${openDropdown === 'organize' ? 'rotate-180' : ''}`} />
          </button>

          {/* Organize Popover Menu */}
          {openDropdown === 'organize' && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-3 py-1 uppercase tracking-wider">
                Document Structure
              </div>
              {organizeItems.map((item) => {
                const ItemIcon = item.icon;
                const isSelected = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onTabChange(item.id);
                      setOpenDropdown(null);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center gap-3 transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-950 dark:text-blue-100 font-bold border border-blue-200 dark:border-blue-800'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <div className={`size-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      <ItemIcon className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold flex items-center justify-between">
                        <span>{item.label}</span>
                        {isSelected && <Check className="size-3.5 text-blue-600 dark:text-blue-400" />}
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 font-normal truncate mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 5. CAD to Blueprint Studio */}
        <button
          onClick={() => {
            onTabChange('cad-studio');
            setOpenDropdown(null);
          }}
          className={getButtonClass(currentTab === 'cad-studio')}
        >
          <Compass className={`size-3.5 ${currentTab === 'cad-studio' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
          <span>CAD Blueprint</span>
          <span className={`text-[9.5px] px-1 py-0.2 rounded font-mono font-bold uppercase ${
            currentTab === 'cad-studio' ? 'bg-blue-700 text-white' : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
          }`}>
            DXF
          </span>
        </button>

        {/* 6. Convert & OCR Dropdown */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'convert' ? null : 'convert')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
              isConvertActive
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-bold'
                : openDropdown === 'convert'
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-300 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <RefreshCcw className={`size-3.5 ${isConvertActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
            <span>{isConvertActive ? `Convert: ${activeConvertItem?.label}` : 'Convert & OCR'}</span>
            <ChevronDown className={`size-3 transition-transform ${openDropdown === 'convert' ? 'rotate-180' : ''}`} />
          </button>

          {/* Convert Popover Menu */}
          {openDropdown === 'convert' && (
            <div className="absolute top-full left-0 mt-2 w-76 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-3 py-1 uppercase tracking-wider">
                Document Conversion & OCR
              </div>
              {convertItems.map((item) => {
                const ItemIcon = item.icon;
                const isSelected = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onTabChange(item.id);
                      setOpenDropdown(null);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center gap-3 transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-950 dark:text-blue-100 font-bold border border-blue-200 dark:border-blue-800'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <div className={`size-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      <ItemIcon className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold flex items-center justify-between">
                        <span>{item.label}</span>
                        {isSelected && <Check className="size-3.5 text-blue-600 dark:text-blue-400" />}
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 font-normal truncate mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 7. Security & Watermark */}
        <button
          onClick={() => {
            onTabChange('pdf-security');
            setOpenDropdown(null);
          }}
          className={getButtonClass(currentTab === 'pdf-security')}
        >
          <ShieldCheck className={`size-3.5 ${currentTab === 'pdf-security' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
          <span>Security & Stamp</span>
        </button>
      </div>

      {/* RIGHT: CONTEXTUAL ACTIONS */}
      <div className="flex items-center gap-2 shrink-0">
        {currentTab !== 'all-tools' && (
          <button
            onClick={() => onTabChange('all-tools')}
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition font-bold text-xs flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 shadow-2xs cursor-pointer active:scale-95"
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
