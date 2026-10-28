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

// Reference sample mock dataset (only loaded when user explicitly toggles Demo mode)
export const INITIAL_DEMO_USERS: UserAnalytics[] = [
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

const INITIAL_DEMO_EVENTS: AnalyticsEvent[] = [
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
    // Initialize clean empty stores for actual live telemetry
    if (!localStorage.getItem(STORAGE_KEY_USERS)) {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEY_EVENTS)) {
      localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify([]));
    }
  }

  private getUsers(): UserAnalytics[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_USERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
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

  private isDemoUser(user: UserAnalytics): boolean {
    if (user.isDemo) return true;
    if (user.id.startsWith('usr-demo-')) return true;
    const demoEmails = [
      'rajesh.studio@printquick.in',
      'ananya.v@gmail.com',
      'm.khatib@cybercafe.ae',
      'sarah.jenkins@visa-express.co.uk',
      'dchen.prints@fastdocs.org',
    ];
    return demoEmails.includes(user.email.toLowerCase());
  }

  private isDemoEvent(evt: AnalyticsEvent): boolean {
    if (evt.id.startsWith('evt-init-')) return true;
    if (evt.userId.startsWith('usr-demo-')) return true;
    const demoEmails = [
      'rajesh.studio@printquick.in',
      'ananya.v@gmail.com',
      'm.khatib@cybercafe.ae',
      'sarah.jenkins@visa-express.co.uk',
      'dchen.prints@fastdocs.org',
    ];
    return demoEmails.includes(evt.userEmail?.toLowerCase());
  }

  public purgeDemoData(): void {
    const rawUsers = this.getUsers();
    const cleanUsers = rawUsers.filter((u) => !this.isDemoUser(u));
    this.saveUsers(cleanUsers);

    const rawEvents = this.getEvents();
    const cleanEvents = rawEvents.filter((e) => !this.isDemoEvent(e));
    this.saveEvents(cleanEvents);
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
    let userIndex = users.findIndex((u) => u.id === info.id || u.email.toLowerCase() === info.email.toLowerCase());

    let targetUser: UserAnalytics;
    if (userIndex >= 0) {
      targetUser = { ...users[userIndex] };
      targetUser.lastActive = Date.now();
      if (info.name && (targetUser.name === 'Guest Studio User' || targetUser.name === 'User')) {
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

    // Sync profile to Supabase cloud if table exists
    const supabase = getSupabase();
    if (supabase && user.email) {
      Promise.resolve(
        supabase.from('profiles').upsert(
          {
            id: user.id,
            email: user.email,
            full_name: user.name,
            avatar_url: user.avatarUrl,
            provider: user.provider || 'email',
            last_sign_in_at: new Date().toISOString(),
            created_at: new Date(user.createdAt || Date.now()).toISOString(),
          },
          { onConflict: 'email' }
        )
      ).catch(() => {});
    }
  }

  // --- Cloud Sync with Supabase ---

  public async checkSupabaseHealth(): Promise<{
    connected: boolean;
    profilesTable: boolean;
    eventsTable: boolean;
    error?: string;
  }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { connected: false, profilesTable: false, eventsTable: false, error: 'No client configured' };
    }
    let profilesTable = false;
    let eventsTable = false;
    let errorMsg: string | undefined = undefined;

    try {
      const resProfiles = await supabase.from('profiles').select('id').limit(1);
      if (resProfiles.error) {
        if (!resProfiles.error.message.includes('schema cache')) {
          profilesTable = true;
        }
      } else {
        profilesTable = true;
      }
    } catch (e: any) {
      errorMsg = e?.message;
    }

    try {
      const resEvents = await supabase.from('analytics_events').select('id').limit(1);
      if (resEvents.error) {
        if (!resEvents.error.message.includes('schema cache')) {
          eventsTable = true;
        }
      } else {
        eventsTable = true;
      }
    } catch {}

    return {
      connected: true,
      profilesTable,
      eventsTable,
      error: errorMsg,
    };
  }

  public async createRealUser(data: { name: string; email: string; provider?: string }): Promise<UserAnalytics> {
    const info = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      avatarUrl: undefined,
      provider: (data.provider || 'email') as any,
      isDemo: false,
    };

    const user = this.updateOrCreateUser(info, (u) => {
      u.lastActive = Date.now();
    });

    // Also push to Supabase profiles
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('profiles').upsert(
          {
            id: info.id,
            email: info.email,
            full_name: info.name,
            provider: info.provider,
            created_at: new Date().toISOString(),
            last_sign_in_at: new Date().toISOString(),
          },
          { onConflict: 'email' }
        );
      } catch {}
    }

    return user;
  }

  public async syncFromSupabase(): Promise<{ 
    success: boolean; 
    cloudProfilesCount: number; 
    cloudEventsCount: number; 
    error?: string;
    missingTables?: boolean;
  }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { success: false, cloudProfilesCount: 0, cloudEventsCount: 0, error: 'Supabase client is not configured' };
    }

    let cloudProfilesCount = 0;
    let cloudEventsCount = 0;
    let missingTables = false;

    // 1. Sync Profiles Table
    try {
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (pError && pError.message.includes('schema cache')) {
        missingTables = true;
      } else if (profiles && profiles.length > 0) {
        cloudProfilesCount = profiles.length;
        profiles.forEach((p: any) => {
          const info = {
            id: p.id || `usr_${p.email}`,
            name: p.full_name || p.email?.split('@')[0] || 'User',
            email: p.email,
            avatarUrl: p.avatar_url,
            provider: (p.provider || 'email') as any,
            isDemo: false,
          };
          this.updateOrCreateUser(info, (u) => {
            if (p.created_at) u.firstSeen = new Date(p.created_at).getTime();
            if (p.last_sign_in_at) u.lastActive = new Date(p.last_sign_in_at).getTime();
          });
        });
      }
    } catch {}

    // 2. Sync Events Table
    try {
      const { data, error } = await supabase
        .from('analytics_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error && error.message.includes('schema cache')) {
        missingTables = true;
      } else if (data && data.length > 0) {
        cloudEventsCount = data.length;
        const localEvents = this.getEvents();
        const existingIds = new Set(localEvents.map((e) => e.id));

        const newMappedEvents: AnalyticsEvent[] = data
          .map((row: any) => ({
            id: row.id,
            type: (row.event_type || 'page_view') as AnalyticsEvent['type'],
            page: (row.page || 'scanner') as AnalyticsEvent['page'],
            userId: row.user_id || 'unknown',
            userName: row.user_name || row.user_email?.split('@')[0] || 'User',
            userEmail: row.user_email || '',
            meta: row.metadata || {},
            timestamp: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
          }))
          .filter((evt) => !existingIds.has(evt.id));

        if (newMappedEvents.length > 0) {
          const merged = [...newMappedEvents, ...localEvents];
          this.saveEvents(merged);

          // Update users list with cloud events
          newMappedEvents.forEach((evt) => {
            if (evt.userEmail) {
              const info = {
                id: evt.userId,
                name: evt.userName,
                email: evt.userEmail,
                avatarUrl: undefined,
                provider: (evt.userEmail.endsWith('@guest.printmate.local') ? 'guest' : 'google') as any,
                isDemo: false,
              };
              this.updateOrCreateUser(info, (u) => {
                if (evt.type === 'print') u.printCount = (u.printCount || 0) + 1;
                if (evt.type === 'download') u.downloadCount = (u.downloadCount || 0) + 1;
                if (evt.type === 'page_view' && evt.page) {
                  u.pageViews[evt.page] = (u.pageViews[evt.page] || 0) + 1;
                }
              });
            }
          });
        }
      }
    } catch (err: any) {
      return { 
        success: false, 
        cloudProfilesCount, 
        cloudEventsCount, 
        error: err?.message || 'Sync failed',
        missingTables 
      };
    }

    return { 
      success: true, 
      cloudProfilesCount, 
      cloudEventsCount, 
      missingTables 
    };
  }

  // --- Query Methods for Dashboard ---

  public getAllUsers(includeDemo: boolean = false): UserAnalytics[] {
    const rawUsers = this.getUsers();
    const filtered = includeDemo ? rawUsers : rawUsers.filter((u) => !this.isDemoUser(u));
    return filtered.sort((a, b) => b.lastActive - a.lastActive);
  }

  public getEventsList(includeDemo: boolean = false): AnalyticsEvent[] {
    const rawEvents = this.getEvents();
    return includeDemo ? rawEvents : rawEvents.filter((e) => !this.isDemoEvent(e));
  }

  public getGlobalStats(includeDemo: boolean = false) {
    const users = this.getAllUsers(includeDemo);
    const events = this.getEventsList(includeDemo);

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
    localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(INITIAL_DEMO_EVENTS));
  }

  public exportCSV(includeDemo: boolean = false): string {
    const users = this.getAllUsers(includeDemo);
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
    return `-- ========================================================
-- PRINTMATE STUDIO: CLOUD DATABASE SETUP SCRIPT
-- Paste and run this in your Supabase SQL Editor:
-- (Supabase Dashboard -> SQL Editor -> New Query -> Run)
-- ========================================================

-- 1. Create public profiles table (Real User Accounts)
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  provider TEXT DEFAULT 'email',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_sign_in_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow reading, inserting, and updating user profiles
CREATE POLICY "Allow public read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update profiles" ON public.profiles FOR UPDATE USING (true);

-- 2. Create analytics events table (Live Telemetry & Logs)
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

-- Allow logging and viewing analytics events
CREATE POLICY "Allow public read analytics" ON public.analytics_events FOR SELECT USING (true);
CREATE POLICY "Allow public insert analytics" ON public.analytics_events FOR INSERT WITH CHECK (true);
`;
  }
}

export const analytics = new AnalyticsService();
