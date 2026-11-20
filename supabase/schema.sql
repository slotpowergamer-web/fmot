-- ============================================================================
-- 1.F.M.O.T — Schema Institucional e Storage para Supabase (PostgreSQL + RLS)
-- Execute este script no SQL Editor do seu projeto Supabase quando desejar
-- criar as tabelas, políticas de segurança e o bucket de mídia `fmot-media`.
-- ============================================================================

-- 1. Administradores autorizados
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);

-- Função auxiliar de verificação administrativa (evita recursão de RLS e exige e-mail confirmado)
create or replace function public.is_fmot_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    auth.uid() is not null
    and (
      exists (
        select 1
        from auth.users u
        where u.id = auth.uid()
          and u.email_confirmed_at is not null
          and pg_catalog.lower(u.email) = 'slotpowergamer@gmail.com'
      )
      or exists (
        select 1
        from public.admin_users au
        join auth.users u on u.id = au.user_id
        where au.user_id = auth.uid()
          and u.email_confirmed_at is not null
      )
    )
  );
$$;

-- 2. Configuração institucional (Início e Quem Somos)
create table if not exists public.portal_config (
  id text primary key default 'main',
  hero_headline text not null default '',
  hero_subtext text not null default '',
  about_intro text not null default '',
  about_operations_text text not null default '',
  about_differentiator text not null default '',
  about_identity_text text not null default '',
  about_values jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- 3. Slots visuais por página (Logo, Início, Quem Somos)
create table if not exists public.portal_slots (
  id text primary key,
  page text not null,
  label text not null,
  title text not null,
  description text,
  placeholder_label text,
  image_url text not null default '',
  media_asset_id text,
  is_cover boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- 4. Patentes oficiais da hierarquia (6 níveis)
create table if not exists public.hierarchy_nodes (
  id text primary key check (
    id in ('rank_coronel', 'rank_capitao', 'rank_sargento', 'rank_cabo', 'rank_soldado', 'rank_recruta')
  ),
  rank_title text not null,
  member_name text not null default '',
  position_code text not null,
  tier integer not null check (tier between 1 and 6),
  parent_id text,
  responsibility text not null default '',
  insignia_url text,
  photo_url text,
  sort_order integer not null default 0,
  is_demo boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- 5. Integrantes por patente (ilimitados por patente)
create table if not exists public.hierarchy_members (
  id text primary key,
  rank_id text not null check (
    rank_id in ('rank_coronel', 'rank_capitao', 'rank_sargento', 'rank_cabo', 'rank_soldado', 'rank_recruta')
  ),
  name text not null,
  photo_url text not null default '',
  description text not null default '',
  status text not null default 'Ativo' check (status in ('Ativo', 'Em Capacitação', 'Afastado', 'Inativo')),
  sort_order integer not null default 0,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_hierarchy_members_rank_order on public.hierarchy_members (rank_id, sort_order);

-- 6. Funções e especialidades operacionais
create table if not exists public.roles_catalog (
  id text primary key,
  name text not null,
  category text not null,
  icon_name text not null default 'Shield',
  image_url text,
  description text not null default '',
  responsibilities jsonb not null default '[]'::jsonb,
  requirements jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  is_demo boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- 7. Trabalhos e operações
create table if not exists public.operations_records (
  id text primary key,
  title text not null,
  category text not null,
  date text not null default '',
  summary text not null default '',
  details text not null default '',
  results text not null default '',
  cover_image_url text not null default '',
  gallery_urls jsonb not null default '[]'::jsonb,
  featured boolean not null default false,
  is_demo boolean not null default false,
  sort_order integer not null default 0,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- 8. Galeria oficial
create table if not exists public.gallery_items (
  id text primary key,
  title text not null,
  description text,
  category text not null,
  date text not null default '',
  image_url text not null default '',
  is_cover boolean not null default false,
  sort_order integer not null default 0,
  is_demo boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- 9. Acervo de mídia (metadados apontando para Supabase Storage)
create table if not exists public.media_assets (
  id text primary key,
  file_name text not null,
  mime_type text not null check (mime_type in ('image/webp', 'image/jpeg', 'image/png')),
  storage_path text not null,
  public_url text not null,
  width integer not null default 0,
  height integer not null default 0,
  size_bytes integer not null default 0,
  page text not null,
  title text not null,
  description text,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- Row Level Security (RLS): Leitura pública institucional / Escrita somente Admin
-- ============================================================================
alter table public.admin_users enable row level security;
alter table public.portal_config enable row level security;
alter table public.portal_slots enable row level security;
alter table public.hierarchy_nodes enable row level security;
alter table public.hierarchy_members enable row level security;
alter table public.roles_catalog enable row level security;
alter table public.operations_records enable row level security;
alter table public.gallery_items enable row level security;
alter table public.media_assets enable row level security;

revoke all on function public.is_fmot_admin() from public;
grant execute on function public.is_fmot_admin() to anon, authenticated;

grant usage on schema public to anon, authenticated;

-- admin_users: leitura restrita ao próprio usuário autenticado; escrita bloqueada pelo frontend
revoke all on table public.admin_users from public, anon, authenticated;
grant select on table public.admin_users to authenticated;

drop policy if exists "admin_users_select" on public.admin_users;
drop policy if exists "admin_users_select_own" on public.admin_users;
drop policy if exists "admin_users_write" on public.admin_users;
drop policy if exists "admin_users_insert" on public.admin_users;
drop policy if exists "admin_users_update" on public.admin_users;
drop policy if exists "admin_users_delete" on public.admin_users;

create policy "admin_users_select_own" on public.admin_users
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Políticas padrão para tabelas públicas de leitura + escrita administrativa
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'portal_config',
    'portal_slots',
    'hierarchy_nodes',
    'hierarchy_members',
    'roles_catalog',
    'operations_records',
    'gallery_items',
    'media_assets'
  ] loop
    execute format('revoke all on table public.%I from public, anon, authenticated', tbl);
    execute format('grant select on table public.%I to anon, authenticated', tbl);
    execute format('grant insert, update, delete on table public.%I to authenticated', tbl);

    execute format('drop policy if exists "%s_public_read" on public.%I', tbl, tbl);
    execute format('drop policy if exists "%s_admin_write" on public.%I', tbl, tbl);
    execute format('drop policy if exists "%s_admin_insert" on public.%I', tbl, tbl);
    execute format('drop policy if exists "%s_admin_update" on public.%I', tbl, tbl);
    execute format('drop policy if exists "%s_admin_delete" on public.%I', tbl, tbl);

    execute format(
      'create policy "%s_public_read" on public.%I for select to anon, authenticated using (true)',
      tbl,
      tbl
    );
    execute format(
      'create policy "%s_admin_insert" on public.%I for insert to authenticated with check (public.is_fmot_admin())',
      tbl,
      tbl
    );
    execute format(
      'create policy "%s_admin_update" on public.%I for update to authenticated using (public.is_fmot_admin()) with check (public.is_fmot_admin())',
      tbl,
      tbl
    );
    execute format(
      'create policy "%s_admin_delete" on public.%I for delete to authenticated using (public.is_fmot_admin())',
      tbl,
      tbl
    );
  end loop;
end $$;

-- ============================================================================
-- Supabase Storage: Bucket público `fmot-media` (leitura pública, escrita admin)
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fmot-media',
  'fmot-media',
  true,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fmot_media_public_read" on storage.objects;
create policy "fmot_media_public_read" on storage.objects
  for select
  to public
  using (bucket_id = 'fmot-media');

drop policy if exists "fmot_media_admin_insert" on storage.objects;
create policy "fmot_media_admin_insert" on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'fmot-media' and public.is_fmot_admin());

drop policy if exists "fmot_media_admin_update" on storage.objects;
create policy "fmot_media_admin_update" on storage.objects
  for update
  to authenticated
  using (bucket_id = 'fmot-media' and public.is_fmot_admin())
  with check (bucket_id = 'fmot-media' and public.is_fmot_admin());

drop policy if exists "fmot_media_admin_delete" on storage.objects;
create policy "fmot_media_admin_delete" on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'fmot-media' and public.is_fmot_admin());
