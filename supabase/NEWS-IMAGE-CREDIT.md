# Crédito de imagem e novo EP

Antes de publicar o frontend atualizado, execute no SQL Editor do projeto Supabase a migration `migrations/202609250001_news_image_credit.sql`, após as migrations 202609210001 e 202609210002 já existentes. Ela apenas adiciona `public.news.image_credit text` nullable; não modifica registros, Auth, grants ou RLS. Pode ser reaplicada.

O campo opcional aceita até 500 caracteres no painel. Para remover um crédito, apague o texto e salve. O crédito aparece abaixo da imagem na matéria e na prévia privada; não aparece nos cards. Use o texto completo desejado, por exemplo `Foto: João Silva`. Conteúdo é renderizado como texto, nunca HTML.

Após aplicar no Supabase, valide com sua conta: criar com e sem crédito, editar, remover, publicar e abrir o slug. Os testes locais usam backend isolado e PostgreSQL local; não aplicam migrations no Supabase remoto.

## Capa oficial pendente

Não foi encontrada a capa de **Entre Praças, Papéis e Pastéis de Nata** nos assets. Adicione a capa aprovada como `assets/img/entre-pracas-cover.jpg` e siga os três comentários em `index.html`: defina o `src` e remova `hidden` das imagens preparadas (1080×1080 nas áreas grandes e 56×56 na linha musical, com dimensões ajustadas à imagem oficial). Os espaços existentes foram mantidos sem imagem incorreta; `release-cover.jpg` não foi apagado nem alterado. `aaur-cover.jpg` e o bloco de Até a Última Rima permanecem intactos.

O novo EP foi atualizado no destaque No Radar, na linha musical e no conteúdo editorial estático da Central (substituído por notícias quando existem destaques no CMS). Os quatro links apontam à playlist fornecida. A interface não exibe tracklist; nenhuma lista foi adicionada.
