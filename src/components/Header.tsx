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
  Home,
  Download,
  WifiOff,
  Monitor,
  X,
  CheckCircle2,
  HardDrive,
  Sun,
  Moon,
  ExternalLink,
  Menu
} from 'lucide-react';
import type { PrintQueueItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { isAuthorizedAdmin } from '../utils/constants';
import { userStorageService } from '../services/userStorageService';
import { usePwaInstall } from '../hooks/usePwaInstall';

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
  const { toggleTheme, isDark } = useTheme();
  const isAdmin = isAuthorizedAdmin(user?.email);
  const [isSamplesOpen, setIsSamplesOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { canInstall, isInstalled, isOnline, isElectron, promptInstall } = usePwaInstall();
  const recentsCount = userStorageService.getRecents(user?.id).length;

  const handleInstallClick = async () => {
    if (canInstall) {
      const installed = await promptInstall();
      if (!installed) {
        setIsInstallModalOpen(true);
      }
    } else {
      setIsInstallModalOpen(true);
    }
  };

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
    <header className="no-print bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 shadow-xs transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          
          {/* Logo & Brand */}
          <div 
            className="flex items-center gap-3 cursor-pointer shrink-0" 
            onClick={() => setActiveTab('home')}
          >
            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1 shadow-xs ring-1 ring-slate-900/5 hover:scale-105 transition-transform">
              <img src="/logo.svg" alt="PrintMate Logo" className="w-8 h-8 object-contain drop-shadow-sm" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-slate-900 dark:text-white">
                  PrintMate
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 tracking-wide">
                  STUDIO
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden md:block">
                Auto-Crop, Straighten & Multi-Layout Print Studio
              </p>
            </div>
          </div>

          {/* Navigation Tabs (Desktop & Tablet) */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('home')}
              style={{
                backgroundColor: activeTab === 'home' ? '#2563eb' : 'transparent',
                color: activeTab === 'home' ? '#ffffff' : isDark ? '#e2e8f0' : '#334155',
              }}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'home'
                  ? 'shadow-sm'
                  : 'hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-slate-700/80'
              }`}
            >
              <Home className="w-4 h-4 shrink-0" />
              <span>Home</span>
            </button>

            <button
              onClick={() => setActiveTab('scanner')}
              style={{
                backgroundColor: activeTab === 'scanner' ? '#2563eb' : 'transparent',
                color: activeTab === 'scanner' ? '#ffffff' : isDark ? '#e2e8f0' : '#334155',
              }}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'scanner'
                  ? 'shadow-sm'
                  : 'hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-slate-700/80'
              }`}
            >
              <Crop className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Scan & Edit</span>
              <span className="sm:hidden">Edit</span>
            </button>

            <button
              onClick={() => setActiveTab('print')}
              style={{
                backgroundColor: activeTab === 'print' ? '#2563eb' : 'transparent',
                color: activeTab === 'print' ? '#ffffff' : isDark ? '#e2e8f0' : '#334155',
              }}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all relative cursor-pointer ${
                activeTab === 'print'
                  ? 'shadow-sm'
                  : 'hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-slate-700/80'
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
                color: activeTab === 'passport' ? '#ffffff' : isDark ? '#e2e8f0' : '#334155',
              }}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'passport'
                  ? 'shadow-sm'
                  : 'hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-slate-700/80'
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
                  backgroundColor: activeTab === 'admin' ? (isDark ? '#312e81' : '#0f172a') : 'transparent',
                  color: activeTab === 'admin' ? '#ffffff' : isDark ? '#e2e8f0' : '#334155',
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'admin'
                    ? 'shadow-sm'
                    : 'hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-slate-700/80'
                }`}
                title="Studio Analytics & User Intelligence"
              >
                <Shield className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>Admin</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full font-extrabold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                  PRO
                </span>
              </button>
            )}
          </nav>

          {/* Controls: Offline Status, Install App, Dark Mode, Samples & Auth */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Offline Status Badge */}
            {!isOnline && (
              <div 
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 text-xs font-semibold shrink-0" 
                title="No internet connection detected. Working in 100% offline local mode."
              >
                <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="hidden sm:inline">Offline Mode</span>
              </div>
            )}

            {/* Desktop / PWA Download & Install Button */}
            {isElectron ? (
              <div 
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold shrink-0" 
                title="Running as Native Desktop Application"
              >
                <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden md:inline">Desktop App</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleInstallClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0"
                title="Download Windows .EXE or Install PWA Offline App"
              >
                <Download className="w-3.5 h-3.5 text-cyan-200" />
                <span className="hidden lg:inline">Download App</span>
                <span className="lg:hidden hidden sm:inline">Download</span>
                <span className="sm:hidden">App</span>
              </button>
            )}

            {/* Dark Mode Toggle Switch */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-2xs flex items-center justify-center shrink-0"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle Dark Mode"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600 hover:-rotate-12 transition-transform" />
              )}
            </button>

            {/* Recent Documents Quick Button (Visible on screens >= 768px) */}
            {onOpenRecents && (
              <button
                type="button"
                onClick={onOpenRecents}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-all shadow-xs cursor-pointer"
                title="View your saved recent documents & scans"
              >
                <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="hidden lg:inline">Recent Documents</span>
                <span className="lg:hidden">Recents</span>
                {recentsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                    {recentsCount}
                  </span>
                )}
              </button>
            )}

            {/* Demo Samples Dropdown (Visible on screens >= 768px) */}
            <div className="relative hidden md:block" ref={samplesRef}>
              <button 
                type="button"
                onClick={() => setIsSamplesOpen(!isSamplesOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-all shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden md:inline">Demo</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isSamplesOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isSamplesOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in">
                  <div className="px-3.5 py-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Test with 1-Click Samples
                  </div>
                  <button
                    onClick={() => { onLoadSample('id_front'); setActiveTab('scanner'); setIsSamplesOpen(false); }}
                    className="w-full text-left px-3.5 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-blue-50/70 dark:hover:bg-blue-950/40 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">Slanted ID Card (Front)</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Angled perspective on desk</div>
                    </div>
                  </button>
                  <button
                    onClick={() => { onLoadSample('id_back'); setActiveTab('scanner'); setIsSamplesOpen(false); }}
                    className="w-full text-left px-3.5 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">ID Card (Back Side)</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Barcode & details side</div>
                    </div>
                  </button>
                  <button
                    onClick={() => { onLoadSample('paper'); setActiveTab('scanner'); setIsSamplesOpen(false); }}
                    className="w-full text-left px-3.5 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-amber-50/70 dark:hover:bg-amber-950/40 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">Paper Document / Certificate</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">A4 document sheet on table</div>
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
                  className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all text-xs text-slate-800 dark:text-slate-200 cursor-pointer shadow-xs"
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-6 h-6 rounded-full object-cover border border-white dark:border-slate-700"
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
                  <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in">
                    <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-700 mb-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{user.name}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{user.email}</div>
                    </div>
                    {onOpenRecents && (
                      <button
                        onClick={() => { onOpenRecents(); setIsProfileOpen(false); }}
                        className="w-full text-left px-3.5 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-blue-50/70 dark:hover:bg-blue-950/40 font-semibold flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Recent Documents</span>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {recentsCount}
                        </span>
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => { setActiveTab('admin'); setIsProfileOpen(false); }}
                        className="w-full text-left px-3.5 py-2 text-xs text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-semibold flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <Shield className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Admin Analytics</span>
                      </button>
                    )}
                    <button
                      onClick={() => { logout(); setIsProfileOpen(false); }}
                      className="w-full text-left px-3.5 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold flex items-center gap-2 cursor-pointer transition-colors"
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
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl hover:bg-blue-500 text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer active:scale-95 shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}

            {/* Mobile Menu Toggle Button (Visible on screens < 768px) */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-2xs flex items-center justify-center shrink-0"
              title="Toggle Menu"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-4 h-4 text-rose-500" />
              ) : (
                <div className="relative">
                  <Menu className="w-4 h-4" />
                  {queue.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500" />
                  )}
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer (When hamburger menu is tapped on phones/tablets) */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white/98 dark:bg-slate-900/98 backdrop-blur-md px-4 py-3 space-y-3 animate-in slide-in-from-top-2 shadow-xl">
          {/* Quick Action Links */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { handleInstallClick(); setIsMobileMenuOpen(false); }}
              className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-cyan-200" />
              <span>Download App</span>
            </button>

            {onOpenRecents && (
              <button
                type="button"
                onClick={() => { onOpenRecents(); setIsMobileMenuOpen(false); }}
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer"
              >
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Recents ({recentsCount})</span>
              </button>
            )}
          </div>

          {/* 1-Click Samples on Mobile */}
          <div className="pt-1">
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
              1-Click Demo Samples
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => { onLoadSample('id_front'); setActiveTab('scanner'); setIsMobileMenuOpen(false); }}
                className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[11px] font-semibold text-center cursor-pointer"
              >
                ID Front
              </button>
              <button
                type="button"
                onClick={() => { onLoadSample('id_back'); setActiveTab('scanner'); setIsMobileMenuOpen(false); }}
                className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold text-center cursor-pointer"
              >
                ID Back
              </button>
              <button
                type="button"
                onClick={() => { onLoadSample('paper'); setActiveTab('scanner'); setIsMobileMenuOpen(false); }}
                className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-[11px] font-semibold text-center cursor-pointer"
              >
                Paper Doc
              </button>
            </div>
          </div>

          {/* Admin link on mobile if authorized */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => { setActiveTab('admin'); setIsMobileMenuOpen(false); }}
              className="w-full p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-500" />
                <span>Admin Analytics & Telemetry</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-indigo-600 text-white">PRO</span>
            </button>
          )}
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (Phones & Tablets < 768px) */}
      <nav className="md:hidden no-print fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-lg">
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'home'
              ? 'text-blue-600 dark:text-blue-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Home</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('scanner')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'scanner'
              ? 'text-blue-600 dark:text-blue-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Crop className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Scan & Edit</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('print')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl relative transition-all cursor-pointer ${
            activeTab === 'print'
              ? 'text-blue-600 dark:text-blue-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Printer className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Print Studio</span>
          {queue.length > 0 && (
            <span className="absolute top-0 right-2 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500 text-white">
              {queue.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('passport')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'passport'
              ? 'text-blue-600 dark:text-blue-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <CreditCard className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Passport</span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
              activeTab === 'admin'
                ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Shield className="w-5 h-5 mb-0.5 text-indigo-500" />
            <span className="text-[10px]">Admin</span>
          </button>
        )}
      </nav>

      {/* Desktop & Offline App Download Modal */}
      {isInstallModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 max-w-2xl w-full shadow-2xl relative space-y-6 animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setIsInstallModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3.5 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/30 shrink-0">
                <Download className="w-6 h-6 text-cyan-200" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  Download PrintMate for Offline Use
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Choose your preferred option: Native Windows installer (.EXE) or instant Browser PWA app.
                </p>
              </div>
            </div>

            {/* Dual Download Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Option A: Windows .EXE Standalone Installer */}
              <div className="border-2 border-blue-600/30 dark:border-blue-500/40 bg-blue-50/40 dark:bg-blue-950/20 rounded-2xl p-5 flex flex-col justify-between relative group hover:border-blue-600 dark:hover:border-blue-400 transition-all shadow-xs">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-blue-600 text-white tracking-wider">
                      Recommended for PC
                    </span>
                    <span className="text-[11px] font-mono text-blue-700 dark:text-blue-300 font-bold">
                      124 MB
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 pt-1">
                    <div className="p-2 rounded-xl bg-blue-600 text-white shrink-0">
                      <Monitor className="w-5 h-5 text-cyan-200" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Windows Desktop .EXE</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Standalone Setup Installer</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Install PrintMate as a standalone Windows program with desktop shortcut, native printer driver communication, and zero browser tab overhead.
                  </p>

                  <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 pt-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span>Windows 10 / 11 (64-bit)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span>100% Offline (No Internet Needed)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span>Direct high-res printer rendering</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-4 space-y-2">
                  <a
                    href="/downloads/PrintMate-Setup.exe"
                    download="PrintMate-Setup.exe"
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/30 transition-all cursor-pointer text-center"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Windows .EXE</span>
                  </a>
                  <div className="text-center">
                    <a
                      href="https://github.com/BSFrameWorks5253/PrintMate/releases"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      <span>Also on GitHub Releases</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Option B: PWA Offline Web App */}
              <div className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-xs">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 tracking-wider">
                      Zero Storage Download
                    </span>
                    <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      Instant
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 pt-1">
                    <div className="p-2 rounded-xl bg-slate-900 dark:bg-slate-950 text-white shrink-0 border border-slate-800">
                      <HardDrive className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">PWA Offline Web App</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Chrome, Edge & Brave</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Instantly pin PrintMate to your desktop and taskbar directly from your browser. Launches in a dedicated window and works fully offline.
                  </p>

                  <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 pt-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Zero disk download size</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Works 100% offline via Service Worker</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Auto-updates automatically</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-4">
                  {canInstall ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await promptInstall();
                        setIsInstallModalOpen(false);
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-emerald-400 dark:text-white" />
                      <span>Install PWA Offline App</span>
                    </button>
                  ) : isInstalled ? (
                    <div className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold text-xs border border-emerald-200 dark:border-emerald-800 flex items-center justify-center gap-1.5 text-center">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>PWA Already Installed</span>
                    </div>
                  ) : (
                    <div className="w-full py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 text-[11px] border border-slate-200 dark:border-slate-600 text-center">
                      Click the <strong>Install</strong> icon in your browser's address bar (top-right)
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Offline Privacy Notice */}
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
              <span><strong>100% Local Privacy:</strong> Both the .EXE and PWA run edge-detection and canvas rendering locally inside your device. No documents are uploaded to cloud servers.</span>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setIsInstallModalOpen(false)}
                className="px-6 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer border border-transparent dark:border-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
