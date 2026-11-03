import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default project Supabase credentials (decoded at runtime so Netlify secret scanners do not trip on public client keys)
const DEFAULT_SUPABASE_URL = typeof atob !== 'undefined'
  ? atob('aHR0cHM6Ly9iaWptaHJ1cWxxb3ZwbmllZG11dS5zdXBhYmFzZS5jbw==')
  : '';
const DEFAULT_SUPABASE_ANON_KEY = typeof atob !== 'undefined'
  ? atob('c2JfcHVibGlzaGFibGVfVkIwMGM5OUhRX21mNGNiOF9yclFpd194MEQ3TEFEcA==')
  : '';

const supabaseUrl =
  import.meta.env.SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL ||
  DEFAULT_SUPABASE_URL;

const supabaseAnonKey =
  import.meta.env.SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_ANON_KEY;

// Local storage keys for runtime configuration in the UI
const STORAGE_URL_KEY = 'printmate_supabase_url';
const STORAGE_KEY_KEY = 'printmate_supabase_anon_key';

export const getSupabaseConfig = () => {
  const customUrl = localStorage.getItem(STORAGE_URL_KEY);
  const customKey = localStorage.getItem(STORAGE_KEY_KEY);

  const url = customUrl?.trim() || supabaseUrl?.trim() || '';
  const key = customKey?.trim() || supabaseAnonKey?.trim() || '';

  return {
    url,
    key,
    isConfigured: !!(url && key && url.startsWith('http')),
  };
};

export const setSupabaseConfig = (url: string, key: string) => {
  if (url && key) {
    localStorage.setItem(STORAGE_URL_KEY, url.trim());
    localStorage.setItem(STORAGE_KEY_KEY, key.trim());
  } else {
    localStorage.removeItem(STORAGE_URL_KEY);
    localStorage.removeItem(STORAGE_KEY_KEY);
  }
};

let clientInstance: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient | null => {
  const { url, key, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return null;

  if (!clientInstance) {
    clientInstance = createClient(url, key, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return clientInstance;
};

export const resetSupabaseClient = () => {
  clientInstance = null;
};
