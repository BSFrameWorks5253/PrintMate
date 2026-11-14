import React, { useState, useRef, useMemo } from 'react';
import {
  PenTool,
  Type,
  Layers,
  Scissors,
  Minimize2,
  FileDigit,
  Lock,
  Unlock,
  FileSpreadsheet,
  FileText,
  ScanText,
  Image as ImageIcon,
  Sparkles,
  Search,
  Wrench,
  RotateCw,
  UploadCloud,
  ArrowRight,
  CheckCircle2,
  FolderOpen,
  SlidersHorizontal
} from 'lucide-react';
import { NavigationTab } from '../../../types/converter';

interface PdfellaAllToolsHubProps {
  onSelectTool: (tab: NavigationTab) => void;
}

interface ToolCard {
  id: string;
  name: string;
  badge: string;
  badgeColor: string;
  description: string;
  category: 'edit' | 'organise' | 'convert' | 'optimise' | 'security';
  icon: React.ComponentType<{ className?: string }>;
  targetTab: NavigationTab;
  gradient: string;
  iconColor: string;
  tags: string[];
}

export const PdfellaAllToolsHub: React.FC<PdfellaAllToolsHubProps> = ({
  onSelectTool
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'edit' | 'organise' | 'convert' | 'optimise' | 'security'>('all');
  const [dragActive, setDragActive] = useState(false);
  const [detectedFile, setDetectedFile] = useState<{
    name: string;
    size: number;
    ext: string;
    type: 'pdf' | 'office' | 'image' | 'multi';
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const allTools: ToolCard[] = useMemo(() => [
    // 1. EDIT & SIGN
    {
      id: 'edit-pdf',
      name: 'Edit PDF',
      badge: 'EDITOR',
      badgeColor: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
      description: 'Add text blocks, vectors, shapes, whiteout redactions, and stamps directly on PDF pages.',
      category: 'edit',
      icon: Type,
      targetTab: 'pdf-editor',
      gradient: 'from-sky-500 to-blue-600',
      iconColor: 'text-white',
      tags: ['In-Place Edit', 'Freehand Pen', 'Shapes']
    },
    {
      id: 'sign-pdf',
      name: 'Sign & Certify',
      badge: 'SIGNATURE',
      badgeColor: 'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800',
      description: 'Draw freehand digital signatures, type cursive scripts, or place transparent e-signature stamps.',
      category: 'edit',
      icon: PenTool,
      targetTab: 'pdf-editor',
      gradient: 'from-violet-500 to-purple-600',
      iconColor: 'text-white',
      tags: ['Digital Pad', 'Cursive', 'Transparent Stamp']
    },
    {
      id: 'whiteout-pdf',
      name: 'Whiteout & Redact',
      badge: 'REDACTION',
      badgeColor: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      description: 'Permanently mask confidential figures, private text, and account details with crisp whiteouts.',
      category: 'edit',
      icon: Sparkles,
      targetTab: 'pdf-editor',
      gradient: 'from-rose-500 to-pink-600',
      iconColor: 'text-white',
      tags: ['Permanent Mask', 'Cover-Up', 'Security']
    },

    // 2. ORGANISE
    {
      id: 'merge-pdf',
      name: 'Merge & Fusion',
      badge: 'FUSION',
      badgeColor: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      description: 'Combine multiple PDFs or mixed formats (Word, Excel, Photos) into one publication.',
      category: 'organise',
      icon: Layers,
      targetTab: 'pdf-merge',
      gradient: 'from-emerald-500 to-teal-600',
      iconColor: 'text-white',
      tags: ['Multi-Document', 'Custom Sequence', 'Universal']
    },
    {
      id: 'split-pdf',
      name: 'Split & Extract',
      badge: 'SPLITTER',
      badgeColor: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      description: 'Extract specific page ranges, split each page into standalone files, or divide into chunks.',
      category: 'organise',
      icon: Scissors,
      targetTab: 'pdf-split',
      gradient: 'from-amber-500 to-orange-600',
      iconColor: 'text-white',
      tags: ['Page Ranges', 'Split All to ZIP', 'Intervals']
    },
    {
      id: 'organize-pages',
      name: 'Page Studio',
      badge: 'PAGES',
      badgeColor: 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
      description: 'Visual light-table grid to drag-and-drop reorder, rotate 90°, delete, and duplicate pages.',
      category: 'organise',
      icon: RotateCw,
      targetTab: 'pdf-organizer',
      gradient: 'from-teal-500 to-cyan-600',
      iconColor: 'text-white',
      tags: ['Thumbnail Grid', 'Rotate 90°', 'Duplicate']
    },
    {
      id: 'page-numbers',
      name: 'Page Numbers & Header',
      badge: 'NUMBERING',
      badgeColor: 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
      description: 'Stamp dynamic header and footer page numbers with customizable positions, offsets, and fonts.',
      category: 'organise',
      icon: FileDigit,
      targetTab: 'pdf-security',
      gradient: 'from-cyan-500 to-blue-600',
      iconColor: 'text-white',
      tags: ['Page X of Y', 'Headers', 'Bates Stamping']
    },

    // 3. CONVERT
    {
      id: 'office-to-pdf',
      name: 'Office to PDF',
      badge: 'BATCH OFFICE',
      badgeColor: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      description: 'Convert Microsoft Word (.docx) and Excel (.xlsx) spreadsheets directly into clean PDFs.',
      category: 'convert',
      icon: FileSpreadsheet,
      targetTab: 'office-suite',
      gradient: 'from-blue-600 to-indigo-700',
      iconColor: 'text-white',
      tags: ['Word (.docx)', 'Excel (.xlsx)', '1-to-1 Batch']
    },
    {
      id: 'images-to-pdf',
      name: 'Photos to PDF Album',
      badge: 'GALLERY',
      badgeColor: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      description: 'Sequence JPG, PNG, and WEBP photos in exact order with multi-up layout and scan filters.',
      category: 'convert',
      icon: ImageIcon,
      targetTab: 'image-gallery',
      gradient: 'from-purple-500 to-fuchsia-600',
      iconColor: 'text-white',
      tags: ['High-Res 300 DPI', 'Multi-Photo', 'Margin Fit']
    },
    {
      id: 'pdf-to-docx',
      name: 'PDF to Word (.docx)',
      badge: 'REVERSE WORD',
      badgeColor: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
      description: 'Deconstruct PDF layouts and extract editable text directly into native Microsoft Word documents.',
      category: 'convert',
      icon: FileText,
      targetTab: 'reverse-suite',
      gradient: 'from-sky-600 to-blue-700',
      iconColor: 'text-white',
      tags: ['Editable .docx', 'Text Flow', 'Offline']
    },
    {
      id: 'pdf-to-excel',
      name: 'PDF to Excel (.xlsx)',
      badge: 'TABLES',
      badgeColor: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      description: 'Detect financial tables and tabular grids inside PDFs to export native Excel spreadsheets.',
      category: 'convert',
      icon: FileSpreadsheet,
      targetTab: 'reverse-suite',
      gradient: 'from-emerald-600 to-teal-700',
      iconColor: 'text-white',
      tags: ['Grid Detection', 'Native .xlsx', 'Financials']
    },
    {
      id: 'pdf-to-jpg',
      name: 'PDF to High-Res Images',
      badge: 'RENDER 300 DPI',
      badgeColor: 'bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800',
      description: 'Render every PDF page into crystal-clear 300 DPI JPG and PNG images with single or ZIP export.',
      category: 'convert',
      icon: ImageIcon,
      targetTab: 'reverse-suite',
      gradient: 'from-pink-500 to-rose-600',
      iconColor: 'text-white',
      tags: ['300 DPI', 'PNG & JPG', 'ZIP Archive']
    },

    // 4. OPTIMISE & OCR
    {
      id: 'size-reducer-hub',
      name: 'Govt Size Reducer',
      badge: 'UPSC / SSC / NEET',
      badgeColor: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      description: 'Clamp file sizes to exact KB limits (20KB, 50KB, 100KB, 200KB) for government portal application forms.',
      category: 'optimise',
      icon: SlidersHorizontal,
      targetTab: 'size-reducer',
      gradient: 'from-blue-600 to-indigo-600',
      iconColor: 'text-white',
      tags: ['Size Reducer', 'Govt Portal', 'UPSC', 'SSC', 'NEET', 'KB Clamp']
    },
    {
      id: 'compress-pdf',
      name: 'Compress PDF',
      badge: 'OPTIMISE',
      badgeColor: 'bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
      description: 'Dramatically reduce file size while preserving high visual clarity and crisp readable typography.',
      category: 'optimise',
      icon: Minimize2,
      targetTab: 'pdf-security',
      gradient: 'from-green-500 to-emerald-600',
      iconColor: 'text-white',
      tags: ['Smart Compress', 'Lossless Text', 'Email Ready']
    },
    {
      id: 'ocr-pdf',
      name: 'OCR Scanned PDF',
      badge: 'OFFLINE OCR',
      badgeColor: 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
      description: 'Offline optical character recognition via Tesseract to extract selectable text from scans.',
      category: 'optimise',
      icon: ScanText,
      targetTab: 'reverse-suite',
      gradient: 'from-cyan-600 to-teal-700',
      iconColor: 'text-white',
      tags: ['100% Offline', 'Scanned Docs', 'Searchable']
    },
    {
      id: 'repair-pdf',
      name: 'Repair PDF',
      badge: 'RECOVERY',
      badgeColor: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      description: 'Rebuild damaged cross-reference xref tables and recover corrupted document streams.',
      category: 'optimise',
      icon: Wrench,
      targetTab: 'pdf-security',
      gradient: 'from-amber-500 to-yellow-600',
      iconColor: 'text-white',
      tags: ['Fix Damaged', 'Rebuild Xref', 'Recover']
    },

    // 5. SECURITY
    {
      id: 'protect-pdf',
      name: 'Protect & Encrypt',
      badge: 'ENCRYPTION',
      badgeColor: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      description: 'Lock documents with user passwords and AES encryption to prevent unauthorized printing.',
      category: 'security',
      icon: Lock,
      targetTab: 'pdf-security',
      gradient: 'from-slate-700 to-slate-900',
      iconColor: 'text-white',
      tags: ['AES Encryption', 'User Password', 'Permissions']
    },
    {
      id: 'unlock-pdf',
      name: 'Unlock PDF',
      badge: 'PERMISSIONS',
      badgeColor: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      description: 'Remove password restrictions, printing blocks, and editing constraints from authorized files.',
      category: 'security',
      icon: Unlock,
      targetTab: 'pdf-security',
      gradient: 'from-blue-600 to-indigo-700',
      iconColor: 'text-white',
      tags: ['Remove Lock', 'Enable Printing', 'Unlock Form']
    }
  ], []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const processDroppedFiles = (files: FileList) => {
    if (files.length === 0) return;
    if (files.length > 1) {
      setDetectedFile({
        name: `${files.length} files dropped`,
        size: Array.from(files).reduce((acc, f) => acc + f.size, 0),
        ext: 'multi',
        type: 'multi'
      });
      return;
    }

    const file = files[0];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    let type: 'pdf' | 'office' | 'image' | 'multi' = 'pdf';

    if (ext === 'pdf') type = 'pdf';
    else if (['docx', 'xlsx', 'xls', 'pptx'].includes(ext)) type = 'office';
    else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) type = 'image';

    setDetectedFile({
      name: file.name,
      size: file.size,
      ext: ext.toUpperCase(),
      type
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processDroppedFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processDroppedFiles(e.target.files);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredTools = useMemo(() => {
    return allTools.filter((t) => {
      const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
      const matchesSearch =
        searchQuery.trim() === '' ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [allTools, selectedCategory, searchQuery]);

  const categories = useMemo(() => [
    { id: 'all' as const, label: 'All Tools', count: allTools.length },
    { id: 'edit' as const, label: 'Edit & Sign', count: allTools.filter(t => t.category === 'edit').length },
    { id: 'organise' as const, label: 'Organise', count: allTools.filter(t => t.category === 'organise').length },
    { id: 'convert' as const, label: 'Convert', count: allTools.filter(t => t.category === 'convert').length },
    { id: 'optimise' as const, label: 'Optimise & OCR', count: allTools.filter(t => t.category === 'optimise').length },
    { id: 'security' as const, label: 'Security', count: allTools.filter(t => t.category === 'security').length }
  ], [allTools]);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 select-none overflow-y-auto custom-scrollbar font-sans transition-colors duration-200">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        multiple
        className="hidden"
        accept=".pdf,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.txt"
      />

      <div className="max-w-7xl mx-auto w-full px-6 py-8 md:px-10 md:py-10 space-y-8">
        
        {/* TOP BRAND HERO */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span className="size-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span className="font-extrabold text-slate-900 dark:text-white tracking-tight">PrintMate Utility</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">v1.0.0</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-blue-600 dark:text-blue-400 font-medium">Precision Document Engine</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            Universal Document & PDF Utility Suite
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
            In-place vector PDF editing, Govt size reduction, format conversion, page organization, and 100% offline client-side privacy.
          </p>
        </div>

        {/* ⚡ INSTANT ACTION SMART DROPZONE */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative rounded-3xl border-2 transition-all duration-200 p-6 md:p-8 bg-white dark:bg-slate-900 shadow-xs ${
            dragActive
              ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 ring-4 ring-blue-500/10 scale-[1.005]'
              : 'border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
          }`}
        >
          {!detectedFile ? (
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-5 text-left">
                <div className="size-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-800 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400 shadow-xs">
                  <UploadCloud className="size-8" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Quick Document Dropzone
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 md:flex-none px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-blue-500 transition shadow-md shadow-blue-600/20 cursor-pointer active:scale-95"
                >
                  <FolderOpen className="size-4" />
                  Browse Files...
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTool('workspace')}
                  className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Multi-Batch Hub →
                </button>
              </div>
            </div>
          ) : (
            /* DETECTED FILE ACTION DOCK */
            <div className="flex flex-col md:flex-row items-center justify-between gap-5 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-4 text-left w-full md:w-auto">
                <div className="size-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-md shadow-blue-600/20">
                  {detectedFile.ext}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-xs md:max-w-md">
                      {detectedFile.name}
                    </h4>
                    <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                      ({formatSize(detectedFile.size)})
                    </span>
                  </div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="size-3.5" /> Ready for instant processing
                  </p>
                </div>
              </div>

              {/* CONTEXTUAL ACTION BUTTONS */}
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                {detectedFile.type === 'pdf' && (
                  <>
                    <button
                      type="button"
                      onClick={() => onSelectTool('pdf-editor')}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <PenTool className="size-3.5" /> Edit & Sign
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectTool('pdf-organizer')}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                    >
                      Page Studio
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectTool('reverse-suite')}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                    >
                      Convert to Word/Excel
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectTool('pdf-security')}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                    >
                      Compress / Protect
                    </button>
                  </>
                )}

                {detectedFile.type === 'office' && (
                  <button
                    type="button"
                    onClick={() => onSelectTool('office-suite')}
                    className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <FileSpreadsheet className="size-4" /> Convert to Master PDF →
                  </button>
                )}

                {detectedFile.type === 'image' && (
                  <button
                    type="button"
                    onClick={() => onSelectTool('image-gallery')}
                    className="px-5 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <ImageIcon className="size-4" /> Photos to PDF Album →
                  </button>
                )}

                {detectedFile.type === 'multi' && (
                  <button
                    type="button"
                    onClick={() => onSelectTool('workspace')}
                    className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Layers className="size-4" /> Universal Fusion Merger →
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setDetectedFile(null)}
                  className="px-3 py-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs transition cursor-pointer"
                  title="Clear file"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SEARCH & CATEGORY FILTER BAR */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3 transition-colors">
          {/* Live Search Input */}
          <div className="relative w-full md:w-88">
            <Search className="size-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tools (e.g. sign, word, split, ocr)..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto custom-scrollbar pb-1 md:pb-0">
            {categories.map((cat) => (
              <button
                type="button"
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  selectedCategory === cat.id ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}>
                  {cat.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* TOOL CARDS (Keyed container prevents React virtual DOM removeChild errors) */}
        <div 
          key={`${selectedCategory}-${searchQuery}`}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pb-16"
        >
          {filteredTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.id}
                onClick={() => onSelectTool(tool.targetTab)}
                className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs hover:shadow-xl hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200 cursor-pointer flex flex-col justify-between hover:-translate-y-1"
              >
                <div>
                  {/* Top Row: Icon + Category Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <div className={`size-11 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center shadow-xs transition-transform duration-200 group-hover:scale-110`}>
                      <Icon className="size-5 text-white" />
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border tracking-wider uppercase ${tool.badgeColor}`}>
                      {tool.badge}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {tool.name}
                  </h3>

                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1.5">
                    {tool.description}
                  </p>
                </div>

                {/* Bottom Row: Feature Tags + Launch Arrow */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    {tool.tags.slice(0, 2).map((tag, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 shrink-0"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform flex items-center gap-1 shrink-0 ml-2">
                    Open <ArrowRight className="size-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* EMPTY SEARCH STATE */}
        {filteredTools.length === 0 && (
          <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <Search className="size-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No matching tools found for "{searchQuery}"</h4>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
              Try searching for common terms like "sign", "word", "excel", or "merge".
            </p>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
              className="mt-4 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
