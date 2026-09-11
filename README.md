# Central Jotapê MC

Demonstração de experiência digital criada pela Loung Tech para apresentar uma possível parceria. Não representa um site oficial publicado ou uma parceria já estabelecida.

## Executar

Abra `index.html` diretamente ou, na pasta do projeto, execute:

```sh
python -m http.server 4173 --bind 127.0.0.1
```

Acesse http://127.0.0.1:4173. Não há build, dependências JavaScript, frameworks, rastreadores, formulários ou backend.

## Organização

- `index.html`: conteúdo semântico, metadados, links e registros editoriais.
- `css/style.css`: estilos por seção, variáveis, breakpoints e movimento reduzido.
- `js/main.js`: header, menu, reveal, contadores e parallax.
- `assets/img/`: imagens locais.
- `assets/fonts/`: Anton e licença SIL Open Font License. Texto corrido usa fontes de sistema.
- `assets/icons/`: favicon tipográfico provisório e textura SVG.

## Referências e conteúdo confirmado

Fonte consultada: https://linktr.ee/centraljotapemc, em 10/09/2026 (horário de São Paulo). O Instagram https://www.instagram.com/centraljotapemc/ não permitiu leitura automatizada; nenhuma informação foi inferida de publicações inacessíveis.

O Linktree fornece os links de Inteligência Marginal 3 — Mais um Silva, AAUR / Até a Última Rima, plataformas, redes e Central de MCs. A demonstração utiliza esses destinos, sem afirmar uma data de lançamento nem manter o status temporal de pré-save. Textos editoriais foram escritos para esta proposta; não são citações ou letras do artista. Os módulos de conteúdo são atalhos editoriais, não notícias com fatos ou datas inventados.

O YouTube exibido na demonstração direciona à **Central de MCs**. Contato direciona ao Instagram da Central, até confirmação de um e-mail profissional. Links externos abrem uma nova aba. Nenhum vídeo ou serviço de streaming é carregado antes do clique.

## Dados a substituir por informações oficiais

1. Agenda: substituir o artigo `data-event="pending"` por eventos confirmados. Usar `<time datetime="AAAA-MM-DD">`, cidade, local, nome e URL real do ingresso. Não há ingresso fictício nem botão de compra desativado.
2. Trajetória: preencher `data-value` em cada indicador somente após validação. Campo vazio mostra “—”, nunca zero. `data-suffix` é opcional; inserir o número na unidade desejada e seu sufixo correspondente. Exemplo de estrutura: `data-value="VALOR_VALIDADO" data-suffix=""`. Não inserir texto não numérico no atributo. Atualizar também o texto inicial do elemento para oferecer o dado sem JavaScript e remover a mensagem de validação pendente.
3. Conteúdos: substituir títulos, descrições e URLs por matérias, vídeos e registros oficiais. Atualmente os links vão aos canais de origem.
4. Artista: validar a apresentação curta e os créditos de imagem. A seção usa a arte de AAUR enquanto aguarda um retrato dedicado.
5. Música: confirmar a seleção em destaque e seu status antes da publicação.
6. Merch: confirmar loja e fotos da coleção que deverá aparecer.
7. Contato: inserir e-mail e/ou canal comercial aprovado; confirmar todos os perfis.
8. Identidade: validar assinatura tipográfica e o detalhe vermelho, extraído visualmente da arte de Inteligência Marginal 3, sem tratá-lo como cor institucional oficial.
9. Publicação: definir domínio, URL absoluta de `og:image`, imagem social e favicon oficiais; adicionar canonical. A demo inclui `noindex, nofollow`; remover apenas na versão aprovada para indexação. A marcação de demo permanece até aprovação de vínculo e conteúdo.

## Imagens já incluídas

Nenhuma imagem é necessária para abrir a demonstração: os arquivos abaixo já estão em `assets/img/`, obtidos das referências públicas do Linktree. Uso de apresentação; confirmar autorização e créditos antes de publicação oficial.

| Arquivo | Uso atual | Origem |
| --- | --- | --- |
| `jotape-hero.jpg` | Hero, fotografia em preto e branco via CSS | `https://ugc.production.linktr.ee/ca2d7145-d68b-46c4-9740-4022a388e3b3_067c3390-20a8-464f-a6ee-959c5878693e.jpeg` |
| `merch.jpg` | Merch e destaque editorial | Mesma fotografia de referência do hero |
| `release-cover.jpg` | Inteligência Marginal 3 — Mais um Silva | `https://ugc.production.linktr.ee/5498ac5e-a5f9-40c7-8554-754656b1571a_6a7b337c330000150090a90c-a219111b3b901b038f527e3429f2ee67.jpeg` |
| `aaur-cover.jpg` | Música e universo visual do artista | `https://ugc.production.linktr.ee/094b8464-a412-423c-a932-08a574f487ee_ab67616d0000b27329b5428e3258fc8fa40d2e8c.jpeg` |
| `central-mcs.jpg` | Chamada para o canal da Liga Central de MCs | `https://ugc.production.linktr.ee/ed3c7821-2aa1-4329-aded-06f4db8d355e_683573567-18101087590823147-2270526403889434274-n--1-.jpeg` |
| `central-logo.jpg` | Identidade de referência, reservada | `https://ugc.production.linktr.ee/10ae757c-8f86-4ceb-aeee-d07ee59f1be5_WhatsApp-Image-2026-03-24-at-17.26.32.jpeg` |

## Imagens recomendadas para a versão final

- **`jotape-hero.jpg`**: fotografia editorial ou de palco em alta resolução, idealmente 1920 × 1440, com área livre para texto à esquerda e rosto à direita. A foto atual é invertida na origem; ao substituir por uma foto normal, remover `rotate(180deg)` das regras `.hero-photo img` no CSS (desktop e mobile).
- **`jotape-profile.jpg`**: retrato vertical 1200 × 1500. Adicionar e trocar o `src`, dimensões, alt e legenda em `.artist-figure`, atualmente ocupada pela arte de AAUR.
- **`batalha-01.jpg`**: fotografia horizontal real de batalha, 1600 × 1000, para enriquecer o painel de batalhas, atualmente composto por tipografia e textura. Não há caminho quebrado esperando essa imagem.
- **`bastidores-01.jpg`**: registro horizontal 1400 × 1000 para `.story-main`, atualmente usando a fotografia de merch.
- **`merch.jpg`**: foto aprovada da coleção, mínimo 1200 × 1200.
- **`release-cover.jpg` e `aaur-cover.jpg`**: manter ou substituir pelas artes oficiais atualizadas, idealmente 1000 × 1000.
- **`og-cover.jpg`**: composição social 1200 × 630; configurar URL absoluta nos metadados na publicação.

Sempre atualizar `alt`, `width`, `height`, enquadramento e créditos junto com a troca de imagens. Preferir WebP/AVIF para novas fotografias, atualizando os caminhos. As imagens atuais não precisam de acesso externo para renderizar.

## Verificação

- Sintaxe JavaScript validada com `node --check js/main.js`.
- Inspeção no navegador em 375, 390, 430, 768, 1440 e 1920 px: sem overflow horizontal.
- Hero e área musical revisados visualmente em desktop/mobile; imagens locais carregadas e console sem erros na navegação testada.
- Menu testado: abrir, fechar, Escape, retorno do foco, Shift+Tab e seleção de seção.
- `prefers-reduced-motion` tratado no CSS e JavaScript; contadores vazios não são animados e não criam estatísticas fictícias.
- Recursos locais e âncoras verificados; a disponibilidade futura dos destinos externos depende das plataformas.
