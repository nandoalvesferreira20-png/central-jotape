# Galeria estática — V2

## Seleção
Foram copiados, sem alterar os bytes originais:
- IMG_7308.JPG.jpeg — retrato em preto e branco, 2704 × 3600.
- IMG_7310.JPG.jpeg — braços cruzados, 2928 × 3904.
- IMG_7311.JPG.jpeg — detalhe das mãos e anéis, 1888 × 2528.
- IMG_7312.JPG.jpeg — retrato mais próximo com colar, 2464 × 3280.
- IMG_7317.JPG.jpeg — mãos junto ao rosto, preto e branco, 2288 × 3056.

Origem: assets/img/. Destino: assets/img/galeria/.
Não foram incluídos logos, capas, merch nem variantes quase idênticas. IMG_7316 repete IMG_7311; os demais enquadramentos semelhantes foram descartados para manter a seleção compacta. O material disponível é um ensaio de retratos; não foram inventados shows, locais ou datas.

## Adicionar uma fotografia
1. Copie a foto autorizada para assets/img/galeria/, preservando os originais usados pelo site.
2. Acrescente um objeto em galleryImages, no início de js/galeria.js, com src, alt, width e height reais.
3. A ordem da lista define a sequência circular; a primeira foto inicia ativa. O carrossel, lightbox e contador se adaptam ao total. Um campo caption opcional aparece abaixo da foto ativa; sem esse campo, não há legenda.
4. Use alt descritivo, sem inventar contexto. Evite duplicatas e arquivos excessivamente pesados.
5. O teaser é independente: suas três imagens estão entre gallery-teaser:start/end em index.html.
6. Rode npm run build com as variáveis públicas do projeto configuradas.

As cinco cópias preservam a resolução e o formato dos originais. Somente a imagem principal carrega imediatamente; as restantes usam lazy loading. Não há compressão nem dependências externas adicionadas.

## Implementação
- galeria.html, css/galeria.css, js/galeria.js.
- Dialog nativo: foco contido, Escape, retorno de foco, botões, setas e gesto horizontal.
- Home recebe somente teaser, link no menu e importação do CSS isolado.
- Build inclui galeria.html; diretórios css/js/assets já eram copiados.
- Sem banco, Supabase, alterações de admin, notícias, trajetória ou rimas.
- Testes específicos: tests/browser/gallery.spec.js.

## Validação
Conferir imagens, foco, controles e ausência de overflow em 375/390/430/768/1440. A suíte existente cobre regressões do CMS e trajetória. As cópias são verificadas por hash contra os originais.

Validação concluída: 11 testes Node, 32 testes existentes de navegador e 7 da galeria aprovados após a inclusão da rota no servidor local. Capturas mobile/desktop revisadas. Build aprovado e arquivos de galeria conferidos fisicamente em dist. Originais e cópias comparados por hash.

Resumo desta entrega: 4 arquivos existentes alterados (index.html, scripts/build.mjs, scripts/serve.mjs e tests/structure.test.mjs), 5 novos arquivos de código/testes/documentação e 5 cópias de fotografias. Nenhum commit.

## Revisão da apresentação: carrossel editorial
O grid foi substituído por uma foto central com vizinhas parciais, contador e controles externos. A navegação usa índices circulares, sem clones, autoplay ou biblioteca. Setas do teclado atuam quando o foco está no carrossel; Pointer Events permitem swipe e arrasto. Somente a foto ativa entra na ordem de tabulação; clicar nela abre o lightbox preservado. Transições respeitam prefers-reduced-motion.

As fotos usam object-fit: contain, sem deformação ou recorte agressivo. A área visual mede 70svh no desktop, 60svh no tablet e 55svh no mobile. A home usa uma faixa horizontal independente com scroll-snap, três fotos e o mesmo link VER GALERIA. Pode-se deslizar ou navegar pelos links com Tab; o contêiner focável também permite rolagem pelo teclado.

Arquivos desta revisão: galeria.html, css/galeria.css, js/galeria.js, index.html (somente teaser), tests/browser/gallery.spec.js e este documento. Fotos, lista de dados, build e demais páginas permanecem intactos.

Validação da revisão: 11 testes Node e 40 testes de navegador aprovados; os 8 testes específicos foram repetidos após o ajuste final mobile, incluindo toque via Chrome DevTools. Build aprovado. Fotos, lista de dados e arquivos protegidos comparados com a versão anterior. Nenhum commit.
