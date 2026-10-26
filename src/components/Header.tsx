import React, { useState, useRef, useEffect } from 'react';
import { 
  Printer, 
  Crop, 
  Sparkles, 
  FileText, 
  CreditCard, 
  Layers,
  LogIn,
  Shield,
  ChevronDown,
  Clock,
  Home
} from 'lucide-react';
import type { PrintQueueItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { isAuthorizedAdmin } from '../utils/constants';
import { userStorageService } from '../services/userStorageService';

interface HeaderProps {
  activeTab: 'home' | 'scanner' | 'print' | 'passport' | 'admin';
  setActiveTab: (tab: 'home' | 'scanner' | 'print' | 'passport' | 'admin') => void;
  queue: PrintQueueItem[];
  onLoadSample: (type: 'id_front' | 'id_back' | 'paper') => void;
  onOpenRecents?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  queue,
  onLoadSample,
  onOpenRecents,
}) => {
  const { user, openAuthModal, logout } = useAuth();
  const isAdmin = isAuthorizedAdmin(user?.email);
  const [isSamplesOpen, setIsSamplesOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const recentsCount = userStorageService.getRecents(user?.id).length;

  const samplesRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (samplesRef.current && !samplesRef.current.contains(e.target as Node)) {
        setIsSamplesOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="no-print bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          
          {/* Logo & Brand */}
          <div 
            className="flex items-center gap-3 cursor-pointer shrink-0" 
            onClick={() => setActiveTab('home')}
          >
            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-1 shadow-xs ring-1 ring-slate-900/5 hover:scale-105 transition-transform">
              <img src="/logo.svg" alt="PrintMate Logo" className="w-8 h-8 object-contain drop-shadow-sm" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-slate-900">
                  PrintMate
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 tracking-wide">
                  STUDIO
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden md:block">
                Auto-Crop, Straighten & Multi-Layout Print Studio
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('home')}
              style={{
                backgroundColor: activeTab === 'home' ? '#2563eb' : 'transparent',
                color: activeTab === 'home' ? '#ffffff' : '#334155',
              }}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'home'
                  ? 'shadow-sm'
                  : 'hover:text-slate-900 hover:bg-slate-200/80'
              }`}
            >
              <Home className="w-4 h-4 shrink-0" />
              <span>Home</span>
            </button>

            <button
              onClick={() => setActiveTab('scanner')}
              style={{
                backgroundColor: activeTab === 'scanner' ? '#2563eb' : 'transparent',
                color: activeTab === 'scanner' ? '#ffffff' : '#334155',
              }}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'scanner'
                  ? 'shadow-sm'
                  : 'hover:text-slate-900 hover:bg-slate-200/80'
              }`}
            >
              <Crop className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Scan & Straighten</span>
              <span className="sm:hidden">Scan</span>
            </button>

            <button
              onClick={() => setActiveTab('print')}
              style={{
                backgroundColor: activeTab === 'print' ? '#2563eb' : 'transparent',
                color: activeTab === 'print' ? '#ffffff' : '#334155',
              }}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all relative cursor-pointer ${
                activeTab === 'print'
                  ? 'shadow-sm'
                  : 'hover:text-slate-900 hover:bg-slate-200/80'
              }`}
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Print Studio</span>
              <span className="sm:hidden">Print</span>
              {queue.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                  {queue.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('passport')}
              style={{
                backgroundColor: activeTab === 'passport' ? '#2563eb' : 'transparent',
                color: activeTab === 'passport' ? '#ffffff' : '#334155',
              }}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'passport'
                  ? 'shadow-sm'
                  : 'hover:text-slate-900 hover:bg-slate-200/80'
              }`}
            >
              <CreditCard className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Passport Maker</span>
              <span className="sm:hidden">Passport</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                style={{
                  backgroundColor: activeTab === 'admin' ? '#0f172a' : 'transparent',
                  color: activeTab === 'admin' ? '#ffffff' : '#334155',
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'admin'
                    ? 'shadow-sm'
                    : 'hover:text-slate-900 hover:bg-slate-200/80'
                }`}
                title="Studio Analytics & User Intelligence"
              >
                <Shield className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>Admin</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full font-extrabold bg-indigo-100 text-indigo-700">
                  PRO
                </span>
              </button>
            )}
          </nav>

          {/* Sample Loader & User Auth Quick Menu */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Recent Documents Quick Button */}
            {onOpenRecents && (
              <button
                type="button"
                onClick={onOpenRecents}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-all shadow-xs cursor-pointer"
                title="View your saved recent documents & scans"
              >
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">Recent Documents</span>
                <span className="sm:hidden">Recents</span>
                {recentsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                    {recentsCount}
                  </span>
                )}
              </button>
            )}

            {/* Demo Samples Dropdown */}
            <div className="relative" ref={samplesRef}>
              <button 
                type="button"
                onClick={() => setIsSamplesOpen(!isSamplesOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-all shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden md:inline">Try Demo Samples</span>
                <span className="md:hidden">Demo</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isSamplesOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isSamplesOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in">
                  <div className="px-3.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Test with 1-Click Samples
                  </div>
                  <button
                    onClick={() => { onLoadSample('id_front'); setActiveTab('scanner'); setIsSamplesOpen(false); }}
                    className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-blue-50/70 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">Slanted ID Card (Front)</div>
                      <div className="text-[10px] text-slate-500">Angled perspective on desk</div>
                    </div>
                  </button>
                  <button
                    onClick={() => { onLoadSample('id_back'); setActiveTab('scanner'); setIsSamplesOpen(false); }}
                    className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-emerald-50/70 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">ID Card (Back Side)</div>
                      <div className="text-[10px] text-slate-500">Barcode & details side</div>
                    </div>
                  </button>
                  <button
                    onClick={() => { onLoadSample('paper'); setActiveTab('scanner'); setIsSamplesOpen(false); }}
                    className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-amber-50/70 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">Paper Document / Certificate</div>
                      <div className="text-[10px] text-slate-500">A4 document sheet on table</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Auth Login / User Profile Menu */}
            {user ? (
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all text-xs text-slate-800 cursor-pointer shadow-xs"
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
                  <span className="font-semibold max-w-[100px] truncate hidden sm:inline">{user.name}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in">
                    <div className="px-3.5 py-2 border-b border-slate-100 mb-1">
                      <div className="text-xs font-bold text-slate-900 truncate">{user.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{user.email}</div>
                    </div>
                    {onOpenRecents && (
                      <button
                        onClick={() => { onOpenRecents(); setIsProfileOpen(false); }}
                        className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-blue-50/70 font-semibold flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-blue-600" />
                          <span>Recent Documents</span>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600">
                          {recentsCount}
                        </span>
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => { setActiveTab('admin'); setIsProfileOpen(false); }}
                        className="w-full text-left px-3.5 py-2 text-xs text-indigo-700 hover:bg-indigo-50 font-semibold flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <Shield className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Admin Analytics</span>
                      </button>
                    )}
                    <button
                      onClick={() => { logout(); setIsProfileOpen(false); }}
                      className="w-full text-left px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 font-semibold flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal()}
                style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl hover:bg-blue-500 text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer active:scale-95"
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
