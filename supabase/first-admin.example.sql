-- Executar no SQL Editor APÓS as duas migrations.
-- Criar a conta em Authentication > Users, copiar o UUID e substituir o marcador.
-- Não cria conta ou senha. Não executar pelo navegador com a chave pública.
insert into public.profiles (id, role)
values ('99e908bd-6165-401d-bad4-5801c6f98898'::uuid, 'admin')
on conflict (id) do update set role = excluded.role;

-- Para conferir, substitua o mesmo marcador:
select id, role, created_at from public.profiles
where id = '99e908bd-6165-401d-bad4-5801c6f98898'::uuid;


