import { getSupabase } from '../supabase-client.js';
import { message, withBusy } from './ui.js';

export class AccessError extends Error {
  constructor(reason) { super(reason); this.reason = reason; }
}
// getUser consulta o Auth; a autorização vem dos perfis editoriais protegidos no banco, nunca de user_metadata.
export async function verifyAdmin(client) {
  const { data: { session }, error: sessionError } = await client.auth.getSession();
  if (sessionError || !session) throw new AccessError('session');
  const { data: { user }, error } = await client.auth.getUser();
  if (error) {
    if (error.status === 401 || error.status === 403) throw new AccessError('session');
    throw error;
  }
  if (!user) throw new AccessError('session');
  const { data: allowed, error: permissionError } = await client.rpc('is_admin');
  if (permissionError) throw permissionError;
  if (allowed !== true) throw new AccessError('denied');
  return user;
}
const destinations = new Set(['index.html', 'noticias.html', 'noticia-form.html', 'agenda.html', 'trajetoria.html']);
export function safeDestination(value) {
  try {
    const url = new URL(value || 'index.html', 'https://local.invalid/admin/');
    if (url.origin !== 'https://local.invalid' || !url.pathname.startsWith('/admin/')) return 'index.html';
    const filename = url.pathname.slice('/admin/'.length);
    if (!destinations.has(filename)) return 'index.html';
    // Não propagar parâmetros arbitrários ou URLs de retorno externas.
    const id = url.searchParams.get('id');
    return filename === 'noticia-form.html' && /^[0-9a-f-]{36}$/i.test(id || '') ? filename + '?id=' + id : filename;
  } catch { return 'index.html'; }
}
function loginRedirect(reason) {
  const current = location.pathname.split('/').pop() || 'index.html';
  const next = safeDestination(current + location.search);
  location.replace('login.html?reason=' + encodeURIComponent(reason) + '&next=' + encodeURIComponent(next));
}
export async function logout(client) {
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) throw error;
  location.replace('login.html');
}
export async function protectPage() {
  let client;
  try {
    client = await getSupabase();
  } catch {
    loginRedirect('config');
    return null;
  }
  try {
    const user = await verifyAdmin(client);
    document.querySelector('[data-auth-loading]').hidden = true;
    document.querySelector('[data-admin-content]').hidden = false;
    document.querySelector('[data-user]').textContent = user.email || 'Administrador';
    document.querySelector('[data-logout]').addEventListener('click', async event => {
      event.currentTarget.disabled = true;
      try { await logout(client); }
      catch { message('Não foi possível sair. Tente novamente.', true); event.target.disabled = false; }
    });
    const lock = () => { document.querySelector('[data-admin-content]').hidden = true; };
    // Não aguardar outras chamadas Supabase dentro do callback de Auth.
    client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        lock(); loginRedirect('session');
      }
    });
    // Revalidar também quando voltar a uma aba ou restaurar uma página do histórico.
    let checking = false;
    async function recheck() {
      if (document.hidden || checking) return;
      checking = true;
      lock();
      try {
        await verifyAdmin(client);
        document.querySelector('[data-admin-content]').hidden = false;
      } catch (error) {
        if (error instanceof AccessError) loginRedirect(error.reason);
        else message('Não foi possível revalidar o acesso. Recarregue a página.', true, document.querySelector('[data-auth-loading]'));
        document.querySelector('[data-auth-loading]').hidden = false;
      } finally { checking = false; }
    }
    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('pageshow', event => { if (event.persisted) recheck(); });
    return { client, user };
  } catch (error) {
    if (error instanceof AccessError) {
      if (error.reason === 'denied') await client.auth.signOut({ scope: 'local' });
      loginRedirect(error.reason);
    } else {
      message('Não foi possível verificar sua permissão. Confira a conexão e a configuração das tabelas; recarregue para tentar novamente.', true, document.querySelector('[data-auth-loading]'));
    }
    return null;
  }
}
export async function initLogin() {
  const form = document.querySelector('#login-form');
  if (!form) return;
  let client;
  try { client = await getSupabase(); }
  catch (error) {
    message(error.name === 'ConfigurationError'
      ? 'Painel aguardando configuração. Preencha SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY conforme o guia.'
      : 'Não foi possível carregar a conexão com o Supabase. Confira sua internet e recarregue a página.', true);
    return;
  }
  form.querySelector('fieldset').disabled = false;
  const reason = new URLSearchParams(location.search).get('reason');
  if (reason === 'denied') message('Esta conta não está autorizada a acessar o painel.', true);
  else if (reason === 'session') message('Entre para continuar. Sua sessão pode ter expirado.');
  else message('Use a conta autorizada pela administração da Central.');
  const next = safeDestination(new URLSearchParams(location.search).get('next'));
  try { await verifyAdmin(client); location.replace(next); return; } catch { /* Exibir login. */ }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    await withBusy(form, async () => {
      message('Verificando acesso…');
      try {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await verifyAdmin(client);
        location.replace(next);
      } catch (error) {
        if (error instanceof AccessError && error.reason === 'denied') {
          await client.auth.signOut({ scope: 'local' });
          message('Esta conta não está autorizada a acessar o painel.', true);
        } else if (['PGRST202', 'PGRST205'].includes(error?.code)) {
          message('O banco editorial ainda não está disponível. Execute as duas migrations do projeto no SQL Editor do Supabase.', true);
        } else message('Não foi possível entrar. Confira e-mail, senha e conexão.', true);
      } finally { form.elements.password.value = ''; }
    });
  });
}
if (typeof document !== 'undefined' && document.querySelector('#login-form')) initLogin();

