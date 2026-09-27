# Galeria gerenciável

## Ativação manual

1. No SQL Editor do Supabase, execute uma única vez `supabase/migrations/202609270001_gallery_items.sql`, após as migrations existentes. Nenhuma migration antiga foi alterada.
2. A migration cria `public.gallery_items`, índice de publicação/ordem, trigger usando `cms_set_updated_at()` e cinco policies: `gallery_items_public_read` e `gallery_items_admin_read/insert/update/delete`.
3. A leitura pública permite somente `publication_status = 'published'`. Admin/editor usam a função existente `is_admin()`, baseada em `profiles`. Auth e suas funções não mudam.
4. Reutiliza o bucket público `central-media` e as policies existentes `central_media_admin_read/insert/update/delete`, sem alterá-las nem adicionar upload anônimo. Os arquivos ficam em `gallery/UUID.jpg|png|webp`, e o banco guarda somente o caminho.
5. Abra **Admin → Galeria**. Adicione as fotos existentes de `assets/img/galeria/`, preencha legenda/crédito e alt text quando disponíveis, escolha **Publicado**, defina a ordem e salve. Não é necessário cadastrar todas antes de publicar, mas o primeiro registro publicado já substitui toda a seleção estática.

Não há seed de fotos, envio automático de arquivos, aplicação remota de SQL ou commit. A tabela só existirá no ambiente remoto depois da execução manual.

## Uso do painel

- **Salvar foto** envia a imagem e salva os dados em uma operação da interface. JPEG/JPG, PNG e WebP até 5 MB, com validação de MIME e assinatura. O nome original não é utilizado e não há sobrescrita de objetos.
- **Editar** permite alterar legenda, crédito, alt, ordem e status. Selecionar outro arquivo substitui a imagem; deixar o campo vazio mantém a atual.
- A imagem antiga só é removida depois de o banco confirmar a substituição. Se o banco recusar a gravação após upload, tenta-se limpar o arquivo recém-enviado.
- **Rascunho** oculta o registro público. **Publicado** o disponibiliza na galeria e, se entre os três primeiros, na home.
- **Excluir** exige confirmação, remove primeiro o registro e só depois o arquivo. Falha de exclusão do registro mantém a listagem; falha de limpeza mostra o caminho que precisa ser conferido no Storage. O registro já excluído sai da lista.
- Os controles ficam bloqueados durante operações para impedir submits simultâneos.
- Como o bucket existente é público, o arquivo pode ser acessado por sua URL mesmo quando o registro está em rascunho. Rascunhos ficam fora das consultas e interfaces públicas.
- Banco e Storage não compartilham uma transação. Interrupção de rede/fechamento da aba ou falha na limpeza pode deixar arquivo órfão. Confira o caminho informado e suas referências antes de removê-lo manualmente.

## Galeria pública e home

O carrossel e o dialog nativo foram preservados, incluindo setas, swipe/arrasto, foco, Escape e movimento reduzido. A consulta usa o cliente público anônimo existente, mesmo se houver sessão editorial no navegador, com filtro published e ordem `position ASC, created_at ASC, id ASC`.

As cinco fotos locais da galeria e as três fotos atuais da home iniciam imediatamente, com controles funcionando. A consulta ocorre em segundo plano e só substitui essa coleção quando retorna registros publicados. Sem registros, com erro de importação/configuração/CDN/consulta ou após quatro segundos de espera pela consulta, o fallback permanece. A abertura local por file:// também preserva fotos e controles, mesmo quando o navegador bloqueia a integração ESM. As imagens locais não foram apagadas nem copiadas para o banco. A home consulta somente três registros. Uma página já aberta precisa ser recarregada para refletir edições.

Legenda e crédito são texto simples abaixo da fotografia ativa e no lightbox. Campos vazios não criam blocos. O crédito é salvo exatamente como digitado e exibido sem prefixo automático, evitando duplicar “Foto:”. O alt usa `alt_text` ou “Foto de Jotapê”; legenda não é usada como alt. Fotos estáticas mantêm seus alts e não recebem legendas inventadas.

## Build e validação

`npm run build` já copia toda a pasta admin e os diretórios de scripts/estilos. Não foi necessário alterar o build. A verificação de build agora confirma também os novos arquivos da galeria em dist; SQL e documentação não são publicados.

Testes específicos: `tests/gallery.test.mjs`, `tests/gallery-rls.test.mjs`, `tests/browser/gallery-cms.spec.js` e os cenários existentes de carrossel em `tests/browser/gallery.spec.js`. Testes SQL usam PostgreSQL local via PGlite; navegador usa backend simulado, sem escrever no Supabase real.

Após aplicar o SQL manualmente, conferir com uma conta admin/editor real: upload, publicar/ocultar, edição, troca de arquivo e exclusão. Em janela anônima, conferir que apenas publicados aparecem, com ordem, legenda/crédito, lightbox e teaser da home. Validar as policies e Storage do ambiente real, que não foram modificados por esta entrega.

## Arquivos da entrega

Criados:
- `supabase/migrations/202609270001_gallery_items.sql`
- `admin/galeria.html`
- `js/admin/galeria.js`
- `js/admin/gallery-service.js`
- `js/public/gallery-service.js`
- `tests/gallery.test.mjs`
- `tests/gallery-rls.test.mjs`
- `tests/browser/gallery-cms.spec.js`

Alterados:
- `admin/index.html`, `admin/noticias.html`, `admin/noticia-form.html`, `admin/agenda.html`, `admin/trajetoria.html`: somente link Galeria na navegação.
- `galeria.html`, `js/galeria.js`, `css/galeria.css`: dados dinâmicos, fallback e metadados abaixo da foto, preservando o carrossel.
- `index.html`, `js/home-gallery.js`: módulo do teaser e consulta limitada a três fotos. As mudanças nos números de Spotify/Instagram presentes no diff foram feitas fora desta implementação e preservadas.
- `js/admin/storage.js`: admite a pasta gallery no helper existente; galeria aceita apenas JPEG/PNG/WebP.
- `css/admin.css`: estilos das miniaturas e prévia exclusivos da galeria.
- `tests/browser/admin.spec.js`, `tests/browser/gallery.spec.js`, `tests/browser/news-fixture.js`, `tests/build.test.mjs`: cobertura da rota, fallback, backend simulado e inclusão em dist.
- `docs/GALERIA.md`: este guia.

Auth, recuperação de senha, módulos de notícias/trajetória, conteúdo do EP, imagens originais e migrations anteriores não foram alterados. Nenhuma dependência foi adicionada ao package.json ou package-lock.json.

## Resultado da validação desta entrega

- `npm test`: 18 aprovados de 19. Inclui SQL/RLS real em PGlite, validação dos arquivos, upload, compensação de falhas, substituição, exclusão e build. O teste de hash de `index.html` já falhava antes das alterações da galeria; não foi atualizado para mascarar diferenças fora do escopo.
- Navegador: 27/27 cenários de galeria e acesso administrativo aprovados. Incluem CRUD, submit duplicado, publicação/rascunho, ordenação/desempate, alt, legenda/crédito, fallback vazio/erro/CDN, teclado, foco, swipe/arrasto, home e mobile.
- Regressões adicionais: 40/52 aprovadas. Seis expectativas de números antigos de Spotify/Instagram divergem das alterações externas preservadas; seis testes do EP esperam uma capa escondida, embora a capa esteja visível no código atual, que não foi alterado nesta entrega. As funcionalidades de notícias, recuperação de senha e trajetória testadas passaram.
- Capturas com fotografia real revisadas; testes de limites e posição dos metadados em 375, 390, 430 e 1440 px aprovados. Cenários de lightbox/carrossel estático também cobrem 768 px.
- `npm run build`: aprovado com a configuração pública local existente. Nove arquivos relevantes de `dist` comparados byte a byte com as fontes; a nova rota administrativa está incluída.
- `git diff --check`: sem erros. Inventário: 8 arquivos novos e 17 alterados, incluindo documentação/testes e o arquivo da home compartilhado com alterações externas de estatísticas. Sem commit.

Os testes de navegador usam Supabase simulado; a aplicação manual do SQL e a validação de upload com conta real permanecem para o responsável. Nenhum dado ou configuração foi escrito no Supabase remoto.

## Correção do fallback

A lista e os cinco arquivos locais estavam intactos. O problema reproduzido foi uma falha de importação estática: gallery-service importava supabase-client, que importava a configuração antes de initGallery executar. Um arquivo de configuração ausente (404) interrompia toda a cadeia, fora do try/catch da consulta, deixando zero slides. A conversão da página para script type=module também impedia a inicialização ao abrir por file://. Na home, as fotos já estavam no HTML, mas os controles dependiam da mesma cadeia de módulos.

Os scripts públicos agora iniciam como scripts defer independentes, montam a coleção local e carregam a integração por import() protegido. Array vazio não substitui fotos. A chegada de publicados troca a coleção e mantém controles, foco e lightbox; se o lightbox estiver aberto, aguarda seu fechamento. Nenhum CSS, arquivo de imagem, Auth, banco, policy ou admin foi alterado nesta correção.

Arquivos desta correção: galeria.html, index.html (somente o script do teaser), js/galeria.js, js/home-gallery.js, js/public/gallery-service.js (renderizador movido para o script independente), tests/browser/gallery-fallback.spec.js e este guia.

Validação: cenários de banco vazio, somente rascunhos, publicados e erro; configuração vazia/404; file://; carregamento lento; galeria, home, lightbox, teclado/swipe e mobile. Build executado e cinco imagens comparadas byte a byte entre assets/img/galeria e dist/assets/img/galeria. Sem logs de debug e sem commit.
