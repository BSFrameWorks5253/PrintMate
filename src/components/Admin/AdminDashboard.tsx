import React, { useState, useEffect, useMemo } from 'react';
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
  Mail
} from 'lucide-react';
import { analytics, type UserAnalytics, type AnalyticsEvent } from '../../services/analyticsService';
import { useAuth } from '../../context/AuthContext';
import { isAuthorizedAdmin, AUTHORIZED_ADMIN_EMAIL } from '../../utils/constants';
import { BroadcastEmailModal } from './BroadcastEmailModal';

interface AdminDashboardProps {
  onNavigateTab: (tab: 'scanner' | 'print' | 'passport') => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigateTab }) => {
  const { user: currentUser } = useAuth();
  const isAdmin = isAuthorizedAdmin(currentUser?.email);

  const [users, setUsers] = useState<UserAnalytics[]>([]);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState<'all' | 'google' | 'email' | 'guest'>('all');
  const [sortBy, setSortBy] = useState<'lastActive' | 'prints' | 'downloads' | 'views'>('lastActive');
  const [selectedUser, setSelectedUser] = useState<UserAnalytics | null>(null);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  // Early return if unauthorized
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

  // Load analytics data
  const refreshData = () => {
    setUsers(analytics.getAllUsers());
    setEvents(analytics.getEventsList());
  };

  useEffect(() => {
    refreshData();
    // Track admin page view
    analytics.trackPageView('admin', currentUser);
  }, []);

  const stats = useMemo(() => {
    return analytics.getGlobalStats();
  }, [users, events]);

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

  const handleExportCSV = () => {
    const csvContent = analytics.exportCSV();
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
    const hours = Math.floor(minutes / 60);
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

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/70 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Top Header Card */}
        <div className="relative bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl overflow-hidden border border-slate-800">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-xs font-semibold mb-3">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Executive Telemetry & Admin Console</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Studio Analytics & User Intelligence
              </h1>
              <p className="text-xs sm:text-sm text-slate-300/80 mt-1.5 max-w-2xl leading-relaxed">
                Track all registered & active studio users, real-time page engagement, document download frequencies, and physical print volume counts.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowBroadcastModal(true)}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-md shadow-purple-600/25 cursor-pointer hover:scale-102 active:scale-98"
                title="Broadcast professional announcement email to registered studio users"
              >
                <Mail className="w-4 h-4 text-white" />
                <span>Broadcast Email</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/15 text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer hover:scale-102 active:scale-98"
                title="Download user analytics spreadsheet in CSV format"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSqlModal(true)}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/15 text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer hover:scale-102 active:scale-98"
                title="View Supabase table schema"
              >
                <Database className="w-4 h-4 text-cyan-400" />
                <span>Supabase Schema</span>
              </button>

              <button
                type="button"
                onClick={refreshData}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-md shadow-blue-600/30 cursor-pointer hover:scale-102 active:scale-98"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
            </div>
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
                Active
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
              Top: <strong className="text-slate-700">{stats.pagePopularity[0]?.label}</strong>
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
                Full breakdown of all registered users, their most viewed tools, total printed sheets, and downloads
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
                  className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
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
                <option value="guest">Guest Sessions</option>
              </select>

              {/* Sort By */}
              <div className="flex items-center gap-1.5 py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent border-none text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="lastActive">Recently Active</option>
                  <option value="prints">Most Printed</option>
                  <option value="downloads">Most Downloaded</option>
                  <option value="views">Most Page Views</option>
                </select>
              </div>
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
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No users found matching your search query.
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
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-500 border border-slate-200">
                                    Demo
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
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
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
              <p className="text-xs text-slate-400 italic">No events recorded yet.</p>
            ) : (
              events.slice(0, 10).map((evt) => {
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
                          <span className="ml-1 text-[11px] text-slate-400 font-mono">
                            [{evt.meta.pageSize}]
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 shrink-0">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimeAgo(evt.timestamp)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

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
              className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
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
                <p className="text-xs text-slate-400">Run this in your Supabase SQL Editor for cloud-persisted telemetry</p>
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

      {/* Broadcast Email Modal */}
      <BroadcastEmailModal
        isOpen={showBroadcastModal}
        onClose={() => setShowBroadcastModal(false)}
        users={users}
      />
    </div>
  );
};
