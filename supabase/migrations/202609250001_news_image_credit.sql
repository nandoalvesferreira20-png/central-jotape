-- Aplicar após 202609210002_editorial_profiles.sql, antes de publicar o frontend.
-- Campo opcional; não altera registros existentes, permissões ou policies.
alter table public.news add column if not exists image_credit text;
comment on column public.news.image_credit is 'Crédito opcional da imagem principal, exibido como texto simples.';
