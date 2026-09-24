# Relatório — CMS de notícias (etapa anterior)

Registro histórico da entrega do CMS. A configuração pública e o estado do projeto evoluíram; consulte [CONEXAO-SUPABASE.md](CONEXAO-SUPABASE.md) para a conexão real e os nomes atuais das variáveis.

## Resultado

Fluxo implementado em HTML, CSS e JavaScript puro: login → criar/editar rascunho → prévia privada → publicar → aparecer no portal e nos destaques da home. A configuração continua vazia porque o projeto Supabase ainda não foi criado. Nenhuma credencial real, senha padrão, seed de notícias, commit ou deployment foi criado.

A base V2 atual foi analisada antes da alteração. Foram reutilizados cliente/configuração, guard, repositório, paginação, upload, validação e políticas existentes. A migração incremental acrescenta roles sem refazer a base. Agenda e trajetória não foram ampliadas.

## Arquivos criados (12)

- `css/home-news.css`
- `css/noticias.css`
- `docs/CMS-NOTICIAS.md`
- `js/admin/news-cover.js`
- `js/admin/news-preview.js`
- `js/news.js`
- `js/public/home-news.js`
- `js/public/news-render.js`
- `js/public/noticias.js`
- `supabase/migrations/202609210002_editorial_profiles.sql`
- `tests/browser/news-fixture.js`
- `tests/browser/news.spec.js`

## Arquivos alterados (19)

- `README.md`
- `admin/index.html`
- `admin/noticia-form.html`
- `css/admin.css`
- `docs/SUPABASE.md`
- `docs/V2-ARQUIVOS.md`
- `index.html`
- `js/admin/auth.js`
- `js/admin/dashboard.js`
- `js/admin/list-view.js`
- `js/admin/noticias.js`
- `js/admin/storage.js`
- `js/supabase-client.js`
- `noticia.html`
- `noticias.html`
- `tests/browser/admin.spec.js`
- `tests/rls.test.mjs`
- `tests/structure.test.mjs`
- `vercel.json`

## Diff resumido desta etapa

- Home: duas linhas de importação (`home-news.css` e `home-news.js`). O conteúdo HTML aprovado permanece igual; o módulo só preenche os espaços existentes quando encontra notícias publicadas em destaque.
- Estilos originais `css/style.css`, comportamento original `js/main.js` e todos os assets permanecem byte a byte iguais.
- Novo CSS da home só atua quando há dados do CMS e impede overflow de textos longos. Não muda cores, tipografia, composição ou seções da landing.
- Painel: slug automático com edição manual, rascunho/publicação, preview em diálogo, capa com prévia/upload, confirmação de exclusão, status distintos e erros amigáveis.
- Portal: listagem paginada por publicação decrescente, detalhe por slug, conteúdo renderizado com textContent, quebras/parágrafos preservados e cliente anônimo separado da sessão administrativa.
- SQL: nova `profiles`, migração da autorização legada e reaproveitamento das policies já existentes. A primeira migration permanece intacta.
- Documentação/testes atualizados. O inventário da primeira V2 está marcado como histórico.

A V2 anterior ainda estava sem commit (arquivos untracked). Por isso `git diff --stat` sozinho não mostra todo o CMS. Este inventário compara os arquivos com o estado real encontrado no início desta etapa; `git status --short` mostra também os arquivos não rastreados. Nenhum arquivo foi adicionado ao staging do Git.

## Banco, policies e bucket

- `public.news`: id, title, slug único, excerpt, content, cover_url, category, status draft/published, featured, author_name, published_at, created_at, updated_at.
- `public.profiles`: id vinculado a auth.users, role admin/editor, created_at. Apenas contas explicitamente autorizadas recebem perfil; nenhum signup cria role automaticamente.
- `public.events`, `public.trajectory`, `public.trajectory_matches`: estruturas anteriores preservadas. A autorização comum usa os perfis novos.
- `private.admin_users`: legado preservado para migração; não concede acesso depois da migration 002.
- `news_public_read`: published e published_at <= now(). Policies `news_admin_read/insert/update/delete`: somente admin/editor via is_admin().
- `profiles_read_own`: SELECT do próprio perfil; sem escrita do cliente. Admin/editor não podem promover usuários pelo navegador.
- `central_media_admin_read/insert/update/delete`: restringem operações do Storage ao bucket correto e à autorização editorial.
- Bucket público **central-media**: JPEG/PNG/WebP/AVIF, até 5 MB. Capas em `news/covers/`; `news/content/` reservado. Imagens do bucket são públicas mesmo quando a notícia está em rascunho.

## Configuração real e primeiro admin

[Passo a passo completo, SQL do primeiro admin e checklist editorial](SUPABASE.md).

Resumo:

1. Criar um projeto Supabase dedicado.
2. Executar no SQL Editor, uma vez, `202609210001_cms_base.sql` e depois `202609210002_editorial_profiles.sql`.
3. Em Authentication → Users, criar a conta do responsável, confirmar o e-mail e copiar seu UUID.
4. Inserir o UUID com role `admin` em `public.profiles` pelo SQL Editor (SQL exato no guia). Não há senha padrão.
5. Preencher somente **SUPABASE_URL** e **SUPABASE_ANON_KEY** em `config/supabase-config.js`. A segunda aceita chave anon ou publishable; nunca service_role/secret.
6. Executar `npm run dev` e abrir `/admin/login.html`. No servidor já aberto nesta máquina, a porta é 4177; o padrão do script é 4175.
7. Fazer login e seguir o teste de rascunho → publicação → portal da seção 8 do guia.

Para Vercel, as mesmas variáveis públicas entram no ambiente de build. `npm run build` gera `dist`; sem variáveis válidas o build recusa continuar, evitando publicar configuração inválida. Não houve publicação nesta entrega.

## Validação executada e limites

- 11 testes Node aprovados, incluindo validação, build, isolamento de arquivos e permissões SQL em PostgreSQL local via PGlite.
- 21 cenários de navegador aprovados: os 10 anteriores de acesso/painel e 11 do fluxo de notícias. Chrome headless; larguras 375, 390, 430 e 1440 px; sem erros de runtime nos cenários de responsividade.
- Sintaxe de todos os módulos/scripts revisada; HTML verificado quanto a IDs duplicados e referências locais ausentes: nenhum erro.
- Imagens de tela das páginas públicas revisadas em mobile e desktop. Estado sem capa usa a identidade local da Central, sem inventar imagens da notícia.
- 16 arquivos protegidos conferidos por SHA-256 (assets, CSS/JS originais, módulos de agenda/trajectory, página de trajetória e primeira migração). O teste do index remove somente as duas importações novas antes de comparar com o original.
- No navegador, Auth/SDK/API/Storage são simulados exclusivamente nos testes; os dados vivem em memória e não são enviados a serviço externo. O site entregue não tem mock nem bypass.
- As migrations executaram no PostgreSQL PGlite; os contratos de Auth e Storage foram representados localmente. Não foi possível testar login, upload e políticas em um projeto Supabase hospedado porque esse projeto ainda não existe.

## Limitações e manutenção

- Publicação reflete na próxima consulta/carregamento, sem Realtime; recarregar abas já abertas. Datas futuras são respeitadas pelo RLS.
- Prévia de rascunho é privada dentro do painel; o link público de rascunho retorna “Notícia não encontrada”.
- Cancelar tenta limpar uploads desta edição; salvar remove os não utilizados e mantém a capa escolhida. Fechamento abrupto/perda de rede pode deixar órfãos. Capas já salvas e imagens de notícia excluída não são apagadas automaticamente, para preservar possíveis referências compartilhadas.
- Conteúdo é texto simples, sem HTML/editor enriquecido/imagens no corpo. Não há dados editoriais reais inseridos nesta fase.
- Título e descrição de notícia atualizam no navegador; metadados sociais individuais no servidor ficam para outra etapa. `noindex, nofollow` permanece por se tratar de demonstração.
- Cadastro/recuperação de senha, hierarquia editorial granular, revisão/aprovação e controle de alterações concorrentes continuam fora do escopo. Admin e editor têm as mesmas permissões editoriais nesta etapa.

## Imagens e conteúdo pendentes

Nenhum arquivo novo precisa ser colocado em `assets/img/` para este CMS funcionar. Os assets da landing foram preservados. Capas das notícias serão enviadas pelo painel ao Storage ou preenchidas com URL HTTPS aprovada. Títulos, textos, datas, autores e destaque devem ser cadastrados pela equipe com informações reais; não foi criada nenhuma notícia de exemplo no banco.
