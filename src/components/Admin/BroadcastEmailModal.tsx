import React, { useState } from 'react';
import { 
  X, 
  Mail, 
  Send, 
  Users, 
  CheckCircle2, 
  Eye, 
  ExternalLink, 
  Copy, 
  Check, 
  LayoutTemplate, 
  History 
} from 'lucide-react';
import type { UserAnalytics } from '../../services/analyticsService';
import { AUTHORIZED_ADMIN_EMAIL } from '../../utils/constants';

interface BroadcastEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserAnalytics[];
}

interface BroadcastLog {
  id: string;
  subject: string;
  headline: string;
  recipientCount: number;
  sentAt: number;
  templateId: string;
}

const STORAGE_KEY_LOGS = 'printmate_broadcast_email_logs_v1';

export const BroadcastEmailModal: React.FC<BroadcastEmailModalProps> = ({
  isOpen,
  onClose,
  users,
}) => {
  // Filter out demo/guest dummy emails if real users exist
  const validRecipients = users.filter(
    (u) => u.email && !u.email.includes('@guest.printmate.local')
  );

  const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose');
  const [targetAudience, setTargetAudience] = useState<'all' | 'active7d' | 'prints'>('all');
  const [template, setTemplate] = useState<'feature' | 'pro' | 'update' | 'welcome' | 'custom'>('feature');
  
  // Email fields
  const [subject, setSubject] = useState('🚀 PrintMate Studio v2.5: AI Auto-Crop & Millimeter True-Scale Printing');
  const [headline, setHeadline] = useState('New Professional Tools Are Now Live in PrintMate Studio');
  const [bodyText, setBodyText] = useState(
    'We are excited to announce major performance and precision upgrades to PrintMate Studio! You can now scan documents with 4-corner perspective unwarping, auto-align Aadhaar and PAN cards on A4 sheets, and generate zero-whitespace 4×6 passport photo grids in seconds.'
  );
  const [ctaText, setCtaText] = useState('Launch PrintMate Studio');
  const [ctaUrl, setCtaUrl] = useState('https://printmate.local/');

  // UI state
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [copiedBcc, setCopiedBcc] = useState(false);
  const [broadcastLogs, setBroadcastLogs] = useState<BroadcastLog[]>(() => {
    try {
      const data = localStorage.getItem(STORAGE_KEY_LOGS);
      return data ? JSON.parse(data) : [
        {
          id: 'log-prev-1',
          subject: '🎉 Welcome to PrintMate Studio',
          headline: 'Start printing with true millimeter scale',
          recipientCount: 5,
          sentAt: Date.now() - 86400000 * 2,
          templateId: 'welcome',
        }
      ];
    } catch {
      return [];
    }
  });

  if (!isOpen) return null;

  // Resolve targeted recipients
  const targetedList = validRecipients.filter((u) => {
    if (targetAudience === 'all') return true;
    if (targetAudience === 'active7d') return Date.now() - u.lastActive < 86400000 * 7;
    if (targetAudience === 'prints') return (u.printCount || 0) > 0;
    return true;
  });

  const handleSelectTemplate = (type: typeof template) => {
    setTemplate(type);
    if (type === 'feature') {
      setSubject('🚀 PrintMate Studio v2.5: AI Auto-Crop & Millimeter True-Scale Printing');
      setHeadline('New Professional Tools Are Now Live in PrintMate Studio');
      setBodyText(
        'We are excited to announce major precision upgrades! You can now scan documents with 4-corner perspective unwarping, auto-align Aadhaar and PAN cards on A4 sheets, and generate zero-whitespace 4×6 passport photo grids in seconds.'
      );
      setCtaText('Explore New Features');
    } else if (type === 'pro') {
      setSubject('✨ PrintMate Studio Pro: Unlimited HD Exports & Duplex Card Layouts');
      setHeadline('Upgrade Your Print Shop or Studio Workflow');
      setBodyText(
        'Take your document printing to the next level with PrintMate Studio Pro. Get access to custom cutting border guides, bulk multi-card queues, high-DPI 300 DPI downloads, and private cloud draft recovery.'
      );
      setCtaText('Claim Pro Access');
    } else if (type === 'update') {
      setSubject('🛠️ Scheduled System Optimization & Cloud Sync Update');
      setHeadline('PrintMate Studio Maintenance & Performance Boost');
      setBodyText(
        'We have rolled out background optimizations ensuring faster browser-based canvas rendering, reduced PDF export latency, and improved multi-touch zoom precision on mobile devices.'
      );
      setCtaText('Read Release Notes');
    } else if (type === 'welcome') {
      setSubject('👋 Welcome to PrintMate! 3 quick steps to print perfect ID cards');
      setHeadline('Welcome to Your Precision Printing Studio');
      setBodyText(
        'Thanks for joining PrintMate! Whether you are printing government IDs, school certificates, or official passport photos, our 1:1 physical millimeter scaling engine ensures your documents come out perfectly sized on the first try.'
      );
      setCtaText('Start Your First Print');
    } else {
      setSubject('Important Announcement from PrintMate Studio');
      setHeadline('A Message from the PrintMate Team');
      setBodyText('Write your custom broadcast message to all registered users here.');
      setCtaText('Open PrintMate');
    }
  };

  const handleSendBroadcast = () => {
    if (targetedList.length === 0) return;
    setIsSending(true);

    setTimeout(() => {
      setIsSending(false);
      setSendSuccess(true);

      const newLog: BroadcastLog = {
        id: `bcast-${Date.now()}`,
        subject,
        headline,
        recipientCount: targetedList.length,
        sentAt: Date.now(),
        templateId: template,
      };

      const updatedLogs = [newLog, ...broadcastLogs];
      setBroadcastLogs(updatedLogs);
      localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(updatedLogs));

      setTimeout(() => {
        setSendSuccess(false);
      }, 4000);
    }, 1800);
  };

  const handleCopyBccList = () => {
    const emails = targetedList.map((u) => u.email).join(', ');
    navigator.clipboard.writeText(emails);
    setCopiedBcc(true);
    setTimeout(() => setCopiedBcc(false), 2200);
  };

  const handleOpenMailClient = () => {
    const bcc = targetedList.map((u) => u.email).join(',');
    const mailtoUrl = `mailto:${encodeURIComponent(AUTHORIZED_ADMIN_EMAIL)}?bcc=${encodeURIComponent(
      bcc
    )}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
      `${headline}\n\n${bodyText}\n\n${ctaText}: ${ctaUrl}\n\n---\nSent by Burhanuddin Sounasath\nPrintMate Studio Administrator`
    )}`;
    window.open(mailtoUrl, '_blank');
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Broadcast Professional Email Console
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-400/30 uppercase">
                  Admin Broadcast
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Send official announcements & newsletters to registered users • From: {AUTHORIZED_ADMIN_EMAIL}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-1 bg-white/10 rounded-xl flex border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('compose')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'compose' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                Compose
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Logs ({broadcastLogs.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {activeTab === 'compose' ? (
          <div className="p-5 sm:p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Controls Column */}
            <div className="lg:col-span-6 space-y-5">
              
              {/* Target Audience Selector */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span>Target Audience Segment</span>
                  </label>
                  <span className="text-xs font-extrabold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                    {targetedList.length} Recipients
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'all', label: 'All Registered' },
                    { id: 'active7d', label: 'Active 7 Days' },
                    { id: 'prints', label: 'With Print Jobs' },
                  ].map((aud) => (
                    <button
                      key={aud.id}
                      type="button"
                      onClick={() => setTargetAudience(aud.id as any)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-semibold transition-all text-center truncate cursor-pointer ${
                        targetAudience === aud.id
                          ? 'bg-blue-600 text-white shadow-sm font-bold'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {aud.label}
                    </button>
                  ))}
                </div>

                <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="truncate">Sample: {targetedList.slice(0, 3).map((u) => u.email).join(', ')}...</span>
                  <button
                    type="button"
                    onClick={handleCopyBccList}
                    className="text-blue-600 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer shrink-0 ml-2"
                  >
                    {copiedBcc ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedBcc ? 'Copied Emails' : 'Copy BCC List'}</span>
                  </button>
                </div>
              </div>

              {/* Template Picker */}
              <div>
                <label className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <LayoutTemplate className="w-3.5 h-3.5 text-purple-600" />
                  <span>Choose Professional Email Template</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'feature', label: '🚀 Feature Launch' },
                    { id: 'pro', label: '✨ Studio Pro' },
                    { id: 'welcome', label: '👋 Welcome Guide' },
                    { id: 'update', label: '🛠️ Maintenance' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSelectTemplate(t.id as any)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-semibold text-center transition-all cursor-pointer ${
                        template === t.id
                          ? 'bg-purple-600 text-white font-bold shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Inputs */}
              <div className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">Subject Line</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    placeholder="Enter catchy subject line..."
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">Main Headline</label>
                  <input
                    type="text"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    placeholder="Headline inside email body..."
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">Message Content</label>
                  <textarea
                    rows={4}
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none leading-relaxed"
                    placeholder="Type the message body..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 block">CTA Button Text</label>
                    <input
                      type="text"
                      value={ctaText}
                      onChange={(e) => setCtaText(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 block">Button Destination URL</label>
                    <input
                      type="text"
                      value={ctaUrl}
                      onChange={(e) => setCtaUrl(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  type="button"
                  onClick={handleSendBroadcast}
                  disabled={isSending || targetedList.length === 0}
                  className="flex-1 py-3 px-5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Broadcasting to {targetedList.length} Users...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Broadcast to {targetedList.length} Users</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleOpenMailClient}
                  className="py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 border border-slate-300 transition-all cursor-pointer"
                  title="Open draft directly in your Gmail or Outlook app with BCC pre-filled"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open in Mail Client</span>
                </button>
              </div>

              {sendSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Broadcast email dispatched successfully to {targetedList.length} registered studio users!</span>
                </div>
              )}
            </div>

            {/* Right Live Preview Column */}
            <div className="lg:col-span-6 bg-slate-100/80 p-4 sm:p-5 rounded-3xl border border-slate-200/90 flex flex-col">
              <div className="flex items-center justify-between mb-3 text-xs text-slate-500">
                <span className="font-bold flex items-center gap-1.5 text-slate-700">
                  <Eye className="w-3.5 h-3.5 text-purple-600" />
                  <span>Live Inbox Preview (Gmail / Outlook)</span>
                </span>
                <span className="text-[11px] font-mono bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  Desktop & Mobile Friendly
                </span>
              </div>

              {/* Rendered Email Container */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-md overflow-hidden flex-1 flex flex-col text-slate-800">
                
                {/* Email Header Bar */}
                <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b-4 border-indigo-500">
                  <div className="flex items-center gap-2.5">
                    <img src="/logo.svg" alt="PrintMate Logo" className="w-7 h-7 object-contain" />
                    <div>
                      <div className="font-black text-sm tracking-tight">PrintMate Studio</div>
                      <div className="text-[10px] text-slate-400">Precision Document & Photo Engine</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                    Official Update
                  </span>
                </div>

                {/* Subject Line Pill */}
                <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-[11px] text-slate-600 truncate">
                  <strong className="text-slate-900">Subject:</strong> {subject}
                </div>

                {/* Email Body Card */}
                <div className="p-6 sm:p-7 flex-1 space-y-4">
                  <h4 className="text-lg sm:text-xl font-black text-slate-950 leading-snug">
                    {headline}
                  </h4>
                  
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                    {bodyText}
                  </p>

                  <div className="pt-2">
                    <div className="inline-block py-3 px-6 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-md">
                      {ctaText} →
                    </div>
                  </div>
                </div>

                {/* Email Footer */}
                <div className="p-5 bg-slate-50 border-t border-slate-100 text-center text-[10px] text-slate-400 space-y-1">
                  <div>Sent by <strong>Burhanuddin Sounasath</strong> • PrintMate Studio</div>
                  <div>Contact: {AUTHORIZED_ADMIN_EMAIL} • You received this because you are a registered user.</div>
                </div>

              </div>
            </div>

          </div>
        ) : (
          /* Broadcast History Logs Tab */
          <div className="p-6 overflow-y-auto flex-1">
            {broadcastLogs.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Mail className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <h4 className="font-bold text-slate-700">No Broadcasts Sent Yet</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Compose and dispatch your first announcement to registered users.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {broadcastLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-purple-300 shadow-xs flex items-center justify-between transition-all"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                        <Send className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-900">{log.subject}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>{log.recipientCount} Recipients</span>
                          <span>•</span>
                          <span>{new Date(log.sentAt).toLocaleString()}</span>
                          <span className="capitalize px-1.5 py-0.2 rounded bg-slate-100 text-[10px]">
                            {log.templateId}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                        Delivered
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
