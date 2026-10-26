import React, { useState, useEffect } from 'react';
import { 
  X, 
  LogIn, 
  UserPlus, 
  Mail, 
  Lock, 
  User, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  Printer,
  Zap,
  Check,
  Layers,
  Send,
  KeyRound
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    authPromptReason,
    closeAuthModal,
    loginWithGoogle,
    loginWithEmail,
    signUpWithEmail,
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup' | 'magiclink'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showSignUpRedirect, setShowSignUpRedirect] = useState(false);
  const [showSignInRedirect, setShowSignInRedirect] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isAuthModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) return null;

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    setShowSignUpRedirect(false);
    setShowSignInRedirect(false);
    const { error } = await loginWithGoogle();
    setLoading(false);
    if (error) {
      setErrorMessage(error.message);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    setShowSignUpRedirect(false);
    setShowSignInRedirect(false);

    if (mode === 'magiclink') {
      const res = await loginWithEmail(email);
      setLoading(false);
      if (res.error) {
        setErrorMessage(res.error.message);
      } else {
        setSuccessMessage(res.message || 'Magic login link sent! Check your inbox.');
      }
      return;
    }

    if (mode === 'signin') {
      const res = await loginWithEmail(email, password);
      setLoading(false);
      if (res.error) {
        const rawErr = (res.error.message || '').toLowerCase();
        if (
          rawErr.includes('invalid login credentials') ||
          rawErr.includes('user not found') ||
          rawErr.includes('invalid credential')
        ) {
          setErrorMessage("User doesn't exist with this email or password is invalid. Please sign up to create your account.");
          setShowSignUpRedirect(true);
        } else {
          setErrorMessage(res.error.message);
        }
      } else if (res.message) {
        setSuccessMessage(res.message);
      }
    } else {
      if (!password || password.length < 6) {
        setLoading(false);
        setErrorMessage('Password must contain at least 6 characters.');
        return;
      }
      const res = await signUpWithEmail(email, password, name);
      setLoading(false);
      if (res.error) {
        const rawErr = (res.error.message || '').toLowerCase();
        if (rawErr.includes('already registered') || rawErr.includes('already exists')) {
          setErrorMessage('An account with this email already exists. Please sign in instead.');
          setShowSignInRedirect(true);
        } else {
          setErrorMessage(res.error.message);
        }
      } else if (res.message) {
        setSuccessMessage(res.message);
      }
    }
  };

  const switchMode = (newMode: 'signin' | 'signup' | 'magiclink') => {
    setMode(newMode);
    setErrorMessage('');
    setSuccessMessage('');
    setShowSignUpRedirect(false);
    setShowSignInRedirect(false);
  };

  // Password strength helper
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 8) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass) || /[A-Z]/.test(pass)) score++;
    
    if (score <= 1) return { score: 1, label: 'Weak', barColor: 'bg-rose-500', textColor: 'text-rose-500' };
    if (score === 2) return { score: 2, label: 'Fair', barColor: 'bg-amber-500', textColor: 'text-amber-500' };
    if (score === 3) return { score: 3, label: 'Good', barColor: 'bg-blue-500', textColor: 'text-blue-500' };
    return { score: 4, label: 'Strong', barColor: 'bg-emerald-500', textColor: 'text-emerald-500' };
  };

  const strength = getPasswordStrength(password);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
      onClick={closeAuthModal}
    >
      <div 
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-100 overflow-hidden flex flex-col md:flex-row transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-slate-100/80 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-all cursor-pointer backdrop-blur-xs shadow-xs hover:scale-105 active:scale-95"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Left Side: Brand Showcase Panel */}
        <div className="relative md:w-5/12 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white p-8 md:p-10 flex flex-col justify-between overflow-hidden">
          {/* Subtle Dynamic Ambient Glows */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />

          {/* Header & Logo */}
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 p-0.5 shadow-lg shadow-blue-500/30 flex items-center justify-center">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                  <Printer className="w-5 h-5 text-cyan-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xl tracking-tight text-white">PrintMate</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                    STUDIO
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium">Smart Printing & Layout Engine</p>
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                All your print layouts, synced seamlessly.
              </h2>
              <p className="text-xs md:text-sm text-slate-300/80 leading-relaxed">
                Connect your account to save custom passport sets, queue multi-photo sheets, and export anytime.
              </p>
            </div>
          </div>

          {/* Feature Highlights List */}
          <div className="relative z-10 my-8 space-y-3.5">
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-100">Smart Document Framing</h4>
                <p className="text-[11px] text-slate-400">Automatic 4-corner perspective correction for passports & IDs.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-100">Instant Multi-Grid Print</h4>
                <p className="text-[11px] text-slate-400">Pack 1x, 2x, 4x, 6x, or 8x images on 4x6, 5x7, & A4 sheets with zero distortion.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-100">Forever Free & Cloud-Ready</h4>
                <p className="text-[11px] text-slate-400">Unlimited sessions with instant Google 1-tap sign in.</p>
              </div>
            </div>
          </div>

          {/* Trust Footnote */}
          <div className="relative z-10 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Supabase 256-bit Secure</span>
            </div>
            <div className="flex items-center gap-1 text-slate-300">
              <Check className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-semibold">Free Forever</span>
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Authentication Form */}
        <div className="md:w-7/12 p-8 md:p-10 flex flex-col justify-between bg-white overflow-y-auto max-h-[85vh] md:max-h-none">
          <div>
            {/* Contextual Lock Prompt Callout */}
            {authPromptReason && (
              <div className="mb-5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-900 animate-in fade-in">
                <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900">Sign in required to {authPromptReason}</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Your current work-in-progress and print queue are securely preserved and will be waiting for you right when you sign in!
                  </div>
                </div>
              </div>
            )}

            {/* Segmented Mode Selector Switch */}
            <div className="p-1 bg-slate-100 rounded-2xl flex border border-slate-200/80 mb-6">
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  mode === 'signin'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Create Account</span>
              </button>
            </div>

            {/* Title / Description */}
            <div className="mb-6">
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {mode === 'signin' && 'Welcome back'}
                {mode === 'signup' && 'Create your free account'}
                {mode === 'magiclink' && 'Sign in with Magic Link'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {mode === 'signin' && 'Enter your credentials or use 1-click Google sign in.'}
                {mode === 'signup' && 'Get started in seconds — no credit card needed.'}
                {mode === 'magiclink' && "We'll send an instant login link directly to your inbox."}
              </p>
            </div>

            {/* Status Notifications */}
            {errorMessage && (
              <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                <div className="flex-1 font-medium">{errorMessage}</div>
              </div>
            )}

            {/* User Doesn't Exist -> Prompt to Sign Up */}
            {showSignUpRedirect && (
              <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 text-amber-900 text-xs flex flex-col gap-2.5 shadow-sm animate-in fade-in">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <UserPlus className="w-4 h-4 text-amber-600" />
                  <span>Account not found — Create your account</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  No registered account was found with <strong>{email}</strong>. Would you like to create a free account right now?
                </p>
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer hover:shadow-md"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Switch to Sign Up (Pre-fill {email})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Account Already Exists -> Prompt to Sign In */}
            {showSignInRedirect && (
              <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 text-blue-900 text-xs flex flex-col gap-2.5 shadow-sm animate-in fade-in">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <LogIn className="w-4 h-4 text-blue-600" />
                  <span>Existing account found</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  An account is already registered with <strong>{email}</strong>. Please sign in with your password.
                </p>
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer hover:shadow-md"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Switch to Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                <div className="flex-1 font-medium">{successMessage}</div>
              </div>
            )}

            {/* 1-Click Google OAuth Button */}
            {mode !== 'magiclink' && (
              <>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/80 text-slate-700 hover:text-slate-900 text-xs font-bold flex items-center justify-center gap-3 shadow-xs hover:shadow-md transition-all duration-200 disabled:opacity-50 cursor-pointer hover:border-slate-300 active:scale-[0.99]"
                >
                  {/* Google Colorful G SVG */}
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{mode === 'signin' ? 'Sign In with Google' : 'Sign Up with Google'}</span>
                </button>

                {/* Subtitle Hint */}
                <div className="text-center mt-2">
                  {mode === 'signin' ? (
                    <span className="text-[11px] text-slate-500">
                      New to PrintMate?{' '}
                      <button
                        type="button"
                        onClick={() => switchMode('signup')}
                        className="text-blue-600 font-bold hover:underline cursor-pointer"
                      >
                        Sign up with Google here
                      </button>
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500">
                      Already registered?{' '}
                      <button
                        type="button"
                        onClick={() => switchMode('signin')}
                        className="text-blue-600 font-bold hover:underline cursor-pointer"
                      >
                        Sign in with Google here
                      </button>
                    </span>
                  )}
                </div>

                {/* Divider */}
                <div className="relative flex items-center justify-center my-5">
                  <div className="border-t border-slate-200 w-full" />
                  <span className="bg-white px-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wider absolute">
                    or continue with email
                  </span>
                </div>
              </>
            )}

            {/* Email Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full pl-10 pr-4 py-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all font-medium text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-10 pr-4 py-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all font-medium text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>

              {mode !== 'magiclink' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Password
                    </label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => switchMode('magiclink')}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer hover:underline"
                      >
                        Forgot or no password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required={mode === 'signup'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'signup' ? 'Create a secure password' : 'Enter your password'}
                      className="w-full pl-10 pr-11 py-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all font-medium text-slate-900 placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength Meter for Signup */}
                  {mode === 'signup' && password.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">Password strength:</span>
                        <span className={`font-bold ${strength.textColor}`}>{strength.label}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
                        <div className={`h-full rounded-full transition-all duration-300 ${strength.score >= 1 ? strength.barColor : 'bg-transparent'}`} />
                        <div className={`h-full rounded-full transition-all duration-300 ${strength.score >= 2 ? strength.barColor : 'bg-transparent'}`} />
                        <div className={`h-full rounded-full transition-all duration-300 ${strength.score >= 3 ? strength.barColor : 'bg-transparent'}`} />
                        <div className={`h-full rounded-full transition-all duration-300 ${strength.score >= 4 ? strength.barColor : 'bg-transparent'}`} />
                      </div>
                      <p className="text-[10px] text-slate-400">Use 8+ characters with numbers or symbols.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Submit CTA Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:via-indigo-500 hover:to-blue-600 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/35 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processing...</span>
                  </div>
                ) : mode === 'signin' ? (
                  <>
                    <span>Sign In to PrintMate</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : mode === 'signup' ? (
                  <>
                    <span>Create Free Account</span>
                    <Sparkles className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>Send Magic Login Link</span>
                    <Send className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Magic Link Switcher Helper */}
            {mode === 'magiclink' && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer inline-flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Back to password sign in</span>
                </button>
              </div>
            )}
          </div>

          {/* Legal / Privacy Footnote */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-400">
              By continuing, you agree to PrintMate's{' '}
              <span className="text-slate-600 hover:underline cursor-pointer">Terms of Service</span> and{' '}
              <span className="text-slate-600 hover:underline cursor-pointer">Privacy Policy</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
