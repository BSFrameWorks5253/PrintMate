import React from 'react';
import { 
  Printer, 
  Crop, 
  Sparkles, 
  FileText, 
  CreditCard, 
  Layers,
  LogIn
} from 'lucide-react';
import type { PrintQueueItem } from '../types';
import { useAuth } from '../context/AuthContext';

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
  const { user, openAuthModal, logout } = useAuth();
  return (
    <header className="no-print bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('scanner')}>
            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-1 shadow-xs ring-1 ring-slate-900/5 hover:scale-105 transition-transform">
              <img src="/logo.svg" alt="PrintMate Logo" className="w-8 h-8 object-contain drop-shadow-sm" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xl tracking-tight text-slate-900">
                  PrintMate
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 tracking-wide">
                  PRO STUDIO
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Auto-Crop, Straighten & Multi-Layout Print Studio
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('scanner')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'scanner'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <Crop className="w-4 h-4" />
              <span>Scan & Straighten</span>
            </button>

            <button
              onClick={() => setActiveTab('print')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all relative ${
                activeTab === 'print'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>Print Studio</span>
              {queue.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                  {queue.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('passport')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'passport'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Passport Maker</span>
            </button>
          </nav>

          {/* Sample Loader & User Auth Quick Menu */}
          <div className="flex items-center gap-2">
            <div className="relative group">
              <button 
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium border border-slate-200 transition-all shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden md:inline">Try Demo Samples</span>
                <span className="md:hidden">Demo</span>
              </button>
              
              <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl py-2 hidden group-hover:block hover:block z-50">
                <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Test with 1-Click Samples
                </div>
                <button
                  onClick={() => { onLoadSample('id_front'); setActiveTab('scanner'); }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <CreditCard className="w-4 h-4 text-blue-500" />
                  <div>
                    <div className="font-medium text-slate-900">Slanted ID Card (Front)</div>
                    <div className="text-[10px] text-slate-500">Desk background with angle tilt</div>
                  </div>
                </button>
                <button
                  onClick={() => { onLoadSample('id_back'); setActiveTab('scanner'); }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Layers className="w-4 h-4 text-emerald-500" />
                  <div>
                    <div className="font-medium text-slate-900">ID Card (Back Side)</div>
                    <div className="text-[10px] text-slate-500">Barcode & signature side</div>
                  </div>
                </button>
                <button
                  onClick={() => { onLoadSample('paper'); setActiveTab('scanner'); }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-amber-500" />
                  <div>
                    <div className="font-medium text-slate-900">Paper Document / Certificate</div>
                    <div className="text-[10px] text-slate-500">A4 paper on dark table</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Auth Login / User Profile Menu */}
            {user ? (
              <div className="relative group">
                <button
                  type="button"
                  className="flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all text-xs text-slate-800"
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-6 h-6 rounded-full object-cover border border-white"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="font-medium max-w-[100px] truncate hidden sm:inline">{user.name}</span>
                </button>

                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-2 hidden group-hover:block hover:block z-50">
                  <div className="px-3 py-1.5 border-b border-slate-100 mb-1">
                    <div className="text-xs font-bold text-slate-900 truncate">{user.name}</div>
                    <div className="text-[10px] text-slate-500 truncate">{user.email}</div>
                  </div>
                  <button
                    onClick={() => logout()}
                    className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 font-medium flex items-center gap-2"
                  >
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={openAuthModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition-all"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
