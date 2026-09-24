# Conexão da V2 com o Supabase real

## Estado verificado em 21/09/2026

Projeto: `https://umsvhxgwqnkhjkazgzjj.supabase.co`.

A URL e a publishable key fornecidas estão configuradas em `config/supabase-config.js`. Foram feitas apenas leituras remotas, sem SQL, criação de usuários, upload ou alteração de dados.

| Verificação real | Resultado |
| --- | --- |
| GET Auth `/auth/v1/settings` com a chave pública | HTTP 200; chave aceita pelo serviço |
| Login por e-mail | Habilitado |
| Cadastro público | Habilitado; desabilitar no dashboard para este painel fechado |
| Login anônimo | Desabilitado |
| Confirmação automática de e-mail | Desabilitada; confirmar a conta criada administrativamente |
| API de profiles, news, events, trajectory, trajectory_matches | HTTP 404, `PGRST205`: tabelas não encontradas no schema cache |
| SDK real no Chrome, sem mock | Carregado; formulário de login habilitado |
| Mensagem do login | “Use a conta autorizada pela administração da Central.” |
| Reutilização dos clients | Confirmada; uma instância por contexto (painel e leitura pública isolada) |
| Consulta pública real de notícias | Chegou ao projeto; HTTP 404 por tabela ainda indisponível |
| Erros de execução JavaScript no teste real | Nenhum |

**Conectar a chave não cria o banco.** As tabelas ainda não estavam disponíveis pela API nesta verificação. Não foi possível comprovar a aplicação de RLS nem a existência/configuração do bucket no projeto hospedado. As migrations abaixo estão prontas e foram testadas localmente; você deve executá-las no SQL Editor.

## 1. SQL e ordem exata

No projeto correto do Supabase, abra **SQL Editor → New query**, copie o arquivo inteiro e clique em **Run**. Aguarde sucesso antes do próximo arquivo:

1. [202609210001_cms_base.sql](../supabase/migrations/202609210001_cms_base.sql)
   - Cria news, events, trajectory, trajectory_matches e a estrutura privada legada.
   - Inclui constraints, slug único, índices, relacionamentos, timestamps, RLS, bucket e policies de Storage.
2. [202609210002_editorial_profiles.sql](../supabase/migrations/202609210002_editorial_profiles.sql)
   - Cria profiles com FK para auth.users e role restrita a admin/editor.
   - Atualiza `is_admin()` para verificar a role em profiles.
   - Mantém compatibilidade com os guards e policies existentes.

Os arquivos são transacionais e preparados para uma execução em projeto vazio. **Não são scripts de reaplicação idempotente.** Se já executou o primeiro com sucesso, execute apenas o segundo; não apague tabelas ou policies para contornar um erro. Se houve erro, a transação correspondente não deve ser considerada aplicada.

Depois de ambos, conferir as cinco tabelas públicas no Table Editor e o bucket `central-media` no Storage. Você pode confirmar RLS no SQL Editor:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'news', 'events', 'trajectory', 'trajectory_matches');
```

As cinco linhas devem ter `rowsecurity = true`. Não crie policies adicionais que liberem escrita para qualquer usuário autenticado.

## 2. Auth e primeiro administrador

1. Em **Authentication**, mantenha o provedor de e-mail/senha habilitado.
2. Desabilite novos cadastros públicos nas configurações de Auth. O painel não oferece cadastro; contas são autorizadas manualmente. Mesmo antes dessa mudança, um usuário sem perfil não recebe permissão editorial.
3. Mantenha login anônimo desabilitado.
4. Em **Authentication → Users → Add user → Create new user**, cadastre o e-mail do responsável e uma senha forte definida por ele. Confirme o e-mail usando o mecanismo administrativo de confirmação dessa conta ou o fluxo de confirmação do Auth. Não há senha padrão no projeto.
5. Abra o usuário e copie seu **UUID/User ID**, não o e-mail.
6. Em **SQL Editor → New query**, substitua o marcador pelo UUID real e execute:

```sql
insert into public.profiles (id, role)
values ('UUID_DO_USUARIO'::uuid, 'admin')
on conflict (id) do update set role = excluded.role;
```

O mesmo SQL está em [first-admin.example.sql](../supabase/first-admin.example.sql), junto com uma consulta de conferência. Ele não cria conta nem senha. Para outro editor explicitamente autorizado, usar role `editor`.

7. Abra `http://127.0.0.1:4177/admin/login.html` no servidor já utilizado nesta máquina. Se iniciar `npm run dev` sem especificar porta, o padrão será `http://127.0.0.1:4175/admin/login.html`.
8. Entre com o e-mail e a senha criados. O código usa `signInWithPassword()`, valida o usuário no Auth e chama `is_admin()` no banco. Essa função lê a role de profiles; não usa metadados editáveis do usuário.
9. Recarregue uma página do painel para confirmar a sessão persistente. Use **Sair** para encerrar a sessão local.

Admin e editor têm as mesmas permissões editoriais nesta etapa. Nenhum deles pode criar ou alterar roles pelo cliente. Para revogar acesso, executar no SQL Editor:

```sql
delete from public.profiles where id = 'UUID_DO_USUARIO'::uuid;
```

Para produção, configure o Site URL do Auth com o domínio HTTPS aprovado. O login atual por senha não usa callback OAuth. Fluxos de convite, recuperação por link e MFA não foram adicionados nesta etapa.

## 3. RLS preservada

| Tabela | Público | Admin/editor autorizado |
| --- | --- | --- |
| news | SELECT apenas published e published_at <= now() | SELECT/INSERT/UPDATE/DELETE |
| events | SELECT apenas published | SELECT/INSERT/UPDATE/DELETE |
| trajectory | SELECT apenas publication_status = published | SELECT/INSERT/UPDATE/DELETE |
| trajectory_matches | SELECT apenas quando a trajetória pai está publicada | SELECT/INSERT/UPDATE/DELETE |
| profiles | Nenhuma leitura anônima; autenticado lê somente o próprio perfil | Sem escrita pelo navegador; manutenção via SQL Editor |

As policies de cada entidade `*_admin_read/insert/update/delete` exigem `is_admin()`, que verifica profiles.role IN ('admin', 'editor'). Usuário apenas autenticado não recebe escrita. `news_public_read`, `events_public_read`, `trajectory_public_read` e `matches_public_read` conservam as regras acima.

A prévia de rascunho fica dentro do painel. A página pública usa um client anônimo isolado, além do filtro explícito por publicação, mesmo se houver um editor logado no mesmo navegador. Os dois clients ficam centralizados em `js/supabase-client.js`, cada um criado uma vez e reutilizado; não existem clients espalhados pelas páginas.

## 4. Storage central-media

**Não criar manualmente o bucket antes de executar a primeira migration**, pois ela já o cria:

- Nome/ID: `central-media`.
- Público: sim, para leitura das imagens por URL.
- Limite: 5 MB (5.242.880 bytes), também validado no frontend.
- MIME types: image/jpeg (jpg/jpeg), image/png, image/webp e image/avif já suportado na V2.
- Pastas: `news/covers/`, `news/content/`, `events/`, `trajectory/`. Pastas são prefixos dos objetos; não precisam ser criadas antecipadamente.
- Capas usam nomes UUID, sem sobrescrever arquivo existente.

Policies na primeira migration, usando a autorização por role após a segunda:

| Policy em storage.objects | Operação | Condição |
| --- | --- | --- |
| central_media_admin_read | SELECT de metadados | bucket_id = central-media e is_admin() |
| central_media_admin_insert | INSERT/upload | mesma condição em WITH CHECK |
| central_media_admin_update | UPDATE | mesma condição em USING e WITH CHECK |
| central_media_admin_delete | DELETE | mesma condição em USING |

Visitante pode visualizar os bytes públicos, mas não enviar, atualizar, listar metadados ou excluir objetos por essas policies. O frontend valida tipo, tamanho e assinatura; a autorização efetiva é do Storage/RLS. SVG e arquivos executáveis não são aceitos pelo formulário.

Imagens do bucket público são acessíveis mesmo quando vinculadas a rascunho. O texto do rascunho continua privado. Não usar esse bucket para mídia confidencial. O formulário limpa uploads não utilizados da edição ao salvar/cancelar quando possível; mídia já salva não é excluída automaticamente.

## 5. Configuração local

O mecanismo ESM existente foi preservado. Não há `window.APP_CONFIG` paralelo nem `process.env` no navegador.

- Configuração ativa: [config/supabase-config.js](../config/supabase-config.js), já preenchida com os valores públicos fornecidos.
- Exemplo vazio: [config/supabase-config.example.js](../config/supabase-config.example.js).
- Variáveis exportadas: `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`.
- `SUPABASE_ANON_KEY` deixou de ser o nome de configuração. A validação ainda aceita uma chave anon legada como valor da variável principal, caso necessário.
- URL ausente, chave ausente, formatos inválidos e chaves administrativas são recusados. Espaços acidentais no início/fim são removidos.
- Modelo de variáveis de build: [.env.example](../.env.example), sem valores reais.

Execute `npm run dev` e acesse pelo endereço HTTP informado. Abrir HTML pelo protocolo `file://` não é suportado para módulos ES. A mensagem de configuração pendente já desapareceu no teste real. Uma falha de rede/CDN mostra mensagem de conexão, sem afirmar incorretamente que faltam as variáveis.

Essas duas informações são públicas. Não inserir senha, `SUPABASE_SECRET_KEY`, `sb_secret_...` ou `service_role`. A segurança depende de Auth e RLS.

## 6. Vercel

1. Importar o repositório com preset **Other**.
2. Em **Settings → Environment Variables**, configurar para os ambientes desejados:
   - `SUPABASE_URL`: `https://umsvhxgwqnkhjkazgzjj.supabase.co`.
   - `SUPABASE_PUBLISHABLE_KEY`: a mesma chave pública fornecida, disponível na configuração local ou no Dashboard do Supabase. Colar sem aspas.
3. Não configurar secret key ou service_role para este frontend. A variável antiga `SUPABASE_ANON_KEY` não é mais lida pelo build.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Usar Node 22 ou superior. `vercel.json` já contém o comando e o diretório.
7. Fazer um novo deployment após alterar variáveis. Esta entrega não fez deployment.

`scripts/build.mjs` lê o ambiente **somente no Node durante o build**, valida os valores e gera `dist/config/supabase-config.js` com exports públicos. Não depende de variáveis de ambiente no navegador e não usa o arquivo local como fallback silencioso. Sem configuração válida, o build falha.

Para reproduzir localmente, copiar `.env.example` para `.env`, preencher os valores públicos e executar:

```sh
node --env-file=.env scripts/build.mjs
```

O build não publica SQL, testes, documentação, `.env`, `.git`, node_modules ou o exemplo vazio de configuração. A CSP administrativa já permite o SDK esm.sh e a conexão com o domínio Supabase usado.

## 7. Teste manual completo, depois do setup

Os textos a seguir foram fornecidos para teste pelo responsável. **Não foram publicados nem inseridos automaticamente.** Confirme seu conteúdo antes de torná-los públicos.

1. Fazer login como admin e abrir **Notícias → Nova notícia**.
2. Preencher:
   - Título: **Jotapê conquista a Seletiva da Norte e garante vaga no Regional**.
   - Categoria: **Batalhas**.
   - Resumo: **Jotapê venceu a Seletiva da Norte e garantiu classificação para o Regional na caminhada rumo ao Nacional.**
   - Conteúdo: texto completo revisado pelo responsável; é obrigatório e não deve ficar vazio.
   - Autor: nome real aprovado pela equipe.
3. Conferir o slug automático: `jotape-conquista-a-seletiva-da-norte-e-garante-vaga-no-regional`. Pode ser editado manualmente; deve ser único.
4. Se tiver uma capa aprovada, selecionar jpg/jpeg/png/webp de até 5 MB, conferir a prévia e clicar **Enviar imagem**. Opcionalmente marcar **Destacar notícia na home**.
5. Clicar **Salvar rascunho**. Recarregar o formulário e conferir dados/capa e sessão.
6. Em uma janela anônima, abrir `/noticias.html` e `/noticia.html?slug=jotape-conquista-a-seletiva-da-norte-e-garante-vaga-no-regional`. O rascunho não deve constar na lista; o endereço individual deve dizer “Notícia não encontrada”.
7. Editar o rascunho e usar **Visualizar** no painel para conferir o conteúdo sem publicá-lo.
8. Deixar a data vazia ou passada e clicar **Publicar**. Data futura agenda a leitura, portanto não serve para testar publicação imediata.
9. Recarregar a lista pública: a notícia deve aparecer. Abrir pelo título e conferir slug, capa, categoria, resumo, autor, data e parágrafos.
10. Se marcada como destaque, conferir a home: ela mostra até 3 notícias publicadas em destaque, da mais recente para a mais antiga.
11. Alterar o conteúdo de uma notícia publicada, clicar **Publicar** novamente e recarregar o detalhe público para conferir.
12. Tentar criar outra notícia com o mesmo slug: deve aparecer erro, sem duplicar o registro. Cancelar essa tentativa.
13. No painel, clicar **Despublicar** e confirmar. Recarregar lista, detalhe e home em janela anônima: a notícia deixa de aparecer. O link individual volta a “Notícia não encontrada”.
14. Conferir **Excluir**: cancelar primeiro para manter o registro; confirmar apenas se quiser remover a notícia de teste. Arquivos já salvos podem permanecer no bucket para evitar apagar referências compartilhadas.
15. Clicar **Sair**. Acessar novamente uma URL do painel deve redirecionar ao login.
16. Com uma conta comum criada administrativamente, sem linha em profiles, confirmar que o login não libera o painel. Não autorizar essa conta para testar a negativa.

Não há Realtime nesta etapa: recarregar páginas já abertas para ver alterações. Não basta estar autenticado para escrever; a role precisa estar autorizada no banco.

## 8. Testes, preservação e pendências

- 11 testes Node aprovados: validação, build, segurança, SQL/RLS em PostgreSQL local via PGlite.
- 21 testes de navegador aprovados com backend simulado exclusivamente nos testes; incluem o fluxo editorial, upload, roles, XSS, agendamento, erros e larguras 375/390/430/1440 px.
- Teste adicional no Chrome com SDK e projeto reais, sem interceptação/mocks: formulário habilitado e consulta pública chegando à API. Não foi feito login com senha.
- Migrations, landing, CSS visual, assets, trajetória e modelagem foram preservados. Não houve commit.
- Não houve execução de SQL remota, criação de usuário, alteração de Auth, criação de bucket, upload ou publicação automática.

Ações que ainda dependem de você no dashboard: **executar as duas migrations; conferir RLS e Storage; desabilitar signup público; criar/confirmar a conta; inserir a role admin; configurar o domínio de Auth para produção; executar o teste manual**. Na Vercel, cadastrar as duas variáveis e fazer o deployment quando desejar publicar.

O relatório de arquivos e diff desta etapa está no final deste documento.


## 9. Arquivos e diff desta etapa

### Criados (3)

- `config/supabase-config.example.js`
- `docs/CONEXAO-SUPABASE.md`
- `supabase/first-admin.example.sql`

### Alterados (16)

- `.env.example`
- `README.md`
- `config/supabase-config.js`
- `docs/CMS-NOTICIAS.md`
- `docs/SUPABASE.md`
- `js/admin/auth.js`
- `js/admin/ui.js`
- `js/config-validation.js`
- `js/public/noticias.js`
- `js/supabase-client.js`
- `scripts/build.mjs`
- `tests/browser/admin.spec.js`
- `tests/browser/news-fixture.js`
- `tests/browser/news.spec.js`
- `tests/build.test.mjs`
- `tests/validation.test.mjs`

### Diff resumido

- Configuração local pública preenchida, com exemplo vazio separado.
- Nome principal alterado para SUPABASE_PUBLISHABLE_KEY no cliente, build, validação e fixtures de testes.
- Validação de formatos e espaços; diferenciação entre configuração ausente, falha de conexão e schema pendente.
- Testes de ausência de configuração agora interceptam explicitamente um arquivo vazio; não dependem de apagar a configuração real nem fazem login real inadvertidamente.
- Documentação atualizada; relatório anterior mantido como histórico. SQL do primeiro admin fornecido em arquivo próprio.
- As duas migrations e todas as regras de segurança existentes permanecem iguais, prontas para execução no dashboard.
- Build de produção validado com as duas variáveis públicas reais; nenhuma publicação realizada.

O inventário compara o estado com a etapa anterior. Como a V2 ainda contém arquivos não rastreados, `git diff --stat` sozinho não inclui todos eles; usar também `git status --short`. Nada foi adicionado ao staging do Git e nenhum commit foi feito.
