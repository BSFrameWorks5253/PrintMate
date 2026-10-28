import React, { useState, useEffect } from 'react';
import { 
  X, 
  MessageSquarePlus, 
  Search, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  Bug, 
  Lightbulb, 
  Copy, 
  Check, 
  ArrowRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { feedbackService, type FeedbackItem } from '../../services/feedbackService';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  userEmail = '',
}) => {
  const [activeTab, setActiveTab] = useState<'submit' | 'track'>('submit');
  
  // Submit Form State
  const [type, setType] = useState<'bug' | 'feature'>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState(userEmail);
  const [submittedItem, setSubmittedItem] = useState<FeedbackItem | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Track State
  const [searchToken, setSearchToken] = useState('');
  const [searchResult, setSearchResult] = useState<FeedbackItem | null>(null);
  const [searchSearched, setSearchSearched] = useState(false);
  const [myItems, setMyItems] = useState<FeedbackItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      setMyItems(feedbackService.getMySubmittedItems());
    }
  }, [isOpen]);

  useEffect(() => {
    if (userEmail && !email) {
      setEmail(userEmail);
    }
  }, [userEmail]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    const created = feedbackService.submit({
      type,
      title,
      description,
      email: email || undefined,
    });

    setSubmittedItem(created);
    setMyItems(feedbackService.getMySubmittedItems());
    setTitle('');
    setDescription('');
  };

  const handleCopy = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchToken.trim()) return;
    const found = feedbackService.getByToken(searchToken);
    setSearchResult(found);
    setSearchSearched(true);
    if (found) {
      feedbackService.markAsViewed(found.token);
    }
  };

  const getStatusBadge = (status: FeedbackItem['status']) => {
    switch (status) {
      case 'solved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>SOLVED</span>
          </span>
        );
      case 'added':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>FEATURE ADDED</span>
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>IN PROGRESS</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>PENDING REVIEW</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 max-w-xl w-full shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25 shrink-0">
            <MessageSquarePlus className="w-5 h-5 text-cyan-200" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Report an Issue or Request a Feature
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Submit your request and get an instant Token Number to track resolution.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => { setActiveTab('submit'); setSubmittedItem(null); }}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'submit'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            <span>Submit Request</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('track')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'track'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Track by Token ({myItems.length})</span>
          </button>
        </div>

        {/* TAB 1: SUBMIT NEW */}
        {activeTab === 'submit' && (
          <div>
            {submittedItem ? (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5 text-center space-y-4 animate-in fade-in">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Request Received Successfully!
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Your unique tracking token number is generated below:
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2 max-w-xs mx-auto">
                  <div className="font-mono text-lg font-black tracking-widest bg-white dark:bg-slate-900 text-blue-700 dark:text-cyan-300 px-4 py-2 rounded-xl border border-blue-200 dark:border-slate-700 shadow-xs">
                    {submittedItem.token}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(submittedItem.token)}
                    className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all cursor-pointer shadow-sm"
                    title="Copy Token to clipboard"
                  >
                    {copiedToken ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Save this token number! When an administrator reviews and solves your issue or adds your requested feature, you will receive an automatic notification in this app.
                </p>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSubmittedItem(null)}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
                  >
                    Submit Another
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchToken(submittedItem.token);
                      setActiveTab('track');
                      const found = feedbackService.getByToken(submittedItem.token);
                      setSearchResult(found);
                      setSearchSearched(true);
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span>View Status</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Type toggle */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    What would you like to submit?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setType('bug')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        type === 'bug'
                          ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 shadow-2xs'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      <Bug className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                      <span>Bug or Fix</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('feature')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        type === 'feature'
                          ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 shadow-2xs'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>New Feature / Idea</span>
                    </button>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Subject / Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={type === 'bug' ? 'e.g., Sliders not visible on Chrome' : 'e.g., Add A5 paper size layout'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Details / Description *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what should be added or what went wrong in detail..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                {/* Email (Optional) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Your Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your-email@example.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Submit button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-500/25 transition-all cursor-pointer"
                  >
                    <span>Submit & Get Token Number</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* TAB 2: TRACK BY TOKEN */}
        {activeTab === 'track' && (
          <div className="space-y-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={searchToken}
                onChange={(e) => setSearchToken(e.target.value)}
                placeholder="Enter Token (e.g. PM-10248)"
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono uppercase outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all cursor-pointer"
              >
                Search
              </button>
            </form>

            {/* Search Result Card */}
            {searchSearched && (
              searchResult ? (
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-blue-700 dark:text-cyan-300">
                      {searchResult.token}
                    </span>
                    {getStatusBadge(searchResult.status)}
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{searchResult.title}</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      {searchResult.description}
                    </p>
                  </div>

                  {searchResult.adminNote && (
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1">
                      <div className="text-[11px] font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Admin Resolution Note:</span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300">
                        "{searchResult.adminNote}"
                      </p>
                    </div>
                  )}

                  <div className="text-[10px] text-slate-400 pt-1">
                    Submitted: {new Date(searchResult.createdAt).toLocaleDateString()}
                    {searchResult.resolvedAt && ` • Updated: ${new Date(searchResult.resolvedAt).toLocaleDateString()}`}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-center text-xs text-rose-700 dark:text-rose-300 flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>No request found matching token "{searchToken}". Please check and try again.</span>
                </div>
              )
            )}

            {/* List of recent tickets on this device */}
            {myItems.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Requests Submitted on this Device
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {myItems.map((item) => (
                    <div
                      key={item.token}
                      onClick={() => {
                        setSearchToken(item.token);
                        setSearchResult(item);
                        setSearchSearched(true);
                      }}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-400 transition-all cursor-pointer flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {item.title}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {item.token} • {new Date(item.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        {getStatusBadge(item.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
