# Central Jotapê — Supabase e CMS de notícias

Para o estado verificado no projeto real e as ações pendentes, veja [CONEXAO-SUPABASE.md](CONEXAO-SUPABASE.md).

## O que foi preservado

A base analisada é a versão confirmada pelo usuário em `C:\Users\Arklok\Desktop\backup codigos\central-jotape`, commit `9cf2c9e`. Foram analisados HTML, CSS, JavaScript, README, recursos e estrutura Git antes da implementação.

A home recebeu somente a importação do módulo de notícias e uma folha de estilos restrita a esses espaços dinâmicos (quebra de títulos longos); `css/style.css`, `js/main.js`, imagens, ícones, fontes e todo o HTML editorial aprovado foram preservados. Quando existem destaques publicados, os três espaços editoriais existentes são preenchidos dinamicamente; sem destaques ou em caso de erro, permanecem originais. A home continua disponível mesmo sem Supabase. Não há React ou outro framework.

Conflitos identificados e evitados:

- `main.js` acessa elementos específicos da landing; não é importado no painel nem nas páginas novas.
- O CSS público contém regras globais; o painel tem sua própria folha de estilos.
- As chaves em HTML/JS estático são públicas. Variáveis da Vercel não chegam ao navegador sem uma etapa explícita de build.
- Login válido não equivale a administrador. A autorização fica em `public.profiles`, protegida por RLS e sem escrita pelo cliente, nunca em metadados editáveis do usuário.
- `current_status` da trajetória não é status editorial; foi adicionado `publication_status` com padrão `draft`.
- A migração foi feita para projeto novo e aborta em conflitos, evitando sobrescrever tabelas/policies já existentes.
- Regras permissivas anteriores em `storage.objects` poderiam ampliar acesso por OR; usar projeto novo ou revisar todas as policies existentes antes de aplicar.

## Escopo entregue

- Login por e-mail/senha com Supabase Auth, saída da sessão local e proteção das cinco rotas administrativas.
- Verificação com `getUser()` e RPC `is_admin()`, incluindo retorno à aba e restauração pelo histórico.
- Dashboard com contagens reais (nenhum número inventado).
- CMS de notícias: slug automático/editável, rascunho, prévia privada, publicação/despublicação, agendamento, exclusão confirmada e paginação de 20 registros. CRUD anterior de eventos e trajetória mantido.
- Texto simples nas notícias; não existe interpretação de HTML do banco.
- Upload reutilizável, URLs validadas, tipos raster e limite de 5 MB.
- SQL transacional com tabelas, constraints, índices, timestamps, RLS e bucket.
- Notícias públicas paginadas (12 por página), detalhe por slug e até 3 destaques na home. Trajetória pública permanece na estrutura inicial, fora desta etapa.
- Build estático para Vercel com lista explícita de arquivos publicáveis.

## 1. Criar e configurar Supabase

1. O projeto `umsvhxgwqnkhjkazgzjj` já foi criado e sua configuração pública já está preenchida localmente. Para outro ambiente, criar um projeto dedicado. Não inserir a senha do banco nem chaves secretas neste repositório.
2. Abrir SQL Editor e executar **uma única vez e nesta ordem** `supabase/migrations/202609210001_cms_base.sql` e `supabase/migrations/202609210002_editorial_profiles.sql`. Se a primeira já foi aplicada, executar somente a segunda. Não reaplicar nem remover tabelas para contornar erros.
3. Conferir as cinco tabelas públicas (`news`, `events`, `trajectory`, `trajectory_matches`, `profiles`) e o bucket. A segunda migração mantém UUIDs da antiga lista privada como admins e troca a fonte de autorização para `profiles`.
4. Em Authentication, habilitar login por e-mail/senha e **desabilitar cadastro público e login anônimo**. O painel não oferece cadastro.
5. Em **Authentication → Users → Add user → Create new user**, cadastrar o e-mail real do administrador e uma senha forte definida pelo responsável, sem compartilhar ou salvar a senha no código. Confirmar o e-mail pela opção administrativa de confirmação ao criar essa conta controlada ou pelo fluxo de confirmação do Auth. Não existe senha padrão. A primeira versão do painel não implementa convite/recuperação por link; administrar isso pelo Dashboard até o fluxo dedicado existir.
6. Abrir o usuário criado em **Authentication → Users**, copiar seu **User UID/ID** (UUID, não e-mail) e executar no SQL Editor, substituindo o marcador:

```sql
insert into public.profiles (id, role)
values ('UUID_REAL_DO_USUARIO'::uuid, 'admin')
on conflict (id) do update set role = excluded.role;
```

Nenhum cadastro de Auth cria um perfil editorial automaticamente. Para outro editor autorizado, repetir o SQL com role `editor`. Admin e editor têm as mesmas permissões editoriais nesta etapa; nenhum deles pode criar/alterar roles pelo navegador. A promoção e a revogação são feitas somente pelo responsável no SQL Editor.

Após configurar as duas variáveis públicas da seção 4, abrir `/admin/login.html`, informar o e-mail e a senha dessa conta e entrar. Se a conta não tiver uma linha autorizada em `profiles`, o painel recusará o acesso mesmo com senha correta.

Para revogar acesso:

```sql
delete from public.profiles where id = 'UUID_REAL_DO_USUARIO'::uuid;
```

As políticas passam a negar a próxima operação imediatamente. Para encerrar também sessões de Auth, use as ferramentas administrativas do Supabase. Dados já vistos no navegador não podem ser retirados retroativamente.

7. Configurar o Site URL com o domínio HTTPS de produção e Redirect URLs exatas necessárias aos fluxos de Auth futuros. Evitar curingas amplos. O login atual por senha não depende de redirecionamento OAuth.
8. Conferir rate limits e proteção contra tentativas excessivas no Auth antes de disponibilizar o painel.

## 2. Tabelas e acesso

| Entidade | Finalidade | Leitura pública | Escrita |
| --- | --- | --- | --- |
| `public.news` | Todos os campos de notícias pedidos | `status = published` e `published_at <= now()` | Admin/editor autorizado |
| `public.events` | Agenda com data e horário local separados | `status = published` | Admin/editor autorizado |
| `public.trajectory` | Dados anuais, ano único | `publication_status = published` | Admin/editor autorizado |
| `public.trajectory_matches` | Batalhas, FK e ordenação | Apenas quando a trajetória pai estiver publicada | Admin/editor autorizado |
| `public.profiles` | UUID, role `admin`/`editor`, created_at | Nunca; usuário autenticado lê somente seu próprio perfil | Somente SQL Editor/ambiente confiável |
| `private.admin_users` | Legado da primeira migração; não autoriza mais | Nunca | Não utilizar para conceder acesso |

A migração inclui exatamente os campos solicitados, mais `trajectory.publication_status` para impedir exposição acidental de rascunhos. Tabelas SQL usam nomes minúsculos.

- Notícias/eventos: `draft` ou `published`.
- Trajetória: `publication_status` usa os mesmos valores; `current_status` é texto sobre a competição.
- Batalha: `pending`, `win`, `loss`, `draw`.
- Placar ausente = NULL; placar zero continua válido.
- `news.published_at` é UTC no banco. O editor informa o horário local do seu dispositivo. Data futura limita a leitura pública por RLS sem exigir cron.
- `events.event_time` é horário local do evento, sem conversão de fuso. Definir cidade/local corretamente; suporte a múltiplos fusos explícitos pode ser ampliado depois.
- Notícias têm slug único. Trajetórias têm ano único. Exclusão da trajetória remove suas batalhas por FK.
- `created_at` tem default no banco e `updated_at` é atualizado por trigger. A função de trigger não é exposta para execução pelos clientes.
- Sem seed editorial e sem números, eventos ou usuários fictícios.

RLS é a segurança real. HTML e JavaScript do painel são arquivos estáticos públicos; esconder a tela só evita exposição visual acidental. Alterar o JavaScript localmente não concede privilégios no banco.

## 3. Bucket central-media

A migração cria `central-media` com:

- acesso público aos bytes de imagem;
- limite de 5 MB;
- MIME types JPEG, PNG, WebP e AVIF;
- listagem, upload, edição e exclusão de objetos restritos a admins/editors autorizados via RLS.

**Não enviar arquivos confidenciais ou imagens sob embargo.** Um bucket público serve os arquivos a quem possui sua URL, mesmo quando a notícia está em rascunho. Para imagens privadas seria necessário um bucket privado separado e URLs assinadas, fora desta etapa.

`js/admin/storage.js` exporta:

- `validateImage(file)`;
- `uploadImage(client, file, folder)` → `{ path, url }`;
- `removeImage(client, path)`;
- `bindUpload(form, client, folder)`.

Pastas permitidas: `news/covers` (capas do novo formulário), `news/content` (reservada para mídia futura), `news`, `news-inline`, `events`, `trajectory` (compatibilidade). O nome armazenado é UUID; não se reutiliza o nome enviado e não se sobrescrevem objetos. A checagem de assinatura no cliente é conveniência, não substitui as restrições do Storage.

O formulário mostra prévia local e exige clicar em **Enviar imagem** antes de salvar a capa. Ao cancelar, tenta remover uploads feitos nessa edição. Ao salvar, mantém a capa escolhida e remove os uploads não utilizados dessa edição. URLs de capas previamente salvas não são apagadas automaticamente: podem ser compartilhadas. Fechamento abrupto da aba, perda de conexão ou falha de limpeza ainda pode deixar arquivos órfãos; revisar `news/covers` no Dashboard. Nenhuma exclusão automática é feita apenas por encontrar um nome de arquivo no banco. Mídia no corpo fica para outra etapa; o conteúdo atual é texto simples.

## 4. Configuração local

Arquivo existente reutilizado: `config/supabase-config.js` (exports ESM). Ele já contém a URL e a publishable key públicas fornecidas pelo responsável. Modelo sem valores reais: `config/supabase-config.example.js`. Não há `process.env` no navegador nem um segundo sistema de configuração.

```js
export const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'SUA_CHAVE_PUBLICA';
```

Usar preferencialmente a chave **publishable** (`sb_publishable_...`) na variável `SUPABASE_PUBLISHABLE_KEY`. A validação aceita também uma chave anon legada como valor, mas não utiliza mais a variável `SUPABASE_ANON_KEY`. Nunca usar `service_role`, `sb_secret_...`, token pessoal ou senha.

A validação recusa chaves administrativas reconhecidas e URLs inseguras; ela não autentica criptograficamente uma chave. A validação real pertence ao Supabase.

Servir por HTTP local; módulos ES não funcionam corretamente abrindo o painel com `file://`:

```sh
npm run dev
```

Acessar `http://127.0.0.1:4175/admin/login.html`. O servidor local usa somente Node e publica apenas arquivos de frontend. Sem configuração, o painel informa a pendência e mantém login desabilitado.

A fábrica central mantém uma instância autenticada reutilizável para todo o painel e uma instância anônima reutilizável e isolada para a leitura pública. Não se criam clients nos módulos de notícias/agenda/trajectory; a separação evita que o visitante herde a sessão privilegiada do editor.

O SDK `@supabase/supabase-js@2.116.0` é carregado por import ESM do CDN `esm.sh`, no painel e nas páginas de notícias. A home só carrega o SDK quando a configuração pública é válida. Sem configuração, ela mantém seu conteúdo estático sem solicitar o SDK. Erros de CDN/conexão impedem login; a página pública original continua funcional.

## 5. Vercel: variáveis e build

1. Importar o repositório na Vercel com preset **Other**.
2. Configurar `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` nos ambientes desejados (Production/Preview/Development).
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. O arquivo `vercel.json` já declara essas opções e headers para `/admin/*`. Usar Node compatível com o projeto (Node 22 ou superior recomendado).
6. Após mudar uma variável, criar novo deployment.

O build lê o ambiente do processo e gera `dist/config/supabase-config.js`. Um arquivo `.env` não é carregado automaticamente: usar o ambiente da plataforma, exportar variáveis no terminal ou executar Node com `--env-file=.env`. `.env.example` é apenas documentação e `.env*` está ignorado no Git.

Exemplo local:

```sh
node --env-file=.env scripts/build.mjs
```

O build inclui exclusivamente páginas públicas, admin, assets, CSS, JS e configuração pública gerada. Não publica SQL, testes, documentação, `.git`, `.env` ou `node_modules`. Não há chave privada no build. Ambas as variáveis configuradas são públicas por definição.

CSP administrativa permite o SDK em `esm.sh` e conexão com `*.supabase.co`. Prévia de imagens aceita HTTPS e blob local. Se usar um domínio customizado do Supabase, ajustar explicitamente `connect-src` no `vercel.json`. Os headers não alteram o estilo da landing.

Nenhum deployment foi realizado nesta implementação.

## 6. Testes

```sh
npm ci
npm test
npm run test:browser
```

- `npm test`: validação, autorização, retorno seguro, uploads, payloads, integridade da landing, build e SQL real executado em PostgreSQL via PGlite. PGlite emula apenas os contratos de `auth.users`, `auth.uid()` e `storage` necessários aos testes.
- `npm run test:browser`: Chrome headless com SDK/servidor de teste simulados, estado persistido em memória durante cada cenário, login/logout, fluxo completo de publicação, duplicidade, upload/limpeza, falhas de operação, paginação, agendamento, prévia, texto seguro e larguras 375/390/430/1440. Dados dos testes não são enviados a nenhum Supabase.
- Ter Chrome instalado; pode trocar `channel: 'chrome'` por `'msedge'` no arquivo de configuração ou usar o Chromium do Playwright.
- Mock só existe dentro dos testes; não há modo demo nem bypass de autorização no código entregue.
- Os testes locais não substituem um teste real de ponta a ponta depois de configurar Auth, banco e Storage do projeto.

Checklist após configuração real:

1. Sem login: confirmar que as cinco rotas voltam ao login.
2. Conta comum sem perfil editorial: login não libera painel nem alterações pela API.
3. Administrador: criar, editar e excluir uma notícia de teste; conferir timestamps.
4. Publicar notícia com data futura: verificar que visitante não a lê até o horário.
5. Confirmar que visitante não lê rascunhos, mas lê notícia publicada.
6. Trajetória em rascunho: confirmar que batalhas associadas não aparecem por consulta pública.
7. Upload permitido como administrador; negar upload como visitante e conta comum.
8. Revogar um UUID e tentar nova edição, sem depender de logout.
9. Conferir SDK/CDN, CSP e login no domínio HTTPS final.
10. Remover os registros temporários de teste.

## 7. Policies efetivas

- `news_public_read`: visitante e usuário comum leem apenas `published` com `published_at <= now()`.
- `news_admin_read`, `news_admin_insert`, `news_admin_update`, `news_admin_delete`: chamam `is_admin()`; após a segunda migração, essa função verifica `profiles.role IN ('admin', 'editor')`. `UPDATE` tem `USING` e `WITH CHECK`.
- `profiles_read_own`: autenticado pode consultar somente seu próprio perfil. Sem grants nem policies de INSERT/UPDATE/DELETE para clientes; nenhuma autopromoção.
- `central_media_admin_read/insert/update/delete`: exigem bucket `central-media` e a mesma autorização editorial. Leitura pública dos bytes segue a configuração pública do bucket.
- Policies anteriores de eventos/trajectory/trajectory_matches permanecem, agora usando a mesma autorização por perfil. Não foram criadas policies permissivas para qualquer usuário autenticado.
- `is_admin()` usa `security definer`, `search_path = ''` e nomes qualificados; EXECUTE somente para `authenticated`. O nome legado foi preservado para não duplicar o guard e as policies.

O cliente das páginas públicas é independente e sem persistência de sessão. Mesmo com editor logado, ele consulta anonimamente e filtra status/data explicitamente. O banco continua sendo a barreira de segurança. A prévia de rascunho fica somente em diálogo dentro do painel.

## 8. Teste editorial após configurar o projeto real

1. Entrar no painel, abrir Notícias → Nova notícia.
2. Preencher título, resumo, conteúdo em parágrafos, categoria e autor. Conferir slug automático; editar manualmente se necessário.
3. Selecionar PNG/JPEG/WebP/AVIF de até 5 MB, conferir prévia e clicar **Enviar imagem**.
4. Marcar destaque e **Salvar rascunho**. Recarregar: dados e sessão devem permanecer.
5. Abrir `noticias.html` e `noticia.html?slug=SEU-SLUG` em uma janela anônima: rascunho não aparece.
6. Editar o rascunho e clicar **Visualizar** para conferir texto/capa sem publicar.
7. Deixar data vazia ou passada e clicar **Publicar**. Recarregar lista pública, detalhe e home: notícia aparece; home exibe no máximo 3 destaques publicados mais recentes.
8. Alterar o conteúdo de uma notícia publicada e clicar **Publicar** novamente; recarregar o detalhe para verificar a alteração.
9. Tentar outra notícia com o mesmo slug: deve mostrar erro sem criar duplicata.
10. Na lista do painel, usar **Despublicar** e confirmar. Recarregar as páginas públicas: notícia deixa de aparecer. Um endereço de rascunho é tratado como inexistente.
11. Conferir **Excluir** com cancelamento e confirmação. Arquivos já salvos permanecem no Storage para evitar apagar mídia compartilhada.
12. Usar **Sair** e tentar acessar o formulário novamente: deve voltar ao login.

A sincronização acontece em cada carregamento/consulta, sem copiar HTML manualmente e sem Realtime. Abas que já renderizaram um conteúdo precisam ser recarregadas. Publicar no formulário respeita a data; “Publicar” na lista publica agora. **Salvar rascunho** em uma notícia publicada a despublica.

## 9. Próximas etapas

- SEO social por notícia no servidor/prerender: título e descrição mudam no navegador, mas crawlers que não executam JS não recebem metadados individuais. A demonstração continua com `noindex, nofollow`.
- Desenvolver o design público da trajetória depois de aprovação específica.
- Editor enriquecido e mídia dentro do corpo (hoje é texto simples).
- Fluxo dedicado de convite/recuperação de senha, MFA e gestão de administradores, se desejados.
- Auditoria editorial, revisão/aprovação, controle de edição concorrente e limpeza de mídia órfã.
- Executar as duas migrações no projeto real, autorizar os editores e executar o checklist acima. A URL e a publishable key já estão configuradas localmente; elas não aplicam SQL nem criam usuários.

## Referências oficiais

- Auth/getUser: https://supabase.com/docs/reference/javascript/auth-getuser
- Login: https://supabase.com/docs/reference/javascript/auth-signinwithpassword
- RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Storage/RLS: https://supabase.com/docs/guides/storage/security/access-control
- Chaves públicas e secretas: https://supabase.com/docs/guides/api/api-keys
- Build Vercel: https://vercel.com/docs/builds/configure-a-build

