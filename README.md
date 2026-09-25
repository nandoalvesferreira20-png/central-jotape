# Central Jotapê MC

Portal editorial desenvolvido pela Loung Tech para a Central Jotapê MC.

A plataforma reúne notícias, música, trajetória competitiva, galeria de fotografias e conteúdos relacionados ao Jotapê, com painel administrativo privado para gerenciamento editorial.

## Recursos disponíveis

- **Home:** destaques publicados do CMS, música, canais da Central, agenda editorial e chamadas para trajetória e galeria.
- **Notícias:** listagem pública e matéria por slug; rascunhos e conteúdos agendados respeitam as regras de publicação existentes.
- **Painel:** autenticação, autorização editorial, notícias, uploads, agenda e gestão da trajetória/batalhas.
- **Trajetória 2026:** etapas, resultados e status provenientes do Supabase, além das três rimas aprovadas.
- **Galeria:** carrossel estático com imagens locais, teclado, swipe e lightbox; teaser independente e compacto na home.
- **Recuperação de senha:** solicitação por e-mail, redefinição e retorno ao login.
- **Interface responsiva:** HTML, CSS e JavaScript puro, sem framework.

A agenda da home é editorial estática: não consulta automaticamente os registros do painel. Links de ingressos, música, merch e redes direcionam aos destinos configurados; o portal não implementa loja ou player próprio.

## Executar localmente

Requer Node.js 22+ e Chrome para os testes de navegador.

    npm ci
    npm run dev

Abra http://127.0.0.1:4175. O painel fica em /admin/login.html. Sirva o projeto por HTTP: módulos JavaScript não funcionam corretamente abrindo o HTML via file://.

## Configuração e publicação

O client utiliza config/supabase-config.js. No build da Vercel, configure:

- SUPABASE_URL
- SUPABASE_PUBLISHABLE_KEY

Ambas são públicas por definição. .env.example contém somente campos vazios. O build lê as variáveis do processo; não carrega .env automaticamente. Não use chaves administrativas ou senhas nesse arquivo.

    npm run build

A saída é dist/. O domínio de produção documentado é https://central-jotape.vercel.app. Os metadados públicos usam esse domínio; se ele mudar, atualize canonical e URLs sociais nas páginas públicas.

O build copia as páginas públicas, admin, assets, CSS, JS e a configuração pública gerada. SQL, seeds, exemplos de configuração, testes, documentação, .env, .git e node_modules ficam fora da publicação.

O Supabase existente não precisa ser recriado. Configuração detalhada:

- [Supabase, migrations, Storage e permissões](docs/SUPABASE.md)
- [Recuperação de senha e callbacks de Auth](docs/RECUPERACAO-SENHA.md)

SMTP próprio será configurado posteriormente. O fluxo de recuperação permanece inalterado nesta finalização.

## Estrutura

- index.html: portal e chamadas editoriais.
- noticias.html / noticia.html: notícias públicas.
- trajetoria-2026.html: jornada competitiva.
- galeria.html: galeria completa.
- admin/: painel privado e páginas de autenticação.
- js/public/ e js/admin/: módulos públicos e administrativos.
- css/editorial-system.css: paleta e hierarquia tipográfica compartilhadas.
- assets/img/: fotografias e artes locais; assets/img/galeria/: seleção da galeria.
- assets/fonts/: Anton e licença; textos longos usam fontes de sistema.
- assets/icons/favicon.svg: favicon existente, preservado.

## Conteúdo e manutenção

Atualize notícias e trajetória pelo painel. Na home, agenda, números de carreira e links editoriais estáticos devem receber somente dados confirmados; campos sem informação não representam conquistas ou eventos inventados.

Para adicionar fotos, siga [o guia da galeria](docs/GALERIA.md). As imagens originais são preservadas; não substituir arquivos sem revisar referências, alt e enquadramento.

A paleta pública se inspira na arte local aaur-cover.jpg. As capas, retratos, resultados, rimas e composições aprovadas foram preservados. O crédito público “Desenvolvido pela Loung Tech” abre https://loung-tech.vercel.app/ em nova aba, com noopener e noreferrer.

As referências editoriais existentes incluem o [Linktree da Central](https://linktr.ee/centraljotapemc) e o [Instagram da Central](https://www.instagram.com/centraljotapemc/). Os destinos de streaming e redes permanecem os já cadastrados.

## Metadados

As cinco páginas públicas têm descrição, Open Graph, Twitter Card e favicon. Os compartilhamentos usam o logo local em URL absoluta. Home, listagem, trajetória e galeria têm canonical.

A matéria individual mantém título e descrição atualizados no navegador pelo CMS. Como o site é estático, crawlers que não executam JavaScript recebem metadados sociais gerais da Central. Não foi criada renderização no servidor nem uma canonical genérica que reuniria todos os slugs na mesma URL.

As páginas públicas permitem indexação. Admin, login e redefinição mantêm noindex, nofollow e as proteções existentes da Vercel.

## Validação

    npm test
    npm run test:browser
    npm run build

Os testes usam dados isolados, sem alterar contas ou conteúdos reais. Incluem publicação, autorização, login, recuperação de senha, notícias, trajetória, galeria e responsividade.

Documentos em docs/ preservam relatórios históricos identificados por etapa/data; não representam pendências atuais automaticamente. Nenhum teste, seed ou exemplo deve ser publicado como conteúdo editorial.
