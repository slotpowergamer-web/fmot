-- ============================================================================
-- 1.F.M.O.T — SCRIPT SQL COMPLEMENTAR DE SEGURANÇA E PERMISSÕES (NÃO DESTRUTIVO)
-- ============================================================================
-- O que este script faz (SEM apagar, renomear ou modificar dados existentes):
-- 1. Atualiza `public.is_fmot_admin()` preservando `slotpowergamer@gmail.com`
--    autenticado + e-mail confirmado e administradores confirmados em `admin_users`.
-- 2. Endurece `public.admin_users`: bloqueia INSERT, UPDATE e DELETE pelo frontend
--    para `anon` e `authenticated` (nem administradores comuns podem adicionar,
--    promover ou excluir outros administradores via API pública).
-- 3. Corrige privilégios SQL (`GRANT`) ausentes nas 8 tabelas de conteúdo público
--    que estavam retornando erro 42501 (`permission denied for table ...`).
-- 4. Separa claramente as políticas RLS de leitura pública e escrita administrativa.
-- 5. Endurece a política de UPDATE do bucket `fmot-media` (adiciona WITH CHECK).
-- ============================================================================

begin;

-- 1. Função segura de verificação administrativa (SECURITY DEFINER)
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

revoke all on function public.is_fmot_admin() from public;
grant execute on function public.is_fmot_admin() to anon, authenticated;

-- 2. Privilégios do schema public
grant usage on schema public to anon, authenticated;

-- 3. Endurecimento total da tabela `public.admin_users`
--    Remove TODA possibilidade de INSERT/UPDATE/DELETE pelo frontend (`anon` e `authenticated`).
--    A gestão de novos administradores deve ocorrer exclusivamente via SQL Editor / service_role.
alter table public.admin_users enable row level security;

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

-- 4. Privilégios SQL (`GRANT`) e políticas RLS limpas nas 8 tabelas de conteúdo
do $$
declare
  t text;
  tables text[] := array[
    'portal_config',
    'portal_slots',
    'hierarchy_nodes',
    'hierarchy_members',
    'roles_catalog',
    'operations_records',
    'gallery_items',
    'media_assets'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);

    -- Privilégios SQL explícitos (resolve erro 42501: permission denied for table)
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select on table public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on table public.%I to authenticated', t);

    -- Remove políticas antigas antes de recriar sem sobreposição ambígua
    execute format('drop policy if exists "%s_public_read" on public.%I', t, t);
    execute format('drop policy if exists "%s_admin_write" on public.%I', t, t);
    execute format('drop policy if exists "%s_admin_insert" on public.%I', t, t);
    execute format('drop policy if exists "%s_admin_update" on public.%I', t, t);
    execute format('drop policy if exists "%s_admin_delete" on public.%I', t, t);

    -- Visitantes e autenticados: somente leitura pública
    execute format(
      'create policy "%s_public_read" on public.%I for select to anon, authenticated using (true)',
      t, t
    );

    -- Somente administradores verificados por `public.is_fmot_admin()`: INSERT, UPDATE, DELETE
    execute format(
      'create policy "%s_admin_insert" on public.%I for insert to authenticated with check (public.is_fmot_admin())',
      t, t
    );
    execute format(
      'create policy "%s_admin_update" on public.%I for update to authenticated using (public.is_fmot_admin()) with check (public.is_fmot_admin())',
      t, t
    );
    execute format(
      'create policy "%s_admin_delete" on public.%I for delete to authenticated using (public.is_fmot_admin())',
      t, t
    );
  end loop;
end $$;

-- 5. Políticas do bucket `fmot-media` (sem recriar ou apagar arquivos existentes)
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

commit;

-- Atualiza o cache de schema do PostgREST imediatamente
notify pgrst, 'reload schema';
