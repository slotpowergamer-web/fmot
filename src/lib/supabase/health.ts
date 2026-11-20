import type { SupabaseClient } from '@supabase/supabase-js';
import { BOOTSTRAP_ADMIN_EMAIL } from '../../firebase';
import { getSupabaseBrowserClient, isSupabaseConfigured } from './client';
import { SUPABASE_MEDIA_BUCKET, type Database } from './types';

export interface SupabaseHealthStatus {
  configured: boolean;
  connected: boolean;
  schemaReady: boolean;
  storageBucketReady: boolean;
  adminAuthenticated: boolean;
  adminEmail: string | null;
  missingTables: string[];
  permissionDeniedTables: string[];
  details: string;
}

const REQUIRED_TABLES = [
  'portal_config',
  'portal_slots',
  'hierarchy_nodes',
  'hierarchy_members',
  'roles_catalog',
  'operations_records',
  'gallery_items',
  'media_assets',
] as const;

type MinimalSupabaseUser = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
};

/**
 * Verifies authoritatively whether the currently authenticated Supabase user
 * is a confirmed administrator (via PostgreSQL RPC `public.is_fmot_admin()`).
 * Never treats arbitrary confirmed accounts as administrators.
 */
export async function verifySupabaseAdminSession(
  supabase: SupabaseClient<Database>,
  user: MinimalSupabaseUser | null
): Promise<boolean> {
  if (!user?.id || !user.email || !user.email_confirmed_at) {
    return false;
  }

  try {
    const { data, error } = await supabase.rpc('is_fmot_admin');
    if (!error && typeof data === 'boolean') {
      return data;
    }
  } catch {
    // Fallback below only if RPC itself is unreachable
  }

  // Strict fallback: only bootstrap admin email with confirmed email
  return user.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
}

export async function checkSupabaseHealth(): Promise<SupabaseHealthStatus> {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      connected: false,
      schemaReady: false,
      storageBucketReady: false,
      adminAuthenticated: false,
      adminEmail: null,
      missingTables: [...REQUIRED_TABLES],
      permissionDeniedTables: [],
      details: 'Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não configuradas.',
    };
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return {
      configured: false,
      connected: false,
      schemaReady: false,
      storageBucketReady: false,
      adminAuthenticated: false,
      adminEmail: null,
      missingTables: [...REQUIRED_TABLES],
      permissionDeniedTables: [],
      details: 'Cliente Supabase indisponível.',
    };
  }

  const baseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const anonKey = (
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();

  let connected = false;
  try {
    const healthRes = await fetch(`${baseUrl}/auth/v1/health`, {
      headers: { apikey: anonKey },
    });
    connected = healthRes.ok;
  } catch {
    connected = false;
  }

  // Check tables via lightweight limit=1 reads — distinguish missing tables from 42501 permission denied
  const missingTables: string[] = [];
  const permissionDeniedTables: string[] = [];
  if (connected) {
    await Promise.all(
      REQUIRED_TABLES.map(async (table) => {
        const { error } = await supabase.from(table).select('id').limit(1);
        if (!error) return;
        const msg = (error.message || '').toLowerCase();
        if (
          error.code === 'PGRST205' ||
          error.code === '42P01' ||
          msg.includes('could not find the table')
        ) {
          missingTables.push(table);
        } else if (error.code === '42501' || msg.includes('permission denied')) {
          permissionDeniedTables.push(table);
        } else {
          permissionDeniedTables.push(table);
        }
      })
    );
  } else {
    missingTables.push(...REQUIRED_TABLES);
  }

  // Verify bucket exists (public object probe returns NoSuchBucket if bucket does not exist,
  // or 404/400 Object not found if bucket exists and is public)
  let storageBucketReady = false;
  if (connected) {
    try {
      const probe = await fetch(
        `${baseUrl}/storage/v1/object/public/${SUPABASE_MEDIA_BUCKET}/__health_probe__`
      );
      const bodyText = await probe.text();
      const missingBucket =
        bodyText.includes('Bucket not found') || bodyText.includes('NoSuchBucket');
      storageBucketReady =
        !missingBucket && (probe.status === 200 || probe.status === 404 || probe.status === 400);
    } catch {
      storageBucketReady = false;
    }
  }

  let adminAuthenticated = false;
  let adminEmail: string | null = null;
  if (connected) {
    try {
      const { data } = await supabase.auth.getUser();
      if (data.user?.email) {
        const verified = await verifySupabaseAdminSession(supabase, data.user);
        adminAuthenticated = verified;
        adminEmail = verified ? data.user.email : null;
      }
    } catch {
      adminAuthenticated = false;
      adminEmail = null;
    }
  }

  const schemaReady =
    connected && missingTables.length === 0 && permissionDeniedTables.length === 0;

  let details = 'Conexão com o Supabase operacional.';
  if (!connected) {
    details = 'Não foi possível conectar ao endpoint do Supabase configurado.';
  } else if (missingTables.length > 0 || !storageBucketReady) {
    details =
      'Conexão ativa, porém é necessário executar o script supabase/schema.sql no SQL Editor do Supabase para criar as tabelas ausentes e o bucket fmot-media.';
  } else if (permissionDeniedTables.length > 0) {
    details =
      'As tabelas existem no Supabase, porém faltam privilégios SQL (GRANT) / ajustes de RLS. Execute o script supabase/fix_rls_and_security.sql no SQL Editor do Supabase.';
  } else if (!adminAuthenticated) {
    details =
      'Conexão, tabelas e bucket prontos para leitura pública. Autentique-se no Supabase abaixo para habilitar gravação e migração.';
  }

  return {
    configured: true,
    connected,
    schemaReady,
    storageBucketReady,
    adminAuthenticated,
    adminEmail,
    missingTables,
    permissionDeniedTables,
    details,
  };
}
