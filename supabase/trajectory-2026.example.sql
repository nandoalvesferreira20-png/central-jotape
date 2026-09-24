-- Cadastro opcional no SQL Editor, DEPOIS das duas migrations existentes.
-- Preserva registros e publicação existentes. Uma nova trajetória nasce em rascunho.
-- Não informa fases, datas, imagens ou vídeos não fornecidos.
begin;
-- Serializa a execução deste cadastro para evitar duplicação entre duas execuções.
select pg_advisory_xact_lock(2026, 2309);
insert into public.trajectory(year, title, subtitle, current_stage, current_status, next_stage, publication_status)
values (2026, 'Rumo ao Nacional', 'Uma caminhada construída batalha por batalha.',
        'Regional', 'Classificado', 'Estadual', 'draft')
on conflict (year) do nothing;

insert into public.trajectory_matches
  (trajectory_id, competition, opponent, jotape_score, opponent_score, result, position)
select t.id, 'Seletiva da Norte', initial.opponent, 2, initial.opponent_score, 'win', initial.position
from public.trajectory t
cross join (values ('CZP', 1, 1), ('Rafael Z.O', 0, 2), ('Youngui', 1, 3), ('Bask', 1, 4))
  as initial(opponent, opponent_score, position)
where t.year = 2026 and not exists (
  select 1 from public.trajectory_matches m
  where m.trajectory_id = t.id
    and lower(trim(m.competition)) = lower('Seletiva da Norte')
    and lower(trim(m.opponent)) = lower(initial.opponent)
);
commit;
