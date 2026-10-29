import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, 
  Printer, 
  Download, 
  Eye, 
  Search, 
  ArrowUpDown, 
  FileSpreadsheet, 
  RefreshCw, 
  ShieldCheck, 
  Database, 
  Check, 
  Copy, 
  X, 
  ChevronRight,
  Crop,
  CreditCard,
  Clock,
  Activity,
  Mail,
  Trash2,
  Cloud,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  ExternalLink,
  MessageSquarePlus,
  Bug,
  Lightbulb
} from 'lucide-react';
import { analytics, type UserAnalytics, type AnalyticsEvent } from '../../services/analyticsService';
import { feedbackService, type FeedbackItem } from '../../services/feedbackService';
import { useAuth } from '../../context/AuthContext';
import { isAuthorizedAdmin, AUTHORIZED_ADMIN_EMAIL } from '../../utils/constants';
import { BroadcastEmailModal } from './BroadcastEmailModal';

interface AdminDashboardProps {
  onNavigateTab: (tab: 'scanner' | 'print' | 'passport') => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigateTab }) => {
  const { user: currentUser } = useAuth();
  const isAdmin = isAuthorizedAdmin(currentUser?.email);

  // By default, strictly show ACTUAL LIVE DATA
  const [includeDemo, setIncludeDemo] = useState<boolean>(false);
  const [users, setUsers] = useState<UserAnalytics[]>([]);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState<'all' | 'google' | 'email' | 'demo' | 'guest'>('all');
  const [sortBy, setSortBy] = useState<'lastActive' | 'prints' | 'downloads' | 'views'>('lastActive');
  const [selectedUser, setSelectedUser] = useState<UserAnalytics | null>(null);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserProvider, setNewUserProvider] = useState<'google' | 'email' | 'demo'>('email');
  const [cloudHealth, setCloudHealth] = useState<{ connected: boolean; profilesTable: boolean; eventsTable: boolean; error?: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<{ message: string; type: 'success' | 'info' | 'error' | null }>({
    message: '',
    type: null,
  });


  // Feedback & User Requests state
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>(() => feedbackService.getAll());
  const [feedbackFilter, setFeedbackFilter] = useState<'all' | 'pending' | 'in_progress' | 'solved' | 'added'>('all');
  const [feedbackSearch, setFeedbackSearch] = useState('');
  const [activeFeedbackEdit, setActiveFeedbackEdit] = useState<FeedbackItem | null>(null);
  const [editStatus, setEditStatus] = useState<'pending' | 'in_progress' | 'solved' | 'added'>('pending');
  const [editAdminNote, setEditAdminNote] = useState('');
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const refreshFeedback = () => {
    setFeedbackList(feedbackService.getAll());
  };

  const handleOpenEditFeedback = (item: FeedbackItem) => {
    setActiveFeedbackEdit(item);
    setEditStatus(item.status);
    setEditAdminNote(item.adminNote || '');
  };

  const handleSaveFeedbackStatus = () => {
    if (!activeFeedbackEdit) return;
    feedbackService.updateStatus(activeFeedbackEdit.token, editStatus, editAdminNote);
    refreshFeedback();
    setActiveFeedbackEdit(null);
    setFeedbackToast(`Token ${activeFeedbackEdit.token} marked as ${editStatus.toUpperCase()}! User will be notified.`);
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  // Load analytics data (actual or with demo toggle)
  const loadData = useCallback(() => {
    // If admin is signed in, ensure admin user is registered in the list so admin is always visible
    if (currentUser) {
      analytics.registerUser(currentUser);
    }
    setUsers(analytics.getAllUsers(includeDemo));
    setEvents(analytics.getEventsList(includeDemo));
  }, [currentUser, includeDemo]);

  const checkHealth = async () => {
    try {
      const health = await analytics.checkSupabaseHealth();
      setCloudHealth(health);
    } catch {
      setCloudHealth({ connected: false, profilesTable: false, eventsTable: false });
    }
  };

  const handleSyncCloud = async () => {
    setIsSyncing(true);
    setSyncStatus({ message: 'Syncing with Supabase cloud...', type: 'info' });
    try {
      await checkHealth();
      const res = await analytics.syncFromSupabase();
      if (res.success && (res.cloudProfilesCount > 0 || res.cloudEventsCount > 0)) {
        setSyncStatus({
          message: `Synced ${res.cloudProfilesCount} user profiles and ${res.cloudEventsCount} telemetry events from Supabase cloud!`,
          type: 'success',
        });
      } else if (res.missingTables) {
        setSyncStatus({
          message: 'Supabase connected, but SQL tables are not yet created. Click "Setup Cloud Tables" to copy the SQL script.',
          type: 'info',
        });
      } else {
        setSyncStatus({
          message: 'Supabase cloud connected & synchronized.',
          type: 'success',
        });
      }
    } catch {
      setSyncStatus({
        message: 'Local live telemetry active.',
        type: 'info',
      });
    } finally {
      setIsSyncing(false);
      loadData();
      setTimeout(() => setSyncStatus({ message: '', type: null }), 6000);
    }
  };

  const handleCreateRealUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;

    await analytics.createRealUser({
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      provider: newUserProvider,
    });

    setNewUserName('');
    setNewUserEmail('');
    setShowAddUserModal(false);
    loadData();
    setSyncStatus({
      message: `User ${newUserEmail.trim()} successfully registered in live directory!`,
      type: 'success',
    });
    setTimeout(() => setSyncStatus({ message: '', type: null }), 5000);
  };

  const handlePurgeMockData = () => {
    if (window.confirm('Purge all seeded demo/sample users? This will leave strictly actual real user activity.')) {
      analytics.purgeDemoData();
      setIncludeDemo(false);
      loadData();
      setSyncStatus({ message: 'All demo and mock data purged. Displaying strictly actual live data.', type: 'success' });
      setTimeout(() => setSyncStatus({ message: '', type: null }), 4000);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadData();
    checkHealth();
    // Track admin page view
    analytics.trackPageView('admin', currentUser);
    
    // Immediate background sync check from Supabase cloud
    analytics.syncFromSupabase().then(() => loadData()).catch(() => {});

    // Live background polling so new signups from other devices show up automatically
    const interval = setInterval(() => {
      analytics.syncFromSupabase().then(() => loadData()).catch(() => {});
      checkHealth();
    }, 8000);

    return () => clearInterval(interval);
  }, [isAdmin, loadData, currentUser]);

  const stats = useMemo(() => {
    void users;
    void events;
    return analytics.getGlobalStats(includeDemo);
  }, [includeDemo, users, events]);

  // Filter & sort users
  const filteredUsers = useMemo(() => {
    return users
      .filter((u) => {
        const query = searchQuery.toLowerCase().trim();
        const matchesQuery = 
          u.name.toLowerCase().includes(query) || 
          u.email.toLowerCase().includes(query) ||
          u.id.toLowerCase().includes(query);
        const matchesProvider = 
          providerFilter === 'all' ? true : u.provider === providerFilter;
        return matchesQuery && matchesProvider;
      })
      .sort((a, b) => {
        if (sortBy === 'prints') return (b.printCount || 0) - (a.printCount || 0);
        if (sortBy === 'downloads') return (b.downloadCount || 0) - (a.downloadCount || 0);
        if (sortBy === 'views') {
          const viewsA = (a.pageViews.scanner || 0) + (a.pageViews.print || 0) + (a.pageViews.passport || 0);
          const viewsB = (b.pageViews.scanner || 0) + (b.pageViews.print || 0) + (b.pageViews.passport || 0);
          return viewsB - viewsA;
        }
        return b.lastActive - a.lastActive;
      });
  }, [users, searchQuery, providerFilter, sortBy]);

  const filteredFeedback = useMemo(() => {
    return feedbackList.filter((item) => {
      const q = feedbackSearch.toLowerCase().trim();
      const matchesSearch = !q || 
        item.token.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.email && item.email.toLowerCase().includes(q));
      const matchesFilter = feedbackFilter === 'all' || item.status === feedbackFilter;
      return matchesSearch && matchesFilter;
    });
  }, [feedbackList, feedbackSearch, feedbackFilter]);

  const handleExportCSV = () => {
    const csvContent = analytics.exportCSV(includeDemo);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PrintMate_Users_Analytics_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(analytics.getSupabaseSQLSchema());
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(seconds / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getPrimaryPage = (pageViews: UserAnalytics['pageViews']) => {
    const entries = [
      { page: 'Passport Maker', count: pageViews.passport || 0, color: 'bg-amber-50 text-amber-700 border-amber-200' },
      { page: 'Print Studio', count: pageViews.print || 0, color: 'bg-blue-50 text-blue-700 border-blue-200' },
      { page: 'Scanner', count: pageViews.scanner || 0, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    ];
    entries.sort((a, b) => b.count - a.count);
    return entries[0].count > 0 ? entries[0] : null;
  };

  if (!isAdmin) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <ShieldCheck className="w-8 h-8 text-rose-500" />
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
            Access Restricted
          </span>
          <h2 className="text-xl font-extrabold text-slate-900 mt-3 mb-2">
            Administrator Privileges Required
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed mb-6">
            Only <strong>{AUTHORIZED_ADMIN_EMAIL}</strong> has access to this telemetry console.
          </p>
          <button
            type="button"
            onClick={() => onNavigateTab('scanner')}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all cursor-pointer"
          >
            Return to Studio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/70 py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Top Header Card */}
        <div className="relative bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl overflow-hidden border border-slate-800">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-xs font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Executive Telemetry & Admin Console</span>
                </div>

                {/* Actual vs Demo Mode Indicator Badge */}
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                  includeDemo 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/30' 
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${includeDemo ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
                  <span>{includeDemo ? 'Mode: Including Mock Demo Data' : 'Mode: Actual Live Data Only'}</span>
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Studio Analytics & User Intelligence
              </h1>
              <p className="text-xs sm:text-sm text-slate-300/80 mt-1.5 max-w-2xl leading-relaxed">
                Real-time tracking of actual registered users, live page visits, document downloads, and physical print volume metrics.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Broadcast Modal Button */}
              <button
                type="button"
                onClick={() => setShowBroadcastModal(true)}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-md shadow-purple-600/25 cursor-pointer hover:scale-102 active:scale-98"
                title="Broadcast announcement email to registered studio users"
              >
                <Mail className="w-4 h-4 text-white" />
                <span>Broadcast Email</span>
              </button>

              {/* Export CSV Button */}
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer hover:scale-102 active:scale-98"
                title="Download user analytics spreadsheet in CSV format"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Export CSV</span>
              </button>

              {/* Supabase Schema Modal Button */}
              <button
                type="button"
                onClick={() => setShowSqlModal(true)}
                className="px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer hover:scale-102 active:scale-98"
                title="View Supabase table schema"
              >
                <Database className="w-4 h-4 text-cyan-400" />
                <span>Supabase Schema</span>
              </button>

              {/* Refresh & Sync Cloud Button */}
              <button
                type="button"
                onClick={handleSyncCloud}
                disabled={isSyncing}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-md shadow-blue-600/30 cursor-pointer hover:scale-102 active:scale-98 disabled:opacity-50"
                title="Sync with Supabase cloud and refresh analytics"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>

          {/* Sync Status Toast Banner */}
          {syncStatus.message && (
            <div className={`mt-5 p-3 rounded-2xl text-xs font-medium flex items-center gap-2.5 border animate-in fade-in ${
              syncStatus.type === 'success' 
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                : syncStatus.type === 'error'
                ? 'bg-rose-950/70 border-rose-500/40 text-rose-300'
                : 'bg-blue-950/70 border-blue-500/40 text-blue-300'
            }`}>
              {syncStatus.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : syncStatus.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <Cloud className="w-4 h-4 text-blue-400 shrink-0" />
              )}
              <span>{syncStatus.message}</span>
            </div>
          )}
        </div>

        {/* Supabase Cloud Connection & Diagnostics Banner */}
        {cloudHealth && (
          <div className={`rounded-2xl p-4.5 border transition-all ${
            cloudHealth.profilesTable && cloudHealth.eventsTable
              ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950'
              : 'bg-gradient-to-r from-amber-50/90 via-orange-50/80 to-blue-50/80 border-amber-200/80 text-slate-900 shadow-xs'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl mt-0.5 shrink-0 ${
                  cloudHealth.profilesTable && cloudHealth.eventsTable
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                      {cloudHealth.profilesTable && cloudHealth.eventsTable
                        ? 'Supabase Cloud Database: 100% Synchronized'
                        : 'Supabase Cloud Database: 1 Setup Step Needed for Cross-Device Sync'}
                    </h4>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      cloudHealth.profilesTable && cloudHealth.eventsTable
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {cloudHealth.profilesTable && cloudHealth.eventsTable ? 'SYNCED' : 'ACTION NEEDED'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
                    {cloudHealth.profilesTable && cloudHealth.eventsTable
                      ? 'Real-time telemetry and user profiles are securely streaming to and from your PostgreSQL database.'
                      : 'Live user actions are currently captured locally in this browser. To sync actual user signups and scans across all devices in real-time, execute the SQL script in your Supabase dashboard once.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-blue-600" />}
                  <span>{copiedSql ? 'Copied!' : 'Copy SQL Script'}</span>
                </button>

                <a
                  href="https://supabase.com/dashboard/project/bijmhruqlqovpniedmuu/sql/new"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <span>Open Supabase SQL</span>
                  <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                </a>

                <button
                  type="button"
                  onClick={handleSyncCloud}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Verify Schema</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Data Mode Switcher & Management Bar */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700">Display Mode:</span>
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setIncludeDemo(false)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  !includeDemo
                    ? 'bg-white text-emerald-700 shadow-xs font-bold border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Actual Live Data</span>
              </button>
              <button
                type="button"
                onClick={() => setIncludeDemo(true)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  includeDemo
                    ? 'bg-white text-amber-700 shadow-xs font-bold border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Include Demo / Mock Seed</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePurgeMockData}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Permanently remove mock/demo seed users from local storage"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-500 group-hover:text-rose-600" />
              <span>Purge Mock Data</span>
            </button>
          </div>
        </div>

        {/* Global KPI Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Total Users */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Users</span>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">{stats.totalUsers}</span>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                {!includeDemo ? 'Actual' : 'Total'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {stats.realUsersCount} live studio session{stats.realUsersCount === 1 ? '' : 's'} registered
            </p>
          </div>

          {/* Total Page Views */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Page Views</span>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Eye className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">{stats.totalPageViews}</span>
              <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                Impressions
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2 truncate">
              Top: <strong className="text-slate-700">{stats.pagePopularity[0]?.label || 'None yet'}</strong>
            </p>
          </div>

          {/* Total Print Jobs */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Printed</span>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Printer className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">{stats.totalPrints}</span>
              <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                Prints Sent
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">Physical printer sheets rendered</p>
          </div>

          {/* Total Downloads */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Downloaded</span>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Download className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">{stats.totalDownloads}</span>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                Clean Exports
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">300 DPI sheets & straightened cards</p>
          </div>
        </div>

        {/* Most Viewed & Most Used Pages Breakdown */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Most Viewed & Most Used Pages</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Relative popularity and tool utilization across all studio users
              </p>
            </div>
            <div className="text-xs font-medium text-slate-400">
              Ranked by overall page impression volume
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {stats.pagePopularity.map((item, idx) => {
              const Icon = item.page === 'passport' ? CreditCard : item.page === 'print' ? Printer : Crop;
              return (
                <div 
                  key={item.page}
                  className="relative p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-white shadow-xs border border-slate-200 flex items-center justify-center text-slate-700">
                          <Icon className="w-4 h-4 text-blue-600" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-900">{item.label}</h4>
                      </div>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                        #{idx + 1}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mb-4">{item.description}</p>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-700">{item.count} views</span>
                        <span className="text-blue-600">{item.percentage}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full bg-gradient-to-r ${item.color} transition-all duration-500`}
                          style={{ width: `${Math.max(item.percentage, 5)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigateTab(item.page as any)}
                    className="mt-4 pt-3 border-t border-slate-200/80 text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center justify-between cursor-pointer group-hover:translate-x-0.5 transition-transform"
                  >
                    <span>Open {item.label}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* User Directory: Detailed Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Filter Bar */}
          <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">User Intelligence Directory</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {!includeDemo ? 'Showing actual live studio users' : 'Showing all users including mock demo seed'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Search Bar */}
              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search user name or email..."
                  className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-900"
                />
              </div>

              {/* Provider Filter */}
              <select
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value as any)}
                className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="all">All Providers</option>
                <option value="google">Google OAuth</option>
                <option value="email">Email / Password</option>
                <option value="demo">Verified / Demo Accounts</option>
                <option value="guest">Guest Sessions</option>
              </select>

              {/* Sort By */}
              <div className="flex items-center gap-1.5 py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent border-none text-xs font-semibold focus:outline-none cursor-pointer text-slate-800"
                >
                  <option value="lastActive">Recently Active</option>
                  <option value="prints">Most Printed</option>
                  <option value="downloads">Most Downloaded</option>
                  <option value="views">Most Page Views</option>
                </select>
              </div>

              {/* Add Real User Button */}
              <button
                type="button"
                onClick={() => setShowAddUserModal(true)}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-blue-500/20 cursor-pointer active:scale-95"
                title="Manually register an actual user profile in directory"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Real User</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-6">User Profile</th>
                  <th className="py-3.5 px-4">Provider</th>
                  <th className="py-3.5 px-4">Most Viewed Page</th>
                  <th className="py-3.5 px-4">Tool Views</th>
                  <th className="py-3.5 px-4 text-center">Printed</th>
                  <th className="py-3.5 px-4 text-center">Downloaded</th>
                  <th className="py-3.5 px-4">Last Active</th>
                  <th className="py-3.5 px-6 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-14 text-center">
                      <div className="max-w-md mx-auto space-y-4">
                        <div className="w-14 h-14 rounded-3xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto shadow-xs">
                          <Users className="w-7 h-7 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-slate-900">
                            Live Production Directory Ready
                          </h4>
                          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                            No external accounts match the current filter. Real visitors and registered accounts are captured automatically as they access the studio.
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setShowAddUserModal(true)}
                            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-blue-500/25 cursor-pointer"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Add Real User Profile</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setIncludeDemo(true)}
                            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
                          >
                            Preview Demo Seed Data
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowSqlModal(true)}
                            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Database className="w-3.5 h-3.5 text-slate-500" />
                            <span>Setup Cloud Tables</span>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const primary = getPrimaryPage(user.pageViews);
                    const totalViews = (user.pageViews.scanner || 0) + (user.pageViews.print || 0) + (user.pageViews.passport || 0);
                    return (
                      <tr 
                        key={user.id} 
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                        onClick={() => setSelectedUser(user)}
                      >
                        {/* Profile Info */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            {user.avatarUrl ? (
                              <img
                                src={user.avatarUrl}
                                alt={user.name}
                                className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-1.5 font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                <span>{user.name}</span>
                                {user.isDemo && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                                    Mock Demo
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500">{user.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Provider */}
                        <td className="py-4 px-4">
                          {user.provider === 'google' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              Google
                            </span>
                          ) : user.provider === 'email' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                              Email
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200">
                              Guest
                            </span>
                          )}
                        </td>

                        {/* Most Viewed Page */}
                        <td className="py-4 px-4">
                          {primary ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${primary.color}`}>
                              {primary.page} ({primary.count})
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs italic">No views yet</span>
                          )}
                        </td>

                        {/* Tool Views Breakdown */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold" title="Scanner views">
                              S: {user.pageViews.scanner || 0}
                            </span>
                            <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold" title="Print studio views">
                              P: {user.pageViews.print || 0}
                            </span>
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 font-semibold" title="Passport maker views">
                              PM: {user.pageViews.passport || 0}
                            </span>
                            <span className="text-slate-400 text-[10px] ml-1">({totalViews} tot)</span>
                          </div>
                        </td>

                        {/* Printed Count */}
                        <td className="py-4 px-4 text-center">
                          <span className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50/80 text-amber-800 font-extrabold text-xs border border-amber-200/50">
                            <Printer className="w-3 h-3 text-amber-600" />
                            {user.printCount || 0}
                          </span>
                        </td>

                        {/* Downloaded Count */}
                        <td className="py-4 px-4 text-center">
                          <span className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50/80 text-emerald-800 font-extrabold text-xs border border-emerald-200/50">
                            <Download className="w-3 h-3 text-emerald-600" />
                            {user.downloadCount || 0}
                          </span>
                        </td>

                        {/* Last Active */}
                        <td className="py-4 px-4">
                          <div className="text-slate-700 font-medium">{formatTimeAgo(user.lastActive)}</div>
                          <div className="text-[10px] text-slate-400">
                            Joined {new Date(user.firstSeen).toLocaleDateString()}
                          </div>
                        </td>

                        {/* Action Details */}
                        <td className="py-4 px-6 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedUser(user);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="View user details"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Activity Event Feed */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Live Studio Activity Log</h3>
                <p className="text-xs text-slate-500">Real-time audit log of user print, download, and scan events</p>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-slate-400">Showing last 15 actions</span>
          </div>

          <div className="space-y-3">
            {events.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No live events recorded yet.</p>
            ) : (
              events.slice(0, 15).map((evt) => {
                const isPrint = evt.type === 'print';
                const isDownload = evt.type === 'download';
                const isScan = evt.type === 'scan';

                return (
                  <div
                    key={evt.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                          isPrint
                            ? 'bg-amber-100 text-amber-700'
                            : isDownload
                            ? 'bg-emerald-100 text-emerald-700'
                            : isScan
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {isPrint && <Printer className="w-3.5 h-3.5" />}
                        {isDownload && <Download className="w-3.5 h-3.5" />}
                        {isScan && <Crop className="w-3.5 h-3.5" />}
                        {!isPrint && !isDownload && !isScan && <Eye className="w-3.5 h-3.5" />}
                      </div>

                      <div>
                        <span className="font-bold text-slate-900">{evt.userName || evt.userEmail}</span>{' '}
                        <span className="text-slate-600">
                          {isPrint && 'printed document in'}
                          {isDownload && 'downloaded high-res sheet from'}
                          {isScan && 'straightened document card in'}
                          {evt.type === 'page_view' && 'visited'}
                        </span>{' '}
                        <span className="font-semibold text-blue-700 capitalize">
                          {evt.page === 'passport' ? 'Passport Maker' : evt.page === 'print' ? 'Print Studio' : evt.page}
                        </span>
                        {evt.meta?.pageSize && (
                          <span className="ml-1 text-[11px] text-slate-500 font-mono">
                            [{evt.meta.pageSize}]
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 shrink-0">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimeAgo(evt.timestamp)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* User Issue & Feature Request Management Console */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <MessageSquarePlus className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">User Issue Reports & Feature Requests</h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {feedbackList.length} total
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Track user-submitted tokens, review issues, mark them solved or added, and provide custom resolution notes.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={feedbackSearch}
                  onChange={(e) => setFeedbackSearch(e.target.value)}
                  placeholder="Search token, title, email..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 font-medium"
                />
              </div>

              {/* Status Filter */}
              <select
                value={feedbackFilter}
                onChange={(e) => setFeedbackFilter(e.target.value as any)}
                className="py-1.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses ({feedbackList.length})</option>
                <option value="pending">Pending ({feedbackList.filter(f => f.status === 'pending').length})</option>
                <option value="in_progress">In Progress ({feedbackList.filter(f => f.status === 'in_progress').length})</option>
                <option value="solved">Solved ({feedbackList.filter(f => f.status === 'solved').length})</option>
                <option value="added">Feature Added ({feedbackList.filter(f => f.status === 'added').length})</option>
              </select>

              <button
                type="button"
                onClick={refreshFeedback}
                className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                title="Refresh requests"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Feedback Toast Banner */}
          {feedbackToast && (
            <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{feedbackToast}</span>
            </div>
          )}

          {/* Table / List */}
          <div className="divide-y divide-slate-100">
            {filteredFeedback.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No user issue or feature requests match the selected filters.
              </div>
            ) : (
              filteredFeedback.map((item) => {
                const isBug = item.type === 'bug';
                const statusStyles = {
                  pending: 'bg-amber-50 text-amber-700 border-amber-200',
                  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
                  solved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                  added: 'bg-purple-50 text-purple-700 border-purple-200',
                }[item.status];

                const statusLabel = {
                  pending: 'Pending Review',
                  in_progress: 'In Progress',
                  solved: 'Solved / Fixed',
                  added: 'Feature Added',
                }[item.status];

                return (
                  <div key={item.token} className="p-5 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-extrabold px-2.5 py-0.5 rounded-md bg-slate-900 text-white tracking-wider">
                          {item.token}
                        </span>

                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                          isBug ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                        }`}>
                          {isBug ? <Bug className="w-3 h-3 text-rose-500" /> : <Lightbulb className="w-3 h-3 text-purple-500" />}
                          <span>{isBug ? 'Bug Report' : 'Feature Request'}</span>
                        </span>

                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusStyles}`}>
                          {statusLabel}
                        </span>

                        <span className="text-[11px] text-slate-400">
                          Submitted {formatTimeAgo(new Date(item.createdAt).getTime())}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{item.description}</p>

                      {item.email && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>Submitter: <strong className="text-slate-700">{item.email}</strong></span>
                        </div>
                      )}

                      {item.adminNote && (
                        <div className="mt-2 p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700 flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-slate-900">Admin Note to User:</strong> {item.adminNote}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row md:flex-col items-end gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditFeedback(item)}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Update Status / Note</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Update Feedback Item Modal */}
      {activeFeedbackEdit && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
          onClick={() => setActiveFeedbackEdit(null)}
        >
          <div
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden p-6 sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveFeedbackEdit(null)}
              className="absolute top-5 right-5 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Update Request <span className="font-mono text-blue-600">{activeFeedbackEdit.token}</span>
                </h3>
                <p className="text-xs text-slate-500">Change status and attach resolution note to notify reporter</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl mb-4 text-xs">
              <span className="font-bold text-slate-700">{activeFeedbackEdit.title}</span>
              <p className="text-slate-500 mt-0.5 line-clamp-2">{activeFeedbackEdit.description}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Request Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'pending', label: 'Pending Review' },
                    { id: 'in_progress', label: 'In Progress' },
                    { id: 'solved', label: 'Solved / Fixed' },
                    { id: 'added', label: 'Feature Added' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setEditStatus(s.id as any)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                        editStatus === s.id
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Resolution Note to Submitter
                </label>
                <textarea
                  rows={3}
                  value={editAdminNote}
                  onChange={(e) => setEditAdminNote(e.target.value)}
                  placeholder="e.g. Fixed slider styling and dark mode contrast in latest update! Thank you for reporting."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 font-medium"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  When marked as "Solved" or "Feature Added", the submitter will see an active banner notification: "Great news! Your request [Token] has been solved/added!"
                </p>
              </div>

              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveFeedbackEdit(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveFeedbackStatus}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer text-center"
                >
                  Save & Notify
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Detail Inspector Modal / Drawer */}
      {selectedUser && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedUser(null)}
              className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* User Profile Header */}
            <div className="flex items-center gap-4 mb-6">
              {selectedUser.avatarUrl ? (
                <img
                  src={selectedUser.avatarUrl}
                  alt={selectedUser.name}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-100 shadow-md"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-xl flex items-center justify-center shadow-md">
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold text-slate-900">{selectedUser.name}</h3>
                <p className="text-xs text-slate-500">{selectedUser.email}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                    {selectedUser.provider}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Joined {new Date(selectedUser.firstSeen).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Total Prints</span>
                <div className="text-2xl font-extrabold text-amber-900 mt-1">{selectedUser.printCount || 0}</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Downloads</span>
                <div className="text-2xl font-extrabold text-emerald-900 mt-1">{selectedUser.downloadCount || 0}</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Total Views</span>
                <div className="text-2xl font-extrabold text-purple-900 mt-1">
                  {(selectedUser.pageViews.scanner || 0) + (selectedUser.pageViews.print || 0) + (selectedUser.pageViews.passport || 0)}
                </div>
              </div>
            </div>

            {/* Page Breakdown */}
            <div className="space-y-2 mb-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Page Views Breakdown</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">📸 Scan & Straighten</span>
                  <span className="font-bold text-slate-900">{selectedUser.pageViews.scanner || 0} visits</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">🖨️ Print Studio</span>
                  <span className="font-bold text-slate-900">{selectedUser.pageViews.print || 0} visits</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">🪪 Passport Maker</span>
                  <span className="font-bold text-slate-900">{selectedUser.pageViews.passport || 0} visits</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedUser(null)}
              className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer"
            >
              Close Inspector
            </button>
          </div>
        </div>
      )}

      {/* Supabase Schema Modal */}
      {showSqlModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowSqlModal(false)}
        >
          <div
            className="relative w-full max-w-2xl bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 text-white overflow-hidden p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowSqlModal(false)}
              className="absolute top-5 right-5 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-blue-500/20 text-cyan-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Supabase Cloud Analytics SQL</h3>
                <p className="text-xs text-slate-400">Run this once in your Supabase SQL Editor for cloud-persisted telemetry</p>
              </div>
            </div>

            <div className="relative my-4">
              <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-cyan-300 font-mono overflow-x-auto max-h-72">
                {analytics.getSupabaseSQLSchema()}
              </pre>
              <button
                type="button"
                onClick={handleCopySql}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? 'Copied!' : 'Copy SQL'}</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-400 space-y-1">
              <p>💡 <strong>Tip:</strong> In your Supabase dashboard, go to <strong>SQL Editor</strong> → click <strong>New Query</strong> → paste this script and click <strong>Run</strong>.</p>
              <p>PrintMate will automatically log live events directly to your Supabase cloud table!</p>
            </div>
          </div>
        </div>
      )}

      {/* Add Real User Modal */}
      {showAddUserModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowAddUserModal(false)}
        >
          <div
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden p-6 sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowAddUserModal(false)}
              className="absolute top-5 right-5 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Add Real User Profile</h3>
                <p className="text-xs text-slate-500">Register an actual client/user account into the live directory</p>
              </div>
            </div>

            <form onSubmit={handleCreateRealUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="e.g. ramesh@example.com"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Authentication / Account Provider</label>
                <select
                  value={newUserProvider}
                  onChange={(e) => setNewUserProvider(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                >
                  <option value="email">Email / Password</option>
                  <option value="google">Google OAuth</option>
                  <option value="demo">Verified Studio Account</option>
                </select>
              </div>

              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer text-center"
                >
                  Save & Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Broadcast Email Modal */}
      <BroadcastEmailModal
        isOpen={showBroadcastModal}
        onClose={() => setShowBroadcastModal(false)}
        users={users}
      />
    </div>
  );
};
