import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle, Home, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[PrintMate ErrorBoundary] Uncaught runtime error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleHardReload = async () => {
    try {
      // 1. Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }

      // 2. Clear CacheStorage
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const key of keys) {
          await caches.delete(key);
        }
      }

      // 3. Clear temporary session state
      sessionStorage.clear();
    } catch (e) {
      console.warn('Cache clearing error:', e);
    }

    // 4. Force reload from server
    window.location.href = '/home';
  };

  public render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'Unknown application error occurred';

      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center select-none font-sans">
          <div className="max-w-md w-full bg-slate-800/90 border border-slate-700 rounded-3xl p-8 shadow-2xl space-y-6">
            <div className="size-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 mx-auto flex items-center justify-center shadow-inner">
              <AlertTriangle className="size-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black tracking-tight text-white">
                Something went wrong
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                PrintMate encountered an issue while rendering this page. This often happens if the browser is using outdated cached files.
              </p>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-left text-[11px] font-mono text-rose-300 max-h-24 overflow-y-auto break-all">
              {errorMessage}
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleHardReload}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <RefreshCw className="size-4" />
                <span>Clear Cache & Reload Studio</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  window.location.href = '/home';
                }}
                className="w-full py-2.5 bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-slate-600 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="size-4" />
                <span>Back to Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
