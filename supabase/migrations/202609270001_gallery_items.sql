-- Executar manualmente após as migrations existentes. Não envia imagens locais.
begin;

create table public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  image_path text not null unique check (image_path ~ '^gallery/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  caption text,
  image_credit text,
  alt_text text,
  position integer not null default 0,
  publication_status text not null default 'draft' check (publication_status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gallery_items_publication_order_idx on public.gallery_items(publication_status, position, created_at, id);
create trigger gallery_items_updated_at before update on public.gallery_items
  for each row execute function public.cms_set_updated_at();

alter table public.gallery_items enable row level security;
revoke all on public.gallery_items from public, anon, authenticated;
grant select on public.gallery_items to anon;
grant select, insert, update, delete on public.gallery_items to authenticated;

create policy gallery_items_public_read on public.gallery_items for select to anon, authenticated
  using (publication_status = 'published');
create policy gallery_items_admin_read on public.gallery_items for select to authenticated
  using ((select public.is_admin()));
create policy gallery_items_admin_insert on public.gallery_items for insert to authenticated
  with check ((select public.is_admin()));
create policy gallery_items_admin_update on public.gallery_items for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy gallery_items_admin_delete on public.gallery_items for delete to authenticated
  using ((select public.is_admin()));

-- Reutiliza central-media e central_media_admin_read/insert/update/delete.
-- Elas já cobrem gallery/ e exigem is_admin() (admin/editor em profiles).
-- Não altera bucket, Auth, funções de autorização ou policies existentes.
-- Como nas demais mídias, os bytes são públicos mesmo em rascunhos.
commit;
