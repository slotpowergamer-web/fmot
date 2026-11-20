import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
  type CookieOptions,
} from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

export interface ServerCookieBridge {
  getCookieHeader: () => string | undefined;
  appendSetCookieHeader: (serializedCookie: string) => void;
}

function getProcessEnv(): Record<string, string | undefined> {
  const maybeGlobal = globalThis as { process?: { env?: Record<string, string | undefined> } };
  return maybeGlobal.process?.env || {};
}

function readServerSupabaseUrl(): string {
  const env = getProcessEnv();
  return (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim();
}

function readServerSupabaseAnonKey(): string {
  const env = getProcessEnv();
  return (
    env.SUPABASE_ANON_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();
}

function assertSafeServerUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (
      parsed.protocol !== 'https:' &&
      parsed.hostname !== 'localhost' &&
      parsed.hostname !== '127.0.0.1'
    ) {
      throw new Error('SUPABASE_URL deve utilizar HTTPS.');
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    throw new Error('SUPABASE_URL inválido ou ausente no ambiente do servidor.');
  }
}

/**
 * Creates a request-scoped Supabase server client using @supabase/ssr
 * with iframe-compatible cookie security attributes (HttpOnly, Secure, SameSite=None, Partitioned).
 */
export function createSupabaseServerClient(
  cookieBridge: ServerCookieBridge
): SupabaseClient<Database> {
  const url = assertSafeServerUrl(readServerSupabaseUrl());
  const anonKey = readServerSupabaseAnonKey();

  if (!anonKey) {
    throw new Error('SUPABASE_ANON_KEY (ou VITE_SUPABASE_ANON_KEY) não configurado no servidor.');
  }

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(cookieBridge.getCookieHeader() ?? '').map((cookie) => ({
          name: cookie.name,
          value: cookie.value ?? '',
        }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          const safeOptions: CookieOptions = {
            ...options,
            httpOnly: options?.httpOnly ?? true,
            secure: true,
            sameSite: 'none',
            partitioned: true,
            path: options?.path ?? '/',
          };
          cookieBridge.appendSetCookieHeader(serializeCookieHeader(name, value, safeOptions));
        });
      },
    },
  });
}

/**
 * Server-only privileged client using SUPABASE_SERVICE_ROLE_KEY.
 * Must NEVER be called from browser code or bundled with VITE_ env vars.
 */
export function createSupabaseServiceRoleClient(): SupabaseClient<Database> {
  if (typeof window !== 'undefined') {
    throw new Error('createSupabaseServiceRoleClient só pode ser executado no servidor.');
  }

  const env = getProcessEnv();
  const url = assertSafeServerUrl(readServerSupabaseUrl());
  const serviceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurado no ambiente do servidor.');
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
