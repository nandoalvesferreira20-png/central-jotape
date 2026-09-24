-- Execute uma única vez no SQL Editor de um projeto Supabase novo.
-- Não remove tabelas existentes. Conflitos abortam toda a transação.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table private.admin_users enable row level security;
revoke all on private.admin_users from public, anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from private.admin_users where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create function public.cms_set_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.cms_set_updated_at() from public, anon, authenticated;

create table public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 240),
  slug text not null unique check (char_length(slug) <= 160 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  excerpt text check (char_length(excerpt) <= 500),
  content text not null check (char_length(trim(content)) between 1 and 100000),
  cover_url text check (cover_url is null or cover_url ~ '^https://'),
  category text not null check (char_length(trim(category)) between 1 and 80),
  status text not null default 'draft' check (status in ('draft', 'published')),
  featured boolean not null default false,
  author_name text not null check (char_length(trim(author_name)) between 1 and 120),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint news_publication_date check (status <> 'published' or published_at is not null)
);
create index news_publication_idx on public.news(status, published_at desc);
create index news_created_idx on public.news(created_at desc, id desc);
create trigger news_updated_at before update on public.news for each row execute function public.cms_set_updated_at();

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 240),
  description text check (char_length(description) <= 10000),
  event_date date not null,
  event_time time without time zone,
  city text not null check (char_length(trim(city)) between 1 and 120),
  venue text check (char_length(venue) <= 240),
  ticket_url text check (ticket_url is null or ticket_url ~ '^https://'),
  image_url text check (image_url is null or image_url ~ '^https://'),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_publication_idx on public.events(status, event_date);
create trigger events_updated_at before update on public.events for each row execute function public.cms_set_updated_at();

create table public.trajectory (
  id uuid primary key default gen_random_uuid(),
  year integer not null unique check (year between 2000 and 2100),
  title text not null check (char_length(trim(title)) between 1 and 240),
  subtitle text check (char_length(subtitle) <= 500),
  current_stage text check (char_length(current_stage) <= 240),
  current_status text check (char_length(current_status) <= 240),
  hero_image_url text check (hero_image_url is null or hero_image_url ~ '^https://'),
  next_stage text check (char_length(next_stage) <= 240),
  -- Campo adicional de segurança: current_status descreve a competição, não a publicação.
  publication_status text not null default 'draft' check (publication_status in ('draft', 'published')),
  updated_at timestamptz not null default now()
);
create trigger trajectory_updated_at before update on public.trajectory for each row execute function public.cms_set_updated_at();

create table public.trajectory_matches (
  id uuid primary key default gen_random_uuid(),
  trajectory_id uuid not null references public.trajectory(id) on delete cascade,
  competition text not null check (char_length(trim(competition)) between 1 and 240),
  phase text check (char_length(phase) <= 120),
  opponent text check (char_length(opponent) <= 120),
  jotape_score integer check (jotape_score between 0 and 999),
  opponent_score integer check (opponent_score between 0 and 999),
  result text not null default 'pending' check (result in ('pending', 'win', 'loss', 'draw')),
  battle_date date,
  video_url text check (video_url is null or video_url ~ '^https://'),
  image_url text check (image_url is null or image_url ~ '^https://'),
  position integer not null default 0 check (position between 0 and 9999),
  created_at timestamptz not null default now()
);
create index trajectory_matches_parent_idx on public.trajectory_matches(trajectory_id, position, id);

alter table public.news enable row level security;
alter table public.events enable row level security;
alter table public.trajectory enable row level security;
alter table public.trajectory_matches enable row level security;
revoke all on public.news, public.events, public.trajectory, public.trajectory_matches from public, anon, authenticated;
grant select on public.news, public.events, public.trajectory, public.trajectory_matches to anon;
grant select, insert, update, delete on public.news, public.events, public.trajectory, public.trajectory_matches to authenticated;
grant usage on schema public to anon, authenticated;

create policy news_public_read on public.news for select to anon, authenticated
  using (status = 'published' and published_at <= now());
create policy events_public_read on public.events for select to anon, authenticated
  using (status = 'published');
create policy trajectory_public_read on public.trajectory for select to anon, authenticated
  using (publication_status = 'published');
create policy matches_public_read on public.trajectory_matches for select to anon, authenticated
  using (exists (
    select 1 from public.trajectory t
    where t.id = trajectory_id and t.publication_status = 'published'
  ));

-- Uma policy por operação; estar autenticado sozinho não autoriza escrita.
do $$
declare entity text;
begin
  foreach entity in array array['news', 'events', 'trajectory', 'trajectory_matches'] loop
    execute format('create policy %I on public.%I for select to authenticated using ((select public.is_admin()))', entity || '_admin_read', entity);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.is_admin()))', entity || '_admin_insert', entity);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', entity || '_admin_update', entity);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.is_admin()))', entity || '_admin_delete', entity);
  end loop;
end;
$$;

-- Bucket público: os bytes são públicos mesmo quando o registro associado é rascunho.
-- Não armazenar arquivos privados ou embargados aqui.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('central-media', 'central-media', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

create policy central_media_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'central-media' and (select public.is_admin()));
create policy central_media_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'central-media' and (select public.is_admin()));
create policy central_media_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'central-media' and (select public.is_admin()))
  with check (bucket_id = 'central-media' and (select public.is_admin()));
create policy central_media_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'central-media' and (select public.is_admin()));
commit;

