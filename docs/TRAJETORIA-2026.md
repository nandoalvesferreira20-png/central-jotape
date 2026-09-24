# Trajetória 2026 — página pública e gestão editorial

## Entrega

`trajetoria-2026.html` é uma página independente, com hero tipográfico, imagem opcional, status, batalhas ordenadas, resultado e próximo capítulo. Mantém preto, branco, cinzas e a fonte local Anton. A home recebeu somente um teaser com link, usando classes já existentes. Não houve redesign nem alterações ao CMS de notícias, Auth ou RLS.

## Banco e consultas

Tabelas existentes: `trajectory` e `trajectory_matches`. Nenhuma tabela, coluna, policy ou migration nova foi necessária.

A consulta pública usa o client anônimo centralizado:

1. `trajectory.select('*').eq('year', 2026).eq('publication_status', 'published').maybeSingle()`.
2. Se houver trajetória publicada, `trajectory_matches.select('*').eq('trajectory_id', id).order('position', {ascending: true}).order('id', {ascending: true})`, em páginas de 100 registros até terminar.

RLS existente continua exigindo trajetória publicada para leitura pública e a publicação do pai para ler batalhas. Visitante não pode inserir/alterar/excluir. Admin/editor continua passando pelo guard e policies já existentes.

A página não consulta batalhas quando o pai não é público. Dados são renderizados como texto, links e imagens aceitam HTTPS sem credenciais na URL. Zero no placar é preservado; ausente aparece como “—”. Datas opcionais usam o campo date sem conversão de timezone. Fase não informada não é inventada.

Os estados são: carregando, trajetória ainda não publicada, erro com botão de nova tentativa e nenhuma batalha cadastrada. O hero prioriza a imagem cadastrada. Na ausência ou falha, usa a foto real local de Jotapê em assets/img/jotape-hero.jpg, com rotação CSS de 180 graus somente nessa imagem, que está invertida na origem. Nenhuma pessoa ou imagem foi gerada por IA. Se também faltar o arquivo local, permanece um placeholder tipográfico.

## Cadastro inicial sem duplicações

As duas migrations existentes precisam estar aplicadas. Não reaplicá-las se o CMS já funciona.

Opção A: cadastrar manualmente no painel, conferindo se já existe a trajetória e cada batalha.

Opção B: no Supabase → SQL Editor → New query, revisar e executar **`supabase/trajectory-2026.example.sql`**. Esse SQL é opcional e NÃO foi executado no Supabase nesta entrega. Ele:

- cria 2026 apenas se esse ano não existir;
- mantém os campos e o estado editorial de uma trajetória já existente;
- cria uma nova trajetória em **rascunho**;
- usa título “Rumo ao Nacional”, subtítulo “Uma caminhada construída batalha por batalha.”, etapa atual “Regional”, status “Classificado”, próxima etapa “Estadual”;
- adiciona somente as batalhas da Seletiva da Norte que ainda não existirem para o mesmo adversário (comparação ignorando maiúsculas e espaços nas extremidades);
- mantém dados de batalhas já existentes, sem sobrescrever placares, fases ou posição;
- usa uma transação e trava de execução para evitar duplicação se o mesmo script for executado simultaneamente.

| Posição | Competição | Adversário | Jotapê | Adversário | Resultado |
| --- | --- | --- | --- | --- | --- |
| 1 | Seletiva da Norte | CZP | 2 | 1 | Vitória |
| 2 | Seletiva da Norte | Rafael Z.O | 2 | 0 | Vitória |
| 3 | Seletiva da Norte | Youngui | 2 | 1 | Vitória |
| 4 | Seletiva da Norte | Bask | 2 | 1 | Vitória |

Fase, data, imagem e vídeo ficam vazios. Não foram inventados local, prêmio, adversários futuros ou outras fases. Se já existirem posições conflitantes, ajuste-as no painel antes de publicar.

A conquista da Seletiva foi informada pelo responsável no pedido. O selo “Campeão da Seletiva da Norte” e a classificação histórica para o Regional só são exibidos quando os quatro resultados correspondentes acima estiverem presentes como vitórias no conjunto público. Não se infere título a partir de vitórias em qualquer outra competição. Alterar/remover um desses resultados retira esse destaque. O status atual e a próxima etapa continuam vindo dos campos do CMS. Nacional aparece como objetivo, nunca como classificação já conquistada.

## Administrar sem editar código

1. Acessar `/admin/trajetoria.html` com uma conta autorizada. O padrão é o ano 2026.
2. Editar título, subtítulo, ano, etapa atual, situação, próxima etapa, imagem principal e publicação. Ano é único no banco. Alterar o ano muda o registro: a página pública fixa de 2026 só mostra o registro desse ano. Para abrir outro ano no painel, usar `?year=2027`, por exemplo.
3. Salvar a trajetória antes de cadastrar batalhas. Upload de imagem usa o bucket público `central-media`, pasta `trajectory/`, com o validador já existente de até 5 MB.
4. No formulário de batalha, preencher competição, adversário, placares, resultado e posição. Fase, data, vídeo e imagem são opcionais. Campos de placar vazios significam não informados; zero é válido.
5. Clicar **Salvar batalha**. Após salvar, o formulário mantém o ID para continuar editando esse registro. Para adicionar outro, clicar **Novo / limpar formulário**.
6. Para editar, usar **Editar** na lista. Para excluir, usar **Excluir** e confirmar.
7. Para reordenar, editar **Ordem de exibição**, salvar e conferir a lista. Menor número vem primeiro. Recomenda-se 1, 2, 3, 4 ou intervalos como 10, 20, 30. Em empates, o ID fornece desempate estável. Nenhuma biblioteca de drag-and-drop foi adicionada.
8. Conferir tudo e selecionar **Publicado** na trajetória. As batalhas herdam essa visibilidade. Voltar a **Rascunho** e salvar retira a trajetória e suas batalhas da leitura pública.
9. Recarregar páginas públicas abertas para ver alterações; não há Realtime nesta etapa. A restauração da página pelo histórico também refaz a consulta.

A seção “Próximo capítulo” mostra a etapa atual (Regional / Classificado), a próxima meta (Estadual) e o Nacional como objetivo final. Para compatibilidade, registros de Regional com next_stage vazio ou Nacional exibem Estadual como próxima meta, sem gravação no banco. A equipe continua controlando current_stage, current_status e next_stage no painel.

## Testes e validação da implementação inicial

- 11 testes Node aprovados, incluindo SQL/RLS em PostgreSQL local via PGlite. O cadastro opcional foi executado duas vezes no teste: uma trajetória e quatro batalhas, mantendo placar zero e rascunho invisível.
- 31 testes Chrome aprovados (23 existentes + 8 da trajetória): publicação/despublicação, ordem, quatro placares, CRUD pelo painel, reordenação, XSS, estados vazio/erro, teaser e larguras 375/390/430/768/1440.
- Testes de notícias existentes continuam aprovados. Backend e Auth são simulados apenas nesses testes de navegador, sem gravar no Supabase real.
- Capturas de tela revisadas em mobile e desktop. Nomes longos não causam overflow e placares permanecem juntos.
- `npm run build` aprovado com SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY reais. Arquivos públicos e módulos são copiados para dist; SQL/testes/docs não são publicados.
- Consulta adicional no Chrome com SDK e Supabase reais, sem mock: HTTP 200 para trajetória publicada de 2026, sem registro público retornado; página exibiu “Trajetória ainda não publicada”, sem erros de execução.
- Não houve criação/publicação/edição de registros no banco hospedado. Não houve alteração de RLS, Auth, chaves, notícias ou commit.

## Limites da publicação

O teaser da home usa a informação factual fornecida no pedido e aponta à página independente. Ele não expõe registros privados do CMS; se a trajetória estiver em rascunho, a página de destino informa que ainda não foi publicada. Para atualizar o teaser em etapas futuras, seu texto está delimitado pelos comentários `trajectory-teaser:start/end` no HTML.

A página só exibirá os quatro resultados reais após cadastrá-los/revisá-los e publicar a trajetória no painel. Nenhuma imagem nova é obrigatória; imagem principal e imagens de batalha são opcionais e vêm do CMS. O hero possui a foto local real como alternativa.


## Arquivos da implementação inicial (histórico)

Criados:

- `css/trajetoria.css`
- `docs/TRAJETORIA-2026.md`
- `js/public/trajectory-service.js`
- `js/public/trajetoria.js`
- `supabase/trajectory-2026.example.sql`
- `tests/browser/trajectory.spec.js`

Alterados:

- `admin/trajetoria.html`
- `index.html`
- `js/admin/trajetoria.js`
- `tests/browser/news-fixture.js`
- `tests/rls.test.mjs`
- `tests/structure.test.mjs`
- `trajetoria-2026.html`

Página pública substitui o placeholder por consultas e composição editorial própria. O painel passa a aceitar ano editável, mostra placares/posição na lista e informa a publicação real. O campo position existente permite reordenar sem SQL adicional. Index recebe somente o teaser delimitado; CSS e JavaScript originais da landing são idênticos. Os testes e a fixture foram ampliados; a comparação de integridade da home exclui somente as importações previamente autorizadas e o novo teaser, tolerando LF/CRLF nas importações. Nenhum commit ou staging do Git foi realizado.


## Revisão visual da campanha

- Hero em duas colunas no desktop, título em duas linhas, fotografia real e status compacto. No mobile, foto recortada após o texto, sem área preta vazia.
- Percurso completo: Seletiva da Norte → Regional → Estadual → Nacional. Regional aparece como atual; Estadual como próxima meta; Nacional como objetivo final. A conquista da seletiva continua condicionada aos resultados públicos já verificados.
- Batalhas em duas colunas no desktop, uma por bloco no mobile, placares protagonistas e metadados discretos; mesmas consultas e ordem.
- Bloco de conquista em tom claro encerra a seletiva; próximo capítulo mostra Regional, status, próxima meta e caminho futuro.
- Nenhuma alteração em home, admin, Auth, RLS, notícias, serviço de consultas ou configuração de build.
- O SQL opcional de cadastro inicial agora usa Estadual. Ele mantém on conflict do nothing e NÃO modifica registros já existentes. A normalização visual dá compatibilidade imediata ao cadastro antigo.

Se desejar alinhar o valor persistido no banco, basta editar **Próxima etapa: Estadual** no painel existente. Alternativamente, executar manualmente no SQL Editor:

```sql
update public.trajectory
set next_stage = 'Estadual'
where year = 2026
  and lower(trim(current_stage)) = 'regional'
  and lower(trim(current_status)) = 'classificado'
  and lower(trim(next_stage)) = 'nacional';
```

Esse UPDATE não foi executado nesta entrega. Não muda publicação, resultados, etapa atual ou registros de outras etapas. A revisão usa apenas o Supabase público para validação; nenhum dado é gravado automaticamente.

## Validação da revisão visual

- 43 testes aprovados: 11 Node e 32 Chrome. Incluem privacidade, publicação/despublicação, notícias, painel, foto do CMS, fallback real e larguras 375/390/430/768/1440.
- Build aprovado com SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY. HTML, CSS, módulos e foto local conferidos fisicamente em dist.
- Consulta no navegador com SDK e Supabase reais: HTTP 200 para trajetória e batalhas; quatro resultados renderizados; nenhum erro de execução ou requisição. Nenhum dado remoto foi alterado.
- Nesta revisão foram alterados somente css/trajetoria.css, js/public/trajetoria.js, supabase/trajectory-2026.example.sql, tests/browser/trajectory.spec.js e este documento.
