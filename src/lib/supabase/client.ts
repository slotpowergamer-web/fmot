import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

function readBrowserSupabaseConfig(): { url: string; anonKey: string } {
  const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const anonKey = (
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();

  return { url, anonKey };
}

function isValidSupabaseUrl(rawUrl: string): boolean {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = readBrowserSupabaseConfig();
  return isValidSupabaseUrl(url) && anonKey.length > 0;
}

let browserClient: SupabaseClient<Database> | null = null;

/**
 * Returns a singleton Supabase browser client created via @supabase/ssr.
 * Returns null safely when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not yet configured,
 * preserving existing Firebase functionality without breaking startup.
 */
export function getSupabaseBrowserClient(): SupabaseClient<Database> | null {
  if (browserClient) return browserClient;

  const { url, anonKey } = readBrowserSupabaseConfig();
  if (!isValidSupabaseUrl(url) || !anonKey) {
    return null;
  }

  browserClient = createBrowserClient<Database>(url, anonKey, {
    cookieOptions: {
      sameSite: 'none',
      secure: true,
    },
  });

  return browserClient;
}

/**
 * Strict getter for flows that explicitly require an active Supabase connection.
 */
export function requireSupabaseBrowserClient(): SupabaseClient<Database> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error(
      'Supabase não está configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas variáveis de ambiente.'
    );
  }
  return client;
}
