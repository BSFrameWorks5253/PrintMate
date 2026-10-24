import React from 'react';
import { 
  Printer, 
  Crop, 
  Sparkles, 
  FileText, 
  CreditCard, 
  Layers
} from 'lucide-react';
import type { PrintQueueItem } from '../types';

interface HeaderProps {
  activeTab: 'scanner' | 'print' | 'passport';
  setActiveTab: (tab: 'scanner' | 'print' | 'passport') => void;
  queue: PrintQueueItem[];
  onLoadSample: (type: 'id_front' | 'id_back' | 'paper') => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  queue,
  onLoadSample,
}) => {
  return (
    <header className="no-print bg-[#161b22] border-b border-[#30363d] sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('scanner')}>
            <div className="w-10 h-10 rounded-xl bg-[#0f172a] border border-cyan-500/30 flex items-center justify-center p-1 shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-500/20 hover:scale-105 transition-transform">
              <img src="/logo.svg" alt="PrintMate Logo" className="w-8 h-8 object-contain drop-shadow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white via-cyan-100 to-cyan-300 bg-clip-text text-transparent">
                  PrintMate
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 tracking-wide">
                  PRO STUDIO
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Auto-Crop, Straighten & Multi-Layout Print Studio
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1.5 bg-[#0d1117] p-1 rounded-xl border border-[#30363d]">
            <button
              onClick={() => setActiveTab('scanner')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'scanner'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-[#21262d]'
              }`}
            >
              <Crop className="w-4 h-4" />
              <span>Scan & Straighten</span>
            </button>

            <button
              onClick={() => setActiveTab('print')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all relative ${
                activeTab === 'print'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-[#21262d]'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>Print Studio</span>
              {queue.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-black">
                  {queue.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('passport')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'passport'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-[#21262d]'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Passport Maker</span>
            </button>
          </nav>

          {/* Sample Loader Quick Menu */}
          <div className="flex items-center gap-2">
            <div className="relative group">
              <button 
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-slate-200 text-xs font-medium border border-[#30363d] transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">Try Demo Samples</span>
                <span className="md:hidden">Demo</span>
              </button>
              
              <div className="absolute right-0 mt-2 w-56 bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl py-2 hidden group-hover:block hover:block z-50 backdrop-blur-md">
                <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Test with 1-Click Samples
                </div>
                <button
                  onClick={() => { onLoadSample('id_front'); setActiveTab('scanner'); }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-[#21262d] flex items-center gap-2"
                >
                  <CreditCard className="w-4 h-4 text-blue-400" />
                  <div>
                    <div className="font-medium">Slanted ID Card (Front)</div>
                    <div className="text-[10px] text-slate-400">Desk background with angle tilt</div>
                  </div>
                </button>
                <button
                  onClick={() => { onLoadSample('id_back'); setActiveTab('scanner'); }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-[#21262d] flex items-center gap-2"
                >
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="font-medium">ID Card (Back Side)</div>
                    <div className="text-[10px] text-slate-400">Barcode & signature side</div>
                  </div>
                </button>
                <button
                  onClick={() => { onLoadSample('paper'); setActiveTab('scanner'); }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-[#21262d] flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-amber-400" />
                  <div>
                    <div className="font-medium">Paper Document / Certificate</div>
                    <div className="text-[10px] text-slate-400">A4 paper on dark table</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
