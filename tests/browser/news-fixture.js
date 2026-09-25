// Backend em memória EXCLUSIVO DOS TESTES. Nenhum mock é importado pelo site.
import { randomUUID } from 'node:crypto';
export async function installNewsMock(context, { records = [], authorized = true, trajectories = [], matches = [] } = {}) {
  const state = { tables: { trajectory: structuredClone(trajectories), trajectory_matches: structuredClone(matches) }, rows: structuredClone(records), files: new Map(), failRead: false, failUpload: false, failWrite: false };
  await context.route('**/config/supabase-config.js', route => route.fulfill({ contentType: 'text/javascript',
    body: "export const SUPABASE_URL='https://test.supabase.co';export const SUPABASE_PUBLISHABLE_KEY='sb_publishable_01234567890123456789';" }));
  await context.route('https://test.supabase.co/storage/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nXsAAAAASUVORK5CYII=', 'base64') }));
  await context.route('**/__cms_test', async route => {
    const request = route.request().postDataJSON();
    let result;
    const allowed = request.session && authorized;
    if (request.type === 'rpc') result = { data: Boolean(allowed), error: null };
    else if (request.type === 'upload') {
      if (!allowed || state.failUpload) result = { error: { code: '42501' } };
      else { state.files.set(request.path, true); result = { data: { path: request.path }, error: null }; }
    } else if (request.type === 'remove') {
      request.paths.forEach(path => state.files.delete(path));
      result = { error: null };
    } else {
      const { action, filters, orders, range, one, payload, table } = request;
      const source = table === 'news' ? state.rows : state.tables[table] || [];
      let rows = source;
      if (!allowed) rows = rows.filter(row => table === 'trajectory' ? row.publication_status === 'published'
        : table === 'trajectory_matches' ? state.tables.trajectory.some(parent => parent.id === row.trajectory_id && parent.publication_status === 'published')
        : row.status === 'published' && Date.parse(row.published_at) <= Date.now());
      rows = rows.filter(row => filters.every(([op, key, value]) => op === 'eq' ? row[key] === value : row[key] <= value));
      if (action !== 'read' && !allowed) result = { error: { code: '42501' } };
      else if (action !== 'read' && state.failWrite) result = { error: { code: '42501' } };
      else if (action === 'read' && state.failRead) result = { error: { message: 'offline' } };
      else if (action === 'insert' || action === 'update') {
        const existing = action === 'update' ? rows[0] : null;
        if (source.some(row => row.id !== existing?.id && ((table === 'news' && payload.slug && row.slug === payload.slug) || (table === 'trajectory' && payload.year && row.year === payload.year)))) result = { error: { code: '23505' } };
        else if (action === 'update' && !existing) result = { error: { code: 'PGRST116' } };
        else {
          const record = { id: randomUUID(), created_at: new Date().toISOString(), ...existing, ...payload, updated_at: new Date().toISOString() };
          if (existing) Object.assign(existing, record); else source.push(record);
          result = { data: record, error: null };
        }
      } else if (action === 'delete') {
        if (table === 'news') state.rows = source.filter(row => !rows.includes(row));
        else state.tables[table] = source.filter(row => !rows.includes(row));
        result = { data: rows[0], error: rows.length ? null : { code: 'PGRST116' } };
      } else {
        for (const [key, options] of [...orders].reverse()) rows = [...rows].sort((a, b) => (typeof a[key] === 'number' ? a[key] - b[key] : String(a[key]).localeCompare(String(b[key]))) * (options?.ascending === false ? -1 : 1));
        const count = rows.length;
        if (range) rows = rows.slice(range[0], range[1] + 1);
        result = { data: one ? rows[0] || null : rows, count, error: null };
      }
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(result) });
  });
  await context.route('https://esm.sh/**', route => route.fulfill({ contentType: 'text/javascript', body: `
    export function createClient(url, key, options) {
      const anonymous = options.auth.persistSession === false;
      let callback = () => {};
      const user = { id: '11111111-1111-4111-8111-111111111111', email: 'editor@example.test' };
      const session = () => !anonymous && Boolean(localStorage.getItem('test-session'));
      const api = body => fetch('/__cms_test', {method: 'POST', body: JSON.stringify({...body, session: session()})}).then(r => r.json());
      return {
        auth: {
          getSession: async () => ({data: {session: session() ? {user} : null}, error: null}),
          getUser: async () => ({data: {user: session() ? user : null}, error: null}),
          signInWithPassword: async ({password}) => { if (password !== 'senha-de-teste') return {error: {message: 'invalid'}}; localStorage.setItem('test-session','1'); return {error: null}; },
          signOut: async () => { localStorage.removeItem('test-session'); callback('SIGNED_OUT'); return {error: null}; },
          onAuthStateChange: fn => { callback = fn; return {data: {subscription: {unsubscribe() {}}}}; }
        },
        rpc: () => api({type: 'rpc'}),
        storage: {from: () => ({
          upload: (path) => api({type: 'upload',path}),
          remove: paths => api({type: 'remove',paths}),
          getPublicUrl: path => ({data: {publicUrl: 'https://test.supabase.co/storage/v1/object/public/central-media/' + path}})
        })},
        from: table => {
          const q = {type:'query', table, action:'read', filters:[], orders:[]};
          return {
            select() { return this; }, eq(key,value) {q.filters.push(['eq',key,value]);return this;},
            lte(key,value) {q.filters.push(['lte',key,value]);return this;},
            order(key,options) {q.orders.push([key,options]);return this;},
            range(a,b) {q.range=[a,b];return this;},
            single() {q.one=true;return this;}, maybeSingle() {q.one=true;return this;},
            insert(payload) {q.action='insert';q.payload=payload;return this;},
            update(payload) {q.action='update';q.payload=payload;return this;},
            delete() {q.action='delete';return this;},
            then(resolve,reject) {return api(q).then(resolve,reject);}
          };
        }
      };
    }
  ` }));
  return state;
}
export async function login(page) {
  await page.goto('/admin/login.html');
  await page.getByLabel('E-mail', { exact: true }).fill('editor@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('senha-de-teste');
  await page.getByRole('button', { name: 'Entrar no painel' }).click();
  await page.waitForURL('**/admin/index.html');
}
export async function fillNews(page, title = 'Vozes da Central') {
  await page.getByLabel('Título *', { exact: true }).fill(title);
  await page.getByLabel('Resumo').fill('Um resumo editorial de demonstração.');
  await page.getByLabel('Conteúdo *', { exact: true }).fill('Primeiro parágrafo.\nLinha preservada.\n\n<img src=x onerror=alert(1)>');
  await page.getByLabel('Categoria *', { exact: true }).fill('Batalhas');
  await page.getByLabel('Nome do autor *', { exact: true }).fill('Central');
}
