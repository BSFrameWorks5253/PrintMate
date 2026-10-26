import type { RecentImageItem, PrintQueueItem, PrintSettings, ActiveDraftState } from '../types';

const STORAGE_PREFIX = 'printmate_u_';
const GUEST_KEY = 'printmate_guest';
const DRAFT_KEY = 'printmate_active_draft';
const MAX_RECENTS = 25;

export const userStorageService = {
  // Key builder ensuring strict isolation between user accounts
  getKey(userId: string | null | undefined, suffix: string): string {
    if (userId && userId.trim()) {
      return `${STORAGE_PREFIX}${userId.trim()}_${suffix}`;
    }
    return `${GUEST_KEY}_${suffix}`;
  },

  // 1. User-Wise Recent Images
  getRecents(userId?: string | null): RecentImageItem[] {
    try {
      const key = this.getKey(userId, 'recents');
      const data = localStorage.getItem(key);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('Failed to read user recents from localStorage', e);
      return [];
    }
  },

  addRecent(
    userId: string | null | undefined,
    item: Omit<RecentImageItem, 'id' | 'createdAt'>
  ): RecentImageItem {
    const recents = this.getRecents(userId);
    const newItem: RecentImageItem = {
      ...item,
      id: `recent-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now(),
    };

    // Filter out duplicates with the exact same dataUrl
    const filtered = recents.filter((r) => r.dataUrl !== item.dataUrl);
    const updated = [newItem, ...filtered].slice(0, MAX_RECENTS);

    try {
      const key = this.getKey(userId, 'recents');
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      console.warn('Quota exceeded or error saving recent item to localStorage', e);
    }
    return newItem;
  },

  removeRecent(userId: string | null | undefined, id: string): void {
    const recents = this.getRecents(userId);
    const updated = recents.filter((r) => r.id !== id);
    try {
      const key = this.getKey(userId, 'recents');
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to remove recent from localStorage', e);
    }
  },

  clearRecents(userId: string | null | undefined): void {
    try {
      const key = this.getKey(userId, 'recents');
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('Failed to clear recents from localStorage', e);
    }
  },

  // 2. User-Wise Print Queue
  getUserQueue(userId?: string | null): PrintQueueItem[] {
    try {
      const key = this.getKey(userId, 'queue');
      const data = localStorage.getItem(key);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('Failed to read user queue from localStorage', e);
      return [];
    }
  },

  setUserQueue(userId: string | null | undefined, queue: PrintQueueItem[]): void {
    try {
      const key = this.getKey(userId, 'queue');
      localStorage.setItem(key, JSON.stringify(queue));
    } catch (e) {
      console.warn('Failed to persist user queue to localStorage', e);
    }
  },

  // 3. User-Wise Print Settings
  getUserSettings(userId?: string | null): Partial<PrintSettings> | null {
    try {
      const key = this.getKey(userId, 'settings');
      const data = localStorage.getItem(key);
      if (!data) return null;
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  },

  setUserSettings(userId: string | null | undefined, settings: Partial<PrintSettings>): void {
    try {
      const key = this.getKey(userId, 'settings');
      localStorage.setItem(key, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to persist user settings to localStorage', e);
    }
  },

  // 4. Active Draft State (Preserves work-in-progress across authentication)
  saveDraft(draft: ActiveDraftState): void {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {
      console.warn('Failed to save active draft', e);
    }
  },

  getDraft(): ActiveDraftState | null {
    try {
      const data = localStorage.getItem(DRAFT_KEY);
      if (!data) return null;
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  },

  clearDraft(): void {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {
      console.warn('Failed to clear active draft', e);
    }
  },

  // 5. Seamless Guest-to-User Migration
  // When a guest user adds images, gets prompted to sign in, and signs in:
  // their guest queue & recents are migrated directly into their user profile!
  migrateGuestDataToUser(userId: string): { migratedQueue: PrintQueueItem[]; migratedTab?: string } {
    if (!userId) return { migratedQueue: [] };

    const guestQueue = this.getUserQueue(null);
    const guestRecents = this.getRecents(null);
    const draft = this.getDraft();

    const userQueue = this.getUserQueue(userId);
    const userRecents = this.getRecents(userId);

    // Merge queues (avoid duplicates)
    const existingIds = new Set(userQueue.map((q) => q.id));
    const queueToAdd = (draft?.queue || guestQueue).filter((q) => !existingIds.has(q.id));
    const mergedQueue = [...queueToAdd, ...userQueue];
    this.setUserQueue(userId, mergedQueue);

    // Merge recents
    const existingRecentUrls = new Set(userRecents.map((r) => r.dataUrl));
    const recentsToAdd = guestRecents.filter((r) => !existingRecentUrls.has(r.dataUrl));
    const mergedRecents = [...recentsToAdd, ...userRecents].slice(0, MAX_RECENTS);
    try {
      localStorage.setItem(this.getKey(userId, 'recents'), JSON.stringify(mergedRecents));
    } catch (e) {
      console.warn('Failed to save migrated recents', e);
    }

    // Clear guest storage so next guest doesn't see old items
    this.setUserQueue(null, []);
    this.clearRecents(null);
    this.clearDraft();

    return {
      migratedQueue: mergedQueue,
      migratedTab: draft?.activeTab,
    };
  },
};
