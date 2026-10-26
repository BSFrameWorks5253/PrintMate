import { getSupabase } from '../lib/supabase';
import type { UserProfile } from '../context/AuthContext';

export interface UserAnalytics {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  provider: 'google' | 'email' | 'guest';
  firstSeen: number;
  lastActive: number;
  pageViews: {
    home?: number;
    scanner: number;
    print: number;
    passport: number;
    admin: number;
  };
  printCount: number;
  downloadCount: number;
  isDemo?: boolean;
}

export interface AnalyticsEvent {
  id: string;
  type: 'page_view' | 'print' | 'download' | 'scan';
  userId: string;
  userEmail: string;
  userName: string;
  page: 'home' | 'scanner' | 'print' | 'passport' | 'admin';
  meta?: Record<string, any>;
  timestamp: number;
}

const STORAGE_KEY_USERS = 'printmate_analytics_users_v1';
const STORAGE_KEY_EVENTS = 'printmate_analytics_events_v1';
const GUEST_ID_KEY = 'printmate_guest_session_id';

// Initial realistic demo users for studio analytics presentation
const INITIAL_DEMO_USERS: UserAnalytics[] = [
  {
    id: 'usr-demo-1',
    name: 'Rajesh Sharma',
    email: 'rajesh.studio@printquick.in',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
    provider: 'google',
    firstSeen: Date.now() - 86400000 * 14,
    lastActive: Date.now() - 1000 * 60 * 12,
    pageViews: { scanner: 48, print: 82, passport: 115, admin: 4 },
    printCount: 64,
    downloadCount: 39,
    isDemo: true,
  },
  {
    id: 'usr-demo-2',
    name: 'Ananya Verma',
    email: 'ananya.v@gmail.com',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
    provider: 'google',
    firstSeen: Date.now() - 86400000 * 9,
    lastActive: Date.now() - 1000 * 60 * 45,
    pageViews: { scanner: 29, print: 41, passport: 18, admin: 1 },
    printCount: 28,
    downloadCount: 19,
    isDemo: true,
  },
  {
    id: 'usr-demo-3',
    name: 'Mohammad Al-Khatib',
    email: 'm.khatib@cybercafe.ae',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
    provider: 'email',
    firstSeen: Date.now() - 86400000 * 21,
    lastActive: Date.now() - 1000 * 60 * 180,
    pageViews: { scanner: 62, print: 94, passport: 43, admin: 2 },
    printCount: 71,
    downloadCount: 45,
    isDemo: true,
  },
  {
    id: 'usr-demo-4',
    name: 'Sarah Jenkins',
    email: 'sarah.jenkins@visa-express.co.uk',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face',
    provider: 'google',
    firstSeen: Date.now() - 86400000 * 5,
    lastActive: Date.now() - 1000 * 60 * 240,
    pageViews: { scanner: 14, print: 19, passport: 88, admin: 0 },
    printCount: 52,
    downloadCount: 31,
    isDemo: true,
  },
  {
    id: 'usr-demo-5',
    name: 'David Chen',
    email: 'dchen.prints@fastdocs.org',
    provider: 'email',
    firstSeen: Date.now() - 86400000 * 3,
    lastActive: Date.now() - 1000 * 60 * 400,
    pageViews: { scanner: 37, print: 25, passport: 12, admin: 0 },
    printCount: 16,
    downloadCount: 22,
    isDemo: true,
  },
];

class AnalyticsService {
  private guestId: string;

  constructor() {
    this.guestId = this.getOrCreateGuestId();
    this.initializeStore();
  }

  private getOrCreateGuestId(): string {
    let id = localStorage.getItem(GUEST_ID_KEY);
    if (!id) {
      id = `guest_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem(GUEST_ID_KEY, id);
    }
    return id;
  }

  private initializeStore(): void {
    if (!localStorage.getItem(STORAGE_KEY_USERS)) {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(INITIAL_DEMO_USERS));
    }
    if (!localStorage.getItem(STORAGE_KEY_EVENTS)) {
      const initialEvents: AnalyticsEvent[] = [
        {
          id: 'evt-init-1',
          type: 'print',
          userId: 'usr-demo-1',
          userName: 'Rajesh Sharma',
          userEmail: 'rajesh.studio@printquick.in',
          page: 'passport',
          meta: { pageSize: '4x6 (10x15cm)', layout: '8-up Passport Grid' },
          timestamp: Date.now() - 1000 * 60 * 12,
        },
        {
          id: 'evt-init-2',
          type: 'download',
          userId: 'usr-demo-2',
          userName: 'Ananya Verma',
          userEmail: 'ananya.v@gmail.com',
          page: 'print',
          meta: { type: 'Clean Sheet Output (A4)' },
          timestamp: Date.now() - 1000 * 60 * 45,
        },
        {
          id: 'evt-init-3',
          type: 'scan',
          userId: 'usr-demo-3',
          userName: 'Mohammad Al-Khatib',
          userEmail: 'm.khatib@cybercafe.ae',
          page: 'scanner',
          meta: { cardSide: 'id_front' },
          timestamp: Date.now() - 1000 * 60 * 180,
        },
      ];
      localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(initialEvents));
    }
  }

  private getUsers(): UserAnalytics[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_USERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return INITIAL_DEMO_USERS;
    }
  }

  private saveUsers(users: UserAnalytics[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    } catch (e) {
      console.warn('Failed to save analytics users', e);
    }
  }

  private getEvents(): AnalyticsEvent[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_EVENTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveEvents(events: AnalyticsEvent[]): void {
    try {
      // Keep most recent 500 events
      const trimmed = events.slice(0, 500);
      localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('Failed to save analytics events', e);
    }
  }

  private resolveUserInfo(currentUser?: UserProfile | null) {
    if (currentUser && currentUser.email) {
      return {
        id: currentUser.id,
        name: currentUser.name || currentUser.email.split('@')[0],
        email: currentUser.email,
        avatarUrl: currentUser.avatarUrl,
        provider: (currentUser.provider === 'google' ? 'google' : 'email') as 'google' | 'email',
        isDemo: false,
      };
    }
    return {
      id: this.guestId,
      name: 'Guest Studio User',
      email: `${this.guestId}@guest.printmate.local`,
      avatarUrl: undefined,
      provider: 'guest' as const,
      isDemo: false,
    };
  }

  private updateOrCreateUser(
    info: ReturnType<typeof this.resolveUserInfo>,
    updater: (user: UserAnalytics) => void
  ): UserAnalytics {
    const users = this.getUsers();
    let userIndex = users.findIndex((u) => u.id === info.id || u.email === info.email);

    let targetUser: UserAnalytics;
    if (userIndex >= 0) {
      targetUser = { ...users[userIndex] };
      targetUser.lastActive = Date.now();
      if (info.name && targetUser.name === 'Guest Studio User') {
        targetUser.name = info.name;
      }
      if (info.avatarUrl) {
        targetUser.avatarUrl = info.avatarUrl;
      }
      if (info.provider !== 'guest') {
        targetUser.provider = info.provider;
      }
      updater(targetUser);
      users[userIndex] = targetUser;
    } else {
      targetUser = {
        id: info.id,
        name: info.name,
        email: info.email,
        avatarUrl: info.avatarUrl,
        provider: info.provider,
        firstSeen: Date.now(),
        lastActive: Date.now(),
        pageViews: { scanner: 0, print: 0, passport: 0, admin: 0 },
        printCount: 0,
        downloadCount: 0,
        isDemo: false,
      };
      updater(targetUser);
      users.unshift(targetUser);
    }

    this.saveUsers(users);
    return targetUser;
  }

  private pushEvent(
    type: AnalyticsEvent['type'],
    page: AnalyticsEvent['page'],
    info: ReturnType<typeof this.resolveUserInfo>,
    meta?: Record<string, any>
  ) {
    const event: AnalyticsEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type,
      page,
      userId: info.id,
      userName: info.name,
      userEmail: info.email,
      meta,
      timestamp: Date.now(),
    };

    const events = this.getEvents();
    events.unshift(event);
    this.saveEvents(events);

    // Asynchronously try sending to Supabase if configured (fire & forget, graceful catch)
    const supabase = getSupabase();
    if (supabase) {
      Promise.resolve(
        supabase
          .from('analytics_events')
          .insert({
            event_type: type,
            page,
            user_id: info.id,
            user_email: info.email,
            user_name: info.name,
            metadata: meta || {},
            created_at: new Date().toISOString(),
          })
      ).catch(() => {});
    }
  }

  // --- Public Tracking Methods ---

  public trackPageView(page: 'home' | 'scanner' | 'print' | 'passport' | 'admin', user?: UserProfile | null): void {
    const info = this.resolveUserInfo(user);
    this.updateOrCreateUser(info, (u) => {
      u.pageViews[page] = (u.pageViews[page] || 0) + 1;
    });
    this.pushEvent('page_view', page, info);
  }

  public trackPrint(
    details: { pageSize: string; itemCount?: number; page: 'print' | 'passport' },
    user?: UserProfile | null
  ): void {
    const info = this.resolveUserInfo(user);
    this.updateOrCreateUser(info, (u) => {
      u.printCount = (u.printCount || 0) + 1;
    });
    this.pushEvent('print', details.page, info, details);
  }

  public trackDownload(
    details: { type: string; fileName?: string; page: 'scanner' | 'print' | 'passport' },
    user?: UserProfile | null
  ): void {
    const info = this.resolveUserInfo(user);
    this.updateOrCreateUser(info, (u) => {
      u.downloadCount = (u.downloadCount || 0) + 1;
    });
    this.pushEvent('download', details.page, info, details);
  }

  public trackScan(details: { cardSide: string }, user?: UserProfile | null): void {
    const info = this.resolveUserInfo(user);
    this.pushEvent('scan', 'scanner', info, details);
  }

  public registerUser(user: UserProfile): void {
    const info = this.resolveUserInfo(user);
    this.updateOrCreateUser(info, () => {});
  }

  // --- Query Methods for Dashboard ---

  public getAllUsers(): UserAnalytics[] {
    return this.getUsers().sort((a, b) => b.lastActive - a.lastActive);
  }

  public getEventsList(): AnalyticsEvent[] {
    return this.getEvents();
  }

  public getGlobalStats() {
    const users = this.getUsers();
    const events = this.getEvents();

    let totalPageViews = 0;
    let scannerViews = 0;
    let printViews = 0;
    let passportViews = 0;
    let totalPrints = 0;
    let totalDownloads = 0;

    users.forEach((u) => {
      scannerViews += u.pageViews.scanner || 0;
      printViews += u.pageViews.print || 0;
      passportViews += u.pageViews.passport || 0;
      totalPrints += u.printCount || 0;
      totalDownloads += u.downloadCount || 0;
    });

    totalPageViews = scannerViews + printViews + passportViews;

    const pagePopularity = [
      {
        page: 'passport',
        label: 'Passport Maker',
        description: 'Multi-up passport & visa grid sheets',
        count: passportViews,
        percentage: totalPageViews > 0 ? Math.round((passportViews / totalPageViews) * 100) : 0,
        color: 'from-amber-500 to-orange-500',
        badgeColor: 'bg-amber-100 text-amber-800',
      },
      {
        page: 'print',
        label: 'Print Studio',
        description: 'Multi-layout ID & photo print queue',
        count: printViews,
        percentage: totalPageViews > 0 ? Math.round((printViews / totalPageViews) * 100) : 0,
        color: 'from-blue-600 to-indigo-600',
        badgeColor: 'bg-blue-100 text-blue-800',
      },
      {
        page: 'scanner',
        label: 'Scan & Straighten',
        description: 'Document perspective correction',
        count: scannerViews,
        percentage: totalPageViews > 0 ? Math.round((scannerViews / totalPageViews) * 100) : 0,
        color: 'from-emerald-500 to-teal-500',
        badgeColor: 'bg-emerald-100 text-emerald-800',
      },
    ].sort((a, b) => b.count - a.count);

    return {
      totalUsers: users.length,
      realUsersCount: users.filter((u) => !u.isDemo && u.provider !== 'guest').length,
      totalPageViews,
      totalPrints,
      totalDownloads,
      pagePopularity,
      recentEvents: events.slice(0, 15),
    };
  }

  public resetToSample(): void {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(INITIAL_DEMO_USERS));
    localStorage.removeItem(STORAGE_KEY_EVENTS);
    this.initializeStore();
  }

  public exportCSV(): string {
    const users = this.getUsers();
    const headers = [
      'ID',
      'Name',
      'Email',
      'Provider',
      'Scanner Views',
      'Print Views',
      'Passport Views',
      'Total Page Views',
      'Prints Count',
      'Downloads Count',
      'First Seen',
      'Last Active',
      'Type',
    ];

    const rows = users.map((u) => [
      u.id,
      `"${u.name.replace(/"/g, '""')}"`,
      u.email,
      u.provider,
      u.pageViews.scanner || 0,
      u.pageViews.print || 0,
      u.pageViews.passport || 0,
      (u.pageViews.scanner || 0) + (u.pageViews.print || 0) + (u.pageViews.passport || 0),
      u.printCount || 0,
      u.downloadCount || 0,
      new Date(u.firstSeen).toISOString(),
      new Date(u.lastActive).toISOString(),
      u.isDemo ? 'Demo Seed' : 'Live User',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  public getSupabaseSQLSchema(): string {
    return `-- Run this in your Supabase SQL Editor (SQL Editor -> New Query -> Run)
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  page TEXT NOT NULL,
  user_id TEXT,
  user_email TEXT,
  user_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users and public to insert events
CREATE POLICY "Allow public insert to analytics_events"
  ON public.analytics_events FOR INSERT
  WITH CHECK (true);

-- Allow reading analytics events for authenticated users
CREATE POLICY "Allow read to analytics_events"
  ON public.analytics_events FOR SELECT
  USING (true);
`;
  }
}

export const analytics = new AnalyticsService();
