import React, { useState, useEffect } from 'react';
import { 
  X, 
  Clock, 
  Trash2, 
  Printer, 
  Crop 
} from 'lucide-react';
import type { RecentImageItem, PrintQueueItem } from '../../types';
import { userStorageService } from '../../services/userStorageService';
import { useAuth } from '../../context/AuthContext';

interface RecentImagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenInScanner: (dataUrl: string) => void;
  onAddToPrintQueue: (item: Omit<PrintQueueItem, 'id' | 'createdAt'>) => void;
}

export const RecentImagesModal: React.FC<RecentImagesModalProps> = ({
  isOpen,
  onClose,
  onOpenInScanner,
  onAddToPrintQueue,
}) => {
  const { user } = useAuth();
  const [recents, setRecents] = useState<RecentImageItem[]>([]);

  // Load recents for current user
  useEffect(() => {
    if (isOpen) {
      const items = userStorageService.getRecents(user?.id);
      setRecents(items);
    }
  }, [isOpen, user?.id]);

  if (!isOpen) return null;

  const handleDeleteItem = (id: string) => {
    userStorageService.removeRecent(user?.id, id);
    setRecents((prev) => prev.filter((r) => r.id !== id));
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear your recent documents history?')) {
      userStorageService.clearRecents(user?.id);
      setRecents([]);
    }
  };

  const formatRelativeTime = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-md transition-opacity animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-600 border border-blue-200">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                  {user ? `${user.name}'s Recent Documents` : 'Recent Documents'}
                </h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {recents.length} {recents.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {user ? `Private history strictly isolated to ${user.email}` : 'Temporary session history'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {recents.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear History</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          {recents.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4 border border-slate-200">
                <Clock className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-1">No Recent Documents Yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                When you scan, crop, or format IDs and passport photos, your processed documents will appear here automatically for one-click reload.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {recents.map((item) => (
                <div
                  key={item.id}
                  className="group bg-white rounded-2xl border border-slate-200 p-3 hover:border-blue-400 hover:shadow-lg transition-all flex flex-col justify-between"
                >
                  {/* Thumbnail */}
                  <div className="aspect-[4/3] bg-slate-100 rounded-xl overflow-hidden border border-slate-200/80 mb-3 relative flex items-center justify-center">
                    <img
                      src={item.dataUrl}
                      alt={item.name}
                      className="max-h-full max-w-full object-contain"
                    />
                    <div className="absolute top-2 right-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                        className="w-7 h-7 rounded-lg bg-black/60 hover:bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                        title="Delete from recents"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="space-y-1 mb-3">
                    <div className="font-bold text-xs text-slate-900 truncate" title={item.name}>
                      {item.name}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="capitalize">{item.source || 'scanner'}</span>
                      <span>{formatRelativeTime(item.createdAt)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenInScanner(item.dataUrl);
                        onClose();
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Crop className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onAddToPrintQueue({
                          dataUrl: item.dataUrl,
                          name: item.name,
                          docType: item.docType,
                          aspectRatio: item.aspectRatio,
                        });
                        onClose();
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
