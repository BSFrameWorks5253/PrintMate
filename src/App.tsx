import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ScannerView } from './components/Scanner/ScannerView';
import { PrintStudioView } from './components/PrintStudio/PrintStudioView';
import { PassportMakerView } from './components/PassportMaker/PassportMakerView';
import { AdminDashboard } from './components/Admin/AdminDashboard';
import { RecentImagesModal } from './components/Recents/RecentImagesModal';
import type { PrintQueueItem } from './types';
import { createSampleIdCard, createSamplePaperDocument } from './utils/sampleImages';
import { rotateCanvas } from './utils/imageProcessing';
import { ShieldAlert, ArrowLeft, LogIn, Phone } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/Auth/AuthModal';
import { analytics } from './services/analyticsService';
import { HomePage } from './components/Home/HomePage';
import { isAuthorizedAdmin, AUTHORIZED_ADMIN_EMAIL } from './utils/constants';
import { userStorageService } from './services/userStorageService';
import './App.css';

export type AppTab = 'home' | 'scanner' | 'print' | 'passport' | 'admin';

const getTabFromPath = (pathname: string): AppTab => {
  const clean = pathname.toLowerCase().replace(/^\/+|\/+$/g, '');
  if (!clean || clean === 'home') return 'home';
  if (clean === 'scanner' || clean === 'scan') return 'scanner';
  if (clean === 'print' || clean === 'print-studio') return 'print';
  if (clean === 'passport' || clean === 'passport-maker') return 'passport';
  if (clean === 'admin' || clean === 'dashboard') return 'admin';
  return 'home';
};

const getPathFromTab = (tab: AppTab): string => {
  return `/${tab}`;
};

const MainAppContent: React.FC = () => {
  const { user, openAuthModal } = useAuth();
  const [activeTab, setActiveTabState] = useState<AppTab>(() => getTabFromPath(window.location.pathname));
  const [queue, setQueue] = useState<PrintQueueItem[]>(() => userStorageService.getUserQueue(user?.id));
  const [externalImage, setExternalImage] = useState<string | null>(null);
  const [isRecentsOpen, setIsRecentsOpen] = useState<boolean>(false);

  // Sync tab with browser URL history
  const setActiveTab = (tab: AppTab) => {
    setActiveTabState(tab);
    const targetPath = getPathFromTab(tab);
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ tab }, '', targetPath);
    }
  };

  // Browser Back & Forward buttons navigation support
  useEffect(() => {
    const handlePopState = () => {
      const tab = getTabFromPath(window.location.pathname);
      setActiveTabState(tab);
      if (window.location.pathname === '/' || window.location.pathname === '') {
        window.history.replaceState({ tab: 'home' }, '', '/home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Standardize URL to clean named paths (/home, /scanner, etc.) and strip ugly OAuth token hashes
  useEffect(() => {
    const cleanAndNormalizeUrl = () => {
      const currentTab = getTabFromPath(window.location.pathname);
      const targetPath = getPathFromTab(currentTab);
      const hash = window.location.hash;

      const hasOAuthHash =
        hash &&
        (hash.includes('access_token') ||
          hash.includes('refresh_token') ||
          hash.includes('token_type') ||
          hash.includes('type=recovery') ||
          hash.includes('type=signup') ||
          hash.includes('error_description'));

      if (window.location.pathname === '/' || window.location.pathname === '' || hasOAuthHash) {
        window.history.replaceState({ tab: currentTab }, '', targetPath);
      }
    };

    cleanAndNormalizeUrl();
    const timer = setTimeout(cleanAndNormalizeUrl, 100);
    return () => clearTimeout(timer);
  }, []);

  // Automatically track page views and user sessions
  useEffect(() => {
    analytics.trackPageView(activeTab, user);
  }, [activeTab, user]);

  // Register user profile upon auth
  useEffect(() => {
    if (user) {
      analytics.registerUser(user);
    }
  }, [user]);

  // User-wise state isolation & Seamless Guest-to-User migration
  // "when the user signs in and comes to the print option the image he was working shouldn't go away"
  // "users data shouldn't go to other users"
  const previousUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    // Initial mount check
    if (previousUserIdRef.current === undefined) {
      previousUserIdRef.current = user?.id || null;
      const draft = userStorageService.getDraft();
      if (draft) {
        if (draft.queue && draft.queue.length > 0 && queue.length === 0) {
          setQueue(draft.queue);
        }
        if (draft.scannerImage && !externalImage) {
          setExternalImage(draft.scannerImage);
        }
        if (draft.activeTab) {
          setActiveTab(draft.activeTab);
        }
      }
      return;
    }

    if (user?.id && user.id !== previousUserIdRef.current) {
      // User just logged in: migrate any active working images/queue so they DON'T go away
      const { migratedQueue, migratedTab } = userStorageService.migrateGuestDataToUser(user.id);
      if (migratedQueue && migratedQueue.length > 0) {
        setQueue(migratedQueue);
      } else {
        const userSavedQueue = userStorageService.getUserQueue(user.id);
        if (queue.length > 0) {
          // If user had items in memory before login, keep them in user's queue
          const existingIds = new Set(userSavedQueue.map((q) => q.id));
          const combined = [...queue.filter((q) => !existingIds.has(q.id)), ...userSavedQueue];
          setQueue(combined);
          userStorageService.setUserQueue(user.id, combined);
        } else {
          setQueue(userSavedQueue);
        }
      }
      if (migratedTab) {
        setActiveTab(migratedTab as any);
      }
    } else if (!user && previousUserIdRef.current) {
      // User just logged out: strictly clear memory so User A's data NEVER leaks to User B
      setQueue([]);
      setExternalImage(null);
      userStorageService.clearDraft();
    }

    previousUserIdRef.current = user?.id || null;
  }, [user]);

  // Keep active queue and draft in sync
  useEffect(() => {
    userStorageService.setUserQueue(user?.id, queue);
    userStorageService.saveDraft({
      queue,
      scannerImage: externalImage,
      passportPhotoUrl: null,
      activeTab,
      updatedAt: Date.now(),
    });
  }, [queue, user?.id, externalImage, activeTab]);

  const handleSendToPrint = (item: Omit<PrintQueueItem, 'id' | 'createdAt'>) => {
    const newItem: PrintQueueItem = {
      ...item,
      id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now(),
    };
    setQueue((prev) => [newItem, ...prev]);
    // Save to user's recent images
    userStorageService.addRecent(user?.id, {
      name: item.name,
      dataUrl: item.dataUrl,
      docType: item.docType,
      source: 'print',
      aspectRatio: item.aspectRatio,
    });
    setActiveTab('print');
  };

  const handleSendMultipleToPrint = (items: Omit<PrintQueueItem, 'id' | 'createdAt'>[]) => {
    const newItems: PrintQueueItem[] = items.map((item, idx) => ({
      ...item,
      id: `queue-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now() + idx,
    }));
    setQueue((prev) => [...newItems, ...prev]);
    // Save each to user's recent images
    items.forEach((item) => {
      userStorageService.addRecent(user?.id, {
        name: item.name,
        dataUrl: item.dataUrl,
        docType: item.docType,
        source: 'print',
        aspectRatio: item.aspectRatio,
      });
    });
    setActiveTab('print');
  };

  const handleRemoveItem = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearQueue = () => {
    setQueue([]);
  };

  const handleDuplicateItem = (id: string) => {
    const target = queue.find((q) => q.id === id);
    if (!target) return;
    const duplicated: PrintQueueItem = {
      ...target,
      id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: `${target.name} (Copy)`,
      createdAt: Date.now(),
    };
    setQueue((prev) => [...prev, duplicated]);
  };

  const handleRotateItem = (id: string) => {
    const target = queue.find((q) => q.id === id);
    if (!target) return;

    const img = new Image();
    img.onload = () => {
      const rotated = rotateCanvas(img, 90);
      const nextDataUrl = rotated.toDataURL('image/jpeg', 0.96);
      setQueue((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                dataUrl: nextDataUrl,
                aspectRatio: rotated.width / rotated.height,
              }
            : item
        )
      );
    };
    img.src = target.dataUrl;
  };

  const handleLoadSample = (type: 'id_front' | 'id_back' | 'paper') => {
    if (type === 'id_front') {
      setExternalImage(createSampleIdCard('front'));
    } else if (type === 'id_back') {
      setExternalImage(createSampleIdCard('back'));
    } else {
      setExternalImage(createSamplePaperDocument());
    }
    setActiveTab('scanner');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        queue={queue}
        onLoadSample={handleLoadSample}
        onOpenRecents={() => setIsRecentsOpen(true)}
      />

      <main className="flex-1">
        {activeTab === 'home' && (
          <HomePage
            onNavigate={setActiveTab}
            onOpenSample={handleLoadSample}
          />
        )}

        {activeTab === 'scanner' && (
          <ScannerView
            onSendToPrint={handleSendToPrint}
            onSendMultipleToPrint={handleSendMultipleToPrint}
            externalImage={externalImage}
            onClearExternalImage={() => setExternalImage(null)}
          />
        )}

        {activeTab === 'print' && (
          <PrintStudioView
            queue={queue}
            onAddItem={handleSendToPrint}
            onRemoveItem={handleRemoveItem}
            onClearQueue={handleClearQueue}
            onDuplicateItem={handleDuplicateItem}
            onRotateItem={handleRotateItem}
            onNavigateToScanner={() => setActiveTab('scanner')}
            onOpenRecents={() => setIsRecentsOpen(true)}
          />
        )}

        {activeTab === 'passport' && (
          <PassportMakerView onSendToPrint={handleSendToPrint} />
        )}

        {activeTab === 'admin' && (
          isAuthorizedAdmin(user?.email) ? (
            <AdminDashboard onNavigateTab={setActiveTab} />
          ) : (
            <div className="max-w-xl mx-auto my-16 px-4">
              <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-xl text-center">
                <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
                  Access Restricted
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-3 mb-2">
                  Administrator Privileges Required
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mb-6">
                  The Studio Analytics and User Intelligence console is restricted exclusively to the authorized administrator (<strong>{AUTHORIZED_ADMIN_EMAIL}</strong>).
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  {!user ? (
                    <button
                      type="button"
                      onClick={() => openAuthModal()}
                      style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer hover:bg-blue-500"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Sign In as Admin</span>
                    </button>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 mb-2 w-full text-center">
                      Currently signed in as: <strong className="text-slate-900">{user.email}</strong> (Unauthorized)
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveTab('scanner')}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Return to Studio</span>
                  </button>
                </div>
              </div>
            </div>
          )
        )}
      </main>

      {/* Footer */}
      <footer className="no-print border-t border-slate-200 py-4 bg-white text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="PrintMate Logo" className="w-5 h-5 object-contain" />
            <span className="font-semibold text-slate-800">PrintMate</span>
            <span>• Auto Border Detection, Deskew & Multi-Up Print Studio</span>
          </div>

          {/* Distinct Royal Purple & Vibrant Pink Gradient Creator Badge */}
          <div className="flex items-center gap-2">
            <div className="px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 text-white font-bold text-xs shadow-md shadow-purple-500/25 border border-purple-300/40 flex items-center gap-2 transition-transform hover:scale-102">
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              <span className="tracking-wide">Burhanuddin Sounasath</span>
              <span className="opacity-60">•</span>
              <a 
                href="tel:YOUR_PHONE_NUMBER" 
                className="inline-flex items-center gap-1.5 font-semibold text-purple-100 hover:text-white transition-colors cursor-pointer"
                title="Contact Burhanuddin Sounasath"
              >
                <Phone className="w-3.5 h-3.5 text-pink-200" />
                <span className="underline decoration-pink-300/60 underline-offset-2">[Phone Number]</span>
              </a>
            </div>
          </div>

          <div className="text-[11px] text-slate-400">
            A4 • A3 • Letter • Duplex • CR80 ID Standard Scale
          </div>
        </div>
      </footer>

      {/* User-Wise Recent Documents & Scans Modal */}
      <RecentImagesModal
        isOpen={isRecentsOpen}
        onClose={() => setIsRecentsOpen(false)}
        onOpenInScanner={(dataUrl) => {
          setExternalImage(dataUrl);
          setActiveTab('scanner');
        }}
        onAddToPrintQueue={handleSendToPrint}
      />

      {/* Real Authentication Modal (Google OAuth & Email/Password) */}
      <AuthModal />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
};

export default App;
