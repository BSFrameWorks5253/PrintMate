import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { getSupabase, getSupabaseConfig, setSupabaseConfig, resetSupabaseClient } from '../lib/supabase';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  provider: string;
  createdAt: number;
}

interface AuthContextType {
  user: UserProfile | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  loginWithGoogle: () => Promise<{ error: Error | null }>;
  loginWithEmail: (email: string, password?: string) => Promise<{ error: Error | null; message?: string }>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<{ error: Error | null; message?: string }>;
  loginAsDemo: (name?: string, email?: string) => void;
  logout: () => Promise<void>;
  isAuthModalOpen: boolean;
  authPromptReason: string | null;
  openAuthModal: (reason?: string) => void;
  closeAuthModal: () => void;
  saveCredentials: (url: string, key: string) => void;
  supabaseUrl: string;
  supabaseKey: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authPromptReason, setAuthPromptReason] = useState<string | null>(null);
  const [config, setConfig] = useState(getSupabaseConfig());

  // Helper to map Supabase User to UserProfile
  const mapUser = (sbUser: User): UserProfile => {
    return {
      id: sbUser.id,
      name:
        sbUser.user_metadata?.full_name ||
        sbUser.user_metadata?.name ||
        sbUser.email?.split('@')[0] ||
        'User',
      email: sbUser.email || '',
      avatarUrl:
        sbUser.user_metadata?.avatar_url ||
        sbUser.user_metadata?.picture ||
        undefined,
      provider: sbUser.app_metadata?.provider || 'supabase',
      createdAt: new Date(sbUser.created_at).getTime(),
    };
  };

  // Helper to remove unsightly Supabase OAuth token fragments (#access_token=...) from the address bar
  // Only called AFTER session has been established and persisted by Supabase
  const sanitizeAuthHashFromUrl = () => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (
      hash &&
      (hash.includes('access_token') ||
        hash.includes('refresh_token') ||
        hash.includes('token_type') ||
        hash.includes('error_description') ||
        hash.includes('type=recovery') ||
        hash.includes('type=signup'))
    ) {
      const rawPath = window.location.pathname;
      const cleanPath = !rawPath || rawPath === '/' ? '/home' : rawPath;
      const cleanSearch = window.location.search || '';
      window.history.replaceState(null, document.title, `${cleanPath}${cleanSearch}`);
    }
  };

  // Listen to Supabase Auth State
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setIsLoading(false);
      setUser(null);
      setSession(null);
      return;
    }

    setIsLoading(true);

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSession(session);
        setUser(mapUser(session.user));
        setIsLoading(false);
        setIsAuthModalOpen(false);
        sanitizeAuthHashFromUrl();
      } else {
        // Fallback: check for locally persisted user session
        try {
          const localUser = localStorage.getItem('printmate_local_user');
          if (localUser) {
            setUser(JSON.parse(localUser));
          } else {
            setUser(null);
          }
        } catch {
          setUser(null);
        }
        setSession(null);
        setIsLoading(false);
      }
    });

    // Realtime auth listener (OAuth redirects, tokens, signouts)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setSession(session);
        setUser(mapUser(session.user));
        setIsLoading(false);
        setIsAuthModalOpen(false);
        sanitizeAuthHashFromUrl();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [config.url, config.key]);

  // Real Google OAuth Redirect via Supabase
  const loginWithGoogle = async (): Promise<{ error: Error | null }> => {
    const supabase = getSupabase();
    if (!supabase) {
      return {
        error: new Error('Supabase is not configured yet. Please enter your free Supabase URL and anon key in the setup tab.'),
      };
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  // Email / Password Login
  const loginWithEmail = async (email: string, password?: string): Promise<{ error: Error | null; message?: string }> => {
    const supabase = getSupabase();
    if (!supabase) {
      return {
        error: new Error('Supabase is not configured. Please enter your project credentials.'),
      };
    }

    try {
      if (password) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });
        if (error) throw error;
        if (data.user) {
          setUser(mapUser(data.user));
          setIsAuthModalOpen(false);
        }
        return { error: null };
      } else {
        // Passwordless Magic Link
        const rawPath = window.location.pathname;
        const currentPath = !rawPath || rawPath === '/' ? '/home' : rawPath;
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            emailRedirectTo: `${window.location.origin}${currentPath}`,
          },
        });
        if (error) throw error;
        return {
          error: null,
          message: 'Magic login link sent! Check your email inbox to sign in instantly.',
        };
      }
    } catch (err: any) {
      return { error: err };
    }
  };

  // Sign Up with Email and Password
  const signUpWithEmail = async (
    email: string,
    password: string,
    name?: string
  ): Promise<{ error: Error | null; message?: string }> => {
    const supabase = getSupabase();
    if (!supabase) {
      return { error: new Error('Supabase is not configured.') };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: name?.trim() || email.split('@')[0],
          },
        },
      });

      if (error) throw error;

      if (data.session) {
        setUser(data.user ? mapUser(data.user) : null);
        setIsAuthModalOpen(false);
        return { error: null, message: 'Account created and signed in successfully!' };
      } else {
        if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
          return {
            error: new Error('An account with this email already exists. Please switch to Sign In.'),
          };
        }
        return {
          error: null,
          message: 'Account created! Please check your email inbox to verify your address.',
        };
      }
    } catch (err: any) {
      return { error: err };
    }
  };

  // Instant Demo / Guest User Login
  const loginAsDemo = (demoName?: string, demoEmail?: string) => {
    const localUser: UserProfile = {
      id: `user_${Date.now()}`,
      name: demoName?.trim() || 'Verified User',
      email: demoEmail?.trim() || 'user@printmate.studio',
      provider: 'demo',
      createdAt: Date.now(),
    };
    try {
      localStorage.setItem('printmate_local_user', JSON.stringify(localUser));
    } catch {
      // ignore
    }
    setUser(localUser);
    setIsAuthModalOpen(false);
  };

  const logout = async () => {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
    }
    try {
      localStorage.removeItem('printmate_local_user');
    } catch {
      // ignore
    }
    setUser(null);
    setSession(null);
  };

  const saveCredentials = (url: string, key: string) => {
    setSupabaseConfig(url, key);
    resetSupabaseClient();
    setConfig(getSupabaseConfig());
  };

  const openAuthModal = (reason?: string) => {
    setAuthPromptReason(reason || null);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthPromptReason(null);
    setIsAuthModalOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: !!user,
        isLoading,
        isConfigured: config.isConfigured,
        loginWithGoogle,
        loginWithEmail,
        signUpWithEmail,
        loginAsDemo,
        logout,
        isAuthModalOpen,
        authPromptReason,
        openAuthModal,
        closeAuthModal,
        saveCredentials,
        supabaseUrl: config.url,
        supabaseKey: config.key,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
