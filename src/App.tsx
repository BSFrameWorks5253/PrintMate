import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { ScannerView } from './components/Scanner/ScannerView';
import { PrintStudioView } from './components/PrintStudio/PrintStudioView';
import { PassportMakerView } from './components/PassportMaker/PassportMakerView';
import { AdminDashboard } from './components/Admin/AdminDashboard';
import { RecentImagesModal } from './components/Recents/RecentImagesModal';
import type { PrintQueueItem } from './types';
import { createSampleIdCard, createSamplePaperDocument } from './utils/sampleImages';
import { rotateCanvas } from './utils/imageProcessing';
import { ShieldAlert, ArrowLeft, LogIn, Mail, MessageSquarePlus, CheckCircle2 } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthModal } from './components/Auth/AuthModal';
import { FeedbackModal } from './components/Feedback/FeedbackModal';
import { feedbackService, type FeedbackItem } from './services/feedbackService';
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
  // Fresh visits always start with a clean print queue so last session images do not linger; past images remain in Recents
  const [queue, setQueue] = useState<PrintQueueItem[]>([]);
  const [externalImage, setExternalImage] = useState<string | null>(null);
  const [isRecentsOpen, setIsRecentsOpen] = useState<boolean>(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState<boolean>(false);
  const [unreadResolved, setUnreadResolved] = useState<FeedbackItem[]>([]);

  // Check for resolved tickets submitted on this device
  useEffect(() => {
    const checkResolved = () => {
      setUnreadResolved(feedbackService.getMyUnreadResolvedTokens());
    };
    checkResolved();
    const interval = setInterval(checkResolved, 4000);
    return () => clearInterval(interval);
  }, []);

  // Track page views and user activity across all devices
  useEffect(() => {
    analytics.trackPageView(activeTab, user);
  }, [activeTab, user]);

  // Sync tab with browser URL history
  const setActiveTab = useCallback((tab: AppTab) => {
    setExternalImage(null);
    setActiveTabState(tab);
    const targetPath = getPathFromTab(tab);
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ tab }, '', targetPath);
    }
  }, []);

  // Browser Back & Forward buttons navigation support
  useEffect(() => {
    const handlePopState = () => {
      const tab = getTabFromPath(window.location.pathname);
      setExternalImage(null);
      setActiveTabState(tab);
      if (window.location.pathname === '/' || window.location.pathname === '') {
        window.history.replaceState({ tab: 'home' }, '', '/home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Standardize URL to clean named paths (/home, /scanner, etc.) without wiping out active OAuth callbacks
  useEffect(() => {
    const hash = window.location.hash;
    const isOAuthCallback =
      hash &&
      (hash.includes('access_token') ||
        hash.includes('refresh_token') ||
        hash.includes('token_type') ||
        hash.includes('type=recovery') ||
        hash.includes('type=signup'));

    // If an OAuth callback is in progress, DO NOT overwrite the URL hash until the user is authenticated!
    if (isOAuthCallback && !user) {
      return;
    }

    // Clean hash once user is authenticated
    if (isOAuthCallback && user) {
      const currentTab = getTabFromPath(window.location.pathname);
      const targetPath = getPathFromTab(currentTab);
      window.history.replaceState({ tab: currentTab }, '', targetPath);
      return;
    }

    // If on root "/" or empty, standardize cleanly to "/home"
    if (window.location.pathname === '/' || window.location.pathname === '') {
      window.history.replaceState({ tab: 'home' }, '', '/home');
    }
  }, [user]);

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
  const previousUserIdRef = useRef<string | null | undefined>(undefined);
  const queueRef = useRef(queue);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    // Initial mount check: do not resurrect old images on fresh visits (accessible via Recents)
    if (previousUserIdRef.current === undefined) {
      previousUserIdRef.current = user?.id || null;
      return;
    }

    if (user?.id && user.id !== previousUserIdRef.current) {
      // User just logged in: migrate active in-memory queue from current session only
      const { migratedQueue, migratedTab } = userStorageService.migrateGuestDataToUser(user.id);
      if (migratedQueue && migratedQueue.length > 0) {
        setQueue(migratedQueue);
      } else if (queueRef.current.length > 0) {
        userStorageService.setUserQueue(user.id, queueRef.current);
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
  }, [user, setActiveTab]);

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
    setQueue((prev) => [newItem, ...prev.filter((p) => p.dataUrl !== item.dataUrl)]);
    // Save to user's recent images
    userStorageService.addRecent(user?.id, {
      name: item.name,
      dataUrl: item.dataUrl,
      docType: item.docType,
      source: 'print',
      aspectRatio: item.aspectRatio,
    });
    setExternalImage(null);
    setActiveTabState('print');
    const targetPath = getPathFromTab('print');
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ tab: 'print' }, '', targetPath);
    }
  };

  const handleSendMultipleToPrint = (items: Omit<PrintQueueItem, 'id' | 'createdAt'>[]) => {
    const newItems: PrintQueueItem[] = items.map((item, idx) => ({
      ...item,
      id: `queue-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now() + idx,
    }));
    setQueue(newItems);
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
    setExternalImage(null);
    setActiveTabState('print');
    const targetPath = getPathFromTab('print');
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ tab: 'print' }, '', targetPath);
    }
  };

  const handleRemoveItem = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearQueue = () => {
    setQueue([]);
    userStorageService.setUserQueue(user?.id, []);
    userStorageService.clearDraft();
  };

  const handleUpdateItemCopies = (id: string, delta: number) => {
    setQueue((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const currentCopies = item.copies || 1;
          const nextCopies = Math.max(1, Math.min(50, currentCopies + delta));
          return { ...item, copies: nextCopies };
        }
        return item;
      })
    );
  };

  const handleDuplicateItem = (id: string) => {
    handleUpdateItemCopies(id, 1);
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        queue={queue}
        onLoadSample={handleLoadSample}
        onOpenRecents={() => setIsRecentsOpen(true)}
      />

      {/* Real-time Notification Banner for Solved / Added Issues */}
      {unreadResolved.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 text-white px-4 py-2 text-xs font-semibold shadow-md flex items-center justify-between gap-3 animate-in slide-in-from-top sticky top-16 z-40">
          <div className="flex items-center gap-2 max-w-4xl truncate">
            <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
            <span className="truncate">
              Great news! Your request <strong className="underline font-mono bg-white/20 px-1.5 py-0.5 rounded">{unreadResolved[0].token}</strong> ("{unreadResolved[0].title}") has been marked as <strong>{unreadResolved[0].status === 'added' ? 'FEATURE ADDED' : 'SOLVED'}</strong>!
              {unreadResolved[0].adminNote && (
                <span className="opacity-95 ml-2 font-normal italic">
                  — Note: "{unreadResolved[0].adminNote}"
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                feedbackService.markAsViewed(unreadResolved[0].token);
                setUnreadResolved(feedbackService.getMyUnreadResolvedTokens());
              }}
              className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">
        <div className={`no-print ${activeTab === 'home' ? 'block' : 'hidden'}`}>
          <HomePage
            onNavigate={setActiveTab}
            onOpenSample={handleLoadSample}
          />
        </div>

        <div className={`no-print ${activeTab === 'scanner' ? 'block' : 'hidden'}`}>
          <ScannerView
            onSendToPrint={handleSendToPrint}
            onSendMultipleToPrint={handleSendMultipleToPrint}
            externalImage={externalImage}
            onClearExternalImage={() => setExternalImage(null)}
            isVisible={activeTab === 'scanner'}
          />
        </div>

        <div className={activeTab === 'print' ? 'block' : 'hidden'}>
          <PrintStudioView
            queue={queue}
            onAddItem={handleSendToPrint}
            onRemoveItem={handleRemoveItem}
            onClearQueue={handleClearQueue}
            onDuplicateItem={handleDuplicateItem}
            onRotateItem={handleRotateItem}
            onUpdateItemCopies={handleUpdateItemCopies}
            onNavigateToScanner={() => setActiveTab('scanner')}
            onOpenRecents={() => setIsRecentsOpen(true)}
          />
        </div>

        <div className={`no-print ${activeTab === 'passport' ? 'block' : 'hidden'}`}>
          <PassportMakerView onSendToPrint={handleSendToPrint} />
        </div>

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
      <footer className="no-print border-t border-slate-200 dark:border-slate-800 py-4 bg-white dark:bg-slate-900 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="PrintMate Logo" className="w-5 h-5 object-contain" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">PrintMate</span>
            <span>• Auto Border Detection, Deskew & Multi-Up Print Studio</span>
          </div>

          {/* Creator Credit & Issue/Feature Request Actions */}
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {/* Subtle, Tasteful Creator Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 text-xs shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="font-medium">Created by Burhanuddin Sounasath</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <a
                href="mailto:bs.framework52523@gmail.com"
                className="inline-flex items-center gap-1 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors"
                title="Send Email to Creator"
              >
                <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="font-mono text-[11px]">bs.framework52523@gmail.com</span>
              </a>
            </div>

            {/* Address an Issue / Request Feature Button */}
            <button
              type="button"
              onClick={() => setIsFeedbackOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <MessageSquarePlus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Address an Issue / Request Feature</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 dark:text-slate-500">
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

      {/* Address an Issue & Request Feature Modal with Token System */}
      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        userEmail={user?.email}
      />

      {/* Real Authentication Modal (Google OAuth & Email/Password) */}
      <AuthModal />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainAppContent />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
