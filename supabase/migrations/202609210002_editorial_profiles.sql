begin;

-- Somente contas explicitamente autorizadas recebem um perfil editorial.
-- Não existe trigger de signup nem permissão de autoatribuição pelo navegador.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('admin', 'editor')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
create policy profiles_read_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));

-- Preserva o acesso previamente concedido na V2.
insert into public.profiles(id, role)
select user_id, 'admin' from private.admin_users on conflict (id) do nothing;

-- Nome mantido por compatibilidade com o guard e as policies da V2.
-- Admin e editor têm acesso editorial; nenhum pode conceder roles pelo cliente.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('admin', 'editor')
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

comment on table public.profiles is 'Autorização editorial manual. Gerenciar somente pelo SQL Editor ou backend privilegiado.';
comment on table private.admin_users is 'Legado V2. Migrado para public.profiles; não concede mais acesso.';
commit;
