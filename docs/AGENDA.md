# Agenda — integração com o Supabase existente

## Inspeção antes das alterações

Em 03/11/2026 foram lidos o HTML/CSS da Agenda, formulário e módulo administrativo,
repository/list-view, validação, uploads, client anônimo/autenticado, build,
migrations, documentação e testes existentes. Nenhum arquivo foi alterado antes
dessa análise e da consulta de verificação do schema remoto.

A home tinha um placeholder estático em `#agenda`. O painel `/admin/agenda.html`
já criava, editava e excluía eventos com `saveRecord`/`deleteRecord`, status de
publicação e upload opcional em `central-media/events/`. Faltavam a leitura na
home e a ação rápida Publicar/Despublicar. O repository já ordenava a lista
administrativa por `event_date` decrescente, com desempate por `id`.

A consulta pública real `GET /rest/v1/events?select=id,title,description,event_date,event_time,city,venue,ticket_url,image_url,status,created_at,updated_at&limit=0`
retornou **HTTP 200**, confirmando a tabela e a existência dos campos sem retornar
dados de eventos. A descrição OpenAPI retornou HTTP 401 (`Secret API key required`).
Não foram utilizadas credenciais privilegiadas. Tipos, constraints, triggers e
policies abaixo foram inspecionados nas migrations do repositório e verificados
localmente em PostgreSQL/PGlite; não equivalem a uma auditoria do catálogo remoto.

## Schema encontrado: `public.events`

Fonte: `supabase/migrations/202609210001_cms_base.sql`.

| Coluna | Tipo | Obrigatória / default / constraints |
| --- | --- | --- |
| id | uuid | PK, default `gen_random_uuid()` |
| title | text | NOT NULL; título sem espaços nas pontas tem 1–240 caracteres |
| description | text | Opcional; até 10000 caracteres |
| event_date | date | NOT NULL |
| event_time | time without time zone | Opcional |
| city | text | NOT NULL; cidade sem espaços nas pontas tem 1–120 caracteres |
| venue | text | Opcional; até 240 caracteres |
| ticket_url | text | Opcional; prefixo HTTPS |
| image_url | text | Opcional; prefixo HTTPS |
| status | text | NOT NULL; default `draft`; somente `draft`/`published` |
| created_at | timestamptz | NOT NULL; default `now()` |
| updated_at | timestamptz | NOT NULL; default `now()` |

Índice existente: `events_publication_idx(status, event_date)`.
Trigger: `events_updated_at`, BEFORE UPDATE, executa `cms_set_updated_at()`.
Sem FK adicional em events. Não há campo de estado/UF; ele é opcional para esta
entrega e não justifica uma alteração de schema. O formulário já usa todos os
campos editoriais acima; id e timestamps são controlados pelo banco.

**Nenhuma migration necessária ou criada.** O campo de publicação existente é
`status`; não foi duplicado como `publication_status`. Datas e horários separados
foram preservados, sem introduzir timestamp ou campo de imagem duplicado.
Nenhuma migration antiga foi editada e nenhum SQL foi aplicado remotamente.

## Autorização e RLS preservadas

RLS habilitada em `public.events`. Grants existentes: SELECT para `anon`;
SELECT/INSERT/UPDATE/DELETE para `authenticated`, sujeitos às policies.

| Policy | Operação / roles | Condição |
| --- | --- | --- |
| events_public_read | SELECT / anon, authenticated | `status = 'published'` |
| events_admin_read | SELECT / authenticated | `public.is_admin()` |
| events_admin_insert | INSERT / authenticated | WITH CHECK `public.is_admin()` |
| events_admin_update | UPDATE / authenticated | USING e WITH CHECK `public.is_admin()` |
| events_admin_delete | DELETE / authenticated | USING `public.is_admin()` |

A migration `202609210002_editorial_profiles.sql` já define `is_admin()` pela
existência de perfil `admin` ou `editor` em `public.profiles`. Sessão autenticada
sem esse perfil não concede escrita. Auth, profiles, função e policies não foram
alterados. Eventos publicados passados continuam legíveis pela policy existente;
é a consulta da seção de próximos eventos que os exclui, sem enfraquecer RLS.

## Painel

Reutiliza a mesma tela, formulário, guard, repository, paginação e Storage.
Título, data e cidade obrigatórios; horário, local, descrição, ingresso e imagem
opcionais. Salvar mantém a validação existente de HTTPS e datas/horários. O status
selecionado é enviado como `status` ao INSERT/UPDATE de `events`; um novo registro
começa como rascunho. Publicar/Despublicar na lista atualiza somente o status.
A edição mantém o UUID. A exclusão usa a confirmação já existente.

A listagem apresenta título, data em pt-BR, horário, local, cidade e status.
Ordenação existente mantida: data decrescente, com histórico disponível.
Imagem por URL ou upload existente (JPEG/PNG/WebP/AVIF, até 5 MB). Imagens salvas
não são apagadas automaticamente ao excluir eventos, pois podem ser compartilhadas.

## Home, datas e fallback

`home-agenda.js` consulta `events` pelo `getPublicSupabase()` anônimo já existente.
Filtros: `status = 'published'` e `event_date >= hoje`, calculado com
`Intl.DateTimeFormat` em `America/Sao_Paulo`, independentemente do fuso do dispositivo.
Ordenação crescente: data, horário (ausentes por último), id. Paginação interna de
100 registros evita truncamento pelo limite da API.

`event_date` é uma data civil: formatada em pt-BR sem conversão para meia-noite
UTC/local. `event_time` é exibido como HH:mm sem conversão; o painel informa a
convenção de São Paulo. Eventos de hoje permanecem visíveis mesmo depois do seu
horário. Eventos passados permanecem cadastrados e apenas saem da home.

Os registros reais substituem o placeholder, preservando a seção, classes e
tipografia. Descrição, local, cidade e título são inseridos com `textContent`.
O CTA aparece somente para uma URL HTTPS válida, com `target="_blank"` e
`rel="noopener noreferrer"`. Imagem opcional possui carregamento lazy e é
removida se falhar. CSS adicional fica restrito a `#agenda`.

Sem eventos publicados próximos, configuração indisponível ou falha na consulta,
o placeholder original “EM BREVE / Próximas apresentações” e a nota “Novas datas
serão divulgadas aqui após confirmação.” permanecem visíveis. A home não depende
do sucesso do Supabase para funcionar. Dados são atualizados ao carregar a página
e ao restaurá-la pelo histórico; não foi adicionado Realtime.

## Validação

- `tests/events.test.mjs`: virada UTC/São Paulo, datas civis e bissextos, horários,
  filtros, ordenação, paginação, erro e preservação do HTML fora da Agenda.
- `tests/browser/agenda.spec.js`: CRUD, rascunho invisível mesmo com editor logado,
  publicar/despublicar, edição sem duplicação, exclusão, datas passadas/hoje/futuras,
  ordem, ingresso condicional, imagem, texto seguro e fallback. Navegador em
  Asia/Tokyo para detectar dependência indevida do fuso do dispositivo.
- Capturas e verificação de overflow em 375, 390, 430, 768 e 1440px.
- `tests/rls.test.mjs`: permissões reais em PostgreSQL/PGlite das migrations
  existentes para visitante, usuário comum, admin e editor.
- Build: confirmar `js/events.js`, `js/public/home-agenda.js`,
  `js/admin/agenda.js` e `css/home-agenda.css` em dist, idênticos às fontes.

Os testes de escrita usam backend de teste em memória e PostgreSQL local;
não criam, publicam ou excluem eventos no projeto remoto.

## Resultados desta entrega

- Agenda: 3 testes de unidade e 7 testes de navegador aprovados.
- Suíte Node completa: 21 aprovados, 1 falha no hash legado de `index.html`.
  A mesma comparação também falha com o HTML original de HEAD.
- Suíte de navegador completa: 82 aprovados, 12 falhas em expectativas antigas:
  seis esperam estatísticas `847,3 MIL`/`1,27 MI`, enquanto HEAD já contém
  `883,6 MIL`/`1,4 MI`; seis esperam a capa do EP oculta, enquanto HEAD já a exibe.
  Esses conteúdos e testes foram mantidos intactos. O teste específico de
  preservação do HTML fora de `#agenda` passou.
- Auth/painel, recuperação de senha, galeria e trajetória passaram na regressão.
- Capturas da Agenda revisadas em 375, 390, 430 e 1440px; teste adicional em 768px,
  sem overflow. Artefatos em `test-results/` (ignorado pelo Git).
- `npm run build` aprovado com a configuração pública local existente; os seis
  arquivos da Agenda citados abaixo foram comparados byte a byte em dist:
  `js/events.js`, `js/public/home-agenda.js`, `js/admin/agenda.js`,
  `css/home-agenda.css`, `admin/agenda.html` e `index.html`.
- `git diff --check` aprovado. Nenhum commit, deploy ou alteração remota.

Diff desta tarefa: cinco arquivos existentes ajustados (`README.md`,
`admin/agenda.html`, `index.html`, `js/admin/agenda.js`,
`tests/browser/news-fixture.js`, apenas o backend de testes) e seis novos
(`css/home-agenda.css`, `docs/AGENDA.md`, `js/events.js`,
`js/public/home-agenda.js`, `tests/events.test.mjs`, `tests/browser/agenda.spec.js`).
As alterações anteriores em `css/trajetoria.css` e `js/public/trajetoria.js`
foram preservadas sem modificação nesta tarefa.
