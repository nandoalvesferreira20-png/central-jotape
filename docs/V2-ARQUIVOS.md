# Inventário da V2 — primeira etapa (histórico)

Este arquivo registra a entrega anterior. Para as mudanças atuais de notícias, consulte [CMS-NOTICIAS.md](CMS-NOTICIAS.md).

## Arquivos criados (40)

- `.env.example`
- `.gitignore`
- `admin/agenda.html`
- `admin/index.html`
- `admin/login.html`
- `admin/noticia-form.html`
- `admin/noticias.html`
- `admin/trajetoria.html`
- `config/supabase-config.js`
- `css/admin.css`
- `css/portal-base.css`
- `docs/SUPABASE.md`
- `docs/V2-ARQUIVOS.md`
- `js/admin/agenda.js`
- `js/admin/auth.js`
- `js/admin/dashboard.js`
- `js/admin/list-view.js`
- `js/admin/noticias.js`
- `js/admin/repository.js`
- `js/admin/storage.js`
- `js/admin/trajetoria.js`
- `js/admin/ui.js`
- `js/admin/validation.js`
- `js/config-validation.js`
- `js/supabase-client.js`
- `noticia.html`
- `noticias.html`
- `package-lock.json`
- `package.json`
- `playwright.config.js`
- `scripts/build.mjs`
- `scripts/serve.mjs`
- `supabase/migrations/202609210001_cms_base.sql`
- `tests/browser/admin.spec.js`
- `tests/build.test.mjs`
- `tests/rls.test.mjs`
- `tests/structure.test.mjs`
- `tests/validation.test.mjs`
- `trajetoria-2026.html`
- `vercel.json`

## Arquivos existentes alterados

- `README.md`: adiciona acesso ao guia de Supabase e ao inventário; atualiza a descrição técnica para distinguir a landing estática da V2.

## Preservados

- `index.html`, `css/style.css`, `js/main.js` e toda a pasta `assets/`.
- Nenhuma seção, texto, imagem ou navegação pública foi substituída.

## Validação

- 11 testes Node aprovados, incluindo build e RLS em PostgreSQL local via PGlite.
- 10 testes de navegador aprovados com backend simulado, incluindo login/logout e larguras 375/390/430/1440.
- Hashes SHA-256 da landing, CSS e JS originais conferidos byte a byte.
- A validação real do Supabase depende da criação do projeto, migração, usuário autorizado e configuração pública.

